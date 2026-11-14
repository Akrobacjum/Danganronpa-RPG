/**
 * The flicker's repair (E54, the sheet's family): `renderPlan` and `installRenderPlan`, which repaint a sheet in
 * place for a resource write instead of rendering it, and `repaintInPlace` with the priced tiles, the Calls and the
 * Monocub tiles it refreshes, inside `settle`.
 */

import { ACTIONS, PRICE_CHAINS, STARTING } from "./config.mjs";
import { hopeHeld, hopeMax, affordableHopeCalls, despairCallsFor } from "./calls.mjs";
import { isCallSilenced } from "./call-effects.mjs";
import { error, debug } from "./utils.mjs";
import { overflowBlocksCalls } from "./overflow.mjs";
import { sheetMode } from "./sheet-mode.mjs";
import { markHopeChange } from "./sheet-header.mjs";
import { paintReserves } from "./sheet-sidebar.mjs";
import { actionButton, callLockNote, callButton, monokumaPool, monocubMoveNote, monocubTiles } from "./sheet-actions.mjs";

/* ==========================================================================
 * THE FLICKER
 * --------------------------------------------------------------------------
 * Every write to `system.resources.*` made the WHOLE SHEET redraw. Not an
 * animation problem - a full re-render, which also replays every injection this
 * file makes: the action panel, the tabs, `tidyBiography`, `paintReserves`.
 * One cause, two symptoms: the equipped tab blinking on a roll (a roll spends
 * Hope, and Hope is a resource) and the whole window blinking on a Health or
 * Sanity change.
 *
 * The repair is not to render for those updates and to repaint in place
 * instead - the bars' painter (`paintReserves` since E24 C1a) already exists
 * and already knows how to resume a half-finished animation.
 *
 * THE ORDER, MEASURED ON 14.365. One `actor.update()` runs
 *
 *     preUpdateActor  ->  render (the sheet)  ->  updateActor  ->  render (sidebar)
 *
 * so the sheet's render comes after the actor holds the new values and before
 * `updateActor`. From E4 to E45 that order was answered with state: a "skip the
 * next render" mark laid on the sheet in `preUpdateActor` (the only hook early
 * enough), eaten by an own `render`, and the repaint done in `updateActor`. A
 * no-op update - `orderNoop` was exactly `["preUpdateActor"]` - fired no render
 * to eat the mark, so the mark waited for the next legitimate render; a value
 * comparison before the write kept it out of that one.
 *
 * WHY THE MARK WENT (E45 C2, 08.11.2026; audit S03-07, a bug seen at the table:
 * lost renders, frozen pips). The mark was laid before overflow.mjs and
 * resource-guard.mjs cut the write in their own `preUpdateActor` (this file's
 * hook was registered first), so a write they emptied updated nothing and
 * rendered nothing, and the mark ate the next render of anything: an item found
 * by Search did not appear. And `preUpdateActor` fires only on the writer's
 * browser, so only the writer skipped; every other client blinked.
 *
 * WHAT DECIDES NOW: THE RENDER'S OWN ARGUMENTS. Foundry hands every client that
 * holds the sheet open the same render, with its options: `renderContext`
 * "updateActor" and `renderData`, the changes (v13/v14's notes, not v14's
 * source; E45's live check of the render's options confirms them at a table,
 * AUDIT 9.2). `renderPlan` reads them and the
 * sheet's own `render` (`installRenderPlan`, an own property from its first
 * render) repaints in place or renders. Nothing is laid before a write and read
 * after it, so a write cut in preUpdate leaves nothing behind, and every client
 * repaints, not only the writer.
 *
 * THE CONDITION IS STRICT ON PURPOSE. Anything else in the same package - a
 * flag, an item, an effect - and the render happens; so does any shape of the
 * arguments `renderPlan` does not know (no options, `force`, a first render, no
 * `renderData`, another context). A skipped render that was needed is a sheet
 * showing something untrue, which is worse than a blink - and when Daggerheart's
 * or Foundry's render signature changes, the way out is a blink.
 *
 * "RESOURCES" IS NARROWER THAN IT SOUNDS, AND THAT MATTERS.
 *
 * `system.resources` holds five things here: hitPoints, stress, hope, actions
 * and armor. Only the first three are drawn by something that can be repainted
 * without a render - the two bars in the sidebar and the Hope diamonds in the
 * header. Actions are drawn by this file's own action panel and again by the
 * player's status strip; armor by the system's template. Skipping a render for
 * one of those would leave a number on screen that is no longer true, which is
 * the failure this whole apparatus exists to avoid, so they are left alone and
 * still render exactly as they did.
 *
 * A SKIPPED RENDER LEAVES THE OLD NUMBERS IN THE DOM. Obvious in hindsight and
 * not obvious while writing it: the painter before E24 (`paintResourceBars`)
 * read the `<progress>` and the number input, both of which the render would
 * have rewritten. Repainting from them repainted the OLD value - measured, the
 * bar sat at 0 while the actor held 1. So the inputs were fed from the actor
 * first, and only then painted. Since E24 C1a the painter (`paintReserves`)
 * reads the actor itself and the system's controls are hidden, so nothing is
 * fed: a render and a repaint draw through the one function.
 * ========================================================================== */

