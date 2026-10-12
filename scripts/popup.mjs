/**
 * Danganronpa RPG - the one popup every player-facing message uses.
 * ---------------------------------------------------------------------------
 * Search, Work on Project, Sabotage, a refused room crossing, a DM's reply, a
 * Despair Call, the time of day - all of it used to be a line in the sidebar
 * somebody had to notice. This is where all of it surfaces instead: a floating
 * card in the middle of the screen, purple for an ordinary update, red for
 * something that was refused, gold for evidence.
 *
 * Every player gets them. A GM gets the ones addressed to the table or to them
 * - see the whisper rule in `onCreateChatMessage` below; the records of what
 * everyone did reach a GM through the chat log and the day summary instead.
 * The chat log is still the paper trail, but it is not a notification channel -
 * during an incident nobody is reading it.
 *
 * And a card closed can be read again (E81 C3, 12.10.2026; audit S16-08): every
 * card drawn here is kept, as it was drawn, in this browser's notice history
 * (notice-history.mjs) until the season's reset - a GM's diet as much as a
 * player's (the owner's Q0). Kept on the client that drew it and nowhere else,
 * so it is exactly what this login was shown: the whisper rule below decides
 * what is drawn, and so what is kept.
 *
 * Two ways something ends up here:
 *   showPopup()              called directly, when the caller wants a title or
 *                            a sticky card - `report()` in action-rolls.mjs,
 *                            the messenger, the Class Trial's evidence card.
 *   the createChatMessage    anything posted through `announce`,
 *   catch-all hook           `whisperToGms` or `whisperToOwner` in utils.mjs,
 *                            all of which stamp `MESSAGE_FLAG`. The accent
 *                            comes from a `popupKind` flag on the message and
 *                            the header from `popupTitle`; `popupKind: "none"`
 *                            opts out for the callers that raise their own
 *                            richer card.
 *
 * Prefer the hook. A card raised by `showPopup()` appears on the client that
 * called it and nowhere else; a card raised from a whisper appears for everyone
 * the whisper was addressed to, which is almost always what was meant.
 */

import { MODULE_ID } from "./config.mjs";
import { MESSENGER_FLAGS } from "./messenger.mjs";
import { MESSAGE_FLAG, plural, debug } from "./utils.mjs";
import { play, BEAT, ARRIVE, SNAP } from "./motion.mjs";
import { recordNotice, updateNotice, noticeUnread, onNoticeHistoryChange } from "./notice-history.mjs";

import { contentOf, wordsOf, secretHtml, isVeiled, cardFlag, cardWriter, SECRET_FLAG } from "./secret.mjs";
const CONTAINER_ID = "drpg-popups";
const EVIDENCE_ID = "drpg-evidence";
const CORNER_ID = "drpg-notices-corner";

/**
 * How many cards may be on screen at once.
 *
 * There was no limit, and the moment that costs you is the one the whole system
 * exists for: during an incident every crisis action produces a card for both
 * participants and the GM, several land inside a second, and the stack grows
 * past the top of the window. The cards that scroll off are the oldest - which
 * is the right ones to lose - but they used to be lost silently and off-screen,
 * so the reader could not tell whether they had missed anything.
 *
 * Oldest were dismissed as new ones arrived, so the stack stayed readable and
 * always showed the most recent events.
 *
 * NOW THEY WAIT INSTEAD (22.09, Dawid: "powiadomienia niech nie znikaja, dopoki
 * gracz ich nie zamknie"). Nothing a notice says leaves the screen until the reader
 * closes it: no timer, and a card that does not fit is PARKED rather than dismissed
 * - out of sight, counted on the stack as "+N", and back the moment a card in front
 * of it is closed. The cap is still how many are SHOWN; it stops being how many are
 * kept.
 */
const MAX_VISIBLE = 4;

function container() {
    const el = document.getElementById(CONTAINER_ID) ?? ensureNoticeTile();
    positionBelowWidgets(el);
    return el;
}

/* Whether the button already follows the history's changes: once a session, however often the tile is rebuilt. */
let followingUnread = false;

/**
 * THE NOTICE HISTORY'S BUTTON, IN THE TILE'S BOTTOM-RIGHT CORNER (E81 C8, 12.10.2026; audit S16-08, the A7
 * design's step 7). The owner's Q3 of 07.10: three buttons on the right as they are, and "Przycisk powiadomień
 * tylko w prawym dolnym rogu kafelka powiadomień" - no fourth launcher. So the tile is made here with the
 * button as its last child before the tile goes into the page: from `ready` (module.mjs, before the narrow
 * layout and the accessibility sweep, which find it there), so the button stands on an empty tile too, and
 * from `container()` should a card come first.
 *
 * WHY THE LAST CHILD OF THE TILE, AND IN NO CARD. Cards come in by `prepend`, and the stack's own functions
 * (`trimStack`, `parkWhatDoesNotFit`, `unparkInto`, `markParked`) move `.drpg-popup` and `.drpg-popup-more`
 * and nothing else, so the same node stays last whatever the stack does (R298 counts it through a prepend, a
 * park, a dismissal and "+N"). It turns with the tile's pane (glass.mjs keys the turn to the tile's selector).
 * It stands `position: absolute` in the corner of the fixed tile's box, out of the cards' column: `overflowsGlass`
 * adds up cards only, and that the glass's `overflow: hidden` leaves its focus ring whole is R299 (b)'s reading,
 * in a browser only. And a click on it is no card's click, so it closes nothing.
 *
 * A COUNT AND NOTHING ELSE reaches it from the history (`noticeUnread`): `data-unread`, "1" to "9" and "9+",
 * drawn by the stylesheet's `::after`, and the count in its name. Never a word of an entry - which is the
 * census's verdict on every road into the history's badge (R472's SURFACE rows). An attribute rather than a
 * text node, so a count that moves is no addition to the live region the tile is: the tile is
 * `aria-atomic="false"` (a11y.mjs `liveRegions`), and whether a screen reader then reads a new card without
 * the button's name is a table's question (LIVE-E81-08).
 *
 * An interface later stages take as it is: E18, E23, E49 and E55 use the tile it makes, and E77 and E78
 * take it over (the A7 design's P0-8). Answers the tile.
 */
export function ensureNoticeTile() {
    let host = document.getElementById(CONTAINER_ID);
    const fresh = !host;
    if (fresh) {
        host = document.createElement("div");
        host.id = CONTAINER_ID;
    }
    let button = document.getElementById(CORNER_ID);
    if (button?.parentElement !== host) {
        button?.remove();
        button = cornerButton();
    }
    if (host.lastElementChild !== button) host.append(button);
    if (fresh) {
        document.body.append(host);
        positionBelowWidgets(host);
    }
    if (!followingUnread) {
        followingUnread = true;
        onNoticeHistoryChange(showUnread);
    }
    if (!followingWidgets) {
        followingWidgets = true;
        Hooks.on("drpgThemeApplied", watchWidgets);
        watchWidgets();
    }
    showUnread();
    return host;
}

