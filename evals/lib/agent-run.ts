// agent-run.ts - one agent run on one paper, outside the terminal: the same provider, tools,
// instructions and skills as `tygig`, with a fresh agent and a session log of its own.
//
// Checks on or off is decided by TYGIG_REVIEW_CHECKS in this process's environment (read by the
// review tools at every call). run.ts starts each run as its own process, so runs never share the
// tools' in-memory paper or claim map.

import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createAgent, Session } from "@tygig/agent";
import type { AgentEvent } from "@tygig/core";
import { readConfig } from "../../packages/cli/src/config.ts";
import { connect } from "../../packages/cli/src/connect.ts";
import { getPaths } from "../../packages/cli/src/paths.ts";
import { buildInstructions } from "../../packages/cli/src/instructions.ts";
import { currentClaimMap, hackathonTools } from "../../packages/cli/src/hackathon-tools.ts";
import type { ClaimMap } from "../../packages/cli/src/review/claim-map.ts";
import { throttled } from "./throttle.ts";

export interface RunStats {
  model: string;
  mode: "on" | "off";                // the review tools' setting (strict runs with "off")
  inputTokens: number;
  outputTokens: number;
  seconds: number;
  steps: number;              // model replies (step_start events)
  toolCalls: number;
  endReason: string;          // done | step_limit | error | interrupted | timeout
  errors: string[];
  sessionLog: string;
}

/**
 * Run `prompt` with a fresh agent on a private copy of `paperDir` (so nothing is written into the
 * benchmark versions). Returns the claim map the tools built, and the run's statistics.
 */
export async function runAgent(opts: {
  paperDir: string;          // folder with the LaTeX source
  prompt: (paperPath: string) => string;
  model?: string;
  stepLimit: number;
  sessionLog: string;        // where to write the session log (JSON Lines)
  timeoutMs?: number;
  onEvent?: (event: AgentEvent) => void;   // to watch the run (e.g. collect tool calls)
}): Promise<{ map?: ClaimMap; stats: RunStats }> {
  const paths = getPaths();
  const config = await readConfig(paths.config);
  if (!config) throw new Error("No Tygig settings found. Run: tygig login");
  const model = opts.model ?? config.model;
  const connected = await connect({ ...config, model }, paths);

  // A private copy of the paper, so parallel runs never write into the same folder.
  const workDir = await mkdtemp(path.join(os.tmpdir(), "tygig-eval-"));
  const paperPath = path.join(workDir, "paper");
  await cp(opts.paperDir, paperPath, { recursive: true, filter: (f) => !/claim-map\.(json|md)$/.test(f) });

  const mode = (process.env.TYGIG_REVIEW_CHECKS ?? "").toLowerCase() === "off" ? "off" : "on";
  await mkdir(path.dirname(opts.sessionLog), { recursive: true });
  await rm(opts.sessionLog, { force: true });
  const session = new Session(opts.sessionLog, { provider: config.provider, model, cwd: workDir, mode }, connected.secrets);

  // Speed brake: stay under the provider's tokens-per-minute limit (TYGIG_BENCH_TPM, default 400,000;
  // run.ts gives each parallel run its share), and wait out a rate limit instead of ending the run.
  const tpm = Number(process.env.TYGIG_BENCH_TPM ?? 400_000);
  const provider = throttled(connected.provider, { tpm, log: (line) => console.error(line) });
  const agent = createAgent({
    provider, model, instructions: buildInstructions(workDir),
    tools: hackathonTools, stepLimit: opts.stepLimit,
  });

  const stats: RunStats = {
    model, mode, inputTokens: 0, outputTokens: 0, seconds: 0, steps: 0, toolCalls: 0,
    endReason: "unknown", errors: [], sessionLog: opts.sessionLog,
  };
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), opts.timeoutMs ?? 15 * 60_000);
  const started = Date.now();
  const onEvent = (event: AgentEvent) => {
    session.record(event);
    opts.onEvent?.(event);
    if (event.type === "step_start") stats.steps++;
    if (event.type === "tool_result") stats.toolCalls++;
    if (event.type === "error") stats.errors.push(event.message);
    if (event.type === "turn_end") {
      stats.endReason = event.reason;
      stats.inputTokens = event.usage.inputTokens;
      stats.outputTokens = event.usage.outputTokens;
    }
  };
  // The instructions tell the model "Project folder: <workDir>", and the tools read a relative path
  // (e.g. "paper") from the process's working folder. So the two must be the same folder.
  const before = process.cwd();
  process.chdir(workDir);
  try {
    await agent.run(opts.prompt(paperPath), onEvent, abort.signal);
  } catch (err) {
    stats.errors.push((err as Error).message);
    stats.endReason = "error";
  } finally {
    process.chdir(before);
    clearTimeout(timer);
    if (abort.signal.aborted && stats.endReason === "interrupted") stats.endReason = "timeout";
    stats.seconds = Math.round((Date.now() - started) / 100) / 10;
    await session.flush();
  }
  const map = currentClaimMap();
  await rm(workDir, { recursive: true, force: true }).catch(() => {});
  return { map, stats };
}

/** Write a JSON file (with its folder). */
export async function writeJson(file: string, data: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(data, null, 2) + "\n", "utf8");
}

/** Command-line flags: --name value. */
export function flags(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith("--")) {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) out[a.slice(2)] = "true";
      else { out[a.slice(2)] = next; i++; }
    }
  }
  return out;
}

/**
 * The work folder: everything the benchmark makes (full reviews, targets, versions, results) goes here.
 * It is "benchmark" in the folder you run the command from, so it lives with your papers, not in the
 * program's folder. TYGIG_BENCH_DIR sets another folder.
 */
export function workDir(): string {
  return path.resolve(process.env.TYGIG_BENCH_DIR ?? path.join(process.cwd(), "benchmark"));
}

/** The program's evals/scripts folder (where the scripts are, wherever they are started from). */
export const SCRIPTS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "scripts");
