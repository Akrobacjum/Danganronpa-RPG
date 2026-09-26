/**
 * Danganronpa RPG - the GM store's engine: one layer under every GM-only client store.
 * ---------------------------------------------------------------------------
 * WHY ONE ENGINE (E04, 1.2.63; audit S05-01, S05-09, S05-10, S01-13, S04-24,
 * S04-25, S06-19, S07-01, S05-64).
 *
 * Eight stores - the Truth Bullet answer key, the traces, the cast and the
 * Blackened register, the Mastermind, the trap ledger and plants, the Level Up
 * offers and the fog ledger - each repeated one pattern: a client setting on the
 * GM's browser, tombstones, a merge that replaced WHOLE entries newest-wins, and
 * a socket of its own. None of them knew which world it belonged to and none
 * had a backup. The one critical in the module's own code was that merge: a
 * second GM joining sent entries a migration had built from nothing
 * (`{ faint, updated: now }`), and the newer, partial entry replaced the full
 * one everywhere - the answer key's realType, remnantId and analysis gone on
 * every GM (S05-01). Patching the eight copies one by one would not have closed
 * the class of bug; this file is the one copy.
 *
 * WHAT IT HOLDS. Each store is one client setting whose value is
 *
 *     { v: 1, worlds: { "<game.world.id>": Section } }
 *
 * and a section is
 *
 *     e: { key: { field: value } }      live values, the shape the readers had
 *     t: { key: stamp | { "": base, field: stamp, "split.sub": stamp } }
 *     d: { key: stamp }                  tombstones
 *     cleared: stamp                     the section's watermark (a reset's cut, clear())
 *     claim, unassigned                  this browser's own record of its upgrade (not synced)
 *
 * Other worlds ride through every write untouched, so a reset in a test world
 * on the same server no longer wipes the campaign's traces (S05-10), and the
 * engine reads `game.world.id` on every call rather than caching it.
 *
 * MERGED PER FIELD. Every field carries its own stamp; the larger stamp wins, an
 * equal stamp is broken by the larger stable JSON of the value so every merge
 * order agrees, and anything at or under the key's tombstone or the section's
 * watermark is dropped. So a younger partial entry wins only the fields it
 * names, a stale GM can add a field nobody else has but cannot overwrite a newer
 * one, and a revive after a tombstone carries only what was written after it.
 * Two fields (`public` of a trace, `swung` of the cast) are "split": a stamp per
 * sub-key, so two GMs editing different parts of one object both keep theirs.
 *
 * STAMPS are a hybrid logical clock over `game.time.serverTime` where Foundry
 * gives one, else `Date.now()`: each stamp is at least the last one plus one, and
 * every stamp this client merges is observed, capped at ten minutes ahead of
 * now. Two GM machines whose clocks disagree therefore no longer decide the
 * order between them (the skew hole the design's judges found). Whether v14's
 * `serverTime` is present and follows the server is LIVE-E04-01.
 *
 * WEAK. A value derived from absence - a migration's default, an unstamped
 * legacy row - is written at the section's watermark plus a half (`weakOf`): it
 * loses to anything real on any GM and is not dead on arrival after a reset's cut.
 * Every stamp this engine makes is a whole number (the clock is read in whole
 * milliseconds and an observed stamp is rounded up), so no real write shares the
 * weak stamp: at plus one, a real write in the millisecond after a cut tied it,
 * and a tie is broken by the value, so a default could beat an answer (the
 * review's DS-m2, measured: the weak "neutral" read on both GMs over a real "key").
 *
 * THE LEGACY KEYS ARE NEVER WRITTEN. Each store reads its old key once per world
 * on a browser (`claim`) and takes the rows that belong to that world; the old
 * key stays exactly as the upgrade found it, for the next world opened in the
 * same browser and for a downgrade.
 *
 * IMPORTS config.mjs AND NOTHING ELSE. settings.mjs reads its leaves through
 * this file, and utils.mjs imports settings.mjs, so the GM predicates, the clock
 * and the log come in through `configureGmStore` (gm-stores.mjs wires them at
 * ready) - R161 fails a static import cycle and any second spelling of "a GM who
 * is connected" outside `activeGmIds`.
 *
 * TESTABLE WITHOUT A TABLE. The engine is `createGmStoreEngine(env)`: everything
 * it reads of Foundry - who this is, the world, the socket, the storage, the
 * clock, the timers - is in `env`. The module runs one engine over the real
 * Foundry; R170 runs three over a fake bus and a fake clock.
 */

import { MODULE_ID, TIMING } from "./config.mjs";

const SOCKET_EVENT = `module.${MODULE_ID}`;
/** The four packets GM clients exchange. Side channels between GMs, not bridge requests (E31's M4). */
export const GMS_ACTIONS = Object.freeze({ hello: "gms.hello", state: "gms.state", done: "gms.done", delta: "gms.delta" });
const FORMAT = 1;
/** The key of a record-kind store's one entry. */
export const RECORD = "record";
/*
 * A `gms.state` larger than this, serialized, is sent in parts cut by key. What a
 * real server carries in one packet has not been measured (LIVE-E04-02); the
 * number is the design's proposal, and a part merges on arrival, so a smaller
 * one costs packets and nothing else.
 */
const PART_BYTES = 256 * 1024;
const UNSAFE = new Set(["__proto__", "constructor", "prototype", ""]);

/* ------------------------------------------------------------------------ *
 * Pure helpers: stable JSON, digests, sections, the merge. Exported for R169.
 * ------------------------------------------------------------------------ */

/** JSON with object keys sorted, so equal values compare equal whatever order they were built in. */
export function stableJson(value) {
    return JSON.stringify(value ?? null, (key, v) => (v && typeof v === "object" && !Array.isArray(v))
        ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]]))
        : v);
}

/** FNV-1a over a text, 32 bits as hex: a digest two GMs compare before sending a whole section. */
export function fnv1a(text) {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
}

const isPlain = o => o !== null && typeof o === "object" && !Array.isArray(o);
const clone = v => (v === undefined ? undefined : structuredClone(v));

export function emptySection() {
    return { e: {}, t: {}, d: {}, cleared: 0 };
}

/** The stamp of a weak write into a section: its watermark plus a half, under every real stamp after it (see WEAK). */
export function weakOf(section) {
    return (section?.cleared ?? 0) + 0.5;
}

/** The part of a section that travels and is merged: never `claim` or `unassigned`, which are this browser's. */
export function syncable(section) {
    return { e: section?.e ?? {}, t: section?.t ?? {}, d: section?.d ?? {}, cleared: section?.cleared ?? 0 };
}

/** Anything read from storage, a packet or a file, as a section with every part present. */
function normalizeSection(raw) {
    if (!isPlain(raw)) return null;
    const out = {
        e: isPlain(raw.e) ? raw.e : {},
        t: isPlain(raw.t) ? raw.t : {},
        d: isPlain(raw.d) ? raw.d : {},
        cleared: Number.isFinite(raw.cleared) ? raw.cleared : 0
    };
    if (isPlain(raw.claim)) out.claim = raw.claim;
    if (isPlain(raw.unassigned)) out.unassigned = raw.unassigned;
    return out;
}

const splitSet = spec => new Set(spec?.split ?? []);

/**
 * One entry, expanded: `fields` maps a field to `{ v, s }`; `splits` maps a split
 * field to `{ reset, whole, subs }`, where `reset` is the stamp of the last write
 * of the whole object (0 when only sub-keys were ever written), `whole` is what
 * that write left when no sub-key survives (null or {}), and `subs` maps a sub-key
 * to `{ v, s }`. A sub-key stamped under its field's reset is dead.
 */
function viewOf(sec, k, split) {
    const e = sec.e[k];
    if (!isPlain(e)) return null;
    const t = sec.t[k];
    const obj = isPlain(t) ? t : null;
    const base = typeof t === "number" ? t : (obj?.[""] ?? 0);
    const view = { fields: new Map(), splits: new Map() };
    for (const [f, v] of Object.entries(e)) {
        if (split.has(f)) {
            const reset = obj && Object.hasOwn(obj, f) ? obj[f] : 0;
            const subs = new Map();
            if (isPlain(v)) {
                for (const [sub, sv] of Object.entries(v)) {
                    const at = `${f}.${sub}`;
                    subs.set(sub, { v: sv, s: obj && Object.hasOwn(obj, at) ? obj[at] : reset });
                }
            }
            view.splits.set(f, { reset, whole: v === null ? null : {}, subs });
        } else {
            view.fields.set(f, { v, s: obj && Object.hasOwn(obj, f) ? obj[f] : base });
        }
    }
    return view;
}

/**
 * Write an expanded entry back in its canonical form: the base stamp is the one
 * most fields share (the smaller on a tie), a field stamped at the base has no
 * stamp of its own, and an entry with no split field whose fields all share one
 * stamp is stamped with one number. Canonical so that two GMs holding the same
 * values hold the same bytes, and their digests agree.
 */
