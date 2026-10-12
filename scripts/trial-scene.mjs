/**
 * Danganronpa RPG - the trial hall: the table taken to it and back, and which of its tokens the trial shows.
 * ---------------------------------------------------------------------------
 * THE HALL IS SET ONCE, AND THE MODULE ONLY SHOWS AND HIDES IN IT (E13 C2,
 * 12.10.2026; plan-E13 3.3, decision D7, audit S06-57). The GM builds the hall
 * scene with a token for everybody who may stand in it, links it (rooms.mjs
 * `sceneRoles`), and chooses which of those tokens a trial shows. Opening the
 * trial shows the chosen ones and closing it hides them all; the module creates
 * no token in the hall, deletes none and moves none. The design before D7 placed
 * and cleared seats (A5's `ensureTrialTokens`, `clearTrialTokens`): gone with it.
 *
 * THE CAST is the hall's tokens whose actor is a "character" - a student,
 * Monokuma among them. An NPC token, a prop, a token with no actor, is never the
 * module's to show or hide: it stays as the GM left it.
 *
 * THE CHOICE IS THE GMS' (D7; plan-E13 1.x 2). The audit's fix named a flag on
 * the token, and a token's flags are written by whoever owns it - the student's
 * own player. So the choice is a row of a GM store (gm-stores.mjs
 * `trialCastStore`), `{ reveal, epoch }`, written only on a GM's client (the
 * store refuses anywhere else), and a row of another season reads as no row
 * (decision D12). Since E81 DZ6 (12.10.2026; the owner: "kto bierze udział, a
 * kogo nie przenosić") a row is an actor's, keyed `${hallId}.${actorId}`, and
 * the GM ticks actors, not tokens; a 1.2.74 row keyed by a hall token is read
 * for that token's actor until the primary GM's `ready` moves it to the actor's
 * key (`castRowsByActor`, `tidyTrialHall`). A token with no row is decided by `defaultReveal`: Monokuma
 * shown, a student a player owns shown - the dead and a Monocub too (the owner's
 * answer Q-E13-1 a, 09.10.2026: the dead stand in the hall under the dead
 * overlay, immovable by the corpse veto), a student nobody plays hidden (a test
 * token, a hidden culprit's spare), and the second token of one actor hidden
 * and named to the GMs.
 *
 * WHO WRITES `hidden`. The reveal and the hide are one scene update by the GM
 * whose phase change opened or closed the trial (clock.mjs `reconcilePhase`).
 * A player who owns a hall token may be able to write its `hidden` themselves:
 * whether Foundry v14 lets an owner do that is not measured (LIVE-E13-08) - the
 * headless harness lets an owner's update through, so the put-back below was
 * measured only there. The primary GM puts a player's change back to what the
 * GMs last wrote (`castPutBack`, `castHeld`) and tells the GMs; a GM's change
 * stands, and does not change the stored choice. A cast token a player makes in
 * the hall is hidden and told (`watchCastCreated`), and one a player deletes there
 * is told (`watchCastDeleted`).
 *
 * `hidden` IS A DRAW STATE, NOT A SECRET. Every client holds every token of the
 * hall in the scene's data, hidden or not (known-leaks `foundry-hidden-tokens`),
 * so nothing here may rest on a player not knowing who is in the hall.
 *
 * Before this file nothing showed or hid the hall's cast: scenario 41 as E13 C2 left it, run on
 * 12.10.2026 against C1's code, failed a2, a3, c1, d1, d2 and e1 (9/15) - entering the trial showed
 * nobody, leaving it hid nobody the GM had shown by hand, and p1's hide stood. Those are the rows
 * this file turns.
 *
 * THE TABLE FOLLOWS THE PHASE (E13 C3, 12.10.2026; plan-E13 3.2 and 3.4, audit S06-57, doneWhen 1).
 * Every road into and out of the Class Trial - Start the Class Trial, `closeTrial` and so End the
 * trial, the chapter end and the API, `setPhase` and so `startFloor`, the console's phase select,
 * Edit campaign, the season reset's clock step - writes the phase through clock.mjs `setClock`,
 * and `setClock` runs `reconcilePhase` when the phase really moved. Its last step is `followPhase`
 * here, and nothing else in the module activates a scene (R113 reads that in the source): into
 * the trial the hall is activated, so Foundry moves every connected browser to it, GMs included;
 * out of it the school is. Until this commit the trial opened and closed on whatever scene each
 * browser showed - scenario 41 a1, c1, d1, d2, e1, f1, g1 and j1 read the table left where it was, on
 * 12.10.2026 at C2's tree, and the GM activated the hall by hand. A second debate in one trial and
 * the Final Trial do not move the phase, so they move nobody: the Final Trial is held in the same
 * hall (D7).
 *
 * Out of the trial the table goes to the linked school; with none linked, or its scene gone, to
 * the scene that was active when the trial opened (`trialReturnTo`, a flag on the hall written on
 * the way in); with neither, nowhere - the GMs are told and nothing changes, the hall's cast
 * included (the owner's answer Q-E13-1 b, 09.10.2026).
 *
 * THE LIVING GO WHERE THE GM SENDS THEM (E13 C3b, 12.10.2026; the owner's answer f of 09.10 and
 * items 1, 3 and 6 of 10.10). End the trial asks for a room of a place scene (trial-floor-ui.mjs
 * `endClassTrial`, with no way to skip it), and `closeTrial` hands the choice here (`setTrialExit`)
 * right before it writes the phase; `leaveTrialScene` takes it once, activates that scene in place
 * of the school, hides the hall's cast as before, and gathers into the room the living students
 * (`returnTheLiving`): the body's gather's own rule, read as the GMs hold each actor - a Monocub
 * walks, the dead and Monokuma stay. Nothing in the hall moves. The chapter end and every other road
 * hand no choice and move nobody, as before this commit.
 *
 * FROM EVERY SCENE WITH ROOMS (E13 fix r1-F1, 12.10.2026; the owner's item 1 of 10.10, "moved too, if
 * it can be done"; review r1 goal Af-1). C3b moved only the living already on the chosen scene and
 * named the rest, calling a move across scenes unmeasured. It is built now and measured headless: a
 * living student with no token on the chosen scene has the token the module reads as where they stand
 * (movement.mjs `locateActor`: place scenes only, so never the hall) carried over - a copy made there
 * and the old token deleted, by call-world.mjs `carryAcross`, so this file still creates and deletes
 * nothing (D7's line, R432) - and then gathered into the room with the rest. Which token, for a
 * student with tokens on two scenes with rooms: `locateActor`'s, the one every rule already reads as
 * theirs; the fix list asked for "the one on the scene they last stood on lawfully", and no record
 * answers that (review r2 cor F): movement.mjs `gmHistory` stamps a time, but only on the places a GM
 * moved a token from, in one GM client's memory and gone at its reload; nothing times a player's
 * lawful move, and `studentStandings` holds no time. Their other tokens stay. A living student the
 * return cannot move - standing only on a scene with no rooms, a player's student standing only in
 * the hall or nowhere, or one whose copy failed or was taken back - stays where they stood and is
 * named (`leftBehind`; review r1 cor A). Foundry's own `teleportTokens` across scenes, and the camera
 * and selection a player has on the copy, are LIVE-E13-10.
 *
 * THE WHISPER NAMES EVERY STUDENT LEFT ON TWO SCENES (E13 fix r2-H1, 12.10.2026; review r2 cor A, cor B
 * and sec S2-2). r1-F1 named the carried with a token left elsewhere, and nobody else: a living student
 * with a hidden token on the chosen scene counts as there (`leftBehind`'s `here`, which both tier-2
 * fences rely on, so it stays), the gather took that hidden token into the room, and the shown one on
 * another scene stayed unnamed - tier 2 "End the trial never leaves a living student without a token"
 * read the return answer nobody left on two scenes at 36f559d (the reading is cut before the
 * whisper, which took its names from that answer). Now, after the gather, every living student with a token on
 * the chosen scene and another on a scene that is neither it nor the hall is named (`standingTwice`),
 * apart when every token of theirs in the room is hidden and one elsewhere is shown. A carry whose
 * copy could not be taken back leaves the student on both, named too (call-world.mjs `carryAcross`);
 * one stopped between its create and its delete, the GM gone, is named at the next GM's load
 * (`nameUnfinishedCarries`).
 *
 * A browser still loading when the hall is activated only warns and stays where it was (A5's
 * reading of Foundry, not read in v14: LIVE-E13-02). So a player's browser puts its own view
 * right once, on its first `canvasReady` after a load (`selfRepair`; the owner's answer Q-E13-1 c,
 * 09.10.2026): the hall in the trial, out of it the scene a GM made active, and only when the scene
 * it shows is not that one. Once, so a GM's later pull of one player to another scene stands;
 * never on a GM's browser. The view decides no rule (rooms.mjs `CAMERA_READERS`).
 *
 * THE GM LINKS THE SCENES AND CHOOSES THE CAST IN A WINDOW (E13 C5): Room Setup's last tab, drawn,
 * read and applied by the functions under "THE SCENES TAB" below.
 *
 * START SAYS WHERE THE TABLE GOES, AND A TRIAL HAS TWO DOORS THAT KEEP THE PHASE (E13 C6): the Start
 * window's lines and the console's "Show the hall" / "Back to school", under "THE START WINDOW AND
 * THE CONSOLE" below.
 */

