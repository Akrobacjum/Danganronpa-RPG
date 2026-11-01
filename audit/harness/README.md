# The headless harness

`cluster.mjs` plays the Foundry server - the world store, the permission gate
and the socket relay - and forks one jsdom client per user (`client-entry.mjs`):
a GM and three players, `gm`, `p1`, `p2` and `p3`, and one for each account a
scenario declares (`accounts`; 17-assistant adds an Assistant GM, `ag`, for five
clients). Each client boots this
checkout's module against a shim of Foundry v14 (`lib/shim.mjs`), and a scenario
drives all of them. It is good enough for the rules, the sockets and the DOM. It
is not a browser and it is not v14: what it cannot do is listed below, and each
item that models v14 without having been checked against it names a live check
in `audit/AUDIT-1.2.42.md` section 9.2.

## Running

`npm ci` once in this folder (jsdom, ESLint, espree, and Playwright without a
browser), then `npm test` - `run-all.mjs`: lint, `tools/check.mjs`, the gate's
self-test (`audit/gate`), the suite and every scenario whose layers include
`ci`, each cluster in its own process group, each held to a results file of its
own run and to an exit code that agrees with its verdicts. Parts can be named
(`node run-all.mjs lint check gate` is `npm run quick`) and `--only NN-name`
narrows the scenarios (a name that matches no file in scenarios/ is a usage
error, exit 2, and a part named on the command line that it leaves empty is
red). One scenario by hand:
`node cluster.mjs scenarios/NN-name.mjs [--verbose]`. `DRPG_REPO` points either
at another checkout; by default they boot the one they sit in. Each run writes
`results/<scenario>.json` and run-all also `results/<scenario>.log` and
`results/run-all.json`, none of which git tracks. The cluster's exit code: 0
when every check passed, 1 when one failed, 2 when nothing ran, 3 when the
cluster itself failed.

The lint part also shows `drpg/bridge-result` (E31) - the rule in
eslint.config.mjs that keeps a request's answer where it was asked - its
fixture, `lint-fixtures/bridge-result.mjs`, linted as a file of scripts/
(nothing is written): red unless the rule reports exactly the seven lines the
fixture marks.

`node suite-diff.mjs before.log after.log` compares two runs of
`scenarios/01-runtests.mjs` test by test: a test gone or new, a status or a
reason changed, the order changed. The log keeps the first 30,000 characters of
the suite's text; `--json` compares the two runs' results files instead, where
01-runtests keeps the suite's whole list of results (`evidence.suite`).

`node run-tests.mjs [--tier 0|1|2] [--only <R number or piece of a name>]...
[--verbose]` (INFRA I1) runs the suite's tiers once, on the cluster 01-runtests
boots, without 01's other steps: `game.drpg.runTests({ tier, only, confirmed })`
on the GM, `--tier` 1 when not given, every `--only` handed over as one list, of
which each entry has to name a test in the tiers asked for. It prints the
runner's whole text between the lines suite-diff reads and ends on
`run-tests: P passed, F failed, S skipped, R red`; exit 0 only with nothing
failed and at least one test run, 1 otherwise, 2 on a usage error, 3 when the
cluster left no results file of this run (`results/run-tests.json`, the suite's
list as `evidence.suite`, as 01 keeps it). Measured 18.10.2026 on 4 cores:
`--tier 1` 200-212 s wall in two runs, 449 tests; `--only R553` 11 s, one test.

The suite in shards (INFRA I2): `DRPG_SUITE_SHARD=i/n` before `run-all.mjs
suite` or `cluster.mjs scenarios/01-runtests.mjs` makes the run shard i of n.
`runTests({ shard })` runs tiers 0 and 1 in shard 1 alone, and tier 2's tests
at positions k with 2 + k % (n - 1) = i of the list (after `only`), none in
shard 1 (tests.mjs `shardOfPosition`; INFRA I3, 18.10.2026);
01-runtests runs its parts A and B (tiers 0-1 mid-game, the default, the tier-2
window) in shard 1 alone, asks of its skips only that each is listed in
`skip-baseline.json`, and writes `evidence.shard`: the shard, the tier-2 names it
ran, and the whole list with its length and hash. `node suite-merge.mjs <dir>`
reads every `01-runtests.json` under `<dir>` (CI's verdict job: one folder per
shard, `shards/results-suite-<i>/`) and holds them to the whole suite once: one
list and hash, each name in the shard its position gives it, tiers 0-1 in
shard 1, the skips together exactly the baseline's, nothing failed; exit 1 with
what is missing or doubled, 2 when there is nothing to read. Unset, the run is
1/1, and suite-merge reads its folder as a set of one. Measured 18.10.2026 on 4
cores, at 47a8f4a: shard 1/8 880 s wall, 450 tests of tiers 0-1 with parts A and
B, shard 2/8 336 s wall, 136 of tier 2's 950. With tier 2 dealt over all eight
(k % n = i - 1, until this dealing) shard 1/8 took 1116 s and 2/8 331 s, 119 each;
on CI's first five runs suite 1/8 took 647-952 s and the others 251-365 s.

## The text tools

E65's text lint and the tools beside it live in `tools/` and read the module's
texts in Node, not through the cluster. What they generate goes to
`results/text/` in this folder (ignored by git with the rest of `results/`),
never into the repository; espree comes from this folder's `npm ci`. Each
tool's header says the rest. Measured 01.11.2026 on 4 cores, at E65 C-pilot
(47c18e2b):

- `node tools/check.mjs text` - the lint, a part of `npm run check` and so of
  `npm run quick` and `npm test` (layer `ci`): every detector of
  `scripts/tests-text.mjs` on its fixture, then over the language files,
  config.mjs's English prose, the scripts and every .md under docs/, one line
  each; the glossary, the budgets, the guide's naturalness pairs, the screen
  and audience maps and the pilot's file held to their shapes; each handbook
  split twice. Red on a FAIL detector's finding beyond its baseline, on a
  detector that read nothing and on a fault of a file E65 writes; a report
  detector is never red, and nor is where the pilot's 40 stand in the language
  files (still the before, the after landed, or changed since the pilot: a
  reading). `--lang <dir>` reads en.json and pl.json from <dir>,
  `--all` prints every report finding. It writes no file. 16 s alone; 26
  detectors, report found 3414.
