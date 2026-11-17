<div class="title-page">
<div class="name">Tygig</div>
<div class="sub">The base harness: guide and line-by-line code traces</div>
<div class="meta">
Version 0.1.0 · October 2026<br>
For: Arnab · Written to be read on its own, from the first page to the last<br>
Code: <code>tygig-base.zip</code> (34 source files, 54 automated tests)<br>
Licence: Apache-2.0
</div>
</div>

# Contents

[[TOC]]

# Part 1. Before you start

## 1. What you are getting

This is the **base** of Tygig: everything a harness needs **around** the model, finished and working, with nothing on top yet.

**What it does**

- **Connects any model, three ways.**
  - **Continue with ChatGPT:** sign in through your browser and use your ChatGPT plan (Go, Plus or Pro).
  - **API key:** OpenAI, Anthropic, OpenRouter, Google Gemini, DeepSeek, Mistral, Groq, xAI, Together AI, or any OpenAI-compatible server.
  - **Local model:** Ollama, LM Studio, or any OpenAI-compatible server on your computer.
- **Speaks three request formats** through three translators: the OpenAI chat format, the OpenAI Responses format, and the Anthropic format.
- **Runs the agent loop**: send the conversation, stream the answer word by word, keep the conversation going. The loop is already able to handle tool requests; it simply has no tools yet.
- **Shows a finished terminal screen** built with Ink (a library for drawing terminal screens, explained in section 10.4): a header, the conversation, a moving spinner, a status line, lists you move through with the arrow keys.
- **Saves every conversation** as you go, and lets you continue an old one with `/resume`.
- **Handles failures** with plain-language messages that say what to do: a wrong key, a full rate limit, a server that is down, a local model that is not running. Rate limits and server errors are retried automatically.
- **Lets you interrupt** an answer with Esc.

**What it does not do yet**

It has no tools, plugins, skills, checks, MCP, `AGENTS.md` loading or multi-agent. It can only talk. It knows that, and says so if you ask it to read a file.

**What cannot be done at all**

Logging in with an **Anthropic (Claude) account**. Anthropic's terms forbid using Claude Free, Pro or Max sign-ins in other tools. Claude models work through an Anthropic API key, or through OpenRouter.

**What is in the zip**

| Item | What it is |
|---|---|
| `packages/` | the code, in six packages (Part 2 explains each) |
| `test/` | 54 automated tests and a fake provider that speaks all three formats |
| `docs/` | this guide, as PDF and Markdown |
| `package.json`, `tsconfig.json` | the workspace settings |
| `README.md`, `LICENSE` | a short summary; the Apache-2.0 licence |
| `.gitignore` | keeps `node_modules` and secrets out of Git |

**How it was tested before you got it**

- 54 automated tests (`npm test`) against the fake provider: the three translators, retries, errors, interrupting, the session log, and the whole Sign in with ChatGPT flow with token refresh and sign-out.
- The real terminal screen, driven by a script typing keys into a pseudo-terminal (a program that pretends to be a terminal window, so a test can press keys): every login path, a chat on each of the three formats, `/model`, `/new`, `/resume`, Esc, a wrong key, a local model that is not running, and Ctrl+C.
- The global `tygig` command, installed with `npm link` and started from another folder.

**What could not be tested from here**

The real providers. The workspace this was built in has no accounts and no access to OpenAI, Anthropic or the others. Everything provider-specific was written from each provider's official documentation and tested against a fake server that imitates it. **Your laptop is the first real test.** Section 6 gives you a checklist, and if anything fails, we debug it together.

---

## 2. How to read this guide

**Part 1** gets Tygig running and connected. **Part 2** explains how the code is organised and the new ideas it uses. **Part 3** is the heart: traces that follow what happens, line by line, from the moment you press Enter until the answer is on screen. **Part 4** is reference: troubleshooting, file formats, and the Appendix holds the full source code with line numbers.

**How a trace step looks**

Every step of a trace names the file and line, and repeats the code so you can recognise it without turning pages:

> **[agent/agent.ts:50]** `history.push({ role: "user", text });`
> Your message is added to the conversation. `history` now has one more entry.

`agent/agent.ts:50` means: package `agent`, file `src/agent.ts`, line 50. The full file, with line numbers, is in the Appendix. For the command file, `cli/bin/tygig.js` means `packages/cli/bin/tygig.js`.

**The design document.** References such as *design D8* or *design §23* point to `tygig-design.md`, the design document written before this code (it is in the AgentCofounder project). You do not need it to follow this guide.

**C comparisons.** Where a TypeScript idea has a C equivalent, it is given. Where it has none, it is explained from scratch.

---

## 3. Setting up on Windows, step by step

Do these once. Commands are for PowerShell (in Windows Terminal or the VS Code terminal). Notes for Linux and macOS follow each step where they differ.

### Step 1. Check Node.js

```powershell
node --version
```

You need **v22** or newer. If it says v20 or lower, or "not recognised", install the current LTS version (Long Term Support, the stable one) from https://nodejs.org (the installer adds `node` and `npm`), then open a new terminal and check again.

*Why:* the terminal library (Ink 8) needs Node 22. If you start Tygig on an older Node, it stops at once and says so.

### Step 2. Unzip the project

Unzip `tygig-base.zip` into the folder where you keep your work, for example:

```
C:\Arnab Work Files\tygig\
```

Then open that folder in VS Code (File → Open Folder) and open the terminal (Ctrl + backtick). The terminal now sits in the `tygig` folder.

```powershell
cd "C:\Arnab Work Files\tygig"     # only needed if the terminal is elsewhere
```

The quotes are needed because the path has spaces.

### Step 3. Install the packages

```powershell
npm install
```

This reads `package.json`, downloads the libraries Tygig uses (Ink and React for the screen, tsx to run TypeScript directly, TypeScript; section 10 explains them) into `node_modules`, and links the six Tygig packages to each other. It takes under a minute. You should see `found 0 vulnerabilities` at the end.

### Step 4. Run the automated tests (recommended)

```powershell
npm test
```

This runs 54 tests against the fake provider. No key and no internet needed. At the end you should see:

```text
# tests 54
# pass 54
# fail 0
```

*Why:* if all 54 pass on your laptop, the code works on Windows before you involve any real provider. If something fails here, it is a setup problem, not a provider problem, and that is useful to know.

### Step 5. Put it in Git

```powershell
git init
git add .
git commit -m "Tygig base harness 0.1.0"
```

`node_modules` is not added: `.gitignore` excludes it, because `npm install` can always recreate it.

When the GitHub organisation `tygig` exists and you have created an empty repository named `tygig` in it:

```powershell
git branch -M main
git remote add origin https://github.com/tygig/tygig.git
git push -u origin main
```

### Step 6. First start, inside the project folder

```powershell
npm start
```

The first time, Tygig has no settings, so it says *"Welcome to Tygig. First, connect a model."* and opens the login (section 4). After login, the chat opens.

`npm start` runs Tygig with the `tygig` folder itself as the "project folder". That is fine for a first test. To use Tygig on your **own** projects, do step 7.

### Step 7. The `tygig` command, usable in any folder

```powershell
cd packages\cli
npm link
cd ..\..
```

`npm link` creates a global command `tygig` that points to this folder. Your code is not copied: when you change the code, the command uses the change at once.

Now, in any project folder:

```powershell
cd "C:\Arnab Work Files\my-project"
tygig
```

Tygig works with that folder: its conversations are saved under that folder's name (section 5).

**If PowerShell says "running scripts is disabled on this system":** Windows is blocking the small `tygig.ps1` file that npm created. Either run this once:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

or type `tygig.cmd` instead of `tygig`.

To remove the command later: `npm unlink -g @tygig/harness`.

*Linux and macOS:* the same commands work. Use `/` instead of `\` in paths. If `npm link` says "permission denied", your npm installs global packages in a system folder; either configure a user folder for global packages (`npm config set prefix ~/.npm-global` and add `~/.npm-global/bin` to your PATH) or use `sudo npm link`.

---

## 4. Connecting each provider

Run:

```powershell
tygig login          # or: npm run login   (inside the tygig folder)
```

You see:

```text
How do you want to connect a model?
› Continue with ChatGPT   use your ChatGPT plan (Go, Plus, Pro)
  API key                 OpenAI, Anthropic, OpenRouter, Gemini and more
  Local model             Ollama or LM Studio on this computer
↑↓ move · Enter choose · Esc back
```

Move with the arrow keys, press Enter. Every path ends the same way: Tygig **tests the connection by asking for the list of models**, and normally saves nothing until that works. Two exceptions: Sign in with ChatGPT saves its tokens as soon as the browser sign-in succeeds, and a server that cannot list its models (it answers 404 or 405) is accepted without the test, so you type the model name yourself. Then you choose a model from the list (type to filter long lists, or type a model name that is not listed and choose `Use "..."`).

At the end:

```text
✓ Connected: OpenAI · gpt-6.1-sol
```

Your choice is saved in `~/.tygig/config.json`. The next `tygig` starts the chat directly. Running `tygig login` again replaces the connection; your other saved keys stay.

### 4.1 Continue with ChatGPT

**You need:** a ChatGPT account with a Go, Plus or Pro plan.

1. Choose **Continue with ChatGPT**.
2. Your browser opens OpenAI's sign-in page. The terminal also shows the address: if the browser does not open, copy it into a browser.
3. Sign in to ChatGPT as usual, and **allow Tygig to use your ChatGPT plan** when asked.
4. The browser shows *"You can close this window and return to the terminal."*
5. Back in the terminal, the first time only, Tygig shows *"You're using your ChatGPT plan"*. Press Enter on **Got it**.
6. Choose a model from the list. The list shows only the models your plan may use.

**Good to know**

- What Tygig uses counts towards your ChatGPT plan's usage. In ChatGPT → Settings → Usage you can see it and **set a weekly limit for Tygig**. The chat screen reminds you with a green line: *Using ChatGPT plan · Manage usage: ChatGPT > Settings > Usage*.
- Your password never passes through Tygig. Tygig receives tokens: an access token that lasts about an hour and is renewed automatically, and a refresh token that lasts about 30 days and is replaced at each renewal. If you do not use Tygig for 30 days, you sign in again.
- If you click "deny" for plan usage, Tygig tells you and stops. Run `tygig login` again to allow it, or use an API key instead.
- OpenAI calls this feature a **preview**. Its rules may change; Tygig follows OpenAI's current documentation for open-source apps.
- Signing in runs a tiny web server on your own computer at `127.0.0.1`, port 1455 (or another free port), until the browser comes back (at most five minutes), to receive the browser's answer. It cannot be reached from outside your computer.

### 4.2 API keys

Choose **API key**, then the provider. Tygig shows where to get a key. Paste it (it appears as `*****`), press Enter.

| Provider | Get a key at | Format Tygig uses | Notes |
|---|---|---|---|
| OpenAI | platform.openai.com/api-keys | OpenAI Responses | needs credit on your OpenAI account |
| Anthropic | console.anthropic.com/settings/keys | Anthropic | all Claude models; needs credit |
| OpenRouter | openrouter.ai/keys | OpenAI chat | one key for hundreds of models, including Claude, GPT and Gemini; model names look like `anthropic/claude-sonnet-5` |
| Google Gemini | aistudio.google.com/apikey | OpenAI chat | has a free tier; model names may start with `models/` |
| DeepSeek | platform.deepseek.com/api_keys | OpenAI chat | |
| Mistral | console.mistral.ai/api-keys | OpenAI chat | |
| Groq | console.groq.com/keys | OpenAI chat | very fast open models |
| xAI | console.x.ai | OpenAI chat | Grok models |
| Together AI | api.together.xyz/settings/api-keys | OpenAI chat | open models |
| Other (OpenAI-compatible) | your provider | OpenAI chat | you type the address first, e.g. `https://api.example.com/v1`; the key may be left empty |

**Where the key goes:** `C:\Users\<you>\.tygig\credentials.json`, only on your computer, never in a project folder. It is saved only after the connection test succeeded.

**Keys in environment variables.** If a key is already in an environment variable, Tygig finds it: the provider list shows *key found in OPENAI_API_KEY*, and you can press Enter without typing a key. That key is **not** copied to disk. The variables Tygig looks for: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`, `GEMINI_API_KEY`, `DEEPSEEK_API_KEY`, `MISTRAL_API_KEY`, `GROQ_API_KEY`, `XAI_API_KEY`, `TOGETHER_API_KEY`. To set one in PowerShell:

```powershell
$env:OPENAI_API_KEY = "sk-..."          # this terminal window only
setx OPENAI_API_KEY "sk-..."            # permanently, for new windows
```

`setx` takes effect only in programs started afterwards. In VS Code, a new terminal tab is not enough: close and reopen VS Code (or use a new Windows Terminal window).

A key typed into `tygig login` takes priority over the environment variable.

### 4.3 Local models

**Ollama**

1. Install it from https://ollama.com. It runs in the background after installation.
2. Download a model, for example: `ollama pull llama3.2`
3. In `tygig login` choose **Local model** → **Ollama**. Tygig lists the models you have downloaded.

**LM Studio**

1. Install it from https://lmstudio.ai and download a model inside the app.
2. Load the model and start the local server (in the Developer section, *Start Server*; it listens on port 1234).
3. In `tygig login` choose **Local model** → **LM Studio**.

**Other local server:** choose **Other local server** and type its address, e.g. `http://127.0.0.1:8000/v1`.

If nothing is running, Tygig says: *Nothing is answering at 127.0.0.1:11434. For a local model: is Ollama or LM Studio running?* Press Esc, start the program, try again.

*Why `127.0.0.1` and not `localhost`:* on some computers `localhost` means the IPv6 address `::1`, where these programs are not listening, and the connection fails for no visible reason. `127.0.0.1` always means "this computer, IPv4".

Small local models answer more slowly and less well than the large online ones. That is the model, not Tygig.

---

## 5. Using Tygig

### The screen

```text
tygig  ·  OpenAI  ·  gpt-6.1-sol                          ← provider and model at start
C:\Arnab Work Files\my-project                            ← the project folder
Type a message and press Enter.  /help for commands  ·  Esc interrupts  ·  Ctrl+C quits

› What is a harness?                                      ← your message
A harness is the program around a model that ...          ← the answer
  2.4 s  ·  412 in / 96 out tokens                        ← time and tokens

› _                                                       ← you type here
gpt-6.1-sol  ·  OpenAI                                    ← current model and provider
```

Some providers (Ollama, LM Studio and some OpenAI-compatible servers) do not report token counts while streaming. The grey line then shows only the time, for example `1.8 s`. This is normal, not a failure.

While the answer is being written, a spinner shows *thinking* or *writing*, and the text appears word by word. With a ChatGPT sign-in, a green line under the header says *Using ChatGPT plan*.

### Commands

| Type | What happens |
|---|---|
| `/model` | lists the models of your connection; choose one with the arrows and Enter (type to filter). Saved for next time. |
| `/resume` | lists earlier conversations **in this folder**; choose one to continue it |
| `/new` | starts a new conversation (the old one stays saved) |
| `/login` | leaves the chat, opens the login, comes back with the new connection |
| `/help` | shows this list |
| `/quit` or `/exit` | leaves Tygig |
| **Esc** | interrupts the answer being written; what was already written is kept |
| **Ctrl+C** | leaves Tygig at once (an answer in progress is stopped, and the conversation, including the part already shown, is saved first) |

And outside the chat:

| Command | What happens |
|---|---|
| `tygig sessions` | lists this folder's saved conversations |
| `tygig logout` | ChatGPT: revokes the sign-in at OpenAI and deletes the tokens. API key: deletes the stored key. Both: forget the current connection, so the next start asks you to log in |
| `tygig logout --all` | removes every stored key and sign-in from this computer, including the ChatGPT registration (needed to switch to another ChatGPT account) |
| `tygig help` | the command list |
| `tygig --version` | the version |

### Where your data is

Everything is in your home folder, never in your project (design document D28):

```text
C:\Users\Arnab\.tygig\
├── config.json                           provider, model (no secrets)
├── credentials.json                      API keys and ChatGPT tokens
└── projects\
    └── c--arnab-work-files-my-project\   one folder per project
        ├── 2026-10-28_101502_k3f9.jsonl  one conversation
        └── 2026-10-28_143010_a81c.jsonl  another
```

The project folder's name is its path with every character that is not a letter or digit replaced by `-`, in lower case on Windows (where `C:\Work` and `c:\work` are the same folder). Each conversation file is plain text, one event per line (Part 4 shows an example). You can open it in VS Code. Keys and tokens are replaced by `[redacted]` if they ever appear in it.

To delete all your conversations, delete the `projects` folder. To forget everything, delete the whole `.tygig` folder.

---

## 6. Your test checklist

Tick these off on your laptop. If one fails, send me the screen text and we debug it step by step.

**Setup**

- [ ] `node --version` shows v22 or newer
- [ ] `npm install` ends with `found 0 vulnerabilities`
- [ ] `npm test` shows `pass 54`, `fail 0`
- [ ] `tygig --version` (after `npm link`) shows `0.1.0` in another folder

**Each provider you have** (one row each: ChatGPT, OpenAI, Anthropic, OpenRouter, Gemini, ..., Ollama, LM Studio)

- [ ] `tygig login` completes and shows `✓ Connected`
- [ ] a question gets an answer that streams word by word
- [ ] a second question shows the model remembers the first ("what did I just ask?")
- [ ] `/model` lists models; switching works
- [ ] Esc during a long answer ("write 500 words about the sea") stops it and shows *interrupted*

**Once**

- [ ] `/new`, then `/resume`: the old conversation comes back and the model remembers it
- [ ] Ctrl+C, start `tygig` again in the same folder, `/resume` shows the conversation
- [ ] a wrong key (log in with `sk-wrong`) gives a clear message, not a crash (most providers say the key was rejected; Gemini answers with a 400 and its own message)
- [ ] Ollama stopped: a clear message about Ollama not running
- [ ] `tygig logout`, then `tygig`: the login opens
- [ ] `C:\Users\<you>\.tygig\projects\...` contains readable `.jsonl` files

---

# Part 2. How the code is organised

## 7. The six packages, and why six

The code is split into six packages, following the design document (§23). Each package has one job, and the rules about who may use whom keep them independent.

```text
                    ┌────────────┐
                    │    core    │   shapes only: messages, provider, events
                    └─────▲──────┘
          ┌───────────┬───┴───────┬────────────┐
       ┌──┴──┐    ┌───┴───┐   ┌───┴──┐     ┌───┴──┐
       │ ai  │    │ agent │   │ auth │     │  ui  │
       └──▲──┘    └───▲───┘   └───▲──┘     └───▲──┘
          └───────────┴─────┬─────┴────────────┘
                       ┌────┴────┐
                       │   cli   │   the only package that joins them
                       └─────────┘
```

| Package | Job | Uses |
|---|---|---|
| `core` | the shapes everything shares: a message, a model provider, an agent event, a provider error | nothing |
| `ai` | talks to model providers: three translators, the stream reader, retries and error messages, the list of providers | `core` |
| `auth` | who you are: the credentials file, Sign in with ChatGPT, token renewal, sign-out | `core` |
| `agent` | the loop that asks the model and handles its answer; the session log | `core` |
| `ui` | screen building blocks: the conversation, the arrow-key list, the input line, the spinner | `core`, Ink |
| `cli` | the `tygig` command: the chat screen, the login wizard, settings, and the wiring that joins the others | everything |

**Why the rules matter.** The `agent` package never imports `ai`: it receives "something that looks like a model provider" and uses it. That is why the same loop works with all three formats, and why the tests can give it a fake provider. The `ui` package never imports `agent`: it only draws what it is given. And `cli` is the only place where real pieces are chosen and connected. In C terms: `core` is the shared header file; the other packages are separate `.c` modules that include only that header; `cli` is `main.c`, which links them together.

**One difference from the design document.** The design listed five packages plus a plugin. This build adds `auth`, because sign-in turned out to be large enough to deserve its own package (the ChatGPT flow alone is about 240 lines), and it keeps the `mcp` package and `plugin-files` for later, since this base has no tools.

## 8. Every file, in one table

| File | Lines | Job |
|---|---|---|
| `core/message.ts` | 41 | conversation entries: user, assistant, tool result; token usage |
| `core/provider.ts` | 62 | the shape of a model provider; the request; stream pieces; ProviderError |
| `core/events.ts` | 18 | what the agent announces while it works |
| `core/index.ts` | 6 | what other packages may import from core |
| `ai/presets.ts` | 73 | every provider Tygig knows: format, address, key variable |
| `ai/connection.ts` | 32 | what a translator needs; where each format expects the key |
| `ai/sse.ts` | 66 | reads a Server-Sent Events stream into messages |
| `ai/http.ts` | 157 | sends requests, retries, turns failures into plain-language errors |
| `ai/openai-chat.ts` | 110 | translator: OpenAI chat format |
| `ai/openai-responses.ts` | 117 | translator: OpenAI Responses format (API key and ChatGPT plan) |
| `ai/anthropic.ts` | 135 | translator: Anthropic format |
| `ai/index.ts` | 21 | picks the translator for a connection |
| `auth/credentials.ts` | 125 | the credentials file: read, write safely, update |
| `auth/jwt.ts` | 57 | checks an ID token's signature and claims |
| `auth/browser.ts` | 22 | opens an address in the default browser |
| `auth/chatgpt-oauth.ts` | 240 | Sign in with ChatGPT: the whole browser flow |
| `auth/chatgpt-session.ts` | 124 | keeps the ChatGPT sign-in fresh; signs out |
| `auth/index.ts` | 8 | what other packages may import from auth |
| `agent/agent.ts` | 142 | the agent loop |
| `agent/session.ts` | 149 | saving and reopening conversations |
| `agent/index.ts` | 6 | what other packages may import from agent |
| `ui/Transcript.tsx` | 63 | the conversation on screen, printed once |
| `ui/Picker.tsx` | 67 | a list you move through with the arrow keys, with filtering |
| `ui/Prompt.tsx` | 25 | one line of text input |
| `ui/Spinner.tsx` | 15 | the moving sign while waiting |
| `ui/index.ts` | 8 | what other packages may import from ui |
| `cli/bin/tygig.js` | 22 | runs when you type tygig: checks Node, starts tsx, loads main |
| `cli/main.tsx` | 185 | reads the command and does it: chat, login, logout, sessions |
| `cli/paths.ts` | 44 | where Tygig keeps its files |
| `cli/config.ts` | 29 | reading and writing config.json |
| `cli/connect.ts` | 83 | settings + credentials + translator = a working provider |
| `cli/instructions.ts` | 15 | the system instructions sent with every request |
| `cli/ChatApp.tsx` | 310 | the chat screen |
| `cli/LoginApp.tsx` | 274 | the login wizard |
| **total** | **2851** | 34 files |

The tests (`test/`) add another four files: a fake provider and three test files.


## 9. The shared shapes, explained

Everything that travels between packages has a shape defined in `core`. Knowing these five shapes is knowing how Tygig works.

**`Message`** (`core/message.ts`): one entry in a conversation. There are three kinds, told apart by `role`:

```ts
{ role: "user", text: "What is a harness?" }
{ role: "assistant", text: "A harness is...", toolCalls: [] }
{ role: "tool", toolCallId: "call_1", text: "result of the tool" }     // not used yet
```

This is Tygig's own format. OpenAI, Anthropic and the others each have a different one; the translators convert.

**`StreamEvent`** (`core/provider.ts`): one piece of an answer as it arrives.

```ts
{ type: "text", text: " a few more words" }        // many of these
{ type: "tool_call", call: { id, name, arguments } } // not used yet
{ type: "done", usage: { inputTokens: 412, outputTokens: 96 } }   // exactly one, at the end
```

**`ModelProvider`** (`core/provider.ts`): anything that can stream an answer and list its models.

