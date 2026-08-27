/**
 * Danganronpa RPG — the motion layer, on the JavaScript side.
 * ---------------------------------------------------------------------------
 * `styles/motion.css` holds the three times and the two curves. This file is
 * how everything that is not a stylesheet reaches them: the fog on the canvas,
 * a card arriving in the chat log, the time of day turning over in the HUD.
 *
 * READ, NEVER REPEATED. The numbers are not copied here. Every one of them is
 * fetched off `:root` at the moment it is used, which buys two things that a
 * pair of matching constants would not:
 *
 *   - There is one place to change a duration, and it is the stylesheet. Two
 *     files holding 420 and 450 for the same gesture is precisely the drift
 *     this layer exists to end.
 *   - `prefers-reduced-motion` works on the canvas. The media query in
 *     motion.css rewrites the tokens; a script reading them live gets zero and
 *     finishes in the frame it started. A constant compiled into a module would
 *     have kept moving for a reader who asked the system for stillness.
 *
 * THE RULE THAT OUTRANKS ALL OF IT. Motion never delays a reaction. A click
 * takes effect in the frame it lands; a window is clickable and focused while
 * it is still growing; a dialog returns its answer the instant the button is
 * pressed and the window leaving afterwards is a picture, not a step. Nothing
 * in this module waits on an animation to finish before it computes anything.
 */

import { MODULE_ID, GAME_WINDOWS } from "./config.mjs";
import { log, warn } from "./utils.mjs";
import { playSfx } from "./sfx.mjs";

/* ==========================================================================
 * READING THE TOKENS
 * ========================================================================== */

/**
 * A duration from the stylesheet, in milliseconds.
 *
 * Returns 0 when the token is missing, which is the safe direction: a moment
 * that does not play is a module that still works, and a stylesheet that has
 * not loaded is already being reported by `verifyStylesheet`.
 *
 * @param {string} token  A custom property name, e.g. "--drpg-t-enter".
 * @returns {number}
 */
export function motionMs(token) {
    try {
        const raw = getComputedStyle(document.documentElement)
            .getPropertyValue(token).trim();
        if (!raw) return 0;
        // CSS gives back "420ms" or "0.42s" depending on how it was written.
        const value = parseFloat(raw);
        if (!Number.isFinite(value)) return 0;
        return raw.endsWith("ms") ? value : value * 1000;
    } catch {
        return 0;
    }
}

/** A curve from the stylesheet, as a string `Element.animate()` accepts. */
export function motionEase(token) {
    try {
        return getComputedStyle(document.documentElement)
            .getPropertyValue(token).trim() || "ease";
    } catch {
        return "ease";
    }
}

/** The three times, by name, so call sites read as English. */
export const SNAP = () => motionMs("--drpg-t-snap");
export const ENTER = () => motionMs("--drpg-t-enter");
export const BEAT = () => motionMs("--drpg-t-beat");

/** The clock turning over — two beats, and slower on purpose. See motion.css. */
export const TURN = () => motionMs("--drpg-t-turn");

/** The two curves, by what they do rather than by what CSS calls them. */
export const ARRIVE = () => motionEase("--drpg-ease-arrive");
export const LEAVE = () => motionEase("--drpg-ease-leave");

/**
 * Has the reader asked for stillness?
 *
 * Mostly unnecessary — zeroed tokens already stop everything — but a few
 * moments are worth skipping outright rather than playing at zero length, and
 * one or two want a different shape entirely rather than none.
 */
export function reducedMotion() {
    try {
        return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
        return false;
    }
}

/**
 * Play a set of keyframes on an element, and never let it matter if it fails.
 *
 * Deliberately does NOT return the animation's promise, and deliberately has no
 * `fill`. Both are the same decision: nothing may wait for this, and nothing may
 * be left behind by it.
 *
 * THE `transform` TRAP, WHICH IS WHY THERE IS NO `fill: "forwards"`. A transform
 * on an element makes it the containing block for every `position: fixed`
 * descendant. Leave a window sitting on `scale(1)` — visually identical to no
 * transform at all — and Foundry's tooltips, colour pickers and context menus
 * inside it quietly start positioning themselves against the window instead of
 * against the screen. The Web Animations API sidesteps it completely: with no
 * fill, the element holds no transform once the animation is done. Not a
 * cleanup step that could be forgotten — there is nothing to clean up.
 *
 * `fill` is the one timing option a caller may set, and only ever as
 * `"backwards"`: an animation that waits its turn has to hold its opening frame
 * during the wait, or the thing it is about to move sits in plain view first.
 * `"forwards"` is not offered, for the reason above — there must be nothing
 * left on the element afterwards.
 *
 * @param {Element} element
 * @param {Keyframe[]} keyframes
 * @param {number} duration     Milliseconds; 0 means do nothing.
 * @param {string} easing
 * @param {object} [timing]
 * @param {number} [timing.delay]   Milliseconds to wait before starting.
 * @param {"none"|"backwards"} [timing.fill]
 * @returns {Animation|null}
 */
