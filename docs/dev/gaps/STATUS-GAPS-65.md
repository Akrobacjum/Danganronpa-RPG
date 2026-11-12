# STATUS-GAPS-65 - scenario 65-season X4/X6 (claude/gaps-65)

Base: origin/main 235c3210 (v1.2.107). Written 12.11.2026.

## for the coordinator

- **Root cause: a module race, not harness timing.** The fix is in module code (`scripts/passages-gm.mjs`
  `passagesAfterReset`); a real primary GM can produce the same wrong state.
- A player's copy of the passages is stamped per student by that student's `touch` row (`passageCopyFor`). After the
  season reset's `clear()` that stamp is the clear's watermark, and writing the start-access cells does not move it. A
  copy pushed between the clear and the cells is the empty one at that stamp; the copy after the cells has the same
  stamp and the player's browser refuses it as not newer (`offersCombine`). The player then holds no passage until
  something else touches the character.
- Measured with a probe of 65 (not committed) logging on p1 each `passage.rows` packet and each clock write, 4 copies
  in parallel: the red run had p1 sent `{ids: []}` and then `{ids: [P1]}`, both stamped 1794491553846. Green runs had
  one copy, with P1. The coordinator's guess (the order of p1's cut and the primary's re-send) was close: it is the
  order of two re-sends, at one stamp.
- Fix: after writing the start cells, `passagesAfterReset` touches each student given a passage back, so their
  part is past the clear's watermark and overtakes any copy sent mid-reset. The doc comment that said no touch row was
  needed is corrected.
- Red first: R554 gains "each such student's stamp is past the clear (`cleared()`)": red at 235c3210 `[false,false]`,
  green after. R599 changed on purpose (its after-reset cell list now leaves out `touch/` rows, as its before-list did).
  Green by name: R554, R555, R556, R558, R560, R561, R599 (tier 1); E15-T10, E15-T13, E15-T14 (tier 2). Quick green.
- Rate of scenario 65 (`node cluster.mjs scenarios/65-season.mjs`), 20 runs each, in rounds of 4 in parallel on 4 cores:
  - before (235c3210, a scratch worktree): **4 of 20 red**, each X4 and X6 together
  - after (8ec660aa): **0 of 20 red**, 59/59 with the 2 expected known leaks each
- Commits: 8ec660aa (fix + R554), then this file. `[skip ci]` on both; no CI run. Not measured: a real Foundry table.
