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
import { SETTINGS, getClock, getSetting, setSetting, incidentCast, seasonEpoch, deathRecordFor } from "./settings.mjs";
import { activeGmIds, primaryGmId, isPrimaryGm, warn, error, debug, plural, esc, dialogContent, whisperToGms } from "./utils.mjs";
import {
    configureGmStore, openGmStoreEngine, defineGmStore, defineGmCopy, gmStoreByName, gmStoreHandles, gmStoresHydrated, whenGmStoresHydrated, gmStoresIdle,
    gmStoreHydration, gmStoreSkew, gmStoreNow, onGmStoresHydrated, flatToSection, previewSection, mergeSections, writeFields, dropKey, newerStamps, RECORD,
    raiseCleared, newestIn, sectionProblem, stableJson, weakOf, gmStoreStamp, fileSection
} from "./gm-store.mjs";
import { plainWhat } from "./relay-guard.mjs";

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
    // Its owners' copy of which trace each bullet came from is made of it since E05 C13 (R182).
    afterRestore: () => import("./truth-bullets.mjs").then(m => m.retellBulletRefs()),
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
 * AN OWNER'S BULLETS' TRACES (E05 C13; audit S05-39 (2)): `{ itemUuid: "sceneId.tokenId" }`
 * for the bullets on the characters this user owns, as a GM sent them - the trace each came
 * from, the key the bullet's public `remnantRef` flag held until 1.2.64 - a stamp per bullet,
 * taken by the offers' rule (`offersCombine`, below): an answer is the owner's whole set, at
 * least as new for every bullet it names and newer for one, and a bullet it no longer names
 * goes with it. Read by visibility.mjs and remnant-icons.mjs through truth-bullets.mjs
 * `bulletRefOf`. No old key: the flag is lifted into the rows (`liftBulletRefs`).
 */
export const bulletRefCopy = defineGmCopy({
    name: "bulletRefs", key: SETTINGS.mineBulletRefs, from: "bullets", resetGroup: "bullets", fallback: {},
    combine: offersCombine
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
    afterRestore: () => import("./mastermind.mjs").then(m => m.retellDoor()),
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
    from: "mastermind", resetGroup: "mastermind", fallback: { mastermind: false, room: null }, combine: doorCombine
});

/**
 * HOW THE INCIDENT HAPPENED (E05 C8; audit S04-08): whether it is a trap, whether the
 * killer and the victim are one person, whether a reversal left the Key Remnant plan
 * to be written again, when it opened and how it ended. Until 1.2.64 these sat in the
 * world half of `murderState`, which every browser holds: through the whole of Stage 6
 * a console read `selfInflicted: true` - the answer to the Class Trial - and a trap's
 * builder read `indirect` at the moment it went off, which `castOwners` withholds the
 * cast to keep from them. They are the cast's now, and reach only its participants.
 */
export const INCIDENT_METHOD = Object.freeze(["indirect", "selfInflicted", "keyRemnantsStale", "openedAt", "endedBy"]);

/**
 * THE FIGHT (E32 C2, 28.09.2026; E05's Q8, the owner's Q1 (a) of 28.09): the round and
 * whose side acts, what the opening took from the victim and how many Key Remnants it
 * left, the hindrances and blocks with their turns, what Self-defence opened, what is
 * spent, the drain, the second try a Hope miss earned (the action it is for, since
 * E32+E07 C9), a critical's free resolution and the third's one action. Until 1.2.66
 * these twelve sat in the world half of `murderState`, on every browser, though every
 * reader of them runs where the cast is held: the participants' panels and trackers, a
 * witness's Event card (events.mjs), the GM's Key Remnant count (investigation.mjs
 * `keyRemnants`) - read by grep on 28.09, each classified in C2's commit. A bystander's
 * browser reads `active` and `stage` alone - the locks, and `incidentWitness`, which
 * tells it the music and the red edges are not its own - and a list of which actions a
 * victim had left, turn by turn, is the shape of a fight nobody outside it saw. They
 * are the cast's now, sent to every holder in their copy (incident-store.mjs `castFor`).
 */
export const INCIDENT_FIGHT = Object.freeze([
    "turn", "turnSide", "keyRemnants", "deniedToVictim", "hindered", "blocked",
    "unlocked", "spent", "drainStopped", "advantageNext", "freeResolution", "thirdActed"
]);

/**
 * The fields of an incident's cast (murder.mjs): who is in it, whose turn it is
 * on the killers' side, the accomplice and which side they took, the Reroll
 * receipt (`lastCrisis`, which names every participant), the betrayal offer and
 * the swing memo - since E05 C8 the method (`INCIDENT_METHOD`), and since E32 C2 the
 * fight (`INCIDENT_FIGHT`). The record's closed set: `resetRecord` stamps each of
 * them, `castStamps` sends a stamp for each but the swing memo, and `castCombine`
 * weighs them all.
 *
 * `departed` (E32+E07 C10, 02.10.2026; audit S04-21): the actor ids of the thirds who left
 * - Averted eyes, a failed Escape together - and may not walk back in. A list of names,
 * so the cast's and never the world half's; it was never in the world half, so it is not
 * the fight's either (`INCIDENT_FIGHT` is also what the update lifts out of it). Every
 * player's copy holds it null since fix r2-G2 (03.10.2026; the round-2 review's S2-m1): its
 * readers are the primary GM's, and a third seated after another left read in theirs who
 * had walked in and out before they came (incident-store.mjs `castFor`).
 *
 * `openingTrait` (E32+E07 C11c, 02.10.2026; audit S04-23, the owner's Q4 as corrected): the
 * statistic a GM picked for the opening roll, kept so that a re-ask and a GM's throw for an
 * absent player - on any GM's browser - roll it again rather than ask again. The GMs' alone:
 * the roller is sent it with the invitation, and every player's copy holds it null.
 *
 * `freeCleanup` (E32+E07 C13, 03.10.2026; audit S04-07, the owner's D13): the actor id of
 * whoever struck a critical Finishing blow, until their first clean-up attempt in Stage 6
 * spends it (cleanup.mjs `consumeFreeCleanup`). Written with the stage that ends the fight,
 * so not the fight's. Every player's copy holds it null but a killer's, whose browser quotes
 * the free attempt by it since fix r2-G3 (incident-store.mjs `castFor`, cleanup.mjs `tamperQuote`).
 *
 * `recent` (E32+E07 C17, 03.10.2026; audit S04-29): the fight's last three turns for the GM's
 * tracker, `{ turn, side, key, band, success, changes }` each, written with the action's
 * receipt (murder-rules.mjs `closeReceipt`). It names who acted and what it cost them, so not the
 * fight's either: the GMs' alone, every player's copy holds it null.
 *
 * Not a field of the incident, and so not in this list: `sent` (E32+E07 fix r2-G2,
 * 03.10.2026), what each player was last sent of a standing packet - nothing, or the
 * betrayal offer alone - split a stamp per user, kept by the GMs so that every GM repeats
 * it (incident-store.mjs `sendCast`). `resetRecord` leaves it, no stamp of it is sent, and
 * incident-store.mjs reads the incident without it (`readCast`); a reset of the incident group
 * empties it with the record. Nor `openingNotices` (E32+E07 fix r2-G4, 03.10.2026; the
 * correctness review's m3): the ids of the opening's request cards and of the line that a GM
 * is picking its statistic, a stamp per card, so that whichever GM resolves the opening,
 * takes it back or closes the murder deletes the cards another GM posted (incident-store.mjs
 * `retireOpeningNotices`). The same way as `sent`: left by `resetRecord`, sent to nobody, and
 * read out of the incident by `readCast` and `castCopyFor`.
 */
export const CAST_FIELDS = Object.freeze([
    "killerId", "killerTurnId", "victimId", "thirdId", "thirdSide", "departed", "openingTrait", "freeCleanup", "recent", "lastCrisis", "betrayal", "swung", ...INCIDENT_METHOD,
    ...INCIDENT_FIGHT
]);

/**
 * WHO IS IN THE INCIDENT (E04 C6; audit S04-24, the cast half of S06-19). One
 * record of this world, each field stamped on its own, `swung` a stamp per actor:
 * a swing and a turn change written on two GMs both stay. The old cast is claimed
 * only when it can be this world's running incident (the design's H4): while this
 * world's `murderState` is active, it names an actor here, and it was written after
 * the running incident opened (`openedAt`, less the clocks' bound) - and a betrayal
 * offer alone only for the clock's own chapter and day. A closed cast (`{ updated }`
 * and no names) is not claimed and stays in the old key, counted as left (the
 * Mastermind carries its old clear because a decision reads it; nothing would read
 * this one), and a stale cast cannot reach the next incident either way: opening
 * one stamps every per-incident field.
 *
 * EVERY FIELD, ITS NULLS INCLUDED (the round-2 review's R2-B1, 26.09.2026). A 1.2.62
 * entry was written whole, and its null is a decision - "no third", "no receipt" -
 * at its `updated`. Claimed without its nulls, a GM whose old key held the running
 * incident held no stamp for them, and another GM's older entry - the previous
 * incident, which that GM last saw - filled them unopposed: on three GMs every record
 * read the previous incident's third on the killer's side, and the primary sent that
 * player the cast, killer included (measured, 61 K on the tree before this). An entry
 * from before the running incident opened is left outright (`previousIncident`).
 */
export const castStore = defineGmStore({
    name: "cast", key: SETTINGS.incidentCast, legacyKey: SETTINGS.legacyIncidentCast,
    kind: "record", fields: CAST_FIELDS, split: ["swung", "sent", "openingNotices"], resetGroup: "incident", backup: true, sync: true,
    afterRestore: () => import("./murder.mjs").then(m => m.retellCast()),
    legacyCount: legacy => (isPlain(legacy) && Object.keys(legacy).length ? 1 : 0),
    claim: legacy => {
        if (!isPlain(legacy) || !Object.keys(legacy).length) return { rows: [], left: [] };
        const { updated, betrayal = null, ...rest } = legacy;
        const held = Object.fromEntries(Object.entries(rest).filter(([f, v]) => CAST_FIELDS.includes(f) && v !== undefined));
        const state = getSetting(SETTINGS.murderState) ?? {};
        const here = [held.killerId, held.victimId].some(id => id && game.actors?.has(id));
        /* `openedAt` is the cast's since E05 C8: a browser that claims after the primary lifted
           it out of the world reads the one the GMs' copies brought (read, not measured). */
        const openedAt = state.openedAt ?? castStore.record()?.openedAt;
        const before = Number.isFinite(openedAt) && Number.isFinite(updated) && updated < openedAt - TIMING.gmStoreSkewMs;
        const running = Boolean(state.active) && here && !before;
        const clock = getClock() ?? {};
        const offer = betrayal?.killerId && betrayal.chapter === clock.chapter && betrayal.day === clock.day
            && game.actors?.has(betrayal.thirdId) ? betrayal : null;
        // The running incident's entry says its betrayal too - an offer, or none (null) at its time.
        const fields = { ...(running ? held : {}), ...(offer || (running && "betrayal" in legacy) ? { betrayal: offer } : {}) };
        if (Object.keys(fields).length) return { rows: [{ key: RECORD, fields, stamp: updated }], left: [] };
        const closed = !Object.values(held).some(v => v !== null) && !betrayal;
        const reason = closed ? "closed" : !here ? "otherWorld" : before ? "previousIncident" : "notRunning";
        return { rows: [], left: [{ key: RECORD, reason }] };
    }
});

