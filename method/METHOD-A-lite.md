# Method "A-lite" (the owner, 25.10.2026 ~22:15Z: "zgoda, zrobmy ograniczone A"), from the first stage after E15 part 2
Source: S/analysis-checks/report.md (8 stages, 79 agents). Applies to every stage workflow prompt and the trains.

1. COMMIT CHECK: every implementer and fixer ends with `git -C <wt> status --porcelain` empty (its work committed with its
   QUICK line). A next agent that finds a dirty tree commits that work first (after its quick) and says so.
   7 of 12 majors/blockers in the end reviews were uncommitted groups.
2. quick.sh: lint/check/gate, prose, tiers 0-1 (t01) and the commit's own tier-2 tests. NO local scenarios (--scen ""),
   except a scenario file the commit itself edits. Scenarios are CI's (local scenario steps: 0 regressions caught).
   Block on the run (no polling loops).
3. Fix round: fewer, larger groups; each group's commit runs quick with --no-t01 (lint/check, prose, own tests); the LAST
   group runs the full quick (t01). (quick.sh was 32% of fix-round cost.)
4. Mutants: only for MARKED commits (trust-model roads) and fix-round code on those roads; the spec's list, no extras.
5. End review: lenses "correctness" and "goal" always; "security" only when the stage's tools/stages.json `touches`
   includes "sockets" (or the spec has a Write roads table). Otherwise fold the trust checklist into correctness.
6. Red-first tests stay (cheap; caught wrong specs). CI on every push stays.
7. CRLF dispatch per train only when the train changes a test that reads source text (tests-tier0/1 readers, check.mjs,
   tools/) or before 1.3.0; otherwise the train notes say it was not run and why.

## Amendment 26.10 (orchestrator, measured): related tier-2 tests in quick
Two trains in a row went red in CI on OLDER tier-2 tests that an intended change broke (1.2.85: the backup test vs a new
store; 1.2.86: the cleanup-DC test vs the owner's Q7, and E14-T10 vs E16 fix G2), because quick runs tiers 0-1 and the
commit's OWN tier-2 tests only. From E17 on, each implementer and fixer also passes to --own the tier-2 tests whose source
names a function, store, setting or bridge row the commit changed (git grep the changed symbols in scripts/tests-tier2.mjs;
cap ~15 tests; say which in the commit message). Still no local scenarios.

## Amendment 26.10 evening (orchestrator, measured): older scenarios that read a changed rule
CI on 204a5d72 (E17 p1) went red in scenario 66 (I1-I4, P2): E12's checks read 'stands unlawfully where it jumped', E17 C1 puts
the jump back - an intended change no local run saw. From E17 p2 on, a commit that changes a rule, a message or a bridge code
also runs the older scenarios that git grep finds naming it (cap 2) in quick's --scen. Still no blanket local scenarios.
