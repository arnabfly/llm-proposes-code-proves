// setup.ts - set up a work folder from a published benchmark (for example hackathon/results in the
// repository), so anyone can check the numbers or run the benchmark again.
//
//   tygig-bench setup --from <folder> [--no-runs]
//
// <folder> holds papers.json and targets.json, and optionally runs.json (the recorded runs, one object each).
// setup:
//   1. downloads the LaTeX source of every paper with a target from arXiv (by its versioned ID) into
//      papers/<name> in the folder you run from, unless that folder is already there;
//   2. checks that the files are exactly the ones we used (SHA-256 hash, as in papers.json);
//   3. writes benchmark/papers.json and benchmark/targets.json;
//   4. copies the recorded runs into benchmark/results/ (left out with --no-runs, to run everything
//      again with your own model).
// No model calls. Then: tygig-bench plant, and tygig-bench metrics (or tygig-bench run ... first).

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { flags, workDir, writeJson } from "../lib/agent-run.ts";
import { downloadArxivSource } from "../lib/arxiv.ts";
import { hashSource, type PaperInfo } from "../lib/papers.ts";

const args = flags(process.argv.slice(2));
if (!args.from || args.from === "true") {
  console.error("Usage: tygig-bench setup --from <folder with papers.json and targets.json> [--no-runs]");
  process.exit(1);
}
const from = path.resolve(args.from);
const work = workDir();
const read = (f: string) => JSON.parse(readFileSync(path.join(from, f), "utf8"));
for (const f of ["papers.json", "targets.json"]) {
  if (!existsSync(path.join(from, f))) { console.error(`No ${f} in ${from}.`); process.exit(1); }
}
const papers = read("papers.json") as Record<string, PaperInfo>;
const targets = read("targets.json") as { paperId: string }[];
const needed = [...new Set(targets.map((t) => t.paperId))];

let problems = 0;
for (const id of needed) {
  const info = papers[id];
  if (!info?.arxiv) { console.error(`Paper ${id}: no arXiv ID in papers.json.`); problems++; continue; }
  const name = path.basename(info.src.replace(/\\/g, "/")) || id;
  const dir = path.resolve("papers", name);
  if (!existsSync(dir) || readdirSync(dir).length === 0) {
    try {
      const files = await downloadArxivSource(info.arxiv, dir);
      console.log(`Downloaded ${id} (arXiv ${info.arxiv}): ${files.length} files`);
    } catch (err) {
      console.error(`Paper ${id} (arXiv ${info.arxiv}): ${(err as Error).message}`); problems++; continue;
    }
  }
  const now = await hashSource(dir);
  if (now === info.sha256) console.log(`ok       ${id}: same files as ours (${dir})`);
  else {
    console.error(`DIFFERENT ${id}: the files in ${dir} are not the ones we used.\n  hash ours: ${info.sha256}\n  hash here: ${now}`);
    problems++;
  }
  papers[id] = { ...info, src: dir };
}
// Papers without a target (e.g. the development paper) keep their entry, so they stay marked.
for (const [id, info] of Object.entries(papers)) {
  if (!needed.includes(id)) papers[id] = { ...info, src: path.resolve("papers", path.basename(info.src.replace(/\\/g, "/"))) };
}
await writeJson(path.join(work, "papers.json"), papers);
await writeJson(path.join(work, "targets.json"), read("targets.json"));
console.log(`Written: ${path.join(work, "papers.json")} and targets.json`);

let copied = 0;
const runsFile = path.join(from, "runs.json");
if (!args["no-runs"] && existsSync(runsFile)) {
  const runs = JSON.parse(readFileSync(runsFile, "utf8")) as { mode: string; versionId: string; run: number }[];
  for (const r of runs) {
    if (!/^(on|off|strict)$/.test(r.mode) || !/^[\w.-]+$/.test(r.versionId) || !Number.isInteger(r.run)) {
      console.error(`Skipped a run with an unexpected mode, version or number: ${JSON.stringify([r.mode, r.versionId, r.run])}`);
      continue;
    }
    await writeJson(path.join(work, "results", r.mode, r.versionId, `run${r.run}.json`), r);
    copied++;
  }
  console.log(`Copied ${copied} recorded runs into ${path.join(work, "results")}`);
}

if (problems > 0) {
  console.error(`\n${problems} problem(s) above. Planting needs the exact files; fix them first.`);
  process.exit(1);
}
console.log(copied > 0
  ? "\nNext: tygig-bench plant, then tygig-bench metrics (recomputes our numbers from the recorded runs; no model calls)."
  : "\nNext: tygig-bench plant, then tygig-bench run --mode on (and off, strict), then tygig-bench metrics.");
