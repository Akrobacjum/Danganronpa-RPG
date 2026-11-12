/**
 * Danganronpa RPG - Pick the Lock's pass, the GMs' half and the owner's copy.
 * ---------------------------------------------------------------------------
 * E74, 12.11.2026 (DA9 as the plan has it: "Pick the Lock opens for the picker only, until they leave the room"; the
 * owner's "Wole zgodnie z planem" of that day, through the coordinator; the plan's C4, read on the plan branch's
 * docs/dev/plans/E74.md). Until this file an open walked the picker through at once (a GM's move) and kept nothing.
 *
 * WHAT A PASS IS. An open of Pick the Lock (doors-gm.mjs `pickLock`) gives the picker a pass to the room beyond the
 * door: a row of the GMs' store `lockpicks` (gm-stores.mjs `lockpickStore`), one a picker. While it stands the doors'
 * fixed rules - a GM's lock, a bedroom shut to them, a seal - let that character, and nobody else, walk into that room
 * (movement.mjs `holdsPass`, asked by `restrictedFrom`), on their own move veto and in the GMs' audit alike. The lock
 * stays locked for everyone else. A barricade is no lock: Pick the Lock is refused at one.
 *
 * WHEN IT ENDS (the plan: "valid until leaving that room and lost without an entry this time of day"). The picker's
 * settled crossing out of the room, once they have walked in (crossing-settle.mjs `CROSSING_SETTLED`); the time of day's
 * end, for a pass not used in it (one in use is kept until its holder leaves); a new pick, which replaces it; a Reroll
 * of the pick below its number, while it is not used (infiltrate-reroll.mjs); the season reset (the store's "actions"
 * group).
 *
 * THE OWNER'S COPY. The walker's own browser judges a move first (the veto), and it holds no GM store, so each owner
 * holds a copy of their own characters' passes (gm-stores.mjs `lockpickCopy`), sent by the primary GM when a pass is
 * given or ends and when the owner asks (at load, and when a primary GM's world has loaded, `drpgPrimaryReady`), as the
 * Eclipse's crossings are (eclipse.mjs). Asking is the owner's; answering is the primary's alone, about the asker's own
 * characters, found from Foundry's `senderId`; the copy is taken only from a GM, and only for a character this user
 * owns. A stale copy lets an honest veto try a walk the GMs' audit then sends back; it never opens a door the GMs hold
 * shut.
 */

import { MODULE_ID } from "./config.mjs";
import { getClock } from "./settings.mjs";
import { isPrimaryGm, primaryGmId, log, error } from "./utils.mjs";
import { lockpickStore, lockpickCopy } from "./gm-stores.mjs";
import { gmStoresQuiet, whenGmStoresAudible } from "./gm-store.mjs";
import { replyForMe } from "./bridge-guards.mjs";
import { CROSSING_SETTLED } from "./crossing-settle.mjs";

const SOCKET_EVENT = `module.${MODULE_ID}`;
const ACTION_PASSES = "lockpick.passes";
const ACTION_PASSES_ASK = "lockpick.passesAsk";

/** The time of day a pass is given in: the clock's chapter, day and time of day. */
const markNow = () => { const c = getClock() ?? {}; return `${c.chapter ?? 0}:${c.day ?? 0}:${c.timeOfDay ?? ""}`; };

/** The users who own `actor`, players only. */
const ownersOf = actor => (game.users ?? []).filter(u => !u.isGM && actor?.testUserPermission?.(u, "OWNER")).map(u => u.id);

/** This GM's row of `actorId`'s pass, or null. */
export function passOf(actorId) {
    return lockpickStore.get(actorId) ?? null;
}

/** Give `actor` a pass to `room` on `scene` (an open of Pick the Lock, on the primary). Replaces one they held. */
export async function grantPass(actor, scene, room) {
    await lockpickStore.whenHydrated();
    await lockpickStore.patch(actor.id, { actorId: actor.id, sceneId: scene.id, room, mark: markNow(), entered: false, at: Date.now() });
    tellOwners(actor);
    log(`${actor.name} holds a pass to ${room}.`);
}

/** End `actorId`'s pass. Answers whether there was one. */
export async function endPass(actorId) {
    if (!lockpickStore.get(actorId)) return false;
    await lockpickStore.drop(actorId);
    tellOwners(game.actors.get(actorId));
    return true;
}

/** A settled crossing: a picker walking into their pass's room keeps it in use; one walking out of it after ends it. */
export async function onPassCrossing(event = {}) {
    if (!game.user?.isGM || !event.actorId) return false;
    const row = lockpickStore.get(event.actorId);
    if (!row) return false;
    if (event.to === row.room && !row.entered) {
        await lockpickStore.patch(event.actorId, { entered: true });
        return true;
    }
    if (row.entered && event.from === row.room && event.to !== row.room) return endPass(event.actorId);
    return false;
}

