/**
 * Danganronpa RPG - players only see who is in the room with them.
 * ---------------------------------------------------------------------------
 * Guide: "Players see other players only in the same room."
 *
 * Walls and vision get most of the way there, but not all: a player standing in
 * a doorway, a room with an open archway, or a scene built without walls will
 * all leak. This enforces the rule directly on token visibility, so it holds
 * regardless of how carefully the map was drawn.
 *
 * The GM always sees everything. A player always sees their own token.
 *
 * A revealed Remnant token gets the same treatment, on a different rule: once
 * somebody's first Observe reveals it (see `revealRemnantToFinder` in
 * remnants.mjs), Foundry's `hidden` flag is off for the whole table - but the
 * guide's Truth Bullet is a PERSONAL copy, not a public unveiling, so anyone
 * who has not found this exact trace themselves still needs it invisible.
 * `applyToRemnantToken` below is that second rule, running on the same hook.
 *
 * WHAT THE BUS ASKS OF THIS FILE (E37 C5, 01.11.2026; audit S17-19, S07-26). A whole pass (`applyAll`) for a change of
 * the clock is the bus's: sync.mjs `KIND_REFRESH` runs it once when the time of day, the phase or the Eclipse's flag
 * moved, and none for a pause; this file listened to `drpgTimeOfDayChanged` and `drpgEclipseChanged` as well, which
 * the same row fires, and ran it twice (scenario 81 at 2b2707ec: 2 passes on every browser for a time of day, 2 for an
 * Eclipse's start). A change of the incident or of this browser's copy of its cast asks one too (`SYNC.incident`), so
 * `myIncidentTrace` reads the cast that stands. The listeners below are for what is no clock and no incident.
 */

import { MODULE_ID, FLAGS } from "./config.mjs";
import { flaggedSpectator, spectatorViewer, isMonocubCorpse } from "./spectator.mjs";
import { SETTINGS, isEclipse, incidentParticipants, incidentCast } from "./settings.mjs";
import { roomOfToken, roomAt, whenAtRest } from "./movement.mjs";
import { isMoveChange } from "./rooms.mjs";
import { REMNANT_FLAGS, keyOf as remnantKeyOf } from "./remnants.mjs";
import { TRUTH_BULLET_FLAGS, ownBulletRefs } from "./truth-bullets.mjs";
// Static, like movement.mjs's own import of the same file: `applyToToken`
// runs on every token of every refresh, so its readers cannot be dynamic.
// mastermind.mjs does not reach back into this file at load time - its one
// call to `applyAll` is a dynamic import - so there is no cycle.
import { myLairRoom } from "./mastermind.mjs";
import { knowsProject } from "./projects.mjs";
import { projectIdOf } from "./projects-map.mjs";
// What a player saw last (PV, 13.11.2026): a project's token as the tray shows its row. It reaches no file that imports this one.
import { tokenShownAsSeen, forgetSeenPass, tintAsSeen } from "./projects-seen.mjs";
import { debug } from "./utils.mjs";
// E88 C0: the counters `fps()` and scenario 86 read (perf-counters.mjs); an increment each, nothing timed.
import { count } from "./perf-counters.mjs";
import { userVeiledFromHere } from "./mask-gm.mjs";

export function registerVisibility() {
    // A token this browser hides gives it no sight (E112v): the token class's vision-source test asks `tokenShownTo` too.
    Hooks.once("ready", () => installSightRule());
    // A hidden token's ruler (owner-116): the ruler class asks this file's rule for each write of its `visible`.
    import("./fog-doorways.mjs").then(m => { doorways = m; m.setRulerShown(rulerHere); })
        .catch(err => debug("Visibility: the token ruler's rule could not be set", err));
    // `refreshToken` is the one that matters: Foundry recomputes `visible` from
    // its own vision logic on every refresh, so setting it from `sightRefresh`
    // alone was immediately overwritten - which is why standing at a gap in a
    // wall still showed the room beyond.
    Hooks.on("refreshToken", (token, flags) => {
        count("refreshToken.visibility");
        refreshHeard(token, flags);
    });

    Hooks.on("sightRefresh", () => { count("visibility.sightRefresh"); sightPassNextFrame(); });
    Hooks.on("canvasReady", () => applyAll());
    Hooks.on("updateToken", (doc, changes) => passForTokenUpdate(doc, changes));
    Hooks.on("createToken", () => applyAll());
    Hooks.on("deleteToken", () => applyAll());
    // Isometric Perspective's silhouettes of the tokens this browser hides (E112; `hideSilhouettes`).
    for (const hook of SILHOUETTE_HOOKS) Hooks.on(hook, () => silhouettesSoon());

    // A new Truth Bullet is the other half of `myRemnantRefs()` going stale -
    // it can land on this user's actor from a socket reply with no token on
    // this scene moving at all, so nothing above would otherwise catch it.
    Hooks.on("createItem", item => { if (isMyTruthBullet(item)) applyAll(); });
    Hooks.on("deleteItem", item => { if (isMyTruthBullet(item)) applyAll(); });
    // And since E05 C13 the other half of that pair: which trace a bullet came from is the
    // owner's copy of the GMs' rows, and it can arrive after the bullet does.
    Hooks.on("drpgBulletRefsChanged", () => applyAll());
    /* What this player saw last changed (PV): a project's token may come onto the map, as its tray row does - the project
       tokens alone are asked again, never a whole pass: the snapshot is written on an own move into a room, and scenario
       86's E89 C2 holds that move to no whole pass but the ledger's (a whole pass here read there on 13.11.2026). */
    Hooks.on("drpgSeenChanged", () => projectTokensPass());

    /* E89 fix FG2 (30.10.2026; finding SEC-1): where the viewer's characters stand, read as rooms, and which characters
       are the viewer's, change on these with no token of theirs moving - see `roomsChangedOn` and `wholePassSoon`. */
    Hooks.on("createRegion", region => roomsChangedOn(region?.parent));
    Hooks.on("updateRegion", region => roomsChangedOn(region?.parent));
    Hooks.on("deleteRegion", region => roomsChangedOn(region?.parent));
    Hooks.on("createRegionBehavior", behavior => roomsChangedOn(behavior?.parent?.parent));
    Hooks.on("deleteRegionBehavior", behavior => roomsChangedOn(behavior?.parent?.parent));
    Hooks.on("updateScene", (scene, changes) => { if (changes?.regions !== undefined) roomsChangedOn(scene); });
    Hooks.on("updateActor", (actor, changes) => { if (changes?.ownership !== undefined) wholePassSoon(); });
    Hooks.on("createSetting", setting => { if (ROOM_SETTINGS.has(setting?.key)) wholePassSoon(); });
    Hooks.on("updateSetting", setting => { if (ROOM_SETTINGS.has(setting?.key)) wholePassSoon(); });
}

/**
 * The `refreshToken` listener's body, a function of its own so R1055 reads it on stand-ins (E89 fix FG2).
 *
 * NO MEMO IS DROPPED HERE (E89 C3, 30.10.2026; E89-07). This used to drop the memo of our rooms on every refresh of a
 * token we own, and a drag's preview and a slide refresh once a frame: scenario 86 at e9e41f58 (on the harness's model)
 * counted visibility.forget 43 on the mover's browser and 21 on the GM's (who owns every token) over one 20-frame drag.
 * `myRooms` reads the documents' positions, never a sprite's, so a refresh cannot change its answer.
 *
 * WHAT CAN, CORRECTED (E89 fix FG2, 30.10.2026; finding SEC-1 of the review of 15c68d96). C3's note named an owned
 * document's move (`passForTokenUpdate`), a token created or deleted, a bullet and its refs and the scene's own events
 * (each through `applyAll`), and left out two roads that change the answer with no token of the viewer's moving: which
 * characters are the viewer's (an actor's `ownership`; on a token another actor, its link, an unlinked token's
 * `delta.ownership` - `movePass`), and which regions are rooms and where they lie (a region created, updated or deleted,
 * a passage behaviour added or taken off, a scene's update carrying its regions, the player regions' record and the
 * scene roles - `roomsChangedOn`, `wholePassSoon`). Through either, a "one" pass read the old rooms and kept a token on
 * screen that a whole pass hides (scenario 86 at 15c68d96, "fix FG2 SEC-1": Chie and the Dorm B students stayed on
 * Aiko's player's screen after Dorm A was put back). Each of them now runs a whole pass. `sightPass` still drops the
 * memo on every pass: its note says why.
 *
 * ONLY A REFRESH OF ITS VISIBILITY TAKES A TOKEN OFF `hiddenByUs` (E89 fix FG2; finding SEC-2). C4 took it off on every
 * refresh, on the grounds that Foundry's refresh had had its say on `visible`; Foundry's documented render flags give
 * `visible` back in a refresh that carries `refreshVisibility` (read from those flags, not from v14's source; the
 * harness's model alike, client-entry.mjs `flush`). A token hidden here and then
 * refreshed for its bars kept `visible` false and left the list, and the pass after the next sightRefresh, its verdict
 * no longer to hide it, did not flag it: stranded invisible until its own move (R1055; scenario 86, "fix FG2 COR-3,
 * SEC-2").
 */
export function refreshHeard(token, flags) {
    if (flags?.refreshVisibility) hiddenByUs.delete(token);
    applyToToken(token);
    // …and again after this frame's refresh has finished, this token among the ones refreshed in it. See below.
    reassertNextFrame(token);
}

