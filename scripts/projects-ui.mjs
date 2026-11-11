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

import {
    MODULE_ID, PROJECT_SCALE, PROJECT_GLYPHS, isProjectGlyph, TRAITS, TRAP_TRIGGERS, TRAP_MODIFIERS, PROJECT_DESCRIPTION_MAX, projectDescriptionProblem
} from "./config.mjs";
import {
    allProjects, metaFor, roomOf, isIndirectMurder, isSecret, shareWith, unshareWith,
    viewersOf, secretsOf, createProject, deleteProject,
    applyProjectChange, combineChanges, projectEditChange, sightChange, projectMeta, addProgress, projectLabel
} from "./projects.mjs";
import { placeRoomNames } from "./rooms.mjs";
import { error, markFired, markLanguage, serialWrite, wirePortraitPickers } from "./utils.mjs";
import { emptyOption, drpgConfirm, drpgWindow, dataTable, formGrid, helpText, box, iconButton, kitNode } from "./ui-kit.mjs";
import { SETTINGS } from "./settings.mjs";
// The projects' queue key, from the file that keeps it (projects.mjs does not re-export it), as traps.mjs and fog.mjs read it.
import { COUNTDOWNS_KEY } from "./projects-secrecy.mjs";
import { alreadyOpen, keepFresh, RAISED } from "./live.mjs";
import {
    leaveIconOnly, localiseRawKeys, hideUndiscovered, showTrayToPlayer, paintProgress, applyCollapsed, addCollapseControl,
    labelTrayControls, markTrayMore
} from "./projects-tray.mjs";
export { refreshProjects, hideUndiscovered } from "./projects-tray.mjs";

export function registerProjectsUi() {
    // The countdown tray is its own ApplicationV2; label it on every render.
    Hooks.on("renderDhCountdowns", onRenderCountdowns);
    // Its row menu, before the tray's first render builds it (E36 C2), and once more at ready for a class set late;
    // and its automation's whole write of the countdowns, the same way (E37 C6).
    wrapCountdownMenu();
    wrapCountdownUpdate();
    Hooks.once("ready", () => {
        wrapCountdownMenu();
        wrapCountdownUpdate();
    });
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
        // The minus and the plus named, and the list's foot faded while rows stand below it (E23 C3a).
        labelTrayControls(root);

        // Folding the tray away is everybody's, not the GM's - a player with
        // four projects on a 1080p screen wants the map back, and the tray sits
        // directly under their own status strip.
        addCollapseControl(root);
        applyCollapsed(root);
        markTrayMore(root);

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
 *
 * AND THE SYSTEM'S OWN WHOLE WRITES IN THE PROJECTS' QUEUE (E37 C6, 01.11.2026;
 * E37-29, the deferred D100). On a GM's browser the menu's Reveal, Hide and
 * Delete on a row that is no project, and the automation's static
 * `DhCountdowns.updateCountdowns` (a GM's own roll, a combat turn, reroll.mjs
 * `settleDualityReroll`), each read the setting, await, and write it whole,
 * outside `COUNTDOWNS_KEY`: a project's step landing between that read and that
 * write was written over. Each runs as a step of the key now
 * (`queuedCountdownWrite`), so a project's change lands before or after it,
 * never under it. Nothing calls `updateCountdowns` inside a step of the key - it
 * would wait on itself (R1201). The -/+ on a row that is no project stays the
 * system's private handler, outside the key (projects-secrecy.mjs's header;
 * LIVE-E37-03).
 * ========================================================================== */

/**
 * The system's own whole write of the Countdowns, run on a GM's browser as a step of `COUNTDOWNS_KEY` (E37 C6), and
 * as it was on a player's, whose write goes to the GM's relay (relay-guard.mjs `applyOps`, its own step there).
 */
function queuedCountdownWrite(write) {
    return game.user?.isGM ? serialWrite(COUNTDOWNS_KEY, write) : write();
}

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
            // Shown only on a row that is no project, so its click is the system's whole write: in the queue (E37 C6).
            if (typeof click === "function") entry[clickKey] = function (...args) { return queuedCountdownWrite(() => click.apply(this, args)); };
        } else if (label === "CONTROLS.CommonDelete") {
            entry[clickKey] = function (event, target) {
                const element = target ?? (event instanceof HTMLElement ? event : null);
                const id = projectOf(element);
                if (id) return deleteProject(id);
                return typeof click === "function" ? queuedCountdownWrite(() => click.call(this, event, target)) : undefined;
            };
        }
        entry[MENU_DONE] = true;
    }
    return entries;
}

/* The mark on the wrapped `updateCountdowns`, registered so the contract register's probe (patches.mjs, "countdown-update") reads it. */
const UPDATE_DONE = Symbol.for("drpgCountdownUpdateQueued");

/**
 * The tray class's static `updateCountdowns`, wrapped once (E37 C6; at init when the system has set its class, else at
 * ready, as `wrapCountdownMenu`): on a GM's browser a step of `COUNTDOWNS_KEY`. Called as the class's method or read off
 * it and called bare (Daggerheart's dualityRoll.mjs destructures it), so the system's own runs with the class for
 * `this`. Exported for the suite, which wraps a model of the system's write with it (E37-T7). Answers whether it wrapped
 * now.
 */
