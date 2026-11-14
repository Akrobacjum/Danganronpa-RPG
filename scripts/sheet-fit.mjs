/**
 * How the sheet fits its window (E54, the sheet's family): the Loadout tab left, a tab's scroll kept, the system's
 * create buttons removed (`removeSystemCreators`), the action tiles' fit (`fitActionTiles`, `fitTileText`, `watchTileFit`,
 * `longestTileWord`, `softWrap`) and the sheet's height held and grown for the Calls (`holdActionsTab`, `growForCalls`).
 */

import { ACTIONS, MONOCUB, HOPE_CALLS, DESPAIR_CALLS, SHEET_SIZE } from "./config.mjs";
import { actionsTabHeight, callsHeight } from "./settings.mjs";
import { modeOf } from "./sheet-mode.mjs";

/*
 * THE LOADOUT TAB IS NEVER THE ONE SHOWN (E24 C3b, 08.11.2026; E24-22, audit S03-47, S12-45). Its link is hidden in
 * the stylesheet (danganronpa.css "Loadout") because this game has no domain cards, but the part still rendered, and a
 * sheet that came up on it - a tab Daggerheart remembered, a macro's `changeTab` - showed a pane of controls with no
 * way back to it. At render, an active `loadout` tab is changed to the Actions tab (`features`, the one this module
 * draws into) through the app's own `changeTab`, which keeps `tabGroups` and the nav in step; a stand-in without one
 * gets the classes moved by hand. The part stays in the DOM, empty, for whatever reads it by its selector.
 */
export function leaveLoadoutTab(app, element) {
    const root = element instanceof HTMLElement ? element : element?.[0];
    if (!root) return;
    const part = root.querySelector('section[data-application-part="loadout"], section.tab[data-tab="loadout"]');
    if (!part) return;
    const group = part.dataset.group || "primary";
    if (part.classList.contains("active") || app?.tabGroups?.[group] === "loadout") {
        if (typeof app?.changeTab === "function") {
            app.changeTab("features", group, { force: true, updatePosition: false });
        } else {
            for (const el of root.querySelectorAll(`[data-group="${group}"][data-tab]`)) {
                el.classList.toggle("active", el.dataset.tab === "features");
            }
            if (app?.tabGroups) app.tabGroups[group] = "features";
        }
    }
    part.replaceChildren();
}

/*
 * A TAB KEEPS ITS SCROLL (E24 C3b, 08.11.2026; E24-22, audit S03-14). Under the glass `section.tab` is the pane that
 * scrolls (stained-glass.css "THE SHEET'S TABS SCROLL"), and every render draws a new one at the top: a player halfway
 * down the Inventory was put back at its first row by any write to their sheet. Daggerheart keeps the scroll of its
 * own inner lists only (`.items-section`, `.features-sections`). Each tab's `scrollTop` is kept here per app id and tab
 * name, by one scroll listener on the window's root (which outlives its parts' renders; scroll does not bubble, so it
 * is caught on the way down), and the active tab's is put back as the render's last step. Under Monokuma Legacy the
 * same `section.tab` does not scroll: it keeps 0, and putting 0 back changes nothing.
 */
const tabScrolls = new Map();

export function keepTabScroll(app, element) {
    const root = element instanceof HTMLElement ? element : element?.[0];
    const id = app?.id;
    if (!root || !id) return;
    if (!root.dataset.drpgTabScroll) {
        root.dataset.drpgTabScroll = "1";
        root.addEventListener("scroll", event => {
            const tab = event.target;
            if (!tab?.matches?.("section.tab[data-tab]")) return;
            tabScrolls.set(`${id}|${tab.dataset.tab}`, tab.scrollTop);
        }, { capture: true, passive: true });
    }
    const active = root.querySelector("section.tab.active[data-tab]");
    const kept = active ? tabScrolls.get(`${id}|${active.dataset.tab}`) : undefined;
    if (Number.isFinite(kept) && kept > 0 && active.scrollTop !== kept) active.scrollTop = kept;
}

