// plant.ts - makes the benchmark versions of a paper: a clean copy and copies with one planted fault.
//
// How a fault is planted, without knowing where in the LaTeX a cell or sentence comes from:
// every place where the number (or phrase) appears in the .tex files is tried in turn. After each
// try the paper is parsed again with the same reader the tools use (readLatexPaper), and the edit
// is kept only if exactly the intended thing changed: the target cell (or claim sentence) and
// nothing else. So the parser is the judge of every edit, and a version is never wrong silently:
// if no edit passes, the version is marked valid: false with the reason.

import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Cell, Paper } from "../../packages/cli/src/review/paper.ts";
import { parseCellNumber, readLatexPaper } from "../../packages/cli/src/review/parser.ts";
import { claimNumbers, makesComparison, normaliseId, type Comparison } from "../../packages/cli/src/review/checks.ts";

export type Fault = "clean" | "F1" | "F2" | "F3" | "F4" | "F5";
export const FAULTS: Fault[] = ["clean", "F1", "F2", "F3", "F4"];

/** One confirmed target claim (from evals/targets.json). */
export interface Target {
  paperId: string;
  targetId: string;                  // the claim's sentence ID in the clean full review, e.g. "S5"
  claimText: string;                 // exact sentence text, as the parser gives it
  evidenceIds: string[];
  comparisons: Comparison[];
  cells?: Record<string, { text: string; value?: number; rowLabel?: string; colLabel?: string }>;
  primaryCell?: string;              // the evidence cell F1 and F4 change (optional; else chosen from evidenceIds)
  confirmed: boolean;
  selection?: string;                // how the target was chosen, e.g. "human-confirmed, blind to tool labels"
}

export interface Change { file: string; old: string; new: string }

/** One line of evals/versions/manifest.json. */
export interface VersionEntry {
  versionId: string;
  paperId: string;
  targetId: string;
  fault: Fault;
  expected: "supported" | "unsupported";
  claimText: string;                 // the claim as it appears in this version
  changes: Change[];
  valid: boolean;
  reason?: string;                   // why the version is not valid
  cell?: string;                     // the cell(s) changed: F1 and F4 the cited cell and its twins, F3 the pair
  cells?: { id: string; old: string; new: string }[];   // every changed cell, with its text before and after
  selection?: string;                // copied from the target
}

const norm = (s: string) => s.replace(/\s+/g, " ").trim();
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ---------------------------------------------------------------------------
// The whole step: one version