/**
 * WHO KILLED, BY CHAPTER AND SEASON (E04 C6; audit S04-25). A row per killer,
 * `{ chapter, epoch, at }` (`at` orders them); incident-store.mjs's `blackenedIds` reads the
 * rows of the clock's chapter and season, so the register is never emptied at a
 * chapter's end and a GM's stale copy cannot bring last chapter's killers back.
 * Since 1.2.64 a row also names its `victims`, and the trial counts a killer only for
 * a death the table knows (incident-store.mjs `trialBlackenedIds`; E05 fix r2-G1).
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
        const died = (game.actors ?? []).some(a => deathRecordFor(a)?.chapter === chapter);
        const pending = died && !(trial.chapter === chapter && trial.verdictApplied);
        const rows = [], left = [];
        ids.forEach((id, at) => {
            if (!game.actors?.has(id)) left.push({ key: id, reason: "otherWorld" });
            else if (!pending) left.push({ key: id, reason: "noPendingVerdict" });
            else rows.push({ key: id, fields: { chapter, epoch: 0, at } });
        });
        return { rows, left };
    },
    exists: actorId => Boolean(game.actors?.has(actorId))
});

/**
 * THE DEATHS NOBODY HAS FOUND (E05 C10; audit S06-11). A row per body: `chapter`, `day`,
 * `timeOfDay` (the kill's, which the flag carries once the death is published), `at`,
 * `keepBullets`, `known`, the users besides the GMs who may know of it - the victim's
 * player, the incident's, and later one who found the body alone - and `loot`, a record
 * per item taken off the body meanwhile, whose Truth Bullet names the body and waits for
 * the publication (handover.mjs `lootBody`, E05 fix r2-F0b). `loot` is split, a stamp per
 * record (E05 fix r2-G3): it was one list, and two GMs each adding a loot kept only the
 * later write - see handover.mjs `oweLootBullet`. Written by the kill
 * (chapter.mjs `killCharacter`), dropped by the publication, a revival or the reset's
 * "deaths" group; a dropped row's tombstone is what a player's copy weighs its loss
 * against. No old key: a death before 1.2.64 was published at the kill.
 */
export const deathStore = defineGmStore({
    name: "deaths", key: SETTINGS.gmDeaths,
    kind: "ledger", split: ["loot"], resetGroup: "deaths", backup: true, sync: true,
    afterRestore: () => import("./murder.mjs").then(m => m.retellDeaths()),
    exists: actorId => Boolean(game.actors?.has(actorId))
});

/**
 * A PLAYER'S DEATHS (E05 C10): `{ actorId: { chapter, day, timeOfDay } }` for the bodies
 * this user may know and nobody has published, as a GM sent them, a stamp per body - taken
 * by the offers' rule (`offersCombine`): an answer is the user's whole set, at least as new
 * for every body it names and newer for one, and a body it no longer names goes with it
 * (published - the flag says it now - or revived).
 */
export const deathCopy = defineGmCopy({
    name: "deaths", key: SETTINGS.mineDeaths, from: "deaths", resetGroup: "deaths", fallback: {},
    combine: offersCombine
});

/**
 * The fields that say who is in an incident (incident-store.mjs, `castOwners`): the seats,
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
 * emptied by a newer seat whatever the other parts say. So is a copy that holds the
 * betrayal offer and nothing else (E32+E07 fix r1-G1, 29.09.2026; the review's M1): its
 * third stands outside the incident running now, and is sent the seats' stamps alone
 * (incident-store.mjs `castPacket`) - weighed on all of them, a copy holding the fight they
 * fought refused it at 0 in every other part. Pure (R176, R210).
 */
export function castCombine(held, offered, { cut = 0 } = {}) {
    const seats = stamps => Object.fromEntries(CAST_SEATS.map(part => [part, stamps?.[part] ?? 0]));
    if (Object.keys(offered?.value ?? {}).every(part => part === "betrayal")) {
        const stamps = seats(offered?.stamps);
        return newerStamps(stamps, seats(held?.stamps), cut) ? { value: { ...(offered?.value ?? {}) }, stamps } : null;
    }
    return newerStamps(offered?.stamps, held?.stamps, cut) ? offered : null;
}

/**
 * A PARTICIPANT'S CAST (E04 C6): what one player's browser holds of the running
 * incident - the cast when they are in it, nothing when they are not - taken only
 * where newer (`castCombine`), so a GM whose browser holds no cast cannot empty it.
 */
export const castCopy = defineGmCopy({
    name: "cast", key: SETTINGS.mineCast, legacyKey: SETTINGS.legacyIncidentCast, from: "cast", resetGroup: "incident", fallback: {},
    combine: castCombine
});

/* The suite's projects (`withLivingProjects`): while set, the claims read these ids as the
   projects this world has - the census claims its trap fixtures against one, where it
   wrote it into the world's project metadata until E04's fix round (the round-2 reviews'
   R2-m6: world data, put back only by tier 2's restore). */
let livingOverride = null;

/** Run `fn` with the traps' claims reading `ids` as this world's projects, and put the real reading back whatever happens. */
export async function withLivingProjects(ids, fn) {
    const was = livingOverride;
    livingOverride = new Set(ids);
    try { return await fn(); }
    finally { livingOverride = was; }
}

/**
 * The projects this world has: its project metadata's ids and every project
 * projects.mjs lists (`allProjects`, the countdowns). A trap row or a plant of a
 * project in neither is a dead project's, and is not claimed.
 */
async function livingProjects() {
    if (livingOverride) return new Set(livingOverride);
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
    },
    /* A plant's subject for compaction is its scene: a taken plant's tombstone keeps
       no project to look up (its fields went with it), and a room of a scene this
       world no longer has is one nobody can search. `-::room` (no scene) is kept. */
    exists: key => {
        const sceneId = String(key).split("::")[0];
        return sceneId === "-" || Boolean(game.scenes?.has(sceneId));
    }
});

/**
 * AN INDIRECT MURDER'S KILLER, BUILDER, CONDITION AND TRIGGER (E05 C1; audit S09-05, D3). A row per
 * countdown id: `killerId`, `by`, `condition`, `trigger` - projectMeta's four fields until 1.2.64,
 * which every browser held - and, on a repair's row, `saboteur`, the user who asked for the sabotage
 * (E05's fix round, S1-m1; projects-secrecy.mjs `PROJECT_SECRET_FIELDS`). `trigger` is split, a stamp per part, so the primary stamping a trap fired
 * and another GM re-arming it keep theirs (projects-secrecy.mjs `patchTrigger`). No old key: the first rows
 * come out of the world by the clause `liftProjectSecrets` (migrate.mjs). A row's subject is its
 * project - its row in projectMeta, or its countdown.
 */
export const projectSecretStore = defineGmStore({
    name: "projectSecrets", key: SETTINGS.projectSecrets,
    kind: "ledger", split: ["trigger"], resetGroup: "projects", backup: true, sync: true,
    exists: id => Object.hasOwn(getSetting(SETTINGS.projectMeta) ?? {}, id)
        || Boolean(game.settings.get("daggerheart", "Countdowns")?.countdowns?.[id])
});

/**
 * THE DIRECT MURDERS DECLARED IN THE DARK (E05 C3; audit S10-01, S01-02, S11-02). A row per
 * killer: `room`, `note`, `at`, `approved` and `eclipse`, the Eclipse it was declared in
 * (settings.mjs `eclipseId`) - the world setting `pendingMurders` until 1.2.64, which every
 * browser held for the whole Eclipse. A betrayal declared in an Eclipse is a row too, keyed by
 * the betrayer, its `betrayal` a copy of the offer it was declared on, which the lights take
 * (eclipse.mjs `parkBetrayal`, E32 C5b; fix r1-G2); a murder's row names `betrayal` null. Read for the running Eclipse only (eclipse.mjs
 * `pendingMurders`); the lights judge that Eclipse's rows and drop every other unjudged. In
 * the incident's reset group: a declaration nobody judged is an incident that has not
 * happened yet. No old key: the first rows come out of the world by `liftPendingMurders`.
 */
export const pendingMurderStore = defineGmStore({
    name: "pendingMurders", key: SETTINGS.pendingMurders,
    kind: "ledger", resetGroup: "incident", backup: true, sync: true,
    exists: actorId => Boolean(game.actors?.has(actorId))
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
    afterRestore: () => import("./level-up.mjs").then(m => m.retellOffers()),
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
    },
    exists: actorId => Boolean(game.actors?.has(actorId))
});

/**
 * THE REINFORCED LEVEL UPS WAITING FOR THE CLASS (E05 C11, 27.09.2026; D4; audit S03-01,
 * S06-01). A row per surviving Blackened: `kind`, `chapter` (the wrong verdict's), `at` and
 * `count`, how many wrong verdicts it waited through - two Reinforced for one character
 * would otherwise be one row, and the second verdict's would take the first's place. Written
 * by a wrong verdict (level-up.mjs `deferAdvancement`), applied and dropped by the class's
 * next correct verdict or the Final Trial's (`runAdvancementBatch`, the owner's Q7), dropped
 * by a kill (chapter.mjs `killCharacter`) and cut by the reset's "advancement" group - the
 * two ways it lapses. No player copy and no old key: a 1.2.63 world applied it at once.
 */
export const deferredOfferStore = defineGmStore({
    name: "deferredOffers", key: SETTINGS.gmDeferredOffers,
    kind: "ledger", resetGroup: "advancement", backup: true, sync: true,
    exists: actorId => Boolean(game.actors?.has(actorId))
});

/**
 * THE DESPAIR OVERFLOW'S COUNT (E05 C12, 27.09.2026; audit S01-60). A record, `{ count }`: the
 * spilled Despair waiting to be spent - half of the world setting `overflow` until 1.2.64, which
 * every browser held while a player's caption masked it as "?". The other half, the darkening's
 * stamp, stays in the world (it is announced when it fires). Written by `addOverflow`,
 * `checkOverflow` and `resetOverflow` on whichever GM runs them; two GMs adding within one
 * exchange's latency keep the newer write - the race the world setting had, which the pools'
 * one writer (DESP-12) could be extended to. Each of the three reads the count once the store
 * holds the other GMs' copies (E05 fix r2-G2; review S2-m7). Cut by the reset's "overflow"
 * group beside `resetOverflow`. No old key: an older world's count comes out of the world by
 * `liftOverflowCount`.
 */
export const overflowStore = defineGmStore({
    name: "overflow", key: SETTINGS.gmOverflow,
    kind: "record", fields: ["count"], resetGroup: "overflow", backup: true, sync: true
});

