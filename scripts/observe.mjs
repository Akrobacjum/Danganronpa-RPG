/**
 * Danganronpa RPG - Observe, resolved on the GM's client.
 * ---------------------------------------------------------------------------
 * Guide, p. 30: the player declares what they are looking for, and what they
 * find follows from that declaration.
 *
 *   general      "I look around"                 the easiest Remnant in the room
 *   specific     "something to do with the body" the one closest to the request
 *   non-obvious  "something out of place"        the hardest Remnant in the room
 *
 * and above all of it: "DM zawsze w pierwszej kolejności pokazuje Remnants
 * związane z zabójstwem."
 *
 * WHY THIS RUNS ON THE GM'S CLIENT. Everything the roll is judged against is
 * something the observer must not know: which Remnants are in the room, what
 * kind each one is, and therefore what the difficulty is. Remnant tokens are
 * hidden, but Foundry still ships every scene's tokens - flags and all - to
 * every client, so a player's browser physically holds the answers. Resolving
 * there would mean asking the person being tested to score their own test.
 *
 * So the observer's client does exactly two things: ask for a target, and throw
 * the dice. The number travels here; the verdict, the Truth Bullet and the
 * Sanity are all produced on this side. The player is told the outcome, never
 * the difficulty.
 */

import { MODULE_ID, OBSERVE_FAIL_STRESS, PROJECT_OBSERVE, TIMES_OF_DAY, TIMING } from "./config.mjs";
import { rankForObserve, tieForCopy } from "./remnants.mjs";
import { createTruthBullet, copiedRemnants, dropSecret } from "./truth-bullets.mjs";
import { trustedWrite } from "./resource-guard.mjs";
import { resourceValue } from "./character.mjs";
import {
    whisperToOwner, whisperToGms, ownerOf, ownerIdsOf, log, warn, error, debug, serialWrite, isPrimaryGm, activeGmIds
} from "./utils.mjs";
// The store the declarations are written through (ACT-08). settings.mjs imports
// config.mjs and nothing else, so this closes no cycle.
import { SETTINGS } from "./settings.mjs";
import { observeStore } from "./gm-stores.mjs";
import { stableJson, onGmStoresHydrated, gmStoresQuiet } from "./gm-store.mjs";
import { drpgWindow, tipAttr, tipText } from "./ui-kit.mjs";
import { withCentre } from "./notice-centre.mjs";


/** How the player said they were looking. */
export const DECLARATIONS = {
    general: "general",
    specific: "specific",
    nonObvious: "nonObvious",
    followTraces: "followTraces"
};

/**
 * Targets chosen but not yet rolled against.
 *
 * Kept after the roll rather than consumed by it, because a Reroll has to be
 * judged against the same Remnant - the dice are taken back, not the search.
 * Entries are swept on age so a session's worth of abandoned declarations cannot
 * pile up.
 *
 * WRITTEN THROUGH TO A SETTING, AND THAT IS ACT-08 (20.09). This was a Map in one
 * browser's memory, and the two halves of an Observe are minutes apart: the GM
 * declares the target, the player rolls, and the answer comes back. A GM who
 * reloaded in between - F5, a crash, a closed tab - came back with an empty Map,
 * and `resolveObserve` then found nothing and returned null. The player had
 * already paid the action and thrown the dice: no Truth Bullet, no Sanity, no
 * card, one action lighter, and nothing said on either screen. At the table that
 * reads as "the module ate my action".
 *
 * CLIENT-SCOPED, not world-scoped, and that is not negotiable: every entry holds
 * the Remnant's REAL type and its difficulty - the answer being bought - and a
 * world setting reaches every client, where any player can read it from their own
 * console. The note beside `SETTINGS.remnantSecrets` records the same decision for
 * the same reason.
 *
 * The Map stays as the read cache; the setting is the copy that survives the
 * browser - a local GM store since E04 (1.2.63, gm-stores.mjs `observeStore`), a
 * section per world, which this Map is filled from and written through to.
 *
 * AND IT REACHES THE OTHER GMs (line INVEST of 1.2.122; the audit's CASE-LC3 of
 * 1.2.42). Both halves of the round trip are handled by whoever `primaryGmId()`
 * names at that moment, and that can change - a GM joining with a lower-sorted id,
 * the primary disconnecting, a reload - so a declaration minted on one GM's browser
 * can be asked of another's. The store was kept local until this line (`sync:
 * false`, E04 C7), and a new primary then held no row; it is exchanged between the
 * GMs now, as every other GM-only store (scenario 62 Q). A row still missing - an
 * hour gone, or a GM who never received it - is said on both screens.
 */
const pending = new Map();
const PENDING_TTL_MS = TIMING.pendingObserveTtlMs;
/** True once the setting has been folded into the cache on this client. */
let pendingLoaded = false;

/** While this module's own write of the store is in flight: its change event is not news. */
let pendingWriting = 0;

/**
 * Fill the cache from the store, when it is not filled or the store changed under
 * it. GM only; players hold none. Copies, not the store's own rows: an entry is
 * changed in place here (`entry.result = ...`) and written through by
 * `writePending`, which finds the change by comparing the two.
 */
function readPending() {
    if (pendingLoaded || !game.user?.isGM) return;
    pendingLoaded = true;
    pending.clear();
    try {
        for (const [key, entry] of Object.entries(observeStore.entries())) {
            if (entry && typeof entry === "object") pending.set(key, structuredClone(entry));
        }
    } catch (err) {
        debug("Could not read the pending Observes back", err);
    }
}

/**
 * Write the cache through: what changed is written, what went is dropped. Every
 * mutation of `pending` goes through here. A cache the store changed under since
 * it was read drops nothing - it cannot know what it never read.
 */
async function writePending() {
    if (!game.user?.isGM) return;
    try {
        const held = observeStore.entries();
        const gone = pendingLoaded ? Object.keys(held).filter(key => !pending.has(key)) : [];
        const changed = Object.fromEntries([...pending].filter(([key, entry]) => stableJson(held[key] ?? null) !== stableJson(entry)));
        pendingWriting++;
        try {
            await Promise.all([gone.length ? observeStore.dropMany(gone) : null,
                Object.keys(changed).length ? observeStore.patchMany(changed) : null]);
        } finally {
            pendingWriting--;
        }
    } catch (err) {
        debug("Could not store the pending Observes", err);
    }
}

/*
 * THE CACHE FOLLOWS THE STORE (E04). It was filled once and never told of a change:
 * a second tab, or the suite putting the store back, left it answering from what it
 * read first. A change of the store this module did not make now empties it for the
 * next read. `clientSettingChanged`, because the store is client-scoped (R14).
 */
Hooks.on("clientSettingChanged", key => {
    if (key === `${MODULE_ID}.${SETTINGS.observePending}` && !pendingWriting) pendingLoaded = false;
});

async function sweepPending() {
    readPending();
    const cutoff = Date.now() - PENDING_TTL_MS;
    let dropped = 0;
    for (const [key, entry] of pending) {
        if (entry.at < cutoff) {
            pending.delete(key);
            dropped++;
        }
    }
    for (const [key, { entry }] of unpaid) if (!(entry.at >= cutoff)) unpaid.delete(key);
    if (dropped) await writePending();
}


/* ==========================================================================
 * PHASE 1 - WHAT ARE THEY LOOKING AT
 * ========================================================================== */

/**
 * Pick the Remnant this Observe is aimed at.
 *
 * For a "specific" declaration the choice is a human judgement, and a GM who
 * knew the total could pick a target to suit the number. That is still
 * prevented, but by what this function is GIVEN rather than by when it runs:
 * the payload carries the actor, the declaration and the player's sentence, and
 * no total. The number arrives separately in `resolveObserve`, after the pick.
 *
 * (The player's own client now rolls before it asks them what they were after -
 * see `observeSpecific` in action-observe.mjs - so "before any dice are thrown" is
 * no longer true and was never what kept this honest.)
 *
 * @returns {Promise<{ok: boolean, key?: string, reason?: string}>}
 */
export async function chooseObserveTarget({ actorId, declaration, request = "", userId = null, asked = null, key: given = null, paid = false } = {}) {
    if (!game.user.isGM) return { ok: false, reason: "notGm" };
    sweepPending();
    /* AN UNPAID ASK WRITES NOTHING AND LOGS NOTHING (line INVEST of 1.2.122; the coordinator's 21.11, CASE-33's rest). A
       General, Non-obvious or Follow my traces is asked before the player pays, so its row is held in this browser's
       memory alone (`unpaid`) - no write to the GMs' store, which every GM now holds, and no log line - and is written
       through and logged at its paid resolve (`resolveObserve`). Its key names its declaration, so a resolve whose row
       the memory lost (a reload of this GM between the two) chooses again on the same declaration (`given`, `paid`). */
    const ranked = [DECLARATIONS.general, DECLARATIONS.nonObvious, DECLARATIONS.followTraces].includes(declaration);
    const held = ranked && !paid;
    const newKey = () => given ?? (ranked ? `${declaration}.${foundry.utils.randomID()}` : foundry.utils.randomID());

    const actor = game.actors.get(actorId);
    if (!actor) return { ok: false, reason: "noActor" };

    const followingTraces = declaration === DECLARATIONS.followTraces;
    const { where, candidates } = await observeCandidates(actor, { preferOwn: followingTraces });
    if (!where?.room) return { ok: false, reason: "noRoom" };
    const room = where.room;

    /* The other thing this room can give up, and only to one declaration - see
       PROJECT_OBSERVE in config.mjs for why it is that one and no other. Asked
       about the OBSERVER's account, not `game.user`: this runs on the GM's
       client, where the ambient answer would be "in on all of them". */
    const secret = declaration === DECLARATIONS.nonObvious
        ? pickHidden(await hiddenProjectsFor(actor, where))
        : null;

    if (!candidates.length) {
        // The room is picked clean of traces. If it is also holding nothing this
        // declaration can find, that is the Daily Life fallback as before.
        /* NOTHING HERE IS NOT SAID BEFORE IT IS PAID FOR (line INVEST of 1.2.122; audit 1.2.118
           domain-case-c-investigation 2). This step runs before the player pays (action-observe.mjs `observeRanked`),
           and it answered `{ ok: false, reason: "none" }` for a room with nothing to find and a key for a room with a
           trace - so a General, Non-obvious or Follow my traces asked, read off the wire and the roll window closed told,
           for nothing, the one thing this file's header says the observer must not know. Now such a room gets a key
           too, marked `nothingHere`, and the paid roll's resolve rules on it (`scoreObserve`): the GMs' card the
           player's browser used to post (action-observe.mjs `observeRulingCall`). A Something specific is asked after
           its roll, so it keeps its answer. Tier 2 "1.2.122 CASE-33". */
        if (!secret && declaration === DECLARATIONS.specific) return { ok: false, reason: "none" };
        if (!secret) {
            const emptyKey = await keepRow(newKey(), {
                at: Date.now(), actorId, by: userId, room, declaration, request,
                tokenId: null, sceneId: where.scene?.id ?? null, dc: null, data: null, nothingHere: true
            }, () => log(`Observe: ${actor.name} is sweeping ${room}, which holds nothing this declaration can find; the GMs rule on the roll.`), held);
            return { ok: true, key: emptyKey };
        }

        /* Otherwise the project IS the target. Nothing else in this file needs a
           branch for that: it takes the same key, the same pending entry and the
           same road home, and `resolveObserve` reads `projectOnly` at the one
           point where a trace would have been created. Without this the total
           would never reach the GM at all - the observer's client drops to a
           ruling card when the target lookup says "nothing here", so a room
           whose only secret was a project could not be searched. */
        const onlyKey = await keepRow(newKey(), {
            at: Date.now(), actorId, by: userId, room, declaration, request,
            tokenId: null, sceneId: where.scene?.id ?? null,
            dc: PROJECT_OBSERVE.dc, data: null,
            projectId: secret.id, projectOnly: true
        // Written through like the trace's own declaration below (ACT-08), once paid.
        }, () => log(`Observe: ${actor.name} is sweeping ${room}, which holds nothing but a secret project (DC ${PROJECT_OBSERVE.dc}).`), held);
        return { ok: true, key: onlyKey };
    }

    let chosen;
    if (declaration === DECLARATIONS.specific && asked) {
        /*
         * A PLAYER'S FOCUSED GAZE IS PICKED ON EVERY GM'S CARD (E09 C12, 08.10.2026; audit
         * S05-27). The picker opened on the primary GM's browser and nowhere else: a second
         * GM never learned the question existed, and a primary whose window was hidden left
         * the player waiting out the whole clock. Now the question is a card in the player's
         * thread (call-gm.mjs `askObserveByCard`), any GM's click opens the picker on that
         * GM's own browser (`pickFromCard`), and the pick is checked and written here, on the
         * primary (`pickObserveTarget`). The bridge's `{ later: true }` or `{ refused }`, not
         * a target: the player's answer is sent when a GM has picked or refused.
         */
        const { askObserveByCard } = await import("./gm-bridge.mjs");
        return askObserveByCard({ actor, room, request, userId }, asked);
    }
    if (declaration === DECLARATIONS.specific) {
        chosen = await askWhichRemnant(actor, room, request, candidates);
        // A GM who closes the picker has refused the request, which is a real
        // answer. The action was paid before the dice and stays paid: the roll
        // already thrown goes to the GMs as a card to rule on (action-observe.mjs
        // `observeSpecific` -> `ruleObserve`; R6355, 14.11.2026). Until then this
        // line said the player kept their action and nothing was rolled.
        if (!chosen) return { ok: false, reason: "refused" };
    } else if (followingTraces) {
        /*
         * `preferSource` above already put the observer's own traces first,
         * sorted the normal way within that group - so the first one IS the
         * easiest of their own.
         *
         * WHEN THEY HAVE NONE HERE, A RANDOM ONE (Dawid, 28.08). This used to
         * fall back to `mostRelevant(candidates)[0]`, which is precisely what
         * "sweep the room" hands over - so declaring "follow my traces" in a
         * room you have never been in was a free upgrade: the same best clue,
         * plus the knowledge that you left nothing there.
         *
         * A random pick keeps the action from coming away empty - the roll was
         * made and beaten - without letting the wrong declaration buy the right
         * answer. Still no message saying which happened: "you left nothing
         * here" is information this action never paid for.
         */
        const mine = candidates.filter(c => c.data.sourceActor === actorId);
        chosen = mine.length
            ? mine[0]
            : candidates[Math.floor(Math.random() * candidates.length)];
    } else {
        // The preference picks the SHELF; the declaration picks off it.
        //
        // Both of these were reading off the full list, which sorts crime-tied
        // Remnants first and then by difficulty. "The easiest" therefore did
        // land on the right one - but "the hardest" walked to the far end of the
        // list, which is the hardest Remnant that has nothing to do with the
        // murder. The guide is the other way round: "DM zawsze w pierwszej
        // kolejności pokazuje Remnants związane z zabójstwem", and a preference
        // that only holds for one of the two declarations is not a preference.
        const shelf = mostRelevant(candidates);
        chosen = declaration === DECLARATIONS.nonObvious ? shelf[shelf.length - 1] : shelf[0];
    }

    return { ok: true, key: await pendObserve({ actor, userId, where, declaration, request, chosen, secret, key: newKey(), held }) };
}

