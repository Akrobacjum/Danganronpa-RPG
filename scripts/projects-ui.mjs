/**
 * Danganronpa RPG - project UI.
 * ---------------------------------------------------------------------------
 * Countdowns are projects in this game, so the sidebar list gets a heading that
 * says so, and each project gains the two things Daggerheart has no concept of:
 * the room it belongs to, and who is allowed to know it exists.
 */

import { MODULE_ID, PROJECT_SCALE, PROJECT_GLYPHS, isProjectGlyph, TRAITS, TRAP_TRIGGERS, TRAP_MODIFIERS } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import {
    allProjects, setProjectMeta, metaFor, roomOf, isIndirectMurder, isSecret,
    makeSecret, shareWith, unshareWith, revealProject, viewersOf, sealAudience, builderIds,
    createProject, deleteProject, setProjectImage, updateProject, knowsProject
} from "./projects.mjs";
import { allRooms } from "./movement.mjs";
import { dialogContent, error, tableDialog, wirePortraitPickers } from "./utils.mjs";
import { alreadyOpen, keepFresh } from "./live.mjs";

const DialogV2 = foundry.applications.api.DialogV2;

export function registerProjectsUi() {
    // The countdown tray is its own ApplicationV2; label it on every render.
    Hooks.on("renderDhCountdowns", onRenderCountdowns);
}

/**
 * Redraw the project tray on this client.
 *
 * Daggerheart redraws the tray from its own settings `onChange`, which covers
 * progress. What it does not cover is our metadata - a project's room, its
 * secrecy, whether it is frozen - because that lives in a separate world
 * setting the system knows nothing about. A change to either has to reach every
 * client, so sync.mjs calls this.
 */