function writeView(sec, k, view) {
    if (!view || (!view.fields.size && !view.splits.size)) {
        delete sec.e[k];
        delete sec.t[k];
        return;
    }
    const counts = new Map();
    for (const { s } of view.fields.values()) counts.set(s, (counts.get(s) ?? 0) + 1);
    let base = 0, best = -1;
    for (const [s, n] of counts) if (n > best || (n === best && s < base)) { base = s; best = n; }
    const e = {}, own = {};
    for (const f of [...view.fields.keys()].sort()) {
        const { v, s } = view.fields.get(f);
        e[f] = v;
        if (s !== base) own[f] = s;
    }
    for (const f of [...view.splits.keys()].sort()) {
        const sp = view.splits.get(f);
        const obj = {};
        for (const sub of [...sp.subs.keys()].sort()) {
            const { v, s } = sp.subs.get(sub);
            obj[sub] = v;
            if (s !== sp.reset) own[`${f}.${sub}`] = s;
        }
        e[f] = sp.subs.size ? obj : sp.whole;
        if (sp.reset) own[f] = sp.reset;
    }
    sec.e[k] = e;
    sec.t[k] = (!view.splits.size && !Object.keys(own).length) ? base : { "": base, ...own };
}

/** The larger stamp; on an equal stamp the larger stable JSON, so a merge in either order picks the same value. */
function pick(x, y) {
    if (!x) return y;
    if (!y) return x;
    if (x.s !== y.s) return x.s > y.s ? x : y;
    return stableJson(x.v) >= stableJson(y.v) ? x : y;
}

function pickReset(x, y) {
    if (!x) return y;
    if (!y) return x;
    if (x.reset !== y.reset) return x.reset > y.reset ? x : y;
    return stableJson(x.whole) >= stableJson(y.whole) ? x : y;
}

/** Drop from an expanded entry everything at or under `floor` (its tombstone, or the watermark). */
function cutView(view, floor) {
    if (!view) return view;
    for (const [f, w] of [...view.fields]) if (w.s <= floor) view.fields.delete(f);
    for (const [f, sp] of [...view.splits]) {
        for (const [sub, w] of [...sp.subs]) if (w.s <= floor || w.s < sp.reset) sp.subs.delete(sub);
        if (sp.reset <= floor) {
            if (!sp.subs.size) view.splits.delete(f);
            else { sp.reset = 0; sp.whole = {}; }
        }
    }
    return view;
}

function mergeKey(a, b, k, split, cleared) {
    const va = viewOf(a, k, split), vb = viewOf(b, k, split);
    const floor = Math.max(a.d[k] ?? 0, b.d?.[k] ?? 0, cleared);
    const out = { fields: new Map(), splits: new Map() };
    for (const f of new Set([...(va?.fields.keys() ?? []), ...(vb?.fields.keys() ?? [])])) {
        out.fields.set(f, pick(va?.fields.get(f), vb?.fields.get(f)));
    }
    for (const f of new Set([...(va?.splits.keys() ?? []), ...(vb?.splits.keys() ?? [])])) {
        const ra = va?.splits.get(f), rb = vb?.splits.get(f);
        const r = pickReset(ra, rb);
        const subs = new Map();
        for (const sub of new Set([...(ra?.subs.keys() ?? []), ...(rb?.subs.keys() ?? [])])) {
            subs.set(sub, pick(ra?.subs.get(sub), rb?.subs.get(sub)));
        }
        out.splits.set(f, { reset: r.reset, whole: r.whole, subs });
    }
    return cutView(out, floor);
}

/**
 * Merge `src` into `target` in place, and answer the keys whose bytes changed.
 * The one merge: sync, a restore and the claim all come through here.
 */
export function mergeInto(target, src, spec) {
    const split = splitSet(spec);
    const from = syncable(src);
    const before = target.cleared ?? 0;
    const cleared = Math.max(before, from.cleared);
    target.cleared = cleared;
    const keys = new Set([...Object.keys(from.e), ...Object.keys(from.d)]);
    if (cleared > before) for (const k of [...Object.keys(target.e), ...Object.keys(target.d)]) keys.add(k);
    const changed = new Set();
    for (const k of keys) {
        if (UNSAFE.has(k)) continue;
        const was = stableJson([target.e[k], target.t[k], target.d[k]]);
        writeView(target, k, mergeKey(target, from, k, split, cleared));
        const d = Math.max(target.d[k] ?? 0, from.d[k] ?? 0);
        if (d > cleared) target.d[k] = d;
        else delete target.d[k];
        if (stableJson([target.e[k], target.t[k], target.d[k]]) !== was) changed.add(k);
    }
    if (cleared > before) changed.add("");
    return changed;
}

/** A new section: `a` with `b` merged in. Neither argument is changed. Commutative, associative, idempotent (R169). */
export function mergeSections(a, b, spec) {
    const out = normalizeSection(clone(syncable(a))) ?? emptySection();
    mergeInto(out, b ?? emptySection(), spec);
    return out;
}

/**
 * Write fields into one entry of a section, as the handle's `patch` does, with
 * the stamp given. Pure over the section; exported so the suite can build the
 * fixtures its merge tests read the same way the engine writes them.
 *
 * opts: fillOnly (only fields absent here), changedOnly (only fields whose value
 * differs from what is here), ifLive (nothing when the key is not live here),
 * whole (a split field's object replaces it whole, rather than naming sub-keys).
 * `undefined` is ignored; `null` is a value. Answers whether anything was stamped.
 */
export function writeFields(sec, k, fields, s, spec, { fillOnly = false, changedOnly = false, ifLive = false, whole = false } = {}) {
    if (UNSAFE.has(k) || !isPlain(fields)) return false;
    if (ifLive && !isPlain(sec.e[k])) return false;
    const split = splitSet(spec);
    const view = viewOf(sec, k, split) ?? { fields: new Map(), splits: new Map() };
    let stamped = false;
    for (const [f, v] of Object.entries(fields)) {
        if (v === undefined || UNSAFE.has(f)) continue;
        if (split.has(f)) {
            const cur = view.splits.get(f);
            if (v === null || whole) {
                const subs = new Map(isPlain(v) ? Object.entries(v).filter(([sub, sv]) => sv !== undefined && !UNSAFE.has(sub))
                    .map(([sub, sv]) => [sub, { v: clone(sv), s }]) : []);
                if (fillOnly && cur) continue;
                if (changedOnly && cur && stableJson(cur.subs.size ? Object.fromEntries([...cur.subs].map(([x, w]) => [x, w.v])) : cur.whole)
                    === stableJson(isPlain(v) && Object.keys(v).length ? v : (v === null ? null : {}))) continue;
                view.splits.set(f, { reset: s, whole: v === null ? null : {}, subs });
                stamped = true;
                continue;
            }
            if (!isPlain(v)) continue;
            const sp = cur ?? { reset: 0, whole: {}, subs: new Map() };
            for (const [sub, sv] of Object.entries(v)) {
                if (sv === undefined || UNSAFE.has(sub)) continue;
                const had = sp.subs.get(sub);
                if (fillOnly && had) continue;
                if (changedOnly && had && stableJson(had.v) === stableJson(sv)) continue;
                sp.subs.set(sub, { v: clone(sv), s });
                stamped = true;
            }
            view.splits.set(f, sp);
            continue;
        }
        const had = view.fields.get(f);
        if (fillOnly && had) continue;
        if (changedOnly && had && stableJson(had.v) === stableJson(v)) continue;
        view.fields.set(f, { v: clone(v), s });
        stamped = true;
    }
    if (!stamped) return false;
    writeView(sec, k, cutView(view, Math.max(sec.d[k] ?? 0, sec.cleared ?? 0)));
    return true;
}

/** Tombstone one key at `s`: every field of it at or under `s` is gone, here and in every merge after. */
export function dropKey(sec, k, s, spec) {
    if (UNSAFE.has(k)) return false;
    sec.d[k] = Math.max(sec.d[k] ?? 0, s);
    writeView(sec, k, cutView(viewOf(sec, k, splitSet(spec)), Math.max(sec.d[k], sec.cleared ?? 0)));
    return true;
}

/** Raise the watermark to `s`: every field and tombstone at or under it is gone. */
export function raiseCleared(sec, s, spec) {
    if (!(s > (sec.cleared ?? 0))) return false;
    mergeInto(sec, { e: {}, t: {}, d: {}, cleared: s }, spec);
    return true;
}

/** The newest stamp anywhere in a section: its watermark, its tombstones and every field. */
export function newestIn(sec) {
    let max = sec?.cleared ?? 0;
    for (const s of Object.values(sec?.d ?? {})) if (s > max) max = s;
    for (const t of Object.values(sec?.t ?? {})) {
        if (typeof t === "number") { if (t > max) max = t; continue; }
        for (const s of Object.values(t ?? {})) if (s > max) max = s;
    }
    return max;
}

/** What two GMs compare before sending a section: how many live keys, the newest stamp, and a hash of the bytes. */
export function sectionDigest(sec) {
    const s = syncable(sec);
    return { n: Object.keys(s.e).length, max: newestIn(s), h: fnv1a(stableJson(s)) };
}

