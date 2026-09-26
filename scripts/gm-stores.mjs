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

import { MODULE_ID, moduleVersion } from "./config.mjs";
import { SETTINGS, getClock, getSetting, setSetting, incidentCast } from "./settings.mjs";
import { activeGmIds, primaryGmId, isPrimaryGm, warn, error, debug, plural, esc, dialogContent, whisperToGms } from "./utils.mjs";
import {
    configureGmStore, openGmStoreEngine, defineGmStore, gmStoreByName, gmStoreHandles, gmStoresHydrated, gmStoreHydration,
    gmStoreSkew, onGmStoresHydrated, flatToSection, previewSection, mergeSections, writeFields, dropKey
} from "./gm-store.mjs";

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

/**
 * THE TRACES' ANSWER KEYS (E04 C4; audit S05-10, S05-64, the E30 review's m3).
 * Keyed `sceneId.tokenId`; `public` - what a player may be shown - is split, a
 * stamp per sub-key, so a GM renaming a trace and another rewriting its reading
 * both keep theirs. The old rows are claimed per world by their scene, live and
 * tombstoned; a row whose scene this world does not have stays in the old key
 * (another world's, or a scene deleted since).
 */
export const remnantStore = defineGmStore({
    name: "remnants", key: SETTINGS.remnantSecrets, legacyKey: SETTINGS.legacyRemnantSecrets,
    kind: "ledger", split: ["public"], resetGroup: "remnants", backup: true, sync: true,
    claim: legacy => {
        const rows = [], left = [];
        for (const [key, entry] of Object.entries(isPlain(legacy) ? legacy : {})) {
            if (!isPlain(entry)) { left.push({ key, reason: "notARow" }); continue; }
            if (!game.scenes?.has(String(key).split(".")[0])) { left.push({ key, reason: "otherWorld" }); continue; }
            const { updated, deleted, ...fields } = entry;
            rows.push(deleted ? { key, deleted: true, stamp: updated } : { key, fields, stamp: updated });
        }
        return { rows, left };
    },
    exists: key => {
        const [sceneId, tokenId] = String(key).split(".");
        return Boolean(game.scenes?.get(sceneId)?.tokens?.get(tokenId));
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

/* ---------------------------------------------------------------------------
 * THE CASE: Back up the case, Restore, and the health check (E04 C3; audit
 * S05-09, S04-24). Every store in the table with `backup: true` goes into one
 * file, one merge brings a file back, and one report says what this browser is
 * missing. All three read the table, so a store a later stage adds is backed up,
 * restored and checked with no line here.
 * ------------------------------------------------------------------------- */

export const CASE_FORMAT = "drpg-case";
export const CASE_VERSION = 1;
const { DialogV2 } = foundry.applications.api;

/** `{ since, lastBackupAt, lastBackupBy }`: when this world's case was first recorded, and its last backup. */
export function caseMark() {
    try { return getSetting(SETTINGS.caseMark) ?? {}; } catch { return {}; }
}

async function markCase(patch) {
    if (!game.user?.isGM) return;
    try { await setSetting(SETTINGS.caseMark, { ...caseMark(), ...patch }); }
    catch (err) { warn("Could not record the case's backup mark", err); }
}

/**
 * Once the stores hold rows, the world says so: `caseMark.since`, written by the
 * primary after the claim. A browser that later opens this world holding nothing
 * then knows it is not a new case but one it never saw (the health check's
 * "never held" row). A timestamp and nothing about the case itself: "a pick
 * exists" or "an offer is pending" in world data would be a tell (the design's 1).
 */
async function markCaseSince() {
    if (!isPrimaryGm() || caseMark().since) return;
    if (gmStoreHandles().some(h => h.spec.backup && Object.keys(h.entries()).length)) await markCase({ since: Date.now() });
}

/** Every store with `backup: true`, and nothing else, as `{ name: section }` (R173). */
export function caseSections(handles) {
    return Object.fromEntries(handles.filter(h => h.spec.backup).map(h => [h.name, h.section()]));
}

/**
 * The file a backup writes, built from sections. Pure over what it is handed (R173).
 */
export function caseFileOf({ sections, world, exportedAt, exportedBy, resetCuts = {} }) {
    return {
        format: CASE_FORMAT, version: CASE_VERSION, module: moduleVersion(),
        world, exportedAt, exportedBy, resetCuts, stores: sections
    };
}

/**
 * The rows a store's claim would take, when the claim failed at open (the design's
 * 5.1): computed in memory and merged into the file's copy, so a backup taken on a
 * browser whose claim could not write is complete anyway.
 */
async function claimRowsIntoCopy(handle, section) {
    const info = handle.claimInfo();
    if (!info?.failed || !handle.spec.claim || !handle.spec.legacyKey) return section;
    let legacy;
    try { legacy = foundry.utils.deepClone(game.settings.get(MODULE_ID, handle.spec.legacyKey)); } catch { return section; }
    const { rows = [] } = (await handle.spec.claim(legacy, { backup: true })) ?? {};
    const mini = { e: {}, t: {}, d: {}, cleared: 0 };
    for (const row of rows) {
        const s = Number.isFinite(row.stamp) && row.stamp > 0 ? row.stamp : (section.cleared ?? 0) + 1;
        if (row.deleted) dropKey(mini, row.key, s, handle.spec);
        else writeFields(mini, row.key, row.fields ?? {}, s, handle.spec, { whole: true });
    }
    return mergeSections(section, mini, handle.spec);
}

/**
 * Back up the case: every GM store of this world, in one file this browser saves.
 *
 * `ask` (the panel's tile) says first what the file holds - the Mastermind and
 * every answer - and, before the other GMs' copies have arrived, that they have
 * not. `game.drpg.backupCase()` from the console saves at once. GM-only; the file
 * is never sent over the socket nor put in world data. Answers the file.
 */
export async function backupCase({ ask = false } = {}) {
    if (!game.user?.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Case.gmOnly"));
        return null;
    }
    if (ask) {
        const waiting = gmStoreHydration().waiting.map(id => game.users.get(id)?.name ?? id);
        const early = !gmStoresHydrated() && waiting.length;
        const yes = await DialogV2.confirm({
            window: { title: game.i18n.localize("DRPG.Case.backupTitle") },
            content: dialogContent(`<p>${esc(game.i18n.localize("DRPG.Case.backupWhat"))}</p>${early
                ? `<p class="drpg-warning">${esc(game.i18n.format("DRPG.Case.backupEarly", { names: waiting.join(", ") }))}</p>` : ""}`),
            rejectClose: false
        });
        if (!yes) return null;
    }
    const sections = caseSections(gmStoreHandles());
    for (const name of Object.keys(sections)) sections[name] = await claimRowsIntoCopy(gmStoreByName(name), sections[name]);
    const exportedAt = new Date().toISOString();
    const file = caseFileOf({
        sections, world: { id: game.world.id, title: game.world.title }, exportedAt,
        exportedBy: game.user.name, resetCuts: getClock().resetCuts ?? {}
    });
    foundry.utils.saveDataToFile(JSON.stringify(file), "application/json",
        `drpg-case-${game.world.id}-${exportedAt.replace(/[:.]/g, "-")}.json`);
    await markCase({ lastBackupAt: Date.now(), lastBackupBy: game.user.name });
    ui.notifications.info(plural("DRPG.Case.backedUp", { n: Object.values(sections).reduce((n, sec) => n + Object.keys(sec.e).length, 0) }));
    return file;
}

/**
 * A file handed to Restore, read: the case file this build writes, or the Truth
 * Bullet export of every version before it (`{ uuid: { ...fields, updated } }`),
 * taken as the bullets' section with its stamps from `updated`.
 */
export function readCaseFile(file) {
    let data = file;
    if (typeof file === "string") {
        try { data = JSON.parse(file); } catch { return { refused: "unreadable" }; }
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) return { refused: "unreadable" };
    if (data.format === CASE_FORMAT) {
        if (!(data.version <= CASE_VERSION)) return { refused: "newer", version: data.version };
        return { kind: "case", world: data.world ?? null, stores: data.stores ?? {}, exportedAt: data.exportedAt ?? null };
    }
    if ("format" in data) return { refused: "unreadable" };
    return { kind: "flat", world: null, stores: { bullets: flatToSection(data, bulletStore.spec, bulletStore.weak()) } };
}

/** What a restore of `file` would do, store by store, without writing anything. */
export function previewRestore(file) {
    const read = readCaseFile(file);
    if (read.refused) return read;
    const otherWorld = Boolean(read.world?.id && read.world.id !== game.world.id);
    const stores = {};
    for (const [name, section] of Object.entries(read.stores)) {
        const handle = gmStoreByName(name);
        if (!handle?.spec.backup) { stores[name] = { unknown: true }; continue; }
        const { beforeCutKeys, ...counts } = previewSection(handle.section(), section, handle.spec);
        stores[name] = counts;
    }
    return { kind: read.kind, world: read.world, otherWorld, exportedAt: read.exportedAt ?? null, stores };
}

/**
 * Restore the case from a file, by the same merge as the sync: it only ever adds
 * what is newer, so any GM may run it and a restore twice is a restore once.
 *
 * Refused: a file of a newer format, and a file of another world unless
 * `otherWorld` (a moved server, a duplicated world). Rows at or under the reset's
 * cut are refused unless `beforeCut` ("restore anyway"), and then fill only the
 * fields this browser lacks, freshly stamped - the explicit undo of a reset. After
 * it: the other GMs get what changed, each restored store counts as having its
 * copy, the Faint pass runs again, each store sends its players their copies
 * again, and the health check runs again (`recheck`).
 */
export async function restoreCase(file, { otherWorld = false, beforeCut = false, recheck = true } = {}) {
    if (!game.user?.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Case.gmOnly"));
        return null;
    }
    const read = readCaseFile(file);
    if (read.refused) {
        ui.notifications.error(game.i18n.format(`DRPG.Case.refused.${read.refused}`, { version: read.version ?? "?" }));
        return { refused: read.refused };
    }
    if (read.world?.id && read.world.id !== game.world.id && !otherWorld) {
        ui.notifications.error(game.i18n.format("DRPG.Case.refused.otherWorld", { title: read.world.title ?? read.world.id }));
        return { refused: "otherWorld" };
    }
    const counts = {};
    for (const [name, section] of Object.entries(read.stores)) {
        const handle = gmStoreByName(name);
        if (!handle?.spec.backup) continue;
        const preview = previewSection(handle.section(), section, handle.spec);
        const changed = await handle.mergeIn(section, { source: "restore" });
        let filled = 0;
        if (beforeCut) {
            for (const k of preview.beforeCutKeys) {
                const fields = section.e?.[k];
                if (!fields || typeof fields !== "object") continue;
                const absent = Object.fromEntries(Object.entries(fields).filter(([f]) => !Object.hasOwn(handle.get(k) ?? {}, f)));
                if (!Object.keys(absent).length) continue;
                await handle.patch(k, absent, { fillOnly: true, whole: true });
                filled++;
            }
        }
        handle.markRestored();
        counts[name] = { changed, filled, beforeCut: beforeCut ? 0 : preview.beforeCut };
        try { await handle.spec.afterRestore?.(); }
        catch (err) { error(`After restoring "${name}", the copies could not be sent again`, err); }
    }
    try {
        const { migrateFaintIntoSecrets } = await import("./truth-bullets.mjs");
        await migrateFaintIntoSecrets();
    } catch (err) { error("After a restore, the Faint pass could not run", err); }
    const lines = Object.entries(counts).map(([name, c]) => game.i18n.format("DRPG.Case.restoredStore", {
        store: game.i18n.localize(`DRPG.Case.store.${name}`), n: c.changed + c.filled, cut: c.beforeCut }));
    ui.notifications.info(`${game.i18n.localize("DRPG.Case.restored")} ${lines.join("; ")}`);
    if (recheck) void runHealthCheck();
    return { counts };
}

/* ------------------------------ the health check ------------------------------ */

/** Every Truth Bullet in the world, as items on character actors. */
function allBullets() {
    const out = [];
    for (const actor of game.actors ?? []) {
        if (actor.type !== "character") continue;
        for (const item of actor.items ?? []) if (item.getFlag(MODULE_ID, "category") === "truthBullet") out.push(item);
    }
    return out;
}

/** Bullets in the world whose answer key this browser lacks or holds with no real type (S05-01's damage included). */
export function bulletsWithoutAnswer() {
    if (!game.user?.isGM) return 0;
    return allBullets().filter(item => !bulletStore.get(item.uuid)?.realType).length;
}

/**
 * What a bullet with no real type here can take from its trace: a bullet copied
 * from a trace carries the trace's key in its `remnantRef` flag (public, the one
 * a player's own trace icon reads), and the trace's row says what it really is
 * - the type the copy was made with (observe.mjs, gm-items.mjs). `{ uuid:
 * { realType, remnantId } }`, for the bullets whose trace's row is here.
 */
function fillsFromTraces() {
    const fills = {};
    for (const item of allBullets()) {
        if (bulletStore.get(item.uuid)?.realType) continue;
        const ref = item.getFlag(MODULE_ID, "remnantRef");
        const type = ref ? remnantStore.get(ref)?.type : null;
        if (type) fills[item.uuid] = { realType: type, remnantId: String(ref).split(".")[1] || null };
    }
    return fills;
}

/**
 * FILL FROM THEIR TRACES (the design's 6.3; E04 C4). The bullets whose answer key
 * this browser lost, or whose key lost its real type (S05-01's damage), and whose
 * trace's row is here, take `realType` and `remnantId` from it - weak and fill-only,
 * so a value any GM holds for either wins, and nothing else of the key is made up:
 * a GM's note, the analysed reading and the rest come back only from a backup.
 * Answers how many bullets were filled.
 */
export async function fillBulletsFromTraces() {
    if (!game.user?.isGM) return 0;
    await Promise.all([bulletStore.whenHydrated(), remnantStore.whenHydrated()]);
    const fills = fillsFromTraces();
    const n = Object.keys(fills).length;
    if (n) await bulletStore.patchMany(fills, { weak: true, fillOnly: true });
    return n;
}

/**
 * What this browser is missing of the case, as it stands: one row per finding,
 * `{ id, level, key, data }` - `missing` (something the table needs is not here),
 * `conflict` (a GM has to decide), `info`. Reads only; any GM may ask
 * (`game.drpg.gmStoreHealth()`). What it cannot see - the Mastermind, the offers,
 * the Blackened register - it says it cannot see.
 */
export async function gmStoreHealth() {
    if (!game.user?.isGM) return null;
    const rows = [];
    const add = (id, level, key, data = {}) => rows.push({ id, level, key, data });

    const traces = [];
    for (const scene of game.scenes ?? []) for (const token of scene.tokens ?? []) if (token.getFlag(MODULE_ID, "isRemnant")) traces.push(token);
    const traceKey = token => `${token.parent?.id}.${token.id}`;
    const traceGaps = traces.filter(token => !remnantStore.has(traceKey(token)));
    if (traceGaps.length) add("traces", "missing", "DRPG.Case.row.traces", { n: traceGaps.length, of: traces.length });
    // A row whose token is gone: unreachable (every read goes through a token), counted, never removed on its own.
    const onMap = new Set(traces.map(traceKey));
    const orphans = Object.keys(remnantStore.entries()).filter(key => !onMap.has(key)).length;
    if (orphans) add("traceOrphans", "info", "DRPG.Case.row.traceOrphans", { n: orphans });

    const bullets = allBullets();
    const noRow = bullets.filter(item => !bulletStore.has(item.uuid));
    const noAnswer = bullets.filter(item => bulletStore.has(item.uuid) && !bulletStore.get(item.uuid).realType);
    if (noRow.length) add("bullets", "missing", "DRPG.Case.row.bullets", { n: noRow.length, of: bullets.length });
    if (noAnswer.length) add("bulletsNoAnswer", "missing", "DRPG.Case.row.noAnswer", { n: noAnswer.length });

    const state = getSetting(SETTINGS.murderState) ?? {};
    const cast = incidentCast();
    if (state.active && !cast.killerId && !cast.victimId) add("incident", "missing", "DRPG.Case.row.incident");

    const since = caseMark().since;
    const holdsNothing = gmStoreHandles().every(h => !Object.keys(h.entries()).length && !(h.census()?.claimed));
    if (since && holdsNothing) add("neverHeld", "missing", "DRPG.Case.row.neverHeld", { date: new Date(since).toLocaleString() });

    for (const handle of gmStoreHandles()) {
        if (handle.legacyChanged()) add(`legacy.${handle.name}`, "conflict", "DRPG.Case.row.legacyChanged", { store: game.i18n.localize(`DRPG.Case.store.${handle.name}`) });
        const failed = handle.claimInfo()?.failed;
        if (failed) add(`claim.${handle.name}`, "conflict", "DRPG.Case.row.claimFailed", { store: game.i18n.localize(`DRPG.Case.store.${handle.name}`), error: failed });
    }

    add("unseen", "info", "DRPG.Case.row.unseen");
    const left = gmStoreHandles().reduce((n, h) => n + (h.census()?.left ?? 0), 0);
    if (left) add("left", "info", "DRPG.Case.row.left", { n: left });
    const skew = Object.entries(gmStoreSkew());
    if (skew.length) add("skew", "info", "DRPG.Case.row.skew", { names: skew.map(([id, m]) => `${game.users.get(id)?.name ?? id} (+${m} min)`).join(", ") });
    const status = gmStoreStatus();
    add("bytes", status.total > 3 * 1024 * 1024 ? "conflict" : "info", "DRPG.Case.row.bytes",
        { stores: Math.round(status.stores / 1024), total: Math.round(status.total / 1024) });
    const mark = caseMark();
    add("lastBackup", "info", mark.lastBackupAt ? "DRPG.Case.row.lastBackup" : "DRPG.Case.row.neverBackedUp",
        { when: mark.lastBackupAt ? new Date(mark.lastBackupAt).toLocaleString() : "", who: mark.lastBackupBy ?? "" });

    const counts = {
        traces: { of: traces.length, missing: traceGaps.length, orphans },
        bullets: { of: bullets.length, missing: noRow.length, noAnswer: noAnswer.length, fillable: Object.keys(fillsFromTraces()).length }
    };
    return { world: game.world.id, hydrated: gmStoresHydrated(), rows, counts, missing: rows.filter(r => r.level === "missing").length };
}

/** A health row as a sentence: a counted row through `plural`, the rest through `format`. */
export function healthLine(row) {
    return game.i18n.has(`${row.key}.other`) ? plural(row.key, row.data) : game.i18n.format(row.key, row.data);
}

/** The bytes this browser's GM stores hold, and everything the module keeps in its localStorage. */
export function gmStoreStatus() {
    const perStore = gmStoreHandles().map(h => h.status());
    let total = 0;
    try {
        const client = game.settings.storage.get("client");
        for (let i = 0; i < client.length; i++) {
            const key = client.key(i);
            if (key?.startsWith(`${MODULE_ID}.`)) total += key.length + (client.getItem(key)?.length ?? 0);
        }
    } catch { /* no client storage to read: nothing counted */ }
    return { stores: perStore.reduce((n, s) => n + s.bytes, 0), total, perStore };
}

let lastHealth = null;
let healthOpen = false;

/** The panel's red line: what the last check found missing, or nothing once it passes. */
export function caseWarning() {
    return lastHealth?.missing ? lastHealth : null;
}

/**
 * The primary GM's check, at ready once the other GMs' copies have arrived (or
 * none were waited for, or the wait timed out), and after every restore. When a
 * row is missing: one window with the rows, Restore from a file, and Continue -
 * the default, which leaves a notification that stays and a red line on the GM
 * panel until a check passes. Another GM sees the rows in diagnostics only.
 */
export async function runHealthCheck() {
    if (!isPrimaryGm()) return null;
    const report = await gmStoreHealth();
    lastHealth = report;
    if (!report?.missing || healthOpen) return report;
    healthOpen = true;
    try {
        const lines = report.rows.filter(r => r.level !== "info").map(r =>
            `<li class="${r.level === "missing" ? "drpg-warning" : ""}">${esc(healthLine(r))}</li>`).join("");
        const fillable = report.counts?.bullets?.fillable ?? 0;
        const choice = await DialogV2.wait({
            window: { title: game.i18n.localize("DRPG.Case.healthTitle") },
            classes: ["drpg-panel"],
            content: dialogContent(`<p>${esc(game.i18n.localize("DRPG.Case.healthIntro"))}</p><ul>${lines}</ul>
                <p class="notes">${esc(game.i18n.localize("DRPG.Case.healthNote"))}</p>`),
            buttons: [
                { action: "restore", label: game.i18n.localize("DRPG.Case.restoreFromFile") },
                ...(fillable ? [{ action: "fill", label: game.i18n.format("DRPG.Case.fillFromTraces", { n: fillable }) }] : []),
                { action: "continue", label: game.i18n.localize("DRPG.Case.continue"), default: true }
            ],
            rejectClose: false
        });
        if (choice === "restore") {
            healthOpen = false;
            return openRestoreDialog();
        }
        if (choice === "fill") {
            const filled = await fillBulletsFromTraces();
            ui.notifications.info(plural("DRPG.Case.filled", { n: filled }));
            healthOpen = false;
            return runHealthCheck();
        }
        ui.notifications.warn(game.i18n.localize("DRPG.Case.continued"), { permanent: true });
    } finally {
        healthOpen = false;
    }
    return report;
}

/** A file the GM picks, as its text; null when none was picked. */
function chooseCaseFile() {
    return new Promise(resolve => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json,application/json";
        input.addEventListener("change", async () => {
            const file = input.files?.[0];
            if (!file) return resolve(null);
            try { resolve(await foundry.utils.readTextFromFile(file)); }
            catch (err) { error("Could not read the case file", err); resolve(null); }
        }, { once: true });
        input.click();
    });
}

/**
 * The Restore tile: pick a file, see what it would do per store, and confirm -
 * with "a file of another world" and "restore anyway, under the reset's cut" as
 * boxes the GM ticks, never defaults.
 */
export async function openRestoreDialog(text = null) {
    if (!game.user?.isGM) return null;
    const file = text ?? await chooseCaseFile();
    if (!file) return null;
    const preview = previewRestore(file);
    if (preview.refused) {
        ui.notifications.error(game.i18n.format(`DRPG.Case.refused.${preview.refused}`, { version: preview.version ?? "?" }));
        return null;
    }
    const rows = Object.entries(preview.stores).filter(([, c]) => !c.unknown).map(([name, c]) =>
        `<li>${esc(game.i18n.format("DRPG.Case.previewStore", { store: game.i18n.localize(`DRPG.Case.store.${name}`),
            add: c.add, refresh: c.refresh, kept: c.keptNewerHere, cut: c.beforeCut }))}</li>`).join("");
    const answer = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Case.restoreTitle") },
        classes: ["drpg-panel"],
        content: dialogContent(`<form><ul>${rows}</ul>
            ${preview.otherWorld ? `<label class="drpg-checkbox"><input type="checkbox" name="otherWorld" />
                ${esc(game.i18n.format("DRPG.Case.otherWorld", { title: preview.world?.title ?? preview.world?.id ?? "?" }))}</label>` : ""}
            <label class="drpg-checkbox"><input type="checkbox" name="beforeCut" />
                ${esc(game.i18n.localize("DRPG.Case.beforeCut"))}</label>
            <p class="notes">${esc(game.i18n.localize("DRPG.Case.restoreNote"))}</p></form>`),
        buttons: [
            { action: "restore", label: game.i18n.localize("DRPG.Case.restore"), default: true,
              callback: (e, b, d) => ({ otherWorld: Boolean(d.element.querySelector("[name=otherWorld]")?.checked),
                  beforeCut: Boolean(d.element.querySelector("[name=beforeCut]")?.checked) }) },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });
    if (!answer || answer === "cancel") return null;
    return restoreCase(file, answer);
}

/** Registered at ready (module.mjs): the check runs once this client's stores hold the other GMs' copies. */
export function registerCaseHealth() {
    onGmStoresHydrated(() => {
        markCaseSince()
            .then(() => runHealthCheck())
            .catch(err => error("The case health check could not run", err));
    });
}