/**
 * THE DESPAIR A POOL OWES (E05 C12, 27.09.2026; audit S09-28). A row per conversion to Hope,
 * keyed `<pool's user>:<converting GM>:<ms>` since E05 fix r2-G2 (one row per pool lost a debt
 * when two GMs converted at once): `owed`, what it took and the pool has not paid yet, and
 * `since`, the time of day it was made in (despair.mjs `timeOfDayMark`). A conversion took the
 * pool down at the moment the recipient's Hope rose, which every console could pair; the pool now
 * pays at the next time of day (`settleOwed`, on the primary), and until then what it can spend
 * is the pool less this (`spendableDespair`). Dropped by a fill and a zero, cut by the reset's
 * "despair" group. No player copy - nothing a player's client reads - and nothing to lift: a
 * 1.2.63 world's pool already paid.
 */
export const despairOwedStore = defineGmStore({
    name: "despairOwed", key: SETTINGS.gmDespairOwed,
    kind: "ledger", resetGroup: "despair", backup: true, sync: true,
    exists: key => Boolean(game.users?.has(String(key).split(":")[0]))
});

/**
 * WHAT HAS BEEN TAKEN OFF EACH BODY (E05 C14, 27.09.2026; audit S05-39 (3)). A row per body:
 * `sceneId` and `tokenId`, its one loot trace, and `taken`, every item's name that has left
 * it. Until 1.2.64 it was the body's own `lootTrace` flag, which every browser holds: a
 * console read which trace on the map was the body's and everything taken off it, whoever
 * found it. Written by the GM that serves a loot (handover.mjs `markBodyDisturbed`), cut by
 * the reset's "remnants" group with the traces it points at. No player copy - nothing on a
 * player's client reads it - and no old key: an older world's flags come out of the world by
 * `liftLootTraces`.
 */
export const lootTraceStore = defineGmStore({
    name: "lootTraces", key: SETTINGS.gmLootTraces,
    kind: "ledger", resetGroup: "remnants", backup: true, sync: true,
    exists: actorId => Boolean(game.actors?.has(actorId))
});

/**
 * THE CLEANING TOOLS A CLEAN-UP USED (E32+E07 C12, 02.10.2026; audit S05-38, S04-20, S05-23;
 * the owner's D13: the Cleaning Tool remembered like the weapon). A row per killer,
 * `{ chapter, epoch, cleaning, victims }`: the clock's chapter and season (`seasonEpoch`, as the
 * Blackened rows keep it), the id of every Cleaning Tool they had readied at a clean-up
 * attempt the GM scored (cleanup.mjs `noteCleaningTool`), and since fix r2-G3 the bodies those
 * attempts cleaned up after, so a discovery breaks only the tools of the bodies it found. Until 1.2.66 the discovery broke
 * what the killers held in hand at that moment, read off `killerIds()` - so gloves put away
 * after the clean-up survived it, and a discovery after the close, when the incident and its
 * killers are gone, broke nothing at all. Read and emptied by `destroyCleaningTools`; a row of
 * another chapter or season counts nothing, and the chapter's end and the reset's "incident"
 * group take what is left. Backed up and synced between GMs. No player copy - nothing on a
 * player's client reads it, so R182 has nothing to ask of it.
 */
export const usedToolStore = defineGmStore({
    name: "usedTools", key: SETTINGS.gmUsedTools,
    kind: "ledger", resetGroup: "incident", backup: true, sync: true,
    exists: actorId => Boolean(game.actors?.has(actorId))
});

/**
 * THE OFFERS COPY'S RULE (the round-2 review's M2, 26.09.2026). An answer names every
 * character its owner owns now, each with the newest decision about it, and is the
 * owner's whole set: taken when it is at least as new in every character it names and
 * newer in one, and the characters it no longer names - given to another player,
 * deleted - go with it. Weighed by `newerStamps`, a character that had an offer and then
 * left the owner's set counted as a part the answer held at 0, older than the copy's:
 * every answer after was refused, and no offer lit that owner's button again that
 * season. Under a reset's cut a part counts as none. Pure (R176).
 */
export function offersCombine(held, offered, { cut = 0 } = {}) {
    const live = s => (s > cut ? s : 0);
    const named = Object.entries(offered?.stamps ?? {});
    let newer = false;
    for (const [actorId, s] of named) {
        const theirs = live(s), mine = live(held?.stamps?.[actorId] ?? 0);
        if (theirs < mine) return null;
        if (theirs > mine) newer = true;
    }
    const gone = Object.keys(held?.stamps ?? {}).some(actorId => !Object.hasOwn(offered?.stamps ?? {}, actorId));
    return newer || gone ? { value: offered?.value ?? {}, stamps: offered?.stamps ?? {} } : null;
}

/**
 * AN OWNER'S OFFERS (E04 C8): the Level Ups standing on this user's own characters,
 * `{ actorId: { kind } }`, as the primary GM sent them - a stamp per character (the row's,
 * a withdrawal's tombstone included), and taken whole only when it is at least as new
 * for every character and newer for one (gm-store.mjs `newerStamps`). An answer from a
 * primary whose browser holds no offer carries stamp 0 and changes nothing: the lit
 * button stays lit, where the old copy was replaced by whatever set arrived.
 */
export const offerCopy = defineGmCopy({
    name: "offers", key: SETTINGS.mineOffers, legacyKey: SETTINGS.legacyAdvanceOffers, from: "offers", resetGroup: "advancement", fallback: {},
    combine: offersCombine,
    // A reset that withdraws the offers (the owner's Q4) sends no answer: the cut is the withdrawal.
    onCut: () => {
        import("./level-up.mjs").then(m => m.redrawOwnSheets())
            .catch(err => error("The Level Up button could not be drawn again after a reset", err));
    }
});

/**
 * THE ECLIPSE'S CROSSINGS (E05 C4; audit S10-39). A row per character: `used`, and
 * `eclipse`, the Eclipse they were used in (settings.mjs `eclipseId`) - the world setting
 * `eclipseMoves` until 1.2.64, which every browser held. A row of another Eclipse counts
 * nothing, so nothing clears the store when an Eclipse starts or ends. Counted by the
 * primary GM, which judges the allowance (eclipse.mjs `applyRecordedMove`). Backed up, and
 * its owners told again after a restore, as every store a player's copy is made of is
 * (R182) - the design's table had it not backed up, which that rule does not allow. No old
 * key: the first rows come out of the world by `liftEclipseMoves`.
 */
export const eclipseMoveStore = defineGmStore({
    name: "eclipseMoves", key: SETTINGS.gmEclipseMoves,
    kind: "ledger", resetGroup: "eclipseMoves", backup: true, sync: true,
    afterRestore: () => import("./eclipse.mjs").then(m => m.retellMoves()),
    exists: actorId => Boolean(game.actors?.has(actorId))
});

/**
 * AN OWNER'S CROSSINGS (E05 C4): `{ actorId: { used, eclipse } }` for the characters this
 * user owns, as the primary GM sent them, a stamp per character - taken by the offers' rule
 * (`offersCombine`): an answer is the owner's whole set, at least as new for every character
 * it names and newer for one, and an answer from a GM whose browser holds no row (stamp 0)
 * takes nothing away. Read by the sheet, the status panel and the veto (`eclipseMovesUsed`).
 */
export const eclipseMoveCopy = defineGmCopy({
    name: "eclipseMoves", key: SETTINGS.mineEclipseMoves, from: "eclipseMoves", resetGroup: "eclipseMoves", fallback: {},
    combine: offersCombine
});

/**
 * A CONFUSION'S ARMED CALLS (E06 fix r2-G4, 28.09.2026; review round 2's mn2). A row per
 * target, `{ calls }`: each Confusion a Monocub landed that its target has not rolled yet,
 * `{ key: "meddle", grants, amount, nonce }`. Until 1.2.65 an entry of the target's
 * `pendingCall` flag, which every browser holds, written at the moment the room watched the
 * Monocub roll - so every console read whom it was aimed at, and by `amount`'s sign which way,
 * where the roll says neither. Written by the GM that resolves the Confusion
 * (call-effects.mjs `armConfusion`), dropped by the roll that spends it (`spendConfusions`);
 * cut by the reset's "actions" group, beside the action budgets a Confusion's critical moves.
 * No old key: a 1.2.64 world's come off its flags by `liftArmedConfusions`.
 */
export const confusionStore = defineGmStore({
    name: "confusions", key: SETTINGS.gmConfusions,
    kind: "ledger", resetGroup: "actions", backup: true, sync: true,
    afterRestore: () => import("./call-effects.mjs").then(m => m.retellConfusions()),
    exists: actorId => Boolean(game.actors?.has(actorId))
});

/**
 * AN OWNER'S CONFUSIONS (E06 fix r2-G4): `{ actorId: { calls, spent } }` for the characters
 * this user owns, as a GM sent them, a stamp per character - taken by the offers' rule
 * (`offersCombine`). `spent` is written on the owner's browser alone: the nonces a roll there
 * spent, until a GM's answer no longer holds them (call-effects.mjs `spendConfusions`).
 */
export const confusionCopy = defineGmCopy({
    name: "confusions", key: SETTINGS.mineConfusions, from: "confusions", resetGroup: "actions", fallback: {},
    combine: offersCombine
});

/**
 * THE REROLL'S BOOKMARK, ON THE GMS (E08+E28 C2, 03.10.2026; audit S05-08, S08-04, S04-18; the
 * plan's 2.2). A row per character, the last roll the GMs were told of: `messageId`, `actionKey`,
 * `trait`, `experiences`, `total`, `withFear`, `isCritical`, `first` (its rolls as first thrown),
 * `stands` (the rolls its last Reroll wrote, E08+E28 fix r1-G6; reroll.mjs `standingRolls`),
 * `room` (where the character stood as the GM kept it, E08+E28 C4a), `at` and `by`, the user
 * whose browser threw it, and `reportMessageId`, the card the roll was reported on, which a
 * Reroll marks (C5); then `facts`, written by the GM that did a thing
 * for that roll - the trace it placed, the plant it handed over, the crisis action's item and the
 * resources before it, the clean-up attempt - and `claims`, what only the roller's browser saw
 * (its Search's item on its own sheet, a Project's relief), picked per action (action-rolls.mjs
 * `ROLL_CLAIMS`). Written by `keepGmBookmark` and `noteRollFact` (action-rolls.mjs), and read by
 * the Reroll the GM makes (reroll.mjs `rerollOnGm`, E08+E28 C4a). Synced between the
 * GMs and not backed up: a row is worth one Reroll, minutes long. Cut by the reset's "actions"
 * group, beside the Confusions. No player copy - R182 has nothing to ask of it - and no old key.
 */
export const rerollBookmarkStore = defineGmStore({
    name: "rerollBookmarks", key: SETTINGS.gmRerollBookmarks,
    kind: "ledger", resetGroup: "actions", backup: false, sync: true,
    exists: actorId => Boolean(game.actors?.has(actorId))
});

