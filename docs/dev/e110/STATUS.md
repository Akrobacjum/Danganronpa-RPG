# E110 - status of the work line, branch claude/e110-114

Class Trial: the GM redirects an Objection, the modes mute who may not speak (1.2.114). Started 14.11.2026 on
claude/fervent-sagan-gme4vt at 6dd02975. R numbers: R7100-R7149.

The owner's words (14.11.2026): "Do class trial - dajmy opcje przekierowania objection gmowi, tzn zmiany celu
trwajacego objection." and "Tryby class trial (objection i rebuttal, a takze inne jesli to potrzebne) niech wycisza
automatycznie graczy, ktorych nie dopuszczaja do glosu."

## C0 - the spec this line builds to

| id | promise | how it is checked | commit |
| --- | --- | --- | --- |
| E110-01 | Re-point works in the Objection's minute and in its Rebuttal; the target is judged as a fresh Objection's (not the objector, a participant, alive) and present (a player connected) | R7100, R7101, E110-T1 | C1 |
| E110-02 | One step writes every copy of the target: the floor, the card (found by the stack's newest entry, so the GM's card road works), its flags, the receipt; the clock is not restarted | R7100, E110-T1 | C1 |
| E110-03 | A public card says the GM redirected the Objection, naming objector and target | R7100, E110-T1 | C1 |
| E110-04 | Both GM roads ("floor.repoint", "trial.gm" op `repoint`) end in the same step; a second press at the same target writes nothing | E110-T1, scenario 33/30 | C1 |
| E110-05 | While a floor with a speaker stands, every player whose voice character may not speak is blocked (BROADCAST_AUDIO), by the existing settle and store | C2 tests | C2 |
| E110-06 | No speaker - Closing volunteer/choice/decide, Scrum Sides/Confer, Debate, Straw Poll, Logic Dive - mutes nobody by mode | C2 tests | C2 |
| E110-07 | GMs never, Spectators by their switch, Monocubs never (P6), a GM's hand block never restored | C2 tests | C2 |
| E110-08 | Restored exactly at the floor's end, the turn's passing, the trial's end, a season reset and a primary change; nothing stays muted after a reload | C2 tests | C2 |
| E110-09 | Panic: only the users whose state changes are written; the count per turn measured | C2 tier 2 | C2 |
| E110-10 | The HUD and the voice line say why: "The floor is X's" (EN, PL) | C2 tests | C2 |
| E110-11 | The vote's opening ends any floor (a round, a zone mode, a debate, an exchange), as it ends a Closing | R7104, E110-T3 | C3 |
| E110-12 | The Event panel's "Next" skips a player who is not here, as the machine passes them | R7104 | C3 |
| E110-13 | A mode opened takes back a Straw Poll's split (no more Scrum offered for the rest of the trial) | R7104, E110-T3 | C3 |
| E110-14 | A Scrum speaker's thesis has a button and a window (Post thesis) | R7104 (the footer); the window itself not driven headless | C3 |
| E110-15 | A Scrum speaker has Done and Pass; a speaker whose player leaves passes | R7104, E110-T3 (Done, a stale and another's Pass); `speakerGone` read, not driven (no harness disconnect) | C3 |

## The owner's decisions after the brief (14.11.2026, through the coordinator)

- **1.2.114 is E110 alone** ("Niech 1.2.114 bedzie etapem na zmiany w class trial"); everything else moved to 1.2.115.
- **D-E110-A: Monocubs are muted too** ("W tych trybach monocuby tez maja byc wyciszane"). Answers Q-E110-5 against its
  default. P6 is the A9 voice design's principle (E78, the design read on 11.10.2026, kept outside the repository; cited in
  voice.mjs `micHold` and voice-tile.mjs as "the design's P6"): a Monocub's microphone is never held by the module. From
  14.11 it reads: never held, except by a trial mode that does not give them the floor. Restored as a student's is.
- **D-E110-B: each Class Trial mode has its own playlist** ("Kazda minigra w class trial niech ma wlasna playliste w
  muzyce"): Nonstop Debate, Objection, Rebuttal, Testimony, Panic Round, Closing Argument, Straw Poll, Logic Dive; an
  unset mode plays what plays today; the Rebuttal a state of its own, the Objection's minute as today.
- **D-E110-C: Scrum Debate has three playlists** ("Scrum trzy playlisty niech ma"): Sides, Camps confer, the debate's
  turns, each falling back as the others; the switch at each phase change, on the primary only. Replaces "one shared".
- **E110 part 3, sounds**: the coordinator's survey of 14.11 (fixes 1-3, new sounds 4-7, texts 8-10), after parts 1-2.
  Not built by the owner's default "no": start stings for Testimony and the zone modes, the rarer moments (Final Trial
  or Mastermind, an Objection lapse, Tinker, Ghost Bet, a Bribe, a Spectator move, a door forced told to the room), a
  separate Night Eclipse music state. No audio file is added to the repository.

