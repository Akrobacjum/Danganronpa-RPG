/**
 * Danganronpa RPG - the GM stores: which there are, and what is done with all of them.
 * ---------------------------------------------------------------------------
 * The engine (gm-store.mjs) knows how to hold, merge and send a store; this file
 * says which stores exist and wires the engine to the rest of the module. Each
 * store is one `defineGmStore` row below - its key, its old key, how its old rows
 * are claimed for this world, which reset group wipes it, whether it is synced
 * and backed up - and every domain module takes its handle from here.
 *
 * WHY A SECOND FILE (E04, 1.2.63). The engine imports config.mjs only, so that
 * settings.mjs can read its leaves through it without a cycle (R161). This file
 * imports settings.mjs and utils.mjs and hands the engine what it needs from them
 * at ready; it reaches a domain module only by dynamic `import()`, so any domain
 * module can import its handle from here statically.
 *
 * HOW A LATER STAGE ADDS A STORE (E05, E13, E28): one `defineGmStore` row here,
 * one registration in settings.mjs, and - when it lifts world data - one clause
 * in migrate.mjs that reads back before it removes anything. The claim, the
 * cuts, the sync, and (from C3 of E04) backup, restore and the health check take
 * it from the registry.
 */

import { MODULE_ID, FLAGS, TIMING, LEVEL_UP, moduleVersion } from "./config.mjs";
import { SETTINGS, getClock, getSetting, setSetting, incidentCast } from "./settings.mjs";
import { activeGmIds, primaryGmId, isPrimaryGm, warn, error, debug, plural, esc, dialogContent, whisperToGms } from "./utils.mjs";
import {
    configureGmStore, openGmStoreEngine, defineGmStore, defineGmCopy, gmStoreByName, gmStoreHandles, gmStoresHydrated,
    gmStoreHydration, gmStoreSkew, onGmStoresHydrated, flatToSection, previewSection, mergeSections, writeFields, dropKey, newerStamps, RECORD
} from "./gm-store.mjs";

const isPlain = o => o !== null && typeof o === "object" && !Array.isArray(o);

/* ---------------------------------------------------------------------------
 * The table. Each store moved in a commit of its own (the design's C2-C9), the
 * Truth Bullets first.
 * ------------------------------------------------------------------------- */

/**
 * Whether a document uuid names something in THIS world: the old key held every
 * world's rows in one object, and a uuid is the only thing a row carries that says
 * which world it came from. `Actor.<id>.Item.<id>` by its actor, `Item.<id>` by the
 * world's items, `Scene.<id>...` by the scene. A row whose actor was deleted in this
 * world reads as another world's and is left in the old key, where it was.
 */
export function uuidInThisWorld(uuid) {
    const [kind, id] = String(uuid ?? "").split(".");
    if (kind === "Actor") return Boolean(game.actors?.has(id));
    if (kind === "Item") return Boolean(game.items?.has(id));
    if (kind === "Scene") return Boolean(game.scenes?.has(id));
    return false;
}

/**
 * THE TRUTH BULLET ANSWER KEY (E04 C2; audit S05-01). Keyed by item uuid, one row
 * per bullet: realType, remnantId, sceneId, sourceAction, tiedToCrime, faint,
 * gmNote, analyzedText, analysedFrom, analysedChapter. The old rows are claimed
 * per world by uuid, live and tombstoned, at their own `updated` (or weak, with
 * none); a row of another world stays in the old key.
 */
export const bulletStore = defineGmStore({
    name: "bullets", key: SETTINGS.truthBulletSecrets, legacyKey: SETTINGS.legacyTruthBulletSecrets,
    kind: "ledger", resetGroup: "bullets", backup: true, sync: true,
    claim: legacy => {
        const rows = [], left = [];
        for (const [uuid, entry] of Object.entries(isPlain(legacy) ? legacy : {})) {
            if (!isPlain(entry)) { left.push({ key: uuid, reason: "notARow" }); continue; }
            if (!uuidInThisWorld(uuid)) { left.push({ key: uuid, reason: "otherWorld" }); continue; }
            const { updated, deleted, ...fields } = entry;
            rows.push(deleted ? { key: uuid, deleted: true, stamp: updated } : { key: uuid, fields, stamp: updated });
        }
        return { rows, left };
    },
    exists: uuid => {
        try { return Boolean(fromUuidSync(uuid)); } catch { return false; }
    }
});

/**
 * THE TRACES' ANSWER KEYS (E04 C4; audit S05-10, S05-64, the E30 review's m3).
 * Keyed `sceneId.tokenId`; `public` - what a player may be shown - is split, a
 * stamp per sub-key, so a GM renaming a trace and another rewriting its reading
 * both keep theirs. The old rows are claimed per world by their scene, live and
 * tombstoned; a row whose scene this world does not have stays in the old key
 * (another world's, or a scene deleted since).
 */
export const remnantStore = defineGmStore({
    name: "remnants", key: SETTINGS.remnantSecrets, legacyKey: SETTINGS.legacyRemnantSecrets,
    kind: "ledger", split: ["public"], resetGroup: "remnants", backup: true, sync: true,
    claim: legacy => {
        const rows = [], left = [];
        for (const [key, entry] of Object.entries(isPlain(legacy) ? legacy : {})) {
            if (!isPlain(entry)) { left.push({ key, reason: "notARow" }); continue; }
            if (!game.scenes?.has(String(key).split(".")[0])) { left.push({ key, reason: "otherWorld" }); continue; }
            const { updated, deleted, ...fields } = entry;
            rows.push(deleted ? { key, deleted: true, stamp: updated } : { key, fields, stamp: updated });
        }
        return { rows, left };
    },
    exists: key => {
        const [sceneId, tokenId] = String(key).split(".");
        return Boolean(game.scenes?.get(sceneId)?.tokens?.get(tokenId));
    }
});

/**
 * WHO THE MASTERMIND IS (E04 C5; audit S06-19). One record of this world,
 * `actorId` and the lair's `room`, each stamped on its own: a GM moving the lair
 * and another picking the Mastermind both keep theirs, and a clear is a stamped
 * null that reaches a GM who was offline (the old store answered a request only
 * while it held a pick, so a clear never did). The old entry is claimed when its
 * actor is this world's. A cleared one is never applied: nothing says which world
 * it cleared, so it is carried as a note, `legacyClearedAt` - the old entry's time,
 * at that stamp, read by nothing as a pick - and when it is newer than the pick the
 * store holds, the primary GM is asked (the design's H4; `mastermindUndecided`). A
 * clear made in another world must not end this one's season without a GM deciding
 * it.
 *
 * The note travels with the record (the review's M1, 26.09.2026). Until then it was
 * kept aside on the browser that held the old key and never sent, and the primary
 * looked once, at its own load: a clear on another GM's browser, or a pick that
 * arrived by merge later, was put to nobody, and the primary answered the cleared
 * Mastermind's player "yes". Measured on 61 E7-E8 (the C5 tree plus B1, 26.09): in
 * either order no window opened on the primary and the pick's player was told "yes";
 * in E8 its copy took back the part a clear had taken away.
 */
