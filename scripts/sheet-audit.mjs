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
 * the rest is put back either way. A Call added to `pendingCall` is listed until C8.
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
 * and only listed until C5. A `restsTaken` stamp no Rest covers is put back. The
 * module's items are C6's. The relay asks the same of a gain Daggerheart writes for
 * a player (`relayGainRefusal`, relay-guard.mjs).
 *
 * ONE WRITE AFTER ANOTHER, PER STUDENT. Each write is queued behind the ones before
 * it on that student (`inOrder`), so a put-back is computed against the writes
 * that landed before it, and a GM's write is the baseline only once the player's
 * writes before it have been judged.
 */

import { MODULE_ID, FLAGS, STATES, ACTIONS_RESOURCE, TIMING, REST, HOPE_CALLS, USABLE_EFFECTS, USABLE_KINDS, CRITICAL } from "./config.mjs";
import { SETTINGS, getSetting, getClock } from "./settings.mjs";
import { isPrimaryGm, whisperToGms, esc, error, debug, forcedDeletion } from "./utils.mjs";
import { onGmStoresHydrated, gmStoresHydrated, gmStoresQuiet, stableJson } from "./gm-store.mjs";
import { sheetMarkStore, sheetWriteStore } from "./gm-stores.mjs";
import { trustedWrite, trustedCreate, trustedDelete } from "./resource-guard.mjs";
import { tellRefused } from "./bridge-guards.mjs";
import { ITEM_FLAGS, isBroken, isStashed } from "./inventory.mjs";
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

/** Every module flag the mark holds: the GM-only ones, `pendingCall`, whose additions are listed, the Rest stamps and the grants. */
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

/** An effect's data as the mark keeps it: its source, without Foundry's write stamp, which moves on every write. */
function effectData(effect) {
    const { _stats, ...data } = effect?.toObject?.() ?? effect ?? {};
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
        effects: Object.fromEntries((actor.effects?.contents ?? []).map(effect => [effect.id, effectData(effect)]))
    };
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

/**
 * The student's mark brought up to its document, field by field: only the fields that
 * differ are written, so a write the mark already holds - a put-back, a GM writing a value
 * back - patches nothing. Answers whether it wrote. The means (`LEDGER`) and the credit are
 * not read off the document: they are the GMs', kept as the mark holds them unless the
 * judgement hands new ones (`ledger`) - a document read while a write waits to be judged
 * would make that write's value the GMs' before it was judged.
 */
async function refreshMark(actor, ledger = null) {
    if (!gmStoresHydrated() || !game.actors?.has(actor?.id)) return false;
    const held = sheetMarkStore.get(actor.id) ?? {};
    const now = markFrom(actor);
    if (sheetMarkStore.has(actor.id)) withLedger(now, ledger?.values ?? ledgerOf(held, actor), ledger?.credit ?? held.credit ?? {});
    const moved = Object.fromEntries(Object.entries(now).filter(([field, value]) => stableJson(value) !== stableJson(held[field] ?? null)));
    if (!Object.keys(moved).length) return false;
    await sheetMarkStore.patch(actor.id, moved);
    return true;
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
 * update). A GM's write - `game.users.get(userId).isGM` - is the new mark. Answers
 * `{ verdict, change }` (`putBack`, `listed`, `stands`, `mark`), or null for a write
 * on no character. Queued behind the writes before it on that student. `priors` is
 * what the hook heard before this write (`noteWrite`); a write handed in without
 * them is measured from the GMs' values.
 */
export function judgeWrite(kind, doc, changes, userId, options = {}, priors = null) {
    const actor = kind === "updateActor" ? doc : doc?.parent;
    if (actor?.documentName !== "Actor" || actor.type !== "character") return Promise.resolve(null);
    const seen = kind === "updateActor" ? seenNow(actor, changes, options, priors) : null;
    return inOrder(actor.id, () => judgeNow(kind, doc, actor, changes, userId, options, seen));
}

async function judgeNow(kind, doc, actor, changes, userId, options, seen) {
    const user = game.users?.get(userId ?? "");
    if (user?.isGM) {
        // The GMs' own put-back moves nothing they hold; any other GM's write is their value of what it names.
        const own = options?.drpgWrite?.reason === "auditPutBack";
        if (!options?.[AUDIT_ASIDE]) await refreshMark(actor, seen && !own ? gmLedger(actor, seen) : null);
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
        await refreshMark(actor);
        return { verdict: "stands", change: {} };
    }
    const found = kind === "updateActor" ? await updateFindings(actor, mark, changes, user, options, seen) : effectFindings(kind, doc, mark, changes);
    if (found.back.length || found.fix) {
        try {
            await found.undo();
        } catch (err) {
            error(`The GMs' audit could not put back a write on ${actor.name}`, err);
            return { verdict: "failed", change: found.change };
        }
    }
    await record(actor, user, found, options);
    await refreshMark(actor, found.ledger ?? null);
    return { verdict: found.back.length ? "putBack" : found.listed.length ? "listed" : "stands", change: found.change };
}

