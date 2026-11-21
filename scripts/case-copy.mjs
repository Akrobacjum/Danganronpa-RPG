/**
 * Danganronpa RPG - the case's copy on the server (E111, 14.11.2026).
 * ---------------------------------------------------------------------------
 * WHY (the owner, 14.11.2026): "Planer zagadki powinien przechowywac dane w przegladarce gmow i byc wspolny dla
 * kazdego gma", and then "Bez hasel prosze - niech to bedzie dostepne dla kont gmow po prostu". The case lives in the
 * GMs' browsers (gm-store.mjs), which bring each other up to date only while two of them are online together; the
 * owner opened the world alone from another computer and the planner was empty. A world setting or document would
 * reach every player's browser (the trust model, D2), so the copy is a FILE on the Foundry server instead: the case
 * file `backupCase` saves (gm-stores.mjs `caseFileNow`), uploaded by a GM's browser into the world's folder
 * (COPY_FOLDER), under a name of 128 random bits, and read back by every GM's browser that lists the folder.
 *
 * WHAT PROTECTS IT: not encryption. Two things, both Foundry's: listing a folder asks FILES_BROWSE, and uploading
 * asks FILES_UPLOAD, which enforced.mjs's row `playerFiles` keeps off the Player and Trusted Player roles; and the
 * file's name, which nothing a player's browser reads holds (no setting, flag, card or log line), cannot be guessed
 * (2^128 names). The server serves a file of the data folder to anybody who asks its path, logged in or not (Foundry's
 * static route; LIVE-E111-02) - so a name that leaks is the whole case. The copy is written only while the module
 * holds those permissions (`filesPrivate`): with the switch off, or a Player, a Trusted Player or a player's own
 * account given FILES_BROWSE or FILES_UPLOAD, nothing is written, the GMs are told, and the health check says so.
 *
 * WHO WRITES: the primary GM, SEAL_QUIET_MS after the case's stores last changed (at most SEAL_MOST_MS after the
 * first change), and a GM who presses "Write the copy now". Never while this browser's stores have not heard the
 * other GMs (`gmStoresHydrated`), and never before it has read what the folder holds: every write lists the folder
 * and merges every copy in it first (`readServerCopies`), so a browser that opens empty cannot replace a full copy
 * with an empty one. It then writes to the copy whose `exportedAt` is newest - two GMs' first writes that raced
 * leave two files, both read and merged on every read, and the newer written on from then on; nothing is deleted
 * (Foundry's FilePicker has no delete).
 *
 * WHAT IS READ: each copy through `restoreCase(file, { quiet: true, recheck: false })` - the same merge Restore from a
 * file uses (newer wins per field, removals by their stamps, a season reset's cut never crossed, another world's file
 * refused), no rule of its own. The file is JSON as Back up writes it, not compressed: it is not broadcast to every
 * browser as a setting would be, and a GM can hand it to Restore from a file as it stands.
 */

import { MODULE_ID } from "./config.mjs";
import { SETTINGS, getSetting } from "./settings.mjs";
import { isPrimaryGm, warn, error } from "./utils.mjs";
import { gmStoresHydrated, gmStoreHandles, onGmStoresHydrated, stableJson, gmStoresQuiet } from "./gm-store.mjs";
import { caseFileNow, restoreCase, caseMark } from "./gm-stores.mjs";
import { ENFORCED, permissionsInForce } from "./enforced.mjs";

/** The world's folder the copies live in, in the "data" source. */
export const copyFolder = (worldId = game.world?.id) => `worlds/${worldId}/drpg-case`;
/** A copy's name: `case-` and 32 hex digits (128 random bits). */
export const COPY_NAME = /(^|\/)case-[0-9a-f]{32}\.json$/;
/**
 * The debounce of a write: SEAL_QUIET_MS after the last change, at most SEAL_MOST_MS after the first one waiting. A
 * restore or a chapter's close writes many stores one flush at a time (gm-stores.mjs `registerCaseHealth`), and each
 * write lists, reads and uploads; fifteen seconds gathers such a burst into one, and a minute bounds what a browser
 * closed mid-session can leave out. Chosen, not measured at a table (LIVE-E111-01).
 */
