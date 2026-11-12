# E73 - status of the work line, branch claude/e73

Trial hall zones: picking zones, Straw Poll, Logic Dive, Scrum Debate. Started 12.11.2026 on claude/e97-98 at 4077664
(E97, E98, E99 in). Plan: docs/dev/plans/E73.md on origin/claude/plan-130. Reserved R numbers: R3900-R3949.

## C0 - the spec this line builds to (12.11.2026)

The plan's D.md 14 is not in this tree; the texts below are written to docs/text-style.md and docs/glossary.json
(`straw-poll`, `logic-dive`, `scrum-debate`, `findings`, `zone-a`, `zone-b`; mode names English in the Polish UI, TR18).

### The zones (C1, C2)

- Stored in `sceneRoles` as `zones: { a, b }` (region ids of the linked hall), merged beside `school` and `trial`, no
  migration. Picked in Room Setup's Scenes tab: "Zone A" / "Strefa A", "Zone B" / "Strefa B", listing the hall's regions
  that are not rooms.
- The tab, the Scenes report and the Pre-season check's hall row warn: no zones; both name one region; a zone's region
  gone; the zones overlap; the zones leave part of the hall uncovered; coverage not checked (a gridless hall past its
  budget: a 50 px lattice, 200 ms; Q-E73-4).
- A zone region is not a room and not an undecided region (rooms.mjs `isZoneRegion`): the hall is a place for nobody.
- `sidesNow()` - counted on every client from the world alone: each trial participant (vote.mjs `trialParticipants`: one
  student per connected player, no Monocub, no muted dead) is on the side whose zone holds their hall token's centre:
  the region's own `tokens` first when exactly one zone names the token, else `testPoint` at the centre with the token's
  elevation, else the region's polygon tree or box when `testPoint` cannot be asked. A centre both zones claim is on
  neither (`onLine`). A participant with no token in the hall stands on the side they picked in the side-pick window
  (bridge "trial.side", kept on the floor as `zone.picks`); none picked, no side.

### The modes (C3-C5), rows of the floor's one engine

Three modes of floor-machine.mjs `MODES`, family "zones", their rows in scripts/zone-machine.mjs (pure):

| Mode | Phases | Ends |
| --- | --- | --- |
| `straw` Straw Poll | `vote` 45 s | the clock or Count now: the larger side with at least two thirds of the counted (`3 * larger >= 2 * counted`) is a Finding "The class thinks: {answer}"; otherwise "The class is split: A {a}, B {b}" with the Scrum hint, and the next step is Scrum Debate |
| `dive` Logic Dive | `vote` 60 s, `pause` 5 s, per question of a set of 1-5 | everybody counted on one side, Count now or the clock -> `pause`; then simple majority: right -> the next question (the last one right is the set's Finding); wrong or a tie (0:0 too) -> the set ends, the truth not shown; Skip question writes no answer; End mode keeps where it stopped |
| `scrum` Scrum Debate | `setup` 45 s, then `speak` turns | 2 x the larger camp's turns, the smaller camp first, alternating, each camp's speakers in rotation, `scrumTurnSeconds = clamp(300 / turns, 20, 40)`; crossing free; an empty camp ends it with the other camp's answer as a Finding |

`MODE_RULES`: straw and dive - all speak, all present (TR2 = 1), no Objection; scrum - the speaker speaks and presents,
no Objection. The truth of a Logic Dive question lives in the GM store `diveSets` only; the floor carries the question
and its two answers.

### Findings (C6)

`trialProgress().findings`: `[{ id, text, mode, at, confirmed }]`, a `TRIAL_RECORD` row; a card per entry; the whole list
on the vote's opening card; the GM edits, deletes and marks "Monokuma confirms" (public card each time).

## Deviations, defaults taken (owner to confirm)

- **Q-E73-2, the console rebuild: not in this line.** The coordinator's rule for this line is to keep the console's
  changes to what E73 needs (E61 rebuilds parts of it on another line). The three modes join the console as it is: one
  footer button for the zone modes' picker window, their panel in the console's middle drawn from one contract
  (`ZONE_PANELS`, trial-zones-ui.mjs), so the rebuild reads it. C0b's mock-ups are drawn for the owner's pick; the
  rebuild waits for that pick and E61's merge.
- Q-E73-1: the scenario is 68-trial-zones. Q-E73-3: the set editor a kit window, the run in the console. Q-E73-4 as
  above. Q-E73-5: the modes are in floor-machine.mjs `MODES`, so E99's `caseModes` and the census have them.
- A wrong majority in Logic Dive ends the set as a tie does, and shows no truth either (the set stays replayable).
- A Logic Dive set's Finding is its own `conclusion` text, or the last question's right answer when the set has none.

## Progress

- C0: this file.
