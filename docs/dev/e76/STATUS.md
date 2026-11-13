# E76 - status of the work line

Stage E76 (compatibility with the newest Foundry and Daggerheart), shipping as 1.2.106 after the coordinator's 1.2.105.
This line's own branch (e76-106), started from the coordinator's 1.2.105 line at f22a7e87. Plan: `docs/dev/plans/E76.md` on
the planner's branch (plan-130). This file is the work line's record; the coordinator merges and releases.

## Versions, as measured on 12.11.2026

| Package | Module targets now | Newest found | How measured, by this line |
| --- | --- | --- | --- |
| Foundry VTT | `minimum` 14.364, `verified` 14.365 | **14.370**, page dated 02.11.2026, "Version 14 Stable 12"; 14.369 dated 08.10.2026 | foundryvtt.com refused by this session's network policy (proxy 403 on `curl https://foundryvtt.com/releases/14.370`). Read through a web search that returned foundryvtt.com/releases/14.370 and /14.369 with their dates: **secondhand**, the notes themselves not read. Daggerheart 2.12.8's system.json says `verified` 14.370, which agrees. |
| Daggerheart | `minimum` 2.6.5, `verified` 2.6.5; harness relay copy 2.10.11; dice copy 2.10.5 | **2.12.8**, tag commit 71c318de25, 2026-11-11T01:49:58+01:00 | `git ls-remote --tags` and shallow fetches of github.com/Foundryborne/daggerheart; dates are the tags' commit dates, not release dates. 2.12.8's system.json: Foundry `minimum` 14.364, `verified` 14.370, `maximum` "14". |
| Dice So Nice | required | **6.4.5** (newest tag) | `git ls-remote --tags` of gitlab.com/riccisi/foundryvtt-dice-so-nice |

`module/systemRegistration/socket.mjs` sha1 prefix, read with `git show <tag>:... | sha1sum`: 2.10.11 59fbfd4bd9, 2.12.4
59fbfd4bd9, 2.12.8 89f7472022 - the plan's figures hold. The only change from 2.10.11 to 2.12.8 is the UpdateSaveMessage case
(`saveTotal`, `isCritical` in place of `result`; `!data.data` guard).

## Done

- **C2 - the save packet in both shapes** (relay-guard.mjs `judgeSave`). Red first: R3600 failed on the tree without the fix
  with "a save in 2.12.5's shape for the sender's own token is not forwarded (a save with no roll in it) - expected
  "forward", measured "drop"", and scenario 33's new check "A8: a player's save in Daggerheart 2.12.5's shape is marked on
  the card" failed with `saves2: null` (scenario run on a copy of the tree with the old guard, `DRPG_REPO`). Green after:
  R3600 and R133 pass; scenario 33 74/74.
  - The guard reads 2.12.5's shape (`saveTotal`, `isCritical`) when the packet has a `saveTotal` key, else the old
    `result.roll`. It forwards the one judged total in **both** shapes (`saveTotal`/`isCritical` and `result.roll`).
  - **Deviation from the plan; default, owner may revise** (accepted by the coordinator, 12.11): the plan said to forward "in the shape the running build's handler
    reads", read off the handler text, and to widen the fingerprint to read the UpdateSaveMessage arguments. Read in the
    code: the case lives in Daggerheart's `EVENT_HANDLERS`, which the wrapped listener (`handleSocketEvent`) only reaches
    through a `Hooks.on` callback; neither text holds the arguments, so the guard cannot read them. Forwarding both shapes
    works for either build without knowing which runs. A third shape is still not seen by the fingerprint (the plan's
    risk 6.2); this line did not add a second signal.
  - Mutants (on a copy of the tree, R3600 + R133): forward without `saveTotal`/`isCritical` - KILLED; owner check dropped -
    KILLED; a null `saveTotal` falling back to `result` - KILLED (after a test was added for it; it first SURVIVED).

