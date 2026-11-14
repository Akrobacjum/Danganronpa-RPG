# The handbooks line (E25's handbook part, E57 C6-C11) - status

Branch `claude/handbooks-113`, from `claude/fervent-sagan-gme4vt` at 1463f22b (1.2.112), started 14.11.2026.
Files: the six handbooks in `docs/handbooks/`, their facts files, this file and `LABELS.md` beside it.

## Order of the work

| Step | What | State |
| --- | --- | --- |
| 0 | Read: plans E25 and E57 (plan-130), e57-prep, e71's CHANGES and FROZEN, the audit's issue texts (lines-board `issues.json`, `plan.json`) | done |
| 1 | E25's handbook part: contradictions, D13, D14, D5, D33c-D33f, the Polish glossary, features since the plan | done (d8fbb34f D33c; 68f80f8c player and brochure; the GM pair and the tests' D33c forms next) |
| 2 | E57 C6-C8: the English handbooks by the guide | not started |
| 3 | E57 C9-C11: the Polish handbooks from the facts and the old Polish | not started |
| 4 | Reviews (English, cold, Polish in three steps, mechanics), labels brought up to date, tier 1 | not started |

## Readings taken at the base (1463f22b, 14.11.2026)

- `wc -l`: GM 1411 / 1411, player 950 / 950, brochure 78 / 78.
- `node tools/check.mjs text`: green; Polish ids, kinds and lines as in English for all three pairs.
- e71's FROZEN.md froze sections for branches open on 13.11. Of them E64, E72, E91, E93, E69, E100 and the gaps,
  dh-212b and project-token-icon lines have shipped (tools/stages.json, 1.2.110-1.2.112); the branch heads that
  still show commits past the base (e61-62, e93, e72, e64, gaps-a, e101, e101b, e64-inv) are the tails of shipped
  work. The plan (E57 C6-C8) rewrites every section, so this line treats the freeze as lifted.

## Tests whose handbook sentences changed (the coordinator's yes of 14.11.2026: test data only, each fact still held)

| Test | Old pinned text | New pinned text | The fact it holds | Red on the old line, green on the new |
| --- | --- | --- | --- | --- |
| R321 (tests-tier0.mjs :13697, :13708, :13709, :13717, :13719) | Polish "GMa" (5 sentences) | "GM-a" (D33c) | the Class Trial's world copy, the dead objector refused, the verdict's runner, Skip once, the Level Up latch | red at d8fbb34f with the old regexes, green after (`run-tests.mjs --tier 1 --only R321`, 14.11) |
| R431 (tests-tier0.mjs :14406, :14408, :14410, :14417, :14418) | Polish "GMa", "GMem", "GMowie" (5 sentences) | "GM-a", "GM-em", "GM-owie" | a rename carries keys, the rename record, the body records, the put-back of a player's mark, one student one witness | the same |

## Where this line follows the UI, not the decision, until the text lines land

- "pool" (Tier pools, Room pools, The global pool, `DRPG.Tables.*`, `DRPG.Vault.globalPool`): D33d says "table", but the
  UI still says "pool"; the handbook names what the GM sees, so the GM handbook keeps "pool" in both languages (40 words
  the E25 pass had changed were put back). To change with the labels once the text lines rename them.

## Needs a local Foundry

(filled as found)

## Questions, each with the default taken

(filled as found)