- `node tools/text-map.mjs` - the screen map, which keys each window, card and
  flow says: `results/text/screens.json`. 2.1 s; 146 scripts, 7044 units, 1059
  entry points, 126 screens; 5094 of 5289 keys assigned, 195 not.
- `node tools/text-render.mjs` - every string filled the way a table fills it:
  `results/text/text-render.en.md`, `text-render.pl.md` and
  `text-render.pl.html`. 2.5 s; 4785 keys in each language, 18652 strings,
  fixtures for 241 placeholder names, 0 unknown. `--pilot <file> [--out
  <html>] [--pl-only]` renders the owner's pilot sheet alone,
  `results/text/pilot.html` (or <html>), and refuses a file the pilot's schema
  faults.
- `node tools/text-audience.mjs` - the audience map, who reads each key the
  module posts: `results/text/audience.json`. 3.5 s; 974 sends, 769 with a key,
  93 wrappers; 1219 of 5289 keys assigned.
- `node tools/handbook-facts.mjs split <handbook.md> [--section N] [--out
  <file>]` - a handbook cut into units: `results/text/handbook-units.<name>.json`
  (or <file>); `check`, `count`, `prompt` and `self` beside it. The English
  player handbook: 404 units in 17 sections, 0.04 s.

`check.mjs text` builds the two maps and a render in memory for its own
detectors; the files above are for a reader. The one text file that is
committed is the pilot's working file, `docs/dev/text-pilot.json`, which holds
the owner's verdicts; the handbook facts E57 writes (`docs/handbook-facts.*.json`)
will be the second. These, the guide, the glossary and the budgets are working
papers, kept out of module.zip by `.gitattributes`.

## Layers

Every file declares `export const layers = [...]`, written out as a JSON array
so a runner can read it without importing the file: `"ci"` (this harness),
`"local-gate"` (a real Foundry, run by audit/live), both, or `["probe"]` alone
for the tools in `probes/` (see `probes/README.md`). `cluster.mjs` fails a file
that declares none.

