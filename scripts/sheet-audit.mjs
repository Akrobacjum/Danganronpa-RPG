/**
 * Danganronpa RPG - the GMs' audit of what a player writes on their own student.
 * ---------------------------------------------------------------------------
 * A player owns their student, and an owner may write anything on it: Daggerheart's
 * sheet, the token HUD, a console. resource-guard.mjs refuses the fields a player
 * should not edit, on the player's own browser - a courtesy a console steps past
 * with the option it stands aside for. This file is the protection behind it (E29
 * C3, 05.10.2026; audit S02-41, S08-57's ground; the plan's 2.1-2.4): every write a
 * player's browser makes on a student is judged on the primary GM against what the
 * GMs hold, and what a roll is built from is put back at once.
 *
 * WHAT THE GMS HOLD (`sheetMarks`, gm-stores.mjs). Per student, the last judged
 * values: its statistics (`system.traits`), experiences, each resource's value and
 * maximum, `system.rules` and `system.bonuses`, the module flags below and its
 * effects. A GM's write is never judged and is the new mark; so is whatever a
 * verdict leaves standing. Filled from the documents when the primary's stores
 * hydrate and a student has none.
 *
 * WHAT IS PUT BACK, with the world setting `lockPlayerResources` on (its default):
 * any change to a statistic, an experience, a maximum, `system.rules` or
 * `system.bonuses`; any change to a GM-only flag (`GM_FLAGS`); an effect that
 * carries a statistic, an experience, a maximum, a rule or a bonus, or is one of
 * the module's own statuses - created (deleted), changed (written back) or deleted
 * (made again under its id). A statistic or a maximum goes back to its mark, not by a
 * delta: nothing a player does moves either since C2. The writer is told once per
 * write (`sheetPutBack`, the field named in their language) and the GMs are
 * whispered once, with each field before and after. With the setting off, the
 * fields its text names - the statistics and the maxima of actions, Hope, Health
 * and Sanity - are listed in `sheetWrites` and left standing (the owner's Q2 (a));
 * the rest is put back either way.
 *
 * AN ARMED CALL IS THE GMS' (C8, 05.10.2026; the plan's 2.4, 3.3). A player's Call is armed on
 * the primary GM (gm-bridge.mjs `call.arm`), on any character, so an entry a player's browser
 * adds to `pendingCall` is put back whatever the setting says - the entries it took away stand,
 * as a roll spends them - and a drawn roll applies only the entries the mark holds
 * (`armedCallsHeld`, roll-draw.mjs `throwDrawn`), once this student's writes are judged.
 *
 * HOPE, AND WHAT A GAIN NEEDS (C4, 05.10.2026; the plan's 2.4, 2.5). The mark keeps
 * each resource as the GMs hold it - Hope, actions, Health and Sanity marks, the
 * Burst and Sprint grants - and a `credit`: what each fell by (or, for marks, rose
 * by), kept a Reroll's window. A fall stands and is credit. A gain stands as far as
 * the write's reason covers it: a refund (`refund`, `reroll`, `concealment`) takes
 * credit, oldest first, and never more; a Rest takes its stamp, its room, its action
 * and its picks; an item used takes the item and its consumption by the same user; a
 * Call's grant takes that Call's price. What nothing covers in Hope is put back as a
 * delta - the GMs' value moves by what was covered, so a forged Hope spent at once
 * still costs real Hope - and told as a statistic is; with `lockPlayerResources` off
 * it is listed and stands. Health, Sanity, actions and grants are judged the same way
 * and flagged (below). A `restsTaken` stamp no Rest covers is put back. The relay
 * asks the same of a gain Daggerheart writes for a player (`relayGainRefusal`,
 * relay-guard.mjs).
 *
 * WHAT IS FLAGGED (C5, 05.10.2026; the plan's 2.4, 2.8, 2.9). A gain in Health, Sanity
 * or actions that nothing covers stands, and the GMs get one card per write - who,
 * which student, each field before and after - with Undo and Keep, which only a GM's
 * browser wires (`onRenderFlagged`). The player is told nothing. With
 * `lockPlayerResources` off those three are listed instead, and no card is posted; the
 * Burst and Sprint grants are flags the setting does not name, flagged either way (the
 * owner's Q2 (a)). A click is decided on the primary GM, as Grant all is since
 * E08+E28 fix r2-H7: another GM's asks it (`audit.decide`, gm-bridge.mjs), its decisions
 * run one after another, and the row is marked decided before anything is written, so
 * two GMs' clicks write once. Undo writes a field back only while it still holds what
 * the write left; a field that moved since is not written over, and the card says so.
 *
 * THE MODULE'S ITEMS (C6, 05.10.2026; audit S08-57; the plan's 2.6). The mark holds each
 * module item of a student (one with a `category`) whole, as a GM's write or the last
 * verdict left it. A `category`, `tier` or `drpgItemId` changed is put back; so is a
 * `broken` cleared, a `wear` lowered or a count raised - each one's other way stands, as
 * a use or a break spends it. A move into or out of a stash (`location`, `stashRoom`)
 * stands when the student stands, as this GM sees it, in a room with a stash of theirs
 * (vault.mjs `myStashHere`'s rule), the stash holds fewer than `VAULT_LIMIT` besides it,
 * a retrieve takes from that room's stash and the carry cap has room for it; else it is
 * put back. A module item a player deletes stands when it is a `discard` of an item broken
 * on the GMs' copy; an item a player creates stands when it is a Search's find - its
 * `ref` the record of a Search of that student by that player, not yet used for a find,
 * and its tier at most what the record's total earns on the Search's table. Anything else
 * deleted or created is flagged: Undo makes a deleted item again under its id, from the
 * row's copy, or deletes a created one. The setting `lockPlayerResources` does not govern
 * items (the owner's Q2 (a)).
 *
 * WITH NO GM WATCHING (C7, 05.10.2026; the plan's 2.9). Nothing judges a write that lands
 * while no GM is connected, nor one the primary had not judged when it reloaded. So when
 * the primary's stores hydrate (`compareAtReady`) every student's document is compared
 * with its mark, each difference judged as a write naming it would be: a statistic, an
 * experience, a maximum, a rule, a bonus, a GM-only flag, a Call armed (since C8) or an effect a
 * roll is built from is put back at once, and so is a module item's protected flag; every other difference
 * that a write would have had to account for - a gain in Hope, Health, Sanity, actions or
 * the grants, a Rest stamp, a module item deleted or created - goes on one card, "Sheet
 * changes made while no GM was watching", a row per field and per item with Undo and Keep
 * and Undo all / Accept all, decided once on the primary as the card of a flagged write
 * is. A fall stands, as it does when judged live. `lockPlayerResources` off lists the
 * fields its text names instead (the owner's Q2 (a)), as it does live. The marks are the
 * GMs' browsers' (gm-stores.mjs: synced, not backed up), so the comparison is as good as
 * the copy the returning GM's browser holds: a GM on a browser that never held them takes
 * the sheets as it finds them, which is the limit of this design, not measured at a table.
 * What a GM writes on this browser before its stores hydrate is the GM's, not a difference
 * (`unmarked`).
 *
 * ONE WRITE AFTER ANOTHER, PER STUDENT. Each write is queued behind the ones before
 * it on that student (`inOrder`), so a put-back is computed against the writes
 * that landed before it, and a GM's write is the baseline only once the player's
 * writes before it have been judged.
 */

import { MODULE_ID, FLAGS, STATES, ACTIONS_RESOURCE, TIMING, REST, HOPE_CALLS, USABLE_EFFECTS, USABLE_KINDS, CRITICAL, VAULT_LIMIT } from "./config.mjs";
import { SETTINGS, getSetting, getClock } from "./settings.mjs";
import { isPrimaryGm, whisperToGms, esc, error, debug, forcedDeletion } from "./utils.mjs";
import { onGmStoresHydrated, gmStoresHydrated, gmStoresQuiet, stableJson } from "./gm-store.mjs";
import { sheetMarkStore, sheetWriteStore, rollStore } from "./gm-stores.mjs";
import { trustedWrite, trustedCreate, trustedDelete } from "./resource-guard.mjs";
import { tellRefused, bridgeRequest } from "./bridge-guards.mjs";
import { cardFlag, cardWriter, updateSecret } from "./secret.mjs";
import { ITEM_FLAGS, CAP_OVERRIDE, isBroken, isStashed, canCarry } from "./inventory.mjs";
import { readDuality } from "./despair-award.mjs";

/** The module flags only a GM writes (the plan's 2.4), held in the mark and put back. */
const GM_FLAGS = ["deceased", "monocub", "silencedChapter", "advances", "sheetAtStart", "lootTrace", "swungWeapon",
    "betrayalWindow", "monokuma"].map(key => FLAGS[key]);

/**
 * What the GMs hold of a student's means (C4): each with the direction its price moves
 * it - Hope, actions and the grants fall when spent, Health and Sanity marks rise. The
 * mark's value of each is the GMs' (`ledgerOf`), not the document's.
 */
const LEDGER = Object.freeze({
    hope: { path: "system.resources.hope.value", cost: -1, kind: "hope" },
    actions: { path: `system.resources.${ACTIONS_RESOURCE}.value`, cost: -1, kind: "actions" },
    hitPoints: { path: "system.resources.hitPoints.value", cost: 1, kind: "hitPoints" },
    stress: { path: "system.resources.stress.value", cost: 1, kind: "stress" },
    freeActionGrants: { path: `flags.${MODULE_ID}.${FLAGS.freeActionGrants}`, cost: -1, kind: "grant" },
    freeMoveGrants: { path: `flags.${MODULE_ID}.${FLAGS.freeMoveGrants}`, cost: -1, kind: "grant" }
});
const LEDGER_FLAGS = [FLAGS.freeActionGrants, FLAGS.freeMoveGrants];
const RESTS_PATH = `flags.${MODULE_ID}.${FLAGS.restsTaken}`;
const CALLS_PATH = `flags.${MODULE_ID}.${FLAGS.pendingCall}`;

/** Every module flag the mark holds: the GM-only ones, `pendingCall`, whose additions are put back (C8), the Rest stamps and the grants. */
const MARKED_FLAGS = [...GM_FLAGS, FLAGS.pendingCall, FLAGS.restsTaken, ...LEDGER_FLAGS];

/** The reasons whose gain is a refund (the plan's 2.5): it takes credit and never more. A concealment's Sanity comes back as a refund too. */
const REFUNDS = new Set(["refund", "reroll", "concealment"]);
/** The reasons that only ever spend Hope (the payment that crosses a put-back, `movesOf`). */
const PAYMENTS = new Set(["price", "call", "meddle"]);
/** How long credit is kept: a Reroll's window, the longest a module refund comes after its price. */
const CREDIT_KEPT_MS = TIMING.rerollWindowMinutes * 60_000;
/** How long an item used waits for its consumption by the same user (the plan's 2.5, chosen). */
export const JUDGE_WAIT_MS = 2000;
/** How recent a Daggerheart roll must be to cover the Hope the relay writes for it (the plan's 2.5, chosen). */
const ROLL_COVER_MS = 60_000;

/** The fields `lockPlayerResources`'s text names that this file judges: statistics, and these maxima. */
const LOCK_NAMED_MAX = new Set([ACTIONS_RESOURCE, "hope", "hitPoints", "stress"].map(r => `system.resources.${r}.max`));

/** What an effect may change without the GMs' say (anything else that a roll is built from puts it back). */
const ROLL_PATH = /^system\.(?:traits|experiences|rules|bonuses)(?:\.|$)|\.max$/;

/** The statuses the module itself sets (chapter.mjs `dead`, states.mjs Breakdown and Wounded). */
const MODULE_STATUSES = new Set(["dead", ...Object.values(STATES).map(state => state.id)]);

/** A write by a GM carrying this is not taken as the mark: tier 2 writes as the GM and hands it to `judgeWrite`. */
export const AUDIT_ASIDE = "drpgAuditAside";

