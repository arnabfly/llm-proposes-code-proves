// evals.test.ts - the benchmark scripts: planting faults (evals/lib/plant.ts) and the metrics
// (evals/lib/metrics.ts). No model calls: plant works on the fixture paper, metrics on a small
// hand-made results set with known answers.

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { cp, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readLatexPaper } from "../packages/cli/src/review/parser.ts";
import { claimNumbers, matchesNumber, type Check } from "../packages/cli/src/review/checks.ts";
import { cellById, changedNumber, inflate, plantVersion, type Fault, type Target, type VersionEntry } from "../evals/lib/plant.ts";
import { block, computeMetrics, summaryMarkdown, verdict } from "../evals/lib/metrics.ts";
import { appendFile } from "node:fs/promises";
import type { RunResult } from "../evals/lib/results.ts";
import { workDir, type RunStats } from "../evals/lib/agent-run.ts";
import { devPapers, hashSource, paperSource, readPapers, registerPaper, relocatePaper, setDev } from "../evals/lib/papers.ts";

const FIXTURE = fileURLToPath(new URL("./fixtures/paper", import.meta.url));
const CLAIM = "It reaches 85.3% accuracy on CIFAR-10, e.g. better than ResNet-18 by 1.2 points.";
const OURS = "T1.r4.c2", BASE = "T1.r3.c2";   // 85.3 ± 0.2 (TinyNet), 84.1 ± 0.3 (ResNet-18)

const target: Target = {
  paperId: "fixture", targetId: "S2", claimText: CLAIM,
  evidenceIds: [OURS, BASE], comparisons: [{ ours: OURS, baseline: BASE, higher_is_better: true }],
  confirmed: true,
};

async function plant(fault: Fault, t: Target = target) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "tygig-plant-"));
  const entry = await plantVersion(FIXTURE, t, fault, dir);
  const paper = await readLatexPaper(path.join(dir, "src"));
  return { entry, paper, dir };
}