export const mastermindStore = defineGmStore({
    name: "mastermind", key: SETTINGS.mastermind, legacyKey: SETTINGS.legacyMastermind,
    kind: "record", fields: ["actorId", "room", "legacyClearedAt"], resetGroup: "mastermind", backup: true, sync: true,
    legacyCount: legacy => (isPlain(legacy) && Object.keys(legacy).length ? 1 : 0),
    claim: legacy => {
        if (!isPlain(legacy) || !Object.keys(legacy).length) return { rows: [], left: [] };
        const { actorId = null, room = null, updated } = legacy;
        if (!actorId) {
            // A clear with no time says nothing a pick could be weighed against: left where it is.
            if (!Number.isFinite(updated) || updated <= 0) return { rows: [], left: [{ key: RECORD, reason: "cleared" }] };
            return { rows: [{ key: RECORD, fields: { legacyClearedAt: updated }, stamp: updated }], left: [] };
        }
        if (!game.actors?.has(actorId)) return { rows: [], left: [{ key: RECORD, reason: "otherWorld" }] };
        return { rows: [{ key: RECORD, fields: { actorId, room: room || null }, stamp: updated }], left: [] };
    }
});

/**
 * The upgrade day's clear, still undecided (H4): the store's pick is older than a
 * clear some GM's old store held. `{ pick, clearedAt, pickedAt }`, or null. The same
 * on every GM once the record has merged. While it stands, no player is told they
 * hold the part (mastermind.mjs); a Keep stamps the pick again, a Clear clears it,
 * and either ends it.
 */
export function mastermindUndecided() {
    if (!game.user?.isGM) return null;
    const record = mastermindStore.record();
    const pick = record.actorId ?? null;
    const clearedAt = Number.isFinite(record.legacyClearedAt) ? record.legacyClearedAt : 0;
    const pickedAt = mastermindStore.stampOf(RECORD, "actorId");
    return pick && clearedAt > pickedAt ? { pick, clearedAt, pickedAt } : null;
}

/**
 * THE DOOR'S RULE, PART BY PART (the review's B1, 26.09.2026). Whether this player
 * holds the part is the pick's to say (the stamp of the record's `actorId`); the lair
 * is the room's (the stamp of `room`), taken only with a "yes" whose pick is at least
 * as new as the one held. A "no" carries no room stamp - a player who is not the
 * Mastermind learns nothing of when the lair moved - and clears the room. So an answer
 * from a GM that has not merged a newer pick is older in the part that decides it,
 * however fresh the room it wrote since; and once the GMs agree, the primary's answer
 * is newer in the room and is taken. Pure (R176).
 */
export function doorCombine(held, offered) {
    const hs = held?.stamps ?? {}, os = offered?.stamps ?? {};
    const out = { value: { mastermind: Boolean(held?.value?.mastermind), room: held?.value?.room ?? null },
        stamps: { actorId: hs.actorId ?? 0, room: hs.room ?? 0 } };
    let changed = false;
    if ((os.actorId ?? 0) > out.stamps.actorId) {
        out.value.mastermind = Boolean(offered.value?.mastermind);
        out.stamps.actorId = os.actorId;
        if (!out.value.mastermind) {
            out.value.room = null;
            out.stamps.room = 0;
        }
        changed = true;
    }
    if (out.value.mastermind && offered.value?.mastermind && (os.actorId ?? 0) >= out.stamps.actorId
        && (os.room ?? 0) > out.stamps.room) {
        out.value.room = offered.value.room ?? null;
        out.stamps.room = os.room;
        changed = true;
    }
    return changed ? out : null;
}

/**
 * THE MASTERMIND'S PLAYER'S DOOR (E04 C5; audit S06-19): `{ mastermind, room }` on
 * a player's browser - true, with the lair, on the one client that holds the part,
 * false on every other. A GM sends it with the stamps of the record's fields it came
 * from, and `doorCombine` takes of it only what is newer: an answer from a GM whose
 * browser holds no pick (stamp 0) replaces nothing, which is how the part used to be
 * taken away. The two old keys are named so that nothing reads them (R171); the copy
 * starts from a GM's answer, which a player asks for when it loads and when a GM
 * connects.
 */
export const doorCopy = defineGmCopy({
    name: "door", key: SETTINGS.mineDoor, legacyKeys: [SETTINGS.legacyIAmMastermind, SETTINGS.legacyMyMastermindLair],
    resetGroup: "mastermind", fallback: { mastermind: false, room: null }, combine: doorCombine
});

/**
 * The fields of an incident's cast (murder.mjs): who is in it, whose turn it is
 * on the killers' side, the accomplice and which side they took, the Reroll
 * receipt (`lastCrisis`, which names every participant), the betrayal offer and
 * the swing memo. The record's closed set: `resetRecord` stamps each of them.
 */
export const CAST_FIELDS = Object.freeze([
    "killerId", "killerTurnId", "victimId", "thirdId", "thirdSide", "lastCrisis", "betrayal", "swung"
]);

/**
 * WHO IS IN THE INCIDENT (E04 C6; audit S04-24, the cast half of S06-19). One
 * record of this world, each field stamped on its own, `swung` a stamp per actor:
 * a swing and a turn change written on two GMs both stay. The old cast is claimed
 * only when it can be this world's running incident (the design's H4): while this
 * world's `murderState` is active and it names an actor here, and a betrayal offer
 * alone only for the clock's own chapter and day. A closed cast (`{ updated }` and
 * no names) is not claimed and stays in the old key, counted as left (the Mastermind
 * carries its old clear because a decision reads it; nothing would read this one),
 * and a stale cast cannot reach the next incident either way: opening one stamps
 * every per-incident field.
 */