import { MODULE_ID, FLAGS } from "./config.mjs";
import { SETTINGS, seasonEpoch, getClock, isDeadForGm } from "./settings.mjs";
import { trialCastStore, answerKeysOpen } from "./gm-stores.mjs";
import { trialScene, schoolScene, viewedScene, isPlaceScene, roomNames, roomRegions, isRoom, sceneRoles, forgetSceneRoles } from "./rooms.mjs";
import { fogOffPatch } from "./fog.mjs";
import { judgedFor, flagsHeldNow } from "./sheet-audit.mjs";
import { gatherEveryone, carryAcross, clearCarriedFrom, CARRIED_FROM } from "./call-world.mjs";
import { isPrimaryGm, whisperToGms, ownerIdsOf, plural, esc, log, error } from "./utils.mjs";

/** The hall's flag naming the scene that was active when the trial opened (`enterTrialScene`). */
export const TRIAL_RETURN_FLAG = "trialReturnTo";

/*
 * Where the GM sent the table at End the trial, `{ sceneId, room }`, for ONE close (E13 C3b). In
 * this client's memory only, written to no document: `closeTrial` sets it on the GM who pressed
 * the button, right before the phase write whose `reconcilePhase` runs `leaveTrialScene` on that
 * same client, and drops it after the write whatever happened - so the chapter end, the console's
 * phase select or a reload later finds none and moves nobody.
 */
let trialExit = null;

/**
 * Hold `{ sceneId, room }` for the next `leaveTrialScene` on this client, or with anything else
 * drop what is held. Only on a GM, and only a room of a place scene (`roomNames`; the hall holds
 * none) - E12 C5's rule for the gather, asked before the phase moves rather than after. Answers
 * what is held now, or null.
 */
export function setTrialExit(exit = null) {
    const scene = exit && game.user?.isGM ? game.scenes?.get?.(exit.sceneId) ?? null : null;
    const held = Boolean(scene) && isPlaceScene(scene) && roomNames(scene).includes(exit.room);
    trialExit = held ? { sceneId: scene.id, room: exit.room } : null;
    return trialExitHeld();
}

/** What `setTrialExit` holds on this client, as a copy, or null. */
export function trialExitHeld() {
    return trialExit ? { ...trialExit } : null;
}

/** The options every write of this file carries: a mark to read in a log, never a pass (see `castPutBack`). */
function castWrite() {
    return { [MODULE_ID]: { trialCast: true } };
}

/**
 * The store's key for one actor's choice in one hall (E81 DZ6): `${hallId}.${actorId}`. Until 1.2.74 the
 * second half was a hall token's id; such a row is read through `castRow`'s `legacyTokenId` and moved by
 * `tidyTrialHall`.
 */
export function castKey(sceneId, actorId) {
    return `${sceneId}.${actorId}`;
}

/** Every actor the cast can hold, ticked or not: each "character" of the world, a student or Monokuma, in the world's order. */
export function castActors() {
    return game.actors?.filter?.(actor => actor.type === "character") ?? [];
}

/** Whether a hall token is the module's to show and hide: its actor is a student or Monokuma. */
export function isCastToken(tokenDoc) {
    return game.actors?.get?.(tokenDoc?.actorId)?.type === "character";
}

/** The hall's cast: its tokens whose actor is a "character". */
export function castTokens(scene) {
    return scene?.tokens?.filter?.(isCastToken) ?? [];
}

/**
 * One actor's stored choice, `{ reveal }`, or null: no row, a row of another season, or a row that
 * says nothing. The actor's row first; failing that, when `legacyTokenId` is given (the actor's first
 * token in the hall), the 1.2.74 row of that token (E81 DZ6) - so a world not yet tidied, or a 1.2.74
 * backup restored after its `ready` (gm-store.mjs `mergeIn`), reads as it was chosen. Reads only what
 * it is handed (R116 asks it of plain rows).
 */
export function castRow(rows, sceneId, actorId, epoch = seasonEpoch(), legacyTokenId = null) {
    const read = key => {
        const row = rows?.[key];
        return row && row.epoch === epoch && typeof row.reveal === "boolean" ? { reveal: row.reveal } : null;
    };
    return read(castKey(sceneId, actorId)) ?? (legacyTokenId ? read(castKey(sceneId, legacyTokenId)) : null);
}

/** The hall's stored choice this season, `{ actorId: reveal }` over `castActors`: the actors with no row are absent. */
export function readTrialCast(scene, { rows = trialCastStore.entries(), epoch = seasonEpoch() } = {}) {
    const out = {};
    if (!scene?.id) return out;
    for (const actor of castActors()) {
        const row = castRow(rows, scene.id, actor.id, epoch, scene.tokens?.find?.(token => token.actorId === actor.id)?.id ?? null);
        if (row) out[actor.id] = row.reveal;
    }
    return out;
}

/**
 * Store the GMs' choice for the hall's cast: `{ actorId: true | false | null }`, null dropping the row
 * (back to `defaultReveal`) and the 1.2.74 row of the actor's first hall token with it, which `castRow`
 * would read otherwise. An id that is not a "character" actor of this world is skipped (E81 DZ6; until
 * then an id that was not a token of the hall). A GM's client only - the store refuses anywhere else.
 * Shows and hides nothing: the choice is read when the trial opens. Answers whether anything was written.
 */
export async function saveTrialCast(scene, choice = {}) {
    if (!game.user?.isGM || !scene?.id) return false;
    const epoch = seasonEpoch();
    const rows = {};
    const gone = [];
    for (const [actorId, reveal] of Object.entries(choice ?? {})) {
        if (game.actors?.get?.(actorId)?.type !== "character") continue;
        if (reveal === null) {
            gone.push(castKey(scene.id, actorId));
            const legacy = scene.tokens?.find?.(token => token.actorId === actorId)?.id;
            if (legacy && trialCastStore.has(castKey(scene.id, legacy))) gone.push(castKey(scene.id, legacy));
        } else if (typeof reveal === "boolean") rows[castKey(scene.id, actorId)] = { reveal, epoch };
    }
    if (Object.keys(rows).length) await trialCastStore.patchMany(rows);
    if (gone.length) await trialCastStore.dropMany(gone);
    return Boolean(Object.keys(rows).length || gone.length);
}

/**
 * The 1.2.74 rows moved to their actors (E81 DZ6), decided before anything is written: `mapped`, the
 * rows to fill by actor key, and `old`, the token-keyed keys to drop. Handed the store's rows and, by
 * scene id, the scene's cast tokens `{ id, actorId }` in the hall's order. A key whose second half is a
 * token of its scene is old; its row goes to that token's actor only when it is the actor's FIRST token
 * there, the one token whose row the trial ever read (`castShows` reads no row for a second one), with
 * its `reveal` and its season as they were. Any other key - an actor's already, or of a scene not
 * handed - is left as it is, so a second run finds nothing. Pure (R500 asks it of plain rows).
 */
export function castRowsByActor(rows, scenes) {
    const mapped = {};
    const old = [];
    for (const [key, row] of Object.entries(rows ?? {})) {
        const dot = key.indexOf(".");
        const tokens = dot > 0 ? scenes?.[key.slice(0, dot)] : null;
        const token = tokens?.find?.(t => t.id === key.slice(dot + 1));
        if (!token) continue;
        old.push(key);
        if (tokens.find(t => t.actorId === token.actorId) !== token || typeof row?.reveal !== "boolean") continue;
        mapped[castKey(key.slice(0, dot), token.actorId)] = { reveal: row.reveal, epoch: row.epoch };
    }
    return { mapped, old };
}

/**
 * The cast's rows moved from tokens to actors once (E81 DZ6), on the primary GM's `ready` after the
 * store has heard the other GMs: `castRowsByActor` over every scene a row names, then one fill that
 * never overwrites a row already written by actor (`fillOnly`) and one drop of the old keys. A second
 * run maps nothing and writes nothing. Answers `{ mapped, dropped }`, or null off the primary.
 */
export async function tidyTrialHall() {
    if (!game.user?.isGM || !isPrimaryGm()) return null;
    await trialCastStore.whenHydrated();
    const rows = trialCastStore.entries();
    const scenes = {};
    for (const key of Object.keys(rows)) {
        const sceneId = key.split(".")[0], scene = game.scenes?.get?.(sceneId);
        if (scene && !(sceneId in scenes)) scenes[sceneId] = castTokens(scene).map(token => ({ id: token.id, actorId: token.actorId }));
    }
    const { mapped, old } = castRowsByActor(rows, scenes);
    if (Object.keys(mapped).length) await trialCastStore.patchMany(mapped, { fillOnly: true });
    if (old.length) await trialCastStore.dropMany(old);
    return { mapped: Object.keys(mapped).length, dropped: old.length };
}

