/**
 * Danganronpa RPG - every student stands on a frame, and yours is bone.
 * ---------------------------------------------------------------------------
 * W-6 (Dawid, 18.09): "zeton gracza ginie w pokoju" - a player's token is lost
 * in a room. A bedroom holds a bed, a desk, two Remnants and four students, all
 * drawn at the same size out of the same tileset, and the one token you are
 * allowed to move looks exactly like the three you are not.
 *
 * EVERY STUDENT'S TOKEN, AND YOURS IN BONE (Dawid, 22.09, on 1.2.50: "dodajmy
 * takie samo obramowanie na tokenie kazdego gracza. Niech obramowanie tokenu, ktory
 * nalezy do gracza bedzie drpg-bone"). It was a circle round the viewer's own token
 * alone, and the reasoning was that round meant "yours" and square meant "evidence".
 * At the table the square read better: it is the token's own square on the floor,
 * which the isometric view draws as the same diamond as Foundry's selection border and
 * the project and Remnant frames. So every token a player owns stands on its square,
 * in the hour's colour, and the one the viewer plays stands on a bone one - the
 * interface's own white. The only other bone frame on a map is the Final Truth's
 * (remnant-ring.mjs), which frames a trace's icon rather than a student. Dawid chose
 * the floor diamond over the circle when asked, the same day.
 *
 * WHICH TOKENS. A character a player owns (`hasPlayerOwner`), on every screen,
 * the GM's included: a frame that only the owner could see would tell the GM
 * nothing when they look for a student. Monokuma and any other character the GM
 * alone owns stay bare. A mastermind is a player's character like any other, and
 * is framed like one - a missing frame would be the tell.
 *
 * THE OTHERS IN THE COLOUR OF THE TIME OF DAY, like the curtain's own seams. The
 * hour is already the loudest thing on this interface - it colours the room borders,
 * the HUD and the glass - so the frame is the same accent rather than a sixth colour
 * nobody has met. Under Stained Glass it reads `--drpg-glass-accent` and is
 * therefore the same hairline colour as the border of the room the token is
 * standing in, Eclipse included. Under Monokuma Legacy the accent is not derived
 * from the hour at all, so danganronpa.css declares the five hours for this frame
 * itself - see the W-6 block there.
 *
 * WHAT IT IS NOT. Not a target ring: Foundry already draws one of those when a
 * token is controlled, and it is gone the moment you click somewhere else - which
 * is precisely when you need to find your own token again. Not a name: a name is
 * a spoiler on a map where anonymity is a rule (see anonymity.mjs). Not a tint on
 * the artwork, for the reason the Remnant ring gives for the same decision - the
 * picture is already saying what the thing IS.
 *
 * WHICH ONE IS BONE. The viewer's own character, and on a non-GM client anything
 * they own. A Gamemaster owns every token in the world, so `isOwner` alone would
 * whiten the entire cast on their screen and mean nothing; a GM who has a
 * character of their own still gets that one.
 *
 * The mechanism is remnant-ring.mjs's, deliberately: the same hooks, the same
 * zoom guard, the same MutationObserver on the body's hour, and the same "rebuild
 * it rather than remember it" rule. Two files that draw on tokens should not have
 * two answers to when a token is redrawn.
 */

import { debug, cssColour } from "./utils.mjs";
import { SETTINGS, getSetting } from "./settings.mjs";
/* The frame is the Remnant frame's, so its light is too: the three additive passes the
   curtain's seams and the evidence frames share. */
import { SEAM_GLOW } from "./motion.mjs";
/* The curtain's hairline, in the scene units this draws in. The frame is a seam
   like the room border it stands inside, so it takes the same number from the
   same place rather than a second copy of the formula. */
import { seamWidth } from "./fog.mjs";

const RING_NAME = "drpgOwnRing";
/* The seam's light, told apart from the seam: anything measuring "the frame" by
   taking the first child would measure the bloom instead, which is a stroke two
   to three times wider under a blur. Same split as the Remnant ring's. */
const RING_GLOW_NAME = "drpgOwnRingGlow";

/** The token the ring's colour falls back to when the hour has not been written yet. */
const FALLBACK = 0xffd38f;   // the afternoon gold, which is what the sheets default to
/** Bone, if the sheet has not declared it yet: Stained Glass's value. */
const BONE_FALLBACK = 0xf2eee6;

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
       frame is a whole pixel cell of the token's own grid and holds still, so it is
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
       player's own token dropped on the scene by the GM, changes which frame its
       tokens wear without moving anything.

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
 * GM owns the whole cast, so every token would be bone and none would say anything.
 */
