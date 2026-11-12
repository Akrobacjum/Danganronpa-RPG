/**
 * Danganronpa RPG - the module's settings: this browser's window, and the game's window (E49 A1, reworked
 * by E49 A1d, 11.11.2026).
 * ---------------------------------------------------------------------------
 * The owner's amend of 10.11.2026 ([11]: Foundry's list "jest pionowy, wymaga duzo scrollowania. Chcemy tego uniknac.
 * To ten sam przypadek, co ekran akcji") and his "wariant A jest SUPER!" ([16]): the 35 settings Foundry's Configure
 * Settings listed (`config: true` at 20218b05; `config: false` since A1) stand in sections (Q4), a list of the sections
 * on the left and the picked one on the right. Under each setting the first sentence of its hint, the rest in its
 * tooltip ([16]).
 *
 * TWO PLACES, BY WHOSE THE SETTING IS (E49 A1d; the owner on A1's shots, 11.11.2026: "Gm pod przyciskiem zebatki nie
 * powinien miec innych ustawien niz gracz. To co powstalo w podgladzie jest fajne, ale nadaje sie jako zakladka do gm
 * panel skoro jest ustawieniami calej gry. Do tego zniknela czesc ustawien np push to talk, urzadzenia wejsciowe i
 * wyjsciowe"). A1 drew one window of seven sections, the world rows for a GM alone, so a GM's gear and a player's
 * differed, and the Look window the gear opened (look.mjs, with the volumes and the Voice section) stood beside it.
 * Since A1d:
 *   - THIS BROWSER'S WINDOW (`openSettingsWindow`), the same for a GM and a player (a GM alone has the verbose log since E100 item 3): every client setting of the 35
 *     (`CLIENT_SECTIONS`: look, effects, sound, tech) and what the Look window held besides them - the two volumes
 *     (sfx.mjs `volumeSliders`, saved as they move, as they were; since E100 item 2 in the Sound window alone, with the
 *     messenger's sounds, and here a button that opens it) and the Voice section (voice-panel.mjs
 *     `voiceFieldset`: the microphone, the output, always on or push to talk, the key and Configure Controls; only where
 *     `voiceAvailable()`, saved as touched, as it was). The gear opens it (look.mjs `openLookDialog`), and so does
 *     Configure Settings' one button of the module, DRPG Settings (settings.mjs `SETTINGS_MENU`). No world row in it.
 *   - THE GAME'S SETTINGS (`GAME_SECTIONS`: audio, rules, privacy, gm, foundry; every world row of the 35, Vary the
 *     sounds - a GM's switch the Look window carried - and Give back Foundry's settings): a window of their own in the
 *     same shape, `openGameSettingsWindow`, opened by the GM panel's Settings tile in Between sessions (the owner, the
 *     same day: "W wolne miejsce wejda nowe ustawienia gma jako "Settings"", the place Reset the season left when it
 *     moved into Season setup), for a user Foundry lets modify settings alone.
 *
 *   CLIENT_SECTIONS, GAME_SECTIONS  the sections of each place, `{ key, icon, place, keys }`, in the order drawn
 *   SETTINGS_SECTIONS        both lists, the client's first: every one of the 35 in exactly one (R3420)
 *   firstSentence(text)      a hint's first sentence; `restOf(text)` the rest, the tooltip
 *   settingRowHtml(key)      one setting's row: its control by type (kit `toggle`, `stepper`, a select), its line
 *   saveSettings(form, user) every changed field written as Foundry's own form wrote it; a reload asked once
 *   openSettingsWindow()     this browser's window: Save (the default) and Cancel
 *   openGameSettingsWindow() the game's settings: Save (the default) and Cancel; `gameSettingsColumns(user)` its columns
 *
 * AS FOUNDRY'S FORM DID (STAGE E49 Risks 2; v13's SettingsConfig `#onSubmit`, read as text, the same shape on v14 is
 * LIVE-E49-02's): each setting whose value changed is written by `game.settings.set` - which runs its `onChange`, once -
 * and a setting left as it was is not written at all; when one written carries `requiresReload`, the reload is asked
 * once after the last write, through Foundry's own `SettingsConfig.reloadConfirm({ world })` (`world` when a world
 * setting asked: Foundry then reloads every client), as i18n.mjs `confirmLanguageReload` asks it. Nothing of a setting
 * row is written before Save; Cancel and the window's close write nothing. The Voice section is not setting rows
 * (`data-drpg-setting`) and keeps its own writes, at once, as the Look window had them: a device is tried as it is
 * picked; the section says so in a line of its own. (The volumes did the same here until E100 item 2 moved them to the
 * Sound window, where they still save as they move.)
 *
 * WHO WRITES WHAT (STAGE E49 "Write roads"; Q2). A world setting is written only for a user Foundry lets modify
 * settings (`game.user.can("SETTINGS_MODIFY")`: the Assistant GM up, user-match.mjs's note), and only such a user is
 * drawn the game's settings window. Foundry's server refuses the write anyway. Give back keeps enforced.mjs's own gates
 * (`openGiveBackFoundry`, `canGiveBack`); its row is drawn there, as the menu's `restricted` drew it for a GM.
 *
 * ONE SIZE, WHATEVER SECTION IS PICKED (the owner's rule of 10.11: "no state may add, remove or shift a control").
 * Every section is drawn when the window opens, the ones not picked `hidden`; components.css "THE SETTINGS WINDOW"
 * stacks them in one cell, so the window is as tall as its tallest section at every pick. The Voice section is built
 * before the window is drawn (its device lists are asked of the browser), so it is in the first frame and the window
 * never grows under the person. A setting that belongs to the other theme (look.mjs `themeOnlyKeys`) stays in its
 * place, disabled, its reason in its title - never removed - and follows the theme picked in the window before Save.
 * A section's panes carry `data-drpg-settings-pane`, not the kit tab's `data-drpg-pane`: the kit's `wireKitTabs`, its
 * fit and live.mjs's tab memory read every `[data-drpg-pane]` in a window as a tab (tables-editor.mjs's pools took
 * `data-drpg-pool-pane` for the same reason, E44 C4a), so a window of the kit's with tabs would hide them.
 */

