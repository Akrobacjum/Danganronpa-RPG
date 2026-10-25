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
 *
 * Since E80 C1 (18.10.2026) a passage may be a tunnel or stairs (`shape: "tunnel"`): two ends, a click
 * each, in two rooms of the scene on one floor or two, with no wall under either (`tunnelEndAt`,
 * `tunnelRowFor`); the pick takes it from the tab's 'Tunnel or stairs', the console's create from
 * `shape` and `ends`. A knower's copy carries both ends as it carries a stretch, and the GMs' overlay
 * draws the ends on the floor on screen.
 *
 * Since E80 C5 (18.10.2026; S16-17) Foundry's secret doors have a road out: the Season setup's
 * 'Convert to passages' (`convertSecretDoors`) makes each an ordinary wall, shut, and a passage along
 * it that nobody knows where it stands between two rooms; and while one stands, the primary GM writes
 * back any change of its state a player makes (`putBackSecretDoor`, on `updateWall`), the audit reading
 * it shut until that write lands (`secretDoorHeldShut`). The one Wall write here, and only of `door`
 * and `ds` on a wall that already is (R560 still holds: no wall is made a secret door or created).
 * Since E80 fix r1-G1 the write is back to the state a GM last left the door in, and the doors are gone over
 * when a GM's browser takes the primary's place - at its ready, and when a GM leaves (`settleSecretDoors`) - so
 * a change made with no primary to hear it is put back too. Since E80 fix r2-G9 that state is a flag on the door
 * itself (`DOOR_SET`), written with a GM's own change (`stampSecretDoor`, `stampNewSecretDoor`), which no
 * player's wall update can carry, so every GM's browser reads the same; a door with none is taken as it stands.
 *
 * Since E80 C6 (18.10.2026; D4, the owner's A10 Q2) a GM makes a passage public and secret again from the tab
 * (`makePassagePublic`, `makePassageSecret`): every student knows a public one - in the copies, the client's cut
 * and the GMs' audit alike (passages.mjs `secretRowsFrom`) - and the row's `public` is all that is written: no
 * cell, no card, no sound, no world data, no lock lifted; the reset keeps it. A new row carries its `origin`,
 * "gm" or, for a converted secret door, "door", which the tab names.
 *
 * Since H82 C3 (23.10.2026; H82-04) the overlay says, under each secret tunnel or stairs end's ring, where that end
 * leads - the room beyond by its own name, in a knower's mark's words - and a one-way tunnel's link points to its way
 * out (`endWords`, `wayArrow`), drawn from the GMs' rows on a GM's own board alone.
 */

import { MODULE_ID, ACTIONS } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { isPrimaryGm, serverNow, whisperToOwner, whisperToGms, ownerOf, warn, error, debug, serialWrite, plural, forcedDeletion } from "./utils.mjs";
import { passageMapStore, passageSeasonStore, passageAccessStore, passageLogStore, mastermindStore, mastermindUndecided } from "./gm-stores.mjs";
import { RECORD, gmStoresQuiet, whenGmStoresAudible, onGmStoresAudible } from "./gm-store.mjs";
import { senderOf } from "./bridge-guards.mjs";
import { isMonokuma } from "./monokuma.mjs";
import { secretRowsFrom, passageBook, studentIdsOf, sceneGone, endsOf, oneWayOf, PASSAGE_TOLERANCE, DOOR_PART, isSecretDoor, secretDoorsOn, passageSpot } from "./passages.mjs";
import { roomPieces, onLevel, floorsOf, isTrialScene, viewedScene, viewedLevel } from "./rooms.mjs";
import { regionShapes, inFlatPolygons, distanceToSegment } from "./fog-geometry.mjs";
import { overlayLayer, clearLayer, overlayColour, dashedLine, overlayDrawer, redrawGmOverlay } from "./gm-overlay.mjs";

const SOCKET_EVENT = `module.${MODULE_ID}`;

/** The GMs' log keeps this many rows, the newest (the E79 plan's 1b.1). */
export const PASSAGE_LOG_ROWS = 200;

/**
 * The records, as every function here reads them by default; the suite hands its own (R554, R555). `season` since E15
 * part 2 C1: the passages a project made (gm-stores.mjs `passageSeasonStore`, D3), read with the map's as one
 * (`rowsOf`); a suite's stores without one read their own map alone.
 */
export const PASSAGE_STORES = Object.freeze({ map: passageMapStore, season: passageSeasonStore, access: passageAccessStore, log: passageLogStore,
    mastermind: mastermindStore });

const BOOKS = new WeakMap();
/**
 * The passages of `stores`, both stores read as one and each write sent to the store that holds its row (passages.mjs
 * `passageBook`; E15 part 2 C1): what every road here reads where it read `stores.map` until then. One per stores
 * object, kept: the handles it holds do not change.
 */
export function rowsOf(stores = PASSAGE_STORES) {
    let book = BOOKS.get(stores);
    if (!book) BOOKS.set(stores, book = passageBook({ map: stores.map, season: stores.season ?? null }));
    return book;
}

const STATES = new Set(["secret", "closed", "broken"]);
const touchKey = actorId => `touch/${actorId}`;
/* The Mastermind's door row: stamped by what moves the every-passage copy only (see `passageCopyFor`). */
const doorKey = actorId => `door/${actorId}`;
/* A door row's or a touch row's `left`, `{ userId: stamp }`, or nothing: see `touchDoorChange` and `touchOwnerChange`. */
const leftOf = row => (row?.left && typeof row.left === "object" && !Array.isArray(row.left) ? row.left : {});

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
    return Boolean(doc) && ownerOf(doc, peopleOf(users))?.id === user.id;
}

/** The users a caller hands, as an array: Foundry's collection or the suite's list. */
const peopleOf = users => (Array.isArray(users) ? users : [...(users?.values?.() ?? [])]);

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
    // `actors` beside the stores: a public passage's knowers are the students the caller holds (E80 C6).
    for (const [id, row] of Object.entries(secretRowsFrom({ ...stores, actors }))) {
        const actorIds = row.actorIds.filter(a => ids.has(a));
        if (mastermind && !actorIds.includes(mastermind)) actorIds.push(mastermind);
        if (actorIds.length) value[id] = { ...row, actorIds };
    }
    /* A public passage is known to every student (E80 C6), one who first appears after Make public as well, and that one
       has no `touch` row: nothing wrote one, so its part was 0 in a world no reset has cut (gm-store.mjs `newest`), and the
       copy naming it under the passage was refused by the player's engine - at `receiveCopy`'s gate where it is that
       player's only student, by `offersCombine` (no part newer) where they own another - while TOLD read it delivered
       (E80 fix r1-G3, the review's E80-C6-1). So each part is at least the newest Make public of a passage public now. */
    let shared = 0;
    for (const [id, row] of Object.entries(rowsOf(stores).entries())) if (row?.public === true) shared = Math.max(shared, rowsOf(stores).stampOf(id, "public"));
    const stamps = ids.size ? Object.fromEntries([...ids].map(a => [a, Math.max(stores.access.newest(touchKey(a)), shared)]))
        : { "": stores.access.cleared() + 1 };
    /* The copy that takes the every-passage rows away from an owner the door named before carries the part as well, at
       the stamp `touchDoorChange` wrote for that owner as the door left them: newer than the part their copy holds, so
       the player's browser takes it (gm-store.mjs `receiveCopy` weighs the newest part first, then `offersCombine`
       each part). Until review round 3 (17.10.2026, cor A) it carried no such part, and its other parts - the student's
       own, 0 where nobody had given it a passage - had not moved: a copy that kept the part was refused, and the
       passages stayed on that browser. Read off every door row, so an owner who also lost the student is told. */
    /* The same for a student this user owned and owns no more (E79 fix r4-G4, 1.2.79; review round 4, Q8): its part,
       at the stamp `touchOwnerChange` wrote in its `touch` row's `left` as the user left it, newer than the part their
       copy holds. Without it the copy that takes that student's rows away was stamped by the students left alone -
       each 0 where nobody had given it a passage - and refused at the engine's first gate (gm-store.mjs `receiveCopy`,
       its newest part not past the cut), and the rows stayed on that browser (R555; scenario 76 G, red at 0641c4c). A
       part of the student's own and not "": a part a later copy leaves out is gone, never older, so no copy after it
       is refused for it. */
    let door = mastermind ? stores.access.newest(doorKey(mastermind)) : 0;
    for (const [key, row] of Object.entries(stores.access.entries())) {
        const was = key.startsWith(doorKey("")) ? Number(leftOf(row)[user?.id]) : 0;
        if (was > door) door = was;
        const lost = key.startsWith(touchKey("")) ? key.slice(touchKey("").length) : "";
        const gone = lost && !ids.has(lost) ? Number(leftOf(row)[user?.id]) : 0;
        if (gone > 0) stamps[lost] = gone;
    }
    if (mastermind || door > 0) stamps[DOOR_PART] = door;
    return { value, stamps };
}

/* The players who own a student now, by id and sorted: what a `touch` row's `owners` is held against. */
function ownersOf(actor, users) {
    return [...(users ?? [])].filter(u => u && !u.isGM && actor.testUserPermission?.(u, "OWNER")).map(u => u.id).sort();
}

/* What a student's `touch` row is patched with when its players are not the ones it holds (`touchOwnerChange`):
   `owners` as they are, and in `left` each one it held and holds no more, at one past the row's newest stamp. Null
   when they are the same, or for a student this world does not hold. */
function ownersPatch(key, row, actor, users, stores) {
    if (!actor) return null;
    const now = ownersOf(actor, users), held = Array.isArray(row?.owners) ? row.owners : null;
    if (held && JSON.stringify(held) === JSON.stringify(now)) return null;
    const left = { ...leftOf(row) };
    for (const userId of held ?? []) if (!now.includes(userId)) left[userId] = stores.access.newest(key) + 1;
    return Object.keys(left).length ? { owners: now, left } : { owners: now };
}

/**
 * The primary GM, before it tells the copies (`retellPassages`), beside `touchDoorChange`: each student's `touch` row
 * whose players are not the ones it holds (`owners`, written by `touch` as well) is stamped with them, and each player
 * it held and holds no more is kept in `left` at one past the row's newest stamp (E79 fix r4-G4, 1.2.79; review round
 * 4, Q8 = goal S16-11). `passageCopyFor` stamps that player's part for the student with it, so the copy without the
 * student's rows is newer than the one it replaces and taken; it does not move again when the student's rows do. The
 * row's own stamp moves, so the student's other players are sent a copy too, the same rows. Answers the students
 * stamped, by id. `actors` and `users` are the suite's to hand (R555).
 */