/**
 * Whether a token with no stored row is shown (plan-E13 3.3; Q-E13-1 a). A second token of one actor
 * is hidden; otherwise Monokuma is shown and a student a player owns is shown, the dead and a
 * Monocub among them - only the `monokuma` flag decides of the three the plan named (census
 * `SHEET trial-scene.mjs#readCast`). Plain arguments, so R116 asks it of plain objects.
 */
export function defaultReveal({ monokuma = false, player = false, second = false } = {}) {
    if (second) return false;
    return Boolean(monokuma) || Boolean(player);
}

/**
 * The cast as the GMs hold it, read in ONE synchronous pass (H3): per token its id, name, `hidden`,
 * the actor's `monokuma` flag as the primary holds it (sheet-audit.mjs `flagsHeldNow` - a student's
 * flag a player's browser could have written since the last judgement reads as judged), whether a
 * player owns the actor, and whether an earlier token of the hall stands for the same actor.
 */
export function readCast(scene) {
    const seen = new Set();
    return castTokens(scene).map(token => {
        const actor = game.actors.get(token.actorId);
        const held = flagsHeldNow(actor);
        const second = seen.has(token.actorId);
        seen.add(token.actorId);
        return {
            id: token.id, name: token.name ?? actor?.name ?? token.id, actorId: token.actorId,
            hidden: Boolean(token.hidden), monokuma: Boolean(held.getFlag(MODULE_ID, FLAGS.monokuma)),
            player: ownerIdsOf(actor).length > 0, second
        };
    });
}

/**
 * The cast as the GMs hold it, per actor (E81 DZ6): every `castActors` actor with its id, its name, the
 * `monokuma` flag as the primary holds it and whether a player owns it - `readCast`'s two facts, read the
 * same way, in ONE synchronous pass (H3). The cast picker's rows, so an actor is ticked or not whether
 * or not the hall holds a token of it.
 */
export function readCastActors() {
    return castActors().map(actor => ({
        id: actor.id, name: actor.name ?? actor.id,
        monokuma: Boolean(flagsHeldNow(actor).getFlag(MODULE_ID, FLAGS.monokuma)), player: ownerIdsOf(actor).length > 0
    }));
}

/**
 * What one open or close changes: `{ diff, seconds }`. `diff` holds `{ _id, hidden }` for every cast
 * token whose `hidden` differs from what it should be - on the way in the stored row, else
 * `defaultReveal`; on the way out hidden - and nothing else, so a second run on the same hall finds
 * an empty diff. `seconds` names the second tokens of one actor (reported on the way in). Pure.
 */
export function castDiff(cast, { reveal, sceneId, rows = {}, epoch = seasonEpoch() } = {}) {
    const diff = [];
    const seconds = [];
    for (const token of cast ?? []) {
        if (token.second) seconds.push(token.id);
        const show = reveal ? castShows(token, { sceneId, rows, epoch }) : false;
        if (Boolean(token.hidden) !== !show) diff.push({ _id: token.id, hidden: !show });
    }
    return { diff, seconds };
}

/**
 * Whether the way in shows one cast token (`readCast`'s row): the GMs' stored row of this season for
 * its actor (E81 DZ6; the token's own 1.2.74 row as `castRow`'s fallback, this being the actor's first
 * token), else `defaultReveal` - and a second token of one actor never by a row. Pure: `castDiff` asks
 * it, and so does `trialSceneReport` (`castShownOnEntry`).
 */
export function castShows(token, { sceneId, rows = {}, epoch = seasonEpoch() } = {}) {
    const row = token.second ? null : castRow(rows, sceneId, token.actorId, epoch, token.id);
    return row ? row.reveal : defaultReveal(token);
}

/**
 * The hall's cast tokens the way in would show now, as `readCast` reads them (one synchronous pass,
 * H3) against the store this GM holds: `trialSceneReport`'s `shown` (the Start window's count until E81
 * DZ6, which put the ticks in that window instead). A store not yet hydrated on
 * this GM counts without the GMs' rows, while the entry would then show nobody and tell the GMs
 * (`applyTrialCast`; read in the code, not measured) - a count, never a decision.
 */
export function castShownOnEntry(scene) {
    if (!scene?.tokens) return [];
    const rows = trialCastStore.entries();
    return readCast(scene).filter(token => castShows(token, { sceneId: scene.id, rows }));
}

/**
 * Show the cast (`reveal`) or hide it, on a GM's client: one `updateEmbeddedDocuments` with only the
 * rows that change, no create, no delete, no position (D7). The way in waits for the store as an
 * answer key does (gm-stores.mjs `answerKeysOpen`, at most `TIMING.gmStoreOpenMs`): a store still not
 * hydrated could be missing an untick, so then nobody is shown and the GMs are told - showing a
 * hidden player is the one mistake a GM cannot take back by hand in time. Hiding needs no choice.
 * Answers `{ shown, hidden, seconds }` (token ids), or null when nothing was judged.
 */
export async function applyTrialCast(scene, { reveal = true, open = () => answerKeysOpen({ store: trialCastStore }) } = {}) {
    if (!game.user?.isGM || !scene?.tokens) return null;
    if (reveal && await open() !== "open") {
        await whisperToGms(`<p>${game.i18n.localize("DRPG.TrialScene.castUnavailable")}</p>`);
        return null;
    }
    const cast = readCast(scene);
    const { diff, seconds } = castDiff(cast, { reveal, sceneId: scene.id, rows: trialCastStore.entries() });
    if (diff.length) await scene.updateEmbeddedDocuments("Token", diff, castWrite());
    if (reveal && seconds.length) {
        const names = seconds.map(id => esc(cast.find(t => t.id === id)?.name ?? id)).join(", ");
        await whisperToGms(`<p>${game.i18n.format("DRPG.TrialScene.duplicateToken", { names })}</p>`);
    }
    return {
        shown: diff.filter(d => !d.hidden).map(d => d._id),
        hidden: diff.filter(d => d.hidden).map(d => d._id),
        seconds
    };
}

export const revealTrialTokens = (scene = trialScene()) => applyTrialCast(scene, { reveal: true });
export const hideTrialTokens = (scene = trialScene()) => applyTrialCast(scene, { reveal: false });

/**
 * The phase's step for the table, called last by clock.mjs `reconcilePhase` on the GM whose
 * `setClock` moved the phase: into the trial `enterTrialScene`, out of it `leaveTrialScene`. The
 * one caller of either (R113).
 */
export async function followPhase(from, to) {
    if (from === to) return null;
    if (to === "classTrial") return enterTrialScene();
    if (from === "classTrial") return leaveTrialScene();
    return null;
}

/**
 * The scene the table left for the trial, or null: the hall's `trialReturnTo` flag, when it names
 * a scene that still exists and is not the hall.
 */
export function trialReturnTo(hall = trialScene()) {
    const id = hall?.getFlag?.(MODULE_ID, TRIAL_RETURN_FLAG);
    const scene = typeof id === "string" && id ? game.scenes?.get?.(id) ?? null : null;
    return scene && scene.id !== hall.id ? scene : null;
}

/**
 * Where leaving the trial takes the table (Q-E13-1 b): the linked school, else the scene the trial
 * was opened from, else null - and never the hall. Plain arguments (R115 asks it of plain objects).
 */
export function leaveDestination({ school = null, returnTo = null, hall = null } = {}) {
    for (const scene of [school, returnTo]) if (scene?.id && scene.id !== hall?.id) return scene;
    return null;
}

/**
 * The students a player plays who have no token in the hall, so the trial cannot show them: the
 * students `defaultReveal` shows, the dead among them (Q-E13-1 a). By name, in the world's order.
 */
export function studentsWithoutHallToken(hall) {
    const here = new Set((hall?.tokens?.contents ?? []).map(token => token.actorId));
    return game.actors.filter(actor => actor.type === "character" && !here.has(actor.id) && ownerIdsOf(actor).length > 0);
}

/**
 * Into the trial, on a GM: note the scene the table leaves (the hall's `trialReturnTo`), show the
 * cast, tell the GMs whom the hall has no token for, then activate the hall - the cast is shown
 * before anybody arrives. No hall linked, nothing. Answers what it did, or null.
 */
export async function enterTrialScene(hall = trialScene()) {
    if (!game.user?.isGM || !hall) return null;
    const left = game.scenes?.active ?? null;
    if (left && left.id !== hall.id) await hall.setFlag(MODULE_ID, TRIAL_RETURN_FLAG, left.id);
    const cast = await revealTrialTokens(hall);
    const missing = studentsWithoutHallToken(hall);
    if (missing.length) {
        const names = missing.map(actor => esc(actor.name)).join(", ");
        await whisperToGms(`<p>${plural("DRPG.TrialScene.missingTokens", { n: missing.length, names })}</p>`);
    }
    if (hallIsDark(hall)) await whisperToGms(`<p>${game.i18n.localize("DRPG.TrialScene.hallDark")}</p>`);
    const activated = !hall.active;
    if (activated) await hall.activate();
    return { hall: hall.id, left: left?.id ?? null, cast, missing: missing.map(actor => actor.id), activated };
}

