/**
 * Danganronpa RPG - the secret passages, as the GMs keep them (E79, 1.2.79).
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
 * Since C6 a GM makes a passage on the board (`startPassagePick`, from the tab's 'New passage'):
 * two clicks on one wall between two rooms of one floor, each snapped to the wall (`snapToWall`,
 * `stretchBetween`, pure), and a broken one is picked again the same way (`repickPassage`); since
 * fix r2-G3 the console's create and the repick hold their stretch to the same two (`stretchOnMap`). The
 * GMs' overlay (gm-overlay.mjs) draws every passage of the scene and floor on screen on a GM's
 * browser alone (`drawPassagesLayer`), and the pick's stretch as it is made.
 *
 * Since C7 a player shows a passage their character knows to a student beside them (`sharePassage`,
 * judged by `shareRefusal` on the primary GM, asked as gm-bridge.mjs `passage.share`).
 *
 * The season's reset gives back each passage's start access (`passagesAfterReset`, since C8).
 */

import { MODULE_ID } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { isPrimaryGm, serverNow, whisperToOwner, whisperToGms, ownerOf, warn, error } from "./utils.mjs";
import { passageMapStore, passageAccessStore, passageLogStore, mastermindStore, mastermindUndecided } from "./gm-stores.mjs";
import { RECORD, gmStoresQuiet, whenGmStoresAudible, onGmStoresAudible } from "./gm-store.mjs";
import { senderOf } from "./bridge-guards.mjs";
import { isMonokuma } from "./monokuma.mjs";
import { secretRowsFrom, sceneGone, PASSAGE_TOLERANCE } from "./passages.mjs";
import { roomPieces, onLevel, floorsOf, isTrialScene, viewedScene, viewedLevel } from "./rooms.mjs";
import { regionShapes, inFlatPolygons, distanceToSegment } from "./fog-geometry.mjs";
import { overlayLayer, clearLayer, overlayColour, dashedLine, overlayDrawer, redrawGmOverlay } from "./gm-overlay.mjs";

const SOCKET_EVENT = `module.${MODULE_ID}`;

/** The GMs' log keeps this many rows, the newest (the E79 plan's 1b.1). */
export const PASSAGE_LOG_ROWS = 200;

/** The three records, as every function here reads them by default; the suite hands its own (R554, R555). */
export const PASSAGE_STORES = Object.freeze({ map: passageMapStore, access: passageAccessStore, log: passageLogStore, mastermind: mastermindStore });

const STATES = new Set(["secret", "closed", "broken"]);
const touchKey = actorId => `touch/${actorId}`;
/* The Mastermind's door row: stamped by what moves the every-passage copy only (see `passageCopyFor`). */
const doorKey = actorId => `door/${actorId}`;
/* The door row's part of the door owner's stamps: no actor's id is four letters long (Foundry's are sixteen). */
const DOOR_PART = "door";

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
 * Whether this user, acting for this character, acts as the Mastermind - knows every open secret
 * passage through it (the owner's Q7): a GM, or the one owner the door names for the Mastermind's
 * student (`ownerOf`, the first connected owner, as mastermind.mjs `retellDoor` tells it). The one
 * reading of the role for a passage: the copy (`passageCopyFor`), a show (`shareRefusal`), the
 * primary GM's audit of a move (movement-audit.mjs `auditMove`) and its witness judge (movement.mjs
 * `judgeArrival`) all ask it. Until the round-2 review (16.10.2026: SEC M3 = cor F1) the last three
 * read the role off the character alone, so another owner of the Mastermind's student, whom the door
 * tells "not the Mastermind", had every open passage carried out, shown and let stand for it - and
 * learnt the role from which of them were. `mastermind` (the record) and `users` are the suite's.
 */
export function actsAsMastermind(actor, user, { mastermind = mastermindStore, mastermindId = mastermindIdOf(mastermind), users = game.users } = {}) {
    const id = typeof actor === "string" ? actor : actor?.id;
    if (!id || !user || id !== mastermindId) return false;
    if (user.isGM) return true;
    const doc = typeof actor === "string" ? game.actors?.get(actor) : actor;
    const people = Array.isArray(users) ? users : [...(users?.values?.() ?? [])];
    return Boolean(doc) && ownerOf(doc, people)?.id === user.id;
}

/**
 * One player's copy, `{ value, stamps }`: the open passages a character this user owns knows -
 * every open passage when one of them is the Mastermind and this user is the one its door names
 * (`ownerOf`), who is then named among each row's knowers - with only this user's own characters
 * in `actorIds`, and a stamp per character this user owns: the stamp of its `touch` row, so a
 * copy that lost a row is replaced by the answer after it (gm-stores.mjs `passageCopy`). A
 * Monokuma is no student and its owner learns nothing through it. No name, no room, no state:
 * what a row holds is `secretRowsFrom`'s.
 *
 * Three answers of the round-1 review (15.10.2026). SEC S2: a second owner of the Mastermind's
 * student, whom the door tells "not the Mastermind" (mastermind.mjs `retellDoor`), was sent every
 * open passage naming the Mastermind; now the Mastermind is left out of any other owner's copy
 * whole - no row of it and no stamp of it, so not even the moment the door moves reaches them.
 * SEC S3: a user who owns no student was answered `stamps: {}`, which the copy refuses
 * (gm-store.mjs `copyStamps`), and kept the last copy they took; now that copy carries the one
 * part "" - no actor's id can be empty -, stamped one past the access record's reset watermark,
 * which a reset's cut stays under (`passagesAfterReset`) and which no grant moves, so it is sent
 * once and taken over the characters it no longer names (`offersCombine`). Goal F4: each stamp
 * was the newest of its `touch` row and the Mastermind's record, so any write of the record sent
 * every player a packet; now a change of who the Mastermind is touches the two students it
 * changes (`touchDoorChange`). `users` is the suite's to hand.
 *
 * The round-2 review (16.10.2026: SEC M3 = cor F1, measured by its probe SECR2-P3) found S2's answer
 * moved the harm: a second owner's copy left the Mastermind's student out, so its stamps named its
 * other student alone (or fell to the part "") while the student was the Mastermind and both when it
 * was not - the copy changed, and was sent, the moment the Mastermind was chosen - and the passages
 * the student had been given left that owner's list and cut. Now every owner's copy holds the student
 * as any student's - its own cells, stamped by its own `touch` row - and only the door's adds every
 * open passage, stamped by a row of the door's own (`door/<actorId>`, the part "door" of the door
 * owner's stamps alone): what moves because the student is the Mastermind - a passage made, closed,
 * opened, deleted, broken or picked again, the door moved - stamps that row and never the student's
 * `touch` row, so nobody but the door owner is sent a copy for it (R555).
 */
