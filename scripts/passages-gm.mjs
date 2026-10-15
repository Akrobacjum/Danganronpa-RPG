/**
 * Danganronpa RPG - the secret passages, as the GMs keep them (E79, 1.2.78).
 * ---------------------------------------------------------------------------
 * The GMs' records of the passages (gm-stores.mjs `passageMapStore`, `passageAccessStore`,
 * `passageLogStore`), what a GM does to them from the console (`game.drpg.passages`, api.mjs),
 * and each player's copy of the passages their own characters know (`passageCopyFor`), which
 * the primary GM sends to that player alone (`pushPassageCopies`): on every change it writes,
 * on every change it merges from another GM, when a player's characters change hands, after a
 * restore and when a player asks (`passage.request`). Nothing here writes a Wall, a Region, a
 * Scene, a flag or a world setting: a passage is the GMs' until a character learns it (the E79
 * plan's D2 and D38), and then it is in that character's owners' copies and nowhere else.
 *
 * Since C5 the GMs' Passages tab (passages-tab.mjs) works through the same functions, and three
 * watches run on the primary GM alone: a wall moved off a passage's stretch or deleted marks the
 * passage broken (`wallChanged`), and a student a GM let keep a passage until they leave the room
 * they stand in forgets it once their route settles outside it (`revokeLeavers`).
 *
 * What it does not do yet: the GMs' overlay and the pick (C6), a player showing a passage to
 * another (C7) and the reset's start access (C8).
 */

import { MODULE_ID } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { isPrimaryGm, serverNow, warn, error } from "./utils.mjs";
import { passageMapStore, passageAccessStore, passageLogStore, mastermindStore, mastermindUndecided } from "./gm-stores.mjs";
import { RECORD, gmStoresQuiet, whenGmStoresAudible, onGmStoresAudible } from "./gm-store.mjs";
import { senderOf } from "./bridge-guards.mjs";
import { isMonokuma } from "./monokuma.mjs";
import { secretRowsFrom, PASSAGE_TOLERANCE } from "./passages.mjs";

const SOCKET_EVENT = `module.${MODULE_ID}`;

/** The GMs' log keeps this many rows, the newest (the E79 plan's 1b.1). */
export const PASSAGE_LOG_ROWS = 200;

/** The three records, as every function here reads them by default; the suite hands its own (R554, R555). */
export const PASSAGE_STORES = Object.freeze({ map: passageMapStore, access: passageAccessStore, log: passageLogStore, mastermind: mastermindStore });

const STATES = new Set(["secret", "closed", "broken"]);
const touchKey = actorId => `touch/${actorId}`;

/** The Mastermind's actor id as the GMs hold it, or null - none named, or the upgrade day's clear still undecided. */
function mastermindIdOf(mastermind = mastermindStore) {
    if (mastermind === mastermindStore && mastermindUndecided()) return null;
    const id = mastermind.get(RECORD)?.actorId;
    return typeof id === "string" && id ? id : null;
}

/**
 * Whether this character is the Mastermind, read from the GMs' record (the owner's Q7: the
 * Mastermind knows every secret passage). On a player's browser the record is empty, and the
 * answer no: a player's copy names the Mastermind among each row's knowers instead.
 */
export function isMastermindActor(actor, { mastermind = mastermindStore } = {}) {
    const id = typeof actor === "string" ? actor : actor?.id;
    return Boolean(id) && id === mastermindIdOf(mastermind);
}

/**
 * One player's copy, `{ value, stamps }`: the open passages a character this user owns knows -
 * every open passage when one of them is the Mastermind, who is then named among each row's
 * knowers - with only this user's own characters in `actorIds`, and a stamp per character this
 * user owns: the newest of its `touch` row and the Mastermind's record, so a copy that lost a
 * row is replaced by the answer after it (gm-stores.mjs `passageCopy`). A Monokuma is no student
 * and its owner learns nothing through it. No name, no room, no state: what a row holds is
 * `secretRowsFrom`'s.
 */
