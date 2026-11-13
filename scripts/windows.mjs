/**
 * One place for a module window's size (E54, the plan's W1): the width that shows a table of a given width
 * (`windowWidthFor`, ui-kit.mjs `fitKitWidth`'s) and each tab pane measured in turn (`eachPane`). Moved out of
 * utils.mjs, which re-exports both; the settings half (`scaleWindow` and its box) is window-scale.mjs's (W3).
 * A leaf: it imports nothing.
 */


/**
 * The window width that shows a table of `widest` pixels without clipping: ui-kit.mjs `fitKitWidth`'s, for every `fit`
 * window (E21 C2a; utils.mjs's `tableDialog`, `fitWindowToTable` and `fitWindowToTabs` until then). In windows.mjs and not in
 * the kit because the kit imports utils.mjs, which re-exports it (R161 holds no cycle); R168 imports it from there.
 *
 * IT USED TO TAKE A `settled` FLAG - "this window has been fitted before, so
 * somebody may have put it somewhere" - and cap the answer at the room to the
 * right of the window's current left edge (D17, 29.08: a re-fit sent with no
 * `left` pulled a window at the right of the screen 104px further in). That
 * term is gone (W-9): ApplicationV2 re-clamps `left` to `clientWidth - width`
 * on every width change, so a window that grows is moved back onto the screen
 * for free, and all the term did was make a window opened near the right edge
 * permanently narrower than the same window opened in the middle. The `fitted`
 * set that remembered which windows had been sized went with it: nothing read
 * it once the flag was gone.
 */
export function windowWidthFor(root, content, widest) {
    const styles = getComputedStyle(content);
    // The content's padding only. Its border used to be added here as well, and
    // `frame` below already holds it - `clientWidth` stops inside the border - so
    // a bordered content box was sized two borders too wide (E31, 25.09.2026;
    // audit S01-64; R168). No rule of this module's stylesheets borders
    // `.window-content`, so the error was 0 px here; Foundry's own CSS is not
    // measured.
    const padding = (parseFloat(styles.paddingLeft) || 0)
        + (parseFloat(styles.paddingRight) || 0);

    // The window frame itself is wider than its content box. Measuring the
    // difference rather than guessing a constant: the frame carries its own
    // border and padding, and a hard-coded fudge factor is what makes a window
    // look right in one theme and clipped in another.
    const frame = Math.max(0, root.getBoundingClientRect().width - content.clientWidth);

    // Two pixels of slack so a table measured at exactly its container's width
    // does not round into a scrollbar it does not need.
    const wanted = Math.ceil(widest + padding + frame) + 2;
    const viewport = window.innerWidth || 1200;

    /*
     * TWO CEILINGS, AND THE SECOND ONE IS NEW (W-9, Dawid 18.09).
     *
     * 94 % of the viewport was the only one, so on a 5120x1440 screen the case
     * dashboard opened 4813px wide with its cells stretched across the whole of
     * it. The absolute cap is read from the stylesheet rather than written here
     * (`--drpg-window-max`, which a window may raise for itself: the project
     * manager's), because two copies of one number is how they part company.
     *
     * AND THE LEFT EDGE IS NOT PART OF THE ANSWER ANY MORE. `viewport - here`
     * measured the room to the right of where the window happened to be - but
     * ApplicationV2 re-clamps `left` to `clientWidth - width` on every width
     * change, so a window that is about to grow is about to be moved back onto
     * the screen anyway. All that term did was make a window opened near the
     * right edge permanently narrower than the same window opened in the middle.
     */
    /* READ OFF THE WINDOW, which inherits the body's cap unless it states its own (22.09):
       the project manager's matrix is a column per player, and at sixteen players the
       table alone is wider than 1400 - so that one window carries a higher cap, and the
       stylesheet's `max-width` reads the same token off the same element. */
    const cap = parseFloat(getComputedStyle(root ?? document.body)
        .getPropertyValue("--drpg-window-max")) || 1400;
    const ceiling = Math.min(Math.round(viewport * 0.94), Math.round(cap));
    return Math.min(wanted, ceiling);
}

/**
 * The kit's tab panes, each shown in turn (E44 C4a, 04.11.2026). `measure(pane)` runs with that pane shown and every
 * other hidden, by the same `hidden` the tabs switch (ui-kit.mjs `kitTabs`, `wireKitTabs`), and every pane is put
 * back as it was; answers what each call answered, by the pane's key. In windows.mjs and not in ui-kit.mjs, which hands it on and
 * measures with it (`fitKitWidth`, E21 C2a; utils.mjs's `fitWindowToTabs` until then), because windows.mjs, like utils.mjs, may not import
 * the kit (R161: the kit imports utils.mjs, which re-exports this file). Nothing is painted in between: a caller runs it inside one task, and the browser paints after it.
 *
 * @param {HTMLElement} root
 * @param {(pane: HTMLElement) => any} measure
 * @returns {Object<string, any>}
 */
export function eachPane(root, measure) {
    const panes = [...(root?.querySelectorAll?.("[data-drpg-pane]") ?? [])];
    const was = panes.map(p => p.hidden);
    const out = {};
    try {
        for (const shown of panes) {
            for (const p of panes) p.hidden = p !== shown;
            out[shown.dataset.drpgPane] = measure(shown);
        }
    } finally {
        panes.forEach((p, i) => { p.hidden = was[i]; });
    }
    return out;
}
