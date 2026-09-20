/**
 * Danganronpa RPG - your own token wears the hour.
 * ---------------------------------------------------------------------------
 * W-6 (Dawid, 18.09): "zeton gracza ginie w pokoju" - a player's token is lost
 * in a room. A bedroom holds a bed, a desk, two Remnants and four students, all
 * drawn at the same size out of the same tileset, and the one token you are
 * allowed to move looks exactly like the three you are not.
 *
 * A CIRCLE, AND THAT IS THE WHOLE REASON IT IS A CIRCLE. The Remnant markers are
 * SQUARE pixel frames (see remnant-ring.mjs, Dawid 26.08), so a ring duplicates
 * nothing on this map: round means "this one is yours", square means "this one is
 * evidence", and the two can sit in the same room without a legend.
 *
 * IN THE COLOUR OF THE TIME OF DAY, like the curtain's own seams. The hour is
 * already the loudest thing on this interface - it colours the room borders, the
 * HUD and the glass - so the ring is the same accent rather than a sixth colour
 * nobody has met. Under Stained Glass it reads `--drpg-glass-accent` and is
 * therefore the same hairline colour as the border of the room the token is
 * standing in, Eclipse included. Under Monokuma Legacy the accent is not derived
 * from the hour at all, so danganronpa.css declares the five hours for this ring
 * itself - see the W-6 block there.
 *
 * WHAT IT IS NOT. Not a target ring: Foundry already draws one of those when a
 * token is controlled, and it is gone the moment you click somewhere else - which
 * is precisely when you need to find your own token again. Not a name: a name is
 * a spoiler on a map where anonymity is a rule (see anonymity.mjs). Not a tint on
 * the artwork, for the reason the Remnant ring gives for the same decision - the
 * picture is already saying what the thing IS.
 *
 * WHOSE TOKEN. The viewer's own character, and on a non-GM client anything they
 * own. A Gamemaster owns every token in the world, so `isOwner` alone would ring
 * the entire cast on their screen and mean nothing; a GM who has a character of
 * their own still gets that one.
 *
 * The mechanism is remnant-ring.mjs's, deliberately: the same hooks, the same
 * zoom guard, the same MutationObserver on the body's hour, and the same "rebuild
 * it rather than remember it" rule. Two files that draw on tokens should not have
 * two answers to when a token is redrawn.
 */

import { debug, cssColour } from "./utils.mjs";
import { SETTINGS, getSetting } from "./settings.mjs";
/* The curtain's hairline, in the scene units this draws in. The ring is a seam
   like the room border it stands inside, so it takes the same number from the
   same place rather than a second copy of the formula. */
import { seamWidth } from "./fog.mjs";

const RING_NAME = "drpgOwnRing";
/* The seam's light, told apart from the seam: anything measuring "the ring" by
   taking the first child would measure the bloom instead, which is a stroke two
   to three times wider under a blur. Same split as the Remnant ring's. */
const RING_GLOW_NAME = "drpgOwnRingGlow";

/** The token the ring's colour falls back to when the hour has not been written yet. */
const FALLBACK = 0xffd38f;   // the afternoon gold, which is what the sheets default to

/** The zoom the rings were last struck at - see the `canvasPan` guard below. */
let ringZoom = 0;

/** True when this browser wears Stained Glass. The SETTING first, then the class:
    the class lands at ready and tokens are drawn before that. */
function glassOn() {
    try {
        return getSetting(SETTINGS.theme) === "stainedGlass"
            || document.body.classList.contains("drpg-theme-stained-glass");
    } catch {
        return document.body.classList.contains("drpg-theme-stained-glass");
    }
}

