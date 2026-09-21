/**
 * Danganronpa RPG - shared helpers.
 */

import { MODULE_ID } from "./config.mjs";
import { SETTINGS, moduleLanguage } from "./settings.mjs";

/**
 * Escape a value for HTML, treating null and undefined as empty (C3).
 *
 * This lived as a local closure in twenty-one files, thirty-three times,
 * always spelled the same way and occasionally with a different parameter
 * name. One definition means one place to change if escaping ever has to do
 * more than it does today.
 *
 * The `?? ""` is the whole difference from `foundry.utils.escapeHTML` on its
 * own, and it is why those two are NOT interchangeable: bare
 * `escapeHTML(null)` prints the word "null" into somebody's card. A dozen
 * places alias the bare one deliberately and are left as they are.
 */
export const esc = value => foundry.utils.escapeHTML(String(value ?? ""));

/** Console logging that stays quiet unless the client turned debug on. */
export function log(...args) {
    console.log(`${MODULE_ID} |`, ...args);
}

export function debug(...args) {
    let on = false;
    try {
        on = game.settings.get(MODULE_ID, SETTINGS.debug);
    } catch {
        // Settings not registered yet - stay quiet.
    }
    if (on) console.debug(`${MODULE_ID} |`, ...args);
}

/* ==========================================================================
 * THIS SESSION'S FAILURES
 * --------------------------------------------------------------------------
 * `error()` wrote to `console.error` and nowhere else - 181 call sites, all of
 * them invisible to anybody without DevTools open. Nobody has DevTools open
 * during a session. That is exactly how `moveProjectsTray is not defined`
 * survived a whole stage: it logged faithfully, every render, into a console
 * nobody was reading, while the feature it belonged to simply did not work.
 *
 * IN MEMORY, ON PURPOSE. "Only this session" is not a filter to write - it is
 * what an array in a module scope already is. Reload the page and the log is
 * empty, which is the correct answer: a failure from before the reload is not
 * something the GM can act on now, and a log that accumulates across weeks is a
 * log nobody opens.
 *
 * Capped, because a failure inside a render loop produces thousands. The cap
 * keeps the FIRST ones - the first occurrence is the one that explains the
 * cause; the ten thousandth only proves it kept happening - and counts repeats
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
 * the job to an assistant - and if that assistant is offline, or their id sorts
 * first while the real GM is the one running the game, the automation silently
 * never fires. Assistants are only used when no full GM is connected.
 */
