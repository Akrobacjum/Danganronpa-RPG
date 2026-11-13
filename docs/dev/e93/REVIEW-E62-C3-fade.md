# REVIEW-E62-C3-fade: the death fade, the fixes of F1-F5, and the frames, on origin/claude/e72

Read on 13.11.2026 by the E93 line, over 45448ef2..09256a04:
- 12d0a57c: scripts/death-fade.mjs, the curtain's listener;
- 7704d049: the fixes for REVIEW-E62-C3b.md's F1-F5;
- 09256a04: the frames in docs/dev/e62/shots/, and the voice and room tiles' art greyed with their batch.

Line numbers are 09256a04's. This was a read, plus one computation of the flash plans (below). I ran no scenario or tier-2 test on this range; the coordinator did not ask for one.

## F1-F5: fixed as meant

| # | Fix | Test |
| --- | --- | --- |
| F1 | monocub.mjs:572 adds `isMonocubCorpse(token)` to the witness loop | tier 2, "a Monocub's corpse is no witness": corpse in the incident's room marks nobody; cub token there marks it |
| F2 | No `studentId` in any token option (spectator-dead.mjs:139, 169, 178, 236, 268). `momentOf` (:305-317) names the student on the owner's browser (`ownStudentOf`, :319-323) | named in a test |
| F3 | `isCorpseToken(tokenDoc)` (movement.mjs:1552-1555) is read by the veto (:1503), the GMs' judge (:1109) and `followBody` (body-tile.mjs:319) | the tier-0 census row reads `isCorpse(?:Token)?` |
| F4 | events.mjs:598 asks `locateActor(victims[0], { body: true })` | R4560 (a source read) |
| F5 | One update with `forcedDeletion()` for the mark, `unsetFlag` after only where Foundry has no operator (spectator-dead.mjs:266-269) | named in a test |

Notes on the fixes:
- **F3.** The new comment answers what I left open: a GM's move skips the owner's veto, so the follow mattered.
- **F5.** This follows the form call-effects.mjs:432 uses.
- **F2, one note.** `ownStudentOf` takes "a dead one first" by `isDeadForGm`, else the player's first student. On a player who owns two students and whose copy does not hold their own kept death, the hook's `studentId` can name the wrong one. death-fade.mjs does not read `studentId`, so nothing goes wrong today; a later listener should not trust it for a player with two students.

## death-fade.mjs

| # | Severity | Where | What |
| --- | --- | --- | --- |
| G1 | low-medium (traced twice) | death-fade.mjs:287-310; settings.mjs:2921-2938, 3111-3114 | The rest state misses a public death or a revive that makes no token moment, and stays wrong on the victim's browser until a reload |
| G2 | low | death-fade.mjs:223-226, 273; spectator-dead.mjs:167-172 | A revive of a Monocub that is not silent draws the return from bare glass on a curtain that was lit |
| G3 | low | tests-tier1.mjs, R4559 | The title says a revive is "drawn back to lit"; the cases hold only a silent revive |
| G4 | note | death-fade.mjs:279-284, 293 | Escape's listener does not stop the key, so the same Escape also reaches Foundry's own handlers |

### G1 - the rest state misses public deaths and revives with no token (traced twice)

**Trace 1: who sets the rest state.**
- `setRest` is reached from four places:
  - at ready (:290);
  - from a moment (`onDeadMoment` → `playCurtain`, :269-276);
  - from Escape (:282);
  - from `drpgDeathsChanged`, after 1.5 s with no moment (:304-310).
- A moment comes only from a token hook carrying the option (spectator-dead.mjs `registerDeadSpectator`: createToken, deleteToken, updateToken).

**Trace 2: when `drpgDeathsChanged` fires.**
- Only from `onDeathsChange` (settings.mjs:3111-3114), the `onChange` of `gmDeaths` and `mineDeaths` (:2925-2938): the GMs' kept deaths and a player's copy of them.
- The comment there says the deceased flag's own `updateActor` does not reach it.

**So:**
- **A public death with no token anywhere.** `killCharacter` with `secret: false`, the Students window's "dead", or an execution leads to `ensureDeadSpectator` making the watcher actor with no token (spectator-dead.mjs:132, no `place.tokenDoc`). No moment comes and no kept copy changes, so the victim's curtain stays lit until a reload.
- **A revive of a public death whose watcher had no token.** `removeDeadSpectator` deletes the actor alone (:183-186); actor hooks are not read. So the curtain stays bare on a living student's screen until a reload.

A kept death is covered: its copy changes, and the 1.5 s settle sets the rest state. The header (:297-301) says the settle covers "a death whose body has no token", which holds only for a kept death.

**Suggestion:** settle the rest state the same way on `updateActor` of a character this user owns when `deceased` or `monocub` changes, or read the option on `createActor` / `deleteActor`. The watcher's create and delete already carry it (spectator-dead.mjs:125, :184). Add a test where a student with no token dies publicly and is revived.

### G2 - a Monocub's revive that is not silent

