/**
 * Danganronpa RPG — projects.
 * ---------------------------------------------------------------------------
 * Projects are Daggerheart Countdowns: a name, a progress bar and a target.
 * What the system does not model is the guide's requirement that a project
 * belongs to a room — "Projects may require specific rooms depending on their
 * kind, intent and required tools" — so that link is kept here, keyed by
 * countdown id.
 *
 * A project can also be flagged as an indirect murder, which changes what
 * rolling on it costs the killer (see INDIRECT_MURDER in config.mjs).
 */

import { MODULE_ID, PROJECT_SCALE } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { log } from "./utils.mjs";

const DH = "daggerheart";
const COUNTDOWNS = "Countdowns";

/** Raw per-project metadata: { [countdownId]: { room, indirectMurder, scale } }. */
export function projectMeta() {
    return game.settings.get(MODULE_ID, SETTINGS.projectMeta) ?? {};
}

/** Metadata for one project. */
export function metaFor(countdownId) {
    return projectMeta()[countdownId] ?? {};
}

/** Which room a project belongs to, if any. */
export function roomOf(countdownId) {
    return metaFor(countdownId).room ?? null;
}

/** Is this project an indirect murder? */
export function isIndirectMurder(countdownId) {
    return Boolean(metaFor(countdownId).indirectMurder);
}

/** Write metadata for a project. GM only. */
export async function setProjectMeta(countdownId, data) {
    if (!game.user.isGM) return null;
    const all = { ...projectMeta(), [countdownId]: { ...metaFor(countdownId), ...data } };
    await game.settings.set(MODULE_ID, SETTINGS.projectMeta, all);
    return all[countdownId];
}

/* ==========================================================================
 * COUNTDOWNS
 * ========================================================================== */

/**
 * Which way "progress" moves a countdown's bar.
 *
 * Daggerheart countdowns count *down*: they are created full and tick towards
 * zero. The guide's projects fill *up* — "add 1 progress" — so the ones this
 * module creates are stored the other way round and marked as such.
 *
 * This mattered more than it looks. Adding progress to a countdown that was
 * already sitting at its start value clamped to no change at all, so a project
 * the GM had made in Daggerheart's own Countdowns window silently swallowed
 * every +1 while still accepting every -2. That is exactly the shape of the
 * Contribution bug: positive Calls did nothing, negative Calls worked.
 *
 * Anything without our marker is treated as Daggerheart's own and counted down.
 */
export function countsUp(countdownId) {
    // Up by default: every project this module has ever created fills upwards,
    // and changing that retroactively would invert every existing bar. A GM who
    // wants a true Daggerheart countdown marks it in the project metadata.
    return metaFor(countdownId).countsUp !== false;
}

/**
 * A project in the module's own terms: `current` is progress *achieved*, always
 * rising towards `target`, whichever way the underlying countdown is stored.
 */
export function allProjects() {
    try {
        const data = game.settings.get(DH, COUNTDOWNS);
        const countdowns = data?.countdowns ?? {};
        return Object.entries(countdowns).map(([id, c]) => {
            const start = c.progress?.start ?? 0;
            const raw = c.progress?.current ?? 0;
            const up = countsUp(id);
            return {
                id,
                name: c.name,
                img: c.img,
                current: up ? raw : Math.max(0, start - raw),
                start,
                raw,
                countsUp: up,
                room: roomOf(id),
                indirectMurder: isIndirectMurder(id),
                trait: metaFor(id).trait ?? null,
                frozen: Boolean(metaFor(id).frozenBy),
                repairs: metaFor(id).repairs ?? null
            };
        });
    } catch {
        return [];
    }
}

/**
 * Projects a character can actually work on right now: those tied to the room
 * they are standing in, plus any project with no room set. Frozen projects are
 * excluded — they need their repair finishing first.
 */
export function projectsAvailableIn(room) {
    return allProjects()
        .filter(p => !p.room || (room && p.room === room))
        .filter(p => !isFrozen(p.id));
}

/** Projects in this room that can be sabotaged: not already frozen. */
export function sabotageTargetsIn(room) {
    return allProjects()
        .filter(p => !p.room || (room && p.room === room))
        .filter(p => !isFrozen(p.id))
        .filter(p => !repairs(p.id));   // repairing a repair makes no sense
}