export function passageCopyFor(user, { stores = PASSAGE_STORES, actors = game.actors, mastermindId = mastermindIdOf(stores.mastermind) } = {}) {
    const own = [...(actors ?? [])].filter(a => a?.type === "character" && !isMonokuma(a) && a.testUserPermission?.(user, "OWNER"));
    const ids = new Set(own.map(a => a.id));
    const mastermind = mastermindId && ids.has(mastermindId) ? mastermindId : null;
    const value = {};
    for (const [id, row] of Object.entries(secretRowsFrom(stores))) {
        const actorIds = row.actorIds.filter(a => ids.has(a));
        if (mastermind && !actorIds.includes(mastermind)) actorIds.push(mastermind);
        if (actorIds.length) value[id] = { ...row, actorIds };
    }
    const mm = stores.mastermind?.newest?.(RECORD) ?? 0;
    const stamps = Object.fromEntries([...ids].map(a => [a, Math.max(stores.access.newest(touchKey(a)), mm)]));
    return { value, stamps };
}

/* What each player was last sent, by user id: an unchanged copy is not sent again unless asked for. */
const TOLD = new Map();

/**
 * The primary GM's push: each connected player (or only `userIds`) is sent their own copy,
 * addressed to them alone. Nothing while the suite holds the stores or stands in another
 * world (`gmStoresQuiet`), and nothing from a browser that is not a GM's; which GM sends is
 * the callers' to decide (the primary: a player takes a copy from nobody else). `force` sends
 * a copy unchanged since the last. Answers how many were sent.
 */
export function pushPassageCopies(userIds = null, { force = false, stores = PASSAGE_STORES, actors = game.actors, mastermindId,
    users = game.users, socket = game.socket, told = TOLD } = {}) {
    if (!game.user?.isGM || gmStoresQuiet()) return 0;
    const only = userIds ? new Set(userIds) : null;
    let sent = 0;
    for (const user of users ?? []) {
        if (!user?.active || user.isGM || (only && !only.has(user.id))) continue;
        const { value, stamps } = passageCopyFor(user, { stores, actors, ...(mastermindId === undefined ? {} : { mastermindId }) });
        const text = JSON.stringify({ value, stamps });
        if (!force && told.get(user.id) === text) continue;
        try {
            socket.emit(SOCKET_EVENT, { action: "passage.rows", userId: user.id, passages: value, stamps }, { recipients: [user.id] });
            told.set(user.id, text);
            sent++;
        } catch (err) {
            error("Could not send a player their secret passages", err);
        }
    }
    return sent;
}

/**
 * Primary GM: a player asks for their copy. The packet is read for nothing but its sender,
 * Foundry's own (`senderOf`), and the answer is that user's copy alone, built from the records
 * as they stand once the other GMs' are in. A GM's ask, or one that reaches a GM who is not
 * the primary, is not answered. Answers whether it sent.
 */
export async function onPassageRequest(payload, senderId) {
    if (payload?.action !== "passage.request" || !isPrimaryGm()) return false;
    const sender = senderOf(senderId);
    if (!sender || sender.isGM) return false;
    await whenGmStoresAudible();
    await Promise.all([passageMapStore.whenHydrated(), passageAccessStore.whenHydrated(), mastermindStore.whenHydrated()]);
    if (!isPrimaryGm()) return false;
    return pushPassageCopies([sender.id], { force: true }) > 0;
}

/** The primary GM tells every connected player what changed (after a restore, a reset, a merge). Answers how many were sent. */
export async function retellPassages() {
    if (!isPrimaryGm() || gmStoresQuiet()) return 0;
    return pushPassageCopies();
}

/**
 * The season reset's "passages" step (season-setup.mjs `wipeSeason`), on the primary GM: who
 * knows each passage and the log go - the group's cut, written first, takes them on every GM and
 * every player's copy, and this clears what this browser holds - and the copies are told again.
 * The passages stay. Giving back each one's start access is C8's.
 */
export async function passagesAfterReset({ stores = PASSAGE_STORES } = {}) {
    for (const store of [stores.access, stores.log]) {
        if (isPrimaryGm()) await store.clear();
        else await store.dropMany(Object.keys(store.entries()));
    }
    return retellPassages();
}

/* ----------------------------------------------------------------------------------------- *
 * The console API (game.drpg.passages): a GM's. Each refusal is a warning in the console and a
 * null or false answer; nothing is written before every check has passed.
 * ----------------------------------------------------------------------------------------- */

function refuse(why, answer = null) {
    warn(`Secret passages: ${why}`);
    return answer;
}

/** Whether a point is within `PASSAGE_TOLERANCE` of the wall's segment `[x1, y1, x2, y2]`. */
function onWall(x, y, [x1, y1, x2, y2]) {
    const dx = x2 - x1, dy = y2 - y1, len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / len2)) : 0;
    return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy)) <= PASSAGE_TOLERANCE;
}

