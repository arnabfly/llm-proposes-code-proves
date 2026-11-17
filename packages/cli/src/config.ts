// config.ts - your settings: which provider, which model.
// Stored in ~/.tygig/config.json. Contains no secrets: keys live in credentials.json.

import { readFile } from "node:fs/promises";
import { writeFileAtomic } from "@tygig/auth";

export interface Config {
  provider: string;      // a preset id, e.g. "openai", "chatgpt", "ollama"
  model: string;         // e.g. "gpt-6.1-sol"
  baseUrl?: string;      // only for "custom" and "local-custom" providers
  maxTokens?: number;    // longest reply allowed; Anthropic only (it needs a limit); default 8192
  stepLimit?: number;    // safety limit of model calls per message; default 20
}

/** Read the settings; undefined if you have never logged in. */
export async function readConfig(file: string): Promise<Config | undefined> {
  try {
    const json = JSON.parse(await readFile(file, "utf8"));
    if (typeof json.provider !== "string" || typeof json.model !== "string") return undefined;
    return json as Config;
  } catch {
    return undefined;
  }
}

/** Save the settings (written to a temporary file first, then renamed: never half-written). */
export async function writeConfig(file: string, config: Config): Promise<void> {
  await writeFileAtomic(file, JSON.stringify(config, null, 2));
}