/* The settings that change which regions are rooms (rooms.mjs `playerRegionIds`, `isTrialScene`), by their keys. */
const ROOM_SETTINGS = new Set([`${MODULE_ID}.${SETTINGS.playerRegions}`, `${MODULE_ID}.${SETTINGS.sceneRoles}`]);

/**
 * A change of the rooms on `scene` (E89 fix FG2; finding SEC-1): a whole pass when it is the scene on screen - the only
 * one whose tokens this browser draws, so the camera is read here only to skip a scene not drawn (rooms.mjs
 * CAMERA_READERS) - and nothing otherwise.
 */
function roomsChangedOn(scene) {
    if (!scene || scene !== canvas?.scene) return;
    wholePassSoon();
}

/*
 * ONE WHOLE PASS FOR A BATCH (E89 fix FG2). Room Setup's Apply writes every region of a scene in one update, which is
 * one hook per region in the same tick (fog.mjs `repaintRoomScene`'s note), so the memo is dropped at once - a verdict
 * asked before the pass reads the rooms again - and the pass runs once, in a microtask after the hooks of that tick and
 * before the next frame is drawn. A GM's verdicts read no room (`tokenShownTo` returns before them; a trace and a
 * project leave a GM to Foundry), so a GM's browser asks none. Counted `visibility.roomsChanged`.
 */
let wholePassQueued = false;
function wholePassSoon() {
    if (game.user?.isGM) return;
    count("visibility.roomsChanged");
    forgetMyRooms();
    if (wholePassQueued) return;
    wholePassQueued = true;
    queueMicrotask(() => {
        wholePassQueued = false;
        applyAll();
    });
}

/* THE VISION CLIP THAT USED TO LIVE HERE IS GONE, ON PURPOSE.
   --------------------------------------------------------------------------
   It wrapped `Token#_getVisionSourceData` to intersect a token's sight
   polygon with its room's polygon, so that a doorless gap would not let you
   see into the next room. It was the module's only reach into a private
   Foundry API, it was never confirmed to work on a live world, and - the
   part that actually settled it - the whole problem it was solving stopped
   existing once `fog.mjs` started switching Foundry's per-token vision OFF.

   With `tokenVision: false` on the scene there are no sight polygons at all
   to clip: the map is globally lit and the module's region fog is the only
   thing hiding any of it, which is what "per room, not per sight line"
   means. Wrapping a private method to constrain a system that is no longer
   running would have been pure risk with nothing on the other side of it.

   What still enforces the guide's rule is unchanged and above this line:
   `applyToToken` hides other characters' TOKENS to the viewer's own room, so
   a globally lit corridor never tells you who is standing in it. */

/**
 * SAY IT AGAIN, ONE FRAME LATER.
 * ---------------------------------------------------------------------------
 * The whole mechanism rests on an assumption stated at the top of this file:
 * that by the time `refreshToken` runs, Foundry has already computed its own
 * `visible` and ours is the last word. That assumption is not written down
 * anywhere in Foundry's API - it is an observed ordering - and an ordering is
 * exactly the kind of thing a Foundry or system update moves. When it moves,
 * nothing here throws and nothing logs: the engine simply recomputes
 * `visible` after us and every token on the map is on screen again. That is
 * the shape of the regression reported from the table on 2026-08-23, and it
 * is indistinguishable from "the module was never loaded".
 *
 * So the rule is asserted twice: once in the hook, where it has always been,
 * and once on the next animation frame, by which point every recomputation
 * belonging to this frame - ours, the engine's, the system's - has run. If the
 * ordering is fine, the second pass finds everything already correct and costs
 * one walk of the placeables. If the ordering has moved, the second pass is
 * what holds the line, at the price of a token being briefly visible for a
 * single frame before it is hidden again.
 *
 * It deliberately does NOT touch `renderFlags`: setting those would ask for
 * another refresh, which would schedule another frame, which is a loop with a
 * canvas in it. `applyToToken` only writes to display objects, so re-running
 * it changes nothing that can re-enter this.
 *
 * One frame is scheduled at a time no matter how many tokens refresh in it -
 * a drag fires this hook for every frame of the drag, and one pass per frame
 * is the whole budget.
 */
let pendingFrame = 0;
/* THE TOKENS REFRESHED IN THIS FRAME, AND ONLY THEY ARE WALKED AGAIN (E88 C2, 27.10.2026; E88-07). The walk used to be
   every placeable for any refresh at all: scenario 86 at 41cf2e9f counted 46 tokens walked on every browser for one
   token's step. What the second pass guards against is the engine writing `visible` after this file's hook inside a
   token's own refresh, so the tokens that can need it are the ones refreshed in the frame - and a whole pass
   (`applyAll`) asks every token for its refresh, so after one of those every token is in here. A token whose `visible`
   the engine wrote without refreshing it was not caught by the old walk either, unless some other token happened to
   refresh in that frame. */
const refreshedThisFrame = new Set();

/* AND EVERY TOKEN, AT MOST ONCE A SECOND (E88 fix G4, 27.10.2026; finding E88-TEST-1). C2's narrowing took away the walk
   of every placeable after any refresh, which was the second line against the engine writing `visible` OUTSIDE a
   token's own refresh - the 2026-08-23 shape of the regression, for a token that did not refresh in that frame. So a
   frame that walks the refreshed tokens also walks every other placeable when SWEEP_MS have passed since the last such
   sweep: a token shown by a write outside its refresh is hidden again within a second while anything on the map
   refreshes, at the price of one walk of the placeables a second during movement (none at rest). Scenario 86's "the
   narrowed pass on its other roads" plants that write on p1's browser (Chie shown while only Botan refreshes): at
   00bcd809 she stayed on p1's screen after two of Botan's steps 1.2 s apart; with the sweep she is hidden. Counted
   `visibility.reassert.sweep` and `.sweep.tokens`, apart from the walk of the refreshed (`visibility.reassert.tokens`). */
const SWEEP_MS = 1000;
let lastSweep = -Infinity;

function reassertNextFrame(token) {
    if (token) refreshedThisFrame.add(token);
    if (pendingFrame) return;
    pendingFrame = requestAnimationFrame(() => {
        pendingFrame = 0;
        const tokens = [...refreshedThisFrame];
        refreshedThisFrame.clear();
        try {
            if (!canvas?.ready) return;
            count("visibility.reassert");
            count("visibility.reassert.tokens", tokens.length);
            for (const one of tokens) if (!one?.destroyed) applyToToken(one);
            const now = performance.now();
            if (now - lastSweep >= SWEEP_MS) {
                lastSweep = now;
                const walked = new Set(tokens);
                let swept = 0;
                for (const one of canvas.tokens?.placeables ?? []) {
                    if (walked.has(one) || one?.destroyed) continue;
                    applyToToken(one);
                    swept++;
                }
                count("visibility.reassert.sweep");
                count("visibility.reassert.sweep.tokens", swept);
            }
        } catch {
            // Same contract as `applyToToken`: never break the canvas over this.
        } finally {
            // The incident's cast is read once for this frame's verdicts and asked again by the next (`myIncidentTrace`).
            incidentEntitled = null;
        }
    });
}

/**
 * WHICH VISIBILITY PASS A TOKEN'S UPDATE ASKS FOR (E88 C2, 27.10.2026; E88-06): "all", "one" or null.
 *
 * Until C2 every move by anybody ran `applyAll` on every browser - each placeable's refresh asked, so each ring painted
 * and each trace dressed again: scenario 86 at 41cf2e9f counted 46 refreshes of every listener on every browser for
 * one step of Botan's inside the Cafeteria, and the GM's browser drew 34 rings again for it. A verdict reads where THIS
 * viewer's own tokens stand (`myRooms`, and the lair through it), the Eclipse, the setting, the viewer's bullets and the
 * incident's cast - none of which a token the viewer does not own changes by moving. So that move asks for its own
 * token's verdict alone ("one"), and a move of one of the viewer's own still asks every token's ("all"), as does a
 * change of `hidden` (`revealRemnantToFinder`'s write, kept as it was). A GM's verdicts read no room at all
 * (`tokenShownTo` returns before them; a trace and a project leave a GM to Foundry), so on a GM's browser every move
 * is "one". `viewer` is `{ gm }`, this browser's by default, so the rule reads without a canvas (R1011).
 *
 * E89 C1 (30.10.2026; E89-04): a move of the viewer's own token asks every verdict again only when what those verdicts
 * read of it changed - the set of rooms the viewer's characters stand in, and the lair (`tokenShownTo` reads nothing
 * else a move can change; a trace reads no room, and a project's record of rooms stood in grows only by a room
 * entered). Scenario 86 at 6ae66c7f, on the harness's model: one drop of Aiko's drag inside Dorm A cost her player's
 * browser a whole pass (visibility.applyAll.tokens 46, refreshToken.visibility 86 against 21 on every other browser),
 * one path of 3 updates three of them (applyAll.tokens 138). So the viewer hands signatures, not sets: `roomsBefore`/
 * `lairBefore` as the screen was last drawn, `roomsAfter`/`lairAfter` read again after the move
 * (`passForTokenUpdate`). Equal, and the move asks its own token's verdict ("one"); different, or nothing known
 * before (no signatures, no whole pass yet), every token's ("all"; "rooms" since C2, below). Two owned characters are one set: one walking into a room the other stands in changes nothing. A room is a
 * region's name (movement.mjs `roomAt`), so a step onto another floor into a room of the same name signs the same, as
 * every verdict compares the same names. An Eclipse is read by no signature: it changes no verdict on a move.
 *
 * E89 C2 (30.10.2026; E89-06): different signatures, both known, are "rooms" - the tokens a room change can touch
 * (`roomChangeTokens`), not every token. Scenario 86 at 6bee0e69, on the harness's model: Aiko's move into the
 * Cafeteria cost her player's browser two whole passes (visibility.applyAll.tokens 92: the update's, and the one
 * sync.mjs `SYNC.fog` runs when the ledger records a room entered the first time - the GM's browser runs that one
 * too, and it is the road that shows a public project found there). At C2 the update asks 5 tokens there
 * (visibility.applyRooms.tokens 5) and the ledger's pass stays (applyAll.tokens 46). Nothing known before stays "all".
 */
