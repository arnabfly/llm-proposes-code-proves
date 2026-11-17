// metrics.ts - the benchmark numbers (RQ1 to RQ4) from the run results. Pure functions: no files,
// so the tests can give a hand-made results set and check the answers.
//
// Every number is a Ratio { value, k, n } (k of n), so the report can always show n.
// Only runs of valid versions count. A run where the target was not found counts as
// "not Supported" (it is in recall's and lenient detection's denominators) and is also counted apart.

import { finalLabel, type Check, type Label } from "../../packages/cli/src/review/checks.ts";
import type { Fault, VersionEntry } from "./plant.ts";
import type { RunResult } from "./results.ts";
import { codeReport, type CodeReport } from "./git.ts";
import { MODES, type Mode } from "./prompts.ts";

export interface Ratio { value: number | null; k: number; n: number }
export interface Mean { value: number | null; n: number }

export interface Block {
  runs: number;
  versions: number;
  // RQ1
  precision: Ratio;              // clean Supported / all Supported
  recall: Ratio;                 // clean runs Supported / clean runs
  falseAcceptance: Ratio;        // faulty runs Supported / faulty runs
  detectionStrict: Ratio;        // faulty runs Unsupported / faulty runs
  detectionLenient: Ratio;       // faulty runs not Supported / faulty runs
  falseAlarm: Ratio;             // clean runs labelled Unsupported / clean runs
  // RQ2
  consistency: Ratio;            // versions with the same verdict in every run / versions with 2+ runs
  // RQ3
  missingIds: Ratio;             // submitted evidence IDs that do not exist / all submitted IDs
  modelSupportedFailing: Ratio;  // links the model called supported that fail one of C1 to C4 / those links
  modelSupportedNotSupported: Ratio;  // ... that the checks would not label Supported (failed, or only text: rule R1)
  faultyAcceptedCaught: Ratio;   // faulty runs labelled Supported that the checks (run on the same link) would not label Supported
  failingByCheck: Record<"C1" | "C2" | "C3" | "C4", Ratio>;
  // RQ4
  byFault: Partial<Record<Fault, { runs: number; supported: Ratio; strict: Ratio; lenient: Ratio }>>;
  // Also
  notFound: Ratio;
  inputTokens: Mean;
  outputTokens: Mean;
  seconds: Mean;
  steps: Mean;
}

export interface Metrics {
  created: string;
  validVersions: number;
  devPapers: string[];           // reported apart: the checks or the planting were tuned on them
  code: CodeReport;              // which program commit(s) the counted runs came from, with warnings
  cleanNotSupported: CleanMiss[];  // failure analysis: every clean run (valid versions) not labelled Supported
  errorRuns: number;             // runs that ended with a provider error (e.g. rate limit): left out of every number
  /** overall: the headline numbers, benchmark (non-dev) papers only. dev: the dev papers together. */
  modes: Partial<Record<Mode, { overall: Block; dev?: Block; byPaper: Record<string, Block> }>>;
}

const FAULT_ORDER: Fault[] = ["clean", "F1", "F2", "F3", "F4", "F5"];
const ratio = (k: number, n: number): Ratio => ({ value: n === 0 ? null : k / n, k, n });
const mean = (xs: number[]): Mean => ({ value: xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length, n: xs.length });

/** The verdict that counts: the final label with checks on, the model's own label with checks off or strict. */
export function verdict(r: RunResult): Label | "not found" {
  if (!r.found) return "not found";
  return (r.mode === "on" ? r.label : r.modelLabel) ?? "not found";
}

/** The checks that judge the recorded link: the live ones (on), or those run afterwards (off, strict). */
function linkChecks(r: RunResult): Check[] | undefined {
  if (!r.found) return undefined;
  if (r.mode === "on") return r.checks.length > 0 ? r.checks : undefined;
  return r.posthocChecks;
}

