# The handbooks line (E25's handbook part, E57 C6-C11) - status

Branch `claude/handbooks-113`, from `claude/fervent-sagan-gme4vt` at 1463f22b (1.2.112), started 14.11.2026.
Files: the six handbooks in `docs/handbooks/`, their facts files, this file and `LABELS.md` beside it.

## Order of the work

| Step | What | State |
| --- | --- | --- |
| 0 | Read: plans E25 and E57 (plan-130), e57-prep, e71's CHANGES and FROZEN, the audit's issue texts (lines-board `issues.json`, `plan.json`) | done |
| 1 | E25's handbook part: contradictions, D13, D14, D5, D33c-D33f, the Polish glossary, features since the plan | done (d8fbb34f D33c; 68f80f8c player and brochure; ce38e5ab the GM pair and the tests' D33c forms) |
| 2 | E57 C6-C8: the English handbooks by the guide | done: rewritten (1c1d818e); seven reviews (English, cold, mechanics) applied by ten fix agents (b2362972 GM, 2cdd9a25 player and brochure); the facts of the final English in `docs/handbook-facts.<book>.en.json` (7222 / 2744 / 280 facts, `handbook-facts.mjs check` 0 problems on all three at 5d5c50a6) |
| 3 | E57 C9-C11: the Polish handbooks from the facts and the old Polish | done: 21 writers from the facts and the old Polish, never the new English sentences (DB26); the Polish read in three steps (grammar and the glossary, naturalness by text-style.md section 12, the facts against the code) and fixed (4ba36475 player and brochure, 5d5c50a6 GM); pairs "ids, kinds and lines as in English: yes" for all three |
| 4 | Reviews, labels brought up to date, tier 1 | reviews done; LABELS.md regenerated at 5d5c50a6; the text lines' merges: e71-c merged (dfb0fe29), e71-b merged at 226cfb95 (6d8c5c92) and its 31 changed quotes brought up to date; group D waiting for the coordinator's sha |

## Readings taken at the base (1463f22b, 14.11.2026)

- `wc -l`: GM 1411 / 1411, player 950 / 950, brochure 78 / 78.
- `node tools/check.mjs text`: green; Polish ids, kinds and lines as in English for all three pairs.
- e71's FROZEN.md froze sections for branches open on 13.11. Of them E64, E72, E91, E93, E69, E100 and the gaps,
  dh-212b and project-token-icon lines have shipped (tools/stages.json, 1.2.110-1.2.112); the branch heads that
  still show commits past the base (e61-62, e93, e72, e64, gaps-a, e101, e101b, e64-inv) are the tails of shipped
  work. The plan (E57 C6-C8) rewrites every section, so this line treats the freeze as lifted.

## Size, measured (`wc -w`, 14.11.2026)

| Handbook | At the base (1463f22b) | After E25 (ce38e5ab) | Now (5d5c50a6) | Of it, the appendix |
| --- | --- | --- | --- | --- |
| GM, English | 67816 | 68448 | 78260 | 14892 (rules part 63374) |
| GM, Polish | 59018 | 59561 | 70408 | |
| Player, English | 22845 | 23227 | 27376 | 3006 (rules part 24370) |
| Player, Polish | 19819 | 20157 | 24591 | |
| Brochure, English | 1606 | 1661 | 2055 | none |
| Brochure, Polish | 1480 | 1542 | 1975 | |

The books grew; they did not shorten by the 20-30 % B4 names as a report. The rules part of the GM handbook is 7 %
shorter than the whole book after E25; the player handbook's rules part is 5 % longer and the brochure 24 % longer.
What grew them is the fix pass: the cold and mechanics reads found rules a reader could not apply and terms used
before they were explained, and each fix states the missing part (M4: no rule dropped to get shorter). Lines grew
more than words (GM 1411 -> 2459) because long paragraphs were split and prose became tables and lists.

## Tests whose handbook sentences changed (the coordinator's yes of 14.11.2026: test data only, each fact still held)