/* One shape in the button, inert, holding the glyph: the button is the hit area (28 px, 44 on a touch
   screen - `--drpg-corner` and `--drpg-corner-reach`), the shape is what is drawn, and the button holds no
   text node of its own. The window is imported when the button is pressed, as the keybinding imports it
   (notice-history.mjs), so this file draws no window and imports none: the window's file reaches back to
   this one through the messenger. */
function cornerButton() {
    const button = document.createElement("button");
    button.type = "button";
    button.id = CORNER_ID;
    button.className = "drpg-notices-corner";
    button.setAttribute("aria-live", "off");
    const shape = document.createElement("span");
    shape.className = "drpg-notices-shape";
    shape.setAttribute("inert", "");
    shape.append(document.createElement("i"));
    button.append(shape);
    button.addEventListener("click", () => {
        void import("./notice-history-app.mjs").then(m => m.openNotices())
            .catch(err => debug("The notice history could not be opened from the tile", err));
    });
    return button;
}

/** The count on the tile's button, and its name with it. Attributes only, and only when they change. */
function showUnread() {
    const button = document.getElementById(CORNER_ID);
    if (!button) return;
    let n = 0;
    try {
        n = noticeUnread();
    } catch (err) {
        debug("The notice history's unread count could not be read", err);
    }
    const badge = n > 9 ? "9+" : n > 0 ? String(n) : null;
    if (badge === null) button.removeAttribute("data-unread");
    else if (button.dataset.unread !== badge) button.dataset.unread = badge;
    const name = n > 0 ? plural("DRPG.Notices.buttonUnread", { n }) : game.i18n.localize("DRPG.Notices.title");
    if (button.getAttribute("aria-label") !== name) button.setAttribute("aria-label", name);
    if (button.dataset.tooltip !== name) button.dataset.tooltip = name;
}

/**
 * EVIDENCE GETS THE MIDDLE OF THE SCREEN, AND IT GETS IT BECAUSE IT WAS BEING
 * CUT IN HALF IN THE CORNER (16.09).
 * ---------------------------------------------------------------------------
 * The notice tile is 430 x 220, and that is a ceiling rather than a choice: the
 * corner it stands in is shared with Foundry's tool rail, whose own run is
 * bounded to clear it, and every larger size was measured taking the rail's
 * glass away (see the sweep at the top of stained-glass.css). A Class Trial
 * objection carrying a Truth Bullet with its analysis and a comment needs 459
 * px. It does not fit and it never will.
 *
 * So the one card in this module that is meant to be READ stops living in the
 * corner with the receipts. It stands in the middle of the map, which is the
 * one part of the screen nothing else is using during a trial - nobody is
 * moving tokens while the table argues.
 *
 * IT IS NOT A PANE OF THE CURTAIN, DELIBERATELY. A block that comes and goes is
 * a block the glass has to be recut around, and that is the mistake 1.2.30 made
 * with the notice tile - the corner tile came and went with the news. This
 * stage carries its own glass in the stylesheet, so it can appear, grow with
 * its card and vanish without the curtain hearing about it at all.
 *
 * The stage takes no clicks; the card inside it does (stained-glass.css), so
 * the map underneath stays draggable around the evidence.
 */
function evidenceStage() {
    let el = document.getElementById(EVIDENCE_ID);
    if (!el) {
        el = document.createElement("div");
        el.id = EVIDENCE_ID;
        /* Announced, because a card that lands in the middle of the screen
           without a word is a card a screen reader's user never learns about.
           The same role the notice stack carries (a11y.mjs). */
        el.setAttribute("role", "status");
        el.setAttribute("aria-live", "polite");
        document.body.append(el);
    }
    return el;
}

/**
 * Which of the two this card belongs in.
 *
 * Only a STICKY piece of evidence takes the stage. A non-sticky one is a
 * caller that wanted the evidence colour for a passing message, and a passing
 * message in the middle of the screen is exactly the interruption the corner
 * exists to avoid.
 */
function hostFor(kind, sticky) {
    return sticky && (kind === "evidence" || kind === "objection")
        ? evidenceStage()
        : container();
}

/**
 * Start the stack under whatever this module has put at the top of the screen.
 *
 * The offset used to be a flat 96px in the stylesheet, which was true for the
 * HUD alone. It is not true once the Despair rows are above it (one per
 * Monokuma, twelve pips each) or the trial floor bar is below it - and a trial
 * is exactly when a sticky evidence card is on screen for minutes at a time,
 * sitting on top of the clock everybody is reading.
 *
 * Measured rather than added up, so a UI module that moves or restyles those
 * widgets is accounted for too. The 96px stays as the fallback for a screen
 * where none of them have rendered yet.
 */
const WIDGET_SELECTORS = ["#drpg-despair", "#drpg-hud"];
const FALLBACK_TOP = 96;
const WIDGET_GAP = 8;

function positionBelowWidgets(el) {
    try {
        /* Under Stained Glass the cards have a tile of their own - bottom-left, cut by the
           curtain (glass.mjs, "note-block") - and the sheet places the stack on it. An inline
           `top` here put the stack just under the clock instead, over the glass and the map. */
        if (document.body.classList.contains("drpg-theme-stained-glass")) { el.style.top = ""; return; }
        let bottom = 0;
        for (const selector of WIDGET_SELECTORS) {
            const widget = document.querySelector(selector);
            if (!widget) continue;
            const box = widget.getBoundingClientRect();
            // A hidden or unrendered widget measures zero and must not count.
            if (box.height > 0) bottom = Math.max(bottom, box.bottom);
        }
        el.style.top = `${Math.round(bottom ? bottom + WIDGET_GAP : FALLBACK_TOP)}px`;
    } catch {
        // A card in the wrong place beats no card at all.
    }
}