describe("plant: faults on the fixture paper", () => {
  test("clean: a valid, unchanged copy", async () => {
    const { entry, paper } = await plant("clean");
    assert.equal(entry.valid, true);
    assert.equal(entry.expected, "supported");
    assert.deepEqual(entry.changes, []);
    assert.equal(cellById(paper, OURS)?.value, 85.3);
    assert.ok(paper.sentences.some((s) => s.text === CLAIM));
  });

  test("F1: the cited cell gets another number, same format, worse for ours; nothing else changes", async () => {
    const { entry, paper } = await plant("F1");
    assert.equal(entry.valid, true, entry.reason);
    assert.equal(entry.expected, "unsupported");
    assert.equal(entry.cell, OURS);
    const v = cellById(paper, OURS)!.value!;
    assert.ok(v < 85.3, `ours should get worse, got ${v}`);
    assert.match(String(v), /^\d+\.\d$/);                        // one decimal, like 85.3
    assert.equal(matchesNumber(claimNumbers(CLAIM)[0]!, v), false);  // the claim's 85.3% no longer matches
    assert.equal(cellById(paper, BASE)?.value, 84.1);
    assert.ok(paper.sentences.some((s) => s.text === CLAIM));    // the claim is untouched
    assert.equal(entry.changes.length, 1);
    assert.match(entry.changes[0]!.file, /results\.tex$/);
  });

  test("F2: one number in the claim changes; the manifest has the new claim text", async () => {
    const { entry, paper } = await plant("F2");
    assert.equal(entry.valid, true, entry.reason);
    assert.notEqual(entry.claimText, CLAIM);
    assert.match(entry.claimText, /98\.1%/);
    assert.ok(paper.sentences.some((s) => s.text === entry.claimText));
    assert.equal(cellById(paper, OURS)?.value, 85.3);           // the table is untouched
  });

  test("F3: ours and baseline values are swapped", async () => {
    const { entry, paper } = await plant("F3");
    assert.equal(entry.valid, true, entry.reason);
    assert.equal(cellById(paper, OURS)?.value, 84.1);
    assert.equal(cellById(paper, BASE)?.value, 85.3);
    assert.equal(entry.changes.length, 2);
    assert.deepEqual(entry.cells, [{ id: OURS, old: "85.3 ± 0.2", new: "84.1 ± 0.2" }, { id: BASE, old: "84.1 ± 0.3", new: "85.3 ± 0.3" }]);
  });

  test("F4: the cited cell becomes --, with no number left in it", async () => {
    const { entry, paper } = await plant("F4");
    assert.equal(entry.valid, true, entry.reason);
    const cell = cellById(paper, OURS)!;
    assert.equal(cell.value, undefined);
    assert.equal(cell.numbers.includes(85.3), false);
    assert.equal(cellById(paper, BASE)?.value, 84.1);
  });

  test("F5: invalid when the claim has no 'comparable / on par' wording", async () => {
    const { entry } = await plant("F5");
    assert.equal(entry.valid, false);
    assert.match(entry.reason!, /comparable|on par/);
  });

  test("validity: a claim not found by its text makes every version invalid", async () => {
    const { entry } = await plant("F1", { ...target, claimText: "This sentence is not in the paper." });
    assert.equal(entry.valid, false);
    assert.match(entry.reason!, /not in the paper/);
  });

  test("validity: F3 without a comparison is invalid", async () => {
    const { entry } = await plant("F3", { ...target, comparisons: [] });
    assert.equal(entry.valid, false);
    assert.match(entry.reason!, /comparison/);
  });

  test("validity: F1 with no number in the cited cell is invalid", async () => {
    const { entry } = await plant("F1", { ...target, evidenceIds: ["S7"], comparisons: [], primaryCell: "T1.r1.c2" });
    assert.equal(entry.valid, false);
  });

  test("F1 and F4 change every cell with the same number and column label; a same number in another column stays", async () => {
    const src = await mkdtemp(path.join(os.tmpdir(), "tygig-twin-"));
    await writeFile(path.join(src, "main.tex"), String.raw`\documentclass{article}\begin{document}
\begin{abstract}TinyNet reaches an AVG of 81.04.\end{abstract}
\section{Results}
\begin{tabular}{lcc} Method & QA & AVG \\ Baseline & 81.04 & 77.10 \\ TinyNet & 92.00 & 81.04 \\ \end{tabular}
\section{Ablation}
\begin{tabular}{lc} Variant & AVG \\ Full TinyNet & 81.04 \\ No pruning & 78.64 \\ \end{tabular}
\end{document}`);
    const t: Target = { paperId: "twin", targetId: "S1", claimText: "TinyNet reaches an AVG of 81.04.",
                        evidenceIds: ["T1.r3.c3"], comparisons: [], confirmed: true };
    for (const fault of ["F1", "F4"] as Fault[]) {
      const dir = await mkdtemp(path.join(os.tmpdir(), "tygig-plant-"));
      const entry = await plantVersion(src, t, fault, dir);
      assert.equal(entry.valid, true, entry.reason);
      assert.equal(entry.cell, "T1.r3.c3, T2.r2.c2");                     // both AVG cells
      assert.equal(entry.cells!.length, 2);
      assert.deepEqual(entry.cells!.map((c) => [c.id, c.old]), [["T1.r3.c3", "81.04"], ["T2.r2.c2", "81.04"]]);
      assert.equal(entry.cells![0]!.new, fault === "F1" ? "68.88" : "-");
      const paper = await readLatexPaper(path.join(dir, "src"));
      assert.equal(cellById(paper, "T1.r2.c2")?.value, 81.04);              // QA column: same number by chance, left alone
      assert.equal(cellById(paper, "T2.r3.c2")?.value, 78.64);
    }
  });

  test("the source folder itself is never changed", async () => {
    await plant("F3");
    const text = await readFile(path.join(FIXTURE, "sections", "results.tex"), "utf8");
    assert.match(text, /\\textbf\{85\.3\} \$\\pm\$ 0\.2/);
  });

  test("helpers: changedNumber keeps the format; inflate strengthens 'comparable to'", () => {
    assert.equal(changedNumber("85.3", -1), "72.5");
    assert.match(changedNumber("0.912", 1), /^\d\.\d{3}$/);
    assert.match(changedNumber("12", 1), /^\d+$/);
    const i = inflate("Our model is comparable to GPT-4 on MMLU.")!;
    assert.match(i.text, /significantly better/);
  });
});

// ---------------------------------------------------------------------------

const stats = (inputTokens: number): RunStats => ({
  model: "test", mode: "on", inputTokens, outputTokens: 10, seconds: 2, steps: 4, toolCalls: 3,
  endReason: "done", errors: [], sessionLog: "",
});
const passed: Check[] = (["C1", "C2", "C3", "C4"] as const).map((id) => ({ id, name: id, result: "passed", reason: "" }));
const c2Failed: Check[] = passed.map((c) => (c.id === "C2" ? { ...c, result: "failed" } : c));

function run(mode: "on" | "off" | "strict", fault: Fault, k: number, r: Partial<RunResult>): RunResult {
  const versionId = `P__S2__${fault}`;
  return {
    versionId, paperId: "P", targetId: "S2", fault, expected: fault === "clean" ? "supported" : "unsupported",
    mode, run: k, claimText: CLAIM, found: true, claimId: "S2", evidenceIds: [OURS], comparisons: [],
    checks: [], attempts: 1, submissions: [{ claimId: "S2", evidenceIds: [OURS], missingIds: [] }], otherClaims: [],
    stats: stats(100 * k), ...r,
  };
}

