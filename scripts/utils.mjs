/**
 * Danganronpa RPG — shared helpers.
 */

import { MODULE_ID } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";

/** Console logging that stays quiet unless the client turned debug on. */
export function log(...args) {
    console.log(`${MODULE_ID} |`, ...args);
}

export function debug(...args) {
    let on = false;
    try {
        on = game.settings.get(MODULE_ID, SETTINGS.debug);
    } catch {
        // Settings not registered yet — stay quiet.
    }
    if (on) console.debug(`${MODULE_ID} |`, ...args);
}

/* ==========================================================================
 * THIS SESSION'S FAILURES
 * --------------------------------------------------------------------------
 * `error()` wrote to `console.error` and nowhere else — 181 call sites, all of
 * them invisible to anybody without DevTools open. Nobody has DevTools open
 * during a session. That is exactly how `moveProjectsTray is not defined`
 * survived a whole stage: it logged faithfully, every render, into a console
 * nobody was reading, while the feature it belonged to simply did not work.
 *
 * IN MEMORY, ON PURPOSE. "Only this session" is not a filter to write — it is
 * what an array in a module scope already is. Reload the page and the log is
 * empty, which is the correct answer: a failure from before the reload is not
 * something the GM can act on now, and a log that accumulates across weeks is a
 * log nobody opens.
 *
 * Capped, because a failure inside a render loop produces thousands. The cap
 * keeps the FIRST ones — the first occurrence is the one that explains the
 * cause; the ten thousandth only proves it kept happening — and counts repeats
 * instead of listing them.
 * ========================================================================== */

const SESSION_LOG_CAP = 60;
const sessionLog = [];

function record(level, args) {
    try {
        const message = args.map(a =>
            a instanceof Error ? a.message
            : typeof a === "string" ? a
            : (() => { try { return JSON.stringify(a); } catch { return String(a); } })()
        ).join(" ");

        // The same failure twice is one row with a count, not two rows. A hook
        // that throws on every token move would otherwise bury everything else
        // in the log within a minute.
        const last = sessionLog.find(e => e.level === level && e.message === message);
        if (last) {
            last.count += 1;
            last.at = Date.now();
            return;
        }
        if (sessionLog.length >= SESSION_LOG_CAP) return;

        const stack = args.find(a => a instanceof Error)?.stack ?? null;
        sessionLog.push({ level, message, stack, at: Date.now(), count: 1 });
    } catch {
        // A logger that throws while logging a throw is how a session ends.
    }
}

/** Everything this client has failed at since the page loaded, newest last. */
export function sessionFailures() {
    return sessionLog.map(e => ({ ...e }));
}

/** How many, for a badge. Repeats count once — they are one fault. */
export function sessionFailureCount() {
    return sessionLog.length;
}

export function clearSessionFailures() {
    sessionLog.length = 0;
}

export function warn(...args) {
    console.warn(`${MODULE_ID} |`, ...args);
    record("warn", args);
}

export function error(...args) {
    console.error(`${MODULE_ID} |`, ...args);
    record("error", args);
}

/** Ids of every GM user, active or not. */
export function gmIds() {
    return game.users.filter(u => u.isGM).map(u => u.id);
}

/** Ids of GMs who are actually connected. */
export function activeGmIds() {
    return game.users.filter(u => u.isGM && u.active).map(u => u.id);
}

/**
 * Exactly one client runs GM-side automation, so two GMs never both apply the
 * same effect.
 *
 * Full Gamemasters are preferred over Assistant GMs. `User#isGM` is true for
 * assistants too, so picking the lowest id across everyone with `isGM` can hand
 * the job to an assistant — and if that assistant is offline, or their id sorts
 * first while the real GM is the one running the game, the automation silently
 * never fires. Assistants are only used when no full GM is connected.
 */
export function isPrimaryGm() {
    return primaryGmId() === game.user.id && game.user.isGM;
}