/**
 * Where an observer stands and the traces they could be shown there (E09 C12, split out of
 * `chooseObserveTarget`): `{ where, candidates }`, `where` null for a character standing in no
 * room. Read on any GM's browser - the clicking GM's picker and the primary's check of the pick
 * read the same list - and, with `room`, empty unless the character still stands in that room.
 *
 * Located without the canvas on purpose. This runs on a GM's client, which is very often
 * looking at a different scene than the player acting - and the canvas-bound lookup would
 * report the character as standing nowhere, quietly turning every Observe into the Daily Life
 * fallback. A Remnant already copied is not a second find - the guide's Truth Bullet is the
 * player's copy of a trace, and one trace yields one copy per person.
 */
export async function observeCandidates(actor, { room = null, preferOwn = false } = {}) {
    const { locateActor } = await import("./movement.mjs");
    const where = actor ? locateActor(actor) : null;
    if (!where?.room) return { where: null, candidates: [] };
    if (room && where.room !== room) return { where, candidates: [] };
    const already = copiedRemnants(actor);
    for (const id of pendingTracesOf(actor.id)) already.add(id);
    const candidates = rankForObserve(where.room, where.scene, { preferSource: preferOwn ? actor.id : null })
        .filter(c => !already.has(c.token.id));
    return { where, candidates };
}

/**
 * THE TRACES THIS CHARACTER'S OWN OBSERVES ARE BEING SCORED ON (H84, 27.10.2026; the owner's session on 1.2.85, triage A3).
 * `observeCandidates` left out only the traces already copied, so an Observe declared while the first one's find waited on
 * the GM's describe window was offered the same trace (the ranking is deterministic), and both made a bullet of it.
 *
 * ONLY WHILE THE FIND IS MADE, NOT FOR EVERY ROW WITHOUT A RESULT (H84 fix G1, 27.10.2026; the end review's H84R-01,
 * H84R-1, H84-SEC-01). 385febe7 held back the trace of every row of the character's with no result, for the pending
 * TTL (an hour). A General, Non-obvious or Follow my traces Observe writes its row before the dice (action-observe.mjs
 * `observeRanked`), and a player who closes the roll window (`abort`), a spend that fails, or an answer that comes after
 * the player's ask gave up leaves a row nothing resolves: the trace was then not offered to that character for the
 * hour - the room's one trace fell to a GM's ruling, of two the other was aimed at (tier 2 "H84-02 ...": offered after
 * an unresolved pick false at 68aa984e, true here). The long wait the triage named is the describe window, and
 * `resolveObserve` marks it (`describing`, key -> character), so that is what holds a trace now: the rows of this
 * character's whose keys are being scored on this client. A second Observe aimed at the trace in the seconds between a
 * row and its resolve is stopped where the bullet is made (`createFind`'s check inside `observeFindKey`). A
 * project-only row aims at no trace.
 */
function pendingTracesOf(actorId) {
    readPending();
    return [...describing].filter(([key, owner]) => owner === actorId).map(([key]) => pending.get(key))
        .filter(entry => entry?.tokenId && !entry.projectOnly).map(entry => entry.tokenId);
}

/** Write one Observe's pending row for the trace `chosen` (and the project `secret`, if any), and answer its key. */
async function pendObserve({ actor, userId, where, declaration, request, chosen, secret = null, key = foundry.utils.randomID(), held = false }) {
    return keepRow(key, {
        at: Date.now(),
        actorId: actor.id,
        // The account that asked for this key (E03) - see `observeResolveRefusal`.
        by: userId,
        room: where.room,
        declaration,
        request,
        tokenId: chosen.token.id,
        sceneId: where.scene?.id ?? null,
        dc: chosen.dc,
        data: chosen.data,
        /* Carried alongside the trace, scored against the same total and at its
           own difficulty. A non-obvious sweep that clears both takes both. */
        projectId: secret?.id ?? null
    // Written through at once: the roll that answers this arrives minutes later, and a GM who reloads in between used to
    // lose the declaration (ACT-08) - at once once paid, since line INVEST of 1.2.122 (`keepRow`).
    }, () => log(`Observe: ${actor.name} is looking at a ${chosen.data.visibility} ${chosen.data.type} in ${where.room} (DC ${chosen.dc}).`), held);
}

/**
 * A declaration's row kept: written through and its log line said (`say`; `pending`, the GMs' store), or, `held`, kept in
 * this browser's memory alone until it is paid for (`unpaid`; `resolveObserve` writes it through and says it then).
 * Answers the key.
 */
const unpaid = new Map();
async function keepRow(key, entry, say, held = false) {
    if (held) {
        unpaid.set(key, { entry, say });
        return key;
    }
    readPending();
    pending.set(key, entry);
    await writePending();
    say();
    return key;
}

/** How many asks this browser holds unpaid (`unpaid`): the suite's, which counts the keys a target step minted. */
export function heldAskCount() {
    return unpaid.size;
}

/** The row of `key` written through now that its roll is paid: held in memory (`unpaid`), or chosen again on the
 *  declaration its key names when the memory lost it. Answers the row, or null. */
async function paidRow(key, actorId, senderId) {
    const held = unpaid.get(key);
    if (held) {
        unpaid.delete(key);
        readPending();
        pending.set(key, held.entry);
        await writePending();
        held.say();
        return pending.get(key) ?? null;
    }
    const declaration = typeof key === "string" ? key.split(".")[0] : null;
    if (!actorId || ![DECLARATIONS.general, DECLARATIONS.nonObvious, DECLARATIONS.followTraces].includes(declaration)) return null;
    const again = await chooseObserveTarget({ actorId, declaration, userId: senderId, key, paid: true });
    readPending();
    return again?.ok ? pending.get(key) ?? null : null;
}

/**
 * A GM's pick from an Observe card, checked and written on the primary (E09 C12): the trace
 * must be one the character could be shown now, in the room they asked in - the list is read
 * again here, never taken from the clicking GM's - and the row is written as
 * `chooseObserveTarget` writes a picked one. `{ ok, key }`, or `{ ok: false, reason }` with
 * nothing written.
 */
export async function pickObserveTarget({ actorId, room, tokenId, userId = null, request = "" } = {}) {
    if (!game.user.isGM) return { ok: false, reason: "notGm" };
    sweepPending();
    const actor = game.actors.get(actorId ?? "");
    if (!actor) return { ok: false, reason: "noActor" };
    const { where, candidates } = await observeCandidates(actor, { room });
    const chosen = candidates.find(c => c.token.id === tokenId);
    /* `held`: the traces left out because this character's find of them is being made here (`pendingTracesOf`), so a
       GM who picked on another browser, whose picker read its own rows, is not offered them again (H84 fix G1; the end
       review's H84R-04): call-gm.mjs `observePickOnPrimary` answers them, `pickFromCard` leaves them out. */
    if (!chosen) return { ok: false, reason: "notThere", held: pendingTracesOf(actor.id) };
    return { ok: true, key: await pendObserve({ actor, userId, where, declaration: DECLARATIONS.specific, request, chosen }) };
}

/**
 * A GM's "Pick a trace" on an Observe card (E09 C12; messenger-app.mjs `pickObserveTrace`):
 * the picker, drawn on this GM's browser from this GM's copy of the ledger - the candidates and
 * their difficulties are on no card - and the pick sent to the primary (`askObservePick`).
 * What the primary answered ("picked", "gone", "notThere"), or null when nothing was asked:
 * the picker closed, or no trace left where the character stands.
 */
export async function pickFromCard({ rid, by, request = "" } = {}) {
    const actor = game.actors.get(by ?? "");
    if (!game.user.isGM || !actor || !rid) return null;
    const { where, candidates: all } = await observeCandidates(actor);
    const held = heldOnPrimary.get(rid);
    const candidates = held ? all.filter(c => !held.has(c.token.id)) : all;
    if (!candidates.length) {
        ui.notifications.warn(game.i18n.format("DRPG.Observe.pickNothing", { name: actor.name }));
        return null;
    }
    const chosen = await askWhichRemnant(actor, where.room, request, candidates, { refuse: false });
    if (!chosen) return null;
    const { askObservePick } = await import("./gm-bridge.mjs");
    const answered = await askObservePick({ rid, actorId: actor.id, tokenId: chosen.token.id });
    if (answered === "picked" || answered === "gone") heldOnPrimary.delete(rid);
    return answered;
}

/**
 * The traces the primary GM said it leaves out of an Observe card's pick, by the card's request id (H84 fix G1; the end
 * review's H84R-04): the character's find of them is being made there (`pendingTracesOf` holds the primary's rows, and
 * each GM's rows are its own). Without this a second GM's picker, read from its own rows, led with the trace the primary
 * had just answered "notThere" for, and opened so again. Noted by bridge-asks.mjs `askObservePick` from the primary's
 * answer; read by `pickFromCard`; dropped once the card is picked or gone.
 */
const heldOnPrimary = new Map();

/** The primary's `held` for an Observe card's request `rid` (bridge-asks.mjs `askObservePick`): ids of traces. */
export function noteHeldOnPrimary(rid, ids = []) {
    if (!rid) return;
    const known = heldOnPrimary.get(rid) ?? new Set();
    for (const id of ids ?? []) if (typeof id === "string" && id) known.add(id);
    if (known.size) heldOnPrimary.set(rid, known);
}

/* ==========================================================================
 * THE OTHER THING IN THE ROOM - a secret project
 * ========================================================================== */