/** The flag of the GMs' card of a flagged write (C5): the id of the row it asks about. */
const FLAGGED_CARD = "sheetFlagged";

/** The item hooks (C6): a module item's flags and count, a deletion, a creation. */
const ITEM_WRITES = new Set(["updateItem", "createItem", "deleteItem"]);

/** A module item's flags only a GM changes, whichever way (the plan's 2.6). */
const ITEM_FIXED = [ITEM_FLAGS.category, ITEM_FLAGS.tier, ITEM_FLAGS.identity];

/** Where a module item is kept: carried, or which stash. */
const ITEM_PLACE = [ITEM_FLAGS.location, ITEM_FLAGS.stashRoom];

/** The flag of the GMs' card of the changes made with no GM watching (C7): the ids of the rows it asks about. */
const AWAY_CARD = "sheetAway";

/** The parts of a student's document the mark holds and the comparison at ready reads, besides `MARKED_FLAGS`. */
const MARK_ROOTS = ["system.traits", "system.experiences", "system.resources", "system.rules", "system.bonuses"];

/** How long a row of `sheetWrites` is kept (the plan's 2.3, chosen): a day, swept as the next is written. */
const ROW_KEPT_MS = 24 * 60 * 60_000;

/* By the constructor's name, not by identity: a write's changes may be built in another realm (the
   harness expands them outside the browser's window), and an operator - v14's forced deletion or
   replacement - is an instance of its own class, a leaf. */
const isPlain = value => {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
    const proto = Object.getPrototypeOf(value);
    return proto === null || proto.constructor?.name === "Object";
};
const clone = value => value === undefined ? undefined : foundry.utils.deepClone(value);

/** An effect's or an item's data as the mark keeps it: its source, without Foundry's write stamp, which moves on every write. */
function docData(doc) {
    const { _stats, ...data } = doc?.toObject?.() ?? doc ?? {};
    return data;
}

/** Whether an effect's data carries what a roll is built from, or is one of the module's own statuses. */
export function rollRelevant(data) {
    if (!data) return false;
    if ([...(data.statuses ?? [])].some(id => MODULE_STATUSES.has(id))) return true;
    // Daggerheart 2.10.5 keeps an effect's changes in `system.changes` (read in its source, 05.10.2026); older ones at the top.
    const changes = [...(data.system?.changes ?? []), ...(data.changes ?? [])];
    return changes.some(change => ROLL_PATH.test(String(change?.key ?? "")));
}

/** A student's mark, from the document as it stands. */
function markFrom(actor) {
    const src = actor._source ?? actor.toObject();
    const system = src.system ?? {};
    const flags = src.flags?.[MODULE_ID] ?? {};
    return {
        traits: clone(system.traits ?? {}), experiences: clone(system.experiences ?? {}), resources: clone(system.resources ?? {}),
        rules: clone(system.rules ?? {}), bonuses: clone(system.bonuses ?? {}),
        flags: Object.fromEntries(MARKED_FLAGS.filter(key => flags[key] !== undefined).map(key => [key, clone(flags[key])])),
        effects: Object.fromEntries((actor.effects?.contents ?? []).map(effect => [effect.id, docData(effect)])),
        items: Object.fromEntries((actor.items?.contents ?? []).map(item => [item.id, docData(item)]).filter(([, data]) => isModuleItem(data)))
    };
}

/** Whether an item's data is the module's: one with a category (vault.mjs `vaultContents` reads the same). */
function isModuleItem(data) {
    return Boolean(data?.flags?.[MODULE_ID]?.[ITEM_FLAGS.category]);
}

/** An item's data read as the module's readers read an item (`getFlag`, `id`, `system`), with no document behind it. */
function itemLike(src) {
    return { id: src._id, name: src.name, system: src.system,
        getFlag: (scope, key) => foundry.utils.getProperty(src.flags ?? {}, `${scope}.${key}`) };
}

/** A student's module items in the mark with one item's write taken in: its data as it now stands, or gone. */
function itemsAfter(mark, item, data) {
    const items = { ...(mark?.items ?? {}) };
    if (data && isModuleItem(data)) items[item.id] = data;
    else delete items[item.id];
    return items;
}

/** The GMs' value of each of a student's means: the mark's (nothing held is 0), or the document's where there is no mark. */
function ledgerOf(mark, actor) {
    const doc = mark ? markAsDocument(mark) : actor?._source ?? {};
    return Object.fromEntries(Object.entries(LEDGER).map(([key, { path }]) => [key, Number(foundry.utils.getProperty(doc, path)) || 0]));
}

/** A mark with the GMs' means written into its resources and flags, and its credit. */
function withLedger(mark, values, credit) {
    const doc = markAsDocument(mark);
    for (const [key, { path }] of Object.entries(LEDGER)) {
        // A resource this student does not have stays absent, and so does a grant never written.
        if (foundry.utils.getProperty(doc, path) === undefined && (path.startsWith("system.") || !values[key])) continue;
        foundry.utils.setProperty(doc, path, values[key]);
    }
    mark.credit = credit;
    return mark;
}

/** A student's credit, each entry older than a Reroll's window dropped. */
function creditOf(mark, at = Date.now()) {
    return Object.fromEntries(Object.entries(mark?.credit ?? {}).map(([key, entries]) =>
        [key, (entries ?? []).filter(entry => entry?.at >= at - CREDIT_KEPT_MS && entry.n > 0).map(entry => ({ ...entry }))]));
}

const creditHeld = (credit, key) => (credit[key] ?? []).reduce((sum, entry) => sum + entry.n, 0);

/** Takes up to `n` of a student's credit, oldest first; answers what it took. */
function takeCredit(credit, key, n) {
    let taken = 0;
    for (const entry of credit[key] ?? []) {
        const part = Math.min(entry.n, n - taken);
        entry.n -= part;
        taken += part;
        if (taken >= n) break;
    }
    credit[key] = (credit[key] ?? []).filter(entry => entry.n > 0);
    return taken;
}

/** Takes exactly `n` of a student's credit, or nothing. */
const takeAll = (credit, key, n) => creditHeld(credit, key) >= n && takeCredit(credit, key, n) === n;

/** The mark as the document it was taken from, so a write's paths read straight off it. */
function markAsDocument(mark) {
    return {
        system: { traits: mark.traits ?? {}, experiences: mark.experiences ?? {}, resources: mark.resources ?? {},
            rules: mark.rules ?? {}, bonuses: mark.bonuses ?? {} },
        flags: { [MODULE_ID]: mark.flags ?? {} }
    };
}

/** Every leaf a write names, as a dotted path: a plain object is walked, anything else (an operator, a list) is a leaf. */
function pathsOf(changes, at = "") {
    return Object.entries(changes ?? {}).flatMap(([key, value]) => {
        if (key === "_id" || key === "_stats") return [];
        const path = at ? `${at}.${key}` : key;
        return isPlain(value) && Object.keys(value).length ? pathsOf(value, path) : [path];
    });
}

/** Which of this file's judgements a path of a student's update falls under, or null. */
function kindOf(path) {
    if (/^system\.traits(?:\.|$)/.test(path)) return "traits";
    if (/^system\.experiences(?:\.|$)/.test(path)) return "experience";
    if (/^system\..+\.max$/.test(path)) return "max";
    if (/^system\.rules(?:\.|$)/.test(path)) return "rules";
    if (/^system\.bonuses(?:\.|$)/.test(path)) return "bonuses";
    const prefix = `flags.${MODULE_ID}.`;
    if (!path.startsWith(prefix)) return null;
    const flag = path.slice(prefix.length).split(".")[0];
    if (flag === FLAGS.pendingCall) return "pendingCall";
    return GM_FLAGS.includes(flag) ? "flag" : null;
}

/*
 * The write that puts `paths` back to `before`. A path that was not there is deleted at its
 * highest missing part - a new experience goes whole, not as an empty entry - with v14's
 * forced deletion (`-=key` removes nothing in this Foundry: utils.mjs `forcedDeletion`), or
 * written null where there is none. A path that was an object is written whole over what
 * the player made of it.
 */
function putBackPatch(before, paths) {
    const patch = {};
    for (const path of paths) {
        const parts = path.split(".");
        let depth = parts.length;
        while (depth > 1 && foundry.utils.getProperty(before, parts.slice(0, depth - 1).join(".")) === undefined) depth--;
        const at = parts.slice(0, depth).join(".");
        if (Object.keys(patch).some(done => at === done || at.startsWith(`${done}.`))) continue;
        const value = foundry.utils.getProperty(before, at);
        patch[at] = value === undefined ? forcedDeletion() : wholeValue(value);
    }
    return patch;
}

/** An object written in place whole (v14's forced replacement); anything else as it is. */
function wholeValue(value) {
    const Operator = foundry.data?.operators?.ForcedReplacement;
    if (!Operator || !value || typeof value !== "object" || Array.isArray(value)) return clone(value);
    return Operator.create ? Operator.create(clone(value)) : new Operator(clone(value));
}

/* An experience's value, an experience added or taken away, or the list written whole: what a roll adds.
   Its name and description are words a player keeps on their sheet (the plan's 2.4: "experiences' values
   and new experiences"). */
function experienceCounts(path, before) {
    const [, , id, field] = path.split(".");
    return !id || !field || field === "value" || foundry.utils.getProperty(before, `system.experiences.${id}`) === undefined;
}

/** The entries of a flag's new value that its old one did not have (a list's items, or the value itself). */
function addedEntries(before, after) {
    const list = value => value === undefined || value === null ? [] : Array.isArray(value) ? value : [value];
    const had = new Set(list(before).map(stableJson));
    return list(after).filter(entry => !had.has(stableJson(entry)));
}

/*
 * The armed list put back (C8): what the document holds now, without the entries the mark did not
 * have. The entries the write took away stay away - a roll on the player's browser spends its Calls
 * with such a write - so the mark's list is not written back whole. Nothing left takes the flag off.
 */
function armedPutBack(before, src) {
    const now = foundry.utils.getProperty(src, CALLS_PATH);
    const added = new Set(addedEntries(foundry.utils.getProperty(before, CALLS_PATH), now).map(stableJson));
    const kept = (Array.isArray(now) ? now : now ? [now] : []).filter(entry => !added.has(stableJson(entry)));
    return kept.length ? clone(kept) : forcedDeletion();
}

/** Whether `lockPlayerResources` is on (its default, and what an unreadable setting counts as). */
function locked() {
    try { return getSetting(SETTINGS.lockPlayerResources) !== false; } catch { return true; }
}

/* ---------------------------------------------------------------------------
 * The queue, the mark
 * ------------------------------------------------------------------------- */

/** actorId -> the last job queued on that student. */
const chains = new Map();

function inOrder(actorId, job) {
    const run = (chains.get(actorId) ?? Promise.resolve()).then(job).catch(err => {
        error("The GMs' audit of a sheet could not judge a write", err);
        return null;
    });
    chains.set(actorId, run);
    void run.then(() => { if (chains.get(actorId) === run) chains.delete(actorId); });
    return run;
}

/** Resolves once every write queued on any student has been judged (tier 2, and anything that reads the stores after a write). */
export async function sheetAuditIdle() {
    while (chains.size) await Promise.all([...chains.values()]);
}

/** Resolves once every write queued on these students has been judged (C8: a Call's purchase and a drawn roll). Anything else in `ids` is passed over. */
export async function judgedFor(...ids) {
    const named = ids.filter(id => typeof id === "string" && id);
    for (let queued = named.filter(id => chains.has(id)); queued.length; queued = named.filter(id => chains.has(id))) {
        await Promise.all(queued.map(id => chains.get(id)));
    }
}

/**
 * The nonces of the Calls the GMs hold armed on this student (C8): its mark's `pendingCall`, once
 * every write queued on it has been judged - so an entry a player's browser added is not among
 * them, whether its put-back has landed or failed (`heldCalls`). Null where there is no mark to
 * ask (this browser's stores not hydrated, a character never marked) or the mark is a Monokuma's:
 * the document is then the record, as it was before C8.
 */
