# E72 - STATUS (work line claude/e72)

Base: f22a7e8 (claude/fervent-sagan-gme4vt, 1.2.105 in progress). Plan: `origin/claude/plan-130:docs/dev/plans/E72.md`.
R range reserved for this line: R3800-R3849. Updated 12.11.2026.

## Done

| Commit | What | Tests (red at base -> green) |
| --- | --- | --- |
| C1 | A Monocub's ability is paid on the GM after its conditions (S18-50, DC13): `performCubAbility` pays nothing, `cubAbilityRefusalOnGm` asks the row, the locks, the price and the target, `cubAbilityOnGm` takes the action and the Hope only then, one Monocub at a time (`serialWrite`); `meddleRefused` EN/PL now says what the reader keeps | R3800 (new), R301 (changed on purpose), tier 2 "a Monocub's Confusion is paid on the GM after its conditions ..." (new), "in an Eclipse the picker is shut and the GM refuses Confusion with nothing paid" (changed on purpose from "... lands on the GM while the picker is shut") |

## In progress

- C2 cubStore and the crime witness.

## Next

C2-C12 (part A), then C13-C21 (part B), then E91.

## Deviations from the plan, and defaults taken (owner to confirm)

- C1: the plan's "config rows gain phases, blocks, caps, visibility, executionCost (a slot, no logic)" is not done as
  empty slots: each field is added in the commit that gives it logic, so no row carries a field nothing reads.
- Q-E72-8 (`meddleRefused` wording): EN takes the audit's sentence "Confusion doesn't reach them. You keep your action
  and Hope."; PL takes text-style O8's shape "Nie tracisz akcji ani Hope." instead of the plan's "akcja i Hope wróciły"
  (nothing was taken, so nothing comes back; R1143 also refuses a Polish refusal that promises a return). Default
  taken, owner to confirm.

## Blockers

None.

## Shots

None yet (C1 changes one sentence of a whisper; no window changes).

## Test results

- C1: red at base (worktree of f22a7e8 with the new test files): 4 failed of the 4 named, each for its stated reason.
