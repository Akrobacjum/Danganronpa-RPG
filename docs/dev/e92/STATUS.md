# E92 - status (work line claude/e92)

Updated 12.11.2026. Final: all seven commits in, tested, pushed. The plan is `docs/dev/plans/E92.md` on `claude/plan-130` (read whole). Base: claude/e61-62 at 59d1935
(E61, E62 and E94). The census of what a Spectator would be counted in: `docs/dev/e92/CENSUS.md`.

## Done

| Plan | What | Commit |
| --- | --- | --- |
| C0 | The census (52 roster calls, 73 `type === "character"` reads, the early returns that decide for a Spectator), each classified; red tests R3850-R3858, R3858 the census's own guard (it fails on an unclassified new read; it caught spectator.mjs's in C4) | 0c70a0c |
| C1 | `FLAGS.spectator` (a GM's flag, `GM_FLAGS`), `isSpectator`, `setSpectator`, `ownSpectator`; the roster and every list the census named leave it out; nobody in the room (`countsAsPresent`, `maybeThirdParty`); a fourth Role in the Students window with a "Spectators" group; glossary "Spectator" / "Widz" | 81601e2 |
| C2 | The microphone held in every phase (`micHold` "spectator", `spectatorAccount`), blocked by the trial's own write and `trialMuteStore` row and put back as found | c5e654a |
| C3 | The ghost: `crossingVerdict`, `judgeMove`, `auditMove`, `recordDiscovery` pass it over; bridge action `spectator.move` (the five steps; 33 legal control, 30 three forgeries); its token greyed with a dark outline on a GM's canvas; LIVE-E92-01..04 in AUDIT 9.2 | b0e1d68 |
| C4 | `tokenShownTo`: its token hidden from every other player, its view sees every character; its map the class's ledger folded into its own row without the Mastermind's (`spectatorFogSection`), retold on the flag, unticked on the way back (`forgetSpectatorMap`); scripts/spectator.mjs (a leaf) | 3f7c65c |
| C5 | `sheetMode` "spectator"; scripts/spectator-ui.mjs: the line under the clock (its room, "Watch a room" picker through `spectator.move`) and the hidden chat (`drpg-spectator`, components.css) | afc58ba, 91cfc3d |
| C6 | The Spectators' voice room (`SPECTATOR_ROOM`) behind "Talk with the Spectators" (the player's own User flag, honoured for a Spectator's account alone); the microphone opens there only | 348efde |
| C7 | Scenario 92-spectator (ci); R3861 (E61's entry and cut-in, E62's transitions, E94's board as a Spectator sees them); GM and player handbooks EN and PL | 0cf830a |
| fixes | The module's own censuses given the new roads' rows (R6, R220, R379, R432, R553, R382, R1281 - found by the full tiers 0-1 run at C7); 33's ghost check moved before the phases that take the GMs away | c15e378, 9055074 |

New files: scripts/spectator.mjs, scripts/spectator-ui.mjs, audit/harness/scenarios/92-spectator.mjs. Their rows in
`.claude/rules/code.md`'s table are not written (that file is not this line's to touch): for the coordinator.

Tests: R3850-R3861 (tier 1, 12 numbers of 50 reserved); tier 2 "a Spectator's microphone is blocked outside the trial
and in it ..."; flow `spectator-move` (partial until its release); scenario checks in 30, 33 and 92.

## Test results

- Tiers 0-1 whole at C1 (81601e2+edits): 1199 ran, 1178 passed, 0 failed, 16 skipped, 6 red (5 E92 markers, 1 E94).
- Scenarios at C1's tree: 30, 33, 10, 12, 13, 11, 15, 17, 19, 20, 40, 41, 60 green; the run was stopped there, as C2-C6 changed more files.
- Scenario 92 at C7: 10/10 (run-all, 15 s).
- The pre-push run at C7 (0cf830a), on a worktree: tiers 0-1 1179 passed, 7 failed (the seven censuses above, fixed in
  c15e378), 16 skipped, 1 red; own tier 2 (the Spectator's microphone, "the dead are muted for the trial ...", "Back up
  the case ...") 7 passed, 0 failed; scenarios 92, 30, 00, 10, 11, 12, 13, 14, 15, 17, 19, 20, 40, 41, 50, 60, 61, 62,
  63, 65, 66, 67, 71, 72, 73, 74, 75, 76, 81, 83, 86, 87, 88, 89 green; 33 red ("gm has disconnected": my check after
  its no-GM phases), fixed in 9055074 and green (141 s). These are every scenario `git grep` finds naming a changed
  file, but 01 (the whole suite) and 84 (hangs headless).
- At c15e378: tiers 0-1 whole 1202 ran, 1186 passed, 0 failed, 16 skipped, 1 red (E94's). At 9055074: 33 and 92 green.

## Review shots

Round 1: https://claude.ai/artifact/Hp4fmi4bm5u8gCA2EcnX3S - the Students window with the Spectator's Role (both themes,
EN and PL, 1920 and 1280) and the Spectator's line under the clock (both themes, EN and PL, the switch off and on). Drawn
by the harnesses in headless Chromium, not Foundry. Not shot: the GM's grey token (no canvas; LIVE-E92-04), the sheet's
spectator mode (the style harness does not model it), the hidden chat (no Foundry sidebar). Found by the shots and fixed:
the picker cut short under Legacy (91cfc3d). Open: under the glass the picker's arrow stands above its box in the harness.

## Defaults taken, owner to confirm

- Q-E92-1: built on today's code; E72's spec should get a row "the Spectator in each new state".
- Q-E92-2: Polish "Widz" (glossary entry; "Obserwator" is Foundry's OBSERVER level - not a forbidden variant, since lang/pl.json uses it for sheet sharing).
- Q-E92-3: one character actor flagged `spectator`, owned by the player.
- Q-E92-4: the chat log is hidden on the Spectator's browser only; messages still arrive (the GM handbook says so).
- Q-E92-5: a Spectator may become a student again (and back) in the Students window; its own rows are kept, the class's are unticked for it.
- Q-E92-6 (new): a Spectator sees every character's token in an Eclipse too (the plan's "see all characters"). It also sees public projects in the rooms the class found (its map is the class's).
- Q-E92-7 (new): a Spectator's console can still ask the bridge for a student's action on its own character (the guards check ownership, not the role); only the sheet hides the grid. A guard "not a Spectator" on every action road is a larger change; not done.
- Q-E92-8 (new): the "Spectator talk" switch is honoured on the Spectator's document flag in the voice pass (a forged spectator flag on a student, with the switch, sends that student to the Spectators' room, where it is heard); the microphone block itself reads the flag as the GMs hold it.
- Owner's 04.11 plan line "token hidden": done as display (`tokenShownTo`), not Foundry's `hidden`, so the owner can still see and drag it.

## Not done / limits

- LIVE-E92-01..04 (AUDIT 9.2): one LiveKit connection in two rooms, a drag through a wall on v14, the real BROADCAST_AUDIO, the grey token on a real map.
- `forgetSpectatorMap` writes unticks for the character: a GM's Fog tab shows them as unticked cells (as before, not found).
- No `stages.json` row change (the coordinator's); `touches` should be ["sockets", "scenes"] (a bridge action, token moves).

Tokens so far: not measured on this line.
