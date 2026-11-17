// mock-server.ts - a fake provider for tests. It speaks all three formats and
// OpenAI's sign-in endpoints, so Tygig can be tested with no account and no internet.
//
// Paths:
//   /openai/v1/chat/completions   OpenAI chat format (also used for OpenRouter, Ollama, ...)
//   /openai/v1/responses          OpenAI Responses format (API key)
//   /openai/v1/models             { data: [...] }
//   /chatgpt/v1/responses         Responses format for the ChatGPT plan
//   /chatgpt/v1/models            { models: [...] }  (the ChatGPT shape)
//   /anthropic/v1/messages        Anthropic format
//   /anthropic/v1/models          { data: [...] }
//   /auth/...                     the sign-in endpoints
//
// The model name chooses the behaviour: "fail-401", "fail-429-once", "fail-500",
// "midstream-error", "network-drop", "cut-short", "slow", "tool-call", or anything else for a normal answer.

import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { createSign, generateKeyPairSync } from "node:crypto";

export interface Recorded {
  method: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
  body: any;
}

export interface Mock {
  url: string;
  requests: Recorded[];
  attempts: Map<string, number>;
  auth: {
    planScope: boolean;            // grant chatgpt.tokens.use.direct?
    omitScope?: boolean;           // leave "scope" out of the token answer
    nonceOverride?: string;        // put a wrong nonce in the ID token
    refreshError?: string;         // make refresh fail with this OAuth error code
    revoked: string[];             // refresh tokens that were revoked
    issued: number;                // how many token sets were issued
  };
  close: () => Promise<void>;
}

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: "jwk" }), kid: "test-key", alg: "RS256", use: "sig" };

export async function startMockServer(): Promise<Mock> {
  const requests: Recorded[] = [];
  const attempts = new Map<string, number>();
  const auth: Mock["auth"] = { planScope: true, revoked: [], issued: 0 };
  const codes = new Map<string, { nonce: string; clientId: string }>();
  let base = "";

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const raw = await readBody(req);
    const body = parseBody(raw, req.headers["content-type"]);
    requests.push({ method: req.method ?? "", path: url.pathname, headers: req.headers, body });

    try {
      // ---- sign-in endpoints ------------------------------------------------
      if (url.pathname === "/auth/.well-known/openid-configuration") {
        return json(res, 200, { issuer: `${base}/auth`, jwks_uri: `${base}/auth/jwks`,
                                revocation_endpoint: `${base}/auth/revoke` });
      }
      if (url.pathname === "/auth/jwks") return json(res, 200, { keys: [jwk] });
      if (url.pathname === "/auth/api/accounts/authorize") {
        const p = url.searchParams;
        const clientId = p.get("client_id") === "dynamic_agent_client" ? "client-issued-1" : p.get("client_id")!;
        const code = `code-${codes.size + 1}`;
        codes.set(code, { nonce: p.get("nonce")!, clientId });
        const back = new URL(p.get("redirect_uri")!);
        back.searchParams.set("code", code);
        back.searchParams.set("state", p.get("state")!);
        if (p.get("client_id") === "dynamic_agent_client") back.searchParams.set("client_id", clientId);
        res.writeHead(302, { location: back.toString() }).end();
        return;
      }
      if (url.pathname === "/auth/api/accounts/oauth/token") {
        if (body.grant_type === "authorization_code") {
          const saved = codes.get(body.code);
          if (!saved || body.client_id !== saved.clientId) return json(res, 400, { error: "invalid_grant" });
          return json(res, 200, issueTokens(base, saved.clientId, auth.nonceOverride ?? saved.nonce, auth));
        }
        if (body.grant_type === "refresh_token") {
          if (auth.refreshError) return json(res, 400, { error: auth.refreshError });
          return json(res, 200, issueTokens(base, body.client_id, undefined, auth));
        }
        return json(res, 400, { error: "unsupported_grant_type" });
      }
      if (url.pathname === "/auth/revoke") {
        auth.revoked.push(body.token);
        res.writeHead(200).end();
        return;
      }

      // ---- model lists --------------------------------------------------------
      if (url.pathname === "/html/v1/models") {
        res.writeHead(200, { "content-type": "text/html" }).end("<html>Welcome</html>");
        return;
      }
      if (url.pathname === "/openai/v1/models" || url.pathname === "/anthropic/v1/models") {
        return json(res, 200, { data: [{ id: "model-b" }, { id: "model-a" }, { id: "text-embedding-3" }] });
      }
      if (url.pathname === "/chatgpt/v1/models") {
        return json(res, 200, { models: [
          { slug: "plan-model", display_name: "Plan model", visibility: "list" },
          { slug: "hidden-model", display_name: "Hidden", visibility: "hide" },
        ] });
      }

      // ---- model calls --------------------------------------------------------
      const model: string = body?.model ?? "";
      const key = `${url.pathname}:${model}`;
      attempts.set(key, (attempts.get(key) ?? 0) + 1);

      if (model === "fail-401") return json(res, 401, { error: { message: "Incorrect API key provided", code: "invalid_api_key" } });
      if (model === "fail-401-once" && attempts.get(key) === 1) return json(res, 401, { error: { message: "token expired" } });
      if (model === "fail-500") return json(res, 500, { error: { message: "Internal error" } });
      if (model === "fail-429-once" && attempts.get(key) === 1) {
        res.writeHead(429, { "content-type": "application/json", "retry-after": "1" });
        res.end(JSON.stringify({ error: { message: "Rate limit", code: "rate_limit_exceeded" } }));
        return;
      }

      if (url.pathname === "/openai/v1/chat/completions") return chat(res, model, body);
      if (url.pathname === "/openai/v1/responses" || url.pathname === "/chatgpt/v1/responses") return responses(res, model);
      if (url.pathname === "/anthropic/v1/messages") return anthropic(res, model);

      json(res, 404, { error: { message: `No route ${url.pathname}` } });
    } catch (err) {
      json(res, 500, { error: { message: String(err) } });
    }
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    url: base, requests, attempts, auth,
    close: () => new Promise((resolve) => { server.closeAllConnections(); server.close(() => resolve()); }),
  };
}

