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

export function warn(...args) {
    console.warn(`${MODULE_ID} |`, ...args);
}

export function error(...args) {
    console.error(`${MODULE_ID} |`, ...args);
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
