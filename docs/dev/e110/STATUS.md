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

## Questions for the owner (each default taken; all answered 14.11, through the coordinator)

- **Q-E110-1** *(answered by the owner 14.11: default)* Who may be the redirect's target: as a fresh Objection's (not the objector, a participant, alive) and
  present (a player connected). In the Rebuttal the pair rule for a third party's cut-in does not apply to the GM.
  Default: as written.
- **Q-E110-2** *(answered by the owner 14.11: default - the owner: "yes (the clock is not restarted)")* The clock is not restarted by a redirect. Default: as written (the brief's).
- **Q-E110-3** *(answered by the owner 14.11: default - the owner: "leave the stack entry as it is")* The brief lists the stack entry's `before[].before.targetId` as a copy of the target. It is not: it is
  the target of the floor the Objection interrupted (a Rebuttal's answerer, for an Objection inside a Rebuttal), which
  an Overrule restores. Changing it would hand a redirect's target a Rebuttal they never had. Default: left as it is.
- **Q-E110-4** *(answered by the owner 14.11: default)* (C2) A pending Objection (the objector picking the Truth Bullet) mutes the others too: the floor is the
  objector's from the press. Default: yes.
- **Q-E110-5** Monocubs keep design P6: never held by the module, by mode either. Default was: keep P6. **Answered by
  the owner 14.11: Monocubs are muted by the modes too (D-E110-A).**
- **Q-E110-6** *(answered by the owner 14.11: default)* (C2) A player whose voice character is a living student who is not a participant is held by mode like
  a participant who does not have the floor. Default: yes.
- **Q-E110-8** *(answered by the owner 14.11: default)* (C3) The vote's opening ends any floor, with no card of its own (the vote's card tells the table); a
  Logic Dive stopped by it keeps where it stopped. Default: as written.
- **Q-E110-9** *(answered by the owner 14.11: default)* (C3) Any mode's start takes back a Straw Poll's split - a debate included. Default: as written.
- **Q-E110-10** *(answered by the owner 14.11: default)* (C3) The Scrum thesis is posted from the speaker's turn window (Post thesis), during the turn only, as
  often as the primary accepts. Default: as written.
- **Q-E110-11** *(answered by the owner 14.11: default - the owner: "keep both roads")* Both GM roads are kept: the console's Re-point asks "floor.repoint", the API and another GM's
  `floorStep` ask "trial.gm" op repoint; both run the one step. Default: keep both (the brief named "trial.gm").
- **Q-E110-7** *(answered by the owner 14.11: default)* (C2) Muting by mode starts only once a road entered the trial (the trial's list written, E70's rule for
  the dead): a clock written raw blocks nobody. Default: as E70.

## Progress

| Commit | What | Tests |
| --- | --- | --- |
| C1+C2 (one commit: the two share floor-machine.mjs, trial-floor.mjs and the lang files) | Redirect: machine `repoint` row in the Objection and its Rebuttal with a public card; `repointRefusal`; `repointObjectionInStep` writes floor, card (by the stack), flags and receipt (`repointCopies`) in one step for both GM roads; bar and dialog open in the Rebuttal. Muting: floor-machine.mjs `floorSpeakers`; `settleTrialVoices` blocks by it; settles on every trialQueue write; `floorHold` lines in micHold, trialVoiceLine, moduleHoldsMic; EN/PL | R7100-R7103 red at 6dd02975, green after; E110-T1, E110-T2 red at 6dd02975, green after; R3909 and the bar's census test changed on purpose (Re-point open in the Rebuttal); R220, R311, R432 census rows |
| C3+C4 | Gaps: the vote's opening ends any floor (trial-floor.mjs `endFloorForVoteInStep`, trial-modes.mjs `endFloorForVote`); `MODE_OPENS` take back a Straw Poll's split; events.mjs `roundNextId`; zone-machine.mjs Scrum `done`/`pass`/`gone`, trial-modes.mjs Scrum branch of `turnOnPrimary`, `speakerGone` for a Scrum speaker; trial-prompt.mjs Done/Pass/Post thesis in a Scrum turn and the thesis window. Books: GM and player handbooks EN/PL; AUDIT 9.2 LIVE-E110-01..03; scenario 67 phase V, 33 A23 (the Assistant GM's redirect by both roads), 30 a forged "trial.gm" op repoint | R7104, E110-T3 red at 6dd02975, green after; changed on purpose: R1047, R1365 (`turnFooter(` with args), R4752 (36 keys) |

| 08048db0 | D-E110-A: a trial mode mutes a Monocub too (settle, micHold, trialVoiceLine, moduleHoldsMic; handbooks) | E110-T2's Monocub step red before ([1, open, blocked, open]), green after |
| 98f60442 | D-E110-B, D-E110-C: a mode's own music state (Rebuttal, Testimony, Panic Round, Closing Argument, Straw Poll, Logic Dive, Scrum's Sides, Camps confer, turns), each only once mapped; Music tab rows EN/PL; handbook; LIVE-E110-04 | R7105, E110-T4 red at 19991c24, green after |
| (part 3) | Fixes: `floorSounds` (debateOpen only for a debate; yourTurn for a Scrum speaker); yields either order (sfx-play.mjs) with truthBullet -> keyReveal, present and despairCall -> newRule, motive, publicAnnouncement. New: `present`, `stashFound` (and a Find Stash's miss `searchNothing`), `bedroomEntered`; the vote's music state `trial.vote`. Texts: the safeword's no-file line and the handbooks' "needs a file"; musicEnabled hint; Music tab's trial note; stale comments (config.mjs counts, Rest and Listen; messenger.mjs Season setup row); the Messenger switch holds a card's gmAsk (`messengerMuted`) | R7106-R7108 red at 98f60442, green after |

## Part 3: questions and what was not done

- **Q-E110-12** *(answered by the owner 14.11: default)* The yield works in either order now (a winner played in the last 120 ms silences the loser too); a
  winner with no file mapped silences nothing. Default: as written.
- **Q-E110-13** *(answered by the owner 14.11: default)* The Present's sound is heard by the whole table and the GMs; its copies' `truthBullet` yields to it.
- **Q-E110-14** *(answered by the owner 14.11: default)* `trial.vote` runs from the vote's opening (or its count) to the verdict, only once mapped.
- **Q-E110-15** *(answered by the owner 14.11: default)* The Messenger switch silences all three messenger sounds when they come on a card, not only `gmAsk`.
- **Not measured: eclipseStart with dayStart, eclipseEnd with dayEnd.** The harness plays no audio and counts a play only
  for a mapped file; no run here mapped files to both and drove an Eclipse's start and end, so whether they double is
  not known. Left as they are; it belongs to a table or a later harness run (LIVE-E110-05).
- **Not done: per-row hints on the Music tab.** About twenty-five new strings in two languages, a text stage's work by
  docs/text-style.md O16; written here for E71's table.
- **Checked, no change: "the handbook lists Monocub meddling and Confusion as two events".** At this tree the Incident
  row names "a Monocub changing" (`monocub`) and "Confusion" (`meddle`), two keys of the catalogue.
- **Considered and not built (the owner's default "no")**: start stings for Testimony and the zone modes; the rarer
  moments (the Final Trial or Mastermind, an Objection lapse, Tinker, Ghost Bet, a Bribe, a Spectator move, a door
  forced told to the room); a separate Night Eclipse music state. No audio file is added.

- **Q-E110-16** *(answered by the owner 14.11: default)* (the coordinator's 14.11, numbered 16 here: 12 was taken) A murder's mask in the Class Trial: the trial's
  own muting decides and the mask's silent room does not apply there (voice.mjs `masksInForce`, the settle's mask block
  and `micHold`'s "masked" line outside the trial alone; `maskedRow`'s comment fixed). In an Eclipse it stands as before.
  Default: as written. R7109.
- **Shard 1/8 (01-runtests parts A1/A2):** my muting copies no voice row (`placeVoices` rows are untouched by it); the
  mask's rows are no longer made in the trial. Run before the final report, see below.

## Not fixed, with the reason

- A disconnected Scrum speaker is passed by `speakerGone` on `userConnected`; the harness cannot disconnect a player, so
  the hook is read (R7104's machine row `gone`) and not driven.
- The thesis window is not opened headless (no scenario seeds a Scrum turn on a player's page); its footer is R7104's.

## Needs a local Foundry (AUDIT 9.2 LIVE-E110-01..03)

- Whether avclient-livekit stops sending without a reload when BROADCAST_AUDIO flips (LIVE-E70-04 is related): a v14
  server, avclient-livekit 0.6.8, a LiveKit server, two browsers.
- How Panic feels with per-turn muting: a table of 6+ players.
- The redirect seen on two browsers (GM and player): a v14 server.

## Final runs at 3dd5f6d7 (14.11.2026, headless harness, 4 cores)

- tier 1 full: 1612 passed, 0 failed, 16 skipped, 0 red.
- tier 2 by name (E110, Re-point, E70-T8, Testimony, Closing Argument, Scrum, Straw Poll, Objection, music, stash,
  bedroom, E69-T7): 201 passed, 2 failed, 1 skipped. The two: "a close breaks the knife..." leaves a mask standing and
  E69-T7 after it reads that leftover. The pair fails the same at 6dd02975 (this line's base) and at e7a4fece; fervent's
  t2-rest commits (b6c61ced, 99979f8a, 2b43ffde, 93f91a60) address the standing masks. Not this line's; recheck after
  the merge.
- `DRPG_SUITE_SHARD=1/8 node run-all.mjs suite`: 01-runtests 19/22, suite 1614 passed, 1 failed - "one account is only
  ever sent to one voice room" (PlayerThree, A1 with an incident open, and A3): E69 C8's `maskedRow` copy, which
  fervent's 08dd8d34 fixes in the test. This line copies no voice row. Recheck after the merge.
- scenarios: 67 52/53 (1 expected red), 68 34/34, 30 302/304 (2 expected reds), 33 89/90 (1 expected red), 72 135/138
  (3 expected reds), 87 36/36; 0 failed in each.