```ts
interface ModelProvider {
  label: string;
  stream(request: ModelRequest): AsyncIterable<StreamEvent>;
  listModels(): Promise<string[]>;
}
```

The three translators each create one. The loop only ever sees this shape.

**`ProviderError`** (`core/provider.ts`): an error already translated into plain words, with a `hint` saying what to do, and `retryable` saying whether trying again might help.

**`AgentEvent`** (`core/events.ts`): what the loop announces while it works.

```ts
{ type: "turn_start", text }            // you sent a message
{ type: "step_start", step }            // a model call begins
{ type: "text_delta", text }            // more words arrived
{ type: "assistant_message", message, usage }   // one complete answer
{ type: "tool_result", ... }            // not used yet
{ type: "error", message, hint }        // something went wrong
{ type: "turn_end", reason, seconds, usage }    // the turn is over
```

The loop never draws anything. It emits these events, and two readers receive each one: the chat screen (which draws it) and the session log (which saves it). This is design decision D32 in practice.

## 10. New ideas in this code

These are the ideas the traces rely on that a C programmer may not have met in TypeScript yet. Each is explained once here.

### 10.1 Streaming over HTTP: Server-Sent Events

A simple program waits until the whole answer exists, then receives it in one piece. Tygig streams the answer instead: the provider keeps the HTTP response open and sends the answer in small blocks as the model writes it.

```text
data: {"choices":[{"delta":{"content":"A harness"}}]}

data: {"choices":[{"delta":{"content":" is the"}}]}

data: [DONE]

```

Each block is one or more `field: value` lines followed by **an empty line**. This format is called **Server-Sent Events (SSE)**. All three formats use it; only the JSON inside differs. `ai/sse.ts` turns the raw bytes into one `{ event, data }` object per block.

*In C:* like reading from a socket with `recv()` in a loop, appending to a buffer, and each time the buffer contains `"\n\n"`, cutting off one complete message and processing it.

### 10.2 Async generators: functions that hand out results one by one

A normal function returns once. A **generator** can hand out many values over time, pausing in between. An **async generator** can also wait (for the network) between values.

```ts
async function* countdown() {      // the * makes it a generator
  yield 3;                         // hand out 3, pause here
  await sleep(1000);
  yield 2;                         // hand out 2, pause here
}

for await (const n of countdown()) {   // take the values one by one
  console.log(n);                      // 3, then a second later 2
}
```

Tygig's translators are async generators: they `yield` each piece of the answer as soon as it arrives, and the loop takes them with `for await`. Nothing waits for the whole answer. This chain is the backbone of streaming: **network → `readSse` → translator → loop → screen**, each passing pieces on as they come.

*In C:* there is no direct equivalent. The nearest is a producer and a consumer connected by a pipe, or a coroutine library. Think of `yield` as "write this to the pipe and sleep until the reader wants the next value".

### 10.3 Cancelling: AbortController

When you press Esc, a request that is half-way through must stop. `AbortController` is the standard way:

```ts
const controller = new AbortController();
fetch(url, { signal: controller.signal });   // fetch watches the signal
controller.abort();                          // later: fetch stops, throws an AbortError
```

The chat screen creates one controller per message and passes its `signal` down through the loop to `fetch`. Esc calls `abort()`. The `fetch` rejects with an `AbortError`, which travels back up; the loop sees that the signal was aborted and ends the turn as *interrupted* instead of reporting an error.

*In C:* like a shared flag that the worker thread checks, plus closing the socket so a blocked `recv()` returns at once.

### 10.4 React and Ink: describing the screen

A simple program prints lines with `console.log`. Tygig's screen is built with **Ink**, which is **React** for the terminal. The idea: instead of printing, you write a function that **describes** what the screen should show. Ink draws it, and when something changes, Ink calls the function again and redraws only what changed.

```tsx
function Counter() {
  const [count, setCount] = useState(0);         // a remembered value
  useInput(() => setCount(count + 1));           // any key: increase it
  return <Text>You pressed {count} keys</Text>;  // what to show
}
```

The parts used in Tygig:

| Part | What it is | C comparison |
|---|---|---|
| **component** | a function that returns a description of part of the screen | a function that fills a screen buffer |
| **JSX** (`<Text>...</Text>`) | XML-like syntax inside TypeScript; `tsx` turns it into function calls | none; it is just a nicer way to write nested calls |
| **props** | the inputs of a component, written like attributes: `<Prompt label="›" />` | function arguments |
| **`useState`** | a value the component remembers between redraws. Changing it with its setter **redraws** the screen | a `static` variable, plus "please redraw" |
| **`useRef`** | a value remembered between redraws that does **not** redraw when changed | a `static` variable |
| **`useEffect`** | code to run after drawing, and optionally code to run when the component disappears | setup and cleanup hooks |
| **`useInput`** | Ink: call this function on every key press | a keyboard handler |
| **`<Static>`** | Ink: print these items once and never redraw them | writing to the log above a status line |

Why `<Static>` matters: while an answer streams, Ink redraws the bottom of the screen many times a second. Finished messages are put in `<Static>`, so they are printed once and left alone. A long conversation then stays fast and does not flicker.

### 10.5 Closures

A function written inside another function can use the outer function's variables, even later:

```ts
function makeCounter() {
  let n = 0;
  return () => ++n;      // this function "closes over" n
}
const next = makeCounter();
next(); next();          // 1, 2: n lives on inside `next`
```

Tygig uses this constantly: `onEvent` inside `ChatApp` uses `add`, `setStreaming` and `holder`; `end` inside the loop uses `started` and `total`.

*In C:* a function pointer plus a `void *context` pointing to a struct with the variables. JavaScript does the bookkeeping for you.

### 10.6 Small pieces of syntax

| Syntax | Meaning | Example in Tygig |
|---|---|---|
| `a ?? b` | `a`, unless it is `null` or `undefined`; then `b` | `options.stepLimit ?? 20` |
| `a?.b` | `a.b`, or `undefined` if `a` is `null`/`undefined` (no crash) | `chunk.choices?.[0]?.delta` |
| `x ??= v` | set `x` to `v` only if `x` is `null`/`undefined` | `agentRef.current ??= makeAgent()` |
| `x!` | "trust me, `x` is not `null` here": tells the type checker, changes nothing when running (a wrong `!` crashes later, like a bad pointer in C) | `agentRef.current!.run(...)`, `response.body!` |
| `A \| B` (a union type) | a value that is one of several shapes, told apart by a field such as `type` or `role`. Unlike a C `union`, the value knows which shape it is, and TypeScript checks every use | `Message`, `StreamEvent`, `AgentEvent` |
| `{ ...a, b: 1 }` | a copy of object `a`, with `b` set | `{ ...configRef.current, model: id }` |
| `` `text ${x}` `` | a string with `x` inserted | `` `Bearer ${key}` `` |
| `new Map()` | a key → value table (a hash table) | tool-call pieces by index |
| `switch (e.type)` on a union | TypeScript knows which fields exist in each `case` | every event handler |
| `Extract<T, U>` | the members of union `T` that match `U` | the `turn_end` event type in `ChatApp` |
| `structuredClone(x)` | a deep copy | the empty credentials |
| `import type` | import only a type; it disappears from the running program | everywhere |

### 10.7 Sign in with ChatGPT: OAuth, PKCE and ID tokens

Signing in through a browser without ever seeing the password uses a standard called **OAuth 2.0**, with an extra protection called **PKCE**. The idea in five steps:

1. **Tygig invents a secret** (the *verifier*) and keeps it. It sends out only a fingerprint of it (the *challenge*: a SHA-256 hash).
2. **Tygig opens your browser** at OpenAI's sign-in page, with the challenge, a random *state* and a random *nonce* in the address.
3. **You sign in at OpenAI.** OpenAI sends your browser back to a small server Tygig runs on `127.0.0.1`, with a one-time *code* and the same *state*.
4. **Tygig swaps the code for tokens**, and proves it is the same program that started, by sending the original *verifier*. OpenAI hashes it and compares with the challenge. Someone who intercepted the code cannot use it without the verifier.
5. **Tygig checks the ID token**: that OpenAI signed it, that it is meant for Tygig, that it has not expired, and that it carries the same *nonce*.

| Word | What it protects against |
|---|---|
| **state** | a forged answer sent to Tygig's local server by some other web page |
| **PKCE verifier/challenge** | a stolen code being swapped for tokens by someone else |
| **nonce** | an old ID token being replayed into a new sign-in |
| **host id** | identifies this computer to OpenAI (not a secret, kept forever) |