/** A new time of day: every pass not used in the one before is lost; one in use stays. Answers how many ended. */
export async function passesAtNewTimeOfDay() {
    let n = 0;
    for (const [actorId, row] of Object.entries(lockpickStore.entries() ?? {})) {
        if (!row?.entered && (await endPass(actorId))) n++;
    }
    return n;
}

/**
 * GM: one user's own characters' passes, and only those, with a stamp per character they own (0 for one this browser
 * never held, which takes nothing away on the owner's side).
 */
export function passesFor(userId) {
    const user = game.users.get(userId);
    const passes = {}, stamps = {};
    if (!game.user?.isGM || !user || user.isGM) return { passes, stamps };
    for (const actor of game.actors ?? []) {
        if (actor.type !== "character" || !actor.testUserPermission?.(user, "OWNER")) continue;
        stamps[actor.id] = lockpickStore.newest(actor.id);
        const row = lockpickStore.get(actor.id);
        if (row) passes[actor.id] = { sceneId: row.sceneId, room: row.room };
    }
    return { passes, stamps };
}

/** Primary GM: send one user their passes. Addressed, and only while they are here; nothing while the suite holds the stores. */
export function sendPassesTo(userId) {
    const user = game.users.get(userId);
    if (!game.user?.isGM || !user?.active || user.isGM || gmStoresQuiet()) return false;
    const { passes, stamps } = passesFor(userId);
    game.socket.emit(SOCKET_EVENT, { action: ACTION_PASSES, userId, passes, stamps }, { recipients: [userId] });
    return true;
}

/** Tell `actor`'s owners their passes again (a pass given or ended). */
function tellOwners(actor) {
    if (!actor || !isPrimaryGm()) return;
    for (const userId of ownersOf(actor)) sendPassesTo(userId);
}

/** After a restore (gm-stores.mjs `restoreCase`): every connected player is sent their passes again. Answers how many. */
export async function retellPasses() {
    if (!game.user?.isGM || gmStoresQuiet()) return 0;
    let sent = 0;
    for (const user of game.users ?? []) if (user.active && !user.isGM && sendPassesTo(user.id)) sent++;
    return sent;
}

/** Owner: take the primary's answer where it is newer (`lockpickCopy`), for this user's own characters only. */
export async function receivePasses(passes, stamps) {
    const mine = {}, own = {};
    for (const [actorId, s] of Object.entries(stamps ?? {})) {
        if (!game.actors.get(actorId)?.isOwner) continue;
        own[actorId] = Number(s) || 0;
        const row = passes?.[actorId];
        if (row && typeof row === "object" && typeof row.room === "string" && typeof row.sceneId === "string") {
            mine[actorId] = { sceneId: row.sceneId, room: row.room };
        }
    }
    return lockpickCopy.receive(mine, own);
}

/** Owner: ask the primary for this user's passes. */
function askForPasses(primary = primaryGmId()) {
    if (!primary || game.user.isGM) return;
    try {
        game.socket.emit(SOCKET_EVENT, { action: ACTION_PASSES_ASK }, { recipients: [primary] });
    } catch (err) {
        error("Could not ask the GM for this character's passes", err);
    }
}

function onPassesSocket(payload, senderId) {
    if (payload?.action === ACTION_PASSES_ASK) {
        if (!isPrimaryGm()) return;
        const sender = game.users.get(senderId);
        if (!sender?.active || sender.isGM) return;
        whenGmStoresAudible().then(() => lockpickStore.whenHydrated()).then(() => sendPassesTo(sender.id))
            .catch(err => error("Could not answer an owner's passes", err));
        return;
    }
    if (payload?.action !== ACTION_PASSES || game.user.isGM) return;
    // A GM's, and addressed to this user: a player cannot hand another a pass.
    if (!replyForMe(payload, senderId)) return;
    receivePasses(payload.passes, payload.stamps).catch(err => error("Could not keep a pass", err));
}

/** At ready: the copy's listener on every client, an owner's first ask, and the primary's listeners. */
export function registerLockpicks() {
    game.socket.on(SOCKET_EVENT, onPassesSocket);
    Hooks.on(CROSSING_SETTLED, event => {
        if (isPrimaryGm()) onPassCrossing(event).catch(err => error("A pass could not follow its holder", err));
    });
    Hooks.on("drpgTimeOfDayChanged", () => {
        if (isPrimaryGm()) passesAtNewTimeOfDay().catch(err => error("The unused passes could not be ended", err));
    });
    if (game.user.isGM) return;
    askForPasses();
    Hooks.on("drpgPrimaryReady", primary => askForPasses(primary));
}
