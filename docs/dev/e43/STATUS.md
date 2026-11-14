# E43 - Second security round: status

Branch e43 (this line's), base 421f2395 (origin/main, 1.2.109). R range R5200-R5299. Plan: docs/dev/plans/E43.md on
the planner's branch (plan-130) (written for 1.2.130; its open questions take their defaults, below). Findings:
[FINDINGS.md](FINDINGS.md).

## The commits

The plan lays out four items, not commits; this line cuts them so (each commit's message carries its red and green
readings and its quick gate):

| Commit | What | Tests |
| --- | --- | --- |
| C1 | `game.drpg.diagnoseSecrets()` and `game.drpg.diagnoseTraps()` (GM only), tools/api-surface.json | R5200 (tier 1) |
| C2 | `voicePlan` grouped by where each account is sent, "(sent nowhere)", ACCOUNTS WITH NO CHARACTER; `contestedOf`: no false conflict | R5201, R5202 (tier 1); R833 changed on purpose |
| C3 | gm-store.mjs `SECRET_FIELDS`, registered by the files that own the lists; tier 0 holds it apart from setting keys, FLAGS and literal flags | R5203 (tier 0) |
| C4 | the fuzz: every request of the four tables in six shapes, every other module packet in three, from a player's console (audit/harness/lib/fuzz.mjs, scenario 30's last part) | scenario 30 |
| C5 | the hostile-client matrix: every request naming another player's character or asking a GM's road, delivery proven on the GM first (scenario 33) | scenario 33 |
| C6 | the README chapter "What a player with a console always sees"; known-leaks as it stands | docs |
| C7 | Open 96: a project's card hears the discovery record and a settled move; a GM-store copy's handle carries its `spec` | R5204 (tier 1) |

## Done

| Commit | Sha | State |
| --- | --- | --- |
| C1-C3 | 092c18e1 | pushed; tiers 0-1 whole green at it |
| C4-C6 | 736e55eb | pushed; the fuzz (scenario 30) and the matrix (scenario 33 H); mutants M1-M5 killed (FINDINGS); docs/dev/e43/README-CHAPTER.md drafted for the root README.md, which this line may not edit |

Before the first push (13.11): every ci scenario at 736e55eb, 38 of 38 green (84-viewports is local-gate only, left
out); 34 in one `run-all.mjs scenarios` run, the last four (89, 91, 92, 93) alone after a container restart cut it.

| C7 | (this commit) | Open 96; R5204 red at 736e55eb `[false,false,true,true,"string","undefined"]`, green after; tiers 0-1 whole, scenarios 65, 61, 62 and two GM-store tier-2 tests green |

## The line claude/e39-43-113 (14.11.2026, base 1463f22b, R block R6200-R6299)

| Commit | What | Tests |
| --- | --- | --- |
| 59d1c3c1 | **Open 103** (E43-F9): a secret project's description rides the insider's sight copy (projects.mjs `sightFor`, `receiveSight`, `descriptionOf`), and `tellDescription` sends each reader their sight again | 72's new check red at 1463f22b, green after; 93-spectator 18/18; tier 2 by name (sight, description, secret project) 60 passed, 0 failed, 1 skipped |
| ad22a09f | **The whole-season canary**: 72 after the trial ends the chapter (`openChapterEndDialog`, nothing revealed), plays a second chapter with secrets of its own (a Key plan, a hidden trace, a bullet's GM note, a secret project nobody is in on, p1's note), and resets the season with every group ticked; after each, every marker of the run on every player, p1's and p2's world data for Chie's id, their chat. lib/canary.mjs `scan` takes `gone`, the seeds a step takes off the GM too, held both ways. It found **E43-F10** (FINDINGS): the Mask's end card named the killer on every browser; both Mask cards are veiled now (mask-gm.mjs) | 72 156/159 (3 expected red, Foundry limits); 13-murder-signals 87/87; tier 2 E69-T7 |
| (docs) | LIVE-E43-01, LIVE-E43-02, LIVE-E43-03 (E43-F8) and LIVE-E40-01 written into audit/AUDIT-1.2.42.md 9.2 as items 529-532; `node tools/check.mjs live` 0 problems | - |

