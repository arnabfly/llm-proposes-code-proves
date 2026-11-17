// main.tsx - where Tygig starts. Reads the command you typed and does it.
//
//   tygig            chat in the current folder (logs in first if needed)
//   tygig login      connect a provider or account
//   tygig logout     disconnect the current connection (add --all: remove everything stored)
//   tygig sessions   list saved conversations for this folder
//   tygig help       show this list

import { rm } from "node:fs/promises";
import { render } from "ink";
import { PRESETS, getPreset } from "@tygig/ai";
import { readCredentials, signOutChatGPT, updateCredentials } from "@tygig/auth";
import { listSessions, projectSessionsDir, Session } from "@tygig/agent";
import { ChatApp } from "./ChatApp.js";
import type { Holder } from "./ChatApp.js";
import { LoginApp } from "./LoginApp.js";
import { readConfig } from "./config.js";
import { connect, keySlot } from "./connect.js";
import { currentProjectFolder, getPaths } from "./paths.js";
import type { Paths } from "./paths.js";

const VERSION = "0.1.0";

async function main(): Promise<void> {
  const command = process.argv[2];
  const paths = getPaths();

  switch (command) {
    case undefined:   await chat(paths); break;
    case "login":     await login(paths); break;
    case "logout":    await logout(paths, process.argv.includes("--all")); break;
    case "sessions":  await sessions(paths); break;
    case "help": case "--help": case "-h":  printHelp(); break;
    case "version": case "--version": case "-v":  console.log(VERSION); break;
    default:
      console.error(`Unknown command: ${command}\n`);
      printHelp();
      process.exitCode = 1;
  }
}

/** Chat in the current folder. */
async function chat(paths: Paths): Promise<void> {
  requireTerminal();
  let config = await readConfig(paths.config);
  if (!config) {                                      // first run: connect a model first
    console.log("Welcome to Tygig. First, connect a model.");
    if (!(await login(paths))) return;
    config = await readConfig(paths.config);
    if (!config) return;
  }

  for (;;) {                                          // repeats only after /login
    let connected;
    try {
      connected = await connect(config, paths);
    } catch (err) {
      console.error(`✗ ${(err as Error).message}`);
      process.exitCode = 1;
      return;
    }

    const projectDir = currentProjectFolder();         // the folder you started Tygig in
    const holder: Holder = {
      session: Session.create(projectSessionsDir(paths.home, projectDir),
        { provider: config.provider, model: config.model, cwd: projectDir }, connected.secrets),
      next: "quit",
    };

    const app = render(<ChatApp config={config} paths={paths} connected={connected}
                                projectDir={projectDir} holder={holder} />);
    await app.waitUntilExit();                         // until /quit, /login or Ctrl+C
    await holder.running?.catch(() => {});             // an interrupted turn records its last lines
    await holder.session.flush();                      // every line on disk before leaving

    if (holder.next !== "login") return;
    await login(paths);
    config = (await readConfig(paths.config)) ?? config;
  }
}

/** Run the login wizard. Returns true if a connection was saved. */
async function login(paths: Paths): Promise<boolean> {
  requireTerminal();
  const result = { saved: false };
  const app = render(<LoginApp paths={paths} result={result} />);
  await app.waitUntilExit();
  return result.saved;
}

/**
 * Disconnect. Without --all: the current connection only (a ChatGPT sign-in is
 * revoked at OpenAI; an API key is deleted). With --all: every stored key and
 * sign-in, including the ChatGPT registration, so another account can sign in.
 */
async function logout(paths: Paths, all: boolean): Promise<void> {
  const config = await readConfig(paths.config);
  const creds = await readCredentials(paths.credentials);
  const envNote = () => {
    const set = PRESET_ENV_VARS.filter((v) => process.env[v]);
    if (set.length > 0) console.log(`Note: ${set.join(", ")} still set in your environment; Tygig would use it.`);
  };

  if (all) {
    if (creds.chatgpt.account) {
      const revoked = await signOutChatGPT(paths.credentials, true);
      console.log(revoked ? "Signed out of ChatGPT." : "Signed out of ChatGPT on this computer (OpenAI did not confirm).");
    }
    await updateCredentials(paths.credentials, (c) => { c.apiKeys = {}; });
    await rm(paths.config, { force: true });
    console.log("Removed every stored key and sign-in from this computer.");
    envNote();
    return;
  }

  if (!config) {
    const stored = [...Object.keys(creds.apiKeys), ...(creds.chatgpt.account?.refreshToken ? ["ChatGPT sign-in"] : [])];
    console.log(stored.length === 0 ? "You are not logged in."
      : `Nothing is connected, but this computer still stores: ${stored.join(", ")}.\nRemove everything: tygig logout --all`);
    return;
  }

  const preset = getPreset(config.provider);
  if (preset.kind === "chatgpt") {
    const revoked = await signOutChatGPT(paths.credentials);
    console.log(revoked
      ? "Signed out of ChatGPT."
      : "Signed out on this computer, but OpenAI did not confirm. You can also disconnect Tygig in ChatGPT > Settings.");
  } else if (preset.kind === "api") {
    await updateCredentials(paths.credentials, (c) => { delete c.apiKeys[keySlot(preset.id, config.baseUrl)]; });
    console.log(`Removed your ${preset.label} key from this computer.`);
    if (preset.keyEnv && process.env[preset.keyEnv]) {
      console.log(`Note: ${preset.keyEnv} is still set in your environment, and Tygig would use it.`);
    }
  } else {
    console.log(`Disconnected from ${preset.label}.`);
  }
  await rm(paths.config, { force: true });           // next start asks you to log in
}

/** Every environment variable a provider's key may be in. */
const PRESET_ENV_VARS = PRESETS.flatMap((p) => (p.keyEnv ? [p.keyEnv] : []));

async function sessions(paths: Paths): Promise<void> {
  const folder = currentProjectFolder();
  const list = await listSessions(projectSessionsDir(paths.home, folder));
  if (list.length === 0) {
    console.log("No saved conversations for this folder.");
    return;
  }
  for (const s of list) {
    console.log(`${s.started.toLocaleString()}  ${s.turns} msg  ${s.model}  ${s.firstMessage.replace(/\s+/g, " ").slice(0, 60)}`);
  }
  console.log(`\nStored in ${projectSessionsDir(paths.home, folder)}`);
  console.log("Continue one inside Tygig with /resume.");
}

function printHelp(): void {
  console.log(`tygig ${VERSION}: an agent harness where every action is permitted and proven

Usage:
  tygig            chat in the current folder
  tygig login      connect a ChatGPT account, an API key, or a local model
  tygig logout     disconnect the current connection
  tygig logout --all   remove every stored key and sign-in
  tygig sessions   list saved conversations for this folder
  tygig help       show this help

Inside a chat, type /help for commands.`);
}

/** The chat screen reads single key presses, which needs a real terminal window. */
function requireTerminal(): void {
  if (!process.stdin.isTTY) {
    console.error("Tygig needs an interactive terminal. Run it directly in PowerShell, Windows Terminal or VS Code.");
    process.exit(1);
  }
}

main()
  .catch((err) => {
    console.error(`✗ ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  })
  .finally(() => process.exit());                    // do not wait for idle network connections
