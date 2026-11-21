/**
 * HIDDEN STASHES (1.2.122 line ITEMS; the audit's CORE-25).
 * ---------------------------------------------------------------------------
 * A stash its owner built a hiding place for is the one fact Find Stash (Analyze) exists to open, and until 1.2.122 it
 * was written on the room's region documents - `drpgStashes`, `[{ actorId, concealed }]` - which Foundry sends to every
 * browser with the scene: a player's console read which rooms hold a hidden stash and whose it is, without the roll the
 * rule asks. Since 1.2.122 a hidden stash is no entry of any region. It is a row of the GMs' store `hiddenStashes`
 * (gm-stores.mjs `hiddenStashStore`), keyed `<sceneId>|<actorId>|<room>`, `{ sceneId, actorId, room }`; the region's list
 * keeps the open stashes alone, as `[{ actorId }]`. vault-store.mjs `stashesOn` reads both, so every reader of a room's
 * stashes (`stashesIn`, `stashIn`, `stashRoomsFor` ...) still answers `{ actorId, concealed }` where this browser may
 * know it:
 *
 * - a GM's browser reads the store;
 * - a player's browser reads its copy (`hiddenStashCopy`, the client setting `mineHiddenStashes`): the hidden stashes of
 *   the characters this player owns, and every hidden stash for the Mastermind's player, to whom a hiding place is
 *   furniture they watched being built (Dawid, 26.08; stash-reach.mjs `openStashesHere` keeps that exception); and,
 *   since 1.2.123, the hidden stashes this player's characters FOUND - each row whose `foundKey` stands on a found list
 *   of theirs as the GMs hold it (`foundRowsFor`). Without them a finder's browser held no row of the stash they had
 *   found, so `openStashesHere` had nothing to keep and the sheet and Rifle showed nothing (the auditor's
 *   r122-ITEMS-R-3, a regression of 1.2.122's CORE-25: until then the region carried every hidden entry to every
 *   browser). A player who found nothing is sent no row of anyone else's: the secrecy CORE-25 bought stands. Rifle is
 *   still judged by the GMs (stash-reach.mjs `stealFromVault` asks the GMs' copy of the list).
 *
 * The copy is sent by a GM's browser to each owner, and each finder, when a row of theirs changes (`tellHiddenStashes`),
 * to a character's players when its found list changes (a find, a reset's cut: the `updateActor` watch below), to every
 * connected player after a restore (`retellHiddenStashes`) and to a player who asks at their load or at a primary's
 * (`askForHiddenStashes`). A world from before 1.2.122 is lifted once by migrate.mjs `liftHiddenStashes` (this file's
 * `liftHiddenStashes`): each region entry with `concealed` true, and each legacy `drpgVaultConcealed`, into the store,
 * read back, then off the region.
 */

import { MODULE_ID } from "./config.mjs";
import { isPrimaryGm, primaryGmId, log, error } from "./utils.mjs";
// Leaves alone, statically (vault-store.mjs imports this file, R161); the rest by `import()` where it is used.
import { gmStoreByName, readMine, gmStoresQuiet, whenGmStoresAudible, gmStoreStamp } from "./gm-store.mjs";

const SOCKET_EVENT = `module.${MODULE_ID}`;
/* vault-store.mjs `VAULT_FLAGS.found`, spelt here: vault-store.mjs imports this file (R161). */
const FOUND_FLAG = "drpgStashesFound";
const ACTION_ROWS = "stash.hidden";
const ACTION_ASK = "stash.hiddenAsk";

/** The store's and the copy's names (gm-stores.mjs). Looked up by name: this file is read by vault-store.mjs, a leaf's neighbour. */
export const HIDDEN_STASHES = "hiddenStashes";

/** The row key of one hidden stash. The room last, so a room's name may hold the separator. */
export const hiddenKey = (sceneId, actorId, room) => `${sceneId}|${actorId}|${room}`;

