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
import { configureGmStore, openGmStoreEngine, defineGmStore, gmStoreByName } from "./gm-store.mjs";

const isPlain = o => o !== null && typeof o === "object" && !Array.isArray(o);

/* ---------------------------------------------------------------------------
 * The table. Each store moved in a commit of its own (the design's C2-C9), the
 * Truth Bullets first.
 * ------------------------------------------------------------------------- */

/**
 * Whether a document uuid names something in THIS world: the old key held every
 * world's rows in one object, and a uuid is the only thing a row carries that says
 * which world it came from. `Actor.<id>.Item.<id>` by its actor, `Item.<id>` by the
 * world's items, `Scene.<id>...` by the scene. A row whose actor was deleted in this
 * world reads as another world's and is left in the old key, where it was.
 */
export function uuidInThisWorld(uuid) {
    const [kind, id] = String(uuid ?? "").split(".");
    if (kind === "Actor") return Boolean(game.actors?.has(id));
    if (kind === "Item") return Boolean(game.items?.has(id));
    if (kind === "Scene") return Boolean(game.scenes?.has(id));
    return false;
}

/**
 * THE TRUTH BULLET ANSWER KEY (E04 C2; audit S05-01). Keyed by item uuid, one row
 * per bullet: realType, remnantId, sceneId, sourceAction, tiedToCrime, faint,
 * gmNote, analyzedText, analysedFrom, analysedChapter. The old rows are claimed
 * per world by uuid, live and tombstoned, at their own `updated` (or weak, with
 * none); a row of another world stays in the old key.
 */
export const bulletStore = defineGmStore({
    name: "bullets", key: SETTINGS.truthBulletSecrets, legacyKey: SETTINGS.legacyTruthBulletSecrets,
    kind: "ledger", resetGroup: "bullets", backup: true, sync: true,
    claim: legacy => {
        const rows = [], left = [];
        for (const [uuid, entry] of Object.entries(isPlain(legacy) ? legacy : {})) {
            if (!isPlain(entry)) { left.push({ key: uuid, reason: "notARow" }); continue; }
            if (!uuidInThisWorld(uuid)) { left.push({ key: uuid, reason: "otherWorld" }); continue; }
            const { updated, deleted, ...fields } = entry;
            rows.push(deleted ? { key: uuid, deleted: true, stamp: updated } : { key: uuid, fields, stamp: updated });
        }
        return { rows, left };
    },
    exists: uuid => {
        try { return Boolean(fromUuidSync(uuid)); } catch { return false; }
    }
});

/** Whether a store's old key changed since this browser claimed it (a 1.2.x session wrote it since: the design's H1). */
export function gmStoreLegacyChanged(name) {
    return gmStoreByName(name)?.legacyChanged() ?? false;
}

/** Take what changed in a store's old key since the upgrade, by the rules on the handle's `reclaim`. */
export async function gmStoreReclaim(name) {
    const store = gmStoreByName(name);
    if (!game.user?.isGM || !store) return null;
    await store.whenHydrated();
    return store.reclaim();
}

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