export const SEAL_QUIET_MS = 15000;
export const SEAL_MOST_MS = 60000;

const FILE_ROLES = ["PLAYER", "TRUSTED"];
const FILE_PERMISSIONS = ["FILES_BROWSE", "FILES_UPLOAD"];
const picker = () => foundry.applications?.apps?.FilePicker?.implementation ?? globalThis.FilePicker;

/** A new copy's name: 128 bits from the browser's random source. */
export function newCopyName() {
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
    return `case-${[...bytes].map(b => b.toString(16).padStart(2, "0")).join("")}.json`;
}

/**
 * Whether no player can list or upload files, so a copy may be written: null, or why not -
 * "switchOff" (the module's switch `enforcePlayerFiles` is off), "roles" (the permissions in force give a Player or
 * Trusted Player FILES_BROWSE or FILES_UPLOAD), "account" (a non-GM account was given one by name). Pure over what
 * it is handed; `filesPrivate()` hands it this world's.
 */
export function filesRefusal({ switchOn, inForce, users, roles }) {
    if (!switchOn) return "switchOff";
    const open = FILE_ROLES.map(name => roles?.[name]).filter(Number.isInteger);
    if (FILE_PERMISSIONS.some(p => (inForce?.[p] ?? []).some(role => open.includes(role)))) return "roles";
    if ((users ?? []).some(u => !u.isGM && FILE_PERMISSIONS.some(p => u.permissions?.[p] === true))) return "account";
    return null;
}

export function filesPrivate() {
    const row = ENFORCED.find(r => r.id === "playerFiles");
    let switchOn = false;
    try { switchOn = Boolean(getSetting(row?.toggle ?? SETTINGS.enforcePlayerFiles)); } catch { switchOn = false; }
    return filesRefusal({ switchOn, inForce: permissionsInForce(), users: game.users?.contents ?? [], roles: CONST.USER_ROLES });
}

/**
 * Why this browser may not write a copy now, or null (pure over what it is handed): "notGm", "notPrimary" (a
 * debounced write is the primary's; a GM's own press is `primary: true`), "notHydrated" (its stores have not heard
 * the other GMs: what it holds may be less than the case), "quiet" (the suite holds the stores or stands in another
 * world - `gmStoresQuiet`: what they answer then is a fixture's, never this world's case), or a `filesRefusal` reason.
 */
export function copyRefusal({ isGM, primary, hydrated, files, quiet = false }) {
    if (!isGM) return "notGm";
    if (!primary) return "notPrimary";
    if (files) return files;
    if (quiet) return "quiet";
    if (!hydrated) return "notHydrated";
    return null;
}

/* THIS SESSION'S STATE, read by the health check, the window and the suite (`copyState`). `last`: the last read's
   or write's outcome; `copies`: what the last listing found, by name `{ exportedAt, exportedBy }` (the names stay in
   this GM's browser). SEAL_DEPS.hydrated is the suite's stand-in for the stores' hydration (34's unhydrated case). */
const state = { timer: null, first: 0, running: null, last: null, copies: {}, wrote: 0, told: new Set(), refused: {} };
export const SEAL_DEPS = { hydrated: () => gmStoresHydrated() };
export const copyState = () => ({ last: state.last, pending: state.timer !== null, wrote: state.wrote,
    copies: Object.values(state.copies).map(c => ({ ...c })), refused: { ...state.refused } });

/** Whether the case planner holds nothing here: the Key Remnant plan and the case schema both empty. */
export function plannerEmpty() {
    return gmStoreHandles().filter(h => ["keyPlan", "caseSchema"].includes(h.name)).every(h => !Object.keys(h.entries()).length);
}

/** The copies in the folder, as paths; [] when it does not exist. Throws when this browser may not list it. */
async function listCopies() {
    const FP = picker();
    let listed;
    try { listed = await FP.browse("data", copyFolder()); }
    catch (err) {
        if (/does not exist|ENOENT|not exist/i.test(String(err?.message ?? err))) return [];
        throw err;
    }
    return (listed?.files ?? []).filter(f => COPY_NAME.test(String(f)));
}

