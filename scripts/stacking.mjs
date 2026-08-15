/**
 * Danganronpa RPG — keeping the module's own dialogs on top.
 * ---------------------------------------------------------------------------
 * Every prompt this module raises is something the game is WAITING ON: a roll
 * that has not been thrown, an Observe declaration, a GM ruling, a ballot. None
 * of them are windows you leave open and come back to.
 *
 * Foundry does not know that. `ApplicationV2` hands out z-indexes on a running
 * counter and raises whatever was clicked last, so the ordinary sequence —
 *
 *     press Observe          sheet 101, dialog 102
 *     glance at your Hope    sheet 103, dialog 102
 *
 * — buries the dialog under the sheet it was launched from. Measured on this
 * build: the two overlap, so the prompt does not merely go behind, it looks
 * like it vanished. The action is still pending, nothing on screen says so, and
 * the player's only route back is to drag the sheet out of the way.
 *
 * The fix is deliberately not `modal: true`. Checking your own Hope, Stress or
 * inventory while deciding is exactly what these prompts are for, and a modal
 * would forbid it. Instead the dialog is re-raised whenever something else is
 * brought forward: the sheet still comes to the front of everything else, the
 * prompt still sits above the sheet, and both stay usable.
 */

import { MODULE_ID } from "./config.mjs";
import { log } from "./utils.mjs";

/**
 * Windows that must not be buried.
 *
 * `drpg-panel` is the class every dialog this module opens already carries, so
 * this needs no cooperation from the call sites — a prompt added next year is
 * covered by having been built like the others.
 */
const KEEP_ON_TOP = ".application.drpg-panel";

/**
 * Raise every open module dialog above whatever was just clicked.
 *
 * Ordered among themselves by their existing z-index, so a prompt raised on top
 * of another prompt keeps that relationship instead of being shuffled.
 */
function raiseOwnDialogs() {
    const dialogs = [...document.querySelectorAll(KEEP_ON_TOP)];
    if (!dialogs.length) return;

    dialogs
        .sort((a, b) => (parseInt(getComputedStyle(a).zIndex) || 0)
            - (parseInt(getComputedStyle(b).zIndex) || 0))
        .forEach(el => {
            // `bringToFront` is the supported route — it advances Foundry's own
            // counter, so the next window Foundry raises still lands above the
            // rest of the interface rather than fighting a hardcoded number.
            const app = foundry.applications.instances.get(el.id);
            app?.bringToFront?.();
        });
}

export function registerStacking() {
    // Capture phase, so this is queued before Foundry's own pointerdown handler
    // raises the clicked window; the microtask then runs after it has.
    document.addEventListener("pointerdown", event => {
        const clicked = event.target.closest?.(".application");
        // Clicking a module dialog is already handled by Foundry raising it.
        if (!clicked || clicked.matches(KEEP_ON_TOP)) return;
        queueMicrotask(raiseOwnDialogs);
    }, { capture: true });

    // A window can also be raised without a click — `render(true)` on an
    // already-open sheet does it, which is how the item manager and the Truth
    // Bullet cards surface.
    Hooks.on("renderApplicationV2", app => {
        if (app?.element?.matches?.(KEEP_ON_TOP)) return;
        queueMicrotask(raiseOwnDialogs);
    });

    log(`${MODULE_ID}: module prompts will stay above other windows.`);
}