const RESOURCE_PREFIX = "system.resources.";

/**
 * The resources this file can redraw in place - see the note above.
 *
 * Adding one here is a promise that `repaintInPlace` below draws it: Health and
 * Sanity through the painter a render calls (`paintReserves`, both layouts, E24
 * C1a), Hope through its diamonds and the Calls and tiles it prices. Each by the
 * fields it is drawn from: a reserve's value and maximum (the painter reads
 * both), Hope's value alone - the repaint toggles the diamonds already drawn,
 * so a new maximum renders (E24 fix G2B; general n1, R1477).
 */
const REPAINTABLE = new Map([["hitPoints", ["value", "max"]], ["stress", ["value", "max"]], ["hope", ["value"]]]);

/**
 * Is every key in this update a resource this file can repaint itself?
 *
 * `_id` and `_stats` are not part of the answer. MEASURED: the package handed
 * to `preUpdateActor` is exactly what the caller wrote, but by `updateActor`
 * the server has added `_stats.modifiedTime` - so a predicate that only
 * forgives `_id` says "no" on the changes Foundry hands on after the write,
 * which are `renderData`'s, and the repaint never runs. That failure is silent
 * and looks exactly like the flicker fix working, except the numbers stop
 * moving.
 */
function onlyResourceKeys(changes) {
    const keys = Object.keys(foundry.utils.flattenObject(changes ?? {}))
        .filter(key => key !== "_id" && !key.startsWith("_stats."));
    if (!keys.length) return false;

    return keys.every(key => {
        if (!key.startsWith(RESOURCE_PREFIX)) return false;
        const [name, field, ...rest] = key.slice(RESOURCE_PREFIX.length).split(".");
        return !rest.length && Boolean(REPAINTABLE.get(name)?.includes(field));
    });
}

const isOptions = value => typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * "repaint" or "render", from a render's own arguments (E45 C2; pure, for the suite). `args` is what the sheet's
 * `render` was called with; `rendered` whether the sheet is on screen now (a first render renders).
 *
 * Two shapes are known: `render(options)`, ApplicationV2's, and `render(false, options)`, the one Foundry's document
 * hands its apps after a write (v13's `ClientDocument#render(force, context)`, as remembered; ApplicationV2 reads a
 * boolean first argument as `force`, so `false` asks for nothing more than the options say). Anything else renders:
 * `render(true, ...)`, `render()`, `force`, `parts`, a context other than "updateActor", no `renderData`, a key in it
 * that is not a repaintable resource.
 */
export function renderPlan(args, { rendered = true } = {}) {
    const list = Array.isArray(args) ? args : [];
    let options = null;
    if (list.length === 1 && isOptions(list[0])) options = list[0];
    else if (list.length === 2 && list[0] === false && isOptions(list[1])) options = list[1];
    if (!options || !rendered) return "render";
    if (options.force || options.parts !== undefined || options.renderContext !== "updateActor") return "render";
    if (!isOptions(options.renderData)) return "render";
    return onlyResourceKeys(options.renderData) ? "repaint" : "render";
}

/** The mark the sheet's own `render` carries, read by the contract (patches.mjs `sheet-render-guard`). */
const RENDER_PLAN = Symbol.for("drpgRenderPlan");

/**
 * Give a character sheet its own `render` that asks `renderPlan` first (E45 C2): on "repaint" it repaints in place
 * - `repaintInPlace`, inside `settle` - and resolves with the app, as a render does; otherwise, and whenever the
 * repaint throws, it calls the render it shadows. Installed from the sheet's first render (`SHEET_STEPS`
 * "installRenderPlan"), once.
 *
 * On the INSTANCE rather than on `ApplicationV2.prototype`: this concerns
 * character sheets and nothing else, and a global wrap would put every window
 * in the application through a check that can only ever be true for one kind.
 * An own property shadows the prototype's method for this object alone.
 */