export function movePass(doc, changes, viewer = { gm: Boolean(game.user?.isGM) }) {
    // `hidden` as well as a move: that is the write `revealRemnantToFinder`
    // makes, and it is the one moment a Remnant's visibility actually needs
    // recomputing for everyone who is not the finder.
    if (changes?.hidden !== undefined) return "all";
    // The opening's veil set or lifted (E112v, road (b)): its one flag is all that changes, and every browser's verdict on
    // the token turns on it - "all", as `hidden`, since a third on the killers' side reads the cast as well (R7704).
    if (veilFlagChanged(changes)) return "all";
    // E89 fix FG2 (SEC-1; R1054): which characters are the viewer's, changed on the token itself with no move - another
    // actor on it, its link to one, an unlinked token's owners (v14's delta carrying `ownership` is not read here).
    if (changes?.actorId !== undefined || changes?.actorLink !== undefined || changes?.delta?.ownership !== undefined) return "all";
    // A change of floor is a move (rooms.mjs `isMoveChange`, E12 C9): x and y alone missed a climb.
    if (!isMoveChange(changes)) return null;
    if (viewer.gm || !doc?.isOwner) return "one";
    const sameRooms = viewer.roomsBefore != null && viewer.roomsBefore === viewer.roomsAfter;
    const sameLair = (viewer.lairBefore ?? null) === (viewer.lairAfter ?? null);
    if (sameRooms && sameLair) return "one";
    return viewer.roomsBefore != null ? "rooms" : "all";
}

/** Whether `changes` sets or removes the opening's veil flag (either spelling of a removal). Pure. */
function veilFlagChanged(changes) {
    const flags = changes?.flags?.[MODULE_ID];
    return Boolean(flags) && typeof flags === "object" && ("veiled" in flags || "-=veiled" in flags);
}

/**
 * THE TOKENS A CHANGE OF THE VIEWER'S ROOMS CAN SHOW OR HIDE (E89 C2, 30.10.2026; E89-06). `before` and `after` are
 * `{ rooms, lair }` (rooms any iterable of names), `tokens` the placeables; the answer is the tokens among them whose
 * verdict may differ between the two, read off what each verdict reads (`tokenShownTo`, `applyToProjectToken`,
 * `applyToRemnantToken`):
 * - a character standing in a room of one side and not the other (`room && viewer.rooms.has(room)` turns);
 * - a character in no room when one side has no room and the other has (`!viewer.rooms.size && !room` turns);
 * - every character when the watchtower turns (`viewer.lair && viewer.rooms.has(viewer.lair)`);
 * - a project token in a room of one side and not the other. STAGE.md names the rooms entered alone (a public
 *   project's record of rooms stood in grows); the rooms left are asked as well, because `hasStoodIn` also reads
 *   where the viewer's tokens stand now, and a narrower pass may never leave a token shown that a whole pass hides;
 * - never a Remnant: its verdict reads the viewer's bullets and the incident's cast, no room.
 * The viewer's own characters read "show" on either side and are in the answer only by these rules (the caller adds
 * the moved one). Everything else reads nothing a move changes. `roomOf` is `roomOfToken` unless the suite hands its
 * stand-ins' (R1050): this reads no canvas and writes nothing.
 */
export function roomChangeTokens(before, after, tokens, roomOf = roomOfToken) {
    const was = new Set(before?.rooms ?? []), now = new Set(after?.rooms ?? []);
    const turned = new Set([...was].filter(room => !now.has(room)).concat([...now].filter(room => !was.has(room))));
    const watch = (rooms, lair) => Boolean(lair) && rooms.has(lair);
    const lairFlip = watch(was, before?.lair ?? null) !== watch(now, after?.lair ?? null);
    const emptied = (was.size === 0) !== (now.size === 0);
    const asked = [];
    for (const token of tokens ?? []) {
        const doc = token?.document;
        if (!doc) continue;
        if (doc.getFlag?.(MODULE_ID, REMNANT_FLAGS.isRemnant)) continue;
        if (projectIdOf(doc)) {
            const room = roomOf(doc);
            if (room && turned.has(room)) asked.push(token);
            continue;
        }
        if ((token.actor ?? doc.actor)?.type !== "character") continue;
        const room = roomOf(doc) ?? null;
        if (lairFlip || (room ? turned.has(room) : emptied)) asked.push(token);
    }
    return asked;
}

/**
 * THE ROOMS THE SCREEN WAS LAST DRAWN FOR (E89 C1, 30.10.2026): `{ rooms, lair }` signed by `basisNow` at the last
 * whole pass on a player's browser, null before the first and on a GM's. STAGE.md's C1 reads `myRooms()` before
 * `forgetMyRooms()` for the "before"; that memo is not the screen's: the `refreshToken` listener dropped it (until C3) on every
 * refresh of an owned token (a drag's preview refreshes once a frame: visibility.forget 42 on p1 over 86's drag at
 * 6ae66c7f), and the next verdict rebuilds it from the documents - so at the drop it can already hold the moved
 * token's new room, and before and after would read the same while every other token still shows the old rooms.
 * Only a whole pass draws every token for one signature, so that is the one kept.
 */
let passBasis = null;

function basisNow() {
    const list = [...myRooms()].map(String).sort();
    return { rooms: JSON.stringify(list), lair: myLairRoom() ?? null, list };
}

/** The move of one of this player's own tokens as `movePass` reads it: the memo dropped, the rooms read again. */
function ownMoveViewer() {
    forgetMyRooms();
    const now = basisNow();
    return { gm: false, roomsBefore: passBasis?.rooms ?? null, lairBefore: passBasis?.lair ?? null,
        roomsAfter: now.rooms, lairAfter: now.lair, before: passBasis, after: now };
}

/*
 * "rooms" (E89 C2): the tokens `roomChangeTokens` names, and the moved one, each flagged and asked as `applyAll` asks
 * its own (the flag is the un-hide road), the memo already dropped and read again by `ownMoveViewer` as `applyAll`
 * drops it. Those are every token whose verdict differs between the two signatures, so the screen is now drawn for
 * the new rooms: they become the basis the next move compares against (and the re-read at rest finds nothing to do).
 */
function applyRooms(doc, before, after) {
    if (!canvas?.ready) return;
    const asked = new Set(roomChangeTokens({ rooms: before.list, lair: before.lair }, { rooms: after.list, lair: after.lair },
        canvas.tokens?.placeables ?? []));
    if (doc?.object) asked.add(doc.object);
    passBasis = after;
    count("visibility.applyRooms");
    count("visibility.applyRooms.tokens", asked.size);
    for (const token of asked) {
        if (token.destroyed) continue;
        token.renderFlags?.set?.({ refreshVisibility: true });
        applyToToken(token);
    }
}

/*
 * And once more where the token comes to rest (movement.mjs `whenAtRest`; fog.mjs `onUpdateToken`'s note of the owner's
 * report of 14.10.2026: on a v14 table the hook read the room before the drag ended). A pass of "one" read the rooms
 * of the update; the rooms at rest are read again, and a whole pass asked if they are not the screen's. Not measured
 * headless: the harness's update carries the final position, so this finds nothing to change there (LIVE-E89-03).
 */
function recheckAtRest(doc) {
    whenAtRest(doc).then(() => {
        if (!canvas?.ready || doc?.parent !== canvas.scene) return;
        const viewer = ownMoveViewer();
        if (viewer.roomsBefore !== viewer.roomsAfter || viewer.lairBefore !== viewer.lairAfter) applyAll();
    }).catch(err => debug("Visibility: could not read a move at rest", err));
}

/**
 * The `updateToken` listener: the pass `movePass` names. "one" is the moved token's verdict asked again the way
 * `applyAll` asks each of its tokens - its refresh flagged, which is the road that gives Foundry back a token this
 * file hid (see `applyAll`'s note: a token stepping from another room into the viewer's comes back by it), and the
 * verdict carried to its sprite now. A token on a scene not on screen has no placeable (`object` is the drawn token of
 * the scene on screen alone, so the camera is not read here: rooms.mjs CAMERA_READERS), and is asked nothing.
 */
