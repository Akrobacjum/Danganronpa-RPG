/**
 * Danganronpa RPG - what a Despair Call leaves standing in the world.
 * ---------------------------------------------------------------------------
 * Two kinds of world state the Calls write and the rest of the module obeys:
 *
 *   · seals and restrictions - a sealed room, a silenced or a chained student,
 *     kept until the time of day ends (`clearSeals`)
 *   · a called assembly - the order Public Announcement writes, held when the
 *     next time of day starts (`runPendingGather`)
 *
 * Their readers and writers live here; what obeys them does not: movement.mjs
 * reads the seal and the chain, calls.mjs the silence, and clock.mjs, eclipse.mjs
 * and sync.mjs clear the restrictions and hold the assembly. Choosing the room or
 * the student, and paying, are call-pickers.mjs's and calls.mjs's.
 *
 * WHERE IT SITS. Moved out of call-effects.mjs by E34 (1.2.70), a pure move that
 * `node tools/moved-only.mjs` proves line by line. The file above it is
 * call-effects.mjs: its effects call `sealRoom`, `restrict`, `scheduleGather` and
 * `gatherEveryone` and ask `isSealed`, `isCallSilenced` and `isChained`, so it
 * imports them from here - which is why `sealRoom` and `restrict` are exported
 * now - and it re-exports the eleven names of this file it exported before, so
 * every other importer keeps importing call-effects.mjs. Nothing here imports it
 * back (R161 would see the cycle). Below it are config.mjs, settings.mjs and
 * utils.mjs, statically, and rooms.mjs, the leaf every room is read through
 * (E12 C2a). movement.mjs imports `isSealed` and `isChained` from the
 * facade statically, so a static import of movement.mjs here would close a cycle
 * (movement -> call-effects -> call-world); it stays a lazy `import()`, as do the
 * others, which a pure move does not touch. `isCallSilenced` sits here (renamed
 * from `isSilenced` by E33 C9) because it reads `restrictions()` and nothing else.
 */

import { MODULE_ID } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { announce, log, warn, error, plural, isPrimaryGm, forcedDeletion } from "./utils.mjs";
import { roomRegions, homeScene, sceneOfRoom } from "./rooms.mjs";

/* ==========================================================================
 * ROOM EFFECTS AND RESTRICTIONS
 * --------------------------------------------------------------------------
 * Three Despair Calls buy a restriction that lasts until this time of day ends -
 * at the Eclipse that closes it, or when the clock moves without one:
 * a sealed room nobody may enter, a silenced player who may spend no Hope, and
 * a chained player who may not leave the room they are standing in.
 *
 * All three are stored as world state and *enforced* rather than merely
 * recorded. The seal used to be recorded only - the room was announced as
 * sealed and players walked straight in.
 * ========================================================================== */

/** Rooms sealed for this time of day. Cleared when it ends - see `clearSeals`. */
export function sealedRooms() {
    try {
        return game.settings.get(MODULE_ID, SETTINGS.sealedRooms) ?? [];
    } catch {
        return [];
    }
}

export function isSealed(room) {
    return Boolean(room) && sealedRooms().includes(room);
}

export async function sealRoom(room) {
    const current = new Set(sealedRooms());
    current.add(room);
    return Boolean(await writeWorld(SETTINGS.sealedRooms, Array.from(current)));
}

/**
 * A sealed room renamed (E12 fix k3-K2, 12.10.2026; open road O-b of r2-H4). A seal is a name with no
 * scene, as `isSealed` reads it, so it shuts every room of the name; fog.mjs `carryRoomInWorld` hands a
 * GM's rename here on the primary. The new name is sealed, and the old one stays sealed while a place
 * scene still has a room of it (`stillStands`): the seal stays on every room it shut, and a room of the
 * new name on another scene is shut with them, as one sealed by that name would be. Answers 1 when the
 * seal moved, else 0.
 */
export async function carrySealedRoom(from, to, stillStands = false) {
    const sealed = sealedRooms();
    if (!game.user?.isGM || !from || !to || from === to || !sealed.includes(from)) return 0;
    const next = new Set(sealed.filter(room => stillStands || room !== from));
    next.add(to);
    return (await writeWorld(SETTINGS.sealedRooms, Array.from(next))) ? 1 : 0;
}