export function registerOwnRing() {
    Hooks.on("refreshToken", token => paint(token));
    Hooks.on("canvasReady", () => { ringZoom = 0; repaintAll(); });

    /* A SEAM HOLDS ONE WEIGHT WHILE THE MAP IS ZOOMED, and nothing else here would
       redraw it: `refreshToken` fires when a token moves, never when the view does.
       The hairline is drawn in scene units, so without this it would fatten as you
       zoom in and vanish as you zoom out. A fifth of a zoom step, never on a plain
       pan - the same guard `rezoomRoomOutline` and the Remnant rings use. Legacy's
       ring is a whole pixel cell of the token's own grid and holds still, so it is
       not re-struck at all. */
    Hooks.on("canvasPan", () => {
        if (!glassOn()) return;
        const zoom = canvas?.stage?.scale?.x;
        if (!Number.isFinite(zoom) || zoom <= 0.05) return;
        if (ringZoom && Math.abs(Math.log(zoom / ringZoom)) < 0.18) return;
        ringZoom = zoom;
        repaintAll();
    });

    /* THE HOUR IS A DOM FACT, SO IT IS WATCHED IN THE DOM. `data-drpg-time` is
       written by the HUD's own render, and `drpgTimeOfDayChanged` is fired in the
       same fire-and-forget batch as that render - so a listener on the hook can be
       handed the hour on its way out. fog.mjs's accent observer records that race
       in full. The attribute changing IS the colour changing, and the `class` entry
       is what catches the Eclipse and a change of theme. */
    let hourTimer = 0;
    new MutationObserver(() => {
        clearTimeout(hourTimer);
        hourTimer = setTimeout(() => {
            try { repaintAll(); } catch (err) { debug("Could not repaint the own-token rings", err); }
        }, 60);
    }).observe(document.body, {
        attributes: true,
        attributeFilter: ["class", "data-drpg-phase", "data-drpg-time"]
    });

    /* Ownership is not a refresh. A character handed to a player mid-session, or a
       player's own token dropped on the scene by the GM, changes who this ring belongs
       to without moving anything.

       ONLY ON AN OWNERSHIP CHANGE, and only that actor's tokens. `updateActor` is a
       noisy hook - a Daggerheart roll writes the actor several times - and repainting
       every token on the scene for a Hope going up and down is exactly the kind of
       thing the perf pass of this stage is removing elsewhere. */
    Hooks.on("updateActor", (actor, changes) => {
        if (!("ownership" in changes)) return;
        for (const token of canvas?.tokens?.placeables ?? []) {
            if (token.actor?.id === actor.id) paint(token);
        }
    });
    Hooks.on("updateUser", (user, changes) => {
        if (user.id === game.user.id && "character" in changes) repaintAll();
    });
}

/** Every token on the scene, repainted. */
function repaintAll() {
    for (const token of canvas?.tokens?.placeables ?? []) paint(token);
}

/**
 * Is this token the viewer's own?
 *
 * The assigned character first, because that is the one a player is playing even
 * on a client that owns several. Then ownership, and only off the GM's screen: a
 * GM owns the whole cast, so the ring would be on every token and say nothing.
 */
function isMine(token) {
    const actor = token?.actor;
    if (!actor) return false;
    const mine = game.user?.character;
    if (mine && actor.id === mine.id) return true;
    return !game.user?.isGM && actor.isOwner === true;
}

/**
 * The hour's colour, read off the stylesheet so the palette has one home.
 *
 * `--drpg-glass-accent` under the glass, which is not only the hour: that theme
 * overrides it for the phase and for the Eclipse, so an investigation ring is the
 * same blue as the room borders around it. Measured on a live client, 20.09: the
 * accent came back as `rgb(87, 182, 255)` rather than as the hex the sheet
 * declares, which is why the reading goes through `cssColour` - see the note there.
 */
function hourColour() {
    return cssColour(glassOn() ? "--drpg-glass-accent" : "--drpg-own-ring", FALLBACK);
}

/**
 * The ring's two pieces, made once and kept.
 *
 * Both are cleared and redrawn on every refresh; what is NOT rebuilt is the
 * container, the blend mode and the filter, none of which a token taking a step
 * has any reason to allocate again.
 *
 * AT INDEX 0, so the ring sits under everything else this module puts on a token
 * and under Foundry's own bars and border. The artwork itself is not a child of
 * the token any more - since v12 the sprite lives in the primary group - so "under
 * the token" is a statement about the token's own overlay, and the ring is drawn
 * at the edge of the square rather than across it for exactly that reason.
 */
function ringParts(token) {
    let group = token[RING_NAME];
    if (!group || group.destroyed) {
        group = token.addChildAt(new PIXI.Container(), 0);
        group.name = RING_NAME;
        const halo = new PIXI.Graphics();
        halo.name = RING_GLOW_NAME;
        halo.blendMode = PIXI.BLEND_MODES?.ADD ?? 1;
        group.addChild(halo, new PIXI.Graphics());
        token[RING_NAME] = group;
    }
    return { group, halo: group.children[0], core: group.children[1] };
}