export async function armedCallsHeld(actor) {
    await judgedFor(actor?.id);
    const mark = gmStoresHydrated() ? sheetMarkStore.get(actor?.id ?? "") : null;
    // A Monokuma is no student (`judgeNow`): what it holds stands, so its document is the record.
    if (!mark || mark.flags?.[FLAGS.monokuma]) return null;
    const stored = mark.flags?.[FLAGS.pendingCall] ?? null;
    return new Set((Array.isArray(stored) ? stored : stored ? [stored] : []).map(entry => entry?.nonce).filter(nonce => typeof nonce === "string"));
}

/**
 * The student's mark brought up to its document, field by field: only the fields that
 * differ are written, so a write the mark already holds - a put-back, a GM writing a value
 * back - patches nothing. Answers whether it wrote. The means (`LEDGER`) and the credit are
 * not read off the document: they are the GMs', kept as the mark holds them unless the
 * judgement hands new ones (`ledger`) - a document read while a write waits to be judged
 * would make that write's value the GMs' before it was judged. The items likewise (C6):
 * each moves only with its own write's judgement (`items`), as the hook saw it. And the
 * armed list (C8): `heldCalls`, with `calls` the list a GM's own write left.
 */
async function refreshMark(actor, ledger = null, items = null, calls = undefined) {
    if (!gmStoresHydrated() || !game.actors?.has(actor?.id)) return false;
    const held = sheetMarkStore.get(actor.id) ?? {};
    const now = markFrom(actor);
    if (sheetMarkStore.has(actor.id)) {
        withLedger(now, ledger?.values ?? ledgerOf(held, actor), ledger?.credit ?? held.credit ?? {});
        now.items = items ?? held.items ?? now.items;
        heldCalls(now, held, calls);
    }
    const moved = Object.fromEntries(Object.entries(now).filter(([field, value]) => stableJson(value) !== stableJson(held[field] ?? null)));
    if (!Object.keys(moved).length) return false;
    await sheetMarkStore.patch(actor.id, moved);
    return true;
}

/*
 * THE MARK'S ARMED LIST (C8, 05.10.2026). The document's entries the mark held already - a roll
 * spends them, and that stands - and those a GM's own write left (`calls`, as its hook saw them).
 * Not the document's others: this refresh reads the document when a judgement ends, and a write a
 * player's browser made meanwhile has landed on it and is not judged yet - the mark would take its
 * entry as the GMs', and its own judgement would then find nothing added. Read, not measured: the
 * same holds of every other field `markFrom` reads off the document, which this does not change.
 */
function heldCalls(now, held, calls) {
    const list = value => value === undefined || value === null ? [] : Array.isArray(value) ? value : [value];
    const ours = new Set([...list(held.flags?.[FLAGS.pendingCall]), ...list(calls)].map(stableJson));
    const there = list(now.flags[FLAGS.pendingCall]), kept = there.filter(entry => ours.has(stableJson(entry)));
    if (kept.length === there.length) return;
    if (kept.length) now.flags[FLAGS.pendingCall] = kept;
    else delete now.flags[FLAGS.pendingCall];
}

/*
 * A mark for every character that has none, on the primary, once its stores hold the other GMs'
 * copies: in one write, as the hydration is heard. One write per character, each awaited, was the
 * first version, and its last marks landed while the suite had begun: measured on the harness
 * 05.10.2026 (e29run/c3a1), tier 0/1's "changed nothing" check found three characters' marks
 * written during it.
 */
function fillMarks() {
    const missing = (game.actors?.contents ?? []).filter(actor => actor.type === "character" && !sheetMarkStore.has(actor.id));
    if (!missing.length) return Promise.resolve();
    return sheetMarkStore.patchMany(Object.fromEntries(missing.map(actor => [actor.id, markFrom(actor)])));
}

/* ---------------------------------------------------------------------------
 * The judge
 * ------------------------------------------------------------------------- */

/**
 * JUDGE ONE WRITE (exported so tier 2 can hand it a write with a real player's id; the
 * hooks below hand it every write on the primary). `kind` is the hook's name:
 * `updateActor` with the student and its changes, or `createActiveEffect`,
 * `updateActiveEffect`, `deleteActiveEffect` with the effect (and the changes of an
 * update), or `updateItem`, `createItem`, `deleteItem` with the item (C6). A GM's write - `game.users.get(userId).isGM` - is the new mark. Answers
 * `{ verdict, change }` (`putBack`, `listed`, `stands`, `mark`), or null for a write
 * on no character. Queued behind the writes before it on that student. `priors` is
 * what the hook heard before this write (`noteWrite`); a write handed in without
 * them is measured from the GMs' values.
 */
export function judgeWrite(kind, doc, changes, userId, options = {}, priors = null) {
    const actor = kind === "updateActor" ? doc : doc?.parent;
    if (actor?.documentName !== "Actor" || actor.type !== "character") return Promise.resolve(null);
    // An item as the hook saw it: by the time its judgement comes, a later write may have moved it.
    const seen = kind === "updateActor" ? seenNow(actor, changes, options, priors)
        : ITEM_WRITES.has(kind) ? { at: Date.now(), item: kind === "deleteItem" ? null : docData(doc) } : null;
    return inOrder(actor.id, () => judgeNow(kind, doc, actor, changes, userId, options, seen));
}

async function judgeNow(kind, doc, actor, changes, userId, options, seen) {
    const user = game.users?.get(userId ?? "");
    if (!gmStoresHydrated() && !options?.[AUDIT_ASIDE]) noteUnmarked(kind, doc, actor, changes);
    if (user?.isGM) {
        // The GMs' own put-back moves nothing they hold; any other GM's write is their value of what it names.
        const reason = options?.drpgWrite?.reason, own = reason === "auditPutBack";
        if (options?.[AUDIT_ASIDE]) return { verdict: "mark", change: {} };
        if (ITEM_WRITES.has(kind)) await refreshMark(actor, null, itemsAfter(sheetMarkStore.get(actor.id), doc, seen.item));
        else await refreshMark(actor, seen && !own ? gmLedger(actor, seen, { credit: reason !== "auditUndo" }) : null, null, seen?.calls);
        return { verdict: "mark", change: {} };
    }
    const mark = sheetMarkStore.get(actor.id);
    // No mark - a student made since the stores hydrated and never written by a GM: nothing to judge against.
    if (!mark) {
        await refreshMark(actor);
        return { verdict: "mark", change: {} };
    }
    // A Monokuma is no student; the mark's flag decides, so a write that makes one is still judged.
    if (mark.flags?.[FLAGS.monokuma]) {
        await refreshMark(actor, null, ITEM_WRITES.has(kind) ? itemsAfter(mark, doc, seen.item) : null);
        return { verdict: "stands", change: {} };
    }
    const found = kind === "updateActor" ? await updateFindings(actor, mark, changes, user, options, seen)
        : ITEM_WRITES.has(kind) ? await itemFindings(kind, doc, actor, mark, changes, user, options, seen)
            : effectFindings(kind, doc, mark, changes);
    if (found.back.length || found.fix) {
        try {
            await found.undo();
        } catch (err) {
            error(`The GMs' audit could not put back a write on ${actor.name}`, err);
            return { verdict: "failed", change: found.change };
        }
    }
    await record(actor, user, found, options);
    if (found.finds) await sheetMarkStore.patch(actor.id, { finds: found.finds });
    await refreshMark(actor, found.ledger ?? null, found.items ?? null);
    const verdict = found.back.length ? "putBack" : found.flagged?.length ? "flagged" : found.listed.length ? "listed" : "stands";
    return { verdict, change: found.change };
}

/** A student's update: what it changed of what a roll is built from (`actorFindings`) and of its means (`meansFindings`), put back in one write. */
async function updateFindings(actor, mark, changes, user, options, seen) {
    const sheet = actorFindings(actor, mark, changes);
    const means = await meansFindings(actor, mark, user, options, seen);
    const patch = { ...sheet.patch, ...means.patch };
    return { back: [...sheet.back, ...means.back], listed: [...sheet.listed, ...means.listed], flagged: means.flagged,
        change: { ...sheet.change, ...means.change },
        covered: means.covered, ledger: means.ledger, fix: means.fix,
        undo: () => trustedWrite(actor, patch, { reason: "auditPutBack" }) };
}

/** A student's update: what it changed that the statistics' half of this file judges, against the mark. */
function actorFindings(actor, mark, changes) {
    const before = markAsDocument(mark), src = actor._source ?? actor.toObject();
    const lock = locked(), back = [], listed = [], change = {};
    for (const path of pathsOf(changes)) {
        const kind = kindOf(path);
        if (!kind || (kind === "experience" && !experienceCounts(path, before))) continue;
        const was = foundry.utils.getProperty(before, path), now = foundry.utils.getProperty(src, path);
        if (stableJson(was ?? null) === stableJson(now ?? null)) continue;
        if (kind === "pendingCall") {
            const all = [foundry.utils.getProperty(before, CALLS_PATH), foundry.utils.getProperty(src, CALLS_PATH)];
            if (addedEntries(...all).length && !(CALLS_PATH in change)) { back.push({ path: CALLS_PATH, kind }); change[CALLS_PATH] = all.map(v => clone(v) ?? null); }
            continue;
        }
        change[path] = [clone(was) ?? null, clone(now) ?? null];
        // The owner's Q2 (a): with the setting off, what its text names is listed and stands.
        if (!lock && (kind === "traits" || LOCK_NAMED_MAX.has(path))) listed.push({ path, kind });
        else back.push({ path, kind });
    }
    const patch = putBackPatch(before, back.filter(entry => entry.kind !== "pendingCall").map(entry => entry.path));
    if (back.some(entry => entry.kind === "pendingCall")) patch[CALLS_PATH] = armedPutBack(before, src);
    return { back, listed, change, patch };
}

/* ---------------------------------------------------------------------------
 * The means: Hope, actions, marks and grants (C4)
 * ------------------------------------------------------------------------- */

/** Whether a write names a path: a value, or v14's forced deletion of it (an operator is a value here). */
function names(changes, path) {
    return foundry.utils.hasProperty(changes ?? {}, path);
}

/** actorId -> each means as the last write this GM heard left it: `{ value, own, before }`, `own` a put-back of the GMs'. */
const heard = new Map();

/*
 * The means a write names, as the value the write before it left, in the order this GM heard
 * them - which is the order they landed. Kept as each hook runs, because the judge comes to a
 * write later, and by then the document may hold the writes after it.
 */
function noteWrite(actor, changes, options, userId) {
    if (actor?.type !== "character") return null;
    const held = heard.get(actor.id) ?? {};
    const own = game.users?.get(userId ?? "")?.isGM === true && options?.drpgWrite?.reason === "auditPutBack";
    const priors = {};
    for (const [key, { path }] of Object.entries(LEDGER)) {
        if (!names(changes, path)) continue;
        const value = Number(foundry.utils.getProperty(actor._source ?? {}, path)) || 0;
        priors[key] = held[key] ?? null;
        held[key] = { value, own, before: own ? held[key]?.value ?? null : null };
    }
    heard.set(actor.id, held);
    return priors;
}

/*
 * What a write's judgement needs from the moment it was heard: the means and the Rest stamps it
 * left (the document holds them as the hook runs; a later write may have moved them by the time the
 * judge reaches this one), the item an item use names as it stood before its consumption landed,
 * and when.
 */
