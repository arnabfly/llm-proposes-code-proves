// prompts.ts - the benchmark's task prompt and its modes.
//
//   on      checks on (labels from code)
//   off     checks off; the model's own label is recorded
//   strict  checks off, and the task prompt adds evals/prompts/strict.md: the model is told to apply
//           the same rule the code applies (every number in a cited table cell, for this result).
//           Compares code checks with an LLM following the same rule. The file is fixed before any
//           run; its SHA-256 hash is saved with every strict run, so a change would show.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type Mode = "on" | "off" | "strict";
export const MODES: Mode[] = ["on", "off", "strict"];

export const STRICT_PROMPT_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "prompts", "strict.md");

export function parseMode(s: string | undefined): Mode | undefined {
  return MODES.includes(s as Mode) ? (s as Mode) : undefined;
}

/** TYGIG_REVIEW_CHECKS for a mode: the review tools only know on and off; strict runs with checks off. */
export function checksSetting(mode: Mode): "on" | "off" {
  return mode === "on" ? "on" : "off";
}

/** The text of strict.md and its SHA-256 hash (of the file's bytes). */
export function strictPrompt(file = STRICT_PROMPT_FILE): { text: string; sha256: string } {
  const bytes = readFileSync(file);
  return { text: bytes.toString("utf8").replace(/\r\n/g, "\n").trim(), sha256: createHash("sha256").update(bytes).digest("hex") };
}

/** The task prompt of one benchmark run. Strict adds strict.md after the normal prompt. */
export function taskPrompt(paperPath: string, claimText: string, mode: Mode, strictText?: string): string {
  const normal =
    `Load the paper at ${paperPath}. Verify only this claim: "${claimText}". ` +
    "Find its sentence ID with review__find_text, find its evidence, call review__submit_link " +
    "(you may resubmit after a failed check), then call review__finish. Do not review other claims. Do not ask questions.";
  if (mode !== "strict") return normal;
  return `${normal}\n\n${strictText ?? strictPrompt().text}`;
}