/**
 * TAKE THE "+" OUT OF THE DOM, not out of the paint.
 * ---------------------------------------------------------------------------
 * The buttons that create a Feature or an Item by hand have been hidden in the
 * stylesheet for several versions, matched three different ways because the
 * system keeps moving them: `.add-feature`, then `[data-action="createItem"]`,
 * then `legend a[data-action="addNewItem"]`. Each time the markup moved, the
 * button came back - silently, because a rule that matches nothing looks
 * exactly like a rule that is working.
 *
 * Reported back on screen on 2026-08-23, so the approach changes rather than
 * the selector list: whatever this finds is REMOVED. A node that is not there
 * cannot be un-hidden by a system update, a cascade layer or a theme, and the
 * failure mode of removing too little is the same as today rather than worse.
 *
 * WHAT COUNTS AS A CREATOR: an element whose `data-action` is one of the
 * system's create verbs, or one that carries `data-type="feature"`. Matched on
 * a substring so a rename to `addNewItemV2` does not restart this cycle.
 *
 * FEATURES for everybody, INVENTORY for players only - the same split the
 * stylesheet already makes. Features in this game come from the module's own
 * grid, so a hand-made one is noise even for the GM; a GM handing out an item
 * by hand is an ordinary ruling.
 */
const CREATE_ACTIONS = ["addnewitem", "createitem", "createdoc", "additem", "newitem"];

export function removeSystemCreators(app, element, mode = modeOf(app)) {
    const root = element instanceof HTMLElement ? element : element?.[0];
    if (!root) return;

    const sections = [
        ...root.querySelectorAll('section[data-application-part="features"], section.tab[data-tab="features"]')
    ];
    if (!mode.creators) {
        sections.push(...root.querySelectorAll(
            'section[data-application-part="inventory"], section.tab[data-tab="inventory"]'));
    }

    for (const section of sections) {
        for (const el of section.querySelectorAll("[data-action], [data-type]")) {
            const action = (el.dataset.action ?? "").toLowerCase();
            const type = (el.dataset.type ?? "").toLowerCase();
            const creates = CREATE_ACTIONS.some(verb => action.includes(verb));
            if (!creates && type !== "feature") continue;
            // A creator that is the only child of its legend takes the empty
            // legend with it - otherwise the fieldset keeps a blank caption bar
            // where the button used to be.
            const legend = el.closest("legend");
            if (legend && legend.querySelectorAll("a, button").length === 1) legend.remove();
            else el.remove();
        }
    }
}

/* ==========================================================================
 * TILE FIT
 * --------------------------------------------------------------------------
 * A tile is square by design and its label is floored at 11px, and between
 * those two there is a band of sheet widths where the text simply does not fit.
 * Measured rather than guessed: at a tile width of 84px "Direct Murder" needs
 * 108px of content - an icon, a two-line name and a two-line cost - and the
 * square gives it 84. `overflow: hidden` then cut the cost line off entirely.
 *
 * The obvious test is the wrong one. Nothing overflows HORIZONTALLY - the
 * labels wrap, `scrollWidth` equals `clientWidth` on every button at every
 * width - so a `scrollWidth > clientWidth` check reports a clean sheet while
 * the bottom line of six tiles is missing. The overflow is vertical, and it is
 * the aspect ratio that causes it.
 *
 * Nor is the answer smaller type: the type scale bottoms out at 11px because
 * the pixel face stops being readable below that, and shrinking the label to
 * fit would undo the reason the floor exists.
 *
 * So the square gives way instead, and only where it has to. Each grid is
 * measured; one whose tiles cannot hold their content is marked, and the mark
 * turns off `aspect-ratio` and equalises the rows. Per GRID, not per tile -
 * one rectangle among nine squares reads as a rendering fault, while a grid of
 * slightly tall tiles reads as a grid.
 * ========================================================================== */

/**
 * A tile label with break points marked inside its long words.
 *
 * "Determination" is 143px of pixel font against an 80px tile. It has no space
 * to wrap at, so the only choices are to break it mid-word or to rename a Hope
 * Call the handbook already named - and the handbook wins.
 *
 * `hyphens: auto` is the textbook answer and does not work here: measured on
 * this build with `lang="en"` set on the root, "Determination" stays on one
 * 143px line and is clipped. Foundry's Electron ships no hyphenation
 * dictionary, so the property is inert. `overflow-wrap: anywhere` does break
 * it, but silently - "Observ / e", "Sabota / ge" - which is what the tiles were
 * doing and what looks broken.
 *
 * A soft hyphen is neither: it is a break point the layout engine takes only
 * when it needs to, and it draws a hyphen when it does. Invisible otherwise, so
 * a word that fits is untouched.
 *
 * Only words too long for the narrowest tile are marked, and only from the
 * fifth character, so the break never leaves an orphaned letter or two.
 */