/**
 * UNDER MONOKUMA LEGACY ON A DESK THE TILE FOLLOWS THE CLOCK WITHOUT A NEW CARD (E81 C10, 12.10.2026; the
 * owner's Q6 of 07.10, "Zgoda" to the A7 design's recommendation: there the history's button always stands,
 * alone under the clock when no card is shown). `top` was measured only in `container()`, so only when a card
 * came: a tile with no card kept the height the widgets had then, and once the Despair rail or the clock grew
 * the lone button stood on the rail. So the tile follows the widgets themselves - a `ResizeObserver` on each of
 * `WIDGET_SELECTORS` for a widget that changes size, and a `MutationObserver` on the rows they are put in
 * (hud.mjs and despair.mjs: Foundry's top and left columns, or the narrow column) for one that is drawn after
 * `ready`, rebuilt as a new node (`renderDespairBar` removes the bar and makes another), moved, or taken away -
 * either one binds the observers again to the nodes there are now. Bound from `ready` (`ensureNoticeTile`) and
 * bound again on `drpgThemeApplied` (settings.mjs `applyTheme`), which is also how a switch from Stained Glass
 * gives the tile its `top` back without a reload. Under Stained Glass nothing is watched: the sheet places the
 * tile on its pane and `positionBelowWidgets` only clears `top`. Headless the harness's `ResizeObserver` never
 * fires, so R298 (7) reads the observers through a stand-in it installs; how a real clock's change moves the
 * tile is R299 (b), in a browser, and LIVE-E81-04 at a table.
 * E18 (S11-17, the stack into the corner) and E23 (A1, a clock of one height) change what is watched here and
 * take these as they are (the A7 design's P7-7 and K16).
 */
const WIDGET_HOMES = ["#ui-left-column-1", "#ui-top", "#ui-middle"];
let followingWidgets = false;
let widgetWatch = [];

const widgetsNow = () => WIDGET_SELECTORS.map(selector => document.querySelector(selector));

function followWidgets() {
    const host = document.getElementById(CONTAINER_ID);
    if (host) positionBelowWidgets(host);
}

function watchWidgets() {
    widgetWatch.forEach(observer => observer.disconnect());
    widgetWatch = [];
    if (!document.body.classList.contains("drpg-theme-stained-glass")) {
        const widgets = widgetsNow(), bound = widgets.map(el => [el, el?.parentElement ?? null]);
        const changed = () => widgetsNow().some((el, i) => el !== bound[i][0] || (el?.parentElement ?? null) !== bound[i][1]);
        const onChange = () => { if (changed()) watchWidgets(); else followWidgets(); };
        try {
            if ("ResizeObserver" in window) {
                const sizes = new ResizeObserver(onChange);
                widgets.forEach(el => { if (el) sizes.observe(el); });
                widgetWatch.push(sizes);
            }
            const arrivals = new MutationObserver(onChange);
            const homes = new Set([...WIDGET_HOMES.map(selector => document.querySelector(selector)), ...bound.map(([, home]) => home)]);
            homes.forEach(home => { if (home) arrivals.observe(home, { childList: true }); });
            widgetWatch.push(arrivals);
        } catch (err) {
            debug("The notice tile could not watch the widgets it stands under", err);
        }
    }
    followWidgets();
}

/** How many cards a stack SHOWS. The rest wait, parked - see `MAX_VISIBLE`. */
function capacityOf(host) {
    if (host.id === EVIDENCE_ID) return MAX_EVIDENCE;
    // Under Stained Glass the stack lives on a tile of the curtain cut for two short cards or one
    // long one (glass.mjs, "note-block"), so two is the most it may show.
    return document.body.classList.contains("drpg-theme-stained-glass") ? 2 : MAX_VISIBLE;
}

const PARKED = "drpg-popup-parked";
const STICKY = "drpg-popup-sticky";

/* Arrival order, kept on each card, because the two stacks lay it out differently: the
   corner tile puts the newest on TOP (see `showPopup`), the evidence stage puts it at
   the bottom. "Oldest" is a fact about time, so it is read off the time. */
let arrivals = 0;
const seqOf = card => Number(card.dataset.drpgSeq) || 0;
const byArrival = (a, b) => seqOf(a) - seqOf(b);

/**
 * Park the oldest cards until the stack fits - non-sticky ones first.
 *
 * Takes the stack it is trimming, because there are two and they show different
 * amounts: the corner tile is a fixed piece of glass with room for two short cards,
 * and the evidence stage holds two pieces of evidence (`MAX_EVIDENCE`).
 *
 * PARKED, NOT DISMISSED (22.09). This retired the oldest cards for good, which was a
 * notice leaving the screen before anybody had read it. A parked card is hidden and
 * kept, in arrival order; `unparkInto` brings the newest of them back as soon as a
 * shown card is closed.
 *
 * Non-sticky ones go first, then sticky ones (UI-10): the glass tile clips with
 * `overflow: hidden` and fills from the bottom, so with two sticky cards on it every
 * later card - a refusal, a reply, the time of day - used to arrive out of sight.
 * The newest card is always one of the cards shown.
 */
function trimStack(host = container()) {
    const shown = Array.from(host.querySelectorAll(`.drpg-popup:not(.leaving):not(.${PARKED})`))
        .sort(byArrival);
    let excess = shown.length - capacityOf(host);
    if (excess > 0) {
        const order = [
            ...shown.filter(c => !c.classList.contains("drpg-popup-sticky")),
            ...shown.filter(c => c.classList.contains("drpg-popup-sticky"))
        ];
        // Never the card that just arrived: it is the newest, and it is why this ran.
        const newest = shown.at(-1);
        for (const card of order) {
            if (excess <= 0) break;
            if (card === newest) continue;
            card.classList.add(PARKED);
            excess--;
        }
    }
    parkWhatDoesNotFit(host);
    markParked(host);
}

/**
 * AND WHAT DOES NOT FIT THE GLASS WAITS TOO, rather than being cut by it (22.09).
 *
 * The corner tile is a fixed pane with `overflow: hidden`, cut for two short cards or
 * one long one. With the newest card on top, two long ones overflowed it at the top -
 * measured at 1920 x 1080, a new notice arrived with its title bar above the glass and
 * only its sentence showing. So while the tile overflows and more than one card is
 * shown, the oldest shown one is parked as well. One card alone never is: a card taller
 * than the tile is capped at the tile and scrolls inside itself.
 *
 * MEASURED ON THE BOXES, NOT ON `scrollHeight`. A card arrives translated down by
 * half a slide, and a transform counts towards a scroll container's overflow: every
 * arrival read as an overflow, and two cards that fitted were parked down to one.
 * The cards do not shrink (`flex: 1 0 auto`), so their heights and the gaps between
 * them add up to more than the tile exactly when they do not fit.
 *
 * ON A STACKED SCREEN TOO, in both themes (E81 C13, the A7 design's P8-7). There the
 * stack stands over the corner buttons with a ceiling under the blocks' stack and
 * `overflow: hidden` (narrow.css), so it is a box of a stated most height like the
 * tile, and what does not fit under it waits in the same way. Under Monokuma Legacy
 * on a desk the stack has no ceiling and nothing overflows it.
 */
