// ChatApp.tsx - the chat screen: you type, the agent answers.
//
// This component holds the screen's state (what is shown, whether the agent is
// busy, which list is open) and connects the agent's events to the screen and to
// the session log. The pieces it draws come from @tygig/ui.

import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import type { AgentEvent, Message } from "@tygig/core";
import { createAgent, listSessions, projectSessionsDir, Session } from "@tygig/agent";
import type { Agent, SessionInfo } from "@tygig/agent";
import { Picker, Prompt, Spinner, Transcript } from "@tygig/ui";
import type { Entry } from "@tygig/ui";
import { writeConfig } from "./config.js";
import type { Config } from "./config.js";
import type { Connected } from "./connect.js";
import { hackathonTools } from "./hackathon-tools.js";
import { buildInstructions } from "./instructions.js";
import type { Paths } from "./paths.js";

/** Shared with main.tsx, which needs to know what happened when the screen closes. */
export interface Holder {
  session: Session;             // the conversation being saved (changes on /new and /resume)
  next: "quit" | "login";       // what main.tsx should do after the screen closes
  running?: Promise<void>;      // the turn in progress, so main.tsx can wait for its last lines
}

interface ChatAppProps {
  config: Config;
  paths: Paths;
  connected: Connected;
  projectDir: string;
  holder: Holder;
}

/** What occupies the bottom of the screen. */
type Screen =
  | { name: "chat" }
  | { name: "loading"; label: string }
  | { name: "models"; models: string[] }
  | { name: "sessions"; sessions: SessionInfo[] };

const HELP = [
  "/model    choose another model",
  "/resume   continue an earlier conversation in this folder",
  "/new      start a new conversation",
  "/login    connect another provider or account",
  "/help     show this list",
  "/quit     leave Tygig (Ctrl+C works too)",
  "Esc       interrupt the answer being written",
];

