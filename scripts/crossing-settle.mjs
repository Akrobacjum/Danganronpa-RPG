/**
 * Danganronpa RPG - a crossing, settled: the one event of another character's move, on the primary GM.
 * ---------------------------------------------------------------------------
 * E69 C2 (12.11.2026; the owner's audit entry E69, S18-28; the 11.10 amendment A10; Q-E69-6's default: a file of its own,
 * so movement.mjs and movement-audit.mjs keep their size). `crossingSettled` - the hook `drpgCrossingSettled` with
 * `{ actorId, from, to, via, eclipse, sceneId }` - fires on the primary GM once a character's token has stood in its new
 * room `SETTLE_MS` without being put back. Tail Someone's cards (E69 C4) and E74's Keep Watch listen to it; nothing else
 * may announce another character's move. Since the audit of 1.2.113 (A113-C4-3, A113-C5-1) the owner's notices of a stash
 * gone through and of a picked lock listen too (arrival-notices.mjs), which is why the event names the scene.
 *
 * WHICH CROSSINGS. Those the GMs record (movement.mjs `recordCrossingInStep`): a player's lawful crossing the judge read
 * (`noteCrossing`, which skips a GM's own move, a put-back, a scene that is no place - the trial hall - and a Monokuma),
 * and a tunnel the primary carries out on a player's `passage.cross` (A10: a passage, a breach and a tunnel count as any
 * crossing; `via` names how, and stays on the primary). A GM dragging a token, a gather, a Public Announcement and a
 * send-back are no player's lawful crossing and are not recorded, so they settle nothing.
 *
 * ONE EVENT A RUN OF CROSSINGS. A drag through several rooms in a row is one event: a crossing waiting to settle is
 * replaced by the next one of the same character, which keeps the first `from` - so the event says where the run began
 * and where it stopped. A token no longer in the room it crossed into when the wait ends (put back, or moved on and the
 * next crossing not recorded) settles nothing.
 */

import { isPrimaryGm, log } from "./utils.mjs";

/** How long a token stands in its new room before its crossing settles: the plan's "about 2 s". A design number, LIVE-E69-04 measures it. */
export const SETTLE_MS = 2000;

/** The name of the hook every listener asks for. */
export const CROSSING_SETTLED = "drpgCrossingSettled";

/** actorId -> the crossing waiting to settle: `{ timer, from, to, via, eclipse, tokenId, sceneId }`. */
const waiting = new Map();

/**
 * A crossing the GMs recorded, to settle after `ms`. `roomNow(tokenDoc)` reads the room the token stands in when the wait
 * ends (movement.mjs `roomOfToken`, handed in so this file imports no movement code). Answers whether it was scheduled.
 */
export function scheduleSettle(actorId, tokenDoc, { from = null, to = null, via = null, eclipse = null } = {}, { ms = SETTLE_MS, roomNow } = {}) {
    if (!isPrimaryGm() || !actorId || !tokenDoc?.id || !to || typeof roomNow !== "function") return false;
    const before = waiting.get(actorId);
    if (before) clearTimeout(before.timer);
    const entry = { from: before ? before.from : from, to, via, eclipse, tokenId: tokenDoc.id, sceneId: tokenDoc.parent?.id ?? null };
    entry.timer = setTimeout(() => settle(actorId, entry, roomNow), ms);
    waiting.set(actorId, entry);
    return true;
}

/** The wait is over: the event, where the token still stands in the room it crossed into and the run moved it at all. */
function settle(actorId, entry, roomNow) {
    if (waiting.get(actorId) !== entry) return;
    waiting.delete(actorId);
    if (!isPrimaryGm()) return;
    const tokenDoc = game.scenes.get(entry.sceneId ?? "")?.tokens?.get(entry.tokenId) ?? null;
    if (!tokenDoc || roomNow(tokenDoc) !== entry.to || entry.from === entry.to) return;
    const event = { actorId, from: entry.from, to: entry.to, via: entry.via ?? null, eclipse: entry.eclipse ?? null, sceneId: entry.sceneId ?? null };
    log(`A crossing settled: ${actorId} from ${event.from} to ${event.to}${event.via ? ` (${event.via})` : ""}.`);
    Hooks.callAll(CROSSING_SETTLED, event);
}

/** Drop every crossing waiting to settle (the suite's put-back, a world's reset). Answers how many were dropped. */
export function forgetSettling() {
    for (const entry of waiting.values()) clearTimeout(entry.timer);
    const n = waiting.size;
    waiting.clear();
    return n;
}