export function play(element, keyframes, duration, easing = ARRIVE(), timing = {}) {
    if (!element?.animate || !(duration > 0)) return null;
    try {
        return element.animate(keyframes, {
            duration,
            easing,
            delay: timing.delay ?? 0,
            fill: timing.fill === "backwards" ? "backwards" : "none"
        });
    } catch {
        return null;
    }
}

/* ==========================================================================
 * WHAT JUST WENT OUT
 * --------------------------------------------------------------------------
 * Every pool in this module is drawn as a row of pips rebuilt from scratch, so
 * "which ones were just spent" is not a question the DOM can answer — the old
 * pips are gone before the new ones exist. It has to be remembered, and it has
 * to be remembered PER SURFACE: the sheet's header and the tray in the corner
 * both draw the same actions, and one memory shared between them would mean
 * whichever redrew first got the flash and the other got nothing.
 * ========================================================================== */

/** `"scope\0key"` -> `{ held, spent, at }` for that surface's last draw. */
const pools = new Map();

/**
 * How long a spend stays answerable: exactly as long as the flare lasts.
 *
 * A burst of redraws from ONE change lands within a few frames of each other —
 * an actor update, the setting it wrote, the chat card it produced — and each
 * one throws away the element the last one was flashing. Inside this window the
 * same spend is reported again so the mark goes back on the new element.
 *
 * It can safely be the whole beat because `markSpent` RESUMES rather than
 * restarts: the replacement is handed the flare's age as a negative delay, so
 * three redraws in a row show one continuous flash rather than three stuttered
 * ones. Past the beat the animation is already over and there is nothing to
 * resume, which is why the window ends exactly there.
 *
 * Reduced motion sets the beat to 0, which closes the window as well — there is
 * no animation to protect.
 */
function redrawGrace() {
    return BEAT() || 420;
}

/**
 * How much of a pool has gone out since this surface last drew it.
 *
 * Reading it is also recording it: the caller is by definition about to draw
 * the new value, so that is what the next call compares against. A surface with
 * no memory of a subject — its first draw, a sheet just opened, a client that
 * joined mid-session — gets `null`, which is correct: nothing was spent, the
 * number was simply learned.
 *
 * @param {string} scope   Which surface is asking, e.g. "sheet:actions".
 * @param {string} key     Whose pool, usually an actor or user id.
 * @param {number} held    What it holds now.
 * @returns {{from: number, to: number}|null} The 1-based range of pips that
 *   went out, inclusive, or null if nothing did.
 */
export function spentSince(scope, key, held) {
    if (!Number.isFinite(held)) return null;
    const at = `${scope}\u0000${key}`;
    const last = pools.get(at);
    const now = Date.now();

    // Never seen before: learn it. A surface's first draw announces nothing.
    if (!last) {
        pools.set(at, { held, change: null, at: now });
        return null;
    }

    // Down is a spend; up is a GAIN (F5.5, 2026-08-25) — same window, same
    // replay rules, a different mark. `kind` is what `markSpent` reads to pick
    // the class, so none of the nine call sites changed for gains to exist.
    if (held !== last.held) {
        const change = held < last.held
            ? { kind: "spent", from: held + 1, to: last.held }
            : { kind: "gained", from: last.held + 1, to: held };
        pools.set(at, { held, change, at: now });
        return { ...change, age: 0 };
    }

    // Unchanged, and a change is still fresh: this is a second redraw of the
    // same change rather than a new one, so it gets the same answer. The window
    // is measured from the change itself, not from this call, so a stream of
    // redraws cannot hold it open.
    if (last.change && (now - last.at) < redrawGrace()) {
        return { ...last.change, age: now - last.at };
    }

    pools.set(at, { held, change: null, at: now });
    return null;
}

/**
 * Put the "just spent" mark on one element, if it is one of the ones that went.
 *
 * The range test lives here rather than at five call sites, and so does the
 * resume: an element built to replace one that was already flaring starts its
 * animation `age` milliseconds in. An inline delay beats the stylesheet's
 * shorthand, which sets it to zero.
 *
 * @param {HTMLElement} element
 * @param {{kind?: "spent"|"gained", from: number, to: number, age?: number}|null} change
 *   From `spentSince`. A gain wears `drpg-gained` instead of `drpg-spent` —
 *   the arrival flare added in F5.5; everything else is identical.
 * @param {number} [index]  Which pip this is, 1-based. Pools of one pass 1.
 */
export function markSpent(element, change, index = 1) {
    if (!element || !change) return element;
    if (index < change.from || index > change.to) return element;

    element.classList.add(change.kind === "gained" ? "drpg-gained" : "drpg-spent");
    if (change.age > 0) {
        const offset = `-${Math.round(change.age)}ms`;
        element.style.animationDelay = offset;
        // And the same offset somewhere it can be inherited. The element is not
        // always what carries the flare: on the tray a pip is painted by its
        // `::before` and the footprint by a child glyph, neither of which can
        // be reached from script. `animation-delay` does not inherit; a custom
        // property does. See THE TRAY NAILS ITS OWN COLOURS DOWN.
        element.style.setProperty("--drpg-spent-age", offset);
    }
    return element;
}