export function ChatApp({ config, paths, connected, projectDir, holder }: ChatAppProps) {
  const { exit } = useApp();
  const instructions = useMemo(() => buildInstructions(projectDir), [projectDir]);
  const sessionsDir = projectSessionsDir(paths.home, projectDir);

  // Values that change without redrawing the screen live in refs.
  const configRef = useRef(config);
  const makeAgent = (history: Message[] = []) => createAgent({
    provider: connected.provider, model: configRef.current.model, instructions, history,
    stepLimit: configRef.current.stepLimit,
    tools: hackathonTools,
  });
  const agentRef = useRef<Agent | null>(null);
  agentRef.current ??= makeAgent();                  // created once, on the first draw
  const abortRef = useRef<AbortController | undefined>(undefined);
  const loadingRef = useRef(0);                      // which "Loading models" is current

  // Values that change what is drawn live in state.
  const [entries, setEntries] = useState<Entry[]>([{
    kind: "header", provider: connected.label, model: config.model, folder: projectDir,
    chatgptPlan: connected.preset.kind === "chatgpt",
  }]);
  const [streaming, setStreaming] = useState("");     // the answer being written
  const [busy, setBusy] = useState(false);            // waiting for the model?
  const [input, setInput] = useState("");             // what you are typing
  const [model, setModel] = useState(config.model);
  const [screen, setScreen] = useState<Screen>({ name: "chat" });

  const add = (...more: Entry[]) => setEntries((previous) => [...previous, ...more]);

  // Esc interrupts the answer, or leaves "Loading models". If the screen closes
  // (Ctrl+C), stop any request too.
  useInput((_input, key) => {
    if (!key.escape) return;
    if (screen.name === "chat" && busy) abortRef.current?.abort();
    if (screen.name === "loading") { loadingRef.current++; setScreen({ name: "chat" }); }
  }, { isActive: screen.name === "chat" || screen.name === "loading" });
  useEffect(() => () => abortRef.current?.abort(), []);

  /** Every event from the agent comes here: saved to the log, then shown. */
  function onEvent(event: AgentEvent) {
    holder.session.record(event);
    switch (event.type) {
      case "turn_start":
        add({ kind: "user", text: event.text });
        break;
      case "text_delta":
        setStreaming((text) => text + event.text);
        break;
      case "assistant_message":
        setStreaming("");
        if (event.message.text) add({ kind: "assistant", text: event.message.text });
        break;
      case "tool_result": {
        // Only the first line on screen: a whole table or section would fill it. The log keeps everything.
        const lines = event.text.split("\n");
        const more = lines.length > 1 ? ` (+${lines.length - 1} more lines)` : "";
        add({ kind: "info", text: `[${event.name}] ${lines[0]}${more}` });
        break;
      }
      case "error":
        add({ kind: "error", message: event.message, hint: event.hint });
        break;
      case "turn_end": {
        const summary = describeEnd(event);
        if (summary) add({ kind: "stats", text: summary });
        break;
      }
    }
  }

  /** Send a message to the agent and wait until its turn is over. */
  async function send(text: string) {
    setBusy(true);
    const abort = new AbortController();
    abortRef.current = abort;
    try {
      holder.running = agentRef.current!.run(text, onEvent, abort.signal);
      await holder.running;
    } finally {
      abortRef.current = undefined;
      setStreaming("");
      setBusy(false);
    }
  }

  /** Enter was pressed in the input line. */
  function submit(value: string) {
    const text = value.trim();
    if (text === "" || busy) return;
    setInput("");
    if (text.startsWith("/")) void safely(() => command(text));
    else void send(text);
  }

  /** Run an action; if it fails, show the error instead of crashing. */
  async function safely(action: () => Promise<void>) {
    try {
      await action();
    } catch (err: any) {
      add({ kind: "error", message: err?.message ?? String(err), hint: err?.hint ?? "Try again." });
      setScreen({ name: "chat" });
    }
  }

  async function command(line: string) {
    const name = line.split(/\s+/)[0];
    switch (name) {
      case "/help":
        add({ kind: "info", text: HELP.join("\n") });
        break;

      case "/model": {
        const ticket = ++loadingRef.current;
        setScreen({ name: "loading", label: "Loading models  (Esc to cancel)" });
        try {
          const models = await connected.provider.listModels();
          if (ticket === loadingRef.current) setScreen({ name: "models", models });   // not cancelled
        } catch (err: any) {
          if (ticket !== loadingRef.current) return;
          add({ kind: "error", message: err.message, hint: err.hint ?? "Try again later." });
          setScreen({ name: "chat" });
        }
        break;
      }

      case "/resume": {
        const sessions = (await listSessions(sessionsDir)).filter((s) => s.file !== holder.session.file);
        if (sessions.length === 0) add({ kind: "info", text: "No earlier conversations in this folder." });
        else setScreen({ name: "sessions", sessions });
        break;
      }

      case "/new":
        await holder.session.flush();
        holder.session = Session.create(sessionsDir,
          { provider: configRef.current.provider, model: configRef.current.model, cwd: projectDir },
          connected.secrets);
        agentRef.current = makeAgent();
        add({ kind: "info", text: "New conversation." });
        break;

      case "/login":
        holder.next = "login";
        exit();
        break;

      case "/quit":
      case "/exit":
        exit();
        break;

      default:
        add({ kind: "error", message: `Unknown command: ${name}`, hint: "Type /help to see the commands." });
    }
  }

  async function chooseModel(id: string) {
    agentRef.current!.model = id;                     // used from the next message on
    configRef.current = { ...configRef.current, model: id };
    await writeConfig(paths.config, configRef.current);
    holder.session.note({ type: "model_change", model: id });
    setModel(id);
    add({ kind: "info", text: `Model: ${id}` });
    setScreen({ name: "chat" });
  }

  async function chooseSession(file: string) {
    await holder.session.flush();
    const opened = await Session.open(file, connected.secrets);
    holder.session = opened.session;
    agentRef.current = makeAgent(opened.history);
    const shown: Entry[] = opened.history.flatMap((m): Entry[] =>
      m.role === "user" ? [{ kind: "user", text: m.text }] :
      m.role === "assistant" && m.text ? [{ kind: "assistant", text: m.text }] : []);
    add({ kind: "info", text: "Resumed the conversation below. Continue typing." }, ...shown);
    setScreen({ name: "chat" });
  }

  return (
    <Box flexDirection="column">
      <Transcript entries={entries} />

      {screen.name === "chat" && (
        <Box flexDirection="column" marginTop={1}>
          {streaming !== "" && <Text>{lastLines(streaming, Math.max((process.stdout.rows ?? 24) - 6, 5),
                                                process.stdout.columns ?? 80)}</Text>}
          {busy && <Spinner label={streaming ? "writing  (Esc to interrupt)" : "thinking  (Esc to interrupt)"} />}
          {!busy && <Prompt label="›" value={input} onChange={setInput} onSubmit={submit}
                            placeholder="Ask anything, or type /help" />}
          <Text dimColor>{model}  ·  {connected.label}</Text>
        </Box>
      )}

      {screen.name === "loading" && <Spinner label={screen.label} />}

      {screen.name === "models" && (
        <Picker title="Choose a model" allowCustom
                items={screen.models.map((m) => ({ label: m, value: m, hint: m === model ? "current" : undefined }))}
                onSelect={(id) => void safely(() => chooseModel(id))}
                onCancel={() => setScreen({ name: "chat" })} />
      )}

      {screen.name === "sessions" && (
        <Picker title="Resume a conversation"
                items={screen.sessions.map((s) => ({
                  label: `${formatDate(s.started)}  ${shorten(s.firstMessage, 50)}`,
                  value: s.file,
                  hint: `${s.turns} message${s.turns === 1 ? "" : "s"}`,
                }))}
                onSelect={(file) => void safely(() => chooseSession(file))}
                onCancel={() => setScreen({ name: "chat" })} />
      )}
    </Box>
  );
}

/** The grey line under each answer. */
function describeEnd(event: Extract<AgentEvent, { type: "turn_end" }>): string | undefined {
  const time = `${event.seconds.toFixed(1)} s`;
  const { inputTokens, outputTokens } = event.usage;
  const tokens = inputTokens + outputTokens > 0 ? `  ·  ${inputTokens} in / ${outputTokens} out tokens` : "";
  switch (event.reason) {
    case "done": return time + tokens;
    case "interrupted": return `interrupted after ${time}`;
    case "step_limit": return `stopped: step limit reached after ${time}`;
    case "error": return undefined;            // the error itself is already shown
  }
}

/**
 * While an answer streams, show only as much of its end as fits on screen. Ink
 * redraws this part on every new word; taller than the window, it would flicker.
 * A long line wraps over several rows, so rows are counted, not lines.
 * The complete answer is printed in full as soon as it is finished.
 */
function lastLines(text: string, rows: number, columns: number): string {
  const lines = text.split("\n");
  const kept: string[] = [];
  let used = 0;
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]!;
    const height = Math.max(1, Math.ceil(line.length / columns));
    if (used + height > rows) {
      // Keep the end of this line, as many rows as still fit, and mark the cut.
      const room = (rows - used) * columns;
      if (room > 0) kept.unshift(line.slice(-room));
      return "…" + kept.join("\n");
    }
    kept.unshift(line);
    used += height;
  }
  return text;
}

function formatDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function shorten(text: string, max: number): string {
  const line = text.replace(/\s+/g, " ");
  return line.length > max ? line.slice(0, max - 1) + "…" : line;
}