/**
 * Out of the trial, on a GM: activate the scene the GM chose at End the trial (`setTrialExit`,
 * taken once - on the first line, so a close that returns early leaves nothing held either), else
 * the one `leaveDestination` names, then hide the hall's cast, then gather the living into the
 * chosen room. With nowhere to go the GMs are told and nothing changes - the table stays in the
 * hall with its cast shown, as the trial left it (Q-E13-1 b). No hall linked, nothing.
 */
export async function leaveTrialScene(hall = trialScene()) {
    const exit = trialExit;
    trialExit = null;
    if (!game.user?.isGM || !hall) return null;
    const chosen = exit && exit.sceneId !== hall.id ? game.scenes?.get?.(exit.sceneId) ?? null : null;
    const destination = chosen ?? leaveDestination({ school: schoolScene(), returnTo: trialReturnTo(hall), hall });
    if (!destination) {
        await whisperToGms(`<p>${game.i18n.localize("DRPG.TrialScene.noSchool")}</p>`);
        return null;
    }
    const activated = !destination.active;
    if (activated) await destination.activate();
    const cast = await hideTrialTokens(hall);
    const gathered = chosen ? await returnTheLiving(chosen, exit.room, hall) : null;
    return { destination: destination.id, cast, activated, gathered };
}

/**
 * The living students into the room `room` of `scene`, after the trial (the owner's f, 09.10, and item 1 of
 * 10.10): first the living with no token there carried over from the scene with rooms they stand on
 * (`carryTheLiving`), then the body's gather (call-world.mjs `gatherEveryone`) on that scene - random points in
 * the room, as a body's gather places them - with each actor read as the GMs hold it (`flagsHeldNow`, once the
 * judgements in flight are in: `judgedFor`) and, when the region cannot teleport, the room's box for the
 * fallback. Called from `leaveTrialScene` alone, after the hall's cast is hidden, so a hall token is never among
 * the moved (R436). Then one whisper to the GMs: how many went, the living the return could not move
 * (`leftBehind`), those a carry left on both scenes, and the living left with a token on another scene, the ones
 * whose every token in the room is hidden apart (`standingTwice`). Answers
 * `{ room, moved, carried, left, others, hidden, twice }`, the last five by actor id.
 */
export async function returnTheLiving(scene, room, hall = trialScene()) {
    await judgedFor(...game.actors.filter(actor => actor.type === "character").map(actor => actor.id));
    const { carried, twice } = await carryTheLiving(scene, room, hall);
    const moved = await gatherEveryone(room, scene, { held: flagsHeldNow, box: true });
    const left = await leftBehind(scene, hall);
    const { others, hidden } = await standingTwice(scene, hall, twice);
    const names = actors => actors.map(actor => esc(actor.name)).join(", ");
    const lines = [plural("DRPG.Floor.endTrialMoves", { n: moved, room: esc(room) })];
    if (left.length) lines.push(plural("DRPG.TrialScene.notMoved", { n: left.length, names: names(left) }));
    if (twice.length) lines.push(plural("DRPG.TrialScene.carryUnfinished", { n: twice.length, names: names(twice) }));
    if (hidden.length) lines.push(plural("DRPG.TrialScene.hiddenHere", { n: hidden.length, names: names(hidden) }));
    if (others.length) lines.push(plural("DRPG.TrialScene.tokensStay", { n: others.length, names: names(others) }));
    await whisperToGms(lines.map(line => `<p>${line}</p>`).join(""));
    const ids = actors => actors.map(actor => actor.id);
    return { room, moved, carried: ids(carried), left: ids(left), others: ids(others), hidden: ids(hidden), twice: ids(twice) };
}

/**
 * The living with no token on `scene` whose place is another scene with rooms, each carried into `room` there
 * (call-world.mjs `carryAcross`): the token `locateActor` reads as where they stand, which is never the hall's
 * (no rooms) nor one on a scene with no rooms. Answers `{ carried, twice }`, in the world's order: the carried, and
 * the students a carry left on both scenes - its copy could not be taken back. A student whose carry was taken back
 * is in neither, and `leftBehind` names them after.
 */
async function carryTheLiving(scene, room, hall) {
    const carried = [], twice = [];
    const region = roomRegions(scene, room)[0];
    if (!region) return { carried, twice };
    const { locateActor } = await import("./movement.mjs");
    for (const actor of await leftBehind(scene, hall)) {
        const place = locateActor(actor);
        if (!place || place.scene.id === scene.id || place.scene.id === hall?.id) continue;
        const done = await carryAcross(place.tokenDoc, scene, region);
        if (done?.twice) twice.push(actor);
        else if (done) carried.push(actor);
    }
    return { carried, twice };
}

/**
 * The living students with no token on `destination` the return owes an answer to (the owner's item 1 of 10.10):
 * living by the gather's own rule as the GMs hold them - not Monokuma, not dead unless a Monocub - with a token on
 * any scene but the destination and the hall, or played by a player (`ownerIdsOf`, as `studentsWithoutHallToken`
 * reads it) with none there. Before the return carries them these are whom it tries; after, whom it could not
 * move. A student standing only on a scene with no rooms was neither moved nor named until review r1 (cor A):
 * the scenes were read through `isPlaceScene`. A student nobody plays whose only token is in the hall is not
 * named: hiding the cast is what the hall gets. In the world's order.
 */
export async function leftBehind(destination, hall = trialScene()) {
    const { isMonokuma } = await import("./monokuma.mjs");
    const { isMonocub } = await import("./monocub.mjs");
    const actorsOn = scene => [...(scene?.tokens ?? [])].map(token => token.actorId);
    const here = new Set(actorsOn(destination));
    const elsewhere = new Set(game.scenes.filter(scene => scene.id !== destination.id && scene.id !== hall?.id).flatMap(actorsOn));
    return game.actors.filter(actor => {
        if (actor.type !== "character" || here.has(actor.id)) return false;
        if (!elsewhere.has(actor.id) && !ownerIdsOf(actor).length) return false;
        const held = flagsHeldNow(actor);
        return !isMonokuma(held) && !(isDeadForGm(held) && !isMonocub(held));
    });
}

/**
 * After the return's gather, the living with a token on `destination` and another on a scene that is neither it nor
 * the hall (review r2 cor A), living by the gather's own rule as the GMs hold them, as `leftBehind` reads it -
 * `flagsHeldNow(actor)` once per student in one synchronous pass. Answers `{ others, hidden }`: `hidden` those whose
 * every token on `destination` is hidden while one elsewhere is shown - a player sees only the one left behind -
 * and `others` the rest; the students in `skip` (a carry left on both, named on their own line) in neither.
 */
export async function standingTwice(destination, hall = trialScene(), skip = []) {
    const { isMonokuma } = await import("./monokuma.mjs");
    const { isMonocub } = await import("./monocub.mjs");
    const byActor = scenes => {
        const tokens = new Map();
        for (const scene of scenes) for (const token of scene.tokens ?? []) tokens.set(token.actorId, [...(tokens.get(token.actorId) ?? []), token]);
        return tokens;
    };
    const here = byActor([destination]), away = byActor(game.scenes.filter(scene => scene.id !== destination.id && scene.id !== hall?.id));
    const skipped = new Set(skip.map(actor => actor.id));
    const others = [], hidden = [];
    for (const actor of game.actors) {
        if (actor.type !== "character" || skipped.has(actor.id) || !here.has(actor.id) || !away.has(actor.id)) continue;
        const held = flagsHeldNow(actor);
        if (isMonokuma(held) || (isDeadForGm(held) && !isMonocub(held))) continue;
        const veiled = here.get(actor.id).every(token => token.hidden) && away.get(actor.id).some(token => !token.hidden);
        (veiled ? hidden : others).push(actor);
    }
    return { others, hidden };
}

/**
 * At a GM's load (E13 fix r2-H1, 12.10.2026; review r2 sec S2-2 b and cor B): a carry out of the trial stopped
 * between its create and its delete - the carrying GM's browser closed or reloaded - left a copy marked with its
 * source (call-world.mjs `CARRIED_FROM`) beside the token it was made from, and no whisper. Every GM's `ready` reads
 * the marks: the students whose source still stands are named to the GMs (`carryUnfinished`), and a mark whose
 * source is gone is taken off. Each GM's load, not the primary's alone, so the GM who carried is told when it comes
 * back; a mark is a token flag its player may write, and here it only names or is taken off. Answers
 * `{ twice, cleared }` by token id, or null on a player's client.
 */
