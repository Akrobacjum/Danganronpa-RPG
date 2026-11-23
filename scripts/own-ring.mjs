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
 * nothing when they look for a student. A mastermind is a player's character like
 * any other, and is framed like one - a missing frame would be the tell.
 *
 * AND A CHARACTER SOME USER HAS AS THEIRS, A GM'S INCLUDED (F118, 17.11.2026; the owner,
 * with a screenshot from the first GM's screen: "Nowy blad - na tokenie drugiego gma nie ma
 * ramki", and "Tak" to the rule below). A character a second GM or an Assistant plays is
 * owned by GMs alone, so `hasPlayerOwner` is false and it stood bare on every other screen,
 * like Monokuma. A character that is some user's assigned character (`User.character`) is
 * framed now: bone on that user's screen, the others' frame on every other. Monokuma stays
 * bare even when a GM has it assigned (`isMonokuma`), and so does any other character the GMs
 * alone own that nobody has as theirs. `User.character` is a field of the User documents
 * every browser holds, so this tells a player nothing their browser did not have
 * (world-secrets.mjs rules flags and a message's fields; no rule names it). `frameFor` is
 * the rule, `frameOf` asks it for a token, R7790 reads it.
 *
 * THE OTHERS IN THE COLOUR OF THE TIME OF DAY, like the curtain's own seams. The
 * hour is already the loudest thing on this interface - it colours the room borders,
 * the HUD and the glass - so the frame is the same accent rather than a sixth colour
 * nobody has met. Under Stained Glass it reads `--drpg-glass-accent` and is
 * therefore the same hairline colour as the border of the room the token is
 * standing in, Eclipse included. Under Monokuma Legacy the accent is not derived
 * from the hour at all, so danganronpa.css declared the five hours for this frame
 * itself - the glass's own five, written out - until E23 fix L2 (below) took them out.
 *
 * UNDER MONOKUMA LEGACY EVERY STUDENT'S FRAME IS BONE (E23 fix L, 09.11.2026; the owner
 * on 1.2.100: "postacie maja zly kolor ramki (ze stained glass zamiast drpg bone)"). Those
 * five hours are Stained Glass's palette, and on a Legacy map they drew the frames in it:
 * #bfe3ff, the pale blue-white of the owner's screenshot, all morning. Under Legacy a
 * student's frame and the viewer's own are the bone Legacy's palette names,
 * danganronpa.css's `:root` `--drpg-bone` (#e4ded8); under Stained Glass the others keep
 * the glass's accent and the viewer's own its bone (#f2eee6). `frameColour` says which.
 *
 * AND UNDER LEGACY THE OTHERS' BONE IS DIMMER, AND SO IS NOTHING ELSE (E23 fix L2, 09.11.2026:
 * fix L's Open 2 and 3, put to the owner and not answered, so the defaults stand). Fix L made
 * every Legacy frame the same bone, and with it the one thing W-6 is for - finding your own
 * token - was gone under that theme. The viewer's own stays `--drpg-bone`; every other
 * student's is `--drpg-bone-dim` (danganronpa.css `:root`, #989492), a solid colour rather than
 * the bone at a lower alpha, for the reason the fog's raster gives there: an alpha lets the
 * map tint it, so the same frame would read differently over every floor. Its value is the
 * glass's own dim bone (#f2eee6 at 0.62) taken over to Legacy's bone and Ink and made solid:
 * on Ink #1d1a21 the own frame reads 12.88:1, the others' 5.72:1, the two against each other
 * 2.25:1 and the others' against the fog's raster 2.46:1 (tests-css.mjs `contrastRatio`, the
 * contrast tool's arithmetic, 09.11). The map under a frame is the scene's, not read here.
 * Foundry's controlled border (`hourColour`, selection.mjs) is the viewer's bone under Legacy
 * too, not the glass's five hours, which no longer have a reader and are not declared.
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

import { debug, cssColour, forgetCssColours } from "./utils.mjs";
import { MODULE_ID, FLAGS, SPECTATOR_ALPHA } from "./config.mjs";
/* Monokuma is told apart by its flag (monokuma.mjs `isMonokuma`), as every other reader of it does: a GM may have it as
   their character, and it stays bare on every other screen all the same (F118). */
import { isMonokuma } from "./monokuma.mjs";
/* Stained Glass on: motion.mjs `glassOn`, the setting first, then the class (the class lands at ready, and tokens are
   drawn before that). own-ring.mjs held a copy of it, the same text, until E56 C9. */
import { glassOn } from "./motion.mjs";
/* The frame is the Remnant frame's, so its light is too: the three additive passes the
   curtain's seams and the evidence frames share (motion.mjs `SEAM_GLOW`), drawn by fog-reveal.mjs
   `ringHalo` for both rings since E88 C1. */
/* The curtain's hairline, in the scene units this draws in. The frame is a seam
   like the room border it stands inside, so it takes the same number from the
   same place rather than a second copy of the formula. */
import { seamWidth } from "./fog.mjs";
// E88 C0: the counters `fps()` and scenario 86 read (perf-counters.mjs); an increment each, nothing timed.
import { count } from "./perf-counters.mjs";
// A ring drawn again is timed where it is drawn (E53 C1; perf-timings.mjs): `perf()`'s line for the rings.
import { sample, now } from "./perf-timings.mjs";
/* E88 C1: the frame's light drawn once into a texture its frame shape shares, instead of a blur on every frame
   (fog-reveal.mjs "THE SEAMS' LIGHT DRAWN ONCE"). Imported from its family file, as fog.mjs re-exports only
   `seamWidth`; fog-reveal.mjs imports neither ring file back. */
import { wearHalo, releaseHalo, sweepHalos, restrikeHalos, ringHalo, HALO_BAKED, ringKept, positionOnly, haloBlurOn, RESTRIKE_LOG_ZOOM,
    THEME_SETTLE_MS } from "./fog-reveal.mjs";

const RING_NAME = "drpgOwnRing";
/* The seam's light, told apart from the seam: anything measuring "the frame" by
   taking the first child would measure the bloom instead, which is a stroke two
   to three times wider under a blur. Same split as the Remnant ring's. */
const RING_GLOW_NAME = "drpgOwnRingGlow";

/** The token the ring's colour falls back to when the hour has not been written yet. */
const FALLBACK = 0xffd38f;   // the afternoon gold, which is what the sheets default to
/** Bone, if the sheet has not declared it yet: Stained Glass's value, and Monokuma Legacy's two (danganronpa.css `:root`). */
const BONE_FALLBACK = 0xf2eee6;
const LEGACY_BONE_FALLBACK = 0xe4ded8;
const LEGACY_BONE_DIM_FALLBACK = 0x989492;

/** The zoom the rings were last struck at - see the `canvasPan` guard below. */
let ringZoom = 0;

export function registerOwnRing() {
    // The refresh's flags go to `paint` (E88 C2): a refresh may keep a drawing that still stands; a call without flags
    // (a repaint of the scene, an ownership change) always draws again.
    Hooks.on("refreshToken", (token, flags) => { count("refreshToken.ownRing"); paint(token, flags ?? {}); });
    Hooks.on("canvasReady", () => { ringZoom = 0; restrikeHalos(); sweepHalos(); repaintAll(); });

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
        if (ringZoom && Math.abs(Math.log(zoom / ringZoom)) < RESTRIKE_LOG_ZOOM) return;
        ringZoom = zoom;
        restrikeHalos();
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
        // The colours the stylesheet answers may have changed with it (utils.mjs `cssColour`'s memo, E88 C2).
        forgetCssColours();
        clearTimeout(hourTimer);
        hourTimer = setTimeout(() => {
            try { repaintAll(); } catch (err) { debug("Could not repaint the own-token rings", err); }
        }, THEME_SETTLE_MS);
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
        // and a Spectator's flag written or taken off, whose frame fades or comes back with its sprite (`dressFrame`)
        if (!("ownership" in changes) && !(FLAGS.spectator in (changes?.flags?.[MODULE_ID] ?? {}))
            && !(`-=${FLAGS.spectator}` in (changes?.flags?.[MODULE_ID] ?? {}))) return;
        for (const token of canvas?.tokens?.placeables ?? []) {
            if (token.actor?.id === actor.id) paint(token);
        }
    });
    /* ANY USER'S CHARACTER, AND ANY USER'S ROLE (F118). Whose character a token is decides its frame on every
       screen now, not only on its user's, so a change of any user's `character` repaints the scene everywhere; a
       change of role does too, as `hasPlayerOwner` turns on whether its owners are GMs. A user added or removed
       changes both answers. Rare writes all four, and a repaint is the scene's tokens once. */
    Hooks.on("updateUser", (user, changes) => {
        if ("character" in (changes ?? {}) || "role" in (changes ?? {})) repaintAll();
    });
    Hooks.on("createUser", () => repaintAll());
    Hooks.on("deleteUser", () => repaintAll());
}

