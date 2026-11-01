# The text style guide

One source of style for every text the module shows - tiles, windows, cards, notifications, settings, diagnostics and
handbooks, in English and in Polish (E65 C5, 31.10.2026; S18-30). The words are in `docs/glossary.json` (every term with
the stage from which it holds), the lengths in `docs/text-budgets.json`; the text lint (`scripts/tests-text.mjs`, run by
`node tools/check.mjs text`) reads both. Section 7 and section 12 are in Polish, with Polish examples.

## How to read it

Every rule ends with exactly one status, in brackets:

- `[survives: <source>]` - the rule's content survives in a source, quoted or named. DB1-DB41 are the owner's answers:
  they bind, whole and as decided, and are cited by number, never marked rebuilt.
- `[rebuilt 30.10 from <source>, to confirm in E71 (row 1.2.128)]` - the rule's own wording is lost; it is rebuilt from what
  survives of it, and the source is named.
- `[rebuilt 30.10 from the number alone, to confirm in E71 (row 1.2.128)]` - only the rule's number survives; its content is a
  reconstruction.
- `confirmed in the pilot 01.11.2026` in place of the "to confirm": the owner's pilot confirmed the rebuilt rule.
- "number assigned 30.10" inside a status: the content survives in a summary, but which number it carried does not.

No rebuilt rule is the original (section 13). The pilot (prepared in E65 C14, read by the owner in C-pilot, DB23) is
where a rebuilt rule is confirmed or changed; a rule the pilot does not exercise stays "to confirm" after it, and E71
(row 1.2.128) confirms it: E71 turns T4, T5, T11, T12, T13, T15, T16, T21, T24 and T25 to FAIL (MODES in
`scripts/tests-text.mjs`), so it measures each rule against the texts it rewrites. Until the pilot the status read
"to confirm in the pilot"; the E65 fix round (01.11.2026) named E71 in each that the pilot left.

The pilot was read on 01.11.2026 (E65 C-pilot; the answers are `owner` in `docs/dev/text-pilot.json`): the owner
approved all 40 pairs, with no correction and no „nikt tak nie mówi”, and the default of each of the eight questions; on
a ninth, the Frisk row's Polish form, the owner took the C13 reviewer's „Zobacz, co ktoś nosi” (the glossary's
`see-what-they-carry`). A rebuilt rule the 40 pairs or those answers exercise now ends `confirmed in the pilot
01.11.2026` where it said `to confirm in the pilot`; no rule says "changed in the pilot", because no verdict was a
correction. A rule counts as exercised when an approved pair applies it - a detector of the lint finds the rule's shape
in the pair's before and not in its after, or the C14 reviewers or the one revision named the rule as applied on that
pair - no approved after breaks it, and no reviewer's note on the rule itself is still waiting for the owner. A rule the
pilot reached but did not confirm carries a "Pilot 01.11.2026:" line saying why. The 60 naturalness pairs (section 12)
were not on the pilot's page (E65-PILOT-R1); the owner read them the same day on a second page, E65-PILOT-R2, and
approved all 60 as written, with no note on any pair ("Wszystkie z 60 naturalnosci zatwierdzam jako domyslne"). Each
now ends `confirmed in the pilot 01.11.2026 (E65-PILOT-R2)`, and a rebuilt rule the 60 exercise by the same test - for
these pairs the rule column, which the page showed the owner, names a rule as applied - is confirmed with a "Pilot
01.11.2026 (E65-PILOT-R2):" line saying where: X1, X10, X13 and M8 (E65 fix round).

An example under a rule is a real key's text, read on this tree on 31.10.2026 - the key in backticks, English in “...”,
Polish in „...”, "..." where a text is cut - or a sentence a source quotes, named as such. "Found:" marks a text of the
module that shows a forbidden shape or a rule not yet applied: a reading, not a verdict on that key. The old texts are
aligned by E66 (numbers, names, dates) and E71 (style); the lint's report counts them.

## 1. Role and order of sources

When two sources disagree, the one higher in this list wins.

1. The code and `scripts/config.mjs`: what the module does (M1).
2. The D and DB decisions.
3. The Polish guide, as the authority of rules.
4. PH 0.2.2 and the module's English handbook, as the authority of sound - not of mechanics, spelling or labels.

[survives: the plan's goal, „rolę i hierarchię źródeł (kod i config.mjs, decyzje D i DB, polski przewodnik jako
autorytet reguł, PH 0.2.2 i angielski podręcznik modułu jako autorytet brzmienia, ale nie mechaniki, pisowni ani
etykiet)”]

5. This guide, then the glossary for words. [rebuilt 30.10 from the plan's goal (docs/text-style.md and
   docs/glossary.json as the stage's two sources of style and words), to confirm in E71 (row 1.2.128)]

- **Sources 1** Where a DB answer and a rebuilt rule disagree, the DB answer wins; where an answer overrode an earlier
  recommendation, the answer holds - DB34's „akcje uniwersalne” over the recommendation (b). [survives: DB34
  „Rekomendacja po krytyce polszczyzny była inna (b), ale decyzja ... jest wiążąca”]
- **Sources 2** A decision that names a stage: this guide states the rule, the glossary's entry the stage from which it
  holds (DB7's labels: the entries `crime-silence-badge` and `crime-witness`). [rebuilt 30.10 from the stage's plan (C5's
  edge cases), to confirm in E71 (row 1.2.128)]

## 2. O1-O18: how a text is built

- **O1** Result first: the first sentence says what happened or what to do. [rebuilt 30.10 from the plan's summary of
  O1-O18, „najpierw wynik”, number assigned 30.10, confirmed in the pilot 01.11.2026]
  Example: `DRPG.Vote.castConfirmed` “Your vote is in.” / „Twój głos oddany.”
- **O2** Fewer sentences, not shorter sentences: drop the sentence that repeats or explains, and keep the ones left
  whole (X6). [rebuilt 30.10 from the plan's summary, „mniej zdań zamiast krótszych zdań”, number assigned 30.10,
  confirmed in the pilot 01.11.2026]
- **O3** One fact in one place, by the surface matrix (section 3); the other surfaces point to it. [rebuilt 30.10 from
  the plan's summary, „jeden fakt w jednym miejscu według macierzy powierzchni”, number assigned 30.10, confirmed in the
  pilot 01.11.2026]
- **O4** Speak to the reader: what the text tells is what they see, hold and can do. [rebuilt 30.10 from DB36's
  recommendation, „zgodne z O4 (mów do odbiorcy)”, confirmed in the pilot 01.11.2026]
  Example: `DRPG.Diagnose.intro` “Everything the module can check here, as one text. Copy it and send it to whoever is
  helping you.”
