/**
 * Danganronpa RPG — project UI.
 * ---------------------------------------------------------------------------
 * Countdowns are projects in this game, so the sidebar list gets a heading that
 * says so, and each project gains the two things Daggerheart has no concept of:
 * the room it belongs to, and who is allowed to know it exists.
 */

import { MODULE_ID, PROJECT_SCALE, TRAITS } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import {
    allProjects, setProjectMeta, roomOf, isIndirectMurder, isSecret,
    makeSecret, shareWith, unshareWith, revealProject, viewersOf,
    createProject, deleteProject, setProjectImage, updateProject
} from "./projects.mjs";
import { allRooms } from "./movement.mjs";
import { dialogContent, error, tableDialog, wirePortraitPickers } from "./utils.mjs";

const DialogV2 = foundry.applications.api.DialogV2;

export function registerProjectsUi() {
    // The countdown tray is its own ApplicationV2; label it on every render.
    Hooks.on("renderDhCountdowns", onRenderCountdowns);
}

/**
 * Redraw the project tray on this client.
 *
 * Daggerheart redraws the tray from its own settings `onChange`, which covers
 * progress. What it does not cover is our metadata — a project's room, its
 * secrecy, whether it is frozen — because that lives in a separate world
 * setting the system knows nothing about. A change to either has to reach every
 * client, so sync.mjs calls this.
 */
export function refreshProjects() {
    try {
        // The global `ui`, not `foundry.ui`.
        //
        // `foundry.ui` is a one-time spread of the ui module's exports taken at
        // load time — a dead snapshot, not the live registry. Daggerheart
        // installs its tray on the global `ui`, so `foundry.ui.countdowns` was
        // always undefined and the optional chaining swallowed it: this function
        // has never refreshed anything on any client.
        globalThis.ui?.countdowns?.render?.();
    } catch {
        // No tray on this client yet; the next render picks the values up.
    }
}

/**
 * The tray is renamed "Projects" through i18n overrides on the system's own
 * keys, not by injecting a heading — an injected one sat outside the tray's
 * own layout and vanished on hover when the tray re-rendered.
 *
 * Three things happen here, all re-applied on every render since the tray
 * rebuilds its header each time:
 *   - our own gear is added, opening the manager below
 *   - Daggerheart's own wrench ("Edit Countdowns") is removed — it opens the
 *     system's native bulk editor, which knows nothing about a project's
 *     room, secrecy or indirect-murder flag and would silently desync our
 *     metadata from whatever it changed. Every edit has to go through the
 *     manager, which is the only thing that keeps both in step.
 *   - the "Short"/"Long" type filter is removed — those toggle Daggerheart's
 *     own "encounter"/"narrative" countdown categories, and `createProject`
 *     (projects.mjs) always makes "narrative" ones. There is only ever one
 *     category in this tray, so a filter for it is a control with nothing to
 *     do — and reads as a mysterious pair of buttons that just narrow what
 *     you can see for no visible reason.
 */
function onRenderCountdowns(app, element) {
    try {
        const root = element instanceof HTMLElement ? element : element?.[0];
        if (!root) return;

        // Shown to everyone, GM or not, so removed for everyone.
        root.querySelector(".header-type-toggles")?.remove();

        localiseRawKeys(root);

        // Folding the tray away is everybody's, not the GM's — a player with
        // four projects on a 1080p screen wants the map back, and the tray sits
        // directly under their own status strip.
        addCollapseControl(root);
        applyCollapsed(root);

        if (!game.user.isGM) return;

        root.querySelector('[data-action="editCountdowns"]')?.remove();

        if (root.querySelector(".drpg-projects-gear")) return;

        const host = root.querySelector(".window-header") ?? root.querySelector("header") ?? root;

        const gear = document.createElement("button");
        gear.type = "button";
        gear.className = "drpg-projects-gear";
        gear.dataset.tooltip = game.i18n.localize("DRPG.Project.manageTooltip");
        gear.setAttribute("aria-label", game.i18n.localize("DRPG.Project.manageTooltip"));
        gear.innerHTML = `<i class="fa-solid fa-gear" inert></i>`;
        gear.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            openProjectManager().catch(err =>
                error("Could not open the project manager", err));
        });

        host.append(gear);
    } catch (err) {
        error("Could not add the project manager button", err);
    }
}

