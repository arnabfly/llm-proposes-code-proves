// claim-map.ts - the claim map: one entry per claim, built from review__submit_link calls,
// written by review__finish as claim-map.json (for programs) and claim-map.md (for people).

import { writeFile } from "node:fs/promises";
import { statSync } from "node:fs";
import path from "node:path";
import type { Paper } from "./paper.js";
import { finalLabel, normaliseId, resolveId, runChecks, type Check, type Comparison, type Label } from "./checks.js";

export type Mode = "checks" | "baseline";

/** One claim in the map: the latest submission, and how many submissions there were. */
export interface ClaimEntry {
  claimId: string;
  section: string;
  text: string;                    // taken from the paper by ID, never from the model
  evidence: EvidenceEntry[];
  comparisons: Comparison[];       // as submitted (the checks say which were used or ignored)
  checks: Check[];                 // empty in baseline mode
  label: Label;                    // the final label (in baseline mode: the model's label)
  modelLabel: Label;
  attempts: number;
}

export interface EvidenceEntry {
  id: string;
  exists: boolean;
  kind: "sentence" | "cell" | "missing";
  text?: string;                   // sentence text, or cell text
  value?: number;
  rowLabel?: string;
  colLabel?: string;
}

export interface ClaimMap {
  paper: { title: string; source: string; mainFile?: string };
  mode: Mode;
  created: string;
  counts: Record<Label, number>;
  claims: ClaimEntry[];
}

/** Checks on, unless TYGIG_REVIEW_CHECKS=off (the baseline for the evaluation). Read at every call. */
export function reviewMode(): Mode {
  return (process.env.TYGIG_REVIEW_CHECKS ?? "").toLowerCase() === "off" ? "baseline" : "checks";
}

/** The claims submitted for the loaded paper, by claim ID. */
export class ClaimStore {
  private entries = new Map<string, ClaimEntry>();

  constructor(readonly paper: Paper) {}

  /**
   * Record one submission and, in checks mode, run C1 to C4. Returns the entry.
   *
   * When a claim is submitted again, the evidence of earlier attempts is kept and the new
   * evidence is added, so a model that "replaces" instead of "adds" cannot lose evidence that
   * already worked. IDs that did not exist are not kept. Comparisons are not kept: the latest
   * comparisons replace earlier ones, so a wrong comparison can be corrected.
   */
  submit(input: { claimId: string; evidenceIds: string[]; comparisons?: Comparison[]; modelLabel: Label }, mode: Mode): ClaimEntry {
    const claimId = normaliseId(input.claimId);
    const claim = this.paper.sentences.find((s) => s.id === claimId);
    const earlier = (this.entries.get(claimId)?.evidence ?? []).filter((e) => e.exists).map((e) => e.id);
    // The claim itself is never stored as its own evidence (the checks ignore it too).
    const evidenceIds = [...new Set([...earlier, ...input.evidenceIds.map((id) => normaliseId(id))])].filter((id) => id !== claimId);
    const checks = mode === "checks" ? runChecks(this.paper, { ...input, evidenceIds }) : [];
    const entry: ClaimEntry = {
      claimId,
      section: claim?.section ?? "",
      text: claim?.text ?? "(no sentence with this ID)",
      evidence: evidenceIds.map((id) => this.describe(id)),
      comparisons: input.comparisons ?? [],
      checks,
      label: mode === "checks" ? finalLabel(checks) : input.modelLabel,
      modelLabel: input.modelLabel,
      attempts: (this.entries.get(claimId)?.attempts ?? 0) + 1,
    };
    this.entries.set(claimId, entry);          // keep the latest submission
    return entry;
  }

  /** The whole map, claims in document order. */
  map(mode: Mode): ClaimMap {
    const order = (id: string) => Number(id.slice(1)) || Number.MAX_SAFE_INTEGER;
    const claims = [...this.entries.values()].sort((a, b) => order(a.claimId) - order(b.claimId));
    const counts: Record<Label, number> = { supported: 0, unsupported: 0, unverified: 0 };
    for (const c of claims) counts[c.label]++;
    return {
      paper: { title: this.paper.title, source: this.paper.source, ...(this.paper.mainFile && { mainFile: this.paper.mainFile }) },
      mode, created: new Date().toISOString(), counts, claims,
    };
  }