/** `{ sceneId, actorId, room }` of a key, or null. */
export function hiddenOfKey(key) {
    const text = String(key ?? "");
    const a = text.indexOf("|"), b = a < 0 ? -1 : text.indexOf("|", a + 1);
    if (a <= 0 || b <= a + 1 || b === text.length - 1) return null;
    return { sceneId: text.slice(0, a), actorId: text.slice(a + 1, b), room: text.slice(b + 1) };
}

const store = () => gmStoreByName(HIDDEN_STASHES);

/**
 * The actor ids of the hidden stashes in `room` on the scene `sceneId`, as this browser may know them: the GMs' rows on
 * a GM, this player's copy on a player's browser. Synchronous; an empty list before the store or the copy is read.
 */
export function hiddenStashesAt(sceneId, room) {
    if (!sceneId || !room) return [];
    if (game.user?.isGM) {
        const handle = store();
        if (!handle) return [];
        const out = [];
        for (const [key, row] of Object.entries(handle.entries() ?? {})) {
            const at = hiddenOfKey(key);
            if (at && row && at.sceneId === sceneId && at.room === room) out.push(at.actorId);
        }
        return out;
    }
    const copy = readMine(HIDDEN_STASHES) ?? {};
    const out = [];
    for (const [actorId, rows] of Object.entries(copy)) {
        if (Array.isArray(rows) && rows.some(r => r?.sceneId === sceneId && r?.room === room)) out.push(actorId);
    }
    return out;
}

/** Every hidden row the GMs hold, as `[{ key, sceneId, actorId, room }]`. GM only; [] elsewhere. */
export function hiddenStashRows() {
    if (!game.user?.isGM) return [];
    return Object.keys(store()?.entries() ?? {}).map(key => ({ key, ...hiddenOfKey(key) })).filter(r => r.sceneId);
}

/**
 * Hide or open one person's stash in one room (GM). `hidden` true writes the row, false drops it; answers whether the
 * store changed. The owners (and the Mastermind's player) are told after.
 */
export async function setHiddenStash(sceneId, room, actorId, hidden) {
    const handle = store();
    if (!game.user?.isGM || !handle || !sceneId || !room || !actorId) return false;
    const key = hiddenKey(sceneId, actorId, room);
    const has = handle.has(key);
    if (hidden && !has) await handle.patch(key, { sceneId, actorId, room });
    else if (!hidden && has) await handle.drop(key);
    else return false;
    tellHiddenStashes(actorId);
    return true;
}

/** A room renamed on a scene: its hidden rows follow the new name (vault-store.mjs's carry). Answers how many moved. */
export async function renameHiddenStashes(sceneId, from, to) {
    const handle = store();
    if (!game.user?.isGM || !handle || !sceneId || !from || !to || from === to) return 0;
    let moved = 0;
    for (const row of hiddenStashRows()) {
        if (row.sceneId !== sceneId || row.room !== from) continue;
        await handle.patch(hiddenKey(sceneId, row.actorId, to), { sceneId, actorId: row.actorId, room: to });
        await handle.drop(row.key);
        tellHiddenStashes(row.actorId);
        moved++;
    }
    return moved;
}

/* ------------------------------ the owners' copy ------------------------------ */

/** The players who own `actorId`, the players of a character who found one of its stashes, and the Mastermind's player. */
async function readersOf(actorId) {
    const ownersOf = actor => (game.users ?? []).filter(u => !u.isGM && actor?.testUserPermission?.(u, "OWNER")).map(u => u.id);
    const owners = ownersOf(game.actors.get(actorId));
    const finders = [];
    const found = await foundListsNow();
    for (const actor of game.actors ?? []) {
        if (actor.id !== actorId && found(actor).some(key => String(key).endsWith(`::${actorId}`))) finders.push(...ownersOf(actor));
    }
    return [...new Set([...owners, ...finders, ...(await mastermindPlayers())])];
}