export function isPrimaryGm() {
    // `game.user` is null for the first and last moments of a client's life,
    // and socket packets arrive in both.
    return Boolean(game.user?.isGM) && primaryGmId() === game.user.id;
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
 * contain `evident`, `obvious`, `incident` and `autopsy` - so the sentence came
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
 * Threshold bands lowered by a readied tool's relief. One copy, read by the
 * action that rolls and by the Reroll that scores the same dice again: two
 * copies scored a rerolled Work on Project against the raw bands (ROLL-04).
 */
export function easedBy(thresholds, relief) {
    if (!relief) return thresholds;
    return thresholds.map(band => ({ ...band, min: Math.max(0, band.min - relief) }));
}

/**
 * "1 item destroyed", not "1 item(s) destroyed".
 *
 * Foundry has no pluralisation of its own - `game.i18n.format` substitutes and
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
        // The MODULE's language, not Foundry's: the strings come from our
        // file, and a Polish file carries one/few/many/other.
        form = new Intl.PluralRules(moduleLanguage()).select(n);
    } catch {
        // An unknown language tag is the only way this throws, and the answer is
        // not to give up on the sentence - English's own rule is one/other, and
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
 * `game.scenes.active` is a world flag - whichever scene was last marked
 * "active" for player navigation, which a GM building next chapter's map
 * leaves pointed at the CURRENT one while they work on the NEXT. Season setup
 * used to read `game.scenes.active` for its "rooms" step and told the GM their
 * freshly-drawn regions did not exist, because the scene showing on their own
 * canvas was not the one the flag named.
 *
 * `canvas?.scene` - what is actually rendered - is what a GM configuring rooms
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

/** Every non-GM user who owns this actor, by id - the plural of `ownerOf`. */
export function ownerIdsOf(actor) {
    if (!actor) return [];
    return game.users.filter(u => !u.isGM && actor.testUserPermission(u, "OWNER")).map(u => u.id);
}

/**
 * Marks a chat message as this module's own.
 *
 * The popup layer needs to know which messages are ours so it can raise them in
 * the middle of the screen as well as dropping them in the log - and "ours" is
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
    // created without dice has no `rolls` in its source at all - the schema
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
 * out loud - a time of day, a Despair Call, an OBJECTION - goes through here.
 */
export async function announce(data = {}) {
    // A CARD WITH A `whisper` LIST IS A PRIVATE CARD, wherever it was posted
    // from. `announce` is the module's general-purpose poster and about a third
    // of its callers hand it recipients - the death of a character told to the
    // people in the room, a GM's ruling, an incident cancelled because a fourth
    // person walked in. Routing on the presence of the list rather than on the
    // call site means a new caller cannot forget.
    return privately(stamped(data));
}

/**
 * Whisper to an actor's owner alone - no GM copy.
 *
 * For the notes that exist to tell the PLAYER what just happened, at moments
 * when the whole point is that the GM's screen stays quiet: an Eclipse
 * crossing card names the room somebody walked into, and during an Eclipse
 * nobody is told who went where - the GM reads the placement table when they
 * want the answer, they do not get it pushed at them move by move.
 *
 * With no player owner the card goes to the acting user instead: somebody
 * moved that token, and a whisper list with nobody on it would post publicly.
 */
export async function whisperToOwnerOnly(actor, content, extra = {}) {
    const owner = ownerOf(actor);
    return privately(stamped({
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
    return privately(stamped({
        content,
        speaker: actor ? ChatMessage.getSpeaker({ actor }) : undefined,
        whisper: Array.from(new Set(ids)),
        ...extra
    }));
}

/** Whisper to GMs only. */
export async function whisperToGms(content, extra = {}) {
    return privately(stamped({
        content,
        whisper: gmIds(),
        ...extra
    }));
}

/**
 * THE ONE PLACE THIS MODULE'S PRIVATE NARRATION IS POSTED.
 *
 * A whisper is a courtesy, not a secret: Foundry delivers every chat message to
 * every connected client and hides the ones you are not addressed on. Measured
 * on a player's browser after a fresh reload - 717 messages, the same count as
 * the GM's, including "You lift X out of Player A's pocket. Nobody saw you do
 * it." So the sentence travels by addressed socket and lives in a client-scoped
 * store; the card itself stays exactly where it was. See secret.mjs.
 *
 * Imported lazily because utils.mjs is imported by everything, secret.mjs
 * imports settings.mjs, and a cycle here would be paid on every module load.
 *
 * A private card with no recipients falls back to an ordinary create rather
 * than being dropped: eighty call sites reach these three functions and one of
 * them, some day, will be a table with no GM connected and no owner for the
 * actor. Losing the card entirely would be a worse answer than posting it the
 * way it was posted before this file existed.
 */
async function privately(payload) {
    if (!payload.whisper?.length) {
        // `veiled` is secret.mjs's word, not a ChatMessage field.
        delete payload.veiled;
        return ChatMessage.create(payload);
    }
    const { postSecret } = await import("./secret.mjs");
    return postSecret(payload);
}

/**
 * The header every card in this module skims by.
 *
 *     Search - Dinner Hall - 14 - Tier 2
 *     action   where          roll  what came of it
 *
 * WHY THIS IS A FUNCTION NOW. The four-slot grammar was written for the action
 * result cards and lived inside `report()` in action-rolls.mjs, which meant
 * exactly ONE of the module's 134 chat cards had it. The other hundred and
 * thirty-three opened with a hand-built `<p><strong>Label</strong> - value</p>`
 * - the same grammar, narrower, and with none of the weighting that makes the
 * first one skimmable: the action loud, the room dim, the total tabular, the
 * outcome in the colour of what happened. A log you have to read card by card
 * is the thing the header was built to fix, and it only fixed a twelfth of it.
 *
 * A slot with nothing in it is DROPPED rather than dashed, so a card with no
 * room does not claim one, and a header with no slots at all returns an empty
 * string rather than an empty rule across the card.
 *
 * Everything is escaped here. Call sites pass raw strings - several of the ones
 * this replaced escaped some of their values and not others.
 *
 * @param {object}  slots
 * @param {string}  slots.action  what was done. The one slot worth being loud.
 * @param {?string} slots.room    where, when the card knows and the body below
 *                                does not already say so in a sentence.
 * @param {?(number|string)} slots.total  a roll total, to compare against a DC.
 * @param {?string} slots.result  the short answer - a tier, "Critical", a price.
 * @param {?string} slots.resultKind  what KIND of answer, when the caller knows:
 *   `"evidence"` for something found, `"critical"` for a critical. The slot was
 *   documented as taking "the colour of what happened" and then painted one
 *   colour for everything, which is the same as taking none. Callers that
 *   cannot say leave it out and keep the neutral gold.
 * @param {?string} slots.trait   carried on the element, shown on hover.
 * @returns {string} the `<p>`, or "" when there is nothing to put in it.
 */
export function cardHead({ action = null, room = null, total = null, result = null, resultKind = null, trait = null } = {}) {
    const slots = [
        action ? `<span class="drpg-card-action">${esc(action)}</span>` : null,
        room ? `<span class="drpg-card-room">${esc(room)}</span>` : null,
        total != null && total !== "" ? `<span class="drpg-card-total">${esc(total)}</span>` : null,
        result
            ? `<span class="drpg-card-result"${
                resultKind ? ` data-kind="${esc(resultKind)}"` : ""}>${esc(result)}</span>`
            : null
    ].filter(Boolean);

    if (!slots.length) return "";
    return `<p class="drpg-card-head"${trait ? ` data-trait="${esc(trait)}"` : ""}>${
        slots.join('<span class="drpg-card-sep">-</span>')}</p>`;
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
 * recursive - so writing `{actionKey: "listen"}` over a stored
 * `{actionKey: "search", itemId: "abc", gmRuled: true}` leaves `itemId` and
 * `gmRuled` sitting there. Anything that treats a flag as "the current state of
 * one thing" rather than "a bag of accumulated properties" needs the other
 * behaviour.
 *
 * The roll bookmark needed it most, and its own comment claimed it already had
 * it. It did not: once any GM-ruled action had run, `gmRuled: true` was welded
 * onto the flag for good, and `replayAction` checks that field BEFORE it
 * switches on the action - so every later Reroll, of any action, was diverted
 * into "ask the GM again" and silently replayed nothing. The player paid 3 Hope
 * for it. Stale `itemId`, `projectId` and `remnantId` were attributed the same
 * way, to actions that never produced them.
 *
 * Foundry v14 expresses replacement with a ForcedReplacement operator, which
 * does it in one write. The unset/set pair is the fallback for a build without
 * it - correct, just two round trips.
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
 * this module that explained itself through a placeholder - describe your
 * Dynamic action, write the new rule, name the project - was rendering an empty
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
 * `DialogV2.wait`, for a window built around a table - sized to fit its own
 * table, automatically, with no resize handle.
 *
 * WHY NOT CSS, AND WHY NOT A DRAG HANDLE. Two earlier attempts at this failed
 * in ways worth recording, because both looked correct in the stylesheet:
 *
 *   · `width: max-content !important` on the window. `!important` outranks an
 *     inline style, and both the resize handle AND ApplicationV2's own layout
 *     write inline widths - so the rule fought whatever the application had
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
 * fit - a table wider than the screen - scrolls inside `.window-content`,
 * which is what its `overflow: auto` is for.
 *
 * `options.window` and `options.position` still win over these defaults, and
 * a caller's own `render` runs untouched before the measurement.
 */
/* ==========================================================================
 * TEXT FIELDS
 * ========================================================================== */

/** Anything somebody types prose into. */
const TEXT_FIELD = 'input[type="text"], input[type="search"], input:not([type]), textarea';

/**
 * Nothing typed into a module window is lost to the window closing.
 *
 * TWO FAILURES, ONE ROOT (Dawid, 31.08). A field that saves itself does it on
 * `change` or `focusout`, and both of those need the browser to move focus
 * first. A footer button does not wait for that: the window is torn down inside
 * the click, and the edit dies with the DOM it was sitting in. Measured in Item
 * tables: typed "ZZ lost on close?", pressed Close, the table still held the
 * old text.
 *
 * `pointerdown` in the CAPTURE phase runs before the focus change and before
 * the click, so blurring here is simply making the commit that was always going
 * to happen happen while there is still a window to happen in. It costs nothing
 * on a window that collects its fields on Apply instead.
 *
 * THE SECOND HALF IS ENTER, and it is narrower on purpose. A field carrying
 * `data-drpg-field` saves itself, and those rows sit inside the dialog's own
 * form - so Enter submitted whatever the footer lists first ("Add an item", in
 * the window this was reported from) and threw the text away. There, Enter
 * means the field.
 *
 * THE THIRD RULE IS A FIELD THAT NAMES A BUTTON (`data-drpg-enter`, MM-02,
 * 20.09) - see the note on it below. A field carrying neither marker is still
 * left exactly as it was: the browser already fires `change` before the submit,
 * and stealing Enter from a one-field prompt would break the thing it is trying
 * to protect.
 */
export function guardTextFields(root) {
    if (!root || root.dataset.drpgTextGuard) return false;
    root.dataset.drpgTextGuard = "1";

    root.addEventListener("pointerdown", ev => {
        // `document.activeElement`, not `:focus`. Measured on 14.365: in a
        // window that does not hold the operating system's focus - a second
        // monitor, a background tab, anything clicked away from mid-sentence -
        // activeElement is still the field and `:focus` matches nothing at all.
        // Those are exactly the moments somebody leaves text unsaved.
        const focused = document.activeElement;
        if (!focused || !root.contains(focused)) return;
        if (focused === ev.target || focused.contains?.(ev.target)) return;
        if (!focused.matches?.(TEXT_FIELD)) return;
        focused.blur();
    }, true);

    root.addEventListener("keydown", ev => {
        if (ev.key !== "Enter") return;
        const field = ev.target?.closest?.("[data-drpg-field]");
        if (!field || field.tagName === "TEXTAREA") return;
        ev.preventDefault();
        field.blur();
    });

    /*
     * AND THE THIRD RULE: A FIELD MAY NAME THE BUTTON ENTER MEANS (MM-02, 20.09).
     *
     * The Mastermind window is the case. Its give-Hope fieldset is a select, a
     * number and a `type="button"` button, and the window's footer starts with
     * Apply - so Enter in the amount pressed APPLY. DialogV2 renders every footer
     * button as a submit (`_renderHTML` puts the content and the footer in one
     * form, and the footer's buttons carry no `type`), and HTML implicit
     * submission picks the FIRST submit in tree order whatever carries `default`,
     * which is the trap this module has already paid for twice.
     *
     * So: the field says which button Enter is for, and this presses that one.
     * `data-drpg-enter` holds the selector, looked up inside the field's own
     * fieldset or form first so two copies of a row cannot press each other's
     * button, and then across the window for a field that sits in neither.
     *
     * FOCUS MOVES TO THE BUTTON BEFORE THE CLICK, and that is not tidiness.
     * `keepLive` defers a rebuild while focus is inside the region it is about to
     * replace (see `isEditing`), so pressing the button with the caret still in
     * the number would have written the Hope and left the readout showing the old
     * figure until the GM clicked away - a donation that looks like it did
     * nothing, and invites a second press.
     *
     * A disabled button is left alone: that is a window saying "not now", and
     * Enter is not a way around it.
     */
    root.addEventListener("keydown", ev => {
        if (ev.key !== "Enter") return;
        const field = ev.target?.closest?.("[data-drpg-enter]");
        if (!field || field.tagName === "TEXTAREA") return;
        const selector = field.dataset.drpgEnter;
        if (!selector) return;
        const near = field.closest("fieldset") ?? field.closest("form") ?? root;
        const button = near.querySelector(selector) ?? root.querySelector(selector);
        if (!button || button.disabled) return;
        ev.preventDefault();
        button.focus();
        button.click();
    });

    return true;
}


/**
 * One palette token, as a number PIXI can be handed (W-6, 20.09).
 *
 * `foundry.utils.Color.from` IS NOT THE ANSWER, and the comment that said it was
 * cost this the first time it was measured. On 14.365, asked directly:
 *
 *     "#ff8245"              -> 0xff8245      correct
 *     "#f82"                 -> 0xf82         WRONG, and silently: three-digit hex
 *                                             is not expanded, so it comes out as a
 *                                             near-black blue
 *     "rgb(255, 130, 69)"    -> NaN
 *     "rgba(255, 130, 69, 1)"-> NaN
 *     "  #ff8245  "          -> NaN           a trailing space is enough
 *     "orange"               -> NaN
 *
 * A NaN reaches PIXI as a colour and draws something nobody chose. The module's
 * palette happens to be six-digit hex throughout, which is why nothing has gone
 * wrong yet - but `--drpg-glass-accent` resolves to `rgb(87, 182, 255)` on a live
 * client, because the browser serialises a computed colour its own way, and that is
 * the token the Remnant rings and the own-token ring both want.
 *
 * READ OFF `body` FIRST, AND THAT ORDER IS THE SECOND THING THIS COST (20.09).
 * Custom properties inherit, so `body` already carries everything `:root` declares -
 * but the reverse is not true, and the palette is declared in both places: `:root`
 * holds the defaults and `body` holds the overrides. `--drpg-glass-accent` is the
 * case. Measured on a live client during an Investigation: `html` said
 * `rgb(255, 211, 143)`, the afternoon default from `:root`, while `body` said
 * `rgb(87, 182, 255)`, the phase the table was actually in. A reader that asked the
 * document element first drew every ring in yesterday's colour and looked right
 * doing it. `documentElement` stays as the fallback for a token somebody declares
 * there and nowhere else.
 */
export function cssColour(name, fallback = 0x8a8296) {
    try {
        const raw = (getComputedStyle(document.body).getPropertyValue(name)
            || getComputedStyle(document.documentElement).getPropertyValue(name)).trim();
        if (!raw) return fallback;

        const hex = raw.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
        if (hex) {
            const digits = hex[1].length === 3
                ? hex[1].split("").map(c => c + c).join("")
                : hex[1];
            return Number.parseInt(digits, 16);
        }

        const rgb = raw.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
        if (rgb) {
            const [r, g, b] = rgb.slice(1, 4).map(n => Math.max(0, Math.min(255, Math.round(Number(n)))));
            return (r << 16) + (g << 8) + b;
        }

        return fallback;
    } catch {
        return fallback;
    }
}

/**
 * Put the guard on every window this module opens.
 *
 * Scoped by class rather than by a list of windows: a window added next year
 * gets this for free, and Daggerheart's own dialogs are left alone. Verified on
 * 14.365 that `renderDialogV2` fires for our windows and hands over the element.
 */
export function registerTextGuard() {
    Hooks.on("renderDialogV2", (app, element) => {
        try {
            const root = element instanceof HTMLElement ? element : element?.[0];
            if (root?.querySelector('[class*="drpg-"]') || /\bdrpg-/.test(root?.className ?? "")) {
                guardTextFields(root);
            }
        } catch (err) {
            error("Could not guard a window's text fields", err);
        }
    });
    log("Text fields in module windows commit before their window closes.");
}

export function tableDialog(options) {
    const DialogV2 = foundry.applications.api.DialogV2;
    const callerRender = options.render;
    // A tabbed window measures every tab and settles on one size. Stripped out
    // rather than passed on: it is this helper's option, not DialogV2's.
    const { fitTabs = false, ...rest } = options;

    return DialogV2.wait({
        ...rest,
        // `drpg-table-window` is not decoration: it is what keeps the default
        // width rule in danganronpa.css - which carries `!important` - from
        // matching this window and overriding the measured width. See the note
        // on that rule. Appended to whatever the caller asked for, so nobody
        // has to remember it at the call site.
        classes: [...(rest.classes ?? []), "drpg-table-window"],
        // No handle: the size is derived, not chosen. A handle here would only
        // ever be used to correct a size this function should have got right.
        window: { resizable: false, ...rest.window },
        // `height: auto` lets the window take its content's height, which the
        // 80vh cap on `.window-content` then bounds - so a long table scrolls
        // rather than growing off the bottom of the screen.
        position: { height: "auto", ...rest.position },
        render: (event, dialog) => {
            try {
                callerRender?.(event, dialog);
            } catch (err) {
                error("A table dialog's own render hook failed", err);
            }
            if (fitTabs) fitWindowToTabs(dialog);
            else fitWindowToTable(dialog);
        }
    });
}

/**
 * Set a dialog's width to the widest table it actually contains.
 *
 * Deferred one animation frame: at `render` time the content is in the DOM but
 * has not necessarily been laid out, and `scrollWidth` before layout reports
 * the pre-layout width - which is how a measured-fit window ends up the wrong
 * size in exactly the cases that need it most (the widest tables).
 *
 * `scrollWidth` rather than `getBoundingClientRect().width`: the table is the
 * thing overflowing its container, and the bounding box reports the CLIPPED
 * width, i.e. the number we already have. `scrollWidth` is the full one.
 *
 * A window whose tabs each hold their own table wants `fitWindowToTabs` below
 * instead - one size for all of them, rather than this one re-run per switch.
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
            if (!widest) {
                /* NO TABLE, AND STILL A WINDOW THAT HAS TO HOLD WHAT IS IN IT.
                   The Look window is the case that showed it up: sliders, a select and a row of
                   switches, no table anywhere, so this measured nothing and left the window at
                   whatever `position.width` guessed - and under a wider face that was too narrow
                   for its own rows. What is measured instead is the overflow: if the content is
                   being clipped sideways, the window grows by exactly that much. GROW ONLY - a
                   window that already fits is left alone to the pixel, so nothing that looks
                   right today can get narrower. */
                const cs = getComputedStyle(content);
                const pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
                if (content.scrollWidth - content.clientWidth <= 1) return;
                widest = Math.max(0, content.scrollWidth - pad);
            }

            const width = windowWidthFor(root, content, widest);

            /*
             * Nothing to do when we are already there - `setPosition` triggers a
             * re-render, and re-rendering on every open for no change is how a window
             * ends up flickering.
             *
             * AND "ALREADY THERE" IS A BAND, NOT A POINT (LAT-05, 20.09). The width
             * above is the content plus two pixels of slack, so a window sitting at
             * exactly the width its table needs differs from the target by exactly 2 -
             * and `Math.abs(...) < 2` is false at exactly 2. The band is "wide enough
             * for the content, and no wider than the target", which is what the slack
             * was for in the first place.
             *
             * WHAT THE MEASUREMENT ACTUALLY FOUND, 20.09, because the audit's note on
             * this said every open forces a reflow and that is not what happens: a
             * fresh window opens at its stated width and is resized ONCE, which is the
             * fit doing its job - Item tables 0 resizes past the CSS width, Room setup
             * 1 (to 1259), the GM panel 0. Two frames after render the window carries
             * the identity transform and no running animation, so the rect below is the
             * layout width and measuring it is sound. This is the off-by-one on the
             * path where a window IS already at its target - a re-fit, or a tabbed
             * window sized from its widest tab - and nothing more than that.
             */
            const now = root.getBoundingClientRect().width;
            if (now >= width - 2 && now <= width) {
                return pinFooterAcrossScroll(dialog);
            }

            dialog.setPosition({ width, height: "auto" });
            /*
             * PINNED AT ONCE, AND AGAIN TWO FRAMES LATER. Belt AND braces, on
             * purpose - this is the one change here that could not be settled
             * headlessly.
             *
             * The note that used to sit here said the two frames were what let
             * the scrollport measure its NEW size: "pinned after a single frame,
             * the scrollport still measured the old size and the bar was told
             * there was nothing to stick to". Measured in Chromium (16.09):
             * reading `content.clientWidth` immediately after a width is written
             * returns the new width, 900 where the old one was 400, because the
             * read forces a layout flush that includes the write. One frame and
             * two frames give the same answer. So the flush is not what the
             * frames were buying.
             *
             * WHAT COULD NOT BE CHECKED FROM HERE is whether that still holds
             * through `ApplicationV2#setPosition({ height: "auto" })`, which
             * writes through Foundry rather than onto the element, and may race
             * Foundry's own post-render position write. jsdom cannot answer it -
             * it has no layout, `scrollWidth` is 0, and `pinFooterAcrossScroll`
             * returns early at `!scrolls`, so a headless test would pass by
             * measuring nothing. That is the `stackShapes` failure in CLAUDE.md
             * word for word.
             *
             * So both calls stay. The first settles the bar in the frame the
             * window is resized, which is worth roughly 170 ms of a window
             * visibly rearranging itself under the reader (two frames at the
             * 86 ms the curtain's blur costs a frame); the second is exactly
             * today's behaviour, kept as the net. `pinFooterAcrossScroll` is
             * idempotent and clears its own properties when nothing scrolls, so
             * an early call that reads a stale box does no harm and the late one
             * corrects it - the worst case is what the window does now.
             */
            pinFooterAcrossScroll(dialog);
            requestAnimationFrame(() =>
                requestAnimationFrame(() => pinFooterAcrossScroll(dialog)));
        } catch (err) {
            // A window that did not resize is readable; one that threw here
            // would take the whole dialog down with it.
            debug("Could not fit a table window to its table", err);
        }
    }));
}

