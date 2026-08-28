/**
 * Danganronpa RPG — windows that stay true while they are open.
 * ---------------------------------------------------------------------------
 * WHAT THIS IS FOR.
 *
 * Every window in this module reads world state and prints it. Almost all of
 * them read it ONCE, when they open, and then sit there — so a GM who opens the
 * panel, starts an Eclipse from the HUD and looks back at the panel is reading
 * the world as it was before they touched it. Dawid, 28.08: the murder tile
 * stays clickable through an Eclipse and only corrects itself when the window
 * is closed and opened again.
 *
 * The GM panel already had half of this: `keepStandingFresh` redrew the "what
 * happens now" line and deliberately left the tiles alone. That is the worst of
 * the three possible states. A dead window teaches you to reopen it; a live
 * window you can trust; a window where the top line updates and the buttons do
 * not is a window that LOOKS current and is not, which is how a GM ends up
 * pressing a button the world stopped allowing two minutes ago.
 *
 * So the redraw is one mechanism, here, and every standing window uses it.
 *
 * ---------------------------------------------------------------------------
 * WHAT MAKES THIS HARDER THAN `element.innerHTML = build()`.
 *
 * A window is not only what it prints. It is also where the GM has scrolled to,
 * which sections they folded open, which field they are typing in, and what
 * they have typed into it but not yet saved. All four of those live in the DOM
 * and nowhere else, so a naive rebuild throws them away — and a rebuild that
 * eats a half-typed rule while the GM is looking at the keyboard is a worse bug
 * than the stale window it was meant to fix.
 *
 * Hence the two rules below, and they are the whole design:
 *
 *   1. NEVER REDRAW UNDER THE CURSOR. If focus is inside the region, the
 *      rebuild waits until focus leaves. Not "preserve the caret" — wait. A
 *      caret restored to character 14 of a field whose text changed underneath
 *      it is a subtler kind of wrong.
 *
 *   2. CARRY EVERYTHING THAT IS NOT PRINTED. Scroll positions, open `<details>`
 *      and the value of any field the user has touched are read off the old
 *      subtree and put back onto the new one, matched by a key that survives a
 *      rebuild (`name`, `data-drpg-key`, `id`, or failing those the element's
 *      position in the region).
 *
 * The safest regions are the ones that have no fields at all — a status block,
 * a row of tiles, a table of read-outs. Where a window is mostly a form, point
 * this at the read-out part and leave the form alone: a narrow live region is
 * worth more than a wide one that has to keep apologising.
 */

import { MODULE_ID } from "./config.mjs";
import { debug, error } from "./utils.mjs";

/**
 * The events that mean "something a window might be printing has changed".
 *
 * `updateSetting` covers every world setting this module owns, which is where
 * nearly all of its state lives. The two module hooks cover the case that
 * setting alone does not: a change that arrived over the sync socket on a
 * client that did not write it, where no local setting update fires.
 *
 * Actor hooks are opt-in (`watch.actors`) because they are noisy — a Daggerheart
 * roll writes an actor several times — and most windows print nothing off one.
 */
const WORLD_HOOKS = ["drpgTimeOfDayChanged", "drpgEclipseChanged"];
const ACTOR_HOOKS = ["updateActor", "createActor", "deleteActor"];
const TOKEN_HOOKS = ["createToken", "deleteToken", "updateToken"];
const ITEM_HOOKS = ["createItem", "deleteItem", "updateItem"];

/** Every window this module has asked to keep live, for the diagnostics. */
const living = new Set();

/**
 * Keep part of an open window true.
 *
 * @param {object}   app             The DialogV2 / ApplicationV2 instance.
 * @param {object}   options
 * @param {string}   options.region  CSS selector for the element to replace. It
 *                                   is looked up inside the window each time, so
 *                                   a region that replaced itself last round is
 *                                   still found — which means `build` must
 *                                   return an element carrying the same class.
 * @param {Function} options.build   Returns the replacement: markup, or a node.
 * @param {object}  [options.watch]  `{ actors, tokens, items, settings, hooks }`.
 * @param {number}  [options.delay]  Debounce, ms.
 * @param {Function}[options.after]  Run after a successful rebuild, with the new
 *                                   element — for anything the region needs that
 *                                   markup alone cannot carry.
 * @returns {Function} Stop listening. Idempotent; also called automatically
 *                     when the window closes or the region goes away.
 */
