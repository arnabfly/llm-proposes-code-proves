// candidates.ts - candidate target claims for the benchmark, BLIND to the tool's labels.
//
// Every claim with numbers from the checks-on full reviews is a candidate, whatever its label.
// The candidate file shows only what a person needs to pick and check targets by hand: the claim,
// its numbers, and the evidence cells the review cited (value, row and column labels). The tool's
// label, the model's label and the check results go to a separate file, opened only after the runs,
// so the choice of targets cannot be steered by what the tool said.

import type { ClaimMap } from "../../packages/cli/src/review/claim-map.ts";
import { claimNumbers, makesComparison, type Check, type Comparison, type Label } from "../../packages/cli/src/review/checks.ts";

export const SELECTION = "human-confirmed, blind to tool labels";

/** One line of targets.candidates.json. Edited by hand and saved as targets.json. */
export interface Candidate {
  paperId: string;
  targetId: string;
  claimText: string;
  numbers: string[];                   // the claim's numbers, as written
  comparison: boolean;                 // the sentence compares (add ours and baseline for F3)
  evidenceIds: string[];               // suggested evidence cells: check them in the table, correct if needed
  cells: Record<string, { text: string; value?: number; rowLabel?: string; colLabel?: string }>;
  comparisons: Comparison[];           // empty: for a comparison claim, add { ours, baseline, higher_is_better }
  confirmed: boolean;
  selection: string;
}

/** One line of targets.candidates.labels.json (not to be opened before the runs are done). */
export interface CandidateLabel {
  paperId: string;
  targetId: string;
  label: Label;
  modelLabel: Label;
  checks: Check[];
}

/** Candidates from full reviews (paper ID -> checks-on claim map), leaving out development papers. */
export function buildCandidates(maps: Record<string, ClaimMap>, devPapers: string[] = []): { candidates: Candidate[]; labels: CandidateLabel[] } {
  const candidates: Candidate[] = [];
  const labels: CandidateLabel[] = [];
  for (const paperId of Object.keys(maps).sort()) {
    if (devPapers.includes(paperId)) continue;
    for (const c of maps[paperId]!.claims) {
      const numbers = claimNumbers(c.text).map((n) => n.raw);
      if (numbers.length === 0) continue;
      const cells: Candidate["cells"] = {};
      for (const e of c.evidence) {
        if (e.kind !== "cell" || !e.exists) continue;
        cells[e.id] = { text: e.text ?? "", ...(e.value !== undefined && { value: e.value }),
                        ...(e.rowLabel && { rowLabel: e.rowLabel }), ...(e.colLabel && { colLabel: e.colLabel }) };
      }
      candidates.push({
        paperId, targetId: c.claimId, claimText: c.text, numbers, comparison: makesComparison(c.text),
        evidenceIds: Object.keys(cells), cells, comparisons: [], confirmed: false, selection: SELECTION,
      });
      labels.push({ paperId, targetId: c.claimId, label: c.label, modelLabel: c.modelLabel, checks: c.checks });
    }
  }
  return { candidates, labels };
}