function overflowsGlass(host) {
    const classes = document.body.classList;
    if (host.id === EVIDENCE_ID || !(classes.contains("drpg-theme-stained-glass") || classes.contains("drpg-stacked"))) return false;
    const shown = host.querySelectorAll(`.drpg-popup:not(.leaving):not(.${PARKED})`);
    if (shown.length < 2) return false;
    const gap = parseFloat(getComputedStyle(host).rowGap) || 0;
    let total = gap * (shown.length - 1);
    for (const card of shown) total += card.offsetHeight;
    return total > host.clientHeight + 1;
}

function parkWhatDoesNotFit(host) {
    let shown = Array.from(host.querySelectorAll(`.drpg-popup:not(.leaving):not(.${PARKED})`)).sort(byArrival);
    while (shown.length > 1 && overflowsGlass(host)) {
        shown[0].classList.add(PARKED);
        shown = shown.slice(1);
    }
}

/** A shown card was closed: bring back the newest parked one, as many as now fit. */
function unparkInto(host) {
    if (!host?.isConnected) return;
    let shown = host.querySelectorAll(`.drpg-popup:not(.leaving):not(.${PARKED})`).length;
    const parked = Array.from(host.querySelectorAll(`.drpg-popup.${PARKED}:not(.leaving)`))
        .sort(byArrival);
    const room = capacityOf(host);
    while (shown < room && parked.length) {
        const card = parked.pop();
        card.classList.remove(PARKED);
        shown++;
        // Back only if it fits beside what is shown - otherwise it waits a little longer.
        if (overflowsGlass(host)) {
            card.classList.add(PARKED);
            break;
        }
    }
    markParked(host);
}

/**
 * The "+N" on the stack: how many notices wait under the ones on screen.
 *
 * On the title bar of the OLDEST shown card, beside its close button: the parked
 * cards are older than everything shown, so they sit next to it in the stack and it
 * is the one they come back beside. One badge per stack, moved rather than multiplied.
 *
 * "+N" CLOSES EVERY CARD THAT IS NOT STICKY (E81 C11, 12.10.2026; audit S11-39, the owner's Q2 of 07.10:
 * "Tak"). It was a label that said "close one to see the next", so a stack with notices parked under it
 * cost one X per card to clear. Now, while the stack holds a card that is not sticky, it is a button:
 * `closeLoose` takes every such card down, and the sticky ones - a card somebody has to read - stay, with
 * the label on them should more of them wait. Nothing is lost by it: every card is in the notice history,
 * and a parked card goes there unread, because nobody saw it, while a card on screen goes read, as its X
 * would have closed it - so the ones "+N" took down unseen are among what the history's button counts
 * (R298 (8): two parked cards taken down, a badge of 2). No confirmation and no toast, as the X has none.
 * With only sticky cards in the stack - and the Class Trial's evidence stage takes nothing else (`hostFor`)
 * - it is the label as it was, with its tooltip; the button's own, `moreCloseAll`, does not say "close
 * one", which beside a close-all would contradict it.
 */
function markParked(host) {
    setFloor(host);
    host.querySelectorAll(".drpg-popup-more").forEach(b => b.remove());
    const waiting = host.querySelectorAll(`.drpg-popup.${PARKED}:not(.leaving)`).length;
    if (!waiting) return;
    const oldest = Array.from(host.querySelectorAll(`.drpg-popup:not(.leaving):not(.${PARKED})`))
        .sort(byArrival)[0];
    const top = oldest?.querySelector(".drpg-popup-title");
    if (!top) return;
    const closes = host.querySelector(`.drpg-popup:not(.leaving):not(.${STICKY})`) !== null;
    const badge = document.createElement(closes ? "button" : "span");
    badge.className = "drpg-popup-more";
    badge.textContent = `+${waiting}`;
    const tip = plural(closes ? "DRPG.Popup.moreCloseAll" : "DRPG.Popup.moreTip", { n: waiting });
    badge.dataset.tooltip = tip;
    badge.setAttribute("aria-label", tip);
    if (closes) {
        badge.type = "button";
        badge.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            closeLoose(host);
        });
    }
    top.insertBefore(badge, top.querySelector(".drpg-popup-close"));
}

/**
 * Every card of a stack that is not sticky, closed (E81 C11): a parked one at once and unread - it was never
 * on screen, so there is no transition to wait for and nothing was read -, a shown one as its reader's own
 * close, read. Which is which is read once, before the first closes: a parked card taken down calls
 * `unparkInto`, which could bring another parked card to the screen before its own turn, and that one still
 * goes as it was found, unread. The parked ones go first, while the shown ones still hold their seats, so
 * `unparkInto` finds a free seat only where a card was already leaving (read in the code, not measured).
 * Through each card's own `drpg-dismiss`, so everything a card does when it closes - the history's state,
 * the floor, the seat - is what its X would have done.
 */
function closeLoose(host) {
    const loose = Array.from(host.querySelectorAll(`.drpg-popup:not(.leaving):not(.${STICKY})`));
    const parked = loose.filter(card => card.classList.contains(PARKED));
    const shown = loose.filter(card => !parked.includes(card));
    const close = (card, detail) => card.dispatchEvent(new CustomEvent("drpg-dismiss", { detail }));
    parked.forEach(card => close(card, { reason: "unseen", instant: true }));
    shown.forEach(card => close(card, { reason: "user" }));
}

/**
 * THE BOTTOM CARD KEEPS THE CORNER FREE (E81 C9, 12.10.2026; audit S16-08, the A7 design's P7-5). The
 * history's button stands in the tile's bottom-right corner (`ensureNoticeTile`), over whatever card is at
 * the bottom of the stack - and the newest card goes on top, so the bottom one is the OLDEST SHOWN. That card
 * is marked `drpg-popup-floor`, and the stylesheet gives it room for the button: its body's bottom padding at
 * least `--drpg-corner-room` less one line, and on that last line a spacer `--drpg-corner-room` (and 4 px)
 * wide, which the text flows round rather than under. The spacer is the `::after` of one element, the tail,
 * and which element that is cannot be said in CSS: `:last-child` stops at the body's last child, and a card
 * ends as often in `div > p`, in the last `li` of a list or in text after a `<b>` as in a bare sentence. So
 * it is chosen here (`cornerTail`) and marked `drpg-corner-tail`, or `drpg-corner-tail-block` where the card
 * ends in something no line runs through - a table, a rule, a flex or grid block - and the spacer is a line
 * of its own under it. What that costs in height is the design's estimate, not a reading: about 6 px of
 * padding on a desk and 12 on a touch screen under Stained Glass, 11.5 and 17.5 under Monokuma Legacy, and a
 * line only when the last one is full or the card ends in a block. R299 (b) measures it in a browser only.
 *
 * Called first in `markParked` - before its early return, so a stack with nothing parked has its floor too -,
 * by `dismiss` as soon as a card is leaving (the next one takes the corner at once, not after the fade),
 * and by a card's observer when the floor card's own words change (`watchCard`). Only for the corner tile:
 * the evidence stage has no button. The classes are set and taken only when they change, and the observer
 * passes over a change that is nothing but them, so neither wakes the other (R293). Never what is kept:
 * the history's cleaning keeps no class of these (`NOTICE_CLASSES`). A corner that cannot be worked out
 * leaves the card as it was rather than stopping it.
 *
 * An interface later stages take as it is, with the `--drpg-corner*` tokens: E18, E23, E49 and E55 use it
 * and do not rewrite it, and E77 and E78 take it over (the A7 design's P0-8). Answers the floor card, or null.
 */
