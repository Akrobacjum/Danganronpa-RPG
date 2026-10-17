/**
 * Danganronpa RPG - other modules' client settings, held for the whole table.
 * ---------------------------------------------------------------------------
 * WHY THIS FILE EXISTS (E27, 24.09.2026; audit S16-03, project N2, decision
 * D19). Some things a table needs are settings of OTHER modules, and some of
 * those are CLIENT-scoped: they live in each browser's own storage, so a GM who
 * turns one off has turned it off for one browser. Isometric Perspective's
 * welcome window is the first of them - Dawid switched it off long ago, and
 * every player still met it on every start, with no idea where it lived.
 *
 * So each row below names a setting, the value the table plays with, and a
 * WORLD switch of this module that decides whether the row is held. Held means
 * two things, on every client, GM included:
 *
 *   1. The value is written at `setup`: after every module has registered its
 *      settings in its own `init`, and before any of them reads one in `ready`
 *      (Isometric Perspective decides on its welcome in `Hooks.once("ready")`).
 *   2. The setting disappears from that person's Configure Settings, by setting
 *      `config: false` on its entry in `game.settings.settings`. Without this a
 *      player would see a "Show Welcome Screen" box that springs back after
 *      every change - which reads as a bug, and D19 says the players have no say
 *      in these. A change made anyway (a macro, the console) is put back by the
 *      `clientSettingChanged` listener, the same hook `dice-sync.mjs` found is
 *      the one Foundry really fires for a client setting.
 *
 * WHAT IT WILL NOT DO. It writes only a setting that is registered - the module
 * enabled, the key present in the version installed - so a module that renames
 * its setting costs a warning in the console, once, not an error. `config` is a field of
 * a registry entry, not public API: where the entry is not the shape expected,
 * the row still holds the value and says in the console that it could not hide
 * the box. With the world switch off, nothing is written and `config` is given
 * back what it had.
 *
 * E19 adds two rows here (the LiveKit tab and the camera dock, D19b); that is
 * why this is a table and not one function about Isometric Perspective.
 *
 * TWO ROWS THAT ARE NOT ANOTHER MODULE'S CLIENT SETTING, AND ONE WINDOW (E79 C9,
 * 16.10.2026; the owner's N1, N2 and N4 of 14.10.2026). Each says beside it what
 * was read and what was not:
 *   - `dhWelcome` (N1): Daggerheart's welcome journal is decided by a USER FLAG,
 *     so the row's kind is `userFlag` and it is held on this browser's own copy
 *     of its account, never written (`holdUserFlag`).
 *   - `playerFiles` (N4): Foundry's own WORLD setting `core.permissions`, held by
 *     the primary GM alone so that FILES_BROWSE and FILES_UPLOAD carry neither
 *     the Player nor the Trusted Player role, and put back when a GM changes
 *     them (`holdPermissions`); on a player's browser the sheets' portraits lose
 *     Foundry's editImage action and a file browser that opens anyway is closed.
 *   - N2: a User Configuration window that opens by itself while this browser
 *     starts is closed (`closeUnaskedUserConfig`). No switch: nothing at a table
 *     asks for that window before anybody clicked.
 */

import { MODULE_ID } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { warn, error, isPrimaryGm, whisperToGms } from "./utils.mjs";

/**
 * @typedef {object} EnforcedRow
 * @property {string} id       A name for the log and the tests.
 * @property {string} [kind]   Absent for another module's client setting; "userFlag" or "permissions" (E79 C9).
 * @property {string} [module] The owning module's id ("core" for Foundry's own setting).
 * @property {string} [key]    The setting's key in that namespace.
 * @property {*}      [value]  What the table plays with.
 * @property {string} [system] A `userFlag` row: the game system it belongs to.
 * @property {string} [scope]  A `userFlag` row: the flag's scope.
 * @property {string} [flag]   A `userFlag` row: the flag's key.
 * @property {string[]} [permissions] A `permissions` row: the permissions it holds.
 * @property {string[]} [roles]       A `permissions` row: the roles, by name, taken off them.
 * @property {string} toggle   This module's world setting that turns the row on.
 */

