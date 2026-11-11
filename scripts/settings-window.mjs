/**
 * Danganronpa RPG - the DRPG Settings window: every setting of the module in one window (E49 A1, 11.11.2026).
 * ---------------------------------------------------------------------------
 * The owner's amend of 10.11.2026 ([11]: Foundry's list "jest pionowy, wymaga duzo scrollowania. Chcemy tego uniknac.
 * To ten sam przypadek, co ekran akcji") and his "wariant A jest SUPER!" ([16]): the 35 settings Foundry's Configure
 * Settings listed (`config: true` at 20218b05; `config: false` since this commit) stand in seven sections (Q4), a list of
 * the sections on the left and the picked one on the right, in E68's wide window (ui-columns.mjs `wideWindow`). Under
 * each setting the first sentence of its hint, the rest in its tooltip ([16]). Configure Settings keeps one button of
 * the module's, DRPG Settings (settings.mjs `SETTINGS_MENU`), and Give back Foundry's settings moved into Technical (Q3).
 *
 *   SETTINGS_SECTIONS        the seven sections, `{ key, icon, keys }`, in the order drawn (Q4: the mockup's, by use)
 *   firstSentence(text)      a hint's first sentence; `restOf(text)` the rest, the tooltip
 *   settingRowHtml(key)      one setting's row: its control by type (kit `toggle`, `stepper`, a select), its line
 *   saveSettings(form, user) every changed field written as Foundry's own form wrote it; a reload asked once
 *   openSettingsWindow()     the window: Save (the default) and Cancel
 *
 * AS FOUNDRY'S FORM DID (STAGE E49 Risks 2; v13's SettingsConfig `#onSubmit`, read as text, the same shape on v14 is
 * LIVE-E49-02's): each setting whose value changed is written by `game.settings.set` - which runs its `onChange`, once -
 * and a setting left as it was is not written at all; when one written carries `requiresReload`, the reload is asked
 * once after the last write, through Foundry's own `SettingsConfig.reloadConfirm({ world })` (`world` when a world
 * setting asked: Foundry then reloads every client), as i18n.mjs `confirmLanguageReload` asks it. Nothing is written
 * before Save; Cancel and the window's close write nothing.
 *
 * WHO WRITES WHAT (STAGE E49 "Write roads"; Q2). A world setting is written only for a user Foundry lets modify
 * settings (`game.user.can("SETTINGS_MODIFY")`: the Assistant GM up, user-match.mjs's note), and only such a user is
 * drawn a world setting's row; a player's window holds the client rows alone, and a section with none of them is not
 * drawn. Foundry's server refuses the write anyway. Give back keeps enforced.mjs's own gates (`openGiveBackFoundry`,
 * `canGiveBack`); its row is drawn for a GM, as the menu's `restricted` drew it.
 *
 * ONE SIZE, WHATEVER SECTION IS PICKED (the owner's rule of 10.11: "no state may add, remove or shift a control").
 * Every section is drawn when the window opens, the ones not picked `hidden`; components.css "THE SETTINGS WINDOW"
 * stacks them in one cell, so the window is as tall as its tallest section at every pick. A setting that belongs to the
 * other theme (look.mjs `themeOnlyKeys`) stays in its place, disabled, its reason in its title - never removed - and
 * follows the theme picked in the window before Save, as Foundry's list followed it (the `renderSettingsConfig` hook
 * until this commit).
 */

import { MODULE_ID } from "./config.mjs";
import { SETTINGS, getSetting } from "./settings.mjs";
import { esc, error } from "./utils.mjs";
import { toggle, stepper, stepperId } from "./ui-kit.mjs";
import { sectionHtml, wideWindow } from "./ui-columns.mjs";
import { alreadyOpen, RAISED } from "./live.mjs";
import { themeOnlyKeys } from "./look.mjs";

/**
 * The seven sections (Q4: the mockup's, "these seven, in this order, the names as drawn"), each `{ key, icon, keys }`:
 * `key` names its words (`DRPG.SettingsWindow.sections.<key>`), `icon` a Font Awesome class, `keys` its settings by
 * SETTINGS name, in the order drawn. Every one of the 35 in exactly one (R3420). The icons, and the scope marks below, are
 * among those pixel-icons.css redraws as pixels under the glass (Font Awesome's own under Legacy).
 */
export const SETTINGS_SECTIONS = Object.freeze([
    Object.freeze({ key: "look", icon: "fa-image", keys: Object.freeze(["language", "theme", "uiScale", "hudTicker", "wideProjectWindows"]) }),
    Object.freeze({ key: "effects", icon: "fa-wand-magic-sparkles", keys: Object.freeze(["pixelFont", "glassPulse", "glassBlur", "reducedMotion", "highContrast"]) }),
    Object.freeze({ key: "sound", icon: "fa-volume-high", keys: Object.freeze(["messengerSound", "musicEnabled", "voiceEnabled", "voiceTile", "liveKitInFoundry"]) }),
    Object.freeze({ key: "rules", icon: "fa-scale-balanced", keys: Object.freeze(["searchTokensPerRoom", "despairFromRolls", "chargeMovement", "friskForce", "autoApproveTraits", "moveAudit", "hideSystemFear"]) }),
    Object.freeze({ key: "privacy", icon: "fa-user-secret", keys: Object.freeze(["forcePrivateRolls", "forceDiceLook", "lockRollDialog", "enforceAnonymity", "roomVisibility", "lockPlayerResources"]) }),
    Object.freeze({ key: "gm", icon: "fa-map-location-dot", keys: Object.freeze(["regionFog", "foundryToolWindows", "enforcePlayerFiles", "isoTokenShield"]) }),
    Object.freeze({ key: "tech", icon: "fa-screwdriver-wrench", keys: Object.freeze(["enforceIsoWelcome", "enforceDhWelcome", "debug"]) })
]);

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

