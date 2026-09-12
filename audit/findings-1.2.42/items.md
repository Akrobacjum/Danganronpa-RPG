# ITEMS - findings

Domain: inventory, items, vault (stash + bedroom keys), item tables, projects, traps, GM give/take hub.
Method: every domain file read end to end; call graph followed into gm-bridge.mjs, utils.mjs, secret.mjs,
sheet.mjs (item rows), action-rolls.mjs (Search loot, proposal), search-tokens.mjs (plant round trip),
messenger-app.mjs (card actions), anonymity.mjs (loot picker), season-setup.mjs (reset), overflow.mjs (rot),
live.mjs (keepLive/keepFresh), movement.mjs (sameRoom/locateActor). All 386 distinct `DRPG.*` keys used by the
nine domain files resolve in lang/en.json (the only miss, `DRPG.Clock.night`, is quoted inside a comment).

## Files read (with line counts)

| file | lines |
|---|---|
| scripts/inventory.mjs | 789 |
| scripts/gm-items.mjs | 1299 |
| scripts/use-items.mjs | 787 |
| scripts/vault.mjs | 2361 |
| scripts/tables.mjs | 2106 |
| scripts/traps.mjs | 782 |
| scripts/projects.mjs | 1090 |
| scripts/projects-ui.mjs | 918 |
| scripts/handover.mjs | 547 |
| scripts/config.mjs (ITEM_*, TIER_EFFECTS, USABLE_*, EQUIPPABLE, VAULT_LIMIT, TOOL_IN_HAND, LIMIT_GROUPS, BROKEN_ITEMS, weather `rot`, PROJECT_SCALE, PROJECT_GLYPHS, TRAP_TRIGGERS, TRAP_MODIFIERS) | 340-700, 1440-1520, 1835-1880, 2140-2350 of 4025 |
| neighbours (partial): gm-bridge.mjs (handover/plant/steal/progress/loot handlers, requestGiveItem, promptAndCallGm, callGm), utils.mjs (whisperToOwner*, workingScene, ownerOf, privately), secret.mjs (postSecret), sheet.mjs 2040-2570 + 2700-2760, action-rolls.mjs 1160-1300 + 1740-1880, search-tokens.mjs 320-380, messenger-app.mjs 585-700, anonymity.mjs 195-260, season-setup.mjs 629-830, overflow.mjs 435-475, live.mjs 60-140, movement.mjs 995-1030, tests.mjs 4930-5060 + 5160-5200 | - |

Note on the brief: the prompt says "2 usables"; the code is 3 (`config.mjs:407`, Dawid 02.09.2026) and every
reader (`vault.mjs` header, `LIMIT_GROUPS` note, sheet counters) agrees with 3. Gear is 2 (`config.mjs:660-676`).

## Strengths

- One authority per write. Every cross-sheet move (handover, stash theft, pocket theft, plant, loot, project
  progress, stash discovery) is executed only on a GM client, the packet is treated as a claim, and the room,
  ownership, death and concealment are re-derived there (`handover.mjs:160-206`, `vault.mjs:962-1060`,
  `gm-bridge.mjs:520-560, 598-620`). `stealFromPerson`/`plantOnPerson` even rebuild the item pool rather than
  trusting the id (`vault.mjs:1195-1215, 1370-1378`).
- Broken-not-deleted is carried through consistently: `breakItem` clears the readied flag in the same write,
  `equippedIn`/`readiedItems` exclude broken and stashed, `preservedFlags` keeps `broken`, `kind`, `roles` and the
  trap identity across every recreate path, and the sheet still shows the row (`inventory.mjs:124-155, 213-240`).
- The item trigger of traps is genuinely leak-free by construction: every item carries an opaque identity, the
  poisoned one is known only in a client-scoped GM ledger, the plant arrives down the ordinary `substitute` path,
  and the alert card is `gmOnly` (`traps.mjs:41-53, 232-289`, `action-rolls.mjs:1212-1262`).
- The GM hub (`openItemManager`) is a real improvement: one window, holdings live via `keepLive` on item and actor
  hooks, every sub-dialog returns to the hub, the recipient is chosen inside each form and the carry counts follow
  the recipient (`gm-items.mjs:45-249, 373-470`).
- Trap listeners are cheap on hot paths: one `armed()` map rebuilt only on `projectMeta` change, an early return on
  a miss, a relay so the GM client sees player-side hooks, and self-disarm-before-alert so a Main Hall trap cannot
  spam (`traps.mjs:82-117, 232-307, 559-613`).