/** Per-actor restrictions: { [actorId]: { silenced, chained, room } }. */
export function restrictions() {
    try {
        return game.settings.get(MODULE_ID, SETTINGS.restrictions) ?? {};
    } catch {
        return {};
    }
}

/**
 * The Despair Call "Silence": may this character still spend Hope Calls? Named
 * `isCallSilenced` since 1.2.69 (E33 C9, D39) - the crime-witness marker on a Monocub is
 * `isCrimeSilenced` in monocub.mjs, a different rule that until then shared this name.
 */
export function isCallSilenced(actor) {
    return Boolean(actor && restrictions()[actor.id]?.silenced);
}

/** Is this character pinned to the room they were in when the Call landed? */
export function isChained(actor) {
    return Boolean(actor && restrictions()[actor.id]?.chained);
}

export async function restrict(actor, patch) {
    const all = { ...restrictions() };
    all[actor.id] = { ...(all[actor.id] ?? {}), ...patch };
    await writeWorld(SETTINGS.restrictions, all);
    return true;
}

/**
 * Called when a time of day ends - every restriction lasts one. That is the
 * Eclipse opening (CALL-09), or the clock moving on a table that uses no
 * Eclipse; a rewind and a season reset call it too.
 */
export async function clearSeals() {
    if (!game.user.isGM) return null;
    await game.settings.set(MODULE_ID, SETTINGS.sealedRooms, []);
    await game.settings.set(MODULE_ID, SETTINGS.restrictions, {});
    await announceRestrictions();
    return true;
}

/**
 * Write a world setting and tell every client.
 *
 * These are always set from a Monokuma's sheet, so the writer is a GM. The
 * broadcast is what makes the other screens agree: a seal that only the GM's
 * client knows about is a seal that only the GM's client enforces.
 */
async function writeWorld(key, value) {
    if (!game.user.isGM) return null;
    await game.settings.set(MODULE_ID, key, value);
    await announceRestrictions();
    return true;
}

async function announceRestrictions() {
    const { broadcast, SYNC } = await import("./sync.mjs");
    broadcast(SYNC.restrictions, {});
}

/* ==========================================================================
 * A CALLED ASSEMBLY
 * --------------------------------------------------------------------------
 * Public Announcement used to be a teleport: six Despair and the cast was
 * standing in the Main Hall, mid-sentence. It is a summons now. The order goes
 * out publicly the moment it is bought, and the move happens at the start of
 * the next time of day.
 *
 * That gives the cast a whole time of day to do something about it, which is
 * the point: to be early, to be late, to be somewhere they should not be while
 * everybody else is walking to the hall. It also gives Monokuma something to
 * change his mind about - the same tile cancels it, and the Despair is gone
 * either way, because the announcement has already moved everybody's plans.
 * ========================================================================== */

/** The assembly called and not yet held, or null. */
export function pendingGather() {
    try {
        const stored = game.settings.get(MODULE_ID, SETTINGS.pendingGather) ?? {};
        return stored.room ? stored : null;
    } catch {
        return null;
    }
}

async function writeGather(record) {
    if (!game.user.isGM) return null;
    try {
        await game.settings.set(MODULE_ID, SETTINGS.pendingGather, record ?? {});
        return true;
    } catch (err) {
        error("Could not write the pending assembly", err);
        return null;
    }
}

/**
 * The scene a gather called by this actor happens on (E12 C5, 1.2.74; audit S16-07): where the
 * caller's own token stands on a place scene (movement.mjs `locateActor`, which reads documents and
 * never the camera), else the school (rooms.mjs `homeScene`) - a caller's actor may have no
 * token at all, as a Monokuma's need not. Read on the GM who applies the Call, and on the caller's browser by the room
 * picker, from the same documents, so the list a caller picks from is the list the GM accepts. A
 * packet's own scene is never asked.
 */
export async function gatherSceneOf(actor) {
    const { locateActor } = await import("./movement.mjs");
    return locateActor(actor)?.scene ?? homeScene();
}

/**
 * The order's room renamed (E12 fix r2-H4, 11.10.2026; early review EARLY-C8-3). The order names its
 * room, and a GM's rename of it before the assembly was held left the order for a room that was gone:
 * `runPendingGather` then clears it and says so. fog.mjs `carryRename` moves the room's name on the
 * primary, for an order on the renamed room's scene (one written with no scene: when `firstHere`, the
 * scene `sceneOfRoom` gave it was this one). Answers 1 when the order moved, else 0.
 */