/** Projects explicitly tied to a room the character is not in. */
export function projectsElsewhere(room) {
    return allProjects().filter(p => p.room && p.room !== room);
}

/**
 * Add progress to a project. Countdowns live in a world setting, so only a GM
 * can write — a player's progress is applied through the GM bridge.
 *
 * `amount` is always in the guide's terms: positive advances the project. How
 * that lands in the stored countdown depends on which way it counts — see
 * `countsUp`.
 *
 * @returns {Promise<object|null>} `{ name, from, to, target, changed }`, or null
 *   when the project does not exist. `changed: false` means the write was a
 *   no-op — the caller must not report success.
 */
export async function addProgress(countdownId, amount) {
    if (!amount) return null;

    if (!game.user.isGM) {
        const { requestProjectProgress } = await import("./gm-bridge.mjs");
        return requestProjectProgress(countdownId, amount);
    }

    const data = game.settings.get(DH, COUNTDOWNS);
    const countdowns = foundry.utils.duplicate(data?.countdowns ?? {});
    const project = countdowns[countdownId];
    if (!project) return null;

    const start = project.progress?.start ?? 0;
    const raw = project.progress?.current ?? 0;
    const up = countsUp(countdownId);

    // Translate "advance the project" into whichever direction this countdown
    // stores, then clamp inside the bar rather than outside the intent.
    const delta = up ? amount : -amount;
    const ceiling = start > 0 ? start : Infinity;
    const nextRaw = Math.max(0, Math.min(ceiling, raw + delta));

    const before = up ? raw : Math.max(0, start - raw);
    const after = up ? nextRaw : Math.max(0, start - nextRaw);

    if (nextRaw === raw) {
        // Nothing moved. Saying so is the whole point: a silent no-op here is
        // indistinguishable from a broken socket, and was misread as one.
        const why = amount > 0 ? "DRPG.Project.alreadyFull" : "DRPG.Project.alreadyEmpty";
        log(`Project "${project.name}" did not move: already ${before}/${start}.`);
        ui.notifications.warn(game.i18n.format(why, { name: project.name, current: before, target: start }));
        return {
            id: countdownId, name: project.name,
            from: before, to: after, target: start, changed: false, reason: why
        };
    }

    countdowns[countdownId] = {
        ...project,
        progress: { ...project.progress, current: nextRaw }
    };

    await game.settings.set(DH, COUNTDOWNS, { ...data, countdowns });
    log(`Project "${project.name}": ${before} -> ${after} of ${start}`);

    // Finishing a repair thaws whatever it was repairing.
    await checkRepairCompletion(countdownId);

    return { id: countdownId, name: project.name, from: before, to: after, target: start, changed: true };
}

/**
 * Create a project. GM only.
 *
 * Progression type is set to `custom` on purpose: that is the mode where a
 * countdown only advances when something explicitly advances it, which is what
 * the Work on Project action does. Any other mode would also tick on attacks
 * or rests and quietly desynchronise from the guide's progress rules.
 *
 * @param {object} data
 * @param {string} data.name
 * @param {number} data.target        Progress needed — 3/4/6/8 per the scale.
 * @param {string} [data.room]        Room the project belongs to.
 * @param {boolean} [data.indirectMurder]
 * @param {boolean} [data.secret]
 * @param {string[]} [data.viewers]   Users who may see it when secret.
 */
export async function createProject({
    name, target = 4, room = null, indirectMurder = false, secret = false,
    viewers = [], trait = null
} = {}) {
    if (!game.user.isGM) return null;
    if (!name) return null;

    const data = game.settings.get(DH, COUNTDOWNS);
    const countdowns = foundry.utils.duplicate(data?.countdowns ?? {});
    const id = foundry.utils.randomID();

    countdowns[id] = {
        type: "narrative",
        name,
        img: "icons/magic/time/hourglass-yellow-green.webp",
        ownership: secret
            ? Object.fromEntries([["default", 0], ...viewers.map(u => [u, 2])])
            : { default: 2 },
        progress: {
            current: 0,
            start: target,
            looping: "noLooping",
            // Only advanced by the Work on Project action.
            type: "custom"
        }
    };

    await game.settings.set(DH, COUNTDOWNS, { ...data, countdowns });
    // `trait` is set by the GM at creation — the guide lets a project demand a
    // specific kind of work, so the player does not get to pick the easy stat.
    // `countsUp` is stamped rather than left to the default so the direction
    // stays explicit in the data, not just in this file's assumptions.
    await setProjectMeta(id, {
        room, indirectMurder, secret: secret || indirectMurder, trait, countsUp: true
    });

    log(`Created project "${name}" (${target} progress)${room ? ` in ${room}` : ""}${trait ? `, ${trait}` : ""}.`);
    return { id, name, target, trait };
}

