/**
 * Danganronpa RPG — movement between rooms.
 * ---------------------------------------------------------------------------
 * Guide: "The player gets one free move per time of day. Each further one
 * spends an action. A move takes the player to a room directly connected to
 * the one they are in."
 *
 * Moving *within* a room is not a move at all — repositioning next to someone
 * to talk costs nothing. What costs is crossing from one room into another, so
 * the charge is applied when a token's Scene Region changes, not when it is
 * dragged. Players simply drag their token; the economy follows.
 *
 * Rooms are Scene Regions. A scene with no regions charges nothing, which keeps
 * a half-built map from eating everyone's actions.
 */

import { MODULE_ID, ECLIPSE_MOVES, ECLIPSE_FREE_PLACEMENT, TIMES_OF_DAY, FLAGS,
    ROOM_OWNER_FLAG, BEDROOM_KEY_FLAG } from "./config.mjs";
import { SETTINGS, iAmTheMastermind } from "./settings.mjs";
import { hasFreeMove, takeMove, actionsLeft } from "./actions.mjs";
// Statically imported, not lazily: the crossing veto runs inside a synchronous
// `preUpdateToken` hook, where there is no opportunity to await an import.
// call-effects.mjs only reaches back into this file lazily, so there is no cycle.
import { isSealed, isChained } from "./call-effects.mjs";
// `iAmTheMastermind` comes from settings.mjs — a leaf — for the same reason:
// the veto is synchronous, so it has to be a static import. It used to come
// from mastermind.mjs, and that one edge was what closed every static import
// cycle in the module; see the note above the function.
// `neighbouringRooms` and `boundsOf` are defined further down this file.
import { whisperToOwner, isPrimaryGm, debug, error, cardHead } from "./utils.mjs";

/**
 * Region flags this file owns. Named like `VAULT_FLAGS`/`REST_FLAGS` in
 * vault.mjs, which reads this one to draw Room Setup's own "Locked" column —
 * the enforcement lives here, the flag is set from there.
 */
export const ROOM_FLAGS = {
    /** A GM has locked this room shut. Set from Room Setup only. */
    locked: "drpgLocked",

    /**
     * Whether this room is locked when a season BEGINS. Also set from Room
     * Setup, in the column beside the one above, and read by nothing but the
     * season reset, which copies it back over `locked`.
     *
     * A flag on the region rather than a setting somewhere else, because the
     * lock itself is a flag on the region and travels with the scene. Keeping
     * the opening layout anywhere but here would mean copying a map into a new
     * world carried the locks but not the state they are supposed to return
     * to — which is the kind of split that surfaces two months later.
     */
    lockedAtStart: "drpgLockedAtStart"
};

/** Last known room per token, so we only react to actual crossings. */
const lastRoom = new Map();
/** Last position inside that room, so a refused crossing can be undone. */
const lastPosition = new Map();

export function registerMovement() {
    // Refuse the move BEFORE it is written, rather than teleporting the token
    // back afterwards. The old approach was unreliable for two reasons: the
    // "where were you" cache is per-client, so whoever was not doing the
    // dragging had a stale idea of the previous room, and the revert had to
    // race the update that triggered it. Returning false here simply stops the
    // move — nothing to undo, nothing to get out of step.
    Hooks.on("preUpdateToken", onPreUpdateToken);
    Hooks.on("updateToken", onUpdateToken);
    Hooks.on("canvasReady", primeRoomCache);
    Hooks.on("preCreateToken", onPreCreateToken);
}

/**
 * Veto a room crossing the character cannot pay for.
 *
 * Runs on the client making the change, before anything is saved, so the answer
 * does not depend on any cached position.
 */
function onPreUpdateToken(tokenDoc, changes, options) {
    try {
        if (options?.[REVERT]) return;
        if (changes.x === undefined && changes.y === undefined) return;

        const actor = tokenDoc.actor;
        if (!actor || actor.type !== "character") return;
        if (game.user.isGM) return;                    // GMs move anything anywhere

        // A BODY STAYS WHERE IT FELL.
        //
        // Checked before anything else, and deliberately not through
        // `canCross`: that function answers "may this character cross from one
        // room to another", and every path through it returns early on a move
        // inside a single room. A corpse being nudged three squares across the
        // floor it died on is not a crossing, and it is exactly the move that
        // ruins a crime scene — the body is evidence, and where it is lying is
        // most of what it says.
        //
        // The GM is above this line on purpose. Moving the body is a legitimate
        // GM act (Stage 6 has the killer doing it, through the clean-up action
        // that a GM resolves), and the dead have no say in where they are put.
        //
        // A Monocub is exempt because a Monocub is not a corpse: it is a dead
        // student who joined the GM side and is walking around as one. They
        // carry `deceased` for the rules that count the living, and `monocub`
        // for everything about being a person on the map — the same pair the
        // sheet's own action panels test.
        if (isCorpse(actor)) {
            ui.notifications.warn(game.i18n.localize("DRPG.Move.dead"));
            return false;
        }

        const from = roomOfToken(tokenDoc);
        const to = roomAt(
            changes.x ?? tokenDoc.x,
            changes.y ?? tokenDoc.y,
            tokenDoc
        );

        if (from === to) return;                       // same room: always free
        if (!from && !to) return;                      // no regions here

        const allowed = canCross(actor, from, to);
        if (allowed === true) return;

        ui.notifications.warn(allowed);
        return false;                                  // the move does not happen
    } catch {
        // Never block a move because our own check failed.
    }
}

/**
 * Dead, and not a Monocub — so this token is a body rather than a person.
 *
 * Read straight off the two flags rather than through `chapter.mjs` and
 * `monocub.mjs`: this runs inside the synchronous `preUpdateToken` veto, where
 * there is no chance to await an import, and the flag names come from
 * config.mjs so the readers here cannot drift from the writers there.
 */