export function passageCopyFor(user, { stores = PASSAGE_STORES, actors = game.actors, users = game.users,
    mastermindId = mastermindIdOf(stores.mastermind) } = {}) {
    const own = [...(actors ?? [])].filter(a => a?.type === "character" && !isMonokuma(a) && a.testUserPermission?.(user, "OWNER"));
    const ids = new Set(own.map(a => a.id));
    const mastermind = own.find(a => actsAsMastermind(a, user, { mastermindId, users }))?.id ?? null;
    const value = {};
    for (const [id, row] of Object.entries(secretRowsFrom(stores))) {
        const actorIds = row.actorIds.filter(a => ids.has(a));
        if (mastermind && !actorIds.includes(mastermind)) actorIds.push(mastermind);
        if (actorIds.length) value[id] = { ...row, actorIds };
    }
    const stamps = ids.size ? Object.fromEntries([...ids].map(a => [a, stores.access.newest(touchKey(a))]))
        : { "": stores.access.cleared() + 1 };
    if (mastermind) stamps[DOOR_PART] = stores.access.newest(doorKey(mastermind));
    return { value, stamps };
}

/**
 * The primary GM, before it tells the copies (`retellPassages`): when who the Mastermind is, or
 * which of its student's owners the door names (`ownerOf`, the connected one first), is not what
 * the copies were last stamped for, the door rows of the student who was and of the student who
 * is are stamped again - so the two door owners take their new copies, the one that gains every
 * open passage and the one that loses them, and nobody else is sent one (the round-1 review's goal
 * F4; since the round-2 review's SEC M3 the door's row, `door/<actorId>`, and not the student's
 * `touch` row, which every owner's stamps read). What was last stamped is kept on the door row as
 * `door`, the user the door named then: in the GMs' records, so a GM who becomes the primary reads
 * it rather than a memory of its own browser. A reset's cut takes the rows, and the next call
 * stamps the Mastermind again. Answers the students touched, by id. `actors` and `users` are the
 * suite's to hand.
 */