export const castStore = defineGmStore({
    name: "cast", key: SETTINGS.incidentCast, legacyKey: SETTINGS.legacyIncidentCast,
    kind: "record", fields: CAST_FIELDS, split: ["swung"], resetGroup: "incident", backup: true, sync: true,
    legacyCount: legacy => (isPlain(legacy) && Object.keys(legacy).length ? 1 : 0),
    claim: legacy => {
        if (!isPlain(legacy) || !Object.keys(legacy).length) return { rows: [], left: [] };
        const { updated, betrayal = null, ...rest } = legacy;
        const named = Object.fromEntries(Object.entries(rest)
            .filter(([f, v]) => CAST_FIELDS.includes(f) && v !== null && v !== undefined));
        const state = getSetting(SETTINGS.murderState) ?? {};
        const here = [named.killerId, named.victimId].some(id => id && game.actors?.has(id));
        const clock = getClock() ?? {};
        const offer = betrayal?.killerId && betrayal.chapter === clock.chapter && betrayal.day === clock.day
            && game.actors?.has(betrayal.thirdId) ? betrayal : null;
        const fields = { ...(state.active && here ? named : {}), ...(offer ? { betrayal: offer } : {}) };
        if (Object.keys(fields).length) return { rows: [{ key: RECORD, fields, stamp: updated }], left: [] };
        const closed = !Object.keys(named).length && !betrayal;
        return { rows: [], left: [{ key: RECORD, reason: closed ? "closed" : (here ? "notRunning" : "otherWorld") }] };
    }
});

/**
 * WHO KILLED, BY CHAPTER AND SEASON (E04 C6; audit S04-25). A row per killer,
 * `{ chapter, epoch, at }` (`at` orders them); murder.mjs's `blackenedIds` reads the
 * rows of the clock's chapter and season, so the register is never emptied at a
 * chapter's end and a GM's stale copy cannot bring last chapter's killers back.
 * The old ids are claimed only with world evidence of a verdict still to come in
 * this chapter - a death recorded in the clock's chapter, and no verdict applied
 * (the design's H4) - weak, in their order; otherwise they stay behind.
 */
export const blackenedStore = defineGmStore({
    name: "blackened", key: SETTINGS.blackenedLedger, legacyKey: SETTINGS.legacyBlackenedLedger,
    kind: "ledger", resetGroup: "incident", backup: true, sync: true,
    claim: legacy => {
        const ids = Array.isArray(legacy) ? legacy.filter(id => typeof id === "string" && id) : [];
        const chapter = getClock()?.chapter ?? null;
        const trial = getSetting(SETTINGS.trialProgress) ?? {};
        const died = (game.actors ?? []).some(a => a.getFlag?.(MODULE_ID, FLAGS.deceased)?.chapter === chapter);
        const pending = died && !(trial.chapter === chapter && trial.verdictApplied);
        const rows = [], left = [];
        ids.forEach((id, at) => {
            if (!game.actors?.has(id)) left.push({ key: id, reason: "otherWorld" });
            else if (!pending) left.push({ key: id, reason: "noPendingVerdict" });
            else rows.push({ key: id, fields: { chapter, epoch: 0, at } });
        });
        return { rows, left };
    }
});

/**
 * The fields that say who is in an incident (murder.mjs, `castOwners`): the seats,
 * and the betrayal offer, which keeps the accomplice's copy after the close (D18).
 */
export const CAST_SEATS = Object.freeze(["killerId", "victimId", "thirdId", "betrayal"]);

/**
 * THE CAST COPY'S RULE, PART BY PART (the review's B1, 26.09.2026). A participant is
 * sent the cast with a stamp per field it holds (every field but the swing memo), and
 * takes it only when it is at least as new in every part and newer in one - so a GM
 * that has not merged a newer write cannot hand back an older field, however fresh
 * another it wrote since. "Not in it" (`{}`) is a statement about the seats alone, so
 * it carries their stamps and is weighed on them: a bystander asking learns when the
 * seats last changed and nothing of the rest, and a former participant's copy is
 * emptied by a newer seat whatever the other parts say. Pure (R176).
 */
export function castCombine(held, offered, { cut = 0 } = {}) {
    const seats = stamps => Object.fromEntries(CAST_SEATS.map(part => [part, stamps?.[part] ?? 0]));
    if (!Object.keys(offered?.value ?? {}).length) {
        const stamps = seats(offered?.stamps);
        return newerStamps(stamps, seats(held?.stamps), cut) ? { value: {}, stamps } : null;
    }
    return newerStamps(offered?.stamps, held?.stamps, cut) ? offered : null;
}

/**
 * A PARTICIPANT'S CAST (E04 C6): what one player's browser holds of the running
 * incident - the cast when they are in it, nothing when they are not - taken only
 * where newer (`castCombine`), so a GM whose browser holds no cast cannot empty it.
 */
export const castCopy = defineGmCopy({
    name: "cast", key: SETTINGS.mineCast, legacyKey: SETTINGS.legacyIncidentCast, resetGroup: "incident", fallback: {},
    combine: castCombine
});

/**
 * The projects this world has: its project metadata's ids and every project
 * projects.mjs lists (`allProjects`, the countdowns). A trap row or a plant of a
 * project in neither is a dead project's, and is not claimed.
 */
async function livingProjects() {
    const ids = new Set(Object.keys(getSetting(SETTINGS.projectMeta) ?? {}));
    const { allProjects } = await import("./projects.mjs");
    for (const project of allProjects()) ids.add(project.id);
    return ids;
}

/**
 * WHICH ITEM IS WHICH TRAP'S (E04 C7; audit S08-19). A row per planted object's
 * `drpgItemId`: `{ projectId }`. Synced, so a trap planted on one GM's browser is
 * known on the primary's, which reads the "used an item" cards (traps.mjs). The
 * old rows are claimed while their project exists, weak.
 */
export const trapLedgerStore = defineGmStore({
    name: "trapLedger", key: SETTINGS.trapLedger, legacyKey: SETTINGS.legacyTrapLedger,
    kind: "ledger", resetGroup: "projects", backup: true, sync: true,
    claim: async legacy => {
        const alive = await livingProjects();
        const rows = [], left = [];
        for (const [itemId, projectId] of Object.entries(isPlain(legacy) ? legacy : {})) {
            if (typeof projectId !== "string" || !projectId) left.push({ key: itemId, reason: "notARow" });
            else if (!alive.has(projectId)) left.push({ key: itemId, reason: "deadProject" });
            else rows.push({ key: itemId, fields: { projectId } });
        }
        return { rows, left };
    }
});

/**
 * WHAT IS WAITING IN WHICH ROOM (E04 C7; audit S08-19). A row per `sceneId::room`:
 * the planted object. Synced, so the primary GM - who hands a player's Search its
 * find - finds a plant another GM left; taking one is a tombstone every GM gets.
 * The old rows are claimed when their scene is this world's (`-::room`, a plant
 * made with no scene on screen, by its project alone) and their project exists.
 */
