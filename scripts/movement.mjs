/**
 * Danganronpa RPG - movement between rooms.
 * ---------------------------------------------------------------------------
 * Guide: "The player gets one free move per time of day. Each further one
 * spends an action. A move takes the player to a room directly connected to
 * the one they are in."
 *
 * Moving *within* a room is not a move at all - repositioning next to someone
 * to talk costs nothing. What costs is crossing from one room into another, so
 * the charge is applied when a token's Scene Region changes, not when it is
 * dragged. Players simply drag their token; the economy follows.
 *
 * Rooms are Scene Regions. A scene with no regions charges nothing, which keeps
 * a half-built map from eating everyone's actions.
 */

import { MODULE_ID, ECLIPSE_MOVES, ECLIPSE_FREE_PLACEMENT, FLAGS,
    ROOM_OWNER_FLAG, BEDROOM_KEY_FLAG } from "./config.mjs";
import {
    SETTINGS, iAmTheMastermind, incidentParticipants, incomingTimeOfDay, discoveryLedger, eclipseMovesUsed, isDeadForGm
} from "./settings.mjs";
import { hasFreeMove, takeMove, actionsLeft, canPayFor, freeMovesLeft } from "./actions.mjs";
// Statically imported, not lazily: the crossing veto runs inside a synchronous
// `preUpdateToken` hook, where there is no opportunity to await an import.
// call-effects.mjs only reaches back into this file lazily, so there is no cycle.
import { isSealed, isChained } from "./call-effects.mjs";
// The darkening's own reader, and a leaf - see the note in `canCross`. Static
// for the same reason as the two above: the crossing veto cannot await.
import { overflowCrossings } from "./overflow.mjs";
// `iAmTheMastermind` comes from settings.mjs - a leaf - for the same reason:
// the veto is synchronous, so it has to be a static import. It used to come
// from mastermind.mjs, and that one edge was what closed every static import
// cycle in the module; see the note above the function.
// `neighbouringRooms` and `boundsOf` are defined further down this file.
import { whisperToOwner, whisperToGms, isPrimaryGm, log, debug, error, esc, cardHead, plural } from "./utils.mjs";
import { ROOM_FLAG, isRoomWith, playerRegionIds, roomPieces, roomRegions, roomFlag, roomNames, isPlaceScene, homeScene } from "./rooms.mjs";
import { playSfx } from "./sfx.mjs";

/**
 * Region flags this file owns. Named like `VAULT_FLAGS`/`REST_FLAGS` in
 * vault.mjs, which reads this one to draw Room Setup's own "Locked" column -
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
     * to - which is the kind of split that surfaces two months later.
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
    // move - nothing to undo, nothing to get out of step.
    Hooks.on("preUpdateToken", onPreUpdateToken);
    Hooks.on("updateToken", onUpdateToken);
    Hooks.on("canvasReady", primeRoomCache);
    Hooks.on("preCreateToken", onPreCreateToken);
    Hooks.on("updateToken", noteGmPosition);
    Hooks.on("createToken", token => gmSeen.set(token.id, positionOf(token)));
    Hooks.once("ready", primeGmPositions);
    // Who may make a room (E12 C1; the note below). Inline, each one line, so the census of
    // what reaches a rule names them where they are registered.
    Hooks.on("createRegion", (region, options, userId) => noteRegionCreated(region, userId));
    Hooks.on("updateRegion", (region, changes, options, userId) => judgeRoomFlagChange(region, changes, userId));
    Hooks.once("ready", primeRoomFlags);
}

/* ==========================================================================
 * WHO MAY MAKE A ROOM (E12 C1, 11.10.2026; plan-E12 3.1, audit S07-06)
 * --------------------------------------------------------------------------
 * A room is a region a GM marked (rooms.mjs). Two roads could make one without
 * a GM: a region a player draws, and a player's write to the mark itself.
 * Whether Foundry v14 lets a player create or update a Region outside
 * Daggerheart's relay has not been read off a live table (LIVE-E12-04), so
 * both are answered here, on the primary GM, from the user id Foundry hands
 * the document hook - Foundry's, not a packet's claim.
 *
 * A REGION A PLAYER DREW is recorded in `SETTINGS.playerRegions`, and
 * rooms.mjs `canBeRoom` refuses it whatever its flag says. Nothing is put
 * back: the region stays for whatever its author drew it for. An unknown
 * user id (a user deleted since) is not judged.
 *
 * A PLAYER'S CHANGE TO THE MARK is put back to what a GM last left, and the
 * GMs are told. "Last left" is remembered (`roomFlagSeen`), not read off the
 * change: an update hook carries the new value only, and a write made with
 * `diff: false` repeats the old one, so a flip read off the change could be
 * steered. Every GM primes the memory at ready and keeps it on a GM's create
 * and update; the primary writes the old value back, and that write, a GM's,
 * is what moves every GM's memory. A change that names the mark and leaves it
 * as it was is told and needs nothing put back.
 * ========================================================================== */

/** regionId -> the room flag as a GM last left it (`null` never decided), on every GM. */
const roomFlagSeen = new Map();
/** Regions this client saw a player create, before the setting that records them comes back. */
const drawnByPlayer = new Set();
/** The primary's writes of `SETTINGS.playerRegions`, one after another, so two creates keep both ids. */
let playerRegionWrites = Promise.resolve();

const roomFlagOf = region => region.getFlag(MODULE_ID, ROOM_FLAG) ?? null;

function primeRoomFlags() {
    if (!game.user?.isGM) return;
    for (const scene of game.scenes ?? []) {
        for (const region of scene.regions ?? []) roomFlagSeen.set(region.id, roomFlagOf(region));
    }
}

/** A Region was created: a GM's is remembered as it is; a player's is recorded as never a room. */
export function noteRegionCreated(region, userId) {
    if (!game.user?.isGM) return null;
    const author = game.users?.get(userId) ?? null;
    if (!author || author.isGM) {
        roomFlagSeen.set(region.id, roomFlagOf(region));
        return null;
    }
    drawnByPlayer.add(region.id);
    if (!isPrimaryGm()) return null;
    playerRegionWrites = playerRegionWrites
        .then(() => recordPlayerRegion(region, author))
        .catch(err => error(`Could not record the region "${region.name}" as a player's`, err));
    return playerRegionWrites;
}

async function recordPlayerRegion(region, author) {
    if (!isPrimaryGm()) return;
    const ids = game.settings.get(MODULE_ID, SETTINGS.playerRegions) ?? [];
    if (ids.includes(region.id)) return;
    await game.settings.set(MODULE_ID, SETTINGS.playerRegions, [...ids, region.id]);
    log(`The region "${region.name}" (${region.id}) on "${region.parent?.name}" was created by ${author.name}, who is no GM: it is never a room.`);
}

