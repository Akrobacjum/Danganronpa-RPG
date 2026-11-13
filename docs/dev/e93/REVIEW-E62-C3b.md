# REVIEW-E62-C3b: the dead as Spectators, on origin/claude/e72

Read on 13.11.2026 by the E93 line.

| | |
| --- | --- |
| Range | 786525aa..45448ef2: fd25ee16 (C3b) and 45448ef2 (its fix of points 7 and 8) |
| Skipped | c4f92b20, a merge of main |
| Compared against | the code at c4f92b20 |
| Spec | e64968c6, and docs/dev/e62/STATUS.md section C3b |
| Line numbers | 45448ef2's |

## Runs on 45448ef2, from the branch's own harness

- **Scenario 94** (`94-dead-spectator`): 10/10 checks, 0 failed, 12.5 s.
- **The C3b tests by name**, `run-tests.mjs --tier 2 --only "E62 C3b" --only R4550 --only R4551 --only R4552 --only R4553 --only R4554 --only R3806`: 11 tests ran, 15 passed, 0 failed, 0 skipped, 0 red.
- **Scenario 30**: 281/282 checks, 1 expected red (foundry-secret-door-type, a Foundry limit), 0 failed, 436.6 s.

## Findings

| # | Severity | Where | What |
| --- | --- | --- | --- |
| F1 | medium (traced twice) | scripts/monocub.mjs:568-571 | A Monocub's corpse token marks the Monocub as a crime witness where its body lies, not where it walks |
| F2 | low | scripts/spectator-dead.mjs:137, 167, 176 | Every browser gets `studentId` in the token options; only the owner's browser reads the moment, and it does not need the id |
| F3 | low | scripts/body-tile.mjs:317 | `followBody` skips a Monocub's corpse (`isCorpse` is false for a Monocub) |
| F4 | low | scripts/events.mjs:597 | The body card's fallback room is the walking Monocub's room |
| F5 | low | scripts/spectator-dead.mjs:261-263 | Un-Monocub re-links in two writes; between them a watcher's token carries `cubToken` |
| F6 | note | scripts/anonymity.mjs:806-807 | The GMs' anonymity audit lists each watcher as a closed character named like the dead student |

### F1 - a Monocub's corpse token is counted as a witness (medium, traced twice)

`markWitnessesAt(victim)` (monocub.mjs:562-574) runs at an incident's opening (murder-rules.mjs:606). It loops over `place.scene.tokens` and marks every Monocub whose token stands in the victim's room:

```
if (!actor || token.hidden || !isMonocub(actor) || lawfulRoomOf(token) !== place.room) continue;
```

Since C3b, a Monocub made from a dead student's Spectator holds two tokens: the one it walks (`FLAGS.cubToken`) and its corpse. The loop reads both. The fix pass taught `locateActor`, `myRooms`, fog's `isMine` and the move veto to leave the corpse out (`isMonocubCorpse`), but not this loop.

**Effect.** When a later incident opens in the room where an earlier Monocub's body lies, that Monocub is marked a crime witness for the chapter (`cubSawIncident` calls `setSilenced`), even though it stands elsewhere. Before C3b the one token was both, so this is new with C3b.

**First trace: the loop.**
- The filter tests only `hidden`, `isMonocub(actor)` and the room (:570).
- The corpse token's actor is the student, and a Monocub, so `isMonocub` is true.

**Second trace: the corpse is still there, and not hidden.**
- `leaveBody` lays a tile and leaves the token as it is (body-tile.mjs:219-225).
- `watcherBecomesMonocub` keeps the corpse (spectator-dead.mjs:225-246).
- Nothing removes or hides a dead student's token at a chapter's or trial's end:
  - chapter.mjs:2003 deletes Remnant tokens;
  - trial-scene.mjs:587 and :1144 are the trial hall's copies.
- So the corpse token stays visible on its scene until a revive or the reset.

Not run headless.

**Suggestion:** add `|| isMonocubCorpse(token)` to the filter, and a tier-2 case: a Monocub with its corpse in room A and its cub token in room B, and an incident opened in A, which must mark nobody.

### F2 - `studentId` in the options every browser receives (low; the class the owner accepted)

The token's create, update and delete options carry `drpgDeadSpectator: { phase, silent, studentId }`:
- the create of the watcher's token (spectator-dead.mjs:137, phase "fade");
- the delete at a revive (:167, :176, phase "return").

Foundry hands these options to every browser's token hook. A console can therefore read the dead student's id at a kept death, and its undoing at a revive of a kept death.

This is the class Q-C3b-1 accepted: the watcher actor's name and images already say it. Still, nothing needs the id:
- `momentOf` (:299-306) reads the moment only on the token owner's browser;
- that browser knows its own student;
- the hook's `studentId` is for glass.mjs and sequence.mjs on the same browser.

**Suggestion:** drop `studentId` from the options and let the owner's browser fill it in from its own student.

### F3 - the body tile does not follow a Monocub's corpse

`followBody` (body-tile.mjs:313-323) returns early unless `isCorpse(actor)`, and `isCorpse` is false for a Monocub (movement.mjs:1547-1551). So a GM moving a Monocub's corpse token would leave its tile behind.

The move veto (movement.mjs:1503) refuses that move on the mover's browser, so this matters only where a GM's move gets past the veto. I did not check whether one can.

**Suggestion:** `isCorpse(actor) || isMonocubCorpse(tokenDoc)`, as the veto has.

### F4 - the body card's fallback room

`bodyCard` (events.mjs:593-598) takes `roomOfActor(victims[0])` when the hold names no room. `roomOfActor` is `locateActor` with no `body` (movement.mjs:3395-3396), which now answers a Monocub's walking token. A victim who has become a Monocub would give the card the room it walks in, not the room where its body lies.

