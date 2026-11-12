# E93 - Facilities: status

Branch `claude/e93`, base f22a7e87. R range R3750-R3799. Spec: [SPEC.md](SPEC.md). Plan: docs/dev/plans/E93.md on
origin/claude/plan-130.

## Done

| Commit | What | Tests |
| --- | --- | --- |
| C1 | data: config.mjs `FACILITIES`; facilities.mjs (cleaning, marks, lifetime, the room's and the projects' actions, cost, Overflow shut); the GM store `facilityUses`; the world setting `facilityClosed`; projects.mjs completion row `facility`; a secret project's `facility` kept in the GMs' half (PROJECT_SECRET_WHILE_SECRET and the world-secrets rule) | R3750-R3752 (tier 1) |
| C6 | five Overflow states: Lockdown, Insomnia, Toll, Jitters, Power cut (config.mjs OVERFLOW.effects, overflow.mjs readers); Insomnia read by rest.mjs and sheet-audit.mjs `restCovers` | R3753 (tier 1), E93-T1 (tier 2) |
| C3 | the bridge road `facility.use`: bridge-wire, bridge-table row (`rolled` kind `facility`, named by the action), run bridge-runs-acts.mjs `handleFacilityUse` with facilities-gm.mjs's helpers (offer in the GMs' room, limit, cost, effects, trace, card); roll-draw.mjs: the statistic from the GMs' copy of the action, the record names it, Jitters' die, no draw for an action not in the room; the ask `requestFacilityUse`; the window (action-rest.mjs, action-facilities.mjs); `facility` a write reason (GM's alone) | E93-T2 (tier 2), the GMs' roll-list fixture `situation: "facility"`, scenario 33 E93-A (legal), scenario 30 "forgeries of a room action" (2 checks), flow `facility` |

## In progress

- C2 + C4 (one commit): Room Setup's Facilities tab and the room editor, the project editor (project manager's row),
  the tile's label Facilities, the Projects window's line for a completed project's action, the handbooks (C7's text).
  R3754 (tier 1), E93-T3 (tier 2); red at the C3 commit, green on the tree.

## Next

C4 the tile renamed Facilities and its window's look, the Projects window's lifetime line; C7 the scenario and the
handbooks; screenshots. Then E69, E74.

## What a console can still do (watched, not caught)

- Under Toll a GM's action costs 2 actions; the roller's browser pays both before the roll, and the GM's draw sees one
  payment, not its size (roll-draw.mjs: a ticket is one write). A console paying one under Toll rolls all the same.
- A Reroll of a Facilities roll: not measured. Nothing in E93 replays a use after a Reroll; what reroll.mjs does with a
  roll of `actionKey` "facility" was not read or run in this round.

## Test results

| When | What | Result |
| --- | --- | --- |
| 12.11, C1 | R3750-R3752 on a worktree of f22a7e87 with only tests-tier1.mjs copied in (the red reading) | 3 failed: the module does not exist |
| 12.11, C1 | R3750-R3752 on the tree | 3 passed (after two of my test mistakes were fixed: the cap of 8 actions, `null ?? "kept"`) |

## Defaults taken, owner to confirm

- Q-E93-1: the "costs an action" switch is a completed project's action's only; Work keeps its cost.
- Q-E93-2: a room's GM actions are listed only to a character standing in the room. They are region flags, which every
  browser holds, so a console reads them anywhere - the same as a room's description today.
- Q-E93-3: not reached - the timed effects are not built in this round (below).
- Q-E93-4: Toll raises the room actions only, not the rests.
- Q-E93-5: "for those present" is read on the GM at the moment of use.
- Q-E93-6: a GM's action leaves a faint Subtle trace; a project's action and the rests none.
- The five new Overflow states start unticked (out of the hat): five more in a hat of eight would make each old one
  drawn little more than half as often at every table that did not ask for them. Owner to say whether they start ticked.
- A Relief's free Short Rest is not barred by Insomnia (it is a Call paid in Hope).
- A GM's room action always costs an action (the 08.11 switch is a project's action's alone, Q-E93-1).
- The tile's hint (`DRPG.Config.ACTIONS.rest.hint`, EN in config.mjs) is the owner's approved text of batch B01a, so it
  is left as it was: it speaks of the rests only. Owner to say whether it should name the room's actions; the label is
  "Facilities" in both languages, and the handbooks say the rest.
- The project manager (the owner's approved card M16) gains one button per row, in the Edit cell after the pen: the
  project's room action. No new column. Tier 0's R2077 now expects that button's key there. Owner to confirm the place.
- A secret project's action is kept in the GMs' half while the project is secret, and in this round its insiders are
  not offered it (their browsers do not hold it). Owner to say whether insiders should get it.

## Not built in this round (said, not hidden)

The effects that need a mechanism the module does not have: an item's durability, a state removed, temporary +X to a
trait, a temporary Experience, advantage on the next trait roll, a stronger next ultimate Hope Call, protection from
Despair on a roll, a crossing in an Eclipse, project progress (needs a pick of the project). No timed effect exists to
extend (`git grep -i "temporary\|expire" scripts/call-effects.mjs`: nothing at f22a7e87).

## Blockers

None.

## Shots

Round 1 (12.11, C2 and C4): https://claude.ai/artifact/2Mw3Hb4WstZZ8mLs9DaxdE - the Facilities window (player), Room Setup's
Facilities tab, the two editors, Despair Flow's Overflow tab (with its five new rows) and the project manager, each in
Stained Glass and Monokuma Legacy, EN and PL, 1366x768 at scale 2. Drawn by the headless harness and shown in
audit/style-harness.html in Chromium: not Foundry, no Font Awesome (icons blank), no Foundry window frame. Seen
there: the rests' sentence "No room on this map is marked for a yet" - an older text with an empty `{kind}`, not this
stage's; left as it is.
