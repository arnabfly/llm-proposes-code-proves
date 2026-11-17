// review.test.ts - the LaTeX paper reader and the hackathon read tools.
// The fixture (test/fixtures/paper) has an abstract, two sections, an \input file and one results table.

import { describe, test, before } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { parseCellNumber, parseLatex, readLatexPaper, splitSentences } from "../packages/cli/src/review/parser.ts";
import type { Paper } from "../packages/cli/src/review/paper.ts";
import { currentClaimMap, hackathonTools } from "../packages/cli/src/hackathon-tools.ts";
import { claimNumbers, finalLabel, matchesNumber, normaliseId, runChecks, type Check } from "../packages/cli/src/review/checks.ts";
import { loadSkills } from "../packages/cli/src/review/skills.ts";
import { buildInstructions } from "../packages/cli/src/instructions.ts";
import { cp, mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const FIXTURE = fileURLToPath(new URL("./fixtures/paper", import.meta.url));

describe("LaTeX paper reader", () => {
  let paper: Paper;
  before(async () => { paper = await readLatexPaper(FIXTURE); });

  test("finds the main file, merges \\input files and reads the title", () => {
    assert.equal(paper.mainFile, "main.tex");
    assert.equal(paper.title, "A Small Test Paper");
    assert.deepEqual(paper.warnings, []);
    assert.deepEqual(paper.sections.map((s) => [s.id, s.name]),
      [["abstract", "Abstract"], ["1", "Introduction"], ["2", "Results"], ["2.1", "Main results"]]);
  });

  test("numbers sentences S1, S2, ... in order, each with its section", () => {
    assert.deepEqual(paper.sentences.map((s) => [s.id, s.section, s.text]), [
      ["S1", "abstract", "We present TinyNet, a small network."],
      ["S2", "abstract", "It reaches 85.3% accuracy on CIFAR-10, e.g. better than ResNet-18 by 1.2 points."],
      ["S3", "1", "Deep networks are large."],
      ["S4", "1", "We propose TinyNet in Section [sec:results]."],
      ["S5", "1", "Fig. 2 shows nothing."],
      ["S6", "1", "Results are in Table T1."],
      ["S7", "2.1", "TinyNet outperforms ResNet-18 on both datasets (Table T1)."],
    ]);
  });

  test("removes comments", () => {
    assert.ok(paper.sentences.every((s) => !/comment/i.test(s.text)));
  });

  test("reads the table: ID, caption, label, header rows and cell IDs", () => {
    assert.equal(paper.tables.length, 1);
    const t = paper.tables[0]!;
    assert.equal(t.id, "T1");
    assert.equal(t.caption, "Accuracy (%) over 3 seeds. Best in bold.");
    assert.equal(t.label, "tab:main");
    assert.equal(t.section, "2.1");
    assert.equal(t.rows, 4);
    assert.equal(t.columns, 3);
    assert.equal(t.headerRows, 2);
    assert.deepEqual(t.cells.filter((c) => c.row === 1).map((c) => [c.id, c.span, c.text]),
      [["T1.r1.c1", 1, ""], ["T1.r1.c2", 2, "Accuracy (%)"]]);       // \multicolumn{2}
  });

  test("gives each cell its value, row label and column label", () => {
    const cell = paper.tables[0]!.cells.find((c) => c.id === "T1.r4.c2")!;
    assert.equal(cell.text, "85.3 ± 0.2");                               // \textbf and $\pm$ removed
    assert.equal(cell.value, 85.3);
    assert.equal(cell.spread, 0.2);
    assert.equal(cell.rowLabel, "TinyNet");                              // the \ours macro expanded
    assert.equal(cell.colLabel, "Accuracy (%) / CIFAR-10");
  });

  test("reads ± written as a subscript, and a signed number in brackets as a difference", () => {
    const cells = paper.tables[0]!.cells;
    const sub = cells.find((c) => c.id === "T1.r3.c3")!;                 // 60.2$_{\pm 0.4}$
    assert.deepEqual([sub.value, sub.spread], [60.2, 0.4]);
    const diff = cells.find((c) => c.id === "T1.r4.c3")!;                // \underline{61.0} (+0.8)
    assert.deepEqual([diff.value, diff.delta, diff.spread], [61.0, 0.8, undefined]);
  });

  test("the Paper is plain data (JSON round trip)", () => {
    assert.deepEqual(JSON.parse(JSON.stringify(paper)), paper);
  });
});

describe("row labels", () => {
  const table = (rows: string) =>
    parseLatex(`\\begin{document}\\begin{tabular}{llcc}${rows}\\end{tabular}\\end{document}`, { source: "x" }).tables[0]!;
  const label = (t: ReturnType<typeof table>, id: string) => t.cells.find((c) => c.id === id)!.rowLabel;

  test("an empty first column (used for spacing) is skipped", () => {
    const t = table(String.raw` & & Y=0 & Y=1 \\ & Z=1 & 45 & 32 \\ & Z=0 & 92 & 33 \\`);
    assert.equal(label(t, "T1.r2.c3"), "Z=1");
    assert.equal(label(t, "T1.r3.c4"), "Z=0");
  });

  test("text cells before the first number are joined, and a \\multirow covers the rows below it", () => {
    const t = table(String.raw`Data & Model & A & B \\ \multirow{2}{*}{CIFAR} & DDPM & 1.0 & 2.0 \\ & Ours & 3.0 & 4.0 \\ CelebA & Ours & 5.0 & 6.0 \\`);
    assert.equal(label(t, "T1.r2.c3"), "CIFAR / DDPM");
    assert.equal(label(t, "T1.r3.c3"), "CIFAR / Ours");
    assert.equal(label(t, "T1.r4.c3"), "CelebA / Ours");
  });
});

describe("ranges in cells", () => {
  test("[a, b] is read as a range, and does not end up in the row label", () => {
    assert.deepEqual(parseCellNumber("[0.17, 0.25]").interval, [0.17, 0.25]);
    assert.equal(parseCellNumber("[0.17, 0.25]").value, undefined);
    const t = parseLatex(String.raw`\begin{document}\begin{tabular}{llcc}
      y & Method & PN & Bounds \\ y=2 & Theorem 1 & [0.17, 0.17] & [0.00, 0.17] \\ y=1 & Theorem 2 & 0.89 & [0.50, 0.90] \\
      \end{tabular}\end{document}`, { source: "x" }).tables[0]!;
    assert.equal(t.headerRows, 1);
    const cell = t.cells.find((c) => c.id === "T1.r2.c4")!;
    assert.equal(cell.rowLabel, "y=2 / Theorem 1");
    assert.deepEqual(cell.interval, [0, 0.17]);
  });
});

describe("numbers in cells", () => {
  test("plain, percent, thousands, minus signs and markers", () => {
    assert.equal(parseCellNumber("72.4").value, 72.4);
    assert.deepEqual([parseCellNumber("72.4%").value, parseCellNumber("72.4%").percent], [72.4, true]);
    assert.equal(parseCellNumber("1,204").value, 1204);
    assert.equal(parseCellNumber("−0.5").value, -0.5);
    assert.equal(parseCellNumber("3.1†").value, 3.1);
    assert.equal(parseCellNumber("85.3*").value, 85.3);
  });

  test("± in its different spellings", () => {
    assert.deepEqual([parseCellNumber("85.3 ± 0.2").value, parseCellNumber("85.3 ± 0.2").spread], [85.3, 0.2]);
    assert.equal(parseCellNumber("85.3±0.2").spread, 0.2);
    assert.equal(parseCellNumber("85.3 +- 0.2").spread, 0.2);
    assert.equal(parseCellNumber("85.3 (± 0.2)").spread, 0.2);
  });

  test("text is not a number, but its numbers are listed", () => {
    const r = parseCellNumber("ResNet-50");
    assert.equal(r.value, undefined);
    assert.deepEqual(r.numbers, [50]);
    assert.equal(parseCellNumber("-").value, undefined);
    assert.equal(parseCellNumber("85.3 / 90.1").value, undefined);
    assert.deepEqual(parseCellNumber("85.3 / 90.1").numbers, [85.3, 90.1]);
  });
});

describe("sentence splitting", () => {
  test("does not split after abbreviations or initials", () => {
    assert.deepEqual(splitSentences("Smith et al. Showed it. See Fig. 3 and Tab. 2. J. Doe agrees! Done."),
      ["Smith et al. Showed it.", "See Fig. 3 and Tab. 2.", "J. Doe agrees!", "Done."]);
  });
});

describe("hackathon read tools", () => {
  const tool = (name: string) => hackathonTools.find((t) => t.definition.name === name)!;

  test("the four tools exist, with plugin__tool names", () => {
    assert.deepEqual(hackathonTools.map((t) => t.definition.name),
      ["review__load_paper", "review__get_section", "review__get_table", "review__find_text", "review__submit_link", "review__finish"]);
  });

  test("before loading, the tools say what to do", async () => {
    await assert.rejects(tool("review__get_table").run({ id: "T1" }), /review__load_paper first/);
  });

  test("load, then read a section, a table and search", async () => {
    const summary = await tool("review__load_paper").run({ path: FIXTURE });
    assert.match(summary, /7 sentences \(S1 to S7\), 1 tables/);
    assert.match(summary, /T1 \[tab:main\], section 2.1, 4 rows x 3 columns: Accuracy/);

    const section = await tool("review__get_section").run({ name: "Results" });
    assert.match(section, /## 2 Results/);
    assert.match(section, /## 2.1 Main results\nS7: TinyNet outperforms/);           // subsections included

    const table = await tool("review__get_table").run({ id: "Table 1" });
    assert.match(table, /Column labels: c1 = Method \| c2 = Accuracy \(%\) \/ CIFAR-10/);
    assert.match(table, /r4 "TinyNet": T1.r4.c1: TinyNet \| T1.r4.c2: 85.3 ± 0.2 \| T1.r4.c3: 61.0 \(\+0.8\)/);

    assert.match(await tool("review__find_text").run({ query: "OUTPERFORMS resnet" }), /S7 \[section 2.1\]/);
    assert.match(await tool("review__find_text").run({ query: "nothing like this" }), /No sentence/);
  });
});

// ---------------------------------------------------------------------------
// Step 3: checks C1 to C4, labels, the claim map, baseline mode, skills

/** A one-table paper for checks the fixture cannot show. */
function smallPaper(sentence: string, header: string, rows: string): Paper {
  return parseLatex(String.raw`\begin{document}\begin{abstract}${sentence}\end{abstract}
\begin{table}\caption{Results.}\label{tab:r}\begin{tabular}{lc}${header} \\ ${rows}\end{tabular}\end{table}\end{document}`, { source: "x" });
}
const result = (checks: Check[], id: string) => checks.find((c) => c.id === id)!.result;

describe("checks on the fixture paper", () => {
  let paper: Paper;
  before(async () => { paper = await readLatexPaper(FIXTURE); });
  // S2: "It reaches 85.3% accuracy on CIFAR-10, e.g. better than ResNet-18 by 1.2 points."
  // T1.r3.c2 = 84.1 ± 0.3 (ResNet-18), T1.r4.c2 = 85.3 ± 0.2 (TinyNet), T1.r4.c3 = 61.0 (+0.8)

  test("C1 passes when every ID exists", () => {
    assert.equal(result(runChecks(paper, { claimId: "S2", evidenceIds: ["T1.r4.c2", "S7"] }), "C1"), "passed");
  });

  test("C1 fails on unknown IDs, a whole table, no evidence, or the claim citing itself", () => {
    for (const evidenceIds of [["T9.r1.c1"], ["S99"], ["T1"], [], ["S2"]]) {          // ["S2"]: only itself = no evidence
      const checks = runChecks(paper, { claimId: "S2", evidenceIds });
      assert.equal(result(checks, "C1"), "failed", JSON.stringify(evidenceIds));
      assert.equal(finalLabel(checks), "unsupported");
    }
    assert.equal(result(runChecks(paper, { claimId: "S999", evidenceIds: ["T1.r4.c2"] }), "C1"), "failed");
  });

  test("C2 passes when the claim's number is in a cited cell, fails when it is not", () => {
    assert.equal(result(runChecks(paper, { claimId: "S2", evidenceIds: ["T1.r4.c2"] }), "C2"), "passed");
    const wrong = runChecks(paper, { claimId: "S2", evidenceIds: ["T1.r3.c2"] });
    assert.equal(result(wrong, "C2"), "failed");
    assert.match(wrong.find((c) => c.id === "C2")!.reason, /85.3% not found.*Cite the cell/);
  });

  test("C3 passes when a pair of cited cells gives the stated difference, fails otherwise", () => {
    assert.equal(result(runChecks(paper, { claimId: "S2", evidenceIds: ["T1.r4.c2", "T1.r3.c2"] }), "C3"), "passed");   // 85.3 - 84.1
    assert.equal(result(runChecks(paper, { claimId: "S2", evidenceIds: ["T1.r4.c2", "T1.r3.c3"] }), "C3"), "failed");   // 85.3 - 60.2
    assert.equal(result(runChecks(paper, { claimId: "S2", evidenceIds: ["T1.r4.c2"] }), "C3"), "failed");               // one cell only
  });

  test("C4 passes in the right order, fails when reversed", () => {
    const comparison = { ours: "T1.r4.c2", baseline: "T1.r3.c2", higher_is_better: true };
    assert.equal(result(runChecks(paper, { claimId: "S7", evidenceIds: [], comparison }), "C4"), "passed");
    const reversed = { ours: "T1.r3.c2", baseline: "T1.r4.c2", higher_is_better: true };
    assert.equal(result(runChecks(paper, { claimId: "S7", evidenceIds: [], comparison: reversed }), "C4"), "failed");
    const otherColumn = { ours: "T1.r4.c3", baseline: "T1.r3.c2", higher_is_better: true };
    assert.equal(result(runChecks(paper, { claimId: "S7", evidenceIds: [], comparison: otherColumn }), "C4"), "failed");
  });

  test("C4 ignores a comparison when the claim sentence compares nothing", () => {
    // S1: "We present TinyNet, a small network." Two cells in the right order prove nothing about it.
    const checks = runChecks(paper, { claimId: "S1", evidenceIds: ["S7"], comparison: { ours: "T1.r4.c2", baseline: "T1.r3.c2", higher_is_better: true } });
    assert.equal(result(checks, "C4"), "not applicable");
    assert.match(checks.find((c) => c.id === "C4")!.reason, /makes no comparison/);
    assert.equal(finalLabel(checks), "unverified");
  });

  test("an ignored comparison is not evidence, and its IDs are not checked", () => {
    // What gpt-4o-mini did: a non-comparing claim, a sentence as evidence, and sentence IDs (even the claim) in comparison.
    const checks = runChecks(paper, { claimId: "S1", evidenceIds: ["S7"], comparison: { ours: "S1", baseline: "S7", higher_is_better: false } });
    assert.equal(result(checks, "C1"), "passed");
    assert.equal(finalLabel(checks), "unverified");
    const none = runChecks(paper, { claimId: "S1", evidenceIds: [], comparison: { ours: "T1.r4.c2", baseline: "T1.r3.c2", higher_is_better: true } });
    assert.equal(result(none, "C1"), "failed");                        // no evidence once the comparison is ignored
  });

  test("sentence IDs in a comparison: the comparison is ignored with a reason, the other evidence still counts", () => {
    const checks = runChecks(paper, { claimId: "S7", evidenceIds: ["T1.r4.c2"], comparison: { ours: "S6", baseline: "S5", higher_is_better: true } });
    assert.equal(result(checks, "C1"), "passed");
    assert.equal(result(checks, "C4"), "not applicable");
    assert.match(checks[3]!.reason, /must name two table cells.*ignored/);
  });

  test("labels: supported, unsupported, unverified", () => {
    const good = runChecks(paper, { claimId: "S2", evidenceIds: ["T1.r4.c2", "T1.r3.c2"],
                                    comparison: { ours: "T1.r4.c2", baseline: "T1.r3.c2", higher_is_better: true } });
    assert.deepEqual(good.map((c) => c.result), ["passed", "passed", "passed", "passed"]);
    assert.equal(finalLabel(good), "supported");
    assert.equal(finalLabel(runChecks(paper, { claimId: "S2", evidenceIds: ["T1.r3.c2"] })), "unsupported");
    const qualitative = runChecks(paper, { claimId: "S1", evidenceIds: ["S7"] });            // "We present TinyNet, a small network."
    assert.deepEqual(qualitative.map((c) => c.result), ["passed", "not applicable", "not applicable", "not applicable"]);
    assert.equal(finalLabel(qualitative), "unverified");
  });
});

describe("numbers in claims", () => {
  const values = (s: string) => claimNumbers(s).map((n) => [n.raw, n.derived ? n.derived.unit || "diff" : "plain"]);

  test("skips years, references, names, labels and p-values", () => {
    assert.deepEqual(values("In 2023, ResNet-50 and GPT-4 reached 76.1 on CIFAR-10 (Table 2, Fig. 3, Section 4) [sec:2], p < 0.05, with a 7B model."),
      [["76.1", "plain"]]);
  });

  test("marks differences: by X points, X% better, +X, Xx faster", () => {
    assert.deepEqual(values("We improve by 1.2 points and are 12% better, +0.8 on F1, 2.5x faster, a 3-point gain."),
      [["1.2", "points"], ["12%", "%"], ["0.8", "diff"], ["2.5", "ratio"], ["3", "points"]]);
  });

  test("rounding to the claim's decimals, and percent versus fraction", () => {
    assert.ok(matchesNumber({ value: 85, decimals: 0 }, 85.3));       // "85%" vs 85.3
    assert.ok(matchesNumber({ value: 85.3, decimals: 1 }, 85.34));
    assert.ok(!matchesNumber({ value: 85.4, decimals: 1 }, 85.3));
    assert.ok(matchesNumber({ value: 85.3, decimals: 1 }, 0.853));     // "85.3%" vs 0.853
    assert.ok(matchesNumber({ value: 0.85, decimals: 2 }, 85.3));      // "0.85" vs 85.3%
    assert.ok(!matchesNumber({ value: 85.3, decimals: 1 }, 8.53));
  });

  test("bounds: over, up to, about", () => {
    const [over] = claimNumbers("It reaches over 90% recall.");
    assert.ok(matchesNumber(over!, 92.4) && !matchesNumber(over!, 88));
    const [about] = claimNumbers("It takes about 2 hours.");
    assert.ok(matchesNumber(about!, 2.08) && !matchesNumber(about!, 2.6));
  });

  test("C3: a relative difference and a ratio recompute from the cells", () => {
    const rel = smallPaper("Ours improves accuracy by 12% over the baseline.", "Method & Acc", "Base & 50.0 \\\\ Ours & 56.0 \\\\");
    assert.equal(result(runChecks(rel, { claimId: "S1", evidenceIds: ["T1.r2.c2", "T1.r3.c2"] }), "C3"), "passed");   // 6 / 50 = 12%
    const ratio = smallPaper("Ours is 2x faster than the baseline.", "Method & Time", "Base & 10.0 \\\\ Ours & 5.0 \\\\");
    assert.equal(result(runChecks(ratio, { claimId: "S1", evidenceIds: ["T1.r2.c2", "T1.r3.c2"] }), "C3"), "passed");
  });

  test("C4: a lower-is-better column with higher_is_better true fails with a reason", () => {
    const p = smallPaper("Ours has a lower error than the baseline.", "Method & Error", "Base & 5.2 \\\\ Ours & 4.1 \\\\");
    const wrong = runChecks(p, { claimId: "S1", evidenceIds: [], comparison: { ours: "T1.r3.c2", baseline: "T1.r2.c2", higher_is_better: true } });
    assert.equal(result(wrong, "C4"), "failed");
    assert.match(wrong.find((c) => c.id === "C4")!.reason, /lower is better/);
    const right = runChecks(p, { claimId: "S1", evidenceIds: [], comparison: { ours: "T1.r3.c2", baseline: "T1.r2.c2", higher_is_better: false } });
    assert.equal(result(right, "C4"), "passed");
  });
});

describe("submit_link, finish and baseline mode", () => {
  const tool = (name: string) => hackathonTools.find((t) => t.definition.name === name)!;
  let folder: string;
  before(async () => {
    folder = await mkdtemp(path.join(os.tmpdir(), "tygig-review-"));
    await cp(FIXTURE, folder, { recursive: true });          // finish writes next to the paper: use a copy
  });

  test("checks mode: label and check results; resubmitting keeps the latest and counts attempts", async () => {
    delete process.env.TYGIG_REVIEW_CHECKS;
    await tool("review__load_paper").run({ path: folder });
    const first = await tool("review__submit_link").run({ claim_sentence_id: "S2", evidence_ids: ["T1.r3.c2"], model_label: "supported" });
    assert.match(first, /^S2: Unsupported \(attempt 1; your label: supported\)/);
    assert.match(first, /C2 Number match: failed/);
    const second = await tool("review__submit_link").run({
      claim_sentence_id: "s2", evidence_ids: "T1.r4.c2, T1.r3.c2", model_label: "supported",       // lower-case ID, IDs as one string
      comparison: { ours: "T1.r4.c2", baseline: "T1.r3.c2", higher_is_better: true } });
    assert.match(second, /^S2: Supported \(attempt 2/);
    await tool("review__submit_link").run({ claim_sentence_id: "S1", evidence_ids: ["S7"], model_label: "supported" });

    const map = currentClaimMap()!;
    assert.equal(map.mode, "checks");
    assert.deepEqual(map.claims.map((c) => [c.claimId, c.label, c.attempts]), [["S1", "unverified", 1], ["S2", "supported", 2]]);
    assert.deepEqual(map.counts, { supported: 1, unsupported: 0, unverified: 1 });
  });

  test("finish writes claim-map.json and claim-map.md next to the paper", async () => {
    const out = await tool("review__finish").run({});
    assert.match(out, /2 claims \(supported 1, unsupported 0, unverified 1\)/);
    const json = JSON.parse(await readFile(path.join(folder, "claim-map.json"), "utf8"));
    assert.equal(json.claims[1].text, "It reaches 85.3% accuracy on CIFAR-10, e.g. better than ResNet-18 by 1.2 points.");
    assert.equal(json.claims[1].evidence.find((e: any) => e.id === "T1.r4.c2").value, 85.3);   // earlier evidence (T1.r3.c2) kept first
    assert.equal(json.claims[1].checks.length, 4);
    const md = await readFile(path.join(folder, "claim-map.md"), "utf8");
    assert.match(md, /## S2: Supported/);
    assert.match(md, /- T1.r4.c2: 85.3 ± 0.2 \(row "TinyNet", column "Accuracy \(%\) \/ CIFAR-10"\)/);
    assert.match(md, /\| Supported \| 1 \|/);
  });

  test("baseline mode (TYGIG_REVIEW_CHECKS=off): same tools, no checks, the model's label is kept", async () => {
    process.env.TYGIG_REVIEW_CHECKS = "off";
    try {
      await tool("review__load_paper").run({ path: folder });                     // a new paper: a new claim map
      const out = await tool("review__submit_link").run({ claim_sentence_id: "S2", evidence_ids: ["T9.r9.c9"], model_label: "supported" });
      assert.equal(out, "S2: recorded (attempt 1).");
      const map = currentClaimMap()!;
      assert.equal(map.mode, "baseline");
      assert.deepEqual(map.claims.map((c) => [c.label, c.checks.length]), [["supported", 0]]);
      assert.match(await tool("review__finish").run({}), /baseline, checks off/);
    } finally {
      delete process.env.TYGIG_REVIEW_CHECKS;
    }
  });

  test("bad input gets a clear message", async () => {
    await assert.rejects(tool("review__submit_link").run({ claim_sentence_id: "S2", evidence_ids: [], model_label: "maybe" }), /model_label must be/);
    await assert.rejects(tool("review__submit_link").run({ claim_sentence_id: "S2", evidence_ids: [], model_label: "supported", comparison: { ours: "T1.r4.c2" } }), /comparison needs/);
  });
});

describe("review skills", () => {
  test("both SKILL.md files load, with name and description", () => {
    const skills = loadSkills();
    assert.deepEqual(skills.map((s) => s.name), ["find-claims", "link-evidence"]);
    assert.ok(skills.every((s) => s.description.length > 20 && s.body.length > 100));
  });

  test("the instructions carry the skills and name all six tools", () => {
    const text = buildInstructions("C:\\project");
    assert.match(text, /<skill name="find-claims">/);
    assert.match(text, /<skill name="link-evidence">/);
    for (const t of hackathonTools) assert.ok(text.includes(t.definition.name), t.definition.name);
  });
});

// ---------------------------------------------------------------------------
// After the LoRA test run: ratios in words, numbers stated in the text, "on par", any model's input

describe("fixes from the LoRA run", () => {
  test("'by 10,000 times', '3-fold' and '10,000×' are ratios", () => {
    const units = (s: string) => claimNumbers(s).map((n) => [n.raw, n.derived?.unit]);
    assert.deepEqual(units("It cuts parameters by 10,000 times and memory by 3 times."), [["10,000", "ratio"], ["3", "ratio"]]);
    assert.deepEqual(units("A 3-fold speed-up and 10,000× fewer parameters."), [["3", "ratio"], ["10,000", "ratio"]]);
  });

  test("C3 passes when a cited sentence states the number, and says it was not recomputed", () => {
    const paper = parseLatex(String.raw`\begin{document}\begin{abstract}
LoRA reduces the trainable parameters by 10,000 times and the memory by 3 times.
The checkpoint is reduced by roughly 10,000× (from 350GB to 35MB).
Memory use drops from 1.2TB to 350GB, a 3× reduction.
\end{abstract}\end{document}`, { source: "x" });
    const one = runChecks(paper, { claimId: "S1", evidenceIds: ["S2"] });
    assert.equal(result(one, "C3"), "failed");                                    // "3 times" is not in S2
    assert.match(one.find((c) => c.id === "C3")!.reason, /^3 does not follow/);
    const both = runChecks(paper, { claimId: "S1", evidenceIds: ["S2", "S3"] });
    assert.equal(result(both, "C3"), "passed");
    assert.match(both.find((c) => c.id === "C3")!.reason, /10,000 = recomputed from S2 \("from 350GB to 35MB"\)/);   // units converted
    assert.match(both.find((c) => c.id === "C3")!.reason, /3 = recomputed from S3 \("from 1.2TB to 350GB"\): from \/ to = 3.43/);
    // Rule R1: only sentences support it (no table cells), so at most Unverified.
    assert.match(both.find((c) => c.id === "C3")!.reason, /\(only in text\).*Text alone cannot make a claim Supported/);
    assert.equal(finalLabel(both), "unverified");
  });

  test("C4: 'on par' passes within 1% of the baseline, fails further away", () => {
    const close = smallPaper("LoRA performs on-par or better than fine-tuning.", "Method & Avg", "FT & 88.9 \\\\ LoRA & 88.6 \\\\");
    const comparison = { ours: "T1.r3.c2", baseline: "T1.r2.c2", higher_is_better: true };
    const ok = runChecks(close, { claimId: "S1", evidenceIds: ["T1.r3.c2", "T1.r2.c2"], comparison });
    assert.equal(result(ok, "C4"), "passed");
    assert.match(ok.find((c) => c.id === "C4")!.reason, /within 1%/);
    const far = smallPaper("LoRA performs on-par with fine-tuning.", "Method & Avg", "FT & 88.9 \\\\ LoRA & 85.0 \\\\");
    assert.equal(result(runChecks(far, { claimId: "S1", evidenceIds: ["T1.r3.c2"], comparison }), "C4"), "failed");
    const strict = smallPaper("LoRA outperforms fine-tuning.", "Method & Avg", "FT & 88.9 \\\\ LoRA & 88.6 \\\\");
    assert.equal(result(runChecks(strict, { claimId: "S1", evidenceIds: ["T1.r3.c2"], comparison }), "C4"), "failed");   // "outperforms" is not "on par"
  });

  test("IDs written in other ways are understood", () => {
    assert.equal(normaliseId("[S12]"), "S12");
    assert.equal(normaliseId("s12:"), "S12");
    assert.equal(normaliseId(12), "S12");
    assert.equal(normaliseId("T1.R2.C3"), "T1.r2.c3");
    assert.equal(normaliseId("T1 r2 c3"), "T1.r2.c3");
    assert.equal(normaliseId("'T1.r2.c3'"), "T1.r2.c3");
  });

  test("submit_link accepts the argument styles of different models, and saves the map at once", async () => {
    const tool = (name: string) => hackathonTools.find((x) => x.definition.name === name)!;
    const folder = await mkdtemp(path.join(os.tmpdir(), "tygig-review-"));
    await cp(FIXTURE, folder, { recursive: true });
    await tool("review__load_paper").run({ path: folder });
    const out = await tool("review__submit_link").run({
      claim_sentence_id: 7,                                                  // a number, not "S7"
      evidence_ids: '["T1.r4.c2", "T1.r3.c2"]',                              // JSON inside a string
      comparison: '{"ours": "T1.r4.c2", "baseline": "T1.r3.c2", "higher_is_better": "TRUE"}',
      model_label: "Supported.",
    });
    assert.match(out, /^S7: Supported/);
    const saved = JSON.parse(await readFile(path.join(folder, "claim-map.json"), "utf8"));   // written without finish
    assert.equal(saved.claims[0].claimId, "S7");
  });
});

// ---------------------------------------------------------------------------
// After the second LoRA run: comparisons with a baseline the claim does not name,
// speculation, and sizes such as 4.7M

describe("fixes from the second LoRA run", () => {
  // A latency table like LoRA's Table 1: the claim is about fine-tuning, the cited baseline is an adapter.
  const latency = () => parseLatex(String.raw`\begin{document}\begin{abstract}
LoRA adds no inference latency compared to a fully fine-tuned model.
LoRA is faster than adapters at inference.
The rank-deficiency suggests that W could be rank-deficient as well.
\end{abstract}
\begin{tabular}{lc} Method & Latency (ms) \\ Fine-Tune/LoRA & 1449.4 \\ Adapter L & 1482.0 \\ \end{tabular}\end{document}`, { source: "x" });

  test("a comparison with a baseline the claim does not name is ignored (no false 'supported')", () => {
    const p = latency();
    const checks = runChecks(p, { claimId: "S1", evidenceIds: ["T1.r2.c2"], comparison: { ours: "T1.r2.c2", baseline: "T1.r3.c2", higher_is_better: false } });
    assert.equal(result(checks, "C4"), "not applicable");
    assert.match(checks[3]!.reason, /does not name the baseline "Adapter L"/);
    assert.equal(finalLabel(checks), "unverified");
  });

  test("the same cells pass for a claim that names the baseline (plural 'adapters' matches 'Adapter')", () => {
    const p = latency();
    const checks = runChecks(p, { claimId: "S2", evidenceIds: [], comparison: { ours: "T1.r2.c2", baseline: "T1.r3.c2", higher_is_better: false } });
    assert.equal(result(checks, "C4"), "passed");
    assert.equal(finalLabel(checks), "supported");
  });

  test("speculation without evidence is unverified, not unsupported", () => {
    const checks = runChecks(latency(), { claimId: "S3", evidenceIds: [] });
    assert.equal(result(checks, "C1"), "passed");
    assert.match(checks[0]!.reason, /speculation \("suggests"\)/);
    assert.equal(finalLabel(checks), "unverified");
  });

  test("sizes in cells: 4.7M, 175B, 100k", () => {
    assert.equal(parseCellNumber("4.7M").value, 4_700_000);
    assert.equal(parseCellNumber("175,255.8M").value, 175_255_800_000);
    assert.equal(parseCellNumber("175B").value, 175e9);
    assert.equal(parseCellNumber("100k").value, 100_000);
    assert.equal(parseCellNumber("7Bn").value, undefined);       // not a size suffix
  });
});

// ---------------------------------------------------------------------------
// After the third LoRA run: "GPT-3" is not the number 3; citing the claim itself

describe("fixes from the third LoRA run", () => {
  const paper = () => parseLatex(String.raw`\begin{document}\begin{abstract}
LoRA reduces the trainable parameters by 10,000 times and the memory by 3 times.
We focus on GPT-3 175B, where we achieved a reduction of up to 10,000×.
We believe that LoRA could help future work.
\end{abstract}\end{document}`, { source: "x" });

  test("the 3 in 'GPT-3' does not count as the claim's '3 times'", () => {
    const checks = runChecks(paper(), { claimId: "S1", evidenceIds: ["S2"] });
    assert.equal(result(checks, "C3"), "failed");
    assert.match(checks[2]!.reason, /^3 does not follow/);
  });

  test("a claim citing itself: that ID is dropped and the rest is checked", () => {
    const checks = runChecks(paper(), { claimId: "S1", evidenceIds: ["S1", "S2"] });
    assert.equal(result(checks, "C1"), "passed");
    assert.match(checks[0]!.reason, /S1 was cited as its own evidence; that was ignored/);
  });

  test("speculation citing only itself is unverified, not unsupported", () => {
    const checks = runChecks(paper(), { claimId: "S3", evidenceIds: ["S3"] });
    assert.equal(result(checks, "C1"), "passed");
    assert.equal(finalLabel(checks), "unverified");
  });
});

// ---------------------------------------------------------------------------
// After the fourth LoRA run: setting rows above the results, and the "ours" row

describe("fixes from the fourth LoRA run", () => {
  // Like LoRA's Table 1: two setting rows of whole numbers, then measured rows.
  const latency = () => parseLatex(String.raw`\begin{document}\begin{abstract}
LoRA neither introduces inference latency nor reduces input sequence length.
LoRA is faster than adapters.
Our method is faster than adapters.
\end{abstract}
\begin{tabular}{lccc} Batch Size & 32 & 16 & 1 \\ Sequence Length & 512 & 256 & 128 \\
Fine-Tune/LoRA & 1449.4 $\pm$ 0.8 & 338.0 $\pm$ 0.6 & 19.8 $\pm$ 2.7 \\
Adapter$^L$ & 1482.0 $\pm$ 1.0 & 354.8 $\pm$ 0.5 & 23.9 $\pm$ 2.1 \\ \end{tabular}\end{document}`, { source: "x" });

  test("rows of whole-number settings above measured rows are headers", () => {
    const t = latency().tables[0]!;
    assert.equal(t.headerRows, 2);
    assert.equal(t.cells.find((c) => c.id === "T1.r4.c4")!.colLabel, "1 / 128");
  });

  test("a comparison whose 'ours' row the claim does not name is ignored", () => {
    // What gpt-4.1 did: ours = an adapter row, baseline = a setting row, for a claim about LoRA.
    const p = latency();
    const checks = runChecks(p, { claimId: "S1", evidenceIds: [], comparison: { ours: "T1.r4.c4", baseline: "T1.r2.c4", higher_is_better: false } });
    assert.notEqual(finalLabel(checks), "supported");
    const right = runChecks(p, { claimId: "S2", evidenceIds: [], comparison: { ours: "T1.r3.c4", baseline: "T1.r4.c4", higher_is_better: false } });
    assert.equal(result(right, "C4"), "passed");                         // LoRA (19.8) vs Adapter (23.9)
    const swapped = runChecks(p, { claimId: "S2", evidenceIds: [], comparison: { ours: "T1.r4.c4", baseline: "T1.r3.c4", higher_is_better: false } });
    assert.notEqual(finalLabel(swapped), "supported");                   // ours and baseline swapped: never supported
    const header = runChecks(p, { claimId: "S2", evidenceIds: ["T1.r3.c4"], comparison: { ours: "T1.r3.c4", baseline: "T1.r2.c4", higher_is_better: false } });
    assert.match(header[3]!.reason, /header cell/);
  });
});

// ---------------------------------------------------------------------------
// After the session-log review (fixes 1 to 4 and 6)

describe("fixes from the session-log review", () => {
  const tool = (name: string) => hackathonTools.find((x) => x.definition.name === name)!;

  test("get_section accepts the heading as the summary shows it: '1 Introduction'", async () => {
    await tool("review__load_paper").run({ path: FIXTURE });
    assert.match(await tool("review__get_section").run({ name: "1 Introduction" }), /^## 1 Introduction/);
    assert.match(await tool("review__get_section").run({ name: "2.1 Main results" }), /^## 2.1 Main results/);
    assert.match(await tool("review__get_section").run({ name: "Section 2" }), /^## 2 Results/);
  });

  test("a failed number check says where else the number is in the paper", () => {
    const p = parseLatex(String.raw`\begin{document}\begin{abstract}
LoRA cuts memory by 3 times and reaches 91.7 on MNLI.
We describe the method.
\end{abstract}\section{Results}
VRAM use drops from 1.2TB to 350GB.
\begin{tabular}{lc} Method & MNLI \\ LoRA & 91.7 \\ \end{tabular}\end{document}`, { source: "x" });
    const checks = runChecks(p, { claimId: "S1", evidenceIds: ["S2"] });
    assert.match(checks[1]!.reason, /91.7 may be in T1.r2.c2/);          // C2: the cell
    assert.match(checks[2]!.reason, /3 is found only in text \(S3\); text alone cannot make a claim Supported/);  // C3: the "from X to Y" sentence
    const fixed = runChecks(p, { claimId: "S1", evidenceIds: ["T1.r2.c2", "S3"] });
    assert.equal(finalLabel(fixed), "unverified");                       // rule R1: "3 times" is only in text (S3)
  });

  test("header cells cited as evidence are dropped with a note", () => {
    const p = parseLatex(String.raw`\begin{document}\begin{abstract}LoRA reaches 91.7 on MNLI.\end{abstract}
\begin{tabular}{lc} Method & MNLI \\ LoRA & 91.7 \\ \end{tabular}\end{document}`, { source: "x" });
    const checks = runChecks(p, { claimId: "S1", evidenceIds: ["T1.r1.c2", "T1.r2.c2"] });
    assert.match(checks[0]!.reason, /T1.r1.c2 is a header cell, not a result; it was ignored/);
    assert.equal(finalLabel(checks), "supported");
  });

  test("several comparisons: all must pass", () => {
    const p = parseLatex(String.raw`\begin{document}\begin{abstract}LoRA performs on-par or better than fine-tuning on RoBERTa and GPT-3.\end{abstract}
\begin{tabular}{lcc} Method & RoBERTa & GPT-3 \\ FT & 88.9 & 73.8 \\ LoRA & 89.0 & 70.0 \\ \end{tabular}\end{document}`, { source: "x" });
    const one = { ours: "T1.r3.c2", baseline: "T1.r2.c2", higher_is_better: true };
    const two = { ours: "T1.r3.c3", baseline: "T1.r2.c3", higher_is_better: true };
    assert.equal(result(runChecks(p, { claimId: "S1", evidenceIds: [], comparisons: [one] }), "C4"), "passed");
    const both = runChecks(p, { claimId: "S1", evidenceIds: [], comparisons: [one, two] });
    assert.equal(result(both, "C4"), "failed");                          // GPT-3: 70.0 is 5% below 73.8
    assert.match(both[3]!.reason, /^2 comparisons checked/);
  });

  test("list options such as [topsep=6pt] are not sentences", () => {
    const p = parseLatex(String.raw`\begin{document}\begin{itemize}[topsep=6pt,itemsep=3pt]\item First point.\item Second point.\end{itemize}\end{document}`, { source: "x" });
    assert.deepEqual(p.sentences.map((s) => s.text), ["First point.", "Second point."]);
  });
});

// ---------------------------------------------------------------------------
// After the fifth LoRA run: the model replaced its evidence instead of adding to it

describe("evidence is kept across attempts", () => {
  const tool = (name: string) => hackathonTools.find((x) => x.definition.name === name)!;

  test("attempt 1 explains one number, attempt 2 the other: together they support the claim", async () => {
    const folder = await mkdtemp(path.join(os.tmpdir(), "tygig-review-"));
    await cp(FIXTURE, folder, { recursive: true });
    await tool("review__load_paper").run({ path: folder });
    // S2: "It reaches 85.3% accuracy on CIFAR-10, e.g. better than ResNet-18 by 1.2 points."
    const first = await tool("review__submit_link").run({ claim_sentence_id: "S2", evidence_ids: ["T1.r4.c2", "T9.r9.c9"], model_label: "supported" });
    assert.match(first, /^S2: Unsupported/);                                   // T9.r9.c9 does not exist; 1.2 needs a second cell
    const second = await tool("review__submit_link").run({ claim_sentence_id: "S2", evidence_ids: ["T1.r3.c2"], model_label: "supported" });
    assert.match(second, /^S2: Supported \(attempt 2/);                       // T1.r4.c2 kept, T9.r9.c9 dropped
    const entry = currentClaimMap()!.claims.find((c) => c.claimId === "S2")!;
    assert.deepEqual(entry.evidence.map((e) => e.id), ["T1.r4.c2", "T1.r3.c2"]);
  });

  test("a failed attempt says which evidence is kept", async () => {
    await tool("review__load_paper").run({ path: FIXTURE });
    const out = await tool("review__submit_link").run({ claim_sentence_id: "S2", evidence_ids: ["T1.r4.c2"], model_label: "supported" });
    assert.match(out, /Evidence kept for S2: T1.r4.c2\. It stays when you submit this claim again/);
  });
});

// ---------------------------------------------------------------------------
// After the sixth LoRA run: reading sentences by ID; the claim is not listed as its own evidence

describe("reading sentences by ID, and no self-evidence in the map", () => {
  const tool = (name: string) => hackathonTools.find((x) => x.definition.name === name)!;

  test("get_section with sentence IDs returns each sentence with its neighbours", async () => {
    await tool("review__load_paper").run({ path: FIXTURE });
    const out = await tool("review__get_section").run({ name: "S4, s99" });
    assert.match(out, /^## S4, in 1 Introduction\nS3: Deep networks are large\.\nS4 \(asked\): We propose TinyNet/);
    assert.match(out, /S5: Fig\. 2 shows nothing\./);
    assert.match(out, /S99: no sentence with this ID \(the paper has S1 to S7\)/);
  });

  test("a claim citing itself is not listed in its evidence", async () => {
    await tool("review__load_paper").run({ path: FIXTURE });
    await tool("review__submit_link").run({ claim_sentence_id: "S7", evidence_ids: ["S7", "T1.r4.c2"], model_label: "supported" });
    const entry = currentClaimMap()!.claims.find((c) => c.claimId === "S7")!;
    assert.deepEqual(entry.evidence.map((e) => e.id), ["T1.r4.c2"]);
  });
});

describe("rule R1: every number must be matched in a cited table cell", () => {
  const p = parseLatex(String.raw`\begin{document}\begin{abstract}
TinyNet reaches 85.3 on CIFAR-10.
\end{abstract}\section{Results}
Our model reaches 85.3 on CIFAR-10, as the table shows.
Removing pruning gives 61.2.
\begin{tabular}{lc} Method & CIFAR-10 \\ TinyNet & 85.3 \\ \end{tabular}\end{document}`, { source: "x" });

  test("a number matched only in a sentence gives Unverified, with the reason", () => {
    const checks = runChecks(p, { claimId: "S1", evidenceIds: ["S2"] });
    const c2 = checks.find((c) => c.id === "C2")!;
    assert.equal(c2.result, "passed");
    assert.equal(c2.data, false);
    assert.match(c2.reason, /^85\.3: only in text \(S2\)\. Text alone cannot make a claim Supported/);
    assert.equal(finalLabel(checks), "unverified");
  });

  test("the same number in a cited table cell gives Supported; the reason says which cell", () => {
    const checks = runChecks(p, { claimId: "S1", evidenceIds: ["T1.r2.c2", "S2"] });
    const c2 = checks.find((c) => c.id === "C2")!;
    assert.equal(c2.data, true);
    assert.equal(c2.reason, "85.3: table cell T1.r2.c2.");
    assert.equal(finalLabel(checks), "supported");
  });

  test("one number in a cell and another only in text gives Unverified (the pilot's S38 case)", () => {
    const q = parseLatex(String.raw`\begin{document}\begin{abstract}
TinyNet-2 and TinyNet-3 reach 81.04 and 81.60.
\end{abstract}\section{Results}
TinyNet-2 obtains 81.04.
\begin{tabular}{lc} Method & AVG \\ TinyNet-2 & 68.88 \\ TinyNet-3 & 81.60 \\ \end{tabular}\end{document}`, { source: "x" });
    const checks = runChecks(q, { claimId: "S1", evidenceIds: ["T1.r2.c2", "T1.r3.c2", "S2"] });
    const c2 = checks.find((c) => c.id === "C2")!;
    assert.match(c2.reason, /^81\.04: only in text \(S2\); 81\.60: table cell T1\.r3\.c2\./);
    assert.equal(finalLabel(checks), "unverified");
    const missing = runChecks(q, { claimId: "S1", evidenceIds: ["T1.r3.c2"] });
    assert.match(missing.find((c) => c.id === "C2")!.reason, /Per number: 81\.04: not found; 81\.60: table cell T1\.r3\.c2\./);
    assert.equal(finalLabel(missing), "unsupported");
  });

  test("checks without the data field (older maps, hand-made checks) keep their label", () => {
    const old: Check[] = [{ id: "C1", name: "Exists", result: "passed", reason: "" }, { id: "C2", name: "Number match", result: "passed", reason: "" }];
    assert.equal(finalLabel(old), "supported");
  });

  test("the where-else hint lists table cells first, and says when a number is only in text", () => {
    const wrong = runChecks(p, { claimId: "S1", evidenceIds: ["S3"] });
    assert.match(wrong[1]!.reason, /85\.3 may be in T1\.r2\.c2 \(also stated in text: S2\)/);
    const q = parseLatex(String.raw`\begin{document}\begin{abstract}
Removing pruning gives 61.2.
We describe it.
\end{abstract}\section{Results}
Without pruning the score is 61.2.
\end{document}`, { source: "x" });
    const only = runChecks(q, { claimId: "S1", evidenceIds: ["S2"] });
    assert.match(only[1]!.reason, /61\.2 is found only in text \(S3\); text alone cannot make a claim Supported/);
  });
});