- **O5** Numbers only from placeholders: a count, cost or threshold the code knows reaches the text as a placeholder,
  never as a digit typed into the prose (M5). [rebuilt 30.10 from the plan's summary, „liczby tylko z placeholderów”,
  number assigned 30.10, to confirm in E71 (row 1.2.128)]
  Example: `DRPG.Action.dcStash` “Finding a stash: {n}+.” / „Znalezienie skrytki: {n}+.”
  Pilot 01.11.2026: stays to confirm. Two approved Polish afters write a number the code knows into the prose -
  `DRPG.Settings.searchTokensPerRoom.hint` „od 0 do 10” (the setting's range) and `DRPG.Config.PHASES.dailyLife.hint`
  „pięć pór” and „jeden Free Move” - while the English afters of both keep none (M5).
- **O6** Facts first, then text: write down the key's facts - what happens, to whom, what it costs, the exceptions -
  before the sentence (DB26 for the Polish). [rebuilt 30.10 from the plan's summary, „najpierw fakty, potem tekst”,
  number assigned 30.10, confirmed in the pilot 01.11.2026]
  Pilot 01.11.2026: the 40 were written from 175 facts read off the code before any sentence.
- **O7** Say what the reader can do next, when there is something to do. [rebuilt 30.10 from S18-30, „co się stało i co
  mogę zrobić”, confirmed in the pilot 01.11.2026]
  Example: `DRPG.Vote.finalSentenceMissing` “A Final Trial verdict waits to be carried out, but this browser does not
  hold who was sentenced. Load the GMs' backup on this browser, or give the Final verdict again.”
- **O8** A refusal says what the reader keeps. [rebuilt 30.10 from E68's text, „według O8 z E65: «You keep your
  action.» / «Nie tracisz akcji.»”, to confirm in E71 (row 1.2.128)]
  Example (E68's text): “You keep your action.” / „Nie tracisz akcji.” - where the module has `DRPG.Bridge.nothingSpent`
  “Nothing was spent.” / „Nic nie wydano.” (X1).
  Pilot 01.11.2026: stays to confirm. Applied in `DRPG.Action.noRoom` and `DRPG.Config.HOPE_CALLS.relief.effect`; the EN
  reviewer's note that it reads wrong on a key that is also a dimmed tile's reason (`DRPG.SearchTokens.exhausted`) and
  on a refusal before any price (`DRPG.Actions.notEnough`) waits for the owner.
- **O9** No design rationale in a UI string: why it was built so belongs in code comments and the handbooks. [rebuilt
  30.10 from S18-30, „odpowiadają na pytanie „dlaczego tak zaprojektowano”, a nie „co się stało i co mogę zrobić””, and
  the plan's P1, to confirm in E71 (row 1.2.128)]
- **O10** No reassurance tail, unless it is about safety. [rebuilt 30.10 from the number alone (its subject from the
  plan's typical message: result, justification, exception, reassurance), confirmed in the pilot 01.11.2026]
- **O11** A button is a verb with its object. [rebuilt 30.10 from a stage text that quotes it, „mają czasownik z
  dopełnieniem według O11”, to confirm in E71 (row 1.2.128)]
  Example: `DRPG.Project.createButton` “Create project” / „Utwórz projekt”.
- **O12** A text written to this guide after E66 is checked by the lint and the glossary, and left as it is if it
  passes. [rebuilt 30.10 from E71's text, „tylko sprawdza lintem i słowniczkiem i zostawia, jeśli przechodzą (O12)”, to
  confirm in E71 (row 1.2.128)]
- **O13** An exception gets a sentence only where the reader can meet it. [rebuilt 30.10 from the number alone,
  confirmed in the pilot 01.11.2026]
- **O14** One name per mechanic, the glossary's; no synonym for variety (DB33, DB37). [rebuilt 30.10 from the number
  alone, confirmed in the pilot 01.11.2026]
- **O15** Present tense for what is true now, past for what just happened. [rebuilt 30.10 from the number alone,
  confirmed in the pilot 01.11.2026]
- **O16** A stage that is not a text stage edits a text minimally and writes the fact or style error it saw into the
  table for E71, instead of rewriting it. [rebuilt 30.10 from E66's and E25's texts, „do tabeli dla E71 (O16), zamiast
  redagować”, „edycją minimalną (O16)”, to confirm in E71 (row 1.2.128)]
- **O17** Each language for its own reader: the Polish is written from the facts, not from the English sentence by
  sentence (DB26). [rebuilt 30.10 from the number alone, confirmed in the pilot 01.11.2026]
  Pilot 01.11.2026: the Polish of the 40 was written from the facts and the old Polish with no English in its input, as
  section 12's step 2 has it.
- **O18** A rule that forbids a shape shows the sentence that replaces it; the pilot's approved pairs are the model.
  [rebuilt 30.10 from the number alone (its reason in the plan's risk, „Wytyczne, które tylko zakazują, dają nowy styl
  AI”), to confirm in E71 (row 1.2.128)]

## 3. Surfaces and the surface matrix

Where a text is shown decides who reads it, what it holds and what it never holds. Every row below: [rebuilt 30.10 from
the pilot's quotas (S18-32: tiles and config descriptions, toasts and player cards, settings hints, GM diagnostics,
the world voice, plural families) and S18-30 („macierzy powierzchni”), confirmed in the pilot 01.11.2026 for the seven
rows the 40 pairs stand on - tile hint, config description, toast, player chat card, settings name and hint (its hint),
GM diagnostics, world-voice announcement - and to confirm in E71 (row 1.2.128) for the other seven]

| Surface | Who reads it | What it holds | What it never holds | A key of it (31.10) |
| --- | --- | --- | --- | --- |
| tile label | the player acting, the GM | the action's name, the glossary's | a sentence, a number | `DRPG.Config.ACTIONS.sabotage.label` “Sabotage” |
| tile hint | the player acting | what the action does, what it costs and when (M3) | why it was designed so (O9) | `DRPG.Config.ACTIONS.sabotage.hint` |
| config description | whoever the table is shown to | the rule as the code runs it (M1, M2) | a rule the code does not run | `DRPG.Config.HOPE_CALLS.support.effect` “Give another player advantage on one roll. You have to be in the same room.” |
| button | whoever holds the window | a verb with its object (O11) | a question, a negation (X14) | `DRPG.Project.createButton` “Create project” |
| window title | whoever holds the window | the window's subject | a sentence | `DRPG.Murder.trackerTitle` “Incident tracker” |
| tab | whoever holds the window | a noun for what the tab holds | a sentence | `DRPG.Vault.tabDoors` “Doors” |
| tooltip | whoever points at the control | what the control does, or what its number means | what the window already says (O3) | `DRPG.Hud.sessionTooltip` “Session {session}” |
| settings name and hint | the GM (a world setting), each user (a client setting) | what it switches; in the hint, what changes and for whom (DB10) | the setting's history | `DRPG.Settings.debug.name` “Verbose console logging” |
| toast | the user on this browser whose action raised it | the result of what they just did (O1) | an explanation of a rule | `DRPG.Vote.castConfirmed` “Your vote is in.” |
| player chat card | the player it is about, and the GMs (`whisperToOwner`) | what happened to them and what they can do next (O7) | what they may not know (M9) | `DRPG.Observe.alreadyHeld` “You already hold a Truth Bullet of this trace.” |
| GM chat card | the GMs (`whisperToGms`) | what happened, and what the GM decides or does | a line to a player | `DRPG.Vote.finalSentenceMissing` |
| world-voice announcement | everyone at the table (a card with no whisper list) | what the table now knows, in the neutral voice, third person with the role (DB1, DB19) | a line of Monokuma (DB1), "you" to many (P2) | `DRPG.Vote.tied` “A tie. Unless the table settles it, that counts as a wrong vote.” |
| GM diagnostics | a GM, or whoever helps one | what is wrong, where, and what to do | a reassurance (O10) | `DRPG.Diagnose.intro` |
| handbook | a player or a GM reading the book | the rules whole, the why, the examples; technical details and version history in an appendix of the same book (M10) | a rule the code does not run (M2) | - |

## 4. Budgets

- **B1** Each surface has a target, which the report holds a text to, and a limit about 1.5 times the target, which
  fails a player's or a settings text; the GM's diagnostics are only reported; an exception is an allow row with its
  reason. [survives: DB11 „cel (raport) i limit twardy ok. 1,5 razy cel (FAIL) dla tekstów gracza i ustawień;
  diagnostyka GM-a tylko raport; allowlista z powodem”]
- **B2** The numbers, in words per string (the limit is the target times 1.5, rounded up). [rebuilt 30.10 from DB11 and
  the stage's plan (Appendix A, section 4), to confirm in E71 (row 1.2.128)]
  Pilot 01.11.2026: stays to confirm. The owner's verdicts named no number, so docs/text-budgets.json is unchanged; read
  by the pilot's surface, 22 approved texts (a language and a form) in 12 keys are over the target - tile hints up to 43
  words, config descriptions up to 41, settings hints up to 37 - and none is over the limit.

  | Surface | Target | Limit |
  | --- | --- | --- |
  | tile label | 3 | 5 |
  | button | 4 | 6 |
  | window title, tab | 5 | 8 |
  | tooltip | 15 | 23 |
  | toast | 20 | 30 |
  | settings hint | 25 | 38 |
  | tile hint, config description | 30 | 45 |
  | world-voice announcement | 30 | 45 |
  | player and GM chat card | 40 | 60 |
  | GM diagnostics | 60 | none: report only |

- **B3** A key's surface is found by its name or by the function that posts it, the first rule that names it winning:
  `DRPG.Config.ACTIONS.*.label` a tile label and `.hint` its hint, the other `DRPG.Config.*` hints, descriptions and
  effects config descriptions, `DRPG.Settings.*.hint` a settings hint, a name ending in `Tooltip`, `Button`, `.tab...`,
  `.title` or `...Title`, the diagnostics' key groups; a toast by `ui.notifications`, a player card by `whisperToOwner`
  and the room's or the incident's audience, a GM card by `whisperToGms`, the world voice by `announce` with no whisper
  list. A key no rule names is "unclassified" in the report. The rules are `rules` in `docs/text-budgets.json`. [rebuilt
  30.10 from the stage's plan (Appendix A, section 4), to confirm in E71 (row 1.2.128)]
  Measured 31.10 by the key rules alone: 623 of 4953 keys (en.json 4438, config.mjs's prose 515) are named, 4330 are
  not; a rule by sender needs the call that posts the key.
- **B4** A handbook has no word target: its word goals are only a guide, and nothing is cut to meet them. [survives:
  DB2 „cele słów są tylko orientacyjne”, „ucięta zawartość - NIE”]

Not budgeted: settings names (the plan gives them no target, so their keys stay unclassified; the owner's answer in the
pilot of 01.11.2026 keeps it so: no target).

## 5. X1-X21: forbidden shapes

An exception is an allow row in `docs/text-budgets.json` (`key`, `rule`, `why`, `until`), never a silent one. T5 (E65
C6) reports these shapes; E71 turns X5, X9, X15, X16 and X18 to FAIL (S18-47). Those five are the numbers E71's plan
calls „wzorce jednoznaczne” (unambiguous); their content was rebuilt to fit that word.

- **X1** Reassurance by denying a loss - say what the reader keeps instead (O8). [rebuilt 30.10 from E68's conflict
  note, „«Nothing was spent.» przeczy wytycznym X1 i O8”, confirmed in the pilot 01.11.2026]
  Found: `DRPG.Bridge.nothingSpent` “Nothing was spent.” / „Nic nie wydano.”
  Pilot 01.11.2026 (E65-PILOT-R2): applied in N28, N29 and N30 (`DRPG.Action.dynamicRefused`,
  `DRPG.TraitRuling.refused`, `DRPG.Overflow.hopeBlocked`): T5 finds X1's shape in the three befores and in none of the
  100 approved afters (the pilot's 40 in both languages, the 60 pairs).
- **X2** A design rationale in the string (O9). [rebuilt 30.10 from the number alone (its subject from the plan's P1),
  to confirm in E71 (row 1.2.128)]
- **X3** The antithesis "X, not Y" as a sentence shape. [rebuilt 30.10 from E71's why (the shape counted in its
  strings), to confirm in E71 (row 1.2.128)]
  Found: `DRPG.Hud.trialTooltip` “The Class Trial. The debate runs from the GM's console, not here.” / „Class Trial.
  Debatę prowadzi GM ze swojej konsoli, nie stąd.”
- **X4** A dash that tacks a moral or an aside on to a sentence. [rebuilt 30.10 from E71's why (the shape counted in EN
  and PL), to confirm in E71 (row 1.2.128)]
  Found: `DRPG.Monocub.dialogIntro` “... Tick to opt them in - the timing is your judgement, not the module's.” /
  „... Zaznacz, by go włączyć - moment wybierasz ty, nie moduł.”
  Pilot 01.11.2026: stays to confirm. The rewrite took the dash out of 8 English and 7 Polish befores, and two approved
  Polish afters keep one - `DRPG.Config.ACTIONS.tamper.hint` „a gdy nie masz już akcji - Sanity” and
  `DRPG.Chapter.bodyCalled` „Investigation jeszcze nie trwa - rozpocznie je GM”.
- **X5** A bracketed plural "(s)": a count is a plural family (`plural()`). [rebuilt 30.10 from the number alone (one
  of E71's five unambiguous numbers), to confirm in E71 (row 1.2.128)]
  Found: `DRPG.Advance.offered` “... you have {n} pick(s).”
- **X6** Telegraph style: articles and verbs dropped. [rebuilt 30.10 from the plan's risk, „telegrafia”, to confirm in
  E71 (row 1.2.128)]
  Pilot 01.11.2026: stays to confirm. The EN reviewer's note that a settings hint opening with a verb and no subject
  (“Takes effect at once.”, EN14's own sentence) is the settings convention, not telegraph style, waits for the owner.
- **X7** A chain of label-colon-value inside a sentence. [rebuilt 30.10 from the plan's risk, „łańcuchy dwukropków”, to
  confirm in E71 (row 1.2.128)]
  Found: `DRPG.Action.dcAnalyze` “Identifying a bullet, by how visible its trace was - of the crime: {rows}; faint:
  {faint}; Key and Final: {key}.”
- **X8** "please" or "sorry" in system text. [rebuilt 30.10 from the number alone, to confirm in E71 (row 1.2.128)]
  Found: `DRPG.Reroll.rulingVoid` “... Please rule again.” / „... Zdecyduj ponownie.”
- **X9** A doubled space, or a space before punctuation. [rebuilt 30.10 from the number alone (one of E71's five
  unambiguous numbers), to confirm in E71 (row 1.2.128)]
- **X10** Hedges and fillers: "just", "simply", "actually", „po prostu”, „właściwie”. [rebuilt 30.10 from the number
  alone, confirmed in the pilot 01.11.2026]
  Found: `DRPG.Murder.escapeIntro` “... The incident simply ends.” / „... Incydent po prostu się kończy.”
  Pilot 01.11.2026 (E65-PILOT-R2): applied in N25 and N27 (`DRPG.Config.ACTIONS.palm.description`,
  `DRPG.Murder.freeResolution`): T5 finds „po prostu” in both befores and in none of the 100 approved afters.
- **X11** A passive that hides the reader as the one who acts. [rebuilt 30.10 from the number alone, to confirm in E71
  (row 1.2.128)]
  Pilot 01.11.2026: stays to confirm. The EN reviewer's note that a passive which does not hide the reader
  (`DRPG.Config.ACTIONS.observe.hint`'s draft “is copied into your inventory”) should not be read by the rule waits for
  the owner.
- **X12** „w: {room}”, and a label-colon-placeholder inside a Polish sentence. [rebuilt 30.10 from E71's why („w:
  {room}” in its Polish texts), confirmed in the pilot 01.11.2026]
  Found: `DRPG.Listen.prompt` “You are in {room}. Which neighbouring room?” / „Jesteś w: {room}. Który sąsiedni pokój?”
  Pilot 01.11.2026: the owner kept the shape „w pokoju {room}” (question X12-room, the default), and the approved afters
  of `DRPG.Vault.keyShared`, `DRPG.Move.entered`, `DRPG.Calls.gatherBody`, `DRPG.Vault.unlockedAnnounce` and
  `DRPG.Eclipse.moved` use it.
- **X13** A singular "they" given as a Polish plural. [rebuilt 30.10 from E71's why, confirmed in the pilot 01.11.2026]
  Pilot 01.11.2026 (E65-PILOT-R2): applied in N24, N25 and N26 (`DRPG.Chapter.revived`,
  `DRPG.Config.ACTIONS.palm.description`, `DRPG.Vote.verdictIntroKnown`), as their rule column says and the owner read
  it; T5's X13 matcher finds the shape in none of the three befores and none of the 100 approved afters, so the
  confirmation rests on the pairs the owner approved, not on the matcher.
- **X14** A negated question, or a double negation, on a button. [rebuilt 30.10 from the number alone, to confirm in
  E71 (row 1.2.128)]
- **X15** An exclamation mark in system text and in the world voice. [rebuilt 30.10 from the number alone (one of
  E71's five unambiguous numbers), to confirm in E71 (row 1.2.128)]
  Found: `DRPG.Floor.debateOpenedTitle` “Nonstop Debate!”
- **X16** ALL-CAPS emphasis (acronyms such as GM, NPC and HUD, and names, aside). [rebuilt 30.10 from the number alone
  (one of E71's five unambiguous numbers), to confirm in E71 (row 1.2.128)]
- **X17** Stacked qualifiers: "only ... unless ... except". [rebuilt 30.10 from the number alone, to confirm in E71
  (row 1.2.128)]
- **X18** "successfully" / „pomyślnie”. [rebuilt 30.10 from the number alone (one of E71's five unambiguous numbers),
  to confirm in E71 (row 1.2.128)]
- **X19** A hint that restates its label. [rebuilt 30.10 from the number alone, to confirm in E71 (row 1.2.128)]
- **X20** A "Note:", "Tip:" or „Uwaga:” lead-in in UI text. [rebuilt 30.10 from the number alone, to confirm in E71
  (row 1.2.128)]
- **X21** A rhetorical question in system text. [rebuilt 30.10 from the number alone, to confirm in E71 (row 1.2.128)]

## 6. English

- **EN1** American spelling everywhere: analyze, analyzed, color, capitalize. [survives: DB9 „amerykańska”; D33e]
- **EN2** The Oxford comma, also in the lists the code builds. [survives: DB35 „przecinek oksfordzki w EN, także w
  listach z kodu (helper I9 z jawnym „en-US”)”]
  Example: `DRPG.Chapter.keepSecretUntilFound` “... no flag, no marker, and their Truth Bullets stay until then”.
- **EN3** Contractions by default in short messages; the full form for emphasis, a prohibition, safety and a rule.
  [survives: DB8 „domyślnie w krótkich komunikatach, pełna forma przy nacisku, zakazie, bezpieczeństwie i regule”]
  Example: `DAGGERHEART.UI.Notifications.notEnoughStress` “You don't have enough Sanity”.
- **EN4** Monokuma is "they"; the plural is "Monokumas". [survives: DB5 „„they” wszędzie, w liczbie mnogiej
  „Monokumas””]
  Example: `DRPG.Monokuma.panelNote` “A Monokuma has no actions and no Hope: their sheet shows Despair Calls instead.”
- **EN5** The announcements speak in the world's neutral voice, with no lines of Monokuma. [survives: DB1 „neutralny
  głos świata w ok. 40-60 ogłoszeniach, bez kwestii postaci”]
- **EN6** Title Case for every name. [survives: DB16 „Title Case dla wszystkich nazw (Leave a Clue, Pin Them Down, Role
  Reversal)”]
  Found: `DRPG.Config.CRISIS_ACTIONS.leaveClue.label` “Leave a clue”.
- **EN7** "Search Token" is capitalized. [survives: DB17 „„Search Token” wielką”]
  Found: `DRPG.Action.tokensLeft.other` “{room}: {n} search tokens left this time of day.”
- **EN8** Outcomes: "with Hope", "with Despair", "on a hit", "on a miss", "on a critical". [survives: DB18]
  Example: `DRPG.Action.duality.hope` “with Hope” / „z Hope”.
- **EN9** "Hold ready" stays as it is. [survives: DB20 „„Hold ready” bez zmian”]
- **EN10** "rescue actions". [survives: DB21]
- **EN11** "universal actions", as in PH. [survives: DB22 „„universal actions” jak w PH”]
- **EN12** "student" for the character in the fiction and its effects, "player" for the person at the table.
  [survives: DB24]
  Example: `DRPG.Settings.despairFromRolls.hint` “A roll that lands with Despair feeds the pool of that student's
  Monokuma.” / „Rzut zakończony Despair zasila pulę Monokumy tego ucznia.”
- **EN13** A mechanic's name is capitalized - the Overflow, as the stage's plan reads it; which names DB25's question
  listed is not in the sources read (the glossary's `mechanic-capitals` entry is open). [survives: DB25 „wielką literą
  jako nazwa mechaniki”]
- **EN14** A client setting's hint ends “Only affects this browser.” [survives: DB10]
  Found: `DRPG.Settings.debug.hint` “... This client only.” / „... Tylko ten klient.”
- **EN15** "Remnant" is the thing in every sentence, window title and column; "Trace" stands only as the fixed part of
  five names - Secure a Trace, Erase a Trace, Reshape a Trace, Hide the Traces, Follow My Traces - a closed list.
  [survives: DB15, DB33 as DB37 confirmed it]
  Found: `DRPG.Config.ACTIONS.sabotage.hint` “... Always leaves a trace.”; `DRPG.Config.CRISIS_ACTIONS.secureTrace.label`
  “Secure a trace”.
- **EN16** "NPC". [survives: DB32]
- **EN17** An item's name in quotes: “{item}”. [survives: DB31]
  Example: `DRPG.Items.singleUseSpent` ““{item}” is used up. ...”
- **EN18** A Remnant's labels in English: “Evident Remnant”, with several qualities “Incident Remnant (Evident,
  Reinforced)”. [survives: DB6 „Angielskie etykiety”]

## 7. Polski

Ta część jest po polsku, z polskimi przykładami. Statusy w nawiasach zostają po angielsku, jak w całym przewodniku, żeby
dało się je policzyć.

- **PL-a** Odmieniane są tylko rzeczowniki policzalne: Truth Bulletu, Remnantu, tokenu, Search Tokenu (-u jak
  bilet/biletu), Call/Calla, Level Upy; Class Trial nieodmienne z przyimkiem („w/podczas Class Trial”); z nazw Calli
  odmieniane tylko Reroll (Rerolla) i Burst (Burstem); zasoby nijakie i nieodmienne (tabeli zasobów, 2.11, nie ma w
  zachowanych źródłach); Hope i Despair są męskie (PL-b, D191). [survives: DB4]
  Przykład: `DRPG.Trial.notInTrial` „Dowody przedstawia się w Class Trial.”; znalezione: `DRPG.Action.dcAnalyze`
  „Identyfikacja Truth Bulleta, ...”.
- **PL-b** Rodzaj: zasoby, Overflow, Eclipse, fazy i stany nijakie; Class Trial, Free Move, Rebuttal, Truth Bullet,
  Remnant, Search Token męskie; Nonstop Debate żeńska; Objection nijakie, jak dziś w UI. Hope i Despair są męskie i
  nieodmienne („twój Hope”, „cały Despair”): nijaki rodzaj zasobów z DB28 ich nie obejmuje. [survives: DB28; Hope and
  Despair are masculine and indeclinable (the owner, 31.10.2026, D191)]
- **PL-c** Tryby rozprawy mają rodzaj polskiego odpowiednika: Testimony n (zeznanie), Panic Round ż (runda), Closing
  Argument m (argument), Straw Poll ż (sonda), Logic Dive m, Scrum Debate ż (debata); Findings nieodmienne, w zdaniu
  „lista Findings”. [survives: DB39]
- **PL17** Gdy forma z rodzajem brzmi sztucznie, tekst mówi „tryb X” albo używa czasu teraźniejszego. [survives: PL17,
  przez DB39 „Gdy forma z rodzajem brzmi sztucznie, tekst może użyć „tryb X” (PL17) albo czasu teraźniejszego”]
- **PL-d** „arkusz postaci” (krótko „arkusz”) dla sheet; „karta” tylko dla karty czatu. [survives: DB27]
  Przykład: `DRPG.Advance.who.playerHint` „Gracz dostaje powiadomienie, na arkuszu postaci zapala się przycisk i to
  gracz wybiera.”
- **PL-e** Nazwy Calli na plakietkach po angielsku: „Silence”, „Chained”. [survives: DB29]
  Przykład: `DRPG.Overflow.silenced` „Silence. Nikt nie wydaje Hope Calls o tej porze dnia.”
- **PL-f** safeword jest nieodmienne i nijakie, jak „słowo”: „Ktoś użył safeword”, „zmień je”. [survives: DB30]
  Przykład: `DRPG.Safeword.announced` „Ktoś użył safeword.”; znalezione: `DRPG.Events.safewordSub` „Ktoś użył
  safeworda.”
- **PL-g** Nazwa przedmiotu zawsze w cudzysłowie: „{item}”. [survives: DB31]
  Przykład: `DRPG.Items.singleUseSpent` „„{item}” się zużył. ...”
- **PL-h** W hincie kafla po poleceniu dalej druga osoba. [survives: DB36 „„Zepsuj projekt w tym pokoju. Zawsze
  zostawiasz Remnant.””]
  Znalezione: `DRPG.Config.ACTIONS.sabotage.hint` „Zepsuj projekt w tym pokoju, by wymagał projektu naprawy. Zawsze
  zostawia ślad.” (także PL-r).
- **PL4** Monokuma jest w polskim zawsze gramatycznie męski. [survives: PL4 „W PL Monokuma jest zawsze gramatycznie
  męski”]
  Przykład: `DRPG.Calls.armedByMonokuma` „Monokuma nałożył na twój następny rzut {what}.”
- **PL7** W rodzinie liczebnikowej orzeczenie należy do rodziny: każda forma ma swoje. [survives: PL7 „rodziny ... z
  orzeczeniem w rodzinie” („zostały 2 akcje”)]
  Przykład: `DRPG.Motive.left` „została 1 pora dnia” / „zostały {n} pory dnia” / „zostało {n} pór dnia”.
- **PL23** Podmiot i zaimek: podmiotem hintu jest czytelnik, a zaimek odnosi się do ostatniej nazwanej osoby. [rebuilt
  30.10 from the number alone (PL23 named only, „podmiot i zaimek”), confirmed in the pilot 01.11.2026]
  Pilot 01.11.2026: applied in `DRPG.Vault.keyShared` and `DRPG.Diagnostics.cast.poolFix`; the owner's choice of
  „Zobacz, co ktoś nosi” for the Frisk row rests on it (the glossary's `see-what-they-carry`, stage E71).
- **PL-i** „GM-a”, „GM-owie”, „GM-ów”, z łącznikiem. [survives: D33c]
  Przykład: `DRPG.Project.proposeButton` „Wyślij do GM-a”.
- **PL-j** Zwykłe polskie słowa dla zwykłych rzeczy: skrytka, sejf. [survives: D33b]
  Przykład: `DRPG.Action.dcStash` „Znalezienie skrytki: {n}+.”
- **PL-k** Nazwy akcji i Calli po angielsku, także wszystkie kafle Monocuba i nowe Calle (Move, Confusion, Redeem, Ask
  for Hope, Ghost Bet, Bribe, Bounty); polskie objaśnienia stoją tylko w podręczniku, a zdania wokół nazwy są po polsku.
  [survives: D33a, DB3, DB38]
  Przykład (zdanie z DB38): „Redeem: +1 Hope, raz dziennie”.
- **PL-l** „akcje uniwersalne”; nie „akcje podstawowe”, „akcje standardowe” ani „zwykłe akcje”. [survives: DB34]
- **PL-m** „akcje ratunkowe”. [survives: DB21]
- **PL-n** „NPC” także po polsku. [survives: DB32]
- **PL-o** Hint ustawienia klienta kończy się zdaniem „Dotyczy tylko tej przeglądarki.” [survives: DB10]
  Znalezione: `DRPG.Settings.debug.hint` „... Tylko ten klient.”
- **PL-p** Świadek zbrodni: plakietka „Milczenie o zbrodni”, tooltip i komunikat „Jesteś świadkiem: …”, kolumna GM-a
  „Świadek zbrodni”, osobno od Silence; od którego etapu - mówi hasło słowniczka. [survives: DB7]
- **PL-q** Wyniki: „z Hope”, „z Despair” (także „Z Hope: … Z Despair: …” i skrót „Przy Despair”), „przy trafieniu”,
  „przy pudle”, „przy krytyku”. [survives: DB18]
  Przykład: `DRPG.Action.duality.hope` „z Hope”.
- **PL-r** Remnant także w polskim zdaniu; słowa „ślad” nie używamy, a etykieta jest jak w EN: „Evident Remnant”,
  „Incident Remnant (Evident, Reinforced)”. [survives: DB15, DB6]
- **PL-s** „uczeń” dla postaci w fikcji i w efektach, „gracz” dla osoby przy stole. [survives: DB24]
  Przykład: `DRPG.Settings.despairFromRolls.hint` „Rzut zakończony Despair zasila pulę Monokumy tego ucznia.”

## 8. M1-M10: mechanics in text

- **M1** The function that executes a rule is the source of a text about it, not only config.mjs. [survives: „funkcja,
  która wykonuje regułę, nie tylko config”]
- **M2** A text never states a rule the code does not run; a disagreement goes to the stage's table, and the code wins.
  [rebuilt 30.10 from E71's verify column, „niezgodności z kodem albo decyzją”, confirmed in the pilot 01.11.2026]
- **M3** A cost is said where it is paid: when, what and how much. [rebuilt 30.10 from the number alone (named in the
  owner's note of 30.10), confirmed in the pilot 01.11.2026]
- **M4** Conditions and exceptions stay whole when a text is shortened. [rebuilt 30.10 from the hand-off's „fakty
  zachowane” column, confirmed in the pilot 01.11.2026]
- **M5** No digit is added to prose; a number comes from a placeholder (O5). [rebuilt 30.10 from E66's text, „nie
  dopisuje cyfr do prozy (M5)”, to confirm in E71 (row 1.2.128)]
  Pilot 01.11.2026: stays to confirm, as O5.
- **M6** Outcome words only as DB18 has them (EN8, PL-q). [rebuilt 30.10 from the number alone, confirmed in the pilot
  01.11.2026]
- **M7** A resource is said as its reserve - „zostało N”, a full bar is a full reserve - never as "clear" or "mark".
  [rebuilt 30.10 from Work Out's conflict, „czyścisz Sanity” against „D5 i regule M7”, D5 „wszędzie zapas («zostało N»,
  pełny pasek = pełny zapas)”, confirmed in the pilot 01.11.2026]
  Found: `DRPG.Action.goalStressHint` “Small comforts. Clears Sanity.” / „Drobne pocieszenia. Oczyszcza Sanity.”
- **M8** Who decides: the player proposes, the GM approves or changes it - “Approve: {stat}”, “Change to: {stat}”,
  “Refuse” / „Zatwierdź: {stat}”, „Zmień na: {stat}”, „Odmów”. [rebuilt 30.10 from the number alone (the buttons are
  DA18's, as the plan entry names them), confirmed in the pilot 01.11.2026]
  Pilot 01.11.2026 (E65-PILOT-R2): applied in N29 (`DRPG.TraitRuling.refused`, „GM odmawia tej akcji”), as its rule
  column says and the owner read it; M8 has no detector.
- **M9** A text never names what its reader may not know; who reads a key is the audience map's (P3). [rebuilt 30.10
  from the number alone, confirmed in the pilot 01.11.2026]
- **M10** Shortening a handbook: join sentences, keep one place for a fact with a pointer to it, a list or a table
  instead of prose, split paragraphs that are too long, move technical details and version history to an appendix at
  the end of the same handbook - and cut no content. [survives: E57's text, „łączenie zdań, jedno miejsce faktu z
  odsyłaczem, lista albo tabela zamiast prozy, podział za długich akapitów, szczegóły techniczne i historia wersji do
  dodatku na końcu tego samego podręcznika”; DB2 „ucięta zawartość - NIE”]

## 9. N1-N8: what a text edit never changes

- **N1** Keys stay when the wording or a name changes. [survives: E66's text, „klucze bez zmian (N1)”]
- **N2** Placeholder names, and what each means, stay. [rebuilt 30.10 from the number alone, confirmed in the pilot
  01.11.2026]
  Pilot 01.11.2026: the 40 approved pairs keep every placeholder of their befores, 80 of 80 (key, language).
- **N3** Config ids, flag keys and setting keys stay - the `listen` key stays when its tile is relabelled (DA27).
  [rebuilt 30.10 from the number alone, to confirm in E71 (row 1.2.128)]
- **N4** The console's names, and diagnostics.mjs's console in English (DB12), stay. [rebuilt 30.10 from the number
  alone, to confirm in E71 (row 1.2.128)]
- **N5** The key-labels `ITEM_CATEGORIES.*.plural` and `.label`, `USABLE_KINDS.*.label` and `USABLE_GOALS.*.label`
  change only with the old wording added to `LEGACY_PLURALS` or `LEGACY_GOAL_LABELS` (scripts/tables.mjs), and those
  lists are only appended to (DB13; T14). [survives: the plan, „etykiety-klucze ITEM_CATEGORIES.*.plural i .label,
  USABLE_KINDS.*.label i USABLE_GOALS.*.label zmienia się tylko z dopisaniem starej wersji do LEGACY_PLURALS albo
  LEGACY_GOAL_LABELS, a te listy wolno tylko uzupełniać”]
  What T14 holds: the live words against the words of 419d3b42 (`TABLE_WORDS_AT_BASE` in scripts/tests-text.mjs,
  frozen) and the legacy lists against their contents there. A word a stage adds to a legacy list after that commit is
  held by N5's "only appended to" and by review, not by T14.
- **N6** The handbook section numbers the UI links to stay (D35). [rebuilt 30.10 from the number alone, to confirm in
  E71 (row 1.2.128)]
- **N7** The names of documents the module finds by name stay. [rebuilt 30.10 from the number alone, to confirm in E71
  (row 1.2.128)]
- **N8** A posted record - a chat card in the log - is not rewritten. [rebuilt 30.10 from the number alone, to confirm
  in E71 (row 1.2.128)]

## 10. Three voices and the perspective

- **V1** The interface speaks to the one acting: second person, what they see and can do (O4). [rebuilt 30.10 from
  DB1, DB12 and the pilot's quotas, to confirm in E71 (row 1.2.128)]
- **V2** The world speaks in a neutral voice, in the third person, with no lines of Monokuma. [survives: DB1]
- **V3** The GM's diagnostics speak to a GM: what is wrong, where, what to do; the console of diagnostics.mjs stays in
  English. [rebuilt 30.10 from DB11 and DB12 („konsola diagnostics.mjs zostaje po angielsku”), to confirm in E71
  (row 1.2.128)]
- **P1** When more than one person reads a text, the third person with the role, or a name. [survives: DB19 „trzecia
  osoba z rolą („The victim…”, „Ofiara…”)”]
- **P2** The second person only to the one acting, never to many readers at once (T16). [rebuilt 30.10 from DB19 and
  DB36, confirmed in the pilot 01.11.2026]
  Found: `DRPG.Vote.opened` “{n} ballots are out. Name who you believe is the Blackened.” / „Rozesłano {n} kart.
  Wskażcie, kto waszym zdaniem jest Blackened.” - a card to the whole table.
- **P3** Who reads a key is read off the code that sends it (the audience map, I11): `whisperToOwner`,
  `roomAudience`, `incidentAudienceIds`, `announce`, `whisperToGms`, `ui.notifications`. [rebuilt 30.10 from S18-34, to
  confirm in E71 (row 1.2.128)]

## 11. The hand-off format of a batch

A batch of texts is handed over as a table with these columns: screen; key; surface; audience (from I11); the facts
kept; EN before and after; PL before and after; what was removed and where it went; what needs code; disagreements
with code or a decision. [survives: E71's verify, its columns]

## 12. Test naturalności PL

Metoda w ośmiu krokach. [rebuilt 30.10 from the number alone („metoda w ośmiu krokach”; the steps from DB26, DB23 and
the plan's reviewer roles), to confirm in E71 (row 1.2.128)]

1. Fakty klucza: co się dzieje, komu, ile kosztuje, z jakimi wyjątkami (O6).
2. Polski z faktów, kodu i starego PL, bez wglądu w nowy EN; EN dopiero przy kontroli parytetu (DB26).
3. Render z fixture'ami: imiona żeńskie i męskie, pokoje i przedmioty trzech rodzajów, n = 0, 1, 2, 5, 12, 22, 25, 112
   (narzędzie renderu, E65 C10).
4. Czytanie na głos: czy gracz przy stole powiedziałby to tak?
5. Gramatyka na renderze: rodzaj i przypadek (PL-a, PL-b, PL-c).
6. Szyk i kalki: X12, X13 i lustro T22 (DB26 „z metryką lustra T22”).
7. Słowniczek: `docs/glossary.json`.
8. Lektura właściciela: każde „nikt tak nie mówi” staje się parą w tabeli poniżej (DB23).

Para 48 wypadła po DB34: „akcje uniwersalne” zostają (PL-l). [survives: DB34 „para 48 z 2.16 i kandydat w T27
wypadają”]

### Pary N1-N60

Sześćdziesiąt par napisanych od nowa 31.10.2026 (E65 C9) do lektury właściciela; tabela z 2.16 przepadła, więc
numeracja N1-N60 jest nowa i nie powtarza starej. Żadna para nie dotyczy DB34: „akcje uniwersalne” to reguła (PL-l), nie
para. „Przed” to dosłowny fragment wartości klucza w `lang/pl.json` (całość albo jej zdanie, z wielkością liter), „Po” to
ten sam fragment napisany od nowa z faktów klucza i z kodu, który go wysyła, bez wglądu w EN (DB26, krok 2); placeholdery
zostają te same (N2). „Reguła” mówi, co para pokazuje. Status zostaje po angielsku: para jest potwierdzona dopiero po
lekturze właściciela (E65-24), nigdy przez agenta. Na stronie pilota z 01.11.2026 (E65-PILOT-R1) tych par nie było;
tego samego dnia właściciel przeczytał je na drugiej stronie, E65-PILOT-R2, i zatwierdził wszystkie 60 tak, jak są
napisane, bez uwagi do żadnej („Wszystkie z 60 naturalnosci zatwierdzam jako domyslne”; Q-E65-3). Każda ma więc status
„confirmed in the pilot 01.11.2026 (E65-PILOT-R2)”; do tej lektury brzmiał „written 31.10 for the owner's pilot, not
confirmed”, z prawdziwą datą napisania. Kształt X12 „w pokoju {room}”, którego używają N1-N8, N10,
N15-N20 i N23, właściciel zatwierdził osobnym pytaniem pilota.

T27 (`naturalnessBefore` w `scripts/tests-text.mjs`, raport) czyta tę tabelę - jest jedynym źródłem par - i zgłasza każde
„Przed”, które wciąż stoi w swoim kluczu, z innymi kluczami o tych samych słowach. „Przed”, którego już nie ma, bo późniejszy
etap zmienił tekst, T27 wypisuje osobno, a para zostaje w tabeli jako wzór. Wiersz poza kształtem tabeli (numer nie po
kolei, klucz bez backticków, cytat bez „...”, status spoza trzech) psuje część `text`.

| N | Klucz | Przed | Po | Reguła | Status |
| --- | --- | --- | --- | --- | --- |
| N1 | `DRPG.Listen.prompt` | „Jesteś w: {room}. Który sąsiedni pokój?” | „Jesteś w pokoju {room}. Który sąsiedni pokój chcesz podsłuchać?” | X12, O4 | confirmed in the pilot 01.11.2026 (E65-PILOT-R2) |
| N2 | `DRPG.Listen.anonymous.few` | „{n} osoby w: {room}. Nie da się poznać kto.” | „W pokoju {room} są {n} osoby, ale nie poznajesz, kto to.” | X12, PL7 | confirmed in the pilot 01.11.2026 (E65-PILOT-R2) |
| N3 | `DRPG.Action.sabotageSeen` | „Widać, jak {actor} grzebie przy projekcie w: {room}.” | „W pokoju {room} widać, jak {actor} grzebie przy projekcie.” | X12 | confirmed in the pilot 01.11.2026 (E65-PILOT-R2) |
| N4 | `DRPG.Vault.keyGranted` | „Masz klucz do: {room}.” | „Masz klucz do pokoju {room}.” | X12 | confirmed in the pilot 01.11.2026 (E65-PILOT-R2) |
| N5 | `DRPG.Vault.keyMissing` | „Drzwi do: {room} są zamknięte. Nie masz tego klucza.” | „Pokój {room} jest zamknięty, a ty nie masz do niego klucza.” | X12, O2 | confirmed in the pilot 01.11.2026 (E65-PILOT-R2) |
| N6 | `DRPG.Vault.notHere` | „Twoja skrytka jest w: {room} - stań tam, żeby do niej sięgnąć.” | „Twoja skrytka jest w pokoju {room}. Przejdź tam, żeby do niej sięgnąć.” | X12, X4, O7 | confirmed in the pilot 01.11.2026 (E65-PILOT-R2) |
| N7 | `DRPG.Chapter.bodyFound` | „Znaleziono ciało w: {room}.” | „W pokoju {room} znaleziono ciało.” | X12, V2 | confirmed in the pilot 01.11.2026 (E65-PILOT-R2) |
| N8 | `DRPG.Chapter.bodyFoundNamed` | „{name} znaleziony martwy w: {room}.” | „{name} nie żyje. Ciało leży w pokoju {room}.” | X12, PL17 (czas teraźniejszy zamiast „znaleziony” przy imieniu kobiety) | confirmed in the pilot 01.11.2026 (E65-PILOT-R2) |
| N9 | `DRPG.Handover.gave` | „{name} należy teraz do: {who}.” | „{who} ma teraz przedmiot „{name}”.” | X12, PL-g | confirmed in the pilot 01.11.2026 (E65-PILOT-R2) |
| N10 | `DRPG.Handover.nobodyHere` | „Nie ma nikogo innego w: {room}, komu dałoby się cokolwiek przekazać.” | „W pokoju {room} nie ma nikogo poza tobą, więc nie masz komu niczego przekazać.” | X12, O4 | confirmed in the pilot 01.11.2026 (E65-PILOT-R2) |
| N11 | `DRPG.Analyze.stashFound` | „Jest tu skrytka i należy do: {who}.” | „Znajdujesz tu skrytkę postaci {who}.” | X12, O1 | confirmed in the pilot 01.11.2026 (E65-PILOT-R2) |
| N12 | `DRPG.Murder.openingDeclined` | „Brak rzutu otwarcia od: {name}.” | „{name} odmawia rzutu otwarcia.” | X12, X6 | confirmed in the pilot 01.11.2026 (E65-PILOT-R2) |
| N13 | `DRPG.Items.took` | „{item} zabrany od: {actor}.” | „Zabierasz przedmiot „{item}” postaci {actor}.” | X12, X6, PL-g | confirmed in the pilot 01.11.2026 (E65-PILOT-R2) |
| N14 | `DRPG.Monocub.meddledOn` | „Confusion użyte na: {name}.” | „Używasz Confusion na postaci {name}.” | X12, X6, O4 | confirmed in the pilot 01.11.2026 (E65-PILOT-R2) |
| N15 | `DRPG.Passage.list.oneWay` | „Tylko w jedną stronę, z: {from}, do: {to}.” | „Tylko w jedną stronę: z pokoju {from} do pokoju {to}.” | X12, X7 | confirmed in the pilot 01.11.2026 (E65-PILOT-R2) |
| N16 | `DRPG.Cleanup.bodyMoved` | „Ciało przeniesiono do: {room}.” | „Ciało leży teraz w pokoju {room}.” | X12, O1 | confirmed in the pilot 01.11.2026 (E65-PILOT-R2) |
| N17 | `DRPG.Cleanup.moveIntro` | „Ciało jest w: {room}. Wybierz, dokąd je wleczesz. Kosztuje {n} Sanity.” | „Ciało leży w pokoju {room}. Wybierz, dokąd je zawleczesz; wydasz na to {n} Sanity.” | X12, M3, M7 | confirmed in the pilot 01.11.2026 (E65-PILOT-R2) |
| N18 | `DRPG.Action.murderCancelled` | „Direct Murder ({killer}) spełzł na niczym w: {room} - {reason}” | „Direct Murder ({killer}) w pokoju {room} nie dochodzi do skutku: {reason}” | X12, X4 | confirmed in the pilot 01.11.2026 (E65-PILOT-R2) |
| N19 | `DRPG.Analyze.stashFoundGm` | „{finder} - rzut {total}, znaleziona ukryta skrytka ({who}) w: {room}.” | „{finder} znajduje ukrytą skrytkę postaci {who} w pokoju {room} (rzut {total}).” | X12, X6, T22 | confirmed in the pilot 01.11.2026 (E65-PILOT-R2) |
| N20 | `DRPG.Remnant.sabotageNote` | „{actor} - sabotaż projektu {project} w: {room} (rzut {total}).” | „{actor} sabotuje projekt {project} w pokoju {room} (rzut {total}).” | X12, X6 | confirmed in the pilot 01.11.2026 (E65-PILOT-R2) |
| N21 | `DRPG.Cleanup.gmLine` | „{actor} - rzut {total} przeciw DC {dc} przy: {what} - {verdict}.” | „{actor} rzuca {total} przeciw DC {dc} ({what}): {verdict}.” | X12, X4, X7 | confirmed in the pilot 01.11.2026 (E65-PILOT-R2) |
| N22 | `DRPG.Murder.crowded` | „{name} wchodzi zaraz po: {third}. Cztery osoby w jednym pokoju to nie morderstwo, które ktokolwiek może przeprowadzić - incydent odwołany.” | „{name} wchodzi zaraz po postaci {third}. W pokoju są teraz cztery osoby, więc incydent zostaje odwołany.” | X12, X4, X6 | confirmed in the pilot 01.11.2026 (E65-PILOT-R2) |
| N23 | `DRPG.Vault.full` | „{room}: skrytka pełna. Mieści {limit} rzeczy - wyjmij coś, zanim coś włożysz.” | „Skrytka w pokoju {room} jest pełna: mieści {limit} rzeczy. Wyjmij coś, zanim włożysz nową.” | X12, X4, X6 | confirmed in the pilot 01.11.2026 (E65-PILOT-R2) |
| N24 | `DRPG.Chapter.revived` | „Truth Bullets, które z nimi zginęły, nie wracają.” | „Truth Bullets, które przepadły razem z tą postacią, nie wracają.” | X13 | confirmed in the pilot 01.11.2026 (E65-PILOT-R2) |
| N25 | `DRPG.Config.ACTIONS.palm.description` | „Albo po prostu prosisz, żeby pokazali kieszenie.” | „Możesz też poprosić tę osobę, żeby pokazała kieszenie.” | X13, X10 | confirmed in the pilot 01.11.2026 (E65-PILOT-R2) |
| N26 | `DRPG.Vote.verdictIntroKnown` | „Tylko ty wiesz, czy trafili.” | „Tylko ty wiesz, czy stół trafił.” | X13 | confirmed in the pilot 01.11.2026 (E65-PILOT-R2) |
| N27 | `DRPG.Murder.freeResolution` | „Weź w tej turze Survive albo Role reversal - bez rzutu, po prostu działa.” | „W tej turze weź Survive albo Role reversal: działa bez rzutu.” | X4, X10 | confirmed in the pilot 01.11.2026 (E65-PILOT-R2) |
| N28 | `DRPG.Action.dynamicRefused` | „GM odrzucił Dynamic action. Nic nie zostało wydane.” | „GM odrzuca twoją Dynamic action. Nie tracisz akcji.” | X1, O8, O15 | confirmed in the pilot 01.11.2026 (E65-PILOT-R2) |
| N29 | `DRPG.TraitRuling.refused` | „GM nie dopuścił tej akcji. Nic nie zostało wydane.” | „GM odmawia tej akcji, więc jej nie tracisz.” | X1, O8, M8 | confirmed in the pilot 01.11.2026 (E65-PILOT-R2) |
| N30 | `DRPG.Overflow.hopeBlocked` | „Zaciemnienie blokuje Hope w tej porze dnia - nic nie zostało wydane.” | „Zaciemnienie blokuje Hope Calls o tej porze dnia. Hope zostaje przy tobie.” | X1, O8, X4 | confirmed in the pilot 01.11.2026 (E65-PILOT-R2) |
| N31 | `DRPG.Hud.trialTooltip` | „Class Trial. Debatę prowadzi GM ze swojej konsoli, nie stąd.” | „Class Trial. Debatą kieruje GM ze swojej konsoli.” | X3 | confirmed in the pilot 01.11.2026 (E65-PILOT-R2) |
| N32 | `DRPG.RollDialog.advantageLocked` | „Przewaga i utrudnienie biorą się z Calli, nie stąd.” | „Przewagę i utrudnienie dają Calle; w tym oknie ich nie ustawisz.” | X3, O4 | confirmed in the pilot 01.11.2026 (E65-PILOT-R2) |
| N33 | `DRPG.RollDialog.modeLocked` | „To, kto widzi ten rzut, ustala gra, nie to okno.” | „Kto zobaczy ten rzut, ustala gra; w tym oknie tego nie zmienisz.” | X3, O4 | confirmed in the pilot 01.11.2026 (E65-PILOT-R2) |
| N34 | `DRPG.Vault.noBullets` | „Truth Bullets to to, co wiesz, nie rzeczy w skrytce.” | „Truth Bullets to twoja wiedza, więc nie trafiają do skrytki.” | X3 | confirmed in the pilot 01.11.2026 (E65-PILOT-R2) |
| N35 | `DRPG.Floor.closing.waitsForGm` | „Closing Argument czeka na twój wybór, nie na zegar.” | „Closing Argument nie ruszy, dopóki nie wybierzesz.” | X3 | confirmed in the pilot 01.11.2026 (E65-PILOT-R2) |
| N36 | `DRPG.Calls.needNote` | „Najpierw napisz, co zamierzasz z tym zrobić - GM ma orzec o tym, nie o Callu.” | „Najpierw napisz, co chcesz z tym zrobić: GM ocenia twój zamiar.” | X3, X4 | confirmed in the pilot 01.11.2026 (E65-PILOT-R2) |
| N37 | `DRPG.Sound.effectsIntro` | „puste pole gra ciszą, co jest wyborem, nie usterką.” | „puste pole oznacza ciszę.” | X3, O9 | confirmed in the pilot 01.11.2026 (E65-PILOT-R2) |
| N38 | `DRPG.Monocub.dialogIntro` | „Zaznacz, by go włączyć - moment wybierasz ty, nie moduł.” | „Zaznacz gracza, kiedy uznasz, że czas go włączyć.” | X4, X3 | confirmed in the pilot 01.11.2026 (E65-PILOT-R2) |
| N39 | `DRPG.Action.substitute` | „Nie to, czego szukasz - to, co miał ten pokój.” | „Tego, czego szukasz, tu nie ma. Znajdujesz coś innego, co było w tym pokoju.” | X4, X6 | confirmed in the pilot 01.11.2026 (E65-PILOT-R2) |
| N40 | `DRPG.Action.goalToolHint` | „Narzędzie. Daje przewagę przy pracy nad projektem - i nie zostawia śladu, chyba że to, co się znajdzie, jest też bronią.” | „Narzędzie daje przewagę przy pracy nad projektem. Nie zostawia Remnantu, chyba że znaleziona rzecz jest też bronią.” | X4, X6, PL-r | confirmed in the pilot 01.11.2026 (E65-PILOT-R2) |
| N41 | `DRPG.Action.murderSpendsAnyway` | „Potwierdzenie wydaje akcję niezależnie od tego, czy się uda - a czy się udało, dowiesz się dopiero, gdy Eclipse się skończy.” | „Potwierdzając, wydajesz akcję bez względu na wynik. Czy się udało, dowiesz się dopiero po zakończeniu Eclipse.” | X4, M3 | confirmed in the pilot 01.11.2026 (E65-PILOT-R2) |
| N42 | `DRPG.Items.noneReadied` | „Nic nie jest w ręku - w incydencie i przy sprzątaniu liczy się tylko to, co trzymasz.” | „Nie trzymasz niczego w ręku, a w incydencie i przy sprzątaniu liczy się tylko to, co trzymasz.” | X4, O4 | confirmed in the pilot 01.11.2026 (E65-PILOT-R2) |
| N43 | `DRPG.Items.wouldRestoreNothing` | „Nic nie przywróci - masz już pełne wszystko, co daje.” | „Ten przedmiot nic ci teraz nie da: wszystko, co przywraca, masz już pełne.” | X4, M7 | confirmed in the pilot 01.11.2026 (E65-PILOT-R2) |
| N44 | `DRPG.Cleanup.reshapeNeedsBoth` | „Napisz i nazwę, i opis - puste kłamstwo to nie kłamstwo. Okno otwiera się znowu z tym, co już wpisano.” | „Wpisz i nazwę, i opis. Okno otworzy się znowu z tym, co już jest wpisane.” | X4, O9 | confirmed in the pilot 01.11.2026 (E65-PILOT-R2) |
| N45 | `DRPG.Vote.dismissed` | „Karta zamknięta bez głosu. Nic ci nie policzono - poproś GM-a, by wysłał ją ponownie.” | „Zamykasz kartę bez głosu, więc twój głos się nie liczy. Jeśli chcesz zagłosować, poproś GM-a, żeby wysłał kartę jeszcze raz.” | X4, X6, O7 | confirmed in the pilot 01.11.2026 (E65-PILOT-R2) |
| N46 | `DRPG.Analyze.askHintHint` | „Brak dowodów w ręku - poproś GM-a, by cię gdzieś skierował.” | „Nie masz w ręku żadnego dowodu. Poproś GM-a o wskazówkę, gdzie szukać.” | X4, X6 | confirmed in the pilot 01.11.2026 (E65-PILOT-R2) |
| N47 | `DRPG.Observe.critPrompt` | „Krytyk - kategoria rozpoznana od razu, i należy się solidna podpowiedź.” | „Krytyk: obserwator od razu rozpoznaje kategorię. Daj solidną podpowiedź.” | X4, X11, O4 | confirmed in the pilot 01.11.2026 (E65-PILOT-R2) |
| N48 | `DRPG.Action.goalStressHint` | „Drobne pocieszenia. Oczyszcza Sanity.” | „Drobne pocieszenia przywracają Sanity.” | X6, M7 | confirmed in the pilot 01.11.2026 (E65-PILOT-R2) |
| N49 | `DRPG.Cleanup.bareHands` | „Nic w ręku. Gołe ręce.” | „Nie trzymasz narzędzia, więc sprzątasz gołymi rękami, bez przewagi.” | X6, O4 | confirmed in the pilot 01.11.2026 (E65-PILOT-R2) |
| N50 | `DRPG.Season.resetDone` | „Sezon zresetowany. Obsada i mapy nietknięte.” | „Sezon zaczyna się od nowa. Obsada i mapy zostają bez zmian.” | X6, O1 | confirmed in the pilot 01.11.2026 (E65-PILOT-R2) |
| N51 | `DRPG.Calls.motiveSet.few` | „Motive ogłoszony. {n} pory dnia na zegarze.” | „Motive jest ogłoszony. Na zegarze zostały {n} pory dnia.” | X6, PL7 | confirmed in the pilot 01.11.2026 (E65-PILOT-R2) |
| N52 | `DRPG.Overflow.rulesChanged` | „Overflow przestrojony. Odpala teraz przy {n}.” | „Overflow ma nowe ustawienia: odpala teraz przy {n}.” | X6, PL-b (Overflow nijakie; „przestrojony” jest męskie) | confirmed in the pilot 01.11.2026 (E65-PILOT-R2) |
| N53 | `DRPG.Calls.hopeSpent` | „Wydano {cost} Hope · zostało {left}.” | „Wydajesz {cost} Hope; zostaje ci {left} Hope.” | T25, X11 | confirmed in the pilot 01.11.2026 (E65-PILOT-R2) |
| N54 | `DRPG.Trial.objectionPickCount` | „Na wybór zostało {seconds} s. Gdy czas minie, Objection zostanie wycofane, a to, co zapłaciłeś, nie wróci.” | „Na wybór masz {seconds} s. Po tym czasie Objection przepada, a jego koszt nie wraca.” | T25, X11, PL-b (bez „zapłaciłeś”) | confirmed in the pilot 01.11.2026 (E65-PILOT-R2) |
| N55 | `DRPG.Eclipse.trialFirst` | „Trwa Class Trial, więc Eclipse nie został rozpoczęty” | „Trwa Class Trial, więc Eclipse nie może się zacząć” | PL-b (Eclipse nijakie), X11 | confirmed in the pilot 01.11.2026 (E65-PILOT-R2) |
| N56 | `DRPG.Actions.allSpent` | „Brak akcji. Wracają, gdy zacznie się następny Eclipse.” | „Nie masz już akcji. Wrócą na początku kolejnego Eclipse.” | X6, PL-b, PL17 (forma bez rodzaju) | confirmed in the pilot 01.11.2026 (E65-PILOT-R2) |
| N57 | `DRPG.Action.murderNotParked` | „To zgłoszenie już nie czeka - Eclipse się skończył albo już je rozstrzygnięto.” | „To zgłoszenie już nie czeka: Eclipse się skończyło albo zgłoszenie jest już rozstrzygnięte.” | PL-b, X4, X11 | confirmed in the pilot 01.11.2026 (E65-PILOT-R2) |
| N58 | `DRPG.Items.woreOnDespair` | „„{item}” przyjął na siebie najgorsze - zostało {left} z {total}, zanim się zepsuje.” | „„{item}” traci wytrzymałość przez Despair: ma jeszcze {left} z {total} punktów, potem się zepsuje.” | X4, T25, PL17 („przyjął” przy przedmiocie rodzaju żeńskiego) | confirmed in the pilot 01.11.2026 (E65-PILOT-R2) |
| N59 | `DRPG.Look.note` | „Wszystko w tym oknie należy do tej przeglądarki. Nikt inny nie widzi ani nie słyszy różnicy.” | „Wszystko w tym oknie dotyczy tylko tej przeglądarki. Inni przy stole niczego nie zauważą.” | PL-o (DB10), kalka „należy do” | confirmed in the pilot 01.11.2026 (E65-PILOT-R2) |
| N60 | `DRPG.Rolls.notDrawnHere` | „Ta wiadomość pojawia się raz dla tej wersji.” | „Ten komunikat zobaczysz raz na każdą wersję systemu.” | kalka „raz dla tej wersji”, O4 | confirmed in the pilot 01.11.2026 (E65-PILOT-R2) |

### Wzorzec pozytywny: 40 par z pilota

Czterdzieści tekstów pilota (E65 C14) w brzmieniu, które właściciel zatwierdził 01.11.2026, każdy jako „ok” i bez uwag
(`docs/dev/text-pilot.json`, pole `owner`; tam też fakty, teksty sprzed zmiany i otwarte punkty recenzentów). To wzór,
który pokazuje, czym zastąpić kształt zakazany (O18): EN i PL po zmianie, z kluczem, powierzchnią i etapem, który zmieni
klucz w `lang/` albo w config.mjs. W E65 nie zmienia się żaden klucz. Etap wyznacza reguła z
`docs/dev/text-review-E65.md`: E66, gdy zmiana dotyczy nazwy (O14 albo hasło słowniczka - tu tylko
`DRPG.Failures.cleared`, „debug log” zamiast „Failure log”, hasło `debug-log`), w każdym innym przypadku E71; partię w
E71 ustala E71. Przy rodzinie liczebnikowej stoją wszystkie jej formy, po kolei. Cztery teksty odchodzą od reguły, która
dlatego zostaje do potwierdzenia: nr 9 i 24 od O5 i M5, nr 6 i 31 od X4; mówi o tym linia „Pilot 01.11.2026” przy
regule.

| # | Klucz | Powierzchnia | EN | PL | Etap |
| --- | --- | --- | --- | --- | --- |
| 1 | `DRPG.Config.ACTIONS.search.hint` | tile-hint | “Search this room for something you pick, or for one specific thing you name. It costs an action, and the roll uses up one of the room's Search Tokens.” | „Przeszukaj pokój pod kątem czegoś, co wybierzesz albo nazwiesz. Wydajesz akcję, a po rzucie Eye zabierasz jeden z Search Tokenów pokoju.” | E71 |
| 2 | `DRPG.Config.ACTIONS.observe.hint` | tile-hint | “Look for evidence in this room. It costs an action. On a hit, you note one Remnant here as a Truth Bullet in your inventory, and the Remnant stays where it is; on a miss, you lose Sanity.” | „Szukaj dowodów. Wydajesz akcję; przy trafieniu kopiujesz Remnant do ekwipunku jako Truth Bullet, przy pudle tracisz Sanity.” | E71 |
| 3 | `DRPG.Config.ACTIONS.rest.hint` | tile-hint | “Recover Health, Sanity, or Hope. A Short Rest costs an action, once each time of day; a Long Rest costs more actions and recovers more, once each session. Each needs a room the GM has marked for it.” | „Odzyskaj Health, Sanity albo Hope w pokoju, w którym GM pozwala odpoczywać. Short Rest kosztuje akcję, raz na porę dnia; Long Rest kosztuje więcej akcji, raz na sesję, i daje więcej.” | E71 |
| 4 | `DRPG.Config.ACTIONS.move.hint` | tile-hint | “Moving inside a room is free. Each time of day, your first crossing into another room uses your Free Move; each crossing after that costs an action, or one of the extra crossings you bought with Sprint.” | „W obrębie pokoju ruszasz się za darmo. Pierwsze przejście do innego pokoju o danej porze dnia zużywa twój Free Move, a za każde kolejne płacisz przejściem kupionym wcześniej Callem Sprint albo akcją.” | E71 |
| 5 | `DRPG.Config.ACTIONS.sabotage.hint` | tile-hint | “Break a project in this room so that it needs a repair project. It costs an action, and you always leave a Remnant behind.” | „Zepsuj projekt w tym pokoju, żeby wymagał projektu naprawy. Wydajesz akcję i zawsze zostawiasz Remnant.” | E71 |
| 6 | `DRPG.Config.ACTIONS.tamper.hint` | tile-hint | “Erase a Remnant you have found here, unless it is Reinforced; on a critical, you can reshape it instead. You can also plant a false Remnant that points at somebody else. It costs an action, or Sanity once you have no action left.” | „Wymaż Remnant, o którym wiesz, że tu jest (nie Reinforced); przy krytyku możesz go zamiast tego przekształcić. Możesz też podłożyć fałszywy Remnant, który wskazuje na kogoś innego. Płacisz akcją, a gdy nie masz już akcji - Sanity.” | E71 |
| 7 | `DRPG.Config.ACTIONS.directMurder.hint` | tile-hint | “During an Eclipse, declare a Direct Murder that you have agreed with the GM beforehand. It costs an action.” | „Otwórz Direct Murder. Działa tylko podczas Eclipse: wydajesz akcję i zgłaszasz zabójstwo uzgodnione wcześniej z GM-em.” | E71 |
| 8 | `DRPG.Config.ACTIONS.rest.description` | config-description | “Choose from Sleep (Health), a Meal (Sanity), and a Breath (Hope). A Long Rest lets you pick more of them, restores Health or Sanity in full, and grants more Hope; a Short Rest restores half as much and grants less Hope.” | „Do wyboru masz sen (Health), posiłek (Sanity) i oddech (Hope). Przy Long Rest wybierasz więcej opcji, odzyskujesz całe Health albo całe Sanity i dostajesz więcej Hope; przy Short Rest odzyskujesz połowę i dostajesz mniej Hope.” | E71 |
| 9 | `DRPG.Config.PHASES.dailyLife.hint` | config-description | “You live inside a closed area. At the start of each time of day, your actions refill and your Free Move comes back.” | „Żyjecie w zamkniętym miejscu. Dzień dzieli się na pięć pór: poranek, południe, popołudnie, wieczór i noc. Z każdą nową porą dnia akcje się odnawiają, a każdy uczeń ma jeden Free Move.” | E71 |
| 10 | `DRPG.Config.HOPE_CALLS.relief.effect` | config-description | “Take a Short Rest right now, in any room, without spending an action. Your usual Short Rest this time of day stays available. Back out of choosing what to restore, and the Hope you paid comes back.” | „Weź od razu Short Rest z tymi samymi korzyściami co zwykły; nie kosztuje akcji i nie wymaga specjalnego pokoju. Twój Short Rest z tej pory dnia zostaje nietknięty. Jeśli zamkniesz okno wyboru, Call się anuluje, a Hope do ciebie wraca.” | E71 |
| 11 | `DRPG.SearchTokens.exhausted` | toast | “This room has no Search Tokens left. Try again in the next time of day.” | „W tym pokoju nie ma już Search Tokenów. Pojawią się znowu o następnej porze dnia.” | E71 |
| 12 | `DRPG.Action.noRoom` | toast | “Your character's token isn't in any room. Move it into one and try again; you keep your action.” | „Twój token stoi poza wszystkimi pokojami. Przesuń go do pokoju i spróbuj jeszcze raz; akcji nie tracisz.” | E71 |
| 13 | `DRPG.Room.imageMissing` | toast | “This room's picture couldn't be loaded.” | „Nie udało się wczytać zdjęcia tego pokoju.” | E71 |
| 14 | `DRPG.Observe.failed` | player-card | “Nothing catches your eye.” | „Nic nie przykuwa twojej uwagi.” | E71 |
| 15 | `DRPG.Observe.sent` | player-card | “The GM is judging your Observe and will send you the result.” | „GM oceni twoją akcję Observe i wyśle ci wynik.” | E71 |
| 16 | `DRPG.Vault.keyShared` | player-card | “{who} gave you a copy of the key to {room}.” | „{who} daje ci kopię klucza do pokoju {room}. Kopia jest już na twoim arkuszu.” | E71 |
| 17 | `DRPG.Steal.cardTook` | player-card | “You lift “{item}” out of {who}'s pocket.” | „Wyciągasz przedmiot „{item}” z kieszeni postaci {who}.” | E71 |
| 18 | `DRPG.Calls.armedForYou` | player-card | “Another student spent Hope on you: your next roll gets {what}. It is already switched on in your roll window.” | „Inny uczeń wydaje na ciebie Hope: twój następny rzut ma {what}. Okno rzutu ma to już włączone.” | E71 |
| 19 | `DRPG.Move.entered` | player-card | “You are now in {room}.” | „Jesteś teraz w pokoju {room}.” | E71 |
| 20 | `DRPG.Passage.card.passageBuilt` | player-card | “Your Secret Passage project is finished. The passage joins {from} and {to}.” | „Twoje tajne przejście jest gotowe. Łączy dwa pokoje: {from} i {to}.” | E71 |
| 21 | `DRPG.Settings.reducedMotion.hint` | settings-hint | “Reduces animation and motion in the module's interface. If your operating system asks for reduced motion, the module follows it even with this setting off. Takes effect at once. Only affects this browser.” | „Ogranicza ruch w interfejsie modułu. Jeśli system operacyjny prosi o mniej ruchu, moduł stosuje się do tego także przy wyłączonym ustawieniu. Zmiana działa od razu, bez przeładowania. Dotyczy tylko tej przeglądarki.” | E71 |
| 22 | `DRPG.Settings.bulletSort.hint` | settings-hint | “Sorts your Truth Bullets by chapter, the default, or by room. The switch is in your inventory, beside them. Only affects this browser.” | „Układa Truth Bullets w twoim ekwipunku według rozdziałów (domyślnie) albo według pokoi. Przełącznik jest w ekwipunku, przy dowodach. Dotyczy tylko tej przeglądarki.” | E71 |
| 23 | `DRPG.Settings.language.hint` | settings-hint | “Sets the language of this module's character sheet, panel, windows, and cards; Foundry keeps its own language setting. Names such as Truth Bullet, Remnant, and Despair stay in English. Needs a reload. Only affects this browser.” | „Język okien, kart, panelu i arkusza postaci tego modułu; języka Foundry to nie zmienia. Nazwy własne gry, takie jak Truth Bullet, Remnant i Despair, zostają po angielsku. Zmiana zadziała po przeładowaniu. Dotyczy tylko tej przeglądarki.” | E71 |
| 24 | `DRPG.Settings.searchTokensPerRoom.hint` | settings-hint | “How many Search Tokens each room has per time of day. Every Search that reaches the roll uses one; a room with none left cannot be searched.” | „Ile Search Tokenów ma każdy pokój, od 0 do 10. Każdy Search zabiera jeden token po rzucie, a w pokoju bez tokenów Search zostaje odrzucony, zanim gracz wyda akcję. Tokeny odnawiają się z każdą nową porą dnia.” | E71 |
| 25 | `DRPG.Settings.chargeMovement.hint` | settings-hint | “Moving inside a room is free. Each time of day, the first crossing between rooms uses the Free Move; later ones cost an action or a crossing bought with Sprint. Turn it off to handle movement yourself.” | „Ruch w obrębie pokoju jest darmowy. Pierwsze przejście do innego pokoju o danej porze dnia zużywa Free Move, każde kolejne kosztuje przejście kupione Callem Sprint albo akcję. Wyłącz, by rozliczać ruch ręcznie.” | E71 |
| 26 | `DRPG.Failures.cleared` | gm-diagnostics | “The debug log on this browser is now empty.” | „Debug log w tej przeglądarce jest teraz pusty.” | E66 |
| 27 | `DRPG.Diagnose.gmOnly` | gm-diagnostics | “This part of the report can only run in a GM's browser. Open the report in a GM's browser to see it.” | „Tę część raportu sprawdza tylko przeglądarka GM-a. Zbierz raport w przeglądarce GM-a, żeby ją zobaczyć.” | E71 |
| 28 | `DRPG.Diagnostics.cast.pendingWhy` | gm-diagnostics | “Until they are given their starting resources, these students have a maximum Health and Sanity of zero, so they look the same as a student beaten unconscious.” | „Do tego czasu ich maksymalne Health i Sanity wynoszą zero, więc wyglądają tak samo jak uczniowie pobici do nieprzytomności.” | E71 |
| 29 | `DRPG.Diagnostics.cast.poolFix` | gm-diagnostics | “Assign each of them a Monokuma by hand, or deliberately assign them none, in the GM panel under Despair Flow. Until then, Despair from their rolls goes to the pool named beside them; where none is named, it goes nowhere.” | „Przypisz każdemu z tych uczniów Monokumę ręcznie albo zaznacz, że celowo nie ma żadnego. Zrobisz to w panelu GM-a, w zakładce Despair Flow. Do tego czasu Despair z rzutów ucznia trafia do puli zapasowej, jeśli jej nazwa stoi przy nim; uczeń bez puli zapasowej nie ma żadnej puli, więc jego Despair nie ma dokąd trafić.” | E71 |
| 30 | `DRPG.GmStore.notOpen` | gm-diagnostics | “The GM store (the answer keys) still has not opened in this browser after {seconds} seconds. Until it opens, Analyze and handovers are unavailable, and players are told that the GM is aware of the problem.” | „Magazyn GM-a (klucze odpowiedzi) nie otworzył się w tej przeglądarce w ciągu {seconds} s. Dopóki się nie otworzy, Analyze i przekazania są odrzucane, a gracz dowiaduje się, że GM został powiadomiony.” | E71 |
| 31 | `DRPG.Chapter.bodyCalled` | world-voice | “Everyone is gathered in the room with the body. The GM will start the Investigation.” | „Wszystkie tokeny stoją teraz w pokoju z ciałem. Investigation jeszcze nie trwa - rozpocznie je GM.” | E71 |
| 32 | `DRPG.Calls.gatherBody` | world-voice | “At the start of the next time of day, everyone will be gathered in {room}.” | „Na początku następnej pory dnia wszyscy zbierają się w pokoju {room}.” | E71 |
| 33 | `DRPG.Vault.unlockedAnnounce` | world-voice | “The door to {room} is unlocked.” | „Drzwi do pokoju {room} są otwarte.” | E71 |
| 34 | `DRPG.Overflow.cardLeft` | world-voice | “The Overflow keeps its unspent Despair.” | „Despair, którego Overflow nie wydało, zostaje.” | E71 |
| 35 | `DRPG.Motive.withdrawn` | world-voice | “The Motive is withdrawn. Its demand, deadline, and consequence no longer apply.” | „Wycofano Motive: nie obowiązuje już ani jego żądanie, ani termin, ani konsekwencja.” | E71 |
| 36 | `DRPG.Action.tokensLeft` | player-card | one: “{room} has {n} Search Token left this time of day.”; other: “{room} has {n} Search Tokens left this time of day.” | one: „W pokoju {room} został {n} Search Token o tej porze dnia.”; few: „W pokoju {room} zostały {n} Search Tokeny o tej porze dnia.”; many: „W pokoju {room} zostało {n} Search Tokenów o tej porze dnia.”; other: „W pokoju {room} zostało {n} Search Tokenów o tej porze dnia.” | E71 |
| 37 | `DRPG.Actions.notEnough` | toast | one: “{actor} has {left} action left and needs {needed} for this.”; other: “{actor} has {left} actions left and needs {needed} for this.” | one: „{actor} ma {left} akcję, a potrzebuje {needed}.”; few: „{actor} ma {left} akcje, a potrzebuje {needed}.”; many: „{actor} ma {left} akcji, a potrzebuje {needed}.”; other: „{actor} ma {left} akcji, a potrzebuje {needed}.” | E71 |
| 38 | `DRPG.Calls.burst` | player-card | one: “You have {n} free action banked. It pays the whole price of one action, even a Long Rest.”; other: “You have {n} free actions banked. Each pays the whole price of one action, even a Long Rest.” | one: „Masz w zapasie {n} darmową akcję. Pokrywa całą cenę jednej akcji, nawet Long Rest.”; few: „Masz w zapasie {n} darmowe akcje. Każda pokrywa całą cenę jednej akcji, nawet Long Rest.”; many: „Masz w zapasie {n} darmowych akcji. Każda pokrywa całą cenę jednej akcji, nawet Long Rest.”; other: „Masz w zapasie {n} darmowych akcji. Każda pokrywa całą cenę jednej akcji, nawet Long Rest.” | E71 |
| 39 | `DRPG.Eclipse.moved` | player-card | one: “You are now in {room}, with {left} crossing left during this Eclipse.”; other: “You are now in {room}, with {left} crossings left during this Eclipse.” | one: „Jesteś teraz w pokoju {room}. Do końca Eclipse zostało ci {left} przejście.”; few: „Jesteś teraz w pokoju {room}. Do końca Eclipse zostały ci {left} przejścia.”; many: „Jesteś teraz w pokoju {room}. Do końca Eclipse zostało ci {left} przejść.”; other: „Jesteś teraz w pokoju {room}. Do końca Eclipse zostało ci {left} przejść.” | E71 |
| 40 | `DRPG.Tamper.watched` | config-description | one: “{n} other person in this room can see you. First you roll to hide what you are doing; on a miss with Despair, you lose Sanity on top of the price.”; other: “{n} other people in this room can see you. First you roll to hide what you are doing; on a miss with Despair, you lose Sanity on top of the price.” | one: „W tym pokoju jest {n} inna osoba. Najpierw rzucasz, żeby ukryć, co robisz; przy pudle z Despair tracisz dodatkowo Sanity.”; few: „W tym pokoju są {n} inne osoby. Najpierw rzucasz, żeby ukryć, co robisz; przy pudle z Despair tracisz dodatkowo Sanity.”; many: „W tym pokoju jest {n} innych osób. Najpierw rzucasz, żeby ukryć, co robisz; przy pudle z Despair tracisz dodatkowo Sanity.”; other: „W tym pokoju jest {n} innych osób. Najpierw rzucasz, żeby ukryć, co robisz; przy pudle z Despair tracisz dodatkowo Sanity.” | E71 |

## 13. Why so much is rebuilt

On 30.10.2026 the owner wrote: „Nie mam juz cztery kierunki niestety. Myslalem ze czat wszystko przeniosl do audytu.
Przyjmujemy ze wszystkie decyzje sa dobre...”. The wording of O1-O18, X1-X21, M1-M10, N1-N8 and of the 60 naturalness
pairs was lost with it. What survives is their names, the plan's one-sentence summary of O1-O18, the answers DB1-DB41,
the issue texts and mentions in other stages' texts. The owner's default holds: this guide is rebuilt from what
survives; every rule rebuilt so says "rebuilt 30.10" and names its source, or says that only its number survives; no
rebuilt rule is presented as the original; and the 60 pairs are written fresh for the owner to read: they were not on
the pilot's page, and the owner read and approved them on a second page, E65-PILOT-R2 (01.11.2026).

### What stays open, and the stage that owns it

Read on 01.11.2026 at the E65 fix round. Each item names an unshipped stage with a row in `tools/stages.json`; a stage
number alone means that row.

- **The rebuilt rules the pilot did not confirm**: 37 rules (section 1's fifth source, Sources 2, O5, O8, O9, O11,
  O12, O16, O18, B2, B3, X2-X9, X11, X14-X21, M5, N3, N4, N6-N8, V1, V3 and P3), the other seven rows of section 3
  and section 12's method: to confirm in E71 (row 1.2.128), which turns the report detectors to FAIL. Of the 41 the
  first page left, the 60 pairs of the second confirmed X1, X10, X13 and M8; X3 and O9 stay, because an approved
  after holds their shape by T5 (N24's „, nie wracają” for X3; the pilot's `DRPG.Diagnostics.cast.poolFix` „celowo”
  for O9, through X2), and X7 because a reviewer's point on it in the pilot's file still waits. The questions the C14
  reviewers left on O8, X6, X11, EN3, EN6, O5, M5, X4 and B2 (E65 STATUS Open 90-96) go with E71's batch.
- **The 60 naturalness pairs** (section 12): approved by the owner on E65-PILOT-R2 (01.11.2026), nothing open; they
  are applied to `lang/pl.json` by the stage the rule of `docs/dev/text-review-E65.md` gives - E66 (row 1.2.96) where
  a pair changes a name, E71 (row 1.2.128) otherwise - and T27 reports each until then.
- **The open glossary entries** (`open: true`: no source read decides them, so they forbid nothing), each with the
  stage that settles it, as the glossary's stage rule gives it (its `$comment`): `db3-english` (DB3's question is not
  in the sources read) and `mechanic-capitals` (which names DB25 listed) - E25, which settles the DB residue;
  `truth-bullet` (the four variants S18-31 names) and `murder-weapon` ("crime tool" or "Murder Weapon") - E66,
  which settles the names; `gm-bar-buttons` (the trial floor's GM bar, E70) - E71, which rewrites those strings.
- **The choices E65 recorded and did not ask** (E65 STATUS Open 19-22 and 25-27; each stands as built):
  A10's passage words read as `passage-words` reads them, and which keys A10's texts cover (19) - E66, from which T28
  fails; the glossary's sources beyond the decisions, S<nn>-<nn> and "E<nn> plan" (20) - E25, from which T8 fails;
  the retired rows' stages, E65 where no source ties one (21) - E66; not in the glossary for want of a source: DB4's
  resources (table 2.11, lost) - E71, which turns T11 and T12 to FAIL, and D33a's "Find Stash" as a Polish form - E25,
  which owns D33a-D33f, while the GM bar's buttons are now `gm-bar-buttons` (22); the stages chosen by reading for
  has-the-floor, speaking, foundry-tools, map-tools, room-tile, notice-history, find-passage, secret-passage,
  breach-the-wall and the DB residue (25) - E25, when T8 turns to FAIL; E65-11 run on the real glossary (26) - a
  record of how it was measured, nothing open; T8's other FAIL steps (E71 for stage-E71 entries, E57 for the
  handbooks) written in the glossary's `$comment` and not in MODES (27) - E25 decides whether MODES grows a list.
- **What E65 handed on**: T7's part fails from E25 (MODES `fail: "E25"`; E65 decision 44); the DB28 strings T11
  shows, Eclipse and Overflow agreed as masculine - E71 rewrites them (49); whether T20's FAIL also covers
  DateTimeFormat, NumberFormat and PluralRules outside the helpers - E66, when it turns T20 to FAIL (60); T4's FAIL on
  the window surfaces by reader and the readers of the screens SCREENS does not name - E71 (67); T13's file set,
  its own or the screen map's - E71, when it turns T13 to FAIL (69); whether a Polish handbook whose ids, kinds or
  lines differ from the English one is red - E57 (row 1.2.131), which owns the handbook facts (85); whether T4's FAIL
  needs a floor on how many strings a surface rule places (`node tools/check.mjs text` prints "T4 classified ...":
  2712 of 10242 on 01.11.2026) - E71, when it turns T4 to FAIL; the Frisk row's Polish form „Zobacz, co ktoś nosi”
  (`see-what-they-carry`) - E71, with R620's pinned form.
