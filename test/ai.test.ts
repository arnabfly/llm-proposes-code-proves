// ai.test.ts - the three translators, the stream reader and the error handling,
// tested against the fake provider in mock-server.ts. Run with: npm test

import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { ProviderError } from "@tygig/core";
import type { ModelProvider, ModelRequest, StreamEvent } from "@tygig/core";
import { apiKeyHeaders, createProvider } from "@tygig/ai";
import { readSse } from "../packages/ai/src/sse.ts";
import { startMockServer } from "./mock-server.ts";
import type { Mock } from "./mock-server.ts";

let mock: Mock;
before(async () => { mock = await startMockServer(); });
after(async () => { await mock.close(); });

function provider(format: "openai-chat" | "openai-responses" | "anthropic", path: string, key = "test-key-123"): ModelProvider {
  return createProvider({
    label: "Mock", format, baseUrl: `${mock.url}${path}`, maxTokens: 1024,
    authHeaders: async () => apiKeyHeaders(format, key, "test"),
  });
}

function request(model: string, signal?: AbortSignal): ModelRequest {
  return { model, instructions: "Be brief.", messages: [{ role: "user", text: "Hi" }], tools: [], signal };
}

async function collect(stream: AsyncIterable<StreamEvent>) {
  let text = "";
  const events: StreamEvent[] = [];
  for await (const e of stream) {
    events.push(e);
    if (e.type === "text") text += e.text;
  }
  return { text, events };
}

/** A port number that nothing is listening on. */
async function freePort(): Promise<number> {
  const { createServer } = await import("node:net");
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

const lastRequest = (path: string) => [...mock.requests].reverse().find((r) => r.path === path)!;

describe("readSse", () => {
  test("joins chunks split anywhere, handles \\r\\n, comments and multi-line data", async () => {
    const raw = ": keep-alive\r\nevent: a\r\ndata: {\"x\":\r\ndata: 1}\r\n\r\ndata: second\n\ndata: last";
    const bytes = new TextEncoder().encode(raw);
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let i = 0; i < bytes.length; i += 3) controller.enqueue(bytes.slice(i, i + 3));   // 3-byte chunks
        controller.close();
      },
    });
    const out = [];
    for await (const m of readSse(body)) out.push(m);
    assert.deepEqual(out, [
      { event: "a", data: '{"x":\n1}' },
      { event: "", data: "second" },
      { event: "", data: "last" },
    ]);
  });
});

describe("OpenAI chat format", () => {
  test("streams text and usage, sends the system message and the key", async () => {
    const { text, events } = await collect(provider("openai-chat", "/openai/v1").stream(request("model-a")));
    assert.equal(text, "Hello from the mock.");
    assert.deepEqual(events.at(-1), { type: "done", usage: { inputTokens: 11, outputTokens: 5 } });
    const sent = lastRequest("/openai/v1/chat/completions");
    assert.equal(sent.headers.authorization, "Bearer test-key-123");
    assert.deepEqual(sent.body.messages[0], { role: "system", content: "Be brief." });
    assert.equal(sent.body.stream, true);
  });

  test("assembles a tool call that arrives in pieces", async () => {
    const { events } = await collect(provider("openai-chat", "/openai/v1").stream(request("tool-call")));
    const call = events.find((e) => e.type === "tool_call");
    assert.deepEqual(call, { type: "tool_call", call: { id: "call_1", name: "missing_tool", arguments: '{"a":1}' } });
  });

  test("an error inside the stream becomes a ProviderError", async () => {
    await assert.rejects(collect(provider("openai-chat", "/openai/v1").stream(request("midstream-error"))),
      (err: ProviderError) => err instanceof ProviderError && err.message.includes("boom"));
  });

  test("lists models, sorted", async () => {
    assert.deepEqual(await provider("openai-chat", "/openai/v1").listModels(), ["model-a", "model-b", "text-embedding-3"]);
  });
});