/** The secret projects where the observer stands (`locateActor`'s place: the room on its scene) that their account is not in on. */
async function hiddenProjectsFor(actor, where) {
    try {
        const { secretsUnknownIn } = await import("./projects.mjs");
        return secretsUnknownIn(where, ownerOf(actor));
    } catch (err) {
        // A world with no projects, or a module half-loaded. Finding nothing is
        // the safe direction: it leaves Observe exactly as it was.
        error("Could not read the room's secret projects", err);
        return [];
    }
}

/**
 * Which one, when a room is hiding more than one.
 *
 * THE FURTHEST ALONG. A project near its target is the bigger thing under the
 * tarp - more of it has been built, more of it is in the way - so it is the one
 * a sweep of the room walks into first. Compared as a SHARE of the target rather
 * than in raw points, because two projects with different targets are not
 * comparable any other way: 3 of 4 is nearly finished and 3 of 12 has barely
 * started.
 *
 * A project with no target at all sorts last rather than dividing by zero.
 */
function pickHidden(projects) {
    if (!projects?.length) return null;
    const share = p => (p.start > 0 ? p.current / p.start : -1);
    return projects.reduce((best, p) => share(p) > share(best) ? p : best);
}

/**
 * Let this observer in on the project they just noticed.
 *
 * `shareWith` is the same call the GM makes when a killer brings somebody in,
 * and it is the right one: being in on a project is one state, not two, and a
 * second "found it but only sort of" state would be a new thing for every
 * reader of `canSee` to learn. What follows from it - the row in the tray, the
 * token on the map - is stage 2's work and needs nothing here.
 *
 * EVERY account that holds the character, not just the first. `ownerOf` picks
 * one user for a whisper, which is right for a message and wrong for access: a
 * character played by two people would leave one of them staring at a project
 * their own character found.
 *
 * Told to the GMs as well as the finder. They have no other way of learning it
 * happened, and the one control that can undo it - `unshareWith` - is theirs.
 *
 * @returns {Promise<boolean>} whether anything was shared.
 */
async function shareFoundProject(actor, projectId) {
    const ids = ownerIdsOf(actor);
    if (!ids.length) return false;

    const { shareWith, allProjects } = await import("./projects.mjs");
    const project = allProjects().find(p => p.id === projectId);
    if (!project) return false;

    for (const userId of ids) await shareWith(projectId, userId);
    // Noted as found, not shared (E15 part 2 C2): a Secret Passage's completion gives a finder no passage, only its card.
    const { noteProjectFound } = await import("./projects.mjs");
    await noteProjectFound(projectId, ids);

    /* `shareWith` writes the countdown's OWNERSHIP, which is Daggerheart's own
       setting - so none of this module's `onChange` refreshes fire and the
       finder's tray and map would have shown the project only when something
       else happened to redraw them. `SYNC.projects` is the kind that redraws
       exactly those two (sync.mjs), and it is announced from here because this
       is the only path that changes a project's ownership without also touching
       `projectMeta`, which is what normally carries the news. */
    try {
        const { broadcast, SYNC } = await import("./sync.mjs");
        broadcast(SYNC.projects, {});
    } catch (err) {
        error("Could not announce a project somebody just found", err);
    }

    await whisperToOwner(actor, `
        <p><strong>${game.i18n.localize("DRPG.Observe.projectFoundTitle")}</strong></p>
        <p>${game.i18n.format("DRPG.Observe.projectFound", {
            name: foundry.utils.escapeHTML(project.name ?? "-")
        })}</p>`,
        withCentre({ flags: { [MODULE_ID]: { sfx: "projectFound" } } }));

    log(`Observe: ${actor.name} found the secret project "${project.name}".`);
    return true;
}

/**
 * Score the total against the project's own difficulty, if there is one here.
 *
 * Its own number and its own verdict, deliberately separate from the trace's:
 * they are two different objects at two different difficulties, and a roll can
 * clear one and not the other in either direction. The trace's verdict is not
 * consulted and must not be - a miss on a DC 21 trace that still cleared 18 has
 * found the project, and saying otherwise would make the easier thing depend on
 * the harder one.
 *
 * @returns {Promise<string|null>} the project's id when it was found.
 */
async function noticeSecretProject(actor, entry, total, isCritical) {
    if (!entry.projectId) return null;
    if (!isCritical && total < PROJECT_OBSERVE.dc) return null;
    const shared = await shareFoundProject(actor, entry.projectId);
    return shared ? entry.projectId : null;
}

/**
 * How recently a Remnant was left, as one comparable number.
 *
 * Remnants are stamped with the chapter, day and time of day they were dropped.
 * Packed largest-unit-first so ordinary `-` comparison sorts them, and a missing
 * stamp counts as the oldest thing in the room rather than the newest - an
 * unstamped Remnant is one from before this bookkeeping existed, and it should
 * not outrank a trace from the body currently on the floor.
 */
function recencyOf(data) {
    const time = TIMES_OF_DAY.indexOf(data?.timeOfDay);
    return (Number(data?.chapter) || 0) * 1e6
         + (Number(data?.day) || 0) * 1e3
         + (time < 0 ? 0 : time);
}

/**
 * The shelf an untargeted Observe picks from, in difficulty order.
 *
 * Three tiers, and the first non-empty one wins outright:
 *
 *   1. traces of the most recent incident   the guide's "w pierwszej kolejności"
 *   2. anything else tied to a crime        an older murder still beats scenery
 *   3. everything in the room               nothing is tied; there is no
 *                                           preference left to express
 *
 * Tier 1 is what `tiedToCrime` alone could never give: it is a flag, not a date,
 * so by the third chapter every Remnant in the building carries it and the
 * preference stops meaning anything. Measured on the test world - 34 Remnants,
 * all of them tied, spanning five different days.
 *
 * The input is already sorted by difficulty and that order is preserved here, so
 * the caller can keep taking the first or the last.
 */
function mostRelevant(candidates) {
    const tied = candidates.filter(c => c.data.tiedToCrime);
    if (!tied.length) return candidates;

    const newest = Math.max(...tied.map(c => recencyOf(c.data)));
    const latest = tied.filter(c => recencyOf(c.data) === newest);
    return latest.length ? latest : tied;
}

/**
 * One option of the GM's trace picker (`askWhichRemnant`): the name the GM gave the trace, then its visibility and type,
 * whether it is tied, its subject and its DC.
 *
 * THE NAME FIRST (H84-07, 27.10.2026; the owner's live session on 1.2.85, triage B5). The options read
 * "<visibility> <type> · tied · <subject> · DC n" and left out `public.name`, which the GM wrote when the trace was
 * first described and which is what the Truth Bullet will be called: two Prep traces with no subject in one room read
 * the same, and the GM chose between them blind. The GM panel's Give a Truth Bullet (gm-items.mjs
 * `bulletTraceOptions`) leads with the name already. A trace with no name yet starts with its type, as before - not
 * with the neutral token name, which every trace shares. Pure, for tier 1 R1008.
 */
export function remnantPickLabel({ data = {}, dc = null } = {}) {
    return [
        data.public?.name || null,
        `${data.visibilityLabel} ${data.typeLabel}`,
        data.tiedToCrime ? game.i18n.localize("DRPG.Observe.tiedFlag") : null,
        data.subject || null,
        `DC ${dc}`
    ].filter(Boolean).join(" · ");
}

/**
 * The GM decides which trace is closest to what the player asked for. From a card
 * (`refuse: false`) the picker has no Refuse of its own: the card has one, and closing the
 * picker leaves the card to be answered.
 */
async function askWhichRemnant(actor, room, request, candidates, { refuse = true } = {}) {
    const options = candidates.map((c, i) => `<option value="${i}">${foundry.utils.escapeHTML(remnantPickLabel(c))}</option>`).join("");

    // On the kit's frame (E21 C5a): the pick the primary; Refuse, the GM's no, a secondary.
    const picked = await drpgWindow({
        title: game.i18n.localize("DRPG.Observe.pickTitle"),
        classes: ["drpg-panel"],
        // A GM's ruling on an Observe the player waits on: kept above the sheet (stacking.mjs; E23 C5a).
        prompt: true,
        body: `<form>
            <p>${game.i18n.format("DRPG.Observe.pickIntro", {
                actor: foundry.utils.escapeHTML(actor.name),
                room: foundry.utils.escapeHTML(room)
            })}</p>
            <blockquote>${foundry.utils.escapeHTML(request || game.i18n.localize("DRPG.Observe.noRequest"))}</blockquote>
            <label>${game.i18n.localize("DRPG.Observe.whichRemnant")}
                <select name="remnant">${options}</select></label>
            <p class="notes">${game.i18n.localize("DRPG.Observe.pickNote")}</p>
        </form>`,
        footer: {
            primary: {
                action: "ok", label: game.i18n.localize("DRPG.Observe.pickConfirm"),
                callback: (e, b, d) => d.element.querySelector("[name=remnant]").value
            },
            secondary: refuse ? [{ action: "refuse", label: game.i18n.localize("DRPG.Observe.pickRefuse"), tooltip: tipText("DRPG.Tips.Actions.nothingMatchesRefuseTooltip") }] : []
        },
        rejectClose: false
    });

    if (picked === null || picked === undefined || picked === "refuse") return null;
    return candidates[Number(picked)] ?? null;
}

/* ==========================================================================
 * PHASE 2 - WHAT THE DICE DID
 * ========================================================================== */

/**
 * Why a resolve of this Observe is refused, or null.
 *
 * A KEY IS ONE PERSON'S, FOR ONE CHARACTER, ONCE (E03, 24.09.2026; audit S05-03).
 * The key was the whole of the check: the bridge made sure the sender owned the
 * character NAMED IN THE PACKET, and this file then acted on the character named
 * IN THE ENTRY, and never compared the two. The key sat on its owner's character
 * as part of the Reroll bookmark (`lastAction`), which every client could read. So a
 * player could take somebody else's key, name their own character, send a total
 * of 0 with `undo`, and this client deleted the other player's Truth Bullet and
 * then charged them the Sanity for a miss. The key could be used again for an
 * hour.
 *
 * Now the character has to be the entry's, the account has to be the one the
 * key was minted for, a key is resolved once, and an undo needs a result to undo.
 * Since E05 C7 the bookmark is out of world data (the GMs' store since E08+E28 C4a), so the
 * key is no longer in world data either; these checks stay, because they are what
 * holds whatever a packet claims.
 * Pure, so the suite can hold it to that with an entry it made up.
 *
 * @param {object} entry  The pending entry.
 * @param {object} asked
 * @param {string|null} asked.actorId     The character the request names.
 * @param {string|null} asked.senderId    Who sent it.
 * @param {boolean}     asked.senderIsGm
 * @param {boolean}     asked.undo
 * @returns {string|null}
 */
export function observeResolveRefusal(entry, { actorId = null, senderId = null, senderIsGm = false, undo = false } = {}) {
    if (!entry) return "no such Observe";
    if (actorId && entry.actorId !== actorId) return "that Observe belongs to another character";
    if (!senderIsGm && entry.by && entry.by !== senderId) return "that Observe was declared by somebody else";
    if (!undo && entry.result) return "that Observe has already been resolved";
    if (undo && !entry.result) return "that Observe has no result to take back";
    return null;
}

/**
 * Score a thrown Observe against the target chosen in phase 1.
 *
 * @param {object} options
 * @param {string} options.key         From `chooseObserveTarget`.
 * @param {number} options.total
 * @param {boolean} options.isCritical
 * @param {boolean} [options.undo]     A Reroll replacing an earlier result.
 * @param {string|null} [options.senderId]  Who sent it, when it came over the bridge.
 * @param {boolean} [options.senderIsGm]
 * @returns {Promise<object|null>} `{ refused }` when `observeResolveRefusal` says no.
 */
