// hackathon-tools.ts - the tools Tygig gives the model for the hackathon
// (AI for Meta-Science, Task 3): read one research paper, link its claims to evidence,
// check each link with code (C1 to C4, in review/checks.ts) and write the claim map.
//
// There is no plugin system yet: ChatApp.tsx passes this list straight to createAgent.
// Tool names follow the design's plugin__tool convention (design document D9).
// Every tool returns plain text; IDs (S12, T1.r2.c3) let the model cite exact evidence.

import os from "node:os";
import path from "node:path";
import type { Tool } from "@tygig/agent";
import type { Paper, Section, Table } from "./review/paper.js";
import { readLatexPaper } from "./review/parser.js";
import { normaliseId, type Comparison, type Label } from "./review/checks.js";
import { ClaimStore, describeEntry, outputFolder, reviewMode, writeClaimMap, type ClaimMap } from "./review/claim-map.js";

/** The paper loaded by review__load_paper, and its claims. One paper at a time, kept in memory. */
let paper: Paper | undefined;
let claims: ClaimStore | undefined;

/** For a batch run: the claim map so far (undefined before a paper is loaded). */
export function currentClaimMap(): ClaimMap | undefined {
  return claims?.map(reviewMode());
}

/** For tests and for a batch run: the paper currently loaded. */
export function currentPaper(): Paper | undefined {
  return paper;
}

const MAX_OUTPUT = 30_000;    // characters; longer results are cut, with a note