import { MODULE_ID } from "./config.mjs";
import { SETTINGS, getSetting } from "./settings.mjs";
import { esc, error, wholeNumber } from "./utils.mjs";
import { toggle, stepper, stepperId } from "./ui-kit.mjs";
import { sectionHtml, wideWindow } from "./ui-columns.mjs";
import { alreadyOpen, RAISED } from "./live.mjs";
import { themeOnlyKeys, scaleNote, systemWantsContrast } from "./look.mjs";

/**
 * The sections of each place (Q4's seven, split by whose the setting is: E49 A1d), each `{ key, icon, place, keys }`:
 * `key` names its words (`DRPG.SettingsWindow.sections.<key>`, unique over both lists), `icon` a Font Awesome class,
 * `place` "client" (this browser's window) or "game" (the game's window), `keys` its settings by SETTINGS name, in the
 * order drawn. A client section names client settings alone and a game section world ones alone (R3420); A1's Sound and
 * Technical held both, so each is two sections now: Sound (since E100 item 2 a button to the Sound window, which holds
 * the messenger's sounds and the volumes, and the voice) and
 * Music and voice (the table's switches, and Vary the sounds), Technical (the debug log) and Foundry and the system (the
 * two welcomes, and Give back). The icons are among those pixel-icons.css redraws as pixels under the glass.
 */
const section = (place, key, icon, keys) => Object.freeze({ key, icon, place, keys: Object.freeze(keys) });
export const CLIENT_SECTIONS = Object.freeze([
    section("client", "look", "fa-image", ["language", "theme", "uiScale", "hudTicker", "wideProjectWindows"]),
    section("client", "effects", "fa-wand-magic-sparkles", ["pixelFont", "glassPulse", "glassBlur", "reducedMotion", "highContrast"]),
    section("client", "sound", "fa-volume-high", []),
    section("client", "tech", "fa-screwdriver-wrench", ["debug"])
]);
export const GAME_SECTIONS = Object.freeze([
    section("game", "audio", "fa-headset", ["musicEnabled", "voiceEnabled", "voiceTile", "liveKitInFoundry", "sfxVary"]),
    section("game", "rules", "fa-scale-balanced", ["searchTokensPerRoom", "despairFromRolls", "chargeMovement", "friskForce", "autoApproveTraits", "moveAudit", "hideSystemFear"]),
    section("game", "privacy", "fa-user-secret", ["forcePrivateRolls", "forceDiceLook", "lockRollDialog", "enforceAnonymity", "roomVisibility", "lockPlayerResources"]),
    section("game", "gm", "fa-map-location-dot", ["regionFog", "foundryToolWindows", "enforcePlayerFiles", "isoTokenShield"]),
    section("game", "foundry", "fa-plug", ["enforceIsoWelcome", "enforceDhWelcome"])
]);
export const SETTINGS_SECTIONS = Object.freeze([...CLIENT_SECTIONS, ...GAME_SECTIONS]);

