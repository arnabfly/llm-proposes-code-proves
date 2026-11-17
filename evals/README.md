# evals: the claim-verification benchmark

The review code is frozen. This benchmark measures it: checks on (labels from code) against checks off
(the model's own labels), on new papers only. LoRA and ordinalY are the development set and are not used.

## How it works

The program stays in its own folder. You run `tygig-bench` in your work folder, like `tygig`:
your papers stay where they are, and everything the benchmark makes goes into a `benchmark` folder there.

Install once, in the program's folder:

```powershell
cd "C:\path\to\tygig"
npm link
```

Then, in your work folder:

| Step | Command | Output (in .\benchmark) |
|---|---|---|
| 1. Full review | `tygig-bench full-review --paper papers\paper1 --mode on --arxiv 2611.16264v1 --model gpt-4.1` | `papers.json`, `full\paper1\on\` |
| 2. Candidates | `tygig-bench targets` | `targets.candidates.json` (and `targets.candidates.labels.json`) |
| 3. Confirm | pick up to 3 per paper, check the cells, set `"confirmed": true`, save as `targets.json` | |
| 4. Plant faults | `tygig-bench plant` (add `--f5` for F5) | `versions\<versionId>\src\`, `versions\manifest.json` |
| 5. Run | `tygig-bench run --mode on --runs 3 --model gpt-4.1 --concurrency 4`, then `--mode off` | `results\<mode>\<versionId>\run<k>.json` |
| 6. Metrics | `tygig-bench metrics` | `results\metrics.json`, `results\summary.md` |

To check or repeat our benchmark instead of making a new one, see "Rebuilding the benchmark on another computer" below.

- `--paper` is the folder with the paper's LaTeX source. Its name (here `paper1`) is the paper's ID, unless `--id` is given.
- `papers.json` records each paper's folder, arXiv ID and a SHA-256 hash of its files. `targets` and `plant`
  stop with a clear message if the paper changed after its full review. The `claim-map` files that `tygig`
  writes into a paper folder are not part of the hash.
- A **development paper** (`--dev` on `full-review`, or `tygig-bench set-paper --id <ID> --dev true`) is one the checks
  or the planting were tuned on. `metrics` leaves it out of the headline numbers and reports it apart.
- **Code version:** every full review and run saves the program's Git commit and whether it had uncommitted
  changes (`code` in `run.json` / `run<k>.json`). `metrics` lists the commits used and warns if runs come from
  different commits, from uncommitted code, or from a folder that is not a Git repository. Commit and tag the
  program (e.g. `benchmark-v1`) before the benchmark.
- **Blind target selection:** `targets` lists every claim with numbers from the full reviews of the benchmark
  papers, whatever the tool's label, with the claim's numbers and the cited evidence cells (value, row and column
  labels). The tool's labels and check results go to `targets.candidates.labels.json`, which is not opened until
  the runs are done. For each chosen claim: correct `evidenceIds` to the cells checked by hand in the table, add
  `comparisons` (`ours`, `baseline`, `higher_is_better`) for a comparison claim (otherwise F3 is skipped), and set
  `confirmed: true`. `plant` uses those cells; the manifest keeps the `selection` note.
- `metrics` also reports false alarms (clean runs labelled Unsupported) and lists every clean run that is not
  Supported, with its C2 and C3 reasons (failure analysis).
- **Modes:** `on` (labels from the code checks), `off` (checks off, the model's own label), and `strict`
  (checks off, and `evals/prompts/strict.md` is added to the task prompt: the model is told to apply the same
  rule the code applies). The strict prompt was fixed before any run; every strict run saves its SHA-256 hash.
  `metrics` shows one column per mode.
- `run` skips runs that already have a result, so it can be stopped and started again.
  `--only <versionId or paper ID>` limits it (used for the pilot).

Faults: clean (no change), F1 (cited cell number changed), F2 (claim number changed), F3 (ours and baseline
swapped), F4 (cited cell replaced by `--`), F5 (optional: "comparable" made "significantly better").
F1 and F4 change every table cell that holds the target number in the same column (the same result is often
in two tables, e.g. both "AVG"); afterwards the old number must be in no cell of that column. Every changed cell
is listed in the manifest (`cells`: ID, old text, new text). Every planted version is parsed again; a version that does not change exactly the intended thing is
listed with `valid: false` and is not run.

## Rebuilding the benchmark on another computer

The published benchmark (`hackathon/results` in the repository) holds `papers.json`, `targets.json`, the manifest,
the metrics and the recorded runs (`runs.json`: every run's result, without the session logs, which contain
paper text). In an empty work folder:

```powershell
tygig-bench setup --from <repository>\hackathon\results     # add --no-runs to run everything again yourself
tygig-bench plant
tygig-bench metrics                                          # or first: tygig-bench run --mode on|off|strict ...
```

`setup` downloads each paper's TeX source from arXiv by its versioned ID (`https://arxiv.org/src/<id>`) into
`papers\<name>`, unpacks it (in Node.js; no other program needed) and checks the hash against `papers.json`: a
different download is refused. It writes `benchmark\papers.json` and `benchmark\targets.json` and copies the recorded
runs into `benchmark\results`. No new full review is needed: the saved `targets.json` fixes the claims (a new full
review would find different ones). With the recorded runs, `metrics` recomputes the published numbers without any
model call.

`tygig-bench get-paper --arxiv <id> [--to <folder>]` downloads one paper the same way (default folder `paper`).
