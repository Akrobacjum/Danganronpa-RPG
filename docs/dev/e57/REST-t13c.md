# E57 rest, T13 group 3 (claude/e57-t13c-113): what was done, and what is left

Read on 14.11.2026 from claude/e57-tools at 6cd30a92, by `node tools/check.mjs text --all`. The slice is T13 (`uiLiterals`) in 23
files: passages-gm, monocub, relay-guard, remnants, bridge-guards, call-effects, private-rolls, projects, inventory, frisk,
incident-store, sheet-audit, ui-kit, projects-ui, despair, verdict, tables-editor, settings, season-setup, room-setup,
passages-tab, gm-items and chapter (`scripts/<name>.mjs`). The slice had 236 findings at the base; the whole tree had 737.

## The count

| | The slice | The whole tree |
| --- | --- | --- |
| At the base (6cd30a92) | 236 | 737 |
| After T13c's detector rules (e567ea2, 46f8f2a, d489331, 31d35d5) | 41 | 504 |
| After the reconcile with T13b (6d7f6ca, merge 3e31bc2) | 5 | 263 (258 of them patches.mjs, T13a's) |
| After the reconcile with T13a (f806bc8, merge 3602492) | 5 | 5 |
| After the relay's words (this commit) | 0 | 0 |

T13 is FAIL in MODES since this commit (tests-text.mjs; tier 0's pin `["uiLiterals", "T13", "fail"]`).

Of the slice's 236, read at T13c's own tip before the reconcile:

- 184 were the detector's misreads, taken out by a rule (below), each red first in T13's fixture.
- 11 were the Remnants migration's summary line, which a GM's toast showed in English. The toast now reads
  `DRPG.Remnant.migrated` and `DRPG.Remnant.migratedCheck` (en and pl, the check a plural family), and the English line,
  with every token's details, is logged as before, inside its `log()` call (remnants.mjs `migrateRemnants`).
- 36 were allowed, by file and their own words. In the reconcile they became rows of T13b's `UI_LITERAL_ALLOW`
  (`"<file> <declaration>": { n, why }`). Five of the 36 needed no row after it, because T13b's rules read them (a
  parameter read only by the console: incident-store.mjs `liftIntoCast`, ui-kit.mjs `ownAttrs`; and one of monocub.mjs's).
- 5 were relay-guard.mjs's: see the relay's words, below.

## The detector's rules (scripts/tests-text.mjs, the comment above `REFUSAL_NAME`)

More than a fifth of the slice would have gone to an allow table, so the detector was fixed instead. Each rule has a plant in
T13's fixture that was flagged before the rule, and the fixture keeps one control that is still flagged.

- A reason after `why:`, `refused:` or `why =` is the whole expression up to a comma, a semicolon or a brace: a ternary's
  arms, a `??`'s right side. Read up to 400 characters back (C8: 40). A template's later pieces are judged from the
  template's start, so each piece of `` { refused: `the item ${name} is not here` } `` is a reason. Until this, only the
  first piece was one.
- What a function named `...Refusal`, `...RefusalOnGm` or `refuses` returns, and what bridge-guards.mjs's own `guard...`
  functions return. In the module these names are judges that answer an English reason or null.
- What a function of the same file with a `why` parameter is given (relay-guard.mjs `refuseAs` and `dropAs`), after a spread
  too. Until this, only bridge-guards.mjs's guards were read this way.
- passages-gm.mjs's `whyTable` is a closed list beside bridge-guards.mjs's `REASON_PATTERNS`. Each English reason there has a
  code that `DRPG.Passage.why.<code>` says (R983). The rule covers its literals and the constants it names.
- A bridge table row's `claims` object: for an id no guard names, the sentence R1b reads.
- As console text: the message of an Error subclass the file declares (call-effects.mjs `NothingToDo`, whose message no
  one shows) and the calls of a logger's alias (an arrow whose body is one log call: bridge-guards.mjs `request`'s
  `report`).
- As no text: a Symbol's description; a run of markup attributes cut by a placeholder (` disabled data-tooltip="`); a
  selector cut by one (`footer button[data-action="`); a border's CSS value (`1px solid `); a font list.

What these rules took out in the other lines' files (37 in round 1, 1 by the claims rule) was listed to the coordinator by
name and line.

## The reconcile (3e31bc2, 3602492)

The three lines' detector changes are merged on this branch, so T13a and T13b merge one commit:

- T13b's `consoleOnlyArgs`, selectors, attributes, CSS rules, wrapped loggers, text fallbacks and claims, and its
  `UI_LITERAL_ALLOW` keyed `"<file> <declaration>": { n, why }`, which keeps its name. T13c's rows were added to it.
- T13a's per-file property table, renamed `UI_LITERAL_FIELDS` (the bag's `uiFields`).
- One fixture holds all three plant sets. Its flags are 13, and tier 0's pin is `["uiLiterals", 13, 13]`. Allowed is 5:
  T13b's 2, plus T13a's string sum, which counts 3.
