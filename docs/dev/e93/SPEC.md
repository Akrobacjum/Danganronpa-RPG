# E93 - Facilities: the stage spec

Written 12.11.2026 on claude/e93, base f22a7e87 (1.2.105 in progress), from docs/dev/plans/E93.md (origin/claude/plan-130)
and the code read at that base. The plan was written by reading; the facts it names were re-read here and two differ
(below, "What the plan said and the code says").

## The owner's words, as the plan quotes them

The Rest tile becomes the Facilities tile: Short rest, Long rest and the room's actions. Two sources of room actions: the
GM's, set in Room Setup (with a roll), and a completed project's (no roll). Limits: a GM's action, one person per time of
day, closed for everyone once used (a failed roll too); a project's action, once per person per time of day. Every use
leaves a trace. A project gets a lifetime after completion. A fixed list of effects. Five new Despair Overflow effects:
Lockdown, Insomnia, Toll, Jitters, Power cut (Sabotage and Spoilage rejected). 08.11: a project's action may cost no
action if the GM sets so (default yes); Toll makes a 0-cost action cost 1.

## Design

| Part | Where | What |
| --- | --- | --- |
| GM room actions | region flag `facilityActions` on every piece of the room (rooms.mjs `writablePieces`, as the rest flags) | a list of `{ id, label, trait, dc, effects[] }`, each sanitized by facilities.mjs `cleanAction` against config.mjs `FACILITIES` |
| A project's action | projectMeta `facility`: `{ label, effects[], costsAction, lifetime: { kind, n } }`; `completedAt` written by the completion row `facility` (projects.mjs `COMPLETION_EFFECTS`) | the action stands in the project's room while the project is complete and its lifetime runs |
| Uses | GM store `facilityUses` (ledger, synced, not backed up, reset group "actions") | `g:<sceneId>:<room>:<actionId>` a GM's action, `p:<projectId>:<actorId>` a project's; each `{ mark, actorId, userId, at, success }`; a row of another mark counts nothing |
| What a player may know is closed | world setting `facilityClosed`, `{ mark, keys }`, written by the primary GM | only the GM actions' keys, no actor: so an honest window greys a closed action before it is paid |
| The road | bridge `facility.use` (bridge-table.mjs), run facilities-gm.mjs `handleFacilityUse` | `knownSender`, `guardUndoIsTheGms`, `owns("actorId")`; the room read on the GM (`locateActor`), the limit read on the GM, a GM's action's roll in `rolled` (kind `facility`, named `facility: "actionId"`); effects applied on the primary GM |
| The roll | roll-draw.mjs: the trait read off the GM's own copy of the action (`listedFor`), the record names `facility`; Jitters a die of disadvantage (`situationReading`) | a claim never picks the trait or skips Jitters |
| Cost | a GM's action 1 action (+Toll), paid by the player before the roll (the draw's ticket); a project's 1 or 0 (+Toll), taken by the GM in the run | a refusal after a paid roll refunds on the player's browser (action-pipeline.mjs pattern) |
| The trace | a GM's action: a faint Subtle neutral trace in the room, placed by the GM in the run; a project's: none (Q-E93-6 default) | |

## Effects (goal (5)), what this stage builds

| Effect | Kind key | Built | Notes |
| --- | --- | --- | --- |
| Health | `health` | C3 | clears n marks, on the GM |
| Sanity | `sanity` | C3 | clears n marks |
| Hope | `hope` | C3 | +n up to the maximum; nothing under the Despair darkening |
| Hope for another present | `hope` with scope `others` | C3 | |
| An effect for those present | any kind with scope `present` | C3 | read on the GM at the moment of use (Q-E93-5) |
| A Free Move | `freeMove` | C3 | actions.mjs `grantFreeMoves` |
| A search token | `searchToken` | C3 | one more in the room, up to its maximum |
| Minus the Overflow counter | `overflowDown` | C3 | |
| Text from the GM / a story effect | `text` | C3 | whispered to the user and the GMs |
| Project progress | `projectProgress` | later | needs a pick of the project; not built yet |
| An item's durability, a state removed, temporary +X to a trait, a temporary Experience, advantage on the next roll, a stronger next ultimate Hope Call, protection from Despair, a crossing in an Eclipse | - | not built in this round | each needs a mechanism the module lacks (no timed effect exists: `git grep -i "temporary\|expire" scripts/call-effects.mjs` finds nothing); listed in STATUS.md |

## Overflow (C6)

`lockdown` (room actions off), `insomnia` (no Short rest), `toll` (room actions cost `by` more, default 1), `jitters`
(a room action's roll at disadvantage), `powercut` (completed projects' actions off), each `kind: "state"`, `on: true`,
with its reader in facilities.mjs or rest.mjs.

## What the plan said and the code says

- The plan's C1 puts GM actions "in a GM store or region flags". Region flags are sent to every browser, so the action
  list is readable by a console anywhere on the map; the window lists them only to those in the room (Q-E93-2's default),
  which is the same protection the room's description has (rooms' `description` flag). Said in STATUS.md for the owner.
- The plan's C5 (temporary effects) assumes a mechanism to extend; there is none to extend, so the timed effects are not
  in this round.

## Open questions, defaults taken (owner to confirm)

Q-E93-1 yes (the switch on projects' actions only); Q-E93-2 listed only to those in the room; Q-E93-3 not built (no timed
effects yet); Q-E93-4 Toll hits room actions only; Q-E93-5 at the moment of use, read on the GM; Q-E93-6 faint Subtle for a
GM's action, none for a project's and the rests.
