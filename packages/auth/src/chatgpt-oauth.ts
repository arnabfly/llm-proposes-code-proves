// chatgpt-oauth.ts - "Sign in with ChatGPT" (OpenAI's documented flow for
// open-source apps that run on the user's own computer).
//
// In short: Tygig opens your browser at OpenAI's sign-in page. You sign in and
// agree. OpenAI sends the browser back to a tiny web server Tygig runs on your
// own computer (127.0.0.1) with a one-time code. Tygig swaps that code for tokens.
// Your password never passes through Tygig.

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { readCredentials, updateCredentials } from "./credentials.js";
import type { ChatGPTAccount } from "./credentials.js";
import { verifyIdToken } from "./jwt.js";
import { openBrowser } from "./browser.js";

/** OpenAI's sign-in server. Can be pointed elsewhere for tests. */
export const AUTH_BASE = process.env.TYGIG_CHATGPT_AUTH_BASE ?? "https://auth.openai.com";
/** Identifies the API the tokens are for. Always this value, also in tests. */
export const RESOURCE = "https://api.openai.com/v1";
/** Where codes and refresh tokens are exchanged for new tokens. */
export const TOKEN_ENDPOINT = `${AUTH_BASE}/api/accounts/oauth/token`;
const SCOPES = "openid profile email offline_access resource.invoke chatgpt.tokens.use.direct";
const PREFERRED_PORT = 1455;               // the port in OpenAI's examples
const CALLBACK_PATH = "/auth/callback";
const TIMEOUT_MS = 5 * 60 * 1000;          // give up after five minutes

export interface SignInResult {
  email: string;
  planUsage: boolean;    // false if the user did not allow use of the ChatGPT plan
  firstTime: boolean;    // show the "You're using your ChatGPT plan" notice
}

/**
 * Run the whole sign-in. `showUrl` receives the address, so the screen can show it
 * in case the browser does not open by itself.
 */
export async function signInWithChatGPT(credentialsFile: string, showUrl: (url: string) => void,
                                        signal?: AbortSignal): Promise<SignInResult> {
  // 1. The host id identifies this computer. Created once, saved before first use.
  let creds = await readCredentials(credentialsFile);
  const hostId = creds.chatgpt.hostId ?? `urn:uuid:${randomUUID()}`;
  if (!creds.chatgpt.hostId) {
    creds = await updateCredentials(credentialsFile, (c) => { c.chatgpt.hostId = hostId; });
  }

  // 2. First sign-in, or signing in again with the same account?
  const existing = creds.chatgpt.account;
  const returning = Boolean(existing?.clientId);

  // 3. Fresh secrets for this attempt (PKCE, state, nonce).
  const verifier = base64url(randomBytes(32));                       // kept secret here
  const challenge = base64url(createHash("sha256").update(verifier).digest());   // sent out
  const state = base64url(randomBytes(16));                          // ties callback to request
  const nonce = base64url(randomBytes(16));                          // ties ID token to request

  // 4. Start the local server BEFORE opening the browser.
  const server = await startCallbackServer(state);
  const redirectUri = `http://127.0.0.1:${server.port}${CALLBACK_PATH}`;

  try {
    // 5. Build the sign-in address and open it.
    const params = new URLSearchParams({
      client_id: returning ? existing!.clientId : "dynamic_agent_client",
      response_type: "code",
      redirect_uri: redirectUri,
      scope: SCOPES,
      resource: RESOURCE,
      state,
      nonce,
      code_challenge: challenge,
      code_challenge_method: "S256",
      ext_agent_host_id: hostId,
    });
    if (!returning) params.set("agent_name_hint", "Tygig");           // first registration only
    if (returning && existing!.email) params.set("login_hint", existing!.email);
    if (returning && !existing!.planUsage) params.set("prompt", "consent");   // ask again for plan use

    const url = `${AUTH_BASE}/api/accounts/authorize?${params}`;
    showUrl(url);
    openBrowser(url);

    // 6. Wait for the browser to come back.
    const callback = await server.waitForCallback(signal);      // only answers with our state
    const error = callback.get("error");
    if (error === "access_denied") throw new Error("Sign-in was cancelled in the browser.");
    if (error) throw new Error(`Sign-in failed: ${error}`);

    const code = callback.get("code");
    if (!code) throw new Error("The sign-in answer had no code. Try again.");
    const returnedClientId = callback.get("client_id");
    if (returning && returnedClientId && returnedClientId !== existing!.clientId) {
      throw new Error("The sign-in answer belongs to a different registration. Try again.");
    }
    const clientId = returning ? existing!.clientId : returnedClientId;
    if (!clientId) throw new Error("The sign-in answer had no client id. Try again.");

    // 7. Swap the one-time code for tokens.
    const tokens = await postForm(TOKEN_ENDPOINT, {
      grant_type: "authorization_code",
      client_id: clientId,
      code,
      code_verifier: verifier,
      redirect_uri: redirectUri,
      resource: RESOURCE,
    });

    // 8. Check the ID token: really from OpenAI, for us, answering this request.
    const discovery = await discover();
    const claims = await verifyIdToken(tokens.id_token, {
      jwksUri: discovery.jwks_uri, issuer: discovery.issuer, audience: clientId, nonce,
    });
    if (returning && existing!.subject !== claims.sub) {
      throw new Error("You signed in with a different ChatGPT account. To switch accounts, first run: tygig logout --all");
    }

    // 9. Did the user allow use of the ChatGPT plan? (No "scope" in the answer means:
    //    everything requested was granted; that is the OAuth rule.)
    const scopes = String(tokens.scope ?? SCOPES).split(" ").filter(Boolean);
    const planUsage = scopes.includes("chatgpt.tokens.use.direct");

    // 10. Save everything together.
    const account: ChatGPTAccount = {
      email: String(claims.email ?? ""),
      issuer: claims.iss,
      subject: claims.sub,
      clientId,
      idToken: tokens.id_token,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? "",
      tokenType: tokens.token_type ?? "Bearer",
      expiresIn: Number(tokens.expires_in ?? 3600),
      scopes,
      savedAt: Date.now(),
      planUsage,
      welcomed: existing?.welcomed ?? false,
    };
    await updateCredentials(credentialsFile, (c) => { c.chatgpt.account = account; });

    return { email: account.email, planUsage, firstTime: !account.welcomed };
  } finally {
    server.close();
  }
}

