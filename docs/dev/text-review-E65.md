# The review of texts written before the guide (E65 C13)

Written 31.10.2026 on branch e65 at E65 C12 (6630e3fe), for E65-22. The texts of A7 (the notice history), A8 (the
texts of E77 and E78), A10 (passages), A11 (the Frisk) and E70's trial modes were written before docs/text-style.md
and docs/glossary.json existed. This file lists, group by group, what the text lint finds in them, what a reviewer
agent found reading them as rendered (its rows added at e1da9f76), and which stage owns each fix. **Nothing in lang/ changes here**: a row is fixed by the stage it names, in the batch that rewrites its key.

## How the rows were read

- Two sources. The report: `node tools/check.mjs text` on this tree: each detector's findings, those it prints and
  those of a stage not yet shipped (T8's "not yet due"), read off a scratch copy of the part that writes them all out
  (S/stages/E65/scratch/c13/findings.json; S is the stage's scratchpad, outside the repository). A finding belongs to
  a group by its key.
- A group is its key prefix as the stage's spec names it; "E70's mode texts" are the 98 keys of lang/en.json that
  E70 C7 (2f1e8772, Testimony and Panic Round) and E70 C8 (fc547885, the Closing Argument) added, all still there.
- The rule column names the guide's rule (X1-X21 rebuilt 30.10 from their names, so marked), the budget (DB11, its
  numbers rebuilt 30.10), a DB answer, an amend or a naturalness pair. "Rebuilt" means the rule is a guess until the
  owner's pilot confirms it; such a row is a candidate, not a verdict.
- The owning stage: **E66** for T28's rows (T28 turns FAIL from E66, and A10's passage words hold from E79, which
  has shipped, so E66 is where they must be fixed) and for a reviewer's row about a name - O14, PL-d, PL-k or a
  glossary entry (renaming is E66's); **E71** for every other row - the stage whose batches rewrite these
  keys (T4, T5's X5/X9/X15/X16/X18, T25 turn FAIL there; T17, T18, T22 and T27 stay report and are fixed with their
  key's batch). The batch inside E71 is E71's to set.
- The reviewer: a fresh agent, given only its prompt and three files - the 13 groups rendered by tools/text-render.mjs
  (403 keys or families, placeholders filled with a woman's and a man's name, rooms of each Polish gender, counts 0 to
  112), docs/text-style.md and docs/glossary.json as they stood at E65 C11, before C13 added the Frisk row's entry
  (S/stages/E65/scratch/c13/reviewer-prompt.txt, reviewer-input.md, reviewer.json). It wrote 121 findings. 21 are
  already rows of the report - the same key, the same rule, every language it names (its EN2 read as DB35, which EN2
  survives in the guide; its `secret-passage-word` as A10, that entry's source) - and are not repeated; no finding
  names a key that does not exist. The other 100 are rows with test "reviewer", in the reviewer's words; the rule
  column is the rule it named, "(rebuilt)" where it marked the rule rebuilt. Its family DRPG.Voice.list.count is
  written as the family's two keys. A reviewer's row is a reading, not a detector's finding: nothing re-checks it.
- Every key named in a row is a key of lang/en.json; DRPG.Config.ACTIONS.palm.hint, named in the Frisk row's
  section, is config.mjs's English prose (`walkConfigProse`), which has no lang/en.json key.

## The groups

| group | from | keys | keys with a finding | rows | E66 | E71 | by test |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DRPG.Room.* | A8 | 6 | 1 | 1 | 0 | 1 | T22 1 |
| DRPG.FoundryTools.* | A8 | 4 | 0 | 0 | 0 | 0 | - |
| DRPG.Move.entered | A8 | 1 | 1 | 2 | 0 | 2 | T5 1, T22 1 |
| DRPG.Vault.image* | A8 | 4 | 1 | 3 | 0 | 3 | T4 2, T17 1 |
| DRPG.Voice.tile.* | A8 | 12 | 1 | 1 | 1 | 0 | reviewer 1 |
| DRPG.Voice.held.* | A8 | 13 | 5 | 7 | 0 | 7 | T5 2, reviewer 5 |
| DRPG.Voice.list.* | A8 | 15 | 9 | 11 | 0 | 11 | T5 1, T22 6, reviewer 4 |
| DRPG.Voice.panel.* | A8 | 9 | 1 | 1 | 0 | 1 | reviewer 1 |
| DRPG.Notices.* | A7 | 36 | 5 | 6 | 0 | 6 | T5 2, reviewer 4 |
| DRPG.Passage.* | A10 | 155 | 52 | 87 | 28 | 59 | T5 25, T17 2, T22 7, T27 1, T28 24, reviewer 28 |
| DRPG.Frisk.* | A11 | 53 | 29 | 57 | 0 | 57 | T5 2, T22 17, reviewer 38 |
| DRPG.Steal.takeHint | A11 | 1 | 1 | 2 | 0 | 2 | T5 2 |
| E70's mode texts | E70 | 98 | 24 | 38 | 3 | 35 | T5 12, T18 1, T22 4, T25 1, T27 1, reviewer 19 |
| all | | 407 | 130 | 216 | 32 | 184 | T5 47, T22 36, T28 24, T17 3, T4 2, T27 2, T18 1, T25 1, reviewer 100 |

What the report does not find in these groups, read the same way: no glossary finding (T8), no Polish gender or
declension of a loanword (T11, T12), no second person on a card many read (T16), no Monokuma voice (T21), no colon
chain (T24). Outside the groups but in A8's terms: the glossary's voice-tile entry (stage E71) finds "kafel głosu" in
8 Polish UI strings of other groups - DRPG.Settings.voiceTile.name, DRPG.Settings.voiceTile.hint, DRPG.Panel.checksAvOff
(two), DRPG.GiveBack.what.rtcDock and three DRPG.Contract.instead.* rows - and in 23 places of the Polish handbooks,
E71's by that entry (STATUS Open 18 asks whether A7's ruling on "kafel" holds for the voice tile).

## The Frisk row: one Polish form

The amend of 13.10.2026 (A11) asked the review for one Polish form of the row "zobacz, co ktoś nosi". On this tree
that is already decided and held:

| where | English | Polish |
| --- | --- | --- |
| the row, `DRPG.Frisk.rowLabel` | See what they carry | Zobacz, co nosi |
| the Palm hint, `DRPG.Config.ACTIONS.palm.hint` (config.mjs; pl.json) | ... or see what they carry. | ... albo zobacz, co nosi. |
| the brochure's and the GM handbook's Palm rows (docs/handbooks/*) | see what they carry | zobacz, co nosi |
| the player handbook's Frisk paragraph, as its bold label | See what they carry | Zobacz, co nosi |

- H81-11 (the owner's 1.2.80 table, item 5, 20.10.2026; H81 C2, dc351047) set the row to "See what they carry" /
  "Zobacz, co nosi", as the Palm's other two rows; H81's review (H81C2-04; H81 fix r1, 50b8321a) made it the one form
  in each language in the Palm hint, the brochure and both GM handbooks, which had said "zobacz, co ktoś nosi" and
  "see what somebody carries". R620 (tier 1, E80) holds that one form wherever the Palm's three ways are listed.
- **Decided: "Zobacz, co nosi"** (in a sentence "zobacz, co nosi"), the form in force: it is the later source, the
  owner's table, and A11's "zobacz, co ktoś nosi" was the row's name when the amend was written. docs/glossary.json
  holds it as `see-what-they-carry` with "zobacz, co ktoś nosi" and "see what somebody carries" forbidden, stage E80:
  the texts obey it on this tree (T8: held, 0 findings), and a planted pl.json with the old row is reported
  ("Zobacz, co ktoś nosi" is forbidden, the glossary says "Zobacz, co nosi"). No lang change follows.
- Kept beside it, as sentences with a subject of their own: "{who} chce zobaczyć, co nosi {name}"
  (DRPG.Frisk.askText, askTextAskOnly), "temu, co nosi {who}" (DRPG.Frisk.missed), "{who} ma przy sobie:"
  (DRPG.Frisk.listHeading).
- **The reviewer's dissent.** Asked which one Polish form is right for the row and the hint (shown the row and the
  hint as they stand and A11's earlier name, not the glossary entry C13 added), the reviewer holds **"zobacz, co ktoś
  nosi"**, because: "The row label names nobody, so 'nosi' has no person to refer to (PL23, rebuilt), and the plural
  'co noszą' is X13's shape; 'ktoś' gives the verb its subject, matches the row hint's 'czyjeś kieszenie', and stays
  right in the hint whatever stands before it." (The row hint is DRPG.Frisk.rowHint, "Przejrzyj czyjeś kieszenie i
  niczego nie bierz.") The same reading is its PL23 row on `DRPG.Frisk.rowLabel` in the DRPG.Frisk.* table. The
  decided form stays "Zobacz, co nosi" (H81-11, the owner's) and the glossary entry is unchanged; the dissent is a
  question for the owner (STATUS Open 84), and the PL23 row stands as the reviewer's until it is answered.

## The rows
### DRPG.Room.* (A8)

6 key(s) in en.json; 1 finding(s) of the report on 1 key(s); 0 row(s) of the reviewer on 0 key(s).

| key | lang | finding | rule | test | fix |
| --- | --- | --- | --- | --- | --- |
| `DRPG.Room.imageOpen` | both | the punctuation "" in English, ":" in Polish | DB26 | T22 | E71 |

### DRPG.FoundryTools.* (A8)

4 key(s) in en.json; 0 finding(s) of the report on 0 key(s); 0 row(s) of the reviewer on 0 key(s).

No finding of the report.

### DRPG.Move.entered (A8)

1 key(s) in en.json; 2 finding(s) of the report on 1 key(s); 0 row(s) of the reviewer on 0 key(s).

| key | lang | finding | rule | test | fix |
| --- | --- | --- | --- | --- | --- |
| `DRPG.Move.entered` | both | the punctuation "." in English, ":." in Polish | DB26 | T22 | E71 |
| `DRPG.Move.entered` | pl | "Wchodzisz do: {room}." - X12, a Polish preposition before a colon and a placeholder | X12 (rebuilt) | T5 | E71 |

### DRPG.Vault.image* (A8)

4 key(s) in en.json; 3 finding(s) of the report on 1 key(s); 0 row(s) of the reviewer on 0 key(s).

| key | lang | finding | rule | test | fix |
| --- | --- | --- | --- | --- | --- |
| `DRPG.Vault.imageRefused` | en | "...png, webp or..." - a list with no comma before its last "and"/"or" | DB35 | T17 | E71 |
| `DRPG.Vault.imageRefused` | en | 25 words, over the toast target of 20 | DB11 (budgets, rebuilt) | T4 | E71 |
| `DRPG.Vault.imageRefused` | pl | 22 words, over the toast target of 20 | DB11 (budgets, rebuilt) | T4 | E71 |

### DRPG.Voice.tile.* (A8)

12 key(s) in en.json; 0 finding(s) of the report on 0 key(s); 1 row(s) of the reviewer on 1 key(s).

| key | lang | finding | rule | test | fix |
| --- | --- | --- | --- | --- | --- |
| `DRPG.Voice.tile.state.eclipsed` | pl | The Polish state shows the English participle 'Eclipsed', which is not the glossary's term 'Eclipse' and is not Polish. | eclipse | reviewer | E66 |

### DRPG.Voice.held.* (A8)

13 key(s) in en.json; 2 finding(s) of the report on 1 key(s); 5 row(s) of the reviewer on 4 key(s).

| key | lang | finding | rule | test | fix |
| --- | --- | --- | --- | --- | --- |
| `DRPG.Voice.held.cubListen` | pl | 'Tryb: {mode}. Słuchasz.' opens the Polish sentence with a label, a colon and a placeholder. | X12 (rebuilt) | reviewer | E71 |
| `DRPG.Voice.held.cubListen` | en | 'You listen.' uses the simple present for an ongoing state; a native speaker says 'You are listening' or 'You can only listen'. | grammar | reviewer | E71 |
| `DRPG.Voice.held.cubVote` | en | 'The vote: you listen.' uses the simple present for an ongoing state, as in cubListen. | grammar | reviewer | E71 |
| `DRPG.Voice.held.external` | en | "ts own window - use the contr" - X4, a dash that tacks an aside on | X4 (rebuilt) | T5 | E71 |
| `DRPG.Voice.held.external` | pl | "osobnym oknie - użyj jego prz" - X4, a dash that tacks an aside on | X4 (rebuilt) | T5 | E71 |
| `DRPG.Voice.held.offline` | pl | 'Brak połączenia z głosem.' drops the verb and the reader (telegraph), where the English says 'You are not connected to voice.' | X6 (rebuilt) | reviewer | E71 |
| `DRPG.Voice.held.ownCase` | en | 'You listen: this trial is about your death.' uses the simple present for an ongoing state, as in cubListen. | grammar | reviewer | E71 |

### DRPG.Voice.list.* (A8)

15 key(s) in en.json; 7 finding(s) of the report on 7 key(s); 4 row(s) of the reviewer on 5 key(s).

| key | lang | finding | rule | test | fix |
| --- | --- | --- | --- | --- | --- |
| `DRPG.Voice.list.count.one`, `DRPG.Voice.list.count.other` | pl | Every form of the plural family is the same 'Słyszysz w kanale: {n}', so the count has no noun and no form of its own ('5 osób', '2 osoby'); the colon dodges the family. | PL7 | reviewer | E71 |
| `DRPG.Voice.list.count.one` | both | the punctuation "" in English, ":" in Polish | DB26 | T22 | E71 |
| `DRPG.Voice.list.count.other` | both | the punctuation "" in English, ":" in Polish | DB26 | T22 | E71 |
| `DRPG.Voice.list.gmBlock` | both | the punctuation "" in English, ":()" in Polish | DB26 | T22 | E71 |
| `DRPG.Voice.list.gmNoBlock` | en | "microphone can be blocked from here." - X11, a passive that hides who acts | X11 (rebuilt) | T5 | E71 |
| `DRPG.Voice.list.gmUnblock` | both | the punctuation "" in English, ":" in Polish | DB26 | T22 | E71 |
| `DRPG.Voice.list.hidden` | pl | 'Ukryta wcześniej w doku kamer' is feminine with no noun to agree with, so it reads wrong next to a man's name such as Daichi. | grammar | reviewer | E71 |
| `DRPG.Voice.list.muteAll` | en | 'Mute everybody for you' is not idiomatic; the sense is 'for yourself' or 'only for you'. | grammar | reviewer | E71 |
| `DRPG.Voice.list.muteFor` | both | the punctuation "" in English, ":" in Polish | DB26 | T22 | E71 |
| `DRPG.Voice.list.muteFor` | en | 'Mute {name} for you' is not idiomatic; the sense is 'for yourself' or 'only for you'. | grammar | reviewer | E71 |
| `DRPG.Voice.list.unmuteFor` | both | the punctuation "" in English, ":" in Polish | DB26 | T22 | E71 |

### DRPG.Voice.panel.* (A8)

9 key(s) in en.json; 0 finding(s) of the report on 0 key(s); 1 row(s) of the reviewer on 1 key(s).

| key | lang | finding | rule | test | fix |
| --- | --- | --- | --- | --- | --- |
| `DRPG.Voice.panel.micNote` | pl | In 'potem otwórz to okno ponownie, aby go wybrać' the pronoun 'go' refers to the last noun named, 'okno', not to the microphone it means. | PL23 (rebuilt) | reviewer | E71 |

### DRPG.Notices.* (A7)

36 key(s) in en.json; 2 finding(s) of the report on 1 key(s); 4 row(s) of the reviewer on 4 key(s).

| key | lang | finding | rule | test | fix |
| --- | --- | --- | --- | --- | --- |
| `DRPG.Notices.clearBody` | en | 'Every notice in this history goes, the cards about the murder too.' is not natural English ('goes' for 'is removed', and the appended clause). | grammar | reviewer | E71 |
| `DRPG.Notices.clearTitle` | both | The window title is a sentence, the question 'Clear the notice history?' / 'Wyczyścić historię powiadomień?', where a title holds the window's subject. | section 3 (window title) (rebuilt) | reviewer | E71 |
| `DRPG.Notices.clipped` | both | 'Too long to keep whole: only its text was kept.' / 'Za długie, by zachować całość: ...' drops the subject (telegraph). | X6 (rebuilt) | reviewer | E71 |
| `DRPG.Notices.keybindingHint` | pl | 'Otwiera powiadomienia ..., żeby przeczytać zamknięte jeszcze raz' joins a third-person verb (the keybinding opens) to an infinitive 'żeby przeczytać' whose subject is the reader, which Polish does not allow. | grammar | reviewer | E71 |
| `DRPG.Notices.newPill` | en | "New notices - show them" - X4, a dash that tacks an aside on | X4 (rebuilt) | T5 | E71 |
| `DRPG.Notices.newPill` | pl | "powiadomienia - pokaż je" - X4, a dash that tacks an aside on | X4 (rebuilt) | T5 | E71 |

### DRPG.Passage.* (A10)

155 key(s) in en.json; 59 finding(s) of the report on 36 key(s); 28 row(s) of the reviewer on 26 key(s).

| key | lang | finding | rule | test | fix |
| --- | --- | --- | --- | --- | --- |
| `DRPG.Passage.card.breachBedroom` | both | the punctuation ".." in English, "().." in Polish | DB26 | T22 | E71 |
| `DRPG.Passage.card.breachBedroom` | pl | In 'Dopóki ściana nie zostanie naprawiona, jej drzwi nikogo nie zatrzymują' the pronoun 'jej' refers to the last noun named, 'ściana', not to the bedroom whose door it means. | PL23 (rebuilt) | reviewer | E71 |
| `DRPG.Passage.card.breachBedroom` | en | In 'Until the wall is repaired, its door stops nobody' the pronoun 'its' attaches to 'the wall', not to the bedroom. | grammar | reviewer | E71 |
| `DRPG.Passage.card.breachForced` | pl | 'Wyłom wyłamuje pokój {room}' is a tautology no native speaker would say ('the breach breaks the room open'). | grammar | reviewer | E71 |
| `DRPG.Passage.card.breachHeard` | both | the punctuation "." in English, ":." in Polish | DB26 | T22 | E71 |
| `DRPG.Passage.card.breachHeard` | pl | 'od strony: {room}' puts a label-colon-placeholder inside the Polish sentence ('od strony: Warsztat'). | X12 (rebuilt) | reviewer | E71 |
| `DRPG.Passage.card.notReopened` | pl | 'Przerzut cofnął projekt' translates the Call's name; the Call is 'Reroll' in Polish too (Rerolla in the genitive). | PL-k | reviewer | E66 |
| `DRPG.Passage.card.notSealed` | pl | "y, ale jego przejścia nie udało s" - "przejścia" with no "tajn*" before it: a passage is "tajne przejście" | A10 | T28 | E66 |
| `DRPG.Passage.card.passageBuilt` | en | "ished: {from} - {to}. You can" - X4, a dash that tacks an aside on | X4 (rebuilt) | T5 | E71 |
| `DRPG.Passage.card.passageBuilt` | pl | "otowe: {from} - {to}. Możesz" - X4, a dash that tacks an aside on | X4 (rebuilt) | T5 | E71 |
| `DRPG.Passage.card.passageBuiltShared` | en | "o you: {from} - {to}." - X4, a dash that tacks an aside on | X4 (rebuilt) | T5 | E71 |
| `DRPG.Passage.card.passageBuiltShared` | pl | "jście: {from} - {to}." - X4, a dash that tacks an aside on | X4 (rebuilt) | T5 | E71 |
| `DRPG.Passage.card.shown` | en | "ssage: {from} - {to}." - X4, a dash that tacks an aside on | X4 (rebuilt) | T5 | E71 |
| `DRPG.Passage.card.shown` | pl | "jście: {from} - {to}." - X4, a dash that tacks an aside on | X4 (rebuilt) | T5 | E71 |
| `DRPG.Passage.gm.found` | en | "assage {from} - {to}." - X4, a dash that tacks an aside on | X4 (rebuilt) | T5 | E71 |
| `DRPG.Passage.gm.found` | pl | "ejście {from} - {to}." - X4, a dash that tacks an aside on | X4 (rebuilt) | T5 | E71 |
| `DRPG.Passage.gm.shown` | en | "assage {from} - {to}." - X4, a dash that tacks an aside on | X4 (rebuilt) | T5 | E71 |
| `DRPG.Passage.gm.shown` | pl | "ejście {from} - {to}." - X4, a dash that tacks an aside on | X4 (rebuilt) | T5 | E71 |
| `DRPG.Passage.list.oneWay` | both | the punctuation ":." in English, "::." in Polish | DB26 | T22 | E71 |
| `DRPG.Passage.list.oneWay` | pl | "Tylko w jedną stronę, z: {from}, do: {to}." - naturalness pair N15 (X12, X7) is not applied yet (written 31.10 for the owner's pilot, not confirmed; docs/text-style.md section 12; T27) | N15 (X12, X7) | T27 | E71 |
| `DRPG.Passage.list.oneWay` | pl | "dną stronę, z: {from}, do: {to}." - X12, a Polish preposition before a colon and a placeholder | X12 (rebuilt) | T5 | E71 |
| `DRPG.Passage.list.walk` | both | 'the gap in the wall' / 'przerwę w ścianie' is a third name beside the glossary's 'secret passage' / 'tajne przejście' and 'breach' / 'wyłom'. | O14 (rebuilt) | reviewer | E66 |
| `DRPG.Passage.mark.from` | both | the punctuation "" in English, ":" in Polish | DB26 | T22 | E71 |
| `DRPG.Passage.mark.from` | pl | "e przejście z: {room}" - X12, a Polish preposition before a colon and a placeholder | X12 (rebuilt) | T5 | E71 |
| `DRPG.Passage.mark.to` | both | the punctuation "" in English, ":" in Polish | DB26 | T22 | E71 |
| `DRPG.Passage.mark.to` | pl | "e przejście do: {room}" - X12, a Polish preposition before a colon and a placeholder | X12 (rebuilt) | T5 | E71 |
| `DRPG.Passage.pick.made` | pl | "w zakładce Przejścia." - "Przejścia" with no "tajn*" before it: a passage is "tajne przejście" | A10 | T28 | E66 |
| `DRPG.Passage.pick.made` | both | 'Secret passage {passage} made.' / 'Tajne przejście {passage} gotowe.' drops the verb (telegraph). | X6 (rebuilt) | reviewer | E71 |
| `DRPG.Passage.pick.new` | pl | "+ Nowe przejście" - "przejście" with no "tajn*" before it: a passage is "tajne przejście" | A10 | T28 | E66 |
| `DRPG.Passage.pick.step` | both | 'Click {n} of 2' / 'Kliknięcie {n} z 2' types the count of clicks into the prose as the digit '2' instead of a placeholder. | O5 (rebuilt) | reviewer | E71 |
| `DRPG.Passage.pick.tunnelFirst` | pl | 'przełącz na drugie piętro' means 'the second floor', not 'the other floor' as the English says; 'na inne piętro' is meant. | grammar | reviewer | E71 |
| `DRPG.Passage.pick.tunnelHint` | en | "...of two rooms, on one floor or..." - a list with no comma before its last "and"/"or" | DB35 | T17 | E71 |
| `DRPG.Passage.pick.tunnelMade` | pl | "w zakładce Przejścia." - "Przejścia" with no "tajn*" before it: a passage is "tajne przejście" | A10 | T28 | E66 |
| `DRPG.Passage.pick.tunnelMade` | both | 'Tunnel {passage} made.' / 'Tunel {passage} gotowy.' drops the verb (telegraph). | X6 (rebuilt) | reviewer | E71 |
| `DRPG.Passage.pick.tunnelSecond` | en | "...inside another room, on this floor or..." - a list with no comma before its last "and"/"or" | DB35 | T17 | E71 |
| `DRPG.Passage.pick.why.door` | pl | 'Tajne przejście idzie w zwykłej ścianie' is not natural Polish for where a passage may be placed ('musi być w zwykłej ścianie'). | grammar | reviewer | E71 |
| `DRPG.Passage.pick.why.noWall` | en | 'No wall there.' drops the subject and verb (telegraph), where the Polish says 'Tu nie ma ściany.' | X6 (rebuilt) | reviewer | E71 |
| `DRPG.Passage.show.intro` | both | the punctuation "?." in English, "?:." in Polish | DB26 | T22 | E71 |
| `DRPG.Passage.show.intro` | pl | "cie? Jesteś w: {room}." - X12, a Polish preposition before a colon and a placeholder | X12 (rebuilt) | T5 | E71 |
| `DRPG.Passage.show.note` | en | 'Costs no action; the GMs are told.' drops the subject (telegraph). | X6 (rebuilt) | reviewer | E71 |
| `DRPG.Passage.show.title` | en | "w the passage - {passage}" - X4, a dash that tacks an aside on | X4 (rebuilt) | T5 | E71 |
| `DRPG.Passage.show.title` | pl | "jne przejście - {passage}" - X4, a dash that tacks an aside on | X4 (rebuilt) | T5 | E71 |
| `DRPG.Passage.tab.footnote` | pl | "je znają, a przejście jest dla ni" - "przejście" with no "tajn*" before it: a passage is "tajne przejście" | A10 | T28 | E66 |
| `DRPG.Passage.tab.footnote` | pl | "uń zapomina przejście i to, kto j" - "przejście" with no "tajn*" before it: a passage is "tajne przejście" | A10 | T28 | E66 |
| `DRPG.Passage.tab.footnote` | pl | "y uczeń zna przejście i nikt nie" - "przejście" with no "tajn*" before it: a passage is "tajne przejście" | A10 | T28 | E66 |
| `DRPG.Passage.tab.footnote` | both | The footnote calls the Close button 'Closed' / 'Zamknięte', while the button is 'Close' / 'Zamknij' (DRPG.Passage.tab.close), two names for one control. | O14 (rebuilt) | reviewer | E66 |
| `DRPG.Passage.tab.footnote` | both | 'Make public: every student knows ...; Make secret: only ...' / 'Ujawnij: ...; Utajnij: ...' chains label-colon-value inside one sentence. | X7 (rebuilt) | reviewer | E71 |
| `DRPG.Passage.tab.grant` | pl | "uczniowi to przejście" - "przejście" with no "tajn*" before it: a passage is "tajne przejście" | A10 | T28 | E66 |
| `DRPG.Passage.tab.intro` | pl | In 'Zastosuj i Anuluj go nie zmieniają' the masculine 'go' can only take 'przycisk', so it says Apply and Cancel do not change the button, not its effect. | PL23 (rebuilt) | reviewer | E71 |
| `DRPG.Passage.tab.revokeAsk` | pl | "re łączy to przejście. Kiedy prze" - "przejście" with no "tajn*" before it: a passage is "tajne przejście" | A10 | T28 | E66 |
| `DRPG.Passage.tab.revokeAsk` | pl | "ście. Kiedy przejście ma się zamk" - "przejście" with no "tajn*" before it: a passage is "tajne przejście" | A10 | T28 | E66 |
| `DRPG.Passage.tab.revokeNote` | both | 'Revoke now: ... Revoke when they leave the room: ...' / 'Odbierz teraz: ... Odbierz po wyjściu z pokoju: ...' chains label-colon-value inside the text. | X7 (rebuilt) | reviewer | E71 |
| `DRPG.Passage.tab.revokePublicAsk` | pl | "ame} zna to przejście, tak jak ka" - "przejście" with no "tajn*" before it: a passage is "tajne przejście" | A10 | T28 | E66 |
| `DRPG.Passage.tab.revokePublicNote` | pl | "dy utajnisz przejście, będzie dla" - "przejście" with no "tajn*" before it: a passage is "tajne przejście" | A10 | T28 | E66 |
| `DRPG.Passage.tab.revokeTitle` | en | "Revoke - {passage}" - X4, a dash that tacks an aside on | X4 (rebuilt) | T5 | E71 |
| `DRPG.Passage.tab.revokeTitle` | pl | "Odbierz - {passage}" - X4, a dash that tacks an aside on | X4 (rebuilt) | T5 | E71 |
| `DRPG.Passage.tab.shared` | pl | "poznaje to przejście." - "przejście" with no "tajn*" before it: a passage is "tajne przejście" | A10 | T28 | E66 |
| `DRPG.Passage.tab.shared` | pl | "} i każdy z nich poznaje to" - X13, a singular they as a Polish plural | X13 (rebuilt) | T5 | E71 |
| `DRPG.Passage.tab.shared` | both | With one player the text renders 'Chie all play Aiko' / 'Chie grają postacią Aiko', a plural verb for one subject; the key needs a form for one player. | grammar | reviewer | E71 |
| `DRPG.Passage.tab.startHint` | pl | "nie daje mu przejścia teraz." - "przejścia" with no "tajn*" before it: a passage is "tajne przejście" | A10 | T28 | E66 |
| `DRPG.Passage.tab.startHint` | en | 'Known again after each season reset.' drops the subject and verb (telegraph). | X6 (rebuilt) | reviewer | E71 |
| `DRPG.Passage.tab.startRemove` | en | 'Take off the season's start' is not idiomatic English for removing a student from the season-start list. | grammar | reviewer | E71 |
| `DRPG.Passage.tab.stateBroken` | pl | "ęła - wskaż przejście jeszcze raz" - "przejście" with no "tajn*" before it: a passage is "tajne przejście" | A10 | T28 | E66 |
| `DRPG.Passage.tab.stateBroken` | en | "he wall moved - pick it again" - X4, a dash that tacks an aside on | X4 (rebuilt) | T5 | E71 |
| `DRPG.Passage.tab.stateBroken` | pl | "ię przesunęła - wskaż przejśc" - X4, a dash that tacks an aside on | X4 (rebuilt) | T5 | E71 |
| `DRPG.Passage.tab.stateBroken` | en | In 'The wall moved - pick it again' the 'it' refers to the wall, while the Polish shows the passage is meant ('wskaż przejście'). | grammar | reviewer | E71 |
| `DRPG.Passage.tab.wayHint` | pl | "kształtem. Przejście w ścianie z" - "Przejście" with no "tajn*" before it: a passage is "tajne przejście" | A10 | T28 | E66 |
| `DRPG.Passage.tab.wayHint` | pl | 'wybierz to pod ich kształtem' ('under their shape') is not natural Polish and loses the column's name 'Kształt' that the English 'under its Shape' points to. | grammar | reviewer | E71 |
| `DRPG.Passage.tab.wayOnly` | both | the punctuation "" in English, "::" in Polish | DB26 | T22 | E71 |
| `DRPG.Passage.tab.wayOnly` | pl | "Tylko z: {from}, do: {to}" - X12, a Polish preposition before a colon and a placeholder | X12 (rebuilt) | T5 | E71 |
| `DRPG.Passage.why.cannotClose` | pl | "przejścia nie udało s" - "przejścia" with no "tajn*" before it: a passage is "tajne przejście" | A10 | T28 | E66 |
| `DRPG.Passage.why.cannotClose` | pl | "w zakładce Przejścia." - "Przejścia" with no "tajn*" before it: a passage is "tajne przejście" | A10 | T28 | E66 |
| `DRPG.Passage.why.gmOnly` | en | 'Ask it again from a GM's.' is not grammatical English ('ask it', the elided noun after 'a GM's'). | grammar | reviewer | E71 |
| `DRPG.Passage.why.idTaken` | pl | "zajęło inne przejście. Odejmij pr" - "przejście" with no "tajn*" before it: a passage is "tajne przejście" | A10 | T28 | E66 |
| `DRPG.Passage.why.isBreach` | pl | "wyłom, nie przejście. Ścianę prz" - "przejście" with no "tajn*" before it: a passage is "tajne przejście" | A10 | T28 | E66 |
| `DRPG.Passage.why.isBreach` | en | "is a breach, not a passage. Close the br" - X3, the antithesis "X, not Y" | X3 (rebuilt) | T5 | E71 |
| `DRPG.Passage.why.isBreach` | pl | "to wyłom, nie przejście. Ścianę przyw" - X3, the antithesis "X, not Y" | X3 (rebuilt) | T5 | E71 |
| `DRPG.Passage.why.isBreach` | both | 'Close the breach gives the wall back.' / 'Ścianę przywraca Zamknij wyłom.' uses the button's name unmarked as a subject, so it reads as an imperative and the sentence does not parse. | grammar | reviewer | E71 |
| `DRPG.Passage.why.noBreach` | pl | "rojekt. Nie trzeba nic robić." - X11, a passive that hides who acts | X11 (rebuilt) | T5 | E71 |
| `DRPG.Passage.why.noBuilder` | pl | 'jego budujący' is not a Polish noun phrase; the builder needs 'osoba, która go budowała' or similar. | grammar | reviewer | E71 |
| `DRPG.Passage.why.noSide` | pl | "prowadzi to przejście albo wyłom." - "przejście" with no "tajn*" before it: a passage is "tajne przejście" | A10 | T28 | E66 |
| `DRPG.Passage.why.notKnown` | pl | "ie zna tego przejścia albo jest o" - "przejścia" with no "tajn*" before it: a passage is "tajne przejście" | A10 | T28 | E66 |
| `DRPG.Passage.why.notKnown` | pl | "w zakładce Przejścia." - "Przejścia" with no "tajn*" before it: a passage is "tajne przejście" | A10 | T28 | E66 |
| `DRPG.Passage.why.notOwn` | pl | 'na karcie budującego' and 'z karty wspólnej' call the character sheet 'karta', which is reserved for the chat card. | PL-d | reviewer | E66 |
| `DRPG.Passage.why.notRepairable` | en | 'the item is no usable or tool' is ungrammatical ('is not a usable item or a tool'). | grammar | reviewer | E71 |
| `DRPG.Passage.why.taken` | pl | "dzi na inne przejście na tej ścia" - "przejście" with no "tajn*" before it: a passage is "tajne przejście" | A10 | T28 | E66 |
| `DRPG.Passage.why.unknown` | pl | 'moduł nie umie powiedzieć dlaczego' lacks the comma Polish requires before the subordinate 'dlaczego'. | grammar | reviewer | E71 |

### DRPG.Frisk.* (A11)

53 key(s) in en.json; 19 finding(s) of the report on 17 key(s); 38 row(s) of the reviewer on 29 key(s).

| key | lang | finding | rule | test | fix |
| --- | --- | --- | --- | --- | --- |
| `DRPG.Frisk.allow` | pl | The button 'Pozwól' has no object, where the English 'Let them look' has one. | O11 (rebuilt) | reviewer | E71 |
| `DRPG.Frisk.asAsked` | pl | 'Tak wyglądały ich kieszenie' renders the singular 'they' as a Polish plural 'ich'. | X13 (rebuilt) | reviewer | E71 |
| `DRPG.Frisk.askClock` | en | 'No answer in {s} seconds' is no plural family and renders '1 seconds'. | grammar | reviewer | E71 |
| `DRPG.Frisk.askTitle` | both | The window title is a question, 'Turn out your pockets?' / 'Pokażesz kieszenie?', where a title holds the window's subject. | section 3 (window title) (rebuilt) | reviewer | E71 |
| `DRPG.Frisk.askedAlready` | both | the punctuation ".." in English, ":.." in Polish | DB26 | T22 | E71 |
| `DRPG.Frisk.askedAlready` | pl | 'prośba do tej osoby już padła: {who}' puts a label-colon-placeholder after the sentence's verb. | X12 (rebuilt) | reviewer | E71 |
| `DRPG.Frisk.askedAlready` | pl | 'W tej porze dnia' takes the wrong preposition; Polish says 'o tej porze dnia', as DRPG.Overflow.silenced does. | grammar | reviewer | E71 |
| `DRPG.Frisk.caught` | both | the punctuation ".." in English, ":.." in Polish | DB26 | T22 | E71 |
| `DRPG.Frisk.caught` | pl | 'Łapiesz na gorącym uczynku: {who}.' puts the caught person after a colon instead of in the sentence. | X12 (rebuilt) | reviewer | E71 |
| `DRPG.Frisk.caughtTrying` | both | the punctuation ".." in English, ":.." in Polish | DB26 | T22 | E71 |
| `DRPG.Frisk.caughtTrying` | pl | 'Łapiesz na gorącym uczynku: {who}.' puts the caught person after a colon instead of in the sentence. | X12 (rebuilt) | reviewer | E71 |
| `DRPG.Frisk.caughtTrying` | pl | The impersonal 'Nie udało się dobrze przyjrzeć twoim kieszeniom' hides that it was {who} who failed, and can read as the reader failing. | grammar | reviewer | E71 |
| `DRPG.Frisk.force` | pl | The button 'Zmuś' has no object, where the English 'Make them' has one. | O11 (rebuilt) | reviewer | E71 |
| `DRPG.Frisk.forceSent` | both | the punctuation ".." in English, ":.." in Polish | DB26 | T22 | E71 |
| `DRPG.Frisk.forceSent` | pl | 'Sięgasz siłą do kieszeni: {name}.' puts the owner of the pockets after a colon. | X12 (rebuilt) | reviewer | E71 |
| `DRPG.Frisk.forceSent` | both | 'How it went settles in a moment.' / 'Jak poszło, rozstrzygnie się za chwilę.' mixes a past 'went' / 'poszło' with a result still to come. | O15 (rebuilt) | reviewer | E71 |
| `DRPG.Frisk.forceText` | en | 'You have {s} seconds to decide' is no plural family and renders '1 seconds'. | grammar | reviewer | E71 |
| `DRPG.Frisk.forceTitle` | both | The window title is a question, 'Make them?' / 'Zmusić?', where a title holds the window's subject. | section 3 (window title) (rebuilt) | reviewer | E71 |
| `DRPG.Frisk.gmFor` | both | the punctuation "." in English, ":." in Polish | DB26 | T22 | E71 |
| `DRPG.Frisk.gmFor` | pl | 'Odpowiadasz za postać bez gracza: {name}.' puts the character after a colon. | X12 (rebuilt) | reviewer | E71 |
| `DRPG.Frisk.gmIncident` | both | the punctuation ".:." in English, ":.:." in Polish | DB26 | T22 | E71 |
| `DRPG.Frisk.gmIncident` | pl | '{who} prosi o pokazanie kieszeni: {target}.' puts the target after a colon. | X12 (rebuilt) | reviewer | E71 |
| `DRPG.Frisk.gmIncident` | en | 'in {s} seconds' is no plural family and renders 'in 1 seconds'. | grammar | reviewer | E71 |
| `DRPG.Frisk.gmIncidentNow` | both | the punctuation ".:." in English, ":.:." in Polish | DB26 | T22 | E71 |
| `DRPG.Frisk.gmIncidentNow` | pl | '{who} prosi o pokazanie kieszeni: {target}.' puts the target after a colon. | X12 (rebuilt) | reviewer | E71 |
| `DRPG.Frisk.gmKept` | both | the punctuation ".:.." in English, ":.:.." in Polish | DB26 | T22 | E71 |
| `DRPG.Frisk.gmKept` | pl | '{who} prosi o pokazanie kieszeni: {target}.' puts the target after a colon. | X12 (rebuilt) | reviewer | E71 |
| `DRPG.Frisk.gmKept` | pl | 'To ciało, którego śmierć trzymasz' is a calque of 'a body you keep'; Polish needs what is kept ('którego śmierć trzymasz w tajemnicy'). | grammar | reviewer | E71 |
| `DRPG.Frisk.gmKept` | en | 'in {s} seconds' is no plural family and renders 'in 1 seconds'. | grammar | reviewer | E71 |
| `DRPG.Frisk.gmKeptNow` | both | the punctuation ".:.." in English, ":.:.." in Polish | DB26 | T22 | E71 |
| `DRPG.Frisk.gmKeptNow` | pl | '{who} prosi o pokazanie kieszeni: {target}.' puts the target after a colon. | X12 (rebuilt) | reviewer | E71 |
| `DRPG.Frisk.gmKeptNow` | pl | 'To ciało, którego śmierć trzymasz' is a calque of 'a body you keep', as in gmKept. | grammar | reviewer | E71 |
| `DRPG.Frisk.interrupted` | en | 'this cannot be done now' is a passive that hides the reader as the one who acts. | X11 (rebuilt) | reviewer | E71 |
| `DRPG.Frisk.missed` | pl | The impersonal 'Nie udaje się dobrze przyjrzeć temu, co nosi {who}' hides the reader, where the English says 'You do not get a proper look'. | X11 (rebuilt) | reviewer | E71 |
| `DRPG.Frisk.openHint` | pl | 'Poproś, żeby pokazali kieszenie. Jeśli odmówią ..., możesz ich zmusić' renders the singular 'they' as a Polish plural. | X13 (rebuilt) | reviewer | E71 |
| `DRPG.Frisk.openHintAskOnly` | pl | 'Poproś, żeby pokazali kieszenie.' renders the singular 'they' as a Polish plural (cf. pair N25). | X13 (rebuilt) | reviewer | E71 |
| `DRPG.Frisk.rowLabel` | pl | 'Zobacz, co nosi' has no subject for 'nosi': the row names no person for the verb to refer to. | PL23 (rebuilt) | reviewer | E71 |
| `DRPG.Frisk.sent` | both | the punctuation ".--." in English, ":.--." in Polish | DB26 | T22 | E71 |
| `DRPG.Frisk.sent` | en | "What you see - and whether t" - X4, a dash that tacks an aside on | X4 (rebuilt) | T5 | E71 |
| `DRPG.Frisk.sent` | pl | "Co zobaczysz - i czy poczuli" - X4, a dash that tacks an aside on | X4 (rebuilt) | T5 | E71 |
| `DRPG.Frisk.sent` | pl | 'Sięgasz do kieszeni: {name}.' puts the owner of the pockets after a colon. | X12 (rebuilt) | reviewer | E71 |
| `DRPG.Frisk.sent` | pl | 'czy poczuli' renders the singular 'they' as a Polish plural. | X13 (rebuilt) | reviewer | E71 |
| `DRPG.Frisk.shown` | both | the punctuation ".." in English, ":.." in Polish | DB26 | T22 | E71 |
| `DRPG.Frisk.shown` | pl | 'Pokazujesz kieszenie: {who}.' puts the person shown after a colon. | X12 (rebuilt) | reviewer | E71 |
| `DRPG.Frisk.wForced` | both | the punctuation "." in English, ":." in Polish | DB26 | T22 | E71 |
| `DRPG.Frisk.wForced` | pl | '{who} siłą przegląda kieszenie: {target}.' puts the target after a colon. | X12 (rebuilt) | reviewer | E71 |
| `DRPG.Frisk.wForcedFailed` | both | the punctuation "." in English, ":." in Polish | DB26 | T22 | E71 |
| `DRPG.Frisk.wForcedFailed` | pl | '{who} próbuje siłą przejrzeć kieszenie: {target}, bez skutku.' puts the target after a colon. | X12 (rebuilt) | reviewer | E71 |
| `DRPG.Frisk.wLetGo` | both | the punctuation "." in English, ":." in Polish | DB26 | T22 | E71 |
| `DRPG.Frisk.wLetGo` | pl | '{who} prosi o pokazanie kieszeni: {target}, i odpuszcza.' puts the target after a colon. | X12 (rebuilt) | reviewer | E71 |
| `DRPG.Frisk.wShown` | both | the punctuation "." in English, ":." in Polish | DB26 | T22 | E71 |
| `DRPG.Frisk.wShown` | pl | '{target} pokazuje kieszenie na prośbę: {who}.' puts the asker after a colon. | X12 (rebuilt) | reviewer | E71 |
| `DRPG.Frisk.wWalkedAway` | both | the punctuation "." in English, ":." in Polish | DB26 | T22 | E71 |
| `DRPG.Frisk.wWalkedAway` | pl | '{who} prosi o pokazanie kieszeni: {target}, a ta osoba odchodzi.' puts the target after a colon. | X12 (rebuilt) | reviewer | E71 |
| `DRPG.Frisk.waiting` | both | the punctuation ".." in English, ":.." in Polish | DB26 | T22 | E71 |
| `DRPG.Frisk.waiting` | pl | 'Prosisz o pokazanie kieszeni: {who}.' puts the person asked after a colon. | X12 (rebuilt) | reviewer | E71 |
| `DRPG.Frisk.waiting` | en | 'Waiting for an answer.' drops the subject and verb (telegraph), where the Polish says 'Czekasz na odpowiedź.' | X6 (rebuilt) | reviewer | E71 |

### DRPG.Steal.takeHint (A11)

1 key(s) in en.json; 2 finding(s) of the report on 1 key(s); 0 row(s) of the reviewer on 0 key(s).

| key | lang | finding | rule | test | fix |
| --- | --- | --- | --- | --- | --- |
| `DRPG.Steal.takeHint` | en | "ver comes out - a critical le" - X4, a dash that tacks an aside on | X4 (rebuilt) | T5 | E71 |
| `DRPG.Steal.takeHint` | pl | "e, co wyjdzie - krytyk pozwal" - X4, a dash that tacks an aside on | X4 (rebuilt) | T5 | E71 |

### E70's mode texts (the keys E70 C7 2f1e8772 and C8 fc547885 added) (E70)

98 key(s) in en.json; 19 finding(s) of the report on 10 key(s); 19 row(s) of the reviewer on 19 key(s).

| key | lang | finding | rule | test | fix |
| --- | --- | --- | --- | --- | --- |
| `DRPG.Events.trialNext` | pl | 'Następny: {name}' is masculine and renders 'Następny: Aiko' for a woman. | grammar | reviewer | E71 |
| `DRPG.Floor.bar.inClosing` | both | 'End this mode ends it.' / 'Zakończ ten tryb go kończy.' uses the button's name unmarked as a subject, so the sentence reads as a garbled imperative. | grammar | reviewer | E71 |
| `DRPG.Floor.bar.inRound` | both | 'End this mode ends it.' / 'Zakończ ten tryb ją kończy.' uses the button's name unmarked as a subject, so the sentence reads as a garbled imperative. | grammar | reviewer | E71 |
| `DRPG.Floor.closing.alreadySpoke` | both | the punctuation "" in English, "()" in Polish | DB26 | T22 | E71 |
| `DRPG.Floor.closing.alreadySpoke` | pl | 'Już mówił(a)' brackets the gender; where the gendered form sounds artificial the text takes the present tense or another form without gender. | PL17 | reviewer | E71 |
| `DRPG.Floor.closing.gmDrawn` | pl | 'Wylosowano: {name}. Zgłoszeni: {names}.' puts label-colon-placeholder pairs into Polish sentences, and 'Zgłoszeni: Chie' gives one woman a masculine plural. | X12 (rebuilt) | reviewer | E71 |
| `DRPG.Floor.closing.gmVolunteers` | pl | "Closing Argument - {seconds} s na zgłoszenia. Zgłosz" - 2 sentences and no finite verb in any (X6, telegraph style; T18, a candidate) | X6 (rebuilt) | T18 | E71 |
| `DRPG.Floor.closing.gmVolunteers` | en | "sing Argument - {seconds} s t" - X4, a dash that tacks an aside on | X4 (rebuilt) | T5 | E71 |
| `DRPG.Floor.closing.gmVolunteers` | pl | "sing Argument - {seconds} s n" - X4, a dash that tacks an aside on | X4 (rebuilt) | T5 | E71 |
| `DRPG.Floor.closing.holding` | pl | "ówi {who} - zostało {seconds} s." - a bare count in a sentence: its predicate belongs in a plural family (PL7; T25) | PL7 | T25 | E71 |
| `DRPG.Floor.closing.holding` | en | "{who} speaks - {seconds} s l" - X4, a dash that tacks an aside on | X4 (rebuilt) | T5 | E71 |
| `DRPG.Floor.closing.holding` | pl | "t: mówi {who} - zostało {seco" - X4, a dash that tacks an aside on | X4 (rebuilt) | T5 | E71 |
| `DRPG.Floor.closing.opened` | both | 'Volunteer within 30 s' / 'Zgłoś się w ciągu 30 s' types the volunteering time into the prose as the digit '30' instead of a placeholder (Trial.claim.body has {seconds}). | O5 (rebuilt) | reviewer | E71 |
| `DRPG.Floor.closing.volunteered` | both | the punctuation "" in English, "()" in Polish | DB26 | T22 | E71 |
| `DRPG.Floor.closing.volunteered` | pl | 'zgłosił(a) się' brackets the gender instead of a form without it. | PL17 | reviewer | E71 |
| `DRPG.Floor.closing.waitsForGm` | pl | "Closing Argument czeka na twój wybór, nie na zegar." - naturalness pair N35 (X3) is not applied yet (written 31.10 for the owner's pilot, not confirmed; docs/text-style.md section 12; T27) | N35 (X3) | T27 | E71 |
| `DRPG.Floor.closing.waitsForGm` | en | "your choice, not for a clock." - X3, the antithesis "X, not Y" | X3 (rebuilt) | T5 | E71 |
| `DRPG.Floor.closing.waitsForGm` | pl | "a twój wybór, nie na zegar." - X3, the antithesis "X, not Y" | X3 (rebuilt) | T5 | E71 |
| `DRPG.Floor.holdingRound` | en | "{who} speaks - {seconds} s." - X4, a dash that tacks an aside on | X4 (rebuilt) | T5 | E71 |
| `DRPG.Floor.holdingRound` | pl | "}: mówi {who} - {seconds} s." - X4, a dash that tacks an aside on | X4 (rebuilt) | T5 | E71 |
| `DRPG.Floor.holdingRound` | pl | 'Następny: {next}' is masculine and renders 'Następny: Aiko' for a woman. | grammar | reviewer | E71 |
| `DRPG.Floor.holdingRoundLast` | en | "{who} speaks - {seconds} s," - X4, a dash that tacks an aside on | X4 (rebuilt) | T5 | E71 |
| `DRPG.Floor.holdingRoundLast` | pl | "}: mówi {who} - {seconds} s," - X4, a dash that tacks an aside on | X4 (rebuilt) | T5 | E71 |
| `DRPG.Floor.lead.closing` | both | 'End the Closing Argument ends it' / 'Zakończ Closing Argument go kończy' uses the button's name unmarked as a subject, so the sentence reads as a garbled imperative. | grammar | reviewer | E71 |
| `DRPG.Floor.lead.round` | both | 'each speaker in turn' / 'mówcy po kolei' drops the verb (telegraph). | X6 (rebuilt) | reviewer | E71 |
| `DRPG.Floor.mode.testimony` | pl | The mode is 'Zeznanie' in Polish, where the glossary keeps the name 'Testimony' in the Polish UI (TR18). | testimony | reviewer | E66 |
| `DRPG.Floor.round.over` | both | the punctuation "." in English, ":." in Polish | DB26 | T22 | E71 |
| `DRPG.Floor.round.over` | pl | 'Koniec: {mode}.' is a label-colon-placeholder where the English is a sentence, 'The {mode} is over.' | X12 (rebuilt) | reviewer | E71 |
| `DRPG.Floor.roundWindow.length` | both | 'The round: {length}, speakers: {n}.' / 'Runda: {length}, mówców: {n}.' chains label-colon-value inside one sentence. | X7 (rebuilt) | reviewer | E71 |
| `DRPG.Floor.startTestimony` | pl | The button is 'Zeznanie' in Polish, where the glossary keeps the name 'Testimony' in the Polish UI (TR18). | testimony | reviewer | E66 |
| `DRPG.Hud.trial.testimony` | pl | The HUD shows 'Zeznanie', where the glossary keeps the name 'Testimony' in the Polish UI (TR18). | testimony | reviewer | E66 |
| `DRPG.Trial.claim.counted` | both | the punctuation "." in English, "()." in Polish | DB26 | T22 | E71 |
| `DRPG.Trial.claim.counted` | pl | 'Zgłosiłeś(-aś) się' brackets the gender; the present tense or a form without gender is the rule's way out. | PL17 | reviewer | E71 |
| `DRPG.Trial.claim.no` | both | The button 'Not me' / 'Nie ja' is a negation, which a button never holds. | X14 (rebuilt) | reviewer | E71 |
| `DRPG.Trial.objectionNoneInMode` | both | 'No Objections during {mode}.' / 'Bez Objection w trybie {mode}.' drops the verb (telegraph). | X6 (rebuilt) | reviewer | E71 |
| `DRPG.Trial.turn.closingPassEarly` | both | 'in your first 30 s' / 'w pierwszych 30 s' types the time into the prose as the digit '30' instead of a placeholder. | O5 (rebuilt) | reviewer | E71 |
| `DRPG.Trial.turn.title` | en | "Your turn - {seconds} s" - X4, a dash that tacks an aside on | X4 (rebuilt) | T5 | E71 |
| `DRPG.Trial.turn.title` | pl | "Twoja tura - {seconds} s" - X4, a dash that tacks an aside on | X4 (rebuilt) | T5 | E71 |