const manifest: VersionEntry[] = (["clean", "F1", "F4", "F2"] as Fault[]).map((fault) => ({
  versionId: `P__S2__${fault}`, paperId: "P", targetId: "S2", fault,
  expected: fault === "clean" ? "supported" : "unsupported", claimText: CLAIM, changes: [], valid: fault !== "F2",
}));

const results: RunResult[] = [
  // Checks on
  run("on", "clean", 1, { label: "supported", modelLabel: "supported", checks: passed }),
  run("on", "clean", 2, { label: "supported", modelLabel: "supported", checks: passed }),
  run("on", "F1", 1, { label: "unsupported", modelLabel: "supported", checks: c2Failed,
                       submissions: [{ claimId: "S2", evidenceIds: [OURS, "T9.r1.c1"], missingIds: ["T9.r1.c1"] }] }),
  run("on", "F1", 2, { label: "unverified", modelLabel: "unverified", checks: passed }),
  run("on", "F4", 1, { label: "supported", modelLabel: "supported", checks: passed }),
  run("on", "F4", 2, { found: false, claimId: undefined, evidenceIds: [], submissions: [] }),
  run("on", "F2", 1, { label: "supported", modelLabel: "supported", checks: passed }),   // invalid version: dropped
  // Checks off: the model's label counts, even where "label" says otherwise
  run("off", "clean", 1, { label: "unverified", modelLabel: "supported", posthocChecks: passed }),
  run("off", "clean", 2, { label: "supported", modelLabel: "supported", posthocChecks: passed }),
  run("off", "F1", 1, { label: "supported", modelLabel: "supported", posthocChecks: c2Failed }),
  run("off", "F1", 2, { label: "supported", modelLabel: "supported", posthocChecks: c2Failed }),
];

describe("metrics: a hand-made results set", () => {
  const m = computeMetrics(results, manifest);
  const on = m.modes.on!.overall, off = m.modes.off!.overall;

  test("only valid versions count", () => {
    assert.equal(m.validVersions, 3);
    assert.equal(on.runs, 6);
    assert.equal(on.versions, 3);
  });

  test("RQ1 with checks on", () => {
    assert.deepEqual(on.precision, { value: 2 / 3, k: 2, n: 3 });
    assert.deepEqual(on.recall, { value: 1, k: 2, n: 2 });
    assert.deepEqual(on.falseAcceptance, { value: 1 / 4, k: 1, n: 4 });
    assert.deepEqual(on.detectionStrict, { value: 1 / 4, k: 1, n: 4 });
    assert.deepEqual(on.detectionLenient, { value: 3 / 4, k: 3, n: 4 });   // not found counts as not Supported
  });

  test("RQ1 with checks off uses the model's label", () => {
    assert.equal(verdict(results[7]!), "supported");
    assert.deepEqual(off.precision, { value: 0.5, k: 2, n: 4 });
    assert.deepEqual(off.recall, { value: 1, k: 2, n: 2 });
    assert.deepEqual(off.falseAcceptance, { value: 1, k: 2, n: 2 });
    assert.deepEqual(off.detectionLenient, { value: 0, k: 0, n: 2 });
  });

  test("RQ2: versions with the same label in every run", () => {
    assert.deepEqual(on.consistency, { value: 1 / 3, k: 1, n: 3 });
    assert.deepEqual(off.consistency, { value: 1, k: 2, n: 2 });
  });

  test("RQ3: missing IDs, and model-supported links that fail the checks", () => {
    assert.deepEqual(on.missingIds, { value: 1 / 6, k: 1, n: 6 });       // 6 IDs submitted in valid runs, 1 missing
    assert.deepEqual(on.modelSupportedFailing, { value: 1 / 4, k: 1, n: 4 });
    assert.deepEqual(on.failingByCheck.C2, { value: 1 / 4, k: 1, n: 4 });
    assert.deepEqual(on.failingByCheck.C1, { value: 0, k: 0, n: 4 });
    assert.deepEqual(off.modelSupportedFailing, { value: 0.5, k: 2, n: 4 });
  });

  test("RQ4: per fault type", () => {
    assert.deepEqual(on.byFault.clean!.supported, { value: 1, k: 2, n: 2 });
    assert.deepEqual(on.byFault.F1!.strict, { value: 0.5, k: 1, n: 2 });
    assert.deepEqual(on.byFault.F1!.lenient, { value: 1, k: 2, n: 2 });
    assert.deepEqual(on.byFault.F4!.lenient, { value: 0.5, k: 1, n: 2 });
    assert.equal(on.byFault.F2, undefined);
  });

  test("not found, means, per paper and the report", () => {
    assert.deepEqual(on.notFound, { value: 1 / 6, k: 1, n: 6 });
    assert.deepEqual(on.inputTokens, { value: 150, n: 6 });                // runs 1 and 2: 100 and 200 tokens
    assert.deepEqual(m.modes.on!.byPaper.P, on);
    assert.equal(block([]).precision.value, null);
    const md = summaryMarkdown(m);
    assert.match(md, /Precision of Supported \| 66\.7% \(2\/3\) \| 50\.0% \(2\/4\)/);
    assert.match(md, /\| F1 \|/);
  });
});

