# The rest of E57: T8, T11 and T12 on the handbooks (14.11.2026)

Branch `claude/handbooks-t8-113`, from `claude/e57-tools` at 6cd30a92 (which holds claude/e71-a d575470c and
claude/fervent-sagan-gme4vt 123f8242), with `claude/handbooks-113` 370ae1e4 merged in, so the checks read the
rewritten handbooks. Counts are `node tools/check.mjs text --all`'s.

| Check | At 6cd30a92 (the handbooks before the rewrite) | After the merge of 370ae1e4 | Now | Mode now |
| --- | --- | --- | --- | --- |
| T8 glossaryHits | 27, all in docs/handbooks | 1 | 0 | FAIL |
| T11 loanGender | 12, all in docs/handbooks | 5 | 0 | FAIL |
| T12 loanDeclension | 17, all in docs/handbooks | 0 | 0 | FAIL |

The rewrite (E57 C6-C11) had already cleared 50 of the 56: the new text writes the glossary's forms.

## The six left after the merge

- T8, gm-handbook.en.md:738, "the piece's own Room Setup values": fixed to "Room setup" (glossary window-room-setup).
  R431's `joins` regex pins the sentence: changed with it, test data only (red on the new line with the old regex,
  green with the new).
- T11, five candidates, all false readings of the detector, none a wrong Polish word:
  - gm-handbook.pl.md:557 "pulę Despair, która" and :1749 "zmiana Hope, która": "która" is the feminine noun's
    before the term ("pula", "zmiana"); the term is its complement.
  - gm-handbook.pl.md:1334 "kopia, której Remnant zniknął": "której" is "whose", agreeing with "kopia".
  - gm-handbook.pl.md:939 "Remnant ciała" and player-handbook.pl.md:845 "Truth Bullet ciała": "ciała" is the body's
    (genitive of "ciało"), read as a feminine past form ("-ła").

Five of five to an allow table would be the detector being wrong (the coordinator's fifth), so the detector was fixed,
red first: four lines added to its fixture in scripts/tests-text.mjs (`TEXT_FIXTURES.loanGender`, DRPG.Fx.r-u), all
four flagged by the old detector (R1058 red), none by the new; then `loanGender` learnt three things - `NOT_PAST`
("ciała", "ciało", "działa"), `WHOSE` ("której", "których" before a term prove nothing), and a "który" form after a
term's comma is not held to the term when the word before the term is a noun of the relative's gender (`NOUN_ENDS`:
feminine -a/-ę/-ą, neuter -o/-e). Run on 6cd30a92's handbooks, the new detector drops one of the old twelve findings,
"zmiana Hope, która", the same false shape; the other eleven, real errors the rewrite fixed, are still found there.
What this costs: a real disagreement right after a feminine noun ("pulę Truth Bullet, która" meant of the bullet) is no
longer seen; a reading, not measured on a planted case beyond the fixture.

No allow rows were written.

## FAIL switches

`TEXT_MODES` in scripts/tests-text.mjs (the task named tools/text-lint.mjs; no such file exists in this tree, the
modes live here): glossaryHits, loanGender and loanDeclension from "report" to "fail", in the commit that brings each
to 0. R1058's list of modes changed with them (red before, green after).

## Tests

R numbers R7060-R7064 were given; none was taken: the detector's change is held by R1058's fixture, and the T8 fix by
R431. The record of runs is in the report to the coordinator.

## The rules check after the merge

`node tools/check.mjs rules` (tools/rules-parity.mjs, E57 C2) was green at 6cd30a92 and red at the merge of 370ae1e4:
11 of its anchors were written on the handbooks before the rewrite, and the rewrite reworded those sentences ("no unit
states it any longer"), and its self-check's two plants looked for old words. Repaired in tools/rules-parity.mjs: each
anchor written again on the new sentence, capturing the same config numbers in the same order; "crisis.brochure" taken
out, because the brochure now gives the three crisis thresholds as table rows, which the generated CRISIS_ACTIONS row
rules read (its plant moved to CRISIS_ACTIONS.leaveClue.threshold); "trial.rounds" reads the Panic Round's row of the
modes' table, since Testimony's row has its own rule (trial.testimony); the plants are "(Hope najwyżej 6)" in the Polish
brochure and "4 to 5 actions" in the GM handbook. The Polish GM handbook's Panic Round row gave its numbers in another
order than the English ("od 12 uczestników proponowane 10 s"); written "proponowane 10 s od 12 uczestników", so the
check can still see a swapped number. After: 52 rules, 0 problems; self-check 14 of 14 plants seen.
