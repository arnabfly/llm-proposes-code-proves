// parser.ts - reads an arXiv LaTeX source folder into a Paper (see paper.ts).
//
// Plain functions, no model calls. The steps, in order:
//   1. find the main .tex file (the one with \begin{document})
//   2. remove comments, merge \input / \include / \subfile files
//   3. split the document into the abstract, sections and subsections
//   4. take the tables out (T1, T2, ...), number their cells (T1.r2.c3)
//   5. turn the remaining text into plain sentences (S1, S2, ...)
//
// LaTeX is a programming language, so no reader understands all of it. This one
// handles what ML papers on arXiv normally contain, and reports what it skipped
// in paper.warnings. Anything it does not recognise is dropped, never guessed.

import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { Cell, Paper, Section, Sentence, Table } from "./paper.js";

// ---------------------------------------------------------------------------
// 1 and 2. Files

/** Read a LaTeX paper from a folder (or from its main .tex file). */
export async function readLatexPaper(input: string): Promise<Paper> {
  const target = path.resolve(input);
  const info = await stat(target).catch(() => undefined);
  if (!info) throw new Error(`Not found: ${target}`);

  const root = info.isDirectory() ? target : path.dirname(target);
  const mainFile = info.isDirectory() ? await findMainTex(root) : target;
  const warnings: string[] = [];
  const text = await expandInputs(stripComments(await readFile(mainFile, "utf8")), root, warnings, 0, new Set([mainFile]));
  return parseLatex(text, { source: target, mainFile: path.relative(root, mainFile) || path.basename(mainFile), warnings });
}

/** The main file is the .tex file with \begin{document}. If several have it, prefer
 *  one with \documentclass, then a usual name (main.tex, paper.tex...), then the largest. */
async function findMainTex(root: string): Promise<string> {
  const files = await listTexFiles(root, 0);
  const candidates: { file: string; score: number; size: number }[] = [];
  for (const file of files) {
    const text = stripComments(await readFile(file, "utf8"));
    if (!/\\begin\s*\{document\}/.test(text)) continue;
    const usualName = /^(main|paper|ms|article|manuscript)\.tex$/i.test(path.basename(file));
    candidates.push({ file, score: (/\\documentclass/.test(text) ? 2 : 0) + (usualName ? 1 : 0), size: text.length });
  }
  if (candidates.length === 0) throw new Error(`No .tex file with \\begin{document} in ${root}.`);
  candidates.sort((a, b) => b.score - a.score || b.size - a.size);
  return candidates[0]!.file;
}

async function listTexFiles(dir: string, depth: number): Promise<string[]> {
  if (depth > 4) return [];
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await listTexFiles(full, depth + 1));
    else if (entry.name.toLowerCase().endsWith(".tex")) out.push(full);
  }
  return out;
}

/**
 * Remove comments: % to the end of the line (but not \%), the comment environment,
 * and \iffalse ... \fi blocks. Like LaTeX, a comment also removes the line break
 * and the next line's leading spaces, so a commented-out line never makes a blank line.
 */
export function stripComments(text: string): string {
  const lines = text.split(/\r?\n/);
  let out = "";
  let join = false;                                   // the previous line ended in a comment
  for (let line of lines) {
    if (join) line = line.replace(/^[ \t]+/, "");
    const cut = commentStart(line);
    if (cut === -1) { out += line + "\n"; join = false; }
    else { out += line.slice(0, cut); join = true; }
  }
  return out
    .replace(/\\begin\s*\{comment\}[\s\S]*?\\end\s*\{comment\}/g, "")
    .replace(/\\iffalse\b[\s\S]*?\\fi\b/g, "");
}

/** Position of the first % that starts a comment (not preceded by an odd number of \), or -1. */
function commentStart(line: string): number {
  for (let i = 0; i < line.length; i++) {
    if (line[i] !== "%") continue;
    let slashes = 0;
    for (let j = i - 1; j >= 0 && line[j] === "\\"; j--) slashes++;
    if (slashes % 2 === 0) return i;
  }
  return -1;
}

/** Replace \input{x}, \include{x} and \subfile{x} with the file's text (comments removed). */
async function expandInputs(text: string, root: string, warnings: string[], depth: number,
                            seen: Set<string>): Promise<string> {
  const pattern = /\\(input|include|subfile)(?![a-zA-Z@])\s*(?:\{([^{}]+)\}|([^\s{}\\]+))/g;
  let out = "";
  let last = 0;
  for (const m of text.matchAll(pattern)) {
    out += text.slice(last, m.index);
    last = m.index! + m[0].length;
    const name = (m[2] ?? m[3] ?? "").trim();
    const file = await findInputFile(root, name);
    if (!file) { warnings.push(`Could not find \\${m[1]}{${name}}.`); continue; }
    if (seen.has(file) || depth > 10) { warnings.push(`Skipped \\${m[1]}{${name}} (included in a loop).`); continue; }
    const inner = stripComments(await readFile(file, "utf8"));
    out += "\n" + await expandInputs(inner, root, warnings, depth + 1, new Set([...seen, file])) + "\n";
  }
  return out + text.slice(last);
}