/** The stamp of one field of an entry (the newest of its sub-keys for a split field), 0 when absent. */
function fieldStamp(sec, k, f, split) {
    const view = viewOf(sec, k, split);
    if (!view) return 0;
    if (f !== undefined) {
        if (view.fields.has(f)) return view.fields.get(f).s;
        const sp = view.splits.get(f);
        if (!sp) return 0;
        return Math.max(sp.reset, ...[...sp.subs.values()].map(w => w.s));
    }
    let max = 0;
    for (const w of view.fields.values()) if (w.s > max) max = w.s;
    for (const sp of view.splits.values()) {
        if (sp.reset > max) max = sp.reset;
        for (const w of sp.subs.values()) if (w.s > max) max = w.s;
    }
    return max;
}

/**
 * The live fields of a section above a floor - `{ key: { field: value } }`, the fields
 * stamped over `floor` and the section's own watermark. For a copy that is a section
 * (the fog's, C9), read under a reset's cut that rose after it was last merged. Pure.
 */
export function liveFields(sec, floor = 0) {
    const out = {};
    const s = normalizeSection(sec);
    if (!s) return out;
    const under = Math.max(floor, s.cleared);
    for (const k of Object.keys(s.e)) {
        const view = cutView(viewOf(s, k, new Set()), Math.max(under, s.d[k] ?? 0));
        if (!view?.fields.size) continue;
        out[k] = Object.fromEntries([...view.fields].map(([f, w]) => [f, w.v]));
    }
    return out;
}

/**
 * A flat store of the old shape - `{ key: { ...fields, updated, deleted } }`, what the
 * Truth Bullet export wrote until E04 - as a section: a live row at its `updated`, a
 * `{ deleted, updated }` row as a tombstone at it, and a row with no `updated` at
 * `weak` (the target section's watermark plus one), so it loses to anything real.
 */
export function flatToSection(flat, spec, weak = 0.5) {
    const sec = emptySection();
    for (const [k, row] of Object.entries(isPlain(flat) ? flat : {})) {
        if (!isPlain(row) || UNSAFE.has(k)) continue;
        const { updated, deleted, ...fields } = row;
        const s = Number.isFinite(updated) && updated > 0 ? updated : weak;
        if (deleted) dropKey(sec, k, s, spec);
        else writeFields(sec, k, fields, s, spec, { whole: true });
    }
    return sec;
}

/**
 * What merging `incoming` into `here` would do, key by key, without doing it: rows
 * the file adds, rows it refreshes (some field newer in the file), rows kept because
 * this copy is newer (or has a newer tombstone), and rows at or under this copy's
 * watermark - a reset's cut - which the merge refuses (a restore can fill those only
 * when asked, freshly stamped). Every key is counted once; `inFile` is their number.
 */
export function previewSection(here, incoming, spec) {
    const base = normalizeSection(clone(syncable(here))) ?? emptySection();
    const inc = normalizeSection(clone(syncable(incoming))) ?? emptySection();
    const keys = [...new Set([...Object.keys(inc.e), ...Object.keys(inc.d)])].filter(k => !UNSAFE.has(k));
    const out = { inFile: keys.length, add: 0, refresh: 0, keptNewerHere: 0, beforeCut: 0, beforeCutKeys: [] };
    for (const k of keys) {
        const one = subsection(inc, [k]);
        const merged = mergeSections(base, one, spec);
        const had = Object.hasOwn(base.e, k) || Object.hasOwn(base.d, k);
        const same = stableJson([merged.e[k], merged.t[k], merged.d[k]]) === stableJson([base.e[k], base.t[k], base.d[k]]);
        const newestInFile = Math.max(inc.d[k] ?? 0, fieldStamp(inc, k, undefined, splitSet(spec)));
        if (!same) (had ? out.refresh++ : out.add++);
        else if (newestInFile <= (base.cleared ?? 0)) { out.beforeCut++; out.beforeCutKeys.push(k); }
        else out.keptNewerHere++;
    }
    return out;
}

/** How many rows an old store holds: a spec may say (a record is one row); else an array's length or an object's keys. */
export function legacyRows(spec, legacy) {
    if (spec?.legacyCount) return spec.legacyCount(legacy);
    if (Array.isArray(legacy)) return legacy.length;
    return isPlain(legacy) ? Object.keys(legacy).length : 0;
}

/** The keys of a section cut into parts no larger than `limit` serialized bytes, each carrying the watermark. */
function partsOf(sec, limit = PART_BYTES) {
    const s = syncable(sec);
    const keys = [...new Set([...Object.keys(s.e), ...Object.keys(s.d)])];
    const parts = [];
    let cur = { e: {}, t: {}, d: {}, cleared: s.cleared }, size = 0;
    for (const k of keys) {
        const piece = { e: s.e[k], t: s.t[k], d: s.d[k] };
        const bytes = JSON.stringify(piece).length + k.length;
        if (size && size + bytes > limit) {
            parts.push(cur);
            cur = { e: {}, t: {}, d: {}, cleared: s.cleared };
            size = 0;
        }
        if (piece.e !== undefined) { cur.e[k] = piece.e; cur.t[k] = piece.t; }
        if (piece.d !== undefined) cur.d[k] = piece.d;
        size += bytes;
    }
    parts.push(cur);
    return parts;
}

function subsection(sec, keys) {
    const out = { e: {}, t: {}, d: {}, cleared: sec.cleared ?? 0 };
    for (const k of keys) {
        if (!k) continue;
        if (sec.e[k] !== undefined) { out.e[k] = sec.e[k]; out.t[k] = sec.t[k]; }
        if (sec.d[k] !== undefined) out.d[k] = sec.d[k];
    }
    return out;
}

/* ------------------------------------------------------------------------ *
 * The receive gate. Pure, for R170.
 * ------------------------------------------------------------------------ */

const stampOk = s => typeof s === "number" && Number.isFinite(s) && s >= 0;

/** A copy's stamps as `{ part: stamp }`: an object of numbers, or one number (the part ""); null when neither. */
export function copyStamps(s) {
    if (isPlain(s)) {
        const out = {};
        for (const [part, v] of Object.entries(s)) {
            if (UNSAFE.has(part) && part !== "") return null;
            if (!stampOk(v)) return null;
            out[part] = v;
        }
        return Object.keys(out).length ? out : null;
    }
    return stampOk(s) && s > 0 ? { "": s } : null;
}

/** The newest of a copy's stamps, 0 for none. */
export const newestStamp = stamps => Math.max(0, ...Object.values(stamps ?? {}));

/**
 * Whether `next` is newer than `held`, part by part: at least as new in every part
 * either names, and newer in one. A part at or under `cut` (a reset's) counts as none.
 */
export function newerStamps(next, held, cut = 0) {
    const live = s => (s > cut ? s : 0);
    let newer = false;
    for (const part of new Set([...Object.keys(next ?? {}), ...Object.keys(held ?? {})])) {
        const a = live(next?.[part] ?? 0), b = live(held?.[part] ?? 0);
        if (a < b) return false;
        if (a > b) newer = true;
    }
    return newer;
}

/** Whether a packet's section is plain objects stamped with numbers, with no key that could reach a prototype. */
export function sectionProblem(sec) {
    if (!isPlain(sec)) return "the section is not an object";
    for (const part of ["e", "t", "d"]) if (sec[part] !== undefined && !isPlain(sec[part])) return `its ${part} is not an object`;
    if (sec.cleared !== undefined && !stampOk(sec.cleared)) return "its watermark is not a stamp";
    for (const [k, entry] of Object.entries(sec.e ?? {})) {
        if (UNSAFE.has(k) || !isPlain(entry)) return `entry ${k} is not an object`;
        for (const f of Object.keys(entry)) if (UNSAFE.has(f)) return `entry ${k} names a field that is not allowed`;
        const t = sec.t?.[k];
        if (!stampOk(t) && !(isPlain(t) && Object.values(t).every(stampOk))) return `entry ${k} is not stamped with numbers`;
    }
    for (const [k, s] of Object.entries(sec.d ?? {})) if (UNSAFE.has(k) || !stampOk(s)) return `tombstone ${k} is not a stamp`;
    return null;
}

/**
 * Why a GM-to-GM packet is refused, or null. `ctx`: amGM, senderIsGM, senderId,
 * selfId, worldId, stores (a Map of name -> spec). Assistants (role 3) are GMs.
 */
export function gmsRefusal(packet, ctx) {
    if (!isPlain(packet)) return "not a packet";
    if (!ctx.amGM) return "this client is not a GM";
    if (!ctx.senderIsGM) return "the sender is not a GM";
    if (ctx.senderId === ctx.selfId) return "the sender is this client";
    if (packet.world !== ctx.worldId) return "the packet is another world's";
    switch (packet.action) {
        case GMS_ACTIONS.hello:
            if (!isPlain(packet.digests)) return "a hello with no digests";
            return null;
        case GMS_ACTIONS.done:
            if (!Array.isArray(packet.ask) || packet.ask.some(n => typeof n !== "string")) return "a done with no list";
            return null;
        case GMS_ACTIONS.state:
        case GMS_ACTIONS.delta: {
            const spec = ctx.stores.get(packet.store);
            if (!spec || !spec.sync) return "a store this build does not sync";
            const why = sectionProblem(packet.action === GMS_ACTIONS.state ? packet.section : packet.delta);
            return why ? `a malformed section: ${why}` : null;
        }
        default:
            return "not a GM store packet";
    }
}