export function passForTokenUpdate(doc, changes) {
    // Foundry's own hide flipped (owner-116): the token's ruler asked again at once, so one standing goes with the token
    if (changes?.hidden !== undefined || veilFlagChanged(changes)) doorways?.reRuler?.(doc?.object);
    // E89 C1: an own token's move on a player's browser hands the rooms before and after; anything else, `{ gm }`.
    const gm = Boolean(game.user?.isGM);
    const ownedMove = Boolean(doc?.isOwner) && isMoveChange(changes);
    const ownMove = !gm && ownedMove && changes?.hidden === undefined;
    // E89 C3: where WE stand moved with the document - the memo goes here, not on the sprite's refreshes (see the
    // `refreshToken` listener). The player's own move drops it in `ownMoveViewer`; every other owned move here.
    if (ownedMove && !ownMove) forgetMyRooms();
    const viewer = ownMove ? ownMoveViewer() : { gm };
    const pass = movePass(doc, changes, viewer);
    if (ownMove) recheckAtRest(doc);
    if (pass === "all") return applyAll();
    if (pass === "rooms") return applyRooms(doc, viewer.before, viewer.after);
    if (pass !== "one" || !canvas?.ready) return;
    const token = doc?.object;
    if (!token || token.destroyed) return;
    count("visibility.applyOne");
    token.renderFlags?.set?.({ refreshVisibility: true });
    applyToToken(token);
}

function isMyTruthBullet(item) {
    const actor = item?.parent;
    return actor?.type === "character" && actor.isOwner
        && Boolean(item.getFlag(MODULE_ID, TRUTH_BULLET_FLAGS.isBullet));
}

/**
 * Decide one token's visibility. Called from `refreshToken`, so it runs after
 * Foundry has had its say and its result is the one that sticks.
 */
function applyToToken(token) {
    count("visibility.applyToToken");
    try {
        if (token?.document?.getFlag?.(MODULE_ID, REMNANT_FLAGS.isRemnant)) {
            applyToRemnantToken(token);
            return;
        }

        /* A PROJECT IS THE OTHER KIND OF TOKEN THIS MODULE PUTS ON THE MAP.
           Its document reaches every browser carrying a neutral name and one
           countdown id - see the header of projects-map.mjs for why that is
           the whole of its secrecy - and who may SEE it is decided here, on
           each client, by one predicate. A secret project is hidden from
           anybody not in on it; a public one is hidden until its room has been
           stood in, and stays visible afterwards. */
        const projectId = projectIdOf(token?.document);
        if (projectId) {
            applyToProjectToken(token, projectId);
            return;
        }

        if (!token?.actor || token.actor.type !== "character") return;
        if (game.user?.isGM) dressSpectator(token);
        // The rule is `tokenShownTo`'s (E12 C11); this only carries its answer to the sprite.
        const verdict = tokenShownTo(token.document, viewerHere(() => Boolean(token.isOwner)));
        if (verdict === "show") show(token);
        else if (verdict === "hide") hide(token);
        else if (verdict === "room") {
            /*
             * THE DOCUMENT ARRIVES BEFORE THE SPRITE DOES (MAP-02). A token
             * walking INTO my room is "in my room" the instant its update
             * lands, while the mesh is still sliding there from wherever it
             * came - so it flipped visible at its old position and crossed the
             * border on screen, which is the direction of the crime scene.
             * While the sprite stands in another room it stays hidden;
             * `refreshToken` fires every frame of the slide and shows it the
             * moment it crosses. A sprite between rooms (in none) is left to
             * Foundry here, the guard `at &&` since 8d24e215 (1.2.122, the
             * audit's MAP-45: this said "not yet in a room of mine").
             * One region test per animating token per frame.
             */
            const sliding = token.x !== token.document.x || token.y !== token.document.y;
            if (sliding) {
                count("visibility.sliding");
                if (slideHeld(roomAt(token.x, token.y, token.document), myRooms())) hide(token);
            }
        }
    } catch {
        // Never break the canvas over this.
    }
}

/**
 * Whether a token sliding towards a room of this viewer's is held hidden on this frame, its sprite's centre `at` (a room's
 * name, or null between rooms): until the sprite is in one of `mine`. AND BETWEEN ROOMS TOO (1.2.122 line MAP; the audit's
 * MAP-02): a sprite whose centre is in no room - the stretch between two rooms that do not touch - was shown, so a player
 * in the Cafeteria saw a student come out of Dorm A's side and cross the gap. Pure; for the suite (R8350).
 */
export function slideHeld(at, mine) {
    return !at || !mine?.has?.(at);
}

/**
 * Whether a character's token is shown to `viewer`: "show" (forced on), "hide", "room" (it stands
 * in a room of the viewer's - Foundry's own visibility stands, `applyToToken` holds a sliding
 * sprite back), or null (left to Foundry). `viewer` is `{ gm, eclipse, enforcing, rooms, lair,
 * owns(tokenDoc) }` - `viewerHere()` for this browser - so the rule reads no canvas and no user
 * of its own.
 *
 * ANOTHER FLOOR IS SHOWN BY THE SAME RULE (E12 C11, 11.10.2026; plan-E12 3.5, the owner's answer
 * Q2 (b) of 09.10). A token is placed by the room it stands in (movement.mjs `roomOfToken`, on its
 * own floor since E12 C9) and the viewer's rooms are where their own tokens stand, by name: on a
 * floor the viewer looks at and does not stand on, every other player's token is hidden, as it is
 * in a room of their own floor they are not in - and one in a room the viewer stands in, a
 * stairwell drawn on both floors, is shown on each - where the viewer's tokens are read at all:
 * `myRooms` reads `canvas.tokens.placeables`, the whole scene in the harness, and v14's layer may
 * hold only the floor on screen (LIVE-E12-02; E12 fix r2-S2, review EARLY-C11-1), stricter if so.
 * Taken out of `applyToToken` so the verdict
 * can be read without a canvas (tier 2 "a room on another floor looks as it does on yours").
 */
export function tokenShownTo(tokenDoc, viewer) {
    if (tokenDoc?.actor?.type !== "character") return null;
    // The GM sees the whole cast, always. Not a judgement call and never a
    // setting: they are running the game, not standing in a room.
    if (viewer.gm) return null;

    /* A SPECTATOR'S TOKEN IS ITS OWNER'S ALONE (E92 C4, 12.11.2026; the owner's E92 goal (1)): every other player's
       browser hides it, whatever the room, the Eclipse or the setting - a display, since every browser holds the token
       (the plan's risk R3). AND A SPECTATOR SEES EVERY CHARACTER (goal (4)): its browser leaves each token to Foundry,
       whatever the room, in an Eclipse too (Q-E92-6's default) - Foundry's own `hidden` still hides a GM's hidden token. */
    if (flaggedSpectator(tokenDoc.actor)) return viewer.owns(tokenDoc) ? "show" : "hide";
    /* THE OPENING'S VEIL (E112, mask-gm.mjs): a killer's token waiting on the opening. Its owner sees it - they have to
       be able to see themselves - and so does the killers' side, where the room rule would show it (the accomplice beside
       the killer); nobody else, whatever the setting, an Eclipse's darkness above it. Read off the one flag (`veiled`:
       with the token's actorId a console reads it as the killer's, known leak foundry-veiled-token-actor) and this
       browser's own copy of the cast, which holds the killers for the killers' side alone (incident-store.mjs
       `castCopyFor`).
       THE MODULE'S HIDING, NOT FOUNDRY'S (E112v, 16.11.2026; the owner's decision, road (b)): until E112v the veil was
       Foundry's `hidden` too, which on v14 took the killer's own vision (LIVE-E112-01); now nothing but this verdict
       hides the token, so it is asked above a Spectator's browser, which leaves every other token to Foundry: a Spectator
       does not see the killer while the veil stands (LIVE-E112-01 (g)'s default; R7702). Below the GM and a Spectator's
       own token, both of which answer for themselves. */
    if (veiledToken(tokenDoc)) {
        if (viewer.owns(tokenDoc)) return "show";
        if (viewer.eclipse || !viewer.killersSide?.has(tokenDoc.actorId)) return "hide";
        if (!viewer.enforcing) return "show";
        const at = roomOfToken(tokenDoc);
        return at && viewer.rooms.has(at) ? "show" : "hide";
    }

    if (viewer.spectator) return null;

    /* THE ECLIPSE SITS ABOVE `roomVisibility`, NOT BEHIND IT.
       -------------------------------------------------------------------
       This branch used to live below the `enforcing()` gate, so a table
       with room visibility switched off got an Eclipse in which everybody
       could watch everybody cross the map - confirmed live, and reported
       as B-F2-3. Dawid settled the design question on 2026-08-26: an
       Eclipse always hides players' tokens from other players, and the GM
       always sees them all.

       So the darkness is answered here, before the setting is consulted:
       `roomVisibility` governs the ROOM rule below, which is about where
       you are standing. An Eclipse is not about rooms - it is the lights
       going out, and there is no configuration under which the lights are
       out for one player and on for another. Your own token still shows,
       for the same reason it does below: you have to be able to move it. */
    if (viewer.eclipse) return viewer.owns(tokenDoc) ? "show" : "hide";

    // Everything below is the room rule, which is what the setting governs.
    if (!viewer.enforcing) return null;

    // YOUR OWN TOKEN IS ALWAYS VISIBLE TO YOU, unconditionally.
    //
    // This used to `return` - leaving the token to whatever Foundry had
    // decided - which is fine only while Foundry's own vision agrees. It
    // does not always: with the scene switched to room-based visibility,
    // an owned token standing in an unexplored corner of a stale
    // exploration mask was hidden by Foundry itself, and the player was
    // left looking at a map with their own character missing from it.
    // There is no rule in this game under which you cannot see yourself,
    // so this states it rather than assuming it.
    if (viewer.owns(tokenDoc)) return "show";

    /* THE MASTERMIND'S ROOM IS A WATCHTOWER (Dawid, 26.08).
       -------------------------------------------------------------------
       A Mastermind whose own token stands in their lair sees the whole
       cast, the way the GM's branch above does - they built the cameras.
       Standing anywhere else they are exactly as blind as anyone, which
       is why this reads their CURRENT rooms rather than remembering
       anything: walk out, and the next refresh takes it away.

       Deliberately below the Eclipse branch - the lights going out spare
       nobody - and deliberately only in this function: Remnant tokens go
       through `applyToRemnantToken`, so the watchtower never shows a
       trace they have not personally observed. */
    if (viewer.lair && viewer.rooms.has(viewer.lair)) return null;

    const room = roomOfToken(tokenDoc);
    // Neither the viewer's characters nor this token stand in a room: leave
    // Foundry's own logic alone. That covers a scene with no regions at all,
    // which would otherwise hide the entire cast, and also two students both
    // outside every room on a scene that has them (a corridor), who see each
    // other by Foundry's sight. `roomChangeTokens` relies on that wider reading.
    if (!viewer.rooms.size && !room) return null;
    return room && viewer.rooms.has(room) ? "room" : "hide";
}