const FLOOR = "drpg-popup-floor";
const TAIL = "drpg-corner-tail";
const TAIL_BLOCK = "drpg-corner-tail-block";

export function setFloor(host) {
    if (host?.id !== CONTAINER_ID) return null;
    try {
        const floor = Array.from(host.querySelectorAll(`.drpg-popup:not(.leaving):not(.${PARKED})`)).sort(byArrival)[0] ?? null;
        host.querySelectorAll(`.${FLOOR}`).forEach(card => { if (card !== floor) card.classList.remove(FLOOR); });
        if (floor && !floor.classList.contains(FLOOR)) floor.classList.add(FLOOR);
        const body = floor?.querySelector(".drpg-popup-body");
        const [tail, kind] = body ? cornerTail(body) : [null, null];
        host.querySelectorAll(`.${TAIL}, .${TAIL_BLOCK}`).forEach(el => {
            if (el === tail) return;
            el.classList.remove(TAIL, TAIL_BLOCK);
            if (el.getAttribute("class") === "") el.removeAttribute("class");
        });
        if (tail) {
            const other = kind === TAIL ? TAIL_BLOCK : TAIL;
            if (tail.classList.contains(other)) tail.classList.remove(other);
            if (!tail.classList.contains(kind)) tail.classList.add(kind);
        }
        return floor;
    } catch (err) {
        debug("The notice tile's corner could not be kept free", err);
        return null;
    }
}

/* What a node is to the line the card ends on: "inline" (it ends on a line of text, so the spacer goes after
   it in its block), "flow" (a block to look inside), "end" (a block no line runs through) or "none" (not
   drawn - a GM's half on a player's screen). Read off the computed display where there is one; a rule (`hr`)
   is a block that holds no line whatever its display; with no style to read, a known block tag is a flow. */
const FLOW_TAGS = new Set(["address", "article", "aside", "blockquote", "dd", "details", "div", "dl", "dt", "fieldset",
    "figcaption", "figure", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "header", "li", "main", "nav", "ol",
    "p", "pre", "section", "summary", "ul"]);
const DRAWN = "img, hr, table, svg, picture, input, button, canvas";

function lineRole(node) {
    if (node.nodeType === Node.TEXT_NODE) return node.data.trim() ? "inline" : null;
    if (node.nodeType !== Node.ELEMENT_NODE) return null;
    if (!node.textContent.trim() && !node.matches(DRAWN) && !node.querySelector(DRAWN)) return null;
    if (node.localName === "hr") return "end";
    let display = "";
    try {
        display = getComputedStyle(node).display;
    } catch {
        // No style to read: the tag decides.
    }
    if (!display) display = FLOW_TAGS.has(node.localName) ? "block" : node.localName === "table" ? "table" : "inline";
    if (display === "none") return "none";
    if (display.startsWith("inline")) return "inline";
    if (["block", "list-item", "flow-root", "contents"].includes(display)) {
        return [...node.childNodes].some(kid => ["inline", "flow", "end"].includes(lineRole(kid))) ? "flow" : "end";
    }
    return "end";
}

/* The tail: down from the body through its last drawn child, as long as that child is a block of flow. */
function cornerTail(body) {
    let at = body;
    for (;;) {
        let last = at.lastChild, role = null;
        for (; last; last = last.previousSibling) {
            role = lineRole(last);
            if (role && role !== "none") break;
        }
        if (!last || role === "inline") return [at, TAIL];
        if (role === "end") return [at, TAIL_BLOCK];
        at = last;
    }
}

/**
 * The stage SHOWS TWO pieces of evidence, and the second one is the point.
 *
 * A trial argues by putting one thing beside another - an objection answers a
 * presentation, and reading the two together is the whole move. One at a time
 * would make the objection erase what it was objecting to. Three is a wall of
 * text in the middle of the map, and the chat log still has every card.
 *
 * Oldest first, and by hand rather than by `overflow: hidden`: this stage grows
 * with what is in it, so a card that does not fit is not clipped, it would simply
 * make the stage taller. The cap is what keeps that honest - and since 22.09 the
 * oldest is parked by `trimStack` like any notice, not dismissed.
 */
const MAX_EVIDENCE = 2;

/** An objection's card not yet touched, and the stage holding one - see `showPopup`. */
const RAISED = "is-raised";

function raiseIfObjecting(stage) {
    stage.classList.toggle(RAISED, Boolean(stage.querySelector(`.drpg-popup.${RAISED}`)));
}

/**
 * Show a floating card on THIS client, until its reader closes it (22.09). Several
 * can stack if things happen close together; past what the stack shows, the older
 * ones wait parked - see `trimStack`.
 *
 * @param {string|Element} bodyHtml  Already-escaped HTML, or a ready-made
 *   element to adopt. The element form exists because a copy of a chat card is
 *   a DOM subtree, and serialising it to a string only to have the parser
 *   rebuild it is a round trip that can lose things - a `<li>` outside a list
 *   being the obvious one.
 * @param {object} [options]
 * @param {string} [options.title]     Shown in the header bar. Falls back to the
 *   name of the card's kind - every card gets a bar, see below.
 * @param {"info"|"error"|"evidence"|"objection"} [options.kind]  Only the accent
 *   changes: purple for an ordinary update (default), red for something
 *   refused, gold for evidence, loud red for an Objection.
 * @param {() => void} [options.onClick]   Extra action on click, before the
 *   card dismisses. Used to jump straight to the messenger for a DM reply.
 * @param {boolean} [options.sticky]  Close only from its own button, not from a
 *   click anywhere on it, and go to the trial's stage when it is evidence. Every
 *   card stays until it is closed now; this is about how it may be closed.
 * @param {"hope"|"fear"|"critical"|null} [options.tone]  What the card is about,
 *   when that has a colour of its own. The title bar takes it: gold for Hope,
 *   Blood for Despair, crimson for a Critical. A name rather than a colour, so
 *   the palette stays in the stylesheet where the rest of it lives - see
 *   `.drpg-popup-tone-*` there.
 * @param {string|null} [options.messageId]  The chat card it was drawn from: the
 *   notice goes when that card is deleted, and the history keeps one entry per card.
 * @param {boolean} [options.record]  Keep the card in this browser's notice history
 *   (E81 C3; default true). False for a card that says only that something is
 *   pending (`showWaiting`) and for the suite's own cards.
 * @param {string|null} [options.source]  Where it came from, one of the history's
 *   `NOTICE_SOURCES`; by default worked out from the chat card (`noticeSource`).
 * @param {{messenger: string}|null} [options.link]  What the history's entry
 *   opens: a conversation with that user (the messenger's cards, E81 C4).
 * @param {boolean} [options.observe]  Follow the body while the card is on screen:
 *   a card whose words change after it is drawn is kept as it last read (default true).
 * @param {"browser"|"session"} [options.persist]  "session": kept by this page
 *   only, never written to the setting.
 *
 * The interface every later recorder takes (E18, E50, E62 and E70 after E81): a
 * surface that raises a card through `showPopup` is kept by passing these, and
 * calls `recordNotice` itself only when it draws no card.
 */