/* ------------------------------------------------------------------------ *
 * The engine.
 * ------------------------------------------------------------------------ */

/**
 * One engine over one environment.
 *
 * env: selfId(), isGM(), worldId(), activeGmIds(), primaryGmId(), senderIsGM(id),
 * userName(id), send(packet, recipients), storage { read(key) -> raw JSON text
 * or null, write(key, value) -> Promise }, readLegacy(key), now(), timers { set,
 * clear }, clock() -> the campaign clock, log { warn, error, debug },
 * notify(level, text, opts), onHydrated(worldId) (optional), upgradeMark() ->
 * the world's upgrade mark or null (optional).
 */
export function createGmStoreEngine(env) {
    const stores = new Map();      // name -> { spec, handle, worlds: Map<wid, W>, lastRaw, writing, flushTimer, flushing, waiters }
    const copies = new Map();      // name -> { spec, cache: Map<"wid|uid", rec>, lastRaw, writing }
    let last = 0;                  // the hybrid logical clock
    let opened = false, held = false;
    const skewWarned = new Map();  // senderId -> minutes ahead, warned once
    const refusedWarned = new Set();
    const hyd = { wid: null, state: "closed", waiting: new Set(), timer: null, waiters: [], asked: [] };
    let quotaWarned = false;
    /* The suite's other world (`withWorld`): the stores answer for it while it is set. */
    let worldOverride = null;
    const worldId = () => worldOverride ?? env.worldId();
    /* The suite's old keys (`withLegacy`): read in place of this browser's while set, so a
       test that claims never writes a real old key (the review's DS-m5 / C-m16: other
       worlds' unclaimed rows live only there, and a tab closed mid-test lost them). */
    let legacyOverride = null;
    const readLegacy = key => (legacyOverride && Object.hasOwn(legacyOverride, key) ? clone(legacyOverride[key]) : env.readLegacy(key));
    /* The world's upgrade mark (gm-stores.mjs `caseMark.upgradedAt`): the first claim of a
       1.2.63 store in this world, one number every GM reads alike. Null where none is written. */
    const upgradeMark = () => {
        const mark = env.upgradeMark?.();
        return Number.isFinite(mark) && mark > 0 ? mark : null;
    };

    /* ------------------------------ stamps -------------------------------- */

    const now = () => env.now();
    /* Whole milliseconds, always: a weak write sits between a watermark and the first
       real stamp after it (`weakOf`), which holds only while no real stamp has a fraction. */
    function stamp() {
        last = Math.max(Math.floor(now()), last + 1);
        return last;
    }
    function observe(s, from = null) {
        if (!Number.isFinite(s) || s <= 0) return;
        const bound = now() + TIMING.gmStoreSkewMs;
        if (s > bound && from && !skewWarned.has(from)) {
            const minutes = Math.round((s - now()) / 60000);
            skewWarned.set(from, minutes);
            env.log.warn(`The GM store: ${env.userName(from)}'s stamps run ${minutes} minute(s) ahead of this client's clock.`);
        }
        last = Math.max(last, Math.ceil(Math.min(s, bound)));
    }
    const observeSection = (sec, from = null) => observe(newestIn(sec), from);

    /* --------------------------- world sections --------------------------- */

    function parseValue(raw) {
        if (raw === null || raw === undefined) return { v: FORMAT, worlds: {} };
        let value = raw;
        if (typeof raw === "string") {
            try { value = JSON.parse(raw); } catch { return { v: FORMAT, worlds: {}, unreadable: true }; }
        }
        if (!isPlain(value)) return { v: FORMAT, worlds: {} };
        return { v: value.v ?? FORMAT, worlds: isPlain(value.worlds) ? value.worlds : {} };
    }

    function worldOf(st, wid) {
        let w = st.worlds.get(wid);
        if (w) return w;
        const raw = env.storage.read(st.spec.key);
        const value = parseValue(raw);
        if (value.v > FORMAT) st.newer = value.v;
        const section = normalizeSection(clone(value.worlds[wid])) ?? emptySection();
        observeSection(section);
        w = { wid, section, dirty: new Set(), needsWrite: false };
        st.worlds.set(wid, w);
        st.lastRaw ??= raw;
        return w;
    }
    const current = st => worldOf(st, worldId());
    /* The world this client opened: what the GMs exchange, whatever the suite stands in. */
    const home = st => worldOf(st, env.worldId());

    /* ------------------------------ flushing ------------------------------ */

    function schedule(st) {
        if (st.flushTimer === null) st.flushTimer = env.timers.set(() => { void flush(st); }, 0);
        return new Promise(resolve => st.waiters.push(resolve));
    }

    async function flush(st) {
        st.flushTimer = null;
        const worlds = [...st.worlds.values()].filter(w => w.needsWrite);
        const waiters = st.waiters.splice(0);
        if (!worlds.length) { waiters.forEach(r => r()); return; }
        /* What this flush sends is taken now: a write made while the storage write is
           awaited marks its world again and schedules the next flush, which would find
           nothing to do if the flags were cleared after the await. */
        const sent = new Map(worlds.map(w => [w, new Set(w.dirty)]));
        for (const w of worlds) { w.dirty.clear(); w.needsWrite = false; }
        if (st.newer) {
            // A newer build wrote this key in a format this one does not know (a downgrade): memory only.
            if (!st.newerWarned) env.log.warn(`The GM store "${st.spec.name}" is stored in format ${st.newer} by a newer build; this one keeps its changes in memory only.`);
            st.newerWarned = true;
        } else {
            st.flushing = true;
            try {
                const raw = env.storage.read(st.spec.key);
                const value = parseValue(raw);
                for (const w of worlds) {
                    // Another tab, or a write this engine did not make: merged, never overwritten.
                    if (raw !== st.lastRaw && value.worlds[w.wid]) {
                        const theirs = normalizeSection(value.worlds[w.wid]);
                        if (theirs) mergeInto(w.section, theirs, st.spec);
                    }
                    value.worlds[w.wid] = clone(w.section);
                }
                st.writing = true;
                try {
                    await env.storage.write(st.spec.key, { v: FORMAT, worlds: value.worlds });
                } finally {
                    st.writing = false;
                }
                st.lastRaw = env.storage.read(st.spec.key);
            } catch (err) {
                // A full origin (quota): memory stays authoritative for the session and the delta
                // still goes out, so the other GMs hold the copy. Said once, and it stays up.
                env.log.error(`The GM store could not save "${st.spec.name}"`, err);
                if (!quotaWarned) env.notify("error", env.text?.("DRPG.GmStore.saveFailed", { store: st.spec.name, error: String(err?.message ?? err) })
                    ?? `The GM store could not save "${st.spec.name}": ${err?.message ?? err}`, { permanent: true });
                quotaWarned = true;
            } finally {
                st.flushing = false;
            }
        }
        for (const [w, keys] of sent) {
            if (keys.size && st.spec.sync && !held && w.wid === env.worldId()) {
                sendTo(peers(), { action: GMS_ACTIONS.delta, world: w.wid, store: st.spec.name, delta: clone(subsection(w.section, keys)) });
            }
        }
        waiters.forEach(r => r());
    }

    /** Mark keys written here (they go out as a delta) or merged in (they only go to storage). */
    function touched(st, w, keys, { local }) {
        if (!keys.size) return Promise.resolve();
        if (local) for (const k of keys) w.dirty.add(k);
        w.needsWrite = true;
        return schedule(st);
    }

    function peers() {
        const self = env.selfId();
        return env.activeGmIds().filter(id => id && id !== self);
    }

    function sendTo(recipients, packet) {
        if (held || !recipients.length) return;
        try { env.send(packet, recipients); }
        catch (err) { env.log.error(`The GM store could not send ${packet.action}`, err); }
    }

    /* ------------------------------ the handle ---------------------------- */

    function makeHandle(st) {
        const spec = st.spec;
        const split = splitSet(spec);
        const handle = {
            name: spec.name,
            spec,
            /** This world's live entries. Read-only by contract: every write goes through the handle. */
            entries: () => current(st).section.e,
            get: k => current(st).section.e[k] ?? null,
            has: k => Object.hasOwn(current(st).section.e, k),
            /** A field's stamp, or the entry's newest live stamp; 0 when absent. */
            stampOf: (k, f) => fieldStamp(current(st).section, k, f, split),
            /** The newest decision about a key: its fields, its tombstone and the watermark. */
            newest: k => {
                const sec = current(st).section;
                return Math.max(fieldStamp(sec, k, undefined, split), sec.d[k] ?? 0, sec.cleared ?? 0);
            },
            tombstone: k => current(st).section.d[k] ?? 0,
            cleared: () => current(st).section.cleared ?? 0,
            weak: () => weakOf(current(st).section),
            patch(k, fields, opts = {}) {
                const w = current(st);
                const s = opts.stamp ?? (opts.weak ? weakOf(w.section) : stamp());
                const wrote = writeFields(w.section, k, fields, s, spec, opts);
                return touched(st, w, wrote ? new Set([k]) : new Set(), { local: true });
            },
            patchMany(map, opts = {}) {
                const w = current(st);
                const s = opts.stamp ?? (opts.weak ? weakOf(w.section) : stamp());
                const keys = new Set();
                for (const [k, fields] of Object.entries(map ?? {})) if (writeFields(w.section, k, fields, s, spec, opts)) keys.add(k);
                return touched(st, w, keys, { local: true });
            },
            drop(k) {
                const w = current(st);
                return touched(st, w, dropKey(w.section, k, stamp(), spec) ? new Set([k]) : new Set(), { local: true });
            },
            dropMany(keys) {
                const w = current(st);
                const s = stamp();
                const out = new Set();
                for (const k of keys ?? []) if (dropKey(w.section, k, s, spec)) out.add(k);
                return touched(st, w, out, { local: true });
            },
            /** The primary's only: every row of this world's store is gone, here and wherever it merges. */
            clear() {
                if (!env.isPrimary()) {
                    env.log.warn(`The GM store "${spec.name}" is cleared by the primary GM only.`);
                    return Promise.resolve(false);
                }
                const w = current(st);
                raiseCleared(w.section, stamp(), spec);
                return touched(st, w, new Set([""]), { local: true }).then(() => true);
            },
            whenHydrated: () => (st.restored ? Promise.resolve("restored") : whenHydrated()),
            isHydrated: () => st.restored || isHydrated(),
            /** A restore counts as this store's copy having arrived (the design's 2.8). */
            markRestored: () => { st.restored = true; },
            /** A copy of this world's section (what a backup holds). */
            section: () => clone(syncable(current(st).section)),
            /**
             * Merge a section in with the same merge as the sync: it never lowers a value. `source`
             * "restore" sends what changed to the other GMs; "sync" only stores it.
             */
            mergeIn(section, { source = "restore" } = {}) {
                const sec = normalizeSection(clone(section));
                if (!sec) return Promise.resolve(0);
                observeSection(sec);
                const w = current(st);
                const changed = mergeInto(w.section, sec, spec);
                return touched(st, w, changed, { local: source !== "sync" }).then(() => [...changed].filter(Boolean).length);
            },
            /** Read one entry back from storage, not from memory: the read-back a removal depends on. */
            persisted(k) {
                const value = parseValue(env.storage.read(spec.key));
                const sec = normalizeSection(value.worlds[worldId()]);
                return sec?.e?.[k] ?? null;
            },
            status: () => statusOf(st),
            census: () => clone(current(st).section.claim?.census ?? null),
            claimInfo: () => clone(current(st).section.claim ?? null),
            unassigned: () => clone(current(st).section.unassigned ?? {}),
            /** Claim this world's rows from the old key, if this browser has not yet (as the open does); the census. */
            claim: () => claimStore(st),
            /** Whether the old key differs from what the claim read (a 1.2.x session wrote it since: H1). */
            legacyChanged() {
                const claim = current(st).section.claim;
                if (!claim?.at || !spec.legacyKey) return false;
                return fnv1a(stableJson(readLegacy(spec.legacyKey) ?? null)) !== claim.legacyHash;
            },
            /**
             * TAKE WHAT CHANGED IN THE OLD STORE (the design's H1): a GM went back to a 1.2.x
             * build after the upgrade, and it wrote the old key. Nothing is taken on its own;
             * this runs when a GM asks. A key the store never held (live or tombstoned) is
             * claimed at its old stamp; a field that differs is taken - at its old stamp, by
             * the ordinary merge - only while the store's own field predates the upgrade, and
             * otherwise listed as a conflict and kept; an old tombstone is taken at its stamp;
             * a key the claim took that the old store no longer has is listed and kept. What
             * changed goes to the other GMs. Answers what it did.
             *
             * "The upgrade" is the world's mark (`env.upgradeMark`, gm-stores.mjs `caseMark`),
             * the same on every GM, and this browser's claim only where no mark was written:
             * a browser that claimed after another GM's correction counted that correction as
             * older than its claim, and took the downgrade's stale field over it (the review's
             * DS-m6). An old stamp ahead of this moment is taken at this moment, and counted
             * (`clamped`): an old row cannot have been written after it (DS-m3).
             */
            async reclaim() {
                const w = current(st);
                const claim = w.section.claim;
                if (!claim?.at || !spec.legacyKey || !spec.claim) return null;
                const legacy = readLegacy(spec.legacyKey);
                const { rows = [] } = (legacy === undefined || legacy === null ? null : await spec.claim(legacy, { engine: api, reclaim: true })) ?? {};
                const report = { added: [], taken: [], conflicts: [], missing: [], tombstones: 0, clamped: 0 };
                const mini = emptySection();
                const weakStamp = weakOf(w.section);
                const ceiling = Math.floor(now());
                const upgraded = upgradeMark() ?? claim.at;
                const inLegacy = new Set();
                for (const row of rows) {
                    inLegacy.add(row.key);
                    let s = Number.isFinite(row.stamp) && row.stamp > 0 ? row.stamp : weakStamp;
                    if (s > ceiling) { s = ceiling; report.clamped++; }
                    if (row.deleted) { dropKey(mini, row.key, s, spec); report.tombstones++; continue; }
                    if (!Object.hasOwn(w.section.e, row.key) && !Object.hasOwn(w.section.d, row.key)) {
                        writeFields(mini, row.key, row.fields ?? {}, s, spec, { whole: true });
                        report.added.push(row.key);
                        continue;
                    }
                    const here = w.section.e[row.key] ?? {};
                    const take = {};
                    for (const [f, v] of Object.entries(row.fields ?? {})) {
                        if (stableJson(here[f]) === stableJson(v)) continue;
                        if (fieldStamp(w.section, row.key, f, split) < upgraded) take[f] = v;
                        else report.conflicts.push({ key: row.key, field: f });
                    }
                    if (Object.keys(take).length) {
                        writeFields(mini, row.key, take, s, spec, { whole: true });
                        report.taken.push(row.key);
                    }
                }
                for (const k of claim.keys ?? []) if (!inLegacy.has(k) && Object.hasOwn(w.section.e, k)) report.missing.push(k);
                const changed = mergeInto(w.section, mini, spec);
                w.section.claim = { ...claim, legacyHash: fnv1a(stableJson(legacy ?? null)), reclaimedAt: stamp() };
                changed.add("");
                await touched(st, w, changed, { local: true });
                return report;
            },
            setUnassigned(patch) {
                const w = current(st);
                w.section.unassigned = { ...(w.section.unassigned ?? {}), ...patch };
                return touched(st, w, new Set([""]), { local: false });
            },
            /**
             * COMPACTION BY SUBJECT (E04 C10; the design's 2.11). Every tombstone stamped
             * before `before` whose key `gone(key)` says names nothing in this world any
             * more, and that has no live field beside it, is removed - from this browser's
             * section, and not sent: a tombstone is only ever held against an older copy
             * of its row, and a row whose subject is gone is one nothing can reach (a
             * trace's token, a bullet's item, a character). Every GM runs the same rule
             * after its stores have the others' copies, so a GM that still holds one hands
             * it back only until it has run the rule itself. Live rows are never touched
             * here. Answers how many went.
             */
            compact: (before, gone) => {
                const w = current(st);
                const keys = Object.keys(w.section.d).filter(k => w.section.d[k] < before && !Object.hasOwn(w.section.e, k) && gone(k));
                if (!keys.length) return Promise.resolve(0);
                for (const k of keys) delete w.section.d[k];
                return touched(st, w, new Set(keys), { local: false }).then(() => keys.length);
            },
            /**
             * Suite and harness only: this world's section emptied in memory, as a browser that
             * lost its storage holds it - the claim kept, nothing sent, and nothing written until
             * this store's next write (a restore's, a rebuild's). Written at once, as until E04's
             * fix round, a tab closed before the suite put the section back left this world's
             * section empty on disk with its claim taken, never to be claimed again (the review's
             * DS-m5).
             */
            async forget() {
                const w = current(st);
                const kept = { claim: w.section.claim, unassigned: w.section.unassigned };
                w.section = { ...emptySection(), ...(kept.claim ? { claim: kept.claim } : {}), ...(kept.unassigned ? { unassigned: kept.unassigned } : {}) };
                w.dirty.clear();
                w.needsWrite = false;
            },
            /** Suite only: drop every cached world, as a write this engine did not make does. */
            reload: () => { st.worlds.clear(); st.lastRaw = null; },
            idle: () => (st.flushTimer === null && !st.flushing ? Promise.resolve() : new Promise(r => st.waiters.push(r)))
        };
        if (spec.kind === "record") {
            handle.record = () => current(st).section.e[RECORD] ?? {};
            /** Stamp every field of the record's closed set not in `keep` with `fields[f] ?? null`. */
            handle.resetRecord = (fields = {}, { keep = [] } = {}) => {
                const next = {};
                for (const f of spec.fields ?? []) if (!keep.includes(f)) next[f] = fields?.[f] ?? null;
                return handle.patch(RECORD, next, { whole: true });
            };
        }
        return handle;
    }

    function statusOf(st) {
        const w = current(st);
        const raw = env.storage.read(st.spec.key);
        const value = parseValue(raw);
        return {
            name: st.spec.name, key: st.spec.key, world: w.wid,
            claimed: Boolean(w.section.claim?.at), claimFailed: w.section.claim?.failed ?? null,
            hydrated: isHydrated(), live: Object.keys(w.section.e).length, dead: Object.keys(w.section.d).length,
            cleared: w.section.cleared ?? 0, bytes: raw ? raw.length : 0,
            otherWorlds: Object.keys(value.worlds).filter(id => id !== w.wid).length,
            census: clone(w.section.claim?.census ?? null)
        };
    }

    /* ------------------------------ hydration ----------------------------- */

    /* Another world than the one opened - the suite's world swap inside one call - has
       nobody to wait for: it is hydrated as found. */
    function isHydrated() {
        return hyd.state === "alone" || hyd.state === "answered" || hyd.state === "timedOut"
            || (hyd.wid !== null && worldId() !== hyd.wid);
    }
    function whenHydrated() {
        if (isHydrated()) return Promise.resolve(hyd.state);
        return new Promise(resolve => hyd.waiters.push(resolve));
    }
    function markHydrated(how) {
        if (hyd.state !== "waiting") return;
        hyd.state = how;
        if (hyd.timer !== null) env.timers.clear(hyd.timer);
        hyd.timer = null;
        if (how === "timedOut" && hyd.waiting.size) {
            const names = [...hyd.waiting].map(id => env.userName(id));
            env.log.warn(`The GM store did not hear from ${names.join(", ")} in ${TIMING.gmStoreSyncMs} ms; it carries on, and their copy merges when it arrives.`);
            env.notify("warn", env.text?.("DRPG.GmStore.syncTimedOut", { names: names.join(", ") }) ?? `The GM store did not hear from ${names.join(", ")}.`);
        }
        const waiters = hyd.waiters.splice(0);
        waiters.forEach(r => r(how));
        try { env.onHydrated?.(hyd.wid, how); } catch (err) { env.log.error("The GM store's hydration hook failed", err); }
    }
    function checkAnswered() {
        if (hyd.state === "waiting" && !hyd.waiting.size) markHydrated("answered");
    }

    /* ------------------------------ protocol ------------------------------ */

    function digests() {
        const out = {};
        for (const st of stores.values()) if (st.spec.sync) out[st.spec.name] = sectionDigest(home(st).section);
        return out;
    }
    const syncing = () => [...stores.values()].some(st => st.spec.sync);

    function sendHello(recipients) {
        if (!recipients.length || !syncing()) return;
        sendTo(recipients, { action: GMS_ACTIONS.hello, world: env.worldId(), digests: digests() });
    }

    function sendStates(to, names) {
        for (const name of names) {
            const st = stores.get(name);
            if (!st?.spec.sync) continue;
            const parts = partsOf(home(st).section);
            parts.forEach((section, i) => sendTo([to], {
                action: GMS_ACTIONS.state, world: env.worldId(), store: name, section: clone(section), part: i + 1, parts: parts.length
            }));
        }
    }

    function specsByName() {
        return new Map([...stores].map(([name, st]) => [name, st.spec]));
    }

    function onPacket(packet, senderId) {
        if (!isPlain(packet) || typeof packet.action !== "string" || !packet.action.startsWith("gms.")) return;
        const why = gmsRefusal(packet, {
            amGM: env.isGM(), senderIsGM: env.senderIsGM(senderId), senderId, selfId: env.selfId(),
            worldId: env.worldId(), stores: specsByName()
        });
        if (why) {
            const tag = `${senderId}|${why}`;
            if (env.isGM() && senderId !== env.selfId() && !refusedWarned.has(tag)) {
                refusedWarned.add(tag);
                env.log.warn(`The GM store refused ${packet.action} from ${env.userName(senderId)}: ${why}.`);
            }
            return;
        }
        switch (packet.action) {
            case GMS_ACTIONS.hello: {
                const mine = digests();
                const differ = Object.keys(mine).filter(name => mine[name].h !== packet.digests?.[name]?.h);
                sendStates(senderId, differ);
                sendTo([senderId], { action: GMS_ACTIONS.done, world: env.worldId(), ask: differ });
                break;
            }
            case GMS_ACTIONS.state:
            case GMS_ACTIONS.delta: {
                const st = stores.get(packet.store);
                const sec = normalizeSection(packet.action === GMS_ACTIONS.state ? packet.section : packet.delta);
                observeSection(sec, senderId);
                const w = home(st);
                void touched(st, w, mergeInto(w.section, sec, st.spec), { local: false });
                break;
            }
            case GMS_ACTIONS.done: {
                hyd.waiting.delete(senderId);
                checkAnswered();
                const ask = packet.ask.filter(name => stores.get(name)?.spec.sync);
                if (ask.length) {
                    sendStates(senderId, ask);
                    sendTo([senderId], { action: GMS_ACTIONS.done, world: env.worldId(), ask: [] });
                }
                break;
            }
        }
    }

    /** Another GM connected (hello to them), or left (no longer waited for). */
    function onUserConnected(user, connected) {
        if (!env.isGM() || !user?.isGM || user.id === env.selfId()) return;
        if (connected) sendHello([user.id]);
        else {
            hyd.waiting.delete(user.id);
            checkAnswered();
        }
    }

    /* ------------------------------ the claim ----------------------------- */

    async function claimStore(st) {
        const w = current(st);
        if (w.section.claim?.at) return w.section.claim.census ?? null;
        const spec = st.spec;
        let rows = [], left = [], unassigned = {}, legacy;
        try {
            legacy = spec.legacyKey ? readLegacy(spec.legacyKey) : undefined;
            if (spec.claim && legacy !== undefined && legacy !== null) ({ rows = [], left = [], unassigned = {} } = (await spec.claim(legacy, { engine: api })) ?? {});
            const weak = weakOf(w.section);
            /* An old row cannot have been written after this moment: a stamp ahead of it
               came from a clock that ran ahead (1.2.x stamped with each browser's own
               `Date.now()`), and would have beaten every edit made since until real time
               passed it - a bogus one for ever. It is taken at this moment, and counted
               (the review's DS-m3, measured: a row two hours ahead undid a correction made
               five minutes after the upgrade on the next exchange). */
            const ceiling = Math.floor(now());
            let legacyMax = 0, tombstones = 0, claimed = 0, clamped = 0;
            const keys = [];
            const mini = emptySection();
            for (const row of rows) {
                let s = Number.isFinite(row.stamp) && row.stamp > 0 ? row.stamp : weak;
                if (s > ceiling) { s = ceiling; clamped++; }
                if (s !== weak && s > legacyMax) legacyMax = s;
                if (row.deleted) { dropKey(mini, row.key, s, spec); tombstones++; }
                else { writeFields(mini, row.key, row.fields ?? {}, s, spec, { whole: true }); keys.push(row.key); }
                claimed++;
            }
            /* THROUGH THE MERGE (the review's DS-m1). The listener is installed before the
               open, so a peer's copy can merge before a store's claim; written straight into
               the section, an old row replaced a newer value that had arrived first, and the
               browser read the older one until the next exchange - with no other GM left, for
               good (measured: "key" at the peer's stamp became the old "prep"). Built apart and
               merged, the newer value stands, as it does for `reclaim` and a restore. */
            mergeInto(w.section, mini, spec);
            observeSection(w.section);
            const reasons = {};
            for (const { reason } of left) reasons[reason] = (reasons[reason] ?? 0) + 1;
            /* The rows the old key holds, counted from the old value itself and not from what the
               claim answered: `claimed + left === legacy` is then something the census test can
               find false - a claim that silently skipped a row (the design's H5). */
            const census = { legacy: legacyRows(spec, legacy), claimed, left: left.length, tombstones, reasons };
            if (clamped) census.clamped = clamped;
            w.section.claim = { at: stamp(), legacyHash: fnv1a(stableJson(legacy ?? null)), legacyMax, census, keys };
            if (Object.keys(unassigned).length) w.section.unassigned = { ...(w.section.unassigned ?? {}), ...unassigned };
            w.needsWrite = true;
            await schedule(st);
            return census;
        } catch (err) {
            // Nothing was changed: the old key was only read, and without `claim.at` the claim runs
            // again at the next load. The primary is told once, with the count it could not take.
            const n = legacyRows(spec, legacy);
            w.section.claim = { failed: String(err?.message ?? err), rows: n };
            env.log.error(`The GM store could not take over this browser's old "${spec.name}"`, err);
            if (env.isPrimary()) env.notify("error", env.text?.("DRPG.GmStore.claimFailed", { store: spec.name, n, error: String(err?.message ?? err) })
                ?? `The GM store could not take over this browser's old ${spec.name} (${n} rows). Nothing was changed.`, { permanent: true });
            return null;
        }
    }

    /* ------------------------------ reset cuts ---------------------------- */

    /**
     * Raise every section and copy of a wiped reset group to the clock's cut for it
     * (D12 option 1). Nothing is written when no watermark rises, so a redraw of the
     * clock that changes nothing writes nothing (14-quiet).
     *
     * A copy is cut where it is read (`readMine`, `receiveCopy`), so nothing of it is
     * written here either. What the cut changes is what the copy reads, and nothing
     * would draw that again: a reset sends no answer for a group it only cuts - the
     * Level Ups on offer (the owner's Q4) - so a copy that held something under the
     * new cut calls its spec's `onCut` once. `seenCuts` is the cut each copy was last
     * read under, per world, from the store's open.
     */
    function applyCuts(clock = env.clock()) {
        const cuts = isPlain(clock?.resetCuts) ? clock.resetCuts : {};
        const done = [];
        for (const st of stores.values()) {
            const cut = cuts[st.spec.resetGroup];
            if (!Number.isFinite(cut)) continue;
            observe(cut);
            if (!env.isGM()) continue;
            const w = current(st);
            if (raiseCleared(w.section, cut, st.spec)) {
                w.needsWrite = true;
                done.push(schedule(st));
            }
        }
        const wid = worldId();
        for (const cs of copies.values()) {
            const cut = cuts[cs.spec.resetGroup];
            if (!Number.isFinite(cut)) continue;
            observe(cut);
            const was = cs.seenCuts.get(wid) ?? 0;
            if (!(cut > was)) continue;
            cs.seenCuts.set(wid, cut);
            const held = newestStamp(copyRecord(cs)?.stamps);
            if (!(held > was && held <= cut) || typeof cs.spec.onCut !== "function") continue;
            try { cs.spec.onCut(); }
            catch (err) { env.log.error(`The copy "${cs.spec.name}" could not be drawn again after a reset`, err); }
        }
        return Promise.all(done);
    }

    /* ------------------------------ copies -------------------------------- */

    function copyCut(spec) {
        const cut = env.clock()?.resetCuts?.[spec.resetGroup];
        return Number.isFinite(cut) ? cut : 0;
    }
    /**
     * THE COPY'S STAMPS, PART BY PART (the review's B1, 26.09.2026). A copy was stamped
     * with its record's newest stamp, whatever field that stamp was on: a GM that had not
     * merged a newer pick moved the lair, sent the former Mastermind's player "yes" and
     * the new room at the room's fresh stamp - and once the GMs agreed, that stamp was
     * the record's newest, so the primary's correct answer came at an equal stamp and
     * was refused. A copy now carries `{ part: stamp }`, one stamp per store field its
     * value was computed from (one number is the part ""), and a spec's `combine(held,
     * next)` decides what of it is taken; with none, the whole copy is taken only when
     * it is at least as new in every part and newer in one (`newerStamps`).
     */
    function copyRecord(cs) {
        const wid = worldId(), uid = env.selfId();
        const tag = `${wid}|${uid}`;
        if (!cs.cache.has(tag)) {
            const value = parseValue(env.storage.read(cs.spec.key));
            const rec = value.worlds?.[wid]?.[uid];
            const stamps = isPlain(rec) ? copyStamps(rec.stamps ?? rec.stamp) : null;
            cs.cache.set(tag, stamps ? { value: rec.value, stamps } : null);
        }
        return cs.cache.get(tag);
    }
    function readMine(name) {
        const cs = copies.get(name);
        if (!cs) return undefined;
        const rec = copyRecord(cs);
        if (!rec || newestStamp(rec.stamps) <= copyCut(cs.spec)) return clone(cs.spec.fallback);
        return rec.value;
    }
    function mineStamp(name) {
        const cs = copies.get(name);
        return cs ? newestStamp(copyRecord(cs)?.stamps) : 0;
    }
    function mineStamps(name) {
        const cs = copies.get(name);
        return cs ? clone(copyRecord(cs)?.stamps ?? {}) : {};
    }
    /**
     * A GM's answer for this user's copy: taken as its spec's `combine` decides, or whole
     * when it is newer part by part (`newerStamps`) than the copy held here - a copy under
     * the clock's cut for its group counts as none, and so does a part under it. An answer
     * whose every part is 0 or under the cut - a GM whose browser holds nothing - replaces
     * nothing. A stamp beyond ten minutes ahead is stored at that bound, so one fast clock
     * cannot lock the copy.
     */
    async function receiveCopy(name, value, s) {
        const cs = copies.get(name);
        const incoming = copyStamps(s);
        if (!cs || !incoming) return false;
        const cut = copyCut(cs.spec), bound = now() + TIMING.gmStoreSkewMs;
        for (const part of Object.keys(incoming)) incoming[part] = Math.min(incoming[part], bound);
        if (newestStamp(incoming) <= cut) return false;
        const rec = copyRecord(cs);
        const held = rec && newestStamp(rec.stamps) > cut ? clone(rec) : null;
        const offered = { value: clone(value), stamps: incoming };
        const taken = cs.spec.combine ? cs.spec.combine(held, offered, { cut })
            : (newerStamps(incoming, held?.stamps, cut) ? offered : null);
        if (!taken) return false;
        const wid = worldId(), uid = env.selfId();
        const next = { value: clone(taken.value), stamps: { ...taken.stamps } };
        const stored = parseValue(env.storage.read(cs.spec.key));
        stored.worlds[wid] = { ...(isPlain(stored.worlds[wid]) ? stored.worlds[wid] : {}), [uid]: next };
        cs.cache.set(`${wid}|${uid}`, next);
        cs.writing = true;
        try { await env.storage.write(cs.spec.key, { v: FORMAT, worlds: stored.worlds }); }
        finally { cs.writing = false; }
        return true;
    }

    /**
     * A PLAYER COPY'S OLD KEY (E04 C9): the copies are not claimed, but for one whose
     * spec has a `claim` - the fog's, whose old rows on the players' browsers are the
     * only copy of the ledger outside the GMs' - the old key is read here (the engine is
     * the one reader of old keys, R171) and what the claim makes of it is received like
     * an answer, so it merges and never replaces. The old key is never written. Run on
     * every load: the claim's rows are weak, so taking them twice changes nothing.
     */
    async function claimCopy(name) {
        const cs = copies.get(name);
        if (!cs?.spec.claim || !cs.spec.legacyKey) return false;
        const legacy = readLegacy(cs.spec.legacyKey);
        if (legacy === undefined || legacy === null) return false;
        const offer = await cs.spec.claim(legacy);
        return offer ? receiveCopy(name, offer.value, offer.stamps) : false;
    }

    /** Suite and harness only: this user's copy in this world emptied here, as a lost browser has it; nothing is sent. */
    async function forgetCopy(name) {
        const cs = copies.get(name);
        if (!cs) return false;
        const wid = worldId(), uid = env.selfId();
        const stored = parseValue(env.storage.read(cs.spec.key));
        if (isPlain(stored.worlds[wid])) delete stored.worlds[wid][uid];
        cs.cache.delete(`${wid}|${uid}`);
        cs.writing = true;
        try { await env.storage.write(cs.spec.key, { v: FORMAT, worlds: stored.worlds }); }
        finally { cs.writing = false; }
        return true;
    }

    /* ------------------------------ open ---------------------------------- */

    async function open() {
        if (opened) return;
        opened = true;
        const wid = worldId();
        hyd.wid = wid;
        for (const cs of copies.values()) cs.seenCuts.set(wid, copyCut(cs.spec));
        if (!env.isGM()) { hyd.state = "alone"; return; }
        hyd.state = "opening";
        for (const st of stores.values()) {
            current(st);
            await claimStore(st);
        }
        await applyCuts();
        const others = peers();
        hyd.waiting = new Set(syncing() ? others : []);
        hyd.state = "waiting";
        if (!hyd.waiting.size) { markHydrated("alone"); return; }
        hyd.timer = env.timers.set(() => markHydrated("timedOut"), TIMING.gmStoreSyncMs);
        sendHello(others);
    }

    /** While on, nothing is sent (deltas, hellos, answers); incoming packets still merge. Off sends hello. */
    function hold(on) {
        const was = held;
        held = Boolean(on);
        if (was && !held && opened && env.isGM()) sendHello(peers());
    }

    async function idle() {
        for (let i = 0; i < 20; i++) {
            const busy = [...stores.values()].filter(st => st.flushTimer !== null || st.flushing);
            if (!busy.length) return;
            await Promise.all(busy.map(st => st.flushing ? new Promise(r => env.timers.set(r, 5)) : new Promise(r => st.waiters.push(r))));
        }
    }

    /** A write to a store key this engine did not make (the suite's raw restore): the cache is dropped. */
    function onClientSettingChanged(fullKey) {
        for (const st of stores.values()) {
            if (fullKey === `${MODULE_ID}.${st.spec.key}` && !st.writing) { st.worlds.clear(); st.lastRaw = null; }
        }
        for (const cs of copies.values()) {
            if (fullKey === `${MODULE_ID}.${cs.spec.key}` && !cs.writing) cs.cache.clear();
        }
    }

    /**
     * Another tab of this browser wrote a store: its value is merged into this tab's
     * memory, and not written back - that tab wrote it, read-merge-write, so what is
     * stored already holds it; this tab's own changes go out with its own next flush.
     * Two tabs writing at once is not atomic (LIVE-E04-11).
     */
    function onStorage(fullKey, rawValue) {
        for (const st of stores.values()) {
            if (fullKey !== `${MODULE_ID}.${st.spec.key}`) continue;
            const value = parseValue(rawValue);
            for (const w of st.worlds.values()) {
                const theirs = normalizeSection(value.worlds[w.wid]);
                if (!theirs) continue;
                observeSection(theirs);
                mergeInto(w.section, theirs, st.spec);
            }
            if (!st.worlds.size || ![...st.worlds.values()].some(w => w.needsWrite)) st.lastRaw = rawValue ?? null;
        }
        for (const cs of copies.values()) if (fullKey === `${MODULE_ID}.${cs.spec.key}`) cs.cache.clear();
    }

    /* ------------------------------ definitions --------------------------- */

    function define(spec) {
        if (stores.has(spec.name)) return stores.get(spec.name).handle;
        const st = { spec: Object.freeze({ kind: "ledger", sync: true, backup: true, ...spec }), worlds: new Map(),
            lastRaw: null, writing: false, flushTimer: null, flushing: false, waiters: [] };
        st.handle = makeHandle(st);
        stores.set(spec.name, st);
        return st.handle;
    }
    function defineCopy(spec) {
        if (!copies.has(spec.name)) copies.set(spec.name, { spec: Object.freeze({ fallback: null, ...spec }), cache: new Map(), writing: false, seenCuts: new Map() });
        return { name: spec.name, read: () => readMine(spec.name), stamp: () => mineStamp(spec.name), stamps: () => mineStamps(spec.name),
            receive: (v, s) => receiveCopy(spec.name, v, s), claim: () => claimCopy(spec.name), forget: () => forgetCopy(spec.name) };
    }

    /**
     * Run `fn` with the stores answering for another world id, and put the real one
     * back whatever happens: the suite's way of standing in a world this browser has
     * never opened (a claim not yet made) or in one beside it (a clear that must not
     * cross), without writing to Foundry's own world object - whether v14 lets its id
     * be assigned has not been tried, and the stores need nothing else changed.
     */
    async function withWorld(id, fn) {
        const was = worldOverride;
        worldOverride = String(id);
        try { return await fn(); }
        finally { worldOverride = was; }
    }

    /**
     * Run `fn` with the old keys named in `values` read from there instead of this
     * browser's storage, and put the real reader back whatever happens: the suite's way
     * of claiming a fixture without writing a real old key. `values` is read at each
     * read, so a test may change it mid-run (a downgrade writing the old key again).
     */
    async function withLegacy(values, fn) {
        const was = legacyOverride;
        legacyOverride = values;
        try { return await fn(); }
        finally { legacyOverride = was; }
    }

    const api = {
        define, defineCopy, open, hold, idle, stamp, observe, now, withWorld, withLegacy, worldId,
        handle: name => stores.get(name)?.handle ?? null,
        handles: () => [...stores.values()].map(st => st.handle),
        copySpec: name => copies.get(name)?.spec ?? null,
        copyNames: () => [...copies.keys()],
        readMine, mineStamp, mineStamps, receiveCopy,
        whenHydrated, isHydrated,
        hydration: () => ({ world: hyd.wid, state: hyd.state, waiting: [...hyd.waiting] }),
        skew: () => Object.fromEntries(skewWarned),
        applyCuts, onPacket, onUserConnected, onClientSettingChanged, onStorage, sendHello: () => sendHello(peers())
    };
    return api;
}

