/**
 * Danganronpa RPG - windows that stay true while they are open.
 * ---------------------------------------------------------------------------
 * WHAT THIS IS FOR.
 *
 * Every window in this module reads world state and prints it. Almost all of
 * them read it ONCE, when they open, and then sit there - so a GM who opens the
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
 * and nowhere else, so a naive rebuild throws them away - and a rebuild that
 * eats a half-typed rule while the GM is looking at the keyboard is a worse bug
 * than the stale window it was meant to fix.
 *
 * Hence the two rules below, and they are the whole design:
 *
 *   1. NEVER REDRAW UNDER THE CURSOR. If focus is inside the region, the
 *      rebuild waits until focus leaves. Not "preserve the caret" - wait. A
 *      caret restored to character 14 of a field whose text changed underneath
 *      it is a subtler kind of wrong.
 *
 *   2. CARRY EVERYTHING THAT IS NOT PRINTED. Scroll positions, open `<details>`
 *      and the value of any field the user has touched are read off the old
 *      subtree and put back onto the new one, matched by a key that survives a
 *      rebuild (`name`, `data-drpg-key`, `id`, or failing those the element's
 *      position in the region).
 *
 * The safest regions are the ones that have no fields at all - a status block,
 * a row of tiles, a table of read-outs. Where a window is mostly a form, point
 * this at the read-out part and leave the form alone: a narrow live region is
 * worth more than a wide one that has to keep apologising.
 */

import { MODULE_ID, TIMING } from "./config.mjs";
import { debug, error } from "./utils.mjs";

/**
 * The events that mean "something a window might be printing has changed".
 *
 * `updateSetting` covers every world setting this module owns, which is where
 * nearly all of its state lives. The two module hooks cover the case that
 * setting alone does not: a change that arrived over the sync socket on a
 * client that did not write it, where no local setting update fires.
 *
 * Actor hooks are opt-in (`watch.actors`) because they are noisy - a Daggerheart
 * roll writes an actor several times - and most windows print nothing off one.
 */
// The phase has its own hook since E17 C6 (sync.mjs): `drpgTimeOfDayChanged` is the calendar's alone, and a window
// that prints the phase - the GM panel's - hears it here (audit S01-30).
const WORLD_HOOKS = ["drpgTimeOfDayChanged", "drpgEclipseChanged", "drpgPhaseChanged"];
const ACTOR_HOOKS = ["updateActor", "createActor", "deleteActor"];
const TOKEN_HOOKS = ["createToken", "deleteToken", "updateToken"];
const ITEM_HOOKS = ["createItem", "deleteItem", "updateItem"];
/* What lets go of a press (rule 1, for a hand). Heard on the page's window, in the capture phase, so a press that
   ends outside the module's window - or on the page's window itself - still ends, as the trial console's own hold
   hears its release (trial-floor-ui.mjs, E70 fix p1-G3); `lostpointercapture` for a control that captured the pointer
   and lost it. Heard on the document instead, a release dispatched on the page's window never reached it, and the
   console's tick stood still (measured on the suite's "the console holds Enter while an Objection runs", 04.11). */
const RELEASES = ["pointerup", "pointercancel", "lostpointercapture"];
/* A press is forgotten after this long whatever, as the trial console forgets its own (5 s there too): a release no
   listener heard - the pointer let go over another frame, a tab switched under it - would otherwise hold the region
   for good. */
const HOLD_MAX_MS = 5000;

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
 *                                   still found - which means `build` must
 *                                   return an element carrying the same class.
 * @param {Function} options.build   Returns the replacement: markup, or a node.
 * @param {object}  [options.watch]  `{ actors, tokens, items, settings, settingKeys, stores, hooks }`.
 * @param {number}  [options.delay]  Debounce, ms.
 * @param {Function}[options.after]  Run after a successful rebuild, with the new
 *                                   element - for anything the region needs that
 *                                   markup alone cannot carry.
 * @returns {Function} Stop listening. Idempotent; also called automatically
 *                     when the window closes or the region goes away.
 */
