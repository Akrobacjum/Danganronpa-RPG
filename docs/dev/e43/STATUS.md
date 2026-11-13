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

## Done

| Commit | Sha | State |
| --- | --- | --- |
| C1-C3 | 092c18e1 | committed; tiers 0-1 whole green at it |
| C4+C5 | (next) | the fuzz (scenario 30) and the matrix (scenario 33 H); both scenarios green alone; mutants M1-M5 killed (FINDINGS) |
| C6 | (with C4+C5) | docs/dev/e43/README-CHAPTER.md: the chapter, drafted for the root README.md, which this line may not edit |

## In progress

The whole ci scenario set (39, 84 left out as local-gate only) before the first push: C1-C3 touch gm-store.mjs and
gm-stores.mjs, which 25 scenarios read.

## Proposals for the coordinator (with defaults)

- **The README chapter**: place docs/dev/e43/README-CHAPTER.md's text after the root README.md's Privacy paragraph.
  Default: placed by the coordinator at the release that carries E43, with S17-31's line as its sources table says.
- **E43-F7, the GM's session log drops new rows once it holds 60** (utils.mjs `SESSION_LOG_CAP`): keep the newest
  instead (drop the oldest row, count what was dropped). Default: not changed in E43 - utils.mjs is every stage's, and
  the change moves what `diagnose()` shows; a stage that owns the diagnostics takes it.

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

## Shots page

None yet: C1-C3 change no screen (console text only).

## Tokens so far

Not measured by this line (no counter in the session); noted as unknown rather than guessed.
