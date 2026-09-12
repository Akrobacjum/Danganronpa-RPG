# MAP - findings

Domain: canvas - fog, visibility, movement, rooms. Static read of every file below end to end,
plus the neighbours each flow crosses into (actions.mjs, eclipse.mjs, settings.mjs, sync.mjs,
gm-bridge.mjs, murder.mjs, remnants.mjs, remnant-ring.mjs, traps.mjs, vault.mjs, migrate.mjs,
season-setup.mjs, motion.css). No repository file was edited.

## Files read (with line counts)

| File | Lines |
| --- | --- |
| scripts/fog.mjs | 5884 |
| scripts/movement.mjs | 1250 |
| scripts/visibility.mjs | 506 |
| scripts/motion.mjs | 379 |
| scripts/iso-shield.mjs | 215 |
| scripts/stacking.mjs | 96 |
| scripts/no-scrolling-text.mjs | 70 |
| scripts/no-collapse.mjs | 50 |
| scripts/config.mjs (ROOMS_PER_PLAYER, ROOMS, ECLIPSE_MOVES, ECLIPSE_FREE_PLACEMENT, ROOM_OWNER_FLAG/BEDROOM_KEY_FLAG, AFTER_DARK) | lines 290-340, 2344 |
| Cross-domain, read in part: actions.mjs (30-110, 215-275), eclipse.mjs (55-100, 615-730), settings.mjs (978-1035, 1185-1245, 1318-1345), sync.mjs (60-130, 270-376), gm-bridge.mjs (1225-1260), murder.mjs (79-160, 205-230, 2560-2582), remnant-ring.mjs (60-135, 387-460), traps.mjs (535-600), vault.mjs (1620-1700, 2100-2135), migrate.mjs (300-372), season-setup.mjs (880-900), styles/motion.css (108-145), lang/en.json (all keys the domain uses) | |

i18n: every key used by the domain resolves in lang/en.json. `DRPG.Fog.scenesPrepared` and
`DRPG.Move.wasSprint` exist only as `.one/.other` and are read through `plural()`, which is correct.

## Strengths

- **Failure direction is designed, not hoped for.** `repaintFog` builds off-screen, verifies the
  current room was actually cleared (`built.cleared`), and `stand()`s with a named reason on every
  early exit; `watchdog()` guarantees every overlay comes down even if `CanvasAnimation` never ticks.
  `diagnoseFog`/`whyBlack`/`whatIsHere`/`checkRegions` read the screen back instead of intent.
- **The hot paths are already budgeted.** `repaintFog` is not on `refreshToken`; `onUpdateToken`
  (fog and movement) waits for `movement.pending.waypoints` to drain, so a v14 multi-segment move
  costs one rebuild and one settlement; `visibility.mjs` memoises `myRooms()`/`myRemnantRefs()`
  and schedules at most one `requestAnimationFrame` re-assert per frame; `canvasPan` in both
  fog.mjs and remnant-ring.mjs is gated on a fifth of a zoom step and does nothing on a pan.
- **Ownership of GPU textures is explicit.** Each fog sprite carries its own texture pair
  (`drpgTexture`/`drpgMaskTexture`), the doorway glow marks its render texture with
  `drpgOwnedTexture` and `freeOwned()` walks it, `dropSprite` refuses to destroy a texture the
  raster mask still points at (the documented "white flash").
- **The movement veto is synchronous and the charge is single-sourced.** `preUpdateToken` refuses
  before anything is written; `updateToken` settles once per drag on exactly one client
  (`owner ?? primary GM`, movement.mjs:662-665), with the route's real crossings
  (`crossingsAlong`), and `REVERT` marks the send-back so it is never charged. Keyboard and ruler
  moves go through the same document pipeline, so they need no separate path.
- **Monokuma and Mastermind leave no track in the ledger** - `recordDiscovery` and
  `seedDiscovery` both skip them, migrate.mjs `forgetMonokumaWalks` cleans old worlds, and there
  is a self-test for it (tests.mjs:5291).
