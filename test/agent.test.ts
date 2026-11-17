// agent.test.ts - the loop and the session log, with a scripted fake provider.

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ProviderError } from "@tygig/core";
import type { AgentEvent, ModelProvider, ModelRequest, StreamEvent } from "@tygig/core";
import { createAgent, listSessions, projectSessionsDir, Session } from "@tygig/agent";

/** A provider that plays back a script: one list of pieces per model call. */
function scripted(script: (StreamEvent | Error | "wait")[][]): ModelProvider & { requests: ModelRequest[] } {
  const requests: ModelRequest[] = [];
  return {
    label: "Script",
    requests,
    async *stream(request) {
      requests.push(structuredClone({ ...request, signal: undefined }));
      for (const piece of script[requests.length - 1] ?? []) {
        if (piece === "wait") {
          await new Promise((resolve, reject) => {
            const timer = setTimeout(resolve, 1000);
            request.signal?.addEventListener("abort", () => { clearTimeout(timer);
              reject(Object.assign(new Error("aborted"), { name: "AbortError" })); });
          });
        } else if (piece instanceof Error) throw piece;
        else yield piece;
      }
    },
    async listModels() { return []; },
  };
}

const types = (events: AgentEvent[]) => events.map((e) => e.type);

describe("agent loop", () => {
  test("one question, one streamed answer", async () => {
    const provider = scripted([[{ type: "text", text: "Hel" }, { type: "text", text: "lo" },
                                { type: "done", usage: { inputTokens: 3, outputTokens: 2 } }]]);
    const agent = createAgent({ provider, model: "m", instructions: "i" });
    const events: AgentEvent[] = [];
    await agent.run("Hi", (e) => events.push(e));

    assert.deepEqual(types(events), ["turn_start", "step_start", "text_delta", "text_delta", "assistant_message", "turn_end"]);
    assert.deepEqual(agent.history, [{ role: "user", text: "Hi" }, { role: "assistant", text: "Hello", toolCalls: [] }]);
    const end = events.at(-1) as Extract<AgentEvent, { type: "turn_end" }>;
    assert.equal(end.reason, "done");
    assert.deepEqual(end.usage, { inputTokens: 3, outputTokens: 2 });
    assert.equal(provider.requests[0]!.instructions, "i");
  });

  test("the second question carries the whole conversation", async () => {
    const provider = scripted([[{ type: "text", text: "A" }, { type: "done" }], [{ type: "text", text: "B" }, { type: "done" }]]);
    const agent = createAgent({ provider, model: "m", instructions: "i" });
    await agent.run("one", () => {});
    await agent.run("two", () => {});
    assert.equal(provider.requests[1]!.messages.length, 3);   // user, assistant, user
  });

  test("an unknown tool gets an error result, then the model answers", async () => {
    const provider = scripted([
      [{ type: "tool_call", call: { id: "c1", name: "nope", arguments: "{}" } }, { type: "done" }],
      [{ type: "text", text: "Sorry" }, { type: "done" }],
    ]);
    const agent = createAgent({ provider, model: "m", instructions: "i" });
    const events: AgentEvent[] = [];
    await agent.run("use a tool", (e) => events.push(e));
    const result = events.find((e) => e.type === "tool_result") as Extract<AgentEvent, { type: "tool_result" }>;
    assert.match(result.text, /no tool named "nope"/);
    assert.equal(provider.requests.length, 2);
    assert.equal((events.at(-1) as any).reason, "done");
  });

  test("the step limit ends a turn that never finishes", async () => {
    const call: StreamEvent = { type: "tool_call", call: { id: "c", name: "nope", arguments: "{}" } };
    const provider = scripted([[call], [call], [call]]);
    const agent = createAgent({ provider, model: "m", instructions: "i", stepLimit: 2 });
    const events: AgentEvent[] = [];
    await agent.run("loop", (e) => events.push(e));
    assert.equal((events.at(-1) as any).reason, "step_limit");
    assert.equal(provider.requests.length, 2);
  });

  test("a provider error becomes an error event with a hint", async () => {
    const provider = scripted([[new ProviderError("bad key", 401, "x", "Connect again: tygig login", false)]]);
    const agent = createAgent({ provider, model: "m", instructions: "i" });
    const events: AgentEvent[] = [];
    await agent.run("Hi", (e) => events.push(e));
    assert.deepEqual(events.find((e) => e.type === "error"),
      { type: "error", message: "bad key", hint: "Connect again: tygig login" });
    assert.equal((events.at(-1) as any).reason, "error");
  });

  test("an error mid-answer keeps the part already shown, then reports the error", async () => {
    const provider = scripted([[{ type: "text", text: "half an ans" },
                                new ProviderError("connection lost", undefined, undefined, "Try again.", false)]]);
    const agent = createAgent({ provider, model: "m", instructions: "i" });
    const events: AgentEvent[] = [];
    await agent.run("Hi", (e) => events.push(e));
    assert.deepEqual(agent.history.at(-1), { role: "assistant", text: "half an ans", toolCalls: [] });
    assert.deepEqual(types(events).slice(-3), ["assistant_message", "error", "turn_end"]);
  });

  test("Esc keeps the part of the answer already shown", async () => {
    const provider = scripted([[{ type: "text", text: "partial" }, "wait"]]);
    const agent = createAgent({ provider, model: "m", instructions: "i" });
    const abort = new AbortController();
    const events: AgentEvent[] = [];
    setTimeout(() => abort.abort(), 50);
    await agent.run("Hi", (e) => events.push(e), abort.signal);
    assert.equal((events.at(-1) as any).reason, "interrupted");
    assert.deepEqual(agent.history.at(-1), { role: "assistant", text: "partial", toolCalls: [] });
  });

  test("only recent messages are sent, starting with one of yours", async () => {
    const provider = scripted([[{ type: "text", text: "x" }, { type: "done" }]]);
    const history = Array.from({ length: 10 }, (_, i) =>
      i % 2 === 0 ? { role: "user" as const, text: `q${i}` } : { role: "assistant" as const, text: `a${i}`, toolCalls: [] });
    const agent = createAgent({ provider, model: "m", instructions: "i", history, maxHistory: 4 });
    await agent.run("new", () => {});
    const sent = provider.requests[0]!.messages;
    assert.equal(sent[0]!.role, "user");
    assert.ok(sent.length <= 4);
  });

  test("in a long tool loop, the task is kept and no tool result loses its request", async () => {
    const call = (n: number): StreamEvent[] => [{ type: "tool_call", call: { id: `c${n}`, name: "echo", arguments: "{}" } }, { type: "done" }];
    const provider = scripted([call(1), call(2), call(3), call(4), [{ type: "text", text: "done" }, { type: "done" }]]);
    const echo = { definition: { name: "echo", description: "", inputSchema: { type: "object" } }, run: async () => "ok" };
    const agent = createAgent({ provider, model: "m", instructions: "i", tools: [echo], maxHistory: 3 });
    await agent.run("review the paper", () => {});
    for (const request of provider.requests) {
      assert.deepEqual(request.messages[0], { role: "user", text: "review the paper" });   // the task is always sent
      assert.notEqual(request.messages[1]?.role, "tool");                                  // never a result without its request
    }
  });
});

