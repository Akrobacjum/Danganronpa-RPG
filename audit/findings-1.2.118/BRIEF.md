# The readers' brief (from 20.11.2026, the resumed audit)

Every reader of the resumed audit gets this file and one paragraph naming its scope. The readers that wrote
the first 28 files had their own prompts, which are not on the branch; this brief is written to the shape of
those files, so a new file reads like an old one of its lane. The method and vocabulary are
`audit/AUDIT-1.2.42.md` section 11 (read 11.2-11.5 before starting).

## What a reader is

- Checkout: branch `claude/audit-119`; the code under audit is `main` at `b5a29e73` (1.2.118). The branch adds
  only files under `audit/`, so `scripts/`, `lang/`, `styles/`, `tools/`, `docs/` read the same as on `b5a29e73`.
- A reader reads and writes **one file**: `audit/findings-1.2.118/<reader-id>.json`. It writes nothing else, edits
  nothing, commits nothing, pushes nothing. It does not run the harness, the suite, a scenario, a probe or
  `npm`. Plain reading tools, `git grep`/`git log`/`git show`, and short read-only scripts (`python3`, `node -e`
  over source text) are fine. Scratch files go under `/tmp`, never the repository.
- The base run (one `npm test` on `b5a29e73`, run centrally) is written to `audit/findings-1.2.118/base-run.json`
  when it ends. If that file exists when you look, cite the result of a test or scenario from it. If not, name the
  test from its source and say its result was not read; never claim a pass.
- Language: English, plain. Dashes are `-` only (never U+2013, U+2014 or U+2212). Keep to the plain vocabulary of `CLAUDE.md`'s trust model (the seven words to avoid are listed in your
  prompt; write "a console write", "a player's own client", "goes around the check" instead). Do not name any AI model.

## The rules of evidence (section 11.3)

- Every claim carries a place: `file:line` on today's source, a test name (R number or the tier-2 title), a
  scenario, or a commit. Quote the code for every finding (a few lines, in `evidence`).
- `evidence_class`: H harness run (only from base-run.json or a probe file), C Chromium, F a recorded reading on
  real Foundry (docs/dev/e58/LOCAL-REPORT.md, docs/dev/e39/CALIBRATION.md, other papers with a date), S static
  reading of today's source, K a commit or a stage paper.
- `confidence`: `measured` (H/C/F), `read` (the whole road traced in source), `suspected` (part of the road:
  this is a question, not a finding; put it under `not_established` or mark it so).