- **The cross-scene room test was fixed properly** (`regionsAt` passes elevation to
  `RegionDocument#testPoint`, measures with that scene's grid, and distinguishes "outside" from
  "cannot ask").

## Findings

### MAP-01 [severity: major] [category: bug] [CONFIRMED]
**Where:** scripts/visibility.mjs:263-285 (`myIncidentTrace`), against scripts/murder.mjs:79, 143-158, 205-230, 2560-2578
**What happens:** D11 ("the crime scene belongs to the people who were standing in it") is dead on
every player client. `myIncidentTrace` reads the RAW world setting `murderState` and expects
`victimId`, `killerId`, `thirdId`, `thirdSide` on it. Since LIVE-001 those five fields are
`CAST_FIELDS` and are split OUT of that setting by every writer (`writeState`, `restoreState`) and
stripped by `migrateIncidentSecrets`; they live in the client-scoped `incidentCast`. So `ids` is
always empty, the function always returns `false`, and a revealed incident trace is hidden from
the killer and the victim exactly as from a bystander - the same failure shape the function's own
comment describes as already fixed once ("D11's whole client half silently did nothing").
**Evidence:**
```js
// visibility.mjs:267-278
const state = game.settings.get(MODULE_ID, "murderState");
if (!state?.active) return false;
const ids = new Set([state.victimId, state.killerId].filter(Boolean));
if (state.thirdId && state.thirdSide === "killer") ids.add(state.thirdId);
// murder.mjs:79 / 216-219
const CAST_FIELDS = ["killerId", "killerTurnId", "victimId", "thirdId", "thirdSide"];
...
if (CAST_FIELDS.includes(key)) castPatch[key] = value; else publicPatch[key] = value;
```
**Fix:** read the cast the way movement.mjs already does - `incidentParticipants()` from
settings.mjs (a leaf, safe to import statically) gives the three ids; if the "killer-side third
only" distinction must survive, read `game.settings.get(MODULE_ID, SETTINGS.incidentCast)` for
`thirdSide` (each participant holds their own copy). Keep `state.active` from `murderState`.
Also use `SETTINGS.murderState` instead of the literal string.
**Pitfalls:** `incidentCast` arrives by socket after `murderState` syncs; `applyAll` is already
re-run on `createItem`/`updateToken`, but add `incidentCast`'s `onChange` to the invalidation list
(`forgetMyRooms` + `applyAll`) or the trace stays hidden until the next token refresh. Add a test
in tests.mjs that constructs the split state and asserts `myIncidentTrace` is true for the killer.

### MAP-02 [severity: major] [category: leak] [SUSPECTED]
**Where:** scripts/visibility.mjs:204-215 (`applyToToken`), 38-45 (`refreshToken`)
**What happens:** The hide/show decision for another character's token is made against
`token.document` (already at the destination the instant the update lands) while the mesh is
still animating from the old position. When somebody walks INTO the viewer's room, the token
flips to visible on the first animation frame while its sprite is still in the previous room and
slides across the boundary - so the viewer sees which room they came from. Leaving is safe (the
document is already elsewhere, so the token vanishes at frame one). For a Monokuma this shows the
GM's route; for a killer it shows the direction of the crime scene. The Eclipse branch is
unaffected (everyone hidden).
**Evidence:**
```js
// visibility.mjs:207-215
const mine = myRooms();
const room = roomOfToken(token.document);   // document position, not the animated mesh
...
if (room && mine.has(room)) return;
hide(token);
```
`refreshToken` fires every animation frame, so the mechanism to re-decide per frame is already
there; only the position read is wrong for the entering case.
**Fix:** in `applyToToken`, when the document's room is mine but the placeable's current
position is not (`roomAt(token.x, token.y, token.document)` off the animated `token.position`),
keep the token hidden; the per-frame `refreshToken` will flip it when the sprite crosses the
border. Cost: one region test per animating non-owned token per frame.
**Pitfalls:** `roomAt` is not exported from movement.mjs today (only `roomOfToken`/`regionsAt`);
export it. Make sure the check does not apply to the viewer's own token (`show` first, as now).
Needs one live drag watched from a second seat to confirm the frame-one flash.