/**
 * A REROLL HALF MADE (E08+E28 C4a, 03.10.2026; audit S02-47; the plan's 2.3). A row per
 * character while the GM makes its Reroll (reroll.mjs `rerollOnGm`): `phase` - "paid" once the
 * Hope is taken, "rolled" once the message holds the new dice, "replaying" while the action is
 * taken back and made again - `hope` (what was paid), `messageId`, `firstRolls` (the message's
 * rolls before this Reroll), `at` and `by`; since C4b also `gm` (the GM client making it), `first`
 * and `action` (the first total, the action's key) and, from "replaying", the new `total`. Dropped
 * when the Reroll stands or has been given
 * back; a row still here is a Reroll a reload cut, which the primary puts right or tells
 * (reroll.mjs `recoverRerollJournal`, E08+E28 C4b). Synced
 * between the GMs, so the next primary reads what the last one left, and not backed up: a row
 * is seconds long. Cut by the reset's "actions" group, beside the bookmark. No player copy -
 * R182 has nothing to ask of it - and no old key.
 */
export const rerollJournalStore = defineGmStore({
    name: "rerollJournal", key: SETTINGS.gmRerollJournal,
    kind: "ledger", resetGroup: "actions", backup: false, sync: true,
    exists: actorId => Boolean(game.actors?.has(actorId))
});

/**
 * A CLEAN-UP'S RECEIPT (E08+E28 C3, 03.10.2026; audit S05-44). A row per character, what their
 * last clean-up attempt did, so a Reroll can take it back (cleanup.mjs `undoLastCleanup`):
 * `tokenId`, `attempt`, the Sanity before and after, `free`, `erased` (the trace's whole
 * creation data, its token id with it), `leftBehind`, `transformed` and `handedBack`. Until
 * 1.2.67 a Map on the GM's browser that resolved the attempt, so a GM's reload lost it while
 * the player's Reroll still said the clean-up was replayed. Synced between the GMs and not
 * backed up: a row is worth one Reroll, minutes long - the Reroll's bookmark's trade. Cut by
 * the reset's "incident" group. No player copy - R182 has nothing to ask of it - and no old key.
 */
export const cleanupAttemptStore = defineGmStore({
    name: "cleanupAttempts", key: SETTINGS.gmCleanupAttempts,
    kind: "ledger", resetGroup: "incident", backup: false, sync: true,
    exists: actorId => Boolean(game.actors?.has(actorId))
});

/**
 * THE ROLLS THE GM DREW (E08+E28 C12a, 04.10.2026; audit S16-05; the plan's 3.3). A row per
 * roll, keyed by its `rollId`: `actorId`, `userId` (the roller), `actionKey`, `messageId`,
 * `claimed`, `formula`, `trait` and `experiences` (as the roll was thrown with them, which a
 * Reroll rebuilds it from), `dice` (`faces` and each result), `total`, `hope`, `fear`, `isCritical`,
 * `withHope`, `withFear`, `modifiers`, then `expected`, `flags` and `used` (C12b: what the GM
 * expected, what differed, the Calls it spent, the stash's step it drew, the Loaded Die),
 * `resolved` (the actions it has settled, C14), `versions` (the dice and numbers each Reroll
 * replaced, the draw's first, and `rerolledAt`, C17: roll-draw.mjs `keepRerolledVersion`),
 * `crisis` (the crisis action a crisis roll was drawn for), `incident` (the incident's turn it was
 * drawn in, or null) and `superseded` (the later roll of its action that replaced it, or null:
 * fix r2-H1, roll-draw.mjs `keepRecord`), `project` (the project a Work's or a Sabotage's roll was
 * drawn for, or null: fix r2-H2), `tokenSpentAt` (on a Search, when the primary spent its room's
 * token for it: search-tokens.mjs `SearchTokens.markSpent`, E29 fix r2-H11), and `at`. Written by
 * the primary GM as it draws a player's roll (roll-draw.mjs `drawOnGm`), and by
 * the GM a Reroll of it is made on; read by the guard that ties a drawn message to its roller
 * (bridge-guards.mjs `guardRollAuthor`) and by the resolutions that take its result (`rollRefusal`). Synced between the GMs and not backed up: a
 * row is worth a roll's resolution and its Reroll, minutes long, and is swept past
 * `TIMING.rerollWindowMinutes` as the next is written. Cut by the reset's "actions" group,
 * beside the bookmark. Its `exists` answers no for every key: a row's key is a roll, which is no
 * document, and a swept roll is gone for good - so its tombstone is compacted after
 * `TIMING.gmStoreTombstoneDays` (`compactGmStores`) rather than kept one per roll for ever; a row
 * a GM who held it brings back is swept again by its `at`. No player copy - R182 has nothing to
 * ask of it - and no old key.
 */
export const rollStore = defineGmStore({
    name: "rolls", key: SETTINGS.gmRolls,
    kind: "ledger", resetGroup: "actions", backup: false, sync: true,
    exists: () => false
});

/**
 * WHAT THE GMS JUDGE A PLAYER'S WRITE AGAINST (E29 C3, 05.10.2026; audit S02-41; the plan's 2.3).
 * A row per character, keyed by its actor id: the values its last judged write left - `traits`,
 * `experiences`, `resources` (each value and maximum), `rules`, `bonuses`, the module `flags` only
 * a GM writes and `pendingCall`, and `effects` (each one's data, so a deleted one can be made
 * again under its id); since C6 `items` (each module item's data, likewise - and since E29 fix
 * r1-G2 each class's, and `levelData`, Daggerheart's level-up selections; since fix r2-H25 `scars`, Daggerheart's
 * scars, which set Hope's maximum), since G3 `itemEffects`
 * (the effects on each of its items, by item - an item's copy in `items` holds none) and `finds` (the
 * Search records a find stood on, each with the item: one find a record). Written by the primary after every verdict and every GM's write, and filled
 * from the documents when its stores hydrate and a character has none (sheet-audit.mjs). Synced
 * between the GMs, so the next primary judges against the same marks; not backed up - the
 * documents a restore brings back are the marks' source, and a backup's would judge them against
 * the sheets of the day it was made. Cut by the reset's "advancement" group: the step that puts
 * every sheet back writes each student as a GM, which is that student's new mark (the plan named
 * a "season" group, which the reset window does not have), and the primary fills the mark of every
 * student that step writes nothing on as the cut is applied (`onCut`, E29 fix r1-G6). No player copy - R182 has nothing to ask
 * of it - and no old key.
 */
export const sheetMarkStore = defineGmStore({
    name: "sheetMarks", key: SETTINGS.gmSheetMarks,
    kind: "ledger", resetGroup: "advancement", backup: false, sync: true,
    exists: actorId => Boolean(game.actors?.has(actorId)),
    // A student the reset's steps write nothing on would have no mark until the next hydration (E29 fix r1-G6).
    onCut: () => {
        import("./sheet-audit.mjs").then(m => m.refillMarks())
            .catch(err => error("The GMs' marks of the sheets could not be filled again after a reset", err));
    }
});

/**
 * THE WRITES THE GMS PUT BACK OR LISTED (E29 C3, 05.10.2026; the plan's 2.3). A row per write,
 * keyed by a random id: `actorId`, `itemId`, `userId` (the writer), `reason` and `ref` (what the
 * write's stamp claimed, resource-guard.mjs `WRITE_STAMP`), `change` (`{ path: [before, after] }`),
 * `verdict` ("putBack", "flagged", "listed", or "covered" for a write that stood on credit or a judge, E29 fix r1-G4),
 * `covered` (the credit a refund took), `messageId` (the GMs' whisper, or their card of a flagged write),
 * `decided` (a flagged write's Undo or Keep, C5: `{ by, at, how, undone, moved }`) and `at`; a write on an item
 * names it in `itemId`, and a deleted one keeps its data in `data` for an Undo (C6). Written by
 * the primary as it judges, read by `game.drpg.sheetWrites()`. Synced, not backed up, and swept
 * past a day as the next is written; cut by the reset's "actions" group, beside the rolls. Its
 * `exists` answers no for every key, as the rolls' does: a row's key is no document. No player
 * copy - R182 has nothing to ask of it - and no old key.
 */
export const sheetWriteStore = defineGmStore({
    name: "sheetWrites", key: SETTINGS.gmSheetWrites,
    kind: "ledger", resetGroup: "actions", backup: false, sync: true,
    exists: () => false
});

/**
 * THE KEY REMNANT PLAN (E05 C5; audit S01-01, S05-02). A row per chapter and slot,
 * `${chapter}:${slot}`: scale, name, text, analysis, note, tokenId, sceneId - the world
 * setting `keyRemnantPlan` until 1.2.64, which every browser held: one chapter's plan, the
 * others filed under `archive` when the clock left them. A row is a chapter's already, so
 * nothing is filed when the chapter ends (investigation.mjs `keyPlan`), and a stamp per
 * field lets a GM writing one slot and another GM another both keep theirs (`setKeyPlan`
 * writes only what it changes). No `exists`: a row outlives the trace it names, as the
 * world key's entries did - a chapter's plan stays until a reset's cut takes it. A reset
 * that keeps the plan (E05 fix r1-G5, M3) keeps ONE chapter's rows, not every chapter's:
 * investigation.mjs's `keepOnlyKeyPlanChapter`, which `season-setup.mjs`'s `wipeSeason` calls
 * instead of `clearKeyPlan` when the group is kept, drops the rest - so the next season's
 * chapter of that same number opens with them, as 1.2.63's one stored plan did, and a row has
 * no season stamped on it, so any chapter left standing would otherwise have read as planned
 * before this season ever opened the planner (`chargeForUnfoundKeys` read the slots' chapters
 * until E09 C7, the case rows since). No old key: the first
 * rows come out of the world by `liftKeyPlan`. Beside a chapter's slots, one case row since
 * E09 C6, `${chapter}:case`: `{ keys }`, the closed case's Key Remnant count
 * (investigation.mjs `recordCaseKeys`), which no slot reader takes.
 */
export const keyPlanStore = defineGmStore({
    name: "keyPlan", key: SETTINGS.gmKeyPlan,
    kind: "ledger", resetGroup: "keyPlan", backup: true, sync: true
});

/**
 * THE PRE-SESSION NOTES (E05 C6; audit S11-03, S01-08). A row per user: text, updatedAt,
 * byGm - a flag on the player's own User document until 1.2.64, which every browser held,
 * and whose first question is "Am I planning to kill? How?". Written by a GM, a player's
 * own through the primary (the bridge's `note.save`); backed up, and each player told
 * again after a restore (R182). Wiped by the reset group the flag's step always had,
 * preNotes: its cut takes the rows on every GM and every player's copy. No old key: the
 * first rows come out of the flags by `liftNotes`.
 */
export const noteStore = defineGmStore({
    name: "notes", key: SETTINGS.gmNotes,
    kind: "ledger", resetGroup: "preNotes", backup: true, sync: true,
    // The users' flags first (E05 fix r1-G4, M6 = S1-m6): the file holds the rows, not the flags that describe them.
    afterRestore: () => import("./pre-session-note.mjs").then(async m => { await m.settleNoteFlags(); return m.retellNotes(); }),
    exists: userId => Boolean(game.users?.has(userId))
});