export function keepLive(app, { region, build, watch = {}, delay = TIMING.coalesceMs, after = null } = {}) {
    if (!app || typeof build !== "function" || !region) return () => {};

    const record = { app, region, at: Date.now(), refreshes: 0, deferred: 0, watch, build };
    living.add(record);

    let stopped = false;
    /* Set when a refresh was wanted but the GM was typing inside the region.
     * The pending redraw is not queued as a timer - it is answered by the
     * `focusout` listener below, because "when they stop typing" is an event
     * and not a duration. */
    let pending = false;
    /* RULE 1, FOR A HAND (E44 C2b, 04.11.2026; audit S10-58). A press is not a focus: a GM's
     * click on a GM panel tile, at the moment any module setting was written, met a region
     * rebuilt between its `pointerdown` and its `click` - the button pressed was gone, and the
     * window's delegated listener never heard the click (`contains` of a node no longer in it).
     * So a `pointerdown` inside the region holds it until the press is let go (RELEASES); a
     * rebuild wanted meanwhile waits, as one under focus does, and is answered ONCE at the
     * release - after it, on the next turn of the event loop, because the browser sends `click`
     * after `pointerup` and the click must reach the node it was pressed on. A press outside the
     * region holds nothing. Measured headless only, on events the harness dispatches (R1316,
     * E44-T1); a real pointer at a table is not measured yet (the stage's live row
     * for it is not in AUDIT 9.2). */
    let held = false;
    let heldWanted = false;
    let holdTimer = null;

    const root = () => app.element ?? null;
    const target = () => root()?.querySelector(region) ?? null;

    /**
     * @param {boolean} [force] Skip the focus check because the caller already
     *   knows focus has left - see `onFocusOut`, which is told where focus went
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

        // RULE 1, FOR A HAND. A press inside the region is not let go yet; the release answers this.
        if (held) {
            heldWanted = true;
            record.deferred++;
            debug(`live: ${region} deferred - a press inside it is not let go`);
            return;
        }

        // RULE 1. The GM is typing in here; come back when they are not.
        if (!force && isEditing(element)) {
            pending = true;
            record.deferred++;
            debug(`live: ${region} deferred - focus is inside it`);
            return;
        }

        try {
            const carried = capture(element);
            const next = toElement(build());
            if (!next) return;
            heldWanted = false;
            element.replaceWith(next);
            restore(next, carried);
            record.refreshes++;
            if (after) after(next);

            /*
             * AND THE NEW NODES ARE DRESSED (LAT-14, 20.09).
             *
             * chrome.mjs decorates a window at render: the select glyphs, the
             * numeric column alignment, the table rules. It has listened for
             * `drpgWindowUpdated` since it was written - "a window that redraws part
             * of itself keeps its decorations, because the pass is idempotent and
             * marks what it has done" - and NOTHING IN THE MODULE HAS EVER FIRED
             * THAT HOOK. Read from source, 20.09: one listener, zero callers.
             *
             * So every live region in the module came back undressed: the case
             * dashboard after a filter change, the trial console on every tick, the
             * Players table after a death. That is what LAT-14 reported on one window,
             * and it is one line for all of them.
             *
             * After `after`, so a region that wires its own controls has done it
             * before anything decorates them, and the decoration sees the finished
             * DOM.
             */
            Hooks.callAll("drpgWindowUpdated", next);
        } catch (err) {
            // A region that cannot rebuild itself must not take the window down
            // with it, and must not keep trying every 120ms forever.
            error(`live: could not refresh "${region}"`, err);
            stop();
        }
    };

    const schedule = foundry.utils.debounce(rebuild, delay);

    const listeners = listenFor(watch, schedule);

    /* RULE 1's other half. Without this a deferred refresh waits for the next
     * world change, which may never come - so the GM finishes typing and the
     * window stays stale with no event left to wake it.
     *
     * `relatedTarget` IS THE ANSWER, AND ASKING FOR A FRAME WAS NOT.
     *
     * The question here is "did focus leave the region, or move within it" -
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

    const view = () => root()?.ownerDocument?.defaultView ?? window;
    const release = () => {
        if (!held) return;
        held = false;
        clearTimeout(holdTimer);
        for (const name of RELEASES) view().removeEventListener(name, release, true);
        if (!heldWanted) return;
        // After the release's own turn: `click` comes after `pointerup`, and must find the pressed node.
        setTimeout(() => rebuild(), 0);
    };
    const onPointerDown = event => {
        if (held || stopped) return;
        const element = target();
        if (!element?.isConnected || !event.target?.nodeType || !element.contains(event.target)) return;
        held = true;
        holdTimer = setTimeout(release, HOLD_MAX_MS);
        for (const name of RELEASES) view().addEventListener(name, release, true);
    };
    root()?.addEventListener("pointerdown", onPointerDown, true);

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
        root()?.removeEventListener("pointerdown", onPointerDown, true);
        for (const name of RELEASES) view().removeEventListener(name, release, true);
        clearTimeout(holdTimer);
        held = false;
        living.delete(record);
    }

    /*
     * REDRAW ON DEMAND, as well as when the world moves.
     *
     * A filter is a change to what the window should show that no document
     * hook will ever report - nothing in the world changed, the reader did.
     * Hanging it on the same rebuild is what keeps one path: the same capture
     * of scroll, folded sections, half-typed fields and which tab is showing.
     *
     * Attached to `stop` rather than returned beside it so every existing
     * caller - all of which use the return value as a function - is untouched.
     */
    stop.refresh = () => rebuild(true);
    return stop;
}