function isCorpse(actor) {
    try {
        if (!actor?.getFlag(MODULE_ID, FLAGS.deceased)) return false;
        return !actor.getFlag(MODULE_ID, FLAGS.monocub);
    } catch {
        // A state we cannot read must not freeze a token nobody can move.
        return false;
    }
}

/**
 * May this character cross right now?
 *
 * WHAT THE "CROSSING ROOMS COSTS A MOVE" SETTING DOES AND DOES NOT TURN OFF.
 * The whole of this function used to sit behind that one setting, so a GM who
 * switched it off — its hint says "turn off to handle movement by hand", which
 * plainly means the COST — also silently switched off three rules that have
 * nothing to do with cost and their own separate UI:
 *
 *   · a sealed room, and the Despair Call that chained somebody to one. A
 *     Monokuma had spent a resource on that door.
 *   · the lock that keeps the two people in a murder inside the incident. It
 *     became draggable straight out of.
 *   · the Eclipse's two-crossing cap and its connected-rooms rule, in a mode
 *     the GM had deliberately started.
 *
 * So the absolute rules are checked first and always. Only the economy below
 * them — the free Move, then an action — answers to that setting, along with
 * ordinary-play adjacency, which is the same "handled by hand" bargain.
 *
 * @returns {true|string} true, or the reason it is refused.
 */
function canCross(actor, from, to) {
    // Monokumas are not bound by any of this.
    if (actor.getFlag(MODULE_ID, FLAGS.monokuma)) return true;

    // You are in a murder. You do not walk out of it.
    //
    // The incident is a turn-based exchange in one room, and the only ways out
    // of it are the ones the guide writes as crisis actions — Survive, Escape
    // together, a Finishing blow. Dragging the token across the map is not one
    // of them, and doing it left the engine running an incident between two
    // people standing in different rooms.
    const inIncident = lockedInIncident(actor);
    if (inIncident) return inIncident;

    // Despair Calls that physically stop you. Checked before the action economy
    // because they are absolute: no amount of actions buys past a locked door.
    const blocked = restrictedFrom(actor, to);
    if (blocked) return blocked;

    const clock = game.settings.get(MODULE_ID, SETTINGS.clock);
    const eclipse = clock?.eclipse === true;

    // A Morning or Night Eclipse places freely: any room, no budget, no
    // adjacency. Derived from the clock here rather than imported from
    // eclipse.mjs, which imports this file — the same reason the eclipse flag
    // above is read straight off the setting.
    const index = TIMES_OF_DAY.indexOf(clock?.timeOfDay);
    const incoming = TIMES_OF_DAY[(index < 0 ? 0 : index + 1) % TIMES_OF_DAY.length];
    const freePlacement = ECLIPSE_FREE_PLACEMENT.includes(incoming);

    if (eclipse) {
        // A free-placement Eclipse skips both limits but must STILL return here.
        // Falling through would drop the crossing into the movement economy
        // below and charge it a free Move or an action — and an Eclipse crossing
        // has never cost either.
        if (!freePlacement) {
            const used = game.settings.get(MODULE_ID, SETTINGS.eclipseMoves)?.[actor.id] ?? 0;
            // ECLIPSE_MOVES, not a repeated literal: the cap lives in eclipse.mjs
            // and was duplicated here, so raising it in one place left the other
            // refusing the extra crossings.
            if (used >= ECLIPSE_MOVES) return game.i18n.localize("DRPG.Eclipse.noMovesLeft");

            if (from && to) {
                const connected = neighbouringRooms(from);
                if (connected.length && !connected.includes(to)) {
                    return game.i18n.format("DRPG.Eclipse.notConnected", {
                        from, to, rooms: connected.join(", ")
                    });
                }
            }
        }
        return true;
    }

    // Everything above this line is absolute and applies whatever the setting
    // says. Everything below is the movement economy the setting governs.
    if (!game.settings.get(MODULE_ID, SETTINGS.chargeMovement)) return true;

    // Guide: "A move takes the player to a room directly connected to the one
    // they are in." Only the Eclipse used to check this, so during an ordinary
    // time of day a token could be dragged clean across the map for one Move —
    // which makes Listen, room visibility and any alibi meaningless.
    const notConnected = crossingRefused(from, to);
    if (notConnected) return notConnected;

    if (hasFreeMove(actor)) return true;
    if (actionsLeft(actor) >= 1) return true;
    return game.i18n.localize("DRPG.Move.noBudget");
}

/**
 * Is the destination reachable from where you stand?
 *
 * Silent when adjacency cannot be established — `neighbouringRooms` already
 * treats a room it cannot measure the geometry of as reachable, and a map the
 * module cannot read must not become a map nobody can walk across. Leaving the
 * rooms entirely, or arriving from outside them, is likewise not a crossing
 * this rule governs.
 *
 * @returns {false|string} false when allowed, otherwise the reason.
 */
function crossingRefused(from, to) {
    if (!from || !to) return false;

    const connected = neighbouringRooms(from);
    if (!connected.length || connected.includes(to)) return false;

    return game.i18n.format("DRPG.Move.notConnected", {
        from, to, rooms: connected.join(", ")
    });
}

/**
 * Is this character pinned into a murder that is happening right now?
 *
 * Read straight off the world setting rather than through `murder.mjs`: this
 * runs inside a synchronous `preUpdateToken` veto, where there is no chance to
 * await an import. The shape is `murderState()`'s own — `active`, and the three
 * participant ids.
 *
 * The third party is deliberately NOT included. The guide gives them "Odwrócony
 * wzrok" as one of their options — "strona trzecia opuszcza pomieszczenie i nie
 * interweniuje" — and says what stops them is the price of the move, not a
 * wall: "koszt ruchu z dużym prawdopodobieństwem mu to uniemożliwi". Locking
 * them in removed a choice the rules explicitly offer. The two people actually
 * fighting are the ones with no way out except a crisis action.
 *
 * Only while the incident itself is running. Stage 4 is still the killer
 * deciding, and Stage 6 is the clean-up — the guide has the killer moving around
 * the scene for that one.
 *
 * @returns {false|string} false when free to move, otherwise the reason.
 */
