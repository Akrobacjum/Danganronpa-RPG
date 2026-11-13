# E102 - Tooltips across the module: the plan

Prep, 13.11.2026, on `claude/e102-prep` from `origin/main` 421f239 (1.2.109). Docs only: no module code changes
here. The stage was approved by the owner on 13.11 (about 02:05 CET) as its own stage after E57's kit support.

## 1. What the stage does

Every control a reader meets gets a short hover tooltip, in English and Polish, unless the control explains itself
(a footer Close, a field whose label says everything). The proposals are in `TOOLTIPS.json` next to this file and on
the owner's review page; the owner approves them window by window. Nothing is built before the owner's verdicts.

## 2. The census (measured, 13.11.2026)

`node docs/dev/e102/census.mjs` (read-only, prints JSON) rebuilds E57 prep's scanner (claude/e57-prep b7575629,
`docs/dev/e57/MEASURE-coverage.md` B.1; that scanner was not committed). Its method is in its header. On 421f239:

| | E57 prep (4dfac3a, 1.2.108) | this census (421f239, 1.2.109) |
| --- | ---: | ---: |
| control sites | 542 | 549 |
| closing words (footer Close/Cancel, counted apart) | - | 47 |
| with a tooltip always | 56 | 58 (12 of them the name only) |
| with a hint line near, no tooltip | 87 | 101 |
| **neither: E102's sites** | **395** | **390** in 71 files |

The two counts differ by 5 sites out of about 390 (about 1 %). Two known reasons, both checked: this census leaves
out ui-kit.mjs's own builders (the kit's controls are counted where they are called), and a `role="tab"` inside a
CSS selector string (live.mjs) is not a control. It is a static reading, so it can be off by about 10 % either way, as
E57's was: a tooltip set far from its markup is missed, and a site drawn many times counts once.

The 390 by kind: select 90, footer button 90, button 54, input 40, checkbox 37, textarea 24, dom-built button 13,
stepper 11, radio 8, kit tab bar 8, role button 4, toggle 3, other 5.

Readers, as the module's screen map (`tools/text-map.mjs`) gives them, before correction: GM 115, both 68, player
64, unknown 143. The proposals correct each one by reading the code (`reader` in TOOLTIPS.json).

## 3. The proposals

`TOOLTIPS.json`: `meta` (the commit, the counts, the method) and `sites`, one entry per site:
`id` (file:line), `file`, `line`, `unit` (the top-level function the site is in: it survives E54's moves where a line
number does not), `kind`, `key` (the label's key, when found), `window_en` / `window_pl`, `reader`,
`control_en` / `control_pl`, `need`, `tooltip_en` / `tooltip_pl`, `reason` (why none is needed), `note`.

Written to docs/text-style.md (the tooltip surface: what the control does or what its number means, never what the
window already says, O3; target 15 words, limit 23) and the owner's rule of 12.11.2026: the shorter the better, in
natural everyday language; a player reads the effect of the action, never how the module works; a GM reads what
matters to run the game. Polish follows section 7 (Remnant, never "ślad"; GM-a / GM-owie; "arkusz postaci"; "uczeń" in
the fiction, "gracz" at the table; action names in English).

Result (13.11.2026): **208 sites get a tooltip, 182 need none** (47 %, more than the fifth to third first guessed: most
of them sit under an intro or a note of the same window that already says what the control does, which O3 forbids
repeating), in **137 windows**. Readers after reading the code: GM 304, player 52, both 34 (the screen map's guess
had 143 unknown and several GM-only windows as "player"). English tooltips average 10.5 words, the longest 16.
Checked by script: every census id once, none over 23 words, no long dash, no "ślad", no "trace".

The owner's review page (private, Approve / Change / Hold and a note per window, PL first, EN beside; the verdicts
are kept in the page's store, collection `decisions`, one document per window):
https://claude.ai/artifact/Vq9Ls1RqTRJda7q3GrRfz2

What the reading found beyond the tooltips (each in the site's `note`):

- **The census's limits, measured on its 390 sites.** 16 sites carry a key from the line above or below, not the
  control's own label (the readers named the control from the code); 16 already had a tooltip set elsewhere (a
  helper, a state-dependent title); 5 were inputs hidden by an attribute or a class rather than `type="hidden"`;
  several sites are one helper that draws several buttons (the tooltip of each is in the note). C1's census check
  must not repeat the first two: it reads the drawn DOM of each window in the headless harness, not the source text
  (section 5).
- **Labels that look wrong** (for E71, not E102): "Note for the GMs" on the Map view reaches players; "Open the Remnant
  table" opens the Investigation window; Tamper's "Frame" / "Wrób" reads as a verb; the incident cast's "Enter" /
  "Wpisz"; the share window's "Share..." acts at once; the Overrule button's Polish "Oddalenie".
- **Existing Polish texts that still say "ślad"** (PL-r): `DRPG.Chapter.promoteIntro`, `promoteNote`, `bodyNoteTraces`,
  `DRPG.TruthBullet.remnantNote`, `DRPG.Cleanup.moveAlwaysTrace`, `moveHint`, `DRPG.Case.moveNote` (which also names
  `game.drpg.migrateRemnants` to the GM), `DRPG.Observe.alreadyDescribed`. Handed to E71; to check against
  claude/texts-e71 before it merges.
- 14 proposals are marked "unsure" in their note (the reader could not confirm a rule from the code); the owner's
  "Change" or "Hold" on their window settles them.

The texts are proposals only: E71 (texts, 1.2.122) is rewriting many labels, so each proposal is re-read against the
label it sits on after E71 merges (C0).

## 4. How a tooltip is attached (through the kit, nowhere by hand)

The kit already uses two forms, each for a reason written in ui-kit.mjs: Foundry's `data-tooltip` (icon buttons,
launchers, the stepper's - and +, a table column's head) and the browser's `title` (footer buttons, since a disabled
button shows the browser's title, and the title is the button's accessible description). The stage keeps both rules:
`data-tooltip` on an enabled control, `title` on a footer button and wherever the control can be disabled.