/* A sentence ends at ".", "!" or "?" followed by a space or the end: "game.drpg.publicRoll" and "1.2" stay whole. */
const SENTENCE = /^(.+?[.!?])(?=\s|$)/s;

/** A hint's first sentence (the line under a setting, [16]); the whole text when it has no sentence's end. */
export function firstSentence(text) {
    const s = String(text ?? "").trim();
    return (SENTENCE.exec(s)?.[1] ?? s).trim();
}

/** What `firstSentence` leaves: the setting's tooltip. Empty for a hint of one sentence. */
export function restOf(text) {
    const s = String(text ?? "").trim();
    return s.slice(firstSentence(s).length).trim();
}

const localize = key => game.i18n.localize(key);

/** The registered setting of a SETTINGS name, or null. */
function registered(key) {
    return game.settings.settings.get(`${MODULE_ID}.${SETTINGS[key] ?? key}`) ?? null;
}

/** Whether `user` may write world settings: Foundry's own permission (the Assistant GM up). */
export function mayModifyWorld(user = game.user) {
    try {
        return typeof user?.can === "function" ? Boolean(user.can("SETTINGS_MODIFY")) : Boolean(user?.isGM);
    } catch {
        return false;
    }
}

/*
 * A GM'S ROWS OF THIS BROWSER'S WINDOW (E100 item 3, 12.11.2026; the owner on the player-screens review, #4: "Szczegółowe
 * logi w konsoli" is diagnostic, a GM asks for it). Verbose console logging is still this browser's own setting
 * (`scope: "client"`), drawn for a GM alone; a player's window has no Technical section left. No road from a GM's
 * browser writes another browser's client setting (read on 12.11.2026: utils.mjs `debug` is its one reader, no socket
 * or bridge row names it), so none was kept: when a GM asks a player for the log, the GM handbook's recipe gives the
 * console line. This is the one place the gear's window differs between a GM and a player (R3530, R3919).
 */
const GM_ONLY_CLIENT_KEYS = Object.freeze(["debug"]);

/** The keys of a section `user` is drawn: a client section's to everybody (a GM's rows to a GM), a game one's to a user who may write them. */
export function keysFor(section, user = game.user) {
    if (section.place === "game" && !mayModifyWorld(user)) return [];
    return section.keys.filter(key => registered(key) && (user?.isGM || !GM_ONLY_CLIENT_KEYS.includes(key)));
}

/** The theme that claims `key` alone (look.mjs `themeOnlyKeys`), or null. */
function ownerTheme(key) {
    for (const theme of ["stainedGlass", "monokumaLegacy"]) if (themeOnlyKeys(theme).includes(SETTINGS[key] ?? key)) return theme;
    return null;
}

const THEME_WORDS = Object.freeze({ stainedGlass: "DRPG.SettingsWindow.glassOnly", monokumaLegacy: "DRPG.SettingsWindow.legacyOnly" });

/** One setting's control: a switch for a Boolean, a select for choices, a stepper for a number with a range. */
function controlHtml(key, reg, value, off) {
    const name = SETTINGS[key] ?? key;
    const label = localize(reg.name);
    if (reg.type === Boolean) return toggle({ name, checked: value === true, label, disabled: off });
    const id = stepperId();
    const head = `<label class="drpg-settings-label" for="${esc(id)}">${esc(label)}</label>`;
    if (reg.choices) {
        const options = Object.entries(reg.choices).map(([v, words]) =>
            `<option value="${esc(v)}"${String(value) === v ? " selected" : ""}>${esc(localize(words))}</option>`).join("");
        return `${head}<select id="${esc(id)}" name="${esc(name)}"${off ? " disabled" : ""}>${options}</select>`;
    }
    const r = reg.range ?? {};
    return head + stepper({ name, value: String(value ?? ""), min: r.min ?? null, max: r.max ?? null, step: r.step ?? 1, id, attrs: off ? { disabled: true } : {} });
}