function seenNow(actor, changes, options, priors) {
    const src = actor._source ?? {};
    const values = Object.fromEntries(Object.entries(LEDGER).filter(([, { path }]) => names(changes, path))
        .map(([key, { path }]) => [key, Number(foundry.utils.getProperty(src, path)) || 0]));
    const rests = names(changes, RESTS_PATH) ? clone(foundry.utils.getProperty(src, RESTS_PATH)) ?? null : undefined;
    // The armed list a write left (C8): a GM's is the GMs' (`heldCalls`).
    const calls = names(changes, CALLS_PATH) ? clone(foundry.utils.getProperty(src, CALLS_PATH)) ?? null : undefined;
    const stamp = options?.drpgWrite;
    const item = stamp?.reason === "itemUse" && stamp.ref ? actor.items?.get(stamp.ref)?.toObject?.() ?? null : null;
    return { at: Date.now(), values, rests, calls, item, priors };
}

/*
 * A GM's write: the GMs' value of each means it names, and what it spent added to the credit ("by
 * anyone", the plan's 2.5). An Undo (`auditUndo`, C5) adds none: it takes back a gain nothing paid
 * for, and as credit the same gain would stand again as the next refund.
 */
function gmLedger(actor, seen, { credit: credits = true } = {}) {
    const mark = sheetMarkStore.get(actor.id);
    if (!mark || !Object.keys(seen.values).length) return null;
    const values = ledgerOf(mark, actor), credit = creditOf(mark, seen.at);
    for (const [key, value] of Object.entries(seen.values)) {
        const spent = (value - values[key]) * LEDGER[key].cost;
        if (spent > 0 && credits) (credit[key] ??= []).push({ n: spent, at: seen.at });
        values[key] = value;
    }
    return { values, credit };
}

/** A means held within its bounds: 0, and a resource's maximum. */
function bounded(actor, key, n) {
    const max = LEDGER[key].path.startsWith("system.") ? Number(actor.system?.resources?.[key]?.max) : NaN;
    return Math.max(0, Number.isFinite(max) ? Math.min(max, n) : n);
}

/*
 * Each means a write names, as the move it made: from the value the write before it left
 * (`noteWrite`), or from the GMs' value where this GM heard none. A payment - a reason that only
 * spends Hope - that reads as a rise straight after a put-back of Hope was paid from the value the
 * put-back replaced, by a browser the put-back had not reached yet: it is measured from that one.
 * Without it a forged Hope spent at once on a Call cost nothing whenever the put-back landed
 * between the two. How often the two cross at a table is not measured (LIVE-E29-02).
 */
function movesOf(seen, values, stamp) {
    return Object.fromEntries(Object.entries(seen.values).map(([key, value]) => {
        const prior = seen.priors?.[key] ?? null;
        let base = prior ? prior.value : values[key];
        if (key === "hope" && prior?.own && PAYMENTS.has(stamp.reason) && prior.before !== null && value > prior.value && value < prior.before) base = prior.before;
        return [key, { base, value, d: value - base }];
    }));
}

/**
 * A student's means in a player's write (the plan's 2.4, 2.5): each fall - each rise of marks -
 * stands and is credit; each gain stands as far as the write's reason covers it (`coverOf`). What
 * nothing covers in Hope is put back as a delta with `lockPlayerResources` on: the GMs' Hope moves
 * by what was covered only, and the document is written to it - so a forged Hope spent at once
 * still costs real Hope. What nothing covers of the others stands and is flagged (`gainVerdict`),
 * its change the part uncovered: from the value the cover allowed - what Undo writes back - to the
 * value written. A Rest stamp nothing covers is put back. A legal payment that crossed a put-back
 * brings the document to the GMs' Hope too (`fix`), without a word: the put-back was told already.
 */
async function meansFindings(actor, mark, user, options, seen) {
    const stamp = options?.drpgWrite ?? {}, lock = locked();
    const out = { back: [], listed: [], flagged: [], change: {}, patch: {}, covered: {}, ledger: null, fix: false };
    const restsMoved = seen.rests !== undefined && stableJson(seen.rests ?? null) !== stableJson(mark.flags?.[FLAGS.restsTaken] ?? null);
    if (!Object.keys(seen.values).length && !restsMoved) return out;
    const values = ledgerOf(mark, actor), credit = creditOf(mark, seen.at);
    const moves = movesOf(seen, values, stamp), gains = {};
    for (const [key, move] of Object.entries(moves)) {
        const spent = move.d * LEDGER[key].cost;
        if (spent < 0) {
            gains[key] = -spent;
            continue;
        }
        const next = bounded(actor, key, values[key] + move.d), n = Math.abs(next - values[key]);
        if (n) (credit[key] ??= []).push({ n, at: seen.at });
        values[key] = next;
    }
    const judged = Object.keys(gains).length || restsMoved
        ? await coverOf(actor, mark, credit, gains, moves, stamp, user, seen) : { covers: {}, rest: false, taken: {} };
    for (const [key, gain] of Object.entries(gains)) {
        const covered = Math.min(gain, judged.covers[key] ?? 0), verdict = gainVerdict(key, lock);
        values[key] = bounded(actor, key, values[key] - LEDGER[key].cost * (verdict === "back" ? covered : gain));
        if (covered === gain) continue;
        const { path, kind, cost } = LEDGER[key];
        const from = verdict === "flagged" ? moves[key].value + (gain - covered) * cost : moves[key].base;
        out.change[path] = [from, moves[key].value];
        out[verdict].push({ path, kind });
    }
    if (restsMoved && !judged.rest) {
        out.back.push({ path: RESTS_PATH, kind: "flag" });
        out.change[RESTS_PATH] = [clone(mark.flags?.[FLAGS.restsTaken]) ?? null, clone(seen.rests) ?? null];
        Object.assign(out.patch, putBackPatch(markAsDocument(mark), [RESTS_PATH]));
    }
    const hopeNow = Number(foundry.utils.getProperty(actor._source ?? {}, LEDGER.hope.path)) || 0;
    if (lock && "hope" in seen.values && hopeNow !== values.hope) {
        out.patch[LEDGER.hope.path] = values.hope;
        out.fix = true;
    }
    out.covered = judged.taken;
    out.ledger = { values, credit };
    return out;
}

/*
 * What becomes of a gain nothing covers (the plan's 2.4; the owner's Q2 (a), 05.10.2026): `back`,
 * `flagged` or `listed`. With `lockPlayerResources` on, Hope is put back and Health, Sanity and
 * actions are flagged; off, the fields its text names are listed and stand. The Burst and Sprint
 * grants are flags the setting does not name: flagged either way.
 */
function gainVerdict(key, lock) {
    if (LEDGER[key].kind === "grant") return "flagged";
    if (!lock) return "listed";
    return key === "hope" ? "back" : "flagged";
}

/** What a write's reason covers of its gains (the plan's 2.5's judges): `{ covers, rest, taken }`, `taken` the credit a refund took. */
async function coverOf(actor, mark, credit, gains, moves, stamp, user, seen) {
    const none = { covers: {}, rest: false, taken: {} };
    if (REFUNDS.has(stamp.reason)) {
        const covers = Object.fromEntries(Object.entries(gains).map(([key, gain]) => [key, takeCredit(credit, key, gain)]));
        return { covers, rest: false, taken: Object.fromEntries(Object.entries(covers).filter(([, n]) => n > 0)) };
    }
    if (stamp.reason === "rest") {
        const covers = await restCovers(actor, mark, credit, gains, moves, stamp.ref, seen);
        return covers ? { ...none, covers, rest: true } : none;
    }
    if (stamp.reason === "itemUse") return { ...none, covers: (await itemCovers(gains, stamp.ref, user, seen)) ?? {} };
    if (stamp.reason === "call") return { ...none, covers: callCovers(credit, gains, stamp.ref) };
    return none;
}

/*
 * A Rest (the plan's 2.5): its stamp moves to the clock's for one kind and was not there; the room
 * the GM sees the character in allows that kind; its action was paid - an action, or a Burst, spent
 * and not yet taken back; each gain is within its pick (all marks for a long rest, half rounded up
 * for a short; Breath 2 or 1 Hope) and no more picks than the kind allows. A Relief's free rest
 * (`ref` "relief") moves no stamp and is paid by that Call's price instead of the room and the
 * action. Answers what it covers, or null - and then its stamp goes back too.
 */
async function restCovers(actor, mark, credit, gains, moves, ref, seen) {
    const { restStamp, roomAllows } = await import("./rest.mjs");
    const relief = ref === "relief";
    const was = mark.flags?.[FLAGS.restsTaken] ?? {}, now = seen.rests === undefined ? was : seen.rests ?? {};
    const moved = Object.keys({ ...was, ...now }).filter(key => was[key] !== now[key]);
    let kind = HOPE_CALLS.relief?.freeRest;
    if (relief ? moved.length : moved.length !== 1) return null;
    if (!relief) {
        kind = moved[0];
        if (!REST[kind] || now[kind] !== restStamp(kind, getClock())) return null;
        const { roomOfActor } = await import("./movement.mjs");
        if (!roomAllows(roomOfActor(actor), kind)) return null;
    }
    const rules = REST[kind];
    if (!rules) return null;
    const full = kind === "long";
    const marks = key => moves[key]?.base ?? 0;
    const allowed = { hope: full ? 2 : 1, hitPoints: full ? marks("hitPoints") : Math.ceil(marks("hitPoints") / 2),
        stress: full ? marks("stress") : Math.ceil(marks("stress") / 2) };
    const picked = Object.keys(gains);
    if (picked.length > rules.picks || picked.some(key => !(gains[key] <= (allowed[key] ?? 0)))) return null;
    const paid = relief ? takeAll(credit, "hope", HOPE_CALLS.relief.cost)
        : takeAll(credit, "actions", rules.actionCost) || takeAll(credit, "freeActionGrants", 1);
    return paid ? { ...gains } : null;
}

/*
 * An item used (the plan's 2.5): the item the write names as it stood when the write was heard -
 * this student's, usable, not broken, not stashed, of a tier with a row in `USABLE_EFFECTS` - each
 * gain within that row (one of Health or Sanity, Hope only where the row adds it), and its
 * consumption (a count lowered, or broken) by the same user within `JUDGE_WAIT_MS` of the write.
 */
async function itemCovers(gains, ref, user, seen) {
    const src = seen.item;
    if (!src || src._id !== ref || !user) return null;
    const item = itemLike(src);
    const { isUsable, tierOf, usableKindOf } = await import("./use-items.mjs");
    if (!isUsable(item) || isBroken(item) || isStashed(item)) return null;
    const effect = USABLE_EFFECTS[tierOf(item)];
    if (!effect || effect.creative) return null;
    const resource = USABLE_KINDS[usableKindOf(item)]?.resource;
    const healing = effect.choose ?? (resource ? [resource] : ["hitPoints", "stress"]);
    const allowed = { hope: effect.bonus?.hope ?? 0, ...Object.fromEntries(healing.map(key => [key, effect.amount])) };
    if (Object.keys(gains).filter(key => key !== "hope").length > 1 || Object.entries(gains).some(([key, gain]) => !(gain <= (allowed[key] ?? 0)))) return null;
    return await consumedBy(src._id, user.id, seen.at) ? { ...gains } : null;
}

/* A Call's grant (the plan's 2.5): a Burst's or a Sprint's count rises by what that Call banks, paid by its price in Hope spent and not taken back. */
function callCovers(credit, gains, ref) {
    const covers = {};
    for (const [key, field] of [["freeActionGrants", "freeActions"], ["freeMoveGrants", "freeMoves"]]) {
        const gain = gains[key];
        const call = gain ? Object.entries(HOPE_CALLS).find(([id, def]) => (!ref || id === ref) && def[field] === gain)?.[1] : null;
        if (call && takeAll(credit, "hope", call.cost)) covers[key] = gain;
    }
    return covers;
}

/** Each module item's consumption this GM heard, `{ itemId, userId, at }`, oldest first, kept half a minute. */
const consumptions = [];
const consumptionWaiters = new Set();

