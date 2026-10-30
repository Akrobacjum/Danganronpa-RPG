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
 */

import { MODULE_ID } from "./config.mjs";
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
import { debug } from "./utils.mjs";
// E88 C0: the counters `fps()` and scenario 86 read (perf-counters.mjs); an increment each, nothing timed.
import { count } from "./perf-counters.mjs";

export function registerVisibility() {
    // `refreshToken` is the one that matters: Foundry recomputes `visible` from
    // its own vision logic on every refresh, so setting it from `sightRefresh`
    // alone was immediately overwritten - which is why standing at a gap in a
    // wall still showed the room beyond.
    Hooks.on("refreshToken", token => {
        count("refreshToken.visibility");
        /* NO MEMO IS DROPPED HERE (E89 C3, 30.10.2026; E89-07). This used to drop the memo of our rooms on every
           refresh of a token we own, and a drag's preview and a slide refresh once a frame: scenario 86 at e9e41f58 (on
           the harness's model) counted visibility.forget 43 on the mover's browser and 21 on the GM's (who owns every
           token) over one 20-frame drag. `myRooms` reads the documents' positions, never a sprite's, so a refresh cannot
           change its answer: what can is an owned document's move (`passForTokenUpdate`), a token created or deleted, a
           bullet and its refs and the scene's own events (each through `applyAll`). */
        // E89 C4: Foundry's refresh has had its say on `visible`; whether this file hides it again is asked below.
        hiddenByUs.delete(token);
        applyToToken(token);
        // …and again after this frame's refresh has finished, this token among the ones refreshed in it. See below.
        reassertNextFrame(token);
    });

    Hooks.on("sightRefresh", () => { count("visibility.sightRefresh"); sightPassNextFrame(); });
    Hooks.on("canvasReady", () => applyAll());
    Hooks.on("updateToken", (doc, changes) => passForTokenUpdate(doc, changes));
    Hooks.on("createToken", () => applyAll());
    Hooks.on("deleteToken", () => applyAll());
    Hooks.on("drpgTimeOfDayChanged", () => applyAll());
    Hooks.on("drpgEclipseChanged", () => applyAll());

    // A new Truth Bullet is the other half of `myRemnantRefs()` going stale -
    // it can land on this user's actor from a socket reply with no token on
    // this scene moving at all, so nothing above would otherwise catch it.
    Hooks.on("createItem", item => { if (isMyTruthBullet(item)) applyAll(); });
    Hooks.on("deleteItem", item => { if (isMyTruthBullet(item)) applyAll(); });
    // And since E05 C13 the other half of that pair: which trace a bullet came from is the
    // owner's copy of the GMs' rows, and it can arrive after the bullet does.
    Hooks.on("drpgBulletRefsChanged", () => applyAll());
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
    // A change of floor is a move (rooms.mjs `isMoveChange`, E12 C9): x and y alone missed a climb.
    if (!isMoveChange(changes)) return null;
    if (viewer.gm || !doc?.isOwner) return "one";
    const sameRooms = viewer.roomsBefore != null && viewer.roomsBefore === viewer.roomsAfter;
    const sameLair = (viewer.lairBefore ?? null) === (viewer.lairAfter ?? null);
    if (sameRooms && sameLair) return "one";
    return viewer.roomsBefore != null ? "rooms" : "all";
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
             * While the sprite is not yet in a room of mine it stays hidden;
             * `refreshToken` fires every frame of the slide and shows it the
             * moment it crosses. One region test per animating token per frame.
             */
            const sliding = token.x !== token.document.x || token.y !== token.document.y;
            if (sliding) {
                count("visibility.sliding");
                const at = roomAt(token.x, token.y, token.document);
                if (at && !myRooms().has(at)) hide(token);
            }
        }
    } catch {
        // Never break the canvas over this.
    }
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
    // A scene with no regions at all: leave Foundry's own logic alone
    // rather than hiding the entire cast.
    if (!viewer.rooms.size && !room) return null;
    return room && viewer.rooms.has(room) ? "room" : "hide";
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
        owns
    };
}

/**
 * A revealed Remnant is visible to the table by Foundry's own `hidden` flag,
 * but stays a secret from everyone except the finder - see the header note.
 * Unlike the room rule above, this does not depend on the `roomVisibility`
 * setting: it is not about rooms, it is about who has actually copied this
 * specific trace, and it holds regardless of whether the GM has room
 * enforcement switched on.
 */
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
    if (knowsProject(projectId)) return;
    hide(token);
}

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
 * `movementRuler` - do not exist on the token at all, so they are gone. Still
 * guarded, because the property is not public API: a build that renames it
 * fails safe (nothing to hide, nothing happens) rather than throwing.
 *
 * What the sandbox could NOT show is the trail as another player sees it
 * during a real drag - the browser tool cannot drag the PIXI canvas. One drag
 * at the table, watched from a second seat, is what remains.
 */
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
 * `hide`, cleared by `show` and by the token's own refresh, where Foundry has just written `visible` again) whose
 * verdict is no longer to hide it - the flag is the road that gives such a token back to Foundry (see `applyAll`'s
 * note), and a token this file did not hide has nothing to be given back. `judge` is the verdict; the stand-ins of
 * R1052 hand their own, which is passed `hide`.
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
         * is `show()` - which returns early for a token the viewer does not own
         * (see its own note). So nothing in this module ever restores somebody
         * else's token; Foundry's own visibility pass is what does, and this is
         * how it is asked to run. Take the line out and an Eclipse ending, the
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
    myRoomsCache = null;
    myRemnantRefsCache = null;
    incidentEntitled = null;
}

function myRooms() {
    if (myRoomsCache) return myRoomsCache;
    count("visibility.myRooms.walk");

    const rooms = new Set();
    for (const token of canvas.tokens?.placeables ?? []) {
        if (!token.isOwner || token.actor?.type !== "character") continue;
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
