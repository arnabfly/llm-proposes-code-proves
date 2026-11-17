// plant.ts - make the benchmark versions from the confirmed targets.
//
//   tygig-bench plant [--f5]
//
// Reads benchmark/targets.json (only entries with confirmed: true). Each paper is read from where it
// is (benchmark/papers.json), after checking that it has not changed. For each target writes
// benchmark/versions/<paperId>__<targetId>__<fault>/src/ for clean, F1, F2, F3, F4 (and F5 with --f5),
// and benchmark/versions/manifest.json. A version that fails the validity check is listed with
// valid: false and its reason, and its folder is removed.

import { existsSync, readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";
import { FAULTS, plantVersion, type Fault, type Target, type VersionEntry } from "../lib/plant.ts";
import { flags, workDir, writeJson } from "../lib/agent-run.ts";
import { paperSource } from "../lib/papers.ts";

const args = flags(process.argv.slice(2));
const work = workDir();
const file = path.join(work, "targets.json");
if (!existsSync(file)) {
  console.error(`No ${file}. Run tygig-bench targets, confirm the targets, and save them as targets.json.`);
  process.exit(1);
}
const targets = (JSON.parse(readFileSync(file, "utf8")) as Target[]).filter((t) => t.confirmed);
const faults: Fault[] = args.f5 ? [...FAULTS, "F5"] : FAULTS;
const versionsDir = path.join(work, "versions");

const manifest: VersionEntry[] = [];
for (const t of targets) {
  let src: string;
  try { src = await paperSource(work, t.paperId); } catch (err) { console.error((err as Error).message); process.exit(1); }
  for (const fault of faults) {
    const outDir = path.join(versionsDir, `${t.paperId}__${t.targetId}__${fault}`);
    const entry = await plantVersion(src, t, fault, outDir);
    manifest.push(entry);
    if (!entry.valid) await rm(outDir, { recursive: true, force: true });
    const what = entry.changes.map((c) => `"${short(c.old)}" -> "${short(c.new)}" (${c.file})`).join("; ");
    console.log(`${entry.valid ? "ok     " : "INVALID"} ${entry.versionId}${entry.valid ? (what ? `: ${what}` : "") : `: ${entry.reason}`}`);
  }
}

await writeJson(path.join(versionsDir, "manifest.json"), manifest);
const valid = manifest.filter((e) => e.valid).length;
console.log(`\n${valid} valid of ${manifest.length} versions (${targets.length} targets). Manifest: ${path.join(versionsDir, "manifest.json")}`);

function short(s: string): string {
  const t = s.replace(/\s+/g, " ");
  return t.length > 40 ? t.slice(0, 37) + "..." : t;
}
