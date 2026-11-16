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
| (E43-T1) | tier 2 **E43-T1**, the coordinator's ask of 14.11: the Mask's two cards veiled with no incident running, held without the scenario. known-leaks.json's `foundry-masked-token-actor` and the README's sentence beside it were read again: both describe the token's `actorId` read from a console, which remains, not the cards | red with 1463f22b's mask-gm.mjs on a copy, green on the tree; E69-T7 beside it green |
| (docs) | LIVE-E43-01, LIVE-E43-02, LIVE-E43-03 (E43-F8) and LIVE-E40-01 written into audit/AUDIT-1.2.42.md 9.2 as items 534-537 (529-532 on its branch, renumbered in the 1.2.113 assembly); `node tools/check.mjs live` 0 problems | - |

Not walked by 72's season: a second incident and trial in chapter two (10-murder's, 63's and 65's ground), and a second GM
across the reset (61's).

## State: final for the round of 13.11.2026

E43 is done as far as this line can take it: C1-C7 pushed. No commit in progress. Next stage: none named.

## The line claude/e53-116 (15.11.2026, base e9f4a791, with E53)

| Commit | What | Tests |
| --- | --- | --- |
| (E53 C4) | **projectLabel(id, user)**, the plan's goal, on S17-31's base (E93, 1.2.111; E101 R2): projects-secrecy.mjs `nameAs(id, user)` with its pure rule `labelFor`; `shownName` is `nameAs` for this browser's user (every list reads it through `allProjects`), and projects.mjs `projectLabel` with a countdown id and a user answers it. For this browser's own user it answers what `shownName` answered before, on a GM and a player's browser alike. Read on the way: **E43-F11** (FINDINGS), the repair card's readers | R7541 (tier 1) red at e9f4a791 "projects-secrecy.mjs has no labelFor or nameAs", green after; R1106 green |
| (E43-F11) | a sealed repair's end card names its secret target to each reader as they may read it: readers grouped by `projectLabel(targetId, user)`, one card a group (projects.mjs, the `repairs` completion effect) | 72-canary "a sealed repair's end", red at 2832f8e4 (p2 read the name), green after |

## The line claude/e43-117 (16.11.2026, base ff3e12e5, 1.2.116; R block R7640-R7679; R7640-R7644 used)

| Item | What | Checks |
| --- | --- | --- |
| Q-E43-6 | bookkeeping: the ring was built in E109 (daba7d5c, 1.2.115); the open-questions row and FINDINGS' E43-F7 say so | R7124 by name on ff3e12e5: 2 passed, 0 failed, 0 skipped, 0 red |
| Q-E43-6, follow-up 1 | the GM panel's Debug log (gm-panel.mjs `openFailureLog`) says how many older rows the log dropped, above the rows, in the page's language (`DRPG.Failures.dropped`, a plural family: en one/other, pl one/few/many/other), and its Copy text carries the same count in diagnose()'s English words (diagnostics.mjs `failuresDroppedLine`, now the one line both texts use; English by design, as the rest of the Copy text and diagnose()'s console are). The coordinator's ask of 16.11.2026 | R7640 (tier 1), red at a48e822e `[null,null,null,false,false,false,false]`, green after; R7124 green. First placed in utils.mjs, which the text lint holds to the page's language (T13 found its two English literals); moved to diagnostics.mjs, whose English is allowed |
| Q-E43-6, follow-up 2 | the comments that said the log keeps its first 60: tests-tier2.mjs (the test "a drawn roll waits for the GMs' marks, and with none open in time it is refused, told") and tests-kit.mjs `watchLog` now say what it did until 1.2.115 and what it does since; gm-panel.mjs `openFailureLog`'s header names the ring and the dropped count. **The escape `rows.length >= 60` is kept**: a full log no longer keeps the reason out, but 60 other wordings between the refusal and the read would still drop it, and nothing in the test bounds what other hooks log meanwhile, so its removal is not shown safe; the comment says so | that tier-2 test by name: 1 passed, 0 failed |
| README | the chapter "What a player with a console always sees" placed in the root README.md after the **Privacy.** paragraph, on the owner's consent of 16.11.2026; [README-CHAPTER.md](README-CHAPTER.md) holds the same text and its sources | below |
| Scenes | the design note for a project in a room whose name several scenes hold ([SCENES.md](SCENES.md)): (b) and (c) first (a48e822e), (c) alone once the owner chose it on 16.11.2026 (a56ffb13). The lead of 01:31 does not explain the owner's P1 symptom, which stays unexplained; (c) does not claim to fix it | every reader read on ff3e12e5 |
| Scenes, (c) built | the GM picks the scene of the room in the project's editor (**Scene of the room**), shown only where more than one place scene holds the room's name: projects.mjs `roomSceneOf`, `projectSceneRule`, `pickedSceneOf`, `roomSceneChoices`, `projectScene` reading the pick; `roomScene` stored with `room` (projectMeta, the GMs' row while secret: PROJECT_SECRET_WHILE_SECRET and world-secrets.mjs's rule; the sight copy); the token put on the picked scene (projects-map.mjs `placeProjectToken`, `moveProjectToken`); a rename carries a picked project's room only on its scene (fog.mjs `carryRoomInWorld`); a Trap's plant window opens on the project's scene (traps.mjs); the manager's room change clears a pick; a stale pick falls back to today's rule and the editor says so (`DRPG.Project.roomSceneStale`). Text: DRPG.Project.roomScene, roomSceneStale, DRPG.Tips.Actions.roomSceneTooltip, en and pl; the GM handbook's 11.1 names the control, en and pl, in the existing paragraph so no unit id moves (docs/handbook-facts.*.json are line C3's). Not built: a scene for the console's createProject (api.mjs), and a run that reads a secret project with a pick (SCENES.md, Tests) | R7641, R7642 (tier 1) red at a56ffb13 (`"no rule"` x8 and `"no choice"`, every field false), green after; the tier-2 "a project picked onto a second scene ..." red at a56ffb13 (threw: `P.roomSceneOf is not a function`), green after; the tier-2 "a project in a room that one place scene holds ..." green before and after, as it holds today's answers; scenario 99's new "facilities on two scenes" (p1's own page) `{"choices":2,"before":true,"picked":true,"onFirst":false,"onSecond":true,"used":true}`, 99 15/15; R190 green with its new fixture; older tests changed on purpose: R2076, R2077 (the windows' fields and label keys: the picker after the room) and R4751 (35 keys under DRPG.Tips.Actions); tiers 0-1 whole 1762 ran: 1747 passed, 0 failed, 16 skipped, 0 red; 68 related tier-2 tests by name (projects, tokens, traps, renames, the editor and the manager): 71 passed, 0 failed, 1 skipped. Mutants: none run |
| Scenes, option B built | the owner chose B on top of (c) (16.11.2026, "co do projektow to opcja B"): the scene is found from the proposer's token (projects.mjs `proposerSceneFor`, `detectedSceneFor`) at createProject and again when the room changes (`roomSceneOnRoomChange`, `roomSceneAfterRoomChange`), unless a GM picked by hand (`roomSceneByGm`: the editor's picker changed, or the token dragged into a room more than one scene holds); a picked scene deleted tells the GMs other than the one who deleted it (projects-map.mjs `onPickedSceneDeleted`, `otherGmIds`). The coordinator's messages of 10:50-11:14 reached this line at 11:56, after (c) was pushed; B reuses (c)'s storage and picker, as the 11:14 message says. Defaults put to the owner: the drag as a hand pick; the found scene stored even where one scene holds the room. The editor no longer turns an untouched picker into a pick on Save | R7643 (tier 1) red at 0858af76 (the rules missing), green after; the tier-2 "a project a player proposes stands on the scene of the proposer's token ..." red at 0858af76 (threw: `roomSceneOnRoomChange` missing), green after; scenario 99 15/15 -> 16/16 with "a project Aiko proposed while standing on the second scene ..." `{"found":true,"byGm":false,"onSecond":true,"onFirst":false}`; scenario 97 19/19 with H1 `{"picked":true,"onGm2H":[["USERGM2E38000000"]],"onP1H":{"cards":1,"named":0}}`; R3510 (tier 0) changed on purpose: projects-map.mjs gains a GMs' warning card; tiers 0-1 whole 1763 ran: 1748 passed, 0 failed, 16 skipped, 0 red; 69 related tier-2 tests by name: 72 passed, 0 failed, 1 skipped. Mutants: none run. Not run with a second GM headless beyond 97 H1: a deletion by gm2 while gm is the primary |
| B, the three gaps (the coordinator's ask of 16.11.2026) | (1) **a secret project with a pick, measured by a run** (scenario 99): on p2, a bystander, its projectMeta row holds neither `roomScene` nor `roomSceneByGm` (nor `room`), no secret project's row holds either, no other world setting does, and p2's sight copy names it not; on p1, the insider, the sight copy carries the scene and the project stands there. **The run found a defect in (c)**: the insider's copy dropped the scene - projects.mjs `receiveSight` kept only its listed fields, and `tellSight`'s mark (what was told) left the pick out, so a change of the pick was never told again; both fixed. (2) **a deletion by gm2 while gm is the primary** (scenario 97 H2): one card, to gm alone, gm2 reads none. (3) **mutants** of B's rules, each on a copy of the tree, the check run against it (`DRPG_REPO`): M1 detection ignoring the room - KILLED by R7643; M2 a hand pick not kept - KILLED by the tier-2 "a project a player proposes ..."; M3 no re-detect on a room change - KILLED by the same; M4 the deleter told too - KILLED by 97 H1 and H2; M5 an untouched Save taken as a hand pick - KILLED by the tier-2 "a project picked onto a second scene ..." (its untouched Save step, added for this: before it no test read an untouched Save where two scenes hold the room); M6 createProject finding no proposer's scene - KILLED by the tier-2 "a project a player proposes ..."; M7 the sight copy dropping the scene - KILLED by 99's secret-project check. 7 of 7 killed, none survived | 99 18/18 (the secret check red before the projects.mjs fix: `"insider":{"scene":false,...}`); 97 20/20; the two-scene tier-2 test with its untouched-Save step green; tiers 0-1 whole 1764 ran: 1749 passed, 0 failed, 16 skipped, 0 red; 23 tier-2 tests that read the sight copy or a secret project, by name: 27 passed, 0 failed; scenario 72 (the canary) 163 passed, 3 expected red, 0 failed. The coordinator's message asking for these three before P1 reached this line after P1 was pushed (3b6b423b): they follow it |
| P1, explained and closed | the owner's probe of 16.11.2026 on their world (1.2.116): project "Porządki", public, complete, room Dorm, its action of one day completed at day 3 morning, the clock then at day 1 morning, so `facilityLive` was false and nothing said why. The owner's decisions: "tak" - the GM sees why; "b" - a clock set back before a completion counts as completing it now. Built: facilities.mjs `facilityState` (live, or "ended" with the time of day it ended at, "chapter", "season", "later"), `facilityWhyLine` drawn on a GM's browser in the Projects window (action-project.mjs, beside `facilityLineFor`) and the project's editor; `completionAfterClockBack` and `restampSetBack`, run by the primary GM at every change of the clock's calendar and at its ready (facilities-gm.mjs `registerFacilityClock`, module.mjs): a completion later in the same season and chapter than the clock is restamped to now, in the project's own change, so the lifetime runs from now. A pure read was not taken: "the earlier of the two" would let the action stand from the set-back clock until the old stamp and a lifetime after it, not from now. Use limits are not reset (the owner, 16.11.2026). `completedAt` stays in projectMeta, where it was (the coordinator's "the GMs' half while secret" read as the project's own step; the field was never a secret one). A clock moved and moved back inside one burst of the setting is no change of the calendar and restamps nothing (scenario 99's first try read that). Text: DRPG.Facility.notLive.ended, chapter, season, later, en and pl; the GM handbook 11.1 paragraph on a finished project's room action, en and pl, in its own line | R7644 (tier 1) red at 5b3d80b5, green after; the tier-2 "a completed project's action whose completion is later than a clock set back ..." red at 5b3d80b5 (threw: `facilityWhyLine` missing), green after: the owner's state stands from now with 5 times of day left, past its lifetime the player is offered nothing and the GM's line names it, a forward move restamps nothing; scenario 99 "facilities after the clock is set back" (p1's own page) true, 99 17/17; E93-T3, R2076, R2077 green; tiers 0-1 whole 1764 ran: 1749 passed, 0 failed, 16 skipped, 0 red; 12 related tier-2 tests by name (project actions, completions, the facility runs) green; after the last change (the restamp reads `getClock()`, not the hook's raw clock) R7644, the owner's-state test, scenario 99 17/17 and lint green again. Mutants: none run |
| P1, mutants (the coordinator's ask of 16.11.2026) | each on a copy of the tree, the check run against it (`DRPG_REPO`): P1 "season" read as "chapter" - KILLED by R7644; P2 "chapter" read as "season" - KILLED by R7644; P3 no "later" reason - KILLED by R7644; P4 "ended" named at the completion, not at the lifetime's end - KILLED by R7644; P5 a restamp across chapters - KILLED by R7644; P6 a restamp when the completion is not later - KILLED by R7644 and the tier-2 "a completed project's action whose completion is later ..."; P7 a player reading the reason - KILLED by scenario 99's new check (past the lifetime the GM reads why, p1 reads no reason and no row; added for it: until then the reason was read on the GM alone); P8 a restamp across seasons - **SURVIVED** first (no case of another season), R7644 given that case, then KILLED. 8 of 8 killed, one after a test was added | scenario 99 19/19 with the new check; R7644 green with its new case; the final run of this line: quick green (lint 414 files, check 25 parts, gate 37/37); tiers 0-1 whole 1764 ran: 1749 passed, 0 failed, 16 skipped, 0 red |

Every sentence of the 13.11 draft read again against the code and known-leaks.json on ff3e12e5. What changed, and why:

| Draft sentence | Now | Why |
| --- | --- | --- |
| "every token on every scene, hidden or not, with its name and position, and every move it makes" | "... with its name, position and flags ..." | `foundry-veiled-token-actor` (E112): a token's flags reach every browser, and the veil's flag is one |
| "where the traces lie ... each trace's note and what it really is are not" | "Remnants" for "traces" | docs/text-style.md EN15: "Remnant" is the thing in every sentence |
| (none) | "A killer behind a "?" wears the module's "?" picture, but their token still points to their character, and while a direct murder's opening waits the killer's tokens are hidden and carry the veil's mark, so a console can tell whose they are" | known leaks `foundry-masked-token-actor` (1.2.115) and `foundry-veiled-token-actor` (E112, 1.2.116), both after the draft; the "?" picture is E112's (`MASK_IMG`) |
| "Foundry's own secret doors, are seen" | "... which a console can also open (the GM's browser shuts them again)" | `foundry-secret-door-type`'s own words: a console's write of the door's state is taken, and the primary GM shuts it |
| "the module's passages, and who knows them, are not" | "the module's secret passages" | the glossary's `secret-passage-word` |
| "every character's items, with their names, whoever carries them" | "every character's sheet: its traits, Hope and other resources, and its items ... So a Monocub's move paid from its purse is seen as actions spent and no Hope; who paid, and what the purse holds, are not" | the draft left out the actor's own data, which reaches every browser like its items (`foundry-cub-purse`'s foundryLimit); `foundry-cub-purse` (E72) is a known leak the draft did not name |
| "every chat message, whispers included" | "rolls and whispers included" | the Privacy paragraph: rolls are whispered and reach every browser like every chat message |
| "the trial's list of the dead" | "..., a death nobody has found yet among them" | `TR30`'s own words; the draft's note "closes E72; while open, this line stays" no longer holds: TR30 is a foundryLimit (the owner's TR30 = 2), so the line stays for good |
| "who is in a running murder" | "... beyond what the killer's tokens above say" | the two token leaks above: a console can tell the killer's token |
| "what an ordinary trace really is" | "Remnant" | EN15 |
| "a secret project's builder, condition and plan" | "of a secret project its name, who proposed it, who is in on it, its condition, its description and its room action" | S17-31 shipped in E93 (1.2.111): the name (`secretName`) and the insiders (`viewers`) are the GMs'; "builder" was `by`, who proposed it; "plan" named no field, the description is the GMs' while secret; the room action (`facility`) reaches insiders on the sight copy since P1 (2832f8e4); E43-F11 (8f1178bd) took the name off a sealed repair's end card for readers not in on it. The draft's closing note ("until then the list above must add a secret project's name and its ownership map") is void |
| "is refused there, told why, and changes nothing" | "changes nothing on the GM's browser that is not the sender's own. It is refused there, and the player is told why wherever their browser waits for an answer; a junk note of their own is saved as their note, in plain text" | E43-F5: `note.save` saves the sender's own note from the junk as text, and is not refused; refusals of a quiet declaration tell nobody (E43-F6: three of the matrix's) |
| "the module's own test harness sends every request it knows that way" | "every request the GM's browser judges that way from a player's browser, and checks each" | the fuzz reads the four tables off the GM's module (lib/fuzz.mjs), so "every request of the tables" holds; "it knows" was vaguer |
| "It is still a curtain and not a wall: a player who goes looking behind it finds what the list above says." | "A player who goes looking behind the curtain finds what the list above says." | the Privacy paragraph right above ends on "a curtain, not a wall"; said once |

Unchanged and read true: the opening two sentences, the regions-and-walls line, the private cards' stub (secret.mjs), the
Mastermind, the votes (gm-stores.mjs `ballotStore`) and the GMs' notes (the stores `notes`, `note`).

**The Privacy paragraph's sentence beside `leak:S17-64`, measured** (the coordinator's ask of 16.11.2026; the owner
answers on this text; README.md not edited). The sentence: "Where the traces lie, the GM's plan for the key clues and,
until the lights come up, a murder declared during the Eclipse are all world data."

Measured on 170ef249, whose key, Remnant and Eclipse code is ff3e12e5's (this line changed none of it), by a probe
scenario run once on the harness and not committed: the GM writes a Key plan with three markers in its first slot and
places that slot's Key Remnant in the Gym (key-remnants.mjs `placeInSlot`); then opens an Eclipse, Chie's player (p3)
declares a Direct Murder in the Gym with a marker in its note (eclipse.mjs `parkDirectMurder`), and the GM moves Chie's
token in the dark. Read on p1, a bystander: every world setting, scene, actor, chat message and user as JSON.

| What | On p1 | So |
| --- | --- | --- |
| the Key plan | `game.drpg.keyPlan()` 0 slots written; the three markers on no document or setting | the GMs' (a GM store since 1.2.64, `keyPlanStore`; 72-canary holds it too) |
| the placed Key Remnant | a token at its position, hidden, named "Remnant", the neutral "?" picture, flag `isRemnant` alone: nothing says it is a Key | its place is world data, as every unfound trace's (S17-64); that it is a Key, and what it means, are not |
| the declaration in the dark | the note's marker nowhere; the old world key `pendingMurders` reads `{}`; the GMs' store holds it | the GMs' (`pendingMurderStore`, since E05 C3) |
| its card | one new chat message, whispered to the GM alone, authored by the GM, no speaker, a stub | that some card went to the GMs then is seen; whose and what is not |
| the killer's token in the dark | moved 350,1300 -> 1500,1500 on p1, not hidden | every move in the dark is world data (`foundry-hidden-tokens`: every token's position and each move) |

