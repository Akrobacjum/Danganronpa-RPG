/**
 * Danganronpa RPG - the GM's repairs without the console (2.0 line T4, 27.11.2026; docs/dev/v2/LINE-T4.md).
 * ---------------------------------------------------------------------------
 * The GM panel's Diagnostics section (gm-panel.mjs `PANEL_SECTIONS.fixes`) reaches here for what used to be a
 * console's alone. Every press runs a function that was there before - a setting's own write, or a `game.drpg`
 * call - and asks first, Cancel the default; nothing here is new logic of the game. It imports only the leaves it
 * needs (config.mjs, settings.mjs, utils.mjs, ui-kit.mjs), so gm-panel.mjs reads it statically with no cycle.
 *
 * VOICE ROOMS ON AND OFF (VOICE-03). The switch "Separate voice in each room" (`SETTINGS.voiceEnabled`, `config: false`) was in
 * the Game settings window alone, and the GM handbook's 9.5 "When voice goes wrong" did not name it: the way out when
 * LiveKit cannot keep up with the rooms is everybody in the main room, which that switch's `onChange` does
 * (voice.mjs `resetAllVoice` when it goes off; a forced reconcile when it comes on). A tile of Diagnostics now names
 * the switch by what it will do - Everybody in one voice room, or Turn the voice rooms on - asks before it turns the
 * rooms off, saying what is lost, and writes the setting, whose `onChange` does the rest. It stands greyed, with the
 * reason, for a GM who may not write the game's settings (Foundry's SETTINGS_MODIFY, as the Settings tile) and with no
 * LiveKit AV client, where there are no voice rooms to turn.
 *
 * THE REPAIRS WINDOW (PANEL-01). The console's repair tools (api.mjs) were a console's alone, and the GM handbook's 20.3
 * named them in one line. The Diagnostics tile Repairs opens a window of the kit with one row a repair: the symptom,
 * what the press does - read off the function it calls - and the press, which asks first and tells the GM what the
 * function answered. `REPAIRS`, below, is the list and says how each row reaches its function. hide.mjs and gm-store.mjs
 * are read by `import()` when the window opens, so this file stays a leaf for gm-panel.mjs.
 */

import { MODULE_ID } from "./config.mjs";
import { SETTINGS, getSetting } from "./settings.mjs";
import { error, esc, isPrimaryGm, plural, primaryGmId } from "./utils.mjs";
import { drpgWindow, dataTable } from "./ui-kit.mjs";

/** The LiveKit AV client's module id, as voice-client.mjs `avclientActive` reads it. */
const AV_MODULE = "avclient-livekit";

/**
 * A yes-or-no question whose no is the default (boundary.mjs `noFirst`'s shape, E21 C3a): the yes on the right, Cancel
 * on the left and focused, so Enter and Space press Cancel and a closed window answers null. True for the yes alone.
 * `tip` is the yes's tooltip: what the press will do.
 */
export async function askFirst(title, body, yes, tip = "") {
    const answer = await drpgWindow({
        classes: ["drpg-panel"],
        title,
        body,
        footer: {
            primary: { action: "yes", label: yes, tooltip: tip, callback: () => true },
            close: { role: "cancel", action: "no", callback: () => false },
            default: "no"
        },
        rejectClose: false
    });
    return answer === true;
}

/** Whether the voice rooms are on (`SETTINGS.voiceEnabled`). `get` is the suite's. */
export function voiceRoomsOn({ get = () => getSetting(SETTINGS.voiceEnabled) } = {}) {
    return get() === true;
}

/** The tile's words, by the state: what a press will do (VOICE-03). */
export function voiceRoomsLabelKey(on = voiceRoomsOn()) {
    return on ? "DRPG.Repair.voiceRoomsOff" : "DRPG.Repair.voiceRoomsOn";
}

/**
 * Why the tile stands greyed, or null: a GM who may not write the game's settings, and no LiveKit AV client.
 * `mayModify` and `liveKit` are the suite's (R9251); gm-panel.mjs hands its own `mayModifySettings`.
 */