Four scenarios carry `"local-gate"` as well: 14-quiet and 60-ledger since E30,
83-roll-integrity since E33 and 81-render-budget since E37 - the ones whose
`run()` asks only for what the sandbox adapter gives
(`audit/live/sandbox-cluster.mjs`: the four clients' `eval`, `check`, `note`,
`phase`, `settle`, `repoUrl`) and which use no harness-only page hook or
verdict option. 11-killer-secrecy was the design's third candidate; it plants
canary markers now (72-canary's machinery), which the adapter does not have.
None has run against a real Foundry yet: the local gate records them as not
run until a v14 sandbox exists (audit/gate/README.md).

## Numbers

A scenario's number is how a comment, a commit and an audit find it a year
later, so a number is never reused or reassigned once its scenario exists, and a
retired row stays. A planned row's number may move until its file is written:
E09 C0 gave 62 to the investigation and moved the planned migration drill to 63,
when the drill had no file, no run, and its number stood nowhere but this table
(the round-1 review's git grep at f88133d). A new scenario takes the next free
number in its decade - 0x the harness and the suite, 1x the session and the
murder, 2x dice, 3x security, 4x the flows through a day, 5x language, 6x GM
stores and migrations, 7x behaviour and secrets, 8x several clients and budgets,
9x measurements - and the stage that writes a planned file flips its row to
`exists` in the same commit. A row, its file and the file's `layers` export must
agree: `node tools/check.mjs registry` fails otherwise, and on a planned row
whose stage has shipped. Status is `exists`, `planned`, `probe` (a tool in
`probes/`, never a gate) or `retired`; Stage is the release or stage the status
belongs to.

<!-- scenarios:start -->
| No. | File | Layers | Status | Stage | What it asks |
| --- | --- | --- | --- | --- | --- |
| 00 | scenarios/00-boot.mjs | ci | exists | <=1.2.50 | four clients boot, the API and the settings register, a player's world-setting write is refused |
| 01 | scenarios/01-runtests.mjs | ci | exists | <=1.2.50 | the module's suite on the GM: read-only mid-game, tier 2 behind its window, then in full; a player is refused it |
| 02 | probes/02-probe.mjs | probe | probe | E30 | a tool (probes/README.md); the number is not reused for a scenario |
| 03 | probes/03-standalone.mjs | probe | probe | E30 | a tool (probes/README.md); the number is not reused for a scenario |
| 04 | probes/04-music-debug.mjs | probe | probe | E30 | a tool (probes/README.md); the number is not reused for a scenario |
| 05 | probes/05-playsound.mjs | probe | probe | E30 | a tool (probes/README.md); the number is not reused for a scenario |
| 06 | probes/06-runtests-music.mjs | probe | probe | E30 | a tool (probes/README.md); the number is not reused for a scenario |
| 07 | probes/07-apimap.mjs | probe | probe | E30 | a tool (probes/README.md); the number is not reused for a scenario |
| 10 | scenarios/10-murder.mjs | ci | exists | <=1.2.50 | the crime pipeline on three live clients; the death's and the weapon's tie reaching an identified copy at the body's discovery (E09 C4, fix r1-G1) |
| 11 | scenarios/11-killer-secrecy.mjs | ci | exists | <=1.2.50 | a bystander cannot read the killer or the accomplice |
| 12 | scenarios/12-social.mjs | ci | exists | <=1.2.50 | private rolls, inventory limits, movement and Search between clients |
| 13 | scenarios/13-murder-signals.mjs | ci | exists | <=1.2.50 | what a killing shows four screens; a bystander sees nothing |
| 14 | scenarios/14-quiet.mjs | ci, local-gate | exists | <=1.2.50 | a redraw that changes nothing writes nothing |
| 15 | scenarios/15-held.mjs | ci | exists | 1.2.58 (E27) | other modules' client settings held on every client; a GM away and back (E08+E28 C18), and a sheet changed while away (E29 C7) |
| 16 | scenarios/16-first-run.mjs | local-gate | planned | E58 | a clean install from the manifest, and the first run |
| 17 | scenarios/17-assistant.mjs | ci | exists | E30 | an Assistant GM (role 3) is a GM, and its relay packets are judged like a player's |
| 18 | scenarios/18-trial.mjs | ci | planned | E40 | the trial with real ballots, a player leak scan after every step (plan v2 calls it 15-trial; 15 is 15-held) |
| 19 | scenarios/19-standing-cast.mjs | ci | exists | E32+E07 fix r2-G2 | what a player outside the running incident is sent of its cast: one packet, repeated by every GM, no newer than the opening |
| 20 | scenarios/20-crit-hope.mjs | ci | exists | <=1.2.50 | a critical pays +2 Hope, a Hope roll +1; a Reroll into a critical pays the second Hope only with the players' Hope and Fear automation on (1.2.67) |
| 30 | scenarios/30-security.mjs | ci | exists | <=1.2.50 | forged packets and writes change nothing on the GM |
| 31 | scenarios/31-fuzz.mjs | ci, local-gate | planned | E43 | malformed packets to every bridge entry and socket: no write, no GM exception, a refusal with a reason |
| 32 | scenarios/32-case-security.mjs | ci | planned | E43 | the hostile-client matrix, delivery proven before the effect is checked |
| 33 | scenarios/33-bridge-paths.mjs | ci | exists | E31 | every legal road through the GM bridge, and what a player is told when a request is not carried out; a Sabotage of one's own trap leaves a tied trace, of another's an untied one (A14, E09 C5); with no GM connected each road an item takes between two characters settles before it is sent, and a Palm's Steal and Plant before their window and price (E35 C5) |
| 40 | scenarios/40-flow.mjs | ci | exists | <=1.2.50 | a Daily Life time of day on four clients |
| 41 | scenarios/41-trial-scene.mjs | ci | exists | E13 | the Class Trial and the scenes as they are today: an activation followed by every browser, one still loading only warning, a token's `hidden` heard everywhere (S), a hall the GM keeps and `setClock` into the trial (a), a move in the hall (b), the voice rooms (h), `closeTrial` (c), Edit campaign in and out (d), a player loading while the hall is activated (f), no second discovery after the trial (g), End the trial's room and the living gathered there (i), the chapter end in the trial (j), the season reset in the trial (e), Start's lines and the console's door (k) - each check today's reading, naming the E13 commit that changes it |
| 50 | scenarios/50-lang.mjs | ci | exists | <=1.2.50 | the Language setting on four clients |
| 51 | scenarios/51-lang-mixed.mjs | ci | planned | E57 | English and Polish browsers at one table |
| 60 | scenarios/60-ledger.mjs | ci, local-gate | exists | <=1.2.50 | the discovery ledger is a secret per player |
| 61 | scenarios/61-gmstore-case.mjs | ci | exists | E04 | the GM store with a second GM: a late empty browser, backup and restore, tombstones, the reset's cuts |
| 62 | scenarios/62-investigation.mjs | ci | exists | E09 | the investigation with a second GM: three traces (A), a focused Observe any GM picks from a card (O), an Analyze read on the player (N), a reshape ruled once on the primary that leaves the copies already held (T), the GMs' verdicts reaching the copies (V), the dashboard's Save under a reshape (D), the Key fee with and without a planner Save and on the primary (K, P), the chapter end's sweep and reveal (E), and the words: a missed Analyze of a Final and the handbooks' labels (L) |
| 63 | scenarios/63-class-trial.mjs | ci | exists | E10 | the Class Trial with a second GM and a late player: Start on every player (A), the ballots (B), a player who joins after them (C), the GM's reload in the vote (D), the count (E), the verdict's window (F), a wrong verdict while a forged death waits for the audit (G), a second trial in the chapter (H), a correct verdict's Level Ups and a pick through the bridge (I); since E10-E13: a debate on gm2 read on a player whose clock runs fast (J), wrong verdicts on an accused and on a Blackened whose bodies nobody has found (U, V), the copy of the ballots on a GM at the open and one loaded into it (W), the GM's Now on a GM that is not the primary (X), OBJECTION! aimed at the speaker gm2's Room counts (Y); since E70 (1.2.90): the GM's bar on a GM that is not the primary (Z), Overrule from one (O), the debate's question from one (Q), the record's writes and the sentence carried out on the primary whichever GM asks (R) - each check today's reading, naming the commit that changes it |
| 65 | scenarios/65-season.mjs | ci | exists | E11 | the chapter, the body's discovery and the season reset as they are today: two scenes with projects, a duplicate and an orphan token (A), a body found by two, the hold, an Eclipse during it, the trial and a wrong verdict (B), the chapter ended twice and the time moved back past a called assembly (C), a death kept past its chapter and announced in the next (Q), a season played (D), the reset (R), a reset whose chat deletion throws (F), the canvas drawn again on a world already reset (G) - each check today's reading, naming the E11 commit that changes it |
| 66 | scenarios/66-rooms.mjs | ci | exists | E12 | rooms, scenes and floors as they are today: the shim's floors and `Scene#view` (S), a project's manager saved with the GM's camera on the Annex (A), Room Setup applied after the camera moved (B), a Teleport region (C), a room of two pieces locked and walked into (D), what a player knows of a project and the gather with the camera elsewhere (E), an actor on two scenes and a murder judged from the Annex (F), a scene of two floors (G), the room-marking clause (H), a player's jump into a locked room beside a body (I), a region a player draws and a player's untick of a room (J) - each check today's reading, naming the E12 commit that changes it |
| 67 | scenarios/67-trial-modes.mjs | ci | exists | E70 | the Class Trial's tools beside the debate (E70 part 2, 1.2.90): a Testimony on every player with its turn windows, Done and Pass from the players' own pages, an Objection at the speaker and the queue back (T); a Panic Round moved on by the players' browsers while the GM's heartbeat is held, its Objection refused (P); a death nobody has found given no turn, and on the trial's list of the dead on p1's browser - known leak TR30, red on purpose until E72 (part A, formerly E67) (D); the Closing Argument with its volunteers in the GMs' store, a pick, both decisions after an exchange and an Overrule (C); Monokuma's Reveal of a Key nobody found (R); Present's card and copies as shown, with and without the Analyze result (S); a turn's change with the GM's console and a sheet open: the console's region and no sheet rendered, the row's Present painted in place (M, E70-83; its HUD and sheet-pass counts 81's part F since E37); the canary's player scan after every phase |
| 64 | scenarios/64-migration-drill.mjs | local-gate | planned | E38 | migrations on copies of real worlds (v1.1.0, 1.2.13, the table's 1.2.56); planned as 62 until E09 C0 took the number the E09 plan had given its investigation scenario, then as 63 until E10 C0 gave 63 to the Class Trial |
| 70 | scenarios/70-movement.mjs | ci | planned | E39 | the movement rules end to end |
| 71 | scenarios/71-sheet.mjs | local-gate | planned | E45 | the sheet on two accounts on a real v14 |
| 72 | scenarios/72-canary.mjs | ci | exists | E30 | what a player's browser holds: the canary's self-test, planted secrets at rest, and (E05) a chapter, scanned after every phase with the world-secrets rule, and (E06) the chat each phase's bystanders hold, read for the cast and the secret actions' titles; E43 takes it to the season |
| 73 | scenarios/73-notice-history.mjs | ci | exists | E81 | a player's notice history after F5, the GM's own diet |
| 74 | scenarios/74-room-tile.mjs | ci | exists | E77 | the room tile: every browser shows its own character's room, painted once the move has settled (a refused move draws nothing), the GM's text only as text (E77 C3: the GM's Room Setup on the viewer's tile and on no other's, every state a player's tile can take (A), a crossing and a refused crossing (B)); the curtain's cut, also with Foundry's windows open, comes with E77's later commits |
| 75 | scenarios/75-voice-tile.mjs | ci | exists | E78 | the voice tile: who each browser hears in its own LiveKit room, on the harness's LiveKit shim (`lib/livekit.mjs`), which only this scenario installs (E78 C1: the shim measured on its own - a Room on `liveKitClientInitialized`, its participants mapped to users, an `<audio>` for each written from the client settings, a new Room at each connect, and no Room where it is not installed (0)); the tile (A, C3), the microphone (B, C4), the list 'Who you hear', the GM's block and the gear's Voice section (C, C5); the curtain's cut comes with C6 |
| 76 | scenarios/76-passages.mjs | ci | exists | E79 | the secret passages: who may know a passage, read on every surface a browser holds through the passage's own numeric marker, 1234.5 (E79 C0: the marker found on each surface it is planted on, nothing on a browser it was not planted on, the planted dump with the marker taken out read as nothing, and p3's world as found, for the later phases to compare (0)); the copy and its addressees (A, C1), the client's cut (B, C2), the gap and the veto (C, C3), the GM's audit (D, C4), Close, Open and revoke (E, C5), the GM's overlay (F, C6), a player's show (G, C7); since fix r2-G3 the console's create refused where the pick refuses (A), and in G a second GM and a fifth player, both declared late (`gm2`, `p4`): a passage the second GM writes before its stores settle, and a player's reload |
| 81 | scenarios/81-render-budget.mjs | ci, local-gate | exists | E37 | what one event renders and passes on the GM and three players, read off the module's counters, and every token held to a whole pass after each event (E37 C5): a time of day moved and put back one visibility pass a browser and `drpgTimeOfDayChanged` once, a pause none; an Eclipse's start and its end one pass and `drpgEclipseChanged` once each; a Despair write the Monokuma's sheet and no student's, no status strip; a trial turn's change the HUD once and no sheet (67 part M's two counts until E37); an incident's Remnant on the victim's and the killer's screens and not a bystander's, off and back on the killer's at once as the cast copy is taken away and given back, a trace placed meanwhile hidden until it is, and off every player's screen after `endMurder`. Asks only what the sandbox adapter gives (no ids, page hooks or canary); on the harness the sheets are counting stand-ins in `ui.windows`, on a v14 sandbox the module's character sheets (LIVE-E37-01, until the local gate runs it; E53 compares) |
| 82 | scenarios/82-two-gms.mjs | ci | planned | E38 | two GMs: sync both ways, a change of primary |
| 83 | scenarios/83-roll-integrity.mjs | ci, local-gate | exists | E33 | every legal road a player's roll takes read clean (E33 C4), and the five an item takes between two characters - a hand-over, a stash rifled, a Plant, a steal, a body's loot - each asked from a player's page (L12-L16, E35 C5); twelve forgeries from a player's console, each undone or never applied and traced to that player (C5b) |
| 84 | scenarios/84-viewports.mjs | local-gate | planned | E49 | 1366x768, 1280x720, interface scale 80-120% |
| 85 | scenarios/85-chaos.mjs | ci | planned | E38 | reloads mid-vote, mid-incident and mid-card; players going offline |
| 86 | scenarios/86-frame-work.mjs | ci | exists | E88 | the work one event costs every browser, read off the module's counters on a GM and four players with 16 tokens and 30 Remnants: at rest, another player's move, an own move, a Despair write, the clock, a discovery ledger write, under both themes; the counts recorded (E88 C0), and since C1-C4 also held: every browser shows each token as a whole pass would after each event, another player's step costs the others that token's refresh alone, a Despair write renders the Monokuma's sheet and no student's, and on a stand-in renderer that counts its renders the rings and the room outline wear their light drawn once, no live blur at rest (E88 C1, C2, C4); since E89 C0 the mover's own drag on the harness's model of a preview and a slide (20 frames each, on every browser), the same drag as a path of 3 updates, a drag let go of, a slide with `sightRefresh` fired each frame, and Aiko written into another room - each counted on all five browsers under both themes, with `stateHolds` after it (LIVE-E89-02, LIVE-E89-03); and since E89 C1-C4 the same events held to what they now cost: an own move inside the same rooms asks its own token alone, one into another room asks only the tokens it can change (plus Aiko put back into her room), a frame of a drag drops no memo, and `sightRefresh` during a move costs one pass a frame - all counts on the model, not frame times (LIVE-E89-01) |
| 87 | scenarios/87-messenger-sound.mjs | ci | exists | E50 | the messenger and the Sound window on two GMs' browsers and the players' (E50 C1: a thread read only when its window shows it - a Note tab, a window behind another, a hidden page - and the card raised when it does not; a failed send keeps the words; a deleted card leaves every open window; the harness's window in front and hidden page listed as unconfirmed, LIVE-E50-01 and -02; E50 C2: an ask the primary posts from its own session unread on it until read or settled, on gm and gm2, and the roster closing on an outside click after clicks inside, one roster after two opens; E50 C3: a mapping gm2 makes in its Sound window, with no Apply, played by gm after the settle and by no playback call of gm2's, two GMs' rows in one moment both kept, p1's Music slider on Foundry's curve, LIVE-E50-03; E50 fix FG1: a mapping followed by gm2 when gm stops being the primary within the settle, and the cue playlist's mapping dropped by `dropCueMappings()` with its defaults on gm alone; E50 C4: the murder music on four accounts - the same track of 8 for the killer, the victim, gm and gm2, none for a bystander, the band naming it, a Music slider moved in the incident kept after it and no `musicDuckedFrom` written; the Take on a body opened again after a refusal and with no GM, shut after a take, one packet for two presses; the "sound" flow - a GM's sound for p1 played on p1 alone, a player's forged `playSfxFor` nowhere, counted by `sfx.played`); gm2 a second GM, so not in the local gate |
| 88 | scenarios/88-flow-length.mjs | ci | exists | E51 | how long the main flows are (E51 C8; E51-49): Search, Observe, Analyze, a Hope Call, a Dynamic action, the Refund, the trial console's mode bar a mode at a time, the verdict and the Level Up driven on the clients that do each part, every DialogV2 window drawn and pressed by the scenario's own person, the clicks and the windows counted on every browser and held, by the GM's side and the players', to `flow-length.json` (above it a step was added, below it the baseline is lowered in the same commit; `DRPG_FLOW_LENGTH_WRITE=1` writes it); the CI's layer alone, as it needs `__dialogWindows`, `__dialogAnswers` and `__forceRoll`, and the counts at a table are LIVE-E51-06 |
| 90 | - | - | retired | E30 | results/90-a11ycost.json came from a scratch scenario outside the repository; not reused |
<!-- scenarios:end -->