### MAP-03 [severity: major] [category: leak] [SUSPECTED]
**Where:** scripts/movement.mjs:246-260, 295-301; lang/en.json:1928, 1959
**What happens:** A refused crossing tells the player every neighbouring room by name -
"{to} is not connected to {from}. From here you can reach: {rooms}" - including rooms that are
under full fog on their screen and that no character has ever entered. The fog layer's whole
contract (fog.mjs header: "an unvisited room has to stay unreadable") is undone by one
notification the player can trigger at will by dragging at a black patch. The same string is
used for the Eclipse (`DRPG.Eclipse.notConnected`).
**Evidence:**
```js
// movement.mjs:254-258
return game.i18n.format("DRPG.Move.notConnected", {
    from, to, rooms: connected.join(", ")
});
```
**Fix:** filter `connected` on the player's client to rooms in their own discovery set before
formatting (fog.mjs already computes it - export a `knownRooms()` reader), or drop the list and
say only "{to} is not connected to {from}". Same for the Eclipse string. Marked SUSPECTED only
because the design may treat room names as public (a school map); the fog design says otherwise.
**Pitfalls:** `neighbouringRooms` is also used by the Eclipse placement table and by the sheet's
Move tile; only the notification text should be filtered, not the adjacency itself.

### MAP-04 [severity: minor] [category: bug] [CONFIRMED]
**Where:** scripts/fog.mjs:1056, 2422-2431, 2500-2501, 359-372, 2515-2520
**What happens:** `lastLedgerSeen` (the GM's "what the class had found at the last paint") is
never reset on scene change or on `stand()`. The first repaint after the GM switches from scene A
to scene B computes `opened = ledgerRooms(B) − lastLedgerSeen(A)` and plays
`playDiscoveryAnimation(opened[0])` - the five-second "you have never been here before" curtain
plus the `roomDiscovered` sound - for a room that was discovered weeks ago, every time the GM
changes scene (or comes back from a stood-down fog).
**Evidence:**
```js
// fog.mjs:2424-2431
if (game.user.isGM) {
    if (lastLedgerSeen) {
        opened = Array.from(current).filter(room => !lastLedgerSeen.has(room));
    }
    lastLedgerSeen = new Set(current);
}
// fog.mjs:2500-2501
if (opened.length) playDiscoveryAnimation(opened[0], null);
```
Neither `canvasTearDown` (359-372) nor `stand()` (2515-2520) touches `lastLedgerSeen`.
**Fix:** key it by scene (`lastLedgerSeen = { sceneId, rooms }`) and seed silently when
`sceneId` differs; reset it in `stand()` and on `canvasTearDown`.
**Pitfalls:** the same silent seed must apply on the first paint after `onFogSettingChanged`, or
turning the setting off and on replays every discovery.

### MAP-05 [severity: minor] [category: bug] [CONFIRMED]
**Where:** scripts/fog.mjs:2451-2454 vs 2497
**What happens:** The "unchanged picture" shortcut returns BEFORE the outline check, and for a GM
the paint signature does not depend on where their Monokuma stands (`current = ledgerRooms`). So
a Monokuma walking from a room into a corridor (no region) leaves that room's outline, name and
doorway glow standing until the GM enters another room. Same for a player during an Eclipse
(`current` is empty and `discovered` already held the room via the mirror).
`onUpdateToken` cannot help: `entered` is null in a corridor so nothing is announced.
**Evidence:**
```js
// fog.mjs:2451-2454
if (signature === lastPaintSignature && findLayer()?.visible) {
    lastFogReason = `unchanged: ${lastFogReason}`;
    return true;
}
...
// fog.mjs:2497 - never reached in that case
if (roomOutline && !mine.has(roomOutline.room)) fadeRoomOutline();
```
**Fix:** move the `fadeRoomOutline` check above the signature shortcut (it is a one-line Set test
and `mine` is already computed), or add `signatureOf(mine)` to the signature.
**Pitfalls:** none if moved; if added to the signature, every Monokuma step across a room boundary
becomes a full texture rebuild for the GM, which the comment on `lastPaintSignature` explicitly
avoided.

### MAP-06 [severity: minor] [category: bug] [CONFIRMED]
**Where:** scripts/fog.mjs:3396-3418 (`roomEnteredByMe`), 692-704 (`recordDiscovery`)
**What happens:** The Mastermind's rows are never written to the ledger (deliberate, so the GM's
veil does not narrate their walks), but `roomEnteredByMe` decides "new" from
`discoveredFor(scene, actor)`. For the Mastermind that is always empty, so every room they enter
for the first time in a session plays the full discovery reveal - re-covering with veil and
opening with the curtain a room their own fog already shows as known (`myDiscoveredRooms` gives
them every room). Contradicts the fog on the same screen; also fires at `canvasReady` through
`revealStartingRooms`.
**Evidence:**
```js
// fog.mjs:3409-3411
const seen = game.user.isGM
    || discoveredFor(scene.id, actor.id).includes(room)
    || animatedAlready.has(key);
```
**Fix:** `|| iAmTheMastermind()` (already imported from settings.mjs), so they get the outline
and the name like a GM.
**Pitfalls:** none; `myDiscoveredRooms` already treats them as knowing every room.