/**
 * WHICH client runs GM-side automation, decided identically everywhere.
 *
 * Split out of `isPrimaryGm` because the answer is also needed by clients that
 * are not it: a player receiving a voice assignment has to be able to tell
 * whether it came from the one GM entitled to send it, and "any GM" is not the
 * same rule. Both sides computing it from the same user list is what keeps them
 * from disagreeing.
 *
 * @returns {string|null} User id, or null when no GM is connected.
 */
export function primaryGmId() {
    const full = game.users
        .filter(u => u.active && u.role === CONST.USER_ROLES.GAMEMASTER)
        .map(u => u.id)
        .sort();

    const pool = full.length ? full : activeGmIds().sort();
    return pool[0] ?? null;
}

/** The player user who owns this actor, if any. */
/**
 * "an evident trace", not "a evident trace".
 *
 * Five strings in this module glued the article to a word substituted in
 * afterwards, and the words they substitute are a closed set that happens to
 * contain `evident`, `obvious`, `incident` and `autopsy` — so the sentence came
 * out wrong roughly half the time it was printed.
 *
 * The letter rule rather than the sound rule ("an hour", "a unicorn") because
 * the vocabulary here is closed and contains no such word. It is only ever
 * asked about a Remnant visibility or a Truth Bullet type.
 */
export function article(word) {
    return /^[aeiou]/i.test(String(word ?? "").trim()) ? "an" : "a";
}

/**
 * "1 item destroyed", not "1 item(s) destroyed".
 *
 * Foundry has no pluralisation of its own — `game.i18n.format` substitutes and
 * nothing else, which is why thirty-eight strings in this module were carrying
 * a bracketed `(s)` and printing it at the table. So each of those keys is a
 * pair, `.one` and `.other`, and this picks between them.
 *
 * `Intl.PluralRules` rather than `n === 1`, because the pair is a category and
 * not a number: a translation into a language with three or six forms adds the
 * keys it needs and this finds them, falling back to `.other` for any category
 * the file does not carry.
 *
 * @param {string} key      The pair's base key, without `.one` / `.other`.
 * @param {object} data     Substitutions, as for `game.i18n.format`.
 * @param {string} countOn  Which field decides the form. Nearly always `n`.
 */
export function plural(key, data = {}, countOn = "n") {
    const n = Number(data[countOn] ?? 0);
    let form = "other";
    try {
        form = new Intl.PluralRules(game.i18n?.lang || "en").select(n);
    } catch {
        // An unknown language tag is the only way this throws, and the answer is
        // not to give up on the sentence — English's own rule is one/other, and
        // it is right for the language the strings are actually written in.
        // Silent on purpose: a bad tag would otherwise log once per counted
        // string, which is several times per render.
        form = n === 1 ? "one" : "other";
    }
    const picked = game.i18n.has(`${key}.${form}`) ? form : "other";
    return game.i18n.format(`${key}.${picked}`, data);
}

/**
 * The scene the GM is actually working on.
 *
 * `game.scenes.active` is a world flag — whichever scene was last marked
 * "active" for player navigation, which a GM building next chapter's map
 * leaves pointed at the CURRENT one while they work on the NEXT. Season setup
 * used to read `game.scenes.active` for its "rooms" step and told the GM their
 * freshly-drawn regions did not exist, because the scene showing on their own
 * canvas was not the one the flag named.
 *
 * `canvas?.scene` — what is actually rendered — is what a GM configuring rooms
 * means by "this scene", so it wins whenever there is one. The world flag is
 * only the fallback for code running with no canvas at all.
 */
export function workingScene() {
    return canvas?.scene ?? game.scenes.active ?? null;
}

export function ownerOf(actor) {
    if (!actor) return null;
    return game.users.find(u => !u.isGM && u.active && actor.testUserPermission(u, "OWNER"))
        ?? game.users.find(u => !u.isGM && actor.testUserPermission(u, "OWNER"))
        ?? null;
}

