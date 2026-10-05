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
 * Hope, Health, Sanity, actions, rests, grants and the module's items are later
 * commits' (C4-C6): this one judges none of them and only keeps their marks.
 *
 * ONE WRITE AFTER ANOTHER, PER STUDENT. Each write is queued behind the ones before
 * it on that student (`inOrder`), so a put-back is computed against the writes
 * that landed before it, and a GM's write is the baseline only once the player's
 * writes before it have been judged.
 */

import { MODULE_ID, FLAGS, STATES, ACTIONS_RESOURCE } from "./config.mjs";
import { SETTINGS, getSetting } from "./settings.mjs";
import { isPrimaryGm, whisperToGms, esc, error, debug, forcedDeletion } from "./utils.mjs";
import { onGmStoresHydrated, gmStoresHydrated, gmStoresQuiet, stableJson } from "./gm-store.mjs";
import { sheetMarkStore, sheetWriteStore } from "./gm-stores.mjs";
import { trustedWrite, trustedCreate, trustedDelete } from "./resource-guard.mjs";
import { tellRefused } from "./bridge-guards.mjs";

/** The module flags only a GM writes (the plan's 2.4), held in the mark and put back. */
const GM_FLAGS = ["deceased", "monocub", "silencedChapter", "advances", "sheetAtStart", "lootTrace", "swungWeapon",
    "betrayalWindow", "monokuma"].map(key => FLAGS[key]);

/** Every module flag the mark holds: the GM-only ones, and `pendingCall`, whose additions are listed. */
const MARKED_FLAGS = [...GM_FLAGS, FLAGS.pendingCall];

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
 * back - patches nothing. Answers whether it wrote.
 */
async function refreshMark(actor) {
    if (!gmStoresHydrated() || !game.actors?.has(actor?.id)) return false;
    const now = markFrom(actor), held = sheetMarkStore.get(actor.id) ?? {};
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
 * on no character. Queued behind the writes before it on that student.
 */
export function judgeWrite(kind, doc, changes, userId, options = {}) {
    const actor = kind === "updateActor" ? doc : doc?.parent;
    if (actor?.documentName !== "Actor" || actor.type !== "character") return Promise.resolve(null);
    return inOrder(actor.id, () => judgeNow(kind, doc, actor, changes, userId, options));
}

async function judgeNow(kind, doc, actor, changes, userId, options) {
    const user = game.users?.get(userId ?? "");
    if (user?.isGM) {
        if (!options?.[AUDIT_ASIDE]) await refreshMark(actor);
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
    const found = kind === "updateActor" ? actorFindings(actor, mark, changes) : effectFindings(kind, doc, mark, changes);
    if (found.back.length) {
        try {
            await found.undo();
        } catch (err) {
            error(`The GMs' audit could not put back a write on ${actor.name}`, err);
            return { verdict: "failed", change: found.change };
        }
    }
    await record(actor, user, found, options);
    await refreshMark(actor);
    return { verdict: found.back.length ? "putBack" : found.listed.length ? "listed" : "stands", change: found.change };
}

/** A student's update: what it changed that this file judges, against the mark. */
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
    const patch = putBackPatch(before, back.map(entry => entry.path));
    return { back, listed, change, undo: () => trustedWrite(actor, patch, { reason: "auditPutBack" }) };
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
            change: Object.entries(row.change ?? {}).map(([path, [was, now] = []]) => `${path}: ${shown(was)} -> ${shown(now)}`).join("; ")
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
    return judgeWrite(kind, doc, changes, userId, options);
}

/** On every browser; each hook stands aside unless this is the primary GM. At `init`, so the hydration below is not missed. */
export function registerSheetAudit() {
    Hooks.on("updateActor", (actor, changes, options, userId) => { onSheetWrite("updateActor", actor, changes, options, userId); });
    Hooks.on("createActiveEffect", (effect, options, userId) => { onSheetWrite("createActiveEffect", effect, {}, options, userId); });
    Hooks.on("updateActiveEffect", (effect, changes, options, userId) => { onSheetWrite("updateActiveEffect", effect, changes, options, userId); });
    Hooks.on("deleteActiveEffect", (effect, options, userId) => { onSheetWrite("deleteActiveEffect", effect, {}, options, userId); });
    Hooks.on("deleteActor", actor => {
        if (isPrimaryGm() && gmStoresHydrated() && sheetMarkStore.has(actor.id)) void sheetMarkStore.drop(actor.id);
    });
    // Not while the suite holds the stores or stands them in another world: a hydration then is the suite's.
    onGmStoresHydrated(() => { if (isPrimaryGm() && !gmStoresQuiet()) void fillMarks(); });
}