/** Resolves true once that user's consumption of that item, heard within `JUDGE_WAIT_MS` of `from`, is matched (once). */
function consumedBy(itemId, userId, from) {
    const match = () => {
        const at = consumptions.findIndex(c => c.itemId === itemId && c.userId === userId && c.at >= from && c.at <= from + JUDGE_WAIT_MS);
        if (at >= 0) consumptions.splice(at, 1);
        return at >= 0;
    };
    if (match()) return Promise.resolve(true);
    return new Promise(resolve => {
        const done = found => { clearTimeout(timer); consumptionWaiters.delete(waiter); resolve(found); };
        const waiter = () => { if (match()) done(true); };
        const timer = setTimeout(() => done(match()), Math.max(0, from + JUDGE_WAIT_MS - Date.now()));
        consumptionWaiters.add(waiter);
    });
}

/**
 * WHAT A GM'S HOOK HEARS OF AN ITEM (exported for tier 2, as `onSheetWrite`): on the primary, a
 * module item of a character whose count was written or which was broken is a consumption the
 * item-use judge waits for. The write itself is judged as any other (`itemFindings`, C6).
 */
export function onItemWrite(item, changes, options, userId, { primary = isPrimaryGm() } = {}) {
    if (!primary || item?.parent?.type !== "character") return;
    const flat = foundry.utils.flattenObject(changes ?? {});
    const broke = Object.entries(flat).some(([key, value]) => key.startsWith(`flags.${MODULE_ID}.${ITEM_FLAGS.broken}`) && value);
    if (!("system.quantity" in flat) && !broke) return;
    const at = Date.now();
    consumptions.push({ itemId: item.id, userId, at });
    while (consumptions.length && consumptions[0].at < at - 30_000) consumptions.shift();
    for (const waiter of [...consumptionWaiters]) waiter();
}

/** The Daggerheart rolls whose gain a relay write was covered by, on this GM (a reload forgets them; each covers for a minute). */
const rollsCounted = new Set();

/** The latest Daggerheart roll that covers `need`: that user's, about that student, recent, not drawn, not a reaction, not counted. */
function rollCovering(actor, sender, need) {
    const since = Date.now() - ROLL_COVER_MS, messages = game.messages?.contents ?? [];
    for (let i = messages.length - 1; i >= 0; i--) {
        const message = messages[i];
        if ((message.timestamp ?? 0) < since || rollsCounted.has(message.id)) continue;
        if (message.author?.id !== sender.id || message.speaker?.actor !== actor.id) continue;
        if (message.getFlag?.(MODULE_ID, "drawn") || message.rolls?.[0]?.options?.actionType === "reaction") continue;
        const duality = readDuality(message);
        if (!duality) continue;
        const gives = { hope: duality.isCritical ? CRITICAL.hope : duality.withHope ? 1 : 0, stress: duality.isCritical && CRITICAL.clearsStress ? 1 : 0 };
        if (Object.entries(need).every(([key, n]) => n <= (gives[key] ?? 0))) return message;
    }
    return null;
}

/**
 * WHAT THE RELAY ASKS (the plan's 2.7; relay-guard.mjs `actorRefusal`), on the primary, of a
 * write Daggerheart sends for a player on their own student: Hope or actions may fall and marks
 * rise; a gain, measured from the GMs' value, stands only as far as a Daggerheart roll covers it -
 * a duality roll that user wrote about that student in the last `ROLL_COVER_MS`, with Hope or a
 * critical (`CRITICAL`'s Hope), not drawn by the GM, not a reaction, not counted before. Answers
 * why not, or null. With `lockPlayerResources` off, null (the owner's Q2 (a)).
 */
export function relayGainRefusal(actor, flat, sender) {
    if (actor?.type !== "character" || !sender || sender.isGM || !locked()) return null;
    const mark = sheetMarkStore.get(actor.id);
    if (!mark || mark.flags?.[FLAGS.monokuma]) return null;
    const values = ledgerOf(mark, actor), need = {};
    for (const [key, { path, cost }] of Object.entries(LEDGER)) {
        const gain = path in flat ? (values[key] - Number(flat[path])) * cost : 0;
        if (gain > 0) need[key] = gain;
    }
    if (!Object.keys(need).length) return null;
    const roll = rollCovering(actor, sender, need);
    if (!roll) return `${Object.keys(need).join(", ")} raised on ${actor.name} with no roll of theirs to give it`;
    rollsCounted.add(roll.id);
    return null;
}

/* ---------------------------------------------------------------------------
 * The module's items (C6)
 * ------------------------------------------------------------------------- */

/** The module flag an item's path writes (`flags.<module>.broken.at` is `broken`'s, `-=wear` is `wear`'s), or null. */
function itemFlagOf(path) {
    const prefix = `flags.${MODULE_ID}.`;
    return path.startsWith(prefix) ? path.slice(prefix.length).split(".")[0].replace(/^-=/, "") : null;
}

/** A path of an item's update this file judges, as the flag or the count it names, or null. */
function itemPathOf(path) {
    if (path === "system.quantity") return path;
    const flag = itemFlagOf(path);
    return [...ITEM_FIXED, ITEM_FLAGS.broken, ITEM_FLAGS.wear, ...ITEM_PLACE].includes(flag) ? `flags.${MODULE_ID}.${flag}` : null;
}

/** An item's data with `paths` as they were in `before` (absent where they were absent). */
function withPaths(data, before, paths) {
    const out = clone(data);
    for (const path of paths) {
        const value = foundry.utils.getProperty(before, path);
        if (value !== undefined) {
            foundry.utils.setProperty(out, path, clone(value));
            continue;
        }
        const parts = path.split("."), key = parts.pop(), parent = foundry.utils.getProperty(out, parts.join("."));
        if (parent && typeof parent === "object") delete parent[key];
    }
    return out;
}

/*
 * A WRITE ON AN ITEM OF A STUDENT (the plan's 2.6), answered as `updateFindings` answers, with
 * the items the mark holds after it (`items`), the item's id for the row, a deleted item's data
 * for an Undo (`data`) and a Search's finds (`finds`). A row names the item itself as
 * `items.<id>` and a field of it as `items.<id>.<path>`. A module item is judged against its
 * copy in the mark; an item the GMs hold no copy of is not the module's, and only a category
 * written onto it - which would make it one - is put back.
 */
async function itemFindings(kind, item, actor, mark, changes, user, options, seen) {
    const id = item.id, held = mark.items?.[id] ?? null, now = seen?.item ?? null, stamp = options?.drpgWrite ?? {};
    const whole = `items.${id}`;
    const out = { back: [], listed: [], flagged: [], change: {}, itemId: id, items: itemsAfter(mark, item, now), undo: async () => null };
    if (kind === "deleteItem") {
        if (!held || (stamp.reason === "discard" && isBroken(itemLike(held)))) return out;
        out.flagged.push({ path: whole, kind: "itemDeleted" });
        out.change[whole] = [held.name ?? null, null];
        out.data = held;
        return out;
    }
    if (kind === "createItem") {
        const finds = now ? await searchFind(actor, mark, now, stamp, user) : null;
        if (finds) return { ...out, finds };
        out.flagged.push({ path: whole, kind: "itemCreated" });
        out.change[whole] = [null, now?.name ?? item.name ?? null];
        return out;
    }
    if (!now) return out;
    const CATEGORY = `flags.${MODULE_ID}.${ITEM_FLAGS.category}`;
    const before = held ?? withPaths(now, {}, [CATEGORY]);
    const moved = [...new Set(pathsOf(changes).map(itemPathOf).filter(Boolean))].filter(path => (held || path === CATEGORY)
        && stableJson(foundry.utils.getProperty(before, path) ?? null) !== stableJson(foundry.utils.getProperty(now, path) ?? null));
    const back = [];
    for (const path of moved) {
        const flag = itemFlagOf(path), was = foundry.utils.getProperty(before, path), is = foundry.utils.getProperty(now, path);
        if (ITEM_PLACE.includes(flag)) continue;
        // The ways a use, a break and wear spend an item: broken (or broken again), worn further, fewer left.
        if (flag === ITEM_FLAGS.broken && is) continue;
        if (flag === ITEM_FLAGS.wear && Number(is ?? 0) > Number(was ?? 0)) continue;
        if (path === "system.quantity" && Number(is) < Number(was)) continue;
        back.push({ path, kind: path === "system.quantity" ? "itemQuantity" : "itemFlag" });
    }
    if (moved.some(path => ITEM_PLACE.includes(itemFlagOf(path))) && !await placeStands(actor, item, before, now)) {
        back.push(...moved.filter(path => ITEM_PLACE.includes(itemFlagOf(path))).map(path => ({ path, kind: "itemLocation" })));
    }
    if (!back.length) return out;
    const paths = back.map(entry => entry.path);
    for (const path of paths) out.change[`${whole}.${path}`] = [clone(foundry.utils.getProperty(before, path)) ?? null, clone(foundry.utils.getProperty(now, path)) ?? null];
    out.back = back.map(entry => ({ ...entry, path: `${whole}.${entry.path}` }));
    const patch = putBackPatch(before, paths);
    out.undo = () => trustedWrite(item, patch, { reason: "auditPutBack" });
    out.items = itemsAfter(mark, item, withPaths(now, before, paths));
    return out;
}

/*
 * A STASH OR A RETRIEVE (the plan's 2.6), read on this GM. The student stands in a room with a
 * stash of theirs (vault.mjs `myStashHere`, as `stow` and `retrieve` ask it on the player's
 * browser); a thing put away goes into that room's stash, is no Truth Bullet, and the stash holds
 * fewer than `VAULT_LIMIT` besides it; a thing taken out comes from that room's stash, and the carry
 * cap has room for it besides. Which stash an item is in is read as `stashRoomOfItem` reads it (an
 * unaddressed one is in the primary). A move from one stash to another is no road of the module's.
 */
async function placeStands(actor, item, before, now) {
    const V = await import("./vault.mjs");
    const stashOf = data => isStashed(itemLike(data)) ? V.stashRoomOfItem(itemLike(data), actor) : null;
    const was = stashOf(before), is = stashOf(now);
    if (was === is) return true;
    const room = await V.myStashHere(actor);
    if (!room) return false;
    const category = foundry.utils.getProperty(now, `flags.${MODULE_ID}.${ITEM_FLAGS.category}`);
    if (is !== null) {
        return was === null && is === room && category !== "truthBullet"
            && V.stashItemsIn(actor, room).filter(other => other.id !== item.id).length < VAULT_LIMIT;
    }
    if (was !== room) return false;
    const cap = canCarry(actor, category);
    return cap.limit === null || cap.held - (isStashed(item) ? 0 : 1) < cap.limit;
}

/*
 * A SEARCH'S FIND (the plan's 2.6): an item created `searchFind`, its `ref` the GMs' record of a
 * Search (roll-draw.mjs `rollRecord`; action-rolls.mjs `grantDrawn` names it) of this student by
 * this player that hit, not used for a find before, and the item's tier at most what the record's
 * total - with the hidden stash's step the GM drew - earns on the Search's table (action-rolls.mjs
 * `searchTier`, the reading the Search itself makes). Answers the student's finds with this one in
 * them, or null. A find whose record is swept is forgotten with it: a record past a Reroll's reach
 * names no find any more.
 *
 * NOT A SEARCH THAT ENDED WITHOUT A DRAW (round 1's m6, 05.10.2026). A hit asked of the GM ("something
 * specific", action-rolls.mjs `searchSpecific`) or taken from a stash (`searchStash`) creates nothing
 * through `grantDrawn`, so its record stayed unused and a console's item named after it stood - a
 * second item for one Search. The record now keeps the Search's goal as the roller sent it (roll-draw.mjs
 * `CONTEXT_SENT`, the roller's word like the category beside it), and a stash's theft settles the
 * record's "search" (bridge-guards.mjs `rollsFor`); a find on either is refused. The other way round,
 * a theft named after a record a find already stood on is refused by gm-bridge.mjs `searchTheftOf`.
 */
