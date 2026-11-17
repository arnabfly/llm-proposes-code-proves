// run.ts - run the benchmark: every valid version, k runs, one mode.
//
//   tygig-bench run --mode on|off|strict [--runs 3] [--model gpt-4.1] [--concurrency 4] [--only <versionId or prefix>]
//
// strict: checks off, and evals/prompts/strict.md is added to the task prompt.
// Each run is its own child process (run-one.ts) with TYGIG_REVIEW_CHECKS=on|off, so runs never share
// the review tools' in-memory state. Runs that already have a result file are skipped, so you can
// stop it and start it again. --only takes a version ID, or the start of one (e.g. a paper ID).
// A run that ends with a provider error (e.g. OpenAI's tokens-per-minute limit) is not saved as a
// result: it waits and is tried again (up to 6 times), then left for the next start. With gpt-4.1 a
// run can send far more than that, so each run also has a speed brake (evals/lib/throttle.ts): the
// whole benchmark stays under --tpm tokens per minute (default 400,000, for a 450,000 TPM limit),
// shared between the parallel runs, and a rate-limited request waits and is sent again.

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { VersionEntry } from "../lib/plant.ts";
import { flags, SCRIPTS, workDir } from "../lib/agent-run.ts";
import { checksSetting, parseMode, strictPrompt } from "../lib/prompts.ts";

const args = flags(process.argv.slice(2));
const mode = parseMode(args.mode);
if (!mode) {
  console.error("Usage: run.ts --mode on|off|strict [--runs 3] [--model gpt-4.1] [--concurrency 4] [--only <versionId>]");
  process.exit(1);
}
if (mode === "strict") console.log(`Strict prompt: evals/prompts/strict.md, SHA-256 ${strictPrompt().sha256}`);
const runs = Number(args.runs ?? 3);
const model = args.model ?? "gpt-4.1";
const concurrency = Math.max(1, Number(args.concurrency ?? 4));
const steps = args.steps ?? "40";
const tpm = Number(args.tpm ?? 400_000);

const work = workDir();
const manifestFile = path.join(work, "versions", "manifest.json");
if (!existsSync(manifestFile)) {
  console.error(`No ${manifestFile}. Run tygig-bench plant first.`);
  process.exit(1);
}
const only = args.only?.split(",").map((s) => s.trim()).filter(Boolean);
const versions = (JSON.parse(readFileSync(manifestFile, "utf8")) as VersionEntry[])
  .filter((v) => v.valid)
  .filter((v) => !only || only.some((o) => v.versionId === o || v.versionId.startsWith(o)));

const jobs: { versionId: string; run: number }[] = [];
let skipped = 0;
for (const v of versions) {
  for (let k = 1; k <= runs; k++) {
    if (existsSync(path.join(work, "results", mode, v.versionId, `run${k}.json`))) skipped++;
    else jobs.push({ versionId: v.versionId, run: k });
  }
}
console.log(`Mode ${mode}, model ${model}: ${versions.length} versions x ${runs} runs. ` +
            `${jobs.length} to do, ${skipped} already done. ${concurrency} at a time, at most ${tpm} tokens per minute in all.`);

// The child runs with the program's own tsx (found from this file), in the same work folder.
const tsx = import.meta.resolve("tsx");
const runOne = path.join(SCRIPTS, "run-one.ts");
const total = jobs.length;
const tries = new Map<string, number>();
const MAX_TRIES = 6;
let done = 0, failed = 0, next = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function worker(): Promise<void> {
  while (next < jobs.length) {
    const job = jobs[next++]!;
    const key = `${job.versionId}#${job.run}`;
    const { code, out, err } = await child(job.versionId, job.run);
    const line = out.trim().split("\n").pop() ?? "";
    const why = (err.trim().split("\n").pop() ?? "") || `exit code ${code}`;
    if (code === 3) {                                      // provider error: wait, then try again
      const n = (tries.get(key) ?? 0) + 1;
      tries.set(key, n);
      if (n < MAX_TRIES) {
        const wait = Math.min(60, 10 * n);
        console.log(`   ${mode} ${job.versionId} run${job.run}: ${why.slice(0, 120)}. Trying again in ${wait}s (attempt ${n + 1} of ${MAX_TRIES}).`);
        await sleep(wait * 1000);
        jobs.push(job);
        continue;
      }
    }
    done++;
    if (code === 0) console.log(`[${done}/${total}] ${line}`);
    else {
      failed++;
      console.log(`[${done}/${total}] ${mode} ${job.versionId} run${job.run}: FAILED (${why.slice(0, 160)}). It will be tried again next time.`);
    }
  }
}

function child(versionId: string, run: number): Promise<{ code: number; out: string; err: string }> {
  return new Promise((resolve) => {
    const p = spawn(process.execPath,
      ["--import", tsx, runOne, "--version", versionId, "--mode", mode!, "--run", String(run), "--model", model, "--steps", steps],
      { env: { ...process.env, TYGIG_REVIEW_CHECKS: checksSetting(mode!), TYGIG_BENCH_DIR: work, TYGIG_BENCH_TPM: String(Math.floor(tpm / concurrency)) },
        stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    p.stdout.on("data", (d) => { out += d; });
    p.stderr.on("data", (d) => { err += d; });
    p.on("close", (code) => resolve({ code: code ?? 1, out, err }));
    p.on("error", (e) => resolve({ code: 1, out, err: e.message }));
  });
}

await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, worker));
console.log(`Finished: ${done - failed} runs saved, ${failed} failed. Results: ${path.join(work, "results", mode)}`);