**Suggestion:** `locateActor(victim, { body: true })?.room`.

The other victim readers run while an incident is open, before the victim can be a Monocub, since `setMonocub` needs the public flag (monocub.mjs:121):
- events.mjs:180 and :230;
- movement.mjs:1868, remnants.mjs:390, murder-rules.mjs:3636, chapter.mjs:1711;
- monocub.mjs:565.

### F5 - un-Monocub in two writes

`monocubBecomesWatcher` (spectator-dead.mjs:259-267) first writes `actorId: watcher.id`, then `unsetFlag(cubToken)`. Between the two writes, the watcher's token carries `cubToken`: `isCubToken` reads it as a Monocub's walker, and `walkerOrBody` filters on it.

The window is one round trip, and nothing measured shows harm. One update with `[`flags.${MODULE_ID}.-=...`]` is ruled out here (R152), but `forcedDeletion()` in the same update would do it.

### F6 - the anonymity audit

`auditAnonymity` (anonymity.mjs:791-812) puts every `character` whose default is below Observer under "closed", so each watcher appears there under the dead student's name, and under "shared" when two players own the student. The audit is whispered to the GMs, so there is no leak, but a GM reading it sees the dead student twice.

**Suggestion:** skip `isDeadWatcher(actor)` there, as user-match.mjs does.

## Looked for and not found

### D2: a kept death reaching a player other than the victim's own

- **The watcher actor.**
  - It is made with `ownership.default` 0, its owners only the student's non-GM owners (spectator-dead.mjs:114-115).
  - anonymity.mjs:654 skips it at create.
  - Every later anonymity repair lowers only a default above Observer (:712, :883), so nothing raises it.
  - It carries E92's flag alone while the death is kept. `watcherOf` is written only by `linkPublicly`, from `markDeceased`, which only a public death or a publication reaches (chapter.mjs:194; `publishDeath` calls `markDeceased` at :562 before dropping the row at :571).
  - Scenario 94's "secret" check holds p1's world to one new actor with E92's flag alone.
- **The token.**
  - `tokenShownTo` hides it from the other players by the actor's flag. Scenario 94 shows p1 hiding it and p3 showing it.
  - Every E92 exemption keys off the actor (`isSpectator` / `flaggedSpectator`: movement.mjs:2884, murder-rules.mjs:3208, fog.mjs:1585, movement-audit.mjs:334), so they cover the watcher, whose user is no Spectator account.
- **The deaths row's link.** The GMs' row gains `watcher.actorId`. The players' copy (`deathCopy`) carries `{ chapter, day, timeOfDay }` alone (gm-stores.mjs:500-510), and the store has no row shaping that would drop the field on restore.
- **Hooks and sounds.**
  - The moment is read only on the token owner's browser (`momentOf`, :301-304), never on a GM's.
  - `playSfx` plays on the calling browser alone (sfx-play.mjs:460; the socket sends are `playSfxFor` and `playSfxForUsers`).
  - F2 is the one payload every browser receives.
- **Lists.**
  - No player screen lists Spectators: `readSpectatorsWith` is read by the GMs' audit alone (sheet-audit.mjs:3309).
  - user-match leaves the watcher out.
  - The Students window is the GMs'.
- **Body discovery.** It is a GM's dialog (`openBodyDiscoveryDialog`), not a token's arrival, so a watcher walking into the room finds nothing.

### Writes

- Every writer of a watcher (`ensureDeadSpectator`, `removeDeadSpectator`, `removeAllDeadSpectators`, `watcherBecomesMonocub`, `monocubBecomesWatcher`) returns early on a non-GM. No bridge action makes or moves one.
- The owner can write the watcher's flags, as any owner can. sheet-audit.mjs `GM_FLAGS` now holds `watcherOf` beside `spectator`, so the GMs' audit puts either back.
- `setSpectator(false)` and `changeRole` refuse a dead student's watcher (monokuma.mjs:245; gm-students.mjs:260-263).
- Making a token of the watcher by hand needs Foundry's token-create permission. I did not check that permission.

### Monocub, revive, reset

- **Corpse and walker.** Every `locateActor` / `gmPlaceOf` / `placesOf` / `roomOfActor` caller that names a victim or a body is either already `body: true` (body-tile.mjs:144, :219; cleanup.mjs `applyMoveBody` by `isCubToken`) or runs before a Monocub can exist (F4's list). F4's `bodyCard` is the one left.
- **Revive.** `removeDeadSpectator` runs before the row is dropped (chapter.mjs:656) and takes the cub tokens too (:165-171).
- **The Students window.** "Alive" runs `setMonocub(false)` (a watcher back), then `reviveCharacter`, which removes it.
- **The reset.** `removeAllDeadSpectators` runs first. Then `wipeStudent` runs `setMonocub(false)` (a watcher back, flagged), then `reviveCharacter`, which removes it again (season-wipe.mjs:455-456).

### Voice

- The silenced dead go to `SPECTATOR_ROOM` (voice.mjs `voiceClaim`), the owner's Q-C3b-5, with the trade-off written beside it.
- `watchesForTheDead` keeps the watcher out of the rows, the account rows, the trial's actor and the trial's pending test.
- R4550, R4551, R4554 and R3806 pass, and scenario 94's voice check passes.

### Tests

- Each C3b tier-2 test guards its fixture with `must` (a token on a place scene, the kill kept) and asserts one table of values.
- The kept-death test's "hidden" is `tokenShownTo` called with a stub viewer, not a second browser. Scenario 94's "seen" check is the real one.
- None measures nothing.
- No test covers F1's case.