async function searchFind(actor, mark, data, stamp, user) {
    if (stamp.reason !== "searchFind" || typeof stamp.ref !== "string" || !user || !isModuleItem(data)) return null;
    const { rollRecord } = await import("./roll-draw.mjs");
    const record = rollRecord(stamp.ref);
    if (record?.actorId !== actor.id || record.userId !== user.id || record.actionKey !== "search" || mark.finds?.[stamp.ref]) return null;
    if (record.goal === "specific" || (Array.isArray(record.resolved) && record.resolved.includes("search"))) return null;
    const { searchTier } = await import("./action-rolls.mjs");
    const { hit, tier } = searchTier({ total: record.total, isCritical: record.isCritical }, record.used?.stash?.change ?? 0);
    const found = foundry.utils.getProperty(data, `flags.${MODULE_ID}.${ITEM_FLAGS.tier}`);
    if ((!hit && !record.isCritical) || !Number.isInteger(found) || found > tier) return null;
    const kept = Object.entries(mark.finds ?? {}).filter(([rollId]) => rollStore.has(rollId));
    return { ...Object.fromEntries(kept), [stamp.ref]: data._id };
}

/** An effect created, changed or deleted on a student: put back when it carries what a roll is built from, before or after. */
function effectFindings(kind, effect, mark, changes) {
    const actor = effect.parent, id = effect.id, held = mark.effects?.[id] ?? null, now = kind === "deleteActiveEffect" ? null : docData(effect);
    const summary = data => data ? { name: data.name ?? null, statuses: [...(data.statuses ?? [])],
        changes: [...(data.system?.changes ?? []), ...(data.changes ?? [])].map(c => `${c?.key}=${c?.value}`) } : null;
    const path = `effects.${id}`;
    const none = { back: [], listed: [], change: {}, undo: async () => null };
    if (kind === "createActiveEffect") {
        if (!rollRelevant(now)) return none;
        return { back: [{ path, kind: "effect" }], listed: [], change: { [path]: [null, summary(now)] },
            undo: () => trustedDelete(effect, { reason: "auditPutBack" }) };
    }
    if (kind === "deleteActiveEffect") {
        if (!rollRelevant(held)) return none;
        return { back: [{ path, kind: "effect" }], listed: [], change: { [path]: [summary(held), null] },
            undo: () => trustedCreate(actor, [held], { reason: "auditPutBack", documentName: "ActiveEffect", keepId: true }) };
    }
    if (!rollRelevant(held) && !rollRelevant(now)) return none;
    // Changed into one a roll is built from with no mark of what it was: taken off whole.
    if (!held) return { back: [{ path, kind: "effect" }], listed: [], change: { [path]: [null, summary(now)] },
        undo: () => trustedDelete(effect, { reason: "auditPutBack" }) };
    const paths = pathsOf(changes).filter(p => stableJson(foundry.utils.getProperty(held, p) ?? null) !== stableJson(foundry.utils.getProperty(now, p) ?? null));
    if (!paths.length) return none;
    const patch = putBackPatch(held, paths);
    return { back: [{ path, kind: "effect" }], listed: [], change: { [path]: [summary(held), summary(now)] },
        undo: () => trustedWrite(effect, patch, { reason: "auditPutBack" }) };
}

/* ---------------------------------------------------------------------------
 * What is said, and kept
 * ------------------------------------------------------------------------- */

/** A value as the GMs' whisper shows it: short JSON, a dash for nothing. */
function shown(value) {
    if (value === null || value === undefined) return "-";
    const text = typeof value === "string" ? value : JSON.stringify(value);
    return text.length > 80 ? `${text.slice(0, 77)}...` : text;
}

/**
 * A put-back is told to its writer once (`sheetPutBack`, its first field's kind named in
 * their language: bridge-guards.mjs `requestLabel`) and whispered to the GMs once, each
 * field before and after; what is flagged gets the GMs' card (`flaggedCard`) and nothing
 * for the writer; a row for each, and one for what was listed, go into `sheetWrites`.
 */
async function record(actor, user, found, options) {
    const stamp = options?.drpgWrite ?? {};
    const at = Date.now();
    const rows = {};
    const row = (verdict, entries, messageId) => ({
        actorId: actor.id, itemId: found.itemId ?? null, userId: user?.id ?? null, reason: stamp.reason ?? null, ref: stamp.ref ?? null,
        change: Object.fromEntries(entries.map(entry => [entry.path, found.change[entry.path]]).filter(([, v]) => v !== undefined)),
        covered: Object.keys(found.covered ?? {}).length ? found.covered : null,
        verdict, messageId, decided: null, at
    });
    if (found.back.length) {
        tellRefused(user?.id ?? null, `sheet.${found.back[0].kind}`, null, "sheetPutBack");
        const lines = found.back.map(entry => {
            const [was, now] = found.change[entry.path] ?? [];
            return `<li>${esc(game.i18n.localize(`DRPG.Audit.field.${entry.kind}`))} (${esc(entry.path)}): ${esc(shown(was))} -> ${esc(shown(now))}</li>`;
        }).join("");
        let message = null;
        try {
            message = await whisperToGms(`<p class="drpg-warning">${esc(game.i18n.format("DRPG.Audit.putBack", {
                player: user?.name ?? "?", name: actor.name }))}</p><ul>${lines}</ul>`, { flags: { [MODULE_ID]: { sheetAudit: actor.id } } });
        } catch (err) {
            error("Could not tell the GMs of a write put back", err);
        }
        rows[foundry.utils.randomID()] = row("putBack", found.back, message?.id ?? null);
    }
    if (found.flagged?.length) {
        // A deleted item's data goes with its row, for an Undo to make it again (C6).
        const id = foundry.utils.randomID(), flagged = { ...row("flagged", found.flagged, null), ...(found.data ? { data: found.data } : {}) };
        let message = null;
        try {
            message = await whisperToGms(flaggedCard(flagged), { flags: { [MODULE_ID]: { sheetAudit: actor.id, [FLAGGED_CARD]: id } } });
        } catch (err) {
            error("Could not ask the GMs about a write flagged to them", err);
        }
        rows[id] = { ...flagged, messageId: message?.id ?? null };
    }
    if (found.listed.length) rows[foundry.utils.randomID()] = row("listed", found.listed, null);
    if (!Object.keys(rows).length) return;
    await keepRows(rows, at);
    debug(`The GMs' audit: ${user?.name ?? "?"} on ${actor.name}: ${Object.values(rows).map(r => r.verdict).join(", ")}.`);
}

/** Rows into `sheetWrites`, every row older than a day swept as they go in. */
async function keepRows(rows, at) {
    const old = Object.entries(sheetWriteStore.entries() ?? {}).filter(([, kept]) => !(kept?.at >= at - ROW_KEPT_MS)).map(([id]) => id);
    if (old.length) await sheetWriteStore.dropMany(old);
    await sheetWriteStore.patchMany(rows);
}

/* ---------------------------------------------------------------------------
 * The GMs' card: Undo and Keep (C5)
 * ------------------------------------------------------------------------- */

/**
 * The kind of field a row's path is, for its label: an item deleted or created (C6) by its change, an
 * item's field or an effect (C7) as their judges name them, a means by its ledger's kind, anything else
 * as `kindOf` reads it.
 */
function fieldKind(path, [, now] = []) {
    if (/^items\.[^.]+$/.test(path)) return now === null ? "itemDeleted" : "itemCreated";
    // A field of an item or an effect put back at ready (C7), as `itemFindings` and `effectFindings` name theirs.
    if (/^effects\./.test(path)) return "effect";
    const inItem = /^items\.[^.]+\.(.+)$/.exec(path)?.[1];
    if (inItem) return inItem === "system.quantity" ? "itemQuantity" : ITEM_PLACE.includes(itemFlagOf(inItem)) ? "itemLocation" : "itemFlag";
    return Object.values(LEDGER).find(entry => entry.path === path)?.kind ?? kindOf(path) ?? "flag";
}

/**
 * THE CARD OF A FLAGGED WRITE (the plan's 2.8): who, which student, each field before and after,
 * and Undo and Keep while nobody has decided - then, in their place, what was decided and by
 * whom. Built from the row alone, so the primary writes it whole again once a GM decides.
 */
function flaggedCard(row) {
    const name = game.actors.get(row.actorId)?.name ?? "?", player = game.users.get(row.userId ?? "")?.name ?? "?";
    const label = path => game.i18n.localize(`DRPG.Audit.field.${fieldKind(path, row.change?.[path])}`);
    const lines = Object.entries(row.change ?? {}).map(([path, [was, now] = []]) =>
        `<li>${esc(label(path))} (${esc(path)}): ${esc(shown(was))} -> ${esc(shown(now))}</li>`).join("");
    const foot = row.decided ? decidedWords(row.decided, label)
        : `<div class="drpg-audit-actions"><button type="button" data-drpg-audit="undo">${esc(game.i18n.localize("DRPG.Audit.undo"))}</button>`
        + `<button type="button" data-drpg-audit="keep">${esc(game.i18n.localize("DRPG.Audit.keep"))}</button></div>`;
    return `<div class="drpg-audit-card"><p class="drpg-warning">${esc(game.i18n.format("DRPG.Audit.flagged", { player, name }))}</p><ul>${lines}</ul>${foot}</div>`;
}

/** What a GM decided of a row, in the words both cards give it: kept, undone, and what had moved since. */
function decidedWords(decided, label) {
    const gm = game.users.get(decided.by ?? "")?.name ?? "?", said = [];
    if (decided.how === "keep") said.push(["drpg-audit-kept", game.i18n.format("DRPG.Audit.kept", { gm })]);
    if (decided.undone?.length) said.push(["drpg-audit-undone", game.i18n.format("DRPG.Audit.undone", { gm })]);
    if (decided.moved?.length) said.push(["drpg-audit-moved", game.i18n.format("DRPG.Audit.changedSince", { gm, fields: decided.moved.map(label).join(", ") })]);
    return said.map(([cls, text]) => `<p class="${cls}">${esc(text)}</p>`).join("");
}

/** This GM's decisions, one after another (`decideWrite`). */
let decisions = Promise.resolve();

/**
 * UNDO OR KEEP, DECIDED ONCE (the plan's 2.8, 2.9). Made on the primary GM - a click on another
 * GM's browser asks it (`askToDecideWrite`) - one decision after another, so a second click, from
 * this GM or another, finds the row decided and does nothing. The row is marked decided - who,
 * when, which, what was written back and what had moved - before anything is written. Keep writes
 * nothing. Undo writes each field back to its before-value only while the field still holds the
 * value the write left: a field moved since is not written over, and the card names it. Queued
 * behind the writes on that student (`inOrder`), so a later change is the document's by the time
 * it reads. The card is written again for every GM. Answers the decision, or null where there
 * was none to make. Exported for tier 2, as `judgeWrite`.
 *
 * A before-value that is an object goes back whole (`wholeValue`), as a put-back writes it
 * (`putBackPatch`). Written plainly, Foundry merged it into what the player made of it: the
 * review's probe (round 1's m1, 05.10.2026) undid a Rest stamp row of `{short}` -> `{short, long}`,
 * the row and the card said "undone" and the flag still held `{short, long}`.
 *
 * AN ITEM (C6): a deleted one still gone is made again under its id from the row's copy - the
 * carry cap does not refuse what was there - and a created one still there is deleted; one made
 * again or deleted since is the field that moved.
 */
export function decideWrite(rowId, keep, by = game.user?.id ?? null) {
    const run = decisions.then(() => decideNow(rowId, keep === true, by));
    decisions = run.catch(() => null);
    return run;
}

