/**
 * Danganronpa RPG - players do not edit their own numbers.
 * ---------------------------------------------------------------------------
 * In a killing game the sheet is not a scratchpad. Actions, Hope and traits
 * change because something happened - a roll landed, an action was spent, an
 * advancement was earned - not because a player clicked a pip.
 *
 * So those fields become read-only for players and writable only by the GM or
 * by this module's own automation.
 *
 * Health AND STRESS ARE IN THAT LIST AS OF 1.0.1. They used to be the exception, on
 * the grounds that players mark their own damage - but nothing in this game
 * asks them to. Damage arrives from a crisis action, a Despair Call, a failed
 * Observe, a Rest; all of it through `trustedWrite`, all of it already
 * marked. What the editable pips actually bought was the ability to heal
 * yourself in the middle of an incident, which is not a rule anybody had agreed
 * to and is impossible to notice from the GM's side.
 *
 * Automation marks its own writes with a flag in the update options, which is
 * how a legitimate change is told apart from someone poking the sheet.
 *
 * A COURTESY, ON THE WRITER'S OWN BROWSER (E29 C2, 05.10.2026; audit S03-45). Both
 * hooks below run where the write is made and stand aside for anything carrying that
 * flag: they keep an honest sheet honest, and are not a check.
 * The module's roads that write a student's traits or Health and Sanity maxima are a
 * GM's for that reason - `applyAdvancement`, `initCharacter` and `restoreStartingSheet`
 * refuse any other browser before their first write (R79, R221) - and the trust model
 * in CLAUDE.md says what a player's own browser can still move on its own character.
 * The protection is on the primary GM since E29 C3 (sheet-audit.mjs): what a roll is
 * built from - statistics, maxima, rules, bonuses, the GM-only flags and the effects
 * that carry them - is put back there whoever wrote it, and the writer is told.
 *
 * ONE ROAD, AND A REASON ON IT (E29 C1, 05.10.2026; audit S17-12). Every write
 * this module makes on a student's resources, and every write of a module
 * item's protected flags, goes through `trustedWrite`, `trustedCreate` or
 * `trustedDelete` below and names why, from one closed list. Measured before
 * (R220's reader at 889f073): 37 bare `automatedUpdate` calls in 17 files and
 * eight bare writes of a module item's protected flags, none of which said what
 * it was for - so nothing on a GM's side could tell a Rest from a console that
 * had found the marker. The reason is a claim, like a
 * packet field: it says which evidence to check, and the GMs' side checks it (from
 * C3 the fields above; the reasons' judges are C4's).
 */

import { MODULE_ID, ACTIONS_RESOURCE } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { debug } from "./utils.mjs";

/** In an update's options: automation, not hand-editing. Set by the three roads at the end of this file only. */
const SYSTEM_WRITE = "drpgAutomated";

/**
 * Marks a write that GIVES BACK Hope somebody was just charged, rather than
 * Hope anybody earned. The Despair darkening strips every Hope increase (see
 * `onPreUpdateActor` in overflow.mjs) and has to let this one through, or a
 * refused Call keeps its price while its card says the price was returned
 * (CALL-05).
 */
export const HOPE_REFUND = "drpgHopeRefund";

/**
 * Paths players may not set by hand.
 *
 * `hope.value` is deliberately NOT here. Daggerheart's own roll pipeline awards
 * Hope with a plain `actor.update()` carrying none of our flags, so guarding it
 * blocked every Hope a player earned from rolling - the resource simply never
 * moved. Hope is protected in the interface instead: the pips are display-only
 * for players (see danganronpa.css), which stops hand-editing without standing
 * in the way of the rules.
 */
const GUARDED = [
    `system.resources.${ACTIONS_RESOURCE}.value`,
    `system.resources.${ACTIONS_RESOURCE}.max`,
    "system.resources.hope.max",
    "system.resources.hitPoints",
    "system.resources.stress",
    "system.traits"
];

export function registerResourceGuard() {
    Hooks.on("preUpdateActor", onPreUpdateActor);
    Hooks.on("preUpdateItem", onPreUpdateItem);
}

/**
 * What an item IS is the GM's to write: its name, its picture, what it says.
 *
 * What a thing is CALLED is what everybody else at the table will hear it
 * called, and on a Truth Bullet the name and the description together ARE the
 * evidence - "Bent pipe" and "Bent pipe, wiped clean" are two different claims
 * about one object, and so is the paragraph under either name. A player editing
 * their own copy of any of the three rewrites the record the Class Trial runs
 * on, from a text field, with nobody told. This used to guard only `name` -
 * the description and the picture went through untouched, which is the same
 * hole with a different field name.
 *
 * Only these three. Players still move items, stash them, equip them, hand
 * them over and spend them; none of that is touched.
 */
const ITEM_GUARDED = ["name", "img", "system.description"];

/*
 * And on a Truth Bullet, the flags that say what it is (E03; audit S05-12):
 * what it shows, whether it is analysed, its reading, its lock. This is the
 * courtesy half - a console skips it - and the primary GM puts back anything
 * that gets past it (`watchBulletEdits` in truth-bullets.mjs). Named here by
 * value to keep this file out of that one's imports. `remnantRef` is written by
 * nothing since E05 C13 - which trace a bullet came from is the GMs' row and its
 * owner's copy - and stays: the clause `liftBulletRefs` reads it on a world not
 * yet stamped 1.2.64.
 */
const BULLET_GUARDED = [
    "playerText", "analyzedText", "shownType", "analyzed", "lockedChapter", "faint",
    "tiedToCrime", "sourceAction", "visibility", "remnantRef", "isTruthBullet"
].map(key => `flags.${MODULE_ID}.${key}`);