/**
 * The window width that shows a table of `widest` pixels without clipping.
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
function windowWidthFor(root, content, widest) {
    const styles = getComputedStyle(content);
    const padding = (parseFloat(styles.paddingLeft) || 0)
        + (parseFloat(styles.paddingRight) || 0)
        + (parseFloat(styles.borderLeftWidth) || 0)
        + (parseFloat(styles.borderRightWidth) || 0);

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
     * it. The absolute cap is read from the stylesheet rather than written here,
     * because the stylesheet is what `.drpg-table-window` is capped by too and
     * two copies of one number is how they part company.
     *
     * AND THE LEFT EDGE IS NOT PART OF THE ANSWER ANY MORE. `viewport - here`
     * measured the room to the right of where the window happened to be - but
     * ApplicationV2 re-clamps `left` to `clientWidth - width` on every width
     * change, so a window that is about to grow is about to be moved back onto
     * the screen anyway. All that term did was make a window opened near the
     * right edge permanently narrower than the same window opened in the middle.
     */
    const cap = parseFloat(getComputedStyle(document.body)
        .getPropertyValue("--drpg-window-max")) || 1400;
    const ceiling = Math.min(Math.round(viewport * 0.94), Math.round(cap));
    return Math.min(wanted, ceiling);
}

/**
 * One size for a tabbed window, taken from its biggest tab.
 *
 * Room Setup holds a table behind each of its seven tabs (`ROOM_SETUP_TABS` in
 * vault.mjs; this said "five" until 16.09, and had been wrong since the sixth
 * was added) and they are nothing like each
 * other: Bedrooms is two columns, Fog is one column per room. Fitting the
 * window on every switch made it right for whichever tab was showing and made
 * the window itself jump - measured at 708px on Bedrooms and 1504 on Fog, on
 * the same screen, in one sitting. A GM comparing two tabs was watching the
 * window resize under them, and Dawid asked for the big one and no jumping
 * (26.08).
 *
 * So every tab is measured once, on open, and the window takes the largest -
 * which is Fog, by construction, since it grows a column per room.
 *
 * A hidden panel measures zero, so each is shown in turn for the measurement
 * and put back exactly as it was. Nothing is painted in between: this all runs
 * inside one animation-frame callback, and the browser paints after it, not
 * during it.
 *
 * The height cap is READ from the content's own computed `max-height` rather
 * than written here again - the 80vh lives in the stylesheet, and a copy of it
 * in this file is a second place for it to be wrong.
 */
