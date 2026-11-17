// connect.ts - turns your settings into a working model provider.
// This is where the blocks are joined: settings + credentials + translator.

import type { ModelProvider } from "@tygig/core";
import { apiKeyHeaders, createProvider, getPreset } from "@tygig/ai";
import type { ProviderPreset } from "@tygig/ai";
import { getChatGPTAccessToken, readCredentials, refreshChatGPTToken } from "@tygig/auth";
import type { Config } from "./config.js";
import type { Paths } from "./paths.js";

export interface Connected {
  provider: ModelProvider;
  preset: ProviderPreset;
  label: string;          // for the header, e.g. "ChatGPT plan (you@example.com)"
  secrets: string[];      // values that must never be written to the session log
}

/** Settings for a connection that is not saved yet (used while logging in). */
export interface Draft {
  provider: string;
  baseUrl?: string;
  apiKey?: string;            // a key just typed in
  keySource?: "env";          // "use the key from the environment variable"
  maxTokens?: number;
}

/**
 * Where a key is stored in credentials.json. Each of your own servers gets its own
 * slot, so a key meant for one server is never sent to another.
 */
export function keySlot(presetId: string, baseUrl: string | undefined): string {
  return presetId === "custom" || presetId === "local-custom" ? `custom:${baseUrl ?? ""}` : presetId;
}

export async function connect(settings: Config | Draft, paths: Paths): Promise<Connected> {
  const preset = getPreset(settings.provider);

  // 1. The address. TYGIG_BASE_URL replaces it, but only together with TYGIG_HOME
  //    (a separate test folder), so a forgotten test variable can never send your
  //    real keys somewhere else.
  const override = process.env.TYGIG_HOME ? process.env.TYGIG_BASE_URL : undefined;
  const baseUrl = (override ?? settings.baseUrl ?? preset.baseUrl).replace(/\/+$/, "");
  if (!baseUrl) throw new Error(`No address set for ${preset.label}. Run: tygig login`);

  // 2. Who we are: a ChatGPT sign-in, or an API key.
  const creds = await readCredentials(paths.credentials);
  let authHeaders: () => Promise<Record<string, string>>;
  let onUnauthorized: (() => Promise<boolean>) | undefined;
  let secrets: string[];
  let label = preset.label;

  if (preset.kind === "chatgpt") {
    const account = creds.chatgpt.account;
    // Asked before every request, so an expiring token is renewed in time.
    authHeaders = async () => ({ authorization: `Bearer ${await getChatGPTAccessToken(paths.credentials)}` });
    // If OpenAI rejects a token that looked valid, renew it once and try again.
    onUnauthorized = async () => {
      try { await refreshChatGPTToken(paths.credentials, true); return true; } catch { return false; }
    };
    secrets = account ? [account.accessToken, account.refreshToken, account.idToken] : [];
    if (account?.email) label = `ChatGPT plan (${account.email})`;
  } else {
    const fromEnv = preset.keyEnv ? process.env[preset.keyEnv] : undefined;
    const typed = "apiKey" in settings ? settings.apiKey : undefined;
    const wantsEnv = "keySource" in settings && settings.keySource === "env";
    const stored = creds.apiKeys[keySlot(preset.id, baseUrl)];
    // A key just typed wins; then "use the environment" if chosen; then the stored key; then the environment.
    const key = typed || (wantsEnv ? fromEnv : undefined) || stored || fromEnv;
    if (preset.needsKey && !key && preset.id !== "custom") {
      throw new Error(`No API key for ${preset.label}. Run: tygig login`);
    }
    const headers = apiKeyHeaders(preset.format, key, preset.id);
    authHeaders = async () => headers;
    secrets = key ? [key] : [];
    if (preset.id === "custom" || preset.id === "local-custom") label = new URL(baseUrl).host;
  }

  // 3. The translator for this provider's format.
  const provider = createProvider({
    label, format: preset.format, baseUrl, authHeaders, onUnauthorized, maxTokens: settings.maxTokens ?? 8192,
  });
  return { provider, preset, label, secrets };
}
