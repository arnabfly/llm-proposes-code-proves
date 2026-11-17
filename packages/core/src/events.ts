// events.ts - what the agent announces while it works (design document D32).
//
// The agent never prints anything. It emits these events. The screen draws them,
// and the session log stores them. One stream, several readers.

import type { AssistantMessage, Usage } from "./message.js";

export type AgentEvent =
  | { type: "turn_start"; text: string }                 // you sent a message
  | { type: "step_start"; step: number }                 // a model call begins
  | { type: "text_delta"; text: string }                 // more words arrived
  | { type: "assistant_message"; message: AssistantMessage; usage?: Usage }  // one reply complete
  | { type: "tool_result"; toolCallId: string; name: string; text: string }  // a tool finished
  | { type: "error"; message: string; hint: string }     // something went wrong
  | { type: "turn_end"; reason: TurnEndReason; seconds: number; usage: Usage };

/** Why a turn ended. */
export type TurnEndReason = "done" | "interrupted" | "step_limit" | "error";
