# Planning line - status

Updated 12.11.2026. Documents only, in docs/dev/plans/. Plans are read by the coordinator from this branch.

## Done

| Plan | Commit message | Note |
| --- | --- | --- |
| E76 | plan: E76 ready | Versions measured 12.11.2026: Foundry 14.370 (secondhand: foundryvtt.com not reachable here), Daggerheart 2.12.8, Dice So Nice 6.4.5. One break measured in the code: the save packet's shape changed in Daggerheart 2.12.5 and the relay guard would drop a player's save. |

## In progress

- E97, E98, E61, E62, E99 (full detail).

## Next

E92, E94, E64, E93, E69, E74, E73, E72, E54, E55, E56, E25, E71, E91, E57, E59, E38, E39, E40, E43, E53, E58, E26 (lighter),
then README.md (index).

## Skipped

- **E83** ("STOP przed 1.3.0: ten czat staje, audytor recenzuje kod i weryfikuje każdy etap, potem poprawki" - the chat
  stops, the auditor reviews the code and verifies every stage, then fixes). In the audit's own stage list (plan.stages,
  88 rows) it is the penultimate row, directly before E26: this is the owner's "review of all stages". It is the
  auditor session's job, so it is not planned here.
- Not E58, which the brief guessed from tools/stages.json (where E58 is penultimate). E58 ("Weryfikacja końcowa w
  sandboksie, bez stołu") is in the audit's `movedOut` list, not its plan; see the next section.

## A question about scope (for the coordinator and the owner)

E38, E39, E40, E43, E53 and E58 are not in the audit's plan. They are in `plan.movedOut`, whose reason reads (25.10.2026,
the owner's decision): tests, measurements and verification are done at the end by a separate chat, in a separate pass,
by the same method the audit was made with; "these stages left the plan and the calendar; their full entries are here for
that chat". They are still rows of tools/stages.json. Proposed default: write them as light plans anyway (the brief lists
them), each marked as the verification chat's material, not the release line's.

## Blockers

- foundryvtt.com is refused by this session's network policy; Foundry release notes were read through web search only.

## Tokens (rough running estimate)

About 0.35 million so far (audit extraction, version research, E76).