function lockedInIncident(actor) {
    try {
        const state = game.settings.get(MODULE_ID, SETTINGS.murderState) ?? {};
        if (!state.active || state.stage !== "incident") return false;

        const involved = [state.killerId, state.victimId]
            .filter(Boolean)
            .includes(actor.id);
        if (!involved) return false;

        return game.i18n.localize("DRPG.Murder.cannotLeave");
    } catch {
        // A state we cannot read must not become a map nobody can walk across.
        return false;
    }
}

/**
 * Is a Despair Call — or a GM's own lock — standing in the way?
 *
 * The sealed-room checks were previously bookkeeping: "Behind Closed Doors"
 * wrote the room name into a world setting, announced it, and nothing ever
 * read it back, so a sealed room was a sentence in chat that players walked
 * straight through. `drpgLocked` is the same category of rule from a
 * different source — a GM's own Room Setup, not a Despair Call — and gets the
 * same absolute treatment: no number of actions buys past a locked door.
 *
 * The Mastermind is the one exception, and only for THIS category — doors
 * their own side locked, and Despair Call seals, are doors they hold the key
 * to. `isChained` is untouched: that Despair Call targets a specific person,
 * not a door, and it stays absolute for everyone it is cast on.
 *
 * @returns {false|string} false when the move is allowed, otherwise the reason.
 */
function restrictedFrom(actor, to) {
    try {
        if (isChained(actor)) return game.i18n.localize("DRPG.Calls.chainedBlocked");
        if (to && !iAmTheMastermind()) {
            if (isLocked(to)) return game.i18n.localize("DRPG.Move.locked");
            if (isSealed(to)) return game.i18n.format("DRPG.Calls.sealedBlocked", { room: to });
            // Somebody's bedroom. The owner walks in; anybody else needs the
            // key they were given — see the note on keys in vault.mjs. A GM
            // moving a token is not standing in the fiction and is never
            // stopped by a door.
            if (!game.user.isGM && bedroomShut(actor, to)) {
                return game.i18n.format("DRPG.Vault.keyMissing", { room: to });
            }
        }
    } catch {
        // A restriction we cannot read must not block an ordinary move.
    }
    return false;
}

/**
 * Has a GM locked this room shut, from Room Setup?
 *
 * Reads the flag straight off the room's own Region on the scene actually
 * being dragged on — the same `canvas?.scene` assumption every other room
 * function in this file makes for the synchronous veto path (see `roomAt`,
 * `neighbouringRooms`): the crossing being judged is always happening on
 * whatever scene the dragging client has open.
 */
function isLocked(room) {
    if (!room) return false;
    for (const region of canvas?.scene?.regions ?? []) {
        if (region.name === room) return Boolean(region.getFlag(MODULE_ID, ROOM_FLAGS.locked));
    }
    return false;
}

/**
 * Is this somebody else's bedroom, and are they carrying no key to it?
 *
 * Read straight off the two documents rather than through vault.mjs — that file
 * already reaches into this one, and this veto runs inside a synchronous
 * `preUpdateToken` where a dynamic import is not an option. Both flag names
 * come from config.mjs so the two readers cannot drift apart.
 *
 * A room nobody owns is not a bedroom. The owner never needs a key to their own
 * door: losing it would otherwise lock them out of the one place the guide says
 * is theirs.
 */
function bedroomShut(actor, to) {
    for (const region of canvas?.scene?.regions ?? []) {
        if (region.name !== to) continue;
        const owner = region.getFlag(MODULE_ID, ROOM_OWNER_FLAG);
        if (!owner || owner === actor?.id) return false;
        return !Array.from(actor?.items ?? [])
            .some(item => item.getFlag(MODULE_ID, BEDROOM_KEY_FLAG) === to);
    }
    return false;
}

/** Which room a point falls inside, using the same regions as roomOfToken. */
function roomAt(x, y, tokenDoc) {
    const scene = tokenDoc?.parent ?? canvas?.scene;
    if (!scene?.regions?.size) return null;

    // Test the token's centre, not its corner — measured with THAT SCENE's grid.
    //
    // `canvas.grid.size` is the grid of the scene currently on screen, and this
    // function is asked about tokens on other scenes all the time now: the voice
    // reconciler locates every character wherever they are, Observe is scored on
    // a GM's client that is usually looking elsewhere, and Stage 6 lists the
    // traces in a room the GM may not have open. A 200px-grid scene measured
    // with a 100px canvas puts the "centre" of a 2×2 token half a square off,
    // which is enough to read as the wrong room — or none at all — right at the
    // edges where rooms actually meet.
    //
    // The hit test itself has the same cross-scene problem, twice over, and both
    // halves of it used to fail SILENTLY — which is why this whole function
    // answered "no room at all" for every token on a scene nobody was looking at,
    // and every caller that depends on it (Observe, Stage 6, voice, `sameRoom`)
    // quietly saw an empty map.
    //
    //   1. `region.object` is the rendered PLACEABLE. It exists only for the
    //      scene currently on the canvas, and `Region#testPoint` on it has been
    //      deprecated since v13 and is removed in v15 — so on the scene where it
    //      did work, it worked by logging a deprecation warning, and in a world
    //      with `CONFIG.compatibility.mode = ERROR` it threw.
    //   2. `RegionDocument#testPoint` is the real API, but a Region is a
    //      THREE-dimensional volume: it runs `point.elevation` through
    //      `_testElevation` before it ever looks at the polygons, and an absent
    //      elevation loses every comparison in there (`undefined < bottom`,
    //      `undefined === bottom`, `undefined < top` are all false). So
    //      `testPoint({x, y})` returns false for every region on the map.
    //
    // False is not nullish, so the old `??` chain never reached the geometric
    // fallback either: a truthful "outside" and "I cannot answer" were being
    // treated as the same thing. The chain below distinguishes them explicitly —
    // the bounding box is for a region that cannot be ASKED, not for one that
    // answered no.
    const regions = regionsAt(scene, x, y, tokenDoc);
    return regions.map(r => r.name).sort()[0] ?? null;
}

