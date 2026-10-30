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
 *      `clientSettingChanged` listener, the one hook Foundry really fires for
 *      a client setting (R14 holds every such listener to it).
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
 * THE TWO VOICE ROWS (E19 C1, 19.10.2026; S16-04, the owner's A9 note of 11.10.2026):
 *   - `liveKitInFoundry`: avclient-livekit's client setting `useExternalAV` held
 *     false by the road above, so no browser joins voice from a page of its own;
 *   - `rtcDock`: Foundry's own `core.rtcClientSettings` holds a player's devices,
 *     volumes and push-to-talk beside the dock, so this row (kind `rtc`) writes
 *     two kinds of field and nothing else - `hideDock` true and each user's
 *     `popout` false - one at a time through `game.webrtc.settings.set`
 *     (`holdRtcDock`), never the whole object, and never the dock's position. Its
 *     switch is the voice tile's (`voiceTile`), and it is held only where the
 *     tile hides the dock (`rtcDockOn`). Off, each field is given back once as
 *     this browser had it before the first hold (E19 fix r1-G2, below), and
 *     nothing more is written.
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
import { SETTINGS, getSetting } from "./settings.mjs";
import { warn, error, isPrimaryGm, whisperToGms, esc, dialogContent, tableDialog } from "./utils.mjs";

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
 * @property {object} [fields]      An `rtc` row: the client AV fields it holds, by key (E19 C1).
 * @property {object} [userFields]  An `rtc` row: the fields it holds in every user's row of `users`.
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
      toggle: SETTINGS.enforcePlayerFiles },
    /* avclient-livekit's "separate window" (E19 C1, S16-04): `useExternalAV` true sends a browser's
       voice from LiveKit's own web page instead of the Foundry window. Held at `setup`, before the A/V
       client starts; avclient-livekit reads it as its client starts (the plan's reading of 0.6.8, not
       re-read: its source is not on this machine), so the switch asks for a reload. Its registration
       here (scope, `config`) is the harness stand-in's guess (lib/livekit.mjs): LIVE-E19-06. */
    { id: "liveKitInFoundry", module: "avclient-livekit", key: "useExternalAV", value: false,
      toggle: SETTINGS.liveKitInFoundry },
    /* The camera dock folded and no camera popped out (E19 C1, A9): the header's second voice row. */
    { id: "rtcDock", kind: "rtc", module: "core", key: "rtcClientSettings",
      fields: { hideDock: true }, userFields: { popout: false }, toggle: SETTINGS.voiceTile }
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
export function entryOf(row) {
    if (!game.modules.get(row.module)?.active) return null;
    const entry = game.settings.settings.get(fullKey(row)) ?? null;
    if (!entry && !saidMissing.has(row.id)) {
        saidMissing.add(row.id);
        warn(`Enforced settings: ${row.module} is enabled but has no setting "${row.key}" in this version, so it is not held.`);
    }
    return entry;
}

/** Whether the world wants this row held. Unreadable (too early, or unregistered) reads as the default: on. Never
    once a GM gave Foundry's settings back (E20 C6): every row lets go, whatever its own switch says. */