export async function carryGatherRoom(scene, from, to, firstHere = false) {
    const order = pendingGather();
    if (!game.user?.isGM || !scene || !order || order.room !== from || !to || from === to) return 0;
    if (order.sceneId ? order.sceneId !== scene.id : !firstHere) return 0;
    return (await writeGather({ ...order, room: to })) ? 1 : 0;
}

/**
 * Call one. Public, loudly, with the room named.
 *
 * The room is checked against the scene HERE rather than at the moment it
 * fires: an order for a room that does not exist would sit on the board for a
 * whole time of day and then fail silently in front of nobody.
 */
export async function scheduleGather(room, by = null, { scene: onScene = null } = {}) {
    if (!game.user.isGM) return null;

    /* THE ORDER REMEMBERS ITS SCENE (CALL-18, 20.09). The room is a REGION on one
       scene, and the order is carried out later by whichever GM is primary then -
       who may be looking at another scene entirely. Without this the assembly was
       looked for on that GM's current map, was not found, and the order had already
       been cleared.
       AND THE SCENE IS THE CALLER'S, NOT THE CAMERA'S (E12 C5, 1.2.74; audit S16-07). It was
       resolved from the map the GM had on screen, so an order bought while that GM looked at
       the Annex was refused for a room of the school (scenario 66 E2 read two refusals at
       180df61, 11.10.2026). The Call hands in its caller's scene (`gatherSceneOf`); a caller
       that hands none - the console - gets the room's own scene (`sceneOfRoom`). */
    const scene = onScene ?? sceneOfRoom(room);
    if (!roomRegions(scene, room).length) {
        ui.notifications.warn(game.i18n.format("DRPG.Calls.noSuchRoom", { room }));
        return null;
    }

    const { getClock } = await import("./clock.mjs");
    const clock = getClock();
    const record = {
        room,
        sceneId: scene.id,
        by: String(by ?? ""),
        chapter: clock.chapter,
        session: clock.session,
        // The time of day it was BOUGHT in. Ripeness is "the clock has moved
        // since", which is why the value is stored rather than a boolean: an
        // Eclipse does not move it, so an order called before an Eclipse still
        // waits for the time of day on the far side of it.
        timeOfDay: clock.timeOfDay,
        at: Date.now()
    };

    if (!await writeGather(record)) return null;

    await announce({
        flags: { [MODULE_ID]: {
            sfx: { key: "publicAnnouncement", gm: true },
            popupKind: "objection",
            popupTitle: game.i18n.localize("DRPG.Calls.gatherTitle")
        } },
        content: `<div class="drpg-evidence-card">
            <div class="drpg-objection-banner">${game.i18n.localize("DRPG.Calls.gatherBanner")}</div>
            <p>${game.i18n.format("DRPG.Calls.gatherBody", {
                room: foundry.utils.escapeHTML(room)
            })}</p>
            <p class="notes">${game.i18n.localize("DRPG.Calls.gatherNote")}</p>
        </div>`
    });

    log(`Assembly called in ${room} for the next time of day.`);
    return record;
}

/**
 * Call it off. No refund, deliberately: the announcement has already been
 * heard, and half the cast has already changed where they were going.
 */
export async function cancelGather() {
    if (!game.user.isGM) return null;

    const order = pendingGather();
    if (!order) return null;

    /* CALLED OFF ONLY WHEN IT IS (E11 fix r1-G5, 1.2.73; round 1's EARLY-C6-3). `writeGather` answered null for a
       cleared order whether the write landed or threw, and this posted "called off" either way: the order stood,
       held at the next time of day, after the table had been told it was off (tier 2 "an assembly whose calling
       off was not written is not announced as called off" read the card posted with the code before this,
       11.10.2026). The failed write is logged by `writeGather`; the order stands and nothing is announced. */
    if (!(await writeGather(null))) return null;

    await announce({
        flags: { [MODULE_ID]: {
            sfx: { key: "publicAnnouncement", gm: true },
            popupKind: "info",
            popupTitle: game.i18n.localize("DRPG.Calls.gatherTitle")
        } },
        content: `<div class="drpg-evidence-card">
            <p>${game.i18n.format("DRPG.Calls.gatherCancelled", {
                room: foundry.utils.escapeHTML(order.room)
            })}</p>
        </div>`
    });

    log(`Assembly in ${order.room} called off.`);
    return order;
}

