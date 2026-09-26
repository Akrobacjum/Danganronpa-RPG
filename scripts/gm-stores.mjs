/**
 * Danganronpa RPG - the GM stores: which there are, and what is done with all of them.
 * ---------------------------------------------------------------------------
 * The engine (gm-store.mjs) knows how to hold, merge and send a store; this file
 * says which stores exist and wires the engine to the rest of the module. Each
 * store is one `defineGmStore` row below - its key, its old key, how its old rows
 * are claimed for this world, which reset group wipes it, whether it is synced
 * and backed up - and every domain module takes its handle from here.
 *
 * WHY A SECOND FILE (E04, 1.2.63). The engine imports config.mjs only, so that
 * settings.mjs can read its leaves through it without a cycle (R161). This file
 * imports settings.mjs and utils.mjs and hands the engine what it needs from them
 * at ready; it reaches a domain module only by dynamic `import()`, so any domain
 * module can import its handle from here statically.
 *
 * HOW A LATER STAGE ADDS A STORE (E05, E13, E28): one `defineGmStore` row here,
 * one registration in settings.mjs, and - when it lifts world data - one clause
 * in migrate.mjs that reads back before it removes anything. The claim, the
 * cuts, the sync, and (from C3 of E04) backup, restore and the health check take
 * it from the registry.
 */

import { SETTINGS, getClock } from "./settings.mjs";
import { activeGmIds, primaryGmId, warn, error, debug, plural } from "./utils.mjs";
import { configureGmStore, openGmStoreEngine } from "./gm-store.mjs";

/* ---------------------------------------------------------------------------
 * The table. Empty in the commit that brings the engine: each store moves in a
 * commit of its own (the design's C2-C9), the Truth Bullets first.
 * ------------------------------------------------------------------------- */

let opening = null;

/**
 * Wire the engine to this module and open this world's stores on this client:
 * the claim of the old keys, the clock's reset cuts, the GM-to-GM listener and
 * the hello. Once, at ready, before the migration's clauses (module.mjs), which
 * wait for the stores they read. Never throws: a store that cannot open says so
 * in the log, and the rest of the module carries on.
 */
export function openGmStores() {
    opening ??= (async () => {
        configureGmStore({
            activeGmIds, primaryGmId, getClock, clockKey: SETTINGS.clock, warn, error, debug,
            // A counted sentence is a plural family (.one/.other, and .few/.many in Polish).
            text: (key, data = {}) => (game.i18n.has(`${key}.other`) ? plural(key, data) : game.i18n.format(key, data))
        });
        try {
            await openGmStoreEngine();
        } catch (err) {
            error("The GM stores could not open", err);
        }
    })();
    return opening;
}