### MAP-07 [severity: minor] [category: perf] [CONFIRMED]
**Where:** scripts/fog.mjs:2975, 1112-1114, 1134-1136, 3020-3028
**What happens:** The drift ticker runs every frame for the whole session while fog is on, and
per frame it (a) calls `motionOff()` → `window.matchMedia(...)` (allocates a MediaQueryList each
call), (b) calls `colourOf("--drpg-ink")` → `getComputedStyle(documentElement)` (a synchronous
style read), and (c) `clear()`/`beginFill`/`drawRect` on the backdrop `Graphics`, rebuilding and
re-uploading its geometry every frame although width, height and colour change a few times a
session. `pinToScreen` also allocates `worldTransform.clone().invert()` per frame per group.
**Evidence:**
```js
// fog.mjs:3020-3028 (inside driftTick, every frame)
sprite.clear();
sprite.beginFill(colourOf("--drpg-ink", 0x1a1620), 1);
sprite.drawRect(0, 0, width, height);
sprite.endFill();
```
**Fix:** cache `{width, height, ink}` on the Graphics and redraw only on change; read the ink once
in `ensureBackdrop` and again from the existing `MutationObserver` (it already fires on theme /
time changes); read the reduced-motion answer once and refresh it from a `matchMedia().addEventListener("change")`
plus the body-class observer. Reuse one scratch `PIXI.Matrix` in `pinToScreen`.
**Pitfalls:** keep the width/height resize path - the renderer's screen size changes on window
resize and the sprites must follow.

### MAP-08 [severity: minor] [category: bug] [CONFIRMED]
**Where:** scripts/fog.mjs:1112-1114 vs scripts/motion.mjs:88-97, styles/motion.css:128-145, settings.mjs:1426
**What happens:** fog.mjs carries its own `reducedMotion()` that reads only the OS media query.
The module's own "Reduced motion" client setting puts `drpg-reduced-motion` on `<body>`, and
motion.mjs/glass.mjs honour it. The fog does not: the 5.4 s discovery curtain (`DISCOVERY_MS` is
a constant, not a token), the raster drift, the outline bounce and the per-pixel dissolve all keep
playing for a player who asked the module to hold still. Only the durations read through
`ENTER()`/`BEAT()` go to 1 ms.
**Evidence:**
```js
// fog.mjs:1112-1114
function reducedMotion() {
    return Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
}
```
**Fix:** delete the local copy and import `reducedMotion` from motion.mjs (already imported for
`ENTER`/`BEAT`, no cycle).
**Pitfalls:** `motionOff()` also gates `swapInFog`'s dissolve; with the class set it will swap
outright, which is the intended behaviour.