export function installRenderPlan(app) {
    if (!app || Object.hasOwn(app, "render")) return;

    const original = Object.getPrototypeOf(app)?.render;
    if (typeof original !== "function") return;

    const render = function (...args) {
        const root = this.element instanceof HTMLElement ? this.element : this.element?.[0];
        if (this.document?.type === "character" && root
            && renderPlan(args, { rendered: Boolean(this.rendered) }) === "repaint") {
            try {
                settle(root, () => repaintInPlace(this.document, root, this));
                return Promise.resolve(this);
            } catch (err) {
                // A sheet that renders is the safe failure.
                error("Could not repaint a resource in place; the sheet renders", err);
            }
        }
        return original.apply(this, args);
    };
    render[RENDER_PLAN] = true;
    Object.defineProperty(app, "render", { configurable: true, writable: true, value: render });
}

/**
 * The Hope slots of a sheet's header redrawn for `hope` held, as Daggerheart draws them: a held slot
 * `<i class="fa-solid fa-diamond">`, an empty one `<i class="fa-regular fa-circle">`. Both pairs, not the weight alone
 * (13.11.2026; the owner's table on 1.2.112, held Hope drawn spent): until then only fa-solid and fa-regular were
 * toggled, so a slot that became held without a render carried `fa-solid fa-circle`, a glyph Daggerheart never draws,
 * and stained-glass.css's spent rule, which read `.fa-circle`, drew it at 0.34. The sheets read the state from
 * `fa-solid` alone since; the glyph matches the system's so that nothing else that reads it is misled. R5720.
 */
export function paintHopeGlyphs(element, hope) {
    for (const slot of element.querySelectorAll(".hope-section .hope-value")) {
        const n = Number(slot.dataset.value);
        const glyph = slot.querySelector("i");
        if (!glyph || !Number.isFinite(n)) continue;
        const held = n <= hope;
        glyph.classList.toggle("fa-solid", held);
        glyph.classList.toggle("fa-diamond", held);
        glyph.classList.toggle("fa-regular", !held);
        glyph.classList.toggle("fa-circle", !held);
    }
}

/**
 * Everything a render would have redrawn for a resource-only update, drawn here instead (the wrapper's
 * "repaint", `installRenderPlan`).
 *
 * Two surfaces, because that is how many the three repaintable resources have:
 * Health and Sanity in the sidebar, drawn by the same painter a render calls
 * (`paintReserves`, which reads the actor - E24 C1a; until then this fed the
 * system's own controls from the actor and the bar read them back), and the Hope
 * diamonds in the header, which the module paints from `:has(> i.fa-solid)`, so
 * the class on the inner glyph IS the state and toggling it is the whole repaint.
 */
function repaintInPlace(actor, element, app = null) {
    paintReserves(app, element, actor);

    paintHopeGlyphs(element, Number(foundry.utils.getProperty(actor, "system.resources.hope.value") ?? 0));

    // AND THE CALLS, WHICH ARE WHAT THE NUMBER DECIDES (Dawid, 28.08).
    //
    // The comment on REPAINTABLE says adding a resource here is a promise that
    // this function draws it. `hope` was in the set and this function drew the
    // bar and the pips and stopped - so topping a player up moved the number
    // and left every newly affordable Call greyed out. The render that would
    // have fixed it is the one deliberately skipped to stop the sidebar
    // flickering, which means nothing was ever going to fix it.
    //
    // Same shape as the GM panel's murder tile: half a surface live, half of it
    // a photograph, and no way to tell them apart from the outside.
    refreshCallsPanels(actor, element);

    // AND THE PRICED TILES, FOR THE SAME REASON (T-1). Since the chains exist,
    // a Hope-only or Sanity-only change moves what the Objection, Analyze and
    // Tamper tiles cost - so a repaint that redrew the drawers and left the grid
    // alone would show a price that stopped being true one pip ago.
    refreshPricedTiles(actor, element);

    // AND A MONOCUB'S TILES (E45 C2; audit S03-07): Confusion costs Hope, and its tile's affordability is drawn when
    // the grid is built - so a Hope-only change left it as the render before had drawn it.
    refreshMonocubTiles(actor, element);

    // AFTER the glyphs, because the mark is counted off them. A repaint stands
    // in for a render and owes what the render owed - including saying that
    // something moved. See `markHopeChange`. And no more than the render owed:
    // the dead's and an NPC's header is still, counted and never marked, as
    // `flashHope` keeps it - since E45 C2 every client holding the sheet
    // repaints (E24 fix G2B; general m3, R1479).
    const mode = sheetMode(actor);
    markHopeChange(actor, element, !mode.header.acts || mode.redact);
}