const SHY = "\u00AD"; // soft hyphen, written as an escape so an editor can see it (UI-15)
const LONG_WORD = 9;      // characters - below this, every label fits a tile
// Six, not five: it puts the break where the word reads best - "Experi-ence"
// and "Contri-bution" rather than "Exper-ience" and "Contr-ibution".
const BREAK_EVERY = 6;

export function softWrap(label) {
    return String(label).split(/(\s+)/).map(part => {
        if (part.length < LONG_WORD || /\s/.test(part)) return part;
        // A word that already carries a hyphen has a break point of its own,
        // and it is a better one than counting to six can find: "Self-defence"
        // was coming out as "Self-d­efence", which reads as a typo rather than
        // as a hyphenation.
        if (part.includes("-")) return part;
        let out = "";
        for (let i = 0; i < part.length; i++) {
            // Never offer a break in the last four characters: "Determinatio-n"
            // is worse than no hyphen at all.
            if (i > 0 && i % BREAK_EVERY === 0 && part.length - i >= 4) out += SHY;
            out += part[i];
        }
        return out;
    }).join("");
}

/** Does any tile in this grid need more room than it has? */
function tileOverflows(grid) {
    for (const tile of grid.querySelectorAll(".drpg-action-button")) {
        // A hidden tile measures zero and would report a false positive.
        if (!tile.clientHeight) continue;

        const style = getComputedStyle(tile);
        const gap = parseFloat(style.rowGap) || 0;
        const needed = [...tile.children]
                .reduce((total, child) => total + child.getBoundingClientRect().height, 0)
            + (parseFloat(style.paddingTop) || 0)
            + (parseFloat(style.paddingBottom) || 0)
            + Math.max(0, tile.children.length - 1) * gap;

        // A pixel of slack: sub-pixel layout noise must not flip the grid.
        if (needed - tile.clientHeight > 1) return true;
    }
    return false;
}

/**
 * Clear the marks, measure, mark again.
 *
 * Both passes run in the same task. Reading `clientHeight` forces the layout
 * synchronously, so the cleared state is measured for real, and nothing is
 * painted in between - the grid does not flicker on its way to the answer.
 * Clearing first is what makes this idempotent: a sheet dragged wider is
 * measured as a square again and drops the mark when it no longer needs it.
 */
export function fitActionTiles(element) {
    const root = element instanceof HTMLElement ? element : element?.[0];
    if (!root) return;

    const grids = [...root.querySelectorAll(".drpg-action-grid")];
    if (!grids.length) return;

    // ONE SIZE FOR EVERY GRID, and that is the point of doing it here rather
    // than inside the loop. See `fitTileText`.
    fitTileText(grids);

    for (const grid of grids) delete grid.dataset.drpgTight;
    for (const grid of grids) {
        if (tileOverflows(grid)) grid.dataset.drpgTight = "";
    }
}

/*
 * HOW SMALL THE TYPE HAS TO GET FOR THE NAMES TO SURVIVE.
 * --------------------------------------------------------------------------
 * The grid is five across and the tiles are square, which is the shape Dawid
 * chose and the shape a row of tiles should be. At the pixel face that leaves a
 * tile about a hundred pixels of inner width, and the longest label in the game
 * wants more - so the type gives way. It was the column count for half a day
 * (four columns, a sheet widened to 920) and Dawid, 28.08: keep the old size,
 * shrink the names and the costs instead.
 *
 * He is right, and the reason is worth keeping. The column count is a SHAPE -
 * a panel that silently has four tiles where the one below it has five reads as
 * two different interfaces. Type a point smaller reads as nothing at all. When
 * something has to give, it should be the thing nobody can name afterwards.
 *
 * ONE SIZE FOR THE WHOLE MODULE, not one per panel. This measured each grid
 * separately at first, which is worse in the way that is easy to miss: the
 * Actions panel kept 11px while the Hope Calls under it sat at 8, so the same
 * sheet carried two sizes of the same thing and the difference looked like a
 * mistake rather than a fit. Dawid, 28.08: make the actions and the Despair
 * Calls agree with the Hope Calls.
 *
 * So the constraint is the longest word ANY tile in the module can carry -
 * `longestTileWord`, taken from the definitions themselves - and every grid
 * on the sheet gets the answer. That also makes the size stable: it does not
 * change when a panel happens to be on a hidden tab, and a Monokuma's sheet
 * and a student's come out the same.
 *
 * Measured off the widest WORD, not the widest label: "Dynamic action" has a
 * space and is happy to wrap at it, so only a word with nowhere to break is
 * allowed to push the type down. And with a FLOOR - below about seven pixels
 * the pixel face stops being readable, and an unreadable whole word is worse
 * than a hyphenated one, so `softWrap` goes back to being the last resort it
 * was written to be.
 */
