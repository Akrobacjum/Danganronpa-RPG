/**
 * Danganronpa RPG — the window that stays the size you left it.
 * ---------------------------------------------------------------------------
 * Foundry collapses a window to its title bar when the header is
 * double-clicked. At this table that gesture is only ever an accident
 * (Dawid, 26.08): a hurried second press on a title while dragging a sheet
 * or reaching for the close button, and suddenly the character sheet is a
 * strip of text and the player is looking for what they did wrong. Nothing
 * in the module's own flow ever wants a minimized window.
 *
 * So the gesture is blocked — at the WINDOW level, in the capture phase,
 * which runs before the handler Foundry attached to the header can hear the
 * event. That reaches every window frame in the client (ApplicationV2 and
 * the odd legacy AppV1 another module might still ship) without touching
 * anybody's prototypes.
 *
 * THE ONE EXCEPTION: a window that is ALREADY minimized keeps its
 * double-click, because that is the only gesture that restores one. Another
 * module minimizing windows programmatically must not leave the user with a
 * title bar nothing can reopen.
 */

import { MODULE_ID } from "./config.mjs";
import { log } from "./utils.mjs";

/** The application the clicked header belongs to, across both frameworks. */
function appOf(header) {
    const frame = header.closest(".application, .window-app");
    if (!frame) return null;
    return foundry.applications.instances.get(frame.id)
        ?? ui.windows?.[frame.dataset?.appid]
        ?? null;
}

export function registerNoCollapse() {
    window.addEventListener("dblclick", event => {
        const header = event.target?.closest?.(".window-header");
        if (!header) return;

        const app = appOf(header);
        if (!app) return;
        // Restoring a minimized window is the exception — see the header note.
        if (app.minimized) return;

        event.preventDefault();
        event.stopImmediatePropagation();
    }, { capture: true });

    log(`${MODULE_ID}: double-clicking a window title no longer collapses it.`);
}
