// arxiv.ts - download a paper's LaTeX source from arXiv and unpack it into a folder.
//
// arXiv serves the source at https://arxiv.org/src/<id> (use the ID with its version, e.g. 2611.16104v1,
// so the same files come back every time). It is usually a gzipped tar archive; sometimes a single
// gzipped .tex file. The tar archive is unpacked here in plain Node.js, so no other program is needed
// on Windows, macOS or Linux.

import { existsSync, readdirSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { gunzipSync } from "node:zlib";

export const ARXIV_BASE = "https://arxiv.org";

/** True for a gzip stream. */
function isGzip(b: Uint8Array): boolean { return b.length > 2 && b[0] === 0x1f && b[1] === 0x8b; }

/** True for a tar archive (ustar magic at byte 257, or a valid first header checksum). */
export function isTar(b: Uint8Array): boolean {
  if (b.length < 512) return false;
  if (Buffer.from(b.subarray(257, 262)).toString("latin1") === "ustar") return true;
  const stored = parseInt(Buffer.from(b.subarray(148, 156)).toString("latin1").replace(/\0.*$/, "").trim(), 8);
  if (!Number.isFinite(stored)) return false;
  let sum = 0;
  for (let i = 0; i < 512; i++) sum += i >= 148 && i < 156 ? 32 : b[i]!;
  return sum === stored;
}

function field(h: Buffer, start: number, len: number): string {
  return h.subarray(start, start + len).toString("utf8").replace(/\0.*$/s, "");
}

/** Refuse names that would land outside the folder. */
function safeName(name: string): string | null {
  const parts = name.replace(/\\/g, "/").split("/").filter((p) => p !== "" && p !== ".");
  if (parts.length === 0 || parts.some((p) => p === "..") || /^[A-Za-z]:/.test(parts[0]!) || name.startsWith("/")) return null;
  return parts.join("/");
}

/** Unpack a tar archive (regular files and folders only) into dest. Returns the files written. */
export async function untar(tar: Uint8Array, dest: string): Promise<string[]> {
  const buf = Buffer.from(tar);
  const written: string[] = [];
  let offset = 0;
  let longName: string | null = null;
  let paxPath: string | null = null;
  while (offset + 512 <= buf.length) {
    const h = buf.subarray(offset, offset + 512);
    if (h.every((x) => x === 0)) break;                       // end of archive
    const size = parseInt(field(h, 124, 12).trim() || "0", 8);
    const type = String.fromCharCode(h[156]!) || "0";
    const prefix = field(h, 257, 6) === "ustar" ? field(h, 345, 155) : "";
    let name = longName ?? paxPath ?? (prefix ? `${prefix}/${field(h, 0, 100)}` : field(h, 0, 100));
    const body = buf.subarray(offset + 512, offset + 512 + size);
    offset += 512 + Math.ceil(size / 512) * 512;
    if (type === "L") { longName = body.toString("utf8").replace(/\0.*$/s, ""); continue; }   // GNU long name
    if (type === "x") {                                                                      // pax header
      const m = /\d+ path=([^\n]*)\n/.exec(body.toString("utf8"));
      paxPath = m ? m[1]! : null;
      continue;
    }
    if (type === "g") continue;                                                              // global pax header
    longName = null; paxPath = null;
    const rel = safeName(name);
    if (!rel) continue;
    const target = path.join(dest, ...rel.split("/"));
    if (type === "5") { await mkdir(target, { recursive: true }); continue; }
    if (type !== "0" && type !== "\0" && type !== "7") continue;                            // links etc. are skipped
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body);
    written.push(rel);
  }
  return written;
}

/**
 * Turn what arXiv sent into files in dest: a (gzipped) tar archive is unpacked; a single (gzipped)
 * LaTeX file is saved as <name>.tex. A PDF is refused (the paper has no LaTeX source on arXiv).
 */
export async function unpackSource(data: Uint8Array, dest: string, name: string): Promise<string[]> {
  let bytes: Uint8Array = data;
  if (isGzip(bytes)) bytes = gunzipSync(bytes);
  if (Buffer.from(bytes.subarray(0, 5)).toString("latin1") === "%PDF-") {
    throw new Error("arXiv sent a PDF, not LaTeX source: this paper has no source on arXiv.");
  }
  await mkdir(dest, { recursive: true });
  if (isTar(bytes)) return untar(bytes, dest);
  const file = `${name}.tex`;
  await writeFile(path.join(dest, file), bytes);
  return [file];
}

/** Download the source of one arXiv paper (ID with version) into dest, which must be empty or new. */
export async function downloadArxivSource(
  arxivId: string, dest: string,
  opts: { base?: string; fetchImpl?: typeof fetch } = {},
): Promise<string[]> {
  if (!/^\d{4}\.\d{4,5}(v\d+)?$/.test(arxivId)) throw new Error(`"${arxivId}" is not an arXiv ID like 2611.16104v1.`);
  if (existsSync(dest) && readdirSync(dest).length > 0) throw new Error(`The folder ${dest} is not empty.`);
  const url = `${opts.base ?? process.env.TYGIG_ARXIV_BASE ?? ARXIV_BASE}/src/${arxivId}`;  // the variable is for tests
  const res = await (opts.fetchImpl ?? fetch)(url, { headers: { "User-Agent": "tygig-bench (research benchmark)" }, redirect: "follow" });
  if (!res.ok) throw new Error(`Download failed: ${url} answered ${res.status} ${res.statusText}.`);
  const data = new Uint8Array(await res.arrayBuffer());
  return unpackSource(data, dest, arxivId.replace(/v\d+$/, ""));
}
