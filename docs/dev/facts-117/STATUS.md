# facts-117: the handbook facts files against the handbooks

Line C3, branch `claude/facts-117` from `origin/main` ff3e12e5, 16.11.2026. The tool: `tools/handbook-facts.mjs`.

## Scope as it stands

| Item | What | State |
| --- | --- | --- |
| 1 | `docs/handbook-facts.player-handbook.en.json`, whole | done, `check` 0 problems |
| 2 | `docs/handbook-facts.gm-handbook.en.json` | not done, by the owner's choice (16.11.2026, "nie trzeba"): found, not fixed |
| 3 | a gate in `node tools/check.mjs text` | written, red until line C1's brochure fix is merged before it (below) |

The brochure's file is line C1's (`claude/e40-117`), not touched here.

## What was found at ff3e12e5

Measured with the tool's `check` function called in Node, against a fresh split of each handbook. Do not count the
CLI's output through a pipe: `check` ends with `process.exit`, which cuts piped stdout short. Through a pipe the GM
file's run stopped after 2531 lines. Written to a file, the same run gives all 8846 lines (8845 problems and the
summary).

| File | Facts | Units | Problems | Facts with a problem | Place | Keyword |
| --- | --- | --- | --- | --- | --- | --- |
| player handbook | 2744 | 595 | 2693 | 2464 | 2429 | 265 |
| GM handbook | 7222 | 1294 | 8845 | 6877 | 6670 | 2178 |
| player brochure | 280 | 55 | 2 | 2 | 0 | 2 |

(The place and keyword columns can overlap: one fact can have both, and one fact several keyword problems.)

All three files were written at E57, 90e01c50. Against a split of the handbooks at 90e01c50, the player handbook's and
the brochure's files have 0 problems. The GM handbook's file has 1: s13.r23.f4's place names line 1178, its unit
starts on line 1182. So that one was already wrong when E57 wrote it.

## Method (player handbook)

1. Split the handbook at 90e01c50 and at ff3e12e5 (`split`).
2. Match units by content, not by id: key = kind, alert, table head, text, all exact. First a longest common
   subsequence of the two key sequences (keeps order, so repeated texts pair in order). Then any unmatched new unit
   whose key an unmatched old unit has (a moved unit). None was moved out of order.
3. A list item is read with its lead-in (prompt rule 2): a matched list item whose lead-in (the nearest non-item unit
   above it in its section) changed is regenerated too, not carried.
4. Matched units: their facts carried with the new unit's id, place and f-numbers. Text, kind and keywords are as E57
   wrote them, and each fact keeps its field order.
5. Changed and new units: facts written by one agent with the tool's prompt (`node tools/handbook-facts.mjs prompt`),
   given one units file and nothing else. Where a regenerated list item's lead-in was not itself regenerated, the
   lead-in went into the units file as context and its facts were dropped on merge (1 unit, 1 fact dropped).
6. Merge in the new split's order, check, count.

A keyword problem on a matched unit would mean a wrong match. None can arise here: the keywords are checked against
the text and the head, and both are part of the match key. `check` reports 0 keyword problems.

### Counts

| | Player handbook |
| --- | --- |
| units at 90e01c50 / now | 591 / 595 |
| matched, carried | 566 (same id 519, id moved 47) |
| matched, lead-in changed, regenerated | 2 (s16.p23, s16.p24: their lead-in s16.p21 changed) |
| changed (an old unit in the same gap) | 23 |
| new | 4 |
| removed | 0 |
| regenerated in all | 29 |
| facts carried / dropped | 2557 / 187 |
| facts written by the agent, kept | 277 (278 written, 1 of a lead-in given as context) |

For comparison, the GM handbook, which was not regenerated: 1281 / 1294 units, 1205 matched (same id 995), 76
changed, 13 new, 0 removed. That would be 6651 facts carried and 89 units to regenerate.

### Check and count

- `check` before: 2744 facts against 595 units, 2693 problems. After: 2834 facts against 595 units, **0 problems**.
- `count` before: 2744 facts on 585 units; rule 1749, number 337, condition 407, exception 85, example 18, tip 68,
  warning 60, reason 20.
- `count` after: 2834 facts on 589 units of 595, 6 with none (s2.p3, s3.p3, s4.p8, s4.p11, s8.p5, s16.p11, all of
  them carried units that had no facts at E57 either); rule 1758, number 340, condition 442, exception 105, example 17,
  tip 85, warning 66, reason 21.

### Spot-check: 20 regenerated facts against their unit's text, by hand

Taken evenly through the 277 regenerated facts (from the 4th, every 13.85th).

| Fact | Kind | Reading |
| --- | --- | --- |
| s1.p22.f1 | rule | right |
| s1.p22.f14 | number | right ("at no cost") |
| s2.p1.f7 | condition | right ("without one" read as "without an Eclipse", the sentence's own antecedent) |
| s3.p23.f1 | condition | right |
| s4.p33.f2 | number | right |
| s4.p34.f1 | rule | right |
| s4.p43.f12 | warning | right |
| s4.p44.f1 | rule | right, but it names "Force the Door", which stands in the unit's place (its heading), not in its text |
| s4.p44.f15 | rule | right |
| s5.p4.f7 | rule | right |
| s10.p10.f5 | rule | right |
| s10.p31.f5 | rule | right |
| s12.p3.f11 | rule | right |
| s12.p10.f8 | rule | right |
| s12.r14.f12 | rule | right |
| s15.p2.f11 | condition | right |
| s16.p21.f5 | tip | right |
| s16.p22.f11 | rule | right |
| s16.p25.f2 | reason | right |
| s17.p24.f5 | rule | right |

20 of 20 state what their unit says; 1 of them (s4.p44.f1) takes a name from the heading.

## The gate (item 3)

In `tools/check.mjs`, part `text`, after the handbook splits:

- each file of `FACTS_HELD` (the player handbook's and the brochure's) is held by the tool's `check` to a fresh split
  of its handbook, red on each problem (the first twenty listed, the rest counted);
- `FACTS_LEFT_OUT` names the GM handbook's file, with why (the owner's decision of 16.11.2026, its state at
  ff3e12e5) in a comment at the entry, and prints one line saying it is left out;
- a `docs/handbook-facts.*.json` in neither list is red, and so is a name in either list with no file;
- a control: the first held file with one place changed must give exactly one problem more.

The coordinator's note gave the GM file's state as "about 3367 problems". The comment gives the measured 8845,
because "about 3367" was probably a count of piped output, cut short (see above).

Shown, each run being `node tools/check.mjs text`:

| Tree | Result |
| --- | --- |
| this branch, as pushed | red: the brochure's 2 problems (s0.p1.f2 keyword "Module 1.2.112", s5.r1.f1 keyword "DRPG Settings"), nothing else |
| this branch with those two keywords fixed for one run (to "Module 1.2.116" and "Danganronpa RPG settings"), then put back | green, exit 0; brochure 0 problems, player handbook 0 |
| player handbook's file of ff3e12e5 put back (in a scratch copy) | red: 2693 problems in that file |
| a `docs/handbook-facts.player-handbook.pl.json` added (scratch copy) | red: "is neither held to its handbook nor left out by name" |
| the GM handbook's file removed (scratch copy) | red: "is named here but missing" |
| `check` broken to return [] always (scratch copy) | red: the control, "gives 0 problem(s) more, not 1" |

So the gate goes green only once line C1's brochure fix is in. It has to be merged after that fix, never before it.

## Not done

- The GM handbook's facts file: left as found (8845 problems at ff3e12e5), by the owner's choice of 16.11.2026.