export const trapPlantStore = defineGmStore({
    name: "trapPlants", key: SETTINGS.trapPlants, legacyKey: SETTINGS.legacyTrapPlants,
    kind: "ledger", resetGroup: "projects", backup: true, sync: true,
    claim: async legacy => {
        const alive = await livingProjects();
        const rows = [], left = [];
        for (const [key, entry] of Object.entries(isPlain(legacy) ? legacy : {})) {
            const sceneId = String(key).split("::")[0];
            if (!isPlain(entry)) left.push({ key, reason: "notARow" });
            else if (sceneId !== "-" && !game.scenes?.has(sceneId)) left.push({ key, reason: "otherWorld" });
            else if (!alive.has(entry.projectId)) left.push({ key, reason: "deadProject" });
            else rows.push({ key, fields: entry });
        }
        return { rows, left };
    }
});

/**
 * THE OBSERVE DECLARATIONS WAITING FOR THEIR ROLL (E04 C7). Local: this browser's,
 * a section per world, neither synced nor backed up - the declaration and its
 * answer go through one GM, whoever `primaryGmId()` names, and last an hour at
 * most (observe.mjs). The old ones are claimed when their scene or actor is this
 * world's and they are inside that hour - weak, like every old row with no stamp
 * of the store's own: the hour is read off the entry's `at`, and a later write here
 * wins.
 */
export const observeStore = defineGmStore({
    name: "observe", key: SETTINGS.observePending, legacyKey: SETTINGS.legacyObservePending,
    kind: "ledger", resetGroup: "remnants", backup: false, sync: false,
    claim: legacy => {
        const cutoff = Date.now() - TIMING.pendingObserveTtlMs;
        const rows = [], left = [];
        for (const [key, entry] of Object.entries(isPlain(legacy) ? legacy : {})) {
            if (!isPlain(entry)) left.push({ key, reason: "notARow" });
            else if (!(entry.at >= cutoff)) left.push({ key, reason: "expired" });
            else if (!game.scenes?.has(entry.sceneId) && !game.actors?.has(entry.actorId)) left.push({ key, reason: "otherWorld" });
            else rows.push({ key, fields: entry });
        }
        return { rows, left };
    }
});

/**
 * THE LEVEL UPS ON OFFER (E04 C8; audit S03-11). A row per character, `{ kind, at }`,
 * synced between the GMs; the primary writes it (level-up.mjs `recordOffer`) - an offer
 * or a withdrawal, which is a stamped drop now, where the old store deleted the key and
 * a GM holding it wrote it back. The old offers are claimed on the primary's browser
 * only (the design's row 17): the old key had no tombstones, so a union of every GM's
 * browser would bring back offers taken away; at their `at`, for a character here and a
 * kind that exists. An entry with no `at` is an owner's cached copy, never the store.
 */
export const offerStore = defineGmStore({
    name: "offers", key: SETTINGS.advanceOffers, legacyKey: SETTINGS.legacyAdvanceOffers,
    kind: "ledger", resetGroup: "advancement", backup: true, sync: true,
    claim: legacy => {
        const entries = Object.entries(isPlain(legacy) ? legacy : {});
        if (!isPrimaryGm()) return { rows: [], left: entries.map(([key]) => ({ key, reason: "notPrimary" })) };
        const rows = [], left = [];
        for (const [actorId, offer] of entries) {
            if (!isPlain(offer) || !LEVEL_UP[offer.kind]?.picks) left.push({ key: actorId, reason: "notAnOffer" });
            else if (!Number.isFinite(offer.at) || offer.at <= 0) left.push({ key: actorId, reason: "ownerCache" });
            else if (!game.actors?.has(actorId)) left.push({ key: actorId, reason: "otherWorld" });
            else rows.push({ key: actorId, fields: { kind: offer.kind, at: offer.at }, stamp: offer.at });
        }
        return { rows, left };
    }
});

/**
 * AN OWNER'S OFFERS (E04 C8): the Level Ups standing on this user's own characters,
 * `{ actorId: { kind } }`, as the primary GM sent them - a stamp per character (the row's,
 * a withdrawal's tombstone included), and taken whole only when it is at least as new
 * for every character and newer for one (gm-store.mjs `newerStamps`). An answer from a
 * primary whose browser holds no offer carries stamp 0 and changes nothing: the lit
 * button stays lit, where the old copy was replaced by whatever set arrived.
 */
export const offerCopy = defineGmCopy({
    name: "offers", key: SETTINGS.mineOffers, legacyKey: SETTINGS.legacyAdvanceOffers, resetGroup: "advancement", fallback: {}
});

/** Whether a store's old key changed since this browser claimed it (a 1.2.x session wrote it since: the design's H1). */
export function gmStoreLegacyChanged(name) {
    return gmStoreByName(name)?.legacyChanged() ?? false;
}

/** Take what changed in a store's old key since the upgrade, by the rules on the handle's `reclaim`. */
export async function gmStoreReclaim(name) {
    const store = gmStoreByName(name);
    if (!game.user?.isGM || !store) return null;
    await store.whenHydrated();
    return store.reclaim();
}

let opening = null;

/**
 * Wire the engine to this module and open this world's stores on this client:
 * the claim of the old keys, the clock's reset cuts, the GM-to-GM listener and
 * the hello. Once, at ready, before the migration's clauses (module.mjs), which
 * wait for the stores they read. Never throws: a store that cannot open says so
 * in the log, and the rest of the module carries on.
 */
export function openGmStores() {
    opening ??= (async () => {
        configureGmStore({
            activeGmIds, primaryGmId, getClock, clockKey: SETTINGS.clock, warn, error, debug,
            // A counted sentence is a plural family (.one/.other, and .few/.many in Polish).
            text: (key, data = {}) => (game.i18n.has(`${key}.other`) ? plural(key, data) : game.i18n.format(key, data))
        });
        try {
            await openGmStoreEngine();
        } catch (err) {
            error("The GM stores could not open", err);
        }
    })();
    return opening;
}

/* ---------------------------------------------------------------------------
 * THE CASE: Back up the case, Restore, and the health check (E04 C3; audit
 * S05-09, S04-24). Every store in the table with `backup: true` goes into one
 * file, one merge brings a file back, and one report says what this browser is
 * missing. All three read the table, so a store a later stage adds is backed up,
 * restored and checked with no line here.
 * ------------------------------------------------------------------------- */

export const CASE_FORMAT = "drpg-case";
export const CASE_VERSION = 1;
const { DialogV2 } = foundry.applications.api;