// ---------------------------------------------------------------------------

describe("papers: read from where they are, with a hash check", () => {
  async function copyOfFixture() {
    const dir = await mkdtemp(path.join(os.tmpdir(), "tygig-paper-"));
    await cp(FIXTURE, dir, { recursive: true, filter: (f) => !/claim-map\.(json|md)$/.test(f) });
    return dir;
  }

  test("the work folder is 'benchmark' in the folder you run from, unless TYGIG_BENCH_DIR is set", () => {
    const saved = process.env.TYGIG_BENCH_DIR;
    delete process.env.TYGIG_BENCH_DIR;
    assert.equal(workDir(), path.join(process.cwd(), "benchmark"));
    process.env.TYGIG_BENCH_DIR = "/some/where";
    assert.equal(workDir(), path.resolve("/some/where"));
    if (saved === undefined) delete process.env.TYGIG_BENCH_DIR; else process.env.TYGIG_BENCH_DIR = saved;
  });

  test("registering saves the absolute path, the arXiv ID and the hash; the paper is not copied", async () => {
    const work = await mkdtemp(path.join(os.tmpdir(), "tygig-work-"));
    const src = await copyOfFixture();
    const info = await registerPaper(work, "paper1", src, "2611.16264v1");
    assert.equal(info.src, path.resolve(src));
    assert.equal(info.arxiv, "2611.16264v1");
    assert.match(info.sha256, /^[0-9a-f]{64}$/);
    assert.deepEqual(readPapers(work).paper1, info);
    assert.equal(await paperSource(work, "paper1"), path.resolve(src));
  });

  test("claim-map files written by tygig into the paper folder do not change the hash", async () => {
    const src = await copyOfFixture();
    const before = await hashSource(src);
    await writeFile(path.join(src, "claim-map.json"), "{}");
    await writeFile(path.join(src, "claim-map.md"), "# map");
    assert.equal(await hashSource(src), before);
  });

  test("a changed paper is refused, with both hashes in the message", async () => {
    const work = await mkdtemp(path.join(os.tmpdir(), "tygig-work-"));
    const src = await copyOfFixture();
    await registerPaper(work, "paper1", src);
    const file = path.join(src, "sections", "results.tex");
    await writeFile(file, (await readFile(file, "utf8")).replace("85.3", "85.4"));
    await assert.rejects(paperSource(work, "paper1"), /has changed since its full review[\s\S]*hash then[\s\S]*hash now/);
  });

  test("set-paper: a moved paper with the same files is accepted; different files are refused", async () => {
    const work = await mkdtemp(path.join(os.tmpdir(), "tygig-work-"));
    await registerPaper(work, "paper1", await copyOfFixture());
    const moved = await copyOfFixture();
    assert.equal((await relocatePaper(work, "paper1", moved)).src, path.resolve(moved));
    assert.equal(await paperSource(work, "paper1"), path.resolve(moved));
    const other = await copyOfFixture();
    await writeFile(path.join(other, "main.tex"), "changed");
    await assert.rejects(relocatePaper(work, "paper1", other), /not the same/);
  });

  test("dev flag: set by registering or by set-paper, kept on a new review, listed for metrics", async () => {
    const work = await mkdtemp(path.join(os.tmpdir(), "tygig-work-"));
    await registerPaper(work, "paper1", await copyOfFixture(), undefined, true);
    await registerPaper(work, "paper2", await copyOfFixture());
    assert.deepEqual(devPapers(work), ["paper1"]);
    await registerPaper(work, "paper1", readPapers(work).paper1!.src);       // a new full review keeps it
    assert.equal(readPapers(work).paper1!.dev, true);
    await setDev(work, "paper2", true);
    await setDev(work, "paper1", false);
    assert.deepEqual(devPapers(work), ["paper2"]);
    assert.equal("dev" in readPapers(work).paper1!, false);
  });

  test("an unknown paper or a missing folder is refused", async () => {
    const work = await mkdtemp(path.join(os.tmpdir(), "tygig-work-"));
    await assert.rejects(paperSource(work, "nope"), /not in/);
    await assert.rejects(registerPaper(work, "x", path.join(work, "missing")), /No paper folder/);
  });
});

