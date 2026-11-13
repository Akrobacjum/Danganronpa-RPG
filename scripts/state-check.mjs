/**
 * Danganronpa RPG - the state's invariants, read on a GM (E40 C2, 13.11.2026; plan docs/dev/plans/E40.md, item 2, and its
 * amendments of 11.10 and 13.10 (A10, A11): "game.drpg.checkState() checks the invariants ... at the primary GM's start
 * (warning only) and after every scenario"; "checkState finds no `passage*` or `frisk*` fields on world documents").
 * ---------------------------------------------------------------------------
 * WHAT IT HOLDS, AND WHY ONLY THIS. Every invariant here is one the module already states elsewhere, read again in one
 * place; none is new:
 *   worldSecret   what no world data may hold, world-secrets.mjs `WORLD_SECRET_RULES` through `findWorldSecrets` - the
 *                 rule tier 0 R9 reads on the suite's world and 72-canary on a player's browser, here on any world a GM
 *                 opens;
 *   passageFrisk  no module flag whose key starts with `passage` or `frisk` on an actor, user, token (and its delta),
 *                 chat message, item, scene, region or wall: a secret passage and an open Frisk live in the GMs' stores
 *                 and the copies addressed to who may know them (E79, A11), never on a document every browser is sent.
 *                 The world settings are not read for it: `friskForce` is a setting by design (settings.mjs), and the
 *                 projects' passage rows are world-secrets' to judge;
 *   clock         the clock's phase is a key of config.mjs `PHASES`, and its chapter, day and session are whole numbers
 *                 of 1 or more, as settings.mjs `setClock` writes them.
 * The plan's list is longer ("the invariants (...)", cut in the audit's text this plan read); what else a world must hold
 * is not guessed here. A rule joins with the stage that states it, and with its fixture in tier 1 R5100.
 *
 * WHAT IT DOES: nothing but read. `checkState()` answers `{ ok, problems }` on a GM and says each problem on the console in
 * English (the root rules: diagnostics.mjs's console stays English); on a player's browser it reads nothing and answers
 * null, as a player's world copy is not the GMs'. It writes no document, setting, flag or store and sends no packet.
 */
import { MODULE_ID, PHASES } from "./config.mjs";
import { findWorldSecrets } from "./world-secrets.mjs";
import { warn } from "./utils.mjs";

/** The documents `passageFrisk` reads, by the snapshot's list each is kept in. */
const PLACE_DOCS = Object.freeze({ actors: "Actor", users: "User", tokens: "Token", messages: "ChatMessage", items: "Item",
    scenes: "Scene", regions: "Region", walls: "Wall" });

/** Whether a flag key of the module's scope is one a passage or a Frisk would leave (`passageFrisk`). */
export function isPassageOrFriskKey(key) {
    return typeof key === "string" && /^(passage|frisk)/i.test(key);
}

/**
 * What this browser holds of the world, as `findWorldSecrets` reads it (tier 0 R9's reading: the module's world settings,
 * and every actor's, user's, token's with its delta, message's and item's flags), with the scenes', regions' and walls'
 * flags beside them for `passageFrisk`. Pure but for what it reads off `game`.
 */
