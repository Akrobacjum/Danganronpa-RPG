/**
 * Danganronpa RPG - nothing floats off a token.
 * ---------------------------------------------------------------------------
 * Daggerheart throws a scrolling caption off a token for every resource that
 * moves: "Hope +1", "Sanity -2", Health, actions, the lot. In this game those
 * numbers are nobody else's business - Health and Sanity are GM-only, rolls are
 * private, and a caption that drifts up off a portrait announces to the whole
 * table something the sheet deliberately keeps quiet. Dawid asked for them
 * gone outright (26.08): "nie chcę, by te napisy się w ogóle pojawiały".
 *
 * ONE FUNNEL, PATCHED ONCE. Every scrolling caption in the client - the
 * system's and core's alike - goes through
 * `InterfaceCanvasGroup#createScrollingText`; measured on this build, the
 * system reaches it from its own `createScrollText` helper, once per placed
 * token of the actor. So the funnel is where this belongs: a hook per resource
 * would be a race against the system's own writes, and there is no hook for
 * "about to draw a caption" anyway.
 *
 * The prototype rather than `canvas.interface`, because that object is rebuilt
 * every time the canvas is torn down and redrawn - a patch on the instance
 * would last until the first scene change and then quietly stop working, which
 * is the worst way for a suppression to fail.
 *
 * NOT libWrapper. It is not a dependency of this module (see requirements.mjs)
 * and this is one method, wrapped once, keeping the original on the function so
 * a later `game.drpg` call could put it back. The guard makes a second
 * registration a no-op rather than a second layer of wrapping.
 *
 * A REGION'S CAPTION PASSES (E51 C8, 31.10.2026; audit S01-27; decision D44e = 1; E51-47). A GM who gives a region
 * the "Display Scrolling Text" behaviour asked for that caption by name, and it went the way of the system's: nothing
 * drew, Foundry's own "Scrolling Status Text" switch read on, and nowhere said why. A call made from that behaviour
 * goes to the original now; every other caller - the system's resource captions first - is still answered without a
 * caption. The behaviour is told by its class's name on the call's stack (`fromRegionBehavior`), read from memory of
 * v12-v13's region-behaviors/display-scrolling-text.mjs, whose `_handleRegionEvent` calls the funnel before any
 * await; v14's road is not read here (no Foundry source on this machine) and is LIVE-E51-05, which also asks that a
 * damage caption over a token still does not show. Since E51's fix round only over a token this browser shows
 * (`shownHere`, review security S2).
 */

import { MODULE_ID } from "./config.mjs";
import { log, error } from "./utils.mjs";

/** Marks our wrapper so re-registering cannot stack another one on top. */
const PATCHED = Symbol.for("drpgNoScrollingText");

export function registerNoScrollingText() {
    const group = foundry.canvas?.groups?.InterfaceCanvasGroup
        ?? globalThis.InterfaceCanvasGroup;
    const proto = group?.prototype;

    if (!proto?.createScrollingText) {
        // A Foundry that renames or moves it. Worth a line in the log rather
        // than a silent no-op: the captions would simply carry on appearing,
        // and "the feature did nothing" needs a reason attached.
        error("Could not find the scrolling-text funnel - token captions stay on");
        return;
    }
    if (proto.createScrollingText[PATCHED]) return;

    const original = proto.createScrollingText;

    /**
     * Suppressed by who asks, never filtered by what it says.
     *
     * Reading the caption to decide would be guessing at the system's own
     * wording in whatever language it was localised into, and the ask was for
     * all of them. A region's "Display Scrolling Text" is handed to the original
     * (E51-47, above), through `.original` so the suite can stand a recorder in.
     *
     * THE ORIGINAL IS ASYNC (E51 C8; audit S01-27). This said the real method
     * returns null when it declines to draw; it is an `async` method, so what it
     * returns is a Promise - of null when it declines, as recalled of v13 - and
     * this answered a bare null, which a caller's `.then` would have thrown on.
     * It answers a settled Promise of null now, the shape of a declined draw.
     */
    function drpgNoScrollingText(...args) {
        if (fromRegionBehavior() && shownHere(args[0])) return drpgNoScrollingText.original.apply(this, args);
        return Promise.resolve(null);
    }

    drpgNoScrollingText[PATCHED] = true;
    drpgNoScrollingText.original = original;
    proto.createScrollingText = drpgNoScrollingText;

    log(`${MODULE_ID}: scrolling captions no longer float off tokens; a region's own caption still shows.`);
}

/**
 * Whether a token this browser shows stands at `origin`, the point the caption is drawn at (E51 fix round FG6,
 * 31.10.2026; review security S2). The room fog hides another room's tokens, and in an Eclipse every player's, by the
 * token's `visible` on this browser (visibility.mjs `tokenShownTo`); a region's caption passed whatever stood under it,
 * so a region set to show its text to "Anyone" told a player that somebody crossed a spot their screen keeps dark. A
 * caption is passed only over a shown token: its box where it is drawn, or where its document stands (a token
 * mid-slide). Recalled of v12-v13, not read in v14: the behaviour draws at the moving token's centre; a caption drawn
 * anywhere else is held back here. LIVE-E51-05 asks it at a table. Tier 1's R1131.
 */
function shownHere(origin) {
    const x = Number(origin?.x), y = Number(origin?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    const inside = (left, top, w, h) => [left, top, w, h].every(Number.isFinite) && x >= left && x <= left + w && y >= top && y <= top + h;
    return (globalThis.canvas?.tokens?.placeables ?? []).some(token => token?.visible
        && (inside(Number(token.x), Number(token.y), Number(token.w), Number(token.h))
            || inside(Number(token.document?.x), Number(token.document?.y), Number(token.w), Number(token.h))));
}

/** The class whose call passes: Foundry's "Display Scrolling Text" region behaviour (E51-47). */
const REGION_CALLER = /\bDisplayScrollingTextRegionBehaviorType\b/;

/**
 * Whether this call comes from a region's "Display Scrolling Text": its class's name on the stack. The frame names a
 * class's method by the class in Chromium (Foundry's own app and the browsers most tables use); a browser that writes
 * the method alone does not, and there the region's caption stays suppressed - LIVE-E51-05.
 */
export function fromRegionBehavior(stack = new Error().stack) {
    return REGION_CALLER.test(String(stack ?? ""));
}