describe("metrics: development papers are reported apart", () => {
  test("headline numbers leave out dev papers; the dev papers get their own block", () => {
    const m = computeMetrics(results, manifest, ["P"]);
    assert.equal(m.modes.on!.overall.runs, 0);
    assert.equal(m.modes.on!.dev!.runs, 6);
    assert.deepEqual(m.modes.on!.dev!.precision, { value: 2 / 3, k: 2, n: 3 });
    const md = summaryMarkdown(m);
    assert.match(md, /No runs on benchmark \(non-development\) papers yet/);
    assert.match(md, /## Development papers \(not in the headline\)/);
    assert.match(md, /\| P \| yes \| on \|/);
  });

  test("a model-supported link backed only by text counts as not Supported by the checks (rule R2)", () => {
    const textOnly: Check[] = passed.map((c) => (c.id === "C2" ? { ...c, data: false } : c.id === "C1" ? c : { ...c, result: "not applicable" }));
    const r = run("off", "F1", 1, { label: "supported", modelLabel: "supported", posthocChecks: textOnly });
    const b = block([r]);
    assert.deepEqual(b.modelSupportedFailing, { value: 0, k: 0, n: 1 });
    assert.deepEqual(b.modelSupportedNotSupported, { value: 1, k: 1, n: 1 });
  });
});

// ---------------------------------------------------------------------------

import { execFileSync } from "node:child_process";
import { codeReport, codeVersion } from "../evals/lib/git.ts";

const hasGit = (() => { try { execFileSync("git", ["--version"], { stdio: "ignore" }); return true; } catch { return false; } })();

describe("reproducibility: the program's Git commit is saved and reported", () => {
  test("codeVersion gives the commit and whether there were uncommitted changes", { skip: !hasGit && "Git is not installed" }, async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "tygig-git-"));
    assert.deepEqual(codeVersion(dir), { commit: null, dirty: null, note: "not a Git repository" });
    const git = (...a: string[]) => execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.invalid", ...a], { cwd: dir, stdio: "ignore" });
    git("init", "-q");
    assert.equal(codeVersion(dir).commit, null);                       // no commit yet
    await writeFile(path.join(dir, "a.txt"), "one");
    git("add", "a.txt");
    git("commit", "-q", "-m", "first");
    const v = codeVersion(dir);
    assert.match(v.commit!, /^[0-9a-f]{40}$/);
    assert.equal(v.dirty, false);
    await writeFile(path.join(dir, "a.txt"), "two");
    assert.deepEqual(codeVersion(dir), { commit: v.commit, dirty: true });
  });

  test("codeReport groups runs by commit and warns about mixed, uncommitted or unknown code", () => {
    const a = { commit: "a".repeat(40), dirty: false }, b = { commit: "b".repeat(40), dirty: false };
    assert.deepEqual(codeReport([a, a, a]), { commits: [{ ...a, runs: 3 }], warnings: [] });
    const mixed = codeReport([a, a, b, { ...a, dirty: true }, { commit: null, dirty: null, note: "not a Git repository" }, undefined]);
    assert.equal(mixed.commits[0]!.runs, 2);
    assert.equal(mixed.warnings.length, 3);
    assert.match(mixed.warnings[0]!, /2 different commits: aaaaaaaa, bbbbbbbb/);
    assert.match(mixed.warnings[1]!, /^1 run from uncommitted code/);
    assert.match(mixed.warnings[2]!, /^2 runs without a Git commit/);
  });

  test("metrics and the summary report the commits and the warnings", () => {
    const withCode = results.map((r, i) => ({ ...r, code: { commit: (i < 3 ? "a" : "b").repeat(40), dirty: false } }));
    const m = computeMetrics(withCode, manifest);
    assert.equal(m.code.commits.length, 2);
    assert.match(summaryMarkdown(m), /## Code version[\s\S]*commit aaaaaaaa[0-9a-f]*, clean: [0-9]+ runs[\s\S]*\*\*Warning:\*\* Runs come from 2 different commits/);
  });
});

// ---------------------------------------------------------------------------

import { buildCandidates, SELECTION } from "../evals/lib/candidates.ts";
import { cleanMisses } from "../evals/lib/metrics.ts";
import type { ClaimMap } from "../packages/cli/src/review/claim-map.ts";

