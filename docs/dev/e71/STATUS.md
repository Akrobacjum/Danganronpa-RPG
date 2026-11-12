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
| spelling | 42 | 11 | 2 (GM section 2, a copy of `Season.roomGuide`) | EN1/DB9 (American spelling), glossary `window-room-setup`, PL-i/D33c (`gm-a`, and three "MG"), PL-f/DB30 (`safeword`) |
| naturalness pairs | 0 | 54 | 0 | the 60 pairs of docs/text-style.md section 12, approved by the owner on E65-PILOT-R2 (01.11.2026): 48 that still stood in their key and were not frozen, and 6 plural siblings written in the same shape (PL7) |
| pilot afters | 28 | 33 | 0 | the 40 strings of docs/dev/text-pilot.json, approved by the owner (verdict "ok", 01.11.2026): every after that had not landed and whose key is neither frozen nor config prose |
| X12 colons (PL) | 0 | 101 | 0 | X12 (confirmed in the pilot): "w pokoju {room}", "postaci {name}" |
| caps and please | 8 | 2 | 0 | X16, X8 (to confirm in E71) |
| Remnant in sentences | 85 | 119 | 4 (GM section 1's quote of `Vault.descriptionNote`, player section 11's tables note; EN and PL) | EN15/PL-r, DB15 (glossary `remnant`, stage E71), DB4 for the Polish cases |
| overexplains (T29) | 28 | 26 | 38 (player handbook: starting resources, the Eclipse, Rooms, Voice, Truth Bullets, the messenger's waits and Note, the settings window; EN and PL; and 10 lines' version notes \"(since 1.2.x)\" / \"(od 1.2.x)\", a \"not yet checked at a table\" note kept) | T29, the owner's rule of 12.11.2026, added to docs/text-style.md section 2 |
| settings | 5 | 5 | 0 | EN14/PL-o (DB10): "Only affects this browser." / "Dotyczy tylko tej przeglądarki."; T29 on two of them |
| glossary | 23 | 2 | 0 | EN7/DB17 "Search Token" capitalized (glossary search-token); glossary refuse: "Odmów" on two GM buttons |
| X1 refusals | 7 | 5 | 0 | X1 (confirmed in the pilot) and O8: "You keep your action/Hope" instead of "Nothing was spent"; pairs N28-N30 the model |
| X10 fillers | 7 | 5 | 2 (GM section 2's copy of `Season.roomGuide`, EN and PL) | X10 (confirmed in the pilot): "simply", "actually", "just" as a filler, „po prostu”, „naprawdę” as a filler; "just" meaning "a moment ago" and "actually" setting truth against appearance (`TruthBullet.reallyTooltip`) stay |
| Oxford comma | 49 | 0 | 3 (the setting's name where the GM and player handbooks quote it) | EN2/DB35: the comma before the last "and"/"or" of a list; T17's candidates read one by one, 18 left as not a list ("folded or open", "kill and revive") or as a sentence a frozen handbook section copies (`Contract.*`) |
| Remnant in sentences (handbooks) | 0 | 0 | 49 lines (unfrozen sections of all six handbooks) | EN15/PL-r, DB15 (glossary remnant, scope handbooks), Polish in DB4's cases; code spans and the five Trace names kept |
| X6 telegraph | 1 | 0 | 0 | X6 (to confirm in E71): `Cleanup.bareHands` as a whole sentence, the facts of the owner's pair N49 |
| spelling (handbooks) | 0 | 0 | 23 lines (English handbooks, unfrozen sections) | EN1/DB9, D33e (glossary scope handbooks), "Room setup" (D31); code spans kept; 31 lines in frozen sections left |
| glossary (handbooks) | 0 | 0 | 9 lines (unfrozen sections, EN and PL) | EN7/DB17: "Search Token" capitalized; 13 lines in frozen sections left |
| brochure | 0 | 0 | 8 cells and 2 lines (EN and PL) | S12-73: the four empty "In short" cells of the Hope Calls table, from config.mjs HOPE_CALLS; T29 on the safeword's history |
| M7 reserve | 1 | 0 | 2 (player handbook's Usables row, EN and PL) | M7/D5 (S13-40): Sanity is restored, not "cleared"; the Polish lang key already had pair N48 |
| fact fixes | 1 | 1 | 0 | S06-51: `DRPG.Panel.gmOnly` refuses 47 GM-only steps, not only opening the panel |
| handbooks: GM-a | 0 | 0 | 67 (Polish handbooks, unfrozen sections) | PL-i/D33c (glossary `gm-a`, scope handbooks) |
| Polish grammar | 2 | 23 | 10 (Polish handbooks, unfrozen sections: "Class Trialu" -> "Class Trial", three neuter Eclipse/Overflow) | no bracketed gender endings ("zgłosił(a)"); PL-a/DB4 (Class Trial indeclinable); PL-b/DB28 (Eclipse neuter); X13, PL7, P2 on single values (`Move.dead`, `Vote.reminded.few`, `Vote.opened`) |

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
| X6 (telegraph style) | `DRPG.Cleanup.bareHands` "Nothing readied. Bare hands, then." -> a whole sentence with the facts of N49 | Applied once. T18's other finds are short labels, world-voice flavor ("No Hope Calls. Not one, by anybody.") or config prose, left. |
| X7 (label-colon chains) | `DRPG.Handover.stuckFor.*` (five Polish values, four or five colons each, "(daje: {from}, dostaje: {to})") written as sentences | Holds; T24's other finds are a legend (`Actions.moveLegend`), a ladder (`Action.dcAnalyze`), a summary and two GM diagnostics, left for E71's batches. |
| N1, N2 (keys and placeholders stay) | every change | Holds: the edit script refuses a change to the placeholder set; no key was renamed. |
| T29 (new, the owner's) | 21 lang values and 10 handbook fragments: browsers, clients and "the primary GM's browser" cut from player texts; the reason behind a GM's limit cut, the limit kept | Applied; the examples are in docs/text-style.md. A first pass only: about 270 English values still name a browser, a client, the console or a store, most of them GM diagnostics (Case, Season, DiceLook, Contract, GmStore), where some of it is what a GM needs. |
| X13 (singular "they" as a Polish plural) | read T5's 6 finds | All six are real plurals (`ich` for two students, for Remnants, for Truth Bullets, for tokens): the detector's candidates, not faults. Nothing changed. |
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
| lang/en.json, lang/pl.json | `DRPG.Settings.uiScale.hint` | The two languages disagree on a fact: the English says the slider moves "Foundry's own chrome and the character sheet" too; the Polish says "własne okna Foundry nigdy nie są skalowane" (Foundry's own windows are never scaled), and says nothing of Monokuma Legacy. Only the endings were changed here. | Which is true is the code's (ui-kit/settings); M2 says the code wins, and a fact change is not this pass's. |
| docs/handbooks/gm-handbook.*.md:269 (section 5, frozen by e64), gm-handbook.pl.md:563 (section 9.5, frozen by e72) | T8's three handbook finds | "Dynamic action" / "akcji Dynamic" (glossary dynamic-action: "Dynamic Action") and "kafel powiadomień" (glossary notice-tile: "kafelek powiadomień"). | Frozen; for the owning lines. |
| docs/handbooks/gm-handbook.en.md and .pl.md, sections 12, 13 and 19 (lines 722, 739, 1104), and section 6.3's line 372 | source-file lists | Several GM handbook sections open with the files and config tables behind them (`scripts/eclipse.mjs`, `ECLIPSE_MOVES` ...). T29 would move them to a part marked for a GM who debugs (M10's appendix). | A structural move of the handbook: E57's, which owns the handbooks' form. |
| lang/pl.json (frozen keys) | `DRPG.Monocub.meddledOn` (N14), `Cleanup.moveIntro` (N17), `Observe.critPrompt` (N47), `Overflow.rulesChanged` (N52) | Four of the owner's approved naturalness pairs (docs/text-style.md section 12) wait in frozen keys; T27 lists them. | For the owning lines, or this line after their merge. |
| docs/handbooks/gm-handbook.pl.md:956 (section 15, frozen) | "przeglądarki MG" | "MG" for GM (PL-i, glossary gm-a). | Frozen. |
| lang/en.json:2954 and its pl twin | `DRPG.Rest.noRooms` | S02-37 (E25's list): "marked for a {kind}" reads wrong when the code passes an empty kind. | Whether `{kind}` can be empty is the code's (rest.mjs); not a text-only fix. |
| lang/en.json:3222 and its pl twin | `DRPG.Eclipse.noMovesLeft` | S07-39 (E25's list): "Your token has been put back." - movement.mjs:1149 and :1674 return it as a refusal before a move, where nothing was put back. | Needs the code read per caller (eclipse.mjs:1022 is a third); E25's C4. |
| lang/en.json:4771 and its pl twin | `DRPG.Note.intro` | S01-25 (E25's list): "the first four questions" - the count depends on the template. | Needs the template's real count; E25's C4. |
| scripts/config.mjs and `DRPG.Config.*` in pl.json | config prose | Not edited in this pass at all (see FROZEN.md); the pilot's config afters and pair N25 (`ACTIONS.palm.description`) wait there. | Four open branches change config.mjs by line. |

## Test runs

| When | Tree | Result |
| --- | --- | --- |
| 12.11, run a | b7ecc32b and edits in progress | 1226 passed, 4 failed (R431, R902, R904, R1563: wording this pass changed), 16 skipped |
| 12.11, run b | 2dbf3c88 | 1228 passed, 2 failed (R518, R3136), 16 skipped; both fixed and run green alone |
| 12.11, run c | ffddd0ee and the T29/GM-a edits | 1228 passed, 2 failed (R387, R603), 16 skipped; both fixed and run green alone |
| 12.11, run d | e95cf62d | 1230 passed, 0 failed, 16 skipped, 0 red (`node run-tests.mjs --tier 1`, 384 s) |
| 12.11, run e | e95cf62d and the Polish grammar edits | 1230 passed, 0 failed, 16 skipped, 0 red |
| 12.11, run g | 7463785e and the settings endings | 1230 passed, 0 failed, 16 skipped, 0 red |
| 12.11, run h | 23ecea60 and the glossary edits | 1230 passed, 0 failed, 16 skipped, 0 red |
| 12.11, run i | 190142fc and the X1 refusals | 1230 passed, 0 failed, 16 skipped, 0 red |
| 12.11, run j | 721d6170 and the X10 edits | 1230 passed, 0 failed, 16 skipped, 0 red |
| 12.11, run k | 9e4c7be1 and seven more X12 values | 1230 passed, 0 failed, 16 skipped, 0 red |
| 12.11, run l | 7f2a51eb and the Vote, Calls and MG edits | 1230 passed, 0 failed, 16 skipped, 0 red |
| 12.11, run n | 3883b5ce and the Oxford commas | 1230 passed, 0 failed, 16 skipped, 0 red |
| 12.11, run o | 6fcaa102 and Remnant in the handbooks | 1229 passed, 1 failed (R310: two player handbook regexes read "no trace"/"żaden ślad"; fixed, R310 green alone), 16 skipped |
| 12.11, run p | 7a216634 and the Steal, Handover and Rest edits | 1230 passed, 0 failed, 16 skipped, 0 red |
| 12.11, run q | c62d325c and three handbook genders | 1230 passed, 0 failed, 16 skipped, 0 red; scenario 50-lang (Polish on four clients) 44/44 on c62d325c |
| 12.11, run r | 47cf5aed and the handbooks' American spelling | 1230 passed, 0 failed, 16 skipped, 0 red |
| 12.11, run s | 6c6745d2 and Search Token in the handbooks | 1230 passed, 0 failed, 16 skipped, 0 red |
| 12.11, run t | d5c17f9d and the player handbook's version notes | 1230 passed, 0 failed, 16 skipped, 0 red |
| 12.11, run u | 5c5cdc23 and the brochure | 1230 passed, 0 failed, 16 skipped, 0 red |
| 12.11, run v | d5e4bfc0 and the M7 and gmOnly edits | 1230 passed, 0 failed, 16 skipped, 0 red |
| 12.11, run f | 0a5ea4d3 and the GM-side T29 cuts (the bridge's refusals, the trial hall, the vote's privacy note) | 1230 passed, 0 failed, 16 skipped, 0 red |

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
| R310 | scripts/tests-tier0.mjs | the player handbook's Daily Life ladder sentence with "no trace" / "żaden ślad" | "no Remnant" / "żaden Remnant" (red first in run o) |
| R431 | (no test change) | the GM handbook's copy of `DRPG.Season.roomGuide` (section 2, line 136) | the handbook line was updated with the key |
