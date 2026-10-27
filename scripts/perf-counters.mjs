/**
 * Danganronpa RPG - how often the module's per-frame and per-event work runs.
 * ---------------------------------------------------------------------------
 * E88 C0 (27.10.2026; the owner's report of lag with several players, many Remnants, and a player alone in a
 * fogged room). Every suspect E88's spec names was found by reading the code, not by measuring it, and a guess
 * about where the frame goes is what CLAUDE.md's first rule exists to stop. So before anything is optimised, each
 * suspect counts its own runs here: an integer increment on a Map, nothing timed, nothing kept but the numbers,
 * nothing written to the world. `game.drpg.counters()` reads them, `game.drpg.fps()` prints the deltas over its
 * window, and scenario 86-frame-work reads them on every client around one event at a time.
 *
 * A counter costs one Map read and one write per run. Timing is never taken here: only inside an `fps()` window
 * (diagnostics.mjs `frameCost`), which a person starts and which ends by itself. The numbers are lost on a reload,
 * on purpose - they are a stopwatch, not a record.
 *
 * No imports: every file that counts imports this one, and a leaf can be imported by anything without a cycle.
 *
 * THE NAMES (each counted where the work runs, `<file>.<what>`):
 *   refreshToken.visibility | .ownRing | .remnantRing | .remnantIcons   one per run of that `refreshToken` listener
 *   ownRing.rebuilt | .skipped | .kept, remnantRing (the same)         a ring drawn again, a paint that drew none, a
 *                                                                       refresh that kept the drawing standing (E88 C2)
 *   visibility.applyAll, visibility.applyAll.tokens                     whole passes, and the tokens each flagged
 *   visibility.applyOne                                                 a move that asked its own token alone (E88 C2)
 *   visibility.applyToToken                                             one verdict carried to a sprite
 *   visibility.reassert, visibility.reassert.tokens                     next-frame walks, and the tokens walked
 *   visibility.myIncidentTrace, visibility.sightRefresh                 the D11 ask; Foundry's sight refresh heard
 *   visibility.incidentCast                                             the D11 cast read, once a frame or pass (E88 C2)
 *   remnantIcons.apply                                                  a trace dressed on a refresh
 *   utils.cssColour, utils.cssColour.read                               a canvas colour asked; read off the stylesheet
 *                                                                       (kept until the body changes since E88 C2)
 *   fog.repaintFog, fog.buildFogTexture, fog.driftTick                  a repaint asked, a texture built, a drift frame
 *   fog.held.raster | .backdrop | .live | .freed                        a layer drawn into its picture, a frame that drew
 *                                                                       a held layer live (its picture out of date), a
 *                                                                       picture freed (fog.mjs, E88 C3)
 *   clock.refreshSheets, clock.refreshSheets.rendered                   a sheet pass, and the sheets it rendered
 *   hud.renderHud, playerStatus.render                                  the HUD and the status strip drawn
 *   glass.pulseFrame, glass.paintBand                                   the curtain's pulse frame, a window band painted
 *   halo.baked | .shared | .live | .freed                               a seam's light drawn into a texture, a ring that
 *                                                                       wore one already drawn, a light left on its live
 *                                                                       filter, a texture freed (fog-reveal.mjs, E88 C1)
 */

const counts = new Map();

/** Add `n` (1 by default) to the counter `name`. Never throws: a counter must not break what it counts. */
export function count(name, n = 1) {
    counts.set(name, (counts.get(name) ?? 0) + n);
}

/** Every counter as it stands, as a plain object sorted by name. */
export function snapshot() {
    return Object.fromEntries([...counts.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

/** Back to nothing. */
export function reset() {
    counts.clear();
}

/** What moved between two snapshots: each counter that grew, by how much. */
export function delta(before, after) {
    const out = {};
    for (const [name, value] of Object.entries(after ?? {})) {
        const moved = value - (before?.[name] ?? 0);
        if (moved) out[name] = moved;
    }
    return out;
}

/**
 * THE FILTERS ON SCREEN NOW: a reading, not a counter. A filter on a display object that is drawn costs its passes
 * on every frame the canvas renders, whether or not anything moved (PIXI renders the stage on each tick of
 * `canvas.app.ticker`), so the count of them is the per-frame cost the counters above cannot see.
 *
 * Walked from `roots` (the canvas's stage, and each token's placeable, which the headless harness keeps outside its
 * stage), each object once, into a child only while every ancestor is `visible` and `renderable` - what PIXI would
 * skip, this skips. A blur is told apart by its own `blur` field, which PIXI's BlurFilter and the harness's stand-in
 * both carry. `mask` counts the sprite or graphics masks on drawn objects: PIXI 7 draws a sprite mask as a filter
 * pass (to confirm on v14's PIXI, E88's spec). `byName` groups the filtered objects by their `name`, so the rings'
 * halos (`drpgOwnRingGlow`, `drpgRemnantRingGlow`) and the room outline's stand apart. `collect`, a list, is handed
 * every filtered object found, for `fps()` to hold them one group at a time.
 */
export function liveCanvasFilters(roots = [], { collect = null } = {}) {
    const seen = new Set();
    const out = { filters: 0, blurs: 0, masks: 0, objects: 0, byName: {} };
    const walk = node => {
        if (!node || typeof node !== "object" || seen.has(node) || node.destroyed) return;
        seen.add(node);
        if (node.visible === false || node.renderable === false) return;
        const filters = Array.isArray(node.filters) ? node.filters.filter(Boolean) : [];
        if (filters.length) {
            out.objects++;
            out.filters += filters.length;
            out.blurs += filters.filter(f => typeof f.blur === "number").length;
            const name = node.name || "(unnamed)";
            out.byName[name] = (out.byName[name] ?? 0) + filters.length;
            collect?.push(node);
        }
        if (node.mask) out.masks++;
        for (const child of node.children ?? []) walk(child);
    };
    for (const root of roots) walk(root);
    return out;
}
