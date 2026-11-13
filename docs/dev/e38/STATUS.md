# E38 - status (final, 13.11.2026)

This stage's own branch, from `origin/main` at 421f2395 (1.2.109). Plan: `docs/dev/plans/E38.md` on the planner's branch
(read whole). R numbers reserved: R5000-R5099, none used: no module code changed (Q-E38-2 below), so no tier test was
needed; every check is a scenario check. Scenario numbers: 97, 98.

## Done

| Commit | What | Tests |
| --- | --- | --- |
| C1 457786eb | cluster.mjs: `reload(who)`, `makePrimary(who)`, `primaryOn()`; the seeded four may `connect` again once they left; 97-two-gms parts A, B; README rows 82 and 85 retired (built as 97 and 98); AUDIT 9.2 items 507-510 (LIVE-E38-01..04) | red at HEAD's cluster.mjs: "TypeError: primaryOn is not a function"; green 9/9 |
| C2 7c9b2ce0 | 97-two-gms C (a card gm2 claims while the primary reloads, settled once), D (one `rolls` record per roll, drawn on gm and then on gm2 as the primary), F (an open Frisk whose primary leaves: the action handed back at once, no dice), G (D153 measured, a note) | 17/17; mutant "reload keeps no localStorage" killed (A2, A3 red) |
| C3 ea81b712 | 98-chaos A (a card across the only GM's reload), B (a player away at a private card), C (the GM's reload mid-incident), D (the GM's reload mid-vote); README rows 97, 98 | 8/8 |

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

## Findings (measured, not fixed here)

1. **D153 across two GMs' browsers is real** (97 G, note): gm's Observe find and gm2's Give of the same trace to Chie
   at the same moment left Chie holding **2 copies**, on both GMs. The queue that holds the rule (one copy per
   receiver) is each browser's memory; the plan's fix, a bridge row carrying a GM's Give to the primary, is module
   code: Q-E38-2's default leaves it with the verification chat. 97 G records the count as a note, so the fix can turn
   it into a check (one copy) when it lands.
2. **A private card to a player alone is lost to a browser that was closed when it was posted** (98 B2): no GM is
   its reader, so no GM keeps its words to give back (secret.mjs, "WORDS AFTER A RETURN" states it as the trade).
   `whisperToOwnerOnly` (utils.mjs) posts such cards: a placement's card to its owner. Not a defect by the file's own
   design; a question for the owner whether those cards should name the GMs as readers, or keep their words for a
   return.

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
| Q-E38-2 | D153's fix (a bridge row) stays with the verification chat, with its two-GM check | default taken, owner to confirm: no module code changed; 97 G measures the race (2 copies) as a note |
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