const KINDS = ["info", "error", "evidence", "objection"];

const TONES = ["hope", "fear", "critical"];

/*
 * THE SNAPSHOT FOLLOWS THE CARD (E81 C3; the A7 design's P3-2). A card's body is not done when it
 * is drawn: a private card's words arrive by socket, a messenger card is redrawn, a trial's evidence
 * fills in. One MutationObserver per kept card watches its body, in the corner tile and on the
 * evidence stage alike, and a quarter of a second after the last change keeps the body again through
 * the same cleaning; it stops when the card leaves the page, and a change it had not yet kept is
 * kept then. The 250 ms are the design's, not a measurement.
 *
 * AND SO DOES THE TAIL (E81 C9). The same observer, on every card in the corner tile whether it is
 * kept or not, `observe: false` included: when the floor card's words change, its tail is chosen again
 * at once (`setFloor`), and the snapshot is left alone unless it is followed. A change that is nothing
 * but the tail's own classes going on or off is passed over (`cornerOnly`), so marking the tail never
 * keeps a snapshot again; the floor class and "+N" are outside the body and never reach it.
 */
const SNAPSHOT_DEBOUNCE_MS = 250;

const CORNER_CLASSES = new RegExp(`(?:^|\\s)(?:${TAIL}|${TAIL_BLOCK})(?=\\s|$)`, "g");
const withoutCorner = value => (value ?? "").replace(CORNER_CLASSES, " ").split(/\s+/).filter(Boolean).join(" ");
const cornerOnly = record => record.type === "attributes" && record.attributeName === "class"
    && withoutCorner(record.oldValue) === withoutCorner(record.target.getAttribute("class"));

function watchCard(card, body, id) {
    let timer = null;
    const keep = () => {
        timer = null;
        try {
            updateNotice(id, { html: body.innerHTML });
        } catch (err) {
            debug("A notice's snapshot could not be kept", err);
        }
    };
    const observer = new MutationObserver(records => {
        if (records.every(cornerOnly)) return;
        if (card.classList.contains(FLOOR)) setFloor(card.parentElement);
        if (id === null) return;
        if (timer !== null) clearTimeout(timer);
        timer = setTimeout(keep, SNAPSHOT_DEBOUNCE_MS);
    });
    observer.observe(body, { childList: true, subtree: true, characterData: true, attributes: true, attributeOldValue: true });
    return () => {
        const waiting = observer.takeRecords().some(record => !cornerOnly(record)) || timer !== null;
        observer.disconnect();
        if (timer !== null) clearTimeout(timer);
        if (waiting && id !== null) keep();
    };
}

/**
 * Where a card came from, when its caller did not say (the A7 design's P3-1): a chat card nobody
 * was whispered is "public" from a GM and "player" from anyone else, with that player's id from the
 * document's own author - never `cardWriter`, which a card's meta can name; a whisper, a veiled card
 * or no chat card at all is "mine".
 */
function noticeSource(source, messageId) {
    if (source) return { source };
    const message = messageId ? game.messages?.get(messageId) : null;
    if (!message || (message.whisper ?? []).length) return { source: "mine" };
    const author = message.author ?? null;
    return author && !author.isGM ? { source: "player", author: author.id } : { source: "public" };
}