/* Each character's found list as the GMs hold it (sheet-audit.mjs `flagsHeldNow`: a player's own write is put back), read
   by vault-store.mjs `stashesFoundBy` - both by `import()`: vault-store.mjs imports this file (R161). */
async function foundListsNow() {
    const [{ stashesFoundBy }, { flagsHeldNow }] = await Promise.all([import("./vault-store.mjs"), import("./sheet-audit.mjs")]);
    return actor => stashesFoundBy(flagsHeldNow(actor) ?? actor);
}

/* The hidden rows the characters in `actors` found (r122-ITEMS-R-3): `{ actorId: [{ sceneId, room }] }`, only of a row
   whose found key - vault-store.mjs `foundKey`, `<sceneId>::<room>::<ownerId>` - stands on one of their lists. */
async function foundRowsFor(actors) {
    const found = await foundListsNow();
    const keys = new Set(actors.flatMap(actor => found(actor)));
    const out = {};
    if (!keys.size) return out;
    for (const row of hiddenStashRows()) {
        if (!keys.has(`${row.sceneId}::${row.room}::${row.actorId}`)) continue;
        (out[row.actorId] ??= []).push({ sceneId: row.sceneId, room: row.room });
    }
    return out;
}

/** The players of the Mastermind (mastermind.mjs reads the GMs' record). */
async function mastermindPlayers() {
    try {
        const { mastermindActor } = await import("./mastermind.mjs");
        const mm = mastermindActor();
        return mm ? (game.users ?? []).filter(u => !u.isGM && mm.testUserPermission?.(u, "OWNER")).map(u => u.id) : [];
    } catch {
        return [];
    }
}

/**
 * What one player may hold: `{ rows: { actorId: [{ sceneId, room }] }, stamps: { actorId: stamp } }` - every character
 * they own, a list each (empty where none is hidden), and every character for the Mastermind's player. One stamp, this
 * moment's, for each: the answer is the user's whole set (gm-stores.mjs `offersCombine`).
 */
async function rowsFor(userId) {
    const user = game.users.get(userId);
    const all = (await mastermindPlayers()).includes(userId);
    const actors = (game.actors ?? []).filter(a => all || a.testUserPermission?.(user, "OWNER"));
    const rows = {}, stamps = {};
    const now = gmStoreStamp();
    for (const actor of actors) {
        rows[actor.id] = [];
        stamps[actor.id] = now;
    }
    for (const row of hiddenStashRows()) {
        if (rows[row.actorId]) rows[row.actorId].push({ sceneId: row.sceneId, room: row.room });
    }
    // The rows this player's characters found, of characters they do not own (r122-ITEMS-R-3). A character no longer
    // named is dropped from the copy whole (gm-stores.mjs `offersCombine`: a held stamp the answer leaves out).
    if (!all) {
        for (const [actorId, list] of Object.entries(await foundRowsFor(actors))) {
            if (rows[actorId]) continue;
            rows[actorId] = list;
            stamps[actorId] = now;
        }
    }
    return { rows, stamps };
}

/** Send one connected player their copy. Nothing while the suite holds the stores. */
async function sendTo(userId) {
    const user = game.users.get(userId);
    if (!game.user?.isGM || !user?.active || user.isGM || gmStoresQuiet()) return false;
    const { rows, stamps } = await rowsFor(userId);
    game.socket.emit(SOCKET_EVENT, { action: ACTION_ROWS, userId, rows, stamps }, { recipients: [userId] });
    return true;
}

/** Tell the readers of `actorId`'s stashes their copy again. */
export function tellHiddenStashes(actorId) {
    if (!game.user?.isGM) return;
    readersOf(actorId).then(ids => Promise.all(ids.map(sendTo)))
        .catch(err => error("Could not tell the owners of a stash whether it is hidden", err));
}