/**
 * Every named Region a point falls inside — the plural version of `roomAt`,
 * for the one caller that needs ALL of them rather than the alphabetically-
 * first name: a token standing where two rooms overlap is in both at once,
 * and vision restriction (see `visibility.mjs`'s `clipVisionToRoom`) has to
 * clip to their union, not silently pick one. Shares every edge case `roomAt`
 * already worked out — grid size, elevation, the `testPoint` fallback chain —
 * rather than risking the two drifting apart.
 */
export function regionsAt(scene, x, y, tokenDoc) {
    if (!scene?.regions?.size) return [];

    const size = scene.grid?.size ?? canvas?.grid?.size ?? 100;
    const cx = x + ((tokenDoc?.width ?? 1) * size) / 2;
    const cy = y + ((tokenDoc?.height ?? 1) * size) / 2;
    const elevation = Number.isFinite(tokenDoc?.elevation) ? tokenDoc.elevation : 0;

    const named = Array.from(scene.regions).filter(r => r.name);
    const found = [];
    let asked = 0;

    for (const region of named) {
        if (typeof region.testPoint !== "function") {
            if (containedBy(region, cx, cy)) found.push(region);
            continue;
        }
        asked++;
        if (region.testPoint({ x: cx, y: cy, elevation })) found.push(region);
    }

    // EVERY region said no, and every region was asked the same way.
    //
    // One region answering "outside" is an answer. All of them answering
    // "outside" for a point that is visibly inside a room is the failure this
    // function has already been repaired for twice, in a third shape: whatever
    // `testPoint` is checking this build — an elevation band, a polygon that
    // carries holes where two rooms share a wall (see the v14 canvas notes) —
    // is rejecting the point before the geometry is ever consulted. It fails
    // SCENE-WIDE, not per token, so the symptom is not "one character is in the
    // wrong room" but "nobody is in any room", and everything downstream goes
    // quiet at once: room visibility hides nobody, Listen hears nothing, Search
    // finds no room to spend a token in.
    //
    // So when the precise test rejects the point everywhere, fall through to
    // the bounding box rather than reporting an empty map. A box is coarser
    // than a polygon and can name a neighbouring room at a corner; being
    // slightly wrong about which room is recoverable, and being certain there
    // are no rooms is not.
    if (!found.length && asked === named.length && named.length) {
        for (const region of named) {
            if (containedBy(region, cx, cy)) found.push(region);
        }
        if (found.length) {
            debug(`Region hit test rejected every room at (${Math.round(cx)}, ${Math.round(cy)}); `
                + `fell back to bounds and found ${found.map(r => r.name).join(", ")}.`);
        }
    }

    return found;
}

/** Bounding-box fallback when a region cannot test a point itself. */
function containedBy(region, x, y) {
    const b = boundsOf(region);
    if (!b) return false;
    return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
}

/**
 * Every token this module places or that a GM drops behaves the same way:
 * no rotation on movement, and free positioning rather than grid snapping.
 * Applied at creation so it also covers tokens dragged from the actor list.
 */
function onPreCreateToken(token, data) {
    const update = {};
    if (data.lockRotation === undefined) update.lockRotation = true;
    if (Object.keys(update).length) token.updateSource(update);
}

/** Remember where every token starts, so the first drag is judged correctly. */
function primeRoomCache() {
    lastRoom.clear();
    lastPosition.clear();
    for (const token of canvas?.tokens?.placeables ?? []) {
        lastRoom.set(token.document.id, roomOfToken(token.document));
        lastPosition.set(token.document.id, { x: token.document.x, y: token.document.y });
    }
}

