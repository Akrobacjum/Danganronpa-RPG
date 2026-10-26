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
 *
 * A secret passage a character knows (E79, passages.mjs) is one more way out of
 * the room on either side of it, for that character alone: `passesThrough`,
 * `reachableFrom` and `passageOpenFor` below. `passageOpenFor` is the minimal
 * form of the doorway glow's predicate, for passages only; E51 generalises it to
 * every door and takes this one over rather than writing a second (the E79
 * plan's A10-9, R560's "one" clause).
 */

import { MODULE_ID, ECLIPSE_MOVES, ECLIPSE_FREE_PLACEMENT, FLAGS,
    ROOM_OWNER_FLAG } from "./config.mjs";
import {
    SETTINGS, iAmTheMastermind, incidentParticipants, incomingTimeOfDay, discoveryLedger, eclipseMovesUsed, isDeadForGm, isEclipse,
    isDeceased, getClock
} from "./settings.mjs";
// The key rule (E14 part 1 C2), static for the veto's sake as the imports below: a leaf of config.mjs and inventory.mjs
// that reaches neither this file nor vault.mjs (bedroom-keys.mjs's header).
import { keyRooms, bedroomShutTo } from "./bedroom-keys.mjs";
import { hasFreeMove, takeMove, giveMoveBack, actionsLeft, canPayFor, freeMovesLeft, freeActionsLeft } from "./actions.mjs";
// Statically imported, not lazily: the crossing veto runs inside a synchronous
// `preUpdateToken` hook, where there is no opportunity to await an import.
// call-effects.mjs only reaches back into this file lazily, so there is no cycle.
import { isSealed, isChained } from "./call-effects.mjs";
// The darkening's own reader, and a leaf - see the note in `crossingVerdict`. Static
// for the same reason as the two above: the crossing veto cannot await.
import { overflowCrossings } from "./overflow.mjs";
// `iAmTheMastermind` comes from settings.mjs - a leaf - for the same reason:
// the veto is synchronous, so it has to be a static import. It used to come
// from mastermind.mjs, and that one edge was what closed every static import
// cycle in the module; see the note above the function.
// `neighbouringRooms` and `boundsOf` are defined further down this file.
import { whisperToOwner, whisperToGms, isPrimaryGm, log, debug, error, esc, cardHead, plural, serialWrite } from "./utils.mjs";
import { ROOM_FLAG, playerRegionIds, roomPieces, roomRegions, roomFlag, roomNames, isPlaceScene, homeScene, placeScenes,
    isMoveChange, levelOf, onLevel, passageBehaviour, regionPatches, floorElevation } from "./rooms.mjs";
import { playSfx } from "./sfx.mjs";
// The secret passages this browser may know (E79 C3), static for the veto's sake as the imports
// above. passages.mjs is a leaf that never reads this file back (R560 holds its imports).
import { openSegmentsFor, crossingVia, tunnelEndsFor } from "./passages.mjs";
// The GMs' audit of a move through a wall (E79 C4), called from `noteGmPosition` with this file's
// readers handed in; movement-audit.mjs never imports this file statically (R161).
import { askerOf, auditMove, registerMoveAudit, RULE_CODES } from "./movement-audit.mjs";
// Who acts as the Mastermind (E79 fix r2-G2), for the witness judge: passages-gm.mjs is already in this file's static
// graph through movement-audit.mjs, so the edge adds no module and no cycle that was not there.
import { actsAsMastermind } from "./passages-gm.mjs";

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
    lockedAtStart: "drpgLockedAtStart",

    /**
     * The rooms this room has a door to, by name, comma-separated - the GM's word over the
     * map's (`neighbouringRooms`). Written from Room Setup's Neighbours column to every piece
     * of the room since E12 C14; a flag GMs typed by hand before then reads the same.
     */
    neighbours: "drpgNeighbours",

    /**
     * A room forced open (E15 part 2 C4, 25.10.2026; A10 step 15, the owner's answer of 11.10: "E74 przyjmie
     * `ROOM_FLAGS.broken`"): a Breach the Wall finished into it. `true` on every piece of the room, written by
     * `setRoomBroken` alone and read by `roomBroken` alone; while it stands the GM's lock and the bedroom's key are
     * lifted for everyone (`isLocked`, `bedroomShut`, vault.mjs `mayEnterBedroom`), never a chain, a seal set after
     * it or the courtroom. Taken off when the wall is given back (passages-gm.mjs `restoreBreach`) and by the
     * season's reset. A value with no builder, user or project in it: every browser holds the scene's regions.
     */
    broken: "drpgBroken"
};

/**
 * Has this room been forced open, on this scene (`ROOM_FLAGS.broken`)? The one reader of the flag (R981): a room
 * nobody broke, a room not drawn there and the trial hall (rooms.mjs `roomPieces` has no rooms on it) answer false.
 */
export function roomBroken(scene, room) {
    if (!room) return false;
    return Boolean(roomFlag(scene, room, ROOM_FLAGS.broken));
}

/**
 * Force a room open, or close it again (`broken` false): the flag on every piece of the room on `scene`, a GM's
 * write (the primary's, in a breach's completion step, its undo, the GMs' Close the breach and the season's reset).
 * The one writer of `ROOM_FLAGS.broken` (R981); the flag is taken off with `unsetFlag`, never a `-=` key. Answers
 * how many pieces were written; none on the trial hall, which holds no room.
 */
export async function setRoomBroken(scene, room, broken = true, { also = [] } = {}) {
    if (!game.user?.isGM || !scene || !room) return 0;
    let wrote = 0;
    // Taken off, also the pieces `also` names by id (E15 part 2 fix e1-G2): a breach's, renamed off the room while it stood.
    const pieces = [...roomRegions(scene, room)];
    if (!broken) for (const id of also ?? []) {
        const piece = scene.regions?.get?.(id);
        if (piece && !pieces.includes(piece)) pieces.push(piece);
    }
    for (const piece of pieces) {
        const is = Boolean(piece.getFlag(MODULE_ID, ROOM_FLAGS.broken));
        if (is === Boolean(broken)) continue;
        if (broken) await piece.setFlag(MODULE_ID, ROOM_FLAGS.broken, true);
        else await piece.unsetFlag(MODULE_ID, ROOM_FLAGS.broken);
        wrote++;
    }
    return wrote;
}

/** Last known room per token, so we only react to actual crossings. */
const lastRoom = new Map();
/** Last position inside that room, so a refused crossing can be undone - its floor too (`spotOf`). */
const lastPosition = new Map();
/**
 * The tokens whose route this browser is judging, from the update to the `drpgRouteSettled` that
 * announces it, each with the spot it stood on before the route (`settledSpot`), and those of them whose
 * put-back is on its way (`sendBack`) - the REVERT announces those when it lands (E77 C2, `onUpdateToken`).
 * The spot is taken when the route is marked rather than read from `lastPosition` later: a route of two
 * crossings whose first is paid moves `lastPosition` to the route's end (`chargeForCrossing`) before its
 * second is refused and put back.
 * A mark is the marking update's own object, `{ spot }`, so that update's end clears that mark and no
 * other (E77 fix r1-G2, 13.10.2026): until then any update of the token that ended - a GM's flag, a
 * newer route - cleared the route still being judged, and a reader drew the refused room (review round 1
 * cor F4, run by the reviewer: p1's tile painted the refused Shed).
 */
const unsettled = new Map();
const putBack = new Set();
/* How many put-backs this browser has sent for each token (`sendBack`), so that a route judged here that sent one is
   not announced when its judgement ends, whether its put-back is still on its way or has landed and been announced
   already (E79 fix r4-G4: the refusal's put-back is written before its card since then, and lands while the card is
   awaited - scenario 66 N13d read the route announced a second time, as refused in the room it was refused). */
const putBacksSent = new Map();

/**
 * The routes this browser waits on because another one settles them (`untilQuiet`), by token id.
 *
 * One browser charges a route (`settleRoute`), and until E77 fix r1-G2 (13.10.2026) only that one
 * announced it: on a co-owner's browser, or every player's but the first in a world where every player
 * owns every student, the tile stayed on the room before the route until something unrelated redrew it
 * (review round 1 cor F1, O1, O3 - the reviewer read p2's tile on Dorm A 4.5 s after p2's own crossing).
 * Nothing tells the other browsers that the route was accepted - no packet is added for it (the E77
 * plan's tile model) and an accepted route writes nothing to the token - so a browser that owns the token
 * waits for the one thing a refusal does write: its put-back, which reaches every browser. The route is
 * announced there as accepted once the token has had no update for `ROUTE_QUIET_MS`, as refused when the
 * put-back lands (its REVERT, as on the settling browser).
 *
 * `ROUTE_QUIET_MS`: scenario 74 C3 reads the gap from a refused step's update to its put-back's on the
 * co-owner's browser - 164 ms headless, one run on 13.10.2026 beside scenario 66 in another lane. 1500 ms
 * is the bound until a table has a reading of its own (the charge and the put-back each take a round trip
 * to the server there, which the harness's sockets do not); a put-back slower than that is drawn on the
 * refused room for a moment before it lands. It was also how long a co-owner's tile lagged behind an accepted
 * route: 74 C1 and C2 read 1509 and 1516 ms in that run. Since E79 C14 (1.2.79) a co-owner waits only for a
 * route that had steps pending, and announces a route of one update at once (`judgeMove`; scenario 66 N13).
 */
const awaitingQuiet = new Map();
const ROUTE_QUIET_MS = 1500;

/**
 * The token at rest (owner's report, 14.10.2026, on 1.2.77 at a v14 table): a GM's Monokuma dragged into
 * another room kept the old room's tile and fog, and played no arrival, until a second drag inside the new
 * room; a player's crossing may be the same. The update hook read the room before the drag ended: either
 * the token's position at the hook (`roomOfToken`) or a last update still marked with waypoints pending,
 * which this file and fog.mjs pass over as a step of a drag in flight. Which of the two it was is not
 * measured - the harness answers the destination at the hook and no pending step at a drag's end, so it
 * passes either way (LIVE-E78-14) - and the fix does not choose: once the token stands still, its room is
 * read again (`recheckAtRest`, fog.mjs `onUpdateToken`), and only a room that differs from the one the hook
 * recorded, or a route left pending, does anything.
 *
 * At rest: no movement animation of its placeable running (`Token#movementAnimationPromise`, v13+), no
 * movement under way (`movement.state` "pending" or "paused"), and no waypoints pending unless the movement
 * says it ended ("completed" or "stopped"); `AT_REST_MAX_MS` bounds the wait, after which the token is read
 * where it stands. `AT_REST_GRACE_MS` after it, for an update already on its way (a harness drag's last
 * step reaches the hook within it: scenario 74 issues it as the pending mark is taken off).
 */
const AT_REST_MAX_MS = 3000;
const AT_REST_POLL_MS = 100;
const AT_REST_GRACE_MS = 250;

const pause = ms => new Promise(resolve => setTimeout(resolve, Math.max(0, ms)));

function stillMoving(tokenDoc) {
    if (tokenDoc.object?.movementAnimationPromise) return true;
    const state = tokenDoc.movement?.state ?? null;
    if (state === "pending" || state === "paused") return true;
    if (state === "completed" || state === "stopped") return false;
    return Boolean(tokenDoc.movement?.pending?.waypoints?.length);
}

/** Resolves once the token stands still (`stillMoving`), or after `AT_REST_MAX_MS`, then `AT_REST_GRACE_MS` more. */
export async function whenAtRest(tokenDoc) {
    const until = Date.now() + AT_REST_MAX_MS;
    while (tokenDoc && stillMoving(tokenDoc) && Date.now() < until) {
        const animation = tokenDoc.object?.movementAnimationPromise;
        if (animation) await Promise.race([Promise.resolve(animation).catch(() => null), pause(until - Date.now())]);
        await pause(AT_REST_POLL_MS);
    }
    await pause(AT_REST_GRACE_MS);
}

/** Each token's move updates as this browser received them, so a re-read at rest knows whether a newer one came. */
const moveTurns = new Map();

/**
 * Whether this browser reads a token's latest move update as a route that will be put back (H82 fix r1, 23.10.2026;
 * finding H82-C2-R2), by token id: `{ turn, refused }`, `refused` a promise of true only for a route the primary reads
 * as refused (`refusedOnPrimary`) or one this browser charged and refused (`settleRoute` false, its put-back sent), and
 * of false for every other update, a put-back's own landing among them. It settles as soon as the judge knows, before a
 * route that had steps pending waits for quiet, and false when the judge ends without saying. Read by voice.mjs's
 * updateToken hook, which asks an immediate pass only for a move this answers false: a route of two crossings on one
 * crossing's budget passes both vetoes (MAP-11), its last step lands in the room it is refused, and an immediate pass
 * sent the mover that room and then, on the put-back, the room paid for - two reconnects (scenario 75 I, red with voice.mjs
 * as 4e20bf6b left it, once: the refused Cafeteria sent 5 ms after p1's last step, the Gym 208 ms after it).
 * The at-rest re-judge (`recheckAtRest`) is no new update and changes no answer here; nor is a refusal the primary
 * cannot read (an Eclipse's cap, a budget that moved between the veto and the charge) answered true.
 */
const refusals = new Map();

function readRefusal(tokenId, turn) {
    let say = null;
    const refused = new Promise(resolve => { say = resolve; });
    refusals.set(tokenId, { turn, refused });
    return value => say(value === true);
}

/** This browser's reading of a token's latest move update as refused (`refusals`): a promise of a boolean, false when none. */
export function moveRefused(tokenDoc) {
    return refusals.get(tokenDoc?.id)?.refused ?? Promise.resolve(false);
}

/**
 * The room each token's last announcement named, with the move update it was for (`{ turn, room }`), and the
 * spot that announcement read it at while its token has not yet come to rest (`landing`, `{ turn, spot }`):
 * the at-rest read announces again only for another room than the one announced (E79 C14), and until then
 * `settledSpot` answers the spot the route was announced at.
 */
const announced = new Map();
const landing = new Map();

/**
 * Where a move's update puts the token (E79 C14, 1.2.79; plan-p4 N13): the x and y the update names, else the
 * document's own (`_source`), on the token's floor. The owner's report of 15.10.2026 (1.2.78 at a v14 table):
 * "entering a room reads too late" - since 1.2.78 a hook that read the token where its drag began waited for the
 * token to stand still (`whenAtRest`) before the room was right. Read from the update itself, the
 * room is the destination's at the hook, whatever the token's position reads during its animation. Whether
 * v14's document reads the drag's start at the hook at all is not measured (LIVE-E78-14, LIVE-E79-19); where
 * it reads the destination this is that same spot.
 */
function destinationOf(tokenDoc, changes) {
    const at = key => [changes?.[key], tokenDoc._source?.[key], tokenDoc[key]].find(Number.isFinite);
    const level = levelOf(tokenDoc);
    return level === null ? { x: at("x"), y: at("y") } : { x: at("x"), y: at("y"), level };
}

function roomAtSpot(tokenDoc, spot) {
    return spot && Number.isFinite(spot.x) && Number.isFinite(spot.y) ? roomAt(spot.x, spot.y, tokenDoc, spot.level ?? levelOf(tokenDoc)) : null;
}

/**
 * Where a token stands, to be put back to: x and y, and its floor when it has one (E12 C9). A
 * refused climb that put back x and y alone left the token upstairs, and a send-back that names
 * no floor is the one the GM's record (`positionOf`) matches only on a scene of one floor.
 */
function spotOf(tokenDoc) {
    const level = levelOf(tokenDoc);
    return level === null ? { x: tokenDoc.x, y: tokenDoc.y } : { x: tokenDoc.x, y: tokenDoc.y, level };
}

/**
 * Where a token stands for a reader that must not see a route before it is settled (E77 C2, 13.10.2026;
 * room-tile.mjs `settledPosition`): while this browser judges the token's route - from its update to the
 * `drpgRouteSettled` that announces it, or to its put-back's landing - the spot it stood on before the
 * route (as `lastPosition` had it when the route was marked), else its own. A route another browser
 * settles is held the same way on a browser that owns the token, until it is announced there (its
 * put-back lands, or the token is quiet, `awaitingQuiet`; E77 fix r1-G2); a browser that does not own it
 * holds nothing and answers the token's spot as written. Nor is a step taken while waypoints are pending:
 * it answers the step's own spot, and nothing is announced for it. A put-back that never lands (the GM's
 * bridge refused it) keeps the spot before the route until the token's next move, a GM's included (E77
 * fix r1-G2: until then a GM's move left it, review round 1 cor F3; scenario 74 C5). A route announced is
 * answered at the spot its update named until the token comes to rest (`landing`, E79 C14; scenario 66 N13b).
 */
export function settledSpot(tokenDoc) {
    if (!tokenDoc) return null;
    return unsettled.get(tokenDoc.id)?.spot ?? landing.get(tokenDoc.id)?.spot ?? spotOf(tokenDoc);
}

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
    Hooks.on("createToken", (token, options, userId) => noteGmCreated(token, userId));
    Hooks.once("ready", primeGmPositions);
    registerMoveAudit();
    // The witness judge's readers (E12 C12; `judgeArrival`), by a dynamic import: sheet-audit.mjs reaches
    // this file back through its own static imports (R161). mastermind.mjs's `isMastermind` was one of them
    // until E79 fix r2-G2: the judge now asks `actsAsMastermind` of the mover.
    Promise.all([import("./sheet-audit.mjs")])
        .then(([sheet]) => {
            judgeReaders = { flagsHeldNow: sheet.flagsHeldNow, itemsHeldNow: sheet.itemsHeldNow };
        })
        .catch(err => error("Could not load the readers the witness judge reads a student through", err));
    // Who may make a room (E12 C1; the note below). Inline, each one line, so the census of
    // what reaches a rule names them where they are registered.
    Hooks.on("createRegion", (region, options, userId) => noteRegionCreated(region, userId));
    Hooks.on("updateRegion", (region, changes, options, userId) => judgeRoomFlagChange(region, changes, userId));
    Hooks.once("ready", () => primeRoomFlags(game.scenes ?? []));
    Hooks.on("createScene", scene => primeRoomFlags([scene]));
    // A region changed through its scene's own update fires no `updateRegion`: each is judged as that hook judges it (E12 fix
    // r2-S2; review O6; fog.mjs `regionsReplaced`) - a GM's mark remembered, a player's change put back.
    Hooks.on("updateScene", (scene, changes, options, userId) => regionPatches(scene, changes).forEach(([region, patch]) => judgeRoomFlagChange(region, patch, userId)));
}