export function showPopup(bodyHtml, {
    title = null, kind = "info", onClick = null, sticky = false, tone = null, messageId = null,
    record = true, source = null, link = null, observe = true, persist = "browser"
} = {}) {
    const card = document.createElement("div");
    card.className = `drpg-popup drpg-popup-${KINDS.includes(kind) ? kind : "info"}${
        sticky ? " drpg-popup-sticky" : ""}${
        TONES.includes(tone) ? ` drpg-popup-tone-${tone}` : ""}`;

    // EVERY CARD HAS A TITLE BAR.
    //
    // It used to be optional, on the reasoning that a generic label helps
    // nobody - and the result was two kinds of card on screen: the ones with
    // the module's Bone bar across the top and the ones that were a paragraph
    // floating in a box. The bar is what makes a card read as this module's,
    // and a card with no title of its own can still say what kind of thing it
    // is. It also carries the close button, which a card without a bar simply
    // did not have.
    if (!title) title = game.i18n.localize(`DRPG.Popup.kind.${KINDS.includes(kind) ? kind : "info"}`);

    {
        const head = document.createElement("div");
        head.className = "drpg-popup-title";
        head.textContent = title;

        const close = document.createElement("button");
        close.type = "button";
        close.className = "drpg-popup-close";
        close.innerHTML = `<i class="fa-solid fa-xmark" inert></i>`;
        close.setAttribute("aria-label", game.i18n.localize("DRPG.Panel.close"));
        head.append(close);
        close.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            dismiss({ reason: "user" });
        });

        card.append(head);
    }

    const body = document.createElement("div");
    body.className = "drpg-popup-body";
    if (bodyHtml instanceof Element) body.append(bodyHtml);
    else body.innerHTML = bodyHtml ?? "";
    card.append(body);

    /* KEPT AS DRAWN (E81 C3; the A7 design's P3-0): after the body is filled and before any host
       takes the card, so what is kept is what this card shows and nothing a stack adds to it later.
       A history error never stops a card. */
    let notice = null, unwatch = null;
    if (record) {
        try {
            notice = recordNotice({
                kind: KINDS.includes(kind) ? kind : "info", tone: TONES.includes(tone) ? tone : null,
                title, html: body.innerHTML, messageId, link, persist, ...noticeSource(source, messageId)
            });
            if (notice) card.dataset.drpgNotice = notice;
        } catch (err) {
            debug("A notice could not be kept in this browser's history", err);
        }
    }

    const host = hostFor(kind, sticky);
    const followed = notice && observe ? notice : null;
    if (followed !== null || host.id === CONTAINER_ID) unwatch = watchCard(card, body, followed);
    card.dataset.drpgSeq = String(++arrivals);
    // The card it was drawn from, so the notice goes when that card is deleted (`registerPopups`).
    if (messageId) card.dataset.drpgMessage = messageId;
    /* THE NEWEST ON TOP, AND THE OLD ONES PUSHED UNDER IT (22.09, Dawid: "nowy notice ma
       wypychac pod spod stare"). The corner tile used to append, so a new notice came in
       below the ones already there. It goes in first now; what it pushes past the tile's
       two is parked underneath (`trimStack`). The evidence stage keeps its order: there
       an objection is read AFTER the presentation it answers. */
    if (host.id === EVIDENCE_ID) host.append(card);
    else host.prepend(card);

    /* AN OBJECTION COMES TO THE FRONT UNTIL IT IS TOUCHED (E10 C16, 1.2.71; the owner's amend
       of 04.10). The stage sits under the windows on purpose - evidence stands for minutes and
       what is opened over it must stay reachable - and so an OBJECTION! landed behind the sheet
       or the ballot a player had open, which is the one card that interrupts. It raises the
       stage (`is-raised`, the stylesheet's `#drpg-evidence.is-raised`) until the first
       pointerdown on it, and then it sinks under the windows like any evidence. Per card: the
       stage stays raised while any objection on it is untouched. */
    if (host.id === EVIDENCE_ID && kind === "objection") {
        card.classList.add(RAISED);
        card.addEventListener("pointerdown", () => {
            card.classList.remove(RAISED);
            raiseIfObjecting(host);
        }, { once: true });
        raiseIfObjecting(host);
    }

    /* CLOSED FOR A REASON (E81 C3; the A7 design's P3-3): "user", "withdrawn", "unseen" or "code".
       Closed by its reader - its close button, a click on it, or "+N" while it was on screen - the notice was read; closed by code
       (the function this returns), by a deletion or by "+N" while it was parked, it was not, and the history says so. `instant` takes a card that was
       never on screen down at once instead of waiting for a transition it never ran. */
    let dismissed = false;
    const dismiss = ({ reason = "code", instant = false } = {}) => {
        if (dismissed) return;
        dismissed = true;
        if (notice) {
            try {
                updateNotice(notice, { state: reason === "user" ? "read" : "unread" });
            } catch (err) {
                debug("A notice's state could not be kept", err);
            }
        }
        card.classList.add("leaving");
        /* The seat it leaves is taken by the newest card that was waiting for one - once
           it has actually gone: a leaving card still takes its space until it is removed,
           and measured beside it nothing would fit. The corner is handed on at once: the
           next oldest card keeps the button clear from now (E81 C9, `setFloor`). */
        const home = card.parentElement;
        setFloor(home);

        // WAIT FOR THE TRANSITION, NOT FOR A NUMBER.
        //
        // This was `setTimeout(…, 300)`, and 300 was a guess at a duration
        // written in the stylesheet - two files holding the same fact, which is
        // how they drift. Worse: it was unreachable. A reader who asks their
        // operating system to stop animations gets the tokens zeroed, the
        // transition never runs, and a hardcoded timeout would still have held
        // a finished card on screen for a third of a second.
        //
        // The timeout that remains is a backstop and nothing else. A card
        // dismissed while its tab is in the background gets no `transitionend`
        // at all - browsers do not run transitions nobody can see - and a card
        // that never leaves the DOM is a leak. Generous enough never to cut a
        // real transition short, short enough that nothing piles up.
        let gone = false;
        const remove = () => {
            if (gone) return;
            gone = true;
            unwatch?.();
            card.remove();
            unparkInto(home);
            if (home?.id === EVIDENCE_ID) raiseIfObjecting(home);
            /* The stage is a box in the middle of the screen. Empty, it has
               nothing to draw and nothing to say, so it goes rather than
               sitting there as an invisible `role="status"` region. The corner
               tile is the opposite case and stays: it is a cut pane of the
               curtain whether or not anything is on it. */
            const stage = document.getElementById(EVIDENCE_ID);
            if (stage && !stage.querySelector(".drpg-popup")) stage.remove();
        };
        if (instant) {
            remove();
            return;
        }
        card.addEventListener("transitionend", event => {
            if (event.target === card) remove();
        });
        setTimeout(remove, Math.max(SNAP(), 0) + 1000);
    };

    // So `trimStack` can retire this card without holding a reference to its
    // closure. Everything a card knows about closing lives in `dismiss`; the
    // event's `detail` is its `{ reason, instant }` (E81 C3), none is code.
    card.addEventListener("drpg-dismiss", event => dismiss(event.detail ?? {}));
    trimStack(host);

    // Click-anywhere-to-dismiss is right for a notification and wrong for a card
    // somebody is reading: a sticky one closes only from its own button, unless
    // the caller gave it something to do on click.
    if (!sticky || onClick) {
        card.addEventListener("click", () => {
            onClick?.();
            dismiss({ reason: "user" });
        });
    }

    requestAnimationFrame(() => card.classList.add("visible"));

    // EVIDENCE LANDS. IT DOES NOT APPEAR.
    //
    // An ordinary card slides down a few pixels and fades in, which is right
    // for a receipt: it is information, and it can be ignored until its reader
    // closes it. Evidence in a Class Trial is the opposite of all of that. Somebody has put a fact in front of the table and the table has
    // to deal with it, so it arrives from the side, overshoots, and stops hard -
    // Danganronpa's own grammar, where nothing eases into frame.
    //
    // Over the beat, once, on the card that just arrived. Nothing waits for it:
    // the card is already in the DOM, already clickable, already readable, and
    // this runs on top of a card that is fully there.
    if (kind === "evidence" || kind === "objection") {
        const from = kind === "objection" ? "120%" : "60%";
        play(card, [
            { transform: `translateX(${from}) scale(1.04)`, opacity: 0, offset: 0 },
            { transform: "translateX(-4%) scale(1.02)", opacity: 1, offset: 0.55 },
            { transform: "translateX(2%) scale(0.995)", opacity: 1, offset: 0.78 },
            { transform: "translateX(0) scale(1)", opacity: 1, offset: 1 }
        ], BEAT(), ARRIVE());
    }

    /* NO TIMER (22.09). An ordinary card used to leave by itself after twelve seconds,
       which is a notice gone while its reader was looking at the map. */
    return dismiss;
}

/**
 * A card that says "waiting on the GM", and the function that takes it down.
 *
 * A player who asked for a ruling used to get either a toast that faded in
 * five seconds or nothing at all, and then sat for minutes unable to tell a
 * GM reading the question from a socket that had dropped it. Sticky, so it
 * stays until the answer comes; closable, so it never traps anybody.
 */
