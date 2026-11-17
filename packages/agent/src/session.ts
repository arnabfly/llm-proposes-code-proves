// session.ts - saving conversations (design document §17, D28, D29).
//
// Each conversation is one file of JSON Lines: one event per line, appended the
// moment it happens. The file is both the log and the way to resume.
// Location: ~/.tygig/projects/<project folder, encoded>/<date>_<time>_<id>.jsonl

import { appendFile, mkdir, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { AgentEvent, Message } from "@tygig/core";

/** What the session list shows for each saved conversation. */
export interface SessionInfo {
  file: string;
  started: Date;
  firstMessage: string;   // your first message, as a title
  turns: number;          // how many messages you sent
  model: string;
}

/**
 * The folder for one project's conversations: every non-letter/digit becomes "-".
 * On Windows, folder names ignore upper and lower case, so the name is lower-cased.
 */
export function projectSessionsDir(tygigHome: string, projectDir: string): string {
  const name = projectDir.replace(/[^a-zA-Z0-9]/g, "-");
  return path.join(tygigHome, "projects", process.platform === "win32" ? name.toLowerCase() : name);
}

export class Session {
  readonly file: string;
  private started = false;                         // has session_start been written?
  private queue: Promise<void> = Promise.resolve();  // keeps lines in order
  private meta: object;
  private secrets: string[];

  /** `secrets`: values (API keys, tokens) that must never appear in the file. */
  constructor(file: string, meta: object, secrets: string[], alreadyStarted = false) {
    this.file = file;
    this.meta = meta;
    this.secrets = secrets.filter((s) => s.length >= 8);
    this.started = alreadyStarted;
  }

  /** A new, empty conversation. The file is created when the first line is written. */
  static create(dir: string, meta: { provider: string; model: string; cwd: string },
                secrets: string[]): Session {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
                  `_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const id = Math.random().toString(36).slice(2, 6);
    return new Session(path.join(dir, `${stamp}_${id}.jsonl`), meta, secrets);
  }

  /** Reopen a saved conversation: rebuild the messages, continue in the same file. */
  static async open(file: string, secrets: string[]): Promise<{ session: Session; history: Message[]; model?: string }> {
    const lines = (await readFile(file, "utf8")).split("\n").filter(Boolean);
    const history: Message[] = [];
    let model: string | undefined;
    for (const line of lines) {
      let e: any;
      try { e = JSON.parse(line); } catch { continue; }   // skip a damaged line
      if (e.type === "session_start" || e.type === "model_change") model = e.model;
      else if (e.type === "user") history.push({ role: "user", text: e.text });
      else if (e.type === "assistant") history.push({ role: "assistant", text: e.text, toolCalls: e.toolCalls ?? [] });
      else if (e.type === "tool_result") history.push({ role: "tool", toolCallId: e.toolCallId, text: e.text });
    }
    return { session: new Session(file, {}, secrets, true), history, model };
  }

  /** Store the events worth keeping. Streaming pieces are not stored: the full text is. */
  record(event: AgentEvent): void {
    switch (event.type) {
      case "turn_start":
        this.write({ type: "user", text: event.text });
        break;
      case "assistant_message":
        this.write({ type: "assistant", text: event.message.text, toolCalls: event.message.toolCalls,
                     usage: event.usage });
        break;
      case "tool_result":
        this.write({ type: "tool_result", toolCallId: event.toolCallId, name: event.name, text: event.text });
        break;
      case "error":
        this.write({ type: "error", message: event.message });
        break;
      case "turn_end":
        this.write({ type: "turn_end", reason: event.reason, seconds: event.seconds, usage: event.usage });
        break;
    }
  }

  /** Store anything else, e.g. { type: "model_change", model }. */
  note(entry: object): void {
    this.write(entry);
  }

  /** Wait until every line has reached the disk (used before quitting). */
  flush(): Promise<void> {
    return this.queue;
  }

  private write(entry: object): void {
    const lines: object[] = [];
    if (!this.started) {                       // first line of a new file
      this.started = true;
      lines.push({ type: "session_start", ...this.meta });
    }
    lines.push(entry);
    const text = lines.map((l) => this.redact(JSON.stringify({ t: new Date().toISOString(), ...l })) + "\n").join("");

    this.queue = this.queue
      .then(async () => {
        await mkdir(path.dirname(this.file), { recursive: true });
        await appendFile(this.file, text, "utf8");
      })
      .catch(() => { /* a full disk must not crash the conversation */ });
  }

  private redact(line: string): string {
    for (const secret of this.secrets) line = line.split(secret).join("[redacted]");
    return line;
  }
}

/** All saved conversations for one project, newest first. */
export async function listSessions(dir: string): Promise<SessionInfo[]> {
  let names: string[];
  try {
    names = (await readdir(dir)).filter((n) => n.endsWith(".jsonl"));
  } catch {
    return [];                                  // no folder yet: no conversations
  }
  const infos: SessionInfo[] = [];
  for (const name of names) {
    const file = path.join(dir, name);
    const lines = (await readFile(file, "utf8")).split("\n").filter(Boolean);
    let started = new Date(0), firstMessage = "", turns = 0, model = "";
    for (const line of lines) {
      let e: any;
      try { e = JSON.parse(line); } catch { continue; }
      if (e.type === "session_start") { started = new Date(e.t); model = e.model ?? ""; }
      if (e.type === "model_change") model = e.model;
      if (e.type === "user") { turns++; if (!firstMessage) firstMessage = e.text; }
    }
    if (turns > 0) infos.push({ file, started, firstMessage, turns, model });
  }
  return infos.sort((a, b) => b.started.getTime() - a.started.getTime());
}
