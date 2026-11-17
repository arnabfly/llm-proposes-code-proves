// auth.test.ts - stored credentials and the whole "Sign in with ChatGPT" flow,
// against the fake sign-in server. No browser opens: the test plays the browser.

import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ProviderError } from "@tygig/core";
import { signJwt, startMockServer } from "./mock-server.ts";
import type { Mock } from "./mock-server.ts";

let mock: Mock;
let auth: typeof import("@tygig/auth");
let verifyIdToken: typeof import("../packages/auth/src/jwt.ts").verifyIdToken;

before(async () => {
  mock = await startMockServer();
  process.env.TYGIG_CHATGPT_AUTH_BASE = `${mock.url}/auth`;   // must be set before the import
  process.env.TYGIG_NO_BROWSER = "1";
  auth = await import("@tygig/auth");
  ({ verifyIdToken } = await import("../packages/auth/src/jwt.ts"));
});
after(async () => { await mock.close(); });

const tempFile = async () => path.join(await mkdtemp(path.join(os.tmpdir(), "tygig-")), "credentials.json");

/** Play the browser: open the sign-in address and follow the redirect back to Tygig. */
const browser = (url: string) => { void fetch(url); };

describe("credentials file", () => {
  test("a missing file means nothing stored; writes are readable back", async () => {
    const file = await tempFile();
    assert.deepEqual(await auth.readCredentials(file), { apiKeys: {}, chatgpt: {} });
    await auth.updateCredentials(file, (c) => { c.apiKeys.openai = "sk-1"; });
    assert.equal((await auth.readCredentials(file)).apiKeys.openai, "sk-1");
    if (process.platform !== "win32") {
      assert.equal((await stat(file)).mode & 0o777, 0o600);   // only you can read it
    }
  });
});