const TILE_TEXT_FLOOR = 0.68;

/**
 * The longest unbreakable word any tile in this module can be asked to draw.
 *
 * From the definitions rather than a constant, so renaming a Call moves this
 * with it - which is exactly what happened on 28.08, when "Determination"
 * became "Resolve" and stopped being the word every other tile was paying for.
 *
 * READ AT EACH FIT, NOT AT IMPORT (E56 C12, 13.11.2026; R5471). It was worked out once when sheet.mjs was imported,
 * from the English labels: i18n.mjs `localizeConfig` writes the language file's labels into these same tables later
 * (at `i18nInit`, and again when a language file is applied on the same page), so a Polish word longer than every
 * English one was never the word measured. Some sixty short labels split at spaces, beside the layout reads
 * `fitTileText` already makes. Exported for the suite.
 */
export function longestTileWord() {
    const labels = [
        ...Object.values(ACTIONS ?? {}),
        ...Object.values(HOPE_CALLS ?? {}),
        ...Object.values(DESPAIR_CALLS ?? {}),
        // One tile per row of the Monocub's table (E33 C10): a second ability's word is paid for here too.
        ...Object.values(MONOCUB?.abilities ?? {})
    ].map(def => def?.label).filter(Boolean);

    let longest = "";
    for (const label of labels) {
        for (const word of String(label).split(/\s+/)) {
            if (word.length > longest.length) longest = word;
        }
    }
    return longest;
}

function fitTileText(grids) {
    const live = grids.filter(g => g.querySelector(".drpg-action-button")?.clientWidth);
    if (!live.length) return;

    // Measured at full size, whatever the grids are wearing now. Without this
    // the second pass measures the shrunk type, concludes it fits, and the
    // tiles creep smaller on every resize.
    for (const grid of grids) grid.style.removeProperty("--drpg-tile-text");

    const grid = live[0];
    const tile = grid.querySelector(".drpg-action-button");
    const sample = grid.querySelector(".drpg-action-name");
    if (!tile || !sample) return;

    // The longest word rendered in the real face at the real size, inside the
    // real tile - a probe rather than arithmetic, because the pixel font's
    // advance width is not something to hard-code.
    const probe = sample.cloneNode(false);
    probe.textContent = longestTileWord();
    probe.style.cssText = "position:absolute;visibility:hidden;width:min-content;white-space:normal";
    tile.appendChild(probe);
    const needed = probe.getBoundingClientRect().width;
    probe.remove();
    if (!needed) return;

    const style = getComputedStyle(tile);
    const room = tile.getBoundingClientRect().width
        - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0)
        - (parseFloat(style.borderLeftWidth) || 0) - (parseFloat(style.borderRightWidth) || 0);
    if (room <= 0 || needed <= room) return;

    const scale = Math.max(TILE_TEXT_FLOOR, room / needed).toFixed(3);
    for (const one of grids) one.style.setProperty("--drpg-tile-text", scale);
}

/**
 * Re-fit when the sheet is resized.
 *
 * The width a tile ends up with is not a function of the sheet width alone -
 * the grid drops columns as it narrows, so tiles get SMALLER and then abruptly
 * larger again. There is no width to hard-code; the only honest answer is to
 * measure whenever the box changes.
 */
export function watchTileFit(app, element) {
    const root = element instanceof HTMLElement ? element : element?.[0];
    if (!root || root.dataset.drpgTileFit) return;
    root.dataset.drpgTileFit = "1";
    // A previous root of this app (a re-open) - its observer goes first.
    try { app?._drpgTileFit?.disconnect(); } catch { /* already gone */ }

    // Re-entrancy guard: the fitter changes the height of the very boxes the
    // observer is watching, which would otherwise call it straight back.
    let fitting = false;
    const observer = new ResizeObserver(() => {
        if (fitting) return;
        fitting = true;
        requestAnimationFrame(() => {
            try {
                fitActionTiles(root);
            } finally {
                fitting = false;
            }
        });
    });

    observer.observe(root);
    if (app) app._drpgTileFit = observer;
}