/* ------------------------------------------------------------------------ *
 * The module's engine, over the real Foundry.
 * ------------------------------------------------------------------------ */

/* What gm-stores.mjs hands in at ready (see IMPORTS in the header): utils.mjs's
   GM predicates and log, settings.mjs's clock. Until then a GM is nobody and the
   log is the console, which is what a read before ready should see. */
const deps = {
    activeGmIds: () => [],
    primaryGmId: () => null,
    getClock: () => ({}),
    clockKey: "clock",
    warn: (...a) => console.warn(`${MODULE_ID} |`, ...a),
    error: (...a) => console.error(`${MODULE_ID} |`, ...a),
    debug: () => {},
    text: null,
    upgradeMark: () => null
};

export function configureGmStore(given = {}) {
    Object.assign(deps, given);
}

const engine = createGmStoreEngine({
    selfId: () => game.user?.id ?? null,
    isGM: () => Boolean(game.user?.isGM),
    isPrimary: () => Boolean(game.user?.isGM) && deps.primaryGmId() === game.user?.id,
    worldId: () => String(game.world?.id ?? ""),
    activeGmIds: () => deps.activeGmIds(),
    primaryGmId: () => deps.primaryGmId(),
    senderIsGM: id => Boolean(game.users?.get(id)?.isGM),
    userName: id => game.users?.get(id)?.name ?? String(id),
    send: (packet, recipients) => game.socket.emit(SOCKET_EVENT, packet, { recipients }),
    storage: {
        read: key => game.settings?.storage?.get?.("client")?.getItem?.(`${MODULE_ID}.${key}`) ?? null,
        write: (key, value) => game.settings.set(MODULE_ID, key, value)
    },
    readLegacy: key => {
        try { return structuredClone(game.settings.get(MODULE_ID, key)); } catch { return undefined; }
    },
    upgradeMark: () => deps.upgradeMark?.() ?? null,
    now: () => {
        const t = game.time?.serverTime;
        return Number.isFinite(t) && t > 0 ? t : Date.now();
    },
    timers: { set: (fn, ms) => setTimeout(fn, ms), clear: h => clearTimeout(h) },
    clock: () => deps.getClock(),
    log: { warn: (...a) => deps.warn(...a), error: (...a) => deps.error(...a), debug: (...a) => deps.debug(...a) },
    notify: (level, text, opts) => ui.notifications?.[level]?.(text, opts),
    text: (key, data) => deps.text?.(key, data) ?? null,
    onHydrated: (wid, how) => { for (const fn of hydratedHooks) fn(wid, how); }
});
const hydratedHooks = [];

