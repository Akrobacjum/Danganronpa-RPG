/**
 * Danganronpa RPG - a lost drawing context, recorded (1.2.129 line UI; S0-WHITE, the owner after session 0, 23.11.2026:
 * "w ktoryms momencie u jednego z graczy ekran stal sie caly bialy").
 * ---------------------------------------------------------------------------
 * WHAT THIS IS FOR. Nothing in the module paints the whole screen white (read in code for S0-WHITE: the light fills are
 * the curtain's two flashes, which animate to nothing and are removed, and the fog's mask, which the layer hides when its
 * build fails). What blanks a Chromium page is a lost drawing context or a GPU process that went down, and until this
 * file nothing in scripts/ listened for one. So when the board's canvas loses its WebGL context, this browser writes it
 * to its failure log (utils.mjs `error`: the time, the scene, the theme) and tells the GMs once, in their corner. A
 * restore is logged as a warning and arms the next loss's message. It PREVENTS NOTHING and repairs nothing: no
 * `preventDefault` here, so whether and how the context comes back stays Foundry's and PIXI's own business.
 *
 * WHICH CANVASES. The board's (`canvas.app.view`, Foundry's WebGL canvas), watched at every `canvasReady`, once per
 * element. The module draws no WebGL canvas of its own: every `getContext` in scripts/ asks for "2d" (the curtain, the
 * fog's helpers, the sequences; read 23.11.2026), so there is nothing else with a GL context to watch.
 *
 * THE DEFAULTS (the coordinator's, pending the owner; one constant): `CONTEXT_WATCH.tellGms`, on.
 */
import { error, warn, whisperToGms, esc } from "./utils.mjs";

/** The two events of a WebGL canvas this file listens for. */
export const CONTEXT_EVENTS = Object.freeze({ lost: "webglcontextlost", restored: "webglcontextrestored" });

/** Whether a loss is also told to the GMs (the coordinator's default, 23.11.2026). */
export const CONTEXT_WATCH = Object.freeze({ tellGms: true });

const watched = new WeakSet();

/** What a loss is written down with: when, on which scene, under which theme. Pure but for the page it reads. */
export function contextReading(at = Date.now()) {
    let scene = null;
    try { scene = globalThis.canvas?.scene?.name ?? null; } catch { /* no canvas */ }
    const body = globalThis.document?.body;
    const theme = body?.classList.contains("drpg-theme-stained-glass") ? "stained-glass"
        : body?.classList.contains("drpg-theme-monokuma-legacy") ? "monokuma-legacy" : "unknown";
    return { at: new Date(at).toISOString(), scene, theme };
}

/** The GMs' card: this user's name and the scene, in the GMs' corner (no centring is asked). */
export function tellGmsOfLoss(reading) {
    const words = game.i18n.format("DRPG.Context.lost", { name: esc(game.user?.name ?? "?"), scene: esc(reading?.scene ?? "-") });
    return whisperToGms(`<p>${words}</p>`);
}

/**
 * Watch `el`, a canvas with a WebGL context, for its loss and its restore. Answers false for an element already watched
 * or none. A loss is an error in this browser's failure log and, once until the next restore, a card to the GMs
 * (`tell`, `tellGmsOfLoss` by default; a stand-in in R8811). Exported for R8811.
 */
export function watchContext(el, { label = "board", tell = tellGmsOfLoss } = {}) {
    if (!el?.addEventListener || watched.has(el)) return false;
    watched.add(el);
    let told = false;
    el.addEventListener(CONTEXT_EVENTS.lost, () => {
        const reading = contextReading();
        error(`The ${label}'s drawing context was lost (WebGL)`, reading);
        if (told || !CONTEXT_WATCH.tellGms) return;
        told = true;
        Promise.resolve().then(() => tell(reading)).catch(err => error("Could not tell the GMs of a lost drawing context", err));
    });
    el.addEventListener(CONTEXT_EVENTS.restored, () => {
        warn(`The ${label}'s drawing context was restored (WebGL)`, contextReading());
        told = false;
    });
    return true;
}

/** The board's canvas, watched once it stands (module.mjs). */
export function registerContextWatch() {
    Hooks.on("canvasReady", () => {
        const view = globalThis.canvas?.app?.view ?? globalThis.canvas?.app?.canvas ?? null;
        watchContext(view, { label: "board" });
    });
}