/**
 * What `keepLive` and `keepFresh` listen to, for both: the world hooks, the opt-in
 * document hooks, this module's settings and the GM stores a window names. It was
 * written out twice, once in each, until the stores joined it (E09 C3).
 *
 * @returns {Array<[string, number]>} Hook name and id, for `Hooks.off`.
 */
function listenFor(watch, schedule) {
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
        const key = setting?.key ?? "";
        /* A KEY THAT IS NOT OURS, NAMED IN FULL.

           The filter below exists so a window does not redraw because some other
           module saved a preference, and it was right until something of ours was
           stored somewhere else: a project IS a Daggerheart countdown, kept in
           `daggerheart.Countdowns`, so every write to one was filtered out as
           somebody else's business. `settingKeys` is the way to say "this one too",
           and it takes the whole key because that is what makes it a deliberate
           exception rather than a wider net. */
        if (watch.settingKeys?.includes(key)) return schedule();
        if (!key.startsWith(`${MODULE_ID}.`)) return;
        if (watch.settings && !watch.settings.includes(key.split(".").pop())) return;
        schedule();
    })]);

    /* A GM STORE IS A CLIENT SETTING, AND `updateSetting` NEVER HEARS ONE (E09 C3, S05-26).
       The trace ledger and the Key plan live in GM stores (gm-stores.mjs), whose rows each GM's
       browser keeps in a client setting: a write fires `clientSettingChanged` with the full key
       and no `updateSetting` at all. So the case dashboard, which watched settings, stood on a
       reshape another GM approved until it was closed - and its Save then wrote the old words
       back. `watch.stores` names the stores by their handles (gm-stores.mjs), and the key
       is the handle's own (`spec.key`): a SETTINGS name of a store handed anywhere outside
       the engine is what R171 looks for.
       Measured on the harness, 08.10.2026: a store write on this browser and another GM's
       write merged in here both fire it, because the merge is flushed to the setting as well
       (gm-store.mjs `touched`) - scenario 62, phase D. */
    if (watch.stores?.length) {
        const keys = watch.stores.map(store => `${MODULE_ID}.${store.spec.key}`);
        listeners.push(["clientSettingChanged", Hooks.on("clientSettingChanged", key => {
            if (keys.includes(key)) schedule();
        })]);
    }
    return listeners;
}