/** `{ since, lastBackupAt, lastBackupBy }`: when this world's case was first recorded, and its last backup. */
export function caseMark() {
    try { return getSetting(SETTINGS.caseMark) ?? {}; } catch { return {}; }
}

async function markCase(patch) {
    if (!game.user?.isGM) return;
    try { await setSetting(SETTINGS.caseMark, { ...caseMark(), ...patch }); }
    catch (err) { warn("Could not record the case's backup mark", err); }
}

/**
 * Once the stores hold rows, the world says so: `caseMark.since`, written by the
 * primary after the claim. A browser that later opens this world holding nothing
 * then knows it is not a new case but one it never saw (the health check's
 * "never held" row). A timestamp and nothing about the case itself: "a pick
 * exists" or "an offer is pending" in world data would be a tell (the design's 1).
 */
async function markCaseSince() {
    if (!isPrimaryGm() || caseMark().since) return;
    if (gmStoreHandles().some(h => h.spec.backup && Object.keys(h.entries()).length)) await markCase({ since: Date.now() });
}

/** Every store with `backup: true`, and nothing else, as `{ name: section }` (R173). */
export function caseSections(handles) {
    return Object.fromEntries(handles.filter(h => h.spec.backup).map(h => [h.name, h.section()]));
}

/**
 * The file a backup writes, built from sections. Pure over what it is handed (R173).
 */
export function caseFileOf({ sections, world, exportedAt, exportedBy, resetCuts = {} }) {
    return {
        format: CASE_FORMAT, version: CASE_VERSION, module: moduleVersion(),
        world, exportedAt, exportedBy, resetCuts, stores: sections
    };
}

/**
 * The rows a store's claim would take, when the claim failed at open (the design's
 * 5.1): computed in memory and merged into the file's copy, so a backup taken on a
 * browser whose claim could not write is complete anyway.
 */
async function claimRowsIntoCopy(handle, section) {
    const info = handle.claimInfo();
    if (!info?.failed || !handle.spec.claim || !handle.spec.legacyKey) return section;
    let legacy;
    try { legacy = foundry.utils.deepClone(game.settings.get(MODULE_ID, handle.spec.legacyKey)); } catch { return section; }
    const { rows = [] } = (await handle.spec.claim(legacy, { backup: true })) ?? {};
    const mini = { e: {}, t: {}, d: {}, cleared: 0 };
    for (const row of rows) {
        const s = Number.isFinite(row.stamp) && row.stamp > 0 ? row.stamp : (section.cleared ?? 0) + 1;
        if (row.deleted) dropKey(mini, row.key, s, handle.spec);
        else writeFields(mini, row.key, row.fields ?? {}, s, handle.spec, { whole: true });
    }
    return mergeSections(section, mini, handle.spec);
}

/**
 * Back up the case: every GM store of this world, in one file this browser saves.
 *
 * `ask` (the panel's tile) says first what the file holds - the Mastermind and
 * every answer - and, before the other GMs' copies have arrived, that they have
 * not. `game.drpg.backupCase()` from the console saves at once. GM-only; the file
 * is never sent over the socket nor put in world data. Answers the file.
 */
export async function backupCase({ ask = false } = {}) {
    if (!game.user?.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Case.gmOnly"));
        return null;
    }
    if (ask) {
        const waiting = gmStoreHydration().waiting.map(id => game.users.get(id)?.name ?? id);
        const early = !gmStoresHydrated() && waiting.length;
        const yes = await DialogV2.confirm({
            window: { title: game.i18n.localize("DRPG.Case.backupTitle") },
            content: dialogContent(`<p>${esc(game.i18n.localize("DRPG.Case.backupWhat"))}</p>${early
                ? `<p class="drpg-warning">${esc(game.i18n.format("DRPG.Case.backupEarly", { names: waiting.join(", ") }))}</p>` : ""}`),
            rejectClose: false
        });
        if (!yes) return null;
    }
    const sections = caseSections(gmStoreHandles());
    for (const name of Object.keys(sections)) sections[name] = await claimRowsIntoCopy(gmStoreByName(name), sections[name]);
    const exportedAt = new Date().toISOString();
    const file = caseFileOf({
        sections, world: { id: game.world.id, title: game.world.title }, exportedAt,
        exportedBy: game.user.name, resetCuts: getClock().resetCuts ?? {}
    });
    foundry.utils.saveDataToFile(JSON.stringify(file), "application/json",
        `drpg-case-${game.world.id}-${exportedAt.replace(/[:.]/g, "-")}.json`);
    await markCase({ lastBackupAt: Date.now(), lastBackupBy: game.user.name });
    ui.notifications.info(plural("DRPG.Case.backedUp", { n: Object.values(sections).reduce((n, sec) => n + Object.keys(sec.e).length, 0) }));
    return file;
}

/**
 * A file handed to Restore, read: the case file this build writes, or the Truth
 * Bullet export of every version before it (`{ uuid: { ...fields, updated } }`),
 * taken as the bullets' section with its stamps from `updated`.
 */
export function readCaseFile(file) {
    let data = file;
    if (typeof file === "string") {
        try { data = JSON.parse(file); } catch { return { refused: "unreadable" }; }
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) return { refused: "unreadable" };
    if (data.format === CASE_FORMAT) {
        if (!(data.version <= CASE_VERSION)) return { refused: "newer", version: data.version };
        return { kind: "case", world: data.world ?? null, stores: data.stores ?? {}, exportedAt: data.exportedAt ?? null };
    }
    if ("format" in data) return { refused: "unreadable" };
    return { kind: "flat", world: null, stores: { bullets: flatToSection(data, bulletStore.spec, bulletStore.weak()) } };
}

/** What a restore of `file` would do, store by store, without writing anything. */
export function previewRestore(file) {
    const read = readCaseFile(file);
    if (read.refused) return read;
    const otherWorld = Boolean(read.world?.id && read.world.id !== game.world.id);
    const stores = {};
    for (const [name, section] of Object.entries(read.stores)) {
        const handle = gmStoreByName(name);
        if (!handle?.spec.backup) { stores[name] = { unknown: true }; continue; }
        const { beforeCutKeys, ...counts } = previewSection(handle.section(), section, handle.spec);
        stores[name] = counts;
    }
    return { kind: read.kind, world: read.world, otherWorld, exportedAt: read.exportedAt ?? null, stores };
}