/**
 * Translate labels the system left as raw keys.
 *
 * The tray's own view-mode control announces itself as
 * "DAGGERHEART.UI.Countdowns.toggleIconMode" — the key exists and resolves to
 * "Toggle Icon Only", the system simply does not localise it when it builds
 * the header. A screen reader reads the key aloud, and it surfaces as a
 * tooltip. Reported as B-F5-2.
 *
 * Repaired here because this module already relabels this window on every
 * render, and the tray rebuilds its header from scratch each time — the same
 * reason the gear and the collapse caret are re-added rather than wired once.
 * A value is only touched when it looks like a key AND the key is one the
 * active language actually has, so this can never invent a label of its own.
 */
function localiseRawKeys(root) {
    const KEYLIKE = /^[A-Z][\w.]*\.[\w.]+$/;
    for (const element of root.querySelectorAll("[aria-label], [data-tooltip]")) {
        for (const attribute of ["aria-label", "data-tooltip"]) {
            const value = element.getAttribute(attribute);
            if (!value || !KEYLIKE.test(value) || !game.i18n.has(value)) continue;
            element.setAttribute(attribute, game.i18n.localize(value));
        }
    }
}

/* ==========================================================================
 * FOLDING THE TRAY AWAY
 * --------------------------------------------------------------------------
 * The tray has no collapse of its own. Daggerheart's one header control is
 * `toggleViewMode`, which swaps the rows for a row of icons — a different thing,
 * and it leaves the tray exactly as tall.
 *
 * So: a caret that hides the body and leaves the title bar, remembered per
 * client. Re-applied on every render because the tray rebuilds its header from
 * scratch each time, which is the same reason the gear above is re-added rather
 * than wired once.
 * ========================================================================== */

const COLLAPSED_CLASS = "drpg-projects-collapsed";

function collapsed() {
    try {
        return Boolean(game.settings.get(MODULE_ID, SETTINGS.projectsCollapsed));
    } catch {
        return false;   // too early, or the setting is not registered yet
    }
}

function applyCollapsed(root) {
    const on = collapsed();
    root.classList.toggle(COLLAPSED_CLASS, on);

    const caret = root.querySelector(".drpg-projects-fold i");
    if (caret) caret.className = `fa-solid fa-chevron-${on ? "right" : "down"}`;

    const button = root.querySelector(".drpg-projects-fold");
    if (!button) return;
    const label = game.i18n.localize(on ? "DRPG.Project.expandTray" : "DRPG.Project.collapseTray");
    button.dataset.tooltip = label;
    button.setAttribute("aria-label", label);
    button.setAttribute("aria-expanded", String(!on));
}

function addCollapseControl(root) {
    if (root.querySelector(".drpg-projects-fold")) return;

    const host = root.querySelector(".countdowns-header")
        ?? root.querySelector(".window-header")
        ?? root.querySelector("header");
    if (!host) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "drpg-projects-fold";
    button.innerHTML = `<i class="fa-solid fa-chevron-down" inert></i>`;
    button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        game.settings.set(MODULE_ID, SETTINGS.projectsCollapsed, !collapsed())
            .then(() => applyCollapsed(root))
            .catch(err => error("Could not fold the projects tray", err));
    });

    // First in the header, before the title: a disclosure control belongs on the
    // side you read from, and the gear on the far side is a different kind of
    // thing — one changes what you are looking at, the other opens a window.
    host.prepend(button);
}

/* ==========================================================================
 * MANAGER
 * ========================================================================== */

/**
 * One window for everything: create a project, set its room, mark it as an
 * indirect murder, control who can see it, and share or revoke access. Having
 * creation in one dialog and editing in another meant a new project always
 * needed two trips.
 */