export async function touchOwnerChange({ stores = PASSAGE_STORES, actors = game.actors, users = game.users } = {}) {
    const byId = new Map([...(actors ?? [])].map(a => [a?.id, a]));
    const at = serverNow(), rows = {};
    for (const [key, row] of Object.entries(stores.access.entries())) {
        if (!key.startsWith(touchKey(""))) continue;
        const patch = ownersPatch(key, row, byId.get(key.slice(touchKey("").length)) ?? null, users, stores);
        if (patch) rows[key] = { at, ...patch };
    }
    if (Object.keys(rows).length) await stores.access.patchMany(rows);
    return Object.keys(rows).map(key => key.slice(touchKey("").length));
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
 *
 * Since review round 3 (17.10.2026, cor A) the row also keeps `left`, `{ userId: stamp }`: each owner
 * the door named before and names no more, at one past the row's newest stamp as the door left them -
 * past every part of "door" their copy took from this row - and dropped again when the door names
 * them. `passageCopyFor` stamps that owner's part "door" with it, so their next copy, the one without
 * the every-passage rows, is newer and taken; and since it does not move when the door moves on among
 * others, nobody it left is sent a copy for that.
 */
export async function touchDoorChange({ stores = PASSAGE_STORES, actors = game.actors, users = game.users,
    mastermindId = mastermindIdOf(stores.mastermind) } = {}) {
    const actor = mastermindId ? [...(actors ?? [])].find(a => a?.id === mastermindId) ?? null : null;
    const door = actor ? ownerOf(actor, users)?.id ?? null : null;
    const at = serverNow(), rows = {};
    for (const [key, row] of Object.entries(stores.access.entries())) {
        const [head, actorId] = key.split("/");
        if (head === "door" && actorId && actorId !== mastermindId && row?.door) {
            rows[key] = { at, door: null, left: { ...leftOf(row), [row.door]: stores.access.newest(key) + 1 } };
        }
    }
    const held = mastermindId ? stores.access.get(doorKey(mastermindId)) : null;
    if (mastermindId && (held?.door ?? null) !== door) {
        const left = { ...leftOf(held) };
        if (held?.door) left[held.door] = stores.access.newest(doorKey(mastermindId)) + 1;
        if (door) delete left[door];
        rows[doorKey(mastermindId)] = { at, door, left };
    }
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
    await Promise.all([passageMapStore.whenHydrated(), passageSeasonStore.whenHydrated(), passageAccessStore.whenHydrated(), mastermindStore.whenHydrated()]);
    if (!isPrimaryGm()) return false;
    return pushPassageCopies([sender.id], { force: true }) > 0;
}

/**
 * The primary GM tells every connected player what changed (after a restore, a reset, a merge, a
 * change of the Mastermind, a student given to another player), the Mastermind's two students
 * touched first when the door moved (`touchDoorChange`) and each student whose players changed
 * (`touchOwnerChange`, since E79 fix r4-G4). Answers how many were sent. `primary` and the rest (`stores`, `actors`,
 * `users`, `socket`, `told`, as `pushPassageCopies` takes them) are the suite's (R555).
 */
export async function retellPassages({ primary = isPrimaryGm, ...ctx } = {}) {
    if (!primary() || gmStoresQuiet()) return 0;
    await touchDoorChange(ctx);
    await touchOwnerChange(ctx);
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
 *
 * Since E15 part 2 C1 the season's store (`passageSeasonStore`, the projects' passages, D3) is cleared with the access
 * record and the log - its group's cut has already taken it on every GM -, so only the map's rows give start access
 * back; a project's passage and whoever knew it are gone with the season.
 *
 * The minimal form of the reset entry (A10-9, E79 fix r4-G7): E42 takes this function over and
 * extends it rather than writing a second reset step for the passages. R560 holds it to one
 * declaration, exported, here; season-setup.mjs `wipeSeason` is its one caller.
 */
export async function passagesAfterReset({ stores = PASSAGE_STORES } = {}) {
    // The season's passages, a project's, go with who knows them (E15 part 2 C1, D3); the map's stay.
    for (const store of [stores.access, stores.log, ...(stores.season ? [stores.season] : [])]) {
        if (isPrimaryGm()) await store.clear();
        else await store.dropMany(Object.keys(store.entries()));
    }
    const at = serverNow(), who = game.user?.id ?? null, cells = {};
    for (const [id, row] of Object.entries(rowsOf(stores).entries())) {
        for (const actorId of Array.isArray(row?.startAccess) ? row.startAccess : []) {
            if (!studentOf(actorId)) continue;
            cells[`${id}/${actorId}`] = { how: "start", at, by: { [who]: at } };
        }
    }
    if (Object.keys(cells).length) await stores.access.patchMany(cells, { fillOnly: true });
    return stores === PASSAGE_STORES ? retellPassages() : 0;
}

/* ----------------------------------------------------------------------------------------- *
 * The projects' passages (E15 part 2 C2, 25.10.2026; A10's S16-16, the owner's answer of 11.10).
 * ----------------------------------------------------------------------------------------- */

/**
 * WHAT A PROJECT THAT MAKES A PASSAGE ASKS FOR, ONE TABLE (A10-9; the owner, 11.10: "E68 przyjmie `PASSAGE_PRESETS`,
 * bez drugich kopii"). A preset is `{ trait, scale, secret?, effect }`: the statistic its rolls take (config.mjs
 * `TRAITS`), its size (`PROJECT_SCALE`), "always" when it is secret whatever the form says, and the key of the row of
 * projects.mjs `COMPLETION_EFFECTS` its completion asks. Breach the Wall since C3 (A10 step 15: Body, Complex, built in
 * the open or in secret as any project, D37); the owner's three of 15.10 are C5's.
 */
export const PASSAGE_PRESETS = Object.freeze({
    secretPassage: Object.freeze({ trait: "hand", scale: "complex", secret: "always", effect: "opensPassage" }),
    breach: Object.freeze({ trait: "body", scale: "complex", effect: "breachesWall" })
});

/**
 * The rooms that share a wall with `room` on `scene` and `level` (A10 step 14: "Start New pokazuje preset tylko przy
 * sąsiedzie ze wspólną ścianą na tym poziomie"), `[{ room, walls }]` sorted by name, each with the ids of the walls
 * between the two. A wall is read as the pick reads a click on it (`snapToWall`, at the scene's grid), at points
 * spread evenly along it - one more than its length in grid squares, 64 at most, none on its ends -, so a long wall that
 * runs past several rooms names each of them. A door, a wall that stops nobody, a wall of another floor and the courtroom name none. Pure but for
 * `scene`; read on a player's browser for the proposal (walls and regions are world data) and on the GM's for the
 * approval and the completion.
 */
export function wallNeighbours(scene, room, level = null) {
    if (!scene?.id || typeof room !== "string" || !room || isTrialScene(scene)) return [];
    const rooms = pickRooms(scene, level);
    const cell = Number(scene.grid?.size) || 100;
    const reach = { radius: PICK_RADIUS * cell / 100, reach: PICK_REACH * cell / 100 };
    const out = new Map();
    for (const wall of sceneWalls(scene).filter(w => onLevel(w, level))) {
        const c = (wall?.c ?? []).slice(0, 4).map(Number);
        if (c.length < 4 || !c.every(Number.isFinite)) continue;
        const len = Math.hypot(c[2] - c[0], c[3] - c[1]);
        const steps = Math.max(2, Math.min(64, Math.ceil(len / cell) + 1));
        for (let i = 0; i < steps; i++) {
            const f = (i + 0.5) / steps;
            const at = snapToWall({ x: c[0] + f * (c[2] - c[0]), y: c[1] + f * (c[3] - c[1]) }, [wall], rooms, { ...reach, only: wall.id });
            if (at.refused || !at.rooms.includes(room)) continue;
            const other = at.rooms.find(r => r !== room);
            if (!other) continue;
            const walls = out.get(other) ?? [];
            if (!walls.includes(wall.id)) walls.push(wall.id);
            out.set(other, walls);
        }
    }
    return [...out].map(([name, walls]) => ({ room: name, walls })).sort((a, b) => a.room.localeCompare(b.room));
}

/**
 * What Start New offers a character for a Secret Passage (A10 step 14): `{ sceneId, level, from, neighbours }`, the
 * room it stands in and the rooms beyond its walls on that floor (`wallNeighbours`), or null where there is none - no
 * place, no room, the courtroom, no shared wall. `place` is `{ scene, room, level }`, the caller's reading of where
 * the character stands: the player's own browser for the form, the GMs' (movement.mjs `gmPlaceOf`) for the approval.
 */
export function secretPassageOffer(place) {
    const scene = place?.scene ?? null, from = place?.room ?? null;
    const level = place?.level?.id ?? place?.level ?? null;
    const neighbours = wallNeighbours(scene, from, level).map(n => n.room);
    return neighbours.length ? { sceneId: scene.id, level, from, neighbours } : null;
}

/**
 * A Secret Passage's stretch judged as a new passage's would be (`passageRowFor`): `{ row }` or `{ refused }`. `passage`
 * is what the approval's pick made, `{ sceneId, level, wallId, seg, rooms }`, and the wall must still stand between its
 * two rooms, on its floor, on no other passage's stretch. Asked at the approval and again on the primary at the
 * completion (the stage's D2: "the wall still shared").
 */
export function builtPassageRow(passage, { stores = PASSAGE_STORES } = {}) {
    const scene = game.scenes?.get(typeof passage?.sceneId === "string" ? passage.sceneId : "");
    if (!scene) return { refused: "no such scene." };
    const rooms = Array.isArray(passage.rooms) ? passage.rooms.filter(r => typeof r === "string") : [];
    if (rooms.length !== 2) return { refused: "a secret passage joins two rooms." };
    return passageRowFor(scene, scene.walls?.get(passage.wallId ?? ""), { seg: passage.seg ?? null, rooms, level: passage.level ?? null,
        taken: takenOn(scene.id, null, stores) });
}

/**
 * A COMPLETED SECRET PASSAGE MAKES ITS PASSAGE (E15 part 2 C2; A10 step 14), on the primary GM, as projects.mjs
 * `COMPLETION_EFFECTS`' row "opensPassage" asks once the bar has filled. The stretch is judged again (`builtPassageRow`)
 * and the passage written in the season's store (gm-stores.mjs `passageSeasonStore`, D3) with its project as its
 * `origin`: who knows it is the builder ("built") and the students `sharedIds` names, those the secret project was
 * shared with before it was finished ("shared") - each a student of this world, no Monokuma, nobody else (the caller
 * leaves out the ones who found the project by Observe, who get only its card). The knowers' copies are sent, the
 * Mastermind's door copy with them (the passage did not exist until now), and the GMs' log has a row "built". A
 * passage this project made already is answered again, not made twice. Answers `{ id, rooms, builderId, sharedIds }`,
 * or `{ refused }` with nothing written.
 */
export async function opensPassageDone(projectId, { passage = null, builderId = null, sharedIds = [] } = {}, { stores = PASSAGE_STORES } = {}) {
    if (!game.user?.isGM) return { refused: "only a GM makes one." };
    if (!stores.season) return { refused: "no store for the season's passages." };
    const made = Object.entries(stores.season.entries()).find(([, row]) => row?.origin?.projectId === projectId);
    if (made) return { id: made[0], rooms: made[1].rooms ?? [], builderId: made[1].origin.builderId ?? null, sharedIds: [], again: true };
    if (!studentOf(builderId)) return { refused: "the builder is no student of this world." };
    const { row, refused } = builtPassageRow(passage, { stores });
    if (!row) return { refused };
    const id = `${row.sceneId}.${foundry.utils.randomID()}`;
    if (rowsOf(stores).has(id)) return { refused: "that passage id is taken." };
    await stores.season.patch(id, { ...row, origin: { by: "project", projectId, builderId } });
    const shared = [...new Set(sharedIds ?? [])].filter(a => a !== builderId && studentOf(a));
    const at = serverNow(), who = game.user.id;
    await stores.access.patchMany({
        [`${id}/${builderId}`]: { how: "built", at, by: { [who]: at } },
        ...Object.fromEntries(shared.map(a => [`${id}/${a}`, { how: "shared", at, by: { [who]: at } }]))
    }, { fillOnly: true });
    await touch(knowersOf(id, stores), stores, { door: true });
    await logRow("built", id, builderId, stores);
    tellAfter(stores);
    return { id, rooms: row.rooms, builderId, sharedIds: shared };
}

/**
 * A Secret Passage's completion taken back (the row's `onUncrossed`: a Reroll, a GM's -1, while the project is kept
 * for the Reroll, A10 step 14 and D40): every passage this project made goes, and who knew it (`deletePassage`, which
 * sends the copies). Answers how many went.
 */
export async function undoOpensPassage(projectId, { stores = PASSAGE_STORES } = {}) {
    const ids = Object.entries(stores.season?.entries() ?? {}).filter(([, row]) => row?.origin?.projectId === projectId).map(([id]) => id);
    for (const id of ids) await deletePassage(id, { stores });
    return ids.length;
}

/**
 * The cards of a Secret Passage made (`opensPassageDone`'s answer): the builder's `passageBuilt` - the done card of
 * the project is projects.mjs `announceProjectDone`'s, with its sound - and each student it was shared with
 * `passageBuiltShared`, with the passage's sound; the rooms as each may name them ("Unexplored room n" for a room that
 * student has not been in, fog.mjs `discoveredFor`). No builder's name on the shared card, and nobody else told.
 */
export async function tellPassageBuilt(made) {
    if (!made?.id || made.again) return 0;
    const { discoveredFor } = await import("./fog.mjs");
    const sceneId = String(made.id).split(".")[0];
    const named = actor => {
        const known = new Set(discoveredFor(sceneId, actor.id));
        let unexplored = 0;
        const [from, to] = (made.rooms ?? []).map(room => (known.has(room) ? room : game.i18n.format("DRPG.Listen.unknownRoom", { n: ++unexplored })));
        return { from: foundry.utils.escapeHTML(from ?? "-"), to: foundry.utils.escapeHTML(to ?? "-") };
    };
    let told = 0;
    const builder = studentOf(made.builderId);
    if (builder) {
        await whisperToOwner(builder, `<p>${game.i18n.format("DRPG.Passage.card.passageBuilt", named(builder))}</p>`);
        told++;
    }
    for (const actorId of made.sharedIds ?? []) {
        const actor = studentOf(actorId);
        if (!actor) continue;
        await whisperToOwner(actor, `<p>${game.i18n.format("DRPG.Passage.card.passageBuiltShared", named(actor))}</p>`,
            { flags: { [MODULE_ID]: { sfx: "passageFound" } } });
        told++;
    }
    return told;
}

/* ----------------------------------------------------------------------------------------- *
 * Breach the Wall: the cut (E15 part 2 C3, 25.10.2026; A10's S16-17, step 15). The one wall the
 * module makes (R560): the GMs' passages stay in their stores, a breach is in the world.
 * ----------------------------------------------------------------------------------------- */

/** A wall that stops nothing - no move, no sight, no light, no sound: the hole a breach leaves, Foundry's NONE of each. */
const BREACH_OPEN = () => ({ move: globalThis.CONST?.WALL_MOVEMENT_TYPES?.NONE ?? 0, sight: globalThis.CONST?.WALL_SENSE_TYPES?.NONE ?? 0,
    light: globalThis.CONST?.WALL_SENSE_TYPES?.NONE ?? 0, sound: globalThis.CONST?.WALL_SENSE_TYPES?.NONE ?? 0 });

/** The flag of a breach's hole, `{ breachId, originalWallId, original: { c }, pieceIds }`, or null for any other wall. */
export function breachOf(wall) {
    // Through `getFlag`: a read of `flags` itself adds an empty one to the harness's wall, and the restore is held byte for byte.
    const flag = (typeof wall?.getFlag === "function" ? wall.getFlag(MODULE_ID, "breach") : wall?.flags?.[MODULE_ID]?.breach) ?? null;
    return flag && typeof flag.breachId === "string" && typeof flag.originalWallId === "string" ? flag : null;
}

/** A scene's standing breaches, `[{ wall, breach }]`: each hole and its flag, as every browser's copy of the scene holds them. */
export function breachesOn(scene) {
    return sceneWalls(scene).map(wall => ({ wall, breach: breachOf(wall) })).filter(found => found.breach);
}

/** Whether a wall of `scene` is a standing breach's: its hole, a piece it made, or the wall it was cut from. */
function inBreach(scene, wallId) {
    return breachesOn(scene).some(({ wall, breach }) => wall.id === wallId || breach.originalWallId === wallId || (breach.pieceIds ?? []).includes(wallId));
}

/**
 * A Breach the Wall's stretch judged (E15 part 2 C3): `{ row }`, as a passage's would be (`passageRowFor`: a wall that is
 * no door and stops a move, between the two rooms named, on their floor), or `{ refused }`. Unlike a Secret Passage's, it
 * may stand over another passage's stretch - that passage becomes public with the hole (`cutBreach`) -, and a wall a
 * standing breach was cut from, or made, is refused: one breach to a wall until it is closed, so that each restore
 * gives back the wall the cut found. Asked at the approval and again on the primary at the completion.
 */
export function breachStretchRow(passage) {
    const scene = game.scenes?.get(typeof passage?.sceneId === "string" ? passage.sceneId : "");
    if (!scene) return { refused: "no such scene." };
    const rooms = Array.isArray(passage.rooms) ? passage.rooms.filter(r => typeof r === "string") : [];
    if (rooms.length !== 2) return { refused: "a breach joins two rooms." };
    const wall = scene.walls?.get(passage.wallId ?? "") ?? null;
    if (wall && inBreach(scene, wall.id)) return { refused: "that wall is breached already." };
    return passageRowFor(scene, wall, { seg: passage.seg ?? null, rooms, level: passage.level ?? null, taken: [] });
}

/**
 * The three pieces a stretch makes of a wall `c` = `[x1, y1, x2, y2]`: `before` (from the wall's first end to the
 * stretch), `gap` (the stretch, its ends put on the wall's line) and `after`; a piece shorter than `PASSAGE_TOLERANCE`
 * is null.
 */
function breachPieces(c, seg) {
    const [ax, ay, bx, by] = c, dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy, len = Math.sqrt(len2);
    const t = (x, y) => Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (len2 || 1)));
    const [t1, t2] = [t(seg.x1, seg.y1), t(seg.x2, seg.y2)].sort((p, q) => p - q);
    const at = v => (v === 0 ? [ax, ay] : v === 1 ? [bx, by] : [ax + v * dx, ay + v * dy]);
    return { before: t1 * len >= PASSAGE_TOLERANCE ? [ax, ay, ...at(t1)] : null, gap: [...at(t1), ...at(t2)],
        after: (1 - t2) * len >= PASSAGE_TOLERANCE ? [...at(t2), bx, by] : null };
}

/**
 * A COMPLETED BREACH CUTS THE REAL WALL (E15 part 2 C3; A10 step 15), on the primary GM, as projects.mjs
 * `COMPLETION_EFFECTS`' row "breachesWall" asks once the bar has filled. The stretch is judged again
 * (`breachStretchRow`), then the wall is cut in three, written so that a restore gives it back byte for byte with no
 * key deleted: the wall itself keeps its id and every field but `c`, and becomes the piece before the stretch (or,
 * where the stretch starts at its end, the piece after); the hole is a new wall over the stretch that stops nothing
 * (`BREACH_OPEN`) and alone holds the flag `breach { breachId, originalWallId, original: { c }, pieceIds }` - a new id,
 * never a passage's, and no actor, user or project id (every browser holds the scene's walls); the piece after, where
 * there is one, is a copy of the wall. The passages on that wall are moved to the piece that holds their stretch, so
 * the cut breaks none of them (`wallChanged`), and one whose stretch the hole touches is moved to the hole and made
 * public (`makePassagePublic`: the hole is there for everyone to see). The breach is a public row of the season's
 * store, keyed to its project (`origin`) and its `breach`: the GMs' Passages tab lists it with its Close the breach, the
 * reset and the project's undo find it there. Answers `{ id, breachId, rooms, sceneId, builderId, madePublic }`, or
 * `{ refused }` with nothing written. A breach this project made already is answered again (`again`), not cut twice.
 */