### MAP-09 [severity: minor] [category: perf] [CONFIRMED]
**Where:** scripts/fog.mjs:3134-3146 (`clearLayer`), 359-372 (`canvasTearDown`), 1147-1160 (`freeOwned`)
**What happens:** `clearLayer` destroys every non-fog child with `destroy({children: true})`,
including the FX group that holds the standing outline and its doorway glow. The glow owns a render
texture (`drpgOwnedTexture`, up to 2048 px) that only `freeOwned` releases - and `clearLayer` never
calls it. `canvasTearDown` runs `hideLayer()` (→ `clearLayer`) BEFORE `clearTransient()`, so by the
time `clearTransient` looks for the FX group it is already gone and `freeOwned` never runs. One
glow texture leaks per scene change and per `stand()` while an outline is up.
**Evidence:**
```js
// fog.mjs:3142-3143
if (child.name === FOG_SPRITE) dropSprite(child);
else child.destroy({ children: true });        // FX_GROUP: no freeOwned
// fog.mjs:361-367
hideLayer();
dropBackdrop();
clearTransient();                              // finds nothing - already destroyed
```
**Fix:** in `clearLayer`, `freeOwned(child)` before `destroy` (or call `clearTransient()` first in
both `hideLayer` and the teardown hook).
**Pitfalls:** `freeOwned` nulls the texture reference before destroying; keep that order so a
sprite is never left pointing at freed memory.

### MAP-10 [severity: minor] [category: text] [CONFIRMED]
**Where:** lang/en.json:1958 (`DRPG.Move.noBudget`), 1927 (`DRPG.Eclipse.noMovesLeft`); movement.mjs:130, 275, 233, 788-797; eclipse.mjs:645
**What happens:** Both refusals are shown in two situations with opposite outcomes and the text
fits neither:
- `noBudget` = "No free Move and no actions left. Move your token back." From the `preUpdateToken`
  veto (movement.mjs:275→130) the token never moved, so there is nothing to move back; from the
  settlement (788-797) the module sends it back itself, so the instruction is wrong again.
- `noMovesLeft` = "Both Eclipse crossings are used. Your token has been put back." From the veto
  (233) nothing was moved; under Darkness the allowance is one, so "Both" is wrong too.
**Fix:** "No free Move and no actions left." and "No Eclipse crossings left." for the veto; let
`noBudgetLong` (the whisper) keep the fuller sentence, minus "Move back" since `sendBack` does it.
**Pitfalls:** `DRPG.Move.notConnected` and `DRPG.Eclipse.notConnected` are byte-identical -
fold into one key while here.