export function worldSnapshot() {
    const settings = {};
    for (const [full, def] of game.settings?.settings ?? []) {
        if (!full.startsWith(`${MODULE_ID}.`) || def.scope !== "world") continue;
        const key = full.slice(MODULE_ID.length + 1);
        try { settings[key] = game.settings.get(MODULE_ID, key); } catch { continue; }
    }
    const flagsOf = doc => ({ id: doc.id, flags: doc.flags ?? {} });
    const scenes = game.scenes?.contents ?? [];
    return {
        settings,
        actors: (game.actors?.contents ?? []).map(flagsOf),
        users: (game.users?.contents ?? []).map(flagsOf),
        tokens: scenes.flatMap(scene => (scene.tokens?.contents ?? []).map(t => {
            const delta = t.toObject?.()?.delta;
            return { id: `${scene.id}.${t.id}`, flags: t.flags ?? {}, delta: delta ? { flags: delta.flags ?? {} } : null };
        })),
        messages: (game.messages?.contents ?? []).map(m => {
            const { speaker, system, rolls, whisper, author } = m.toObject?.() ?? {};
            return { ...flagsOf(m), speaker, system, rolls, whisper, author };
        }),
        items: [...(game.items?.contents ?? []), ...(game.actors?.contents ?? []).flatMap(actor => actor.items?.contents ?? [])]
            .map(item => ({ id: item.uuid ?? item.id, flags: item.flags ?? {} })),
        scenes: scenes.map(flagsOf),
        regions: scenes.flatMap(scene => (scene.regions?.contents ?? []).map(r => ({ id: `${scene.id}.${r.id}`, flags: r.flags ?? {} }))),
        walls: scenes.flatMap(scene => (scene.walls?.contents ?? []).map(w => ({ id: `${scene.id}.${w.id}`, flags: w.flags ?? {} })))
    };
}

/**
 * The problems of `snapshot` (as `worldSnapshot` builds it) and of `clock` (the clock setting's value): pure, so tier 1
 * R5100 reads it on fixtures. Answers `[{ code, doc, id, path, text }]`, `code` one of "worldSecret", "passageFrisk",
 * "clock"; `text` the English line the console says.
 */
export function stateProblems(snapshot, clock = snapshot?.settings?.clock ?? null) {
    const out = [];
    for (const hit of findWorldSecrets(snapshot ?? {})) {
        out.push({ code: "worldSecret", doc: hit.doc, id: hit.id, path: hit.path,
            text: `${hit.doc} ${hit.id} holds ${hit.path || "a value"} that no world data may hold: ${hit.rule}` });
    }
    for (const [list, doc] of Object.entries(PLACE_DOCS)) {
        for (const entry of Array.isArray(snapshot?.[list]) ? snapshot[list] : []) {
            for (const [where, flags] of [["", entry?.flags], ["delta.", entry?.delta?.flags]]) {
                const scope = flags?.[MODULE_ID];
                if (!scope || typeof scope !== "object") continue;
                for (const key of Object.keys(scope).filter(isPassageOrFriskKey)) {
                    out.push({ code: "passageFrisk", doc, id: entry.id, path: `${where}flags.${MODULE_ID}.${key}`,
                        text: `${doc} ${entry.id} carries the flag ${key}: a passage or a Frisk is the GMs' and lives in their stores, never on a document every browser is sent` });
                }
            }
        }
    }
    if (clock && typeof clock === "object") {
        if (!Object.hasOwn(PHASES, clock.phase)) {
            out.push({ code: "clock", doc: "setting", id: "clock", path: "phase", text: `the clock's phase is ${JSON.stringify(clock.phase)}, none of ${Object.keys(PHASES).join(", ")}` });
        }
        for (const field of ["chapter", "day", "session"]) {
            const value = clock[field];
            if (!(Number.isInteger(value) && value >= 1)) {
                out.push({ code: "clock", doc: "setting", id: "clock", path: field, text: `the clock's ${field} is ${JSON.stringify(value)}, not a whole number of 1 or more` });
            }
        }
    }
    return out;
}

/**
 * `game.drpg.checkState()`: this world's invariants read now, on a GM (`gm`), each problem said on the console unless
 * `quiet`. Answers `{ ok, problems }`, or null on a player's browser. Reads only.
 */
export function checkState({ quiet = false, gm = game.user?.isGM === true } = {}) {
    if (!gm) return null;
    const problems = stateProblems(worldSnapshot());
    if (!quiet) for (const problem of problems) warn(`State check (${problem.code}): ${problem.text}.`);
    return { ok: problems.length === 0, problems };
}