/**
 * Restore the case from a file, by the same merge as the sync: it only ever adds
 * what is newer, so any GM may run it and a restore twice is a restore once.
 *
 * Refused: a file of a newer format, and a file of another world unless
 * `otherWorld` (a moved server, a duplicated world). Rows at or under the reset's
 * cut are refused unless `beforeCut` ("restore anyway"), and then fill only the
 * fields this browser lacks, freshly stamped - the explicit undo of a reset. After
 * it: the other GMs get what changed, each restored store counts as having its
 * copy, the Faint pass runs again, each store sends its players their copies
 * again, and the health check runs again (`recheck`).
 */
export async function restoreCase(file, { otherWorld = false, beforeCut = false, recheck = true } = {}) {
    if (!game.user?.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Case.gmOnly"));
        return null;
    }
    const read = readCaseFile(file);
    if (read.refused) {
        ui.notifications.error(game.i18n.format(`DRPG.Case.refused.${read.refused}`, { version: read.version ?? "?" }));
        return { refused: read.refused };
    }
    if (read.world?.id && read.world.id !== game.world.id && !otherWorld) {
        ui.notifications.error(game.i18n.format("DRPG.Case.refused.otherWorld", { title: read.world.title ?? read.world.id }));
        return { refused: "otherWorld" };
    }
    const counts = {};
    for (const [name, section] of Object.entries(read.stores)) {
        const handle = gmStoreByName(name);
        if (!handle?.spec.backup) continue;
        const preview = previewSection(handle.section(), section, handle.spec);
        const changed = await handle.mergeIn(section, { source: "restore" });
        let filled = 0;
        if (beforeCut) {
            for (const k of preview.beforeCutKeys) {
                const fields = section.e?.[k];
                if (!fields || typeof fields !== "object") continue;
                const absent = Object.fromEntries(Object.entries(fields).filter(([f]) => !Object.hasOwn(handle.get(k) ?? {}, f)));
                if (!Object.keys(absent).length) continue;
                await handle.patch(k, absent, { fillOnly: true, whole: true });
                filled++;
            }
        }
        handle.markRestored();
        counts[name] = { changed, filled, beforeCut: beforeCut ? 0 : preview.beforeCut };
        try { await handle.spec.afterRestore?.(); }
        catch (err) { error(`After restoring "${name}", the copies could not be sent again`, err); }
    }
    try {
        const { migrateFaintIntoSecrets } = await import("./truth-bullets.mjs");
        await migrateFaintIntoSecrets();
    } catch (err) { error("After a restore, the Faint pass could not run", err); }
    const lines = Object.entries(counts).map(([name, c]) => game.i18n.format("DRPG.Case.restoredStore", {
        store: game.i18n.localize(`DRPG.Case.store.${name}`), n: c.changed + c.filled, cut: c.beforeCut }));
    ui.notifications.info(`${game.i18n.localize("DRPG.Case.restored")} ${lines.join("; ")}`);
    if (recheck) void runHealthCheck();
    return { counts };
}

/* ------------------------------ the health check ------------------------------ */

/** Every Truth Bullet in the world, as items on character actors. */
function allBullets() {
    const out = [];
    for (const actor of game.actors ?? []) {
        if (actor.type !== "character") continue;
        for (const item of actor.items ?? []) if (item.getFlag(MODULE_ID, "category") === "truthBullet") out.push(item);
    }
    return out;
}

/** Bullets in the world whose answer key this browser lacks or holds with no real type (S05-01's damage included). */
export function bulletsWithoutAnswer() {
    if (!game.user?.isGM) return 0;
    return allBullets().filter(item => !bulletStore.get(item.uuid)?.realType).length;
}

/**
 * What a bullet with no real type here can take from its trace: a bullet copied
 * from a trace carries the trace's key in its `remnantRef` flag (public, the one
 * a player's own trace icon reads), and the trace's row says what it really is
 * - the type the copy was made with (observe.mjs, gm-items.mjs). `{ uuid:
 * { realType, remnantId } }`, for the bullets whose trace's row is here.
 */
function fillsFromTraces() {
    const fills = {};
    for (const item of allBullets()) {
        if (bulletStore.get(item.uuid)?.realType) continue;
        const ref = item.getFlag(MODULE_ID, "remnantRef");
        const type = ref ? remnantStore.get(ref)?.type : null;
        if (type) fills[item.uuid] = { realType: type, remnantId: String(ref).split(".")[1] || null };
    }
    return fills;
}

/**
 * FILL FROM THEIR TRACES (the design's 6.3; E04 C4). The bullets whose answer key
 * this browser lost, or whose key lost its real type (S05-01's damage), and whose
 * trace's row is here, take `realType` and `remnantId` from it - weak and fill-only,
 * so a value any GM holds for either wins, and nothing else of the key is made up:
 * a GM's note, the analysed reading and the rest come back only from a backup.
 * Answers how many bullets were filled.
 */
export async function fillBulletsFromTraces() {
    if (!game.user?.isGM) return 0;
    await Promise.all([bulletStore.whenHydrated(), remnantStore.whenHydrated()]);
    const fills = fillsFromTraces();
    const n = Object.keys(fills).length;
    if (n) await bulletStore.patchMany(fills, { weak: true, fillOnly: true });
    return n;
}

/**
 * What this browser is missing of the case, as it stands: one row per finding,
 * `{ id, level, key, data }` - `missing` (something the table needs is not here),
 * `conflict` (a GM has to decide), `info`. Reads only; any GM may ask
 * (`game.drpg.gmStoreHealth()`). What it cannot see - the Mastermind, the offers,
 * the Blackened register - it says it cannot see.
 */