/** A student's update: what it changed of what a roll is built from (`actorFindings`) and of its means (`meansFindings`), put back in one write. */
async function updateFindings(actor, mark, changes, user, options, seen) {
    const sheet = actorFindings(actor, mark, changes);
    const means = await meansFindings(actor, mark, user, options, seen);
    const patch = { ...sheet.patch, ...means.patch };
    return { back: [...sheet.back, ...means.back], listed: [...sheet.listed, ...means.listed], change: { ...sheet.change, ...means.change },
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
            const flag = `flags.${MODULE_ID}.${FLAGS.pendingCall}`;
            const all = [foundry.utils.getProperty(before, flag), foundry.utils.getProperty(src, flag)];
            if (addedEntries(...all).length && !(flag in change)) { listed.push({ path: flag, kind }); change[flag] = all.map(v => clone(v) ?? null); }
            continue;
        }
        change[path] = [clone(was) ?? null, clone(now) ?? null];
        // The owner's Q2 (a): with the setting off, what its text names is listed and stands.
        if (!lock && (kind === "traits" || LOCK_NAMED_MAX.has(path))) listed.push({ path, kind });
        else back.push({ path, kind });
    }
    return { back, listed, change, patch: putBackPatch(before, back.map(entry => entry.path)) };
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
    const stamp = options?.drpgWrite;
    const item = stamp?.reason === "itemUse" && stamp.ref ? actor.items?.get(stamp.ref)?.toObject?.() ?? null : null;
    return { at: Date.now(), values, rests, item, priors };
}

/** A GM's write: the GMs' value of each means it names, and what it spent added to the credit ("by anyone", the plan's 2.5). */
function gmLedger(actor, seen) {
    const mark = sheetMarkStore.get(actor.id);
    if (!mark || !Object.keys(seen.values).length) return null;
    const values = ledgerOf(mark, actor), credit = creditOf(mark, seen.at);
    for (const [key, value] of Object.entries(seen.values)) {
        const spent = (value - values[key]) * LEDGER[key].cost;
        if (spent > 0) (credit[key] ??= []).push({ n: spent, at: seen.at });
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
 * still costs real Hope. With the setting off it is listed and stands (the owner's Q2 (a)), as
 * Health, Sanity, actions and the grants are either way until C5 flags them. A Rest stamp nothing
 * covers is put back. A legal payment that crossed a put-back brings the document to the GMs' Hope
 * too (`fix`), without a word: the put-back was told already.
 */
async function meansFindings(actor, mark, user, options, seen) {
    const stamp = options?.drpgWrite ?? {}, lock = locked();
    const out = { back: [], listed: [], change: {}, patch: {}, covered: {}, ledger: null, fix: false };
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
        const covered = Math.min(gain, judged.covers[key] ?? 0), enforced = key === "hope" && lock;
        values[key] = bounded(actor, key, values[key] - LEDGER[key].cost * (enforced ? covered : gain));
        if (covered === gain) continue;
        const { path, kind } = LEDGER[key];
        out.change[path] = [moves[key].base, moves[key].value];
        (enforced ? out.back : out.listed).push({ path, kind });
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
    const item = { id: src._id, name: src.name, system: src.system,
        getFlag: (scope, key) => foundry.utils.getProperty(src.flags ?? {}, `${scope}.${key}`) };
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
 * item-use judge waits for. The items' own judgement is C6's.
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

/** An effect created, changed or deleted on a student: put back when it carries what a roll is built from, before or after. */
function effectFindings(kind, effect, mark, changes) {
    const actor = effect.parent, id = effect.id, held = mark.effects?.[id] ?? null, now = kind === "deleteActiveEffect" ? null : effectData(effect);
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
 * field before and after; a row for it, and one for what was listed, go into `sheetWrites`.
 */
async function record(actor, user, found, options) {
    const stamp = options?.drpgWrite ?? {};
    const at = Date.now();
    const rows = {};
    const row = (verdict, entries, messageId) => ({
        actorId: actor.id, itemId: null, userId: user?.id ?? null, reason: stamp.reason ?? null, ref: stamp.ref ?? null,
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
    if (found.listed.length) rows[foundry.utils.randomID()] = row("listed", found.listed, null);
    if (!Object.keys(rows).length) return;
    const old = Object.entries(sheetWriteStore.entries() ?? {}).filter(([, kept]) => !(kept?.at >= at - ROW_KEPT_MS)).map(([id]) => id);
    if (old.length) await sheetWriteStore.dropMany(old);
    await sheetWriteStore.patchMany(rows);
    debug(`The GMs' audit: ${user?.name ?? "?"} on ${actor.name}: ${Object.values(rows).map(r => r.verdict).join(", ")}.`);
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
            credit: row.covered ? game.i18n.format("DRPG.Audit.credit", { what: Object.entries(row.covered).map(([key, n]) => `${key} ${n}`).join(", ") }) : "-"
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
    Hooks.on("updateItem", (item, changes, options, userId) => { onItemWrite(item, changes, options, userId); });
    Hooks.on("deleteActor", actor => {
        heard.delete(actor.id);
        if (isPrimaryGm() && gmStoresHydrated() && sheetMarkStore.has(actor.id)) void sheetMarkStore.drop(actor.id);
    });
    // Not while the suite holds the stores or stands them in another world: a hydration then is the suite's.
    onGmStoresHydrated(() => { if (isPrimaryGm() && !gmStoresQuiet()) void fillMarks(); });
}