export function fitWindowToTabs(dialog) {
    const root = dialog?.element;
    if (!root) return;

    requestAnimationFrame(() => requestAnimationFrame(() => {
        try {
            const content = root.querySelector(".window-content");
            if (!content) return;

            // BOTH tab mechanisms, because this module has two. Room Setup
            // rolls its own panels with `data-drpg-panel` and inline display;
            // every other tabbed window uses `panelTabs`, whose sections are
            // switched by a class. Measuring only the first meant `fitTabs:
            // true` silently fell through to `fitWindowToTable` on the second
            // - one tab measured instead of all of them, which is the exact
            // failure the option exists to prevent.
            const panels = [...content.querySelectorAll(
                "[data-drpg-panel], [data-drpg-gmt-section]")];
            if (!panels.length) return fitWindowToTable(dialog);

            const was = panels.map(panel => panel.style.display);
            let widest = 0;
            let tallest = 0;

            try {
                for (const shown of panels) {
                    for (const panel of panels) {
                        // `block`, not `""`. An empty string hands the element
                        // back to the stylesheet, and `.drpg-gmt-section` is
                        // `display: none` there unless it carries `.active` -
                        // so the panel being measured would measure as hidden.
                        panel.style.display = panel === shown ? "block" : "none";
                    }
                    for (const table of shown.querySelectorAll("table")) {
                        widest = Math.max(widest, table.scrollWidth,
                            table.getBoundingClientRect().width);
                    }
                    // Read off the CONTENT, not the panel: the intro line and
                    // the tab strip are part of what the window has to hold.
                    tallest = Math.max(tallest, content.scrollHeight);
                }
            } finally {
                panels.forEach((panel, i) => { panel.style.display = was[i]; });
            }

            if (!widest) return;

            const width = windowWidthFor(root, content, widest);
            const capped = parseFloat(getComputedStyle(content).maxHeight);
            const chrome = Math.max(0, root.getBoundingClientRect().height - content.clientHeight);
            const height = Math.round(
                Math.min(tallest, Number.isFinite(capped) ? capped : tallest) + chrome);

            const box = root.getBoundingClientRect();
            if (Math.abs(box.width - width) < 2 && Math.abs(box.height - height) < 2) {
                return pinFooterAcrossScroll(dialog);
            }

            dialog.setPosition({ width, height });
            // The same pair, for the reason written out at the end of
            // `fitWindowToTable` above - this is the tabbed twin of it.
            pinFooterAcrossScroll(dialog);
            requestAnimationFrame(() =>
                requestAnimationFrame(() => pinFooterAcrossScroll(dialog)));
        } catch (err) {
            debug("Could not fit a tabbed window to its tabs", err);
        }
    }));
}

