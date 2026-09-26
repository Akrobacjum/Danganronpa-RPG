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
import { rankForObserve } from "./remnants.mjs";
import { createTruthBullet, copiedRemnants, dropSecret } from "./truth-bullets.mjs";
import { automatedUpdate } from "./resource-guard.mjs";
import { resourceValue, resourceMax } from "./character.mjs";
import {
    dialogContent, whisperToOwner, whisperToGms, ownerOf, ownerIdsOf, log, warn, error, debug
} from "./utils.mjs";
// The store the declarations are written through (ACT-08). settings.mjs imports
// config.mjs and nothing else, so this closes no cycle.
import { SETTINGS } from "./settings.mjs";
import { observeStore } from "./gm-stores.mjs";
import { stableJson } from "./gm-store.mjs";

const DialogV2 = foundry.applications.api.DialogV2;

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
 * WHAT THIS DOES NOT DO, said plainly: it does not reach a SECOND GM. Both halves
 * of the round trip are handled by whoever `primaryGmId()` names at that moment,
 * and that can change - a GM joining with a lower-sorted id, the primary
 * disconnecting, a reload - so a declaration minted on one GM's browser can be
 * asked of another's. The GM store could carry it now - every other GM-only store is
 * exchanged between the GMs since E04 - but this one was kept local (`sync: false`,
 * E04 C7: both halves of the round trip usually go through one GM), and syncing it
 * is a change nobody has made yet. The road that cannot answer says so on both
 * screens, which is the half that matters at the table.
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
 * see `observeSpecific` in action-rolls.mjs - so "before any dice are thrown" is
 * no longer true and was never what kept this honest.)
 *
 * @returns {Promise<{ok: boolean, key?: string, reason?: string}>}
 */
