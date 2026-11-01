/**
 * Danganronpa RPG - project UI.
 * ---------------------------------------------------------------------------
 * Countdowns are projects in this game, so the sidebar list gets a heading that
 * says so, and each project gains the two things Daggerheart has no concept of:
 * the room it belongs to, and who is allowed to know it exists.
 *
 * THE FACADE (E34, 1.2.70). The tray's drawing moved to projects-tray.mjs by a
 * pure move that `node tools/moved-only.mjs` proves. This file keeps its name and
 * every name it exported - `refreshProjects` and `hideUndiscovered` are
 * re-exported under the imports - so every importer still imports
 * projects-ui.mjs, and the new file does not import it. What stays is the render
 * hook (`onRenderCountdowns`, which opens the manager), the GM's gear, the
 * manager, the project dialog and sharing; new code of those goes here, and
 * what the tray draws on every render into projects-tray.mjs.
 */

import { PROJECT_SCALE, PROJECT_GLYPHS, isProjectGlyph, TRAITS, TRAP_TRIGGERS, TRAP_MODIFIERS } from "./config.mjs";
import {
    allProjects, metaFor, roomOf, isIndirectMurder, isSecret, shareWith, unshareWith,
    viewersOf, secretsOf, createProject, deleteProject,
    applyProjectChange, combineChanges, projectEditChange, sightChange, projectMeta, addProgress, projectLabel
} from "./projects.mjs";
import { placeRoomNames } from "./rooms.mjs";
import { dialogContent, error, markFired, markLanguage, tableDialog, wirePortraitPickers } from "./utils.mjs";
import { alreadyOpen, keepFresh } from "./live.mjs";
import {
    leaveIconOnly, localiseRawKeys, hideUndiscovered, showTrayToPlayer, paintProgress, applyCollapsed, addCollapseControl
} from "./projects-tray.mjs";
export { refreshProjects, hideUndiscovered } from "./projects-tray.mjs";

const DialogV2 = foundry.applications.api.DialogV2;

export function registerProjectsUi() {
    // The countdown tray is its own ApplicationV2; label it on every render.
    Hooks.on("renderDhCountdowns", onRenderCountdowns);
    // Its row menu, before the tray's first render builds it (E36 C2), and once more at ready for a class set late.
    wrapCountdownMenu();
    Hooks.once("ready", wrapCountdownMenu);
}

/**
 * The tray is renamed "Projects" through i18n overrides on the system's own
 * keys, not by injecting a heading - an injected one sat outside the tray's
 * own layout and vanished on hover when the tray re-rendered.
 *
 * Three things happen here, all re-applied on every render since the tray
 * rebuilds its header each time:
 *   - our own gear is added, opening the manager below
 *   - Daggerheart's own wrench ("Edit Countdowns") is removed - it opens the
 *     system's native bulk editor, which knows nothing about a project's
 *     room, secrecy or indirect-murder flag and would silently desync our
 *     metadata from whatever it changed. Every edit has to go through the
 *     manager, which is the only thing that keeps both in step.
 *   - the "Short"/"Long" type filter is removed - those toggle Daggerheart's
 *     own "encounter"/"narrative" countdown categories, and `createProject`
 *     (projects.mjs) always makes "narrative" ones. There is only ever one
 *     category in this tray, so a filter for it is a control with nothing to
 *     do - and reads as a mysterious pair of buttons that just narrow what
 *     you can see for no visible reason.
 *   - "Toggle Icon Only" is removed, and anyone already in that view is taken
 *     out of it - see `leaveIconOnly`. It strips the name and the progress off
 *     every row, and a project is its name: what is left is four identical
 *     hourglasses in a tray whose entire job is telling them apart. The caret
 *     below is the control for wanting the space back.
 */
