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
import { SETTINGS, getSetting, setSetting, autoScale, effectiveScale } from "./settings.mjs";
import { alreadyOpen } from "./live.mjs";
import { error } from "./utils.mjs";

/** True when this browser wears the Stained Glass theme. */
export function isStainedGlass() {
    try { return getSetting(SETTINGS.theme) === "stainedGlass"; } catch { return false; }
}

function lookFieldset() {
    const t = key => game.i18n.localize(`DRPG.Look.${key}`);
    const theme = getSetting(SETTINGS.theme);
    const effects = getSetting(SETTINGS.glassEffects) !== false;
    const scale = Number(getSetting(SETTINGS.uiScale)) || 1;
    /* The pixel face belongs to Monokuma Legacy, where it is the identity and the default,
       so the switch is only shown to a browser wearing that theme. Under Stained Glass it
       would be a switch that does nothing (settings.mjs `pixelFontOn`). */
    const legacy = theme !== "stainedGlass";
    const check = (key, setting, on) => `<label><span>${t(key)}</span>
            <input type="checkbox" name="look:${setting}"${on ? " checked" : ""}></label>`;
    const pixel = legacy ? check("pixelFont", SETTINGS.pixelFont, getSetting(SETTINGS.pixelFont) !== false) : "";
    /* The glass's own two switches are shown to the browsers that have glass. The other two
       belong to every theme: motion and sound are not the glass's to own. */
    const glassOnly = legacy ? "" :
        check("pulse", SETTINGS.glassPulse, getSetting(SETTINGS.glassPulse) !== false)
        + check("ticker", SETTINGS.hudTicker, getSetting(SETTINGS.hudTicker) !== false);
    const always = check("reducedMotion", SETTINGS.reducedMotion, getSetting(SETTINGS.reducedMotion) === true)
        + check("messengerSound", SETTINGS.messengerSound, getSetting(SETTINGS.messengerSound) !== false);
    const opt = (value, label) => `<option value="${value}"${theme === value ? " selected" : ""}>${
        foundry.utils.escapeHTML(game.i18n.localize(label))}</option>`;
    return `<fieldset class="drpg-look">
        <legend>${t("legend")}</legend>
        <label><span>${t("theme")}</span>
            <select name="look:theme">${opt("stainedGlass", "DRPG.Settings.theme.stainedGlass")}${opt("monokumaLegacy", "DRPG.Settings.theme.monokumaLegacy")}</select></label>
        ${pixel}<label><span>${t("glassEffects")}</span>
            <input type="checkbox" name="look:glassEffects"${effects ? " checked" : ""}></label>
        <label><span>${t("uiScale")}</span>
            <input type="range" name="look:uiScale" min="0.8" max="1.4" step="0.05" value="${scale}">
            <output>${Math.round(scale * 100)}%</output></label>
        <p class="notes" data-drpg-scale-note>${game.i18n.format("DRPG.Look.uiScaleAuto", { auto: Math.round(autoScale() * 100), total: Math.round(effectiveScale() * 100), w: innerWidth, h: innerHeight })}</p>
        ${glassOnly}${always}
        <p class="notes">${t("note")}</p>
        <p class="notes drpg-look-report"><code data-glass-report>-</code> <button type="button" data-action="drpg-redraw">${t("redraw")}</button></p>
    </fieldset>`;
}

async function report(root) {
    const out = root.querySelector("[data-glass-report]");
    if (!out) return;
    try { const m = await import("./glass.mjs"); out.textContent = m.glassReport(); } catch (err) { out.textContent = String(err); }
}

function wireLook(root) {
    report(root);
    root.querySelector("[data-action='drpg-redraw']")?.addEventListener("click", async () => {
        try { const m = await import("./glass.mjs"); m.refreshGlass(); setTimeout(() => report(root), 400); } catch (err) { error("Could not redraw the curtain", err); }
    });
    root.querySelector("[name='look:theme']")?.addEventListener("change", ev =>
        setSetting(SETTINGS.theme, ev.currentTarget.value).catch(err => error("Could not change the theme", err)));
    root.querySelector("[name='look:glassEffects']")?.addEventListener("change", ev =>
        setSetting(SETTINGS.glassEffects, ev.currentTarget.checked).catch(err => error("Could not change the glass effects", err)));
    /* Every switch above writes one client setting and nothing else; `applyTheme` (their
       `onChange`) does the rest, so this list stays a list. */
    for (const [name, setting, label] of [
        [SETTINGS.pixelFont, SETTINGS.pixelFont, "the pixel font"],
        [SETTINGS.glassPulse, SETTINGS.glassPulse, "the glass pulse"],
        [SETTINGS.hudTicker, SETTINGS.hudTicker, "the clock's ticker"],
        [SETTINGS.reducedMotion, SETTINGS.reducedMotion, "reduced motion"],
        [SETTINGS.messengerSound, SETTINGS.messengerSound, "the messenger sounds"]
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
        position: { width: 460 },
        content: dialogContent(`<form>${soundSlidersHtml()}${lookFieldset()}</form>`),
        buttons: [{ action: "close", label: game.i18n.localize("DRPG.Panel.close") }],
        render: (event, dialog) => { wireSoundPanel(dialog.element); wireLook(dialog.element); },
        rejectClose: false
    });
}

void MODULE_ID;