export const hackathonTools: Tool[] = [
  {
    definition: {
      name: "review__load_paper",
      description:
        "Load a research paper from its LaTeX source: a folder (for example an unpacked arXiv source) or its main .tex file. " +
        "A relative path is read from the project folder. Returns the sections, the number of sentences and the tables. " +
        "Call this first; the other review tools work on the loaded paper.",
      inputSchema: {
        type: "object",
        properties: { path: { type: "string", description: "Folder or .tex file, e.g. papers/2411.01234" } },
        required: ["path"],
      },
    },
    async run(input) {
      const target = String((input as { path?: unknown }).path ?? "").trim().replace(/^["']|["']$/g, "");
      if (!target) throw new Error("Give the path of the paper folder or its main .tex file.");
      const full = target.startsWith("~") ? path.join(os.homedir(), target.slice(1)) : path.resolve(process.cwd(), target);
      paper = await readLatexPaper(full);
      claims = new ClaimStore(paper);                  // a new paper starts a new claim map
      return summary(paper);
    },
  },
  {
    definition: {
      name: "review__get_section",
      description:
        "Return the sentences of one section of the loaded paper, each with its ID (S1, S2, ...). " +
        "Give the section's name (e.g. \"Experiments\"), its number (e.g. \"4\" or \"4.2\") or \"abstract\". " +
        "A section includes its subsections. To read single sentences, give their IDs instead (e.g. \"S101\" or \"S99, S100\"): " +
        "each comes with the sentence before and after it.",
      inputSchema: {
        type: "object",
        properties: { name: { type: "string", description: "Section name, number, \"abstract\", or sentence IDs such as \"S101\"" } },
        required: ["name"],
      },
    },
    async run(input) {
      const p = loaded();
      const name = String((input as { name?: unknown }).name ?? "").trim();
      // Sentence IDs ("S101", "S99, S100"): those sentences, each with its neighbours.
      const ids = name.split(/[,;\s]+/).filter(Boolean).map((id) => normaliseId(id));
      if (ids.length > 0 && ids.every((id) => /^S\d+$/.test(id))) return readSentences(p, ids);
      const section = findSection(p, name);
      if (!section) {
        throw new Error(`No section "${name}". Sections: ${p.sections.map((s) => `${s.id} ${s.name}`).join("; ")}.`);
      }
      const parts = [section, ...p.sections.filter((s) => s.parent === section.id)];
      const lines: string[] = [];
      for (const s of parts) {
        lines.push(`## ${heading(s)}`);
        const sentences = p.sentences.filter((x) => x.section === s.id);
        if (sentences.length === 0) lines.push("(no sentences)");
        for (const x of sentences) lines.push(`${x.id}: ${x.text}`);
        for (const t of p.tables.filter((t) => t.section === s.id)) lines.push(`(table ${t.id} is in this section: ${t.caption || "no caption"})`);
      }
      return cut(lines.join("\n"));
    },
  },
  {
    definition: {
      name: "review__get_table",
      description:
        "Return one table of the loaded paper as a grid. Every cell has an ID (T1.r2.c3 = table 1, row 2, column 3), " +
        "its row label, its column label and its value. Give the table ID (\"T1\"), its number (\"1\") or its LaTeX label.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string", description: "Table ID, e.g. T1" } },
        required: ["id"],
      },
    },
    async run(input) {
      const p = loaded();
      const id = String((input as { id?: unknown }).id ?? "").trim();
      const table = findTable(p, id);
      if (!table) {
        const known = p.tables.map((t) => t.id).join(", ") || "none";
        throw new Error(`No table "${id}". Tables in this paper: ${known}.`);
      }
      return cut(renderTable(table));
    },
  },
  {
    definition: {
      name: "review__find_text",
      description:
        "Search the loaded paper's sentences. Returns every sentence containing all the words of the query " +
        "(not case-sensitive), with its ID and section, and any table whose caption matches.",
      inputSchema: {
        type: "object",
        properties: { query: { type: "string", description: "Words to look for, e.g. \"outperforms baseline\"" } },
        required: ["query"],
      },
    },
    async run(input) {
      const p = loaded();
      const query = String((input as { query?: unknown }).query ?? "").trim();
      if (!query) throw new Error("Give some words to search for.");
      const words = query.toLowerCase().split(/\s+/);
      const matches = (text: string) => { const t = text.toLowerCase(); return words.every((w) => t.includes(w)); };

      const found = p.sentences.filter((s) => matches(s.text));
      const tables = p.tables.filter((t) => matches(t.caption));
      if (found.length === 0 && tables.length === 0) return `No sentence or table caption contains "${query}".`;

      const lines = [`${found.length} sentence(s) contain "${query}"${found.length > 40 ? " (first 40 shown)" : ""}:`];
      for (const s of found.slice(0, 40)) lines.push(`${s.id} [section ${s.section}]: ${s.text}`);
      for (const t of tables) lines.push(`Table ${t.id} caption: ${t.caption}`);
      return cut(lines.join("\n"));
    },
  },
  {
    definition: {
      name: "review__submit_link",
      description:
        "Submit one claim of the loaded paper with the evidence that supports it. Call it once per claim. " +
        "The claim is a sentence ID (e.g. S12); its text is taken from the paper. Evidence is a list of sentence IDs " +
        "and/or table cell IDs (e.g. [\"T1.r4.c2\", \"S40\"]), only IDs returned by the read tools. " +
        "For a claim that compares the authors' result with a baseline, add comparisons: a list of {ours, baseline, higher_is_better} " +
        "with two cell IDs each, one per part of the claim (e.g. one per model or dataset the claim names). All must hold. " +
        "Returns the label (supported, unsupported or unverified) and the result of each check, with a reason. " +
        "If a check fails, the reason may say where else in the paper a missing number appears: read it, fix the evidence " +
        "and submit the claim again.",
      inputSchema: {
        type: "object",
        properties: {
          claim_sentence_id: { type: "string", description: "The claim's sentence ID, e.g. S12" },
          evidence_ids: { type: "array", items: { type: "string" }, description: "Sentence IDs (S40) and/or cell IDs (T1.r4.c2)" },
          comparisons: {
            type: "array",
            description: "Leave out unless the claim sentence compares the authors' result with a baseline (\"outperforms\", \"better than\", \"on par\"). One item per part of the claim. Table cell IDs only, never sentence IDs.",
            items: {
              type: "object",
              properties: {
                ours: { type: "string", description: "Cell ID of the authors' result" },
                baseline: { type: "string", description: "Cell ID of the baseline's result, same column" },
                higher_is_better: { type: "boolean", description: "false for error, loss, MAE, RMSE, FID, perplexity" },
              },
              required: ["ours", "baseline", "higher_is_better"],
            },
          },
          model_label: { type: "string", enum: ["supported", "unsupported", "unverified"], description: "Your own verdict" },
        },
        required: ["claim_sentence_id", "evidence_ids", "model_label"],
      },
    },
    async run(input) {
      loaded();
      const i = input as Record<string, unknown>;
      const claimId = String(i.claim_sentence_id ?? "").trim();
      if (!claimId) throw new Error("Give claim_sentence_id, e.g. S12.");
      const evidenceIds = toIdList(i.evidence_ids);
      const modelLabel = String(i.model_label ?? "").trim().toLowerCase().replace(/[^a-z]/g, "");
      if (!["supported", "unsupported", "unverified"].includes(modelLabel)) {
        throw new Error("model_label must be supported, unsupported or unverified.");
      }
      // "comparisons" (a list) is the documented input; a single "comparison" is accepted too.
      const comparisons = [...toComparisonList(i.comparisons), ...toComparisonList(i.comparison)];
      const mode = reviewMode();
      const entry = claims!.submit({ claimId, evidenceIds, comparisons, modelLabel: modelLabel as Label }, mode);
      // Save the map after every claim, so the result is on disk even if the model never calls finish.
      await writeClaimMap(claims!.map(mode), outputFolder(paper!)).catch(() => {});
      return describeEntry(entry, mode);
    },
  },
  {
    definition: {
      name: "review__finish",
      description:
        "Write the claim map of the loaded paper: claim-map.json and claim-map.md, in the paper's folder. " +
        "Call it once, after every claim has been submitted with review__submit_link. Returns the count per label.",
      inputSchema: { type: "object", properties: {} },
    },
    async run() {
      const p = loaded();
      const mode = reviewMode();
      const map = claims!.map(mode);
      if (map.claims.length === 0) throw new Error("No claims submitted yet. Call review__submit_link for each claim first.");
      const files = await writeClaimMap(map, outputFolder(p));
      const c = map.counts;
      return `Claim map written: ${map.claims.length} claims (supported ${c.supported}, unsupported ${c.unsupported}, unverified ${c.unverified}).\n` +
        `Mode: ${mode === "checks" ? "checks on" : "baseline, checks off"}.\nFiles: ${files.json}\n${files.md}`;
    },
  },
];

