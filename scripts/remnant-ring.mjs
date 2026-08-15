/**
 * Danganronpa RPG — a Remnant wears its type as a ring.
 * ---------------------------------------------------------------------------
 * A scene late in a chapter carries a dozen Remnants, and until now they were
 * a dozen identical markers: the GM had to click each one to find out whether
 * it was a preparation trace, an autopsy note or the thing that solves the
 * case. The type was already recorded on the token and shown on every badge in
 * the Casebook — it just never made it onto the map, which is the one place
 * everybody is looking during an investigation.
 *
 * The ring is drawn rather than tinted, because a tint would fight the artwork
 * a Remnant already uses to say what it depicts.
 *
 * Colours are read from the stylesheet at runtime instead of being written
 * here. The palette is declared once in `danganronpa.css` and this reads the
 * same tokens the Casebook badges do, so the map and the list cannot drift
 * apart — and re-hueing the palette moves the rings with it, without touching
 * this file.
 */

import { MODULE_ID } from "./config.mjs";
import { REMNANT_FLAGS } from "./remnants.mjs";
import { debug } from "./utils.mjs";

const RING_NAME = "drpgRemnantRing";

/**
 * Which token each type borrows. Same assignments the `.drpg-tb-badge.type.*`
 * rules use, so a Remnant reads identically on the map and in the Casebook.
 */
const TYPE_TOKEN = {
    key: "--drpg-gold",
    prep: "--drpg-eye",
    incident: "--drpg-crimson",
    resolution: "--drpg-tb-resolution",
    autopsy: "--drpg-tb-autopsy",
    faint: "--drpg-tb-faint",
    neutral: "--drpg-tb-neutral",
    final: "--drpg-bone"
};

const FALLBACK = 0x8a8296;   // --drpg-dim, for a type nobody has named yet

export function registerRemnantRings() {
    Hooks.on("refreshToken", token => paint(token));
    Hooks.on("canvasReady", () => repaintAll());
    Hooks.on("updateToken", (doc, changes) => {
        // A type change has to redraw immediately; a move does not, because the
        // refresh that follows it already will.
        if (changes.flags?.[MODULE_ID]) doc.object && paint(doc.object);
    });
}

/** Resolve a CSS custom property to the integer PIXI wants. */
function colourOf(type) {
    const name = TYPE_TOKEN[type];
    if (!name) return FALLBACK;
    try {
        const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
        if (!raw) return FALLBACK;
        // `Color.from` handles "#rrggbb" and "rgb(r, g, b)" alike, which matters
        // because the palette holds both.
        return foundry.utils.Color.from(raw).valueOf();
    } catch {
        return FALLBACK;
    }
}

function repaintAll() {
    for (const token of canvas?.tokens?.placeables ?? []) paint(token);
}

/**
 * Draw, update or remove one token's ring.
 *
 * Everything is rebuilt each refresh rather than cached: a token that changes
 * size, type or Remnant-ness mid-scene would otherwise keep a ring drawn for
 * what it used to be, and the cost of a circle is not worth the bookkeeping.
 */
function paint(token) {
    try {
        if (!token?.document) return;

        const existing = token[RING_NAME];
        const isRemnant = token.document.getFlag(MODULE_ID, REMNANT_FLAGS.isRemnant);

        if (!isRemnant) {
            if (existing) {
                existing.destroy();
                token[RING_NAME] = null;
            }
            return;
        }

        // A Remnant the viewer cannot see must not be outlined into existence —
        // the ring would give away a hidden trace to the whole table.
        if (!token.visible) {
            if (existing) existing.visible = false;
            return;
        }

        const type = token.document.getFlag(MODULE_ID, REMNANT_FLAGS.type);
        const reinforced = Boolean(token.document.getFlag(MODULE_ID, REMNANT_FLAGS.reinforced));

        const ring = existing ?? token.addChild(new PIXI.Graphics());
        token[RING_NAME] = ring;
        ring.visible = true;
        ring.clear();

        const w = token.w ?? token.document.width * (canvas.grid?.size ?? 100);
        const h = token.h ?? token.document.height * (canvas.grid?.size ?? 100);
        const radius = Math.min(w, h) / 2;

        // A reinforced trace cannot be cleaned up, so it gets the heavier ring —
        // the one distinction a GM acts on without opening anything.
        ring.lineStyle(reinforced ? 4 : 2, colourOf(type), 0.95);
        ring.drawCircle(w / 2, h / 2, Math.max(4, radius - 2));
    } catch (err) {
        debug("Could not paint a Remnant ring", err);
    }
}
