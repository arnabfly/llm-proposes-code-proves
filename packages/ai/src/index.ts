// index.ts - the public face of @tygig/ai.

import type { ModelProvider } from "@tygig/core";
import type { Connection } from "./connection.js";
import { createOpenAIChat } from "./openai-chat.js";
import { createOpenAIResponses } from "./openai-responses.js";
import { createAnthropic } from "./anthropic.js";

export type { Connection } from "./connection.js";
export { apiKeyHeaders } from "./connection.js";
export type { ConnectionKind, ProviderPreset } from "./presets.js";
export { PRESETS, getPreset } from "./presets.js";

/** Pick the translator that speaks this connection's format. */
export function createProvider(conn: Connection): ModelProvider {
  switch (conn.format) {
    case "openai-chat":      return createOpenAIChat(conn);
    case "openai-responses": return createOpenAIResponses(conn);
    case "anthropic":        return createAnthropic(conn);
  }
}
