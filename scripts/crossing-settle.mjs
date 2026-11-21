/**
 * Danganronpa RPG - a crossing, settled: the one event of another character's move, on the primary GM.
 * ---------------------------------------------------------------------------
 * E69 C2 (12.11.2026; the owner's audit entry E69, S18-28; the 11.10 amendment A10; Q-E69-6's default: a file of its own,
 * so movement.mjs and movement-audit.mjs keep their size). `crossingSettled` - the hook `drpgCrossingSettled` with
 * `{ actorId, from, to, via, eclipse, sceneId }` - fires on the primary GM once a character's token has stood in its new
 * room `SETTLE_MS` without being put back. Tail Someone's cards (E69 C4) and E74's Keep Watch listen to it; nothing else
 * may announce another character's move. Since the audit of 1.2.113 (A113-C4-3) the owner's notices of a stash gone
 * through and of what happened to their bedroom listen too (arrival-notices.mjs), which is why the event names the scene.
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

/** Drop every crossing waiting to settle - the suite's put-back alone (tier 2; the season's reset does not call it).
 *  Answers how many were dropped. */
export function forgetSettling() {
    for (const entry of waiting.values()) clearTimeout(entry.timer);
    const n = waiting.size;
    waiting.clear();
    // And the tokens waiting to stand (`onTokenStood`, below): not counted, as no crossing waits on them.
    for (const timer of standing.values()) clearTimeout(timer);
    standing.clear();
    return n;
}

/*
 * A TOKEN THAT STOOD, WHOEVER MOVED IT (1.2.122, the audit's STG-08 and STG-09, 21.11.2026). A barricade comes down when
 * its author leaves its room, and a pass in use ends when its holder does (doors-gm.mjs, lockpick-gm.mjs) - but the
 * settled crossing above is a player's lawful crossing alone, so a body's discovery, an assembly, the trial's start
 * (call-world.mjs `gatherEveryone`) or a GM's drag took the author or the holder out and nothing ended: the barricade
 * held the empty room shut to everybody, its author too, until the time of day moved, and a pass in use was kept for
 * good. `onTokenStood` hands a listener every token of a character that moved by any road and then stood `ms` (the
 * crossing's own `SETTLE_MS`), on the primary GM alone; the listener reads where it stands and decides. No event is
 * announced to anybody: the listener is the GMs' own bookkeeping.
 */

/** tokenId -> the timer waiting for that token to stand. One map for every listener. */
const standing = new Map();
const stoodListeners = new Set();
let stoodHooked = false;

function onTokenMoved(tokenDoc, change, ms) {
    if (!tokenDoc?.id || !tokenDoc.actorId || !change || !("x" in change || "y" in change || "elevation" in change || "level" in change)) return;
    if (!isPrimaryGm()) return;
    clearTimeout(standing.get(tokenDoc.id));
    const sceneId = tokenDoc.parent?.id ?? null, tokenId = tokenDoc.id, actorId = tokenDoc.actorId;
    standing.set(tokenId, setTimeout(() => {
        standing.delete(tokenId);
        if (!isPrimaryGm()) return;
        // The document in hand, while its scene still holds it (no read of a token by id: R1281's rule).
        const doc = tokenDoc.parent?.tokens?.has?.(tokenId) && tokenDoc.parent?.id === sceneId ? tokenDoc : null;
        if (!doc) return;
        for (const fn of stoodListeners) {
            try {
                Promise.resolve(fn({ actorId, sceneId, tokenId, tokenDoc: doc })).catch(err => log(`A token's stand could not be read: ${err?.message ?? err}`));
            } catch (err) {
                log(`A token's stand could not be read: ${err?.message ?? err}`);
            }
        }
    }, ms));
}

/**
 * Hand `fn({ actorId, sceneId, tokenId, tokenDoc })` every character's token that moved, by any road, and then stood
 * `SETTLE_MS` on the primary GM. Registers Foundry's `updateToken` once for every listener. Answers a function that
 * takes `fn` off again.
 */
export function onTokenStood(fn, { ms = SETTLE_MS } = {}) {
    if (typeof fn !== "function") return () => {};
    stoodListeners.add(fn);
    if (!stoodHooked && globalThis.Hooks?.on) {
        stoodHooked = true;
        Hooks.on("updateToken", (tokenDoc, change) => onTokenMoved(tokenDoc, change, ms));
    }
    return () => stoodListeners.delete(fn);
}