## Checks

`check(name, ok, details, opts)` records one verdict. `phase(name, { flow })`
names the stretch of a scenario that follows and the flow of
`scripts/tests-flows.mjs` it drives, and every check after it carries both
(`opts.flow` overrides it for one check); the results file sums checks and
failures per flow (`flows`) and per phase (`phases`), and a flow the checkout
does not know is a failed check. A flow names the scenarios that drive it only
when their runs show checks under it; `node tools/check.mjs registry` holds the
names to this table and to the tags, and the suite's R160 holds every GM-bridge
action and socket listener to a flow.

A check that is red on purpose says so in its options, never in its name:
`{ knownLeak: "S04-02", measured }` names an entry of `known-leaks.json`, and
`{ expectedRed: { stage, why }, measured }` a red that is not a leak. `measured`
is required with either: it is the check's precondition, true only when the
check reached what it measures, and the precondition is also a check of its
own, so a red can only mean the thing it names. The verdict is
`tools/stages.mjs`'s: a measured failure of a live entry is `expectedRed` (printed
`RED*`, not counted as failed); a check that stopped failing, whose entry is
unknown, whose precondition failed, or whose closing stage has shipped is a
failure. The summary keeps its prefix - `[cluster] 9/10 checks passed, 1 expected
red (S04-02 until E06), 0 failed in 3963ms` (11-killer-secrecy, 25.09.2026) - and
the exit code is 1 only when
something failed. The results file counts `passed`, `expectedRed`, `failed` and
`total`, and lists `knownLeaks` with their verdicts. Run against another tree
(`DRPG_REPO`), whose scenarios may predate the registries, a labelled check
counts as a plain one.

