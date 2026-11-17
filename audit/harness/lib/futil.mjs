/**
 * Foundry-semantics utility subset. These MUST mimic real foundry.utils -
 * the module's state handling depends on merge/expand/diff behaviour.
 */

import { isOperator, kindOf, replacementOf, LEGACY, WIRE, legacyReading } from "./operators.mjs";

/** An object to walk into: not null, not an array, not an operator in either form (lib/operators.mjs). */
const walkable = v => v !== null && typeof v === "object" && !Array.isArray(v) && !isOperator(v);

/*
 * THE REGIONS A TOKEN STANDS IN, AS ITS SOURCE HOLDS THEM (D4; the coordinator's brief of 16.11.2026). Foundry 14.370 keeps
 * `_regions` on a token, its server's list of the regions the token is in, and hands a change of it in `updateToken`'s
 * changes (docs/dev/e39/CALIBRATION.md section 3). The shim's mover computes it on a move (lib/shim.mjs `TOKEN MOVEMENT`), and
 * the cluster writes it on every seeded token at its start, so a token moved and put back reads what it read before the
 * move (the suite's restore compares it). The same test as the shim's: the token's centre inside a rectangle or polygon of
 * the region, on its floor (a region naming no floor is on every one). What v14 writes at a token's creation, and after a
 * region is reshaped under a token, was not read; a token made later carries none until it moves.
 */
export function tokenRegionIds(scene, token, spot = token) {
    const size = scene?.grid?.size ?? 100;
    const x = Number(spot?.x ?? 0) + (Number(spot?.width ?? token?.width ?? 1) * size) / 2;
    const y = Number(spot?.y ?? 0) + (Number(spot?.height ?? token?.height ?? 1) * size) / 2;
    const level = spot?.level ?? token?.level ?? null;
    const inside = shape => {
        if (shape?.type === "rectangle") return x >= shape.x && x <= shape.x + shape.width && y >= shape.y && y <= shape.y + shape.height;
        if (shape?.type !== "polygon" || !Array.isArray(shape.points)) return false;
        let hit = false;
        for (let i = 0, j = shape.points.length - 2; i < shape.points.length; i += 2) {
            const [xi, yi, xj, yj] = [shape.points[i], shape.points[i + 1], shape.points[j], shape.points[j + 1]];
            if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) hit = !hit;
            j = i;
        }
        return hit;
    };
    return (scene?.regions ?? []).filter(region => (region.shapes ?? []).some(inside)
        && (!(region.levels ?? []).length || level === null || (region.levels ?? []).includes(level))).map(region => region._id).sort();
}

/*
 * EVERY SCENE HAS A FLOOR (D5; the coordinator's brief of 16.11.2026; docs/dev/e39/CALIBRATION.md section 3, read by E58 L1
 * on Foundry 14.370): `Scene#levels` is an embedded collection of `Level` documents, and a scene given none - every scene the
 * harness seeds - holds `defaultLevel0000`, 0 to 20. Read: its id and its bottom and top. Not read: its name and its `base`
 * (here "" and its bottom), and the level's other fields (background, foreground, fog, textures, visibility), left out.
 * Answers `scene` itself, its `levels` filled in where it held none (cluster.mjs for the world, lib/shim.mjs for a client).
 */
export const DEFAULT_LEVEL_ID = "defaultLevel0000";
export function withDefaultLevel(scene) {
    if (!scene || typeof scene !== "object" || (Array.isArray(scene.levels) && scene.levels.length)) return scene;
    scene.levels = [{ _id: DEFAULT_LEVEL_ID, name: "", elevation: { bottom: 0, top: 20, base: 0 }, sort: 0, flags: {} }];
    return scene;
}

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

/*
 * Foundry's documented rule (`foundry.utils.deepClone(original, {strict=false})`): arrays, dates and
 * plain objects are copied, and any other object - a class instance - is handed back as it is, or
 * refused under `strict`. Until E33 C2a's A2 (07.10.2026) this copied a class instance as a plain
 * object, so it lost its class; Daggerheart's roll, copied into lib/dh-dice since C2a, keeps
 * `baseTerms = deepClone(this.dice)` and names its extra dice by `includes` on it (d20Roll.mjs:99,
 * :182, 2.10.5), and with copies every die of the roll read as extra in `config.roll.extra`. The
 * operators of lib/operators.mjs are class instances too, so they come back as they are, as they do
 * at a table - walked like plain objects they had become plain objects, which is why they were
 * leaves here before. Written from Foundry's documentation; its source is not on this machine.
 */
