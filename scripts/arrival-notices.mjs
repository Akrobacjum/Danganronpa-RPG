/**
 * Danganronpa RPG - what an owner is told on coming to stand in a room, on the primary GM.
 * ---------------------------------------------------------------------------
 * The audit of 1.2.113 (13.11.2026; A113-C4-3). Two notices wait for a character to walk into a room: that somebody has
 * been in their stash there (1.2.112, the owner's decision of 13.11.2026; stash-reach.mjs `tellStashDisturbed`), and
 * what happened to their bedroom's door or a wall while they were away - forced, picked carelessly, breached, repaired
 * (b70b3b23, the owner's rule #1 of 13.11.2026; doors-gm.mjs `noteBedroom`, `tellBedroomNotes`).
 *
 * THE ROADS. Each was told only from the paid crossing's hook (traps.mjs `onCrossed`, raised at the end of movement.mjs
 * `chargeForCrossing`), which never fires with crossing rooms free, in an Eclipse, or for a GM's placement. It is told
 * now from:
 *
 * - the settled crossing (crossing-settle.mjs `CROSSING_SETTLED`): every lawful crossing of a player the GMs record, an
 *   Eclipse's and a free one's included, once the token has stood in its room `SETTLE_MS` without being put back;
 * - a GM's own move of a character's token into another room (movement.mjs `noteGmPosition`, which calls
 *   `noticesOnArrival`): a drag, a placement, a gather - no player's crossing, so none the GMs record. A put-back the
 *   module writes is not an arrival.
 *
 * The paid crossing's hook still tells both at once; the settled crossing that follows it finds them told, since
 * `tellStashDisturbed` and `tellBedroomNotes` each take one owner at a time. The bedroom's note joined these roads on the
 * coordinator's follow-up of 14.11.2026: the E74 plan's DA30 says "also in an Eclipse, from crossingSettled", and the
 * owner's rule is "told on walking back in". Its store, and its card at once to an owner standing in the bedroom, are
 * pv-doors' as they were.
 */

import { isPrimaryGm, error } from "./utils.mjs";
import { CROSSING_SETTLED } from "./crossing-settle.mjs";

/**
 * `actor` has come to stand in `room` on `scene`: every notice waiting for them there is told. On the primary alone.
 * Answers `{ stash, bedroom }`, whether each was told.
 */
export async function noticesOnArrival(actor, room, scene) {
    // Any actor: only a character owns a stash or a bedroom, so another finds no row in either store.
    if (!isPrimaryGm() || !actor || !room || !scene) return { stash: false, bedroom: false };
    const stash = await import("./stash-reach.mjs").then(m => m.tellStashDisturbed(actor, room, scene))
        .catch(err => { error("A stash's owner could not be told on entering", err); return false; });
    const bedroom = await import("./doors-gm.mjs").then(m => m.tellBedroomNotes(actor, room, scene))
        .catch(err => { error("A bedroom's owner could not be told on entering", err); return false; });
    return { stash, bedroom };
}

/** The listener, on every browser, acting on the primary GM alone. */
export function registerArrivalNotices() {
    Hooks.on(CROSSING_SETTLED, event => {
        if (!isPrimaryGm() || !event?.actorId || !event.to) return;
        const actor = game.actors?.get(event.actorId);
        const scene = game.scenes?.get(event.sceneId ?? "") ?? null;
        if (actor && scene) void noticesOnArrival(actor, event.to, scene);
    });
}
