# E57 - Texts and handbooks after all stages: the plan

Preparation only (the e57-prep work line, 12-13.11.2026), as prep-54 prepared E54-E56. Nothing here changes code, a
lang file or a handbook. Read at `origin/main` = `421f2395` (1.2.109). E57 is the stage after E25, E71 and E91
(`tools/stages.json` row E57, `planned` 1.2.124, information only), so every count below is to be taken again in C0
at the stage's base. The stage's definition is the planning line's `docs/dev/plans/E57.md` (on `plan-130`,
written 12.11.2026 at ff11458); this file does not repeat it. It adds what measuring main found, which changes its
shape, and lays the commits out with their red tests and what each waits for.

The two measurements are in this directory, each with its method and its limits:

- `MEASURE-numbers.md` - every rule number in the six handbooks against config.mjs and the code that applies it.
- `MEASURE-coverage.md` - (A) the UI names the handbooks do not name, (B) the controls with no tooltip, hint or help.

## 1. What the stage is (from the planning line's E57.md, short)

Done when (the audit's `doneWhen`): "every UI text and every number in the handbooks agrees with the code and
config.mjs, the handbooks describe the outgoing module, and the text guards are in the release gate." Its parts: D34
(the world's document language), D35 (a "?" in seven GM windows and the dashboard tabs that opens the handbook on its
section), the guards (stale-pl in the gate with `lang/pl.reviewed.json`, the glossary and forbidden forms FAIL for the
handbooks, handbook pairs, UI names in the handbooks, rules-parity), the window registry in both languages and a
mixed-language scenario, the handbooks rewritten in form from a facts inventory (EN, then PL from the facts), and a
last pass (stale-pl `--sheet`, a cold read by a fresh agent, `--stamp`).

Boundary, as E25.md section 3 and E71.md section 3 set it (one key changes once):

| Text | E25 (1.2.121) | E71 (1.2.122) | E57 |
| --- | --- | --- | --- |
| A handbook sentence that contradicts the code | fixes it, minimal edit, EN and PL on the same line (C6) | - | inventories it as a fact, then rewrites the form |
| A handbook's form, length, appendix, PL from facts | - | - | does |
| A UI key | fact faults (C3-C5) | style (batches) | only the keys D34 and D35 add |
| A handbook sentence naming a renamed button | - | - | made to match E71's button, never the reverse |

The texts line's early pass (`texts-e71`, `docs/dev/e71/STATUS.md`, 29 commits on 12.11) already changed
handbook lines in unfrozen sections (spelling, Remnant, GM-a, T29 cuts: 210 lines on the added side, `git diff --numstat` from its merge base) and hands E57 one item by name:
the GM handbook's source-file lists at the head of sections 6.3, 12, 13 and 19, which T29 would move to M10's appendix
("a structural move of the handbook: E57's"). E57 starts from that line's result, not from main.

## 2. What measuring main found, before any commit

| # | Finding | Effect on the plan |
| --- | --- | --- |
| F1 | **The numbers already agree.** Of about 307 distinct rule numbers in the handbooks (981 digit tokens in the English three, plus number words), one disagrees for certain, two are marked unsure, 10 are uncheckable, about 294 agree. The EN and PL handbooks give the same number on every rule line: 2345 line pairs compared, 2 differ, neither a rule (MEASURE-numbers.md). | rules-parity (C2) is a guard against drift, not a repair: its first run should be green after one fix. Its fixtures carry the weight: a changed config number must turn it red. |
| F2 | **The one certain disagreement is a copy of computed text.** gm-handbook.en.md:686 / .pl.md:686: the trap card "advises ... four to six actions". The card is built by murder-ui.mjs `indirectCostText` (:884-895) and prints 4 to 5; its comment (:876-882) records that E66 C4 replaced "four to six". The table (`INDIRECT_MURDER`) never held either number, so a table-only parity check would not have seen it. Every open line that has the GM handbook still carries the old words: ten read, texts-e71 among them (`git show <line>:docs/handbooks/gm-handbook.en.md`, 13.11). | rules-parity reads the functions that compose a number shown to a reader, not only config tables (C2's list, section 4). The fix itself is E25 C6's by the boundary, or the texts line's now: Q-E57-7. |
| F3 | **Two unsure rows.** player-brochure.en.md:69 gives a trap's roll as "Eye vs 20"; config.mjs:3348-3349 `MURDER_OPENING.victim` has traits Eye and Head (the player and GM handbooks say both). player-handbook.en.md:869 says the curtain's colour arrives "within about a second"; the code is 1200 ms (motion.css:74, glass.mjs:3845) and gm-handbook.en.md:1133 says "about 1.2 seconds". | C6-C8 take both as facts. Whether "about a second" counts as a disagreement is the rounding rule of Q-E57-9. |
| F4 | **A config number with no reader yet.** config.mjs:4369 `CLEANUP.actions.moveBody.rooms.critical: 2`; on main cleanup.mjs `bodyDestinations` (:3403-3411) offers only the connected rooms, and the comment above (:4357-4361) says E64 makes it work. On `e64` cleanup.mjs reads it (E64 C4, `bodyLanding`). | Not a handbook fault. After E64 ships, the GM and player handbooks state the critical's two rooms (C6-C8 input). |
| F5 | **Numbers a reader meets that no handbook states:** `TIMING.friskForceMs` 30 s (config.mjs:401), `openingAttempts` 3 (:424), `plantWindowMs` 120 s (:370), `safewordRepeatMs` 60 s (:388), the Misleading Trail's Sanity refund on a critical (:4350), `MOOD_SHARES` 0.6 / 0.4 (:2058), the trial's text limits 200 / 200 / 80 / 120 (:3935-3976), the day boards' 5 s and 6 s stills under reduced motion (sequence.mjs:59, :61); the rest in MEASURE-numbers.md. All 25 `TIMING` entries and about 120 other fields were read. | Which of them a handbook states is Q-E57-10; the default puts the ones a reader waits on in the text, the internal ones in the appendix. |
| F6 | **UI names the handbooks do not name.** Of 310 named controls (39 setting names, 214 window titles, 28 buttons, 29 tabs; tooltips left to B), 183 are named in the English handbook of their reader and 178 in the Polish; 143 are missing in at least one language. Worst: player buttons 2 of 11, player window titles 48 of 103, GM window titles 20 of 36; GM buttons 16 of 17. The classification is the repository's own (by key name, text-budgets.json), so "window title" includes card headings and the button and tab counts are a floor (most footer buttons have no surface). 55 of the matches are one word ("Theme", "Fog") and weak. | The guard "UI names in the handbooks" (T10, if that is what T10 means: Q-E57-6) cannot be "every key named": most card headings need no mention. C0 fixes a hand-read list of the names that must be named; the guard holds that list and the reverse direction (every bold UI name in a handbook is a current value). |
| F7 | **No contextual help exists, and the kit has no place for it.** No "?" anywhere (no `fa-question` / `fa-circle-question` in scripts/). `openHandbooks(book)` (handbooks.mjs:355) takes a book, not a section; its one caller is the corner launcher (:389). The handbook's headings get no ids on purpose (`noHeaderId: true`, handbooks.mjs:185: a heading id could clash with Foundry's own). Of 542 control sites in 82 files, 56 always carry a tooltip (10 of them only repeat the label), 4 only when disabled, 87 have a hint line, 395 have neither; tabs never take a tooltip in ui-kit.mjs (0 of 10 tab bars), toggles neither (0 of 5), and the footer's `tooltip:` option is used once (trial-floor-ui.mjs:1465). Settings are covered: 38 names, 38 hints, all shown. | D35 needs three pieces before any "?": a section anchor that is not an HTML id (C4a), `openHandbooks(book, { section })` with the contents scroll it already has (:313-333), and a kit option on `drpgWindow` / `DrpgApp` for the header's "?". Filling 395 sites with tooltips is new UI text and not E57's by the boundary: Q-E57-8. |
| F8 | **Guards today** (`node tools/check.mjs text` on main): FAIL - T1, T2, T3, T6 (dashes, also in docs), T14, T20, T28 (retired forms, also in docs). Report - T8 (glossary, reads docs: 3 handbook finds), T4, T5, T7 (rule numbers in words: reads lang only, not the handbooks), T11 and T12 (read docs), T13, T15-T19, T21-T25, T27. `handbook-facts.mjs` exists (split, check, count, prompt, self); `check.mjs text` splits each handbook pair and prints the ids, not red. Not built: `tools/stale-pl.mjs`, `lang/pl.reviewed.json`, `docs/handbook-facts.{en,pl}.json`, rules-parity, the mixed-language scenario. | C1's list stands as the planning line wrote it, with T7 extended to docs. |
| F9 | **T10 and T26 are named and defined nowhere in the repository.** The planning line's E57.md says "T10 and T26 written" and "T26 keeps their sections"; text-style.md, tests-text.mjs `MODES` and the plans on plan-130 hold no definition (`git grep` on main and plan-130, 12.11). T9 is stale-pl (E25.md C1). | Q-E57-6, with a default for each, until the audit's own text is found. |
| F10 | **D34's helper has no caller.** utils.mjs `worldLocalize` (:157) is called by no module file (tests only); settings.mjs registers `documentLanguage` with `config: false` and the empty choice "-" (:1512-1523); i18n.mjs `seedDocumentLanguage` (:144) writes it once on the primary GM. | C3 as planned: the sites (S02-74) are found in C0 by reading which world documents take `DRPG.Config.*` prose. |
| F11 | **The handbooks moved since ff11458** (the planning line's counts): GM 1385 lines (+59), player 882 (+19), brochure 78; sections 21 / 16 / 7; EN and PL equal in lines. Nine open lines change the handbooks (section 5). | Every count in C0, and the facts inventory only after the last of them merges. |

## 3. What E57 waits for

Read off the open lines on 12.11 (`git diff --name-only` from each line's merge base; the versions are the
coordinator's trains, which come before `tools/stages.json`'s `planned` values).

| Line | Train | Touches | E57's part that waits |
| --- | --- | --- | --- |
| `e93` (E93, E69, E74) | 1.2.111 | GM and player handbooks, lang, config.mjs, glossary | everything that reads a handbook or config.mjs (C0, C2, C6-C11) |
| `e100`, `e101` | 1.2.112 | GM handbook (and player handbook, text-style.md: e100), lang | the same |
| `e64`, `e64-inv` (E64) | after 1.2.112 | all six handbooks, lang, config.mjs, text-render.mjs | the same; F4's two rooms |
| `e72` (E72, E91) | later | all six handbooks, lang, config.mjs, glossary | the same; E91's texts |
| `e97-98`, `gaps-a`, `dh-212b` | their trains | GM handbook, lang | the facts of the sections they edit (section 20's contract rows among them) |
| `texts-e71` (early pass) | before E25 | all six handbooks, lang, glossary, text-style.md | E57's start: its result is the base |
| E54-E56 | 1.2.118-1.2.120 | file splits (names of files the GM handbook cites) | the source-file lists (C6); E56's comment gate is a check part beside C1's |
| E25, E71 | 1.2.121, 1.2.122 | stale-pl as a report (E25 C1), handbook contradictions (E25 C6-C7), the UI's final words (E71) | C1 (stale-pl to the gate), C6-C11 (UI names to match) |
| E62 C3 (the dead as Spectators) | after 1.2.112, another line builds it | a Sound row "Gaśnięcie", Spectator texts, a handbook sentence on the voice trade-off (STORYBOARD-C3.md) | C6-C11 take its sentences as facts; the "?" list, if a Spectator window is added |

What does not wait: this plan, Q-E57-6 to Q-E57-12, and C4a's anchor scheme (a design read off handbooks.mjs, which
no open line edits: `git diff` of every open line lists no scripts/handbooks.mjs, 13.11; ui-kit.mjs is edited by e101, so C4b waits).

## 4. Commits

R numbers are a count; the coordinator assigns them (`node tools/registry.mjs --next` reads R3917 on main, which
other lines have taken since). "Red first" means: the test is committed failing on the base, with its planted fixture,
then the commit that makes it green.

| Commit | What it changes | Tests (red first) | Waits for |
| --- | --- | --- | --- |
| **C0** spec and census | `docs/dev/e57/SPEC.md`: every count of section 2 taken again at the base; the S02-74 sites; the hand-read list of UI names that must be named (F6); the list of rules-parity's readers (C2); the features from E30-E99 to cover; `handbook-facts.mjs split` on the six files | none (0 R) | the base: E25, E71, E91 shipped, the texts line merged |
| **C1** guards | `tools/stale-pl.mjs` from E25's report to `--check` in the gate, `--sheet`, `--stamp` with `lang/pl.reviewed.json`; T8 and the forbidden forms FAIL for the handbooks; T7 reads the handbooks; T9 FAIL; T10 and T26 as Q-E57-6 decides; handbook pairs at paragraph level (Q-E57-1) | one per guard on a planted fixture: a Polish key whose English changed after its stamp; "GMa" in a handbook line; "two" for a rule number; a PL paragraph with an id the EN lacks; T10 and T26 each on a planted fault (4-6 R) | E25 C1 (stale-pl exists) |
| **C2** rules-parity | a tool and a check part: config.mjs's numbers (topic A, C, D, A10, A11, CRISIS_ACTIONS, Call costs, Rest, Palm, Frisk, Tamper, the E51 thresholds) found in digits in the handbook facts, and the numbers composed by code a reader sees - `indirectCostText` first (F2), each one named in a list, with the function called under the harness's shim | red: a fixture config with one number changed per table; and the trap card's "four to six" planted back in a fixture handbook (2-3 R) | C0's list; E64 (its numbers) |
| **C3** D34 | `documentLanguage` shown once the first document is written through it, its "-" named; the S02-74 sites through `worldLocalize`; world-secrets.mjs reads the new visibility | red: a document written in a world whose language differs from the page's comes out in the page's (2 R); scenarios 50-lang, 65-season | C0's sites |
| **C4a** the anchor | a section's anchor without an HTML id (F7): the "## N." numbers, shared by EN and PL, as a data attribute the handbook window reads; `openHandbooks(book, { section })` scrolling with the contents code it has; "section N" references made jumps | red: `openHandbooks("gm", { section: "9" })` lands on section 9 in both languages; a "section N" reference with no such section is listed (1-2 R) | nothing (handbooks.mjs is edited by no open line) |
| **C4b** the "?" | a header option in ui-kit.mjs (`help: { book, section }`) on `drpgWindow` and `DrpgApp`; the seven GM windows and the dashboard tabs (Q-E57-2) take it; R111 extended to every "?" and every jump; the tooltip option for tabs and toggles (F7) added to the kit, used only where Q-E57-8 says | red: each of the seven windows draws a "?" that opens its section; a window's `help` naming a missing section fails (1-2 R). Screenshots: each window's header with "?", both themes, 1366x768 and 820x1180 | C4a; `e101` (1.2.112: it edits ui-kit.mjs); E71 (the windows' final words) |
| **C5** window registry and the mixed-language scenario | the window registry in both languages; a scenario with a GM in Polish and players in English and Polish, no raw key on any client (its number from the coordinator) | red: a raw key planted in one window (1-2 R) | C4b |
| **C6-C8** the English handbooks | GM, player, brochure by the guide: the facts kept, the form shortened (words -20 to -30 % as a report only), the appendix (one per handbook, Q-E57-4) with the source-file lists of sections 6.3, 12, 13 and 19 (the texts line's hand-over), F2's and F3's lines, F4's two rooms, F5's numbers as Q-E57-10 says, F6's list, E62 C3's sentences, the planning line's named items (A7-A11, D071, D091, D113, Wounded per D21, murder versus incident) | 0 R: C1's and C2's guards and T26 hold the result; `handbook-facts.mjs check` green | every line of section 3 merged |
| **C9-C11** the Polish handbooks | from the facts and the old Polish (DB26), "GM-a", "GM-em", "GM-ów"; the pairs green | 0 R | C6-C8 |
| **C12** last pass | `stale-pl --sheet --since v1.2.56` read beside the code; a cold read by a fresh agent with README and the handbooks only; 60 random rendered Polish texts for the owner; `--stamp` only after the Polish was read | none | C11 |
| **C13** ledger, notes, AUDIT 9.2 | LIVE-E57-01..03 (the planning line's), the release notes, the handbook's version notes | none | C12 |

About 13-19 R in all, as the planning line counted; C4 is split in two (C4a can be built any time, by F7).

## 5. Questions, each with a default

Q-E57-1 to Q-E57-5 are the planning line's (its E57.md section 6) and stand as written there. New:

| # | Question | Default |
| --- | --- | --- |
| Q-E57-6 | T10 and T26 are named in the plan and defined nowhere in the repository (F9). What are they? | Until the audit's text is found: T10 "UI names in the handbooks" (C0's list must be named, and every bold or quoted UI name in a handbook is a current value of a key, with a short exception list read by hand); T26 "a section keeps its facts" (after the rewrite, every fact of a unit in `handbook-facts.*.json` stands in a unit of the same section). |
| Q-E57-7 | The trap card's "four to six actions" (F2) is a handbook sentence that contradicts the code. Fix it before E57? | Yes: it is E25 C6's by the boundary, and the texts line can take it now if no open line edits gm-handbook line 686 (none did on 13.11: the ten read carry the old words); E57's C2 then holds it. |
| Q-E57-8 | Tooltips: 395 control sites have neither a tooltip nor a hint (F7). Does E57 fill them? | No. E57 gives the kit a tooltip option for tabs and toggles and the "?" for the seven windows; a sweep of tooltips is new UI text, a stage of its own (or E71's batches if the owner moves it). |
| Q-E57-9 | rules-parity's rounding: is "about a second" for 1200 ms (F3) a disagreement? | Words like "about" allow the nearest whole unit for durations under ten seconds; otherwise the digits must match. The GM handbook's "about 1.2 seconds" is the form to copy. |
| Q-E57-10 | Which unstated numbers (F5) go into the handbooks? | The ones a player or GM waits on or is cut off by (the Frisk's 30 s, the opening roll's 3 tries, the planted item's 120 s, the safeword's 60 s, the trial's text limits, the Misleading Trail's refund); the internal ones (the GM stores' sync, tombstones, the image probe) in the appendix only. |
| Q-E57-11 | UI names (F6): which must a handbook name? | Every setting name; every GM window title and button opened from the GM panel; every player button and tab; no card headings and no confirmation dialogs. C0 reads the list by hand and the owner sees it. |
| Q-E57-12 | The "?" anchor (F7): headings stay without ids. Is a data attribute from the "## N." number the anchor? | Yes: the number is shared by EN and PL, so one section id serves both, and no Foundry id can clash. Sub-sections ("9.1") anchor the same way. |

## 6. Risks

- The planning line's risks stand (a `--stamp` without a real read; bulk edits moving every pair below them; a cut
  rule in the shortening).
- F1 can mislead: agreement is measured on the numbers a reader meets in the text. A rule the handbooks describe in
  words only ("costs a little Sanity") was not read for its number.
- F6's counts depend on a classification by key name. A control without a surface key is not in them, so the real
  gap may be larger than 143; and the 55 one-word matches may hide names that are in fact missing.
- The tooltip scan (F7) reads source, about 10 % either way by hand on two files (room-setup.mjs, gm-panel.mjs); a
  tooltip set at run time from a variable may be missed.

## Appendix: re-measuring at the base

- Numbers: extract every number in the six handbooks (digits and number words), drop versions, dates, ids and
  section references; for each rule number find the value that governs it (config.mjs first, then the script that
  applies it); compare EN and PL line by line. MEASURE-numbers.md says what was read.
- Coverage A: the keys by surface as `check.mjs text` builds them (tools/text-map.mjs `buildScreenMap` and
  tests-text.mjs `surfacesOf`, called in memory: text-map.mjs run from the command line writes `screens.json`); a key
  is named when every fixed piece of its value stands as a whole phrase in its reader's handbook, markup aside.
- Coverage B: control sites in scripts/ (the tests out), each with a tooltip, a hint within three lines, an aria-label
  only, or nothing; a template drawn many times counts once.
- The measuring scripts were not committed: they name this machine's paths. C0 writes its own under tools/ if the
  stage keeps them.
