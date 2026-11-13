/**
 * Danganronpa RPG - what a player saw last (PV, 13.11.2026; the owner's rules #2, #3 and #4).
 * ---------------------------------------------------------------------------
 * "A player learns what their character could know in the fiction, when they could know it." A project's bar ticked on
 * every player's tray the moment anybody worked on it, a sabotage put its "Repair" row on every tray at once, and an
 * erased trace vanished from its finder's map wherever they stood: each told the others where somebody had been.
 *
 * THE RULE. Each player sees a project as it stood when one of their characters was last in its room: refreshed on
 * entry and live while they are there. A GM sees everything live; so does a Spectator, which watches the class's map
 * and stands nowhere; so does everybody for a project with no room. A builder or insider - a secret project's viewer or
 * builder, its finder by Observe, a public project's proposer - knows the project is there wherever they stand, and
 * sees its bar as they last saw it ("?" when this browser has never seen it); a repair row is known only from a visit
 * that saw it, insiders included. A trace this browser showed as found, erased while none of the user's characters
 * stood in its room, stays drawn there as a ghost until one of them does (remnant-ghosts.mjs draws it).
 *
 * WHERE IT LIVES (docs/dev/pv/SPEC.md, "the design call"): a client setting, `SETTINGS.seenProjects`, a section per
 * world and user (`<worldId>/<userId>`), written by this browser alone from what it already holds - the Countdowns,
 * `projectMeta`, its sight copy and the scene's tokens - at a moment one of the user's characters stands in the room.
 * Not a user flag, which every browser holds (the alibi this rule hides), and not a GM store, which would have the
 * primary recompute and send on every move. A bystander's browser does nothing on another player's move: the token
 * hook below returns before it reads anything for a token this user does not own (scenario 86, the PV report).
 *
 * The one GM-side piece is a Secret Passage's "finished" card for its finder: a whisper cannot be held back by the
 * browser that receives it, so the primary holds it (`foundDoneStore`) and posts it at the finder's next entry.
 */

import { MODULE_ID } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { isPrimaryGm, gmIds, esc, announce, error, debug } from "./utils.mjs";
import { allProjects, knowsProject, knowsWithoutRoom, projectScene } from "./projects.mjs";
import { COUNTDOWNS_KEY } from "./projects-secrecy.mjs";
import { roomsStoodInNow } from "./fog.mjs";
import { placeScenes, isMoveChange } from "./rooms.mjs";
import { roomOfToken, whenAtRest } from "./movement.mjs";
import { spectatorUserIds } from "./spectator.mjs";
import { foundDoneStore } from "./gm-stores.mjs";
import { keyOf as remnantKeyOf } from "./remnants.mjs";

/** An empty section: nothing seen yet on this browser. */
export function emptySeen() {
    return { projects: {}, rooms: {}, ghosts: {} };
}

/** Where a room is: `<sceneId>/<room>`. The key of a visit and of a ghost's room. */
export const placeKey = (sceneId, room) => `${sceneId}/${room}`;

/** This browser's section key: the world and the user, so two worlds or two users on one browser never meet. */
export function seenKey(user = game.user) {
    return `${String(game.world?.id ?? "")}/${user?.id ?? ""}`;
}

/** This world's and user's section of the setting (`held` the setting's whole value, the suite's), never null. */
export function seenSection(user = game.user, held = null) {
    let all = held;
    if (!all) {
        try { all = game.settings.get(MODULE_ID, SETTINGS.seenProjects); } catch { all = null; }
    }
    const section = all?.[seenKey(user)];
    if (!section || typeof section !== "object") return emptySeen();
    return { projects: { ...(section.projects ?? {}) }, rooms: { ...(section.rooms ?? {}) }, ghosts: { ...(section.ghosts ?? {}) } };
}

/** Whether this reader sees every project live: a GM, or a Spectator (E92). */
export function seesLive(user = game.user) {
    return Boolean(user?.isGM) || Boolean(user && spectatorUserIds().has(user.id));
}