export async function resolveObserve({ key, total, isCritical = false, undo = false,
    actorId = null, senderId = null, senderIsGm = true,
    // The roll it was thrown with, for the GMs' fact of the result (fix r1-G2): `scoreObserve`.
    rollId = null } = {}) {
    if (!game.user.isGM) return null;
    // THE CACHE FIRST, THEN THE SWEEP. A sweep over an unloaded cache is a sweep
    // over nothing, and it would then write that nothing back (ACT-08).
    readPending();
    await sweepPending();

    // an ask held unpaid is written through here, at its paid roll (line INVEST of 1.2.122; `chooseObserveTarget`)
    const entry = pending.get(key) ?? (undo ? null : await paidRow(key, actorId, senderId));
    if (!entry) {
        /*
         * NO RECORD, AND BOTH SCREENS ARE TOLD (ACT-08, 20.09).
         *
         * The store outlives a reload now, so what is left here is the hour-long
         * sweep and the case this cannot reach: a declaration minted on one GM's
         * browser and asked of another's, which happens when the primary changes.
         *
         * IT USED TO SAY NOTHING AT ALL FOR A FRESH OBSERVE. The comment here called
         * that acceptable "because it simply gets declared again", and read from
         * source it is not: `observeRanked` and `observeSpecific` both spend the
         * action BEFORE the roll, and `settleObserveRoll` never reads this function's
         * answer - so the action was gone, the dice were thrown, and nobody was told
         * anything. On a General or Non-obvious sweep the player is not even asked to
         * wait, so there is no moment at which the silence starts looking wrong.
         *
         * DELIBERATELY NO AUTOMATIC REFUND: the action was spent on the player's
         * client and Observe is not in `PRICE_CHAINS`, so there is no receipt for this
         * side to hand back. A refund driven from a socket payload's claim about what
         * was paid is ACT-12 with the names changed.
         */
        warn(`Observe: no pending target for key ${key}.`);
        const stranded = actorId ? game.actors.get(actorId) : null;
        await whisperToGms({ tone: "warning", body: `<p>${game.i18n.format(
            undo ? "DRPG.Observe.rerollLost" : "DRPG.Observe.resolveLost",
            // Escaped (E02 review): this card is written on the GM's client and
            // stored as the GM's own, and the name is the one field of it a
            // player can set - by renaming their character from the console.
            { name: foundry.utils.escapeHTML(stranded?.name ?? "?"), total }
        )}</p>` });
        if (stranded) {
            await whisperToOwner(stranded, { tone: "warning", body: `<p>${
                game.i18n.localize("DRPG.Observe.resolveLostOwner")}</p>` });
        }
        return null;
    }

    const refused = observeResolveRefusal(entry, { actorId, senderId, senderIsGm, undo });
    if (refused) return { refused };
    /* A SECOND RESOLVE OF ONE OBSERVE WHILE ITS FIND IS DESCRIBED (H84, 27.10.2026): the result is written once the GM
       has described the find, so a second resolve of the key in that time passed `observeResolveRefusal` and scored it
       again - a second bullet, or (since `createFind` re-checks the copy) a result with none written over the first's.
       Refused as the Reroll is in that time (reason "busy", bridge-guards.mjs); tier 2 "H84-02 ...". */
    if (!undo && describing.has(key)) return { refused: "the GM is still describing what that Observe found" };

    const actor = game.actors.get(entry.actorId);
    if (!actor) return null;
    describing.set(key, actor.id);
    try {
        return await scoreObserve(actor, entry, key, { total, isCritical, undo, rollId, by: senderId });
    } finally {
        describing.delete(key);
    }
}

/**
 * THE OBSERVES BEING SCORED ON THIS CLIENT, key -> character (E08+E28 C6a, 03.10.2026; audit
 * S05-22). From the checks to the written result a resolve waits on the GM's dialog for as
 * long as the GM takes (`describeFind`), and a Reroll asked then has no result to take back yet: reroll.mjs
 * `replayRefusal` asks this and refuses before anything is paid. The plan's 2.5 put the mark on
 * the entry (`entry.busy`); it is kept beside the cache instead, because every entry of the
 * cache is written through to a store that outlives a reload (`writePending`) - a mark written
 * with it by another Observe's write, and a reload in the dialog, would have refused that
 * Observe's Reroll for the hour the entry lives. Asked on the client the Reroll is made on,
 * which is the one that resolves: both go to the primary GM, or both stay on a GM's own.
 */
const describing = new Map();

/** Whether an Observe of `actorId`'s is being scored on this client now. */
export function observeBeingDescribed(actorId) {
    return [...describing.values()].includes(actorId);
}

/** `resolveObserve`'s scoring, once its checks have passed. */
async function scoreObserve(actor, entry, key, { total, isCritical, undo, rollId = null, by = null }) {
    // The roll this result is for (E08+E28 C2): describing a find can wait on a GM's dialog, and
    // a roll thrown meanwhile is not this one (`keepResult`). The one the resolve's packet names,
    // and its sender's (fix r1-G2; action-pipeline.mjs `rollOfFact`).
    const rolls = await import("./action-rolls.mjs");
    const roll = rolls.rollOfFact({ undo, rollId, by, actorId: actor.id, actions: ["observe"] });

    // A Reroll replaces a result rather than adding to it. What the first throw
    // produced is recorded here rather than sent to the observer and quoted
    // back: the bullet is part of the answer key's bookkeeping, and the player's
    // client has no business knowing which item id to name.
    // the empty room's card the earlier throw was ruled on (`nothingHere`, below), read before the undo clears the result
    const earlierCard = undo && entry.nothingHere ? entry.result?.cardId ?? null : null;
    if (undo) await undoPrevious(actor, entry);

    entry.at = Date.now();

    /* THE BOOKMARK RECORDS WHAT WAS MARKED, NOT WHAT THE RULE ASKS FOR
       (ACT-17, 20.09). A character already at their maximum takes no mark, and
       an undo that trusted the constant handed back Sanity nobody had spent - so
       both misses below keep what `applyFailure` reports, not OBSERVE_FAIL_STRESS.

       AND EVERY RESULT IS WRITTEN THROUGH (ACT-08). `entry.result` is what a
       Reroll's undo reads, and a GM who reloads between the throw and the Reroll
       must come back to the result that actually stands. */

    /* THE ROOM'S ONLY SECRET IS A PROJECT (stage 3).
       -----------------------------------------------------------------------
       No trace was chosen because there was none left to choose, so there is
       nothing to create and nothing to describe - the whole of the result is
       whether the total cleared the project's own number. A miss still costs
       the Sanity every missed Observe costs: the action was spent looking. */
    /* A ROOM WITH NOTHING TO FIND (line INVEST of 1.2.122): ruled by the GMs on a card, as the player's browser did
       when the target step still said so (`chooseObserveTarget`). Nothing is written to the character here: the card's
       Miss charges the miss, as before. A Reroll asks again, on a card of its own. */
    if (entry.nothingHere) {
        const [{ observeRulingCall }, { callGm, callCardHtml }, { ACTIONS }] = await Promise.all([import("./action-observe.mjs"), import("./gm-bridge.mjs"), import("./config.mjs")]);
        const { locateActor } = await import("./movement.mjs");
        const scene = entry.sceneId ? game.scenes.get(entry.sceneId) ?? null : null;
        const here = locateActor(actor);
        const call = observeRulingCall(actor, { label: ACTIONS.observe?.label ?? "Observe", roll: { trait: "eye", total, isCritical },
            request: entry.request ?? "", declaration: entry.declaration ?? null, where: here?.room ? here : { room: entry.room, scene } });
        /* A REROLL RE-SCORES THE SAME ASK ON THE SAME CARD (line INVEST of 1.2.122; the coordinator's 21.11, CASE-33's rest):
           the earlier throw's card, not yet ruled, is written again with the new number and its buttons, and no second card
           is posted. A card the GMs already ruled keeps its ruling, and the new number goes on a card of its own. */
        let cardId = null;
        const earlier = earlierCard ? game.messages?.get(earlierCard) ?? null : null;
        const { cardFlag, updateSecret } = await import("./secret.mjs");
        if (earlier && earlier.getFlag(MODULE_ID, "secret") && !cardFlag(earlier, "settled")) {
            await updateSecret(earlier, callCardHtml(actor, call));
            cardId = earlier.id;
        } else {
            /* IN THE ASKER'S THREAD (the line INVEST of 1.2.123; the auditor's r122-D-4): this card is posted on the primary
               GM since 1.2.122, and a GM's post that names no thread goes to the first owner (call-gm.mjs `threadOf`), so a
               co-owner's sweep of an empty room was ruled in the other owner's thread. The row keeps the asker (`by`), as
               the primary's other questions pass theirs (tier 2 "1.2.123 r122-D-4"). */
            await callGm(actor, { ...call, thread: entry.by ?? null, onPosted: message => { cardId = message?.id ?? null; } });
        }
        entry.result = { success: false, bulletId: null, projectId: null, stress: 0, ruled: true, cardId };
        await keepResult(rolls, roll, key, entry);
        return { success: false, key, ruled: true };
    }

    if (entry.projectOnly) {
        const found = await noticeSecretProject(actor, entry, total, isCritical);
        if (!found) {
            const marked = await applyFailure(actor, total, entry);
            entry.result = { success: false, bulletId: null, projectId: null, stress: marked };
            await keepResult(rolls, roll, key, entry);
            return { success: false, key };
        }
        entry.result = { success: true, bulletId: null, projectId: found, stress: 0 };
        await keepResult(rolls, roll, key, entry);
        return { success: true, key };
    }

    const success = isCritical || total >= entry.dc;

    /* A FIND BEING DESCRIBED IS MARKED ON ITS ROW (line INVEST of 1.2.122; audit 1.2.118 domain-case-c-investigation 6,
       its rest): the GM's describe window can stand for minutes on this browser alone, and a reload then lost the find -
       nothing resolved the row again. The row (a store this browser keeps over a reload, `observeStore`) says so from
       here until its result is written, with what the find is scored on; `recoverDescribing` finishes such a row when a
       primary GM's stores open, as a window closed unanswered. */
    if (success) {
        // `gm`: whose window it is (the line INVEST of 1.2.123): a GM who leaves without a reload is finished for (below)
        entry.describing = { at: Date.now(), total, isCritical: Boolean(isCritical), rollId, by, gm: game.user?.id ?? null };
        await writePending();
    }
    const item = success ? await createFind(actor, entry, isCritical, { ask: !recovering.has(key), key }) : null;
    // null, not deleted: the store's patch merges a row, so a field left out stays as it was
    if (entry.describing) entry.describing = null;
    const marked = success ? 0 : await applyFailure(actor, total, entry);

    /* THE TRACE'S CARD FIRST, THEN THIS ONE, and the order is the whole reason
       the call is down here rather than beside the verdict: the two cards are
       read in the order they arrive, and "you find nothing" landing UNDER "you
       noticed a project" reads as the project being taken back. Scored against
       the same total at its own difficulty, and not conditioned on `success` -
       see `noticeSecretProject`. */
    const foundProject = await noticeSecretProject(actor, entry, total, isCritical);

    entry.result = {
        success,
        bulletId: item?.id ?? null,
        projectId: foundProject,
        stress: marked
    };
    await keepResult(rolls, roll, key, entry);
    return { success, key };
}

/**
 * Write the result through (ACT-08), and onto the GMs' bookmark of the roll it is for
 * (E08+E28 C2): the key and the result a Reroll on a GM undoes (C4a). The target was
 * chosen before that roll was thrown, so it is the entry's, read by its key, and not a
 * fact of the row - the row the target step would have found was the roll before.
 */
async function keepResult(rolls, roll, key, entry) {
    /* The entry this resolve holds is the row written (2.0 line T3 INV-01): a store change meanwhile - another GM's words
       on the row, `describeAnswer` - empties the cache for its next read (`readPending`), which then holds a copy, and the
       result written to this entry would not be the cache's. Set back first, so the write carries it. */
    pending.set(key, entry);
    await writePending();
    await rolls.noteFactOn(roll, { observeKey: key, observeResult: structuredClone(entry.result) });
}

/** Put back whatever the previous throw of this same Observe did. */
async function undoPrevious(actor, entry) {
    const previous = entry.result;
    if (!previous) return;

    if (previous.bulletId) {
        const item = actor.items.get(previous.bulletId);
        if (item) {
            const uuid = item.uuid;
            try {
                await item.delete();
                await dropSecret(uuid);
            } catch (err) {
                error("Could not take back the Truth Bullet a reroll undid", err);
            }
        }
    }

    /* A project the first throw noticed has to be un-noticed, for exactly the
       reason the Truth Bullet above does: a Reroll takes the dice back, so
       everything they bought goes back with them. `unshareWith` is GM-only and
       this whole file is GM-only, so there is no bridge to cross.

       The finder is not told. They were told they found it; being told they
       un-found it would be the module narrating its own bookkeeping, and the
       second throw's result is about to say what they actually found. */
    if (previous.projectId) {
        try {
            const { unshareWith } = await import("./projects.mjs");
            for (const userId of ownerIdsOf(actor)) await unshareWith(previous.projectId, userId);
        } catch (err) {
            error("Could not take back the project a reroll undid", err);
        }
    }

    // Sanity taken for a miss that is no longer a miss has to come back, or a
    // Reroll would charge for a failure it just erased. A give-back, so the GMs'
    // audit takes the credit the miss left (fix r2-H6, resource-guard.mjs `stampOf`).
    if (previous.stress) {
        const marks = resourceValue(actor, "stress");
        const next = Math.max(0, marks - previous.stress);
        if (next !== marks) {
            try {
                await trustedWrite(actor, { "system.resources.stress.value": next }, { reason: "reroll", giveBack: true });
            } catch (err) {
                error("Could not return the Sanity a reroll undid", err);
            }
        }
    }

    /* The undo is a mutation of the store like any other (ACT-08): a Reroll that
       wound the first throw back and then lost the browser would otherwise come
       back to a record claiming the first result still stands. */
    entry.result = null;
    await writePending();
}

