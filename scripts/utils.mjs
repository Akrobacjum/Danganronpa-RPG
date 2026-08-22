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
    return foundry.utils.mergeObject(
        data,
        { flags: { [MODULE_ID]: { [MESSAGE_FLAG]: true } } },
        { inplace: false }
    );
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
 * `DialogV2.wait`, for a window built around a table.
 *
 * The CSS in the DIALOGS section of danganronpa.css already grows a window
 * with a table in it up to the table's own width, capped at 94vw — but a GM on
 * a small screen, or a table that only gets wide once a few rows come in,
 * still needs to be able to drag the window bigger by hand. Foundry's own
 * `window.resizable` is what that costs, and forgetting it on any one of the
 * module's table windows was easy: it is a flag on the caller, not something
 * the content decides, so nothing in the markup itself catches the omission.
 *
 * One function, called wherever a table dialog opens, replaces that with
 * "forget it in one place". `options.window` still wins over the default —
 * this hands out a default, it does not reshape what a caller asks for — and
 * every other option (`content`, `buttons`, `classes`, `render`, …) passes
 * through untouched.
 */
export function tableDialog(options) {
    const DialogV2 = foundry.applications.api.DialogV2;
    return DialogV2.wait({
        ...options,
        window: { resizable: true, ...options.window }
    });
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