export async function nameUnfinishedCarries() {
    if (!game.user?.isGM) return null;
    const twice = [], cleared = [];
    for (const scene of game.scenes ?? []) {
        for (const token of scene.tokens ?? []) {
            const source = token.getFlag?.(MODULE_ID, CARRIED_FROM);
            if (typeof source !== "string") continue;
            const [sceneId, tokenId] = source.split(".");
            (game.scenes.get(sceneId)?.tokens?.get?.(tokenId) ? twice : cleared).push(token);
        }
    }
    for (const token of cleared) await clearCarriedFrom(token).catch(err => error(`Could not take the carry's mark off "${token.name}"`, err));
    if (twice.length) {
        const names = twice.map(token => esc(token.actor?.name ?? token.name)).join(", ");
        await whisperToGms(`<p>${plural("DRPG.TrialScene.carryUnfinished", { n: twice.length, names })}</p>`);
    }
    return { twice: twice.map(token => token.id), cleared: cleared.map(token => token.id) };
}

/*
 * THE START WINDOW AND THE CONSOLE SAY WHERE THE TABLE GOES (E13 C6, 12.10.2026; plan-E13 C6, decision
 * D8, doneWhen 4). Start the Class Trial said the phase moves and the trial is announced, and nothing
 * about the scene: since C3 every browser is taken to the hall, and a GM read that only on the screen
 * after the click. Its window now names the hall, or that no hall is linked and the table stays,
 * (until E81 DZ6 with how many of its tokens the trial would show; since then with who takes part,
 * the cast picker's ticks), and the table's rule of D8 - the dead listen but do not speak in the trial - as one sentence beside the
 * button. Before this the window said neither: R437 and scenario 41 k1 read it red at C5's tree.
 *
 * THE TWO DOORS INSIDE A TRIAL. A GM who wants the school back for a moment in the middle of a trial
 * (a flashback, a scene to look at again) had only Foundry's own activation, which takes the table
 * there with the hall's cast still shown and nothing noted. `showSchool` is `leaveTrialScene` and
 * `showCourtroom` is `enterTrialScene`, with the phase left where it is: the cast hidden on the way out
 * and shown again by the GMs' choice on the way back, so the hall is never shown away from the trial
 * (the Scenes tab keeps the same rule, `applyScenesTab`). Only a GM, only in a running trial, only
 * with a hall linked; the console offers the one that applies (`tableDoor`). These two and
 * `followPhase` are the only callers of the two (R113).
 */

/**
 * The Start window's two lines (E13 C6): `table`, where the table goes - the hall by name, or that
 * none is linked - and `rule`, the table's rule of D8. The count of tokens shown went with E81 DZ6:
 * the window holds the ticks it would have counted, and a count drawn once goes stale as they change.
 * Pure over `{ hall }` (R437 asks it of plain objects); the hall's name is escaped.
 */
export function startTrialLines({ hall = null } = {}) {
    return {
        table: hall ? game.i18n.format("DRPG.Floor.startTrialHall", { hall: esc(hall.name ?? "") })
            : game.i18n.localize("DRPG.Floor.startTrialNoHall"),
        rule: game.i18n.localize("DRPG.Floor.tableRuleDead")
    };
}

/**
 * The console's line and door (E13 C6), or null: only in a running trial with a hall linked.
 * `scene` is the name of the active scene - the table, not the scene this browser shows; `action` is
 * "showHall" while the table is elsewhere, "backToSchool" while it is in the hall and leaving has
 * somewhere to go (`back`, `leaveDestination`'s answer), else null. Pure (R437).
 */
export function tableDoor({ running = false, hall = null, active = null, back = null } = {}) {
    if (!running || !hall?.id) return null;
    const inHall = active?.id === hall.id;
    return { scene: active?.name ?? null, action: inHall ? (back?.id ? "backToSchool" : null) : "showHall" };
}

/** Whether a door inside the trial may be used here, told when not: a GM, a running trial, a hall linked. */
function trialDoorOpen(hall) {
    const why = !game.user?.isGM ? "DRPG.Panel.gmOnly"
        : getClock().phase !== "classTrial" ? "DRPG.Floor.lead.start"
            : !hall ? "DRPG.Floor.startTrialNoHall" : null;
    if (why) ui.notifications.warn(game.i18n.localize(why));
    return !why;
}

/** The table to the hall inside a running trial, the phase unchanged: `enterTrialScene`'s answer, or null. */
export async function showCourtroom(hall = trialScene()) {
    if (!trialDoorOpen(hall)) return null;
    return enterTrialScene(hall);
}

/**
 * The table out of the hall inside a running trial, the phase unchanged: `leaveTrialScene`'s answer,
 * or null. With nowhere to go it is refused here and told, before `leaveTrialScene`'s whisper, which
 * speaks of a trial that ended.
 */
export async function showSchool(hall = trialScene()) {
    if (!trialDoorOpen(hall)) return null;
    if (!leaveDestination({ school: schoolScene(), returnTo: trialReturnTo(hall), hall })) {
        ui.notifications.warn(game.i18n.localize("DRPG.TrialScene.noWayBack"));
        return null;
    }
    return leaveTrialScene(hall);
}

/**
 * The two scenes as the GM's API reads them (E13 C6): the school, the hall and the active scene by
 * id, the hall's tokens the next entry would show, and the Scenes tab's warnings (`scenesReportOf`).
 * On a GM, after the judgements in flight are in (`judgedFor`, as `returnTheLiving`); null elsewhere.
 */
export async function trialSceneReport() {
    if (!game.user?.isGM) return null;
    await judgedFor(...game.actors.filter(actor => actor.type === "character").map(actor => actor.id));
    const school = schoolScene(), hall = trialScene();
    return {
        school: school?.id ?? null, hall: hall?.id ?? null, table: game.scenes?.active?.id ?? null,
        shown: castShownOnEntry(hall).map(token => token.id),
        warnings: scenesReportOf(school, hall).map(({ key, text, block }) => ({ key, text, block }))
    };
}

/**
 * The scene a browser should switch its own view to on its first `canvasReady`, or null (Q-E13-1 c):
 * a player's only; in the trial the hall when the hall is the active scene and another is on screen;
 * out of it the active scene when the hall is on screen and another scene is active - the school, the
 * scene of the room End the trial chose (C3b), or with no school linked the scene the trial opened from
 * (`trialReturnTo`). Until E13 fix r1-F2 this asked for the school alone, so a late browser after the
 * other two stayed in the hall, the place for nobody (review r1 cor B, by reading; R435's rows for both).
 * Plain arguments (R435 asks it of plain objects).
 */
export function viewRepair({ isGM = false, phase = null, hall = null, active = null, viewed = null } = {}) {
    if (isGM || !hall?.id) return null;
    if (phase === "classTrial") return active?.id === hall.id && viewed?.id !== hall.id ? hall : null;
    return active?.id && active.id !== hall.id && viewed?.id === hall.id ? active : null;
}

/** A player's browser, on its first `canvasReady` after a load: its own view put right once (`viewRepair`). */
async function selfRepair() {
    try {
        const scene = viewRepair({ isGM: Boolean(game.user?.isGM), phase: getClock().phase, hall: trialScene(),
            active: game.scenes?.active ?? null, viewed: viewedScene() });
        if (scene) await scene.view();
    } catch (err) {
        error("Could not put this browser's view of the trial hall right", err);
    }
}

/*
 * WHAT THE GMS LAST WROTE, NOT THE OTHER STATE (E13 fix r1-F2, 12.10.2026; review r1 sec A). C2 put a
 * player's change back by writing the opposite of what it wrote: `changed` holds only what differed,
 * so the state before it was the other one. That holds for one change at a time. Review r1 measured two
 * at 45e6bcf (scenario 41 with a phase of its own): Aiko's hall token shown by the GMs, p1 hid it and
 * showed it again, both landing before the primary's first answer; each was answered against itself,
 * and 3 s later every browser held the token hidden and the GMs had two whispers - the same with the
 * second write sent whole (`diff: false`). So every GM's client keeps, per hall cast token, the
 * `hidden` a GM last wrote (`castHeld`, fed by `watchCast` and `watchCastCreated` - this file's own
 * reveal and hide are GMs' writes too), and the primary writes that value back only when the token
 * holds another, and tells the GMs only when it wrote. Scenario 41 a4 sends both of review r1's pairs
 * and a pair against a GM's own hide, on four browsers.
 *
 * What a token no GM wrote since is held at: the linked hall as it stands when this GM's client
 * reaches `ready` and whenever the scene roles change (`reseedCastHeld`; E13 fix r2-H2, review r2 sec
 * S2-1). Until that fix the hall was read once per hall id, at the first write heard, and never again:
 * review r2 showed a GM's show heard on the linked hall, an unlink, a GM's hide on the unlinked hall
 * (heard by nobody: only the linked hall is watched) and a relink leave `castHeld` at "shown" while
 * the token was hidden, so p1's show of it stood on four browsers with no whisper - outside the trial,
 * and in the trial after it with the token unticked; and a GM client loading mid-trial skipped the
 * first token a player changed and held it as the stored choice would have it, not as a GM's hand had
 * left it. A change of the linked hall drops every row and reads the new one; a write heard after
 * that is the GMs' as before. The read at the first write heard (`seedCastHeld`, the changed token
 * then as the module would have left it, `heldHidden`) stays as the fallback for a hall neither of
 * those read - a reseed that failed, or a road to the link this file does not know of. Scenario 41
 * z (the unlink, the relink and the trial after) and r (a GM loading mid-trial). Whether v14 runs a setting's `onChange` before or after its `updateSetting`
 * hook is not read here, so the reseed lets go of the roles itself first.
 */