/** Make one version of a target in `outDir/src`, and say whether it is valid. */
export async function plantVersion(srcDir: string, target: Target, fault: Fault, outDir: string): Promise<VersionEntry> {
  const versionId = `${target.paperId}__${target.targetId}__${fault}`;
  const entry: VersionEntry = {
    versionId, paperId: target.paperId, targetId: target.targetId, fault,
    expected: fault === "clean" ? "supported" : "unsupported",
    claimText: target.claimText, changes: [], valid: false,
    ...(target.selection && { selection: target.selection }),
  };
  const out = path.join(outDir, "src");
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  await cp(srcDir, out, { recursive: true, filter: (f) => !/claim-map\.(json|md)$/.test(f) });

  const fail = async (reason: string) => { entry.valid = false; entry.reason = reason; return entry; };
  const original = await readLatexPaper(out);
  const claimIndex = original.sentences.findIndex((s) => norm(s.text) === norm(target.claimText));
  if (claimIndex === -1) return fail("the claim sentence is not in the paper (by its text)");

  try {
    switch (fault) {
      case "clean": break;
      case "F1":
      case "F4": {
        // The fault goes into every table cell with the same number and the same column label (the
        // same result is often in two tables, e.g. the main table's AVG and the ablation's "full
        // model" AVG); otherwise the paper's data would still support the claim. A cell in another
        // column that holds the same number by chance is left alone.
        const cell = primaryCell(original, target);
        if (!cell) return fail("no cited evidence cell with a number");
        const token = numberToken(cell);
        if (!token) return fail(`cell ${cell.id} has no plain number to ${fault === "F1" ? "change" : "remove"}`);
        const replacement = fault === "F1" ? changedNumber(token, worseDirection(cell.id, target)) : "--";
        const twins = original.tables.flatMap((t) => t.cells)
          .filter((c) => c.id !== cell.id && !c.header && c.value === cell.value && sameColumn(c, cell));
        let current = original;
        for (const c of [cell, ...twins]) {
          const tok = numberToken(cellById(current, c.id)!);
          if (!tok) return fail(`cell ${c.id} has no plain number to change`);
          const change = await editCell(out, current, cellById(current, c.id)!, tok, replacement, fault === "F4");
          if (!change) return fail(`no edit of "${tok}" changes only cell ${c.id}`);
          entry.changes.push(change);
          current = await readLatexPaper(out);
        }
        entry.cell = [cell, ...twins].map((c) => c.id).join(", ");
        entry.cells = [cell, ...twins].map((c) => ({ id: c.id, old: c.text, new: cellById(current, c.id)?.text ?? "" }));
        break;
      }
      case "F3": {
        const cmp = target.comparisons[0];
        if (!cmp) return fail("F3 needs a comparison claim");
        const ours = cellById(original, cmp.ours), base = cellById(original, cmp.baseline);
        if (!ours || !base) return fail("the comparison cells are not in the paper");
        const a = numberToken(ours), b = numberToken(base);
        if (!a || !b) return fail("a comparison cell has no plain number");
        if (Number(a.replace(/,/g, "")) === Number(b.replace(/,/g, ""))) return fail("ours and baseline have the same value");
        const first = await editCell(out, original, ours, a, b, false);
        if (!first) return fail(`no edit puts ${b} into ${ours.id} alone`);
        const middle = await readLatexPaper(out);
        const second = await editCell(out, middle, cellById(middle, base.id)!, b, a, false);
        if (!second) return fail(`no edit puts ${a} into ${base.id} alone`);
        entry.changes.push(first, second);
        entry.cell = `${ours.id} <-> ${base.id}`;
        const swapped = await readLatexPaper(out);
        entry.cells = [ours, base].map((c) => ({ id: c.id, old: c.text, new: cellById(swapped, c.id)?.text ?? "" }));
        break;
      }
      case "F2": {
        const n = claimNumbers(target.claimText)[0];
        if (!n) return fail("the claim has no number to change");
        const token = tokenInText(target.claimText, n.raw.replace(/%$/, ""));
        if (!token) return fail(`"${n.raw}" not found in the claim text`);
        const replacement = changedNumber(token, 1);
        const newText = replaceToken(target.claimText, token, replacement);
        const change = await editSentence(out, original, claimIndex, token, replacement, newText);
        if (!change) return fail(`no edit of "${token}" changes only the claim sentence`);
        entry.changes.push(change);
        entry.claimText = newText;
        break;
      }
      case "F5": {
        const inflated = inflate(target.claimText);
        if (!inflated) return fail("the claim has no 'comparable / on par / competitive' wording");
        const cmp = target.comparisons[0];
        if (!cmp) return fail("F5 needs a comparison claim to know whether ours is clearly better");
        const ours = cellById(original, cmp.ours)?.value, base = cellById(original, cmp.baseline)?.value;
        if (ours === undefined || base === undefined) return fail("the comparison cells hold no numbers");
        const clearlyBetter = cmp.higher_is_better ? ours > base * 1.01 : ours < base * 0.99;
        if (clearlyBetter) return fail("ours is clearly better, so the stronger wording would be true");
        const change = await editSentence(out, original, claimIndex, inflated.old, inflated.new, inflated.text);
        if (!change) return fail(`no edit of "${inflated.old}" changes only the claim sentence`);
        entry.changes.push(change);
        entry.claimText = inflated.text;
        break;
      }
    }
  } catch (err) {
    return fail(`error while planting: ${(err as Error).message}`);
  }

  // Validity, checked on the finished version (spec: the claim is found by its text; for F1 and
  // F4 the original number is no longer in the cited cell).
  const final = await readLatexPaper(out);
  if (!final.sentences.some((s) => norm(s.text) === norm(entry.claimText))) return fail("after planting, the claim is not found by its text");
  if ((fault === "F1" || fault === "F4") && entry.cell) {
    // The old number must be in no cell with the same column label (not only the cited one).
    const first = entry.cell.split(", ")[0]!;
    const before = cellById(original, first)!;
    const old = before.value;
    if (!cellById(final, first)) return fail(`after planting, cell ${first} is gone`);
    const still = final.tables.flatMap((t) => t.cells)
      .filter((c) => !c.header && sameColumn(c, before) && old !== undefined && (c.value === old || c.numbers.includes(old)));
    if (still.length > 0) return fail(`after planting, ${old} is still in table cell ${still.map((c) => c.id).join(", ")} (column "${before.colLabel}")`);
  }
  entry.valid = true;
  return entry;
}

