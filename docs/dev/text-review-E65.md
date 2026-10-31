# The review of texts written before the guide (E65 C13)

Written 31.10.2026 on branch e65 at E65 C12 (6630e3fe), for E65-22. The texts of A7 (the notice history), A8 (the
texts of E77 and E78), A10 (passages), A11 (the Frisk) and E70's trial modes were written before docs/text-style.md
and docs/glossary.json existed. This file lists, group by group, what the text lint finds in them and which stage owns
each fix. **Nothing in lang/ changes here**: a row is fixed by the stage it names, in the batch that rewrites its key.

## How the rows were read

- The source of every row is `node tools/check.mjs text` on this tree: each detector's findings, those it prints and
  those of a stage not yet shipped (T8's "not yet due"), read off a scratch copy of the part that writes them all out
  (S/stages/E65/scratch/c13/findings.json; S is the stage's scratchpad, outside the repository). A finding belongs to
  a group by its key.
- A group is its key prefix as the stage's spec names it; "E70's mode texts" are the 98 keys of lang/en.json that
  E70 C7 (2f1e8772, Testimony and Panic Round) and E70 C8 (fc547885, the Closing Argument) added, all still there.
- The rule column names the guide's rule (X1-X21 rebuilt 30.10 from their names, so marked), the budget (DB11, its
  numbers rebuilt 30.10), a DB answer, an amend or a naturalness pair. "Rebuilt" means the rule is a guess until the
  owner's pilot confirms it; such a row is a candidate, not a verdict.
- The owning stage: **E66** for T28's rows (T28 turns FAIL from E66, and A10's passage words hold from E79, which
  has shipped, so E66 is where they must be fixed); **E71** for every other row - the stage whose batches rewrite these
  keys (T4, T5's X5/X9/X15/X16/X18, T25 turn FAIL there; T17, T18, T22 and T27 stay report and are fixed with their
  key's batch). The batch inside E71 is E71's to set.
- The reviewer agent's reading of the render sheet (the slice's second source) is not in this file: no agent could be
  started for this commit (STATUS Open 79). The rows below are the report's alone.
- Every key named in a row is a key of lang/en.json; DRPG.Config.ACTIONS.palm.hint, named in the Frisk row's
  section, is config.mjs's English prose (`walkConfigProse`), which has no lang/en.json key.

## The groups

| group | from | keys | keys with a finding | rows | E66 | E71 | by test |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DRPG.Room.* | A8 | 6 | 1 | 1 | 0 | 1 | T22 1 |
| DRPG.FoundryTools.* | A8 | 4 | 0 | 0 | 0 | 0 | - |
| DRPG.Move.entered | A8 | 1 | 1 | 2 | 0 | 2 | T5 1, T22 1 |
| DRPG.Vault.image* | A8 | 4 | 1 | 3 | 0 | 3 | T4 2, T17 1 |
| DRPG.Voice.tile.* | A8 | 12 | 0 | 0 | 0 | 0 | - |
| DRPG.Voice.held.* | A8 | 13 | 1 | 2 | 0 | 2 | T5 2 |
| DRPG.Voice.list.* | A8 | 15 | 7 | 7 | 0 | 7 | T5 1, T22 6 |
| DRPG.Voice.panel.* | A8 | 9 | 0 | 0 | 0 | 0 | - |
| DRPG.Notices.* | A7 | 36 | 1 | 2 | 0 | 2 | T5 2 |
| DRPG.Passage.* | A10 | 155 | 36 | 59 | 24 | 35 | T5 25, T17 2, T22 7, T27 1, T28 24 |
| DRPG.Frisk.* | A11 | 53 | 17 | 19 | 0 | 19 | T5 2, T22 17 |
| DRPG.Steal.takeHint | A11 | 1 | 1 | 2 | 0 | 2 | T5 2 |
| E70's mode texts | E70 | 98 | 10 | 19 | 0 | 19 | T5 12, T18 1, T22 4, T25 1, T27 1 |
| all | | 407 | 76 | 116 | 24 | 92 | T5 47, T22 36, T28 24, T17 3, T4 2, T27 2, T18 1, T25 1 |

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