## The canary

What a player's browser holds is read whole, not asked about field by field
(`lib/canary.mjs`, E30). A scenario plants a marker with
`canary.marker(seed, { allowed })` - a seed of `SEEDS`, the field it goes in and
who may hold it - and `canary.scan({ phase })` reads every player's browser for
the markers: each client records everything that arrives as Foundry traffic, in
order and with the phase, and `dump(who)` returns that record with the world's
documents, world and client settings, both storages, the page, notifications,
dialogs and the client's console. A marker where it may not be is a hit; a hit
that an entry of `known-leaks.json` describes (its `match` rules) is that leak
and turns the entry's check red until its stage, any other fails the scan. Each
marker must be on the GM before any player is read, or the scenario wrote it
where nothing reads it; a scenario sends no marker to a client that may not hold
it (the eval refuses); and after the run the canary scans once more if something
was planted since, and fails any entry named to be detected here that no scan
evaluated. `72-canary` shows each surface being read, with a leak planted on
purpose coming back as a hit, before it plants the module's secrets.
13-murder-signals and 60-ledger have phases and no markers: their secrets are
who and where rather than words, and their own checks stay until E43 adds
identity markers. The results file records `canary`: markers planted, scans,
every hit with the entry it matched, and what is not read (IndexedDB, Cache
Storage and cookies, state that never touched the wire, the canvas, audio).

## Probes

Tools, not tests: `probes/README.md`. A probe is never part of a gate, and its
number is not reused for a scenario.