/* ==========================================================================
 * WHO MAY MAKE A ROOM (E12 C1, 11.10.2026; plan-E12 3.1, audit S07-06)
 * --------------------------------------------------------------------------
 * A room is a region a GM marked (rooms.mjs). Two roads could make one without
 * a GM: a region a player draws, and a player's write to the mark itself.
 * Whether Foundry v14 lets a player create or update a Region outside
 * Daggerheart's relay has not been read off a live table (LIVE-E12-04), so
 * both are answered here, on the primary GM, from the user id Foundry hands
 * the document hook - Foundry's, not a packet's claim - and only while a GM is
 * connected: no hook runs on a client that is not there. A region drawn, or a
 * mark changed, while no GM is connected is judged by nobody; the next GM's
 * ready pass (`primeRoomFlags`) takes the mark as it finds it for one a GM left,
 * and a region a player drew then is never recorded as a player's (read in the
 * code, 11.10.2026; the harness keeps its GM connected, so it is not measured).
 * Whether v14's `_stats.lastModifiedBy` could let the primary judge them at
 * ready is a live check (LIVE-E12-04).
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
 * steered. Every GM primes the memory at ready and on a scene's creation (a
 * scene made or imported with its regions brings no `createRegion` of its own -
 * recalled of Foundry, and the harness's shim does the same) and keeps it on a
 * GM's create and update; the primary writes the old value back, and that
 * write, a GM's, is what moves every GM's memory. A change that names the mark
 * and leaves it as it was is told and needs nothing put back. A region this GM
 * has no memory of is not guessed at: "never seen" was read as "seen unset"
 * until E12 fix r1-G5 (review SEC-4), so a player's write to the mark of a
 * region that came with its scene unset the mark a GM gave it. Now nothing is
 * written and the GMs are told it went unjudged.
 *
 * Only the mark is judged. A player who can write a GM's region at all could
 * also rename it, reshape it or give it a behaviour, and none of that is put
 * back here (review EARLY-C1-3): whether v14 lets a player write a Region
 * outside Daggerheart's relay is LIVE-E12-04, and the relay refuses one.
 *
 * "Drawn by a player" is read from `SETTINGS.playerRegions`, which only the
 * primary writes, as well as from this client's memory of the creates it saw:
 * the memory alone forgot a player's region on a GM's reload, and the next
 * write to its flags was put back and told as if it were a GM's room (review
 * EARLY-C1-4). The setting, not a flag on the region: the region is its
 * author's own document, and a flag on it is the author's to unset.
 * ========================================================================== */

/** regionId -> the room flag as a GM last left it (`null` never decided), on every GM. */
const roomFlagSeen = new Map();
/** Regions this client saw a player create, before the setting that records them comes back. */
const drawnByPlayer = new Set();
/** The primary's writes of `SETTINGS.playerRegions`, one after another, so two creates keep both ids. */
let playerRegionWrites = Promise.resolve();

const roomFlagOf = region => region.getFlag(MODULE_ID, ROOM_FLAG) ?? null;

