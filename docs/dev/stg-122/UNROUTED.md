# The audit's unrouted items given to line STG (1.2.122, 21.11.2026)

From audit/findings-1.2.118/unrouted-122.json (origin/claude/audit-119 bb96d8dd): section A's DOC-05, section B's 67 ids (what ROUTING.md:130 leaves STG once the prefixes are routed and DEC-1b and H1b sent to MURDER) and
section D's indexes 8, 21, 159, 171, 274, 276 and 282, plus UI's H-5 (AUDIT 9.2 items 111 and 414). Each re-read on this
line's tree (aa0f6767 and after). Kinds, for B: **old strength** (a "mocna strona" of an old report, held by a harness
run), **live area** (only a table settles it), **record** (an old report's claim or count), **plan step** (a 1.2.13 step
whose state is its parts'), **code** (something to change). Statuses: **fixed** (with its test), **comment** (rewritten),
**record** (corrected where it is written), **already true** (where), **decision** (left by a recorded decision, where),
**tied** (its state is another id's), **needs a table** (not closed; its LIVE item named or proposed below in Polish).

## A and D

| id | status | held by |
| --- | --- | --- |
| DOC-05 | needs a table | LIVE-E39-20 (AUDIT 9.2), unchanged: the cause at 14.370, the race in play and the wait's length are unread; tier 2 "a put-back written while the token's newer move is on its way lands after it" holds the shim alone |
| D-8 | record, text for the owner | .claude/rules/code.md may not be edited by a line: OWNER-TEXTS.md section 7 (eight importers past murder.mjs, measured by grep) |
| D-21 | already true | tests-tier2.mjs (the 1.2.110 V3 test's comment): "the scoring itself hands in sheet-audit.mjs `actorAsHeld`'s stand-in", since 1.2.121 line K |
| D-159 | record, text for the owner | OWNER-TEXTS.md section 7: no `openPublicRollDialog`; gm-panel.mjs 13 names of its own; gm-students 3 exported, 2 re-exported; gm-campaign 11, 2 (espree) |
| D-171 | record | docs/dev/e59/CHAINS.md B-R7: the two more ways (watch-gm.mjs `namesIn`, tail-gm.mjs `standingIn`) named, neither asking the Spectator flag; the code is the audit's domain-item-b finding 1, not this line's |
| D-274 | already true | gm-handbook.en.md section 13 "Unseen until the opening roll": "marks the killer's tokens ... with the module's own mark (since 1.2.118; until then Foundry's hidden)"; the Polish twin the same |
| D-276 | record | known-leaks.json foundry-masked-token-actor `what`: the actor's portrait wears the "?" since 1.2.116 while its name stands, its sheet shut to other players (mask-gm.mjs, anonymity.mjs `maskedSheetClosed`); the handbook already says the portrait does |
| D-282 | record, text for the owner | OWNER-TEXTS.md section 7: `createGmStoreEngine` 1007 lines, `registerSettings` 1976, `applyCrisisAction` 308 (espree) |
| H-5 (UI) | record | AUDIT 9.2 items 111 (LIVE-E29-02) and 414 (LIVE-E24-01): the HUD's bar inputs are gone since 1.2.120 (token-hud.mjs `REMOVED` `.attribute.bar1`, `.attribute.bar2`), so neither asks a table to check them |

## B

| id | kind | status | held by |
| --- | --- | --- | --- |
| OA-1 | live area | needs a table | LIVE-E53-01 (perf() and fps() on the largest map) carries it; the cleanup after a scene change: proposed L-1 below |
| OA-2 | live area | needs a table | items 734 (LIVE-E71-01's screenshots of every window batch) and LIVE-E59-01 carry the cut texts; v14's light theme: proposed L-2 |
| OA-3 | live area | needs a table | B-E52-3 (LIVE-E52-03, live LiveKit, in 9.2 after the numbered items) and LIVE-E72-03 (item 730); music following the time of day at a table: proposed L-3 |
| WD-CRIME | old strength | tied | its state is LF-DEATH's, LF-CLEANUP's and LF-NOTHROW's, below |
| WD-DEGRADE | old strength | decision | module.mjs's hard stop covers the three required modules; a missing Isometric Perspective stops the module instead of warning, by the decision of 09.10.2026 |
| CL-LIVE | record | record | audit/AUDIT-1.1.88.md checklist item 6: dated note, the section has three areas, not four; their states are OA-1..OA-3 |
| LF-NOTHROW | old strength | already true (headless) | tiers 0-1 at this line's tip: 1837 passed, 0 failed, 16 skipped, 0 red; scenarios 33 and 93 green (0 failed) - no test throws headless; at a table, the sandbox's tier 2 is DOC-04's |
| LF-DEATH | old strength | already true | 10-murder.mjs's Finishing Blow check; the death held by the GMs is published at its discovery on purpose (E05 C10, TWO PHASES in death.mjs) |
| LF-CLEANUP | old strength | needs a table | headless `endMurder` clears the state (10-murder.mjs); the restore on 14.370 was read on another tree (01b845d7): proposed L-4 |
| A4 | live area | needs a table | LIVE-E16-06 (AUDIT 9.2 item 305) |
| A9 | live area | needs a table | AUDIT 9.2 items 558 and 559 |
| Q3 | code (comment) | comment | death.mjs `reviveCharacter`'s JSDoc and gm-students.mjs's header say the Truth Bullets, not "the inventory" (`killCharacter`'s JSDoc was already right) |
| Q9 | live area | needs a table | as A9: items 558, 559 |
| Q12 | code (comment) | comment | tables-pools.mjs: the rule stands in no handbook (grep of docs/handbooks for the three items); the decision lives in AUDIT-1.2.13.md Q12 alone |
| Q16 | record | already true | the veil's flag is a declared known leak: known-leaks.json foundry-veiled-token-actor, since 1.2.122 class killer-identity, high (DOC-02) |
| REB-hub | record | decision | one `openItemManager`; the Items button on every row of the Students window by the decision of 09.11.2026 |
| VER-A18 | record | record | AUDIT-1.2.13.md A18: dated note, patches.mjs has been imported in `ready` on every client since E52 C3 (module.mjs:411, :416), not on demand |
| C1 | plan proposal | decision | the duplicated JSDoc held at zero (tools/comment-budget.json, R7150); the 15-20% comment target dropped for the house style (CLAUDE.md "The house style") |
| C4 | plan proposal | decision | dynamic `import()` kept: the static switch was rejected in 1.2.13 (AUDIT-1.2.13.md C4); R161 holds no static cycle |
| C5 | plan proposal | record | `onSocket` is `judge` over the table (bridge-table.mjs); config.mjs not split, six files over 3500 lines: what stays is the hygiene in AUDIT 12.3 |
| D1 | live area | needs a table | the parse is gone (truth-bullets.mjs); the whole region rebuilt per batch of changes, its cost at a table: LIVE-E53-01's `live..drpg-case-live` line |
| D7 | plan proposal | decision | as C4 |
| E1 | plan proposal | record | 594 `ui.notifications` calls; no lint holds which level a refusal takes - left, as the old plan's step was a review, not a rule |
| E2 | plan proposal | already true | since E100 Move opens nothing (action-rolls.mjs `performAction`'s dispatch) |
| E3 | plan proposal | already true | no tooltip over its limit (`node tools/check.mjs text` T4: tooltip 936, 0 over the limit) |
| E10 | plan proposal | record | Install in the footer (tables-editor.mjs); two new-item forms remain - the UI's |
| E12 | plan proposal | decision | a player's call is told `DRPG.Panel.gmOnly` (tables-editor.mjs), left so by decision |
| F2 | plan proposal (text) | record | 17 of 21 keys under 220 characters; `Vote.verdictNote` grew - the text budgets' (docs/text-budgets.json, T4) |
| F3 | plan proposal (text) | record | eight of nine hold; `Panel.whoIsAliveNote` a paragraph again - T4 holds it under its limit |
| F4 | plan proposal (text) | record | 553 config sentences (walkConfigProse), 20 over 220 characters, all within the word limit |
| H5 | plan step | tied | E1, E3 (above) and E7 (closed) |
| H6 | plan step | tied | F2, F3, F4 |
| H8 | plan step | tied | C2, A15, A18 closed, C3 partly; "minus 8000 lines" not measurable against code three times the size |
| H9 | plan step | tied | C1, C5 (records), C4 (decision) |
| H10 | plan step | tied | C6 partly |
| H-note | plan step | tied | A3 closed, A4 needs a table |
| 3.1-03 | code | fixed | explain.mjs `eclipseExplanation(crossings, night)`: under the Overflow's darkness the night's rooms (`freeBecomes`), not "anywhere"; `DRPG.Explain.phase.eclipseDark` EN/PL; R8462 (red at aa0f6767; mutants killed), R1160's pinned signature changed on purpose |
| 3.2-05 | record (text) | tied | the 1.3.0 manual text pass (S9.1a-2); "killer" and "Blackened" have no glossary entry |
| 3.2-09 | record (text) | tied | as 3.2-05; "OBJECTION!" by X15 |
| 3.3-03 | text | tied | the owner's Q-NC-16 (docs/dev/e71/NEEDSCODE.md): the Loaded Die's effect is an owner-approved B01a text the batch check holds |
| 3.3-09 | live area | needs a table | LIVE-E66-01 (the labels' fit), TEXT-LC3 |
| 3.4-04 | code (text) | fixed | `DRPG.Handover.alreadyHasIt` EN/PL: "Nothing changed hands: "{name}" stays with you." - nothing of what the recipient holds; R8461 (red at aa0f6767; mutants killed) |
| 3.4-06 | text | fixed | `DRPG.Hud.trialTooltip` EN "The Class Trial is under way.", PL "Trwa Class Trial." - no GM's console on a player's HUD |
| S0-G1 | record | tied | ROLL-02 and ITEM-04 (AUDIT 13.3) |
| S0-G2 | record | tied | the 1.3.0 manual text pass (S9.1a-2) |
| S0-G4 | record | tied | UI-09, UI-11, MAP-02 (AUDIT 13.3) |
| S0-G5 | record | tied | CORE-19 (AUDIT 13.3) |
| S0-G6 | record | tied | MAP-13 (13.3); the budget machine LIVE-E33-05 |
| S0-G7 | record | tied | S6-H3 |
| S2.3-L11 | live area | needs a table | item 734 (LIVE-E71-01's screenshots, Polish among them) |
| S2.2-CASE-08 | record | tied | CASE-08 |
| S6-H2 | record | already true | AUDIT 12.3 holds today's counts (7 sheets, 31 831 lines, `!important` by sheet) |
| S6-H3 | record | record | measured 21.11.2026 (espree): `applyCrisisAction` 308 lines; the long factories and tables OWNER-TEXTS.md section 7 names |
| S6-H4 | record | already true | AUDIT 12.3 (75 functions of 150-300 lines in code three times the size) |
| S6-H5 | record | already true | one definition each (git grep); the five "is it Stained Glass" readers and 25 local `esc` aliases as AUDIT 12.3 counts |
| S6-H9 | record | already true | the named ones are in `TIMING` (config.mjs); the count of today's literals is not taken |
| S6-H10 | record | tied | the 248 comment rows of the audit's section D, each routed to its line |
| S9-34 | record | tied | CORE-15 and MAP-08 |
| S9-BAL | record | record | AUDIT section 9: the dated note of 21.11.2026 (157 ids, 24 named for 25, COMM-10), DOC-20 |
| S9.3-M | live area | needs a table for desk and tablet at a table; read headless | `node audit/glass-sweep.mjs` run 21.11.2026 (section "S9.3-M" below) |
| S9.3-LC | live area | needs a table | AUDIT 9.2 items 18-25 |
| S9.1-D4 | record | tied | ITEM-04 |
| S9.1a-1 | live area | needs a table | the whole of AUDIT 9.2 |
| S9.1a-2 | record | tied | the 1.3.0 manual text pass, not yet; E71 rewrote about 2800 texts (its papers), "Remnant" 313 keys, "trace" 12 |
| S9.3b-5 | live area | needs a table | LIVE-E33-05 (the budget machine), LIVE-E53-01 |
| S9.3b-36 | record | tied | S9.1a-1 and S9.1a-2 |
| S9.3c-2 | record | decision | the launchers cleared (glass.mjs `clearLaunchers`); 280-320 px out of scope by the decision of 11.11.2026 (AUDIT 9.2 item 461) |

## Proposed LIVE items (Polish, unnumbered)

- **L-1 (OA-1):** na stole v14 z największą mapą izometryczną właściciela: zmienić scenę trzy razy tam i z powrotem przy otwartym Investigation; po każdej zmianie `game.drpg.counters()` i liczba obiektów PIXI warstwy mgły i pierścieni (`canvas.stage` przeszukany) wracają do tej samej liczby - nic nie zostaje po starej scenie.
- **L-2 (OA-2):** na v14 z jasnym motywem Foundry (ustawienie interfejsu), w obu motywach modułu: okna modułu, HUD i karty czatu są czytelne - żaden tekst nie ginie na jasnym tle Foundry; zrzuty.
- **L-3 (OA-3):** przy stole z muzyką przypisaną do pór dnia: zmiana pory dnia przez GM-a przełącza playlistę u każdego gracza w ciągu kilku sekund, a głos zostaje w pokojach (avclient-livekit).
- **L-4 (LF-CLEANUP):** na v14 po `game.drpg.runTests({ tier: 2 })` na kopii świata: `worldDump` przed i po różni się o nic; zapisać każdą ścieżkę, która została.

## S9.3-M: the glass sweep, read here

`node audit/glass-sweep.mjs --chromium /opt/pw-browsers/chromium` on 21.11.2026 (Chromium 153.0.8010.12, software-drawn),
beside a tier-1 run on 4 cores: it read 26 sizes of Stained Glass as the GM, each with 0 overlaps, 0 blocks failed, 0
edge gaps and every launcher found (the stacked sizes at 844x390 and 640x360 drawn flat, as designed), and was stopped at
this line's 1200 s limit before Legacy and the player's pass. The project's own reading is 194 s alone (CLAUDE.md), so the
time is the shared machine's. What a table's desk and tablet draw stays unread (software drawing is a shape, not a frame).