/**
 * One setting's row: its scope's mark (this browser, or the whole table), its control by type, and the first sentence of
 * its hint with the rest as the line's tooltip (a caption, not a paragraph: the glass sets a `<p>` at its prose rung). `theme` is the theme the window shows (a setting of the other theme's
 * is drawn disabled, its reason the row's title). Answers "" for a key not registered.
 */
export function settingRowHtml(key, { theme = getSetting(SETTINGS.theme) } = {}) {
    const reg = registered(key);
    if (!reg) return "";
    const owner = ownerTheme(key);
    const off = Boolean(owner && owner !== theme);
    const value = game.settings.get(MODULE_ID, SETTINGS[key] ?? key);
    const hint = reg.hint ? localize(reg.hint) : "";
    const rest = restOf(hint);
    const world = reg.scope === "world";
    const scope = localize(world ? "DRPG.SettingsWindow.scopeWorld" : "DRPG.SettingsWindow.scopeClient");
    return `<div class="drpg-settings-row${off ? " is-off" : ""}" data-drpg-setting="${esc(SETTINGS[key] ?? key)}" data-drpg-scope="${world ? "world" : "client"}"${
        owner ? ` data-drpg-theme-only="${esc(owner)}"` : ""}${off ? ` title="${esc(localize(THEME_WORDS[owner]))}"` : ""}>`
        + `<div class="drpg-settings-control">${controlHtml(key, reg, value, off)}`
        + `<i class="fa-solid ${world ? "fa-users-gear" : "fa-gear"} drpg-settings-scope" role="img" aria-label="${esc(scope)}" data-tooltip="${esc(scope)}"></i></div>`
        + `<div class="drpg-settings-hint"${rest ? ` data-tooltip="${esc(rest)}"` : ""}>${esc(firstSentence(hint))}</div>${scaleLine(key, value)}</div>`;
}

/* Under Interface scale, the Look window's line (look.mjs `scaleNote`): what this screen's factor and the slider make,
   in the row itself, so it stands under the field it reads (E49 A1d's shots: as a line of the section it fell under the
   section's last row). The window's render keeps it following the field before Save. */
function scaleLine(key, value) {
    if ((SETTINGS[key] ?? key) !== SETTINGS.uiScale) return "";
    return `<div class="drpg-settings-hint drpg-settings-note" data-drpg-scale-note>${esc(scaleNote(Number(value) || 1))}</div>`;
}

/* Give back Foundry's settings, in Foundry and the system (Q3; Technical until A1d): the menu's words, the button that opened it from Configure Settings. */
function giveBackRowHtml() {
    const hint = localize("DRPG.GiveBack.menuHint");
    const rest = restOf(hint);
    return `<div class="drpg-settings-row drpg-settings-giveback" data-drpg-setting="giveBackFoundry">`
        + `<div class="drpg-settings-control"><span class="drpg-settings-label">${esc(localize("DRPG.GiveBack.menuName"))}</span>`
        + `<button type="button" data-drpg-give-back><i class="fa-solid fa-rotate-left" inert></i> ${esc(localize("DRPG.GiveBack.menuLabel"))}</button></div>`
        + `<div class="drpg-settings-hint"${rest ? ` data-tooltip="${esc(rest)}"` : ""}>${esc(firstSentence(hint))}</div></div>`;
}

/**
 * What a section draws besides its settings' rows, as `{ html, count }`: the system's own contrast line where it asks
 * for more (look.mjs `systemWantsContrast`), the Sound window's button and the Voice section's place with its line (`voice`: whether one
 * was built), and Give back in Foundry and the system. `count` is what the section's number in the list adds: the button one, the
 * Voice section one, Give back one; a line none.
 */
