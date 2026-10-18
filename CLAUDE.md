# Working in this repository

This file is for whoever is next in here, human or otherwise. It is not a tour
of the code - the code explains itself at length, and that is deliberate. It is
the short list of things that are easy to get wrong here and expensive to get
wrong twice.

## The one rule the rest follow from

**Measure, then say.** Nearly every long comment in this module ends in a
number, a date and often somebody's name, because nearly every one of them
replaced a plausible guess that turned out to be wrong. A claim in a commit
message, a code comment or a report is a claim somebody will rely on a year
later without re-checking it.

Two ways this has actually failed, both recently, both worth not repeating:

- A test can pass by measuring nothing. `stackShapes` was written, the
  self-check reported zero failures, and the reason was that the block list it
  checked was empty - a property was read under the wrong name. The screenshot
  found it; the numbers said everything was fine.
- A reason written on a bucket of known failures is not the same as a reason
  that was checked. Twelve tests failed on every headless run under the label
  "these need a real canvas". Four of them did not need one, and one of those
  had been telling the truth about a real geometry question for a year.

If a claim cannot be measured, say that instead of rounding it up.

## Running things

| What | How |
| --- | --- |
| The suite, in Foundry | `game.drpg.runTests()` in the console, as GM: tiers 0-1, read-only; `runTests({ tier: 2 })` also writes, and asks first in a window |
| The harness, first time | `cd audit/harness && npm ci` - installs jsdom, ESLint, espree and Playwright (no browser); boots the checkout it sits in, or `DRPG_REPO` |
| Everything CI runs | `npm test` in `audit/harness`: lint, `tools/check.mjs`, the gate's self-test, the suite and every scenario whose layers include `ci`. 38m13s here (05.10, 4 cores, 17 scenarios); exit 1 on anything red |
| The quick part | `npm run quick` - lint, the checks and the gate's self-test, 9-13 s here; `npm run lint` and `npm run check` alone |
| The suite, headless | `npm run suite`, or `node cluster.mjs scenarios/01-runtests.mjs` |
| Tiers 0-1, or a few tests by name, headless | `node run-tests.mjs --tier 1` in `audit/harness`: 200-212 s here (18.10, 4 cores, 449 tests); `--tier 2 --only R553 --only "<piece of a name>"` runs only those, `--only` as often as wanted; the runner's text, then `run-tests: P passed, F failed, S skipped, R red`; exit 1 on a failure, on nothing run and on an `--only` that names nothing in the tiers asked for |
| The suite in shards, and the shards together | `DRPG_SUITE_SHARD=i/n node run-all.mjs suite` in `audit/harness` runs shard i of n: tier 2's tests at positions k with k % n = i - 1, and tiers 0-1 with 01-runtests' parts A and B in shard 1 alone (CI runs 8); `node suite-merge.mjs <dir>` holds every `01-runtests.json` under `<dir>` to the whole suite once - the list's hash, each tier-2 test in its shard, tiers 0-1 in shard 1, the skips exactly `skip-baseline.json`'s, failed 0 - and exit 1 names what is missing or doubled. Here (18.10, 4 cores): shard 1/8 1087 s wall, 449 tests of tiers 0-1 and 119 of tier 2's 950, with parts A and B, shard 2/8 325 s wall, 119 of tier 2's 950 |
| One scenario | `node cluster.mjs scenarios/40-flow.mjs` (add `--verbose` for per-test lines); `node run-all.mjs scenarios --only 40-flow` also holds it to a fresh results file |
| Every scenario | `npm run scenarios`: the rows with layers `ci` in `audit/harness/README.md` |
| One check | `node tools/check.mjs <part>`: stamps, notes, dashes, parity, prose, names, moves, contract, registry, stages, tree, gatecode |
| Whether a commit only moved code | `node tools/moved-only.mjs HEAD~1` - every line moved, promoted, an import or a header; every top-level statement of the files it touches the same tokens at both ends, comments aside; every name read means what it meant (an alias by what it reads, not by its name), and none written became an import; a facade's exports unchanged, each the same declaration, and no name a file stops exporting still imported by a file of scripts/ or audit/harness (statically, or through the import() forms its header names); no import of a module the family did not load, and none for side effects alone; a cut a tier file reads by name, as a table's key, through the bridge crawls or through R290's crawl unchanged, and every function those crawls cut still cut by them. It reads text and scope, not what the code does when it runs. Its planted pairs alone: `node tools/check.mjs moves` |
| The Polish file | `node tools/check.mjs prose` - must read N/N, 497/497 on 24.09 |
| The local gate | on a machine with a Foundry v14 sandbox at :30099, `npm run gate:local` (`audit/gate/README.md`) |
| What a player's roll may do, and what a console's forgery may not | `node cluster.mjs scenarios/83-roll-integrity.mjs` - every legal road clean, each forgery traced; in `npm test` and the local gate since E33 |
| An investigation, end to end, with a second GM | `node cluster.mjs scenarios/62-investigation.mjs` - traces, Observe, Analyze, a reshape, the dashboard's Save, the Key fee and the chapter's end on the clients that do each part, and the handbooks' labels; in `npm test` since E09 (not the local gate: it needs `gm2` and page hooks the sandbox adapter lacks) |
| The curtain, without Foundry | `python3 -m http.server 8765` then `/audit/glass-harness.html` |
| The curtain at 23 sizes, in Chromium | `node audit/glass-sweep.mjs` - both themes at each size: the self-check where glass is drawn and the corner's three launchers, after planting each fault the count must see, then the notice stack against the corner (`drpgNoticeCheck`; `--no-notices` leaves it out); exits 1 when a size is not right. Playwright from `audit/harness` (`npm ci`), Chromium through `PLAYWRIGHT_BROWSERS_PATH` or `--chromium <executable>`; 194 s here with the notice check at 22 sizes (13.10) |
| The evidence pack, without Foundry | the same server, then `/audit/pack-harness.html` |
| What the theme costs, and a drawn roll's round trip | `game.drpg.perf()` at the table - the only place either number is real (the round trip since E33: the last fifty draws this browser took part in) |
| What a screen reader cannot read | `game.drpg.a11y()` |

