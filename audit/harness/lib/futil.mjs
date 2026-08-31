/**
 * Foundry-semantics utility subset. These MUST mimic real foundry.utils -
 * the module's state handling depends on merge/expand/diff behaviour.
 */

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

export function unescapeHTML(str) {
    return String(str).replace(/&(amp|lt|gt|quot|#x27|#39);/g, m => ({
        "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#x27;": "'", "&#39;": "'"
    }[m]));
}

export function deepClone(v) {
    if (v === null || typeof v !== "object") return v;
    if (v instanceof Date) return new Date(v);
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

export function expandObject(obj) {
    const out = {};
    for (const [k, v] of Object.entries(obj ?? {})) {
        const val = (v !== null && typeof v === "object" && !Array.isArray(v)) ? expandObject(v) : v;
        if (k.includes(".")) setProperty(out, k, val);
        else if (out[k] !== null && typeof out[k] === "object" && val !== null && typeof val === "object" && !Array.isArray(val)) {
            Object.assign(out[k], val);
        } else out[k] = val;
    }
    return out;
}

export function flattenObject(obj, _d = 0) {
    const out = {};
    for (const [k, v] of Object.entries(obj ?? {})) {
        if (v !== null && typeof v === "object" && !Array.isArray(v) && _d < 32 && Object.keys(v).length) {
            for (const [ik, iv] of Object.entries(flattenObject(v, _d + 1))) out[`${k}.${ik}`] = iv;
        } else out[k] = v;
    }
    return out;
}

/** Foundry mergeObject subset: insertKeys/insertValues/overwrite true, recursive, performDeletions option. */
export function mergeObject(original, other = {}, { insertKeys = true, insertValues = true, overwrite = true, recursive = true, inplace = true, performDeletions = false } = {}) {
    if (!inplace) original = deepClone(original);
    const expanded = expandObject(other);
    for (const [k, v] of Object.entries(expanded)) {
        _mergeKey(original, k, v, { insertKeys, insertValues, overwrite, recursive, performDeletions });
    }
    return original;
}

function _mergeKey(target, key, value, opts) {
    if (key.startsWith("-=")) {
        if (opts.performDeletions) delete target[key.slice(2)];
        else target[key] = value;
        return;
    }
    const exists = key in target;
    const tv = target[key];
    const bothObjects = exists && tv !== null && typeof tv === "object" && !Array.isArray(tv)
        && value !== null && typeof value === "object" && !Array.isArray(value);
    if (bothObjects && opts.recursive) {
        for (const [ik, iv] of Object.entries(value)) {
            _mergeKey(tv, ik, iv, { ...opts, insertKeys: opts.insertValues });
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
 * Foundry update semantics for a parent document: an array under an embedded
 * key is a DIFFERENTIAL update - entries merge into the existing element with
 * the same _id - never a wholesale replacement. Everything else merges.
 */
export function applyDocChanges(collName, raw, changes) {
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
                mergeObject(target, rest, { performDeletions: true });
            }
            // no matching _id: real Foundry rejects; the harness drops it
        }
    }
    mergeObject(raw, expanded, { performDeletions: true });
}

export function fromUuidParts(uuid) {
    // "Actor.abc", "Actor.abc.Item.def", "Scene.s.Token.t", "Compendium...." (unsupported)
    return String(uuid ?? "").split(".");
}