/**
 * What a failed Observe costs, wherever it was decided (ACT-17, 20.09).
 *
 * Extracted from `applyFailure` so there is ONE writer of an Observe miss: the
 * scored road calls it through that function, and a GM who rules "nothing was
 * there" on the ask-the-GM road calls it from the card. Before this the second
 * road charged nothing and refunded the action, which made asking a human the
 * cheaper way to look.
 *
 * A miss costs OBSERVE_FAIL_STRESS Sanity (1). Sanity is a reverse resource in
 * Daggerheart: marks count up towards the maximum, so a failure raises the value.
 *
 * @returns {Promise<number>} the marks actually taken - 0 for a character who
 *   was already at their maximum.
 */
export async function chargeObserveMiss(actor, { total = null, dc = null } = {}) {
    if (!actor) return 0;
    // Held to the marks and the maximum the GMs hold (sheet-audit.mjs `meansWrite`, E29 fix r2-H24): a console's
    // lowered maximum, not put back yet, took the mark off the miss.
    const { meansWrite } = await import("./sheet-audit.mjs");
    const marked = await meansWrite(actor, async ({ stress: marks }, maxOf) => {
        const next = Math.min(maxOf("stress") ?? 0, marks + OBSERVE_FAIL_STRESS);
        if (next - marks > 0) {
            try {
                await trustedWrite(actor, { "system.resources.stress.value": next }, { reason: "price" });
            } catch (err) {
                error("Could not apply the Sanity from a failed Observe", err);
            }
        }
        return next - marks;
    });

    /*
     * It costs 1 Sanity and looks exactly like a success until the card is read.
     *
     * ON THE CARD. This said "local, on the observer's client" and was wrong the
     * same way `identify` in analyze.mjs was: `resolveObserve` is GM-only, so every
     * failed Observe since E5 beeped at the GM and left the observer - the one
     * person the catalogue names - in silence.
     *
     * THE SANITY LINE ONLY WHEN SANITY WAS MARKED (E09 C14, 08.10.2026; audit S05-35). The
     * card said "You take 1 Sanity" off the constant, and a character already at their
     * maximum, who takes no mark (`marked` 0 above), read a price nobody took.
     */
    const stressLine = marked > 0 ? ` ${game.i18n.format("DRPG.Observe.failedStress", { stress: marked })}` : "";
    await whisperToOwner(actor, `
        <p><strong>${game.i18n.localize("DRPG.Observe.failedTitle")}</strong></p>
        <p>${game.i18n.localize("DRPG.Observe.failed")}${stressLine}</p>`,
        withCentre({ flags: { [MODULE_ID]: { sfx: "observeFail" } } }));

    log(total === null
        ? `Observe: ${actor.name} was told there was nothing there.`
        : `Observe: ${actor.name} rolled ${total} against DC ${dc} and found nothing.`);
    return marked;
}

/** The scored road's miss: the same charge, with the roll in the log line. */
async function applyFailure(actor, total, entry) {
    return chargeObserveMiss(actor, { total, dc: entry.dc });
}

/**
 * Turn the Remnant into a Truth Bullet on the observer's sheet.
 *
 * The GM is asked what the character actually sees, prefilled from the Remnant.
 * That is a human sentence the module cannot write, and this is the moment the
 * table is waiting on it anyway. Cancelling still creates the bullet with the
 * prefilled text: a result that has already been rolled must never evaporate
 * because a dialog was dismissed.
 */
async function createFind(actor, entry, isCritical, { ask = true, key = null } = {}) {
    const data = entry.data;
    const fallbackName = data.subject
        || game.i18n.format("DRPG.Observe.defaultName", { room: entry.room });

    /*
     * ONE TRACE, ONE DESCRIPTION - now `public` on the Remnant itself, not a
     * field private to this file.
     *
     * The GM used to be asked to describe the find on EVERY observation, and the
     * answer went onto that one player's Truth Bullet and nowhere else. Two
     * people looking at the same smear on the same wall therefore got two
     * different names for it, written minutes apart by a GM with no reminder of
     * what they had said the first time - and in a game whose entire endgame is
     * players comparing notes in a trial, two names for one object is not a
     * cosmetic problem. It is a false contradiction the table has to spend the
     * trial resolving.
     *
     * So the description IS the Remnant's `public.name`/`public.playerText` -
     * see remnants.mjs - written back the first time it is given, and every
     * later observer (and the Investigation Dashboard, and the token itself
     * once revealed) reads the same words without the GM being asked again.
     *
     * A CRITICAL still asks. The guide gives it "a big hint from the GM" on top
     * of the category (p. 30), so there is genuinely something new to say - and
     * the box opens prefilled with what the trace is already called, so pressing
     * straight through keeps the name identical.
     *
     * AN UNDESCRIBED TRACE IS OFFERED ITS SUBJECT (E51 C5, 31.10.2026; audit S05-52). Its
     * stored name was the neutral word, compared against the word in this browser's
     * language, and the box opened on "Trace": a busy GM pressing on gave the players
     * bullets called "Trace" (tier 2 E51-T12 at C5's parent: the box offered the word, and
     * the copy of a find whose window closed unanswered was named it). An undescribed
     * trace's name is empty now (remnants.mjs `defaultPublic`), and the box offers what the
     * trace was about (`fallbackName`: its subject, else the room's default name). The
     * window answered marks the trace as a GM's (`markRemnantEditedById`), as the
     * dashboard's Save does, so the reveal a moment later whispers the GMs no "nobody has
     * said what it is" for the words just written (E51-T13 at the parent: one).
     */
    const { remnantPublicById, setRemnantPublicById, markRemnantEditedById } = await import("./remnants.mjs");

    // A copy already held is no find (H84; `alreadyHeld` below): asked before the GM is asked to describe it.
    if (copiedRemnants(actor).has(entry.tokenId)) return alreadyHeld(actor, entry);

    /*
     * ONE DESCRIPTION, ASKED ONCE, WHOEVER ELSE FINDS IT MEANWHILE (1.2.121 line K, 21.11.2026; the audit's CASE-18). The
     * record was read once, before the window, and Observe's bridge row has no queue, so a second student's find of the
     * same undescribed trace resolved while the window stood read the same empty record and opened a second window;
     * confirmed as drawn it wrote the fallback name and two empty boxes over the first answer (on the trace and on the
     * first finder's copy, truth-bullets.mjs), and closed it minted the second copy from the stale read. Red at e515907d
     * (tier 2 "1.2.121 CASE-18"): two windows, and both bullets and the record read "Remnant - Dorm A" with no words.
     * A find of a trace whose description is being asked on this GM waits for that answer (`describingTraces`) and
     * then reads the record: the first finder's words, asked of nobody again - or, if the first window closed with
     * nothing, its own window. A wait for a person, so not `serialWrite` (its steps await nothing that may never
     * answer); the wait and the read that follows it share no await, so two waiters cannot both find the trace free.
     */
    const traceKey = `${entry.sceneId}.${entry.tokenId}`;
    for (let asking = describingTraces.get(traceKey); asking; asking = describingTraces.get(traceKey)) await asking;

    const stored = remnantPublicById(entry.sceneId, entry.tokenId);
    // Has anybody described this yet? A trace nobody has has no name (E51 C5).
    const described = stored?.name ? stored : null;

    let written = described, pub = stored;
    // a find finished after a reload (`recoverDescribing`) asks nobody: the window it waited on is gone
    if (ask && (!described || isCritical)) {
        const asked = (async () => {
            written = await describeFind(actor, entry, isCritical, described?.name || fallbackName, described, { key });
            // Written back on the GM's client, where the ledger lives. Only when there
            // is something to write: a dismissed dialog must not overwrite a good
            // description with an empty one.
            if (written?.name && written.name !== described?.name
                || written?.playerText && written.playerText !== described?.playerText
                || written?.analyzedText && written.analyzedText !== described?.analyzedText) {
                try {
                    pub = await setRemnantPublicById(entry.sceneId, entry.tokenId, {
                        name: written.name || described?.name || fallbackName,
                        playerText: written.playerText || described?.playerText || "",
                        analyzedText: written.analyzedText || described?.analyzedText || ""
                    });
                    await markRemnantEditedById(entry.sceneId, entry.tokenId);
                } catch (err) {
                    error("Could not record the description on the Remnant", err);
                }
            }
        })();
        const held = asked.catch(() => null);
        describingTraces.set(traceKey, held);
        try {
            await asked;
        } finally {
            if (describingTraces.get(traceKey) === held) describingTraces.delete(traceKey);
        }
    }

    /* ONE COPY PER CHARACTER, CHECKED WHERE IT IS MADE (H84, 27.10.2026; triage A3). The check above runs before the
       GM's describe window, which waits as long as the GM takes; two Observes aimed at one trace (declared before
       either one's find was being made: `pendingTracesOf` holds a trace only then) both passed it and both made a bullet - tier 2 "H84-02 ...": 2 with this
       check taken out (mutant h8402-noRecheck, 27.10.2026), 1 here. The copy is read again and the bullet made in one step of `serialWrite` under the character's
       key, after the window: the step awaits the create and its secret, never a person. */
    const texts = findTexts({ pub, written, isCritical });
    const made = await mintFindCopy(actor, entry, {
        name: pub?.name || written?.name || fallbackName,
        playerText: texts.copyText,
        analyzedText: pub?.analyzedText ?? written?.analyzedText ?? "",
        img: pub?.img ?? null,
        isCritical
    });
    if (made === HELD) return alreadyHeld(actor, entry);
    const item = made;

    if (!item) return null;

    await whisperToOwner(actor, `
        <h3>${game.i18n.localize("DRPG.TruthBullet.received")}</h3>
        <p><strong>${foundry.utils.escapeHTML(item.name)}</strong></p>
        ${pub?.playerText ? `<p>${foundry.utils.escapeHTML(pub.playerText)}</p>` : ""}
        ${texts.hint ? `<p>${foundry.utils.escapeHTML(texts.hint)}</p>` : ""}
        ${isCritical ? `<p><em>${game.i18n.localize("DRPG.Observe.critIdentified")}</em></p>` : ""}
        <p><small>${game.i18n.localize("DRPG.TruthBullet.whereToFind")}</small></p>`, withCentre());

    log(`Observe: ${actor.name} copied a ${data.type} Remnant as "${item.name}".`);
    return item;
}

/**
 * What a find's copy says, and what of it is the finder's alone (E64 C2; audit S05-59). `pub` is the trace's public
 * record after the window's write, `written` what the window answered. The copy's text is the trace's description and,
 * on a critical, the hint below it; the hint is never in what `createFind` writes back to the trace (it reads
 * `written.playerText`, never `critHint`). Pure, for tier 1 R3955.
 */
export function findTexts({ pub = null, written = null, isCritical = false } = {}) {
    const described = pub?.playerText ?? written?.playerText ?? "";
    const hint = isCritical ? String(written?.critHint ?? "").trim() : "";
    return { described, hint, copyText: [described, hint].filter(Boolean).join("\n\n") };
}

/**
 * A find's copy of the trace `entry` names (`{ tokenId, sceneId, room, data }`, `data` the GMs' row of it), made on
 * the GM in the character's step (`observeFindKey`): none when a copy is held already (`HELD`), else the bullet,
 * as the trace stands, and the trace revealed to its finder (`revealRemnantToFinder`; `tell` false keeps the GMs'
 * "say what it is" whisper back). Observe's own (`createFind`) and, since E70 C12, the copy a successful Tamper
 * hands the trace's author (cleanup.mjs `authorsCopy`): one road, so the two are the same bullet.
 */