function extrasOf(key, { voice = false } = {}) {
    const note = text => `<div class="drpg-settings-note" data-drpg-settings-note>${esc(text)}</div>`;
    if (key === "effects") return { html: systemWantsContrast() ? note(localize("DRPG.Look.contrastAuto")) : "", count: 0 };
    if (key === "sound") {
        /* THE VOLUMES AND THE MESSENGER'S SOUNDS LIVE IN THE SOUND WINDOW (E100 item 2, 12.11.2026; the owner on the
           player-screens review, #3: Dźwięk, Muzyka and Dźwięki komunikatora stood here and in the Sound window). Here a
           line and one button that opens it (`data-drpg-open-sound`, wired in `openSettingsWindow`'s render); the Voice
           section stays (devices and push to talk are in no other window), and the line that its fields apply at once
           with it. R3918. */
        const open = `<div class="drpg-settings-row" data-drpg-sound-door>`
            + `<div class="drpg-settings-control"><button type="button" data-drpg-open-sound>`
            + `<i class="fa-solid fa-volume-high" inert></i> ${esc(localize("DRPG.SettingsWindow.soundOpen"))}</button></div>`
            + `<div class="drpg-settings-hint">${esc(localize("DRPG.SettingsWindow.soundOpenLine"))}</div></div>`;
        return {
            html: open + (voice ? note(localize("DRPG.SettingsWindow.liveNote")) + `<div class="drpg-settings-voice" data-drpg-voice-slot></div>` : ""),
            count: 1 + (voice ? 1 : 0)
        };
    }
    if (key === "foundry") return { html: giveBackRowHtml(), count: 1 };
    return { html: "", count: 0 };
}

/** The sections of `sections` that `user` is drawn, each with its keys and extras: one with nothing to draw is left out. */
export function sectionsFor(sections, user = game.user, { voice = false } = {}) {
    return sections.map(s => ({ ...s, shown: keysFor(s, user), extra: s.place === "game" && !mayModifyWorld(user) ? { html: "", count: 0 } : extrasOf(s.key, { voice }) }))
        .filter(s => s.shown.length || s.extra.count);
}

/**
 * The two columns' markup of a place: the sections' list and every section's pane, `picked` (else the first) shown.
 * `foot` is a line under the list. Answers wideWindow's `columns`.
 */
export function sectionColumns(sections, { theme = getSetting(SETTINGS.theme), picked = null, foot = "" } = {}) {
    const open = sections.find(s => s.key === picked)?.key ?? sections[0]?.key ?? null;
    const words = s => localize(`DRPG.SettingsWindow.sections.${s.key}`);
    const list = `<nav class="drpg-settings-sections" aria-label="${esc(localize("DRPG.SettingsWindow.sectionsLabel"))}">${sections.map(s =>
        `<button type="button" class="drpg-settings-tab" data-drpg-section="${esc(s.key)}" aria-pressed="${s.key === open}">`
        + `<i class="fa-solid ${esc(s.icon)}" inert></i><span>${esc(words(s))}</span><b>${s.shown.length + s.extra.count}</b></button>`).join("")}</nav>`
        + (foot ? `<div class="drpg-settings-note drpg-settings-foot">${esc(foot)}</div>` : "");
    const panes = sections.map(s => `<div class="drpg-settings-pane" data-drpg-settings-pane="${esc(s.key)}"${s.key === open ? "" : " hidden"}>${
        sectionHtml({ title: words(s), body: `<div class="drpg-settings-rows">${s.shown.map(k => settingRowHtml(k, { theme })).join("")}${s.extra.html}</div>` })}</div>`).join("");
    return [{ cls: "drpg-settings-nav", html: list }, { cls: "drpg-settings-main", html: `<div class="drpg-settings-panes">${panes}</div>` }];
}

/** This browser's window's columns: the client sections, the same for every user (E49 A1d) but a GM's rows (`GM_ONLY_CLIENT_KEYS`, E100 item 3). */
export function settingsWindowColumns(user = game.user, { theme = getSetting(SETTINGS.theme), picked = null, voice = false } = {}) {
    return sectionColumns(sectionsFor(CLIENT_SECTIONS, user, { voice }), { theme, picked, foot: localize("DRPG.Look.note") });
}

/** The game's settings window's columns (E49 A1d): the game sections; none for a user who may not modify settings. */
export function gameSettingsColumns(user = game.user, { picked = null } = {}) {
    if (!mayModifyWorld(user)) return [];
    const sections = sectionsFor(GAME_SECTIONS, user);
    return sections.length ? sectionColumns(sections, { picked, foot: localize("DRPG.SettingsWindow.gameNote") }) : [];
}

/** Show the section `key` and hide the others; the list's buttons say which is pressed. Answers whether one was shown. */
export function showSection(root, key) {
    const pane = [...(root?.querySelectorAll?.("[data-drpg-settings-pane]") ?? [])].find(p => p.dataset.drpgSettingsPane === key);
    if (!pane) return false;
    for (const p of root.querySelectorAll("[data-drpg-settings-pane]")) p.hidden = p !== pane;
    for (const b of root.querySelectorAll("[data-drpg-section]")) b.setAttribute("aria-pressed", String(b.dataset.drpgSection === key));
    return true;
}

