/**
 * Foundry-semantics utility subset. These MUST mimic real foundry.utils -
 * the module's state handling depends on merge/expand/diff behaviour.
 */

import { ForcedDeletion, ForcedReplacement, isOperator, kindOf, replacementOf, LEGACY } from "./operators.mjs";

/** An object to walk into: not null, not an array, not an operator in either form (lib/operators.mjs). */
const walkable = v => v !== null && typeof v === "object" && !Array.isArray(v) && !isOperator(v);

export function randomID(length = 16) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let out = "";
    for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
}

export function escapeHTML(str) {
    return String(str).replace(/[&<>"']/g, c => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#x27;"
    }[c]));
}

/**
 * `foundry.utils.cleanHTML`, as far as this harness can stand in for it (E02,
 * 24.09.2026). Foundry's own is an allow-list sanitiser we do not have the source
 * of here; what the module relies on it for is the part every sanitiser agrees
 * on - no `<script>`, `<iframe>`, `<object>` or `<embed>`, no `on*` handler
 * attribute, no `javascript:` address - while `data-*`, `<button>`, classes and
 * ordinary markup survive. That is what this does, on jsdom's own parser, so a
 * test that sends `<img src=x onerror=...>` through the module measures the
 * module's choice to clean, not this function's thoroughness.
 */
export function cleanHTML(raw) {
    const doc = globalThis.document;
    const tpl = doc.createElement("template");
    tpl.innerHTML = String(raw ?? "");
    for (const el of tpl.content.querySelectorAll("script, iframe, object, embed")) el.remove();
    for (const el of tpl.content.querySelectorAll("*")) {
        for (const attr of [...el.attributes]) {
            const name = attr.name.toLowerCase();
            const value = String(attr.value ?? "").trim().toLowerCase();
            if (name.startsWith("on")) el.removeAttribute(attr.name);
            else if ((name === "href" || name === "src" || name === "xlink:href") && value.startsWith("javascript:")) {
                el.removeAttribute(attr.name);
            }
        }
    }
    return tpl.innerHTML;
}

export function unescapeHTML(str) {
    return String(str).replace(/&(amp|lt|gt|quot|#x27|#39);/g, m => ({
        "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#x27;": "'", "&#39;": "'"
    }[m]));
}

export function deepClone(v) {
    if (v === null || typeof v !== "object") return v;
    if (v instanceof Date) return new Date(v);
    // Operators are leaves: a deletion is one shared value, a replacement is copied
    // as a replacement - walked like a plain object, either became a plain object.
    if (v instanceof ForcedDeletion) return v;
    if (v instanceof ForcedReplacement) return new ForcedReplacement(deepClone(v.replacement));
    if (Array.isArray(v)) return v.map(deepClone);
    const out = {};
    for (const k of Object.keys(v)) out[k] = deepClone(v[k]);
    return out;
}

export const duplicate = o => JSON.parse(JSON.stringify(o));

export function getType(v) {
    if (v === null) return "null";
    if (Array.isArray(v)) return "Array";
    return typeof v === "object" ? "Object" : typeof v;
}

export function getProperty(obj, path) {
    if (!path) return obj;
    let target = obj;
    for (const p of String(path).split(".")) {
        if (target === null || target === undefined) return undefined;
        if (typeof target !== "object") return undefined;
        target = target[p];
    }
    return target;
}

export function hasProperty(obj, path) {
    return getProperty(obj, path) !== undefined;
}

export function setProperty(obj, path, value) {
    const parts = String(path).split(".");
    const key = parts.pop();
    let target = obj;
    for (const p of parts) {
        if (typeof target[p] !== "object" || target[p] === null) target[p] = {};
        target = target[p];
    }
    const changed = target[key] !== value;
    target[key] = value;
    return changed;
}

/** An operator (lib/operators.mjs) is a value here, never a branch - in `flattenObject` too. */
export function expandObject(obj) {
    const out = {};
    for (const [k, v] of Object.entries(obj ?? {})) {
        const val = walkable(v) ? expandObject(v) : v;
        if (k.includes(".")) setProperty(out, k, val);
        else if (out[k] !== null && typeof out[k] === "object" && !isOperator(out[k]) && walkable(val)) {
            Object.assign(out[k], val);
        } else out[k] = val;
    }
    return out;
}