export async function cutBreach(projectId, { passage = null, builderId = null } = {}, { stores = PASSAGE_STORES } = {}) {
    if (!game.user?.isGM) return { refused: "only a GM cuts one." };
    if (!stores.season) return { refused: "no store for the season's passages." };
    const made = Object.entries(stores.season.entries()).find(([, row]) => row?.origin?.projectId === projectId && row.breach);
    if (made) {
        return { id: made[0], breachId: made[1].breach.breachId, rooms: made[1].rooms ?? [], sceneId: made[1].sceneId, builderId: made[1].origin.builderId ?? null,
            madePublic: [], again: true };
    }
    if (!studentOf(builderId)) return { refused: "the builder is no student of this world." };
    return serialWrite(`passage.breach/${passage?.sceneId ?? ""}`, async () => {
        const { row, refused } = breachStretchRow(passage);
        if (!row) return { refused };
        const scene = game.scenes.get(row.sceneId), wall = scene.walls.get(row.passageWallId);
        const c = wall.c.slice(0, 4).map(Number);
        const { before, gap, after } = breachPieces(c, row.passageSeg);
        const keep = before ?? after;
        if (!keep) return { refused: "the stretch is the whole wall: nothing of it would stand." };
        const gapId = foundry.utils.randomID(16), copyId = before && after ? foundry.utils.randomID(16) : null;
        const breachId = foundry.utils.randomID(16);
        const pieceIds = [gapId, ...(copyId ? [copyId] : [])];
        const base = wall.toObject();
        delete base._id;
        delete base._stats;
        const breach = { breachId, originalWallId: wall.id, original: { c }, pieceIds };
        await scene.createEmbeddedDocuments("Wall", [
            { ...foundry.utils.deepClone(base), _id: gapId, c: gap, ...BREACH_OPEN(), flags: { ...(base.flags ?? {}), [MODULE_ID]: { breach } } },
            ...(copyId ? [{ ...foundry.utils.deepClone(base), _id: copyId, c: after }] : [])
        ], { keepId: true });
        // The passages on the wall, to the piece that holds them: the wall's own (`keep`), the copy, or the hole.
        const holds = (piece, seg) => Boolean(piece) && onWall(seg.x1, seg.y1, piece) && onWall(seg.x2, seg.y2, piece);
        const moved = {}, madePublic = [];
        for (const [id, other] of Object.entries(rowsOf(stores).entries())) {
            if (other?.sceneId !== scene.id || other.passageWallId !== wall.id || !other.passageSeg) continue;
            if (holds(keep, other.passageSeg)) continue;
            const to = copyId && holds(after, other.passageSeg) ? copyId : gapId;
            moved[id] = { passageWallId: to };
            if (to === gapId && other.public !== true) madePublic.push(id);
        }
        if (Object.keys(moved).length) await rowsOf(stores).patchMany(moved);
        await wall.update({ c: keep });
        const id = `${scene.id}.${foundry.utils.randomID()}`;
        await stores.season.patch(id, { ...row, passageWallId: gapId, passageSeg: { x1: gap[0], y1: gap[1], x2: gap[2], y2: gap[3] }, public: true,
            origin: { by: "project", projectId, builderId }, breach: { breachId, originalWallId: wall.id, pieceIds } });
        for (const other of madePublic) await setPublic(other, true, stores);
        await touch(knowersOf(id, stores), stores, { door: true });
        await logRow("breach", id, builderId, stores);
        tellAfter(stores);
        return { id, breachId, rooms: row.rooms, sceneId: scene.id, builderId, madePublic };
    });
}

/**
 * A breach closed (E15 part 2 C3): the wall it was cut from given back as the cut found it - its `c` from the hole's
 * flag, the only field the cut wrote on it -, the hole and the copy deleted, the passages the cut moved moved back,
 * and the breach's row gone from the season's store. The GMs' Close the breach, the project's undo
 * (`undoBreachesOf`) and the season's reset (`closeEveryBreach`) all ask this. A passage made public by the cut stays
 * public: the hole was seen. Where the wall it was cut from is gone (a GM deleted it meanwhile), nothing is written and
 * the answer says so, `{ refused }`: the pieces stand, for a GM to see to. Answers `{ closed: breachId }`.
 */
export async function restoreBreach(sceneId, breachId, { stores = PASSAGE_STORES } = {}) {
    if (!game.user?.isGM) return { refused: "only a GM closes one." };
    return serialWrite(`passage.breach/${sceneId ?? ""}`, async () => {
        const scene = game.scenes?.get(sceneId ?? "");
        const found = scene ? breachesOn(scene).find(b => b.breach.breachId === breachId) : null;
        const rows = Object.entries(rowsOf(stores).entries()).filter(([, row]) => row?.breach?.breachId === breachId).map(([id]) => id);
        if (!found) {
            for (const id of rows) await deletePassage(id, { stores });
            return { refused: "no such breach on that scene." };
        }
        const { wall: hole, breach } = found;
        const original = scene.walls.get(breach.originalWallId);
        const c = Array.isArray(breach.original?.c) ? breach.original.c : null;
        if (!original || !c) return { refused: "the wall it was cut from is gone; its pieces are left as they stand." };
        const pieces = [...new Set([hole.id, ...(breach.pieceIds ?? [])])].filter(id => scene.walls.has(id));
        const back = Object.fromEntries(Object.entries(rowsOf(stores).entries())
            .filter(([id, row]) => !rows.includes(id) && row?.sceneId === scene.id && pieces.includes(row.passageWallId))
            .map(([id]) => [id, { passageWallId: original.id }]));
        for (const id of rows) await deletePassage(id, { stores });
        if (Object.keys(back).length) await rowsOf(stores).patchMany(back);
        await original.update({ c: [...c] });
        if (pieces.length) await scene.deleteEmbeddedDocuments("Wall", pieces);
        tellAfter(stores);
        return { closed: breachId };
    });
}

/** A breach project's completion taken back (the row's `onUncrossed`, D40): each breach it cut is closed. Answers how many. */
export async function undoBreachesOf(projectId, { stores = PASSAGE_STORES } = {}) {
    const rows = Object.values(stores.season?.entries() ?? {}).filter(row => row?.origin?.projectId === projectId && row.breach?.breachId);
    let closed = 0;
    for (const row of rows) if ((await restoreBreach(row.sceneId, row.breach.breachId, { stores }))?.closed) closed++;
    return closed;
}

/**
 * Every breach of every scene closed (the season's reset, before the cut takes the season's store; A10 step 17:
 * "przed cięciem `clear` przywraca ściany wyłomów z projektów"). Read off the walls, which every breach's hole is,
 * so a breach whose row the cut took already is found as well. Answers how many were closed.
 */
export async function closeEveryBreach({ stores = PASSAGE_STORES } = {}) {
    if (!game.user?.isGM) return 0;
    let closed = 0;
    for (const scene of game.scenes ?? []) {
        for (const { breach } of breachesOn(scene)) if ((await restoreBreach(scene.id, breach.breachId, { stores }))?.closed) closed++;
    }
    return closed;
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
 * sent a copy for a passage only the door owner holds). A public passage's are every student of the world
 * besides (E80 C6): a Close, an Open or a Delete of one changes every student's owners' copies.
 */
function knowersOf(passageId, stores) {
    const out = new Set(rowsOf(stores).get(passageId)?.public === true ? studentIdsOf() : []);
    for (const key of Object.keys(stores.access.entries())) {
        const [pid, actorId] = key.split("/");
        if (pid === passageId && actorId) out.add(actorId);
    }
    return out;
}

/**
 * Stamp each named character's `touch` row: what its owners may hold has changed; with `door`, a
 * write that moves a passage itself, the Mastermind's door row as well (`passageCopyFor`). Its
 * players with it, as `touchOwnerChange` keeps them, so a change of them since is not written over
 * unnoticed (E79 fix r4-G4).
 */
function touch(actorIds, stores, { door = false } = {}) {
    const at = serverNow(), mastermind = door ? mastermindIdOf(stores.mastermind) : null;
    const rows = Object.fromEntries([...actorIds].map(a => [touchKey(a),
        { at, ...(ownersPatch(touchKey(a), stores.access.get(touchKey(a)), game.actors?.get(a) ?? null, game.users, stores) ?? {}) }]));
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
 * A GM: a new passage on a wall of a scene (`passageRowFor`), or with `shape` "tunnel" a tunnel or
 * stairs between its two `ends`, `[{ x, y, level }, { x, y, level }]` (`tunnelRowFor`, E80 C1). Answers
 * the passage's id, or null. `scene` is the document in hand (the pick's; the suite's own in R561 and
 * R594), else the world's by `sceneId`.
 */
export async function createPassage({ sceneId, wallId, seg = null, rooms = [], level = null, startAccess = [], shape = "wall", ends = null } = {},
    { stores = PASSAGE_STORES, scene: given = null } = {}) {
    if (!game.user?.isGM) return refuse("only a GM creates one.");
    const scene = given ?? game.scenes?.get(sceneId);
    if (!scene || scene.id !== sceneId) return refuse(`no scene "${sceneId}".`);
    if ((startAccess ?? []).some(a => !studentOf(a))) return refuse("a start access names no student of this world.");
    if (shape !== "wall" && shape !== "tunnel") return refuse(`a passage is "wall" or "tunnel", not "${shape}".`);
    const { row, refused } = shape === "tunnel"
        ? tunnelRowFor(scene, ends, { rooms, startAccess, taken: endsTakenOn(scene.id, null, stores) })
        : passageRowFor(scene, scene.walls?.get(wallId), { seg, rooms, level, startAccess, taken: takenOn(scene.id, null, stores) });
    if (!row) return refuse(refused);
    return writeNewPassage(scene, row, stores);
}

/**
 * A new passage's write, its row as `passageRowFor` or `tunnelRowFor` made it: the row with its `origin`
 * (E80 C6: "gm", or "door" for a converted secret door, which the tab's Origin names), its start
 * access, the knowers' touch, the log's "create" row, and with `tell` the copies sent. Answers its id.
 * `createPassage`'s, and since E80 C5 `convertSecretDoors`', which sends the copies once for all.
 */
async function writeNewPassage(scene, row, stores, { tell = true, origin = "gm" } = {}) {
    const id = `${scene.id}.${foundry.utils.randomID()}`;
    await rowsOf(stores).patch(id, { ...row, origin });
    const at = serverNow(), who = game.user.id;
    if (row.startAccess.length) {
        await stores.access.patchMany(Object.fromEntries(row.startAccess.map(a => [`${id}/${a}`, { how: "start", at, by: { [who]: at } }])), { fillOnly: true });
    }
    await touch(knowersOf(id, stores), stores, { door: true });
    await logRow("create", id, null, stores);
    if (tell) tellAfter(stores);
    return id;
}

/* -----------------------------------------------------------------------------------------
 * Foundry's secret doors (E80 C5, 18.10.2026; S16-17, P1-17, P1-18). A secret door is a wall every
 * player's browser holds - where it stands and that it is a door - and Foundry lets a player change
 * its state (open or shut; never to or from locked), so a console opens it and a token walks
 * through. The module's own road is a passage; these are the GM's way from one to the other.
 * ----------------------------------------------------------------------------------------- */

const DOOR_NONE = () => globalThis.CONST?.WALL_DOOR_TYPES?.NONE ?? 0;
const DOOR_OPEN = () => globalThis.CONST?.WALL_DOOR_STATES?.OPEN ?? 1;
const DOOR_CLOSED = () => globalThis.CONST?.WALL_DOOR_STATES?.CLOSED ?? 0;

/**
 * A wall the conversion made ordinary, as a passage: the whole wall, on the first of the scene's
 * floors it stands on whose row `passageRowFor` makes (on a scene with no floors, `level` null).
 * `{ row }` or `{ refused }` with the last floor's reason.
 */
function doorPassageRow(scene, wall, stores) {
    const floors = floorsOf(scene);
    const levels = floors.length ? floors.filter(f => onLevel(wall, f.id)).map(f => f.id) : [null];
    let refused = "that wall is on none of the scene's floors.";
    for (const level of levels) {
        const made = passageRowFor(scene, wall, { level, taken: takenOn(scene.id, null, stores) });
        if (made.row) return made;
        refused = made.refused;
    }
    return { refused };
}

/**
 * What a converted secret door keeps of a door no more (E80 fix r1-G6; the review's E80-SEC-4): its sound and its
 * animation, which only a door uses. Every player's browser holds the scene's walls, so a plain wall that kept either
 * was the one place on the map a secret passage nobody knows stood (P1-17); until this fix the conversion wrote `door`
 * and `ds` alone. A sound's empty value, as a wall drawn with none has it read; an animation's null, its schema's own
 * initial. Not measured on v14's own WallDocument: read off its schema, the harness's wall is a plain record (A10-15).
 */
const DOOR_UNDRESSED = Object.freeze({ doorSound: "", animation: null });

/**
 * A GM: every secret door of `scenes` (each world scene when none are given) made an ordinary wall,
 * shut - one Wall write per scene, of `door` and `ds` and a door's dress (`DOOR_UNDRESSED`), so it blocks a
 * move and sight as it was drawn to - and a secret passage along each one that stands between two rooms (`passageRowFor`,
 * the console's create's rule), with no start access: nobody knows it until a GM grants it. A door
 * that stands between no two rooms (one inside a room, at the map's edge, on a stretch another
 * passage holds) stays the plain wall it now is and is named in `plain` with the reason. Answers
 * `{ converted, passages, plain }`, or null on a player's browser. Run again it finds nothing to do.
 * Since E80 fix r1-G1 the GMs' state of each converted door goes with it, since E80 fix r2-G9 the flag on the
 * wall (`DOOR_SET`) deleted in the same write: a plain wall that carried it would tell every browser a secret
 * door stood there, as a door's dress would (E80 fix r1-G6).
 */
export async function convertSecretDoors({ scenes = null, stores = PASSAGE_STORES } = {}) {
    if (!game.user?.isGM) return refuse("only a GM converts the secret doors.");
    const out = { converted: 0, passages: [], plain: [] };
    for (const scene of scenes ?? Array.from(game.scenes ?? [])) {
        const doorsHere = secretDoorsOn(scene);
        if (!doorsHere.length) continue;
        const ids = doorsHere.map(wall => wall.id);
        await scene.updateEmbeddedDocuments("Wall", doorsHere.map(wall => ({ _id: wall.id, door: DOOR_NONE(), ds: DOOR_CLOSED(), ...DOOR_UNDRESSED,
            ...(doorSetOf(wall) === null ? {} : { [`flags.${MODULE_ID}.${DOOR_SET}`]: forcedDeletion() ?? null }) })));
        for (const wallId of ids) {
            HELD_SHUT.delete(wallId);
            const wall = scene.walls?.get(wallId);
            if (isSecretDoor(wall)) continue;
            out.converted += 1;
            const { row, refused } = doorPassageRow(scene, wall, stores);
            if (row) out.passages.push(await writeNewPassage(scene, row, stores, { tell: false, origin: "door" }));
            else out.plain.push({ sceneId: scene.id, wallId, why: refused });
        }
    }
    if (out.passages.length) tellAfter(stores);
    if (out.converted) {
        warn(`Secret doors: ${out.converted} converted, ${out.passages.length} as secret passages nobody knows yet; `
            + `${out.plain.length} stand between no two rooms and are plain walls now`
            + (out.plain.length ? ` (${out.plain.map(p => `${p.sceneId}/${p.wallId}: ${p.why}`).join("; ")}).` : "."));
    }
    return out;
}

/* The secret doors a player changed whose put-back has not landed: the audit reads each shut. */
const HELD_SHUT = new Set();

/** Whether the primary GM holds this wall shut for the audit (`putBackSecretDoor`): a player's change of it not yet undone. */
export function secretDoorHeldShut(wallId) {
    return HELD_SHUT.has(wallId);
}

const DOOR_LOCKED = () => globalThis.CONST?.WALL_DOOR_STATES?.LOCKED ?? 2;

/**
 * An update option (E80 fix r1-G1): a GM's write of a secret door that is no choice of the GMs' - the put-back's
 * own (`putBackSecretDoor`), the pass's or the watch's write of the state itself, or a stand-in the suite writes
 * as a player's change, or as a door from before E80 fix r2-G9 - and so is not kept as the state the GMs last set
 * (`DOOR_SET`). On a create it leaves the new door with no state (the suite's).
 */
export const DOOR_ASIDE = "drpgDoorAside";

