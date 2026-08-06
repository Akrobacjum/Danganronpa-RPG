/**
 * Danganronpa RPG — project UI.
 * ---------------------------------------------------------------------------
 * Countdowns are projects in this game, so the sidebar list gets a heading that
 * says so, and each project gains the two things Daggerheart has no concept of:
 * the room it belongs to, and who is allowed to know it exists.
 */

import { MODULE_ID, PROJECT_SCALE, TRAITS } from "./config.mjs";
import {
    allProjects, setProjectMeta, roomOf, isIndirectMurder, isSecret,
    makeSecret, shareWith, unshareWith, revealProject, viewersOf,
    createProject
} from "./projects.mjs";
import { allRooms } from "./movement.mjs";
import { error } from "./utils.mjs";

const DialogV2 = foundry.applications.api.DialogV2;

export function registerProjectsUi() {
    // The countdown tray is its own ApplicationV2; label it on every render.
    Hooks.on("renderDhCountdowns", onRenderCountdowns);
}

/**
 * The tray is renamed "Projects" through i18n overrides on the system's own
 * keys, not by injecting a heading — an injected one sat outside the tray's
 * own layout and vanished on hover when the tray re-rendered. Only the GM gear
 * is added here, and it is re-added on every render for the same reason.
 */
function onRenderCountdowns(app, element) {
    try {
        if (!game.user.isGM) return;

        const root = element instanceof HTMLElement ? element : element?.[0];
        if (!root || root.querySelector(".drpg-projects-gear")) return;

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
            openProjectManager();
        });

        host.append(gear);
    } catch (err) {
        error("Could not add the project manager button", err);
    }
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
            <td>${foundry.utils.escapeHTML(p.name)}<br><small>${p.current}/${p.start}</small></td>
            <td><select name="room.${p.id}">${roomOptions(p.id)}</select></td>
            <td style="text-align:center">
                <input type="checkbox" name="murder.${p.id}" ${isIndirectMurder(p.id) ? "checked" : ""} />
            </td>
            <td style="text-align:center">
                <input type="checkbox" name="secret.${p.id}" ${secret ? "checked" : ""} />
                ${viewers ? `<br><small>${foundry.utils.escapeHTML(viewers)}</small>` : ""}
            </td>
        </tr>`;
    }).join("");

    const result = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Project.manageTitle") },
        classes: ["drpg-panel", "drpg-projects"],
        content: `<form>
            <p>${game.i18n.localize("DRPG.Project.manageIntro")}</p>
            <table>
                <thead><tr>
                    <th>${game.i18n.localize("DRPG.Project.title")}</th>
                    <th>${game.i18n.localize("DRPG.Project.room")}</th>
                    <th>${game.i18n.localize("DRPG.Project.indirect")}</th>
                    <th>${game.i18n.localize("DRPG.Project.secret")}</th>
                </tr></thead>
                <tbody>${rows}</tbody>
            </table>
            <p class="notes">${game.i18n.localize("DRPG.Project.secretNote")}</p>
        </form>`,
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

    for (const entry of result) {
        await setProjectMeta(entry.id, { room: entry.room || null, indirectMurder: entry.murder });

        // An indirect murder is secret unless the GM says otherwise.
        const shouldBeSecret = entry.secret || (entry.murder && !entry.secretTouched);
        if (shouldBeSecret && !isSecret(entry.id)) {
            await makeSecret(entry.id, viewersOf(entry.id).map(u => u.id));
        } else if (!entry.secret && isSecret(entry.id)) {
            await revealProject(entry.id);
        }
    }

    ui.notifications.info(game.i18n.localize("DRPG.Project.saved"));
}

/**
 * Create a project. The scale picker comes straight from the guide, so the GM
 * chooses "Everyday" rather than remembering that Everyday means 4 progress.
 */
async function openCreateDialog(rooms = allRooms()) {
    const scaleOptions = Object.entries(PROJECT_SCALE)
        .map(([key, s]) => `<option value="${s.progress}"${key === "everyday" ? " selected" : ""}>${s.label} — ${s.progress} progress</option>`)
        .join("");

    const roomOptions = [
        `<option value="">${game.i18n.localize("DRPG.Project.anyRoom")}</option>`,
        ...rooms.map(r => `<option value="${foundry.utils.escapeHTML(r)}">${foundry.utils.escapeHTML(r)}</option>`)
    ].join("");

    const players = game.users.filter(u => !u.isGM);
    const playerOptions = players
        .map(u => `<option value="${u.id}">${foundry.utils.escapeHTML(u.name)}</option>`)
        .join("");

    const result = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Project.createTitle") },
        classes: ["drpg-panel"],
        content: `<form>
            <label>${game.i18n.localize("DRPG.Project.name")}
                <input type="text" name="name" placeholder="${game.i18n.localize("DRPG.Project.namePlaceholder")}" autofocus /></label>
            <label>${game.i18n.localize("DRPG.Project.scale")}
                <select name="target">${scaleOptions}</select></label>
            <label>${game.i18n.localize("DRPG.Project.room")}
                <select name="room">${roomOptions}</select></label>
            <label>${game.i18n.localize("DRPG.Project.trait")}
                <select name="trait">
                    <option value="">${game.i18n.localize("DRPG.Project.anyTrait")}</option>
                    ${Object.entries(TRAITS).map(([k, t]) => `<option value="${k}">${t.label}</option>`).join("")}
                </select></label>
            <label class="drpg-checkbox">
                <input type="checkbox" name="murder" /> ${game.i18n.localize("DRPG.Project.indirect")}</label>
            <label class="drpg-checkbox">
                <input type="checkbox" name="secret" /> ${game.i18n.localize("DRPG.Project.secret")}</label>
            ${players.length ? `<label>${game.i18n.localize("DRPG.Project.visibleTo")}
                <select name="viewer"><option value="">—</option>${playerOptions}</select></label>` : ""}
            <p class="notes">${game.i18n.localize("DRPG.Project.createNote")}</p>
        </form>`,
        buttons: [
            {
                action: "create",
                label: game.i18n.localize("DRPG.Project.createButton"),
                default: true,
                callback: (e, b, d) => {
                    const f = d.element.querySelector("form");
                    return {
                        name: f.name.value.trim(),
                        target: Number(f.target.value) || 4,
                        room: f.room.value || null,
                        trait: f.trait.value || null,
                        murder: f.murder.checked,
                        secret: f.secret.checked,
                        viewer: f.viewer?.value || null
                    };
                }
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Panel.close") }
        ],
        rejectClose: false
    });

    if (!result || result === "cancel") return null;
    if (!result.name) {
        ui.notifications.warn(game.i18n.localize("DRPG.Project.needsName"));
        return null;
    }

    const created = await createProject({
        name: result.name,
        target: result.target,
        room: result.room,
        trait: result.trait,
        indirectMurder: result.murder,
        secret: result.secret || result.murder,
        viewers: result.viewer ? [result.viewer] : []
    });

    if (created) ui.notifications.info(game.i18n.format("DRPG.Project.created", { name: created.name }));
    return created;
}

function readManager(dialog, projects) {
    const form = dialog.element.querySelector("form");
    return projects.map(p => ({
        id: p.id,
        room: form.querySelector(`[name="room.${p.id}"]`)?.value ?? "",
        murder: form.querySelector(`[name="murder.${p.id}"]`)?.checked ?? false,
        secret: form.querySelector(`[name="secret.${p.id}"]`)?.checked ?? false
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