An **ID token** is a **JWT**: three parts in base64url, separated by dots: `header.payload.signature`. The payload says who signed in (`sub` is the account's id, `email`, `exp` the expiry time). The signature is made with OpenAI's private key. Tygig downloads OpenAI's **public** keys (published as a *JWKS*) and checks the signature with them: if anyone changed a single character of the payload, the check fails.

*In C terms:* the verifier is a random buffer from a secure random source; the challenge is `SHA256(verifier)`; the signature check is an RSA verify with a public key, as you would do with OpenSSL's `EVP_DigestVerify`.

### 10.8 JSON Lines and an ordered write queue

A session file is **JSON Lines**: one complete JSON object per line. A new event is **appended** as a new line; nothing is ever rewritten. If Tygig crashes, only the lines not yet written are lost (normally none: each line is written within milliseconds); the lines already in the file stay intact.

Writing to a file takes time, and events can arrive faster than they are written. To keep lines in order, `Session` chains every write onto the previous one:

```ts
this.queue = this.queue.then(() => appendFile(file, line));
```

Each write starts only after the one before it finished. *In C:* a single writer thread reading from a FIFO queue.

### 10.9 npm workspaces and tsx

The root `package.json` says `"workspaces": ["packages/*"]`. `npm install` then makes each package available to the others under its name: `node_modules/@tygig/core` is a link to `packages/core`. That is why the code can write `import ... from "@tygig/core"`.

Node.js runs JavaScript, not TypeScript. **tsx** translates TypeScript (and JSX) to JavaScript as each file is loaded, so no separate build step is needed. `npm start` runs `tsx packages/cli/src/main.tsx`; the `tygig` command runs `bin/tygig.js`, which switches tsx on and then loads `main.tsx`.

---

# Part 3. The traces

## 11. How the traces work

Each trace follows one real action through the code, in the order the computer executes it. When a line calls a function in another file, the trace goes into that file, line by line, and comes back. At the important moments, a box shows what is in memory and on disk.

The traces assume this situation, unless a trace says otherwise:

- You work in `C:\Arnab Work Files\my-project`.
- You are connected to **OpenRouter** (OpenAI chat format) with a key stored by `tygig login`, model `openai/gpt-6.1-sol`.
- You type: **What is a harness?**

Trace 1 starts Tygig. Trace 2 is the complete journey of one question. Traces 3 and 4 show only what is different with the other two formats. Traces 5 to 11 cover logging in, the ChatGPT sign-in, local models, Esc, errors, the commands, and leaving.

---

## 12. Trace 1: starting Tygig

**You type** `tygig` in PowerShell and press Enter. `npm link` created a small file `tygig.cmd` (and `tygig.ps1`) that runs `node` with the path to `packages/cli/bin/tygig.js`.

### 12.1 The command file

**[cli/bin/tygig.js:15]** `const major = Number(process.versions.node.split(".")[0]);`
`process.versions.node` is a string like `"22.23.4"`. `split(".")` cuts it into `["22", "23", "4"]`, `[0]` takes `"22"`, `Number(...)` turns it into the number 22.

**[cli/bin/tygig.js:16]** `if (major < 22) {`
On an old Node, Tygig prints a clear message and stops here, instead of failing later with a confusing error deep inside Ink.

**[cli/bin/tygig.js:21]** `register({ tsconfig: fileURLToPath(new URL("../../../tsconfig.json", import.meta.url)) });`
Switches on tsx, so that the `.ts` and `.tsx` files that follow can be loaded. `import.meta.url` is this file's own address; `new URL("../../../tsconfig.json", ...)` goes three folders up, to the repository's `tsconfig.json`. tsx needs that file to know how to translate the screen code (JSX). Without the `tsconfig` part, starting Tygig from your project folder would fail with *"React is not defined"*, because tsx would look for `tsconfig.json` in your project folder and not find it. (Without `register` at all, Node would refuse the `.tsx` file.)

**[cli/bin/tygig.js:22]** `await import("../src/main.tsx");`
Loads `main.tsx`. Loading it runs it: its last statement calls `main()`.

### 12.2 Reading the command

**[cli/main.tsx:180]** `main()`
The very last statement of `main.tsx`. It starts everything.

**[cli/main.tsx:25]** `const command = process.argv[2];`
`process.argv` is the command line as a list: `["C:\...\node.exe", "C:\...\tygig.js"]`. You typed no word after `tygig`, so element `[2]` does not exist and `command` is `undefined`. (For `tygig login`, it would be `"login"`.)

**[cli/main.tsx:26]** `const paths = getPaths();`
Goes into `paths.ts`:

**[cli/paths.ts:22]** `const home = process.env.TYGIG_HOME ?? path.join(os.homedir(), ".tygig");`
`os.homedir()` is `C:\Users\Arnab`. No `TYGIG_HOME` is set, so `home` is `C:\Users\Arnab\.tygig`. The function returns the three paths: the folder, `config.json` and `credentials.json`.

**[cli/main.tsx:29]** `case undefined:   await chat(paths); break;`
No command word: start a chat.

### 12.3 Settings and connection

**[cli/main.tsx:44]** `requireTerminal();`
Checks `process.stdin.isTTY`. The chat screen reads single key presses (arrows, Esc), which only works in a real terminal window.

**[cli/main.tsx:45]** `let config = await readConfig(paths.config);`
Goes into `config.ts`:

**[cli/config.ts:18]** `const json = JSON.parse(await readFile(file, "utf8"));`
Reads `config.json` and parses it: `{ "provider": "openrouter", "model": "openai/gpt-6.1-sol" }`.

**[cli/config.ts:19]** `if (typeof json.provider !== "string" || typeof json.model !== "string") return undefined;`
A file without these two fields counts as "no settings". A missing or damaged file throws, and the `catch` below it returns `undefined` too. On a first run that leads to `main.tsx` lines 46 to 50: the welcome message and the login wizard (Trace 5).

**[cli/main.tsx:56]** `connected = await connect(config, paths);`
Goes into `connect.ts`, where the blocks are joined:

**[cli/connect.ts:36]** `const preset = getPreset(settings.provider);`
Looks up `"openrouter"` in the provider list (`ai/presets.ts`) and gets its facts: format `openai-chat`, address `https://openrouter.ai/api/v1`, key variable `OPENROUTER_API_KEY`.

**[cli/connect.ts:41]** `const override = process.env.TYGIG_HOME ? process.env.TYGIG_BASE_URL : undefined;`
The test override. You set neither variable, so `override` is `undefined`.

**[cli/connect.ts:42]** `const baseUrl = (override ?? settings.baseUrl ?? preset.baseUrl).replace(/\/+$/, "");`
The first of the three that exists: the preset's address. `.replace(/\/+$/, "")` removes any `/` at the end, so that adding `/chat/completions` later never produces `//`.

**[cli/connect.ts:46]** `const creds = await readCredentials(paths.credentials);`
Reads `credentials.json`: `{ "apiKeys": { "openrouter": "sk-or-..." }, "chatgpt": {} }`.

**[cli/connect.ts:66]** `const stored = creds.apiKeys[keySlot(preset.id, baseUrl)];`
`keySlot("openrouter", ...)` is simply `"openrouter"` (only your own servers get a slot per address). `stored` is your key.

**[cli/connect.ts:68]** `const key = typed || (wantsEnv ? fromEnv : undefined) || stored || fromEnv;`
Nothing was typed (this is not a login) and no environment choice was made, so `key` is the stored key. `||` takes the first value that is not empty.

**[cli/connect.ts:72]** `const headers = apiKeyHeaders(preset.format, key, preset.id);`
In `ai/connection.ts`, the chat format puts the key in an `authorization: Bearer sk-or-...` header (**[ai/connection.ts:24]** `else headers["authorization"]`). For OpenRouter it also adds two optional headers naming Tygig as the app.

**[cli/connect.ts:73]** `authHeaders = async () => headers;`
A small function that returns those headers whenever a request is about to be sent. For an API key it always returns the same; for a ChatGPT sign-in (Trace 6) it can renew the token first. This is a closure (section 10.5): it remembers `headers`.

**[cli/connect.ts:79]** `const provider = createProvider({`
In `ai/index.ts`, `createProvider` looks at the format and calls the matching translator: **[ai/index.ts:17]** `case "openai-chat":      return createOpenAIChat(conn);`. The translator returns an object with `stream` and `listModels`. **Nothing has been sent over the network yet.**

### 12.4 The conversation file and the screen

**[cli/main.tsx:63]** `const projectDir = currentProjectFolder();`
In `paths.ts`, on Windows, **[cli/paths.ts:39]** `const real = realpathSync.native(cwd);` asks Windows for the folder's true spelling, so `c:\arnab work files\my-project` and `C:\Arnab Work Files\my-project` become the same.

**[cli/main.tsx:65]** `session: Session.create(projectSessionsDir(paths.home, projectDir),`
`projectSessionsDir` (in `agent/session.ts`) builds the folder name: **[agent/session.ts:25]** `const name = projectDir.replace(/[^a-zA-Z0-9]/g, "-");` turns every character that is not a letter or digit into `-`: `C--Arnab-Work-Files-my-project`, then lower-cased on Windows: `c--arnab-work-files-my-project`. Then `Session.create` chooses a file name from the date and time: **[agent/session.ts:52]** `return new Session(path.join(dir,`. The file is **not** created yet: it appears when the first line is written, so opening and closing Tygig leaves no empty files.

**[cli/main.tsx:70]** `const app = render(<ChatApp config={config} paths={paths} connected={connected}`
Ink's `render` calls the `ChatApp` component and draws what it returns. From here, Ink owns the terminal.

**[cli/ChatApp.tsx:54]** `const instructions = useMemo(() => buildInstructions(projectDir), [projectDir]);`
Builds the system instructions once (`instructions.ts`): who Tygig is, today's date, the operating system, the project folder, and that it has no tools yet. `useMemo` remembers the result, so it is not rebuilt at every redraw.

**[cli/ChatApp.tsx:64]** `agentRef.current ??= makeAgent();`
On the first draw, `agentRef.current` is `null`, so `makeAgent()` runs and calls `createAgent` in `agent/agent.ts`: **[agent/agent.ts:35]** `const history: Message[] = options.history ? [...options.history] : [];` creates an empty conversation; the step limit becomes 20 and the history limit 60. On later redraws `??=` does nothing: the same agent is kept.

**[cli/ChatApp.tsx:69]** `const [entries, setEntries] = useState<Entry[]>([{`
The list of things printed on screen starts with one entry: the header (provider, model, folder).

**[cli/ChatApp.tsx:228]** `<Transcript entries={entries} />`
In `ui/Transcript.tsx`, **[ui/Transcript.tsx:20]** `<Static items={entries}>` prints each entry once. The header entry draws: **[ui/Transcript.tsx:32]** `<Text bold color="magenta">tygig</Text>` followed by the provider and model, the folder, and the help line.

**[cli/ChatApp.tsx:235]** `{!busy && <Prompt label="›" value={input} onChange={setInput} onSubmit={submit}`
Not busy, so the input line is drawn: `› Ask anything, or type /help`.

**[cli/main.tsx:72]** `await app.waitUntilExit();`
`main.tsx` now waits here, for as long as the chat is open. Everything else happens inside `ChatApp`.

> **Now in memory:** `config` (provider, model), `connected.provider` (the OpenRouter translator, holding your key in its headers function), the `agent` with an empty `history`, a `Session` object pointing to a file that does not exist yet.
> **On disk:** nothing new.
> **On screen:** the header and the input line.

---

## 13. Trace 2: one question, from Enter to the answer

### 13.1 You type and press Enter

Each key you press goes to the input line. **[ui/Prompt.tsx:21]** `<TextInput value={value} onChange={(text) => onChange(text.replace(` passes the new text up to `ChatApp`'s `setInput` (replacing any line breaks from a paste with spaces). `setInput` changes the state, so Ink redraws the line with your new letter.

When you press Enter, `TextInput` calls `onSubmit`, which is `submit` in `ChatApp`:

**[cli/ChatApp.tsx:135]** `const text = value.trim();`
Removes spaces at both ends: `"What is a harness?"`.

**[cli/ChatApp.tsx:136]** `if (text === "" || busy) return;`
An empty line, or a message while the agent is still busy, is ignored.

**[cli/ChatApp.tsx:137]** `setInput("");`
Empties the input line.

**[cli/ChatApp.tsx:139]** `else void send(text);`
Not a command (it does not start with `/`), so it is a message for the agent. `void` means: start `send`, but `submit` does not wait for it to finish.

### 13.2 The chat screen hands the message to the agent

**[cli/ChatApp.tsx:120]** `setBusy(true);`
Ink redraws: the input line disappears and the spinner appears, because of **[cli/ChatApp.tsx:234]** `{busy && <Spinner label=`.

**[cli/ChatApp.tsx:121]** `const abort = new AbortController();`
A fresh cancel button for this message (section 10.3). **[cli/ChatApp.tsx:122]** `abortRef.current = abort;` puts it where the Esc handler can find it.

**[cli/ChatApp.tsx:124]** `holder.running = agentRef.current!.run(text, onEvent, abort.signal);`
Calls the agent's `run`, giving it your text, the function that receives its events (`onEvent`), and the cancel signal. `run` returns a promise (a value that will be ready later), kept in `holder` so that `main.tsx` can wait for it if you press Ctrl+C (Trace 11). On the next line, **[cli/ChatApp.tsx:125]** `await holder.running;`, `send` waits until the whole turn is over.

### 13.3 The agent loop begins

**[agent/agent.ts:45]** `const started = Date.now();`
The time now, in milliseconds, to measure how long the answer takes.

**[agent/agent.ts:46]** `const total: Usage = { inputTokens: 0, outputTokens: 0 };`
Token counters for this turn.

**[agent/agent.ts:47]** `const end = (reason: TurnEndReason) =>`
A small helper that announces the end of the turn with its reason, duration and tokens. It is defined here, used later.

**[agent/agent.ts:50]** `history.push({ role: "user", text });`
Your message joins the conversation. `history` now has **1** entry.

**[agent/agent.ts:51]** `onEvent({ type: "turn_start", text });`
The first announcement. It goes to `onEvent` in `ChatApp`:

**[cli/ChatApp.tsx:92]** `holder.session.record(event);`
First, the session log. In `agent/session.ts`:

**[agent/session.ts:75]** `this.write({ type: "user", text: event.text });`
A `turn_start` is stored as a `user` line. Into `write`:

**[agent/session.ts:105]** `if (!this.started) {`
This is the first line of a new conversation, so **[agent/session.ts:107]** `lines.push({ type: "session_start", ...this.meta });` puts a `session_start` line (provider, model, folder) before it.

**[agent/session.ts:110]** `const text = lines.map((l) => this.redact(JSON.stringify({ t: new Date().toISOString(), ...l })) + "\n").join("");`
Each line becomes JSON text with the current time `t`, any key or token in it replaced by `[redacted]`, and a line break at the end.

**[agent/session.ts:112]** `this.queue = this.queue`
The write is added to the queue (section 10.8): **[agent/session.ts:115]** `await appendFile(this.file, text, "utf8");` will run as soon as the previous write is done. The file and its folder are created by this first write. `record` returns at once; the disk work continues in the background.

Back in `onEvent`, the screen:

**[cli/ChatApp.tsx:95]** `add({ kind: "user", text: event.text });`
Adds an entry to the list; `<Static>` prints it once: `› What is a harness?` in cyan.

**[agent/agent.ts:54]** `onEvent({ type: "step_start", step });`
Step 1 begins. Neither the screen nor the log does anything with this event; it exists for the tools that will come later.

**[agent/agent.ts:55]** `const reply: AssistantMessage = { role: "assistant", text: "", toolCalls: [] };`
An empty answer, to be filled piece by piece.

**[agent/agent.ts:60]** `const stream = options.provider.stream({`
Calls the translator's `stream`, with the model, the instructions, the recent messages (**[agent/agent.ts:63]** `messages: recent(history, maxHistory),` gives the last 60, starting with one of yours; here simply your one message) and the cancel signal. **Important:** `stream` is an async generator (section 10.2). Calling it does **not** run it; it returns an object that will run when asked for its first value.

**[agent/agent.ts:67]** `for await (const piece of stream) {`
Asks for the first piece. Now the translator starts running.

### 13.4 The translator builds the request

In `ai/openai-chat.ts`:

**[ai/openai-chat.ts:17]** `const body: Record<string, unknown> = {`
The request in the chat format's shape.

**[ai/openai-chat.ts:19]** `messages: toChatMessages(request.instructions, request.messages),`
Converts Tygig's messages. In `toChatMessages`: **[ai/openai-chat.ts:90]** `const out: object[] = [{ role: "system", content: instructions }];` puts the instructions first, as a `system` message; **[ai/openai-chat.ts:93]** `out.push({ role: "user", content: m.text });` adds your message. The body is now:

```json
{
  "model": "openai/gpt-6.1-sol",
  "messages": [
    { "role": "system", "content": "You are Tygig, an assistant running in the user's terminal. ..." },
    { "role": "user", "content": "What is a harness?" }
  ],
  "stream": true
}
```

**[ai/openai-chat.ts:22]** `if (request.tools.length > 0) {`
No tools in the base harness: skipped.

**[ai/openai-chat.ts:30]** `const response = await postJson(conn,`
Sends it, to `https://openrouter.ai/api/v1/chat/completions`. Into `ai/http.ts`:

### 13.5 Sending, in http.ts

**[ai/http.ts:18]** `for (let attempt = 1; ; attempt++) {`
A loop with no end condition: it ends by `return` (success) or `throw` (failure). `attempt` counts tries.

**[ai/http.ts:20]** `const auth = await conn.authHeaders();`
`conn.authHeaders()` is the small function from `connect.ts`; it returns `authorization: Bearer sk-or-...` and the two OpenRouter headers. It is called before the `try` on purpose: if it fails (for example an expired ChatGPT sign-in), that error keeps its own message instead of being reported as a network problem.

**[ai/http.ts:23]** `response = await fetch(url, {`
The real HTTP request, with:

**[ai/http.ts:25]** `headers: { "content-type": "application/json", ...auth, ...extraHeaders },`
`...` copies the content type, the key headers and any extra headers into one headers object.

**[ai/http.ts:26]** `body: JSON.stringify(body),`
The body above, as text.

**[ai/http.ts:27]** `signal,`
The cancel signal from `ChatApp`. If you press Esc, `fetch` stops.

`fetch` returns as soon as the **headers** of the answer arrive: status 200. The body is still arriving; it will stream for several seconds.

**[ai/http.ts:33]** `if (response.ok) return response;`
`ok` is true for status 200 to 299. The open response goes back to the translator.

### 13.6 Reading the stream

Back in `openai-chat.ts`:

**[ai/openai-chat.ts:34]** `const calls = new Map<number, ToolCall>();`
Room for tool requests (none will come). **[ai/openai-chat.ts:36]** `let finish: string | undefined;` and **[ai/openai-chat.ts:37]** `let done = false;` will record how the answer ends.

**[ai/openai-chat.ts:39]** `for await (const message of readSse(response.body!)) {`
`response.body` is the incoming byte stream. `readSse` (in `ai/sse.ts`) is another async generator that turns bytes into messages:

**[ai/sse.ts:24]** `for await (const chunk of body) {`
Waits for the network to deliver some bytes. A chunk might be `data: {"choices":[{"delta":{"content":"A harn` (half a message), or two messages at once. The network decides.

**[ai/sse.ts:25]** `buffer += decoder.decode(chunk, { stream: true });`
Bytes to text, added to what is waiting. `{ stream: true }` handles a character whose bytes are split between two chunks (like `ö`, which is two bytes in UTF-8).

**[ai/sse.ts:29]** `while ((end = buffer.indexOf("\n\n")) !== -1) {`
Is there a complete message, ending with an empty line? If not, wait for more bytes. If yes:

**[ai/sse.ts:32]** `const message = parseBlock(block);`
`parseBlock` reads the lines of one block: **[ai/sse.ts:53]** `else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));` collects the text after `data:`. It returns `{ event: "", data: '{"choices":[{"delta":{"content":"A harness"}}]}' }`.

**[ai/sse.ts:33]** `if (message) yield message;`
Hands the message to the translator and pauses here until the translator asks for the next one.

Back in the translator, with this message:

**[ai/openai-chat.ts:40]** `if (message.data === "[DONE]") { done = true; break; }`
Not the end yet.

**[ai/openai-chat.ts:41]** `const chunk = parseJson(message.data);`
The JSON text becomes an object.

**[ai/openai-chat.ts:50]** `finish = chunk.choices?.[0]?.finish_reason ?? finish;`
No stop reason yet (it comes with the last chunk). `?.` avoids a crash if `choices` is missing.

**[ai/openai-chat.ts:51]** `const delta = chunk.choices?.[0]?.delta;`
The new part: `{ content: "A harness" }`.

**[ai/openai-chat.ts:55]** `yield { type: "text", text: delta.content };`
Hands a piece `{ type: "text", text: "A harness" }` up to the agent, and pauses.

### 13.7 The piece travels up to the screen

In `agent.ts`, the `for await` receives it:

**[agent/agent.ts:68]** `if (piece.type === "text") {`
A text piece.

**[agent/agent.ts:69]** `reply.text += piece.text;`
The answer so far: `"A harness"`.

**[agent/agent.ts:70]** `onEvent({ type: "text_delta", text: piece.text });`
Announced. In `ChatApp`, the session log ignores `text_delta` (it stores only complete answers), and the screen:

**[cli/ChatApp.tsx:98]** `setStreaming((text) => text + event.text);`
Adds the words to the streaming text. Ink redraws the bottom of the screen: **[cli/ChatApp.tsx:232]** `{streaming !== "" && <Text>{lastLines(streaming,` shows `A harness`, and the spinner's label switches from *thinking* to *writing*.

Then the agent's `for await` asks for the next piece, the translator's `for await` asks `readSse` for the next message, and `readSse` waits for more bytes. **This chain repeats for every few words**: network → `readSse` → translator → agent → `onEvent` → screen. Nothing waits for the whole answer.

### 13.8 The end of the stream

The last data chunk carries the stop reason, and often the token counts:

```text
data: {"choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":412,"completion_tokens":96}}

data: [DONE]
```

**[ai/openai-chat.ts:46]** `if (chunk.usage) {`
Token counts are present: **[ai/openai-chat.ts:47]** `usage = { inputTokens: chunk.usage.prompt_tokens ?? 0,` stores 412 in, 96 out. And `finish` becomes `"stop"`.

**[ai/openai-chat.ts:40]** `if (message.data === "[DONE]") { done = true; break; }`
The final message. `break` leaves the loop; this also closes `readSse` and releases the connection.

**[ai/openai-chat.ts:68]** `if (!done && !finish) {`
Both are set: the answer is complete. (If the connection had broken, neither would be, and the translator would throw *"the connection ended before the reply was complete"*.)

**[ai/openai-chat.ts:72]** `if (finish === "length" || finish === "content_filter") {`
The model stopped normally (`"stop"`), not because of a length limit or a filter.

**[ai/openai-chat.ts:77]** `yield { type: "done", usage };`
The last piece: done, with the token counts.

In `agent.ts`: **[agent/agent.ts:74]** `usage = piece.usage;`, then the translator's generator finishes, and the agent's `for await` ends.

### 13.9 The turn is finished

**[agent/agent.ts:94]** `history.push(reply);`
The complete answer joins the conversation. `history` now has **2** entries.

**[agent/agent.ts:95]** `onEvent({ type: "assistant_message", message: reply, usage });`
In `ChatApp`: the session log writes an `assistant` line with the full text and the token counts (**[agent/session.ts:78]** `this.write({ type: "assistant", text: event.message.text, toolCalls: event.message.toolCalls,`), and the screen:

**[cli/ChatApp.tsx:101]** `setStreaming("");`
The streaming area is emptied...

**[cli/ChatApp.tsx:102]** `if (event.message.text) add({ kind: "assistant", text: event.message.text });`
...and the full answer is added to the printed list, where `<Static>` prints it once. On screen it looks continuous: the streaming text is replaced by the same text, printed permanently.

**[agent/agent.ts:101]** `if (reply.toolCalls.length === 0) {`
The model asked for no tools, so the turn is complete: **[agent/agent.ts:102]** `end("done");`

That calls the helper from 13.3: a `turn_end` event with reason `done`, the seconds since `started`, and the totals. The log writes a `turn_end` line. The screen: **[cli/ChatApp.tsx:111]** `const summary = describeEnd(event);` builds `2.4 s · 412 in / 96 out tokens`, printed in grey.

**[agent/agent.ts:103]** `return;`
`run` is finished. Back in `ChatApp`'s `send`:

**[cli/ChatApp.tsx:127]** `abortRef.current = undefined;`
The cancel button is put away.

**[cli/ChatApp.tsx:129]** `setBusy(false);`
Ink redraws: the spinner disappears, the input line comes back. You can type the next question.

> **Now in memory:** `history` = [your question, the answer].
> **On disk,** `C:\Users\Arnab\.tygig\projects\c--arnab-work-files-my-project\2026-10-28_101502_k3f9.jsonl`:
> `session_start` · `user` · `assistant` · `turn_end` (4 lines).
> **On screen:** your question, the answer, the grey stats line, the input line.

**The next question** follows exactly the same path. The only difference is at 13.3: `history` already has two entries, so the request carries the whole conversation. That is how the model "remembers": it is sent everything each time (it remembers nothing between requests).

### 13.10 The timeline

| Time | Where | What happens |
|---|---|---|
| 0 ms | `ChatApp.submit` | Enter pressed; input emptied |
| 1 ms | `agent.run` | your message added to `history`; `user` line queued for disk; shown in cyan |
| 2 ms | `openai-chat.stream` | request body built |
| 3 ms | `http.postJson` | `fetch` sends the request |
| ~600 ms | `http.postJson` | status 200 arrives; the stream is open |
| ~650 ms | `readSse` → translator → agent → screen | first words appear |
| ~650 to 2400 ms | the same chain, many times | words keep arriving |
| ~2400 ms | translator | `[DONE]`; `done` piece |
| ~2401 ms | agent → screen | full answer printed, stats line, input line back |

---

## 14. Trace 3: the same question in the OpenAI Responses format

This is the format for **OpenAI with an API key** and for **Continue with ChatGPT**. Everything in Trace 2 is identical **except 13.4 to 13.8**, which happen in `ai/openai-responses.ts` instead:

**[ai/openai-responses.ts:20]** `instructions: request.instructions,`
The instructions go in their own field, not as a `system` message. (The ChatGPT plan even rejects `system` messages.)

**[ai/openai-responses.ts:21]** `input: toResponsesInput(request.messages),`
The conversation is called `input`. Your message becomes **[ai/openai-responses.ts:106]** `out.push({ role: "user", content: m.text });`.

**[ai/openai-responses.ts:23]** `store: false,`
Nothing is stored on OpenAI's side; the whole conversation is sent each time. The ChatGPT plan requires this, and it keeps your conversations off OpenAI's servers in both cases.

**[ai/openai-responses.ts:32]** `const response = await postJson(conn,`
To `https://api.openai.com/v1/responses`. Same `http.ts` as in 13.5.

The stream looks different: every message names its own type.

```text
event: response.output_text.delta
data: {"type":"response.output_text.delta","delta":"A harness"}

event: response.completed
data: {"type":"response.completed","response":{"usage":{"input_tokens":412,"output_tokens":96}}}
```

**[ai/openai-responses.ts:42]** `switch (event.type) {`
One case per kind of message:

**[ai/openai-responses.ts:44]** `if (event.delta) yield { type: "text", text: event.delta };`
For `response.output_text.delta`: a piece of text, handed up exactly as in 13.6.

**[ai/openai-responses.ts:56]** `completed = true;`
For `response.completed`: the only signal that means success. The token counts are read on the next line.

**[ai/openai-responses.ts:78]** `if (!completed) {`
After the stream ends: without `response.completed`, the answer counts as failed, as OpenAI's documentation requires.

From the `done` piece on, everything continues as in 13.9.

**With Continue with ChatGPT**, one more thing happens in 13.5. `conn.authHeaders()` is not a fixed set of headers; it is **[cli/connect.ts:55]** `authHeaders = async () => ({ authorization:`, which calls `getChatGPTAccessToken` each time. That function checks whether the access token is still fresh and renews it if not (section 17.7). The header then carries the token instead of a key.

---

## 15. Trace 4: the same question in the Anthropic format

For **Anthropic API keys**. Again, only 13.4 to 13.8 differ, in `ai/anthropic.ts`:

**[ai/anthropic.ts:21]** `max_tokens: conn.maxTokens,`
Anthropic requires an upper limit on the answer's length. It is 8192 unless you set `maxTokens` in `config.json`.

**[ai/anthropic.ts:22]** `system: request.instructions,`
The instructions in their own field.

**[ai/anthropic.ts:23]** `messages: toAnthropicMessages(request.messages),`
Anthropic has a rule: two messages in a row from the same side must be one message. **[ai/anthropic.ts:118]** `if (last && last.role === role) last.content.push(block);` merges them. Your message becomes **[ai/anthropic.ts:124]** `add("user", { type: "text", text: m.text });`.

**[ai/anthropic.ts:33]** `const response = await postJson(conn,`
To `https://api.anthropic.com/v1/messages`, with one extra header: **[ai/anthropic.ts:12]** `const version = { "anthropic-version": API_VERSION };`. The key travels differently too: **[ai/connection.ts:23]** `if (format === "anthropic") headers["x-api-key"] = key;` instead of `authorization: Bearer`.

The stream is made of numbered **content blocks**:

```text
event: message_start
data: {"type":"message_start","message":{"usage":{"input_tokens":412,"output_tokens":1}}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"A harness"}}

event: message_delta
data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":96}}

event: message_stop
data: {"type":"message_stop"}
```

**[ai/anthropic.ts:48]** `usage.inputTokens = event.message?.usage?.input_tokens ?? 0;`
From `message_start`: the input tokens are known at the very beginning.

**[ai/anthropic.ts:59]** `if (event.delta?.type === "text_delta" && event.delta.text) {`
A piece of text: **[ai/anthropic.ts:60]** `yield { type: "text", text: event.delta.text };`. The model's thinking, if any, arrives as `thinking_delta` and is not shown.

**[ai/anthropic.ts:78]** `stopReason = event.delta?.stop_reason ?? stopReason;`
From `message_delta`: why the model stopped (`end_turn` means normally) and the running output-token count.

**[ai/anthropic.ts:82]** `stopped = true;`
From `message_stop`: the end.

**[ai/anthropic.ts:94]** `if (stopReason === "max_tokens") {`
If the answer hit the length limit, it is reported as cut short, with the hint to raise `maxTokens`.

Then the `done` piece, and 13.9 continues unchanged.

---

## 16. Trace 5: logging in with an API key

You run `tygig login`. `main.tsx` calls `login`, which renders `LoginApp`. You choose **API key**, then **Anthropic**, then paste a key.

### 16.1 Moving through the lists

The first screen is a `Picker` (`ui/Picker.tsx`). Each key press goes to its `useInput`:

**[ui/Picker.tsx:38]** `if (key.upArrow) setIndex(Math.max(current - 1, 0));`
and the next line for the down arrow: moving the highlight. Ink redraws the list with `›` on the new row.

**[ui/Picker.tsx:40]** `else if (key.return) { const item = shown[current]; if (item) { setChosen(true); onSelect(item.value); } }`
Enter: remember that a choice was made (a second Enter, from key repeat, is then ignored), and report the choice. `LoginApp` receives `"api"` and moves to the provider list; you choose Anthropic:

**[cli/LoginApp.tsx:178]** `setStep(getPreset(id).baseUrl ? { name: "key", presetId: id, back } : { name: "address", presetId: id, back });`
Anthropic has a fixed address, so the next step is the key. (Your own server would first ask for its address.) `back` remembers where Esc should return to.

### 16.2 The key

The key screen shows where to get a key and an input line with `secret`, which shows `*` instead of each character. You paste and press Enter:

**[cli/LoginApp.tsx:233]** `const key = value.trim();`
The key, without spaces around it (a paste often adds one).

**[cli/LoginApp.tsx:234]** `if (!key && !envKey && preset.id !== "custom") {`
Nothing typed and no environment variable: the screen says *"A key is needed."* and waits.

**[cli/LoginApp.tsx:239]** `const draft: Draft = key ? { provider: preset.id, baseUrl: step.baseUrl, apiKey: key }`
A **draft**: settings that are not saved yet. Here `{ provider: "anthropic", apiKey: "sk-ant-..." }`.

**[cli/LoginApp.tsx:242]** `void check(draft, step);`
Test it.

### 16.3 Testing the key by listing the models

**[cli/LoginApp.tsx:88]** `setStep({ name: "checking", label:`
The screen shows a spinner: *Connecting to Anthropic*.

**[cli/LoginApp.tsx:90]** `const connected = await connect(draft, paths);`
The same `connect` as in Trace 1, but with a draft: at **[cli/connect.ts:68]** `const key = typed || (wantsEnv ? fromEnv : undefined) || stored || fromEnv;` the typed key comes first.

**[cli/LoginApp.tsx:94]** `models = await connected.provider.listModels();`
Asks Anthropic for its models. In `anthropic.ts`, `listModels` calls `getJson` in `http.ts`:

**[ai/http.ts:55]** `signal: AbortSignal.timeout(20_000),`
A server that never answers is given up after 20 seconds, so the screen cannot hang.

**[ai/http.ts:60]** `if (!response.ok) throw await toProviderError(response, conn.label);`
A wrong key gives status 401. `toProviderError` turns it into *"The key or sign-in was rejected"* with a hint, and `check`'s `catch` shows it (16.5).

**[ai/http.ts:61]** `const json = parseJson(await response.text());`
The answer as an object. If it is not JSON (for example an HTML page, because an address is wrong), the next lines give a hint about the address instead of a cryptic error.

Back in `LoginApp`, the key worked, so now it is saved:

**[cli/LoginApp.tsx:103]** `await updateCredentials(paths.credentials, (c) => { c.apiKeys[slot] = draft.apiKey!; });`
Into `auth/credentials.ts`:

**[auth/credentials.ts:62]** `return withLock(file, async () => {`
Everything inside runs while holding the lock, so a second Tygig window cannot change the file at the same moment.

**[auth/credentials.ts:81]** `const handle = await open(lock, "wx");`
The lock: create `credentials.json.lock`; `"wx"` means "fail if it already exists". If another window holds it, the code waits 50 ms and tries again.

**[auth/credentials.ts:63]** `const data = await readCredentials(file);`
Read the current file, **[auth/credentials.ts:64]** `change(data);` apply the change (add the key), then write:

**[auth/credentials.ts:106]** `const temp =`
A temporary file name next to the real one, unique to this process.

**[auth/credentials.ts:107]** `await writeFile(temp, text, { encoding: "utf8", mode });`
Write everything there first, readable only by you (mode `0600` on macOS and Linux).

**[auth/credentials.ts:110]** `await rename(temp, file);`
Then replace the real file in one step. A crash can never leave a half-written credentials file. If Windows reports the file as busy (antivirus, backup), the rename is retried a few times.

**[auth/credentials.ts:95]** `await rm(lock, { force: true });`
Release the lock, whatever happened.

### 16.4 Choosing the model and saving

**[cli/LoginApp.tsx:107]** `setStep({ name: "model", draft:`
The model list appears. You choose one; `onSelect` calls `saveModel`:

**[cli/LoginApp.tsx:116]** `const old = await readConfig(paths.config);`
Read the old settings, to keep anything you added by hand (`maxTokens`, `stepLimit`) if the provider stays the same.

**[cli/LoginApp.tsx:120]** `await writeConfig(paths.config, config);`
Save `{ "provider": "anthropic", "model": "..." }` to `config.json`, with the same safe write.

**[cli/LoginApp.tsx:121]** `result.saved = true;`
Tell `main.tsx` that a connection was saved.

**[cli/LoginApp.tsx:49]** `useEffect(() => { if (step.name === "done") exit(); }, [step, exit]);`
After the *✓ Connected* line is drawn, the wizard closes. `main.tsx`'s `waitUntilExit` returns.

### 16.5 If the key is wrong

`listModels` throws a `ProviderError` (status 401). In `check`: **[cli/LoginApp.tsx:109]** `fail(err, back);` shows the *failed* screen with the message and the hint. Nothing was saved. Esc returns to `back`: the key screen, so you can paste the right key.

---

## 17. Trace 6: Continue with ChatGPT

You run `tygig login` and choose **Continue with ChatGPT**. `LoginApp` calls `startChatGPT`:

**[cli/LoginApp.tsx:65]** `const abort = new AbortController();`
So that Esc can cancel the wait for the browser.

**[cli/LoginApp.tsx:69]** `const signIn = await signInWithChatGPT(paths.credentials, (url) => {`
Into `auth/chatgpt-oauth.ts`.

### 17.1 Preparing

**[auth/chatgpt-oauth.ts:41]** `let creds = await readCredentials(credentialsFile);`
What is stored so far.

**[auth/chatgpt-oauth.ts:42]** `const hostId = creds.chatgpt.hostId ??`
This computer's id. The first time, a new one is made with `randomUUID()`, e.g. `urn:uuid:5b0e7c2a-...`, and **[auth/chatgpt-oauth.ts:44]** `creds = await updateCredentials(credentialsFile, (c) => { c.chatgpt.hostId = hostId; });` saves it before anything else, as OpenAI asks.

**[auth/chatgpt-oauth.ts:49]** `const returning = Boolean(existing?.clientId);`
Has this computer signed in before? The first time: no.

**[auth/chatgpt-oauth.ts:52]** `const verifier = base64url(randomBytes(32));`
32 random bytes: the PKCE secret (section 10.7). It never leaves this computer until the very end.

**[auth/chatgpt-oauth.ts:53]** `const challenge = base64url(createHash("sha256").update(verifier).digest());`
Its SHA-256 fingerprint, which **is** sent out.

**[auth/chatgpt-oauth.ts:54]** `const state = base64url(randomBytes(16));`
and the next line, `nonce`: two more random values that tie the answer to this request.

### 17.2 The local server and the browser

**[auth/chatgpt-oauth.ts:58]** `const server = await startCallbackServer(state);`
Starts a tiny web server on your own computer, before the browser opens. Inside `startCallbackServer`: **[auth/chatgpt-oauth.ts:203]** `const server = createServer((req, res) => {` defines what to do when a request arrives (it does not run yet), and **[auth/chatgpt-oauth.ts:223]** `await listen(PREFERRED_PORT);` starts listening on `127.0.0.1:1455`; if that port is taken, a free one is used.

**[auth/chatgpt-oauth.ts:64]** `client_id: returning ? existing!.clientId : "dynamic_agent_client",`
The address's parameters. First time: `dynamic_agent_client`, which asks OpenAI to register Tygig for your account. The other parameters: the local server's address as `redirect_uri`, the scopes (**[auth/chatgpt-oauth.ts:67]** `scope: SCOPES,` includes `chatgpt.tokens.use.direct`, the permission to use your plan), the challenge, state, nonce, and **[auth/chatgpt-oauth.ts:73]** `ext_agent_host_id: hostId,`.

**[auth/chatgpt-oauth.ts:75]** `if (!returning) params.set("agent_name_hint", "Tygig");`
The name OpenAI shows you on the consent page, only on the first registration.

**[auth/chatgpt-oauth.ts:80]** `showUrl(url);`
Back in `LoginApp`, **[cli/LoginApp.tsx:70]** `// Printed once, above the wizard, so it can be copied in one piece.` the address is printed once, in case the browser does not open.

**[auth/chatgpt-oauth.ts:81]** `openBrowser(url);`
In `auth/browser.ts`, on Windows: **[auth/browser.ts:11]** `process.platform === "win32" ? ["rundll32", ["url.dll,FileProtocolHandler", url]] :` asks Windows to open the address in your default browser. **[auth/browser.ts:18]** `child.unref();` means Tygig does not wait for the browser.

**[auth/chatgpt-oauth.ts:84]** `const callback = await server.waitForCallback(signal);`
Tygig waits. The screen shows the spinner *Waiting for you to sign in to ChatGPT in your browser…*.

### 17.3 In the browser, and back

You sign in at OpenAI and allow Tygig to use your plan. OpenAI sends your browser to:

```text
http://127.0.0.1:1455/auth/callback?code=ac_8f...&state=Yq3...&client_id=client_...
```

Your browser requests that address from Tygig's local server, and the handler runs:

**[auth/chatgpt-oauth.ts:205]** `if (url.pathname !== CALLBACK_PATH || url.searchParams.get("state") !== expectedState) {`
Wrong path, or a different `state`: refused (another web page or program knocking on the port), and the wait continues. Here the state matches.

**[auth/chatgpt-oauth.ts:212]** `res.end(ok ? page(`
The browser shows *"You are signed in. You can close this window and return to the terminal."*

**[auth/chatgpt-oauth.ts:214]** `deliver(url.searchParams);`
Hands the parameters to the waiting `waitForCallback`, which resolves. Back in `signInWithChatGPT`:

**[auth/chatgpt-oauth.ts:89]** `const code = callback.get("code");`
The one-time code.

**[auth/chatgpt-oauth.ts:95]** `const clientId = returning ? existing!.clientId : returnedClientId;`
The client id OpenAI just issued to Tygig for your account.

### 17.4 Code for tokens

**[auth/chatgpt-oauth.ts:99]** `const tokens = await postForm(TOKEN_ENDPOINT, {`
A POST to `https://auth.openai.com/api/accounts/oauth/token`, with the code, the client id, the same `redirect_uri`, and **the verifier**. OpenAI hashes the verifier and compares it with the challenge it received in 17.2: only the program that started the sign-in can finish it. In `postForm`: **[auth/chatgpt-oauth.ts:169]** `body: new URLSearchParams(fields),` sends the fields as a form, and **[auth/chatgpt-oauth.ts:170]** `signal: AbortSignal.timeout(15_000),` gives up after 15 seconds. The answer contains `access_token`, `refresh_token`, `id_token`, `expires_in` (3600) and `scope`.

### 17.5 Checking the ID token

**[auth/chatgpt-oauth.ts:109]** `const discovery = await discover();`
Fetches OpenAI's published configuration: the issuer name and the address of its public keys.

**[auth/chatgpt-oauth.ts:110]** `const claims = await verifyIdToken(tokens.id_token, {`
Into `auth/jwt.ts`:

**[auth/jwt.ts:24]** `const parts = token.split(".");`
The three parts: header, payload, signature.

**[auth/jwt.ts:28]** `const header = JSON.parse(Buffer.from(headerB64, "base64url").toString("utf8"));`
Decode the header: `{ "alg": "RS256", "kid": "..." }`: the signing method and which key was used.

**[auth/jwt.ts:32]** `const response = await fetch(checks.jwksUri,`
Download OpenAI's public keys, and **[auth/jwt.ts:35]** `const jwk = keys.find((k) => k.kid === header.kid)` pick the one named in the header.

**[auth/jwt.ts:42]** `if (header.alg === "RS256") valid = verify("RSA-SHA256", data, key, signature);`
The signature check. If anyone had changed one character of the payload, this is `false`.

**[auth/jwt.ts:50]** `if (claims.iss !== checks.issuer)`
and the following lines: issued by OpenAI; **[auth/jwt.ts:51]** `if (!audiences.includes(checks.audience))` meant for Tygig's client id; not expired; and **[auth/jwt.ts:53]** `if (claims.nonce !== checks.nonce)` carrying our nonce.

**[auth/jwt.ts:56]** `return claims;`
The verified contents: `sub` (your account's id), `email`, `iss`.

### 17.6 Saving

**[auth/chatgpt-oauth.ts:120]** `const planUsage = scopes.includes("chatgpt.tokens.use.direct");`
Did you allow plan usage? If not, `LoginApp` tells you and stops.

**[auth/chatgpt-oauth.ts:123]** `const account: ChatGPTAccount = {`
Everything OpenAI asks apps to store, together, including `savedAt: Date.now()` to know when the access token expires.

**[auth/chatgpt-oauth.ts:138]** `await updateCredentials(credentialsFile, (c) => { c.chatgpt.account = account; });`
Saved under the lock, with the safe write (16.3).

**[auth/chatgpt-oauth.ts:142]** `server.close();`
In `finally`: the local server stops, whatever happened.

Back in `LoginApp`: **[cli/LoginApp.tsx:77]** `setStep({ name: "welcome" });` shows *"You're using your ChatGPT plan"* (only the first time). **Got it** marks it as shown and runs `check({ provider: "chatgpt" })`, exactly like 16.3, except that `connect` takes the ChatGPT branch and `listModels` reads the ChatGPT model list: **[ai/openai-responses.ts:89]** `return json.models.filter((m: any) => m.visibility === "list").map((m: any) => String(m.slug));`. You choose a model; it is saved.

### 17.7 An hour later: the token is renewed

Before every request, `authHeaders` calls `getChatGPTAccessToken` (in `auth/chatgpt-session.ts`):

**[auth/chatgpt-session.ts:30]** `if (Date.now() < account.savedAt + account.expiresIn * 1000 - REFRESH_MARGIN_MS) {`
Still more than two minutes left? Then use the saved token. After an hour, no:

**[auth/chatgpt-session.ts:33]** `return refreshChatGPTToken(credentialsFile, false);`

**[auth/chatgpt-session.ts:41]** `return withLock(credentialsFile, async () => {`
Under the lock. If two Tygig windows need a new token at the same moment, the second waits here.

**[auth/chatgpt-session.ts:43]** `const creds = await readCredentials(credentialsFile);`
Read again, under the lock. When the second window gets the lock, this read finds the first window's new token...

**[auth/chatgpt-session.ts:50]** `if (fresh && !force) return account.accessToken;`
...and simply uses it. Only one refresh happens. This matters because each refresh token works only once: using an old one would end the sign-in.

**[auth/chatgpt-session.ts:55]** `grant_type: "refresh_token",`
The refresh request, to the same token endpoint, with the refresh token.

**[auth/chatgpt-session.ts:76]** `account.refreshToken = tokens.refresh_token ?? account.refreshToken;`
The new refresh token replaces the old one, saved together with the new access token and its time.

**If OpenAI rejects a token early** (status 401, for example after a password change), `postJson` gives the sign-in one chance: **[ai/http.ts:35]** `if (response.status === 401 && conn.onUnauthorized && !renewed) {` calls the function from `connect.ts`, which forces a refresh (**[cli/connect.ts:58]** `try { await refreshChatGPTToken(paths.credentials, true); return true; } catch { return false; }`), and **[ai/http.ts:38]** `if (await conn.onUnauthorized()) continue;` repeats the request with the new token.

**If the refresh token itself is no longer valid** (30 days unused, revoked): the refresh request fails with a code such as `refresh_token_expired`. The tokens are cleared and you are told: *"your sign-in has expired. Sign in again: tygig login"*.

---

## 18. Trace 7: a local model, and when it is not running

You choose **Local model** → **Ollama**:

**[cli/LoginApp.tsx:192]** `if (getPreset(id).baseUrl) void check({ provider: id }, back);`
Ollama has a fixed address (`http://127.0.0.1:11434/v1`), so the connection is tested at once, as in 16.3. In `connect`, Ollama needs no key: `key` stays `undefined`, and `apiKeyHeaders` returns no `authorization` header.

**If Ollama is running**, `GET /v1/models` lists the models you have downloaded, e.g. `llama3.2:latest`, and you choose one. Chatting then follows Trace 2 exactly: Ollama speaks the chat format.

**If it is not running**, nothing listens on port 11434. `fetch` does not get an HTTP answer at all; it throws.

**[ai/http.ts:58]** `throw networkError(err, url);`
In `getJson`, the failure goes to `networkError`:

**[ai/http.ts:142]** `const cause: any = (err as any)?.cause;`
`fetch` only says *"fetch failed"*; the real reason is in `err.cause`. Here its `code` is `ECONNREFUSED` (connection refused: nobody is listening).

**[ai/http.ts:147]** `if (code === "ECONNREFUSED")`
That code gets its own hint: *Nothing is answering at 127.0.0.1:11434. For a local model: is Ollama or LM Studio running?* Other codes get other hints: `ENOTFOUND` (address does not exist), certificate or TLS problems (a network in between), timeouts.

Back in `check`, the error is shown on the *failed* screen; Esc returns to the list of local programs.

---

## 19. Trace 8: pressing Esc

An answer is streaming (Trace 2, 13.7). You press Esc. Ink calls `ChatApp`'s key handler:

**[cli/ChatApp.tsx:85]** `if (screen.name === "chat" && busy) abortRef.current?.abort();`
The chat screen is showing and the agent is busy: press the cancel button made in 13.2.

What happens next travels **up** the chain from the bottom:

1. `fetch`'s stream is aborted. In `readSse`, the waiting `for await (const chunk of body)` throws an `AbortError`.
2. `readSse` catches it, sees that it is an `AbortError` (your own cancel, not a network fault) and throws it on unchanged (section 20.4). The translator's `for await` does not catch it, so it reaches the agent's `for await`.
3. The agent catches it:

**[agent/agent.ts:79]** `if (reply.text !== "") {`
Some words had already arrived. They are kept: pushed to `history` and announced as an `assistant_message`, so they are printed and saved. What you saw is what the model will remember.

**[agent/agent.ts:84]** `if (signal?.aborted) {`
The signal says *you* cancelled: this is not an error. **[agent/agent.ts:85]** `end("interrupted");` and the screen shows `interrupted after 3.1 s` (**[cli/ChatApp.tsx:271]** `case "interrupted": return`).

If you press Esc while `http.ts` is **waiting to retry** after a rate limit, the wait ends at once: **[ai/http.ts:80]** `signal?.addEventListener("abort", () => {` cancels the timer and rejects.

---

## 20. Trace 9: when something goes wrong

### 20.1 A rate limit (429), retried

The provider answers status 429. In `postJson`, `response.ok` is false:

**[ai/http.ts:41]** `const error = await toProviderError(response, conn.label);`
In `toProviderError`, **[ai/http.ts:89]** `const text = await response.text().catch(() => "");` reads the error body, and **[ai/http.ts:95]** `const code: string | undefined = json.error?.code ?? json.error?.type ?? json.code ?? undefined;` takes the error code from whichever shape this provider uses. Then `describeError`:

**[ai/http.ts:126]** `if (status === 429) return say("Rate limit reached. Waiting and trying again.", true);`
`true` marks it as retryable.

**[ai/http.ts:42]** `if (!error.retryable || attempt >= MAX_ATTEMPTS) throw error;`
Retryable and only the first attempt: no throw.

**[ai/http.ts:43]** `await sleep(retryDelay(response, attempt), signal);`
Wait. `retryDelay` uses the server's `Retry-After` header if it sent one, at most 30 seconds (**[ai/http.ts:71]** `const header = Number(response.headers.get("retry-after"));`), otherwise 1 second after the first attempt and 2 seconds after the second (**[ai/http.ts:73]** `return 1000 * 2 ** (attempt - 1);`). Then the loop sends the request again. `MAX_ATTEMPTS` is 3, so after the third failed attempt (two retries) the error is thrown.

The same happens for server errors (500 to 599) and Anthropic's *overloaded* (529).

### 20.2 A wrong key (401), not retried

**[ai/http.ts:122]** `if (status === 401) return say("The key or sign-in was rejected. Connect again: tygig login");`
Not retryable: trying again cannot fix a wrong key. The error is thrown out of `postJson`, out of the translator, and caught by the agent:

**[agent/agent.ts:88]** `const { message, hint } = explain(err);`
In `explain`, **[agent/agent.ts:139]** `if (err instanceof ProviderError) return { message: err.message, hint: err.hint };` takes the plain-language message and hint.

**[agent/agent.ts:89]** `onEvent({ type: "error", message, hint });`
The log writes an `error` line. The screen: **[cli/ChatApp.tsx:108]** `add({ kind: "error", message: event.message, hint: event.hint });` and the transcript draws **[ui/Transcript.tsx:54]** `<Text color="red">✗ {entry.message}</Text>` with the hint below in grey.

**[agent/agent.ts:90]** `end("error");`
The turn ends; `describeEnd` returns nothing for `error`, so no stats line (the error is already on screen).

### 20.3 The ChatGPT plan's limit, in the middle of an answer

With the Responses format, a failure can arrive after the stream has started:

**[ai/openai-responses.ts:61]** `case "response.failed": {`
The event carries `error.code = "subscription_sharing_usage_limit_exceeded"`. `describeError` recognises it: **[ai/http.ts:107]** `case "subscription_sharing_usage_limit_exceeded":` gives the hint *Manage usage: ChatGPT > Settings > Usage*. The words that had already arrived are kept, as with Esc.

### 20.4 The connection breaks

There are two ways an answer can stop half-way.

**The server closes the stream early**, cleanly but without `[DONE]` or a stop reason. `readSse` simply ends, and the translator notices: **[ai/openai-chat.ts:68]** `if (!done && !finish) {` throws *"the connection ended before the reply was complete"*.

**The network itself breaks** (Wi-Fi drops, a proxy cuts the line). Then reading the body fails, and Node reports only the word *"terminated"*. `readSse` catches that: **[ai/sse.ts:37]** `if ((err as Error)?.name === "AbortError") throw err;` lets your own Esc pass through unchanged, and anything else becomes *"The connection was interrupted before the reply was complete"* with the hint to ask again.

In both cases the part already shown is kept, and the error is shown under it.

---

## 21. Trace 10: the commands

### 21.1 /model

You type `/model` and press Enter. In `submit`, the text starts with `/`:

**[cli/ChatApp.tsx:138]** `if (text.startsWith("/")) void safely(() => command(text));`
`safely` runs the command and, if anything throws, shows the error instead of crashing Tygig.

**[cli/ChatApp.tsx:153]** `const name = line.split(/\s+/)[0];`
The first word: `/model`.

**[cli/ChatApp.tsx:160]** `const ticket = ++loadingRef.current;`
A number for this request. If you press Esc while it loads, the number changes, and a late answer is ignored.

**[cli/ChatApp.tsx:163]** `const models = await connected.provider.listModels();`
The model list, from the provider (as in 16.3).

**[cli/ChatApp.tsx:164]** `if (ticket === loadingRef.current) setScreen({ name: "models", models });`
Not cancelled: show the list. Ink draws a `Picker` instead of the input line.

In the `Picker`, typing filters the list: **[ui/Picker.tsx:43]** `else if (filterable && input && !key.ctrl && !key.meta && !key.tab) { setQuery(query + input); setIndex(0); }` adds the letter to the filter, and **[ui/Picker.tsx:30]** `const shown = items.filter(` keeps the matching models. Unless what you typed is exactly a listed model id, it is also offered as `Use "..."`, so you can choose a model that is not in the list. Enter chooses, and `ChatApp` runs `chooseModel`:

**[cli/ChatApp.tsx:205]** `agentRef.current!.model = id;`
The agent uses the new model from the next message on. The conversation is kept.

**[cli/ChatApp.tsx:207]** `await writeConfig(paths.config, configRef.current);`
Saved for next time.

**[cli/ChatApp.tsx:208]** `holder.session.note({ type: "model_change", model: id });`
The log records the change, so `tygig sessions` and `/resume` can show which model a conversation used. (A resumed conversation continues with the model selected now, not the one in the file.)

### 21.2 /resume

**[cli/ChatApp.tsx:174]** `const sessions = (await listSessions(sessionsDir)).filter((s) => s.file !== holder.session.file);`
In `agent/session.ts`, `listSessions` reads this project's folder: **[agent/session.ts:130]** `names = (await readdir(dir)).filter((n) => n.endsWith(".jsonl"));`, reads each file, counts your messages and takes the first one as a title (**[agent/session.ts:144]** `if (e.type === "user") { turns++;`), and sorts newest first. The current conversation is left out.

You choose one. `chooseSession`:

**[cli/ChatApp.tsx:216]** `const opened = await Session.open(file, connected.secrets);`
In `Session.open`, each line of the file is read back: **[agent/session.ts:64]** `else if (e.type === "user") history.push({ role: "user", text: e.text });` and the same for `assistant` lines. The result is the conversation, rebuilt, and a `Session` that will append to the same file.

**[cli/ChatApp.tsx:218]** `agentRef.current = makeAgent(opened.history);`
A new agent, starting with that history. Your next message continues the old conversation, and the model sees all of it.

**[cli/ChatApp.tsx:222]** `add({ kind: "info", text: "Resumed the conversation below. Continue typing." }, ...shown);`
The old messages are printed again, so you can see where you were.

### 21.3 /new

**[cli/ChatApp.tsx:182]** `holder.session = Session.create(sessionsDir,`
A new conversation file (created on the first message), and **[cli/ChatApp.tsx:185]** `agentRef.current = makeAgent();` a new agent with an empty history. The old conversation stays saved.

---

## 22. Trace 11: leaving, and logging out

### Ctrl+C or /quit

Ink stops the chat screen (Ctrl+C), or `/quit` calls `exit()`. As the screen closes:

**[cli/ChatApp.tsx:88]** `useEffect(() => () => abortRef.current?.abort(), []);`
The function returned by this effect runs when the component disappears: any request still running is cancelled, so Tygig does not hang waiting for it.

**[cli/main.tsx:73]** `await holder.running?.catch(() => {});`
If an answer was streaming, the agent now goes through Trace 8: it keeps the part already shown and announces the end of the turn. This line waits for that, so those last lines reach the queue before the flush. (`?.` skips it if no message was ever sent.)

**[cli/main.tsx:74]** `await holder.session.flush();`
Waits until the last line of the conversation is on disk: **[agent/session.ts:100]** `return this.queue;` is the end of the write queue.

**[cli/main.tsx:76]** `if (holder.next !== "login") return;`
Not `/login`, so `chat` returns, and `main`'s last line, **[cli/main.tsx:185]** `.finally(() => process.exit());`, ends the program without waiting for idle network connections to time out.

### tygig logout

**[cli/main.tsx:31]** `case "logout":    await logout(paths, process.argv.includes("--all")); break;`
`--all` anywhere on the line means: remove everything.

For a ChatGPT connection, **[cli/main.tsx:125]** `const revoked = await signOutChatGPT(paths.credentials);` goes to `auth/chatgpt-session.ts`, which finds OpenAI's revocation address through `discover()` and sends the refresh token to it with **[auth/chatgpt-session.ts:103]** `token_type_hint: "refresh_token",`. OpenAI invalidates it. Then **[auth/chatgpt-session.ts:116]** `else a.accessToken = a.refreshToken = a.idToken = "";` empties the tokens locally. The host id and client id stay, as OpenAI asks, so the next sign-in with the same account is recognised. With `--all`, the account record is deleted instead, so a different ChatGPT account can sign in.

For an API key, the key is deleted from `credentials.json`. In both cases, **[cli/main.tsx:138]** `await rm(paths.config, { force: true });` deletes `config.json`, so the next `tygig` opens the login.

---

# Part 4. Reference

## 23. Troubleshooting

| What you see | Why | What to do |
|---|---|---|
| `Tygig needs Node.js 22 or newer` | your Node is too old | install the current LTS from nodejs.org, open a new terminal |
| `running scripts is disabled on this system` | PowerShell blocks `tygig.ps1` | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, or type `tygig.cmd` |
| `tygig` is "not recognised" | `npm link` was not run, or the terminal was open before it | run step 7 of section 3; open a new terminal |
| `Tygig needs an interactive terminal` | it was started with its input redirected, or inside a tool that is not a terminal | run it directly in PowerShell, Windows Terminal or VS Code |
| `The key or sign-in was rejected. Connect again: tygig login` | HTTP 401: wrong key, revoked key, or the ChatGPT sign-in was disconnected | `tygig login` |
| `Your account has no credit left` | OpenAI `insufficient_quota` | add credit on the provider's website |
| `Rate limit reached. Waiting and trying again.` then an error | HTTP 429 three times in a row | wait a minute; check your plan's limits |
| `Your ChatGPT plan's limit for Tygig is reached` | `subscription_sharing_usage_limit_exceeded` | ChatGPT → Settings → Usage: raise Tygig's weekly limit, or wait |
| `Your ChatGPT plan cannot be used in Tygig` | `subscription_sharing_user_not_eligible` (plan or workspace policy) | use an API key instead |
| `you did not allow Tygig to use your plan` | consent for plan usage was not given | `tygig login`, and allow it this time |
| `your sign-in has expired` | the refresh token is no longer valid (30 days unused, or revoked) | `tygig login` |
| `Model or address not found` | HTTP 404: the model name or the address is wrong | `/model`, or check the custom address |
| `Nothing is answering at 127.0.0.1:11434` | Ollama (or LM Studio, port 1234) is not running | start it; for LM Studio, start its local server |
| `The secure connection to ... failed` | a network, proxy or firewall interferes with HTTPS | try another network (you met this on your home network before) |
| `The address ... could not be found` | no internet, or a typing error in a custom address | check the connection and the address |
| `the connection ended before the reply was complete` | the server closed the stream without its "finished" signal | ask again |
| `the reply was cut short (length)`, `(max_tokens)` or `(max_output_tokens)` | the answer hit the length limit | ask for a shorter answer; for Anthropic you can raise `maxTokens` in `config.json` |
| `the reply was cut short (content_filter)` | the provider's safety filter stopped the answer | rephrase the question |
| `No API key for Anthropic. Run: tygig login` (or another provider) | the key was removed, or the environment variable it came from is no longer set | `tygig login`, or set the variable again |
| `credentials.json is damaged` | the file was edited by hand and is no longer valid JSON | rename or delete it, then `tygig login` |
| `credentials.json.lock is held by another Tygig window` | a lock left over after a crash (it is removed automatically after 30 seconds) | close other Tygig windows; if none is open, delete the `.lock` file |
| `You signed in with a different ChatGPT account` | this computer is registered for another ChatGPT account | `tygig logout --all`, then `tygig login` |
| a 400 error mentioning `max_tokens` (Anthropic) | the model accepts a smaller answer limit than 8192 | set `"maxTokens": 4096` (or less) in `config.json` |
| `The provider rejected the request` (400) | the provider refused something; its own message is shown above the hint. Two cases you may meet: some providers (Gemini, for example) answer a wrong key with 400 instead of 401; OpenAI may refuse to stream some models until your organisation is verified | read the provider's message; check the key; for OpenAI, see Settings > Organisation > Verification |
| `The connection was interrupted before the reply was complete` | the network dropped in the middle of an answer | ask again; the part already shown is kept |
| the browser does not open during sign-in | no default browser, or it was blocked | copy the address shown in the terminal into a browser |
| `Sign-in timed out after five minutes` | the browser step was not finished | `tygig login` again |
| strange characters instead of `›`, `·` or the spinner | an old console window without these characters | use Windows Terminal or the VS Code terminal |

**Seeing exactly what happened.** Every conversation is saved in `~/.tygig/projects/<folder>/`. Open the newest `.jsonl` file: each line is one event, with the time. Errors are saved too.

**Testing without any provider.** `npm test` runs everything against the fake provider in `test/mock-server.ts`.

**Pointing Tygig at another address.** For your own server, choose **Other (OpenAI-compatible)** under *API key*, or **Other local server** under *Local model*, and type its address. The environment variable `TYGIG_BASE_URL` also overrides the address, but only when `TYGIG_HOME` is set as well: it exists for the tests, which use a separate home folder, so a variable left over in your environment can never send your real key to the wrong address.

**Starting clean.** `tygig logout --all` removes every stored key and sign-in, including the ChatGPT registration. Deleting the whole `~/.tygig` folder does the same and also removes your saved conversations.

## 24. The data files

### `config.json`

```json
{
  "provider": "openai",
  "model": "gpt-6.1-sol"
}
```

| Field | Meaning |
|---|---|
| `provider` | which entry of the provider list (`chatgpt`, `openai`, `anthropic`, `openrouter`, `gemini`, `deepseek`, `mistral`, `groq`, `xai`, `together`, `custom`, `ollama`, `lmstudio`, `local-custom`) |
| `model` | the model name |
| `baseUrl` | only for `custom` and `local-custom`: the address you typed |
| `maxTokens` | optional, Anthropic only: the longest answer allowed, in tokens (Anthropic requires a limit). Default 8192. The other formats send no limit, so this has no effect there |
| `stepLimit` | optional: the safety limit of model calls per message. Default 20 |

You may edit this file by hand. A damaged file simply makes Tygig ask you to log in again.

### `credentials.json`

```json
{
  "apiKeys": {
    "anthropic": "sk-ant-..."
  },
  "chatgpt": {
    "hostId": "urn:uuid:5b0e7c2a-...",
    "account": {
      "email": "you@example.com",
      "issuer": "https://auth.openai.com",
      "subject": "user-...",
      "clientId": "client-...",
      "idToken": "eyJ...",
      "accessToken": "eyJ...",
      "refreshToken": "...",
      "tokenType": "Bearer",
      "expiresIn": 3600,
      "scopes": ["openid", "profile", "email", "offline_access", "resource.invoke", "chatgpt.tokens.use.direct"],
      "savedAt": 1793520000000,
      "planUsage": true,
      "welcomed": true
    }
  }
}
```

Never share this file. On macOS and Linux only you can read it (permission 600). On Windows it is protected by your user folder's permissions, as Claude Code's equivalent file is. After `tygig logout`, the tokens are emptied, but `hostId` and `clientId` stay: OpenAI asks apps to keep them for the next sign-in. `tygig logout --all` deletes the account record too (only `hostId` stays), so a different ChatGPT account can sign in.

A key for your own server is stored under its address, for example `"custom:http://192.168.1.20:8000/v1"`, so two servers can each keep their own key.

While Tygig changes this file, a second file `credentials.json.lock` exists for a moment. It stops two Tygig windows from writing at the same time.

### A conversation file (`.jsonl`)

```jsonl
{"t":"2026-10-28T09:15:02.114Z","type":"session_start","provider":"openai","model":"gpt-6.1-sol","cwd":"C:\\Arnab Work Files\\my-project"}
{"t":"2026-10-28T09:15:02.115Z","type":"user","text":"What is a harness?"}
{"t":"2026-10-28T09:15:04.530Z","type":"assistant","text":"A harness is ...","toolCalls":[],"usage":{"inputTokens":412,"outputTokens":96}}
{"t":"2026-10-28T09:15:04.531Z","type":"turn_end","reason":"done","seconds":2.4,"usage":{"inputTokens":412,"outputTokens":96}}
{"t":"2026-10-28T09:16:10.002Z","type":"model_change","model":"gpt-6.1-mini"}
```

The streaming pieces are not saved, only complete answers, so a file stays small and readable. `/resume` rebuilds the conversation from the `user` and `assistant` lines.

## 25. Decisions taken in this build

These follow the design document. Where this build had to choose something the design did not settle, the choice is listed here.

| Decision | Where it comes from |
|---|---|
| One internal message format; three translators | design D6, D7 (and D7's open question settled: the Responses translator exists, because Sign in with ChatGPT requires it) |
| OpenAI with an API key uses the Responses format, like ChatGPT sign-in | OpenAI's newer format; the same translator serves both |
| Keys in `~/.tygig/credentials.json`, never in a project; removed from logs | design D8 |
| Only official login methods: ChatGPT sign-in yes, Claude account no | our discussion of 27 October; Anthropic's terms |
| Sign in with ChatGPT follows OpenAI's open-source app documentation: PKCE, state, nonce, ID token check, host id, rotating refresh, revocation on sign-out, "Continue with ChatGPT" wording, first-time notice shown once | OpenAI's Sign in with ChatGPT documentation |
| `id_token_hint` is not sent when signing in again | optional in OpenAI's docs; leaving it out keeps the ID token off the screen (the address is shown in case the browser does not open). `login_hint` is sent instead |
| The loop is a reusable function, ready for tools and sub-agents | design D3, D5 |
| Step limit 20 per message | design D4 |
| The loop emits events; the screen and the session log are two readers | design D32 |
| Conversations in the home folder, one JSON Lines file each, written as events happen | design D28, D29 |
| A conversation file is created only when the first message is sent | avoids empty files each time Tygig is opened and closed |
| Only the newest 60 messages are sent to the model | simple trimming; compaction (design D26) comes later |
| A failed request leaves your message in the conversation | so that what you see and what is saved stay the same; if you ask again, the model sees the question twice, which does no harm |
| Interrupting keeps the part of the answer already shown | what you saw is what the model remembers |
| Rate limits and server errors are tried up to 3 times (2 retries, waiting 1 s and then 2 s, or what the server asks in `Retry-After`, at most 30 s); other errors are not retried | the providers' own advice for 429 and 5xx; Anthropic's 529 means "overloaded" |
| The terminal is built with Ink | design D31 |
| While an answer streams, only its last lines are shown; the full answer is printed when complete | Ink redraws the streaming area on every word; taller than the window, it would flicker |
| The model list is the connection test: a key is saved only after it works (except for servers that cannot list models) | a wrong key is caught at login, not at the first question |
| A key from an environment variable is used but not copied to disk | your environment stays the single place for that key |
| A failed or cut-off answer keeps the part already shown, as with Esc; Ctrl+C waits for that part to be saved | the same rule everywhere: what you saw is what is saved and remembered |
| A chat-format answer counts as complete only with `[DONE]` or a stop reason; a network drop mid-stream gets a plain message instead of Node's "terminated" | a dropped connection is reported, not mistaken for a short answer |
| A sign-in problem (expired ChatGPT sign-in) is reported as such, never as a network problem | the token is fetched before the request, outside the network error handling |
| `stream_options` is not sent to chat-format providers | several providers reject it; the cost is that some (OpenAI-compatible servers, Ollama) send no token counts, so the stats line shows only the time |
| Keys for custom servers are stored per address | switching between two servers never sends one server's key to the other |
| `TYGIG_BASE_URL` works only together with `TYGIG_HOME` | a forgotten variable cannot redirect your real key |
| Every change to `credentials.json` happens under a lock, written to a temporary file and then renamed | two windows cannot lose each other's changes, and a crash cannot leave half a file; on Windows the rename is retried if antivirus holds the file |
| The ChatGPT token is renewed under the same lock, and once more on a 401 | refresh tokens work only once; two windows must not both use the same one |
| `tygig logout --all` forgets everything, including the ChatGPT registration | the only way to switch to another ChatGPT account, as OpenAI's documentation requires the same account for a registration |
| No telemetry; nothing is sent anywhere except to the provider you chose | design §27, question 7 |

## 26. What comes next

In the order the design document suggests (§26), now that the base exists:

1. A small evaluation set (`evals/`), so every later change can be measured.
2. Plugin loading, with the `files` plugin and its checks: Tygig becomes a coding agent.
3. Permissions: the approval dialog, rules, folder trust.
4. Skills, loaded from the standard `SKILL.md` folders.
5. MCP connections.
6. The first program plugin (website or Jupyter).

Each will come with its own trace, in the same format as this guide.

---

# Appendix. The complete source code

Every file, with line numbers, in the order of the table in section 8. The trace references (`agent/agent.ts:50`) point here.

## core/message.ts

*conversation entries: user, assistant, tool result; token usage*

```ts:lines
// message.ts - the conversation format used everywhere inside Tygig.
//
// Every provider (OpenAI, Anthropic, ...) has its own format. Tygig keeps ONE
// format internally; the translators in the `ai` package convert it on the way
// out and back. The loop, the session log and the screen only ever see this one.

/** One request from the model to use a tool. (The base harness has no tools yet.) */
export interface ToolCall {
  id: string;        // the provider's id for this call; echoed back with the result
  name: string;      // which tool, e.g. "files__read_file"
  arguments: string; // the inputs as JSON text, exactly as the model wrote them
}

/** Something you typed. */
export interface UserMessage {
  role: "user";
  text: string;
}

/** Something the model said: text, tool requests, or both. */
export interface AssistantMessage {
  role: "assistant";
  text: string;            // may be "" when the model only requests tools
  toolCalls: ToolCall[];   // empty when the model only talks
}

/** The result of running one tool, sent back to the model. */
export interface ToolResultMessage {
  role: "tool";
  toolCallId: string;      // matches ToolCall.id
  text: string;            // the result, as text
}

/** One entry in the conversation. */
export type Message = UserMessage | AssistantMessage | ToolResultMessage;

/** Token counts reported by the provider for one model call. */
export interface Usage {
  inputTokens: number;
  outputTokens: number;
}
```

## core/provider.ts

*the shape of a model provider; the request; stream pieces; ProviderError*

```ts:lines
// provider.ts - the shape of a model provider (design document §9, D6).
//
// A provider is anything that can take a conversation and stream back a reply.
// The loop only knows this shape. Which company is behind it does not matter.

import type { Message, ToolCall, Usage } from "./message.js";

/** The three request formats Tygig can speak (design document D7). */
export type ApiFormat = "openai-chat" | "openai-responses" | "anthropic";

/** A tool description sent to the model. Unused in the base harness. */
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: object;   // JSON Schema of the tool's inputs
}

/** Everything needed for one call to the model. */
export interface ModelRequest {
  model: string;               // e.g. "gpt-6.1-sol", "claude-sonnet-5"
  instructions: string;        // the system instructions
  messages: Message[];         // the conversation so far
  tools: ToolDefinition[];     // empty in the base harness
  signal?: AbortSignal;        // lets the user interrupt (Esc)
}

/** One piece of a streamed reply. */
export type StreamEvent =
  | { type: "text"; text: string }              // a few more words of the answer
  | { type: "tool_call"; call: ToolCall }       // a complete tool request
  | { type: "done"; usage?: Usage };            // the reply is complete

/** A model provider: OpenAI, Anthropic, OpenRouter, a local server... */
export interface ModelProvider {
  /** Short label for the screen, e.g. "OpenAI" or "ChatGPT plan". */
  label: string;
  /** Send a request; receive the reply piece by piece. */
  stream(request: ModelRequest): AsyncIterable<StreamEvent>;
  /** List the models this connection may use. */
  listModels(): Promise<string[]>;
}

/**
 * An error from a provider, already translated into plain words.
 * `hint` tells the user what to do about it.
 */
export class ProviderError extends Error {
  readonly status: number | undefined;   // HTTP status, if there was one
  readonly code: string | undefined;     // the provider's error code, if any
  readonly hint: string;                 // what the user can do about it
  readonly retryable: boolean;           // worth trying again automatically?

  constructor(message: string, status: number | undefined, code: string | undefined,
              hint: string, retryable: boolean) {
    super(message);
    this.name = "ProviderError";
    this.status = status;
    this.code = code;
    this.hint = hint;
    this.retryable = retryable;
  }
}
```

## core/events.ts

*what the agent announces while it works*

```ts:lines
// events.ts - what the agent announces while it works (design document D32).
//
// The agent never prints anything. It emits these events. The screen draws them,
// and the session log stores them. One stream, several readers.

import type { AssistantMessage, Usage } from "./message.js";

export type AgentEvent =
  | { type: "turn_start"; text: string }                 // you sent a message
  | { type: "step_start"; step: number }                 // a model call begins
  | { type: "text_delta"; text: string }                 // more words arrived
  | { type: "assistant_message"; message: AssistantMessage; usage?: Usage }  // one reply complete
  | { type: "tool_result"; toolCallId: string; name: string; text: string }  // a tool finished
  | { type: "error"; message: string; hint: string }     // something went wrong
  | { type: "turn_end"; reason: TurnEndReason; seconds: number; usage: Usage };

/** Why a turn ended. */
export type TurnEndReason = "done" | "interrupted" | "step_limit" | "error";
```

## core/index.ts

*what other packages may import from core*

```ts:lines
// index.ts - everything other packages may import from @tygig/core.

export type { ToolCall, UserMessage, AssistantMessage, ToolResultMessage, Message, Usage } from "./message.js";
export type { ApiFormat, ToolDefinition, ModelRequest, StreamEvent, ModelProvider } from "./provider.js";
export { ProviderError } from "./provider.js";
export type { AgentEvent, TurnEndReason } from "./events.js";
```

## ai/presets.ts

*every provider Tygig knows: format, address, key variable*

```ts:lines
// presets.ts - every provider Tygig knows how to reach, and how.
//
// A preset is just facts: which format the provider speaks, its address,
// and where its key comes from. Adding a provider usually means adding one entry.

import type { ApiFormat } from "@tygig/core";

/** How the user connects: a ChatGPT account, an API key, or a model on this computer. */
export type ConnectionKind = "chatgpt" | "api" | "local";

export interface ProviderPreset {
  id: string;           // stored in config.json, e.g. "openai"
  label: string;        // shown on screen
  kind: ConnectionKind;
  format: ApiFormat;    // which translator to use
  baseUrl: string;      // "" means: ask the user (custom providers)
  keyEnv?: string;      // environment variable that may already hold the key
  keyUrl?: string;      // where the user gets a key
  needsKey: boolean;    // local servers usually need none
}

export const PRESETS: ProviderPreset[] = [
  // ChatGPT account: browser sign-in, uses the ChatGPT plan. Only the Responses format works.
  { id: "chatgpt", label: "ChatGPT plan", kind: "chatgpt", format: "openai-responses",
    baseUrl: "https://api.openai.com/v1", needsKey: false },

  // API keys
  { id: "openai", label: "OpenAI", kind: "api", format: "openai-responses",
    baseUrl: "https://api.openai.com/v1", keyEnv: "OPENAI_API_KEY",
    keyUrl: "https://platform.openai.com/api-keys", needsKey: true },
  { id: "anthropic", label: "Anthropic", kind: "api", format: "anthropic",
    baseUrl: "https://api.anthropic.com/v1", keyEnv: "ANTHROPIC_API_KEY",
    keyUrl: "https://console.anthropic.com/settings/keys", needsKey: true },
  { id: "openrouter", label: "OpenRouter", kind: "api", format: "openai-chat",
    baseUrl: "https://openrouter.ai/api/v1", keyEnv: "OPENROUTER_API_KEY",
    keyUrl: "https://openrouter.ai/keys", needsKey: true },
  { id: "gemini", label: "Google Gemini", kind: "api", format: "openai-chat",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", keyEnv: "GEMINI_API_KEY",
    keyUrl: "https://aistudio.google.com/apikey", needsKey: true },
  { id: "deepseek", label: "DeepSeek", kind: "api", format: "openai-chat",
    baseUrl: "https://api.deepseek.com", keyEnv: "DEEPSEEK_API_KEY",
    keyUrl: "https://platform.deepseek.com/api_keys", needsKey: true },
  { id: "mistral", label: "Mistral", kind: "api", format: "openai-chat",
    baseUrl: "https://api.mistral.ai/v1", keyEnv: "MISTRAL_API_KEY",
    keyUrl: "https://console.mistral.ai/api-keys", needsKey: true },
  { id: "groq", label: "Groq", kind: "api", format: "openai-chat",
    baseUrl: "https://api.groq.com/openai/v1", keyEnv: "GROQ_API_KEY",
    keyUrl: "https://console.groq.com/keys", needsKey: true },
  { id: "xai", label: "xAI", kind: "api", format: "openai-chat",
    baseUrl: "https://api.x.ai/v1", keyEnv: "XAI_API_KEY",
    keyUrl: "https://console.x.ai", needsKey: true },
  { id: "together", label: "Together AI", kind: "api", format: "openai-chat",
    baseUrl: "https://api.together.xyz/v1", keyEnv: "TOGETHER_API_KEY",
    keyUrl: "https://api.together.xyz/settings/api-keys", needsKey: true },
  { id: "custom", label: "Other (OpenAI-compatible)", kind: "api", format: "openai-chat",
    baseUrl: "", needsKey: true },

  // Models on this computer. 127.0.0.1, not "localhost": on some systems "localhost"
  // means the IPv6 address ::1, where these servers are not listening.
  { id: "ollama", label: "Ollama", kind: "local", format: "openai-chat",
    baseUrl: "http://127.0.0.1:11434/v1", needsKey: false },
  { id: "lmstudio", label: "LM Studio", kind: "local", format: "openai-chat",
    baseUrl: "http://127.0.0.1:1234/v1", needsKey: false },
  { id: "local-custom", label: "Other local server", kind: "local", format: "openai-chat",
    baseUrl: "", needsKey: false },
];

/** Find a preset by id. Throws if the id is unknown (a damaged config file). */
export function getPreset(id: string): ProviderPreset {
  const preset = PRESETS.find((p) => p.id === id);
  if (!preset) throw new Error(`Unknown provider "${id}" in your settings. Run: tygig login`);
  return preset;
}
```

## ai/connection.ts

*what a translator needs; where each format expects the key*

```ts:lines
// connection.ts - what a translator needs to know to reach one provider.

import type { ApiFormat } from "@tygig/core";

export interface Connection {
  label: string;          // shown on screen, e.g. "OpenAI" or "ChatGPT plan"
  format: ApiFormat;      // which translator
  baseUrl: string;        // e.g. "https://api.openai.com/v1" (no trailing slash)
  /** Headers that prove who we are. Called before every request, so a sign-in
   *  token can be refreshed in time; for API keys it returns the same headers. */
  authHeaders: () => Promise<Record<string, string>>;
  maxTokens: number;      // upper limit on reply length (sent only to Anthropic, which requires it)
  /** Called once when the provider answers 401 (rejected). A sign-in can renew its
   *  token here and return true, and the request is tried again. */
  onUnauthorized?: () => Promise<boolean>;
}

/** The headers for an API key: each format expects the key in a different place. */
export function apiKeyHeaders(format: ApiFormat, key: string | undefined,
                              presetId: string): Record<string, string> {
  const headers: Record<string, string> = {};
  if (key) {
    if (format === "anthropic") headers["x-api-key"] = key;
    else headers["authorization"] = `Bearer ${key}`;
  }
  if (presetId === "openrouter") {
    // Optional: lets OpenRouter show which app made the request.
    headers["http-referer"] = "https://tygig.dev";
    headers["x-title"] = "Tygig";
  }
  return headers;
}
```

## ai/sse.ts

*reads a Server-Sent Events stream into messages*

```ts:lines
// sse.ts - reads a Server-Sent Events stream.
//
// All three formats stream replies the same way: the HTTP response stays open and
// the server writes small text blocks, separated by a blank line:
//
//   event: content_block_delta          <- optional: the kind of message
//   data: {"type":"...","delta":{...}}  <- the content (usually JSON)
//                                       <- blank line = end of this message
//
// This file turns the raw bytes into one { event, data } object per block.

import { ProviderError } from "@tygig/core";

export interface SseMessage {
  event: string;   // "" when the server sent no "event:" line
  data: string;    // the data text, not yet parsed
}

export async function* readSse(body: ReadableStream<Uint8Array>): AsyncGenerator<SseMessage> {
  const decoder = new TextDecoder();     // bytes -> text, handling characters split across chunks
  let buffer = "";                       // text received but not yet processed

  try {
    for await (const chunk of body) {    // each chunk is whatever the network delivered
      buffer += decoder.decode(chunk, { stream: true });
      buffer = buffer.replace(/\r\n/g, "\n");        // some servers end lines with \r\n

      let end: number;
      while ((end = buffer.indexOf("\n\n")) !== -1) {  // a complete block is available
        const block = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const message = parseBlock(block);
        if (message) yield message;                  // hand it to the translator
      }
    }
  } catch (err) {
    if ((err as Error)?.name === "AbortError") throw err;          // you pressed Esc: not an error
    // The network dropped in the middle of the reply (Node reports only "terminated").
    throw new ProviderError("The connection was interrupted before the reply was complete.", undefined, undefined,
      "Ask again. If it keeps happening, check your network connection.", false);
  }

  const last = parseBlock(buffer);       // a final block without a trailing blank line
  if (last) yield last;
}

function parseBlock(block: string): SseMessage | undefined {
  let event = "";
  const data: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith(":")) continue;                        // a comment (keep-alive)
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
  }
  if (data.length === 0) return undefined;                     // nothing to deliver
  return { event, data: data.join("\n") };
}

/** Parse JSON without throwing. Returns undefined for text that is not valid JSON. */
export function parseJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
```

## ai/http.ts

*sends requests, retries, turns failures into plain-language errors*

```ts:lines
// http.ts - sending requests, retrying when it makes sense, and turning failures
// into plain-language errors with a hint (design document D18: say how to fix it).

import { ProviderError } from "@tygig/core";
import type { Connection } from "./connection.js";
import { parseJson } from "./sse.js";

const MAX_ATTEMPTS = 3;   // first try + 2 retries

/**
 * POST a JSON body and return the open response, ready to be read as a stream.
 * Retries rate limits (429) and server errors (5xx, 529); fails fast on everything else.
 * On a 401, a sign-in may renew its token once (conn.onUnauthorized) before giving up.
 */
export async function postJson(conn: Connection, url: string, body: object,
                               signal?: AbortSignal, extraHeaders: Record<string, string> = {}): Promise<Response> {
  let renewed = false;
  for (let attempt = 1; ; attempt++) {
    // Outside the try: a sign-in problem here is not a network problem, so it keeps its own message.
    const auth = await conn.authHeaders();
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", ...auth, ...extraHeaders },
        body: JSON.stringify(body),
        signal,
      });
    } catch (err) {
      throw networkError(err, url);                 // never reached the server
    }

    if (response.ok) return response;               // 200-299: the stream can begin

    if (response.status === 401 && conn.onUnauthorized && !renewed) {
      renewed = true;                               // only once
      await response.body?.cancel();
      if (await conn.onUnauthorized()) continue;    // new token: try again
    }

    const error = await toProviderError(response, conn.label);
    if (!error.retryable || attempt >= MAX_ATTEMPTS) throw error;
    await sleep(retryDelay(response, attempt), signal);   // wait, then loop again
  }
}

/** GET a JSON document (used for model lists). Gives up after 20 seconds. */
export async function getJson(conn: Connection, url: string,
                              extraHeaders: Record<string, string> = {}): Promise<any> {
  const auth = await conn.authHeaders();          // outside the try, as in postJson
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { ...auth, ...extraHeaders },
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    throw networkError(err, url);
  }
  if (!response.ok) throw await toProviderError(response, conn.label);
  const json = parseJson(await response.text());
  if (json === undefined) {
    throw new ProviderError(`${conn.label}: the server did not answer with JSON.`, response.status, undefined,
      "Check the address. It usually ends in /v1 (the part before /models and /chat/completions).", false);
  }
  return json;
}

/** How long to wait before the next attempt: the server's Retry-After (at most 30 s), or 1 s, then 2 s. */
function retryDelay(response: Response, attempt: number): number {
  const header = Number(response.headers.get("retry-after"));
  if (Number.isFinite(header) && header > 0) return Math.min(header, 30) * 1000;
  return 1000 * 2 ** (attempt - 1);
}

/** Wait, but stop at once if the user presses Esc. */
function sleep(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(signal.reason);
    }, { once: true });
  });
}

/** Turn an HTTP error response into a ProviderError with a useful hint. */
export async function toProviderError(response: Response, label: string): Promise<ProviderError> {
  const text = await response.text().catch(() => "");
  const json = parseJson(text) ?? {};
  // The providers use different shapes; take whichever is present.
  const found = json.error?.message ?? json.detail ?? json.message ??
                (typeof json.error === "string" ? json.error : "");
  const message = typeof found === "string" ? found : JSON.stringify(found);
  const code: string | undefined = json.error?.code ?? json.error?.type ?? json.code ?? undefined;
  return describeError(response.status, code, message || response.statusText, label);
}

/** Errors that arrive inside a stream (after a 200) use the same descriptions. */
export function describeError(status: number | undefined, code: string | undefined,
                              message: string, label: string): ProviderError {
  const say = (hint: string, retryable = false) =>
    new ProviderError(`${label}: ${message}`, status, code, hint, retryable);

  // ChatGPT plan codes (Sign in with ChatGPT documentation, "Errors and recovery").
  switch (code) {
    case "subscription_sharing_usage_limit_exceeded":
      return say("Your ChatGPT plan's limit for Tygig is reached. Manage usage: ChatGPT > Settings > Usage.");
    case "subscription_sharing_user_not_eligible":
      return say("Your ChatGPT plan cannot be used in Tygig. Connect with an API key instead: tygig login");
    case "subscription_sharing_usage_unavailable":
    case "subscription_sharing_user_unavailable":
      return say("ChatGPT could not check your usage just now. Try again in a minute.", true);
    case "subscription_sharing_unsupported_capability":
      return say("This request uses something the ChatGPT plan does not support. Try another model with /model.");
    case "insufficient_quota":
      return say("Your account has no credit left. Add billing on the provider's website.");
    case "overloaded_error":
      return say("The service is overloaded. Try again in a moment.", true);
  }

  if (status === 401) return say("The key or sign-in was rejected. Connect again: tygig login");
  if (status === 403) return say("Access denied. Your account may not have access to this model or region.");
  if (status === 404) return say("Model or address not found. Pick another model with /model, or check the address.");
  if (status === 408 || status === 409) return say("The request timed out. Trying again.", true);
  if (status === 429) return say("Rate limit reached. Waiting and trying again.", true);
  if (status !== undefined && status >= 500) return say("The provider is having problems. Try again in a moment.", true);
  if (status === 400 && /max_tokens/i.test(message))
    return say("The reply length limit is too high for this model. Lower \"maxTokens\" in ~/.tygig/config.json, e.g. to 4096.");
  if (status === 400) return say("The provider rejected the request. The message above says why.");
  return say("Unexpected error. The message above may say more.");
}

/** fetch() itself failed: the request never got an HTTP answer. */
export function networkError(err: unknown, url: string): unknown {
  if (err instanceof Error && err.name === "AbortError") return err;   // the user pressed Esc
  const host = new URL(url).host;
  if (err instanceof Error && err.name === "TimeoutError") {
    return new ProviderError(`Could not reach ${host}: no answer within 20 seconds.`, undefined, "timeout",
      `${host} is not answering. Check the address and that the server is running.`, false);
  }
  const cause: any = (err as any)?.cause;
  const code: string = cause?.code ?? "";
  const detail: string = cause?.message ?? (err as Error)?.message ?? String(err);

  let hint = `Check your internet connection and the address (${host}).`;
  if (code === "ECONNREFUSED")
    hint = `Nothing is answering at ${host}. For a local model: is Ollama or LM Studio running?`;
  else if (code === "ENOTFOUND" || code === "EAI_AGAIN")
    hint = `The address ${host} could not be found. Check your internet connection and the spelling.`;
  else if (/CERT|SSL|TLS/i.test(code + detail))
    hint = `The secure connection to ${host} failed. A network, proxy or firewall may be blocking it. Try another network.`;
  else if (/TIMEOUT/i.test(code))
    hint = `${host} took too long to answer. Try again.`;

  return new ProviderError(`Could not reach ${host}: ${detail}`, undefined, code || undefined, hint, false);
}
```

## ai/openai-chat.ts

*translator: OpenAI chat format*

```ts:lines
// openai-chat.ts - translator for the OpenAI chat format ("chat completions").
// Spoken by OpenRouter, Gemini, DeepSeek, Mistral, Groq, xAI, Together,
// Ollama, LM Studio and most other providers.

import { ProviderError } from "@tygig/core";
import type { Message, ModelProvider, ModelRequest, StreamEvent, ToolCall, Usage } from "@tygig/core";
import type { Connection } from "./connection.js";
import { describeError, getJson, postJson } from "./http.js";
import { parseJson, readSse } from "./sse.js";

export function createOpenAIChat(conn: Connection): ModelProvider {
  return {
    label: conn.label,

    async *stream(request: ModelRequest): AsyncGenerator<StreamEvent> {
      // 1. Build the request in this provider's format.
      const body: Record<string, unknown> = {
        model: request.model,
        messages: toChatMessages(request.instructions, request.messages),
        stream: true,
      };
      if (request.tools.length > 0) {
        body.tools = request.tools.map((t) => ({
          type: "function",
          function: { name: t.name, description: t.description, parameters: t.inputSchema },
        }));
      }

      // 2. Send it. postJson retries rate limits and server errors.
      const response = await postJson(conn, `${conn.baseUrl}/chat/completions`, body, request.signal);

      // 3. Read the stream. Text is passed on at once; tool calls arrive in pieces
      //    and are assembled here, then passed on complete at the end.
      const calls = new Map<number, ToolCall>();
      let usage: Usage | undefined;
      let finish: string | undefined;                      // why the model stopped
      let done = false;                                    // did the server say [DONE]?

      for await (const message of readSse(response.body!)) {
        if (message.data === "[DONE]") { done = true; break; }   // the server says: finished
        const chunk = parseJson(message.data);
        if (!chunk) continue;                              // ignore anything unreadable
        if (chunk.error) {
          throw describeError(undefined, chunk.error.code, chunk.error.message ?? "error", conn.label);
        }
        if (chunk.usage) {
          usage = { inputTokens: chunk.usage.prompt_tokens ?? 0,
                    outputTokens: chunk.usage.completion_tokens ?? 0 };
        }
        finish = chunk.choices?.[0]?.finish_reason ?? finish;
        const delta = chunk.choices?.[0]?.delta;
        if (!delta) continue;

        if (typeof delta.content === "string" && delta.content.length > 0) {
          yield { type: "text", text: delta.content };     // straight to the screen
        }
        for (const piece of delta.tool_calls ?? []) {      // one piece of a tool call
          const call = calls.get(piece.index) ?? { id: "", name: "", arguments: "" };
          if (piece.id) call.id = piece.id;
          if (piece.function?.name) call.name += piece.function.name;
          if (piece.function?.arguments) call.arguments += piece.function.arguments;
          calls.set(piece.index, call);
        }
      }

      // A complete answer ends with [DONE] or a stop reason. Without either, the
      // connection broke; "length" and "content_filter" mean the answer is unfinished.
      if (!done && !finish) {
        throw new ProviderError(`${conn.label}: the connection ended before the reply was complete.`,
          undefined, undefined, "Try again.", false);
      }
      if (finish === "length" || finish === "content_filter") {
        throw new ProviderError(`${conn.label}: the reply was cut short (${finish}).`, undefined, finish,
          finish === "length" ? "Ask for a shorter answer." : "The provider's content filter stopped the answer.", false);
      }
      for (const call of calls.values()) yield { type: "tool_call", call };
      yield { type: "done", usage };
    },

    async listModels(): Promise<string[]> {
      const json = await getJson(conn, `${conn.baseUrl}/models`);
      const list: any[] = Array.isArray(json) ? json : (json.data ?? []);   // Together AI sends a bare list
      return list.map((m) => String(m.id)).sort();
    },
  };
}

/** Tygig's messages -> the chat format's messages. */
function toChatMessages(instructions: string, messages: Message[]): object[] {
  const out: object[] = [{ role: "system", content: instructions }];
  for (const m of messages) {
    if (m.role === "user") {
      out.push({ role: "user", content: m.text });
    } else if (m.role === "assistant") {
      if (m.text === "" && m.toolCalls.length === 0) continue;   // nothing was said (interrupted)
      out.push({
        role: "assistant",
        content: m.text === "" ? null : m.text,
        ...(m.toolCalls.length > 0 && {
          tool_calls: m.toolCalls.map((c) => ({
            id: c.id, type: "function", function: { name: c.name, arguments: c.arguments },
          })),
        }),
      });
    } else {
      out.push({ role: "tool", tool_call_id: m.toolCallId, content: m.text });
    }
  }
  return out;
}
```

## ai/openai-responses.ts

*translator: OpenAI Responses format (API key and ChatGPT plan)*

```ts:lines
// openai-responses.ts - translator for OpenAI's Responses format.
// Used for OpenAI with an API key, and for "Sign in with ChatGPT", which only
// accepts this format (with store: false and stream: true on every request).

import { ProviderError } from "@tygig/core";
import type { Message, ModelProvider, ModelRequest, StreamEvent, Usage } from "@tygig/core";
import type { Connection } from "./connection.js";
import { describeError, getJson, postJson } from "./http.js";
import { parseJson, readSse } from "./sse.js";

export function createOpenAIResponses(conn: Connection): ModelProvider {
  return {
    label: conn.label,

    async *stream(request: ModelRequest): AsyncGenerator<StreamEvent> {
      // 1. Build the request. The whole conversation is sent every time ("input"),
      //    and nothing is stored on OpenAI's side ("store: false").
      const body: Record<string, unknown> = {
        model: request.model,
        instructions: request.instructions,
        input: toResponsesInput(request.messages),
        stream: true,
        store: false,
      };
      if (request.tools.length > 0) {
        body.tools = request.tools.map((t) => ({
          type: "function", name: t.name, description: t.description, parameters: t.inputSchema,
        }));
      }

      // 2. Send it.
      const response = await postJson(conn, `${conn.baseUrl}/responses`, body, request.signal);

      // 3. Read the events. Only "response.completed" means success.
      let usage: Usage | undefined;
      let completed = false;

      for await (const message of readSse(response.body!)) {
        const event = parseJson(message.data);
        if (!event) continue;

        switch (event.type) {
          case "response.output_text.delta":               // a few more words
            if (event.delta) yield { type: "text", text: event.delta };
            break;

          case "response.output_item.done":                // a finished item; we want tool calls
            if (event.item?.type === "function_call") {
              yield { type: "tool_call",
                      call: { id: event.item.call_id, name: event.item.name,
                              arguments: event.item.arguments ?? "" } };
            }
            break;

          case "response.completed":                        // success
            completed = true;
            usage = { inputTokens: event.response?.usage?.input_tokens ?? 0,
                      outputTokens: event.response?.usage?.output_tokens ?? 0 };
            break;

          case "response.failed": {                         // failure, even mid-stream
            const err = event.response?.error ?? {};
            throw describeError(undefined, err.code, err.message ?? "the response failed", conn.label);
          }

          case "response.incomplete": {                     // cut short (length or filter)
            const reason = event.response?.incomplete_details?.reason ?? "unknown reason";
            throw new ProviderError(`${conn.label}: the reply was cut short (${reason}).`,
              undefined, reason, "Try again, or ask for a shorter answer.", false);
          }

          case "error":                                     // an error event in the stream
            throw describeError(undefined, event.code ?? event.error?.code,
              event.message ?? event.error?.message ?? "stream error", conn.label);
        }
      }

      if (!completed) {
        throw new ProviderError(`${conn.label}: the connection ended before the reply was complete.`,
          undefined, undefined, "Try again.", false);
      }
      yield { type: "done", usage };
    },

    async listModels(): Promise<string[]> {
      const json = await getJson(conn, `${conn.baseUrl}/models`);
      if (Array.isArray(json.models)) {
        // Sign in with ChatGPT: { models: [{ slug, display_name, visibility }] }
        return json.models.filter((m: any) => m.visibility === "list").map((m: any) => String(m.slug));
      }
      // API key: { data: [{ id }] }, including many non-chat models; keep the chat ones.
      const ids: string[] = (json.data ?? []).map((m: any) => String(m.id));
      return ids.filter((id) => !NOT_CHAT.test(id)).sort();
    },
  };
}

/** Model ids that are not chat models (images, audio, embeddings...). */
const NOT_CHAT = /embedding|tts|whisper|dall-e|image|audio|realtime|transcribe|moderation|search|davinci|babbage/i;

/** Tygig's messages -> the Responses format's "input" items. */
function toResponsesInput(messages: Message[]): object[] {
  const out: object[] = [];
  for (const m of messages) {
    if (m.role === "user") {
      out.push({ role: "user", content: m.text });
    } else if (m.role === "assistant") {
      if (m.text !== "") out.push({ role: "assistant", content: m.text });
      for (const c of m.toolCalls) {
        out.push({ type: "function_call", call_id: c.id, name: c.name, arguments: c.arguments });
      }
    } else {
      out.push({ type: "function_call_output", call_id: m.toolCallId, output: m.text });
    }
  }
  return out;
}
```

## ai/anthropic.ts

*translator: Anthropic format*

```ts:lines
// anthropic.ts - translator for Anthropic's Messages format (all Claude models).

import { ProviderError } from "@tygig/core";
import type { Message, ModelProvider, ModelRequest, StreamEvent, Usage } from "@tygig/core";
import type { Connection } from "./connection.js";
import { describeError, getJson, postJson } from "./http.js";
import { parseJson, readSse } from "./sse.js";

const API_VERSION = "2023-06-01";   // required on every request

export function createAnthropic(conn: Connection): ModelProvider {
  const version = { "anthropic-version": API_VERSION };

  return {
    label: conn.label,

    async *stream(request: ModelRequest): AsyncGenerator<StreamEvent> {
      // 1. Build the request. Anthropic needs an upper limit on the reply length.
      const body: Record<string, unknown> = {
        model: request.model,
        max_tokens: conn.maxTokens,
        system: request.instructions,
        messages: toAnthropicMessages(request.messages),
        stream: true,
      };
      if (request.tools.length > 0) {
        body.tools = request.tools.map((t) => ({
          name: t.name, description: t.description, input_schema: t.inputSchema,
        }));
      }

      // 2. Send it.
      const response = await postJson(conn, `${conn.baseUrl}/messages`, body, request.signal, version);

      // 3. Read the events. The reply is made of numbered "content blocks":
      //    text blocks stream their words; tool blocks stream their input as JSON pieces.
      const toolBlocks = new Map<number, { id: string; name: string; json: string }>();
      const usage: Usage = { inputTokens: 0, outputTokens: 0 };
      let stopped = false;
      let stopReason: string | undefined;

      for await (const message of readSse(response.body!)) {
        const event = parseJson(message.data);
        if (!event) continue;

        switch (event.type) {
          case "message_start":
            usage.inputTokens = event.message?.usage?.input_tokens ?? 0;
            break;

          case "content_block_start":
            if (event.content_block?.type === "tool_use") {
              toolBlocks.set(event.index,
                { id: event.content_block.id, name: event.content_block.name, json: "" });
            }
            break;

          case "content_block_delta":
            if (event.delta?.type === "text_delta" && event.delta.text) {
              yield { type: "text", text: event.delta.text };          // straight to the screen
            } else if (event.delta?.type === "input_json_delta") {
              const block = toolBlocks.get(event.index);
              if (block) block.json += event.delta.partial_json ?? "";
            }
            break;                                                    // thinking deltas are ignored

          case "content_block_stop": {
            const block = toolBlocks.get(event.index);
            if (block) {
              yield { type: "tool_call", call: { id: block.id, name: block.name, arguments: block.json || "{}" } };
              toolBlocks.delete(event.index);
            }
            break;
          }

          case "message_delta":                                       // running total, stop reason
            usage.outputTokens = event.usage?.output_tokens ?? usage.outputTokens;
            stopReason = event.delta?.stop_reason ?? stopReason;
            break;

          case "message_stop":
            stopped = true;
            break;

          case "error":                                               // e.g. overloaded_error
            throw describeError(undefined, event.error?.type, event.error?.message ?? "stream error", conn.label);
        }
      }

      if (!stopped) {
        throw new ProviderError(`${conn.label}: the connection ended before the reply was complete.`,
          undefined, undefined, "Try again.", false);
      }
      if (stopReason === "max_tokens") {
        throw new ProviderError(`${conn.label}: the reply was cut short (max_tokens).`, undefined, "max_tokens",
          "Ask for a shorter answer, or raise \"maxTokens\" in ~/.tygig/config.json.", false);
      }
      yield { type: "done", usage };
    },

    async listModels(): Promise<string[]> {
      const json = await getJson(conn, `${conn.baseUrl}/models?limit=100`, version);
      return (json.data ?? []).map((m: any) => String(m.id));
    },
  };
}

/**
 * Tygig's messages -> Anthropic's messages. Two rules to respect:
 *  - tool results are sent inside a "user" message;
 *  - two messages in a row from the same side must be merged into one.
 */
function toAnthropicMessages(messages: Message[]): { role: string; content: object[] }[] {
  const out: { role: string; content: object[] }[] = [];

  const add = (role: string, block: object) => {
    const last = out[out.length - 1];
    if (last && last.role === role) last.content.push(block);   // same side: merge
    else out.push({ role, content: [block] });
  };

  for (const m of messages) {
    if (m.role === "user") {
      add("user", { type: "text", text: m.text });
    } else if (m.role === "assistant") {
      if (m.text !== "") add("assistant", { type: "text", text: m.text });
      for (const c of m.toolCalls) {
        add("assistant", { type: "tool_use", id: c.id, name: c.name, input: parseJson(c.arguments) ?? {} });
      }
    } else {
      add("user", { type: "tool_result", tool_use_id: m.toolCallId, content: m.text });
    }
  }
  return out;
}
```

## ai/index.ts

*picks the translator for a connection*

```ts:lines
// index.ts - the public face of @tygig/ai.

import type { ModelProvider } from "@tygig/core";
import type { Connection } from "./connection.js";
import { createOpenAIChat } from "./openai-chat.js";
import { createOpenAIResponses } from "./openai-responses.js";
import { createAnthropic } from "./anthropic.js";

export type { Connection } from "./connection.js";
export { apiKeyHeaders } from "./connection.js";
export type { ConnectionKind, ProviderPreset } from "./presets.js";
export { PRESETS, getPreset } from "./presets.js";

/** Pick the translator that speaks this connection's format. */
export function createProvider(conn: Connection): ModelProvider {
  switch (conn.format) {
    case "openai-chat":      return createOpenAIChat(conn);
    case "openai-responses": return createOpenAIResponses(conn);
    case "anthropic":        return createAnthropic(conn);
  }
}
```

## auth/credentials.ts

*the credentials file: read, write safely, update*

```ts:lines
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
```

## auth/jwt.ts

*checks an ID token's signature and claims*

```ts:lines
// jwt.ts - checks that an ID token really comes from OpenAI and is meant for us.
//
// An ID token is three base64url parts joined by dots: header.payload.signature.
// The payload says who signed in. The signature proves OpenAI wrote it. We check
// the signature with OpenAI's published public keys (the "JWKS"), then the claims.

import { createPublicKey, verify } from "node:crypto";

export interface IdTokenChecks {
  jwksUri: string;    // where OpenAI publishes its public keys
  issuer: string;     // who must have issued the token
  audience: string;   // who it must be for: our issued client id
  nonce: string;      // the random value we sent; proves this token answers our request
}

export interface IdTokenClaims {
  sub: string;
  email?: string;
  iss: string;
  [claim: string]: unknown;
}

export async function verifyIdToken(token: string, checks: IdTokenChecks): Promise<IdTokenClaims> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("The ID token is malformed.");
  const [headerB64, payloadB64, signatureB64] = parts as [string, string, string];

  const header = JSON.parse(Buffer.from(headerB64, "base64url").toString("utf8"));
  const claims = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as IdTokenClaims;

  // 1. Signature: find the key OpenAI says it used ("kid"), and verify with it.
  const response = await fetch(checks.jwksUri, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Could not download OpenAI's keys (${response.status}).`);
  const { keys } = (await response.json()) as { keys: any[] };
  const jwk = keys.find((k) => k.kid === header.kid) ?? (keys.length === 1 ? keys[0] : undefined);
  if (!jwk) throw new Error("The ID token was signed with an unknown key.");

  const key = createPublicKey({ key: jwk, format: "jwk" });
  const data = Buffer.from(`${headerB64}.${payloadB64}`);
  const signature = Buffer.from(signatureB64, "base64url");
  let valid: boolean;
  if (header.alg === "RS256") valid = verify("RSA-SHA256", data, key, signature);
  else if (header.alg === "ES256") valid = verify("sha256", data, { key, dsaEncoding: "ieee-p1363" }, signature);
  else throw new Error(`Unsupported ID token algorithm: ${header.alg}`);
  if (!valid) throw new Error("The ID token's signature is not valid.");

  // 2. Claims: issued by OpenAI, for us, not expired, answering our request.
  const now = Math.floor(Date.now() / 1000);
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (claims.iss !== checks.issuer) throw new Error("The ID token comes from an unexpected issuer.");
  if (!audiences.includes(checks.audience)) throw new Error("The ID token is not meant for Tygig.");
  if (typeof claims.exp !== "number" || claims.exp + 60 < now) throw new Error("The ID token has expired.");
  if (claims.nonce !== checks.nonce) throw new Error("The ID token does not answer this sign-in.");
  if (typeof claims.sub !== "string") throw new Error("The ID token has no account id.");

  return claims;
}
```

## auth/browser.ts

*opens an address in the default browser*

```ts:lines
// browser.ts - opens a web address in the user's default browser.

import { spawn } from "node:child_process";

export function openBrowser(url: string): void {
  if (process.env.TYGIG_NO_BROWSER) return;   // tests, or computers without a browser

  // Each system has its own "open this" program. The address is passed as a
  // separate argument (no shell), so characters such as & cannot break it.
  const [command, args] =
    process.platform === "win32" ? ["rundll32", ["url.dll,FileProtocolHandler", url]] :
    process.platform === "darwin" ? ["open", [url]] :
    ["xdg-open", [url]];

  try {
    const child = spawn(command as string, args as string[], { stdio: "ignore", detached: true });
    child.on("error", () => { /* no browser: the address is also shown on screen */ });
    child.unref();   // do not keep Tygig waiting for the browser
  } catch {
    // same: the user can copy the address from the screen
  }
}
```

## auth/chatgpt-oauth.ts

*Sign in with ChatGPT: the whole browser flow*

```ts:lines
// chatgpt-oauth.ts - "Sign in with ChatGPT" (OpenAI's documented flow for
// open-source apps that run on the user's own computer).
//
// In short: Tygig opens your browser at OpenAI's sign-in page. You sign in and
// agree. OpenAI sends the browser back to a tiny web server Tygig runs on your
// own computer (127.0.0.1) with a one-time code. Tygig swaps that code for tokens.
// Your password never passes through Tygig.

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { readCredentials, updateCredentials } from "./credentials.js";
import type { ChatGPTAccount } from "./credentials.js";
import { verifyIdToken } from "./jwt.js";
import { openBrowser } from "./browser.js";

/** OpenAI's sign-in server. Can be pointed elsewhere for tests. */
export const AUTH_BASE = process.env.TYGIG_CHATGPT_AUTH_BASE ?? "https://auth.openai.com";
/** Identifies the API the tokens are for. Always this value, also in tests. */
export const RESOURCE = "https://api.openai.com/v1";
/** Where codes and refresh tokens are exchanged for new tokens. */
export const TOKEN_ENDPOINT = `${AUTH_BASE}/api/accounts/oauth/token`;
const SCOPES = "openid profile email offline_access resource.invoke chatgpt.tokens.use.direct";
const PREFERRED_PORT = 1455;               // the port in OpenAI's examples
const CALLBACK_PATH = "/auth/callback";
const TIMEOUT_MS = 5 * 60 * 1000;          // give up after five minutes

export interface SignInResult {
  email: string;
  planUsage: boolean;    // false if the user did not allow use of the ChatGPT plan
  firstTime: boolean;    // show the "You're using your ChatGPT plan" notice
}

/**
 * Run the whole sign-in. `showUrl` receives the address, so the screen can show it
 * in case the browser does not open by itself.
 */
export async function signInWithChatGPT(credentialsFile: string, showUrl: (url: string) => void,
                                        signal?: AbortSignal): Promise<SignInResult> {
  // 1. The host id identifies this computer. Created once, saved before first use.
  let creds = await readCredentials(credentialsFile);
  const hostId = creds.chatgpt.hostId ?? `urn:uuid:${randomUUID()}`;
  if (!creds.chatgpt.hostId) {
    creds = await updateCredentials(credentialsFile, (c) => { c.chatgpt.hostId = hostId; });
  }

  // 2. First sign-in, or signing in again with the same account?
  const existing = creds.chatgpt.account;
  const returning = Boolean(existing?.clientId);

  // 3. Fresh secrets for this attempt (PKCE, state, nonce).
  const verifier = base64url(randomBytes(32));                       // kept secret here
  const challenge = base64url(createHash("sha256").update(verifier).digest());   // sent out
  const state = base64url(randomBytes(16));                          // ties callback to request
  const nonce = base64url(randomBytes(16));                          // ties ID token to request

  // 4. Start the local server BEFORE opening the browser.
  const server = await startCallbackServer(state);
  const redirectUri = `http://127.0.0.1:${server.port}${CALLBACK_PATH}`;

  try {
    // 5. Build the sign-in address and open it.
    const params = new URLSearchParams({
      client_id: returning ? existing!.clientId : "dynamic_agent_client",
      response_type: "code",
      redirect_uri: redirectUri,
      scope: SCOPES,
      resource: RESOURCE,
      state,
      nonce,
      code_challenge: challenge,
      code_challenge_method: "S256",
      ext_agent_host_id: hostId,
    });
    if (!returning) params.set("agent_name_hint", "Tygig");           // first registration only
    if (returning && existing!.email) params.set("login_hint", existing!.email);
    if (returning && !existing!.planUsage) params.set("prompt", "consent");   // ask again for plan use

    const url = `${AUTH_BASE}/api/accounts/authorize?${params}`;
    showUrl(url);
    openBrowser(url);

    // 6. Wait for the browser to come back.
    const callback = await server.waitForCallback(signal);      // only answers with our state
    const error = callback.get("error");
    if (error === "access_denied") throw new Error("Sign-in was cancelled in the browser.");
    if (error) throw new Error(`Sign-in failed: ${error}`);

    const code = callback.get("code");
    if (!code) throw new Error("The sign-in answer had no code. Try again.");
    const returnedClientId = callback.get("client_id");
    if (returning && returnedClientId && returnedClientId !== existing!.clientId) {
      throw new Error("The sign-in answer belongs to a different registration. Try again.");
    }
    const clientId = returning ? existing!.clientId : returnedClientId;
    if (!clientId) throw new Error("The sign-in answer had no client id. Try again.");

    // 7. Swap the one-time code for tokens.
    const tokens = await postForm(TOKEN_ENDPOINT, {
      grant_type: "authorization_code",
      client_id: clientId,
      code,
      code_verifier: verifier,
      redirect_uri: redirectUri,
      resource: RESOURCE,
    });

    // 8. Check the ID token: really from OpenAI, for us, answering this request.
    const discovery = await discover();
    const claims = await verifyIdToken(tokens.id_token, {
      jwksUri: discovery.jwks_uri, issuer: discovery.issuer, audience: clientId, nonce,
    });
    if (returning && existing!.subject !== claims.sub) {
      throw new Error("You signed in with a different ChatGPT account. To switch accounts, first run: tygig logout --all");
    }

    // 9. Did the user allow use of the ChatGPT plan? (No "scope" in the answer means:
    //    everything requested was granted; that is the OAuth rule.)
    const scopes = String(tokens.scope ?? SCOPES).split(" ").filter(Boolean);
    const planUsage = scopes.includes("chatgpt.tokens.use.direct");

    // 10. Save everything together.
    const account: ChatGPTAccount = {
      email: String(claims.email ?? ""),
      issuer: claims.iss,
      subject: claims.sub,
      clientId,
      idToken: tokens.id_token,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? "",
      tokenType: tokens.token_type ?? "Bearer",
      expiresIn: Number(tokens.expires_in ?? 3600),
      scopes,
      savedAt: Date.now(),
      planUsage,
      welcomed: existing?.welcomed ?? false,
    };
    await updateCredentials(credentialsFile, (c) => { c.chatgpt.account = account; });

    return { email: account.email, planUsage, firstTime: !account.welcomed };
  } finally {
    server.close();
  }
}

/** Remember that the first-time notice has been shown (OpenAI asks: only once). */
export async function markWelcomed(credentialsFile: string): Promise<void> {
  await updateCredentials(credentialsFile, (c) => {
    if (c.chatgpt.account) c.chatgpt.account.welcomed = true;
  });
}

// ---------------------------------------------------------------------------
// Helpers shared with chatgpt-session.ts

/** OpenAI's published configuration: the issuer name, the public keys, the revoke endpoint. */
export async function discover(): Promise<{ issuer: string; jwks_uri: string;
                                            revocation_endpoint?: string }> {
  const response = await fetch(`${AUTH_BASE}/.well-known/openid-configuration`, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Could not reach OpenAI's sign-in service (${response.status}).`);
  return (await response.json()) as any;
}

/** POST a form (key=value&...) and return the JSON answer. Errors carry OpenAI's code. */
export async function postForm(url: string, fields: Record<string, string>): Promise<any> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields),
    signal: AbortSignal.timeout(15_000),            // never hold the credentials lock for long
  });
  const text = await response.text();
  let json: any = {};
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  if (!response.ok) {
    const err = new Error(json.error_description ?? json.error ?? `HTTP ${response.status}`) as Error & { code?: string; status?: number };
    err.code = json.error;
    err.status = response.status;
    throw err;
  }
  return json;
}

