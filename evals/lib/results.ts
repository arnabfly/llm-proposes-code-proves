// results.ts - the shape of one benchmark run's result (benchmark/results/<mode>/<versionId>/run<k>.json),
// and how it is taken out of a claim map. Shared by run-one.ts, metrics.ts and the tests.

import type { Check, Comparison, Label } from "../../packages/cli/src/review/checks.ts";
import type { ClaimEntry, ClaimMap } from "../../packages/cli/src/review/claim-map.ts";
import type { Fault } from "./plant.ts";
import type { RunStats } from "./agent-run.ts";
import type { CodeVersion } from "./git.ts";
import type { Mode } from "./prompts.ts";

/** One review__submit_link call as the model made it (every attempt, not only the last). */
export interface Submission {
  claimId: string;
  evidenceIds: string[];
  missingIds: string[];          // evidence IDs that do not exist in the paper
}

export interface RunResult {
  versionId: string;
  paperId: string;
  targetId: string;
  fault: Fault;
  expected: "supported" | "unsupported";
  mode: Mode;
  run: number;
  claimText: string;
  found: boolean;                // was the target sentence submitted at all?
  claimId?: string;              // the sentence ID the model used for it
  label?: Label;                 // final label (checks on: from code; off: the model's)
  modelLabel?: Label;
  evidenceIds: string[];
  comparisons: Comparison[];
  checks: Check[];               // empty in off mode (see posthocChecks)
  attempts: number;
  submissions: Submission[];     // all submit_link calls of the run, for every claim
  otherClaims: string[];         // sentence IDs submitted that are not the target
  posthocChecks?: Check[];       // off mode, filled in by metrics.ts: C1 to C4 run on the recorded link
  stats: RunStats;
  code?: CodeVersion;            // the program's Git commit and uncommitted-changes flag for this run
  strictPrompt?: { file: string; sha256: string };   // strict mode: the prompt file added, and its hash
}

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

/** The claim-map entry for the target sentence, matched by its text (IDs differ between versions). */
export function findTarget(map: ClaimMap | undefined, claimText: string): ClaimEntry | undefined {
  return map?.claims.find((c) => norm(c.text) === norm(claimText));
}