/** @type {EnforcedRow[]} */
export const ENFORCED = [
    /* The welcome window of Isometric Perspective: `showWelcome`, client-scoped,
       default true, read once in its `ready` (main.js, welcome.js in 1.9.x). */
    { id: "isoWelcome", module: "isometric-perspective", key: "showWelcome", value: false,
      toggle: SETTINGS.enforceIsoWelcome },
    /* Daggerheart's welcome journal (N1). Its `ready` (2.6.5 daggerheart.mjs:340-345, 2.10.5
       :394-399, read during the design on 16.10.2026; neither copy is in this repository) opens
       Compendium.daggerheart.journals.JournalEntry.g7NhKvwltwafmMyR when
       `game.user.getFlag("daggerheart", "welcome-message")` is unset, and then sets it: once per
       ACCOUNT, and not a setting, so the road above does not carry it. Held at `setup`, before any
       `ready`, on this browser's copy of its account alone: the account on the server keeps what it
       had, so the switch off brings the journal back at the next start of an account that never
       saw it. Not run at a table: LIVE-E79-09. */
    { id: "dhWelcome", kind: "userFlag", system: "daggerheart", scope: "daggerheart", flag: "welcome-message",
      value: true, toggle: SETTINGS.enforceDhWelcome },
    /* Players browse and upload no files (N4). Foundry's defaults for the two permissions on v14
       are not readable here (fvtt-types 14.366 constants.d.mts 1425-1450 name the permissions, not
       their roles), so the held value is taken from what is in force when it is written, never
       from the stored value alone (`heldPermissions`). LIVE-E79-11. */
    { id: "playerFiles", kind: "permissions", module: "core", key: "permissions",
      permissions: ["FILES_BROWSE", "FILES_UPLOAD"], roles: ["PLAYER", "TRUSTED"],
      toggle: SETTINGS.enforcePlayerFiles }
];

/** When this browser's `ready` ran; null before it. The permissions are held from then on (a world
    setting is the primary GM's to write, and which GM that is is known at `ready`), and N2's start
    runs until 30 s after it. */
let readyAt = null;

/** How long after `ready` a User Configuration window that nobody asked for is still a start-up one. */
const START_WINDOW_MS = 30000;

/** What `config` was on each entry before a row hid it, so switching the row off can give it back. */
const hiddenFrom = new Map();

const fullKey = row => `${row.module}.${row.key}`;

/** Said once per row per session: a module that renamed its setting is worth one line, not one per call. */
const saidMissing = new Set();

/**
 * The registry entry for a row's setting, or null when it is not registered here.
 *
 * A module that is ON but has no such key has renamed or dropped it, and the row
 * silently holds nothing - so that is a `warn`, which prints by default. The first
 * version said it through `debug`, which prints only with the module's debug
 * switch on, while this file's header promised "a line in the console" (the review
 * of E27). A module that is simply not installed or not enabled is not news.
 */
function entryOf(row) {
    if (!game.modules.get(row.module)?.active) return null;
    const entry = game.settings.settings.get(fullKey(row)) ?? null;
    if (!entry && !saidMissing.has(row.id)) {
        saidMissing.add(row.id);
        warn(`Enforced settings: ${row.module} is enabled but has no setting "${row.key}" in this version, so it is not held.`);
    }
    return entry;
}

/** Whether the world wants this row held. Unreadable (too early, or unregistered) reads as the default: on. */
function wanted(row) {
    try {
        return game.settings.get(MODULE_ID, row.toggle) !== false;
    } catch {
        return true;
    }
}

/**
 * Hide the row's box from Configure Settings, remembering what it was.
 *
 * NEVER THROWS, AND IS ASKED WHETHER IT WORKED (the review of E27). `config` is a
 * field of a registry entry, not an API: a version that makes it a getter or
 * freezes the entry turns the assignment into a TypeError, and the first version
 * of this ran before the value was written - so a box that could not be hidden
 * meant a value that was never held either, and every row after it skipped
 * (measured with a getter-only `config`: the welcome came back on). The value is
 * written first now (`applyEnforced`), the assignment is tried, and the entry is
 * read back.
 */
function hide(row, entry) {
    const was = entry?.config;
    try {
        if (!hiddenFrom.has(fullKey(row))) hiddenFrom.set(fullKey(row), was);
        entry.config = false;
    } catch { /* read back below */ }
    if (entry?.config !== false) {
        hiddenFrom.delete(fullKey(row));
        warn(`Enforced settings: could not hide ${fullKey(row)} from Configure Settings in this version; its value is held all the same.`);
    }
}