/**
 * Marks a chat message as this module's own.
 *
 * The popup layer needs to know which messages are ours so it can raise them in
 * the middle of the screen as well as dropping them in the log — and "ours" is
 * not something that can be sniffed from the content. Half of these messages
 * are a bare `<h3>` and a paragraph with no distinguishing markup at all.
 *
 * So it is stamped at the source, in the three helpers below that every
 * module-generated message goes through. See popup.mjs.
 */
export const MESSAGE_FLAG = "drpgMessage";

/** Merge our marker into a ChatMessage payload without disturbing its flags. */
function stamped(data = {}) {
    const payload = foundry.utils.mergeObject(
        data,
        { flags: { [MODULE_ID]: { [MESSAGE_FLAG]: true } } },
        { inplace: false }
    );

    // Daggerheart 2.6.5's own `DhpChatMessage.migrateData` reads
    // `source.rolls.length` without checking that it is there, and a message
    // created without dice has no `rolls` in its source at all — the schema
    // fills that in later. Every announcement and whisper this module posts
    // threw two migration errors into the console because of it. Handing it an
    // empty array costs nothing and is what the field would have become.
    if (payload.rolls === undefined) payload.rolls = [];
    return payload;
}

/**
 * Post a module message to the whole table.
 *
 * A thin wrapper over `ChatMessage.create` that exists purely so public
 * announcements carry the same marker the whispers do. Anything the module says
 * out loud — a time of day, a Despair Call, an OBJECTION — goes through here.
 */
export async function announce(data = {}) {
    return ChatMessage.create(stamped(data));
}

/**
 * Whisper to an actor's owner alone — no GM copy.
 *
 * For the notes that exist to tell the PLAYER what just happened, at moments
 * when the whole point is that the GM's screen stays quiet: an Eclipse
 * crossing card names the room somebody walked into, and during an Eclipse
 * nobody is told who went where — the GM reads the placement table when they
 * want the answer, they do not get it pushed at them move by move.
 *
 * With no player owner the card goes to the acting user instead: somebody
 * moved that token, and a whisper list with nobody on it would post publicly.
 */
export async function whisperToOwnerOnly(actor, content, extra = {}) {
    const owner = ownerOf(actor);
    return ChatMessage.create(stamped({
        content,
        speaker: actor ? ChatMessage.getSpeaker({ actor }) : undefined,
        whisper: [owner?.id ?? game.user.id],
        ...extra
    }));
}

/** Whisper to an actor's owner plus every GM. */
export async function whisperToOwner(actor, content, extra = {}) {
    const owner = ownerOf(actor);
    const ids = gmIds();
    if (owner) ids.push(owner.id);
    return ChatMessage.create(stamped({
        content,
        speaker: actor ? ChatMessage.getSpeaker({ actor }) : undefined,
        whisper: Array.from(new Set(ids)),
        ...extra
    }));
}

/** Whisper to GMs only. */
export async function whisperToGms(content, extra = {}) {
    return ChatMessage.create(stamped({
        content,
        whisper: gmIds(),
        ...extra
    }));
}

/**
 * Pick the highest threshold entry whose `min` the roll total reaches.
 * Returns null when the roll misses every threshold.
 *
 * @param {number} total                Roll total.
 * @param {Array<{min:number}>} tiers   Ascending list of thresholds.
 */
export function resolveThreshold(total, tiers) {
    let hit = null;
    for (const tier of tiers) {
        if (total >= tier.min) hit = tier;
    }
    return hit;
}

/** Clamp helper. */
export function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