// ---------------------------------------------------------------------------
// Choosing what to change

/** The evidence cell F1 and F4 change: the target's primaryCell if set, otherwise the first cited
 *  cell whose number appears in the claim, otherwise the "ours" cell of the first comparison,
 *  otherwise the first cited cell with a number. */
export function primaryCell(paper: Paper, target: Target): Cell | undefined {
  if (target.primaryCell) return cellById(paper, target.primaryCell);
  const cited = target.evidenceIds.map((id) => cellById(paper, id)).filter((c): c is Cell => c?.value !== undefined);
  const numbers = claimNumbers(target.claimText).map((n) => n.value);
  return cited.find((c) => numbers.some((v) => Math.abs(v - c.value!) <= 0.5 || Math.abs(v - c.value! * 100) <= 0.5))
      ?? (target.comparisons[0] ? cellById(paper, target.comparisons[0].ours) : undefined)
      ?? cited[0];
}

/** For F1: change the cell in the direction that breaks the claim: make "ours" worse, or the baseline better. */
function worseDirection(cellId: string, target: Target): 1 | -1 {
  for (const c of target.comparisons) {
    if (normaliseId(c.ours) === cellId) return c.higher_is_better ? -1 : 1;
    if (normaliseId(c.baseline) === cellId) return c.higher_is_better ? 1 : -1;
  }
  return -1;
}

/** Same column label ("AVG", "Accuracy (%) / CIFAR-10"), compared without case and spaces. */
function sameColumn(a: Cell, b: Cell): boolean {
  const k = (c: Cell) => c.colLabel.toLowerCase().replace(/\s+/g, " ").trim();
  return k(a) === k(b);
}

export function cellById(paper: Paper, id: string): Cell | undefined {
  const want = normaliseId(id);
  for (const t of paper.tables) for (const c of t.cells) if (c.id === want) return c;
  return undefined;
}

/** The cell's main number as written in the cleaned text, e.g. "73.4" in "73.4 ± 0.5". */
function numberToken(cell: Cell): string | undefined {
  if (cell.value === undefined) return undefined;
  const m = /[0-9][0-9,]*(?:\.[0-9]+)?|\.[0-9]+/.exec(cell.text.replace(/[−–]/g, "-"));
  return m?.[0];
}

/** The number as written in a text (e.g. "10,000" in a claim). */
function tokenInText(text: string, raw: string): string | undefined {
  return new RegExp(`(?<![0-9.])${escape(raw)}(?![0-9])`).test(text) ? raw : undefined;
}

function replaceToken(text: string, token: string, replacement: string): string {
  return text.replace(new RegExp(`(?<![0-9.])${escape(token)}(?![0-9])`), replacement);
}

/**
 * A different number in the same format (same decimals, same thousands commas), at least 15% away,
 * so that it no longer matches after rounding, and an "on par" comparison (1%) breaks too.
 */
export function changedNumber(token: string, direction: 1 | -1): string {
  const comma = token.includes(",");
  const v = Number(token.replace(/,/g, ""));
  const decimals = (token.split(".")[1] ?? "").length;
  const format = (x: number) => {
    const s = Math.abs(x).toFixed(decimals);
    const out = comma ? Number(s).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : s;
    return token.startsWith(".") && out.startsWith("0.") ? out.slice(1) : out;
  };
  if (v === 0) return format(direction > 0 ? 1 : 1);
  for (let k = 0.15; k < 5; k += 0.1) {
    const x = v * (1 + direction * k);
    if (direction < 0 && x <= 0) break;
    const out = format(x);
    if (out !== token && Math.abs(Number(out.replace(/,/g, "")) - v) >= 0.1 * Math.abs(v)) return out;
  }
  return format(v * 2);                                    // fallback: double it
}

