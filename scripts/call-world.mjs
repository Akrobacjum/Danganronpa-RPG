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
 * utils.mjs, statically. movement.mjs imports `isSealed` and `isChained` from the
 * facade statically, so a static import of movement.mjs here would close a cycle
 * (movement -> call-effects -> call-world); it stays a lazy `import()`, as do the
 * others, which a pure move does not touch. `isCallSilenced` sits here (renamed
 * from `isSilenced` by E33 C9) because it reads `restrictions()` and nothing else.
 */

import { MODULE_ID } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { announce, log, warn, error, plural, isPrimaryGm } from "./utils.mjs";

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
        return record ?? null;
    } catch (err) {
        error("Could not write the pending assembly", err);
        return null;
    }
}

/**
 * Call one. Public, loudly, with the room named.
 *
 * The room is checked against the scene HERE rather than at the moment it
 * fires: an order for a room that does not exist would sit on the board for a
 * whole time of day and then fail silently in front of nobody.
 */
export async function scheduleGather(room, by = null) {
    if (!game.user.isGM) return null;

    /* THE ORDER REMEMBERS ITS SCENE (CALL-18, 20.09). The room is a REGION on one
       scene, and the order is carried out later by whichever GM is primary then -
       who may be looking at another scene entirely. Without this the assembly was
       looked for on that GM's current map, was not found, and the order had already
       been cleared. Resolved here, where the room has just been checked against the
       map the GM is actually working on. */
    const scene = canvas?.scene ?? null;
    if (!scene?.regions?.find(r => r.name === room)) {
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

    await writeGather(null);

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
    const scene = order.sceneId ? game.scenes.get(order.sceneId) : (canvas?.scene ?? null);
    const region = scene?.regions?.find(r => r.name === order.room) ?? null;
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
export async function gatherEveryone(room, onScene = null) {
    /* THE SCENE IS AN ARGUMENT NOW (CALL-18, 20.09), and it defaults to this
       client's own. The caller that passes nothing - the immediate branch of Public
       Announcement - runs on the client that has just chosen the room, so its own
       view IS the right answer. A DEFERRED assembly is the case that is not: see
       `runPendingGather`; and so is a body discovery, whose watcher runs on the
       primary GM whatever it is looking at - it passes the body's scene since E05
       fix r2-G3 (chapter.mjs `runDiscovery`). */
    const scene = onScene ?? canvas?.scene ?? null;
    if (!game.user.isGM || !scene) return 0;

    const region = scene.regions.find(r => r.name === room);
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
    const tokens = [...scene.tokens]
        .filter(t => t.actor?.type === "character" && !isMonokuma(t.actor)
            && !(isDeadForGm(t.actor) && !isMonocub(t.actor)));

    if (!tokens.length) return 0;

    // Nobody is billed for this: the move is made by a GM client, and
    // movement.mjs exempts GM-initiated moves outright.
    try {
        await region.teleportTokens(tokens, { placement: "random", snap: true, pan: false });
        return tokens.length;
    } catch (err) {
        error("Region teleport failed; falling back to a direct placement", err);
        const { REVERT } = await import("./movement.mjs");
        return fallbackGather(scene, region, tokens, REVERT);
    }
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
async function fallbackGather(scene, region, tokens, REVERT) {
    const bounds = region.object?.bounds ?? region.bounds;
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
