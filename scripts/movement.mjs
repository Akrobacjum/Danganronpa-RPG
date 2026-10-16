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
    ROOM_OWNER_FLAG, BEDROOM_KEY_FLAG } from "./config.mjs";
import {
    SETTINGS, iAmTheMastermind, incidentParticipants, incomingTimeOfDay, discoveryLedger, eclipseMovesUsed, isDeadForGm
} from "./settings.mjs";
import { hasFreeMove, takeMove, actionsLeft, canPayFor, freeMovesLeft } from "./actions.mjs";
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
import { whisperToOwner, whisperToGms, isPrimaryGm, log, debug, error, esc, cardHead, plural } from "./utils.mjs";
import { ROOM_FLAG, playerRegionIds, roomPieces, roomRegions, roomFlag, roomNames, isPlaceScene, homeScene, placeScenes,
    isMoveChange, levelOf, onLevel, passageBehaviour, regionPatches } from "./rooms.mjs";
import { playSfx } from "./sfx.mjs";
// The secret passages this browser may know (E79 C3), static for the veto's sake as the imports
// above. passages.mjs is a leaf that never reads this file back (R560 holds its imports).
import { openSegmentsFor, crossingVia } from "./passages.mjs";
// The GMs' audit of a move through a wall (E79 C4), called from `noteGmPosition` with this file's
// readers handed in; movement-audit.mjs never imports this file statically (R161).
import { auditMove, registerMoveAudit } from "./movement-audit.mjs";

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
    neighbours: "drpgNeighbours"
};

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
 * refused room for a moment before it lands. It is also how long a co-owner's tile lags behind an accepted
 * route: 74 C1 and C2 read 1509 and 1516 ms in that run.
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
 * fix r1-G2: until then a GM's move left it, review round 1 cor F3; scenario 74 C5).
 */