export function keepLive(app, { region, build, watch = {}, delay = 120, after = null } = {}) {
    if (!app || typeof build !== "function" || !region) return () => {};

    const record = { app, region, at: Date.now(), refreshes: 0, deferred: 0 };
    living.add(record);

    let stopped = false;
    /* Set when a refresh was wanted but the GM was typing inside the region.
     * The pending redraw is not queued as a timer — it is answered by the
     * `focusout` listener below, because "when they stop typing" is an event
     * and not a duration. */
    let pending = false;

    const root = () => app.element ?? null;
    const target = () => root()?.querySelector(region) ?? null;

    /**
     * @param {boolean} [force] Skip the focus check because the caller already
     *   knows focus has left — see `onFocusOut`, which is told where focus went
     *   and therefore knows better than `document.activeElement` does at that
     *   instant.
     */
    const rebuild = (force = false) => {
        if (stopped) return;
        const element = target();
        // Closed, or replaced by a newer window: stop rather than redraw
        // something nobody is looking at. `isConnected` catches the second
        // case, which a null check does not.
        if (!element?.isConnected) return stop();

        // RULE 1. The GM is typing in here; come back when they are not.
        if (!force && isEditing(element)) {
            pending = true;
            record.deferred++;
            debug(`live: ${region} deferred — focus is inside it`);
            return;
        }

        try {
            const carried = capture(element);
            const next = toElement(build());
            if (!next) return;
            element.replaceWith(next);
            restore(next, carried);
            record.refreshes++;
            if (after) after(next);
        } catch (err) {
            // A region that cannot rebuild itself must not take the window down
            // with it, and must not keep trying every 120ms forever.
            error(`live: could not refresh "${region}"`, err);
            stop();
        }
    };

    const schedule = foundry.utils.debounce(rebuild, delay);

    const names = [
        ...WORLD_HOOKS,
        ...(watch.actors ? ACTOR_HOOKS : []),
        ...(watch.tokens ? TOKEN_HOOKS : []),
        ...(watch.items ? ITEM_HOOKS : []),
        ...(watch.hooks ?? [])
    ];

    const listeners = names.map(name => [name, Hooks.on(name, () => schedule())]);

    // Settings are filtered rather than watched wholesale: every module in the
    // world writes settings, and a window has no business redrawing because
    // somebody else's module saved a preference.
    listeners.push(["updateSetting", Hooks.on("updateSetting", setting => {
        if (!setting?.key?.startsWith(`${MODULE_ID}.`)) return;
        if (watch.settings && !watch.settings.includes(setting.key.split(".").pop())) return;
        schedule();
    })]);

    /* RULE 1's other half. Without this a deferred refresh waits for the next
     * world change, which may never come — so the GM finishes typing and the
     * window stays stale with no event left to wake it.
     *
     * `relatedTarget` IS THE ANSWER, AND ASKING FOR A FRAME WAS NOT.
     *
     * The question here is "did focus leave the region, or move within it" —
     * tabbing from one field to the next must not count as leaving. This used
     * to wait a frame and then read `document.activeElement`, because at
     * `focusout` time the new element does not have focus yet. It worked and it
     * was wrong twice over: `requestAnimationFrame` DOES NOT RUN IN A HIDDEN
     * TAB, so a GM who alt-tabbed away mid-sentence came back to a window that
     * had quietly given up waiting; and it asked a question the event was
     * already carrying the answer to.
     *
     * `relatedTarget` is where focus is GOING, known at this instant. Null when
     * it is going nowhere, which is not inside the region either. So the answer
     * is exact, immediate, and does not need a frame that may never come.
     *
     * Found by a test, not by a table: the suite runs in whichever tab was left
     * open, and a backgrounded one does not paint. */
    const onFocusOut = event => {
        if (!pending) return;
        const element = target();
        if (!element?.isConnected) return;
        if (event?.relatedTarget && element.contains(event.relatedTarget)) return;
        pending = false;
        // Forced: `document.activeElement` during a `focusout` is not reliably
        // the thing focus is moving to, and `relatedTarget` above has already
        // settled the only question the check would ask.
        rebuild(true);
    };
    root()?.addEventListener("focusout", onFocusOut);

    const closeId = Hooks.on("closeApplicationV2", closed => {
        if (closed !== app) return;
        stop();
    });

    function stop() {
        if (stopped) return;
        stopped = true;
        for (const [name, id] of listeners) Hooks.off(name, id);
        Hooks.off("closeApplicationV2", closeId);
        root()?.removeEventListener("focusout", onFocusOut);
        living.delete(record);
    }

    /*
     * REDRAW ON DEMAND, as well as when the world moves.
     *
     * A filter is a change to what the window should show that no document
     * hook will ever report — nothing in the world changed, the reader did.
     * Hanging it on the same rebuild is what keeps one path: the same capture
     * of scroll, folded sections, half-typed fields and which tab is showing.
     *
     * Attached to `stop` rather than returned beside it so every existing
     * caller — all of which use the return value as a function — is untouched.
     */
    stop.refresh = () => rebuild(true);
    return stop;
}