export function voiceRoomsRefusal({ mayModify = () => game.user?.isGM === true, liveKit = () => Boolean(game.modules.get(AV_MODULE)?.active) } = {}) {
    if (!mayModify()) return game.i18n.localize("DRPG.SettingsWindow.mayNot");
    if (!liveKit()) return game.i18n.localize("DRPG.Repair.voiceRoomsNoLiveKit");
    return null;
}

/**
 * The tile's press (VOICE-03): off asks first, with what turning the rooms off costs; on writes at once. Answers true
 * when it wrote, false for a Cancel, null where a GM may not. `on`, `set`, `ask` and `notify` are the suite's (R9251).
 */
export async function toggleVoiceRooms({ on = voiceRoomsOn(), set = value => game.settings.set(MODULE_ID, SETTINGS.voiceEnabled, value),
    ask = askFirst, notify = text => ui.notifications.info(text), refusal = voiceRoomsRefusal } = {}) {
    if (!game.user?.isGM || refusal()) return null;
    if (on) {
        const yes = await ask(game.i18n.localize("DRPG.Repair.voiceRoomsOff"), `<p>${game.i18n.localize("DRPG.Repair.voiceRoomsOffAsk")}</p>`,
            game.i18n.localize("DRPG.Repair.voiceRoomsOffYes"), game.i18n.localize("DRPG.Repair.voiceRoomsOffTip"));
        if (!yes) return false;
    }
    try {
        await set(!on);
    } catch (err) {
        error("Could not turn the voice rooms", err);
        return false;
    }
    notify(game.i18n.localize(on ? "DRPG.Repair.voiceRoomsOffDone" : "DRPG.Repair.voiceRoomsOnDone"));
    return true;
}

/**
 * THE REPAIRS (PANEL-01). The console's repair tools, one row each: the symptom, what the press does - read off the
 * function it calls: what it writes, for whom, and what it does not take back - and the press. Every row is a function
 * `game.drpg` already had (`call`, with `args`); nothing here is new logic. A row whose function works on the primary
 * GM's browser alone (`primary`: the music's state, the migration's clauses) stands greyed on another GM's, with the
 * reason; `finishChapterEnd`, `resetTokens` and `unhide` have a road of their own to the primary and stand open. Two
 * rows ask which character or which store first (`pick`). `told` turns the function's answer into what the GM is told:
 * [key, data, counted] or null where the function says it itself (a Finish's card and notices, the Search Tokens'
 * notice, the migration's gate).
 *
 * REFILL EVERYONE'S ACTIONS stands last, with the warning the GM panel gives for taking its tile away (gm-panel.mjs
 * `PANEL_SECTIONS.fixes`, whose comment stays): actions come back when the time of day advances, and a refill that does
 * not move the clock is a way to lose track of which time of day the table is in - here for a botched advance alone.
 */
export const REPAIRS = Object.freeze([
    { key: "body", call: "clearBodyDiscovery", told: answer => [answer ? "DRPG.Repair.body.done" : "DRPG.Repair.body.none"] },
    { key: "chapterFinish", call: "finishChapterEnd", told: () => null },
    { key: "chapterDrop", call: "finishChapterEnd", args: () => [{ drop: true }], told: () => null },
    { key: "observes", call: "clearPendingObserves", told: n => ["DRPG.Repair.observes.done", { n: Number(n) || 0 }, true] },
    { key: "unhide", call: "unhide", pick: "hidden", args: pick => [pick],
      told: (ended, pick, choices) => [ended ? "DRPG.Repair.unhide.done" : "DRPG.Repair.unhide.failed",
          { name: choices?.find(c => c.value === pick)?.label ?? "?" }] },
    { key: "tokens", call: "resetTokens", told: did => (did ? null : ["DRPG.Repair.tokens.failed"]) },
    { key: "fog", call: "repaintFog", told: drawn => [drawn ? "DRPG.Repair.fog.done" : "DRPG.Repair.fog.stood"] },
    { key: "music", call: "refreshMusic", primary: true, told: () => ["DRPG.Repair.music.done"] },
    { key: "reclaim", call: "gmStoreReclaim", pick: "stores", args: pick => [pick],
      told: (report, pick) => (report
          ? ["DRPG.Repair.reclaim.done", { store: pick, added: report.added?.length ?? 0, count: report.taken?.length ?? 0, kept: report.conflicts?.length ?? 0 }]
          : ["DRPG.Repair.reclaim.none", { store: pick }]) },
    { key: "migrate", call: "migrate", primary: true, args: () => [{ force: true }],
      told: report => (!report || typeof report.skipped === "string" ? null
          : ["DRPG.Repair.migrate.done", { count: report.changed ?? 0, cut: report.failed?.length ?? 0 }]) },
    { key: "actions", call: "resetAllActions", warn: true, told: rows => ["DRPG.Repair.actions.done", { n: Array.isArray(rows) ? rows.length : 0 }, true] }
]);

