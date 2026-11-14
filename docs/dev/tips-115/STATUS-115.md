# The tooltip sweep (1.2.115) - status

Branch `claude/tips-115` from main `9e7e3d78` (1.2.114). R numbers R7300-R7329. The owner's answer to Q-E57-8
(page DRPG-Q113, #81, 14.11.2026): "Robic teraz" - every control the module draws gets a tooltip or a hint.

## 1. The recount (C0)

Counted with E102's census (`tools/tooltip-census.mjs`, read-only; `node tools/check.mjs tooltips`), which rebuilt the
scanner the 395 came from (E57 prep, docs/dev/e57/MEASURE-coverage.md B.1) and was widened after REVIEW-102. Its method
and its limits are its header; it reads source, not a drawn window.

| | E57 prep (4dfac3a, 1.2.108) | E102 prep (421f239, 1.2.109) | here, 9e7e3d78 (1.2.114) |
| --- | ---: | ---: | ---: |
| control sites (closing words apart) | 542 | 549 | 647 in 92 files |
| with neither a tooltip nor a hint line near | 395 | 390 | 242 |
| of which a baseline row "none needed: ..." | - | - | 225 sites (224 rows) |
| of which "help in code" (a tooltip the census cannot follow, held by pattern) | - | - | 13 |
| of which "conditional" (a tooltip under a named condition) | - | - | 4 |

So E102 (1.2.112-1.2.114) had already given most of the 395 their tooltips. What the owner's "now" covers is the 225
sites E102 left as "none needed": that reason was the writing agent's, and the review page's verdict store was empty
when E102 built (docs/dev/e102/STATUS.md), so the owner never saw it. Measured 14.11.2026, `node tools/check.mjs
tooltips` on 9e7e3d78.

## 2. Status

| Step | State |
| --- | --- |
| C1 red: R7300 and the census retire "none needed" | done, 307f63fb: R7300 red (225 sites), `check.mjs tooltips` red (224 rows) |
| C2 the 224 rows read against the code, by family (Actions, Trial, Gm, Setup, Case, More) | in progress |
| C3 keys merged (DRPG.Tips.Sweep.*), baseline cut, gate green | - |
| C4 full tier 1, scenarios 95 and the touched ones | - |
