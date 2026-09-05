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
 * sliders, which live here now. Under "Monokuma Legacy" this file is not used
 * and the launcher opens the Sound window as before.
 */

import { MODULE_ID } from "./config.mjs";
import { SETTINGS, getSetting, setSetting } from "./settings.mjs";
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
    const opt = (value, label) => `<option value="${value}"${theme === value ? " selected" : ""}>${
        foundry.utils.escapeHTML(game.i18n.localize(label))}</option>`;
    return `<fieldset class="drpg-look">
        <legend>${t("legend")}</legend>
        <label><span>${t("theme")}</span>
            <select name="look:theme">${opt("stainedGlass", "DRPG.Settings.theme.stainedGlass")}${opt("monokumaLegacy", "DRPG.Settings.theme.monokumaLegacy")}</select></label>
        <label><span>${t("glassEffects")}</span>
            <input type="checkbox" name="look:glassEffects"${effects ? " checked" : ""}></label>
        <label><span>${t("uiScale")}</span>
            <input type="range" name="look:uiScale" min="0.8" max="1.4" step="0.05" value="${scale}">
            <output>${Math.round(scale * 100)}%</output></label>
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
    const range = root.querySelector("[name='look:uiScale']");
    if (range) {
        const out = range.parentElement.querySelector("output");
        range.addEventListener("input", () => { if (out) out.textContent = `${Math.round(range.valueAsNumber * 100)}%`; });
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