/**
 * What a row may be pressed with on this browser: `{ refusal, choices }` - the reason it stands greyed (a primary's row
 * off the primary, a pick with nothing to pick), and a picking row's options `[{ value, label }]`. `primary`, `primaryName`,
 * `hidden` and `stores` are the suite's (R9248); the window reads them from hide.mjs `hiddenUnderWay` and the stores
 * whose old key changed since the upgrade, as diagnostics.mjs `diagnoseGmStores` names them.
 */
export function repairState(row, { primary = isPrimaryGm(), primaryName = game.users?.get(primaryGmId() ?? "")?.name ?? "?", hidden = [], stores = [] } = {}) {
    if (row.primary && !primary) return { refusal: game.i18n.format("DRPG.Repair.primaryOnly", { name: primaryName }), choices: null };
    if (row.pick === "hidden") {
        const choices = hidden.map(h => ({ value: h.actorId, label: h.name }));
        return { refusal: choices.length ? null : game.i18n.localize("DRPG.Repair.unhide.noneHidden"), choices };
    }
    if (row.pick === "stores") {
        const choices = stores.map(name => ({ value: name, label: name }));
        return { refusal: choices.length ? null : game.i18n.localize("DRPG.Repair.reclaim.noneChanged"), choices };
    }
    return { refusal: null, choices: null };
}

/** The window's table: a row's symptom, what its press does (with the actions' warning), its pick and its button. */
export function repairsHtml(states = new Map()) {
    const L = key => game.i18n.localize(key);
    const rows = REPAIRS.map(row => {
        const { refusal = null, choices = null } = states.get(row.key) ?? {};
        const does = L(`DRPG.Repair.${row.key}.does`);
        const pick = choices && choices.length
            ? `<select data-drpg-repair-pick="${row.key}" aria-label="${esc(L(`DRPG.Repair.${row.key}.pick`))}" data-tooltip="${esc(L(`DRPG.Repair.${row.key}.pick`))}">${
                choices.map(c => `<option value="${esc(c.value)}">${esc(c.label)}</option>`).join("")}</select>`
            : "";
        const why = refusal ? ` disabled title="${esc(refusal)}" aria-describedby="drpg-repair-why-${row.key}"` : "";
        return {
            symptom: esc(L(`DRPG.Repair.${row.key}.symptom`)),
            does: `${esc(does)}${row.warn ? `<br><strong>${esc(L(`DRPG.Repair.${row.key}.warn`))}</strong>` : ""}`,
            press: `${pick}<button type="button" class="drpg-repair-button" data-drpg-repair="${row.key}" data-tooltip="${esc(does)}"${why}>${
                esc(L(`DRPG.Repair.${row.key}.button`))}</button>${refusal ? `<span class="drpg-kit-sr" id="drpg-repair-why-${row.key}">${esc(refusal)}</span>` : ""}`
        };
    });
    return `<p class="drpg-help">${esc(L("DRPG.Repair.intro"))}</p>${dataTable({
        columns: [{ key: "symptom", label: L("DRPG.Repair.colSymptom") }, { key: "does", label: L("DRPG.Repair.colDoes") },
            { key: "press", label: L("DRPG.Repair.colPress"), act: true }],
        rows
    })}`;
}

