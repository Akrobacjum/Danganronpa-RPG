/**
 * v14's update operators, as this harness models them (E30, 24.09.2026; audit S14-28).
 *
 * WHAT IS KNOWN, AND FROM WHERE. No Foundry source is on the machine this was
 * written on, so v14's own operators were not read; everything below is modelled
 * from three readers of them:
 *   - The module's own measured notes: `-=key` removes nothing in this Foundry
 *     (actions.mjs, music.mjs, fog.mjs, migrate.mjs twice; measured on ownership).
 *     The audit's reading of the installed v14 (S05-43, not re-read here) names a
 *     deprecation of that spelling "since v14 until v16" in common/data/fields.mjs,
 *     so whether a v14 update ignores it, or still honours it with a warning, is
 *     LIVE-E30-01. The harness takes the reading the module measured: it removes
 *     nothing, and every such key is reported (cluster.mjs, legacyKeys).
 *   - Daggerheart 2.6.5 and 2.10.5 (minimum core 14.364) delete with `_del` (33
 *     and 35 uses) and replace with `_replace(...)` (11 and 14), declare both as
 *     globals in eslint.config.mjs, and spell no key with `-=` - counted with grep
 *     on the two source trees, 24.09.2026.
 *   - utils.mjs `replaceFlag` asks for `foundry.data.operators.ForcedReplacement`
 *     and calls `create(value)`, or `new` when there is no `create`.
 * `create` vs `new`, and whether `_del` is a value or a function (2.10.5 calls
 * `_del()` once, action-base-config.mjs:584), are LIVE-E30-02: here `_del` is the
 * ForcedDeletion value and `create()` hands back one shared instance.
 *
 * THE WIRE FORM IS THE HARNESS'S OWN. A write leaves a client as JSON - shim
 * `sanitize()`, then Node IPC to the cluster and back out to every client - and a
 * class instance does not survive that. Measured on the futil.mjs this replaced,
 * with the operators given a wire form: `{"flags.d.-=gone": null}` deleted `gone`,
 * a ForcedDeletion was stored as the object `{"__harnessOperator": "ForcedDeletion"}`,
 * and a ForcedReplacement of `{a: 1}` over `{a: 0, b: 2}` left
 * `{a: 0, b: 2, __harnessOperator: ..., replacement: {a: 1}}` - replaceFlag's bookmark
 * with the old fields welded on, which is the defect replaceFlag exists to prevent.
 * So each operator writes itself as `{ [WIRE]: kind, ... }`, futil.mjs reads both
 * forms, and `revive` turns the wire form back into instances before a hook sees
 * the changes. The module never sees the wire form. What v14 hands a hook for these
 * - the instance, a plain value, or nothing at that key - is LIVE-E30-03.
 */

/** The key a serialised operator carries. The module never sees it. */
export const WIRE = "__harnessOperator";

export class DataFieldOperator {}

export class ForcedDeletion extends DataFieldOperator {
    static #one = null;
    /** One shared instance, as `_del` is one value. */
    static create() { return (ForcedDeletion.#one ??= new ForcedDeletion()); }
    toJSON() { return { [WIRE]: "ForcedDeletion" }; }
}

export class ForcedReplacement extends DataFieldOperator {
    constructor(replacement) {
        super();
        this.replacement = replacement;
    }
    static create(replacement) { return new ForcedReplacement(replacement); }
    toJSON() { return { [WIRE]: "ForcedReplacement", replacement: this.replacement }; }
}

/** A serialised operator: a plain object whose WIRE key names its kind. */
export const isWire = v => v !== null && typeof v === "object" && !Array.isArray(v) && typeof v[WIRE] === "string";

/** An operator in either form. */
export const isOperator = v => v instanceof DataFieldOperator || isWire(v);

/** "ForcedDeletion", "ForcedReplacement", or null for anything that is not an operator. */
export const kindOf = v => v instanceof ForcedDeletion ? "ForcedDeletion"
    : v instanceof ForcedReplacement ? "ForcedReplacement"
    : isWire(v) ? v[WIRE] : null;

/** What a ForcedReplacement puts in place, in either form. */
export const replacementOf = v => v instanceof ForcedReplacement ? v.replacement : v?.replacement;

/** A copy of `v` with every wire-form operator turned back into an instance. Only arrays and plain objects are walked. */
export function revive(v) {
    if (Array.isArray(v)) return v.map(revive);
    if (isWire(v)) return v[WIRE] === "ForcedDeletion" ? ForcedDeletion.create() : ForcedReplacement.create(revive(v.replacement));
    const proto = v !== null && typeof v === "object" ? Object.getPrototypeOf(v) : undefined;
    if (proto === Object.prototype || proto === null) {
        return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, revive(x)]));
    }
    return v;
}

/** A key in the old spellings: `-=key` to delete, `==key` to replace. */
export const LEGACY = /^(?:-=|==)/;

/*
 * THE TWO READINGS OF THE OLD KEYS (E76 C4, 12.11.2026; the owner's DY7). Which one v14 has is not
 * known here, and it may differ between v14 builds:
 *   - "ignored" - the module's own notes, measured on the 14.36x the module was built on: `-=key`
 *     removes nothing and `==key` replaces nothing. The harness's model since E30, and the default.
 *   - "honoured" - Foundry issue 14806, closed in 14.369 (read through its title and the release
 *     list, not the code: AUDIT 9.2 item 153): `ObjectField#clean` did not turn the old keys into
 *     operators, and flags and ownership are such fields. Read here as: from 14.369 a server's clean
 *     turns `-=key` into a ForcedDeletion of `key` and `==key` into a ForcedReplacement of it, on any
 *     path, before the write is judged, applied and sent to the other browsers (`honourLegacy`).
 * Whether 14.370 honours them, and on which fields, is LIVE-E76-03 (LIVE-E30-01 repeated). A run takes
 * its reading from `DRPG_LEGACY_KEYS` ("ignored" or "honoured"); a scenario that exports
 * `legacyReading` names its own, which wins (cluster.mjs `main`), and every results file says which
 * reading it ran (`legacyReading`). The module is held to what both readings promise: a delete
 * spelled `forcedDeletion()` or `unsetFlag` removes in each (the root rules file, R152).
 */
export const LEGACY_READINGS = ["ignored", "honoured"];

function readingFromEnv() {
    const asked = globalThis.process?.env?.DRPG_LEGACY_KEYS;
    if (asked === undefined || asked === "") return "ignored";
    if (!LEGACY_READINGS.includes(asked)) throw new Error(`DRPG_LEGACY_KEYS=${asked}: the readings are ${LEGACY_READINGS.join(" and ")}`);
    return asked;
}

let reading = readingFromEnv();

/** "ignored" or "honoured": what a `-=` or `==` key does in this run. */
export function legacyReading() { return reading; }

/** Set this process's reading; the cluster does it once, before any client is forked. */
export function setLegacyReading(next) {
    if (!LEGACY_READINGS.includes(next)) throw new Error(`no reading of the old keys named ${next}: the readings are ${LEGACY_READINGS.join(" and ")}`);
    reading = next;
    return reading;
}
