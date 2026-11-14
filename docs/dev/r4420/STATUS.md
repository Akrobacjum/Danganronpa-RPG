# R4420's red under load - STATUS

Line `claude/r4420-113`, base `claude/fervent-sagan-gme4vt` at 1463f22b (the 1.2.113 assembly). R block R6850-R6869;
R6850 taken. Every number below was measured here: 14.11.2026, this container (4 cores), the headless harness
(`audit/harness`), unless it says otherwise.

## 1. What other lines read (not checked here)

R4420 red in 1 of 3 full tier-1 runs on line E71-D (366dbfcc) and in 1 of 7 on the E54 rebuild, `release` the only
field that differed both times; alone (`--only R4420`) 3 of 3 green on both. Those runs' readings were not kept (the
test printed only true/false), so which of the three ways below they were is not known.

## 2. The repro

| Load | Runs | Red | Reading |
| --- | --- | --- | --- |
| R4420 alone, idle | 1 | 0 | hold 2, handBack 3001, release 3401 ms |
| R4420 alone, 8 busy loops in other processes (`node -e 'for(;;){}'` x8) | 7 read | 0 | handBack 3000-3002, release 3401 every run: another process's load does not stall the page's thread |
| full tier 1, instrumented copy | 1 | 0 | handBack 3000, release 3400; 1605 tests, 500.8 s wall. Stopped after one run: at about 8.5 min a run and 1 red in 3-7, it could not tell a fix from luck |
| **R4420 alone, stalls on the GM page's own thread** | **20** | **6** | the load used below |

The load: inside R4420, just before the entry is played, a timer on the GM page that busy-loops for 150-600 ms
(uniform), waits 100-700 ms (uniform), and again, until the readings are taken - a page whose main thread stalls, as a
slow table's does. It lives only in scratch copies of the tree, never committed; the copies differ from the commit only
by it and by printing the calls' times in the failure message.

The six reds at 1463f22b (times from the stand-in's clock, ms):

| Run | handBack | release | Field red | Way |
| --- | --- | --- | --- | --- |
| 13 | 3255 | 3401 | back | the hand-back cut short by the end: 146 of its 400 ms (the module's defect) |
| 17 | 3360 | 3401 | back | the same: 41 of 400 ms |
| 3 | 3000 | 3687 | release | the end's timer 287 ms late, every call in order (the test's window) |
| 10 | 3001 | 3756 | release | the same, 356 ms late |
| 15 | 3228 | 3753 | release | the same, 353 ms late |
| 2 | 2999 | 3443 | back | the hand-back's timer read 1 ms early (Node's timer clock counts whole ms from its turn's start) |

## 3. The root cause

Two, one in the module and one in the test.

1. **The module** - `scripts/sequence.mjs:258` at 1463f22b, `ctx.at(times.end, () => endSequence("ended"))`, with the
   hand-back at `drawTrialEntry`'s `at(T.end - T.hand, ...)` (`scripts/sequence.mjs:514-518`). The end was a timer at
   3400 ms and nothing else. A stall that delays the hand-back's timer (due 3000) does not move the end's (due 3400),
   so the hand-back's 400 ms cross-over is cut short, to nothing when both timers are overdue as the stall ends: the
   copies go (`host.remove()`) while the live curtain is still near 0 and rising - the blink the hand-over removed, back
   on a slow table. The trial's exit draws with the same function, so it had the same defect.
2. **The test** - R4420 held the hand-back and the release each to `[want, want + 250]` ms on `performance.now()`
   (`near`, `scripts/tests-tier1.mjs` R4420 at 1463f22b). Any stall over 250 ms around 3400 ms made it red with every
   call in order, and a timer read 1 ms early made it red too.

## 4. The fix

- `scripts/sequence.mjs` `playSequence`: a sequence's context has `endNotBefore(ms)`; the end comes at `times.end`
  (behind the gate, shifted as `at` shifts it) and no sooner than every `endNotBefore`, both checked on
  `performance.now()` when the end's timer fires, re-armed while early. `drawTrialEntry` asks `endNotBefore(T.hand)`
  as it hands back. Escape and a cut still end at once.
- R4420 reads order and lower bounds: held before the play answered, handed back over `hand` no sooner than
  `end - hand - TICK` (TICK 2 ms), let go no sooner than `end` nor than `hand` after the hand-back, the host gone by the
  release's own turn; raw times. No upper bound on the wall clock: a release that never comes leaves the calls short at
  `until`'s deadline.
- R6850 (new): the entry and the exit on a stand-in, with a stall the test plants itself - a busy loop from
  `end - hand - 100` to `end + 50` ms - so it reads the same on an idle machine and a loaded one; `stalled` says the
  stall took.

Red first, at 1463f22b with the test change and without the code change: R6850 FAIL, `full: false` for the entry and
for the exit, every other field as wanted; R4420 green alone (no stall). With the code change: both green.

## 5. Before and after, the same load

| Tree | Runs | Red |
| --- | --- | --- |
| 1463f22b (the old R4420, the old end) | 20 | 6 |
| 1463f22b + this change (the new R4420, the new end) | 25 | 0 |

That the load ran in the 25: 3 more runs of the same copy printed their readings - 4-5 stalls of 191-511 ms each, the
hand-back at 3001 and the release at 3482, 3642 and 3489 ms, each at least 400 ms after it. Not measured: the new R4420
on the old end under the load (it would be red on runs like 13 and 17; R6850 is the case that shows it every run).

## 6. The checks on the tip

- `npm run quick` in `audit/harness` on 1463f22b + the change: lint 0 problems in 377 files, check 21 parts green,
  gate 37/37.
- Full tier 1 (`node run-tests.mjs --tier 1`) on 1463f22b + the change: 1590 passed, 1 failed, 16 skipped, 0 red; 1606
  tests, 474.8 s wall. The one failure is R2001 (53 stale quotes of a stage's planned version, e.g. scripts/utils.mjs:154
  "E57 quoted at 1.2.124, the ledger plans 1.2.114"): not this line's - it failed alike on the instrumented copy of the
  base, and the base commit is the one that moved the plan to 1.2.114 (`tools/stages.json`).
- The scenarios that play a sequence, `node cluster.mjs scenarios/<n>.mjs` on 1463f22b + the change: 96-late-sequence
  8/8, 69-day-boards 8/8, 93-spectator 18/18, 74-room-tile 46/46, 63-class-trial 77/79. 63's two reds, E5 and I7 (the
  vote window's privacy note against gm2's copy of the ballots), read the same on the base without the change
  (77/79, 106 s), so they are not this line's.
- To run again after the E54 merge, on the tip: quick, full tier 1, R4420 and R6850 under the load, the five scenarios.

## 7. Needs a local Foundry

- Whether a real table's browser stalls past the hand-back's frame and the cut-short hand-back is seen as a blink:
  reasoned from the timers and the hold's code, not seen. It needs a real table on a slow machine (or a v14 client with
  CPU throttling in the browser's devtools), playing Start the Class Trial and End the trial under Stained Glass.
- Not a local-Foundry item, not done here: the same in Chromium on the glass harness with the page's CPU throttled
  (Playwright's CDP `Emulation.setCPUThrottlingRate`), which would read the hand-back's frames; no such probe exists
  for the entry yet.

## 8. Log

- 14.11.2026: repro, cause, fix and the measurements above, committed on 1463f22b (the session's stop hook asked for
  the work pushed). Once E54 lands, claude/fervent-sagan-gme4vt is merged in and the change put in the split file.