/**
 * Write a document flag as a REPLACEMENT rather than a merge.
 *
 * `setFlag` is `update({flags: {scope: {key: value}}})`, and `update` is
 * recursive — so writing `{actionKey: "listen"}` over a stored
 * `{actionKey: "search", itemId: "abc", gmRuled: true}` leaves `itemId` and
 * `gmRuled` sitting there. Anything that treats a flag as "the current state of
 * one thing" rather than "a bag of accumulated properties" needs the other
 * behaviour.
 *
 * The roll bookmark needed it most, and its own comment claimed it already had
 * it. It did not: once any GM-ruled action had run, `gmRuled: true` was welded
 * onto the flag for good, and `replayAction` checks that field BEFORE it
 * switches on the action — so every later Reroll, of any action, was diverted
 * into "ask the GM again" and silently replayed nothing. The player paid 3 Hope
 * for it. Stale `itemId`, `projectId` and `remnantId` were attributed the same
 * way, to actions that never produced them.
 *
 * Foundry v14 expresses replacement with a ForcedReplacement operator, which
 * does it in one write. The unset/set pair is the fallback for a build without
 * it — correct, just two round trips.
 */
export async function replaceFlag(doc, key, value) {
    if (!doc) return null;
    const Operator = foundry.data?.operators?.ForcedReplacement;
    if (Operator) {
        const replacement = Operator.create ? Operator.create(value) : new Operator(value);
        return doc.update({ flags: { [MODULE_ID]: { [key]: replacement } } });
    }
    await doc.unsetFlag(MODULE_ID, key);
    return doc.setFlag(MODULE_ID, key, value);
}

/**
 * Dialog content Foundry will not strip.
 *
 * `DialogV2` runs a string `content` through `cleanHTML`, whose attribute
 * allow-list does not include `placeholder` on a `<textarea>`. Every prompt in
 * this module that explained itself through a placeholder — describe your
 * Dynamic action, write the new rule, name the project — was rendering an empty
 * box with no hint at all, on every client, silently.
 *
 * An `HTMLElement` is trusted instead of cleaned, so building the same markup
 * into a detached `<div>` gets it through intact. The element must be a bare
 * `<div>` with no attributes; that is what DialogV2 checks for.
 *
 * @param {string} markup
 * @returns {HTMLDivElement}
 */
export function dialogContent(markup) {
    const div = document.createElement("div");
    div.innerHTML = markup;
    return div;
}

/**
 * `DialogV2.wait`, for a window built around a table — sized to fit its own
 * table, automatically, with no resize handle.
 *
 * WHY NOT CSS, AND WHY NOT A DRAG HANDLE. Two earlier attempts at this failed
 * in ways worth recording, because both looked correct in the stylesheet:
 *
 *   · `width: max-content !important` on the window. `!important` outranks an
 *     inline style, and both the resize handle AND ApplicationV2's own layout
 *     write inline widths — so the rule fought whatever the application had
 *     just decided, and an intrinsic width on a frame that already has a pixel
 *     width left the overflowing columns invisible AND unreachable.
 *   · a manual resize handle as the escape hatch. That is a workaround asking
 *     the GM to fix the window every time they open it, for a size the module
 *     can simply measure.
 *
 * So the window is measured after render instead: the table states its natural
 * width in the DOM (`width: max-content` on the TABLE, which is where that
 * belongs), this reads it back and sets the window to exactly that, clamped to
 * the viewport. A table narrower than the default opens narrow; a wide one
 * opens wide; nothing has to be dragged, and the one case that still cannot
 * fit — a table wider than the screen — scrolls inside `.window-content`,
 * which is what its `overflow: auto` is for.
 *
 * `options.window` and `options.position` still win over these defaults, and
 * a caller's own `render` runs untouched before the measurement.
 */