- **C4 - the old keys `-=` and `==` in both readings** (harness only: lib/operators.mjs, lib/futil.mjs, cluster.mjs;
  scenarios 91-old-keys-ignored and 92-old-keys-honoured on one body, lib/old-keys.mjs). `legacyReading()` is "ignored"
  (the module's measured notes, the default and the model since E30) or "honoured" (Foundry issue 14806 as read for 14.369+:
  the cluster turns `-=key` into a ForcedDeletion and `==key` into a ForcedReplacement before the write is judged, applied and
  sent on). `DRPG_LEGACY_KEYS` picks a whole run's; a scenario's `export const legacyReading` wins; every results file
  records `legacyReading`. Red first: scenario 92 on a copy of the tree with the old harness files, 4/8 ("A (honoured): a
  GM's '-=' and '==' on a world flag delete and replace" and the reports and the put-back row failed). Green: 91 8/8, 92 8/8.
  In 92, p1's `{"flags.danganronpa-rpg.-=silencedChapter": null}` on Aiko is put back by the primary GM with one row
  `putBack`, "flags.danganronpa-rpg.silencedChapter: 97 -> -", naming PlayerOne: sheet-audit.mjs already judges a `-=` part
  as the whole key (`reachOf`), so the honoured reading needs no module change.
  - **Deviation from the plan; default, owner may revise** (accepted by the coordinator, 12.11): the plan said "default to the reading of the target version". The
    default stays "ignored": the honoured reading is read off an issue title, not measured, and switching every scenario to
    it on that reading is the change LIVE-E76-03 should decide.
  - **Proposed wording for the coordinator** (the root rules file, "Delete a key with forcedDeletion() or unsetFlag"; this line does not
    edit that file): "A `-=key` in an update removed nothing in the 14.36x this module was measured on, and may remove on
    14.369+ (Foundry issue 14806; LIVE-E76-03). Either way the module never spells one: R152 fails any update in the module
    spelt that way, and the harness runs both readings (scenarios 91 and 92, `DRPG_LEGACY_KEYS`)."
- **C5 - Foundry's geometry contract (A10).** R3601: what `PassageMovePolygon` and `clipPassages` lean on, held to Foundry
  14.370 as foundry-vtt-types 14.370.0 declares it (commit 2923f0c5, 07.11.2026: `edges: Set<Edge>`,
  `protected _identifyEdges(): void`, `constructor(a, b, options?)` with the nine options), and this Foundry's sight backend
  (the harness's headless) to the same members. Typings, not Foundry's source. Nothing to be red in the module (a pin); its
  mutants: an extra option in the cut KILLED, an argument passed to `_identifyEdges` KILLED, the harness's `_identifyEdges`
  taking a parameter KILLED (a first try with a default parameter was a bad mutant: `.length` does not count it).
  Not done: the census rows of the plan's C5 list (`Edge`, `PointMovementSource`, per-Level edges, `TokenDocument#movement`,
  wall fields, `teleport`, `displace`, `BaseWall.#canUpdate`, "releasing control cancels the drag") need Foundry's notes or
  source, which this session cannot reach; LIVE-E76-06 carries the drag.
- **C3, the part this line could do: the draw left off 2.12** (roll-draw.mjs `seamFor`, R3602). Read in 2.12.8:
  `actor.rollTrait` builds `MoveContext.build({ ..., ...options, actor })` (actor.mjs:727-743), and MoveContext's constructor
  copies only the properties it names and sets `this.dialog = {}` (move-context.mjs:21-): the module's `drpgActionRoll`, the
  nonce, `LOADED_DIE`, `TRAIT_BY_GM` and `dialog.configure` never reach the build. `reviewBuild` alone would have read 2.12.8
  as "ok" and the GM would have drawn every action as a statistic from the sheet. `seamFor` now also reads the Actor class's
  `rollTrait`: one naming a MoveContext, or one whose source cannot be read, is "changed" (Q-E76-5's default: the rework
  split off, the roll thrown on the player's browser and the GM told once per version). Red first: R3602 measured
  `["ok","ok","ok","ok"]` where `["changed","ok","ok","changed"]` was expected. Mutant: the unreadable-source check dropped -
  KILLED. **What 2.12.8 does to the module's action rolls beyond the draw is not known and likely broken** (the claim by
  nonce in private-rolls.mjs `supersedingRoll`, the Loaded Die, the window always open): that is the split-off rework, and
  the owner's.
- **C6 - the dice look on Dice So Nice 6.4.5.** Read in DSN 6.4.5's source (tag b365efc, 04.11.2026):
  `ALL_CUSTOMIZATION` is a static of the internal `DsnSettings` (module/settings/DsnSettings.js:264), not of `Dice3D`, and DSN's
  api.js exports only `DiceSystem` and `DiceSFX`; so `canonicalLook` falls back to the GM's raw `appearance` flag, as its
  comment says for 6.3+. New in 6.4: a `dice-so-nice.saved` flag (`SAVED`, :160-163). A user without `saved.sfx` throws with
  `DEFAULT_SFX()` - the lines packages register through `game.dice3d.addSFXDefaults` - whatever their `sfxList` flag holds,
  and a user without `saved.appearance` has the package's "basic" role look merged under their own flag (`APPEARANCE`,
  :191-196). The module's forced look writes `appearance` and `sfxList: []` but no `saved` marker, so on 6.4 a forced player
  who never saved their own look would get any package's default effects, against the module's "no special effect"
  (dice-sync.mjs `lookFrom`). Daggerheart 2.12.8 registers no defaults (no `addSFXDefaults` in its module/, git grep), so
  with Daggerheart alone the list is empty. **Fixed (the coordinator's decision of 12.11):** dice-sync.mjs `SAVED_MARK` - a
  forced user is written DSN's `saved` marker `{ appearance: true, sfx: true }` with the look (`writeLooks`), and holds the
  table's look only with both marks true (`holdsTableLook`), so the sweep, the connect and the put-back write it and a
  player's own write of it goes back. Red first: R3603 measured `[true,true,true,true,true,true]` where
  `[true,false,false,false,false,true]` was expected; scenario 17's new G1b failed with every client's marker null and p1's
  own `{ appearance: false, sfx: false }` standing. Green: R3603, R940, 17-assistant 46/46, tier 2's 33 dice-look tests
  ("dice look", 37 passed with the world put back). R940 changed on purpose: its stubs carry the marker, so it still reads the
  look alone. Mutant: the check of `appearance` alone - KILLED. With the switch off nothing is written and nothing put back,
  the marker included (Q4). Screenshots: none possible headless (no Dice So Nice, no canvas); the table check, both themes,
  is LIVE-E76-07. Daggerheart 2.10+ dice roles: not read further.

## The second part, after 1.2.106 (12.11.2026)

The owner answered "E76 tak" on 12.11.2026 (about 11:00 Warsaw), relayed by the coordinator: C1, the C3 copy and E76b
are this line's. The branch took origin/main at 14619ce2 (1.2.106 merged, a6ecbbb9 in it) as a fast-forward first.

| Commit | What | Measured |
| --- | --- | --- |
| eb20782 C1a | harness glue: the `SaveField.updateSaveMessage` stub takes both Daggerheart signatures (2.12.8 saveField.mjs:149-156) | 33-bridge-paths 74/74 with the 2.10.11 copy |
| ec6b04c C1b | **copy**: `lib/dh-relay.mjs` = 2.12.8's socket.mjs lines 3-150 byte for byte (sha1 89f7472022), header updated | 33-bridge-paths 74/74 (A8's saves now through 2.12.8's own handler), 30-security 273/274 + 1 expected red, 0 failed; R132, R133, R344, R345, R3600 |
| 46b5459 C3a | harness glue: `data/actor/resource-update-map.mjs`, 2.12's import path of `ResourceUpdateMap` | nothing imports it before C3b |
| 0674ac3 C3b | **copy**: the 12 `dice/` files from 2.12.8, and the two files they reach: `data/action/move-context.mjs`, `helpers/functional.mjs` | tiers 0-1 1210 passed, 0 failed; R217: `reviewBuild` reads 2.12.8's build as reviewed. Every drawn roll threw until C3c (83 3/8) |
| ca44459 C3c | harness glue: the actor's `rollTrait`/`diceRoll` on 2.12's road (Daggerheart's own MoveContext), `_loc` | E76b's red: 20-crit-hope 3/6, 83-roll-integrity 53/110, 40-flow 65/88, 88-flow-length 26/26 |
| 4f86946 C3d | harness: the window's experiences off `config.data.experiences` (2.12.8's d20RollDialog.mjs:110), scenario 20's critical off `cfg.evaluated`, lint ignores of the two new copies | with E76b: 83 110/110, 20 6/6 |
| 2f8e48b E76b | module: `scripts/roll-marks.mjs` (marks carried on the options' event, put back in `drawnBuild` and `daggerheart.preRollDuality`; a 2.12 roll's outcome filled where 2.10 wrote it), critical.mjs reads `config.evaluated`, `seamFor` "ok" on 2.12 where MoveContext keeps the event; R3604-R3606, R3602 revised, `env.moveContext` | red on HEAD+tests: R3602, R3604, R3605, R3606; green: 20 6/6, 83 110/110, 40 88/88, 88 26/26; 5 mutants KILLED |

What R3602 keeps: the draw is left off ("changed") where the MoveContext a 2.12 build offers keeps no event, where none is
offered, or where `rollTrait` cannot be read. Read in 2.12.8: the dice's `postEvaluate` that filled `config.roll` is
gone, and `addDualityResourceUpdates` no longer has a reroll branch (2.12.8 dualityRoll.mjs:237-262); the module's Reroll
on the GM passed 40-flow and 83 on the 2.12.8 copy, which is all that was measured of it.

Not done here: the harness's actor yields no effects to MoveContext's `getActionRelevantEffects` (as its roll carried
none before), and the window stand-in is still 2.10.5's in everything but the experiences' path (its header says so).

## Ledger rows (for the coordinator's S/stages/E76/LEDGER.md, which is not in this repository)

| Row | Status | Answered by | Limits |
| --- | --- | --- | --- |
| E76-02 (the relay copy from the new tag) | ANSWERED | ec6b04c (C1b, a copy alone), eb20782 (the stub); 33-bridge-paths A8 both shapes through 2.12.8's handler, 30-security part 8 against 2.12.8's relay | the `updateSaveMessage` stub is the harness's; what 2.12.8's own field writes is LIVE-E76-02 |
| E76-05 (the dice copy from the new tag and the draw's review) | ANSWERED | 0674ac3 (C3b, a copy alone), 46b5459, ca44459, 4f86946 (glue); R217 on 2.12.8's build; 83, 20, 40, 88 green on it | MoveContext's effects not modelled (none, as before); a real table's dice and window are LIVE-E76-04 |
| E76-06 (E76b: the module's marks through 2.12's MoveContext, the GM draw on 2.12) | ANSWERED | 2f8e48b; R3604, R3605, R3606, R3602 (revised); 83-roll-integrity 110/110, 40-flow 88/88 | read on Daggerheart's own MoveContext copy, not on a 2.12.8 table (LIVE-E76-04); the coordinator names the rows, so this mapping is a proposal |

## CI

| Head | Run | Result |
| --- | --- | --- |
| 7130fb4 (C2-C5) | CI run 439 (43132492762) | success: lint/check/gate, 8 suite shards, 8 scenario buckets, verdict; the two crlf jobs skipped, as on every push |
| a6ecbbb (C6) | CI run 463 (43178172656) | success, the same jobs |

## Open questions: defaults taken, owner to confirm

| Id | Default taken |
| --- | --- |
| Q-E76-1 | A light "C0 again" inside E59 before 1.3.0. Not acted on here. |
| Q-E76-2 | Targets: Foundry 14.370, Daggerheart 2.12.8, Dice So Nice 6.4.5. |
| Q-E76-3 | foundryvtt.com not allowed in this session; the Foundry half stays secondhand. Not asked of the owner (the brief). |
| Q-E76-4 | module.json untouched: no `verified` raised without a table run (LIVE-E76-01). |
| Q-E76-5 | Split at 1.2.106 (the draw read "changed" on 2.12); the rework then done in E76b after the owner's yes of 12.11 (2f8e48b). |

## Live checks added (AUDIT 9.2, items 475-481)

LIVE-E76-01 .. LIVE-E76-06, as the plan's section 4 proposed, and LIVE-E76-07 (DSN 6.4.5's `saved` marker, C6).

## Screenshots

None. Nothing this line changed is drawn headless: C2 marks a 2.12.5+ save on Daggerheart's own card (LIVE-E76-02), C3
changes which browser throws a roll on 2.12 and adds no text a player or GM reads (the GMs' whisper is the existing
`DRPG.Rolls.notDrawnHere`, which names only the version; the new reason is in the English console line alone), C4 and
C5 are the harness's and the suite's.
No lang key was added or changed.

## Test results

| When | What | Result |
| --- | --- | --- |
| 12.11, C2 | `node run-tests.mjs --tier 1 --only R3600 --only R133` | 3 passed, 0 failed (red before: 2 passed, 1 failed) |
| 12.11, C2 | `node run-all.mjs scenarios --only 33-bridge-paths` | green, 74/74, 135.7 s |
| 12.11, C2 | `node run-all.mjs lint check gate` | green: lint 0 problems, check 17 parts, gate 37/37 |
| 12.11, C2 | `node tools/config-prose.mjs --check lang/pl.json` | 517 strings, missing 0, extra 0 |
| 12.11, C2 | `node run-tests.mjs --tier 1` (whole) | 1175 ran, 1159 passed, 0 failed, 16 skipped, 1 red (R3339, E48's expected red, on the base), 311.7 s |
| 12.11, C2 | scenarios 17-assistant, 30-security, 83-roll-integrity | green: 45/45; 273/274 + 1 expected red, 0 failed; 110/110 |
| 13.11, C3-C5 | `node run-all.mjs lint check gate` | green: lint 295 files 0 problems, check 17 parts, gate 37/37 |
| 13.11, C3-C5 | `node run-tests.mjs --tier 1` (whole) | 1177 ran, 1161 passed, 0 failed, 16 skipped, 1 red (R3339, E48's), 297.2 s |
| 13.11, C3-C5 | own: R3600, R3601, R3602 with R133, R217, R556 | all pass |
| 13.11, C3-C5 | scenarios 00-boot, 91-old-keys-ignored, 92-old-keys-honoured, 83-roll-integrity, 20-crit-hope | green: 33/33, 8/8, 8/8, 110/110, 6/6 |
| 13.11, C6 | own: R3603, R940; tier 2 `--only "dice look"`; scenario 17-assistant | pass; 37 passed, 0 failed (33 ran); 46/46 |
| 13.11, C6 | lint/check/gate; prose; `node run-tests.mjs --tier 1` (whole) | green; 517/517; 1178 ran, 1162 passed, 0 failed, 16 skipped, 1 red (R3339, E48's), 373.7 s |

| 12.11, second part | `node run-all.mjs lint check gate`; prose | green: lint 300 files 0 problems, check 17 parts, gate 37/37; 517/517 |
| 12.11, second part | `node run-tests.mjs --tier 1` (whole) | 1228 ran, 1213 passed, 0 failed, 16 skipped, 0 red, 404 s |
| 12.11, second part | own: R217, R3602, R3604, R3605, R3606 | pass; red on HEAD+tests (R3602, R3604-R3606 failed) |
| 12.11, second part | scenarios 20, 83, 40, 88, 33, 30 | green: 6/6, 110/110, 88/88, 26/26, 74/74, 273/274 + 1 expected red, 0 failed |

## Tokens so far

Not measured by this line (no counter available in the session).