export async function mintFindCopy(actor, entry, { name, playerText = "", analyzedText = "", img = null, isCritical = false, tell = true, told = false } = {}) {
    const data = entry.data;
    const made = await serialWrite(observeFindKey(actor.id), () => copiedRemnants(actor).has(entry.tokenId) ? HELD : createTruthBullet(actor, {
        name,
        realType: data.type,
        /*
         * A critical identifies the category outright - guide, p. 30: "Truth
         * Bullet ze zidentyfikowaną kategorią i duża podpowiedź od DMa."
         *
         * `null` FOR EVERYONE ELSE MEANS "LET THE RULES DECIDE", which is what
         * `createTruthBullet` does with it: Neutral for an analysable type, the
         * real type for Key, Final and Autopsy. It used to force the literal
         * "neutral", so a Key trace found on an ordinary success arrived
         * `analyzed: true` under a badge reading Neutral - un-analysable, already
         * wearing the real action's glyph, and publishing the lab reading
         * (`analyzedText`) about a clue nobody had read (T-2, 18.09).
         */
        shownType: isCritical ? data.type : null,
        // ...and the reading with it, which for a Key or a Final is the one thing
        // a critical adds over an ordinary find: their kind shows either way
        // (21.09). `null` lets the rules decide, as above.
        analyzed: isCritical ? true : null,
        visibility: data.visibility,
        faint: Boolean(data.faint),
        playerText,
        // What analysis will say, filed with the bullet now so a later Head roll
        // pays out even if the trace itself is wiped before then. It reaches
        // this player's ITEM only on a critical, which identifies outright -
        // `createTruthBullet` is where that is decided, not here.
        analyzedText,
        img,
        gmNote: data.note ?? "",
        remnantId: entry.tokenId,
        sceneId: entry.sceneId,
        // Passed explicitly: this is the GM's client, which may be looking at a
        // different scene entirely, so the canvas-bound default would stamp null.
        room: entry.room,
        // Into the bullet's secret; public on the item only once identified -
        // immediately for this critical find, at Analyze for everyone else.
        sourceAction: data.action ?? null,
        // In three states, and undecided while the trace's tie waits for a death nobody has
        // found, read off the trace as it stands now and not as the Observe was aimed (E09 fix
        // r1-G1; goal G2a): `Boolean()` gave this copy the ledger's tie whole, and this critical
        // find shows it at once (tier 2 "a copy made between the death and the discovery holds
        // the death's tie back until the death is the table's").
        tiedToCrime: tieForCopy(data, { sceneId: entry.sceneId, tokenId: entry.tokenId }),
        // The leaver's own copy of a trace they were told of (remnants.mjs `noteToldTrace`): held, not found (1.2.125 H2).
        told
    }));
    if (made === HELD || !made) return made ?? null;

    // The object is real now, not just a note in the GM's ledger - the first
    // person to copy it reveals the token it came from. See
    // `revealRemnantToFinder` in remnants.mjs for why this is `hidden: false`
    // rather than forcing `visible`, and visibility.mjs for how it then stays
    // invisible to everyone who has not found it themselves.
    try {
        const { revealRemnantToFinderById } = await import("./remnants.mjs");
        await revealRemnantToFinderById(entry.sceneId, entry.tokenId, told ? { tell: false, via: "told" } : { tell });
    } catch (err) {
        error("Could not reveal the Remnant token to its finder", err);
    }
    return made;
}

/** `createFind`'s answer inside its step when the character holds a copy of the trace already. */
const HELD = Symbol("held");

/** The queue key of a character's finds (`createFind`). */
export const observeFindKey = actorId => `observeFind/${actorId}`;

/** The traces whose describe window `createFind` has open on this GM, by `sceneId.tokenId`: the answer's promise, never rejected. */
const describingTraces = new Map();

/** A find of a trace the character holds a copy of: no bullet, the character told, and null for `createFind`. */
async function alreadyHeld(actor, entry) {
    log(`Observe: ${actor.name} already holds a copy of the trace in ${entry.room}; no second Truth Bullet was made.`);
    await whisperToOwner(actor, `<p>${game.i18n.localize("DRPG.Observe.alreadyHeld")}</p>`, withCentre());
    return null;
}

/**
 * The GM's sentence, prefilled. Never blocks the result - see `createFind`.
 *
 * A CLOCK ON THE WINDOW (line INVEST of 1.2.122; audit 1.2.118 domain-case-c-investigation 6): the player's find waits on
 * this window, on this GM's browser alone, and it had no time: hidden behind the map, or on a GM who had turned away, it
 * left the player with a spent action and no card for as long as nobody noticed. It now answers as a close does - the
 * prefilled name and no words, the find landing - once `waitMs` has passed (a GM's ruling's clock, `TIMING.rulingMs`),
 * and the GM is told the find went out under its prefilled name. Not closed: a reload of this GM while it stands still
 * loses the find (no other GM is shown the window, and nothing asks again); that half is a table's, proposed as a live
 * check. Exported for the suite, which hands a short `waitMs` (tier 2 "1.2.122 CASE-37").
 */
export async function describeFind(actor, entry, isCritical, fallbackName, stored = null, { waitMs = TIMING.rulingMs, key = null } = {}) {
    const data = entry.data;
    let shown = null, timer = null, timedOut = false;
    /* ANOTHER GM MAY WRITE IT (E128, 22.11.2026; OWNER-128-SECOND-GM, line CORE's inventory row 1; 2.0 line T3 INV-01,
       27.11.2026). The window opens on the browser the find is resolved on, and on every other full GM's too, from the
       row: the ask is written on the find's row in the GMs' store (`describing.askId`, with the window's prefilled name,
       whether it is a critical, whether the trace had words, its room), and each full GM's browser that is not this one
       opens the same window when the row reaches it - at the store's change, at its stores' opening, after a reload - once
       per ask (`askDescribeFromRows`). Its words come back on the row (`describeAnswer`), which this browser reads
       (`takeRowAnswers`) as it read the bridge's (`observe.describe`, `answerDescribeFrom`, which still answers an older
       whisper's "Write it here"): the first answer of all is the find's - this window is closed when another GM's words
       arrive first, and this GM is told whose they are. Until 1.2.130 the other GMs had a whisper alone, with no window
       and no sound, and a GM who joined later had nothing (Forge S1b and S2 D1). */
    const askId = foundry.utils.randomID();
    let fromOther = null;
    const otherAnswer = new Promise(resolve => { fromOther = resolve; });
    describeAsks.set(askId, fromOther);
    const rowKey = key ?? [...pending].find(([, row]) => row === entry)?.[0] ?? null;
    if (rowKey && entry.describing) {
        entry.describing = { ...entry.describing, askId, fallbackName: String(fallbackName ?? ""), isCritical: Boolean(isCritical),
            stored: Boolean(stored), room: entry.room ?? null };
        describeRows.set(askId, rowKey);
        pending.set(rowKey, entry);
        await writePending();
    }
    /* THE FINDER IS TOLD THE GM IS DESCRIBING IT (2.0 line T3 INV-03, 27.11.2026; the owner's recommendation): a General,
       Non-obvious or Follow my traces sweep is scored here with nobody pressing anything, so its roll's card says no "the
       GM is judging" (action-observe.mjs `settleObserveRoll`), and a find that waits on this window then waited in
       silence for as long as the window stands. Its owners are told once, as the find's own card is (`withCentre`); a
       named Observe's card already says it waits (`DRPG.Observe.sent`), so it is told nothing more here. */
    if (entry.declaration !== "specific" && entry.declaration !== "anything") {
        await whisperToOwner(actor, `<p>${game.i18n.localize("DRPG.Observe.describing")}</p>`, withCentre())
            .catch(err => debug("Could not tell the finder the GM is describing the find", err));
    }
    /* THE OTHER GMs ARE TOLD THE FIND WAITS HERE (line INVEST of 1.2.122; audit 1.2.118 domain-case-c-investigation 6): the
       window opened on this browser alone, and a second GM never learned a player was waiting on it. KEPT AS THE CHAT'S
       RECORD (2.0 line T3 INV-02, the owner's P11 default): the window opens on their screen now, and the whisper's button
       goes once the row has its words (`describeButtonLive`). */
    /* TO THE OTHER GMs ONLY (the line INVEST of 1.2.123; the auditor's r122-D-6): `whisperToGms` whispers every GM, so the
       GM whose screen it is was told the find waits on their own screen. */
    const others = activeGmIds().filter(id => id !== game.user?.id);
    if (others.length) {
        const esc = value => foundry.utils.escapeHTML(String(value ?? ""));
        void whisperToGms({ body: `<p>${game.i18n.format("DRPG.Observe.describeWaiting", {
            actor: esc(actor?.name ?? "?"), room: esc(entry.room ?? "?"), gm: esc(game.user.name ?? "") })}</p>`
            + `<div class="drpg-call-actions"><button type="button" class="drpg-call-action"${tipAttr("DRPG.Observe.describeHereTooltip")} data-drpg-describe-find="${esc(askId)}"`
            + ` data-scene="${esc(entry.sceneId)}" data-token="${esc(entry.tokenId)}" data-actor="${esc(actor?.id)}" data-room="${esc(entry.room)}"`
            + ` data-critical="${isCritical ? "1" : "0"}" data-fallback="${esc(fallbackName)}">${esc(game.i18n.localize("DRPG.Observe.describeHere"))}</button></div>` },
            { whisper: others }).catch(() => {});
    }
    /* THE CLOCK COUNTS FROM THE LAST KEYSTROKE, AND WHAT WAS TYPED GOES OUT (the line INVEST of 1.2.123; the auditor's
       r122-D-2): 1.2.122's clock was one `waitMs` from the window's opening, reset by nothing, and its end answered null -
       so a GM writing for more than three minutes had the window shut under them and the words typed dropped, the toast
       telling them to add words already written. Every input in the window starts the clock again, and at its end the
       window's fields are read as its button reads them; the prefilled name and no words only where nothing was typed
       (tier 2 "1.2.122 CASE-37", "1.2.123 r122-D-2"). */
    const readForm = readDescribeForm;
    let typed = false, ring = null;
    const start = () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            timedOut = true;
            const f = typed ? shown?.element?.querySelector?.("form") : null;
            ring?.(f ? readForm(f) : null);
            Promise.resolve(shown?.close?.()).catch(() => {});
        }, waitMs);
    };
    const clock = new Promise(resolve => { ring = resolve; start(); });

    // On the kit's frame (E21 C5a): one answer, the primary.
    const asked = drpgWindow({
        render: (event, dialog) => {
            shown = dialog;
            if (timedOut) Promise.resolve(dialog?.close?.()).catch(() => {});
            dialog?.element?.addEventListener?.("input", () => { typed = true; if (!timedOut) start(); });
        },
        title: game.i18n.localize("DRPG.Observe.describeTitle"),
        classes: ["drpg-panel"],
        prompt: true,
        body: describeFormBody({ actor, room: entry.room, data, isCritical, fallbackName, stored }),
        footer: {
            primary: {
                action: "ok", label: game.i18n.localize("DRPG.Observe.describeConfirm"),
                callback: (e, b, d) => {
                    return readForm(d.element.querySelector("form"));
                }
            }
        },
        rejectClose: false
    // Closing the dialog resolves to null, which `createFind` reads as "use the
    // prefilled name and no description" - the find still lands either way.
    }).catch(() => null);
    const remote = otherAnswer.then(given => ({ given }));
    // A row's words that came before this wait began (a GM quicker than this browser's own write's echo).
    if (rowKey) takeRowAnswers();
    const raced = await Promise.race([asked, clock, remote]);
    describeAsks.delete(askId);
    describeRows.delete(askId);
    clearTimeout(timer);
    // Another GM's words came first (E128): this window is closed, and this GM told whose words the find carries.
    const byOther = raced && typeof raced === "object" && Object.hasOwn(raced, "given") ? raced.given : null;
    if (byOther) {
        Promise.resolve(shown?.close?.()).catch(() => {});
        ui.notifications?.info?.(game.i18n.format("DRPG.Observe.describeByOther", { gm: game.users.get(byOther.by ?? "")?.name ?? "?" }));
        await markDescribed(rowKey, entry, { askId, by: byOther.by ?? null, name: byOther.answer?.name || stored?.name || fallbackName || "", timedOut: false });
        return byOther.answer;
    }
    const answer = raced;
    /* WHOSE WORDS, ON THE ROW (2.0 line T3 INV-02, INV-05): written before `scoreObserve` clears `describing`, so every other
       GM's window of this ask closes, saying whose words went out under what name, or that nobody answered in time. */
    await markDescribed(rowKey, entry, { askId, by: game.user?.id ?? null, name: answer?.name || stored?.name || fallbackName || "", timedOut });
    if (timedOut) {
        const key = answer ? "DRPG.Observe.describeTimedOutTyped" : "DRPG.Observe.describeTimedOut";
        ui.notifications?.warn?.(game.i18n.format(key, { actor: actor?.name ?? "", name: answer?.name || fallbackName || "" }), { permanent: true });
        /* EVERY GM IS TOLD (2.0 line T3 INV-05): the toast was this browser's alone, so a GM without the window open never
           learned which Truth Bullet waits for its words. A card to the GMs, raised as a GM's card (`gmPopup`). */
        const esc = value => foundry.utils.escapeHTML(String(value ?? ""));
        await whisperToGms({ tone: "warning", body: `<p>${game.i18n.format("DRPG.Observe.describeTimedOutGms", {
            actor: esc(actor?.name ?? "?"), room: esc(entry.room ?? "?"), name: esc(answer?.name || fallbackName || "") })}</p>` },
        { flags: { [MODULE_ID]: { gmPopup: true, popupTitle: game.i18n.localize("DRPG.Observe.describeTitle") } } }).catch(() => {});
    }
    return answer;
}