## The rows
### DRPG.Room.* (A8)

6 key(s) in en.json; 1 finding(s) of the report on 1 key(s).

| key | lang | finding | rule | test | fix |
| --- | --- | --- | --- | --- | --- |
| `DRPG.Room.imageOpen` | both | the punctuation "" in English, ":" in Polish | DB26 | T22 | E71 |

### DRPG.FoundryTools.* (A8)

4 key(s) in en.json; 0 finding(s) of the report on 0 key(s).

No finding of the report.

### DRPG.Move.entered (A8)

1 key(s) in en.json; 2 finding(s) of the report on 1 key(s).

| key | lang | finding | rule | test | fix |
| --- | --- | --- | --- | --- | --- |
| `DRPG.Move.entered` | both | the punctuation "." in English, ":." in Polish | DB26 | T22 | E71 |
| `DRPG.Move.entered` | pl | "Wchodzisz do: {room}." - X12, a Polish preposition before a colon and a placeholder | X12 (rebuilt) | T5 | E71 |

### DRPG.Vault.image* (A8)

4 key(s) in en.json; 3 finding(s) of the report on 1 key(s).

| key | lang | finding | rule | test | fix |
| --- | --- | --- | --- | --- | --- |
| `DRPG.Vault.imageRefused` | en | "...png, webp or..." - a list with no comma before its last "and"/"or" | DB35 | T17 | E71 |
| `DRPG.Vault.imageRefused` | en | 25 words, over the toast target of 20 | DB11 (budgets, rebuilt) | T4 | E71 |
| `DRPG.Vault.imageRefused` | pl | 22 words, over the toast target of 20 | DB11 (budgets, rebuilt) | T4 | E71 |

### DRPG.Voice.tile.* (A8)

12 key(s) in en.json; 0 finding(s) of the report on 0 key(s).

No finding of the report.

### DRPG.Voice.held.* (A8)

13 key(s) in en.json; 2 finding(s) of the report on 1 key(s).

| key | lang | finding | rule | test | fix |
| --- | --- | --- | --- | --- | --- |
| `DRPG.Voice.held.external` | en | "ts own window - use the contr" - X4, a dash that tacks an aside on | X4 (rebuilt) | T5 | E71 |
| `DRPG.Voice.held.external` | pl | "osobnym oknie - użyj jego prz" - X4, a dash that tacks an aside on | X4 (rebuilt) | T5 | E71 |

### DRPG.Voice.list.* (A8)

15 key(s) in en.json; 7 finding(s) of the report on 7 key(s).

| key | lang | finding | rule | test | fix |
| --- | --- | --- | --- | --- | --- |
| `DRPG.Voice.list.count.one` | both | the punctuation "" in English, ":" in Polish | DB26 | T22 | E71 |
| `DRPG.Voice.list.count.other` | both | the punctuation "" in English, ":" in Polish | DB26 | T22 | E71 |
| `DRPG.Voice.list.gmBlock` | both | the punctuation "" in English, ":()" in Polish | DB26 | T22 | E71 |
| `DRPG.Voice.list.gmNoBlock` | en | "microphone can be blocked from here." - X11, a passive that hides who acts | X11 (rebuilt) | T5 | E71 |
| `DRPG.Voice.list.gmUnblock` | both | the punctuation "" in English, ":" in Polish | DB26 | T22 | E71 |
| `DRPG.Voice.list.muteFor` | both | the punctuation "" in English, ":" in Polish | DB26 | T22 | E71 |
| `DRPG.Voice.list.unmuteFor` | both | the punctuation "" in English, ":" in Polish | DB26 | T22 | E71 |

### DRPG.Voice.panel.* (A8)

9 key(s) in en.json; 0 finding(s) of the report on 0 key(s).

No finding of the report.

### DRPG.Notices.* (A7)

36 key(s) in en.json; 2 finding(s) of the report on 1 key(s).