export function refreshProjects() {
    try {
        // The global `ui`, not `foundry.ui`.
        //
        // `foundry.ui` is a one-time spread of the ui module's exports taken at
        // load time - a dead snapshot, not the live registry. Daggerheart
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
    try {
        const root = element instanceof HTMLElement ? element : element?.[0];
        if (!root) return;

        // Shown to everyone, GM or not, so removed for everyone.
        root.querySelector(".header-type-toggles")?.remove();
        root.querySelector('[data-action="toggleViewMode"]')?.remove();
        leaveIconOnly(app, root);

        localiseRawKeys(root);
        hideUndiscovered(root);
        paintProgress(root);

        // Folding the tray away is everybody's, not the GM's - a player with
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
 * Nobody is left standing in a room whose door has just been removed.
 *
 * "Toggle Icon Only" swaps every project for a bare icon - a row of little
 * hourglasses with no name and no progress, which in this module is a tray of
 * things you cannot tell apart. It is gone (above), and that is the whole of
 * the change EXCEPT for one thing: the system remembers the choice in a user
 * flag, so anyone who had already flipped it would have been shut in there
 * with no control left to flip it back.
 *
 * So the flag is put back the one time it is found set, per person, on their
 * own User. Read from CONFIG rather than written out here, so a system that
 * renames its flag or its modes turns this into a no-op instead of a wrong
 * write.
 *
 * The re-render is not optional and was measured being needed: the names are
 * left out by the TEMPLATE, `{{#unless iconOnly}}`, so this pass is already
 * looking at markup that has none - dropping the class and writing the flag
 * left a player staring at a tray of bare numbers until something else
 * happened to redraw it. Rendering from inside a render hook is safe here
 * because the flag is textIcon by the time the new pass reads it, so the
 * second pass does nothing and there is no third.
 */
function leaveIconOnly(app, root) {
    const id = CONFIG?.DH?.id;
    const key = CONFIG?.DH?.FLAGS?.userFlags?.countdownMode;
    const modes = CONFIG?.DH?.GENERAL?.countdownAppMode;
    if (!id || !key || !modes?.textIcon || !modes?.iconOnly) return;
    if (game.user.getFlag(id, key) !== modes.iconOnly) return;

    root.classList.remove(modes.iconOnly);
    game.user.setFlag(id, key, modes.textIcon)
        .then(() => app?.render?.())
        .catch(err => error("Could not take the projects tray out of icon-only view", err));
}

/**
 * Translate labels the system left as raw keys.
 *
 * The tray's own view-mode control announces itself as
 * "DAGGERHEART.UI.Countdowns.toggleIconMode" - the key exists and resolves to
 * "Toggle Icon Only", the system simply does not localise it when it builds
 * the header. A screen reader reads the key aloud, and it surfaces as a
 * tooltip. Reported as B-F5-2.
 *
 * Repaired here because this module already relabels this window on every
 * render, and the tray rebuilds its header from scratch each time - the same
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

/**
 * ROWS FOR PROJECTS THIS PERSON HAS NOT FOUND YET ARE NOT DRAWN.
 *
 * The tray is Daggerheart's, and the system decides what reaches it from the
 * countdown's own ownership - which is the secrecy gate and nothing else. A
 * PUBLIC project in a room nobody has walked into is, as far as the system is
 * concerned, everybody's business, so its row was in the tray from the moment
 * the GM made it: the class could read off a list of what the season had in
 * store for them, in order, before setting foot anywhere.
 *
 * So the row goes, on the same terms the map token goes (visibility.mjs): one
 * rule, `knowsProject`, asked per client. Removed rather than hidden with a
 * class - a hidden row is still in the accessibility tree and still in the
 * tray's own count, and this file already removes system-owned controls on
 * every render for the same reason.
 *
 * FAILING OPEN IS DELIBERATE, twice over:
 *   - a row this pass cannot resolve to a project stays, because it may not be
 *     one of ours at all (a countdown built in Daggerheart's own window);
 *   - `knowsProject` answers true for a GM, for anyone in on a secret one, and
 *     for any project with no room set, so those rows are never candidates.
 * The only row this can ever take out is a public, room-bound project on a
 * player's client, which is exactly the case it was written for.
 *
 * Runs BEFORE `paintProgress`, so the paint pass is not measuring and styling
 * rows that are about to be thrown away.
 *
 * Exported, and takes the reader as an argument, for one reason: the suite runs
 * as a GM, and a function whose first line is "a GM sees everything" cannot be
 * tested by one. The default is the only value the render hook ever passes.
 *
 * @returns {number} how many rows were taken out - the suite's measurement.
 */
export function hideUndiscovered(root, user = game.user) {
    if (user?.isGM) return 0;

    const rows = root.querySelectorAll(".countdown-container");
    if (!rows.length) return 0;
    const projects = allProjects();

    let removed = 0;
    for (const row of rows) {
        const project = projectForRow(row, projects);
        if (!project) continue;
        if (knowsProject(project.id, user)) continue;
        row.remove();
        removed += 1;
    }
    return removed;
}

/**
 * How full each project is, written on its row as `--w` for the theme's bar,
 * and WHICH GLYPH the row is drawn with, as `--drpg-project-glyph`.
 *
 * Neither number is a thing a stylesheet can read: the share lives in a text
 * node ("2 / 4") and the glyph lives in our own world setting, which the
 * system knows nothing about - so both are written here, on every render, as
 * custom properties the theme's rules read.
 *
 * The share is read off the tag the system rendered, which is what the player
 * sees and therefore what the bar must agree with; when the tag says something
 * else, the project's own record.
 *
 * The glyph is a REFERENCE, `var(--drpg-px-key)`, not the sprite itself: the
 * tokens sit on the body under Stained Glass and a row inherits them, so one
 * copy of each sprite serves every row. A row whose project has no glyph has
 * the property REMOVED rather than set to the hourglass - the rule's own
 * `var(..., var(--drpg-px-hourglass))` fallback is the single place the
 * default is named.
 *
 * `allProjects()` is read once per render and only when there is something to
 * paint: it is eight metadata reads per project (projects.mjs), and this runs
 * on every client every time a countdown moves.
 */
function paintProgress(root) {
    const rows = root.querySelectorAll(".countdown-container");
    if (!rows.length) return;
    const projects = allProjects();

    for (const row of rows) {
        const project = projectForRow(row, projects);

        const tag = row.querySelector(".progress-tag")?.textContent ?? "";
        const m = tag.match(/(\d+)\s*\/\s*(\d+)/);
        let share = m && Number(m[2]) > 0 ? Number(m[1]) / Number(m[2]) : null;
        if (share === null && project && project.start > 0) share = project.current / project.start;

        if (share === null) row.style.removeProperty("--w");
        else row.style.setProperty("--w", `${Math.round(Math.max(0, Math.min(1, share)) * 100)}%`);

        // Gated again here, cheaply: this string is being written into CSS, and
        // an unknown name makes the whole `mask` shorthand invalid at
        // computed-value time - which is not "no glyph" but an UNMASKED box,
        // i.e. a solid block of the state colour on the row.
        if (isProjectGlyph(project?.glyph)) {
            row.style.setProperty("--drpg-project-glyph",
                `var(--drpg-px-${project.glyph}, var(--drpg-px-hourglass))`);
        } else {
            row.style.removeProperty("--drpg-project-glyph");
        }
    }
}

/**
 * Which project is this row?
 *
 * By id when the system gives us one, by the name it rendered otherwise -
 * which is what the share above has always fallen back to. The id attribute is
 * read through three spellings and none is required, because it is
 * Daggerheart's markup and not ours.
 */
function projectForRow(row, projects) {
    const id = row.dataset.countdown ?? row.dataset.countdownId ?? row.dataset.id ?? null;
    if (id) {
        const byId = projects.find(p => p.id === id);
        if (byId) return byId;
    }
    const name = row.querySelector(".countdown-content > header")?.textContent?.trim();
    return name ? projects.find(p => p.name === name) ?? null : null;
}

/* ==========================================================================
 * FOLDING THE TRAY AWAY
 * --------------------------------------------------------------------------
 * The tray has no collapse of its own. Daggerheart's one header control was
 * `toggleViewMode`, which swapped the rows for a row of icons - a different
 * thing, which left the tray exactly as tall, and which is no longer there.
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
    // thing - one changes what you are looking at, the other opens a window.
    host.prepend(button);
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
 * One window for everything: create a project, set its room, mark it as an
 * indirect murder, control who can see it, and share or revoke access. Having
 * creation in one dialog and editing in another meant a new project always
 * needed two trips.
 */
/** One editable row per project: portrait, name and progress, room, the two flags, edit, delete. */
function projectManagerRows(projects, rooms) {
    const roomOptions = id => [
        `<option value="">${game.i18n.localize("DRPG.Project.anyRoom")}</option>`,
        ...rooms.map(r => `<option value="${foundry.utils.escapeHTML(r)}"${roomOf(id) === r ? " selected" : ""}>${foundry.utils.escapeHTML(r)}</option>`)
    ].join("");

    const players = playerList();
    return projects.map(p => {
        const secret = isSecret(p.id);
        const knows = viewersOf(p.id).map(u => u.id);
        return `<tr data-project="${p.id}">
            <td>
                <img src="${foundry.utils.escapeHTML(p.img ?? "")}" alt="" class="drpg-project-portrait"
                     data-drpg-portrait="${p.id}" data-tooltip="${game.i18n.localize("DRPG.Project.changeImage")}" />
                <input type="hidden" name="img.${p.id}" value="${foundry.utils.escapeHTML(p.img ?? "")}" />
            </td>
            <td>${foundry.utils.escapeHTML(p.name)}<br><small data-drpg-progress="${p.id}"
                >${p.current}/${p.start}</small></td>
            <td><select name="room.${p.id}" aria-label="${rowName("DRPG.Project.room", p)}">${
                roomOptions(p.id)}</select></td>
            <td style="text-align:center">
                <input type="checkbox" name="murder.${p.id}" aria-label="${rowName("DRPG.Project.indirect", p)}"
                       ${isIndirectMurder(p.id) ? "checked" : ""} />
            </td>
            <td style="text-align:center">
                <input type="checkbox" name="secret.${p.id}" aria-label="${rowName("DRPG.Project.secret", p)}"
                       ${secret ? "checked" : ""} />
            </td>
            ${players.length
                ? viewerTicks(players, knows, p)
                : `<td><small class="notes">${game.i18n.localize("DRPG.Project.noPlayers")}</small></td>`}
            <td style="text-align:center">
                <button type="button" class="drpg-mini-button" data-drpg-edit="${p.id}"
                        data-tooltip="${game.i18n.localize("DRPG.Project.editTitle")}">
                    <i class="fa-solid fa-pen-to-square" inert></i>
                </button>
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
                const text = `${project.current}/${project.start}`;
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
        if (entry.img && entry.img !== before?.img) await setProjectImage(entry.id, entry.img);

        // A project that has only just been marked as an indirect murder is
        // sealed with it - that is the default the guide wants, and the box in
        // this row was rendered before the GM ticked "indirect".
        const newlyMurder = entry.murder && !isIndirectMurder(entry.id);
        // A tick with nobody behind it arms nothing (ITEM-14): the row's
        // "Indirect" box is refused, with a reason, until the project has a
        // killer - the edit dialog is where one is named.
        if (newlyMurder) {
            const meta = metaFor(entry.id);
            if (!meta.killerId && !meta.by) {
                ui.notifications.warn(game.i18n.format("DRPG.Project.needsKillerNamed", { name: before?.name ?? "?" }));
                await setProjectMeta(entry.id, { room: entry.room || null });
                continue;
            }
        }
        await setProjectMeta(entry.id, { room: entry.room || null, indirectMurder: entry.murder });

        // After that first moment the checkbox is simply the answer.
        //
        // This used to read `entry.secretTouched`, a field `readManager` has
        // never returned - so it was permanently `undefined`, "is it secret"
        // came out as `secret || murder`, and an indirect murder flipped between
        // sealed and revealed on every other save.
        const shouldBeSecret = entry.secret || newlyMurder;
        // Through applySecrecy, which knows about the row's own ticked list of
        // viewers (P-1) and about the builder; `entry.viewers` is null when this
        // window had no list to read, and then the seal keeps whoever already knew.
        await applySecrecy(entry.id, shouldBeSecret, entry.viewers);
    }
    return deleted;
}

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
    const rooms = allRooms();

    // No projects yet? Go straight to creating one.
    if (!projects.length) {
        const made = await openCreateDialog(rooms);
        return made ? openProjectManager() : undefined;
    }
    const rows = projectManagerRows(projects, rooms);
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
                    <th${two}>${game.i18n.localize("DRPG.Project.indirect")}</th>
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
                s.label} - ${s.progress} progress</option>`;
        }).join("");

    // An edited project may sit on a target no scale names - a repair inherits
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

    const players = playerList();

    const traitOptions = [
        `<option value=""${currentTrait ? "" : " selected"}>${
            game.i18n.localize("DRPG.Project.anyTrait")}</option>`,
        ...Object.entries(TRAITS).map(([k, t]) =>
            `<option value="${k}"${k === currentTrait ? " selected" : ""}>${t.label}</option>`)
    ].join("");

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
    // Off the META, not off `start`: `allProjects()` returns the countdown plus
    // the handful of fields the tray needs, and the trigger is not one of them.
    // Reading it from the wrong place would silently reset every trap's trigger
    // to "manual" the first time a GM opened its project to change the name.
    const startTrigger = (editing ? metaFor(project.id)?.trigger : start?.trigger) ?? null;
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
                <select name="trait">${traitOptions}</select></label>
            <label class="drpg-checkbox">
                <input type="checkbox" name="murder"${
                    start?.indirectMurder ? " checked" : ""} /> ${
                    game.i18n.localize("DRPG.Project.indirect")}</label>
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
            <label class="drpg-checkbox">
                <input type="checkbox" name="secret"${
                    editing && isSecret(project.id) ? " checked" : ""} /> ${
                    game.i18n.localize("DRPG.Project.secret")}</label>
            ${players.length ? `<fieldset class="drpg-viewer-list">
                <legend>${game.i18n.localize("DRPG.Project.visibleTo")}</legend>
                ${viewerBoxes(players, editing ? viewersOf(project.id).map(u => u.id) : [])}
                <small class="notes">${game.i18n.localize("DRPG.Project.visibleToNote")}</small>
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
                    img: f.img.value || null,
                    // A RadioNodeList's `.value` is the checked one, and the
                    // default cell's value is "" - so an untouched grid reads
                    // as "no choice" and the tray's own fallback names the
                    // hourglass, in one place.
                    glyph: f.glyph?.value || null
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
        });
        await applySecrecy(project.id, result.secret || result.murder, result.viewers);
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

    const created = await createProject({
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

/** Keep the ownership map in step with one boolean. */
async function applySecrecy(id, wanted, viewers = null) {
    /*
     * A TICKED LIST IS AN ANSWER, NOT AN ADDITION (P-1, Dawid 18.09).
     *
     * With no list - the old callers, and the manager rows of a world with no
     * players - secrecy follows `sealAudience`, which keeps whoever already knew
     * and the builder. With a list, that list IS who knows: unticking somebody
     * takes them off. The builder is added either way, because a seal that shuts
     * the person building it out is F3 coming back.
     */
    const audience = viewers ? [...new Set([...viewers, ...builderIds(id)])] : sealAudience(id);
    if (wanted) {
        // Re-sealed when the list moved even if the checkbox did not - and not
        // written when neither did: a Save that changes nothing must not rewrite
        // the ownership of every secret project at the table.
        const now = new Set(viewersOf(id).map(u => u.id));
        const same = isSecret(id) && now.size === audience.length
            && audience.every(userId => now.has(userId));
        if (!same) await makeSecret(id, audience);
        return;
    }
    if (isSecret(id)) await revealProject(id);
}

/** Kept as its own name - the manager and the empty state both call it. */
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
        // Who the GM says knows about it, for the rows where that list is shown
        // (P-1). `null` when this window had no list to read, so a save cannot
        // mistake "no checkboxes here" for "nobody knows".
        viewers: form.querySelector(`[name="viewers.${p.id}"]`)
            ? [...form.querySelectorAll(`[name="viewers.${p.id}"]:checked`)].map(box => box.value)
            : null,
        delete: form.querySelector(`[name="delete.${p.id}"]`)?.checked ?? false
    }));
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
/** Every player, in the order a reader counts them: "Player 2" before "Player 10". The
    matrix's header and its rows ask separately, so they must get the same order. */
function playerList() {
    return game.users.filter(u => !u.isGM)
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
}

/** One cell per player for the manager's matrix - see `openProjectManager`. The checkbox
    keeps the name `viewerBoxes` gives it, so `readManager` reads both the same way. */
function viewerTicks(players, checked, project) {
    const known = new Set(checked);
    return players.map(user => `<td class="drpg-viewer-tick">
        <input type="checkbox" name="viewers.${project.id}" value="${user.id}"${known.has(user.id) ? " checked" : ""}
               aria-label="${foundry.utils.escapeHTML(`${user.name}: ${project.name}`)}" /></td>`).join("");
}

function viewerBoxes(players, checked, projectId = null) {
    const name = projectId ? `viewers.${projectId}` : "viewers";
    const known = new Set(checked);
    return players.map(user => `<label class="drpg-inline-check">
        <input type="checkbox" name="${name}" value="${user.id}"${known.has(user.id) ? " checked" : ""} />
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

    if (result.revoke) await unshareWith(result.project, result.player);
    else await shareWith(result.project, result.player);

    ui.notifications.info(game.i18n.localize(result.revoke ? "DRPG.Project.revoked" : "DRPG.Project.shared"));
}