/**
 * Is the person looking at this window in the middle of using it?
 *
 * Focus inside a text field, a select being chosen from, or something
 * contenteditable - all three are reasons to leave the DOM alone. A focused
 * BUTTON is not: a button keeps focus after it is pressed, and a window whose
 * buttons freeze it the moment anybody clicks one is the stale window again
 * with extra steps.
 *
 * NOR IS AN INPUT THAT IS PRESSED RATHER THAN TYPED IN (E44 C2a, 04.11.2026;
 * audit S01-34). A checkbox keeps focus after its click exactly as a button
 * does, and until this list every focused INPUT counted as typing: the
 * Investigation dashboard's Faint box, once ticked, held its whole region until
 * the GM clicked somewhere else. The types below take a press, a pick or a
 * drag, never a caret, so a rebuild cannot lose anybody's place in one - and
 * what they hold is carried (rule 2) when it was changed. `range` and `image`
 * are beyond the audit's list: a slider is dragged, an image input is a button.
 */
const PRESSED_INPUTS = new Set(["checkbox", "radio", "button", "submit", "reset", "color", "file", "range", "image"]);

function isEditing(element) {
    const active = document.activeElement;
    if (!active || !element.contains(active)) return false;
    const tag = active.tagName;
    if (tag === "INPUT") return !PRESSED_INPUTS.has(String(active.type ?? "").toLowerCase());
    if (tag === "TEXTAREA" || tag === "SELECT") return true;
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
 * the right way round - a scroll position restored into the wrong box is worse
 * than one that was not restored.
 *
 * A NAME IS NOT ALWAYS ONE FIELD (E44 C2a, 04.11.2026; audit S01-34). Every
 * radio of a group shares its name, so keyed by the name alone the group's
 * radios were one entry: each dirty radio overwrote the last, and `restore`
 * checked them all in turn, leaving the group on its LAST radio whatever the
 * person picked. A radio is keyed by its name and its value; and a key that
 * still occurs twice in the region (two fields of one name, two radios of one
 * value) takes its index among the fields of that key, so two fields never
 * share a value. `named` is that reading, made once per region by `keysOf`:
 * a field's key depends on its neighbours, so it cannot be read off the field.
 * The index is positional within the key and holds as the positional fallback
 * does - while the region's shape holds.
 */
function keyFor(element, root, named = null) {
    const field = named?.get(element);
    if (field) return field;
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

/** Every named element of the region and its key (see `keyFor`), read in one pass. */
function keysOf(root) {
    const fields = [...root.querySelectorAll("[name]")].filter(node => node.getAttribute("name"));
    const bases = fields.map(node => {
        const name = node.getAttribute("name");
        return node.tagName === "INPUT" && node.type === "radio" ? `n:${name}=${node.value}` : `n:${name}`;
    });
    const total = new Map();
    for (const base of bases) total.set(base, (total.get(base) ?? 0) + 1);
    const seen = new Map();
    const named = new Map();
    fields.forEach((node, i) => {
        const base = bases[i];
        if (total.get(base) === 1) return named.set(node, base);
        const index = seen.get(base) ?? 0;
        seen.set(base, index + 1);
        named.set(node, `${base}#${index}`);
    });
    return named;
}

/**
 * Everything about this region that is not in the markup.
 *
 * Dirty fields only. A field showing what the world says is rebuilt with what
 * the world says NOW, which is the entire point of the refresh; a field the GM
 * has typed into is theirs and is put back untouched. `defaultValue` and
 * `defaultChecked` are the browser's own record of what the markup said, so
 * "has the user changed this" needs no bookkeeping of ours - and with each dirty
 * field goes what it was drawn from (`drawnOf`), so `restore` can tell a field
 * the world moved under from one it did not (E09 C3).
 */
function capture(element) {
    const scrolls = new Map();
    const opens = new Map();
    const dirty = new Map();
    const marks = new Map();
    const named = keysOf(element);

    if (element.scrollTop || element.scrollLeft) {
        scrolls.set("self", [element.scrollTop, element.scrollLeft]);
    }
    for (const node of element.querySelectorAll("*")) {
        if (node.scrollTop || node.scrollLeft) {
            scrolls.set(keyFor(node, element, named), [node.scrollTop, node.scrollLeft]);
        }
    }
    for (const node of element.querySelectorAll("details")) {
        opens.set(keyFor(node, element, named), node.open);
    }
    for (const node of element.querySelectorAll("input, textarea, select")) {
        if (isDirty(node)) dirty.set(keyFor(node, element, named), { value: heldIn(node), drawn: drawnOf(node) });
    }
    /* A SAVE'S MARKER IS CARRIED AS A DIRTY FIELD IS (E44 C2b, 04.11.2026). A row that saves as
       it is changed says so on a marker (`data-drpg-save`, drawn empty: saving, saved, failed -
       the Sound window's Music rows). Its state is something the person did, not something the
       markup prints, so a rebuild in the middle of a save - the save's own echo redraws the rows
       it was made from - would otherwise draw the marker empty again. Matched by `data-drpg-key`,
       which the marker carries; only a marker the new markup draws empty takes it back. */
    for (const node of element.querySelectorAll("[data-drpg-save]")) {
        if (node.dataset.drpgSave) marks.set(keyFor(node, element, named), { state: node.dataset.drpgSave, text: node.textContent });
    }

    /*
     * WHICH TAB IS SHOWING, and it belongs here for the same reason a folded
     * section does: it is a thing the person did to the window and the markup
     * does not carry it. A rebuild that drops the GM back onto the first tab
     * while they are reading the fourth is the cure being worse than the stale
     * window - rule 2, in the shape tabs take.
     *
     * ONE SHAPE since E44 C4a: the kit's bar (ui-kit.mjs `kitTabs`), the
     * shown tab `aria-selected`, its pane without `hidden`. Until then there
     * were two - a class on the button and the section, and the case
     * dashboard's older pair of a class and inline `display` - each read and
     * put back here. The kit's attributes are spelt here rather than imported:
     * the kit imports this file (R161).
     */
    const tab = element.querySelector('nav.drpg-tabs > button[role="tab"][aria-selected="true"]')?.dataset?.drpgTabKey ?? null;

    return { scrolls, opens, dirty, marks, tab };
}

/** Put back what `capture` took. Every step is optional and independent. */
function restore(element, { scrolls, opens, dirty, marks, tab }) {
    const named = keysOf(element);
    const self = scrolls.get("self");
    if (self) [element.scrollTop, element.scrollLeft] = self;

    if (scrolls.size > (self ? 1 : 0)) {
        for (const node of element.querySelectorAll("*")) {
            const seen = scrolls.get(keyFor(node, element, named));
            if (seen) [node.scrollTop, node.scrollLeft] = seen;
        }
    }
    if (opens.size) {
        for (const node of element.querySelectorAll("details")) {
            const was = opens.get(keyFor(node, element, named));
            if (was !== undefined) node.open = was;
        }
    }
    if (dirty.size) {
        for (const node of element.querySelectorAll("input, textarea, select")) {
            const was = dirty.get(keyFor(node, element, named));
            if (!was) continue;
            /* MOVED UNDER THE PERSON TYPING (E09 C3, S05-26). The new markup's default is
               what the world holds now. Where that is neither what this field was drawn
               from nor what they typed, somebody else changed the same field meanwhile:
               their value stays, the field keeps the default it was drawn from - so a Save
               that writes a field only where its drawn value is still the world's refuses
               it (investigation.mjs `applyDashboardSave`) - and it says what it was changed
               to. Where the world now holds what they typed, the field is simply clean. */
            const now = drawnOf(node);
            if (now !== was.drawn && now !== was.value) {
                setDrawn(node, was.drawn);
                node.classList.add("drpg-moved-under");
                node.title = game.i18n.format("DRPG.Live.movedUnder", { value: shownAs(node, now) });
            }
            if (node.type === "checkbox" || node.type === "radio") node.checked = was.value;
            else node.value = was.value;
        }
    }
    if (marks.size) {
        for (const node of element.querySelectorAll("[data-drpg-save]")) {
            const was = marks.get(keyFor(node, element, named));
            if (!was || node.dataset.drpgSave) continue;
            node.dataset.drpgSave = was.state;
            node.textContent = was.text;
        }
    }
    if (tab) {
        // Only if that tab still exists: a rebuild is allowed to remove one,
        // and forcing a pane that is gone would leave the window blank.
        // A bar whose tab loads its one pane (the handbooks, the messenger) has
        // no pane of that key, and is put back by its own window.
        const button = element.querySelector(`nav.drpg-tabs > button[role="tab"][data-drpg-tab-key="${CSS.escape(tab)}"]`);
        const pane = element.querySelector(`[data-drpg-pane="${CSS.escape(tab)}"]`);
        if (button && pane) {
            for (const other of element.querySelectorAll('nav.drpg-tabs > button[role="tab"][data-drpg-tab-key]')) {
                other.setAttribute("aria-selected", String(other === button));
            }
            for (const other of element.querySelectorAll("[data-drpg-pane]")) {
                other.hidden = other !== pane;
            }
        }
    }
}

/* ==========================================================================
 * WHAT A FIELD WAS DRAWN FROM
 * --------------------------------------------------------------------------
 * A form that stays open while the world moves has two values per field: what
 * it holds now and what the markup drew it from. `capture` carries the second
 * so a rebuild can tell an edit the world moved under from one it did not, and
 * a Save that writes only what the person changed reads the same two (the case
 * dashboard's, E09 C3). One definition here, so the carry and the Save cannot
 * disagree about which fields are dirty.
 * ========================================================================== */

/**
 * What the markup drew this field from: `defaultChecked` for a box, the
 * `selected` option for a select (the first, as a browser shows, when none is),
 * `defaultValue` for the rest. A hidden input has no default of its own - its
 * `value` IS its attribute - so one that a control writes (the portrait pickers'
 * `img.*`) states it in `data-drpg-drawn`.
 */
export function drawnOf(node) {
    if (node.dataset?.drpgDrawn !== undefined) return node.dataset.drpgDrawn;
    if (node.type === "checkbox" || node.type === "radio") return node.defaultChecked;
    if (node.tagName === "SELECT") {
        return ([...node.options].find(o => o.defaultSelected) ?? node.options[0])?.value ?? "";
    }
    return node.defaultValue;
}

/** What the field holds now: `checked` for a box, `value` for the rest. */
export function heldIn(node) {
    return node.type === "checkbox" || node.type === "radio" ? node.checked : node.value;
}

/** Has the person changed this field since it was drawn? */
export function isDirty(node) {
    if (node.dataset?.drpgDrawn !== undefined) return node.value !== node.dataset.drpgDrawn;
    if (node.type === "checkbox" || node.type === "radio") return node.checked !== node.defaultChecked;
    // Against the option drawn, not option by option: a select drawn with none `selected`
    // shows its first, and that one's `selected` differs from its default untouched.
    if (node.tagName === "SELECT") return node.value !== drawnOf(node);
    return node.value !== node.defaultValue;
}

/**
 * Give a field back the default it was drawn from. Before its value is put back,
 * always: setting a default on a field nobody has typed into moves its value too.
 */
function setDrawn(node, drawn) {
    if (node.dataset?.drpgDrawn !== undefined) node.dataset.drpgDrawn = drawn;
    else if (node.type === "checkbox" || node.type === "radio") node.defaultChecked = drawn;
    else if (node.tagName === "SELECT") for (const o of node.options) o.defaultSelected = o.value === drawn;
    else node.defaultValue = drawn;
}

/** A field's value as the person reads it: a box ticked or not, an option's label. */
function shownAs(node, value) {
    if (node.type === "checkbox" || node.type === "radio") {
        return game.i18n.localize(value ? "DRPG.Live.ticked" : "DRPG.Live.unticked");
    }
    if (node.tagName === "SELECT") {
        return [...node.options].find(o => o.value === value)?.textContent?.trim() || value;
    }
    return value;
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
 * showing what was true a minute ago - and it looks exactly as authoritative as
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
 * What an opener answers when the window it opens was already open and it raised it instead (E44 C2c,
 * 04.11.2026; audit S10-59). Not null: null is also what a dismissed window answers, and the GM panel,
 * which reopens itself after every tile, could not tell "the GM closed what this tile opened" from "this
 * tile raised a window that is still standing" - so it came back over the window it had just raised.
 * Every opener a panel tile runs answers this on its `alreadyOpen` branch (R1318), and the panel does
 * not come back when it is answered.
 */
export const RAISED = "raised";

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
            // Or folded to its title bar (E44 fix FG2, 05.11.2026; the end review's C-m1): since Q-E44-1 lifted the
            // module's block, a window can be folded, and raising the bar alone left the press doing nothing to see.
            // So it is unfolded first (`maximize`, Foundry's; not awaited, so this stays an answer the caller reads at
            // once), then raised. `minimized` and `maximize` as ApplicationV2's, read from memory and modelled by
            // the harness, not read on v14 (LIVE-E44-08).
            if (app.minimized) Promise.resolve(app.maximize?.()).catch(err => debug("Could not unfold a window", err));
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



/**
 * Open a window again from inside its own answer (LIVE-REOPEN-01, 20.09).
 *
 * MEASURED ON 14.365, because the whole thing turns on one microtask. Foundry's
 * `_onSubmit` awaits the submit handler - which is where `DialogV2.wait` resolves -
 * and calls `close()` on the NEXT line. So at the first statement after
 * `await DialogV2.wait(...)` the window is still `rendered`, its element is still
 * connected, and `alreadyOpen` refuses: a probe read `rendered: true`,
 * `isConnected: true`, `alreadyOpen: refuses`, and one tick later `refuses: false`.
 *
 * A branch that awaits ANYTHING first - a world write, another window, an import -
 * is therefore safe, and almost every reopen in this module does. The ones that do
 * not are the validation paths: a warning, then straight back to the window. Those
 * opened nothing and the old copy then closed, so the GM pressed a button, read a
 * warning and was left looking at the scene with their work gone.
 *
 * `animate: false` is deliberate: `close()` otherwise waits for a transition that
 * this module's own exit rule may not give it, which is a second per window for
 * nothing (see the ApplicationV2 note in the release history).
 *
 * The old copy is closed rather than reused, because the caller's whole reason for
 * reopening is that the window must be rebuilt from a world that has moved.
 */
export async function reopen(className, opener) {
    for (const app of [...foundry.applications.instances.values()]) {
        if (!app?.options?.classes?.includes(className)) continue;
        try {
            await app.close({ animate: false });
        } catch (err) {
            debug(`live: a window refusing to close before reopening "${className}"`, err);
        }
    }
    return opener();
}

/**
 * A window that closes in order to come back, as ONE promise (F7, 20.09).
 *
 * `DialogV2.wait` resolves the moment its window closes, whoever closed it - so a
 * row button that closes the window, runs a procedure and opens the window again
 * did all of that OUTSIDE the promise its caller was holding. The GM panel awaits
 * `item.run()`, that resolved on the close, and `openGmPanel()` ran while the GM
 * was still answering the dialog the row had opened: three windows for one action.
 *
 * NO `await` IN HERE, and that is the whole mechanism. The opener's continuation
 * is a microtask queued inside `close()`, so a round trip registered after an
 * `await` is registered too late - it has to be built in the same synchronous turn
 * as the close, which is why this takes the work as a callback instead of being
 * two lines at the call site.
 *
 * The work still runs AFTER the close resolves. That order is load-bearing:
 * `alreadyOpen` refuses a window whose element is still connected, so reopening
 * before the old copy has gone raises the dying window and opens nothing.
 *
 * It never rejects. A caller that forgets to hold the promise cannot produce an
 * unhandled rejection, and a window that failed to come back is a logged error
 * rather than a broken console. A window that would not close is logged, and the
 * work runs all the same, as `reopen` goes on to its opener (E31 review): the
 * work is what the GM pressed for - a row's procedure, the next step - and a
 * window left standing, raised again rather than reopened, is the smaller loss.
 *
 * WITHOUT ITS CLOSING TRANSITION (E31, 25.09.2026; audit S01-64), as `reopen`
 * closes: the work waits for the close, so a close that plays its animation made
 * every hand-over wait for it as well - up to a second, the theme's own exit rule
 * aside - for a window the GM has already finished with. Not measured headless:
 * the harness's windows close at once (LIVE-E31-05).
 *
 * The precedent is `openIncidentTracker`'s own refresh (murder-ui.mjs), which has
 * had this shape by hand since 11.09; this is that, named, so the next window can
 * have it in one line.
 */
export function handOff(dialog, work) {
    let closing;
    try {
        closing = Promise.resolve(dialog?.close?.({ animate: false }));
    } catch (err) {
        closing = Promise.reject(err);
    }
    return closing.catch(err => {
        error("A window handing over could not close; what it handed over to runs all the same", err);
    }).then(() => work()).catch(err => {
        error("A window that closed to hand over never came back", err);
        return null;
    });
}

/**
 * Keep something true WITHOUT replacing it.
 *
 * `keepLive` swaps a region out, which is the right answer when the region is a
 * read-out and the wrong one when it is part of a form: a swap discards whatever the
 * GM has typed but not applied, and takes every listener wired to the old nodes with
 * it. Room Setup is the case that needs this - one number per row is live, and the
 * same rows carry checkboxes that are only saved on Apply.
 *
 * So this is the same subscription with a different body: the caller writes whatever
 * it wants into the DOM it already has. Everything else is identical, including
 * stopping when the window closes, so nothing has to remember to unhook.
 *
 * NO FOCUS RULE HERE, and that is the point rather than an omission: writing a
 * number into a span cannot interrupt anybody, and deferring it would leave the one
 * thing this exists to keep true stale for exactly as long as the GM is reading the
 * window. Callers must only write nodes nobody edits.
 *
 * @param {object}   app            The application.
 * @param {Function} options.run    Called on every change. Given the window element.
 * @param {object}  [options.watch] `{ actors, tokens, items, settings, settingKeys, stores, hooks }`.
 * @param {number}  [options.delay] Debounce, ms.
 * @returns {Function} Stop listening.
 */
export function keepFresh(app, { run, watch = {}, delay = TIMING.coalesceMs } = {}) {
    if (!app || typeof run !== "function") return () => {};

    let stopped = false;
    const tick = () => {
        if (stopped) return;
        const root = app.element;
        if (!root?.isConnected) return stop();
        try {
            run(root);
        } catch (err) {
            error("live: a keepFresh watcher failed", err);
            stop();
        }
    };

    const schedule = foundry.utils.debounce(tick, delay);
    const listeners = listenFor(watch, schedule);

    const closeId = Hooks.on("closeApplicationV2", closed => {
        if (closed === app) stop();
    });

    function stop() {
        if (stopped) return;
        stopped = true;
        for (const [name, id] of listeners) Hooks.off(name, id);
        Hooks.off("closeApplicationV2", closeId);
    }

    return stop;
}

/**
 * Shut every copy of a window, because the thing it is about has stopped existing.
 *
 * The other half of `alreadyOpen`, and it identifies a window the same way and for the
 * same reasons. A live region keeps a window TRUE; it cannot decide that a window should
 * no longer be on screen at all, because "there is nothing here any more" is a sentence
 * about the world, not about the region - and the caller is the only one who knows it.
 *
 * Every copy, not the first: a second GM may have one open too, and on this client that
 * is a second entry in the same list.
 *
 * @param {string} className The window's own class, e.g. `"drpg-window-incident"`.
 * @returns {number} How many were closed.
 */
export function closeOpen(className) {
    let closed = 0;
    try {
        for (const app of [...foundry.applications.instances.values()]) {
            if (!app?.rendered || !app.element?.isConnected) continue;
            if (!app.options?.classes?.includes(className)) continue;
            // Not awaited, and the caller must not await it either: `close()` on a
            // DialogV2 resolves the promise its opener is sitting inside, and that opener
            // may well be further up this very call stack.
            app.close()?.catch?.(err => debug("Could not close a finished window", err));
            closed++;
        }
    } catch (err) {
        debug("Could not close a finished window", err);
    }
    return closed;
}

/**
 * The regions kept live on one window (every window, with none named): each one's selector, what wakes it and its
 * build. For R1317, which builds every region that names `watch.settings` once with `game.settings.get` counted, and
 * holds what it read to what it declared (E44 C2b): a region held to its keys must name every key it prints.
 */
export function liveRegions(app = null) {
    return [...living].filter(r => !app || r.app === app).map(r => ({ region: r.region, watch: r.watch, build: r.build }));
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