/** The `<sceneId>/<room>` places `user`'s characters stand in now, on every place scene. */
export function standingNow(user = game.user) {
    const out = new Set();
    if (!user) return out;
    for (const scene of placeScenes()) {
        for (const room of roomsStoodInNow(scene, user)) out.add(placeKey(scene.id, room));
    }
    return out;
}

/** Where a project stands, as a place key; null for one with no room or no scene. */
export function whereOfProject(project) {
    const room = project?.room;
    if (!room) return null;
    const sceneId = projectScene(project.id)?.id ?? null;
    return sceneId ? placeKey(sceneId, room) : null;
}

/** The part of a project kept as seen. */
function seenRow(project) {
    return { current: Number(project.current) || 0, start: Number(project.start) || 0, frozen: Boolean(project.frozen),
        repairs: project.repairs ?? null };
}

const sameRow = (a, b) => Boolean(a && b) && a.current === b.current && a.start === b.start && a.frozen === b.frozen
    && (a.repairs ?? null) === (b.repairs ?? null);
const sameIds = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((id, i) => id === b[i]);

/**
 * THE SNAPSHOT, PURE. For each place in `standing` (the rooms the user's characters stand in now), the projects that
 * stand there and the user may know (`knows`) are written as seen, and the visit's list is replaced by them; a ghost
 * in a place stood in goes; a seen project whose countdown is gone is dropped (only when `projects` holds any: an
 * unreadable Countdowns answers none, and must not wipe what was seen). Answers the new section, or null when nothing
 * changed - so a refresh that changes nothing writes nothing and redraws nothing. `at` is kept from the row it
 * replaces when the row is the same.
 */
export function takeSnapshot({ projects = [], standing = new Set(), held = emptySeen(), knows = () => true,
    whereOf = whereOfProject, now = Date.now() } = {}) {
    const next = { projects: { ...(held?.projects ?? {}) }, rooms: { ...(held?.rooms ?? {}) }, ghosts: { ...(held?.ghosts ?? {}) } };
    let changed = false;
    if (standing.size) {
        const byPlace = new Map();
        for (const project of projects) {
            const where = whereOf(project);
            if (!where || !standing.has(where) || !knows(project)) continue;
            if (!byPlace.has(where)) byPlace.set(where, []);
            byPlace.get(where).push(project);
        }
        for (const where of standing) {
            const here = byPlace.get(where) ?? [];
            const ids = here.map(p => p.id).sort();
            if (!sameIds(next.rooms[where]?.ids, ids)) {
                next.rooms[where] = { at: now, ids };
                changed = true;
            }
            for (const project of here) {
                const row = seenRow(project);
                if (sameRow(next.projects[project.id], row)) continue;
                next.projects[project.id] = { ...row, at: now };
                changed = true;
            }
        }
        for (const [key, ghost] of Object.entries(next.ghosts)) {
            if (!standing.has(placeKey(ghost?.sceneId, ghost?.room))) continue;
            delete next.ghosts[key];
            changed = true;
        }
    }
    if (projects.length) {
        const alive = new Set(projects.map(p => p.id));
        for (const id of Object.keys(next.projects)) {
            if (alive.has(id)) continue;
            delete next.projects[id];
            changed = true;
        }
    }
    return changed ? next : null;
}

/**
 * THE ROW THIS READER SEES FOR ONE PROJECT (`project` a row of `allProjects`). Null when the reader does not know the
 * project is there; the live row (`seen: "live"`) for a GM, a Spectator, a project with no room and a reader with a
 * character in its room now; the snapshot's numbers (`seen: "last"`, with `seenAt`) otherwise; `seen: "unknown"` with
 * the live row's name and nothing of its bar when the reader knows it but this browser holds no snapshot of it.
 *
 * Who knows a project is there, away from its room: a builder or insider (projects.mjs `knowsWithoutRoom`) always; any
 * other reader only when this browser's last visit to the room listed it, or, in a room this browser holds no visit
 * of (another device, or before 1.2.113), by the record (`knowsProject`). A repair is known only from a visit that
 * listed it or a snapshot of it: never by the record alone, since the sabotage that made it happened in a room the
 * reader may not have been in.
 */
