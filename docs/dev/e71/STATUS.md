# E25/E71 early pass: status

The texts line's early, conflict-free pass over stages E25 ("Teksty, polszczyzna i podręczniki") and E71 ("Redakcja UI
EN i PL"), on the branch `texts-e71`, started 12.11.2026. It is not E25 or E71 shipped: it edits only texts no open
branch touches (`FROZEN.md`), changes values in place (keys, order and indentation kept), and records every change in
`CHANGES.md` for the owner's review. The stages' C0 census, batch files, screenshots and lint mode changes are not done
here.

## Areas done

| Area | Commit | Keys / lines changed | Rules |
| --- | --- | --- | --- |
| spelling | (this file's first commit) | en 48, pl 8 | EN1/DB9 (American spelling), glossary `window-room-setup`, PL-i/D33c (`gm-a`), PL-f/DB30 (`safeword`) |

## Text rules exercised ("to confirm in E71"), and the outcome

Only rules whose status in `docs/text-style.md` says "to confirm in E71" are listed; a rule already confirmed is applied
without a row here.

| Rule | Where it was applied | Outcome |
| --- | --- | --- |

## For the coordinator

Texts that seem to say something the code does not do, or need a decision before they can change. Nothing here was
edited.

| File:line | Key / section | What | Why it was left |
| --- | --- | --- | --- |
| docs/handbooks/gm-handbook.en.md (section 9.1, frozen by e93) | "Neighbours" column | The UI now writes the Room setup column "Neighbors" (EN1); the handbook's frozen section 9.1 still says "Neighbours" | Frozen; E57 or the branch's owner aligns it after the merge |
