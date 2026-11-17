// provider.ts - the shape of a model provider (design document §9, D6).
//
// A provider is anything that can take a conversation and stream back a reply.
// The loop only knows this shape. Which company is behind it does not matter.

import type { Message, ToolCall, Usage } from "./message.js";

/** The three request formats Tygig can speak (design document D7). */
export type ApiFormat = "openai-chat" | "openai-responses" | "anthropic";

/** A tool description sent to the model. Unused in the base harness. */
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: object;   // JSON Schema of the tool's inputs
}

/** Everything needed for one call to the model. */
export interface ModelRequest {
  model: string;               // e.g. "gpt-6.1-sol", "claude-sonnet-5"
  instructions: string;        // the system instructions
  messages: Message[];         // the conversation so far
  tools: ToolDefinition[];     // empty in the base harness
  signal?: AbortSignal;        // lets the user interrupt (Esc)
}

/** One piece of a streamed reply. */
export type StreamEvent =
  | { type: "text"; text: string }              // a few more words of the answer
  | { type: "tool_call"; call: ToolCall }       // a complete tool request
  | { type: "done"; usage?: Usage };            // the reply is complete

/** A model provider: OpenAI, Anthropic, OpenRouter, a local server... */
export interface ModelProvider {
  /** Short label for the screen, e.g. "OpenAI" or "ChatGPT plan". */
  label: string;
  /** Send a request; receive the reply piece by piece. */
  stream(request: ModelRequest): AsyncIterable<StreamEvent>;
  /** List the models this connection may use. */
  listModels(): Promise<string[]>;
}

/**
 * An error from a provider, already translated into plain words.
 * `hint` tells the user what to do about it.
 */
export class ProviderError extends Error {
  readonly status: number | undefined;   // HTTP status, if there was one
  readonly code: string | undefined;     // the provider's error code, if any
  readonly hint: string;                 // what the user can do about it
  readonly retryable: boolean;           // worth trying again automatically?

  constructor(message: string, status: number | undefined, code: string | undefined,
              hint: string, retryable: boolean) {
    super(message);
    this.name = "ProviderError";
    this.status = status;
    this.code = code;
    this.hint = hint;
    this.retryable = retryable;
  }
}