/** Every connected player is sent their copy again (after a restore, a migration, a Mastermind's change). Answers how many. */
export async function retellHiddenStashes() {
    if (!game.user?.isGM || gmStoresQuiet()) return 0;
    let sent = 0;
    for (const user of game.users ?? []) if (user.active && !user.isGM && await sendTo(user.id)) sent++;
    return sent;
}

/** A player: ask the primary for this user's copy. */
function askForHiddenStashes(primary = primaryGmId()) {
    if (!primary || game.user?.isGM) return;
    try {
        game.socket.emit(SOCKET_EVENT, { action: ACTION_ASK }, { recipients: [primary] });
    } catch (err) {
        error("Could not ask the GM which stashes of this player's are hidden", err);
    }
}

/** A player: keep the GM's answer for this user's own characters (and every one for the Mastermind's player). */
async function receive(rows, stamps) {
    const { hiddenStashCopy } = await import("./gm-stores.mjs");
    const mine = {}, own = {};
    for (const [actorId, s] of Object.entries(stamps ?? {})) {
        if (!game.actors.get(actorId)) continue;
        own[actorId] = Number(s) || 0;
        const list = Array.isArray(rows?.[actorId]) ? rows[actorId] : [];
        mine[actorId] = list.filter(r => typeof r?.sceneId === "string" && typeof r?.room === "string")
            .map(r => ({ sceneId: r.sceneId, room: r.room }));
    }
    return hiddenStashCopy.receive(mine, own);
}

function onSocket(payload, senderId) {
    if (payload?.action === ACTION_ASK) {
        if (!isPrimaryGm()) return;
        const sender = game.users.get(senderId);
        if (!sender?.active || sender.isGM) return;
        whenGmStoresAudible().then(() => store()?.whenHydrated()).then(() => sendTo(sender.id))
            .catch(err => error("Could not answer a player's ask for their hidden stashes", err));
        return;
    }
    if (payload?.action !== ACTION_ROWS || game.user?.isGM) return;
    // A GM's, and addressed to this user: a player cannot hand another a hiding place.
    import("./bridge-guards.mjs").then(({ replyForMe }) => (replyForMe(payload, senderId) ? receive(payload.rows, payload.stamps) : false))
        .then(() => Hooks.callAll("drpgHiddenStashesChanged"))
        .catch(err => error("Could not keep which stashes are hidden", err));
}

/** module.mjs: the wire, a player's ask at ready and at a primary's, and the Mastermind's change telling every player. */
export function registerHiddenStashes() {
    game.socket.on(SOCKET_EVENT, onSocket);
    Hooks.once("ready", () => {
        if (!game.user?.isGM) askForHiddenStashes();
    });
    Hooks.on("drpgPrimaryReady", primary => askForHiddenStashes(primary));
    /* A FOUND LIST CHANGED (r122-ITEMS-R-3): a find written by `resolveStashSearch`, a reset's cut, a GM's correction. The
       finder's players are sent their copy again, so the stash they found is a row on their browser at once. Asked on
       the primary alone, the one browser that sends. */
    Hooks.on("updateActor", (actor, changes) => {
        if (!isPrimaryGm()) return;
        const flags = changes?.flags?.[MODULE_ID];
        // The key itself, or a deletion's spelling of it (a prefix before the name: read, never written here, R152).
        if (!flags || !Object.keys(flags).some(key => key.endsWith(FOUND_FLAG) && key.length <= FOUND_FLAG.length + 2)) return;
        const owners = (game.users ?? []).filter(u => !u.isGM && actor?.testUserPermission?.(u, "OWNER")).map(u => u.id);
        Promise.all(owners.map(sendTo)).catch(err => error("Could not tell a finder the stash they found", err));
    });
    // Who the Mastermind is decides who reads every row: a change of the pick sends every player their copy again.
    Hooks.on("clientSettingChanged", key => {
        if (key === `${MODULE_ID}.mastermind` && isPrimaryGm()) {
            retellHiddenStashes().catch(err => error("Could not tell the players which stashes are hidden", err));
        }
    });
}