/** LaTeX looks for input files relative to the main file's folder, adding .tex if needed. */
async function findInputFile(root: string, name: string): Promise<string | undefined> {
  for (const candidate of [name, `${name}.tex`]) {
    const full = path.resolve(root, candidate);
    const info = await stat(full).catch(() => undefined);
    if (info?.isFile()) return full;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// 3 to 5. From LaTeX text to a Paper

interface Chunk { section: Section; text: string }

interface RawTable { id: string; caption: string; label?: string; section: string; body: string }

/** Parse the merged LaTeX text (comments already removed). Exported for tests. */
export function parseLatex(text: string, meta: { source: string; mainFile?: string; warnings?: string[] }): Paper {
  const warnings = meta.warnings ?? [];
  const macros = collectMacros(text);
  const ctx: Ctx = { macros, labels: new Map() };

  // The document body; the preamble holds only the title and the macro definitions.
  const begin = text.search(/\\begin\s*\{document\}/);
  const end = text.search(/\\end\s*\{document\}/);
  const preamble = begin === -1 ? "" : text.slice(0, begin);
  let body = begin === -1 ? text : text.slice(begin, end === -1 ? undefined : end).replace(/^\\begin\s*\{document\}/, "");
  body = removeDefinitions(body);

  const titleRaw = readCommandArg(preamble, "title") ?? readCommandArg(body, "title") ?? "";
  const title = toText(titleRaw, ctx);   // \thanks{...} is dropped

  // The abstract is its own section, whatever its place in the file.
  let abstractRaw = "";
  const abs = findEnvironment(body, "abstract", 0);
  if (abs) {
    abstractRaw = body.slice(abs.innerStart, abs.innerEnd);
    body = body.slice(0, abs.start) + body.slice(abs.end);
  } else {
    warnings.push("No abstract environment found.");
  }

  const chunks = splitSections(body, ctx);
  if (abstractRaw.trim()) {
    chunks.unshift({ section: { id: "abstract", name: "Abstract", level: 0, appendix: false }, text: abstractRaw });
  }

  // Tables first (in document order), so that \ref{tab:x} in the text can name T1, T2...
  const rawTables: RawTable[] = [];
  for (const chunk of chunks) chunk.text = extractTables(chunk.text, chunk.section.id, rawTables);
  for (const t of rawTables) if (t.label && !ctx.labels.has(t.label)) ctx.labels.set(t.label, t.id);
  const tables = rawTables.map((t) => parseTabular(t, ctx));

  // Then the sentences.
  const sentences: Sentence[] = [];
  const sections: Section[] = [];
  for (const chunk of chunks) {
    const texts = chunkToSentences(chunk.text, ctx);
    for (const s of texts) sentences.push({ id: `S${sentences.length + 1}`, section: chunk.section.id, text: s });
    const hasTables = tables.some((t) => t.section === chunk.section.id);
    if (chunk.section.id !== "front" || texts.length > 0 || hasTables) sections.push(chunk.section);
  }

  return { format: "latex", source: meta.source, mainFile: meta.mainFile, title, sections, sentences, tables, warnings };
}

// ---------------------------------------------------------------------------
// Sections

/** Split the body at \section and \subsection. Text before the first one becomes "front". */
function splitSections(body: string, ctx: Ctx): Chunk[] {
  const chunks: Chunk[] = [{ section: { id: "front", name: "Before the first section", level: 0, appendix: false }, text: "" }];
  const heading = /\\(section|subsection|appendix)(?![a-zA-Z@])(\*?)/g;
  let appendix = false;
  let sec = 0, sub = 0, unnumbered = 0;
  let current: Section | undefined;              // the current level-1 section
  let last = 0;

  for (let m = heading.exec(body); m; m = heading.exec(body)) {
    chunks[chunks.length - 1]!.text += body.slice(last, m.index);
    if (m[1] === "appendix") { appendix = true; sec = 0; last = heading.lastIndex; continue; }

    let i = skipOptional(body, heading.lastIndex);
    const group = readGroup(body, i);
    if (!group) { last = heading.lastIndex; continue; }       // \section without {title}: ignore
    heading.lastIndex = group.end;
    last = group.end;
    const name = toText(group.content, ctx);
    const starred = m[2] === "*";

    let section: Section;
    if (m[1] === "section") {
      sub = 0;
      const id = starred ? `u${++unnumbered}` : appendix ? letter(++sec) : String(++sec);
      section = { id, name, level: 1, appendix };
      current = section;
    } else {
      const id = starred || !current || current.id.startsWith("u") ? `u${++unnumbered}` : `${current.id}.${++sub}`;
      section = { id, name, level: 2, parent: current?.id, appendix };
    }
    chunks.push({ section, text: "" });
  }
  chunks[chunks.length - 1]!.text += body.slice(last);
  return chunks;
}

function letter(n: number): string {
  let s = "";
  for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

// ---------------------------------------------------------------------------
// Tables

const TABLE_FLOATS = ["table", "table*", "sidewaystable", "sidewaystable*", "wraptable", "longtable", "longtable*"];
const TABULARS = ["tabular", "tabular*", "tabularx", "tabulary", "longtable", "longtable*"];

/** Take every table out of the text, adding it to `out`. Returns the text without them. */
function extractTables(text: string, sectionId: string, out: RawTable[]): string {
  let result = "";
  let pos = 0;
  for (;;) {
    const found = findFirstEnvironment(text, [...TABLE_FLOATS, ...TABULARS], pos);
    if (!found) break;
    result += text.slice(pos, found.start) + "\n\n";
    pos = found.end;
    const inner = text.slice(found.innerStart, found.innerEnd);

    if (TABULARS.includes(found.name) && !found.name.startsWith("longtable")) {
      // A tabular outside any table float: no caption.
      out.push({ id: `T${out.length + 1}`, caption: "", section: sectionId, body: tabularBody(found.name, inner) });
      continue;
    }

    const caption = readCommandArg(inner, "caption") ?? "";
    const label = /\\label\s*\{([^}]*)\}/.exec(inner)?.[1]?.trim();
    if (found.name.startsWith("longtable")) {
      out.push({ id: `T${out.length + 1}`, caption, label, section: sectionId,
                 body: tabularBody(found.name, removeCommand(inner, "caption")) });
      continue;
    }
    // A float may hold several tabulars (sub-tables): each becomes its own table.
    let p = 0;
    let any = false;
    for (;;) {
      const tab = findFirstEnvironment(inner, TABULARS, p);
      if (!tab) break;
      p = tab.end;
      any = true;
      out.push({ id: `T${out.length + 1}`, caption, label, section: sectionId,
                 body: tabularBody(tab.name, inner.slice(tab.innerStart, tab.innerEnd)) });
    }
    if (!any) result += "\n\n";            // a table float without a tabular (e.g. an image): dropped
  }
  return result + text.slice(pos);
}

/** The rows of a tabular: its text after the column specification. */
function tabularBody(name: string, inner: string): string {
  let i = 0;
  if (name === "tabular*" || name === "tabularx" || name === "tabulary") i = readGroup(inner, i)?.end ?? i;   // width
  i = skipOptional(inner, i);                                                                              // [t]
  i = readGroup(inner, i)?.end ?? i;                                                                       // {lcc}
  return inner.slice(i);
}

/** Parse the rows of one tabular into cells. */
function parseTabular(raw: RawTable, ctx: Ctx): Table {
  let body = flattenNestedTabulars(raw.body);
  body = body
    .replace(/\\(?:hline|toprule|midrule|bottomrule|endhead|endfirsthead|endfoot|endlastfoot|hdashline|morecmidrules|tabularnewline)(?![a-zA-Z@])(?:\s*\[[^\]]*\])?/g,
             (m) => (m.includes("tabularnewline") ? "\\\\" : " "))
    .replace(/\\cmidrule\s*(?:\[[^\]]*\])?\s*(?:\([^)]*\))?\s*\{[^}]*\}/g, " ")
    .replace(/\\(?:cline|hhline|arrayrulecolor)\s*\{[^}]*\}/g, " ")
    .replace(/\\addlinespace(?:\s*\[[^\]]*\])?/g, " ")
    .replace(/\\specialrule\s*\{[^}]*\}\s*\{[^}]*\}\s*\{[^}]*\}/g, " ")
    .replace(/\\(?:rowcolor|cellcolor|columncolor)\s*(?:\[[^\]]*\])?\s*\{[^}]*\}/g, " ")
    .replace(/\\noalign\s*\{[^{}]*\}/g, " ");

  // Rows and cells, before cleaning: each cell keeps its starting column and span.
  // `rows` is set for a \multirow cell: how many rows it covers.
  const grid: { col: number; span: number; text: string; rows?: number }[][] = [];
  for (const rowRaw of splitTopLevel(body, "row")) {
    const cells: { col: number; span: number; text: string; rows?: number }[] = [];
    let col = 1;
    for (const cellRaw of splitTopLevel(rowRaw, "cell")) {
      let raw = cellRaw.trim();
      let span = 1;
      const mc = /^\\multicolumn\s*\{\s*(\d+)\s*\}/.exec(raw);
      if (mc) {
        span = Math.max(1, Number(mc[1]));
        const spec = readGroup(raw, mc[0].length);
        const content = spec ? readGroup(raw, spec.end) : undefined;
        raw = content?.content ?? "";
      }
      const mr = /^\\multirow\s*(?:\[[^\]]*\])?\s*\{\s*(\d+)\s*\}/.exec(raw);
      cells.push({ col, span, text: toText(raw, ctx), ...(mr && { rows: Number(mr[1]) }) });
      col += span;
    }
    if (cells.some((c) => c.text !== "")) grid.push(cells);
  }

  // Header rows: rows at the top with no number in columns 2 and on (at most 3).
  // A data cell holds a number or a range; label cells hold text ("Z=1", "ResNet-18").
  const numeric = (text: string) => { const n = parseCellNumber(text); return n.value !== undefined || n.interval !== undefined; };
  // Some tables start with setting rows such as "Batch Size | 32 | 16 | 1": whole numbers above
  // rows of measured values (1449.4 ± 0.8). Those top rows are headers too.
  const measured = (text: string) => { const n = parseCellNumber(text); return n.value !== undefined && (!Number.isInteger(n.value) || n.spread !== undefined); };
  const tableHasMeasured = grid.some((row) => row.some((c) => c.col >= 2 && measured(c.text)));
  const settingsRow = (row: (typeof grid)[number]) => {
    const values = row.filter((c) => c.col >= 2 && numeric(c.text));
    return values.length > 0 && values.every((c) => {
      const n = parseCellNumber(c.text);
      return n.value !== undefined && Number.isInteger(n.value) && n.spread === undefined && !n.percent && !/[.,]/.test(c.text);
    });
  };
  let headerRows = 0;
  while (headerRows < Math.min(3, grid.length - 1)) {
    const row = grid[headerRows]!;
    const noNumbers = !row.some((c) => c.col >= 2 && numeric(c.text));
    if (!noNumbers && !(tableHasMeasured && settingsRow(row))) break;
    headerRows++;
  }
  if (grid.length === 1 && !grid[0]!.some((c) => c.col >= 2 && numeric(c.text))) headerRows = 1;
  if (headerRows === grid.length) headerRows = Math.min(1, grid.length);       // no numbers at all

  const colLabel = (col: number): string => {
    const parts: string[] = [];
    for (let r = 0; r < headerRows; r++) {
      const cell = grid[r]!.find((c) => c.col <= col && col < c.col + c.span);
      if (cell?.text && parts[parts.length - 1] !== cell.text) parts.push(cell.text);
    }
    return parts.join(" / ");
  };

  // Row label: the text cells to the left of the row's first number, joined with " / "
  // (e.g. "CIFAR / DDPM"). Empty cells are skipped (some tables leave column 1 empty for
  // spacing). A cell under a \multirow takes the \multirow's text.
  const multirow = new Map<number, { text: string; left: number }>();   // column -> text still covering rows
  const rowLabelOf = (row: (typeof grid)[number]): string => {
    const firstNumber = row.find((c) => numeric(c.text))?.col ?? Infinity;
    const parts: string[] = [];
    for (const c of row) {
      if (c.col >= firstNumber) break;
      const fill = multirow.get(c.col);
      const text = c.text || (fill && fill.left > 0 ? fill.text : "");
      if (text) parts.push(text);
    }
    return parts.length > 0 ? parts.join(" / ") : (row[0]?.text ?? "");
  };
  const updateMultirow = (row: (typeof grid)[number]) => {
    for (const fill of multirow.values()) fill.left--;
    for (const c of row) if (c.rows && c.rows > 1) multirow.set(c.col, { text: c.text, left: c.rows - 1 });
  };

  const cells: Cell[] = [];
  let columns = 0;
  grid.forEach((row, r) => {
    const header = r < headerRows;
    const rowLabel = header ? "" : rowLabelOf(row);
    if (!header) updateMultirow(row);
    for (const c of row) {
      columns = Math.max(columns, c.col + c.span - 1);
      const n = parseCellNumber(c.text);
      cells.push({
        id: `${raw.id}.r${r + 1}.c${c.col}`, row: r + 1, col: c.col, span: c.span, text: c.text,
        ...(n.value !== undefined && { value: n.value }),
        ...(n.spread !== undefined && { spread: n.spread }),
        ...(n.delta !== undefined && { delta: n.delta }),
        ...(n.interval !== undefined && { interval: n.interval }),
        percent: n.percent, numbers: n.numbers,
        rowLabel, colLabel: header ? "" : colLabel(c.col), header,
      });
    }
  });

  return {
    id: raw.id, caption: toText(raw.caption, ctx), ...(raw.label ? { label: raw.label } : {}), section: raw.section,
    rows: grid.length, columns, headerRows, cells,
  };
}

