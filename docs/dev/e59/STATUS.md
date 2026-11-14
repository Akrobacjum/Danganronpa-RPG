# E59 on the 1.2.113 line - status

Branch `claude/e59-113`, from `claude/fervent-sagan-gme4vt` at 123f8242 (the 1.2.113 assembly, E54 landed). Started
14.11.2026 on the coordinator's brief. R numbers: R6750-R6799 (R6750-R6756 taken). The plan:
`git show origin/claude/plan-130:docs/dev/plans/E59.md`. Already in the base before this line (13.11.2026): C0 (the ci
record, audit/gate/ci-record.mjs), C4 (the stamps), C5, C5a and C5b (CHANGELOG.md by tools/changelog.mjs, macros/
taken out, audit/README in English, the issue and PR templates, BRANCHES.md).

## Items

| Item | State | Where |
| --- | --- | --- |
| C2 - every window, as tests | done: seven rules, each a tier 0 test over every window (162 in 165 sites) with a planted case; the small breaches fixed red first; the rest kept with a reason and a line of GAPS.md | scripts/tests-windows.mjs, R6750-R6756, WINDOWS.md (the census by name), commit d2f9c54b |
| C1, headless - expectedRed to 0 | nothing to close: 0 markers at the base (`node tools/stages.mjs check`), 0 scenario `expectedRed` options; the ten known leaks are all Foundry limits | GATES.md, "expectedRed: 0" |
| C1, headless - the gate list | done: each gate of the plan's point (1), whether it exists, its command, whether ci runs it, and for each not run the reason and the stage | GATES.md |
| C6 - the gap list | see GAPS.md | GAPS.md |
| C3 - the screenshot rating | not this line (Q-E59-4's default: the auditor's pass after the local gate) | "Needs a local Foundry", below; LIVE-E59-01 |

## What C2 fixed, and what it kept

Fixed (commit d2f9c54b, each red first in R6753-R6755):

- nine window sizes under 11 px at the slider's 80 % under Monokuma Legacy, floored at 11px in danganronpa.css;
- the select pickers' chosen option was gold (utils.mjs `injectSelectPickerSkin`): now the attention colour;
- a Key Remnant's ring on the map was gold (remnant-ring.mjs `TYPE_TOKEN`), its badge Evidence since E48 K1: now
  Evidence's.

Kept, each with its reason in tests-windows.mjs and a question below: the room picture in Foundry's ImagePopout
(ROOT_OUTSIDE); three closing words whose label the kit never draws (FOOTER_KNOWN); 21 sizes under 11 px outside the
windows (FLOOR_OUTSIDE); Monokuma Legacy's red "on" state and the GM panel's red tiles (RED_KEPT).

## Owner's questions (each with the default this line took)

| Id | Question | Default taken |
| --- | --- | --- |
| Q-E59-11 | The room's picture opens in Foundry's own ImagePopout, the one window without `.drpg-ui` (room-tile.mjs `openRoomImage`). Move it onto the kit? | Keep it as Foundry's picture viewer; R6750 names it in ROOT_OUTSIDE |
| Q-E59-12 | Does the 11 px floor hold off the windows too - the sheet's pixel-font rows (9-10 px), the clock, the status bar, the Event panel, the Despair meter, the voice tile (6.4-7.2 px at 80 %)? | No: the floor is the windows' (the plan's point (3)); the 21 sizes are listed for the release notes |
| Q-E59-13 | Under Monokuma Legacy a pressed mode, a chosen node and the GM panel's tiles are drawn in the eye's red. Is that "red only on the GM's road"? | Yes for now: a state's colour under Legacy and the GM's own window; listed for a fix window if the owner says otherwise |
| Q-E59-14 | Three windows name their closing word "Not now" / "Not yet", and the kit draws "Close" (ui-kit.mjs:128 writes the role's own word). The GM handbook (gm-handbook.en.md:864) and LIVE-E113-01 say **Not yet**. Which word stands? | The kit's: one word closes a window. The dead labels and their lang keys go in a fix window with the handbook line, on the text lines (R6753 holds them in FOOTER_KNOWN until then) |
| Q-E59-15 | A known leak that is a Foundry limit prints as "expected red" in a scenario's summary (run-all.mjs). Call it "Foundry limit" there? | Yes, in a fix window; it is a word, not a marker |
| Q-E59-16 | The gate names "runContract on 2.10.5"; module.json now says Daggerheart minimum 2.6.5, verified 2.12.8. Which version is the contract run owed on? | The verified one, 2.12.8, at E83's local gate |

## Needs a local Foundry

- **C3, the screenshot rating** (LIVE-E59-01, AUDIT 9.2 item 529): a Foundry v14 server after E83's local gate; both
  themes, EN and PL, at 1366x768, 1024x768 and 820x1180, as GM and as a player; about 341 screenshots of batches
  V01-V15 plus the A8/A9 surfaces rated by D27's method against 6.05, 5.61, 6.14 and 5.79; styleSnapshot against
  audit/style-baseline.json; the owner's private review page. Plus each window of WINDOWS.md opened once, the room
  picture's ImagePopout and the Key Remnant ring's new colour on the canvas.
- **The local gate's parts** of the plan's point (1): GATES.md, "Needs a local Foundry".

## Test numbers

Filled at the final tip (the report to the coordinator).