/** Give the box back, if this file hid it. Never throws either. */
function unhide(row, entry) {
    if (!hiddenFrom.has(fullKey(row))) return;
    try { entry.config = hiddenFrom.get(fullKey(row)); } catch { /* nothing more to do */ }
    hiddenFrom.delete(fullKey(row));
}

/**
 * Hold every row the world wants held, and let go of every row it does not.
 * Safe to call again: a value already in place is not written twice.
 *
 * @param {EnforcedRow[]} [rows]  The table; handed in only by the suite (R131),
 *   which asks about a row for a module that is not there.
 * @returns {Promise<string[]>} the ids of the rows held on this client.
 */
export async function applyEnforced(rows = ENFORCED) {
    const held = [];
    /* The account's flags first, before anything here waits (E79 C9). `setup` does not wait on this
       function, and Daggerheart reads its welcome flag at `ready`: held after the first `await` below,
       it was still unset when the harness's stand-in for Daggerheart's `ready` read it (15-held N1,
       16.10.2026), because the Isometric Perspective row ahead of it waits on its write. */
    for (const row of rows) {
        if (row.kind !== "userFlag") continue;
        try {
            if (holdUserFlag(row)) held.push(row.id);
        } catch (err) {
            error(`Could not hold the ${row.scope}.${row.flag} flag for the table`, err);
        }
    }
    for (const row of rows) {
        if (row.kind === "userFlag") continue;
        try {
            if (row.kind === "permissions") {
                if (await holdPermissions(row)) held.push(row.id);
                continue;
            }
            const entry = entryOf(row);
            if (!entry) continue;
            if (!wanted(row)) {
                unhide(row, entry);
                continue;
            }
            // The value first: it is the promise to the table; the hidden box is a courtesy.
            if (game.settings.get(row.module, row.key) !== row.value) {
                await game.settings.set(row.module, row.key, row.value);
            }
            held.push(row.id);
            hide(row, entry);
        } catch (err) {
            // One row that cannot be held must not stop the rows after it.
            error(`Could not hold ${fullKey(row)} for the table`, err);
        }
    }
    return held;
}

/**
 * The second layer: a change made to a held setting anyway is put back.
 *
 * Cannot loop - putting the value back fires this hook again with the value
 * already right, and that is the first thing it checks.
 */
function onClientSettingChanged(id) {
    const row = ENFORCED.find(r => fullKey(r) === id);
    if (!row || !wanted(row) || !entryOf(row)) return;
    /* The stored value, read back - not the hook's argument (the review of E27):
       whatever form Foundry hands the listener, `get` answers in the setting's own
       type, so the value already in place is recognised and the put-back cannot
       fire itself again. */
    let now;
    try { now = game.settings.get(row.module, row.key); } catch { return; }
    if (now === row.value) return;
    game.settings.set(row.module, row.key, row.value)
        .catch(err => error(`Could not put ${id} back for the table`, err));
}

/**
 * A user flag held on this browser's copy of its account (N1), and only there.
 *
 * `updateSource` changes the copy in this browser and sends nothing, so the
 * server, the other browsers and the world as the suite dumps it never see the
 * flag. Read off `flags` rather than `getFlag`, which throws for a scope that is
 * not a package of this world - the system test before it is what keeps a world
 * of another system out (R131's road for a module that is not here).
 *
 * @returns {boolean} whether the row is held on this browser.
 */
export function holdUserFlag(row, { user = game.user, system = game.system?.id, on = wanted(row) } = {}) {
    if (!user || system !== row.system || !on) return false;
    if (!user.flags?.[row.scope]?.[row.flag]) {
        user.updateSource({ flags: { [row.scope]: { [row.flag]: row.value } } });
    }
    return true;
}

/**
 * Foundry's permissions as they stand: each permission's roles from its default
 * role up, where `CONST.USER_PERMISSIONS` states one, and over them the table
 * `game.permissions` holds. Which of the two v14 fills for a permission no world
 * ever stored is not read here (LIVE-E79-11); reading both, the hold never
 * writes a permission as missing that was in force.
 */
export function permissionsInForce() {
    const roles = Object.values(CONST.USER_ROLES ?? {}).filter(role => role > 0);
    const out = {};
    for (const [name, def] of Object.entries(CONST.USER_PERMISSIONS ?? {})) {
        if (Number.isInteger(def?.defaultRole)) out[name] = roles.filter(role => role >= def.defaultRole);
    }
    for (const [name, list] of Object.entries(game.permissions ?? {})) {
        if (Array.isArray(list)) out[name] = [...list];
    }
    return out;
}