async function onUpdateToken(tokenDoc, changes, options, userId) {
    try {
        // Our own revert: record where it landed, charge nothing.
        if (options?.[REVERT]) {
            lastRoom.set(tokenDoc.id, roomOfToken(tokenDoc));
            lastPosition.set(tokenDoc.id, { x: tokenDoc.x, y: tokenDoc.y });
            return;
        }

        // A GM moved it: always free, never reverted.
        //
        // Without this, a token whose owner is offline falls through to
        // "the primary GM pays" below — so a GM tidying the map was charged for
        // it and had the token teleported back. It only showed on absent
        // players' tokens, which is why one character misbehaved and another
        // did not.
        if (game.users.get(userId)?.isGM) {
            lastRoom.set(tokenDoc.id, roomOfToken(tokenDoc));
            lastPosition.set(tokenDoc.id, { x: tokenDoc.x, y: tokenDoc.y });
            return;
        }

        // Only position changes can cross a boundary.
        if (changes.x === undefined && changes.y === undefined && changes.elevation === undefined) return;

        /* ONE CHARGE PER CROSSING — AND EVERY CROSSING ALONG THE WAY.
           -------------------------------------------------------------------
           Foundry v14 delivers a move as a SERIES of updates along the token's
           path — the core says as much, deprecating `updateToken` for movement
           in favour of `moveToken` / `_onUpdateMovement` since v13. Every one of
           those intermediate updates carries new x/y, so charging on each of
           them told the player "that cost an action" two, three, four times for
           one drag. Waiting for the last update fixed that and introduced
           B-F2-1: the settlement then compared only the ENDS of the operation,
           so a route out through a neighbour and back again cost nothing at all
           — a free look into the next room — and a two-room route cost one Move
           instead of two.

           Both are answered by remembering the rooms the token passes through
           and settling the whole path at the end: still one settlement per
           drag, but the price is what the route actually cost. The veto in
           `onPreUpdateToken` already works per segment (it is not gated here),
           so adjacency and locks were never fooled by a multi-waypoint route —
           only the price was. */
        if (tokenDoc.movement?.pending?.waypoints?.length) {
            notePathRoom(tokenDoc.id, roomOfToken(tokenDoc));
            return;
        }

        // Taken — not read — so every `return` below leaves nothing behind for
        // the next drag to inherit.
        const path = takePath(tokenDoc.id);

        const actor = tokenDoc.actor;
        if (!actor || actor.type !== "character") return;

        // Monokumas walk where they like. The guide has them moving around the
        // map freely between interventions; they have no action economy to
        // spend and no walls to respect.
        const { isMonokuma } = await import("./monokuma.mjs");
        if (isMonokuma(actor)) {
            lastRoom.set(tokenDoc.id, roomOfToken(tokenDoc));
            lastPosition.set(tokenDoc.id, { x: tokenDoc.x, y: tokenDoc.y });
            return;
        }

        // "Never seen this token" and "was outside every room" are different
        // states. Without that distinction the first drag after a token appears
        // looks like a crossing and wrongly costs a Move.
        const known = lastRoom.has(tokenDoc.id);
        const before = lastRoom.get(tokenDoc.id) ?? null;
        const previous = lastPosition.get(tokenDoc.id) ?? null;
        const after = roomOfToken(tokenDoc);

        if (!known) {
            lastRoom.set(tokenDoc.id, after);
            lastPosition.set(tokenDoc.id, { x: tokenDoc.x, y: tokenDoc.y });
            return;
        }

        // Every boundary this drag actually crossed, in the order it crossed
        // them. Ending where you started is no longer the same as going
        // nowhere: the route is what is charged for.
        const crossings = crossingsAlong(before, path, after);

        // Nothing crossed — a move inside one room, or a scene with no regions
        // at all: free. Remember the new spot so a later refused crossing snaps
        // back to somewhere sensible.
        if (!crossings.length) {
            lastPosition.set(tokenDoc.id, { x: tokenDoc.x, y: tokenDoc.y });
            lastRoom.set(tokenDoc.id, after);
            return;
        }

        lastRoom.set(tokenDoc.id, after);

        // Exactly one client applies the cost, or two GMs would both spend the
        // action. Prefer the player who owns the token — but only while they are
        // actually connected. "Their client pays, even if their client is not
        // here" meant nobody paid: an absent player's token could be walked
        // across the whole map for free, which is why one character seemed to
        // obey the action economy and another did not.
        const owner = game.users.find(u => !u.isGM && u.active && actor.testUserPermission(u, "OWNER"));
        const shouldCharge = owner
            ? owner.id === game.user.id
            : isPrimaryGm();
        if (!shouldCharge) return;

        // During an Eclipse the action economy is suspended: two free crossings
        // instead, judged by eclipse.mjs.
        //
        // Deliberately ahead of the `chargeMovement` gate below. The Eclipse is
        // a mode the GM starts on purpose and its cap is not an action cost, so
        // switching off "crossing rooms costs a Move" must not also hand every
        // player unlimited placement moves. This is also where a crossing gets
        // RECORDED, so skipping it would leave `movesLeft` reading two all the
        // way through the window.
        const { isEclipse, judgeEclipseCrossing } = await import("./eclipse.mjs");
        if (isEclipse()) {
            // Per crossing, like the economy below: the Eclipse's cap is two
            // CROSSINGS, and settling a whole route as one would have let a
            // multi-waypoint drag walk the map on a single allowance.
            for (const [from, to] of crossings) {
                const allowed = await judgeEclipseCrossing(actor, from, to);
                if (!allowed) {
                    await sendBack(tokenDoc, previous, before);
                    return;
                }
            }
            if (tokenDoc) lastPosition.set(tokenDoc.id, { x: tokenDoc.x, y: tokenDoc.y });
            return;
        }

        // The cost, and only the cost, is what the setting governs. Everything
        // above — the room cache, the Eclipse — has to keep running, or turning
        // the setting back on would find every token's remembered room stale and
        // charge for a crossing that happened while it was off.
        if (!game.settings.get(MODULE_ID, SETTINGS.chargeMovement)) {
            if (tokenDoc) lastPosition.set(tokenDoc.id, { x: tokenDoc.x, y: tokenDoc.y });
            return;
        }

        // One at a time, in the order they were crossed. The first one that
        // cannot be paid for stops the route and puts the token back where the
        // drag began — the moves already paid for stay paid, because they were
        // made: the refusal is about the step that could not be afforded, and
        // `sendBack` returns the token to the only position it is certain the
        // character could legally be standing in.
        for (const [from, to] of crossings) {
            const paid = await chargeForCrossing(actor, from, to, tokenDoc, previous);
            if (!paid) return;
        }
    } catch (err) {
        error("Movement charge failed", err);
    }
}

/**
 * Rooms a token has passed through during the drag currently in flight, keyed
 * by token id and emptied when that drag settles.
 */
const pathRooms = new Map();

/**
 * Note a room an in-flight drag is passing through.
 *
 * NULLS ARE NOT RECORDED, deliberately. A position part-way through a drag can
 * land in a doorway or on the seam between two regions, where `roomOfToken`
 * answers null quite correctly — but that is the token being mid-step, not the
 * character leaving the building. Recording those would charge two crossings
 * (into nowhere, and out of it again) for one ordinary walk between neighbours.
 * Leaving the rooms for real is judged from where the token STOPS, which is the
 * final update's own answer and not this function's business.
 */