/**
 * Hold it, if it is ripe. Called from the clock's own sync, on every client.
 *
 * ONE CLIENT DOES THE MOVING, AND IT IS THE PRIMARY GM (trap 106). Not whoever
 * advanced the clock: a second GM stepping the time of day would otherwise
 * either double the teleport or, on a client without the scene loaded, do
 * nothing at all and lose the order.
 *
 * The record is cleared BEFORE the teleport rather than after. This function is
 * reached twice on a healthy connection - once from the module's socket and
 * once from the setting's own `onChange` - and the two are merged by a 120ms
 * window that a slow client can miss. Clearing first makes the second pass find
 * nothing, which is the behaviour that matters; the cost is that a teleport
 * which throws leaves no order behind to retry, and a GM who wants it can call
 * one again for free with `game.drpg.gatherEveryone`.
 */
export async function runPendingGather() {
    if (!game.user.isGM || !isPrimaryGm()) return null;

    const order = pendingGather();
    if (!order) return null;

    const { getClock } = await import("./clock.mjs");
    const clock = getClock();

    // Still the time of day it was called in: not yet.
    if (clock.timeOfDay === order.timeOfDay && clock.session === order.session) return null;
    // An Eclipse is the window BEFORE a time of day. Gathering the cast into it
    // would hand them the assembly and then a free window to walk out of it.
    if (clock.eclipse === true) return null;

    /*
     * NOTHING IS CLEARED UNTIL IT CAN BE DONE (CALL-18, 20.09).
     *
     * This cleared the order first, on purpose - an order that throws half way
     * through must not fire again on the next time of day - and then called
     * `gatherEveryone`, which looks the room up on `canvas.scene`: THIS GM's current
     * map. The order is carried out by whoever is primary when it ripens, and that
     * is not necessarily the GM who called it, nor a GM looking at the right scene.
     * When the region was not found the call warned, returned 0, and the order was
     * already gone: six Despair for an assembly that never happened, with no repair
     * anywhere in the module.
     *
     * So the scene is resolved from the order and checked BEFORE the clear. A scene
     * or a region that has been deleted since is the one case where the order cannot
     * be carried out at all; it is cleared and said out loud rather than left to
     * fire into nothing every time of day for the rest of the season.
     */
    // An order written before CALL-18 carries no scene: its room's own (E12 C5), not the camera's.
    const scene = order.sceneId ? game.scenes.get(order.sceneId) : sceneOfRoom(order.room);
    const region = roomRegions(scene, order.room)[0] ?? null;
    if (!region) {
        await writeGather(null);
        ui.notifications.warn(game.i18n.format("DRPG.Calls.gatherRoomGone", { room: order.room }));
        warn(`Assembly in "${order.room}" could not be held: the room is not on that scene any more.`);
        return null;
    }

    await writeGather(null);

    const moved = await gatherEveryone(order.room, scene);
    await announce({
        flags: { [MODULE_ID]: {
            sfx: { key: "publicAnnouncement", gm: true },
            popupKind: "objection",
            popupTitle: game.i18n.localize("DRPG.Calls.gatherTitle")
        } },
        content: `<div class="drpg-evidence-card">
            <div class="drpg-objection-banner">${game.i18n.localize("DRPG.Calls.gatherBanner")}</div>
            <p>${plural("DRPG.Calls.gathered", { room: foundry.utils.escapeHTML(order.room), n: moved })}</p>
        </div>`
    });

    log(`Assembly held in ${order.room}: ${moved} moved.`);
    return { room: order.room, moved };
}

/**
 * Teleport every student into one room.
 *
 * Moving a token by writing x/y is a *move*: Foundry measures the path, and a
 * wall between here and there stops it dead - which is why Public Announcement
 * kept reporting "blocked by a wall" while everyone stayed put. Regions know how
 * to receive tokens instead: `teleportTokens` places them at a random point
 * inside the region with no path to block, which is exactly what Monokuma's
 * announcement does to the cast.
 */