export async function openProjectManager() {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return;
    }

    const projects = allProjects();
    const rooms = allRooms();

    // No projects yet? Go straight to creating one.
    if (!projects.length) {
        const made = await openCreateDialog(rooms);
        return made ? openProjectManager() : undefined;
    }
    const roomOptions = id => [
        `<option value="">${game.i18n.localize("DRPG.Project.anyRoom")}</option>`,
        ...rooms.map(r => `<option value="${foundry.utils.escapeHTML(r)}"${roomOf(id) === r ? " selected" : ""}>${foundry.utils.escapeHTML(r)}</option>`)
    ].join("");

    const rows = projects.map(p => {
        const secret = isSecret(p.id);
        const viewers = viewersOf(p.id).map(u => u.name).join(", ");
        return `<tr data-project="${p.id}">
            <td>
                <img src="${foundry.utils.escapeHTML(p.img ?? "")}" alt="" class="drpg-project-portrait"
                     data-drpg-portrait="${p.id}" data-tooltip="${game.i18n.localize("DRPG.Project.changeImage")}" />
                <input type="hidden" name="img.${p.id}" value="${foundry.utils.escapeHTML(p.img ?? "")}" />
            </td>
            <td>${foundry.utils.escapeHTML(p.name)}<br><small>${p.current}/${p.start}</small></td>
            <td><select name="room.${p.id}">${roomOptions(p.id)}</select></td>
            <td style="text-align:center">
                <input type="checkbox" name="murder.${p.id}" ${isIndirectMurder(p.id) ? "checked" : ""} />
            </td>
            <td style="text-align:center">
                <input type="checkbox" name="secret.${p.id}" ${secret ? "checked" : ""} />
                ${viewers ? `<br><small>${foundry.utils.escapeHTML(viewers)}</small>` : ""}
            </td>
            <td style="text-align:center">
                <button type="button" class="drpg-mini-button" data-drpg-edit="${p.id}"
                        data-tooltip="${game.i18n.localize("DRPG.Project.editTitle")}">
                    <i class="fa-solid fa-pen-to-square" inert></i>
                </button>
            </td>
            <td style="text-align:center">
                <input type="checkbox" name="delete.${p.id}" class="drpg-project-delete" />
            </td>
        </tr>`;
    }).join("");

    const content = dialogContent(`<form>
            <p>${game.i18n.localize("DRPG.Project.manageIntro")}</p>
            <table>
                <thead><tr>
                    <th></th>
                    <th>${game.i18n.localize("DRPG.Project.title")}</th>
                    <th>${game.i18n.localize("DRPG.Project.room")}</th>
                    <th>${game.i18n.localize("DRPG.Project.indirect")}</th>
                    <th>${game.i18n.localize("DRPG.Project.secret")}</th>
                    <th>${game.i18n.localize("DRPG.Project.edit")}</th>
                    <th>${game.i18n.localize("DRPG.Project.delete")}</th>
                </tr></thead>
                <tbody>${rows}</tbody>
            </table>
            <p class="notes">${game.i18n.localize("DRPG.Project.secretNote")}</p>
            <p class="notes">${game.i18n.localize("DRPG.Project.deleteNote")}</p>
        </form>`);

    const result = await tableDialog({
        window: { title: game.i18n.localize("DRPG.Project.manageTitle") },
        classes: ["drpg-panel", "drpg-projects"],
        content,
        buttons: [
            {
                action: "save",
                label: game.i18n.localize("DRPG.Assign.save"),
                default: true,
                callback: (e, b, d) => readManager(d, projects)
            },
            { action: "new", label: game.i18n.localize("DRPG.Project.createButton") },
            { action: "share", label: game.i18n.localize("DRPG.Project.shareButton") },
            { action: "cancel", label: game.i18n.localize("DRPG.Panel.close") }
        ],
        // A FilePicker needs a live click against the dialog's actual DOM —
        // see wirePortraitPickers() for why this cannot be wired any earlier.
        // The per-row edit buttons need the same treatment, and they close the
        // manager first so the two windows never stack.
        render: (event, dialog) => {
            wirePortraitPickers(dialog.element);
            for (const btn of dialog.element.querySelectorAll("[data-drpg-edit]")) {
                btn.addEventListener("click", async ev => {
                    ev.preventDefault();
                    const project = projects.find(p => p.id === btn.dataset.drpgEdit);
                    if (!project) return;
                    await dialog.close();
                    await openProjectDialog({ project, rooms });
                    await openProjectManager();
                });
            }
        },
        rejectClose: false
    });

    if (result === "new") {
        await openCreateDialog(rooms);
        return openProjectManager();
    }
    if (result === "share") {
        await openShareDialog();
        return openProjectManager();
    }
    if (!result || result === "cancel") return;

    let deleted = 0;
    for (const entry of result) {
        if (entry.delete) {
            if (await deleteProject(entry.id)) deleted += 1;
            continue;
        }

        const before = projects.find(p => p.id === entry.id);
        if (entry.img && entry.img !== before?.img) await setProjectImage(entry.id, entry.img);

        // A project that has only just been marked as an indirect murder is
        // sealed with it — that is the default the guide wants, and the box in
        // this row was rendered before the GM ticked "indirect".
        const newlyMurder = entry.murder && !isIndirectMurder(entry.id);
        await setProjectMeta(entry.id, { room: entry.room || null, indirectMurder: entry.murder });

        // After that first moment the checkbox is simply the answer.
        //
        // This used to read `entry.secretTouched`, a field `readManager` has
        // never returned — so it was permanently `undefined`, "is it secret"
        // came out as `secret || murder`, and an indirect murder flipped between
        // sealed and revealed on every other save.
        const shouldBeSecret = entry.secret || newlyMurder;
        if (shouldBeSecret && !isSecret(entry.id)) {
            await makeSecret(entry.id, viewersOf(entry.id).map(u => u.id));
        } else if (!shouldBeSecret && isSecret(entry.id)) {
            await revealProject(entry.id);
        }
    }

    ui.notifications.info(deleted
        ? game.i18n.format("DRPG.Project.savedWithDeletions", { n: deleted })
        : game.i18n.localize("DRPG.Project.saved"));
}

