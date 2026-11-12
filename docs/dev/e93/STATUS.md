# E93 - Facilities: status

Branch `claude/e93`, base f22a7e87. R range R3750-R3799. Spec: [SPEC.md](SPEC.md). Plan: docs/dev/plans/E93.md on
origin/claude/plan-130.

## Done

| Commit | What | Tests |
| --- | --- | --- |
| C1 | data: config.mjs `FACILITIES`; facilities.mjs (cleaning, marks, lifetime, the room's and the projects' actions, cost, Overflow shut); the GM store `facilityUses`; the world setting `facilityClosed`; projects.mjs completion row `facility`; a secret project's `facility` kept in the GMs' half (PROJECT_SECRET_WHILE_SECRET and the world-secrets rule) | R3750-R3752 (tier 1) |

## In progress

- C3: the bridge road `facility.use` (facilities-gm.mjs written, not yet wired).

## Next

C6 Overflow's five states (their readers are needed by C3), C3 the road and its scenarios (33, 30, 83), C2 Room Setup's
Facilities tab, C4 the tile and window, C7 the scenario and the handbooks. Then E69, E74.

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

None yet.
