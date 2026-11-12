# E25/E71 early pass: status

The texts line's early, conflict-free pass over stages E25 ("Teksty, polszczyzna i podręczniki") and E71 ("Redakcja UI
EN i PL"), on the branch `texts-e71`, started 12.11.2026. It is not E25 or E71 shipped: it edits only texts no open
branch touches (`FROZEN.md`), changes values in place (keys, order and indentation kept), and records every change in
`CHANGES.md` for the owner's review. The stages' C0 census, batch files, screenshots and lint mode changes are not done
here.

How a change was made: a script reads the value at its key path, refuses a frozen key, a `DRPG.Config.*` key and any
change to the set of placeholders (N2), writes the new value in place on the same line, and logs the before and after.
Every changed key was then searched for in `scripts/` and `audit/harness/` (the key's name and the old wording's longer
fragments), and each test that pins the old wording was run red first and then given the new wording (below).

## Areas done

Counts are changes, one per plural form; a key changed in two areas counts in both. Commits are listed in `git log` on the branch.

| Area | en | pl | Handbook lines | Rules |
| --- | --- | --- | --- | --- |
| spelling | 42 | 8 | 2 (GM section 2, a copy of `Season.roomGuide`) | EN1/DB9 (American spelling), glossary `window-room-setup`, PL-i/D33c (`gm-a`), PL-f/DB30 (`safeword`) |
| naturalness pairs | 0 | 54 | 0 | the 60 pairs of docs/text-style.md section 12, approved by the owner on E65-PILOT-R2 (01.11.2026): 48 that still stood in their key and were not frozen, and 6 plural siblings written in the same shape (PL7) |
| pilot afters | 28 | 33 | 0 | the 40 strings of docs/dev/text-pilot.json, approved by the owner (verdict "ok", 01.11.2026): every after that had not landed and whose key is neither frozen nor config prose |
| X12 colons (PL) | 0 | 81 | 0 | X12 (confirmed in the pilot): "w pokoju {room}", "postaci {name}" |
| caps and please | 8 | 2 | 0 | X16, X8 (to confirm in E71) |
| Remnant in sentences | 85 | 119 | 0 | EN15/PL-r, DB15 (glossary `remnant`, stage E71), DB4 for the Polish cases |

## Text rules exercised ("to confirm in E71"), and the outcome

Only rules whose status in `docs/text-style.md` says "to confirm in E71" are listed; a rule already confirmed in the
pilot (X1, X10, X12, X13, M8, O1-O4 and the rest) was applied without a row here. "Holds" means: applied where the
rule's shape was found, and no applied text needed an exception.