/**
 * Create a project, or edit one — the same form either way.
 *
 * Deliberately one function rather than two that drift apart. The GM asks the
 * same seven questions about a project whether it exists yet or not, and the
 * edit path used to be three checkboxes in the manager table: a name typed
 * wrong, or a scale picked as Everyday when it should have been Complex, could
 * only be fixed by deleting the project and building it again, which threw away
 * every point of progress on it.
 *
 * @param {object} [options]
 * @param {object} [options.project]  Editing this one, from `allProjects()`.
 * @param {object} [options.preset]   Prefill the fields for a project that does
 *   not exist yet — a player's proposal, arriving from the approval card. NOT
 *   the same as `project`: nothing has been created, so this still takes the
 *   create path and the GM can change every answer before it does.
 */
export async function openProjectDialog({ project = null, preset = null, rooms = allRooms() } = {}) {
    const editing = Boolean(project);
    const start = project ?? preset ?? null;
    const defaultImg = "icons/magic/time/hourglass-yellow-green.webp";
    const img = start?.img || defaultImg;
    const currentTarget = start?.start ?? start?.target ?? 4;
    const currentTrait = start?.trait ?? "";
    const currentRoom = start?.room ?? "";

    const scaleOptions = Object.entries(PROJECT_SCALE)
        .map(([key, s]) => {
            const selected = editing ? s.progress === currentTarget : key === "everyday";
            return `<option value="${s.progress}"${selected ? " selected" : ""}>${
                s.label} — ${s.progress} progress</option>`;
        }).join("");

    // An edited project may sit on a target no scale names — a repair inherits
    // whatever the sabotage rolled. Offer it rather than silently re-scaling it.
    const offScale = editing && !Object.values(PROJECT_SCALE).some(s => s.progress === currentTarget)
        ? `<option value="${currentTarget}" selected>${
            game.i18n.format("DRPG.Project.customScale", { n: currentTarget })}</option>`
        : "";

    const roomOptions = [
        `<option value=""${currentRoom ? "" : " selected"}>${
            game.i18n.localize("DRPG.Project.anyRoom")}</option>`,
        ...rooms.map(r => `<option value="${foundry.utils.escapeHTML(r)}"${
            r === currentRoom ? " selected" : ""}>${foundry.utils.escapeHTML(r)}</option>`)
    ].join("");

    const players = game.users.filter(u => !u.isGM);
    const playerOptions = players
        .map(u => `<option value="${u.id}">${foundry.utils.escapeHTML(u.name)}</option>`)
        .join("");

    const traitOptions = [
        `<option value=""${currentTrait ? "" : " selected"}>${
            game.i18n.localize("DRPG.Project.anyTrait")}</option>`,
        ...Object.entries(TRAITS).map(([k, t]) =>
            `<option value="${k}"${k === currentTrait ? " selected" : ""}>${t.label}</option>`)
    ].join("");

    const content = dialogContent(`<form>
            <div class="drpg-project-image-row">
                <img src="${foundry.utils.escapeHTML(img)}" alt="" class="drpg-project-portrait"
                     data-drpg-portrait
                     data-tooltip="${game.i18n.localize("DRPG.Project.changeImage")}" />
                <input type="hidden" name="img" value="${foundry.utils.escapeHTML(img)}" />
                <label>${game.i18n.localize("DRPG.Project.name")}
                    <input type="text" name="name" autofocus
                           value="${foundry.utils.escapeHTML(start?.name ?? "")}"
                           placeholder="${game.i18n.localize("DRPG.Project.namePlaceholder")}" /></label>
            </div>
            <label>${game.i18n.localize("DRPG.Project.scale")}
                <select name="target">${offScale}${scaleOptions}</select></label>
            <label>${game.i18n.localize("DRPG.Project.room")}
                <select name="room">${roomOptions}</select></label>
            <label>${game.i18n.localize("DRPG.Project.trait")}
                <select name="trait">${traitOptions}</select></label>
            <label class="drpg-checkbox">
                <input type="checkbox" name="murder"${
                    start?.indirectMurder ? " checked" : ""} /> ${
                    game.i18n.localize("DRPG.Project.indirect")}</label>
            <label>${game.i18n.localize("DRPG.Project.condition")}
                <input type="text" name="condition"
                       value="${foundry.utils.escapeHTML(start?.condition ?? "")}"
                       placeholder="${game.i18n.localize("DRPG.Project.conditionPlaceholder")}" />
                <small class="notes">${game.i18n.localize("DRPG.Project.conditionNote")}</small></label>
            <label class="drpg-checkbox">
                <input type="checkbox" name="secret"${
                    editing && isSecret(project.id) ? " checked" : ""} /> ${
                    game.i18n.localize("DRPG.Project.secret")}</label>
            ${(!editing && players.length) ? `<label>${game.i18n.localize("DRPG.Project.visibleTo")}
                <select name="viewer"><option value="">—</option>${playerOptions}</select></label>` : ""}
            ${editing ? `<p class="notes">${game.i18n.format("DRPG.Project.editProgressNote", {
                current: project.current, target: project.start
            })}</p>` : ""}
            <p class="notes">${game.i18n.localize("DRPG.Project.createNote")}</p>
        </form>`);

    const buttons = [
        {
            action: "save",
            label: game.i18n.localize(editing ? "DRPG.Assign.save" : "DRPG.Project.createButton"),
            default: true,
            callback: (e, b, d) => {
                const f = d.element.querySelector("form");
                return {
                    name: f.name.value.trim(),
                    target: Number(f.target.value) || 4,
                    room: f.room.value || null,
                    trait: f.trait.value || null,
                    murder: f.murder.checked,
                    condition: f.condition.value.trim(),
                    secret: f.secret.checked,
                    viewer: f.viewer?.value || null,
                    img: f.img.value || null
                };
            }
        }
    ];
    if (editing) buttons.push({ action: "delete", label: game.i18n.localize("DRPG.Project.delete") });
    buttons.push({ action: "cancel", label: game.i18n.localize("DRPG.Panel.close") });

    const result = await DialogV2.wait({
        window: {
            title: game.i18n.localize(editing ? "DRPG.Project.editTitle" : "DRPG.Project.createTitle")
        },
        classes: ["drpg-panel"],
        content,
        buttons,
        // See wirePortraitPickers() — DialogV2 discards `content` and rebuilds
        // it from a string, so the picker has to be wired against the dialog's
        // real element once it exists, not against the div built above.
        render: (event, dialog) => wirePortraitPickers(dialog.element, { defaultImg }),
        rejectClose: false
    });

    if (!result || result === "cancel") return null;

    if (result === "delete") {
        const sure = await DialogV2.confirm({
            classes: ["drpg-panel"],
            window: { title: game.i18n.localize("DRPG.Project.delete") },
            content: `<p>${game.i18n.format("DRPG.Project.deleteConfirm", {
                name: foundry.utils.escapeHTML(project.name)
            })}</p>`,
            rejectClose: false
        });
        if (!sure) return null;
        await deleteProject(project.id);
        ui.notifications.info(game.i18n.format("DRPG.Project.savedWithDeletions", { n: 1 }));
        return { deleted: true };
    }

    if (!result.name) {
        ui.notifications.warn(game.i18n.localize("DRPG.Project.needsName"));
        return null;
    }

    if (editing) {
        await updateProject(project.id, {
            name: result.name,
            target: result.target,
            img: result.img,
            room: result.room,
            trait: result.trait,
            indirectMurder: result.murder,
            condition: result.condition
        });
        await applySecrecy(project.id, result.secret || result.murder);
        ui.notifications.info(game.i18n.localize("DRPG.Project.saved"));
        return { id: project.id, name: result.name };
    }

    const created = await createProject({
        name: result.name,
        target: result.target,
        room: result.room,
        trait: result.trait,
        indirectMurder: result.murder,
        condition: result.condition,
        secret: result.secret || result.murder,
        img: result.img,
        viewers: result.viewer ? [result.viewer] : [],
        // Whose trap it is: the player it was made visible to, when the GM
        // named one. `startProject` fills this in properly for the player's own
        // route — see action-rolls.mjs.
        killerId: result.viewer
            ? game.actors.find(a => a.type === "character"
                && a.testUserPermission(game.users.get(result.viewer), "OWNER"))?.id ?? null
            : null
    });

    if (created) ui.notifications.info(game.i18n.format("DRPG.Project.created", { name: created.name }));
    return created;
}