export function tableDialog(options) {
    const DialogV2 = foundry.applications.api.DialogV2;
    const callerRender = options.render;

    return DialogV2.wait({
        ...options,
        // `drpg-table-window` is not decoration: it is what keeps the default
        // width rule in danganronpa.css — which carries `!important` — from
        // matching this window and overriding the measured width. See the note
        // on that rule. Appended to whatever the caller asked for, so nobody
        // has to remember it at the call site.
        classes: [...(options.classes ?? []), "drpg-table-window"],
        // No handle: the size is derived, not chosen. A handle here would only
        // ever be used to correct a size this function should have got right.
        window: { resizable: false, ...options.window },
        // `height: auto` lets the window take its content's height, which the
        // 80vh cap on `.window-content` then bounds — so a long table scrolls
        // rather than growing off the bottom of the screen.
        position: { height: "auto", ...options.position },
        render: (event, dialog) => {
            try {
                callerRender?.(event, dialog);
            } catch (err) {
                error("A table dialog's own render hook failed", err);
            }
            fitWindowToTable(dialog);
        }
    });
}

/**
 * Set a dialog's width to the widest table it actually contains.
 *
 * Deferred one animation frame: at `render` time the content is in the DOM but
 * has not necessarily been laid out, and `scrollWidth` before layout reports
 * the pre-layout width — which is how a measured-fit window ends up the wrong
 * size in exactly the cases that need it most (the widest tables).
 *
 * `scrollWidth` rather than `getBoundingClientRect().width`: the table is the
 * thing overflowing its container, and the bounding box reports the CLIPPED
 * width, i.e. the number we already have. `scrollWidth` is the full one.
 *
 * Exported for the one window that changes which table is showing after
 * render: Room Setup's tabs each hold their own table, and a window fitted to
 * the first tab is the wrong size for every other. A hidden table measures
 * zero, so calling this again after a switch fits exactly the visible one.
 */
export function fitWindowToTable(dialog) {
    const root = dialog?.element;
    if (!root) return;

    // TWO frames, not one. One `requestAnimationFrame` gets us past the point
    // where the markup is in the DOM, but ApplicationV2 also sets the window's
    // own position after render, and a fonts-still-loading table remeasures
    // once its real face arrives. Measuring on the second frame lands after
    // both, which is the difference between fitting the table and fitting the
    // fallback font's idea of it.
    requestAnimationFrame(() => requestAnimationFrame(() => {
        try {
            const content = root.querySelector(".window-content");
            if (!content) return;

            let widest = 0;
            for (const table of content.querySelectorAll("table")) {
                // `scrollWidth` is an integer and rounds DOWN, which on a table
                // whose columns land on fractional pixels is exactly enough to
                // clip the last one. `getBoundingClientRect().width` keeps the
                // fraction, and is the larger of the two whenever the table is
                // not being clipped, so taking the max of both is right in
                // either case.
                widest = Math.max(widest, table.scrollWidth, table.getBoundingClientRect().width);
            }
            if (!widest) return;                       // no table: leave it alone

            const styles = getComputedStyle(content);
            const padding = (parseFloat(styles.paddingLeft) || 0)
                + (parseFloat(styles.paddingRight) || 0)
                + (parseFloat(styles.borderLeftWidth) || 0)
                + (parseFloat(styles.borderRightWidth) || 0);

            // The window frame itself is wider than its content box. Measuring
            // the difference rather than guessing a constant: the frame carries
            // its own border and padding, and a hard-coded fudge factor is what
            // makes a window look right in one theme and clipped in another.
            const frame = Math.max(0, root.getBoundingClientRect().width - content.clientWidth);

            // Two pixels of slack so a table measured at exactly its container's
            // width does not round into a scrollbar it does not need.
            const wanted = Math.ceil(widest + padding + frame) + 2;

            const cap = Math.round((window.innerWidth || 1200) * 0.94);
            const width = Math.min(wanted, cap);

            // Nothing to do when we are already there — `setPosition` triggers
            // a re-render, and re-rendering on every open for no change is how
            // a window ends up flickering.
            if (Math.abs(root.getBoundingClientRect().width - width) < 2) return;

            dialog.setPosition({ width, height: "auto" });
        } catch (err) {
            // A window that did not resize is readable; one that threw here
            // would take the whole dialog down with it.
            debug("Could not fit a table window to its table", err);
        }
    }));
}