function base64url(bytes: Buffer): string {
  return bytes.toString("base64url");
}

/**
 * A tiny web server on 127.0.0.1 that waits for the browser to come back.
 * It accepts only an answer carrying our `state`; anything else (another page
 * or program knocking on the port) is refused and the wait continues.
 */
async function startCallbackServer(expectedState: string): Promise<{
  port: number;
  waitForCallback: (signal?: AbortSignal) => Promise<URLSearchParams>;
  close: () => void;
}> {
  let deliver: (params: URLSearchParams) => void = () => {};
  const arrived = new Promise<URLSearchParams>((resolve) => { deliver = resolve; });
  const page = (title: string, text: string) =>
    `<html><body style='font-family:sans-serif;padding:2em'><h2>${title}</h2><p>${text}</p></body></html>`;

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (url.pathname !== CALLBACK_PATH || url.searchParams.get("state") !== expectedState) {
      res.writeHead(404, { "content-type": "text/html; charset=utf-8" })
         .end(page("Tygig", "This address does not belong to the current sign-in."));
      return;
    }
    const ok = !url.searchParams.get("error");
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(ok ? page("Tygig", "You are signed in. You can close this window and return to the terminal.")
               : page("Tygig", "Sign-in was not completed. You can close this window and return to the terminal."));
    deliver(url.searchParams);
  });

  // Try OpenAI's example port first; if it is taken, let the system pick a free one.
  const listen = (port: number) => new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => { server.off("error", reject); resolve(); });
  });
  try {
    await listen(PREFERRED_PORT);
  } catch {
    await listen(0);
  }
  const port = (server.address() as AddressInfo).port;

  return {
    port,
    waitForCallback: (signal) => new Promise<URLSearchParams>((resolve, reject) => {
      if (signal?.aborted) { reject(new Error("Sign-in cancelled.")); return; }
      const timer = setTimeout(() => reject(new Error("Sign-in timed out after five minutes.")), TIMEOUT_MS);
      signal?.addEventListener("abort", () => { clearTimeout(timer); reject(new Error("Sign-in cancelled.")); },
                              { once: true });
      arrived.then((params) => { clearTimeout(timer); resolve(params); });
    }),
    close: () => { server.closeAllConnections(); server.close(); },
  };
}
```

## auth/chatgpt-session.ts

*keeps the ChatGPT sign-in fresh; signs out*

```ts:lines
// chatgpt-session.ts - keeping a ChatGPT sign-in usable, and signing out.
//
// The access token lasts about an hour. Before it runs out, Tygig uses the
// refresh token to get a new one, silently. The refresh token itself is replaced
// every time ("rotating"), so both are saved together, under the file lock:
// if two Tygig windows need a new token at the same moment, the second one waits,
// then finds the first one's new token already saved and simply uses it.