const castHeld = new Map();
let castSeededFor = null;

/** On a GM's client, once per linked hall: each cast token's `hidden` as it stands now, but `except`'s; another hall's rows dropped. */
function seedCastHeld(hall, except = null) {
    if (castSeededFor === hall.id) return;
    castHeld.clear();
    castSeededFor = hall.id;
    for (const token of castTokens(hall)) if (token.id !== except) castHeld.set(castKey(hall.id, token.id), Boolean(token.hidden));
}

/** On a GM's client, at `ready` and on a change of the scene roles: the linked hall read as it stands, when it is another than the one held. */
function reseedCastHeld() {
    if (!game.user?.isGM) return;
    try {
        forgetSceneRoles();
        const hall = trialScene();
        if ((hall?.id ?? null) === castSeededFor) return;
        castHeld.clear();
        castSeededFor = null;
        if (hall) seedCastHeld(hall);
    } catch (err) {
        error("Could not read the trial hall's cast as it stands", err);
    }
}

/**
 * The `hidden` the GMs last wrote on one hall cast token, as this GM's client heard it; with none heard,
 * the state the module would have left it in - in a running trial with the hall active the GMs' choice as
 * the way in reads it (`castShows`), else hidden. Null with no hall.
 */
export function heldHidden(tokenDoc, hall = trialScene()) {
    if (!hall || !tokenDoc?.id) return null;
    const key = castKey(hall.id, tokenDoc.id);
    if (castHeld.has(key)) return castHeld.get(key);
    if (getClock().phase !== "classTrial" || !hall.active) return true;
    const token = readCast(hall).find(row => row.id === tokenDoc.id);
    return !(token && castShows(token, { sceneId: hall.id, rows: trialCastStore.entries() }));
}

/**
 * What the primary writes back after a change to a hall token's `hidden`, or null when it stands
 * (plan-E13 3.3, MARKED). A GM's change stands; a player's to a cast token of the linked hall is
 * put back to `held`, the `hidden` the GMs last wrote (`heldHidden`), and only when the token holds
 * another - so a change the player's own next write or an earlier put-back already undid writes
 * nothing. Plain arguments (R434 asks it of plain objects).
 *
 * The plan exempted a write carrying this file's `trialCast` option. It is not exempt here: an
 * option is the writer's own claim, and a player's console can send it as easily as the module
 * does; every write of this file is a GM's, and a GM's change already stands. Nor does it write
 * the stored choice in the trial, as the plan said: a GM may have shown or hidden a token by hand
 * since the trial opened, and that is what the GMs last wrote.
 */
export function castPutBack(tokenDoc, changed, options, user, hall = trialScene(), held = heldHidden(tokenDoc, hall)) {
    if (typeof changed?.hidden !== "boolean") return null;
    if (!user || user.isGM) return null;
    if (!hall || tokenDoc?.parent?.id !== hall.id || !isCastToken(tokenDoc)) return null;
    if (typeof held !== "boolean" || Boolean(tokenDoc.hidden) === held) return null;
    return { hidden: held };
}

/**
 * The `updateToken` watcher on the hall, on every GM's client: a GM's `hidden` is noted as the GMs'
 * (`castHeld`); for a player's, what the GMs held is pinned before the primary answers, so a second
 * change, and a GM who becomes the primary between the two, read the same value. The primary puts a
 * player's change back and tells the GMs, once per change it undid.
 */
export async function watchCast(tokenDoc, changed, options, userId) {
    if (!game.user?.isGM) return;
    try {
        const hall = trialScene();
        if (!hall || tokenDoc?.parent?.id !== hall.id || !isCastToken(tokenDoc) || typeof changed?.hidden !== "boolean") return;
        const user = game.users?.get?.(userId) ?? null;
        const key = castKey(hall.id, tokenDoc.id);
        seedCastHeld(hall, tokenDoc.id);
        if (user?.isGM) castHeld.set(key, changed.hidden);
        else if (!castHeld.has(key)) castHeld.set(key, heldHidden(tokenDoc, hall));
        if (!isPrimaryGm()) return;
        const back = castPutBack(tokenDoc, changed, options, user, hall, castHeld.get(key));
        if (!back) return;
        await tokenDoc.update(back, castWrite());
        log(`${user.name} changed whether the hall token ${tokenDoc.name} is hidden; put back.`);
        await whisperToGms(`<p>${game.i18n.format("DRPG.TrialScene.hiddenPutBack", {
            user: esc(user.name), name: esc(tokenDoc.name ?? tokenDoc.id) })}</p>`);
    } catch (err) {
        error("Could not put back a hall token's hidden state", err);
    }
}

/**
 * The `createToken` watcher on the hall, on every GM's client. A cast token a GM makes is noted as
 * made (`castHeld`). One a player makes - a drag from the Actors tab, where the world grants players
 * TOKEN_CREATE - holds no tick in the store, so hidden is the GMs' choice for it: every GM notes it
 * so, and the primary hides it if it was made shown and tells the GMs (review r1 sec B: C2 only told
 * them, and the token stood shown on every browser for the rest of the trial). Hidden, not deleted
 * (D7: the module deletes nothing in the hall). It joins the cast as any hall token does, and the
 * next entry names it if it is a second token of its actor. Scenario 41 a5.
 */
async function watchCastCreated(tokenDoc, options, userId) {
    if (!game.user?.isGM) return;
    try {
        const user = game.users?.get?.(userId) ?? null;
        const hall = trialScene();
        if (!user || !hall || tokenDoc?.parent?.id !== hall.id || !isCastToken(tokenDoc)) return;
        seedCastHeld(hall, tokenDoc.id);
        castHeld.set(castKey(hall.id, tokenDoc.id), user.isGM ? Boolean(tokenDoc.hidden) : true);
        if (user.isGM || !isPrimaryGm()) return;
        if (!tokenDoc.hidden) await tokenDoc.update({ hidden: true }, castWrite());
        await whisperToGms(`<p>${game.i18n.format("DRPG.TrialScene.playerTokenCreated", {
            user: esc(user.name), name: esc(tokenDoc.name ?? tokenDoc.id) })}</p>`);
    } catch (err) {
        error("Could not hide a token a player made in the trial hall", err);
    }
}

/**
 * The `deleteToken` watcher on the hall, on the primary GM's client (E13 fix r2-H2, review r2 sec
 * S2-4): a cast token a player deleted - where the world grants players TOKEN_DELETE, which this
 * module does not read - is whispered to the GMs, as a player's drop is. It is not made again (D7:
 * the module creates nothing in the hall), so the GMs put it back by hand if the trial needs it. Its
 * row in `castHeld` stays, unread unless a token of that id stands in the hall again; R432 holds this
 * file to no delete call at all. Until the fix a player's delete of their own student's hall token took the GMs' choice
 * off every browser and nobody was told; the harness refused every player's delete, so the road had
 * never run. Scenario 41 a7.
 */
async function watchCastDeleted(tokenDoc, options, userId) {
    if (!game.user?.isGM) return;
    try {
        const user = game.users?.get?.(userId) ?? null;
        const hall = trialScene();
        if (!hall || tokenDoc?.parent?.id !== hall.id || !isCastToken(tokenDoc)) return;
        if (!user || user.isGM || !isPrimaryGm()) return;
        log(`${user.name} deleted the hall token ${tokenDoc.name}; the GMs are told.`);
        await whisperToGms(`<p>${game.i18n.format("DRPG.TrialScene.playerTokenDeleted", {
            user: esc(user.name), name: esc(tokenDoc.name ?? tokenDoc.id) })}</p>`);
    } catch (err) {
        error("Could not tell the GMs of a token a player deleted from the trial hall", err);
    }
}

/*
 * THE SCENES TAB (E13 C5, 12.10.2026; plan-E13 C5, doneWhen 3, R120; the owner's answers Q-E13-1 d
 * and e of 09.10). Until this commit no window linked the two scenes or kept the cast's choice:
 * scenario 41 a and the suite wrote the setting and `saveTrialCast` from a console. Room Setup's
 * last tab (vault.mjs `ROOM_SETUP_TABS`) does it now: a select for the school and one for the
 * hall, the hall's cast with a tick each, what is wrong with the pair (`sceneReport`), and
 * "Prepare the hall". It warns and places nothing (D7): a student with no token in the hall is
 * named, never given one. Room Setup opens on it when its scene holds no room (Q-E13-1 e).
 *
 * WHAT THE GM CHANGED, NOT WHAT THE FORM SAYS. A select or a tick counts only when it differs from
 * what the window drew (`data-drawn`, `defaultChecked`), as the Fog tab's boxes do (vault.mjs
 * `readRoomSetupForm`): an Apply that changed nothing here writes nothing here - Room Setup is
 * applied for its other tabs far more often than for this one - and a role whose scene was
 * deleted is not cleared by a GM who only opened the window. The roles are merged into what is
 * stored (plan page 11.10), so a field this tab does not show (a later `zones`) survives its save.
 */

