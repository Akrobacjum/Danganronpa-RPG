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
| E110-11..15 | The review's gaps (below) | C3 tests | C3 |

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
- **Q-E110-5** Monocubs keep design P6: never held by the module, by mode either. Default: keep P6.
- **Q-E110-6** (C2) A player whose voice character is a living student who is not a participant is held by mode like
  a participant who does not have the floor. Default: yes.
- **Q-E110-7** (C2) Muting by mode starts only once a road entered the trial (the trial's list written, E70's rule for
  the dead): a clock written raw blocks nobody. Default: as E70.

## Progress

| Commit | What | Tests |
| --- | --- | --- |
| C1+C2 (one commit: the two share floor-machine.mjs, trial-floor.mjs and the lang files) | Redirect: machine `repoint` row in the Objection and its Rebuttal with a public card; `repointRefusal`; `repointObjectionInStep` writes floor, card (by the stack), flags and receipt (`repointCopies`) in one step for both GM roads; bar and dialog open in the Rebuttal. Muting: floor-machine.mjs `floorSpeakers`; `settleTrialVoices` blocks by it; settles on every trialQueue write; `floorHold` lines in micHold, trialVoiceLine, moduleHoldsMic; EN/PL | R7100-R7103 red at 6dd02975, green after; E110-T1, E110-T2 red at 6dd02975, green after; R3909 and the bar's census test changed on purpose (Re-point open in the Rebuttal); R220, R311, R432 census rows |

## Needs a local Foundry

- Whether avclient-livekit stops sending without a reload when BROADCAST_AUDIO flips (LIVE-E70-04 is related): a v14
  server, avclient-livekit 0.6.8, a LiveKit server, two browsers.
- How Panic feels with per-turn muting: a table of 6+ players.
- The redirect seen on two browsers (GM and player): a v14 server.