import { ProviderError } from "@tygig/core";
import { readCredentials, updateCredentials, withLock, writeFileAtomic } from "./credentials.js";
import { RESOURCE, TOKEN_ENDPOINT, discover, postForm } from "./chatgpt-oauth.js";

const REFRESH_MARGIN_MS = 2 * 60 * 1000;   // refresh when less than two minutes remain

/** Refresh codes after which the sign-in cannot be saved (OpenAI's "Errors and recovery"). */
const TERMINAL = ["invalid_grant", "invalid_refresh_token", "token_expired",
                  "refresh_token_expired", "refresh_token_invalidated", "refresh_token_reused"];

/** A valid access token for the signed-in ChatGPT account, refreshed if needed. */
export async function getChatGPTAccessToken(credentialsFile: string): Promise<string> {
  const account = (await readCredentials(credentialsFile)).chatgpt.account;
  if (!account || !account.accessToken) {
    throw new ProviderError("ChatGPT plan: you are not signed in.", 401, "not_signed_in",
      "Sign in: tygig login", false);
  }
  if (!account.planUsage) {
    throw new ProviderError("ChatGPT plan: you did not allow Tygig to use your plan.", 403, "no_plan_usage",
      "Sign in again and allow plan usage (tygig login), or connect with an API key.", false);
  }
  if (Date.now() < account.savedAt + account.expiresIn * 1000 - REFRESH_MARGIN_MS) {
    return account.accessToken;                                   // still fresh
  }
  return refreshChatGPTToken(credentialsFile, false);
}