/**
 * THE NOTE COPY'S RULE (E05 C6). One stamp, the row's newest (`sendNoteTo`), and a
 * draft: a player's own note written in this browser and not yet held by the GMs,
 * marked `unsent` - which a GM's copy never carries (pre-session-note.mjs
 * `receiveNote`). A draft is always taken, whatever its stamp; while one is held, a
 * GM's copy is taken only when it holds the draft's words, which is the GMs saying they
 * have it - an older copy, sent to the player's ask at load before the draft reached the
 * GM, would otherwise put the older words back over the ones typed. Otherwise a copy is
 * taken when its stamp is newer, a stamp under a reset's cut counting as none. Pure (R176).
 */
export function noteCombine(held, offered, { cut = 0 } = {}) {
    if (offered?.value?.unsent === true) return offered;
    if (held?.value?.unsent === true) return offered?.value?.text === held.value.text ? offered : null;
    return newerStamps(offered?.stamps, held?.stamps, cut) ? offered : null;
}

/**
 * A PLAYER'S OWN NOTE (E05 C6): `{ text, updatedAt, byGm }` as a GM sent it, or with
 * `unsent` as the player wrote it here - taken by `noteCombine`. Read by the Note tab
 * (pre-session-note.mjs `noteFor`, `noteStatus`); nothing of another player's is here.
 */
export const noteCopy = defineGmCopy({
    name: "note", key: SETTINGS.mineNote, from: "notes", resetGroup: "preNotes", fallback: {},
    combine: noteCombine
});

/** The rows of an old ledger `{ sceneId: { actorId: [room, ...] } }`, one per scene and character. */
function fogRows(legacy) {
    const rows = [];
    for (const [sceneId, forScene] of Object.entries(isPlain(legacy) ? legacy : {})) {
        for (const [actorId, rooms] of Object.entries(isPlain(forScene) ? forScene : {})) rows.push({ sceneId, actorId, rooms });
    }
    return rows;
}
const fogKey = (sceneId, actorId) => `${sceneId}/${actorId}`;
const roomCells = rooms => Object.fromEntries((Array.isArray(rooms) ? rooms : []).filter(r => typeof r === "string" && r).map(r => [r, true]));

/**
 * WHERE THE CLASS HAS BEEN (E04 C9; audit S07-01). A row per `sceneId/actorId` and a
 * cell per room - true, or false where a GM unticked it - each stamped, synced between
 * the GMs. The union used to be one object written whole: a GM's copy that had not
 * heard of an untick, or a player's rows in the primary's rebuild, put the room back,
 * because a union only grows. A cell's newest stamp decides now. The old rows are
 * claimed on the primary's browser only (the design's row 17: the old key had no way to
 * say "unticked", so a union of every GM's browser would re-reveal), weak, for this
 * world's scenes and characters and never a Monokuma's (S01-31: its walks lifted the
 * GM's own veil).
 */
export const discoveryStore = defineGmStore({
    name: "discovery", key: SETTINGS.discoveryLedger, legacyKey: SETTINGS.legacyDiscoveryLedger,
    kind: "ledger", resetGroup: "discovered", backup: true, sync: true,
    afterRestore: () => import("./fog.mjs").then(m => m.retellFog()),
    legacyCount: legacy => fogRows(legacy).length,
    claim: async legacy => {
        const rows = fogRows(legacy);
        if (!isPrimaryGm()) return { rows: [], left: rows.map(r => ({ key: fogKey(r.sceneId, r.actorId), reason: "notPrimary" })) };
        const { isMonokuma } = await import("./monokuma.mjs");
        const out = [], left = [];
        for (const { sceneId, actorId, rooms } of rows) {
            const key = fogKey(sceneId, actorId), actor = game.actors?.get(actorId);
            if (!game.scenes?.has(sceneId) || !actor) left.push({ key, reason: "otherWorld" });
            else if (isMonokuma(actor)) left.push({ key, reason: "monokuma" });
            else out.push({ key, fields: roomCells(rooms) });
        }
        return { rows: out, left };
    },
    exists: key => {
        const [sceneId, actorId] = String(key).split("/");
        return Boolean(game.scenes?.has(sceneId) && game.actors?.has(actorId));
    }
});

/**
 * A PLAYER'S FOG (E04 C9): the GMs' cells for this user's characters, as a section of
 * its own, merged cell by cell with every section a GM sends (`mergeSections`, the
 * store's own merge) and never replaced - so a GM whose browser holds fewer rows adds
 * nothing and takes nothing away, and a reset's watermark in what arrives cuts every
 * cell under it. A section that is not one (`sectionProblem`) changes nothing. The old
 * rows on this browser (`discoveryMine`) are taken in weak on every load (`claim`):
 * the only copy of the ledger outside the GMs', which the primary's rebuild asks for.
 */
export function fogCombine(held, offered, { cut = 0 } = {}) {
    if (sectionProblem(offered?.value)) return null;
    const before = mergeSections(held?.value ?? null, null, discoveryStore.spec);
    const merged = mergeSections(before, offered.value, discoveryStore.spec);
    raiseCleared(merged, cut, discoveryStore.spec);
    if (stableJson(merged) === stableJson(before)) return null;
    return { value: merged, stamps: { "": newestIn(merged) } };
}

export const fogCopy = defineGmCopy({
    name: "fog", key: SETTINGS.mineFog, legacyKey: SETTINGS.legacyDiscoveryMine, from: "discovery", resetGroup: "discovered", fallback: null,
    combine: fogCombine,
    claim: legacy => {
        const mine = {};
        for (const { sceneId, actorId, rooms } of fogRows(legacy)) {
            if (!game.scenes?.has(sceneId) || !game.actors?.get(actorId)?.isOwner) continue;
            const cells = roomCells(rooms);
            if (Object.keys(cells).length) mine[fogKey(sceneId, actorId)] = cells;
        }
        if (!Object.keys(mine).length) return null;
        // Weak: stamp 1, under anything a GM ever wrote, and dead under any reset's cut.
        const section = { e: mine, t: Object.fromEntries(Object.keys(mine).map(k => [k, 1])), d: {}, cleared: 0 };
        return { value: section, stamps: { "": 1 } };
    }
});

/** The part of the GMs' fog store that is `user`'s: the rows and tombstones of the characters they own, and the watermark. */
export function fogSectionFor(user) {
    const all = discoveryStore.section();
    const mine = key => Boolean(game.actors?.get(String(key).split("/")[1] ?? "")?.testUserPermission?.(user, "OWNER"));
    const pickOwn = part => Object.fromEntries(Object.entries(all[part] ?? {}).filter(([key]) => mine(key)));
    return { e: pickOwn("e"), t: pickOwn("t"), d: pickOwn("d"), cleared: all.cleared ?? 0 };
}

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

/**
 * COMPACTION (E04 C10; the design's 2.11). The exact half needs nothing here: every
 * merge drops what is at or under a section's watermark, a reset's cut included. This
 * is the other half, run on every GM once its stores have the other GMs' copies:
 *
 * - a tombstone older than `TIMING.gmStoreTombstoneDays` whose subject is gone from
 *   this world goes (the handle's `compact`) - for the stores whose rows name their
 *   subject in the key, `exists`: a trace's token, a bullet's item, a character, a
 *   plant's scene, a fog row's scene and character. The trap ledger's key is the
 *   planted object's id, and a tombstone keeps nothing that says which project it
 *   was, so its tombstones stay until a reset cuts them;
 * - on the primary, a Blackened row of a season before this one (`seasonEpoch`) is
 *   dropped, stamped: the register counts the running season's rows only and a season
 *   never comes back. The design also dropped the rows of a past chapter; they are
 *   kept, because moving the clock back a chapter - a GM's correction - reads them
 *   again, and a chapter's end has not emptied the register since E04.
 *
 * Every GM, not the primary alone as the design had it: a tombstone removed on one
 * browser comes back from any GM that holds it at the next exchange, so the removal
 * holds only once each GM has run the same rule. Live rows are never removed here.
 * `now`, `epoch` and `primary` are the suite's. Answers `{ store: n }` of what went.
 */
export async function compactGmStores({ now = gmStoreNow(), epoch = seasonEpoch(), primary = isPrimaryGm() } = {}) {
    if (!game.user?.isGM) return null;
    const before = now - TIMING.gmStoreTombstoneDays * 24 * 60 * 60 * 1000;
    const report = {};
    for (const handle of gmStoreHandles()) {
        const exists = handle.spec.exists;
        if (typeof exists !== "function") continue;
        // A subject that cannot be looked up is kept: a tombstone costs a few bytes, a
        // row brought back by removing one costs a secret.
        const n = await handle.compact(before, key => {
            try { return !exists(key); } catch { return false; }
        });
        if (n) report[handle.name] = n;
    }
    if (primary) {
        const past = Object.entries(blackenedStore.entries())
            .filter(([, row]) => Number.isFinite(row?.epoch) && row.epoch < epoch).map(([key]) => key);
        if (past.length) {
            await blackenedStore.dropMany(past);
            report.blackenedPastSeasons = past.length;
        }
    }
    if (Object.keys(report).length) debug(`The GM stores compacted: ${JSON.stringify(report)}`);
    return report;
}

let opening = null;
/* What the load writes once the stores have heard the other GMs - the compaction and the
   case's marks - held so the suite can wait for it (`whenGmStoresLoaded`). */
let compacting = null, marking = null;

/**
 * Wire the engine to this module and open this world's stores on this client:
 * the claim of the old keys, the clock's reset cuts, the GM-to-GM listener and
 * the hello. Once, at ready, before the migration's clauses (module.mjs), which
 * wait for the stores they read. Never throws: a store that cannot open says so
 * in the log and, on a GM, on screen once (the engine's `open`), and the rest of
 * the module carries on - an Analyze or a handover of a Truth Bullet is refused
 * (`answerKeysRefusal`, below).
 */
export function openGmStores() {
    opening ??= (async () => {
        configureGmStore({
            activeGmIds, primaryGmId, getClock, clockKey: SETTINGS.clock, warn, error, debug,
            upgradeMark: () => upgradeMark(),
            // A counted sentence is a plural family (.one/.other, and .few/.many in Polish).
            text: (key, data = {}) => (game.i18n.has(`${key}.other`) ? plural(key, data) : game.i18n.format(key, data))
        });
        onGmStoresHydrated(() => {
            compacting = compactGmStores().catch(err => error("The GM stores could not be compacted", err));
        });
        try {
            await openGmStoreEngine();
        } catch (err) {
            error("The GM stores could not open", err);
        }
    })();
    return opening;
}

/**
 * Resolves once this client's load has written what it writes of its own accord: the
 * stores have opened and heard the other GMs (or stopped waiting for them), and the
 * compaction and the case's marks that follow are done and saved. The suite waits for
 * it before it first reads the world (tests.mjs `loadSettled`). Not for the health
 * check's window, which waits for a GM; and never resolves while the stores have not
 * opened, so its caller bounds the wait.
 */