// ---------------------------------------------------------------------------
// Helpers

function loaded(): Paper {
  if (!paper) throw new Error("No paper is loaded. Call review__load_paper first.");
  return paper;
}

function heading(s: Section): string {
  return s.id === "abstract" || s.id === "front" || s.id.startsWith("u") ? s.name : `${s.id} ${s.name}`;
}

/** Short overview returned by review__load_paper. */
function summary(p: Paper): string {
  const lines = [`Loaded "${p.title || "(no title)"}" from ${p.mainFile ?? p.source}.`,
                 `${p.sentences.length} sentences (S1 to S${p.sentences.length}), ${p.tables.length} tables.`, "Sections:"];
  for (const s of p.sections) {
    const ids = p.sentences.filter((x) => x.section === s.id).map((x) => x.id);
    const range = ids.length === 0 ? "no sentences" : ids.length === 1 ? ids[0] : `${ids[0]} to ${ids[ids.length - 1]}`;
    lines.push(`${s.level === 2 ? "    " : "  "}${heading(s)} (${range})`);
  }
  lines.push("Tables:");
  if (p.tables.length === 0) lines.push("  none");
  for (const t of p.tables) {
    lines.push(`  ${t.id}${t.label ? ` [${t.label}]` : ""}, section ${t.section}, ${t.rows} rows x ${t.columns} columns: ${t.caption || "(no caption)"}`);
  }
  if (p.warnings.length > 0) lines.push("Warnings:", ...p.warnings.map((w) => `  ${w}`));
  return lines.join("\n");
}

/** A table as text: the column labels once, then one line per row with every cell's ID and text. */
export function renderTable(t: Table): string {
  const lines = [
    `${t.id}: ${t.caption || "(no caption)"}`,
    `${t.label ? `Label ${t.label}. ` : ""}Section ${t.section}. ${t.rows} rows x ${t.columns} columns. ` +
      `Header rows: ${t.headerRows === 0 ? "none" : t.headerRows === 1 ? "r1" : `r1 to r${t.headerRows}`}.`,
  ];
  const columnLabels: string[] = [];
  for (let c = 1; c <= t.columns; c++) {
    const label = t.cells.find((x) => !x.header && x.col === c)?.colLabel ?? "";
    columnLabels.push(`c${c} = ${label || "(none)"}`);
  }
  lines.push(`Column labels: ${columnLabels.join(" | ")}`);
  for (let r = 1; r <= t.rows; r++) {
    const row = t.cells.filter((x) => x.row === r);
    const first = row[0];
    const label = first?.header ? "header" : `"${first?.rowLabel ?? ""}"`;
    const cells = row.map((x) => `${x.id}${x.span > 1 ? ` (spans ${x.span})` : ""}: ${x.text || "(empty)"}`);
    lines.push(`r${r} ${label}: ${cells.join(" | ")}`);
  }
  return lines.join("\n");
}

