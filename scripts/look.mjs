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

import { SETTINGS, getSetting, setSetting, autoScale, moduleLanguage } from "./settings.mjs";
import { LANGUAGES, confirmLanguageReload } from "./i18n.mjs";
import { alreadyOpen } from "./live.mjs";
import { error } from "./utils.mjs";

/** True when this browser wears the Stained Glass theme. */
export function isStainedGlass() {
    try { return getSetting(SETTINGS.theme) === "stainedGlass"; } catch { return false; }
}

/**
 * The note under the slider, which is a different sentence in each theme (W-2).
 *
 * The glass carries the screen's own factor under the slider, so it says both
 * numbers. Monokuma Legacy does not - it takes the slider and nothing else - and
 * the old note told a Legacy player their screen was "drawn at 85 % of 1440p"
 * when neither factor touched one pixel of their interface. Built here rather
 * than twice, because the live handler below rebuilt the same string from the
 * same three numbers and the two were one edit away from drifting.
 */
function scaleNote(slider) {
    const where = { w: innerWidth, h: innerHeight };
    if (isStainedGlass()) {
        return game.i18n.format("DRPG.Look.uiScaleAuto", {
            ...where,
            auto: Math.round(autoScale() * 100),
            total: Math.round(slider * autoScale() * 100)
        });
    }
    return game.i18n.format("DRPG.Look.uiScaleSlider", {
        ...where, slider: Math.round(slider * 100)
    });
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
    /* The glass's own switches - the pulse, the ticker and the blur - are shown to the
       browsers that have glass, and to nobody else.
       The messenger sounds went the other way, to the Volume fieldset above (sfx.mjs),
       which is where a sound switch is looked for.
       Foundry's own settings window hides the same three through `renderSettingsConfig`
       in settings.mjs; the two windows show the same set.

       REDUCED MOTION IS FOR EVERY THEME AGAIN (Dawid, 16.09, W-3). It sat in this group from
       08.09 on the grounds that Legacy had nothing for it to damp. Legacy has the popups, the
       flares, the clock's turn-over and windows that grow in and fade out, and an
       accessibility switch should not depend on which look a player picked - so it is added
       after the group, outside the theme test, and both windows show it under both themes. */
    const glassOnly = (legacy ? "" :
        check("pulse", SETTINGS.glassPulse, getSetting(SETTINGS.glassPulse) !== false)
        + check("ticker", SETTINGS.hudTicker, getSetting(SETTINGS.hudTicker) !== false)
        /* The blur is in this group because it is glass-only, and last in it because it
           is the only row here that is about what the machine can draw rather than what
           its owner wants to look at. It is also the row worth reaching for first when a
           table reports a stutter - see `--drpg-glass-backdrop` in stained-glass.css. */
        + check("blur", SETTINGS.glassBlur, getSetting(SETTINGS.glassBlur) !== false))
        + check("reducedMotion", SETTINGS.reducedMotion, getSetting(SETTINGS.reducedMotion) === true);
    /* HIGH CONTRAST STANDS WITH REDUCED MOTION, and for the same reason (W-7): it is
       an accessibility switch, not a theme effect, so it is offered whichever look a
       player picked. The note under it is for the one case a switch cannot explain
       itself - the system already asking for more contrast, which turns it on
       whatever the box says. */
    const contrast = check("contrast", SETTINGS.highContrast, getSetting(SETTINGS.highContrast) === true)
        + (systemWantsContrast()
            ? `<p class="notes">${t("contrastAuto")}</p>` : "");
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
        <p class="notes" data-drpg-scale-note>${scaleNote(scale)}</p>
        ${glassOnly}
        ${contrast}
        <p class="notes">${t("note")}</p>
    </fieldset>`;
}

/**
 * Is the SYSTEM asking for more contrast, whatever this client's switch says?
 *
 * Asked here only to decide whether to print the note - `highContrastOn` in
 * settings.mjs is what decides the class, and this window must not grow a second
 * opinion about that.
 */
function systemWantsContrast() {
    try {
        return Boolean(window.matchMedia?.("(prefers-contrast: more)")?.matches);
    } catch {
        return false;
    }
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
        [SETTINGS.glassBlur, SETTINGS.glassBlur, "the glass's blur"],
        [SETTINGS.reducedMotion, SETTINGS.reducedMotion, "reduced motion"],
        [SETTINGS.highContrast, SETTINGS.highContrast, "high contrast"]
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
            if (note) note.textContent = scaleNote(range.valueAsNumber);
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

