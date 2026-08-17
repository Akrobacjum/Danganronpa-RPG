/**
 * Danganronpa RPG — players do not edit their own numbers.
 * ---------------------------------------------------------------------------
 * In a killing game the sheet is not a scratchpad. Actions, Hope and traits
 * change because something happened — a roll landed, an action was spent, an
 * advancement was earned — not because a player clicked a pip.
 *
 * So those fields become read-only for players and writable only by the GM or
 * by this module's own automation.
 *
 * HP AND STRESS ARE IN THAT LIST AS OF 1.0.1. They used to be the exception, on
 * the grounds that players mark their own damage — but nothing in this game
 * asks them to. Damage arrives from a crisis action, a Despair Call, a failed
 * Observe, a Rest; all of it through `automatedUpdate`, all of it already
 * marked. What the editable pips actually bought was the ability to heal
 * yourself in the middle of an incident, which is not a rule anybody had agreed
 * to and is impossible to notice from the GM's side.
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
    "system.resources.hitPoints",
    "system.resources.stress",
    "system.traits"
];

export function registerResourceGuard() {
    Hooks.on("preUpdateActor", onPreUpdateActor);
    Hooks.on("preUpdateItem", onPreUpdateItem);
}

/**
 * An item's name is the GM's to write.
 *
 * What a thing is CALLED is what everybody else at the table will hear it
 * called, and on a Truth Bullet it is half the evidence — "Bent pipe" and "Bent
 * pipe, wiped clean" are two different claims about one object. A player
 * renaming their own copy edits the record the Class Trial runs on, from a text
 * field, with nobody told.
 *
 * Only the name. Players still move items, stash them, equip them, hand them
 * over and spend them; none of that is touched.
 */
function onPreUpdateItem(item, changes, options) {
    try {
        if (game.user.isGM) return;
        if (options?.[SYSTEM_WRITE]) return;
        if (!("name" in changes)) return;
        // Only an item somebody is carrying. A world item in a compendium or in
        // the sidebar is not part of anybody's inventory and not this guard's
        // business — and a player cannot edit those anyway.
        if (item.parent?.documentName !== "Actor") return;

        let enforcing = true;
        try {
            enforcing = game.settings.get(MODULE_ID, SETTINGS.lockPlayerResources);
        } catch { /* setting not registered yet */ }
        if (!enforcing) return;

        delete changes.name;
        prune(changes);
        ui.notifications.warn(game.i18n.localize("DRPG.Guard.nameLocked"));
        debug(`Blocked a player rename of "${item.name}"`);
    } catch {
        // Never let the guard itself break an update.
    }
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