/** Keep the ownership map in step with one boolean. */
async function applySecrecy(id, wanted) {
    if (wanted && !isSecret(id)) await makeSecret(id, viewersOf(id).map(u => u.id));
    else if (!wanted && isSecret(id)) await revealProject(id);
}

/** Kept as its own name — the manager and the empty state both call it. */
async function openCreateDialog(rooms = allRooms()) {
    return openProjectDialog({ rooms });
}

function readManager(dialog, projects) {
    const form = dialog.element.querySelector("form");
    return projects.map(p => ({
        id: p.id,
        room: form.querySelector(`[name="room.${p.id}"]`)?.value ?? "",
        murder: form.querySelector(`[name="murder.${p.id}"]`)?.checked ?? false,
        secret: form.querySelector(`[name="secret.${p.id}"]`)?.checked ?? false,
        img: form.querySelector(`[name="img.${p.id}"]`)?.value ?? "",
        delete: form.querySelector(`[name="delete.${p.id}"]`)?.checked ?? false
    }));
}

/* ==========================================================================
 * SHARING
 * ========================================================================== */

/**
 * Let a player in on a secret project — a co-conspirator, or the GM handing
 * knowledge to someone who earned it.
 */
export async function openShareDialog(preselectId = null) {
    const projects = allProjects().filter(p => isSecret(p.id));
    if (!projects.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Project.noSecrets"));
        return;
    }

    const players = game.users.filter(u => !u.isGM);
    if (!players.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Project.noPlayers"));
        return;
    }

    const projectOptions = projects
        .map(p => `<option value="${p.id}"${p.id === preselectId ? " selected" : ""}>${foundry.utils.escapeHTML(p.name)}</option>`)
        .join("");
    const playerOptions = players
        .map(u => `<option value="${u.id}">${foundry.utils.escapeHTML(u.name)}</option>`)
        .join("");

    const result = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Project.shareTitle") },
        classes: ["drpg-panel"],
        content: `<form>
            <p>${game.i18n.localize("DRPG.Project.shareIntro")}</p>
            <label>${game.i18n.localize("DRPG.Project.title")}
                <select name="project">${projectOptions}</select></label>
            <label>${game.i18n.localize("DRPG.Project.player")}
                <select name="player">${playerOptions}</select></label>
        </form>`,
        buttons: [
            {
                action: "share", label: game.i18n.localize("DRPG.Project.shareButton"), default: true,
                callback: (e, b, d) => ({
                    project: d.element.querySelector("[name=project]").value,
                    player: d.element.querySelector("[name=player]").value,
                    revoke: false
                })
            },
            {
                action: "revoke", label: game.i18n.localize("DRPG.Project.revokeButton"),
                callback: (e, b, d) => ({
                    project: d.element.querySelector("[name=project]").value,
                    player: d.element.querySelector("[name=player]").value,
                    revoke: true
                })
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Panel.close") }
        ],
        rejectClose: false
    });

    if (!result || result === "cancel") return;

    if (result.revoke) await unshareWith(result.project, result.player);
    else await shareWith(result.project, result.player);

    ui.notifications.info(game.i18n.localize(result.revoke ? "DRPG.Project.revoked" : "DRPG.Project.shared"));
}