/** Every character a cell of this passage names, and the Mastermind's: whose copies change with the row. */
function knowersOf(passageId, stores) {
    const out = new Set();
    for (const key of Object.keys(stores.access.entries())) {
        const [pid, actorId] = key.split("/");
        if (pid === passageId && actorId) out.add(actorId);
    }
    const mm = mastermindIdOf(stores.mastermind);
    if (mm) out.add(mm);
    return out;
}

/** Stamp each named character's `touch` row: what its owners may hold has changed. */
function touch(actorIds, stores) {
    const rows = Object.fromEntries([...actorIds].map(a => [touchKey(a), { at: serverNow() }]));
    return Object.keys(rows).length ? stores.access.patchMany(rows) : Promise.resolve();
}

/* The log's rows newest first, by the stamp the store gave each - `at` alone ties within a millisecond. */
const logOrder = stores => Object.keys(stores.log.entries()).sort((a, b) => stores.log.stampOf(b) - stores.log.stampOf(a));

/** One row of the GMs' log, and the oldest beyond `PASSAGE_LOG_ROWS` dropped. */
async function logRow(what, passageId, actorId, stores) {
    await stores.log.patch(foundry.utils.randomID(), { at: serverNow(), what, passageId, actorId: actorId ?? null, by: game.user?.id ?? null });
    const keys = logOrder(stores);
    if (keys.length > PASSAGE_LOG_ROWS) await stores.log.dropMany(keys.slice(PASSAGE_LOG_ROWS));
}

/** After a write: the primary sends the copies that changed; another GM's write reaches it by the stores' exchange. */
function tellAfter(stores) {
    if (stores === PASSAGE_STORES && isPrimaryGm()) pushPassageCopies();
}

/** A student this world holds, by id: what a cell may name. */
function studentOf(actorId) {
    const actor = game.actors?.get(actorId);
    return actor?.type === "character" && !isMonokuma(actor) ? actor : null;
}

/**
 * A new passage's row, `{ row }`, or `{ refused }` with the reason: `seg` a stretch of the wall
 * (the whole wall when none is given) whose ends are within 1 px of it, `rooms` the names of the
 * rooms it joins, `level` the floor's id where the scene has floors, `startAccess` the students
 * who know it from the start. Every field the map's row holds, and nothing else (R554). Pure.
 */
export function passageRowFor(scene, wall, { seg = null, rooms = [], level = null, startAccess = [] } = {}) {
    const c = (wall?.c ?? []).slice(0, 4).map(Number);
    if (!scene?.id || !wall?.id || c.length < 4 || !c.every(Number.isFinite)) return { refused: "no such wall on that scene." };
    const xy = seg ? ["x1", "y1", "x2", "y2"].map(k => Number(seg[k])) : c;
    if (!xy.every(Number.isFinite) || (xy[0] === xy[2] && xy[1] === xy[3])) return { refused: "the stretch needs two different ends." };
    if (!onWall(xy[0], xy[1], c) || !onWall(xy[2], xy[3], c)) return { refused: "the stretch is not on that wall." };
    const [x1, y1, x2, y2] = xy;
    return { row: { sceneId: scene.id, level: typeof level === "string" && level ? level : null, shape: "wall", passageWallId: wall.id,
        passageSeg: { x1, y1, x2, y2 }, rooms: (rooms ?? []).filter(r => typeof r === "string"), state: "secret",
        startAccess: [...new Set(startAccess ?? [])] } };
}

/** A GM: a new passage on a wall of a scene (`passageRowFor`). Answers the passage's id, or null. */
export async function createPassage({ sceneId, wallId, seg = null, rooms = [], level = null, startAccess = [] } = {}, { stores = PASSAGE_STORES } = {}) {
    if (!game.user?.isGM) return refuse("only a GM creates one.");
    const scene = game.scenes?.get(sceneId);
    if (!scene) return refuse(`no scene "${sceneId}".`);
    if ((startAccess ?? []).some(a => !studentOf(a))) return refuse("a start access names no student of this world.");
    const { row, refused } = passageRowFor(scene, scene.walls?.get(wallId), { seg, rooms, level, startAccess });
    if (!row) return refuse(refused);
    const id = `${scene.id}.${foundry.utils.randomID()}`;
    await stores.map.patch(id, row);
    const at = serverNow(), who = game.user.id;
    if (row.startAccess.length) {
        await stores.access.patchMany(Object.fromEntries(row.startAccess.map(a => [`${id}/${a}`, { how: "start", at, by: { [who]: at } }])), { fillOnly: true });
    }
    await touch(knowersOf(id, stores), stores);
    await logRow("create", id, null, stores);
    tellAfter(stores);
    return id;
}