async function decideNow(rowId, keep, by) {
    const row = typeof rowId === "string" ? sheetWriteStore.get(rowId) : null;
    if (!game.user?.isGM || row?.verdict !== "flagged" || row.decided) return null;
    return inOrder(row.actorId, async () => {
        const actor = game.actors.get(row.actorId) ?? null, src = actor?._source ?? {};
        const paths = Object.keys(row.change ?? {}), whole = row.itemId ? `items.${row.itemId}` : null;
        const deleted = whole && row.change[whole]?.[1] === null;
        const holds = path => path === whole ? Boolean(actor.items?.get(row.itemId)) !== deleted && (!deleted || Boolean(row.data))
            : stableJson(foundry.utils.getProperty(src, path) ?? null) === stableJson(row.change[path]?.[1] ?? null);
        const undone = keep || !actor ? [] : paths.filter(holds);
        const decided = { by, at: Date.now(), how: keep ? "keep" : "undo", undone, moved: keep ? [] : paths.filter(path => !undone.includes(path)) };
        await sheetWriteStore.patch(rowId, { decided });
        const fields = undone.filter(path => path !== whole);
        if (fields.length) await trustedWrite(actor, Object.fromEntries(fields.map(path => [path, wholeValue(row.change[path][0])])), { reason: "auditUndo" });
        if (undone.includes(whole) && deleted) await trustedCreate(actor, [row.data], { reason: "auditUndo", keepId: true, [CAP_OVERRIDE]: true });
        else if (undone.includes(whole)) await trustedDelete(actor.items.get(row.itemId), { reason: "auditUndo" });
        const card = game.messages.get(row.messageId ?? "");
        // A row of the card of changes made with no GM watching (C7): that card, every row of it, as the store now holds them.
        if (card && row.away) await updateSecret(card, awayCard(awayRowsOf(row.messageId)), null, { [AWAY_CARD]: cardFlag(card, AWAY_CARD) ?? [] });
        else if (card) await updateSecret(card, flaggedCard({ ...row, decided }), null, { sheetAudit: row.actorId, [FLAGGED_CARD]: rowId });
        return decided;
    });
}

/**
 * A GM's click on the card, decided on the primary GM (`audit.decide`, gm-bridge.mjs): here when
 * this is the primary, asked of it otherwise - the shape roll-draw.mjs `askToDecide` gives Grant
 * all (E08+E28 fix r2-H7). Answers the decision, or null.
 */
export async function askToDecideWrite(rowId, keep) {
    const res = await bridgeRequest("audit.decide", { rowId, keep: keep === true }, {
        settle: "reply", onPrimary: true, local: () => decideWrite(rowId, keep) });
    return res.ok ? res.value ?? null : null;
}

/*
 * A CARD WHOSE ROWS ARE SWEPT (round 1's m8, 05.10.2026). A row is kept a day (`keepRows`), its
 * card for as long as the chat log keeps it; until this fix such a card kept its buttons, a click
 * took them off, `decideNow` found no row and answered null, and the next render drew them again -
 * buttons that decided nothing and said nothing. A card is swept when every row it names is gone
 * from the hydrated store and the card is older than a row is kept: a younger card without its row
 * is one whose row is still on its way (the card is posted before the row is written, `record`), and
 * a row older than a day is only dropped when the next rows go in, so until then it still decides.
 * Read by tier 2 on a card of its own; not seen at a table, where a card that old is a day's play away.
 *
 * Drawn a microtask later, once the hook has run every listener: secret.mjs's swap - a listener of
 * the same hook, registered after this one - writes the card's words into it again, buttons and all.
 * Taken off at once, they were back by the time the hook returned (05.10.2026, e29run/r1g8probe:
 * the sweep's test was true and the drawn card still held its button).
 */
function sweptCard(message, ids) {
    return gmStoresHydrated() && ids.length > 0 && ids.every(id => !sheetWriteStore.has(id))
        && Number(message?.timestamp) < Date.now() - ROW_KEPT_MS;
}

/** A swept card drawn without its buttons, and one line that it can no longer be decided. */
function drawSwept(element) {
    element.querySelectorAll(".drpg-audit-actions, .drpg-audit-all").forEach(el => el.remove());
    if (element.querySelector(".drpg-audit-expired")) return;
    const line = document.createElement("p");
    line.className = "drpg-audit-expired";
    line.textContent = game.i18n.localize("DRPG.Audit.expired");
    (element.querySelector(".drpg-audit-card") ?? element).append(line);
}

/**
 * The card's two buttons, wired on a GM's browser for a card a GM posted, as roll-draw.mjs
 * `onRenderUnwitnessed` wires Grant all; taken off once the row every GM holds is decided. A row
 * not here yet - the card can arrive before the store's sync - leaves them on; a row swept
 * (`sweptCard`) takes them off and says so.
 */
function onRenderFlagged(message, element) {
    try {
        if (!game.user?.isGM || !cardWriter(message)?.isGM) return;
        const away = cardFlag(message, AWAY_CARD);
        if (Array.isArray(away)) return void (sweptCard(message, away) ? queueMicrotask(() => drawSwept(element)) : wireAwayCard(away, element));
        const rowId = cardFlag(message, FLAGGED_CARD);
        if (typeof rowId !== "string") return;
        if (sweptCard(message, [rowId])) return void queueMicrotask(() => drawSwept(element));
        if (sheetWriteStore.get(rowId)?.decided) return void element.querySelector(".drpg-audit-actions")?.remove();
        element.addEventListener("click", async event => {
            const button = event.target?.closest?.("[data-drpg-audit]");
            if (!button) return;
            event.preventDefault();
            element.querySelector(".drpg-audit-actions")?.remove();
            await askToDecideWrite(rowId, button.dataset.drpgAudit === "keep");
        });
    } catch (err) {
        error("Could not draw the GMs' card of a flagged write", err);
    }
}

/* ---------------------------------------------------------------------------
 * With no GM watching (C7)
 * ------------------------------------------------------------------------- */

/** actorId -> what the writes judged on this browser before its stores hydrated named: the mark could not take them then. */
const unmarked = new Map();

/**
 * A write judged before this browser's stores hydrated (`refreshMark` waits for them): a GM's -
 * the primary's own writes at its `ready` - or a player's, already judged. The comparison at
 * ready takes what it names as it stands rather than as a difference nobody judged. An effect
 * or an item is named whole.
 */
function noteUnmarked(kind, doc, actor, changes) {
    const held = unmarked.get(actor.id) ?? new Set();
    if (kind === "updateActor") for (const path of pathsOf(changes)) held.add(path.replace(/(^|\.)[-=]=/g, "$1"));
    else held.add(`${ITEM_WRITES.has(kind) ? "items" : "effects"}.${doc.id}`);
    unmarked.set(actor.id, held);
}

/*
 * Every leaf the mark and the document hold differently in what the mark keeps, the shallowest where
 * one holds an object and the other a value. An empty object is nothing: the mark keeps `rules` and
 * `bonuses` as `{}` where the document has none (`markFrom`), and read as a difference that put an
 * empty object onto every student of the harness's world at every ready - the first run of the
 * suite's "finds nothing on an untouched world" (05.10.2026, e29run/c7a1: 8 put-backs, 4 students).
 */
function differing(before, src) {
    const read = (doc, path) => {
        const value = foundry.utils.getProperty(doc, path);
        return isPlain(value) && !Object.keys(value).length ? null : value ?? null;
    };
    const leaves = new Set();
    for (const root of [...MARK_ROOTS, ...MARKED_FLAGS.map(key => `flags.${MODULE_ID}.${key}`)]) {
        for (const doc of [before, src]) {
            const value = foundry.utils.getProperty(doc, root);
            if (isPlain(value) && Object.keys(value).length) for (const path of pathsOf(value, root)) leaves.add(path);
            else if (value !== undefined) leaves.add(root);
        }
    }
    const moved = [...leaves].filter(path => stableJson(read(before, path)) !== stableJson(read(src, path)));
    return moved.filter(path => !moved.some(other => path.startsWith(`${other}.`)));
}

/** Two copies of a document's data as one write naming every path either holds. */
const bothPaths = (held, now) => foundry.utils.mergeObject(clone(held), now, { inplace: false });

/**
 * ONE STUDENT AT READY (the plan's 2.9): the document against its mark, each difference judged as
 * a write naming it would be, with no writer and no stamp - `actorFindings`, `effectFindings` and
 * `itemFindings` decide what is put back, and it is put back now - while a gain of the means
 * (`LEDGER`), a Rest stamp and a module item deleted or created go to the card (`flagged`), or, the
 * fields `lockPlayerResources` names with the setting off, to the list. A fall stands. What a write
 * judged before the stores hydrated named is the mark's (`unmarked`). The mark then takes the
 * document as the put-backs leave it, the GMs' means its values. Answers the findings, or null.
 */
async function compareOne(actor) {
    const mark = sheetMarkStore.get(actor.id);
    if (!mark || !game.actors?.has(actor.id)) return null;
    const early = [...(unmarked.get(actor.id) ?? [])];
    const byGm = path => early.some(seen => path === seen || path.startsWith(`${seen}.`) || seen.startsWith(`${path}.`));
    // An armed list a GM wrote before the stores hydrated is the GMs' (C8, `heldCalls`).
    const settle = () => refreshMark(actor, { values: ledgerOf(null, actor), credit: creditOf(mark) }, markFrom(actor).items,
        byGm(CALLS_PATH) ? foundry.utils.getProperty(actor._source ?? {}, CALLS_PATH) ?? null : undefined);
    // A Monokuma is no student (`judgeNow`): what it holds stands.
    if (mark.flags?.[FLAGS.monokuma]) {
        await settle();
        return null;
    }
    const src = actor._source ?? actor.toObject(), lock = locked();
    const paths = differing(markAsDocument(mark), src).filter(path => !byGm(path));
    const sheet = actorFindings(actor, mark, foundry.utils.expandObject(Object.fromEntries(paths.map(path => [path, true]))));
    const out = { actor, back: [...sheet.back], listed: [...sheet.listed], flagged: [], change: { ...sheet.change }, items: [] };
    const values = ledgerOf(mark, actor), now = ledgerOf(null, actor);
    for (const [key, { path, cost, kind }] of Object.entries(LEDGER)) {
        if (byGm(path) || (now[key] - values[key]) * cost >= 0) continue;
        out.change[path] = [values[key], now[key]];
        out[lock || kind === "grant" ? "flagged" : "listed"].push({ path, kind });
    }
    const rests = [mark.flags?.[FLAGS.restsTaken] ?? null, foundry.utils.getProperty(src, RESTS_PATH) ?? null];
    if (!byGm(RESTS_PATH) && stableJson(rests[0]) !== stableJson(rests[1])) {
        out.change[RESTS_PATH] = rests.map(clone);
        out.flagged.push({ path: RESTS_PATH, kind: "flag" });
    }
    const undos = sheet.back.length ? [() => trustedWrite(actor, sheet.patch, { reason: "auditPutBack" })] : [];
    const effects = new Map((actor.effects?.contents ?? []).map(effect => [effect.id, effect]));
    for (const id of new Set([...Object.keys(mark.effects ?? {}), ...effects.keys()])) {
        const held = mark.effects?.[id] ?? null, effect = effects.get(id) ?? null, data = effect ? docData(effect) : null;
        if (byGm(`effects.${id}`) || stableJson(held) === stableJson(data)) continue;
        const kind = !effect ? "deleteActiveEffect" : held ? "updateActiveEffect" : "createActiveEffect";
        const found = effectFindings(kind, effect ?? { id, parent: actor }, mark, held && data ? bothPaths(held, data) : {});
        if (!found.back.length) continue;
        out.back.push(...found.back);
        Object.assign(out.change, found.change);
        undos.push(found.undo);
    }
    const items = markFrom(actor).items;
    for (const id of new Set([...Object.keys(mark.items ?? {}), ...Object.keys(items)])) {
        const held = mark.items?.[id] ?? null, item = actor.items?.get(id) ?? null, whole = `items.${id}`;
        if (byGm(whole) || stableJson(held) === stableJson(items[id] ?? null)) continue;
        if (!item) out.items.push({ itemId: id, back: [], flagged: [{ path: whole, kind: "itemDeleted" }], change: { [whole]: [held.name ?? null, null] }, data: held });
        else if (!held) out.items.push({ itemId: id, back: [], flagged: [{ path: whole, kind: "itemCreated" }], change: { [whole]: [null, item.name ?? null] } });
        else {
            const data = docData(item), found = await itemFindings("updateItem", item, actor, mark, bothPaths(held, data), null, {}, { item: data });
            if (!found.back.length) continue;
            out.items.push(found);
            undos.push(found.undo);
        }
    }
    for (const undo of undos) {
        try {
            await undo();
        } catch (err) {
            error(`The GMs' audit could not put back a change made on ${actor.name} with no GM watching`, err);
        }
    }
    await settle();
    return out.back.length || out.listed.length || out.flagged.length || out.items.length ? out : null;
}

