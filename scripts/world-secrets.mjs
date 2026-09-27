/**
 * Danganronpa RPG - what world data may never hold (E05 C2, 26.09.2026; the stage's
 * verify, R9's extension).
 * ---------------------------------------------------------------------------
 * Foundry sends the whole world to every browser: every world setting, and every
 * actor's, user's, token's, chat message's and item's flags - an unlinked token's own actor
 * data among them - are on every player's machine, readable from
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
 * into SECRET_FIELDS. A field held everywhere may be let stand in one setting,
 * with the reason written beside it (`except`); R190 fixtures both halves.
 *
 * IMPORTS NOTHING, so Node reads it (the harness, the tools) exactly as the
 * module does.
 */

export const WORLD_SECRET_MODULE = "danganronpa-rpg";

/**
 * The rule. `settings` is keyed by a module world setting's key, without the
 * namespace: `fields` it may never hold at any depth, `empty` (it holds nothing at
 * all), or `only` (the top-level keys it may hold). `everySetting` holds for every
 * module world setting, but for the fields `except` lets one setting hold. `flags` is
 * keyed by document type (Actor, User, Token, ChatMessage, and since E05 C13 Item - one
 * in the sidebar or on an actor's sheet): a path under the module's flag scope that may
 * never be there - an unlinked token's own actor data (its delta) is read under `Actor`,
 * since that is where a sheet opened from the token writes. Each rule says what it keeps
 * out, and since when.
 */