function notePathRoom(tokenId, room) {
    if (!room) return;
    const seen = pathRooms.get(tokenId);
    if (!seen) {
        pathRooms.set(tokenId, [room]);
        return;
    }
    if (seen[seen.length - 1] !== room) seen.push(room);
}

/** The noted path for a token, removed as it is read. */
function takePath(tokenId) {
    const path = pathRooms.get(tokenId) ?? [];
    pathRooms.delete(tokenId);
    return path;
}

/**
 * Every boundary a route actually crossed, as `[from, to]` pairs in order.
 *
 * The whole route is `where it started → what it passed through → where it
 * stopped`; a pair whose ends are the same room is not a crossing and drops
 * out. So a drag inside one room yields nothing, an ordinary walk to a
 * neighbour yields one, and a there-and-back route yields two — which is what
 * it costs at the table.
 */
function crossingsAlong(before, path, after) {
    const route = [before, ...path, after];
    const crossings = [];
    for (let i = 1; i < route.length; i++) {
        if (route[i - 1] === route[i]) continue;
        crossings.push([route[i - 1], route[i]]);
    }
    return crossings;
}

/**
 * @returns {Promise<boolean>} whether the crossing was paid for. A route
 *   settles one crossing at a time and stops at the first refusal, so the
 *   caller needs to know which happened.
 */
async function chargeForCrossing(actor, from, to, tokenDoc = null, previous = null) {
    const free = hasFreeMove(actor);

    // Out of budget: the crossing does not happen. Put the token back where it
    // was rather than leaving it in a room it could not afford to enter.
    if (!free && actionsLeft(actor) < 1) {
        ui.notifications.warn(game.i18n.localize("DRPG.Move.noBudget"));
        // Tagged as an error popup (red border) rather than the default
        // info one — this is a refusal, the concrete case the red variant
        // exists for. See popup.mjs's catch-all createChatMessage hook.
        await whisperToOwner(actor, `${cardHead({ action: game.i18n.localize("DRPG.Move.title") })}<p>${
            game.i18n.localize("DRPG.Move.noBudgetLong")
        }</p>`, { flags: { [MODULE_ID]: { popupKind: "error" } } });

        await sendBack(tokenDoc, previous, from);
        return false;
    }

    const cost = await takeMove(actor);
    if (!cost) return false;

    const where = to
        ? game.i18n.format("DRPG.Move.entered", { room: foundry.utils.escapeHTML(to) })
        : game.i18n.localize("DRPG.Move.leftRooms");

    const price = cost === "free"
        ? game.i18n.localize("DRPG.Move.wasFree")
        : game.i18n.format("DRPG.Move.costAction", { left: actionsLeft(actor) });

    if (tokenDoc) lastPosition.set(tokenDoc.id, { x: tokenDoc.x, y: tokenDoc.y });

    // What the room looks like, when the GM has written it — the Description
    // tab in Room Setup. Walking in is the moment somebody wants to be told
    // what they are looking at (Dawid, 26.08), and it saves them opening the
    // clock to read it. Escaped: it is the GM's own typed prose, and this card
    // is HTML.
    let described = "";
    try {
        const { roomDescription } = await import("./vault.mjs");
        const text = to ? roomDescription(to) : "";
        if (text) described = `<p class="drpg-room-prose">${foundry.utils.escapeHTML(text)}</p>`;
    } catch (err) {
        // A description is a courtesy; the move itself has already been paid
        // for and must be reported either way.
        debug(`Could not read the description of "${to}": ${err?.message ?? err}`);
    }

    // The room goes in the header's own slot rather than only inside `where`'s
    // sentence: the header is the line somebody skims a whole time of day by,
    // and "MOVE — Dinner Hall" answers the question the log is being read for.
    await whisperToOwner(actor, `${cardHead({
        action: game.i18n.localize("DRPG.Move.title"), room: to
    })}<p>${where}<br>${price}</p>${described}`);
    debug(`${actor.name}: ${from ?? "—"} -> ${to ?? "—"} (${cost})`);
    return true;
}

/**
 * Put a token back where it came from.
 *
 * Called from inside the `updateToken` hook, so the write is deferred a tick —
 * updating a document while its own update hook is still running is what made
 * the earlier attempt silently do nothing. The move is also marked so our own
 * hook ignores it and does not charge for the way back.
 */
async function sendBack(tokenDoc, previous, room) {
    if (!tokenDoc || !previous) return;

    const apply = async () => {
        try {
            await tokenDoc.update(
                { x: previous.x, y: previous.y },
                { animate: false, [REVERT]: true }
            );
        } catch {
            // A player may not own the token; ask the GM to do it.
            const { requestSendBack } = await import("./gm-bridge.mjs");
            requestSendBack(tokenDoc.parent?.id, tokenDoc.id, previous);
        }
        lastRoom.set(tokenDoc.id, room);
        lastPosition.set(tokenDoc.id, previous);
    };

    setTimeout(apply, 0);
}

/** Marks an update as our own revert, so it is not charged for. */
export const REVERT = "drpgRevert";

/* ==========================================================================
 * ROOMS
 * ========================================================================== */

/**
 * Name of the Scene Region a token document is inside, if any.
 *
 * `token.regions` is maintained by Foundry as tokens move, but it is not always
 * populated: a token placed by script, one on a scene the client has not fully
 * initialised, or one whose region membership has not been recomputed yet all
 * arrive with an empty set. Falling back to a geometric test means "which room
 * am I in" answers correctly regardless — which is what Listen, Search and the
 * project rules all depend on.
 */
