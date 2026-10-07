/**
 * Danganronpa RPG - each roll's dice as they were thrown, kept on the primary GM,
 * and a player's rewrite of them put back.
 * ---------------------------------------------------------------------------
 * UNTIL E08+E28 C8 (03.10.2026) THIS FILE WROTE RECEIPTS (E03, 24.09.2026; audit
 * S10-40). A Reroll ran in the roller's browser and took its action back with
 * packets that said `undo`, and the primary GM took one only when the same player
 * had rewritten the rolls of a message of the same character a few minutes before.
 * Since C4a the Reroll is asked of the GM and made there, undo and all, so no honest
 * player packet carries an undo, and C8 refuses every one (bridge-guards.mjs
 * `guardUndoIsTheGms`). Nothing was left for a receipt to pay for, and the receipts
 * went with the guards that spent them.
 *
 * WHAT IS KEPT INSTEAD (S02-19). A player can still rewrite the rolls of a roll
 * message of their own: Daggerheart's chat menu offers its author a free "Reroll",
 * and a console can do the same. Every reader of the card - the GM's check of a
 * total against it (E28) among them - would read the new dice. So the primary GM
 * keeps each roll message's rolls as it saw them created (`firstOf`, bounded, the
 * oldest forgotten first), and when a user who is not a GM rewrites them it puts
 * them back, on every browser, and tells the GMs. A GM's write is what the roll
 * stands on from then on: the GM's own Reroll (reroll.mjs), the put-back itself.
 * A message the primary did not see created - thrown before this GM loaded - has
 * nothing kept to put back: the GMs are told, and the rewrite stands.
 *
 * And the menu's two reroll entries are taken off a player's menu
 * (`dropDaggerheartRerolls`). The hook's name, `getChatMessageContextOptions`,
 * follows the two this module already listens to (`getActorContextOptions`,
 * `getUserContextOptions`); no Foundry source is in this checkout and no browser
 * ran it, so it is not measured (LIVE-E08-05).
 *
 * In memory on the primary, as the receipts were: a GM who reloads keeps nothing
 * of the rolls thrown before, and a rewrite of one of them is only told.
 */

import { isPrimaryGm, whisperToGms, debug, error } from "./utils.mjs";
import { dualityOfRoll } from "./reroll.mjs";
import { rollSubjectNow, REROLL_SHOWN } from "./private-rolls.mjs";
import { recordTrace } from "./sheet-audit.mjs";

/** messageId -> { rolls, withFear }: the rolls each roll message stands on, as source data. */
const firstOf = new Map();
/** Enough for a long session's rolls; the oldest are forgotten first. */
const FIRST_KEPT = 300;
/** `${messageId}|${userId}|${key}` of the warnings already given: a loop of rewrites is told once. */
const warned = new Set();

/** The labels of Daggerheart's two chat-menu rerolls (chatLog.mjs `_getEntryContextOptions`, read in 2.6.5 and 2.10.5). */
const DAGGERHEART_REROLLS = Object.freeze(["DAGGERHEART.UI.ChatLog.rerollActionRoll", "DAGGERHEART.UI.ChatLog.rerollDamage"]);

function keep(message) {
    const rolls = foundry.utils.deepClone(message.toObject().rolls ?? []);
    if (!rolls.length) return;
    const roll = message.rolls?.[0];
    firstOf.delete(message.id);
    firstOf.set(message.id, { rolls, withFear: roll ? Boolean(dualityOfRoll(roll).withFear) : false });
    while (firstOf.size > FIRST_KEPT) firstOf.delete(firstOf.keys().next().value);
}

/** The rolls this primary keeps for a message, as a copy, or null. Exported for the suite. */
export function keptRollsOf(messageId) {
    const kept = firstOf.get(messageId ?? "");
    return kept ? foundry.utils.deepClone(kept) : null;
}

/**
 * Every character a roll message speaks for: the one its roller reported to this GM
 * (`rollSubjectNow`, E06 C5a), which is the one a roll whose speaker names nobody still
 * has, then its speaker and its source. Names the roll in the GMs' warning. Exported for
 * the suite.
 */
export function actorIdsOf(message) {
    const ids = new Set();
    const subject = rollSubjectNow(message)?.id;
    if (subject) ids.add(subject);
    if (message.speaker?.actor) ids.add(message.speaker.actor);
    const source = message.system?.source?.actor;
    if (typeof source === "string" && source) {
        let id = null;
        try { id = fromUuidSync(source)?.id ?? null; } catch { id = null; }
        if (id) ids.add(id);
    }
    return [...ids];
}