describe("session log", () => {
  test("records events, hides secrets, and resumes the conversation", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "tygig-"));
    const dir = projectSessionsDir(home, "C:\\Arnab Work Files\\my-project");
    // On Windows the folder name is lower-cased (C:\Work and c:\work are the same folder there).
    assert.ok(dir.toLowerCase().endsWith("c--arnab-work-files-my-project"), dir);

    const session = Session.create(dir, { provider: "openai", model: "m1", cwd: "x" }, ["sk-secret-123456"]);
    session.record({ type: "turn_start", text: "my key is sk-secret-123456" });
    session.record({ type: "text_delta", text: "ignored" });
    session.record({ type: "assistant_message", message: { role: "assistant", text: "noted", toolCalls: [] } });
    session.note({ type: "model_change", model: "m2" });
    session.record({ type: "turn_end", reason: "done", seconds: 1, usage: { inputTokens: 1, outputTokens: 1 } });
    await session.flush();

    const raw = await readFile(session.file, "utf8");
    assert.ok(!raw.includes("sk-secret-123456"));
    assert.ok(raw.includes("[redacted]"));
    assert.equal(raw.split("\n").filter(Boolean).length, 5);   // start, user, assistant, model_change, turn_end

    const { history, model } = await Session.open(session.file, []);
    assert.equal(model, "m2");
    assert.deepEqual(history.map((m) => m.role), ["user", "assistant"]);

    const list = await listSessions(dir);
    assert.equal(list.length, 1);
    assert.equal(list[0]!.turns, 1);
  });

  test("a conversation where nothing was said leaves no file", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "tygig-"));
    const dir = projectSessionsDir(home, "/tmp/p");
    const session = Session.create(dir, { provider: "x", model: "y", cwd: "z" }, []);
    await session.flush();
    assert.deepEqual(await listSessions(dir), []);
  });
});