`S17-64`'s entry covers an unfound trace's token alone (its position; note and subject stay with the GMs). The Key
Remnants are such tokens; the moves in the dark are `foundry-hidden-tokens`' ground, not S17-64's. Read so, the
sentence is half stale: the plan for the key clues and the declaration itself have not been world data since 1.2.64
(E05 C3, C5); what is world data is where the Key Remnants lie, as every trace, and where every token goes in the dark.

Proposed replacement (the markers stay where they are):

> Where the Remnants lie, the Key Remnants among them, and where every token goes during an Eclipse are world data;
> the Key Remnant plan and a murder declared in the dark stay on the GMs' browsers. <!-- leak:S17-64 -->

**Placed** on 16.11.2026 by this line: the owner's answer through the coordinator, "oba tak" (yes to this sentence, and
yes to the drag as a hand pick, below). The consent covers this one sentence; the marker `<!-- leak:S17-64 -->` stays
where it was, and the registry's readme-leaks check is green with it.


## Not built, each with its reason

- **The LIVE rows**: written on 14.11.2026 (items 534-536, and LIVE-E40-01 as 537; above).
- **The whole-season canary**: built on 14.11.2026 (ad22a09f, above).
- **Open 103**: built on 14.11.2026 (59d1c3c1, above); E93 and E101 R2 are in the base.