export const defineGmStore = spec => engine.define(spec);
export const defineGmCopy = spec => engine.defineCopy(spec);
export const gmStoreByName = name => engine.handle(name);
export const gmStoreHandles = () => engine.handles();
export const gmCopyNames = () => engine.copyNames();
export const gmCopySpec = name => engine.copySpec(name);
/** This world's, this user's copy of a GM store, or its fallback: what a player's client knows. */
export const readMine = name => engine.readMine(name);
export const mineStamp = name => engine.mineStamp(name);
export const mineStamps = name => engine.mineStamps(name);
export const receiveCopy = (name, value, s) => engine.receiveCopy(name, value, s);
export const gmStoreStamp = () => engine.stamp();
export const gmStoreNow = () => engine.now();
export const whenGmStoresHydrated = () => engine.whenHydrated();
export const gmStoresHydrated = () => engine.isHydrated();
export const gmStoreHydration = () => engine.hydration();
export const gmStoreSkew = () => engine.skew();
export const applyGmStoreCuts = clock => engine.applyCuts(clock);
/** Run `fn(worldId, how)` once this client's stores have their peers' copies (or were alone, or timed out). */
export function onGmStoresHydrated(fn) { hydratedHooks.push(fn); }
/** Suite hooks (2.13): while held nothing is sent; idle resolves when no flush is pending. */
export const gmStoreHold = on => engine.hold(on);
/** Suite only: run `fn` with the stores answering for another world id (see `withWorld`). */
export const withGmStoreWorld = (id, fn) => engine.withWorld(id, fn);
/** Suite only: run `fn` with the old keys in `values` read in place of this browser's (see `withLegacy`). */
export const withGmStoreLegacy = (values, fn) => engine.withLegacy(values, fn);
export const gmStoresIdle = () => engine.idle();

