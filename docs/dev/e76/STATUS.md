# E76 - status of the work line

Stage E76 (compatibility with the newest Foundry and Daggerheart), shipping as 1.2.106 after the coordinator's 1.2.105.
This line's own branch (e76-106), started from the coordinator's 1.2.105 line at f22a7e87. Plan: `docs/dev/plans/E76.md` on
the planner's branch (plan-130). This file is the work line's record; the coordinator merges and releases.

## Versions, as measured on 12.11.2026

| Package | Module targets now | Newest found | How measured, by this line |
| --- | --- | --- | --- |
| Foundry VTT | `minimum` 14.364, `verified` 14.365 | **14.370**, page dated 02.11.2026, "Version 14 Stable 12"; 14.369 dated 08.10.2026 | foundryvtt.com refused by this session's network policy (proxy 403 on `curl https://foundryvtt.com/releases/14.370`). Read through a web search that returned foundryvtt.com/releases/14.370 and /14.369 with their dates: **secondhand**, the notes themselves not read. Daggerheart 2.12.8's system.json says `verified` 14.370, which agrees. |
| Daggerheart | `minimum` 2.6.5, `verified` 2.6.5; harness relay copy 2.10.11; dice copy 2.10.5 | **2.12.8**, tag commit 71c318de25, 2026-11-11T01:49:58+01:00 | `git ls-remote --tags` and shallow fetches of github.com/Foundryborne/daggerheart; dates are the tags' commit dates, not release dates. 2.12.8's system.json: Foundry `minimum` 14.364, `verified` 14.370, `maximum` "14". |
| Dice So Nice | required | **6.4.5** (newest tag) | `git ls-remote --tags` of gitlab.com/riccisi/foundryvtt-dice-so-nice |

`module/systemRegistration/socket.mjs` sha1 prefix, read with `git show <tag>:... | sha1sum`: 2.10.11 59fbfd4bd9, 2.12.4
59fbfd4bd9, 2.12.8 89f7472022 - the plan's figures hold. The only change from 2.10.11 to 2.12.8 is the UpdateSaveMessage case
(`saveTotal`, `isCritical` in place of `result`; `!data.data` guard).

## Done

- **C2 - the save packet in both shapes** (relay-guard.mjs `judgeSave`). Red first: R3600 failed on the tree without the fix
  with "a save in 2.12.5's shape for the sender's own token is not forwarded (a save with no roll in it) - expected
  "forward", measured "drop"", and scenario 33's new check "A8: a player's save in Daggerheart 2.12.5's shape is marked on
  the card" failed with `saves2: null` (scenario run on a copy of the tree with the old guard, `DRPG_REPO`). Green after:
  R3600 and R133 pass; scenario 33 74/74.
  - The guard reads 2.12.5's shape (`saveTotal`, `isCritical`) when the packet has a `saveTotal` key, else the old
    `result.roll`. It forwards the one judged total in **both** shapes (`saveTotal`/`isCritical` and `result.roll`).
  - **Deviation from the plan, owner to confirm:** the plan said to forward "in the shape the running build's handler
    reads", read off the handler text, and to widen the fingerprint to read the UpdateSaveMessage arguments. Read in the
    code: the case lives in Daggerheart's `EVENT_HANDLERS`, which the wrapped listener (`handleSocketEvent`) only reaches
    through a `Hooks.on` callback; neither text holds the arguments, so the guard cannot read them. Forwarding both shapes
    works for either build without knowing which runs. A third shape is still not seen by the fingerprint (the plan's
    risk 6.2); this line did not add a second signal.
  - Mutants (on a copy of the tree, R3600 + R133): forward without `saveTotal`/`isCritical` - KILLED; owner check dropped -
    KILLED; a null `saveTotal` falling back to `result` - KILLED (after a test was added for it; it first SURVIVED).

## In progress / next

- C4 (old keys `-=`, `==` in both readings, `lib/operators.mjs`), C5 (`PassageMovePolygon` contract), C6 (dice look on
  DSN 6.4 / Daggerheart 2.12), C7 (notes).

## Blocked: the owner's decision

