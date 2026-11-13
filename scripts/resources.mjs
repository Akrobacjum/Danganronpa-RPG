/**
 * Danganronpa RPG - the Actions resource.
 * ---------------------------------------------------------------------------
 * Guide: "Each player has 2 actions per time of day by default."
 *
 * Daggerheart keeps per-actor-type resources in CONFIG.DH.RESOURCE and rebuilds
 * that table as `{...homebrewResources, ...custom, ...base}` whenever homebrew
 * settings change. `custom` is the slot the system reserves for modules - a
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
    // Counts down as actions are spent, like Hope - not up like damage.
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
    // table into a TypeError - and the whole action economy vanished with it.
    if (!config.custom || !config.all) {
        warn("Daggerheart's resource tables are not built yet; the Actions resource was not registered.");
        return false;
    }

    // `custom` is what survives refreshConfig(); `all` is what is read right now.
    config.custom[ACTIONS_RESOURCE] = ACTIONS_DEFINITION;
    config.all[ACTIONS_RESOURCE] = ACTIONS_DEFINITION;

    log(`Registered the "${ACTIONS_RESOURCE}" resource (${STARTING.actions} per time of day).`);
    keepActionsOnce();
    return true;
}

/* ==========================================================================
 * THE KEY DAGGERHEART'S CLEAN-UP WOULD DELETE
 * --------------------------------------------------------------------------
 * Daggerheart 2.12.8 (since 2.9.0, "Feature Resources") runs `_cleanupOptionalResources` after every item update or
 * delete the acting user makes on an actor (documents/actor.mjs:1515-1537), and it deletes every key of
 * `system.resources` that is not one of the type's base resources (hitPoints, stress, hope), granted by a feature's
 * `actorResources` or a Homebrew resource (:300-325). `actions` is registered into `custom` and `all` above, so it is
 * none of those: by reading, any item equipped, used, given or taken refilled a student's Actions to 2/2 (the model
 * seeds the key again from ACTIONS_DEFINITION) and dropped a time-of-day maximum - the 2.10.5 probe's E24-1
 * (audit/probe-daggerheart-2.10.5.md), still in 2.12.8. A hook before the write, rather than a wrapper on the system's
 * method or a Homebrew entry: it takes the one key out of any update that deletes it - as the system's operator or as
 * `-=actions` - and cancels an update that held nothing else, so the system's clean-up of its own keys still runs. The
 * module never deletes the key itself. On a character only, where the resource is registered. R5762; at a table the
 * Actions before and after an item change are the probe's own live check (its list of live checks, item 2), not run.
 * ========================================================================== */

let keeping = false;

function keepActionsOnce() {
    if (keeping) return;
    keeping = true;
    Hooks.on("preUpdateActor", keepActionsResource);
}

/** Whether `value` deletes the key it stands under: v14's ForcedDeletion, Daggerheart's `_del`. */
function isDeletion(value) {
    if (value === null || typeof value !== "object") return false;
    const Operator = foundry.data?.operators?.ForcedDeletion;
    if (Operator && value instanceof Operator) return true;
    if (globalThis._del !== undefined && value === globalThis._del) return true;
    return value.constructor?.name === "ForcedDeletion";
}

/**
 * preUpdateActor: an update's deletion of the Actions resource taken out; `false` (the update cancelled) when it held
 * nothing else. Exported for R5762.
 */
export function keepActionsResource(actor, changes) {
    if (actor?.type !== "character") return undefined;
    const resources = changes?.system?.resources;
    if (!resources || typeof resources !== "object") return undefined;
    const dash = `-=${ACTIONS_RESOURCE}`;
    const deletes = dash in resources || (ACTIONS_RESOURCE in resources && isDeletion(resources[ACTIONS_RESOURCE]));
    if (!deletes) return undefined;
    delete resources[dash];
    if (isDeletion(resources[ACTIONS_RESOURCE])) delete resources[ACTIONS_RESOURCE];
    if (!Object.keys(resources).length) delete changes.system.resources;
    if (!Object.keys(changes.system).length) delete changes.system;
    log(`Kept "${ACTIONS_RESOURCE}" on ${actor.name ?? actor.id}: an update would have deleted it.`);
    return Object.keys(changes).some(key => key !== "_id") ? undefined : false;
}
