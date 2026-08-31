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
     * Suppressed wholesale, not filtered by what it says.
     *
     * Reading the caption to decide would be guessing at the system's own
     * wording in whatever language it was localised into, and the ask was for
     * all of them. Returns null, which is what the real method returns when it
     * declines to draw (no scene, nothing to anchor to), so a caller that
     * checks the result finds a shape it already handles.
     */
    function drpgNoScrollingText() {
        return null;
    }

    drpgNoScrollingText[PATCHED] = true;
    drpgNoScrollingText.original = original;
    proto.createScrollingText = drpgNoScrollingText;

    log(`${MODULE_ID}: scrolling captions no longer float off tokens.`);
}