export async function gatherEveryone(room, onScene = null, { held = null, box = false, only = null } = {}) {
    /* THE SCENE IS AN ARGUMENT NOW (CALL-18, 20.09). A DEFERRED assembly passes its
       order's (`runPendingGather`), a body discovery the body's (chapter.mjs
       `runDiscovery`, since E05 fix r2-G3), and the immediate branch of a Call its
       caller's (`gatherSceneOf`, E12 C5). The default was this client's own view until
       E12 C5; a caller that passes nothing - the console - gets the room's own scene. */
    const scene = onScene ?? sceneOfRoom(room);
    if (!game.user.isGM || !scene) return 0;

    const region = roomRegions(scene, room)[0];
    if (!region) {
        ui.notifications.warn(game.i18n.format("DRPG.Calls.noSuchRoom", { room }));
        return 0;
    }

    const { isMonokuma } = await import("./monokuma.mjs");
    const { isDeadForGm } = await import("./chapter.mjs");
    const { isMonocub } = await import("./monocub.mjs");
    // Not the dead (DESP-15): a body is evidence, and moving one moves the
    // crime scene. A Monocub is dead and does walk.
    /* FROM THE SCENE'S DOCUMENTS, NOT FROM THE CANVAS (CALL-18). `canvas.tokens`
       only holds the scene this client is LOOKING at, which is the whole defect one
       level up; `scene.tokens` is the same cast whether or not anybody is looking. */
    /* AS THE GMS HOLD THEM, WHEN THE CALLER SAYS SO (E13 C3b, 12.10.2026; the owner's answer of
       10.10, item 6). `isMonokuma` and `isMonocub` read actor flags a player's browser can write
       between two judgements; the return from the trial (trial-scene.mjs `returnTheLiving`) hands
       `flagsHeldNow` in, and each token's actor is read through it once, in this one synchronous
       pass (H3) - so a `monocub` flag a player wrote since the last judgement does not walk a body
       out of its room. Every other caller hands nothing and reads the documents, as before:
       the body's gather is unchanged. */
    /* ONLY THE CAST, WHEN THE CALLER NAMES ONE (E81 fix r1-D3, 12.10.2026; the owner's DZ6 of 12.10: the GM chooses
       who takes part, "and whom not to move"). The return from the trial hands `only`, the actor ids of the hall's
       cast (trial-scene.mjs `castActorIds`); a token of anybody else on the scene stays where it stands. Every other
       caller hands none and gathers everybody, as before. */
    const read = held ?? (actor => actor);
    const tokens = [...scene.tokens].filter(t => {
        if (t.actor?.type !== "character" || (only && !only.has(t.actorId))) return false;
        const actor = read(t.actor);
        return !isMonokuma(actor) && !(isDeadForGm(actor) && !isMonocub(actor));
    });

    if (!tokens.length) return 0;

    // Nobody is billed for this: the move is made by a GM client, and
    // movement.mjs exempts GM-initiated moves outright.
    let moved;
    try {
        await region.teleportTokens(tokens, { placement: "random", snap: true, pan: false });
        moved = tokens.length;
    } catch (err) {
        error("Region teleport failed; falling back to a direct placement", err);
        /* The room's box only when the caller asks (E13 C3b, 12.10.2026): the return from the trial
           lands the cast in the room as the season reset's `teleportInto` does, for the reason its
           note measured - with no box, a region the canvas does not draw puts the ring round the
           scene's centre, outside the room. The body's gather hands none, as its scenarios read. */
        const { REVERT, boundsOf } = await import("./movement.mjs");
        moved = await fallbackGather(scene, region, tokens, REVERT, box ? boundsOf(region) : null);
    }

    /* AND EVERY CAMERA GOES WITH ITS TOKEN (E11 C3, 1.2.73; audit S06-07). The tokens were moved
       and nothing told the screens: a player's HUD named the room of the body while the view
       stayed on the room they had left, now empty, and in an Eclipse the notice said "Drag your
       token" with no token on screen. `pan: false` above is the teleport's own camera, which
       would move only this GM's. Told after the moves, so a client that pans finds its token
       where it now stands; each client pans to its own (`panToGathered`). Lazily, as the rest:
       this file imports only config.mjs, settings.mjs and utils.mjs statically (the header).
       Tier 2 "the gather tells each client where its token went"; scenario 65 B1b. */
    const { broadcast, SYNC } = await import("./sync.mjs");
    broadcast(SYNC.gather, { room, scene: scene.id, tokenIds: tokens.map(t => t.id) });
    return moved;
}