/** A tabular inside a cell (used for two-line headers): keep its text on one line. */
function flattenNestedTabulars(body: string): string {
  for (;;) {
    const found = findFirstEnvironment(body, ["tabular", "array"], 0);
    if (!found) return body;
    const inner = tabularBody(found.name, body.slice(found.innerStart, found.innerEnd))
      .replace(/\\\\/g, " ").replace(/(?<!\\)&/g, " ");
    body = body.slice(0, found.start) + "{" + inner + "}" + body.slice(found.end);
  }
}

/** Split at row ends (\\) or cell separators (&) that are not inside braces. */
function splitTopLevel(text: string, by: "row" | "cell"): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "\\") {
      if (by === "row" && depth === 0 && text[i + 1] === "\\") {
        parts.push(text.slice(start, i));
        i += 2;
        if (text[i] === "*") i++;
        i = skipOptional(text, i);           // \\[2pt]
        start = i;
        i--;
        continue;
      }
      i++;                                   // skip the escaped character (\&, \{, \\ inside braces)
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") depth = Math.max(0, depth - 1);
    else if (ch === "&" && by === "cell" && depth === 0) { parts.push(text.slice(start, i)); start = i + 1; }
  }
  parts.push(text.slice(start));
  return by === "row" ? parts.filter((p) => p.trim() !== "") : parts;
}

