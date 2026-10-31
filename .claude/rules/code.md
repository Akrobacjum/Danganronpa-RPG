---
paths:
  - "scripts/**/*.mjs"
  - "styles/**/*.css"
  - "lang/*.json"
  - "tools/moved-only.mjs"
  - "audit/glass-harness.html"
  - "audit/glass-sweep.mjs"
---

# Code: where it lives and what bites (moved from CLAUDE.md)

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
| `scripts/fog.mjs` | what reads the layer's state: registration and Foundry's vision standing down, the discovery ledger and its socket, the layer, the dissolve, the raster and its drift, the animation switch (`fogAnimations`) and every reader of it, the moment of discovery, and the reports on the live layer (`diagnoseFog`, `whyBlack`, `fogPeek`, `doorwayReport`); 53 names of its own, 5 re-exported | itself (the family's top) |
| `scripts/fog-geometry.mjs` | the fog's pure shape math: a region's shape in the layer's space, polylines, distances, inside-polygon tests, areas; no imports, no state | `fog.mjs` |
| `scripts/fog-doorways.mjs` | the doorways: the wall test, the openings, the glow and its falloff, the outline with its gaps, the seam colour and `MAX_FOG_TEXTURE` | `fog.mjs` |
| `scripts/fog-reveal.mjs` | the reveal's timing and drawing, and the room's outline and name: drawn, faded, held at one weight through a zoom, recoloured with the hour; `clearTransient` with the layer's finder | `fog.mjs` |
| `scripts/fog-diagnostics.mjs` | the map's checks (`checkRegions`), `whatIsHere` with its probes, and how much of a scene belongs to no room (`sceneUncoveredPercent`); no state | `fog.mjs` |
| `scripts/projects.mjs` | the project actions: the queries over `allProjects`, progress, creation, sabotage and its undo, the announcements, editing, `sealOldRepairs`, and `resealSecretProjects` and `knowsProject` (they read `allProjects` and `roomOf`); 49 names of its own, 16 re-exported | itself (the family's top) |
| `scripts/projects-secrecy.mjs` | a project's secret fields, who may see it and its ownership map, and the reads and writes of the project meta and the countdowns | `projects.mjs` |
| `scripts/projects-ui.mjs` | the countdown tray's render hook (`onRenderCountdowns`, which opens the manager), the project manager, the project dialog and sharing; 8 names of its own, 2 re-exported | itself (the family's top) |
| `scripts/projects-tray.mjs` | what the countdown tray draws on every render (Icon Only left, raw keys, undiscovered rows, a player's tray shown before the first project, progress, the fold) and its redraw | `projects-ui.mjs` |
| `scripts/call-effects.mjs` | the Calls' core: the shield and the situational dice, the armed Calls, the Confusions' store, copy and socket, the effects and `applyCall`; 33 names of its own, 12 re-exported | itself (the family's top) |
| `scripts/call-pickers.mjs` | the windows a Call opens to ask what it is pointed at (`pickTarget` and its pickers) | `call-effects.mjs` |
| `scripts/call-world.mjs` | sealed rooms, the silence and the chain, and the called assembly: their readers and writers | `call-effects.mjs` |

That is wave 1 (E34, 1.2.70) whole: five families, eleven new files, 133 module
files in `scripts/` where 1.2.69 had 122. A stage that changes the incident, the
fog, a project or a Call finds the file of its role in this table, not by the
facade's name. Two things sit where a pure move had to leave them (plan E34 4.3):
`applyCrisisAction` in murder-rules.mjs still patches the cast's `swung` in the
store, and the betrayal window lives in incident-store.mjs because `writeState`
arms it.

## Things that will bite

Two of this section's rules hold in every file and stand in CLAUDE.md: every English key needs a
Polish twin, and a key is deleted with `forcedDeletion()` or `unsetFlag`.

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

