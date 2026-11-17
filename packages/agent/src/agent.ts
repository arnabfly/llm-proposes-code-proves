// agent.ts - the agent loop (design document §8).
//
// One "turn" = you send a message, the agent works until it has an answer.
// Inside a turn, each "step" is one call to the model. Without tools, a turn is
// always one step: ask, stream the answer, done. With tools (later), the model
// may ask for a tool, get the result, and take another step.

import { ProviderError } from "@tygig/core";
import type { AgentEvent, AssistantMessage, Message, ModelProvider, ToolDefinition,
              TurnEndReason, Usage } from "@tygig/core";

/** A tool the agent can run. The base harness has none; plugins will add them. */
export interface Tool {
  definition: ToolDefinition;
  run(input: unknown): Promise<string>;
}

export interface AgentOptions {
  provider: ModelProvider;
  model: string;
  instructions: string;
  history?: Message[];     // an earlier conversation, when resuming
  tools?: Tool[];          // none in the base harness
  stepLimit?: number;      // safety limit per turn (design document D4)
  maxHistory?: number;     // how many recent messages to send to the model
}

export interface Agent {
  readonly history: Message[];
  model: string;
  run(text: string, onEvent: (event: AgentEvent) => void, signal?: AbortSignal): Promise<void>;
}

export function createAgent(options: AgentOptions): Agent {
  const history: Message[] = options.history ? [...options.history] : [];
  const tools = options.tools ?? [];
  const stepLimit = options.stepLimit ?? 20;
  const maxHistory = options.maxHistory ?? 60;

  const agent: Agent = {
    history,
    model: options.model,

    async run(text, onEvent, signal) {
      const started = Date.now();
      const total: Usage = { inputTokens: 0, outputTokens: 0 };
      const end = (reason: TurnEndReason) =>
        onEvent({ type: "turn_end", reason, seconds: (Date.now() - started) / 1000, usage: total });

      history.push({ role: "user", text });
      onEvent({ type: "turn_start", text });

      for (let step = 1; step <= stepLimit; step++) {
        onEvent({ type: "step_start", step });
        const reply: AssistantMessage = { role: "assistant", text: "", toolCalls: [] };
        let usage: Usage | undefined;

        try {
          // Ask the model and pass each piece on as it arrives.
          const stream = options.provider.stream({
            model: agent.model,
            instructions: options.instructions,
            messages: recent(history, maxHistory),
            tools: tools.map((t) => t.definition),
            signal,
          });
          for await (const piece of stream) {
            if (piece.type === "text") {
              reply.text += piece.text;
              onEvent({ type: "text_delta", text: piece.text });
            } else if (piece.type === "tool_call") {
              reply.toolCalls.push(piece.call);
            } else {
              usage = piece.usage;
            }
          }
        } catch (err) {
          // Interrupted (Esc) or failed: either way, keep the part of the answer you already saw.
          if (reply.text !== "") {
            const partial: AssistantMessage = { role: "assistant", text: reply.text, toolCalls: [] };
            history.push(partial);
            onEvent({ type: "assistant_message", message: partial });
          }
          if (signal?.aborted) {                     // you pressed Esc
            end("interrupted");
            return;
          }
          const { message, hint } = explain(err);
          onEvent({ type: "error", message, hint });
          end("error");
          return;
        }

        history.push(reply);
        onEvent({ type: "assistant_message", message: reply, usage });
        if (usage) {
          total.inputTokens += usage.inputTokens;
          total.outputTokens += usage.outputTokens;
        }

        if (reply.toolCalls.length === 0) {          // only text: the turn is complete
          end("done");
          return;
        }

        // The model asked for tools: run each, give it the results, take another step.
        for (const call of reply.toolCalls) {
          const tool = tools.find((t) => t.definition.name === call.name);
          const result = tool ? await runTool(tool, call.arguments)
                              : `Error: there is no tool named "${call.name}".`;
          history.push({ role: "tool", toolCallId: call.id, text: result });
          onEvent({ type: "tool_result", toolCallId: call.id, name: call.name, text: result });
        }
      }
      end("step_limit");
    },
  };
  return agent;
}

/** The most recent messages, starting with one of yours (some providers require that). */
function recent(history: Message[], max: number): Message[] {
  const slice = history.slice(-max);
  const firstUser = slice.findIndex((m) => m.role === "user");
  if (firstUser >= 0) return slice.slice(firstUser);
  // A long tool loop: none of your messages is in the window. Keep your last message (the task),
  // then the window, never starting with a tool result whose request was cut off (providers reject that).
  let start = 0;
  while (start < slice.length && slice[start]!.role === "tool") start++;
  const task = [...history].reverse().find((m) => m.role === "user");
  return task ? [task, ...slice.slice(start)] : slice.slice(start);
}

/** Run one tool safely: bad input or a crash becomes an error message for the model. */
async function runTool(tool: Tool, args: string): Promise<string> {
  try {
    return await tool.run(JSON.parse(args || "{}"));
  } catch (err) {
    return `Error: ${(err as Error).message}`;
  }
}

/** Any error -> a message and a hint for the screen. */
function explain(err: unknown): { message: string; hint: string } {
  if (err instanceof ProviderError) return { message: err.message, hint: err.hint };
  const message = err instanceof Error ? err.message : String(err);
  return { message, hint: "Unexpected problem. If it happens again, please report it." };
}