/**
 * A SPECTATOR'S FRAME FADES WITH ITS TOKEN (1.2.127; the owner, 22.11.2026: "Spectatorzy. Ich ramka kwadratowa renderowana
 * przez modul niech tez ma zmniejszone opacity", OWNER-127-SPECTATOR-FRAME). On a GM's browser a Spectator's sprite stands
 * at config.mjs `SPECTATOR_ALPHA` (visibility.mjs `dressSpectator`), and its frame stood at full alpha under it. The frame
 * takes the same share where the sprite does - a GM's browser, an actor with the Spectator flag - and 1 elsewhere, so a
 * student made a Spectator fades and one let out comes back; its colour, its bone and Monokuma's bare token are as they
 * were. On every road of `paint` that shows a frame, and on the flag's write (`registerOwnRing`). How it reads on a real
 * map, with the light around it, is LIVE (no canvas headless). Answers the alpha set (R8694).
 */
export function dressFrame(token, user = game.user) {
    const alpha = user?.isGM && token?.actor?.getFlag?.(MODULE_ID, FLAGS.spectator) ? SPECTATOR_ALPHA : 1;
    const frame = token?.[RING_NAME];
    if (frame && frame.alpha !== alpha) frame.alpha = alpha;
    return alpha;
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
    return mineFor(token?.actor, game.user);
}