/**
 * A GM: a student learns a passage. `how` "gm" unless given; on this GM's browser the first `how`
 * and its time are kept (fill-only), and each GM's grant is added to `by` under its own key (`by`
 * is that GM's id; the suite names two). Two GMs granting at once each write `how`: the merge
 * keeps the newer, as it keeps any field (R554).
 */
export async function grantPassage(passageId, actorId, { how = "gm", by = game.user?.id, stores = PASSAGE_STORES } = {}) {
    if (!game.user?.isGM) return refuse("only a GM grants one.", false);
    if (!stores.map.get(passageId)) return refuse(`no passage "${passageId}".`, false);
    if (!studentOf(actorId)) return refuse(`no student "${actorId}".`, false);
    const at = serverNow();
    await stores.access.patch(`${passageId}/${actorId}`, { how: String(how), at, by: { [by]: at } }, { fillOnly: true });
    await touch([actorId], stores);
    await logRow("grant", passageId, actorId, stores);
    tellAfter(stores);
    return true;
}

/** A GM: a student forgets a passage - the cell goes, and the row leaves that student's owners' copies. */
export async function revokePassage(passageId, actorId, { stores = PASSAGE_STORES } = {}) {
    if (!game.user?.isGM) return refuse("only a GM revokes one.", false);
    if (!stores.access.get(`${passageId}/${actorId}`)) return refuse(`"${actorId}" does not know "${passageId}".`, false);
    await stores.access.drop(`${passageId}/${actorId}`);
    await touch([actorId], stores);
    await logRow("revoke", passageId, actorId, stores);
    tellAfter(stores);
    return true;
}

/** A GM: the passage's state - closed (who knows it is kept; the copies leave it out) or secret again. */
async function setState(passageId, state, from, stores) {
    if (!game.user?.isGM) return refuse("only a GM changes one.", false);
    const row = stores.map.get(passageId);
    if (!row) return refuse(`no passage "${passageId}".`, false);
    if (!STATES.has(state) || !from.includes(row.state)) return refuse(`"${passageId}" is ${row.state}.`, false);
    await stores.map.patch(passageId, { state });
    await touch(knowersOf(passageId, stores), stores);
    await logRow(state === "secret" ? "open" : "close", passageId, null, stores);
    tellAfter(stores);
    return true;
}

export const closePassage = (passageId, { stores = PASSAGE_STORES } = {}) => setState(passageId, "closed", ["secret"], stores);
export const openPassage = (passageId, { stores = PASSAGE_STORES } = {}) => setState(passageId, "secret", ["closed"], stores);

/** A GM: the passage is gone, and every cell of it. */
export async function deletePassage(passageId, { stores = PASSAGE_STORES } = {}) {
    if (!game.user?.isGM) return refuse("only a GM deletes one.", false);
    if (!stores.map.get(passageId)) return refuse(`no passage "${passageId}".`, false);
    const knowers = knowersOf(passageId, stores);
    const cells = Object.keys(stores.access.entries()).filter(k => k.startsWith(`${passageId}/`));
    await stores.map.drop(passageId);
    if (cells.length) await stores.access.dropMany(cells);
    await touch(knowers, stores);
    await logRow("delete", passageId, null, stores);
    tellAfter(stores);
    return true;
}

/**
 * A GM: the student knows the passage from each season's start (`on`), or no more - the row's
 * `startAccess`, which the season's reset gives back (C8). Who knows it now is not touched: the
 * tab's two columns are two questions, today and the next season. The list is one field, so two
 * GMs changing it at once keep the newer whole list (R554's rule for any field).
 */
export async function setStartAccess(passageId, actorId, on, { stores = PASSAGE_STORES } = {}) {
    if (!game.user?.isGM) return refuse("only a GM changes one.", false);
    const row = stores.map.get(passageId);
    if (!row) return refuse(`no passage "${passageId}".`, false);
    if (on && !studentOf(actorId)) return refuse(`no student "${actorId}".`, false);
    const was = Array.isArray(row.startAccess) ? row.startAccess : [];
    if (was.includes(actorId) === Boolean(on)) return true;
    await stores.map.patch(passageId, { startAccess: on ? [...was, actorId] : was.filter(a => a !== actorId) });
    await logRow(on ? "start" : "unstart", passageId, actorId, stores);
    return true;
}