function isMine(token) {
    const actor = token?.actor;
    if (!actor) return false;
    const mine = game.user?.character;
    if (mine && actor.id === mine.id) return true;
    return !game.user?.isGM && actor.isOwner === true;
}

/**
 * Whose frame this token wears: "mine" (bone), "student" (the hour) or none.
 *
 * `hasPlayerOwner` is Foundry's own "some non-GM user owns this", and every client
 * holds the ownership table, so a player's screen answers it for the tokens of
 * people they are not.
 */
function frameOf(token) {
    const actor = token?.actor;
    if (!actor || actor.type !== "character") return null;
    if (isMine(token)) return "mine";
    return actor.hasPlayerOwner ? "student" : null;
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
export function hourColour() {
    return cssColour(glassOn() ? "--drpg-glass-accent" : "--drpg-own-ring", FALLBACK);
}

/**
 * The frame's two pieces, made once and kept.
 *
 * Both are cleared and redrawn on every refresh; what is NOT rebuilt is the
 * container, the blend mode and the filter, none of which a token taking a step
 * has any reason to allocate again.
 *
 * AT INDEX 0, so the frame sits under everything else this module puts on a token
 * and under Foundry's own bars and border. The artwork itself is not a child of
 * the token any more - since v12 the sprite lives in the primary group - so "under
 * the token" is a statement about the token's own overlay, and the frame is drawn
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
 * Draw, update or remove one token's frame.
 *
 * Everything is rebuilt each refresh rather than cached: a token that changes size
 * or owner mid-scene would otherwise keep a frame drawn for what it used to be.
 */
function paint(token) {
    try {
        if (!token?.document) return;
        const existing = token[RING_NAME];
        const whose = frameOf(token);

        if (!whose) {
            if (existing) {
                existing.destroy({ children: true });
                token[RING_NAME] = null;
            }
            return;
        }

        /* A token the viewer cannot see must not be framed into existence. For somebody
           else's token that WOULD be a leak - a frame over the fog where a student stands -
           and for their own it is a drawing of something that is not there. */
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
        const colour = whose === "mine" ? cssColour("--drpg-bone", BONE_FALLBACK) : hourColour();

        if (!glassOn()) {
            /* MONOKUMA LEGACY: the Remnant frame to the pixel - four filled bars on
               integer coordinates, one cell of the token's 12-cell grid thick, no bloom.

               AT THE FOOTPRINT'S EDGE. The token's artwork has not been a child of the
               token object since v12 - the sprite lives in the primary group - so
               anything this file draws is ABOVE the picture whatever order it is added
               in. A frame on the edge of the square frames the token instead of
               crossing it; under the isometric view that edge is the floor under the
               student's feet. */
            halo.visible = false;
            const t = Math.max(1, Math.round(Math.min(w, h) / 12));
            core.beginFill(colour, 0.95);
            core.drawRect(0, 0, w, t);
            core.drawRect(0, h - t, w, t);
            core.drawRect(0, t, t, h - 2 * t);
            core.drawRect(w - t, t, t, h - 2 * t);
            core.endFill();
            return;
        }

        /* STAINED GLASS: the Remnant frame's seam - the curtain's hairline for the core,
           three additive passes of the same rectangle for its light and a blur six times
           the core in screen pixels. Every pass traces the rectangle the core traces, inset
           by half the CORE width, so the light straddles the line. */
        const seam = seamWidth();
        const rect = [seam / 2, seam / 2, Math.max(1, w - seam), Math.max(1, h - seam)];
        halo.visible = true;
        core.lineStyle({ width: seam, color: colour, alpha: 1, cap: "square", join: "miter", miterLimit: 2 });
        core.drawRect(...rect);
        for (const [k, alpha] of SEAM_GLOW) {
            halo.lineStyle({ width: seam * k, color: colour, alpha, cap: "round", join: "round" });
            halo.drawRect(...rect);
        }
        const Blur = PIXI.BlurFilter ?? PIXI.filters?.BlurFilter;
        if (Blur) {
            // Kept and retuned, not rebuilt: `refreshToken` fires on every step a token takes.
            let filter = halo.filters?.[0];
            if (!(filter instanceof Blur)) { filter = new Blur(Math.max(6, seam * 6), 3); halo.filters = [filter]; }
            else filter.blur = Math.max(6, seam * 6);
            filter.padding = seam * 14;
        }
    } catch (err) {
        debug("Could not paint a student's frame", err);
    }
}

/**
 * What the frames think they are doing, for the console.
 *
 * The frame is drawn per client off a DOM colour and an ownership test, so "it is
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
            frame: frameOf(token),
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