/** The scene id stored for a role when its scene still exists, else "" - what the tab's select draws. */
function drawnRole(roles, role) {
    const id = roles?.[role];
    return typeof id === "string" && id && game.scenes?.get?.(id) ? id : "";
}

/** The names of the hall's regions a GM marked as rooms; a region nobody marked is a zone and is not named (amend 28.09). */
export function hallRoomNames(hall) {
    return [...new Set(Array.from(hall?.regions ?? []).filter(isRoom).map(region => region.name))]
        .sort((a, b) => a.localeCompare(b));
}

/**
 * What the Scenes tab warns of, as rows `{ key, text, block }` - `block` holds Apply. Handed the
 * school and the hall (a scene, or anything with an `id`) and what the hall holds: `rooms`, the
 * names of its room regions; `cast`, `readCast`'s rows with `linked`; `missing`, the names of the
 * students a player plays with no token in it; `dark`, `hallIsDark`'s answer. Reads nothing else
 * (R120 asks it of plain objects).
 */
export function sceneReport({ school = null, hall = null, rooms = [], cast = [], missing = [], dark = false } = {}) {
    const rows = [];
    const row = (key, text, block = false) => rows.push({ key, text, block });
    const names = list => list.map(name => esc(name)).join(", ");
    if (school?.id && school.id === hall?.id) row("sameScene", game.i18n.localize("DRPG.TrialScene.sameScene"), true);
    if (!school?.id) row("noSchoolLinked", game.i18n.localize("DRPG.TrialScene.noSchoolLinked"));
    if (!hall?.id) return rows;
    if (rooms.length) row("hallHasRooms", game.i18n.format("DRPG.TrialScene.hallHasRooms", { names: names(rooms) }));
    if (missing.length) row("missingTokens", plural("DRPG.TrialScene.missingTokens", { n: missing.length, names: names(missing) }));
    const seconds = cast.filter(token => token.second).map(token => token.name);
    if (seconds.length) row("duplicateInHall", game.i18n.format("DRPG.TrialScene.duplicateInHall", { names: names(seconds) }));
    const unlinked = cast.filter(token => token.linked === false).map(token => token.name);
    if (unlinked.length) row("unlinkedToken", game.i18n.format("DRPG.TrialScene.unlinkedToken", { names: names(unlinked) }));
    if (dark) row("hallDark", game.i18n.localize("DRPG.TrialScene.hallDark"));
    return rows;
}

/**
 * Whether the hall still keeps a field "Prepare the hall" would change: Foundry's token vision on,
 * its global light off or its exploration fog on (`hallPreparePatch` without the two extra ticks).
 * Prepare stays the GM's choice and defaults off (Q-E13-1 d); a hall linked without it is named on
 * the Scenes tab and in the entry whisper instead (E13 fix r1-F3, 12.10.2026; goal S07-47). What a
 * player sees in such a hall needs a canvas and is not measured here.
 */
export function hallIsDark(hall) {
    return Boolean(hall) && Object.keys(hallPreparePatch(hall)).length > 0;
}

/**
 * `sceneReport` of two scenes as they are: the hall's room names, its cast as the GMs hold it
 * (`readCast`) with whether each token is linked to its actor - the dead overlay and a player's
 * ownership are read off the actor, so an unlinked token shows neither - and the students a player
 * plays with no token there (`studentsWithoutHallToken`, the entry whisper's list).
 */
export function scenesReportOf(school, hall) {
    const cast = hall ? readCast(hall).map(token => ({ ...token, linked: Boolean(hall.tokens.get(token.id)?.actorLink) })) : [];
    return sceneReport({ school, hall, rooms: hallRoomNames(hall), cast,
        missing: hall ? studentsWithoutHallToken(hall).map(actor => actor.name) : [], dark: hallIsDark(hall) });
}

function reportHtml(school, hall) {
    return scenesReportOf(school, hall).map(row =>
        `<p class="drpg-warning" data-drpg-scene-warning="${row.key}">${row.text}</p>`).join("");
}

/**
 * Who takes part, with a tick per actor (E81 DZ6; until then a tick per hall token): every actor
 * `castActors` names, ticked as the GMs' stored choice has it, else as `defaultReveal` does. One
 * builder for the Scenes tab and the Start window, which hands its own `heading`. The box carries the
 * hall's id, so a list drawn for another hall is not read as this one's.
 */
export function castPickerHtml(hall, { heading = "DRPG.TrialScene.castHeading" } = {}) {
    if (!hall?.tokens) return "";
    const stored = readTrialCast(hall);
    const rows = readCastActors().map(actor => {
        const reveal = actor.id in stored ? stored[actor.id] : defaultReveal(actor);
        return `<li><label><input type="checkbox" name="cast:${esc(actor.id)}"${reveal ? " checked" : ""} /> ${esc(actor.name)}</label></li>`;
    });
    return `<div data-drpg-cast="${esc(hall.id)}">
        <h4>${game.i18n.localize(heading)}</h4>
        <p class="notes">${game.i18n.localize("DRPG.TrialScene.reveal")}</p>
        ${rows.length ? `<ul class="drpg-cast-list">${rows.join("")}</ul>`
            : `<p class="notes">${game.i18n.localize("DRPG.TrialScene.noCast")}</p>`}
    </div>`;
}

/** The ticks the GM changed in a cast list, `{ sceneId, changes: { actorId: reveal } }`, or null when none is drawn. */
export function readCastPicker(root) {
    const box = root?.querySelector?.("[data-drpg-cast]");
    if (!box) return null;
    const changes = {};
    for (const input of box.querySelectorAll('input[type="checkbox"][name^="cast:"]')) {
        if (input.disabled || input.checked === input.defaultChecked) continue;
        changes[input.name.slice("cast:".length)] = input.checked;
    }
    return { sceneId: box.dataset.drpgCast, changes };
}

/** proximity-voice-chat's id: its `disabled` scene flag is the one this module's voice check reads (voice.mjs `competingModuleWarnings`). */
const PROXIMITY_VOICE = "proximity-voice-chat";

/** The Scenes tab's panel: the two selects, the warnings and the cast of the hall linked now, and "Prepare the hall". */
export function scenesTabHtml(roles = sceneRoles()) {
    const drawn = { school: drawnRole(roles, "school"), trial: drawnRole(roles, "trial") };
    const scenes = Array.from(game.scenes ?? []).sort((a, b) => a.name.localeCompare(b.name));
    const select = role => `<select name="scenes:${role}" data-drawn="${esc(drawn[role])}">
        <option value="">${game.i18n.localize("DRPG.TrialScene.noScene")}</option>
        ${scenes.map(scene => `<option value="${esc(scene.id)}"${scene.id === drawn[role] ? " selected" : ""}>${esc(scene.name)}</option>`).join("")}
    </select>`;
    const [school, hall] = [drawn.school, drawn.trial].map(id => (id ? game.scenes.get(id) : null) ?? null);
    const voice = game.modules?.get?.(PROXIMITY_VOICE)?.active
        ? `<label><input type="checkbox" name="scenes:prepareVoice" /> ${game.i18n.localize("DRPG.TrialScene.prepareVoice")}</label>` : "";
    return `<p>${game.i18n.localize("DRPG.TrialScene.scenesIntro")}</p>
        <div class="drpg-scene-roles">
            <label>${game.i18n.localize("DRPG.TrialScene.school")} ${select("school")}</label>
            <label>${game.i18n.localize("DRPG.TrialScene.hall")} ${select("trial")}</label>
        </div>
        <div data-drpg-scenes-report>${reportHtml(school, hall)}</div>
        <div data-drpg-cast-box>${castPickerHtml(hall)}</div>
        <fieldset class="drpg-scene-prepare">
            <label><input type="checkbox" name="scenes:prepare" /> ${game.i18n.localize("DRPG.TrialScene.prepare")}</label>
            <label><input type="checkbox" name="scenes:preparePlaylist" /> ${game.i18n.localize("DRPG.TrialScene.preparePlaylist")}</label>
            ${voice}
        </fieldset>`;
}

/**
 * The tab's live half, in a drawn window: the warnings follow both selects, the cast list follows
 * the hall's (a GM linking a hall picks its cast in the same Apply), and `block(reason | null)`
 * holds Apply while both name one scene, or while the hall select is changed in a running trial
 * (`hallLockReason`) (vault.mjs `setApplyBlock`).
 */