/**
 * A press of a row's button: its pick read off the row, `press(key, pick)` handed both, the button greyed until it
 * answers, so a second press cannot run it twice. Delegated on the window's element, as the GM panel's tiles are.
 */
export function wireRepairs(element, { press }) {
    element.addEventListener("click", async ev => {
        const button = ev.target.closest?.("[data-drpg-repair]");
        if (!button || button.disabled || !element.contains(button)) return;
        ev.preventDefault();
        const key = button.dataset.drpgRepair;
        const pick = element.querySelector(`[data-drpg-repair-pick="${key}"]`)?.value ?? null;
        button.disabled = true;
        try {
            await press(key, pick);
        } finally {
            button.disabled = false;
        }
    });
}

/**
 * One repair (PANEL-01): asks first - the row's button as the question's title and its yes, what it does as the body
 * and the yes's tooltip, the actions' warning beside it - and only on the yes calls the console's function with the
 * row's arguments, then tells the GM what it answered. Answers `{ ran: false }` for a Cancel or a closed question,
 * `{ ran: true, answer }` when it called, `{ ran: true, failed: true }` when the call threw, null for a row this browser
 * may not press. `api`, `ask`, `notify` and `choices` are the suite's (R9248).
 */
export async function runRepair(key, { api = game.drpg, ask = askFirst, notify = (text, level = "info") => ui.notifications[level](text), pick = null, choices = null } = {}) {
    const row = REPAIRS.find(r => r.key === key);
    const fn = api?.[row?.call];
    if (!row || typeof fn !== "function" || !game.user?.isGM || (row.pick && !pick)) return null;
    const L = k => game.i18n.localize(k);
    const does = L(`DRPG.Repair.${key}.does`);
    const body = `<p>${esc(does)}</p>${row.warn ? `<p><strong>${esc(L(`DRPG.Repair.${key}.warn`))}</strong></p>` : ""}`;
    if (!(await ask(L(`DRPG.Repair.${key}.button`), body, L(`DRPG.Repair.${key}.button`), does))) return { ran: false };
    let answer;
    try {
        answer = await fn.apply(api, row.args?.(pick) ?? []);
    } catch (err) {
        error(`The repair "${key}" (the console's ${row.call}) failed`, err);
        notify(L("DRPG.Repair.failed"), "error");
        return { ran: true, failed: true };
    }
    const told = row.told(answer, pick, choices);
    if (told) {
        const [textKey, data = null, counted = false] = told;
        notify(counted ? plural(textKey, data) : data ? game.i18n.format(textKey, data) : L(textKey));
    }
    return { ran: true, answer };
}

/**
 * The Repairs window (PANEL-01), the Diagnostics tile `repairs`: the rows drawn for this browser, a press run through
 * `runRepair`. GM only. Its state is read once, when it opens: a row's pick lists who is hidden and which stores
 * changed at that moment, and the panel the tile closed comes back when the window closes, so a new look is a press of
 * the tile again.
 */
export async function openRepairs() {
    if (!game.user?.isGM) return null;
    const [{ hiddenUnderWay }, { gmStoreHandles }] = await Promise.all([import("./hide.mjs"), import("./gm-store.mjs")]);
    const primary = isPrimaryGm();
    const stores = gmStoreHandles().filter(handle => {
        try {
            return handle.legacyChanged?.() || (primary && handle.status?.()?.census?.reasons?.notPrimary);
        } catch {
            return false;
        }
    }).map(handle => handle.name);
    const hidden = hiddenUnderWay();
    const states = new Map(REPAIRS.map(row => [row.key, repairState(row, { primary, hidden, stores })]));
    return drpgWindow({
        classes: ["drpg-panel", "drpg-window-repairs"],
        title: game.i18n.localize("DRPG.Repair.title"),
        body: repairsHtml(states),
        footer: { close: { role: "close", action: "close" } },
        render: (event, dialog) => wireRepairs(dialog.element, {
            press: (key, pick) => runRepair(key, { pick, choices: states.get(key)?.choices ?? null })
        }),
        rejectClose: false
    });
}
