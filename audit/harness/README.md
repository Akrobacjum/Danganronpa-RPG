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

## Layers

Every file declares `export const layers = [...]`, written out as a JSON array
so a runner can read it without importing the file: `"ci"` (this harness),
`"local-gate"` (a real Foundry, run by audit/live), both, or `["probe"]` alone
for the tools in `probes/` (see `probes/README.md`). `cluster.mjs` fails a file
that declares none.

Two scenarios carry `"local-gate"` as well, since E30: 14-quiet and 60-ledger,
the ones whose `run()` asks only for what the sandbox adapter gives
(`audit/live/sandbox-cluster.mjs`: the four clients' `eval`, `check`, `note`,
`phase`, `settle`, `repoUrl`) and which use no harness-only page hook or
verdict option. 11-killer-secrecy was the design's third candidate; it plants
canary markers now (72-canary's machinery), which the adapter does not have.
Neither has run against a real Foundry yet: the local gate records them as not
run until a v14 sandbox exists (audit/gate/README.md).

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
| 14 | scenarios/14-quiet.mjs | ci, local-gate | exists | <=1.2.50 | a redraw that changes nothing writes nothing |
| 15 | scenarios/15-held.mjs | ci | exists | 1.2.58 (E27) | other modules' client settings held on every client |
| 16 | scenarios/16-first-run.mjs | local-gate | planned | E58 | a clean install from the manifest, and the first run |
| 17 | scenarios/17-assistant.mjs | ci | exists | E30 | an Assistant GM (role 3) is a GM, and its relay packets are judged like a player's |
| 18 | scenarios/18-trial.mjs | ci | planned | E40 | the trial with real ballots, a player leak scan after every step (plan v2 calls it 15-trial; 15 is 15-held) |
| 20 | scenarios/20-crit-hope.mjs | ci | exists | <=1.2.50 | a critical pays +2 Hope, a Hope roll +1 |
| 30 | scenarios/30-security.mjs | ci | exists | <=1.2.50 | forged packets and writes change nothing on the GM |
| 31 | scenarios/31-fuzz.mjs | ci, local-gate | planned | E43 | malformed packets to every bridge entry and socket: no write, no GM exception, a refusal with a reason |
| 32 | scenarios/32-case-security.mjs | ci | planned | E43 | the hostile-client matrix, delivery proven before the effect is checked |
| 33 | scenarios/33-bridge-paths.mjs | ci | exists | E31 | every legal road through the GM bridge, and what a player is told when a request is not carried out |
| 40 | scenarios/40-flow.mjs | ci | exists | <=1.2.50 | a Daily Life time of day on four clients |
| 41 | scenarios/41-trial-scene.mjs | ci, local-gate | planned | E13 | the Class Trial switches to the fixed hall (the harness needs scene switching first) |
| 50 | scenarios/50-lang.mjs | ci | exists | <=1.2.50 | the Language setting on four clients |
| 51 | scenarios/51-lang-mixed.mjs | ci | planned | E57 | English and Polish browsers at one table |
| 60 | scenarios/60-ledger.mjs | ci, local-gate | exists | <=1.2.50 | the discovery ledger is a secret per player |
| 61 | scenarios/61-gmstore-case.mjs | ci | exists | E04 | the GM store with a second GM: a late empty browser, backup and restore, tombstones, the reset's cuts |
| 62 | scenarios/62-migration-drill.mjs | local-gate | planned | E38 | migrations on copies of real worlds (v1.1.0, 1.2.13, the table's 1.2.56) |
| 70 | scenarios/70-movement.mjs | ci | planned | E39 | the movement rules end to end |
| 71 | scenarios/71-sheet.mjs | local-gate | planned | E45 | the sheet on two accounts on a real v14 |
| 72 | scenarios/72-canary.mjs | ci | exists | E30 | what a player's browser holds: the canary's self-test, planted secrets at rest, and (E05) a chapter, scanned after every phase with the world-secrets rule; E43 takes it to the season |
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

## What the harness cannot do

- **No layout, canvas renderer, fonts, audio or Web Animations.** jsdom lays
  nothing out. A suite test that needs one of these asks the environment first
  and is counted as skipped (`needs`, `scripts/tests-kit.mjs`).
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
  clockSkewMs })` starts one - with that localStorage before the module loads,
  that `game.world.id`, and a machine clock off by that much while
  `game.time.serverTime` (the server's, here the machine's) is not - and may
  connect again after a disconnect; `storageOf(who)` is a client's
  localStorage, read now or as it closed. The seeded four do not come back, a
  role changes only by a write, nobody is logged out for it, and there is no
  `game.users.activeGM`. `opLog` and `settingLog` say who wrote what.
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
- **Files** (E04). `foundry.utils.saveDataToFile` keeps what it is handed in
  `__savedFiles` on that client instead of downloading it, and
  `readTextFromFile` takes the text itself (or `{ text }`) as the chosen file;
  what a real browser does with either is LIVE-E04-05. v14's world storage
  answers `getSetting(key)` with the stored value or nothing (LIVE-E04-10).
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
  LIVE-E31-02, -03 and -04. A Reroll's receipt is made by rewriting the rolls of
  the player's own roll message, not by `Roll#reroll` (LIVE-E31-01); windows
  close at once, so what `handOff` saves under reduced motion is not measured
  (LIVE-E31-05); and a refusal is read in Polish by a client whose language was
  switched mid-run, not by a Polish player at a table (LIVE-E31-06).
- **No client ever reloads.**