  private describe(rawId: string): EvidenceEntry {
    const e = resolveId(this.paper, rawId);
    if (e.kind === "sentence") return { id: e.id, exists: true, kind: "sentence", text: e.sentence.text };
    if (e.kind === "cell") {
      return { id: e.id, exists: true, kind: "cell", text: e.cell.text,
               ...(e.cell.value !== undefined && { value: e.cell.value }), rowLabel: e.cell.rowLabel, colLabel: e.cell.colLabel };
    }
    return { id: e.id, exists: false, kind: "missing" };
  }
}

/** The folder the outputs go to: the paper's folder (or the folder of its .tex file). */
export function outputFolder(paper: Paper): string {
  try {
    return statSync(paper.source).isDirectory() ? paper.source : path.dirname(paper.source);
  } catch {
    return path.dirname(paper.source);
  }
}

/** Write claim-map.json and claim-map.md. Returns their paths. */
export async function writeClaimMap(map: ClaimMap, folder: string): Promise<{ json: string; md: string }> {
  const json = path.join(folder, "claim-map.json");
  const md = path.join(folder, "claim-map.md");
  await writeFile(json, JSON.stringify(map, null, 2) + "\n", "utf8");
  await writeFile(md, toMarkdown(map), "utf8");
  return { json, md };
}

const LABEL_TEXT: Record<Label, string> = { supported: "Supported", unsupported: "Unsupported", unverified: "Unverified" };

/** The claim map for people to read. */
export function toMarkdown(map: ClaimMap): string {
  const lines = [
    `# Claim map: ${map.paper.title || "(no title)"}`,
    "",
    `Source: ${map.paper.mainFile ?? map.paper.source}. Created ${map.created}.`,
    map.mode === "checks"
      ? "Mode: checks on. Labels come from checks C1 to C4 (code), not from the model."
      : "Mode: baseline (checks off). Labels are the model's own.",
    "",
    "| Label | Claims |",
    "|---|---|",
    ...(["supported", "unsupported", "unverified"] as Label[]).map((l) => `| ${LABEL_TEXT[l]} | ${map.counts[l]} |`),
    "",
  ];
  for (const c of map.claims) {
    const attempts = `${c.attempts} attempt${c.attempts === 1 ? "" : "s"}`;
    lines.push(`## ${c.claimId}: ${LABEL_TEXT[c.label]}`, "");
    lines.push(`> ${c.text}`, "");
    lines.push(`Section ${c.section || "?"}. Model's label: ${c.modelLabel}. ${attempts}.`, "");
    lines.push("**Evidence**", "");
    if (c.evidence.length === 0) lines.push("- none");
    for (const e of c.evidence) {
      if (e.kind === "cell") lines.push(`- ${e.id}: ${e.text || "(empty)"} (row "${e.rowLabel}", column "${e.colLabel}")`);
      else if (e.kind === "sentence") lines.push(`- ${e.id}: "${e.text}"`);
      else lines.push(`- ${e.id}: does not exist`);
    }
    for (const k of c.comparisons) {
      lines.push(`- Comparison: ${k.ours} vs ${k.baseline}, ${k.higher_is_better ? "higher" : "lower"} is better`);
    }
    lines.push("");
    if (c.checks.length > 0) {
      lines.push("**Checks**", "");
      for (const k of c.checks) lines.push(`- ${k.id} ${k.name}: ${k.result}. ${k.reason}`);
      lines.push("");
    }
  }
  return lines.join("\n");
}

/** The text review__submit_link returns: the label first (the screen shows only the first line). */
export function describeEntry(entry: ClaimEntry, mode: Mode): string {
  if (mode === "baseline") return `${entry.claimId}: recorded (attempt ${entry.attempts}).`;
  const lines = [`${entry.claimId}: ${LABEL_TEXT[entry.label]} (attempt ${entry.attempts}; your label: ${entry.modelLabel}).`];
  for (const k of entry.checks) lines.push(`${k.id} ${k.name}: ${k.result}. ${k.reason}`);
  if (entry.label !== "supported" && entry.checks.some((k) => k.result === "failed")) {
    const kept = entry.evidence.filter((e) => e.exists).map((e) => e.id);
    lines.push(`Evidence kept for ${entry.claimId}: ${kept.join(", ") || "none"}. It stays when you submit this claim again: ` +
      "add only the missing evidence (see the reasons above), or accept the label.");
  }
  return lines.join("\n");
}