/** `isMine` for an actor and a viewer: their assigned character, or, off a GM's screen, anything they own. */
function mineFor(actor, viewer) {
    if (!actor) return false;
    const mine = viewer?.character;
    if (mine && actor.id === mine.id) return true;
    return !viewer?.isGM && actor.isOwner === true;
}

/**
 * Whose frame this token wears: "mine" (bone), "student" (the hour) or none.
 *
 * `hasPlayerOwner` is Foundry's own "some non-GM user owns this", and every client
 * holds the ownership table, so a player's screen answers it for the tokens of
 * people they are not.
 */
function frameOf(token) {
    return frameFor(token?.actor, game.user, game.users);
}

/**
 * The frame an actor's token wears on `viewer`'s screen, with `users` the world's users: "mine" (bone), "student"
 * (the others' frame) or null (F118). A character a player owns, or one that is some user's assigned character - a
 * GM's included - but never Monokuma by assignment alone. `actor.isOwner` is the viewer's own ownership, as Foundry
 * answers it on the viewer's browser, so a caller asking for another viewer hands an actor that answers for them
 * (R7790's stand-ins). Pure of the canvas: R7790 calls it with no token.
 */
export function frameFor(actor, viewer, users = []) {
    if (!actor || actor.type !== "character") return null;
    if (mineFor(actor, viewer)) return "mine";
    if (actor.hasPlayerOwner) return "student";
    if (isMonokuma(actor)) return null;
    // `some` is Foundry's Collection's and an array's alike; a spread of a Map would hand its entries instead.
    return (typeof users?.some === "function" ? users : []).some(u => u?.character?.id === actor.id) ? "student" : null;
}