let listening = false;
/**
 * Open the stores for this world on this client: the claim, the clock's cuts, the
 * listener and, on a GM, the hello. Called once at ready, before the migration
 * (gm-stores.mjs's `openGmStores`).
 */
export async function openGmStoreEngine() {
    if (!listening) {
        listening = true;
        if (game.user?.isGM) {
            game.socket.on(SOCKET_EVENT, (packet, senderId) => engine.onPacket(packet, senderId));
            // A socket that comes back after a drop re-exchanges: deltas sent while it was down
            // arrive with the states. Whether v14's socket emits "connect" again is LIVE-E04-04.
            game.socket.on("connect", () => engine.sendHello());
            Hooks.on("userConnected", (user, connected) => engine.onUserConnected(user, connected));
            window.addEventListener?.("storage", ev => { if (ev?.key) engine.onStorage(ev.key, ev.newValue); });
        }
        Hooks.on("clientSettingChanged", key => engine.onClientSettingChanged(key));
        /* The clock's cuts, on every client. A world whose clock was never written makes
           the Setting document on its first write, and that is `createSetting` in Foundry;
           the harness fires `updateSetting` for both, so only the update is measured. */
        for (const hook of ["updateSetting", "createSetting"]) {
            Hooks.on(hook, setting => {
                if (setting?.key === `${MODULE_ID}.${deps.clockKey}`) void engine.applyCuts();
            });
        }
    }
    await engine.open();
}