/**
 * Give the sheet room for the Hope Calls.
 *
 * Daggerheart opens a character sheet at its own default size (850 wide - see
 * `scaleWindow` in settings.mjs), which fitted when the Calls
 * were a closed drawer and does not now: the panel sits under ten action tiles
 * and a clean-up block, and a menu a cornered player has to scroll to find is
 * a menu they do not use.
 *
 * HEIGHT ONLY, AND WIDTH WAS TRIED. For half a day this also grew the sheet to
 * 920 wide, to buy the tile grid a fourth column wide enough for
 * "Determination". Dawid, 28.08: keep the old size and shrink the type instead.
 * The width is Daggerheart's again and `fitTileText` does the fitting.
 *
 * Grown ONCE per sheet, and only upwards. A GM who drags the window smaller
 * afterwards keeps their size - the alternative, re-asserting on every render,
 * would undo a deliberate resize several times a turn.
 */
const grown = new WeakSet();
const SHEET_MIN_HEIGHT = SHEET_SIZE.minHeight;

/**
 * THE ACTIONS TAB FITS ITS WINDOW, MEASURED RATHER THAN PREDICTED (22.09).
 *
 * Under the glass the sheet's size is a statement - `SHEET_SIZE.glass` times the
 * interface scale, see `scaleWindow` - and it has no handle to correct it with. The
 * statement is right at 100 %, but not everything inside it scales with it: type has a
 * floor, a masked icon has a floor, borders and gaps do not shrink. At 80 % on a live
 * client (Dawid's, on 1.2.50) the Actions tab wanted 654 px and was given 642, so the
 * last row of Hope Calls stood under the frame and the tab scrolled by twelve pixels
 * ("pozwalaja na delikatny scroll").
 *
 * So the window grows by what the tab is short, once it is drawn and whenever the tab is
 * opened again - never past the screen, where a sheet that scrolls is still better than
 * one whose bottom is off the display, and never smaller. Stained Glass only: Monokuma
 * Legacy keeps its handle, and re-asserting a height on every render would undo a
 * deliberate resize (see `growForCalls`).
 */
export function holdActionsTab(app, element) {
    const root = element instanceof HTMLElement ? element : element?.[0];
    if (!root || typeof app?.setPosition !== "function") return;
    if (!document.body.classList.contains("drpg-theme-stained-glass")) return;

    const fit = () => {
        try {
            if (!root.isConnected) return;
            /* Asked again here, not only on the way in: the theme switches live, the sheet's
               root outlives the switch, and the listener below was bound under the glass. */
            if (!document.body.classList.contains("drpg-theme-stained-glass")) return;
            const tab = root.querySelector('section.tab[data-tab="features"].active');
            if (!tab) return;
            const short = tab.scrollHeight - tab.clientHeight;
            if (short <= 0) return;
            const now = root.getBoundingClientRect().height;
            const want = actionsTabHeight(now, short, window.innerHeight);
            if (want > now + 0.5) app.setPosition({ height: want });
        } catch {
            // Cosmetic. A tab that scrolls still works.
        }
    };
    /* After `scaleWindow` has written the scaled size (it runs on the same render, from a
       later hook) and after the tiles' own fit has settled their text; and once more when
       the faces have loaded, which is when a line can still wrap. */
    const later = () => requestAnimationFrame(() => requestAnimationFrame(fit));
    later();
    document.fonts?.ready?.then(later);

    if (root.dataset.drpgHoldActions) return;
    root.dataset.drpgHoldActions = "1";
    root.addEventListener("click", ev => {
        if (ev.target.closest?.('nav [data-tab="features"]')) later();
    });
}

export function growForCalls(app) {
    try {
        if (!app || grown.has(app)) return;
        grown.add(app);
        const height = app.position?.height;
        if (typeof height !== "number" || height >= SHEET_MIN_HEIGHT) return;
        // Never past the window: a sheet taller than the screen is worse than a
        // sheet that scrolls (settings.mjs `callsHeight`).
        app.setPosition({ height: callsHeight(window.innerHeight) });
    } catch {
        // Cosmetic. A sheet that opens at its old size still works.
    }
}