export async function touchDoorChange({ stores = PASSAGE_STORES, actors = game.actors, users = game.users,
    mastermindId = mastermindIdOf(stores.mastermind) } = {}) {
    const actor = mastermindId ? [...(actors ?? [])].find(a => a?.id === mastermindId) ?? null : null;
    const door = actor ? ownerOf(actor, users)?.id ?? null : null;
    const at = serverNow(), rows = {};
    for (const [key, row] of Object.entries(stores.access.entries())) {
        const [head, actorId] = key.split("/");
        if (head === "door" && actorId && actorId !== mastermindId && row?.door) rows[key] = { at, door: null };
    }
    if (mastermindId && (stores.access.get(doorKey(mastermindId))?.door ?? null) !== door) rows[doorKey(mastermindId)] = { at, door };
    if (Object.keys(rows).length) await stores.access.patchMany(rows);
    return Object.keys(rows).map(key => key.slice(doorKey("").length));
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
        const { value, stamps } = passageCopyFor(user, { stores, actors, users, ...(mastermindId === undefined ? {} : { mastermindId }) });
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
    /* Client-local, on the sending GM's browser: the Passages tab's "not yet delivered" line reads `told`, and the tab
       redraws 120 ms after a change of the records (TIMING.coalesceMs) - before a push that comes later, as a retell
       does at 250 ms (`retellSoon`), and as the answer to a player's ask when they connect does. Until review round 1
       (cor F2, 15.10.2026) nothing redrew it after such a push, and the line stayed on a student whose player held
       the passage; the tab now watches this as well (passages-tab.mjs `wirePassagesTab`, R561). */
    if (sent) Hooks.callAll("drpgPassagesTold", { sent });
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

/**
 * The primary GM tells every connected player what changed (after a restore, a reset, a merge, a
 * change of the Mastermind), the Mastermind's two students touched first when the door moved
 * (`touchDoorChange`). Answers how many were sent. `primary` and the rest (`stores`, `actors`,
 * `users`, `socket`, `told`, as `pushPassageCopies` takes them) are the suite's (R555).
 */
export async function retellPassages({ primary = isPrimaryGm, ...ctx } = {}) {
    if (!primary() || gmStoresQuiet()) return 0;
    await touchDoorChange(ctx);
    if (!primary() || gmStoresQuiet()) return 0;
    return pushPassageCopies(null, ctx);
}

/**
 * The season reset's "passages" step (season-setup.mjs `wipeSeason`), on the primary GM: who
 * knows each passage and the log go - the group's cut, written first, takes them on every GM and
 * every player's copy, and this clears what this browser holds - then each passage's start access
 * comes back (a cell `how: "start"`, for each student of this world its row names), and the copies
 * of everybody who knew a passage, was given one back or is the Mastermind are told again. The
 * passages stay; the reset writes no log row, so the log starts the season empty.
 *
 * Since E79 C8 (1.2.79). The start cells are written here, after the clear, and not in the group's
 * `onCut`: the cut is applied when the clock's cuts are written, before this step, so a cell written
 * there would be cleared by this step's own `clear()`, while one written after it is stamped past the
 * cut's watermark and reaches the other GMs by the exchange. No `touch` row is written: the clear's
 * watermark is every key's newest decision (gm-store.mjs `newest`), so each knower's copy is stamped
 * past the cut by it, and a player's copy the cut emptied takes the new one. Measured 15.10.2026: a
 * `touch` of every knower and of the Mastermind here, in C8's first draft, changed nothing of R554 or
 * 65-season X. The suite's own stores tell nobody: only the module's send the copies.
 */
export async function passagesAfterReset({ stores = PASSAGE_STORES } = {}) {
    for (const store of [stores.access, stores.log]) {
        if (isPrimaryGm()) await store.clear();
        else await store.dropMany(Object.keys(store.entries()));
    }
    const at = serverNow(), who = game.user?.id ?? null, cells = {};
    for (const [id, row] of Object.entries(stores.map.entries())) {
        for (const actorId of Array.isArray(row?.startAccess) ? row.startAccess : []) {
            if (!studentOf(actorId)) continue;
            cells[`${id}/${actorId}`] = { how: "start", at, by: { [who]: at } };
        }
    }
    if (Object.keys(cells).length) await stores.access.patchMany(cells, { fillOnly: true });
    return stores === PASSAGE_STORES ? retellPassages() : 0;
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

/**
 * Every character a cell of this passage names: whose copies change with the row. The Mastermind's
 * copy changes with every open passage, and is stamped by `touch`'s `door` (the round-2 review's
 * SEC M3: until 16.10.2026 the Mastermind was a knower here, and every owner of its student was
 * sent a copy for a passage only the door owner holds).
 */
function knowersOf(passageId, stores) {
    const out = new Set();
    for (const key of Object.keys(stores.access.entries())) {
        const [pid, actorId] = key.split("/");
        if (pid === passageId && actorId) out.add(actorId);
    }
    return out;
}

/**
 * Stamp each named character's `touch` row: what its owners may hold has changed; with `door`, a
 * write that moves a passage itself, the Mastermind's door row as well (`passageCopyFor`).
 */
function touch(actorIds, stores, { door = false } = {}) {
    const at = serverNow(), mastermind = door ? mastermindIdOf(stores.mastermind) : null;
    const rows = Object.fromEntries([...actorIds].map(a => [touchKey(a), { at }]));
    if (mastermind) rows[doorKey(mastermind)] = { at };
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
 * (the whole wall when none is given) whose ends are within 1 px of it, on a wall that is no door
 * and blocks movement, `level` the id of one of the scene's floors where it has any and null where
 * it has none, the wall on that floor, and the stretch what the pick would make of two clicks on
 * its ends (`stretchOnMap`): between two rooms of that floor, the same two at both ends, at least
 * `PICK_SHORTEST` long, and on no stretch of `taken` (the scene's other passages, `takenOn`).
 * `rooms` are the map's two, sorted; a caller that names rooms names those or is refused.
 * `startAccess` the students who know it from the start. Every field the map's row holds, and
 * nothing else (R554).
 *
 * ONE RULE FOR BOTH ROADS (E79 fix r2-G3, 16.10.2026; review round 2, O4). Until this commit the
 * console's create (`game.drpg.passages.create`) asked only the wall's own four checks above the
 * map's: it wrote a passage on a stretch another passage held, on a wall inside one room, beside a
 * room of another floor, a pixel long, and with whatever `rooms` the caller typed - each one the
 * pick refuses. R561's console cases measured all five written at the parent (d71759a); the
 * pick's `snapToWall` and `stretchBetween` now judge both roads, and the repick as well.
 */
export function passageRowFor(scene, wall, { seg = null, rooms = [], level = null, startAccess = [], taken = [] } = {}) {
    const c = (wall?.c ?? []).slice(0, 4).map(Number);
    if (!scene?.id || !wall?.id || c.length < 4 || !c.every(Number.isFinite)) return { refused: "no such wall on that scene." };
    if (Number(wall.door) > 0) return { refused: "that wall is a door." };
    if (Number(wall.move) === 0) return { refused: "that wall does not block movement." };
    const xy = seg ? ["x1", "y1", "x2", "y2"].map(k => Number(seg[k])) : c;
    if (!xy.every(Number.isFinite) || (xy[0] === xy[2] && xy[1] === xy[3])) return { refused: "the stretch needs two different ends." };
    if (!onWall(xy[0], xy[1], c) || !onWall(xy[2], xy[3], c)) return { refused: "the stretch is not on that wall." };
    const floors = floorsOf(scene);
    const floor = typeof level === "string" && level ? level : null;
    if (floors.length ? !floors.some(f => f.id === floor) : floor !== null) {
        return { refused: floors.length ? "name one of the scene's floors." : "that scene has no floors." };
    }
    if (!onLevel(wall, floor)) return { refused: "that wall is not on that floor." };
    const map = stretchOnMap(scene, wall, xy, { level: floor, taken });
    if (map.refused) return { refused: MAP_REFUSALS[map.refused] ?? `the pick refuses it (${map.refused}).` };
    const named = (rooms ?? []).filter(r => typeof r === "string");
    if (named.length && named.slice().sort((p, q) => p.localeCompare(q)).join("\n") !== map.rooms.join("\n")) {
        return { refused: `the stretch stands between ${map.rooms.join(" and ")}, not the rooms named.` };
    }
    const [x1, y1, x2, y2] = xy;
    return { row: { sceneId: scene.id, level: floor, shape: "wall", passageWallId: wall.id,
        passageSeg: { x1, y1, x2, y2 }, rooms: map.rooms, state: "secret",
        startAccess: [...new Set(startAccess ?? [])] } };
}

/**
 * A GM: a new passage on a wall of a scene (`passageRowFor`). Answers the passage's id, or null.
 * `scene` is the document in hand (the pick's; the suite's own in R561), else the world's by `sceneId`.
 */
export async function createPassage({ sceneId, wallId, seg = null, rooms = [], level = null, startAccess = [] } = {}, { stores = PASSAGE_STORES, scene: given = null } = {}) {
    if (!game.user?.isGM) return refuse("only a GM creates one.");
    const scene = given ?? game.scenes?.get(sceneId);
    if (!scene || scene.id !== sceneId) return refuse(`no scene "${sceneId}".`);
    if ((startAccess ?? []).some(a => !studentOf(a))) return refuse("a start access names no student of this world.");
    const { row, refused } = passageRowFor(scene, scene.walls?.get(wallId), { seg, rooms, level, startAccess, taken: takenOn(scene.id, null, stores) });
    if (!row) return refuse(refused);
    const id = `${scene.id}.${foundry.utils.randomID()}`;
    await stores.map.patch(id, row);
    const at = serverNow(), who = game.user.id;
    if (row.startAccess.length) {
        await stores.access.patchMany(Object.fromEntries(row.startAccess.map(a => [`${id}/${a}`, { how: "start", at, by: { [who]: at } }])), { fillOnly: true });
    }
    await touch(knowersOf(id, stores), stores, { door: true });
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
    await touch(knowersOf(passageId, stores), stores, { door: true });
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
    await touch(knowers, stores, { door: true });
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
 * The rooms a passage joins on the map, each once: the veto's own reading (movement.mjs `passageRooms`,
 * the stretch's two sides on the passage's floor), on the passage's scene - `scene` is the suite's (R561).
 * What the Passages tab's cross asks about. A row's `rooms` is what the tab shows, no more: the console
 * leaves it empty, and until review round 1 (cor F1, 15.10.2026) the cross asked only when the student's
 * room was one of those names, so a passage made from the console, and one whose room a GM had
 * renamed since, revoked at once a student standing beside it. [] where the map
 * names no room, on another scene, or on a browser that is not a GM's.
 */
export async function passageRoomsOnMap(passageId, { stores = PASSAGE_STORES, scene = null } = {}) {
    const row = game.user?.isGM ? stores.map.get(passageId) : null;
    const on = scene ?? game.scenes?.get(row?.sceneId);
    if (!row?.passageSeg || !on || on.id !== row.sceneId) return [];
    const { passageRooms } = await import("./movement.mjs");
    return [...new Set(passageRooms(on, row.passageSeg, row.level ?? null).filter(Boolean))];
}

/**
 * On the primary, once a GM's rename of the room `from` on the scene `sceneId` to `to` is carried
 * (fog.mjs `carryRename`): each passage of that scene shows the new name (`rooms`), and a student who
 * keeps a passage until leaving the room (`leave`) keeps it until leaving the renamed room. Until review
 * round 1 (cor F1; the goal reviewer's note on 'Revoke when they leave', 15.10.2026) neither was carried,
 * and `revokeLeavers`, which compares names, revoked the passage at the student's next route inside the
 * room. Answers how many rows and cells it carried.
 */
export async function carryPassageRooms(sceneId, from, to, { stores = PASSAGE_STORES } = {}) {
    if (!game.user?.isGM || !sceneId || !from || !to || from === to) return 0;
    await Promise.all([stores.map.whenHydrated?.(), stores.access.whenHydrated?.()]);
    const here = new Set(), rows = {}, cells = {};
    for (const [id, row] of Object.entries(stores.map.entries())) {
        if (row?.sceneId !== sceneId) continue;
        here.add(id);
        if (Array.isArray(row.rooms) && row.rooms.includes(from)) rows[id] = { rooms: row.rooms.map(room => (room === from ? to : room)) };
    }
    for (const [key, cell] of Object.entries(stores.access.entries())) {
        if (!key.startsWith("touch/") && cell?.leave === from && here.has(key.slice(0, key.lastIndexOf("/")))) cells[key] = { leave: to };
    }
    if (Object.keys(rows).length) await stores.map.patchMany(rows);
    if (Object.keys(cells).length) await stores.access.patchMany(cells);
    return Object.keys(rows).length + Object.keys(cells).length;
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
        await touch(knowersOf(id, stores), stores, { door: true });
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
    const mastermind = mastermindIdOf(stores.mastermind);
    for (const actorId of new Set([...knowersOf(passageId, stores), ...(mastermind ? [mastermind] : [])])) {
        const actor = actors?.get?.(actorId);
        const owners = [...(users ?? [])].filter(u => u && !u.isGM && actor?.testUserPermission?.(u, "OWNER"));
        if (owners.length && !owners.some(u => sent(u).includes(actorId))) out.push(actorId);
    }
    return out;
}

/**
 * A GM: every passage with who knows it, `[{ id, ...row, access: { actorId: { how, at, by } } }]`,
 * and `sceneGone: true` on a passage whose scene was deleted, which no copy holds (`secretRowsFrom`)
 * and the GM may still delete (the round-1 review's cor F6). `stores.scenes` is the suite's.
 */
export function listPassages({ stores = PASSAGE_STORES } = {}) {
    if (!game.user?.isGM) return [];
    const access = Object.entries(stores.access.entries());
    return Object.entries(stores.map.entries()).map(([id, row]) => ({
        id, ...foundry.utils.deepClone(row), ...(sceneGone(row, stores) ? { sceneGone: true } : {}),
        access: Object.fromEntries(access.filter(([k]) => k.startsWith(`${id}/`)).map(([k, cell]) => [k.slice(id.length + 1), foundry.utils.deepClone(cell)]))
    }));
}

/** A GM: the log, newest first. */
export function passageLog({ stores = PASSAGE_STORES } = {}) {
    if (!game.user?.isGM) return [];
    const rows = stores.log.entries();
    return logOrder(stores).map(k => ({ ...rows[k] }));
}

/* ----------------------------------------------------------------------------------------- *
 * SHOWING A PASSAGE (E79 C7, 15.10.2026; the E79 plan's P10-0, the owner's Q2 of 11.10). A player
 * shows a passage their character knows to a student standing beside them - 'Show the passage' on
 * the sheet's 'Known passages' (sheet.mjs), asked of the primary GM as `passage.share`
 * (gm-bridge.mjs). The bridge holds who sent it and that the sender owns the giver; the rest is
 * judged here from the GMs' records and the world as it stands now, since the packet's three ids
 * are claims. The answer to a lawful show is the same whoever the recipient is - one who knew the
 * passage already and the Mastermind included - so a show tells the giver nothing about who knew.
 * ----------------------------------------------------------------------------------------- */

/** A floor as `locateActor` hands it - an id or a Level document - as one comparable id. */
const floorKey = level => level?.id ?? level ?? null;

/**
 * What a show reads of the world, on this browser now: the suite hands a world of its own (R562).
 * `place` is `locateActor`'s `{ scene, room, level }`; `sides` the rooms a passage joins on the map
 * (movement.mjs `passageRooms`); `knownRooms` the rooms this character has found on that scene, from
 * the discovery ledger and the room it stands in.
 */
async function liveShareWorld() {
    const [{ isEclipse, isDeadForGm, isDeceased, incidentParticipants, discoveryLedger }, { inClassTrial }, { isMonocub },
        { locateActor, passageRooms }] = await Promise.all([import("./settings.mjs"), import("./trial.mjs"), import("./monocub.mjs"), import("./movement.mjs")]);
    return {
        actor: id => game.actors?.get(id) ?? null,
        locked: () => isEclipse() || inClassTrial(),
        inIncident: actor => incidentParticipants().includes(actor.id),
        monocub: actor => isMonocub(actor),
        monokuma: actor => isMonokuma(actor),
        dead: actor => isDeadForGm(actor),
        published: actor => isDeceased(actor),
        place: actor => locateActor(actor),
        sides: (row, seg) => passageRooms(game.scenes?.get(row.sceneId), seg, row.level ?? null),
        knownRooms: (actor, sceneId) => {
            const known = new Set(discoveryLedger()[sceneId]?.[actor.id] ?? []);
            const here = locateActor(actor, { sceneId });
            if (here?.scene?.id === sceneId && here.room) known.add(here.room);
            return known;
        }
    };
}

/**
 * Why this show is not carried out, as an English reason of the bridge's closed list
 * (bridge-guards.mjs `REASON_PATTERNS`), or null - asked in the order of the plan's P10-0: the phase,
 * the giver (alive, in no incident, no Monocub - D39 leaves a Monocub Move and Meddle), the passage
 * (secret, and known to the giver, or the asker acting as the Mastermind through it - `actsAsMastermind`,
 * the door's reading, so another owner of the Mastermind's student is held to what the student was
 * given or shown, the round-2 review's SEC M3; `asker` null, as a caller that names nobody, is
 * nobody's door), then the one shown it (a student who is not the giver and no Monokuma, in the
 * giver's room on the same scene and floor, alive). A passage that does not exist, one that is
 * closed or broken, and one the giver does not know get one answer, so the reason says nothing of
 * which. A death nobody has found is `cannotNow`, never named. Pure but for `world`, `stores` and
 * `users` (the suite's).
 */
export function shareRefusal({ actorId, targetId, passageId } = {}, world, stores = PASSAGE_STORES, { asker = null, users = game.users } = {}) {
    if (world.locked()) return "that action is locked";
    const giver = world.actor(actorId);
    if (!giver) return "no such character";
    if (world.dead(giver) || world.inIncident(giver)) return "that cannot be done now";
    if (world.monocub(giver)) return "that action is not open to that character now";
    const row = typeof passageId === "string" ? stores.map.get(passageId) : null;
    const knows = row?.state === "secret"
        && (Boolean(stores.access.get(`${passageId}/${giver.id}`)) || actsAsMastermind(giver, asker, { mastermind: stores.mastermind, users }));
    if (!knows) return "the character does not know that passage";
    const target = world.actor(targetId);
    if (!target || target.id === giver.id || target.type !== "character" || world.monokuma(target)) return "no such character";
    const here = world.place(giver), there = world.place(target);
    if (!here?.room) return "the character has no token on a scene";
    if (!there?.room || there.scene?.id !== here.scene?.id || floorKey(there.level) !== floorKey(here.level) || there.room !== here.room) {
        return "the character is not in that room";
    }
    if (world.dead(target) && world.published(target)) return "the character shown it is dead";
    if (world.dead(target)) return "that cannot be done now";
    return null;
}

/**
 * The two rooms a passage joins, as `actor` may name them: each room on the map (`world.sides`), else
 * the name the GM gave it, and a room this character has not found "Unexplored room n" as Listen says
 * it (action-rolls.mjs `listenLabels`); `null` for `known` names every room (a GM, the Mastermind).
 */
function roomsAsKnown(row, world, known) {
    const seg = row.passageSeg ?? {};
    const sides = world.sides(row, { x1: seg.x1, y1: seg.y1, x2: seg.x2, y2: seg.y2 }) ?? [];
    const names = [0, 1].map(i => sides[i] ?? row.rooms?.[i] ?? null);
    let unexplored = 0;
    const said = names.map(room => !room ? "-" : !known || known.has(room) ? room
        : game.i18n.format("DRPG.Listen.unknownRoom", { n: ++unexplored }));
    return { from: said[0], to: said[1] };
}

/**
 * The primary GM carries out a show (`passage.share`): answers `{ refused }` with `shareRefusal`'s
 * reason, or `{ shown: true }` once judged. The first show of a passage to a student writes it: the
 * one shown it learns the passage - a cell `shown`, the giver's actor id in `by` - their owners'
 * copies are sent, a log row "show" names them, and three are told: the one shown it, a card to
 * their owners and the GMs that names the two rooms as they may know them, with the sound
 * `passageFound` (R562); the GMs, a card of their own that names both students and both rooms; the
 * giver's asker, a card that names nobody's rooms. A show to a student who already knows the
 * passage writes nothing and tells the asker the same card and answer as a first one, and nobody
 * else anything: the asker learns nothing of what the other knew, and a console that repeats it
 * cannot push the GMs' log out to its 200 rows or fill the chat (the round-2 review, 16.10.2026:
 * SEC m1, which measured both at 201 shows). The giver's card goes to the asker alone, so a first
 * show and a repeated one reach the same people; the GMs read the show on their own card (until
 * that review the GMs' word was a notice on the primary's browser alone, unescaped - S12-H3).
 * `asker` is who asked (the bridge's sender, the local road's own user); `world`, `whisper`, `gms`
 * and `users` are the suite's (R562).
 */
export async function sharePassage({ actorId, targetId, passageId } = {}, { stores = PASSAGE_STORES, world = null, whisper = whisperToOwner,
    gms = whisperToGms, asker = null, users = game.users } = {}) {
    const facts = world ?? await liveShareWorld();
    const why = shareRefusal({ actorId, targetId, passageId }, facts, stores, { asker, users });
    if (why) return { refused: why };
    const giver = facts.actor(actorId), target = facts.actor(targetId);
    const row = stores.map.get(passageId);
    const cellKey = `${passageId}/${target.id}`;
    const esc = text => foundry.utils.escapeHTML(String(text ?? ""));
    if (!stores.access.get(cellKey)) {
        const at = serverNow();
        await stores.access.patch(cellKey, { how: "shown", at, by: { [giver.id]: at } }, { fillOnly: true });
        await touch([target.id], stores);
        await logRow("show", passageId, target.id, stores);
        tellAfter(stores);
        const mastermind = isMastermindActor(target, { mastermind: stores.mastermind });
        const theirs = roomsAsKnown(row, facts, mastermind ? null : facts.knownRooms(target, row.sceneId));
        await whisper(target, `<p>${game.i18n.format("DRPG.Passage.card.shown", { giver: esc(giver.name), from: esc(theirs.from), to: esc(theirs.to) })}</p>`,
            { flags: { [MODULE_ID]: { sfx: "passageFound" } } });
        const all = roomsAsKnown(row, facts, null);
        await gms(`<p>${game.i18n.format("DRPG.Passage.gm.shown", { giver: esc(giver.name), target: esc(target.name), from: esc(all.from), to: esc(all.to) })}</p>`);
    }
    await whisper(giver, `<p>${game.i18n.format("DRPG.Passage.card.done", { target: esc(target.name) })}</p>`, asker?.id ? { whisper: [asker.id] } : {});
    return { shown: true };
}

/* ----------------------------------------------------------------------------------------- *
 * The pick on the board (E79 C6; the plan's D5: two clicks, no handles) and the GMs' overlay.
 * ----------------------------------------------------------------------------------------- */

/**
 * How far from a wall a click still snaps to it, and how far each side of it is looked at for a
 * room, in scene pixels at a 100 px grid; the pick scales both by the scene's grid. Chosen, not
 * measured: a fifth of a cell is a slip of the hand, half a cell reaches into the room beyond the
 * thickest wall the seeded maps draw. A stretch shorter than `PICK_SHORTEST` is a double click.
 */
export const PICK_RADIUS = 20;
export const PICK_REACH = 50;
export const PICK_SHORTEST = 8;
const PROBES = [0.35, 0.6, 0.85, 1];

/**
 * Pure: the click `point` snapped to the nearest of `walls` (`{ id, c, door, move }`) within
 * `radius`, `{ wallId, x, y, rooms }` with the two rooms it stands between, sorted - or
 * `{ refused }`, a code of `DRPG.Passage.pick.why`: noWall (no wall in reach), otherWall (not the
 * wall `only` names), door, noMove (a wall that blocks no move), taken (on a stretch of `taken`,
 * `{ wallId, x1, y1, x2, y2 }`), levels (a side's room is on another floor), notBetween (no room on
 * a side, or the same on both). `rooms` are `{ name, polygons, here }`: flat polygons in scene
 * space, `here` whether the piece is on the floor being picked. Each side is looked at along the
 * wall's normal, at four depths up to `reach`, and the first room found there answers.
 */
export function snapToWall(point, walls, rooms, { radius = PICK_RADIUS, reach = PICK_REACH, taken = [], only = null } = {}) {
    const x = Number(point?.x), y = Number(point?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return { refused: "noWall" };
    let best = null;
    for (const wall of walls ?? []) {
        const c = (wall?.c ?? []).slice(0, 4).map(Number);
        if (!wall?.id || c.length < 4 || !c.every(Number.isFinite) || (c[0] === c[2] && c[1] === c[3])) continue;
        const d = distanceToSegment(x, y, c[0], c[1], c[2], c[3]);
        if (d <= radius && (!best || d < best.d)) best = { wall, c, d };
    }
    if (!best) return { refused: "noWall" };
    const { wall, c: [x1, y1, x2, y2] } = best;
    if (only && wall.id !== only) return { refused: "otherWall" };
    if (Number(wall.door) > 0) return { refused: "door" };
    if (Number(wall.move) === 0) return { refused: "noMove" };
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
    const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (len * len)));
    const px = x1 + t * dx, py = y1 + t * dy;
    if ((taken ?? []).some(s => s?.wallId === wall.id && distanceToSegment(px, py, s.x1, s.y1, s.x2, s.y2) <= PASSAGE_TOLERANCE)) {
        return { refused: "taken" };
    }
    const nx = -dy / len, ny = dx / len;
    const side = sign => {
        let elsewhere = false;
        for (const f of PROBES) {
            const qx = px + sign * nx * reach * f, qy = py + sign * ny * reach * f;
            const room = (rooms ?? []).find(r => r?.here && inFlatPolygons(r.polygons, qx, qy));
            if (room) return { name: room.name };
            if ((rooms ?? []).some(r => r && !r.here && inFlatPolygons(r.polygons, qx, qy))) elsewhere = true;
        }
        return { elsewhere };
    };
    const a = side(1), b = side(-1);
    if (a.name && b.name && a.name !== b.name) return { wallId: wall.id, x: px, y: py, rooms: [a.name, b.name].sort((p, q) => p.localeCompare(q)) };
    if ((!a.name && a.elsewhere) || (!b.name && b.elsewhere)) return { refused: "levels" };
    return { refused: "notBetween" };
}

/**
 * Pure: the stretch two snapped clicks make, `{ wallId, seg, rooms }`, or `{ refused }`: otherWall,
 * otherRooms (the second end joins other rooms), short (under `PICK_SHORTEST`), taken (it overlaps
 * a stretch of `taken` on the same wall).
 */
export function stretchBetween(first, second, { taken = [] } = {}) {
    if (!first?.wallId || !second?.wallId) return { refused: "noWall" };
    if (first.wallId !== second.wallId) return { refused: "otherWall" };
    if ((first.rooms ?? []).join("\n") !== (second.rooms ?? []).join("\n")) return { refused: "otherRooms" };
    const len = Math.hypot(second.x - first.x, second.y - first.y);
    if (!(len >= PICK_SHORTEST)) return { refused: "short" };
    const ux = (second.x - first.x) / len, uy = (second.y - first.y) / len;
    const along = (px, py) => (px - first.x) * ux + (py - first.y) * uy;
    for (const s of taken ?? []) {
        if (s?.wallId !== first.wallId) continue;
        const [lo, hi] = [along(s.x1, s.y1), along(s.x2, s.y2)].sort((p, q) => p - q);
        if (hi > PASSAGE_TOLERANCE && lo < len - PASSAGE_TOLERANCE) return { refused: "taken" };
    }
    return { wallId: first.wallId, seg: { x1: first.x, y1: first.y, x2: second.x, y2: second.y }, rooms: [...first.rooms] };
}

/** A scene's rooms as the pick reads them, `{ name, polygons, here }`, `here` whether the piece is on `level`. */
function pickRooms(scene, level) {
    return roomPieces(scene).map(r => ({ name: r.name, polygons: regionShapes(r, { x: 0, y: 0 }), here: onLevel(r, level) }));
}

/**
 * The stretch `[x1, y1, x2, y2]` of `wall` judged as two clicks on its ends would be: each end
 * snapped to that wall alone (`snapToWall`, at the scene's grid), then the two (`stretchBetween`) -
 * `{ rooms }`, the two it joins, sorted, or `{ refused }` with the pick's code. The console's create
 * and the repick ask it through `passageRowFor`, so a stretch the pick refuses is refused there too.
 */
export function stretchOnMap(scene, wall, [x1, y1, x2, y2], { level = null, taken = [] } = {}) {
    const cell = Number(scene?.grid?.size) || 100;
    const rooms = pickRooms(scene, level);
    const reach = { radius: PICK_RADIUS * cell / 100, reach: PICK_REACH * cell / 100, taken, only: wall?.id ?? null };
    const first = snapToWall({ x: x1, y: y1 }, [wall], rooms, reach);
    if (first.refused) return first;
    const second = snapToWall({ x: x2, y: y2 }, [wall], rooms, reach);
    if (second.refused) return second;
    const stretch = stretchBetween(first, second, { taken });
    return stretch.refused ? stretch : { rooms: stretch.rooms };
}

/* The console's words for the pick's codes (`passageRowFor`): a GM's console is English, as every refusal here is. */
const MAP_REFUSALS = Object.freeze({
    noWall: "no such wall on that scene.",
    taken: "the stretch overlaps another passage on that wall.",
    levels: "a room beside the stretch is on another floor.",
    notBetween: "the stretch does not stand between two rooms.",
    otherRooms: "the stretch's two ends stand between different rooms.",
    short: `the stretch is shorter than ${PICK_SHORTEST} px.`
});

/** The stretches of a scene's passages, `{ wallId, x1, y1, x2, y2 }`, but the passage `except`: what a pick may not land on. */
function takenOn(sceneId, except, stores) {
    return Object.entries(stores.map.entries())
        .filter(([id, row]) => id !== except && row?.sceneId === sceneId && row.passageSeg)
        .map(([, row]) => ({ wallId: row.passageWallId, ...row.passageSeg }));
}

/** A scene's walls as documents: the pick's and the repick's one read of them. */
function sceneWalls(scene) {
    return Array.from(scene?.walls ?? []);
}

/**
 * A GM: a broken passage on a new stretch - its wall, its ends and its rooms as the pick gave them,
 * its state secret again; who knows it is kept. Answers true, or false with the refusal. `scene` as
 * `createPassage` takes it.
 */
export async function repickPassage(passageId, { wallId, seg, rooms = [] } = {}, { stores = PASSAGE_STORES, scene: given = null } = {}) {
    if (!game.user?.isGM) return refuse("only a GM picks one again.", false);
    const old = stores.map.get(passageId);
    if (!old) return refuse(`no passage "${passageId}".`, false);
    if (old.state !== "broken") return refuse(`"${passageId}" is ${old.state}.`, false);
    const scene = given ?? game.scenes?.get(old.sceneId);
    if (scene?.id !== old.sceneId) return refuse(`no scene "${old.sceneId}".`, false);
    const wall = sceneWalls(scene).find(w => w.id === wallId);
    const { row, refused } = passageRowFor(scene, wall, { seg, rooms, level: old.level ?? null, startAccess: old.startAccess ?? [],
        taken: takenOn(scene.id, passageId, stores) });
    if (!row) return refuse(refused, false);
    await stores.map.patch(passageId, { passageWallId: row.passageWallId, passageSeg: row.passageSeg, rooms: row.rooms, state: "secret" });
    await touch(knowersOf(passageId, stores), stores, { door: true });
    await logRow("repick", passageId, null, stores);
    tellAfter(stores);
    return true;
}

const tp = key => game.i18n.localize(`DRPG.Passage.pick.${key}`);
const escp = text => foundry.utils.escapeHTML(String(text ?? ""));

/**
 * The pick's window, `{ step(n, rooms), refuse(code), close() }`: which click is next, the rooms the
 * first one found, a refusal's line; closing it (Cancel, Esc, its cross) is `cancel`.
 */
function pickPrompt({ again, cancel }) {
    let closing = false;
    const dialog = new foundry.applications.api.DialogV2({
        window: { title: tp(again ? "retitle" : "title") },
        classes: ["drpg-panel", "drpg-passage-pick"],
        position: { width: 360, top: 80 },
        content: `<p data-drpg-pick-step>${escp(game.i18n.format("DRPG.Passage.pick.step", { n: 1 }))}</p>
            <p data-drpg-pick-say>${escp(tp("first"))}</p><p class="notes" data-drpg-pick-where hidden></p>
            <p class="notes drpg-passage-pick-why" data-drpg-pick-why hidden></p>`,
        buttons: [{ action: "cancel", label: tp("cancel"), default: true }],
        rejectClose: false
    });
    dialog.addEventListener("close", () => { if (!closing) cancel(); });
    dialog.render({ force: true });
    const el = sel => dialog.element?.querySelector?.(sel);
    const set = (sel, text) => {
        const node = el(sel);
        if (!node) return;
        node.textContent = text ?? "";
        node.hidden = !text;
    };
    return {
        step(n, rooms) {
            set("[data-drpg-pick-step]", game.i18n.format("DRPG.Passage.pick.step", { n }));
            set("[data-drpg-pick-say]", tp(n === 1 ? "first" : "second"));
            set("[data-drpg-pick-where]", (rooms ?? []).join(" - "));
            set("[data-drpg-pick-why]", "");
        },
        refuse(code) { set("[data-drpg-pick-why]", tp(`why.${code}`)); },
        close() { closing = true; return dialog.close(); }
    };
}

/** The board's clicks and pointer, in scene coordinates: `click` and `move` with `{ x, y }`, a right click `cancel`. Answers the stop. */
function canvasBoard({ click, move, cancel }) {
    const stage = canvas?.stage;
    if (!stage?.on || !canvas?.ready) return null;
    const at = event => event?.getLocalPosition?.(stage) ?? null;
    const down = event => {
        if (event?.button === 2) return cancel();
        const p = event?.button === 0 ? at(event) : null;
        if (p) click({ x: p.x, y: p.y });
    };
    const over = event => {
        const p = at(event);
        if (p) move({ x: p.x, y: p.y });
    };
    stage.on("pointerdown", down);
    stage.on("pointermove", over);
    return () => {
        stage.off("pointerdown", down);
        stage.off("pointermove", over);
    };
}

/**
 * Room Setup out of the board's way while the pick lasts (`away`), and back after: minimized where
 * its frame allows it, else hidden - a DialogV2 is not minimizable by default (`window.minimizable`
 * false in its DEFAULT_OPTIONS as the harness's shim copies them; v14's own were not read).
 */
async function tuck(dialog, away) {
    if (!dialog) return;
    if (dialog.options?.window?.minimizable) {
        await (away ? dialog.minimize?.() : dialog.maximize?.());
        return;
    }
    if (dialog.element?.style) dialog.element.style.visibility = away ? "hidden" : "";
}

/** The pick's stretch on the overlay's layer "pick": the start, the snapped pointer and the line between; nothing for none. */
export function drawPickLayer({ first = null, at = null, ok = true } = {}) {
    const layer = overlayLayer("pick");
    if (!layer) return;
    clearLayer(layer);
    if (!first && !at) return;
    const colour = overlayColour("--drpg-passage-secret", 0xff3d8b);
    const g = new PIXI.Graphics();
    if (first && at && ok) {
        g.lineStyle(4, colour, 0.95);
        dashedLine(g, first.x, first.y, at.x, at.y, 14, 8);
    }
    g.lineStyle(3, colour, 0.95);
    if (first) g.drawCircle(first.x, first.y, 9);
    if (at) {
        g.lineStyle(2, ok ? colour : overlayColour("--drpg-passage-closed", 0x9a9a9a), 0.9);
        g.drawCircle(at.x, at.y, 12);
    }
    layer.addChild(g);
}

/**
 * A GM: a new passage picked on `scene` with two clicks - or, with `passageId`, a broken one picked
 * again. Room Setup (`dialog`) is tucked away while the pick lasts and comes back after; the scene is
 * viewed first when another is on screen, and the floor is the one on screen. Each click is snapped
 * (`snapToWall`, `stretchBetween`) and a refused one is said in the pick's window and asked again;
 * the second writes through `createPassage` or `repickPassage`. Answers the passage's id, or null
 * when it was cancelled or refused. `board`, `prompt`, `preview` and `notify` are the suite's to replace.
 */
export async function startPassagePick(scene, { dialog = null, passageId = null, stores = PASSAGE_STORES, board = canvasBoard,
    prompt = pickPrompt, preview = drawPickLayer, notify = (kind, text) => ui.notifications?.[kind]?.(text) } = {}) {
    if (!game.user?.isGM) return refuse("only a GM picks one.");
    if (!scene?.id) return null;
    const warnWhy = code => { notify("warn", tp(`why.${code}`)); return null; };
    if (isTrialScene(scene)) return warnWhy("trial");
    const again = passageId ? stores.map.get(passageId) : null;
    if (passageId && (again?.state !== "broken" || again.sceneId !== scene.id)) return refuse(`"${passageId}" is not a broken passage of this scene.`);
    if (viewedScene()?.id !== scene.id) await scene.view();
    const floors = floorsOf(scene);
    const viewed = viewedLevel();
    const level = again ? again.level ?? null
        : floors.length ? (floors.some(f => f.id === viewed?.id) ? viewed.id : floors[0].id) : null;
    const walls = sceneWalls(scene).filter(w => onLevel(w, level));
    const rooms = pickRooms(scene, level);
    const cell = Number(scene.grid?.size) || 100;
    const reachOf = { radius: PICK_RADIUS * cell / 100, reach: PICK_REACH * cell / 100, taken: takenOn(scene.id, passageId, stores) };

    return new Promise(resolve => {
        let first = null, done = false, writing = false, stop = null, ask = null;
        const end = async value => {
            if (done) return;
            done = true;
            stop?.();
            preview({});
            await ask?.close();
            await tuck(dialog, false);
            resolve(value);
        };
        const cancel = () => (writing ? null : end(null));
        ask = prompt({ again: Boolean(again), cancel });
        const snap = point => snapToWall(point, walls, rooms, { ...reachOf, only: first?.wallId ?? null });
        const move = point => {
            if (done) return;
            const at = snap(point);
            preview({ first, at: at.refused ? point : at, ok: !at.refused });
        };
        const click = async point => {
            if (done || writing) return null;
            const at = snap(point);
            if (at.refused) return ask.refuse(at.refused);
            if (!first) {
                first = at;
                preview({ first });
                return ask.step(2, at.rooms);
            }
            const stretch = stretchBetween(first, at, { taken: reachOf.taken });
            if (stretch.refused) return ask.refuse(stretch.refused);
            writing = true;
            let made = null;
            try {
                made = again
                    ? (await repickPassage(passageId, stretch, { stores, scene })) && passageId
                    : await createPassage({ sceneId: scene.id, wallId: stretch.wallId, seg: stretch.seg, rooms: stretch.rooms, level }, { stores, scene });
            } catch (err) {
                error("Could not write the secret passage the pick made", err);
            } finally {
                writing = false;
            }
            if (made) notify("info", game.i18n.format(`DRPG.Passage.pick.${again ? "moved" : "made"}`, { passage: stretch.rooms.join(" - ") }));
            return end(made || null);
        };
        stop = board({ click, move, cancel });
        if (!stop) {
            warnWhy("board");
            end(null);
            return;
        }
        tuck(dialog, true);
    });
}

/** A GM: the stretches of a scene's passages on a floor (or every floor, `level` null), `[{ id, state, x1, y1, x2, y2 }]`; [] elsewhere. */
export function passageStretches(sceneId, level = null, { stores = PASSAGE_STORES } = {}) {
    if (!game.user?.isGM) return [];
    return Object.entries(stores.map.entries())
        .filter(([, row]) => row?.sceneId === sceneId && row.passageSeg && (!level || !row.level || row.level === level))
        .map(([id, row]) => ({ id, state: row.state, ...row.passageSeg }));
}

/* Each state's look: a secret one dashed in the passage colour, a closed one dashed grey, a broken one dotted red. */
const LOOK = {
    secret: { token: "--drpg-passage-secret", fallback: 0xff3d8b, dash: 18, gap: 10, width: 5 },
    closed: { token: "--drpg-passage-closed", fallback: 0x9a9a9a, dash: 18, gap: 10, width: 4 },
    broken: { token: "--drpg-passage-broken", fallback: 0xe5484d, dash: 4, gap: 8, width: 5 }
};

/**
 * The overlay's layer "passages", drawn again: a Graphics per passage of the scene and floor on
 * screen, named by its id and carrying its state (`drpgState`), in its state's look. A GM's
 * browser only - `overlayLayer` is null anywhere else - and nothing is drawn under the fog.
 * `scene` and `level` are the camera's unless given (R573 hands a floor of its own; the overlay
 * never does). A floor switched is a new canvas, and the overlay is drawn again on it (gm-overlay.mjs
 * `registerGmOverlay`, LIVE-E12-02).
 */
export function drawPassagesLayer(layer = overlayLayer("passages"), { stores = PASSAGE_STORES, scene = viewedScene(), level = viewedLevel()?.id ?? null } = {}) {
    if (!layer) return 0;
    clearLayer(layer);
    if (!scene) return 0;
    const stretches = passageStretches(scene.id, level, { stores });
    for (const s of stretches) {
        const look = LOOK[s.state] ?? LOOK.secret;
        const g = new PIXI.Graphics();
        g.name = s.id;
        g.drpgState = s.state;
        g.lineStyle(look.width, overlayColour(look.token, look.fallback), 0.95);
        dashedLine(g, s.x1, s.y1, s.x2, s.y2, look.dash, look.gap);
        layer.addChild(g);
    }
    return stretches.length;
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

/**
 * A player came or went: the door names the Mastermind's first connected owner (`ownerOf`), so a
 * co-owner coming or going may move it (SEC S2), and a player who comes back is sent their copy.
 * `retell` and `told` are the suite's (R555).
 *
 * WHOLE, NOT WHAT CHANGED (E79 fix r2-G3, 16.10.2026; review round 2, H2). What the user was last
 * sent is forgotten either way, so the retell sends their copy even when it is the one they had:
 * the browser that comes back may hold none (another computer, a cleared storage), and its own ask
 * at ready (`onPassageRequest`) may reach this GM before Foundry has marked the user active, where
 * `pushPassageCopies` passes it by. The harness's order is that one (cluster.mjs `connect`; v14's is
 * LIVE-E04-12): at d71759a, 76 G's p4 reloaded and asked, and nobody answered - its copy was the
 * one its storage kept.
 */
export function onUserConnected(user, connected, { retell = retellSoon, told = TOLD } = {}) {
    if (user?.id) told.delete(user.id);
    return retell();
}

/**
 * A user's role changed: a player made a GM, or a GM made a player, is a door that moves - `ownerOf`
 * passes a GM by - and a copy that starts or stops (the round-2 review, 16.10.2026: O18; until then
 * nothing told the copies until the next unrelated change). Any other change of a user is not the
 * passages' business. `retell` is the suite's (R555).
 */
export function onUserUpdated(user, change, options, userId, { retell = retellSoon } = {}) {
    return change?.role !== undefined ? retell() : undefined;
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
 * GM changed or who came, went or changed role, and the primary's watches on the walls and the routes (each asks `isPrimaryGm` when it
 * fires, so a GM who becomes the primary later takes them over).
 */
export function registerPassagesGm() {
    overlayDrawer("passages", layer => drawPassagesLayer(layer));
    Hooks.once("ready", () => {
        if (!game.user.isGM) return;
        game.socket.on(SOCKET_EVENT, (payload, senderId) => {
            onPassageRequest(payload, senderId).catch(err => error("Could not answer a player's secret passages", err));
        });
        Hooks.on("clientSettingChanged", key => {
            if (key === `${MODULE_ID}.${SETTINGS.gmPassageMap}`) redrawGmOverlay("passages");
            if (gmStoresQuiet()) return;
            if (key === `${MODULE_ID}.${SETTINGS.gmPassageMap}` || key === `${MODULE_ID}.${SETTINGS.gmPassageAccess}`
                || key === `${MODULE_ID}.${SETTINGS.mastermind}`) retellSoon();
        });
        Hooks.on("updateActor", (actor, change) => { if (change?.ownership !== undefined) retellSoon(); });
        Hooks.on("deleteActor", () => retellSoon());
        Hooks.on("userConnected", onUserConnected);
        Hooks.on("updateUser", onUserUpdated);
        onGmStoresAudible(() => retellSoon());
        Hooks.on("updateWall", onWallMoved);
        Hooks.on("deleteWall", onWallDeleted);
        Hooks.on("drpgRouteSettled", onRouteSettled);
        redrawGmOverlay("passages");
        passageMapStore.whenHydrated().then(() => redrawGmOverlay("passages")).catch(() => {});
    });
}