/**
 * The value of `core.permissions` the table plays with: the stored value, with
 * the row's permissions carrying none of its roles. A permission the stored
 * value does not name is taken from `defaults` - the permissions in force -
 * before the roles come off, and from the two GM roles when nothing names it.
 * Every other permission is left as it was found, and so is every per-account
 * grant, which lives on the user and not here.
 */
export function heldPermissions(value, defaults = {}, row = ENFORCED.find(r => r.kind === "permissions")) {
    const roles = CONST.USER_ROLES;
    const take = row.roles.map(name => roles[name]);
    const out = foundry.utils.deepClone(value ?? {});
    for (const name of row.permissions) {
        const from = Array.isArray(out[name]) ? out[name]
            : Array.isArray(defaults?.[name]) ? defaults[name] : [roles.ASSISTANT, roles.GAMEMASTER];
        out[name] = from.filter(role => !take.includes(role));
    }
    return out;
}

const sameRoles = (a, b) => Array.isArray(a) && Array.isArray(b)
    && a.length === b.length && a.every(role => b.includes(role));

/* One hold at a time: the hold's own write comes back through `updateSetting` while the
   next may already be asked, and two holds reading the same value would write twice. */
let permissionsQueue = Promise.resolve();

/* The words for what a hold took away; literal keys, so the language check reads each one. */
const LOST_ROLES = { PLAYER: "DRPG.Enforced.lost.player", TRUSTED: "DRPG.Enforced.lost.trusted" };
const LOST_PERMISSIONS = { FILES_BROWSE: "DRPG.Enforced.lost.browse", FILES_UPLOAD: "DRPG.Enforced.lost.upload" };

/**
 * What a hold takes away, role by role: each of the row's roles with the row's
 * permissions it held before (the stored value, else the one in force, as
 * `heldPermissions` reads them) and does not after. Empty when the write changes
 * nobody's permissions - a permission stored for the first time, say.
 *
 * @returns {{ role: string, permissions: string[] }[]}
 */
export function permissionsLost(stored, inForce, held, row = ENFORCED.find(r => r.kind === "permissions")) {
    const roles = CONST.USER_ROLES;
    const before = name => Array.isArray(stored?.[name]) ? stored[name]
        : Array.isArray(inForce?.[name]) ? inForce[name] : [roles.ASSISTANT, roles.GAMEMASTER];
    return row.roles.map(role => ({ role, permissions: row.permissions.filter(name =>
        before(name).includes(roles[role]) && !(held?.[name] ?? []).includes(roles[role])) }))
        .filter(entry => entry.permissions.length);
}

/**
 * Hold `core.permissions` (N4) on the primary GM, after `ready`.
 *
 * Writes only when one of the row's permissions is not as held, so the write's
 * own `updateSetting` finds nothing to do and cannot loop. `tell` is a GM's
 * change put back: the GMs are told, once per put-back. `first` is the hold at
 * `ready`: when it took a permission from a role, the GMs are told which, and that
 * the switch's off does not give it back (E79 fix r3-G1, 17.10.2026; review round 3's
 * P4: until then the first hold at 1.2.79's first start took the Trusted Player's
 * browse and upload away without a word where they stood at their defaults - both
 * TRUSTED in the harness's Foundry, audit/harness/client-entry.mjs; v14's own not read
 * here). A switch turned on is the GM's own act and
 * is not news.
 *
 * @returns {Promise<boolean>} whether this browser holds the row.
 */
function holdPermissions(row, { tell = false, first = false } = {}) {
    const run = permissionsQueue.then(async () => {
        if (readyAt === null || !isPrimaryGm() || !wanted(row)) return false;
        let stored;
        try { stored = game.settings.get("core", "permissions") ?? {}; } catch { return false; }
        const inForce = permissionsInForce();
        const held = heldPermissions(stored, inForce, row);
        if (row.permissions.every(name => sameRoles(stored[name], held[name]))) return true;
        await game.settings.set("core", "permissions", held);
        if (tell) await whisperToGms(`<p>${game.i18n.localize("DRPG.Enforced.filesPutBack")}</p>`);
        else if (first) {
            const lost = permissionsLost(stored, inForce, held, row).map(({ role, permissions }) =>
                `${game.i18n.localize(LOST_ROLES[role])}: ${permissions.map(name => game.i18n.localize(LOST_PERMISSIONS[name])).join(", ")}`);
            if (lost.length) await whisperToGms(`<p>${game.i18n.format("DRPG.Enforced.filesFirstHold", { lost: lost.join("; ") })}</p>`);
        }
        return true;
    });
    permissionsQueue = run.catch(() => false);
    return run;
}