/**
 * Rebuild the tiles whose price depends on a resource that just moved.
 *
 * Safe to replace the node because the grid is wired by ONE delegated listener
 * on the sheet root rather than by per-button handlers - see
 * `attachActionDelegate`.
 *
 * EXCEPT A TILE THAT IS IN FLIGHT. That same listener sets `disabled` for the
 * duration of an action, and a roll's Hope write lands while it is still true -
 * so a blind replacement would re-enable the tile mid-action and a second click
 * would fire the same action again.
 */
function refreshPricedTiles(actor, element) {
    for (const node of element.querySelectorAll("[data-drpg-action]")) {
        const key = node.dataset.drpgAction;
        if (!PRICE_CHAINS[key] || node.disabled) continue;
        const def = key === "dynamic" ? null : ACTIONS[key];
        if (!def) continue;
        try {
            node.replaceWith(actionButton(actor, key, def));
        } catch (err) {
            debug("Could not repaint a priced action tile", err);
        }
    }
}

/**
 * Redraw the Hope and Despair drawers from what the character now holds.
 *
 * Built from the same two functions the injection uses - `affordableHopeCalls`
 * / `despairCallsFor` and `callButton` - so there is one answer to "is this
 * Call available" and one tile that says so, rather than a second copy here
 * that drifts.
 */
function refreshCallsPanels(actor, element) {
    for (const panel of element.querySelectorAll(".drpg-calls-panel")) {
        const monokuma = panel.classList.contains("drpg-despair-panel");
        const held = monokuma ? monokumaPool(actor) : hopeHeld(actor);
        const max = monokuma ? STARTING.despairMax : hopeMax(actor);
        const lockNote = callLockNote(monokuma);

        panel.classList.toggle("drpg-silenced", isCallSilenced(actor) || (!monokuma && overflowBlocksCalls()));

        const pool = panel.querySelector(".drpg-calls-pool");
        if (pool) pool.textContent = `${held} / ${max}`;

        const grid = panel.querySelector(".drpg-action-grid");
        if (!grid) continue;
        grid.replaceChildren(
            ...(monokuma ? despairCallsFor(held) : affordableHopeCalls(actor))
                .map(call => callButton(call, monokuma, lockNote)));
    }
}

/**
 * A Monocub's grid rebuilt from what it now holds (E45 C2): the tiles `injectMonocubPanel` draws, from the same
 * `monocubTiles`. Until E103 a tile in flight was kept as it was: the Move, the one tile the delegate disables while its
 * action runs (`[data-drpg-action]`, as `refreshPricedTiles` reads it). The ability tiles carry no action key and open
 * their own window (`cubAbilityDialog`), so with the Move gone there is nothing in flight to keep.
 */
function refreshMonocubTiles(actor, element) {
    for (const grid of element.querySelectorAll(".drpg-monocub-panel .drpg-action-grid")) grid.replaceChildren(...monocubTiles(actor));
    // Move's line follows the Free Move (the r112 review's P2).
    for (const note of element.querySelectorAll(".drpg-monocub-panel .drpg-monocub-move")) note.replaceWith(monocubMoveNote(actor));
}

/**
 * Run the module's injections with the system's transitions held still.
 *
 * See the SETTLING block in danganronpa.css for the measurement behind this.
 * Short version: Daggerheart puts `transition: all 0.3s` on the sidebar's
 * resource inputs, and everything this file does to a freshly rendered sheet
 * changes their layout - so every redraw animated the whole left column for
 * 300ms. The work is the same; it just stops being a journey.
 *
 * The class comes off on the next frame rather than immediately, and the
 * layout is read back before that to force the style recalculation while it is
 * still on. Without that read the browser can coalesce both changes into one
 * pass and animate after all, which is the version of this fix that looks like
 * it works and does not.
 */
export function settle(root, work) {
    if (!root?.classList) return work();

    root.classList.add("drpg-settling");
    try {
        work();
    } finally {
        // Read, to commit the new styles while transitions are still off.
        void root.offsetWidth;
        requestAnimationFrame(() => root.classList.remove("drpg-settling"));
    }
}