/* ==========================================================================
 * SABOTAGE AND REPAIR
 * --------------------------------------------------------------------------
 * Guide: sabotage "creates damage requiring a repair project". So a sabotaged
 * project freezes — its progress is preserved but cannot be advanced — and a
 * Repair project appears alongside it. Finishing the repair thaws the original.
 *
 * A frozen project cannot be sabotaged again: there is nothing left to break
 * until it works, and stacking repairs would make one action permanently
 * disable a project.
 * ========================================================================== */

/** Is this project frozen by sabotage? */
export function isFrozen(countdownId) {
    return Boolean(metaFor(countdownId).frozenBy);
}

/** The repair project blocking this one, if any. */
export function repairFor(countdownId) {
    const id = metaFor(countdownId).frozenBy;
    return id ? allProjects().find(p => p.id === id) ?? null : null;
}

/** The project this repair will unfreeze, if any. */
export function repairs(countdownId) {
    return metaFor(countdownId).repairs ?? null;
}

/**
 * Freeze a project and create its repair.
 *
 * @param {string} targetId   The sabotaged project.
 * @param {number} difficulty Progress the repair needs — harder sabotage, harder fix.
 * @returns {Promise<{repair: object, target: string}|null>}
 */
export async function sabotageProject(targetId, difficulty = 3) {
    if (!game.user.isGM) {
        const { requestSabotage } = await import("./gm-bridge.mjs");
        return requestSabotage(targetId, difficulty);
    }

    const target = allProjects().find(p => p.id === targetId);
    if (!target) return null;

    if (isFrozen(targetId)) {
        ui.notifications.warn(game.i18n.format("DRPG.Project.alreadyFrozen", { name: target.name }));
        return null;
    }

    const repair = await createProject({
        name: game.i18n.format("DRPG.Project.repairName", { name: target.name }),
        target: difficulty,
        room: roomOf(targetId),
        indirectMurder: false,
        secret: false
    });
    if (!repair) return null;

    await setProjectMeta(repair.id, { repairs: targetId });
    await setProjectMeta(targetId, { frozenBy: repair.id });

    log(`Project "${target.name}" frozen; repair "${repair.name}" created (${difficulty} progress).`);
    return { repair, target: target.name };
}

/**
 * Called whenever progress lands. If a completed project was a repair, the
 * project it was repairing is unfrozen.
 */
async function checkRepairCompletion(countdownId) {
    const targetId = repairs(countdownId);
    if (!targetId) return null;

    const repair = allProjects().find(p => p.id === countdownId);
    if (!repair || repair.current < repair.start) return null;

    await setProjectMeta(targetId, { frozenBy: null });

    const target = allProjects().find(p => p.id === targetId);
    await ChatMessage.create({
        content: `<p><strong>${foundry.utils.escapeHTML(repair.name)}</strong> — ${
            game.i18n.format("DRPG.Project.repaired", { name: foundry.utils.escapeHTML(target?.name ?? "?") })
        }</p>`
    });

    log(`Repair complete; "${target?.name}" is workable again.`);
    return targetId;
}

/** Delete a project and its metadata. GM only. */
export async function deleteProject(countdownId) {
    if (!game.user.isGM) return null;

    const data = game.settings.get(DH, COUNTDOWNS);
    const countdowns = foundry.utils.duplicate(data?.countdowns ?? {});
    if (!countdowns[countdownId]) return null;
    delete countdowns[countdownId];
    await game.settings.set(DH, COUNTDOWNS, { ...data, countdowns });

    const meta = { ...projectMeta() };
    delete meta[countdownId];
    await game.settings.set(MODULE_ID, SETTINGS.projectMeta, meta);
    return true;
}