/**
 * A `<style>` element carrying the select picker's row states — a workaround,
 * not a stylistic choice, and worth the paragraph:
 *
 * The module's stylesheet reaches the page through Foundry's
 * `@import … layer(modules)`, and Chromium 146–148 PAINTS a `base-select`
 * picker's checked row from everything EXCEPT that kind of sheet: computed
 * style reports the module's colour, the pixels show the browser's own pale
 * highlight. Measured on 2026-08-26 with three probes — the same rule
 * injected as a `<style>` element paints correctly on a fresh open, with or
 * without `!important`, layered or not; from the imported sheet it never
 * does. So the row-state declarations live twice: canonically in
 * danganronpa.css (which wins the cascade and serves every browser that
 * paints correctly), and here as an element rules-copy for the paint path
 * that loses them. Values are the same three, with palette literals as
 * fallbacks so nothing here depends on where variables resolve from.
 * See "OPAQUE ROWS, DELIBERATELY" in danganronpa.css for why they are opaque.
 */
export function injectSelectPickerSkin() {
    if (document.getElementById("drpg-select-picker-skin")) return;
    const GROUP = ":is(.drpg-projects, .drpg-panel, .drpg-advance, .drpg-messenger, "
        + ".drpg-summary-dialog, :where(.application.sheet.actor, .application.roll-selection))";
    const style = document.createElement("style");
    style.id = "drpg-select-picker-skin";
    style.textContent = `
        ${GROUP} select option {
            background: var(--drpg-ink, #1d1a21);
            color: var(--drpg-bone, #e4ded8);
        }
        ${GROUP} select option:hover,
        ${GROUP} select option:focus {
            background: color-mix(in srgb, var(--drpg-bone, #e4ded8) 12%, var(--drpg-ink, #1d1a21));
        }
        ${GROUP} select option:checked {
            background: color-mix(in srgb, var(--drpg-gold, #ffd23f) 18%, var(--drpg-ink, #1d1a21));
        }
    `;
    document.head.append(style);
}

/**
 * Wire a portrait picker to the dialog's real, mounted DOM.
 *
 * `content` is handed to `DialogV2.wait` as a detached `<div>`, but DialogV2's
 * own `_initializeApplicationOptions` immediately reads `content.innerHTML`
 * and throws the element itself away — the dialog is rebuilt from that string,
 * so a click listener attached to the original element is attached to a node
 * that never joins the page. This is documented in Foundry's own dialog.mjs:
 * "the element will get stringified, so any listeners ... will not carry
 * forward to the dialog; you must still use the `render` option." Attaching
 * from `render`, against `dialog.element`, is what actually keeps the click
 * live — attaching beforehand is exactly why the button did nothing.
 *
 * Expects `<img data-drpg-portrait="{id}">` (or a bare `data-drpg-portrait`
 * for a single-image form) beside `<input type="hidden" name="img.{id}">`
 * (or `name="img"`) — the same markup `projects-ui.mjs` and
 * `investigation.mjs` both build their portrait cells from.
 */
export function wirePortraitPickers(root, { defaultImg = null } = {}) {
    for (const portrait of root.querySelectorAll("[data-drpg-portrait]")) {
        if (portrait.dataset.drpgWired) continue;
        portrait.dataset.drpgWired = "1";

        const id = portrait.dataset.drpgPortrait || null;
        const hiddenSelector = id ? `[name="img.${CSS.escape(id)}"]` : '[name="img"]';

        portrait.addEventListener("click", () => {
            const hidden = root.querySelector(hiddenSelector);
            new foundry.applications.apps.FilePicker.implementation({
                type: "image",
                current: hidden?.value || defaultImg || "",
                callback: path => {
                    portrait.src = path;
                    if (hidden) hidden.value = path;
                }
            }).render(true);
        });
    }
}
