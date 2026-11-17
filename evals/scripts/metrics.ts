// metrics.ts - compute the benchmark numbers from benchmark/results/.
//
//   tygig-bench metrics
//
// Writes benchmark/results/metrics.json and benchmark/results/summary.md. For checks-off runs it first runs
// C1 to C4 (checks.ts) on each recorded link, against that version's paper, for RQ3.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { Paper } from "../../packages/cli/src/review/paper.ts";
import { readLatexPaper } from "../../packages/cli/src/review/parser.ts";
import { runChecks } from "../../packages/cli/src/review/checks.ts";
import type { VersionEntry } from "../lib/plant.ts";
import type { RunResult } from "../lib/results.ts";
import { computeMetrics, summaryMarkdown } from "../lib/metrics.ts";
import { workDir, writeJson } from "../lib/agent-run.ts";
import { devPapers } from "../lib/papers.ts";

const work = workDir();
const manifest = JSON.parse(readFileSync(path.join(work, "versions", "manifest.json"), "utf8")) as VersionEntry[];
const resultsDir = path.join(work, "results");
const results: RunResult[] = [];
for (const mode of ["on", "off", "strict"]) {
  const dir = path.join(resultsDir, mode);
  if (!existsSync(dir)) continue;
  for (const versionId of readdirSync(dir)) {
    for (const f of readdirSync(path.join(dir, versionId))) {
      if (/^run\d+\.json$/.test(f)) results.push(JSON.parse(readFileSync(path.join(dir, versionId, f), "utf8")));
    }
  }
}
if (results.length === 0) {
  console.error("No results yet. Run tygig-bench run first.");
  process.exit(1);
}

// Checks off and strict: run the checks afterwards on what the model submitted.
const papers = new Map<string, Paper>();
for (const r of results) {
  if (r.mode === "on" || !r.found || !r.claimId) continue;
  const src = path.join(work, "versions", r.versionId, "src");
  if (!existsSync(src)) continue;
  if (!papers.has(r.versionId)) papers.set(r.versionId, await readLatexPaper(src));
  r.posthocChecks = runChecks(papers.get(r.versionId)!, { claimId: r.claimId, evidenceIds: r.evidenceIds, comparisons: r.comparisons });
}

const metrics = computeMetrics(results, manifest, devPapers(work));
await writeJson(path.join(resultsDir, "metrics.json"), metrics);
await writeFile(path.join(resultsDir, "summary.md"), summaryMarkdown(metrics), "utf8");
console.log(summaryMarkdown(metrics));
for (const w of metrics.code.warnings) console.warn(`WARNING: ${w}`);
console.log(`Written: ${path.join(resultsDir, "metrics.json")} and summary.md`);