- Item tables: name aliases for every historical label, `refreshTableCopy` only rewriting untouched boilerplate,
  the shared `tableIndex` with hook invalidation, and the editor's flush-before-switch and "only write what
  changed" rules are all careful and documented (`tables.mjs:26-95, 119-170, 885-948, 1748-1800`).

## Findings

### ITEM-01 [severity: major] [category: bug] [CONFIRMED]
**Where:** `scripts/inventory.mjs:124-155` (`preservedFlags`), callers `handover.mjs:360, 512`, `vault.mjs:1067, 1224, 1400`
**What happens:** Durability wear is not one of the flags a copy keeps. Every transfer in the module is a
create-then-delete (handover, loot, stash theft, pocket theft, plant), so a Tier 3 tool that has taken two
Despairs (`wear: 2`, one point left) arrives on the other sheet with `wear` absent = 0/3. The function's own
comment says it exists to stop transfers being "a laundry service"; wear is exactly the laundry it still allows.
`ITEM_FLAGS.wear` is read nowhere outside inventory.mjs (grep), so no caller compensates.
**Evidence:**
```js
export function preservedFlags(item) {
    const flags = {};
    if (isBroken(item)) { flags[ITEM_FLAGS.broken] = item.getFlag(MODULE_ID, ITEM_FLAGS.broken); }
    const kind = item?.getFlag(MODULE_ID, ITEM_FLAGS.kind); if (kind) ...
    const roles = rolesOf(item); if (roles.length) ...
    const identity = item?.getFlag(MODULE_ID, ITEM_FLAGS.identity); if (identity) ...
    return flags;          // no `wear`
}
```
**Fix:** add `const worn = wearOf(item); if (worn) flags[ITEM_FLAGS.wear] = worn;` in `preservedFlags`. One
line, every path inherits it.
**Pitfalls:** none functional; `wearOf` clamps to durability so a stale over-count cannot travel. Add the case to
the durability self-test (tests.mjs ~5440) so the next flag does not repeat this.

### ITEM-02 [severity: major] [category: bug] [CONFIRMED]
**Where:** `scripts/vault.mjs:1770` (cell), `2196-2203` (Apply writes legacy flag), `2258-2284` (stash matrix pass)
**What happens:** The "Stash hidden" column on Room Setup's Bedrooms tab does nothing. The cell is read through
`isConcealed()` -> `stashIn()` (the new `drpgStashes` list), but Apply writes the tick into the LEGACY
`drpgVaultConcealed` flag via `setVaultRoom`. Then, in the same Apply, the Stashes-tab pass compares the region's
current list against the hidden inputs that were rendered before the tick and writes the stash entry back with the
OLD concealment. Result on every path: (a) region already migrated to `drpgStashes` - the legacy flag is written and
never read; (b) region not yet migrated - `stashesIn` briefly reads concealed=true from the legacy flag, the
matrix loop sees `was.concealed !== entry.concealed` and calls `setStash(room, owner, { concealed: false })`,
undoing the tick. The checkbox snaps back on reopen with no message. `VAULT_FLAGS.concealed` is documented as
"LEGACY, read only through stashesIn's fallback... setStash writes stashes instead" (`vault.mjs:84-93`), yet
`setVaultRoom` still writes it and `openVaultInspector` still prints it.
**Evidence:**
```js
concealed: check("concealed", isConcealed(room)),                 // 1770 - reads the NEW list
...
await setVaultRoom(row.room, { owner: row.owner, concealed: row.concealed, ... });   // 2196 - writes the OLD flag
...
for (const entry of keep.values()) {                              // 2278 - keep built from stale hidden inputs
    const was = current.find(e => e.actorId === entry.actorId);
    if (was && was.concealed === entry.concealed) continue;
    await setStash(room, entry.actorId, { concealed: entry.concealed });
```
**Fix:** drop the Bedrooms-tab column (the Stashes tab is the one control), or make it write through
`setStash(room, owner, { concealed })` and have the stash matrix treat the bedroom owner's cell as derived from that
box. Stop writing `drpgVaultConcealed` in `setVaultRoom`.
**Pitfalls:** keep the legacy flag readable in `stashesOn`'s fallback for untouched regions. The `same`
comparison at 2170 includes `concealed`, so removing the column also removes a false "changed" count.

