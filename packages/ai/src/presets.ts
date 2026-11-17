// presets.ts - every provider Tygig knows how to reach, and how.
//
// A preset is just facts: which format the provider speaks, its address,
// and where its key comes from. Adding a provider usually means adding one entry.

import type { ApiFormat } from "@tygig/core";

/** How the user connects: a ChatGPT account, an API key, or a model on this computer. */
export type ConnectionKind = "chatgpt" | "api" | "local";

export interface ProviderPreset {
  id: string;           // stored in config.json, e.g. "openai"
  label: string;        // shown on screen
  kind: ConnectionKind;
  format: ApiFormat;    // which translator to use
  baseUrl: string;      // "" means: ask the user (custom providers)
  keyEnv?: string;      // environment variable that may already hold the key
  keyUrl?: string;      // where the user gets a key
  needsKey: boolean;    // local servers usually need none
}

export const PRESETS: ProviderPreset[] = [
  // ChatGPT account: browser sign-in, uses the ChatGPT plan. Only the Responses format works.
  { id: "chatgpt", label: "ChatGPT plan", kind: "chatgpt", format: "openai-responses",
    baseUrl: "https://api.openai.com/v1", needsKey: false },

  // API keys
  { id: "openai", label: "OpenAI", kind: "api", format: "openai-responses",
    baseUrl: "https://api.openai.com/v1", keyEnv: "OPENAI_API_KEY",
    keyUrl: "https://platform.openai.com/api-keys", needsKey: true },
  { id: "anthropic", label: "Anthropic", kind: "api", format: "anthropic",
    baseUrl: "https://api.anthropic.com/v1", keyEnv: "ANTHROPIC_API_KEY",
    keyUrl: "https://console.anthropic.com/settings/keys", needsKey: true },
  { id: "openrouter", label: "OpenRouter", kind: "api", format: "openai-chat",
    baseUrl: "https://openrouter.ai/api/v1", keyEnv: "OPENROUTER_API_KEY",
    keyUrl: "https://openrouter.ai/keys", needsKey: true },
  { id: "gemini", label: "Google Gemini", kind: "api", format: "openai-chat",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", keyEnv: "GEMINI_API_KEY",
    keyUrl: "https://aistudio.google.com/apikey", needsKey: true },
  { id: "deepseek", label: "DeepSeek", kind: "api", format: "openai-chat",
    baseUrl: "https://api.deepseek.com", keyEnv: "DEEPSEEK_API_KEY",
    keyUrl: "https://platform.deepseek.com/api_keys", needsKey: true },
  { id: "mistral", label: "Mistral", kind: "api", format: "openai-chat",
    baseUrl: "https://api.mistral.ai/v1", keyEnv: "MISTRAL_API_KEY",
    keyUrl: "https://console.mistral.ai/api-keys", needsKey: true },
  { id: "groq", label: "Groq", kind: "api", format: "openai-chat",
    baseUrl: "https://api.groq.com/openai/v1", keyEnv: "GROQ_API_KEY",
    keyUrl: "https://console.groq.com/keys", needsKey: true },
  { id: "xai", label: "xAI", kind: "api", format: "openai-chat",
    baseUrl: "https://api.x.ai/v1", keyEnv: "XAI_API_KEY",
    keyUrl: "https://console.x.ai", needsKey: true },
  { id: "together", label: "Together AI", kind: "api", format: "openai-chat",
    baseUrl: "https://api.together.xyz/v1", keyEnv: "TOGETHER_API_KEY",
    keyUrl: "https://api.together.xyz/settings/api-keys", needsKey: true },
  { id: "custom", label: "Other (OpenAI-compatible)", kind: "api", format: "openai-chat",
    baseUrl: "", needsKey: true },

  // Models on this computer. 127.0.0.1, not "localhost": on some systems "localhost"
  // means the IPv6 address ::1, where these servers are not listening.
  { id: "ollama", label: "Ollama", kind: "local", format: "openai-chat",
    baseUrl: "http://127.0.0.1:11434/v1", needsKey: false },
  { id: "lmstudio", label: "LM Studio", kind: "local", format: "openai-chat",
    baseUrl: "http://127.0.0.1:1234/v1", needsKey: false },
  { id: "local-custom", label: "Other local server", kind: "local", format: "openai-chat",
    baseUrl: "", needsKey: false },
];

/** Find a preset by id. Throws if the id is unknown (a damaged config file). */
export function getPreset(id: string): ProviderPreset {
  const preset = PRESETS.find((p) => p.id === id);
  if (!preset) throw new Error(`Unknown provider "${id}" in your settings. Run: tygig login`);
  return preset;
}
