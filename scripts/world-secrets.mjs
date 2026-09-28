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
 * never be there, a `*` standing for any index of an array (since E06 C10) - an unlinked
 * token's own actor data (its delta) is read under `Actor`,
 * since that is where a sheet opened from the token writes. Each rule says what it keeps
 * out, and since when.
 *
 * `messages` (E06 C1) is a list of rules for chat messages of one kind, the kind being a
 * module flag the message carries (`when`): `fields` are paths from the message's root -
 * `speaker.actor`, `system.title`, `rolls.*.options.title`, a `*` standing for any index of
 * an array - that must be absent or empty on such a message, and `flagsOnly` the module
 * flags it may carry at all. An ordinary card's speaker is its actor by design, so actor
 * ids are read in a message's speaker, `system` and rolls only where one of these rules
 * holds and names `fields` - a rule of `flagsOnly` alone says nothing of the speaker (E06
 * C7a: every private card is of the kind `secret`, and most speak as their actor); its
 * module flags are read for them always. Each commit that takes a kind of card's names
 * off its documents brings the kind's rule: a roll the module threw since E06 C5b, a
 * private card's facts of itself since E06 C7a.
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
           the method since E05 C8, the fight since E32 C2 - is the cast's. */
        murderState: Object.freeze({
            only: Object.freeze(["active", "stage"]),
            since: "E05 C8; the stage alone since E32 C2",
            why: "how an incident happened - a trap, a death by the victim's own hand, a reversal, when it opened, how it ended - who is in it (S04-08), and how its fight goes, turn by turn"
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
        // E05 C14: what was taken off a body, and which trace on the map is its, is a row of the
        // GMs' `lootTraces` store (handover.mjs `liftLootTraces`; S05-39 (3)).
        // E06 C10: an armed Call names nobody who bought it - a Monocub's Confusion named the Monocub
        // on its target (call-effects.mjs `unsigned`; S09-10). A `*` is any index of the armed list.
        Actor: Object.freeze(["lastAction", "lootTrace", "pendingCall.*.from"]),
        // E05 C6: a player's pre-session note for the GMs - "Am I planning to kill? How?" - is a GM
        // store; the flag keeps only `{ updatedAt, written }` (pre-session-note.mjs; S11-03, S01-08).
        User: Object.freeze(["preSessionNote.text"]),
        /* E05 C14: a trace's answer key - remnants.mjs `ANSWER_KEY_FLAGS`, written out, as this file
           imports nothing (R190 holds the two equal) - is its row's in the GMs' store; a token keeps
           `isRemnant` and, while its incident runs, `fromIncident`. What an older world still carried
           there, a trace's from before the ledger and a Faint Prep promotion written until E04,
           comes off at the first load of 1.2.64 (`migrateRemnantsOnce`; S05-06, S06-02). */
        Token: Object.freeze(["remnantType", "visibility", "reinforced", "faint", "tiedToCrime", "note", "action", "subject",
            "sourceActor", "sourceName", "room", "chapter", "day", "timeOfDay", "pointsAt"]),
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
    }),
    messages: Object.freeze([
        /* E06 C5b: a roll the module threw (`supersedingRoll` stamps the flag) is emptied as it
           is created (private-rolls.mjs `neutralRollSource`) - its speaker, Daggerheart's title
           and actor, and each roll's title and actor. Its fix r1-G1 (28.09.2026; review M1 = F1):
           and everything a roll's options held of the character - its data, whole, where C5b
           took only the id and the name; its effects, the experiences picked and the modifiers'
           labels that name them; its statistic (`neutralRollOf`). Its fix r2-G2 (28.09.2026; review
           round 2's mn1 = m1): the Loaded Die's mark, the nonce its Call keeps on the character. */
        Object.freeze({
            when: "supersededRoll",
            fields: Object.freeze(["speaker.actor", "speaker.token", "system.title", "system.source.actor",
                "rolls.*.options.title", "rolls.*.options.headerTitle", "rolls.*.options.source.actor",
                "rolls.*.options.data", "rolls.*.options.effects", "rolls.*.options.bonusEffects",
                "rolls.*.options.experiences", "rolls.*.options.roll.trait",
                "rolls.*.options.roll.modifiers.*.label", "rolls.*.options.roll.baseModifiers.*.label",
                "rolls.*.options.drpgLoadedDie"]),
            since: "E06 C5b", why: "a roll the module threw names its character and its action to every browser (S02-02, S04-02)"
        }),
        /* E06 C7a: a private card's document keeps what places it (secret.mjs `splitFlags`); what
           it says of itself - its title, tone, sound, used item, that it asks for a ruling - goes
           with its words. `settled` is allowed for the cards settled before 1.2.65, on which the
           rewrite at 1.2.65's first load (E06 C12) keeps it; until that rewrite has run, or the
           chat log is cleared, a world's older private cards break this rule. */
        Object.freeze({
            when: "secret",
            flagsOnly: Object.freeze(["secret", "veiled", "drpgMessage", "thread", "kind", "gmAsk", "settled"]),
            since: "E06 C7a", why: "a private card's document says what it is about - its action, its roll's way, its sound, its item, a ruling asked (L16, S02-02)"
        }),
        /* E06 C8: a veiled card's document is addressed to the whole table, and a veiled thread
           card's placement - whose thread, its kind, that it asks the GM - goes with its words
           (messenger.mjs `postToThread` with `veiled`). Read with the rule above: on a veiled card
           this one is the narrower. */
        Object.freeze({
            when: "veiled",
            flagsOnly: Object.freeze(["secret", "veiled", "drpgMessage"]),
            since: "E06 C8", why: "a veiled card's document says whose thread it is in (L18, S05-15)"
        })
    ])
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

