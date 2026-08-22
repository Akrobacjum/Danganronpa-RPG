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
import { announce, log } from "./utils.mjs";

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
    const meta = metaFor(countdownId);

    // An explicit answer always wins. `createProject` stamps `countsUp: true`,
    // so every project this module has ever made is covered by this line and
    // nothing about existing bars changes.
    if (meta.countsUp !== undefined) return Boolean(meta.countsUp);

    // No metadata at all means this countdown is not ours — the GM built it in
    // Daggerheart's own Countdowns window. Treating those as filling upwards was
    // a guess about somebody else's document, and it inverted their bar: a
    // countdown created full and ticking towards zero was reported as 0/8 and
    // silently swallowed every +1 the module tried to add.
    if (!Object.keys(meta).length) return false;

    // Ours, from before `countsUp` was stamped. Those did fill upwards.
    return true;
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
                condition: metaFor(id).condition ?? "",
                killerId: metaFor(id).killerId ?? null,
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
 * May this user know that this project exists at all?
 *
 * GMs see everything. A project that is not secret is public. A secret one is
 * visible only to the people it was shared with — the killer, and whoever they
 * brought in.
 *
 * Every list a player is ever shown has to go through this. `allProjects()`
 * reads the raw world setting and knows nothing about secrecy, so any picker
 * built straight on it was handing the table a list of everyone's plans,
 * indirect murders included.
 */
export function canSee(countdownId, user = game.user) {
    if (user?.isGM) return true;
    if (!isSecret(countdownId)) return true;
    return viewersOf(countdownId).some(u => u.id === user?.id);
}

/** Every project this user is allowed to know about. */
export function visibleProjects(user = game.user) {
    return allProjects().filter(p => canSee(p.id, user));
}

/**
 * Projects a character can actually work on right now: those tied to the room
 * they are standing in, plus any project with no room set. Frozen projects are
 * excluded — they need their repair finishing first.
 */
export function projectsAvailableIn(room, user = game.user) {
    return visibleProjects(user)
        .filter(p => !p.room || (room && p.room === room))
        .filter(p => !isFrozen(p.id));
}

/**
 * Projects in this room that can be sabotaged.
 *
 * A Monokuma is not standing in the players' geography — they walk the map
 * freely and interfere wherever they like — so for a GM the room filter is
 * dropped entirely. It was silently hiding most of the board: a Monokuma whose
 * token happened to be outside every region could only ever see projects with
 * no room set, which is why some projects could be sabotaged and others could
 * not, with no explanation for the difference.
 */
export function sabotageTargetsIn(room, { anyRoom = false, user = game.user } = {}) {
    return visibleProjects(user)
        .filter(p => anyRoom || !p.room || (room && p.room === room))
        .filter(p => !isFrozen(p.id))
        .filter(p => !repairs(p.id));   // repairing a repair makes no sense
}

/**
 * Projects explicitly tied to a room the character is not in.
 *
 * Visibility-filtered like everything else, but note that nothing player-facing
 * should be naming these: knowing that "Prepare the poison" is being run in the
 * Chemistry Lab is the whole mystery. See `DRPG.Project.noneHere`.
 */
