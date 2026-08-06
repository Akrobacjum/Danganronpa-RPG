/**
 * Danganronpa RPG — players do not edit their own numbers.
 * ---------------------------------------------------------------------------
 * In a killing game the sheet is not a scratchpad. Actions, Hope and traits
 * change because something happened — a roll landed, an action was spent, an
 * advancement was earned — not because a player clicked a pip.
 *
 * So those fields become read-only for players and writable only by the GM or
 * by this module's own automation. HP and Stress stay editable: players mark
 * their own damage constantly and the guide expects that.
 *
 * Automation marks its own writes with a flag in the update options, which is
 * how a legitimate change is told apart from someone poking the sheet.
 */

import { MODULE_ID, ACTIONS_RESOURCE } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { debug } from "./utils.mjs";

/** Put this in an update's options to mark it as automation, not hand-editing. */
export const SYSTEM_WRITE = "drpgAutomated";

/**
 * Paths players may not set by hand.
 *
 * `hope.value` is deliberately NOT here. Daggerheart's own roll pipeline awards
 * Hope with a plain `actor.update()` carrying none of our flags, so guarding it
 * blocked every Hope a player earned from rolling — the resource simply never
 * moved. Hope is protected in the interface instead: the pips are display-only
 * for players (see danganronpa.css), which stops hand-editing without standing
 * in the way of the rules.
 */
const GUARDED = [
    `system.resources.${ACTIONS_RESOURCE}.value`,
    `system.resources.${ACTIONS_RESOURCE}.max`,
    "system.resources.hope.max",
    "system.traits"
];

export function registerResourceGuard() {
    Hooks.on("preUpdateActor", onPreUpdateActor);
}

function onPreUpdateActor(actor, changes, options) {
    try {
        if (actor.type !== "character") return;
        if (game.user.isGM) return;
        if (options?.[SYSTEM_WRITE]) return;

        let enforcing = true;
        try {
            enforcing = game.settings.get(MODULE_ID, SETTINGS.lockPlayerResources);
        } catch { /* setting not registered yet */ }
        if (!enforcing) return;

        const flat = foundry.utils.flattenObject(changes);
        const blocked = Object.keys(flat).filter(path =>
            GUARDED.some(g => path === g || path.startsWith(`${g}.`)));

        if (!blocked.length) return;

        for (const path of blocked) {
            const parts = path.split(".");
            const last = parts.pop();
            let node = changes;
            for (const part of parts) node = node?.[part];
            if (node && last in node) delete node[last];
        }

        prune(changes);
        ui.notifications.warn(game.i18n.localize("DRPG.Guard.blocked"));
        debug("Blocked a player edit of", blocked.join(", "));
    } catch {
        // Never let the guard itself break an update.
    }
}

/** Remove branches emptied by the deletions above. */
function prune(node) {
    for (const [key, value] of Object.entries(node)) {
        if (value && typeof value === "object" && !Array.isArray(value)) {
            prune(value);
            if (!Object.keys(value).length) delete node[key];
        }
    }
}

/**
 * Update an actor as automation, bypassing the guard.
 * Every automated resource change in this module goes through here.
 */
export function automatedUpdate(actor, data) {
    return actor.update(data, { [SYSTEM_WRITE]: true });
}