export function roomOfToken(tokenDoc) {
    const regions = tokenDoc?.regions;

    if (regions?.size) {
        const names = Array.from(regions)
            .map(r => (typeof r === "string" ? tokenDoc.parent?.regions?.get(r) : r))
            .filter(Boolean)
            .map(r => r.name)
            .filter(Boolean)
            .sort();
        if (names.length) return names[0];
    }

    // Nothing recorded — measure it.
    if (tokenDoc && Number.isFinite(tokenDoc.x) && Number.isFinite(tokenDoc.y)) {
        return roomAt(tokenDoc.x, tokenDoc.y, tokenDoc);
    }
    return null;
}

/**
 * Room a character is currently standing in.
 *
 * `getActiveTokens()` only finds tokens linked to the actor. An unlinked token —
 * which is what dragging an actor onto a scene produces unless the prototype
 * says otherwise — is not in that list, so Listen kept reporting that the player
 * was in no room at all. The canvas is searched as well, by actor id.
 */
export function roomOfActor(actor) {
    if (!actor) return null;

    const linked = actor.getActiveTokens?.() ?? [];
    for (const token of linked) {
        const room = roomOfToken(token.document ?? token);
        if (room) return room;
    }

    const placed = (canvas?.tokens?.placeables ?? []).filter(t => t.actor?.id === actor.id);
    for (const token of placed) {
        const room = roomOfToken(token.document);
        if (room) return room;
    }

    return null;
}

/**
 * Where a character is, without asking the canvas.
 *
 * `roomOfActor` answers "which room" for the client that is looking at the map,
 * and both of its lookups — `getActiveTokens()` and `canvas.tokens.placeables` —
 * only see the scene currently rendered. That is fine for a player acting on
 * their own screen, and wrong for the GM's client resolving somebody else's
 * action while looking at a different scene: the character reads as standing
 * nowhere at all.
 *
 * This walks the scene documents instead, so the answer does not depend on what
 * anybody happens to be looking at. Used by Observe, which is scored on the GM's
 * client — see observe.mjs.
 *
 * @returns {{tokenDoc: TokenDocument, scene: Scene, room: string|null}|null}
 */
export function locateActor(actor) {
    if (!actor) return null;

    // The rendered token first when there is one: it is the freshest position,
    // and it is the common case for a player acting on their own screen.
    const active = actor.getActiveTokens?.()?.[0]?.document;
    if (active?.parent) {
        return { tokenDoc: active, scene: active.parent, room: roomOfToken(active) };
    }

    const scenes = canvas?.scene ? [canvas.scene, ...game.scenes] : Array.from(game.scenes);
    for (const scene of scenes) {
        const tokenDoc = scene?.tokens?.find(t => t.actorId === actor.id);
        if (tokenDoc) return { tokenDoc, scene, room: roomOfToken(tokenDoc) };
    }
    return null;
}

/**
 * Are these two standing in the same room, on the same scene?
 *
 * `othersInRoom` answers the same question from the canvas, which is right for
 * the player building a list of who is next to them. This is the version the GM
 * uses to CHECK that claim before acting on it: a socket payload is a claim,
 * not a fact, and the GM's canvas is very often somewhere else entirely.
 *
 * Same scene is part of it. Two rooms called "Kitchen" on two different maps
 * are not one room, and comparing names alone would let a handover reach across
 * the whole world.
 */
export function sameRoom(a, b) {
    const here = locateActor(a);
    const there = locateActor(b);
    if (!here?.room || !there?.room) return false;
    if (here.scene?.id !== there.scene?.id) return false;
    return here.room === there.room;
}

/**
 * Does this token count as a person standing in a room?
 *
 * One predicate, because there are two callers and they must not drift apart.
 * `othersInRoom` asks it to answer "is somebody watching me"; `occupantsOf`
 * asks it to answer "who is in there" for Listen. They used to disagree —
 * `occupantsOf` filtered only hidden tokens — so a critical Listen named the
 * corpse in the next room (a free answer to "where is the body") and the
 * Monokuma who happened to be walking through it.
 *
 * Three exclusions, each for its own reason:
 *
 *   Monokuma  the GM standing on the map, not a witness who could testify.
 *             Counting one made a murder impossible to open in any room a GM
 *             was passing through.
 *   the dead  still on the map — a body is usually what everyone is looking at
 *             — but not people in the room any more. They cannot witness a
 *             murder, cannot be handed anything, and must not make the room
 *             where they died unusable for the next one.
 *   hidden    a token the GM has hidden is not in the scene as far as the
 *             fiction is concerned.
 */
function countsAsPresent(token) {
    const actor = token?.actor;
    if (!actor || actor.type !== "character") return false;
    if (actor.getFlag(MODULE_ID, FLAGS.monokuma)) return false;
    if (actor.getFlag(MODULE_ID, FLAGS.deceased)) return false;
    return !token.document.hidden;
}

/** Every *student* sharing a room with this one. See `countsAsPresent`. */
export function othersInRoom(actor) {
    const room = roomOfActor(actor);
    if (!room) return [];

    return (canvas?.tokens?.placeables ?? [])
        .filter(t => t.actor?.id !== actor.id)
        .filter(countsAsPresent)
        .filter(t => roomOfToken(t.document) === room)
        .map(t => t.actor);
}

/**
 * Every room region on a scene. Defaults to the one being looked at.
 *
 * The argument exists for the callers that are NOT about the current view — the
 * voice eavesdrop dialog above all, where a GM reviewing the trial room would
 * otherwise be offered the trial room's regions and end up listening to a
 * LiveKit room nobody is standing in.
 *
 * @param {Scene|null} [scene]
 */
export function allRooms(scene = null) {
    return Array.from((scene ?? canvas?.scene)?.regions ?? [])
        .map(r => r.name)
        .filter(Boolean)
        .sort();
}