export async function chooseObserveTarget({ actorId, declaration, request = "", userId = null } = {}) {
    if (!game.user.isGM) return { ok: false, reason: "notGm" };
    sweepPending();

    const actor = game.actors.get(actorId);
    if (!actor) return { ok: false, reason: "noActor" };

    // Located without the canvas on purpose. This runs on the GM's client, which
    // is very often looking at a different scene than the player acting - and
    // the canvas-bound lookup would report the character as standing nowhere,
    // quietly turning every Observe into the Daily Life fallback.
    const { locateActor } = await import("./movement.mjs");
    const where = locateActor(actor);
    if (!where?.room) return { ok: false, reason: "noRoom" };

    // A Remnant already copied is not a second find - the guide's Truth Bullet
    // is the player's copy of a trace, and one trace yields one copy per person.
    const already = copiedRemnants(actor);
    const followingTraces = declaration === DECLARATIONS.followTraces;
    const candidates = rankForObserve(where.room, where.scene,
        { preferSource: followingTraces ? actorId : null })
        .filter(c => !already.has(c.token.id));
    const room = where.room;

    /* The other thing this room can give up, and only to one declaration - see
       PROJECT_OBSERVE in config.mjs for why it is that one and no other. Asked
       about the OBSERVER's account, not `game.user`: this runs on the GM's
       client, where the ambient answer would be "in on all of them". */
    const secret = declaration === DECLARATIONS.nonObvious
        ? pickHidden(await hiddenProjectsFor(actor, room))
        : null;

    if (!candidates.length) {
        // The room is picked clean of traces. If it is also holding nothing this
        // declaration can find, that is the Daily Life fallback as before.
        if (!secret) return { ok: false, reason: "none" };

        /* Otherwise the project IS the target. Nothing else in this file needs a
           branch for that: it takes the same key, the same pending entry and the
           same road home, and `resolveObserve` reads `projectOnly` at the one
           point where a trace would have been created. Without this the total
           would never reach the GM at all - the observer's client drops to a
           ruling card when the target lookup says "nothing here", so a room
           whose only secret was a project could not be searched. */
        const onlyKey = foundry.utils.randomID();
        readPending();
        pending.set(onlyKey, {
            at: Date.now(), actorId, by: userId, room, declaration, request,
            tokenId: null, sceneId: where.scene?.id ?? null,
            dc: PROJECT_OBSERVE.dc, data: null,
            projectId: secret.id, projectOnly: true
        });
        // Written through like the trace's own declaration below (ACT-08).
        await writePending();
        log(`Observe: ${actor.name} is sweeping ${room}, which holds nothing but a secret project (DC ${PROJECT_OBSERVE.dc}).`);
        return { ok: true, key: onlyKey };
    }

    let chosen;
    if (declaration === DECLARATIONS.specific) {
        chosen = await askWhichRemnant(actor, room, request, candidates);
        // A GM who closes the picker has refused the request, which is a real
        // answer: the player keeps their action and nothing is rolled.
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

    const key = foundry.utils.randomID();
    readPending();
    pending.set(key, {
        at: Date.now(),
        actorId,
        // The account that asked for this key (E03) - see `observeResolveRefusal`.
        by: userId,
        room,
        declaration,
        request,
        tokenId: chosen.token.id,
        sceneId: where.scene?.id ?? null,
        dc: chosen.dc,
        data: chosen.data,
        /* Carried alongside the trace, scored against the same total and at its
           own difficulty. A non-obvious sweep that clears both takes both. */
        projectId: secret?.id ?? null
    });

    // Written through at once: the roll that answers this arrives minutes later,
    // and a GM who reloads in between used to lose the declaration (ACT-08).
    await writePending();

    log(`Observe: ${actor.name} is looking at a ${chosen.data.visibility} ${chosen.data.type} in ${room} (DC ${chosen.dc}).`);
    return { ok: true, key };
}

/* ==========================================================================
 * THE OTHER THING IN THE ROOM - a secret project
 * ========================================================================== */

/** The secret projects in this room that the observer's account is not in on. */
async function hiddenProjectsFor(actor, room) {
    try {
        const { secretsUnknownIn } = await import("./projects.mjs");
        return secretsUnknownIn(room, ownerOf(actor));
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
        { flags: { [MODULE_ID]: { sfx: "projectFound" } } });

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

/** The GM decides which trace is closest to what the player asked for. */
async function askWhichRemnant(actor, room, request, candidates) {
    const options = candidates.map((c, i) => {
        const label = [
            `${c.data.visibilityLabel} ${c.data.typeLabel}`,
            c.data.tiedToCrime ? game.i18n.localize("DRPG.Observe.tiedFlag") : null,
            c.data.subject || null,
            `DC ${c.dc}`
        ].filter(Boolean).join(" · ");
        return `<option value="${i}">${foundry.utils.escapeHTML(label)}</option>`;
    }).join("");

    const picked = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Observe.pickTitle") },
        classes: ["drpg-panel"],
        content: dialogContent(`<form>
            <p>${game.i18n.format("DRPG.Observe.pickIntro", {
                actor: foundry.utils.escapeHTML(actor.name),
                room: foundry.utils.escapeHTML(room)
            })}</p>
            <blockquote>${foundry.utils.escapeHTML(request || game.i18n.localize("DRPG.Observe.noRequest"))}</blockquote>
            <label>${game.i18n.localize("DRPG.Observe.whichRemnant")}
                <select name="remnant">${options}</select></label>
            <p class="notes">${game.i18n.localize("DRPG.Observe.pickNote")}</p>
        </form>`),
        buttons: [
            {
                action: "ok", label: game.i18n.localize("DRPG.Observe.pickConfirm"), default: true,
                callback: (e, b, d) => d.element.querySelector("[name=remnant]").value
            },
            { action: "refuse", label: game.i18n.localize("DRPG.Observe.pickRefuse") }
        ],
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
 * IN THE ENTRY, and never compared the two. The key sits on its owner's character
 * as part of the Reroll bookmark (`lastAction`), which every client can read. So a
 * player could take somebody else's key, name their own character, send a total
 * of 0 with `undo`, and this client deleted the other player's Truth Bullet and
 * then charged them the Sanity for a miss. The key could be used again for an
 * hour.
 *
 * Now the character has to be the entry's, the account has to be the one the
 * key was minted for, a key is resolved once, and an undo needs a result to undo.
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
    actorId = null, senderId = null, senderIsGm = true } = {}) {
    if (!game.user.isGM) return null;
    // THE CACHE FIRST, THEN THE SWEEP. A sweep over an unloaded cache is a sweep
    // over nothing, and it would then write that nothing back (ACT-08).
    readPending();
    await sweepPending();

    const entry = pending.get(key);
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
        await whisperToGms(`<p class="drpg-warning">${game.i18n.format(
            undo ? "DRPG.Observe.rerollLost" : "DRPG.Observe.resolveLost",
            // Escaped (E02 review): this card is written on the GM's client and
            // stored as the GM's own, and the name is the one field of it a
            // player can set - by renaming their character from the console.
            { name: foundry.utils.escapeHTML(stranded?.name ?? "?"), total }
        )}</p>`);
        if (stranded) {
            await whisperToOwner(stranded, `<p class="drpg-warning">${
                game.i18n.localize("DRPG.Observe.resolveLostOwner")}</p>`);
        }
        return null;
    }

    const refused = observeResolveRefusal(entry, { actorId, senderId, senderIsGm, undo });
    if (refused) return { refused };

    const actor = game.actors.get(entry.actorId);
    if (!actor) return null;

    // A Reroll replaces a result rather than adding to it. What the first throw
    // produced is recorded here rather than sent to the observer and quoted
    // back: the bullet is part of the answer key's bookkeeping, and the player's
    // client has no business knowing which item id to name.
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
    if (entry.projectOnly) {
        const found = await noticeSecretProject(actor, entry, total, isCritical);
        if (!found) {
            const marked = await applyFailure(actor, total, entry);
            entry.result = { success: false, bulletId: null, projectId: null, stress: marked };
            await writePending();
            return { success: false, key };
        }
        entry.result = { success: true, bulletId: null, projectId: found, stress: 0 };
        await writePending();
        return { success: true, key };
    }

    const success = isCritical || total >= entry.dc;

    const item = success ? await createFind(actor, entry, isCritical) : null;
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
    await writePending();
    return { success, key };
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
    // Reroll would charge for a failure it just erased.
    if (previous.stress) {
        const marks = resourceValue(actor, "stress");
        const next = Math.max(0, marks - previous.stress);
        if (next !== marks) {
            try {
                await automatedUpdate(actor, { "system.resources.stress.value": next });
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
    const marks = resourceValue(actor, "stress");
    const max = resourceMax(actor, "stress");
    const next = Math.min(max, marks + OBSERVE_FAIL_STRESS);
    const marked = next - marks;

    if (marked > 0) {
        try {
            await automatedUpdate(actor, { "system.resources.stress.value": next });
        } catch (err) {
            error("Could not apply the Sanity from a failed Observe", err);
        }
    }

    /*
     * It costs 1 Sanity and looks exactly like a success until the card is read.
     *
     * ON THE CARD. This said "local, on the observer's client" and was wrong the
     * same way `identify` in analyze.mjs was: `resolveObserve` is GM-only, so every
     * failed Observe since E5 beeped at the GM and left the observer - the one
     * person the catalogue names - in silence.
     */
    await whisperToOwner(actor, `
        <p><strong>${game.i18n.localize("DRPG.Observe.failedTitle")}</strong></p>
        <p>${game.i18n.format("DRPG.Observe.failed", { stress: OBSERVE_FAIL_STRESS })}</p>`,
        { flags: { [MODULE_ID]: { sfx: "observeFail" } } });

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
async function createFind(actor, entry, isCritical) {
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
     */
    const {
        remnantPublicById, setRemnantPublicById, revealRemnantToFinderById
    } = await import("./remnants.mjs");

    const stored = remnantPublicById(entry.sceneId, entry.tokenId);
    const neutralName = game.i18n.localize("DRPG.Remnant.tokenName");
    // Has anybody actually described this yet, or is `stored.name` just the
    // neutral placeholder every fresh trace starts with?
    const described = stored?.name && stored.name !== neutralName ? stored : null;

    const written = (described && !isCritical)
        ? described
        : await describeFind(actor, entry, isCritical, described?.name || stored?.name || fallbackName, described);

    // Written back on the GM's client, where the ledger lives. Only when there
    // is something to write: a dismissed dialog must not overwrite a good
    // description with an empty one.
    let pub = stored;
    if (written?.name && written.name !== described?.name
        || written?.playerText && written.playerText !== described?.playerText
        || written?.analyzedText && written.analyzedText !== described?.analyzedText) {
        try {
            pub = await setRemnantPublicById(entry.sceneId, entry.tokenId, {
                name: written.name || described?.name || fallbackName,
                playerText: written.playerText || described?.playerText || "",
                analyzedText: written.analyzedText || described?.analyzedText || ""
            });
        } catch (err) {
            error("Could not record the description on the Remnant", err);
        }
    }

    const item = await createTruthBullet(actor, {
        name: pub?.name || written?.name || fallbackName,
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
        playerText: pub?.playerText ?? written?.playerText ?? "",
        // What analysis will say, filed with the bullet now so a later Head roll
        // pays out even if the trace itself is wiped before then. It reaches
        // this player's ITEM only on a critical, which identifies outright -
        // `createTruthBullet` is where that is decided, not here.
        analyzedText: pub?.analyzedText ?? written?.analyzedText ?? "",
        img: pub?.img ?? null,
        gmNote: data.note ?? "",
        remnantId: entry.tokenId,
        sceneId: entry.sceneId,
        // Passed explicitly: this is the GM's client, which may be looking at a
        // different scene entirely, so the canvas-bound default would stamp null.
        room: entry.room,
        // Into the bullet's secret; public on the item only once identified -
        // immediately for this critical find, at Analyze for everyone else.
        sourceAction: data.action ?? null,
        tiedToCrime: Boolean(data.tiedToCrime)
    });

    if (!item) return null;

    // The object is real now, not just a note in the GM's ledger - the first
    // person to copy it reveals the token it came from. See
    // `revealRemnantToFinder` in remnants.mjs for why this is `hidden: false`
    // rather than forcing `visible`, and visibility.mjs for how it then stays
    // invisible to everyone who has not found it themselves.
    try {
        await revealRemnantToFinderById(entry.sceneId, entry.tokenId);
    } catch (err) {
        error("Could not reveal the Remnant token to its finder", err);
    }

    await whisperToOwner(actor, `
        <h3>${game.i18n.localize("DRPG.TruthBullet.received")}</h3>
        <p><strong>${foundry.utils.escapeHTML(item.name)}</strong></p>
        ${pub?.playerText ? `<p>${foundry.utils.escapeHTML(pub.playerText)}</p>` : ""}
        ${isCritical ? `<p><em>${game.i18n.localize("DRPG.Observe.critIdentified")}</em></p>` : ""}
        <p><small>${game.i18n.localize("DRPG.TruthBullet.whereToFind")}</small></p>`);

    log(`Observe: ${actor.name} copied a ${data.type} Remnant as "${item.name}".`);
    return item;
}

/** The GM's sentence, prefilled. Never blocks the result - see `createFind`. */
async function describeFind(actor, entry, isCritical, fallbackName, stored = null) {
    const data = entry.data;

    return DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Observe.describeTitle") },
        classes: ["drpg-panel"],
        content: dialogContent(`<form>
            <p>${game.i18n.format("DRPG.Observe.describeIntro", {
                actor: foundry.utils.escapeHTML(actor.name),
                room: foundry.utils.escapeHTML(entry.room)
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
                    <input type="text" name="name" readonly
                           value="${foundry.utils.escapeHTML(stored.name ?? fallbackName)}" /></label>`
                : `<label>${game.i18n.localize("DRPG.TruthBullet.name")}
                    <input type="text" name="name" autofocus
                           value="${foundry.utils.escapeHTML(fallbackName)}" /></label>`}
            <label>${game.i18n.localize("DRPG.TruthBullet.playerText")}
                <textarea name="playerText" rows="3"${stored ? " autofocus" : ""}
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
        </form>`),
        buttons: [
            {
                action: "ok", label: game.i18n.localize("DRPG.Observe.describeConfirm"), default: true,
                callback: (e, b, d) => {
                    const f = d.element.querySelector("form");
                    return {
                        name: f.name.value.trim(),
                        playerText: f.playerText.value.trim(),
                        analyzedText: f.analyzedText.value.trim()
                    };
                }
            }
        ],
        rejectClose: false
    // Closing the dialog resolves to null, which `createFind` reads as "use the
    // prefilled name and no description" - the find still lands either way.
    }).catch(() => null);
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
    const entry = pending.get(key);
    if (!entry) return null;
    return {
        declaration: entry.declaration,
        projectOnly: Boolean(entry.projectOnly),
        hasProject: Boolean(entry.projectId)
    };
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