/**
 * THE STATE A GM LAST SET, ON THE DOOR (E80 fix r2-G9, 19.10.2026; the review's E80-FIX-R1-01): the flag
 * `flags.<module>.doorSet` on a secret door, the `ds` a GM last gave it. Until this fix it was a GM store held in
 * each GM's browser (`secretDoorStore`, a client setting out of the case file), so a door that browser had heard
 * no GM change - one left open before that build, one a GM opened from another browser or while this one was
 * away, one on an imported scene, every door after a cleared browser or a restored backup - read as shut, and the
 * pass shut it. On the wall it is world data, the same for every GM's browser, in the world's backup and in a
 * scene's export. A player's wall update can change `ds` and nothing else (v14's BaseWall#canUpdate as design A10
 * reads it; the harness's server holds the same, scenario 30 7e3 forges the flag; on v14 LIVE-E80-03), so a
 * player cannot write it. It tells a player's browser nothing it does not hold already: the door's type and state
 * are on every map (the known leak foundry-secret-door-type), and this is the state the door stood in before the
 * player changed it. Written with a GM's own change (`stampSecretDoor`, `stampNewSecretDoor`); by the primary
 * where a GM's change came without it (`putBackSecretDoor`) and on a door with none (`settleSecretDoors`, which
 * takes such a door as it stands); deleted when the wall stops being a secret door.
 */
export const DOOR_SET = "doorSet";

/** The state a GM last set on this secret door (`DOOR_SET`), a number, or null when none is written on it. */
export function doorSetOf(wall) {
    const value = wall?.flags?.[MODULE_ID]?.[DOOR_SET];
    return value === null || value === undefined || value === "" || !Number.isFinite(Number(value)) ? null : Number(value);
}

/* The write of the state on the door, as the update's own data. */
const doorSetData = ds => ({ flags: { [MODULE_ID]: { [DOOR_SET]: Number(ds) } } });

/**
 * A GM's own update of a wall (`preUpdateWall`, on a GM's browser; E80 fix r2-G9): a change of a secret door's
 * state, or a wall made a secret door, carries that state on the door in the same write (`DOOR_SET`), so whichever
 * GM's browser is the primary reads it. The put-back's own write (`DOOR_ASIDE`) and every other change are left as
 * they are; a door made an ordinary wall loses the flag on the primary's watch (`putBackSecretDoor`). Answers
 * nothing: the change is the write.
 */
export function stampSecretDoor(wall, change, options) {
    if (!game.user?.isGM || options?.[DOOR_ASIDE] || !change || typeof change !== "object") return;
    const hasDs = foundry.utils.hasProperty(change, "ds"), hasDoor = foundry.utils.hasProperty(change, "door");
    if (!hasDs && !hasDoor) return;
    if (!isSecretDoor({ door: hasDoor ? change.door : wall?.door })) return;
    const ds = Number(hasDs ? change.ds : wall?.ds ?? DOOR_CLOSED());
    if (!Number.isFinite(ds)) return;
    foundry.utils.mergeObject(change, doorSetData(ds));
}

/**
 * A GM's own create of a wall (`preCreateWall`, on a GM's browser; E80 fix r2-G9): a secret door drawn or pasted
 * carries the state it is made in (`DOOR_SET`), the GM's choice, over any a pasted door brought along. A create
 * marked `DOOR_ASIDE` is left with none (the suite's door from before this fix).
 */
export function stampNewSecretDoor(wall, data, options) {
    if (!game.user?.isGM || options?.[DOOR_ASIDE] || !isSecretDoor(wall)) return;
    const ds = Number(wall.ds ?? DOOR_CLOSED());
    if (Number.isFinite(ds)) wall.updateSource?.(doorSetData(ds));
}

const doorWord = ds => (ds === DOOR_OPEN() ? "open" : ds === DOOR_LOCKED() ? "locked" : "shut");

/**
 * The primary GM's answer to a change of a secret door's state (`updateWall`, E80 C5, P1-18). One a GM made
 * stands, lets go of a hold, and since E80 fix r1-G1 is the state the GMs last set - since E80 fix r2-G9 on the
 * door (`DOOR_SET`), written with the GM's change on its own browser (`stampSecretDoor`) and here, as the
 * put-back's own write, where the change came without it - unless the write is the put-back's own (`aside`); a
 * GM's change of `door` alone keeps the state the door then has, and a GM's making it an ordinary wall deletes the
 * flag. One anybody else made - a player, or a writer this world does not know as an active user (`senderOf`) -
 * is written back to the state a GM last left the door in: open if that was open, and shut otherwise, shut where
 * none is written on the door (a door no pass has gone over yet, `settleSecretDoors`); and the door held shut for
 * the audit until that write lands, which lets go of it. Until that fix the put-back wrote the state before the change as the change's
 * opposite (opened: shut; shut: open), so a player's "shut" of a shut door, sent whole (`diff: false`), opened it
 * (the review's E80-SEC-3; R601, scenario 30 7e3). A door that stands as a GM left it is left alone and held by
 * nothing; so is a locked one (only a GM locks a door, or changes a locked one); the put-back never locks. On
 * a GM's browser alone (the gate R220's census reads), and there on the primary, asked without `leaving` - a GM
 * the pass was told has gone (`settleSecretDoors`, reroll.mjs's rule): another browser answers false and holds
 * nothing. A change of no state, or of any wall that is no secret door, is left alone.
 * `unheard` is the pass's (`settleSecretDoors`): a state no primary heard change, which it words so. Answers
 * whether it wrote the put-back. A put-back that fails keeps the door held shut and is logged. The hold is
 * taken before the first await: a step the same player sends after the opening is judged against it. `sender`
 * is the suite's (R601, R605, R616). Read on Foundry's documents by A10-15 and from a player's page by
 * scenario 30 7e3; a console's change on v14 is LIVE-E80-03.
 */
export async function putBackSecretDoor(wall, change, userId, { sender = senderOf(userId), aside = false, unheard = false, leaving = null } = {}) {
    if (!game.user?.isGM) return false;
    if (!isPrimaryGm({ leaving })) return false;
    const door = foundry.utils.hasProperty(change ?? {}, "door");
    if (!isSecretDoor(wall)) {
        if (door && doorSetOf(wall) !== null) {
            await wall.unsetFlag(MODULE_ID, DOOR_SET).catch(err => error(`Could not take the secret door's state off the wall ${wall.id}`, err));
        }
        return false;
    }
    const ds = foundry.utils.hasProperty(change ?? {}, "ds");
    if (sender?.isGM) {
        if (ds) HELD_SHUT.delete(wall.id);
        const set = Number(ds ? change.ds : wall.ds);
        if ((ds || door) && !aside && Number.isFinite(set) && doorSetOf(wall) !== set) {
            await wall.update(doorSetData(set), { [DOOR_ASIDE]: true }).catch(err => error(`Could not write the GM's state on the secret door ${wall.id}`, err));
        }
        return false;
    }
    if (!ds) return false;
    const now = Number(change.ds);
    if (now === DOOR_LOCKED()) return false;
    const want = doorSetOf(wall) === DOOR_OPEN() ? DOOR_OPEN() : DOOR_CLOSED();
    if (now === want) {
        HELD_SHUT.delete(wall.id);
        return false;
    }
    HELD_SHUT.add(wall.id);
    const where = `${wall.id}${wall.parent?.name ? ` on "${wall.parent.name}"` : ""}`;
    warn(unheard
        ? `Secret doors: the secret door ${where} stands ${doorWord(now)}, which no GM left it - changed while no primary GM heard it; it is put back ${doorWord(want)}.`
        : `Secret doors: ${sender?.name ?? userId ?? "somebody"} changed the secret door ${where}; it is put back ${doorWord(want)}.`);
    try {
        await wall.update({ ds: want }, { [DOOR_ASIDE]: true });
    } catch (err) {
        error(`Could not put the secret door ${wall.id} back; the audit reads it shut`, err);
    }
    return true;
}

/* The primary GM's watch on the secret doors: the hold is taken in the hook's own turn. */
function onSecretDoorChanged(wall, change, options, userId) {
    if (!isPrimaryGm()) return;
    putBackSecretDoor(wall, change, userId, { aside: Boolean(options?.[DOOR_ASIDE]) }).catch(err => error("Could not put a secret door back", err));
}

/**
 * THE CHANGES NO PRIMARY HEARD (E80 fix r1-G1, 18.10.2026; the review's E80-SEC-3 and E80-COR-1). The watch
 * above answers a change as the primary GM hears it, and a change made while no GM was connected, or one the
 * primary that heard it could not put back before another GM's browser took over (a hold is that browser's
 * memory), reached no primary: until this fix the door stood as the player left it - open, a road through a
 * wall - for good. Now, on the primary GM, each secret door of `scenes` (each world scene when none are given)
 * that stands otherwise than a GM last left it is put back as the watch puts a player's change back
 * (`putBackSecretDoor`, `unheard`): open where a GM last opened it, shut otherwise; a locked one is left alone.
 * Run at this browser's ready, when a GM leaves (`onDoorsGmLeft`) and on a change of role; it asks whether this browser is
 * the primary without the one leaving (`isPrimaryGm({ leaving })`: null where that is this browser), and each
 * put-back asks the same, so the pass does not wait on the leaving GM's `active` - which of that flag and
 * `userConnected` v14 changes first is not measured (LIVE-E30-05; the harness flips the flag first). Where it is run
 * it asks whether the suite holds the stores or stands them in another world (`gmStoresQuiet`): then it is not run.
 * Answers the ids of the doors it put back, or null off the primary.
 * Since E80 fix r2-G9 (the review's E80-FIX-R1-01) the state a GM last set is the one on the door (`DOOR_SET`),
 * the same on every GM's browser, and a secret door with none - one from before this fix, or from a scene made
 * with its walls (an import, `onSceneCreated`) - is taken as it stands and that state written on it (the put-back's
 * own mark), where until then it was read shut and shut. The doors it puts back are told on the GM's screen
 * (`tell`, `doorsPutBackText`), not in the console alone. `leaving` is the leaving GM's, `tell` the suite's (R605,
 * R616, A10-15, scenario 15).
 */
export async function settleSecretDoors({ scenes = null, leaving = null, tell = tellDoorsPutBack } = {}) {
    if (!game.user?.isGM) return null;
    if (!isPrimaryGm({ leaving })) return null;
    const put = [], putWalls = [], taken = [];
    for (const scene of scenes ?? Array.from(game.scenes ?? [])) {
        for (const wall of secretDoorsOn(scene)) {
            if (doorSetOf(wall) === null) {
                if (!isPrimaryGm({ leaving })) continue;
                const ds = Number(wall.ds ?? DOOR_CLOSED());
                if (!Number.isFinite(ds)) continue;
                try {
                    await wall.update(doorSetData(ds), { [DOOR_ASIDE]: true });
                    taken.push(`${wall.id} (${doorWord(ds)})`);
                } catch (err) {
                    error(`Could not write the state of the secret door ${wall.id}`, err);
                }
                continue;
            }
            if (await putBackSecretDoor(wall, { ds: wall.ds }, null, { sender: null, unheard: true, leaving })) {
                put.push(wall.id);
                putWalls.push(wall);
            }
        }
    }
    if (taken.length) warn(`Secret doors: ${taken.length} carried no state a GM set and are kept as they stand: ${taken.join(", ")}.`);
    if (putWalls.length) {
        try {
            tell(putWalls);
        } catch (err) {
            error("Could not tell the GM which secret doors were put back", err);
        }
    }
    return put;
}

/**
 * The GM's word on the doors the pass put back (`settleSecretDoors`; E80 fix r2-G9): how many, and on which scene
 * each, in the module's language. The console names each wall (`putBackSecretDoor`).
 */