### MAP-11 [severity: minor] [category: ux] [CONFIRMED]
**Where:** scripts/movement.mjs:216-275 (`canCross` budget test), 700-712, 775-800 (`chargeForCrossing`)
**What happens:** The veto judges each segment of a multi-waypoint route against the budget as it
stands BEFORE the route is charged (charging happens once at settlement). A route of three rooms
with one free Move and no actions passes all three vetoes; at settlement crossing 1 spends the free
Move, crossing 2 is refused and `sendBack` returns the token to the drag's start. The player ends
where they began with their free Move gone. The comment calls the paid crossing "made", but the
token is not standing in that room.
**Evidence:**
```js
// movement.mjs:706-711
for (const [from, to] of crossings) {
    const paid = await chargeForCrossing(actor, from, to, tokenDoc, previous);
    if (!paid) return;
}
```
**Fix:** either make the veto path-aware (count crossings already noted in `pathRooms` for this
token when testing the budget in `canCross`), or on refusal send the token back to the last room
that WAS paid for (the `from` of the refused crossing, position = the boundary crossing point or
the room's centre) rather than to `previous`.
**Pitfalls:** `sendBack` needs a position, and the only certain-legal position it holds is
`previous`; a "centre of `from`" fallback is fine for a room but not for a corridor-less map.

### MAP-12 [severity: minor] [category: leak] [SUSPECTED]
**Where:** scripts/fog.mjs:15-24 (header), settings.mjs:984-990 (`discoveredRooms`, world scope)
**What happens:** The discovery ledger is a world setting keyed `{scene: {actorId: [rooms]}}`
and is readable on every client (`game.settings.get("danganronpa-rpg","discoveredRooms")`). The
header declares it not a secret, and the Mastermind is kept out of it. But in a killing game
"which rooms has X been in" is alibi evidence; a player with the console open can list every
other character's visited rooms for the season. Argued against the documented decision because
the module elsewhere (LIVE-001, `incidentCast`, the Mastermind, Truth Bullet answer keys) moves
exactly this kind of per-actor fact out of world data.
**Fix:** if it matters at this table: keep the union for the GM in a GM-only store and ship each
player only their own rows (client setting written by the primary GM over the addressed socket, the
`incidentCast` pattern). If it does not, say so in the setting's hint so the decision is visible
to a GM.
**Pitfalls:** the mirror already covers the player's own rows for the session; the GM's veil
needs the union, so the GM path must stay world- or GM-scoped.

### MAP-13 [severity: minor] [category: perf] [CONFIRMED]
**Where:** scripts/fog.mjs:2377, 2440-2454, 298-303
**What happens:** `repaintFog` runs the "first guard" - `regionShapes()` for EVERY region (a
polygonTree walk and a flat-array copy per polygon) - before the signature short-circuit, so every
call that ends "unchanged" still pays a full geometry pass. It is called for every `createToken`
and `deleteToken` of any kind (a Remnant placed, a GM dropping a token) on every client.
**Evidence:**
```js
// fog.mjs:2377 - before the signature test at 2451
const readable = regions.filter(r => regionShapes(r, rect).length).length;
```
**Fix:** compute the signature first (it needs only names and the Eclipse flag), then the
readable guard. Optionally gate the `createToken`/`deleteToken` hooks on
`doc.actor?.type === "character"`.
**Pitfalls:** the signature must stay AFTER `myCurrentRooms`/`myDiscoveredRooms`; those are cheap.

### MAP-14 [severity: minor] [category: hygiene] [CONFIRMED]
**Where:** scripts/fog.mjs:56, 2337-2342, 3054-3056, 3061-3097 + 2626, 1487-1489, 1047/1066/1335; scripts/movement.mjs:468-476, 539-543
**What happens:** Comments that no longer match the code:
- `FOG_BUILD = "2026-08-26 · glow-field-trend"` with "Bump it whenever the drawing behaviour
  changes" - the file records drawing changes dated 07.09 and 08.09 (seam width, glow passes,
  Special Elite label) and the stamp was not bumped, so `diagnoseFog()` can no longer prove which
  build a browser loaded, which is the stamp's only job.
- 2341: "see the header note on why this is not hooked to `refreshToken`" - there is no such note;
  `refreshToken` appears nowhere else in the file.
- 3056: `ownTokenClearances` "See pass 4 above for why" - pass 4 was removed; the function is now
  called on every build (2626) purely to fill a diagnostic array.