/** Whether a token is veiled for a murder's opening (E112), by its one flag: inline, as voice.mjs `ownVeiled` reads it. */
function veiledToken(tokenDoc) {
    return Boolean((tokenDoc?.flags ?? tokenDoc?._source?.flags)?.[MODULE_ID]?.veiled);
}

/**
 * THE KILLERS' SIDE AS THIS BROWSER KNOWS IT (E112): the killer and a third on the killers' side in this browser's copy of
 * the cast, when this browser owns one of them - else none. A victim's or a bystander's copy holds no killer while the
 * opening waits (incident-store.mjs `castCopyFor`), and owning none of them keeps a copy that does from showing anything.
 */
function killersSideHere() {
    if (game.user?.isGM) return new Set();
    const cast = incidentCast();
    const side = [cast.killerId, cast.thirdSide === "killer" ? cast.thirdId : null].filter(Boolean);
    const mine = side.some(id => game.actors?.get?.(id)?.isOwner);
    return mine ? new Set(side) : new Set();
}

/**
 * This browser as `tokenShownTo`'s viewer; `owns` reads a token document's own `isOwner` unless
 * the caller hands another (`applyToToken` hands the sprite's). The rooms, the lair and the
 * setting are getters, read only when the rule gets to them, as `applyToToken` read them before
 * E12 C11: a GM's refresh asks for none of the three, and `refreshToken` fires on every frame of
 * a drag.
 */
export function viewerHere(owns = tokenDoc => Boolean(tokenDoc?.isOwner)) {
    return {
        gm: Boolean(game.user?.isGM),
        eclipse: isEclipse(),
        get enforcing() { return enforcing(); },
        get rooms() { return myRooms(); },
        // Written with a computed key: R22 reads `get lair()` as a call to a function `lair` that
        // this file does not declare (11.10.2026, the first fast run of E12 C11).
        get ["lair"]() { return myLairRoom(); },
        // Whether this browser watches (E92 C4): read only when the rule gets to it, as the rooms are; a computed key, as
        // the lair's, so R22 does not read a call to a function `spectator`.
        get ["spectator"]() { return spectatorViewer(game.user); },
        // The killers this browser sits beside (E112's veil): read only for a veiled token, a computed key as the others.
        get ["killersSide"]() { return killersSideHere(); },
        owns
    };
}

/**
 * A project's token, hidden from anybody who does not know it is there.
 *
 * The GM leaves before anything is asked, exactly as with a trace: they are
 * running the game, not discovering it. Everyone else answers to
 * `knowsProject`, which is one predicate over facts the module was already
 * keeping - the countdown's own ownership for a secret project, and fog.mjs's
 * record of which rooms a character has stood in for a public one.
 */
function applyToProjectToken(token, projectId) {
    if (game.user.isGM) return;
    if (token.document.hidden) return;     // a GM has hidden it by hand
    /* AS LAST SEEN (PV, 13.11.2026; the owner's rule #2): a project made, or a sabotage's repair begun, while none of this
       player's characters was in its room stays off their map until one of them is (projects-seen.mjs `asSeen`). */
    if (knowsProject(projectId) && tokenShownAsSeen(projectId)) {
        paintProjectTint(token, projectId);
        return;
    }
    hide(token);
}

/**
 * A PROJECT TOKEN'S FINISH AS THIS PLAYER SAW IT (PV, 13.11.2026): the tint projects-seen.mjs `tintAsSeen` answers - the
 * finished one only when the player's last sight of the room saw it finished - or, for a live row, the document's own,
 * written back so a tint laid while the player was away does not outlast their return. Laid on the sprite of this
 * browser alone, after Foundry's own refresh of it (this runs in the refresh's hook). No canvas in the harness: what is
 * drawn is LIVE-PV-03; the tint chosen is R5652.
 */
function paintProjectTint(token, projectId) {
    const mesh = token?.mesh;
    if (!mesh) return;
    const tint = tintAsSeen(projectId) ?? token.document?.texture?.tint ?? null;
    if (tint === null || tint === undefined) return;
    try {
        mesh.tint = typeof tint === "number" ? tint : (foundry.utils.Color?.from?.(tint) ?? tint);
    } catch {
        // A tint the canvas cannot read leaves the sprite as Foundry drew it.
    }
}

/**
 * A revealed Remnant is visible to the table by Foundry's own `hidden` flag,
 * but stays a secret from everyone except the finder - see the header note.
 * Unlike the room rule above, this does not depend on the `roomVisibility`
 * setting: it is not about rooms, it is about who has actually copied this
 * specific trace, and it holds regardless of whether the GM has room
 * enforcement switched on.
 */
function applyToRemnantToken(token) {
    if (game.user.isGM) return;
    // Still hidden: Foundry's own flag already keeps it off every screen but
    // the GM's, and there is nothing this function needs to add.
    if (token.document.hidden) return;

    const key = remnantKeyOf(token.document);
    if (!key || myRemnantRefs().has(key)) return;

    // D11: the crime scene belongs to the people who were standing in it. An
    // incident's traces are created un-hidden (see `placeRemnant`) precisely so
    // this line can decide, because Foundry's own flag cannot say "these two".
    if (myIncidentTrace(token.document)) return;

    hide(token);
}

/**
 * An incident trace from an incident I am in (D11).
 *
 * READ OFF THE TOKEN, NOT THE LEDGER - and the first version asked the token
 * for the wrong thing. It read `REMNANT_FLAGS.type`, which is a LEDGER field: a
 * token document carries `isRemnant` and nothing else, because what a trace
 * MEANS is the answer key and a token reaches every browser. So the test was
 * `undefined !== "incident"` on every client, always false, and D11's whole
 * client half silently did nothing - found on the E23 live round, where the
 * killer could not see the scene the rule exists to show them.
 *
 * `fromIncident` is the minimal public marker added for exactly this. It says
 * no more than the un-hidden token already says by existing.
 *
 * The entitlement is the live incident's participant list, which a player's
 * client legitimately holds: they are in it.
 */
/* Whether this viewer is one of the live incident's cast whom its traces show to, read once for a frame's or a pass's
   verdicts (E88 C2): null until read; dropped by `forgetMyRooms` (each `applyAll`, each move of an own token) and
   after each next-frame walk. It reads no token: each trace asked the same three settings and the same actors walk. */
let incidentEntitled = null;

function myIncidentTrace(tokenDoc) {
    count("visibility.myIncidentTrace");
    try {
        if (!tokenDoc.getFlag(MODULE_ID, REMNANT_FLAGS.fromIncident)) return false;
        if (incidentEntitled === null) {
            count("visibility.incidentCast");
            incidentEntitled = inTheIncident();
        }
        return incidentEntitled;
    } catch {
        return false;
    }
}

function inTheIncident() {
    try {
        const state = game.settings.get(MODULE_ID, SETTINGS.murderState);
        if (!state?.active) return false;

        /*
         * THE NAMES ARE NOT IN THE WORLD SETTING ANY MORE (LIVE-001): they live
         * in the client-scoped cast that only the participants and the GMs
         * hold. This used to read `killerId`/`victimId`/`thirdId` off the world
         * half, which has carried none of them since the split - so the set was
         * always empty and D11's client half silently did nothing, again.
         *
         * `incidentParticipants()` is the same leaf reader movement.mjs uses. A
         * bystander's client gets an empty list, which is the whole point. The
         * "accomplice who threw in with the killers" distinction needs the
         * side, which this client's own copy of the cast still carries.
         */
        const ids = new Set(incidentParticipants());
        // The same leaf (E04: the GMs' record or this participant's copy).
        const cast = incidentCast();
        if (cast.thirdId && cast.thirdSide !== "killer") ids.delete(cast.thirdId);
        if (!ids.size) return false;

        return game.actors.filter(a => a.isOwner).some(a => ids.has(a.id));
    } catch {
        // A trace nobody can classify is a trace nobody special gets to see.
        return false;
    }
}