/**
 * Keep a table window's button bar reachable when the window scrolls sideways.
 *
 * C-F5-8. `position: sticky; left: 0` is on the footer already and does nothing
 * on its own, for two reasons that have to be fixed together:
 *
 *   Sticky travels inside its CONTAINING BLOCK, and the footer's is the form -
 *   which takes the container's width while the table inside it runs far wider.
 *   Past the form's own width there is no block left to stick to.
 *
 *   And the footer FILLS that block. Widen the form and the footer widens with
 *   it; an element spanning its whole containing block has zero travel, so
 *   sticky has nothing to do and the bar rides the scroll anyway.
 *
 * WHY THIS IS SCRIPT AND NOT CSS. Both widths are conditional on something a
 * stylesheet cannot ask: whether this window actually scrolls sideways. Writing
 * `min-width: max-content` on every table form instead forced the Investigation
 * dashboard's table out of the 1470px it was comfortably compressed to, to its
 * full 1560 - inventing 90px of scroll in a window that had none, and pushing
 * that window's own buttons out of reach. Measured, and the reason this reads
 * the box rather than trusting a percentage: `max-width: 100%` on the footer
 * resolves against the widened form, not against the window anyone is looking
 * at, so it clamps to the wrong number by exactly the amount that matters.
 *
 * Idempotent, and it puts everything back when the overflow goes away, so a
 * window re-fitted after a resize does not keep a stale pin.
 */