| key | lang | finding | rule | test | fix |
| --- | --- | --- | --- | --- | --- |
| `DRPG.Notices.newPill` | en | "New notices - show them" - X4, a dash that tacks an aside on | X4 (rebuilt) | T5 | E71 |
| `DRPG.Notices.newPill` | pl | "powiadomienia - pokaż je" - X4, a dash that tacks an aside on | X4 (rebuilt) | T5 | E71 |

### DRPG.Passage.* (A10)

155 key(s) in en.json; 59 finding(s) of the report on 36 key(s).

| key | lang | finding | rule | test | fix |
| --- | --- | --- | --- | --- | --- |
| `DRPG.Passage.card.breachBedroom` | both | the punctuation ".." in English, "().." in Polish | DB26 | T22 | E71 |
| `DRPG.Passage.card.breachHeard` | both | the punctuation "." in English, ":." in Polish | DB26 | T22 | E71 |
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
| `DRPG.Passage.mark.from` | both | the punctuation "" in English, ":" in Polish | DB26 | T22 | E71 |
| `DRPG.Passage.mark.from` | pl | "e przejście z: {room}" - X12, a Polish preposition before a colon and a placeholder | X12 (rebuilt) | T5 | E71 |
| `DRPG.Passage.mark.to` | both | the punctuation "" in English, ":" in Polish | DB26 | T22 | E71 |
| `DRPG.Passage.mark.to` | pl | "e przejście do: {room}" - X12, a Polish preposition before a colon and a placeholder | X12 (rebuilt) | T5 | E71 |
| `DRPG.Passage.pick.made` | pl | "w zakładce Przejścia." - "Przejścia" with no "tajn*" before it: a passage is "tajne przejście" | A10 | T28 | E66 |
| `DRPG.Passage.pick.new` | pl | "+ Nowe przejście" - "przejście" with no "tajn*" before it: a passage is "tajne przejście" | A10 | T28 | E66 |
| `DRPG.Passage.pick.tunnelHint` | en | "...of two rooms, on one floor or..." - a list with no comma before its last "and"/"or" | DB35 | T17 | E71 |
| `DRPG.Passage.pick.tunnelMade` | pl | "w zakładce Przejścia." - "Przejścia" with no "tajn*" before it: a passage is "tajne przejście" | A10 | T28 | E66 |
| `DRPG.Passage.pick.tunnelSecond` | en | "...inside another room, on this floor or..." - a list with no comma before its last "and"/"or" | DB35 | T17 | E71 |
| `DRPG.Passage.show.intro` | both | the punctuation "?." in English, "?:." in Polish | DB26 | T22 | E71 |
| `DRPG.Passage.show.intro` | pl | "cie? Jesteś w: {room}." - X12, a Polish preposition before a colon and a placeholder | X12 (rebuilt) | T5 | E71 |
| `DRPG.Passage.show.title` | en | "w the passage - {passage}" - X4, a dash that tacks an aside on | X4 (rebuilt) | T5 | E71 |
| `DRPG.Passage.show.title` | pl | "jne przejście - {passage}" - X4, a dash that tacks an aside on | X4 (rebuilt) | T5 | E71 |
| `DRPG.Passage.tab.footnote` | pl | "je znają, a przejście jest dla ni" - "przejście" with no "tajn*" before it: a passage is "tajne przejście" | A10 | T28 | E66 |
| `DRPG.Passage.tab.footnote` | pl | "uń zapomina przejście i to, kto j" - "przejście" with no "tajn*" before it: a passage is "tajne przejście" | A10 | T28 | E66 |
| `DRPG.Passage.tab.footnote` | pl | "y uczeń zna przejście i nikt nie" - "przejście" with no "tajn*" before it: a passage is "tajne przejście" | A10 | T28 | E66 |
| `DRPG.Passage.tab.grant` | pl | "uczniowi to przejście" - "przejście" with no "tajn*" before it: a passage is "tajne przejście" | A10 | T28 | E66 |
| `DRPG.Passage.tab.revokeAsk` | pl | "re łączy to przejście. Kiedy prze" - "przejście" with no "tajn*" before it: a passage is "tajne przejście" | A10 | T28 | E66 |
| `DRPG.Passage.tab.revokeAsk` | pl | "ście. Kiedy przejście ma się zamk" - "przejście" with no "tajn*" before it: a passage is "tajne przejście" | A10 | T28 | E66 |
| `DRPG.Passage.tab.revokePublicAsk` | pl | "ame} zna to przejście, tak jak ka" - "przejście" with no "tajn*" before it: a passage is "tajne przejście" | A10 | T28 | E66 |
| `DRPG.Passage.tab.revokePublicNote` | pl | "dy utajnisz przejście, będzie dla" - "przejście" with no "tajn*" before it: a passage is "tajne przejście" | A10 | T28 | E66 |
| `DRPG.Passage.tab.revokeTitle` | en | "Revoke - {passage}" - X4, a dash that tacks an aside on | X4 (rebuilt) | T5 | E71 |
| `DRPG.Passage.tab.revokeTitle` | pl | "Odbierz - {passage}" - X4, a dash that tacks an aside on | X4 (rebuilt) | T5 | E71 |
| `DRPG.Passage.tab.shared` | pl | "poznaje to przejście." - "przejście" with no "tajn*" before it: a passage is "tajne przejście" | A10 | T28 | E66 |
| `DRPG.Passage.tab.shared` | pl | "} i każdy z nich poznaje to" - X13, a singular they as a Polish plural | X13 (rebuilt) | T5 | E71 |
| `DRPG.Passage.tab.startHint` | pl | "nie daje mu przejścia teraz." - "przejścia" with no "tajn*" before it: a passage is "tajne przejście" | A10 | T28 | E66 |
| `DRPG.Passage.tab.stateBroken` | pl | "ęła - wskaż przejście jeszcze raz" - "przejście" with no "tajn*" before it: a passage is "tajne przejście" | A10 | T28 | E66 |
| `DRPG.Passage.tab.stateBroken` | en | "he wall moved - pick it again" - X4, a dash that tacks an aside on | X4 (rebuilt) | T5 | E71 |
| `DRPG.Passage.tab.stateBroken` | pl | "ię przesunęła - wskaż przejśc" - X4, a dash that tacks an aside on | X4 (rebuilt) | T5 | E71 |
| `DRPG.Passage.tab.wayHint` | pl | "kształtem. Przejście w ścianie z" - "Przejście" with no "tajn*" before it: a passage is "tajne przejście" | A10 | T28 | E66 |
| `DRPG.Passage.tab.wayOnly` | both | the punctuation "" in English, "::" in Polish | DB26 | T22 | E71 |
| `DRPG.Passage.tab.wayOnly` | pl | "Tylko z: {from}, do: {to}" - X12, a Polish preposition before a colon and a placeholder | X12 (rebuilt) | T5 | E71 |
| `DRPG.Passage.why.cannotClose` | pl | "przejścia nie udało s" - "przejścia" with no "tajn*" before it: a passage is "tajne przejście" | A10 | T28 | E66 |
| `DRPG.Passage.why.cannotClose` | pl | "w zakładce Przejścia." - "Przejścia" with no "tajn*" before it: a passage is "tajne przejście" | A10 | T28 | E66 |
| `DRPG.Passage.why.idTaken` | pl | "zajęło inne przejście. Odejmij pr" - "przejście" with no "tajn*" before it: a passage is "tajne przejście" | A10 | T28 | E66 |
| `DRPG.Passage.why.isBreach` | pl | "wyłom, nie przejście. Ścianę prz" - "przejście" with no "tajn*" before it: a passage is "tajne przejście" | A10 | T28 | E66 |
| `DRPG.Passage.why.isBreach` | en | "is a breach, not a passage. Close the br" - X3, the antithesis "X, not Y" | X3 (rebuilt) | T5 | E71 |
| `DRPG.Passage.why.isBreach` | pl | "to wyłom, nie przejście. Ścianę przyw" - X3, the antithesis "X, not Y" | X3 (rebuilt) | T5 | E71 |
| `DRPG.Passage.why.noBreach` | pl | "rojekt. Nie trzeba nic robić." - X11, a passive that hides who acts | X11 (rebuilt) | T5 | E71 |
| `DRPG.Passage.why.noSide` | pl | "prowadzi to przejście albo wyłom." - "przejście" with no "tajn*" before it: a passage is "tajne przejście" | A10 | T28 | E66 |
| `DRPG.Passage.why.notKnown` | pl | "ie zna tego przejścia albo jest o" - "przejścia" with no "tajn*" before it: a passage is "tajne przejście" | A10 | T28 | E66 |
| `DRPG.Passage.why.notKnown` | pl | "w zakładce Przejścia." - "Przejścia" with no "tajn*" before it: a passage is "tajne przejście" | A10 | T28 | E66 |
| `DRPG.Passage.why.taken` | pl | "dzi na inne przejście na tej ścia" - "przejście" with no "tajn*" before it: a passage is "tajne przejście" | A10 | T28 | E66 |