export function settledSpot(tokenDoc) {
    if (!tokenDoc) return null;
    return unsettled.get(tokenDoc.id)?.spot ?? spotOf(tokenDoc);
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
    // The witness judge's readers (E12 C12; `judgeArrival`), by a dynamic import: sheet-audit.mjs and
    // mastermind.mjs each reach this file back through their own static imports (R161).
    Promise.all([import("./sheet-audit.mjs"), import("./mastermind.mjs")])
        .then(([sheet, mastermind]) => {
            judgeReaders = { flagsHeldNow: sheet.flagsHeldNow, itemsHeldNow: sheet.itemsHeldNow, isMastermind: mastermind.isMastermind };
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
            judgeArrival(tokenDoc, userId, { revert: Boolean(options?.[REVERT]), sentBack: Boolean(options?.[SENT_BACK]) });
        } catch (err) {
            error(`Could not judge where "${tokenDoc.name}" arrived`, err);
        }
        // The wall rule (E79 C4), from the same start: the GM's last sighting. It changes no standing
        // `judgeArrival` keeps (the plan's D7) and catches its own throw.
        const judged = auditMove(tokenDoc, changes, options, userId, gmSeen.get(tokenDoc.id), {
            REVERT, SENT_BACK, sendBackRefusal, stairLinks, roomAt, history: recentPositions(tokenDoc.id),
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
        gmHistory.set(tokenDoc.id, sightingsAfter(gmHistory.get(tokenDoc.id) ?? [], was, Date.now(), putBackTo));
    }
    gmSeen.set(tokenDoc.id, sentTo ?? positionOf(tokenDoc));
}

/**
 * A token dropped on a scene: where it stands, and on the primary whether a player dropped it somewhere
 * the rules refuse (E12 C12) - judged from where that student last stood on the scene (`droppedFrom`,
 * E12 fix r2-H3). Exported for tier 2, which hands it a plain token.
 */
export function noteGmCreated(tokenDoc, userId) {
    if (judgingHere()) {
        try {
            judgeArrival(tokenDoc, userId, { created: true });
        } catch (err) {
            error(`Could not judge where "${tokenDoc.name}" was dropped`, err);
        }
    }
    gmSeen.set(tokenDoc.id, positionOf(tokenDoc));
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
export function sightingsAfter(ring, was, at, putBackTo = null) {
    if (!putBackTo) return [...ring, { ...was, at }].slice(-GM_HISTORY_KEPT);
    const left = ring.findLastIndex(spot => samePlace(spot, putBackTo));
    return left < 0 ? [...ring] : ring.slice(0, left + 1);
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
 *   it paid for (MAP-11), and that spot is a room's centre, which the token
 *   never stood on - the E03 review found the honest request refused. A centre
 *   names the floor it is on when the room was asked on one (`positionIn`).
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
 * `checkBodyFound`, murder-rules.mjs `maybeThirdParty`). Nothing is put back (Q3 a,
 * not b): a GM who sees it otherwise moves the token, and a GM's move or a GM's
 * create makes it lawful where it stands. Who moved it is the hook's `userId`,
 * Foundry's and not a packet's.
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
/** sheet-audit.mjs's held readers and mastermind.mjs's `isMastermind`, once `registerMovement`'s import lands. */
let judgeReaders = null;

/** Marks the bridge's send-back (gm-bridge.mjs `handleSendback`): a player's revert that a GM writes. */
export const SENT_BACK = "drpgSentBack";

/** Marks the GMs' audit's put-back of a move through a wall (movement-audit.mjs), for every GM's record (`sightingsAfter`). */
const WALL_PUT_BACK = "drpgWallPutBack";

function samePlace(a, b) {
    return a.x === b.x && a.y === b.y && (a.level ?? null) === (b.level ?? null);
}

/** The token where it stands: lawful, its room the last lawful one - or not, keeping the last lawful room it had. */
function standingHere(tokenDoc, { lawful = true, last = null, told = false, reason = null } = {}) {
    return { x: tokenDoc.x, y: tokenDoc.y, level: tokenDoc.level ?? undefined, lawful,
        last: lawful ? { room: roomOfToken(tokenDoc), level: levelOf(tokenDoc) } : last,
        told: lawful ? false : told, reason: lawful ? null : reason };
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
 * revert, `sentBack` whether the bridge wrote it for a player, `created` whether the token was
 * just dropped. On the primary, from `noteGmPosition` and `noteGmCreated`; exported for tier 2,
 * which judges a plain token.
 */
export function judgeArrival(tokenDoc, userId = null, { revert = false, sentBack = false, created = false } = {}) {
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
        if (back) now = { ...back, x: spot.x, y: spot.y, level: spot.level };
    } else if (mover?.isGM) now = standingHere(tokenDoc);
    if (!now) {
        // One synchronous step from the reads to the verdict (H3), nothing awaited (H17).
        const flags = judgeReaders ? judgeReaders.flagsHeldNow(actor) : actor;
        const items = judgeReaders ? judgeReaders.itemsHeldNow(actor) : Array.from(actor.items ?? []);
        const student = { id: actor.id, name: actor.name, type: actor.type, getFlag: (scope, key) => flags.getFlag(scope, key), items };
        const mastermind = Boolean(judgeReaders?.isMastermind(actor));
        // Through a secret passage (E79 C3): the straight line from where the primary last saw the token to
        // where it stands, on the floor of the room it came from, against the GMs' records.
        const via = was ? crossingVia(centresOf(tokenDoc, was, tokenDoc), actor, tokenDoc.parent?.id, was.last?.level ?? null, { mastermind }) : null;
        const verdict = arrivalVerdict(student, was?.last ?? null, tokenDoc, { gm: false, mastermind }, via);
        now = verdict === true ? standingHere(tokenDoc)
            : standingHere(tokenDoc, { lawful: false, last: was?.last ?? null, told: was?.lawful === false && was.told, reason: verdict });
    }
    if (own && !samePlace(own, now)) {
        const ring = [...(standingHistory.get(tokenDoc.id) ?? []), { ...own }];
        standingHistory.set(tokenDoc.id, ring.slice(-GM_HISTORY_KEPT));
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
 * the reason. The veto's rules, read the way the veto reads them (`crossingVerdict`) with no price,
 * and a body is a body (`isCorpse`, which the veto asks before them). Pure but for the settings
 * those rules read.
 */
function arrivalVerdict(student, last, tokenDoc, mover, via = null) {
    if (isCorpse(student)) return game.i18n.localize("DRPG.Move.dead");
    // Nobody stands in the trial hall (rooms.mjs, E13 C1), so no move there is a crossing. Asked
    // here and not left to `roomOfToken`: the last room the judge holds may predate the link.
    // Scenario 41 b1 read it on 12.10.2026: the hall linked after its tokens were recorded in its
    // Stand, Aiko's move to no room was refused as leaving the courtroom and the GMs were told.
    if (!isPlaceScene(tokenDoc.parent)) return true;
    const from = last?.room ?? null;
    const to = roomOfToken(tokenDoc);
    if (from === to) return true;                      // the same room, a stairwell's floors too
    return crossingVerdict(student, from, to, tokenDoc.parent, { from: last?.level ?? null, to: levelOf(tokenDoc) }, { mover, pay: false, via });
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
        const allowed = crossingVerdict(actor, from, to, tokenDoc.parent, { from: here, to: there }, { via });
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
 * @returns {true|string} true, or the reason it is refused.
 */
export function crossingVerdict(actor, from, to, scene, floors = null, { mover = null, pay = true, via = null, known } = {}) {
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
    const passage = passesThrough(actor, from, to, scene, floors, { mover, known });
    const blocked = restrictedFrom(actor, to, scene, mover, { via: passage && via === "passage" ? "passage" : null });
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
            if (pay && eclipseMovesUsed(actor.id, clock) >= allowance) return game.i18n.localize("DRPG.Eclipse.noMovesLeft");

            /* The connected-rooms rule, the stairs between floors included (E12 fix r2-H1, 11.10.2026;
               early review EARLY-C9-1). This branch asked `neighbouringRooms` itself and never reached
               the stairs rule in `crossingRefused`, so in an Eclipse a change of floor from the Lab up
               into the Attic above it cost one crossing, and the witness judge, which asks here with
               `pay: false`, called it lawful. One rule for both roads now; tier 2 "a change of floor
               between rooms only a player's stairs link is refused ..." reads it in an Eclipse. */
            const refused = passage ? false : crossingRefused(scene, from, to, floors);
            if (refused) return refused;
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
    if (notConnected) return notConnected;
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
    return game.i18n.localize("DRPG.Move.noBudget");
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
function restrictedFrom(actor, to, scene, mover = null, { via = null } = {}) {
    try {
        if (isChained(actor)) return game.i18n.localize("DRPG.Calls.chainedBlocked");
        if (to && !(mover ? mover.mastermind : iAmTheMastermind())) {
            if (isLocked(scene, to)) return game.i18n.localize("DRPG.Move.locked");
            if (isSealed(to)) return game.i18n.format("DRPG.Calls.sealedBlocked", { room: to });
            // Somebody's bedroom. The owner walks in; anybody else needs the
            // key they were given - see the note on keys in vault.mjs. A GM
            // moving a token is not standing in the fiction and is never
            // stopped by a door.
            if (via !== "passage" && !(mover ? mover.gm : game.user.isGM) && bedroomShut(actor, scene, to)) {
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
 */
export function passageRooms(scene, passage, level = null) {
    const dx = passage.x2 - passage.x1, dy = passage.y2 - passage.y1, length = Math.hypot(dx, dy);
    if (!(length > 0)) return [null, null];
    const grid = scene?.grid?.size ?? 100;
    const mx = (passage.x1 + passage.x2) / 2, my = (passage.y1 + passage.y2) / 2;
    const nx = -dy / length, ny = dx / length;
    return [1, -1].map(side => {
        for (const fraction of PASSAGE_SIDES) {
            const x = mx + side * nx * grid * fraction, y = my + side * ny * grid * fraction;
            const room = piecesAt(scene, x, y, 0, level).map(region => region.name).sort()[0];
            if (room) return room;
        }
        return null;
    });
}

/**
 * The rooms this character reaches from `room` through the secret passages it knows on this scene and
 * floor, sorted: none for a character that knows none, which is nearly every crossing. On a GM's
 * browser the GMs' records name the knowers, and `mover.mastermind` passes every passage (the owner's
 * Q7). `known` is the suite's (R558).
 */
export function reachableFrom(actor, room, scene, { level = null, mover = null, known } = {}) {
    if (!room || !scene?.id) return [];
    const far = new Set();
    for (const passage of openSegmentsFor(actor, scene.id, level, { mastermind: Boolean(mover?.mastermind), known })) {
        const sides = passageRooms(scene, passage, level);
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
export function passesThrough(actor, from, to, scene, floors = null, { mover = null, known } = {}) {
    if (!from || !to || from === to) return false;
    if (floors && levelKey(floors.from) !== levelKey(floors.to)) return false;
    return reachableFrom(actor, from, scene, { level: floors?.from ?? null, mover, known }).includes(to);
}

/**
 * Whether this passage, `{ id, x1, y1, x2, y2 }`, is a way out for this character now (the E79 plan's
 * P7-0, the owner's Q9): it knows the passage, and the rules that stop a step through it - a GM's lock, a
 * seal, the chain (`restrictedFrom` with `via: "passage"`) - stop none into the room beyond `from`, or into
 * either room when `from` is neither. The doorway glow draws a gap only where this is true (fog-doorways.mjs
 * `doorwayEdges`), so the frame says what the veto would answer. E51 generalises it to every door and takes
 * it over (the E79 plan's A10-9); R560 holds that it is written once. `known` is the suite's (R557).
 */
export function passageOpenFor(actor, passage, scene, { from = null, level = null, mover = null, known } = {}) {
    if (!passage?.id || !scene?.id) return false;
    const knows = openSegmentsFor(actor, scene.id, level, { mastermind: Boolean(mover?.mastermind), known })
        .some(seg => seg.id === passage.id);
    if (!knows) return false;
    const beyond = passageRooms(scene, passage, level).filter(room => room && room !== from);
    return beyond.length > 0 && beyond.every(room => !restrictedFrom(actor, room, scene, mover, { via: "passage" }));
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
            const allowed = await judgeEclipseCrossing(actor, from, to, tokenDoc.parent, floors);
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
    let standing = previous;
    for (const [from, to, floors] of crossings) {
        const paid = await chargeForCrossing(actor, from, to, tokenDoc, standing);
        if (!paid) return false;
        standing = positionIn(to, tokenDoc, floors?.to ?? null) ?? standing;
    }
    return true;
}

/**
 * A token's update, judged (`judgeMove`), and its route announced once the token stands where the route
 * leaves it (E77 C2, 13.10.2026; the A8 design's step 5).
 *
 * `Hooks.callAll("drpgRouteSettled", { tokenDoc, accepted })` is client-local and fires once per route:
 * `accepted: true` when the move stands (a GM's, a Monokuma's, a token's first sight, a move inside a room,
 * an Eclipse's allowed crossings, the charge switched off, every crossing paid); `accepted: false` when the
 * module put the token where it stands now (its own REVERT - a refusal's put-back, the bridge's, a gather -
 * on every browser) or refused a crossing it did not put back (`takeMove` paid nothing). A refusal that
 * schedules a put-back is not announced: the put-back is, when it lands, so a listener never reads the
 * token in a room it was refused. Nothing fires for a change that is no move (a GM's included, E77 fix
 * r1-G2), or for a step of a drag still in flight (`movement.pending.waypoints`). On a browser that does
 * not settle the route (another one charges it) it fires only where the token's actor is owned: `false`
 * when the put-back lands, `true` once the token has been quiet for `ROUTE_QUIET_MS` (`untilQuiet`, E77 fix
 * r1-G2; until then nothing fired there, review round 1 cor F1). Until C2 a reader had only the raw update,
 * which reaches every browser before the refusal and its put-back (the A8 design's CB-8): a tile drawn on
 * it names a room the character never entered. Scenario 66 W2-W4 counts the announcements on the mover's
 * browser and two others, scenario 74 C on a co-owner's; R506 reads that this is the one place that fires it.
 */
async function onUpdateToken(tokenDoc, changes, options, userId, { atRest = false } = {}) {
    restartQuiet(tokenDoc.id);
    const turn = atRest || !isMoveChange(changes) ? 0 : (moveTurns.get(tokenDoc.id) ?? 0) + 1;
    if (turn) moveTurns.set(tokenDoc.id, turn);
    const route = {};
    let accepted;
    try {
        accepted = await judgeMove(tokenDoc, changes, options, userId, route, { atRest });
    } catch (err) {
        error("Movement charge failed", err);
    } finally {
        if (unsettled.get(tokenDoc.id) === route && !putBack.has(tokenDoc.id)) unsettled.delete(tokenDoc.id);
    }
    if (turn) recheckAtRest(tokenDoc, changes, options, userId, turn).catch(err => error("Movement re-read at rest failed", err));
    if (accepted === false && putBack.has(tokenDoc.id)) return;
    if (accepted === true || accepted === false) Hooks.callAll("drpgRouteSettled", { tokenDoc, accepted });
}

/**
 * The move judged once more where the token came to rest (`whenAtRest`, whose note has the owner's report of
 * 14.10.2026), as the same update - a GM's, a put-back or a player's - and announced as it would have been: when no newer move of the token reached this browser meanwhile, no put-back is on its way, and the
 * character's room is not the one its update recorded (`lastRoom`) or a step of its drag is still noted
 * (`pathRooms`) with no last step behind it. A route left pending waits `ROUTE_QUIET_MS` from its last
 * update first, as a co-owner's wait for quiet does, so a drag whose last step is merely slow is not cut in
 * two. Everywhere else - every route the hook read where it ended, every route of the harness - it finds
 * the room recorded and does nothing.
 */
async function recheckAtRest(tokenDoc, changes, options, userId, turn) {
    await whenAtRest(tokenDoc);
    const id = tokenDoc.id;
    if (pathRooms.has(id)) await pause(ROUTE_QUIET_MS);
    if (moveTurns.get(id) !== turn || putBack.has(id) || unsettled.has(id)) return;
    if (tokenDoc.actor?.type !== "character" || !lastRoom.has(id)) return;
    if (!pathRooms.has(id) && roomOfToken(tokenDoc) === lastRoom.get(id)) return;
    debug(`Route of ${tokenDoc.name} read again at rest: recorded ${lastRoom.get(id) ?? "no room"}, `
        + `standing in ${roomOfToken(tokenDoc) ?? "no room"}.`);
    await onUpdateToken(tokenDoc, changes, options, userId, { atRest: true });
}

/**
 * Whether a token's update stands: true, false when it was refused or put back, undefined when there is
 * no route to announce here (`onUpdateToken`). `route` is the update's own mark, should it mark one.
 * `atRest` (`recheckAtRest`) judges the token where it stands, its waypoints pending or not.
 */
async function judgeMove(tokenDoc, changes, options, userId, route = {}, { atRest = false } = {}) {
    // Our own revert: record where it landed, charge nothing.
    if (options?.[REVERT]) {
        endQuiet(tokenDoc.id);
        lastRoom.set(tokenDoc.id, roomOfToken(tokenDoc));
        lastPosition.set(tokenDoc.id, spotOf(tokenDoc));
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
        lastRoom.set(tokenDoc.id, roomOfToken(tokenDoc));
        lastPosition.set(tokenDoc.id, spotOf(tokenDoc));
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
        notePathRoom(tokenDoc.id, roomOfToken(tokenDoc), levelOf(tokenDoc));
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
        lastRoom.set(tokenDoc.id, roomOfToken(tokenDoc));
        lastPosition.set(tokenDoc.id, spotOf(tokenDoc));
        return true;
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
        lastPosition.set(tokenDoc.id, spotOf(tokenDoc));
        return true;
    }

    // Every boundary this drag actually crossed, in the order it crossed
    // them. Ending where you started is no longer the same as going
    // nowhere: the route is what is charged for.
    const crossings = crossingsAlong({ room: before, level: previous?.level ?? null }, path,
        { room: after, level: levelOf(tokenDoc) });

    // Nothing crossed - a move inside one room, or a scene with no regions
    // at all: free. Remember the new spot so a later refused crossing snaps
    // back to somewhere sensible.
    if (!crossings.length) {
        lastPosition.set(tokenDoc.id, spotOf(tokenDoc));
        lastRoom.set(tokenDoc.id, after);
        return true;
    }

    lastRoom.set(tokenDoc.id, after);

    const settled = await settleRoute(tokenDoc, actor, { before, previous, crossings });
    if (settled !== undefined || !actor.isOwner) return settled;
    // Another browser settles it (`awaitingQuiet`). Accepted, it stands where it stopped: the spot the
    // settling browser's charge records there (`chargeForCrossing`), and this browser's next route starts
    // from it.
    const quiet = await untilQuiet(tokenDoc);
    if (quiet) lastPosition.set(tokenDoc.id, spotOf(tokenDoc));
    return quiet;
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
 */
function notePathRoom(tokenId, room, level = null) {
    if (!room) return;
    const seen = pathRooms.get(tokenId);
    if (!seen) {
        pathRooms.set(tokenId, [{ room, level }]);
        return;
    }
    if (seen[seen.length - 1].room !== room) seen.push({ room, level });
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
 * Every step is `{room, level}` (E12 C9) and `crossingCost` prices it; each
 * crossing handed on is `[from, to, {from, to}]`, the two room names and the
 * floor of each end (E12 fix r2-H1), for the stairs rule on the Eclipse's road
 * and the floor a refused route is put back on.
 */
function crossingsAlong(before, path, after) {
    const route = [before, ...path, after];
    const crossings = [];
    for (let i = 1; i < route.length; i++) {
        if (crossingCost(route[i - 1], route[i]) === 0) continue;
        crossings.push([route[i - 1].room, route[i].room, { from: route[i - 1].level ?? null, to: route[i].level ?? null }]);
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
async function sendBack(tokenDoc, previous, room, { sound = true, landed = null, audited = false } = {}) {
    if (!tokenDoc || !previous) return;
    // Announced when the REVERT lands, on every browser (`onUpdateToken`, E77 C2), not by the refusal.
    putBack.add(tokenDoc.id);

    // The only "error" a player makes regularly, and until now the only signal
    // was the token sliding back. Local, on the client that tried it.
    if (sound) playSfx("refused");

    const apply = async () => {
        let wrote = false;
        try {
            // Its floor too, when it had one (`spotOf`, E12 C9): a refused climb put back by x
            // and y alone stays upstairs.
            await tokenDoc.update(
                previous.level !== undefined ? { x: previous.x, y: previous.y, level: previous.level } : { x: previous.x, y: previous.y },
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
 * `level`, the first piece on that floor, and the spot names the floor (E12 fix r2-H1): a
 * refused route is put back on the floor it paid for, and the bridge's send-back guard matches
 * a room's centre on the floor asked. No piece on that floor is no position.
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
