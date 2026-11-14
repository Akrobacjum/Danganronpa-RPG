/**
 * Danganronpa RPG - keeping the prompts the game waits on above the sheet.
 * ---------------------------------------------------------------------------
 * A prompt this module raises is something the game is WAITING ON: a roll that
 * has not been thrown, an action's declaration, a GM's ruling, a ballot. None of
 * them is a window you leave open and come back to.
 *
 * Foundry does not know that. `ApplicationV2` hands out z-indexes on a running
 * counter and raises whatever was clicked last, so the ordinary sequence -
 *
 *     press Observe          sheet 101, dialog 102
 *     glance at your Hope    sheet 103, dialog 102
 *
 * - buries the dialog under the sheet it was launched from. The two overlap, so
 * the prompt does not merely go behind, it looks like it vanished. The action is
 * still pending, nothing on screen says so, and the player's only route back is
 * to drag the sheet out of the way.
 *
 * The fix is deliberately not `modal: true`. Checking your own Hope, Sanity or
 * inventory while deciding is exactly what these prompts are for, and a modal
 * would forbid it. Instead the prompt is raised again after the sheet is: the
 * sheet still comes to the front of everything else, the prompt still sits above
 * the sheet, and both stay usable.
 *
 * WHAT C5a CHANGED (E23 C5a, 07.11.2026; audit S01-15, the owner's Q-E23-5). Until C5a this file
 * kept `.application.drpg-panel` on top - the class the kit puts on EVERY module window (ui-kit.mjs
 * `KIT_CLASSES`) - so a GM working in Token Config saw the GM panel, a handbook and Projects jump
 * over it whenever a sheet redrew (a Hope change redraws it), and a player could not bring a sheet
 * over a handbook. And it raised in a microtask queued from a capture listener on the document: a
 * person's click runs the microtask between that listener and the window's own capture listener,
 * which is where Foundry raises the sheet, so the prompt was raised first and buried second (the
 * audit's reading of Foundry's application.mjs; the harness cannot press as a person does, so this
 * half is LIVE-E23-04). Now:
 *
 *   - one class is kept on top, `drpg-prompt` (ui-kit.mjs PROMPT_CLASS), which a window asks for
 *     (`drpgWindow({ prompt: true })`; the roll window gets it in roll-dialog.mjs's render hook).
 *     The windows that ask: a roll, every action's declaration (action-menus.mjs `chooseVariant`
 *     and `promptForNote`), Observe's GM windows, a GM's ruling of a statistic, a ballot, Level Up
 *     and the trial's prompts - never a panel, a handbook, Projects, the Case or the notice history
 *     (the owner, 07.11.2026). R1404 holds the list;
 *   - the raise is a frame later (`requestAnimationFrame`), after anything Foundry does in the same
 *     task, the click's listeners and a render's raise alike;
 *   - only the prompts the raised sheet overlaps are raised: a prompt beside the sheet stays where
 *     it is in the order;
 *   - a render raises only when Foundry raised the sheet - its first render or a forced one
 *     (`render(true)`: the item manager and the Truth Bullet cards surface a sheet so). An ordinary
 *     redraw, a Hope change's, raises nothing, so it moves no window.
 */

import { MODULE_ID } from "./config.mjs";
import { log, error } from "./utils.mjs";
import { PROMPT_CLASS } from "./ui-kit.mjs";

/** The windows kept above the sheet: the prompts the game waits on. */
export const KEEP_ON_TOP = `.application.${PROMPT_CLASS}`;

/**
 * The one window a prompt has to stay above.
 *
 * Token Config, Scene Config, a file picker and every other window in Foundry
 * were never part of the story: the character SHEET buries the prompt it
 * launched, because Foundry raises the sheet when you glance at your own Hope
 * while deciding. Raising a prompt over every window was measured at the table
 * as a GM's clicks landing on the wrong window.
 */
const OVERTAKEN = ".application.sheet.actor";

/**
 * A window's box on the screen: its laid-out rectangle, else the position Foundry keeps for it (a window
 * not laid out yet, or a page with no layout); null when neither has an area.
 */
function boxOf(el) {
    const r = el?.getBoundingClientRect?.();
    if (r && r.width > 0 && r.height > 0) return { left: r.left, top: r.top, right: r.left + r.width, bottom: r.top + r.height };
    const p = foundry.applications?.instances?.get?.(el?.id)?.position;
    if (![p?.left, p?.top, p?.width, p?.height].every(Number.isFinite) || p.width <= 0 || p.height <= 0) return null;
    return { left: p.left, top: p.top, right: p.left + p.width, bottom: p.top + p.height };
}

/**
 * Do the two windows overlap? A window whose box cannot be read counts as overlapping: a prompt that
 * cannot be shown clear of the sheet is kept above it, as every prompt was before C5a.
 */
export function overlaps(a, b) {
    const A = boxOf(a), B = boxOf(b);
    if (!A || !B) return true;
    return A.left < B.right && B.left < A.right && A.top < B.bottom && B.top < A.bottom;
}

/**
 * The open prompts the sheet overlaps, lowest first by their z-index, so a prompt raised over another
 * prompt keeps that order instead of being shuffled. `root` is where they are looked for (the page).
 */
export function promptsOver(sheet, root = document) {
    // Foundry writes a window's z-index on its element (`bringToFront`); the computed one for any other.
    const z = el => parseInt(el.style.zIndex || getComputedStyle(el).zIndex, 10) || 0;
    return [...root.querySelectorAll(KEEP_ON_TOP)]
        .filter(el => el !== sheet && !el.matches(OVERTAKEN) && overlaps(el, sheet))
        .sort((a, b) => z(a) - z(b));
}

/**
 * Raise every prompt the sheet overlaps. `bringToFront` is the supported route: it advances Foundry's
 * own counter, so the next window Foundry raises still lands above the rest rather than fighting a
 * number of the module's. Answers how many were raised.
 */
function raisePromptsOver(sheet) {
    if (!sheet?.isConnected) return 0;
    const raised = promptsOver(sheet);
    for (const el of raised) foundry.applications.instances.get(el.id)?.bringToFront?.();
    return raised.length;
}

/**
 * Does this render raise the prompts over it? A sheet's, not a prompt's, and one Foundry raised: the
 * first render or a forced one (Foundry's RenderOptions, the render hook's fourth argument).
 */
export function raisesOnRender(app, options) {
    const el = app?.element;
    if (!el?.matches?.(OVERTAKEN) || el.matches(KEEP_ON_TOP)) return false;
    return Boolean(options?.isFirstRender || options?.force);
}

/** One raise a frame per sheet, after whatever Foundry does in this task. */
const waiting = new Set();
function afterFoundry(sheet) {
    if (waiting.has(sheet)) return;
    waiting.add(sheet);
    requestAnimationFrame(() => {
        waiting.delete(sheet);
        try { raisePromptsOver(sheet); } catch (err) { error("The prompts could not be raised over a sheet", err); }
    });
}

export function registerStacking() {
    // A press on a sheet: Foundry raises it in the frame's own capture listener; the prompts follow a frame later.
    document.addEventListener("pointerdown", event => {
        const sheet = event.target?.closest?.(OVERTAKEN);
        if (!sheet || sheet.matches(KEEP_ON_TOP)) return;
        afterFoundry(sheet);
    }, { capture: true });

    // A sheet raised without a press: its first render, or `render(true)` on one already open.
    Hooks.on("renderApplicationV2", (app, element, context, options) => {
        if (raisesOnRender(app, options)) afterFoundry(app.element);
    });

    log(`${MODULE_ID}: the prompts the game waits on will stay above the sheet.`);
}
