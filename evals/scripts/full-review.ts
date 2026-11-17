// full-review.ts - one full review of a benchmark paper, to find candidate target claims.
//
//   tygig-bench full-review --paper <folder> (or --src <folder>) --mode on|off [--id <name>] [--arxiv 2611.16264v1] [--dev] [--model gpt-4.1] [--steps 80]
//
// The paper stays where it is. Its folder is added to benchmark/papers.json with a hash of its files
// (so a later change is noticed). Writes benchmark/full/<id>/<mode>/claim-map.json, claim-map.md,
// run.json (tokens, time, steps, end reason, hash) and session.jsonl (secrets removed).
// <id> is the folder's name unless --id is given.

import path from "node:path";
import { writeClaimMap } from "../../packages/cli/src/review/claim-map.ts";
import { flags, runAgent, workDir, writeJson } from "../lib/agent-run.ts";
import { registerPaper } from "../lib/papers.ts";
import { codeVersion } from "../lib/git.ts";

const args = flags(process.argv.slice(2));
if (!args.paper && args.src) args.paper = args.src;      // --src is accepted as another name for --paper
const mode = args.mode === "off" ? "off" : args.mode === "on" ? "on" : undefined;
if (!args.paper || !mode) {
  console.error("Usage: tygig-bench full-review --paper <folder> --mode on|off [--id <name>] [--arxiv <id>] [--model <model>] [--steps 80]");
  process.exit(1);
}
const work = workDir();
const paperId = args.id ?? path.basename(path.resolve(args.paper));
let paper;
try {
  paper = await registerPaper(work, paperId, args.paper, args.arxiv, args.dev ? args.dev !== "false" : undefined);
} catch (err) {
  console.error((err as Error).message);
  process.exit(1);
}
process.env.TYGIG_REVIEW_CHECKS = mode;   // read by the review tools at every call

const outDir = path.join(work, "full", paperId, mode);
console.log(`Full review of ${paperId} (${paper.src}), checks ${mode}...`);

const { map, stats } = await runAgent({
  paperDir: paper.src,
  prompt: (p) =>
    `Load the paper at ${p}. Find its main claims, link each one to its evidence with review__submit_link, ` +
    "then call review__finish. Do not ask questions.",
  ...(args.model && { model: args.model }),
  stepLimit: Number(args.steps ?? 80),
  sessionLog: path.join(outDir, "session.jsonl"),
});

if (map) await writeClaimMap(map, outDir);
await writeJson(path.join(outDir, "run.json"), {
  paperId, src: paper.src, sha256: paper.sha256, ...(paper.arxiv && { arxiv: paper.arxiv }),
  ...stats, claims: map?.claims.length ?? 0, counts: map?.counts, code: codeVersion(),
});

console.log(`Done: ${stats.endReason}, ${stats.steps} steps, ${stats.inputTokens} input tokens, ${stats.seconds}s.`);
if (map) console.log(`Claims: ${map.claims.length} (supported ${map.counts.supported}, unsupported ${map.counts.unsupported}, unverified ${map.counts.unverified}).`);
else console.log("No claims were submitted.");
console.log(`Output: ${outDir}`);