## Proposals for the coordinator (with defaults)

- **The README chapter**: placed on 16.11.2026 by the line claude/e43-117, on the owner's consent (above).
- **E43-F7**: built in E109 (1.2.115); Q-E43-6 below.

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
- **projectLabel(id, user)**: waited for E93 (1.2.111); built on 15.11.2026 with E53 C4 (above).
- **LIVE-E43-02** (a bystander's Countdowns on v14 shows no secret project's name): waits for E93 too.
- **31-fuzz's local layer on the 30099 sandbox (LIVE-E43-01)**: no sandbox here; the fuzz runs in scenario 30, ci layer.

## Open questions (defaults taken)

| Id | Question | Default taken |
| --- | --- | --- |
| Q-E43-1 | Does this stage stay on the release line? | The coordinator gave it to this line; built here. Default taken, owner to confirm |
| Q-E43-2 | S17-31 to the line now? | Already done on the E93 branch; not redone. Default taken, owner to confirm |
| Q-E43-3 | Open 96 and 103 stay here? | Yes, read for this stage; see FINDINGS. Default taken, owner to confirm |
| Q-E43-4 (this line's) | No new scenario number: where do 31-fuzz and 32-case-security go? | 31-fuzz is scenario 30's last part, the matrix (32's "the packet was delivered, then its effect") scenario 33's; both under the ci layer. Default taken, owner to confirm |
| Q-E43-6 (14.11.2026) | E43-F7: should the GM's session log keep the newest 60 wordings (a ring, with a count of the dropped ones shown by `diagnose()`) instead of the first 60? | **Answered and built.** The owner, 14.11.2026: "Zmieniamy", again "tak" on 16.11. Built in E109 (daba7d5c, 1.2.115): utils.mjs `keepNewest` drops the oldest row of a full log, `record` keeps through it, `sessionFailuresDropped` counts the drops, and diagnostics.mjs `failureText` (diagnose()'s "failures" part) names them; R7124 (tier 1). Read on ff3e12e5 (16.11.2026, line claude/e43-117): R7124 by name, 2 passed, 0 failed, 0 skipped, 0 red. The two places E109 did not reach (the Debug log window and its Copy text; two test comments) were built on this line on the coordinator's ask of 16.11.2026: R7640, above |
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