### DRPG.Frisk.* (A11)

53 key(s) in en.json; 19 finding(s) of the report on 17 key(s).

| key | lang | finding | rule | test | fix |
| --- | --- | --- | --- | --- | --- |
| `DRPG.Frisk.askedAlready` | both | the punctuation ".." in English, ":.." in Polish | DB26 | T22 | E71 |
| `DRPG.Frisk.caught` | both | the punctuation ".." in English, ":.." in Polish | DB26 | T22 | E71 |
| `DRPG.Frisk.caughtTrying` | both | the punctuation ".." in English, ":.." in Polish | DB26 | T22 | E71 |
| `DRPG.Frisk.forceSent` | both | the punctuation ".." in English, ":.." in Polish | DB26 | T22 | E71 |
| `DRPG.Frisk.gmFor` | both | the punctuation "." in English, ":." in Polish | DB26 | T22 | E71 |
| `DRPG.Frisk.gmIncident` | both | the punctuation ".:." in English, ":.:." in Polish | DB26 | T22 | E71 |
| `DRPG.Frisk.gmIncidentNow` | both | the punctuation ".:." in English, ":.:." in Polish | DB26 | T22 | E71 |
| `DRPG.Frisk.gmKept` | both | the punctuation ".:.." in English, ":.:.." in Polish | DB26 | T22 | E71 |
| `DRPG.Frisk.gmKeptNow` | both | the punctuation ".:.." in English, ":.:.." in Polish | DB26 | T22 | E71 |
| `DRPG.Frisk.sent` | both | the punctuation ".--." in English, ":.--." in Polish | DB26 | T22 | E71 |
| `DRPG.Frisk.sent` | en | "What you see - and whether t" - X4, a dash that tacks an aside on | X4 (rebuilt) | T5 | E71 |
| `DRPG.Frisk.sent` | pl | "Co zobaczysz - i czy poczuli" - X4, a dash that tacks an aside on | X4 (rebuilt) | T5 | E71 |
| `DRPG.Frisk.shown` | both | the punctuation ".." in English, ":.." in Polish | DB26 | T22 | E71 |
| `DRPG.Frisk.wForced` | both | the punctuation "." in English, ":." in Polish | DB26 | T22 | E71 |
| `DRPG.Frisk.wForcedFailed` | both | the punctuation "." in English, ":." in Polish | DB26 | T22 | E71 |
| `DRPG.Frisk.wLetGo` | both | the punctuation "." in English, ":." in Polish | DB26 | T22 | E71 |
| `DRPG.Frisk.wShown` | both | the punctuation "." in English, ":." in Polish | DB26 | T22 | E71 |
| `DRPG.Frisk.wWalkedAway` | both | the punctuation "." in English, ":." in Polish | DB26 | T22 | E71 |
| `DRPG.Frisk.waiting` | both | the punctuation ".." in English, ":.." in Polish | DB26 | T22 | E71 |

