# STATUS-GAPS-61 - three gaps on claude/gaps-61

Base: origin/main 235c3210 (v1.2.107). Written 12.11.2026. Every commit `[skip ci]`; no CI run.

## for the coordinator

### 1. Scenario 61-gmstore-case, red under load - harness timing, F9 (not D5)

- Rate at 235c3210, `node cluster.mjs scenarios/61-gmstore-case.mjs`, 20 runs in rounds of 4 in parallel on 4 cores:
  **1 of 20 red**, F9 alone: the killer's player held one opening roll where two were expected
  (`held: [["finesse",true]]`), read 800 ms after the second GM's re-ask returned. D5 held (fixed in 1.2.107).
- Cause, measured: a probe of 61 (not committed) stamping each roll p3 held against the moment gm2's re-ask began, 32
  loaded runs, both rolls held in every one: at 4 in parallel the second roll came 20-537 ms in, against the read at
  808-1376 ms; at 6 in parallel 99-888 ms, against 816-1046 ms (888 of 1027 the closest). The delivery grows with load
  toward a fixed read. The red run's own log holds no arrival time, so "late, not lost" for that run rests on the probe
  runs and the controls, not on a reading of it.
- Fix (78ccdde4, harness only, no module code): F9 reads p3 once it holds two rolls, or after 5 s.
- Controls (scratch copies, one run each): p3's second roll delayed 1500 ms - before the fix F9 red with the same
  `held`, after it green; p3's second roll never held - after the fix F9 still red.
- Rate after the fix, same method: **0 of 20 red**.

### 2. The Rest window's empty rest name - module (3c884aa2)

- Cause: rest.mjs `restVariants` asks `restRoomsSentence(kind, "DRPG.Rest.allowedIn", {}, ...)` for each choice's
  hint, data with no `kind`; on a map with no rest room the fallback formats DRPG.Rest.noRooms with
  `kind: data?.kind ?? ""`. The refusal's road (`performRest`, wrongRoom) passes `kind` and was whole.
- Fix: the fallback names the rest by `kindLabel(kind)` when the data carries none.
- R3663 (tier 1): the sentence asked as `restVariants` asks it, on a scene with no rest room, with lang/en.json's and
  lang/pl.json's words. Red at 235c3210 ("marked for a  yet", "oznaczony pod ."), green after. Tier 2 "the Rest window
  names no rest room the viewer has not found" green; tiers 0-1 1231 passed, 0 failed.

### 3. "Every control ... has a name" after R3551 - module (this branch's a11y commit)

- The reading to test was a fixture left in the DOM. Measured: nothing is left - R3551 closes its three windows in its
  `finally`, and no element with an `r3551-` id stands after it. What stays is a11y.mjs's report: `unnamed` kept a
  nameless kind from its first sight for ever, so the report named a control in a window that no longer exists - for
  any window a GM opens and closes, not only the suite's.
- Fix at that source: weak references per kind; the report lists a kind while one of its elements is on the page and
  counts the kinds met only in windows since closed on a line of its own.
- Red first: R3551 then the naming test at 235c3210 - red; after - green. R3664 (tier 1) red with the old report
  (`offListed: true, offCounted: false`), green after. Tiers 0-1 1232 passed, 0 failed, 16 skipped.

### Numbers to know at the merge

- R3663 and R3664 are this branch's; gaps-a used R3660-R3663 on its own line (to be renumbered), and main already has
  an R3661 of E97's.
- Not measured: a real Foundry table, a screen reader.