function wanted(row) {
    if (foundryGivenBack()) return false;
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
            if (row.kind === "rtc") {
                if (await holdRtcDock(row)) held.push(row.id);
                continue;
            }
            if (row.kind === "permissions") {
                if (await holdPermissions(row)) held.push(row.id);
                continue;
            }
            const entry = entryOf(row);
            if (!entry) continue;
            if (!wanted(row)) {
                unhide(row, entry);
                if (foundryGivenBack()) await giveBackClientRow(row, entry);
                continue;
            }
            // The value first: it is the promise to the table; the hidden box is a courtesy. What this browser had
            // is read before the first write and kept (E20 C6), for Give back Foundry's settings - kept behind the
            // write, not before it: waiting on the record first, the welcome was held after Isometric Perspective
            // read it at `ready` on the players' browsers (15-held, 30.10.2026).
            const was = game.settings.get(row.module, row.key);
            if (was !== row.value) {
                const keeping = keepClientOriginal(row, was);
                await game.settings.set(row.module, row.key, row.value);
                await keeping;
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
    if (id === "core.rtcClientSettings") {
        scheduleRtcDockPutBack();
        return;
    }
    const row = ENFORCED.find(r => fullKey(r) === id && r.kind !== "rtc");
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
 * What the `rtc` row writes into this browser's A/V client settings, field by
 * field: each of its `fields` not already as held, and each of its `userFields`
 * in every user's row of `users` that is not. Nothing else is named, so the
 * devices, volumes, `muted`, `blocked`, the voice mode and the dock's position
 * stay the player's.
 *
 * @returns {[string, *][]} the keys, in `AVSettings#set`'s dotted form, and values.
 */
export function rtcDockWrites(client, row = ENFORCED.find(r => r.kind === "rtc")) {
    const out = [];
    for (const [key, value] of Object.entries(row?.fields ?? {})) {
        if (client?.[key] !== value) out.push([key, value]);
    }
    for (const [userId, user] of Object.entries(client?.users ?? {})) {
        if (!user || typeof user !== "object") continue;
        for (const [key, value] of Object.entries(row?.userFields ?? {})) {
            if (user[key] !== value) out.push([`users.${userId}.${key}`, value]);
        }
    }
    return out;
}

/**
 * Whether this browser holds the `rtc` row: the voice tile hides the dock here
 * (voice-tile.mjs `dockHiddenFor`, the same two facts as the body class) and the
 * row's switch is on. Without avclient-livekit, or in a world sending no sound,
 * Foundry's dock is the only voice surface and is left as its owner keeps it.
 */
async function rtcDockOn(row) {
    const V = await import("./voice-tile.mjs");
    return V.dockHiddenFor(V.voiceAvailable(), wanted(row));
}

/**
 * What this browser had in the fields the `rtc` row holds before the row first wrote them (E19 fix r1-G2,
 * 19.10.2026; the review's E19-COR-6): `{ fields: { hideDock }, users: { <id>: { popout } } }`. Kept from the
 * record handed in: a field already in it stays as it was taken, since the row puts back every change while it
 * holds; a field not in it yet - the first hold, or a user's row first seen now - is taken as it stands, before
 * this hold writes it. The same object back when nothing was added, so an unchanged record is not saved again.
 *
 * @param {object} client    `AVSettings#client`
 * @param {EnforcedRow} row
 * @param {object} [was]     the record so far (`rtcDockBefore`); `{}` or nothing before the first hold
 * @returns {object}
 */
export function rtcDockRecord(client, row, was) {
    const had = was && typeof was === "object" ? was : {};
    const fields = { ...(had.fields ?? {}) }, users = { ...(had.users ?? {}) };
    let added = false;
    for (const key of Object.keys(row?.fields ?? {})) {
        if (key in fields || client?.[key] === undefined) continue;
        fields[key] = client[key];
        added = true;
    }
    for (const [userId, user] of Object.entries(client?.users ?? {})) {
        if (!user || typeof user !== "object") continue;
        const kept = { ...(users[userId] ?? {}) };
        for (const key of Object.keys(row?.userFields ?? {})) {
            if (key in kept || user[key] === undefined) continue;
            kept[key] = user[key];
            added = true;
        }
        users[userId] = kept;
    }
    return added ? { fields, users } : had;
}

/**
 * The writes that give a released `rtc` row's fields back (E19 fix r1-G2): each field of the record that differs
 * from this browser's client settings now, in `AVSettings#set`'s dotted form, and nothing the record does not name.
 * A user no longer in `users` is skipped.
 *
 * @returns {[string, *][]}
 */
export function rtcDockGiveBack(client, record) {
    const out = [];
    for (const [key, value] of Object.entries(record?.fields ?? {})) {
        if (value !== null && value !== undefined && client?.[key] !== value) out.push([key, value]);
    }
    for (const [userId, kept] of Object.entries(record?.users ?? {})) {
        const user = client?.users?.[userId];
        if (!user || typeof user !== "object" || !kept || typeof kept !== "object") continue;
        for (const [key, value] of Object.entries(kept)) {
            if (value !== null && value !== undefined && user[key] !== value) out.push([`users.${userId}.${key}`, value]);
        }
    }
    return out;
}

/** The record `holdRtcDock` keeps between sessions: this module's client setting `rtcDockBefore` (E19 fix r1-G2). */
const dockRecordSetting = {
    get: () => {
        try { return getSetting(SETTINGS.rtcDockBefore) ?? {}; } catch { return {}; }
    },
    set: value => game.settings.set(MODULE_ID, SETTINGS.rtcDockBefore, value)
};

/**
 * Hold the `rtc` row on this browser (E19 C1, A9): each write one field, through
 * `AVSettings#set`, which merges it into the copy in memory and saves that copy
 * itself (100 ms later, as A9 reads Foundry's AVSettings; not measured here). A
 * `game.settings.set` of the whole object from a copy taken earlier would save
 * over a microphone or a volume changed in between (R809). `av` is absent before
 * Foundry's A/V master exists (`setup`); the hold runs again at `ready`.
 *
 * THE DOCK BACK AS IT WAS (E19 fix r1-G2, 19.10.2026; the review's E19-COR-6, E19-04's "voiceTile off: the dock
 * back"). Until the fix the row let go by writing nothing and kept nothing, so every dock it had folded stayed
 * folded, with no camera on any screen, after the GM switched the voice tile off - and after the module was
 * disabled. Now each hold first keeps what this browser had in the fields it is about to write (`rtcDockRecord`,
 * saved in this module's client setting `rtcDockBefore`, this browser's own), and a browser that does not hold the
 * row writes each kept field back once where it differs (`rtcDockGiveBack`), through the same `set`, then forgets
 * the record: after that nothing is written, as before. A dock its owner folded before the tile came stays folded.
 * Disabling the module runs nothing, so the handbook asks for the switch off first.
 *
 * @param {EnforcedRow} [row]
 * @param {object} [options]
 * @param {object|null} [options.av]  Foundry's AVSettings; handed in only by the suite (R809).
 * @param {boolean} [options.on]      Whether the row is held here; read when absent.
 * @param {{get: () => object, set: (value: object) => Promise<unknown>}} [options.before]  the record's store;
 *   `rtcDockBefore` unless the suite hands one in (R809)
 * @returns {Promise<boolean>} whether this browser holds the row.
 */
export async function holdRtcDock(row = ENFORCED.find(r => r.kind === "rtc"), { av = game.webrtc?.settings, on, before = dockRecordSetting } = {}) {
    const held = on ?? await rtcDockOn(row);
    if (typeof av?.set !== "function" || !av.client) return false;
    const was = before.get();
    if (!held) {
        const back = rtcDockGiveBack(av.client, was);
        for (const [key, value] of back) av.set("client", key, value);
        if (Object.keys(was ?? {}).length) await before.set({});
        return false;
    }
    const record = rtcDockRecord(av.client, row, was);
    if (record !== was) await before.set(record);
    for (const [key, value] of rtcDockWrites(av.client, row)) av.set("client", key, value);
    return true;
}

/* The put-back after a change to `core.rtcClientSettings` waits until Foundry's AVSettings has read
   the change into its copy (its own 100 ms debounce, as A9 reads it): a choice past it, not a
   measurement. One wait at a time; the put-back's own save comes back here and finds nothing to write. */
const RTC_SETTLE_MS = 250;
let rtcPutBack = null;

function scheduleRtcDockPutBack() {
    if (rtcPutBack) return;
    rtcPutBack = setTimeout(() => {
        rtcPutBack = null;
        holdRtcDock().catch(err => error("Could not put the camera dock back for the table", err));
    }, RTC_SETTLE_MS);
}

/* The A/V Config window's fields the `rtc` row holds, as a form of AVSettings' client schema names
   them; Foundry v14's own template is not read here (LIVE-E19-06). */
const HELD_AV_FIELDS = '[name="client.hideDock"], [name^="client.users."][name$=".popout"]';

/**
 * The fields of the A/V Config window the `rtc` row holds are disabled while it
 * is held, so a player is not offered a choice that springs back (D19).
 *
 * @returns {number} how many fields were disabled.
 */
export function disableHeldAvFields(root, { on = false } = {}) {
    const el = root?.querySelectorAll ? root : root?.[0];
    if (!on || !el?.querySelectorAll) return 0;
    const fields = [...el.querySelectorAll(HELD_AV_FIELDS)];
    for (const field of fields) field.disabled = true;
    return fields.length;
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
        await keepOriginal("permissions", permissionsOriginal(stored, row));
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

/* ==========================================================================
 * GIVE BACK FOUNDRY'S SETTINGS (E20 C6, 30.10.2026; S03-37, Q-5)
 * --------------------------------------------------------------------------
 * The module writes settings that are not its own at every start: Daggerheart's Vulnerable and Defeated automations
 * (states.mjs `suppressSystemAutomation`), the file permissions, Isometric Perspective's welcome and LiveKit's
 * separate window (the rows above), and the scenes with rooms (fog.mjs `applySceneVisionMode`, which keeps their
 * own values on each scene and gives them back when "Rooms decide what players can see" goes off). Until E20 none of
 * the settings kept what it found, and the only word of the automations was the log. Now each writer keeps the value
 * it found before its first write - the world's in `foundryBefore`, this browser's in `foundryBeforeClient` - and a
 * GM's Give back Foundry's settings (the module's settings window) writes them back once and stops every writer
 * (`foundryGivenBack`), until a GM holds them again. Disabling the module runs no code, so the GM handbook asks for
 * the button first.
 * ========================================================================== */

/** What the module changes in Foundry, for the window and the handbook; literal keys, so the language check reads each. */
export const FOUNDRY_WRITES = [
    { id: "automation", text: "DRPG.GiveBack.what.automation" },
    { id: "playerFiles", text: "DRPG.GiveBack.what.playerFiles" },
    { id: "isoWelcome", text: "DRPG.GiveBack.what.isoWelcome" },
    { id: "dhWelcome", text: "DRPG.GiveBack.what.dhWelcome" },
    { id: "liveKitInFoundry", text: "DRPG.GiveBack.what.liveKitInFoundry" },
    { id: "rtcDock", text: "DRPG.GiveBack.what.rtcDock" },
    { id: "sceneVision", text: "DRPG.GiveBack.what.sceneVision" }
];

/** Whether a GM gave Foundry's settings back; unreadable (too early) reads as no. */
export function foundryGivenBack() {
    try {
        return getSetting(SETTINGS.foundryGivenBack) === true;
    } catch {
        return false;
    }
}

/** `record` with `value` kept under `key`, unless a value is kept there already or there is none. Pure. */
export function keptOriginal(record, key, value) {
    const had = record && typeof record === "object" ? record : {};
    if (Object.prototype.hasOwnProperty.call(had, key) || value === undefined) return had;
    return { ...had, [key]: foundry.utils.deepClone(value) };
}

/** The row's permissions as stored before a hold: each one's roles, or null where the stored value names none. Pure. */
export function permissionsOriginal(stored, row = ENFORCED.find(r => r.kind === "permissions")) {
    return Object.fromEntries(row.permissions.map(name => [name, Array.isArray(stored?.[name]) ? [...stored[name]] : null]));
}

/** `stored` with the row's permissions as `kept` has them: a list written back, a null taken out (Foundry's default). Pure. */
export function permissionsGivenBack(stored, kept, row = ENFORCED.find(r => r.kind === "permissions")) {
    const out = foundry.utils.deepClone(stored ?? {});
    for (const name of row.permissions) {
        if (!kept || !Object.prototype.hasOwnProperty.call(kept, name)) continue;
        if (Array.isArray(kept[name])) out[name] = [...kept[name]];
        else delete out[name];
    }
    return out;
}

/** What a client setting goes back to: the value kept, else the setting's registered default, else null. Pure. */
export function clientOriginalFor(record, key, entry) {
    if (record && Object.prototype.hasOwnProperty.call(record, key)) return record[key];
    return entry && entry.default !== undefined ? entry.default : null;
}

/* The keys this browser has given back already, inside its record: given back once, then left alone, so a value its
   owner sets afterwards is theirs. */
const GIVEN = "@given";

/**
 * One client row given back (pure): what to write (undefined for nothing) and the record after - the key's kept
 * value dropped and the key listed as given back. A key given back already writes nothing.
 */
export function clientGiveBack(record, key, entry, now) {
    const had = record && typeof record === "object" ? record : {};
    const given = Array.isArray(had[GIVEN]) ? had[GIVEN] : [];
    if (given.includes(key)) return { write: undefined, record: had };
    const value = clientOriginalFor(had, key, entry);
    const rest = { ...had };
    delete rest[key];
    return { write: value !== null && value !== undefined && value !== now ? value : undefined, record: { ...rest, [GIVEN]: [...given, key] } };
}

const worldOriginals = {
    get: () => { try { return getSetting(SETTINGS.foundryBefore) ?? {}; } catch { return {}; } },
    set: value => game.settings.set(MODULE_ID, SETTINGS.foundryBefore, value)
};
const clientOriginals = {
    get: () => { try { return getSetting(SETTINGS.foundryBeforeClient) ?? {}; } catch { return {}; } },
    set: value => game.settings.set(MODULE_ID, SETTINGS.foundryBeforeClient, value)
};

/* One read-and-write of the kept values at a time: the automations and the permissions are both kept at `ready`, and
   two reads of the same record would each save over the other's part. */
let originalsQueue = Promise.resolve();

function queued(store, change) {
    const run = originalsQueue.then(async () => {
        const was = store.get();
        const next = change(was);
        if (next !== was) await store.set(next);
        return next;
    });
    originalsQueue = run.catch(() => null);
    return run;
}

/** Keep the world's value of `part` before the module's first write (a GM: a world setting). */
export function keepOriginal(part, value) {
    if (!game.user?.isGM) return Promise.resolve(null);
    return queued(worldOriginals, was => keptOriginal(was, part, value));
}

/** Keep this browser's value of a client row (`now`, read before the first write), and forget that it was given back. */
function keepClientOriginal(row, now) {
    return queued(clientOriginals, was => {
        const given = Array.isArray(was?.[GIVEN]) ? was[GIVEN] : [];
        const base = given.includes(fullKey(row)) ? { ...was, [GIVEN]: given.filter(k => k !== fullKey(row)) } : was;
        return keptOriginal(base, fullKey(row), now);
    });
}

/** A client row let go after Give back: its kept value (or its default) written once. */
async function giveBackClientRow(row, entry) {
    let now;
    try { now = game.settings.get(row.module, row.key); } catch { return; }
    let write;
    await queued(clientOriginals, was => {
        const out = clientGiveBack(was, fullKey(row), entry, now);
        write = out.write;
        return out.record;
    });
    if (write !== undefined) await game.settings.set(row.module, row.key, write);
}

/* The switch's change and its re-hold, one at a time on each browser. */
let givenBackChain = Promise.resolve();

/**
 * The given-back switch changed (its `onChange`, on every browser): the rows let go or are held again, and on the
 * primary GM, held again, Daggerheart's automations are switched off again. Answers when this browser is done.
 */
export function onGivenBackChanged() {
    givenBackChain = givenBackChain.then(async () => {
        await applyEnforced();
        if (!foundryGivenBack() && isPrimaryGm()) await (await import("./states.mjs")).suppressSystemAutomation();
    }).catch(err => error("Could not give back or hold Foundry's settings", err));
    return givenBackChain;
}

/**
 * Give back Foundry's settings (a GM): the switch first, so no writer runs again, then the world's kept values -
 * Daggerheart's automations (states.mjs `giveBackAutomation`) and the file permissions - and this browser's rows.
 * Every other browser gives back its own rows from the switch's `onChange`. File permissions with nothing kept are
 * left as they are: Foundry v14's own defaults for them are not read here (LIVE-E79-11), and the window says so.
 *
 * @returns {Promise<boolean|null>} null for a player.
 */
export async function giveBackFoundry() {
    if (!game.user?.isGM) return null;
    await game.settings.set(MODULE_ID, SETTINGS.foundryGivenBack, true);
    const kept = worldOriginals.get();
    await (await import("./states.mjs")).giveBackAutomation(kept.automation ?? null);
    if (kept.permissions) {
        const row = ENFORCED.find(r => r.kind === "permissions");
        let stored = null;
        try { stored = game.settings.get("core", "permissions") ?? {}; } catch { stored = null; }
        const back = stored ? permissionsGivenBack(stored, kept.permissions, row) : null;
        if (back && JSON.stringify(back) !== JSON.stringify(stored)) await game.settings.set("core", "permissions", back);
    }
    await queued(worldOriginals, was => (Object.keys(was ?? {}).length ? {} : was));
    await onGivenBackChanged();
    return true;
}

/** Let the module hold its settings again (a GM): the switch off; each browser's `onChange` holds them. */
export async function holdFoundryAgain() {
    if (!game.user?.isGM) return null;
    await game.settings.set(MODULE_ID, SETTINGS.foundryGivenBack, false);
    await onGivenBackChanged();
    return true;
}

/**
 * The window's body: what the module changes, the given-back line while it is true, a line about the file
 * permissions while Give back would leave them as they are, and what to do before switching the module off.
 */
export function giveBackContent({ givenBack = foundryGivenBack(), filesStay = false } = {}) {
    const t = key => esc(game.i18n.localize(key));
    return `<p>${t("DRPG.GiveBack.intro")}</p>
        <ul class="drpg-give-back-list">${FOUNDRY_WRITES.map(w => `<li>${t(w.text)}</li>`).join("")}</ul>
        ${givenBack ? `<p class="drpg-give-back-state"><strong>${t("DRPG.GiveBack.givenBackState")}</strong></p>` : ""}
        ${!givenBack && filesStay ? `<p class="notes">${t("DRPG.GiveBack.filesStay")}</p>` : ""}
        <p class="notes">${t("DRPG.GiveBack.beforeOff")}</p>`;
}

/** The settings window's Give back Foundry's settings: a GM's window with one button, Give them back or Hold them again. */
export async function openGiveBackFoundry() {
    if (!game.user?.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }
    const givenBack = foundryGivenBack();
    const files = ENFORCED.find(r => r.kind === "permissions");
    const filesStay = !worldOriginals.get().permissions && wanted(files);
    const choice = await tableDialog({
        window: { title: game.i18n.localize("DRPG.GiveBack.title") },
        classes: ["drpg-panel", "drpg-window-give-back"],
        content: dialogContent(`<form>${giveBackContent({ givenBack, filesStay })}</form>`),
        buttons: [
            givenBack
                ? { action: "hold", label: game.i18n.localize("DRPG.GiveBack.holdAgain") }
                : { action: "give", label: game.i18n.localize("DRPG.GiveBack.giveBack") },
            { action: "close", label: game.i18n.localize("DRPG.Panel.close"), default: true }
        ],
        rejectClose: false
    });
    if (choice === "give") {
        await giveBackFoundry();
        ui.notifications.info(game.i18n.localize("DRPG.GiveBack.done"));
    } else if (choice === "hold") {
        await holdFoundryAgain();
        ui.notifications.info(game.i18n.localize("DRPG.GiveBack.heldAgain"));
    }
    return choice;
}

/** Called from module.mjs's `setup` hook. */
export function registerEnforced() {
    Hooks.on("clientSettingChanged", onClientSettingChanged);
    Hooks.on("updateSetting", onWorldSettingUpdated);
    Hooks.on("renderUserConfig", (app, _el, _context, options) => { closeUnaskedUserConfig(app, options); });
    Hooks.on("renderDocumentSheetV2", (_app, el) => { disarmPortraits(el); });
    Hooks.on("renderFilePicker", app => { closePlayerFilePicker(app); });
    Hooks.on("renderAVConfig", (_app, el) => {
        rtcDockOn(ENFORCED.find(r => r.kind === "rtc"))
            .then(on => disableHeldAvFields(el, { on }))
            .catch(err => error("Could not hold the A/V window's dock fields", err));
    });
    Hooks.once("ready", () => {
        readyAt = Date.now();
        holdRtcDock().catch(err => error("Could not hold the camera dock for the table", err));
        holdPermissions(ENFORCED.find(r => r.kind === "permissions"), { first: true })
            .catch(err => error("Could not hold the file permissions", err));
    });
    applyEnforced().catch(err => error("Could not hold the table's settings", err));
}
