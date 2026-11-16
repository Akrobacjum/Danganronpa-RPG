/**
 * Danganronpa RPG - a project's room action used up, on its user's browser.
 * ---------------------------------------------------------------------------
 * P2 (15.11.2026; the owner's ask through the coordinator: "a project action gets a use limit the GM sets"; the owner
 * confirmed per character, and the three limits "none", "timeOfDay" and "day", a project with none named reading
 * "timeOfDay", today's rule). Who used which project's action when is the GMs' (gm-stores.mjs `facilityUseStore`,
 * judged on the primary GM in bridge-runs-acts.mjs `handleFacilityUse`, which stays the authority). So the Facilities
 * window can grey a row with its reason before a player pays for a refusal, each player is sent their own characters'
 * rows of it, and nothing else: `{ "p:<projectId>:<actorId>": { mark } }` (`facilityUseCopy`). The copy only greys; a
 * console that edits it reaches a refusal on the GM, as before.
 *
 * As lockpick-gm.mjs sends a pass: addressed to the user, only while they are here, after each use and at their ask
 * (their ready, and a new primary's); taken where newer, for this user's own characters only.
 */

import { MODULE_ID } from "./config.mjs";
import { isPrimaryGm, primaryGmId, error } from "./utils.mjs";
import { facilityUseStore, facilityUseCopy } from "./gm-stores.mjs";
import { gmStoresQuiet, whenGmStoresAudible } from "./gm-store.mjs";
import { replyForMe } from "./bridge-guards.mjs";

const SOCKET_EVENT = `module.${MODULE_ID}`;
const ACTION_USES = "facility.uses";
const ACTION_USES_ASK = "facility.usesAsk";

/** The actor a project action's key names (`p:<projectId>:<actorId>`, facilities.mjs `projectActionKey`), or null. */
function actorOfKey(key) {
    const m = /^p:[^:]+:([^:]+)$/.exec(String(key ?? ""));
    return m ? m[1] : null;
}

/** GM: one user's own characters' project-action uses, and only those, a stamp per row. */
export function usesFor(userId) {
    const user = game.users.get(userId);
    const uses = {}, stamps = {};
    if (!game.user?.isGM || !user || user.isGM) return { uses, stamps };
    for (const [key, row] of Object.entries(facilityUseStore.entries() ?? {})) {
        const actor = game.actors.get(actorOfKey(key) ?? "");
        if (!actor || actor.type !== "character" || !actor.testUserPermission?.(user, "OWNER")) continue;
        stamps[key] = facilityUseStore.newest(key);
        if (typeof row?.mark === "string") uses[key] = { mark: row.mark };
    }
    return { uses, stamps };
}

/** Primary GM: send one user their uses. Addressed, only while they are here; nothing while the suite holds the stores. */
function sendUsesTo(userId) {
    const user = game.users.get(userId);
    if (!game.user?.isGM || !user?.active || user.isGM || gmStoresQuiet()) return false;
    const { uses, stamps } = usesFor(userId);
    game.socket.emit(SOCKET_EVENT, { action: ACTION_USES, userId, uses, stamps }, { recipients: [userId] });
    return true;
}

/** Primary GM: tell `actor`'s owners their uses again (a project's action used). Answers how many were sent. */
export function tellUsesOf(actor) {
    if (!actor || !isPrimaryGm()) return 0;
    let sent = 0;
    for (const user of game.users ?? []) {
        if (!user.isGM && actor.testUserPermission?.(user, "OWNER") && sendUsesTo(user.id)) sent++;
    }
    return sent;
}

/** After a restore (gm-stores.mjs `restoreCase`): every connected player is sent their uses again. Answers how many. */
export async function retellUses() {
    if (!game.user?.isGM || gmStoresQuiet()) return 0;
    let sent = 0;
    for (const user of game.users ?? []) if (user.active && !user.isGM && sendUsesTo(user.id)) sent++;
    return sent;
}

/** Owner: take the primary's answer where it is newer, for this user's own characters' rows only. */
async function receiveUses(uses, stamps) {
    const mine = {}, own = {};
    for (const [key, s] of Object.entries(stamps ?? {})) {
        if (!game.actors.get(actorOfKey(key) ?? "")?.isOwner) continue;
        own[key] = Number(s) || 0;
        const row = uses?.[key];
        if (row && typeof row === "object" && typeof row.mark === "string") mine[key] = { mark: row.mark };
    }
    return facilityUseCopy.receive(mine, own);
}

/** Owner: ask the primary for this user's uses. */
function askForUses(primary = primaryGmId()) {
    if (!primary || game.user.isGM) return;
    try {
        game.socket.emit(SOCKET_EVENT, { action: ACTION_USES_ASK }, { recipients: [primary] });
    } catch (err) {
        error("Could not ask the GM for this character's room action uses", err);
    }
}

function onUsesSocket(payload, senderId) {
    if (payload?.action === ACTION_USES_ASK) {
        if (!isPrimaryGm()) return;
        const sender = game.users.get(senderId);
        if (!sender?.active || sender.isGM) return;
        whenGmStoresAudible().then(() => facilityUseStore.whenHydrated()).then(() => sendUsesTo(sender.id))
            .catch(err => error("Could not answer an owner's room action uses", err));
        return;
    }
    if (payload?.action !== ACTION_USES || game.user.isGM) return;
    // A GM's, and addressed to this user: a player cannot hand another a use.
    if (!replyForMe(payload, senderId)) return;
    receiveUses(payload.uses, payload.stamps).catch(err => error("Could not keep a room action use", err));
}

/**
 * A project's action's use as this browser may read it: the GMs' row on a GM, this user's copy on a player's (for their
 * own characters), or null.
 */
export function useRowOf(key) {
    if (game.user?.isGM) return facilityUseStore.get(key) ?? null;
    return (facilityUseCopy.read() ?? {})[key] ?? null;
}

/** At init (module.mjs): the copy's listener on every client; an owner's first ask at ready. */
export function registerFacilityUses() {
    game.socket.on(SOCKET_EVENT, onUsesSocket);
    /* A player's first ask, at `ready`: this registers at `init` (module.mjs), where `game.user` is null on Foundry 14.370
       (read on the owner's sandbox, 16.11.2026, E58 L1) - the ask read `game.user.isGM` here and threw on every browser,
       so a player's browser never asked for its copy at a load and held none until the next change sent one. */
    Hooks.once("ready", () => {
        if (!game.user?.isGM) askForUses();
    });
    Hooks.on("drpgPrimaryReady", primary => askForUses(primary));
}