/* The section list's buttons and Give back, wired on `root` (either window). */
function wireSections(root) {
    for (const b of root.querySelectorAll("[data-drpg-section]")) {
        b.addEventListener("click", ev => { ev.preventDefault(); showSection(root, b.dataset.drpgSection); });
    }
    root.querySelector("[data-drpg-give-back]")?.addEventListener("click", ev => {
        ev.preventDefault();
        import("./enforced.mjs").then(m => m.openGiveBackFoundry())
            .catch(err => error("Could not open Give back Foundry's settings", err));
    });
}

/**
 * The Voice section for this browser's window (E49 A1d; look.mjs `wireVoice` until then): voice-panel.mjs's fieldset,
 * wired, where this world has voice to set (`voiceAvailable()`, voice-tile.mjs) - elsewhere null and voice-panel.mjs
 * never fetched. `available` and `build` stand in for those two imports, for the suite (R586), which runs where no
 * LiveKit is; the window passes neither.
 */
export async function voiceSection({ available = null, build = null } = {}) {
    const voiceAvailable = available ?? (await import("./voice-tile.mjs")).voiceAvailable;
    if (!voiceAvailable()) return null;
    const voiceFieldset = build ?? (await import("./voice-panel.mjs")).voiceFieldset;
    return voiceFieldset();
}

/** The Voice section put into its place in the Sound section (`data-drpg-voice-slot`). Answers whether it was put. */
export function placeVoice(root, fieldset) {
    const slot = root?.querySelector?.("[data-drpg-voice-slot]");
    if (!slot || !fieldset || slot.querySelector("fieldset.drpg-voice-panel")) return false;
    slot.append(fieldset);
    return true;
}

/** The rows of the other theme's settings disabled, the rest enabled, for `theme` (the window's select before Save). */
export function syncTheme(root, theme) {
    for (const row of root?.querySelectorAll?.("[data-drpg-theme-only]") ?? []) {
        const off = row.dataset.drpgThemeOnly !== theme;
        row.classList.toggle("is-off", off);
        if (off) row.title = localize(THEME_WORDS[row.dataset.drpgThemeOnly]);
        else row.removeAttribute("title");
        for (const field of row.querySelectorAll("input, select, button")) field.disabled = off;
    }
}

/* A field's value as the setting's type holds it; undefined when the field says nothing a setting can take. */
function fieldValue(field, reg) {
    if (reg.type === Boolean) return field.checked === true;
    if (reg.type === Number) {
        /* As every number field of the module, through utils.mjs `wholeNumber` (R1127): here the count of steps from
           the range's least, so Interface scale's 0.05 steps are whole too; out of range held to it. */
        const { min = 0, max = Infinity, step = 1 } = reg.range ?? {};
        if (field.value === "") return undefined;
        const steps = wholeNumber(Math.round((Number(field.value) - min) / step), { min: 0, max: Math.round((max - min) / step), fallback: null });
        return steps === null ? undefined : Number((min + steps * step).toFixed(6));
    }
    const v = String(field.value);
    return reg.choices && !Object.hasOwn(reg.choices, v) ? undefined : v;
}

/** Foundry's reload question after a setting with `requiresReload` (SettingsConfig `reloadConfirm`), else a plain reload. */
export async function askReload({ world = false } = {}) {
    try {
        const SettingsConfig = foundry.applications?.settings?.SettingsConfig ?? globalThis.SettingsConfig;
        if (SettingsConfig?.reloadConfirm) return SettingsConfig.reloadConfirm({ world });
    } catch { /* fall through */ }
    return foundry.utils.debouncedReload?.();
}

/**
 * Write every setting of the window whose field holds a value other than the setting's: by `game.settings.set` (its
 * `onChange` runs there), a world one only for a user who may modify settings, a disabled field never. Then, when a
 * setting written carries `requiresReload`, `reload({ world })` once. Answers `{ written, refused, reload }`: the keys
 * written, the world keys refused to this user, and whether a reload was asked (`"world"`, `"client"` or null).
 */
