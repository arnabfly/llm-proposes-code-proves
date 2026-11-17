// openai-chat.ts - translator for the OpenAI chat format ("chat completions").
// Spoken by OpenRouter, Gemini, DeepSeek, Mistral, Groq, xAI, Together,
// Ollama, LM Studio and most other providers.

import { ProviderError } from "@tygig/core";
import type { Message, ModelProvider, ModelRequest, StreamEvent, ToolCall, Usage } from "@tygig/core";
import type { Connection } from "./connection.js";
import { describeError, getJson, postJson } from "./http.js";
import { parseJson, readSse } from "./sse.js";

export function createOpenAIChat(conn: Connection): ModelProvider {
  return {
    label: conn.label,

    async *stream(request: ModelRequest): AsyncGenerator<StreamEvent> {
      // 1. Build the request in this provider's format.
      const body: Record<string, unknown> = {
        model: request.model,
        messages: toChatMessages(request.instructions, request.messages),
        stream: true,
      };
      if (request.tools.length > 0) {
        body.tools = request.tools.map((t) => ({
          type: "function",
          function: { name: t.name, description: t.description, parameters: t.inputSchema },
        }));
      }

      // 2. Send it. postJson retries rate limits and server errors.
      const response = await postJson(conn, `${conn.baseUrl}/chat/completions`, body, request.signal);

      // 3. Read the stream. Text is passed on at once; tool calls arrive in pieces
      //    and are assembled here, then passed on complete at the end.
      const calls = new Map<number, ToolCall>();
      let usage: Usage | undefined;
      let finish: string | undefined;                      // why the model stopped
      let done = false;                                    // did the server say [DONE]?

      for await (const message of readSse(response.body!)) {
        if (message.data === "[DONE]") { done = true; break; }   // the server says: finished
        const chunk = parseJson(message.data);
        if (!chunk) continue;                              // ignore anything unreadable
        if (chunk.error) {
          throw describeError(undefined, chunk.error.code, chunk.error.message ?? "error", conn.label);
        }
        if (chunk.usage) {
          usage = { inputTokens: chunk.usage.prompt_tokens ?? 0,
                    outputTokens: chunk.usage.completion_tokens ?? 0 };
        }
        finish = chunk.choices?.[0]?.finish_reason ?? finish;
        const delta = chunk.choices?.[0]?.delta;
        if (!delta) continue;

        if (typeof delta.content === "string" && delta.content.length > 0) {
          yield { type: "text", text: delta.content };     // straight to the screen
        }
        for (const piece of delta.tool_calls ?? []) {      // one piece of a tool call
          const call = calls.get(piece.index) ?? { id: "", name: "", arguments: "" };
          if (piece.id) call.id = piece.id;
          if (piece.function?.name) call.name += piece.function.name;
          if (piece.function?.arguments) call.arguments += piece.function.arguments;
          calls.set(piece.index, call);
        }
      }

      // A complete answer ends with [DONE] or a stop reason. Without either, the
      // connection broke; "length" and "content_filter" mean the answer is unfinished.
      if (!done && !finish) {
        throw new ProviderError(`${conn.label}: the connection ended before the reply was complete.`,
          undefined, undefined, "Try again.", false);
      }
      if (finish === "length" || finish === "content_filter") {
        throw new ProviderError(`${conn.label}: the reply was cut short (${finish}).`, undefined, finish,
          finish === "length" ? "Ask for a shorter answer." : "The provider's content filter stopped the answer.", false);
      }
      for (const call of calls.values()) yield { type: "tool_call", call };
      yield { type: "done", usage };
    },

    async listModels(): Promise<string[]> {
      const json = await getJson(conn, `${conn.baseUrl}/models`);
      const list: any[] = Array.isArray(json) ? json : (json.data ?? []);   // Together AI sends a bare list
      return list.map((m) => String(m.id)).sort();
    },
  };
}

/** Tygig's messages -> the chat format's messages. */
function toChatMessages(instructions: string, messages: Message[]): object[] {
  const out: object[] = [{ role: "system", content: instructions }];
  for (const m of messages) {
    if (m.role === "user") {
      out.push({ role: "user", content: m.text });
    } else if (m.role === "assistant") {
      if (m.text === "" && m.toolCalls.length === 0) continue;   // nothing was said (interrupted)
      out.push({
        role: "assistant",
        content: m.text === "" ? null : m.text,
        ...(m.toolCalls.length > 0 && {
          tool_calls: m.toolCalls.map((c) => ({
            id: c.id, type: "function", function: { name: c.name, arguments: c.arguments },
          })),
        }),
      });
    } else {
      out.push({ role: "tool", tool_call_id: m.toolCallId, content: m.text });
    }
  }
  return out;
}
