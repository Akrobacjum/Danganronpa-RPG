# The handbooks line (E25's handbook part, E57 C6-C11) - status

Branch `claude/handbooks-113`, from `claude/fervent-sagan-gme4vt` at 1463f22b (1.2.112), started 14.11.2026.
Files: the six handbooks in `docs/handbooks/`, their facts files, this file and `LABELS.md` beside it.

## Order of the work

| Step | What | State |
| --- | --- | --- |
| 0 | Read: plans E25 and E57 (plan-130), e57-prep, e71's CHANGES and FROZEN, the audit's issue texts (lines-board `issues.json`, `plan.json`) | done |
| 1 | E25's handbook part: contradictions, D13, D14, D5, D33c-D33f, the Polish glossary, features since the plan | done (d8fbb34f D33c; 68f80f8c player and brochure; the GM pair and the tests' D33c forms next) |
| 2 | E57 C6-C8: the English handbooks by the guide | rewritten (1c1d818e); seven reviews (English, cold, mechanics) applied by ten fix agents (GM b2362972, player and brochure next) |
| 3 | E57 C9-C11: the Polish handbooks from the facts and the old Polish | in progress: 21 writers from the facts of the final English (docs/handbook-facts.<book>.en.json, 10246 facts) and the old Polish, never the new English sentences (DB26) |
| 4 | Reviews (English, cold, Polish in three steps, mechanics), labels brought up to date, tier 1 | not started |

## Readings taken at the base (1463f22b, 14.11.2026)

- `wc -l`: GM 1411 / 1411, player 950 / 950, brochure 78 / 78.
- `node tools/check.mjs text`: green; Polish ids, kinds and lines as in English for all three pairs.
- e71's FROZEN.md froze sections for branches open on 13.11. Of them E64, E72, E91, E93, E69, E100 and the gaps,
  dh-212b and project-token-icon lines have shipped (tools/stages.json, 1.2.110-1.2.112); the branch heads that
  still show commits past the base (e61-62, e93, e72, e64, gaps-a, e101, e101b, e64-inv) are the tails of shipped
  work. The plan (E57 C6-C8) rewrites every section, so this line treats the freeze as lifted.

## Tests whose handbook sentences changed (the coordinator's yes of 14.11.2026: test data only, each fact still held)

| Test | Old pinned text | New pinned text | The fact it holds | Red on the old line, green on the new |
| --- | --- | --- | --- | --- |
| R321 (tests-tier0.mjs :13697, :13708, :13709, :13717, :13719) | Polish "GMa" (5 sentences) | "GM-a" (D33c) | the Class Trial's world copy, the dead objector refused, the verdict's runner, Skip once, the Level Up latch | red at d8fbb34f with the old regexes, green after (`run-tests.mjs --tier 1 --only R321`, 14.11) |
| R431 (tests-tier0.mjs :14406, :14408, :14410, :14417, :14418) | Polish "GMa", "GMem", "GMowie" (5 sentences) | "GM-a", "GM-em", "GM-owie" | a rename carries keys, the rename record, the body records, the put-back of a player's mark, one student one witness | the same |
| R321 (tests-tier0.mjs :13687, player `lateBallot`) | "If you connect while a vote is open, your ballot comes as your browser loads" | "... your ballot comes as the game loads" | a late joiner gets a ballot; the browser wording moved to 17.12 (O19) | red at b2362972's tree with the new player text, green after (`--only R321`, 14.11) |
| R1036 (tests-tier0.mjs :17892, player `mutedDead` first pattern) | "... gives it back when it ends - a death nobody has found too" | "... gives it back when it ends\\. It does so for a death nobody has found too" | the dead's microphones off for the trial, an unfound death included (the dash aside split, X4) | the same (`--only R1036`) |

## Where this line follows the UI, not the decision, until the text lines land

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

## Needs a local Foundry

(filled as found)

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
