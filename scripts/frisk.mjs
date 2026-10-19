/**
 * Danganronpa RPG - Frisk, a Palm's third direction: seeing what somebody carries (E80 part 2, the A11 design).
 * ---------------------------------------------------------------------------
 * What the primary GM holds of an open Frisk. The asks live in this GM's memory, never in a store, a flag or a
 * setting: a reload or a new primary ends them with no dice thrown (the design's risk 3; E18 may move them). C0
 * builds only what a drawn roll asks of them - whether a searcher may force one now - and the map stays empty
 * until the ask's road (C3) writes it.
 */

import { SETTINGS, getSetting } from "./settings.mjs";

/**
 * The asks this primary GM holds, by ask id: `{ searcherId, targetId, state, forceUntil }`. `state` is "refused" or
 * "noAnswer" once the target refused or the answer's clock ran out, and from then until `forceUntil` (epoch ms) the
 * searcher may force it; any other state is no force.
 */
export const friskAsks = new Map();

/** The states of an ask that open a force (the owner's 1 = a: after a refusal or no answer, never before). */
const FORCEABLE = Object.freeze(["refused", "noAnswer"]);

/**
 * Whether `searcherId` may draw a Frisk's force now: the GMs' `friskForce` is on and an ask of theirs stands refused or
 * unanswered inside its window. Asked by roll-draw.mjs `drawRefusal` before a `frisk` roll takes its ticket.
 */
export function friskForceOpen(searcherId, now = Date.now()) {
    if (!searcherId || getSetting(SETTINGS.friskForce) !== true) return false;
    for (const row of friskAsks.values()) {
        if (row?.searcherId === searcherId && FORCEABLE.includes(row.state) && Number(row.forceUntil) > now) return true;
    }
    return false;
}