function onRenderCountdowns(app, element) {
    markFired("renderDhCountdowns");
    try {
        const root = element instanceof HTMLElement ? element : element?.[0];
        if (!root) return;

        // Shown to everyone, GM or not, so removed for everyone.
        root.querySelector(".header-type-toggles")?.remove();
        root.querySelector('[data-action="toggleViewMode"]')?.remove();
        leaveIconOnly(app, root);

        localiseRawKeys(root);
        hideUndiscovered(root);
        // after the rows the player has not found are gone: they count as none (E79 C12, U1)
        showTrayToPlayer(root);
        paintProgress(root);

        // Folding the tray away is everybody's, not the GM's - a player with
        // four projects on a 1080p screen wants the map back, and the tray sits
        // directly under their own status strip.
        addCollapseControl(root);
        applyCollapsed(root);

        if (!game.user.isGM) return;

        root.querySelector('[data-action="editCountdowns"]')?.remove();
        guardTrayRows(root);

        if (root.querySelector(".drpg-projects-gear")) return;

        const host = root.querySelector(".window-header") ?? root.querySelector("header") ?? root;

        const gear = document.createElement("button");
        gear.type = "button";
        gear.className = "drpg-projects-gear";
        gear.dataset.tooltip = game.i18n.localize("DRPG.Project.manageTooltip");
        gear.setAttribute("aria-label", game.i18n.localize("DRPG.Project.manageTooltip"));
        gear.innerHTML = `<i class="fa-solid fa-gear" inert></i>`;
        // The module's words in Daggerheart's header, whose own are in Foundry's language (E66 fix r2; R1153).
        markLanguage(gear);
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

/* ==========================================================================
 * THE TRAY'S OWN CONTROLS ON A PROJECT ROW (E36 C2)
 * --------------------------------------------------------------------------
 * 25.10.2026; audit S17-18, S09-36. Daggerheart 2.10.5's tray writes the
 * Countdowns setting itself: its -/+ (`editCountdown`, read from the row's
 * `data-countdown`) and its menu's Delete (`countdown.delete()`) whole, outside
 * the module's queue, and its Reveal and Hide (`toggleVisibility`) flip a
 * `hidden` the module's secrecy does not read. On a GM's tray a project row's
 * -/+ is one change of the entry, by addProgress, and its Delete is
 * deleteProject; Reveal and Hide are not offered on it - who sees a project is
 * the manager's Secret and Share. A row that is no project (no projectMeta row,
 * as relay-guard.mjs's `isProject` reads it) keeps the system's controls. A
 * player's click still goes the system's way, to the GM's relay, which lands
 * nothing on a project (relay-guard.mjs `judgeCountdowns`). Read in 2.10.5's
 * source, not on v14 at a table (LIVE-E36-02, AUDIT 9.2 item 300).
 * ========================================================================== */

/** Is this tray row's countdown one of the module's projects? */
function isProjectRow(countdownId) {
    return Boolean(countdownId) && Object.hasOwn(projectMeta(), countdownId);
}

const guardedTrays = new WeakSet();

/**
 * The -/+ of a project row, caught before the system's action handler (a listener in the capture phase, once
 * per root: the tray keeps its element across renders), stopped there, and made one change of 1 or -1 by "gm"
 * through addProgress, which says why when nothing moved (full, empty, frozen). Exported for the suite, which
 * plants a root; the render hook is its one caller. Answers whether it wired this root now.
 */
export function guardTrayRows(root) {
    if (!game.user?.isGM || !root?.addEventListener || guardedTrays.has(root)) return false;
    guardedTrays.add(root);
    root.addEventListener("click", event => {
        const button = event.target?.closest?.('[data-action="increaseCountdown"], [data-action="decreaseCountdown"]');
        if (!button || !root.contains(button)) return;
        const id = button.closest("[data-countdown]")?.dataset.countdown ?? null;
        if (!isProjectRow(id)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        addProgress(id, button.dataset.action === "increaseCountdown" ? 1 : -1)
            .catch(err => error("Could not change the project from the tray", err));
    }, { capture: true });
    return true;
}

/* Registered (`Symbol.for`), so the contract register's probe (patches.mjs, "countdown-row-menu") can read the mark. */
const MENU_DONE = Symbol.for("drpgProjectRowMenu");

/**
 * The tray's row menu, entries in 2.10.5's shape (`label`, `visible`, `onClick(event, target)`; v13's `name`,
 * `condition`, `callback(target)` read as well), changed in place: Reveal and Hide hidden on a project row,
 * Delete on one deleteProject. Every other row and entry is the system's. Exported for the suite.
 */
export function projectRowMenu(entries) {
    if (!Array.isArray(entries)) return entries;
    const projectOf = element => {
        const id = element?.closest?.("[data-countdown]")?.dataset.countdown ?? null;
        return isProjectRow(id) ? id : null;
    };
    for (const entry of entries) {
        if (!entry || entry[MENU_DONE]) continue;
        const label = String(entry.label ?? entry.name ?? "");
        const showKey = "visible" in entry || !("condition" in entry) ? "visible" : "condition";
        const clickKey = "onClick" in entry || !("callback" in entry) ? "onClick" : "callback";
        const show = entry[showKey];
        const click = entry[clickKey];
        if (/\.Countdowns\.(?:reveal|hide)$/.test(label)) {
            entry[showKey] = element => !projectOf(element) && (typeof show === "function" ? show(element) : show ?? true);
        } else if (label === "CONTROLS.CommonDelete") {
            entry[clickKey] = (event, target) => {
                const element = target ?? (event instanceof HTMLElement ? event : null);
                const id = projectOf(element);
                if (id) return deleteProject(id);
                return typeof click === "function" ? click(event, target) : undefined;
            };
        }
        entry[MENU_DONE] = true;
    }
    return entries;
}

/** The tray class's menu builder, wrapped once: at init when the system has set its class, else at ready. */
function wrapCountdownMenu() {
    const Tray = game.system?.api?.applications?.ui?.DhCountdowns ?? CONFIG.ui?.countdowns ?? null;
    const proto = typeof Tray === "function" ? Tray.prototype : null;
    const own = proto?._getCountdownContextOptions;
    if (typeof own !== "function" || own[MENU_DONE]) return false;
    const wrapped = function (...args) {
        return projectRowMenu(own.apply(this, args));
    };
    wrapped[MENU_DONE] = true;
    proto._getCountdownContextOptions = wrapped;
    return true;
}

/* ==========================================================================
 * MANAGER
 * ========================================================================== */

/**
 * The name a screen reader gives a control in one project's row: its column and
 * the project. Visually the column header names every control under it; a reader
 * walking the table hears only the control, so it has to carry both (21.09).
 */
function rowName(columnKey, project) {
    return foundry.utils.escapeHTML(`${game.i18n.localize(columnKey)}: ${project.name}`);
}

/**
 * A project's room select: "any room", every room of every place scene, and the project's own
 * room kept and chosen when no place scene has it (E12 C5, 1.2.74; audit S09-03). The list was
 * the scene on the GM's screen, so a project whose room was elsewhere had no option for it, the
 * select fell back to "any room" and Save wrote that back: the manager saved with the camera on
 * the Annex took the Gym's project's room away (scenario 66 A1 at 180df61, 11.10.2026).
 */
function roomSelectOptions(rooms, current) {
    const esc = foundry.utils.escapeHTML;
    const kept = current && !rooms.includes(current)
        ? [`<option value="${esc(current)}" selected>${esc(game.i18n.format("DRPG.Project.roomElsewhere", { room: current }))}</option>`]
        : [];
    return [
        `<option value=""${current ? "" : " selected"}>${game.i18n.localize("DRPG.Project.anyRoom")}</option>`,
        ...rooms.map(r => `<option value="${esc(r)}"${r === current ? " selected" : ""}>${esc(r)}</option>`),
        ...kept
    ].join("");
}

/** One editable row per project: portrait, name and progress, room, the two flags, edit, delete. */
function projectManagerRows(projects, rooms, { always = new Set() } = {}) {
    const roomOptions = id => roomSelectOptions(rooms, roomOf(id) ?? "");

    const players = playerList();
    return projects.map(p => {
        const secret = isSecret(p.id);
        const knows = knownBy(p.id);
        return `<tr data-project="${p.id}">
            <td>
                <img src="${foundry.utils.escapeHTML(p.img ?? "")}" alt="" class="drpg-project-portrait"
                     data-drpg-portrait="${p.id}" data-tooltip="${game.i18n.localize("DRPG.Project.changeImage")}" />
                <input type="hidden" name="img.${p.id}" value="${foundry.utils.escapeHTML(p.img ?? "")}" />
            </td>
            <td>${foundry.utils.escapeHTML(p.name)}<br><small data-drpg-progress="${p.id}"
                >${projectLabel(p, { name: false })}</small></td>
            <td><select name="room.${p.id}" aria-label="${rowName("DRPG.Project.room", p)}">${
                roomOptions(p.id)}</select></td>
            <td style="text-align:center">
                <input type="checkbox" name="murder.${p.id}" aria-label="${rowName("DRPG.Project.indirect", p)}"
                       ${isIndirectMurder(p.id) ? "checked" : ""} />
            </td>
            <td style="text-align:center">
                <input type="checkbox" name="secret.${p.id}" aria-label="${rowName("DRPG.Project.secret", p)}"
                       ${secret ? "checked" : ""}${always.has(p.id) ? " disabled" : ""} />
            </td>
            ${players.length
                ? viewerTicks(players, knows, p, { locked: !secret })
                : `<td><small class="notes">${game.i18n.localize("DRPG.Project.noPlayers")}</small></td>`}
            <td style="text-align:center">
                <button type="button" class="drpg-mini-button" data-drpg-edit="${p.id}"
                        data-tooltip="${game.i18n.localize("DRPG.Project.editTitle")}">
                    <i class="fa-solid fa-pen-to-square" inert></i>
                </button>
                ${metaFor(p.id).mapHidden ? `<button type="button" class="drpg-mini-button" data-drpg-show-on-map="${p.id}"
                        aria-label="${rowName("DRPG.Project.showOnMap", p)}"
                        data-tooltip="${game.i18n.localize("DRPG.Project.showOnMap")}">
                    <i class="fa-solid fa-map-location-dot" inert></i>
                </button>` : ""}
            </td>
            <td style="text-align:center">
                <input type="checkbox" name="delete.${p.id}" class="drpg-project-delete"
                       aria-label="${rowName("DRPG.Project.delete", p)}" />
            </td>
        </tr>`;
    }).join("");
}

/** The portraits, the live progress figures, and the per-row edit buttons. */
function wireProjectManager(dialog, projects, rooms) {
    wirePortraitPickers(dialog.element);

    /* PROGRESS MOVES WHILE THIS WINDOW IS OPEN, AND THAT IS WHAT IT IS FOR.

       A player spends an action on a project and the number in here changes -
       from their client, so nothing tells this window about it. It is the screen
       a GM has up for most of a Daily Life (see the panel's note on the tile),
       which is exactly the stretch when the figures move. Measured on 11.09 with
       the manager open: a project went 0/4 to 1/4 and the cell still read 0/4.

       Only the figures, written in place: every other cell here is a control the
       GM is editing and Apply is what saves them, so swapping the table out would
       discard half-finished work and unwire the row buttons below. A project
       being CREATED or deleted elsewhere still needs the window reopening; that
       is a rarer event and a louder one. */
    keepFresh(dialog, {
        run: root => {
            for (const project of allProjects()) {
                const cell = root.querySelector(
                    `[data-drpg-progress="${CSS.escape(project.id)}"]`);
                if (!cell) continue;
                const text = projectLabel(project, { name: false });
                if (cell.textContent !== text) cell.textContent = text;
            }
        },
        watch: { settingKeys: ["daggerheart.Countdowns"] }
    });

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

    /* A PROJECT A GM DELETED FROM THE MAP COMES BACK FROM HERE (E11 C8; S09-47). Its token stays
       gone through every scene draw (projects-map.mjs `onProjectTokenDeleted`), so the way back
       is a GM's choice, in the window that holds every other choice about a project. In place,
       as the figures above are: reopening the window would drop what the GM has ticked. */
    for (const btn of dialog.element.querySelectorAll("[data-drpg-show-on-map]")) {
        btn.addEventListener("click", async ev => {
            ev.preventDefault();
            const { showProjectOnMap } = await import("./projects-map.mjs");
            await showProjectOnMap(btn.dataset.drpgShowOnMap);
            btn.remove();
        });
    }
}

/** Write every row back: deletions first, then image, room, the murder flag and secrecy. Answers how many were deleted. */
async function applyProjectManager(result, projects) {
    let deleted = 0;
    // A sabotage pair goes together (F5), so a row can be gone by the time the
    // loop reaches it. Asked of the world, not of the list the window opened with:
    // writing metadata for a project deleted two rows up leaves an orphan row, and
    // a second Delete on it would not be counted.
    const exists = id => allProjects().some(p => p.id === id);
    for (const entry of result) {
        if (entry.delete) {
            if (!exists(entry.id)) { deleted += 1; continue; }
            if (await deleteProject(entry.id)) deleted += 1;
            continue;
        }
        if (!exists(entry.id)) continue;

        const before = projects.find(p => p.id === entry.id);
        const img = entry.img && entry.img !== before?.img ? { img: entry.img } : null;
        /* THE ROOM ONLY WHEN THIS ROW CHANGED IT (E12 C5, 1.2.74; audit S09-03). Every row's room was
           written back on every Save, so a room the project gained while the window was open - its
           token dragged into another room (`onProjectTokenMoved`), another GM's edit - was put back
           to the one the window had read. Compared with the room the window opened with. */
        const room = (entry.room || null) !== (before?.room ?? null) ? { room: entry.room || null } : null;

        // A project that has only just been marked as an indirect murder is
        // sealed with it - that is the default the guide wants, and the box in
        // this row was rendered before the GM ticked "indirect".
        const newlyMurder = entry.murder && !isIndirectMurder(entry.id);
        // A tick with nobody behind it arms nothing (ITEM-14): the row's
        // "Indirect" box is refused, with a reason, until the project has a
        // killer - the edit dialog is where one is named.
        if (newlyMurder) {
            const meta = secretsOf(entry.id);
            if (!meta.killerId && !meta.by) {
                ui.notifications.warn(game.i18n.format("DRPG.Project.needsKillerNamed", { name: before?.name ?? "?" }));
                const kept = combineChanges(img, room ? { meta: room } : null);
                if (kept) await applyProjectChange(entry.id, kept, { by: { kind: "gm" } });
                continue;
            }
        }
        // The flag only when this row changed it, as the room (E36 C2): an unchanged row writes nothing.
        const murder = Boolean(entry.murder) !== isIndirectMurder(entry.id) ? { indirectMurder: Boolean(entry.murder) } : null;

        // After that first moment the checkbox is simply the answer.
        //
        // This used to read `entry.secretTouched`, a field `readManager` has
        // never returned - so it was permanently `undefined`, "is it secret"
        // came out as `secret || murder`, and an indirect murder flipped between
        // sealed and revealed on every other save.
        // A preset that is always secret stays so, whatever the box read (fix e1-G1; the step refuses its reveal too).
        const shouldBeSecret = entry.secret || newlyMurder || (await alwaysSecretIds([entry])).has(entry.id);
        // Through secrecyChange, which knows about the row's own ticked list of
        // viewers (P-1) and about the builder; `entry.viewers` is null when this
        // window had no list to read, and then the seal keeps whoever already knew.
        // ONE CHANGE A ROW (E36 C2, 25.10.2026; audit S17-18): the portrait, the room, the flag and the
        // secrecy were three or four writes, each read and written whole, so another change landing
        // between them was lost or half-made; one step of the entry now, and none for a row left as it was.
        const change = combineChanges(img, room || murder ? { meta: { ...room, ...murder } } : null,
            secrecyChange(entry.id, shouldBeSecret, entry.viewers, entry.was));
        if (change) await applyProjectChange(entry.id, change, { by: { kind: "gm" } });
    }
    return deleted;
}

/**
 * One window for everything: create a project, set its room, mark it as an
 * indirect murder, control who can see it, and share or revoke access. Having
 * creation in one dialog and editing in another meant a new project always
 * needed two trips.
 */
export async function openProjectManager() {
    // ONE OF THESE, NOT FOUR - see `alreadyOpen` in live.mjs. Two copies of a
    // window each read the world when they opened and neither knows about the
    // other, so the older one goes on looking authoritative while showing
    // something that stopped being true. Raised rather than refused: pressing
    // twice usually means the window is behind something.
    if (alreadyOpen("drpg-window-projects")) return null;

    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return;
    }

    const projects = allProjects();
    const rooms = placeRoomNames();

    // No projects yet? Go straight to creating one.
    if (!projects.length) {
        const made = await openCreateDialog(rooms);
        return made ? openProjectManager() : undefined;
    }
    const rows = projectManagerRows(projects, rooms, { always: await alwaysSecretIds(projects) });
    /* WHO KNOWS WHAT, AS A MATRIX (Dawid, 22.09: "gracze z dostepem do projects ... sa brzydko
       ulozeni - liczylem bardziej na cos przypominajacego tabele"). One column per player,
       named once in the header, and a tick in each row: a GM reads down a column to see what
       one player knows and across a row to see who knows one project. The names used to be
       repeated in every row as a wrapping run of labels, which at sixteen players was a
       paragraph per project and no two rows lined up. */
    const players = playerList();
    const span = Math.max(1, players.length);
    const two = players.length ? ' rowspan="2"' : "";

    const content = dialogContent(`<form>
            <p>${game.i18n.localize("DRPG.Project.manageIntro")}</p>
            <table>
                <thead><tr>
                    <th${two}></th>
                    <th${two}>${game.i18n.localize("DRPG.Project.title")}</th>
                    <th${two}>${game.i18n.localize("DRPG.Project.room")}</th>
                    <th${two} class="drpg-tight-head">${game.i18n.localize("DRPG.Project.indirect")}</th>
                    <th${two}>${game.i18n.localize("DRPG.Project.secret")}</th>
                    <th colspan="${span}" class="drpg-viewer-group">${game.i18n.localize("DRPG.Project.visibleTo")}</th>
                    <th${two}>${game.i18n.localize("DRPG.Project.edit")}</th>
                    <th${two}>${game.i18n.localize("DRPG.Project.delete")}</th>
                </tr>${players.length ? `<tr>${players.map(u => `<th class="drpg-viewer-head" scope="col"><span>${
                    foundry.utils.escapeHTML(u.name)}</span></th>`).join("")}</tr>` : ""}</thead>
                <tbody>${rows}</tbody>
            </table>
            <p class="notes">${game.i18n.localize("DRPG.Project.secretNote")}</p>
            <p class="notes">${game.i18n.localize("DRPG.Project.deleteNote")}</p>
        </form>`);

    const result = await tableDialog({
        window: { title: game.i18n.localize("DRPG.Project.manageTitle") },
        classes: ["drpg-panel", "drpg-projects", "drpg-window-projects"],
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
        // A FilePicker needs a live click against the dialog's actual DOM -
        // see wirePortraitPickers() for why this cannot be wired any earlier.
        // The per-row edit buttons need the same treatment, and they close the
        // manager first so the two windows never stack.
        render: (event, dialog) => wireProjectManager(dialog, projects, rooms),
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

    const deleted = await applyProjectManager(result, projects);

    ui.notifications.info(deleted
        ? game.i18n.format("DRPG.Project.savedWithDeletions", { n: deleted })
        : game.i18n.localize("DRPG.Project.saved"));
}

/**
 * The glyph grid: every glyph the tray can draw, the chosen one lit.
 *
 * Radios and not a <select>, and each cell is a `.drpg-choice` - the module's
 * one idiom for picking, which both themes already dress (danganronpa.css,
 * stained-glass.css "the choice row"). What is being chosen is a picture, and
 * a dropdown of twenty-one words is a list of NAMES for pictures.
 *
 * The swatch is a Font Awesome icon, which is what makes it right under both
 * looks without a line of theme code: Monokuma Legacy draws the FA glyph, and
 * Stained Glass masks that same element to the pixel sprite through the rules
 * pixel-icons.css already ships - the very sprite the tray will paint the row
 * with. It needs no wiring, unlike the portrait beside it: the form is read on
 * Save like every other field.
 *
 * The first cell is the DEFAULT, and its value is the empty string, not
 * "hourglass": a GM who never touches the grid must leave the project with no
 * stored choice, or every edited project silently acquires a glyph and "no
 * choice" stops being tellable from "chose the hourglass".
 *
 * `<details>` rather than `<fieldset>`: this form is a `DialogV2.wait`, not
 * `tableDialog`, so nothing measures or caps its height - twenty-one open
 * cells push Save off a 1080p screen. It opens itself when a glyph is already
 * set, so an edit shows the choice that exists.
 */
function glyphGrid(current) {
    const chosen = isProjectGlyph(current) ? current : "";
    const cell = (value, fa, label) => `<label class="drpg-choice drpg-glyph-choice">
            <input type="radio" name="glyph" value="${value}"${value === chosen ? " checked" : ""} />
            <i class="fa-solid ${fa}" inert></i>
            <span class="drpg-glyph-name">${foundry.utils.escapeHTML(label)}</span>
        </label>`;

    const cells = [cell("", PROJECT_GLYPHS.hourglass.fa,
        game.i18n.localize("DRPG.Project.glyphDefault"))];
    for (const [key, def] of Object.entries(PROJECT_GLYPHS)) {
        if (key === "hourglass") continue;   // it IS the default, offered once
        const i18n = `DRPG.Project.glyph.${key}`;
        cells.push(cell(key, def.fa, game.i18n.has(i18n) ? game.i18n.localize(i18n) : def.label));
    }

    return `<details class="drpg-glyph-picker"${chosen ? " open" : ""}>
        <summary>${game.i18n.localize("DRPG.Project.glyphLabel")}</summary>
        <div class="drpg-glyph-grid">${cells.join("")}</div>
        <small class="notes">${game.i18n.localize("DRPG.Project.glyphNote")}</small>
    </details>`;
}

/**
 * The Statistic select's options for a project's form - the GM's editor here, and a
 * player's proposal (action-rolls.mjs `startProject`).
 *
 * A STATISTIC IS REQUIRED (E32+E07 C11d; the owner's rules of 28.09.2026). Both forms
 * offered "- player chooses -" until 1.2.66, and a roll on such a project let the
 * player pick. A project's roll - Work on it, or a Sabotage of it - takes the
 * project's statistic now, so a form has to name one. With none yet (a new project, or
 * one stored without) the placeholder is blank, disabled and selected: nothing is
 * guessed for the writer, and the form's own check refuses it ("DRPG.Project.traitRequired").
 */
export function projectTraitOptions(current = "") {
    return [
        `<option value="" disabled${current ? "" : " selected"}>-</option>`,
        ...Object.entries(TRAITS).map(([k, t]) =>
            `<option value="${k}"${k === current ? " selected" : ""}>${t.label}</option>`)
    ].join("");
}

/**
 * Create a project, or edit one - the same form either way.
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
 *   not exist yet - a player's proposal, arriving from the approval card. NOT
 *   the same as `project`: nothing has been created, so this still takes the
 *   create path and the GM can change every answer before it does.
 */
export async function openProjectDialog({ project = null, preset = null, rooms = placeRoomNames() } = {}) {
    const editing = Boolean(project);
    const start = project ?? preset ?? null;
    // A Secret Passage's approval (E15 part 2 C2), or a breach's (C3): the builder's room as the GMs read it, and its neighbours.
    const passageOf = !editing && ["secretPassage", "breach"].includes(start?.preset) ? await passageApproval(start) : null;
    // Held at the edit too (E15 part 2 fix e1-G1; findings SEC-2, END-04, R2): the project's preset, read in the GMs' half.
    const alwaysSecret = passageOf?.preset === "secretPassage" || (editing && (await alwaysSecretIds([project])).has(project.id));
    // The owner's three of 15.10 (E15 part 2 C5): the passage, breach or item the card names, judged here as the GMs read it.
    const ownedOf = !editing && OWNED_PRESETS.includes(start?.preset) ? await presetApproval(start) : null;
    // Said in the table's language (fix e1-G4): the judges answer English, kept for the log.
    if (ownedOf?.refused) ownedOf.why = (await import("./passages-gm.mjs")).whyText(ownedOf.refused);
    const defaultImg = "icons/magic/time/hourglass-yellow-green.webp";
    const img = start?.img || defaultImg;
    /* A PRESET'S SIZE IS THE GMS' (E15 part 2 fix e1-G3; finding E15P2-R4): its table's (passages-gm.mjs `PASSAGE_PRESETS`),
       a Repair an item's by the item's tier as the GMs hold it (`presetApproval`'s `scale`) - never the card's claim, which
       a console sets to Trivial for a tier 3 tool. The GM may still pick another size in the window. */
    const presetSize = !editing && start?.preset ? await presetSizeOf(start.preset, ownedOf) : null;
    const currentTarget = presetSize ?? start?.start ?? start?.target ?? PROJECT_SCALE.everyday.progress;
    const currentTrait = start?.trait ?? "";
    const currentRoom = start?.room ?? "";

    /*
     * THE WINDOW OPENS ON THE TARGET IT WAS GIVEN (E15 part 1 C1, 25.10.2026; audit S09-13). A
     * proposal's preset is the player's answer, and only the edit read it: approving a player's
     * Complex or Desperate opened on Standard, so a GM who trusted the form made the cheaper
     * project (tier 2 E15-T1 at d90687dc: a proposal of 6 and one of 5 both opened on 4). A window
     * with neither, the panel's own Create, is Standard.
     */
    const given = editing || Boolean(presetSize) || Number(preset?.target) > 0;
    const scaleOptions = Object.entries(PROJECT_SCALE)
        .map(([key, s]) => {
            const selected = given ? s.progress === currentTarget : key === "everyday";
            return `<option value="${s.progress}"${selected ? " selected" : ""}>${
                s.label} - ${s.progress} progress</option>`;
        }).join("");

    // An edited project may sit on a target no scale names - a repair inherits
    // whatever the sabotage rolled - and so may a proposal (a card from an older
    // form, a player's console). Offer it rather than silently re-scaling it.
    const offScale = given && !Object.values(PROJECT_SCALE).some(s => s.progress === currentTarget)
        ? `<option value="${currentTarget}" selected>${
            game.i18n.format("DRPG.Project.customScale", { n: currentTarget })}</option>`
        : "";

    const roomOptions = roomSelectOptions(rooms, currentRoom);

    const players = playerList();

    const traitOptions = projectTraitOptions(currentTrait);

    /*
     * THE NINE TRIGGERS, AND R13 IN BOTH DIRECTIONS.
     *
     * Built from `TRAP_TRIGGERS` rather than typed out, so a trigger the module
     * watches for cannot be missing from this list and a row in this list
     * cannot name something nothing listens to. A trigger with no listener is a
     * choice a GM makes that then silently never happens - which looks exactly
     * like a trap nobody walked into.
     *
     * `manual` is on the list on purpose. It is today's behaviour, and putting
     * it beside the eight the module watches is what makes "I will keep an eye
     * on this myself" a decision rather than the only thing available.
     */
    // Off the GMs' store, not off `start`: `allProjects()` returns the countdown
    // plus the handful of fields the tray needs, and the trigger is not one of
    // them. Reading it from the wrong place would silently reset every trap's
    // trigger to "manual" the first time a GM opened its project to change the
    // name. The store's since E05 (projectMeta's before: audit S09-05).
    const startTrigger = (editing ? secretsOf(project.id).trigger : start?.trigger) ?? null;
    const currentTrigger = startTrigger?.kind ?? "manual";
    const triggerOptions = Object.entries(TRAP_TRIGGERS).map(([key, def]) =>
        `<option value="${key}"${key === currentTrigger ? " selected" : ""}>${
            foundry.utils.escapeHTML(game.i18n.localize(`DRPG.Trap.trigger.${key}`) || def.label)
        }</option>`).join("");

    // The two triggers that point at another project rather than a room. A
    // trap cannot watch itself, so it is not on its own list.
    const triggerTarget = startTrigger?.targetId ?? "";
    const targetOptions = allProjects()
        .filter(p => !editing || p.id !== project.id)
        .map(p => `<option value="${p.id}"${p.id === triggerTarget ? " selected" : ""}>${
            foundry.utils.escapeHTML(p.name)}</option>`).join("");

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
            ${glyphGrid(start?.glyph ?? null)}
            <label>${game.i18n.localize("DRPG.Project.scale")}
                <select name="target">${offScale}${scaleOptions}</select></label>
            <label>${game.i18n.localize("DRPG.Project.room")}
                <select name="room">${roomOptions}</select></label>
            <label>${game.i18n.localize("DRPG.Project.trait")}
                <select name="trait" required>${traitOptions}</select></label>
            <label class="drpg-checkbox">
                <input type="checkbox" name="murder"${
                    start?.indirectMurder ? " checked" : ""} /> ${
                    game.i18n.localize("DRPG.Project.indirect")}</label>
            <div class="drpg-trap-fields" data-drpg-when-murder>
            <label>${game.i18n.localize("DRPG.Trap.watchFor")}
                <select name="trigger">${triggerOptions}</select>
                <small class="notes">${game.i18n.localize("DRPG.Trap.watchNote")}</small></label>
            <label data-drpg-when-trigger="project sabotage">${
                game.i18n.localize("DRPG.Trap.whichProject")}
                <select name="triggerTarget"><option value="">-</option>${targetOptions}</select></label>
            <label class="drpg-checkbox">
                <input type="checkbox" name="afterDark"${
                    startTrigger?.afterDark ? " checked" : ""} /> ${
                    game.i18n.localize("DRPG.Trap.afterDark")}</label>
            <label class="drpg-checkbox">
                <input type="checkbox" name="notBuilder"${
                    (startTrigger?.notBuilder ?? TRAP_MODIFIERS.notBuilder.default)
                        ? " checked" : ""} /> ${
                    game.i18n.localize("DRPG.Trap.notBuilder")}</label>
            <label>${game.i18n.localize("DRPG.Project.condition")}
                <input type="text" name="condition"
                       value="${foundry.utils.escapeHTML(start?.condition ?? "")}"
                       placeholder="${game.i18n.localize("DRPG.Project.conditionPlaceholder")}" />
                <small class="notes">${game.i18n.localize("DRPG.Project.conditionNote")}</small></label>
            </div>
            ${passageOf ? passageFieldset(passageOf) : ""}
            ${ownedOf ? ownedFieldset(ownedOf) : ""}
            <label class="drpg-checkbox">
                <input type="checkbox" name="secret"${
                    (editing && isSecret(project.id)) || alwaysSecret ? " checked" : ""}${alwaysSecret ? " disabled" : ""} /> ${
                    game.i18n.localize("DRPG.Project.secret")}</label>
            ${players.length ? `<fieldset class="drpg-viewer-list" data-drpg-when-secret>
                <legend>${game.i18n.localize("DRPG.Project.visibleTo")}</legend>
                ${viewerBoxes(players, editing ? knownBy(project.id) : [], null, { locked: editing && !isSecret(project.id) })}
                <small class="notes" data-drpg-viewer-note>${game.i18n.localize(editing && !isSecret(project.id)
                    ? "DRPG.Project.everyone" : "DRPG.Project.visibleToNote")}</small>
            </fieldset>` : ""}
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
                    target: Number(f.target.value) || PROJECT_SCALE.everyday.progress,
                    room: f.room.value || null,
                    trait: f.trait.value || null,
                    murder: f.murder.checked,
                    condition: f.condition.value.trim(),
                    trigger: {
                        kind: f.trigger.value || "manual",
                        targetId: f.triggerTarget?.value || null,
                        afterDark: f.afterDark.checked,
                        notBuilder: f.notBuilder.checked
                    },
                    secret: f.secret.checked,
                    // Everyone ticked, in one list (P-1). `querySelectorAll`
                    // rather than the form's named collection: one checkbox and
                    // many checkboxes read differently through that name.
                    viewers: [...d.element.querySelectorAll('[name="viewers"]:checked')]
                        .map(box => box.value),
                    // As the window drew them (E36 fix e1-G2: `secrecyChange`).
                    was: [...d.element.querySelectorAll('[name="viewers"]')].filter(box => box.defaultChecked)
                        .map(box => box.value),
                    img: f.img.value || null,
                    // A RadioNodeList's `.value` is the checked one, and the
                    // default cell's value is "" - so an untouched grid reads
                    // as "no choice" and the tray's own fallback names the
                    // hourglass, in one place.
                    glyph: f.glyph?.value || null,
                    // A Secret Passage's neighbour and the stretch its pick made (E15 part 2 C2).
                    passageTo: f.passageTo?.value || null,
                    passage: f.passage?.value || null
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
        // See wirePortraitPickers() - DialogV2 discards `content` and rebuilds
        // it from a string, so the picker has to be wired against the dialog's
        // real element once it exists, not against the div built above.
        render: (event, dialog) => {
            wirePortraitPickers(dialog.element, { defaultImg });
            if (editing && !isSecret(project.id)) wireViewerLock(dialog.element);
            if (passageOf?.offer) wirePassagePick(dialog, passageOf.offer, { over: passageOf.preset === "breach" });
        },
        rejectClose: false
    });

    if (!result || result === "cancel") return null;

    if (result === "delete") {
        const sure = await DialogV2.confirm({
            yes: { label: game.i18n.localize("DRPG.Dialog.yes") },
            no: { label: game.i18n.localize("DRPG.Dialog.no") },
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
    if (!Object.hasOwn(TRAITS, result.trait ?? "")) {
        ui.notifications.warn(game.i18n.localize("DRPG.Project.traitRequired"));
        return null;
    }

    if (editing) {
        /*
         * A MURDER NAMED IN THE EDIT NAMES ITS KILLER, OR IS REFUSED (E15 part 1 C1, 25.10.2026;
         * audit S09-16). Create and the manager refuse an indirect murder with nobody behind it
         * (ITEM-14), and the manager's refusal sends the GM here - which saved the flag with no
         * killer, so the finished trap armed nothing and told nobody but the log (tier 2 E15-T1 at
         * d90687dc: a Secret project ticked Indirect murder with nobody ticked was saved a murder,
         * and with a player ticked saved no killer). The killer as Create picks one: the proposer,
         * else the first player ticked; one the project has already is kept.
         */
        const known = secretsOf(project.id);
        const killerId = result.murder && !known.killerId ? killerIdFor(result.viewers?.[0], known.by ?? null) : null;
        if (result.murder && !known.killerId && !killerId) {
            ui.notifications.warn(game.i18n.localize("DRPG.Project.needsKiller"));
            return null;
        }
        // One change of the entry (E36 C2): the edit and the secrecy in one step.
        const change = combineChanges(projectEditChange({
            ...(killerId ? { killerId } : {}),
            name: result.name,
            target: result.target,
            img: result.img,
            glyph: result.glyph,
            room: result.room,
            trait: result.trait,
            indirectMurder: result.murder,
            condition: result.condition,
            // ARMED STATE SURVIVES AN EDIT. A GM who opens a watching trap to
            // fix a typo in its name must not thereby take it off watch - and
            // must not re-arm one that has already spoken either, which is the
            // same rule read from the other end (trap 153).
            trigger: result.murder
                ? { ...result.trigger, armed: Boolean(startTrigger?.armed),
                    firedAt: startTrigger?.firedAt ?? null,
                    condition: result.condition }
                : null
        }), secrecyChange(project.id, result.secret || result.murder || alwaysSecret, result.viewers, result.was));
        if (change) await applyProjectChange(project.id, change, { by: { kind: "gm" } });
        ui.notifications.info(game.i18n.localize("DRPG.Project.saved"));
        return { id: project.id, name: result.name };
    }

    // Whose trap it is: the proposer off the card, else the character of the
    // first player the GM ticked under "Visible to" - see `killerIdFor`. Whoever
    // it is, `createProject` adds them to the ticked viewers rather than
    // replacing them (F3).
    const killerId = killerIdFor(result.viewers?.[0], start?.by ?? null);

    // An indirect murder needs somebody to be the killer (ITEM-14): without a
    // killer the trap never arms and the finished project tells nobody. Said
    // here, where the GM can still pick a name, rather than logged later. It is
    // the one value above, read once, so the refusal and the write below can
    // never disagree about who the killer is.
    if (result.murder && !killerId) {
        ui.notifications.warn(game.i18n.localize("DRPG.Project.needsKiller"));
        return null;
    }

    /*
     * A SECRET PASSAGE IS JUDGED AT ITS APPROVAL (E15 part 2 C2; the stage's D2). The builder's room is the GMs'
     * reading, the room beyond is one of its neighbours on that floor, and the stretch is the pick's, between those two
     * (passages-gm.mjs `builtPassageRow`, which the completion asks again on the primary). Anything else leaves the card
     * open and says why.
     */
    let passageFields = null;
    if (passageOf) {
        let picked = null;
        try { picked = JSON.parse(result.passage ?? "null"); } catch { picked = null; }
        const why = !passageOf.offer ? "DRPG.Project.passageNoWall"
            : !picked?.wallId ? "DRPG.Project.passageNeedsPick"
            : !passageOf.offer.neighbours.includes(result.passageTo) || !picked.rooms?.includes(passageOf.offer.from) || !picked.rooms?.includes(result.passageTo)
                ? "DRPG.Project.passageRefused" : null;
        // A breach's stretch is judged as its completion judges it (C3: it may stand over a passage, never on a wall breached already).
        const { builtPassageRow, breachStretchRow, whyText } = await import("./passages-gm.mjs");
        const judged = why ? null : (passageOf.preset === "breach" ? breachStretchRow(picked) : builtPassageRow(picked));
        if (why || !judged?.row) {
            // The stretch's own reason, in the table's language (fix e1-G4): a whole wall, a door, a breached wall.
            ui.notifications.warn(why ? game.i18n.localize(why) : game.i18n.format("DRPG.Project.presetRefused", { why: whyText(judged?.refused) }));
            return null;
        }
        passageFields = { presetTarget: { preset: passageOf.preset, room: result.passageTo }, passage: picked };
    }

    // The owner's three (C5): judged again on Create - the passage still known, the breach still standing, the item still
    // the builder's own and broken or worn -, and the completion judges it once more on the primary.
    if (ownedOf) {
        const again = await presetApproval(start);
        if (again.refused) {
            ui.notifications.warn(game.i18n.format("DRPG.Project.presetRefused", { why: (await import("./passages-gm.mjs")).whyText(again.refused) }));
            return null;
        }
        passageFields = { presetTarget: again.target, passage: null };
    }

    const created = await createProject({
        ...(passageFields ?? {}),
        name: result.name,
        target: result.target,
        // Whose idea it was, straight off the proposal card. `start` is the
        // preset when the GM opened this from an Approve button, and null when
        // they opened it from the panel - where there is no proposer to name.
        by: start?.by ?? null,
        room: result.room,
        trait: result.trait,
        indirectMurder: result.murder,
        condition: result.condition,
        trigger: result.trigger,
        secret: result.secret || result.murder,
        img: result.img,
        glyph: result.glyph,
        viewers: result.viewers ?? [],
        // Decided just above, together with the refusal that guards it: a murder
        // with neither a proposer nor a ticked player never gets this far.
        killerId
    });

    if (created) ui.notifications.info(game.i18n.format("DRPG.Project.created", { name: created.name }));
    return created;
}

/**
 * A PUBLIC PROJECT'S BOXES OPEN WHEN ITS EDIT SEALS IT (E15 part 1 fix e1-G1, 25.10.2026; findings E15p1-SEC-R1,
 * END-1, R2). An edited public project's "Visible to" is drawn locked - its ticks are who knew before it was revealed
 * (`knownBy`), not a list the GM is choosing - and the fieldset shows once Secret or Indirect murder is ticked. With
 * the boxes still locked, a GM's own public project (no proposer) ticked Indirect murder could name no killer: Save
 * was refused with needsKiller ("pick who it is visible to"), which the window did not allow, and one revealed after
 * a seal silently made the first of its old viewers the killer (tier 2 E15-T1 at c93be060: the boxes disabled after
 * the tick, the save refused). Ticking either box now unlocks them, with the Secret project's note; unticking both
 * locks them again, as drawn, and then the Save reads no viewers (`secrecyChange` takes none for a public project).
 */
function wireViewerLock(root) {
    const form = root.querySelector("form");
    if (!form?.secret || !form.murder) return;
    const boxes = [...form.querySelectorAll('[name="viewers"]')];
    const note = form.querySelector("[data-drpg-viewer-note]");
    const sync = () => {
        const open = form.secret.checked || form.murder.checked;
        for (const box of boxes) box.disabled = !open;
        if (note) note.textContent = game.i18n.localize(open ? "DRPG.Project.visibleToNote" : "DRPG.Project.everyone");
    };
    form.secret.addEventListener("change", sync);
    form.murder.addEventListener("change", sync);
    sync();
}

/**
 * A Secret Passage's approval, read on the GM's browser (E15 part 2 C2): `{ offer, to }` - the builder's offer as the
 * GMs read where the builder stands (movement.mjs `gmPlaceOf`, passages-gm.mjs `secretPassageOffer`), null when its
 * room shares no wall on its floor, and the neighbour the card's index names there, else the first.
 */
async function passageApproval(start) {
    const builder = game.actors.get(start?.by ?? "");
    const { gmPlaceOf } = await import("./movement.mjs");
    const { secretPassageOffer } = await import("./passages-gm.mjs");
    const offer = builder ? secretPassageOffer(gmPlaceOf(builder)) : null;
    const index = Number(start?.to);
    return { offer, preset: start.preset, to: offer ? (offer.neighbours[Number.isInteger(index) ? index : 0] ?? offer.neighbours[0]) : null };
}

/** The owner's three presets of 15.10 (E15 part 2 C5), whose card names its target by id. */
const OWNED_PRESETS = Object.freeze(["sealPassage", "closeBreach", "repairItem"]);

/**
 * The approval of Seal the passage, Close the breach or Repair an item, read on the GM's browser (E15 part 2 C5; the
 * stage's D2): `{ preset, label, target, refused }` - the card's id read where the GMs hold it (a passage of either store,
 * a breach standing on a scene, an item of the builder's own sheet as the GMs' mark holds it), the label the window
 * shows, the target `createProject` keeps in the GMs' half, and the reason it may not be done, or null. The same
 * judges the completion asks again on the primary (passages-gm.mjs `sealRefusal`, `closeBreachRefusal`; inventory.mjs
 * `repairRefusal`).
 */
async function presetApproval(start) {
    const preset = start?.preset, id = typeof start?.to === "string" ? start.to : "", builderId = start?.by ?? null;
    /* THE ROOM AND THE SCENE WHERE THE GMS READ THE BUILDER (fix e1-G3; finding SEC-3), not the card's: a Seal the passage
       or a Close the breach names a passage or a breach with a side in that room on that scene (`presetSideRefusal`, which
       the completion asks again with the room kept here). A Repair an item keeps the card's room, the form's. */
    const place = preset === "repairItem" ? null : (await import("./movement.mjs")).gmPlaceOf(game.actors.get(builderId ?? "") ?? null);
    const room = preset === "repairItem" ? start?.room || null : place?.room ?? null;
    if (preset === "repairItem") {
        const { repairRefusal, wearOf, isBroken } = await import("./inventory.mjs");
        const { tierOf } = await import("./use-items.mjs");
        const { itemsHeldNow } = await import("./sheet-audit.mjs");
        const builder = game.actors.get(builderId ?? "") ?? null, item = builder?.items?.get(id) ?? null;
        const held = item ? itemsHeldNow(builder).find(each => each.id === item.id) ?? item : null;
        const label = item ? game.i18n.format("DRPG.Project.repairLabel", { item: item.name, tier: tierOf(held),
            state: game.i18n.localize(isBroken(held) ? "DRPG.Project.repairBroken" : wearOf(held) ? "DRPG.Project.repairWorn" : "DRPG.Project.repairWhole") }) : "-";
        return { preset, label, target: { preset, room, itemId: id }, refused: repairRefusal(builder, item, { held }),
            scale: (await import("./passages-gm.mjs")).presetScale(preset, { tier: held ? tierOf(held) : 0 }) };
    }
    const P = await import("./passages-gm.mjs");
    if (preset === "sealPassage") {
        const row = P.rowsOf().get(id);
        return { preset, label: (row?.rooms ?? []).join(" - ") || "-", target: { preset, room, passageId: id },
            refused: P.sealRefusal({ passageId: id, builderId }) ?? await P.presetSideRefusal({ passageId: id, sceneId: place?.scene?.id ?? "", room }) };
    }
    const scene = (game.scenes?.contents ?? [...(game.scenes ?? [])]).find(s => P.breachesOn(s).some(found => found.breach.breachId === id)) ?? null;
    const row = Object.values(P.rowsOf().entries()).find(r => r?.breach?.breachId === id) ?? null;
    return { preset, label: (row?.rooms ?? []).join(" - ") || scene?.name || "-", target: { preset, room, sceneId: scene?.id ?? null, breachId: id },
        refused: P.closeBreachRefusal({ sceneId: scene?.id ?? null, breachId: id })
            ?? await P.presetSideRefusal({ breachId: id, sceneId: place?.scene?.id ?? "", room }) };
}

/** A preset's size in progress, as the GMs hold it (fix e1-G3): a Repair an item's by its tier (`presetApproval`), the rest the table's. */
async function presetSizeOf(preset, ownedOf = null) {
    const { PASSAGE_PRESETS } = await import("./passages-gm.mjs");
    if (!PASSAGE_PRESETS[preset]) return null;
    const scale = preset === "repairItem" ? ownedOf?.scale : PASSAGE_PRESETS[preset].scale;
    return PROJECT_SCALE[scale]?.progress ?? null;
}

/** The approval window's box for the owner's three: what the card names, and why it may not be done. */
function ownedFieldset({ preset, label, refused, why = null }) {
    const esc = text => foundry.utils.escapeHTML(String(text ?? ""));
    return `<fieldset class="drpg-passage-preset" data-drpg-owned-preset="${esc(preset)}"><legend>${esc(game.i18n.localize(`DRPG.Project.preset.${preset}`))}</legend>
        <p class="notes">${esc(label)}</p>${refused ? `
        <p class="drpg-warning">${esc(game.i18n.format("DRPG.Project.presetRefused", { why: why ?? "" }))}</p>` : ""}</fieldset>`;
}

/** The approval window's Secret Passage box: the builder's room, the room beyond, the pick and what it picked. */
function passageFieldset({ offer, to, preset = "secretPassage" }) {
    const esc = text => foundry.utils.escapeHTML(String(text ?? ""));
    const t = key => game.i18n.localize(key);
    const legend = esc(t(`DRPG.Project.preset.${preset}`));
    if (!offer) return `<fieldset class="drpg-passage-preset"><legend>${legend}</legend>
        <p class="drpg-warning">${esc(t("DRPG.Project.passageNoWall"))}</p></fieldset>`;
    return `<fieldset class="drpg-passage-preset" data-drpg-passage-preset><legend>${legend}</legend>
        <p class="notes">${esc(game.i18n.format("DRPG.Project.passageFrom", { room: offer.from }))}</p>
        <label>${esc(t("DRPG.Project.passageTo"))}
            <select name="passageTo">${offer.neighbours.map(r => `<option value="${esc(r)}"${r === to ? " selected" : ""}>${esc(r)}</option>`).join("")}</select></label>
        <button type="button" class="drpg-mini-button" data-drpg-passage-pick>${esc(t("DRPG.Project.passagePick"))}</button>
        <input type="hidden" name="passage" value="" />
        <small class="notes" data-drpg-passage-picked>${esc(t("DRPG.Project.passageNone"))}</small></fieldset>`;
}

/**
 * The approval's pick (E15 part 2 C2): two clicks on the wall between the builder's room and the room beyond, on the
 * builder's floor (passages-gm.mjs `startPassagePick` with `between`), kept in the window until Create. Another room
 * picked forgets the stretch.
 */
function wirePassagePick(dialog, offer, { over = false } = {}) {
    const root = dialog?.element, form = root?.querySelector("form");
    const button = root?.querySelector("[data-drpg-passage-pick]"), said = root?.querySelector("[data-drpg-passage-picked]");
    if (!form?.passage || !button) return;
    const forget = () => {
        form.passage.value = "";
        if (said) said.textContent = game.i18n.localize("DRPG.Project.passageNone");
    };
    form.passageTo?.addEventListener("change", forget);
    button.addEventListener("click", async () => {
        const scene = game.scenes.get(offer.sceneId);
        if (!scene) return;
        const { startPassagePick } = await import("./passages-gm.mjs");
        const stretch = await startPassagePick(scene, { dialog, between: { rooms: [offer.from, form.passageTo?.value], level: offer.level, over } });
        if (!stretch?.wallId) return;
        form.passage.value = JSON.stringify(stretch);
        if (said) said.textContent = game.i18n.format("DRPG.Project.passagePicked", { passage: stretch.rooms.join(" - ") });
    });
}

/**
 * The proposer, else the actor behind the first player ticked.
 *
 * THE PROPOSER FIRST (Dawid, 21.09 - the stage D review's question, answered
 * "the proposer"). This is what 988146c (F3, 17.09) wrote: whoever proposed the
 * murder is its killer, and a player ticked under "Visible to" is ADDED to the
 * audience rather than put in their place. The viewer list that replaced the
 * single name the next day (P-1) turned the order round - its first tick stood
 * in for the killer - so a GM ticking an accomplice onto a player's own trap
 * quietly made the accomplice the one it fires for. The tick still counts where
 * there is no proposal to read: a murder the GM opens from the panel.
 *
 * Exported for the suite, which asks it both ways round; nothing else calls it.
 */
export function killerIdFor(viewerUserId, byActorId) {
    if (byActorId) return byActorId;
    if (viewerUserId) {
        const user = game.users.get(viewerUserId);
        const owned = user ? game.actors.find(a => a.type === "character" && a.testUserPermission(user, "OWNER")) : null;
        if (owned) return owned.id;
    }
    return null;
}

/**
 * The change that keeps the ownership map in step with one boolean, or null when it already is (E36 C2: written by the
 * caller's one change). An operation since E36 fix e1-G2 (findings E36-END-S2, F4): `seal` with the boxes ticked and
 * the boxes the window drew ticked, or `reveal`, worked out in the step from who sees the project then
 * (projects-secrecy.mjs `sightChange`), so a player shared while the window stood open is not taken off by a Save
 * that did not untick them.
 */
function secrecyChange(id, wanted, viewers = null, was = null) {
    /*
     * A TICKED LIST IS AN ANSWER, NOT AN ADDITION (P-1, Dawid 18.09).
     *
     * With no list - the old callers, and the manager rows of a world with no
     * players - secrecy follows `sealAudience`, which keeps whoever already knew
     * and the builder. With a list, that list IS who knows: unticking somebody
     * takes them off. The builder is added either way, because a seal that shuts
     * the person building it out is F3 coming back. A ticked list that is every
     * player at once is the F4 leak (`withoutLeak`, E05; audit S09-09).
     *
     * Re-sealed when the list moved even if the checkbox did not - and not
     * written when neither did: a Save that changes nothing must not rewrite
     * the ownership of every secret project at the table. Read here only for
     * that; the step reads it again.
     */
    const op = wanted ? { seal: { viewers, was } } : (isSecret(id) ? { reveal: true } : null);
    return op && sightChange(id, op) ? op : null;
}

/**
 * The projects of `projects` whose preset is always secret (passages-gm.mjs `PASSAGE_PRESETS`, `secret: "always"`; E15
 * part 2 fix e1-G1), read in the GMs' half (`target.preset`): their Secret box is drawn ticked and locked, and a Save
 * never reveals them - nor does the step, which refuses the reveal whichever road asks.
 */
async function alwaysSecretIds(projects) {
    const { PASSAGE_PRESETS } = await import("./passages-gm.mjs");
    return new Set((projects ?? []).filter(p => p?.id && PASSAGE_PRESETS[secretsOf(p.id).target?.preset]?.secret === "always").map(p => p.id));
}

/** Kept as its own name - the manager and the empty state both call it. */
async function openCreateDialog(rooms = placeRoomNames()) {
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
        // Who the GM says knows about it, for the rows where that list is shown
        // (P-1). `null` when this window had no list to read, so a save cannot
        // mistake "no checkboxes here" for "nobody knows".
        viewers: form.querySelector(`[name="viewers.${p.id}"]`)
            ? [...form.querySelectorAll(`[name="viewers.${p.id}"]:checked`)].map(box => box.value)
            : null,
        // The boxes as the window drew them (E36 fix e1-G2): what the GM changed is what the Save changes.
        was: form.querySelector(`[name="viewers.${p.id}"]`)
            ? [...form.querySelectorAll(`[name="viewers.${p.id}"]`)].filter(box => box.defaultChecked).map(box => box.value)
            : null,
        delete: form.querySelector(`[name="delete.${p.id}"]`)?.checked ?? false
    }));
}

/** Every player, in the order a reader counts them: "Player 2" before "Player 10". The
    matrix's header and its rows ask separately, so they must get the same order. */
function playerList() {
    return game.users.filter(u => !u.isGM)
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
}

/**
 * WHO A ROW'S TICKS NAME (E05 C1; audit S09-09). A secret project's viewers; a public one's
 * `sealedViewers` - who knew before it was revealed, and will again if it is sealed - never
 * `viewersOf`, which on a public project is the whole table (Daggerheart reads
 * `ownership[user.id]`, so a reveal names every player): the manager and the project window
 * showed that list as ticks, and a Save re-sealed with it - the F4 leak under the Secret box's
 * name. A public project's ticks are drawn locked (`locked`), with `DRPG.Project.everyone`.
 */
function knownBy(id) {
    return isSecret(id) ? viewersOf(id).map(u => u.id) : (metaFor(id).sealedViewers ?? []);
}

/** One cell per player for the manager's matrix - see `openProjectManager`. The checkbox
    keeps the name `viewerBoxes` gives it, so `readManager` reads both the same way. */
function viewerTicks(players, checked, project, { locked = false } = {}) {
    const known = new Set(checked);
    const lock = locked ? ` disabled data-tooltip="${foundry.utils.escapeHTML(game.i18n.localize("DRPG.Project.everyone"))}"` : "";
    return players.map(user => `<td class="drpg-viewer-tick">
        <input type="checkbox" name="viewers.${project.id}" value="${user.id}"${known.has(user.id) ? " checked" : ""}${lock}
               aria-label="${foundry.utils.escapeHTML(`${user.name}: ${project.name}`)}" /></td>`).join("");
}

/**
 * The one list of players, drawn twice: in the project window and in a manager
 * row (P-1, Dawid 18.09).
 *
 * It replaced a single "Also visible to" dropdown, which could only ever name
 * one person and only when the project was being created - so a second
 * conspirator had to be added through the Share window afterwards, and taken off
 * through nothing at all. GMs only see this; players are named, never GMs, and
 * the builder is added by `builderIds` whatever is ticked here.
 */
function viewerBoxes(players, checked, projectId = null, { locked = false } = {}) {
    const name = projectId ? `viewers.${projectId}` : "viewers";
    const known = new Set(checked);
    return players.map(user => `<label class="drpg-inline-check">
        <input type="checkbox" name="${name}" value="${user.id}"${known.has(user.id) ? " checked" : ""}${locked ? " disabled" : ""} />
        ${foundry.utils.escapeHTML(user.name)}</label>`).join(" ");
}

/* ==========================================================================
 * SHARING
 * ========================================================================== */

/**
 * Let a player in on a secret project - a co-conspirator, or the GM handing
 * knowledge to someone who earned it.
 */
export async function openShareDialog(preselectId = null) {
    const projects = allProjects().filter(p => isSecret(p.id));
    if (!projects.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Project.noSecrets"));
        return;
    }

    const players = playerList();
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

    // "Revoked." only when it was (E05): a builder is never taken off their own project, and that was said.
    if (result.revoke) {
        if (!await unshareWith(result.project, result.player)) return;
    }
    // "Project shared." only when it was (E31): a refusal has been said, and a public project is not shared.
    else if (!await shareWith(result.project, result.player)) return;

    ui.notifications.info(game.i18n.localize(result.revoke ? "DRPG.Project.revoked" : "DRPG.Project.shared"));
}
