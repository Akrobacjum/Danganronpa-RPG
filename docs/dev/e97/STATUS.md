# E97 (then E98, E99) - status of the work line, branch claude/e97-98

Kept current by the line's agent. Newest state first in each section.

## Done

- **C1, C3, C4** (from the earlier patch e97-c1c3c4, made on b97028e1): applied with `git am --3way` onto f22a7e8.
  Two conflicts, resolved: (1) `docs/dev/R-REGISTRY.md` (generated) - regenerated from this base with
  `node tools/registry.mjs --write` for each of the three commits; (2) `scripts/tests-tier0.mjs` at the end of
  REGRESSIONS - this base's last test (R3345 and after, E49) and the patch's R3373 both appended there, both kept.
  The registry tool stamped R3370-R3376 "E48" (the patch's STATUS saw the same for three of them); set to E97 by
  hand in the next commit. Commits: a881094 (C1), 12334f7 (C3), d2889c6 (C4).

## In progress

- C2, the panel's fixed frame.

## Next

C5 (Map read), C6 (edits on the Map), C7 (who holds what, live counts), C8 (consistency), C9 (Map default),
C10 (realization), C11 (question at Body found), C12 (GM panel list), C13 (handbooks, glossary, captures); then E98's
remainder per its plan, then E99.

## Not done, and why

- **C0 (ledger)**: not mine to write. tools/stages.json is the coordinator's (the brief). E97 and E98 read
  `planned` there; the version and `touches` (the plan proposes `["scenes", "sockets"]`, Q-E97-12) are for the
  coordinator at registration.

## Defaults taken, owner to confirm

(none yet beyond the owner's answers already recorded in E97-DECISIONS / QUESTIONS)

## Blockers

None.

## Test results

(per push, below)

## Screenshot pages

(none yet)
