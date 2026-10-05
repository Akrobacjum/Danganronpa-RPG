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
 * `hope.value` is deliberately NOT here (reread in E29 C7, 05.10.2026; audit S02-41).
 * It was left out because Daggerheart's roll pipeline awarded Hope with a plain
 * `actor.update()` from the player's browser, carrying none of our flags, and
 * guarding it blocked every Hope a player earned from rolling. Read in 2.10.5, a
 * roll's Hope arrives another way - a drawn roll's is the GM's write (E28), and
 * Daggerheart's own resource step goes through its GM relay, on the GM's client -
 * so a strip here would no longer cost those. It stays out because Hope's protection
 * is the GM's now: a gain nothing covers is put back on the primary GM
 * (sheet-audit.mjs, E29 C4), which a console cannot step past; a strip on this
 * browser would add a second judge that only a build writing Hope the old way would
 * trip. The pips - the character sheet's and the Party sheet's - and the token HUD's
 * bars are display-only for players (danganronpa.css, hud.mjs `stillTokenBars`).
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
 * names one of these as its `reason`; R220 reads the source for a write that names none,
 * or a word not on this list. The GMs' side judges a player's write by the evidence its
 * reason points at - a Rest by the room and the clock, an item's use by the item - and a
 * GM's own write by nothing: GM-side writes name a reason all the same, so the list stays
 * the one place that says what the module writes and why. Which reasons leave the writer's
 * browser is `stampOf`'s (fix r1-G7). `concealment` is named by no write since that fix -
 * the Sanity it named is a resolution's price (cleanup.mjs `markResolutionStress`) - and
 * stays on the list the plan and R220 hold; the GMs' judge still reads it, as it reads
 * whatever a console claims, as a refund (sheet-audit.mjs `REFUNDS`).
 */
export const WRITE_REASONS = Object.freeze([
    "spend", "refund", "price", "call", "rest", "itemUse", "itemWear", "stash", "retrieve", "discard",
    "searchFind", "concealment", "meddle", "setup", "levelUp", "incident", "reroll", "gmRuling",
    "auditPutBack", "auditUndo"
]);

/** The option a module write carries where its reason goes with it (`stampOf`): `{ reason, ref }`. */
export const WRITE_STAMP = "drpgWrite";

/*
 * WHERE A REASON GOES (E29 fix r1-G7, 05.10.2026; the round-1 security review's M2). A write's
 * options reach every browser that holds the document - the GMs' audit needs them to, and
 * whether a real Foundry forwards them is LIVE-E29-01 - and until this fix every module write
 * carried its reason to all of them. Measured in the harness on 05.10 (10-murder at C8's
 * runtime): a bystander's browser read `concealment` on the killer's Sanity, `reroll` on her
 * clean-up's Reroll and `incident` on the victim's sheet and on the gloves the body's discovery
 * broke - who is in the incident, which E06's rule keeps from a bystander. So a reason leaves
 * the writer's browser only where a judge reads it. On a player's write that is `JUDGED`: the
 * reasons the GMs' audit reads off a player's write, to judge it or onto the row it keeps of one
 * (sheet-audit.mjs); any other reason a road names on a player's browser - a tool's wear on a
 * Despair - goes as the module's write with no reason. A GM's write is judged by nothing and
 * names none, but the audit's own put-back and Undo (`AUDIT_OWN`), which the audit tells apart
 * from every other GM's write.
 */
const JUDGED = new Set(["spend", "refund", "price", "call", "rest", "itemUse", "stash", "retrieve", "discard", "searchFind"]);
const AUDIT_OWN = new Set(["auditPutBack", "auditUndo"]);

/*
 * The options every road stamps. `ref` names the evidence the reason's judge reads - the
 * GMs' record of a Search's roll (its `rollId`, E29 C6), the item a use spent, "relief" for a
 * Relief's free rest, the Call's key on the grant a Burst or a Sprint gives (C4; `callCovers`
 * reads it, and the grant's own flag already shows every browser which Call it was: only a
 * Burst gives free actions, only a Sprint free moves) - or null. It goes where its reason goes,
 * so it names nothing a browser that receives the document may not know: no price's action,
 * which a spend, a price and a refund do not need (they are judged on what was paid). `refund`
 * also sets `HOPE_REFUND`, the one marker the Despair darkening lets a Hope rise through.
 * An unlisted reason throws: the roads are async, so it arrives as the write's rejection.
 */
function stampOf(reason, ref, options) {
    if (!WRITE_REASONS.includes(reason)) throw new Error(`a module write named "${reason}", which is not a reason of WRITE_REASONS`);
    const goes = game.user?.isGM ? AUDIT_OWN.has(reason) : JUDGED.has(reason);
    return { ...options, [SYSTEM_WRITE]: true, ...(goes ? { [WRITE_STAMP]: { reason, ref: ref ?? null } } : {}),
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