export function wireScenesTab(root, block = () => {}) {
    const [school, trial] = ["school", "trial"].map(role => root?.querySelector?.(`[name="scenes:${role}"]`));
    const report = root?.querySelector?.("[data-drpg-scenes-report]");
    const castBox = root?.querySelector?.("[data-drpg-cast-box]");
    if (!school || !trial || !report || !castBox) return;
    const scene = select => (select.value ? game.scenes.get(select.value) : null) ?? null;
    const redraw = () => {
        report.innerHTML = reportHtml(scene(school), scene(trial));
        let reason = null;
        if (scenesClash({ school: school.value, trial: trial.value })) reason = game.i18n.localize("DRPG.TrialScene.sameScene");
        else {
            const locked = hallLockReason({ trial: trial.value, drawn: { trial: trial.dataset.drawn ?? "" } });
            if (locked) reason = game.i18n.localize(locked);
        }
        block(reason);
    };
    school.addEventListener("change", redraw);
    trial.addEventListener("change", () => {
        castBox.innerHTML = castPickerHtml(scene(trial));
        redraw();
    });
    redraw();
}

/**
 * What the Scenes tab hands Apply: each select's value and what it drew, the cast list's changed
 * ticks, and whether (and how) to prepare the hall. Null when the tab is not in the form.
 */
export function readScenesTab(root) {
    const pick = name => root?.querySelector?.(`[name="scenes:${name}"]`) ?? null;
    const [school, trial] = [pick("school"), pick("trial")];
    if (!school || !trial) return null;
    return {
        school: school.value, trial: trial.value,
        drawn: { school: school.dataset.drawn ?? "", trial: trial.dataset.drawn ?? "" },
        cast: readCastPicker(root),
        prepare: pick("prepare")?.checked
            ? { playlist: Boolean(pick("preparePlaylist")?.checked), voice: Boolean(pick("prepareVoice")?.checked) } : null
    };
}

/** Whether a reading of the tab names one scene for both roles - Apply is refused before anything is written. */
export function scenesClash(read) {
    return Boolean(read?.school) && read.school === read.trial;
}

/**
 * Whether a reading of the tab moves the trial hall - links another or unlinks it - while a Class
 * Trial runs. Refused before anything is written, as a clash is (vault.mjs, after `scenesClash`), and
 * the window holds Apply with the reason (`wireScenesTab`): the GM ends the trial first. Until E13 fix
 * r1-F2 nothing refused it, and by review r1's reading (cor C) nothing hid the old hall's shown cast,
 * and an unlink left End the trial no hall to leave (`leaveTrialScene` reads the link), so the phase
 * went back while the table stayed in the old hall and nobody was told. Scenario 41 l1 reads the
 * refusal on the GM's window. Pure over the reading and the phase.
 */
export function hallLocked(read, phase = getClock().phase) {
    return phase === "classTrial" && Boolean(read) && (read.trial ?? "") !== (read.drawn?.trial ?? "");
}

/**
 * The lang key of the reason `hallLocked` holds Apply with, or null when it does not. A trial
 * opened with no hall linked and a GM picking a first one is told that, not that a hall is linked
 * (E13 fix r2-H2, review r2 cor E: until the fix one text, "A Class Trial is running in the linked
 * trial hall", answered both). Scenario 41 l2 reads it on the GM's window.
 */
export function hallLockReason(read, phase = getClock().phase) {
    if (!hallLocked(read, phase)) return null;
    return read.drawn?.trial ? "DRPG.TrialScene.hallInTrial" : "DRPG.TrialScene.hallFirstInTrial";
}

/**
 * What an Apply of the tab writes, decided before it writes: `roles`, the whole object to store or
 * null when no select the GM changed differs from what is stored (merged into `stored`); `cast`,
 * the changed ticks when they belong to the hall the Apply leaves linked; `prepare`, the hall and
 * the two ticks. All null for a clash. Pure (R120 asks it of plain objects).
 */
export function scenesTabWrites(read, stored = {}) {
    const none = { roles: null, cast: null, prepare: null };
    if (!read || scenesClash(read)) return none;
    const patch = {};
    for (const role of ["school", "trial"]) if (read[role] !== read.drawn?.[role]) patch[role] = read[role] || null;
    const moved = Object.keys(patch).some(role => (stored?.[role] ?? null) !== patch[role]);
    const hall = read.trial || null;
    const changes = read.cast?.sceneId === hall ? read.cast.changes ?? {} : {};
    return {
        roles: moved ? { ...(stored ?? {}), ...patch } : null,
        cast: hall && Object.keys(changes).length ? { sceneId: hall, changes } : null,
        prepare: hall && read.prepare ? { sceneId: hall, playlist: Boolean(read.prepare.playlist), voice: Boolean(read.prepare.voice) } : null
    };
}

/**
 * The fields "Prepare the hall" writes, for one update (the owner's answer Q-E13-1 d, 09.10.2026):
 * Foundry's own always - its exploration fog off (fog.mjs `fogOffPatch`), token vision off, the
 * global light on, so every browser sees the hall whole and lit as a player with no token in it
 * would otherwise not; the scene's playlist cleared only when `playlist` is ticked; the
 * proximity-voice-chat module's `disabled` flag only when `voice` is ticked and that module is
 * active (its `getFlag` would throw otherwise) - whether that module honours the flag is read in
 * this module's own voice check, not measured with that module; and never another module's flag,
 * isometric-perspective's above all: a hall may be isometric on purpose. Only what differs.
 */
export function hallPreparePatch(scene, { playlist = false, voice = false,
    voiceActive = Boolean(game.modules?.get?.(PROXIMITY_VOICE)?.active) } = {}) {
    if (!scene) return {};
    const update = { ...fogOffPatch(scene) };
    if (scene.tokenVision !== false) update.tokenVision = false;
    if (scene.environment?.globalLight?.enabled !== true) update["environment.globalLight.enabled"] = true;
    if (playlist && (scene.playlist || scene.playlistSound)) Object.assign(update, { playlist: null, playlistSound: null });
    if (voice && voiceActive && scene.getFlag?.(PROXIMITY_VOICE, "disabled") !== true) update[`flags.${PROXIMITY_VOICE}.disabled`] = true;
    return update;
}

/** "Prepare the hall" on a GM: one update of `hallPreparePatch`'s fields, told to this GM. Answers the fields written. */
export async function prepareTrialScene(scene, { playlist = false, voice = false } = {}) {
    if (!game.user?.isGM || !scene) return null;
    const update = hallPreparePatch(scene, { playlist, voice });
    if (Object.keys(update).length) await scene.update(update);
    ui.notifications?.info?.(game.i18n.format("DRPG.TrialScene.prepareDone", { scene: scene.name }));
    return update;
}

/**
 * Apply the Scenes tab on a GM, after Room Setup's own checks passed: the roles when they moved,
 * the cast's changed ticks (`saveTrialCast`), then - when the linked hall or its choice changed -
 * the hall's tokens as the phase wants them: out of the trial the whole cast hidden, so the hall
 * rests until a trial opens; in the trial with the hall active the new choice, one diff
 * (`applyTrialCast`); in the trial with another scene active nothing. A change of the hall itself in
 * a running trial never reaches here: Room Setup refuses it first (`hallLocked`).
 * Then "Prepare the hall". Answers what it did, or null off a GM.
 */
export async function applyScenesTab(read) {
    if (!game.user?.isGM || !read) return null;
    const stored = sceneRoles();
    const writes = scenesTabWrites(read, stored);
    const done = { roles: false, cast: false, shown: null, prepared: null };
    if (writes.roles) {
        await game.settings.set(MODULE_ID, SETTINGS.sceneRoles, writes.roles);
        forgetSceneRoles();
        done.roles = true;
    }
    const hall = read.trial ? game.scenes?.get?.(read.trial) ?? null : null;
    if (writes.cast && hall) done.cast = await saveTrialCast(hall, writes.cast.changes);
    const relinked = done.roles && (stored.trial ?? null) !== (writes.roles.trial ?? null);
    if (hall && (relinked || done.cast)) {
        const trial = getClock().phase === "classTrial";
        if (!trial) done.shown = await hideTrialTokens(hall);
        else if (hall.active) done.shown = await revealTrialTokens(hall);
    }
    if (writes.prepare && hall) done.prepared = await prepareTrialScene(hall, writes.prepare);
    return done;
}

export function registerTrialScene() {
    Hooks.on("updateToken", watchCast);
    Hooks.on("createToken", watchCastCreated);
    Hooks.on("deleteToken", watchCastDeleted);
    Hooks.once("canvasReady", selfRepair);
    Hooks.once("ready", nameUnfinishedCarries);
    Hooks.once("ready", reseedCastHeld);
    Hooks.once("ready", () => { tidyTrialHall().catch(err => error("Could not move the trial hall's cast to its actors", err)); });
    // A world whose roles were never written makes the Setting document on its first write: `createSetting` in Foundry.
    for (const hook of ["updateSetting", "createSetting"]) {
        Hooks.on(hook, setting => { if (setting?.key === `${MODULE_ID}.${SETTINGS.sceneRoles}`) reseedCastHeld(); });
    }
}