export const WORLD_SECRET_RULES = Object.freeze({
    settings: Object.freeze({
        projectMeta: Object.freeze({
            fields: Object.freeze(["killerId", "by", "condition", "trigger", "saboteur"]),
            since: "E05 C1", why: "an indirect murder's killer, builder, condition and trigger (S09-05, D3); who sabotaged a project, a user id (S1-m1, E05's fix round)"
        }),
        // The key before 1.2.64 (settings.mjs `legacyPendingMurders`); the declarations are a GM store.
        pendingMurders: Object.freeze({
            empty: true,
            since: "E05 C3", why: "a Direct Murder declared in the dark, filed under the killer's id (S10-01, S01-02)"
        }),
        // The key before 1.2.64 (settings.mjs `legacyEclipseMoves`); the crossings are a GM store.
        eclipseMoves: Object.freeze({
            empty: true,
            since: "E05 C4", why: "who crossed how often in an Eclipse (S10-39)"
        }),
        // The key before 1.2.64 (settings.mjs `legacyKeyRemnantPlan`); the plan is a GM store.
        keyRemnantPlan: Object.freeze({
            empty: true,
            since: "E05 C5", why: "the Key Remnant plan: each clue's name, what it says, its analysis, the GM's note and its token (S01-01, S05-02)"
        }),
        // The darkening's stamp is public (its card is); the count behind it is the GMs' record (overflow.mjs).
        overflow: Object.freeze({
            fields: Object.freeze(["count"]),
            since: "E05 C12", why: "the Despair overflow's count, which a player's caption masks (S01-60)"
        }),
        /* The world half of an incident: murder.mjs's `PUBLIC_INCIDENT`, written out (this file
           imports nothing; R191 holds the two equal). Anything else - the names since LIVE-001,
           the method since E05 C8 - is the cast's. */
        murderState: Object.freeze({
            only: Object.freeze(["active", "stage", "turn", "turnSide", "keyRemnants", "deniedToVictim", "hindered", "blocked",
                "unlocked", "spent", "drainStopped", "advantageNext", "freeResolution", "thirdActed"]),
            since: "E05 C8", why: "how an incident happened - a trap, a death by the victim's own hand, a reversal, when it opened, how it ended - and who is in it (S04-08)"
        })
    }),
    everySetting: Object.freeze({
        fields: Object.freeze(["sourceActor", "realType", "pointsAt", "dc", "tiedToCrime", "analysis", "analyzedText", "note", "tokenId"]),
        since: "R9; analysis, analyzedText, note and tokenId since E05 C5",
        why: "a trace's answer key: what it really is, who left it, what it points at, how hard it is to read, what its analysis says, the GM's note on it, and which token on the map it is",
        /* ONE SETTING MAY HOLD tokenId, AND WHY (E05 C5, 26.09.2026). projectMeta names each
           project's own map token, `tokenId` beside `tokenScene` (projects-map.mjs
           `placeProjectToken`). That token is a world document every browser holds, and it
           carries its countdown's id in its own flag (`PROJECT_TOKEN_FLAG`): the link is in
           world data on the token whatever projectMeta says, and it names the project's
           marker, not a trace. The four fields came in with the Key Remnant plan, which held
           all four. Measured first (26.09): on 5ba3389 with this rule, 72-canary's world scan
           through a chapter found them in keyRemnantPlan alone, on p1 and p2 in each of its six
           phases; with the plan a GM store, R9 passed on the suite's world, and the GM's 44
           module world settings read clean after 72, 40-flow and 50-lang, with this exception
           and without it. No scenario puts a project on the map; after 72 with its project
           placed by `placeProjectToken`, the one hit without the exception was
           projectMeta.<id>.tokenId, and the token's own flag named the same id. */
        except: Object.freeze({ projectMeta: Object.freeze(["tokenId"]) })
    }),
    flags: Object.freeze({
        // E05 C7: the Reroll bookmark - a crisis roll's keys, Stage 6's token ids, a palm's victim -
        // is the roller's own client setting `rollBookmarks` (action-rolls.mjs; S02-01).
        Actor: Object.freeze(["lastAction"]),
        // E05 C6: a player's pre-session note for the GMs - "Am I planning to kill? How?" - is a GM
        // store; the flag keeps only `{ updatedAt, written }` (pre-session-note.mjs; S11-03, S01-08).
        User: Object.freeze(["preSessionNote.text"]),
        Token: Object.freeze([]),
        // E05 C7: a card's facts - a Search's find, the actor it was about - are its recipients'
        // client store; the `summary` flag that held them on the document is gone (secret.mjs
        // `dropCardSummaries`; S10-05, S02-11). Read since E05's fix round (S1-m3): until then
        // one check in 40-flow held this, and the rule read no ChatMessage at all.
        ChatMessage: Object.freeze(["summary"]),
        // E05 C13: which trace a Truth Bullet was copied from is its row's in the GMs' store and
        // its owner's copy (`mineBulletRefs`); the bullet's `remnantRef` flag, which told every
        // console which traces had been found and by whom, is gone - a `null` one as well
        // (truth-bullets.mjs `liftBulletRefs`; S05-39 (2)). An item on a sheet or in the sidebar.
        Item: Object.freeze(["remnantRef"])
    })
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
 * keyed without the namespace - and `actors`, `users`, `tokens`, `messages`, `items`:
 * arrays of `{ id, flags }` (a token's id may be written "sceneId.tokenId", an item's
 * as its caller names one on a sheet), where `flags` is the document's whole flags
 * object; `items` holds the sidebar's and every actor's (E05 C13). A token may carry `delta` too - its own
 * actor data, `{ flags }` - which is read against the `Actor` rule and for `ids`,
 * with the hit's `doc` "Actor" and its `path` under `delta.` (E05's fix round,
 * S1-m4: a bookmark 1.2.63 wrote from an unlinked token's sheet is there).
 *
 * `ids`: actor ids no world data may name - a string that contains one, value or
 * key, anywhere under a module world setting or under an actor's, user's,
 * token's (and its delta's), message's or item's module flags. A document's own id, and the flags outside the module's
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
        const exempt = rules.everySetting?.except?.[key] ?? [];
        const everywhere = (rules.everySetting?.fields ?? []).filter(f => !exempt.includes(f));
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
    const flagsIn = (doc, id, flags, base) => {
        const scope = flags?.[WORLD_SECRET_MODULE];
        if (!isObject(scope)) return;
        for (const path of rules.flags?.[doc] ?? []) {
            if (at(scope, path) !== undefined) out.push({ kind: "flag", doc, id, path: `${base}${WORLD_SECRET_MODULE}.${path}`, rule: `a flag no ${doc} may carry` });
        }
        idsIn(doc, id, scope, `${base}${WORLD_SECRET_MODULE}`);
    };
    for (const [doc, list] of [["Actor", snapshot?.actors], ["User", snapshot?.users], ["Token", snapshot?.tokens], ["ChatMessage", snapshot?.messages],
        ["Item", snapshot?.items]]) {
        for (const entry of Array.isArray(list) ? list : []) {
            flagsIn(doc, String(entry?.id ?? ""), entry?.flags, "flags.");
            if (doc === "Token" && isObject(entry?.delta)) flagsIn("Actor", String(entry.id ?? ""), entry.delta.flags, "delta.flags.");
        }
    }
    return out;
}
