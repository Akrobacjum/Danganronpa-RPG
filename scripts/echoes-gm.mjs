/**
 * Danganronpa RPG - Echoes, the GMs' half: the nearest room with a living student of another player.
 * ---------------------------------------------------------------------------
 * E69 C7, 13.11.2026 (the owner's 10.11 (b), the plan's C7; docs/dev/plans/E69.md on the plan branch; the audit
 * A113-C5-2). A row of the Infiltrate tile: one action, no roll. The answer is one room - no name, no count - the nearest
 * by crossings from the room the asker stands in: a door (movement.mjs `neighbouringRooms`, Room Setup's lists and the
 * walls), the stairs between floors (`stairLinks`) and a tunnel the asker knows (passages.mjs `passagesKnownBy`, on the
 * GM the GMs' open rows). Rooms the same number of crossings away are a tie, broken at random.
 *
 * WHO COUNTS (the owner's 10.11 (b)): a living student of another player, read on the GM - a character on a token the GMs
 * have not hidden, owned by a player who is not one of the asker's owners; no body (dead as the GMs hold it, a secret
 * death too), no Monokuma, no Monocub, no Spectator, and no GM's character (one no player owns). Read here, on the GM,
 * because a player's browser does not know a death the GMs keep: a body would have counted as a student there.
 *
 * NOT IN AN ECLIPSE (Q-E69-3's default, the orchestrator's 10.11 recommendation): the row is struck through with its
 * reason (action-listen.mjs `infiltrateRows`), and the GM refuses it as well. Nor in a Class Trial or an incident.
 *
 * The asker's own room is not an answer: who stands there the asker sees. A default, written in docs/dev/e69/STATUS.md.
 * The room is named by its region's name, as a tail's card names it, even a room the asker has not explored.
 */

import { MODULE_ID, FLAGS } from "./config.mjs";
import { getClock, isDeadForGm, isEclipse } from "./settings.mjs";
import { log } from "./utils.mjs";

/**
 * The nearest room from `start` that `occupied` names, by the fewest crossings, ties broken by `random` (0 <= x < 1):
 * `{ room, steps }`, or null when none is reachable. `edges(room)` answers the rooms one crossing away. The start room
 * itself is never an answer. Pure (R6023).
 */
export function nearestEchoRoom({ start, edges, occupied, random = Math.random }) {
    if (!start || typeof edges !== "function") return null;
    const seen = new Set([start]);
    let ring = [start];
    for (let steps = 1; ring.length; steps++) {
        const next = [];
        for (const room of ring) {
            for (const other of edges(room) ?? []) {
                if (seen.has(other)) continue;
                seen.add(other);
                next.push(other);
            }
        }
        const found = next.filter(room => occupied.has(room)).sort();
        if (found.length) return { room: found[Math.min(found.length - 1, Math.floor(random() * found.length))], steps };
        ring = next;
    }
    return null;
}

/**
 * Whether `actor` counts for Echoes asked by a character `askerOwners` own (user ids): a living student of another
 * player. `facts` hands in what is read off the world (R6023): `hidden` the token's, `dead` the GMs' record, `owners` the
 * players (no GM) who own it. Pure.
 */
export function echoCounts(actor, askerOwners, { hidden = false, dead = false, owners = [] } = {}) {
    if (!actor || actor.type !== "character" || hidden || dead) return false;
    const flag = name => Boolean(actor.getFlag?.(MODULE_ID, FLAGS[name]) ?? actor.flags?.[MODULE_ID]?.[FLAGS[name]]);
    if (flag("monokuma") || flag("monocub") || flag("spectator")) return false;
    if (!owners.length) return false;
    return owners.some(id => !askerOwners.includes(id));
}

/** The players (no GM) who own `actor`. */
const playerOwners = actor => (game.users ?? []).filter(u => !u.isGM && actor?.testUserPermission?.(u, "OWNER")).map(u => u.id);

/** One crossing from each room of `scene`, for `actor`: the doors, the stairs, the tunnels the actor knows. */
async function crossingsOf(scene, actor) {
    const M = await import("./movement.mjs");
    const links = new Map();
    const link = (a, b) => {
        if (!a || !b || a === b) return;
        if (!links.has(a)) links.set(a, new Set());
        if (!links.has(b)) links.set(b, new Set());
        links.get(a).add(b);
        links.get(b).add(a);
    };
    for (const room of M.allRooms(scene)) for (const other of M.neighbouringRooms(scene, room)) link(room, other);
    for (const [a, b] of M.stairLinks(scene) ?? []) link(a, b);
    try {
        const { passagesKnownBy, endsOf } = await import("./passages.mjs");
        const { isMastermindActor } = await import("./passages-gm.mjs");
        const token = scene.tokens?.find?.(t => t.actorId === actor.id) ?? null;
        for (const row of passagesKnownBy(actor, { mastermind: isMastermindActor(actor) })) {
            if (row.sceneId !== scene.id || !Array.isArray(row.ends) || !token) continue;
            const [a, b] = row.ends.map(end => M.roomAt(end.x, end.y, token, end.level ?? undefined));
            link(a, b);
        }
    } catch {
        // No tunnel is read where the passages cannot be: the doors and the stairs answer alone.
    }
    return links;
}

/** Why Echoes cannot be asked now, as the GMs read it, or null. English: the bridge maps it to a code. */
export async function echoesRefusal(actor) {
    if (isEclipse()) return "an Eclipse is running";
    if (getClock()?.phase === "classTrial") return "that waits until the Class Trial is over";
    const { murderState } = await import("./murder.mjs");
    if (murderState()?.active || isDeadForGm(actor)) return "that cannot be done now";
    return null;
}

/**
 * Echoes on the primary GM (the run of `listen.echoes`): `{ room, steps }` (`room` null when nobody is found), or
 * `{ refused }`.
 */
export async function echoesFor(actor, { random = Math.random } = {}) {
    const why = await echoesRefusal(actor);
    if (why) return { refused: why };
    const M = await import("./movement.mjs");
    const place = M.gmPlaceOf(actor);
    if (!place?.room) return { refused: "the character is not standing in any room" };
    const scene = place.scene;
    const askerOwners = playerOwners(actor);
    const occupied = new Set();
    for (const token of scene.tokens ?? []) {
        const other = token.actor;
        if (!other || other.id === actor.id) continue;
        if (!echoCounts(other, askerOwners, { hidden: Boolean(token.hidden), dead: isDeadForGm(other), owners: playerOwners(other) })) continue;
        const room = M.roomOfToken(token);
        if (room) occupied.add(room);
    }
    const links = await crossingsOf(scene, actor);
    const found = nearestEchoRoom({ start: place.room, edges: room => [...(links.get(room) ?? [])], occupied, random });
    log(`Echoes for ${actor.name} from ${place.room}: ${found ? `${found.room} (${found.steps})` : "nobody"}.`);
    return { room: found?.room ?? null, steps: found?.steps ?? 0 };
}