export function flattenObject(obj, _d = 0) {
    const out = {};
    for (const [k, v] of Object.entries(obj ?? {})) {
        if (walkable(v) && _d < 32 && Object.keys(v).length) {
            for (const [ik, iv] of Object.entries(flattenObject(v, _d + 1))) out[`${k}.${ik}`] = iv;
        } else out[k] = v;
    }
    return out;
}

/*
 * WHERE A LEGACY KEY IS SAID WHEN NO DOCUMENT WRITE CARRIES IT (E30, 24.09.2026).
 * A document write is reported by whoever applies it (the cluster, or the shim's
 * updateSource and clone); `mergeObject` is a utility the module may call on any
 * object, so the host that loads this file says where its reports go
 * (client-entry.mjs sends them to the cluster). Nothing is reported until it does.
 */
let legacySink = null;
export function reportLegacyKeysTo(fn) { legacySink = typeof fn === "function" ? fn : null; }

/**
 * Foundry mergeObject subset: insertKeys/insertValues/overwrite true, recursive, performDeletions option.
 *
 * `-=key` with `performDeletions` still deletes here: the utility is not a document
 * write, and none of the module's five callers passes `performDeletions` (grep,
 * 24.09.2026). Each such deletion is reported through `reportLegacyKeysTo`, so the
 * day one does, the run says so.
 */
export function mergeObject(original, other = {}, { insertKeys = true, insertValues = true, overwrite = true, recursive = true, inplace = true, performDeletions = false } = {}) {
    if (!inplace) original = deepClone(original);
    const expanded = expandObject(other);
    for (const [k, v] of Object.entries(expanded)) {
        _mergeKey(original, k, v, { insertKeys, insertValues, overwrite, recursive, performDeletions, at: "" });
    }
    return original;
}

function _mergeKey(target, key, value, opts) {
    if (key.startsWith("-=")) {
        if (opts.performDeletions) {
            legacySink?.({ where: "foundry.utils.mergeObject", path: opts.at ? `${opts.at}.${key}` : key });
            delete target[key.slice(2)];
        } else target[key] = value;
        return;
    }
    const exists = key in target;
    const tv = target[key];
    const bothObjects = exists && tv !== null && typeof tv === "object" && !Array.isArray(tv)
        && value !== null && typeof value === "object" && !Array.isArray(value);
    if (bothObjects && opts.recursive) {
        const at = opts.at ? `${opts.at}.${key}` : key;
        for (const [ik, iv] of Object.entries(value)) {
            _mergeKey(tv, ik, iv, { ...opts, insertKeys: opts.insertValues, at });
        }
        return;
    }
    if (exists && !opts.overwrite) return;
    if (!exists && !opts.insertKeys) return;
    target[key] = value;
}

/** Recursive diff of changes vs current: returns only keys whose value differs. */
export function diffObject(original, other) {
    const out = {};
    for (const [k, v] of Object.entries(other ?? {})) {
        const ov = original?.[k];
        if (v !== null && typeof v === "object" && !Array.isArray(v)) {
            const inner = diffObject(ov ?? {}, v);
            if (Object.keys(inner).length) out[k] = inner;
        } else if (Array.isArray(v)) {
            if (JSON.stringify(ov) !== JSON.stringify(v)) out[k] = v;
        } else if (ov !== v) out[k] = v;
    }
    return out;
}

export function isEmpty(v) {
    if (v === null || v === undefined) return true;
    if (Array.isArray(v)) return !v.length;
    if (typeof v === "object") return !Object.keys(v).length;
    if (typeof v === "string") return !v.length;
    return false;
}

export function isNewerVersion(v1, v0) {
    const a = String(v1).replace(/^v/, "").split(".").map(n => parseInt(n) || 0);
    const b = String(v0).replace(/^v/, "").split(".").map(n => parseInt(n) || 0);
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
        if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
    }
    return false;
}