describe("blind target selection and the failure analysis", () => {
  const entry = (claimId: string, text: string, label: "supported" | "unsupported" | "unverified", cells: [string, number][]) => ({
    claimId, section: "1", text, comparisons: [], attempts: 1, label, modelLabel: "supported" as const,
    checks: [{ id: "C2" as const, name: "Number match", result: (label === "unsupported" ? "failed" : "passed") as "failed" | "passed", reason: "secret reason" }],
    evidence: [...cells.map(([id, value]) => ({ id, exists: true, kind: "cell" as const, text: String(value), value, rowLabel: "Ours", colLabel: "AVG" })),
               { id: "S9", exists: true, kind: "sentence" as const, text: "A sentence." }, { id: "T9.r9.c9", exists: false, kind: "missing" as const }],
  });
  const map = (claims: ReturnType<typeof entry>[]): ClaimMap =>
    ({ paper: { title: "t", source: "s" }, mode: "checks", created: "", counts: { supported: 0, unsupported: 0, unverified: 0 }, claims });
  const maps = {
    alpha: map([entry("S1", "We reach 81.04 on AVG.", "supported", [["T1.r2.c3", 81.04]]),
                entry("S2", "We beat the baseline by 3.2 points.", "unsupported", [["T1.r2.c3", 81.04], ["T1.r3.c3", 77.84]]),
                entry("S3", "Our method is simple.", "unverified", []),
                entry("S4", "It reaches 60.5 on QA.", "unverified", [])]),
    devpaper: map([entry("S1", "Dev reaches 12.5.", "supported", [["T1.r2.c2", 12.5]])]),
  };

  test("every claim with numbers is a candidate, whatever its label; dev papers and number-free claims are left out", () => {
    const { candidates } = buildCandidates(maps, ["devpaper"]);
    assert.deepEqual(candidates.map((c) => `${c.paperId}/${c.targetId}`), ["alpha/S1", "alpha/S2", "alpha/S4"]);
    const s2 = candidates[1]!;
    assert.deepEqual(s2.numbers, ["3.2"]);
    assert.deepEqual(s2.evidenceIds, ["T1.r2.c3", "T1.r3.c3"]);                // cells only: no sentences, no missing IDs
    assert.deepEqual(s2.cells["T1.r3.c3"], { text: "77.84", value: 77.84, rowLabel: "Ours", colLabel: "AVG" });
    assert.equal(s2.comparison, true);
    assert.deepEqual(s2.comparisons, []);
    assert.equal(s2.confirmed, false);
    assert.equal(s2.selection, SELECTION);
  });

  test("the candidate file shows nothing of the tool's verdict; the labels file has it", () => {
    const { candidates, labels } = buildCandidates(maps, ["devpaper"]);
    const text = JSON.stringify(candidates);
    for (const word of ['"label"', '"modelLabel"', '"checks"', "supported", "unverified", "secret reason"]) {
      assert.equal(text.includes(word), false, `candidate file mentions ${word}`);
    }
    assert.deepEqual(labels.map((l) => [l.targetId, l.label]), [["S1", "supported"], ["S2", "unsupported"], ["S4", "unverified"]]);
    assert.equal(labels[1]!.checks[0]!.reason, "secret reason");
  });

  test("plant keeps the selection note and uses the hand-confirmed evidence cell", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "tygig-plant-"));
    const entry = await plantVersion(FIXTURE, { ...target, comparisons: [], evidenceIds: [BASE], selection: SELECTION }, "F1", dir);
    assert.equal(entry.valid, true, entry.reason);
    assert.equal(entry.selection, SELECTION);
    assert.equal(entry.cell, BASE);                                             // the confirmed cell, not another
  });

  test("false alarm counts clean runs labelled Unsupported; the failure list gives C2 and C3 reasons", () => {
    const failed: Check[] = passed.map((c) => (c.id === "C2" ? { ...c, result: "failed", reason: "85.3 not found" } : c));
    const rs = [
      run("on", "clean", 1, { label: "unsupported", modelLabel: "supported", checks: failed }),
      run("on", "clean", 2, { label: "supported", modelLabel: "supported", checks: passed }),
      run("on", "clean", 3, { label: "unverified", modelLabel: "supported", checks: passed.map((c) => (c.id === "C2" ? { ...c, data: false, reason: "85.3: only in text (S2)." } : c)) }),
    ];
    assert.deepEqual(block(rs).falseAlarm, { value: 1 / 3, k: 1, n: 3 });
    const misses = cleanMisses(rs);
    assert.deepEqual(misses.map((x) => [x.run, x.label, x.c2]), [[1, "unsupported", "85.3 not found"], [3, "unverified", "85.3: only in text (S2)."]]);
    const md = summaryMarkdown(computeMetrics(rs, manifest));
    assert.match(md, /False alarm \(clean runs Unsupported\) \| 33\.3% \(1\/3\)/);
    assert.match(md, /## Failure analysis: clean claims not labelled Supported[\s\S]*\| on \| P__S2__clean \| 1 \| no \| unsupported \| 85\.3 not found \|/);
  });
});

