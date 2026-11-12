# Planning line - status

Updated 12.11.2026. Documents only, in docs/dev/plans/. The coordinator reads the plans from this branch.

## Done

All 29 plans and the index ([README.md](README.md), with the order and each plan's estimate).

- Full detail: E76, E97, E98, E61, E62, E99.
- Lighter: E92, E94, E64, E93, E69, E74, E73, E72, E54, E55, E56, E25, E71, E91, E57, E59, E26.
- Lighter, and marked as material for the verification chat (moved out of the plan by the owner on 25.10.2026):
  E38, E39, E40, E43, E53, E58.

E76's measured versions (12.11.2026): Foundry 14.370 (secondhand, because foundryvtt.com is not reachable from here),
Daggerheart 2.12.8, Dice So Nice 6.4.5. One break was measured in the code: Daggerheart 2.12.5 changed the save packet's
shape, and the relay guard would drop a player's save.

## In progress

Nothing.

## Next

Nothing planned. A plan can be refreshed on request, for example E76's census on the day its work line starts.

## Skipped

- **E83** ("STOP przed 1.3.0: ten czat staje, audytor recenzuje kod i weryfikuje każdy etap, potem poprawki": this chat
  stops, the auditor reviews the code and verifies every stage, then the fixes). It is the penultimate row of the audit's
  own stage list (plan.stages, 88 rows), directly before E26, so it is the owner's "review of all stages". It is the
  auditor session's job and is not planned here.
- **Not E58**, which the brief guessed from tools/stages.json (where E58 is the penultimate row). E58 is in the audit's
  `movedOut` list, not in its plan, and it is planned lightly here, as described next.

## Scope question (for the coordinator and the owner)

E38, E39, E40, E43, E53 and E58 are in `plan.movedOut`, not in the audit's plan. The owner's reason (25.10.2026): tests,
measurements and verification are done at the end by a separate chat. They are still rows of tools/stages.json. Each of
their plans asks whether the stage stays on the release line; the proposed default is no. One exception: S17-31 (E43)
must be closed before 1.3.0 (see E43's Q-E43-2).

## Blockers

- foundryvtt.com is refused by this session's network policy, so E76's Foundry half is secondhand (Q-E76-3).
- Sources outside this checkout: the joint E97/E98 design, E61's mockups and diagnosis, and AUDIT-DEFERRED-31.10.md.
  Each plan names what it could not read.

## Tokens (rough running estimate)

- About 2.4 million tokens in the 11 plan-writing subagents, by their reported usage.
- About 0.5 million in this session.
- About 2.9 million in all.