| Test | Old pinned text | New pinned text | The fact it holds | Red on the old line, green on the new |
| --- | --- | --- | --- | --- |
| R321 (tests-tier0.mjs :13697, :13708, :13709, :13717, :13719) | Polish "GMa" (5 sentences) | "GM-a" (D33c) | the Class Trial's world copy, the dead objector refused, the verdict's runner, Skip once, the Level Up latch | red at d8fbb34f with the old regexes, green after (`run-tests.mjs --tier 1 --only R321`, 14.11) |
| R431 (tests-tier0.mjs :14406, :14408, :14410, :14417, :14418) | Polish "GMa", "GMem", "GMowie" (5 sentences) | "GM-a", "GM-em", "GM-owie" | a rename carries keys, the rename record, the body records, the put-back of a player's mark, one student one witness | the same |
| R321 (tests-tier0.mjs :13687, player `lateBallot`) | "If you connect while a vote is open, your ballot comes as your browser loads" | "... your ballot comes as the game loads" | a late joiner gets a ballot; the browser wording moved to 17.12 (O19) | red at b2362972's tree with the new player text, green after (`--only R321`, 14.11) |
| R1036 (tests-tier0.mjs :17892, player `mutedDead` first pattern) | "... gives it back when it ends - a death nobody has found too" | "... gives it back when it ends\\. It does so for a death nobody has found too" | the dead's microphones off for the trial, an unfound death included (the dash aside split, X4) | the same (`--only R1036`) |
| R310 (tests-tier0.mjs :13475, the Polish GM Daily Life sentence) | "... żaden ślad nie jest tego rodzaju ..." | "... żaden Remnant nie jest tego rodzaju ..." | no roll is scored on the Daily Life row (the glossary's `remnant`, PL-r) | red on the new line with the old regex, green after (`--only R310`, 14.11) |
| R321 (tests-tier0.mjs :13725, the Polish player `lateBallot`) | "... gdy wczytuje się przeglądarka" | "... gdy wczytuje się gra" | a late joiner gets a ballot (O19; the browser wording stays in 17.12) | green both ways: the appendix's copy still held the old words; the new line is the one it now reads |

R620's Polish GM Palm row ("Body 12 po odmowie") was dropped by the Polish fix pass and put back in 5d5c50a6: red on the fix pass's row, green on the committed one (`--only R620`, 14.11). No test changed for it.

## Where this line follows the UI, not the decision, until the text lines land

- "Neighbours": the Room setup column is **Neighbors** since group B (Vault.neighboursColumn) and the handbooks quote it so. The prose "Neighbours list" (GM 706, 734, 738) and Vault.neighboursNote ("“Neighbours” is where a door overrules the map") stay British: R431 pins two of those sentences, and the coordinator gave that rename to group D's commit, which brings them and the note together.
- The merge of e71-b: one key changed on both sides, DRPG.Bridge.what.overflow.add (B "Add to the Overflow", C "Add Despair to the Overflow"); C's value kept, as it holds B's capital too. Every other key is the side that changed it (checked key by key, 0 mismatches).

- "pool" (Tier pools, Room pools, The global pool, `DRPG.Tables.*`, `DRPG.Vault.globalPool`): D33d says "table", but the
  UI still says "pool"; the handbook names what the GM sees, so the GM handbook keeps "pool" in both languages (40 words
  the E25 pass had changed were put back). To change with the labels once the text lines rename them.

## Code and UI text that look wrong (not changed here; for the coordinator and the text lines)

- config.mjs HOPE_CALLS.freeCrit prose (:2530) says "your next roll"; the code loads it on an action roll only (roll-dialog.mjs grantsFor :984-991, CALL-03). The handbooks say "next action roll". UI text side.
- config.mjs:4726-4727 comment says Tamper costs 1 Sanity; true only for the killer's own clean-up (cleanup.mjs tamperPriceSkip :1987-1993). Comment only.
- DRPG.Class.deadStill (sheet.mjs:4745) tells the dead they speak at the table; voice.mjs puts them with the Spectators. UI text.
- SFX_EVENTS.sabotageSeen.hint "Heard by the whole table"; the card goes to the room and the GMs (S13-48). UI text.
- DRPG.Remnant.deathTied points to "Not tied", the Investigation cell shows "No".
- lang/en.json trial and Investigation keys still say "analysed" (S13-46 UI side; E71's glossary entry).
- DRPG.Murder.thresholdShort PL "Pobij {n}" where the rest says "Przebij".
- DRPG.Murder.nightNoteIndirect (murder-rules.mjs:348-351, :568) tells the GM a trap victim's Night opening roll has disadvantage; MURDER_OPENING.victim.nightDisadvantage is false. UI text or code.
- DRPG.Chapter.keptUntilFound says "Players window"; the window is "Students".
- Unsure: a critical cover roll restores 1 Sanity though a success costs none (cleanup.mjs:2091-2092): the killer ends 1 ahead.
- Unsure: Move the Body's DC floored at 0, not CLEANUP.minDc 8 (no tier reaches it).
- murder-rules.mjs:2590 comment: Self-Defense 'exactly one attempt', a miss leaves it usable. Comment only.
- INDIRECT_MURDER.subProjects (config.mjs:2022): "unless you obtained the tool" for Prepare the Weapon's room - no code checks it.
- config.mjs:673 usable hint "clear Sanity" (D5/M7); config.mjs:2542 Bribe "favour" (EN1).
- Confusion's first tier is 11 (config.mjs:3521-3525, "owner to confirm" since 12.11); handbooks now say 11.
- OVERFLOW comments say "the eight"; there are thirteen effects. Jitters/Power cut texts say "the GM's room actions" (meant: the room's own actions).
- DRPG.Monocub.dialogIntro is unused and states another rule.
- The safeword's 60 s repeat window does nothing with no GM connected: each press posts a new card (safeword.mjs callSafeword).
- DRPG.Note.q3 uses the retired word "consent" (lowercase, passes the lint).
- DRPG.Season.resetKeeps lists "who watches whom" as kept; the assignments group (ticked by default) clears it (season-exceptions.mjs:96-99). Unsure.
- season-exceptions.mjs:33 comment says 28 ticks; there are 30.
- DRPG.Trial.presentWithoutNote 'analysed'; DRPG.Season.hint.scenes still says Room setup's Scenes tab (now in Season setup).
- DRPG.Season.introReady says 'run' Pre-season checks (now inside the Season checklist); DRPG.Panel.seasonChecks unread. Contract sentences copied exactly keep British spelling (randomiser, colour, greyed).
- DRPG.Requirements.reason.dice-so-nice and module.json: 'in the one dice style the GM sets for the table' - not true under Each player's own.
- action-tamper.mjs:222-230 comment: Tamper costs Sanity once actions are gone; code (config.mjs:1831, tamperPriceSkip) says no Tamper with no action left. Comment only.
- Q: D113 ('the skip order in the budget paragraph') has no source in the repository; read as the order a price is paid in (banked Burst before actions; Free Move, banked crossing, Burst, then an action for a crossing).
- DRPG.Rooms.reportNote (migrate.mjs:1242) puts 'This is a room' in the Doors tab (Rooms tab since E101). DRPG.TrialScene.hallDark names Room setup's Scenes tab (key unused).
- DRPG.Season.missingMonokumaActor points to Despair Flow and the Actors list's menu; neither makes a Monokuma. DRPG.Season.step.hallTokens unused. roomCountLine comment says Doors tab.
- murder-ui.mjs indirectCostText 'roughly 4 to 5 actions' assumes every Work alone; with others present up to 10. ITEM_CATEGORIES.usable.hint 'clear Sanity'. DRPG.Clock.takenBack names less than End without advancing puts back. The sheet's wrench window is in no handbook.
- Dice So Nice is required (module.json, requirements.mjs) but season-setup.mjs:640-650 keeps an 'optional' First session row that can only be ticked. Code or text.

- lang hint 'No Mastermind set. Pick one from the GM panel first.': the Mastermind is picked in Season setup > The Mastermind.
- Escape Together on a critical leaves no Remnant: CRISIS_ACTIONS.sharedEscape.remnant has no critical key (murder-rules.mjs:1822); the others decide it explicitly. Possibly unintended.
- config.mjs:1610 hintCritical 'They ask you one question' (the player asks). config.mjs:1920 'hidden-difficulty repair' is a plain Desperate (8) project. R1374 pins 'a red row' while GM rows wear the chip (danganronpa.css:11566-11576): the test's sentence is stale.
- lang/pl.json (from the Polish review): DRPG.Monocub.hopeFull "Masz pełne Hope." (Hope masculine: "pełny"); DRPG.Frisk.rowLabel "Zobacz, co nosi" (glossary "Zobacz, co ktoś nosi", with R620); DRPG.Hud.rewindEclipse, rewindDuringEclipse, Panel.nextEclipse treat Eclipse as masculine (PL-b neuter); DRPG.Settings.enforceAnonymity.name "Anonimowe karty postaci", the lockPlayerResources name "na karcie", Trial.presentCopy "na twojej karcie", Audit away title (PL-d: arkusz); Settings.voiceTile.name "Kafel głosu" (glossary kafelek); Season resetCastTitle and the contract rows' "żeton" (glossary token); DRPG.Panel.studentsLeft lacks .few/.many and its .other reads "{n} ucznia"; X12 shapes "przechodzi do: {room}", "Łomot z: {room}"; X13 "Confusion ich nie dosięga"; X4 "Nadal jest w polu - ..."; the safeword card "karta poszła z twojego ekranu"; "Rezygnuję (nic nie schodzi)"; DRPG.Vault.descriptionNote PL "w skrytkach i śladach" (R518 pins the copy).
- Placeholders in quoted messages: both languages write a placeholder as its key's word (*Only name can present right now.*, *Teraz dowody może przedstawiać tylko name.*), with a few Polish ones translated (*imiona*). A convention to settle with the text lines; left as it is.
- DB26 in practice: the Polish writers' skeletons carried the English unit's facts, and for 72 lines of notes the facts were close to the English sentences. The writers wrote from them and the old Polish, never opened the new English; the method still lets the English wording through the facts. For the next line: facts written as claims, not as sentences.

## Needs a local Foundry

- The handbook window's rendering of the new shapes: the appendix (GM 22, player 17) with its `### 22.N` and `#### ... (section 15.N)` headings, the longer tables and the `> [!NOTE]` callouts, in both themes and at narrow widths. Headless has no layout (R111 skipped, `env.layout`).
- Each "?" link lands on its section: every `## N.` and `### N.M` id that stood at the base still stands (no heading number renamed or removed); the new ones are the appendices and their parts. The landing itself is a click at the table.
- A Polish reader at the table: the naturalness read was done by subagents against text-style.md section 12, not by a Polish player.

## Questions, each with the default taken

- Q-H1: the facts files are one per handbook (`docs/handbook-facts.<book>.en.json`), since a facts file names one
  handbook; the plan named one per language. Default: one per handbook.
- Q-H2: the cold reads (GM 5/10, player handbook 6/10, brochure 5/10 before the fix pass) ask for game-mastering
  advice the book never had: a worked first chapter, pacing a day, writing a Motive or a case, how to ask for murder
  consent. That is new content, not form. Default: not written in this line; listed for the owner.
- Q-H3: "since 1.2.113" in the appendices: right for the release this line ships in; the stamps move at release.
- Q-H4: D113 ("the skip order in the budget paragraph") has no text in the repository; read as the order a price
  is paid in (spendAction, takeMove).
- Q-H5: README.md contradicts the handbooks in places the cold read found (the Rebuttal's target, another student's
  Sanity on the sheet, the Key Remnant fee's "fewer than four", where Killing game rules is); the README is not this
  line's to edit.