/**
 * A GM: the student keeps the passage until they leave `room`, the room they stand in now (the
 * mockup's 'Revoke when they leave the room'). The cell stays, and with it the passage in their
 * owners' copies; `leave` names the room, and `revokeLeavers` revokes it on the primary GM when
 * the student's route settles anywhere else on the passage's scene.
 */
export async function revokeWhenLeaving(passageId, actorId, room, { stores = PASSAGE_STORES } = {}) {
    if (!game.user?.isGM) return refuse("only a GM revokes one.", false);
    if (!stores.access.get(`${passageId}/${actorId}`)) return refuse(`"${actorId}" does not know "${passageId}".`, false);
    if (typeof room !== "string" || !room) return refuse("no room to leave.", false);
    await stores.access.patch(`${passageId}/${actorId}`, { leave: room });
    await logRow("leave", passageId, actorId, stores);
    return true;
}

/**
 * The primary GM, when a token's route settles (movement.mjs `drpgRouteSettled`): every passage its
 * student keeps only until leaving a room is revoked when the token stands on that passage's scene
 * outside the room - in another room, or in none. A token on another scene leaves nothing: the
 * room is a room of the passage's scene. `roomOf` is the suite's (movement.mjs `roomOfToken`
 * otherwise). Answers the passages revoked.
 */
export async function revokeLeavers(tokenDoc, { stores = PASSAGE_STORES, roomOf = null } = {}) {
    const actorId = tokenDoc?.actorId ?? tokenDoc?.actor?.id;
    const sceneId = tokenDoc?.parent?.id;
    if (!game.user?.isGM || !actorId || !sceneId) return [];
    const due = Object.entries(stores.access.entries()).filter(([key, cell]) => !key.startsWith("touch/")
        && key.endsWith(`/${actorId}`) && typeof cell?.leave === "string"
        && stores.map.get(key.slice(0, -(actorId.length + 1)))?.sceneId === sceneId);
    if (!due.length) return [];
    const where = roomOf ? roomOf(tokenDoc) : (await import("./movement.mjs")).roomOfToken(tokenDoc);
    const gone = [];
    for (const [key, cell] of due) {
        const passageId = key.slice(0, -(actorId.length + 1));
        if (where === cell.leave) continue;
        if (await revokePassage(passageId, actorId, { stores })) gone.push(passageId);
    }
    return gone;
}

/**
 * The wall a passage was cut from changed (the plan's K11): every row on it whose stretch is no
 * longer within `PASSAGE_TOLERANCE` of the wall's segment - or every row, when the wall is `gone` -
 * is marked broken. A broken row is a wall to everybody (`secretRowsFrom` keeps only secret rows),
 * keeps who knows it, and waits for a GM to pick it again (C6) or delete it. A wall that moved
 * along its own line with the stretch still on it changes nothing. Never writes the wall. Answers
 * the passages marked.
 */
export async function wallChanged(wall, { gone = false, stores = PASSAGE_STORES } = {}) {
    const sceneId = wall?.parent?.id;
    if (!game.user?.isGM || !wall?.id || !sceneId) return [];
    const c = (wall.c ?? []).slice(0, 4).map(Number);
    const whole = c.length === 4 && c.every(Number.isFinite);
    const off = ({ x1, y1, x2, y2 } = {}) => gone || !whole || !onWall(x1, y1, c) || !onWall(x2, y2, c);
    const marked = Object.entries(stores.map.entries())
        .filter(([, row]) => row?.passageWallId === wall.id && row.sceneId === sceneId && row.state !== "broken" && off(row.passageSeg))
        .map(([id]) => id);
    for (const id of marked) {
        await stores.map.patch(id, { state: "broken" });
        await touch(knowersOf(id, stores), stores);
        await logRow("broken", id, null, stores);
    }
    if (marked.length) tellAfter(stores);
    return marked;
}

/** A GM: where the passage's stretch has its middle, `{ sceneId, level, x, y }`, for the tab's Show; null for none. */
export function passageMiddle(passageId, { stores = PASSAGE_STORES } = {}) {
    const row = game.user?.isGM ? stores.map.get(passageId) : null;
    const seg = row?.passageSeg;
    if (!seg) return null;
    return { sceneId: row.sceneId, level: row.level ?? null, x: (seg.x1 + seg.x2) / 2, y: (seg.y1 + seg.y2) / 2 };
}