export function projectsElsewhere(room, user = game.user) {
    return visibleProjects(user).filter(p => p.room && p.room !== room);
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
    // Finishing a trap arms it, and somebody has to be told.
    if (before < start && after >= start) await announceTrapReady(countdownId, project.name);

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
 * @param {string} [data.img]         Portrait/icon. Defaults to the hourglass.
 */
export async function createProject({
    name, target = 4, room = null, indirectMurder = false, secret = false,
    viewers = [], trait = null, img = "icons/magic/time/hourglass-yellow-green.webp",
    // Whose trap this is, and what sets it off. Both only mean anything on an
    // indirect murder, and both are what the guide asks for in place of a named
    // victim: "you do not name the victim - you name a condition".
    killerId = null, condition = ""
} = {}) {
    if (!game.user.isGM) return null;
    if (!name) return null;

    const data = game.settings.get(DH, COUNTDOWNS);
    const countdowns = foundry.utils.duplicate(data?.countdowns ?? {});
    const id = foundry.utils.randomID();

    // ONE answer to "is this hidden", used for the ownership map AND for the
    // metadata flag.
    //
    // They used to be worked out separately: the ownership from `secret` alone,
    // the flag from `secret || indirectMurder`. So an indirect murder created
    // without an explicit `secret: true` came out marked secret in our data and
    // left at `default: OBSERVER` in Foundry's — the module hid it from every
    // list it draws, and Daggerheart's own Projects tray showed it to the whole
    // table. Measured: a murder project sitting in a player's tray while its
    // own owner could not see it anywhere.
    const hidden = secret || indirectMurder;

    // The killer sees their own trap without anybody remembering to share it.
    //
    // Creating a project and giving somebody sight of it were two independent
    // steps, and skipping the second produced a project the killer could not
    // work on: `projectsAvailableIn` filters on `canSee`, so their own murder
    // was missing from their own Work on Project list.
    const audience = viewers.length
        ? viewers
        : (hidden && killerId ? ownerIdsOf(killerId) : []);

    countdowns[id] = {
        type: "narrative",
        name,
        img: img || "icons/magic/time/hourglass-yellow-green.webp",
        ownership: hidden ? ownershipMap(audience) : { default: OBSERVER },
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
        room, indirectMurder, secret: hidden, trait, countsUp: true,
        killerId: indirectMurder ? killerId : null,
        condition: indirectMurder ? condition : ""
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

    // Repairing something takes the same kind of work as building it, so the
    // repair inherits the original's required trait. Without this the repair had
    // no trait of its own and Work on Project fell through to asking the player
    // to pick one — letting them choose an easier stat than the people whose
    // project they are fixing had to use.
    const repair = await createProject({
        name: game.i18n.format("DRPG.Project.repairName", { name: target.name }),
        target: difficulty,
        room: roomOf(targetId),
        trait: metaFor(targetId).trait ?? null,
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
 * Take a sabotage back: thaw the target and delete the repair it spawned.
 *
 * Used by the Reroll Hope Call, which has to undo the action before applying
 * what the new dice are worth. Both writes are world settings, so a player's
 * request goes through the GM exactly as the sabotage itself did.
 *
 * @param {string|null} targetId  The project that was frozen.
 * @param {string|null} repairId  The repair project that was created.
 */
export async function undoSabotage(targetId = null, repairId = null) {
    if (!targetId && !repairId) return null;

    if (!game.user.isGM) {
        const { requestUndoSabotage } = await import("./gm-bridge.mjs");
        return requestUndoSabotage(targetId, repairId);
    }

    // Thaw first: if the delete below fails the worst case is a stray repair bar,
    // not a project left permanently unworkable.
    if (targetId) await setProjectMeta(targetId, { frozenBy: null });
    if (repairId) await deleteProject(repairId);

    log(`Sabotage undone: "${targetId}" thawed, repair "${repairId}" removed.`);
    return true;
}

/**
 * Called whenever progress lands. A finished repair unfreezes the project it was
 * repairing, and then removes itself.
 *
 * The repair is a means, not a goal: once the thing it was fixing works again
 * there is nothing left to work on, and leaving a completed 6/6 bar sitting in
 * the tray beside the project it unblocked reads as an open job. It also kept
 * the tray growing by one row per sabotage for the rest of the season.
 */
/**
 * A trap has finished building. Say so, and offer to fire it.
 *
 * A repair that completes thaws what it was repairing; a MURDER project that
 * completed did nothing at all — the bar filled, the trap was armed, and the
 * only thing that changed was a number on a widget somebody might be looking
 * at. The GM had to notice.
 *
 * Posted into the killer's own thread rather than whispered to the GMs alone,
 * because that is where the rest of this player's murder already lives and
 * because "your trap is ready" is news they are entitled to. The buttons on it
 * are GM-only and are stripped from a player's copy — see `wireCallActions`.
 *
 * The condition travels with it. The guide's whole definition of an indirect
 * murder is "you do not name the victim, you name a condition", and it is the
 * one thing the GM has to have in front of them when they decide the trap has
 * gone off.
 */
async function announceTrapReady(countdownId, name) {
    if (!isIndirectMurder(countdownId)) return null;

    const meta = metaFor(countdownId);
    const killer = game.actors.get(meta.killerId ?? "")
        ?? game.actors.find(a => a.type === "character" && a.name === meta.by);
    if (!killer) {
        log(`Trap "${name}" is ready, but its owner could not be identified.`);
        return null;
    }

    const { callGm } = await import("./gm-bridge.mjs");
    await callGm(killer, {
        title: game.i18n.localize("DRPG.Project.trapReadyTitle"),
        body: meta.condition
            ? `<strong>${game.i18n.localize("DRPG.Project.trapCondition")}</strong> ${
                foundry.utils.escapeHTML(meta.condition)}`
            : `<em>${game.i18n.localize("DRPG.Project.trapNoCondition")}</em>`,
        request: name,
        actions: [{
            action: "fireTrap",
            label: game.i18n.localize("DRPG.Project.trapFire"),
            data: { killer: killer.id }
        }]
    });

    log(`Trap "${name}" is ready (${killer.name}).`);
    return true;
}

async function checkRepairCompletion(countdownId) {
    const targetId = repairs(countdownId);
    if (!targetId) return null;

    const repair = allProjects().find(p => p.id === countdownId);
    if (!repair || repair.current < repair.start) return null;

    // Unfreeze first. If the delete below were to fail, the worst outcome is a
    // stray finished bar — not a project left permanently unworkable.
    await setProjectMeta(targetId, { frozenBy: null });

    const target = allProjects().find(p => p.id === targetId);
    const repairName = repair.name;

    await announce({
        content: `<p><strong>${foundry.utils.escapeHTML(repairName)}</strong> — ${
            game.i18n.format("DRPG.Project.repaired", { name: foundry.utils.escapeHTML(target?.name ?? "?") })
        }</p>`
    });

    // Read the name and announce before deleting: `deleteProject` takes the
    // countdown and its metadata with it, so nothing can be looked up afterwards.
    await deleteProject(countdownId);

    log(`Repair "${repairName}" complete and removed; "${target?.name}" is workable again.`);
    return targetId;
}

/** Change a project's portrait/icon. GM only. */
export async function setProjectImage(countdownId, img) {
    if (!game.user.isGM || !img) return null;
    return writeCountdown(countdownId, { img });
}

/**
 * Edit a project in place: name, target, portrait, room, trait, murder flag.
 *
 * The manager could only ever change the three things it had columns for, so
 * a typo in a name or a scale picked wrong meant deleting the project and
 * rebuilding it — which throws the progress away with it. This keeps the
 * countdown and its id, so everything pointing at it (a repair, a Key Remnant
 * plan, a Reroll bookmark) still points at it afterwards.
 *
 * `target` is the countdown's `progress.start`. Raising it is safe; lowering it
 * below what has already been earned would leave the bar past its own end, so
 * current progress is clamped down with it.
 *
 * @param {string} countdownId
 * @param {object} patch  Any of { name, target, img, room, trait, indirectMurder }
 */
export async function updateProject(countdownId, patch = {}) {
    if (!game.user.isGM) return null;

    const raw = rawCountdown(countdownId);
    if (!raw) return null;

    const countdownPatch = {};
    if (patch.name !== undefined && patch.name !== null) countdownPatch.name = String(patch.name);
    if (patch.img) countdownPatch.img = patch.img;

    if (patch.target !== undefined && patch.target !== null) {
        const target = Math.max(1, Math.trunc(Number(patch.target) || 1));
        const up = countsUp(countdownId);
        const current = raw.progress?.current ?? 0;
        countdownPatch.progress = {
            ...raw.progress,
            start: target,
            // Ours count up, so `current` is progress earned and is clamped to
            // the new ceiling. Daggerheart's count down, where `current` is what
            // is LEFT — that cannot exceed the start either.
            current: up ? Math.min(current, target) : Math.min(current, target)
        };
    }

    if (Object.keys(countdownPatch).length) {
        await writeCountdown(countdownId, countdownPatch,
            { replace: countdownPatch.progress ? ["progress"] : [] });
    }

    const meta = {};
    if (patch.room !== undefined) meta.room = patch.room || null;
    if (patch.trait !== undefined) meta.trait = patch.trait || null;
    if (patch.indirectMurder !== undefined) meta.indirectMurder = Boolean(patch.indirectMurder);
    if (patch.condition !== undefined) meta.condition = String(patch.condition ?? "");
    if (patch.killerId !== undefined) meta.killerId = patch.killerId || null;
    if (Object.keys(meta).length) await setProjectMeta(countdownId, meta);

    log(`Project ${countdownId} updated: ${Object.keys({ ...countdownPatch, ...meta }).join(", ")}`);
    return allProjects().find(p => p.id === countdownId) ?? null;
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

/**
 * Build a countdown ownership map that Daggerheart will actually honour.
 *
 * A `default: 0` entry does nothing. Daggerheart's `DhCountdown#getUserLevel`
 * looks up `ownership[user.id]`, and when that is missing it falls back to the
 * Countdowns setting's world-level `defaultOwnership` — which ships as OBSERVER.
 * The per-countdown `default` key is never consulted at all.
 *
 * So every "secret" project was visible to the whole table, indirect murders
 * included. Secrecy has to be spelled out per user: an explicit NONE for every
 * player who is not a viewer.
 */
/** The non-GM users who own this actor — whose eyes "the killer" means. */
function ownerIdsOf(actorId) {
    const actor = game.actors.get(actorId ?? "");
    if (!actor) return [];
    return game.users
        .filter(u => !u.isGM && actor.testUserPermission(u, "OWNER"))
        .map(u => u.id);
}

function ownershipMap(viewerIds = []) {
    const viewers = new Set(viewerIds.filter(Boolean));
    const map = { default: NONE };          // kept for our own isSecret() read
    for (const user of game.users) {
        if (user.isGM) continue;            // GMs are owners unconditionally
        map[user.id] = viewers.has(user.id) ? OBSERVER : NONE;
    }
    return map;
}

/** Users who can currently see a secret project (excluding GMs). */
export function viewersOf(countdownId) {
    const ownership = rawCountdown(countdownId)?.ownership ?? {};
    return Object.entries(ownership)
        .filter(([key, level]) => key !== "default" && level >= OBSERVER)
        .map(([userId]) => game.users.get(userId))
        .filter(u => u && !u.isGM);
}

/**
 * Re-apply secrecy to every project that claims to be secret.
 *
 * Runs once per session on the GM client. Projects created before the ownership
 * bug was understood carry a `default: 0` that Daggerheart ignores, so they are
 * still on show; this rewrites them properly. It only ever removes access, so
 * running it repeatedly is harmless.
 */
export async function resealSecretProjects() {
    if (!game.user.isGM) return 0;

    let fixed = 0;
    for (const project of allProjects()) {
        if (!isSecret(project.id)) continue;

        const current = rawCountdown(project.id)?.ownership ?? {};
        const viewers = Object.entries(current)
            .filter(([key, level]) => key !== "default" && level >= OBSERVER)
            .map(([userId]) => userId);

        const wanted = ownershipMap(viewers);
        if (foundry.utils.objectsEqual?.(current, wanted)) continue;

        await writeCountdown(project.id, { ownership: wanted }, { replace: ["ownership"] });
        fixed += 1;
    }

    if (fixed) log(`Re-sealed ${fixed} secret project(s) that were visible to players.`);
    return fixed;
}

/**
 * Make a project secret, visible only to the given users.
 *
 * @param {string} countdownId
 * @param {string[]} viewerIds  Users allowed to see it — normally just the killer.
 */
export async function makeSecret(countdownId, viewerIds = []) {
    if (!game.user.isGM) return null;

    const ownership = ownershipMap(viewerIds);

    await writeCountdown(countdownId, { ownership }, { replace: ["ownership"] });
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
    const viewers = Object.entries(current)
        .filter(([key, level]) => key !== "default" && level >= OBSERVER)
        .map(([id]) => id);
    await writeCountdown(countdownId, { ownership: ownershipMap([...viewers, userId]) }, { replace: ["ownership"] });

    const user = game.users.get(userId);
    log(`Project ${countdownId} shared with ${user?.name ?? userId}.`);
    return true;
}

/** Take a player back off a secret project. */
export async function unshareWith(countdownId, userId) {
    if (!game.user.isGM) return null;

    const current = rawCountdown(countdownId)?.ownership ?? {};
    const viewers = Object.entries(current)
        .filter(([key, level]) => key !== "default" && level >= OBSERVER && key !== userId)
        .map(([id]) => id);
    await writeCountdown(countdownId, { ownership: ownershipMap(viewers) }, { replace: ["ownership"] });
    return true;
}

/**
 * Drop secrecy entirely — the plan is out.
 *
 * The ownership map is *replaced*, not merged. `writeCountdown` uses
 * `mergeObject`, so writing `{ default: OBSERVER }` left every explicit
 * `{ playerId: NONE }` from `ownershipMap` exactly where it was — and since
 * Daggerheart reads `ownership[user.id]` and ignores `default`, revealing a
 * project changed nothing for the players it had been hidden from.
 */
export async function revealProject(countdownId) {
    if (!game.user.isGM) return null;

    const cleared = { default: OBSERVER };
    for (const user of game.users) {
        if (user.isGM) continue;
        cleared[user.id] = OBSERVER;
    }

    await writeCountdown(countdownId, { ownership: cleared }, { replace: ["ownership"] });
    await setProjectMeta(countdownId, { secret: false });
    log(`Project ${countdownId} revealed to everyone.`);
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

/**
 * Merge fields into one countdown. GM only.
 *
 * `replace` names top-level keys that must be overwritten wholesale rather than
 * merged. An ownership map is the obvious case: merging can only ever *add*
 * entries, so a stale `{ playerId: NONE }` survives every attempt to grant
 * access and the write silently does the opposite of what it says.
 */
async function writeCountdown(countdownId, patch, { replace = [] } = {}) {
    const data = game.settings.get(DH, COUNTDOWNS);
    const countdowns = foundry.utils.duplicate(data?.countdowns ?? {});
    if (!countdowns[countdownId]) return null;

    const merged = foundry.utils.mergeObject(countdowns[countdownId], patch, { inplace: false });
    for (const key of replace) {
        if (key in patch) merged[key] = patch[key];
    }

    countdowns[countdownId] = merged;
    await game.settings.set(DH, COUNTDOWNS, { ...data, countdowns });
    return merged;
}