describe("OpenAI Responses format", () => {
  test("streams text; sends store:false, stream:true and the instructions", async () => {
    const { text, events } = await collect(provider("openai-responses", "/openai/v1").stream(request("model-a")));
    assert.equal(text, "Hello from the mock.");
    assert.deepEqual(events.at(-1), { type: "done", usage: { inputTokens: 12, outputTokens: 5 } });
    const sent = lastRequest("/openai/v1/responses");
    assert.equal(sent.body.store, false);
    assert.equal(sent.body.stream, true);
    assert.equal(sent.body.instructions, "Be brief.");
    assert.deepEqual(sent.body.input, [{ role: "user", content: "Hi" }]);
  });

  test("a stream that ends without response.completed is a failure", async () => {
    await assert.rejects(collect(provider("openai-responses", "/openai/v1").stream(request("cut-short"))),
      /ended before the reply was complete/);
  });

  test("the ChatGPT usage-limit code gets the 'Manage usage' hint", async () => {
    await assert.rejects(collect(provider("openai-responses", "/chatgpt/v1").stream(request("midstream-error"))),
      (err: ProviderError) => err.hint.includes("Manage usage"));
  });

  test("ChatGPT model list: only models marked visible", async () => {
    assert.deepEqual(await provider("openai-responses", "/chatgpt/v1").listModels(), ["plan-model"]);
  });

  test("API-key model list: non-chat models removed", async () => {
    assert.deepEqual(await provider("openai-responses", "/openai/v1").listModels(), ["model-a", "model-b"]);
  });
});

describe("Anthropic format", () => {
  test("streams text; sends x-api-key, anthropic-version, max_tokens and system", async () => {
    const { text, events } = await collect(provider("anthropic", "/anthropic/v1").stream(request("model-a")));
    assert.equal(text, "Hello from the mock.");
    assert.deepEqual(events.at(-1), { type: "done", usage: { inputTokens: 13, outputTokens: 5 } });
    const sent = lastRequest("/anthropic/v1/messages");
    assert.equal(sent.headers["x-api-key"], "test-key-123");
    assert.equal(sent.headers["anthropic-version"], "2023-06-01");
    assert.equal(sent.body.max_tokens, 1024);
    assert.equal(sent.body.system, "Be brief.");
  });

  test("assembles tool input from partial JSON", async () => {
    const { events } = await collect(provider("anthropic", "/anthropic/v1").stream(request("tool-call")));
    assert.deepEqual(events.find((e) => e.type === "tool_call"),
      { type: "tool_call", call: { id: "toolu_1", name: "missing_tool", arguments: '{"a":1}' } });
  });

  test("merges two user messages in a row (Anthropic requires alternation)", async () => {
    const p = provider("anthropic", "/anthropic/v1");
    await collect(p.stream({ ...request("model-a"),
      messages: [{ role: "user", text: "first" }, { role: "user", text: "second" }] }));
    const sent = lastRequest("/anthropic/v1/messages");
    assert.equal(sent.body.messages.length, 1);
    assert.equal(sent.body.messages[0].content.length, 2);
  });

  test("overloaded_error in the stream is reported", async () => {
    await assert.rejects(collect(provider("anthropic", "/anthropic/v1").stream(request("midstream-error"))),
      (err: ProviderError) => err.code === "overloaded_error");
  });
});