/** One copy's text, fetched by its path (no cache: the same name is overwritten). */
async function fetchCopy(path) {
    const res = await globalThis.fetch(`${path}${path.includes("?") ? "&" : "?"}drpg=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return JSON.parse(await res.text());
}

/**
 * List the folder and merge every copy in it into this browser's stores, by `restoreCase`'s merge. Answers
 * `{ read, bad, count, newest, newestFile }`: how many merged, how many would not be read, how many the folder lists,
 * the path of the newest by `exportedAt` and that file; or `{ refused }` ("notGm", "quiet", "list"). A copy that will
 * not fetch or parse, or that the merge refuses, is counted in `bad`, named nowhere, and left (corrected by line INVEST of
 * 1.2.122: this named `copies` and a "fetch" refusal, which it never answered).
 */
export async function readServerCopies() {
    if (!game.user?.isGM) return { refused: "notGm" };
    // Never into a world the suite stands in, nor while it holds the stores (`copyRefusal`'s "quiet").
    if (gmStoresQuiet()) return { refused: "quiet" };
    let paths;
    try { paths = await listCopies(); }
    catch (err) { warn("The case's server copy: the folder could not be listed", String(err?.message ?? err)); return { refused: "list" }; }
    const found = {};
    let read = 0, bad = 0, newest = null;
    for (const path of paths) {
        let file;
        try { file = await fetchCopy(path); } catch { bad++; continue; }
        found[path] = { exportedAt: file?.exportedAt ?? null, exportedBy: file?.exportedBy ?? null, file };
        const result = await restoreCase(file, { quiet: true, recheck: false });
        if (!result || result.refused) { bad++; continue; }
        read++;
        if (!newest || String(file.exportedAt ?? "") > String(found[newest].exportedAt ?? "")) newest = path;
    }
    state.copies = Object.fromEntries(Object.entries(found).map(([p, c]) => [p, { exportedAt: c.exportedAt, exportedBy: c.exportedBy }]));
    return { read, bad, count: paths.length, newest, newestFile: newest ? found[newest].file : null };
}

/**
 * Write the copy now, if `copyRefusal` allows it: list and merge what the folder holds first, then upload the case
 * this browser holds to the newest copy's name (a new random name when there is none). `explicit` is a GM's own press,
 * which any GM may make; the debounced writes are the primary's. Answers "written", "same" (the newest copy already
 * holds this case), or the refusal.
 */
export async function writeServerCopy({ explicit = false } = {}) {
    if (state.running) await state.running.catch(() => {});
    const why = copyRefusal({ isGM: Boolean(game.user?.isGM), primary: explicit || isPrimaryGm(), hydrated: SEAL_DEPS.hydrated(),
        files: game.user?.isGM ? filesPrivate() : null, quiet: gmStoresQuiet() });
    if (why) {
        state.refused[why] = (state.refused[why] ?? 0) + 1;
        state.last = why;
        tellRefused(why);
        return why;
    }
    const run = (async () => {
        const seen = await readServerCopies();
        if (seen.refused) return (state.last = seen.refused);
        // Read again just before the write: a hydration that went while the folder was read, or the suite's hold.
        if (!SEAL_DEPS.hydrated()) return (state.last = "notHydrated");
        if (gmStoresQuiet()) return (state.last = "quiet");
        const file = await caseFileNow();
        if (seen.newestFile && stableJson(seen.newestFile.stores ?? {}) === stableJson(file.stores ?? {})) return (state.last = "same");
        const name = seen.newest ? seen.newest.slice(seen.newest.lastIndexOf("/") + 1) : newCopyName();
        const FP = picker();
        if (!seen.count) {
            try { await FP.createDirectory("data", copyFolder()); }
            catch (err) { if (!/exist/i.test(String(err?.message ?? err))) throw err; }
        }
        const blob = new globalThis.File([JSON.stringify(file)], name, { type: "application/json" });
        await FP.upload("data", copyFolder(), blob, {}, { notify: false });
        state.copies[`${copyFolder()}/${name}`] = { exportedAt: file.exportedAt, exportedBy: file.exportedBy };
        state.wrote++;
        return (state.last = "written");
    })();
    state.running = run;
    try { return await run; }
    catch (err) { error("The case's server copy could not be written", String(err?.message ?? err)); return (state.last = "failed"); }
    finally { if (state.running === run) state.running = null; }
}

/** A refusal that the GMs must act on is told once a session, on this GM's screen: the files open to players. */
function tellRefused(why) {
    if (!["switchOff", "roles", "account"].includes(why) || state.told.has(why)) return;
    state.told.add(why);
    ui.notifications?.warn?.(game.i18n.localize(`DRPG.Case.copy.refused.${why}`), { permanent: true });
}

/** Ask for a write: SEAL_QUIET_MS after the last ask, at most SEAL_MOST_MS after the first one waiting. */
export function scheduleCopy() {
    if (!game.user?.isGM) return false;
    const now = Date.now();
    if (state.timer === null) state.first = now;
    else clearTimeout(state.timer);
    const wait = Math.max(0, Math.min(SEAL_QUIET_MS, state.first + SEAL_MOST_MS - now));
    state.timer = setTimeout(() => {
        state.timer = null;
        if (isPrimaryGm()) void writeServerCopy();
    }, wait);
    return true;
}

/** The pending write, written now (the suite): what `writeServerCopy` answers, or null when none waited. */
export async function flushCopy() {
    if (state.timer === null) return null;
    clearTimeout(state.timer);
    state.timer = null;
    return writeServerCopy();
}

/**
 * What the health check and the window say of the copy: `{ found, count, exportedAt, exportedBy, refused }` from the
 * last listing this browser made and the permissions in force now. Names no file.
 */
export function copyStatus() {
    const copies = Object.values(state.copies);
    const newest = copies.reduce((a, c) => (!a || String(c.exportedAt ?? "") > String(a.exportedAt ?? "") ? c : a), null);
    return { found: copies.length > 0, count: copies.length, exportedAt: newest?.exportedAt ?? null, exportedBy: newest?.exportedBy ?? null,
        refused: game.user?.isGM ? filesPrivate() : "notGm", last: state.last };
}

/* ------------------------------ the wiring ------------------------------ */

let registered = false;

/**
 * Registered at ready (module.mjs), on a GM's browser only: once its stores are hydrated it reads the folder (and
 * the primary writes what it holds beyond it); a change of a backed-up store asks for a write. A browser whose
 * planner is still empty after the read, with no copy found, is told where the case can come from.
 */
export function registerCaseCopy() {
    if (registered || !game.user?.isGM) return;
    registered = true;
    onGmStoresHydrated(() => { void copyAtLoad(); });
    Hooks.on("clientSettingChanged", key => {
        if (!gmStoreHandles().some(h => h.spec.backup && key === `${MODULE_ID}.${h.spec.key}`)) return;
        scheduleCopy();
    });
}

async function copyAtLoad() {
    try {
        const files = filesPrivate();
        /* THE FILES OPEN TO PLAYERS: NOTHING READ, AND EVERY GM TOLD (line INVEST of 1.2.122; audit 1.2.118 E111-2 and
           domain-case-f-planner-stores 5). Not read on purpose: a player who may upload can have written the file, and a
           restore of it would be a player's write into the GMs' stores. Until this line only the primary was told, and
           the text said only that no copy is written; it now says that none is read either, and that a copy written
           before stays in the world's folder, within a player's reach, to be deleted by hand (Q-E111-5's default). */
        if (files) {
            tellRefused(files);
            state.last = files;
            return;
        }
        const seen = await readServerCopies();
        state.last = seen.refused ?? "read";
        if (!seen.refused && isPrimaryGm()) scheduleCopy();
        // Said only in a world whose case was recorded before (`caseMark.since`): a new world's empty planner is no news.
        if (!seen.refused && !seen.read && plannerEmpty() && caseMark().since) {
            ui.notifications?.info?.(game.i18n.localize("DRPG.Case.copy.emptyHere"));
        }
    } catch (err) {
        warn("The case's server copy could not be read at load", String(err?.message ?? err));
    }
}