describe("provider errors are not results", () => {
  test("metrics leave out runs that ended with a provider error, and warn", () => {
    const err = run("on", "clean", 9, { found: false, evidenceIds: [], submissions: [],
      stats: { ...stats(0), endReason: "error", errors: ["OpenAI: Rate limit reached"] } });
    const m = computeMetrics([...results, err], manifest);
    assert.equal(m.errorRuns, 1);
    assert.equal(m.modes.on!.overall.runs, 6);                          // the same as without the errored run
    assert.match(summaryMarkdown(m), /\*\*Warning:\*\* 1 run ended with a provider error/);
  });
});

// ---------------------------------------------------------------------------

import { estimateTokens, isRateLimit, suggestedWait, throttled } from "../evals/lib/throttle.ts";
import type { ModelProvider, ModelRequest, StreamEvent } from "@tygig/core";

describe("speed brake: stay under the tokens-per-minute limit", () => {
  const req = (chars: number): ModelRequest => ({ model: "m", instructions: "x".repeat(chars), messages: [], tools: [] });
  function fake(script: ("ok" | "429" | "boom-after-start")[]) {
    let call = 0;
    const provider: ModelProvider = {
      label: "fake", listModels: async () => [],
      async *stream(): AsyncIterable<StreamEvent> {
        const what = script[call++] ?? "ok";
        if (what === "429") throw Object.assign(new Error("OpenAI: Rate limit reached ... Please try again in 4.386s."), { status: 429 });
        yield { type: "text", text: "hi" };
        if (what === "boom-after-start") throw Object.assign(new Error("Rate limit reached"), { status: 429 });
        yield { type: "done", usage: { inputTokens: 100, outputTokens: 10 } };
      },
    };
    return { provider, calls: () => call };
  }
  function clock() {
    let t = 0; const waits: number[] = [];
    return { now: () => t, sleep: async (ms: number) => { waits.push(ms); t += ms; }, waits };
  }
  const drain = async (it: AsyncIterable<StreamEvent>) => { const out: StreamEvent[] = []; for await (const e of it) out.push(e); return out; };

  test("helpers read the provider's message", () => {
    assert.equal(isRateLimit({ status: 429 }), true);
    assert.equal(isRateLimit(new Error("OpenAI: Rate limit reached for gpt-4.1")), true);
    assert.equal(isRateLimit(new Error("Invalid API key")), false);
    assert.equal(suggestedWait(new Error("Please try again in 4.386s.")), 4386);
    assert.equal(suggestedWait(new Error("Please try again in 52ms.")), 52);
    assert.equal(estimateTokens(req(3500)) > 1000, true);
  });

  test("waits when the next request would go over the budget, not before", async () => {
    const c = clock();
    const { provider } = fake([]);
    const p = throttled(provider, { tpm: 2200, now: c.now, sleep: c.sleep });
    await drain(p.stream(req(3500)));          // about 1,010 tokens estimated; 110 counted once the answer says so
    await drain(p.stream(req(7000)));          // about 2,010: 110 + 2,010 fits in 2,200
    assert.deepEqual(c.waits, []);
    await drain(p.stream(req(7000)));          // 220 + 2,010 > 2,200: waits until the oldest leaves the 60 s window
    assert.equal(c.waits.length, 1);
    assert.equal(c.waits[0]! > 59_000, true);
  });

  test("a rate-limited request waits and is sent again; the run goes on", async () => {
    const c = clock();
    const { provider, calls } = fake(["429", "429", "ok"]);
    const p = throttled(provider, { tpm: 1e9, now: c.now, sleep: c.sleep });
    const events = await drain(p.stream(req(10)));
    assert.equal(calls(), 3);
    assert.equal(events.at(-1)!.type, "done");
    assert.deepEqual(c.waits, [5000, 10000]);  // at least 5 s x try (more than the 4.4 s asked for)
  });

  test("an error after the answer started is not repeated; other errors pass through", async () => {
    const c = clock();
    await assert.rejects(drain(throttled(fake(["boom-after-start"]).provider, { tpm: 1e9, now: c.now, sleep: c.sleep }).stream(req(10))), /Rate limit/);
    const bad: ModelProvider = { label: "x", listModels: async () => [], async *stream() { throw new Error("Invalid API key"); } };
    await assert.rejects(drain(throttled(bad, { tpm: 1e9, now: c.now, sleep: c.sleep }).stream(req(10))), /Invalid API key/);
    await assert.rejects(drain(throttled(fake(["429", "429", "429"]).provider, { tpm: 1e9, maxTries: 3, now: c.now, sleep: c.sleep }).stream(req(10))), /Rate limit/);
  });
});