export function asSeen(project, { user = game.user, section = null, standing = null, whereOf = whereOfProject,
    knows = id => knowsProject(id, user), insider = id => knowsWithoutRoom(id, user), live = seesLive(user) } = {}) {
    if (!project) return null;
    if (live) return { ...project, seen: "live" };
    if (!knows(project.id)) return null;
    const where = whereOf(project);
    if (!where) return { ...project, seen: "live" };
    const here = standing ?? standingNow(user);
    if (here.has(where)) return { ...project, seen: "live" };

    const held = section ?? seenSection(user);
    const snap = held.projects?.[project.id] ?? null;
    const visit = held.rooms?.[where] ?? null;
    if (project.repairs) {
        if (!snap && !visit?.ids?.includes(project.id)) return null;
    } else if (!insider(project.id) && visit && !visit.ids?.includes(project.id)) {
        return null;
    }
    if (!snap) return { ...project, seen: "unknown", current: null, frozen: false, complete: false };
    const start = Number(snap.start) || 0, current = Number(snap.current) || 0;
    return { ...project, current, start, frozen: Boolean(snap.frozen), complete: start > 0 && current >= start,
        seen: "last", seenAt: snap.at ?? null };
}

/** Every project this reader knows, as they see it (`asSeen`), read once for the whole list. */
export function projectsAsSeen(user = game.user) {
    const live = seesLive(user);
    const section = live ? null : seenSection(user);
    const standing = live ? null : standingNow(user);
    return allProjects().map(p => asSeen(p, { user, section, standing, live })).filter(Boolean);
}

/*
 * A PROJECT'S TOKEN ON THE MAP FOLLOWS THE SAME RULE (visibility.mjs `applyToProjectToken`): a project made, or a repair
 * begun, while none of the reader's characters was in its room is not on their map until one of them is. Read once for
 * a visibility pass: the section, where the user's characters stand and the projects, kept until visibility.mjs
 * forgets its own pass (`forgetSeenPass`, from its `forgetMyRooms`: every whole pass and every own move).
 */
let passCache = null;

/** Drop the pass's reading (visibility.mjs `forgetMyRooms`). */
export function forgetSeenPass() {
    passCache = null;
}

/** Whether this reader's map shows the token of this project, by `asSeen`. True for a GM and a Spectator. */
export function tokenShownAsSeen(projectId, user = game.user) {
    if (seesLive(user)) return true;
    if (!passCache) passCache = { section: seenSection(user), standing: standingNow(user), rows: new Map(allProjects().map(p => [p.id, p])) };
    const row = passCache.rows.get(projectId);
    return Boolean(row && asSeen(row, { user, section: passCache.section, standing: passCache.standing, live: false }));
}

/* ---- this browser's writes ---------------------------------------------- */

/** Write this user's section (the whole setting with it replaced). */
async function writeSection(section, user = game.user) {
    let all = {};
    try { all = { ...(game.settings.get(MODULE_ID, SETTINGS.seenProjects) ?? {}) }; } catch { all = {}; }
    all[seenKey(user)] = section;
    await game.settings.set(MODULE_ID, SETTINGS.seenProjects, all);
}

/**
 * TAKE THIS BROWSER'S SNAPSHOT NOW (a player's browser only; a GM and a Spectator write nothing). Reads where this
 * user's characters stand, the projects as this browser holds them and the section, and writes the section when the
 * snapshot changed it. Answers whether it wrote.
 */