/**
 * The primary GM: which of the passage's knowers no player of theirs has been sent it yet - each a
 * student whose owners (a GM aside) include somebody, none of whom was last sent a copy that names
 * the student under this passage (`told`, what `pushPassageCopies` last sent each). A player who is
 * away is sent their copy when they come back. Null on any other browser, which sends nothing and
 * cannot know; [] for a passage that is not secret, which no copy holds.
 */
export function undeliveredOf(passageId, { stores = PASSAGE_STORES, actors = game.actors, users = game.users, told = TOLD,
    primary = isPrimaryGm() } = {}) {
    if (!primary) return null;
    if (stores.map.get(passageId)?.state !== "secret") return [];
    const sent = user => {
        try {
            return JSON.parse(told.get(user.id) ?? "null")?.value?.[passageId]?.actorIds ?? [];
        } catch {
            return [];
        }
    };
    const out = [];
    for (const actorId of knowersOf(passageId, stores)) {
        const actor = actors?.get?.(actorId);
        const owners = [...(users ?? [])].filter(u => u && !u.isGM && actor?.testUserPermission?.(u, "OWNER"));
        if (owners.length && !owners.some(u => sent(u).includes(actorId))) out.push(actorId);
    }
    return out;
}

/** A GM: every passage with who knows it, `[{ id, ...row, access: { actorId: { how, at, by } } }]`. */
export function listPassages({ stores = PASSAGE_STORES } = {}) {
    if (!game.user?.isGM) return [];
    const access = Object.entries(stores.access.entries());
    return Object.entries(stores.map.entries()).map(([id, row]) => ({
        id, ...foundry.utils.deepClone(row),
        access: Object.fromEntries(access.filter(([k]) => k.startsWith(`${id}/`)).map(([k, cell]) => [k.slice(id.length + 1), foundry.utils.deepClone(cell)]))
    }));
}

/** A GM: the log, newest first. */
export function passageLog({ stores = PASSAGE_STORES } = {}) {
    if (!game.user?.isGM) return [];
    const rows = stores.log.entries();
    return logOrder(stores).map(k => ({ ...rows[k] }));
}

/* A change the primary merged, or a student given to another player: the copies are told, once, a moment later. */
let retellTimer = null;
function retellSoon() {
    if (!isPrimaryGm()) return;
    clearTimeout(retellTimer);
    retellTimer = setTimeout(() => {
        retellTimer = null;
        retellPassages().catch(err => error("Could not tell the players their secret passages", err));
    }, 250);
}

/* The primary GM's watch on the walls (the plan's K11): a wall whose segment changed, or that went, may break a passage. */
function onWallMoved(wall, change) {
    if (!isPrimaryGm() || !foundry.utils.hasProperty(change ?? {}, "c")) return;
    wallChanged(wall).catch(err => error("Could not mark a secret passage on a moved wall", err));
}

function onWallDeleted(wall) {
    if (!isPrimaryGm()) return;
    wallChanged(wall, { gone: true }).catch(err => error("Could not mark a secret passage on a deleted wall", err));
}

/* The primary GM's watch on the routes: a student kept a passage until leaving a room. */
function onRouteSettled({ tokenDoc } = {}) {
    if (!isPrimaryGm()) return;
    revokeLeavers(tokenDoc).catch(err => error("Could not revoke a secret passage from a student who left the room", err));
}

/**
 * At ready, on a GM's browser: the ask's listener, the watches that tell the players what another
 * GM changed, and the primary's watches on the walls and the routes (each asks `isPrimaryGm` when it
 * fires, so a GM who becomes the primary later takes them over).
 */
export function registerPassagesGm() {
    Hooks.once("ready", () => {
        if (!game.user.isGM) return;
        game.socket.on(SOCKET_EVENT, (payload, senderId) => {
            onPassageRequest(payload, senderId).catch(err => error("Could not answer a player's secret passages", err));
        });
        Hooks.on("clientSettingChanged", key => {
            if (gmStoresQuiet()) return;
            if (key === `${MODULE_ID}.${SETTINGS.gmPassageMap}` || key === `${MODULE_ID}.${SETTINGS.gmPassageAccess}`
                || key === `${MODULE_ID}.${SETTINGS.mastermind}`) retellSoon();
        });
        Hooks.on("updateActor", (actor, change) => { if (change?.ownership !== undefined) retellSoon(); });
        Hooks.on("deleteActor", () => retellSoon());
        onGmStoresAudible(() => retellSoon());
        Hooks.on("updateWall", onWallMoved);
        Hooks.on("deleteWall", onWallDeleted);
        Hooks.on("drpgRouteSettled", onRouteSettled);
    });
}