/** Whether a Region update's changes name the room flag (set or deleted). */
function namesRoomFlag(changes) {
    const ours = Object.entries(changes?.flags ?? {}).filter(([key]) => key.replace(/^-=/, "") === MODULE_ID);
    return ours.some(([key, value]) => key.startsWith("-=") || value === null
        || Object.keys(value ?? {}).some(flag => flag.replace(/^-=/, "") === ROOM_FLAG));
}

/**
 * A Region was updated. A GM's update moves this client's memory of the mark; a player's that
 * leaves the mark other than remembered, or names it at all, goes to `keepRoomFlag`.
 */
export function judgeRoomFlagChange(region, changes, userId) {
    if (!game.user?.isGM) return null;
    const author = game.users?.get(userId) ?? null;
    const now = roomFlagOf(region);
    if (!author || author.isGM) {
        roomFlagSeen.set(region.id, now);
        return null;
    }
    if (!changes?.flags || drawnByPlayer.has(region.id)) return null;
    const was = roomFlagSeen.has(region.id) ? roomFlagSeen.get(region.id) : null;
    if (now === was && !namesRoomFlag(changes)) return null;
    return keepRoomFlag(region, was, now !== was, author);
}

/** On the primary: put the mark back to `was` when it moved, log it, tell the GMs. */
async function keepRoomFlag(region, was, moved, author) {
    if (!isPrimaryGm()) return null;
    try {
        if (moved) {
            if (was === null) await region.unsetFlag(MODULE_ID, ROOM_FLAG);
            else await region.setFlag(MODULE_ID, ROOM_FLAG, was);
        }
        log(`${author.name} changed whether "${region.name}" on "${region.parent?.name}" is a room; ${moved ? "put back" : "nothing moved"}.`);
        await whisperToGms(`<p class="drpg-warning">${esc(game.i18n.format("DRPG.Rooms.flagKept", {
            user: author.name, region: region.name, scene: region.parent?.name ?? ""
        }))}</p>`);
        return { moved };
    } catch (err) {
        error(`Could not put back the room mark of "${region.name}"`, err);
        return null;
    }
}

/* ==========================================================================
 * WHERE A TOKEN HAS BEEN, AS THE PRIMARY GM SAW IT (E03, 24.09.2026)
 * --------------------------------------------------------------------------
 * A player whose client cannot put its own token back asks the GM to
 * (`requestSendBack`), and the GM wrote whatever position the packet named,
 * with the flag that tells this file not to charge for the move. That is a
 * free teleport anywhere on the map, from the console (audit S10-40). The only
 * honest "back" is somewhere the token actually stood a moment ago, so the
 * primary GM remembers the last few places each token was moved FROM, and the
 * bridge sends a token only there (`sendBackRefusal`).
 *
 * Every update is recorded, intermediate steps of a drag included: v14 moves a
 * token as a series of updates, and which of them carry the pending route on a
 * client that did not drag it has not been measured. So the ring is long enough
 * for a route with several waypoints, and the window is a minute.
 * ========================================================================== */

/** tokenId -> where it stands now, as last seen here. */
const gmSeen = new Map();
/** tokenId -> the places it was moved from, newest last. */
const gmHistory = new Map();
const GM_HISTORY_KEPT = 8;

function positionOf(tokenDoc) {
    return {
        x: tokenDoc.x, y: tokenDoc.y,
        elevation: tokenDoc.elevation ?? 0,
        // The v14 name of a token's level has not been read off a live table;
        // whatever it is called, it is recorded as undefined here until then,
        // and a send-back that names one is refused rather than guessed at.
        level: tokenDoc.level ?? undefined
    };
}

function primeGmPositions() {
    if (!isPrimaryGm()) return;
    for (const scene of game.scenes ?? []) {
        for (const token of scene.tokens ?? []) gmSeen.set(token.id, positionOf(token));
    }
}

function noteGmPosition(tokenDoc, changes) {
    if (!isPrimaryGm()) return;
    if (changes?.x === undefined && changes?.y === undefined
        && changes?.elevation === undefined && changes?.level === undefined) return;
    const was = gmSeen.get(tokenDoc.id);
    if (was) {
        const ring = [...(gmHistory.get(tokenDoc.id) ?? []), { ...was, at: Date.now() }];
        gmHistory.set(tokenDoc.id, ring.slice(-GM_HISTORY_KEPT));
    }
    gmSeen.set(tokenDoc.id, positionOf(tokenDoc));
}

/** The places this token was moved from lately, as the primary GM saw them. */
export function recentPositions(tokenId) {
    return [...(gmHistory.get(tokenId) ?? [])];
}

/**
 * The rooms this token stood in during the last minute, as the primary GM saw
 * it, the one it stands in now included. A route through three rooms reports
 * a crossing into the middle one after the token has already left it; this is
 * how the GM can still say the token was there (traps.mjs).
 */
export function roomsVisited(tokenDoc, { now = Date.now(), windowMs = 60_000 } = {}) {
    const rooms = new Set();
    if (!tokenDoc) return rooms;
    const here = roomOfToken(tokenDoc);
    if (here) rooms.add(here);
    for (const spot of recentPositions(tokenDoc.id)) {
        if (now - spot.at > windowMs) continue;
        const room = roomAt(spot.x, spot.y, tokenDoc);
        if (room) rooms.add(room);
    }
    return rooms;
}

/**
 * Why a token may not be sent to this position, or null. Pure, for the suite.
 *
 * @param {object} position   What the packet asks for.
 * @param {object} options
 * @param {object} [options.scene]    For its size.
 * @param {object[]} options.history  `recentPositions` for the token.
 * @param {object[]} [options.centres]  The spot `positionIn` gives for each room
 *   the token stood in during the window (`roomsVisited`). A route through
 *   several rooms that fails at the second crossing sends the token to the room
 *   it paid for (MAP-11), and that spot is a room's centre, which the token
 *   never stood on - the E03 review found the honest request refused.
 * @param {number} [options.now]
 * @param {number} [options.windowMs]
 * @returns {string|null}
 */
