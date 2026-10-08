/**
 * Danganronpa RPG - the project tray, drawn.
 * ---------------------------------------------------------------------------
 * What happens to Daggerheart's countdown tray on every render, in every
 * browser: the Icon Only view left (`leaveIconOnly`), the system's raw keys
 * localised (`localiseRawKeys`), the rows of projects this user has not found
 * taken out (`hideUndiscovered`), the progress painted (`paintProgress`), the
 * fold control and its state (`addCollapseControl`, `applyCollapsed`), and the
 * redraw sync.mjs asks for (`refreshProjects`). What it does not hold: the
 * render hook that calls them, the GM's gear, the manager, the project dialog
 * and the sharing window (projects-ui.mjs), and every rule about projects
 * (projects.mjs).
 *
 * WHERE IT SITS. Moved out of projects-ui.mjs by E34 (1.2.70), a pure move that
 * `node tools/moved-only.mjs` proves line by line. The file above it is
 * projects-ui.mjs, which re-exports `refreshProjects` and `hideUndiscovered` -
 * the two names here it exported before (sync.mjs and tier 2 read them through
 * it) - and nothing here imports it back: R161 counts an `export ... from` as an
 * edge, and the import would close a cycle. That is why the render hook,
 * `onRenderCountdowns`, stays above: it opens the manager. Below it are
 * config.mjs, settings.mjs and utils.mjs, and projects.mjs - another family's
 * facade, read for `allProjects` and `knowsProject`, which reaches neither UI
 * file. Five names are exported that were not (`leaveIconOnly`,
 * `localiseRawKeys`, `paintProgress`, `applyCollapsed`, `addCollapseControl`),
 * because the render hook calls them; projects-ui.mjs does not re-export them.
 * No module state: the fold is a client setting.
 */

import { MODULE_ID, isProjectGlyph } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { allProjects, knowsProject } from "./projects.mjs";
import { error } from "./utils.mjs";

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
export function leaveIconOnly(app, root) {
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
export function localiseRawKeys(root) {
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
 * tray's own count, and the render hook (projects-ui.mjs) already removes
 * system-owned controls on every render for the same reason.
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
export function paintProgress(root) {
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

export function applyCollapsed(root) {
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

export function addCollapseControl(root) {
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