/** The ask's end written on its row (`described`), in the cache and in the store, once: whose words and under what name. */
async function markDescribed(rowKey, entry, { askId, by, name, timedOut }) {
    if (!rowKey) return;
    entry.described = { askId, by, name: String(name ?? ""), at: Date.now(), timedOut: Boolean(timedOut) };
    pending.set(rowKey, entry);
    await writePending();
}

/**
 * What a pending Observe is aimed at, in the only terms anything outside this
 * file may read. For the suite.
 *
 * DELIBERATELY NOT THE ANSWER KEY. No token id, no `data`, and above all no DC:
 * those are the half of an Observe the observer is being tested on, and a reader
 * that hands them out is the leak this whole file is arranged to prevent. What
 * is left is the shape of the declaration - which is a rule, not a secret.
 *
 * Harmless on a player's client for a second reason as well: `chooseObserveTarget`
 * returns before writing anything unless `game.user.isGM`, so `pending` is empty
 * on every browser but a GM's and this answers null there whatever it is asked.
 */
export function pendingShape(key) {
    readPending();
    const entry = pending.get(key) ?? unpaid.get(key)?.entry;
    if (!entry) return null;
    return {
        declaration: entry.declaration,
        projectOnly: Boolean(entry.projectOnly),
        hasProject: Boolean(entry.projectId)
    };
}

/**
 * THE FINDS A RELOAD LEFT WAITING ON THEIR WORDS (line INVEST of 1.2.122; audit 1.2.118 domain-case-c-investigation 6):
 * on the primary GM, the rows marked `describing` with no result (`scoreObserve`) are scored again on what they were
 * scored on, the describe window answered as closed - the trace's prefilled name, no words - so the copy is made, the
 * row resolved and the player told as a find is; the GMs are told the words are theirs to add. Answers how many.
 * Registered at the primary's hydration (`registerObserveRecovery`); exported for the suite.
 * Since 2.0 line T3 INV-04 (27.11.2026) a hydration finishes only the rows whose window is gone (`describingLeftHere`): a
 * row naming no GM (marked before 1.2.123), a GM not connected, or this browser's own, whose window the reload closed. A
 * connected other GM's window stands - one it opened while it stood in as the primary over this GM's F5 - and that GM
 * finishes it, or `onGmLeft` does when it leaves; until then such a row went out under its prefilled name and that GM's
 * words met `alreadyHeld`. A GM's disconnection (`gm`) finishes that GM's rows as before.
 */
export function describingLeftHere(entry, { me = game.user?.id ?? null, users = game.users } = {}) {
    const gm = entry?.describing?.gm ?? null;
    if (!gm || gm === me) return true;
    return users?.get?.(gm)?.active !== true;
}
const recovering = new Set();
export async function recoverDescribing({ gm = null, leaving = null } = {}) {
    if (!game.user?.isGM || !isPrimaryGm({ leaving })) return 0;
    readPending();
    let n = 0;
    for (const [key, entry] of [...pending]) {
        if (!entry?.describing || entry.result) continue;
        if (gm && entry.describing.gm !== gm) continue;
        if (!gm && !describingLeftHere(entry)) continue;
        const { total, isCritical, rollId = null, by = null } = entry.describing;
        const actor = game.actors.get(entry.actorId);
        recovering.add(key);
        try {
            const done = await resolveObserve({ key, total, isCritical, actorId: entry.actorId, senderId: by, senderIsGm: true, rollId });
            if (done && !done.refused) n++;
        } catch (err) {
            error("A find left waiting on its words could not be finished", err);
        } finally {
            recovering.delete(key);
        }
        await whisperToGms({ tone: "warning", body: `<p>${game.i18n.format("DRPG.Observe.describeRecovered", {
            actor: foundry.utils.escapeHTML(actor?.name ?? "?"), room: foundry.utils.escapeHTML(entry.room ?? "?") })}</p>` });
    }
    return n;
}

/** At the primary's hydration, the finds a reload left waiting (`recoverDescribing`); not while the suite holds the stores. */
/* AND WHEN THE GM WHOSE WINDOW IT IS LEAVES (the line INVEST of 1.2.123; the auditor's CASE-37 rest, recheck of 1.2.122):
   a reload is finished at the hydration, but a GM who closed their browser and did not come back left the row marked, and
   no other GM's hydration came to finish it - the player held a spent action and no card. The primary, at a GM's
   disconnection, finishes the rows that GM's window held (`describing.gm`); a row of its own window stands. A row marked
   before 1.2.123 names no GM and waits for a hydration as before (tier 2 "1.2.123 CASE-37 rest"). */
/** The finds waiting on this browser's window for words another GM may write (E128): ask id -> its resolver. */
const describeAsks = new Map();
/** The row each of those asks is written on (2.0 line T3 INV-01): ask id -> the row's key in `observeStore`. */
const describeRows = new Map();

/** Another GM's words written on the row of an ask waiting here (`describeAnswer`), handed to its wait as the bridge's are. */
function takeRowAnswers() {
    for (const [askId, key] of [...describeRows]) {
        const given = observeStore.get(key)?.describeAnswer;
        if (given?.askId === askId && given.answer) answerDescribeFrom(askId, given.answer, given.by ?? null);
    }
}

/**
 * WHETHER THIS BROWSER ASKS FOR A FIND'S WORDS (2.0 line T3 INV-01, 27.11.2026). Pure, for tier 1 R9124: a row whose ask
 * is open (`describing.askId`, no `result`, no `describeAnswer` or `described` of that ask) is asked on a full GM's browser
 * that is not the one whose window it is (`describing.gm`), once per ask (`asked`). An Assistant GM gets no window.
 */
export function describeAskedHere(row, { me = game.user?.id, role = game.user?.role, asked = askedHere } = {}) {
    const d = row?.describing;
    if (!d?.askId || row.result || role !== CONST.USER_ROLES.GAMEMASTER) return false;
    if (!d.gm || d.gm === me) return false;
    if (row.describeAnswer?.askId === d.askId || row.described?.askId === d.askId) return false;
    return !asked.has(d.askId);
}

/**
 * Whether a whisper's "Write it here" for `askId` still does something (2.0 line T3 INV-02): a row's ask is open under it.
 * Pure on the store's rows, for tier 1 R9125: an ask whose row has words (`describeAnswer`), is done (`described`) or is
 * gone draws no button.
 */
export function describeButtonLive(askId, rows = {}) {
    if (!askId) return false;
    return Object.values(rows ?? {}).some(row => row?.describing?.askId === askId && !row.result
        && row.describeAnswer?.askId !== askId && row.described?.askId !== askId);
}

/** The asks this browser opened a window for (`askDescribeFromRows`), once each until it reloads. */
const askedHere = new Set();
/** The describe windows standing on this browser for another GM's find: ask id -> `{ key, dialog, closed }`. */
const describeWindows = new Map();

/**
 * The finds whose describe window stands, read only (2.0 line T3 EXP-GM-03): a row marked `describing`, with no result
 * and no words given yet, each `{ key, who, text }` - its finder's name and its room. GM only; nothing is written.
 */
export function waitingObserves() {
    if (!game.user?.isGM) return [];
    return Object.entries(observeStore.entries() ?? {}).filter(([, row]) => row?.describing && !row.result && row.described?.askId !== row.describing.askId)
        .map(([key, row]) => ({ key, who: game.actors.get(row.actorId ?? "")?.name ?? "?",
            text: game.i18n.format("DRPG.Floor.waitingObserve", { room: row.room ?? "?" }) }));
}

/** Every row that asks this browser for a find's words opens its window (`askDescribeHere`); GM only. */
export function askDescribeFromRows() {
    if (!game.user?.isGM) return 0;
    let n = 0;
    for (const [key, row] of Object.entries(observeStore.entries() ?? {})) {
        if (!describeAskedHere(row)) continue;
        askedHere.add(row.describing.askId);
        n++;
        void askDescribeHere(row, key).catch(err => error("Could not ask for a find's words on this GM's browser", err));
    }
    return n;
}

/**
 * THE FIND'S WINDOW ON ANOTHER FULL GM'S BROWSER (2.0 line T3 INV-01, INV-02; 27.11.2026). The same form the browser whose
 * window it is draws (`describeFormBody`), from this browser's copy of the trace, and its words written on the row
 * (`describeAnswer`) for that browser to take - unless the row has its words by then. The window closes, its words not
 * sent, once the row says the ask is done (`described`) or the row is gone (`closeAnsweredWindows`). Answers the words
 * written, or null.
 */
export async function askDescribeHere(row, key) {
    const d = row?.describing;
    if (!d?.askId || !game.user?.isGM) return null;
    const { remnantById, remnantData, remnantPublicById } = await import("./remnants.mjs");
    const ref = remnantById(row.sceneId, row.tokenId);
    const data = ref ? remnantData(ref) : null;
    const actor = game.actors.get(row.actorId ?? "") ?? null;
    if (!data || !actor) return null;
    const pub = remnantPublicById(row.sceneId, row.tokenId);
    const stored = pub?.name ? pub : null;
    const held = { key, dialog: null, closed: false };
    describeWindows.set(d.askId, held);
    let answer = null;
    try {
        answer = await drpgWindow({
            title: game.i18n.localize("DRPG.Observe.describeTitle"), classes: ["drpg-panel"], prompt: true,
            render: (event, dialog) => {
                held.dialog = dialog;
                if (held.closed) Promise.resolve(dialog?.close?.()).catch(() => {});
            },
            body: describeFormBody({ actor, room: d.room ?? row.room, data, isCritical: Boolean(d.isCritical), fallbackName: d.fallbackName ?? "", stored }),
            footer: { primary: { action: "ok", label: game.i18n.localize("DRPG.Observe.describeConfirm"),
                tooltip: tipText("DRPG.Observe.describeConfirmTooltip"), callback: (e, b, dialog) => readDescribeForm(dialog.element.querySelector("form")) } },
            rejectClose: false
        }).catch(() => null);
    } finally {
        describeWindows.delete(d.askId);
    }
    if (held.closed || !answer || typeof answer !== "object") return null;
    const now = observeStore.get(key);
    if (now?.describing?.askId !== d.askId || now.describeAnswer || now.described?.askId === d.askId) return null;
    await observeStore.patch(key, { describeAnswer: { askId: d.askId, by: game.user.id, answer, at: Date.now() } });
    ui.notifications?.info?.(game.i18n.localize("DRPG.Observe.describeSent"));
    return answer;
}

/**
 * THE OTHER WINDOWS CLOSE ONCE THE FIND HAS ITS WORDS (2.0 line T3 INV-02, INV-05; 27.11.2026): each describe window of
 * another GM's find standing here closes when its row says the ask is done (`described`) - saying whose words went out
 * under what name (`DRPG.Observe.describeTakenBy`), or that nobody answered in time (`describeTakenTimedOut`) - or when
 * the row is gone; the whispers' "Write it here" of an ask that is done go with them (`describeButtonLive`).
 */