/** A world setting changed: `core.permissions` is put back when a GM's change reached what is held. */
function onWorldSettingUpdated(setting) {
    if (setting?.key !== "core.permissions") return;
    const row = ENFORCED.find(r => r.kind === "permissions");
    holdPermissions(row, { tell: true }).catch(err => error("Could not put the file permissions back", err));
}

/** Whether this account may see files: a GM, or an account a GM granted browsing by name. */
const maySeeFiles = user => Boolean(user?.isGM) || user?.permissions?.FILES_BROWSE === true;

const filesHeld = () => wanted(ENFORCED.find(r => r.kind === "permissions"));

/**
 * N4 on a player's browser: the portraits of a sheet lose Foundry's editImage
 * action. Daggerheart 2.6.5 puts `data-action='editImage' data-edit="img"` on
 * the portrait (sidebar.hbs:3, limited.hbs:3, read during the design), and
 * DocumentSheetV2 dispatches that attribute to a file browser; both attributes
 * go, as anonymity.mjs takes off the actions it disarms, and nothing else on the
 * sheet is touched.
 *
 * @returns {number} how many elements were disarmed.
 */
export function disarmPortraits(root, { user = game.user, on = filesHeld() } = {}) {
    const el = root?.querySelectorAll ? root : root?.[0];
    if (!on || !el?.querySelectorAll || maySeeFiles(user)) return 0;
    const armed = [...el.querySelectorAll('[data-action="editImage"]')];
    for (const node of armed) {
        node.removeAttribute("data-action");
        node.removeAttribute("data-edit");
    }
    return armed.length;
}

/**
 * N4's backstop: a file browser rendered on a player's browser by any other road
 * - the token's configuration, a journal's image, a console - is closed. Which of
 * those roads v14 opens for a player is LIVE-E79-11.
 */
export function closePlayerFilePicker(app, { user = game.user, on = filesHeld() } = {}) {
    if (!on || !app || maySeeFiles(user)) return false;
    app.close?.({ animate: false });
    return true;
}

/**
 * N2: a User Configuration window of this browser's own account that opens by
 * itself while the browser starts is closed. Nothing in scripts/ or in
 * Daggerheart 2.6.5 or 2.10.5 opens one (grep, 16.10.2026), so its opener is
 * Foundry's or another module's, which cannot be read here and is not
 * prevented: the window is closed after it renders (LIVE-E79-10 asks whether
 * that shows). A person opening it has just clicked, and the browser says so
 * (`navigator.userActivation.isActive`); where the browser has no such reading
 * nothing is closed. Only the window's first render, from `setup` to 30 s
 * after `ready`, and never a GM's window on another account.
 *
 * @returns {boolean} whether it was closed.
 */
export function closeUnaskedUserConfig(app, options = {}, {
    user = game.user, activation = globalThis.navigator?.userActivation, now = Date.now(), since = readyAt
} = {}) {
    const doc = app?.document ?? app?.object;
    if (!doc || !user || doc.id !== user.id) return false;
    if (options?.isFirstRender === false) return false;
    if (since !== null && now - since > START_WINDOW_MS) return false;
    if (activation?.isActive !== false) return false;
    app.close?.({ animate: false });
    return true;
}

/** Called from module.mjs's `setup` hook. */
export function registerEnforced() {
    Hooks.on("clientSettingChanged", onClientSettingChanged);
    Hooks.on("updateSetting", onWorldSettingUpdated);
    Hooks.on("renderUserConfig", (app, _el, _context, options) => { closeUnaskedUserConfig(app, options); });
    Hooks.on("renderDocumentSheetV2", (_app, el) => { disarmPortraits(el); });
    Hooks.on("renderFilePicker", app => { closePlayerFilePicker(app); });
    Hooks.once("ready", () => {
        readyAt = Date.now();
        holdPermissions(ENFORCED.find(r => r.kind === "permissions"), { first: true })
            .catch(err => error("Could not hold the file permissions", err));
    });
    applyEnforced().catch(err => error("Could not hold the table's settings", err));
}
