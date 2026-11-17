// chatgpt-session.ts - keeping a ChatGPT sign-in usable, and signing out.
//
// The access token lasts about an hour. Before it runs out, Tygig uses the
// refresh token to get a new one, silently. The refresh token itself is replaced
// every time ("rotating"), so both are saved together, under the file lock:
// if two Tygig windows need a new token at the same moment, the second one waits,
// then finds the first one's new token already saved and simply uses it.

import { ProviderError } from "@tygig/core";
import { readCredentials, updateCredentials, withLock, writeFileAtomic } from "./credentials.js";
import { RESOURCE, TOKEN_ENDPOINT, discover, postForm } from "./chatgpt-oauth.js";

const REFRESH_MARGIN_MS = 2 * 60 * 1000;   // refresh when less than two minutes remain

/** Refresh codes after which the sign-in cannot be saved (OpenAI's "Errors and recovery"). */
const TERMINAL = ["invalid_grant", "invalid_refresh_token", "token_expired",
                  "refresh_token_expired", "refresh_token_invalidated", "refresh_token_reused"];

/** A valid access token for the signed-in ChatGPT account, refreshed if needed. */
export async function getChatGPTAccessToken(credentialsFile: string): Promise<string> {
  const account = (await readCredentials(credentialsFile)).chatgpt.account;
  if (!account || !account.accessToken) {
    throw new ProviderError("ChatGPT plan: you are not signed in.", 401, "not_signed_in",
      "Sign in: tygig login", false);
  }
  if (!account.planUsage) {
    throw new ProviderError("ChatGPT plan: you did not allow Tygig to use your plan.", 403, "no_plan_usage",
      "Sign in again and allow plan usage (tygig login), or connect with an API key.", false);
  }
  if (Date.now() < account.savedAt + account.expiresIn * 1000 - REFRESH_MARGIN_MS) {
    return account.accessToken;                                   // still fresh
  }
  return refreshChatGPTToken(credentialsFile, false);
}

/**
 * Get a new access token with the refresh token. `force`: refresh even if the
 * saved token looks fresh (used when OpenAI rejected it early with a 401).
 */
export async function refreshChatGPTToken(credentialsFile: string, force: boolean): Promise<string> {
  return withLock(credentialsFile, async () => {
    // Read again under the lock: another window may have just refreshed.
    const creds = await readCredentials(credentialsFile);
    const account = creds.chatgpt.account;
    if (!account || !account.refreshToken) {
      throw new ProviderError("ChatGPT plan: you are not signed in.", 401, "not_signed_in",
        "Sign in: tygig login", false);
    }
    const fresh = Date.now() < account.savedAt + account.expiresIn * 1000 - REFRESH_MARGIN_MS;
    if (fresh && !force) return account.accessToken;

    let tokens: any;
    try {
      tokens = await postForm(TOKEN_ENDPOINT, {
        grant_type: "refresh_token",
        client_id: account.clientId,
        refresh_token: account.refreshToken,
        resource: RESOURCE,
      });
    } catch (err: any) {
      if (TERMINAL.includes(err.code)) {
        // The sign-in is over. Clear the tokens but keep the account's registration.
        account.accessToken = account.refreshToken = account.idToken = "";
        await writeFileAtomic(credentialsFile, JSON.stringify(creds, null, 2), 0o600);
        throw new ProviderError("ChatGPT plan: your sign-in has expired.", 401, err.code,
          "Sign in again: tygig login", false);
      }
      // A network or server problem: keep everything and let the user try again.
      throw new ProviderError(`ChatGPT plan: could not renew your sign-in (${err.message}).`,
        err.status, err.code, "Check your connection and try again.", false);
    }

    // Replace the access token, expiry, scopes and the rotating refresh token together.
    const scopes = typeof tokens.scope === "string" ? tokens.scope.split(" ").filter(Boolean) : account.scopes;
    account.accessToken = tokens.access_token;
    account.refreshToken = tokens.refresh_token ?? account.refreshToken;
    account.idToken = tokens.id_token ?? account.idToken;
    account.expiresIn = Number(tokens.expires_in ?? 3600);
    account.scopes = scopes;
    account.planUsage = scopes.includes("chatgpt.tokens.use.direct");
    account.savedAt = Date.now();
    await writeFileAtomic(credentialsFile, JSON.stringify(creds, null, 2), 0o600);
    return account.accessToken;
  });
}

/**
 * Sign out: ask OpenAI to revoke the refresh token, then clear the tokens locally.
 * `forget`: also forget the account's registration, so a different ChatGPT
 * account can sign in next (the host id is always kept, as OpenAI asks).
 * Returns whether OpenAI confirmed the revocation.
 */
export async function signOutChatGPT(credentialsFile: string, forget = false): Promise<boolean> {
  const account = (await readCredentials(credentialsFile)).chatgpt.account;
  let revoked = true;
  if (account?.refreshToken) {
    revoked = false;
    try {
      const { revocation_endpoint } = await discover();
      if (revocation_endpoint) {
        await postForm(revocation_endpoint, {
          token: account.refreshToken,
          token_type_hint: "refresh_token",
          client_id: account.clientId,
        });
        revoked = true;
      }
    } catch {
      revoked = false;   // cleared locally anyway; the user is told
    }
  }
  await updateCredentials(credentialsFile, (c) => {
    const a = c.chatgpt.account;
    if (!a) return;
    if (forget) delete c.chatgpt.account;
    else a.accessToken = a.refreshToken = a.idToken = "";
  });
  return revoked;
}

/** Is a ChatGPT sign-in stored (with tokens)? */
export async function hasChatGPTSignIn(credentialsFile: string): Promise<boolean> {
  return Boolean((await readCredentials(credentialsFile)).chatgpt.account?.refreshToken);
}
