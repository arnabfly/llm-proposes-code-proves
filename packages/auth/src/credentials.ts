// credentials.ts - the file that holds your keys and sign-in tokens.
//
// Location: ~/.tygig/credentials.json (design document D8): in your home folder,
// never in a project. On macOS and Linux the file is readable only by you (0600).
// On Windows it inherits the protection of your user folder.
//
// Two Tygig windows may use this file at the same time, so every change happens
// under a lock: read, change, write, then release.

import { mkdir, open, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";

/** One signed-in ChatGPT account (fields from OpenAI's "what to store" list). */
export interface ChatGPTAccount {
  email: string;
  issuer: string;
  subject: string;          // the account's stable id ("sub" in the ID token)
  clientId: string;         // issued to Tygig for this account at first sign-in
  idToken: string;
  accessToken: string;      // sent with every request; valid about one hour
  refreshToken: string;     // used to get a new access token; valid about 30 days
  tokenType: string;
  expiresIn: number;        // seconds, counted from savedAt
  scopes: string[];         // what the user allowed
  savedAt: number;          // when the tokens were saved (ms since 1970)
  planUsage: boolean;       // did the user allow Tygig to use the ChatGPT plan?
  welcomed: boolean;        // has the first-time notice been shown?
}

export interface Credentials {
  /** API keys by preset id ("openai"), or "custom:<address>" for your own servers. */
  apiKeys: Record<string, string>;
  chatgpt: {
    hostId?: string;                 // identifies this computer to OpenAI; kept forever
    account?: ChatGPTAccount;        // absent until the first sign-in
  };
}

const EMPTY: Credentials = { apiKeys: {}, chatgpt: {} };

/** Read the file. A missing file simply means: nothing stored yet. */
export async function readCredentials(file: string): Promise<Credentials> {
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch (err: any) {
    if (err.code === "ENOENT") return structuredClone(EMPTY);
    throw new Error(`Could not read ${file}: ${err.message}`);
  }
  try {
    const json = JSON.parse(text);
    return { apiKeys: json.apiKeys ?? {}, chatgpt: json.chatgpt ?? {} };
  } catch {
    throw new Error(`${file} is damaged. Rename or delete it, then run: tygig login`);
  }
}

/** Read, change, write: under the lock, so two Tygig windows cannot overwrite each other. */
export async function updateCredentials(file: string,
                                        change: (c: Credentials) => void): Promise<Credentials> {
  return withLock(file, async () => {
    const data = await readCredentials(file);
    change(data);
    await writeFileAtomic(file, JSON.stringify(data, null, 2), 0o600);
    return data;
  });
}

/**
 * Run `work` while holding the lock on `file`. The lock is a second file,
 * `<file>.lock`, that only one process can create at a time ("wx" = create, fail
 * if it exists). A lock older than 30 seconds is left over from a crash and removed
 * (nothing holds it that long: every network request under it gives up after 15).
 */
export async function withLock<T>(file: string, work: () => Promise<T>): Promise<T> {
  const lock = `${file}.lock`;
  await mkdir(path.dirname(file), { recursive: true });
  for (let attempt = 0; ; attempt++) {
    try {
      const handle = await open(lock, "wx");
      await handle.close();
      break;                                                    // the lock is ours
    } catch (err: any) {
      if (err.code !== "EEXIST") throw err;
      const age = await stat(lock).then((s) => Date.now() - s.mtimeMs, () => 0);
      if (age > 30_000) { await rm(lock, { force: true }); continue; }
      if (attempt > 700) throw new Error(`${lock} is held by another Tygig window. If none is open, delete it.`);
      await sleep(50);                                          // wait for the other window
    }
  }
  try {
    return await work();
  } finally {
    await rm(lock, { force: true });
  }
}

/**
 * Write a file safely: first to a temporary file, then rename it over the old one,
 * so a crash can never leave a half-written file. On Windows, antivirus or backup
 * tools sometimes hold a file for a moment, so the rename is retried briefly.
 */
export async function writeFileAtomic(file: string, text: string, mode?: number): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
  await writeFile(temp, text, { encoding: "utf8", mode });
  for (let attempt = 1; ; attempt++) {
    try {
      await rename(temp, file);
      return;
    } catch (err: any) {
      const busy = ["EPERM", "EACCES", "EBUSY"].includes(err.code);
      if (!busy || attempt >= 10) {
        await rm(temp, { force: true });                       // never leave secrets behind
        throw err;
      }
      await sleep(50 * attempt);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