/*
 * A SPECTATOR'S TOKEN ON A GM'S CANVAS (E92 C3, 12.11.2026; the owner's DRPG-D1 the same day: "transparentny/ledwie
 * widoczny, by nie mylil sie z graczami"). Its sprite at `SPECTATOR_ALPHA` of the token's own alpha - 0.3, the
 * coordinator's pick in the owner's 25-30 % - and nothing else: the grey tint and the dark outline of C3 are gone. A
 * token whose actor is no Spectator any more gets its own alpha back. On a GM's browser only (`applyToToken`): every other
 * player's is hidden (`tokenShownTo`), and its owner sees it as Foundry draws it. Display only; how it reads on a real
 * map is LIVE-E92-04.
 */
const SPECTATOR_ALPHA = 0.3;
const dressedSpectators = new WeakSet();
export function dressSpectator(token) {
    const watching = Boolean(token?.actor?.getFlag?.(MODULE_ID, FLAGS.spectator));
    const mesh = token?.mesh;
    if (!watching) {
        if (dressedSpectators.has(token)) {
            dressedSpectators.delete(token);
            if (mesh) mesh.alpha = token.document?.alpha ?? 1;
        }
        return false;
    }
    dressedSpectators.add(token);
    if (mesh) mesh.alpha = SPECTATOR_ALPHA * (token.document?.alpha ?? 1);
    return true;
}

/*
 * ISOMETRIC PERSPECTIVE'S SILHOUETTES (E112, 15.11.2026; the owner's answer to Q4 through the coordinator: "a token the
 * module hides from a client must not show its silhouette on that client either"). Isometric Perspective 14.0.6
 * (occlusion.js, read at its commit 7122b36, not run) keeps a layer of its own on the stage, "OcclusionContainer" >
 * "OcclusionTokens", which it empties and fills again on eight hooks of Foundry's (canvasReady, canvasPan,
 * canvasTokensRefresh, updateToken, controlToken, refreshToken, preUpdateScene, updateScene) while its client setting "Token
 * Silhouette" is on (off by default): a `new PIXI.Sprite(token.mesh.texture)` at the mesh's position for every token behind
 * an occluding tile, with no test of the token's visibility - so a token this browser hides (another room, an Eclipse,
 * the opening's veil, a GM's hidden) showed its 30%-dark silhouette there. The sprite names no token; it is matched back
 * by the mesh's texture and position (`silhouettesToHide`) and hidden, a frame after the hook, since which of the two
 * modules hears a hook first is not ours to say. A GM's browser hides nothing of the cast and is left alone. Nothing of
 * Isometric's is edited. Read on a stand-in stage (R7407); a real canvas is LIVE-E112-05.
 */
const SILHOUETTE_HOOKS = Object.freeze(["canvasReady", "canvasPan", "canvasTokensRefresh", "updateToken", "controlToken", "refreshToken", "updateScene"]);

/** The sprites of `sprites` drawn for a token of `tokens` that is not visible here: same texture, same position. Pure (R7407). */
export function silhouettesToHide(sprites = [], tokens = []) {
    const out = [];
    for (const sprite of sprites ?? []) {
        if (!sprite?.texture) continue;
        const token = (tokens ?? []).find(t => t?.mesh?.texture === sprite.texture
            && t.mesh.position?.x === sprite.position?.x && t.mesh.position?.y === sprite.position?.y);
        if (token && token.visible === false) out.push(sprite);
    }
    return out;
}

/** Isometric Perspective's silhouette layer on `stage`, or null where it has none. */
export function silhouetteLayer(stage = globalThis.canvas?.stage) {
    const box = stage?.children?.find?.(child => child?.name === "OcclusionContainer") ?? null;
    return box?.children?.find?.(child => child?.name === "OcclusionTokens") ?? null;
}

/** Hide this browser's hidden tokens' silhouettes; answers how many. */
export function hideSilhouettes({ stage = globalThis.canvas?.stage, tokens = globalThis.canvas?.tokens?.placeables, isGm = Boolean(game.user?.isGM) } = {}) {
    if (isGm) return 0;
    const layer = silhouetteLayer(stage);
    if (!layer?.children?.length) return 0;
    const hidden = silhouettesToHide(layer.children, tokens);
    for (const sprite of hidden) sprite.visible = false;
    return hidden.length;
}

let silhouetteFrame = null;
function silhouettesSoon() {
    if (silhouetteFrame !== null || game.user?.isGM || !game.modules?.get?.("isometric-perspective")?.active) return;
    const run = () => {
        silhouetteFrame = null;
        try { hideSilhouettes(); } catch { /* never break the canvas over this */ }
    };
    // Called where named (R571): a window function taken as a value runs on another object in some browsers.
    silhouetteFrame = typeof requestAnimationFrame === "function" ? requestAnimationFrame(run) : setTimeout(run, 16);
}

function hide(token) {
    hiddenByUs.add(token);
    token.visible = false;
    if (token.mesh) token.mesh.visible = false;
    // Nameplates, bars and the target marker are separate display objects.
    for (const part of [token.nameplate, token.bars, token.tooltip, token.effects, token.border]) {
        if (part) part.visible = false;
    }
    hideMovementTrail(token);
}

/**
 * The opposite of `hide`, for the one case that is not a judgement call: your
 * own token.
 *
 * Only the token itself and its mesh are forced. The nameplate, bars and
 * border are left to Foundry, because those have their own display settings a
 * GM may legitimately have turned off per token - forcing them back on would
 * be this module overruling a deliberate choice, which is not what "you can
 * see yourself" means.
 *
 * `document.hidden` is still respected: a token the GM has hidden outright is
 * hidden from its owner too, which is what that control is for.
 */
function show(token) {
    // A token the opening veils carries no `hidden` of the veil's since E112v (road (b)): a `hidden` on it is a GM's, kept.
    if (token.document?.hidden) return;
    hiddenByUs.delete(token);
    token.visible = true;
    if (token.mesh) token.mesh.visible = true;
}

/**
 * The line and distance label Foundry draws while a token is being dragged is
 * not one of the display objects above - it belongs to the ruler Foundry
 * attaches to the token being moved, not to the token's own mesh - so hiding
 * everything above still left a killer's path lit up across a room nobody
 * could see them stand in: the token itself never appeared during an Eclipse,
 * but the line leading to where it stopped gave the room away anyway.
 *
 * CONFIRMED ON 14.365 (sandbox, 03.09; audit Q9): the trail is `token.ruler`,
 * an own property holding the token's ruler object, and it has a `visible`
 * flag. The three other names this used to try - `dragRuler`, `_ruler`,
 * `movementRuler` - do not exist on the token at all, so they are gone from this
 * file since that reading (before 1.2.70). Still
 * guarded, because the property is not public API: a build that renames it
 * fails safe (nothing to hide, nothing happens) rather than throwing.
 *
 * What the sandbox could NOT show is the trail as another player sees it
 * during a real drag - the browser tool cannot drag the PIXI canvas. One drag
 * at the table, watched from a second seat, is what remains.
 */
/*
 * A HIDDEN TOKEN'S RULER (owner-116, 15.11.2026; the owner: "przycisk hide w foundry bazowym (prawy na token - hide)
 * niech ukrywa tez linie dystansu pokonywanego przez token"). `hideMovementTrail` below writes a ruler off once, when
 * this file hides a token; Foundry writes it on again at its next refresh, and Foundry's own hide (`hidden`) never came
 * here at all. Since owner-116 the ruler class asks `rulerHere` on every write of its `visible` (fog-doorways.mjs
 * `hourRulerFor`, `setRulerShown`): a GM always sees it; anyone else not for a token Foundry hides, nor where
 * `tokenShownTo` hides the token (the room, the Eclipse, the Spectator), nor for one this file hid by its other rules
 * (`hiddenByUs`: a Remnant, a project). The token's owner sees its ruler, hidden or not: at the owner's v14 table a
 * player sees their own hidden token (the owner's answer, 15.11.2026; LIVE-E116-03 reads it again) - and `tokenShownTo`
 * shows an owner their own token in every branch, so the exception opens nothing the module hides from an owner; a
 * token this file hid by its other rules stays hidden, asked first. What reaches a player's browser of a hidden token's
 * move is LIVE-E116-02.
 */
let doorways = null;

/** Whether `viewer` may see `doc`'s ruler: a GM always, the token's owner always (hidden or not), anyone else as the
 *  token's own answer (`tokenShownTo`) and never a hidden token's. */
export function rulerShownTo(doc, viewer) {
    if (viewer?.gm) return true;
    if (!doc) return true;
    // the owner sees their own hidden token at a v14 table (the owner, 15.11.2026), so its ruler too (LIVE-E116-03)
    if (viewer?.owns?.(doc)) return true;
    if (doc.hidden) return false;
    return tokenShownTo(doc, viewer) !== "hide";
}