// ---------------------------------------------------------------------------
// Numbers in cells

const NUM = String.raw`[+\-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?|[+\-]?\.\d+`;
const NUMBER_ANYWHERE = new RegExp(`(?<![A-Za-z0-9.])(?:${NUM})`, "g");
const WHOLE_CELL = new RegExp(
  `^(${NUM})` +                                       // the value
  String.raw`\s*([kKMBGT](?![a-zA-Z]))?` +             // a size suffix: 4.7M, 175B, 100k
  String.raw`\s*(?:(?:±|\+/-|\+-)\s*(${NUM}))?` +      // ± spread
  String.raw`\s*(?:\(\s*(±)?\s*(${NUM})\s*\))?$`,     // (±spread) or (+delta)
);

export interface CellNumber {
  value?: number; spread?: number; delta?: number; interval?: [number, number]; percent: boolean; numbers: number[];
}

/** Read the number in a cleaned cell text: "85.3 ± 0.2", "72.4%", "61.0 (+0.8)", "1,234", or a range "[0.17, 0.25]". */
export function parseCellNumber(text: string): CellNumber {
  const t = text.replace(/[−–]/g, "-").replace(/\s+/g, " ").trim();
  const numbers = [...t.matchAll(NUMBER_ANYWHERE)].map((m) => toNumber(m[0]));
  const percent = t.includes("%");
  const core = t.replace(/%/g, "").replace(/[*†‡§¶↑↓✓✗^]/g, "").replace(/\s+/g, " ").trim();
  const range = INTERVAL.exec(core);
  if (range) return { interval: [toNumber(range[1]!), toNumber(range[2]!)], percent, numbers };
  const m = WHOLE_CELL.exec(core);
  if (!m) return { percent, numbers };
  const result: CellNumber = { value: toNumber(m[1]!), percent, numbers };
  if (m[2]) result.value! *= SIZE[m[2]]!;                                  // "4.7M" -> 4,700,000
  if (m[3] !== undefined) result.spread = toNumber(m[3]);
  else if (m[5] !== undefined && m[4]) result.spread = toNumber(m[5]);
  else if (m[5] !== undefined && /^[+-]/.test(m[5])) result.delta = toNumber(m[5]);
  return result;
}