/** Remember that the first-time notice has been shown (OpenAI asks: only once). */
export async function markWelcomed(credentialsFile: string): Promise<void> {
  await updateCredentials(credentialsFile, (c) => {
    if (c.chatgpt.account) c.chatgpt.account.welcomed = true;
  });
}

// ---------------------------------------------------------------------------
// Helpers shared with chatgpt-session.ts

/** OpenAI's published configuration: the issuer name, the public keys, the revoke endpoint. */
export async function discover(): Promise<{ issuer: string; jwks_uri: string;
                                            revocation_endpoint?: string }> {
  const response = await fetch(`${AUTH_BASE}/.well-known/openid-configuration`, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Could not reach OpenAI's sign-in service (${response.status}).`);
  return (await response.json()) as any;
}

/** POST a form (key=value&...) and return the JSON answer. Errors carry OpenAI's code. */
export async function postForm(url: string, fields: Record<string, string>): Promise<any> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields),
    signal: AbortSignal.timeout(15_000),            // never hold the credentials lock for long
  });
  const text = await response.text();
  let json: any = {};
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  if (!response.ok) {
    const err = new Error(json.error_description ?? json.error ?? `HTTP ${response.status}`) as Error & { code?: string; status?: number };
    err.code = json.error;
    err.status = response.status;
    throw err;
  }
  return json;
}

function base64url(bytes: Buffer): string {
  return bytes.toString("base64url");
}

/**
 * A tiny web server on 127.0.0.1 that waits for the browser to come back.
 * It accepts only an answer carrying our `state`; anything else (another page
 * or program knocking on the port) is refused and the wait continues.
 */
async function startCallbackServer(expectedState: string): Promise<{
  port: number;
  waitForCallback: (signal?: AbortSignal) => Promise<URLSearchParams>;
  close: () => void;
}> {
  let deliver: (params: URLSearchParams) => void = () => {};
  const arrived = new Promise<URLSearchParams>((resolve) => { deliver = resolve; });
  const page = (title: string, text: string) =>
    `<html><body style='font-family:sans-serif;padding:2em'><h2>${title}</h2><p>${text}</p></body></html>`;

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (url.pathname !== CALLBACK_PATH || url.searchParams.get("state") !== expectedState) {
      res.writeHead(404, { "content-type": "text/html; charset=utf-8" })
         .end(page("Tygig", "This address does not belong to the current sign-in."));
      return;
    }
    const ok = !url.searchParams.get("error");
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(ok ? page("Tygig", "You are signed in. You can close this window and return to the terminal.")
               : page("Tygig", "Sign-in was not completed. You can close this window and return to the terminal."));
    deliver(url.searchParams);
  });

  // Try OpenAI's example port first; if it is taken, let the system pick a free one.
  const listen = (port: number) => new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => { server.off("error", reject); resolve(); });
  });
  try {
    await listen(PREFERRED_PORT);
  } catch {
    await listen(0);
  }
  const port = (server.address() as AddressInfo).port;

  return {
    port,
    waitForCallback: (signal) => new Promise<URLSearchParams>((resolve, reject) => {
      if (signal?.aborted) { reject(new Error("Sign-in cancelled.")); return; }
      const timer = setTimeout(() => reject(new Error("Sign-in timed out after five minutes.")), TIMEOUT_MS);
      signal?.addEventListener("abort", () => { clearTimeout(timer); reject(new Error("Sign-in cancelled.")); },
                              { once: true });
      arrived.then((params) => { clearTimeout(timer); resolve(params); });
    }),
    close: () => { server.closeAllConnections(); server.close(); },
  };
}