/** Remember the mark of every region of these scenes this GM has not seen yet. */
function primeRoomFlags(scenes) {
    if (!game.user?.isGM) return;
    for (const scene of scenes) {
        for (const region of scene?.regions ?? []) {
            if (!roomFlagSeen.has(region.id)) roomFlagSeen.set(region.id, roomFlagOf(region));
        }
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
    if (!changes?.flags || drawnByPlayer.has(region.id) || playerRegionIds().has(region.id)) return null;
    if (!roomFlagSeen.has(region.id)) return keepRoomFlag(region, undefined, false, author);
    const was = roomFlagSeen.get(region.id);
    if (now === was && !namesRoomFlag(changes)) return null;
    return keepRoomFlag(region, was, now !== was, author);
}

/**
 * On the primary: put the mark back to `was` when it moved, log it, tell the GMs. `was` undefined:
 * this GM has no memory of the region, so nothing is written and the GMs are told it went unjudged.
 */
async function keepRoomFlag(region, was, moved, author) {
    if (!isPrimaryGm()) return null;
    const unknown = was === undefined;
    try {
        if (moved && !unknown) {
            if (was === null) await region.unsetFlag(MODULE_ID, ROOM_FLAG);
            else await region.setFlag(MODULE_ID, ROOM_FLAG, was);
        }
        log(`${author.name} changed whether "${region.name}" on "${region.parent?.name}" is a room; `
            + `${unknown ? "no memory of its mark, so it was left as it is" : moved ? "put back" : "nothing moved"}.`);
        await whisperToGms(`<p class="drpg-warning">${esc(game.i18n.format(unknown ? "DRPG.Rooms.flagUnjudged" : "DRPG.Rooms.flagKept", {
            user: author.name, region: region.name, scene: region.parent?.name ?? ""
        }))}</p>`);
        return { moved, unknown };
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
/* How long a room's newest spot outlives the ring of `GM_HISTORY_KEPT` (`keptSightings`): the readers' own window. */
const GM_ROOM_KEPT_MS = 60_000;

function positionOf(tokenDoc) {
    return {
        x: tokenDoc.x, y: tokenDoc.y,
        elevation: tokenDoc.elevation ?? 0,
        // The token's floor under the plan's name for it (`tokenDoc.level`; what v14
        // calls it is LIVE-E12-03), undefined on a scene of one floor. A send-back
        // that names a floor matches only a record of the same one (`sendBackRefusal`),
        // and the mover's browser names the floor it remembered (`spotOf`, E12 C9).
        level: tokenDoc.level ?? undefined
    };
}

/*
 * ON EVERY GM, NOT THE PRIMARY ALONE (E12 fix r2-H3, 11.10.2026; early review EARLY-C12-1, security
 * review r2 SEC2-4). The record was primed and kept on the primary only, so a GM who became the primary
 * after its own ready - a co-GM whose id sorts first joining, the primary reloading - judged each first
 * move from where it last saw the token as primary, or from nowhere: a token another GM had put in a
 * locked room read as having jumped there from the room it stood in before. Every GM now primes it at
 * ready and keeps it on every move; only the judgement (`judgeArrival`) waits for the primary.
 */
function primeGmPositions() {
    if (!game.user?.isGM) return;
    for (const scene of game.scenes ?? []) {
        for (const token of scene.tokens ?? []) gmSeen.set(token.id, positionOf(token));
    }
}

function noteGmPosition(tokenDoc, changes, options, userId) {
    if (!game.user?.isGM) return;
    if (changes?.x === undefined && changes?.y === undefined
        && changes?.elevation === undefined && changes?.level === undefined) return;
    let sentTo = null;
    // The arrival judged before `gmSeen` moves (E12 C12): a token the judge has no standing for
    // stood lawfully where `gmSeen` last saw it (`seenStanding`).
    if (judgingHere()) {
        try {
            judgeArrival(tokenDoc, userId, { revert: Boolean(options?.[REVERT]), sentBack: Boolean(options?.[SENT_BACK]),
                asker: askerOf(options?.[SENT_BACK], game.users), putBack: true });
        } catch (err) {
            error(`Could not judge where "${tokenDoc.name}" arrived`, err);
        }
        // The wall rule (E79 C4), from the same start: the GM's last sighting. It changes no standing
        // `judgeArrival` keeps (the plan's D7) and catches its own throw. Then the doors' rules (E17 C1): the
        // judge's verdict on this landing, just read (`ruleRefused`), put back by the audit in either mode.
        const judged = auditMove(tokenDoc, changes, options, userId, gmSeen.get(tokenDoc.id), {
            REVERT, SENT_BACK, sendBackRefusal, stairLinks, roomAt, history: recentPositions(tokenDoc.id), floorRefused: floorJumpRefused, ruleRefused,
            held: judgeReaders?.flagsHeldNow ?? null,
            sendBack: (doc, spot, how) => sendBack(doc, spot, roomAt(spot.x, spot.y, doc, spot.level ?? levelOf(doc)), how)
        });
        /* SEEN WHERE IT IS SENT (E79 fix r2-G1, 1.2.79; review r2, goal H1 b). The put-back is written a macrotask
           after the audit (`sendBack`) and lands a round trip later; until then the GMs' sighting was the spot the
           audit refused, so a second move landing in that window was judged from across the wall - a step back over
           it was a crossing and put back there, after the first put-back: 76 D read Botan across the wall at
           33ea568. The sighting is the spot the token is sent to from the audit on, so a move in the window is
           judged from there; that spot is what the record gains (`sightingsAfter`), never the refused one. */
        sentTo = judged?.back ?? null;
    }
    const was = gmSeen.get(tokenDoc.id);
    if (was) {
        const putBackTo = options?.[WALL_PUT_BACK] && game.users?.get(userId)?.isGM ? positionOf(tokenDoc) : null;
        gmHistory.set(tokenDoc.id, sightingsAfter(gmHistory.get(tokenDoc.id) ?? [], was, Date.now(), putBackTo, roomAtSpot(tokenDoc, was)));
    }
    gmSeen.set(tokenDoc.id, sentTo ?? positionOf(tokenDoc));
}

/**
 * The GMs' audit's floor rule (E80 C2, 18.10.2026; movement-audit.mjs `auditMove`): whether a player's change of
 * floor from the room `from` to the room `to` is one the doors' connected-rooms rule refuses (`crossingRefused`,
 * the stairs between floors), asked only where the movement economy asks that rule - in an Eclipse with an
 * allowance, and outside one while crossing rooms costs a Move (`crossingVerdict`); elsewhere a GM handles moves
 * by hand and nothing is refused. A console that writes its token's `level` and spot to a tunnel's far end
 * upstairs, with no wall on the way, was read clear by the wall rule (R596, red at 917280b).
 */
function floorJumpRefused(scene, from, to, floors) {
    const clock = game.settings.get(MODULE_ID, SETTINGS.clock);
    if (clock?.eclipse === true) {
        const freePlacement = ECLIPSE_FREE_PLACEMENT.includes(incomingTimeOfDay(clock));
        if (overflowCrossings(freePlacement ? null : ECLIPSE_MOVES) === null) return false;
    } else if (!game.settings.get(MODULE_ID, SETTINGS.chargeMovement)) return false;
    return crossingRefused(scene, from, to, floors);
}

/**
 * A token dropped on a scene: where it stands, and on the primary whether a player dropped it somewhere
 * the rules refuse (E12 C12) - judged from where that student last stood on the scene (`droppedFrom`,
 * E12 fix r2-H3). Exported for tier 2, which hands it a plain token.
 *
 * A DROP THE RULES REFUSE IS REMOVED (E17 C1, 26.10.2026; the owner's 13.10 "droga nowego żetonu upuszczonego z
 * paska bocznego do innego pokoju jest sprawdzona i zamknięta" and Q2 of 19.10: "a refused sidebar drop: the new
 * token is deleted and the GMs are told"). A player's drop into a room a rule refuses the student (`ruleOf`: the
 * incident, a lock, a seal, Chained, another's bedroom, the courtroom) stood, unlawful, and the GMs were told; moved
 * to the student's last lawful standing it would be a second token standing on the first. So the primary deletes it
 * and tells the GMs which rule (`removeDrop`). A drop the rules allow stands as before, and so does a GM's.
 */
export function noteGmCreated(tokenDoc, userId) {
    let judged = null;
    if (judgingHere()) {
        try {
            judged = judgeArrival(tokenDoc, userId, { created: true, putBack: true });
        } catch (err) {
            error(`Could not judge where "${tokenDoc.name}" was dropped`, err);
        }
    }
    gmSeen.set(tokenDoc.id, positionOf(tokenDoc));
    if (judged?.rule) removeDrop(tokenDoc, judged);
}

/** Delete a player's drop the rules refuse, a macrotask after its create hook, and tell the GMs (`noteGmCreated`). */
function removeDrop(tokenDoc, standing) {
    if (!isPrimaryGm()) return;
    const name = tokenDoc.actor?.name ?? tokenDoc.name ?? "";
    const room = roomOfToken(tokenDoc) ?? game.i18n.localize("DRPG.Movement.outsideRooms");
    const scene = tokenDoc.parent?.name ?? "";
    setTimeout(async () => {
        try {
            await tokenDoc.delete();
        } catch (err) {
            error(`Could not remove the token of "${name}" a player placed where the rules refuse`, err);
            return;
        }
        log(`A player placed a token of ${name} in ${room} on "${scene}", which the rules refuse (${standing.reason}); it was removed.`);
        whisperToGms(`<p class="drpg-warning" data-drpg-dropgone="${esc(tokenDoc.id)}">${esc(game.i18n.format("DRPG.Movement.dropRemoved", { name, room, scene }))}</p>`
            + `<p>${esc(standing.reason ?? "")}</p>`)
            .catch(err => error("Could not tell the GMs of a token removed", err));
    }, 0);
}

/**
 * Drop every record this client keeps under a token's id (E13 fix r1-F1, 12.10.2026): a token the module carried to
 * another scene (call-world.mjs `carryAcross`) was deleted there and lives on as a copy with an id of its own, which
 * `noteGmCreated` notes. The seven maps keyed by token id (review r1, sec and cor open item 1): `lastRoom`,
 * `lastPosition`, `gmSeen`, `gmHistory`, `standings`, `standingHistory`, `pathRooms`. A student's standing on a scene
 * (`studentStandings`) is keyed by scene and actor and is kept: it is what a later drop there is judged from.
 */
export function forgetToken(tokenId) {
    for (const kept of [lastRoom, lastPosition, gmSeen, gmHistory, standings, standingHistory, pathRooms]) kept.delete(tokenId);
}

/**
 * The GMs' record of a token (`gmHistory`) once it is seen to leave `was` at `at`: the spot added, the
 * newest `GM_HISTORY_KEPT` kept. The audit's put-back of a move through a wall (`putBackTo`, where it
 * stands the token again) adds nothing and cuts the record back to the newest sighting of that spot.
 *
 * WHY THE RECORD, NOT A MARK (E79 fix r1-G1, 1.2.79; review r1, SEC S1 and goal F2, F3). The spot
 * the audit put a token back from entered this record when the put-back landed - the GM had seen the
 * token there - and every reader of the record took it as a place the token stood a moment ago: the
 * bridge's `token.sendBack` (`guardSendbackPlace`, its spots and the centres of `roomsVisited`), the
 * audit's own REVERT and `judgeArrival`'s. C4 kept marks of those spots on the auditing browser, read by
 * the audit's REVERT alone, for 60 s from the audit while the record's entry lived 60 s from the landing:
 * 76 D measured the owner's send-back through the bridge to the spot written, walls ignored, and exempt
 * as a GM's move. Cut from the record, the spot is no reader's, with no clock to outlive and no second
 * store; and every GM cuts it, since the put-back's write carries `WALL_PUT_BACK` to every browser, so a
 * GM that becomes the primary within the minute holds the same record. Cut back to the spot it is put
 * back to, not only the one it leaves: a second move written before the put-back landed stood on the
 * far side as well. A GM's write alone cuts; a player's option of that name is ignored.
 */
export function sightingsAfter(ring, was, at, putBackTo = null, room = null) {
    if (!putBackTo) return keptSightings([...ring, { ...was, at, room }], at);
    const left = ring.findLastIndex(spot => samePlace(spot, putBackTo));
    return left < 0 ? [...ring] : ring.slice(0, left + 1);
}

/*
 * EACH ROOM'S NEWEST SPOT FOR THE MINUTE, APART FROM THE RING (E79 fix r4-G4, 1.2.79; review round 4, SEC S2 residual).
 * A refused route is put back on its own newest spot in the room it paid for (`settleRoute`, r3-G2), and the GMs' wall
 * audit and the judge of arrivals take that put-back for a send-back only while the spot is in their record. The record
 * was the newest `GM_HISTORY_KEPT` sightings alone, so a drag with eight more updates after it left the paid room pushed
 * the spot out within the minute: the put-back was judged as a move from the route's end, through any wall on the
 * straight line back - in 'sendBack' mode the token sent on to the room it had not paid for (scenario 66 W7, red at
 * 0641c4c), and a put-back over two rooms an arrival the rules refuse. Kept now: the newest eight, and before them the
 * newest entry of each room (its floor too) seen within `GM_ROOM_KEPT_MS` of `at`, by the `room` each entry was noted
 * with - at most one more entry per room a token passed through in a minute. How many updates a real v14 drag writes
 * is LIVE-E79-24.
 */
function keptSightings(ring, at) {
    const roomKey = spot => `${spot.room ?? ""}|${spot.level ?? ""}`;
    const newestOf = new Map(ring.map(spot => [roomKey(spot), spot]));
    const recent = ring.slice(-GM_HISTORY_KEPT), older = ring.slice(0, Math.max(0, ring.length - GM_HISTORY_KEPT));
    return [...older.filter(spot => at - spot.at <= GM_ROOM_KEPT_MS && newestOf.get(roomKey(spot)) === spot), ...recent];
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
        const room = roomAt(spot.x, spot.y, tokenDoc, spot.level ?? levelOf(tokenDoc));
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
 *   it paid for (MAP-11), and until E79 fix r3-G2 that spot was a room's centre,
 *   which the token never stood on - the E03 review found the honest request
 *   refused. It is the route's own spot in that room since, which the history
 *   holds; the bridge's guard alone still hands the centres in. A centre names
 *   the floor it is on when the room was asked on one (`positionIn`).
 * @param {*} [options.level]  The floor the token stands on now, for a packet
 *   that names none.
 * @param {number} [options.now]
 * @param {number} [options.windowMs]
 * @returns {string|null}
 */
export function sendBackRefusal(position, { scene = null, history = [], centres = [], level = undefined, now = Date.now(), windowMs = 60_000 } = {}) {
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
    /* ON ONE FLOOR (E12 fix r2-H1, 11.10.2026; security review r2 SEC2-5). A packet that named no
       floor matched a record on any floor, so the bridge wrote, as a revert, a spot the token stood
       on a minute ago upstairs onto the floor it stands on now. The floor asked, else the token's
       own, must be the record's - none on both, on a scene of one floor. */
    const floor = position.level !== undefined ? position.level : (level ?? undefined);
    const onFloor = spot => (spot.level ?? undefined) === floor;
    const matches = history.some(h => now - h.at <= windowMs && h.x === x && h.y === y
        && (position.elevation === undefined || h.elevation === Number(position.elevation))
        && onFloor(h));
    const centre = position.elevation === undefined && centres.some(c => c && c.x === x && c.y === y && onFloor(c));
    return matches || centre ? null : "the token did not stand there a moment ago";
}

/* ==========================================================================
 * WHERE A TOKEN STANDS LAWFULLY (E12 C12, 11.10.2026; plan-E12 3.4, audit Q5a; the owner's answer Q3 a)
 * --------------------------------------------------------------------------
 * The room veto (`onPreUpdateToken`) runs on the mover's browser, and an update
 * marked as our own revert skips it, so a player's console could put a token in a
 * room the rules refuse and the discovery counted it there: scenario 66 I1 read Aiko,
 * jumped by p1 from the Hall into the locked Storage, as the second witness of
 * Daichi's body, and the body was found (E12 C0, 11.10.2026).
 *
 * So the primary judges every arrival again, from the token's LAST LAWFUL ROOM, by
 * the veto's own rules (`crossingVerdict`) without the price: what a crossing costs
 * is the charge's to take and a player's own budget (E39, layer two). A token that
 * arrived where the rules refuse is unlawful until it stands in a room lawfully
 * reachable from that room, and the GMs are told once each time it turns so. An
 * unlawful token is no witness and no third party (`lawfulRoomOf`: chapter.mjs
 * `checkBodyFound`, murder-rules.mjs `maybeThirdParty`). Nothing was put back (Q3 a,
 * not b) until E17 C1: since then a player's arrival a doors' rule refuses - the
 * incident, a lock, a seal, Chained, another's bedroom, the courtroom (`ruleOf`) - is
 * put back by the GMs' audit to the last spot the judge read lawful (`ruleRefused`),
 * and a refused drop is removed (`noteGmCreated`); an arrival only the connected-rooms
 * rule refuses still stands, unlawful, as before. A GM who sees it otherwise moves the
 * token, and a GM's move or a GM's create makes it lawful where it stands. Who moved
 * it is the hook's `userId`, Foundry's and not a packet's.
 *
 * A REVERT is a player's claim. It is honoured only where `sendBackRefusal` passes it
 * against the primary's record (`recentPositions`), and the token then stands as the
 * judge last left it on that spot, lawful or not; any other is judged as a crossing.
 * A send-back the bridge writes for a player (gm-bridge.mjs `handleSendback`, marked
 * `SENT_BACK`) is the player's revert, though a GM writes it.
 *
 * The student is read as the GMs hold it (`flagsHeldNow`, `itemsHeldNow`), in one
 * synchronous step and not awaited (plan 1b.2; H3, H17): a flag a player's console
 * writes a moment before the move - `monokuma`, which no crossing rule binds - is put
 * back by the sheet audit, and read off the document it let the arrival stand (66 I3).
 * Both readers come in by a dynamic import (`registerMovement`); until it lands, at
 * boot, the document is read.
 *
 * THE RECORD IS THE PRIMARY'S MEMORY ALONE (E12 fix r2-H3, 11.10.2026; the fix list's decision on
 * EARLY-C12-1 and SEC2-4). Every GM keeps `gmSeen`; only the primary judges and keeps `standings`. A
 * client that becomes the primary forgets the standings it holds (`judgingHere`): they were written
 * before another GM judged the moves since, and read again they called a GM's placing a jump. It then
 * judges each token's next move from where `gmSeen` saw it, lawful. So an unlawful standing does not
 * survive a change of primary: a student a console put past a lock counts where they stand once another
 * GM takes over (scenario 66 P2 reads it), and so, by the same reading of `gmSeen` primed at ready, does a
 * move made while no GM was connected (not driven by any scenario). Kept in no document or setting. P1 reads
 * the other half: a GM's placing made while another GM was the primary is not a jump.
 *
 * A TOKEN A PLAYER DROPS (E12 fix r2-H3; security review r2 SEC2-1). A drop had no standing and was
 * judged from nowhere - lawful in any room no lock, seal or bedroom shuts, however far from where the
 * student stood - and a student with two tokens in a room was two witnesses. A drop is now judged from
 * the newest standing of that student on that scene, of any of their tokens, deleted ones included
 * (`droppedFrom`); a drop with none is still judged from nowhere and the GMs are told a player placed it
 * (`tellDropped`). `witnessesOf` (chapter.mjs) counts one token a student.
 * ========================================================================== */

/** tokenId -> where it stands as the judge read it: { x, y, level, lawful, last: { room, level }, told, reason }. */
const standings = new Map();
/** tokenId -> the standings it was moved from, newest last, as `gmHistory`: what an honoured revert returns to. */
const standingHistory = new Map();
/** "sceneId actorId" -> the newest standing of any token of that student on that scene: what a drop is judged from. */
const studentStandings = new Map();
/** Whether this client was the primary when the judge last asked (`judgingHere`). */
let judgedAsPrimary = false;

/**
 * Whether this client judges: the primary GM. A client that was not the primary when last asked and is
 * now forgets the standings it holds (the note above). Asked on every GM's every move and drop, so a
 * client that stops being the primary sees it by the next move any GM makes.
 */
function judgingHere() {
    const primary = isPrimaryGm();
    if (primary && !judgedAsPrimary) {
        standings.clear();
        standingHistory.clear();
        studentStandings.clear();
    }
    judgedAsPrimary = primary;
    return primary;
}

const studentKey = tokenDoc => {
    const scene = tokenDoc?.parent?.id, actor = tokenDoc?.actorId ?? tokenDoc?.actor?.id;
    return scene && actor ? `${scene} ${actor}` : null;
};

/** Record where the judge reads this token as standing, and that it is its student's newest standing on the scene. */
function keepStanding(tokenDoc, now) {
    standings.set(tokenDoc.id, now);
    const key = studentKey(tokenDoc);
    if (key) studentStandings.set(key, now);
}

/** Where a dropped token's student last stood on its scene: the newest standing of any token of theirs, else where `gmSeen` saw another, else null. */
function droppedFrom(tokenDoc) {
    const key = studentKey(tokenDoc);
    const kept = key ? studentStandings.get(key) : null;
    if (kept) return kept;
    const actorId = tokenDoc.actorId ?? tokenDoc.actor?.id;
    for (const other of tokenDoc.parent?.tokens ?? []) {
        if (other.id === tokenDoc.id || (other.actorId ?? other.actor?.id) !== actorId) continue;
        const seen = seenStanding(other);
        if (seen) return seen;
    }
    return null;
}
/** sheet-audit.mjs's held readers, once `registerMovement`'s import lands. */
let judgeReaders = null;

/** Marks the bridge's send-back (gm-bridge.mjs `handleSendback`): a player's revert that a GM writes. */
export const SENT_BACK = "drpgSentBack";

/** Marks the GMs' audit's put-back of a move through a wall (movement-audit.mjs), for every GM's record (`sightingsAfter`). */
const WALL_PUT_BACK = "drpgWallPutBack";

function samePlace(a, b) {
    return a.x === b.x && a.y === b.y && (a.level ?? null) === (b.level ?? null);
}

/**
 * The token where it stands: lawful, its room the last lawful one - or not, keeping the last lawful room it had,
 * and, where a rule refused a player's move there (E17 C1), the rule's code (`rule`) and the spot the judge last
 * read the token standing on lawfully (`back`: x, y, elevation, level), which the GMs' audit puts it back to.
 */
function standingHere(tokenDoc, { lawful = true, last = null, told = false, reason = null, rule = null, back = null } = {}) {
    return { x: tokenDoc.x, y: tokenDoc.y, elevation: tokenDoc.elevation ?? 0, level: tokenDoc.level ?? undefined, lawful,
        last: lawful ? { room: roomOfToken(tokenDoc), level: levelOf(tokenDoc) } : last,
        told: lawful ? false : told, reason: lawful ? null : reason, rule: lawful ? null : rule, back: lawful ? null : back };
}

/**
 * The code of a doors' rule the GMs put a token back for (movement-audit.mjs `RULE_CODES`), read off a keyed
 * refusal of `crossingVerdict`, or null: another's bedroom is `cannotNow` with the bedroom's mark (`restrictedFrom`),
 * and the connected-rooms rule's `cannotNow` is not a rule's - it is the walls' and floors', which follow `moveAudit`
 * (session 0), and a route through rooms that lands as one write reads as a jump between two rooms that do not touch.
 */
function ruleOf(verdict) {
    if (verdict?.rule === "bedroomShut") return "cannotNow";
    return verdict?.code !== "cannotNow" && RULE_CODES.includes(verdict?.code) ? verdict.code : null;
}

/** The newest spot the judge read this token standing on lawfully, its own standing before this move last: `{ x, y, elevation, level }` or null. */
function lastLawfulSpot(tokenDoc, own) {
    const spot = [...(standingHistory.get(tokenDoc.id) ?? []), own].findLast(s => s && s.lawful !== false && Number.isFinite(s.x) && Number.isFinite(s.y));
    return spot ? { x: spot.x, y: spot.y, elevation: Number(spot.elevation) || 0, level: spot.level } : null;
}

/**
 * The GMs' audit's question (movement-audit.mjs `auditMove`, E17 C1): whether the judge read this token's landing, where
 * it stands now, as a player's move a rule refuses - `{ code, back, reason, room }` - or null. Read off the standing
 * `judgeArrival` has just kept for this very spot, so the audit and the judge never disagree about a move.
 */
function ruleRefused(tokenDoc) {
    const now = standings.get(tokenDoc?.id);
    if (!now || now.lawful !== false || !now.rule || !now.back || !samePlace(now, positionOf(tokenDoc))) return null;
    return { code: now.rule, back: now.back, reason: now.reason, room: roomOfToken(tokenDoc) };
}

/**
 * Why the doors' rules refuse a send-back of this token to `spot`, as a code of `RULE_CODES`, or null (E17 C1; the stage's
 * design note 22: `guardSendbackPlace` asked the GMs' record and the rooms visited, and a `token.sendBack` could end in a
 * bedroom shut to its mover - the centre of a room the token stood in, the one it stands in while a put-back is on its
 * way among them). A spot in a room the judge read the token standing in lawfully is its way back - a tunnel's or a
 * breach's end in another's bedroom included; any other room is judged as a crossing from the last lawful room, by the
 * rules `ruleOf` names, as the student the GMs hold. `user` is the sender, for the Mastermind's keys. On the primary GM.
 */
export function sendBackRuleOf(tokenDoc, spot, user = null) {
    const actor = tokenDoc?.actor;
    if (!actor || actor.type !== "character" || !isPlaceScene(tokenDoc.parent)) return null;
    const level = spot?.level !== undefined ? spot.level : levelOf(tokenDoc);
    const to = roomAt(Number(spot?.x), Number(spot?.y), tokenDoc, level);
    const own = standings.get(tokenDoc.id) ?? seenStanding(tokenDoc);
    const stood = [...(standingHistory.get(tokenDoc.id) ?? []), own].filter(s => s && s.lawful !== false);
    if (!to || stood.some(s => roomAtSpot(tokenDoc, s) === to)) return null;
    const flags = judgeReaders ? judgeReaders.flagsHeldNow(actor) : actor;
    const items = judgeReaders ? judgeReaders.itemsHeldNow(actor) : Array.from(actor.items ?? []);
    const student = { id: actor.id, name: actor.name, type: actor.type, getFlag: (scope, key) => flags.getFlag(scope, key), items };
    const last = own?.last ?? null;
    const verdict = crossingVerdict(student, last?.room ?? null, to, tokenDoc.parent, { from: last?.level ?? null, to: level },
        { mover: { gm: false, mastermind: actsAsMastermind(actor, user) }, pay: false, keyed: true, elevation: ownElevation(tokenDoc) });
    return verdict === true ? null : ruleOf(verdict);
}

/** A token the judge has no record of stood lawfully where the primary last saw it (`gmSeen`), else nowhere. */
function seenStanding(tokenDoc) {
    const seen = gmSeen.get(tokenDoc.id);
    if (!seen) return null;
    const level = seen.level ?? levelOf(tokenDoc);
    return { ...seen, lawful: true, last: { room: roomAt(seen.x, seen.y, tokenDoc, level), level }, told: false, reason: null };
}

/**
 * Judge where this token now stands (the note above), record it, and tell the GMs when it
 * turned unlawful. `userId` is the mover's, `revert` whether the write was marked as our own
 * revert, `sentBack` whether the bridge wrote it for a player, `asker` that player's id as the audit
 * reads it (movement-audit.mjs `askerOf`), `created` whether the token was just dropped. On the
 * primary, from `noteGmPosition` and `noteGmCreated`; exported for tier 2, which judges a plain token.
 */
export function judgeArrival(tokenDoc, userId = null, { revert = false, sentBack = false, asker = null, created = false, putBack = false } = {}) {
    if (!tokenDoc?.id) return null;
    judgingHere();
    const own = standings.get(tokenDoc.id) ?? seenStanding(tokenDoc);
    const was = own ?? (created ? droppedFrom(tokenDoc) : null);
    const mover = game.users?.get(userId) ?? null;
    const actor = tokenDoc.actor;
    let now = null;
    if (!actor || actor.type !== "character") now = standingHere(tokenDoc);
    else if ((revert && !mover?.isGM) || sentBack) {
        const spot = positionOf(tokenDoc);
        const honoured = !sendBackRefusal(spot, { scene: tokenDoc.parent, history: recentPositions(tokenDoc.id) });
        const back = honoured ? (standingHistory.get(tokenDoc.id) ?? []).findLast(s => samePlace(s, spot)) : null;
        if (back) now = { ...back, x: spot.x, y: spot.y, elevation: spot.elevation, level: spot.level };
    } else if (mover?.isGM) now = standingHere(tokenDoc);
    if (!now) {
        // One synchronous step from the reads to the verdict (H3), nothing awaited (H17).
        const flags = judgeReaders ? judgeReaders.flagsHeldNow(actor) : actor;
        const items = judgeReaders ? judgeReaders.itemsHeldNow(actor) : Array.from(actor.items ?? []);
        const student = { id: actor.id, name: actor.name, type: actor.type, getFlag: (scope, key) => flags.getFlag(scope, key), items };
        /* The Mastermind as the mover acts (passages-gm.mjs `actsAsMastermind`): the one owner the door names, as the
           mover's own veto reads it (`iAmTheMastermind`). Until E79 fix r2-G2 (16.10.2026; the round-2 review's SEC M3)
           the role was read off the student alone, and another owner of the Mastermind's student, whose own browser
           refuses a lock and a passage it does not know, was let stand past both here. On the bridge's send-back the
           mover is the player who asked it (`asker`), as the audit reads the same write (E79 fix r3-G2; review r3, SEC
           S4): the hook's user is the GM who wrote it, and a GM acts as the Mastermind, so a co-owner's send-back of
           the Mastermind's token through a passage the student does not know stood lawful (76 G, red at 647c8b0). The
           asker is read on a GM's write alone, as the audit reads it: a player's own write naming another is its writer's. */
        const asked = asker && mover?.isGM ? game.users?.get(asker) ?? null : null;
        const mastermind = actsAsMastermind(actor, asked ?? mover);
        // Through a secret passage (E79 C3): the straight line from where the primary last saw the token to
        // where it stands, on the floor of the room it came from, against the GMs' records.
        const via = was ? crossingVia(centresOf(tokenDoc, was, tokenDoc), actor, tokenDoc.parent?.id, was.last?.level ?? null, { mastermind }) : null;
        const verdict = arrivalVerdict(student, was?.last ?? null, tokenDoc, { gm: false, mastermind }, via);
        if (verdict === true) now = standingHere(tokenDoc);
        else {
            /* A RULE'S REFUSAL OF A PLAYER'S MOVE (E17 C1; the note on `ruleOf`). Kept on the standing with the spot to put the
               token back to, the newest the judge read lawful: the GMs' audit puts it back (`ruleRefused`), a drop is removed
               (`noteGmCreated`). Only a player's move: the hook's player, or the player a GM's send-back names. With `putBack`
               (the primary's hooks, which act on it) the GMs are told by the put-back, not as an unlawful arrival. */
            const rule = asked || (mover && !mover.isGM) ? ruleOf(verdict) : null;
            const back = rule && !created ? lastLawfulSpot(tokenDoc, own) : null;
            now = standingHere(tokenDoc, { lawful: false, last: was?.last ?? null, told: was?.lawful === false && was.told, reason: verdict.text ?? null,
                rule, back });
            if (putBack && rule && (created || back)) now.told = true;
        }
    }
    if (own && !samePlace(own, now)) {
        // Kept as the GMs' sightings are (`keptSightings`, E79 fix r4-G4): a put-back's `back` is found by the same spot.
        const at = Date.now(), ring = [...(standingHistory.get(tokenDoc.id) ?? []), { ...own, at, room: roomAtSpot(tokenDoc, own) }];
        standingHistory.set(tokenDoc.id, keptSightings(ring, at));
    }
    keepStanding(tokenDoc, now);
    if (!now.lawful && !now.told && isPrimaryGm()) {
        now.told = true;
        tellUnlawful(tokenDoc, now);
    } else if (created && !was && now.lawful && !mover?.isGM && actor?.type === "character" && isPrimaryGm()) {
        tellDropped(tokenDoc);
    }
    return now;
}

/**
 * Whether a student may stand where this token stands, coming from the last lawful room: true or
 * the refusal, keyed (`{ code, text }`, E17 C1: `ruleOf` reads which rule refused). The veto's rules,
 * read the way the veto reads them (`crossingVerdict`) with no price, and a body is a body (`isCorpse`,
 * which the veto asks before them). Pure but for the settings those rules read.
 */
function arrivalVerdict(student, last, tokenDoc, mover, via = null) {
    if (isCorpse(student)) return { code: "cannotNow", text: game.i18n.localize("DRPG.Move.dead") };
    // Nobody stands in the trial hall (rooms.mjs, E13 C1), so no move there is a crossing. Asked
    // here and not left to `roomOfToken`: the last room the judge holds may predate the link.
    // Scenario 41 b1 read it on 12.10.2026: the hall linked after its tokens were recorded in its
    // Stand, Aiko's move to no room was refused as leaving the courtroom and the GMs were told.
    if (!isPlaceScene(tokenDoc.parent)) return true;
    const from = last?.room ?? null;
    const to = roomOfToken(tokenDoc);
    if (from === to) return true;                      // the same room, a stairwell's floors too
    return crossingVerdict(student, from, to, tokenDoc.parent, { from: last?.level ?? null, to: levelOf(tokenDoc) },
        { mover, pay: false, via, elevation: ownElevation(tokenDoc), keyed: true });
}

/** The GMs' notice, once per turn to unlawful; and the GM's console. */
function tellUnlawful(tokenDoc, now) {
    const outside = game.i18n.localize("DRPG.Movement.outsideRooms");
    const name = tokenDoc.actor?.name ?? tokenDoc.name ?? "";
    const room = roomOfToken(tokenDoc) ?? outside;
    const from = now.last?.room ?? outside;
    log(`${name} reached ${room} on "${tokenDoc.parent?.name}" by a crossing the rules refuse (${now.reason}); no witness and no third party until they stand somewhere they could have reached from ${from}.`);
    whisperToGms(`<p class="drpg-warning" data-drpg-unlawful="${esc(tokenDoc.id)}">${esc(game.i18n.format("DRPG.Movement.unlawfulArrival", { name, room, from }))}</p>`
        + `<p>${esc(now.reason ?? "")}</p>`)
        .catch(err => error("Could not tell the GMs of an unlawful arrival", err));
}

/** The GMs' notice of a student's token a player placed on a scene where the student stood nowhere before: judged from nowhere. */
function tellDropped(tokenDoc) {
    const name = tokenDoc.actor?.name ?? tokenDoc.name ?? "";
    const room = roomOfToken(tokenDoc) ?? game.i18n.localize("DRPG.Movement.outsideRooms");
    const scene = tokenDoc.parent?.name ?? "";
    log(`A player placed a token of ${name} in ${room} on "${scene}", where ${name} stood nowhere before; judged from nowhere.`);
    whisperToGms(`<p class="drpg-warning" data-drpg-dropped="${esc(tokenDoc.id)}">${esc(game.i18n.format("DRPG.Movement.droppedFromNowhere", { name, room, scene }))}</p>`)
        .catch(err => error("Could not tell the GMs of a token a player placed", err));
}

/**
 * Where the judge reads this token as standing: its record, or - where the token moved since
 * (a reader that came before the hook that records it) - judged now, as a move by nobody known
 * to be a GM, so the order of the movement and murder hooks does not matter. A token never seen
 * stands lawfully where it is. Off the primary nothing is judged or kept (E12 fix r2-H3): every
 * token stands lawfully where it is, as `roomOfToken` reads it.
 */
export function standingOf(tokenDoc) {
    if (!tokenDoc?.id) return null;
    if (!judgingHere()) return standingHere(tokenDoc);
    const now = standings.get(tokenDoc.id);
    if (!now) {
        const first = standingHere(tokenDoc);
        keepStanding(tokenDoc, first);
        return first;
    }
    return samePlace(now, positionOf(tokenDoc)) ? now : judgeArrival(tokenDoc, null);
}

/** The room this token counts in as a witness or a third party: its room, or none while it stands unlawfully. */
export function lawfulRoomOf(tokenDoc) {
    return standingOf(tokenDoc)?.lawful === false ? null : roomOfToken(tokenDoc);
}

/**
 * Where the primary GM reads this token as standing, for a write it makes from there (E80 fix early-C2-G1; the
 * review's E80-C2-1): passages-gm.mjs `crossTunnel` judges a tunnel's near end from it and asks again once the
 * price is taken. `{ x, y, elevation, level }`, or null while the GMs do not read the token where its document
 * stands: a put-back this browser sent is on its way (`putBack`: the audit's, or a crossing this browser refused),
 * or the judge holds it as standing where the rules refuse (`standingOf`), which a GM's write from there would
 * make lawful. Given `was`, a spot read before an await, null too when the token no longer stands on it. The
 * GMs' sighting (`gmSeen`) is not read apart: by the code it stands elsewhere than the document only while
 * `putBack` holds the token - `noteGmPosition` moves it to the audit's put-back in the hook that sends one, and
 * `judgeMove` lets go of the token only in a hook that writes a new sighting. On the primary GM.
 */
export function gmSpotOf(tokenDoc, was = null) {
    return gmSpotWhy(tokenDoc, was) ? null : positionOf(tokenDoc);
}

/**
 * Why `gmSpotOf` reads this token nowhere, or null where it reads it: "noToken", "putBack" (a put-back this browser
 * sent is on its way), "unlawful" (the judge holds it as standing where the rules refuse) or, given `was`, "moved" (it
 * no longer stands there). Asked in that order, as `gmSpotOf` always asked them. H81 fix r1 (20.10.2026; the review's
 * H81-C1-R1 and H81-C1-R5): passages-gm.mjs `crossTunnel` refused all three as "not at an end", logged none of them,
 * and the player standing on the mark was told to stand on it; now it says which, in the GM's log and the Debug line.
 */
export function gmSpotWhy(tokenDoc, was = null) {
    if (!tokenDoc?.id) return "noToken";
    if (putBack.has(tokenDoc.id)) return "putBack";
    if (standingOf(tokenDoc)?.lawful === false) return "unlawful";
    return was && !samePlace(was, positionOf(tokenDoc)) ? "moved" : null;
}

/**
 * Where the primary GM reads this character as standing, in `locateActor`'s shape - `{ tokenDoc, scene, room, level }`,
 * the token `locateActor` chooses (`sceneId` a hint among the character's own, as there), its room and floor those of
 * the spot `gmSpotOf` reads on the token's scene - or null: no token on a place scene, or one the GMs do not read where
 * its document stands (`gmSpotOf`: a put-back on its way, a standing the rules refuse). E80 fix early-C3-G2 (the
 * review's E80-C3-1; the stage's D2: "end, room, floor, scene: the GM's reading"): passages-gm.mjs reads a Find
 * Passage's searcher and a show's two students here, where it read the token's document, which the player's own
 * browser writes - a console's jump through a wall found the passage beyond it. On the primary GM.
 */
export function gmPlaceOf(actor, { sceneId = null } = {}) {
    const place = locateActor(actor, { sceneId });
    const spot = place ? gmSpotOf(place.tokenDoc) : null;
    if (!spot) return null;
    return { tokenDoc: place.tokenDoc, scene: place.scene, room: roomAtSpot(place.tokenDoc, spot), level: spot.level ?? levelOf(place.tokenDoc) };
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
        // A CHANGE OF FLOOR IS A MOVE (E12 C9, audit S07-45). Until 1.2.74 this returned on any change
        // without x or y, so a player's update naming the level alone was never judged: scenario 66 G2
        // read p1's move from the Corridor up into a locked Vault land and cost nothing (11.10.2026).
        // rooms.mjs `isMoveChange` is the one list of the fields that move a token.
        if (!isMoveChange(changes)) return;

        const actor = tokenDoc.actor;
        if (!actor || actor.type !== "character") return;
        if (game.user.isGM) return;                    // GMs move anything anywhere

        // A BODY STAYS WHERE IT FELL.
        //
        // Checked before anything else, and deliberately not through
        // `crossingVerdict`: that function answers "may this character cross from one
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

        // Each end read on its own floor: the room under the token where it stands, and the room
        // under where it is going on the floor it is going to (E12 C9).
        const here = levelOf(tokenDoc);
        const there = changes.level !== undefined ? changes.level : here;
        const from = roomOfToken(tokenDoc);
        const to = roomAt(
            changes.x ?? tokenDoc.x,
            changes.y ?? tokenDoc.y,
            tokenDoc,
            there
        );

        if (from === to) return;                       // same room: always free, a stairwell's floors too
        if (!from && !to) return;                      // no regions here

        // Whether the step goes through a secret passage this character knows (E79 C3): the token's centre now
        // and where it is going, as one straight line. A route of several waypoints is read on that line,
        // which can miss a passage the waypoints went through; then the bedroom beyond is shut, as a door's.
        const via = crossingVia(centresOf(tokenDoc, tokenDoc, { x: changes.x ?? tokenDoc.x, y: changes.y ?? tokenDoc.y }),
            actor, tokenDoc.parent?.id, here);
        const allowed = crossingVerdict(actor, from, to, tokenDoc.parent, { from: here, to: there }, { via, elevation: ownElevation(tokenDoc) });
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
 * `floors` names the floor each end is on (E12 C9), for the stairs rule in `crossingRefused`; null
 * reads both ends as one floor. Exported, and named for what it returns, so a GM's client can ask
 * the same question of a crossing a player's veto let through - which the witness judge does
 * (`judgeArrival`, E12 C12): it hands in the student as the GMs hold it, the `mover` it judges
 * (whether a GM, whether the Mastermind; this browser's user when null) and `pay: false`, which
 * asks every rule but the price - the Eclipse's count of crossings and the economy below the
 * movement setting. What a crossing costs is the charge's, on whichever browser pays it.
 *
 * A SECRET PASSAGE IS A WAY OUT FOR WHOEVER KNOWS IT (E79 C3, 14.10.2026; the E79 plan's P5-0). Where
 * the character knows a passage between `from` and `to` on one floor (`passesThrough`), the two rooms
 * are connected for it, in daily life and in an Eclipse alike - and nothing else changes: the lock,
 * the seal, the chain, the courtroom, the Eclipse's count and the price are asked as for a door.
 * `via` is "passage" when the caller read the step going through a passage this character knows
 * (passages.mjs `crossingVia`: the veto from the token's route, the witness judge from where it last
 * stood), and only then is a bedroom beyond open without its key (`restrictedFrom`). `known` is the
 * suite's (R558): rows of its own in the copy's shape.
 *
 * THE KEYED CORE (E80 C2, 18.10.2026; the stage's "doors' words"). 'Go through' a tunnel is judged here, by
 * these rules and no copy of them (`tunnelVerdict`): `joined` is true for a crossing the caller has already
 * read as one through a tunnel the character knows, so the rooms are connected as through a passage, and
 * `keyed` answers a refusal as `{ code, text }` - `code` one of the bridge's reasons (bridge-guards.mjs
 * `REASONS`), `text` the sentence this function gives the veto - so the primary GM can tell the player
 * which rule stopped it without sending a sentence of its own. Unkeyed, every answer is as before.
 *
 * `elevation` is the height of the token that crosses, where `from` was read: a passage in a wall is read at it
 * (`passesThrough`; H81 fix r1, `passageRooms`' note). None, the floor's bottom.
 *
 * @returns {true|string|{code: string, text: string}} true, or the reason it is refused.
 */
export function crossingVerdict(actor, from, to, scene, floors = null, { mover = null, pay = true, via = null, known, joined = false, keyed = false, elevation = null } = {}) {
    // Monokumas are not bound by any of this.
    if (actor.getFlag(MODULE_ID, FLAGS.monokuma)) return true;

    // You are in a murder. You do not walk out of it.
    //
    // The incident is a turn-based exchange in one room, and the only ways out
    // of it are the ones the guide writes as crisis actions - Survive, Escape
    // together, a Finishing blow. Dragging the token across the map is not one
    // of them, and doing it left the engine running an incident between two
    // people standing in different rooms.
    const inIncident = lockedInIncident(actor, keyed);
    if (inIncident) return inIncident;

    // Despair Calls that physically stop you. Checked before the action economy
    // because they are absolute: no amount of actions buys past a locked door.
    const passage = joined || passesThrough(actor, from, to, scene, floors, { mover, known, elevation });
    const blocked = restrictedFrom(actor, to, scene, mover, { via: passage && via === "passage" ? "passage" : null, keyed });
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
    if (clock?.phase === "classTrial") return refusal(keyed, "trialLocked", game.i18n.localize("DRPG.Trial.moveLocked"));

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
            if (pay && eclipseMovesUsed(actor.id, clock) >= allowance) return refusal(keyed, "eclipseSpent", game.i18n.localize("DRPG.Eclipse.noMovesLeft"));

            /* The connected-rooms rule, the stairs between floors included (E12 fix r2-H1, 11.10.2026;
               early review EARLY-C9-1). This branch asked `neighbouringRooms` itself and never reached
               the stairs rule in `crossingRefused`, so in an Eclipse a change of floor from the Lab up
               into the Attic above it cost one crossing, and the witness judge, which asks here with
               `pay: false`, called it lawful. One rule for both roads now; tier 2 "a change of floor
               between rooms only a player's stairs link is refused ..." reads it in an Eclipse. */
            const refused = passage ? false : crossingRefused(scene, from, to, floors);
            if (refused) return refusal(keyed, "cannotNow", refused);
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
    const notConnected = passage ? false : crossingRefused(scene, from, to, floors);
    if (notConnected) return refusal(keyed, "cannotNow", notConnected);
    if (!pay) return true;

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
    return refusal(keyed, "noBudget", game.i18n.localize("DRPG.Move.noBudget"));
}

/** A refusal as the keyed core answers it, `{ code, text }` (with `rule` where a code alone does not name it: another's bedroom,
 *  E17 C1's `ruleOf`), or the bare sentence every other caller reads (`crossingVerdict`). */
function refusal(keyed, code, text, rule = null) {
    if (!keyed) return text;
    return rule ? { code, text, rule } : { code, text };
}

/**
 * Is the destination reachable from where you stand?
 *
 * Silent when adjacency cannot be established - `neighbourAnswer` treats a room
 * it cannot measure the geometry of as reachable, and a map the module cannot
 * read must not become a map nobody can walk across; a room whose answer was
 * decided and came out empty reaches nothing (E12 fix r2-H2). Leaving the
 * rooms entirely, or arriving from outside them, is likewise not a crossing
 * this rule governs.
 *
 * BETWEEN FLOORS, ONLY BY THE STAIRS (E12 C9, audit S07-45; owner's answer Q1 a). On a scene
 * that has stairs - a region carrying Foundry's Change Level behaviour - a crossing from a room on
 * one floor to a room on another is connected when the stairs link the two (`stairLinks`), and
 * refused otherwise with a sentence that names only where you stand, as `notConnectedText` does
 * for an unknown room. The footprints say nothing here: the Attic drawn over the Lab overlaps it,
 * and the box test below would call every room a neighbour of the one under it. A scene with no
 * stairs is judged by that test as before, so a map drawn with floors and no Change Level region
 * is no dead end. Whether a v14 Change Level region moves a token through `preUpdateToken` as the
 * player, so that this sees the climb at all, is LIVE-E12-02.
 *
 * Asked by the movement economy below, by the Eclipse's branch above it and by eclipse.mjs
 * `judgeEclipseCrossing` (E12 fix r2-H1), so a change of floor meets the stairs on every road.
 *
 * @returns {false|string} false when allowed, otherwise the reason.
 */
export function crossingRefused(scene, from, to, floors = null) {
    if (!from || !to) return false;

    if (floors && levelKey(floors.from) !== levelKey(floors.to)) {
        const stairs = stairLinks(scene);
        if (stairs) {
            const linked = stairs.some(([a, b]) => (a === from && b === to) || (a === to && b === from));
            return linked ? false : game.i18n.format("DRPG.Move.noStairs", { from });
        }
    }

    // An empty answer lets the crossing through only when no rule decided it (E12 fix r2-H2,
    // `neighbourAnswer`): a room the lists or the walls left with no door reaches nothing.
    const { rooms: connected, decided } = neighbourAnswer(scene, from);
    if ((!connected.length && !decided) || connected.includes(to)) return false;

    return notConnectedText(from, to, connected, roomsKnownToMe(scene));
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
 * suite, which runs on a GM's browser, where it is `null`. Every caller hands in
 * `roomsKnownToMe(scene)` for the scene the token crossed on (E12 fix r1-G4); the
 * default, with no scene, knows no room on a player's browser and so names none.
 */
export function notConnectedText(from, to, connected, known = roomsKnownToMe()) {
    if (known && !known.has(to)) return game.i18n.format("DRPG.Move.cannotReach", { from });
    const shown = known ? connected.filter(r => known.has(r)) : connected;
    return shown.length
        ? game.i18n.format("DRPG.Move.notConnected", { from, to, rooms: shown.join(", ") })
        : game.i18n.format("DRPG.Move.notConnectedShort", { from, to });
}

/**
 * The rooms this viewer's own characters have discovered on `scene`, plus
 * wherever they stand there; `null` for a GM or the Mastermind, who know the
 * whole map. Read off this client's own copy of the ledger (D2: a player's
 * browser holds only their own rows), through settings.mjs, so this stays a
 * leaf and needs nothing from the fog.
 *
 * ON THE SCENE THE CALLER NAMES (E12 fix r1-G4, 11.10.2026; review round 1
 * EARLY-C6-2 and SEC-2). It read the scene on screen and that screen's token
 * placeables, while Listen's doors and the rest rooms came from the scene the
 * character stands on - so a player whose camera was on another map was told
 * "Unexplored room" for doors they had been through, and a player whose client
 * had no scene on screen got `null`, the GM's "no filter", and Listen named
 * every neighbour. The callers hand in the character's scene now, and a player
 * with no scene, or one this cannot read, knows no room: an empty Set, never
 * `null`.
 */
export function roomsKnownToMe(scene = null) {
    try {
        if (game.user.isGM || iAmTheMastermind()) return null;
        const known = new Set();
        if (!scene?.id) return known;
        const ledger = discoveryLedger();
        for (const [actorId, rooms] of Object.entries(ledger[scene.id] ?? {})) {
            if (!game.actors.get(actorId)?.isOwner) continue;
            for (const room of rooms ?? []) known.add(room);
        }
        for (const tokenDoc of scene.tokens ?? []) {
            if (!tokenDoc.isOwner) continue;
            const room = roomOfToken(tokenDoc);
            if (room) known.add(room);
        }
        return known;
    } catch {
        return new Set();
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
function lockedInIncident(actor, keyed = false) {
    try {
        const state = game.settings.get(MODULE_ID, SETTINGS.murderState) ?? {};
        if (!state.active || state.stage !== "incident") return false;

        // The names are not in that setting any more (LIVE-001). This client
        // holds them only if it is a GM or one of the participants - and a
        // client that is neither has nobody here to hold still.
        if (!incidentParticipants().includes(actor.id)) return false;

        return refusal(keyed, "cannotLeave", game.i18n.localize("DRPG.Murder.cannotLeave"));
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
 * `mover` is the one `crossingVerdict` was handed (E12 C12): the primary judging a player's
 * arrival is a GM, and asks of the player whether they are the Mastermind and are a GM.
 *
 * `via: "passage"` (E79 C3; the E79 plan's P7-0) is a step through a secret passage the character
 * knows, and it skips one rule only: the key to somebody's bedroom, since a passage into a bedroom
 * is the way in without one. A GM's lock, a seal and the chain stand, and so does the courtroom,
 * which `crossingVerdict` asks below this.
 *
 * @returns {false|string} false when the move is allowed, otherwise the reason.
 */
function restrictedFrom(actor, to, scene, mover = null, { via = null, keyed = false } = {}) {
    try {
        if (isChained(actor)) return refusal(keyed, "chained", game.i18n.localize("DRPG.Calls.chainedBlocked"));
        if (to && !(mover ? mover.mastermind : iAmTheMastermind())) {
            if (isLocked(scene, to)) return refusal(keyed, "doorLocked", game.i18n.localize("DRPG.Move.locked"));
            if (isSealed(to)) return refusal(keyed, "roomSealed", game.i18n.format("DRPG.Calls.sealedBlocked", { room: to }));
            // Somebody's bedroom. The owner walks in; anybody else needs the
            // key they were given - see the note on keys in vault.mjs. A GM
            // moving a token is not standing in the fiction and is never
            // stopped by a door.
            if (via !== "passage" && !(mover ? mover.gm : game.user.isGM) && bedroomShut(actor, scene, to)) {
                return refusal(keyed, "cannotNow", game.i18n.format("DRPG.Vault.keyMissing", { room: to }), "bedroomShut");
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
    // A room a breach forced (E15 part 2 C4) is locked to nobody until its wall is given back: the lock stays set in
    // Room Setup and holds again then.
    return Boolean(roomFlag(scene, room, ROOM_FLAGS.locked)) && !roomBroken(scene, room);
}

/**
 * Is this somebody else's bedroom, and are they carrying no key to it?
 *
 * The rule is bedroom-keys.mjs's, the one game.drpg's answer and the GMs' key count read (vault.mjs `mayEnterBedroom`,
 * `keysHeldBy`; E14 part 1 C2): a key in a stash opens nothing (S08-31), and in the Investigation a dead owner's room
 * opens once the death is published (S08-55, D15). This reads the world it is handed, synchronously, as the veto inside
 * `preUpdateToken` must: the owner as the room's pieces carry it on the mover's scene (as `isLocked`), the clock, the
 * owner's published death (`isDeceased`: a death the GMs keep opens no door), and the mover's items - the document on
 * the mover's browser, and on the primary the student `judgeArrival` hands in, its items as the GMs' mark holds them
 * (`itemsHeldNow`), so a key's room or place a player's browser wrote and the audit has not let stand opens nothing there.
 */
function bedroomShut(actor, scene, to) {
    // A bedroom a breach forced (E15 part 2 C4; E14's Q1 of 18.10: "bez klucza tunelem i breach") opens to everyone.
    if (roomBroken(scene, to)) return false;
    const owner = to ? roomFlag(scene, to, ROOM_OWNER_FLAG) : null;
    return bedroomShutTo({ actorId: actor?.id ?? null, room: to, ownerId: owner, keys: keyRooms(actor?.items),
        phase: getClock().phase, ownerDead: Boolean(owner) && isDeceased(game.actors?.get(owner)) });
}

/* ------------------------------------------------------------------------------------------------------------
 * THE SECRET PASSAGES, AS THE VERDICT READS THEM (E79 C3, 14.10.2026; the E79 plan's P5-0 and P7-0).
 *
 * A passage is a stretch of a wall (passages.mjs); which rooms it joins is read off the map, not off the
 * GMs' record of it - a player's copy names no room, and a room renamed since the passage was made is
 * still the room on each side. From the stretch's middle the hit test (`piecesAt`) is asked outward on
 * each side, at the fractions of a square `neighbourBeyond` steps out at for a doorway (fog-doorways.mjs:
 * that file reads this one, so the four numbers are written here again rather than imported), on the
 * floor asked. A side where no room is found joins nothing.
 * ------------------------------------------------------------------------------------------------------------ */
const PASSAGE_SIDES = [0.35, 0.6, 0.85, 1];

/**
 * The room on each side of a passage's stretch `{ x1, y1, x2, y2 }` on `level`, `[a, b]`, null where none.
 * Exported since E79 C7 (15.10.2026): the sheet's 'Known passages' names a passage by these two rooms, and
 * the show's cards on the primary GM (passages-gm.mjs `sharePassage`) do the same.
 *
 * A tunnel or stairs (E80 C1), `{ ends: [{ x, y, level }, { x, y, level }] }`: the room each end stands in,
 * on that end's own floor - `level` is not read, since the two ends may be on two floors. Read off the map as
 * a stretch's sides are, so a room renamed since the tunnel was made is named as it is now. This names the
 * rooms a tunnel joins and nothing more: `reachableFrom` reads only the stretches a character may walk
 * through, so a token dragged from one end's room to the other's is a move between those rooms as ever.
 *
 * AT THE FLOOR'S HEIGHT, NOT AT 0 (H81-01, 20.10.2026; the owner's 1.2.80 table smoke: "tunele/schody sa
 * jednostronne"). A v14 region asks a point's elevation before its shape (`roomAt`'s note), and every point here was
 * asked at elevation 0 while a token is asked at its own (`roomOfToken`). On a floor whose rooms answer only above 0 -
 * an upper floor's, over a room drawn before the floors and so on every one - an end read another room than its
 * knower standing on it read, and `tunnelVerdict` refused the way back as "not at an end": R900's V14 map, red at
 * f0ea429 (the Attic's end read as the Dorm under it, its mark not drawn, the way up judged into the Dorm). Each point
 * is asked at its floor's height (rooms.mjs `floorElevation`), or at `elevation` when the caller holds the token's.
 *
 * AT THE TOKEN'S HEIGHT WHERE A TOKEN ASKS (H81 fix r1, 20.10.2026; the review's H81-C1-R3). A token upstairs that is
 * not at its floor's bottom - one 1.2.80's stairs left there at 0 (the write named the floor alone), or one a GM
 * dropped there - reads its own room at its own height (`roomOfToken`), and a read at the floor's bottom answered
 * another room for the same spot: 'Go through' let it through (`tunnelVerdict` reads the near end at the token's
 * height) while its end's mark was not drawn (fog-doorways.mjs `tunnelMarks`), and a passage in a wall upstairs was
 * judged from a side the token is not in (`reachableFrom`, `passageOpenFor`). So each read made for a token is at its
 * height: the veto's, the judge's and the Eclipse's crossings (`crossingVerdict`'s `elevation`), the outline drawn
 * for it (fog-reveal.mjs `flashOutline`'s) and its marks (`tunnelEndRooms`). R900's V14 map holds one at 0 upstairs.
 */
export function passageRooms(scene, passage, level = null, { elevation = null } = {}) {
    if (Array.isArray(passage?.ends)) {
        return [0, 1].map(i => endRoom(scene, passage.ends[i], elevation ?? floorElevation(scene, passage.ends[i]?.level ?? null)));
    }
    const dx = passage.x2 - passage.x1, dy = passage.y2 - passage.y1, length = Math.hypot(dx, dy);
    if (!(length > 0)) return [null, null];
    const grid = scene?.grid?.size ?? 100;
    const mx = (passage.x1 + passage.x2) / 2, my = (passage.y1 + passage.y2) / 2;
    const nx = -dy / length, ny = dx / length;
    const height = elevation ?? floorElevation(scene, level);
    return [1, -1].map(side => {
        for (const fraction of PASSAGE_SIDES) {
            const x = mx + side * nx * grid * fraction, y = my + side * ny * grid * fraction;
            const room = piecesAt(scene, x, y, height, level).map(region => region.name).sort()[0];
            if (room) return room;
        }
        return null;
    });
}

/** The room a tunnel's end `{ x, y, level }` stands in on its own floor, asked at `elevation`, or null (`passageRooms`). */
function endRoom(scene, end, elevation) {
    const x = Number(end?.x), y = Number(end?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return piecesAt(scene, x, y, elevation, end.level ?? null).map(region => region.name).sort()[0] ?? null;
}

/**
 * The rooms of a tunnel's end `{ x, y, level, far }` as a viewer standing at it reads them, `[here, far]` (H81 fix r1,
 * the review's H81-C1-R3; fog-doorways.mjs `tunnelMarks`): the end's at `elevation`, the viewer's token's height, and
 * the far end's at the height the token would land at there - that same height on the viewer's floor (`level`, else
 * the end's), the far floor's bottom on another (`landingElevation`, as `tunnelVerdict` reads them). No `elevation`:
 * each at its floor's bottom, as `passageRooms` reads a tunnel for no token.
 */
export function tunnelEndRooms(scene, end, { elevation = null, level = null } = {}) {
    const far = end?.far ?? null;
    if (elevation === null || !Number.isFinite(elevation)) return passageRooms(scene, { ends: [end, far] });
    const sameFloor = far?.level === null || far?.level === undefined || levelKey(far.level) === levelKey(level ?? end?.level ?? null);
    return [endRoom(scene, end, elevation), far ? endRoom(scene, far, sameFloor ? elevation : floorElevation(scene, far.level)) : null];
}

/**
 * The rooms this character reaches from `room` through the secret passages it knows on this scene and
 * floor, sorted: none for a character that knows none, which is nearly every crossing. On a GM's
 * browser the GMs' records name the knowers, and `mover.mastermind` passes every passage (the owner's
 * Q7). `known` is the suite's (R558). `elevation` is the height of the token whose crossing is asked, where its
 * `room` was read (H81 fix r1, `passageRooms`' note); none, the floor's bottom.
 */
export function reachableFrom(actor, room, scene, { level = null, mover = null, known, elevation = null } = {}) {
    if (!room || !scene?.id) return [];
    const far = new Set();
    for (const passage of openSegmentsFor(actor, scene.id, level, { mastermind: Boolean(mover?.mastermind), known })) {
        const sides = passageRooms(scene, passage, level, { elevation });
        if (!sides.includes(room)) continue;
        for (const other of sides) if (other && other !== room) far.add(other);
    }
    return [...far].sort();
}

/**
 * Whether a passage this character knows joins `from` to `to` on one floor - a crossing the connected-rooms
 * rule then lets through (`crossingVerdict`, eclipse.mjs `judgeEclipseCrossing`). A change of floor is the
 * stairs' (`crossingRefused`), never a passage's.
 */
export function passesThrough(actor, from, to, scene, floors = null, { mover = null, known, elevation = null } = {}) {
    if (!from || !to || from === to) return false;
    if (floors && levelKey(floors.from) !== levelKey(floors.to)) return false;
    return reachableFrom(actor, from, scene, { level: floors?.from ?? null, mover, known, elevation }).includes(to);
}

/**
 * Whether this passage, `{ id, x1, y1, x2, y2 }`, is a way out for this character now (the E79 plan's
 * P7-0, the owner's Q9): it knows the passage, and the rules that stop a step through it - a GM's lock, a
 * seal, the chain (`restrictedFrom` with `via: "passage"`) - stop none into the room beyond `from`, or into
 * either room when `from` is neither. The doorway glow draws a gap only where this is true (fog-doorways.mjs
 * `doorwayEdges`), so the frame says what the veto would answer. E51 generalises it to every door and takes
 * it over (the E79 plan's A10-9); R560 holds that it is written once. `known` is the suite's (R557). `elevation`
 * is the viewer's token's height, where `from` was read, for a passage in a wall (H81 fix r1, `passageRooms`' note);
 * a tunnel's ends are read at their floors' bottoms here, which end is the viewer's being no question this answers.
 */
export function passageOpenFor(actor, passage, scene, { from = null, level = null, mover = null, known, elevation = null } = {}) {
    if (!passage?.id || !scene?.id) return false;
    /* A tunnel (E80 C1): known among the tunnels of the scene, and the room at an end other than `from` open to the
       character by the same rules - the bedroom passed, as through a passage (design A10 Q1 = b). */
    if (Array.isArray(passage.ends)) {
        const knowsTunnel = tunnelEndsFor(actor, scene.id, null, { mastermind: Boolean(mover?.mastermind), known })
            .some(end => end.id === passage.id);
        const far = knowsTunnel ? passageRooms(scene, passage).filter(room => room && room !== from) : [];
        return far.length > 0 && far.every(room => !restrictedFrom(actor, room, scene, mover, { via: "passage" }));
    }
    const knows = openSegmentsFor(actor, scene.id, level, { mastermind: Boolean(mover?.mastermind), known })
        .some(seg => seg.id === passage.id);
    if (!knows) return false;
    const beyond = passageRooms(scene, passage, level, { elevation }).filter(room => room && room !== from);
    return beyond.length > 0 && beyond.every(room => !restrictedFrom(actor, room, scene, mover, { via: "passage" }));
}

/* ------------------------------------------------------------------------------------------------------------
 * 'GO THROUGH' A TUNNEL (E80 C2, 18.10.2026; the stage's P1-05 to P1-08). A tunnel is not walked: its two ends are
 * two squares anywhere on a scene, on one floor or two, and a knower standing at one end asks the primary GM to
 * move its token to the other (gm-bridge.mjs `passage.cross`, passages-gm.mjs `crossTunnel`). Whether it may is
 * the doors' question (`crossingVerdict`, keyed), never one of the tunnel's own: a lock, a seal, the chain, the
 * incident, the courtroom, the Eclipse's count and the price all stand, and only another's bedroom is passed, as
 * through a passage (design A10 Q1 = b). The sheet asks it first on the player's browser, for the sentence; the
 * primary asks it again of the world as it holds it, and its answer is the one that moves anything.
 * ------------------------------------------------------------------------------------------------------------ */

/* How near an end a token stands to go through: its centre on the end's square or on one of the eight around it.
   Chosen, not measured: the square a player clicks for an end is the one they stand a token on, and one square of
   slack is a token dropped beside it. In grid squares. */
const TUNNEL_REACH = 1;

/**
 * May this character go through this tunnel, `{ id, sceneId }`, from where `tokenDoc` stands? `{ near, far, from,
 * to }` - the two ends as `tunnelEndsFor` hands them and the rooms they stand in - or a refusal `{ code, text }`
 * (the keyed core's, and `notKnown`, `notAtPassage`, `oneWay` and `cannotNow` of its own). The tunnel is one the
 * character knows (the Mastermind every one: `mover.mastermind`), the token is on its scene with its centre within
 * `TUNNEL_REACH` of an end on that end's floor and in that end's room - of a one-way tunnel the end it is entered
 * from, else `oneWay` (H81-02; the Mastermind too: which way a tunnel goes is the map's, as a wall is), as the
 * copy or the GMs' record in `known` says - and the room at the other end is still on
 * the map; then the doors' rules decide, the crossing joined as through a passage (`joined`, `via`). `mover` and
 * `pay` are `crossingVerdict`'s: the primary asks with the sender's role and `pay: false`, since the price is
 * taken when the crossing is carried out (`settleCrossingOnGm`). `known` is the suite's (R597).
 */
export function tunnelVerdict(actor, passage, tokenDoc, { mover = null, known, pay = true } = {}) {
    if (!actor || !passage?.id) return { code: "notKnown", text: game.i18n.localize("DRPG.Bridge.why.notKnown") };
    const ends = tunnelEndsFor(actor, passage.sceneId, null, { mastermind: Boolean(mover?.mastermind), known })
        .filter(end => end.id === passage.id);
    if (!ends.length) return { code: "notKnown", text: game.i18n.localize("DRPG.Bridge.why.notKnown") };
    const away = { code: "notAtPassage", text: game.i18n.localize("DRPG.Bridge.why.notAtPassage") };
    const scene = tokenDoc?.parent ?? null;
    if (!scene || scene.id !== passage.sceneId) return away;
    const reach = (scene.grid?.size ?? 100) * TUNNEL_REACH + 1;
    const [centre] = centresOf(tokenDoc, tokenDoc);
    const level = levelKey(levelOf(tokenDoc));
    const here = roomOfToken(tokenDoc);
    /* The end's room asked as the token's own is, at the token's height (H81-01, `passageRooms`' note): two readings of
       one floor at two heights were what refused a knower standing on the Attic's end (R900). The far end's at the
       height the token will stand at there (`landingElevation`). */
    const height = ownElevation(tokenDoc);
    const at = ends.filter(end => Math.abs(centre.x - end.x) <= reach && Math.abs(centre.y - end.y) <= reach
        && (end.level === null || end.level === level) && endRoom(scene, end, height) === here);
    // An end it may be entered from first: a one-way tunnel's other end is its way out (H81-02, `oneWayOf`).
    const near = at.find(end => !end.exit) ?? at[0];
    if (!near || !here) {
        // What the table's check reads (LIVE-H81-01): with the Debug setting on, why no end was taken, end by end.
        debug(`'Go through' ${passage.id}: no end taken for ${tokenDoc?.name ?? tokenDoc?.id ?? "no token"} in ${here ?? "no room"} on floor ${level ?? "none"} `
            + `at height ${height}, centre ${Math.round(centre.x)},${Math.round(centre.y)}, reach ${reach}: `
            + ends.map(end => `end ${end.x},${end.y} on floor ${end.level ?? "any"} in ${endRoom(scene, end, height) ?? "no room"}`).join("; "));
        return away;
    }
    if (near.exit) return { code: "oneWay", text: game.i18n.localize("DRPG.Bridge.why.oneWay") };
    const to = endRoom(scene, near.far, landingElevation(tokenDoc, near.far.level));
    if (!to || isCorpse(actor)) return { code: "cannotNow", text: game.i18n.localize(to ? "DRPG.Move.dead" : "DRPG.Bridge.why.cannotNow") };
    const verdict = crossingVerdict(actor, here, to, scene, { from: near.level, to: near.far.level },
        { mover, pay, via: "passage", known, joined: true, keyed: true });
    return verdict === true ? { near, far: near.far, from: here, to } : verdict;
}

/** The refusals of `tunnelVerdict` that the sheet's 'Go through' says in the bridge's words (`DRPG.Bridge.why.<code>`). */
const TUNNEL_KEYED = Object.freeze(["notKnown", "notAtPassage", "oneWay", "doorLocked", "roomSealed", "chained", "cannotLeave",
    "trialLocked", "noBudget", "eclipseSpent"]);

/**
 * What the sheet's 'Go through' says of a `tunnelVerdict` refusal before it asks the primary GM: the key's words,
 * `DRPG.Bridge.why.<code>`, for the eight doors' codes, `notKnown` and `oneWay` (H81-02) - the words the bridge answers with, "that room"
 * for the room - and the verdict's own sentence only for a code with no such key (`cannotNow`, a corpse's
 * `DRPG.Move.dead`). E80 fix r1-G8, the review's E80-C2-2, E80-COR-3 and E80-G-6: the veto's own sentence named the
 * sealed room the sheet hides, and a spent Eclipse said the token "has been put back" when nothing moved. Pure (R614).
 */
export function tunnelRefusalText(verdict) {
    if (!verdict?.code) return "";
    return TUNNEL_KEYED.includes(verdict.code) ? game.i18n.localize(`DRPG.Bridge.why.${verdict.code}`) : String(verdict.text ?? "");
}

/**
 * The mark a tunnel crossing's own write carries (passages-gm.mjs `crossTunnel`, H81-14): `tunnelStepTarget` never
 * reads that write as a move onto an end. The landing may stand the token on the far end's square, and the write is
 * the primary GM's own - so where a GM moved the token, the primary would throw it straight back.
 */
export const TUNNEL_CROSSING = "drpgTunnelCrossing";

/*
 * The tokens this browser is placing itself through Foundry's own region teleport, by id, with how many such placings
 * of each are under way (H81 fix C3, 21.10.2026; the review's H81-C3-R1). The gather (call-world.mjs `gatherEveryone`),
 * the cast's placing at a season's start and on the return from the trial (`teleportInto`) and a Clean-up's body
 * (cleanup.mjs) hand `region.teleportTokens` no option of the module's, and whether v14's puts `teleport` or a displace
 * into the update it writes is not read (LIVE-H81-03). So the writer's own browser marks the tokens around the call,
 * and the sheet's trigger (sheet.mjs `onTunnelStep`) reads no move of a marked token as a step onto a tunnel's end. The
 * mark is read in the update's own hooks, which Foundry runs on the writer's browser before its update answers; a
 * teleport that answers before its update is written would not be covered - not read on v14 either.
 */
const placing = new Map();

/** Run `place` with `tokens` marked as placed by this browser (`placing`), and answer what it answers. */
export async function whilePlacing(tokens, place) {
    const ids = Array.from(tokens ?? [], token => token?.id).filter(Boolean);
    for (const id of ids) placing.set(id, (placing.get(id) ?? 0) + 1);
    try {
        return await place();
    } finally {
        for (const id of ids) {
            const left = (placing.get(id) ?? 1) - 1;
            if (left > 0) placing.set(id, left);
            else placing.delete(id);
        }
    }
}

/** Whether this browser is placing this token itself just now (`whilePlacing`). */
export function isPlacing(tokenDoc) {
    return Boolean(tokenDoc?.id) && placing.has(tokenDoc.id);
}

/**
 * Which tunnel a move of a token goes through, `{ id, end }`, or null (H81-13 and H81-14, 21.10.2026; the owner's call
 * of 21.10: "zeby przechodzenie przez tunele/passages/schody robilo sie zetonem na mapie lub klikiem na znacznik
 * tunelu", the token chosen - a GM's browser draws no mark, and a click on one cannot be measured headless). The move is
 * this browser's user's own (`userId`, Foundry's, is `me`) and changes x or y - a climb, a turn or a change of floor
 * alone is no step, so Foundry's own change of floor on stairs, whose two ends share an x and a y, never throws the
 * token back - and it ends with an end's point inside the token's centre square (a grid square about the token's
 * centre: not the one square of slack 'Go through' allows, `TUNNEL_REACH`, so a token dropped beside the mark goes
 * nowhere) on that end's floor, having started off that square or on another floor. Never a step: a write that places a
 * token - the crossing's own (`TUNNEL_CROSSING`), a put-back (`REVERT`, which the gather's own fallback writes too),
 * and an update that says it is a teleport or a displace. The module's region teleports (the gather, the cast's
 * placing, a Clean-up's body) say neither: their writer's browser marks their tokens instead (`whilePlacing`, read in
 * sheet.mjs `onTunnelStep`; H81 fix C3, the review's H81-C3-R1, which found the claim "every placing write of the
 * module is one" false for those three). Which options v14's region teleport and a GM's own drag or teleport at a v14
 * table carry is not read: LIVE-H81-03. `ends` are
 * passages.mjs `tunnelEndsFor`'s for the token's character (none: it knows no tunnel); `from` and `to` are
 * `{ x, y, level, width, height }`, the token's top-left before the move and where it came to rest. Of two ends on the
 * square, one it may be entered from first; a one-way tunnel's way out is still named, and 'Go through' refuses it in
 * its own words. Pure (R908).
 */
export function tunnelStepTarget({ changes = {}, options = {}, from = null, to = null, ends = [], grid = 100, userId = null, me = null } = {}) {
    if (!userId || userId !== me || !from || !to) return null;
    if (changes?.x === undefined && changes?.y === undefined) return null;
    if (options?.[TUNNEL_CROSSING] || options?.[REVERT] || options?.teleport === true || options?.movementAction === "displace") return null;
    const size = Number(grid) > 0 ? Number(grid) : 100;
    const centre = spot => ({ x: Number(spot.x) + (Number(spot.width) || 1) * size / 2, y: Number(spot.y) + (Number(spot.height) || 1) * size / 2,
        level: levelKey(spot.level ?? null) });
    const was = centre(from), now = centre(to);
    const on = (at, end) => Math.abs(end.x - at.x) <= size / 2 && Math.abs(end.y - at.y) <= size / 2
        && (end.level === null || end.level === undefined || end.level === at.level);
    const hit = (Array.isArray(ends) ? ends : []).filter(end => end?.id && on(now, end) && !on(was, end));
    const end = hit.find(e => !e.exit) ?? hit[0];
    return end ? { id: end.id, end } : null;
}

/**
 * Where a token that goes through lands, `{ x, y, level }` (its top-left corner): the far end's square, or else
 * the nearest square around it, ring by ring up to three out, whose centre is in `room` on the end's floor and
 * which no other token on that floor covers - nearest first, then the higher, then the one further left. None
 * free: the end's square. Chosen, not measured (the stage's numbers: "the nearest free square of the end's room").
 * A square's room is asked at the height the token will stand at there (`landingElevation`, H81-01).
 */
export function tunnelLanding(tokenDoc, far, room) {
    const scene = tokenDoc?.parent ?? null;
    const grid = scene?.grid?.size ?? 100;
    const w = (tokenDoc?.width ?? 1) * grid, h = (tokenDoc?.height ?? 1) * grid;
    const level = far?.level ?? null;
    const height = landingElevation(tokenDoc, level);
    const base = { x: Number(far?.x) - w / 2, y: Number(far?.y) - h / 2 };
    const others = Array.from(scene?.tokens ?? []).filter(t => t?.id !== tokenDoc?.id
        && (level === null || levelKey(levelOf(t)) === level));
    const free = spot => !others.some(t => {
        const tw = (t.width ?? 1) * grid, th = (t.height ?? 1) * grid;
        return t.x < spot.x + w && spot.x < t.x + tw && t.y < spot.y + h && spot.y < t.y + th;
    });
    const spots = [];
    for (let ring = 0; ring <= 3; ring++) {
        for (let dy = -ring; dy <= ring; dy++) {
            for (let dx = -ring; dx <= ring; dx++) {
                if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
                const spot = { x: base.x + dx * grid, y: base.y + dy * grid };
                const inside = piecesAt(scene, spot.x + w / 2, spot.y + h / 2, height, level).map(region => region.name).sort()[0] === room;
                if (inside && free(spot)) spots.push({ ...spot, d: Math.hypot(dx, dy) });
            }
        }
    }
    spots.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
    const [best] = spots;
    return { x: best?.x ?? base.x, y: best?.y ?? base.y, level };
}

/** A token's own height, as `regionsAt` asks a room at it: its elevation, 0 where it has none. */
function ownElevation(tokenDoc) {
    return Number.isFinite(tokenDoc?.elevation) ? tokenDoc.elevation : 0;
}

/**
 * The height a token stands at once a tunnel puts it on `level` (H81-01, 20.10.2026): its own on its own floor, and on
 * another the floor's (rooms.mjs `floorElevation`) - what passages-gm.mjs `crossTunnel` writes with the floor, so the
 * token is asked its room upstairs as the end it lands on is (`passageRooms`). Until H81 the write named the floor
 * alone and the token kept the height of the floor it left. Chosen, not measured: that v14 stands a token on a floor
 * at its bottom, as this module reads it, is LIVE-H81-01.
 */
export function landingElevation(tokenDoc, level) {
    if (level === null || level === undefined || levelKey(levelOf(tokenDoc)) === levelKey(level)) return ownElevation(tokenDoc);
    return floorElevation(tokenDoc?.parent ?? null, level);
}

/** A token's centre at each spot `{ x, y }` (its top-left corner), measured with its own scene's grid as `regionsAt` measures it. */
function centresOf(tokenDoc, ...spots) {
    const size = tokenDoc?.parent?.grid?.size ?? canvas?.grid?.size ?? 100;
    const w = ((tokenDoc?.width ?? 1) * size) / 2, h = ((tokenDoc?.height ?? 1) * size) / 2;
    return spots.map(spot => ({ x: Number(spot?.x) + w, y: Number(spot?.y) + h }));
}

/**
 * Which room a point falls inside, using the same regions as roomOfToken.
 *
 * On the scene of the token it is asked for, and no other (E12 C2a): every
 * caller hands a token document in, and the camera's scene it fell back to
 * answered for a token on another map with the rooms of the map on screen.
 *
 * And on one floor (E12 C9, audit S07-45): `level`, the token's own unless the
 * caller names the floor it is going to. A room on another floor is not
 * asked. Until 1.2.74 a footprint was a room on every floor, and a token on the
 * ground floor under the Attic read the Attic (scenario 66 G1, 11.10.2026).
 */
export function roomAt(x, y, tokenDoc, level = levelOf(tokenDoc)) {
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
    const regions = regionsAt(scene, x, y, tokenDoc, level);
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
function regionsAt(scene, x, y, tokenDoc, level = levelOf(tokenDoc)) {
    if (!scene?.regions?.size) return [];

    const size = scene.grid?.size ?? canvas?.grid?.size ?? 100;
    const cx = x + ((tokenDoc?.width ?? 1) * size) / 2;
    const cy = y + ((tokenDoc?.height ?? 1) * size) / 2;
    const elevation = Number.isFinite(tokenDoc?.elevation) ? tokenDoc.elevation : 0;
    return piecesAt(scene, cx, cy, elevation, level);
}

/**
 * The room pieces on `level` (rooms.mjs `onLevel`; null is every floor) that hold the point
 * (`cx`, `cy`) - `regionsAt` for a point that is already a centre, which `stairLinks` asks too.
 */
function piecesAt(scene, cx, cy, elevation, level) {
    const named = roomPieces(scene).filter(region => onLevel(region, level));
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
    //
    // NOT ACROSS FLOORS, AND NOT OUTSIDE A SHAPE THAT CAN BE ASKED (E12 C9, audit
    // S07-22). Until 1.2.74 the fallback ran over every room piece on the scene:
    // `testPoint` rejecting a point on the ground floor sent it to the box of the
    // room above, and the box of an L-shaped room named the corner it does not
    // cover. It runs over `named`, this floor's pieces, and asks a piece's own
    // polygon tree (`insideShape`) before its box.
    if (!found.length && asked === named.length && named.length) {
        for (const region of named) {
            if (insideShape(region, cx, cy)) found.push(region);
        }
        if (found.length) {
            debug(`Region hit test rejected every room at (${Math.round(cx)}, ${Math.round(cy)}); `
                + `fell back to bounds and found ${found.map(r => r.name).join(", ")}.`);
        }
    }

    return found;
}

/**
 * The fallback's own hit test: the piece's polygon tree when it has one that can be asked - it
 * holds the shapes without the elevation band `testPoint` puts in front of them - and its box
 * only when it has none. `polygonTree.testPoint` is the name the plan gives; whether a v14 region
 * carries it was not read off a table (LIVE-E12-03), and a region without it is asked by its box.
 */
function insideShape(region, x, y) {
    const tree = region?.polygonTree;
    if (typeof tree?.testPoint === "function") return Boolean(tree.testPoint({ x, y }));
    return containedBy(region, x, y);
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

/**
 * Remember where every token starts, so the first drag is judged correctly.
 *
 * EVERY PLACE SCENE'S TOKENS, NOT THE CANVAS'S (E12 fix r2-S1, 11.10.2026; review round 2
 * O3). It read `canvas.tokens.placeables`, so a browser that drew another scene forgot
 * every token of the one it left, and the next move of such a token was "never seen" - free,
 * whatever it crossed. Scenario 66 R moves p1's own token on the school with p1's camera on
 * the Annex: at the parent the crossing was not announced. Read off the documents, the cache
 * no longer depends on what this browser draws; `canvasReady` stays the moment it is rebuilt.
 */
function primeRoomCache() {
    lastRoom.clear();
    lastPosition.clear();
    for (const scene of placeScenes()) {
        for (const tokenDoc of scene.tokens ?? []) {
            lastRoom.set(tokenDoc.id, roomOfToken(tokenDoc));
            lastPosition.set(tokenDoc.id, spotOf(tokenDoc));
        }
    }
}

/**
 * Settle a route that crossed at least one border: who pays, the Eclipse's
 * veto, the charge switch, and one charge per crossing.
 *
 * @returns {Promise<boolean|undefined>} true when the route stands, false when
 *   a crossing of it was refused (E77 C2: `onUpdateToken` announces either),
 *   undefined when another browser settles it.
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
    /* THE PRIMARY'S CHARGE IS A STEP OF THE CHARACTER'S KEY (E17 C0, 26.10.2026; A10: "a door move the primary settles and
       a `passage.cross` of one character share one key"). With no owner connected the primary pays the route, and a
       tunnel's crossing of the same character (passages-gm.mjs `crossTunnel`) read the same budget or the same Eclipse
       count beside it; both are steps of `crossingKey(actor.id)` now, and the route's Eclipse crossings are counted in
       this step (`countCrossingInStep`), not in a second one of the key it holds. A route the owner's browser pays stays
       the owner's, as at Base: its count is the primary's step through `eclipse.move`, and its spend the owner's
       stamped write (design note 20). */
    if (owner) return chargeRoute(tokenDoc, actor, { before, previous, crossings });
    return serialWrite(crossingKey(actor.id), () => chargeRoute(tokenDoc, actor, { before, previous, crossings }, {
        record: async (who, to) => {
            const { countCrossingInStep } = await import("./eclipse.mjs");
            const out = await countCrossingInStep(who.id, { to });
            return out?.refused ? false : out ? true : null;
        }
    }));
}

/** `settleRoute`'s charge, on the browser that pays it; `record` is the primary's count inside its step of the key. */
async function chargeRoute(tokenDoc, actor, { before, previous, crossings }, { record = null } = {}) {
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
        for (const [from, to, floors] of crossings) {
            const allowed = await judgeEclipseCrossing(actor, from, to, tokenDoc.parent, floors, { elevation: ownElevation(tokenDoc), ...(record ? { record } : {}) });
            if (!allowed) {
                await sendBack(tokenDoc, previous, before);
                return false;
            }
        }
        if (tokenDoc) lastPosition.set(tokenDoc.id, spotOf(tokenDoc));
        return true;
    }

    // The cost, and only the cost, is what the setting governs. Everything
    // above - the room cache, the Eclipse - has to keep running, or turning
    // the setting back on would find every token's remembered room stale and
    // charge for a crossing that happened while it was off.
    if (!game.settings.get(MODULE_ID, SETTINGS.chargeMovement)) {
        if (tokenDoc) lastPosition.set(tokenDoc.id, spotOf(tokenDoc));
        return true;
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
    // On the floor the step reached (E12 fix r2-H1; early review EARLY-C9-2): a room's centre
    // without its floor put a route refused at the stairs back at the Hall's x and y upstairs.
    /* ON THE ROUTE'S OWN SPOT, NOT THE ROOM'S CENTRE (E79 fix r3-G2, 1.2.79; review r3, SEC S2 = cor B). The
       room paid for was put back at its centre (`positionIn`), where the token never stood: the GMs' wall
       audit judges that put-back as a move (movement-audit.mjs; its record holds no centre) along the straight
       step from the route's end to the centre, and the security probe F3 - three rooms in a row, a door in the
       middle of each wall - read it crossed on the plain wall beside the second door: a row and a warn naming
       the player in "log" mode, and in "sendBack" the token sent on to the route's end, the room not paid for.
       The spot the drag stood on last in that room (`notePathRoom`) is a landing every GM saw, so the GMs'
       record holds it (`recentPositions`: for a minute, past the ring's eight sightings as the room's newest since
       E79 fix r4-G4, `keptSightings`, scenario 66 W7) and the audit and the judge of arrivals take
       the put-back as a send-back to it, by the rule they already keep and with no centre for a console to aim
       at (round 2's SEC M1). Scenario 66 W6: red at 647c8b0 in both modes. */
    let standing = previous;
    for (const [from, to, , spot] of crossings) {
        const paid = await chargeForCrossing(actor, from, to, tokenDoc, standing);
        if (!paid) return false;
        standing = spot ?? standing;
    }
    return true;
}

/**
 * A token's update, judged (`judgeMove`), and its route announced on the update that names where it ends
 * (E77 C2, 13.10.2026; the A8 design's step 5; E79 C14, 1.2.79).
 *
 * `Hooks.callAll("drpgRouteSettled", { tokenDoc, accepted, room, again, provisional })` is client-local: `accepted: true`
 * when the move stands (a GM's, a Monokuma's, a token's first sight, a move inside a room, an Eclipse's allowed
 * crossings, the charge switched off, every crossing paid); `accepted: false` when the module put the token where
 * it stands now (its own REVERT - a refusal's put-back, the bridge's, a gather - on every browser) or refused a
 * crossing it did not put back (`takeMove` paid nothing). `room` is the room at the spot the update names
 * (`destinationOf`), not where the token's position reads at the hook. A route whose put-back is on its way, or
 * landed before its judgement ended (`putBacksSent`, E79 fix r4-G4), is not announced, whoever's refusal it is - this browser's charge or, on the primary GM, the GMs' wall audit
 * (`noteGmPosition`, which marks it before the judge's first `await` resumes; until E79 C14 the audit's put-back
 * of a move inside one room was announced as accepted first, scenario 76 D N13): the put-back is, when it lands,
 * so a listener never reads the token in a room it was refused. Nothing fires for a change that is no move (a
 * GM's included, E77 fix r1-G2), or for a step of a drag still in flight (`movement.pending.waypoints`). On a
 * browser that does not settle the route (another one charges it) it fires only where the token's actor is
 * owned: at once for a route of one update, and for a route that had steps pending once the token has been quiet
 * for `ROUTE_QUIET_MS` (`untilQuiet`, E77 fix r1-G2), or `false` when its put-back lands. `provisional` is false
 * for every announcement but the first of those, a route of one update another browser charges, where it is a
 * promise of whether the route stood (`judgeMove`'s note, review round 3 cor D): a screen draws the room at once,
 * and a write of the GMs' records waits on it. On the primary GM it is false at once for a route it reads as refused
 * (`refusedOnPrimary`, E79 fix r4-G4), and so is the `provisional` of a route with steps pending that it announces
 * after quiet.
 *
 * The at-rest read (`recheckAtRest`) announces once more, with `again: true` when this browser announced that
 * update already, only where the token comes to rest in another room than the one announced; a listener takes
 * the second as the correction of the first (the room tile repaints, the primary's watch on the passages asks
 * again; the move card is the charge's, posted once per crossing paid).
 *
 * The owner's report of 15.10.2026, on 1.2.78: "entering a room reads too late". Read headless at 33ea568 (the
 * E79 part-4 probe, once): a co-owner's browser - the GM's, for a player's route - announced a route of one update
 * 1500 ms after it (`ROUTE_QUIET_MS`), and a hook that read the token at its drag's start announced the room left
 * and then, at rest, the room entered. Scenario 66 N13 reads both since C14 (the numbers are in its comments);
 * the wait for a real animation and a v14 drag's last update are LIVE-E79-19. Until E77 C2 a reader had only the
 * raw update, which reaches every browser before the refusal and its put-back (the A8 design's CB-8). Scenario 66
 * W2-W5 and N13 count the announcements on the mover's browser and two others, scenario 74 C on a co-owner's;
 * R506 reads that this is the one place that fires it.
 */
async function onUpdateToken(tokenDoc, changes, options, userId, { atRest = false, of = 0 } = {}) {
    restartQuiet(tokenDoc.id);
    const turn = atRest || !isMoveChange(changes) ? 0 : (moveTurns.get(tokenDoc.id) ?? 0) + 1;
    if (turn) {
        moveTurns.set(tokenDoc.id, turn);
        landing.delete(tokenDoc.id);
    }
    const route = {}, sent = putBacksSent.get(tokenDoc.id) ?? 0;
    if (turn) route.refused = readRefusal(tokenDoc.id, turn);
    let accepted;
    try {
        accepted = await judgeMove(tokenDoc, changes, options, userId, route, { atRest });
    } catch (err) {
        error("Movement charge failed", err);
    } finally {
        route.refused?.(false);
        if (unsettled.get(tokenDoc.id) === route && !putBack.has(tokenDoc.id)) unsettled.delete(tokenDoc.id);
    }
    if (turn) recheckAtRest(tokenDoc, changes, options, userId, turn).catch(err => error("Movement re-read at rest failed", err));
    if (putBack.has(tokenDoc.id) || (putBacksSent.get(tokenDoc.id) ?? 0) !== sent) return;
    if (accepted !== true && accepted !== false) return;
    const spot = route.landing ?? spotOf(tokenDoc), room = roomAtSpot(tokenDoc, spot);
    const again = atRest && announced.get(tokenDoc.id)?.turn === of;
    announced.set(tokenDoc.id, { turn: turn || of, room });
    if (turn && moveTurns.get(tokenDoc.id) === turn) landing.set(tokenDoc.id, { turn, spot });
    Hooks.callAll("drpgRouteSettled", { tokenDoc, accepted, room, again, provisional: route.stands ?? false });
}

/**
 * The move judged once more where the token came to rest (`whenAtRest`, whose note has the owner's report of
 * 14.10.2026), as the same update - a GM's, a put-back or a player's - and announced as it would have been: when no
 * newer move of the token reached this browser meanwhile, no put-back is on its way, and the character stands in
 * another room than the one announced for that update (`announced`; the one its update recorded, `lastRoom`, where
 * this browser announced none of it), or a step of its drag is still noted (`pathRooms`) with no last step behind
 * it. A route left pending waits `ROUTE_QUIET_MS` from its last update first, as a co-owner's wait for quiet does,
 * so a drag whose last step is merely slow is not cut in two. Everywhere else - every route the hook read where it
 * ended, every route of the harness - it finds the room announced, takes the spot it stands on as the last in that
 * room, and announces nothing.
 */
async function recheckAtRest(tokenDoc, changes, options, userId, turn) {
    await whenAtRest(tokenDoc);
    const id = tokenDoc.id;
    if (pathRooms.has(id)) await pause(ROUTE_QUIET_MS);
    if (moveTurns.get(id) !== turn || putBack.has(id) || unsettled.has(id)) return;
    if (landing.get(id)?.turn === turn) landing.delete(id);
    if (tokenDoc.actor?.type !== "character" || !lastRoom.has(id)) return;
    const told = announced.get(id)?.turn === turn ? announced.get(id) : null;
    if (!pathRooms.has(id) && roomOfToken(tokenDoc) === (told ? told.room : lastRoom.get(id))) {
        if (told) lastPosition.set(id, spotOf(tokenDoc));
        return;
    }
    debug(`Route of ${tokenDoc.name} read again at rest: recorded ${lastRoom.get(id) ?? "no room"}, `
        + `standing in ${roomOfToken(tokenDoc) ?? "no room"}.`);
    await onUpdateToken(tokenDoc, changes, options, userId, { atRest: true, of: turn });
}

/**
 * Whether a token's update stands: true, false when it was refused or put back, undefined when there is
 * no route to announce here (`onUpdateToken`). `route` is the update's own mark, should it mark one.
 * `atRest` (`recheckAtRest`) judges the token where it stands, its waypoints pending or not.
 */
async function judgeMove(tokenDoc, changes, options, userId, route = {}, { atRest = false } = {}) {
    // Where the update puts the token (`destinationOf`, E79 C14), and where it stands at rest.
    const landed = route.landing = atRest ? spotOf(tokenDoc) : destinationOf(tokenDoc, changes);
    const after = roomAtSpot(tokenDoc, landed);

    // Our own revert: record where it landed, charge nothing.
    if (options?.[REVERT]) {
        endQuiet(tokenDoc.id);
        lastRoom.set(tokenDoc.id, after);
        lastPosition.set(tokenDoc.id, landed);
        putBack.delete(tokenDoc.id);
        unsettled.delete(tokenDoc.id);
        return false;
    }

    // A GM moved it: always free, never reverted.
    //
    // Without this, a token whose owner is offline falls through to
    // "the primary GM pays" below - so a GM tidying the map was charged for
    // it and had the token teleported back. It only showed on absent
    // players' tokens, which is why one character misbehaved and another
    // did not.
    // A GM's write that moves nothing is no route (E77 fix r1-G2): it answered true here and was announced,
    // mid-judge of a refused route the refused room (review round 1 cor F4). It still records the spot, as
    // it always did. A GM's move ends whatever this browser held of the token's last route, a put-back
    // that never landed included (cor F3).
    if (game.users.get(userId)?.isGM) {
        lastRoom.set(tokenDoc.id, after);
        lastPosition.set(tokenDoc.id, landed);
        if (!isMoveChange(changes)) return;
        endQuiet(tokenDoc.id);
        putBack.delete(tokenDoc.id);
        unsettled.delete(tokenDoc.id);
        return true;
    }

    // Only a move can cross a boundary - and a change of floor is one (E12 C9; the veto's note).
    if (!isMoveChange(changes)) return;

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
    if (!atRest && tokenDoc.movement?.pending?.waypoints?.length) {
        notePathRoom(tokenDoc.id, roomOfToken(tokenDoc), levelOf(tokenDoc), spotOf(tokenDoc));
        return;
    }

    // Judged on this browser from here, before the first `await`: a hook of the same update that runs after
    // this one reads the spot before the route (`settledSpot`) until it is announced, or until its put-back
    // lands - scenario 66 W4 reads it from such a hook at the refused update and at the put-back.
    endQuiet(tokenDoc.id);
    putBack.delete(tokenDoc.id);
    route.spot = lastPosition.get(tokenDoc.id) ?? null;
    unsettled.set(tokenDoc.id, route);

    // Taken - not read - so every `return` below leaves nothing behind for
    // the next drag to inherit.
    const path = takePath(tokenDoc.id);

    const actor = tokenDoc.actor;
    if (!actor || actor.type !== "character") return true;

    // Monokumas walk where they like. The guide has them moving around the
    // map freely between interventions; they have no action economy to
    // spend and no walls to respect.
    const { isMonokuma } = await import("./monokuma.mjs");
    if (isMonokuma(actor)) {
        lastRoom.set(tokenDoc.id, after);
        lastPosition.set(tokenDoc.id, landed);
        return true;
    }

    // "Never seen this token" and "was outside every room" are different
    // states. Without that distinction the first drag after a token appears
    // looks like a crossing and wrongly costs a Move.
    const known = lastRoom.has(tokenDoc.id);
    const before = lastRoom.get(tokenDoc.id) ?? null;
    const previous = lastPosition.get(tokenDoc.id) ?? null;

    if (!known) {
        lastRoom.set(tokenDoc.id, after);
        lastPosition.set(tokenDoc.id, landed);
        return true;
    }

    // Every boundary this drag actually crossed, in the order it crossed
    // them. Ending where you started is no longer the same as going
    // nowhere: the route is what is charged for.
    const crossings = crossingsAlong({ room: before, level: previous?.level ?? null }, path,
        { room: after, level: levelOf(tokenDoc), spot: landed });

    // Nothing crossed - a move inside one room, or a scene with no regions
    // at all: free. Remember the new spot so a later refused crossing snaps
    // back to somewhere sensible.
    if (!crossings.length) {
        lastPosition.set(tokenDoc.id, landed);
        lastRoom.set(tokenDoc.id, after);
        return true;
    }

    lastRoom.set(tokenDoc.id, after);

    const settled = await settleRoute(tokenDoc, actor, { before, previous, crossings });
    if (settled !== undefined) route.refused?.(settled === false);
    if (settled !== undefined || !actor.isOwner) return settled;
    // Another browser settles it. A route of one update stands where it names, at once (E79 C14; the owner's
    // "entering a room reads too late": the GM's browser announced such a route 1500 ms after it, waiting for
    // quiet). A refusal of that route by the browser that charges it means its budget moved between that
    // browser's veto and its charge; its put-back is announced here when it lands, after the room it refused.
    // A route that had steps pending, which the charging browser may refuse at a later crossing (scenario 74
    // C3, 66 W4), still waits for quiet (`awaitingQuiet`). Accepted, it stands where it stopped: the spot the
    // settling browser's charge records there (`chargeForCrossing`), and this browser's next route starts
    // from it.
    // Announced at once, it is still provisional here (review round 3, 17.10.2026, cor D): `route.stands`
    // settles true once the token is quiet for `ROUTE_QUIET_MS`, false when the put-back, a GM's move or the
    // token's next route ends the wait first (`endQuiet`). A listener that acts on the GMs' records, not on
    // what a screen shows, waits on it (passages-gm.mjs `onRouteSettled`): until then the primary revoked a
    // passage kept "until they leave the room" on a route its charge then refused and put back (scenario 76 E).
    // On the primary GM a route it reads as refused (`refusedOnPrimary`, E79 fix r4-G4) settles false at once,
    // whenever its put-back lands; the quiet bound is kept for every other reading and every other browser.
    const refused = refusedOnPrimary(tokenDoc, actor, crossings);
    route.refused?.(refused);
    if (!path.length) {
        lastPosition.set(tokenDoc.id, landed);
        route.stands = refused ? Promise.resolve(false) : untilQuiet(tokenDoc).then(quiet => quiet === true);
        return true;
    }
    const quiet = await untilQuiet(tokenDoc);
    if (quiet) lastPosition.set(tokenDoc.id, spotOf(tokenDoc));
    if (quiet && refused) route.stands = Promise.resolve(false);
    return quiet;
}

/*
 * THE PRIMARY'S OWN READING OF A ROUTE ANOTHER BROWSER CHARGES (E79 fix r4-G4, 1.2.79; review round 4, cor D residual).
 * Whether the route stood was the quiet bound's answer alone: true once the token was quiet for `ROUTE_QUIET_MS`, so a
 * put-back that landed later - a loaded browser, a slow server - left a refused route standing, and the primary's
 * `revokeLeavers` (passages-gm.mjs `onRouteSettled`) took a passage kept "until they leave the room" for a step that
 * never stood (scenario 76 E, its put-back held 2 s: red at 0641c4c). The fix list asked for the primary's own
 * `judgeArrival` verdict. That verdict judges the rules of a crossing and never its price (it asks `crossingVerdict`
 * with no `pay`): on that route it read the step lawful, since the refusal was the charge's, for want of a Move - so
 * it is one of the two readings here. The other is the charge's own question (`chargeForCrossing`, `takeMove`) asked
 * of the same flags on the GM's copy of the student as the update reaches it, before the charging browser's spend can:
 * a free Move, the Sprints, the Bursts and the actions, one a crossing. True only for a route this browser reads as
 * refused; an Eclipse (`judgeEclipseCrossing` counts what the GMs hold of it) and a route the rules let through
 * and the charge then refuses for a budget that moved meanwhile still wait for quiet.
 */
function refusedOnPrimary(tokenDoc, actor, crossings) {
    if (!isPrimaryGm()) return false;
    if (standings.get(tokenDoc.id)?.lawful === false) return true;
    if (isEclipse() || !game.settings.get(MODULE_ID, SETTINGS.chargeMovement)) return false;
    const budget = (hasFreeMove(actor) ? 1 : 0) + freeMovesLeft(actor) + freeActionsLeft(actor) + actionsLeft(actor);
    return budget < crossings.length;
}

/**
 * Wait for a route another browser settles (`awaitingQuiet`): true once `ROUTE_QUIET_MS` pass with no
 * update of the token, undefined when something that announces itself ends it first - the put-back, a
 * GM's move, the token's next route (`endQuiet`). Each update of the token starts the wait again
 * (`restartQuiet`, from `onUpdateToken`): a drag begun before the last route was quiet would otherwise
 * have that route announced while the token stood on the drag's pending step, and the tile draw a room
 * the drag was only passing (scenario 74 C4).
 */
function untilQuiet(tokenDoc) {
    endQuiet(tokenDoc.id);
    return new Promise(resolve => {
        awaitingQuiet.set(tokenDoc.id, { resolve, timer: null });
        restartQuiet(tokenDoc.id);
    });
}

function restartQuiet(tokenId) {
    const wait = awaitingQuiet.get(tokenId);
    if (!wait) return;
    clearTimeout(wait.timer);
    wait.timer = setTimeout(() => {
        awaitingQuiet.delete(tokenId);
        wait.resolve(true);
    }, ROUTE_QUIET_MS);
}

function endQuiet(tokenId) {
    const wait = awaitingQuiet.get(tokenId);
    if (!wait) return;
    clearTimeout(wait.timer);
    awaitingQuiet.delete(tokenId);
    wait.resolve(undefined);
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
 *
 * A step is a room and the floor it was read on (E12 C9); a step to the same
 * room on another floor - up a stairwell - is not noted, as it costs nothing.
 * Each step keeps the newest spot the drag stood on in its room (`spot`, E79 fix
 * r3-G2): a route refused at a later crossing is put back there (`settleRoute`).
 */
function notePathRoom(tokenId, room, level = null, spot = null) {
    if (!room) return;
    const seen = pathRooms.get(tokenId);
    if (!seen) {
        pathRooms.set(tokenId, [{ room, level, spot }]);
        return;
    }
    const last = seen[seen.length - 1];
    if (last.room !== room) seen.push({ room, level, spot });
    else if (spot) last.spot = spot;
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
 *
 * Every step is `{room, level, spot?}` (E12 C9) and `crossingCost` prices it; each
 * crossing handed on is `[from, to, {from, to}, spot]`, the two room names, the
 * floor of each end (E12 fix r2-H1), for the stairs rule on the Eclipse's road,
 * and the spot the route stood on past it (`notePathRoom`; E79 fix r3-G2), where
 * a route refused at the next crossing is put back.
 */
function crossingsAlong(before, path, after) {
    const route = [before, ...path, after];
    const crossings = [];
    for (let i = 1; i < route.length; i++) {
        if (crossingCost(route[i - 1], route[i]) === 0) continue;
        crossings.push([route[i - 1].room, route[i].room, { from: route[i - 1].level ?? null, to: route[i].level ?? null },
            route[i].spot ?? null]);
    }
    return crossings;
}

/**
 * What one step of a route costs, in crossings: `from` and `to` are `{room, level}`.
 *
 * THE STAIRS ARE A DOOR (E12 C9; the owner's answer Q1 a, 11.10.2026). A step into
 * another room costs one crossing - the free Move, then a Sprint, then an action -
 * whether it goes through a door or up the stairs; a step that changes floor
 * inside one room, a stairwell drawn on both, costs nothing, as a step inside
 * any room does. So the floor does not enter the price: the room does. Exported
 * for tier 2, which reads the four cases off it.
 */
export function crossingCost(from, to) {
    return (from?.room ?? null) === (to?.room ?? null) ? 0 : 1;
}

/**
 * The rooms the stairs link, as sorted `[a, b]` name pairs; null when the scene has no stairs.
 *
 * Stairs are a region carrying Foundry's Change Level behaviour (rooms.mjs `passageBehaviour`;
 * such a region is never a room). Each links the rooms under its centre on each of its floors -
 * the floors it names when it names two or more, else every floor of the scene - read with the
 * rooms' own hit test (`piecesAt`) at the elevation 0, as `regionsAt` reads a token with none.
 * What Foundry's own Change Level behaviour stores, and where it puts a token, has not been read
 * off a table (LIVE-E12-02); this reads only where the region stands. Exported for tier 2.
 */
export function stairLinks(scene) {
    // Not stairs a player drew (E12 fix r2-H1; early review EARLY-C9-3): `roomPieces` leaves a
    // player's region out of the rooms, and a player's Change Level region over the Lab and the
    // Attic linked them. Whether v14 lets a player draw one is LIVE-E12-04.
    const players = playerRegionIds();
    const stairs = Array.from(scene?.regions ?? [])
        .filter(region => passageBehaviour(region) === "changeLevel" && !players.has(region.id));
    if (!stairs.length) return null;
    const every = Array.from(scene?.levels ?? []).map(level => level?.id ?? level);
    const pairs = new Set();
    for (const region of stairs) {
        const box = boundsOf(region);
        if (!box) continue;
        const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
        const floors = region.levels?.size >= 2 ? Array.from(region.levels) : every;
        const rooms = [...new Set(floors.map(level => piecesAt(scene, cx, cy, 0, level).map(r => r.name).sort()[0])
            .filter(Boolean))].sort();
        for (let i = 0; i < rooms.length; i++) {
            for (let j = i + 1; j < rooms.length; j++) pairs.add(`${rooms[i]}\n${rooms[j]}`);
        }
    }
    return [...pairs].sort().map(pair => pair.split("\n"));
}

/**
 * @returns {Promise<boolean>} whether the crossing was paid for. A route
 *   settles one crossing at a time and stops at the first refusal, so the
 *   caller needs to know which happened.
 *
 * `paid` is a price already taken (E80 C2): the primary GM's 'Go through' pays first and moves after
 * (`settleCrossingOnGm`), and asks this for the card and the traps' hook alone, so a tunnel's crossing is
 * told as a door's is and the price is never taken twice.
 */
async function chargeForCrossing(actor, from, to, tokenDoc = null, previous = null, { paid = null } = {}) {
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
    if (!paid && !free && freeMovesLeft(actor) < 1 && !canPayFor(actor, 1)) {
        /* The put-back first, the card after (E79 fix r4-G4, 1.2.79; review round 4, Q1): the card is awaited, a
           private card's create and its resolution, and the put-back waited for it, with the token in the room it could
           not pay for. Scenario 66 W4, each private card held 300 ms as a loaded machine's stand-in, one run each in a
           lane beside other scenarios on 17.10.2026: the put-back written 822 ms after the step at 0641c4c, after the
           paid crossing's card (done at 308 ms) and this one (710 ms), and 451 ms with this order, after the paid
           crossing's card alone (311 ms) - this card's whole wait, 371 ms there. Without the stand-in the gain is this
           card's create, about 110 ms by review round 4's reading on p1 (correctness Q1), not measured again here.
           The route that sent it is not announced when its put-back lands first (`putBacksSent`). */
        await sendBack(tokenDoc, previous, from);
        ui.notifications.warn(game.i18n.localize("DRPG.Move.noBudget"));
        // Tagged as an error popup (red border) rather than the default
        // info one - this is a refusal, the concrete case the red variant
        // exists for. See popup.mjs's catch-all createChatMessage hook.
        await whisperToOwner(actor, `${cardHead({ action: game.i18n.localize("DRPG.Move.title") })}<p>${
            game.i18n.localize("DRPG.Move.noBudgetLong")
        }</p>`, { flags: { [MODULE_ID]: { popupKind: "error" } } });
        return false;
    }

    const cost = paid ?? await takeMove(actor);
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

    if (tokenDoc) lastPosition.set(tokenDoc.id, spotOf(tokenDoc));

    // The room goes in the header's own slot rather than only inside `where`'s
    // sentence: the header is the line somebody skims a whole time of day by,
    // and "MOVE - Dinner Hall" answers the question the log is being read for.
    //
    // WHERE AND THE PRICE, AND NOT WHAT THE ROOM LOOKS LIKE (E77 C2, 13.10.2026).
    // The card carried the GM's description of the room from 26.08 (Dawid: walking
    // in is when somebody wants to be told what they see) until the owner's answer
    // of 11.10 to the A8 design's question 1, "b": the card says where the character
    // went and what it cost, and the description is read on the room tile, which
    // shows it while the character stands there rather than once, on a card a player
    // closes (a card already sent stays as it was sent). Scenario 66 W2 reads
    // the card of a crossing into a described room; R506 that no description is read here.
    await whisperToOwner(actor, `${cardHead({
        action: game.i18n.localize("DRPG.Move.title"), room: to
    })}<p>${where}<br>${price}</p>`);
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

/*
 * THE PRICE OF 'GO THROUGH', ON THE PRIMARY GM (E80 C2, 18.10.2026; the stage's write road "price"). A door's
 * price is taken on the mover's own browser as its token lands (`chargeForCrossing`); a tunnel's crossing is
 * the primary's write, so the primary takes the price first - the Eclipse's count where an Eclipse runs, nothing
 * where the GM handles movement by hand, else the free Move, a Sprint, a Burst or an action (`takeMove`, quiet:
 * nothing is said or played on the GM's screen) - moves the token after, and gives exactly that back when the
 * move is not written (`refundCrossingOnGm`). Tier 2 "A10-18" reads each.
 */

/**
 * THE ONE QUEUE'S KEY FOR A CHARACTER'S CROSSINGS ON THE PRIMARY (E17 C0, 26.10.2026; A10, session 0). One key per
 * character, so a crossing waits only for that character's: the Eclipse's count (eclipse.mjs `applyRecordedMove`,
 * `unrecordMove`), a tunnel's 'Go through' (passages-gm.mjs `crossTunnel`, keyed ``passage.cross/${actorId}`` until
 * this commit) and the primary's charge of a door's route (`settleRoute`). `settleCrossingOnGm` and
 * `refundCrossingOnGm` run inside `crossTunnel`'s step and count through the in-step functions, as a second step of a
 * key its holder awaits would never start. Tier 0 R991 holds the census, tier 1 R992 the keys.
 */
export function crossingKey(actorId) {
    return `crossing/${actorId ?? ""}`;
}

/**
 * Take a tunnel crossing's price: `{ cost }` ("eclipse", "none", or `takeMove`'s answer), or `{ code }` refused. An
 * Eclipse's crossing also answers `tell`, its veiled card to the owner, which the caller posts once the token is
 * written (E80 fix r1-G2): posted with the count, it stayed when the write failed.
 */
export async function settleCrossingOnGm(actor, to) {
    if (isEclipse()) {
        const { countCrossingInStep } = await import("./eclipse.mjs");
        const out = await countCrossingInStep(actor.id, { to, card: false });
        if (!out) return { code: "cannotNow" };
        return out.refused ? { code: "eclipseSpent" } : { cost: "eclipse", tell: out.tell ?? null };
    }
    if (!game.settings.get(MODULE_ID, SETTINGS.chargeMovement)) return { cost: "none" };
    const cost = await takeMove(actor, { quiet: true });
    return cost ? { cost } : { code: "noBudget" };
}

/** Give back what `settleCrossingOnGm` took, `cost`, for a crossing that was not written; inside the step that took it. */
export async function refundCrossingOnGm(actor, cost) {
    if (cost === "none") return true;
    if (cost === "eclipse") {
        const { uncountCrossingInStep } = await import("./eclipse.mjs");
        return uncountCrossingInStep(actor.id);
    }
    return giveMoveBack(actor, cost);
}

/**
 * A tunnel's crossing written: the owner's card and the traps' hook, as a door's crossing that was charged
 * (`chargeForCrossing` with the price already taken). Nothing in an Eclipse or with the movement cost off,
 * where a door's crossing posts no card of this kind and fires no hook either.
 */
export async function announceCrossingOnGm(actor, from, to, tokenDoc, cost) {
    if (cost === "eclipse" || cost === "none") return false;
    return chargeForCrossing(actor, from, to, tokenDoc, null, { paid: cost });
}

/**
 * Put a token back where it came from.
 *
 * Called from inside the `updateToken` hook, so the write is deferred a tick -
 * updating a document while its own update hook is still running is what made
 * the earlier attempt silently do nothing. The move is also marked so our own
 * hook ignores it and does not charge for the way back.
 *
 * Walls ignored (E79 C4): the way back is where the token stood a moment ago, and Foundry's
 * `constrainOptions.ignoreWalls` keeps a wall between the two from stopping it - one road for
 * every refusal, the GMs' audit's (movement-audit.mjs) included, which plays no sound on the GM's
 * browser (`sound`) and tells the mover once the write has landed (`landed`, with whether it wrote).
 * Whether v14 honours the option on an update is not read here: LIVE-E79-02.
 */
async function sendBack(tokenDoc, previous, room, { sound = true, landed = null, audited = false, elevation = false } = {}) {
    if (!tokenDoc || !previous) return;
    // Announced when the REVERT lands, on every browser (`onUpdateToken`, E77 C2), not by the refusal.
    putBack.add(tokenDoc.id);
    putBacksSent.set(tokenDoc.id, (putBacksSent.get(tokenDoc.id) ?? 0) + 1);

    // The only "error" a player makes regularly, and until now the only signal
    // was the token sliding back. Local, on the client that tried it.
    if (sound) playSfx("refused");

    const apply = async () => {
        let wrote = false;
        try {
            // Its floor too, when it had one (`spotOf`, E12 C9): a refused climb put back by x
            // and y alone stays upstairs. Its height too where the caller asks (E17 C1: a rule's put-back, to x, y,
            // elevation and level, the owner's 13.10).
            const to = previous.level !== undefined ? { x: previous.x, y: previous.y, level: previous.level } : { x: previous.x, y: previous.y };
            if (elevation && Number.isFinite(Number(previous.elevation))) to.elevation = Number(previous.elevation);
            await tokenDoc.update(to,
                { animate: false, [REVERT]: true, ...(audited ? { [WALL_PUT_BACK]: true } : {}), constrainOptions: { ignoreWalls: true } }
            );
            wrote = true;
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
        landed?.(wrote);
    };

    setTimeout(apply, 0);
}

/**
 * A position inside a named room on the token's scene - its centre, less the token's own size.
 * The centre of the room's first piece (E12 C2a): a room of two pieces has no centre of its own
 * that is inside it, and the token's scene is the only one asked - never the camera's. Given a
 * `level`, the first piece on that floor, and the spot names the floor (E12 fix r2-H1): the
 * bridge's send-back guard matches a room's centre on the floor asked (a refused route was put
 * back at one until E79 fix r3-G2). No piece on that floor is no position.
 */
export function positionIn(room, tokenDoc, level = null) {
    try {
        const scene = tokenDoc?.parent ?? null;
        const floor = level?.id ?? level ?? null;
        const pieces = roomRegions(scene, room);
        const region = floor === null ? pieces[0] : pieces.find(piece => onLevel(piece, floor));
        const box = region ? boundsOf(region) : null;
        if (!box) return null;
        const size = scene?.grid?.size ?? canvas?.grid?.size ?? 100;
        const w = (tokenDoc?.width ?? 1) * size;
        const h = (tokenDoc?.height ?? 1) * size;
        const spot = { x: Math.round(box.x + box.w / 2 - w / 2), y: Math.round(box.y + box.h / 2 - h / 2) };
        return floor === null ? spot : { ...spot, level: floor };
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
 * Name of the room a token document stands in on its own floor, if any - measured, always.
 *
 * It read Foundry's `token.regions` first until E12 C9 (audit S07-45), and fell
 * back to the measurement when that list was empty (a token placed by script, a
 * scene not yet initialised). Whether v14's list keeps to the token's floor was
 * not read (LIVE-E12-03); the harness's (lib/shim.mjs) has no floors, and through
 * it a token on the ground floor under the Attic read the Attic (scenario 66 G1
 * at the parent, 11.10.2026). `roomAt` asks the token's floor, so this asks only
 * it - one reader where there were two that could disagree.
 */
export function roomOfToken(tokenDoc) {
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
 * `level` is the token's floor as Foundry v14 stores it (rooms.mjs `levelOf`), null where the
 * scene has none, and `room` is read on it (E12 C9); what v14 holds there is LIVE-E12-03.
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
    return { tokenDoc: place.tokenDoc, scene: place.scene, room: roomOfToken(place.tokenDoc), level: levelOf(place.tokenDoc) };
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

/**
 * The scene a character's rules are read on - their room's table, favours, stashes and Search
 * tokens (E12 C6, plan-E12 3.3): where they stand (`locateActor`), else the school
 * (`homeScene`), never the scene on screen. Until 1.2.74 those readers took the camera's
 * scene, so the GM's browser and the player's could answer one Search differently.
 */
export function sceneOfActor(actor) {
    return locateActor(actor)?.scene ?? homeScene();
}

/**
 * Every place this character has a token, on every place scene - `locateActor` for all of them.
 * It walked every scene until E13 C1 (12.10.2026; audit S07-47): a student's token in the trial
 * hall was a place, so Eclipse's crossings and a trap's "stands in" asked the hall's rooms too.
 */
export function placesOf(actor) {
    if (!actor) return [];
    const places = [];
    for (const scene of game.scenes ?? []) {
        if (!isPlaceScene(scene)) continue;
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
 * the whole world. Same floor too (plan-E12 3.2): the room is read on each
 * one's floor since E12 C9, and a room whose pieces span two floors - a
 * stairwell - is one room for a crossing (`crossingCost`) but not, here, for a
 * hand reaching between its floors. Read in the plan, not measured on a v14 scene.
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
    // A token document (both callers since E12 fix r1-G4); a placeable is read through its own.
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
 *
 * `roomOf` places each token: `roomOfToken`, or `lawfulRoomOf` where the
 * caller runs on the primary and asks who counts (E12 fix r2-H3; security review
 * r2 SEC2-7, goal review N5): a trap's "alone" (traps.mjs `isAlone`) and the
 * Eclipse's witnesses to a murder (eclipse.mjs `judgePendingMurders`), so a student
 * a console put in the room past the rules decides neither.
 */
export function othersInNamedRoom(room, actor = null, scene = null, roomOf = roomOfToken) {
    if (!room) return [];
    // The scene handed in; else the actor's; else the school (E12 C3) - never the camera's.
    const on = scene ?? (actor ? locateActor(actor)?.scene : null) ?? homeScene();
    return Array.from(on?.tokens ?? [])
        .filter(t => !actor || t.actorId !== actor.id)
        .filter(countsAsPresent)
        .filter(t => roomOf(t) === room)
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
 * geometrically: regions whose bounding boxes share an edge across a wall's
 * thickness count as neighbours. That matches how a map is usually drawn - a
 * shared wall - without asking the GM to maintain a separate connection list.
 *
 * The GM can override it per room with a `drpgNeighbours` flag (`ROOM_FLAGS.neighbours`,
 * Room Setup's Neighbours column since E12 C14) holding a comma-separated list of room
 * names, for rooms that touch but have no door, or doors between rooms that do not touch.
 */
export function neighbouringRooms(scene, room) {
    return neighbourAnswer(scene, room).rooms;
}

/**
 * `neighbouringRooms` with whether its answer was DECIDED (E12 fix r2-H2, 11.10.2026; early review
 * EARLY-C14-1). An empty list meant two things to `crossingRefused`: "the map could not
 * be read, let everything through" - the reading it was written for - and, since E12 C14, "this room
 * has no door": a Storage whose last wall a Kitchen's list closed, a Nook that meets the Hall only at a
 * corner, and a room whose list names only rooms the scene does not have each came out `[]` and so
 * walked into every room on the map (the reviewer's probe, S/e12-review/c14-copies/nb.mjs, re-run by
 * the orchestrator on 1529762). `decided` is false only where no rule answered: the room is no room on
 * this scene, a piece of it cannot be measured, or nothing touches it at all, not even at a corner - a
 * room drawn apart from the rest, which has walked anywhere since before 1.2.74 and still does (the
 * fix list's row, e12-review/fixes-r2.md H2). A room with a list of its own, or one that a room it
 * touches was ruled out of - by that room's list or by the corner rule - is decided, and an empty
 * answer reaches nothing by crossing. Tier 2 "a room the lists or the walls leave with no neighbour
 * reaches no room ..." reads each case.
 *
 * @returns {{rooms: string[], decided: boolean}}
 */
export function neighbourAnswer(scene, room) {
    if (!room || !scene) return { rooms: [], decided: false };

    // A ROOM OF SEVERAL PIECES IS ONE ROOM (E12 C2a, audit S07-05): its neighbours are
    // the union of its pieces' neighbours, and a neighbour is named once however many
    // of its own pieces touch. Until 1.2.74 this read the first region of the name on
    // the camera's scene, so a corridor drawn in two pieces had the neighbours of one.
    const regions = roomPieces(scene);
    const mine = regions.filter(r => r.name === room);
    if (!mine.length) return { rooms: [], decided: false };
    const names = list => [...new Set(list.map(r => r.name))].sort();

    /*
     * ONE DOOR, TWO SIDES (E12 C14, audit S07-32). A room's list was read from that room alone:
     * a Kitchen whose list left out the Storage beside it could not be walked into the Storage,
     * and the Storage, listing nothing, walked into the Kitchen by its walls - a wall closed from
     * one side; a door listed in an Attic far away led from the Attic to the Hall and not back.
     * A pair is now decided by its lists when either room has one: neighbours when either names
     * the other, and not otherwise, whatever the walls say. A pair where neither room has a list
     * is the map's (below). A room with a list reads no walls, as before. Lists are read
     * off every piece of every room (a list on one piece speaks for the room, as before C14).
     */
    const lists = new Map();
    for (const region of regions) {
        const declared = region.getFlag?.(MODULE_ID, ROOM_FLAGS.neighbours);
        if (typeof declared !== "string" || !declared.trim()) continue;
        const listed = lists.get(region.name) ?? new Set();
        for (const name of declared.split(",").map(s => s.trim()).filter(Boolean)) listed.add(name);
        lists.set(region.name, listed);
    }
    const others = regions.filter(r => r.name !== room);
    const decided = others.filter(r => lists.has(room) || lists.has(r.name));
    const listed = decided.filter(r => lists.get(room)?.has(r.name) || lists.get(r.name)?.has(room));
    if (lists.has(room)) return { rooms: names(listed), decided: true };
    const open = others.filter(r => !lists.has(r.name));

    // Tolerance for the thickness of a shared wall, and no more. A larger
    // margin bridges rooms that merely lie near each other - at 1.5 squares it
    // treated a room two doors away as adjacent. Measured in THIS scene's grid,
    // not the one on screen.
    const grid = scene.grid?.size ?? 100;
    const pad = grid * 0.35;
    const boxes = mine.map(boundsOf);

    // No usable geometry - an unrendered scene, an exotic shape, a region drawn
    // in a way we cannot measure. Treat every other room as reachable rather
    // than telling the player there is nowhere to go: being too permissive is a
    // GM ruling away, being too strict is a dead end. One piece that cannot be
    // measured is enough: its doors could be anywhere. A room whose own list
    // leaves this one out has said so, and stays out (E12 C14).
    if (boxes.some(box => !box)) {
        debug(`No bounds for a piece of "${room}"; treating all rooms as neighbours.`);
        return { rooms: names([...listed, ...open]), decided: false };
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
    const unmeasured = open.filter(r => !boundsOf(r));
    if (unmeasured.length) {
        debug(`${unmeasured.length} region(s) near "${room}" have no measurable bounds; treating as reachable.`);
    }

    const near = open.filter(r => {
        const other = boundsOf(r);
        return other && boxes.some(box => sharesEdge(box, other, pad, grid / 2));
    });

    // Decided when a room this one touches - across a wall's thickness on both axes, a corner
    // included, the test before E12 C14 - was ruled out: by a list, or by the corner rule.
    const rooms = names([...listed, ...near, ...unmeasured]);
    const touched = others.some(r => {
        const other = boundsOf(r);
        return other && boxes.some(box => touches(box, other, pad));
    });
    return { rooms, decided: rooms.length > 0 || touched };
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

/*
 * AN EDGE, NOT A CORNER (E12 C14, audit S07-32). Two boxes are neighbours when, on one axis,
 * they meet or lie at most a wall's thickness (`pad`) apart, and on the other they run side by
 * side for at least `edge` - half a square, the audit's measure: a doorway needs a stretch of
 * shared wall to sit in. Until 1.2.74 the boxes were padded on both axes at once, so two rooms
 * that met only at a corner, or across one diagonally, were neighbours, while the GM's handbook
 * says neighbours touch along a shared edge (the suite's tier-2 test "a corner is not a door; a
 * one-sided override counts both ways" and scenario 66 M2, red on the harness before this commit,
 * 11.10.2026: a Nook against Dorm A's corner was its neighbour). Boxes that overlap by half a square or more each way are neighbours, as before;
 * the threshold is the audit's and has not been measured against a GM's maps.
 */
function sharesEdge(a, b, pad, edge) {
    const along = (a0, aLength, b0, bLength) => Math.min(a0 + aLength, b0 + bLength) - Math.max(a0, b0);
    const x = along(a.x, a.w, b.x, b.w), y = along(a.y, a.h, b.y, b.h);
    return (x >= -pad && y >= edge) || (y >= -pad && x >= edge);
}

/** Two boxes that meet or lie at most `pad` apart on both axes: a shared edge or a corner (E12 fix r2-H2). */
function touches(a, b, pad) {
    return sharesEdge(a, b, pad, -pad);
}

/**
 * Characters standing in a named room, excluding one actor.
 *
 * This is what Listen reports, so it answers to exactly the same rule as
 * `othersInRoom` - see `countsAsPresent`. Listening at a wall does not tell you
 * about a body or about Monokuma.
 *
 * Counted on a scene's token documents since E12 fix r1-G4 (11.10.2026; review
 * round 1 EARLY-C6-1), by `othersInNamedRoom`'s rule: the scene handed in, else
 * the excluded actor's (`locateActor`), else the school. It read the canvas's
 * tokens, so a Listen heard, or a Monocub's dice shared (private-rolls.mjs
 * `sameRoomAudience`), on a browser looking at another map counted the room of
 * that name there.
 */
export function occupantsOf(room, exclude = null, scene = null) {
    return othersInNamedRoom(room, exclude, scene);
}