export async function whenGmStoresLoaded() {
    await opening;
    await whenGmStoresHydrated();
    await Promise.all([compacting, marking]);
    await gmStoresIdle();
}

/*
 * THE ANSWER KEYS, WAITED FOR WITHIN A BOUND (E04's fix round 10, 26.09.2026). An
 * Analyze and a handover of a Truth Bullet read its answer key, and wait for the other
 * GMs' copies first (fix round 8) - with no bound of their own, so a GM whose stores
 * never opened held the request for ever and the player's own clock ended it with no
 * reason: measured on 05ac984 with the bullets store held unhydrated, p1's Analyze had
 * not settled after 20 s, its action spent, nothing said. The wait ends at the first
 * of: the store hydrated ("open"), this client's open failed ("failed", the engine's
 * `open`), or `TIMING.gmStoreOpenMs` passed ("late"). A failure that comes while a
 * request waits is read when the bound passes. `store`, `ms` and `failed` are the
 * real ones unless R189 hands in its own.
 */
export function answerKeysOpen({ store = bulletStore, ms = TIMING.gmStoreOpenMs, failed = () => gmStoreHydration().state === "failed" } = {}) {
    if (store.isHydrated()) return Promise.resolve("open");
    if (failed()) return Promise.resolve("failed");
    return new Promise(resolve => {
        const timer = setTimeout(() => resolve(failed() ? "failed" : "late"), ms);
        store.whenHydrated().then(() => { clearTimeout(timer); resolve("open"); });
    });
}

/* This GM has been told the stores did not open, this session. A failed open is told by the engine. */
let notOpenTold = false;

/**
 * Null when the answer keys are open; otherwise the reason an Analyze or a handover
 * is refused with (E31's `keysNotOpen`, whose sentence tells the player the GM has been
 * told) - and this GM is told once per session, unless the failed open already was.
 */