/**
 * Get a new access token with the refresh token. `force`: refresh even if the
 * saved token looks fresh (used when OpenAI rejected it early with a 401).
 */
export async function refreshChatGPTToken(credentialsFile: string, force: boolean): Promise<string> {
  return withLock(credentialsFile, async () => {
    // Read again under the lock: another window may have just refreshed.
    const creds = await readCredentials(credentialsFile);
    const account = creds.chatgpt.account;
    if (!account || !account.refreshToken) {
      throw new ProviderError("ChatGPT plan: you are not signed in.", 401, "not_signed_in",
        "Sign in: tygig login", false);
    }
    const fresh = Date.now() < account.savedAt + account.expiresIn * 1000 - REFRESH_MARGIN_MS;
    if (fresh && !force) return account.accessToken;

    let tokens: any;
    try {
      tokens = await postForm(TOKEN_ENDPOINT, {
        grant_type: "refresh_token",
        client_id: account.clientId,
        refresh_token: account.refreshToken,
        resource: RESOURCE,
      });
    } catch (err: any) {
      if (TERMINAL.includes(err.code)) {
        // The sign-in is over. Clear the tokens but keep the account's registration.
        account.accessToken = account.refreshToken = account.idToken = "";
        await writeFileAtomic(credentialsFile, JSON.stringify(creds, null, 2), 0o600);
        throw new ProviderError("ChatGPT plan: your sign-in has expired.", 401, err.code,
          "Sign in again: tygig login", false);
      }
      // A network or server problem: keep everything and let the user try again.
      throw new ProviderError(`ChatGPT plan: could not renew your sign-in (${err.message}).`,
        err.status, err.code, "Check your connection and try again.", false);
    }

    // Replace the access token, expiry, scopes and the rotating refresh token together.
    const scopes = typeof tokens.scope === "string" ? tokens.scope.split(" ").filter(Boolean) : account.scopes;
    account.accessToken = tokens.access_token;
    account.refreshToken = tokens.refresh_token ?? account.refreshToken;
    account.idToken = tokens.id_token ?? account.idToken;
    account.expiresIn = Number(tokens.expires_in ?? 3600);
    account.scopes = scopes;
    account.planUsage = scopes.includes("chatgpt.tokens.use.direct");
    account.savedAt = Date.now();
    await writeFileAtomic(credentialsFile, JSON.stringify(creds, null, 2), 0o600);
    return account.accessToken;
  });
}

