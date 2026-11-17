// set-paper.ts - change a registered paper: where it is now (e.g. on another computer), or whether it
// is a development paper.
//
//   tygig-bench set-paper --id <paper ID> [--paper <folder>] [--dev true|false]
//
// A new folder must hold the same files as before (same hash). No model call.

import { flags, workDir } from "../lib/agent-run.ts";
import { relocatePaper, setDev } from "../lib/papers.ts";

const args = flags(process.argv.slice(2));
if (!args.id || (!args.paper && args.dev === undefined)) {
  console.error("Usage: tygig-bench set-paper --id <paper ID> [--paper <folder>] [--dev true|false]");
  process.exit(1);
}
try {
  if (args.paper) {
    const info = await relocatePaper(workDir(), args.id, args.paper);
    console.log(`Paper ${info.id} is now read from ${info.src} (same files, hash checked).`);
  }
  if (args.dev !== undefined) {
    const info = await setDev(workDir(), args.id, args.dev !== "false");
    console.log(`Paper ${info.id} is ${info.dev ? "a development paper (reported apart from the headline numbers)" : "a benchmark paper"}.`);
  }
} catch (err) {
  console.error((err as Error).message);
  process.exit(1);
}