function onPreUpdateItem(item, changes, options) {
    try {
        if (game.user.isGM) return;
        if (options?.[SYSTEM_WRITE]) return;
        // Only an item somebody is carrying. A world item in a compendium or in
        // the sidebar is not part of anybody's inventory and not this guard's
        // business - and a player cannot edit those anyway.
        if (item.parent?.documentName !== "Actor") return;

        let enforcing = true;
        try {
            enforcing = game.settings.get(MODULE_ID, SETTINGS.lockPlayerResources);
        } catch { /* setting not registered yet */ }
        if (!enforcing) return;

        // Flattened and matched by prefix, the same way `onPreUpdateActor` reads
        // `GUARDED` below - `system.description` may arrive as a bare string or
        // as `{ value, chat, ... }` depending on the field type, and a plain
        // `"system.description" in changes` check misses the second shape
        // entirely, which is exactly how the picture and the description got
        // past this guard while the name did not.
        const flat = foundry.utils.flattenObject(changes);
        const guarded = item.getFlag(MODULE_ID, "isTruthBullet") ? [...ITEM_GUARDED, ...BULLET_GUARDED] : ITEM_GUARDED;
        const blocked = Object.keys(flat).filter(path =>
            guarded.some(g => path === g || path.startsWith(`${g}.`)));
        if (!blocked.length) return;

        for (const path of blocked) {
            const parts = path.split(".");
            const last = parts.pop();
            let node = changes;
            for (const part of parts) node = node?.[part];
            if (node && last in node) delete node[last];
        }

        prune(changes);
        ui.notifications.warn(game.i18n.localize("DRPG.Guard.itemLocked"));
        debug(`Blocked a player edit of "${item.name}": ${blocked.join(", ")}`);
    } catch {
        // Never let the guard itself break an update.
    }
}

function onPreUpdateActor(actor, changes, options) {
    try {
        if (actor.type !== "character") return;
        if (game.user.isGM) return;
        if (options?.[SYSTEM_WRITE]) return;

        let enforcing = true;
        try {
            enforcing = game.settings.get(MODULE_ID, SETTINGS.lockPlayerResources);
        } catch { /* setting not registered yet */ }
        if (!enforcing) return;

        const flat = foundry.utils.flattenObject(changes);
        const blocked = Object.keys(flat).filter(path =>
            GUARDED.some(g => path === g || path.startsWith(`${g}.`)));

        if (!blocked.length) return;

        for (const path of blocked) {
            const parts = path.split(".");
            const last = parts.pop();
            let node = changes;
            for (const part of parts) node = node?.[part];
            if (node && last in node) delete node[last];
        }

        prune(changes);
        ui.notifications.warn(game.i18n.localize("DRPG.Guard.blocked"));
        debug("Blocked a player edit of", blocked.join(", "));
    } catch {
        // Never let the guard itself break an update.
    }
}

/** Remove branches emptied by the deletions above. */
function prune(node) {
    for (const [key, value] of Object.entries(node)) {
        if (value && typeof value === "object" && !Array.isArray(value)) {
            prune(value);
            if (!Object.keys(value).length) delete node[key];
        }
    }
}

/**
 * Why the module wrote, in one closed list (E29 C1, 05.10.2026; the plan's 2.2). A write
 * names one of these in `options.drpgWrite.reason`; R220 reads the source for a write
 * that names none, or a word not on this list. The GMs' side judges a player's write by
 * the evidence its reason points at - a Rest by the room and the clock, an item's use by
 * the item - and a GM's own write by nothing: GM-side writes name a reason all the same,
 * so the list stays the one place that says what the module writes and why.
 */
export const WRITE_REASONS = Object.freeze([
    "spend", "refund", "price", "call", "rest", "itemUse", "itemWear", "stash", "retrieve", "discard",
    "searchFind", "concealment", "meddle", "setup", "levelUp", "incident", "reroll", "gmRuling",
    "auditPutBack", "auditUndo"
]);

/** The option a module write carries: `{ reason, ref }`. */
export const WRITE_STAMP = "drpgWrite";

/*
 * The options every road stamps. `ref` names the evidence the reason's judge reads - a
 * Search's roll message, the item a use spent, "relief" for a Relief's free rest - or
 * null. It travels with the update to every browser that receives the document, so it
 * names nothing that browser may not know: no price's action and no Call's key, which a
 * spend, a price and a refund do not need (they are judged on what was paid). `refund`
 * also sets `HOPE_REFUND`, the one marker the Despair darkening lets a Hope rise through.
 * An unlisted reason throws: the roads are async, so it arrives as the write's rejection.
 */
function stampOf(reason, ref, options) {
    if (!WRITE_REASONS.includes(reason)) throw new Error(`a module write named "${reason}", which is not a reason of WRITE_REASONS`);
    return { ...options, [SYSTEM_WRITE]: true, [WRITE_STAMP]: { reason, ref: ref ?? null },
        ...(reason === "refund" ? { [HOPE_REFUND]: true } : {}) };
}

/** Update a document as the module, for `reason`. */
export async function trustedWrite(doc, changes, { reason, ref = null, ...options } = {}) {
    return doc.update(changes, stampOf(reason, ref, options));
}

/**
 * Create items on `parent` as the module, for `reason` - the documents the module creates on a
 * student - or, with `documentName: "ActiveEffect"`, the effect the GMs' audit makes again after a
 * player deleted it (E29 C3, sheet-audit.mjs).
 */
export async function trustedCreate(parent, data, { reason, ref = null, documentName = "Item", ...options } = {}) {
    return parent.createEmbeddedDocuments(documentName, data, stampOf(reason, ref, options));
}

/** Delete a document as the module, for `reason`. */
export async function trustedDelete(doc, { reason, ref = null, ...options } = {}) {
    return doc.delete(stampOf(reason, ref, options));
}