| Rule | Where it was applied | Outcome |
| --- | --- | --- |
| X8 (no "please"/"sorry") | `DRPG.Reroll.rulingVoid` "Please rule again." -> "Rule again." (T5's only X8 find) | Holds. The Polish already had no "proszę". |
| X16 (no ALL-CAPS emphasis) | 9 values: NOT, BEEN, GENUINELY/NAPRAWDĘ, ONE (twice), AND, NOT/NIE inside a sentence | Holds inside sentences. Not applied to banners and card titles (`Vote.banner` "THE VOTE IS OPEN", `Chapter.bodyBanner`, `Mastermind.*Banner`, `Safeword.banner`, `Motive.banner`, `Calls.gatherBanner`), to `Season.resetWord` "RESET" (a word the GM types to confirm), `Legacy.safeword`, the music diagnostics' OFF/MISSING/EMPTY status words, or `Clock.summaryEclipse` "ECLIPSE": these are display type, not emphasis. Proposal for the owner: allow rows in `docs/text-budgets.json` for banner and title keys, so X16 can turn FAIL without them. |
| X15 (no "!") | not applied | All 24 finds are the genre's call-outs: "OBJECTION!" (button, banner, and sentences that name the button) and "Nonstop Debate!". Changing them changes the button's name. Proposal: an allow row for `DRPG.Trial.objection*`, `DRPG.Floor.debateOpenedTitle` and the sentences that quote the button. |
| O8 (a refusal says what the reader keeps) | through the pilot's approved afters: `DRPG.Action.noRoom` ("you keep your action" / "akcji nie tracisz"), `DRPG.SearchTokens.exhausted` | Applied as the owner approved them. The pilot's EN reviewer note (O8 reads wrong on a dimmed tile's reason, `SearchTokens.exhausted`, and before any price, `Actions.notEnough`) is still the owner's: the owner approved both afters with "ok", so they landed as written. |
| M5 / O5 (no digit typed into prose) | the pilot's approved Polish after of `DRPG.Settings.searchTokensPerRoom.hint` says "od 0 do 10" | Landed as approved; still a digit the code knows (settings.mjs:1300-1308 `range: { min: 0, max: 10 }`), as the pilot recorded. Stays to confirm. |
| N1, N2 (keys and placeholders stay) | every change | Holds: the edit script refuses a change to the placeholder set; no key was renamed. |
| X4 (dash aside), X3 ("X, not Y"), X11 (passive) | not exercised | Out of this pass: 1053, 72 and 86 finds, nearly all style, in keys E71's batches rewrite whole. |

## For the coordinator

Texts that seem to say something the code does not do, or need a decision before they can change. Nothing here was
edited unless the row says so.

| File:line | Key / section | What | Why it was left |
| --- | --- | --- | --- |
| lang/en.json:2462 and :2476, lang/pl.json:2663 and :2677 | `DRPG.Chapter.bodyTitle` | The key is written twice in the same object ("A body is discovered" and "Body found"); JSON keeps the last, so the first value is dead text. | A key's removal is not a text change; a code stage decides which one is meant. |
| docs/handbooks/gm-handbook.en.md:488 (section 9.1, frozen by e93) | `DRPG.Vault.neighboursNote`, `neighboursColumn`, `neighboursUnknown`, `Rooms.renamed` | The handbook copies the note's last two sentences (R431 holds the copy) and names the **Neighbours** column, so the column keeps the British spelling in the UI for now. | Frozen section; change the four keys and the handbook line together after e93 merges (EN1, glossary `neighbor`). |
| docs/handbooks/gm-handbook.en.md:1195, :1206 (section 20, frozen by gaps-a) | `DRPG.Contract.instead.token-ruler`, `hook-dice-so-nice-message` | The handbook's contract table copies these two sentences (R1563), so both keep "colour"/"colours". | Same: change key and row together after gaps-a merges. |
| lang/pl.json `DRPG.Passage.mark.to`, `mark.from` | "Tajne przejście do: {room}" | X12 would make it "do pokoju {room}", but the text is drawn on the canvas at a fixed size beside a tunnel's end (R903 measures it), and no screenshot was taken here. | Left; E71's B-batch with a screenshot. |
| lang/en.json `DRPG.Remnant.deathTied.one`/`.other` | "Set the laundry to “Not tied”" | Read as a slip: the Polish says "Przypadkowym ustaw" (set the accidental ones). Changed to "Set the accidental ones to “Not tied” in Investigation." | Changed; please confirm the meaning with the owner. |
| lang/pl.json (130 places) | "Remnants" | Polish sentences use both the inflected "Remnanty"/"Remnantów" (DB4) and the English plural "Remnants" (e.g. "Faint Remnants", "Remnants na mapie"). This pass wrote the inflected forms where it replaced "ślad", and left the existing "Remnants". | Which plural a Polish sentence takes is DB4's question for the owner; many of the places are frozen. |
| lang/pl.json `DRPG.Remnant.projectNote`, `projectNoteUncovered` | "rzut {total} na zatarcie Remnantów" | The English says "rolled {total} to cover their tracks", an idiom; the Polish now names the mechanic (Remnants) instead of the idiom "zatarcie śladów". | Changed (DB15 forbids "ślad"); the owner may prefer another phrase. |
| lang/pl.json (two values) | U+2212 | Two minus signs remain in `lang/pl.json` (T6's baseline rows, E25 C2's own work: the rows' `empties` say E25). | Not touched: the baseline change belongs with E25 C2. |
| scripts/config.mjs and `DRPG.Config.*` in pl.json | config prose | Not edited in this pass at all (see FROZEN.md); the pilot's config afters and pair N25 (`ACTIONS.palm.description`) wait there. | Four open branches change config.mjs by line. |

## Tests whose expected wording changed

Each was run red first on the new lang (`node run-tests.mjs --tier 1 --only R1158 --only R902 --only R904`: 3 failed),
then given the new wording.

| Test | File | Old wording it pinned | New |
| --- | --- | --- | --- |
| R1158 | scripts/tests-tier0.mjs | `DRPG.Calls.armedForYou` en and pl | the pilot's approved afters |
| R902 | scripts/tests-tier1.mjs | `DRPG.Passage.tab.wayOnly` pl "Tylko z: {from}, do: {to}" | "Tylko z pokoju {from} do pokoju {to}" |
| R904 | scripts/tests-tier1.mjs | `DRPG.Passage.list.oneWay` pl | pair N15's after |
| R431 | (no test change) | the GM handbook's copy of `DRPG.Season.roomGuide` (section 2, line 136) | the handbook line was updated with the key |