/**
 * Rooms adjacent to this one.
 *
 * Foundry has no notion of rooms being connected, so adjacency is measured
 * geometrically: regions whose bounding boxes are within one grid square of
 * each other count as neighbours. That matches how a map is usually drawn — a
 * shared wall — without asking the GM to maintain a separate connection list.
 *
 * The GM can override it per region with a `drpgNeighbours` flag holding a
 * comma-separated list of room names, for rooms that touch but have no door,
 * or doors between rooms that do not touch.
 */
export function neighbouringRooms(room) {
    const scene = canvas?.scene;
    if (!room || !scene) return [];

    const regions = Array.from(scene.regions).filter(r => r.name);
    const self = regions.find(r => r.name === room);
    if (!self) return [];

    // Explicit list wins, when the GM has set one.
    const declared = self.getFlag?.(MODULE_ID, "drpgNeighbours");
    if (typeof declared === "string" && declared.trim()) {
        const names = declared.split(",").map(s => s.trim()).filter(Boolean);
        return names.filter(n => regions.some(r => r.name === n)).sort();
    }

    // Tolerance for the thickness of a shared wall, and no more. A larger
    // margin bridges rooms that merely lie near each other — at 1.5 squares it
    // treated a room two doors away as adjacent.
    const others = regions.filter(r => r.name !== room);
    const pad = (canvas?.grid?.size ?? 100) * 0.35;
    const mine = boundsOf(self);

    // No usable geometry — an unrendered scene, an exotic shape, a region drawn
    // in a way we cannot measure. Treat every other room as reachable rather
    // than telling the player there is nowhere to go: being too permissive is a
    // GM ruling away, being too strict is a dead end.
    if (!mine) {
        debug(`No bounds for "${room}"; treating all rooms as neighbours.`);
        return others.map(r => r.name).sort();
    }

    // Split by whether each candidate's own geometry could be measured at all.
    // A room we cannot measure is treated as reachable — same reasoning as
    // above, we cannot rule it out — but a room we COULD measure and which
    // genuinely does not overlap stays excluded.
    //
    // The two used to be conflated: if not one single measured neighbour
    // overlapped, the whole room list was handed back, including every
    // properly-measured room that was correctly found not to be adjacent. On a
    // map with even one region the module could not read the geometry of —
    // anywhere on the scene, not necessarily near this room — every crossing
    // everywhere silently stopped being checked at all, since both the Eclipse
    // and ordinary movement route through this same list.
    const unmeasured = others.filter(r => !boundsOf(r));
    if (unmeasured.length) {
        debug(`${unmeasured.length} region(s) near "${room}" have no measurable bounds; treating as reachable.`);
    }

    const near = others.filter(r => {
        const other = boundsOf(r);
        return other && overlaps(mine, other, pad);
    });

    // Disjoint by construction — `boundsOf(r)` cannot be both truthy and falsy
    // for the same region — so a plain concat is enough.
    return [...near, ...unmeasured].map(r => r.name).sort();
}

/**
 * Bounding box of a region, from whichever source has one.
 *
 * Region geometry lives in different places depending on whether the scene is
 * rendered, so each is tried in turn before giving up.
 */
function boundsOf(region) {
    // The rendered placeable knows best.
    const b = region?.object?.bounds ?? region?.bounds;
    if (b && Number.isFinite(b.x) && Number.isFinite(b.width)) {
        return { x: b.x, y: b.y, w: b.width, h: b.height };
    }

    // Foundry also exposes a computed polygon set on the document.
    const polys = region?.polygons ?? region?.object?.polygons;
    if (polys?.length) {
        const box = fromPoints(polys.flatMap(p => p.points ?? p ?? []));
        if (box) return box;
    }

    // Finally the raw shape data.
    const shapes = region?.shapes ?? [];
    if (!shapes.length) return null;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const grow = (x, y) => {
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    };

    for (const shape of shapes) {
        const pts = shape.points ?? [];
        for (let i = 0; i < pts.length; i += 2) grow(pts[i], pts[i + 1]);

        // Rectangle.
        if (Number.isFinite(shape.x) && Number.isFinite(shape.width)) {
            grow(shape.x, shape.y);
            grow(shape.x + shape.width, shape.y + shape.height);
        }
        // Ellipse / circle.
        if (Number.isFinite(shape.radiusX)) {
            grow(shape.x - shape.radiusX, shape.y - shape.radiusY);
            grow(shape.x + shape.radiusX, shape.y + shape.radiusY);
        } else if (Number.isFinite(shape.radius)) {
            grow(shape.x - shape.radius, shape.y - shape.radius);
            grow(shape.x + shape.radius, shape.y + shape.radius);
        }
    }

    if (!Number.isFinite(minX)) return null;
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function fromPoints(flat) {
    if (!flat?.length) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < flat.length; i += 2) {
        const x = flat[i], y = flat[i + 1];
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    return Number.isFinite(minX) ? { x: minX, y: minY, w: maxX - minX, h: maxY - minY } : null;
}

function overlaps(a, b, pad) {
    return !(a.x - pad > b.x + b.w || b.x - pad > a.x + a.w ||
             a.y - pad > b.y + b.h || b.y - pad > a.y + a.h);
}

/**
 * Characters standing in a named room, excluding one actor.
 *
 * This is what Listen reports, so it answers to exactly the same rule as
 * `othersInRoom` — see `countsAsPresent`. Listening at a wall does not tell you
 * about a body or about Monokuma.
 */
export function occupantsOf(room, exclude = null) {
    if (!room) return [];
    return (canvas?.tokens?.placeables ?? [])
        .filter(t => !exclude || t.actor?.id !== exclude.id)
        .filter(countsAsPresent)
        .filter(t => roomOfToken(t.document) === room)
        .map(t => t.actor);
}