export function block(results: RunResult[]): Block {
  const clean = results.filter((r) => r.fault === "clean");
  const faulty = results.filter((r) => r.fault !== "clean");
  const isSupported = (r: RunResult) => verdict(r) === "supported";
  const supported = results.filter(isSupported);

  // RQ2: same verdict in every run of a version
  const byVersion = new Map<string, RunResult[]>();
  for (const r of results) byVersion.set(r.versionId, [...(byVersion.get(r.versionId) ?? []), r]);
  const repeated = [...byVersion.values()].filter((rs) => rs.length >= 2);
  const stable = repeated.filter((rs) => new Set(rs.map(verdict)).size === 1).length;

  // RQ3
  const ids = results.flatMap((r) => r.submissions);
  const allIds = ids.reduce((a, s) => a + s.evidenceIds.length, 0);
  const missing = ids.reduce((a, s) => a + s.missingIds.length, 0);
  const judged = results.filter((r) => r.found && r.modelLabel === "supported" && linkChecks(r));
  const fails = (r: RunResult, id?: string) => linkChecks(r)!.some((c) => c.result === "failed" && (!id || c.id === id));
  const failingByCheck = Object.fromEntries((["C1", "C2", "C3", "C4"] as const).map((id) =>
    [id, ratio(judged.filter((r) => fails(r, id)).length, judged.length)])) as Block["failingByCheck"];

  // RQ4
  const byFault: Block["byFault"] = {};
  for (const fault of FAULT_ORDER.filter((f) => results.some((r) => r.fault === f))) {
    const rs = results.filter((r) => r.fault === fault);
    byFault[fault] = {
      runs: rs.length,
      supported: ratio(rs.filter(isSupported).length, rs.length),
      strict: ratio(rs.filter((r) => verdict(r) === "unsupported").length, rs.length),
      lenient: ratio(rs.filter((r) => !isSupported(r)).length, rs.length),
    };
  }

  return {
    runs: results.length,
    versions: byVersion.size,
    precision: ratio(supported.filter((r) => r.fault === "clean").length, supported.length),
    recall: ratio(clean.filter(isSupported).length, clean.length),
    falseAcceptance: ratio(faulty.filter(isSupported).length, faulty.length),
    detectionStrict: ratio(faulty.filter((r) => verdict(r) === "unsupported").length, faulty.length),
    detectionLenient: ratio(faulty.filter((r) => !isSupported(r)).length, faulty.length),
    falseAlarm: ratio(clean.filter((r) => verdict(r) === "unsupported").length, clean.length),
    consistency: ratio(stable, repeated.length),
    missingIds: ratio(missing, allIds),
    modelSupportedFailing: ratio(judged.filter((r) => fails(r)).length, judged.length),
    modelSupportedNotSupported: ratio(judged.filter((r) => finalLabel(linkChecks(r)!) !== "supported").length, judged.length),
    faultyAcceptedCaught: (() => {
      const accepted = faulty.filter((r) => isSupported(r) && linkChecks(r));
      return ratio(accepted.filter((r) => finalLabel(linkChecks(r)!) !== "supported").length, accepted.length);
    })(),
    failingByCheck,
    byFault,
    notFound: ratio(results.filter((r) => !r.found).length, results.length),
    inputTokens: mean(results.map((r) => r.stats.inputTokens)),
    outputTokens: mean(results.map((r) => r.stats.outputTokens)),
    seconds: mean(results.map((r) => r.stats.seconds)),
    steps: mean(results.map((r) => r.stats.steps)),
  };
}

/** A clean run that was not labelled Supported, with the C2 and C3 reasons (checks run afterwards in off mode). */
export interface CleanMiss {
  mode: Mode;
  versionId: string;
  paperId: string;
  dev: boolean;
  run: number;
  label: Label | "not found";
  claimText: string;
  c2?: string;
  c3?: string;
}

/** The failure analysis list: clean runs not labelled Supported, in a fixed order. */
export function cleanMisses(results: RunResult[], devPapers: string[] = []): CleanMiss[] {
  return results
    .filter((r) => r.fault === "clean" && verdict(r) !== "supported")
    .map((r) => {
      const checks = linkChecks(r) ?? [];
      const reason = (id: string) => checks.find((c) => c.id === id && c.result !== "not applicable")?.reason;
      const c2 = reason("C2"), c3 = reason("C3");
      return { mode: r.mode, versionId: r.versionId, paperId: r.paperId, dev: devPapers.includes(r.paperId), run: r.run,
               label: verdict(r), claimText: r.claimText, ...(c2 && { c2 }), ...(c3 && { c3 }) };
    })
    .sort((a, b) => a.mode.localeCompare(b.mode) || a.versionId.localeCompare(b.versionId) || a.run - b.run);
}

/**
 * All metrics, per mode: the headline numbers (benchmark papers only), the development papers
 * together, and each paper. Runs of versions that are not valid are dropped.
 */
