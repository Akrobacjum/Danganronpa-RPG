# PV - privacy line 3: what a player saw last

Target 1.2.113. Base af9792c5 (the 1.2.112 tree). Branch `claude/pv-snap`. R5640-R5669. Written 13.11.2026.

## The owner's rule (13.11.2026)

"A player learns what their character could know in the fiction, when they could know it." Three cases of it, the
owner's accepted rules #2, #3 and #4 of 13.11.2026:

| # | Today (af9792c5) | The rule |
| --- | --- | --- |
| P1 (#2) | A player who has ever stood in a project's room sees its progress live on the tray (projects-tray.mjs `hideUndiscovered` asks `knowsProject` alone), and the map card and the Projects explainer show the live bar. A Sabotage makes a public "Repair: X" row at once (projects.mjs `sabotage`, `createProject` with `ownership: { default: OBSERVER }`). Every tick tells the others somebody was in that room. | Each player sees a project as it stood when one of their characters was last in its room, refreshed on entry and live while they are there. The repair row and the frozen state follow the same snapshot. GMs see everything live. |
| P2 (#3) | A finder of a secret project by Observe sees its progress live (projects-secrecy.mjs `viewersOf`: the finder is a viewer), and is told "you can see how far along it is" (`DRPG.Observe.projectFound`). For a Secret Passage the finder is whispered "is finished" at once wherever they stand (projects.mjs `COMPLETION_EFFECTS` `opensPassage`, `DRPG.Observe.projectFoundDone`). | The same snapshot rule for the finder. The "finished" card is posted on the finder's next entry to that room. The Observe card's text says what the finder now sees. |
| P3 (#4) | A trace a player has found is erased (Tamper, cleanup Stage 6): its token is deleted (remnants.mjs `removeRemnant`) and vanishes from the finder's map at once, whichever room they stand in. | The finder keeps a local ghost of the trace on their map until one of their characters stands in that room again; then it is gone. |

## The design call: where the snapshot lives

**On the player's own browser, in a client setting, a section per world and user.** Not a user flag, not a GM store.

| Candidate | Survives a reload | Hands the player nothing their character never saw | Cost of another player's move | Verdict |
| --- | --- | --- | --- | --- |
| A user flag | yes | **no**: a user document's flags reach every browser, so each player's snapshot (which rooms they stood in, when) would be in every console - the alibi the rule exists to hide | none | refused |
| A GM store with a player's copy (as `fogCopy`) | yes, and across devices | yes | the primary GM recomputes the mover's owners' rows on every move and sends a packet; nothing on the bystanders | heavier: a store row, a copy, a socket road, a restore and a reset group; and a player standing in a room with no GM connected would see nothing refresh |
| **A client setting, written by the player's own browser** | yes, on that browser | yes: it is written only from what this browser already holds (the Countdowns world setting, `projectMeta`, the player's sight copy, the scene's tokens), at a moment one of this user's characters stands in the room | **none**: a bystander's browser returns at the first line of the token hook for a token it does not own | **chosen** |

What the choice costs, said plainly:

- **Another device, or cleared site data, starts with no snapshot.** A project this user knows (`knowsProject`) but
  holds no snapshot of on this browser is drawn with its progress unknown ("?"), and a room this browser holds no visit
  of shows every project the record says the user knows in it, each at "?", until one of their characters walks in.
  So does every room right after the upgrade to 1.2.113: no browser holds a snapshot before it.
- **The live numbers are still in the browser.** Daggerheart's Countdowns is a world setting every browser holds
  (audit S09-05, accepted since E05), so a console reads the live bar; this rule changes what the module SHOWS, as the
  tray's `hideUndiscovered` always has. Moving the countdowns out of world data is not this line's.
- **A project a GM deletes leaves the tray at once.** The tray draws Daggerheart's rows; a row with no countdown is not
  drawn, and this line adds no ghost rows to a system template.

### The data each player's browser keeps

One client setting, `seenProjects` (settings.mjs `SETTINGS.seenProjects`, `scope: "client"`, `config: false`), whose
value is `{ "<worldId>/<userId>": section }`, so two worlds or two users on one browser never read each other's.
A section:

```
{
  projects: { "<countdownId>": { current, start, frozen, repairFor, at } },  // as last seen
  rooms:    { "<sceneId>/<room>": { at, ids: ["<countdownId>", ...] } },        // a visit: what stood there
  ghosts:   { "<traceKey>": { sceneId, room, x, y, width, height, src, at } }  // P3
}
```

`at` is `Date.now()` of the reading, used only to prune. Rows of countdowns that no longer exist are pruned at each
write; a ghost is pruned when its room is stood in.

### Where it is written (all on the player's own browser; a GM and a Spectator write nothing)

- `projects-seen.mjs` (new, a leaf of the projects family: it imports projects.mjs, fog.mjs and settings.mjs, and
  projects.mjs does not import it) holds the rule:
  - `seenSection(held)` reads this world's and user's section;
  - `takeSnapshot({ projects, standing, held })` - pure: for each `sceneId/room` in `standing` (the rooms this user's
    characters stand in now, `roomsStoodInNow` on each place scene), the projects standing there (`standsAtProject` by
    room and scene) are written as seen and the visit's `ids` replaced; answers the new section, or null when nothing
    changed (so no write and no hook);
  - `asSeen(project, { user, section })` - the row this browser shows for one project: the live row for a GM, a
    Spectator, a project with no room and a player standing there now; the snapshot's numbers otherwise; `{ unknown }`
    when the user knows the project but this browser holds no snapshot of it; null when the user does not know it
    exists yet (see "who knows a project exists", below);
  - `refreshSeen()` - reads this browser's world, calls `takeSnapshot`, writes when it changed; asked after a settled
    move of an own token (`drpgRouteSettled`, and `updateToken` of a token this user owns whose position changed), a
    change of the Countdowns or `projectMeta` (only when one of this user's characters stands in a room at all), the
    sight copy (`drpgProjectSightChanged`) and `canvasReady`.
- **Not asked on another player's move.** The token hook returns on a token this user does not own before it reads
  anything (`isOwner` on the document): scenario 86's "another player's move" must count no new work on a bystander.

### Who knows a project exists, and what they see of it (P1, P2)

| Reader | Knows it exists | Sees its bar |
| --- | --- | --- |
| A GM | always | live |
| A Spectator (E92) | always | live (it watches the class's map; it has no character to stand anywhere) |
| A project with no room | as today (`knowsProject`) | live: there is no room to be away from |
| A player with a character in its room now | yes | live, and written to the snapshot |
| A public project, a player away | only when a visit on this browser listed it (`rooms[...].ids`); a room with no visit on this browser falls back to `knowsProject` (the "?" rows above) | the snapshot, or "?" |
| A builder or insider away: the proposer (`proposedBy`), a sealed viewer, a secret project's viewer or builder, an Observe finder | **yes, always** - they made it or found it, and know it is there | **the snapshot, or "?"**: a builder away from the room does not see the work others did, a sabotage, or a finish, until they return (the fiction: the work happens in that room) |
| A repair row (`repairFor`) | **only from a visit that listed it**, for everybody but a GM or a Spectator - insiders of a secret target included, since the sabotage happened in a room they were not in | the snapshot |

The frozen state is the target's `frozen` in the snapshot; a player sees it only through the repair row, which
follows the same rule.

### P2's "finished" card on the next entry (the one GM-side piece)

The card is a whisper; a browser cannot hold a whisper back from its own player. So the primary GM holds it:

- At a Secret Passage's completion (`opensPassage`'s `after`), each finder (`meta.foundBy`) who has a character standing
  in the project's room now is told at once; every other finder gets a row in a new GM store, `foundDone`
  (gm-stores.mjs `foundDoneStore`, `kind: "ledger"`, `sync: true`, `backup: true`, `resetGroup: "projects"`), keyed
  `<userId>:<countdownId>`: `{ name, room, sceneId }`. The finder's browser holds nothing.
- On the primary, a settled move of a character into a room (fog.mjs `onUpdateToken`, where the discovery is recorded),
  and the primary's ready, read the rows for that character's owners: a row whose room and scene the character now
  stands in is posted (`DRPG.Observe.projectFoundDone`, whispered to the GMs and that user) and tombstoned.
- A row's subject is its user (`exists`: the user still exists); the project may be gone - a finished Secret Passage
  is removed - and the card names it from the row.

### P3: the ghost of an erased trace

- On a player's browser, `deleteToken` of a Remnant token this browser showed as found (a Truth Bullet of the user's
  names it, `myBulletForRemnant`; or an incident trace shown to the cast, `myIncidentTrace`), on a scene, in a room
  (`roomOfToken`) none of this user's characters stands in now: a ghost row is written (`ghostOf` - pure - answers the
  row from the token document: scene, room, position, size, picture). A trace erased in front of the finder (their
  character in that room) leaves no ghost: they saw it go.
- `refreshSeen` drops every ghost whose room one of this user's characters stands in.
- The drawing (`drawGhosts`, `remnant-ghosts.mjs`, new): a translucent sprite of the trace's picture at its place on
  the scene drawn, redrawn at `canvasReady` and when the section changes; no interaction. **The harness has no canvas:
  the tests read the data the ghost is drawn from; the drawing is LIVE-PV-01.**

## What it costs (scenario 86)

Measured before and after (`node cluster.mjs scenarios/86-frame-work.mjs`), both reported in the final note. The
promise: "another player's move" adds no counter on a bystander; the own move adds one snapshot read (and a write only
when a project stands in the room entered).

## The tests

Red first, each on af9792c5 without the change, then green. Tier-1 tests take their inputs as arguments (the suite
runs as a GM); tier-2 tests are named.

| R / name | Promise | Red on the old code because |
| --- | --- | --- |
| R5640 | `takeSnapshot` writes the projects in a room a character stands in, replaces the visit's list, and answers null when nothing changed | the function does not exist |
| R5641 | `asSeen`: a player away sees the snapshot's numbers, not the live ones; a player standing there sees live; a GM and a Spectator see live | as above |
| R5642 | `asSeen`: a public project created after the user's last visit to its room is not known; a builder away knows it but sees "?" or the snapshot | as above |
| R5643 | a repair row is shown only from a visit that listed it, to an insider of a secret target too | as above |
| R5644 | the tray: `hideUndiscovered` with a section takes out a row the user does not know by the snapshot; `paintProgress` writes the snapshot's numbers into the row's tag and bar, "?" for unknown | the old tray reads `knowsProject` and the live bar only |
| R5645 | the map card and the explainer draw the bar as seen | they read `allProjects()` |
| R5646 | the section is per world and per user, and `refreshSeen` on a GM writes nothing | - |
| R5647 | bystander cost: `refreshSeen` is not asked for a token update of a token this user does not own (read of the hook's guard, and a counter read) | - |
| R5648 | P2: the Observe card's text no longer promises live progress (EN and PL) | `DRPG.Observe.projectFound` says "how far along it is" |
| R5649 | P3: `ghostOf` answers a ghost for a found trace erased in a room no own character stands in, none when one does, none for a trace this browser did not show | the function does not exist |
| R5650 | P3: `takeSnapshot` drops a ghost whose room an own character stands in, keeps the others | as above |
| R5651 | the project's token on a player's map follows the same rule (visibility.mjs `applyToProjectToken` asks `tokenShownAsSeen`), read once a pass, and a change of what was seen asks the project tokens again, never a whole pass | the gate was `knowsProject` alone |
| tier 2 "a finished Secret Passage tells a finder away from its room on their next entry" | P2 on the primary: a row in `foundDone`, no whisper; the move into the room posts it and tombstones the row | today the whisper is posted at once |
| tier 2 "a finder standing in a finished Secret Passage's room is told at once" | the control | - |

Older tests that pin the old behaviour are changed, never skipped: E15-T16 read the "finished" card at once for two
finders with no character in the room; it now reads both cards held in `foundDone` (E15-T12's finder stands in the room
and is told at once, unchanged). Census rows added, each a new road named: R379, R432 and R553 (the new token and canvas
hooks), R382 (`drawGhosts` reads the scene drawn), R3510 (the "finished" card's one poster moved from projects.mjs to
projects-seen.mjs). The backup test ("Back up the case, then Restore") holds every backed-up store to a fixture: one for
`foundDone`.

### As built (13.11.2026)

- The map's project token follows the tray (R5651): found in the self-review - a project made, or a repair begun, while
  the player was away appeared on their map at once, as `knowsProject` alone gated it.
- The coordinator's follow-up (13.11.2026): a finished project's token tint on a player's map follows the snapshot
  (`tintForSeen`, visibility.mjs `paintProjectTint`; R5652; LIVE-PV-03), live for a GM and while a character stands
  there; a player's Call picker (a player-held Monokuma's Despair Call away from a project's room) lists and filters the
  projects as seen (`projectsAsSeen`, call-pickers.mjs `callProjectPool`; R5653). The Call's legality stays live: the
  picker shows the snapshot, and call-effects.mjs `projectRefusal` still refuses a finished or frozen project, live, after
  the pick - so a pick of a project frozen while the player was away is refused with `DRPG.Project.noneToMove`, which
  says that much. `.claude/rules/code.md` has the two new files' rows (the owner's consent of 13.11, relayed by the
  coordinator).
- Scenario 86's E89 C2 caught the first wiring: a change of the snapshot asked a whole visibility pass on an own move;
  it asks the project tokens alone now (`projectTokensPass`).

## Text

`DRPG.Observe.projectFound` rewritten (EN and PL) to say the finder sees the project as it stands now and again when
they come back; one new key for the tray's unknown bar's tooltip, `DRPG.Project.seenUnknown`; one store label,
`DRPG.Backup.store.foundDone`. The player and GM handbooks (EN and PL) where they say the tray shows a project's progress
live, or that a Secret Passage's finder is told at once.

## What only a table can answer

- LIVE-PV-01: the ghost is drawn at the trace's place, translucent, under the fog's veil rules, and goes when a
  character walks into the room.
- LIVE-PV-02: Daggerheart's tray row shows the snapshot's numbers (the harness plants rows; the system's template is
  not rendered headless).

## Out of scope, named for the owner

- A finished project's token changes its tint (projects-map.mjs `tintFor`, a token document every browser on its scene
  holds) at once: completion is still visible live on the map. Changing it needs a per-browser tint, not a document's.
- A Call's project list for a player-held Monokuma (call-pickers.mjs, `knownProjects` fallback for Despair) still
  filters by the live frozen state.
- The live countdowns in world data (above).
