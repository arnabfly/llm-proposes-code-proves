// anthropic.ts - translator for Anthropic's Messages format (all Claude models).

import { ProviderError } from "@tygig/core";
import type { Message, ModelProvider, ModelRequest, StreamEvent, Usage } from "@tygig/core";
import type { Connection } from "./connection.js";
import { describeError, getJson, postJson } from "./http.js";
import { parseJson, readSse } from "./sse.js";

const API_VERSION = "2023-06-01";   // required on every request

export function createAnthropic(conn: Connection): ModelProvider {
  const version = { "anthropic-version": API_VERSION };

  return {
    label: conn.label,

    async *stream(request: ModelRequest): AsyncGenerator<StreamEvent> {
      // 1. Build the request. Anthropic needs an upper limit on the reply length.
      const body: Record<string, unknown> = {
        model: request.model,
        max_tokens: conn.maxTokens,
        system: request.instructions,
        messages: toAnthropicMessages(request.messages),
        stream: true,
      };
      if (request.tools.length > 0) {
        body.tools = request.tools.map((t) => ({
          name: t.name, description: t.description, input_schema: t.inputSchema,
        }));
      }

      // 2. Send it.
      const response = await postJson(conn, `${conn.baseUrl}/messages`, body, request.signal, version);

      // 3. Read the events. The reply is made of numbered "content blocks":
      //    text blocks stream their words; tool blocks stream their input as JSON pieces.
      const toolBlocks = new Map<number, { id: string; name: string; json: string }>();
      const usage: Usage = { inputTokens: 0, outputTokens: 0 };
      let stopped = false;
      let stopReason: string | undefined;

      for await (const message of readSse(response.body!)) {
        const event = parseJson(message.data);
        if (!event) continue;

        switch (event.type) {
          case "message_start":
            usage.inputTokens = event.message?.usage?.input_tokens ?? 0;
            break;

          case "content_block_start":
            if (event.content_block?.type === "tool_use") {
              toolBlocks.set(event.index,
                { id: event.content_block.id, name: event.content_block.name, json: "" });
            }
            break;

          case "content_block_delta":
            if (event.delta?.type === "text_delta" && event.delta.text) {
              yield { type: "text", text: event.delta.text };          // straight to the screen
            } else if (event.delta?.type === "input_json_delta") {
              const block = toolBlocks.get(event.index);
              if (block) block.json += event.delta.partial_json ?? "";
            }
            break;                                                    // thinking deltas are ignored

          case "content_block_stop": {
            const block = toolBlocks.get(event.index);
            if (block) {
              yield { type: "tool_call", call: { id: block.id, name: block.name, arguments: block.json || "{}" } };
              toolBlocks.delete(event.index);
            }
            break;
          }

          case "message_delta":                                       // running total, stop reason
            usage.outputTokens = event.usage?.output_tokens ?? usage.outputTokens;
            stopReason = event.delta?.stop_reason ?? stopReason;
            break;

          case "message_stop":
            stopped = true;
            break;

          case "error":                                               // e.g. overloaded_error
            throw describeError(undefined, event.error?.type, event.error?.message ?? "stream error", conn.label);
        }
      }

      if (!stopped) {
        throw new ProviderError(`${conn.label}: the connection ended before the reply was complete.`,
          undefined, undefined, "Try again.", false);
      }
      if (stopReason === "max_tokens") {
        throw new ProviderError(`${conn.label}: the reply was cut short (max_tokens).`, undefined, "max_tokens",
          "Ask for a shorter answer, or raise \"maxTokens\" in ~/.tygig/config.json.", false);
      }
      yield { type: "done", usage };
    },

    async listModels(): Promise<string[]> {
      const json = await getJson(conn, `${conn.baseUrl}/models?limit=100`, version);
      return (json.data ?? []).map((m: any) => String(m.id));
    },
  };
}

/**
 * Tygig's messages -> Anthropic's messages. Two rules to respect:
 *  - tool results are sent inside a "user" message;
 *  - two messages in a row from the same side must be merged into one.
 */
function toAnthropicMessages(messages: Message[]): { role: string; content: object[] }[] {
  const out: { role: string; content: object[] }[] = [];

  const add = (role: string, block: object) => {
    const last = out[out.length - 1];
    if (last && last.role === role) last.content.push(block);   // same side: merge
    else out.push({ role, content: [block] });
  };

  for (const m of messages) {
    if (m.role === "user") {
      add("user", { type: "text", text: m.text });
    } else if (m.role === "assistant") {
      if (m.text !== "") add("assistant", { type: "text", text: m.text });
      for (const c of m.toolCalls) {
        add("assistant", { type: "tool_use", id: c.id, name: c.name, input: parseJson(c.arguments) ?? {} });
      }
    } else {
      add("user", { type: "tool_result", tool_use_id: m.toolCallId, content: m.text });
    }
  }
  return out;
}