The headless harness (`audit/harness`) runs four jsdom clients - one GM and
three players; five in 17-assistant and 33-bridge-paths, which add an Assistant
GM, and in 61-gmstore-case and 62-investigation, which add a second Gamemaster - against a shim of Foundry. It is good enough to drive the rules, the
sockets and the DOM, and it is **not** a browser. A test that needs what it
lacks asks an `env.*` probe with `needs()` and is counted as skipped, not
failed. A scenario exits 1 on a red check since E30; before, it exited 0
whatever its checks said.

**What the harness cannot do** is listed in `audit/harness/README.md`; in short:
no layout, canvas, fonts or audio; CSS only as far as jsdom's cascade goes; a
permission gate that models ownership and roles and little else; v14's
operators, pre-update steps and user roles modelled from notes, not from v14's
source; no real server. Each assumption not confirmed on v14 has a LIVE-E30 id,
and every results file lists them under `environment.unconfirmed`. What E31
could not measure headless - a real Reroll through the table, a request's
timing on a real server, a GM leaving mid-request, a late
planted item, a window closing under reduced motion, a Polish player's refusal -
is LIVE-E31-01..06 (audit/AUDIT-1.2.42.md 9.2).

## Where the code lives

From 1.2.70 the largest files are split by pure moves (D23 option 1: E34, then E41 and
E54), and each old file stays as a **facade**: it keeps its name and every name it
exported, through `export { ... } from "./new.mjs"`, and exports nothing new.

- Importers outside a family keep importing the facade.
- A new file never imports its facade; a name one new file needs from another is
  exported there and imported directly.
- The facade keeps only the code no new file calls.
- New code goes into the family file of its role, never into a facade that holds none.

A move commit runs `node tools/moved-only.mjs HEAD~1`, green on every part (what each
checks is in its header; a shrunk cut is listed only where SHRINK_LISTED names its file,
its function and both lengths, as read by hand - C7a's retireOpeningNotices, 279 -> 252 -
and red otherwise), and adds its new files' rows here. Tier 0's read of every function of
character.mjs is a cut route the tool does not count: a wave that moves one counts it first.