export async function gmStoreHealth() {
    if (!game.user?.isGM) return null;
    const rows = [];
    const add = (id, level, key, data = {}) => rows.push({ id, level, key, data });

    const traces = [];
    for (const scene of game.scenes ?? []) for (const token of scene.tokens ?? []) if (token.getFlag(MODULE_ID, "isRemnant")) traces.push(token);
    const traceKey = token => `${token.parent?.id}.${token.id}`;
    const traceGaps = traces.filter(token => !remnantStore.has(traceKey(token)));
    if (traceGaps.length) add("traces", "missing", "DRPG.Case.row.traces", { n: traceGaps.length, of: traces.length });
    // A row whose token is gone: unreachable (every read goes through a token), counted, never removed on its own.
    const onMap = new Set(traces.map(traceKey));
    const orphans = Object.keys(remnantStore.entries()).filter(key => !onMap.has(key)).length;
    if (orphans) add("traceOrphans", "info", "DRPG.Case.row.traceOrphans", { n: orphans });

    const bullets = allBullets();
    const noRow = bullets.filter(item => !bulletStore.has(item.uuid));
    const noAnswer = bullets.filter(item => bulletStore.has(item.uuid) && !bulletStore.get(item.uuid).realType);
    if (noRow.length) add("bullets", "missing", "DRPG.Case.row.bullets", { n: noRow.length, of: bullets.length });
    if (noAnswer.length) add("bulletsNoAnswer", "missing", "DRPG.Case.row.noAnswer", { n: noAnswer.length });

    const state = getSetting(SETTINGS.murderState) ?? {};
    const cast = incidentCast();
    if (state.active && !cast.killerId && !cast.victimId) add("incident", "missing", "DRPG.Case.row.incident");

    // Armed item traps whose planted object this browser does not know: they cannot fire (C7).
    try {
        const { itemTrapsWithoutPlant } = await import("./traps.mjs");
        const lost = itemTrapsWithoutPlant();
        if (lost.length) add("traps", "missing", "DRPG.Case.row.traps", { n: lost.length });
    } catch (err) {
        warn("The case health check could not read the traps", err);
    }

    /* THE UPGRADE DAY'S CLEAR (the design's H4): a GM's old store says the Mastermind
       was cleared after the pick the store holds was made. Nothing in the old entry said
       which world it cleared, so the primary GM decides (Keep or Clear); a Keep stamps
       the pick again, and the row is gone. */
    const undecided = mastermindUndecided();
    if (undecided) {
        const { pick, clearedAt, pickedAt } = undecided;
        add("mastermindCleared", "conflict", "DRPG.Case.row.mastermindCleared", { cleared: new Date(clearedAt).toLocaleString(),
            name: game.actors.get(pick)?.name ?? pick, picked: new Date(pickedAt).toLocaleString() });
    }

    const since = caseMark().since;
    const holdsNothing = gmStoreHandles().every(h => !Object.keys(h.entries()).length && !(h.census()?.claimed));
    if (since && holdsNothing) add("neverHeld", "missing", "DRPG.Case.row.neverHeld", { date: new Date(since).toLocaleString() });

    for (const handle of gmStoreHandles()) {
        if (handle.legacyChanged()) add(`legacy.${handle.name}`, "conflict", "DRPG.Case.row.legacyChanged", { store: game.i18n.localize(`DRPG.Case.store.${handle.name}`) });
        const failed = handle.claimInfo()?.failed;
        if (failed) add(`claim.${handle.name}`, "conflict", "DRPG.Case.row.claimFailed", { store: game.i18n.localize(`DRPG.Case.store.${handle.name}`), error: failed });
    }

    add("unseen", "info", "DRPG.Case.row.unseen");
    const left = gmStoreHandles().reduce((n, h) => n + (h.census()?.left ?? 0), 0);
    if (left) add("left", "info", "DRPG.Case.row.left", { n: left });
    const skew = Object.entries(gmStoreSkew());
    if (skew.length) add("skew", "info", "DRPG.Case.row.skew", { names: skew.map(([id, m]) => `${game.users.get(id)?.name ?? id} (+${m} min)`).join(", ") });
    const status = gmStoreStatus();
    add("bytes", status.total > 3 * 1024 * 1024 ? "conflict" : "info", "DRPG.Case.row.bytes",
        { stores: Math.round(status.stores / 1024), total: Math.round(status.total / 1024) });
    const mark = caseMark();
    add("lastBackup", "info", mark.lastBackupAt ? "DRPG.Case.row.lastBackup" : "DRPG.Case.row.neverBackedUp",
        { when: mark.lastBackupAt ? new Date(mark.lastBackupAt).toLocaleString() : "", who: mark.lastBackupBy ?? "" });

    const counts = {
        traces: { of: traces.length, missing: traceGaps.length, orphans },
        bullets: { of: bullets.length, missing: noRow.length, noAnswer: noAnswer.length, fillable: Object.keys(fillsFromTraces()).length }
    };
    return { world: game.world.id, hydrated: gmStoresHydrated(), rows, counts, missing: rows.filter(r => r.level === "missing").length };
}

/** A health row as a sentence: a counted row through `plural`, the rest through `format`. */
export function healthLine(row) {
    return game.i18n.has(`${row.key}.other`) ? plural(row.key, row.data) : game.i18n.format(row.key, row.data);
}

/** The bytes this browser's GM stores hold, and everything the module keeps in its localStorage. */
export function gmStoreStatus() {
    const perStore = gmStoreHandles().map(h => h.status());
    let total = 0;
    try {
        const client = game.settings.storage.get("client");
        for (let i = 0; i < client.length; i++) {
            const key = client.key(i);
            if (key?.startsWith(`${MODULE_ID}.`)) total += key.length + (client.getItem(key)?.length ?? 0);
        }
    } catch { /* no client storage to read: nothing counted */ }
    return { stores: perStore.reduce((n, s) => n + s.bytes, 0), total, perStore };
}

let lastHealth = null;
let healthOpen = false;

/** The panel's red line: what the last check found missing, or nothing once it passes. */
export function caseWarning() {
    return lastHealth?.missing ? lastHealth : null;
}

/**
 * The primary GM's check, at ready once the other GMs' copies have arrived (or
 * none were waited for, or the wait timed out), and after every restore. When a
 * row is missing: one window with the rows, Restore from a file, and Continue -
 * the default, which leaves a notification that stays and a red line on the GM
 * panel until a check passes. Another GM sees the rows in diagnostics only.
 */
