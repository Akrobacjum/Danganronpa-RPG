/**
 * Danganronpa RPG - what world data may never hold (E05 C2, 26.09.2026; the stage's
 * verify, R9's extension).
 * ---------------------------------------------------------------------------
 * Foundry sends the whole world to every browser: every world setting, and every
 * actor's, user's and token's flags, are on every player's machine, readable from
 * its console whatever the interface chooses to show. This file is the one
 * statement of what must never be among them - a rule per module world setting,
 * one for every module world setting, and one per document type's flags - and
 * `findWorldSecrets` reads a snapshot of a world against it, and for the actor ids
 * it is given (a killer's, in 72-canary). R9 (tier 0) applies it to the world the
 * suite runs in, R190 (tier 1) to a fixture per rule, and 72-canary to a player's
 * browser after every phase of a chapter (lib/canary.mjs `worldScan`).
 *
 * THE RULE GROWS WITH WHAT IS CLOSED. A rule comes in with the commit that takes
 * its secret out of world data, and not before: a rule for a secret still there
 * fails R9 at every table until then, and the harness names such a secret a known
 * leak until its commit. At E05 C2 the rule holds what C1 closed - projectMeta's
 * killer, builder, condition and trigger - and R9's five answer-key names, which
 * were its whole list; E05's later commits add theirs, and E43 turns the whole
 * into SECRET_FIELDS.
 *
 * IMPORTS NOTHING, so Node reads it (the harness, the tools) exactly as the
 * module does.
 */

export const WORLD_SECRET_MODULE = "danganronpa-rpg";

/**
 * The rule. `settings` is keyed by a module world setting's key, without the
 * namespace: `fields` it may never hold at any depth, `empty` (it holds nothing at
 * all), or `only` (the top-level keys it may hold). `everySetting` holds for every
 * module world setting. `flags` is keyed by document type (Actor, User, Token): a
 * path under the module's flag scope that may never be there. Each rule says what
 * it keeps out, and since when.
 */
export const WORLD_SECRET_RULES = Object.freeze({
    settings: Object.freeze({
        projectMeta: Object.freeze({
            fields: Object.freeze(["killerId", "by", "condition", "trigger"]),
            since: "E05 C1", why: "an indirect murder's killer, builder, condition and trigger (S09-05, D3)"
        })
    }),
    everySetting: Object.freeze({
        fields: Object.freeze(["sourceActor", "realType", "pointsAt", "dc", "tiedToCrime"]),
        since: "R9", why: "a trace's answer key: what it really is, who left it, what it points at, how hard it is to read"
    }),
    flags: Object.freeze({ Actor: Object.freeze([]), User: Object.freeze([]), Token: Object.freeze([]) })
});

const isObject = v => v !== null && typeof v === "object";

/* Every key and string leaf under `value`, with its dotted path; `seen` guards a cycle. */
function walk(value, path, visit, seen = new Set()) {
    if (!isObject(value) || seen.has(value)) return;
    seen.add(value);
    for (const [k, v] of Object.entries(value)) {
        const p = path ? `${path}.${k}` : k;
        visit(k, v, p);
        walk(v, p, visit, seen);
    }
}

/* The value at a dotted path, or undefined. */
function at(value, path) {
    let node = value;
    for (const part of String(path).split(".")) {
        if (!isObject(node) || !Object.hasOwn(node, part)) return undefined;
        node = node[part];
    }
    return node;
}

/**
 * Every place `snapshot` breaks the rule, and every place it holds one of `ids`.
 * Pure.
 *
 * `snapshot`: `{ settings: { [key]: value } }` - the module's world settings,
 * keyed without the namespace - and `actors`, `users`, `tokens`: arrays of
 * `{ id, flags }` (a token's id may be written "sceneId.tokenId"), where `flags`
 * is the document's whole flags object.
 *
 * `ids`: actor ids no world data may name - a string that contains one, value or
 * key, anywhere under a module world setting or under an actor's, user's or
 * token's module flags. A document's own id, and the flags outside the module's
 * scope, are not read.
 *
 * Answers `[{ kind: "field" | "empty" | "only" | "flag" | "id", doc, id, path, key?, rule }]`:
 * `doc` is "setting" or the document type, `id` the setting's key or the
 * document's id, `path` dotted from there; `key` when the id is the name of a key
 * at that path rather than a value.
 */
export function findWorldSecrets(snapshot, { ids = [], rules = WORLD_SECRET_RULES } = {}) {
    const out = [];
    const wanted = (ids ?? []).filter(id => typeof id === "string" && id);
    const idsIn = (doc, id, root, base) => {
        if (!wanted.length || !isObject(root)) return;
        walk(root, base, (k, v, p) => {
            if (wanted.some(w => k.includes(w))) out.push({ kind: "id", doc, id, path: p, key: true, rule: "an actor id no world data may name" });
            if (typeof v === "string" && wanted.some(w => v.includes(w))) out.push({ kind: "id", doc, id, path: p, rule: "an actor id no world data may name" });
        });
    };
    const settings = isObject(snapshot?.settings) ? snapshot.settings : {};
    for (const [key, value] of Object.entries(settings)) {
        const own = rules.settings?.[key] ?? null;
        const everywhere = rules.everySetting?.fields ?? [];
        const fields = new Set([...everywhere, ...(own?.fields ?? [])]);
        walk(value, "", (k, v, p) => {
            if (!fields.has(k)) return;
            const rule = (own?.fields ?? []).includes(k) ? own : rules.everySetting;
            out.push({ kind: "field", doc: "setting", id: key, path: p, rule: `${rule.why} (${rule.since})` });
        });
        if (own?.empty && isObject(value) && Object.keys(value).length) {
            out.push({ kind: "empty", doc: "setting", id: key, path: "", rule: `${own.why} (${own.since})` });
        }
        if (own?.only && isObject(value)) {
            for (const k of Object.keys(value)) {
                if (!own.only.includes(k)) out.push({ kind: "only", doc: "setting", id: key, path: k, rule: `${own.why} (${own.since})` });
            }
        }
        if (isObject(value)) idsIn("setting", key, value, "");
        else if (typeof value === "string" && wanted.some(w => value.includes(w))) out.push({ kind: "id", doc: "setting", id: key, path: "", rule: "an actor id no world data may name" });
    }
    for (const [doc, list] of [["Actor", snapshot?.actors], ["User", snapshot?.users], ["Token", snapshot?.tokens]]) {
        for (const entry of Array.isArray(list) ? list : []) {
            const scope = entry?.flags?.[WORLD_SECRET_MODULE];
            if (!isObject(scope)) continue;
            for (const path of rules.flags?.[doc] ?? []) {
                if (at(scope, path) !== undefined) out.push({ kind: "flag", doc, id: String(entry.id ?? ""), path: `flags.${WORLD_SECRET_MODULE}.${path}`, rule: `a flag no ${doc} may carry` });
            }
            idsIn(doc, String(entry.id ?? ""), scope, `flags.${WORLD_SECRET_MODULE}`);
        }
    }
    return out;
}