export function showWaiting(text, title = null) {
    // Kept nowhere (E81 C3): it says only that an answer is coming, and the answer is its own card.
    const dismiss = showPopup(`<p>${text}</p>`, { sticky: true, title, kind: "info", record: false });
    return () => {
        try {
            dismiss?.();
        } catch {
            // Already gone.
        }
    };
}

/* ==========================================================================
 * CATCH-ALL - any DRPG whisper reaching a non-GM player becomes a popup too
 * ========================================================================== */

export function registerPopups() {
    Hooks.on("createChatMessage", onCreateChatMessage);
    /* A NOTICE GOES WITH ITS CARD (E32+E07 C16, 03.10.2026; audit S02-30). A notice is drawn
       once and has no timer, so a card the module took back - the opening's request once the
       roll has resolved, a rerolled action's old outcome - stayed in the corner after the
       chat log had dropped it, asking for a roll already made: measured in 13-murder-signals
       with the opening's cards deleted and this hook absent, the killer's notice stayed, and
       after a second murder there were two. */
    Hooks.on("deleteChatMessage", onDeleteChatMessage);
}

/**
 * A deleted chat card takes its notice off the screen, closed as "withdrawn" (E81 C5). It used to be closed
 * by a click on its own X, which is its reader's close: the history read a card nobody had read as read.
 * Whether its entry stays is the history's (notice-history.mjs `noticeCardDeleted`): only the module's
 * withdraw option takes it out; this closes every card of the message whatever the option.
 */
export function onDeleteChatMessage(message) {
    for (const card of document.querySelectorAll(".drpg-popup[data-drpg-message]")) {
        if (card.dataset.drpgMessage === message?.id) card.dispatchEvent(new CustomEvent("drpg-dismiss", { detail: { reason: "withdrawn" } }));
    }
}

/**
 * Every module message surfaces in the middle of the screen, for everybody it
 * was addressed to - GMs included.
 *
 * The old rule was "players only, whispers only". That left the GM reading a
 * sidebar for the half of this module that talks to them exclusively - every
 * ruling request, every Remnant placed, every Despair Call receipt, the entire
 * murder engine's commentary - while the players got cards. During an incident
 * the chat log is the last place anyone is looking.
 *
 * "Ours" is decided by the marker `utils.mjs` stamps on the three helpers every
 * module message goes through, not by sniffing the content: half of these are a
 * bare heading and a paragraph with nothing to recognise them by.
 */
export async function onCreateChatMessage(message) {
    if (!message.getFlag(MODULE_ID, MESSAGE_FLAG)) return;

    // A genuine dice roll should animate and show in chat normally, not get
    // swallowed into a popup card.
    if ((message.rolls?.length ?? 0) > 0) return;

    // A whisper reaches the people it names. A public announcement reaches
    // everyone, which is what makes it an announcement.
    const whisper = message.whisper ?? [];
    if (whisper.length && !whisper.includes(game.user.id)) return;

    // A veiled card is addressed to everybody and readable by its readers
    // alone: wait for the words, and if none came this is not our card.
    // Every private card waits for them since E06 C7a: what it says of itself
    // (`cardFlag` below) came with them, not on the document.
    if (message.getFlag(MODULE_ID, SECRET_FLAG)) {
        await wordsOf(message);
        if (isVeiled(message) && !secretHtml(message)) return;
    }

    // Surfaces that already present themselves, and must not be shown twice.
    //
    //   the messenger  raises its own card, or appends to an open window
    //   `popupKind: "none"`  the poster is calling `showPopup` itself, with a
    //                        richer card than this generic one - the Class
    //                        Trial's sticky evidence card is the case in point
    if (cardFlag(message, MESSENGER_FLAGS.thread)) return;
    const kind = cardFlag(message, "popupKind") ?? "info";
    if (kind === "none") return;

    /* ---- a GM is not an audience for every receipt in the world ----------
     *
     * Most of what this module whispers is a RECORD, not a request: a Remnant
     * was placed, a Search drew a Tier 2 item, a Despair Call was paid for, a
     * clean-up rolled 14 against DC 12. Every one of those raised a card in the
     * middle of the GM's screen, and during a busy time of day - five players
     * acting, an incident running - the GM's screen was the one least able to
     * afford it.
     *
     * The first pass at this only skipped whispers addressed to GMs ALONE,
     * which turned out to be the smaller half of the problem: a player's action
     * card goes through `whisperToOwner` (utils.mjs), and that list is the owner
     * PLUS every GM, so it was never GM-only and every one of the sixty-odd call
     * sites still interrupted the GM. Measured on two clients: a `whisperToGms`
     * record raised nothing, a `whisperToOwner` record raised a card.
     *
     * So a whisper - any whisper - stays in the chat log for the GM, where a
     * record belongs, and the GM's roundup of who did what is the day summary
     * (day-summary.mjs), which already carries a "who" column for GMs. What
     * still interrupts a GM:
     *
     *   public announcements   no whisper list at all; that IS an announcement
     *   messenger threads      handled above; that IS the GM being called
     *   `gmPopup`              the poster says this one is for the GM to answer
     *   `popupForce`           the poster insists, for every recipient
     *
     * Players are untouched: their own cards are the whole point of the popup.
     */
    // `popupForce` only from a GM (E02, audit S11-27): from a player's console it
    // put a card that looks like the module's own in the middle of every screen. A GM posting a
    // player's card for them does not make it a GM's (secret.mjs `cardWriter`, E08+E28 fix r2-H5).
    const forGm = cardFlag(message, "gmPopup")
        || (cardWriter(message)?.isGM && cardFlag(message, "popupForce"));
    if (game.user.isGM && whisper.length && !forGm) return;

    // A header, when the poster gave one. An action's result card says which
    // action it is about - "Search", "Sabotage" - and that used to be possible
    // only by calling `showPopup` directly, which meant the card appeared on the
    // acting client alone. Carried on the message instead, so every recipient
    // gets the same card with the same title.
    /*
     * THE WORDS, NOT THE STUB. A private card carries its text by socket and
     * the document holds a placeholder, so a notice drawn the moment the
     * document arrives was drawing the placeholder - an empty card. The chat
     * log never showed it because it redraws itself when the words land; the
     * notice is drawn once.
     *
     * `wordsOf` resolves at once for everything that is not a private card,
     * which is nearly everything, so the ordinary notice is not delayed by a
     * tick it does not need.
     */
    showPopup(await wordsOf(message), {
        kind,
        title: cardFlag(message, "popupTitle") ?? null,
        // Carried on the message rather than worked out here, for the same
        // reason the title is: the card appears on every screen the whisper
        // reached, and only the client that posted it knows what the roll did.
        tone: cardFlag(message, "popupTone") ?? null,
        messageId: message.id
    });
}