Not walked by 72's season: a second incident and trial in chapter two (10-murder's, 63's and 65's ground), and a second GM
across the reset (61's).

## State: final for the round of 13.11.2026

E43 is done as far as this line can take it: C1-C7 pushed. No commit in progress. Next stage: none named.

## Not built, each with its reason

- **The LIVE rows**: written on 14.11.2026 (items 529-531, and LIVE-E40-01 as 532; above).
- **The whole-season canary**: built on 14.11.2026 (ad22a09f, above).
- **Open 103**: built on 14.11.2026 (59d1c3c1, above); E93 and E101 R2 are in the base.

## Proposals for the coordinator (with defaults)

- **The README chapter**: place docs/dev/e43/README-CHAPTER.md's text after the root README.md's Privacy paragraph.
  Default: placed by the coordinator at the release that carries E43, with S17-31's line as its sources table says.
- **E43-F7, the GM's session log drops new rows once it holds 60** (utils.mjs `SESSION_LOG_CAP`): keep the newest
  instead (drop the oldest row, count what was dropped). Every version of that fix changes what `diagnose()` and the GM
  panel list (`sessionFailures()`), and no test can hold the drop without reading that list, so it is Q-E43-6 below.

## Needs a local Foundry

- **LIVE-E43-01**: scenario 30's fuzz against the sandbox at :30099 - a Foundry v14 server, a GM and three players in
  separate browsers; read whether v14's server drops any junk shape before the GM sees it (the shim does not model it).
- **LIVE-E43-02**: a bystander's Countdowns window on v14 with Daggerheart, a secret project made by the GM.
- **LIVE-E43-03** (E43-F8): a player's open project card on a v14 table, turning when their token walks in.
- The Mask's two cards (E43-F10) on a v14 table: that the veiled card reaches the killer's player and nobody else's chat
  log names them (LIVE-E69-05, the Mask at a table, is the row to read it in).

## Waits for another stage

- **S17-31** (a secret project's name and ownership map in Daggerheart's Countdowns; the plan's item 1): fixed on
  the E93 branch (522cd601 and its review commits), shipping in 1.2.111. Not redone here, as the coordinator said. What this line read of it is in FINDINGS.md, "Read, not reproduced here".
- **projectLabel(id, user)** (the plan's goal: one helper the tray, the token card, windows, chat and pickers read):
  waits for E93 (1.2.111), whose S17-31 fix decides where a viewer's name of a secret project comes from (the GMs'
  store on a GM, the sight card on a player). Built on main's `projectLabel(project, {...})` it would be rebuilt.
- **LIVE-E43-02** (a bystander's Countdowns on v14 shows no secret project's name): waits for E93 too.
- **31-fuzz's local layer on the 30099 sandbox (LIVE-E43-01)**: no sandbox here; the fuzz runs in scenario 30, ci layer.

## Open questions (defaults taken)

| Id | Question | Default taken |
| --- | --- | --- |
| Q-E43-1 | Does this stage stay on the release line? | The coordinator gave it to this line; built here. Default taken, owner to confirm |
| Q-E43-2 | S17-31 to the line now? | Already done on the E93 branch; not redone. Default taken, owner to confirm |
| Q-E43-3 | Open 96 and 103 stay here? | Yes, read for this stage; see FINDINGS. Default taken, owner to confirm |
| Q-E43-4 (this line's) | No new scenario number: where do 31-fuzz and 32-case-security go? | 31-fuzz is scenario 30's last part, the matrix (32's "the packet was delivered, then its effect") scenario 33's; both under the ci layer. Default taken, owner to confirm |
| Q-E43-6 (14.11.2026) | E43-F7: should the GM's session log keep the newest 60 wordings (a ring, with a count of the dropped ones shown by `diagnose()`) instead of the first 60? | Unchanged in 1.2.113: the first 60 kept, as today; the owner decides, and the stage that takes it changes `diagnose()`'s text with it. Default taken, owner to confirm |
| Q-E43-5 (this line's) | SECRET_FIELDS "in gm-store.mjs": the engine imports config.mjs alone (R161) | A registry each owning file registers its list in, at import; gm-store.mjs exports it. Default taken, owner to confirm |

## Test results

| When | What | Result |
| --- | --- | --- |
| 13.11 | R5200-R5202 red at HEAD (before C1/C2) | 3 failed, each for its named reason |
| 13.11 | tiers 0-1 whole, with C1+C2 | 1323 ran: 1308 passed, 0 failed, 16 skipped, 0 red (416 s) |
| 13.11 | R5203 red on a worktree of HEAD | measured `[null,null,[],true,false]` |
| 13.11 | tiers 0-1 whole, with C1-C3 | 1324 ran: 1309 passed, 0 failed, 16 skipped, 0 red (410.9 s) |
| 13.11 | related tier 2 (3 voice tests) | 3/3 |
| 13.11 | lint, check, gate | green (321 files, 17 parts, 37/37) |
| 13.11 | scenario 30 with the fuzz | 279 passed, 0 failed, 1 expected red (foundry-secret-door-type); 454.6 s and 467.1 s |
| 13.11 | scenario 33 with the matrix | 76/76, 147.2 s |
| 13.11 | fuzz mutants M1-M4, matrix mutant M5 | all killed |
| 13.11 | every ci scenario at 736e55eb (38; 84 is local-gate only) | 38/38 green |
| 13.11 | C7: R5204 red, then green; tiers 0-1 whole | 1325 ran: 1310 passed, 0 failed, 16 skipped, 0 red (441.9 s) |
| 13.11 | C7: scenarios 65, 61, 62 | 57/59 (2 expected red, as before), 113/113, 51/51 |
| 13.11 | C7: tier 2 "the old stores are claimed per world ...", "a player's rows merge, never replace ..." | 2/2 |

## Shots page

None. Nothing this stage changed is drawn by the module's windows: C1-C2 change console text (English, as the
diagnostics' console stays), C3-C6 tests and docs, and C7 makes an open project card redraw on a player's walk-in,
which the harness cannot open on a player (no shot can show it headless; FINDINGS E43-F8 names it a live check). The
voice plan's new shape, as R5201 prints it:

```
Kitchen  (1)
   R5201AKITCHEN000 - R5201PA000000000 · w
(Spectators' room)  (1)
   R5201ASPEC000000 - R5201PS000000000 · a Spectator, talking with the Spectators
(sent nowhere)  (2)
   R5201ASPARE00000 - R5201PA000000000 · nowhere   ← ignored, R5201PA000000000 is sent with R5201AKITCHEN000
   R5201AOFF0000000 - R5201POFF0000000 · not connected

ACCOUNTS WITH NO CHARACTER  (1)
   R5201LONE0000000 → (main room) · no character - the main room
```

(Reconstructed from voicePlan's code and R5201's fixture, not copied from a run's output.)

## Tokens so far

Not measured by this line (no counter in the session); noted as unknown rather than guessed.
