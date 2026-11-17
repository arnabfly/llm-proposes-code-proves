#!/usr/bin/env node
// tygig-bench - the benchmark command. Run it in the folder where you work (next to your papers);
// everything it makes goes into a "benchmark" folder there. The program itself stays where it is.
//
//   tygig-bench full-review --paper <folder> --mode on|off [--model gpt-4.1]
//   tygig-bench targets
//   tygig-bench plant [--f5]
//   tygig-bench run --mode on|off|strict [--runs 3] [--model gpt-4.1] [--concurrency 4] [--only <versionId>]
//   tygig-bench metrics
//   tygig-bench set-paper --id <paper ID> [--paper <folder>] [--dev true|false]
//   tygig-bench get-paper --arxiv <arXiv ID> [--to <folder>]
//   tygig-bench setup --from <folder> [--no-runs]
//
// Installed with `npm link` in the program's folder, like `tygig`.

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const COMMANDS = {
  "full-review": "full-review.ts",
  targets: "propose-targets.ts",
  plant: "plant.ts",
  run: "run.ts",
  metrics: "metrics.ts",
  "set-paper": "set-paper.ts",
  "get-paper": "get-paper.ts",
  setup: "setup.ts",
};

const [command, ...rest] = process.argv.slice(2);
const script = COMMANDS[command];
if (!script) {
  console.log([
    "tygig-bench: the claim-verification benchmark. Run it in your work folder; results go to .\\benchmark.",
    "",
    "  tygig-bench full-review --paper <folder> --mode on|off [--model gpt-4.1]",
    "  tygig-bench targets",
    "  tygig-bench plant [--f5]",
    "  tygig-bench run --mode on|off|strict [--runs 3] [--model gpt-4.1] [--concurrency 1] [--tpm 400000] [--only <versionId>]",
    "  tygig-bench metrics",
    "  tygig-bench set-paper --id <paper ID> [--paper <folder>] [--dev true|false]",
    "  tygig-bench get-paper --arxiv <arXiv ID> [--to <folder>]      download a paper's LaTeX source",
    "  tygig-bench setup --from <folder> [--no-runs]                 set up from published results",
  ].join("\n"));
  process.exit(command ? 1 : 0);
}

// The scripts are TypeScript: run them with the program's own tsx, in the folder you are in.
const scripts = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "scripts");
const tsx = import.meta.resolve("tsx");
const child = spawn(process.execPath, ["--import", tsx, path.join(scripts, script), ...rest], { stdio: "inherit" });
child.on("close", (code) => process.exit(code ?? 1));