/**
 * Tokens of one scene into one of its rooms, for the season reset's choice of where the cast goes
 * (season-setup.mjs `placeCast`, E11 C10b, 1.2.73): the region's own teleport, as the gather above,
 * and `fallbackGather` when the region cannot - handed the room's box as movement.mjs `boundsOf`
 * reads it. The gather hands it none and the fallback reads `region.object?.bounds ?? region.bounds`:
 * a region on a scene nobody's canvas draws has no placeable, and where the document has no `bounds`
 * either the ring lands round the scene's centre. Measured in the headless harness, whose regions
 * have neither and no `teleportTokens`: with no box handed in (10.10.2026, a mutant of this line),
 * tier 2's "the cast goes where the GM chose" read its tokens at 2120,1500 and 2085,1585 - the ring
 * round 2000,1500 of a 4000 by 3000 scene, outside both rooms. Whether Foundry's region document
 * answers `bounds`, and whether its `teleportTokens` takes these options, is not measured here. The
 * gather is left as it is (its scenarios read where its fallback puts the cast); this caller is not.
 * Answers how many were placed.
 */
export async function teleportInto(scene, region, tokens) {
    try {
        await region.teleportTokens(tokens, { placement: "random", snap: true, pan: false });
        return tokens.length;
    } catch (err) {
        error("Region teleport failed; falling back to a direct placement", err);
        const { REVERT, boundsOf } = await import("./movement.mjs");
        return fallbackGather(scene, region, tokens, REVERT, boundsOf(region));
    }
}

/** The module flag on a carried token's copy naming the token it was copied from, "<sceneId>.<tokenId>" (E13 fix r2-H1). */
export const CARRIED_FROM = "carriedFrom";

/**
 * A student's token carried from another scene into a room of `scene`, on a GM (E13 fix r1-F1, 12.10.2026; the
 * owner's item 1 of 10.10, "moved too, if it can be done"; review r1 goal Af-1, sec and cor open item 1): a copy
 * of its data without `_id` - an unlinked token's delta, every module's flags and `hidden` with it - made at the
 * centre of the room's box on the room's floor, the combatants that stood for the old token pointed at the copy,
 * then the old token deleted. The caller places the copy in the room with the rest (trial-scene.mjs
 * `returnTheLiving`, the gather after it), so the centre is only where it is made.
 *
 * A CARRY NEVER LEAVES A STUDENT WITH NO TOKEN (E13 fix r2-H1, 12.10.2026; review r2 cor B and sec S2-2; the
 * orchestrator's rule of 12.10). What is undone is decided by what the world holds after the delete, not by
 * whether the delete threw: r1-F1's undo deleted the copy on any error, so a delete that removed the old token and
 * then threw left the student with neither - tier 2 "End the trial never leaves a living student without a token"
 * read no token of theirs on the chosen place or the place it stood on at 36f559d. Now: the old token gone, the copy stands and is the answer,
 * `{ copy }`, whatever the delete said; the old token still there, the combatants are pointed back and the copy
 * deleted, and the answer is null; and when that delete is refused too, both stand and the answer is
 * `{ copy, twice: true }`, which the return names to the GMs (`carryUnfinished`). The copy is made with a module
 * flag naming its source, `carriedFrom` = "<sceneId>.<tokenId>", taken off once the old token is gone: a carry
 * stopped between the two - the GM's browser closed or reloaded - leaves a flagged copy beside its source, and the
 * next GM to load is told (trial-scene.mjs `nameUnfinishedCarries`). The flag sits on a token its player owns and
 * may write; it only makes a GM name the student or take the flag off, and decides nothing. Not measured: two GMs
 * carrying one student at once (sec S2-2 c) - whether Foundry's second delete of an id already gone throws or
 * resolves is not read, and either way the second copy stands beside the first, as before this fix.
 *
 * NOT FOUNDRY'S `teleportTokens` ACROSS SCENES: it is not in the headless harness and its v14 behaviour across
 * scenes was not read (LIVE-E13-10 keeps that, and the camera and selection a player has on the copy). A copy has
 * a new id, so every record kept by token id starts again: on this GM movement.mjs's are dropped for the old id
 * (`forgetToken`) and the copy's position is noted as a GM's create (`noteGmCreated`); another client's
 * `lastRoom` keeps an entry nobody reads again, as Foundry does not reuse a document's id. Foundry's own handling
 * of a combatant whose token is deleted is not read either: pointing it at the copy before the delete is the one
 * order that leaves it standing whatever Foundry does there; the harness has no combats (tier 2 hands a stand-in).
 *
 * WHAT COMES OVER, MEASURED (E13 fix r1-G1, 12.10.2026; the owner's question of 12.10). Tier 2 "End the trial
 * carries a student's token across scenes whole" drives End the trial's road with a linked student (a Truth Bullet
 * and another item, Hope, Stress and HP on the actor) and an unlinked one (its own resources and an item in its
 * delta), each with an image and another module's flag, one hidden and with a combatant: every field of the copy's
 * data but the id, the position and the floor is the old token's, and the actor read through the copy has the same
 * id, items and resources. That is the harness's create, which keeps the data as handed; whether v14's own create
 * does the same with an unlinked token's delta is LIVE-E13-10's. A token's id also stands in a chat card's speaker
 * (`speaker.token` with `speaker.scene`) - read in the code, not measured: of this module's readers, private-rolls.mjs
 * `rollSubjectNow` reads it only for a card that names no actor and, the token gone, goes on to Daggerheart's
 * `system.source.actor` and the author's character; secret.mjs `incidentVeils` reads only whether a speaker is
 * named; world-secrets.mjs lists it among the fields a superseded roll blanks. Daggerheart's own readers of a card's
 * token were not read: its system's code is not in this repository.
 */