export async function refreshSeen(user = game.user) {
    if (!user || seesLive(user)) return false;
    try {
        const standing = standingNow(user);
        const next = takeSnapshot({ projects: allProjects(), standing, held: seenSection(user),
            knows: p => knowsProject(p.id, user) });
        if (!next) return false;
        await writeSection(next, user);
        return true;
    } catch (err) {
        error("Could not keep what this player last saw of the projects", err);
        return false;
    }
}

/* One refresh at a time: a second asked while one runs runs once after it. */
let running = null, again = false;
function refreshSoon() {
    if (running) { again = true; return running; }
    running = refreshSeen().finally(() => {
        running = null;
        if (again) { again = false; refreshSoon(); }
    });
    return running;
}

/* ---- P3: the ghost of an erased trace ------------------------------------ */

/**
 * THE GHOST OF AN ERASED TRACE, PURE (the owner's rule #4). A Remnant's token being deleted, which this browser showed
 * as found (`shown`, visibility.mjs `shownAsFound`), in a room (`room`) none of the user's characters stands in now
 * (`standing`): answers the row the ghost is drawn from - its scene, room, place, size and picture - or null. A trace
 * erased in front of its finder leaves none: they saw it go.
 */
export function ghostOf(tokenDoc, { shown = false, room = null, standing = new Set(), now = Date.now() } = {}) {
    const sceneId = tokenDoc?.parent?.id ?? null;
    if (!shown || !sceneId || !room) return null;
    if (standing.has(placeKey(sceneId, room))) return null;
    return { sceneId, room, x: Number(tokenDoc.x) || 0, y: Number(tokenDoc.y) || 0,
        width: Number(tokenDoc.width) || 1, height: Number(tokenDoc.height) || 1,
        src: String(tokenDoc.texture?.src ?? ""), at: now };
}

/** On a player's browser, a trace deleted: keep its ghost when `ghostOf` answers one. */
async function keepGhost(tokenDoc, user = game.user) {
    if (!user || seesLive(user)) return false;
    const key = remnantKeyOf(tokenDoc);
    if (!key) return false;
    // By `import()`: visibility.mjs reaches projects-map.mjs, which reads this file (R161).
    const { shownAsFound } = await import("./visibility.mjs");
    const ghost = ghostOf(tokenDoc, { shown: shownAsFound(tokenDoc), room: roomOfToken(tokenDoc), standing: standingNow(user) });
    if (!ghost) return false;
    const section = seenSection(user);
    section.ghosts[key] = ghost;
    await writeSection(section, user);
    return true;
}

/** The ghosts this browser holds on one scene (the drawing's read). */
export function ghostsOn(sceneId, user = game.user) {
    return Object.entries(seenSection(user).ghosts).filter(([, g]) => g?.sceneId === sceneId).map(([key, g]) => ({ key, ...g }));
}

/* ---- P2: a Secret Passage's "finished", held for its finder -------------- */

const foundKey = (userId, countdownId) => `${userId}:${countdownId}`;

/** Whether one of `user`'s characters stands in `room` on the scene `sceneId` now (the scene's own tokens). */
function standsIn(user, sceneId, room) {
    const scene = sceneId ? game.scenes?.get(sceneId) : null;
    return Boolean(scene && room && roomsStoodInNow(scene, user).has(room));
}

/** Whisper the "finished" card to one finder (and the GMs). */
async function postFoundDone(userId, name) {
    await announce({ content: `<p>${game.i18n.format("DRPG.Observe.projectFoundDone", { name: esc(name) })}</p>`,
        whisper: Array.from(new Set([...gmIds(), userId])) });
}

/**
 * AT A SECRET PASSAGE'S COMPLETION, ON THE PRIMARY (projects.mjs `opensPassage`): each finder with a character standing
 * in its room now is told at once; every other finder's card waits in the GMs' `foundDoneStore` for their next entry.
 * Answers `{ told, held }`, the user ids of each.
 */
