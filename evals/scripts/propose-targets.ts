// propose-targets.ts - candidate target claims from the checks-on full reviews, blind to the tool's labels.
//
//   tygig-bench targets
//
// Reads benchmark/full/<id>/on/claim-map.json for every benchmark (non-development) paper.
// Writes benchmark/targets.candidates.json: every claim with numbers, whatever its label, with the
// claim's numbers and the evidence cells the review cited (value, row and column labels).
// The tool's labels and check results go to benchmark/targets.candidates.labels.json instead:
// do not open that file until the runs are done.
//
// Then, by hand: pick up to 3 claims per paper, check the evidence cells in the paper's table and
// correct evidenceIds if needed, add comparisons ({ ours, baseline, higher_is_better }) for a
// comparison claim (otherwise F3 is skipped), set confirmed: true, and save the file as
// benchmark/targets.json. plant.ts reads only confirmed targets.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { ClaimMap } from "../../packages/cli/src/review/claim-map.ts";
import { buildCandidates } from "../lib/candidates.ts";
import { workDir, writeJson } from "../lib/agent-run.ts";
import { devPapers, paperSource } from "../lib/papers.ts";

const work = workDir();
const fullDir = path.join(work, "full");
if (!existsSync(fullDir)) {
  console.error(`No full reviews in ${work} yet. Run: tygig-bench full-review --paper <folder> --mode on`);
  process.exit(1);
}

const dev = devPapers(work);
const maps: Record<string, ClaimMap> = {};
for (const paperId of readdirSync(fullDir).sort()) {
  if (dev.includes(paperId)) continue;
  const file = path.join(fullDir, paperId, "on", "claim-map.json");
  if (!existsSync(file)) { console.log(`${paperId}: no checks-on review, skipped`); continue; }
  try { await paperSource(work, paperId); } catch (err) { console.error((err as Error).message); process.exit(1); }
  maps[paperId] = JSON.parse(readFileSync(file, "utf8")) as ClaimMap;
}

const { candidates, labels } = buildCandidates(maps, dev);
for (const paperId of Object.keys(maps)) {
  const n = candidates.filter((c) => c.paperId === paperId).length;
  console.log(`${paperId}: ${n} claim${n === 1 ? "" : "s"} with numbers`);
}
const out = path.join(work, "targets.candidates.json");
await writeJson(out, candidates);
await writeJson(path.join(work, "targets.candidates.labels.json"), labels);
console.log(`\n${candidates.length} candidate${candidates.length === 1 ? "" : "s"} written to ${out}`);
console.log(`(Development papers left out: ${dev.join(", ") || "none"}.)`);
console.log("The tool's labels are in targets.candidates.labels.json: do not open it until the runs are done.");
console.log(`Pick up to 3 per paper, check the cells, set "confirmed": true, and save as ${path.join(work, "targets.json")}`);