export function doorsPutBackText(walls) {
    const counts = new Map();
    for (const wall of walls ?? []) {
        const name = wall?.parent?.name || wall?.parent?.id || "?";
        counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    const n = Array.from(counts.values()).reduce((a, b) => a + b, 0);
    const scenes = Array.from(counts.entries()).map(([name, k]) => `${name} (${k})`).join(", ");
    return plural("DRPG.Season.secretDoorsPutBack", { n, scenes });
}

/* The pass's word on the GM's screen, kept there until it is closed: at a ready it would go by unseen. */
function tellDoorsPutBack(walls) {
    ui.notifications?.warn(doorsPutBackText(walls), { permanent: true });
}

/**
 * A scene created (`createScene`, E80 fix r2-G9): an import or a copy brings its walls with it and no GM's own
 * create of each, so on the primary GM the pass is run on that scene (`settleSecretDoors`): a secret door with no
 * state a GM set gets the one it stands in, and one whose state it brought along stands so. The suite's held
 * stores run none. Registered on a GM's browser only; `settle` and `quiet` are the suite's.
 */
export function onSceneCreated(scene, options, userId, { settle = settleSecretDoors, quiet = gmStoresQuiet } = {}) {
    if (quiet() || !secretDoorsOn(scene).length) return null;
    return Promise.resolve(settle({ scenes: [scene] })).catch(err => {
        error("Could not put the secret doors of a new scene back", err);
        return null;
    });
}

/**
 * A GM left (`userConnected`, E80 fix r1-G1): whoever is the primary after it - this browser, if the list less
 * the one leaving names it (`isPrimaryGm({ leaving })`, reroll.mjs's rule) - runs the pass (`settleSecretDoors`),
 * so a put-back the GM who left could not land is landed here. A player coming or going, or a GM coming, is not
 * this watch's: a GM's coming is its own browser's pass. Registered on a GM's browser only (`registerPassagesGm`);
 * the pass itself asks whether this browser is the primary. `settle` and `quiet` are the suite's (R605).
 */
export function onDoorsGmLeft(user, connected, { settle = settleSecretDoors, quiet = gmStoresQuiet } = {}) {
    if (connected || !user?.isGM || quiet()) return null;
    return Promise.resolve(settle({ leaving: user.id })).catch(err => {
        error("Could not put the secret doors back", err);
        return null;
    });
}

/**
 * A user's role changed (`updateUser`, E80 fix r1-G5; the review's E80-G-10, "at a change of primary"): a GM made a
 * player, or a player made a GM, can make another GM's browser the primary with no GM leaving (`onDoorsGmLeft`) and no
 * ready, so the browser that is the primary now runs the pass (`settleSecretDoors`, which asks that itself) and lands
 * what no primary heard. Any other change of a user, and the suite's held stores (`gmStoresQuiet`), run none. A
 * player made a GM who becomes the primary runs it at that browser's next ready: its `ready` ran as a player's and
 * registered nothing here. Registered on a GM's browser only (`registerPassagesGm`); `settle` and `quiet` are the
 * suite's (R609).
 */
export function onDoorsRoleChanged(user, change, options, userId, { settle = settleSecretDoors, quiet = gmStoresQuiet } = {}) {
    if (change?.role === undefined || quiet()) return null;
    return Promise.resolve(settle()).catch(err => {
        error("Could not put the secret doors back", err);
        return null;
    });
}

/**
 * A GM: a student learns a passage. `how` "gm" unless given; on this GM's browser the first `how`
 * and its time are kept (fill-only), and each GM's grant is added to `by` under its own key (`by`
 * is that GM's id; the suite names two). Two GMs granting at once each write `how`: the merge
 * keeps the newer, as it keeps any field (R554).
 */
export async function grantPassage(passageId, actorId, { how = "gm", by = game.user?.id, stores = PASSAGE_STORES } = {}) {
    if (!game.user?.isGM) return refuse("only a GM grants one.", false);
    if (!rowsOf(stores).get(passageId)) return refuse(`no passage "${passageId}".`, false);
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
    const row = rowsOf(stores).get(passageId);
    if (!row) return refuse(`no passage "${passageId}".`, false);
    if (!STATES.has(state) || !from.includes(row.state)) return refuse(`"${passageId}" is ${row.state}.`, false);
    await rowsOf(stores).patch(passageId, { state });
    await touch(knowersOf(passageId, stores), stores, { door: true });
    await logRow(state === "secret" ? "open" : "close", passageId, null, stores);
    tellAfter(stores);
    return true;
}

export const closePassage = (passageId, { stores = PASSAGE_STORES } = {}) => setState(passageId, "closed", ["secret"], stores);
export const openPassage = (passageId, { stores = PASSAGE_STORES } = {}) => setState(passageId, "secret", ["closed"], stores);

/**
 * A GM: the passage public (`on`) - every student knows it (passages.mjs `secretRowsFrom`) - or secret again, known
 * to the students its cells name, as before (E80 C6; D4, the owner's A10 Q2). The row's `public` alone is written,
 * then every student's `touch` (each owner's copy gains or loses the row) and a log row "public" or "secret", and
 * the copies sent. Nobody is told: no card and no sound; a lock, a seal or a Close stays as it is; the season's reset,
 * which takes the cells, keeps the row and with it `public`. Answers true, also when it already was; false refused.
 */
async function setPublic(passageId, on, stores) {
    if (!game.user?.isGM) return refuse("only a GM changes one.", false);
    const row = rowsOf(stores).get(passageId);
    if (!row) return refuse(`no passage "${passageId}".`, false);
    if ((row.public === true) === on) return true;
    const before = knowersOf(passageId, stores);
    await rowsOf(stores).patch(passageId, { public: on });
    await touch(new Set([...before, ...knowersOf(passageId, stores)]), stores);
    await logRow(on ? "public" : "secret", passageId, null, stores);
    tellAfter(stores);
    return true;
}

export const makePassagePublic = (passageId, { stores = PASSAGE_STORES } = {}) => setPublic(passageId, true, stores);
export const makePassageSecret = (passageId, { stores = PASSAGE_STORES } = {}) => setPublic(passageId, false, stores);

/** A GM: the passage is gone, and every cell of it. */
export async function deletePassage(passageId, { stores = PASSAGE_STORES } = {}) {
    if (!game.user?.isGM) return refuse("only a GM deletes one.", false);
    if (!rowsOf(stores).get(passageId)) return refuse(`no passage "${passageId}".`, false);
    const knowers = knowersOf(passageId, stores);
    const cells = Object.keys(stores.access.entries()).filter(k => k.startsWith(`${passageId}/`));
    await rowsOf(stores).drop(passageId);
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
    const row = rowsOf(stores).get(passageId);
    if (!row) return refuse(`no passage "${passageId}".`, false);
    if (on && !studentOf(actorId)) return refuse(`no student "${actorId}".`, false);
    const was = Array.isArray(row.startAccess) ? row.startAccess : [];
    if (was.includes(actorId) === Boolean(on)) return true;
    await rowsOf(stores).patch(passageId, { startAccess: on ? [...was, actorId] : was.filter(a => a !== actorId) });
    await logRow(on ? "start" : "unstart", passageId, actorId, stores);
    return true;
}

/**
 * A GM: which way a tunnel or stairs goes (H81-02, 20.10.2026; the owner's call of 20.10, "przełącznik w gm panel room
 * setup passages, czy przejście jest jedno czy dwustronne"): `from` the index of the one end it is entered from, 0 or
 * 1, or null for both ways - the row's `oneWay` (passages.mjs `oneWayOf`), written null for both ways since a store's
 * null is a value and reads as none. A tunnel only: a passage in a wall goes both ways. The tab's other edits' road:
 * a GM's browser (the engine refuses a player's write), every knower's touch and the Mastermind's (the copies carry the
 * field), a log row "oneWay" or "bothWays", the copies sent. The primary judges 'Go through' from this record
 * (`crossTunnel`'s `known`), never from a packet. The season's reset and a room's rename write other fields of the
 * row and keep it. Answers true, also when it already went that way; false refused.
 */
export async function setPassageWay(passageId, from, { stores = PASSAGE_STORES } = {}) {
    if (!game.user?.isGM) return refuse("only a GM changes one.", false);
    const row = rowsOf(stores).get(passageId);
    if (!row) return refuse(`no passage "${passageId}".`, false);
    if (!endsOf(row)) return refuse(`"${passageId}" is no tunnel: a passage in a wall goes both ways.`, false);
    if (from !== null && from !== 0 && from !== 1) return refuse("a tunnel is entered from end 0, end 1 or both (null).", false);
    if (oneWayOf(row) === from) return true;
    await rowsOf(stores).patch(passageId, { oneWay: from });
    await touch(knowersOf(passageId, stores), stores, { door: true });
    await logRow(from === null ? "bothWays" : "oneWay", passageId, null, stores);
    tellAfter(stores);
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
 * room is a room of the passage's scene. `roomOf` is the suite's, or the room the route's announcement
 * names (`onRouteSettled`, E79 C14); movement.mjs `roomOfToken` otherwise. Answers the passages revoked.
 */
export async function revokeLeavers(tokenDoc, { stores = PASSAGE_STORES, roomOf = null } = {}) {
    const actorId = tokenDoc?.actorId ?? tokenDoc?.actor?.id;
    const sceneId = tokenDoc?.parent?.id;
    if (!game.user?.isGM || !actorId || !sceneId) return [];
    const due = Object.entries(stores.access.entries()).filter(([key, cell]) => !key.startsWith("touch/")
        && key.endsWith(`/${actorId}`) && typeof cell?.leave === "string"
        && rowsOf(stores).get(key.slice(0, -(actorId.length + 1)))?.sceneId === sceneId);
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
    const row = game.user?.isGM ? rowsOf(stores).get(passageId) : null;
    const on = scene ?? game.scenes?.get(row?.sceneId);
    const ends = endsOf(row);
    if ((!row?.passageSeg && !ends) || !on || on.id !== row.sceneId) return [];
    const { passageRooms } = await import("./movement.mjs");
    return [...new Set(passageRooms(on, ends ? { ends } : row.passageSeg, row.level ?? null).filter(Boolean))];
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
    await Promise.all([rowsOf(stores).whenHydrated?.(), stores.access.whenHydrated?.()]);
    const here = new Set(), rows = {}, cells = {};
    for (const [id, row] of Object.entries(rowsOf(stores).entries())) {
        if (row?.sceneId !== sceneId) continue;
        here.add(id);
        if (Array.isArray(row.rooms) && row.rooms.includes(from)) rows[id] = { rooms: row.rooms.map(room => (room === from ? to : room)) };
    }
    for (const [key, cell] of Object.entries(stores.access.entries())) {
        if (!key.startsWith("touch/") && cell?.leave === from && here.has(key.slice(0, key.lastIndexOf("/")))) cells[key] = { leave: to };
    }
    if (Object.keys(rows).length) await rowsOf(stores).patchMany(rows);
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
    const marked = Object.entries(rowsOf(stores).entries())
        .filter(([, row]) => row?.passageWallId === wall.id && row.sceneId === sceneId && row.state !== "broken" && off(row.passageSeg))
        .map(([id]) => id);
    for (const id of marked) {
        await rowsOf(stores).patch(id, { state: "broken" });
        await touch(knowersOf(id, stores), stores, { door: true });
        await logRow("broken", id, null, stores);
    }
    if (marked.length) tellAfter(stores);
    return marked;
}

/**
 * A GM: where the passage's stretch has its middle, `{ sceneId, level, x, y }`, for the tab's Show - a
 * tunnel's end on `level`, the floor on screen, else its first end, on that end's floor (E80 C1; the end on
 * screen since E80 fix r1-G2, passages.mjs `passageSpot`); null for none.
 */
export function passageMiddle(passageId, { stores = PASSAGE_STORES, level = null } = {}) {
    const row = game.user?.isGM ? rowsOf(stores).get(passageId) : null;
    if (!row) return null;
    const ends = endsOf(row);
    if (ends) return passageSpot({ sceneId: row.sceneId, shape: "tunnel", ends }, level);
    const seg = row.passageSeg;
    if (!seg) return null;
    return passageSpot({ sceneId: row.sceneId, level: row.level ?? null, x1: seg.x1, y1: seg.y1, x2: seg.x2, y2: seg.y2 }, level);
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
    if (rowsOf(stores).get(passageId)?.state !== "secret") return [];
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
    return Object.entries(rowsOf(stores).entries()).map(([id, row]) => ({
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
 * `place` is where the GMs read the character (movement.mjs `gmPlaceOf`: `locateActor`'s `{ scene, room,
 * level }`, null for a token they are putting back or hold as standing where the rules refuse - E80 fix
 * early-C3-G2, where it read the token's document, which the player's own browser writes); `sides` the
 * rooms a passage joins on the map (movement.mjs `passageRooms`); `knownRooms` the rooms this character
 * has found on that scene, from the discovery ledger and the room the GMs read it in.
 */
async function liveShareWorld() {
    const [{ isEclipse, isDeadForGm, isDeceased, incidentParticipants, discoveryLedger }, { inClassTrial }, { isMonocub },
        { gmPlaceOf, passageRooms }] = await Promise.all([import("./settings.mjs"), import("./trial.mjs"), import("./monocub.mjs"), import("./movement.mjs")]);
    return {
        actor: id => game.actors?.get(id) ?? null,
        locked: () => isEclipse() || inClassTrial(),
        inIncident: actor => incidentParticipants().includes(actor.id),
        monocub: actor => isMonocub(actor),
        monokuma: actor => isMonokuma(actor),
        dead: actor => isDeadForGm(actor),
        published: actor => isDeceased(actor),
        place: (actor, { sceneId = null } = {}) => gmPlaceOf(actor, { sceneId }),
        sides: (row, seg) => passageRooms(game.scenes?.get(row.sceneId), seg, row.level ?? null),
        knownRooms: (actor, sceneId) => {
            const known = new Set(discoveryLedger()[sceneId]?.[actor.id] ?? []);
            const here = gmPlaceOf(actor, { sceneId });
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
 * giver's room on the same scene and floor, alive - both where `world.place` reads them, on the live
 * world the GMs' reading, so a giver they read nowhere has no token on a scene and a student shown it
 * they read nowhere is not in that room). A passage that does not exist, one that is
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
    const row = typeof passageId === "string" ? rowsOf(stores).get(passageId) : null;
    const knows = row?.state === "secret" && (row.public === true
        || Boolean(stores.access.get(`${passageId}/${giver.id}`)) || actsAsMastermind(giver, asker, { mastermind: stores.mastermind, users }));
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
 * it (action-rolls.mjs `listenLabels`); `null` for `known` names every room (the GMs, and the owner
 * who acts as the Mastermind through the character - `actsAsMastermind`).
 */
function roomsAsKnown(row, world, known) {
    const seg = row.passageSeg ?? {}, ends = endsOf(row);
    const sides = world.sides(row, ends ? { ends } : { x1: seg.x1, y1: seg.y1, x2: seg.x2, y2: seg.y2 }) ?? [];
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
 * each of their owners alone that names the two rooms as that owner may know them, with the sound
 * `passageFound` (R562); the GMs, a card of their own that names both students and both rooms; the
 * giver's asker, a card that names nobody's rooms. A show to a student who already knows the
 * passage writes nothing and tells the asker the same card and answer as a first one, and nobody
 * else anything: the asker learns nothing of what the other knew, and a console that repeats it
 * cannot push the GMs' log out to its 200 rows or fill the chat (the round-2 review, 16.10.2026:
 * SEC m1, which measured both at 201 shows). The giver's card goes to the asker alone, so a first
 * show and a repeated one reach the same people; the GMs read the show on their own card (until
 * that review the GMs' word was a notice on the primary's browser alone, unescaped - S12-H3).
 *
 * Each owner reads the one shown it's card as they may know the rooms (E79 fix r2-G4, 16.10.2026;
 * the round-2 fixes' rule for what fix r2-G2 left owed): the owner who acts as the Mastermind through
 * the student (`actsAsMastermind`, the door's one reading) every room, any other owner the student's
 * found rooms - so another owner of the Mastermind's student gets the card any student's owner gets,
 * and nothing on it tells the role. Until then one card named the rooms by the role read off the
 * character (`isMastermindActor`) and went through `whisperToOwner` to `ownerOf`'s one owner and the
 * GMs. R562's fixture on cf2e30a's code measured one card, naming the Kitchen the Mastermind's
 * student never found, handed to `whisperToOwner` with no recipients of its own; read in utils.mjs,
 * those are `ownerOf`'s one owner - the same the door names - and the GMs, so a second owner read no
 * room, and was not told at all, of the Mastermind's student or of any other. The GMs read the show
 * on their own card, not on each owner's.
 * `asker` is who asked (the bridge's sender, the local road's own user); `world`, `whisper`, `gms`
 * and `users` are the suite's (R562).
 */
export async function sharePassage({ actorId, targetId, passageId } = {}, { stores = PASSAGE_STORES, world = null, whisper = whisperToOwner,
    gms = whisperToGms, asker = null, users = game.users } = {}) {
    const facts = world ?? await liveShareWorld();
    const why = shareRefusal({ actorId, targetId, passageId }, facts, stores, { asker, users });
    if (why) return { refused: why };
    const giver = facts.actor(actorId), target = facts.actor(targetId);
    const row = rowsOf(stores).get(passageId);
    const cellKey = `${passageId}/${target.id}`;
    const esc = text => foundry.utils.escapeHTML(String(text ?? ""));
    // A public passage is known to the one shown it already (E80 C6): no cell, which would outlast a Make secret.
    if (!stores.access.get(cellKey) && row.public !== true) {
        const at = serverNow();
        await stores.access.patch(cellKey, { how: "shown", at, by: { [giver.id]: at } }, { fillOnly: true });
        await touch([target.id], stores);
        await logRow("show", passageId, target.id, stores);
        tellAfter(stores);
        const found = facts.knownRooms(target, row.sceneId);
        for (const user of peopleOf(users).filter(u => !u.isGM && target.testUserPermission?.(u, "OWNER"))) {
            const door = actsAsMastermind(target, user, { mastermind: stores.mastermind, users });
            const theirs = roomsAsKnown(row, facts, door ? null : found);
            await whisper(target, `<p>${game.i18n.format("DRPG.Passage.card.shown", { giver: esc(giver.name), from: esc(theirs.from), to: esc(theirs.to) })}</p>`,
                { whisper: [user.id], flags: { [MODULE_ID]: { sfx: "passageFound" } } });
        }
        const all = roomsAsKnown(row, facts, null);
        await gms(`<p>${game.i18n.format("DRPG.Passage.gm.shown", { giver: esc(giver.name), target: esc(target.name), from: esc(all.from), to: esc(all.to) })}</p>`);
    }
    await whisper(giver, `<p>${game.i18n.format("DRPG.Passage.card.done", { target: esc(target.name) })}</p>`, asker?.id ? { whisper: [asker.id] } : {});
    return { shown: true };
}

/* ----------------------------------------------------------------------------------------- *
 * 'Go through' a tunnel (E80 C2, 18.10.2026; the stage's P1-05 to P1-08): the primary GM carries out
 * gm-bridge.mjs `passage.cross` - the sender owns the character (the row's guard), and the rest is
 * judged here against the GMs' records and the world as it stands now, never the packet.
 * ----------------------------------------------------------------------------------------- */

/**
 * The English reason of the bridge's closed list (bridge-guards.mjs `REASON_PATTERNS`) for a refusal's code
 * (movement.mjs `tunnelVerdict`, `settleCrossingOnGm`). The player reads the code's own words
 * (`DRPG.Bridge.why.<code>`), which are the words the door's veto says.
 */
export function crossingWhy(code) {
    switch (code) {
        case "notKnown": return "the character does not know that passage";
        case "notAtPassage": return "the character is not at an end of that passage";
        case "oneWay": return "the passage cannot be taken from that side";
        // A token the GMs do not read where it stands (movement.mjs `gmSpotWhy`; H81 fix r1, the review's H81-C1-R5): each
        // its own line in the GM's log, and "That cannot be done now." for the player, who may be standing on the mark.
        case "putBack": return "the GMs are putting the character's token back";
        case "unlawful": return "the GMs hold the character's token as standing where the rules refuse";
        case "moved": return "the character's token moved while the price was taken";
        case "doorLocked": return "the room beyond is locked";
        case "roomSealed": return "the room beyond is sealed";
        case "chained": return "the character is chained where it stands";
        case "cannotLeave": return "the character is held in the incident";
        case "trialLocked": return "the Class Trial is in session";
        case "noBudget": return "the character has no Move and no action left";
        case "eclipseSpent": return "the character's Eclipse crossings are used up";
        default: return "that cannot be done now";
    }
}

/**
 * Carry out a 'Go through': answers `{ crossed: true }` or `{ refused }` (`crossingWhy`'s reason, or the
 * runner's "nothing was carried out" when the write fails). In `serialWrite`, one step per character at a
 * time, so two asks in one breath read the price and the count each after the other's write. The tunnel is
 * a secret tunnel of the GMs' records on a scene that still exists, the same answer as one the character
 * does not know (`notKnown`) otherwise; the token is the character's on that scene, standing where the GMs
 * read it (movement.mjs `gmSpotOf`: none they are putting back or hold as standing where the rules refuse -
 * `putBack`, `unlawful`; E80 fix early-C2-G1). Then the doors' rules (`tunnelVerdict`, with the GMs' rows as `known`,
 * the sender's role as the door's reading - `actsAsMastermind` - and the price left to the next step), the
 * price taken (`settleCrossingOnGm`), the token read again (a move that landed in the price's round trip:
 * `moved`, or a put-back or an unlawful standing begun in it, the price given back). Those three are told to the
 * player as "That cannot be done now." (`cannotNow`), never as `notAtPassage`'s "Stand on the passage's mark...",
 * which sent a knower standing on the mark to stand on it, and each is a Debug line on this browser naming which
 * (H81 fix r1, 20.10.2026; the review's H81-C1-R1 and H81-C1-R5: until then they were "not at an end" and logged
 * nowhere). The token is then written beside the far end (`tunnelLanding`) with
 * `teleport`, `displace`, no animation and movement.mjs `TUNNEL_CROSSING` (H81-14: a GM's browser that moved the token
 * onto the near end never reads its own landing as another move onto an end), and on a write that throws the price given back exactly
 * (`refundCrossingOnGm`). A crossing written is told as a door's is
 * (`announceCrossingOnGm`: the owner's card and the traps' `drpgRoomCrossed`), and in an Eclipse by its veiled
 * card, posted only then (`settleCrossingOnGm`'s `tell`, E80 fix r1-G2). Refused, nothing is written,
 * paid or counted, and nothing is said on the GM's screen: the bridge tells the player. `asker` is the
 * bridge's sender (the local road's own user); `stores`, `users` and `write` are the suite's (tier 2 "A10-18").
 */
export async function crossTunnel({ actorId, passageId } = {}, { asker = null, stores = PASSAGE_STORES, users = game.users,
    write = (doc, data, options) => doc.update(data, options) } = {}) {
    return serialWrite(`passage.cross/${actorId}`, async () => {
        // The bridge runs it on the primary GM alone, and the local road only there.
        if (!isPrimaryGm()) return { refused: "nothing was carried out: the token is moved on the primary GM's browser" };
        const actor = typeof actorId === "string" ? game.actors?.get(actorId) ?? null : null;
        const row = typeof passageId === "string" ? rowsOf(stores).get(passageId) : null;
        const scene = row ? game.scenes?.get(row.sceneId) ?? null : null;
        if (!actor || row?.state !== "secret" || !endsOf(row) || !scene) return { refused: crossingWhy("notKnown") };
        const M = await import("./movement.mjs");
        const mover = { gm: Boolean(asker?.isGM), mastermind: actsAsMastermind(actor, asker, { mastermind: stores.mastermind, users }) };
        const known = secretRowsFrom({ map: stores.map, season: stores.season ?? null, access: stores.access });
        const passage = { id: passageId, sceneId: row.sceneId };
        // A character with two tokens on the scene goes through with the one at an end. Where a token stands is the
        // GMs' reading (movement.mjs `gmSpotOf`, E80 fix early-C2-G1): one they are putting back, or hold as standing
        // where the rules refuse, stands at no end.
        // One the doors' rules let through but the GMs read nowhere is refused with the reason `gmSpotWhy` names.
        const judged = Array.from(scene.tokens ?? []).filter(t => t.actorId === actor.id).map(token => {
            const at = M.gmSpotOf(token), verdict = M.tunnelVerdict(actor, passage, token, { mover, known, pay: false });
            return { token, at, verdict: verdict?.code || at ? verdict : { code: M.gmSpotWhy(token) ?? "cannotNow", unread: true } };
        });
        const { token, at, verdict } = judged.find(j => !j.verdict?.code) ?? judged[0]
            ?? { token: null, at: null, verdict: M.tunnelVerdict(actor, passage, null, { mover, known, pay: false }) };
        if (verdict?.code) {
            // What the table's check reads (LIVE-H81-01): the GMs' reading that refused a token the doors let through.
            if (verdict.unread) debug(`'Go through' ${passageId}: ${token.name ?? token.id} stands at ${token.x},${token.y} on floor ${token.level ?? "none"} `
                + `at height ${token.elevation ?? 0}, which the doors let through, but the primary GM does not read it there: ${verdict.code} `
                + `(${verdict.code === "putBack" ? "a put-back of the GMs is on its way" : "the GMs' judge holds its standing as lawful=false"}); nothing taken`);
            return { refused: crossingWhy(verdict.code) };
        }
        const paid = await M.settleCrossingOnGm(actor, verdict.to);
        if (paid.code) return { refused: crossingWhy(paid.code) };
        // The price is a round trip, and a move can land in it - a put-back, a jump, a GM's hand. A token the GMs no
        // longer read where it was judged is not moved from there, and the price goes back.
        const after = M.gmSpotWhy(token, at);
        if (after) {
            await M.refundCrossingOnGm(actor, paid.cost).catch(back => error("Could not give a tunnel crossing's price back", back));
            debug(`'Go through' ${passageId}: ${token.name ?? token.id} was judged at ${at.x},${at.y} and the primary GM no longer reads it there `
                + `once the price was taken: ${after} (${after === "moved" ? `it stands at ${token.x},${token.y} now`
                    : after === "putBack" ? "a put-back of the GMs is on its way" : "the GMs' judge holds its standing as lawful=false"}); the price given back`);
            return { refused: crossingWhy(after) };
        }
        const spot = M.tunnelLanding(token, verdict.far, verdict.to);
        // On another floor at that floor's height (movement.mjs `landingElevation`, H81-01): the room it is asked there is the end's.
        const height = M.landingElevation(token, spot.level);
        const rises = height !== (Number.isFinite(token.elevation) ? token.elevation : 0);
        try {
            await write(token, { x: spot.x, y: spot.y, ...(spot.level ? { level: spot.level } : {}), ...(rises ? { elevation: height } : {}) },
                { teleport: true, movementAction: "displace", animate: false, [M.TUNNEL_CROSSING]: true });
        } catch (err) {
            error(`Could not move "${token.name}" through a tunnel`, err);
            await M.refundCrossingOnGm(actor, paid.cost).catch(back => error("Could not give a tunnel crossing's price back", back));
            return { refused: "nothing was carried out: the token could not be moved" };
        }
        // An Eclipse's veiled card, once the token stands at the far end (E80 fix r1-G2): never for a write that failed.
        if (paid.tell) await paid.tell().catch(err => error("Could not tell the owner of an Eclipse crossing", err));
        await M.announceCrossingOnGm(actor, verdict.from, verdict.to, token, paid.cost);
        return { crossed: true };
    });
}

/* ----------------------------------------------------------------------------------------- *
 * Find Passage (E80 C3, 18.10.2026; the stage's P1-10 to P1-15, the owner's A10 proposal 13): Analyze's
 * fourth road. The roller's browser throws Head and asks gm-bridge.mjs `passage.find`; the total is the
 * GMs' record of the roll, and what it finds is judged here, on the primary, against the GMs' records and
 * the world as it stands now - never the packet's room, floor or passage.
 * ----------------------------------------------------------------------------------------- */

/**
 * What a passage search reads of the world, on this browser now: the suite hands a world of its own (A10-7).
 * `place` is where the GMs read the character (movement.mjs `gmPlaceOf`, null where they read it nowhere),
 * `sides` the two rooms of a row (movement.mjs `passageRooms`: a tunnel's each at its own end and floor),
 * `knownRooms` the rooms this character has found on that scene - `liveShareWorld`'s readings, with the trial
 * alone for the phase.
 */
async function liveFindWorld() {
    const share = await liveShareWorld();
    const { inClassTrial } = await import("./trial.mjs");
    return { ...share, trial: () => inClassTrial() };
}

/**
 * The open secret passages of `place` this character does not know, oldest first, each `{ id, row, here }`
 * with `here` the index of the side (a tunnel's end) in this room: a wall's on this floor (or on none) whose
 * map sides name the room, and a tunnel's end on this floor whose room is this one. Oldest is the map row's
 * first stamp (the store's stamp of `sceneId`, written once at its create), then the id.
 */
function passagesToFind(actor, place, facts, stores) {
    const floor = floorKey(place.level), out = [];
    for (const [id, row] of Object.entries(secretRowsFrom({ map: stores.map, season: stores.season ?? null, access: stores.access }))) {
        if (row.sceneId !== place.scene.id || row.actorIds.includes(actor.id)) continue;
        if (row.shape === "tunnel") {
            const sides = facts.sides(row, { ends: row.ends }) ?? [];
            const here = [0, 1].find(i => sides[i] === place.room && (floor === null || row.ends[i].level === null || row.ends[i].level === floor));
            if (here !== undefined) out.push({ id, row, here });
            continue;
        }
        if (floor !== null && row.level !== null && row.level !== floor) continue;
        const seg = row.passageSeg ?? {};
        const here = (facts.sides(row, { x1: seg.x1, y1: seg.y1, x2: seg.x2, y2: seg.y2 }) ?? []).indexOf(place.room);
        if (here >= 0) out.push({ id, row, here });
    }
    const first = id => rowsOf(stores).stampOf(id, "sceneId");
    return out.sort((a, b) => first(a.id) - first(b.id) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * Carry out a Find Passage on the primary GM: answers `{ refused }` with a reason of the bridge's closed list
 * (bridge-guards.mjs `REASON_PATTERNS`), else `{ searched: true, found }`, or for a Reroll's replay (`undo`,
 * reroll.mjs `settleAnalyze`) one of `{ found, to }`, `{ kept }`, `{ lost }`, `{ nothing }`. In `serialWrite`,
 * one search per character at a time. Refused: off the primary, in a Class Trial, for no student, a dead one
 * (a death nobody has found is `cannotNow`, never named), a Monocub, and - but for a replay's own find, and a replay
 * handed its first throw's place (`at`), which searches there, or with `at` null nowhere - one the GMs do not read standing in a room
 * (`world.place`: no token, a put-back on its way, a standing the rules refuse; never the room of the token's
 * document alone, which the player's own browser writes) - and a replay handed `at` whom the GMs no longer read in that
 * room, on that scene and floor (E80 fix r1-G5). A search
 * beats `ACTIONS.analyze.passageThreshold` or is a critical; it finds the oldest open secret passage here the
 * character does not know (`passagesToFind`) - none for the asker acting as the Mastermind through it
 * (`actsAsMastermind`, the door's reading), who knows them all - and writes the cell `found` with the roll
 * (`rollId`), the character's `touch` row, a log row, and the copies. One card tells the character's owner
 * (the asker, a player; on a GM's ask every player who owns it, E18 C5) and the GMs, of one shape whatever
 * came of it: the passage found and the room it leads to as that owner may name it, or "no hidden passage
 * here" - so a miss, an empty room and the Mastermind read
 * alike - with the sound `passageFound` (the GMs hear it too) or `searchNothing`. The primary's screen says it
 * once; no card goes to the GMs alone. A replay writes no card - the Reroll's lines say it - and takes back only
 * the cell its own roll wrote. A trap watching for a passage search (traps.mjs `onPassageHunted`) is told here,
 * once the search stands and before its outcome, on every first throw and never for a replay: since E80 fix r1-G1
 * (the review's E80-SEC-1), where until then the roller's browser raised it, so a console that asked for the find
 * without raising it searched past every trap, and the room the trap read was that browser's word. `asker` is the
 * bridge's sender; `stores`, `users`, `world`, `whisper`, `toast`, `note`, `primary` and `hunted` are the suite's
 * (A10-7, R604).
 */
export async function resolvePassageSearch({ actorId, total = 0, isCritical = false, rollId = null, undo = false, at = undefined } = {}, { asker = null,
    stores = PASSAGE_STORES, users = game.users, world = null, whisper = whisperToOwner, toast = text => ui.notifications?.info(text),
    note = noteFindFact, primary = isPrimaryGm, hunted = event => Hooks.callAll("drpgPassageHunted", event) } = {}) {
    return serialWrite(`passage.find/${actorId}`, async () => {
        if (!primary()) return { refused: "nothing was carried out: a passage search is judged on the primary GM's browser" };
        const facts = world ?? await liveFindWorld();
        if (facts.trial()) return { refused: "the Class Trial is in session" };
        const actor = typeof actorId === "string" ? facts.actor(actorId) : null;
        if (!actor || actor.type !== "character" || facts.monokuma(actor)) return { refused: "no such character" };
        if (facts.dead(actor)) return { refused: "that cannot be done now" };
        if (facts.monocub(actor)) return { refused: "that action is not open to that character now" };

        const beat = Boolean(isCritical) || Number(total) >= ACTIONS.analyze.passageThreshold;
        const door = actsAsMastermind(actor, asker, { mastermind: stores.mastermind, users });
        const roll = typeof rollId === "string" && rollId ? rollId : null;
        const mine = undo && roll ? Object.entries(stores.access.entries())
            .find(([key, cell]) => key.endsWith(`/${actor.id}`) && cell?.how === "found" && cell.rollId === roll)?.[0] ?? null : null;
        if (mine && beat) return { kept: true };
        if (mine) {
            await stores.access.drop(mine);
            await touch([actor.id], stores);
            await logRow("lost", mine.slice(0, -(actor.id.length + 1)), actor.id, stores);
            tellAfter(stores);
            return { lost: true };
        }
        // Where the GMs read the character (`facts.place`; E80 fix early-C3-G2, the review's E80-C3-1), asked after a
        // replay's own find: its Reroll takes that back or keeps it wherever the character stands, so a jump out of the
        // GMs' reading does not turn the replay into a refusal that gives the Reroll back and keeps the find. A replay that
        // searches again searches where its first throw was judged (`at`, the GMs' fact `findPlace` that `noteFindFact`
        // wrote; E80 fix r1-G3, the review's E80-C3-2), as a Search's replay draws from its roll's room: until then it
        // searched where the character stood at the Reroll, so a miss in an empty room rerolled after a walk found a
        // passage in a room where no Analyze was paid or thrown. A replay handed no such place (null: a row written before
        // the fact was) searches nowhere, so its Reroll is given back whole. And it searches there only while the GMs still
        // read the character in that room, on that scene and floor (E80 fix r1-G5, the review's E80-G-2), as a Find Stash's
        // replay does (vault.mjs `resolveStashSearch`): until then a miss by a passage, rerolled after a walk away, found
        // that passage in a room the character had left. A character no longer there is refused, and its Reroll given back.
        if (undo && at !== undefined) {
            const held = heldPlace(at);
            const now = held ? facts.place(actor, { sceneId: held.scene.id }) : null;
            if (!held || !now?.room || now.scene?.id !== held.scene.id || now.room !== held.room || floorKey(now.level) !== held.level) {
                return { refused: "the character is not in that room" };
            }
        }
        const place = undo && at !== undefined ? heldPlace(at) : facts.place(actor);
        if (!place?.room || !place.scene?.id) return { refused: "the character has no token on a scene" };
        // The trap's word (E80 fix r1-G1): every first throw that stands, hit or miss, in the room the GMs read.
        if (!undo) hunted({ actor, room: place.room });

        const pick = beat && !door ? passagesToFind(actor, place, facts, stores)[0] ?? null : null;
        let to = null;
        if (pick) {
            const at = serverNow();
            await stores.access.patch(`${pick.id}/${actor.id}`, { how: "found", at, by: { [actor.id]: at }, ...(roll ? { rollId: roll } : {}) }, { fillOnly: true });
            await touch([actor.id], stores);
            await logRow("found", pick.id, actor.id, stores);
            tellAfter(stores);
            const named = roomsAsKnown(rowsOf(stores).get(pick.id), facts, facts.knownRooms(actor, pick.row.sceneId));
            to = pick.here === 0 ? named.to : named.from;
        }
        if (undo) return pick ? { found: true, to } : { nothing: true };

        if (!pick) await logRow("searched", null, actor.id, stores);
        const esc = text => foundry.utils.escapeHTML(String(text ?? ""));
        const people = peopleOf(users);
        // A player's search tells that player (the asker, not another owner of the character); a GM's, every owner (E18 C5).
        const owners = asker && !asker.isGM ? [asker] : people.filter(u => !u.isGM && actor.testUserPermission?.(u, "OWNER"));
        const words = pick ? game.i18n.format("DRPG.Analyze.passageFound", { to: esc(to) }) : game.i18n.localize("DRPG.Analyze.passageNothing");
        await whisper(actor, `<p>${words}</p>`, {
            whisper: [...new Set([...owners.map(u => u.id), ...people.filter(u => u.isGM).map(u => u.id)])],
            flags: { [MODULE_ID]: { sfx: { key: pick ? "passageFound" : "searchNothing", gm: Boolean(pick) } } }
        });
        if (pick) {
            const all = roomsAsKnown(rowsOf(stores).get(pick.id), facts, null);
            toast(game.i18n.format("DRPG.Passage.gm.found", { actor: actor.name, from: all.from, to: all.to }));
        } else toast(game.i18n.format("DRPG.Passage.gm.searched", { actor: actor.name, room: place.room }));
        await note({ actorId: actor.id, rollId: roll, by: asker?.id ?? null,
            place: { sceneId: place.scene.id, room: place.room, level: floorKey(place.level) } });
        return { searched: true, found: Boolean(pick) };
    });
}

/** A first search's place as `noteFindFact` keeps it, `{ sceneId, room, level }`, in `gmPlaceOf`'s shape; null for anything else. */
function heldPlace(at) {
    if (!at || typeof at.sceneId !== "string" || !at.sceneId || typeof at.room !== "string" || !at.room) return null;
    return { scene: game.scenes?.get(at.sceneId) ?? { id: at.sceneId }, room: at.room, level: typeof at.level === "string" ? at.level : null };
}

/**
 * The GMs' facts on the roll a first search was thrown with (action-rolls.mjs `rollOfFact`): its Reroll replays a passage
 * search (`findPassage`), in the place the GMs read the searcher at that throw (`findPlace`: scene, room and floor ids).
 */
async function noteFindFact({ actorId, rollId, by, place = null }) {
    if (!rollId) return false;
    const rolls = await import("./action-rolls.mjs");
    return rolls.noteFactOn(rolls.rollOfFact({ rollId, by, actorId, actions: ["analyze"] }), { findPassage: true, ...(place ? { findPlace: place } : {}) });
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
    return Object.entries(rowsOf(stores).entries())
        .filter(([id, row]) => id !== except && row?.sceneId === sceneId && row.passageSeg)
        .map(([, row]) => ({ wallId: row.passageWallId, ...row.passageSeg }));
}

/**
 * Where one end of a tunnel or stairs lands for a click at `point` on `level` (E80 C1): the middle of the
 * grid square clicked, `{ x, y, level, room }` with the room it stands in on that floor (the first by name
 * where rooms overlap, as movement.mjs `passageRooms` names it), or `{ refused }` - "floor" for a floor the
 * scene has not (none on a scene with no floors), "offRoom" for a square in no room of that floor,
 * "endTaken" for a square another passage's end holds on that floor (`taken`, `[{ x, y, level }]`). The
 * middle of a square because the token that comes through stands on one; a room is read where a stretch's
 * sides are (`pickRooms`). Pure but for `scene`.
 */
export function tunnelEndAt(scene, point, level = null, { taken = [] } = {}) {
    const cell = Number(scene?.grid?.size) || 100;
    const px = Number(point?.x), py = Number(point?.y);
    const floors = floorsOf(scene);
    const floor = typeof level === "string" && level ? level : null;
    if (floors.length ? !floors.some(f => f.id === floor) : floor !== null) return { refused: "floor" };
    if (!Number.isFinite(px) || !Number.isFinite(py)) return { refused: "offRoom" };
    const x = (Math.floor(px / cell) + 0.5) * cell, y = (Math.floor(py / cell) + 0.5) * cell;
    const room = pickRooms(scene, floor).filter(r => r.here && inFlatPolygons(r.polygons, x, y)).map(r => r.name).sort()[0];
    if (!room) return { refused: "offRoom" };
    if ((taken ?? []).some(end => end.x === x && end.y === y && (end.level ?? null) === floor)) return { refused: "endTaken" };
    return { x, y, level: floor, room };
}

/* The console's words for a tunnel's codes (`tunnelRowFor`): English, as every refusal here is. */
const TUNNEL_REFUSALS = Object.freeze({
    floor: "name one of the scene's floors for each end (none on a scene with no floors).",
    offRoom: "an end is in no room on its floor.",
    endTaken: "an end stands on the square of another passage's end.",
    oneRoom: "both ends are in one room.",
    trial: "the trial hall has no secret passages."
});

/**
 * The row of a new tunnel or stairs between `ends` on `scene` (E80 C1): `{ row }`, or `{ refused }` in
 * the console's words. Each end judged by `tunnelEndAt` on its own floor, the two in two rooms, on a
 * scene that is no trial's, and `rooms`, when the caller names them, the two the ends stand in. The row
 * is on no floor in particular (`level` null): each end carries its own. The pick and the console ask
 * this one rule, as `passageRowFor` is the one rule of a stretch.
 */
export function tunnelRowFor(scene, ends, { rooms = [], startAccess = [], taken = [] } = {}) {
    if (!scene?.id) return { refused: "no such scene." };
    if (isTrialScene(scene)) return { refused: TUNNEL_REFUSALS.trial };
    if (!Array.isArray(ends) || ends.length !== 2) return { refused: "a tunnel needs two ends, [{ x, y, level }, { x, y, level }]." };
    const at = [];
    for (const end of ends) {
        const one = tunnelEndAt(scene, end, end?.level ?? null, { taken });
        if (one.refused) return { refused: TUNNEL_REFUSALS[one.refused] };
        at.push(one);
    }
    if (at[0].room === at[1].room) return { refused: TUNNEL_REFUSALS.oneRoom };
    const named = (rooms ?? []).filter(r => typeof r === "string");
    const found = at.map(end => end.room);
    if (named.length && named.slice().sort().join("\n") !== found.slice().sort().join("\n")) {
        return { refused: `the ends stand in ${found.join(" and ")}, not the rooms named.` };
    }
    return { row: { sceneId: scene.id, level: null, shape: "tunnel", ends: at.map(({ x, y, level }) => ({ x, y, level })),
        rooms: found, state: "secret", startAccess: [...new Set(startAccess ?? [])] } };
}

/** The ends of a scene's tunnels, `[{ x, y, level }]`, but the passage `except`'s, whatever their state: what a new end may not land on. */
function endsTakenOn(sceneId, except, stores) {
    return Object.entries(rowsOf(stores).entries())
        .filter(([id, row]) => id !== except && row?.sceneId === sceneId)
        .flatMap(([, row]) => endsOf(row) ?? []);
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
    const old = rowsOf(stores).get(passageId);
    if (!old) return refuse(`no passage "${passageId}".`, false);
    if (old.state !== "broken") return refuse(`"${passageId}" is ${old.state}.`, false);
    const scene = given ?? game.scenes?.get(old.sceneId);
    if (scene?.id !== old.sceneId) return refuse(`no scene "${old.sceneId}".`, false);
    const wall = sceneWalls(scene).find(w => w.id === wallId);
    const { row, refused } = passageRowFor(scene, wall, { seg, rooms, level: old.level ?? null, startAccess: old.startAccess ?? [],
        taken: takenOn(scene.id, passageId, stores) });
    if (!row) return refuse(refused, false);
    await rowsOf(stores).patch(passageId, { passageWallId: row.passageWallId, passageSeg: row.passageSeg, rooms: row.rooms, state: "secret" });
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
function pickPrompt({ again, tunnel = false, cancel }) {
    let closing = false;
    const say = n => tp(tunnel ? (n === 1 ? "tunnelFirst" : "tunnelSecond") : n === 1 ? "first" : "second");
    const dialog = new foundry.applications.api.DialogV2({
        window: { title: tp(tunnel ? "tunnelTitle" : again ? "retitle" : "title") },
        classes: ["drpg-panel", "drpg-passage-pick"],
        position: { width: 360, top: 80 },
        content: `<p data-drpg-pick-step>${escp(game.i18n.format("DRPG.Passage.pick.step", { n: 1 }))}</p>
            <p data-drpg-pick-say>${escp(say(1))}</p><p class="notes" data-drpg-pick-where hidden></p>
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
            set("[data-drpg-pick-say]", say(n));
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
 * when it was cancelled or refused. `board`, `prompt`, `preview`, `notify` and `floorNow` (the floor on
 * screen, by id) are the suite's to replace.
 *
 * With `shape` "tunnel" (E80 C1) the two clicks are a tunnel's or stairs' two ends: each the middle of
 * the square clicked, in a room of the floor on screen at that click (`tunnelEndAt`), so the GM switches
 * the floor between the clicks for stairs; the second in another room than the first. A tunnel is never
 * picked again: no wall moves under it.
 */
export async function startPassagePick(scene, { dialog = null, passageId = null, shape = "wall", stores = PASSAGE_STORES, board = canvasBoard,
    prompt = pickPrompt, preview = drawPickLayer, notify = (kind, text) => ui.notifications?.[kind]?.(text),
    floorNow = () => viewedLevel()?.id ?? null, between = null } = {}) {
    if (!game.user?.isGM) return refuse("only a GM picks one.");
    if (!scene?.id) return null;
    const warnWhy = code => { notify("warn", tp(`why.${code}`)); return null; };
    if (isTrialScene(scene)) return warnWhy("trial");
    const tunnel = shape === "tunnel";
    if (tunnel && passageId) return refuse("a tunnel is never picked again.");
    /* NARROWED TO A PROJECT'S TWO ROOMS (E15 part 2 C2; A10 step 14: "Przy zatwierdzaniu GM wskazuje odcinek trybem z
       kroku 8 zawężonym do wspólnej ściany"). `between` is `{ rooms, level }`: a Secret Passage's builder's room and
       the neighbour the proposal names, on the builder's floor. A click on any wall but one between those two is
       refused ("notThese") and asked again, and the second click writes nothing: the pick answers the stretch,
       `{ sceneId, level, wallId, seg, rooms }`, which the project keeps until its completion makes the passage. With
       `between.over` (a breach's, C3) the stretch may lie over another passage's: the breach makes that one public. */
    const narrowed = !tunnel && !passageId && Array.isArray(between?.rooms) && between.rooms.length === 2
        ? [...between.rooms].map(String).sort((p, q) => p.localeCompare(q)) : null;
    const again = passageId ? rowsOf(stores).get(passageId) : null;
    if (passageId && (again?.state !== "broken" || again.sceneId !== scene.id)) return refuse(`"${passageId}" is not a broken passage of this scene.`);
    if (viewedScene()?.id !== scene.id) await scene.view();
    const floors = floorsOf(scene);
    const floorOf = () => {
        const viewed = floorNow();
        return floors.length ? (floors.some(f => f.id === viewed) ? viewed : floors[0].id) : null;
    };
    const level = again ? again.level ?? null : narrowed ? (typeof between.level === "string" && between.level ? between.level : null) : floorOf();
    const walls = sceneWalls(scene).filter(w => onLevel(w, level));
    const rooms = pickRooms(scene, level);
    const cell = Number(scene.grid?.size) || 100;
    const reachOf = { radius: PICK_RADIUS * cell / 100, reach: PICK_REACH * cell / 100, taken: narrowed && between.over === true ? [] : takenOn(scene.id, passageId, stores) };
    const endsTaken = tunnel ? endsTakenOn(scene.id, null, stores) : [];

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
        ask = prompt({ again: Boolean(again), tunnel, cancel });
        const endAt = point => {
            const at = tunnelEndAt(scene, point, floorOf(), { taken: endsTaken });
            return !at.refused && first && at.room === first.room ? { refused: "oneRoom" } : at;
        };
        const snap = tunnel ? endAt : point => {
            const at = snapToWall(point, walls, rooms, { ...reachOf, only: first?.wallId ?? null });
            return !at.refused && narrowed && at.rooms.join("\n") !== narrowed.join("\n") ? { refused: "notThese" } : at;
        };
        const move = point => {
            if (done) return;
            const at = snap(point);
            // A tunnel's first end on another floor than the one on screen is not drawn there (stairs).
            const from = tunnel && first && first.level !== floorOf() ? null : first;
            preview({ first: from, at: at.refused ? point : at, ok: !at.refused });
        };
        const click = async point => {
            if (done || writing) return null;
            const at = snap(point);
            if (at.refused) return ask.refuse(at.refused);
            if (!first) {
                first = at;
                preview({ first });
                return ask.step(2, tunnel ? [at.room] : at.rooms);
            }
            const stretch = tunnel ? { rooms: [first.room, at.room] } : stretchBetween(first, at, { taken: reachOf.taken });
            if (stretch.refused) return ask.refuse(stretch.refused);
            if (narrowed) return end({ sceneId: scene.id, level, wallId: stretch.wallId, seg: stretch.seg, rooms: stretch.rooms });
            writing = true;
            let made = null;
            try {
                made = tunnel
                    ? await createPassage({ sceneId: scene.id, shape: "tunnel", ends: [first, at].map(({ x, y, level: floor }) => ({ x, y, level: floor })) }, { stores, scene })
                    : again
                        ? (await repickPassage(passageId, stretch, { stores, scene })) && passageId
                        : await createPassage({ sceneId: scene.id, wallId: stretch.wallId, seg: stretch.seg, rooms: stretch.rooms, level }, { stores, scene });
            } catch (err) {
                error("Could not write the secret passage the pick made", err);
            } finally {
                writing = false;
            }
            if (made) notify("info", game.i18n.format(`DRPG.Passage.pick.${tunnel ? "tunnelMade" : again ? "moved" : "made"}`, { passage: stretch.rooms.join(" - ") }));
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

/**
 * A GM: the stretches of a scene's passages on a floor (or every floor, `level` null), `[{ id, state, x1, y1, x2, y2 }]`; [] elsewhere.
 * `gm` is the suite's (R941): the user's role, never what the rows hold.
 */
export function passageStretches(sceneId, level = null, { stores = PASSAGE_STORES, gm = Boolean(game.user?.isGM) } = {}) {
    if (!gm) return [];
    return Object.entries(rowsOf(stores).entries())
        .filter(([, row]) => row?.sceneId === sceneId && row.passageSeg && (!level || !row.level || row.level === level))
        .map(([id, row]) => ({ id, state: row.state, ...row.passageSeg }));
}

/**
 * A GM: the tunnels of a scene with an end on a floor (or every floor, `level` null), `[{ id, state, oneWay, ends }]`,
 * `ends` only those on that floor - both for one floor's tunnel, one for stairs (E80 C1); [] elsewhere. Since H82 C3
 * (H82-04) each end is `{ x, y, level, index, far }`, `index` its place in the row's two and `far` the end at the other
 * side, wherever it is, and `oneWay` the end the tunnel is entered from (passages.mjs `oneWayOf`, null both ways): what
 * the overlay's words and arrow read. `gm` is the suite's (R941): the user's role, never what the rows hold - a
 * Mastermind player's copy names every passage.
 */
export function passageTunnels(sceneId, level = null, { stores = PASSAGE_STORES, gm = Boolean(game.user?.isGM) } = {}) {
    if (!gm) return [];
    const out = [];
    for (const [id, row] of Object.entries(rowsOf(stores).entries())) {
        const ends = row?.sceneId === sceneId ? endsOf(row) : null;
        const here = (ends ?? []).map((end, index) => ({ ...end, index, far: { ...ends[1 - index] } }))
            .filter(end => !level || !end.level || end.level === level);
        if (here.length) out.push({ id, state: row.state, oneWay: oneWayOf(row), ends: here });
    }
    return out;
}

/*
 * THE ROOM BEYOND, AS A KNOWER'S MARK READS IT (H82-04, 23.10.2026). The overlay's words name the room at a tunnel end's
 * other side with movement.mjs `passageRooms`, the reading a knower's mark ends in (fog-doorways.mjs `tunnelMarks` through
 * movement.mjs `tunnelEndRooms`, each end at its floor's bottom when no token is asked) - the map as it is now, as a
 * knower's mark reads it, and not the row's `rooms`, which the tab shows. movement.mjs imports this file, so a static import back
 * would close a cycle (R161): it is loaded once with `import()`, as `passageRoomsOnMap` loads it, at a GM's ready, and the
 * overlay is drawn again when it has come (`registerPassagesGm`). Until then the rings are drawn with no words.
 */
let tunnelRooms = null, tunnelRoomsAsked = null;

/** movement.mjs `passageRooms`, loaded once; answers it (R941 awaits it before it draws). */
export function loadTunnelRooms() {
    tunnelRoomsAsked ??= import("./movement.mjs").then(({ passageRooms }) => (tunnelRooms = passageRooms));
    return tunnelRoomsAsked;
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
 * `registerGmOverlay`, LIVE-E12-02). Since H82 C3 a secret tunnel's Graphics also holds the words under each
 * of its ends' rings (`endWords`) and, one way with both ends here, an arrowhead on its link (`wayArrow`): still
 * one Graphics a passage (R573, R594). `gm` and `rooms` are the suite's (R941): the user's role, and the
 * reading of the room beyond (`loadTunnelRooms`; none yet, no words).
 */
export function drawPassagesLayer(layer = overlayLayer("passages"), { stores = PASSAGE_STORES, scene = viewedScene(), level = viewedLevel()?.id ?? null,
    gm = Boolean(game.user?.isGM), rooms = tunnelRooms } = {}) {
    if (!layer) return 0;
    clearLayer(layer);
    if (!scene || !gm) return 0;
    const stretches = passageStretches(scene.id, level, { stores, gm });
    for (const s of stretches) {
        const look = LOOK[s.state] ?? LOOK.secret;
        const g = new PIXI.Graphics();
        g.name = s.id;
        g.drpgState = s.state;
        g.lineStyle(look.width, overlayColour(look.token, look.fallback), 0.95);
        dashedLine(g, s.x1, s.y1, s.x2, s.y2, look.dash, look.gap);
        layer.addChild(g);
    }
    // A tunnel's ends on this floor, a ring each, joined by the dashed line when both are here (E80 C1).
    const tunnels = passageTunnels(scene.id, level, { stores, gm });
    const grid = Number(scene.grid?.size) || 100, ring = grid * 0.3;
    for (const t of tunnels) {
        const look = LOOK[t.state] ?? LOOK.secret;
        const colour = overlayColour(look.token, look.fallback);
        const g = new PIXI.Graphics();
        g.name = t.id;
        g.drpgState = t.state;
        g.lineStyle(look.width, colour, 0.95);
        for (const end of t.ends) g.drawCircle(end.x, end.y, ring);
        if (t.ends.length === 2) dashedLine(g, t.ends[0].x, t.ends[0].y, t.ends[1].x, t.ends[1].y, look.dash, look.gap);
        // Closed and broken keep 1.2.81's look, no words and no arrow: no knower's screen marks them either (H82-04).
        if (t.state === "secret") {
            wayArrow(g, t, grid, colour);
            for (const end of t.ends) endWords(g, scene, t, end, { grid, colour, rooms });
        }
        layer.addChild(g);
    }
    return stretches.length + tunnels.length;
}

/*
 * A one-way tunnel with both ends on this floor (H82-04): a filled arrowhead at the middle of its link pointing from the end
 * it is entered from to its way out, in the passage's colour, on the tunnel's own Graphics (the line style the dashes set
 * edges it). Stairs, and a tunnel with one end here, have no link to put it on: their words say which way. grid x 0.3 long
 * and grid x 0.24 wide, against the ring's grid x 0.3 radius: chosen, as the investigation chose them, not read at a table
 * (LIVE-H82-03). The points are kept on the Graphics as `drpgArrow` (H82 fix r1, finding H82-C3-R1): R941 reads them on a
 * real canvas, where PIXI keeps every dash of the link as a polygon of its own in `geometry.graphicsData` beside this one.
 */
function wayArrow(g, tunnel, grid, colour) {
    const into = tunnel.ends.find(end => end.index === tunnel.oneWay), out = tunnel.ends.find(end => end.index !== tunnel.oneWay);
    if (tunnel.oneWay === null || !into || !out) return false;
    const length = Math.hypot(out.x - into.x, out.y - into.y);
    if (!length) return false;
    const ux = (out.x - into.x) / length, uy = (out.y - into.y) / length;
    const mx = (into.x + out.x) / 2, my = (into.y + out.y) / 2, half = grid * 0.15, wide = grid * 0.12;
    const points = [mx + ux * half, my + uy * half, mx - ux * half - uy * wide, my - uy * half + ux * wide, mx - ux * half + uy * wide, my - uy * half - ux * wide];
    g.beginFill(colour, 0.95);
    g.drawPolygon(points);
    g.endFill();
    g.drpgArrow = [...points];
    return true;
}

/** The name the overlay's words carry on their tunnel's Graphics. */
const PASSAGE_WORDS = "drpgPassageWords";

/*
 * The words under a tunnel end's ring on the overlay (H82-04): 'Secret passage to {room}', 'Secret passage from {room}' at a
 * one-way tunnel's way out, as a knower's mark says them (fog-doorways.mjs `addTunnelMarks`), but with the room beyond by
 * its own name - a GM is told no 'Unexplored room' - and none where the map names no room there. A knower's size (H81-06:
 * max(20, grid x 0.36) over a keyline of max(4, grid x 0.07), grid x 0.38 under the end; R903 reads the knower's, R941
 * these), in the passage's colour, at alpha 0.7 so that it reads as the GMs' and not as a knower's mark: 0.7 chosen, as
 * the investigation chose it, not read at a table (LIVE-H82-03); resolution 2 as a knower's, whose texture memory for many
 * ends is not measured (the investigation's estimate, not a reading: about 0.47 MB a caption at grid 100). Written here and
 * not taken from fog-doorways.mjs, which imports movement.mjs, which imports this file (R161). A child of the tunnel's
 * Graphics, destroyed with it (gm-overlay.mjs `clearLayer`).
 */
function endWords(g, scene, tunnel, end, { grid, colour, rooms }) {
    const far = typeof rooms === "function" ? rooms(scene, { ends: [end, end.far] })?.[1] ?? null : null;
    if (!far) return false;
    const exit = tunnel.oneWay !== null && tunnel.oneWay !== end.index;
    const text = new PIXI.Text(game.i18n.format(exit ? "DRPG.Passage.mark.from" : "DRPG.Passage.mark.to", { room: far }), {
        fontFamily: '"Special Elite", "Courier New", monospace',
        fontSize: Math.max(20, Math.round(grid * 0.36)),
        fill: colour,
        stroke: overlayColour("--drpg-ink", 0x1a1620),
        strokeThickness: Math.max(4, Math.round(grid * 0.07)),
        align: "center"
    });
    text.resolution = 2;
    text.anchor.set(0.5, 0);
    text.position.set(end.x, end.y + grid * 0.38);
    text.alpha = 0.7;
    text.name = PASSAGE_WORDS;
    g.addChild(text);
    return true;
}

/*
 * A region made, changed or deleted, on a GM's browser (H82-04): the words read the room beyond off the map, so the
 * overlay is drawn again - a quarter second after the last of a burst, as H82-04 asks of a redraw on a signal the overlay
 * did not listen to before. A rename reaches the rows as well (`carryRename`, on the primary), and their change draws it
 * again at once. Since H82 fix r1 (finding H82-C3-R2) also a behaviour made or deleted on a region - a Teleport Token or
 * Change Level unmakes a room and taking it off makes one (rooms.mjs `canBeRoom`), and neither is a Region event - and a
 * scene's own update that changes its regions (`changes.regions`, which fires no `updateRegion`), the three fog.mjs
 * `registerFog` repaints every browser on. A player region (settings.mjs `playerRegions`) is no room either, and its
 * change is not heard here: the overlay reads it at the next redraw.
 */
let wordsTimer = null;
function redrawPassagesSoon() {
    clearTimeout(wordsTimer);
    wordsTimer = setTimeout(() => {
        wordsTimer = null;
        redrawGmOverlay("passages");
    }, 250);
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

/**
 * A student was created: one created already owned by a player (a duplicate, an import, a player's own) changes that
 * player's copy - every public passage names it (E80 C6) - and no ownership update follows to tell them, so the copies
 * are told (E80 fix r1-G3; the C6 gap "a character created while a passage is public reaches its owner's copy only on
 * the next request or retell"). Any other actor is not the passages' business. `retell` is the suite's (R608).
 */
export function onActorCreated(actor, options, userId, { retell = retellSoon } = {}) {
    return actor?.type === "character" ? retell() : undefined;
}

/**
 * An actor's ownership or type changed: a player who owns a student now, or no more, and an actor made a student or no
 * longer one (a type change, E80 fix r1-G5; the review's E80-G-4: every public passage names each student, so one made a
 * student while a passage is public changes its owners' copies), each change a player's copy - so the copies are told.
 * Any other change of an actor is not the passages' business. `retell` is the suite's (R610).
 */
export function onActorUpdated(actor, change, options, userId, { retell = retellSoon } = {}) {
    return change?.ownership !== undefined || change?.type !== undefined ? retell() : undefined;
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

/* The primary GM's watch on the routes: a student kept a passage until leaving a room. The room is the one the
   announcement names (movement.mjs `drpgRouteSettled`, E79 C14: the spot the route's update names), and a second
   announcement of one move, the at-rest read's (`again`), asks again with the room the token came to rest in.
   A route announced before it stood (`provisional`, a route of one update the player's browser charges) is read
   once it stands, and not at all when its charge put it back (review round 3, 17.10.2026, cor D): a revoke is
   no repaint, and until then a refused step out of the room revoked the passage (scenario 76 E). A step out that the
   token's next route ends inside `ROUTE_QUIET_MS` is read through that route alone, as a route with steps pending
   always was: out and back again that fast revokes nothing (read, not measured). */
async function onRouteSettled({ tokenDoc, room, provisional = false } = {}) {
    if (!isPrimaryGm()) return;
    if (provisional && !(await provisional)) return;
    await revokeLeavers(tokenDoc, room === undefined ? {} : { roomOf: () => room }).catch(err => error("Could not revoke a secret passage from a student who left the room", err));
}

/**
 * At ready, on a GM's browser: the ask's listener, the watches that tell the players what another
 * GM changed or who came, went or changed role, and the primary's watches on the walls and the routes (each asks `isPrimaryGm` when it
 * fires, so a GM who becomes the primary later takes them over). Since E80 fix r1-G1 also the secret doors' pass
 * (`settleSecretDoors`): at the ready, if this browser is the primary then, and when a GM leaves, on whoever is
 * the primary after it (`onDoorsGmLeft`) - since E80 fix r1-G5 also when a user's role changes
 * (`onDoorsRoleChanged`), and since E80 fix r2-G9 on a scene created (`onSceneCreated`); and a GM's own change or
 * create of a secret door writes the state on it (`stampSecretDoor`, `stampNewSecretDoor`).
 */
export function registerPassagesGm() {
    overlayDrawer("passages", layer => drawPassagesLayer(layer));
    Hooks.once("ready", () => {
        if (!game.user.isGM) return;
        game.socket.on(SOCKET_EVENT, (payload, senderId) => {
            onPassageRequest(payload, senderId).catch(err => error("Could not answer a player's secret passages", err));
        });
        // The season's passages (E15 part 2 C1) as the map's: the overlay drawn again, the copies told again.
        Hooks.on("clientSettingChanged", key => {
            const rows = key === `${MODULE_ID}.${SETTINGS.gmPassageMap}` || key === `${MODULE_ID}.${SETTINGS.gmPassageSeason}`;
            if (rows) redrawGmOverlay("passages");
            if (gmStoresQuiet()) return;
            if (rows || key === `${MODULE_ID}.${SETTINGS.gmPassageAccess}`
                || key === `${MODULE_ID}.${SETTINGS.mastermind}`) retellSoon();
        });
        Hooks.on("updateActor", onActorUpdated);
        Hooks.on("createActor", onActorCreated);
        Hooks.on("deleteActor", () => retellSoon());
        Hooks.on("userConnected", onUserConnected);
        Hooks.on("updateUser", onUserUpdated);
        onGmStoresAudible(() => retellSoon());
        Hooks.on("updateWall", onWallMoved);
        Hooks.on("preUpdateWall", stampSecretDoor);
        Hooks.on("preCreateWall", stampNewSecretDoor);
        Hooks.on("updateWall", onSecretDoorChanged);
        Hooks.on("deleteWall", onWallDeleted);
        Hooks.on("userConnected", onDoorsGmLeft);
        Hooks.on("updateUser", onDoorsRoleChanged);
        Hooks.on("createScene", onSceneCreated);
        Hooks.on("drpgRouteSettled", onRouteSettled);
        Hooks.on("createRegion", () => redrawPassagesSoon());
        Hooks.on("updateRegion", () => redrawPassagesSoon());
        Hooks.on("deleteRegion", () => redrawPassagesSoon());
        Hooks.on("createRegionBehavior", () => redrawPassagesSoon());
        Hooks.on("deleteRegionBehavior", () => redrawPassagesSoon());
        Hooks.on("updateScene", (scene, changes) => { if (changes?.regions) redrawPassagesSoon(); });
        redrawGmOverlay("passages");
        rowsOf().whenHydrated().then(() => redrawGmOverlay("passages")).catch(() => {});
        loadTunnelRooms().then(() => redrawGmOverlay("passages")).catch(err => error("Could not read the rooms of the tunnels' ends for the GMs' overlay", err));
        if (!gmStoresQuiet()) settleSecretDoors().catch(err => error("Could not put the secret doors back at the ready", err));
    });
}
