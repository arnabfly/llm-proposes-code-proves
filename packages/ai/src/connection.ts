// connection.ts - what a translator needs to know to reach one provider.

import type { ApiFormat } from "@tygig/core";

export interface Connection {
  label: string;          // shown on screen, e.g. "OpenAI" or "ChatGPT plan"
  format: ApiFormat;      // which translator
  baseUrl: string;        // e.g. "https://api.openai.com/v1" (no trailing slash)
  /** Headers that prove who we are. Called before every request, so a sign-in
   *  token can be refreshed in time; for API keys it returns the same headers. */
  authHeaders: () => Promise<Record<string, string>>;
  maxTokens: number;      // upper limit on reply length (sent only to Anthropic, which requires it)
  /** Called once when the provider answers 401 (rejected). A sign-in can renew its
   *  token here and return true, and the request is tried again. */
  onUnauthorized?: () => Promise<boolean>;
}

/** The headers for an API key: each format expects the key in a different place. */
export function apiKeyHeaders(format: ApiFormat, key: string | undefined,
                              presetId: string): Record<string, string> {
  const headers: Record<string, string> = {};
  if (key) {
    if (format === "anthropic") headers["x-api-key"] = key;
    else headers["authorization"] = `Bearer ${key}`;
  }
  if (presetId === "openrouter") {
    // Optional: lets OpenRouter show which app made the request.
    headers["http-referer"] = "https://tygig.dev";
    headers["x-title"] = "Tygig";
  }
  return headers;
}
