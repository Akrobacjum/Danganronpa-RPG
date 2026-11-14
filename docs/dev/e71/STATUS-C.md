# E71 line C: status

Line C of E71 (with E25's content part) on `claude/e71-c`, from `claude/fervent-sagan-gme4vt` at 1463f22b (14.11.2026).
Batches: B10a Vote/Trial/Floor, B10b Chapter/Monocub/Advance/MONOCUB, B11 Project/Trap, B12
Reroll/Bridge/Relay/Secret/Guard/Errors, B13 Safeword .. DAGGERHEART (+ Notices, Popup). R numbers: R6500-R6549.

## C0: census (re-measured on 1463f22b)

Read with `node tools/text-map.mjs` (237 scripts, 159 screens, 62 by SCREENS; keys 6855: 6448 assigned, 407
unassigned) and `git blame` of `lang/en.json` on the unshallowed history, the texts-e71 early pass commits ignored
(33 commits, "E71 early pass", "E71/E25 early pass", "E25 early pass"), so a key's origin is the stage that wrote it,
not the sweep that last touched it. Per key: `docs/dev/e71/census-C.json`.

**Which namespaces are line C's.** The coordinator's binding map of 14.11.2026 (it replaces B13's range "Safeword ..
DAGGERHEART", which is not a run of en.json's order, and a map this line first built from the screen map's majority):
the batches' own lists, and Monokuma, Spectator, Class, Redacted, Enforced, Users, Messenger, Note, Rules, Legacy,
Dialog, Handbooks, Audit, TrialScene and GAME. Placed in batches by their screens: Monokuma in B10b; Audit, Class,
Redacted, Enforced, Users, Messenger, Note in B12; Spectator, Rules, Legacy, Dialog, Handbooks, GAME in B13.

| Batch | Namespaces | Key families | full | check | frozen |
| --- | --- | --- | --- | --- | --- |
| B10a | Vote, Trial, Floor, TrialScene | 457 | 394 | 62 | 1 |
| B10b | Chapter, Monocub, Advance, Monokuma (and the 18 keys of MONOCUB's config prose, full) | 326 | 183 | 139 | 4 |
| B11 | Project, Trap | 250 | 223 | 27 | 0 |
| B12 | Reroll, Bridge, Relay, Secret, Guard, Errors, Audit, Class, Messenger, Note, Redacted, Enforced, Users | 435 | 354 | 81 | 0 |
| B13 | Safeword, Notices, Popup, Legacy, Spectator, Rules, Dialog, Handbooks, GAME, DAGGERHEART | 194 | 179 | 15 | 0 |
| all | | 1662 | 1333 | 324 | 5 |

A family is a key or a plural family (`.one`/`.other`, and in Polish `.few`/`.many`). `full`: written before E65
shipped (01.11.2026) or by E70 (the plan: E70's texts edited in full), edited in full (DX1 = 2). `check`: written by a
stage after E65 (E72, E73, E93, E99 and others), linted only (O12). `frozen`: a key `docs/dev/e71/FROZEN.md` freezes
for gaps-a; the coordinator released every other freeze on 14.11.2026 (its branches are in the base or will not merge),
so those keys are full or check by their origin.

**The lint on line C's keys before** (`node tools/check.mjs text --all` on 1463f22b, findings whose key is in the
namespaces above): T4 65, T5 333 (X4 264, X11 27, X3 22, X12 12, X13 3, X1 2, X10 2, X14 1; en 143, pl 190), T8 1,
T11 2, T17 11, T18 5, T19 5, T23 2, T27 1. T13 (literals, by file) on the files of these screens: monocub.mjs 44,
relay-guard.mjs 42, bridge-guards.mjs 18, trial-progress.mjs 13, projects.mjs 7, trial-floor.mjs 3, vote.mjs 2,
projects-ui.mjs 2, action-project.mjs 2, projects-map.mjs 1, chapter.mjs 1 (an E54 file: waits).

**Tooling.** Line B's shared batch tooling (d97bf964, merged at b21c93fb): every `docs/dev/text-batch-*.json` is a
batch, checked by `node tools/check.mjs text`; Appendix C is B01a's.

## Batches

Each batch: the writers (one fresh agent a slice, 19 slices) read the code behind every text and wrote its facts, then
the Polish from the facts and the old Polish, then the English (DB26); fresh reviewers read the batch (EN, with the
mechanics review on B10a and B11, every rule read in the function that runs it; a cold EN read with no facts; PL in
three steps); a fresh executor answered every point not ok, verifying each mechanics point in the code; the afters
landed in lang/ (and config.mjs for MONOCUB) in place, keys, order and indentation kept. A family read in full and
kept is in `docs/dev/e71/kept-C.json` with its reason, with the writers' notes. The review sheets render with
`node tools/text-render.mjs --batch docs/dev/text-batch-<B>.json [--pl-only]` (into audit/harness/results/text/).

| Batch | Texts rewritten | Kept | Points not ok answered | Commit |
| --- | --- | --- | --- | --- |
| B13 | 35 | 144 | 21 (19 taken, 1 in part, 1 kept) | 968a0a27 |
| B12 | 197 | 157 | 88 (71 taken, 15 in part, 2 kept) | 6cc82c5a |
| B10b | 100 (9 MONOCUB config prose) | 101 | 50 (43, 6, 1) | 88446e77 |
| B10a | 182 | 212 | 75 (51, 24, 0) | 25423c19 |
| B11 | 92 | 131 | 42 (29, 12, 1) | 25423c19 |
| scenarios, tests, fixes after landing | - | - | - | 39d3b18c, e74cdf43, 09f20502, and the commit that adds this file's last state |

After landing, texts changed to the test or scenario that found them, each with its reason in its batch's `removed`
("After landing (...)"): Project.traitFixed, Vote.openNoBallots (R1157), Trial.objectionRefusedWhisper (R1448),
Project.visibleTo PL kept with needsKiller/needsKillerNamed following it (R2078), Floor.holdingDebate and the Polish
resend lines (R320), Floor.closeDebate EN, Advance.allPlayers EN+PL, Floor.incidentKeep PL kept as the handbooks
quote them (scenario 50), Bridge.why.noBudget kept (scenario 76: the same sentence as DRPG.Move.noBudget),
Floor.closing.inExchange PL names the bar's button as it stands, seven contractions in full (T19), Reroll.crisisReplayed (T7).

Tests and scenarios changed with the texts, each red first: R1058 and R1059 (the dash baseline: 3 rows, not 9;
T6's six MONOCUB rows gone with the minus signs), R1157 (allow rows: two U, a new reason T for
Advance.introMany's „{picks} razy”, Vote.accusesLine's R row gone), R1158 (Advance.offered's rendering); scenarios
63 (privacyNote's words, red at the base), 50 (Key Remnanty, red at the base), 15 (filesPutBack's words), 40
(Reroll.cardReplaced's line). Commit 09f20502's message says its scenario pass ran "on 2d0c4e9f's tree": wrong; it
ran on 25423c19's tree with the commit's edits uncommitted.

No new R numbers (no new test; R6500-R6549 unused).

## The lint on line C's keys, before and after

`node tools/check.mjs text --all`, findings whose key is in line C's namespaces (the same count script both times):

| Detector | Before (1463f22b) | After (this tip) |
| --- | --- | --- |
| T4 lengthOver (report) | 65 | 69 (each over a target, none over a limit) |
| T5 patterns (report) | 333: X4 264, X11 27, X3 22, X12 12, X13 3, X1 2, X10 2, X14 1 | 43: X4 17, X11 14, X3 3, X12 4, X13 3, X14 1, X17 1 |
| T17 Oxford comma (report, candidates) | 11 | 16 |
| T18 telegraph | 5 | 3 |
| T19 contractions | 5 | 5 (E72's keys, lint only) |
| T7 rule numbers as words | 0 | 0 (Reroll.crisisReplayed found and fixed after landing) |
| T16 second person to many | 2 (Monocub.meddleIntro EN, PL) | 4 (and Monocub.tiersIntro: the same site, read by the Monocub alone) |
| T11 loanGender | 2 | 2 |
| T8 glossary | 1 | 1 |
| T6 dashes (FAIL, baseline) | 9 rows | 3 rows |

No lint was switched to its final mode. T13 (literals) on the files of line C's screens: unchanged, 133 findings; read
one by one, they are the English refusal reasons of the GM's log (monocub.mjs `CUB_BLOCKS` `refuses`, bridge-guards.mjs
and projects.mjs refusals, mapped to a reason code the player is told in their language), the trial record's internal
descriptions (trial-progress.mjs, trial-floor.mjs), a data id (projects-map.mjs's actor name) and two markup
attributes. One reaches a screen: relay-guard.mjs's reasons fill {what} of DRPG.Relay.refused, a GM's toast (Q-C-3).
No literal was moved.

## Questions, with the default taken

| Id | Question | Default |
| --- | --- | --- |
| Q-C-2 | A batch's texts without the owner's verdict: land in lang/ now, or wait for the owner? | Land them (as texts-e71 did); `owner` stays null, the batch file is the owner's page |
| Q-C-3 | relay-guard.mjs's refusal reasons, English inside DRPG.Relay.refused for a Polish GM: move them to i18n? | No, not in this line: they are built in pieces in a trust-model file; treat them as the GM's log (DB12's diagnostics) until a code stage takes them |
| Q-E71-4 | The GM bar's names (glossary gm-bar-buttons) | Proposed: Skip / Pomiń, -{seconds} s and +{seconds} s, Overrule / Oddalenie, End this mode / Zakończ ten tryb, Back to the debate / Wróć do debaty (the one Polish change; it stays „Z powrotem do debaty” until the owner says, since gm-handbook.pl.md quotes it), Re-point / Przekieruj, Count now / Policz teraz, Skip question / Pomiń pytanie; the bar itself "The GM's bar" / „Pasek GM-a” (DRPG.Floor.bar.label, landed) |
| Q-C-4 | Labels the handbooks quote (Floor.closeDebate, Advance.allPlayers, Floor.incidentKeep, Project.visibleTo PL, Rules.manageTitle/announce/announceTitle, Trial.turn.title, Trial.objectionOutside) | The four the handbook checks hold were kept; Trial.turn.title and objectionOutside changed and the player handbook section 12 quotes their old words: for the handbook line |

## Keys outside line C's namespaces that need a change (the writers' and reviewers' notes)

- DRPG.Move.noBudget and Bridge.why.noBudget: one sentence, changed together (line B owns Move).
- DRPG.Events.safewordSub ("called" where Safeword.announced says "used"); Events.safewordMetaGm PL dash aside;
  DRPG.Season.safewordNote dash and telegraph style.
- DRPG.Investigation.unidentified "Not analysed" (EN1/D33e) with R357, then Chapter.typeless follows.
- DRPG.Calls.sealedBlocked PL telegraph style (as Bridge.why.roomSealed was).
- DRPG.Overflow.clear / cleared: "overflow" in lower case.
- lang/pl.json: 16 values outside line C with „karta postaci” for the sheet (PL-d: „arkusz”).
- DRPG.Panel.whoIsAlive's window is named "the Players window" nowhere now in line C; others may still say it.
- 61-gmstore-case Z2 asks DRPG.Case.* for "traces on the map": red at the base (line D's key).

## Needs code (from the batches' needsCode, for a code stage)

Lists joined with ", " instead of utils.mjs `listOf` (Vote: recipients, stillOut, accusesLineMany, executionPending,
executionNow, despairFilled, namedByTable, accusedDead, unfoundDead; Floor.round.startedLine, endTrialExecutes;
Monokuma.sharedPool; Project.someSabotaged; Enforced.filesFirstHold; Users.match.*); dead keys (Monocub.nobodyDead,
manageTitle, dialogIntro, isOne, tickFirst, student; MONOCUB meddle.failure; TrialScene.hallDark, prepare, scenesIntro,
noWayBack; Floor.startPanic, startClosing, startTrialNoHall); trial-floor-ui.mjs modePickerHtml's Debate reason during
other modes; trial-floor.mjs overruledState names the debate for any floor; the zone modes' Objection refusal (E73);
the Monocub's affordability check against `priceOf`; action-project.mjs startProject's English Scale options; the
Reroll's lines in the GM's language; Bridge.why.criticalHint on every critical GM card.

## Tests on the final tip

Full tier 1 (`node run-tests.mjs --tier 1`) at 26c17b9a, alone on the machine: 1605 tests ran, 418.5 s wall;
1589 passed, 1 failed (R2001, the known base failure), 16 skipped, 0 red.
R4420 (the curtain's hand-over, a 250 ms slack on the plan's end) failed in two earlier full runs of this line's tips
(25423c19's tree, and 09f20502's) and passed alone each time (4 of 4), in the final full run, and in one full run of
the base: a timing reading not tied to a text (the plan's times read no text this line changed); measured, not proved.

Scenarios (one at a time): 33-bridge-paths, 41-trial-scene, 65-season, 67-trial-modes, 87-messenger-sound,
30-security, 73-notice-history, 10-murder, 62-investigation, 72-canary, 75-voice-tile, 88-flow-length green on
25423c19's tree; 50-lang 45/45, 63-class-trial 79/79, 15-held 40/40, 40-flow 89/89, 76-passages 118/119 (its one
expected red) green after the fixes of 39d3b18c, e74cdf43 and 09f20502; 61-gmstore-case 113/114, Z2 red at the base
(DRPG.Case.*, line D's). Not re-run after b6246b79 and 26c17b9a, which changed Reroll.crisisReplayed,
Chapter.typeless and Investigation.unidentified (no scenario quotes them; grep).

## Needs a local Foundry

- Screenshots of each window batch (EN and PL, both themes, three sizes): the harness draws no layout; not taken.
- LIVE-E71-01..03 as the plan proposes (the crisis card on the victim's browser; VT323 glyphs for Polish quotes and
  diacritics; a Polish player reading the fog and voice notices) are not this line's batches' to settle.
