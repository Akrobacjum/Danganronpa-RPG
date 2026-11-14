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
| fact fixes | 2 | 3 | 0 | S06-51: `DRPG.Panel.gmOnly` refuses 47 GM-only steps, not only opening the panel; the dead first `DRPG.Chapter.bodyTitle` removed in both files; `Settings.uiScale.hint` (the Polish said Foundry's windows never scale - the theme scales their type) |
| third person (P2) | 4 | 6 | 0 | P2/P1 (DB19): the Eclipse's announcement and the assembly's note, cards the whole table reads, in the third person; T16 found 18, now 11 |
| item quotes | 53 | 49 | 0 | EN17/PL-g (DB31): an item's name in quotes; T23 found 110 (quotedByCode 0), now 10 (bold names, frozen keys) |
| Remnanty (DB4) | 0 | 62 | 9 (Polish handbooks, unfrozen sections, the player handbook's heading "Remnants" among them) | the owner, 12.11.2026: Polish inflects "Remnant" in the plural too ("Remnanty", "Remnantów", "Key Remnanty"); the glossary's `remnant` entry and text-style PL-a say so |
| handbooks: GM-a | 0 | 0 | 67 (Polish handbooks, unfrozen sections) | PL-i/D33c (glossary `gm-a`, scope handbooks) |
| Polish grammar | 2 | 23 | 10 (Polish handbooks, unfrozen sections: "Class Trialu" -> "Class Trial", three neuter Eclipse/Overflow) | no bracketed gender endings ("zgłosił(a)"); PL-a/DB4 (Class Trial indeclinable); PL-b/DB28 (Eclipse neuter); X13, PL7, P2 on single values (`Move.dead`, `Vote.reminded.few`, `Vote.opened`) |
| GM screen review | 136 | 142 | 20 (GM handbook sections 1, 2, 6.3 and 12, player handbook section 2: the renamed settings and buttons where they are quoted; the GM's copy of `Season.roomGuide` cut to the short guide, the rest of its rules kept on a new line 137; the quote of `Vault.descriptionNote`) | the owner's approval of every proposal of the GM screen review (12.11.2026): its "niejasna nazwa" renames and its "Teksty do skrócenia" lines, as T29; EN written to match the approved Polish; `DRPG.Project.scaleOption` new (the window's English "progress"), held by R2077 |
| player screen review | 3 | 4 | 0 | the same approval, items #6 (module mechanics a player reads) and #9 (the Daily Life explainer's count) |
| overexplains (T29), round 2 | 17 | 17 | 0 | T29 on the texts T4 still counts over their word budget and that no open line touches: 13 settings hints, the Background clash, the Despair Flow empty pool, the sentence that failed; `enforceAnonymity.hint` also given the two things anonymity.mjs shows that it left out (Ultimate, the count of Experiences) |
| handbook numbers (E57 prep F2, F3) | 0 | 0 | 6 (GM 681, brochure 69, player 850; EN and PL) | the coordinator's ask of 13.11, from claude/e57-prep b7575629 docs/dev/e57/MEASURE-numbers.md: the trap card's "four to six actions" -> "four to five" (murder-ui.mjs `indirectCostText`, R1160 reads 4 to 5); the brochure's trap roll "Eye vs 20" -> "Eye or Head vs 20" (config.mjs `MURDER_OPENING.victim`, traits eye and head); the glass's turn "about a second" -> "about 1.2 seconds" (glass.mjs `turnPlan` dur 1200, as the GM handbook says). GM section 11 is frozen by e64 and e93 and the brochure's section by e72, but none of them edits these lines: merge-tree with each is clean |
| E102 prep labels | 2 | 2 | 0 | the coordinator's ask of 13.11 (claude/e102-prep 813d506d): `Murder.escapeRemnants` "Open the Remnant table" opens the Investigation dashboard -> "Open the Investigation" / "Otwórz Investigation"; Tamper's `Cleanup.trailWho` "Frame" / "Wrób" -> "Who to frame" / "Kogo wrobić"; the rest listed for the coordinator |

## Text rules exercised ("to confirm in E71"), and the outcome

Only rules whose status in `docs/text-style.md` says "to confirm in E71" are listed; a rule already confirmed in the
pilot (X1, X10, X12, X13, M8, O1-O4 and the rest) was applied without a row here. "Holds" means: applied where the
rule's shape was found, and no applied text needed an exception.

| Rule | Where it was applied | Outcome |
| --- | --- | --- |
| X8 (no "please"/"sorry") | `DRPG.Reroll.rulingVoid` "Please rule again." -> "Rule again." (T5's only X8 find) | Holds. The Polish already had no "proszę". |
| X16 (no ALL-CAPS emphasis) | 9 values: NOT, BEEN, GENUINELY/NAPRAWDĘ, ONE (twice), AND, NOT/NIE inside a sentence | Holds inside sentences. Not applied to banners and card titles (`Vote.banner` "THE VOTE IS OPEN", `Chapter.bodyBanner`, `Mastermind.*Banner`, `Safeword.banner`, `Motive.banner`, `Calls.gatherBanner`), to `Season.resetWord` "RESET" (a word the GM types to confirm), `Legacy.safeword`, the music diagnostics' OFF/MISSING/EMPTY status words, or `Clock.summaryEclipse` "ECLIPSE": these are display type, not emphasis. Proposal for the owner: allow rows in `docs/text-budgets.json` for banner and title keys, so X16 can turn FAIL without them. |
| X15 (no "!") | not applied; allow rows added | All 24 finds are the genre's call-outs: "OBJECTION!" (button, banner, and sentences that name the button) and "Nonstop Debate!". Changing them changes the button's name. The owner approved allow rows (12.11): 42 rows in docs/text-budgets.json (X15 and X16 for the OBJECTION! keys and the debate's title, X16 for banners, card titles, the reset word, the legacy safeword and the music diagnostics' status words); T5 now counts 62 allowed. |
| O8 (a refusal says what the reader keeps) | through the pilot's approved afters: `DRPG.Action.noRoom` ("you keep your action" / "akcji nie tracisz"), `DRPG.SearchTokens.exhausted`; and (round 2, 12.11) `DRPG.Bridge.nothingSpent`, the sentence every refusal before a payment ends on: "Nothing was spent." / "Nic nie wydano." -> "You keep your action and your Hope." / "Nie tracisz akcji ani Hope." (E68's own O8 form), and `Calls.gatherNoRoom` (a Despair Call: "The Despair stays in your pool.") | Applied as the owner approved them. The pilot's EN reviewer note (O8 reads wrong on a dimmed tile's reason, `SearchTokens.exhausted`, and before any price, `Actions.notEnough`) is still the owner's: the owner approved both afters with "ok", so they landed as written. |
| M5 / O5 (no digit typed into prose) | the pilot's approved Polish after of `DRPG.Settings.searchTokensPerRoom.hint` says "od 0 do 10" | Landed as approved; still a digit the code knows (settings.mjs:1300-1308 `range: { min: 0, max: 10 }`), as the pilot recorded. Stays to confirm. |
| X6 (telegraph style) | `DRPG.Cleanup.bareHands` "Nothing readied. Bare hands, then." -> a whole sentence with the facts of N49 | Applied once. T18's other finds are short labels, world-voice flavor ("No Hope Calls. Not one, by anybody.") or config prose, left. |
| X7 (label-colon chains) | `DRPG.Handover.stuckFor.*` (five Polish values, four or five colons each, "(daje: {from}, dostaje: {to})") written as sentences | Holds; T24's other finds are a legend (`Actions.moveLegend`), a ladder (`Action.dcAnalyze`), a summary and two GM diagnostics, left for E71's batches. |
| P3 (who reads a key, off the code) and T16 | T16's 18 finds read against their callers | 5 changed (the Eclipse's two announcements, the assembly's note). Left: `Monocub.meddleIntro` (a tile hint, read by the Monocub alone), `Mastermind.finalAnnounce` (the world voice addressing the class, by design), and the incident's opening cards (`TraitRuling.opening*`, `Murder.closedVictimYou`), which T16 reads as the cast's but whose senders were not read here. |
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
| lang/pl.json:765 | `DRPG.Passage.list.oneWay` | Pair N15 was applied in 2dbf3c88 and put back at 16:10: e72 (head 674f0fc2) now edits the next line (`walk`) and adds keys under it, and two edits on touching lines conflict in a merge. R904's expectation is back to the old wording. | Apply N15 after e72 merges. |
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
| lang/en.json, lang/pl.json; gm-handbook.*.md sections 3, 4, 5, 9.5, 10 and 20 (frozen by e72, e61-62, e64, gaps-a) | `Panel.advance`, `Panel.voiceReset`, `Settings.autoApproveTraits.name`, `Settings.voiceEnabled.name`, `Tables.tabNewItem` | The GM review renamed these labels ("Skip the Eclipse" / "Pomiń Eclipse", "Fix voice" / "Napraw głos", "Players' statistics without approval", "Separate voice in each room", "New item"). The handbooks' unfrozen lines quote the new names; 21 lines in frozen sections still quote the old ones (EN 164, 177 twice, 186, 218, 220, 269, 559 twice, 621, 1285; PL the same lines). | Frozen; the owning lines, or E57, bring them in line. |
| GM review, lines marked "usunąć" or "schować" | `Monokuma.panelNote`, `Project.glyphNote`, `Items.giveNote`, `Items.takeNote`, `Tables.newTierPoolNote`, `Season.hint.sound`, `Look.uiScaleAuto`, `Overflow.thresholdHint`, `TruthBullet.secretNote` on the From a Remnant tab, `Contract.checksUnknown`, the Level Up's "Zrób to" | Removing a text or a row is a change of the window, not of a value. | E101's (structure), as the coordinator split it. |
| GM review, frozen or config | `Clock.endChapterNote`, `Panel.whoIsAliveNote`, `Monocub.silencedNote`, `Monocub.silenced`, `Vault.fogNote`, `Vault.fogUncovered`, `Vault.neighboursNote` (R431's copy in frozen 9.1), `Mastermind.verdictNobody`, the SFX hints (`DRPG.Config.SFX_EVENTS.*`), `Settings.glassPulse/reducedMotion/highContrast.hint` ("Tylko ten klient") | Frozen keys or config prose. | Left. `Calls.silencedBadge` was left too: the review paired it with the Monocub's "Uciszony", but sheet.mjs `standingEffects` draws it for a Call's silence (`isCallSilenced`), not for the Monocub; e72 renames the Monocub's. |
| GM review: three settings hints | `Settings.hudTicker.hint`, `wideProjectWindows.hint`, `theme.hint` | The review's afters drop "Only affects this browser." that DB10 (EN14/PL-o) puts at the end of a client setting's hint; the review's text was applied, as the owner approved it. The settings window says it once in its aside. | DB10 and the review disagree; the owner's later word was followed. |
| GM review: where this pass wrote other than the review | `Panel.resetHint` (two windows, two afters: the Edit campaign one was taken, it keeps the advice), `Settings.voiceTile.hint` ("kanale", not "pokoju": with voice per room off the channel is the whole table), `Despair.noCandidates` ("bez puli": an assistant holding a pool is no candidate), `Season.hint.ultimate` (without "pod imieniem": the sheet's layout is Daggerheart's, not read here), `Settings.voiceEnabled.hint` (keeps "Wymaga LiveKit AVClient", which the review moved there from the name), `Season.hint.cursor`/`rulers` (the role names "ASSISTANT, GAMEMASTER" / "PLAYER, TRUSTED" the review flags are drawn by the code, not by these keys) | Accuracy against the code. | For the owner to see. |
| player review #9 | `DRPG.Explain.phase.dailyLife`, config `PHASES.dailyLife.hint`, frozen `Explain.status.actionsWhat` | explain.mjs fills `{actions}` from actions.mjs `baseActions` (the rule's 2), while "Masz 3 z 3" is the character's own maximum. The Daily Life paragraph now says "usually" / "Zazwyczaj"; the hint (config prose) and `actionsWhat` (frozen) still say the bare number. "porę dnia.Zwykłe dni" is not two texts glued: `phaseExplanation` joins them with `<br>`, which a screen shows as a new line; the review read the text without it. | Taking the character's own count is a code change. |
| player review #6 | config `ACTIONS.project.description` (the indirect murder), `HOPE_CALLS.contribution.effect`, `ACTIONS.observe.description` ("oryginał zostaje na miejscu"), `SFX_SLIDERS.music.hint` ("nie druga obok"), the Sound window's "tylko ta przeglądarka" lines, `HOPE_CALLS.relief.effect`, frozen `HOPE_CALLS.support.effect`, `Calls.waitsForGm` | Most of #6's sentences are config prose, not edited in this pass. Done: `Observe.requestPrompt` ("Czego szukasz?"), `Reroll.noRollHere`. | Config prose; four open branches change config.mjs. |
| lang/en.json, lang/pl.json | `DRPG.Assign.footnote` | The GM review cuts it to "„- nikt -”: uczeń nie daje Despair (dla NPC). Gracze mogą to zobaczyć." It is also an approved after of batch B01a, which check text holds to the files; the way through is a `BATCH_LATER` row in tools/text-render.mjs, where e64 edits the same lines (a merge conflict). | Left at B01a's after. The row can go in once e64 has merged. |
| lang/en.json, lang/pl.json | `Chapter.revealKeeps`, `Investigation.neverOnePerson`, `newTraceIntro`, `unidentified`, `TruthBullet.analyzedTextNote` | A new branch, e64-inv, edits these and 25 keys beside them; this pass had changed eight of their values (Remnant, US spelling, T29) in earlier commits. Put back to the base's value so the two merge cleanly (and `Chapter.typeless`, which quotes the term "not analysed", with it: R357); FROZEN.md now reads every remote claude/* branch, not a list. | Frozen by e64-inv. |
| docs/dev/R-REGISTRY.md | the generated registry | R4000's row and the "Next free" line conflict with main and with the six branches that add tests (e64-inv, e72, e93, e97-98, gaps-61, fervent-sagan). Every branch that adds a test does this; `node tools/registry.mjs --write` after the merge writes the file again. | Kept: a test needs its row (check registry). |
| lang/en.json, lang/pl.json | `DRPG.Murder.indirectCost` | The GM review's short form ("Pułapka to projekty: około {low}-{high} postępu, {fewest}-{actions}.") is ready, but R1160 pins the text in lines that e64 edits beside it, so the test cannot change without a merge conflict. | Put back to the old text; for after e64 merges. |
| T4's list, round 2 | `Settings.documentLanguage.hint`, `Body.noToken`, `Floor.newTrialRefused`, `Hud.bodyFoundTooltip`, `Items.brokenTooltip` | Over their budget too, but tests read their words (tier 1 for the first two, tier 2 for the third, which this line runs only by name) or they are already a short sentence. | Left. |
| docs/handbooks/gm-handbook.*.md:88 (section 1), lang `DRPG.Vault.descriptionNote` | the Description tab's note and its quote | A new branch, project-token-icon (1de23ada, 13.11), adds a clause to line 88, which this pass had changed (Remnants, then the GM review's short note it quotes, R518). Both put back to the base's text, the note and its quote together, so the two merge cleanly. | Frozen by project-token-icon; the review's short note waits for it. |
| E102 prep (claude/e102-prep 813d506d), "ślad" in 8 keys | `Chapter.promoteIntro`, `promoteNote`, `bodyNoteTraces`, `TruthBullet.remnantNote`, `Cleanup.moveHint`, `Case.moveNote`, `Observe.alreadyDescribed`; `Cleanup.moveAlwaysTrace` | The prep read main: on this branch the first seven already say Remnant (DB15, the Remnant pass). `Cleanup.moveAlwaysTrace` ("Evident ślad") is frozen by e64. | Default: e64 or E71's later pass writes "Evident Remnant" there. |
| E102 prep: `DRPG.CaseMap.field.text` "Note for the GMs" / "Notatka dla GM-ów" | the case map's node field | On most nodes the GMs alone read it (the GM's case map). On a planned Incident Remnant, `placeIncident` opens New Remnant with this text as the Remnant's words, which a finder reads, so the label is wrong for that one kind. Telling the two apart needs a second key in investigation.mjs `schemaEditor` (code). | Default: E102 adds `DRPG.CaseMap.field.incidentText` ("What a finder reads" / "Co przeczyta znalazca") for incident nodes; the key stays as it is until then. |
| E102 prep: Overrule's Polish "Oddalenie" | `Floor.bar.overrule`, `Floor.overrule.title`, `Floor.gmNoteOverrule` | The glossary's entry `overrule` sets "Oddalenie" and forbids "Oddal Objection"; the button overrules an Objection without giving its cost back (TR25). A noun on a button reads oddly, but it is the glossary's decision. | Default: keep; the owner can change the glossary entry (e.g. "Oddal") and the three keys follow. |
| docs/handbooks/gm-handbook.pl.md:480 (section 9.1, frozen by e101b, e93, r112) and :679 (section 11, frozen by e101b, e64, e93, project-token-icon, r112) | the Passages table's column "Pochodzenie" | gaps-radio (7ed09b68) renames the Polish head `DRPG.Passage.tab.origin` to "Źródło". Lines 580 and 583 (section 9.6) now say "Źródło"; these two are frozen, and R603 (tests-tier0.mjs:14916) pins line 480's list of columns with "Pochodzenie". The lang key itself is gaps-radio's (editing it here would conflict). | For the owning lines: line 480 and R603 together, then 679. The glossary has no entry for the term. |
| lang/en.json, lang/pl.json | `DRPG.Chapter.bodyTitle` twice (the coordinator's note of 13.11, as on main) | Already one key in each file on this branch: the dead first value went in 90ec7ae7 (the owner's answer (1), 12.11). Not frozen. | Done. |
| scripts/projects-ui.mjs:27 | the utils import | A new branch, e102, edits the import line beside it (ui-kit.mjs); this pass had added `plural` to the utils import for `DRPG.Project.scaleOption` (d640019e). `plural` now comes in on a line of its own after the live.mjs import, so the two merge cleanly; lint green. | Done. |

## Merge of origin/main (ceb9e9c8, 1.2.112), 13.11

A merge commit, as the coordinator asked (no rebase, no force). 16 conflict hunks in six files (lang 5 + 4, handbooks 2 + 2 + 2 + 1); in each, main's newer behaviour won, and this pass's edits were carried onto main's sentence only where its words still stood (a word-level carry, read line by line against main's after it).

| File | Key / line | Main's change | Resolved as |
| --- | --- | --- | --- |
| lang/en.json, pl.json | `Settings.forceDiceLook` | the setting became a choice, "Dice look for the table" with `choices` (own, Dice So Nice, Daggerheart), its hint rewritten | main's whole; the T29 cut was of the old hint |
| lang/en.json | `Actions.moveLegend` (+ main's new `cubMovesFree`) | `cubMovesFree` added beside it | main's new key, this pass's "color" (EN1) |
| lang/pl.json | `Actions.allSpent` (+ `cubMovesFree`) | the same new key | main's new key, this pass's `allSpent` |
| lang/en.json, pl.json | `Vault.overflowed`, `stole` (+ `foundInStash`, `handFirst`, `noBullets`, `full` in pl) | `foundInStash` removed: a Search no longer reaches a stash | `foundInStash` gone, as main; this pass's item quotes (DB31) and Polish edits kept on the rest |
| lang/en.json, pl.json | `Vault.stashesIntro`, `stashesNote` | the note: a hidden stash is found by Analyze's Find Stash and is open to its finder from then on | `stashesIntro` this pass's (main had not changed it); `stashesNote` main's facts, cut again (T29) |
| lang/en.json | `FoundrySettings.*.sceneVision`, `diceLook` | `diceLook` names the new choice | `diceLook` main's; `sceneVision` this pass's Oxford comma |
| docs/handbooks/gm-handbook.en.md, .pl.md:79 | the settings list | "Dice look for the table" / "wygląd kości przy stole" | main's line, with this pass's renamed settings ("Lock players' resources on the sheet", "Players' statistics without approval", "Separate voice in each room"; Polish the same), "Search Tokens" and the Polish GM-a forms carried |
| docs/handbooks/gm-handbook.en.md:91, .pl.md:91-92 | who created a roll | the roller's look named by the new choice | main's lines, with "colors" (EN) and the GM-a forms and "Remnantu" (PL) carried |
| docs/handbooks/player-handbook.en.md:232 | Search and stashes | a Search draws from the room alone, never a stash | main's sentence, with "favors" carried; the old stash sentence is gone |
| docs/handbooks/player-handbook.en.md:913, .pl.md:913 | the sheet's Actions | a Monocub's own tiles, no Move tile | main's line, with this pass's cut of the version note "(since 1.2.101)" carried |

Main's texts that merged without a conflict are main's as they stand (its spellings and Polish forms included); this pass's rules reach them only in a later round.

## Merge check (12.11, 16:10; again before the review commit)

`git merge-tree` of this branch with each open branch, against the same merge of the base it started from (235c3210): no file conflicts that this branch adds, for any of the nine. With origin/main at 4dfac3a9 (1.2.108): a clean merge. Before the screen-review commit, against every remote claude/* branch and origin/main: no conflict this branch adds, once the keys e64-inv now edits were put back, `Assign.footnote` stayed at B01a's after, R1157 and R1160 were left as they are, and R4000 was folded into R2077 (its registry row conflicted).

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
| 12.11, run x | 626dcb7e and the P2 edits | 1230 passed, 0 failed, 16 skipped, 0 red |
| 12.11, run y | ce42324a and the item quotes | 1230 passed, 0 failed, 16 skipped, 0 red; scenario 40-flow 88/88 |
| 12.11, run z | edf8500f and Remnanty, the allow rows, bodyTitle and uiScale | 1229 passed, 1 failed (R1156 read "Znaleziono tylko 2 Key Remnants"; given the new form and its counted-noun list `Key Remnant*`, green alone), 16 skipped |
| 12.11, run aa | 90ec7ae7 and the GM and player screen reviews | 1220 passed, 11 failed (the review's texts against R806, R819, R825, R902, R975, R1157, R1160, R1161, R1163, R2077, R3150; each fixed, the 12 green together), 16 skipped |
| 12.11, run ab | the same tree with run aa's fixes | 1230 passed, 1 failed (R357: `Chapter.typeless` spelt "analyzed" beside the dashboard term "Not analysed" that e64-inv now freezes; put back to "analysed", R357 green alone), 16 skipped |
| 12.11, run ac | 90ec7ae7 and the screen reviews, after run aa's and ab's fixes and the merge fixes | 1230 passed, 0 failed, 16 skipped, 0 red (389 s) |
| 12.11, run ad | d640019e and T29 round 2 | 1230 passed, 0 failed, 16 skipped, 0 red (317 s); `npm run quick` green |
| 12.11, run ae | a3ffef84 and the O8 refusals | 1230 passed, 0 failed, 16 skipped, 0 red (325 s); `npm run quick` green |
| 13.11, run af | cbf3b657 and the E57 prep number fixes | 1230 passed, 0 failed, 16 skipped, 0 red (337 s); `npm run quick` green; a first run during a container restart ran no tests and is not counted |
| 13.11, run ag | aa9137fe and the Źródło lines | 1230 passed, 0 failed, 16 skipped, 0 red (369 s); then the import moved for e102: R2077, R1059, R161 green, `npm run quick` green |
| 12.11, run f | 0a5ea4d3 and the GM-side T29 cuts (the bridge's refusals, the trial hall, the vote's privacy note) | 1230 passed, 0 failed, 16 skipped, 0 red |

## Tests whose expected wording changed

Each was run red first on the new lang (`node run-tests.mjs --tier 1 --only R1158 --only R902 --only R904`: 3 failed),
then given the new wording.

| Test | File | Old wording it pinned | New |
| --- | --- | --- | --- |
| R1158 | scripts/tests-tier0.mjs | `DRPG.Calls.armedForYou` en and pl | the pilot's approved afters |
| R902 | scripts/tests-tier1.mjs | `DRPG.Passage.tab.wayOnly` pl "Tylko z: {from}, do: {to}" | "Tylko z pokoju {from} do pokoju {to}" |
| R904 | scripts/tests-tier1.mjs | `DRPG.Passage.list.oneWay` pl | pair N15's after - then put back (below) |
| R3136 | scripts/tests-tier1.mjs | `DRPG.Observe.anythingHint` read for /trace/ and /ślad/ | /Remnant/ in both (red first: failed in the tier 1 run) |
| R518 | (no test change) | the GM handbook's quote of `DRPG.Vault.descriptionNote` (section 1, line 88) | the quote was updated with the key (red first) |
| R387, R603 | scripts/tests-tier0.mjs (lines 13491, 14918, 14919, 14934) | Polish handbook sentences read with "GMowi", "GMa" | the same sentences with "GM-owi", "GM-a" (red first: both failed in the tier 1 run) |
| R310 | scripts/tests-tier0.mjs | the player handbook's Daily Life ladder sentence with "no trace" / "żaden ślad" | "no Remnant" / "żaden Remnant" (red first in run o) |
| R1156 | scripts/tests-tier0.mjs | `Investigation.tooThin` pl "Key Remnants", and the Polish counted nouns "Key Remnants?" | "Key Remnanty", and `Key Remnant*` (red first in run z) |
| R431 | (no test change) | the GM handbook's copy of `DRPG.Season.roomGuide` (section 2, line 136) | the handbook line was updated with the key |
| R4000 (not kept) | scripts/tests-tier0.mjs | - | written red first (1 failed on 90ec7ae7: the literal " progress" and no key), then folded into R2077, which draws the Create and Edit windows with every word the marker of its key and now holds `DRPG.Project.scaleOption.other` there; a new test's registry row conflicts with main and six branches. Never pushed, so the number has no row; R4000-R4049 stay free |
| R1157 | (no test change) | - | red first in run aa (flat `SearchTokens.roomSetupNote`, stale `Vault.roomRatio`): both texts changed back to a shape the census reads as before ("Search Tokens: {max} ..."; "{per} rooms per student"), and `Project.scaleOption` is a plural family, so the census needs no new row; main changes the same counts line, and a change here would conflict |
| R1160 | (no test change) | - | red first in run aa. e64 edits the lines beside this test's expected strings, so the test stays as it is: the Daily Life paragraph keeps "You have {actions}" / "Masz {actions}" and adds "unless your sheet says otherwise" / "chyba że karta mówi inaczej" (player review #9); `Murder.indirectCost` is put back to its old text (below) |
| R1163 | scripts/tests-tier1.mjs | `Vault.roomRatio` en and pl | the review's shape, "1.5" / "1,5" still through `localeFormat` (red first in run aa) |
| R2077 | scripts/tests-tier0.mjs | the Create and Edit project windows' label keys | `DRPG.Project.scaleOption.other` (the family's form the window's 4-progress option draws) after `DRPG.Project.scale` (red first in run aa) |
| R902 | scripts/tests-tier1.mjs | `Passage.tab.startHint` en and pl | the review's "Known after a season reset, not now." / "Znają je po resecie sezonu, nie teraz." (red first in run aa) |
| R819 | scripts/tests-tier1.mjs | `Panel.voiceReset` "Re-send everybody's voice room" | "Fix voice", the review's rename (red first in run aa) |
| R806, R3150, R825, R975, R1161 | (no test change) | each holds a fact the review's short text dropped: when the dice look is fixed, Resolve asks nobody, the body's silence stops a GM's track, the tab that installs the pools, no retired Polish name ("Projekty") | the fact put back in a clause of the text; `Project.manageTooltip` is "Project settings" / "Ustawienia projektów" (red first in run aa) |