/**
 * The hour's colour, read off the stylesheet so the palette has one home.
 *
 * `--drpg-glass-accent` under the glass, which is not only the hour: that theme
 * overrides it for the phase and for the Eclipse, so an investigation ring is the
 * same blue as the room borders around it. Measured on a live client, 20.09: the
 * accent came back as `rgb(87, 182, 255)` rather than as the hex the sheet
 * declares, which is why the reading goes through `cssColour` - see the note there.
 *
 * Under Monokuma Legacy it is not the hour: Legacy's bone, the viewer's own frame's colour
 * (E23 fix L2). It is what Foundry's controlled border and drag rectangle are handed
 * (selection.mjs). `read` is `cssColour`; R1467 hands it a reader of its own.
 */
export function hourColour(glass = glassOn(), read = cssColour) {
    return glass ? read("--drpg-glass-accent", FALLBACK) : read("--drpg-bone", LEGACY_BONE_FALLBACK);
}

/**
 * The colour a frame is drawn in: bone for the viewer's own in both themes; for the
 * others the glass's accent under Stained Glass and the dimmer bone under Monokuma
 * Legacy (E23 fix L and L2). `read` is `cssColour`; R1467 hands it a reader of its own
 * to see which property is asked under each theme, and with which fallback.
 */
export function frameColour(whose, glass = glassOn(), read = cssColour) {
    if (glass) return whose === "mine" ? read("--drpg-bone", BONE_FALLBACK) : read("--drpg-glass-accent", FALLBACK);
    return whose === "mine" ? read("--drpg-bone", LEGACY_BONE_FALLBACK) : read("--drpg-bone-dim", LEGACY_BONE_DIM_FALLBACK);
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
        group.addChild(halo, bakedLight(), new PIXI.Graphics());
        token[RING_NAME] = group;
    }
    const [halo, baked, core] = group.children;
    return { group, halo, baked, core };
}

/* The light drawn once (E88 C1): a sprite over the texture its frame shape shares, between the live halo it stands in
   for - kept, empty and hidden while the sprite shows, drawn as before where no texture can be made - and the core. */
function bakedLight() {
    const sprite = new PIXI.Sprite();
    sprite.name = HALO_BAKED;
    sprite.eventMode = "none";
    sprite.visible = false;
    return sprite;
}

/**
 * Draw, update or remove one token's frame.
 *
 * Rebuilt whole when asked without `flags` (a repaint of the scene, an ownership change). A refresh (`flags`, the
 * refresh's own) keeps the frame as drawn when what it was drawn for has not changed (E88 C2): a refresh that only
 * moves the token, or one whose frame key - whose, size, colour, theme, seam - is the one it was drawn with, while its
 * light still stands (fog-reveal.mjs `ringKept`). A token that changes size or owner mid-scene changes the key, so it
 * is never left wearing a frame drawn for what it used to be.
 */
