/**
 * Danganronpa RPG - what an owner is told on coming to stand in a room, on the primary GM.
 * ---------------------------------------------------------------------------
 * The audit of 1.2.113 (13.11.2026; A113-C4-3). A notice waits for a character to walk into a room: that somebody has
 * been in their stash there (1.2.112, the owner's decision of 13.11.2026; stash-reach.mjs `tellStashDisturbed`).
 *
 * THE ROADS. It was told only from the paid crossing's hook (traps.mjs `onCrossed`, raised at the end of movement.mjs
 * `chargeForCrossing`), which never fires with crossing rooms free, in an Eclipse, or for a GM's placement. It is told
 * now from:
 *
 * - the settled crossing (crossing-settle.mjs `CROSSING_SETTLED`): every lawful crossing of a player the GMs record, an
 *   Eclipse's and a free one's included, once the token has stood in its room `SETTLE_MS` without being put back;
 * - a GM's own move of a character's token into another room (movement.mjs `noteGmPosition`, which calls
 *   `noticesOnArrival`): a drag, a placement, a gather - no player's crossing, so none the GMs record. A put-back the
 *   module writes is not an arrival.
 *
 * The paid crossing's hook still tells the stash's notice at once; the settled crossing that follows it finds the notice
 * told, since `tellStashDisturbed` takes one owner at a time.
 *
 * NOT THE BEDROOM'S NOTE. doors-gm.mjs `noteBedroom` (b70b3b23: a door forced, a careless pick, a breach, a repair) is
 * told from traps.mjs `onCrossed` alone, as the stash's was; joining it here would tell it on these roads too, which is a
 * change of its behaviour the coordinator kept out of this round (13.11.2026).
 */

import { isPrimaryGm, error } from "./utils.mjs";
import { CROSSING_SETTLED } from "./crossing-settle.mjs";

/**
 * `actor` has come to stand in `room` on `scene`: the stash's notice waiting for them there is told. On the primary alone.
 * Answers `{ stash }`, whether it was told.
 */
export async function noticesOnArrival(actor, room, scene) {
    // Any actor: only a character owns a stash, so another finds no row in the store.
    if (!isPrimaryGm() || !actor || !room || !scene) return { stash: false };
    const stash = await import("./stash-reach.mjs").then(m => m.tellStashDisturbed(actor, room, scene))
        .catch(err => { error("A stash's owner could not be told on entering", err); return false; });
    return { stash };
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