export function pinFooterAcrossScroll(dialog) {
    const root = dialog?.element;
    if (!root) return;

    try {
        const content = root.querySelector(".window-content");
        const form = content?.querySelector("form");
        const footer = root.querySelector("footer.form-footer");
        if (!content || !form || !footer) return;

        // The scrollport, measured - this is the number the bar has to fit in.
        const port = content.clientWidth;
        const scrolls = content.scrollWidth > port + 1;

        if (!scrolls) {
            form.style.removeProperty("min-width");
            footer.style.removeProperty("width");
            footer.style.removeProperty("max-width");
            return;
        }

        // The form spans what scrolls, so there is somewhere to stick…
        form.style.minWidth = "max-content";
        // …and the bar is no wider than the window, so it has room to travel.
        // `fit-content(port)` in one property: as wide as the buttons need, and
        // never wider than what can be seen.
        footer.style.width = "max-content";
        footer.style.maxWidth = `${port}px`;
    } catch (err) {
        // A bar that did not get pinned is still a usable window at scroll 0.
        debug("Could not pin a table window's footer", err);
    }
}

/**
 * A `<style>` element carrying the select picker's row states - a workaround,
 * not a stylistic choice, and worth the paragraph:
 *
 * The module's stylesheet reaches the page through Foundry's
 * `@import … layer(modules)`, and Chromium 146–148 PAINTS a `base-select`
 * picker's checked row from everything EXCEPT that kind of sheet: computed
 * style reports the module's colour, the pixels show the browser's own pale
 * highlight. Measured on 2026-08-26 with three probes - the same rule
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
 * and throws the element itself away - the dialog is rebuilt from that string,
 * so a click listener attached to the original element is attached to a node
 * that never joins the page. This is documented in Foundry's own dialog.mjs:
 * "the element will get stringified, so any listeners ... will not carry
 * forward to the dialog; you must still use the `render` option." Attaching
 * from `render`, against `dialog.element`, is what actually keeps the click
 * live - attaching beforehand is exactly why the button did nothing.
 *
 * Expects `<img data-drpg-portrait="{id}">` (or a bare `data-drpg-portrait`
 * for a single-image form) beside `<input type="hidden" name="img.{id}">`
 * (or `name="img"`) - the same markup `projects-ui.mjs` and
 * `investigation.mjs` both build their portrait cells from.
 *
 * THE HIDDEN FIELD IS THE RECORD; THE `<img>` IS A VIEW OF IT. Both are written
 * when somebody picks a file, and the field is what a Save reads - so in a live
 * window, where a rebuild carries the field and redraws the picture, this puts
 * the picture back in step every time it is called. A caller in a live window
 * must call it again after each rebuild.
 */