/** A range written as [a, b] or (a, b), e.g. bounds: "[0.17, 0.25]". */
const INTERVAL = new RegExp(String.raw`^[\[(]\s*(${NUM})\s*[,;]\s*(${NUM})\s*[\])]$`);

const SIZE: Record<string, number> = { k: 1e3, K: 1e3, M: 1e6, B: 1e9, G: 1e9, T: 1e12 };

function toNumber(s: string): number {
  return Number(s.replace(/,/g, ""));
}

// ---------------------------------------------------------------------------
// Text and sentences

const DROPPED_ENVIRONMENTS = ["figure", "figure*", "wrapfigure", "subfigure", "SCfigure", "algorithm", "algorithm*",
  "algorithmic", "tikzpicture", "lstlisting", "verbatim", "minted", "thebibliography", "comment", "filecontents"];
const MATH_ENVIRONMENTS = ["equation", "equation*", "align", "align*", "gather", "gather*", "multline", "multline*",
  "eqnarray", "eqnarray*", "displaymath", "flalign", "flalign*"];
const LIST_ENVIRONMENTS = ["itemize", "enumerate", "description"];

/** A section's text (tables already removed) as plain sentences. */
function chunkToSentences(text: string, ctx: Ctx): string[] {
  for (const name of DROPPED_ENVIRONMENTS) text = replaceEnvironments(text, name, () => "\n\n");
  for (const name of MATH_ENVIRONMENTS) text = replaceEnvironments(text, name, () => " [equation] ");
  text = text
    .replace(/\\\[[\s\S]*?\\\]/g, " [equation] ")
    .replace(/\$\$[\s\S]*?\$\$/g, " [equation] ")
    .replace(/\\item(?![a-zA-Z@])\s*(?:\[([^\]]*)\])?/g, (_m, label) => `\n\n${label ? label + " " : ""}`)
    .replace(/\\(?:paragraph|subsubsection)\*?\s*\{([^{}]*)\}/g, (_m, t) => `\n\n${/[.!?:]$/.test(t.trim()) ? t : t + "."} `)
    .replace(new RegExp(`\\\\(?:begin|end)\\s*\\{(?:${LIST_ENVIRONMENTS.join("|")})\\}(?:\\s*\\[[^\\]]*\\])?`, "g"), "\n\n")   // with options: [topsep=6pt]
    .replace(/\\(?:bibliography|bibliographystyle)\s*\{[^}]*\}/g, "");

  const sentences: string[] = [];
  for (const paragraph of text.split(/\n[ \t]*\n/)) {
    const clean = toText(paragraph, ctx);
    for (const s of splitSentences(clean)) {
      const content = s.replace(/\[equation\]/g, "").replace(/[^A-Za-z0-9]/g, "");
      if (content.length > 0) sentences.push(s);
    }
  }
  return sentences;
}

