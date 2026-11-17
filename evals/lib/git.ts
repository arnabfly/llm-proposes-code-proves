// git.ts - which version of the program produced a result: the Git commit, and whether the program
// folder had uncommitted changes. Saved with every full review and run, so a result can be traced to
// the exact code (tag the commit, e.g. benchmark-v1, before the benchmark).

import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface CodeVersion {
  commit: string | null;     // full commit hash; null if the folder is not a Git repository or Git is missing
  dirty: boolean | null;     // true if there were uncommitted changes (tracked or new files); null if unknown
  note?: string;             // why commit is null
}

/** The program's own folder (the repository root), wherever the script is started from. */
export const PROGRAM_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** The commit and the uncommitted-changes flag of the Git repository at `dir`. Never throws. */
export function codeVersion(dir = PROGRAM_DIR): CodeVersion {
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], windowsHide: true }).trim();
  try {
    const commit = git("rev-parse", "HEAD");
    const dirty = git("status", "--porcelain").length > 0;
    return { commit, dirty };
  } catch (err) {
    const msg = String((err as { stderr?: string }).stderr ?? (err as Error).message);
    const note = /not a git repository/i.test(msg) ? "not a Git repository"
      : /ENOENT/.test((err as Error).message) ? "Git is not installed"
      : /unknown revision|ambiguous argument 'HEAD'/i.test(msg) ? "no commit yet"
      : "Git failed";
    return { commit: null, dirty: null, note };
  }
}

export interface CodeReport {
  commits: { commit: string | null; dirty: boolean | null; runs: number }[];
  warnings: string[];
}

/** Which code versions a set of results came from, and warnings when they differ or were not committed. */
export function codeReport(versions: (CodeVersion | undefined)[]): CodeReport {
  const key = (v: CodeVersion | undefined) => `${v?.commit ?? "none"}|${v?.dirty ?? "unknown"}`;
  const groups = new Map<string, { commit: string | null; dirty: boolean | null; runs: number }>();
  for (const v of versions) {
    const k = key(v);
    const g = groups.get(k) ?? { commit: v?.commit ?? null, dirty: v?.dirty ?? null, runs: 0 };
    g.runs++;
    groups.set(k, g);
  }
  const commits = [...groups.values()].sort((a, b) => b.runs - a.runs);
  const warnings: string[] = [];
  const distinct = new Set(commits.filter((c) => c.commit).map((c) => c.commit));
  if (distinct.size > 1) warnings.push(`Runs come from ${distinct.size} different commits: ${[...distinct].map((c) => c!.slice(0, 8)).join(", ")}.`);
  const dirty = commits.filter((c) => c.dirty === true).reduce((a, c) => a + c.runs, 0);
  if (dirty > 0) warnings.push(`${dirty} run${dirty === 1 ? "" : "s"} from uncommitted code (the program folder had changes that were not committed).`);
  const none = commits.filter((c) => !c.commit).reduce((a, c) => a + c.runs, 0);
  if (none > 0) warnings.push(`${none} run${none === 1 ? "" : "s"} without a Git commit (the code version is unknown).`);
  return { commits, warnings };
}