export function sendBackRefusal(position, { scene = null, history = [], centres = [], now = Date.now(), windowMs = 60_000 } = {}) {
    const x = Number(position?.x);
    const y = Number(position?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return "the position is not a place on the map";
    const width = Number(scene?.dimensions?.width);
    const height = Number(scene?.dimensions?.height);
    if (Number.isFinite(width) && Number.isFinite(height) && (x < 0 || y < 0 || x > width || y > height)) {
        return "the position is off the scene";
    }
    if (position.elevation !== undefined && !Number.isFinite(Number(position.elevation))) {
        return "the elevation is not a number";
    }
    const matches = history.some(h => now - h.at <= windowMs && h.x === x && h.y === y
        && (position.elevation === undefined || h.elevation === Number(position.elevation))
        && (position.level === undefined || h.level === position.level));
    const centre = position.elevation === undefined && position.level === undefined
        && centres.some(c => c && c.x === x && c.y === y);
    return matches || centre ? null : "the token did not stand there a moment ago";
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
        // ruins a crime scene - the body is evidence, and where it is lying is
        // most of what it says.
        //
        // The GM is above this line on purpose. Moving the body is a legitimate
        // GM act (Stage 6 has the killer doing it, through the clean-up action
        // that a GM resolves), and the dead have no say in where they are put.
        //
        // A Monocub is exempt because a Monocub is not a corpse: it is a dead
        // student who joined the GM side and is walking around as one. They
        // carry `deceased` for the rules that count the living, and `monocub`
        // for everything about being a person on the map - the same pair the
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

        const allowed = canCross(actor, from, to, tokenDoc.parent);
        if (allowed === true) return;

        ui.notifications.warn(allowed);
        return false;                                  // the move does not happen
    } catch {
        // Never block a move because our own check failed.
    }
}

/**
 * Dead, and not a Monocub - so this token is a body rather than a person.
 *
 * Death is asked of settings.mjs (E05 C9) and the Monocub flag read directly
 * rather than through `monocub.mjs`: this runs inside the synchronous
 * `preUpdateToken` veto, where there is no chance to await an import. On the
 * mover's own browser, so it asks what that browser may know (rule C).
 */