/* ------------------------------ the lift (migrate.mjs) ------------------------------ */

/**
 * A WORLD FROM BEFORE 1.2.122 (migrate.mjs `liftHiddenStashes`). On the primary, once its stores hold the other GMs'
 * copies: every region entry `{ actorId, concealed: true }`, and every region whose legacy owner flag stands with
 * `drpgVaultConcealed` and no list, is written to the store (weak, fill-only), the store read back from storage, and only
 * then the region rewritten - its list without the hidden entries and without `concealed`, the legacy flag cleared. A
 * row the store did not read back leaves its region as it was, and throws, so the world is not stamped and the next load
 * tries again. Answers `{ lifted, kept }`, null with nothing to lift, `{ notPrimary }` off the primary.
 */
export async function liftHiddenStashes({ flags }) {
    if (!isPrimaryGm()) return { notPrimary: true };
    const handle = store();
    if (!handle) throw new Error("the hidden stashes' store is not defined");
    if (await handle.whenHydrated() === "timedOut") throw new Error("the other GMs' copies of the hidden stashes did not arrive; the next load tries again");
    const work = [];
    for (const scene of game.scenes ?? []) {
        for (const region of scene.regions ?? []) {
            if (!region.name) continue;
            const stored = region.getFlag(MODULE_ID, flags.stashes);
            const legacyOwner = region.getFlag(MODULE_ID, flags.owner);
            const legacyHidden = Boolean(region.getFlag(MODULE_ID, flags.concealed));
            const listed = Array.isArray(stored) ? stored.filter(e => e?.actorId && e.concealed) : [];
            const fromLegacy = !Array.isArray(stored) && legacyOwner && legacyHidden ? [{ actorId: legacyOwner }] : [];
            const hidden = [...listed, ...fromLegacy];
            const carriesField = Array.isArray(stored) && stored.some(e => e && Object.hasOwn(e, "concealed"));
            if (!hidden.length && !carriesField && !legacyHidden) continue;
            work.push({ scene, region, stored, hidden, legacyHidden });
        }
    }
    if (!work.length) return null;
    const rows = {};
    for (const { scene, region, hidden } of work) {
        for (const entry of hidden) rows[hiddenKey(scene.id, entry.actorId, region.name)] = { sceneId: scene.id, actorId: entry.actorId, room: region.name };
    }
    if (Object.keys(rows).length) {
        await handle.patchMany(rows, { weak: true, fillOnly: true });
        await handle.idle?.();
    }
    let lifted = 0, kept = 0;
    for (const { scene, region, stored, hidden, legacyHidden } of work) {
        const back = hidden.every(entry => handle.persisted?.(hiddenKey(scene.id, entry.actorId, region.name)) ?? handle.has(hiddenKey(scene.id, entry.actorId, region.name)));
        if (!back) { kept += hidden.length; continue; }
        const update = {};
        if (Array.isArray(stored)) {
            const hiddenIds = new Set(hidden.map(e => e.actorId));
            update[`flags.${MODULE_ID}.${flags.stashes}`] = stored.filter(e => e?.actorId && !hiddenIds.has(e.actorId)).map(e => ({ actorId: e.actorId }));
        } else if (legacyHidden) {
            // The legacy pair's stash, hidden: the region lists nobody openly now, and the hiding place is the store's row.
            update[`flags.${MODULE_ID}.${flags.stashes}`] = [];
        }
        if (legacyHidden) update[`flags.${MODULE_ID}.${flags.concealed}`] = false;
        await region.update(update);
        lifted += hidden.length;
    }
    if (lifted) log(`Lifted ${lifted} hidden stash(es) out of the rooms' region data.`);
    if (kept) throw new Error(`${kept} hidden stash(es) are still on their rooms' regions (the GM store did not read them back); the next load tries again`);
    await retellHiddenStashes();
    return { lifted, kept };
}
