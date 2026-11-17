// get-paper.ts - download one paper's LaTeX source from arXiv into a folder, ready for a review.
//
//   tygig-bench get-paper --arxiv 2611.16104v1 [--to paper]
//
// The folder (default "paper", in the folder you run from) must be new or empty.

import path from "node:path";
import { flags } from "../lib/agent-run.ts";
import { downloadArxivSource } from "../lib/arxiv.ts";

const args = flags(process.argv.slice(2));
if (!args.arxiv || args.arxiv === "true") {
  console.error("Usage: tygig-bench get-paper --arxiv <arXiv ID, e.g. 2611.16104v1> [--to <folder>]");
  process.exit(1);
}
const dest = path.resolve(args.to && args.to !== "true" ? args.to : "paper");
try {
  const files = await downloadArxivSource(args.arxiv, dest);
  console.log(`Downloaded arXiv ${args.arxiv}: ${files.length} files in ${dest}`);
} catch (err) {
  console.error((err as Error).message);
  process.exit(1);
}