/** Sentences by ID, each with the sentence before and after it, and the section it is in. */
function readSentences(p: Paper, ids: string[]): string {
  const lines: string[] = [];
  for (const id of ids) {
    const i = p.sentences.findIndex((s) => s.id === id);
    if (i === -1) { lines.push(`${id}: no sentence with this ID (the paper has S1 to S${p.sentences.length}).`); continue; }
    const section = p.sections.find((s) => s.id === p.sentences[i]!.section);
    lines.push(`## ${id}, in ${section ? heading(section) : "section " + p.sentences[i]!.section}`);
    for (const s of p.sentences.slice(Math.max(0, i - 1), i + 2)) lines.push(`${s.id}${s.id === id ? " (asked)" : ""}: ${s.text}`);
  }
  return cut(lines.join("\n"));
}

/** A section by its ID ("1", "2.1", "abstract"), its name ("Introduction"), both as the summary
 *  shows them ("1 Introduction"), or "Section 2". */
function findSection(p: Paper, name: string): Section | undefined {
  const n = name.toLowerCase().replace(/^section\s+/, "").replace(/\s+/g, " ").trim();
  const leadingId = /^([a-z]?\d+(?:\.\d+)*|[a-z](?:\.\d+)*)(?:\s|$)/.exec(n)?.[1];
  return p.sections.find((s) => s.id.toLowerCase() === n)
      ?? p.sections.find((s) => `${s.id} ${s.name}`.toLowerCase() === n)
      ?? p.sections.find((s) => s.name.toLowerCase() === n)
      ?? (leadingId ? p.sections.find((s) => s.id.toLowerCase() === leadingId) : undefined)
      ?? p.sections.find((s) => s.name.toLowerCase().includes(n));
}

function findTable(p: Paper, id: string): Table | undefined {
  const n = id.trim().toLowerCase().replace(/^table\s*/, "");
  return p.tables.find((t) => t.id.toLowerCase() === n || t.id.toLowerCase() === `t${n}`)
      ?? p.tables.find((t) => t.label?.toLowerCase() === n);
}

function cut(text: string): string {
  return text.length <= MAX_OUTPUT ? text : `${text.slice(0, MAX_OUTPUT)}\n[cut: ${text.length - MAX_OUTPUT} more characters]`;
}

/** evidence_ids as a list, also when a model sends one string ("T1.r2.c3, S4"). */
// Models differ in how they fill in arguments (a list or one string, JSON inside a string,
// "true" as text). These helpers accept all of them, so the tools work with any model.

/** evidence_ids as a list: ["T1.r2.c3", "S4"], "T1.r2.c3, S4" or '["T1.r2.c3","S4"]'. */
function toIdList(value: unknown): string[] {
  let v = value;
  if (typeof v === "string" && v.trim().startsWith("[")) { try { v = JSON.parse(v); } catch { /* split below */ } }
  const list = Array.isArray(v) ? v.map(String) : typeof v === "string" ? v.split(/[,;\s]+/) : v == null ? [] : [String(v)];
  return list.map((s) => s.trim()).filter(Boolean);
}

/** comparisons as a list: a list, one object, or JSON text of either. Empty items are skipped. */
function toComparisonList(value: unknown): Comparison[] {
  let v = value;
  if (typeof v === "string") {
    if (!v.trim()) return [];
    try { v = JSON.parse(v); } catch { throw new Error("comparisons must be a list of {ours, baseline, higher_is_better}."); }
  }
  const list = Array.isArray(v) ? v : v ? [v] : [];
  return list.map(toComparison).filter((c): c is Comparison => c !== undefined);
}

/** comparison as an object (or JSON text); undefined if not given or empty. */
function toComparison(value: unknown): Comparison | undefined {
  let v = value;
  if (typeof v === "string") {
    if (!v.trim()) return undefined;
    try { v = JSON.parse(v); } catch { throw new Error("comparison must be an object: {ours, baseline, higher_is_better}."); }
  }
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  if (!o.ours && !o.baseline) return undefined;
  const higher = typeof o.higher_is_better === "string" ? o.higher_is_better.trim().toLowerCase() : o.higher_is_better;
  if (typeof o.ours !== "string" || typeof o.baseline !== "string" || ![true, false, "true", "false"].includes(higher as never)) {
    throw new Error("comparison needs ours (cell ID), baseline (cell ID) and higher_is_better (true or false).");
  }
  return { ours: o.ours, baseline: o.baseline, higher_is_better: higher === true || higher === "true" };
}