export async function saveSettings(form, user = game.user, { reload = askReload } = {}) {
    const written = [], refused = [];
    let client = false, world = false;
    const fields = form?.querySelectorAll?.("[data-drpg-setting] [name]") ?? [];
    for (const field of fields) {
        const key = field.name;
        const reg = game.settings.settings.get(`${MODULE_ID}.${key}`);
        if (!reg || field.disabled || field.closest("[data-drpg-setting]")?.dataset.drpgSetting !== key) continue;
        if (reg.scope === "world" && !mayModifyWorld(user)) { refused.push(key); continue; }
        const value = fieldValue(field, reg);
        if (value === undefined || value === game.settings.get(MODULE_ID, key)) continue;
        await game.settings.set(MODULE_ID, key, value);
        written.push(key);
        if (reg.requiresReload) {
            if (reg.scope === "world") world = true;
            else client = true;
        }
    }
    const asked = world ? "world" : client ? "client" : null;
    if (asked) {
        try { await reload({ world }); } catch (err) { error("Could not ask for the reload", err); }
    }
    return { written, refused, reload: asked };
}

/**
 * Open this browser's settings window (the gear's and Configure Settings' DRPG Settings), raised if already open. The
 * Voice section is built first, so the window's first frame holds it. Answers what the kit's window answers.
 */
export async function openSettingsWindow() {
    if (alreadyOpen("drpg-window-settings")) return RAISED;
    const user = game.user;
    const voice = await voiceSection().catch(err => { error("Could not draw the voice settings", err); return null; });
    return wideWindow({
        title: localize("DRPG.SettingsWindow.title"),
        classes: ["drpg-window-settings"],
        columns: settingsWindowColumns(user, { voice: Boolean(voice) }),
        footer: {
            primary: {
                action: "save",
                label: localize("DRPG.SettingsWindow.save"),
                callback: async (event, button, dialog) => {
                    await saveSettings(button?.form ?? dialog?.element?.querySelector("form"), user)
                        .catch(err => error("Could not save the module's settings", err));
                    return "save";
                }
            },
            close: { role: "cancel", action: "cancel" }
        },
        render: (event, dialog) => {
            const root = dialog.element;
            wireSections(root);
            root.querySelector(`[name="${SETTINGS.theme}"]`)?.addEventListener("change", ev => syncTheme(root, ev.currentTarget.value));
            /* The scale's line follows the field before Save, as the Look window's followed its slider. */
            const scale = root.querySelector(`[name="${SETTINGS.uiScale}"]`), line = root.querySelector("[data-drpg-scale-note]");
            const follow = () => { if (line) line.textContent = scaleNote(Number(scale.value) || 1); };
            scale?.addEventListener("input", follow);
            scale?.addEventListener("change", follow);
            root.querySelector("[data-drpg-open-sound]")?.addEventListener("click", ev => {
                ev.preventDefault();
                import("./music.mjs").then(m => m.openSoundDialog())
                    .catch(err => error("Could not open the Sound window", err));
            });
            if (voice) placeVoice(root, voice);
        },
        rejectClose: false
    });
}

/**
 * Open the game's settings window (E49 A1d; the GM panel's Settings tile, between sessions), raised if already open:
 * the game sections in the DRPG Settings window's shape, Save (the default) and Cancel, `saveSettings` as the browser's
 * window saves (a world setting with `requiresReload` asks Foundry's reload for every client, `world`). Refused, with
 * a warning, to a user Foundry does not let modify settings. Answers what the kit's window answers.
 */
export async function openGameSettingsWindow() {
    if (alreadyOpen("drpg-window-game-settings")) return RAISED;
    const user = game.user;
    const columns = gameSettingsColumns(user);
    if (!columns.length) {
        ui.notifications?.warn(localize("DRPG.SettingsWindow.mayNot"));
        return null;
    }
    return wideWindow({
        title: localize("DRPG.SettingsWindow.gameTitle"),
        classes: ["drpg-window-game-settings"],
        columns,
        footer: {
            primary: {
                action: "save",
                label: localize("DRPG.SettingsWindow.save"),
                callback: async (event, button, dialog) => {
                    await saveSettings(button?.form ?? dialog?.element?.querySelector("form"), user)
                        .catch(err => error("Could not save the game's settings", err));
                    return "save";
                }
            },
            close: { role: "cancel", action: "cancel" }
        },
        render: (event, dialog) => wireSections(dialog.element),
        rejectClose: false
    });
}