### DRPG.Steal.takeHint (A11)

1 key(s) in en.json; 2 finding(s) of the report on 1 key(s).

| key | lang | finding | rule | test | fix |
| --- | --- | --- | --- | --- | --- |
| `DRPG.Steal.takeHint` | en | "ver comes out - a critical le" - X4, a dash that tacks an aside on | X4 (rebuilt) | T5 | E71 |
| `DRPG.Steal.takeHint` | pl | "e, co wyjdzie - krytyk pozwal" - X4, a dash that tacks an aside on | X4 (rebuilt) | T5 | E71 |

### E70's mode texts (the keys E70 C7 2f1e8772 and C8 fc547885 added) (E70)

98 key(s) in en.json; 19 finding(s) of the report on 10 key(s).

| key | lang | finding | rule | test | fix |
| --- | --- | --- | --- | --- | --- |
| `DRPG.Floor.closing.alreadySpoke` | both | the punctuation "" in English, "()" in Polish | DB26 | T22 | E71 |
| `DRPG.Floor.closing.gmVolunteers` | pl | "Closing Argument - {seconds} s na zgłoszenia. Zgłosz" - 2 sentences and no finite verb in any (X6, telegraph style; T18, a candidate) | X6 (rebuilt) | T18 | E71 |
| `DRPG.Floor.closing.gmVolunteers` | en | "sing Argument - {seconds} s t" - X4, a dash that tacks an aside on | X4 (rebuilt) | T5 | E71 |
| `DRPG.Floor.closing.gmVolunteers` | pl | "sing Argument - {seconds} s n" - X4, a dash that tacks an aside on | X4 (rebuilt) | T5 | E71 |
| `DRPG.Floor.closing.holding` | pl | "ówi {who} - zostało {seconds} s." - a bare count in a sentence: its predicate belongs in a plural family (PL7; T25) | PL7 | T25 | E71 |
| `DRPG.Floor.closing.holding` | en | "{who} speaks - {seconds} s l" - X4, a dash that tacks an aside on | X4 (rebuilt) | T5 | E71 |
| `DRPG.Floor.closing.holding` | pl | "t: mówi {who} - zostało {seco" - X4, a dash that tacks an aside on | X4 (rebuilt) | T5 | E71 |
| `DRPG.Floor.closing.volunteered` | both | the punctuation "" in English, "()" in Polish | DB26 | T22 | E71 |
| `DRPG.Floor.closing.waitsForGm` | pl | "Closing Argument czeka na twój wybór, nie na zegar." - naturalness pair N35 (X3) is not applied yet (written 31.10 for the owner's pilot, not confirmed; docs/text-style.md section 12; T27) | N35 (X3) | T27 | E71 |
| `DRPG.Floor.closing.waitsForGm` | en | "your choice, not for a clock." - X3, the antithesis "X, not Y" | X3 (rebuilt) | T5 | E71 |
| `DRPG.Floor.closing.waitsForGm` | pl | "a twój wybór, nie na zegar." - X3, the antithesis "X, not Y" | X3 (rebuilt) | T5 | E71 |
| `DRPG.Floor.holdingRound` | en | "{who} speaks - {seconds} s." - X4, a dash that tacks an aside on | X4 (rebuilt) | T5 | E71 |
| `DRPG.Floor.holdingRound` | pl | "}: mówi {who} - {seconds} s." - X4, a dash that tacks an aside on | X4 (rebuilt) | T5 | E71 |
| `DRPG.Floor.holdingRoundLast` | en | "{who} speaks - {seconds} s," - X4, a dash that tacks an aside on | X4 (rebuilt) | T5 | E71 |
| `DRPG.Floor.holdingRoundLast` | pl | "}: mówi {who} - {seconds} s," - X4, a dash that tacks an aside on | X4 (rebuilt) | T5 | E71 |
| `DRPG.Floor.round.over` | both | the punctuation "." in English, ":." in Polish | DB26 | T22 | E71 |
| `DRPG.Trial.claim.counted` | both | the punctuation "." in English, "()." in Polish | DB26 | T22 | E71 |
| `DRPG.Trial.turn.title` | en | "Your turn - {seconds} s" - X4, a dash that tacks an aside on | X4 (rebuilt) | T5 | E71 |
| `DRPG.Trial.turn.title` | pl | "Twoja tura - {seconds} s" - X4, a dash that tacks an aside on | X4 (rebuilt) | T5 | E71 |