/**
 * Draw, update or remove one token's ring.
 *
 * Everything is rebuilt each refresh rather than cached: a token that changes size
 * or owner mid-scene would otherwise keep a ring drawn for what it used to be.
 */
function paint(token) {
    try {
        if (!token?.document) return;
        const existing = token[RING_NAME];

        if (!isMine(token)) {
            if (existing) {
                existing.destroy({ children: true });
                token[RING_NAME] = null;
            }
            return;
        }

        /* A token the viewer cannot see must not be ringed into existence. It is
           their own token, so this is not a leak - but a ring floating over the fog
           where a hidden token stands is a drawing of something that is not there. */
        if (!token.visible) {
            if (existing) existing.visible = false;
            return;
        }

        const { group, halo, core } = ringParts(token);
        group.visible = true;
        core.clear();
        halo.clear();

        const w = Math.round(token.w ?? token.document.width * (canvas.grid?.size ?? 100));
        const h = Math.round(token.h ?? token.document.height * (canvas.grid?.size ?? 100));
        const colour = hourColour();
        const cx = w / 2;
        const cy = h / 2;

        if (!glassOn()) {
            /* MONOKUMA LEGACY: a hard ring on integer coordinates, no bloom - the same
               pixel language the Remnant frame speaks, and the reason that frame is not
               antialiased either.

               HALF A CELL, NOT A WHOLE ONE, and that was worth looking at: the Remnant
               frame is a full cell of the token's 12-cell grid because it is a FRAME
               around the edge of a square, where the only thing inside it is a glyph.
               A circle at the same weight lies across the face - seen on Player A at
               8x on 20.09, the ring covered the outer third of the portrait. Half a
               cell reads as a ring and leaves the artwork alone. */
            halo.visible = false;
            const cell = Math.max(1, Math.round(Math.min(w, h) / 24));
            /* AT THE FOOTPRINT'S EDGE. The token's artwork has not been a child of the
               token object since v12 - the sprite lives in the primary group - so
               anything this file draws is ABOVE the picture whatever order it is added
               in. A ring that hugs the edge of the square frames the token instead of
               crossing it, which is the same answer without a second display object in
               another group to keep in step with the token's every move. */
            const r = Math.round(Math.min(w, h) / 2) - Math.ceil(cell / 2);
            if (r <= 0) return;
            core.lineStyle({ width: cell, color: colour, alpha: 0.95, alignment: 0.5 });
            core.drawCircle(Math.round(cx), Math.round(cy), r);
            return;
        }

        /* STAINED GLASS: the curtain's hairline, and a bloom under an additive blend -
           the seam and its light, which is what every other edge in this theme is. The
           radius sits half a hairline inside the square so the stroke cannot spill over
           the token's own footprint at any zoom. */
        const line = seamWidth();
        const r = Math.min(w, h) / 2 - line / 2;
        if (r <= 0) return;

        halo.visible = true;
        halo.lineStyle({ width: line * 3, color: colour, alpha: 0.28, alignment: 0.5 });
        halo.drawCircle(cx, cy, r);
        core.lineStyle({ width: line, color: colour, alpha: 0.9, alignment: 0.5 });
        core.drawCircle(cx, cy, r);
    } catch (err) {
        debug("Could not paint an own-token ring", err);
    }
}

/**
 * What the rings think they are doing, for the console.
 *
 * The ring is drawn per client off a DOM colour and an ownership test, so "it is
 * not there" has three different causes and none of them log anything. This is the
 * one question that separates them.
 */
export function diagnoseOwnRings() {
    const rows = [];
    for (const token of canvas?.tokens?.placeables ?? []) {
        rows.push({
            token: token.document?.name ?? "?",
            actor: token.actor?.name ?? null,
            mine: isMine(token),
            visible: Boolean(token.visible),
            ring: Boolean(token[RING_NAME] && !token[RING_NAME].destroyed),
            showing: Boolean(token[RING_NAME]?.visible)
        });
    }
    console.table(rows);
    return { theme: glassOn() ? "stainedGlass" : "monokumaLegacy",
        hour: document.body.dataset.drpgTime ?? null,
        colour: `#${hourColour().toString(16).padStart(6, "0")}`, tokens: rows };
}