/*
 * A TOKEN THIS BROWSER HIDES GIVES IT NO SIGHT (E112v, 16.11.2026; the coordinator's answer to Q2, docs/dev/e112v/DESIGN.md
 * section 5). Foundry's vision-source test (`Token#_isVisionSource`, wrapped below; its source not read on this line) makes
 * a token with sight a source on a player's browser when it is controlled or, while that player controls no token with
 * sight, for every token the player can observe - and every player observes every character here (the module's ownership
 * default 2). Until E112v the opening's veil was Foundry's `hidden`, which kept the killer's token out of that fallback;
 * on road (b) a victim's or a bystander's browser would have taken sight from the veiled killer's token, the token itself
 * hidden but its sight lighting the map around where the killer stands. And the same fallback gave every player the sight
 * of a token in another room, hidden by the room rule, on a scene with token vision on (the room fog off: with it on, a
 * scene with rooms has token vision off, fog.mjs `applySceneVisionMode`). So a token this browser does not draw by the
 * module's own rules - `tokenShownTo`'s "hide", the verdict `applyToToken` hides by, or one this file hid by its other
 * rules (`hiddenByUs`: a Remnant, a project) - is no vision source here; any other is Foundry's to answer, unchanged. A GM's
 * browser is never asked. The killer's own token answers "show" on their browser, so it stays their vision source while
 * veiled (R7701, R7707): that was the defect. Read headless on the predicate and on a stand-in class (R7706, R7707);
 * a real canvas is LIVE-E112V-01.
 */
const SIGHT_RULE = Symbol.for("drpgSightHere");

/** Whether `doc` gives `viewer` no sight: the module hides it from them (`tokenShownTo` "hide"); never on a GM's. Pure (R7706). */
export function givesNoSight(doc, viewer) {
    if (!doc || viewer?.gm) return false;
    return tokenShownTo(doc, viewer) === "hide";
}

/** This browser's answer for a placeable: a Remnant or a project by this file's other rules (`hiddenByUs`), as `applyToToken` hides them; a character by `givesNoSight`. */
function noSightHere(token) {
    if (!token || game.user?.isGM) return false;
    const doc = token.document;
    if (doc?.getFlag?.(MODULE_ID, REMNANT_FLAGS.isRemnant) || projectIdOf(doc)) return hiddenByUs.has(token);
    return givesNoSight(doc, viewerHere(() => Boolean(token.isOwner)));
}

/**
 * Wrap the vision-source test of `TokenClass` (the configured token class by default) where its chain first owns one, so a
 * token `noSight` answers true for is no source on this browser and every other keeps Foundry's answer. Answers whether it
 * is in place. The suite hands a stand-in class and its own `noSight` (R7707); a class with no such method is left alone.
 */
export function installSightRule(TokenClass = globalThis.CONFIG?.Token?.objectClass, noSight = noSightHere) {
    let proto = TokenClass?.prototype ?? null;
    while (proto && proto !== Object.prototype && !Object.hasOwn(proto, "_isVisionSource")) proto = Object.getPrototypeOf(proto);
    const core = proto && proto !== Object.prototype ? proto._isVisionSource : null;
    if (typeof core !== "function") {
        debug("Visibility: the token class has no vision-source test here, so a hidden token's sight is Foundry's alone");
        return false;
    }
    if (core[SIGHT_RULE]) return true;
    const drpgSightHere = function (...args) {
        if (noSight(this)) return false;
        return core.apply(this, args);
    };
    drpgSightHere[SIGHT_RULE] = true;
    drpgSightHere.wrapped = core;
    proto._isVisionSource = drpgSightHere;
    return true;
}

/**
 * WHETHER THE OPENING'S VEIL HIDES `user` FROM THIS BROWSER (1.2.119 line F; the auditor's finding domain-comm-c-voice 1):
 * `user` owns a token the veil marks (`veiledToken`) on any scene, and `tokenShownTo` hides that token from `viewer` - the
 * same rule the map hides it by, so the voice tile and the map agree. Never on a GM's browser, nor for the viewer's own
 * account, nor for a GM's. The voice tile asks it of each participant of its Room (voice-tile.mjs `voiceWatch`'s
 * `veiled`): the killer stays in the room's channel and hears it (E112), and is counted, listed and drawn on no tile the
 * veil hides them from. `viewer` and `scenes` are the suite's (R7864).
 */
export function voiceVeiledHere(user, { viewer = viewerHere(), scenes = game.scenes ?? [] } = {}) {
    // The pickers' rule (mask-gm.mjs `veilHidesHere`, 1.2.122 line MURDER): one predicate, this browser's verdict handed in.
    return userVeiledFromHere(user, { scenes, shown: tokenDoc => tokenShownTo(tokenDoc, viewer), user: game.user, gm: Boolean(viewer?.gm) });
}

/** This browser's answer for a token's ruler (the ruler class's predicate). */
function rulerHere(token) {
    if (!token) return true;
    if (game.user?.isGM) return true;
    if (hiddenByUs.has(token)) return false;
    return rulerShownTo(token.document, viewerHere(() => Boolean(token.isOwner)));
}

function hideMovementTrail(token) {
    const trail = token.ruler;
    if (trail && typeof trail === "object" && "visible" in trail) trail.visible = false;
}

function enforcing() {
    try {
        return game.settings.get(MODULE_ID, SETTINGS.roomVisibility);
    } catch {
        return false;
    }
}

/*
 * `sightRefresh`: ONE VERDICT PASS ON THE NEXT FRAME, AND THE UN-HIDE ROAD ONLY WHERE IT IS NEEDED (E89 C4,
 * 30.10.2026; E89-08). The hook ran `applyAll` each time it fired, and `applyAll` asks Foundry to refresh every token:
 * scenario 86 at e9e41f58, with `sightRefresh` fired on each of a slide's 20 frames (the harness's model; whether v14
 * fires it per frame is LIVE-E89-02), counted visibility.applyAll.tokens 920 on every browser and refreshToken.visibility
 * 921, and on the GM's remnantIcons.apply 600 and utils.cssColour 681 from those refreshes. Every hook of a frame now
 * asks one pass, run on the next frame, which reads each token's verdict as `applyAll` does (so a token a whole pass
 * would hide is hidden by it) and flags `refreshVisibility` only on a token this file hid (`hiddenByUs`: written by
 * `hide`, cleared by `show` and by the token's own refresh of its visibility, where Foundry has just written
 * `visible` again - since E89 fix FG2 that refresh alone, `refreshHeard`) whose
 * verdict is no longer to hide it - the flag is the road that gives such a token back to Foundry (see `applyAll`'s
 * note), and a token this file did not hide has nothing to be given back. `judge` is the verdict; the stand-ins of
 * R1052 hand their own, which is passed `hide`.
 *
 * THE MEMO IS STILL DROPPED ON EVERY PASS (E89 fix FG2, 30.10.2026; finding G2). Scenario 86 at c2fd2931, sightRefresh
 * on each of a slide's 20 frames (the model): p1 visibility.forget 22 and myRooms.walk 22. Since the fix the roads that
 * change the viewer's rooms by a document or a setting run a whole pass of their own (`refreshHeard`'s note), so a
 * sightRefresh adds nothing to those. It is kept for what changes the answer with no hook this file hears: the floor on
 * screen (v14's token layer may hold that floor alone, and `myRooms` walks `canvas.tokens.placeables`; LIVE-E12-02), a
 * user's role, and what v14 holds that the harness does not model. A pass that kept it would read the rooms of before
 * such a change and leave a token shown that a whole pass hides; scenario 86's "fix FG2 COR-3" drives one such change
 * (a region's source written on one browser alone, reported by sightRefresh only). Secrecy before the counter: one walk
 * of the placeables a pass, 22 per 20 frames, kept.
 */
const hiddenByUs = new WeakSet();
let pendingSight = 0;

function sightPassNextFrame() {
    if (pendingSight) return;
    pendingSight = requestAnimationFrame(() => {
        pendingSight = 0;
        try {
            sightPass();
        } catch (err) {
            debug("Visibility: the pass after sightRefresh failed", err);
        }
    });
}

export function sightPass(placeables = canvas?.tokens?.placeables ?? [], judge = applyToToken) {
    if (!canvas?.ready) return;
    forgetMyRooms();
    passBasis = game.user?.isGM ? null : basisNow();
    count("visibility.sightPass");
    count("visibility.sightPass.tokens", placeables.length);
    for (const token of placeables) {
        if (!token || token.destroyed) continue;
        const was = hiddenByUs.has(token);
        hiddenByUs.delete(token);
        judge(token, hide);
        if (was && !hiddenByUs.has(token) && token.renderFlags?.set) {
            token.renderFlags.set({ refreshVisibility: true });
            count("visibility.sightPass.flags");
        }
    }
}

/**
 * Recompute who is visible. Applied as a render-time override rather than a
 * document change, so nothing is written to the scene and the GM's view is
 * never altered.
 */