function isCorpse(actor) {
    try {
        if (!isDeadForGm(actor)) return false;
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
 * switched it off - its hint says "turn off to handle movement by hand", which
 * plainly means the COST - also silently switched off three rules that have
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
 * them - the free Move, then an action - answers to that setting, along with
 * ordinary-play adjacency, which is the same "handled by hand" bargain.
 *
 * @returns {true|string} true, or the reason it is refused.
 */
function canCross(actor, from, to, scene) {
    // Monokumas are not bound by any of this.
    if (actor.getFlag(MODULE_ID, FLAGS.monokuma)) return true;

    // You are in a murder. You do not walk out of it.
    //
    // The incident is a turn-based exchange in one room, and the only ways out
    // of it are the ones the guide writes as crisis actions - Survive, Escape
    // together, a Finishing blow. Dragging the token across the map is not one
    // of them, and doing it left the engine running an incident between two
    // people standing in different rooms.
    const inIncident = lockedInIncident(actor);
    if (inIncident) return inIncident;

    // Despair Calls that physically stop you. Checked before the action economy
    // because they are absolute: no amount of actions buys past a locked door.
    const blocked = restrictedFrom(actor, to, scene);
    if (blocked) return blocked;

    const clock = game.settings.get(MODULE_ID, SETTINGS.clock);

    /*
     * NOBODY LEAVES THE COURTROOM (T-1, Dawid 17.09).
     *
     * Above the free-placement branch, above the Eclipse allowance and a long way
     * above `SETTINGS.chargeMovement`, because this is absolute: a GM who turned
     * the movement cost off did not turn off the trial. The Monokuma early-out at
     * the top of this function still wins, which is right - they are the ones
     * running it.
     */
    if (clock?.phase === "classTrial") return game.i18n.localize("DRPG.Trial.moveLocked");

    const eclipse = clock?.eclipse === true;

    // A Morning or Night Eclipse places freely: any room, no budget, no
    // adjacency. `incomingTimeOfDay` comes from settings.mjs rather than
    // eclipse.mjs, which imports this file - the same reason the eclipse flag
    // above is read straight off the setting.
    const freePlacement = ECLIPSE_FREE_PLACEMENT.includes(incomingTimeOfDay(clock));

    /*
     * THE DARKENING IS PART OF THE NUMBER, and this gate used to read the bare
     * constant (audit A2).
     *
     * `eclipseAllowance()` in eclipse.mjs is the one place the allowance is
     * decided, and it has asked the overflow since Z10 - so under Darkness a
     * two-crossing Eclipse is worth one, and a free-placement Eclipse becomes
     * an ordinary two-room one (`freeBecomes`). This file cannot call that
     * function: eclipse.mjs imports this one, and the veto is synchronous, so
     * there is no await to hide the cycle behind. What it CAN do is ask the
     * same question of the same source - `overflowCrossings` is a leaf, and
     * actions.mjs already imports it for exactly this reason.
     *
     * `null` still means unlimited, so free placement is read off the ALLOWANCE
     * rather than off the calendar. That is what makes the darkened
     * free-placement Eclipse enforce anything at all: before this, both this
     * gate and `judgeEclipseCrossing` skipped every check whenever the clock
     * said Morning or Night, and `freeBecomes` was a number nothing read.
     */
    const allowance = overflowCrossings(freePlacement ? null : ECLIPSE_MOVES);

    if (eclipse) {
        // A free-placement Eclipse skips both limits but must STILL return here.
        // Falling through would drop the crossing into the movement economy
        // below and charge it a free Move or an action - and an Eclipse crossing
        // has never cost either.
        if (allowance !== null) {
            // The GMs' count on a GM's browser, the owner's copy of it on theirs (E05; the
            // settings.mjs leaf, for the cycle above). A stale copy can only let a crossing
            // through that the GM's count then refuses and sends back (eclipse.mjs).
            const used = eclipseMovesUsed(actor.id, clock);
            if (used >= allowance) return game.i18n.localize("DRPG.Eclipse.noMovesLeft");

            if (from && to) {
                const connected = neighbouringRooms(scene, from);
                if (connected.length && !connected.includes(to)) {
                    return notConnectedText(from, to, connected);
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
    // time of day a token could be dragged clean across the map for one Move -
    // which makes Listen, room visibility and any alibi meaningless.
    const notConnected = crossingRefused(scene, from, to);
    if (notConnected) return notConnected;

    /*
     * THE THIRD PLACE THAT ASKS "CAN YOU AFFORD THIS", and the only one that
     * can stop a crossing before anything else in the module sees it - this
     * runs in `preUpdateToken` and simply refuses the update.
     *
     * MEASURED, on the player's own client, which is the only place it fires:
     * with a Sprint banked and no actions, the token snapped straight back and
     * the warning read "No free Move and no actions left." Three Hope for a
     * crossing that never happened, and neither `chargeForCrossing` nor
     * `takeMove` - both of which know about Sprints - was ever reached.
     *
     * A GM's move never comes through here at all (see the `isGM` exemption
     * above), which is exactly why this had to be tested from the other seat.
     */
    if (hasFreeMove(actor)) return true;
    if (freeMovesLeft(actor) >= 1) return true;
    if (canPayFor(actor, 1)) return true;
    return game.i18n.localize("DRPG.Move.noBudget");
}

/**
 * Is the destination reachable from where you stand?
 *
 * Silent when adjacency cannot be established - `neighbouringRooms` already
 * treats a room it cannot measure the geometry of as reachable, and a map the
 * module cannot read must not become a map nobody can walk across. Leaving the
 * rooms entirely, or arriving from outside them, is likewise not a crossing
 * this rule governs.
 *
 * @returns {false|string} false when allowed, otherwise the reason.
 */
function crossingRefused(scene, from, to) {
    if (!from || !to) return false;

    const connected = neighbouringRooms(scene, from);
    if (!connected.length || connected.includes(to)) return false;

    return notConnectedText(from, to, connected);
}

/**
 * "{to} is not connected to {from}" - and the list of where you CAN go names
 * only rooms this viewer has been in (MAP-03). The full list undid the fog's
 * whole contract: dragging at a black patch printed every neighbour of the
 * room you stand in, unvisited ones included.
 *
 * AND NOT `{to}` EITHER, when this viewer has never been there (E06 C11, audit
 * S07-19). The list was filtered and the sentence's own subject was not: a token
 * dragged onto a black patch came back with the name of the room under it, so the
 * fog could be read one refused crossing at a time. An unknown destination gets a
 * sentence that names only where you stand. Exported for the Eclipse's refusal
 * (eclipse.mjs), which is the same question, and `known` is a parameter for the
 * suite, which runs on a GM's browser, where it is `null`.
 */
export function notConnectedText(from, to, connected, known = roomsKnownToMe()) {
    if (known && !known.has(to)) return game.i18n.format("DRPG.Move.cannotReach", { from });
    const shown = known ? connected.filter(r => known.has(r)) : connected;
    return shown.length
        ? game.i18n.format("DRPG.Move.notConnected", { from, to, rooms: shown.join(", ") })
        : game.i18n.format("DRPG.Move.notConnectedShort", { from, to });
}

/**
 * The rooms this viewer's own characters have discovered on the current
 * scene, plus wherever they stand; `null` for a GM or the Mastermind, who know
 * the whole map. Read off this client's own copy of the ledger (D2: a player's
 * browser holds only their own rows), through settings.mjs, so this stays a
 * leaf and needs nothing from the fog.
 */
export function roomsKnownToMe() {
    try {
        if (game.user.isGM || iAmTheMastermind()) return null;
        const sceneId = canvas?.scene?.id;
        if (!sceneId) return null;
        const ledger = discoveryLedger();
        const known = new Set();
        for (const [actorId, rooms] of Object.entries(ledger[sceneId] ?? {})) {
            if (!game.actors.get(actorId)?.isOwner) continue;
            for (const room of rooms ?? []) known.add(room);
        }
        for (const token of canvas?.tokens?.placeables ?? []) {
            if (!token.isOwner) continue;
            const room = roomOfToken(token.document);
            if (room) known.add(room);
        }
        return known;
    } catch {
        return null;
    }
}

/**
 * Is this character pinned into a murder that is happening right now?
 *
 * Read straight off the world setting rather than through `murder.mjs`: this
 * runs inside a synchronous `preUpdateToken` veto, where there is no chance to
 * await an import. The shape is `murderState()`'s own - `active`, and the three
 * participant ids.
 *
 * THE THIRD PARTY IS INCLUDED NOW (D19, Dawid 29.08): "uczestnicy morderstwa
 * nie moga opuscic pokoju do konca incydentu chyba, ze uzyja akcji ktora na to
 * pozwala". They were exempt, on the reading that the guide's "Odwrócony wzrok"
 * - "strona trzecia opuszcza pomieszczenie i nie interweniuje" - is stopped by
 * the price of the move rather than by a wall: "koszt ruchu z dużym
 * prawdopodobieństwem mu to uniemożliwi".
 *
 * What that missed is that Averted eyes IS the action Dawid's rule points at,
 * and leaving the door open meant nobody ever had to take it. A third party
 * could walk in on a murder, see everything, and drag their token back out for
 * the price of an ordinary move - keeping the free look and skipping the action
 * whose entire content is "you leave and you take no part in this".
 *
 * So the lock is now the same for all three, and the way out is the same for
 * all three: a crisis action. `avertedEyes` carries `leavesIncident`, which
 * nulls `thirdId` - and the moment it does, this function stops holding them.
 *
 * A GM's own move is above this check entirely (`preUpdateToken` returns early
 * for a GM), so a crisis action that relocates somebody GM-side is unaffected.
 *
 * Only while the incident itself is running. Stage 4 is still the killer
 * deciding, and Stage 6 is the clean-up - the guide has the killer moving around
 * the scene for that one.
 *
 * @returns {false|string} false when free to move, otherwise the reason.
 */
function lockedInIncident(actor) {
    try {
        const state = game.settings.get(MODULE_ID, SETTINGS.murderState) ?? {};
        if (!state.active || state.stage !== "incident") return false;

        // The names are not in that setting any more (LIVE-001). This client
        // holds them only if it is a GM or one of the participants - and a
        // client that is neither has nobody here to hold still.
        if (!incidentParticipants().includes(actor.id)) return false;

        return game.i18n.localize("DRPG.Murder.cannotLeave");
    } catch {
        // A state we cannot read must not become a map nobody can walk across.
        return false;
    }
}

/**
 * Is a Despair Call - or a GM's own lock - standing in the way?
 *
 * The sealed-room checks were previously bookkeeping: "Behind Closed Doors"
 * wrote the room name into a world setting, announced it, and nothing ever
 * read it back, so a sealed room was a sentence in chat that players walked
 * straight through. `drpgLocked` is the same category of rule from a
 * different source - a GM's own Room Setup, not a Despair Call - and gets the
 * same absolute treatment: no number of actions buys past a locked door.
 *
 * The Mastermind is the one exception, and only for THIS category - doors
 * their own side locked, and Despair Call seals, are doors they hold the key
 * to. `isChained` is untouched: that Despair Call targets a specific person,
 * not a door, and it stays absolute for everyone it is cast on.
 *
 * @returns {false|string} false when the move is allowed, otherwise the reason.
 */
function restrictedFrom(actor, to, scene) {
    try {
        if (isChained(actor)) return game.i18n.localize("DRPG.Calls.chainedBlocked");
        if (to && !iAmTheMastermind()) {
            if (isLocked(scene, to)) return game.i18n.localize("DRPG.Move.locked");
            if (isSealed(to)) return game.i18n.format("DRPG.Calls.sealedBlocked", { room: to });
            // Somebody's bedroom. The owner walks in; anybody else needs the
            // key they were given - see the note on keys in vault.mjs. A GM
            // moving a token is not standing in the fiction and is never
            // stopped by a door.
            if (!game.user.isGM && bedroomShut(actor, scene, to)) {
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
 * Read off the room on the scene of the token being moved, which the veto hands
 * in (`tokenDoc.parent`), and over EVERY piece of it (E12 C2a, audit S07-05,
 * S08-17). Until 1.2.74 this took the camera's scene and the FIRST region of the
 * name, while Room Setup wrote the lock through `regionsByName`, whose map kept
 * the LAST: a Kitchen drawn in two pieces and locked from Room Setup carried the
 * lock on its second piece, and a walk into the first was let through (scenario
 * 66 D1 and D2 read it so, 11.10.2026). Room Setup now writes every piece and this reads
 * the room as one (`roomFlag`, rooms.mjs: the first piece that carries the flag
 * answers), so a lock left on one piece by the old writer still holds. Exported
 * for tier 2's "two pieces are one room", which asks it about a scene of its own.
 */
export function isLocked(scene, room) {
    if (!room) return false;
    return Boolean(roomFlag(scene, room, ROOM_FLAGS.locked));
}

/**
 * Is this somebody else's bedroom, and are they carrying no key to it?
 *
 * Read straight off the two documents rather than through vault.mjs - that file
 * already reaches into this one, and this veto runs inside a synchronous
 * `preUpdateToken` where a dynamic import is not an option. Both flag names
 * come from config.mjs so the two readers cannot drift apart.
 *
 * A room nobody owns is not a bedroom. The owner never needs a key to their own
 * door: losing it would otherwise lock them out of the one place the guide says
 * is theirs.
 */
function bedroomShut(actor, scene, to) {
    // The owner as the room's pieces carry it, on the mover's scene - as `isLocked`.
    const owner = to ? roomFlag(scene, to, ROOM_OWNER_FLAG) : null;
    if (!owner || owner === actor?.id) return false;
    return !Array.from(actor?.items ?? [])
        .some(item => item.getFlag(MODULE_ID, BEDROOM_KEY_FLAG) === to);
}

/**
 * Which room a point falls inside, using the same regions as roomOfToken.
 *
 * On the scene of the token it is asked for, and no other (E12 C2a): every
 * caller hands a token document in, and the camera's scene it fell back to
 * answered for a token on another map with the rooms of the map on screen.
 */
export function roomAt(x, y, tokenDoc) {
    const scene = tokenDoc?.parent ?? null;
    if (!scene?.regions?.size) return null;

    // Test the token's centre, not its corner - measured with THAT SCENE's grid.
    //
    // `canvas.grid.size` is the grid of the scene currently on screen, and this
    // function is asked about tokens on other scenes all the time now: the voice
    // reconciler locates every character wherever they are, Observe is scored on
    // a GM's client that is usually looking elsewhere, and Stage 6 lists the
    // traces in a room the GM may not have open. A 200px-grid scene measured
    // with a 100px canvas puts the "centre" of a 2×2 token half a square off,
    // which is enough to read as the wrong room - or none at all - right at the
    // edges where rooms actually meet.
    //
    // The hit test itself has the same cross-scene problem, twice over, and both
    // halves of it used to fail SILENTLY - which is why this whole function
    // answered "no room at all" for every token on a scene nobody was looking at,
    // and every caller that depends on it (Observe, Stage 6, voice, `sameRoom`)
    // quietly saw an empty map.
    //
    //   1. `region.object` is the rendered PLACEABLE. It exists only for the
    //      scene currently on the canvas, and `Region#testPoint` on it has been
    //      deprecated since v13 and is removed in v15 - so on the scene where it
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
    // treated as the same thing. The chain below distinguishes them explicitly -
    // the bounding box is for a region that cannot be ASKED, not for one that
    // answered no.
    const regions = regionsAt(scene, x, y, tokenDoc);
    return regions.map(r => r.name).sort()[0] ?? null;
}

/**
 * Every room piece a point falls inside - the plural version of `roomAt`,
 * and the one place the hit test is written: grid size, elevation, the
 * `testPoint` fallback chain. `roomAt` takes the alphabetically-first name off
 * it; nothing outside this file reads the list any more (the vision clip that
 * did is gone). Rooms only (rooms.mjs `roomPieces`, E12 C2a): a named region
 * that is no room - a Teleport, a level change, a player's area - is no room a
 * token stands in; until 1.2.74 any name made one.
 */
function regionsAt(scene, x, y, tokenDoc) {
    if (!scene?.regions?.size) return [];

    const size = scene.grid?.size ?? canvas?.grid?.size ?? 100;
    const cx = x + ((tokenDoc?.width ?? 1) * size) / 2;
    const cy = y + ((tokenDoc?.height ?? 1) * size) / 2;
    const elevation = Number.isFinite(tokenDoc?.elevation) ? tokenDoc.elevation : 0;

    const named = roomPieces(scene);
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
    // `testPoint` is checking this build - an elevation band, a polygon that
    // carries holes where two rooms share a wall (see the v14 canvas notes) -
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
 * Every token this module places or that a GM drops behaves the same way: no
 * rotation on movement. Applied at creation so it also covers tokens dragged
 * from the actor list.
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

/**
 * Settle a route that crossed at least one border: who pays, the Eclipse's
 * veto, the charge switch, and one charge per crossing.
 */
async function settleRoute(tokenDoc, actor, { before, previous, crossings }) {
    // Exactly one client applies the cost, or two GMs would both spend the
    // action. Prefer the player who owns the token - but only while they are
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
            const allowed = await judgeEclipseCrossing(actor, from, to, tokenDoc.parent);
            if (!allowed) {
                await sendBack(tokenDoc, previous, before);
                return;
            }
        }
        if (tokenDoc) lastPosition.set(tokenDoc.id, { x: tokenDoc.x, y: tokenDoc.y });
        return;
    }

    // The cost, and only the cost, is what the setting governs. Everything
    // above - the room cache, the Eclipse - has to keep running, or turning
    // the setting back on would find every token's remembered room stale and
    // charge for a crossing that happened while it was off.
    if (!game.settings.get(MODULE_ID, SETTINGS.chargeMovement)) {
        if (tokenDoc) lastPosition.set(tokenDoc.id, { x: tokenDoc.x, y: tokenDoc.y });
        return;
    }

    // One at a time, in the order they were crossed. The first one that
    // cannot be paid for stops the route and puts the token back where the
    // drag began - the moves already paid for stay paid, because they were
    // made: the refusal is about the step that could not be afforded, and
    // `sendBack` returns the token to the only position it is certain the
    // character could legally be standing in.
    // ...and not where the DRAG began, when that is two rooms back (MAP-11):
    // the veto judges each segment of a multi-room route against the budget
    // as it stood before any of them was charged, so a route of three rooms
    // on one free Move passes all three vetoes and fails at the second
    // crossing here. The token goes to the room that WAS paid for.
    let standing = previous;
    for (const [from, to] of crossings) {
        const paid = await chargeForCrossing(actor, from, to, tokenDoc, standing);
        if (!paid) return;
        standing = positionIn(to, tokenDoc) ?? standing;
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
        // "the primary GM pays" below - so a GM tidying the map was charged for
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

        /* ONE CHARGE PER CROSSING - AND EVERY CROSSING ALONG THE WAY.
           -------------------------------------------------------------------
           Foundry v14 delivers a move as a SERIES of updates along the token's
           path - the core says as much, deprecating `updateToken` for movement
           in favour of `moveToken` / `_onUpdateMovement` since v13. Every one of
           those intermediate updates carries new x/y, so charging on each of
           them told the player "that cost an action" two, three, four times for
           one drag. Waiting for the last update fixed that and introduced
           B-F2-1: the settlement then compared only the ENDS of the operation,
           so a route out through a neighbour and back again cost nothing at all
           - a free look into the next room - and a two-room route cost one Move
           instead of two.

           Both are answered by remembering the rooms the token passes through
           and settling the whole path at the end: still one settlement per
           drag, but the price is what the route actually cost. The veto in
           `onPreUpdateToken` already works per segment (it is not gated here),
           so adjacency and locks were never fooled by a multi-waypoint route -
           only the price was. */
        if (tokenDoc.movement?.pending?.waypoints?.length) {
            notePathRoom(tokenDoc.id, roomOfToken(tokenDoc));
            return;
        }

        // Taken - not read - so every `return` below leaves nothing behind for
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

        // Nothing crossed - a move inside one room, or a scene with no regions
        // at all: free. Remember the new spot so a later refused crossing snaps
        // back to somewhere sensible.
        if (!crossings.length) {
            lastPosition.set(tokenDoc.id, { x: tokenDoc.x, y: tokenDoc.y });
            lastRoom.set(tokenDoc.id, after);
            return;
        }

        lastRoom.set(tokenDoc.id, after);

        await settleRoute(tokenDoc, actor, { before, previous, crossings });
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
 * answers null quite correctly - but that is the token being mid-step, not the
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
 * neighbour yields one, and a there-and-back route yields two - which is what
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

    /*
     * Out of budget: the crossing does not happen. Put the token back where it
     * was rather than leaving it in a room it could not afford to enter.
     *
     * A SPRINT COUNTS AS BUDGET (E13). Without this line the guard sends the
     * token back before `takeMove` is ever reached, so three Hope would buy a
     * crossing that this function refuses a moment later - the same trap as the
     * greyed-out grid, one layer down. `canPayFor` covers the Burst half, since
     * a crossing that costs an action is an action like any other.
     */
    if (!free && freeMovesLeft(actor) < 1 && !canPayFor(actor, 1)) {
        ui.notifications.warn(game.i18n.localize("DRPG.Move.noBudget"));
        // Tagged as an error popup (red border) rather than the default
        // info one - this is a refusal, the concrete case the red variant
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

    // Three prices now, and the third has to be named: a Sprint is not the
    // day's free Move and it is not an action, and a card calling it either
    // would be telling the player their budget is somewhere it is not.
    const price = cost === "free"
        ? game.i18n.localize("DRPG.Move.wasFree")
        : cost === "sprint"
            ? plural("DRPG.Move.wasSprint", { n: freeMovesLeft(actor) })
            : game.i18n.format("DRPG.Move.costAction", { left: actionsLeft(actor) });

    if (tokenDoc) lastPosition.set(tokenDoc.id, { x: tokenDoc.x, y: tokenDoc.y });

    // What the room looks like, when the GM has written it - the Description
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
    // and "MOVE - Dinner Hall" answers the question the log is being read for.
    await whisperToOwner(actor, `${cardHead({
        action: game.i18n.localize("DRPG.Move.title"), room: to
    })}<p>${where}<br>${price}</p>${described}`);
    debug(`${actor.name}: ${from ?? "-"} -> ${to ?? "-"} (${cost})`);

    /*
     * A CROSSING THAT ACTUALLY HAPPENED, announced once and only from here.
     *
     * Deliberately at the very end: every refusal above returns before this
     * line, so a listener can trust that somebody really is standing in `to`.
     * The trap watcher (traps.mjs) is the only listener today and it is the
     * reason the hook exists - two of its nine triggers are the same crossing
     * asked two different questions, which is exactly the kind of thing a hook
     * is for and a second copy of this function is not.
     */
    Hooks.callAll("drpgRoomCrossed", { actor, from, to, tokenDoc, cost });
    return true;
}

/**
 * Put a token back where it came from.
 *
 * Called from inside the `updateToken` hook, so the write is deferred a tick -
 * updating a document while its own update hook is still running is what made
 * the earlier attempt silently do nothing. The move is also marked so our own
 * hook ignores it and does not charge for the way back.
 */
async function sendBack(tokenDoc, previous, room) {
    if (!tokenDoc || !previous) return;

    // The only "error" a player makes regularly, and until now the only signal
    // was the token sliding back. Local, on the client that tried it.
    playSfx("refused");

    const apply = async () => {
        try {
            await tokenDoc.update(
                { x: previous.x, y: previous.y },
                { animate: false, [REVERT]: true }
            );
        } catch (err) {
            /*
             * A player may not own the token; ask the GM to do it.
             *
             * THE GM IS ASKED TO SAY SO INSTEAD (E17, R6). Foundry does not
             * deliver a socket packet back to the client that sent it, so a GM
             * whose own `update` threw was emitting into nothing: the token
             * stayed where it should not be, and neither the GM nor anybody
             * else was told. Rare - a GM owns every token - but the failure is
             * silent, which is the reason it is worth a branch. A player's
             * client still takes the road it always took.
             */
            if (game.user.isGM) error("Could not send a token back where it came from", err);
            else {
                const { requestSendBack } = await import("./gm-bridge.mjs");
                void requestSendBack(tokenDoc.parent?.id, tokenDoc.id, previous);
            }
        }
        lastRoom.set(tokenDoc.id, room);
        lastPosition.set(tokenDoc.id, previous);
    };

    setTimeout(apply, 0);
}

/**
 * A position inside a named room on the token's scene - its centre, less the token's own size.
 * The centre of the room's first piece (E12 C2a): a room of two pieces has no centre of its own
 * that is inside it, and the token's scene is the only one asked - never the camera's.
 */
export function positionIn(room, tokenDoc) {
    try {
        const scene = tokenDoc?.parent ?? null;
        const region = roomRegions(scene, room)[0];
        const box = region ? boundsOf(region) : null;
        if (!box) return null;
        const size = scene?.grid?.size ?? canvas?.grid?.size ?? 100;
        const w = (tokenDoc?.width ?? 1) * size;
        const h = (tokenDoc?.height ?? 1) * size;
        return { x: Math.round(box.x + box.w / 2 - w / 2), y: Math.round(box.y + box.h / 2 - h / 2) };
    } catch {
        return null;
    }
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
 * am I in" answers correctly regardless - which is what Listen, Search and the
 * project rules all depend on.
 */
export function roomOfToken(tokenDoc) {
    const regions = tokenDoc?.regions;

    if (regions?.size) {
        // Foundry's own list holds every region the token is in, a Teleport's too: rooms only (E12 C2a).
        const players = playerRegionIds();
        const names = Array.from(regions)
            .map(r => (typeof r === "string" ? tokenDoc.parent?.regions?.get(r) : r))
            .filter(r => r && isRoomWith(r, players))
            .map(r => r.name)
            .filter(Boolean)
            .sort();
        if (names.length) return names[0];
    }

    // Nothing recorded - measure it.
    if (tokenDoc && Number.isFinite(tokenDoc.x) && Number.isFinite(tokenDoc.y)) {
        return roomAt(tokenDoc.x, tokenDoc.y, tokenDoc);
    }
    return null;
}

/**
 * Room a character is currently standing in: the room of the token `locateActor` chooses.
 *
 * It asked the rendered tokens and then `canvas.tokens.placeables` until E12 C3 (11.10.2026;
 * audit S11-15), so on a GM's browser it answered for the scene that GM was looking at - "no
 * room" for everybody standing anywhere else - and every rule that runs there inherited it.
 */
export function roomOfActor(actor) {
    return locateActor(actor)?.room ?? null;
}

/**
 * Where a character is, without asking the camera.
 *
 * E12 C3 (11.10.2026; audit S11-15, plan-E12 3.2, decision D7). The candidates are the
 * character's tokens on the place scenes (rooms.mjs `isPlaceScene`: in E12 a scene that holds
 * a room; E13 takes its trial scene out of that list, where the students keep tokens all
 * season). One token answers. Of several, the first rule that names one decides:
 *   - the scene `sceneId` names. It is a hint, often a player's packet, and it only chooses
 *     among the character's own tokens: a scene they have no token on changes nothing;
 *   - the one token a GM has not hidden;
 *   - the token on `homeScene()`, then the one on the active scene, then the first in the
 *     world's order of scenes.
 * Until C3 it took the hinted scene, then the rendered token, then the scene the reader was
 * looking at, then any scene - so the GM's browser judging a theft, a murder at the lights or
 * a search answered for whichever scene that GM had on screen (scenario 66 F read Aiko in no
 * room with the GM's camera on the Annex, in Dorm A with it on Floor 1). It reads documents
 * only, so a player's browser and a GM's give the same answer for the same world.
 *
 * `level` is the token's floor as Foundry v14 stores it (`tokenDoc.level`), null where the
 * scene has none; what v14 holds there is LIVE-E12-03, and the room is not yet read per floor
 * (C9).
 *
 * @param {Actor} actor
 * @param {object} [options]
 * @param {string|null} [options.sceneId]  The scene to prefer, among the character's own.
 * @returns {{tokenDoc: TokenDocument, scene: Scene, room: string|null, level: *}|null}
 */
export function locateActor(actor, { sceneId = null } = {}) {
    if (!actor) return null;
    const places = [];
    for (const scene of game.scenes ?? []) {
        if (!isPlaceScene(scene)) continue;
        for (const tokenDoc of scene.tokens ?? []) {
            if (tokenDoc.actorId === actor.id) places.push({ tokenDoc, scene });
        }
    }
    const place = chosenPlace(places, sceneId);
    if (!place) return null;
    return { tokenDoc: place.tokenDoc, scene: place.scene, room: roomOfToken(place.tokenDoc), level: place.tokenDoc.level ?? null };
}

/** `locateActor`'s choice among several tokens, in the order its comment gives. */
function chosenPlace(places, sceneId) {
    if (places.length <= 1) return places[0] ?? null;
    const hinted = sceneId ? places.find(place => place.scene.id === sceneId) : null;
    if (hinted) return hinted;
    const shown = places.filter(place => !place.tokenDoc.hidden);
    const pool = shown.length ? shown : places;
    if (pool.length === 1) return pool[0];
    const home = homeScene(), active = game.scenes?.active ?? null;
    return pool.find(place => place.scene === home) ?? pool.find(place => place.scene === active) ?? pool[0];
}

/** Every place this character has a token, on every scene - `locateActor` for all of them. */
export function placesOf(actor) {
    if (!actor) return [];
    const places = [];
    for (const scene of game.scenes ?? []) {
        for (const tokenDoc of scene?.tokens ?? []) {
            if (tokenDoc.actorId === actor.id) places.push({ tokenDoc, scene, room: roomOfToken(tokenDoc) });
        }
    }
    return places;
}

/**
 * Are these two standing in the same room, on the same scene and floor?
 *
 * The version the GM uses to CHECK a claim before acting on it: a socket
 * payload is a claim, not a fact. Both are placed by `locateActor`, never by
 * the camera.
 *
 * Same scene is part of it. Two rooms called "Kitchen" on two different maps
 * are not one room, and comparing names alone would let a handover reach across
 * the whole world. Same floor too (plan-E12 3.2): until C9 reads a room per
 * floor, a token on the upper floor standing over a lower room's outline reads
 * as in that room, and the floor keeps the two apart. A room whose pieces span
 * two floors is one room for a crossing (C9) but not, here, for a hand reaching
 * between its floors - read in the plan, not yet measured on a v14 scene.
 */
export function sameRoom(a, b) {
    const here = locateActor(a);
    const there = locateActor(b);
    if (!here?.room || !there?.room) return false;
    if (here.scene?.id !== there.scene?.id) return false;
    if (levelKey(here.level) !== levelKey(there.level)) return false;
    return here.room === there.room;
}

/** A floor as `locateActor` hands it - an id or a Level document - as one comparable id. */
const levelKey = level => level?.id ?? level ?? null;

/**
 * Does this token count as a person standing in a room?
 *
 * One predicate, because there are two callers and they must not drift apart.
 * `othersInRoom` asks it to answer "is somebody watching me"; `occupantsOf`
 * asks it to answer "who is in there" for Listen. They used to disagree -
 * `occupantsOf` filtered only hidden tokens - so a critical Listen named the
 * corpse in the next room (a free answer to "where is the body") and the
 * Monokuma who happened to be walking through it.
 *
 * Three exclusions, each for its own reason:
 *
 *   Monokuma  the GM standing on the map, not a witness who could testify.
 *             Counting one made a murder impossible to open in any room a GM
 *             was passing through.
 *   the dead  still on the map - a body is usually what everyone is looking at
 *             - but not people in the room any more. They cannot witness a
 *             murder, cannot be handed anything, and must not make the room
 *             where they died unusable for the next one.
 *   hidden    a token the GM has hidden is not in the scene as far as the
 *             fiction is concerned.
 */
function countsAsPresent(token) {
    // A placeable (`occupantsOf`) or a token document (`othersInNamedRoom`, since E12 C3).
    const doc = token?.document ?? token;
    const actor = doc?.actor;
    if (!actor || actor.type !== "character") return false;
    if (actor.getFlag(MODULE_ID, FLAGS.monokuma)) return false;
    if (isDeadForGm(actor)) return false;
    return !doc.hidden;
}

/**
 * Every *student* sharing a room with this one, on the scene `locateActor` puts
 * them on. See `countsAsPresent`. It read the canvas's tokens until E12 C3, so a
 * GM's browser counted the people in the room on the scene it was looking at -
 * nobody, for a room on any other scene (scenario 66 F2: the lights judged a
 * murder in a room of three as one with nobody to kill).
 */
export function othersInRoom(actor) {
    const where = locateActor(actor);
    if (!where?.room) return [];
    return othersInNamedRoom(where.room, actor, where.scene);
}

/**
 * Everybody else in a NAMED room, rather than in whichever room somebody is
 * standing in.
 *
 * Split out for E21's "somebody is alone in the room" trigger, and the split is
 * the point rather than a convenience. That trigger is answered from a crossing
 * event which already says which room was entered; asking `othersInRoom(actor)`
 * would ask a second time where the actor is, and during a crossing those two
 * could disagree - written when the second answer came from the canvas
 * placeable, which had not always caught up with the moved token document. The
 * event is the more reliable witness, so the caller passes what it knows.
 *
 * Counted on a scene's token documents since E12 C3: the one handed in, else
 * the actor's (`locateActor`), else `homeScene()` - never the camera's.
 */
export function othersInNamedRoom(room, actor = null, scene = null) {
    if (!room) return [];
    // The scene handed in; else the actor's; else the school (E12 C3) - never the camera's.
    const on = scene ?? (actor ? locateActor(actor)?.scene : null) ?? homeScene();
    return Array.from(on?.tokens ?? [])
        .filter(t => !actor || t.actorId !== actor.id)
        .filter(countsAsPresent)
        .filter(t => roomOfToken(t) === room)
        .map(t => t.actor);
}

/**
 * Every room on a scene, by name, once each (rooms.mjs `roomNames`).
 *
 * The scene is the caller's to name (E12 C2a): it defaulted to the one being
 * looked at, which on a GM's browser is wherever that GM parked the camera, and
 * listed every named region - a Teleport's as well, and a room drawn in two
 * pieces twice. A window the GM works in hands in the scene on screen; a
 * player's own action hands in the scene their character stands on.
 *
 * @param {Scene|null} scene
 */
export function allRooms(scene) {
    return roomNames(scene);
}

/**
 * Rooms adjacent to this one.
 *
 * Foundry has no notion of rooms being connected, so adjacency is measured
 * geometrically: regions whose bounding boxes are within one grid square of
 * each other count as neighbours. That matches how a map is usually drawn - a
 * shared wall - without asking the GM to maintain a separate connection list.
 *
 * The GM can override it per region with a `drpgNeighbours` flag holding a
 * comma-separated list of room names, for rooms that touch but have no door,
 * or doors between rooms that do not touch.
 */
export function neighbouringRooms(scene, room) {
    if (!room || !scene) return [];

    // A ROOM OF SEVERAL PIECES IS ONE ROOM (E12 C2a, audit S07-05): its neighbours are
    // the union of its pieces' neighbours, and a neighbour is named once however many
    // of its own pieces touch. Until 1.2.74 this read the first region of the name on
    // the camera's scene, so a corridor drawn in two pieces had the neighbours of one.
    const regions = roomPieces(scene);
    const mine = regions.filter(r => r.name === room);
    if (!mine.length) return [];
    const names = list => [...new Set(list.map(r => r.name))].sort();

    // Explicit list wins, when the GM has set one - on any piece.
    const declared = mine.map(r => r.getFlag?.(MODULE_ID, "drpgNeighbours"))
        .filter(d => typeof d === "string" && d.trim());
    if (declared.length) {
        const listed = new Set(declared.flatMap(d => d.split(",").map(s => s.trim()).filter(Boolean)));
        return names(regions.filter(r => listed.has(r.name)));
    }

    // Tolerance for the thickness of a shared wall, and no more. A larger
    // margin bridges rooms that merely lie near each other - at 1.5 squares it
    // treated a room two doors away as adjacent. Measured in THIS scene's grid,
    // not the one on screen.
    const others = regions.filter(r => r.name !== room);
    const pad = (scene.grid?.size ?? 100) * 0.35;
    const boxes = mine.map(boundsOf);

    // No usable geometry - an unrendered scene, an exotic shape, a region drawn
    // in a way we cannot measure. Treat every other room as reachable rather
    // than telling the player there is nowhere to go: being too permissive is a
    // GM ruling away, being too strict is a dead end. One piece that cannot be
    // measured is enough: its doors could be anywhere.
    if (boxes.some(box => !box)) {
        debug(`No bounds for a piece of "${room}"; treating all rooms as neighbours.`);
        return names(others);
    }

    // Split by whether each candidate's own geometry could be measured at all.
    // A room we cannot measure is treated as reachable - same reasoning as
    // above, we cannot rule it out - but a room we COULD measure and which
    // genuinely does not overlap stays excluded.
    //
    // The two used to be conflated: if not one single measured neighbour
    // overlapped, the whole room list was handed back, including every
    // properly-measured room that was correctly found not to be adjacent. On a
    // map with even one region the module could not read the geometry of -
    // anywhere on the scene, not necessarily near this room - every crossing
    // everywhere silently stopped being checked at all, since both the Eclipse
    // and ordinary movement route through this same list.
    const unmeasured = others.filter(r => !boundsOf(r));
    if (unmeasured.length) {
        debug(`${unmeasured.length} region(s) near "${room}" have no measurable bounds; treating as reachable.`);
    }

    const near = others.filter(r => {
        const other = boundsOf(r);
        return other && boxes.some(box => overlaps(box, other, pad));
    });

    return names([...near, ...unmeasured]);
}

/**
 * Bounding box of a region, from whichever source has one.
 *
 * Region geometry lives in different places depending on whether the scene is
 * rendered, so each is tried in turn before giving up.
 */
export function boundsOf(region) {
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
 * `othersInRoom` - see `countsAsPresent`. Listening at a wall does not tell you
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