/**
 * Is the person looking at this window in the middle of using it?
 *
 * Focus inside a text field, a select being chosen from, or something
 * contenteditable — all three are reasons to leave the DOM alone. A focused
 * BUTTON is not: a button keeps focus after it is pressed, and a window whose
 * buttons freeze it the moment anybody clicks one is the stale window again
 * with extra steps.
 */
function isEditing(element) {
    const active = document.activeElement;
    if (!active || !element.contains(active)) return false;
    const tag = active.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    return active.isContentEditable === true;
}

/** Turn whatever `build` returned into one element. */
function toElement(built) {
    if (built instanceof HTMLElement) return built;
    const holder = document.createElement("div");
    holder.innerHTML = String(built ?? "");
    return holder.firstElementChild;
}

/**
 * A key for one element that survives its own rebuild.
 *
 * `name` first because it is what a form field is identified by everywhere else
 * in this module, then the explicit opt-in, then `id`. The positional fallback
 * is last and is honest about what it is: it matches by shape, so it holds
 * while the region's structure is stable and gives up when it is not, which is
 * the right way round — a scroll position restored into the wrong box is worse
 * than one that was not restored.
 */
function keyFor(element, root) {
    const named = element.getAttribute?.("name");
    if (named) return `n:${named}`;
    const own = element.dataset?.drpgKey;
    if (own) return `k:${own}`;
    if (element.id) return `i:${element.id}`;

    const path = [];
    for (let node = element; node && node !== root; node = node.parentElement) {
        const parent = node.parentElement;
        if (!parent) break;
        path.unshift([...parent.children].indexOf(node));
    }
    return `p:${path.join("/")}`;
}

/**
 * Everything about this region that is not in the markup.
 *
 * Dirty fields only. A field showing what the world says is rebuilt with what
 * the world says NOW, which is the entire point of the refresh; a field the GM
 * has typed into is theirs and is put back untouched. `defaultValue` and
 * `defaultChecked` are the browser's own record of what the markup said, so
 * "has the user changed this" needs no bookkeeping of ours.
 */
function capture(element) {
    const scrolls = new Map();
    const opens = new Map();
    const dirty = new Map();

    if (element.scrollTop || element.scrollLeft) {
        scrolls.set("self", [element.scrollTop, element.scrollLeft]);
    }
    for (const node of element.querySelectorAll("*")) {
        if (node.scrollTop || node.scrollLeft) {
            scrolls.set(keyFor(node, element), [node.scrollTop, node.scrollLeft]);
        }
    }
    for (const node of element.querySelectorAll("details")) {
        opens.set(keyFor(node, element), node.open);
    }
    for (const node of element.querySelectorAll("input, textarea, select")) {
        const key = keyFor(node, element);
        if (node.type === "checkbox" || node.type === "radio") {
            if (node.checked !== node.defaultChecked) dirty.set(key, { checked: node.checked });
        } else if (node.tagName === "SELECT") {
            if ([...node.options].some(o => o.selected !== o.defaultSelected)) {
                dirty.set(key, { value: node.value });
            }
        } else if (node.value !== node.defaultValue) {
            dirty.set(key, { value: node.value });
        }
    }

    /*
     * WHICH TAB IS SHOWING, and it belongs here for the same reason a folded
     * section does: it is a thing the person did to the window and the markup
     * does not carry it. A rebuild that drops the GM back onto the first tab
     * while they are reading the fourth is the cure being worse than the stale
     * window — rule 2, in the shape tabs take.
     *
     * TWO SHAPES, because the module grew two. `panelTabs` in utils.mjs marks
     * `active` on both the button and the section; the case dashboard has its
     * own older pair that marks the button and toggles `display` on the panel.
     * Both are keyed by the same string, so one captured key puts either back.
     */
    const tab = element.querySelector("[data-drpg-gmt-tab].active")?.dataset?.drpgGmtTab
        ?? element.querySelector("[data-drpg-tab].active")?.dataset?.drpgTab
        ?? null;

    return { scrolls, opens, dirty, tab };
}