/* ==========================================================================
 * WINDOWS ARRIVING
 * ========================================================================== */

/**
 * Which windows this module is entitled to move — see `GAME_WINDOWS`.
 *
 * The selector itself moved to config.mjs in E4, when the sound layer needed
 * the same list. Two files importing it from each other is a cycle, and this
 * module has paid for one of those before; a shared fact belongs in the file
 * that imports nothing.
 */
const MOVED = GAME_WINDOWS;

function animateWindowIn(app, _element, _context, options) {
    const el = app?.element;
    if (!el?.matches?.(MOVED)) return;

    // ONLY THE FIRST RENDER, and asked rather than remembered.
    //
    // A window re-renders constantly — every Despair change, every clock tick,
    // every item added — and the entrance belongs to the window APPEARING, not
    // to its contents changing. This used to be a flag written onto the
    // element, which is a second copy of a fact Foundry already tracks and gets
    // wrong in one direction: a sheet closed and reopened may come back on the
    // same element, and a flag left on it would have swallowed the entrance
    // exactly where it matters most.
    if (!options?.isFirstRender) return;

    // BEFORE THE ANIMATION, NOT INSIDE IT. A table that has asked for reduced
    // motion still wants to hear the window open — the sound is the event, the
    // growth is only how it is drawn. `play()` below is the part that stands
    // down for that preference; this is not.
    playSfx("windowOpen");

    // A window that was closed and is being opened again on the same element
    // would otherwise still be wearing the mark from last time.
    el.classList.remove("drpg-closing");

    const scale = getComputedStyle(document.documentElement)
        .getPropertyValue("--drpg-scale-in").trim() || "0.96";

    play(el, [
        { transform: `scale(${scale})`, opacity: 0 },
        { transform: "scale(1)", opacity: 1 }
    ], ENTER(), ARRIVE());
}

/**
 * Mark a window that is CLOSING, as opposed to one that is minimising.
 *
 * Foundry uses one class, `.minimizing`, for both — it adds the class, sets a
 * max-height, and waits for a transition to end before tearing the window down.
 * A stylesheet cannot tell the two apart, and getting it wrong means a window
 * minimised to its title bar fades out and never comes back.
 *
 * The first version dodged that by only styling `.application.dialog`, where
 * DialogV2's `minimizable: false` makes the class unambiguous. That worked and
 * it excluded the character sheet, which is minimisable and is the window this
 * whole thing is for.
 *
 * So: ask instead of infer. `close()` is wrapped, the element is marked on its
 * way out, and the stylesheet keys off a class that means one thing.
 *
 * WHY THE MARK AND NOT THE ANIMATION. The transition itself still has to be
 * CSS, and it still has to be hung on `.minimizing` rather than started here.
 * `close()` awaits `_preClose` first — for however long a subclass takes — and
 * only then adds `.minimizing` and starts waiting for a `transitionend`. An
 * animation started here would already have finished during a slow `_preClose`,
 * Foundry would wait out its full one-second fallback, and the window would sit
 * there invisible. Marked here, transitioned there, the two are in the same
 * frame.
 */
function markClosingWindows() {
    const proto = foundry?.applications?.api?.ApplicationV2?.prototype;
    if (!proto?.close) {
        warn("ApplicationV2.close is not where it was; windows will close without the module's exit.");
        return;
    }

    const originalClose = proto.close;
    proto.close = function(options = {}) {
        try {
            const el = this.element;
            if (el?.matches?.(MOVED)) {
                el.classList.add("drpg-closing");
                // The same place the mark goes, for the same reason it goes
                // here: this is the one moment that means "closing" rather
                // than "minimising", and Foundry's own class cannot tell the
                // two apart. A re-render never reaches this line.
                playSfx("windowClose");
            }
        } catch {
            // A window that closes without the mark closes the way Foundry
            // closes it, which is a perfectly good way to close a window.
        }
        return originalClose.call(this, options);
    };
}

export function registerMotion() {
    // The entrance. Note what is NOT here: nothing is awaited, no class is
    // added, and the element is never made `inert` or `pointer-events: none`
    // for the duration. The window is live in the first frame and the growth
    // runs underneath a window that already works — which is the whole of the
    // old objection to window transitions, answered rather than argued with.
    Hooks.on("renderApplicationV2", animateWindowIn);
    markClosingWindows();

    log(`${MODULE_ID}: motion layer ready `
        + `(snap ${SNAP()}ms, enter ${ENTER()}ms, beat ${BEAT()}ms, turn ${TURN()}ms`
        + `${reducedMotion() ? ", reduced motion requested" : ""}).`);
}