export async function carryAcross(tokenDoc, scene, region) {
    const from = tokenDoc?.parent ?? null;
    if (!game.user?.isGM || !from || !scene || from.id === scene.id) return null;
    const { boundsOf, forgetToken } = await import("./movement.mjs");
    const box = boundsOf(region);
    const data = tokenDoc.toObject();
    const scoped = Boolean(data.flags?.[MODULE_ID]);
    delete data._id;
    const levels = [...(region?.levels ?? [])];
    if (levels.length) data.level = levels[0];
    else delete data.level;
    if (box) Object.assign(data, { x: Math.round(box.x + box.w / 2), y: Math.round(box.y + box.h / 2) });
    const source = `${from.id}.${tokenDoc.id}`;
    data.flags = { ...(data.flags ?? {}), [MODULE_ID]: { ...(data.flags?.[MODULE_ID] ?? {}), [CARRIED_FROM]: source } };
    const pointed = [];
    let copy = null, failed = null;
    try {
        [copy] = await scene.createEmbeddedDocuments("Token", [data]);
        if (!copy) return null;
        for (const combat of game.combats ?? []) {
            const ids = [...(combat.combatants ?? [])].filter(c => c.tokenId === tokenDoc.id && c.sceneId === from.id).map(c => c.id);
            if (!ids.length) continue;
            await combat.updateEmbeddedDocuments("Combatant", ids.map(_id => ({ _id, sceneId: scene.id, tokenId: copy.id })));
            pointed.push([combat, ids]);
        }
        await from.deleteEmbeddedDocuments("Token", [tokenDoc.id]);
    } catch (err) {
        failed = err;
    }
    // A create that threw may still have made its copy: the flag finds it.
    copy ??= [...(scene.tokens ?? [])].find(t => t.getFlag?.(MODULE_ID, CARRIED_FROM) === source) ?? null;
    if (copy && !from.tokens?.get?.(tokenDoc.id)) {
        if (failed) error(`Deleting ${tokenDoc.name}'s old token on "${from.name}" reported an error, but it is gone: its copy on "${scene.name}" stands`, failed);
        forgetToken(tokenDoc.id);
        await clearCarriedFrom(copy, !scoped).catch(err => error(`Could not take the carry's mark off ${tokenDoc.name}'s copy`, err));
        return { copy };
    }
    error(`Could not carry ${tokenDoc.name} from "${from.name}" to "${scene.name}"; it stays where it stood`, failed ?? new Error("the old token was not deleted"));
    for (const [combat, ids] of pointed) {
        await combat.updateEmbeddedDocuments("Combatant", ids.map(_id => ({ _id, sceneId: from.id, tokenId: tokenDoc.id })))
            .catch(back => error("Could not point a combatant back at the token it stood for", back));
    }
    if (!copy) return null;
    await scene.deleteEmbeddedDocuments("Token", [copy.id]).catch(back => error("Could not delete a carried token's copy", back));
    return scene.tokens?.get?.(copy.id) ? { copy, twice: true } : null;
}

