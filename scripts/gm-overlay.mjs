/**
 * Danganronpa RPG - the GMs' overlay on the board (E79 C6, 1.2.79).
 * ---------------------------------------------------------------------------
 * One PIXI container on `canvas.interface`, named `OVERLAY_NAME`, that only a GM's browser ever
 * makes (`gmOverlay` answers null before it builds anything on any other), holding a named layer
 * per thing the GMs see on the map and the players do not: since E79 C6 the layer "passages",
 * each secret passage's stretch on the scene and floor on screen (passages-gm.mjs
 * `drawPassagesLayer`), and "pick", the stretch a GM is picking for a new one. The overlay draws
 * nothing of its own: a file that owns a layer names it with `overlayDrawer`, and the overlay asks
 * every drawer again on each new canvas (`redrawGmOverlay`). Nothing on it takes a pointer.
 *
 * It is found by its name on `canvas.interface` each time, never kept in a variable, so a canvas
 * drawn again gets one new container and never a second. The drawers' data is the GMs' own: a
 * player's browser has no overlay to draw on and nothing to draw.
 *
 * E60 takes this file and adds the layer 'traces'. No import: everything here is PIXI and the DOM.
 */

/** The overlay container's name on `canvas.interface` - read here and nowhere else (R560). */
export const OVERLAY_NAME = "drpgGmOverlay";

/* The layers' drawers, by layer name: each `(layer) => void`, run on every new canvas. */
const DRAWERS = new Map();

/**
 * The GMs' overlay on this canvas, made the first time it is asked for - or null: on a player's
 * browser (always, first of all), and where no canvas is drawn.
 */
export function gmOverlay() {
    if (!game.user?.isGM) return null;
    const parent = canvas?.interface;
    if (!parent?.addChild) return null;
    const found = (parent.children ?? []).find(child => child?.name === OVERLAY_NAME && !child.destroyed);
    if (found) return found;
    const box = new PIXI.Container();
    box.name = OVERLAY_NAME;
    box.eventMode = "none";
    box.interactiveChildren = false;
    parent.addChild(box);
    return box;
}

/** The overlay's layer `name`, made the first time; null wherever `gmOverlay` is. */
export function overlayLayer(name) {
    const box = gmOverlay();
    if (!box) return null;
    const found = (box.children ?? []).find(child => child?.name === name && !child.destroyed);
    if (found) return found;
    const layer = new PIXI.Container();
    layer.name = name;
    layer.eventMode = "none";
    box.addChild(layer);
    return layer;
}

/** Everything a layer holds, taken off and destroyed. */
export function clearLayer(layer) {
    for (const child of [...(layer?.children ?? [])]) {
        layer.removeChild(child);
        child.destroy?.();
    }
}

/** A colour token of the stylesheet as a number for PIXI, or `fallback` where it is not set (fog-doorways.mjs `colourOf`'s reading). */
export function overlayColour(name, fallback) {
    try {
        const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
        return raw ? foundry.utils.Color.from(raw).valueOf() : fallback;
    } catch {
        return fallback;
    }
}

/** A line from (x1, y1) to (x2, y2) drawn in `dash`-long strokes `gap` apart, on a Graphics whose line style is set. */
export function dashedLine(g, x1, y1, x2, y2, dash, gap) {
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (!len) return;
    const ux = (x2 - x1) / len, uy = (y2 - y1) / len;
    for (let at = 0; at < len; at += dash + gap) {
        const end = Math.min(len, at + dash);
        g.moveTo(x1 + ux * at, y1 + uy * at);
        g.lineTo(x1 + ux * end, y1 + uy * end);
    }
}

/** A file's drawer of the layer `name`, asked on every new canvas. */
export function overlayDrawer(name, draw) {
    DRAWERS.set(name, draw);
}

/** Every layer drawn again - or, named, that one; nothing where `gmOverlay` is null. */
export function redrawGmOverlay(name = null) {
    if (!gmOverlay()) return;
    for (const [layerName, draw] of DRAWERS) {
        if (name && name !== layerName) continue;
        const layer = overlayLayer(layerName);
        if (layer) draw(layer);
    }
}

/** On every browser: each new canvas asks for the overlay, which only a GM's draws. */
export function registerGmOverlay() {
    Hooks.on("canvasReady", () => redrawGmOverlay());
}