- `severity`: `blocker` (breaks a campaign or gives the answer away), `major` (breaks a rule, a session or the
  GM's work in an ordinary situation), `minor` (wrong in a particular situation), `nit` (dirt, text, cosmetics);
  for an old item that no longer applies, `none`. Each finding has a one-sentence `failure_scenario`: who does
  what and sees what.
- **U1, in the reader.** Before writing a finding, try to refute it: find the real caller, a real input, a guard
  elsewhere, a test that pins the opposite. Write what you tried in `refutation_tried`. If it falls, do not write
  it as a finding; if a doubt remains, `confidence: "suspected"`. A second reader will try again later.
- **U9.** Your file says how much you read (files and lines, items, windows, controls). A count that does not
  match the list you were given is said in a `count_note`, not hidden.
- **Measure, then say.** What cannot be settled from source goes under `not_established`, with the live check
  (an existing LIVE id, or "new live check: ...") that would settle it.
- Findings only. No fix code. A short `expected` (what it should do) is fine.

## The shape of each lane's file

Look at one existing file of your lane before you start and match its keys. In short:

- **old-*** (`old-1.2.42-core.json` is the model): `reader`, `source`, `read` [{file, lines, of, how}],
  `count_expected`, `count_note`, `items` [{id, title, old_severity, old_state, status (fixed|partly|open|obsolete),
  evidence_class, evidence, pinned_by, still_wrong, severity_now, confidence, refutation_tried}],
  `new_observations` [{title, where, what, severity, failure_scenario, confidence}], `not_established`.
- **live-items-NN** (`live-items-06.json`): `reader`, `lines`, `count_expected`, `items` [{n, live_id, stage,
  asks, status (read|open|partly|obsolete), result (agrees|defect|n/a), evidence, triage_class, subject_exists,
  text_stale, stale_detail, duplicate_of, headless_half, note}], `observations`. Read `live-readings-e58.json`
  and `live-readings-other.json` first: they hold every recorded reading on a real Foundry; an item is `read`
  only when one of them (or a dated paper) records the reading. `triage_class` as in live-items-01.json.
- **stages-NN** (`stages-25.json`): `reader`, `checkout`, `stages` [{id, version, shipped, what, claim_sources,
  commits, promises [{promise, source, code, holds (yes|partly|no|unread), test, test_kind, note}],
  registry_rows, tests_read [{test, measures, why}], tests_to_join, scenarios, live, findings, superseded_by,
  grade (0-10 or "not graded"), grade_reasons, missing_to_10}], `not_established`. Grade by section 11.4,
  including its two caps. A stage's papers: `tools/stages.json` (its row), `docs/dev/<stage, lower case>/`,
  `.github/release-notes/v<version>.md`, the registry (`docs/dev/R-REGISTRY.md`, `node tools/registry.mjs`
  read-only), commits (`git log --grep`), and 9.2 rows naming the stage.
- **domain-*** (`domain-case-b-traces.json`): `reader`, `files_read` [{file, lines}] (each read whole, start to
  end), `neighbours_followed`, `strengths`, `findings` [{id "<reader>-N", domain, severity, category (leak, bug,
  flow, ux, text, perf, hygiene), title, where, what_happens, evidence, failure_scenario, expected, confidence,
  refutation_tried, old_id (when it is an old finding of 1.1.88/1.2.13/1.2.42 still standing)}],
  `by_decision` (looks wrong but is a recorded decision: say where), `comments_against_code` [{where,
  comment_says, code_does}], `hygiene` {functions_over_300, functions_150_to_300, duplicated_helpers, dead_code,
  magic_numbers, ...}, `hints_for_other_passes` {dead_controls, stale_windows, ...}, `not_established`.
- **controls-NN** (`controls-03-investigation-planner.json`): `reader`, `read`, `surfaces` [{surface, file,
  opener, audience, controls [{label, key, kind, selector, handler, effect, gate, how_read, themes, verdict, detail}],
  refresh}], `counts` {surfaces, controls, ok, dead, throws, mislabeled, wrong_audience, silent, stale_state,
  unknown}, `findings` [{id, severity, verdict, title, surface, control, where, what_happens, evidence,
  failure_scenario, expected, confidence, refutation_tried, probe}], `not_established`.
  **New in the resumed lane:** each surface also has `refresh` {reads: [every store, setting, flag, document or
  socket the drawn window shows], listens: [every hook, setting change, socket, `keepLive` source that redraws
  it], verdict: live | partial | stale | n/a, gaps: [a source read but not listened to, with file:line],
  focus_rule: what happens to a field being typed in}. The owner's standing rule (20.11.2026): "Zawsze
  odswiezamy okna od razu przy zmianie" - windows redraw at once when what they show changes. A window that
  shows a stale value until reopened, that redraws only after focus leaves a field, or that redraws on some of
  its sources but not others, is a finding (`verdict: "stale_state"`), with the change that shows it (another
  GM, a player, a socket, a token or scene change).
  Verdicts for a control: ok, dead (does nothing), throws, mislabeled (does other than its label), wrong_audience
  (shown to someone who cannot use it), silent (works but says nothing when it refuses or fails), stale_state,
  unknown. Themes: check `styles/*.css` by script for a rule that hides or disables the control under one theme
  (`body.drpg-theme-stained-glass` and the default) or the narrow layout.
  The probe `audit/harness/probes/42-press-controls.mjs` and `43-stale-windows.mjs` are run centrally; if
  `audit/findings-1.2.118/probe-42.json` / `probe-43.json` exist, use their rows for your windows.

## Where things are

- The window list: `docs/dev/e59/WINDOWS.md` (162 windows in 165 sites; kit windows only - the HUD, the sheet
  additions and chat cards are not in it, find them in the code).
- `keepLive` and the redraw machinery: `scripts/live.mjs`; the kit: `scripts/ui-kit.mjs`.
- The old audits: `audit/AUDIT-1.1.88.md`, `audit/AUDIT-1.2.13.md` (read only), `audit/AUDIT-1.2.42.md` part II
  (sections 0-9), `audit/findings-1.2.42/*.md`, `audit/findings/LIVE-findings.md`.
- The real-Foundry readings: `docs/dev/e58/LOCAL-REPORT.md`, `docs/dev/e39/CALIBRATION.md`, digested in
  `live-readings-*.json` here.
- The texts: `docs/text-style.md`, `docs/glossary.json`, `lang/en.json`, `lang/pl.json`.

## The return

Your last message is a short summary (under 200 words): the file written, how much was read, the counts of
findings by severity, and anything you could not do. The file is what counts.
