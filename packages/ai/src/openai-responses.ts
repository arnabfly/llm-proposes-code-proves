// openai-responses.ts - translator for OpenAI's Responses format.
// Used for OpenAI with an API key, and for "Sign in with ChatGPT", which only
// accepts this format (with store: false and stream: true on every request).

import { ProviderError } from "@tygig/core";
import type { Message, ModelProvider, ModelRequest, StreamEvent, Usage } from "@tygig/core";
import type { Connection } from "./connection.js";
import { describeError, getJson, postJson } from "./http.js";
import { parseJson, readSse } from "./sse.js";

export function createOpenAIResponses(conn: Connection): ModelProvider {
  return {
    label: conn.label,

    async *stream(request: ModelRequest): AsyncGenerator<StreamEvent> {
      // 1. Build the request. The whole conversation is sent every time ("input"),
      //    and nothing is stored on OpenAI's side ("store: false").
      const body: Record<string, unknown> = {
        model: request.model,
        instructions: request.instructions,
        input: toResponsesInput(request.messages),
        stream: true,
        store: false,
      };
      if (request.tools.length > 0) {
        body.tools = request.tools.map((t) => ({
          type: "function", name: t.name, description: t.description, parameters: t.inputSchema,
        }));
      }

      // 2. Send it.
      const response = await postJson(conn, `${conn.baseUrl}/responses`, body, request.signal);

      // 3. Read the events. Only "response.completed" means success.
      let usage: Usage | undefined;
      let completed = false;

      for await (const message of readSse(response.body!)) {
        const event = parseJson(message.data);
        if (!event) continue;

        switch (event.type) {
          case "response.output_text.delta":               // a few more words
            if (event.delta) yield { type: "text", text: event.delta };
            break;

          case "response.output_item.done":                // a finished item; we want tool calls
            if (event.item?.type === "function_call") {
              yield { type: "tool_call",
                      call: { id: event.item.call_id, name: event.item.name,
                              arguments: event.item.arguments ?? "" } };
            }
            break;

          case "response.completed":                        // success
            completed = true;
            usage = { inputTokens: event.response?.usage?.input_tokens ?? 0,
                      outputTokens: event.response?.usage?.output_tokens ?? 0 };
            break;

          case "response.failed": {                         // failure, even mid-stream
            const err = event.response?.error ?? {};
            throw describeError(undefined, err.code, err.message ?? "the response failed", conn.label);
          }

          case "response.incomplete": {                     // cut short (length or filter)
            const reason = event.response?.incomplete_details?.reason ?? "unknown reason";
            throw new ProviderError(`${conn.label}: the reply was cut short (${reason}).`,
              undefined, reason, "Try again, or ask for a shorter answer.", false);
          }

          case "error":                                     // an error event in the stream
            throw describeError(undefined, event.code ?? event.error?.code,
              event.message ?? event.error?.message ?? "stream error", conn.label);
        }
      }

      if (!completed) {
        throw new ProviderError(`${conn.label}: the connection ended before the reply was complete.`,
          undefined, undefined, "Try again.", false);
      }
      yield { type: "done", usage };
    },

    async listModels(): Promise<string[]> {
      const json = await getJson(conn, `${conn.baseUrl}/models`);
      if (Array.isArray(json.models)) {
        // Sign in with ChatGPT: { models: [{ slug, display_name, visibility }] }
        return json.models.filter((m: any) => m.visibility === "list").map((m: any) => String(m.slug));
      }
      // API key: { data: [{ id }] }, including many non-chat models; keep the chat ones.
      const ids: string[] = (json.data ?? []).map((m: any) => String(m.id));
      return ids.filter((id) => !NOT_CHAT.test(id)).sort();
    },
  };
}

/** Model ids that are not chat models (images, audio, embeddings...). */
const NOT_CHAT = /embedding|tts|whisper|dall-e|image|audio|realtime|transcribe|moderation|search|davinci|babbage/i;

/** Tygig's messages -> the Responses format's "input" items. */
function toResponsesInput(messages: Message[]): object[] {
  const out: object[] = [];
  for (const m of messages) {
    if (m.role === "user") {
      out.push({ role: "user", content: m.text });
    } else if (m.role === "assistant") {
      if (m.text !== "") out.push({ role: "assistant", content: m.text });
      for (const c of m.toolCalls) {
        out.push({ type: "function_call", call_id: c.id, name: c.name, arguments: c.arguments });
      }
    } else {
      out.push({ type: "function_call_output", call_id: m.toolCallId, output: m.text });
    }
  }
  return out;
}
