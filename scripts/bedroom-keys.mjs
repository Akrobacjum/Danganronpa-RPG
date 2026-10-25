/**
 * THE KEY RULE, ONCE (E14 part 1 C2, 24.10.2026; audit S08-11, S08-31, S08-55, D15).
 *
 * Who may walk through another student's bedroom door was written twice: the door itself (movement.mjs `bedroomShut`,
 * which the veto on the mover's browser and the primary's judge of an arrival both ask) and game.drpg's answer with the
 * GMs' key count (vault.mjs `mayEnterBedroom`, `keysHeldBy`). Both counted every item with the key's flag, a key put
 * away in a stash on the far side of the building too (S08-31), and neither knew that a victim's bedroom is searched in
 * the Investigation (S08-55). Both read this file now.
 *
 * Pure: the callers read the world (whose room it is, what the phase is, whether the owner's death is the table's, and
 * the items as the reader may hold them - the GMs' mark on a GM, `itemsHeldNow`; the document on a player's browser)
 * and this answers. A file of its own because movement.mjs imports neither vault.mjs nor inventory.mjs, and vault.mjs
 * imports movement.mjs: here both import one rule. Its imports are config.mjs and inventory.mjs; with them its static
 * graph is eight files, this one included, and reaches neither movement.mjs nor vault.mjs (read with a walk of the
 * `import ... from` lines at a36e1c30, 24.10.2026), so no cycle is added (R161 holds it).
 */

import { MODULE_ID, BEDROOM_KEY_FLAG } from "./config.mjs";
import { isStashed } from "./inventory.mjs";

/**
 * The rooms the keys among `items` open: a key counts while it is in hand. `stashed: true` counts the stash's too -
 * for the questions that are not the door's: whether a student already holds a key at all, so that the GMs' grant and
 * the sweep make no second one for a key the student put away (vault.mjs `grantBedroomKey`, gm-items.mjs's list).
 */
export function keyRooms(items, { stashed = false } = {}) {
    const rooms = new Set();
    for (const item of items ?? []) {
        const room = item?.getFlag?.(MODULE_ID, BEDROOM_KEY_FLAG);
        if (room && (stashed || !isStashed(item))) rooms.add(room);
    }
    return rooms;
}

/**
 * Is `room`'s door shut to this character? A room nobody owns is no bedroom, and the owner never needs a key to their
 * own door (losing it would lock them out of the one place the guide says is theirs). In the Investigation a dead
 * owner's room opens to everyone - D15, "the dead's bedroom opens in Investigation" - once the death is the table's
 * (`ownerDead`: settings.mjs `isDeceased`, the published flag; a death the GMs keep opens nothing, or the door would
 * tell who died). After the Investigation it needs the key again, until a GM gives the room to somebody else.
 * Otherwise only a key in hand opens it (`keys`, from `keyRooms` without the stash).
 *
 * @param {{ actorId: string|null, room: string|null, ownerId: string|null, keys: Set<string>, phase: string|null,
 *           ownerDead: boolean }} door
 */
export function bedroomShutTo({ actorId, room, ownerId, keys, phase, ownerDead }) {
    if (!room || !ownerId || ownerId === actorId) return false;
    if (ownerDead && phase === "investigation") return false;
    return !keys.has(room);
}