The edges of the Stained Glass controls (E89 C5, the owner's Q-E89-2) are read by
`node audit/glass-sweep.mjs --edges --chromium <executable>` from the repository root, not
here: Chromium, not jsdom. It loads `audit/glass-harness.html?gmp=1` (a copy of the GM Panel's
window and four of its tiles, off by default) at each of the sweep's sizes in both themes, takes
30 screenshots with the board still and 30 with it redrawn on every frame (`?mover=1` or
`__mover.start()`), and counts per selector the edge pixels whose contrast falls under half of
the control's median: under half in every frame (`steady`) or in some (`flicker`). Its control,
a 0.5 px clip on one tile's right edge, must be counted or it exits 1. Software Chromium is not
a table's GPU: a count is a shape, and a zero is not a table's picture.
`--edge-frames <n>` (default 30) sets the screenshots of each kind, and `--edge-sel <part>|<part>` keeps only
the selectors that contain one of its parts, to read one tile; with it the control is run only when it
stands on a kept tile, and the output says so when it is not (LIVE-E89-04).

The messenger's roster and window beside the voice tile (E50 C2, E50-14) are read by
`node audit/glass-sweep.mjs --roster --chromium <executable>` from the repository root, instead of the sweep: at
1366x768 and 1920x1080 by default (`--sizes`), in both themes and as GM and player (`--themes`, `--roles`), the page
draws the GM's roster and a messenger window where one with no saved place opens, and a size fails where either
shares a point with the tile or its portrait at which it is not on top. Its control - the roster's z-index set under
the tile's at the first size where the two meet - must read covered points (`--no-control` leaves it out). These are
the glass harness's stand-ins, not the module's own render and not v14 (LIVE-E50-06).

## Daggerheart's dice

From E33 C2a (07.10.2026; the owner's decision P6 of 06.10.2026) the duality roll
the module finds at `game.system.api.dice.DualityRoll` is Daggerheart's own, as
its GM relay is: a model of it can be wrong in the module's favour. Where each
part of a roll comes from:

- **Daggerheart's code, copied verbatim** - `lib/dh-dice/dice/`: baseRoll.mjs,
  dhRoll.mjs, d20Roll.mjs, dualityRoll.mjs, helpers.mjs and die/ (_module,
  baseDie, dualityDie, hopeDie, fearDie, advantageDie, disadvantageDie), from
  tag 2.10.5 (commit 6bf4b69f98), `module/dice/`. Each is the file byte for
  byte under a header; never edit one, re-copy them on an upgrade. Lint skips
  them as it skips dh-relay.mjs (eslint.config.mjs). The licence:
  `lib/dh-dice/LICENSE`. A copy checks against the tag's file with
  `sed '1,/^ \*\/$/d' <copy> | tail -n +2 | cmp - <tag>/module/dice/<file>`.
  A line number a comment cites in one of them (`dualityRoll.mjs:125`) is the
  tag's; the copy's is 16 further on, past the header.
- **Foundry's, shimmed** (`lib/shim.mjs`): the roll (`parse`, `getFormula`,
  `formula`, `clone`, `reroll`, `fromData`, `toJSON`), the terms (a die keeps
  `kh`/`kl`; `isDeterministic`; an operator's spaced formula),
  `CONFIG.Dice.randomUniform` and `termTypes`, `foundry.utils` (`deepClone`
  hands a class instance back as it is, as Foundry documents it - lib/futil.mjs,
  since C2a's A2), and `String#capitalize` and `Number.isNumeric`
  (client-entry.mjs). Written from Foundry's documented behaviour; Foundry's
  source is not on this machine, so none of it is measured against Foundry. A
  die runs no modifier but `kh`/`kl`, and on these rolls no other changes a
  result (baseDie.mjs:4-12 and what each names, read 07.10.2026): `h` and `f`
  only set Dice So Nice's sound on the Hope and the Fear die
  (`setDualityTriggers`), `a` and `d` name methods `BaseDie` does not define,
  and `sc` and `c`, which do change results, are put on by none of the copied
  rolls. The letters stay on the dice and in the formula.
- **The harness's glue** - under `lib/dh-dice/`, at the paths the copies
  import: `applications/dialogs/d20RollDialog.mjs` (since E33 C2b a stand-in
  shaped as the window - its config, its roll, the markup the module's hooks
  read and its actions, the hooks fired through the shim's render and close;
  its header says what it leaves out; since E16 p1 C0 its Roll is greyed out
  from the costs and uses against the actor's resources, as 2.10.5's
  `_prepareContext` greys it, by a wrap client-entry.mjs `wrapWindowCosts`
  puts on the class at boot - an assumption about the table's Daggerheart that
  LIVE-E16-01 checks), `helpers/utils.mjs` (two of Daggerheart's helpers, and two that throw
  if a copy ever calls them), `data/action/baseAction.mjs` (the
  `ResourceUpdateMap` of `lib/daggerheart.mjs`); in client-entry.mjs
  (`installDualityRoll`): the roll and the dice registered where Daggerheart
  registers them, no triggers, no countdowns, the config ids the copies read,
  and two seams assigned on the class - `buildEvaluate` (Daggerheart's own,
  with the randomiser scripted by `__forceRoll`) and `toMessage` (the
  harness's card); and the roll data's `rules.dualityRoll` and `system`
  (`getRollData`).

So the roll's construction, formula, advantage dice and their faces, `fromData`,
the summary its throw leaves in the config, `extraDice`, the resource step
(critical.mjs's patch of it included) and a live reroll's settlement run for
real, and the window's choices reach them as its actions make them (E33 C2b).
Not run: the window's form (a select changed, a formula typed), its chat card,
triggers and countdowns, anything read off the roll data's `parent` but the
window's costs (no effect makes a critical certain, no rally die), and every
roll at a table.

## What the harness cannot do

- **No layout, canvas renderer, fonts, audio or Web Animations.** jsdom lays
  nothing out. A suite test that needs one of these asks the environment first
  and is counted as skipped (`needs`, `scripts/tests-kit.mjs`).
- **The fog's texture is never built** (E11 fix r2-J1). The shim's
  `canvas.app.renderer` is a screen size and a view, with no `render()`, so
  every fog redraw logs the module's own "Could not build the fog texture"
  (`renderer.render is not a function`, fog.mjs `buildFogTexture`'s catch):
  counted in the fast set's logs of 90c1692 (e11run/r2h6, 11.10.2026), 9 at
  the boot of the four clients, 220 in all of 65-season, 185 in 30-security,
  111 in 40-flow. It is left an error, not stubbed: a `render()` that drew
  nothing would let a fog check pass by measuring nothing (CLAUDE.md), and the
  catch is what a table whose renderer failed would log. The fog's checks read
  its ledgers, its regions and its listeners, never pixels; 65-season V3 counts
  a different message (the fog's "reveal on arrival").
- **CSS** (E30, `lib/css.mjs`). The six stylesheets are attached as one inline
  sheet of `@import ... layer(modules)` in module.json's order, served from the
  checkout (nothing else loads: any other address is a 404), and a client whose
  attach does not complete fails its boot. jsdom 30.0.1's cascade answers:
  selectors, specificity, inheritance. It applies a media list only when the
  list is empty, `all` or `screen`: every feature query (`max-width`,
  `prefers-color-scheme` ...) reads false whatever the window, the imports'
  `layer(modules)` is read as no layer, and `@supports`,
  `@container` and `@layer` blocks are not read at all (measured in the E30
  review, 25.09.2026: the module's 28 feature `@media` blocks, its `@container`
  and its `@supports` all stay unapplied headless). A custom property comes back
  with its `var()` substituted; a standard property that uses `var()` comes back
  unresolved, as jsdom gives it, and `calc()` or `color-mix()` is never
  evaluated. How v14 attaches the sheets is LIVE-E30-09.
- **The permission gate** (`canWrite` in `cluster.mjs`) models ownership and
  roles and little else. From role 3 a user is a GM (`User#isGM`, E30) and
  writes anything but users, and world settings. Users: a Gamemaster (role 4)
  writes any; nobody else creates or deletes one; an update may not set a role
  above the writer's own (a ForcedReplacement counts as the role it puts in; a
  ForcedDeletion of the role, or a role that is not a number, is refused), and
  a player updates only itself. A player creates
  chat messages and changes or deletes its own, updates an actor it owns and
  creates, changes or deletes that actor's items and effects, and moves the
  tokens of such actors; everything else is refused. The rest of v14's
  permission matrix is not modelled (`User#can` is `isGM`), and the role rules
  are from memory, not v14's source: LIVE-E30-04.
- **Pre-update steps** (E30). A document's `_preUpdate` and then the
  `preUpdate` hook get the update itself (expanded, with its `_id`) and one
  options object; what they leave is what is sent, false from either cancels,
  and an update they empty is not sent. Until E30 the hook got a copy, and a
  guard's edit was written anyway (measured: resource-guard.mjs emptied a
  player's Stress edit, and the GM's copy still went from 0 to 5). The order of
  the two steps and the empty update are recalled, not read: LIVE-E30-03. The
  server does not diff: an update that changes nothing is still broadcast and
  fires the update hooks.
- **Operators** (E30). A key spelled `-=key` or `==key` changes nothing and is
  reported: on the log, as `legacyKeys` in the scenario api and as
  `legacyKeysIgnored` in the results file. `ForcedDeletion`, `ForcedReplacement`,
  `_del` and `_replace` delete and replace. All of it is modelled from the
  module's own measured notes and from Daggerheart's use of them, not from v14's
  source, and the wire form they travel in is the harness's own
  (`lib/operators.mjs`). Not confirmed on v14: LIVE-E30-01 (what `-=` does),
  LIVE-E30-02 (the operator API), LIVE-E30-03 (what a hook's `changes` holds).
- **Users.** Four are seeded (a GM and three players), and a scenario adds more
  with `accounts` (E30). Each is connected until a scenario calls
  `disconnect(who)`, which ends that client and tells the others through
  `userConnected` (LIVE-E30-05). An account declared `late: true` (E04) is
  seeded inactive and has no client until `connect(who, { storage, world,
  clockSkewMs, modulesOff })` starts one - with that localStorage before the module loads,
  that `game.world.id`, a machine clock off by that much while
  `game.time.serverTime` (the server's, here the machine's) is not, and those
  companion modules switched off (E13 fix r1-F3: the module stops there) - and may
  connect again after a disconnect; `storageOf(who)` is a client's
  localStorage, read now or as it closed. The seeded four do not come back, a
  role changes only by a write, nobody is logged out for it, and there is no
  `game.users.activeGM`. `opLog` and `settingLog` say who wrote what.
- **Daggerheart.** Its GM relay is 2.10.11's own code (`lib/dh-relay.mjs`,
  re-copied in E75 C1), and its duality roll is 2.10.5's own code since E33 C2a
  ("Daggerheart's dice" above, with C2b's
  glue window, which the module's roll hooks run on unchanged); scenario 83 drives
  every legal road of a player's roll on it and on `audit/live/sandbox-cluster.mjs`
  alike, taking only what both hand a scenario. A trait
  roll's config is built as 2.6.5's `rollTrait` and `diceRoll` build it
  (`lib/daggerheart.mjs`, E30), the card is the harness's, and the resource step
  (`addDualityResourceUpdates`, with its Hope-and-Fear automation gate, reaction,
  `skips`, defeated-actor and reroll rules) fills a `ResourceUpdateMap` that the
  caller commits. The faces are scripted by `__forceRoll`, the Automation
  setting is Daggerheart's own shape (the seed turns `hopeFear` on for both), and
  `CONFIG.DH.RESOURCE` is built as Daggerheart builds it. A commit is the
  actor's `modifyResource`: a GM or an Assistant writes the change, anybody else
  sends it to the GM relay as Daggerheart's `emitAsGM` does (Fear through the
  Fear tracker's `updateFear`), and it returns before the write lands. There are
  no Daggerheart sheets, roll dialogs or roll hooks, countdown ticks or windows,
  triggers, domain cards, damage, armour or item costs.
- **Every chat message reaches every client**, whispers included, as on v14;
  the shim's `ChatMessage#visible` decides what shows. A socket packet reaches
  only its `recipients` when it names them.
- **Client settings** live in each client's jsdom `localStorage`, as JSON, as
  Foundry keeps them (E30), and `game.settings.storage.get("client")` is that
  storage: a test that removes its own key from `localStorage` removes the
  setting. Each client process has its own, for one run; jsdom's quota applies.
- **The world, read by the harness** (E30). `__harnessWorldState()` on a client
  returns its world settings, its client settings and every document's source,
  read from the shim's own stores. 01-runtests compares two readings around a
  read-only suite run, independently of the suite's `worldDump`. Documents
  carry `metadata.embedded`, as Foundry's classes do.
- **Languages.** The harness loads this module's `lang/en.json` and no other
  package's language file, so another module's keys stay unresolved.
- **Dialogs** are answered from a queue, or drawn as real windows on the GM
  when a scenario asks (`__dialogWindows`).
- **Files** (E04). `foundry.utils.saveDataToFile` keeps what it is handed in
  `__savedFiles` on that client instead of downloading it, and
  `readTextFromFile` takes the text itself (or `{ text }`) as the chosen file;
  what a real browser does with either is LIVE-E04-05. v14's world storage
  answers `getSetting(key)` with the stored value or nothing (LIVE-E04-10),
  and since E16 fix r1c-G1 with `_stats.lastModifiedBy`: the user whose write
  the server last applied (cluster.mjs `settingWriters`; null for a value the
  seed wrote). That v14 stamps a Setting so is modelled, not read: LIVE-E16-04.
  Since E16 fix r1e-G1 a world setting written with the JSON it already holds
  (key order too) is an empty diff: not applied, not broadcast, no
  `updateSetting` or `onChange`, no `settingLog` row, and its writer stays the
  last real one - v14 drops an update that changes nothing, recalled, not read
  (LIVE-E30-03, LIVE-E16-04). A document's update is still not diffed here.
- **The GM store at a real table** (E04). Late GM accounts (`connect`,
  `disconnect`, `storageOf`) are clients on one machine: `game.time.serverTime`
  is that machine's clock and a client's skew moves its `Date.now` alone
  (LIVE-E04-01); how long a GM takes to have the others' copies, and the largest
  `gms.state` part a real server carries, are LIVE-E04-02; the bytes a table's
  world puts in localStorage and one flush's time, LIVE-E04-03; a socket that
  drops and comes back without a reload is never modelled (LIVE-E04-04). The
  upgrade on the owner's world copy (LIVE-E04-06), whether Duplicate World gives
  the copy its own world id (LIVE-E04-07), the brief's live verify with a
  murder open (LIVE-E04-08), the reset refused on an Assistant and the offline
  GM cut at its next login (LIVE-E04-09) and two tabs of one browser writing at
  once (LIVE-E04-11) are for a table. A client that joins is announced to the
  others only once it is ready; whether v14 fires their `userConnected` before
  its listeners exist is LIVE-E04-12.
- **What E05 moved out of world data** (E05, 1.2.64). A player's console is
  stood in for by 72-canary's world scan (`lib/canary.mjs` `worldScan`, against
  `scripts/world-secrets.mjs`) on this Foundry shim's world: LIVE-E05-01. The
  1.2.64 lifts run on world data the suite and the scenarios plant, not on a
  table's world (LIVE-E05-02); v14's `ForcedReplacement` and `ForcedDeletion`
  are `lib/operators.mjs`'s model (LIVE-E05-09). The crossing card's timing
  (LIVE-E05-06), the owed Despair reaching every HUD (LIVE-E05-07), the verdict's
  pickers with their sound (LIVE-E05-08; windows answered from a queue) and a
  note that waits for a GM in either order of `connect` (LIVE-E05-10) are this
  machine's. Not modelled at all: the dead marker at the publication and on a
  lone finder's screen, and a found trace's drawn name and image (no canvas:
  LIVE-E05-03, -05); the victim leaving the room's voice (no LiveKit:
  LIVE-E05-04); avclient-livekit's own setting, whose shape was read from its
  source (LIVE-E05-11).
- **LiveKit** (E78 C1, `lib/livekit.mjs`). A scenario that asks
  (`__liveKit.install` in an eval; 75 alone) gets avclient-livekit's client as
  the voice tile reads it: a `Room` that emits `activeSpeakersChanged`, the
  participant events and `disconnected`, a new Room at each connect, and an
  `<audio>` per remote user whose volume and mute every attach writes from the
  client settings. Its names are the A9 design's reading of avclient-livekit
  0.6.8 (not re-read here); real audio, how late a speaker is named, the hidden
  dock at a table and audio after F5 are LIVE-E78-01, LIVE-E78-02 and the
  owner's T1 (LIVE-E78-10).
- **Secret passages** (E79, 1.2.79). Foundry's move backend is `lib/shim.mjs`'s
  `CONFIG.Canvas.polygonBackends`, written from the design's reading of
  Foundry 14.365, not copied from it: whether v14 cuts a passage's wall for a
  drag, the ruler, the keyboard and an update from code is LIVE-E79-01, and
  the GMs' audit at a table, with a GM on another scene and with floors, is
  LIVE-E79-02 (`sendBack` mode only after it, LIVE-E79-07). Two floors with
  Isometric Perspective, a show between two players, the gap, the overlay and
  the list as drawn, and the GMs' two-click pick are LIVE-E79-03 to -06, and
  a Monokuma's token, or a GM's own drag, through a passage is LIVE-E79-08. What
  a player with a console always sees of a passage is two Foundry limits in
  `known-leaks.json`, read in 65-season X: a token crossing its wall, and a
  room whose only way in is one.
- **Versions** (E30, `lib/versions.mjs`). Foundry and Daggerheart are the
  versions `module.json` says the module is verified on; the companion modules
  it requires or recommends take theirs from an installed Foundry when
  `DRPG_FOUNDRY_DATA` points at one (Daggerheart too, then), and from
  `versions.json` otherwise, which holds the audit's reading of an installed
  folder. Every results file records each with where it was read, and the live
  checks not yet run, as `environment`. Refreshing `versions.json`:
  LIVE-E30-08.
- **The bridge at a real table** (E31). The socket is a relay between
  processes on one machine, so a request's two clocks - the GM's "got it"
  within `TIMING.ackMs`, its answer within its declaration's `timeoutMs` -
  never meet a real server's latency:
  how long a request waits for its answer behind queued project writes (a
  queued request is acknowledged as it arrives), a GM who leaves mid-request
  and a planted item that arrives after its five seconds
  (taken back while the GM's client accepts it, `TIMING.plantWindowMs`) are
  LIVE-E31-02, -03 and -04. A Reroll is made on the GM over the harness's own
  roll, not Daggerheart's `Roll#reroll` (LIVE-E31-01, LIVE-E08-01); windows
  close at once, so what `handOff` saves under reduced motion is not measured
  (LIVE-E31-05); and a refusal is read in Polish by a client whose language was
  switched mid-run, not by a Polish player at a table (LIVE-E31-06).
- **No client ever reloads.**
