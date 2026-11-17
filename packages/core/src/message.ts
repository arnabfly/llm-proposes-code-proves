// message.ts - the conversation format used everywhere inside Tygig.
//
// Every provider (OpenAI, Anthropic, ...) has its own format. Tygig keeps ONE
// format internally; the translators in the `ai` package convert it on the way
// out and back. The loop, the session log and the screen only ever see this one.

/** One request from the model to use a tool. (The base harness has no tools yet.) */
export interface ToolCall {
  id: string;        // the provider's id for this call; echoed back with the result
  name: string;      // which tool, e.g. "files__read_file"
  arguments: string; // the inputs as JSON text, exactly as the model wrote them
}

/** Something you typed. */
export interface UserMessage {
  role: "user";
  text: string;
}

/** Something the model said: text, tool requests, or both. */
export interface AssistantMessage {
  role: "assistant";
  text: string;            // may be "" when the model only requests tools
  toolCalls: ToolCall[];   // empty when the model only talks
}

/** The result of running one tool, sent back to the model. */
export interface ToolResultMessage {
  role: "tool";
  toolCallId: string;      // matches ToolCall.id
  text: string;            // the result, as text
}

/** One entry in the conversation. */
export type Message = UserMessage | AssistantMessage | ToolResultMessage;

/** Token counts reported by the provider for one model call. */
export interface Usage {
  inputTokens: number;
  outputTokens: number;
}