// ---- the three formats ------------------------------------------------------

const WORDS = ["Hello", " from", " the", " mock", "."];

async function chat(res: ServerResponse, model: string, body: any) {
  sseHead(res);
  if (model === "tool-call" && !body.messages.some((m: any) => m.role === "tool")) {
    send(res, { choices: [{ delta: { tool_calls: [{ index: 0, id: "call_1", function: { name: "missing_tool", arguments: '{"a":' } }] } }] });
    send(res, { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: "1}" } }] } }] });
    send(res, { choices: [{ delta: {}, finish_reason: "tool_calls" }] });
    res.end("data: [DONE]\n\n");
    return;
  }
  for (const w of WORDS) {
    if (model === "slow") await pause(300);
    send(res, { choices: [{ delta: { content: w } }] });
  }
  if (model === "midstream-error") { send(res, { error: { message: "boom", code: "server_error" } }); res.end(); return; }
  if (model === "chat-no-done") { res.end(); return; }                       // connection simply stops
  if (model === "network-drop") { await pause(100); res.socket?.destroy(); return; }   // the network breaks mid-reply
  if (model === "chat-length") { send(res, { choices: [{ delta: {}, finish_reason: "length" }] }); res.end("data: [DONE]\n\n"); return; }
  send(res, { choices: [{ delta: {}, finish_reason: "stop" }], usage: { prompt_tokens: 11, completion_tokens: 5 } });
  res.end("data: [DONE]\n\n");
}

async function responses(res: ServerResponse, model: string) {
  sseHead(res);
  send(res, { type: "response.created", response: { id: "resp_1" } }, "response.created");
  for (const w of WORDS) {
    if (model === "slow") await pause(300);
    send(res, { type: "response.output_text.delta", delta: w }, "response.output_text.delta");
  }
  if (model === "midstream-error") {
    send(res, { type: "response.failed", response: { error: { code: "subscription_sharing_usage_limit_exceeded", message: "limit" } } }, "response.failed");
    res.end();
    return;
  }
  if (model === "cut-short") { res.end(); return; }
  send(res, { type: "response.completed", response: { usage: { input_tokens: 12, output_tokens: 5 } } }, "response.completed");
  res.end();
}

async function anthropic(res: ServerResponse, model: string) {
  sseHead(res);
  send(res, { type: "message_start", message: { usage: { input_tokens: 13, output_tokens: 1 } } }, "message_start");
  send(res, { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } }, "content_block_start");
  send(res, { type: "ping" }, "ping");
  for (const w of WORDS) {
    if (model === "slow") await pause(300);
    send(res, { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: w } }, "content_block_delta");
  }
  send(res, { type: "content_block_stop", index: 0 }, "content_block_stop");
  if (model === "midstream-error") {
    send(res, { type: "error", error: { type: "overloaded_error", message: "Overloaded" } }, "error");
    res.end();
    return;
  }
  if (model === "tool-call") {
    send(res, { type: "content_block_start", index: 1, content_block: { type: "tool_use", id: "toolu_1", name: "missing_tool", input: {} } }, "content_block_start");
    send(res, { type: "content_block_delta", index: 1, delta: { type: "input_json_delta", partial_json: '{"a":' } }, "content_block_delta");
    send(res, { type: "content_block_delta", index: 1, delta: { type: "input_json_delta", partial_json: "1}" } }, "content_block_delta");
    send(res, { type: "content_block_stop", index: 1 }, "content_block_stop");
  }
  send(res, { type: "message_delta", delta: { stop_reason: model === "max-tokens" ? "max_tokens" : "end_turn" },
              usage: { output_tokens: 5 } }, "message_delta");
  send(res, { type: "message_stop" }, "message_stop");
  res.end();
}

// ---- helpers ------------------------------------------------------------------

function issueTokens(base: string, clientId: string, nonce: string | undefined, auth: Mock["auth"]) {
  auth.issued++;
  const now = Math.floor(Date.now() / 1000);
  const idToken = signJwt({ iss: `${base}/auth`, aud: clientId, sub: "user-123", email: "arnab@example.com",
                            iat: now, exp: now + 3600, ...(nonce ? { nonce } : {}) });
  const scope = ["openid", "profile", "email", "offline_access", "resource.invoke",
                 ...(auth.planScope ? ["chatgpt.tokens.use.direct"] : [])].join(" ");
  return { access_token: `access-${auth.issued}`, refresh_token: `refresh-${auth.issued}`, id_token: idToken,
           token_type: "Bearer", expires_in: 3600, ...(auth.omitScope ? {} : { scope }) };
}

export function signJwt(payload: object, kid = "test-key"): string {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT", kid })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createSign("RSA-SHA256").update(`${header}.${body}`).sign(privateKey).toString("base64url");
  return `${header}.${body}.${signature}`;
}

function sseHead(res: ServerResponse) {
  res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
}

function send(res: ServerResponse, data: object, event?: string) {
  res.write(`${event ? `event: ${event}\n` : ""}data: ${JSON.stringify(data)}\n\n`);
}

function json(res: ServerResponse, status: number, data: object) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(data));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
  });
}

function parseBody(raw: string, type: string | undefined): any {
  if (!raw) return {};
  if (type?.includes("application/x-www-form-urlencoded")) return Object.fromEntries(new URLSearchParams(raw));
  try { return JSON.parse(raw); } catch { return {}; }
}

function pause(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