// Words that end with a full stop but do not end a sentence.
const ABBREVIATIONS = new Set(["e.g", "i.e", "al", "cf", "vs", "fig", "figs", "tab", "tabs", "sec", "secs", "eq", "eqs",
  "eqn", "ref", "refs", "no", "nos", "approx", "resp", "dr", "prof", "mr", "ms", "viz", "w.r.t", "app", "appx", "alg",
  "def", "thm", "lem", "prop", "cor", "ch", "pp", "vol", "i.i.d", "a.k.a", "incl", "st", "nd", "rd", "th", "est"]);

/** Split plain text into sentences at . ! ? followed by a space and a capital, a digit or a bracket. */
export function splitSentences(text: string): string[] {
  const out: string[] = [];
  const boundary = /([.!?])(["'”’)\]]*)\s+(?=[A-Z0-9"“'(\[])/g;
  let start = 0;
  for (let m = boundary.exec(text); m; m = boundary.exec(text)) {
    if (m[1] === ".") {
      const word = /([A-Za-z][A-Za-z.]*)$/.exec(text.slice(start, m.index))?.[1] ?? "";
      if (ABBREVIATIONS.has(word.toLowerCase()) || /^[A-Z]$/.test(word)) continue;   // "e.g." or an initial "J."
    }
    const end = m.index + m[1]!.length + m[2]!.length;
    out.push(text.slice(start, end).trim());
    start = boundary.lastIndex;
  }
  const rest = text.slice(start).trim();
  if (rest) out.push(rest);
  return out.filter((s) => s !== "");
}

// ---------------------------------------------------------------------------
// From LaTeX to plain text (used for sentences, captions and cells)

interface Ctx {
  macros: Map<string, string>;   // \newcommand{\ours}{TinyNet} -> "ours" => "TinyNet"
  labels: Map<string, string>;   // "tab:main" => "T1"
}

const SYMBOLS: Record<string, string> = {
  pm: "±", mp: "∓", textpm: "±", times: "×", texttimes: "×", approx: "≈", sim: "~", simeq: "≃", leq: "≤", le: "≤",
  geq: "≥", ge: "≥", neq: "≠", ne: "≠", cdot: "·", uparrow: "↑", downarrow: "↓", rightarrow: "→", to: "→",
  leftarrow: "←", Rightarrow: "⇒", infty: "∞", dagger: "†", ddagger: "‡", textdagger: "†", textdaggerdbl: "‡",
  ast: "*", star: "*", circ: "°", degree: "°", textdegree: "°", ldots: "...", dots: "...", cdots: "...",
  textminus: "-", textasciitilde: "~", textbar: "|", textless: "<", textgreater: ">", lt: "<", gt: ">",
  checkmark: "✓", cmark: "✓", xmark: "✗", S: "§", P: "¶", quad: " ", qquad: " ", LaTeX: "LaTeX", TeX: "TeX",
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", varepsilon: "ε", zeta: "ζ", eta: "η", theta: "θ",
  kappa: "κ", lambda: "λ", mu: "μ", nu: "ν", xi: "ξ", pi: "π", rho: "ρ", sigma: "σ", tau: "τ", phi: "φ",
  varphi: "φ", chi: "χ", psi: "ψ", omega: "ω", Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Pi: "Π",
  Sigma: "Σ", Phi: "Φ", Psi: "Ψ", Omega: "Ω", ell: "ℓ", partial: "∂", nabla: "∇", sum: "Σ", prod: "Π",
  in: "∈", forall: "∀", exists: "∃", propto: "∝", ll: "≪", gg: "≫",
};

/** Commands removed together with this many {arguments} (and any [options]). */
const DROP: Record<string, number> = {
  label: 1, vspace: 1, "vspace*": 1, hspace: 1, "hspace*": 1, includegraphics: 1, setlength: 2, addtolength: 2,
  setcounter: 2, addtocounter: 2, color: 1, rowcolor: 1, cellcolor: 1, columncolor: 1, fontsize: 2,
  thispagestyle: 1, pagestyle: 1, captionsetup: 1, hypersetup: 1, usepackage: 1, documentclass: 1,
  phantom: 1, hphantom: 1, vphantom: 1, nocite: 1, bibliography: 1, bibliographystyle: 1,
  thanks: 1, affiliation: 1, institute: 1, email: 1, author: 1, date: 1, icmlauthor: 2, icmlaffiliation: 2,
  icmlcorrespondingauthor: 2, icmlkeywords: 1, icmltitle: 1, newcolumntype: 2, definecolor: 3, linewidth: 0,
  textwidth: 0, columnwidth: 0,
};
/** Commands whose first N arguments are dropped and whose next argument is kept: \textcolor{red}{x} -> x. */
const KEEP_LAST: Record<string, number> = {
  textcolor: 1, colorbox: 1, href: 1, resizebox: 2, scalebox: 1, raisebox: 1, multicolumn: 2, multirow: 2,
  adjustbox: 1, rotatebox: 1, parbox: 1, makebox: 0, framebox: 0,
};
const CITES = new Set(["cite", "citep", "citet", "citealp", "citealt", "citeauthor", "citeyear", "parencite", "textcite",
  "autocite", "footcite", "citenum", "Citet", "Citep"]);
const REFS = new Set(["ref", "cref", "Cref", "autoref", "Autoref", "eqref", "pageref", "nameref", "Sref", "vref"]);

/** Turn a piece of LaTeX into plain text. */
export function toText(s: string, ctx: Ctx, depth = 0): string {
  let out = "";
  let i = 0;
  while (i < s.length) {
    const ch = s[i]!;
    if (ch === "\\") {
      const name = /^\\([a-zA-Z@]+\*?|.?)/.exec(s.slice(i, i + 64))![1]!;
      i += 1 + name.length;
      const r = command(name, s, i, ctx, depth);
      out += r.text;
      i = r.end;
    } else if (ch === "{" || ch === "}" || ch === "$" || ch === "_") {
      i++;                                                 // grouping and math markers
    } else if (ch === "~") {
      out += " "; i++;
    } else if (ch === "`") {
      if (s[i + 1] === "`") { out += '"'; i += 2; } else { out += "'"; i++; }
    } else if (ch === "'" && s[i + 1] === "'") {
      out += '"'; i += 2;
    } else if (ch === "-" && s[i + 1] === "-") {
      if (s[i + 2] === "-") { out += " - "; i += 3; } else { out += "-"; i += 2; }
    } else {
      out += ch; i++;
    }
  }
  return out.replace(/\s+/g, " ").replace(/\^([*†‡§¶])/g, "$1").replace(/\s*±\s*/g, " ± ").replace(/ ([,.;:!?)\]])/g, "$1").replace(/([(\[]) /g, "$1").trim();
}

/** One command, starting after its name. Returns the text it stands for and where it ends. */
function command(name: string, s: string, i: number, ctx: Ctx, depth: number): { text: string; end: number } {
  // One-character commands: \% \& \_ \, \\ ...
  if (!/^[a-zA-Z@]/.test(name)) {
    if (name === "\\") return { text: " ", end: skipOptional(s, s[i] === "*" ? i + 1 : i) };
    if ("%&_#${}".includes(name)) return { text: name, end: i };
    if (name === "," || name === ";" || name === ":" || name === " " || name === "") return { text: " ", end: i };
    return { text: "", end: i };                         // \- \! and accents (\'e -> e)
  }

  const bare = name.replace(/\*$/, "");
  if (SYMBOLS[bare] !== undefined) return { text: SYMBOLS[bare]!, end: i };

  if (ctx.macros.has(bare) && depth < 5) {
    const end = s[i] === "{" && s[i + 1] === "}" ? i + 2 : i;     // \ours{} is the same as \ours
    return { text: toText(ctx.macros.get(bare)!, ctx, depth + 1), end };
  }

  if (DROP[name] !== undefined || DROP[bare] !== undefined) {
    let end = skipOptional(s, i);
    for (let k = 0; k < (DROP[name] ?? DROP[bare]!); k++) end = readGroup(s, end)?.end ?? end;
    return { text: "", end };
  }

  if (CITES.has(bare)) {
    let end = skipOptional(s, skipOptional(s, i));
    end = readGroup(s, end)?.end ?? end;
    return { text: "[cite]", end };
  }

  if (REFS.has(bare)) {
    const g = readGroup(s, i);
    if (!g) return { text: "", end: i };
    const named = /^[cC]ref|^[aA]utoref/.test(bare);
    const parts = g.content.split(",").map((label) => {
      const id = ctx.labels.get(label.trim());
      if (id) return named ? `Table ${id}` : id;
      return `[${label.trim()}]`;
    });
    return { text: parts.join(", "), end: g.end };
  }

  if (KEEP_LAST[bare] !== undefined) {
    let end = skipOptional(s, i);
    for (let k = 0; k < KEEP_LAST[bare]!; k++) end = skipOptional(s, readGroup(s, end)?.end ?? end);
    const g = readGroup(s, end);
    return g ? { text: toText(g.content, ctx, depth + 1), end: g.end } : { text: "", end };
  }

  if (bare === "footnote") {
    const g = readGroup(s, skipOptional(s, i));
    return g ? { text: ` (footnote: ${toText(g.content, ctx, depth + 1)})`, end: g.end } : { text: "", end: i };
  }

  if (bare === "begin" || bare === "end") {             // other environments: keep their text, drop the markers
    const g = readGroup(s, i);
    return { text: " ", end: g?.end ?? i };
  }

  // Anything else: drop the command, keep its first {argument} if it has one: \textbf{x} -> x.
  let end = s[i] === "[" ? skipOptional(s, i) : i;
  if (s[end] === "{") {
    const g = readGroup(s, end)!;
    return { text: toText(g.content, ctx, depth + 1), end: g.end };
  }
  return { text: "", end: i };
}

/** \newcommand{\name}{body}, \renewcommand and \def\name{body}, without arguments. */
function collectMacros(text: string): Map<string, string> {
  const macros = new Map<string, string>();
  const pattern = /\\(?:newcommand|renewcommand|providecommand|DeclareRobustCommand)\*?\s*\{?\\([a-zA-Z@]+)\}?\s*(\[\d\])?/g;
  for (const m of text.matchAll(pattern)) {
    if (m[2]) continue;                                    // takes arguments: not expanded
    const g = readGroup(text, m.index! + m[0].length);
    if (g && !macros.has(m[1]!)) macros.set(m[1]!, g.content);
  }
  for (const m of text.matchAll(/\\def\s*\\([a-zA-Z@]+)\s*(?=\{)/g)) {
    const g = readGroup(text, m.index! + m[0].length);
    if (g && !macros.has(m[1]!)) macros.set(m[1]!, g.content);
  }
  for (const name of Object.keys(SYMBOLS)) macros.delete(name);   // never redefine \pm etc.
  return macros;
}

/** Remove macro definitions from the body, so they do not show up as text. */
function removeDefinitions(body: string): string {
  const pattern = /\\(?:newcommand|renewcommand|providecommand|DeclareRobustCommand)\*?\s*\{?\\[a-zA-Z@]+\}?\s*(?:\[\d\])?(?:\[[^\]]*\])?\s*/g;
  let out = "";
  let last = 0;
  for (const m of body.matchAll(pattern)) {
    if (m.index! < last) continue;
    const g = readGroup(body, m.index! + m[0].length);
    out += body.slice(last, m.index);
    last = g ? g.end : m.index! + m[0].length;
  }
  out += body.slice(last);
  return out.replace(/\\def\s*\\[a-zA-Z@]+\s*\{[^{}]*\}/g, "");
}

// ---------------------------------------------------------------------------
// Small LaTeX helpers

/** The {group} starting at i (after spaces), with braces balanced. */
function readGroup(s: string, i: number): { content: string; end: number } | undefined {
  while (s[i] === " " || s[i] === "\n" || s[i] === "\t") i++;
  if (s[i] !== "{") return undefined;
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === "\\") { j++; continue; }
    if (s[j] === "{") depth++;
    else if (s[j] === "}" && --depth === 0) return { content: s.slice(i + 1, j), end: j + 1 };
  }
  return { content: s.slice(i + 1), end: s.length };       // unbalanced: take the rest
}

