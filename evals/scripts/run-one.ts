// run-one.ts - one benchmark run: one version, one mode, one fresh agent. Started by run.ts as its
// own process (with TYGIG_REVIEW_CHECKS set), so runs share no in-memory state.
//
//   (started by run.ts) run-one.ts --version <versionId> --mode on|off|strict --run <k> [--model gpt-4.1] [--steps 40]
//
// strict: checks off, and evals/prompts/strict.md is added to the task prompt (see lib/prompts.ts).
//
// Writes benchmark/results/<mode>/<versionId>/run<k>.json and run<k>.session.jsonl.

import { existsSync, readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";
import type { AgentEvent } from "@tygig/core";
import { normaliseId, resolveId } from "../../packages/cli/src/review/checks.ts";
import { readLatexPaper } from "../../packages/cli/src/review/parser.ts";
import type { VersionEntry } from "../lib/plant.ts";
import { findTarget, type RunResult, type Submission } from "../lib/results.ts";
import { flags, runAgent, workDir, writeJson } from "../lib/agent-run.ts";
import { codeVersion } from "../lib/git.ts";
import { checksSetting, parseMode, STRICT_PROMPT_FILE, strictPrompt, taskPrompt } from "../lib/prompts.ts";

const args = flags(process.argv.slice(2));
const versionId = args.version;
const mode = parseMode(args.mode);
const run = Number(args.run ?? 1);
if (!versionId || !mode) {
  console.error("Usage: run-one.ts --version <versionId> --mode on|off|strict --run <k> [--model <model>] [--steps 40]");
  process.exit(1);
}
process.env.TYGIG_REVIEW_CHECKS = checksSetting(mode);
const strict = mode === "strict" ? strictPrompt() : undefined;

const work = workDir();
const manifest = JSON.parse(readFileSync(path.join(work, "versions", "manifest.json"), "utf8")) as VersionEntry[];
const version = manifest.find((v) => v.versionId === versionId);
if (!version || !version.valid) {
  console.error(`${versionId}: not a valid version in the manifest`);
  process.exit(1);
}
const paperDir = path.join(work, "versions", versionId, "src");
if (!existsSync(paperDir)) {
  console.error(`No source at ${paperDir}. Run plant.ts first.`);
  process.exit(1);
}

const outDir = path.join(work, "results", mode, versionId);
const prompt = (p: string) => taskPrompt(p, version.claimText, mode, strict?.text);

// Every submit_link call, as the model wrote it (the claim map keeps only the latest attempt).
const calls: { claimId: string; evidenceIds: string[] }[] = [];
const onEvent = (e: AgentEvent) => {
  if (e.type !== "assistant_message") return;
  for (const call of e.message.toolCalls) {
    if (call.name !== "review__submit_link") continue;
    try {
      const input = JSON.parse(call.arguments || "{}") as Record<string, unknown>;
      calls.push({ claimId: normaliseId(String(input.claim_sentence_id ?? "")), evidenceIds: idList(input.evidence_ids) });
    } catch { /* unreadable arguments: the tool reported the error to the model */ }
  }
};

const { map, stats } = await runAgent({
  paperDir, prompt, onEvent,
  ...(args.model && { model: args.model }),
  stepLimit: Number(args.steps ?? 40),
  sessionLog: path.join(outDir, `run${run}.session.jsonl`),
});

// A provider error (e.g. the rate limit) is not a result: the run did not get to answer. Save the
// details apart and exit with code 3, so run.ts tries the run again instead of counting it.
if (stats.endReason === "error") {
  await writeJson(path.join(outDir, `run${run}.error.json`), { versionId, mode, run, stats, code: codeVersion() });
  console.error(`provider error: ${stats.errors[stats.errors.length - 1] ?? "unknown"}`);
  process.exit(3);
}

const paper = await readLatexPaper(paperDir);
const submissions: Submission[] = calls.map((c) => ({
  ...c, missingIds: c.evidenceIds.filter((id) => resolveId(paper, id).kind === "missing"),
}));
const entry = findTarget(map, version.claimText);
const result: RunResult = {
  versionId, paperId: version.paperId, targetId: version.targetId, fault: version.fault,
  expected: version.expected, mode, run, claimText: version.claimText,
  found: entry !== undefined,
  ...(entry && { claimId: entry.claimId, label: entry.label, modelLabel: entry.modelLabel }),
  evidenceIds: entry?.evidence.map((e) => e.id) ?? [],
  comparisons: entry?.comparisons ?? [],
  checks: entry?.checks ?? [],
  attempts: entry?.attempts ?? 0,
  submissions,
  otherClaims: (map?.claims ?? []).filter((c) => c !== entry).map((c) => c.claimId),
  stats,
  code: codeVersion(),
  ...(strict && { strictPrompt: { file: path.relative(path.resolve(STRICT_PROMPT_FILE, "..", "..", ".."), STRICT_PROMPT_FILE).split(path.sep).join("/"), sha256: strict.sha256 } }),
};
await writeJson(path.join(outDir, `run${run}.json`), result);
await rm(path.join(outDir, `run${run}.error.json`), { force: true });   // an earlier failed try of this run
console.log(`${mode} ${versionId} run${run}: ${result.found ? result.label : "not found"} ` +
            `(${stats.endReason}, ${stats.steps} steps, ${stats.inputTokens} in-tokens, ${stats.seconds}s)`);

function idList(x: unknown): string[] {
  if (Array.isArray(x)) return x.map((v) => normaliseId(String(v)));
  if (typeof x === "string" && x.trim().startsWith("[")) {
    try { return idList(JSON.parse(x)); } catch { /* fall through */ }
  }
  if (typeof x === "string") return x.split(/[,;\s]+/).filter(Boolean).map((v) => normaliseId(v));
  return [];
}