// ---------------------------------------------------------------------------

import { createHash } from "node:crypto";
import { checksSetting, parseMode, STRICT_PROMPT_FILE, strictPrompt, taskPrompt } from "../evals/lib/prompts.ts";

describe("strict mode: the fixed prompt, checks off, hash recorded", () => {
  const FIXED = [
    "Verify the claim strictly. Do not assume it is correct. Before you call review__submit_link, open every table you cite with review__get_table and check every number in the claim yourself.",
    "Use these labels:",
    "",
    "* supported: every number in the claim appears in a cited table cell that reports this result, for this method and this metric (after normal rounding), and any stated difference, ratio or comparison is correct when computed from those cells.",
    "* unsupported: a number in the claim is missing from the cited cells, differs from them, or a difference, ratio or comparison computed from the cells does not match the claim.",
    "* unverified: you cannot check the claim against table cells, for example because a number appears only in the text.",
    "",
    "Text that repeats the claim’s number is not evidence. Cite the cells you checked.",
  ].join("\n");

  test("strict.md holds exactly the agreed text, and its hash is the SHA-256 of the file", async () => {
    const p = strictPrompt();
    assert.equal(p.text, FIXED);
    assert.equal(p.sha256, createHash("sha256").update(await readFile(STRICT_PROMPT_FILE)).digest("hex"));
  });

  test("the strict task prompt is the normal prompt followed by strict.md; on and off are unchanged", () => {
    const on = taskPrompt("/tmp/paper", "It reaches 85.3%.", "on");
    assert.equal(taskPrompt("/tmp/paper", "It reaches 85.3%.", "off"), on);
    assert.match(on, /^Load the paper at \/tmp\/paper\. Verify only this claim: "It reaches 85\.3%\."\./);
    assert.equal(on.includes("strictly"), false);
    const strict = taskPrompt("/tmp/paper", "It reaches 85.3%.", "strict");
    assert.equal(strict, `${on}\n\n${FIXED}`);
  });

  test("strict runs with the review checks off; modes are parsed strictly", () => {
    assert.equal(checksSetting("strict"), "off");
    assert.equal(checksSetting("off"), "off");
    assert.equal(checksSetting("on"), "on");
    assert.equal(parseMode("strict"), "strict");
    assert.equal(parseMode("Strict"), undefined);
    assert.equal(parseMode(undefined), undefined);
  });

  test("three-column metrics: strict uses the model's label; the checks run afterwards say which acceptances they would stop", () => {
    const strictRuns: RunResult[] = [
      run("strict", "clean", 1, { label: "supported", modelLabel: "supported", posthocChecks: passed }),
      run("strict", "clean", 2, { label: "supported", modelLabel: "unverified", posthocChecks: passed }),
      run("strict", "F1", 1, { label: "supported", modelLabel: "supported", posthocChecks: c2Failed }),
      run("strict", "F1", 2, { label: "supported", modelLabel: "unsupported", posthocChecks: c2Failed }),
      run("strict", "F4", 1, { label: "supported", modelLabel: "supported", posthocChecks: passed }),
      run("strict", "F4", 2, { label: "supported", modelLabel: "unverified", posthocChecks: passed }),
    ];
    const m = computeMetrics([...results, ...strictRuns], manifest);
    const s = m.modes.strict!.overall;
    assert.deepEqual(s.recall, { value: 0.5, k: 1, n: 2 });
    assert.deepEqual(s.falseAcceptance, { value: 0.5, k: 2, n: 4 });
    assert.deepEqual(s.detectionStrict, { value: 0.25, k: 1, n: 4 });
    assert.deepEqual(s.faultyAcceptedCaught, { value: 0.5, k: 1, n: 2 });   // the F1 acceptance fails C2; the F4 one would pass
    assert.deepEqual(m.modes.on!.overall.precision, { value: 2 / 3, k: 2, n: 3 });   // the on and off numbers do not change
    assert.deepEqual(m.modes.off!.overall.precision, { value: 0.5, k: 2, n: 4 });
    const md = summaryMarkdown(m);
    assert.match(md, /\| Measure \| Checks on \| Checks off \| Strict prompt, no checks \|/);
    assert.match(md, /\| Precision of Supported \| 66\.7% \(2\/3\) \| 50\.0% \(2\/4\) \| 33\.3% \(1\/3\) \|/);
    assert.match(md, /\| Faulty runs labelled Supported that the checks would have stopped \| [^|]+\| [^|]+\| 50\.0% \(1\/2\) \|/);
    assert.match(md, /\| F1 \| .* \| 50\.0% \(1\/2\) \| 50\.0% \(1\/2\) \| 50\.0% \(1\/2\) \|$/m);
  });
});