/** Skip an [optional argument] at i, if there is one. */
function skipOptional(s: string, i: number): number {
  let j = i;
  while (s[j] === " ") j++;
  if (s[j] !== "[") return i;
  let depth = 0;
  for (; j < s.length; j++) {
    if (s[j] === "{") depth++;
    else if (s[j] === "}") depth--;
    else if (s[j] === "]" && depth === 0) return j + 1;
  }
  return i;
}

/** The argument of the first \name{...} in s (its optional [..] skipped). */
function readCommandArg(s: string, name: string): string | undefined {
  const m = new RegExp(`\\\\${name}(?![a-zA-Z@])\\*?`).exec(s);
  if (!m) return undefined;
  return readGroup(s, skipOptional(s, m.index + m[0].length))?.content;
}

/** s without any \name[..]{...}. */
function removeCommand(s: string, name: string): string {
  const m = new RegExp(`\\\\${name}(?![a-zA-Z@])\\*?`).exec(s);
  if (!m) return s;
  const g = readGroup(s, skipOptional(s, m.index + m[0].length));
  return s.slice(0, m.index) + s.slice(g?.end ?? m.index + m[0].length);
}

interface EnvMatch { name: string; start: number; innerStart: number; innerEnd: number; end: number }

/** The first \begin{name} ... \end{name} at or after `from`, nesting respected. */
function findEnvironment(s: string, name: string, from: number): EnvMatch | undefined {
  return findFirstEnvironment(s, [name], from);
}

