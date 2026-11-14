/**
 * Danganronpa RPG - the ghost of an erased trace (PV, 13.11.2026; the owner's rule #4).
 * ---------------------------------------------------------------------------
 * A trace a player had found, erased by a Tamper or a clean-up while none of their characters stood in its room, used
 * to vanish from their map at once - which told them, wherever they were, that somebody had just been there. Its
 * finder's browser keeps it (projects-seen.mjs `ghostOf`, in this browser's section of `SETTINGS.seenProjects`) until
 * one of their characters stands in that room again; this file draws what it keeps: the trace's picture, translucent,
 * at the place and size it stood, on the scene drawn, with no interaction. A GM's browser holds no ghost.
 *
 * THE HARNESS HAS NO CANVAS: the suite reads the rows the ghosts are drawn from (R5649, R5650); that a ghost is drawn
 * where the trace stood and goes when a character walks in is LIVE-PV-01 (audit/AUDIT-1.2.42.md 9.2).
 */

import { error } from "./utils.mjs";
import { ghostsOn } from "./projects-seen.mjs";

/** How opaque a ghost is drawn: a trace that is no longer there, as it was last seen. */
export const GHOST_ALPHA = 0.45;

/* The container this browser's ghosts are drawn in, on the scene drawn; null with no canvas. */
let layer = null;

function clear() {
    try { layer?.destroy?.({ children: true }); } catch { /* the canvas went first */ }
    layer = null;
}

/** Draw this browser's ghosts on the scene drawn, again from the section. Answers how many it drew. */
export function drawGhosts() {
    clear();
    const scene = globalThis.canvas?.scene;
    const tokens = globalThis.canvas?.tokens;
    if (!scene || !tokens || game.user?.isGM || !globalThis.PIXI?.Container) return 0;
    const ghosts = ghostsOn(scene.id);
    if (!ghosts.length) return 0;
    const grid = Number(scene.grid?.size ?? globalThis.canvas?.grid?.size) || 100;
    layer = new PIXI.Container();
    layer.name = "drpg-remnant-ghosts";
    layer.eventMode = "none";
    for (const ghost of ghosts) {
        if (!ghost.src) continue;
        const sprite = PIXI.Sprite.from(ghost.src);
        sprite.x = ghost.x;
        sprite.y = ghost.y;
        sprite.width = ghost.width * grid;
        sprite.height = ghost.height * grid;
        sprite.alpha = GHOST_ALPHA;
        layer.addChild(sprite);
    }
    tokens.addChild(layer);
    return layer.children.length;
}

/** Called once at init. */
export function registerRemnantGhosts() {
    const redraw = () => { try { drawGhosts(); } catch (err) { error("Could not draw the erased traces' ghosts", err); } };
    Hooks.on("canvasReady", redraw);
    Hooks.on("drpgSeenChanged", redraw);
    Hooks.on("canvasTearDown", clear);
}