### ITEM-03 [severity: major] [category: flow] [CONFIRMED]
**Where:** `scripts/projects-ui.mjs:800-822` (create path), `scripts/projects.mjs:394-404` (audience), stale comment `projects-ui.mjs:816-818`
**What happens:** A player proposes an indirect murder (Work on Project -> Start -> "Indirect murder" ticked). The
GM presses "Review and approve"; the prefilled dialog carries `by` (the proposer's actor id) but `killerId` is
derived ONLY from the optional "Also visible to" select, which defaults to "-". `createProject` builds the
secret audience from `killerId` alone, so with the default answer the project is sealed against everyone
including its own proposer: `canSee` -> `viewersOf` -> nobody. The proposer's Work on Project list never shows
their own murder, the trap arms anyway (traps.mjs falls back to `by`), and the GM is never told anything is
wrong. The comment "`startProject` fills this in properly for the player's own route" is stale - `startProject`
stopped creating projects when proposals were introduced and now sends only `by`.
**Evidence:**
```js
// projects-ui.mjs
by: start?.by ?? null,
...
viewers: result.viewer ? [result.viewer] : [],
killerId: result.viewer ? game.actors.find(...)?.id ?? null : null
// projects.mjs
const audience = viewers.length ? viewers : (hidden && killerId ? ownerIdsOf(killerId) : []);
```
**Fix:** in `openProjectDialog`'s create path, default `killerId` to `start?.by` when `result.murder` and no
viewer was chosen, and preselect "Also visible to" with the proposer's owning user when a preset carries `by`.
In `createProject`, fall back to `ownerIdsOf(by)` for the audience when `killerId` is null (mirrors traps.mjs:154).
**Pitfalls:** a GM-invented murder from the panel has neither `by` nor `killerId` - see ITEM-19; keep the
"no audience" case reachable but say so (a warning notification) rather than sealing silently.

### ITEM-04 [severity: major] [category: bug] [CONFIRMED]
**Where:** `scripts/config.mjs:660-677` (rule), `scripts/use-items.mjs:116-139, 287-296` (only enforcement), `scripts/inventory.mjs:709-729` (preCreateItem), `scripts/vault.mjs:774-790` (retrieve), `scripts/handover.mjs:493-501`
**What happens:** `LIMIT_GROUPS.gear.maxStowed = 1` ("carrying two means one is in your hand") is enforced in
exactly one place: `toggleEquipped` refuses to PUT DOWN the readied item when the other is already stowed. Every
acquisition path - Search loot, GM give, handover, loot, theft, plant, `retrieve` from the stash, compendium drag
- only asks `canCarry` (the count of 2). A character who never readies anything carries two stowed gear items
indefinitely, which is the state the rule exists to forbid. `mayStow`/`stowedInGroup` have no caller outside
use-items.mjs (grep).
**Evidence:**
```js
// use-items.mjs:287 - the only check
if (wasEquipped) { const shape = mayStow(actor, item); if (!shape.ok) { warn(stowShape); return false; } }
// inventory.mjs:721 - preCreateItem knows only the count
const room = canCarry(actor, category); if (room.ok) return;
```
**Fix:** decide which rule is meant. If "one must be in hand" is the rule, auto-ready the incoming gear item when
the other is stowed (in `grantItem`, after creation: `if (stowedInGroup(actor,"gear").length > max) toggleEquipped`)
and do the same in `retrieve`. If the rule is only "you may not put both down", say so in the hint.
**Pitfalls:** auto-readying on a GM give or a Search changes which weapon the incident engine reads
(`equippedFor`); notify the owner when it happens. Do not refuse creation in `preCreateItem` - Search would then
lose a found item after the roll and token were spent.

### ITEM-05 [severity: minor] [category: bug] [CONFIRMED]
**Where:** `scripts/vault.mjs:717-770` (`stow`), `774-810` (`retrieve`)
**What happens:** Stowing an item does not clear `equipped`. `readiedItems` hides a stashed item, so nothing
breaks while it lies in the drawer - but `retrieve` writes only `location`/`stashRoom` back, so the item returns
still flagged readied. If the player readied something else meanwhile, two items are now "in hand"
(`toggleEquipped` only tidies when readying, not on retrieval), the sheet shows two fist badges, and
`equippedFor` picks by home category rather than by the player's choice. It also bypasses ITEM-04's one check:
stow the readied knife, ready the rag, retrieve the knife - two readied, zero stowed, `mayStow` never asked.
**Evidence:**
```js
await item.update({ [`flags.${MODULE_ID}.${ITEM_FLAGS.location}`]: LOCATIONS.vault,
                    [`flags.${MODULE_ID}.${ITEM_FLAGS.stashRoom}`]: room });   // no equipped:false
```
**Fix:** add `[`flags.${MODULE_ID}.equipped`]: false` to the `stow` update (same one-write pattern as `breakItem`).
**Pitfalls:** none; `EQUIPPED_FLAG` lives in use-items.mjs, which vault.mjs does not import - use the literal or
move the constant to config.mjs beside `BEDROOM_KEY_FLAG`.

### ITEM-06 [severity: minor] [category: leak] [CONFIRMED]
**Where:** `scripts/handover.mjs:472-513` (`giveItem`), compare `vault.mjs:1370-1378` (`plantOnPerson`)
**What happens:** The GM-side handover verifies sender ownership, same room and death, but never that the item is
on the giver's person. A stashed item (in a bedroom across the map) can be given to somebody standing next to the
giver; the copy is created `carried`. The sheet hides the hand-over button on stash rows, so the honest UI cannot
do it, but `game.drpg.giveItemDialog(actor, item)` (api.mjs:685) and a hand-built `item.give` packet can. The
sibling functions explicitly rebuild the pool from `carriedInCategory` for this reason ("something in a stash
cannot be planted because it is not in a hand").
**Evidence:**
```js
const category = item.getFlag(MODULE_ID, "category");
if (!category) { ... return null; }
const room = canCarry(to, category);     // nothing asks isStashed(item)
```
**Fix:** `if (isStashed(item)) { warn(...); return null; }` after the key branch (keys are copied and may stay
stashed; decide whether a stashed key should be shareable - probably not either).
**Pitfalls:** `lootBody` deliberately allows a corpse's stashed items? No - the loot picker filters
`!isStashed` (anonymity.mjs:197) but `lootBody` itself does not; add the same guard there for consistency.

### ITEM-07 [severity: major] [category: gm-ease] [CONFIRMED]
**Where:** `scripts/use-items.mjs:476-495` (`useCreatively`), `773-787` (`grantItemEffect`), `gm-bridge.mjs` `callGm` (actions rendered only when passed)
**What happens:** Using a Tier 0 item sends the GM a ruling card with the player's text and NO button. The only
way to apply a ruling is the console: `game.drpg.grantItemEffect(actor, item, { hitPoints: 1 })` - and the item is
deliberately not consumed until then. Every other GM card in the module now carries at least a Reply/Approve
button (messenger-app.mjs:640-650 comment); this is the one card where the GM has to leave the UI. In practice
tier-0 items will be ruled on verbally and never consumed, so the "seemingly useless item" stays in the bag
forever, holding a usable slot (3).
**Evidence:**
```js
const request = await promptAndCallGm(actor, { title, prompt, placeholder, room });   // no `actions`
// Deliberately NOT consumed here. Whether the idea works at all is the GM's ruling
```
**Fix:** pass `actions` on the card: "Works - apply an effect" (opens a small dialog with Health/Sanity/Hope
amounts and a "consume" tick, then calls `grantItemEffect`), "Works, no effect - consume it" (`consume` only)
and "Refuse" (whisper back). Reuse `usedStamp` so the trap listener still sees the use.
**Pitfalls:** the item id must travel on the card (`data: { item: item.id, actor: actor.id }`) and be re-checked
on the GM side (`actor.items.get`) - the item may have been handed over meanwhile.

### ITEM-08 [severity: minor] [category: bug] [CONFIRMED]
**Where:** `scripts/traps.mjs:378-423` (`plantItem`/`takePlant`), `scripts/projects.mjs:832-871` (delete / clearAll), `season-setup.mjs:629-830` (reset touches neither setting)
**What happens:** A plant is keyed by room and outlives its project. `takePlant` hands out whatever is stored
for the room without checking that the trap project still exists or is armed. Delete the murder project in the
manager, or run the season reset, and the first successful Search in that room next chapter (or next season)
still turns up "Poisoned tea" instead of the draw - with no trap behind it and no way for the GM to know except
`diagnoseTraps()`. `trapLedger` grows one orphan entry per plant forever (client-scoped, never pruned).
**Evidence:**
```js
const found = store[key]; if (!found) return null;   // no look-up of found.projectId
```
**Fix:** in `takePlant`, drop and ignore an entry whose `projectId` is no longer in `projectMeta` (or whose trigger
is not armed); in `deleteProject`/`clearAllProjects`, prune `trapPlants`/`trapLedger` entries for the id. Both
settings are client-scoped, so prune on the GM client that deletes; a `ready`-time sweep covers the rest.
**Pitfalls:** `takePlant` is called inside the search-token round trip on the primary GM only; keep the prune
cheap (one object filter).

### ITEM-09 [severity: minor] [category: bug] [CONFIRMED]
**Where:** `scripts/vault.mjs:118-131, 1447-1460` (`VAULT_FLAGS.found` on the actor), `season-setup.mjs:629-830`
**What happens:** "I have found X's hiding place" is written on the finder's actor and is never cleared - not by
the season reset (which lists what it clears and keeps; stashes are not on either list), not by chapter end, not
when the stash is removed in Room Setup. Next season the same character opens the same hidden stash for free.
**Evidence:** grep for `drpgStashesFound`/`VAULT_FLAGS.found` outside vault.mjs: only tests.
**Fix:** a "stashes found" step in `resetSeason` (`actor.unsetFlag(MODULE_ID, VAULT_FLAGS.found)` per student), and
`setStash(..., { present: false })` should drop keys ending in `::${room}::${actorId}` from every actor.
**Pitfalls:** the key embeds the scene id; a scene rebuilt under a new id already orphans entries harmlessly.

### ITEM-10 [severity: minor] [category: text] [CONFIRMED]
**Where:** `lang/en.json` `DRPG.Vault.rifleNote`; `scripts/vault.mjs:1086-1120`, `877-960`
**What happens:** The free rifle dialog says "Free, and they will notice it is gone." The GM side tells the owner
ONLY when `clumsy` is set, and `rifleStashDialog` -> `requestVaultSteal` never sets it (only the Search branch
does, on Despair). So on the free route the owner is never told - the exact sentence the code comment says was
removed from `DRPG.Vault.stole` because "it was false in both directions".
**Evidence:**
```json
"rifleNote": "Free, and they will notice it is gone. A concealed stash needs a Search instead."
```
```js
if (clumsy) { await whisperToOwner(owner, ... DRPG.Vault.noticed ...) }    // never true from rifle
```
**Fix:** either "Free. A concealed stash needs a Search instead." or make the rifle route mark the drawer
disturbed (an open drawer being emptied is the one case where "they will notice" is plausible).
**Pitfalls:** if the free route starts notifying, `DRPG.Vault.noticed` says "hiding place", which is wrong for an
open drawer.

### ITEM-11 [severity: minor] [category: text] [CONFIRMED]
**Where:** `scripts/inventory.mjs:611, 634` vs `726`; `scripts/vault.mjs:785-789`; `scripts/handover.mjs:495-499`
**What happens:** `capacityLabel()` exists so a refusal about a shared budget says "Gear (2)" ("Trap 69: all four
have to say 2/3 Gear"). `grantItem` uses it; the `preCreateItem` hook, `retrieve` and `giveItem` still print the
category plural. A player retrieving a knife with two tools in hand reads "You already carry the most Murder
Weapons you can (2)" while their sheet shows Murder Weapons 0 and Gear 2/2.
**Evidence:**
```js
category: ITEM_CATEGORIES[category]?.plural ?? category,   // inventory.mjs:726, vault.mjs:786, handover.mjs:497
```
**Fix:** use `capacityLabel(category)` in all three (export it from inventory.mjs - it already is).
**Pitfalls:** none.

### ITEM-12 [severity: minor] [category: gm-ease] [CONFIRMED]
**Where:** `scripts/gm-items.mjs:1144-1215` (`takeItemDialog` options)
**What happens:** The Take-away picker lists carried and stashed items in one flat list with no marker, and does
not mark broken ones either, although the hub's holdings list above it does both ("in the stash", T2). The GM
choosing between two "Kitchen knife (T1)" rows cannot tell which is the one in the drawer or the ruined one. The
note under the tab promises "Anything they are holding or have stashed" but the list does not say which is which.
**Fix:** append ` - in the stash` (`DRPG.Items.inStash`) and ` - broken` to the option label, as `holdingsFor` does.
**Pitfalls:** none.

### ITEM-13 [severity: nit] [category: text] [CONFIRMED]
**Where:** `scripts/gm-items.mjs:307, 480, 847` (window titles), `260-263` (`giveKeyDialog` accepts a recipient change)
**What happens:** All three give windows title themselves "Give an item to {actor}" from the ARGUMENT, while the
recipient `<select>` inside can be changed and "the window's own answer wins". The title lies as soon as the GM
changes the recipient.
**Fix:** use the generic title (`DRPG.Items.give`, `DRPG.Vault.giveKey`, `DRPG.TruthBullet.give`) when the form
carries a recipient select, or update the title on `change`.

### ITEM-14 [severity: minor] [category: bug] [CONFIRMED]
**Where:** `scripts/projects-ui.mjs:800-822`, `scripts/projects.mjs:351-420`, `scripts/traps.mjs:154-155`, `announceTrapReady` (`projects.mjs:590-600`)
**What happens:** A GM who creates an indirect murder from the panel (no proposal) and leaves "Also visible to"
at "-" gets a project with `killerId: null` and `by: null`. `trapProjects` skips it (`if (!killer) continue`), so
the trap never arms; when the bar fills `announceTrapReady` only logs "owner could not be identified" and no
card is sent. The Create dialog never says a killer is required. Same for a project turned into a murder by
ticking the manager's Indirect column: `setProjectMeta(..., { indirectMurder: true })` with no killer.
**Fix:** when `murder` is ticked and no viewer is chosen, refuse with a warning ("An indirect murder needs a
killer - pick who it is visible to") or fall back to the proposer (`by`). In the manager, open the edit dialog
instead of accepting the tick.
**Pitfalls:** `killerId` is an ACTOR id derived from the chosen USER via `testUserPermission`; a user owning two
characters resolves to the first found.

### ITEM-15 [severity: minor] [category: bug] [SUSPECTED]
**Where:** `scripts/tables.mjs:119-170` (`refreshTableCopy`, runs at `ready` on every GM client), editor Rename at `1953-1985`
**What happens:** Any table carrying the module's `category`/`tier` flags whose name differs from `tableName()`
is renamed back on the next GM load, provided today's name is free. The editor offers "Rename" on tier pools and
warns the GM that a name the lookup cannot build breaks draws - but a GM who accepts that and renames
"DRPG Tools - Tier 2" to "Workshop finds" will find it silently renamed back next session. Needs a live check that
`RollTable.update({name})` keeps the flags (it does) - the logic itself is unconditional.
**Fix:** either strip the flags on a manual rename (the table then stops being "ours"), or only rename from a name
in `tableNameCandidates()` (a KNOWN legacy spelling) rather than from any name.
**Pitfalls:** the second option is the one that matches the function's stated intent ("bring already-installed
tables up to today's wording").

### ITEM-16 [severity: minor] [category: flow] [SUSPECTED]
**Where:** `scripts/vault.mjs:213-243` (`grantBedroomKey` reads `vaultOwnerOf(room, scene ?? workingScene())`), `gm-items.mjs:284` (`allBedrooms()`), `handover.mjs:139-140` (`shareKey`)
**What happens:** `workingScene()` is `canvas.scene` on the GM's client. The key hub lists bedrooms of the scene
the GM is LOOKING AT, and a player-to-player key share resolves the owner's name for the key description on that
scene. With the dorms on one scene and the GM parked on the trial hall, "Give a key" reports "no keys to give",
and a shared key's description reads "Kaede's room? Owner: -". `reconcileBedroomKeys` correctly walks every
scene and passes `scene`; the two callers above do not.
**Fix:** in `giveKeyDialog`, walk `game.scenes` like `reconcileBedroomKeys`; in `shareKey`, look the room's owner up
across scenes (a `bedroomOwnerAnywhere(room)` helper) or copy the giver's key description verbatim.
**Pitfalls:** two scenes with a region of the same name - the key flag is a bare name, already documented as a
known cost at `KEY_FLAG`.

### ITEM-17 [severity: nit] [category: hygiene] [CONFIRMED]
**Where:** `scripts/inventory.mjs:565-569`
**What happens:** `grantItem`'s doc comment still says "the guide caps crime tools at one and cleaning tools at two
on purpose"; the rule is the shared two-slot Gear group since G-43/D10c.
**Fix:** reword to "the carry limits (see LIMIT_GROUPS)".

### ITEM-18 [severity: nit] [category: hygiene] [CONFIRMED]
**Where:** `scripts/gm-items.mjs:141-143, 297-299, 405-407, 830-832, 1196-1198`
**What happens:** The same `studentActors().map(a => <option ...selected>)` recipient builder is written five
times in one file (plus once in `projects-ui`). One `recipientOptions(students, selectedId)` helper.

## Live checks recommended (things statics cannot settle)

1. ITEM-02: open Room Setup on a world whose regions predate E11, tick "Stash hidden" on the Bedrooms tab only,
   Apply, reopen - expect the box unticked and the Stashes tab still "open".
2. ITEM-03: as a player propose an indirect murder, approve from the card without touching "Also visible to";
   check the proposer's Work on Project list and the Daggerheart tray on their client.
3. ITEM-04/05: Search twice for a tool with nothing readied (two stowed, no warning); then ready one, stow the
   other in the bedroom, ready the first, retrieve - two fist badges on the sheet.
4. ITEM-08: plant an item, delete the project in the manager, Search the room - the plant still comes out.
5. ITEM-15: rename a tier pool in the editor, reload as GM, check the sidebar name.
6. ITEM-16: GM viewing scene B, dorms on scene A: Give / take items -> Give a key.
7. Hub liveness: with the hub open, have a player stow an item and take one out - the "Usables: 1/3" line and the
   "in the stash" tag should follow (`keepLive` watches `updateItem`; `stow` is an `item.update`, so it should).
8. Trap alert audience: on a two-account world confirm the `gmOnly` alert card does not appear in the killer's
   messenger thread (traps.mjs:262-268 relies on `callGm`'s `gmOnly` branch).

## Hygiene metrics

Largest functions (>= 120 lines):
- `vault.mjs openRoomSetupDialog` 717 (1601-2318) - seven tabs, form read, apply loop and stash matrix in one body
- `tables.mjs openItemTables` 749 (1350-2098) - dialog build + `wirePane` (rename, delete, place, drop, icon, roles, focusout)
- `gm-items.mjs gmGiveItemDialog` 380, `giveTruthBulletDialog` 273, `openItemManager` 215, `takeItemDialog` 155
- `projects-ui.mjs openProjectDialog` 254, `openProjectManager` 207
- `vault.mjs stealFromVault` 190, `stealFromPerson` 183, `plantOnPerson` 140
- `tables.mjs tableItemsHtml` 162, `installTables` 158, `usableKindFor` 142 (mostly comment), `drawItem` 132
- `inventory.mjs grantItem` 133

Duplicated helpers:
- recipient/student `<option>` builders x5 in gm-items.mjs (ITEM-18), x2 in projects-ui.mjs
- `const esc = foundry.utils.escapeHTML` re-declared locally in vault.mjs (x4), traps.mjs (x2), projects.mjs,
  action-rolls; utils.mjs already exports `esc`
- item describer `name - Category (Tn)` written in `rifleStashDialog` (vault.mjs:893), `takeItemDialog`
  (gm-items.mjs:1188) and `holdingsFor` (gm-items.mjs:110) with three slightly different shapes
- `ownerIdsOf(actorId)` in projects.mjs duplicates `ownerOf`'s permission test in utils.mjs (all owners vs first)

Exports with no caller outside their file (candidates to un-export or delete):
- inventory.mjs `newItemIdentity` (internal use only)
- use-items.mjs `readiedItem` (one internal use), `stowedInGroup`, `mayStow` (internal; see ITEM-04)
- vault.mjs `vaultRoomOwnedBy`, `atOwnVault` (documented compat), `hasFoundStash`, `stashesFoundBy` (tests only)
- tables.mjs `existingTableName`, `rolesForPoolItem`, `tierTableIdFor` (internal)
- projects.mjs `countsUp` (internal)

Stale comments: `inventory.mjs:565-569` (ITEM-17); `projects-ui.mjs:816-818` (ITEM-03); `vault.mjs:84-93`
"setStash writes stashes instead" while `setVaultRoom` still writes the legacy flag (ITEM-02).

Magic numbers: `projects.mjs:319` default `target = 4` and `projects-ui.mjs:733,767` `|| 4` duplicate
`PROJECT_SCALE.everyday.progress`; `traps.mjs:381` `randomID(16)` duplicates `newItemIdentity()`.