export function wirePortraitPickers(root, { defaultImg = null } = {}) {
    for (const portrait of root.querySelectorAll("[data-drpg-portrait]")) {
        const id = portrait.dataset.drpgPortrait || null;
        const hiddenSelector = id ? `[name="img.${CSS.escape(id)}"]` : '[name="img"]';

        /*
         * THE HIDDEN FIELD IS THE RECORD AND THE PICTURE FOLLOWS IT (F13).
         *
         * In a live window the two disagree after every rebuild. `keepLive`
         * carries a field the person has touched across a redraw, and the hidden
         * field IS touched - so the chosen path survives, while the `<img>` beside
         * it is markup, redrawn from the ledger. The picture went back to the
         * hazard icon over a field that still held the new path, and a GM reads
         * that as "it did not take" and picks again.
         *
         * Before the wiring guard below, because this runs again after every
         * rebuild (`wireAll` in investigation.mjs) and that is the moment the two
         * have drifted apart.
         *
         * ONLY WHEN THE FIELD SAYS SOMETHING. tables.mjs draws its new-item
         * thumbnail from a default while `img.new` is deliberately EMPTY, so an
         * unguarded copy would blank a picture that is doing its job.
         *
         * `setAttribute` rather than `.src =`, so the comparison is between two
         * strings of the same kind: reading `.src` gives a resolved absolute URL
         * and the guard would fire on every call.
         */
        const stored = root.querySelector(hiddenSelector)?.value;
        if (stored && portrait.getAttribute("src") !== stored) {
            portrait.setAttribute("src", stored);
        }

        if (portrait.dataset.drpgWired) continue;
        portrait.dataset.drpgWired = "1";

        const open = () => {
            new foundry.applications.apps.FilePicker.implementation({
                type: "image",
                current: root.querySelector(hiddenSelector)?.value || defaultImg || "",
                callback: path => {
                    /*
                     * LOOKED UP WHEN THE ANSWER ARRIVES, NOT WHEN THE PICKER
                     * OPENED (F13). A picker stands open for as long as somebody
                     * takes to browse, and a live window rebuilds in that time -
                     * so nodes captured when it opened are usually detached by
                     * now, and writing to them threw the choice away silently.
                     * `root` is the dialog element and outlives every rebuild.
                     */
                    const live = root.querySelector(hiddenSelector);
                    if (live) live.value = path;
                    const shown = id
                        ? root.querySelector(`[data-drpg-portrait="${CSS.escape(id)}"]`)
                        : root.querySelector("[data-drpg-portrait]");
                    if (shown) shown.setAttribute("src", path);
                }
            }).render(true);
        };

        portrait.addEventListener("click", open);

        /*
         * AN <img> THAT DOES SOMETHING IS A CONTROL, AND IT WAS NOT ONE.
         * ---------------------------------------------------------------------
         * Audit 15.09. This is the only way to change a Project's, a trace's or
         * a table entry's picture, and until now it was an `<img alt="">` with a
         * click listener: not focusable, so unreachable by keyboard at all, and
         * marked decorative, so a screen reader skipped it in silence. Four call
         * sites build this markup (investigation.mjs, projects-ui.mjs twice,
         * tables.mjs) and every one of them had the same hole.
         *
         * WORSE, `game.drpg.a11y()` REPORTED IT CLEAN. Its sweep looks at
         * `button, a[href], [role=button], input, select, textarea` - an image
         * with a listener matches none of those, so the one tool built to find
         * nameless controls could not see this one. That is the failure this
         * repository opens its own notes with: a check that passes because it
         * measured nothing.
         *
         * Fixed here rather than at the four call sites for the reason a11y.mjs
         * gives for sweeping: an attribute added where the markup is written is
         * an attribute the NEXT portrait will not have. This function already
         * has to visit every one of them to attach the listener, so it is the
         * one place that cannot be forgotten.
         *
         * The name comes from the tooltip the markup already carries, and where
         * there is none from the module's own label - never invented, and never
         * left blank.
         */
        if (!portrait.getAttribute("role")) portrait.setAttribute("role", "button");
        if (!portrait.hasAttribute("tabindex")) portrait.setAttribute("tabindex", "0");
        if (!portrait.getAttribute("aria-label")) {
            const named = portrait.dataset.tooltip
                ?? portrait.getAttribute("title")
                ?? game.i18n.localize("DRPG.Project.changeImage");
            portrait.setAttribute("aria-label", named);
        }
        // Enter and Space, because that is what a button does and this now says
        // it is one. Space is prevented first: on a focusable element inside a
        // scrolling dialog its default is to page the window.
        portrait.addEventListener("keydown", event => {
            if (event.key !== "Enter" && event.key !== " " && event.key !== "Spacebar") return;
            event.preventDefault();
            open();
        });
    }
}