export function debounce(fn, delay) {
    let t;
    const wrapped = (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
    wrapped.cancel = () => clearTimeout(t);
    return wrapped;
}

export function throttle(fn, delay) {
    let last = 0, t;
    return (...args) => {
        const now = Date.now();
        if (now - last >= delay) { last = now; fn(...args); }
        else { clearTimeout(t); t = setTimeout(() => { last = Date.now(); fn(...args); }, delay - (now - last)); }
    };
}

export class Color extends Number {
    static from(v) {
        if (typeof v === "string") return new Color(parseInt(v.replace("#", ""), 16));
        return new Color(v);
    }
    get rgb() { const n = Number(this); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; }
    get css() { return "#" + Number(this).toString(16).padStart(6, "0"); }
    toString() { return this.css; }
}

export function timeSince() { return "just now"; }

/** Embedded-collection array fields per document type (Foundry schema subset). */
export const EMBEDDED_ARRAYS = {
    Actor: ["items", "effects"], Item: ["effects"], Scene: ["tokens", "regions", "walls"],
    RollTable: ["results"], Playlist: ["sounds"], Region: ["behaviors"]
};

/**
 * One document write applied to a document's source, the way v14 applies it as
 * far as the harness models it (lib/operators.mjs) - E30, 24.09.2026:
 *   - a key spelled the old way, `-=key` or `==key`, changes nothing and is handed
 *     to `onLegacyKey(path)`; it is neither a deletion nor a literal key;
 *   - a ForcedDeletion removes its key; a ForcedReplacement puts a copy of its
 *     value in place of the key's whole value;
 *   - a plain object merges into a plain object, key by key; over anything else
 *     it is built fresh the same way, so an operator or a legacy key inside a new
 *     branch is read, not stored;
 *   - anything else is a copy of the value.
 * Before this, every write went through `mergeObject(..., { performDeletions: true })`,
 * which deleted on `-=` and stored an operator as the plain object JSON had made of
 * it. For a write with no operator and no legacy key the two give the same source.
 */
export function applyUpdate(target, changes, { onLegacyKey = null } = {}) {
    return applyExpanded(target, expandObject(changes), onLegacyKey, "");
}

function applyExpanded(target, expanded, onLegacyKey, at) {
    for (const [k, v] of Object.entries(expanded)) {
        const where = at ? `${at}.${k}` : k;
        if (LEGACY.test(k)) { onLegacyKey?.(where); continue; }
        const kind = kindOf(v);
        if (kind === "ForcedDeletion") { delete target[k]; continue; }
        if (kind === "ForcedReplacement") { target[k] = deepClone(replacementOf(v)); continue; }
        if (walkable(v)) {
            if (!walkable(target[k])) target[k] = {};
            applyExpanded(target[k], v, onLegacyKey, where);
            continue;
        }
        target[k] = deepClone(v);
    }
    return target;
}

/**
 * Foundry update semantics for a parent document: an array under an embedded
 * key is a DIFFERENTIAL update - entries merge into the existing element with
 * the same _id - never a wholesale replacement. Everything else merges, through
 * `applyUpdate`; a legacy key's path is reported with the embedded entry's id in it.
 */
export function applyDocChanges(collName, raw, changes, { onLegacyKey = null } = {}) {
    const expanded = expandObject(deepClone(changes));
    for (const key of EMBEDDED_ARRAYS[collName] ?? []) {
        if (!Array.isArray(expanded[key])) continue;
        const patches = expanded[key];
        delete expanded[key];
        raw[key] = raw[key] ?? [];
        for (const p of patches) {
            const target = p?._id && raw[key].find(x => x._id === p._id);
            if (target) {
                const { _id, ...rest } = p;
                applyExpanded(target, expandObject(rest), onLegacyKey, `${key}.${_id}`);
            }
            // no matching _id: real Foundry rejects; the harness drops it
        }
    }
    applyExpanded(raw, expanded, onLegacyKey, "");
}

export function fromUuidParts(uuid) {
    // "Actor.abc", "Actor.abc.Item.def", "Scene.s.Token.t", "Compendium...." (unsupported)
    return String(uuid ?? "").split(".");
}
