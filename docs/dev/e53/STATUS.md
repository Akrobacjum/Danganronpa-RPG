# E53 - performance budget and balance log: status

Branch claude/e53-116 (this line's), base e9f4a791 (origin/main, 1.2.115). Plan: docs/dev/plans/E53.md on the
planner's branch (plan-130). E43's last item (projectLabel) is built on the same line (docs/dev/e43/STATUS.md).

## The commits

| Commit | What | Tests |
| --- | --- | --- |
| d1186625 C1 | perf() prints what the table's own work cost (scripts/perf-timings.mjs, diagnostics.mjs `costLines`); the roll's round trip as p50/p95; counters for the notice history, the room tile and `auditMove`; perf-baseline.json revision E53; audit/live/perf-baseline.mjs `parsePerf` reads the new lines and the old; LIVE-E53-01 (AUDIT 9.2 item 553) | R7405; scenario 86 105/105; mutants M1-M8 8/8 |
| d78dd134 C2 | the budget: perf-baseline.json `budget`, held by `node tools/check.mjs budget` (tools/perf-budget.mjs) | 9 planted cases; mutants B1-B7 7/7 |
| c436aacf C4 | E43's `projectLabel(id, user)` (projects-secrecy.mjs `nameAs`, `labelFor`) | R7406; mutants L1-L4 4/4; 72-canary, 93-spectator |
| (P1) | the owner's defect of 15.11 ("a project's action still does not show in Facilities"): one road found red - a secret project's room action reached an insider only on a GM's private card (facilities.mjs `toldFacility`), so a chat log cleared took the row out of the insider's Facilities while the GM's rows kept it. Now the GMs' sight copy carries it to those in on it (projects.mjs `sightFor`, `receiveSight`; projects-secrecy.mjs `toldSight`), the card is read only where the copy says nothing of it, and `tellFacility` sends the sight again | scenario 99's facilities check, red at c436aacf (12/13), green after (13/13); mutants P1-M1..M3 3/3 |

P1's roads, each read on p1 (in on the project) and the GM by a probe on the harness (15.11.2026; not committed):

| Road | p1 | GM | |
| --- | --- | --- | --- |
| public, Dorm A (the control) | shown | shown | as 1.2.115's sweep read it |
| secret, p1 in on it, before the chat is cleared | shown | shown | |
| the same after every message is deleted | **not shown** | shown | fixed (P1) |
| no room, the character in a room | shown | - | |
| no room, the character standing in no room | **not shown** | - | a design call, not built: `facilityRows` and `projectActionsWith` return nothing for a place with no room, and the GM's run refuses "not standing in any room". Whether a roomless project's action shows in a corridor is the owner's |
| a copy of the scene holding the same room names | not measured | - | the harness's scene clone answered the original's id |

Which road was the owner's at the table is still not known; the setup the coordinator asked for decides it.

## Decisions and answers

| Id | Question | Answer |
| --- | --- | --- |
| Q-E53-1 | Does this stage stay on the release line? | kept on its default (owner 14.11); the coordinator gave it to this line |
| Q-E53-2 | D27 (b) makes the budget a blocking gate for 1.3.0 | kept on its default (owner 14.11): the 1.3.0 notes say what is not measured |
| Q-E53-3 | The balance log | **answered 15.11.2026 (owner, through the coordinator): built behind a world switch, off by default, recording only, no rule number changes (D21)** |
| Q1 (this line's) | The budget's numbers | the coordinator, 15.11: each threshold null ("no budget set") until L1 has measured and the owner gives them; nothing on a guess |
| Q2 (this line's) | The budget's test with no run | not a skip (an empty `runs` is a fact of the data, not of the environment): a check part that prints "not measured" line by line while `runs` is empty and holds every run once one is there. It cannot pass by measuring nothing: `hold` runs over every run whenever `runs` is non-empty, and the planted cases (a blocking reading over its budget is red) run first on every call |
| Q4 | E53's `touches` in tools/stages.json | left; the coordinator sets it at the release |
| Q6 | "the card render" | the module's paint of a chat card (private-rolls.mjs `paintChatCard`), not Foundry's render of the message; the line says so |
| Q7 | a counter for "Foundry tools windows" (the 11.10 amendment A9) | **not built: the ask could not be identified in the checkout** |
| Q8-Q10 | the balance log's shape | go with the proposal; the exact count over the 144 throws of 2d12, called "exact count", with criticals and the Hope/Fear split; docs/balance.md English only, one GM handbook line en/pl |

## Read, not built

- **81-render-budget's extension** (the plan: "81 extends to the HUD render, sheets and rings"): 81 counts
  `hud.renderHud` and every sheet's renders since E37 C5, and 86 counts `ownRing`/`remnantRing` rebuilt and kept since
  E88. A second count of the same would hold nothing new.
- **CLAUDE.md's "One check" row** does not name the `budget` part. Nothing holds that row against tools/check.mjs
  `PARTS` (read 15.11.2026: no check, no test; the row already lacks package, comments, fonts, rules and keys). CLAUDE.md
  is the owner's; the coordinator asks.

## For the release that carries E53 (checklist)

- **audit/perf-baseline.json `perfFunction.revisions`, stage E53: `version` is written as 1.2.116, the planned one.** If
  the train ships under another number, write the shipped one there in the release commit: audit/live/perf-baseline.mjs
  `--run` refuses a served build whose version is not the one its body is recorded for.
- LIVE-E53-01 (AUDIT 9.2 item 553) goes in the release notes' "Not checked in a real Foundry" line.

## Not measured

Every millisecond of C1 is jsdom's; the table's numbers are LIVE-E53-01's and LIVE-E33-05's. No run is in
perf-baseline.json `runs`, so the budget holds nothing yet, and says so.
