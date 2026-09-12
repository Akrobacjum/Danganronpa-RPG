/**
 * Danganronpa RPG - the Look dialog (theme "Stained Glass").
 * ---------------------------------------------------------------------------
 * The settings button in the bottom-right corner (the sound launcher, wearing
 * a gear under this theme) opens ONE window for everything that is this
 * browser's own: the two volumes that used to be the whole of the player's
 * Sound window, and the look - theme, glass effects, interface scale. All of
 * it is `scope: "client"`; nothing here reaches another player or the world.
 *
 * The GM's Sound window keeps its playlists and effect files and loses the
 * sliders, which live here now. The launcher opens this window under both
 * themes: it is a player's only door to the theme switch, and under Monokuma
 * Legacy it is also where the pixel face is turned on and off.
 */

import { MODULE_ID } from "./config.mjs";
import { SETTINGS, getSetting, setSetting, autoScale, effectiveScale, moduleLanguage } from "./settings.mjs";
import { LANGUAGES, confirmLanguageReload } from "./i18n.mjs";
import { alreadyOpen } from "./live.mjs";
import { error } from "./utils.mjs";

/** True when this browser wears the Stained Glass theme. */
export function isStainedGlass() {
    try { return getSetting(SETTINGS.theme) === "stainedGlass"; } catch { return false; }
}

function lookFieldset() {
    const t = key => game.i18n.localize(`DRPG.Look.${key}`);
    const theme = getSetting(SETTINGS.theme);
    const scale = Number(getSetting(SETTINGS.uiScale)) || 1;
    /* The pixel face belongs to Monokuma Legacy, where it is the identity and the default,
       so the switch is only shown to a browser wearing that theme. Under Stained Glass it
       would be a switch that does nothing (settings.mjs `pixelFontOn`). */
    const legacy = theme !== "stainedGlass";
    const check = (key, setting, on) => `<label><span>${t(key)}</span>
            <input type="checkbox" name="look:${setting}"${on ? " checked" : ""}></label>`;
    const pixel = legacy ? check("pixelFont", SETTINGS.pixelFont, getSetting(SETTINGS.pixelFont) !== false) : "";
    /* The glass's own switches are shown to the browsers that have glass, and nothing else
       is left in this group. Reduced motion joined it on 08.09 (Dawid): what it damps down
       is the curtain, the pulse and the panes turning, all of which Monokuma Legacy does
       not have - so under that theme it was a third switch that changed nothing.
       The messenger sounds went the other way, to the Volume fieldset above (sfx.mjs),
       which is where a sound switch is looked for.
       Foundry's own settings window hides the same three through `renderSettingsConfig`
       in settings.mjs; the two windows show the same set. */
    /* Reduced motion is shown under both themes: the switch damps the popups, the flares
       and the clock's turn-over as well as the glass, and Monokuma Legacy has all of those. */
    const glassOnly = (legacy ? "" :
        check("pulse", SETTINGS.glassPulse, getSetting(SETTINGS.glassPulse) !== false)
        + check("ticker", SETTINGS.hudTicker, getSetting(SETTINGS.hudTicker) !== false))
        + check("reducedMotion", SETTINGS.reducedMotion, getSetting(SETTINGS.reducedMotion) === true);
    const opt = (value, label) => `<option value="${value}"${theme === value ? " selected" : ""}>${
        foundry.utils.escapeHTML(game.i18n.localize(label))}</option>`;
    /* The language, first: it is the one row here that changes every other word on the
       screen, and a player looking for it should not have to read the theme's switches
       first. The names are the languages' own, never translated. */
    const lang = moduleLanguage();
    const langOptions = Object.entries(LANGUAGES).map(([value, name]) =>
        `<option value="${value}"${lang === value ? " selected" : ""}>${foundry.utils.escapeHTML(name)}</option>`).join("");
    return `<fieldset class="drpg-look">
        <legend>${t("legend")}</legend>
        <label><span>${t("language")}</span>
            <select name="look:language">${langOptions}</select></label>
        <label><span>${t("theme")}</span>
            <select name="look:theme">${opt("stainedGlass", "DRPG.Settings.theme.stainedGlass")}${opt("monokumaLegacy", "DRPG.Settings.theme.monokumaLegacy")}</select></label>
        ${pixel}
        <label><span>${t("uiScale")}</span>
            <input type="range" name="look:uiScale" min="0.8" max="1.4" step="0.05" value="${scale}">
            <output>${Math.round(scale * 100)}%</output></label>
        <p class="notes" data-drpg-scale-note>${game.i18n.format("DRPG.Look.uiScaleAuto", { auto: Math.round(autoScale() * 100), total: Math.round(effectiveScale() * 100), w: innerWidth, h: innerHeight })}</p>
        ${glassOnly}
        <p class="notes">${t("note")}</p>
    </fieldset>`;
}