export function deepClone(v, { strict = false } = {}) {
    if (v === null || typeof v !== "object") return v;
    if (Array.isArray(v)) return v.map(x => deepClone(x, { strict }));
    if (v instanceof Date) return new Date(v);
    if (v.constructor && v.constructor !== Object) {
        if (strict) throw new Error("deepClone cannot clone advanced objects");
        return v;
    }
    const out = {};
    for (const k of Object.keys(v)) out[k] = deepClone(v[k], { strict });
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
 *
 * In the "honoured" reading of the old keys (E76 C4; lib/operators.mjs) the first rule
 * reads instead: `-=key` deletes `key` and `==key` puts a copy of its value in place of
 * `key`, each still handed to `onLegacyKey`. The cluster turns a write's old keys into
 * operators before it judges and sends it (`honourLegacy`), so this branch is reached by a
 * client's local writes (the shim's updateSource and clone) alone.
 */
/*
 * WHAT AN UPDATE CHANGES (D3; the coordinator's brief of 16.11.2026; docs/dev/e39/CALIBRATION.md section 1, LIVE-E30-03, read
 * by E58 L1 on Foundry 14.370): a write of a value a document already holds is not sent, an update with one key unchanged and
 * one new hands its hooks the new key alone, and with `{ diff: false }` an update is sent as given. `changes` (expanded or
 * flat) against `source`: the part of it that changes something - a plain object walked key by key, an operator, an old key
 * (`-=`, `==`) and a value of another type kept, anything else kept only where it differs from what `source` holds there
 * (arrays and values compared whole). Answers a new expanded object, empty when nothing changes. lib/shim.mjs diffs on the
 * writer's client against its own copy, cluster.mjs on the server against the world's, for the hooks; which of the two v14
 * does for each is LIVE-E39-12.
 */
export function diffChanges(source, changes) {
    const out = {};
    for (const [key, value] of Object.entries(expandObject(changes ?? {}))) {
        const held = source?.[key];
        if (LEGACY.test(key) || isOperator(value)) { out[key] = value; continue; }
        if (walkable(value) && walkable(held)) {
            const inner = diffChanges(held, value);
            if (Object.keys(inner).length) out[key] = inner;
            continue;
        }
        if (JSON.stringify(value ?? null) !== JSON.stringify(held ?? null) || (value === undefined) !== (held === undefined)) out[key] = value;
    }
    return out;
}

export function applyUpdate(target, changes, { onLegacyKey = null } = {}) {
    return applyExpanded(target, expandObject(changes), onLegacyKey, "");
}

function applyExpanded(target, expanded, onLegacyKey, at) {
    for (const [k, v] of Object.entries(expanded)) {
        const where = at ? `${at}.${k}` : k;
        if (LEGACY.test(k)) {
            onLegacyKey?.(where);
            if (legacyReading() === "honoured") {
                const name = k.slice(2);
                if (k.startsWith("-=")) delete target[name];
                else target[name] = deepClone(v);
            }
            continue;
        }
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
 * A write's old keys as the "honoured" reading has a v14 server clean them (E76 C4, 12.11.2026;
 * lib/operators.mjs): a copy of `changes`, expanded, with each `-=key` turned into a ForcedDeletion
 * of `key` and each `==key` into a ForcedReplacement of `key` by its value, in the operators' wire
 * form, so the write is judged, applied and handed to every browser's hook with the operator in
 * place of the old key. Each is handed to `onLegacyKey(path)` as it is turned. An array is walked
 * entry by entry (an embedded list's patches). In the "ignored" reading the changes come back as
 * they are: the old key is then the apply's to skip and say (`applyExpanded`).
 */
export function honourLegacy(changes, onLegacyKey = null, at = "") {
    if (legacyReading() !== "honoured") return changes;
    if (Array.isArray(changes)) return changes.map((entry, i) => honourLegacy(entry, onLegacyKey, at ? `${at}.${i}` : String(i)));
    if (!walkable(changes)) return changes;
    const out = {};
    for (const [k, v] of Object.entries(expandObject(changes))) {
        const where = at ? `${at}.${k}` : k;
        if (LEGACY.test(k)) {
            onLegacyKey?.(where);
            out[k.slice(2)] = k.startsWith("-=") ? { [WIRE]: "ForcedDeletion" } : { [WIRE]: "ForcedReplacement", replacement: deepClone(v) };
            continue;
        }
        out[k] = walkable(v) || Array.isArray(v) ? honourLegacy(v, onLegacyKey, where) : v;
    }
    return out;
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
