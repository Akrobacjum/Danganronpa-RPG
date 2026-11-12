# E92 - status (work line claude/e92)

Updated 12.11.2026. Final: all seven commits in, tested, pushed; the owner fix of 12.11 in; round 3 (the talk switch on the voice tile, the line under the clock and `spectator.move` gone) in. Ships as 1.2.110 (the coordinator). The plan is `docs/dev/plans/E92.md` on `claude/plan-130` (read whole). Base: claude/e61-62 at 59d1935
(E61, E62 and E94). The census of what a Spectator would be counted in: `docs/dev/e92/CENSUS.md`.

## Done

| Plan | What | Commit |
| --- | --- | --- |
| C0 | The census (52 roster calls, 73 `type === "character"` reads, the early returns that decide for a Spectator), each classified; red tests R3850-R3858, R3858 the census's own guard (it fails on an unclassified new read; it caught spectator.mjs's in C4) | 0a0f211 |
| C1 | `FLAGS.spectator` (a GM's flag, `GM_FLAGS`), `isSpectator`, `setSpectator`, `ownSpectator`; the roster and every list the census named leave it out; nobody in the room (`countsAsPresent`, `maybeThirdParty`); a fourth Role in the Students window with a "Spectators" group; glossary "Spectator" / "Widz" | 75839e1 |
| C2 | The microphone held in every phase (`micHold` "spectator", `spectatorAccount`), blocked by the trial's own write and `trialMuteStore` row and put back as found | 83acdee |
| C3 | The ghost: `crossingVerdict`, `judgeMove`, `auditMove`, `recordDiscovery` pass it over; bridge action `spectator.move` (the five steps; 33 legal control, 30 three forged packets; removed in round 3); its token greyed with a dark outline on a GM's canvas; LIVE-E92-01..04 in AUDIT 9.2 | 621d24e |
| C4 | `tokenShownTo`: its token hidden from every other player, its view sees every character; its map the class's ledger folded into its own row without the Mastermind's (`spectatorFogSection`), retold on the flag, unticked on the way back (`forgetSpectatorMap`); scripts/spectator.mjs (a leaf) | 82c988f |
| C5 | `sheetMode` "spectator"; scripts/spectator-ui.mjs: the line under the clock (its room, "Watch a room" picker through `spectator.move`; both removed in round 3) and the hidden chat (`drpg-spectator`, components.css) | e08aaec, b50184f |
| C6 | The Spectators' voice room (`SPECTATOR_ROOM`) behind "Talk with the Spectators" (the player's own User flag, honoured for a Spectator's account alone); the microphone opens there only | c9d0d4b |
| C7 | Scenario 93-spectator (ci); R3861 (E61's entry and cut-in, E62's transitions, E94's board as a Spectator sees them); GM and player handbooks EN and PL | 88343c0 |
| fixes | The module's own censuses given the new roads' rows (R6, R220, R379, R432, R553, R382, R1281 - found by the full tiers 0-1 run at C7); 33's ghost check moved before the phases that take the GMs away | 81c740e, 7f0f2bc |

New files: scripts/spectator.mjs, scripts/spectator-ui.mjs, audit/harness/scenarios/93-spectator.mjs. Their rows in
the code rules file's "Where the code lives" table are not written (that file is not this line's to touch): for the coordinator.

Tests: R3850-R3861 (tier 1, 12 numbers of 50 reserved); tier 2 "a Spectator's microphone is blocked outside the trial
and in it ..."; flow `spectator-move` (partial until its release); scenario checks in 30, 33 and 92.

## Commit ids

The commit messages were reworded once before the first push (a forbidden word stem in C3's and C7's; messages only,
the trees unchanged). The "QUICK GREEN at <id>+edits" lines inside the messages quote the ids from before that: 59d1935
is the base; 0c70a0c = 0a0f211 (C0), 81601e2 = 75839e1 (C1), c5e654a = 83acdee (C2), b0e1d68 = 621d24e (C3), 3f7c65c =
82c988f (C4), afc58ba = e08aaec (C5), 348efde = c9d0d4b (C6), 0cf830a = 88343c0 (C7), 5121cec = 96ebef3.

## Test results

- Tiers 0-1 whole at C1 (75839e1+edits): 1199 ran, 1178 passed, 0 failed, 16 skipped, 6 red (5 E92 markers, 1 E94).
- Scenarios at C1's tree: 30, 33, 10, 12, 13, 11, 15, 17, 19, 20, 40, 41, 60 green; the run was stopped there, as C2-C6 changed more files.
- Scenario 92 at C7: 10/10 (run-all, 15 s).
- The pre-push run at C7 (88343c0), on a worktree: tiers 0-1 1179 passed, 7 failed (the seven censuses above, fixed in
  81c740e), 16 skipped, 1 red; own tier 2 (the Spectator's microphone, "the dead are muted for the trial ...", "Back up
  the case ...") 7 passed, 0 failed; scenarios 92, 30, 00, 10, 11, 12, 13, 14, 15, 17, 19, 20, 40, 41, 50, 60, 61, 62,
  63, 65, 66, 67, 71, 72, 73, 74, 75, 76, 81, 83, 86, 87, 88, 89 green; 33 red ("gm has disconnected": my check after
  its no-GM phases), fixed in 7f0f2bc and green (141 s). These are every scenario `git grep` finds naming a changed
  file, but 01 (the whole suite) and 84 (hangs headless).
- At 81c740e: tiers 0-1 whole 1202 ran, 1186 passed, 0 failed, 16 skipped, 1 red (E94's). At 7f0f2bc: 33 and 92 green.

## Owner fix (12.11.2026, after the owner's review)

The owner: "przyciski karty postaci i dania przedmiotu niech beda w osobnej kolumnie niz imie i nazwisko, zawsze na tej
samej szerokosci". Base first: claude/fervent-sagan-gme4vt (fa73b60) merged in 63d3c9c (conflicts with E61/E62's base
resolved there; the Spectator's scenario renumbered 93-spectator, since the release line took 92). Fix babd4f3: the
Students window's sheet and items buttons in a column "Open" / "Otwórz" of their own, at 5rem fixed, a Monokuma's items
slot kept empty; R3862 (red at 63d3c9c), R2080 and R2083 updated. Measured in Chromium: the same x and width in every row,
97 px under the glass and 89 px under Legacy in both languages. The glass picker's arrow (round 1's open point) is inside
the box: the glass skews the clock; the picker is at most 14rem now.

Results at babd4f3: tiers 0-1 1271 ran, 1256 passed, 0 failed, 16 skipped; own tier 2 (R2080, R2083, E47-T6, "a Students
row opens ...", the Spectator's microphone) 9 passed; scenarios 93, 14, 50, 74, 75 green.

## Round 3 (12.11.2026, the owner's decision after round 2)

The owner: "Usuwamy liste, przycisk przenoszenia sie miedzy czatem spectatorow a sluchaniem dajemy w panelu livekit po
prawej stronie ekranu, tam gdzie reszta przyciskow". Done in one commit (the head of this line, below):

- The line under the clock is gone, its room label and "Watch a room" picker with it (scripts/spectator-ui.mjs keeps the
  body class that hides the chat, and the switch's write `toggleSpectatorTalk`). With no caller left the bridge action
  `spectator.move` is removed whole: wire, row, run, ask, its two reason patterns, `DRPG.Bridge.what.spectator.move`, the
  flow `spectator-move`, 30's and 33's phases, the census rows (R220, R553, R1281) and R3854's half that read it. 30 keeps
  one check: the Spectator's flag a student's console writes is put back. The lang keys removed (`watching`,
  `watchingOutside`, `watchRoom`, `watchLabel`, the bridge's) were this stage's own and never released; no other key is
  touched.
- A Spectator moves by dragging its own token: `crossingVerdict`, `judgeMove` and `auditMove` let it through; Foundry's own
  wall stop on a player's drag is LIVE-E92-02 (rewritten: if v14 stops it, the Spectator does not cross a wall at all, and
  a new road is the owner's to decide). Both handbooks, EN and PL, say so in a sentence, as not yet tried on v14.
- "Talk with the Spectators" / "Go back to your room" is a mini button of the voice tile, after the microphone and the
  speaker (voice-tile.mjs `paintSpectatorTalk`, painted by `paintControls` on every repaint, the user's own flag change
  among them), on a Spectator's browser alone: the same flag (`SPECTATOR_TALK_FLAG`), the same keys, a native button named
  for a screen reader and the tooltip, `aria-pressed`; shown pressed in both themes (components.css).
- Tests: R3863 (no line, no picker, no `spectator.move`; the chat rule kept) and R3864 (the button: place, names, pressed,
  one click, gone off a Spectator's browser, painted by `paintControls`), both red at 56f4dab; R3859 removed (its row kept,
  "removed in E92"); R3860 reads the tile's button; scenario 93's ghost phase drags the token by p3's own write and a new
  phase "talk" presses the button on p3's tile (LiveKit shim installed on p3 and p1, as 75 does, and taken off).

Results before the push: tiers 0-1 whole 1272 ran, 1257 passed, 0 failed, 16 skipped (a first run found R552 and R1333
red, the switch's glyph and the third-button rules' selector: both updated with the reason, then green); own tier 2 (the
Spectator's microphone) 6 passed; scenarios 93, 75, 30, 33, 10, 15, 40, 41, 61, 63, 66, 72, 73, 76, 83, 88 green - every
scenario `git grep` finds naming a changed file, 01 and 84 aside; `node tools/check.mjs` 17 parts green; lint 0 problems.

CI: the push of e574990 queued run 43211150866; cancelled before it started, on the coordinator's word of 12.11 (CI runs
once per release, on the train's PR head; every push carries "[skip ci]" from now on). The local results above stand
in its place.

Defaults taken, owner to confirm:
- Q-E92-9: answered 12.11 ("tak"), written in the handbooks as a known limit: with the GM's `voiceTile` switch off, Foundry's own dock is shown and the module draws no switch there:
  a Spectator has no way to talk with the Spectators then. Putting a button into Foundry's dock would read v14's dock
  markup, not read here.

Measured in Chromium (glass-harness.html, the button added to its tile as `paintSpectatorTalk` draws it): inside the
tile at 1366x768 and 1920x1080 in both themes; under Legacy it touches nothing; under the glass its box meets the
speaker's by 6 px², as the microphone's meets the speaker's (6.24 px², the slanted column), the hexagons apart.

## The owner's verdicts of 12.11 (13:25) and Q-E92-7

Round 3: "AKCEPT", as built at 3f47b45. Q-E92-9: "tak" - no talk button with the voice tile off; both GM handbooks and
both player handbooks say so as a known limit. Q-E92-7: "zgadzam sie, zlecaj" - built:

- bridge-guards.mjs: `notSpectator(field | locate, covers)` (a factory, as `owns`) refuses "that character is a
  Spectator" when the character the packet names is one as the GMs hold its flags (sheet-audit.mjs `flagsHeldNow`);
  `senderNotSpectator` refuses "the sender plays a Spectator" when the sender's account plays a Spectator and no student
  (voice.mjs `spectatorAccount` on the same held flags). A GM is never refused. Both map to a new code of the closed
  list, "spectator", said as DRPG.Bridge.why.spectator ("A Spectator takes no actions." / "Widz nie wykonuje akcji."; trimmed
  12.11 under the owner's text rule).
- Every player row of the four tables (BRIDGE_ACTIONS, TRAP_ACTIONS, SEARCH_ACTIONS, ROLL_ACTIONS) names one, right after `knownSender`: the character's on each row with an owner
  question (`owns`, `ownsActorAt`, the trap report's and the Search's actorId), the account's on the ballot, the vote's
  ask, the Level Up's ask, the readiness answer, a card, a project shared and a tied trace. Six rows need none, each with
  its reason in R3865: note.save, ruling.expired, ruling.received, action.friskAnswer, searchTokens.returnPlant,
  searchTokens.returnToken. A GM's row (gmOnly first) needs none.
- Red first: scenario 30's phase "a Spectator's student actions" (p1's console asks for an Eclipse move, Work on a
  Project, a loot on its Spectator Aiko and a ballot; each refused as a Spectator's, nothing of Aiko's changed) was red
  on 3f47b45 - each refused for another reason, none as a Spectator's - and is green now. R3865 (tier 0): the census, with a
  planted fixture of three faults.
- Census (R3865, read off the tables at run time): 46 rows guard the character, 7 the account, 29 are a GM's, 6 need
  none - 88 rows in the four tables.
- Three tests that pin a row's guards by position moved with the new second guard: R313 (vote.cast), R562
  (passage.share), R598 (passage.find), each with the reason in a comment.
- Results before the push: tiers 0-1 whole 1273 ran, 1258 passed, 0 failed, 16 skipped; own tier 2 (the Spectator's
  microphone, E17-T6) 8 passed; scenarios 30 (275/276, the one expected red the secret door's, as before), 33, 93, 10,
  11, 12, 13, 15, 17, 20, 40, 61, 62, 63, 66, 67, 71, 72, 73, 76, 81, 83, 87 green - every scenario `git grep` finds
  naming a changed file, 01 and 84 aside; the quick gate green. The red run of 30 on 3f47b45 (a worktree, DRPG_REPO) failed
  the new check, and also the secret door's check, which on this tree reads as its expected red; why that one counted as
  failed in the worktree run was not looked into.
- What it does not cover, as before: a Spectator's console's own writes on its sheet are the audit's (sheet-audit.mjs,
  which holds its resources, statistics and module flags as for any player's character), and Daggerheart's relay
  (relay-guard.mjs) is judged by its own table; neither is a bridge action.

## The owner's answers on DRPG-D1 (12.11)

Approved: Q-E92-1, 2, 3, 5 and 8. Changed, three items, built (red first each):

- Q-E92-4, the chat - "Zablokowac; postac widza nie ma swojego czatu". spectator-ui.mjs: the Spectator's own browser
  refuses its message and says "A Spectator has no chat." / "Widz nie ma czatu." (`preCreateChatMessage`, a courtesy);
  every browser leaves a Spectator's message undrawn (`renderChatMessageHTML`); the primary GM removes one (`createChatMessage`)
  by the bridge's own account rule (bridge-guards.mjs `senderNotSpectator`, the flags as the GMs hold them). The chat log
  stays hidden on its browser (components.css). Red at 7d907a7 in scenario 93's "chat": p3's console posted twice, once with
  its own hook taken off, and both messages stayed on the GM's, p1's and p3's browsers; green now: none on any.
  Known limits (GM handbook EN and PL): Foundry broadcasts a created message to every browser before the primary removes it,
  so a console listening at that moment reads it; every public message, Foundry's and the module's, still reaches the
  Spectator's browser, where the log is not drawn. Not done: turning the module's public cards into whispers past the
  Spectators - every reader of a card that takes "no whisper" for public would change with it, a fragile change across
  the module, which the brief says not to build ("Do not build a fragile workaround").
- Q-E92-6, the projects - "Widzi wszystkie projekty w tym prywatne". projects-secrecy.mjs `ownershipMap` makes every
  Spectator's account an observer of every secret project (Daggerheart draws the tray from it), `viewersOf` and
  `sharedIds` leave Spectators out (no share, seal or card counts them in), `canSee` and projects.mjs `knowsProject`
  answer yes for a Spectator in every room, and `tellDescription` whispers a secret project's words to the Spectators
  too. Who is a Spectator is read as the GMs hold the flag (scripts/spectator.mjs `spectatorUserIds`, with sheet-audit.mjs's
  `flagsHeldNow` handed in at registration), so a student's console that writes the flag on itself is shown nothing.
  A role change (monokuma.mjs `setSpectator`) runs projects.mjs `seeAsSpectators`: the users who stopped being Spectators
  are taken off every secret project they do not build, then every secret project is resealed and its words told. Red at
  7d907a7 in scenario 93's "projects" (the Spectator did not see the secret project, its words or its ownership); green
  now, and p1 (a student) knows neither project, holds no words and is NONE in the map; p1's world data is scanned against
  world-secrets.mjs after it. What a student's browser learns: which account is an observer of a secret countdown, the same
  as it learns today of any viewer (the ownership map is a world setting); who is a Spectator is no secret.
  Limit (GM handbook): a Spectator made a student again loses the secret projects it was let in on before it watched
  (its observer entry is not told from a share), and keeps those it builds.
- The token - "transparentny/ledwie widoczny". visibility.mjs `dressSpectator`: the sprite at 0.28 of the token's own
  alpha (`SPECTATOR_ALPHA`, in the owner's 25-30 %), grey tint as before, its outline at 0.3 where it was 0.95. R3866 (red
  at 7d907a7: 0.54 for a token of alpha 0.9; green: 0.252). The shot sent to the coordinator is a reconstruction: the repo's
  own GM screenshot (docs/img/02-gm-view.webp) with a student's token copied beside itself at the module's numbers, not a
  Foundry render (LIVE-E92-04, rewritten for 0.28).

Results before the push: tiers 0-1 whole 1274 ran, 1259 passed, 0 failed, 16 skipped; tier 2 by name (the Spectator's
microphone, E36-T*) 17 passed; scenario 93 15/15; scenarios 30 (275/276, the expected secret-door red), 61, 33, 10, 11, 12,
13, 15, 17, 20, 40, 62, 63, 65, 66, 71, 72, 73, 75, 76, 81, 83, 86, 87 green; the quick gate green.

## The coordinator's follow-up (12.11, written before the DRPG-D1 report reached it)

- The token: 0.3 of its alpha, one constant (`SPECTATOR_ALPHA`), and nothing else - no grey tint, no outline (16ab04b had
  0.28, the tint and an outline at 0.3). R3866 red at 16ab04b, green now. The shot sent with DRPG-D1 shows 0.28 with the
  tint; the new look is not shot (no canvas headless; LIVE-E92-04, rewritten).
- Secret projects: "every project's public face (name, progress) in every room; secret projects stay secret (GMs' half
  untouched)". 16ab04b also whispered a secret project's words to the Spectators; taken out. A Spectator sees each
  secret project's name and progress (its observer entry), not its words or any field of the GMs' store. Scenario 93's
  "projects" now asks for no words on p3: red at 16ab04b (p3 held them), green now. R3867 (tier 1): `ownershipMap` with the
  Spectators handed, and `spectatorUserIds` over stand-ins; red at 16ab04b. A tier-2 test was asked for "what its browser
  holds": tier 2 runs on one browser, a GM's, so a Spectator's and a student's browsers are read in scenario 93 instead.
- The chat: as built in 16ab04b (refused on its browser with "A Spectator has no chat.", undrawn everywhere, removed by
  the primary). There was no GM-side judge of chat messages to put it in; it stands in spectator-ui.mjs.
- Texts trimmed under the owner's rule of 12.11 (short, everyday, nothing about how the module works): the four handbook
  paragraphs (GM and player, EN and PL), the bridge's "spectator" reason, the two voice lines.

Results before the push: tiers 0-1 whole 1275 ran, 1260 passed, 0 failed, 16 skipped; scenario 93 15/15; scenarios 30
(275/276, the expected secret-door red), 61, 65, 66, 72, 13, 40, 62, 75, 76, 81, 86 green; the quick gate green. The shot page
(https://claude.ai/artifact/W4Ua5rfCY4YbPPzR2PZfeA) now shows 0.3 without tint or outline: a reconstruction on the
repo's own GM screenshot, not a Foundry render.

## For the coordinator

- `touches` for E92 in tools/stages.json (yours to write): ["sockets", "scenes"] - the bridge's guard and the chat's
  removal answer sockets; the token's drawing, its moves and the map answer scenes.
- A known-leaks row, proposed (audit/harness/known-leaks.json is not this line's): "a Spectator's chat message is
  broadcast by Foundry's server to every browser before the primary GM removes it (spectator-ui.mjs `dropSpectatorMessage`);
  a console listening for createChatMessage reads it for that moment. Foundry gives a module no way to refuse a player's
  chat document before the server sends it; the Spectator's own browser refuses it first (a courtesy)." Not measured as a
  scan in 72-canary; scenario 93's "chat" reads no message left on any browser after the GMs had it.
- The rows of scripts/spectator.mjs and scripts/spectator-ui.mjs in the code rules file's "Where the code lives" table (not this line's file).

## Review shots

Round 3 (the switch on the voice tile): https://claude.ai/artifact/DHpNXnsctFWBkw1xeTNJVt - both themes, EN and PL, 1366
and 1920, off and on, the GM's tile, and the measurements. Not Foundry; the dock of Foundry is not shown.

Round 2 (the owner fix): https://claude.ai/artifact/BWonLj62dbaAKf8Pv3iejb - the Students window with the buttons' column,
both themes, EN and PL, 1920 and 1280, with the measurements; the Spectator's line under the clock. Under Legacy the
harness draws icons as underscores and the Role and State selects overlap, as on the window's capture from before E92.

Round 1: https://claude.ai/artifact/Hp4fmi4bm5u8gCA2EcnX3S - the Students window with the Spectator's Role (both themes,
EN and PL, 1920 and 1280) and the Spectator's line under the clock (both themes, EN and PL, the switch off and on). Drawn
by the harnesses in headless Chromium, not Foundry. Not shot: the GM's grey token (no canvas; LIVE-E92-04), the sheet's
spectator mode (the style harness does not model it), the hidden chat (no Foundry sidebar). Found by the shots and fixed:
the picker cut short under Legacy (b50184f). Open: under the glass the picker's arrow stands above its box in the harness.

## Defaults taken, owner to confirm

- Q-E92-1: built on today's code; E72's spec should get a row "the Spectator in each new state".
- Q-E92-2: Polish "Widz" (glossary entry; "Obserwator" is Foundry's OBSERVER level - not a forbidden variant, since lang/pl.json uses it for sheet sharing).
- Q-E92-3: one character actor flagged `spectator`, owned by the player.
- Q-E92-4: changed by the owner (DRPG-D1): the chat is blocked, not only hidden (above).
- Q-E92-5: a Spectator may become a student again (and back) in the Students window; its own rows are kept, the class's are unticked for it.
- Q-E92-6: changed by the owner (DRPG-D1): every token in an Eclipse, and every project, secret ones included, in every room (above).
- Q-E92-7: answered 12.11 ("zgadzam sie, zlecaj"), built: the Spectator guard on every player row of the bridge (above).
- Q-E92-8 (new): the "Spectator talk" switch is honoured on the Spectator's document flag in the voice pass (a forged spectator flag on a student, with the switch, sends that student to the Spectators' room, where it is heard); the microphone block itself reads the flag as the GMs hold it.
- Owner's 04.11 plan line "token hidden": done as display (`tokenShownTo`), not Foundry's `hidden`, so the owner can still see and drag it.

## Not done / limits

- Seen once, not reproduced: CI run 43167701858 (push of 3b8d87e) failed one tier-2 test in suite shard 5/8, "an effect a
  player puts on a resource's value or a module flag is put back, as one on a statistic is". It passes alone and in shard
  5/8 run locally at babd4f3 (192 passed, 0 failed), and CI run 43198264490 at 44b1777 is green. Possibly order-dependent.

- LIVE-E92-01..04 (AUDIT 9.2): one LiveKit connection in two rooms, a drag through a wall on v14, the real BROADCAST_AUDIO, the grey token on a real map.
- `forgetSpectatorMap` writes unticks for the character: a GM's Fog tab shows them as unticked cells (as before, not found).
- No `stages.json` row change (the coordinator's); `touches` should be ["sockets", "scenes"] (a bridge action, token moves).

Tokens so far: not measured on this line.