/**
 * A tabbed body for a GM-panel window: one bar, one pane per section, the
 * GM Team look everywhere it is used (Dawid, 26.08 - "if a GM panel window
 * has tabs, they look like GM Team's").
 *
 * Markup only; wire it from the dialog's `render` with `wirePanelTabs`, for
 * the same reason `wirePortraitPickers` documents above - DialogV2 stringifies
 * the content, so listeners must be attached to the mounted DOM.
 *
 * Every pane STAYS in the DOM whichever tab is showing: a hidden input still
 * answers a selector, so a single Save/Apply that reads the whole form keeps
 * working. That is the whole trick, and why switching is class-only.
 *
 * @param {Array<{key: string, label: string, html: string}>} sections
 * @returns {string} the nav and every section, ready to drop into a <form>.
 */
export function panelTabs(sections) {
    const nav = `<nav class="drpg-gmt-tabs">${sections.map((s, i) =>
        `<button type="button" data-drpg-gmt-tab="${s.key}"${i ? "" : ' class="active"'}>${s.label}</button>`).join("")}</nav>`;
    const panes = sections.map((s, i) =>
        `<section class="drpg-gmt-section${i ? "" : " active"}" data-drpg-gmt-section="${s.key}">${s.html}</section>`).join("");
    return nav + panes;
}

/**
 * Make a `panelTabs` bar switch its panes, and its FOOTER follow along.
 *
 *     wirePanelTabs(root, {
 *         buttons: { edit: [], newItem: ["add"], tiers: ["newPool", "install"] },
 *         always:  ["close"]
 *     });
 *
 * Without `buttons` this is what it always was: pure pane switching.
 *
 * WHY THE FOOTER IS THIS FUNCTION'S PROBLEM AT ALL.
 *
 * A DialogV2 has one footer for the whole window, so a four-tab window shows
 * all four tabs' buttons on all four tabs. In Item Tables that produced a
 * default button reading "Add an item" while the pane it reads from was not on
 * screen - the GM pressed the obvious button and the window answered about a
 * form they could not see. It is not that footer's bug: it is a gap here, and
 * the same gap was waiting for every tabbed window added afterwards.
 *
 * HIDDEN IS NOT ENOUGH, AND THAT IS THE WHOLE TRAP. Measured against
 * DialogV2 on 14.365: footer buttons are `type="submit"` inside the dialog's
 * form, and `_onKeyDown` intercepts Escape only - so Enter goes through the
 * browser's implicit submission, which picks the FIRST SUBMIT BUTTON IN TREE
 * ORDER and does not care whether it is visible. `autofocus` (which is all
 * `default: true` sets) does not decide it either. A hidden button therefore
 * still answers the Enter key. It has to be DISABLED as well, because the spec
 * skips a disabled default button and nothing else in the chain does.
 *
 * Assumes the footer's buttons are not disabled for reasons of their own -
 * true everywhere this is used, and `_onSubmit` restores its own temporary
 * disabling from a snapshot, so a submit mid-switch cannot strand one.
 *
 * @param {HTMLElement} root                the dialog element
 * @param {object}      [options]
 * @param {Object<string, string[]>} [options.buttons]  tab key → footer actions
 * @param {string[]}    [options.always]    actions shown on every tab
 */
export function wirePanelTabs(root, { buttons = null, always = [] } = {}) {
    const footerButtons = () =>
        root.querySelectorAll("footer.form-footer button[data-action]");

    const showButtonsFor = key => {
        if (!buttons) return;
        const allowed = new Set([...(buttons[key] ?? []), ...always]);

        let first = null;
        for (const button of footerButtons()) {
            const mine = allowed.has(button.dataset.action);
            button.hidden = !mine;
            button.disabled = !mine;
            button.removeAttribute("autofocus");
            if (mine && !first) first = button;
        }
        // Enter has to land somewhere sensible, and the leftmost surviving
        // button of the active tab is the one a person would have pressed.
        first?.setAttribute("autofocus", "");
    };

    for (const tab of root.querySelectorAll("[data-drpg-gmt-tab]")) {
        tab.addEventListener("click", () => {
            const key = tab.dataset.drpgGmtTab;
            for (const t of root.querySelectorAll("[data-drpg-gmt-tab]")) {
                t.classList.toggle("active", t === tab);
            }
            for (const pane of root.querySelectorAll("[data-drpg-gmt-section]")) {
                pane.classList.toggle("active", pane.dataset.drpgGmtSection === key);
            }
            showButtonsFor(key);
        });
    }

    // The window opens on a tab too, and that tab's footer has to be right
    // before anybody clicks anything.
    const active = root.querySelector("[data-drpg-gmt-tab].active")
        ?? root.querySelector("[data-drpg-gmt-tab]");
    if (active) showButtonsFor(active.dataset.drpgGmtTab);
}

/**
 * The other tab mechanism, wired once for the two windows that use it.
 *
 * Room Setup and the Investigation Dashboard switch panels by inline
 * `display` rather than by class, and there is a reason that is not
 * `panelTabs`: both are table windows measured by `fitWindowToTabs`, which
 * shows each panel in turn to size the window, and inline display is what it
 * measures. `panelTabs` is for form windows whose footer follows the tab. Two
 * mechanisms, then - but one wiring, because each window used to carry its own
 * copy of this loop (audit C3). `keepLive` knows both markups.
 *
 * @param {HTMLElement} root
 * @param {object} [options]
 * @param {(key: string) => void} [options.onSwitch]  After a tab is shown.
 */
export function wireDashboardTabs(root, { onSwitch = null } = {}) {
    const tabs = root.querySelectorAll("[data-drpg-tab]");
    const panels = root.querySelectorAll("[data-drpg-panel]");
    for (const tab of tabs) {
        tab.addEventListener("click", () => {
            for (const t of tabs) t.classList.toggle("active", t === tab);
            for (const p of panels) {
                p.style.display = p.dataset.drpgPanel === tab.dataset.drpgTab ? "" : "none";
            }
            onSwitch?.(tab.dataset.drpgTab);
        });
    }
}