- **C1 - the relay copy from 2.12.8.** `audit/harness/lib/dh-relay.mjs` may not be edited by this line (the owner's rule).
  The change needed: re-copy `module/systemRegistration/socket.mjs` lines from tag 2.12.8 (commit 71c318de25) byte for
  byte, header updated to that tag and its line ranges; in `audit/harness/client-entry.mjs` (the `SaveField.updateSaveMessage`
  stub, line 859) take 2.12.5's signature `(saveTotal, isCritical, message, targetId)` and write
  `{ value: saveTotal, isCritical: Boolean(isCritical) }` (2.12.8 saveField.mjs:149-156). Why: until then the harness runs
  2.10.11's relay, so that 2.12.5's handler marks the card from what the guard forwards is not measured (LIVE-E76-02).
  The two edits must land together: the stub alone would break the 2.10.11 copy's call.
- **C3 - the dice copy from 2.12.8.** `audit/harness/lib/dh-dice/` may not be edited by this line. The change needed:
  re-copy from tag 2.12.8 the files that differ from 2.10.5 (`git diff --stat 2.10.5 2.12.8 -- module/dice`: dhRoll.mjs
  270 lines changed, dualityRoll.mjs 82, d20Roll.mjs 77, die/baseDie.mjs 23, helpers.mjs 2, _module.mjs 2; the plan also
  names helpers/utils.mjs, data/action/baseAction.mjs and applications/dialogs/d20RollDialog.mjs) and any new import they
  pull (2.12.8's dhRoll.mjs names `MoveContext` in its JSDoc and adds `createRollInstance`, `temporaryModifierBuilder`,
  `config.skips.createMessage`), then run 83-roll-integrity, 20-crit-hope, 40-flow, 88-flow-length.
  **Finding (read, not run):** `roll-draw.mjs` `reviewBuild` checks the build's structure, not the version. Read in 2.12.8's
  text: `build` still calls `buildConfigure`, `buildEvaluate`, `buildPost` in order (dhRoll.mjs:47-56), the
  `post${...}RollConfiguration` template is at :86, `getHooks` adds 'Duality' (dualityRoll.mjs:117-118), and `fromData`,
  `toMessage`, `buildEvaluate`, `dualityUpdate` are present. So on 2.12.8 the seam would most likely read "ok" and wrap a build
  no one has reviewed against the draw; whether the draw is still right there is not known. This is the plan's Q-E76-5.

## Open questions: defaults taken, owner to confirm

| Id | Default taken |
| --- | --- |
| Q-E76-1 | A light "C0 again" inside E59 before 1.3.0. Not acted on here. |
| Q-E76-2 | Targets: Foundry 14.370, Daggerheart 2.12.8, Dice So Nice 6.4.5. |
| Q-E76-3 | foundryvtt.com not allowed in this session; the Foundry half stays secondhand. Not asked of the owner (the brief). |
| Q-E76-4 | module.json untouched: no `verified` raised without a table run (LIVE-E76-01). |
| Q-E76-5 | C3 not done here at all (blocked above), so the split question is the owner's with C3. |

## Live checks added (AUDIT 9.2, items 475-480)

LIVE-E76-01 .. LIVE-E76-06, as the plan's section 4 proposed.

## Screenshots

None so far: C2 changes nothing a player or GM sees except that a 2.12.5+ save is marked on the card (not drawable
headless; LIVE-E76-02).

## Test results

| When | What | Result |
| --- | --- | --- |
| 12.11, C2 | `node run-tests.mjs --tier 1 --only R3600 --only R133` | 3 passed, 0 failed (red before: 2 passed, 1 failed) |
| 12.11, C2 | `node run-all.mjs scenarios --only 33-bridge-paths` | green, 74/74, 135.7 s |
| 12.11, C2 | `node run-all.mjs lint check gate` | green: lint 0 problems, check 17 parts, gate 37/37 |
| 12.11, C2 | `node tools/config-prose.mjs --check lang/pl.json` | 517 strings, missing 0, extra 0 |
| 12.11, C2 | `node run-tests.mjs --tier 1` (whole) | 1175 ran, 1159 passed, 0 failed, 16 skipped, 1 red (R3339, E48's expected red, on the base), 311.7 s |

## Tokens so far

Not measured by this line (no counter available in the session).