export async function answerKeysRefusal() {
    const how = await answerKeysOpen();
    if (how === "open") return null;
    if (how === "late" && !notOpenTold) {
        notOpenTold = true;
        ui.notifications?.error?.(game.i18n.format("DRPG.GmStore.notOpen", { seconds: Math.round(TIMING.gmStoreOpenMs / 1000) }), { permanent: true });
    }
    return "the answer keys are not open on this GM's browser";
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

/** `{ since, lastBackupAt, lastBackupBy, upgradedAt, tiesSettledAt }`: when this world's case was first recorded, its last backup, and two load marks. */
export function caseMark() {
    try { return getSetting(SETTINGS.caseMark) ?? {}; } catch { return {}; }
}

async function markCase(patch) {
    if (!game.user?.isGM) return;
    try { await setSetting(SETTINGS.caseMark, { ...caseMark(), ...patch }); }
    catch (err) { warn("Could not record the case's backup mark", err); }
}

/**
 * THE WORLD'S UPGRADE MARK (the review's DS-M2 and DS-m6): `caseMark.upgradedAt`, the
 * first claim a GM store took in this world, as a store stamp - one number every GM
 * reads alike. A value stamped under it was written before 1.2.63; one over it since.
 * The carry of a Faint Prep promotion (remnants.mjs `oldFieldIn`) and the taking of a
 * downgrade's rows (the handle's `reclaim`) read it: until E04's fix round each read
 * its own browser's claim, and a browser whose old key never held a row - an
 * assistant's, a second computer's - counted every row as written since, stripped a
 * promotion it had not carried and told the GM a correction stood. Null until written.
 */
export function upgradeMark() {
    const mark = caseMark().upgradedAt;
    return Number.isFinite(mark) && mark > 0 ? mark : null;
}

/**
 * Written by every GM once its stores have the others' copies: its own first claim in
 * this world when that is earlier than the mark (or there is none) - so the mark ends
 * at the earliest claim of any GM, whichever loaded first - and nothing otherwise. A
 * browser that never claimed (its claims failed) offers the present stamp.
 */
async function markUpgrade() {
    if (!game.user?.isGM) return;
    const claims = gmStoreHandles().map(h => h.claimInfo()?.at).filter(at => Number.isFinite(at) && at > 0);
    const mine = claims.length ? Math.min(...claims) : gmStoreStamp();
    const mark = upgradeMark();
    if (mark !== null && mark <= mine) return;
    await markCase({ upgradedAt: mine });
}

/**
 * Once the stores hold rows, the world says so: `caseMark.since`, written by the
 * primary after the claim. A browser that later opens this world holding nothing
 * then knows it is not a new case but one it never saw (the health check's
 * "never held" row). A timestamp and nothing about the case itself: "a pick
 * exists" or "an offer is pending" in world data would be a tell (the design's 1).
 * So only the stores whose rows stand for world documents every client holds -
 * the Truth Bullets' and the traces' - count (`caseHasRows`): until E04's fix round
 * any store did, and in a world with no trace and no bullet yet the mark's arrival
 * told a player's console that a Mastermind had been picked (the review's S-m4).
 */
async function markCaseSince() {
    if (!isPrimaryGm() || caseMark().since) return;
    if (caseHasRows(gmStoreHandles())) await markCase({ since: Date.now() });
}

/** When this browser loaded the module: `settleTieStates` reads only a tie stamped before it. */
const TIES_LOADED_AT = Date.now();

/**
 * A TRACE'S "NOT TIED" FROM BEFORE THE THIRD STATE, READ AS UNDECIDED (E09 C4, 08.10.2026; audit
 * S05-37, the owner's D14). Until C4 the ledger wrote every tie through `Boolean()`, so a stored
 * `false` was as often "nobody said" as a GM's "not tied" - and a victim's death tied both
 * anyway. From C4 a death leaves `false` alone
 * (remnants.mjs `tieChapterTraces`), which would turn every old undecided trace into a red
 * herring nobody planted; this turns them back into `null`, once per world, on the primary,
 * after its stores hold the other GMs' copies, and writes `caseMark.tiesSettledAt` so a "not
 * tied" a GM chooses after it is never touched (tier 2 "the tie settle step runs once"). The
 * mark is written whether or not a row moved - a timestamp, and nothing about the case; a
 * browser whose traces' store never hydrated settles nothing and marks nothing, and the next
 * load tries again. A normal stamp, not a weak one: a weak write gives way to a GM's (R172), and
 * the old `false` every other GM still holds was a GM's write.
 *
 * ONLY A `false` FROM BEFORE THIS LOAD. The step runs once the stores have hydrated, after the
 * load's other marks, and a "not tied" written in between is a GM's of today: scenario 10 set one
 * in its first second and read it back `null` (08.10.2026, the step having run after the write).
 * So the tie's own stamp is asked (`stampOf`, per field in the ledger) against the moment this
 * module was loaded (`TIES_LOADED_AT`); `before` is the suite's.
 *
 * @param {{before?: number}} [options]
 * @returns {Promise<number>} how many rows moved
 */
export async function settleTieStates({ before = TIES_LOADED_AT } = {}) {
    if (!isPrimaryGm() || caseMark().tiesSettledAt || !remnantStore.isHydrated()) return 0;
    const undecided = {};
    for (const [key, row] of Object.entries(remnantStore.entries())) {
        if (row?.tiedToCrime === false && remnantStore.stampOf(key, "tiedToCrime") < before) undecided[key] = { tiedToCrime: null };
    }
    const moved = Object.keys(undecided).length;
    if (moved) await remnantStore.patchMany(undecided, { ifLive: true });
    await markCase({ tiesSettledAt: Date.now() });
    return moved;
}

/** Whether the stores whose rows mirror world documents - the bullets', the traces' - hold any. Pure over the handles. */
export function caseHasRows(handles) {
    return handles.some(h => ["bullets", "remnants"].includes(h.name) && Object.keys(h.entries()).length > 0);
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
        const s = Number.isFinite(row.stamp) && row.stamp > 0 ? row.stamp : weakOf(section);
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
 *
 * Checked before anything reads it further (E04's fix round): the format's version is
 * a whole number, or the file is not one this module wrote (the review's S-M2: it was
 * shown in a toast as it came); every store's section passes the gate every packet
 * between the GMs passes (`sectionProblem`, with the store's own split fields), or the
 * file is refused whole, naming the store (S-M1 = DS-m11 = C-m12, measured: a row
 * stamped with a string was restored, and every other GM refused that store from this
 * one from then on). The old export held every world this browser had held, in one
 * object: only this world's rows are taken, and the rest counted (C-m11).
 */
export function readCaseFile(file) {
    let data = file;
    if (typeof file === "string") {
        try { data = JSON.parse(file); } catch { return { refused: "unreadable" }; }
    }
    if (!isPlain(data)) return { refused: "unreadable" };
    if (data.format === CASE_FORMAT) {
        if (!Number.isInteger(data.version) || data.version < 1) return { refused: "unreadable" };
        if (data.version > CASE_VERSION) return { refused: "newer", version: data.version };
        const stores = isPlain(data.stores) ? data.stores : {};
        for (const [name, section] of Object.entries(stores)) {
            const handle = gmStoreByName(name);
            if (!handle?.spec.backup) continue;
            const why = sectionProblem(section, handle.spec);
            if (why) return { refused: "malformed", store: name, why };
        }
        const world = isPlain(data.world) ? { id: data.world.id ?? null, title: data.world.title ?? null } : null;
        return { kind: "case", world, stores, exportedAt: data.exportedAt ?? null };
    }
    if ("format" in data) return { refused: "unreadable" };
    const mine = {};
    let notThisWorld = 0;
    for (const [uuid, row] of Object.entries(data)) {
        if (uuidInThisWorld(uuid)) mine[uuid] = row;
        else notThisWorld++;
    }
    return { kind: "flat", world: null, stores: { bullets: flatToSection(mine, bulletStore.spec, bulletStore.weak()) },
        notThisWorld: { bullets: notThisWorld } };
}

/** A store's name as the case's windows say it. */
const storeLabel = name => game.i18n.localize(`DRPG.Case.store.${name}`);

/**
 * Why a file was refused, as a sentence. Every value the file gave is made plain first
 * (relay-guard.mjs `plainWhat`): a toast's escaping is unmeasured on v14, and a file is
 * text anybody can hand a GM (the review's S-M2). A damaged section's detail goes to
 * the console, where it names the row.
 */
export function caseRefusalText(read) {
    if (read?.refused === "malformed") warn(`The case file's "${read.store}" section was refused: ${read.why}`);
    return game.i18n.format(`DRPG.Case.refused.${read?.refused ?? "unreadable"}`, {
        version: plainWhat(read?.version ?? "?"),
        title: plainWhat(read?.world?.title ?? read?.world?.id ?? "?"),
        store: read?.store ? storeLabel(plainWhat(read.store)) : "?"
    });
}

/** A file's sections as a restore takes them: `fileSection` at this moment, for this world or another. */
function takenSection(section, otherWorld) {
    return fileSection(section, { now: gmStoreNow(), skew: TIMING.gmStoreSkewMs, otherWorld });
}

/** Whether a read file names a world other than this one. */
const fromOtherWorld = read => Boolean(read.world?.id && read.world.id !== game.world.id);

/**
 * What a restore of `file` would do, store by store, without writing anything - the
 * file's sections as the restore would take them (`fileSection`): the rows it adds and
 * refreshes, the rows here it would take a field from or remove (`remove`), the rows
 * whose stamp ran ahead (`clamped`), and an old export's rows of other worlds
 * (`notThisWorld`). A record store of another world's file (`record`) is taken only
 * when the GM ticks it.
 */
export function previewRestore(file) {
    const read = readCaseFile(file);
    if (read.refused) return read;
    const otherWorld = fromOtherWorld(read);
    const stores = {};
    for (const [name, raw] of Object.entries(read.stores)) {
        const handle = gmStoreByName(name);
        if (!handle?.spec.backup) { stores[name] = { unknown: true }; continue; }
        const { section, clamped } = takenSection(raw, otherWorld);
        const { beforeCutKeys, ...counts } = previewSection(handle.section(), section, handle.spec);
        stores[name] = { ...counts, clamped, notThisWorld: read.notThisWorld?.[name] ?? 0,
            ...(otherWorld && handle.spec.kind === "record" ? { record: true } : {}) };
    }
    return { kind: read.kind, world: read.world, otherWorld, exportedAt: read.exportedAt ?? null, stores };
}

/**
 * Restore the case from a file, by the same merge as the sync: it takes only what is
 * newer, so any GM may run it and a restore twice is a restore once.
 *
 * Refused: a file this module did not write, one of a newer format, one with a damaged
 * section (`readCaseFile`), and a file of another world unless `otherWorld` (a moved
 * server, a duplicated world). Never taken from a file (`fileSection`): its watermark,
 * a stamp beyond the clock's bound (taken at this moment, and counted), and from
 * another world's file its removals and - unless the GM ticked the store (`records`)
 * - a record's fields: another world's pick or cast is not this world's (the review's
 * DS-M1, measured: another world's file emptied this world's answer keys on every
 * GM). Rows at or under the reset's cut are refused unless `beforeCut` ("restore
 * anyway"), and then fill only the fields this browser lacks, freshly stamped - the
 * explicit undo of a reset. After it: the other GMs get what changed, in parts; each
 * restored store counts as having its copy; a store whose rows a player holds a copy
 * of sends each connected player theirs again (`afterRestore`: the door, the cast, the
 * offers, the fog - R182); the Faint pass runs again; and the health check runs again
 * (`recheck`).
 */
export async function restoreCase(file, { otherWorld = false, beforeCut = false, recheck = true, records = [] } = {}) {
    if (!game.user?.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Case.gmOnly"));
        return null;
    }
    const read = readCaseFile(file);
    if (read.refused) {
        ui.notifications.error(caseRefusalText(read));
        return { refused: read.refused };
    }
    const foreign = fromOtherWorld(read);
    if (foreign && !otherWorld) {
        ui.notifications.error(caseRefusalText({ refused: "otherWorld", world: read.world }));
        return { refused: "otherWorld" };
    }
    const counts = {};
    for (const [name, raw] of Object.entries(read.stores)) {
        const handle = gmStoreByName(name);
        if (!handle?.spec.backup) continue;
        if (foreign && handle.spec.kind === "record" && !records.includes(name)) {
            counts[name] = { skipped: true };
            continue;
        }
        const { section, clamped } = takenSection(raw, foreign);
        const preview = previewSection(handle.section(), section, handle.spec);
        const changed = await handle.mergeIn(section, { source: "restore" });
        let filled = 0;
        if (beforeCut) {
            for (const k of preview.beforeCutKeys) {
                const fields = section.e?.[k];
                if (!isPlain(fields)) continue;
                const absent = Object.fromEntries(Object.entries(fields).filter(([f]) => !Object.hasOwn(handle.get(k) ?? {}, f)));
                if (!Object.keys(absent).length) continue;
                await handle.patch(k, absent, { fillOnly: true, whole: true });
                filled++;
            }
        }
        handle.markRestored();
        counts[name] = { changed, filled, beforeCut: beforeCut ? 0 : preview.beforeCut, clamped };
        try { await handle.spec.afterRestore?.(); }
        catch (err) { error(`After restoring "${name}", the players' copies could not be sent again`, err); }
    }
    try {
        const { migrateFaintIntoSecrets } = await import("./truth-bullets.mjs");
        await migrateFaintIntoSecrets();
    } catch (err) { error("After a restore, the Faint pass did not finish", err); }
    const lines = Object.entries(counts).map(([name, c]) => (c.skipped
        ? game.i18n.format("DRPG.Case.restoredSkipped", { store: storeLabel(name) })
        : game.i18n.format("DRPG.Case.restoredStore", { store: storeLabel(name), n: c.changed + c.filled, cut: c.beforeCut })));
    const clamped = Object.values(counts).reduce((n, c) => n + (c.clamped ?? 0), 0);
    ui.notifications.info([game.i18n.localize("DRPG.Case.restored"), lines.join("; "),
        clamped ? plural("DRPG.Case.restoredClamped", { n: clamped }) : ""].filter(Boolean).join(" "));
    if (recheck) runHealthCheck().catch(err => error("The case health check could not run", err));
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
 * What a bullet with no real type here can take from its trace: the bullet's row names
 * the trace it was copied from (`sceneId` and `remnantId`), and the trace's row says what
 * it really is - the type the copy was made with (observe.mjs, gm-items.mjs). `{ uuid:
 * { realType } }`, for the bullets whose trace's row is here.
 *
 * THE ROW'S KEY, NOT THE ITEM'S FLAG (E05 C13, 27.09.2026). Until 1.2.64 the bullet's
 * public `remnantRef` flag named the trace, on every browser; the clause `liftBulletRefs`
 * moves an older world's into the rows - a row this browser had lost whole comes back as
 * the key alone, which this then fills. A bullet made since whose row is lost whole names
 * no trace here any more: a backup, or another GM's copy, brings it back.
 */
function fillsFromTraces() {
    const fills = {};
    for (const item of allBullets()) {
        const row = bulletStore.get(item.uuid);
        if (row?.realType) continue;
        const ref = row?.sceneId && row?.remnantId ? `${row.sceneId}.${row.remnantId}` : null;
        const type = ref ? remnantStore.get(ref)?.type : null;
        if (type) fills[item.uuid] = { realType: type };
    }
    return fills;
}

/**
 * FILL FROM THEIR TRACES (the design's 6.3; E04 C4). The bullets whose answer key
 * this browser holds with no real type (S05-01's damage, or a lost row whose trace's
 * key the lift of E05 C13 brought back), and whose trace's row is here, take `realType`
 * from it - weak and fill-only, so a value any GM holds wins, and nothing else of the
 * key is made up: a GM's note, the analysed reading and the rest come back only from a
 * backup. Answers how many bullets were filled.
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
    // A trace whose answer key is still on its token is moved, not restored: counted apart (C-m14).
    const { answerKeyOnToken, ANSWER_KEY_FLAGS } = await import("./remnants.mjs");
    const noRow = traces.filter(token => !remnantStore.has(traceKey(token)));
    const onToken = noRow.filter(answerKeyOnToken);
    const traceGaps = noRow.filter(token => !answerKeyOnToken(token));
    if (traceGaps.length) add("traces", "missing", "DRPG.Case.row.traces", { n: traceGaps.length, of: traces.length });
    if (onToken.length) add("tracesOnToken", "missing", "DRPG.Case.row.tracesOnToken", { n: onToken.length, of: traces.length });
    /* Any other trace token still holding a flag of its answer key (E05 fix r2-G4, 27.09.2026;
       review S2-m3): the two the migration keeps on purpose - a Faint Prep promotion a later
       correction stood against, flags with no type and no row to carry them into - and one
       whose strip did not take. Read by `remnantType` alone, the check named none of them as
       flags on a token - flags with no row read as a missing row, to restore - and a token every
       browser holds kept saying which trace a GM had judged the murder's (tier 2, red on 40ac88d).
       A GM decides each (remnants.mjs `migrateRemnantsOnce`), so it is a conflict, not missing. */
    const flagged = traces.filter(token => !onToken.includes(token)
        && ANSWER_KEY_FLAGS.some(flag => flag in (token._source?.flags?.[MODULE_ID] ?? token.flags?.[MODULE_ID] ?? {})));
    if (flagged.length) add("tracesKept", "conflict", "DRPG.Case.row.tracesKept", { n: flagged.length, of: traces.length });
    // A row whose token is gone: unreachable (every read goes through a token), counted, never removed on its own.
    const onMap = new Set(traces.map(traceKey));
    const orphans = Object.keys(remnantStore.entries()).filter(key => !onMap.has(key)).length;
    if (orphans) add("traceOrphans", "info", "DRPG.Case.row.traceOrphans", { n: orphans });

    const bullets = allBullets();
    const unkeyed = bullets.filter(item => !bulletStore.has(item.uuid));
    const noAnswer = bullets.filter(item => bulletStore.has(item.uuid) && !bulletStore.get(item.uuid).realType);
    if (unkeyed.length) add("bullets", "missing", "DRPG.Case.row.bullets", { n: unkeyed.length, of: bullets.length });
    if (noAnswer.length) add("bulletsNoAnswer", "missing", "DRPG.Case.row.noAnswer", { n: noAnswer.length });

    const state = getSetting(SETTINGS.murderState) ?? {};
    const cast = incidentCast();
    if (state.active && !cast.killerId && !cast.victimId) add("incident", "missing", "DRPG.Case.row.incident");

    /* E05's two secrets the world still has evidence of (fix r1-G4; reviews M4 = S1-m5). An indirect
       murder whose killer, condition and trigger this browser lacks: projectMeta still says so, and
       `trapProjects` skips a trap with no trigger, so it never arms or fires. And a note a user's flag
       says is written that this browser does not hold (pre-session-note.mjs `notesMissing`). Both went
       unreported on a browser that lost its storage with no other GM to hand the rows back. */
    const meta = getSetting(SETTINGS.projectMeta) ?? {};
    const murders = Object.keys(meta).filter(id => meta[id]?.indirectMurder === true);
    const noSecrets = murders.filter(id => !projectSecretStore.has(id));
    if (noSecrets.length) add("projectSecrets", "missing", "DRPG.Case.row.projectSecrets", { n: noSecrets.length, of: murders.length });
    const { notesMissing } = await import("./pre-session-note.mjs");
    const lostNotes = notesMissing();
    if (lostNotes.length) add("notes", "missing", "DRPG.Case.row.notes", { n: lostNotes.length });

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
        // `shown`: what the window puts to the GM, which Keep and Clear act on and nothing else (DS-m7).
        add("mastermindCleared", "conflict", "DRPG.Case.row.mastermindCleared", { cleared: new Date(clearedAt).toLocaleString(),
            name: game.actors.get(pick)?.name ?? pick, picked: new Date(pickedAt).toLocaleString(), shown: { pick, clearedAt, pickedAt } });
    }

    /* THE MASTERMIND OUT OF EVERY POOL (E05 C15, 27.09.2026; audit S03-03, S10-12): Despair
       Flow's division is a world setting every player's browser reads, and the one student
       set to feed no pool stands out. mastermind.mjs `mastermindUnpooled`; the season
       checklist carries the same row. No name in it, as the checklist has none. */
    const { mastermindUnpooled } = await import("./mastermind.mjs");
    if (mastermindUnpooled()) add("nobodyPublic", "conflict", "DRPG.Season.hint.nobodyPublic");

    const since = caseMark().since;
    const holdsNothing = gmStoreHandles().every(h => !Object.keys(h.entries()).length && !(h.census()?.claimed));
    if (since && holdsNothing) add("neverHeld", "missing", "DRPG.Case.row.neverHeld", { date: new Date(since).toLocaleString() });

    for (const handle of gmStoreHandles()) {
        if (handle.legacyChanged()) add(`legacy.${handle.name}`, "conflict", "DRPG.Case.row.legacyChanged", { store: game.i18n.localize(`DRPG.Case.store.${handle.name}`) });
        const failed = handle.claimInfo()?.failed;
        if (failed) add(`claim.${handle.name}`, "conflict", "DRPG.Case.row.claimFailed", { store: game.i18n.localize(`DRPG.Case.store.${handle.name}`), error: failed });
    }

    add("unseen", "info", "DRPG.Case.row.unseen");
    const { left, notPrimary } = leftCounts(gmStoreHandles());
    if (left) add("left", "info", "DRPG.Case.row.left", { n: left });
    if (notPrimary) add("leftNotPrimary", "info", "DRPG.Case.row.leftNotPrimary", { n: notPrimary });
    // Old rows stamped ahead of the moment they were taken over: a clock that ran ahead (DS-m3).
    const clamped = gmStoreHandles().reduce((n, h) => n + (h.census()?.clamped ?? 0), 0);
    if (clamped) add("clamped", "info", "DRPG.Case.row.clamped", { n: clamped });
    const skew = Object.entries(gmStoreSkew());
    if (skew.length) add("skew", "info", "DRPG.Case.row.skew", { names: skew.map(([id, m]) => `${game.users.get(id)?.name ?? id} (+${m} min)`).join(", ") });
    const status = gmStoreStatus();
    add("bytes", status.total > 3 * 1024 * 1024 ? "conflict" : "info", "DRPG.Case.row.bytes",
        { stores: Math.round(status.stores / 1024), total: Math.round(status.total / 1024) });
    const mark = caseMark();
    add("lastBackup", "info", mark.lastBackupAt ? "DRPG.Case.row.lastBackup" : "DRPG.Case.row.neverBackedUp",
        { when: mark.lastBackupAt ? new Date(mark.lastBackupAt).toLocaleString() : "", who: mark.lastBackupBy ?? "" });

    const counts = {
        traces: { of: traces.length, missing: traceGaps.length, onToken: onToken.length, kept: flagged.length, orphans },
        bullets: { of: bullets.length, missing: unkeyed.length, noAnswer: noAnswer.length, fillable: Object.keys(fillsFromTraces()).length },
        projectSecrets: { of: murders.length, missing: noSecrets.length },
        notes: { missing: lostNotes.length }
    };
    return { world: game.world.id, hydrated: gmStoresHydrated(), rows, counts, missing: rows.filter(r => r.level === "missing").length };
}

/**
 * The old rows the claims left in this browser, `{ left, notPrimary }`: this world's
 * offers and fog rows a browser that was not the primary at its first open left for the
 * primary's (`notPrimary`), counted apart from what is another world's or no longer
 * part of this one's case (the round-2 review's R2-m2: one sentence called them all the
 * latter, and nothing pointed at the call that takes them). Pure over the handles.
 */
export function leftCounts(handles) {
    let left = 0, notPrimary = 0;
    for (const h of handles) {
        const census = h.census();
        const waiting = census?.reasons?.notPrimary ?? 0;
        notPrimary += waiting;
        left += (census?.left ?? 0) - waiting;
    }
    return { left, notPrimary };
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
        // What a backup can bring back; a trace whose key is on its token is moved instead (C-m14).
        const restorable = report.rows.some(r => r.level === "missing" && r.id !== "tracesOnToken");
        const movable = report.rows.some(r => r.id === "tracesOnToken");
        const choice = await DialogV2.wait({
            window: { title: game.i18n.localize("DRPG.Case.healthTitle") },
            classes: ["drpg-panel"],
            content: dialogContent(`<p>${esc(game.i18n.localize(report.missing ? "DRPG.Case.healthIntro" : "DRPG.Case.decideIntro"))}</p>
                <ul>${lines}</ul>${report.missing ? `<p class="notes">${esc(game.i18n.localize(restorable ? "DRPG.Case.healthNote" : "DRPG.Case.moveNote"))}</p>` : ""}`),
            buttons: [
                ...(restorable ? [{ action: "restore", label: game.i18n.localize("DRPG.Case.restoreFromFile") }] : []),
                ...(movable ? [{ action: "move", label: game.i18n.localize("DRPG.Case.moveTraces") }] : []),
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
        if (choice === "move") {
            const { migrateRemnants } = await import("./remnants.mjs");
            await migrateRemnants();
            healthOpen = false;
            return runHealthCheck();
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
            /* Closing the window keeps the pick as well: the default, and nothing is cleared
               unasked. What Keep and Clear act on is the pick the window showed (the review's
               DS-m7): read at the click, Keep stamped whatever the record held by then - a pick
               that arrived by merge while the window was open, which no GM had seen - and Clear
               cleared it. A record that changed is put to the GM again instead. */
            const shown = report.rows.find(r => r.id === "mastermindCleared")?.data?.shown;
            if (!sameDecision(shown, mastermindUndecided())) {
                healthOpen = false;
                return runHealthCheck();
            }
            const m = await import("./mastermind.mjs");
            const pick = game.actors.get(shown.pick);
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

/** Whether the upgrade day's clear still stands as the health window showed it: the same pick, clear and stamps. */
export function sameDecision(shown, now) {
    return Boolean(shown && now) && shown.pick === now.pick && shown.clearedAt === now.clearedAt && shown.pickedAt === now.pickedAt;
}

/**
 * ENTER THE CAST BY HAND (the design's 6.3; E04 C6): the health check's answer to
 * an incident running with no cast on this browser. The GM picks the killer, the
 * victim and a third if there was one; incident-store.mjs's `enterCast` writes them as a
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
 * with "a file of another world", each record store of another world's file, and
 * "restore anyway, under the reset's cut" as boxes the GM ticks, never defaults.
 */
export async function openRestoreDialog(text = null) {
    if (!game.user?.isGM) return null;
    const file = text ?? await chooseCaseFile();
    if (!file) return null;
    const preview = previewRestore(file);
    if (preview.refused) {
        ui.notifications.error(caseRefusalText(preview));
        return null;
    }
    const known = Object.entries(preview.stores).filter(([, c]) => !c.unknown);
    const rows = known.map(([name, c]) => {
        const store = storeLabel(name);
        const line = c.record ? game.i18n.format("DRPG.Case.previewRecord", { store })
            : game.i18n.format("DRPG.Case.previewStore", { store, add: c.add, refresh: c.refresh, kept: c.keptNewerHere, cut: c.beforeCut, remove: c.remove });
        const more = [c.clamped ? plural("DRPG.Case.previewClamped", { n: c.clamped }) : "",
            c.notThisWorld ? plural("DRPG.Case.previewNotThisWorld", { n: c.notThisWorld }) : ""].filter(Boolean);
        return `<li>${esc([line, ...more].join(" "))}</li>`;
    }).join("");
    const box = (name, label) => `<label class="drpg-checkbox"><input type="checkbox" name="${name}" /> ${esc(label)}</label>`;
    const records = known.filter(([, c]) => c.record).map(([name]) => name);
    const answer = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Case.restoreTitle") },
        classes: ["drpg-panel"],
        content: dialogContent(`<form><ul>${rows}</ul>
            ${preview.otherWorld ? box("otherWorld", game.i18n.format("DRPG.Case.otherWorld", { title: preview.world?.title ?? preview.world?.id ?? "?" })) : ""}
            ${records.map(name => box(`record-${name}`, game.i18n.format("DRPG.Case.otherWorldRecord", { store: storeLabel(name) }))).join("")}
            ${box("beforeCut", game.i18n.localize("DRPG.Case.beforeCut"))}
            <p class="notes">${esc(game.i18n.localize("DRPG.Case.restoreNote"))}</p></form>`),
        buttons: [
            { action: "restore", label: game.i18n.localize("DRPG.Case.restore"), default: true,
              callback: (e, b, d) => ({ otherWorld: Boolean(d.element.querySelector("[name=otherWorld]")?.checked),
                  beforeCut: Boolean(d.element.querySelector("[name=beforeCut]")?.checked),
                  records: records.filter(name => d.element.querySelector(`[name="record-${name}"]`)?.checked) }) },
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
        const marked = markUpgrade().then(() => markCaseSince()).then(() => settleTieStates());
        // The marks are the load's writes; the check's window waits for a GM, and the suite does not wait for it.
        marking = marked.catch(() => {});
        marked.then(() => runHealthCheck()).catch(err => error("The case health check could not run", err));
    });
    /* The upgrade day's clear is put to the primary whenever the record changes after
       that (the review's M1): the note, or a pick older than it, can arrive by merge from
       a GM who joins later, and the check at load has run by then. */
    Hooks.on("clientSettingChanged", key => {
        if (key !== `${MODULE_ID}.${SETTINGS.mastermind}` || healthOpen || !gmStoresHydrated() || !isPrimaryGm()) return;
        if (!mastermindUndecided()) return;
        runHealthCheck().catch(err => error("The case health check could not run", err));
    });
    /* THE RED LINE FOLLOWS THE ROWS (the review's C-m15). Another GM's restore reaches
       the primary by merge, and nothing checked again: the panel said the case was
       incomplete until the primary reloaded. While the last check found something
       missing, a change to a backed-up store's key checks again - quietly, no window -
       and the line goes once a check passes. A change that lands while one runs asks
       for one more: a restore's stores arrive one flush at a time. */
    let rechecking = false, again = false;
    const recheck = async () => {
        rechecking = true;
        try {
            do {
                again = false;
                const report = await gmStoreHealth();
                if (report && !healthOpen) lastHealth = report;
            } while (again && lastHealth?.missing);
        } catch (err) {
            error("The case health check could not run", err);
        } finally {
            rechecking = false;
        }
    };
    Hooks.on("clientSettingChanged", key => {
        if (!lastHealth?.missing || healthOpen || !isPrimaryGm()) return;
        if (!gmStoreHandles().some(h => h.spec.backup && key === `${MODULE_ID}.${h.spec.key}`)) return;
        if (rechecking) again = true;
        else void recheck();
    });
}