/** The keys of a section `user` is drawn: the client ones for everybody, the world ones for a user who may write them. */
export function keysFor(section, user = game.user) {
    const world = mayModifyWorld(user);
    return section.keys.filter(key => {
        const reg = registered(key);
        return reg && (reg.scope !== "world" || world);
    });
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
        + `<div class="drpg-settings-hint"${rest ? ` data-tooltip="${esc(rest)}"` : ""}>${esc(firstSentence(hint))}</div></div>`;
}

/* Give back Foundry's settings, in Technical (Q3): the menu's words, the button that opened it from Configure Settings. */
function giveBackRowHtml() {
    const hint = localize("DRPG.GiveBack.menuHint");
    const rest = restOf(hint);
    return `<div class="drpg-settings-row drpg-settings-giveback" data-drpg-setting="giveBackFoundry">`
        + `<div class="drpg-settings-control"><span class="drpg-settings-label">${esc(localize("DRPG.GiveBack.menuName"))}</span>`
        + `<button type="button" data-drpg-give-back><i class="fa-solid fa-rotate-left" inert></i> ${esc(localize("DRPG.GiveBack.menuLabel"))}</button></div>`
        + `<div class="drpg-settings-hint"${rest ? ` data-tooltip="${esc(rest)}"` : ""}>${esc(firstSentence(hint))}</div></div>`;
}

/** The sections `user` is drawn, each with its keys: a section none of whose settings the user may see is left out. */
export function sectionsFor(user = game.user) {
    return SETTINGS_SECTIONS.map(s => ({ ...s, shown: keysFor(s, user) }))
        .filter(s => s.shown.length || (s.key === "tech" && user?.isGM));
}

/** The window's two columns' markup: the sections' list and every section's pane, the first one shown. */
export function settingsWindowColumns(user = game.user, { theme = getSetting(SETTINGS.theme), picked = null } = {}) {
    const sections = sectionsFor(user);
    const open = sections.find(s => s.key === picked)?.key ?? sections[0]?.key ?? null;
    const words = s => localize(`DRPG.SettingsWindow.sections.${s.key}`);
    const extra = s => (s.key === "tech" && user?.isGM ? 1 : 0);
    const list = `<nav class="drpg-settings-sections" aria-label="${esc(localize("DRPG.SettingsWindow.sectionsLabel"))}">${sections.map(s =>
        `<button type="button" class="drpg-settings-tab" data-drpg-section="${esc(s.key)}" aria-pressed="${s.key === open}">`
        + `<i class="fa-solid ${esc(s.icon)}" inert></i><span>${esc(words(s))}</span><b>${s.shown.length + extra(s)}</b></button>`).join("")}</nav>`;
    const panes = sections.map(s => `<div class="drpg-settings-pane" data-drpg-pane="${esc(s.key)}"${s.key === open ? "" : " hidden"}>${
        sectionHtml({ title: words(s), body: `<div class="drpg-settings-rows">${s.shown.map(k => settingRowHtml(k, { theme })).join("")}${
            s.key === "tech" && user?.isGM ? giveBackRowHtml() : ""}</div>` })}</div>`).join("");
    return [{ cls: "drpg-settings-nav", html: list }, { cls: "drpg-settings-main", html: `<div class="drpg-settings-panes">${panes}</div>` }];
}

/** Show the section `key` and hide the others; the list's buttons say which is pressed. Answers whether one was shown. */
export function showSection(root, key) {
    const pane = [...(root?.querySelectorAll?.("[data-drpg-pane]") ?? [])].find(p => p.dataset.drpgPane === key);
    if (!pane) return false;
    for (const p of root.querySelectorAll("[data-drpg-pane]")) p.hidden = p !== pane;
    for (const b of root.querySelectorAll("[data-drpg-section]")) b.setAttribute("aria-pressed", String(b.dataset.drpgSection === key));
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
        const n = Number(field.value);
        if (field.value === "" || !Number.isFinite(n)) return undefined;
        const { min = -Infinity, max = Infinity, step = null } = reg.range ?? {};
        const held = Math.min(max, Math.max(min, n));
        if (!step) return held;
        const base = Number.isFinite(min) ? min : 0;
        return Number((base + Math.round((held - base) / step) * step).toFixed(6));
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

/** Open the DRPG Settings window, raised if already open. Answers what the kit's window answers. */
export async function openSettingsWindow() {
    if (alreadyOpen("drpg-window-settings")) return RAISED;
    const user = game.user;
    return wideWindow({
        title: localize("DRPG.SettingsWindow.title"),
        classes: ["drpg-window-settings"],
        columns: settingsWindowColumns(user),
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
            for (const b of root.querySelectorAll("[data-drpg-section]")) {
                b.addEventListener("click", ev => { ev.preventDefault(); showSection(root, b.dataset.drpgSection); });
            }
            root.querySelector(`[name="${SETTINGS.theme}"]`)?.addEventListener("change", ev => syncTheme(root, ev.currentTarget.value));
            root.querySelector("[data-drpg-give-back]")?.addEventListener("click", ev => {
                ev.preventDefault();
                import("./enforced.mjs").then(m => m.openGiveBackFoundry())
                    .catch(err => error("Could not open Give back Foundry's settings", err));
            });
        },
        rejectClose: false
    });
}
