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

`npm ci` once in this folder (it installs jsdom), then
`node cluster.mjs scenarios/NN-name.mjs [--verbose]`. `DRPG_REPO` points it at
another checkout; by default it boots the one it sits in. Each run writes
`results/<scenario>.json`, which git does not track. Exit code: 0 when every
check passed, 1 when one failed, 2 when nothing ran, 3 when the cluster itself
failed.

`node suite-diff.mjs before.log after.log` compares two runs of
`scenarios/01-runtests.mjs` test by test: a test gone or new, a status or a
reason changed, the order changed. The log keeps the first 30,000 characters of
the suite's text; `--json` compares the two runs' results files instead, where
01-runtests keeps the suite's whole list of results (`evidence.suite`).

## Layers

Every file declares `export const layers = [...]`, written out as a JSON array
so a runner can read it without importing the file: `"ci"` (this harness),
`"local-gate"` (a real Foundry, run by audit/live), both, or `["probe"]` alone
for the tools in `probes/` (see `probes/README.md`). `cluster.mjs` fails a file
that declares none.

## Numbers

A scenario's number is how a comment, a commit and an audit find it a year
later, so a number is never reused or reassigned, and a retired row stays. A new
scenario takes the next free number in its decade - 0x the harness and the
suite, 1x the session and the murder, 2x dice, 3x security, 4x the flows through
a day, 5x language, 6x GM stores and migrations, 7x behaviour and secrets, 8x
several clients and budgets, 9x measurements - and the stage that writes a
planned file flips its row to `exists` in the same commit. A row, its file and
the file's `layers` export must agree: `node tools/check.mjs registry` fails
otherwise, and on a planned row whose stage has shipped. Status is `exists`,
`planned`, `probe` (a tool in `probes/`, never a gate) or `retired`; Stage is the
release or stage the status belongs to.

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
| 10 | scenarios/10-murder.mjs | ci | exists | <=1.2.50 | the crime pipeline on three live clients |
| 11 | scenarios/11-killer-secrecy.mjs | ci | exists | <=1.2.50 | a bystander cannot read the killer or the accomplice |
| 12 | scenarios/12-social.mjs | ci | exists | <=1.2.50 | private rolls, inventory limits, movement and Search between clients |
| 13 | scenarios/13-murder-signals.mjs | ci | exists | <=1.2.50 | what a killing shows four screens; a bystander sees nothing |
| 14 | scenarios/14-quiet.mjs | ci | exists | <=1.2.50 | a redraw that changes nothing writes nothing |
| 15 | scenarios/15-held.mjs | ci | exists | 1.2.58 (E27) | other modules' client settings held on every client |
| 16 | scenarios/16-first-run.mjs | local-gate | planned | E58 | a clean install from the manifest, and the first run |
| 17 | scenarios/17-assistant.mjs | ci | exists | E30 | an Assistant GM (role 3) is a GM, and its relay packets are judged like a player's |
| 18 | scenarios/18-trial.mjs | ci | planned | E40 | the trial with real ballots, a player leak scan after every step (plan v2 calls it 15-trial; 15 is 15-held) |
| 20 | scenarios/20-crit-hope.mjs | ci | exists | <=1.2.50 | a critical pays +2 Hope, a Hope roll +1 |
| 30 | scenarios/30-security.mjs | ci | exists | <=1.2.50 | forged packets and writes change nothing on the GM |
| 31 | scenarios/31-fuzz.mjs | ci, local-gate | planned | E43 | malformed packets to every bridge entry and socket: no write, no GM exception, a refusal with a reason |
| 32 | scenarios/32-case-security.mjs | ci | planned | E43 | the hostile-client matrix, delivery proven before the effect is checked |
| 40 | scenarios/40-flow.mjs | ci | exists | <=1.2.50 | a Daily Life time of day on four clients |
| 41 | scenarios/41-trial-scene.mjs | ci, local-gate | planned | E13 | the Class Trial switches to the fixed hall (the harness needs scene switching first) |
| 50 | scenarios/50-lang.mjs | ci | exists | <=1.2.50 | the Language setting on four clients |
| 51 | scenarios/51-lang-mixed.mjs | ci | planned | E57 | English and Polish browsers at one table |
| 60 | scenarios/60-ledger.mjs | ci | exists | <=1.2.50 | the discovery ledger is a secret per player |
| 61 | scenarios/61-gmstore-case.mjs | ci | planned | E38 | the GM store with a second GM: backup and restore, tombstones, kept ids |
| 62 | scenarios/62-migration-drill.mjs | local-gate | planned | E38 | migrations on copies of real worlds (v1.1.0, 1.2.13, the table's 1.2.56) |
| 70 | scenarios/70-movement.mjs | ci | planned | E39 | the movement rules end to end |
| 71 | scenarios/71-sheet.mjs | local-gate | planned | E45 | the sheet on two accounts on a real v14 |
| 72 | scenarios/72-canary.mjs | ci | planned | E30 | what a player's browser holds: the canary's self-test, and planted secrets at rest (E43 extends it to the season) |
| 81 | scenarios/81-render-budget.mjs | local-gate | planned | E37 | render counts per event on real sheets (E53 compares) |
| 82 | scenarios/82-two-gms.mjs | ci | planned | E38 | two GMs: sync both ways, a change of primary |
| 83 | scenarios/83-roll-integrity.mjs | local-gate | planned | E33 | every forged roll write flagged, every legal path clean |
| 84 | scenarios/84-viewports.mjs | local-gate | planned | E49 | 1366x768, 1280x720, interface scale 80-120% |
| 85 | scenarios/85-chaos.mjs | ci | planned | E38 | reloads mid-vote, mid-incident and mid-card; players going offline |
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

## Probes

Tools, not tests: `probes/README.md`. A probe is never part of a gate, and its
number is not reused for a scenario.

## What the harness cannot do

- **No layout, canvas renderer, fonts, audio or Web Animations.** jsdom lays
  nothing out. A suite test that needs one of these asks the environment first
  and is counted as skipped (`needs`, `scripts/tests-kit.mjs`).
- **CSS** (E30, `lib/css.mjs`). The six stylesheets are attached as one inline
  sheet of `@import ... layer(modules)` in module.json's order, served from the
  checkout (nothing else loads: any other address is a 404), and a client whose
  attach does not complete fails its boot. jsdom's cascade answers: selectors,
  specificity, inheritance, `@media` against its 1024 x 768 window. A custom
  property comes back with its `var()` substituted; a standard property that
  uses `var()` comes back unresolved, as jsdom gives it, and `calc()` or
  `color-mix()` is never evaluated. Whether cascade layers order anything in
  jsdom is not verified; how v14 attaches the sheets is LIVE-E30-09.
- **The permission gate** (`canWrite` in `cluster.mjs`) models ownership and
  roles and little else. From role 3 a user is a GM (`User#isGM`, E30) and
  writes anything but users, and world settings. Users: a Gamemaster (role 4)
  writes any; nobody else creates or deletes one; an update may not set a role
  above the writer's own, and a player updates only itself. A player creates
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
  `userConnected` (LIVE-E30-05); nobody comes back, a role changes only by a
  write, nobody is logged out for it, and there is no `game.users.activeGM`.
  `opLog` and `settingLog` say who wrote what.
- **Daggerheart.** Its GM relay is 2.10.5's own code (`lib/dh-relay.mjs`). A
  trait roll follows 2.6.5 (`lib/daggerheart.mjs`, E30): the config as
  `rollTrait` and `diceRoll` build it, the card, then the resource step
  (`addDualityResourceUpdates`, with its Hope-and-Fear automation gate, reaction,
  `skips`, defeated-actor and reroll rules) into a `ResourceUpdateMap` that the
  caller commits. The dice are the harness's (`__forceRoll`), the Automation
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
- **Versions** (E30, `lib/versions.mjs`). Foundry and Daggerheart are the
  versions `module.json` says the module is verified on; the companion modules
  it requires or recommends take theirs from an installed Foundry when
  `DRPG_FOUNDRY_DATA` points at one (Daggerheart too, then), and from
  `versions.json` otherwise, which holds the audit's reading of an installed
  folder. Every results file records each with where it was read, and the live
  checks not yet run, as `environment`. Refreshing `versions.json`:
  LIVE-E30-08.
- **No client ever reloads.**