| File | What lives there | Its facade |
| --- | --- | --- |
| `scripts/murder.mjs` | no code: three `export { ... } from` lines, the 67 names it exported at 1.2.69 (33 from the store, 31 from the rules, 3 from the window). New incident code goes into the file of its role below, never here | itself (the family's top) |
| `scripts/incident-store.mjs` | the incident's record: the world half and the cast, each participant's stamped copy and the socket that keeps it in step, the queue and the one write of both halves, who is in it, the betrayal window that write arms, the opening's notices, the deaths a player may know and their socket, the Blackened register, and the cast put back by hand or lifted out of world data | `murder.mjs` |
| `scripts/murder-rules.mjs` | the rules of a murder: the crisis table and the turn, the opening rolls and their invitation, a crisis action judged, resolved and undone, the weapon it swings, running out, a third party, the close and the betrayal | `murder.mjs` |
| `scripts/murder-ui.mjs` | the murder window a GM opens an incident from, and the GM's tracker: its body, its footer and the rate-limited "ask again" for the opening roll | `murder.mjs` |
| `scripts/fog.mjs` | what reads the layer's state: registration and Foundry's vision standing down, the discovery ledger and its socket, the layer, the dissolve, the raster and its drift, the animation switch (`fogAnimations`) and every reader of it, the moment of discovery, and the reports on the live layer (`diagnoseFog`, `whyBlack`, `fogPeek`, `doorwayReport`); 24 names of its own, 5 re-exported | itself (the family's top) |
| `scripts/fog-geometry.mjs` | the fog's pure shape math: a region's shape in the layer's space, polylines, distances, inside-polygon tests, areas; no imports, no state | `fog.mjs` |
| `scripts/fog-doorways.mjs` | the doorways: the wall test, the openings, the glow and its falloff, the outline with its gaps, the seam colour and `MAX_FOG_TEXTURE` | `fog.mjs` |
| `scripts/fog-reveal.mjs` | the reveal's timing and drawing, and the room's outline and name: drawn, faded, held at one weight through a zoom, recoloured with the hour; `clearTransient` with the layer's finder | `fog.mjs` |
| `scripts/fog-diagnostics.mjs` | the map's checks (`checkRegions`), `whatIsHere` with its probes, and how much of a scene belongs to no room (`sceneUncoveredPercent`); no state | `fog.mjs` |
| `scripts/projects.mjs` | the project actions: the queries over `allProjects`, progress, creation, sabotage and its undo, the announcements, editing, `sealOldRepairs`, and `resealSecretProjects` and `knowsProject` (they read `allProjects` and `roomOf`); 27 names of its own, 17 re-exported | itself (the family's top) |
| `scripts/projects-secrecy.mjs` | a project's secret fields, who may see it and its ownership map, and the reads and writes of the project meta and the countdowns | `projects.mjs` |
| `scripts/projects-ui.mjs` | the countdown tray's render hook (`onRenderCountdowns`, which opens the manager), the project manager, the project dialog and sharing; 6 names of its own, 2 re-exported | itself (the family's top) |
| `scripts/projects-tray.mjs` | what the countdown tray draws on every render (Icon Only left, raw keys, undiscovered rows, a player's tray shown before the first project, progress, the fold) and its redraw | `projects-ui.mjs` |
| `scripts/call-effects.mjs` | the Calls' core: the shield and the situational dice, the armed Calls, the Confusions' store, copy and socket, the effects and `applyCall`; 32 names of its own, 12 re-exported | itself (the family's top) |
| `scripts/call-pickers.mjs` | the windows a Call opens to ask what it is pointed at (`pickTarget` and its pickers) | `call-effects.mjs` |
| `scripts/call-world.mjs` | sealed rooms, the silence and the chain, and the called assembly: their readers and writers | `call-effects.mjs` |

That is wave 1 (E34, 1.2.70) whole: five families, eleven new files, 133 module
files in `scripts/` where 1.2.69 had 122. A stage that changes the incident, the
fog, a project or a Call finds the file of its role in this table, not by the
facade's name. Two things sit where a pure move had to leave them (plan E34 4.3):
`applyCrisisAction` in murder-rules.mjs still patches the cast's `swung` in the
store, and the betrayal window lives in incident-store.mjs because `writeState`
arms it.

## What the suite's four numbers mean

`937 passed, 0 failed, 17 skipped` (headless, 07.10.2026, 1.2.69), and a fourth,
`red`, printed only when it is not zero.

- **passed** counts a test that ran at least one `ok()` or `equal()`; one that
  ends with none fails as "measured nothing" (the contract, below). The counter
  sees that an assertion ran, not what it read: a scan that gathers across the
  world and asserts once reads only what the world holds, so such a scan asks
  `needs(world.atLeast(...))` first (rule 1).
- **failed** must be zero. It was not zero for a year, and a thirteenth failure
  arrived unnoticed because twelve was a number people had learnt. It was not
  zero again by 1.2.56 (eleven headless failures, all of them windows the
  harness could not draw), which is why the harness's DialogV2 now draws real
  windows on the GM (`__dialogWindows`).
- **skipped** may only be a fact about the environment that the test checked
  itself. Never a result that came out wrong. The harness asserts this number
  does not grow: something that used to be answerable and stopped being so is a
  regression wearing the one colour nobody looks at. Headless, the skips are
  exactly `audit/harness/skip-baseline.json`'s, test by test.
- **red** is a test marked `expectedRed(stage, why)` that failed on an
  assertion, as it said it would. It stays green only while that holds: it
  fails when it passes and when `tools/stages.json` says its stage shipped. 0
  on 24.09.

## Things that will bite

**Every English key needs a Polish twin.** `lang/en.json` and `lang/pl.json` are
checked against each other by the suite and by `node tools/check.mjs parity`,
and the prose in `config.mjs` by `node tools/check.mjs prose`. A key used with
`plural()` needs `.one`/`.other` and, in Polish, `.few`/`.many`.

**The breakpoints live in `settings.mjs` and nowhere else.** `BREAKPOINTS` is
read by the stylesheet (through two body classes stamped in `applyTheme`), by
the curtain, and by the glass harness. A media query with 1224 in it would be a
fourth copy of the number and the curtain could not read it.

**`styles/narrow.css` loads last on purpose.** Both themes state widths for the
module's blocks as specifically as anything that could be written against them,
so the narrow layout wins its ties by being later rather than by an arms race in
selectors.

**The curtain has two partitions.** `curtainShapes` for a desk, `stackShapes`
for a stacked screen. The desk one assembles panes and checks afterwards that
they tile the screen; the stacked one starts from the screen and cuts it, so it
holds together by construction. Neither is a small change: run
`audit/glass-harness.html` at several sizes and compare the self-check
(`overlaps`, `blockFails`, `edgeGaps`) before and after, and look at a
screenshot, because the numbers can be clean and the picture wrong.

**The glass harness does not recut for Foundry's own rails.** `liveSignature` reads
`BLOCKS`, and the two rails are deliberately not blocks - so adding sidebar tabs from
`page.evaluate` and calling `refreshGlass()` republishes the partition cut for the tabs
that were there at load. A fifteen-tab rail has to be in the HTML before the page loads
(rewrite the response with `page.route`). Measured against the stale cut on 16.09, the
numbers came out plausible and wrong.

**A request that reaches the GM is a declaration, judged by one runner.** Every
action a player's client asks of the primary GM is a row in one of three tables,
`BRIDGE_ACTIONS` (gm-bridge.mjs), `TRAP_ACTIONS` (traps.mjs) and
`SEARCH_ACTIONS` (search-tokens.mjs), and `judge` in `bridge-guards.mjs` carries
each out: who sent it, its guards in order, then its run with a whitelisted copy
of the packet. R1b reads the tables and holds every id a run receives to a guard
that names it or to a claim written beside it; "How to add a bridge action",
below, is the recipe. `senderOf`, `ownsActor` and `gmOnline` live in
`bridge-guards.mjs` and nowhere else (R161). A socket handler outside the tables
that touches an actor checks `senderOf(senderId)` and
`ownsActor(sender, actor)`, both, every time (R1b's second half) - and the rest
of what that means is the trust model, below.

**Delete a key with `forcedDeletion()` or `unsetFlag`.** A `-=key` in an update
removes nothing in this Foundry (the module's own notes; LIVE-E30-01 is the check
that confirms it on v14), and R152 fails any update in the module spelt that way;
the harness reports one as `legacyKeys`. `forcedDeletion()` in `utils.mjs` is
v14's `ForcedDeletion` where it exists (else Daggerheart's `_del`), and null in a
Foundry with neither, where the caller unsets one flag at a time.

**What only the GMs may know lives in the GM store, and nowhere else** (E04,
1.2.63). `gm-store.mjs` is the one engine - a section per world in each GM's
browser, a stamp per field, tombstones and a reset's watermark, the GM-to-GM
exchange, and a player's copy stamped part by part - and `gm-stores.mjs` is its
table, one `defineGmStore` row per store. Nothing outside the engine reads or
writes a store's key, a copy's, or a key from before 1.2.63 (R171 reads the source
for their names): the old keys are frozen, read by the engine's claim and never
written. A store a later stage adds is a row in the table, a registration in
`settings.mjs` and, when it lifts world data, a clause in `migrate.mjs` (R178 holds
that each lift is one, and that nothing else calls it) that reads back before it
removes anything (tier 2 runs the lifts that remove world data with their store's
save swallowed, and the world data stays); the claim, the reset's cuts, the exchange,
Back up and Restore follow from the row, and so do the health check's rows about a
claim; a store a player holds a copy of is named by the copy (`from`) and sends the
copies again after a restore (`afterRestore`, R182). A write whose value is derived -
a migration's default, an amendment - says so, `weak`, `fillOnly` or `ifLive` (R172),
or a second GM joining makes it the truth. Tier 2 holds the stores' sending while it
runs (`gmStoreHold`: its restore writes each key back on this client only) and stands
in a world the stores have never opened (`withGmStoreWorld`) for fixtures no other GM
may be sent. While either is on, no player is sent anything from a store - the door,
the cast, the fog, the offers (`gmStoresQuiet`) - a player's request for one waits
until it ends (`whenGmStoresAudible`) and is answered from the world this browser
opened, and the watches that tell the players a merged change keep what they were
last told until it ends and then hold the record against it: the primary tells what
another GM changed meanwhile (61 E6, F5), and what tier 2 put back raw compares equal
(R184; 61 J1b; 01 counts the packets tier 2 sends a player: none). `whenHydrated`
settles only on a real hydration - never on an open that threw - so a player's request
that waits on the stores waits through `answerKeysOpen`, bounded by
`TIMING.gmStoreOpenMs`, and is refused past it (R189, 61 M).

**A new world setting or flag is checked by `scripts/world-secrets.mjs`** (E05,
1.2.64). Foundry sends every world setting and every actor's, user's, token's, item's
and chat message's flags to every browser, and `WORLD_SECRET_RULES` is the one
statement of what they may never hold. R9 (tier 0) reads the suite's world against
it, R190 (tier 1) fails a rule with no fixture, and 72-canary scans a player's
browser with it after every phase of a chapter. A secret moved out of world data
comes with its rule in the same commit, and a field it lets one setting keep
(`except`) comes with the reason beside it.

**Death is two predicates** (E05 C9, C10). `isDeceased` is the table's fact - the
flag, written at the publication - and `isDeadForGm` is what this browser may know:
the flag, or a death the GMs keep (the `deaths` store on a GM, the `mineDeaths` copy
on a player who knows of it). World-visible bookkeeping and anything posted per
student asks the first; the GMs' judgement, and a player's own sheet and moves, the
second. Both live in `settings.mjs`; R192 fails any other read of the flag, and R193
holds that a death is the table's only once it is published (`publishDeath`, run
by the discovery and the Students window, nothing else).

**Two functions are deliberately long.** `registerSettings` (a flat registration
table) and `steps()` (a data table). Everything else the audit measured over 300
lines has been split. Splitting either of those two would produce a dozen
functions that are each one line of data.

## The trust model (D2)

A player's browser is trusted with nothing that belongs to somebody else.
Protection comes in two layers, and every change should know which one it
touches.

**Layer one (E03, 1.2.60).** Every request that reaches a GM's client is judged
there: the bridge's three tables (gm-bridge.mjs, traps.mjs, search-tokens.mjs),
the fog socket, and Daggerheart's own GM relay (`relay-guard.mjs`). The
judgement uses who Foundry says sent it (`senderOf(senderId)`), what that user
owns (`ownsActor`, `canSee`, `testUserPermission`), and what the world says now:
the room the character stands in, the incident's stage and turn, the pair a
sabotage wrote, the account an Observe key was minted for, and, since E28
(1.2.67), the GMs' record of the roll a packet names (`rolled`, the store
`rolls`). Nothing is taken back on a player's word: a player's packet that
carries an undo is refused (`guardUndoIsTheGms`, E08), because the Reroll is
made on the GM. Packet fields are claims. A refusal changes nothing and is
logged on the GM. Since E31 (1.2.62) every refusal of a table action is also
told to the asker, with a reason code from a closed list (`REASONS`,
`bridge-guards.mjs`) that the player's client says in the player's own language;
four are not shown to the player, because nobody is waiting on them: a trap
report, the Level Up catch-up, a Search's look for a planted item and a plant
handed back. Daggerheart's relay keeps its own table and log line, and tells the
player with the code `relay`. Since E33 (1.2.69) the primary GM also keeps a row
naming the user Foundry named as the sender or the author (sheet-audit.mjs
`recordTrace`, listed by `game.drpg.sheetWrites()`) for a relay request about a
student it refused (`refused`), a player's message carrying a flag only a GM's
client writes, which no browser reads as drawn (`forged`), and a roll's dice a
player rewrote that it put back, once per message and player, as the GMs are
told (`rewrite`). The user such a row names is Foundry's stamp on the message,
assumed for a player's create and not yet read at a table (LIVE-E33-10).

**Layer two (E28, 1.2.67; E29, 1.2.68).** The numbers - totals, dice, Hope paid,
what a sheet holds - are checked against what the GMs hold. Since E28 a player's action roll and a
statistic clicked on the sheet, thrown while a GM is connected, are drawn on the
primary GM's browser (`roll-draw.mjs`): the dice are the GM's, the resolutions
the GM runs read their result off the GMs' record of the roll (the store
`rolls`), and only the GM's own Reroll takes a result back. So a player can no
longer lie about the dice of those rolls: the GM throws the Hope and Fear dice
and the advantage die at the faces the character's rules give, a critical only
as the dice or the character's own effects make one, the roll's kind (an
action's roll an action, a student's statistic from the sheet a reaction) and
every one of Daggerheart's steps, and refuses a roll built of anything but dice,
numbers and + or -. A roll is drawn for an action its
character is taking - one whose payment the GM saw the player make, the crisis
turn, the opening - and once; a resolution takes only the newest roll of its
action, and a roll's window costs nothing but its experiences' Hope. Since E29
what a drawn roll adds to its dice is the GM's as well: the primary GM throws the
roll its own list makes (`LEGAL_ROLL_MODIFIERS` in config.mjs, each part read in
roll-draw.mjs from what the GMs hold - the statistic by the action's rule or a GM's
pick, an experience only with an Experience Call the GMs hold armed, the Calls'
bonus and dice, each action's situation, Breakdown, a hindering Call armed long
enough before the roll), and what the roller's window configured is a claim: a
difference is recorded on the roll (`game.drpg.rollFlags()`), whispered to the GMs
and named on a card to the roller, and never counted. The claim's dice are read in
every way a term can differ - a Hope or Fear die at other faces, in another number
or with a modifier of its own, the advantage die at faces not the list's (E33 fix
r1-G2) - and named `dice`: a trace, not an award, since the GM throws its own
terms. The Calls that change a roll
are bought on the primary GM (`call.arm`, which takes the Hope there - an Experience
or an Ultimate only with the yes a GM gave on its card, which the primary keeps), so
a drawn roll applies only the Calls the GMs hold armed, and a Reroll throws again
from what the GM counted (the record's `scored`), never from a claim.

The sheet is the other half of layer two (E29). A player's writes on a student
they own - its resources, statistics, maxima, rules and bonuses, the module's
flags, its module items and the effects on either - are judged on the primary GM,
one after another per student, against what the GMs hold (`sheet-audit.mjs`, the
store `sheetMarks`). Every module write goes through one road that names its
reason from a closed list (`trustedWrite`, `trustedCreate`, `trustedDelete`,
`WRITE_REASONS` in resource-guard.mjs); a reason is a claim, like a packet field,
and the GM checks the evidence it names - a payment it saw, a Rest's stamp, room
and picks, an item used and spent, a Call's price, a Search's record. What
nothing covers is put back at once and the writer told (Hope as a delta,
statistics, maxima, rules, bonuses, the GM-only flags, an armed Call added -
or, where it hinders or a GM armed it, taken off with no roll of the player's
behind it - a module item's protected flags, an effect that counts), or flagged
to the GMs on a card
with Undo and Keep (Health, Sanity, actions, the free grants, a module item
deleted or created); the rest is listed (`game.drpg.sheetWrites()`). What changed
while no GM was connected is compared at the primary GM's ready and goes the same
way, the rest on one card. With `lockPlayerResources` off the fields its text
names are only listed; items and effects are judged either way. The relay's own
requests for a student are held to the same rule (`relay-guard.mjs`). The guard on
the writer's own browser - resource-guard.mjs's hooks, and the display-only pips
on the sheet, the Party sheet and the token HUD - is a courtesy: it keeps an honest
sheet honest and tells the player early, a console steps past it, and the
protection is the primary GM's.

Since E33 (1.2.69) both halves are measured as an opponent would. R220 is the
census: every document write in `scripts/` is read off the source and held to one
of three - E29's road with a reason of the closed list, a GM's own, or not a
student's - so a road a player's browser could take without a reason fails the
suite before it ships (C1a, C1b). Scenario 83 (`83-roll-integrity`, in `npm test`
and the local gate) drives every legal road of a player's roll and sheet from that
player's own page, as a console would call the module, and reads the GMs' records
before and after: a legal road must raise nothing - no flag, no row, no whisper, no
refusal - and each forgery from a console must leave exactly its one trace naming
its sender (`rollFlags()`; the `sheetWrites()` rows `refused`, `forged` and
`rewrite`), undone or never applied. A burst of one sender's refused requests or
forged messages about one student inside half a minute is one row, which counts
them (`times`) and keeps every path they named. The harness throws Daggerheart's own roll
classes and runs a glue of its roll window for it (`audit/harness/README.md`,
"Daggerheart's dice"); LIVE-E33-01 is the same scenario on a real Foundry.

What stays open: a roll not drawn - one thrown with no GM connected (an action
waits; any other roll is stamped and moves nothing until a GM grants it, on the
dice the player's browser reports, and the GMs' card shows what it claimed beside
what the list would give), every roll on a Daggerheart build the draw was not
written for (thrown in the player's browser, the GM told once per version), and
Daggerheart's own item rolls, its damage rolls and the rest of its rolls; the
Hope such a roll earns, which the GM credits against that player's roll message
of the last minute, whose dice are that browser's (a `covered` row names the
message, fix r1-G1); the Calls such a roll's
window spends there, where one that hinders or that a GM armed stands taken off
only behind that player's roll message about the character, which a console can
write first; the resources of any actor
that is not a student (companions included), Fear one step at a time, and the
countdowns the rules tick or the GM gave them - all through the relay;
`relay-guard.mjs` lists the rest. A Hope Call that changes no roll is paid on the
roller's browser - a fall, which always stands - and what it grants is judged
against that payment. A trace an action
leaves is placed at the roller's browser's request: the GM holds a Search's,
Sabotage's or Dynamic action's to the band its drawn roll reaches, but a console
that asks for none leaves no trace at all, and a Work's trace on an indirect
murder takes the band its request names. And three readings still made on the roller's browser: which
item a Search draws (granted on the roller's own sheet; the GM holds its tier to
what the Search's record earns); a concealment roll's reading; and Listen's lines,
since every browser holds the tokens. Of 83's forgeries two are watched, not
caught (F4b, F6a); the scenario's comments say what each measures.

The Reroll is the GM's own transaction (E08): asked of the primary GM, paid,
thrown, taken back and replayed there, its steps written in the GMs' journal
(`rerollJournal`) as it goes, so that a reload half way is undone or, past the
point where it can be, handed to the GMs to settle. A player's own rewrite of a
roll's dice - Daggerheart's own rerolls (their chat-menu entries are taken off a
player's menu) or a console - is put back by the primary GM, which keeps each
roll's first dice (`reroll-receipts.mjs`, which wrote the receipts this
paragraph described until E08 and keeps only the dice now); a roll thrown before
that GM loaded is only told.

Daggerheart's relay writes on the GM's client, so every hook there sees the GM
as the author. That is why `relay-guard.mjs` passes only the shapes Daggerheart
itself sends for players, and why a test like "was this edit made by a GM"
(`truth-bullets.mjs`) is only as good as that guard. When a new Daggerheart
changes the relay, the guard refuses on the GM's client what it does not
recognise and tells the GM (on a player's client it passes on only the eight
packet names it has reviewed, because from 2.10.10 Daggerheart runs a name it
has no case for there too; its backstop, which stands in when the listener
cannot be wrapped, cannot hold back a payload that is not an object, which goes
on to Daggerheart's listener - 2.10.11's fails on one before it writes,
measured on the copy in scenario 30 part 8). Read its table before a
Daggerheart upgrade, and see AUDIT §9 for what it assumes about Foundry and has
not measured at a table.
The headless harness runs Daggerheart's real relay, copied verbatim into
`audit/harness/lib/dh-relay.mjs`, and since E33 its dice classes into
`audit/harness/lib/dh-dice/dice/` - re-copy both from the new tag, never edit them.

## How to add a bridge action

A request from a player's client to the primary GM, since E31 (1.2.62). Five
steps; R1b, R162-R166 and the lint rule are there to catch a skipped one.

1. **Name it and say it.** A wire name `domain.verb` as an `ACTION_` constant
   beside its table (gm-bridge.mjs for the bridge; traps.mjs and
   search-tokens.mjs keep their own), and `DRPG.Bridge.what.<action>` in
   lang/en.json and lang/pl.json.
2. **Declare it.** One row `{ label, guards, sanitize, run, answer }` in the
   table. Guards come from `scripts/bridge-guards.mjs`, in the order they are
   asked: `knownSender` (or `gmOnly`) first; for every id the run receives
   (sanitized `as.id`, as a field named `...Id` must be), a guard that names
   it (`owns`, `ownsActorAt`, `canSeeProject`, `gmOnly`) or a `claims` line
   saying who judges it. A run that scores a roll names it in `rolled`
   (`{ field, actor, kind }`): the runner hands it the result off the GMs'
   record of that roll, not the packet's (`rollRefusal`, E28).
   `sanitize: pick({...})` lists exactly what the run reads (R163). A
   check that must not wait between itself and the write goes in `prepare`
   (imports) or in the run. `answer` is `"reply"` when the asker says or
   counts anything on it that claims the action was done, and for every
   queued declaration (a queue acknowledges each request as it arrives; R1b);
   `"ack"` when the asker says only that the GM's client has it, or nothing,
   and when the run can wait on a person, as Observe's can; `"none"` for a
   report nobody waits on (and then `quiet`). `patient`, `resend` and
   `timeoutMs` say how the asker waits. `tell` names one code of `REASONS`
   that every refusal is told with, the guards' and the run's; the GM's log
   keeps each one's own reason.
3. **Write the run** `(payload, sender, ctx, prepared)`. It reads only the
   whitelisted payload, refuses by returning `{ refused: "<English reason>" }` -
   the text must map to exactly one code of `REASONS` (R164), and a new code
   needs `DRPG.Bridge.why.<code>` in both files - answers with `{ reply }` when
   `answer` is `"reply"`, and never emits a packet or calls `refuse()`: the
   runner acknowledges, answers, and turns a throw into `failed`. A resolver
   that answers null for work it did not do is a refusal as well,
   `"nothing was carried out: ..."`, told as `refused`: a run never answers a
   done for nothing, and says nothing of which silent reason it was.
4. **Ask it.** `export function requestX(...) { return ask(ACTION_X, {...}, { local }); }`,
   with `local` when a GM runs it on their own client. It answers the bridge's
   result, `{ ok, pending?, value?, refused?, reason? }`, which is truthy
   whatever it says: the caller reads `.ok`, `.value`, `.refused`, `.reason` or
   `.pending` where it asks and never hands the result on (`drpg/bridge-result`,
   eslint.config.mjs), and never shows its own "no GM" or "refused" message -
   `bridgeRequest` has already said what and why, in the player's language.
   `requestCleanableTraces` and `requestObserveTarget` answer their value
   instead, for the callers 30-security reads; the rule names them.
5. **Prove it.** Put the action in a flow (`scripts/tests-flows.mjs`), then run
   the suite (R1b, R162-R166), `npm run lint`, 33-bridge-paths with a legal
   control for the action and 30-security with a forged one; run
   `node tools/registry.mjs --write` when a test was added.

`onIncidentTurn` and `sameScene`, named in E31's brief, are not written: no
request asks either check today (`guardCrisisAction` asks the incident's, as
`guardCrisisUndo` did until E08+E28 C8). When a stage needs one, it goes in `bridge-guards.mjs` beside
the other factories, and nowhere else.

## The house style

Comments here are long, and they are long in one particular way: they say what
was tried, what it measured, and why the code is the shape it is. A comment that
restates the line under it is noise; a comment that records the reading that
chose a number is the only place that reading exists. When a comment stops
matching the code, it is worse than nothing - the two comment sweeps in the
audit found several of those and they had each survived a release.

Dashes are `-`, not `—`, throughout, including in prose files.

## The gate, both layers

A release meets two layers (decision D47, E30), and `release.yml` checks both
before it builds anything.

1. **ci** - `npm test`, above. `.github/workflows/ci.yml` runs it on every push
   to `main` or a `claude/**` branch and on a dispatch, spread over parallel jobs -
   lint, check and gate; the scenarios in buckets; the suite in eight shards; then
   `verdict`, which merges the shards with `suite-merge.mjs` (INFRA I3) - and
   `release.yml` calls the same file on the release commit.
2. **local-gate** - what no headless run can do: the suite's tier 2 in both
   themes on a real Foundry v14, the whole-world diff around it, the scenarios
   whose layers include `local-gate`, and the drills a stage names in
   `tools/stages.json`. `npm run gate:local`, on a machine with a v14 sandbox,
   writes `audit/gate/local-gate.json`, bound to its commit;
   `audit/gate/verify-gate.mjs` checks it in the release (its rules are in its
   header and `audit/gate/README.md`). A part that could not run is written as
   not run, with the reason and the real error - never as run.

The gate is required for 1.3.0, for a stage that declares sockets, rolls or
scenes, and when a runtime script that reads one of them changed since the
previous tag. When a required part did not run, the repository variable
`DRPG_LOCAL_GATE` decides:

- **record** (unset; chosen on 24.09.2026, while no v14 sandbox exists): a part
  not run for a waivable reason - no server, no world, the wrong Foundry, no
  fixtures - passes when the notes' "## Checked" section has a line starting
  "- Not checked in a real Foundry". The job summary carries it, and every
  release since the last complete gate, as debt.
- **enforce**: the owner's waiver file `audit/gate/waivers/vX.Y.Z.md`, the tag
  typed again as the dispatch's `local_gate_waiver` input, the notes line, and
  an approval in the protected environment `local-gate-waiver`.

In both, a failed or errored part, a reason that is the gate's own fault, a
missing, stale, edited or (with `DRPG_GATE_KEY` set) unsigned file, and 1.3.0
without a passed gate are refused. So are a part whose status is none of passed,
failed, error and not-run, a passed suite run that passed no test, and a passed
world diff that dumped no path. As of 24.09.2026 nothing in `audit/live` has
run against a real Foundry (its README says so first).

## Releasing

1. Bump the version in `module.json`, the `--drpg-css-version` stamp in
   `styles/danganronpa.css`, the third line of the six handbooks in
   `docs/handbooks/` and the README's "They describe version X."
   `node tools/check.mjs stamps --release vX.Y.Z` checks all eight stamps
   against `module.json` and the tag, R125 checks the handbooks and the README
   in the suite, and the workflow refuses to build when one lags.
2. Write `.github/release-notes/vX.Y.Z.md` (`node tools/check.mjs notes`). Its
   "## Checked" section says what was measured and, on a line starting
   "- Not checked in a real Foundry", what was not.
3. In the same commit, `node tools/stages.mjs ship EXX [EYY ...]` marks every
   stage of the train shipped, as one version on one date. It refuses while a
   marker in the suite still names one of them, and from then on every red
   still promised for them fails, on purpose.
4. Run the local gate on that commit (`npm run gate:local`) and commit
   `audit/gate/local-gate.json` and `audit/gate/evidence/` on top of it, in a
   commit of their own - not amended in: the file names the commit it ran on.
5. **An agent never writes a waiver file and never fills the waiver input.**
   They are the owner's decision and the only way through enforce mode; an
   agent asks.
6. Before a release, look up the current Daggerheart version. `verified` in
   `module.json` names only a version the suite has passed on at a real table;
   the manifest states no `maximum` (decision D1), so a newer Daggerheart loads
   and the module warns the GM once per version.
7. `main` is the release branch: merge on green CI only. The tag is created
   there, and the workflow refuses a dispatch from anywhere else.
8. Actions ▸ Release, dispatched on `main` with the tag (and a title for the
   last one) and `prerelease` ticked: a train is published as a prerelease,
   and `releases/latest` stays the previous release (the run warns when it does
   not). After the owner's smoke at a table, dispatch it again with the tag and
   `promote` ticked: no build, the release edited to latest, and the run warns
   when `releases/latest` is not the tag. The two inputs together are refused.
9. Numbering: decision D20 (one stage, one `1.2.X`) was retired by O1 on
   15.10.2026. Each train of the 1.3.0 plan ships as the next `1.2.X`; the last
   ships as `1.3.0` "Stained Update". After it, `1.3.X` is balance and fixes. The 1.3.0 notes say what of the text rework the
   `1.2.43`-`1.2.47` notes promised with it went in, and what did not.

## Test author contract

Every test in `scripts/tests-tier*.mjs` keeps these. The runner holds rules 1, 2
and 5 on every run, and R154 runs it on cases of its own; R155-R158 read rules 2
to 5 off the tier files; rule 6 is the runner's world dump, with R159; rule 7 is
01-runtests' in the harness. Whether a scan of the world read anything is the
author's to keep: nothing reads it. `node tools/check.mjs contract` runs the same
detectors (`scripts/tests-lint.mjs`) in CI, and holds the harness scenarios to
rule 4.

1. **It measures something.** A test that ends without one `ok()` or `equal()`
   having run FAILs as "measured nothing". A scan of the world measures only what
   the world holds, and an assertion after the loop runs whether the loop read
   anything or not - so a test that reads the world asks
   `needs(world.atLeast(...))` for what it reads, and the harness world holds one
   of each (`audit/harness/lib/seed.mjs`: a trace, an item with a role, a stash).
   An assertion the test catches itself FAILs it.
2. **A skip is a probe, never a result.** `needs()` takes only `env.*` (this
   browser, this Foundry) or `world.*` (the world as found) from
   `tests-kit.mjs`; anything else FAILs (R158), and a `world.*` asked after the
   test wrote to the world FAILs. What the module does is `ok()`. A new probe is
   a row in the kit, not a condition in a test.
3. **Source is cut with the kit** - `bodyOf`, `fnSource`, `lineAround` (R156). A
   `slice` bounded by `indexOf`, or `split(marker)[1]`, answers -1 or nothing
   when the code moves, and every negative assertion after it passes. A `bodyOf`
   with neither `until` nor `length` reads to the end of the file; R156 does not
   flag that yet (40 such reads are left for E40).
4. **Nothing is true by construction** - no `ok(true)`, no `|| true`, no
   `check(name, true)` (R157).
5. **Red on purpose says until when.** `[name, fn, expectedRed("E07", why)]` is
   green while it fails on an assertion, FAILs as "unexpectedly passed" when it
   passes, and FAILs once `tools/stages.json` says E07 shipped (R155). One tuple
   per generated case. A harness check says the same with its `knownLeak` or
   `expectedRed` option.
6. **Tier 0 and 1 change nothing; tier 2 puts everything back.** `worldDump()`
   is compared before and after tiers 0-1 and after every scenario's `restore()`
   ("restore left: ..."). Leaving a path out of the dump takes a `DUMP_RULES`
   row with a reason and an `until`; R159 holds the dump to every document type
   and setting a write in the module names (a write through a document in hand
   is not read yet: E40).
7. **World requirements skip, they do not fail.** Fixtures come from `cast(n)`
   and `world.*`. The harness world satisfies every `world.*`, so
   `audit/harness/skip-baseline.json` holds `env.*` probes only, and must match
   the run exactly.

R154 runs the runner's judgement on 22 small tests with known verdicts - 18 break
rules 1, 2 and 5 on purpose, 4 are controls that break none - and holds each to
its verdict.

## Numbering new tests

Every tier-0 test carries an R number, and so does every tier-1 test written
since 1.2.61: `R<n> - <what it promises>`. The number is how a comment, a commit
and an audit find the same test a year later, so it is never reused - a deleted
test keeps its row, marked with the stage that removed it. Tier-2 scenarios are
named, not numbered.

- `R113`-`R124` are reserved by number: `R113`-`R117` and `R120` for A5 (E13),
  `R118` and `R119` for A5 but written in E12, `R121` for A4 (E22), `R122` for A1
  (E23), `R123` and `R124` for A6 (E24). A design document that calls its first
  test "R113" means its row here. `R160` is the FLOWS test. `R292`-`R299` are
  reserved for A7 (E81).
- `R21` was two tests until 1.2.61; the second, "the chapter ends by closing the
  trial", is `R151`.
- 70 tier-1 invariants older than 1.2.61 have no number and keep their names;
  the registry, `docs/dev/R-REGISTRY.md`, lists them. A tier-0 or tier-1 test with
  no number that is not on that list fails `node tools/check.mjs registry`, and
  so does a number used twice.
- Take the next free number (`node tools/registry.mjs --next`, the registry's
  first line) in the commit that adds the test; `node tools/registry.mjs --write`
  adds its row to `docs/dev/R-REGISTRY.md`.

## What is not done

`audit/AUDIT-1.2.42.md` section 9 carries the live checks - the things no
harness can settle and that have to be tried at a real table. That list is the
honest statement of what this module has not yet proved about itself, with two
records beside it: the local gate's parts not run (`audit/gate/local-gate.json`)
and the performance baseline, not yet measured (`audit/perf-baseline.json`: the
1.2.56 method and, since E33 C13, a revision for 1.2.69's `perf()`; the run is
LIVE-E33-05).

## Registry: R numbers

In `docs/dev/R-REGISTRY.md` since INFRA I4, generated there by `node tools/registry.mjs --write`;
`node tools/registry.mjs --next` prints the next free number and the reserved ones.
