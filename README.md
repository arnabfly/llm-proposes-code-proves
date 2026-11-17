# AI for Meta-Science Hackathon: claim-evidence verification

**The LLM proposes, code proves.** This tool checks the claims in a research paper against the paper's own tables.
A language model reads the LaTeX source, finds each claim and cites its evidence by ID (a sentence `S12` or a table
cell `T2.r13.c13`). Plain code then decides: the evidence must exist, every number in the claim must appear in a cited
table cell, stated differences must recompute, and comparisons must point the right way. The label (Supported,
Unsupported or Unverified) comes from the code, never from the model, and each label lists where every number was
found. The result is a claim map for the authors, written before submission.

The tool is built on [Tygig](#tygig), an open-source TypeScript agent harness. For now the review tools are built into
the `tygig` command; later they will become a Tygig plugin.

Results on 24 claims from 9 recent arXiv papers, with introduced errors (gpt-4.1-mini, 3 runs per version):

| Measure | LLM alone | Strict instructions | LLM with checks |
|---|---|---|---|
| False acceptance (introduced errors labelled Supported; lower is better) | 99.4% (158/159) | 64.8% (103/159) | **6.3% (10/159)** |
| Recall (correct claims labelled Supported; higher is better) | 100.0% (72/72) | 86.1% (62/72) | 15.3% (11/72) |

![Figure 2: share of runs labelled Supported, by version type](hackathon/figs/fig2-by-fault.png)

**Figure 2.** Share of runs labelled Supported, by version type. On clean versions, higher is better; on versions
with an introduced error, lower is better.

### Quick start

You need [Node.js](https://nodejs.org) 22 or newer and [Git](https://git-scm.com). The commands below are for Windows
PowerShell; on macOS and Linux, write `/` instead of `\` in paths.

**Install** (once):

```powershell
git clone https://github.com/arnabfly/llm-proposes-code-proves.git
cd llm-proposes-code-proves
npm install
npm link             # installs two commands: tygig (the review tool) and tygig-bench (the benchmark)
npm test             # optional: 170 tests, no model or key needed
cd ..
```

Then choose one of the three paths below.

#### A. Check our numbers (free: no API key, no model calls)

```powershell
mkdir check-results
cd check-results
tygig-bench setup --from ..\llm-proposes-code-proves\hackathon\results
tygig-bench plant
tygig-bench metrics
```

- `setup` downloads the 9 papers' LaTeX source from arXiv and checks that they are exactly the files we used (SHA-256).
- `plant` makes the 77 versions again: the original claims and the versions with an introduced error.
- `metrics` recomputes every number from our 693 recorded runs and writes `benchmark\results\summary.md`. It should
  match [`hackathon/results/summary.md`](hackathon/results/summary.md), apart from the date.

#### B. Review a paper yourself (needs an API key)

```powershell
tygig login
```

Choose **API key**, then **OpenAI**, paste your key, and pick **gpt-4.1-mini** (the model we used). Other providers
work too. The key is stored in your home folder (`~/.tygig`), never in the project.

**Using Berget AI (EU-hosted models).** Run `tygig login` and:

1. Choose **API key**, then **Other (OpenAI-compatible)**.
2. Address: `https://api.berget.ai/v1`
3. Paste your Berget API key.
4. Pick a model with tool calling, for example `mistralai/Mistral-Small-3.2-24B-Instruct-2506`.

For the benchmark, give the same model name with `--model`, for example
`tygig-bench run --mode on --model mistralai/Mistral-Small-3.2-24B-Instruct-2506`.

Then:

```powershell
mkdir my-review
cd my-review
tygig-bench get-paper --arxiv 2611.16104v1
tygig
```

`get-paper` downloads the LaTeX source of any arXiv paper (here Fikiria) into `my-review\paper`. You can also copy your
own paper's LaTeX folder there. In the chat, type:

```
Review the paper in the folder paper.
```

When it is done, `paper\claim-map.md` lists each claim the tool found, with its label, its evidence and the result of
each check.
Type `/quit` to leave.

#### C. Run the whole benchmark again (needs an API key)

```powershell
mkdir rerun
cd rerun
tygig-bench setup --from ..\llm-proposes-code-proves\hackathon\results --no-runs
tygig-bench plant
tygig-bench run --mode on --model gpt-4.1-mini --concurrency 2
tygig-bench run --mode off --model gpt-4.1-mini --concurrency 2
tygig-bench run --mode strict --model gpt-4.1-mini --concurrency 2
tygig-bench metrics
```

This makes 693 runs and sends about 43 million input tokens in total. A run that stops can be started again: finished
runs are kept. The model does not give the same answer every time, so the numbers will differ slightly from ours.
More options are in [`evals/README.md`](evals/README.md).

### Limitations

- **Numbers, not meaning.** The checks confirm that a cited cell holds the claimed number, not that it is the right
  cell for the claim. This causes most remaining false acceptances.
- **A strict rule.** A number that appears only in the text is not accepted as evidence, so many correct claims are
  Unverified and recall is low (15.3%).
- **Small scope.** One model, 9 machine learning papers, 24 claims, LaTeX only, no figures, and no errors that reverse
  a comparison.
- **Artificial errors.** The errors were introduced by code and may differ from real ones. The supporting cells of the
  24 claims were checked by code, not confirmed by a person.

**Report:** [`hackathon/claim-evidence-checks-report.pdf`](hackathon/claim-evidence-checks-report.pdf)

**Video:** (link to be added)

**Licence:** Apache-2.0 (see `LICENSE`). Paper sources are not included: they belong to their authors and are
rebuilt from their arXiv IDs. Session logs are not included either, because they contain paper text.

---

The rest of this file is the README of Tygig, the harness this tool runs on. If you followed the Quick start above,
`tygig` is already installed: skip the install steps below.

# Tygig

*An agent harness where every action is permitted and proven.*

This is the **base harness**: model access, the agent loop, a terminal interface,
sign-in and saved conversations. It has no tools, plugins or skills yet, so it can
only talk. Those come next, on top of this base.

The full guide, with step-by-step traces of how the code runs, is in
`docs/tygig-base-guide.pdf` (and `.md`).

## Requirements

- Node.js 22 or newer (`node --version`)
- One of: a ChatGPT account (Go, Plus or Pro), an API key, or a local model (Ollama, LM Studio)

## Install and run

```powershell
npm install          # once, in this folder
npm test             # optional: 54 automated tests against a fake provider
npm start            # chat (logs in first if needed)
```

To use the `tygig` command in any folder:

```powershell
cd packages\cli
npm link
cd "C:\path\to\your\project"
tygig
```

## Connecting a model

`tygig login` offers three ways:

| Way | Providers |
|---|---|
| Continue with ChatGPT | your ChatGPT plan, through your browser |
| API key | OpenAI, Anthropic, OpenRouter, Google Gemini, DeepSeek, Mistral, Groq, xAI, Together AI, any OpenAI-compatible server |
| Local model | Ollama, LM Studio, any local OpenAI-compatible server |

Anthropic does not allow Claude subscription logins in other tools. For Claude models,
use an Anthropic API key or OpenRouter.

## Commands

```
tygig            chat in the current folder
tygig login      connect a provider or account
tygig logout     disconnect and remove the stored key or sign-in
tygig logout --all  remove every stored key and sign-in (switch ChatGPT account)
tygig sessions   list saved conversations for this folder
tygig help       show help
```

Inside a chat: `/model`, `/resume`, `/new`, `/login`, `/help`, `/quit`. Esc interrupts an answer.

## Where your data is stored

Everything lives in `~/.tygig` (on Windows `C:\Users\<you>\.tygig`), never in your project:

```
config.json          provider and model
credentials.json     keys and sign-in tokens
projects\<folder>\   saved conversations, one JSON Lines file each
```

## Structure

```
packages/
  core/    shared types: messages, provider shape, events
  ai/      translators: OpenAI chat, OpenAI Responses, Anthropic
  auth/    stored keys, Sign in with ChatGPT
  agent/   the loop and the session log
  ui/      terminal building blocks (Ink)
  cli/     the tygig command: screens, settings, wiring
test/      automated tests and a fake provider
```

## Licence

Apache-2.0. See `LICENSE`.