/**
 * The rows of the comparison, and its one card (`awayCard`): a put-back row per student and per
 * item, a flagged row per field and per item deleted or created - so each has its own Undo and
 * Keep - and a listed row per student. Rows carry `away` and no writer: nobody is known to have
 * written them. Answers the card, or null.
 */
async function recordAway(found) {
    const at = Date.now(), rows = [];
    const row = (actor, verdict, entries, change, extra = {}) => [foundry.utils.randomID(), {
        actorId: actor.id, itemId: null, userId: null, reason: null, ref: null,
        change: Object.fromEntries(entries.map(entry => [entry.path, change[entry.path]]).filter(([, v]) => v !== undefined)),
        covered: null, verdict, messageId: null, decided: null, at, away: true, n: rows.length, ...extra }];
    for (const each of found) {
        if (each.back.length) rows.push(row(each.actor, "putBack", each.back, each.change));
        for (const entry of each.flagged) rows.push(row(each.actor, "flagged", [entry], each.change));
        if (each.listed.length) rows.push(row(each.actor, "listed", each.listed, each.change));
        for (const item of each.items) {
            if (item.back.length) rows.push(row(each.actor, "putBack", item.back, item.change, { itemId: item.itemId }));
            for (const entry of item.flagged) rows.push(row(each.actor, "flagged", [entry], item.change, { itemId: item.itemId, ...(item.data ? { data: item.data } : {}) }));
        }
    }
    if (!rows.length) return null;
    const told = rows.filter(([, r]) => r.verdict !== "listed");
    let message = null;
    if (told.length) {
        try {
            message = await whisperToGms(awayCard(told), { flags: { [MODULE_ID]: {
                [AWAY_CARD]: told.filter(([, r]) => r.verdict === "flagged").map(([id]) => id) } } });
        } catch (err) {
            error("Could not tell the GMs of the changes made with no GM watching", err);
        }
    }
    await keepRows(Object.fromEntries(rows.map(([id, r]) => [id, r.verdict === "listed" ? r : { ...r, messageId: message?.id ?? null }])), at);
    debug(`The GMs' audit at ready: ${rows.map(([, r]) => `${game.actors.get(r.actorId)?.name ?? "?"} ${r.verdict}`).join(", ")}.`);
    return message;
}

/** The rows a card of the comparison shows, from the store, in the order it first showed them. */
function awayRowsOf(messageId) {
    return Object.entries(sheetWriteStore.entries() ?? {})
        .filter(([, row]) => row?.away && row.messageId === messageId && row.verdict !== "listed")
        .sort(([, a], [, b]) => (a.n ?? 0) - (b.n ?? 0));
}

/**
 * THE CARD OF THE CHANGES MADE WITH NO GM WATCHING (the plan's 2.9): what was put back, then each
 * row asked about - student, field, before and after - with Undo and Keep while nobody has decided
 * it and what was decided after, and Undo all / Accept all while any row is open. Built from the
 * rows alone, so the primary writes it whole again after each decision (`decideNow`).
 */
function awayCard(rows) {
    const label = (row, path) => game.i18n.localize(`DRPG.Audit.field.${fieldKind(path, row.change?.[path])}`);
    const line = row => Object.entries(row.change ?? {}).map(([path, [was, now] = []]) => esc(game.i18n.format("DRPG.Audit.awayLine", {
        name: game.actors.get(row.actorId)?.name ?? "?", field: label(row, path), path, before: shown(was), after: shown(now) }))).join("; ");
    const button = (attr, how, key, id = null) => `<button type="button" data-drpg-${attr}="${how}"${id ? ` data-drpg-row="${esc(id)}"` : ""}>`
        + `${esc(game.i18n.localize(key))}</button>`;
    const back = rows.filter(([, row]) => row.verdict === "putBack"), asked = rows.filter(([, row]) => row.verdict === "flagged");
    const open = asked.some(([, row]) => !row.decided);
    return `<div class="drpg-audit-card drpg-audit-away"><h3>${esc(game.i18n.localize("DRPG.Audit.awayTitle"))}</h3>`
        + (back.length ? `<p class="drpg-warning">${esc(game.i18n.localize("DRPG.Audit.awayPutBack"))}</p><ul>${back.map(([, row]) => `<li>${line(row)}</li>`).join("")}</ul>` : "")
        + (asked.length ? `<ul>${asked.map(([id, row]) => `<li data-drpg-row="${esc(id)}">${line(row)}${row.decided
            ? decidedWords(row.decided, path => label(row, path))
            : `<span class="drpg-audit-actions">${button("audit", "undo", "DRPG.Audit.undo", id)}${button("audit", "keep", "DRPG.Audit.keep", id)}</span>`}</li>`).join("")}</ul>` : "")
        + (open ? `<div class="drpg-audit-all">${button("audit-all", "undo", "DRPG.Audit.undoAll")}${button("audit-all", "keep", "DRPG.Audit.acceptAll")}</div>` : "")
        + "</div>";
}

/**
 * The card's buttons, wired on a GM's browser as `onRenderFlagged` wires a flagged write's: a row's
 * Undo or Keep decides that row, Undo all or Accept all every row of the card still open, each on the
 * primary GM (`askToDecideWrite`). Taken off once every row the card asks about is decided here.
 */
function wireAwayCard(ids, element) {
    const open = () => ids.filter(id => !sheetWriteStore.get(id)?.decided);
    if (!open().length) return void element.querySelectorAll(".drpg-audit-actions, .drpg-audit-all").forEach(el => el.remove());
    element.addEventListener("click", async event => {
        const button = event.target?.closest?.("[data-drpg-audit], [data-drpg-audit-all]");
        if (!button) return;
        event.preventDefault();
        const one = button.dataset.drpgRow;
        if (one) {
            button.closest(".drpg-audit-actions")?.remove();
            if (ids.includes(one)) await askToDecideWrite(one, button.dataset.drpgAudit === "keep");
            return;
        }
        element.querySelectorAll(".drpg-audit-actions, .drpg-audit-all").forEach(el => el.remove());
        const keep = button.dataset.drpgAuditAll === "keep";
        for (const id of open()) await askToDecideWrite(id, keep);
    });
}

/**
 * THE COMPARISON AT READY (the plan's 2.9; exported for tier 2): on the primary GM once its stores
 * hold the other GMs' copies (`registerSheetAudit`), every student with a mark compared with it
 * (`compareOne`, queued behind the writes on that student), and one card for the GMs. Answers the
 * rows' verdicts counted and the card's id, or null where this is not the primary or nothing could
 * be read.
 */
export async function compareAtReady() {
    if (!isPrimaryGm() || !gmStoresHydrated()) return null;
    try {
        const students = (game.actors?.contents ?? []).filter(actor => actor.type === "character" && sheetMarkStore.has(actor.id))
            .sort((a, b) => a.name.localeCompare(b.name));
        const found = (await Promise.all(students.map(actor => inOrder(actor.id, () => compareOne(actor))))).filter(Boolean);
        unmarked.clear();
        const card = await recordAway(found);
        const count = key => found.reduce((n, each) => n + each[key].length + each.items.reduce((m, item) => m + (item[key]?.length ?? 0), 0), 0);
        return { putBack: count("back"), flagged: count("flagged"), listed: count("listed"), card: card?.id ?? null };
    } catch (err) {
        error("The GMs' audit could not compare the sheets with what it held", err);
        return null;
    }
}

/**
 * THE LIST (`game.drpg.sheetWrites()`): every write this GM holds a row of, newest first,
 * kept a day. A table of them goes to the console under `DRPG.Audit.listTitle`; a player's
 * browser holds no row and answers an empty list.
 */
export function sheetWrites({ quiet = false } = {}) {
    if (!game.user?.isGM) return [];
    const rows = Object.entries(sheetWriteStore.entries() ?? {})
        .sort(([, a], [, b]) => (b?.at ?? 0) - (a?.at ?? 0))
        .map(([id, row]) => ({
            id, at: new Date(row.at ?? 0).toISOString(), character: game.actors.get(row.actorId)?.name ?? row.actorId,
            player: game.users.get(row.userId)?.name ?? row.userId, verdict: row.verdict, reason: row.reason ?? "-",
            change: Object.entries(row.change ?? {}).map(([path, [was, now] = []]) => `${path}: ${shown(was)} -> ${shown(now)}`).join("; "),
            // What a refund took back of what was paid before it (C4); the rest of its gain is what the row is for.
            credit: row.covered ? game.i18n.format("DRPG.Audit.credit", { what: Object.entries(row.covered).map(([key, n]) => `${key} ${n}`).join(", ") }) : "-",
            // A flagged write's decision (C5): which, and the GM who made it.
            decided: row.decided ? `${row.decided.how} (${game.users.get(row.decided.by ?? "")?.name ?? row.decided.by ?? "?"})` : "-"
        }));
    if (!quiet) {
        console.log(game.i18n.format("DRPG.Audit.listTitle", { n: rows.length }));
        if (rows.length) console.table(rows);
    }
    return rows;
}

/* ---------------------------------------------------------------------------
 * The hooks
 * ------------------------------------------------------------------------- */

/**
 * WHAT A GM'S HOOK DOES WITH A WRITE (exported for tier 2, which has one GM: `primary` false
 * is a second GM's hook). Only the primary judges and writes; the others hold the stores
 * it writes, synced, so the next primary judges against the same marks.
 */
export function onSheetWrite(kind, doc, changes, options, userId, { primary = isPrimaryGm() } = {}) {
    if (!primary) return null;
    const priors = kind === "updateActor" ? noteWrite(doc, changes, options, userId) : null;
    return judgeWrite(kind, doc, changes, userId, options, priors);
}

/** On every browser; each hook stands aside unless this is the primary GM. At `init`, so the hydration below is not missed. */
export function registerSheetAudit() {
    Hooks.on("updateActor", (actor, changes, options, userId) => { onSheetWrite("updateActor", actor, changes, options, userId); });
    Hooks.on("createActiveEffect", (effect, options, userId) => { onSheetWrite("createActiveEffect", effect, {}, options, userId); });
    Hooks.on("updateActiveEffect", (effect, changes, options, userId) => { onSheetWrite("updateActiveEffect", effect, changes, options, userId); });
    Hooks.on("deleteActiveEffect", (effect, options, userId) => { onSheetWrite("deleteActiveEffect", effect, {}, options, userId); });
    Hooks.on("updateItem", (item, changes, options, userId) => {
        onItemWrite(item, changes, options, userId);
        onSheetWrite("updateItem", item, changes, options, userId);
    });
    Hooks.on("createItem", (item, options, userId) => { onSheetWrite("createItem", item, {}, options, userId); });
    Hooks.on("deleteItem", (item, options, userId) => { onSheetWrite("deleteItem", item, {}, options, userId); });
    Hooks.on("renderChatMessageHTML", onRenderFlagged);
    Hooks.on("deleteActor", actor => {
        heard.delete(actor.id);
        if (isPrimaryGm() && gmStoresHydrated() && sheetMarkStore.has(actor.id)) void sheetMarkStore.drop(actor.id);
    });
    // Not while the suite holds the stores or stands them in another world: a hydration then is the suite's. The
    // comparison reads only the students that have a mark and the filling writes only those that have none (C7).
    onGmStoresHydrated(() => {
        if (!isPrimaryGm() || gmStoresQuiet()) return;
        void compareAtReady();
        void fillMarks();
    });
}