/* Every value at a dotted path whose "*" stands for any index of an array, with the path it
   was found at: [[path, value]]. A segment that is not there answers nothing. */
function valuesAt(value, path) {
    let found = [["", value]];
    for (const part of String(path).split(".")) {
        found = found.flatMap(([p, node]) => {
            const join = key => (p ? `${p}.${key}` : String(key));
            if (part === "*") return Array.isArray(node) ? node.map((v, i) => [join(i), v]) : [];
            return isObject(node) && Object.hasOwn(node, part) ? [[join(part), node[part]]] : [];
        });
    }
    return found;
}

/* Nothing held: undefined, null, "", an empty array or an empty object. */
const isEmpty = v => v === undefined || v === null || v === "" || (isObject(v) && !Object.keys(v).length);

/* A roll as a message's source holds it - Foundry keeps each one as its JSON text. */
function parsedRoll(roll) {
    if (typeof roll !== "string") return roll;
    try { return JSON.parse(roll); } catch { return roll; }
}

/**
 * Every place `snapshot` breaks the rule, and every place it holds one of `ids`.
 * Pure.
 *
 * `snapshot`: `{ settings: { [key]: value } }` - the module's world settings,
 * keyed without the namespace - and `actors`, `users`, `tokens`, `messages`, `items`:
 * arrays of `{ id, flags }` (a token's id may be written "sceneId.tokenId", an item's
 * as its caller names one on a sheet), where `flags` is the document's whole flags
 * object; `items` holds the sidebar's and every actor's (E05 C13). A message carries its
 * `speaker`, `system`, `rolls`, `whisper` and `author` beside them, for the `messages`
 * rules (E06 C1). A token may carry `delta` too - its own
 * actor data, `{ flags }` - which is read against the `Actor` rule and for `ids`,
 * with the hit's `doc` "Actor" and its `path` under `delta.` (E05's fix round,
 * S1-m4: a bookmark 1.2.63 wrote from an unlinked token's sheet is there).
 *
 * `ids`: actor ids no world data may name - a string that contains one, value or
 * key, anywhere under a module world setting or under an actor's, user's,
 * token's (and its delta's), message's or item's module flags - and in a message's
 * speaker, `system` and rolls where a `messages` rule with `fields` holds. A document's own id, and the flags outside the module's
 * scope, are not read.
 *
 * Answers `[{ kind: "field" | "empty" | "only" | "flag" | "messageField" | "messageFlag" | "id", doc, id, path, key?, rule }]`
 * (`messageField`: a path a `messages` rule wants empty, holding something; `messageFlag`: a
 * module flag outside the rule's `flagsOnly`):
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
            for (const [p, v] of valuesAt(scope, path)) {
                if (v !== undefined) out.push({ kind: "flag", doc, id, path: `${base}${WORLD_SECRET_MODULE}.${p}`, rule: `a flag no ${doc} may carry` });
            }
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
    for (const message of Array.isArray(snapshot?.messages) ? snapshot.messages : []) {
        const scope = message?.flags?.[WORLD_SECRET_MODULE];
        const held = (rules.messages ?? []).filter(rule => isObject(scope) && scope[rule.when]);
        if (!held.length) continue;
        const id = String(message?.id ?? "");
        const source = { speaker: message?.speaker, system: message?.system, whisper: message?.whisper, author: message?.author,
            rolls: Array.isArray(message?.rolls) ? message.rolls.map(parsedRoll) : message?.rolls };
        for (const rule of held) {
            const why = `${rule.why} (${rule.since})`;
            for (const path of rule.fields ?? []) {
                for (const [p, v] of valuesAt(source, path)) {
                    if (!isEmpty(v)) out.push({ kind: "messageField", doc: "ChatMessage", id, path: p, rule: why });
                }
            }
            if (Array.isArray(rule.flagsOnly)) {
                for (const key of Object.keys(scope)) {
                    if (!rule.flagsOnly.includes(key)) out.push({ kind: "messageFlag", doc: "ChatMessage", id, path: `flags.${WORLD_SECRET_MODULE}.${key}`, rule: why });
                }
            }
        }
        if (!held.some(rule => rule.fields?.length)) continue;
        for (const part of ["speaker", "system", "rolls"]) {
            if (isObject(source[part])) idsIn("ChatMessage", id, source[part], part);
        }
    }
    return out;
}