/** For F5: the claim with "comparable / on par / competitive" made into a superiority claim. */
export function inflate(text: string): { old: string; new: string; text: string } | undefined {
  const rules: [RegExp, string][] = [
    [/on[- ]par or better than/i, "significantly better than"],
    [/on[- ]par with/i, "significantly better than"],
    [/comparable or better than/i, "significantly better than"],
    [/comparable (?:performance )?(?:to|with)/i, "significantly better performance than"],
    [/competitive with/i, "significantly better than"],
  ];
  for (const [rule, replacement] of rules) {
    const m = rule.exec(text);
    if (m) return { old: m[0], new: replacement, text: text.replace(m[0], replacement) };
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Editing the source and judging each edit with the parser

interface Snapshot { sentences: string[]; cells: Map<string, string> }

function snapshot(p: Paper): Snapshot {
  return {
    sentences: p.sentences.map((s) => norm(s.text)),
    cells: new Map(p.tables.flatMap((t) => t.cells.map((c) => [c.id, c.text] as const))),
  };
}

/** Change one cell. `wholeCell`: also remove a "± spread" written after the number (for F4). */
async function editCell(srcDir: string, before: Paper, cell: Cell, token: string, replacement: string,
                        wholeCell: boolean): Promise<Change | undefined> {
  const was = snapshot(before);
  // For F4 the "± spread" after the number goes too ("85.3} $\pm$ 0.2" -> "--}"): closing braces
  // between them are kept, so the LaTeX stays balanced.
  const pattern = wholeCell
    ? `(?<![0-9.])${escape(token)}(?![0-9])(\\}*)(?:\\s*\\$?\\s*(?:\\\\pm|±)\\s*\\$?\\s*\\.?[0-9]+(?:\\.[0-9]+)?\\s*\\$?|\\$?_\\{\\s*\\\\pm\\s*\\.?[0-9]+(?:\\.[0-9]+)?\\s*\\}\\$?)?`
    : `(?<![0-9.])${escape(token)}(?![0-9])`;
  const make = wholeCell ? (m: RegExpMatchArray) => replacement + (m[1] ?? "") : () => replacement;
  return tryEdits(srcDir, pattern, make, (after) => {
    const now = snapshot(after);
    if (now.sentences.join("\n") !== was.sentences.join("\n")) return false;
    for (const [id, text] of was.cells) if (id !== cell.id && now.cells.get(id) !== text) return false;
    const changed = after.tables.flatMap((t) => t.cells).find((c) => c.id === cell.id);
    if (!changed) return false;
    if (replacement === "--") return changed.value === undefined && !changed.numbers.includes(cell.value!);
    return changed.value === parseCellNumber(replacement).value;
  });
}

/** Change one sentence (the claim) into `newText`, nothing else. */
async function editSentence(srcDir: string, before: Paper, index: number, oldText: string, replacement: string,
                            newText: string): Promise<Change | undefined> {
  const was = snapshot(before);
  const pattern = /^[0-9.,]+$/.test(oldText) ? `(?<![0-9.])${escape(oldText)}(?![0-9])` : escape(oldText);
  return tryEdits(srcDir, pattern, () => replacement, (after) => {
    const now = snapshot(after);
    if (now.sentences.length !== was.sentences.length) return false;
    for (let i = 0; i < was.sentences.length; i++) {
      if (i === index ? now.sentences[i] !== norm(newText) : now.sentences[i] !== was.sentences[i]) return false;
    }
    for (const [id, text] of was.cells) if (now.cells.get(id) !== text) return false;
    return true;
  });
}

/** Try the replacement at every match in every .tex file; keep the first that `accept`s. */
async function tryEdits(srcDir: string, pattern: string, replacement: (m: RegExpMatchArray) => string,
                        accept: (paper: Paper) => boolean): Promise<Change | undefined> {
  for (const file of await texFiles(srcDir)) {
    const original = await readFile(file, "utf8");
    for (const m of original.matchAll(new RegExp(pattern, "g"))) {
      const text = replacement(m);
      const edited = original.slice(0, m.index) + text + original.slice(m.index! + m[0].length);
      await writeFile(file, edited, "utf8");
      let ok = false;
      try { ok = accept(await readLatexPaper(srcDir)); } catch { ok = false; }
      if (ok) return { file: path.relative(srcDir, file), old: m[0], new: text };
      await writeFile(file, original, "utf8");                // undo, try the next place
    }
  }
  return undefined;
}

async function texFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await texFiles(full));
    else if (entry.name.toLowerCase().endsWith(".tex")) out.push(full);
  }
  return out.sort();
}

/** True if the claim makes a comparison (F3 and F5 need one). Re-exported for propose-targets. */
export { makesComparison };
