/**
 * Danganronpa RPG - Foundry's selection wears the interface colour.
 * ---------------------------------------------------------------------------
 * Dawid, 22.09, on 1.2.50: "czy zaznaczenie forge na scenie tez mozemy zmienic na
 * kolor drpg-interface?" The one orange on the map was Foundry's: the border of a
 * controlled token, tile, drawing, note, region or template, and the rectangle a drag
 * draws, all 0xFF9829. Everything else the module draws on the scene is the interface
 * colour - the room borders, the student frames, the glass's own seams - so the
 * selection takes it too, and follows the hour and the phase the way they do.
 *
 * TWO PLACES, BECAUSE FOUNDRY HAS TWO (read in 14.365's foundry.mjs):
 *  - `CONFIG.Canvas.dispositionColors.CONTROLLED`, which every placeable's
 *    `_refreshState` reads for its controlled border - so writing it IS the change,
 *    and the placeables already on screen are asked to refresh their state;
 *  - `ControlsLayer#drawSelect`, the drag rectangle, which has the orange written into
 *    its body. That method is replaced with the same two lines reading the config.
 * Left orange: a wall's highlight and the resize handle on a tile or drawing, both of
 * which have the number inside a private draw, and both GM tools.
 *
 * NOT THE HOVER COLOURS. Hovering a token that is not controlled shows its
 * disposition (friendly, hostile, party), which is information rather than chrome.
 *
 * THE SAME COLOUR AS ANOTHER STUDENT'S FRAME, and still told apart: Foundry's border
 * is a line with a black outline drawn inside the token's square, and the frame is the
 * seam's hairline with its light (see own-ring.mjs), so a GM who selects a student
 * sees the black-edged line inside the glowing one.
 */

import { debug } from "./utils.mjs";
import { hourColour } from "./own-ring.mjs";

/** Foundry's own, kept so a missing reading puts back what was there. */
const FOUNDRY_CONTROLLED = 0xFF9829;

/** Every placeable on screen that is showing a controlled border, asked to redraw it. */
function refreshSelected() {
    for (const layer of Object.values(canvas?.layers ?? {})) {
        for (const p of layer?.placeables ?? []) {
            if (p.controlled || p.hover) p.renderFlags?.set?.({ refreshState: true });
        }
    }
}

/** Write the interface colour into Foundry's selection, and redraw what shows it. */
export function applySelectionColour() {
    try {
        const colours = CONFIG?.Canvas?.dispositionColors;
        if (!colours) return;
        const colour = hourColour() ?? FOUNDRY_CONTROLLED;
        if (colours.CONTROLLED === colour) return;
        colours.CONTROLLED = colour;
        if (canvas?.ready) refreshSelected();
    } catch (err) {
        debug("Could not recolour Foundry's selection", err);
    }
}

/** The drag rectangle, with its colour read from the config instead of written in. */
function patchDragRectangle() {
    const proto = foundry.canvas?.layers?.ControlsLayer?.prototype;
    if (!proto || typeof proto.drawSelect !== "function" || proto.drawSelect.drpgPatched) return;
    const patched = function drawSelect({ x, y, width, height }) {
        const s = this.select.clear();
        const colour = CONFIG.Canvas.dispositionColors?.CONTROLLED ?? FOUNDRY_CONTROLLED;
        s.lineStyle(3 * canvas.dimensions.uiScale, colour, 0.9).drawRect(x, y, width, height);
    };
    patched.drpgPatched = true;
    proto.drawSelect = patched;
}

export function registerSelectionColour() {
    patchDragRectangle();
    /* At ready the body carries the hour and the theme; at every scene draw the
       placeables are new. The colour is the stylesheet's, so it is read, never kept. */
    Hooks.once("ready", applySelectionColour);
    Hooks.on("canvasReady", applySelectionColour);
    /* The hour, the phase, the Eclipse and the theme are all body facts, so they are
       watched there - the same attributes the student frames repaint on. */
    let timer = 0;
    new MutationObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(applySelectionColour, 60);
    }).observe(document.body, {
        attributes: true,
        attributeFilter: ["class", "data-drpg-phase", "data-drpg-time"]
    });
}