| Control | How | Kit change |
| --- | --- | --- |
| footer button (`drpgWindow`'s `footer`) | the button's `tooltip:` option, as trial-floor-ui.mjs:1465 uses it | none: `footerButton` (ui-kit.mjs:180) writes it as `title`, by design (ui-kit.mjs:106-111, E46-C1f: the browser's tooltip reads a disabled button, and the title is the button's accessible description) |
| DialogV2 `buttons: [...]` | the same `tooltip:` | none: `dressFooter` already writes it on the drawn button (ui-kit.mjs:108) |
| tab of `kitTabs` / `kitTabBar` | each section's `tooltip` | E57 C4b adds it (F7); E102 only fills it |
| toggle | E57 C4b's tooltip option (or `attrs: { "data-tooltip": ... }` until then) | E57 C4b |
| stepper | the field's tooltip through `attrs` (its -/+ already carry one, ui-kit.mjs:790-791) | none, or an `attrs` option if the stepper lacks one |
| raw `<button>`, `<select>`, `<input>`, `<textarea>` in a template | `data-tooltip="${esc(game.i18n.localize(key))}"` through one helper, `tipAttr(key, data)` in ui-kit.mjs, which returns `""` for a missing key | a 5-line helper (C1) |
| `document.createElement(...)` | `el.dataset.tooltip = ...` through the same helper's text form | none |
| a disabled control other than a footer button | a `title` too, for the reason the footer uses one; or a wrapper with `data-tooltip` if C1 measures that Foundry v14 shows one over a disabled control (not tried, ui-kit.mjs:111) | decided in C1 |

Keys: one new key per tooltip, named so docs/text-budgets.json's `tooltip` rule (`(Tooltip|\.tooltip)$`) classifies it
and the budget (15 / 23 words) holds it: `DRPG.<Area>.<control>Tooltip`, in `lang/en.json` and `lang/pl.json` together
(`node tools/check.mjs parity`). A placeholder (`{room}`) only where the proposal says so.

## 5. The census check (keeps the count from growing)

A new part of `tools/check.mjs`, `tooltips` (C1), runs the census and compares it with `tools/tooltip-census.json`.
The static census is the fast first pass; because it misreads about 1 site in 10 (section 3), C1 also adds a suite test
that opens each window headless and reads every drawn `button`, `select`, `input` (not hidden), `textarea` and tab
for `data-tooltip`, `title` or a hint line, and the baseline is held to that reading where the two differ:

- the baseline lists every site still without a tooltip or hint, by `file` + `unit` + `kind` + `key` (not by line, so
  E54's moves and ordinary edits do not break it), and every site the owner marked "no tooltip needed", with the reason;
- FAIL when a site without help is not in the baseline (a new control with no tooltip), and when the baseline lists a
  site that now has one (the baseline is cut as sites are filled, so it only shrinks);
- the stage's last commit leaves only the "no tooltip needed" rows; the part then holds the module at that.
- Red first: C1 commits the part with a planted fixture (a control added to a copy with no tooltip) that it must
  fail, the way `node tools/check.mjs moves` plants its pairs.

The census script moves from `docs/dev/e102/census.mjs` into `tools/` in C1 (unchanged but for its paths).

Also, per window, a test in the suite (R numbers from the coordinator; `node tools/registry.mjs --next`) that opens
the window headless and reads that each control it lists carries a non-empty `data-tooltip` in the client's language
(1 R per window group; 2-3 per commit).

## 6. Commits

| # | What | Proof | Waits for |
| --- | --- | --- | --- |
| C0 | Re-run the census on the base the stage starts from; re-point every approved proposal by `unit` + `key` (E54 moves files, E71 changes labels); refresh TOOLTIPS.json; any proposal whose label E71 changed is re-read | the counts in the message; every approved site found again or listed as gone | E54-E56, E71, E57 C4b merged |
| C1 | The kit: `tipAttr`, the disabled rule (Q-E102-2); `tools/tooltip-census.mjs` + `tools/tooltip-census.json` + check part `tooltips` | red: the planted fixture fails the part; the footer tooltip test (R) | C0 |
| C2-C9 | The tooltips, one commit per group of windows the owner approved (about 50 sites each), with their EN+PL keys: C2 Investigation and Remnants; C3 the actions (Observe, Analyze, Search, Tamper, Palm, Frisk, Listen, projects); C4 the chapter, murder and Class Trial windows; C5 the GM panels (students, items, stores, campaign, team); C6 setup windows (room, season, tables, rules, settings); C7 the sheet and the HUD; C8 the messenger, sound, voice, handbooks and the rest; C9 what the owner marked Change, after the second read | per commit: the baseline shrinks by exactly its sites; the window tests (R) red on the base, green after; parity, prose, text (T-checks) green; `npm run quick` | C1; the owner's verdicts |
| C10 | Screenshots: each group's window with one tooltip shown, both themes, EN and PL, 1366x768, for the owner | none | C9 |
| C11 | Ledger, release notes, AUDIT 9.2: a LIVE check that Foundry's tooltip shows on v14 at the table (delay, position, a disabled button) | none | C10 |

About 10-14 R in all.

## 7. What it waits for

| Line | Why | Head (13.11) |
| --- | --- | --- |
| `e101` (1.2.112) | edits ui-kit.mjs (stepper rounding) and components.css; C1 edits ui-kit.mjs too | origin/claude/e101 |
| E57 C4b (1.2.124) | adds the tooltip option for tabs and toggles and the "?"; C1 must not add a second one | origin/claude/e57-prep (plan only) |
| E71 texts (1.2.122) | rewrites labels in lang/en.json and lang/pl.json (about 860 / 1230 lines); a tooltip must not repeat its label, so it is written against the final label | origin/claude/texts-e71 |
| E54-E56 (1.2.118-1.2.120) | E54 moves about 9000 lines (sheet.mjs into 8 files, investigation.mjs into key-remnants.mjs, cleanup.mjs, chapter.mjs into death.mjs and body.mjs, ...); the sites are kept by unit, not line, and re-pointed in C0 | origin/claude/prep-54 |

So E102 starts after 1.2.124 at the earliest, unless the owner moves it.

## 8. Questions for the owner (each with the default the plan follows)

| # | Question | Default |
| --- | --- | --- |
| Q-E102-1 | Is a control with a hint line next to it (101 sites) also given a tooltip? | No: the hint already says it; the census counts them as covered. |
| Q-E102-2 | Two looks stay: Foundry's tooltip on most controls, the browser's on footer buttons and controls that can be disabled (the kit's reason). Unify? | No, keep the kit's rule; C1 tries Foundry v14's tooltip over a disabled control at the table, and a LIVE check records it. |
| Q-E102-3 | The 12 controls whose tooltip is only their name (icon buttons, launchers): leave them? | Yes: an icon's name is its tooltip. |
| Q-E102-4 | Sites whose reader is the GM: are GM tooltips as short as the players'? | Yes, same budget; a GM tooltip may name a rule term. |
| Q-E102-5 | A site the owner holds on the review page: built later or dropped? | Built in C9 after a second proposal. |