/** Put back what `capture` took. Every step is optional and independent. */
function restore(element, { scrolls, opens, dirty, tab }) {
    const self = scrolls.get("self");
    if (self) [element.scrollTop, element.scrollLeft] = self;

    if (scrolls.size > (self ? 1 : 0)) {
        for (const node of element.querySelectorAll("*")) {
            const seen = scrolls.get(keyFor(node, element));
            if (seen) [node.scrollTop, node.scrollLeft] = seen;
        }
    }
    if (opens.size) {
        for (const node of element.querySelectorAll("details")) {
            const was = opens.get(keyFor(node, element));
            if (was !== undefined) node.open = was;
        }
    }
    if (dirty.size) {
        for (const node of element.querySelectorAll("input, textarea, select")) {
            const was = dirty.get(keyFor(node, element));
            if (!was) continue;
            if ("checked" in was) node.checked = was.checked;
            else node.value = was.value;
        }
    }
    if (tab) {
        // Only if that tab still exists: a rebuild is allowed to remove one,
        // and forcing a pane that is gone would leave the window blank.
        const button = element.querySelector(`[data-drpg-gmt-tab="${tab}"]`);
        const pane = element.querySelector(`[data-drpg-gmt-section="${tab}"]`);
        if (button && pane) {
            for (const other of element.querySelectorAll("[data-drpg-gmt-tab]")) {
                other.classList.toggle("active", other === button);
            }
            for (const other of element.querySelectorAll("[data-drpg-gmt-section]")) {
                other.classList.toggle("active", other === pane);
            }
        }

        // The dashboard's own pair: the button carries `active`, the panel is
        // shown or hidden outright.
        const older = element.querySelector(`[data-drpg-tab="${tab}"]`);
        const olderPane = element.querySelector(`[data-drpg-panel="${tab}"]`);
        if (older && olderPane) {
            for (const other of element.querySelectorAll("[data-drpg-tab]")) {
                other.classList.toggle("active", other === older);
            }
            for (const other of element.querySelectorAll("[data-drpg-panel]")) {
                other.style.display = other === olderPane ? "" : "none";
            }
        }
    }
}

/* ==========================================================================
 * ONE OF EACH, NOT FOUR
 * --------------------------------------------------------------------------
 * Dawid, 28.08: opening the Sound window twice should not give you two Sound
 * windows. It did, and so did every other window in the module, because
 * `DialogV2.wait` builds a new application every time it is called and nothing
 * asked whether one was already up.
 *
 * Two copies of a window is not a cosmetic problem here. Both read the world
 * when they open and neither knows about the other, so the older one goes on
 * showing what was true a minute ago — and it looks exactly as authoritative as
 * the new one. Worse for the windows that WRITE: two Sound panels both holding
 * a copy of the map, and whichever is saved second wins, silently undoing
 * whatever was done in the first. Now that windows stay live (see `keepLive`)
 * the stale copy at least corrects itself, which makes the duplicate harder to
 * notice and no less able to overwrite.
 *
 * A window is identified by a class it declares. Not by its title, which is
 * translated and can repeat; not by the module storing "the Sound window", which
 * would be a second record of something the DOM already knows and would go
 * stale the first time a window closed some way we did not think of.
 * ========================================================================== */

/**
 * If this window is already open, raise it and say so.
 *
 * @param {string} className The window's own class, e.g. `"drpg-window-sound"`.
 * @returns {object|null} The application that was already open, or null.
 */
export function alreadyOpen(className) {
    try {
        for (const app of foundry.applications.instances.values()) {
            if (!app?.rendered) continue;
            // `rendered` alone is not enough: it can still be true while a
            // window is animating out, and raising a window on its way to the
            // bin would refuse the caller a window that is about to be gone.
            if (!app.element?.isConnected) continue;
            if (!app.options?.classes?.includes(className)) continue;
            // Raised rather than merely refused. A GM who presses the tile
            // again is telling us they want to look at that window, and the
            // reason they pressed twice is usually that it is behind something.
            app.bringToFront?.();
            return app;
        }
    } catch (err) {
        // Never let this stop a window opening. A duplicate is a nuisance; a
        // GM panel tile that does nothing is a broken module.
        debug("Could not check whether a window was already open", err);
    }
    return null;
}

/** What is currently keeping itself true. For the diagnostics window. */
export function diagnoseLive() {
    return [...living].map(r => ({
        window: r.app?.options?.window?.title ?? r.app?.constructor?.name ?? "?",
        region: r.region,
        openMs: Date.now() - r.at,
        refreshes: r.refreshes,
        deferred: r.deferred
    }));
}
