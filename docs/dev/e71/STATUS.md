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
| Remnant in sentences | 85 | 119 | 4 (GM section 1's quote of `Vault.descriptionNote`, player section 11's tables note; EN and PL) | EN15/PL-r, DB15 (glossary `remnant`, stage E71), DB4 for the Polish cases |
| overexplains (T29) | 14 | 13 | 18 (player handbook: starting resources, the Eclipse, Rooms, Voice, Truth Bullets, the messenger's waits and Note, the settings window; EN and PL) | T29, the owner's rule of 12.11.2026, added to docs/text-style.md section 2 |
| handbooks: GM-a | 0 | 0 | 67 (Polish handbooks, unfrozen sections) | PL-i/D33c (glossary `gm-a`, scope handbooks) |
| Polish grammar | 0 | 4 | 0 | no bracketed gender endings ("zgłosił(a)"): the sentence is built so no form needs the student's gender |

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
| T29 (new, the owner's) | 21 lang values and 10 handbook fragments: browsers, clients and "the primary GM's browser" cut from player texts; the reason behind a GM's limit cut, the limit kept | Applied; the examples are in docs/text-style.md. A first pass only: about 270 English values still name a browser, a client, the console or a store, most of them GM diagnostics (Case, Season, DiceLook, Contract, GmStore), where some of it is what a GM needs. |
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
| lang/en.json, lang/pl.json (frozen keys) | `DRPG.Trial.presentByButton` (e73 and others) | Overexplains (T29) to a player: "the GM's browser posts its card". | Frozen; for the owning line. |
| lang/en.json, lang/pl.json (frozen) | `DRPG.Observe.resolveLostOwner` | Overexplains (T29) to a player: "the GM's browser has no record of what you were looking at". | Frozen; for the owning line. |
| lang/en.json, lang/pl.json (frozen) | `DRPG.Settings.highContrast.hint`, `reducedMotion.hint` (e61-62, e92) | End "This client only." / "Tylko ten klient." where EN14/PL-o say "Only affects this browser." / "Dotyczy tylko tej przeglądarki."; the hint also explains the Interface scale's split. | Frozen; for the owning line. |
| docs/handbooks/player-handbook.*.md section 5 (frozen by e64, e72) | the Calls paragraph (EN line 397) | Overexplains (T29): "bought on the GM's browser", "read in the code, not measured for a Call", "a roll the GM's browser throws". | Frozen; for the owning line. |
| scripts/config.mjs and `DRPG.Config.*` in pl.json | config prose | Not edited in this pass at all (see FROZEN.md); the pilot's config afters and pair N25 (`ACTIONS.palm.description`) wait there. | Four open branches change config.mjs by line. |

## Test runs

| When | Tree | Result |
| --- | --- | --- |
| 12.11, run a | b7ecc32b and edits in progress | 1226 passed, 4 failed (R431, R902, R904, R1563: wording this pass changed), 16 skipped |
| 12.11, run b | 2dbf3c88 | 1228 passed, 2 failed (R518, R3136), 16 skipped; both fixed and run green alone |
| 12.11, run c | ffddd0ee and the T29/GM-a edits | 1228 passed, 2 failed (R387, R603), 16 skipped; both fixed and run green alone |
| 12.11, run d | the commit after 11133b75 | 1230 passed, 0 failed, 16 skipped, 0 red (`node run-tests.mjs --tier 1`, 384 s) |

## Tests whose expected wording changed

Each was run red first on the new lang (`node run-tests.mjs --tier 1 --only R1158 --only R902 --only R904`: 3 failed),
then given the new wording.

| Test | File | Old wording it pinned | New |
| --- | --- | --- | --- |
| R1158 | scripts/tests-tier0.mjs | `DRPG.Calls.armedForYou` en and pl | the pilot's approved afters |
| R902 | scripts/tests-tier1.mjs | `DRPG.Passage.tab.wayOnly` pl "Tylko z: {from}, do: {to}" | "Tylko z pokoju {from} do pokoju {to}" |
| R904 | scripts/tests-tier1.mjs | `DRPG.Passage.list.oneWay` pl | pair N15's after |
| R3136 | scripts/tests-tier1.mjs | `DRPG.Observe.anythingHint` read for /trace/ and /ślad/ | /Remnant/ in both (red first: failed in the tier 1 run) |
| R518 | (no test change) | the GM handbook's quote of `DRPG.Vault.descriptionNote` (section 1, line 88) | the quote was updated with the key (red first) |
| R387, R603 | scripts/tests-tier0.mjs (lines 13491, 14918, 14919, 14934) | Polish handbook sentences read with "GMowi", "GMa" | the same sentences with "GM-owi", "GM-a" (red first: both failed in the tier 1 run) |
| R431 | (no test change) | the GM handbook's copy of `DRPG.Season.roomGuide` (section 2, line 136) | the handbook line was updated with the key |