## Questions for the owner (each default taken)

- **Q-E110-1** Who may be the redirect's target: as a fresh Objection's (not the objector, a participant, alive) and
  present (a player connected). In the Rebuttal the pair rule for a third party's cut-in does not apply to the GM.
  Default: as written.
- **Q-E110-2** The clock is not restarted by a redirect. Default: as written (the brief's).
- **Q-E110-3** The brief lists the stack entry's `before[].before.targetId` as a copy of the target. It is not: it is
  the target of the floor the Objection interrupted (a Rebuttal's answerer, for an Objection inside a Rebuttal), which
  an Overrule restores. Changing it would hand a redirect's target a Rebuttal they never had. Default: left as it is.
- **Q-E110-4** (C2) A pending Objection (the objector picking the Truth Bullet) mutes the others too: the floor is the
  objector's from the press. Default: yes.
- **Q-E110-5** Monocubs keep design P6: never held by the module, by mode either. Default was: keep P6. **Answered by
  the owner 14.11: Monocubs are muted by the modes too (D-E110-A).**
- **Q-E110-6** (C2) A player whose voice character is a living student who is not a participant is held by mode like
  a participant who does not have the floor. Default: yes.
- **Q-E110-8** (C3) The vote's opening ends any floor, with no card of its own (the vote's card tells the table); a
  Logic Dive stopped by it keeps where it stopped. Default: as written.
- **Q-E110-9** (C3) Any mode's start takes back a Straw Poll's split - a debate included. Default: as written.
- **Q-E110-10** (C3) The Scrum thesis is posted from the speaker's turn window (Post thesis), during the turn only, as
  often as the primary accepts. Default: as written.
- **Q-E110-11** Both GM roads are kept: the console's Re-point asks "floor.repoint", the API and another GM's
  `floorStep` ask "trial.gm" op repoint; both run the one step. Default: keep both (the brief named "trial.gm").
- **Q-E110-7** (C2) Muting by mode starts only once a road entered the trial (the trial's list written, E70's rule for
  the dead): a clock written raw blocks nobody. Default: as E70.

## Progress

| Commit | What | Tests |
| --- | --- | --- |
| C1+C2 (one commit: the two share floor-machine.mjs, trial-floor.mjs and the lang files) | Redirect: machine `repoint` row in the Objection and its Rebuttal with a public card; `repointRefusal`; `repointObjectionInStep` writes floor, card (by the stack), flags and receipt (`repointCopies`) in one step for both GM roads; bar and dialog open in the Rebuttal. Muting: floor-machine.mjs `floorSpeakers`; `settleTrialVoices` blocks by it; settles on every trialQueue write; `floorHold` lines in micHold, trialVoiceLine, moduleHoldsMic; EN/PL | R7100-R7103 red at 6dd02975, green after; E110-T1, E110-T2 red at 6dd02975, green after; R3909 and the bar's census test changed on purpose (Re-point open in the Rebuttal); R220, R311, R432 census rows |
| C3+C4 | Gaps: the vote's opening ends any floor (trial-floor.mjs `endFloorForVoteInStep`, trial-modes.mjs `endFloorForVote`); `MODE_OPENS` take back a Straw Poll's split; events.mjs `roundNextId`; zone-machine.mjs Scrum `done`/`pass`/`gone`, trial-modes.mjs Scrum branch of `turnOnPrimary`, `speakerGone` for a Scrum speaker; trial-prompt.mjs Done/Pass/Post thesis in a Scrum turn and the thesis window. Books: GM and player handbooks EN/PL; AUDIT 9.2 LIVE-E110-01..03; scenario 67 phase V, 33 A23 (the Assistant GM's redirect by both roads), 30 a forged "trial.gm" op repoint | R7104, E110-T3 red at 6dd02975, green after; changed on purpose: R1047, R1365 (`turnFooter(` with args), R4752 (36 keys) |

## Not fixed, with the reason

- A disconnected Scrum speaker is passed by `speakerGone` on `userConnected`; the harness cannot disconnect a player, so
  the hook is read (R7104's machine row `gone`) and not driven.
- The thesis window is not opened headless (no scenario seeds a Scrum turn on a player's page); its footer is R7104's.

## Needs a local Foundry (AUDIT 9.2 LIVE-E110-01..03)

- Whether avclient-livekit stops sending without a reload when BROADCAST_AUDIO flips (LIVE-E70-04 is related): a v14
  server, avclient-livekit 0.6.8, a LiveKit server, two browsers.
- How Panic feels with per-turn muting: a table of 6+ players.
- The redirect seen on two browsers (GM and player): a v14 server.