describe("Sign in with ChatGPT", () => {
  test("first sign-in: registers, validates the ID token, saves the tokens", async () => {
    const file = await tempFile();
    let shownUrl = "";
    const result = await auth.signInWithChatGPT(file, (url) => { shownUrl = url; browser(url); });

    assert.equal(result.email, "arnab@example.com");
    assert.equal(result.planUsage, true);
    assert.equal(result.firstTime, true);

    const params = new URL(shownUrl).searchParams;
    assert.equal(params.get("client_id"), "dynamic_agent_client");
    assert.equal(params.get("agent_name_hint"), "Tygig");
    assert.equal(params.get("code_challenge_method"), "S256");
    assert.equal(params.get("resource"), "https://api.openai.com/v1");
    assert.match(params.get("scope")!, /chatgpt\.tokens\.use\.direct/);
    assert.match(params.get("ext_agent_host_id")!, /^urn:uuid:/);
    assert.match(params.get("redirect_uri")!, /^http:\/\/127\.0\.0\.1:\d+\/auth\/callback$/);

    const saved = (await auth.readCredentials(file)).chatgpt;
    assert.equal(saved.account?.clientId, "client-issued-1");
    assert.equal(saved.account?.accessToken, "access-1");
    assert.equal(saved.hostId, params.get("ext_agent_host_id"));
  });

  test("signing in again reuses the client id and host id, without agent_name_hint", async () => {
    const file = await tempFile();
    await auth.signInWithChatGPT(file, browser);
    const hostId = (await auth.readCredentials(file)).chatgpt.hostId;
    let url = "";
    await auth.signInWithChatGPT(file, (u) => { url = u; browser(u); });
    const params = new URL(url).searchParams;
    assert.equal(params.get("client_id"), "client-issued-1");
    assert.equal(params.get("agent_name_hint"), null);
    assert.equal(params.get("login_hint"), "arnab@example.com");
    assert.equal(params.get("ext_agent_host_id"), hostId);
  });

  test("declining plan usage is detected", async () => {
    const file = await tempFile();
    mock.auth.planScope = false;
    try {
      const result = await auth.signInWithChatGPT(file, browser);
      assert.equal(result.planUsage, false);
      await assert.rejects(auth.getChatGPTAccessToken(file), (err: ProviderError) => err.code === "no_plan_usage");
    } finally {
      mock.auth.planScope = true;
    }
  });

  test("the local server ignores an answer with the wrong state, and keeps waiting", async () => {
    const file = await tempFile();
    const result = await auth.signInWithChatGPT(file, async (url) => {
      const redirect = new URL(new URL(url).searchParams.get("redirect_uri")!);
      const forged = await fetch(`${redirect.origin}${redirect.pathname}?code=evil&state=wrong`);
      assert.equal(forged.status, 404);                 // refused
      browser(url);                                     // the real answer still works
    });
    assert.equal(result.planUsage, true);
  });

  test("no 'scope' in the token answer means everything requested was granted", async () => {
    const file = await tempFile();
    mock.auth.omitScope = true;
    try {
      assert.equal((await auth.signInWithChatGPT(file, browser)).planUsage, true);
    } finally {
      mock.auth.omitScope = false;
    }
  });

  test("two windows needing a new token at once: only one refresh happens", async () => {
    const file = await tempFile();
    await auth.signInWithChatGPT(file, browser);
    await auth.updateCredentials(file, (c) => { c.chatgpt.account!.savedAt = Date.now() - 3600 * 1000; });
    const issuedBefore = mock.auth.issued;
    const [a, b] = await Promise.all([auth.getChatGPTAccessToken(file), auth.getChatGPTAccessToken(file)]);
    assert.equal(a, b);
    assert.equal(mock.auth.issued - issuedBefore, 1);
  });

  test("logout --all forgets the registration, so another account can sign in", async () => {
    const file = await tempFile();
    await auth.signInWithChatGPT(file, browser);
    await auth.signOutChatGPT(file, true);
    const saved = (await auth.readCredentials(file)).chatgpt;
    assert.equal(saved.account, undefined);
    assert.ok(saved.hostId);                            // the computer's id is kept
    let url = "";
    await auth.signInWithChatGPT(file, (u) => { url = u; browser(u); });
    assert.equal(new URL(url).searchParams.get("client_id"), "dynamic_agent_client");
  });

  test("a damaged credentials file says what to do", async () => {
    const file = await tempFile();
    const { writeFile } = await import("node:fs/promises");
    await writeFile(file, "{ not json");
    await assert.rejects(auth.readCredentials(file), /damaged\. Rename or delete it/);
  });

  test("an ID token with the wrong nonce is refused", async () => {
    const file = await tempFile();
    mock.auth.nonceOverride = "not-the-right-nonce";
    try {
      await assert.rejects(auth.signInWithChatGPT(file, browser), /does not answer this sign-in/);
    } finally {
      mock.auth.nonceOverride = undefined;
    }
  });

  test("the ID token checks: issuer, audience, expiry, signature", async () => {
    const now = Math.floor(Date.now() / 1000);
    const checks = { jwksUri: `${mock.url}/auth/jwks`, issuer: `${mock.url}/auth`, audience: "c1", nonce: "n1" };
    const good = { iss: checks.issuer, aud: "c1", sub: "u", exp: now + 60, nonce: "n1" };
    assert.equal((await verifyIdToken(signJwt(good), checks)).sub, "u");
    await assert.rejects(verifyIdToken(signJwt({ ...good, aud: "other" }), checks), /not meant for Tygig/);
    await assert.rejects(verifyIdToken(signJwt({ ...good, iss: "https://evil" }), checks), /unexpected issuer/);
    await assert.rejects(verifyIdToken(signJwt({ ...good, exp: now - 3600 }), checks), /expired/);
    const [h, p] = signJwt(good).split(".");
    const tampered = `${h}.${Buffer.from(JSON.stringify({ ...good, sub: "admin" })).toString("base64url")}.${signJwt(good).split(".")[2]}`;
    void p;
    await assert.rejects(verifyIdToken(tampered, checks), /signature is not valid/);
  });

  test("an expiring access token is refreshed, and the new refresh token is kept", async () => {
    const file = await tempFile();
    await auth.signInWithChatGPT(file, browser);
    await auth.updateCredentials(file, (c) => { c.chatgpt.account!.savedAt = Date.now() - 3600 * 1000; });
    const before = (await auth.readCredentials(file)).chatgpt.account!;
    const token = await auth.getChatGPTAccessToken(file);
    const afterRefresh = (await auth.readCredentials(file)).chatgpt.account!;
    assert.notEqual(token, before.accessToken);
    assert.equal(afterRefresh.accessToken, token);
    assert.notEqual(afterRefresh.refreshToken, before.refreshToken);
  });

  test("a refresh token that is no longer valid clears the sign-in", async () => {
    const file = await tempFile();
    await auth.signInWithChatGPT(file, browser);
    await auth.updateCredentials(file, (c) => { c.chatgpt.account!.savedAt = 0; });
    mock.auth.refreshError = "refresh_token_expired";
    try {
      await assert.rejects(auth.getChatGPTAccessToken(file),
        (err: ProviderError) => err.status === 401 && err.hint.includes("tygig login"));
      const account = (await auth.readCredentials(file)).chatgpt.account!;
      assert.equal(account.accessToken, "");
      assert.equal(account.clientId, "client-issued-1");   // registration kept
    } finally {
      mock.auth.refreshError = undefined;
    }
  });

  test("signing out revokes the refresh token and clears the tokens", async () => {
    const file = await tempFile();
    await auth.signInWithChatGPT(file, browser);
    const refresh = (await auth.readCredentials(file)).chatgpt.account!.refreshToken;
    assert.equal(await auth.signOutChatGPT(file), true);
    assert.ok(mock.auth.revoked.includes(refresh));
    const saved = (await auth.readCredentials(file)).chatgpt;
    assert.equal(saved.account?.refreshToken, "");
    assert.ok(saved.hostId);
    const raw = await readFile(file, "utf8");
    assert.ok(!raw.includes(refresh));
  });
});