export function closeAnsweredWindows() {
    if (!game.user?.isGM) return 0;
    const rows = observeStore.entries() ?? {};
    let n = 0;
    for (const [askId, held] of [...describeWindows]) {
        const row = rows[held.key];
        const done = row?.described?.askId === askId ? row.described : null;
        if (row && !done && row.describing?.askId === askId) continue;
        held.closed = true;
        describeWindows.delete(askId);
        Promise.resolve(held.dialog?.close?.()).catch(() => {});
        n++;
        const actor = game.actors.get(row?.actorId ?? "")?.name ?? "?";
        const text = !done ? game.i18n.localize("DRPG.Observe.describeGone")
            : done.timedOut ? game.i18n.format("DRPG.Observe.describeTakenTimedOut", { actor, name: done.name ?? "" })
                : game.i18n.format("DRPG.Observe.describeTakenBy", { gm: game.users.get(done.by ?? "")?.name ?? "?", actor, name: done.name ?? "" });
        ui.notifications?.info?.(text);
    }
    for (const button of document.querySelectorAll?.("[data-drpg-describe-find]") ?? []) {
        if (!describeButtonLive(button.dataset.drpgDescribeFind, rows)) button.closest(".drpg-call-actions")?.remove();
    }
    return n;
}

/** The find's rows changed in the store (a GM's write, or another GM's merged): words taken, windows asked and closed. */
function afterRowsChanged() {
    if (!game.user?.isGM) return;
    takeRowAnswers();
    closeAnsweredWindows();
    askDescribeFromRows();
}

/**
 * Another GM's words for a find waiting here (E128; the run of `observe.describe`, bridge-runs-acts.mjs): handed to the
 * window's wait (`describeFind`), which closes the window and gives the find these words. False when no find waits under
 * `askId` - answered already, by this GM's window or its clock, or another GM's words came first.
 */
export function answerDescribeFrom(askId, answer, by = null) {
    const give = describeAsks.get(askId ?? "");
    if (!give) return false;
    describeAsks.delete(askId);
    give({ by, answer: { name: String(answer?.name ?? "").trim(), playerText: String(answer?.playerText ?? "").trim(),
        analyzedText: String(answer?.analyzedText ?? "").trim(), critHint: String(answer?.critHint ?? "").trim() } });
    return true;
}

/** The describing window's form: what the student sees, its reading and a critical's hint (`describeFind`, `wireDescribeHere`). */
function describeFormBody({ actor, room, data, isCritical, fallbackName, stored }) {
    return `<form>
            <p>${game.i18n.format("DRPG.Observe.describeIntro", {
                actor: foundry.utils.escapeHTML(actor.name),
                room: foundry.utils.escapeHTML(room ?? "")
            })}</p>
            <p class="notes">${foundry.utils.escapeHTML(
                `${data.visibilityLabel} ${data.typeLabel}${data.note ? ` - ${data.note}` : ""}`
            )}</p>
            ${stored
                ? `<p class="notes">${game.i18n.localize("DRPG.Observe.alreadyDescribed")}</p>`
                : ""}
            ${isCritical
                ? `<p><strong>${game.i18n.localize("DRPG.Observe.critPrompt")}</strong></p>`
                : ""}
            ${/*
                * THE CRITICAL'S HINT IS THE FINDER'S (E64 C2, 12.11.2026; audit S05-59). Until 1.2.105 the hint went in
                * the description box below, which is the trace's own (`setRemnantPublicById`): every later finder's copy
                * read it, a hint they had not earned. Its own box, on a critical only, and `findTexts` hands it to this
                * copy alone. ASKED FIRST, AND FOCUSED (Q-E64-11; the owner, 12.11.2026: "Zgoda, przesun"): it stood last,
                * under the lab's reading, and the description held the focus - measured in Chromium at 1366x768 (R3960's
                * note) the body opened scrolled to the description, the window's top out of view, and on an undescribed
                * trace under Stained Glass the box sat below the fold. Right under the critical's line now, which says
                * what it is for.
                */ ""}
            ${isCritical
                ? `<label>${game.i18n.localize("DRPG.Observe.critHint")}
                    <textarea name="critHint" rows="3" autofocus
                        placeholder="${game.i18n.localize("DRPG.Observe.critHintPlaceholder")}"></textarea></label>
                   <p class="notes">${game.i18n.localize("DRPG.Observe.critHintNote")}</p>`
                : ""}
            ${/*
                * THE NAME IS NOT ASKED TWICE (Dawid, 28.08: "finding a remnant
                * by a second player prompts the DM to name it again, though
                * there is no need").
                *
                * A described trace only reaches this dialog on a CRITICAL, and a
                * critical buys a big hint from the GM - not a new name. Two
                * names for one object is the false contradiction this whole
                * mechanism was built to prevent, and offering an editable box is
                * an invitation to create one by pressing through it. So the name
                * is shown, so the GM knows what they are adding to, and it is
                * read-only. The hint goes in the box below.
                */ ""}
            ${stored
                ? `<label>${game.i18n.localize("DRPG.TruthBullet.name")}
                    <input type="text" name="name" readonly${tipAttr("DRPG.Observe.alreadyDescribed")}
                           value="${foundry.utils.escapeHTML(stored.name ?? fallbackName)}" /></label>`
                : `<label>${game.i18n.localize("DRPG.TruthBullet.name")}
                    <input type="text" name="name"${isCritical ? "" : " autofocus"}${tipAttr("DRPG.Tips.Sweep.Actions.bulletNameTooltip")}
                           value="${foundry.utils.escapeHTML(fallbackName)}" /></label>`}
            <label>${game.i18n.localize("DRPG.TruthBullet.playerText")}
                <textarea name="playerText" rows="3"${stored && !isCritical ? " autofocus" : ""}${tipAttr("DRPG.Tips.Sweep.Actions.bulletTextTooltip")}
                    placeholder="${game.i18n.localize("DRPG.TruthBullet.playerTextPlaceholder")}"
                    >${foundry.utils.escapeHTML(stored?.playerText ?? "")}</textarea></label>
            ${/*
                * THE SECOND BOX IS ASKED HERE AND NOT LATER, and it is optional.
                *
                * This is the one moment a GM is already looking at this trace
                * and thinking about what it is - so it is the cheapest moment
                * to also write what the lab would say about it. The alternative
                * is being interrupted weeks later, mid-Investigation, by a
                * player's Head roll landing on a trace nobody has written a
                * reading for.
                *
                * Left empty it costs nothing: Analyze still identifies the
                * category, which is exactly what it did before this field
                * existed. The Remnant card and the Investigation dashboard both
                * edit the same field afterwards, so nothing is decided here
                * that cannot be changed at leisure.
                */ ""}
            <label>${game.i18n.localize("DRPG.TruthBullet.analyzedText")}
                <textarea name="analyzedText" rows="3"
                    placeholder="${game.i18n.localize("DRPG.TruthBullet.analyzedTextPlaceholder")}"
                    >${foundry.utils.escapeHTML(stored?.analyzedText ?? "")}</textarea></label>
            <p class="notes">${game.i18n.localize("DRPG.TruthBullet.analyzedTextNote")}</p>
        </form>`;
}

/** What the describing window's form holds, as its button reads it. */
function readDescribeForm(f) {
    return {
        name: f.name.value.trim(),
        playerText: f.playerText.value.trim(),
        analyzedText: f.analyzedText.value.trim(),
        critHint: f.critHint?.value.trim() ?? ""
    };
}

/**
 * "Write it here" on a find's whisper (E128): the describing window on this GM's browser, built from this GM's copy of
 * the trace, and its words sent to the browser whose window waits (`observe.describe`, the primary). The button is held
 * while the window stands and taken off once the words are taken; a refusal (answered already) is told by the bridge.
 */
export function wireDescribeHere(body) {
    if (!game.user?.isGM || !body?.querySelectorAll) return;
    const rows = observeStore.entries() ?? {};
    for (const button of body.querySelectorAll("[data-drpg-describe-find]")) {
        // An ask whose row has its words, is done or gone draws no button (2.0 line T3 INV-02; a reload's render too).
        const rowOf = Object.entries(rows).find(([, row]) => row?.describing?.askId === button.dataset.drpgDescribeFind || row?.described?.askId === button.dataset.drpgDescribeFind);
        if (rowOf && !describeButtonLive(button.dataset.drpgDescribeFind, rows)) {
            button.closest(".drpg-call-actions")?.remove();
            continue;
        }
        if (button.dataset.drpgWired) continue;
        button.dataset.drpgWired = "1";
        button.addEventListener("click", async event => {
            event.preventDefault();
            if (button.disabled) return;
            button.disabled = true;
            try {
                const d = button.dataset;
                // The row's window, when the ask is on a row (2.0 line T3 INV-01) and none stands here already.
                const live = Object.entries(observeStore.entries() ?? {}).find(([, row]) => row?.describing?.askId === d.drpgDescribeFind);
                if (live) {
                    if (!describeWindows.has(d.drpgDescribeFind) && describeButtonLive(d.drpgDescribeFind, observeStore.entries())) {
                        askedHere.add(d.drpgDescribeFind);
                        await askDescribeHere(live[1], live[0]);
                    }
                    return;
                }
                const { remnantById, remnantData, remnantPublicById } = await import("./remnants.mjs");
                const ref = remnantById(d.scene, d.token);
                const data = ref ? remnantData(ref) : null;
                const actor = game.actors.get(d.actor ?? "") ?? null;
                if (!data || !actor) { ui.notifications?.warn?.(game.i18n.localize("DRPG.Observe.describeGone")); return; }
                const pub = remnantPublicById(d.scene, d.token);
                const stored = pub?.name ? pub : null;
                const isCritical = d.critical === "1";
                const answer = await drpgWindow({
                    title: game.i18n.localize("DRPG.Observe.describeTitle"), classes: ["drpg-panel"], prompt: true,
                    body: describeFormBody({ actor, room: d.room, data, isCritical, fallbackName: d.fallback ?? "", stored }),
                    footer: { primary: { action: "ok", label: game.i18n.localize("DRPG.Observe.describeConfirm"),
                        tooltip: tipText("DRPG.Observe.describeConfirmTooltip"), callback: (e, b, dialog) => readDescribeForm(dialog.element.querySelector("form")) } },
                    rejectClose: false
                }).catch(() => null);
                if (!answer || typeof answer !== "object") return;
                const { bridgeRequest } = await import("./bridge-guards.mjs");
                const res = await bridgeRequest("observe.describe", { askId: d.drpgDescribeFind, ...answer }, { settle: "reply", onPrimary: true,
                    local: () => answerDescribeFrom(d.drpgDescribeFind, answer, game.user.id) });
                if (res.ok && res.value) {
                    button.closest(".drpg-call-actions")?.remove();
                    ui.notifications?.info?.(game.i18n.localize("DRPG.Observe.describeSent"));
                }
            } catch (err) {
                error("Could not write a find's words from another GM's browser", err);
            } finally {
                if (button.isConnected) button.disabled = false;
            }
        });
    }
}

export function onGmLeft(user, connected) {
    if (connected || !user?.isGM || user.id === game.user?.id || gmStoresQuiet()) return null;
    return recoverDescribing({ gm: user.id, leaving: user.id });
}
export function registerObserveRecovery() {
    onGmStoresHydrated(() => { if (!gmStoresQuiet()) void recoverDescribing(); });
    // A find's window on every full GM's browser (2.0 line T3 INV-01): asked from the rows at the stores' opening and at
    // every change of the store, and closed once the row has its words (INV-02).
    onGmStoresHydrated(() => { if (!gmStoresQuiet()) afterRowsChanged(); });
    Hooks.on("clientSettingChanged", key => {
        if (key === `${MODULE_ID}.${SETTINGS.observePending}`) Promise.resolve().then(afterRowsChanged).catch(err => debug("Could not read the finds' rows", err));
    });
    Hooks.on("userConnected", (user, connected) => { void onGmLeft(user, connected); });
    // A find's "Write it here" on the whisper a GM is sent (E128, `wireDescribeHere`): read after the secret swap, as the
    // ruling cards are (gm-bridge.mjs), which draws the words in this same hook's dispatch.
    Hooks.on("renderChatMessageHTML", (message, element) => {
        if (!game.user?.isGM) return;
        Promise.resolve().then(() => wireDescribeHere(element?.querySelector?.(".message-content") ?? element))
            .catch(err => debug("Could not wire a find's Write it here", err));
    });
}

/** Forget every pending target. A console tool for a stuck declaration. */
export async function clearPendingObserves() {
    readPending();
    const n = pending.size;
    pending.clear();
    // The setting too, or the console's repair tool repairs nothing: the next read
    // would fold the same entries straight back in (ACT-08).
    await writePending();
    return n;
}