export async function holdFoundDone(countdownId, name, finders = [], { room = null, sceneId = null } = {}) {
    const told = [], held = [];
    if (!isPrimaryGm()) return { told, held };
    for (const userId of finders) {
        const user = game.users.get(userId);
        if (!user || user.isGM) continue;
        if (standsIn(user, sceneId, room)) {
            await postFoundDone(userId, name);
            told.push(userId);
        } else if (room && sceneId) {
            await foundDoneStore.patch(foundKey(userId, countdownId), { name, room, sceneId, at: Date.now() }, { whole: true });
            held.push(userId);
        } else {
            // No room to come back to: told now, as before.
            await postFoundDone(userId, name);
            told.push(userId);
        }
    }
    return { told, held };
}

/**
 * ON THE PRIMARY, A CHARACTER STANDS IN A ROOM (fog.mjs `reactToMove`, and the primary's ready for every row): each
 * row of the GMs' `foundDoneStore` whose finder owns this character and whose room it stands in is posted and dropped.
 * With no actor, every row whose finder stands in its room now. Answers how many cards it posted.
 */
export async function tellFoundOnEntry(actor = null, sceneId = null, room = null) {
    if (!isPrimaryGm()) return 0;
    let n = 0;
    for (const [key, row] of Object.entries(foundDoneStore.entries() ?? {})) {
        const userId = String(key).split(":")[0];
        const user = game.users.get(userId);
        if (!user || !row?.room || !row?.sceneId) continue;
        const here = actor
            ? row.room === room && row.sceneId === sceneId && actor.testUserPermission?.(user, "OWNER")
            : standsIn(user, row.sceneId, row.room);
        if (!here) continue;
        await postFoundDone(userId, row.name ?? "");
        await foundDoneStore.drop(key);
        n += 1;
    }
    return n;
}

/* ---- the hooks ------------------------------------------------------------ */

/** Called once at init. */
export function registerSeen() {
    /* AN OWN TOKEN MOVED, PLACED OR TAKEN AWAY. The first line returns for a token this user does not own, before
       anything is read: another player's move costs this browser nothing here (scenario 86). */
    Hooks.on("updateToken", (tokenDoc, changes) => {
        if (game.user?.isGM || !tokenDoc?.isOwner || !isMoveChange(changes)) return;
        whenAtRest(tokenDoc).then(() => refreshSoon()).catch(err => debug("Seen: could not read a move at rest", err));
    });
    Hooks.on("createToken", tokenDoc => { if (!game.user?.isGM && tokenDoc?.isOwner) refreshSoon(); });
    Hooks.on("deleteToken", tokenDoc => {
        if (game.user?.isGM || !tokenDoc) return;
        if (tokenDoc.isOwner) { refreshSoon(); return; }
        keepGhost(tokenDoc).catch(err => error("Could not keep an erased trace's ghost", err));
    });
    /* THE PROJECTS CHANGED: live while a character stands in the room, so the snapshot follows - and only then, since
       a browser none of whose characters stands in a room has nothing to take. */
    const settingsHeard = new Set([COUNTDOWNS_KEY, `${MODULE_ID}.${SETTINGS.projectMeta}`]);
    Hooks.on("updateSetting", setting => {
        if (game.user?.isGM || !settingsHeard.has(setting?.key)) return;
        refreshSoon();
    });
    Hooks.on("drpgProjectSightChanged", () => { if (!game.user?.isGM) refreshSoon(); });
    Hooks.on("canvasReady", () => { if (!game.user?.isGM) refreshSoon(); });
    Hooks.once("ready", () => {
        if (!game.user?.isGM) { refreshSoon(); return; }
        foundDoneStore.whenHydrated?.().then(() => tellFoundOnEntry()).catch(err => error("Could not post the held finished cards", err));
    });
    // What this browser shows from the section is drawn again on its change: the tray, and (remnant-ghosts.mjs) the ghosts.
    Hooks.on("drpgSeenChanged", () => { try { globalThis.ui?.countdowns?.render?.(); } catch { /* no tray yet */ } });
}