function paint(token, flags) {
    let rebuiltAt = null;
    try {
        if (!token?.document) return;
        const existing = token[RING_NAME];
        const whose = frameOf(token);

        if (!whose) {
            count("ownRing.skipped");
            if (existing) {
                releaseHalo(existing.children?.find(c => c?.name === HALO_BAKED));
                existing.destroy({ children: true });
                token[RING_NAME] = null;
            }
            return;
        }

        /* A token the viewer cannot see must not be framed into existence. For somebody
           else's token that WOULD be a leak - a frame over the fog where a student stands -
           and for their own it is a drawing of something that is not there. */
        if (!token.visible) {
            count("ownRing.skipped");
            if (existing) existing.visible = false;
            return;
        }

        if (flags && positionOnly(flags) && ringKept(existing)) {
            count("ownRing.kept");
            existing.visible = true;
            dressFrame(token);
            return;
        }

        const w = Math.round(token.w ?? token.document.width * (canvas.grid?.size ?? 100));
        const h = Math.round(token.h ?? token.document.height * (canvas.grid?.size ?? 100));
        const glass = glassOn();
        const colour = frameColour(whose, glass);
        const key = [glass ? "glass" : "legacy", whose, `${w}x${h}`, colour, glass ? seamWidth().toFixed(5) : ""].join("|");
        if (flags && ringKept(existing, key)) {
            count("ownRing.kept");
            existing.visible = true;
            dressFrame(token);
            return;
        }

        const { group, halo, baked, core } = ringParts(token);
        count("ownRing.rebuilt");
        rebuiltAt = now();
        group.visible = true;
        dressFrame(token);
        group.drpgRingKey = key;
        group.drpgRingLight = glass ? null : "";
        core.clear();
        halo.clear();

        if (!glass) {
            /* MONOKUMA LEGACY: the Remnant frame to the pixel - four filled bars on
               integer coordinates, one cell of the token's 12-cell grid thick, no bloom.

               AT THE FOOTPRINT'S EDGE. The token's artwork has not been a child of the
               token object since v12 - the sprite lives in the primary group - so
               anything this file draws is ABOVE the picture whatever order it is added
               in. A frame on the edge of the square frames the token instead of
               crossing it; under the isometric view that edge is the floor under the
               student's feet. */
            halo.visible = false;
            releaseHalo(baked);
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
        core.lineStyle({ width: seam, color: colour, alpha: 1, cap: "square", join: "miter", miterLimit: 2 });
        core.drawRect(...rect);
        /* THE LIGHT, DRAWN ONCE (E88 C1): the same passes and blur rendered into the texture every frame of this
           shape and colour wears (fog-reveal.mjs `wearHalo`), instead of a blur paid on every frame of the canvas.
           The live halo below stays for a browser that cannot make the texture. */
        const shape = ringHalo(w, h, colour);
        if (wearHalo(baked, { seen: token.parent ?? token, key: `own|${w}x${h}|${colour}`, seamFactor: 1, shape })) {
            halo.visible = false;
            halo.filters = null;
            group.drpgRingLight = baked.drpgHaloKey;
            return;
        }
        halo.visible = true;
        shape.draw(halo, seam);
        const Blur = PIXI.BlurFilter ?? PIXI.filters?.BlurFilter;
        // With the glass's blur off the live light is the passes alone, as the baked one is (E88 fix G3, E88-END-02; Q2).
        // The list is kept aside, not dropped, and worn again when the blur comes back: the same filter, retuned below.
        if (!haloBlurOn()) {
            if (halo.filters?.length) halo.drpgLiveFilters = halo.filters;
            halo.filters = null;
        } else if (Blur) {
            if (!halo.filters?.length && halo.drpgLiveFilters) halo.filters = halo.drpgLiveFilters;
            // Kept and retuned, not rebuilt: `refreshToken` fires on every step a token takes.
            let filter = halo.filters?.[0];
            if (!(filter instanceof Blur)) { filter = new Blur(Math.max(6, seam * 6), 3); halo.filters = [filter]; }
            else filter.blur = Math.max(6, seam * 6);
            filter.padding = seam * 14;
        }
    } catch (err) {
        debug("Could not paint a student's frame", err);
    } finally {
        if (rebuiltAt !== null) sample("ownRing.rebuilt", now() - rebuiltAt);
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
        colour: `#${hourColour().toString(16).padStart(6, "0")}`,
        frame: `#${frameColour("student").toString(16).padStart(6, "0")}`, tokens: rows };
}