export function applyAll() {
    if (!canvas?.ready) return;
    forgetMyRooms();
    // E89 C1: what this pass draws every token for, read once here (the verdicts below reuse the memo it fills).
    passBasis = game.user?.isGM ? null : basisNow();
    const placeables = canvas.tokens?.placeables ?? [];
    count("visibility.applyAll");
    count("visibility.applyAll.tokens", placeables.length);

    for (const token of placeables) {
        /*
         * THE FLAG IS THE UN-HIDE PATH, AND THE COMMENT HERE USED TO SAY
         * SOMETHING ELSE.
         *
         * It read "Ask Foundry to refresh, which runs applyToToken through the
         * hook", which cannot be the reason: `applyToToken` runs on the very
         * next line whether or not Foundry refreshes anything. A reader who
         * believed it would delete the line as a duplicate, and deleting it
         * breaks the feature this file exists for.
         *
         * What the flag actually does is give Foundry back the tokens this
         * module has hidden. `hide()` writes `visible = false` onto seven
         * display objects by hand, and the only thing in here that reverses it
         * is `show()`, which returns early only for a token with `hidden` set
         * (see its own note). It is called for the tokens whose verdict is
         * "show": the viewer's own, and since E112v a veiled token of the
         * killers' side for a viewer on that side (`tokenShownTo`'s veil branch),
         * which need not be the viewer's (read 21.11.2026). Every other token
         * this module hid - one whose verdict is not "show" any more - is given
         * back by Foundry's own visibility pass, and this is how it is asked to
         * run. Take the line out and an Eclipse ending, the
         * clock moving, a Truth Bullet arriving and the lair opening all leave
         * other people's tokens stranded invisible - and no test anywhere would
         * catch it, because the harness has no canvas.
         *
         * Found by a verification pass on 16.09; three readers reached it
         * independently, which is why it is written down rather than fixed.
         */
        if (token.renderFlags?.set) {
            token.renderFlags.set({ refreshVisibility: true });
            count("visibility.applyAll.flags");
        }
        applyToToken(token);
    }

    if (!game.user.isGM && enforcing()) {
        debug(`Room visibility applied; you are in: ${Array.from(myRooms()).join(", ") || "nowhere"}`);
    }
}

/**
 * THE PROJECT TOKENS ALONE, ASKED AGAIN (PV, 13.11.2026): when what this player saw last changes (`drpgSeenChanged`).
 * Each is handed back to Foundry's own visibility (`refreshVisibility`, the un-hide path `applyAll` explains) and asked
 * `applyToProjectToken` again with the pass's reading of what was seen dropped. Nothing on a GM's browser.
 */
function projectTokensPass() {
    if (!canvas?.ready || game.user?.isGM) return 0;
    forgetSeenPass();
    let n = 0;
    for (const token of canvas.tokens?.placeables ?? []) {
        const projectId = projectIdOf(token?.document);
        if (!projectId) continue;
        count("visibility.projectTokensPass");
        token.renderFlags?.set?.({ refreshVisibility: true });
        applyToProjectToken(token, projectId);
        n += 1;
    }
    return n;
}

/**
 * Every room this user's characters are standing in.
 *
 * Memoised, because the cost was quadratic and the canvas felt it. `applyAll`
 * walks every token on the scene and each one asked this question again, and
 * each answer walked every token on the scene a second time doing geometric
 * region tests - so a sixteen-student map with Remnants on it ran hundreds of
 * `roomOfToken` calls per refresh, and `refreshToken` fires on every frame of a
 * drag. The answer cannot change between two tokens of the same pass.
 *
 * Dropped whenever anything that could move US happens: see `forgetMyRooms`.
 */
let myRoomsCache = null;
/**
 * Which Remnants this user has already copied, as trace keys (`sceneId.tokenId`) -
 * see `applyToRemnantToken`. Read through truth-bullets.mjs `ownBulletRefs` since
 * E05 C13: a GM's from the store's rows, a player's from their own copy of them -
 * the bullet's public `remnantRef` flag, which every browser read, is gone. The
 * copy changing (`drpgBulletRefsChanged`) redraws. Memoised for the same reason `myRoomsCache` is:
 * every revealed Remnant on the scene would otherwise re-scan every character
 * this user owns and every Truth Bullet on each of them, per token, per
 * `refreshToken`. Bullet ownership does not actually change on every token
 * move, but invalidating it on the same triggers as the room cache is cheap
 * and never wrong - only occasionally recomputed one hook earlier than it had
 * to be.
 */
let myRemnantRefsCache = null;

function forgetMyRooms() {
    count("visibility.forget");
    forgetSeenPass();
    myRoomsCache = null;
    myRemnantRefsCache = null;
    incidentEntitled = null;
}

function myRooms() {
    if (myRoomsCache) return myRoomsCache;
    count("visibility.myRooms.walk");

    const rooms = new Set();
    /* A DEAD STUDENT'S SPECTATOR IS NO EYE (E62 C3b, 13.11.2026; the coordinator's scope B: "only what a dead student
       sees today"). The player who owns a student and its Spectator (spectator-dead.mjs) is no Spectator viewer, so the
       room rule holds for them - and the Spectator's token, which walks anywhere, would show them every room it walks
       into. It is left out; a Spectator viewer (E92) returns before this rule in `tokenShownTo`. */
    const watcherIsNoEye = !spectatorViewer();
    for (const token of canvas.tokens?.placeables ?? []) {
        if (!token.isOwner || token.actor?.type !== "character") continue;
        if (watcherIsNoEye && flaggedSpectator(token.actor)) continue;
        // Nor is a Monocub's corpse beside the token it walks (E62 C3b fix, the coordinator's 7): the body's room is no
        // room the Monocub stands in.
        if (isMonocubCorpse(token.document)) continue;
        const room = roomOfToken(token.document);
        if (room) rooms.add(room);
    }

    myRoomsCache = rooms;
    return rooms;
}

function myRemnantRefs() {
    if (myRemnantRefsCache) return myRemnantRefsCache;

    const refs = new Map();
    for (const { item, ref } of ownBulletRefs()) {
        if (!refs.has(ref)) refs.set(ref, item);
    }

    myRemnantRefsCache = refs;
    return refs;
}

/**
 * WHETHER THIS BROWSER SHOWED A TRACE AS FOUND (PV, 13.11.2026; the owner's rule #4): a Remnant's token not hidden by a
 * GM's hand and shown here by `applyToRemnantToken` - a Truth Bullet of this user's copies it, or it is a trace of the
 * live incident this user is in (D11). Read off the document, so it answers in `deleteToken`, after the token's
 * placeable is gone (projects-seen.mjs `ghostOf`). False on a GM's browser: a GM leaves no ghost.
 */
export function shownAsFound(tokenDoc) {
    if (!tokenDoc || game.user?.isGM || tokenDoc.hidden) return false;
    const key = remnantKeyOf(tokenDoc);
    if (!key) return false;
    return myRemnantRefs().has(key) || myIncidentTrace(tokenDoc);
}

/**
 * The viewer's own Truth Bullet copied from one Remnant, or null.
 *
 * A Map rather than the Set this used to be, so that remnant-ring.mjs can read
 * the ITEM out of the same pass instead of running the identical double loop
 * again. Nothing here needed the item - `applyToRemnantToken` only asks whether
 * a key is present, which a Map answers the same way - and remnant-ring had its
 * own copy of this loop, uncached, for the ring colour and the Remnant card.
 * Two lifetimes for one question is the part worth removing; the speed is a
 * side effect and a small one (measured at 0.0026 ms per scan on a client with
 * one owned character).
 *
 * ONLY THE MAPPING IS CACHED, never anything read off the item. `shownType`
 * changes the moment Analyze identifies a bullet, and that is an item UPDATE -
 * which this cache deliberately does not listen for, because callers hold the
 * live document and `getFlag` on it is always current. What invalidates the
 * cache is a bullet appearing or disappearing (`createItem`/`deleteItem` in
 * `registerVisibility`) and every `applyAll`, which is `forgetMyRooms`.
 */
export function myBulletForRemnant(key) {
    return key ? (myRemnantRefs().get(key) ?? null) : null;
}

/**
 * Why is somebody visible who should not be?
 *
 * The two ways this mechanism fails look identical from the table - everybody
 * sees everybody - and they need opposite repairs, so this asks the map both
 * questions at once and prints the answers side by side:
 *
 *   room === null everywhere   the hit test is rejecting the whole scene, and
 *                              the repair belongs in `regionsAt` (movement.mjs)
 *   rooms correct, visible     Foundry recomputed visibility after this module
 *   for someone elsewhere      did, and the repair belongs in the hook order
 *                              above - see `reassertNextFrame`
 *
 * Run it on a PLAYER's client with at least two characters standing in two
 * different rooms; on a GM's client every token is visible by design and the
 * table says nothing.
 */
export function diagnoseVisibility() {
    const lines = [];
    const setting = (() => {
        try {
            return game.settings.get(MODULE_ID, SETTINGS.roomVisibility) ? "on" : "OFF";
        } catch {
            return "unreadable";
        }
    })();

    lines.push(`Room visibility setting: ${setting}`);
    lines.push(`This client is a GM: ${game.user.isGM ? "yes - every token is visible by design" : "no"}`);
    lines.push(`Scene: ${canvas?.scene?.name ?? "none"} · regions: ${canvas?.scene?.regions?.size ?? 0}`);
    lines.push(`My rooms: ${Array.from(myRooms()).join(", ") || "none"}`);
    lines.push("");

    for (const token of canvas?.tokens?.placeables ?? []) {
        if (token.actor?.type !== "character") continue;
        const room = roomOfToken(token.document);
        lines.push([
            token.name.padEnd(16),
            `regions ${String(token.document.regions?.size ?? 0).padStart(2)}`,
            `room ${(room ?? "-").padEnd(14)}`,
            token.isOwner ? "mine " : "     ",
            token.visible ? "VISIBLE" : "hidden"
        ].join("  "));
    }

    const report = lines.join("\n");
    console.log(report);
    return report;
}

/** Who this user can currently see, for diagnostics. */
export function visibleCharacters() {
    return (canvas?.tokens?.placeables ?? [])
        .filter(t => t.actor?.type === "character" && t.visible)
        .map(t => t.actor.name);
}