- 1487-1489: two orphaned one-line docblocks stacked above `accentColour`'s real one.
- 1047, 1066, 1335: "220ms dissolve" - the duration is `ENTER()` (180 ms per the note at 231).
- movement.mjs:468-476: `regionsAt` is "for the one caller that needs ALL of them ... vision
  restriction (see visibility.mjs's `clipVisionToRoom`)" - that function was removed
  (visibility.mjs:67-84); `regionsAt` has no external caller and `export` is dead.
- movement.mjs:539-543: `onPreCreateToken` promises "free positioning rather than grid snapping";
  it only sets `lockRotation`.
**Fix:** bump/derive the build stamp (module version + a hash is enough), delete the dead
references, drop `export` on `regionsAt`, and either remove `ownTokenClearances` from the build
path or compute `lastClearances` lazily in `diagnoseFog`.

### MAP-15 [severity: nit] [category: hygiene] [CONFIRMED]
**Where:** scripts/fog.mjs (whole file), remnant-ring.mjs
**What happens:** Duplicated helpers and repeated literals across the domain:
- glass detection `getSetting(SETTINGS.theme) === "stainedGlass" || body.classList.contains(...)`
  appears three times in fog.mjs (3575, 4098, 5823) and again as `glassOn()` in remnant-ring.mjs.
- the seam glow recipe `[[2.6, 0.46], [1.8, 0.50], [1.2, 0.58]]` is written out at 3611, 4299-4301,
  4352 and in remnant-ring.mjs:484.
- polyline run-length is re-implemented four times (`lengthOf` 5242, `trimPolyline` 5106,
  `traceOutlineGapped` 5672, `whatIsHere` 1786); point-to-segment distance is inlined twice in
  `whatIsHere` beside the `distanceToSegment` function.
- the "60 ms settle" MutationObserver and the `0.18` zoom threshold are copied between fog.mjs and
  remnant-ring.mjs; `1024` (reveal texture cap), `0.5` (chain join tolerance), `1.4`/`13`
  (band pitch) are magic numbers in `playDiscoveryAnimation`.
**Fix:** one `glassOn()` and one `SEAM_GLOW` table exported from a small theme leaf (or
motion.mjs), a `polylineLength()` helper, and the two thresholds as named constants.

## Live checks recommended (things statics cannot settle)

1. MAP-02: from a second seat, watch a character (and a Monokuma) walk into your room - does the
   sprite appear at its old position and slide in?
2. MAP-03 / visibility: `hideMovementTrail` sets `token.ruler.visible = false` (visibility.mjs:335-338)
   and nothing ever sets it back; confirm (a) a remote user's drag ruler is that object on 14.365,
   (b) Foundry's `TokenRuler#refresh` does not re-show it mid-drag, (c) a token that later becomes
   visible gets its ruler back.
3. Eclipse budget race: two quick crossings on a player's client before the GM's `eclipseMoves`
   write lands - `canCross` (movement.mjs:232) and `movesLeft` both read the stale world setting.
   Same shape for `freeMoveUsed` on a fast double drag (actions.mjs:250-253).
4. `restoreSceneVisionMode` (fog.mjs:517-543) only restores `fog.mode` when the saved value is a
   finite number (`Number.isFinite(before.fogMode)`); if v14's `CONST.FOG_MODES` members are
   strings, turning the setting off leaves Foundry's exploration fog disabled on every scene.
   Check `CONST.FOG_MODES` in the console.
5. MAP-04: switch scenes as GM with a discovered room on both and watch for the curtain + sound.
6. `seedDiscovery` at `createToken` (fog.mjs:298-302) seeds `canvas.scene`, not the token's
   scene; drop a token onto a scene you are not viewing and check the ledger for that scene.

## Hygiene metrics (largest functions, duplicated helpers, dead exports you found)

fog.mjs functions over 150 lines (measured, first `}` at column 0 after the signature):

| Function | Lines | Split suggestion |
| --- | --- | --- |
| `playDiscoveryAnimation` | 528 (3543-4070) | setup of the four textures/sprites (~140 lines) → `buildRevealSurfaces(region, bounds, glass)`; the per-frame `ontick` (~230 lines) → three phase functions `cutPhase/holdPhase/curtainPhase` returning `{at, top, bottom, opening}` plus `paintLines(...)`, `paintStains(...)`; the band-stain seeding (~25) → `stainPlan(room, lines)` |
| `addDoorwayGlow` | 379 (5173-5551) | `measureOpenings(edges, rect)` (chains → runs, amplitude, spans, `lastGlow`), `renderGlowField(runs, box)` (the 16-level loop), `cutGlowEnds(...)` (ramps + beyond + inward ribbon), `eraseRoom(...)` |
| `flashOutline` | 327 (4081-4407) | `strokeOutline(edges, region, rect, theme)` returning the Graphics + `recolour/rewidth` closures, `makeRoomLabel(region, bounds, theme)`, `seamHalo(...)`, and the two animations (`bounce`, `fadeLabel`) as helpers |
| `checkRegions` | 220 (1924-2143) | diagnostic; one function per check (`overlapCheck`, `adriftCheck`, `noWayOutCheck`, `latticeCheck`) pushing into `findings` |
| `repaintFog` | 170 (2343-2512) | `decideFogSets(scene)` → `{mine, current, discovered, opened}`; `replaceLayerChildren(container, built, rect)` |
| `whatIsHere` | 154 (1750-1903) | diagnostic; `nearestOutline`, `glowAlphaAt`, `nearestBorderAndWall` |
| `swapInFog` | 150 (1232-1381) | `startDissolve(container, previous, sprite, ...)` for the mix-texture branch |

Next: `doorwayEdges` 145, `buildFogTexture` 129, `traceOutlineGapped` 119, `registerFog` 118.
movement.mjs: `onUpdateToken` 156 (560-715) - the settlement (`crossings` → Eclipse → economy)
could be `settleRoute(actor, tokenDoc, before, path, after, previous)`; `canCross` 100.
visibility.mjs: `applyToToken` 79. Everything else in the domain is under 60 lines.

Duplicated helpers: `reducedMotion` (fog.mjs vs motion.mjs - MAP-08), glass detection ×4,
seam-glow table ×4, polyline length ×4, point-segment distance ×3, the 60 ms theme observer ×2,
`colourOf`/`cssColour` (fog) vs `colourOf(type)` (remnant-ring) all reading `getComputedStyle`.

Dead / unused: `export` on `regionsAt` (movement.mjs:480) - no external caller;
`ownTokenClearances` result unused by drawing (fog.mjs:2626, 3061); `DRPG.Eclipse.notConnected`
duplicates `DRPG.Move.notConnected` byte for byte; `fogPeek`/`whyBlack`/`doorwayReport`/
`whatIsHere`/`checkRegions` are ~640 lines of console diagnostics inside the file that draws -
a `fog-diagnostics.mjs` would take the drawing file under 5k lines without touching behaviour.

Per-frame / per-update cost summary (what the brief asked for):
- `refreshToken` (every frame of every animation/drag): visibility `applyToToken` ×1 + one
  scheduled rAF pass over all tokens (`applyToToken` ×N, cheap - `tokenDoc.regions` fast path);
  remnant-ring `paint` ×1 (clears and restrokes two Graphics per Remnant token). No fog work.
- `canvasPan`: fog `rezoomRoomOutline` and remnant-ring both no-op under 18 % zoom change; on a
  real zoom under Stained Glass: re-stroke of the outline + halo (two `traceOutlineGapped` walks)
  and a `paint` of every token. No textures rebuilt.
- `updateToken` (every segment of a v14 move, all clients): visibility `applyAll` → N
  `renderFlags.set` + N `applyToToken` (then N `refreshToken` hooks); fog and movement return
  early while `movement.pending.waypoints` is non-empty. On the final segment: fog
  `myCurrentRooms` (N × `roomOfToken`) and, only if the owner's room set changed, one full
  texture rebuild (two 2048 px render textures + a third for the dissolve + `renderer.render` per
  frame for 180 ms) and possibly a reveal/outline (`doorwayEdges`: samples × (regions + walls +
  one `testCollision`), `addDoorwayGlow`: 16 render passes + 2 render textures).
- Every frame regardless (fog on): the drift ticker - MAP-07.
- Nothing is O(rooms × tokens) per frame; `myRooms()` memoisation in visibility.mjs is what keeps
  `applyAll` at O(tokens).
- Listeners: all `Hooks.on` are registered once at init; the two `MutationObserver`s are
  registered once and never disconnected (acceptable - they live as long as the page); the drift
  ticker is removed in `clearLayer`; the fog container is hidden, not destroyed, across scenes
  (documented) and its children are destroyed - except the glow texture (MAP-09).
