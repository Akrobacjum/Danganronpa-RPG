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
 */

import { MODULE_ID } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { warn, error } from "./utils.mjs";

/**
 * @typedef {object} EnforcedRow
 * @property {string} id       A name for the log and the tests.
 * @property {string} module   The owning module's id.
 * @property {string} key      The setting's key in that module's namespace.
 * @property {*}      value    What the table plays with.
 * @property {string} toggle   This module's world setting that turns the row on.
 */

/** @type {EnforcedRow[]} */
export const ENFORCED = [
    /* The welcome window of Isometric Perspective: `showWelcome`, client-scoped,
       default true, read once in its `ready` (main.js, welcome.js in 1.9.x). */
    { id: "isoWelcome", module: "isometric-perspective", key: "showWelcome", value: false,
      toggle: SETTINGS.enforceIsoWelcome }
];

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
    for (const row of rows) {
        try {
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

/** Called from module.mjs's `setup` hook. */
export function registerEnforced() {
    Hooks.on("clientSettingChanged", onClientSettingChanged);
    applyEnforced().catch(err => error("Could not hold the table's settings", err));
}