/**
 * Take the carry's mark (`CARRIED_FROM`) off a token: the key, or the module's whole scope when the old token had
 * no flags of the module's (`whole`), so a finished copy holds the flags its source held. A Foundry with no
 * deletion operator unsets the key alone (utils.mjs `forcedDeletion`). A GM's write only, like the carry and the
 * load that call it (R220); answers null anywhere else. Taking the whole scope off with the operator is read in the
 * harness's shim, not in v14 at a table (LIVE-E13-10).
 */
export async function clearCarriedFrom(token, whole = false) {
    if (!game.user?.isGM) return null;
    const gone = forcedDeletion();
    if (!gone) return token.unsetFlag(MODULE_ID, CARRIED_FROM);
    return token.update({ [whole ? `flags.${MODULE_ID}` : `flags.${MODULE_ID}.${CARRIED_FROM}`]: gone });
}

/**
 * Pan this client's camera to its own token among the ones a gather moved (`SYNC.gather`,
 * sync.mjs; E11 C3, 1.2.73). Answers the token's id, or null when there is nothing to pan to:
 * no drawn canvas, another scene on screen, or none of the tokens this user's own student
 * (`ownStudent`: a GM with no assigned student has none, so the GM's camera stays where the GM
 * put it). It reads the packet's ids and this client's canvas and writes nothing; the packet is
 * applied only from a GM (sync.mjs `registerSync`). The headless harness has a canvas whose
 * `animatePan` does nothing, so scenario 65 reads the call and not a camera; whether the token's
 * new position reaches a player's canvas before this packet does at a real table is not
 * measured: both go through the server from the same GM, and the position's write is sent first.
 */
export async function panToGathered({ scene, tokenIds } = {}) {
    if (!canvas?.ready || !scene || canvas.scene?.id !== scene || !Array.isArray(tokenIds)) return null;
    const { ownStudent } = await import("./monokuma.mjs");
    const mine = ownStudent();
    if (!mine) return null;
    const token = tokenIds.map(id => canvas.tokens?.get(id)).find(t => t?.actor?.id === mine.id);
    const centre = token?.center;
    if (!centre) return null;
    await canvas.animatePan({ x: centre.x, y: centre.y });
    return token.id;
}

/**
 * If the region cannot place the tokens - an unusual shape, or a version that
 * does not offer `teleportTokens` - write the positions directly, spread around
 * the region's centre and flagged so the movement rules leave them alone.
 *
 * ON THE SCENE IT WAS HANDED, not the one on this GM's screen (review of stage
 * D). CALL-18 moved the region and the token list onto the order's scene, and
 * this fallback went on writing to `canvas.scene`: a deferred assembly run while
 * the primary GM looked at another map sent that scene's token ids to a scene
 * that does not hold them, the client backend rejected the update, and the order
 * - already cleared, its six Despair spent - moved nobody and told nobody.
 */
async function fallbackGather(scene, region, tokens, REVERT, box = null) {
    const bounds = box ? { x: box.x, y: box.y, width: box.w, height: box.h } : region.object?.bounds ?? region.bounds;
    const centre = bounds
        ? { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
        : { x: scene.width / 2, y: scene.height / 2 };

    const spread = (scene.grid?.size ?? 100) * 1.2;
    const updates = tokens.map((doc, index) => {
        const angle = (index / 8) * Math.PI * 2;
        return {
            _id: doc.id,
            x: Math.round(centre.x + Math.cos(angle) * spread),
            y: Math.round(centre.y + Math.sin(angle) * spread)
        };
    });

    await scene.updateEmbeddedDocuments("Token", updates, {
        [REVERT]: true,
        teleport: true,
        movementAction: "displace",
        animate: false
    });
    return updates.length;
}