/** Tell the GMs once per message, user and kind; returns the text, or null when it was told already. */
function warnGms(key, message, user, userId) {
    const once = `${message.id}|${userId}|${key}`;
    if (warned.has(once)) return null;
    warned.add(once);
    if (warned.size > FIRST_KEPT) warned.delete(warned.values().next().value);
    const esc = foundry.utils.escapeHTML;
    const actor = game.actors.get(actorIdsOf(message)[0] ?? "");
    const text = game.i18n.format(key, {
        name: esc(user?.name ?? String(userId ?? "?")),
        roll: esc(actor?.name ?? message.speaker?.alias ?? message.id)
    });
    void whisperToGms(`<p class="drpg-warning">${text}</p>`);
    return text;
}

function onCreateMessage(message) {
    if (isPrimaryGm()) keep(message);
}

/**
 * `updateChatMessage`, on the primary GM. A GM's rewrite of a message's rolls is kept; a
 * rewrite by anybody else is put back to what was kept, marked so the dice relay sends
 * nothing for it (`REROLL_SHOWN`), or, with nothing kept, only told. Returns what it did
 * - null for a write it lets stand, `{ putBack, warned }` otherwise. Exported for the suite.
 */
export async function judgeRewrite(message, changes, options = {}, userId = null) {
    if (!isPrimaryGm() || !changes || !Object.hasOwn(changes, "rolls")) return null;
    const user = game.users.get(userId ?? "") ?? null;
    if (user?.isGM) {
        keep(message);
        return null;
    }
    const kept = firstOf.get(message.id);
    if (!kept) {
        debug(`A roll's dice were rewritten by ${user?.name ?? userId}, and this GM never saw them thrown: not put back.`);
        return { putBack: false, warned: warnGms("DRPG.Rolls.rewriteNotPutBack", message, user, userId) };
    }
    try {
        await message.update({ rolls: foundry.utils.deepClone(kept.rolls) }, { [REROLL_SHOWN]: true });
    } catch (err) {
        error("Could not put a roll's dice back after a player rewrote them", err);
        return { putBack: false, warned: warnGms("DRPG.Rolls.rewriteNotPutBack", message, user, userId) };
    }
    debug(`A roll's dice rewritten by ${user?.name ?? userId} were put back.`);
    const warned = warnGms("DRPG.Rolls.rewritePutBack", message, user, userId);
    // The GMs' row of it (E33 C5a, sheet-audit.mjs `recordTrace`): the user Foundry named as the writer, the message and
    // its total as kept and as rewritten - once per message and user, as the GMs are told.
    if (warned) {
        await recordTrace("rewrite", { actorId: actorIdsOf(message)[0] ?? null, userId: user?.id ?? userId ?? null, messageId: message.id,
            change: { rolls: [totalOf(kept.rolls), totalOf(changes.rolls)] } })
            .catch(err => error("Could not keep the GMs' row of a roll's dice put back", err));
    }
    return { putBack: true, warned };
}

/** The total of a message's first roll, as source data (a JSON string or an object), or null. */
function totalOf(rolls) {
    let roll = Array.isArray(rolls) ? rolls[0] : null;
    if (typeof roll === "string") {
        try { roll = JSON.parse(roll); } catch { return null; }
    }
    const total = Number(roll?.total);
    return Number.isFinite(total) ? total : null;
}

/**
 * Take Daggerheart's two rerolls off the chat menu of a user who is not a GM: the
 * free reroll is not a rule of this game, and a rewrite of the rolls is put back
 * anyway (`judgeRewrite`). Changes `options` in place, as the hook asks; returns
 * how many it took off. Matched by `label`, as Daggerheart writes its entries, or `name`.
 */
export function dropDaggerheartRerolls(options, user = game.user) {
    if (user?.isGM || !Array.isArray(options)) return 0;
    let dropped = 0;
    for (let i = options.length - 1; i >= 0; i--) {
        const entry = options[i];
        if (DAGGERHEART_REROLLS.includes(entry?.label ?? entry?.name)) {
            options.splice(i, 1);
            dropped++;
        }
    }
    return dropped;
}

export function registerRollKeeper() {
    Hooks.on("createChatMessage", onCreateMessage);
    Hooks.on("updateChatMessage", (message, changes, options, userId) => void judgeRewrite(message, changes, options, userId));
    Hooks.on("getChatMessageContextOptions", (app, options) => dropDaggerheartRerolls(options));
}