`removeDeadSpectator` deletes a Monocub's cub token with `{ phase: "return", silent }` (spectator-dead.mjs:167-172). `onDeadMoment` maps "return" to `playCurtain("return")` (:273), which starts with every batch layer at opacity 1 (:223-226). But a Monocub's curtain is already lit (`restsBare` is false for a Monocub), so the player sees the glass go grey at once and then light up again.

**Reachable from:** a call of `reviveCharacter` without `silent`, which `game.drpg` exposes (api.mjs:830). The Students window and the reset pass `silent: true` (gm-students.mjs:643, season-wipe.mjs:456).

**Suggestion:** send "return" only for the watcher's tokens; a cub token's delete could go as `silent`, since the Monocub's rest is lit already.

### G3 - R4559 measures half its title

R4559 says "a Monocub's return and a revive drawn back to lit". Its cases hold `{ phase: "monocub" }`, drawn, and `{ phase: "return", silent: true }`, at rest. A revive that is not silent (`{ phase: "return" }`) is not among them. Today it runs the same `playCurtain("return")` as "monocub", so the case would pass if added.

### G4 - Escape

`onEscape` is a capture listener on `document` (:293) that sets the end state and lets the event go on. The same key press then reaches Foundry, which may close a window. I did not check what sequence.mjs's `holdEscape` does with the key, so this is only a note.

## The questions asked

- **Only the victim's own browser.**
  - The moment reaches `onDeadMoment` only through `drpgDeadSpectator`, which `playMoment` calls after `momentOf` checks that this user owns the token and is no GM (spectator-dead.mjs:305-311).
  - The other entry, `setRest(restsBare())` at ready and after a kept-death copy changes, answers false on a GM, on a living student's player and on a player with no student (:115-125, R4558). There it only removes classes and layers that are not there.
- **Nothing of a kept death reaches the other players.**
  - The file writes nothing and sends nothing (:9).
  - Its classes and layers are on this page's `document.body` alone.
  - The one value every browser receives, the token options, no longer carries the student's id (F2).
  - The fade's timing is read by no other browser.
  - A knower of the kept death (the killer, a witness) also runs the 1.5 s settle on a copy change. It answers false for them, so nothing changes.
- **Silent, reduced motion, the sequences switch and Escape never animate.**
  - `onDeadMoment` sends every `silent`, `!on` and `still` moment to `playCurtain(..., { still: true })`, the end state at once (:271-273), and "spectator" goes to rest always (:274). R4559 holds the fade's three cases.
  - Escape sets the end state (:279-284).
- **Edit campaign.** gm-campaign.mjs calls no death writer here: no `killCharacter`, `markDeceased`, `reviveCharacter` or `setMonocub`. The writers that are not silent are the deaths in play:
  - murder-rules.mjs:2380, :2830, :3388;
  - the trial's execution (trial-progress.mjs:174);
  - the GM's death dialog (chapter.mjs:818);
  - the Monocub's acceptance (monocub.mjs:446).
- **The flash rule.** I computed `flickerOnsets(fadePlan(...))` with transitions.mjs `flashRate`, a one-second sliding window (:48-56), from the file's pure part:

  | Plan | Onsets (ms) | Worst second | Ends at (ms) |
  | --- | --- | --- | --- |
  | Fade, Stained Glass | 780, 1380, 1980, 2580, 3000, 3300 | 3 | 3600 |
  | Return, Stained Glass | 90, 780, 1180, 1580, 1980, 2380 | 3 | 2470 |
  | Fade, Legacy | 780, 1380, 1980, 3000, 3300 | 2 | 3600 |
  | Return, Legacy | 90, 1180, 1580, 1980, 2380 | 3 | 2470 |

  At most 3, as R4557 holds. A flicker is counted at its colour-back or its dim: one dip of 90 ms is one flash.
- **Nothing left running at rest.**
  - The plan's timers are kept in `running.timers` and cleared by `stopRunning`, which `setRest` calls, including from the rest step itself (:235).
  - The settle timer is one 1.5 s timeout per copy change, not repeated.
  - There is no `requestAnimationFrame` and no observer.
  - The batch layers are removed at rest (:158).
  - The rest state's CSS (stained-glass.css, danganronpa.css) is static: a `filter` and a `backdrop-filter` with grey, and no animation or transition at rest. The frost's backdrop gains `grayscale(1) brightness(0.62)` on top of its own blur. I did not measure its cost at a table; `perf()` there is the place.

## The frames

I looked at docs/dev/e62/shots/death-fade-glass-fade-0-lit.png and -3-rest.png (1366x768). At rest the glass, the tiles and the room tile's art are grey and darker, while the HUD's words, the Despair skulls and Hope keep their colours, as the header says (only the glass goes out). I did not compare the other twelve frames frame by frame.

## Tests that measure nothing

None found:
- R4555-R4559 assert a table each, on pure plans (R4555-R4557), stand-in users (R4558) or the page's body class (R4559).
- R4560 and the census row are source reads with the kit's cut and a length guard.
- The F1 test is drawn in tier 2.

The gaps are G1 (no test), G2 (no test) and G3.