export function wrapCountdownUpdate() {
    const Tray = game.system?.api?.applications?.ui?.DhCountdowns ?? CONFIG.ui?.countdowns ?? null;
    const own = typeof Tray === "function" ? Tray.updateCountdowns : null;
    if (typeof own !== "function" || own[UPDATE_DONE]) return false;
    const wrapped = function (...args) {
        return queuedCountdownWrite(() => own.apply(Tray, args));
    };
    wrapped[UPDATE_DONE] = true;
    Tray.updateCountdowns = wrapped;
    return true;
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

/**
 * THE MANAGER'S ROWS ON THE KIT'S `dataTable` (E47-C6, 09.11.2026; card M16, approved by the owner on 09.11 with O1a, O2b
 * and O3b). One row object per project - its cells by column key, `project` its id for the row's `data-project` - under a
 * group row per room (O3b: `{ group, count }`, the rooms in the order their first project comes, a project with no room
 * under "any room"). The cells are the ones the table drew before, in the columns `projectManagerColumns` names: the
 * portrait, the name and its progress, the room, the two flags, Edit (and Show on map), Delete, and a tick per player.
 * DELETE IS A BUTTON (the owner's M16 note: "chcialbym by delete juz nie bylo checkboxem, tylko przyciskiem" - I would
 * like Delete to be a button, not a checkbox): the kit's `iconButton` in the destructive role's colour, which asks the
 * project window's own delete question (`confirmProjectDelete`) and deletes on its yes; no `delete.<id>` box is read at
 * Save any more.
 */
function projectManagerRows(projects, rooms, { always = new Set(), players = playerList() } = {}) {
    const esc = foundry.utils.escapeHTML;
    const t = key => game.i18n.localize(key);
    const cells = p => {
        const secret = isSecret(p.id);
        const row = {
            project: p.id,
            portrait: `<img src="${esc(shownProjectImg(p.img))}" alt="" class="drpg-project-portrait"
                     data-drpg-portrait="${p.id}" data-tooltip="${t("DRPG.Project.changeImage")}" />
                <input type="hidden" name="img.${p.id}" value="${esc(p.img ?? "")}" />`,
            title: `${esc(p.name)}<br><small data-drpg-progress="${p.id}"
                >${projectLabel(p, { name: false })}</small>`,
            room: `<select name="room.${p.id}" aria-label="${rowName("DRPG.Project.room", p)}">${
                roomSelectOptions(rooms, roomOf(p.id) ?? "")}</select>`,
            murder: `<input type="checkbox" name="murder.${p.id}" aria-label="${rowName("DRPG.Project.indirect", p)}"
                       ${isIndirectMurder(p.id) ? "checked" : ""} />`,
            secret: `<input type="checkbox" name="secret.${p.id}" aria-label="${rowName("DRPG.Project.secret", p)}"
                       ${secret ? "checked" : ""}${always.has(p.id) ? " disabled" : ""} />`,
            edit: `<button type="button" class="drpg-mini-button" data-drpg-edit="${p.id}"
                        data-tooltip="${t("DRPG.Project.editTitle")}">
                    <i class="fa-solid fa-pen-to-square" inert></i>
                </button>${metaFor(p.id).mapHidden ? `<button type="button" class="drpg-mini-button" data-drpg-show-on-map="${p.id}"
                        aria-label="${rowName("DRPG.Project.showOnMap", p)}"
                        data-tooltip="${t("DRPG.Project.showOnMap")}">
                    <i class="fa-solid fa-map-location-dot" inert></i>
                </button>` : ""}`,
            delete: iconButton({ icon: "fa-solid fa-trash-can", label: `${t("DRPG.Project.delete")}: ${p.name}`, cls: "drpg-role-destructive",
                attrs: { "data-drpg-delete": p.id } })
        };
        if (players.length) Object.assign(row, viewerTicks(players, knownBy(p.id), p, { locked: !secret }));
        else row.viewers = `<small class="drpg-help">${t("DRPG.Project.noPlayers")}</small>`;
        return row;
    };
    const byRoom = new Map();
    for (const p of projects) {
        const room = roomOf(p.id) ?? "";
        if (!byRoom.has(room)) byRoom.set(room, []);
        byRoom.get(room).push(p);
    }
    return [...byRoom].flatMap(([room, list]) => [
        { group: room || t("DRPG.Project.anyRoom"), count: String(list.length) },
        ...list.map(cells)
    ]);
}

/**
 * The manager's columns, in the approved card's order (O2b: Edit and Delete after Secret, before the player columns, so
 * they stay in sight at sixteen players - E47-M's measure at 1366x768: the table 1496 px in a box of 1226 under Stained
 * Glass), and the head's two rows (O1a, dataTable `headGroups`): "Who knows about it" over the players' columns, each
 * player's name cut after two lines with the whole name in its title (`lines: 2`). With no player, one column for the
 * line that says so, and a head of one row.
 */
function projectManagerColumns(players) {
    const t = key => game.i18n.localize(key);
    const columns = [
        { key: "portrait", label: "", cls: "portrait" },
        { key: "title", label: t("DRPG.Project.title") },
        { key: "room", label: t("DRPG.Project.room") },
        { key: "murder", label: t("DRPG.Project.indirect"), cls: "check" },
        { key: "secret", label: t("DRPG.Project.secret"), cls: "check" },
        { key: "edit", label: t("DRPG.Project.edit"), cls: "act" },
        { key: "delete", label: t("DRPG.Project.delete"), cls: "act" },
        ...(players.length
            ? players.map(u => ({ key: `viewer-${u.id}`, label: u.name, lines: 2, cls: "viewer" }))
            : [{ key: "viewers", label: t("DRPG.Project.visibleTo") }])
    ];
    const headGroups = players.length ? [{ label: "", span: 7 }, { label: t("DRPG.Project.visibleTo"), span: players.length }] : null;
    return { columns, headGroups };
}

/**
 * The manager's body (E47-C6): the intro, the table and the two notes under it (the kit's fine print, the block centred
 * in the window as the intro is - the owner's 09.11 note on the mockup: "nie jest wysrodkowany ten tekst w menadzerze
 * projektow", the grey ink kept). Exported for the suite (R2076, R2077), which draws it from projects it makes up.
 */
export function projectManagerBody(projects, rooms, { always = new Set(), players = playerList() } = {}) {
    /* WHO KNOWS WHAT, AS A MATRIX (Dawid, 22.09: "gracze z dostepem do projects ... sa brzydko
       ulozeni - liczylem bardziej na cos przypominajacego tabele"). One column per player,
       named once in the header, and a tick in each row: a GM reads down a column to see what
       one player knows and across a row to see who knows one project. The names used to be
       repeated in every row as a wrapping run of labels, which at sixteen players was a
       paragraph per project and no two rows lined up. */
    const { columns, headGroups } = projectManagerColumns(players);
    return `<form>
            <p>${game.i18n.localize("DRPG.Project.manageIntro")}</p>
            ${dataTable({ columns, headGroups, rows: projectManagerRows(projects, rooms, { always, players }), rowAttrs: r => ({ "data-project": r.project }) })}
            <div class="drpg-project-notes">${helpText("DRPG.Project.secretNote")}${helpText("DRPG.Project.deleteNote")}</div>
        </form>`;
}

/**
 * The project window's delete question (E22; S09-24), asked by its Delete and by the manager's (E47-C6): destructive,
 * Cancel the default and the first submit button, so Enter deletes nothing (E22-T5). Answers true on the yes.
 */
async function confirmProjectDelete(project) {
    return drpgConfirm({
        yes: { role: "destructive", action: "delete", label: game.i18n.localize("DRPG.Project.delete") },
        classes: ["drpg-panel"],
        title: game.i18n.localize("DRPG.Project.delete"),
        body: `<p>${game.i18n.format("DRPG.Project.deleteConfirm", {
            name: foundry.utils.escapeHTML(project.name)
        })}</p>`,
        rejectClose: false
    });
}

/**
 * The manager's Delete buttons (E47-C6; the owner's M16 note): each asks `confirmProjectDelete` and, on its yes, deletes
 * the project (`deleteProject`, the write the Save made for a ticked box before), says so as the Save did, and takes the
 * rows of every project gone out of the window in place - a sabotage pair goes together (F5) - with a room's group row
 * when its last row went, the others' counts redrawn. In place, as Show on map: the GM's other changes in the window stay
 * for its Save. Exported for the suite (R2076), which presses one on a drawn body.
 */
export function wireManagerDeletes(root, projects = []) {
    for (const btn of root?.querySelectorAll?.("[data-drpg-delete]") ?? []) {
        btn.addEventListener("click", async ev => {
            ev.preventDefault();
            const id = btn.dataset.drpgDelete;
            const project = allProjects().find(p => p.id === id) ?? projects.find(p => p.id === id);
            if (!project) return;
            if (!(await confirmProjectDelete(project))) return;
            if (!(await deleteProject(project.id))) return;
            ui.notifications.info(game.i18n.format("DRPG.Project.savedWithDeletions", { n: 1 }));
            const alive = new Set(allProjects().map(p => p.id));
            for (const tr of root.querySelectorAll("tr[data-project]")) if (!alive.has(tr.dataset.project)) tr.remove();
            for (const group of root.querySelectorAll("tr.drpg-data-group")) {
                let n = 0;
                for (let tr = group.nextElementSibling; tr && !tr.classList.contains("drpg-data-group"); tr = tr.nextElementSibling) n += 1;
                if (!n) group.remove();
                else if (group.querySelector("th > span")) group.querySelector("th > span").textContent = String(n);
            }
        });
    }
}

/**
 * THE WIDTH OF THE CREATE, EDIT AND PROPOSE WINDOWS (E47-C6; the owner's O4, 09.11.2026: "O4a i b. Moze jako ustawienie
 * w panelu ustawien?", and its scope "Kazdy dla siebie" - each person their own): the client setting
 * `wideProjectWindows`, off by default. Off, the windows open at the width they had (no `width`: the module's popup
 * rules); on, at the kit's `wide` (ui-kit.mjs WINDOW_WIDTHS, 44rem). Read when a window opens.
 */
export function projectWindowWidth() {
    let wide = false;
    try { wide = Boolean(game.settings.get(MODULE_ID, SETTINGS.wideProjectWindows)); } catch { wide = false; }
    return wide ? "wide" : null;
}

/*
 * CORE'S HOURGLASS IS NOT A PROJECT'S PICTURE (E105 FT-13, the owner's 11.11.2026 "pozbyc sie [...] miejsc gdzie
 * przebija sie grafika [...] z foundry"). A project nobody gave a picture is stored with core's
 * icons/magic/time/hourglass-yellow-green.webp (the window's default since before 1.2.0, kept as the stored value so
 * nothing already written changes meaning), and the window and the manager drew that core file - or, for a project
 * stored with no picture, a broken image. Both now draw the module's own hourglass, icons/project-hourglass.svg (12 x
 * 12 in the item drawings' manner: ink #1a1620, Bone glass, sand #b8a68a; one file for both themes, as the item
 * drawings). Only what is drawn: the hidden field still holds - and Save still stores - exactly what it held, the file
 * browser opens on it, and a picture somebody chose is drawn as it is.
 *
 * utils.mjs `wirePortraitPickers` copies the hidden field into the picture on every rebuild (its F13 note), which would
 * put core's file back; `wireProjectPortraits` runs it and then draws the module's hourglass over a default field. A
 * GM who browses to core's hourglass on purpose sees it until the next rebuild, then the module's: the one picture
 * this cannot tell from no choice.
 */
const DEFAULT_PROJECT_IMG = "icons/magic/time/hourglass-yellow-green.webp";
const UNSET_PROJECT_IMG = `modules/${MODULE_ID}/icons/project-hourglass.svg`;
function shownProjectImg(img) {
    return !img || img === DEFAULT_PROJECT_IMG ? UNSET_PROJECT_IMG : img;
}

function wireProjectPortraits(root, options = {}) {
    wirePortraitPickers(root, options);
    for (const portrait of root.querySelectorAll("img[data-drpg-portrait]")) {
        const id = portrait.dataset.drpgPortrait || null;
        const field = root.querySelector(id ? `[name="img.${CSS.escape(id)}"]` : '[name="img"]');
        if (!field) continue;
        const shown = shownProjectImg(field.value);
        if (portrait.getAttribute("src") !== shown) portrait.setAttribute("src", shown);
    }
}

/** The portraits, the live progress figures, and the per-row edit buttons. */
function wireProjectManager(dialog, projects, rooms) {
    wireProjectPortraits(dialog.element);

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
    wireManagerDeletes(dialog.element, projects);
}

/**
 * Write every row back: image, room, the murder flag and secrecy. A row's Delete is its own button since E47-C6
 * (`wireManagerDeletes`), so nothing here deletes.
 */
async function applyProjectManager(result, projects) {
    // A row can be gone by the time the loop reaches it - deleted from this window's own Delete, or elsewhere while it
    // stood open (a sabotage pair goes together, F5). Asked of the world, not of the list the window opened with:
    // writing metadata for a deleted project leaves an orphan row.
    const exists = id => allProjects().some(p => p.id === id);
    for (const entry of result) {
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
    if (alreadyOpen("drpg-window-projects")) return RAISED;

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
    const content = projectManagerBody(projects, rooms, { always: await alwaysSecretIds(projects) });

    const result = await drpgWindow({
        title: game.i18n.localize("DRPG.Project.manageTitle"),
        classes: ["drpg-panel", "drpg-projects", "drpg-window-projects"],
        // On the kit's frame, as wide as its widest table (ui-kit.mjs `fitKitWidth`; utils.mjs `tableDialog` until E21 C2a).
        fit: true,
        // The matrix's ceiling, above the module's 1400 px: a column per player (ui-kit.mjs WINDOW_WIDTHS `matrix`; E21 W1).
        width: "matrix",
        body: content,
        // Save still to answer: Cancel (E21 rule 3), the answer "cancel" as before.
        footer: {
            primary: { action: "save", label: game.i18n.localize("DRPG.Assign.save"), callback: (e, b, d) => readManager(d, projects) },
            secondary: [
                { action: "new", label: game.i18n.localize("DRPG.Project.createButton") },
                { action: "share", label: game.i18n.localize("DRPG.Project.shareButton") }
            ],
            close: { role: "cancel", action: "cancel" }
        },
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

    await applyProjectManager(result, projects);

    ui.notifications.info(game.i18n.localize("DRPG.Project.saved"));
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
        ${helpText("DRPG.Project.glyphNote")}
    </details>`;
}

/**
 * The Statistic select's options for a project's form - the GM's editor here, and a
 * player's proposal (action-project.mjs `startProject`).
 *
 * A STATISTIC IS REQUIRED (E32+E07 C11d; the owner's rules of 28.09.2026). Both forms
 * offered "- player chooses -" until 1.2.66, and a roll on such a project let the
 * player pick. A project's roll - Work on it, or a Sabotage of it - takes the
 * project's statistic now, so a form has to name one. With none yet (a new project, or
 * one stored without) the placeholder ("- pick a statistic -" since E44 C4b, a bare "-" before) is disabled and selected: nothing is
 * guessed for the writer, and the form's own check refuses it ("DRPG.Project.traitRequired").
 */
export function projectTraitOptions(current = "") {
    return [
        emptyOption("DRPG.Project.pickTrait", { disabled: true, selected: !current }),
        ...Object.entries(TRAITS).map(([k, t]) =>
            `<option value="${k}"${k === current ? " selected" : ""}>${t.label}</option>`)
    ].join("");
}

/**
 * A PROJECT'S DESCRIPTION FIELD (E44 C9, 04.11.2026; the owner's ask and Q-C9-3: required, at most
 * PROJECT_DESCRIPTION_MAX characters). One textarea named `description` - the player's proposal (action-project.mjs
 * `startProject`) and this file's `openProjectDialog` - with no `maxlength`, which would cut a pasted text without a
 * word: a description too long is refused instead (`guardDescription`), with its length.
 * A ROW OF THE KIT'S `formGrid` SINCE E47-C6 (09.11.2026; cards M17-M19, approved): `{ label, id, field }`, its caption
 * in the label column, the textarea the field column's width and its note under it in the kit's fine print. Until then
 * a label of its own drawn as a column (`drpg-description-field`, E24 C6, the owner's A8 of 09.11.2026: as a row of
 * `.drpg-panel label` the textarea took 59 of 544 px; R1492 holds the width).
 */
export function descriptionField(value = "") {
    const esc = foundry.utils.escapeHTML;
    const id = `drpg-description-${foundry.utils.randomID(8)}`;
    return {
        label: game.i18n.localize("DRPG.Project.description"),
        id,
        field: `<textarea name="description" id="${id}" rows="4"
                          placeholder="${esc(game.i18n.localize("DRPG.Project.descriptionPlaceholder"))}">${esc(value ?? "")}</textarea>
                ${helpText("DRPG.Project.descriptionNote", { max: PROJECT_DESCRIPTION_MAX })}`
    };
}

/** The words of a description's problem (config.mjs `projectDescriptionProblem`), for the field and for a toast. */
export function descriptionRefusal(problem, text = "") {
    return problem === "long"
        ? game.i18n.format("DRPG.Project.descriptionTooLong", { max: PROJECT_DESCRIPTION_MAX, n: String(text ?? "").trim().length })
        : game.i18n.localize("DRPG.Project.descriptionNeeded");
}

/**
 * THE REFUSAL AT THE FIELD (E44 C9; Q-C9-3: "refused with words at the field"). Wired in a window's `render`, on the
 * window's own element: a press of the button whose action is `action` (and a submit it sends - a browser's Enter in a
 * field presses the first one) is stopped in the capture phase, before the window's own listeners hear it, while the
 * description is empty or too long; the sentence then stands under the field (`drpg-field-error`, `role="alert"`, the
 * field `aria-invalid` and pointing at it; since E47-C6 the kit's warning box, `box("warning")`, in the field's cell), the field takes the focus, and the window stays open with everything typed
 * in it, as Item tables' name field does (tables-editor.mjs `nameFieldHtml`). The sentence goes once the text is right.
 * Every other button - Close, Delete - goes through. `optional()` answers true where an empty one is allowed: the
 * proposal of a preset, which arrives filled with its own line (`startProject`). A window whose answer is read without
 * this guard - a console, the suite's answers - is refused by its caller after it closes (`projectDescriptionProblem`).
 * Measured headless on the harness's windows (R1350, E44-T20); at a table, LIVE-E44-20.
 */
export function guardDescription(root, action, { optional = () => false } = {}) {
    const field = root?.querySelector?.('textarea[name="description"]');
    if (!field) return;
    const id = `drpg-description-error-${foundry.utils.randomID(8)}`;
    const problem = () => (optional() && !field.value.trim() ? null : projectDescriptionProblem(field.value));
    const clear = () => {
        root.querySelector(`#${id}`)?.remove();
        field.removeAttribute("aria-invalid");
        field.removeAttribute("aria-describedby");
    };
    const say = why => {
        clear();
        const line = kitNode(box("warning", ""));
        line.id = id;
        line.classList.add("drpg-field-error");
        line.setAttribute("role", "alert");
        line.textContent = descriptionRefusal(why, field.value);
        line.dataset.why = why;
        // In the field's cell of the form's grid, after the field and its note (E47-C6); a field of a label of its own
        // (a window not on formGrid) has it after the label, as before.
        const cell = field.closest(".drpg-form-field");
        if (cell) cell.append(line);
        else (field.closest("label") ?? field).after(line);
        field.setAttribute("aria-invalid", "true");
        field.setAttribute("aria-describedby", id);
        field.focus();
    };
    const pressed = button => button?.dataset?.action === action;
    const stop = event => {
        const why = problem();
        if (!why) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        say(why);
    };
    root.addEventListener("click", event => {
        if (pressed(event.target?.closest?.("button[data-action]"))) stop(event);
    }, true);
    root.addEventListener("submit", event => {
        if (pressed(event.submitter)) stop(event);
    }, true);
    /* Once said, the sentence follows the text: gone once it is right, the other refusal's words when the text crosses
       from one to the other - not at every key, which would read an alert out again at each one (the count a too long
       one names is the one it had when it was said). */
    field.addEventListener("input", () => {
        const line = root.querySelector(`#${id}`);
        if (!line) return;
        const why = problem();
        if (!why) clear();
        else if (line.dataset.why !== why) {
            line.textContent = descriptionRefusal(why, field.value);
            line.dataset.why = why;
        }
    });
}

/**
 * A PRESET'S DESCRIPTION NAMES NO ROOM (E44 fix FG1, 05.11.2026; the end review's S-B1, C-M1 and G-m5). C9 let a preset
 * proposed with an empty field stand in with its summary line - "Secret Passage to {to}", "Seal the passage: {target}" -
 * and that line named the room beyond the wall, or a passage's two rooms, into projectMeta's description, a world
 * setting every browser holds; where a Secret Passage opens is exactly what projects-secrecy.mjs keeps in the GMs' half
 * (`target`, `passage`), and world-secrets.mjs forbids in projectMeta by key. So a preset's description is its own label
 * (`DRPG.Project.preset.<key>`: "Secret Passage", "Breach the Wall", "Seal the passage", "Close the breach", "Repair an
 * item"), which names no room, passage or item; the summary that names them stays on the proposal's card alone.
 */
export function presetDescription(key) {
    return key ? game.i18n.localize(`DRPG.Project.preset.${key}`) : "";
}

/**
 * THE PRESET'S LINE IN THE FIELD AS SOON AS IT IS CHOSEN (E44 fix FG1; G-m5: "the presets arrive filled with their own
 * summary line, editable" - the player saw nothing until the GM's window). Wired in the proposal's `render`, on the
 * window's own element: a change of the Kind select (`preset`) writes that preset's description into the field while the
 * field is untouched - empty, or still holding the line this wrote last - and the player's own words, once typed, stay
 * through any later change; back to "A project of your own" an untouched field empties again. The `input` it sends lets
 * `guardDescription`'s sentence follow. Measured on a form built in tier 1 (R1338).
 */
export function wirePresetDescription(root) {
    const kind = root?.querySelector?.('select[name="preset"]');
    const field = root?.querySelector?.('textarea[name="description"]');
    if (!kind || !field) return;
    let filled = "";
    kind.addEventListener("change", () => {
        if (field.value.trim() && field.value !== filled) return;
        filled = presetDescription(kind.value);
        field.value = filled;
        field.dispatchEvent(new Event("input", { bubbles: true }));
    });
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
    const defaultImg = DEFAULT_PROJECT_IMG;
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

    /* ON THE KIT'S `formGrid` (E47-C6, 09.11.2026; cards M17 and M18, approved by the owner on 09.11): each field that has a
       caption a row of the grid - its caption in the label column, the field and its note in the field column - and
       every other part a line across both, in the order they had (D31). The trap's fields a grid of their own inside the
       block Indirect murder shows (`data-drpg-when-murder`); "Which project" carries its `data-drpg-when-trigger` on both
       halves of its row (formGrid's row `attrs` since E47-KFa; projects-ui.mjs's `rowWhen` string-inserted it before). The notes are the kit's fine print, the warnings its warning box. */
    const t = key => game.i18n.localize(key);
    const esc = foundry.utils.escapeHTML;
    const uid = foundry.utils.randomID(6);
    const idOf = name => `drpg-project-${name}-${uid}`;
    const trapRows = formGrid([
        { label: t("DRPG.Trap.watchFor"), id: idOf("trigger"),
            field: `<select name="trigger" id="${idOf("trigger")}">${triggerOptions}</select>${helpText("DRPG.Trap.watchNote")}` },
        { label: t("DRPG.Trap.whichProject"), id: idOf("trigger-target"), attrs: { "data-drpg-when-trigger": "project sabotage" },
            field: `<select name="triggerTarget" id="${idOf("trigger-target")}">${emptyOption("DRPG.Trap.noProject")}${targetOptions}</select>` },
        { full: `<label class="drpg-checkbox">
                <input type="checkbox" name="afterDark"${
                    startTrigger?.afterDark ? " checked" : ""} /> ${
                    t("DRPG.Trap.afterDark")}</label>` },
        { full: `<label class="drpg-checkbox">
                <input type="checkbox" name="notBuilder"${
                    (startTrigger?.notBuilder ?? TRAP_MODIFIERS.notBuilder.default)
                        ? " checked" : ""} /> ${
                    t("DRPG.Trap.notBuilder")}</label>` },
        { label: t("DRPG.Project.condition"), id: idOf("condition"),
            field: `<input type="text" name="condition" id="${idOf("condition")}"
                       value="${esc(start?.condition ?? "")}"
                       placeholder="${t("DRPG.Project.conditionPlaceholder")}" />${helpText("DRPG.Project.conditionNote")}` }
    ]);

    const content = `<form>${formGrid([
        { full: `<div class="drpg-project-image-row">
                <img src="${esc(shownProjectImg(img))}" alt="" class="drpg-project-portrait"
                     data-drpg-portrait
                     data-tooltip="${t("DRPG.Project.changeImage")}" />
                <input type="hidden" name="img" value="${esc(img)}" />
                <label>${t("DRPG.Project.name")}
                    <input type="text" name="name" autofocus
                           value="${esc(start?.name ?? "")}"
                           placeholder="${t("DRPG.Project.namePlaceholder")}" /></label>
            </div>` },
        descriptionField(start?.description ?? ""),
        { full: glyphGrid(start?.glyph ?? null) },
        { label: t("DRPG.Project.scale"), id: idOf("target"), field: `<select name="target" id="${idOf("target")}">${offScale}${scaleOptions}</select>` },
        { label: t("DRPG.Project.room"), id: idOf("room"), field: `<select name="room" id="${idOf("room")}">${roomOptions}</select>` },
        { label: t("DRPG.Project.trait"), id: idOf("trait"), field: `<select name="trait" id="${idOf("trait")}" required>${traitOptions}</select>` },
        { full: `<label class="drpg-checkbox">
                <input type="checkbox" name="murder"${
                    start?.indirectMurder ? " checked" : ""} /> ${
                    t("DRPG.Project.indirect")}</label>` },
        { full: `<div class="drpg-trap-fields" data-drpg-when-murder>${trapRows}</div>` },
        ...(passageOf ? [{ full: passageFieldset(passageOf) }] : []),
        ...(ownedOf ? [{ full: ownedFieldset(ownedOf) }] : []),
        { full: `<label class="drpg-checkbox">
                <input type="checkbox" name="secret"${
                    (editing && isSecret(project.id)) || alwaysSecret ? " checked" : ""}${alwaysSecret ? " disabled" : ""} /> ${
                    t("DRPG.Project.secret")}</label>` },
        ...(players.length ? [{ full: `<fieldset class="drpg-viewer-list" data-drpg-when-secret>
                <legend>${t("DRPG.Project.visibleTo")}</legend>
                ${viewerBoxes(players, editing ? knownBy(project.id) : [], null, { locked: editing && !isSecret(project.id) })}
                <p class="drpg-help" data-drpg-viewer-note>${t(editing && !isSecret(project.id)
                    ? "DRPG.Project.everyone" : "DRPG.Project.visibleToNote")}</p>
            </fieldset>` }] : []),
        ...(editing ? [{ full: helpText("DRPG.Project.editProgressNote", { current: project.current, target: project.start }) }] : []),
        { full: helpText("DRPG.Project.createNote") }
    ])}</form>`;

    const save = {
        action: "save",
        label: game.i18n.localize(editing ? "DRPG.Assign.save" : "DRPG.Project.createButton"),
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
                passage: f.passage?.value || null,
                // As typed; judged below (E44 C9).
                description: d.element.querySelector('[name="description"]')?.value ?? ""
            };
        }
    };

    /* ON THE KIT (E21 C6a, E22; audit S09-24). Save (or Create) on the right, the default; Cancel on the left - the form's
       changes are withdrawn, so the role's word, not "Close" - answering "cancel" as before; Delete, in an edit, on the
       left with the destructive role: never the default, and its own question below has Cancel the default. */
    const result = await drpgWindow({
        title: game.i18n.localize(editing ? "DRPG.Project.editTitle" : "DRPG.Project.createTitle"),
        classes: ["drpg-panel", "drpg-project-form"],
        // Today's width, or the kit's `wide` where this person's setting asks for it (E47-C6; the owner's O4).
        width: projectWindowWidth(),
        body: content,
        footer: {
            primary: save,
            destructive: editing ? [{ action: "delete", label: game.i18n.localize("DRPG.Project.delete") }] : [],
            close: { role: "cancel", action: "cancel", callback: () => "cancel" }
        },
        // See wirePortraitPickers() - DialogV2 discards `content` and rebuilds
        // it from a string, so the picker has to be wired against the dialog's
        // real element once it exists, not against the div built above.
        render: (event, dialog) => {
            // Save refused at the field while the description is empty or too long (E44 C9); Delete and Close go.
            guardDescription(dialog.element, "save");
            wireProjectPortraits(dialog.element, { defaultImg });
            if (editing && !isSecret(project.id)) wireViewerLock(dialog.element);
            if (passageOf?.offer) wirePassagePick(dialog, passageOf.offer, { over: passageOf.preset === "breach" });
        },
        rejectClose: false
    });

    if (!result || result === "cancel") return null;

    if (result === "delete") {
        // Destructive (E22; S09-24): Cancel the default and the first submit button, so Enter deletes nothing (E22-T5).
        const sure = await confirmProjectDelete(project);
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
    /* REQUIRED IN THIS WINDOW, CREATE AND EDIT (E44 C9; Q-C9-3): an older project with none is asked for one here, the
       first time a GM opens its edit window; the guard said so at the field, and an answer read past it is refused. */
    const descriptionWhy = projectDescriptionProblem(result.description);
    if (descriptionWhy) {
        ui.notifications.warn(descriptionRefusal(descriptionWhy, result.description));
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
            description: result.description,
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
        const picked = await judgedPassagePick(passageOf, result);
        if (!picked) return null;
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
        description: result.description,
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

/**
 * The approval's pick judged as Create judges it (E15 part 2 C2; its own function since E68 C11, which judges a refused
 * completion's new pick the same way): the stretch the window holds (`result.passage`, JSON) on the wall between the
 * offer's room and the room beyond chosen (`result.passageTo`), and standing as the completion will ask
 * (passages-gm.mjs `builtPassageRow`, a breach's `breachStretchRow`: it may stand over a passage, never on a wall
 * breached already). The stretch, or null with the reason said.
 */
async function judgedPassagePick(passageOf, result) {
    let picked = null;
    try { picked = JSON.parse(result?.passage ?? "null"); } catch { picked = null; }
    const why = !passageOf.offer ? "DRPG.Project.passageNoWall"
        : !picked?.wallId ? "DRPG.Project.passageNeedsPick"
        : !passageOf.offer.neighbours.includes(result.passageTo) || !picked.rooms?.includes(passageOf.offer.from) || !picked.rooms?.includes(result.passageTo)
            ? "DRPG.Project.passageRefused" : null;
    const { builtPassageRow, breachStretchRow, whyText } = await import("./passages-gm.mjs");
    const judged = why ? null : (passageOf.preset === "breach" ? breachStretchRow(picked) : builtPassageRow(picked));
    if (why || !judged?.row) {
        // The stretch's own reason, in the table's language (fix e1-G4): a whole wall, a door, a breached wall.
        ui.notifications.warn(why ? game.i18n.localize(why) : game.i18n.format("DRPG.Project.presetRefused", { why: whyText(judged?.refused) }));
        return null;
    }
    return picked;
}

/**
 * "CHOOSE THE TARGET AGAIN" (E68 C11, 10.11.2026; D023, the owner's default). A Secret Passage's or a breach's completion
 * the primary refused (projects.mjs `heldForRepick`) is picked again here, on the GM whose card's button was pressed: the
 * approval's own box and pick (`passageFieldset`, `wirePassagePick`) on the wall of the room the refused stretch stood
 * in - the project's room, where the approval read the builder - on its scene and floor, the room beyond the one it named
 * first, judged as Create judges it (`judgedPassagePick`), then made on the primary as the change `{ repick }`, which
 * crosses the completion again. The window closed, or a pick refused, leaves the card open. Answers the step's result
 * when the target was taken, else null.
 */
export async function openTargetRepick(projectId) {
    if (!game.user?.isGM) return null;
    const project = allProjects().find(p => p.id === projectId) ?? null;
    const held = project ? secretsOf(projectId) : {};
    const preset = held.target?.preset;
    const name = project?.name ?? "";
    const gone = () => {
        ui.notifications.warn(game.i18n.format("DRPG.Passage.card.repickGone", { name }));
        return null;
    };
    if (!project || !held.repick || !["secretPassage", "breach"].includes(preset)) return gone();
    const passageOf = await repickApproval(held);
    const result = await drpgWindow({
        title: game.i18n.format("DRPG.Passage.card.repickTitle", { name }),
        classes: ["drpg-panel", "drpg-project-repick"],
        width: projectWindowWidth(),
        body: `<form>${helpText("DRPG.Passage.card.repickIntro", { name })}${passageFieldset(passageOf)}</form>`,
        footer: {
            primary: { action: "repick", label: game.i18n.localize("DRPG.Passage.card.repick"), callback: (e, b, d) => {
                const f = d.element.querySelector("form");
                return { passageTo: f?.passageTo?.value || null, passage: f?.passage?.value || null };
            } },
            close: { role: "cancel", action: "cancel", callback: () => "cancel" }
        },
        render: (event, dialog) => {
            if (passageOf.offer) wirePassagePick(dialog, passageOf.offer, { over: preset === "breach" });
        },
        rejectClose: false
    });
    if (!result || result === "cancel") return null;
    const picked = await judgedPassagePick(passageOf, result);
    if (!picked) return null;
    const done = await applyProjectChange(projectId, { repick: { passage: picked, room: result.passageTo } }, { by: { kind: "gm" } });
    return done?.changed ? done : gone();
}

/**
 * The repick's offer (`openTargetRepick`): the room of the refused stretch that is not the room beyond it named, on that
 * stretch's scene and floor (passages-gm.mjs `secretPassageOffer`, as `passageApproval` reads it from where the builder
 * stood), the room beyond it named chosen first.
 */
async function repickApproval(held) {
    const was = held.passage ?? {};
    const scene = game.scenes.get(was.sceneId ?? "") ?? null;
    const room = (was.rooms ?? []).find(each => each !== held.target?.room) ?? null;
    const { secretPassageOffer } = await import("./passages-gm.mjs");
    const offer = scene && room ? secretPassageOffer({ scene, room, level: was.level ?? null }) : null;
    const to = held.target?.room ?? null;
    return { offer, preset: held.target.preset, to: offer?.neighbours.includes(to) ? to : offer?.neighbours[0] ?? null };
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
        <p class="drpg-help">${esc(label)}</p>${refused ? `
        ${box("warning", esc(game.i18n.format("DRPG.Project.presetRefused", { why: why ?? "" })))}` : ""}</fieldset>`;
}

/** The approval window's Secret Passage box: the builder's room, the room beyond, the pick and what it picked. */
function passageFieldset({ offer, to, preset = "secretPassage" }) {
    const esc = text => foundry.utils.escapeHTML(String(text ?? ""));
    const t = key => game.i18n.localize(key);
    const legend = esc(t(`DRPG.Project.preset.${preset}`));
    if (!offer) return `<fieldset class="drpg-passage-preset"><legend>${legend}</legend>
        ${box("warning", esc(t("DRPG.Project.passageNoWall")))}</fieldset>`;
    return `<fieldset class="drpg-passage-preset" data-drpg-passage-preset><legend>${legend}</legend>
        ${helpText("DRPG.Project.passageFrom", { room: offer.from })}
        <label>${esc(t("DRPG.Project.passageTo"))}
            <select name="passageTo">${offer.neighbours.map(r => `<option value="${esc(r)}"${r === to ? " selected" : ""}>${esc(r)}</option>`).join("")}</select></label>
        <button type="button" class="drpg-mini-button" data-drpg-passage-pick>${esc(t("DRPG.Project.passagePick"))}</button>
        <input type="hidden" name="passage" value="" />
        <p class="drpg-help" data-drpg-passage-picked>${esc(t("DRPG.Project.passageNone"))}</p></fieldset>`;
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
            : null
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

/** One cell per player for the manager's matrix - see `projectManagerBody` - by its column's key (`viewer-<user id>`,
    `projectManagerColumns`). The checkbox keeps the name `viewerBoxes` gives it, so `readManager` reads both the same way. */
function viewerTicks(players, checked, project, { locked = false } = {}) {
    const known = new Set(checked);
    const lock = locked ? ` disabled data-tooltip="${foundry.utils.escapeHTML(game.i18n.localize("DRPG.Project.everyone"))}"` : "";
    return Object.fromEntries(players.map(user => [`viewer-${user.id}`,
        `<input type="checkbox" name="viewers.${project.id}" value="${user.id}"${known.has(user.id) ? " checked" : ""}${lock}
               aria-label="${foundry.utils.escapeHTML(`${user.name}: ${project.name}`)}" />`]));
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

    /* ON THE KIT (E21 C6a, E22; audit S09-24). Share on the right, the default; Revoke access on the left with the
       destructive role, never the default, so Enter shares and revokes nobody (E22-T5); Cancel on the left, answering
       "cancel" as before ("Close" until C6a: nothing is given or taken away). */
    const read = (d, revoke) => ({
        project: d.element.querySelector("[name=project]").value,
        player: d.element.querySelector("[name=player]").value,
        revoke
    });
    const result = await drpgWindow({
        title: game.i18n.localize("DRPG.Project.shareTitle"),
        classes: ["drpg-panel"],
        body: `<form>
            <p>${game.i18n.localize("DRPG.Project.shareIntro")}</p>
            <label>${game.i18n.localize("DRPG.Project.title")}
                <select name="project">${projectOptions}</select></label>
            <label>${game.i18n.localize("DRPG.Project.player")}
                <select name="player">${playerOptions}</select></label>
        </form>`,
        footer: {
            primary: { action: "share", label: game.i18n.localize("DRPG.Project.shareButton"), callback: (e, b, d) => read(d, false) },
            destructive: [{ action: "revoke", label: game.i18n.localize("DRPG.Project.revokeButton"), callback: (e, b, d) => read(d, true) }],
            close: { role: "cancel", action: "cancel", callback: () => "cancel" }
        },
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
