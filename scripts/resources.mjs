/**
 * Danganronpa RPG — the Actions resource.
 * ---------------------------------------------------------------------------
 * Guide: "Each player has 2 actions per time of day by default."
 *
 * Daggerheart keeps per-actor-type resources in CONFIG.DH.RESOURCE and rebuilds
 * that table as `{...homebrewResources, ...custom, ...base}` whenever homebrew
 * settings change. `custom` is the slot the system reserves for modules — a
 * resource registered there survives every rebuild, gets schema validation on
 * `system.resources.actions`, and can be spent by item action costs later.
 *
 * The sheet only ever shows extra resources inside a pop-out tooltip, so the
 * always-visible action pips are drawn separately in sheet.mjs.
 */

import { ACTIONS_RESOURCE, STARTING } from "./config.mjs";
import { log, warn } from "./utils.mjs";

/** Definition handed to Daggerheart. Shape mirrors `characterBaseResources`. */
export const ACTIONS_DEFINITION = Object.freeze({
    id: ACTIONS_RESOURCE,
    initial: STARTING.actions,
    max: STARTING.actions,
    // Counts down as actions are spent, like Hope — not up like damage.
    reverse: false,
    label: "DRPG.Actions.label",
    images: {
        full: { value: "fa-solid fa-circle", isIcon: true, noColorFilter: false },
        empty: { value: "fa-regular fa-circle", isIcon: true, noColorFilter: false }
    }
});

/**
 * Register the resource. Idempotent, and called from both `init` and `setup`
 * because the exact moment CONFIG.DH becomes available is the system's business,
 * not ours.
 */
export function registerActionResource() {
    const config = CONFIG.DH?.RESOURCE?.character;
    if (!config) {
        warn("CONFIG.DH.RESOURCE.character is not available yet; the Actions resource was not registered.");
        return false;
    }

    if (config.all?.[ACTIONS_RESOURCE] && config.custom?.[ACTIONS_RESOURCE]) return true;

    // Both tables are read optionally above but were written unconditionally,
    // so a system version that has not built one of them yet turned a missing
    // table into a TypeError — and the whole action economy vanished with it.
    if (!config.custom || !config.all) {
        warn("Daggerheart's resource tables are not built yet; the Actions resource was not registered.");
        return false;
    }

    // `custom` is what survives refreshConfig(); `all` is what is read right now.
    config.custom[ACTIONS_RESOURCE] = ACTIONS_DEFINITION;
    config.all[ACTIONS_RESOURCE] = ACTIONS_DEFINITION;

    log(`Registered the "${ACTIONS_RESOURCE}" resource (${STARTING.actions} per time of day).`);
    return true;
}
