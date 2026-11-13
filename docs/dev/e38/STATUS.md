# E38 - status (13.11.2026)

This stage's own branch, from `origin/main` (1.2.109 at 421f2395, merged forward to 1.2.111 at 984d1fb1 in C4). Plan:
`docs/dev/plans/E38.md` on the planner's branch (read whole). R numbers reserved: R5000-R5099, used: R5000 (D153
across two GMs), R5001 (an author keeps a private card's words). Scenario numbers: 97, 98.

C4 (the coordinator's ask of 13.11, for 1.2.114): the two findings below, both fixed on this branch.

## Done

| Commit | What | Tests |
| --- | --- | --- |
| C1 457786eb | cluster.mjs: `reload(who)`, `makePrimary(who)`, `primaryOn()`; the seeded four may `connect` again once they left; 97-two-gms parts A, B; README rows 82 and 85 retired (built as 97 and 98); AUDIT 9.2 items 507-510 (LIVE-E38-01..04) | red at HEAD's cluster.mjs: "TypeError: primaryOn is not a function"; green 9/9 |
| C2 7c9b2ce0 | 97-two-gms C (a card gm2 claims while the primary reloads, settled once), D (one `rolls` record per roll, drawn on gm and then on gm2 as the primary), F (an open Frisk whose primary leaves: the action handed back at once, no dice), G (D153 measured, a note) | 17/17; mutant "reload keeps no localStorage" killed (A2, A3 red) |
| C3 ea81b712 | 98-chaos A (a card across the only GM's reload), B (a player away at a private card), C (the GM's reload mid-incident), D (the GM's reload mid-vote); README rows 97, 98 | 8/8 |
| C4 e3c60252 | merge 1.2.111; **fix 1 (D153)**: Give a Truth Bullet carried to the primary (new bridge action `bullet.give`, R5000), so a give on a second GM and the primary's find of one trace make one copy; 97 G now reads 1 copy, gm2's give answers "already" | R5000 red then green; 97 17/17; tiers 0-1 1405/0/16; 30-security, 33-bridge-paths, E60-T9 green |
| C5 f5d9cf48 | **fix 2 (offline cards)**: a private card's author GM keeps its words (`authorHold`) and gives them to its readers on return (secret.mjs, R5001); 98 B2 now reads the words once p2 is back, the author GM still a dash | R5001 red then green; 98 8/8; tiers 0-1 1406/0/16 |
| C5a dab9ebb8 | 73-notice-history R2 updated: the card a GM whispered to a player alone is now given back on return (was "sent elsewhere") - an intended change to an older test encoding the old trade | 73-notice-history 1/1 (32 checks) |

## The two findings, both fixed in C4-C5

1. **D153 across two GMs** (fix 1, C4): an Observe's find runs on the primary and the Give ran on whichever GM opened
   the window, each in the receiver's finds' queue, which is one browser's memory - so a give on a second GM beside
   the primary's find of one trace made two copies. The Give is a bridge action now (`bullet.give`, gmOnly, onPrimary):
   the window asks `requestGiveBullet`, the give runs on the primary in the find's queue, the second reads the first's
   copy. No rule players see changed; `giveBullet` is unchanged and still the suite's. Verified: 97 G reads 1 copy on
   both GMs (was 2).
2. **A private card to a player alone, lost on an offline reload** (fix 2, C5 + C5a): a card a GM whispers to players
   alone (a tail, a door, a reroll receipt via `whisperToOwnerOnly`) had no GM reader, so the catch-up (`askForWords`
   / `answerWordsRequest`) could serve nobody and an offline player read a dash for good. The author GM keeps the words
   now (`authorHold`), hidden from its own reads and served to the card's readers alone on return. The fix keeps only
   the author's own copy, not a server copy, so a player whose author GM is also away still waits. No new reader; the
   author GM still sees the stub. Verified: 98 B2 reads the words, the author GM a dash.

   **Owner, please note (default taken, owner to confirm):** this reverses a behaviour secret.mjs documented as a
   deliberate trade ("WORDS AFTER A RETURN": "there is no server-side copy to catch up from ... a player reading
   [yesterday's private narration] is the game") and that an existing test asserted (73-notice-history R2 read the
   card back as "sent to another browser"). The coordinator asked for this fix, so it was built and 73 R2 updated to
   the new behaviour (C5a). What changes for a player: a card a GM whispered to them alone, which they missed by being
   offline, now reaches them on return instead of showing "sent to another browser". If the owner wants the old trade
   kept, revert C5, C5a and R5001 and restore 73 R2. The fix does not expose anything to anyone who was not already a
   reader, and does not change what the GM or any bystander sees.

## Test results

- Tiers 0-1 at C1 457786eb (`node run-tests.mjs --tier 1`): 1320 ran, 1305 passed, 0 failed, 16 skipped, 0 red, 432.4 s wall.
- Own tier 2: none (no tier test added or touched).
- Quick at C3: lint (321 files, 0 problems), `node tools/check.mjs` 17/17 green, gate self-test 37/37, prose
  missing 0 extra 0.
- Scenarios: 97-two-gms 17/17, 98-chaos 8/8. The scenarios that call `connect`, `disconnect` or `storageOf` (cluster.mjs
  code C1 changed), found by `git grep -l -E "await (connect|disconnect)\(|storageOf\(" audit/harness/scenarios`:
  00, 10, 15, 17, 19, 33, 40, 41, 61, 62, 63, 65, 66, 73, 74, 76, each with `node run-all.mjs scenarios --only NN` at
  C3 (ea81b712): all 16 green, and 97 and 98 green there too (from 12 s for 00-boot to 367 s for 61-gmstore-case).
- Tiers 0-1 again at C3: 1320 ran, 1305 passed, 0 failed, 16 skipped, 0 red, 386.2 s wall.

- CI on de4b9621 (run 43401864794, push): every job green - lint, check and gate; the eight scenario buckets (97 in
  b3, 98 in b2); the suite's eight shards; the verdict. 09:30 to 09:59 UTC.

## Not done (the plan's scope, left)

- 85-chaos's list, not built: parallel Eclipses, the pool and Search under a reload, a player with two characters.
- 82's list from the decisions of 11.10 (E70, E73) headless: Testimony, Closing, Objection in Closing, Logic Dive and
  the `mutedDead` write each under a reload and a change of primary - not built; their live half is LIVE-E38-04.
- Frisk across two GMs with `action.friskAnswer` answered by the GMs (a target with no owner): not built; 97 F covers
  the primary leaving mid-ask.
- The FLOWS row "truth-bullets" (`stage: "E38"`, status partial) left as it is: 97 G drives it, but its fix (D153) is
  the verification chat's.

## Next

None named after E38: this line stops here. Not built of the plan is listed above, for the verification chat.

## Open questions (defaults)

| Id | Plan's default | Here |
| --- | --- | --- |
| Q-E38-1 | the stage belongs to the verification chat | not taken: the coordinator assigned the stage to this line; built headless, live parts written as drills |
| Q-E38-2 | D153's fix (a bridge row) stays with the verification chat | overtaken: the coordinator asked for the fix (C4), so it was built here - `bullet.give`, 97 G now one copy |
| Q-E38-3 | the third live account and the drill: whoever runs E83's local gate | default taken, owner to confirm |

## Live-only parts (not run: no v14 server)

Each is an item of `audit/AUDIT-1.2.42.md` 9.2, in Polish, with its drill. The items' numbers 508-511 follow 507 on
main at 1.2.111 (renumbered at the merge of 984d1fb1); a merge with another line's items may have to renumber them.

- LIVE-E38-01 (item 508): the primary GM's F5 during a player's drawn roll ends in one `rolls` record or a message.
- LIVE-E38-02 (item 509): a room switch while a second GM edits Room Setup loses none of their changes.
- LIVE-E38-03 (item 510): the migration drill (the planned 64-migration-drill, local-gate) on copies of v1.1.0, 1.2.13
  and the owner's 1.2.56 world (`DRPG_FIXTURES`, outside the repo): E04's ledger migration and E12's room-flag clause,
  the whispered report against the state. Not built as a scenario file: the stage's numbers are 97 and 98, and a
  local-gate scenario cannot be run or tested here.
- LIVE-E38-04 (item 511): a third account in `audit/live` (GM and two players on a real v14), repeating E70's and E73's
  checks with a reload and a change of primary. Not built: `audit/live` needs the sandbox to be tested.

## Shots

None: no visible change (harness, scenarios and docs only).

## Tokens

Not measured by this line (no counter in reach); the session's own usage is the coordinator's to read.