export async function runHealthCheck() {
    if (!isPrimaryGm()) return null;
    const report = await gmStoreHealth();
    lastHealth = report;
    const decide = report?.rows?.some(r => r.id === "mastermindCleared");
    if ((!report?.missing && !decide) || healthOpen) return report;
    healthOpen = true;
    try {
        const lines = report.rows.filter(r => r.level !== "info").map(r =>
            `<li class="${r.level === "missing" ? "drpg-warning" : ""}">${esc(healthLine(r))}</li>`).join("");
        const fillable = report.counts?.bullets?.fillable ?? 0;
        const choice = await DialogV2.wait({
            window: { title: game.i18n.localize("DRPG.Case.healthTitle") },
            classes: ["drpg-panel"],
            content: dialogContent(`<p>${esc(game.i18n.localize(report.missing ? "DRPG.Case.healthIntro" : "DRPG.Case.decideIntro"))}</p>
                <ul>${lines}</ul>${report.missing ? `<p class="notes">${esc(game.i18n.localize("DRPG.Case.healthNote"))}</p>` : ""}`),
            buttons: [
                ...(report.missing ? [{ action: "restore", label: game.i18n.localize("DRPG.Case.restoreFromFile") }] : []),
                ...(fillable ? [{ action: "fill", label: game.i18n.format("DRPG.Case.fillFromTraces", { n: fillable }) }] : []),
                ...(report.rows.some(r => r.id === "incident") ? [{ action: "cast", label: game.i18n.localize("DRPG.Case.enterCast") }] : []),
                // The H4 decision: Keep (the default) stamps the pick again; Clear clears it.
                ...(decide ? [{ action: "clearMastermind", label: game.i18n.localize("DRPG.Case.clearMastermind") },
                    { action: "keepMastermind", label: game.i18n.localize("DRPG.Case.keepMastermind"), default: true }]
                    : [{ action: "continue", label: game.i18n.localize("DRPG.Case.continue"), default: true }])
            ],
            rejectClose: false
        });
        if (choice === "restore") {
            healthOpen = false;
            return openRestoreDialog();
        }
        if (choice === "fill") {
            const filled = await fillBulletsFromTraces();
            ui.notifications.info(plural("DRPG.Case.filled", { n: filled }));
            healthOpen = false;
            return runHealthCheck();
        }
        if (choice === "cast") {
            await enterCastByHand();
            healthOpen = false;
            return runHealthCheck();
        }
        if (decide) {
            // Closing the window keeps the pick as well: the default, and nothing is cleared unasked.
            const m = await import("./mastermind.mjs");
            const pick = game.actors.get(mastermindStore.record().actorId ?? "");
            if (choice === "clearMastermind") await m.clearMastermind();
            else if (pick) await m.setMastermind(pick);
            lastHealth = await gmStoreHealth();
            if (!report.missing) return lastHealth;
        }
        ui.notifications.warn(game.i18n.localize("DRPG.Case.continued"), { permanent: true });
    } finally {
        healthOpen = false;
    }
    return report;
}

/**
 * ENTER THE CAST BY HAND (the design's 6.3; E04 C6): the health check's answer to
 * an incident running with no cast on this browser. The GM picks the killer, the
 * victim and a third if there was one; murder.mjs's `enterCast` writes them as a
 * decision. Nothing is written without both of the first two.
 */
export async function enterCastByHand() {
    if (!game.user?.isGM) return null;
    const students = (game.actors?.contents ?? []).filter(a => a.type === "character");
    const options = [`<option value="">-</option>`,
        ...students.map(a => `<option value="${esc(a.id)}">${esc(a.name)}</option>`)].join("");
    const seat = (name, key) => `<label>${esc(game.i18n.localize(key))} <select name="${name}">${options}</select></label>`;
    const answer = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Case.castTitle") },
        classes: ["drpg-panel", "drpg-window-enter-cast"],
        content: dialogContent(`<form><p>${esc(game.i18n.localize("DRPG.Case.castIntro"))}</p>
            ${seat("killerId", "DRPG.Case.castKiller")}${seat("victimId", "DRPG.Case.castVictim")}${seat("thirdId", "DRPG.Case.castThird")}</form>`),
        buttons: [
            { action: "enter", label: game.i18n.localize("DRPG.Case.castEnter"), default: true,
              callback: (e, b, d) => Object.fromEntries(["killerId", "victimId", "thirdId"]
                  .map(name => [name, d.element.querySelector(`[name=${name}]`)?.value || null])) },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });
    if (!answer?.killerId || !answer?.victimId) return null;
    const { enterCast } = await import("./murder.mjs");
    return enterCast(answer);
}

/** A file the GM picks, as its text; null when none was picked. */
function chooseCaseFile() {
    return new Promise(resolve => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json,application/json";
        input.addEventListener("change", async () => {
            const file = input.files?.[0];
            if (!file) return resolve(null);
            try { resolve(await foundry.utils.readTextFromFile(file)); }
            catch (err) { error("Could not read the case file", err); resolve(null); }
        }, { once: true });
        input.click();
    });
}

/**
 * The Restore tile: pick a file, see what it would do per store, and confirm -
 * with "a file of another world" and "restore anyway, under the reset's cut" as
 * boxes the GM ticks, never defaults.
 */
export async function openRestoreDialog(text = null) {
    if (!game.user?.isGM) return null;
    const file = text ?? await chooseCaseFile();
    if (!file) return null;
    const preview = previewRestore(file);
    if (preview.refused) {
        ui.notifications.error(game.i18n.format(`DRPG.Case.refused.${preview.refused}`, { version: preview.version ?? "?" }));
        return null;
    }
    const rows = Object.entries(preview.stores).filter(([, c]) => !c.unknown).map(([name, c]) =>
        `<li>${esc(game.i18n.format("DRPG.Case.previewStore", { store: game.i18n.localize(`DRPG.Case.store.${name}`),
            add: c.add, refresh: c.refresh, kept: c.keptNewerHere, cut: c.beforeCut }))}</li>`).join("");
    const answer = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Case.restoreTitle") },
        classes: ["drpg-panel"],
        content: dialogContent(`<form><ul>${rows}</ul>
            ${preview.otherWorld ? `<label class="drpg-checkbox"><input type="checkbox" name="otherWorld" />
                ${esc(game.i18n.format("DRPG.Case.otherWorld", { title: preview.world?.title ?? preview.world?.id ?? "?" }))}</label>` : ""}
            <label class="drpg-checkbox"><input type="checkbox" name="beforeCut" />
                ${esc(game.i18n.localize("DRPG.Case.beforeCut"))}</label>
            <p class="notes">${esc(game.i18n.localize("DRPG.Case.restoreNote"))}</p></form>`),
        buttons: [
            { action: "restore", label: game.i18n.localize("DRPG.Case.restore"), default: true,
              callback: (e, b, d) => ({ otherWorld: Boolean(d.element.querySelector("[name=otherWorld]")?.checked),
                  beforeCut: Boolean(d.element.querySelector("[name=beforeCut]")?.checked) }) },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });
    if (!answer || answer === "cancel") return null;
    return restoreCase(file, answer);
}

/** Registered at ready (module.mjs): the check runs once this client's stores hold the other GMs' copies. */
export function registerCaseHealth() {
    onGmStoresHydrated(() => {
        markCaseSince()
            .then(() => runHealthCheck())
            .catch(err => error("The case health check could not run", err));
    });
    /* The upgrade day's clear is put to the primary whenever the record changes after
       that (the review's M1): the note, or a pick older than it, can arrive by merge from
       a GM who joins later, and the check at load has run by then. */
    Hooks.on("clientSettingChanged", key => {
        if (key !== `${MODULE_ID}.${SETTINGS.mastermind}` || healthOpen || !gmStoresHydrated() || !isPrimaryGm()) return;
        if (!mastermindUndecided()) return;
        runHealthCheck().catch(err => error("The case health check could not run", err));
    });
}
