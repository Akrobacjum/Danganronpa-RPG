/**
 * Danganronpa RPG - the room tile's facts: whose room, and what is true of it (E77 C2, 13.10.2026; the A8
 * design's steps 1-3 and 5, the E77 plan's C2).
 * ---------------------------------------------------------------------------
 * The tile E77 C3 draws shows every player, and a GM with a Monokuma, the room their own character stands in:
 * its name, the GM's description and the GM's picture. Two of those are words and a URL another user wrote,
 * held as region flags every browser has (`VAULT_FLAGS.description`, `VAULT_FLAGS.image`), so what this file
 * answers is the whole of which of them reach a screen:
 *
 *   - WHOSE ROOM is `viewerActor()`'s (hud.mjs) and nobody else's: the account's assigned character, else its
 *     one owned student, else the GM's own Monokuma - the rule the clock has always used. Never a selected or
 *     a clicked token, never the room on the camera's scene, never a room the character has found or one beside
 *     it (R509 reads that this file takes an actor from nowhere else).
 *   - WHERE is the token `locateActor` chooses, on its own scene and floor, read at the spot the route last
 *     settled on (`settledPosition`): a crossing this browser is still judging, or one refused and not yet put
 *     back, is not the character's room yet (movement.mjs `settledSpot`, `drpgRouteSettled`).
 *   - WHAT is `roomDescription` and `roomImage` on that scene: the first piece of the room that carries a value
 *     (rooms.mjs `roomFlag`), the picture through `safeRoomImage` on every read (vault.mjs, E77 C1), so a value
 *     a console wrote is no picture. Both stay the GM's raw words here; the tile sets them as text.
 *
 * Nothing imports this file at C2; C3's tile does, and the suite reaches it through R504's import (which is
 * also how R503's census reads its roads). It writes nothing and draws nothing.
 */

import { viewerActor, trialSlot } from "./hud.mjs";
import { locateActor, settledSpot, roomAt } from "./movement.mjs";
import { roomDescription, roomImage } from "./vault.mjs";

/**
 * Where a token stands for the tile: the spot its last settled route left it on (movement.mjs `settledSpot`).
 * While this browser judges a route of it, the spot before the route; otherwise the token's own.
 *
 * @param {TokenDocument} tokenDoc
 * @returns {{x: number, y: number, level?: *}|null}
 */
export function settledPosition(tokenDoc) {
    return settledSpot(tokenDoc);
}

/**
 * The room this screen shows, and why there is none when there is none. Pure: reads, writes nothing.
 *
 * The gates, in order: a Class Trial (`trialSlot`) shows no room - everybody is in the courtroom, as the
 * clock's room block always said; no viewer is `noActor` for a player and `none` for a GM without a Monokuma
 * (the tile is an empty pane for them, as the clock had no room block); no token on a place scene, or a token
 * outside every room at its settled spot, is `nowhere`; anything else is `room`. An Eclipse is no gate (the
 * character still stands where they stand), nor is death (a body lies in its room) nor a Monocub (it walks
 * with its token).
 *
 * @returns {{state: "trial"|"noActor"|"none"|"nowhere"|"room", room: string|null, scene: Scene|null,
 *   tokenDoc: TokenDocument|null}}
 */
export function viewerRoom() {
    const empty = state => ({ state, room: null, scene: null, tokenDoc: null });
    if (trialSlot()) return empty("trial");
    const actor = viewerActor();
    if (!actor) return empty(game.user.isGM ? "none" : "noActor");
    const place = locateActor(actor);
    if (!place) return empty("nowhere");
    const spot = settledPosition(place.tokenDoc);
    const room = spot ? roomAt(spot.x, spot.y, place.tokenDoc, spot.level) : null;
    return { state: room ? "room" : "nowhere", room, scene: place.scene, tokenDoc: place.tokenDoc };
}

/**
 * What the GM wrote about `room` on `scene`: the description ("" when none) and the picture (a path
 * `safeRoomImage` accepts, else null). The scene is the caller's - `viewerRoom`'s, the token's own - and
 * never the camera's (E12's rule for every room reader).
 *
 * @param {string} room
 * @param {Scene} scene
 * @returns {{room: string, description: string, image: string|null}}
 */
export function roomFacts(room, scene) {
    return { room, description: roomDescription(room, scene), image: roomImage(room, scene) };
}
