// papers.ts - the benchmark's list of papers: where each paper's LaTeX source is, and a fingerprint
// (SHA-256 hash) of its files, so a paper that changed after its full review is noticed.
//
// The list is <work folder>/papers.json. The paper itself stays where you keep it; nothing is copied.
// claim-map.json and claim-map.md are left out of the hash, because tygig writes them into the
// paper's folder when you review it yourself.

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { writeJson } from "./agent-run.ts";

export interface PaperInfo {
  id: string;
  src: string;          // absolute path of the folder with the LaTeX source
  sha256: string;
  arxiv?: string;       // e.g. 2611.16264v1 (with the version, so the same source can be downloaded again)
  dev?: boolean;        // development paper: the checks or the planting were tuned on it, so it is
                        // reported apart from the headline numbers
  registered: string;
}

const SKIP = /^claim-map\.(json|md)$/;

/** SHA-256 over the sorted relative paths and contents of every file (claim-map files left out). */
export async function hashSource(dir: string): Promise<string> {
  const files: string[] = [];
  async function walk(d: string): Promise<void> {
    for (const e of await readdir(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) await walk(full);
      else if (e.isFile() && !SKIP.test(e.name)) files.push(full);
    }
  }
  await walk(dir);
  const rel = files.map((f) => path.relative(dir, f).split(path.sep).join("/")).sort();
  const hash = createHash("sha256");
  for (const r of rel) {
    hash.update(r + "\0");
    hash.update(await readFile(path.join(dir, ...r.split("/"))));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function listFile(work: string): string { return path.join(work, "papers.json"); }

export function readPapers(work: string): Record<string, PaperInfo> {
  const f = listFile(work);
  return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : {};
}

/** Add or update a paper in the list (done by full-review). */
export async function registerPaper(work: string, id: string, src: string, arxiv?: string, dev?: boolean): Promise<PaperInfo> {
  const abs = path.resolve(src);
  if (!existsSync(abs)) throw new Error(`No paper folder at ${abs}`);
  const papers = readPapers(work);
  const arxivId = arxiv ?? papers[id]?.arxiv;
  const isDev = dev ?? papers[id]?.dev;
  const info: PaperInfo = { id, src: abs, sha256: await hashSource(abs), ...(arxivId && { arxiv: arxivId }),
                            ...(isDev && { dev: true }), registered: new Date().toISOString() };
  papers[id] = info;
  await writeJson(listFile(work), papers);
  return info;
}

/**
 * Point a registered paper at a new folder (e.g. on another computer), keeping its hash: the new
 * folder must hold the same files. No model call, unlike a new full review.
 */
export async function relocatePaper(work: string, id: string, src: string): Promise<PaperInfo> {
  const papers = readPapers(work);
  const info = papers[id];
  if (!info) throw new Error(`Paper "${id}" is not in ${listFile(work)}.`);
  const abs = path.resolve(src);
  if (!existsSync(abs)) throw new Error(`No paper folder at ${abs}`);
  const now = await hashSource(abs);
  if (now !== info.sha256) {
    throw new Error(`The files in ${abs} are not the same as paper "${id}" had.\n` +
                    `  hash saved: ${info.sha256}\n  hash here:  ${now}`);
  }
  papers[id] = { ...info, src: abs };
  await writeJson(listFile(work), papers);
  return papers[id]!;
}

/** Mark a paper as a development paper (true) or a benchmark paper (false). */
export async function setDev(work: string, id: string, dev: boolean): Promise<PaperInfo> {
  const papers = readPapers(work);
  const info = papers[id];
  if (!info) throw new Error(`Paper "${id}" is not in ${listFile(work)}.`);
  const { dev: _old, ...rest } = info;
  papers[id] = dev ? { ...rest, dev: true } : rest;
  await writeJson(listFile(work), papers);
  return papers[id]!;
}

/** IDs of the development papers. */
export function devPapers(work: string): string[] {
  return Object.values(readPapers(work)).filter((p) => p.dev).map((p) => p.id);
}

/** The paper's source folder, after checking that its files are unchanged since it was registered. */
export async function paperSource(work: string, id: string): Promise<string> {
  const info = readPapers(work)[id];
  if (!info) throw new Error(`Paper "${id}" is not in ${listFile(work)}. Run full-review --paper <folder> first.`);
  if (!existsSync(info.src)) throw new Error(`Paper "${id}": its folder ${info.src} no longer exists.`);
  const now = await hashSource(info.src);
  if (now !== info.sha256) {
    throw new Error(`Paper "${id}" has changed since its full review (folder ${info.src}).\n` +
                    `  hash then: ${info.sha256}\n  hash now:  ${now}\n` +
                    "Put the original files back, or run full-review for this paper again.");
  }
  return info.src;
}