/**
 * Sign out: ask OpenAI to revoke the refresh token, then clear the tokens locally.
 * `forget`: also forget the account's registration, so a different ChatGPT
 * account can sign in next (the host id is always kept, as OpenAI asks).
 * Returns whether OpenAI confirmed the revocation.
 */
export async function signOutChatGPT(credentialsFile: string, forget = false): Promise<boolean> {
  const account = (await readCredentials(credentialsFile)).chatgpt.account;
  let revoked = true;
  if (account?.refreshToken) {
    revoked = false;
    try {
      const { revocation_endpoint } = await discover();
      if (revocation_endpoint) {
        await postForm(revocation_endpoint, {
          token: account.refreshToken,
          token_type_hint: "refresh_token",
          client_id: account.clientId,
        });
        revoked = true;
      }
    } catch {
      revoked = false;   // cleared locally anyway; the user is told
    }
  }
  await updateCredentials(credentialsFile, (c) => {
    const a = c.chatgpt.account;
    if (!a) return;
    if (forget) delete c.chatgpt.account;
    else a.accessToken = a.refreshToken = a.idToken = "";
  });
  return revoked;
}

/** Is a ChatGPT sign-in stored (with tokens)? */
export async function hasChatGPTSignIn(credentialsFile: string): Promise<boolean> {
  return Boolean((await readCredentials(credentialsFile)).chatgpt.account?.refreshToken);
}
```

## auth/index.ts

*what other packages may import from auth*

```ts:lines
// index.ts - the public face of @tygig/auth.

export type { Credentials, ChatGPTAccount } from "./credentials.js";
export { readCredentials, updateCredentials, withLock, writeFileAtomic } from "./credentials.js";
export type { SignInResult } from "./chatgpt-oauth.js";
export { signInWithChatGPT, markWelcomed } from "./chatgpt-oauth.js";
export { getChatGPTAccessToken, refreshChatGPTToken, signOutChatGPT, hasChatGPTSignIn } from "./chatgpt-session.js";
export { openBrowser } from "./browser.js";
```

## agent/agent.ts

*the agent loop*

```ts:lines
// agent.ts - the agent loop (design document §8).
//
// One "turn" = you send a message, the agent works until it has an answer.
// Inside a turn, each "step" is one call to the model. Without tools, a turn is
// always one step: ask, stream the answer, done. With tools (later), the model
// may ask for a tool, get the result, and take another step.

import { ProviderError } from "@tygig/core";
import type { AgentEvent, AssistantMessage, Message, ModelProvider, ToolDefinition,
              TurnEndReason, Usage } from "@tygig/core";

/** A tool the agent can run. The base harness has none; plugins will add them. */
export interface Tool {
  definition: ToolDefinition;
  run(input: unknown): Promise<string>;
}

export interface AgentOptions {
  provider: ModelProvider;
  model: string;
  instructions: string;
  history?: Message[];     // an earlier conversation, when resuming
  tools?: Tool[];          // none in the base harness
  stepLimit?: number;      // safety limit per turn (design document D4)
  maxHistory?: number;     // how many recent messages to send to the model
}

export interface Agent {
  readonly history: Message[];
  model: string;
  run(text: string, onEvent: (event: AgentEvent) => void, signal?: AbortSignal): Promise<void>;
}

export function createAgent(options: AgentOptions): Agent {
  const history: Message[] = options.history ? [...options.history] : [];
  const tools = options.tools ?? [];
  const stepLimit = options.stepLimit ?? 20;
  const maxHistory = options.maxHistory ?? 60;

  const agent: Agent = {
    history,
    model: options.model,

    async run(text, onEvent, signal) {
      const started = Date.now();
      const total: Usage = { inputTokens: 0, outputTokens: 0 };
      const end = (reason: TurnEndReason) =>
        onEvent({ type: "turn_end", reason, seconds: (Date.now() - started) / 1000, usage: total });

      history.push({ role: "user", text });
      onEvent({ type: "turn_start", text });

      for (let step = 1; step <= stepLimit; step++) {
        onEvent({ type: "step_start", step });
        const reply: AssistantMessage = { role: "assistant", text: "", toolCalls: [] };
        let usage: Usage | undefined;

        try {
          // Ask the model and pass each piece on as it arrives.
          const stream = options.provider.stream({
            model: agent.model,
            instructions: options.instructions,
            messages: recent(history, maxHistory),
            tools: tools.map((t) => t.definition),
            signal,
          });
          for await (const piece of stream) {
            if (piece.type === "text") {
              reply.text += piece.text;
              onEvent({ type: "text_delta", text: piece.text });
            } else if (piece.type === "tool_call") {
              reply.toolCalls.push(piece.call);
            } else {
              usage = piece.usage;
            }
          }
        } catch (err) {
          // Interrupted (Esc) or failed: either way, keep the part of the answer you already saw.
          if (reply.text !== "") {
            const partial: AssistantMessage = { role: "assistant", text: reply.text, toolCalls: [] };
            history.push(partial);
            onEvent({ type: "assistant_message", message: partial });
          }
          if (signal?.aborted) {                     // you pressed Esc
            end("interrupted");
            return;
          }
          const { message, hint } = explain(err);
          onEvent({ type: "error", message, hint });
          end("error");
          return;
        }

        history.push(reply);
        onEvent({ type: "assistant_message", message: reply, usage });
        if (usage) {
          total.inputTokens += usage.inputTokens;
          total.outputTokens += usage.outputTokens;
        }

        if (reply.toolCalls.length === 0) {          // only text: the turn is complete
          end("done");
          return;
        }

        // The model asked for tools: run each, give it the results, take another step.
        for (const call of reply.toolCalls) {
          const tool = tools.find((t) => t.definition.name === call.name);
          const result = tool ? await runTool(tool, call.arguments)
                              : `Error: there is no tool named "${call.name}".`;
          history.push({ role: "tool", toolCallId: call.id, text: result });
          onEvent({ type: "tool_result", toolCallId: call.id, name: call.name, text: result });
        }
      }
      end("step_limit");
    },
  };
  return agent;
}

/** The most recent messages, starting with one of yours (some providers require that). */
function recent(history: Message[], max: number): Message[] {
  const slice = history.slice(-max);
  const firstUser = slice.findIndex((m) => m.role === "user");
  return firstUser > 0 ? slice.slice(firstUser) : slice;
}

/** Run one tool safely: bad input or a crash becomes an error message for the model. */
async function runTool(tool: Tool, args: string): Promise<string> {
  try {
    return await tool.run(JSON.parse(args || "{}"));
  } catch (err) {
    return `Error: ${(err as Error).message}`;
  }
}

/** Any error -> a message and a hint for the screen. */
function explain(err: unknown): { message: string; hint: string } {
  if (err instanceof ProviderError) return { message: err.message, hint: err.hint };
  const message = err instanceof Error ? err.message : String(err);
  return { message, hint: "Unexpected problem. If it happens again, please report it." };
}
```

## agent/session.ts

*saving and reopening conversations*

```ts:lines
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
```

## agent/index.ts

*what other packages may import from agent*

```ts:lines
// index.ts - the public face of @tygig/agent.

export type { Agent, AgentOptions, Tool } from "./agent.js";
export { createAgent } from "./agent.js";
export type { SessionInfo } from "./session.js";
export { Session, listSessions, projectSessionsDir } from "./session.js";
```

## ui/Transcript.tsx

*the conversation on screen, printed once*

```tsx:lines
// Transcript.tsx - the conversation so far, printed once and never redrawn.
//
// Ink redraws the bottom of the screen many times a second while an answer
// streams in. Finished entries go into <Static>: Ink prints each one once and
// leaves it alone, so a long conversation stays fast and does not flicker.

import { Box, Static, Text } from "ink";

/** One finished line (or block) on screen. */
export type Entry =
  | { kind: "header"; provider: string; model: string; folder: string; chatgptPlan: boolean }
  | { kind: "user"; text: string }
  | { kind: "assistant"; text: string }
  | { kind: "error"; message: string; hint: string }
  | { kind: "info"; text: string }
  | { kind: "stats"; text: string };

export function Transcript({ entries }: { entries: Entry[] }) {
  return (
    <Static items={entries}>
      {(entry, index) => <EntryView key={index} entry={entry} />}
    </Static>
  );
}

function EntryView({ entry }: { entry: Entry }) {
  switch (entry.kind) {
    case "header":
      return (
        <Box flexDirection="column" marginBottom={1}>
          <Text>
            <Text bold color="magenta">tygig</Text>
            <Text dimColor>  ·  {entry.provider}  ·  {entry.model}</Text>
          </Text>
          <Text dimColor>{entry.folder}</Text>
          {entry.chatgptPlan && (
            <Text color="green">Using ChatGPT plan  <Text dimColor>· Manage usage: ChatGPT &gt; Settings &gt; Usage</Text></Text>
          )}
          <Text dimColor>Type a message and press Enter.  /help for commands  ·  Esc interrupts  ·  Ctrl+C quits</Text>
        </Box>
      );
    case "user":
      return (
        <Box marginTop={1}>
          <Text color="cyan" bold>› </Text>
          <Text color="cyan">{entry.text}</Text>
        </Box>
      );
    case "assistant":
      return <Text>{entry.text}</Text>;
    case "error":
      return (
        <Box flexDirection="column">
          <Text color="red">✗ {entry.message}</Text>
          <Text dimColor>  {entry.hint}</Text>
        </Box>
      );
    case "info":
      return <Text dimColor>{entry.text}</Text>;
    case "stats":
      return <Text dimColor>  {entry.text}</Text>;
  }
}
```

## ui/Picker.tsx

*a list you move through with the arrow keys, with filtering*

```tsx:lines
// Picker.tsx - choose one item from a list with the arrow keys.
// For long lists (OpenRouter has hundreds of models) you can type to filter.

import { useState } from "react";
import { Box, Text, useInput } from "ink";

export interface PickerItem {
  label: string;     // shown
  value: string;     // returned when chosen
  hint?: string;     // shown dimmed after the label
}

interface PickerProps {
  title: string;
  items: PickerItem[];
  onSelect: (value: string) => void;
  onCancel?: () => void;
  allowCustom?: boolean;   // offer "use what I typed" when it matches nothing
  pageSize?: number;
}

