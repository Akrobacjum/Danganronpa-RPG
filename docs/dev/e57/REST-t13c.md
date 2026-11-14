# E57 rest, T13 group 3 (claude/e57-t13c-113): what was done, and what is left

Read on 14.11.2026 from claude/e57-tools at 6cd30a92, by `node tools/check.mjs text --all`. The slice is T13 (`uiLiterals`) in 23
files: passages-gm, monocub, relay-guard, remnants, bridge-guards, call-effects, private-rolls, projects, inventory, frisk,
incident-store, sheet-audit, ui-kit, projects-ui, despair, verdict, tables-editor, settings, season-setup, room-setup,
passages-tab, gm-items and chapter (`scripts/<name>.mjs`). The slice had 236 findings at the base; the whole tree had 737.

## The count

| | The slice | The whole tree |
| --- | --- | --- |
| At the base (6cd30a92) | 236 | 737 |
| After the detector's rules (e567ea2, 46f8f2a, d489331, 31d35d5) | 52 | 504 |
| After the move and the allow table (d489331, 31d35d5) | 5 | 468 |

Of the slice's 236:

- 184 were the detector's misreads, taken out by a rule (below), each red first in T13's fixture.
- 11 were the Remnants migration's summary line, which a GM's toast showed in English: the toast now reads
  `DRPG.Remnant.migrated` and `DRPG.Remnant.migratedCheck` (en and pl, the check a plural family), and the English line,
  with every token's details, is logged as before, inside its `log()` call (remnants.mjs `migrateRemnants`).
- 36 are allowed, one row each in `UI_LITERAL_ALLOW` (scripts/tests-text.mjs), with the reason beside it: 15% of the slice.
- 5 are left: relay-guard.mjs, below.

T13 stays a report: 463 findings stand in the other lines' files.

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

What the rules took out in the other lines' files (37, round 1; 1, the claims rule), read by name and listed to the
coordinator: action-project 841, body-tile 423, gm-panel 509 and 1119, sheet-item 54 and 64 (fragments); gm-store 659-680
(C12 had already decided these were reasons); movement-audit 288, 342, 348 and 449-453, passages 611-614, vote 224, patches 162
and 1391-1397 (reasons); search-tokens 880 (a claim). patches.mjs's `why` and `note` feed the patch census. I did not read
whether a window shows them.

## The allow table's reasons, one line each

- console only: overflow.mjs `addOverflow`'s `reason` (call-effects "Feed the Overflow", despair "pool spill").
- console only: steps.mjs `runSteps`'s `label` (chapter "chapter's end", verdict "Final Trial's verdict").
- console only: incident-store.mjs `liftIntoCast`'s `what` ("the incident's method", "the incident's fight").
- console only: ui-kit.mjs `ownAttrs`'s first argument, the Error's message ("a role button", "an icon button").
- console only: a Remnants migration's per-token lists, joined into its `warn()` lines (remnants.mjs, six literals). The GM's
  toast counts them.
- console only: the GM's log line of a refused or unpaid Bribe or a refused Bounty (monocub.mjs, three literals). The players
  are told by key.
- console only: passages-gm.mjs `TUNNEL_REFUSALS`, the console's words for a tunnel's codes (five).
- console only: relay-guard.mjs `judgeFear`'s `noted`, logged by `warn()` (three).
- passages-gm.mjs `MAP_REFUSALS.short`: a template that the closed list names. A template is not matched whole.
- incident-store.mjs `PUBLIC_INCIDENT`: the reason for each field the world half keeps. It is data that the suite and
  world-secrets.mjs read (two).
- inventory.mjs `OLD_TIER_THREE`: an old item's description in each language, which the migration compares (two).
- projects-ui.mjs "project sabotage": a `data-drpg-when-trigger` value, an id.
- settings.mjs `DEFAULT_SAFEWORD` "Safe Word": a world setting's stored default. It is the one word the whole table says, so
  a per-browser translation would split it at a table with two languages. migrate.mjs compares it.
- tables-editor.mjs "Danganronpa RPG": the module's own name on the RollTable folder it creates.

## What is left, by file and line

relay-guard.mjs, five literals: 673 "party members" (`shapeWarning`'s case, which `DRPG.Relay.unreviewed` names in a GM's
notice), and 744 "the settings of", 748 "the project", 764 "the countdown" and 767 "the removal of" (`judgeCountdowns`'s
`suspicious`, refused through `refuseAs` or noted in the console).

These are reported, not allowed, because they do reach a screen. Every relay refusal's reason does (a drop's reason and a
`noted` line go to the console alone): relay-guard.mjs `reportRefusal` puts `verdict.why` into `DRPG.Relay.refused`'s `{what}` in a GM's toast, and into `DRPG.Relay.forged`'s in the GMs'
whisper. A Polish GM reads the frame in Polish and the reason in English. The detector's reason rule now reads the relay's
other reasons as the GM's record, which is what C8's rule already did for a literal right after `refused:` in that file. So
T13 does not count this road beyond these five.

## Questions for the owner, each with the default taken

- Q-T13c-1: the relay's English reasons in a GM's toast and whisper (above). Should the toast name the request in the GM's
  language and leave the English reason to the console and the `sheetWrites()` row? Or should each reason get a code with
  its own Polish, as the bridge's `REASONS` have? Default taken: neither in 1.2.113. The five stay a report, and the road
  is named here. Either change is a trust-model change in relay-guard.mjs, with scenarios 30 and 83 to rerun.
- Q-T13c-2: the safeword's default is "Safe Word", while docs/glossary.json's entry `safeword` writes "safeword". Default
  taken: left as it is. The value is stored in worlds, migrate.mjs compares it, and a world that never set its own word
  shows it.