- Five of T13b's rows were dropped and auditMove's `n` went from 9 to 6, because the T13c rules now read those literals:
  gmsRefusal, sentBackRefusal, passageRowsRefusal, ballotRefusal, drawCorpseCaption. The stale-row check named each one.
- In T13a's fixture, the allowed field's plant is `quiet:`. It was `why:`, which the reason rule reads, so the plant now
  still tests the field table.

## The relay's words (relay-guard.mjs `RELAY_WHAT`, `relayWhat`; R7050)

A relay judge answers its reason in English. Until this commit, `reportRefusal` put that English into `DRPG.Relay.refused`'s
`{what}` (a GM's toast) and into `DRPG.Relay.forged`'s (the GMs' whisper). The coordinator decided: a toast is a screen, so
the words move into lang/. Each judge's English stays as it was, because the console line, the `sheetWrites()` row
(`recordTrace`) and the suite all read it. The toast and the whisper say it through `RELAY_WHAT`, a closed list of 27
patterns, as the bridge's reasons reach a player through `REASONS`. Each pattern takes one judge's English whole, and its
named groups fill `DRPG.Relay.what.<code>` (en and pl). These are fragments after a colon, a row in docs/text-style.md
section 14. A reason no pattern takes is said as `DRPG.Relay.what.unnamed`.

R7050 (tier 1) asks each judge's refusal road with made-up packets and a made-up world. It holds that each road is said by
its own pattern, that every pattern is reached, that every code has its key, and that an unknown reason is `unnamed`. It
does not ask one road, `partyUnlisted`: that road whispers to the GMs (`shapeWarning`), and tier 1 may not write. That
pattern is asked with the judge's English instead.

`shapeWarning("party members")` now says `system.partyMembers`, the Daggerheart field it means. The case names it lists in
`DRPG.Relay.unreviewed` are Daggerheart's own names. The four countdown names `judgeCountdowns` lists as odd stay English in
the console line and the trace (a `UI_LITERAL_ALLOW` row). The toast says `countdownsOdd`.

## The allow rows of T13c, one line each

- console only: overflow.mjs `addOverflow`'s `reason` (call-effects `feedOverflowEffect`, despair `adjustDespair`).
- console only: steps.mjs `runSteps`'s `label` (chapter `runChapterEnd`, verdict `runVerdict`).
- console only: why a Bribe is closed unpaid, written by `warn()` (monocub.mjs `answerBribeOnGm`, 4).
- console only: passages-gm.mjs `TUNNEL_REFUSALS`, the console's words for a tunnel's codes (5).
- console only: relay-guard.mjs `judgeFear`'s `noted`, logged by `warn()` (3).
- console and trace only: relay-guard.mjs `judgeCountdowns`'s odd changes (4).
- console only: a Remnants migration's per-token lists (remnants.mjs `migrateRemnants` 2, `migrateRemnantsOnce` 3,
  `migrateRemnantToken` 1, `leftOnToken` 1). The GM's toast counts them.
- passages-gm.mjs `MAP_REFUSALS`: `short`, a template that the closed list names.
- incident-store.mjs `PUBLIC_INCIDENT`: each world-half field's reason, data that the suite and world-secrets.mjs read (2).
- inventory.mjs `OLD_TIER_THREE`: an old item's description in each language, which the migration compares (2).
- projects-ui.mjs `openProjectDialog`: a `data-drpg-when-trigger` value, an id.
- settings.mjs `DEFAULT_SAFEWORD` "Safe Word": a world setting's stored default. It is the one word the whole table says,
  so a per-browser translation would split it at a table with two languages. migrate.mjs compares it.
- tables-editor.mjs `installTables`: the module's own name on the RollTable folder it creates.

## Questions for the owner, each with the default taken

- Q-T13c-1: the safeword's default is "Safe Word", while docs/glossary.json's entry `safeword` writes "safeword". Default
  taken: left as it is. The value is stored in worlds, migrate.mjs compares it, and a world that never set its own word
  shows it.