export function Picker({ title, items, onSelect, onCancel, allowCustom = false, pageSize = 10 }: PickerProps) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState(false);   // ignore a second Enter (key repeat)
  const filterable = items.length > pageSize || allowCustom;

  // The visible list: items matching what was typed (+ the typed text itself, if allowed).
  const q = query.toLowerCase();
  const shown = items.filter((item) => item.label.toLowerCase().includes(q) || item.value.toLowerCase().includes(q));
  if (allowCustom && query !== "" && !items.some((item) => item.value === query)) {
    shown.push({ label: `Use "${query}"`, value: query, hint: "as typed" });
  }
  const current = Math.min(index, Math.max(shown.length - 1, 0));

  useInput((input, key) => {
    if (chosen) return;
    if (key.upArrow) setIndex(Math.max(current - 1, 0));
    else if (key.downArrow) setIndex(Math.min(current + 1, shown.length - 1));
    else if (key.return) { const item = shown[current]; if (item) { setChosen(true); onSelect(item.value); } }
    else if (key.escape) onCancel?.();
    else if (filterable && (key.backspace || key.delete)) { setQuery(query.slice(0, -1)); setIndex(0); }
    else if (filterable && input && !key.ctrl && !key.meta && !key.tab) { setQuery(query + input); setIndex(0); }
  });

  // Show a window of `pageSize` items around the selected one.
  const start = Math.max(0, Math.min(current - Math.floor(pageSize / 2), shown.length - pageSize));
  const visible = shown.slice(start, start + pageSize);

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text bold>{title}</Text>
      {filterable && <Text dimColor>Filter: <Text color="cyan">{query}</Text>▏</Text>}
      {visible.map((item, i) => {
        const selected = start + i === current;
        return (
          <Text key={item.value + i} color={selected ? "cyan" : undefined}>
            {selected ? "› " : "  "}{item.label}{item.hint ? <Text dimColor>   {item.hint}</Text> : null}
          </Text>
        );
      })}
      {shown.length === 0 && <Text dimColor>  (nothing matches)</Text>}
      {shown.length > pageSize && <Text dimColor>  {shown.length} items</Text>}
      <Text dimColor>↑↓ move · Enter choose{onCancel ? " · Esc back" : ""}{filterable ? " · type to filter" : ""}</Text>
    </Box>
  );
}
```

## ui/Prompt.tsx

*one line of text input*

```tsx:lines
// Prompt.tsx - one line of text input, with a label. `secret` hides what you type.

import { Box, Text } from "ink";
import TextInput from "ink-text-input";

interface PromptProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  placeholder?: string;
  secret?: boolean;
  focus?: boolean;
}

export function Prompt({ label, value, onChange, onSubmit, placeholder, secret, focus = true }: PromptProps) {
  return (
    <Box>
      <Text color="cyan" bold>{label} </Text>
      {/* A pasted text with line breaks becomes one line: this input is a single line. */}
      <TextInput value={value} onChange={(text) => onChange(text.replace(/\r\n|\r|\n/g, " "))} onSubmit={onSubmit}
                 placeholder={placeholder} mask={secret ? "*" : undefined} focus={focus} />
    </Box>
  );
}
```

## ui/Spinner.tsx

*the moving sign while waiting*

```tsx:lines
// Spinner.tsx - a small moving sign that shows Tygig is waiting for the model.

import { useEffect, useState } from "react";
import { Text } from "ink";

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export function Spinner({ label }: { label: string }) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setFrame((f) => (f + 1) % FRAMES.length), 80);
    return () => clearInterval(timer);       // stop when the spinner disappears
  }, []);
  return <Text color="magenta">{FRAMES[frame]} <Text dimColor>{label}</Text></Text>;
}
```

## ui/index.ts

*what other packages may import from ui*

```ts:lines
// index.ts - the public face of @tygig/ui: building blocks only, no program logic.

export type { Entry } from "./Transcript.js";
export { Transcript } from "./Transcript.js";
export type { PickerItem } from "./Picker.js";
export { Picker } from "./Picker.js";
export { Prompt } from "./Prompt.js";
export { Spinner } from "./Spinner.js";
```

## cli/bin/tygig.js

*runs when you type tygig: checks Node, starts tsx, loads main*

```js:lines
#!/usr/bin/env node
// tygig.js - the file that runs when you type `tygig`.
//
// Tygig is written in TypeScript. Node.js runs JavaScript, so this small file
// first switches on `tsx`, which translates TypeScript on the fly, and then
// starts the real program in src/main.tsx.
//
// tsx needs Tygig's tsconfig.json (it says how to translate the screen code).
// You start Tygig from your own project folder, where that file is not, so we
// point tsx at it explicitly: three folders up from this file.

import { fileURLToPath } from "node:url";
import { register } from "tsx/esm/api";

const major = Number(process.versions.node.split(".")[0]);
if (major < 22) {
  console.error(`Tygig needs Node.js 22 or newer. You have ${process.versions.node}. Install it from https://nodejs.org`);
  process.exit(1);
}

register({ tsconfig: fileURLToPath(new URL("../../../tsconfig.json", import.meta.url)) });
await import("../src/main.tsx");
```

## cli/main.tsx

*reads the command and does it: chat, login, logout, sessions*

```tsx:lines
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
```

## cli/paths.ts

*where Tygig keeps its files*

```ts:lines
// paths.ts - where Tygig keeps its files on your computer, and which folder is
// "the project".
//
//   ~/.tygig/config.json        which provider and model you use
//   ~/.tygig/credentials.json   your keys and sign-in tokens
//   ~/.tygig/projects/...       saved conversations, one folder per project
//
// "~" is your home folder: C:\Users\<you> on Windows, /home/<you> on Linux.
// The TYGIG_HOME environment variable can point somewhere else (used by tests).

import { realpathSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export interface Paths {
  home: string;
  config: string;
  credentials: string;
}

export function getPaths(): Paths {
  const home = process.env.TYGIG_HOME ?? path.join(os.homedir(), ".tygig");
  return {
    home,
    config: path.join(home, "config.json"),
    credentials: path.join(home, "credentials.json"),
  };
}

/**
 * The folder you started Tygig in. On Windows the same folder can be reported as
 * "c:\proj" or "C:\proj" depending on the terminal; asking Windows for the real
 * spelling makes both the same, so your saved conversations are always found.
 */
export function currentProjectFolder(): string {
  const cwd = process.cwd();
  if (process.platform !== "win32") return cwd;
  try {
    const real = realpathSync.native(cwd);
    return real.charAt(0).toUpperCase() + real.slice(1);
  } catch {
    return cwd;
  }
}
```

## cli/config.ts

*reading and writing config.json*

```ts:lines
// config.ts - your settings: which provider, which model.
// Stored in ~/.tygig/config.json. Contains no secrets: keys live in credentials.json.

import { readFile } from "node:fs/promises";
import { writeFileAtomic } from "@tygig/auth";

export interface Config {
  provider: string;      // a preset id, e.g. "openai", "chatgpt", "ollama"
  model: string;         // e.g. "gpt-6.1-sol"
  baseUrl?: string;      // only for "custom" and "local-custom" providers
  maxTokens?: number;    // longest reply allowed; Anthropic only (it needs a limit); default 8192
  stepLimit?: number;    // safety limit of model calls per message; default 20
}

/** Read the settings; undefined if you have never logged in. */
export async function readConfig(file: string): Promise<Config | undefined> {
  try {
    const json = JSON.parse(await readFile(file, "utf8"));
    if (typeof json.provider !== "string" || typeof json.model !== "string") return undefined;
    return json as Config;
  } catch {
    return undefined;
  }
}

/** Save the settings (written to a temporary file first, then renamed: never half-written). */
export async function writeConfig(file: string, config: Config): Promise<void> {
  await writeFileAtomic(file, JSON.stringify(config, null, 2));
}
```

## cli/connect.ts

*settings + credentials + translator = a working provider*

```ts:lines
// connect.ts - turns your settings into a working model provider.
// This is where the blocks are joined: settings + credentials + translator.

import type { ModelProvider } from "@tygig/core";
import { apiKeyHeaders, createProvider, getPreset } from "@tygig/ai";
import type { ProviderPreset } from "@tygig/ai";
import { getChatGPTAccessToken, readCredentials, refreshChatGPTToken } from "@tygig/auth";
import type { Config } from "./config.js";
import type { Paths } from "./paths.js";

export interface Connected {
  provider: ModelProvider;
  preset: ProviderPreset;
  label: string;          // for the header, e.g. "ChatGPT plan (you@example.com)"
  secrets: string[];      // values that must never be written to the session log
}

/** Settings for a connection that is not saved yet (used while logging in). */
export interface Draft {
  provider: string;
  baseUrl?: string;
  apiKey?: string;            // a key just typed in
  keySource?: "env";          // "use the key from the environment variable"
  maxTokens?: number;
}

/**
 * Where a key is stored in credentials.json. Each of your own servers gets its own
 * slot, so a key meant for one server is never sent to another.
 */
export function keySlot(presetId: string, baseUrl: string | undefined): string {
  return presetId === "custom" || presetId === "local-custom" ? `custom:${baseUrl ?? ""}` : presetId;
}

export async function connect(settings: Config | Draft, paths: Paths): Promise<Connected> {
  const preset = getPreset(settings.provider);

  // 1. The address. TYGIG_BASE_URL replaces it, but only together with TYGIG_HOME
  //    (a separate test folder), so a forgotten test variable can never send your
  //    real keys somewhere else.
  const override = process.env.TYGIG_HOME ? process.env.TYGIG_BASE_URL : undefined;
  const baseUrl = (override ?? settings.baseUrl ?? preset.baseUrl).replace(/\/+$/, "");
  if (!baseUrl) throw new Error(`No address set for ${preset.label}. Run: tygig login`);

  // 2. Who we are: a ChatGPT sign-in, or an API key.
  const creds = await readCredentials(paths.credentials);
  let authHeaders: () => Promise<Record<string, string>>;
  let onUnauthorized: (() => Promise<boolean>) | undefined;
  let secrets: string[];
  let label = preset.label;

  if (preset.kind === "chatgpt") {
    const account = creds.chatgpt.account;
    // Asked before every request, so an expiring token is renewed in time.
    authHeaders = async () => ({ authorization: `Bearer ${await getChatGPTAccessToken(paths.credentials)}` });
    // If OpenAI rejects a token that looked valid, renew it once and try again.
    onUnauthorized = async () => {
      try { await refreshChatGPTToken(paths.credentials, true); return true; } catch { return false; }
    };
    secrets = account ? [account.accessToken, account.refreshToken, account.idToken] : [];
    if (account?.email) label = `ChatGPT plan (${account.email})`;
  } else {
    const fromEnv = preset.keyEnv ? process.env[preset.keyEnv] : undefined;
    const typed = "apiKey" in settings ? settings.apiKey : undefined;
    const wantsEnv = "keySource" in settings && settings.keySource === "env";
    const stored = creds.apiKeys[keySlot(preset.id, baseUrl)];
    // A key just typed wins; then "use the environment" if chosen; then the stored key; then the environment.
    const key = typed || (wantsEnv ? fromEnv : undefined) || stored || fromEnv;
    if (preset.needsKey && !key && preset.id !== "custom") {
      throw new Error(`No API key for ${preset.label}. Run: tygig login`);
    }
    const headers = apiKeyHeaders(preset.format, key, preset.id);
    authHeaders = async () => headers;
    secrets = key ? [key] : [];
    if (preset.id === "custom" || preset.id === "local-custom") label = new URL(baseUrl).host;
  }

  // 3. The translator for this provider's format.
  const provider = createProvider({
    label, format: preset.format, baseUrl, authHeaders, onUnauthorized, maxTokens: settings.maxTokens ?? 8192,
  });
  return { provider, preset, label, secrets };
}
```

## cli/instructions.ts

*the system instructions sent with every request*

```ts:lines
// instructions.ts - the system instructions sent with every request.
// Kept short (design document §16): the model needs to know where it is and what it can do.

import os from "node:os";

export function buildInstructions(projectDir: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return [
    "You are Tygig, an assistant running in the user's terminal.",
    `Today's date: ${today}. Operating system: ${os.type()}. Project folder: ${projectDir}.`,
    "You have no tools in this version: you cannot read files, run commands or browse.",
    "If a task needs those, say so plainly instead of pretending.",
    "Your answers are shown as plain text in a terminal: keep formatting simple and answers concise.",
  ].join("\n");
}
```

## cli/ChatApp.tsx

*the chat screen*

```tsx:lines
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
      case "tool_result":
        add({ kind: "info", text: `[${event.name}] ${event.text}` });
        break;
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
```

## cli/LoginApp.tsx

*the login wizard*

```tsx:lines
// LoginApp.tsx - connecting a model: ChatGPT account, API key, or local model.
//
// A small wizard. Each screen is one "step"; choosing something moves to the next.
// Nothing is saved until the connection has been tested (by listing the models).

import { useEffect, useRef, useState } from "react";
import { Box, Text, useApp, useInput, useStdout } from "ink";
import { PRESETS, getPreset } from "@tygig/ai";
import { markWelcomed, signInWithChatGPT, updateCredentials } from "@tygig/auth";
import { Picker, Prompt, Spinner } from "@tygig/ui";
import { readConfig, writeConfig } from "./config.js";
import { connect, keySlot } from "./connect.js";
import type { Draft } from "./connect.js";
import type { Paths } from "./paths.js";

interface LoginAppProps {
  paths: Paths;
  result: { saved: boolean };   // read by main.tsx afterwards
}

type Step =
  | { name: "method" }
  | { name: "chatgpt" }
  | { name: "welcome" }
  | { name: "api-provider" }
  | { name: "local-provider" }
  | { name: "address"; presetId: string; back: Step; error?: string }
  | { name: "key"; presetId: string; baseUrl?: string; back: Step; error?: string }
  | { name: "checking"; label: string }
  | { name: "model"; draft: Draft; models: string[]; note?: string }
  | { name: "failed"; message: string; hint: string; back: Step }
  | { name: "done"; text: string };

/** What to do when a local server has no models yet. */
const NO_MODELS: Record<string, string> = {
  ollama: "No models found. Download one first, e.g.: ollama pull llama3.2  (then press Esc and try again)",
  lmstudio: "No models found. In LM Studio, download and load a model first (then press Esc and try again).",
};

export function LoginApp({ paths, result }: LoginAppProps) {
  const { exit } = useApp();
  const { write } = useStdout();
  const [step, setStep] = useState<Step>({ name: "method" });
  const [text, setText] = useState("");                 // the address or key being typed
  const abortRef = useRef<AbortController | undefined>(undefined);

  // Leave once the final message has been drawn. If the wizard closes early
  // (Ctrl+C), stop a ChatGPT sign-in that is still waiting for the browser.
  useEffect(() => { if (step.name === "done") exit(); }, [step, exit]);
  useEffect(() => () => abortRef.current?.abort(), []);

  // Esc: cancel the ChatGPT sign-in, or go back one step.
  useInput((_input, key) => {
    if (!key.escape) return;
    if (step.name === "chatgpt") abortRef.current?.abort();
    if (step.name === "address" || step.name === "key" || step.name === "failed") { setText(""); setStep(step.back); }
  }, { isActive: ["chatgpt", "address", "key", "failed"].includes(step.name) });

  const fail = (err: any, back: Step) =>
    setStep({ name: "failed", message: err?.message ?? String(err),
              hint: err?.hint ?? "Press Esc to go back and try again.", back });

  // --- Sign in with ChatGPT ------------------------------------------------
  async function startChatGPT() {
    const abort = new AbortController();
    abortRef.current = abort;
    setStep({ name: "chatgpt" });
    try {
      const signIn = await signInWithChatGPT(paths.credentials, (url) => {
        // Printed once, above the wizard, so it can be copied in one piece.
        write(`\nIf your browser did not open, copy this address into it:\n\n${url}\n\n`);
      }, abort.signal);
      if (!signIn.planUsage) {
        fail({ message: "You signed in, but did not allow Tygig to use your ChatGPT plan.",
               hint: "Press Esc, then sign in again and allow it, or choose API key." }, { name: "method" });
      } else if (signIn.firstTime) {
        setStep({ name: "welcome" });           // OpenAI asks apps to show this once
      } else {
        await check({ provider: "chatgpt" }, { name: "method" });
      }
    } catch (err) {
      fail(err, { name: "method" });
    }
  }

  // --- Test the connection by listing the models, then save the key ---------
  async function check(draft: Draft, back: Step) {
    setStep({ name: "checking", label: `Connecting to ${getPreset(draft.provider).label}` });
    try {
      const connected = await connect(draft, paths);
      let models: string[] = [];
      let note: string | undefined;
      try {
        models = await connected.provider.listModels();
        if (models.length === 0) note = NO_MODELS[draft.provider] ?? "The provider listed no models. Type the model name.";
      } catch (err: any) {
        // Some servers cannot list models but can still answer. Anything else is a real failure.
        if (err.status !== 404 && err.status !== 405) throw err;
        note = "This provider does not list its models. Type the model name.";
      }
      const slot = keySlot(draft.provider, draft.baseUrl);
      if (draft.apiKey) {                       // a typed key works: keep it
        await updateCredentials(paths.credentials, (c) => { c.apiKeys[slot] = draft.apiKey!; });
      } else if (draft.keySource === "env") {   // use the environment from now on: forget an old stored key
        await updateCredentials(paths.credentials, (c) => { delete c.apiKeys[slot]; });
      }
      setStep({ name: "model", draft: { ...draft, apiKey: undefined, keySource: undefined }, models, note });
    } catch (err) {
      fail(err, back);
    }
  }

  async function saveModel(draft: Draft, model: string) {
    try {
      // Keep settings you may have added by hand (maxTokens, stepLimit) when the provider stays the same.
      const old = await readConfig(paths.config);
      const kept = old && old.provider === draft.provider ? old : {};
      const config = { ...kept, provider: draft.provider, model, baseUrl: draft.baseUrl };
      if (!config.baseUrl) delete config.baseUrl;
      await writeConfig(paths.config, config);
      result.saved = true;
      setStep({ name: "done", text: `Connected: ${getPreset(draft.provider).label} · ${model}` });
    } catch (err) {
      fail(err, { name: "method" });
    }
  }

  // --- The screens --------------------------------------------------------
  switch (step.name) {
    case "method":
      return (
        <Picker key="method" title="How do you want to connect a model?"
          items={[
            { label: "Continue with ChatGPT", value: "chatgpt", hint: "use your ChatGPT plan (Go, Plus, Pro)" },
            { label: "API key", value: "api", hint: "OpenAI, Anthropic, OpenRouter, Gemini and more" },
            { label: "Local model", value: "local", hint: "Ollama or LM Studio on this computer" },
          ]}
          onSelect={(v) => {
            if (v === "chatgpt") void startChatGPT();
            else setStep(v === "api" ? { name: "api-provider" } : { name: "local-provider" });
          }}
          onCancel={() => exit()} />
      );

    case "chatgpt":
      return (
        <Box flexDirection="column" marginTop={1}>
          <Spinner label="Waiting for you to sign in to ChatGPT in your browser…" />
          <Text dimColor>Esc cancels.</Text>
        </Box>
      );

    case "welcome":
      return (
        <Box flexDirection="column" marginTop={1}>
          <Text bold color="green">You’re using your ChatGPT plan</Text>
          <Text>Requests from Tygig count towards your ChatGPT plan’s usage.</Text>
          <Text dimColor>Manage usage: ChatGPT &gt; Settings &gt; Usage (you can set a weekly limit for Tygig).</Text>
          <Picker key="welcome" title="" items={[{ label: "Got it", value: "ok" }]}
            onSelect={() => {
              markWelcomed(paths.credentials)
                .then(() => check({ provider: "chatgpt" }, { name: "method" }))
                .catch((err) => fail(err, { name: "method" }));
            }} />
        </Box>
      );

    case "api-provider":
      return (
        <Picker key="api-provider" title="Which provider is your API key for?"
          items={PRESETS.filter((p) => p.kind === "api").map((p) => ({
            label: p.label, value: p.id,
            hint: p.keyEnv && process.env[p.keyEnv] ? `key found in ${p.keyEnv}` : undefined,
          }))}
          onSelect={(id) => {
            setText("");
            const back: Step = { name: "api-provider" };
            setStep(getPreset(id).baseUrl ? { name: "key", presetId: id, back } : { name: "address", presetId: id, back });
          }}
          onCancel={() => setStep({ name: "method" })} />
      );

    case "local-provider":
      return (
        <Picker key="local-provider" title="Which program runs your model?"
          items={PRESETS.filter((p) => p.kind === "local").map((p) => ({
            label: p.label, value: p.id, hint: p.baseUrl || "you type the address",
          }))}
          onSelect={(id) => {
            setText("");
            const back: Step = { name: "local-provider" };
            if (getPreset(id).baseUrl) void check({ provider: id }, back);
            else setStep({ name: "address", presetId: id, back });
          }}
          onCancel={() => setStep({ name: "method" })} />
      );

    case "address":
      return (
        <Box flexDirection="column" marginTop={1}>
          <Text>The server’s address: the part before “/chat/completions”, usually ending in /v1.</Text>
          <Text dimColor>Example: https://api.example.com/v1   ·   Esc goes back</Text>
          {step.error && <Text color="red">{step.error}</Text>}
          <Prompt label="Address:" value={text} onChange={setText}
            onSubmit={(value) => {
              // Accept a full endpoint address too: remove the endpoint part and any final "/".
              const address = value.trim().replace(/\/(chat\/completions|responses|messages|models)\/?$/, "").replace(/\/+$/, "");
              if (!/^https?:\/\/[^\s/]+/.test(address)) {
                setStep({ ...step, error: "That is not an address. It must start with http:// or https://" });
                return;
              }
              setText("");
              const id = step.presetId;
              if (getPreset(id).kind === "local") void check({ provider: id, baseUrl: address }, step);
              else setStep({ name: "key", presetId: id, baseUrl: address, back: step });
            }} />
        </Box>
      );

    case "key": {
      const preset = getPreset(step.presetId);
      const envKey = preset.keyEnv ? process.env[preset.keyEnv] : undefined;
      return (
        <Box flexDirection="column" marginTop={1}>
          <Text>Paste your {preset.label} API key and press Enter.</Text>
          {preset.keyUrl && <Text dimColor>Get one at: {preset.keyUrl}</Text>}
          {envKey && <Text dimColor>Or press Enter with nothing typed to use the key in {preset.keyEnv}.</Text>}
          {preset.id === "custom" && <Text dimColor>If this server needs no key, press Enter with nothing typed.</Text>}
          <Text dimColor>The key is stored only on this computer, in {paths.credentials}   ·   Esc goes back</Text>
          {step.error && <Text color="red">{step.error}</Text>}
          <Prompt label="Key:" value={text} onChange={setText} secret
            onSubmit={(value) => {
              const key = value.trim();
              if (!key && !envKey && preset.id !== "custom") {
                setStep({ ...step, error: "A key is needed." });
                return;
              }
              setText("");
              const draft: Draft = key ? { provider: preset.id, baseUrl: step.baseUrl, apiKey: key }
                                 : envKey ? { provider: preset.id, baseUrl: step.baseUrl, keySource: "env" }
                                 : { provider: preset.id, baseUrl: step.baseUrl };
              void check(draft, step);
            }} />
        </Box>
      );
    }

    case "checking":
      return <Box marginTop={1}><Spinner label={step.label} /></Box>;

    case "model":
      return (
        <Box flexDirection="column">
          {step.note && <Text color="yellow">{step.note}</Text>}
          <Picker key="model" title="Choose a model (type to filter)" allowCustom
            items={step.models.map((m) => ({ label: m, value: m }))}
            onSelect={(m) => void saveModel(step.draft, m)}
            onCancel={() => setStep({ name: "method" })} />
        </Box>
      );

    case "failed":
      return (
        <Box flexDirection="column" marginTop={1}>
          <Text color="red">✗ {step.message}</Text>
          <Text dimColor>  {step.hint}</Text>
          <Text dimColor>  Esc goes back · Ctrl+C quits</Text>
        </Box>
      );

    case "done":
      return <Box marginTop={1}><Text color="green">✓ {step.text}</Text></Box>;
  }
}
```
