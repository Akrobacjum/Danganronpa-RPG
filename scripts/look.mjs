/**
 * Danganronpa RPG - the look's rules, and the gear's door (theme "Stained Glass").
 * ---------------------------------------------------------------------------
 * The settings button in the bottom-right corner (the sound launcher, wearing a gear under both themes) opened ONE
 * window for everything that is this browser's own, the Look window: the two volumes, the Voice section and the look -
 * language, theme, glass effects, interface scale. Since E49 A1d (11.11.2026; the owner on A1's shots: "Gm pod
 * przyciskiem zebatki nie powinien miec innych ustawien niz gracz ... zniknela czesc ustawien np push to talk, urzadzenia
 * wejsciowe i wyjsciowe") that window is the DRPG Settings window (settings-window.mjs `openSettingsWindow`), the same
 * for a GM and a player, and every row it held is there: the look and its switches in Look and in Effects and
 * accessibility, the volumes, the messenger's sounds and the Voice section in Sound. `openLookDialog` opens it; two
 * windows with the same rows is how the two drift apart (sound-panel.mjs's note on the player's Sound window).
 *
 * What stays here is what both read: whether the glass is worn, the line under the scale, which settings are one
 * theme's alone, and whether the system asks for more contrast.
 */

import { SETTINGS, getSetting, autoScale } from "./settings.mjs";

/** True when this browser wears the Stained Glass theme. */
function isStainedGlass() {
    try { return getSetting(SETTINGS.theme) === "stainedGlass"; } catch { return false; }
}

/**
 * The note under the slider, which is a different sentence in each theme (W-2).
 *
 * The glass carries the screen's own factor under the slider, so it says both
 * numbers. Monokuma Legacy does not - it takes the slider and nothing else - and
 * the old note told a Legacy player their screen was "drawn at 85 % of 1440p"
 * when neither factor touched one pixel of their interface. Built here rather
 * than twice, because the live handler rebuilt the same string from the same
 * three numbers and the two were one edit away from drifting. Since E49 A1d the
 * settings window (settings-window.mjs) draws it under Interface scale and
 * follows the field with it.
 */
export function scaleNote(slider) {
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

/**
 * The settings that are one theme's alone (E49 A1): the glass's pulse, clock ticker and blur under Stained Glass, the
 * pixel face under Monokuma Legacy, by SETTINGS name; [] for a theme with none. The DRPG Settings window
 * (settings-window.mjs) draws such a setting in its place, disabled under the other theme (the Look window, until E49
 * A1d, showed it to nobody else). Reduced motion and high contrast are every theme's (W-3, W-7).
 */
export function themeOnlyKeys(theme) {
    if (theme === "stainedGlass") return [SETTINGS.glassPulse, SETTINGS.hudTicker, SETTINGS.glassBlur];
    if (theme === "monokumaLegacy") return [SETTINGS.pixelFont];
    return [];
}

/**
 * Is the SYSTEM asking for more contrast, whatever this client's switch says?
 *
 * Asked only to decide whether to print the note (settings-window.mjs, under
 * Effects and accessibility) - `highContrastOn` in settings.mjs is what decides
 * the class, and the window must not grow a second opinion about that.
 */
export function systemWantsContrast() {
    try {
        return Boolean(window.matchMedia?.("(prefers-contrast: more)")?.matches);
    } catch {
        return false;
    }
}

/**
 * Open the gear's window: since E49 A1d the DRPG Settings window (settings-window.mjs `openSettingsWindow`), which holds
 * every row the Look window held. Answers what it answers (RAISED when it stands open already).
 */
export async function openLookDialog() {
    return (await import("./settings-window.mjs")).openSettingsWindow();
}