describe("incomplete answers", () => {
  test("chat format: a stream that stops without [DONE] or a stop reason is a failure", async () => {
    await assert.rejects(collect(provider("openai-chat", "/openai/v1").stream(request("chat-no-done"))),
      /ended before the reply was complete/);
  });

  test("the network breaking mid-reply is reported in plain language, not as 'terminated'", async () => {
    await assert.rejects(collect(provider("openai-chat", "/openai/v1").stream(request("network-drop"))),
      (err: ProviderError) => err instanceof ProviderError && /interrupted/.test(err.message));
  });

  test("a sign-in error keeps its own message (it is not a network problem)", async () => {
    const p = createProvider({ label: "ChatGPT plan", format: "openai-responses", baseUrl: `${mock.url}/chatgpt/v1`,
      maxTokens: 1024, authHeaders: async () => { throw new ProviderError("ChatGPT plan: your sign-in has expired.", 401, undefined, "Sign in again: tygig login", false); } });
    await assert.rejects(collect(p.stream(request("x"))), (err: ProviderError) => /sign-in has expired/.test(err.message) && !/Could not reach/.test(err.message));
    await assert.rejects(p.listModels(), (err: ProviderError) => /sign-in has expired/.test(err.message));
  });

  test("chat format: finish_reason 'length' is reported as cut short", async () => {
    await assert.rejects(collect(provider("openai-chat", "/openai/v1").stream(request("chat-length"))),
      (err: ProviderError) => err.code === "length");
  });

  test("Anthropic: stop_reason 'max_tokens' is reported with the maxTokens hint", async () => {
    await assert.rejects(collect(provider("anthropic", "/anthropic/v1").stream(request("max-tokens"))),
      (err: ProviderError) => err.code === "max_tokens" && err.hint.includes("maxTokens"));
  });
});

describe("errors and retries", () => {
  test("401 with a sign-in: the token is renewed once and the request repeated", async () => {
    let renewals = 0;
    const p = createProvider({ label: "ChatGPT plan", format: "openai-responses", baseUrl: `${mock.url}/chatgpt/v1`,
      maxTokens: 1024, authHeaders: async () => ({ authorization: "Bearer t" }),
      onUnauthorized: async () => { renewals++; return true; } });
    const { text } = await collect(p.stream(request("fail-401-once")));
    assert.equal(text, "Hello from the mock.");
    assert.equal(renewals, 1);
  });

  test("a model list that is not JSON gets a hint about the address", async () => {
    await assert.rejects(provider("openai-chat", "/html/v1").listModels(),
      (err: ProviderError) => err.hint.includes("/v1"));
  });

  test("429 is retried after Retry-After, then succeeds", async () => {
    const { text } = await collect(provider("openai-chat", "/openai/v1").stream(request("fail-429-once")));
    assert.equal(text, "Hello from the mock.");
    assert.equal(mock.attempts.get("/openai/v1/chat/completions:fail-429-once"), 2);
  });

  test("401 is not retried and tells you to log in again", async () => {
    await assert.rejects(collect(provider("openai-chat", "/openai/v1").stream(request("fail-401"))),
      (err: ProviderError) => err.status === 401 && err.hint.includes("tygig login"));
    assert.equal(mock.attempts.get("/openai/v1/chat/completions:fail-401"), 1);
  });

  test("500 is retried three times in total, then reported", async () => {
    await assert.rejects(collect(provider("openai-chat", "/openai/v1").stream(request("fail-500"))),
      (err: ProviderError) => err.status === 500 && err.retryable);
    assert.equal(mock.attempts.get("/openai/v1/chat/completions:fail-500"), 3);
  });

  test("nothing listening: a hint about local servers", async () => {
    const port = await freePort();
    const dead = createProvider({ label: "Ollama", format: "openai-chat", baseUrl: `http://127.0.0.1:${port}/v1`,
                                  maxTokens: 1024, authHeaders: async () => ({}) });
    await assert.rejects(collect(dead.stream(request("x"))),
      (err: ProviderError) => err instanceof ProviderError && err.hint.includes("Ollama"));
  });

  test("Esc (abort) stops the stream with an AbortError", async () => {
    const abort = new AbortController();
    setTimeout(() => abort.abort(), 400);
    await assert.rejects(collect(provider("openai-chat", "/openai/v1").stream(request("slow", abort.signal))),
      (err: Error) => err.name === "AbortError");
  });
});