export function computeMetrics(results: RunResult[], manifest: VersionEntry[], devPapers: string[] = []): Metrics {
  const valid = new Set(manifest.filter((v) => v.valid).map((v) => v.versionId));
  // A provider error is not an answer (older result files may hold such runs): leave them out.
  const errored = results.filter((r) => valid.has(r.versionId) && r.stats.endReason === "error");
  const kept = results.filter((r) => valid.has(r.versionId) && r.stats.endReason !== "error");
  const isDev = (r: RunResult) => devPapers.includes(r.paperId);
  const modes: Metrics["modes"] = {};
  for (const mode of MODES) {
    const rs = kept.filter((r) => r.mode === mode);
    if (rs.length === 0) continue;
    const byPaper: Record<string, Block> = {};
    for (const p of [...new Set(rs.map((r) => r.paperId))].sort()) byPaper[p] = block(rs.filter((r) => r.paperId === p));
    const dev = rs.filter(isDev);
    modes[mode] = { overall: block(rs.filter((r) => !isDev(r))), ...(dev.length > 0 && { dev: block(dev) }), byPaper };
  }
  return { created: new Date().toISOString(), validVersions: valid.size, devPapers: [...devPapers].sort(),
           code: codeReport(kept.map((r) => r.code)), cleanNotSupported: cleanMisses(kept, devPapers), errorRuns: errored.length, modes };
}

// ---------------------------------------------------------------------------
// The report for people

const pct = (r: Ratio) => (r.value === null ? "n/a" : `${(100 * r.value).toFixed(1)}%`) + ` (${r.k}/${r.n})`;
const num = (m: Mean, digits = 0) => (m.value === null ? "n/a" : m.value.toFixed(digits)) + ` (n=${m.n})`;

const MODE_TITLE: Record<Mode, string> = { on: "Checks on", off: "Checks off", strict: "Strict prompt, no checks" };

export function summaryMarkdown(m: Metrics): string {
  const shown = MODES.filter((mode) => m.modes[mode]);
  const lines = [
    "# Benchmark summary",
    "",
    `Created ${m.created}. Valid versions: ${m.validVersions}. Checks on: labels from code. Checks off: the model's own labels. ` +
      "Strict: no checks; the model's own label, with the task prompt telling it to apply the same rule as the code (evals/prompts/strict.md).",
    "Each number is shown with k/n. A run where the target claim was not submitted counts as not Supported.",
    m.devPapers.length > 0
      ? `Development papers (${m.devPapers.join(", ")}) are not in the headline numbers: the checks or the planting were tuned on them. They are reported apart below.`
      : "No development papers.",
    "",
    ...(m.errorRuns > 0 ? [`**Warning:** ${m.errorRuns} run${m.errorRuns === 1 ? "" : "s"} ended with a provider error (e.g. the rate limit) and ${m.errorRuns === 1 ? "is" : "are"} left out of every number. Delete those result files and run again.`, ""] : []),
    "## Code version",
    "",
    ...m.code.commits.map((c) => `- ${c.commit ? `commit ${c.commit}` : "no Git commit"}${c.dirty === true ? ", with uncommitted changes" : c.dirty === false ? ", clean" : ""}: ${c.runs} run${c.runs === 1 ? "" : "s"}`),
    ...m.code.warnings.map((w) => `- **Warning:** ${w}`),
    "",
    "## Headline: benchmark papers",
    "",
  ];
  const overall = Object.fromEntries(shown.map((mode) => [mode, m.modes[mode]!.overall])) as Partial<Record<Mode, Block>>;
  if (shown.every((mode) => overall[mode]!.runs === 0)) lines.push("No runs on benchmark (non-development) papers yet.", "");
  else lines.push(...blockTables(shown, overall));
  const dev = Object.fromEntries(shown.filter((mode) => m.modes[mode]!.dev).map((mode) => [mode, m.modes[mode]!.dev!])) as Partial<Record<Mode, Block>>;
  if (Object.keys(dev).length > 0) lines.push("## Development papers (not in the headline)", "", ...blockTables(shown, dev));
  lines.push("## By paper", "", "| Paper | Dev | Mode | Runs | Precision | Recall | False acceptance | Detection (lenient) | Not found |", "|---|---|---|---|---|---|---|---|---|");
  for (const mode of shown) {
    for (const [p, b] of Object.entries(m.modes[mode]?.byPaper ?? {})) {
      lines.push(`| ${p} | ${m.devPapers.includes(p) ? "yes" : "no"} | ${mode} | ${b.runs} | ${pct(b.precision)} | ${pct(b.recall)} | ${pct(b.falseAcceptance)} | ${pct(b.detectionLenient)} | ${pct(b.notFound)} |`);
    }
  }
  lines.push("", "## Failure analysis: clean claims not labelled Supported", "");
  if (m.cleanNotSupported.length === 0) lines.push("None.");
  else {
    lines.push("Checks off and strict: the model's label, with the checks run afterwards on its link.", "",
               "| Mode | Version | Run | Dev | Label | C2 reason | C3 reason |", "|---|---|---|---|---|---|---|");
    const cell = (s?: string) => (s ?? "").replace(/\|/g, "\\|").replace(/\s+/g, " ");
    for (const x of m.cleanNotSupported) {
      lines.push(`| ${x.mode} | ${x.versionId} | ${x.run} | ${x.dev ? "yes" : "no"} | ${x.label} | ${cell(x.c2)} | ${cell(x.c3)} |`);
    }
  }
  return lines.join("\n") + "\n";
}

