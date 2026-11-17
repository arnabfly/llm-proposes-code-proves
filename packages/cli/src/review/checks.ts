// checks.ts - checks C1 to C4 for one claim-evidence link, and the final label.
//
// "The LLM proposes, code proves": the model says which evidence supports a claim;
// this file checks the link against the paper with plain code (no model calls).
// Each check returns passed, failed or not applicable, with a reason. A failed check's
// reason says how to fix the link, so the model can correct itself (design D18).
//
//   C1 Exists          the claim and every cited ID exist (and the claim does not cite itself)
//   C2 Number match    each number in the claim appears in the cited cells or sentences
//   C3 Derived number  each stated difference ("by 1.2 points", "12% better") recomputes from cited cells
//   C4 Direction       ours vs baseline are in the stated order (and the metric's direction fits);
//                      only when the claim sentence itself makes a comparison
//
// Text alone cannot make a claim Supported (rule R1): every number in the claim must be matched in a
// cited table cell (directly, or recomputed from cells by C3). A number matched only in a sentence
// that restates it makes the claim at most Unverified: "stated in text, not checked against data".
// The C2 and C3 reasons list each number and where it was matched.

import type { Cell, Paper, Sentence } from "./paper.js";

export type CheckResult = "passed" | "failed" | "not applicable";
export type Label = "supported" | "unsupported" | "unverified";

export interface Check {
  id: "C1" | "C2" | "C3" | "C4";
  name: string;
  result: CheckResult;
  reason: string;
  /** For a passed C2 or C3: false when some number was matched only in sentences (text), not in table cells. */
  data?: boolean;
}

export interface Comparison {
  ours: string;              // cell ID of the paper's own result
  baseline: string;          // cell ID it is compared with
  higher_is_better: boolean;
}

/** What the model submits for one claim (IDs only: the claim text is taken from the paper). */
export interface LinkInput {
  claimId: string;
  evidenceIds: string[];
  comparison?: Comparison;       // one comparison (kept for simple calls)
  comparisons?: Comparison[];    // several, one per part of a claim ("on RoBERTa, GPT-2 and GPT-3")
}

/** One piece of evidence, resolved in the paper. */
export type Evidence =
  | { kind: "sentence"; id: string; sentence: Sentence }
  | { kind: "cell"; id: string; cell: Cell }
  | { kind: "missing"; id: string };

// ---------------------------------------------------------------------------
// Looking up IDs

/** Find a sentence (S12) or a cell (T1.r2.c3) by ID. A column inside a \multicolumn finds that cell. */
export function resolveId(paper: Paper, rawId: string): Evidence {
  const id = normaliseId(rawId);
  if (/^S\d+$/.test(id)) {
    const sentence = paper.sentences.find((s) => s.id === id);
    return sentence ? { kind: "sentence", id, sentence } : { kind: "missing", id };
  }
  const m = /^(T\d+)\.r(\d+)\.c(\d+)$/.exec(id);
  if (m) {
    const table = paper.tables.find((t) => t.id === m[1]);
    const row = Number(m[2]), col = Number(m[3]);
    const cell = table?.cells.find((c) => c.row === row && c.col <= col && col < c.col + c.span);
    return cell ? { kind: "cell", id: cell.id, cell } : { kind: "missing", id };
  }
  return { kind: "missing", id };
}