function wireLook(root) {
    /* A language change is a reload - every open window was built in the old one. The
       setting is written first, so a declined reload still takes effect next time. */
    root.querySelector("[name='look:language']")?.addEventListener("change", async ev => {
        try {
            await setSetting(SETTINGS.language, ev.currentTarget.value);
            await confirmLanguageReload();
        } catch (err) { error("Could not change the language", err); }
    });
    /* The glass report and its "Redraw the glass" button were taken out on 07.09: a diagnostic
       does not belong in a player's settings window, and `drpgGlassDebug()` in the console
       still prints every number it printed, to the person who actually wants it. */
    /* THE SWITCH SET FOLLOWS THE THEME WITHOUT A REOPEN.
       `lookFieldset` is built for one theme - the glass group under Stained Glass, the pixel
       face under Monokuma Legacy - and nothing re-renders this window when the theme changes,
       so picking the other theme used to leave the old theme's switches sitting there until
       somebody closed and reopened the window. The fieldset is rebuilt in place instead, and
       rewired: every listener above hangs off nodes that just went, this select included, so
       there is nothing left to bind twice. */
    root.querySelector("[name='look:theme']")?.addEventListener("change", async ev => {
        try { await setSetting(SETTINGS.theme, ev.currentTarget.value); }
        catch (err) { error("Could not change the theme", err); return; }
        const field = root.querySelector("fieldset.drpg-look");
        if (!field) return;
        const holder = document.createElement("div");
        holder.innerHTML = lookFieldset();
        const fresh = holder.firstElementChild;
        if (!fresh) return;
        field.replaceWith(fresh);
        wireLook(root);
    });
    /* Every switch above writes one client setting and nothing else; `applyTheme` (their
       `onChange`) does the rest, so this list stays a list. */
    for (const [name, setting, label] of [
        [SETTINGS.pixelFont, SETTINGS.pixelFont, "the pixel font"],
        [SETTINGS.glassPulse, SETTINGS.glassPulse, "the glass pulse"],
        [SETTINGS.hudTicker, SETTINGS.hudTicker, "the clock's ticker"],
        [SETTINGS.reducedMotion, SETTINGS.reducedMotion, "reduced motion"]
    ]) {
        root.querySelector(`[name='look:${name}']`)?.addEventListener("change", ev =>
            setSetting(setting, ev.currentTarget.checked).catch(err => error(`Could not change ${label}`, err)));
    }
    const range = root.querySelector("[name='look:uiScale']");
    if (range) {
        const out = range.parentElement.querySelector("output");
        const note = root.querySelector("[data-drpg-scale-note]");
        range.addEventListener("input", () => {
            if (out) out.textContent = `${Math.round(range.valueAsNumber * 100)}%`;
            if (note) note.textContent = game.i18n.format("DRPG.Look.uiScaleAuto", { auto: Math.round(autoScale() * 100), total: Math.round(range.valueAsNumber * autoScale() * 100), w: innerWidth, h: innerHeight });
        });
        range.addEventListener("change", () =>
            setSetting(SETTINGS.uiScale, Math.round(range.valueAsNumber * 20) / 20).catch(err => error("Could not change the interface scale", err)));
    }
}

/**
 * Open the Look dialog: volumes and look, one window, raised if already open.
 */
export async function openLookDialog() {
    if (alreadyOpen("drpg-window-look")) return null;
    const { dialogContent, tableDialog } = await import("./utils.mjs");
    const { soundSlidersHtml, wireSoundPanel } = await import("./sfx.mjs");
    return tableDialog({
        window: { title: game.i18n.localize("DRPG.Look.title") },
        classes: ["drpg-panel", "drpg-projects", "drpg-sound", "drpg-sound-player", "drpg-window-look"],
        position: { width: 560 },
        content: dialogContent(`<form>${soundSlidersHtml()}${lookFieldset()}</form>`),
        buttons: [{ action: "close", label: game.i18n.localize("DRPG.Panel.close") }],
        render: (event, dialog) => { wireSoundPanel(dialog.element); wireLook(dialog.element); },
        rejectClose: false
    });
}

void MODULE_ID;