/** Human-readable scale label for a progress target. */
export function scaleFor(target) {
    const entry = Object.values(PROJECT_SCALE).find(s => s.progress === target);
    return entry?.label ?? null;
}

/* ==========================================================================
 * SECRECY
 * --------------------------------------------------------------------------
 * An indirect murder project is secret by default and stays that way: a
 * progress bar named "Prepare the poison" sitting in everyone's sidebar would
 * give the whole plot away before it started.
 *
 * Secrecy is enforced through the countdown's own `ownership` map — default
 * NONE, with explicit access for the killer and anyone they (or the GM) later
 * choose to let in. GMs always see everything regardless.
 * ========================================================================== */

const NONE = 0;        // CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE
const OBSERVER = 2;    // CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER

/** Users who can currently see a secret project (excluding GMs). */
export function viewersOf(countdownId) {
    const ownership = rawCountdown(countdownId)?.ownership ?? {};
    return Object.entries(ownership)
        .filter(([, level]) => level >= OBSERVER)
        .map(([userId]) => game.users.get(userId))
        .filter(u => u && !u.isGM);
}

/**
 * Make a project secret, visible only to the given users.
 *
 * @param {string} countdownId
 * @param {string[]} viewerIds  Users allowed to see it — normally just the killer.
 */
export async function makeSecret(countdownId, viewerIds = []) {
    if (!game.user.isGM) return null;

    const ownership = { default: NONE };
    for (const id of viewerIds) ownership[id] = OBSERVER;

    await writeCountdown(countdownId, { ownership });
    await setProjectMeta(countdownId, { secret: true });
    log(`Project ${countdownId} is now secret; ${viewerIds.length} viewer(s).`);
    return ownership;
}

/** Let one more player in on a secret project. */
export async function shareWith(countdownId, userId) {
    if (!game.user.isGM) {
        const { requestProjectShare } = await import("./gm-bridge.mjs");
        return requestProjectShare(countdownId, userId);
    }

    const current = rawCountdown(countdownId)?.ownership ?? {};
    await writeCountdown(countdownId, {
        ownership: { ...current, default: current.default ?? NONE, [userId]: OBSERVER }
    });

    const user = game.users.get(userId);
    log(`Project ${countdownId} shared with ${user?.name ?? userId}.`);
    return true;
}

/** Take a player back off a secret project. */
export async function unshareWith(countdownId, userId) {
    if (!game.user.isGM) return null;

    const current = { ...(rawCountdown(countdownId)?.ownership ?? {}) };
    delete current[userId];
    await writeCountdown(countdownId, { ownership: { ...current, default: NONE } });
    return true;
}

/** Drop secrecy entirely — the plan is out. */
export async function revealProject(countdownId) {
    if (!game.user.isGM) return null;
    await writeCountdown(countdownId, { ownership: { default: OBSERVER } });
    await setProjectMeta(countdownId, { secret: false });
    return true;
}

/** Is this project hidden from the table at large? */
export function isSecret(countdownId) {
    const meta = metaFor(countdownId);
    if (meta.secret !== undefined) return Boolean(meta.secret);
    return (rawCountdown(countdownId)?.ownership?.default ?? OBSERVER) < OBSERVER;
}

/* ---- low-level countdown access ---------------------------------------- */

function rawCountdown(countdownId) {
    try {
        return game.settings.get(DH, COUNTDOWNS)?.countdowns?.[countdownId] ?? null;
    } catch {
        return null;
    }
}

/** Merge fields into one countdown. GM only. */
async function writeCountdown(countdownId, patch) {
    const data = game.settings.get(DH, COUNTDOWNS);
    const countdowns = foundry.utils.duplicate(data?.countdowns ?? {});
    if (!countdowns[countdownId]) return null;

    countdowns[countdownId] = foundry.utils.mergeObject(countdowns[countdownId], patch, { inplace: false });
    await game.settings.set(DH, COUNTDOWNS, { ...data, countdowns });
    return countdowns[countdownId];
}