/** "s12" -> "S12", "t1.R2.C3" -> "T1.r2.c3". */
export function normaliseId(id: string | number): string {
  // Models write IDs in many ways: "S12", "s12", "[S12]", "S12:", 12, "T1.R2.C3", "T1 r2 c3".
  let s = String(id).trim().replace(/^[\[("'`]+|[\])"'`.,:;]+$/g, "").trim();
  if (/^\d+$/.test(s)) s = `S${s}`;
  s = s.replace(/^(t\d+)\s*[.\s]\s*(r\d+)\s*[.\s]\s*(c\d+)$/i, "$1.$2.$3");
  if (/^s\d+$/i.test(s)) return s.toUpperCase();
  const m = /^t(\d+)\.r(\d+)\.c(\d+)$/i.exec(s);
  return m ? `T${m[1]}.r${m[2]}.c${m[3]}` : s;
}

// ---------------------------------------------------------------------------
// Numbers in a claim

export interface ClaimNumber {
  value: number;       // as written, without sign
  decimals: number;    // digits after the point, as written: 85.3 -> 1
  raw: string;         // the text, e.g. "85.3%"
  percent: boolean;    // followed by %
  bound: Bound;        // "over 90%" is at least 90; "about 2" allows 5%
  derived?: { unit: "%" | "points" | "ratio" | "" };   // set for a difference: "by 1.2 points", "12% better"
}

export type Bound = "exact" | "at least" | "at most" | "about";

const NUMBER = /[+\-−]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?|[+\-−]?\.\d+/g;
const REFERENCE_WORD = /(?:table|tab\.|tabs\.|figure|fig\.|figs\.|section|sec\.|secs\.|§|eq\.|eqs\.|eqn\.|equation|appendix|app\.|algorithm|alg\.|theorem|thm\.|lemma|corollary|proposition|definition|chapter|line|step|row|column|col\.)\s*\(?\s*$/i;
const BOUND_WORDS = "up to|about|around|approximately|roughly|nearly|almost|over|more than|at least|above|exceeding|exceeds|below|under|less than|at most|~";
const DIFFERENCE_BEFORE = new RegExp(`\\bby\\s+(${BOUND_WORDS})?\\s*$`, "i");
const DIFFERENCE_AFTER = /^\s*-?\s*(%|percentage points?|points?|pp|p\.p\.|×|x(?![a-z])|times|fold)?\s*(?:absolute\s+|relative\s+|on average\s+)?(better|higher|lower|more|less|fewer|faster|slower|improvements?|reductions?|gains?|increases?|decreases?|drops?|speed-?ups?|smaller|larger|boost|margin)\b/i;
const BOUND_BEFORE = new RegExp(`(?:^|[^a-z])(${BOUND_WORDS})\\s*$`, "i");
const UNIT_AFTER = /^\s*-?\s*(%|percentage points?|points?|pp|p\.p\.|×|x(?![a-z])|times|fold)/i;

function boundOf(word: string | undefined): Bound {
  const w = (word ?? "").toLowerCase();
  if (!w) return "exact";
  if (["over", "more than", "at least", "above", "exceeding", "exceeds"].includes(w)) return "at least";
  if (["up to", "below", "under", "less than", "at most"].includes(w)) return "at most";
  return "about";
}

/**
 * The numbers in a claim sentence that a check can test. Skipped: years (1900 to 2099),
 * references ("Table 2", "Fig. 3"), numbers inside names ("ResNet-50", "GPT-4", "7B"),
 * numbers inside [brackets] (labels such as [sec:2]), and p-values ("p < 0.05").
 * Differences ("by 1.2 points", "12% better", "+0.8", "2x faster") are marked `derived` (for C3).
 */
export function claimNumbers(text: string): ClaimNumber[] {
  const out: ClaimNumber[] = [];
  const brackets = [...text.matchAll(/\[[^\]]*\]/g)].map((m) => [m.index!, m.index! + m[0].length] as const);

  for (const m of text.matchAll(NUMBER)) {
    let raw = m[0];
    let start = m.index!;
    const sign = /^[+\-−]/.test(raw) ? raw[0] : "";
    if (sign) { raw = raw.slice(1); start += 1; }
    const end = start + raw.length;
    const before = text.slice(0, start);
    const prev = text[start - 1] ?? "";
    const prev2 = text[start - 2] ?? "";
    const next = text[end] ?? "";
    const after = text.slice(end);

    if (brackets.some(([a, b]) => start >= a && start < b)) continue;                  // [sec:2], [cite]
    if (/[A-Za-z0-9_.]/.test(prev) && !sign) continue;                                 // F1, T1, v2
    if (sign === "-" && /[A-Za-z0-9]/.test(prev2)) continue;                           // ResNet-50, 1-5 (a range)
    if (sign === "−" && /[A-Za-z0-9]/.test(prev2)) continue;
    if (/[A-Za-z]/.test(next) && !/^x(?![a-z])/i.test(after)) continue;                // 7B, 3D, 100k (but 2x is a ratio)
    if (next === "^" || prev === "^") continue;                                         // 10^-4
    if (REFERENCE_WORD.test(before)) continue;                                          // Table 2
    if (/\bp\s*[<=≤]\s*$/i.test(before)) continue;                                      // p < 0.05
    const value = Number(raw.replace(/,/g, ""));
    const decimals = raw.includes(".") ? raw.split(".")[1]!.length : 0;
    const percent = /^\s*%/.test(after);
    if (decimals === 0 && !percent && value >= 1900 && value <= 2099 && raw.length === 4) continue;   // a year

    const byMatch = DIFFERENCE_BEFORE.exec(before);
    const bound = boundOf(byMatch?.[1] ?? BOUND_BEFORE.exec(before)?.[1]);
    const n: ClaimNumber = { value, decimals, raw: raw + (percent ? "%" : ""), percent, bound };
    const differenceAfter = DIFFERENCE_AFTER.exec(after);
    const ratio = /^\s*(×|x(?![a-z])|times\b|-?\s*fold\b)/i.test(after);
    if (sign === "+" || byMatch || differenceAfter || ratio) {
      const unitText = (differenceAfter?.[1] ?? UNIT_AFTER.exec(after)?.[1] ?? (ratio ? "x" : "")).toLowerCase();
      const unit = unitText === "%" ? "%" : ["x", "×", "times", "fold"].includes(unitText) ? "ratio" : unitText ? "points" : "";
      n.derived = { unit };
    }
    out.push(n);
  }
  return out;
}

/** Does `x` fit the claim number: equal after rounding to the claim's decimals, or within its bound
 *  ("over 90" needs at least 90; "about 2" allows 5%)? */
export function fits(claim: { value: number; decimals: number; bound?: Bound }, x: number, derived = false): boolean {
  const tolerance = 0.5 * 10 ** -claim.decimals + 1e-9;
  const c = claim.value;
  switch (claim.bound ?? "exact") {
    case "at least": return x >= c - tolerance;
    case "at most": return x <= c + tolerance && (!derived || x >= 0.9 * c - tolerance);   // "up to 12% better": close to 12
    case "about": return Math.abs(x - c) <= Math.max(tolerance, 0.05 * c);
    default: return Math.abs(x - c) <= tolerance;
  }
}

/** Does a value in the paper match the claim number? A fraction also counts as a percent
 *  (0.853 matches "85.3%") and the reverse (85.3 matches "0.853"). Signs are ignored. */
export function matchesNumber(claim: { value: number; decimals: number; bound?: Bound }, value: number): boolean {
  const v = Math.abs(value);
  const candidates = [v];
  if (v <= 1 && claim.value > 1) candidates.push(v * 100);
  if (v > 1 && claim.value <= 1) candidates.push(v / 100);
  return candidates.some((x) => fits(claim, x));
}

/** Numbers in a sentence of the paper (for C2). */
function sentenceNumbers(s: Sentence): number[] {
  // The same reading as for claims: "GPT-3", "Table 2" and years are not numbers here either,
  // so a "3" in a claim cannot be matched by the 3 in "GPT-3".
  return claimNumbers(s.text).map((n) => n.value);
}

// ---------------------------------------------------------------------------
// The checks

/** Run C1 to C4 for one link. */
export function runChecks(paper: Paper, input: LinkInput): Check[] {
  const claim = paper.sentences.find((s) => s.id === normaliseId(input.claimId));
  const notes: string[] = [];

  // Evidence that cannot count is dropped with a note, and the rest is still checked:
  //  - the claim itself (a claim cannot be its own evidence);
  //  - header cells ("Batch Size", "Accuracy"): labels, not results.
  const evidenceIds = input.evidenceIds.filter((id) => {
    if (claim && normaliseId(id) === claim.id) { notes.push(`${claim.id} was cited as its own evidence; that was ignored.`); return false; }
    const e = resolveId(paper, id);
    if (e.kind === "cell" && e.cell.header) { notes.push(`${e.id} is a header cell, not a result; it was ignored.`); return false; }
    return true;
  });

  // Comparisons count only if they fit the claim (see comparisonProblem); the others are
  // ignored completely, and C4 says why.
  const given = [...(input.comparison ? [input.comparison] : []), ...(input.comparisons ?? [])];
  const usable: Comparison[] = [];
  const ignored: string[] = [];
  for (const cmp of given) {
    const problem = claim ? comparisonProblem(paper, claim.text, cmp) : undefined;
    if (problem) ignored.push(`${cmp.ours} vs ${cmp.baseline}: ${problem}`); else usable.push(cmp);
  }
  const link: LinkInput = { claimId: input.claimId, evidenceIds, comparisons: usable };
  const ids = [...evidenceIds, ...usable.flatMap((c) => [c.ours, c.baseline])];
  const evidence = dedupe(ids.map((id) => resolveId(paper, id)));

  let c1 = checkExists(link, claim, evidence);
  if (notes.length > 0) c1 = { ...c1, reason: `${c1.reason} (${notes.join(" ")})` };
  if (c1.result === "failed" || !claim) {
    const skipped = (id: Check["id"], name: string): Check =>
      ({ id, name, result: "not applicable", reason: "Skipped: C1 failed. Fix the IDs first." });
    return [c1, skipped("C2", "Number match"), skipped("C3", "Derived number"), skipped("C4", "Direction")];
  }
  const found = evidence.filter((e): e is Exclude<Evidence, { kind: "missing" }> => e.kind !== "missing");
  const numbers = claimNumbers(claim.text);
  return [c1, checkNumbers(paper, claim, numbers, found), checkDerived(paper, claim, numbers, found),
          checkDirections(paper, usable, ignored, claim.text)];
}

/** C1: the claim and every cited ID exist, and there is evidence. */
function checkExists(link: LinkInput, claim: Sentence | undefined, evidence: Evidence[]): Check {
  const c = (result: CheckResult, reason: string): Check => ({ id: "C1", name: "Exists", result, reason });
  if (!claim) return c("failed", `The claim ${link.claimId} does not exist. Use a sentence ID from review__get_section or review__find_text.`);
  if (link.evidenceIds.length === 0 && (link.comparisons ?? []).length === 0) {
    const words = SPECULATION.exec(claim.text)?.[0];
    if (words) return c("passed", `The claim is speculation ("${words}"), not a result: no evidence is needed, and code cannot check it.`);
    return c("failed", "No evidence cited. Cite table cells (T1.r2.c3) or sentences (S12), or label the claim unsupported.");
  }
  const missing = evidence.filter((e) => e.kind === "missing").map((e) => e.id);
  if (missing.length > 0) {
    const tableOnly = missing.filter((id) => /^T\d+$/i.test(id));
    const hint = tableOnly.length > 0 ? " Cite single cells (T1.r2.c3), not a whole table." : "";
    return c("failed", `These IDs do not exist: ${missing.join(", ")}.${hint} Use only IDs returned by review__get_table and review__get_section.`);
  }
  return c("passed", `${claim.id} and all ${evidence.length} cited IDs exist.`);
}

/** C2: every (non-derived) number in the claim is in the cited cells or sentences. */
function checkNumbers(paper: Paper, claim: Sentence, numbers: ClaimNumber[], evidence: Exclude<Evidence, { kind: "missing" }>[]): Check {
  const c = (result: CheckResult, reason: string): Check => ({ id: "C2", name: "Number match", result, reason });
  const plain = numbers.filter((n) => !n.derived);
  if (plain.length === 0) return c("not applicable", "The claim states no numbers to match.");

  // Where each number is matched: a cited table cell (data), only a cited sentence (text), or nowhere.
  const cells = evidence.filter((e): e is { kind: "cell"; id: string; cell: Cell } => e.kind === "cell");
  const sentences = evidence.filter((e): e is { kind: "sentence"; id: string; sentence: Sentence } => e.kind === "sentence");
  const cellNumbers = (cell: Cell) => [cell.value, cell.spread, cell.delta, ...cell.numbers].filter((v): v is number => v !== undefined);
  const places = plain.map((n) => {
    const cell = cells.find((e) => cellNumbers(e.cell).some((v) => matchesNumber(n, v)));
    if (cell) return { n, where: "cell" as const, text: `${n.raw}: table cell ${cell.id}` };
    const texts = sentences.filter((e) => sentenceNumbers(e.sentence).some((v) => matchesNumber(n, v))).map((e) => e.id);
    if (texts.length > 0) return { n, where: "text" as const, text: `${n.raw}: only in text (${texts.join(", ")})` };
    return { n, where: "none" as const, text: `${n.raw}: not found` };
  });
  const list = places.map((x) => x.text).join("; ") + ".";
  const unmatched = places.filter((x) => x.where === "none").map((x) => x.n);
  if (unmatched.length === 0) {
    if (places.every((x) => x.where === "cell")) return { ...c("passed", list), data: true };
    return { ...c("passed", `${list} Text alone cannot make a claim Supported: every number must be in a cited table cell. ` +
      "Cite the table cell that holds each number, if the paper has one."), data: false };
  }
  const pool = [...cells.flatMap((e) => cellNumbers(e.cell)), ...sentences.flatMap((e) => sentenceNumbers(e.sentence))];
  const cited = [...new Set(pool.map((v) => String(v)))].slice(0, 12).join(", ") || "none";
  return c("failed", `${unmatched.map((n) => n.raw).join(", ")} not found in the cited evidence (cited numbers: ${cited}). ` +
    `Per number: ${list} ` + whereElse(paper, claim, unmatched) +
    "Cite the cell or sentence that holds each number, or label the claim unsupported.");
}

/** C3: every stated difference recomputes from the cited evidence: a pair of cited cells, a cell's
 *  own (+x) difference, or a "from X to Y" in a cited sentence. Failing that, a cited sentence that
 *  states the same number also passes, reported as "stated" (not recomputed). */
function checkDerived(paper: Paper, claim: Sentence, numbers: ClaimNumber[], evidence: Exclude<Evidence, { kind: "missing" }>[]): Check {
  const c = (result: CheckResult, reason: string): Check => ({ id: "C3", name: "Derived number", result, reason });
  const derived = numbers.filter((n) => n.derived);
  if (derived.length === 0) return c("not applicable", "The claim states no difference or improvement.");

  const cells = evidence.filter((e): e is { kind: "cell"; id: string; cell: Cell } => e.kind === "cell");
  const sentences = evidence.filter((e): e is { kind: "sentence"; id: string; sentence: Sentence } => e.kind === "sentence");
  const values = cells.filter((e) => e.cell.value !== undefined).map((e) => ({ id: e.id, v: e.cell.value! }));
  const deltas = cells.filter((e) => e.cell.delta !== undefined).map((e) => ({ id: e.id, v: Math.abs(e.cell.delta!) }));

  const explained: string[] = [];
  const unexplained: ClaimNumber[] = [];
  let fromCells = 0;
  for (const n of derived) {
    const fromTable = findDerivation(n, values, deltas);
    const fromText = fromTable ? undefined : fromToDerivation(n, sentences.map((s) => s.sentence));
    const statedIn = fromTable || fromText ? undefined : sentences.find((s) => sentenceNumbers(s.sentence).some((v) => fits(n, v, true)));
    if (fromTable) { fromCells++; explained.push(`${n.raw} = ${fromTable}`); }
    else if (fromText) explained.push(`${n.raw} = ${fromText} (only in text)`);
    else if (statedIn) explained.push(`${n.raw} is stated in ${statedIn.id} (only in text, not recomputed from a table)`);
    else unexplained.push(n);
  }
  if (unexplained.length === 0) {
    if (fromCells === derived.length) return { ...c("passed", explained.join("; ") + "."), data: true };
    return { ...c("passed", explained.join("; ") + ". Text alone cannot make a claim Supported: every difference must be recomputed from cited table cells."),
             data: false };
  }
  const have = values.length >= 2 || deltas.length > 0
    ? `cited values: ${values.map((x) => `${x.id}=${x.v}`).join(", ") || "none"}`
    : "fewer than two cited cells hold numbers, and no cited sentence states or computes it";
  return c("failed", `${unexplained.map((n) => n.raw).join(", ")} does not follow from the cited evidence (${have}). ` +
    whereElse(paper, claim, unexplained) +
    "Cite the two cells that give this difference, or the sentence where the paper computes it, or label the claim unsupported.");
}

/** Which pair of cited values gives the stated difference? Returns a short explanation, or undefined. */
function findDerivation(n: ClaimNumber, values: { id: string; v: number }[], deltas: { id: string; v: number }[]): string | undefined {
  if (n.derived!.unit !== "ratio") for (const d of deltas) if (fits(n, d.v, true)) return `the difference stated in ${d.id}`;
  for (const a of values) for (const b of values) {
    if (a === b) continue;
    const how = pairGives(n, a.v, b.v, a.id, b.id);
    if (how) return how;
  }
  return undefined;
}

/** Does the pair (a, b) give the claim's difference: a ratio, an absolute or a relative difference? */
function pairGives(n: ClaimNumber, a: number, b: number, nameA: string, nameB: string): string | undefined {
  const ok = (x: number) => fits(n, x, true);
  const r = (x: number) => Number(x.toFixed(Math.max(n.decimals, 2)));
  const unit = n.derived!.unit;
  const diff = Math.abs(a - b);
  if (unit === "ratio") return b !== 0 && ok(a / b) ? `${nameA} / ${nameB} = ${r(a / b)}` : undefined;
  if (ok(diff)) return `|${nameA} - ${nameB}| = ${r(diff)}`;
  if (Math.abs(a) <= 1 && Math.abs(b) <= 1 && ok(diff * 100)) return `|${nameA} - ${nameB}| x 100 = ${r(diff * 100)}`;
  if (unit !== "points" && b !== 0 && ok((diff / Math.abs(b)) * 100)) {
    return `|${nameA} - ${nameB}| / ${nameB} = ${r((diff / Math.abs(b)) * 100)}% (relative)`;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// "from X to Y" in sentences: "VRAM drops from 1.2TB to 350GB" gives 3.4 times

const UNITS: Record<string, { family: string; scale: number }> = {
  tb: { family: "bytes", scale: 1e12 }, gb: { family: "bytes", scale: 1e9 }, mb: { family: "bytes", scale: 1e6 }, kb: { family: "bytes", scale: 1e3 },
  t: { family: "count", scale: 1e12 }, b: { family: "count", scale: 1e9 }, m: { family: "count", scale: 1e6 }, k: { family: "count", scale: 1e3 },
  h: { family: "time", scale: 3600 }, hours: { family: "time", scale: 3600 }, min: { family: "time", scale: 60 }, minutes: { family: "time", scale: 60 },
  s: { family: "time", scale: 1 }, sec: { family: "time", scale: 1 }, seconds: { family: "time", scale: 1 }, ms: { family: "time", scale: 1e-3 },
  "%": { family: "percent", scale: 1 }, "": { family: "plain", scale: 1 },
};
const FROM_TO = /\bfrom\s+([0-9][0-9,]*(?:\.[0-9]+)?)\s*([a-zA-Z%]*)\s+(?:down\s+|up\s+)?to\s+([0-9][0-9,]*(?:\.[0-9]+)?)\s*([a-zA-Z%]*)/gi;

/** Every "from X to Y" in a text, as two numbers in the same unit. */
export function fromToPairs(text: string): { a: number; b: number; raw: string }[] {
  const out: { a: number; b: number; raw: string }[] = [];
  for (const m of text.matchAll(FROM_TO)) {
    const ua = UNITS[m[2]!.toLowerCase()] ?? (m[2] ? undefined : UNITS[""]);
    const ub = UNITS[m[4]!.toLowerCase()] ?? (m[4] ? undefined : UNITS[""]);
    if (!ua || !ub) continue;                                                    // a word, not a unit
    const unitA = m[2] ? ua : ub, unitB = m[4] ? ub : ua;                         // "from 1.2 to 0.4TB"
    if (unitA.family !== unitB.family) continue;
    out.push({ a: Number(m[1]!.replace(/,/g, "")) * unitA.scale, b: Number(m[3]!.replace(/,/g, "")) * unitB.scale, raw: m[0] });
  }
  return out;
}

/** Does a cited sentence's "from X to Y" give the claim's difference (either way round)? */
function fromToDerivation(n: ClaimNumber, sentences: Sentence[]): string | undefined {
  for (const s of sentences) for (const p of fromToPairs(s.text)) {
    const how = pairGives(n, p.a, p.b, "from", "to") ?? pairGives(n, p.b, p.a, "to", "from");
    if (how) return `recomputed from ${s.id} ("${p.raw}"): ${how}`;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Where else in the paper a missing number appears (a hint for the model; not evidence)

/** "3 may be in S88, T4.r3.c2. " for each missing number, or "" if it is nowhere else. */
function whereElse(paper: Paper, claim: Sentence, missing: ClaimNumber[]): string {
  const hints: string[] = [];
  for (const n of missing) {
    // Table cells first: only table data can make a claim Supported (rule R2).
    const cells: string[] = [];
    if (!n.derived) {
      for (const t of paper.tables) for (const cell of t.cells) {
        if (cells.length >= 4) break;
        if (!cell.header && [cell.value, ...cell.numbers].some((v) => v !== undefined && matchesNumber(n, v))) cells.push(cell.id);
      }
    }
    const texts: string[] = [];
    for (const s of paper.sentences) {
      if (texts.length >= 3) break;
      if (s.id === claim.id) continue;
      const hit = n.derived
        ? fromToDerivation(n, [s]) !== undefined || sentenceNumbers(s).some((v) => fits(n, v, true))
        : sentenceNumbers(s).some((v) => matchesNumber(n, v));
      if (hit) texts.push(s.id);
    }
    if (cells.length > 0) hints.push(`${n.raw} may be in ${cells.join(", ")}${texts.length > 0 ? ` (also stated in text: ${texts.join(", ")})` : ""}`);
    else if (texts.length > 0) hints.push(`${n.raw} is found only in text (${texts.join(", ")}); text alone cannot make a claim Supported`);
  }
  return hints.length > 0 ? `Elsewhere in the paper: ${hints.join("; ")}. Read them (review__get_section accepts sentence IDs, review__get_table the table) and cite the right one. ` : "";
}

/** C4 for every usable comparison: all must pass. */
function checkDirections(paper: Paper, usable: Comparison[], ignored: string[], claimText: string): Check {
  const c = (result: CheckResult, reason: string): Check => ({ id: "C4", name: "Direction", result, reason });
  const ignoredNote = ignored.length > 0 ? ` Ignored: ${ignored.join(" ")}` : "";
  if (usable.length === 0) {
    return c("not applicable", ignored.length > 0 ? ignored.join(" ") : "No comparison given.");
  }
  const results = usable.map((cmp) => checkDirection(paper, cmp, claimText));
  const failed = results.filter((r) => r.result === "failed");
  const reasons = results.map((r) => r.reason).join(" ");
  const scope = usable.length > 1 ? `${usable.length} comparisons checked. ` : "";
  return c(failed.length > 0 ? "failed" : "passed", scope + reasons + ignoredNote);
}

/** Words that make a sentence a comparison ("outperforms", "better", "lower", "than"...). */
const COMPARISON_WORDS = /\b(on[- ]par|comparable|competitive|matches|as good as|outperform\w*|surpass\w*|exceed\w*|beat|beats|beating|better|worse|best|higher|lower|greater|smaller|larger|fewer|faster|slower|more|less|than|improv\w*|reduc\w*|increas\w*|decreas\w*|superior|inferior|gains?|drops?|state[- ]of[- ]the[- ]art|sota|compared|versus|vs\.?)\b/i;

/** Words that claim equality rather than superiority. "On par" allows this relative gap. */
const ON_PAR_WORDS = /\b(on[- ]par|comparable|competitive|similar|matches|matching|close to|as good as|equivalent|no (?:loss|drop|degradation))\b/i;
const ON_PAR_TOLERANCE = 0.01;

/** Does the claim sentence compare something? */
export function makesComparison(text: string): boolean {
  return COMPARISON_WORDS.test(text);
}

/** Words in a column label that mean "lower is better". */
const LOWER_IS_BETTER = /↓|\b(error|errors|err|loss|mae|mse|rmse|perplexity|ppl|fid|wer|cer|nll|bpd|latency|lower is better)\b/i;
const HIGHER_IS_BETTER = /↑|\bhigher is better\b/i;

/**
 * Why a comparison does not fit the claim, or undefined if it fits. A comparison is ignored when
 *   - the claim sentence compares nothing ("we propose ..."),
 *   - ours or baseline is not a table cell ID,
 *   - the claim does not name the baseline (its row label shares no word with the claim).
 * Without these rules, any two cells in the right order would make any sentence "supported".
 * (Missing cell IDs are not a reason to ignore: C1 reports them.)
 */
export function comparisonProblem(paper: Paper, claimText: string, comparison: Comparison): string | undefined {
  if (!makesComparison(claimText)) {
    return "The claim makes no comparison, so the comparison was ignored. Cite evidence for what the claim actually states, or label it unverified.";
  }
  const notCells = [comparison.ours, comparison.baseline].filter((id) => !/^T\d+\.r\d+\.c\d+$/.test(normaliseId(id)));
  if (notCells.length > 0) {
    return `The comparison must name two table cells (T1.r2.c3), not ${notCells.join(", ")}, so it was ignored.`;
  }
  const ours = resolveId(paper, comparison.ours);
  const base = resolveId(paper, comparison.baseline);
  if (ours.kind !== "cell" || base.kind !== "cell") return undefined;           // C1 reports the missing ID
  if (ours.cell.header || base.cell.header) {
    return `${ours.cell.header ? ours.id : base.id} is a header cell, not a result, so the comparison was ignored. Compare two result cells.`;
  }
  // The baseline must be the method the claim names: the words that tell its row apart from
  // ours (e.g. "FT" for fine-tuning, "Adapter") must appear in the claim.
  const claimWords = words(claimText);
  const oursAll = words(ours.cell.rowLabel), baseAll = words(base.cell.rowLabel);
  const distinct = (a: Set<string>, b: Set<string>) => { const d = [...a].filter((w) => !b.has(w)); return d.length > 0 ? d : [...a]; };
  const baseDistinct = distinct(baseAll, oursAll);
  if (baseDistinct.length > 0 && !baseDistinct.some((w) => claimWords.has(w))) {
    return `The claim does not name the baseline "${base.cell.rowLabel}", so the comparison was ignored. ` +
      "Compare with the row of the method the claim names.";
  }
  // "Ours" must be the method the claim is about. Claims often say "it" or "our method", so this
  // only fails when the claim names another method of the same table that is not in ours' row.
  const table = paper.tables.find((x) => ours.id.startsWith(`${x.id}.`));
  const tableWords = new Set(table?.cells.filter((x) => !x.header).flatMap((x) => [...words(x.rowLabel)]) ?? []);
  const claimMethods = [...claimWords].filter((w) => tableWords.has(w) && !baseAll.has(w));
  if (claimMethods.length > 0 && !claimMethods.some((w) => oursAll.has(w))) {
    return `The claim is about ${claimMethods.join(", ")}, but the row given as ours is "${ours.cell.rowLabel}", so the comparison was ignored. ` +
      "Use the row of the method the claim is about.";
  }
  return undefined;
}

/** The words of a label or claim, for matching names: lower case, plurals and "fine-tuned" -> "ft",
 *  without numbers, sizes (0.8M) and generic words. */
function words(text: string): Set<string> {
  const generic = new Set(["model", "models", "method", "methods", "our", "ours", "the", "and", "with", "of", "base",
    "large", "small", "medium", "baseline", "baselines", "full", "default", "setting", "results", "result"]);
  return new Set(text.toLowerCase()
    .replace(/fine[- ]?tun\w*/g, " ft ")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 2 && !generic.has(w) && !/^\d+(\.\d+)?[kmbt]?$/.test(w))
    .map((w) => (w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w)));
}

/** Words that mark speculation rather than a result. */
const SPECULATION = /\b(we believe|we hope|we expect|we conjecture|we speculate|suggests?|may|might|could|future works?|potentially)\b/i;

/** C4 for one comparison: ours and baseline are in the stated order, and the direction fits the metric. */
function checkDirection(paper: Paper, comparison: Comparison, claimText: string): Check {
  const c = (result: CheckResult, reason: string): Check => ({ id: "C4", name: "Direction", result, reason });
  const ours = resolveId(paper, comparison.ours);
  const base = resolveId(paper, comparison.baseline);
  if (ours.kind !== "cell" || base.kind !== "cell") return c("failed", "The comparison must name two table cells (ours and baseline).");
  if (ours.id === base.id) return c("failed", "ours and baseline are the same cell. Name the baseline's cell.");
  if (ours.cell.value === undefined || base.cell.value === undefined) {
    return c("failed", `${ours.cell.value === undefined ? ours.id : base.id} holds no number. Compare cells that hold numbers.`);
  }
  if (ours.cell.colLabel && base.cell.colLabel && ours.cell.colLabel !== base.cell.colLabel) {
    return c("failed", `The cells are in different columns ("${ours.cell.colLabel}" vs "${base.cell.colLabel}"). Compare the same metric.`);
  }
  const metric = ours.cell.colLabel || "this column";
  if (comparison.higher_is_better && LOWER_IS_BETTER.test(ours.cell.colLabel)) {
    return c("failed", `"${metric}" looks like a metric where lower is better, but higher_is_better is true. Check the metric's direction.`);
  }
  if (!comparison.higher_is_better && HIGHER_IS_BETTER.test(ours.cell.colLabel)) {
    return c("failed", `"${metric}" is marked higher-is-better (↑), but higher_is_better is false. Check the metric's direction.`);
  }
  const a = ours.cell.value, b = base.cell.value;
  const better = comparison.higher_is_better ? a > b : a < b;
  const word = comparison.higher_is_better ? "higher" : "lower";
  if (better) return c("passed", `${ours.id} (${a}) is ${word} than ${base.id} (${b}).`);
  // "on par", "comparable", "competitive": within 1% of the baseline also counts.
  if (ON_PAR_WORDS.test(claimText)) {
    const gap = Math.abs(a - b) / Math.max(Math.abs(b), 1e-12);
    if (gap <= ON_PAR_TOLERANCE) {
      return c("passed", `The claim says on par: ${ours.id} (${a}) is within ${(ON_PAR_TOLERANCE * 100).toFixed(0)}% of ${base.id} (${b}) (gap ${(gap * 100).toFixed(2)}%).`);
    }
    return c("failed", `The claim says on par, but ${ours.id} (${a}) is ${(gap * 100).toFixed(1)}% away from ${base.id} (${b}), more than ${(ON_PAR_TOLERANCE * 100).toFixed(0)}%.`);
  }
  if (a === b) return c("failed", `${ours.id} and ${base.id} are equal (${a}): a tie, not an improvement.`);
  return c("failed", `${ours.id} (${a}) is not ${word} than ${base.id} (${b}). The cited cells do not support the comparison.`);
}

/**
 * The final label:
 *   unsupported  if any check failed (including no evidence or wrong IDs)
 *   unverified   if some number of the claim is matched only in text (a passed C2 or C3 with
 *                data: false; rule R1), or C1 passed but C2, C3 and C4 do not apply
 *   supported    otherwise, if C2, C3 or C4 passed (and nothing failed)
 */
export function finalLabel(checks: Check[]): Label {
  if (checks.some((c) => c.result === "failed")) return "unsupported";
  if (checks.some((c) => c.result === "passed" && c.data === false)) return "unverified";
  if (checks.some((c) => c.id !== "C1" && c.result === "passed")) return "supported";
  return "unverified";
}

function dedupe(evidence: Evidence[]): Evidence[] {
  const seen = new Set<string>();
  return evidence.filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)));
}