/** The first environment with any of these names, at or after `from`. */
function findFirstEnvironment(s: string, names: string[], from: number): EnvMatch | undefined {
  const escaped = names.map((n) => n.replace(/[*]/g, "\\*")).join("|");
  const begin = new RegExp(`\\\\begin\\s*\\{(${escaped})\\}`, "g");
  begin.lastIndex = from;
  const m = begin.exec(s);
  if (!m) return undefined;
  const name = m[1]!;
  const n = name.replace(/[*]/g, "\\*");
  const token = new RegExp(`\\\\(begin|end)\\s*\\{${n}\\}`, "g");
  token.lastIndex = m.index + m[0].length;
  let depth = 1;
  for (let t = token.exec(s); t; t = token.exec(s)) {
    depth += t[1] === "begin" ? 1 : -1;
    if (depth === 0) return { name, start: m.index, innerStart: m.index + m[0].length, innerEnd: t.index, end: t.index + t[0].length };
  }
  return { name, start: m.index, innerStart: m.index + m[0].length, innerEnd: s.length, end: s.length };   // never closed
}

/** Replace every environment called `name`. */
function replaceEnvironments(s: string, name: string, by: (inner: string) => string): string {
  let out = "";
  let pos = 0;
  for (let found = findEnvironment(s, name, pos); found; found = findEnvironment(s, name, pos)) {
    out += s.slice(pos, found.start) + by(s.slice(found.innerStart, found.innerEnd));
    pos = found.end;
  }
  return out + s.slice(pos);
}