/** The measures table and the per-fault table for one group of runs, one column per mode. */
function blockTables(modes: Mode[], blocks: Partial<Record<Mode, Block>>): string[] {
  const row = (name: string, f: (b: Block) => string) => `| ${name} | ${modes.map((mode) => (blocks[mode] ? f(blocks[mode]!) : "-")).join(" | ")} |`;
  const sep = (title: string) => `| **${title}** |${modes.map(() => " |").join("")}`;
  const lines = [
    `| Measure | ${modes.map((mode) => MODE_TITLE[mode]).join(" | ")} |`,
    `|---|${modes.map(() => "---|").join("")}`,
    row("Runs", (b) => String(b.runs)),
    row("Versions", (b) => String(b.versions)),
    sep("RQ1: correctness"),
    row("Precision of Supported", (b) => pct(b.precision)),
    row("Recall (clean runs Supported)", (b) => pct(b.recall)),
    row("False acceptance (faulty runs Supported)", (b) => pct(b.falseAcceptance)),
    row("Fault detection, strict (Unsupported)", (b) => pct(b.detectionStrict)),
    row("Fault detection, lenient (not Supported)", (b) => pct(b.detectionLenient)),
    row("False alarm (clean runs Unsupported)", (b) => pct(b.falseAlarm)),
    sep("RQ2: consistency"),
    row("Versions with the same label in all runs", (b) => pct(b.consistency)),
    sep("RQ3: invented or wrong evidence"),
    row("Submitted evidence IDs that do not exist", (b) => pct(b.missingIds)),
    row("Model-\"supported\" links failing C1 to C4", (b) => pct(b.modelSupportedFailing)),
    row("Model-\"supported\" links the checks would not label Supported", (b) => pct(b.modelSupportedNotSupported)),
    row("Faulty runs labelled Supported that the checks would have stopped", (b) => pct(b.faultyAcceptedCaught)),
    ...(["C1", "C2", "C3", "C4"] as const).map((id) => row(`... failing ${id}`, (b) => pct(b.failingByCheck[id]))),
    sep("Also"),
    row("Target not found", (b) => pct(b.notFound)),
    row("Mean input tokens per run", (b) => num(b.inputTokens)),
    row("Mean output tokens per run", (b) => num(b.outputTokens)),
    row("Mean seconds per run", (b) => num(b.seconds, 1)),
    row("Mean steps per run", (b) => num(b.steps, 1)),
    "",
    "RQ4, by fault type. Clean: the share labelled Supported is the recall. Faults: strict = Unsupported, lenient = not Supported.",
    "",
    `| Fault | ${modes.map((mode) => `${MODE_TITLE[mode]}: Supported | ${mode}: strict | ${mode}: lenient`).join(" | ")} |`,
    `|---|${modes.map(() => "---|---|---|").join("")}`,
  ];
  const faults = FAULT_ORDER.filter((f) => modes.some((mode) => blocks[mode]?.byFault[f]));
  for (const f of faults) {
    const cells = modes.map((mode) => {
      const a = blocks[mode]?.byFault[f];
      return a ? `${pct(a.supported)} | ${pct(a.strict)} | ${pct(a.lenient)}` : "- | - | -";
    });
    lines.push(`| ${f} | ${cells.join(" | ")} |`);
  }
  lines.push("");
  return lines;
}
