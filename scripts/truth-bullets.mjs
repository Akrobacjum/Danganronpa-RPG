/**
 * Danganronpa RPG - Truth Bullets as real objects.
 * ---------------------------------------------------------------------------
 * A Remnant lives on the map; Observing it copies it into a player's inventory
 * as a Truth Bullet. Until now that copy was a plain Item with a category flag:
 * it did not know what it really was, which Remnant it came from, how hard it
 * would be to analyse, or which chapter it belonged to. Nothing in the guide's
 * investigation loop can be built on that.
 *
 * This file gives the bullet an identity, and splits it in two.
 *
 * WHAT THE PLAYER'S ITEM CARRIES is only ever what the player may know: the
 * type they can currently see, how visible the original was, the chapter stamp,
 * and the text written for them.
 *
 * WHAT IT REALLY IS lives nowhere near the player. Foundry hands every client
 * the whole world database on join - `World##g()` dumps ChatMessage (whispers
 * included), Setting, Actor, Item and JournalEntry with no user and no filter,
 * and compendium reads are gated only on create/update/delete. A world setting,
 * a GM-only whisper and a GM-only compendium are all equally readable from a
 * player's console. So the answer key is client-scoped on GM browsers and
 * travels between GMs on a socket the server addresses to named recipients
 * (`handleCustomSocket` honours `recipients` server-side). A player's client
 * never receives it.
 *
 * The cost of that choice is durability: browser storage, not the world file.
 * Since E04 (1.2.63) it is paid down by the GM store (gm-stores.mjs): every GM
 * holds a full copy, merged per field, a GM joining exchanges copies with the
 * others before anything reads the ledger for a decision, and the case can be
 * backed up to a file. A row lives until its bullet is forgotten or the season
 * is reset - a season, not a chapter, since the dashboard reads every chapter's.
 */

import {
    MODULE_ID, REMNANT_VISIBILITY, REMNANT_VISIBILITY_LABELS, TRUTH_BULLET_TYPES
} from "./config.mjs";
import { getClock } from "./clock.mjs";
import { grantItem, itemsInCategory } from "./inventory.mjs";
import { whisperToOwner, whisperToGms, isPrimaryGm, log, warn, error, plural } from "./utils.mjs";
import { playSfxFor } from "./sfx.mjs";
import { bulletStore, backupCase, restoreCase } from "./gm-stores.mjs";

/** The one inventory category a Truth Bullet ever has. */
export const BULLET_CATEGORY = "truthBullet";

/**
 * Public flags on the Item. Everything here is visible to the player who holds
 * the bullet, so nothing here may answer the question Analyze exists to ask.
 */
export const TRUTH_BULLET_FLAGS = {
    /** Marks the item as one of ours even before a category lookup. */
    isBullet: "isTruthBullet",
    /** What the player sees now. Starts at "neutral" for anything analysable. */
    shownType: "shownType",
    /** obvious | evident | subtle | hidden - the DC input for Observe/Analyze. */
    visibility: "visibility",
    /**
     * DOUBTFUL - AND NOT SOMETHING THE FINDER KNOWS YET.
     *
     * Faint means two things in the rules: the connection to the case is
     * doubtful, and the trace is exempt when a GM clears the table's evidence.
     * Both are facts about the OBJECT, which is exactly the shape of thing
     * Analyze is for - and until 1.2.47 this flag was written onto the player's
     * item at creation, one line above `tiedToCrime` and `sourceAction`, which
     * are gated on `identified` for precisely this reason. So the badge said
     * "Faint" on a bullet nobody had analysed, and anybody reading their own
     * item's flags in the console could tell a doubtful trace from a solid one
     * without spending a Head roll ("usunąć faint", Dawid, 16.09).
     *
     * It lives in the bullet's SECRET from creation now and is copied onto the
     * item by `identify`. `faintOf` is the GM-side reader that knows both
     * roads, because a world made before this still carries it on the item.
     */
    faint: "faint",
    /**
     * Has this holder's copy been read in full - its kind confirmed AND its
     * analysis earned? For most bullets the two arrive together, at Analyze or
     * on a critical find. A Key or a Final shows its kind from the moment it is
     * picked up and still carries `false` here until its holder analyses it,
     * because its reading waits like everybody else's (Dawid, 21.09) - see
     * `READ_ON_ANALYZE` and `hasReading`.
     */
    analyzed: "analyzed",
    /** Chapter this bullet was created in. */
    chapter: "chapter",
    /** Where and when it was picked up. */
    room: "room",
    day: "day",
    timeOfDay: "timeOfDay",
    /** The description written for the player. What Observe buys. */
    playerText: "playerText",
    /**
     * THE SECOND HALF OF THE DESCRIPTION, AND IT IS NOT HERE UNTIL IT IS EARNED.
     *
     * `playerText` is what anybody who found the trace can read: the smear, the
     * torn cuff, the smell. This is what the LAB says about the same object -
     * whose blood, which cuff, what the smell is - and Analyze is what buys it.
     *
     * It lives in the bullet's SECRET from creation and is copied onto the item
     * only once the bullet is read (`hasReading`) - identified, for most, and
     * for a Key or a Final its own Analyze - much like `sourceAction` and
     * `tiedToCrime` two entries down and for the same reason: a world
     * where the answer sits on the item from the start is a world where the
     * console reads it without rolling. Until then the item carries `""`, which
     * is all a player's browser has ever been allowed to hold.
     *
     * The GM writes it once, on the Remnant, and every copy follows - see
     * `propagateRemnantPublic`.
     */
    analyzedText: "analyzedText",
    /**
     * `${sceneId}.${tokenId}` of the Remnant this bullet was copied from -
     * PUBLIC, unlike `remnantId` in the secret ledger (see `secretOf`). It
     * says only "this is the same object as one of your other bullets, or as
     * that token on the map" - never what the trace actually is - which is
     * exactly the fact visibility.mjs needs to decide whether a REVEALED
     * Remnant token belongs on THIS player's screen, on a client that cannot
     * read the ledger at all.
     */
    remnantRef: "remnantRef",
    /**
     * Chapter in which this holder burned their analysis of this bullet.
     * Written from Stage 3 onwards; recorded here now so the flag has one
     * spelling across the whole module.
     */
    lockedChapter: "lockedChapter",
    /**
     * TWO FACTS THAT GO PUBLIC AT THE MOMENT OF ANALYSIS, and not before
     * (Dawid, 26.08: "to o czym piszę wchodzi w życie do truth bullets które
     * gracz przeanalizował"). Both live in the bullet's SECRET from creation -
     * `secretOf(uuid).sourceAction` / `.tiedToCrime` - and are copied onto
     * the item as flags only once the bullet is identified: at creation for a
     * self-evident or critical find, in analyze.mjs's `identify` otherwise.
     * Until then the item carries `null`, which is exactly what a player's
     * console may know.
     */
    /** Which action left the source trace - drives the Remnant token's icon. */
    sourceAction: "sourceAction",
    /** Whether the source trace belongs to the murder - drives the sort. */
    tiedToCrime: "tiedToCrime"
};

/* ==========================================================================
 * THE ANSWER KEY
 * --------------------------------------------------------------------------
 * Three functions are the whole interface: `secretOf`, `setSecret`, `dropSecret`.
 * Everything else in the module goes through them, so where the answer key
 * lives is one file's business and can be changed without touching callers.
 *
 * WHERE IT LIVES SINCE E04 (1.2.63): the GM store (`bulletStore`, gm-stores.mjs),
 * a row per bullet uuid whose every field carries its own stamp and is merged
 * per field between GMs. Until then it was a client setting merged by whole
 * entries, newest `updated` wins - and a GM who joined sent rows a migration had
 * built from nothing, `{ faint, updated: now }`, which replaced the full rows on
 * every GM, realType and the reading with them (audit S05-01). The store holds
 * the parsed rows in memory, so the per-bullet reads of the dashboard parse
 * nothing (the reason this file kept a cache of its own until then, E17).
 * ========================================================================== */

/**
 * What a bullet really is. `{}` for anyone who is not a GM - not an error, the
 * honest answer to "what do you know about this".
 *
 * @param {string} uuid  Item uuid. Not `item.id`: an embedded item's id is only
 *   unique inside its own actor, and bullets get copied between actors.
 */
export function secretOf(uuid) {
    if (!game.user.isGM || !uuid) return {};
    return bulletStore.get(uuid) ?? {};
}

/**
 * Record or amend what a bullet really is. Only the fields named are stamped;
 * every other field keeps whatever any GM wrote last, and the other GMs get the
 * change from the store. `opts` are the store's (gm-store.mjs, `patch`): `ifLive`
 * for a writer that only amends a bullet this GM already has a row for, `weak`
 * and `fillOnly` for a value derived from absence, which must lose to anything a
 * GM decided.
 */
export async function setSecret(uuid, patch = {}, opts = {}) {
    if (!game.user.isGM || !uuid) return null;
    await bulletStore.patch(uuid, patch, opts);
    return secretOf(uuid);
}

/**
 * Forget a bullet. A tombstone, written whether or not this GM holds the row, so
 * the removal reaches a GM who was offline when it happened and kills a stale
 * copy that arrives later.
 */
export async function dropSecret(uuid) {
    if (!game.user.isGM || !uuid) return;
    await bulletStore.drop(uuid);
}

/**
 * The answer key's own backup and import until E04: `backupCase` and
 * `restoreCase` (gm-stores.mjs) now, which write every GM store to one file and
 * read this ledger's old export as its bullets. Kept under these names for the
 * macros and handbooks that call them.
 */
export function exportLedger() {
    return backupCase();
}

export function importLedger(json, opts = {}) {
    return restoreCase(json, opts);
}

/* ==========================================================================
 * CREATION
 * ========================================================================== */

/** Is this item one of ours? */
export function isTruthBullet(item) {
    return item?.getFlag(MODULE_ID, "category") === BULLET_CATEGORY;
}

/** Every Truth Bullet this character holds. */
export function bulletsOf(actor) {
    return itemsInCategory(actor, BULLET_CATEGORY);
}

/**
 * Can this bullet still be analysed, by whoever is holding it?
 *
 * Two ways to be out: it is already identified, or this copy was burned on a
 * failed attempt during the chapter now running. Both are public flags, so a
 * player's client can work this out for itself - unlike the difficulty, which
 * it cannot. See analyze.mjs.
 *
 * The chapter comparison is what gives Faint bullets their second life: a lock
 * stamped in chapter 1 stops mattering the moment chapter 2 begins, which is
 * the guide's "można je przeanalizować ponownie w trakcie Investigation".
 */
/**
 * Does the holder know what this bullet is?
 *
 * Two ways to know, and `analyzed` alone misses one: a critical Observe hands
 * the bullet over with its category already shown (`shownType` set, `analyzed`
 * still false). Everything that gates on "has this player earned the truth" -
 * the Remnant token's action icon, the murder-first sort - asks this, not the
 * bare flag.
 */
export function isIdentified(item) {
    if (!isTruthBullet(item)) return false;
    if (item.getFlag(MODULE_ID, TRUTH_BULLET_FLAGS.analyzed)) return true;
    return (item.getFlag(MODULE_ID, TRUTH_BULLET_FLAGS.shownType) ?? "neutral") !== "neutral";
}

/**
 * Has this holder earned the analysis half of the description?
 *
 * The same answer as `isIdentified` for every kind but two. A Key or a Final
 * shows its kind the moment it is picked up - the guide's "bez wymogu analizy"
 * - and its reading still waits for an Analyze, as an ordinary trace's does
 * (Dawid, 21.09: every trace has a description, and a description after
 * analysis). For those two, knowing the kind is not having read the rest, and
 * this is the question every road that puts `analyzedText` on an item asks.
 */
export function hasReading(item) {
    if (!isIdentified(item)) return false;
    if (item.getFlag(MODULE_ID, TRUTH_BULLET_FLAGS.analyzed)) return true;
    return !READ_ON_ANALYZE.includes(item.getFlag(MODULE_ID, TRUTH_BULLET_FLAGS.shownType) ?? "neutral");
}

/**
 * The item's description, from whichever halves of the trace this holder has.
 *
 * ONE FUNCTION RATHER THAN THREE SPELLINGS. The description is written in three
 * places - when a bullet is created, when the GM edits the Remnant afterwards,
 * and at the moment Analyze succeeds - and before this existed the first of
 * those built the markup inline. A second tier written by two of the three and
 * forgotten by the third is a bullet whose description silently disagrees with
 * the card beside it, which is the same class of defect as two names for one
 * object (see `describeFind` in observe.mjs).
 *
 * The analysis is a paragraph of its own with a heading, not a sentence tacked
 * onto the first: the two halves were bought separately and a player rereading
 * their pack needs to see which part of it they paid a Head roll for.
 *
 * @param {string} playerText    What Observe bought. Always shown.
 * @param {string} [analyzedText] What Analyze bought. Pass it only for a holder
 *   who has actually earned it - this function does no checking, because the
 *   callers are the ones holding the item and its flags.
 */
export function bulletDescription(playerText, analyzedText = "") {
    const esc = foundry.utils.escapeHTML;
    const first = playerText ? `<p>${esc(playerText)}</p>` : "";
    if (!analyzedText) return first;
    return `${first}<p class="drpg-bullet-analysis"><strong>${
        esc(game.i18n.localize("DRPG.TruthBullet.analysisHeading"))
    }</strong> ${esc(analyzedText)}</p>`;
}

export function isAnalysable(item, chapter = null) {
    if (!isTruthBullet(item)) return false;
    if (item.getFlag(MODULE_ID, TRUTH_BULLET_FLAGS.analyzed)) return false;
    // Neutral is the ordinary case. A Key or a Final showing its kind still has
    // its reading to buy - see `hasReading`.
    const shown = item.getFlag(MODULE_ID, TRUTH_BULLET_FLAGS.shownType);
    if (shown !== "neutral" && !READ_ON_ANALYZE.includes(shown)) return false;

    const locked = item.getFlag(MODULE_ID, TRUTH_BULLET_FLAGS.lockedChapter);
    if (locked === null || locked === undefined) return true;
    return locked !== (chapter ?? currentChapter());
}

/**
 * The chapter now running.
 *
 * Through `getClock` rather than reading the setting and defaulting to 1 here.
 * The old version's `?? 1` decided a rules question - whether an Analyze attempt
 * is still locked to the chapter it failed in - from a number this file made up,
 * and it made it up in a different place from the two other copies of the same
 * fallback elsewhere in the module. The default belongs beside the setting.
 *
 * This file already imports `getClock` dynamically twice; a static import costs
 * nothing here, since clock.mjs has never depended on this one.
 */
function currentChapter() {
    return getClock().chapter;
}

/** Every bullet this character could still put an Analyze into. */
export function analysableBullets(actor) {
    const chapter = currentChapter();
    return bulletsOf(actor).filter(item => isAnalysable(item, chapter));
}

/**
 * Which Remnants this character has already copied.
 *
 * GM-side by necessity: a bullet's source Remnant is part of the answer key, so
 * a player's client has no way to work this out - which is the whole reason
 * Observe is resolved on the GM's client and not the observer's.
 *
 * @returns {Set<string>} Remnant token ids.
 */
export function copiedRemnants(actor) {
    const ids = new Set();
    if (!game.user.isGM || !actor) return ids;
    for (const item of bulletsOf(actor)) {
        const id = secretOf(item.uuid).remnantId;
        if (id) ids.add(id);
    }
    return ids;
}

/**
 * Types that arrive already identified.
 *
 * Guide, p. 28: "Key Remnants domyślnie przekształcają się w Key Truth Bullets
 * bez wymogu analizy", and an Autopsy bullet is handed over rather than found.
 * Neither ever enters the Analyze table - which is exactly why ANALYZE_DC has
 * `key: null` and no `autopsy` column at all.
 */
/*
 * The three that need no roll - guide, Stage 3: "Bez rzutu". They are born
 * identified: the pack shows their kind from the moment they land.
 */
const SELF_EVIDENT = ["key", "autopsy", "final"];

/*
 * ...AND TWO OF THEM STILL KEEP THEIR READING FOR AN ANALYZE (Dawid, 21.09).
 *
 * This used to say the Key planner and the Final form carried no analysis box
 * on purpose: a bullet that identifies itself never has Analyze thrown at it,
 * so a second tier would be a field nobody read. What that left was three kinds
 * of trace working three ways. An ordinary trace had a description and a
 * description after analysis; a Key or a Final had no box for the second in
 * their own forms, and a reading typed for one on the Traces tab reached its
 * finder at pickup, with nothing bought. Dawid's rule is one shape for all of
 * them: a description, and a description after Analyze.
 *
 * So the KIND stays self-evident, as the guide says, and the READING waits -
 * for an Analyze rolled like any other bullet's ("Analyze ma mieć rzut w każdym
 * bullecie", the same day), against the Key column of ANALYZE_DC, the easiest
 * in the table. A miss locks the reading away from that holder for the chapter,
 * as it does for any bullet; a copy handed to somebody else can still be read. A
 * critical find reads it outright, as it does any trace.
 *
 * Autopsy is not here: the GM hands it over with no trace behind it, and its
 * dialog has never had a second tier.
 */
const READ_ON_ANALYZE = ["key", "final"];

/**
 * Create a Truth Bullet on a character. The single path - the GM's dialog,
 * macro 03 and (from Stage 2) Observe all come through here, so there is one
 * place where a bullet's shape is decided.
 *
 * @param {Actor} actor
 * @param {object} data
 * @param {string} data.name           What the player sees in their inventory.
 * @param {string} [data.realType]     The truth. GM-side only.
 * @param {string} [data.shownType]    Defaults: the real type when self-evident,
 *                                     "neutral" otherwise.
 * @param {string} [data.visibility]   obvious | evident | subtle | hidden
 * @param {boolean} [data.faint]
 * @param {string} [data.playerText]   Description for the player. What Observe buys.
 * @param {string} [data.analyzedText] What Analyze buys on top of it. Filed in
 *   the secret at creation and written onto the item only once the bullet is
 *   identified - see TRUTH_BULLET_FLAGS.analyzedText.
 *
 *   THE TRACE OUTRANKS THIS ARGUMENT WHEN THERE IS A TRACE. A bullet with a
 *   `remnantId` is reconciled to its Remnant's record moments later, by the
 *   `revealSourceOf` call at the bottom of this function: revealing a trace
 *   propagates its `public` block onto every copy, and that includes the
 *   analysis half. So passing a reading the trace does not have does not
 *   create one - it is overwritten with the trace's, which is empty.
 *
 *   That is the right way round and not a wrinkle to route past: one object,
 *   one lab reading, however many copies (see `setRemnantPublic`). Every real
 *   caller already writes the trace first and then reads it back - observe.mjs
 *   does it explicitly, gm-items.mjs passes `pub.analyzedText`, and a handover
 *   passes a secret that was itself filled from the trace. A bullet with NO
 *   trace keeps whatever it is given, because there is nothing to disagree
 *   with.
 * @param {string} [data.img]          Portrait. Defaults to the category icon.
 * @param {string} [data.gmNote]       Note for the GM. Never leaves the ledger.
 * @param {string} [data.remnantId]    Source token id, when there is one.
 * @param {string} [data.sceneId]
 * @param {string} [data.room]         Where it was picked up. Pass this when the
 *   creating client is not the one looking at the character's scene - the room
 *   lookup below is canvas-bound, and Observe runs on the GM's client.
 * @param {boolean} [data.analyzed]    Override. `null` derives it from the type,
 *   which is what a fresh find wants; a copy passes the original's state so
 *   handing over identified evidence hands over what the giver knows.
 * @param {object} [data.stamp]        `{chapter, day, timeOfDay}` override. A
 *   copy records the discovery it documents, not the moment it was copied.
 * @param {string} [data.sourceAction] Which action left the source trace.
 *   Secret until the bullet is identified - see TRUTH_BULLET_FLAGS.
 * @param {boolean} [data.tiedToCrime] Whether the source trace belongs to the
 *   murder. Same rule.
 * @returns {Promise<Item|null>}
 */
/**
 * A Truth Bullet you hold is a Remnant you have seen (Dawid, 31.08).
 *
 * Un-hiding the token was the last step of ONE route - Observe - and every
 * other way a bullet reaches somebody left the marker `hidden` for the whole
 * table. A player could be handed a copy of a trace, or an autopsy bullet at
 * the start of an Investigation, and hold evidence whose source was not on
 * their map.
 *
 * visibility.mjs was already ready for this: `myRemnantRefs()` shows the token
 * to anyone holding a copy, and hides it from everyone else. It was waiting for
 * a token that never came out of hiding.
 *
 * Un-hiding is global and that is correct - it does not show the trace to the
 * table, it lets the per-client rule decide. See `revealRemnantToFinder`.
 */
async function revealSourceOf(sceneId, remnantId) {
    if (!sceneId || !remnantId) return;
    try {
        const { revealRemnantToFinderById } = await import("./remnants.mjs");
        await revealRemnantToFinderById(sceneId, remnantId);
    } catch (err) {
        // A bullet that exists and a marker that stays hidden is worse than
        // this line failing, but it is not worth losing the bullet over.
        warn("Could not reveal the Remnant behind a Truth Bullet", err);
    }
}

export async function createTruthBullet(actor, {
    name, realType = "neutral", shownType = null, visibility = "evident",
    faint = false, playerText = "", analyzedText = "", img = null, gmNote = "",
    remnantId = null, sceneId = null,
    room = null, analyzed = null, stamp = null,
    sourceAction = null, tiedToCrime = null
} = {}) {
    if (!actor || !name) return null;

    if (!game.user.isGM) {
        // Not a limitation to route around: the answer key only exists on a GM's
        // browser, so a bullet created here would be one whose truth nobody
        // recorded. Observe already goes the right way - the roll travels to the
        // GM's client and `createFind` runs there. See observe.mjs.
        warn("Only a GM can create a Truth Bullet.");
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    if (!TRUTH_BULLET_TYPES[realType]) realType = "neutral";
    if (!REMNANT_VISIBILITY.includes(visibility)) visibility = "evident";

    const selfEvident = SELF_EVIDENT.includes(realType);
    const shown = shownType ?? (selfEvident ? realType : "neutral");

    // Born knowing? A self-evident type, an explicit `analyzed`, or a critical
    // find whose category is already shown. Only then do the two post-analysis
    // facts land on the item itself; otherwise they wait in the secret for
    // `identify` in analyze.mjs to publish them.
    const identified = (analyzed ?? selfEvident) || shown !== "neutral";
    // And the reading, which a Key or a Final showing its kind has NOT earned
    // yet - unless this is a find or a copy that says it has (`analyzed: true`:
    // a critical, a GM's "the real type", a copy of something already read).
    // The test `hasReading` makes, asked before there is an item to ask.
    const read = identified && (analyzed === true || !READ_ON_ANALYZE.includes(shown));

    const { getClock } = await import("./clock.mjs");
    const { roomOfActor } = await import("./movement.mjs");
    const clock = getClock();

    const item = await grantItem(actor, {
        name,
        category: BULLET_CATEGORY,
        // Truth Bullets are uncapped, but `grantItem` still passes the creation
        // through the carry-limit hook; `override` keeps a GM's ruling final.
        override: true,
        // A bullet has no tier. It is written as null rather than left undefined
        // so the sheet can tell "no tier" from "tier 0" - the old macro used to
        // smuggle a visibility index through this field.
        tier: null,
        img,
        // The analysis rides along only for a bullet that is born read - an
        // Autopsy, a critical find, or a copy of something the giver had
        // already analysed. Everyone else, a Key and a Final included, gets
        // the Observe half and buys the rest with an Analyze.
        description: bulletDescription(playerText, read ? analyzedText : ""),
        extraFlags: {
            [TRUTH_BULLET_FLAGS.isBullet]: true,
            [TRUTH_BULLET_FLAGS.shownType]: shown,
            [TRUTH_BULLET_FLAGS.visibility]: visibility,
            /* Gated like `tiedToCrime` and `sourceAction` below, and for the
               same reason - see the note on the flag itself. */
            [TRUTH_BULLET_FLAGS.faint]: identified ? !!faint : false,
            [TRUTH_BULLET_FLAGS.analyzed]: analyzed ?? (selfEvident && !READ_ON_ANALYZE.includes(realType)),
            [TRUTH_BULLET_FLAGS.chapter]: stamp?.chapter ?? clock.chapter,
            [TRUTH_BULLET_FLAGS.room]: room ?? roomOfActor(actor) ?? null,
            [TRUTH_BULLET_FLAGS.day]: stamp?.day ?? clock.day,
            [TRUTH_BULLET_FLAGS.timeOfDay]: stamp?.timeOfDay ?? clock.timeOfDay,
            [TRUTH_BULLET_FLAGS.playerText]: playerText,
            [TRUTH_BULLET_FLAGS.analyzedText]: read ? analyzedText : "",
            [TRUTH_BULLET_FLAGS.remnantRef]: remnantId && sceneId ? `${sceneId}.${remnantId}` : null,
            [TRUTH_BULLET_FLAGS.sourceAction]: identified ? sourceAction : null,
            [TRUTH_BULLET_FLAGS.tiedToCrime]: identified ? tiedToCrime : null,
            // Never inherited. A failed analysis is a fact about the person who
            // failed, not about the evidence - guide, Stage 3.
            [TRUTH_BULLET_FLAGS.lockedChapter]: null
        }
    });

    if (!item) return null;

    // `analyzedText` goes into the secret whether or not it went onto the item:
    // that is what lets `identify` publish it later without going back to the
    // Remnant, and what lets a trace the killer has since wiped still pay out.
    await setSecret(item.uuid, {
        realType, gmNote, remnantId, sceneId, sourceAction, tiedToCrime, analyzedText,
        faint: !!faint
    });

    /*
     * AFTER THE SECRET IS FILED, so the sound cannot arrive before the thing it
     * is about is completely written - and AIMED, which it was not.
     *
     * This function only ever runs on a GM's browser: it says so forty lines up,
     * and it has to, because the answer key lives there. So a plain `playSfx`
     * played the find on the one screen that had not found anything, and the
     * student who did hear nothing at all. The catalogue has said "heard by
     * whoever found it" since E14; this was the one event that never was
     * (Dawid, 29.08).
     */
    playSfxFor(actor, "truthBullet");

    // The marker this came off is now a thing this player has seen.
    await revealSourceOf(sceneId, remnantId);

    log(`${actor.name} gained Truth Bullet "${name}" (really ${realType}, ${visibility}).`);
    return item;
}

/**
 * Everything the current user is allowed to know about a bullet, in one shape.
 * A GM gets the truth folded in; a player gets only their own half.
 */
export function truthBulletData(item) {
    if (!isTruthBullet(item)) return null;

    const flag = key => item.getFlag(MODULE_ID, key);
    const shownType = flag(TRUTH_BULLET_FLAGS.shownType) ?? "neutral";
    const visibility = flag(TRUTH_BULLET_FLAGS.visibility) ?? "evident";
    const secret = secretOf(item.uuid);

    return {
        item,
        uuid: item.uuid,
        name: item.name,
        shownType,
        shownLabel: TRUTH_BULLET_TYPES[shownType]?.label ?? shownType,
        /* The line for what the holder has READ: a kind's `analysedHint` once its
           reading is earned, where it has one. The un-analysed `hint` of a Key or
           a Final points at an Analyze that has already been made. */
        shownHint: (hasReading(item) && TRUTH_BULLET_TYPES[shownType]?.analysedHint)
            || (TRUTH_BULLET_TYPES[shownType]?.hint ?? ""),
        visibility,
        visibilityLabel: REMNANT_VISIBILITY_LABELS[visibility] ?? visibility,
        faint: !!flag(TRUTH_BULLET_FLAGS.faint),
        analyzed: !!flag(TRUTH_BULLET_FLAGS.analyzed),
        /* THE ONE ANSWER TO "HAS THIS BEEN SETTLED", so the four surfaces that
           ask it - the inventory row, the item window, the trial's pack and the
           handover card - cannot drift into four spellings of `isIdentified`.
           Same rule as the function of that name above, read off the data a
           caller already has rather than off the item again. */
        identified: !!flag(TRUTH_BULLET_FLAGS.analyzed) || shownType !== "neutral",
        chapter: flag(TRUTH_BULLET_FLAGS.chapter) ?? null,
        room: flag(TRUTH_BULLET_FLAGS.room) ?? null,
        day: flag(TRUTH_BULLET_FLAGS.day) ?? null,
        timeOfDay: flag(TRUTH_BULLET_FLAGS.timeOfDay) ?? null,
        playerText: flag(TRUTH_BULLET_FLAGS.playerText) ?? "",
        /* Empty until this holder has analysed it - see TRUTH_BULLET_FLAGS. */
        analyzedText: flag(TRUTH_BULLET_FLAGS.analyzedText) ?? "",
        remnantRef: flag(TRUTH_BULLET_FLAGS.remnantRef) ?? null,
        /* Null until the bullet is identified - see TRUTH_BULLET_FLAGS. */
        sourceAction: flag(TRUTH_BULLET_FLAGS.sourceAction) ?? null,
        tiedToCrime: flag(TRUTH_BULLET_FLAGS.tiedToCrime) ?? null,
        lockedChapter: flag(TRUTH_BULLET_FLAGS.lockedChapter) ?? null,
        /** So a caller can tell a live lock from a spent one without the clock. */
        chapterNow: currentChapter(),

        /* ---- GM half. Undefined for everybody else, never null-but-present,
                so a template that leaks it renders nothing rather than "null". */
        realType: game.user.isGM ? (secret.realType ?? "neutral") : undefined,
        realLabel: game.user.isGM
            ? (TRUTH_BULLET_TYPES[secret.realType ?? "neutral"]?.label ?? secret.realType)
            : undefined,
        gmNote: game.user.isGM ? (secret.gmNote ?? "") : undefined,
        /* What analysis WOULD say, whether or not this holder has bought it.
           `analyzedText` above is this holder's copy and is empty until they
           have; this is the ledger's, so a GM reading somebody's pack sees the
           whole object rather than the part that person has paid for. */
        realAnalyzedText: game.user.isGM ? (secret.analyzedText ?? "") : undefined,
        remnantId: game.user.isGM ? (secret.remnantId ?? null) : undefined,
        sceneId: game.user.isGM ? (secret.sceneId ?? null) : undefined
    };
}

/**
 * Whether this bullet is Faint, asked of the ledger first and the item second.
 *
 * GM-side only, like everything else that reads the ledger. The item is the
 * fallback and not the answer: a bullet made before 1.2.47 carries the flag
 * there and has nothing in its secret, and one made since carries it on the
 * item only once it has been identified. Reading the ledger first and the item
 * second is right in both worlds, and `migrateFaintIntoSecrets` below closes
 * the gap for every bullet with a row, once, in the migration (E04).
 */
export function faintOf(item) {
    if (!item) return false;
    const secret = secretOf(item.uuid);
    if (typeof secret.faint === "boolean") return secret.faint;
    return !!item.getFlag(MODULE_ID, TRUTH_BULLET_FLAGS.faint);
}

/**
 * Bring every Truth Bullet copied from one trace into line with its `public`
 * record.
 *
 * Called from remnants.mjs's `setRemnantPublic` - never on its own - because
 * finding "every bullet copied from this trace" reads `secretOf(item.uuid)
 * .remnantId`, the answer key, and that only resolves on a GM's client.
 * Which fields move: name, portrait and the description a player
 * reads - never `realType`, `gmNote` or anything else the ledger's secret
 * half holds.
 *
 * THE ANALYSIS HALF MOVES DOWN TWO ROADS, NOT ONE, and that is the whole of
 * the second tier working. A GM who rewrites what analysis says is rewriting
 * it for two kinds of holder at once: the ones who have already bought it,
 * whose ITEM has to change or their pack keeps quoting the old sentence in the
 * trial, and the ones who have not, whose item must not learn a word of it -
 * for them the new text goes into the SECRET and waits for their own roll.
 * Writing only the first road would silently strand every un-analysed copy on
 * the text the trace was created with; writing only the second would leave
 * every analysed copy stale. So: secret always, item where `hasReading`.
 *
 * @returns {Promise<number>} how many bullets were updated.
 */
export async function propagateRemnantPublic(remnantTokenId, pub) {
    if (!game.user.isGM || !remnantTokenId || !pub) return 0;

    let touched = 0;
    for (const actor of game.actors) {
        if (actor.type !== "character") continue;
        for (const item of bulletsOf(actor)) {
            if (secretOf(item.uuid).remnantId !== remnantTokenId) continue;
            const analyzedText = pub.analyzedText ?? "";
            try {
                // The road that reaches every copy, analysed or not. Filed first
                // so that a failure on the item below cannot leave the ledger
                // holding the older sentence. `ifLive`: it amends a row this GM
                // holds (the line above found it), and never starts one.
                await setSecret(item.uuid, { analyzedText }, { ifLive: true });

                // And this holder's own half. `hasReading` is the whole gate: a
                // bullet still showing Neutral - or a Key or a Final nobody has
                // analysed yet - gets the Observe text and an empty second tier,
                // which is what its flags already said.
                const earned = hasReading(item) ? analyzedText : "";

                // `FROM_REMNANT` on the OPTIONS, not the data: it is a fact about
                // where this write came from, not about the bullet. `watchBulletEdits`
                // below reads it to know this is the trace talking and not a GM,
                // which is the whole of the loop guard.
                await item.update({
                    name: pub.name || item.name,
                    img: pub.img || item.img,
                    "system.description": bulletDescription(pub.playerText ?? "", earned),
                    [`flags.${MODULE_ID}.${TRUTH_BULLET_FLAGS.playerText}`]: pub.playerText ?? "",
                    [`flags.${MODULE_ID}.${TRUTH_BULLET_FLAGS.analyzedText}`]: earned
                }, { [FROM_REMNANT]: true });
                touched++;
            } catch (err) {
                error(`Could not propagate the Remnant's public record onto "${item.name}"`, err);
            }
        }
    }
    return touched;
}

/**
 * A GM changed their mind about whether a trace belongs to the murder - see
 * `setRemnantFlags` in remnants.mjs, the only caller. The verdict moves into
 * every bullet copied from that trace: into the secret always, and onto the
 * item only where the holder has already earned the truth. Anything less and
 * the murder-first sort keeps ordering the pack by a retracted ruling.
 *
 * @returns {Promise<number>} how many bullets were touched.
 */
export async function propagateCrimeTie(remnantTokenId, tied) {
    if (!game.user.isGM || !remnantTokenId) return 0;

    let touched = 0;
    for (const actor of game.actors) {
        if (actor.type !== "character") continue;
        for (const item of bulletsOf(actor)) {
            if (secretOf(item.uuid).remnantId !== remnantTokenId) continue;
            try {
                await setSecret(item.uuid, { tiedToCrime: Boolean(tied) }, { ifLive: true });
                if (isIdentified(item)) {
                    await item.update({
                        [`flags.${MODULE_ID}.${TRUTH_BULLET_FLAGS.tiedToCrime}`]: Boolean(tied)
                    });
                }
                touched++;
            } catch (err) {
                error(`Could not move the crime tie onto "${item.name}"`, err);
            }
        }
    }
    return touched;
}

/**
 * `propagateCrimeTie` for many traces in one pass (E04, 1.2.63): the copies'
 * answer keys in one store write, and each identified copy's item as before.
 * `setRemnantFlagsMany` (remnants.mjs) calls it for a chapter's traces at a
 * victim's death and a weapon's at its use; one call per trace was one pass over
 * every bullet in the world and one write of the store per trace.
 *
 * @returns {Promise<number>} how many copies moved
 */
export async function propagateCrimeTieMany(remnantTokenIds, tied) {
    const ids = new Set((remnantTokenIds ?? []).filter(Boolean));
    if (!game.user.isGM || !ids.size) return 0;

    const secrets = {}, shown = [];
    for (const actor of game.actors) {
        if (actor.type !== "character") continue;
        for (const item of bulletsOf(actor)) {
            if (!ids.has(secretOf(item.uuid).remnantId)) continue;
            secrets[item.uuid] = { tiedToCrime: Boolean(tied) };
            if (isIdentified(item)) shown.push(item);
        }
    }
    if (!Object.keys(secrets).length) return 0;
    await bulletStore.patchMany(secrets, { ifLive: true });
    for (const item of shown) {
        try {
            await item.update({ [`flags.${MODULE_ID}.${TRUTH_BULLET_FLAGS.tiedToCrime}`]: Boolean(tied) });
        } catch (err) {
            error(`Could not move the crime tie onto "${item.name}"`, err);
        }
    }
    return Object.keys(secrets).length;
}

/**
 * A GM corrected what a trace really is: move it onto every copy of it.
 *
 * The twin of `propagateCrimeTie` above, and the same two halves for the same
 * reason. The SECRET always: that is the answer key, and a copy whose key
 * disagrees with the trace it came from would pay out the old category the next
 * time somebody analysed it. The player's ITEM only where the copy is already
 * identified: an unanalysed one is showing "Neutral" and must go on showing it,
 * or a GM's correction would hand the answer to everybody holding a copy.
 *
 * `shownType` as well as the secret on an identified copy, because that is what
 * the row and the card read - without it the dashboard would say Tamper and the
 * player's pack would still say Prep, and the trial would be spent working out
 * which of the two is lying.
 *
 * @returns {Promise<number>} how many copies moved
 */
export async function propagateRealType(remnantTokenId, realType) {
    if (!game.user.isGM || !remnantTokenId || !realType) return 0;

    let touched = 0;
    for (const actor of game.actors) {
        if (actor.type !== "character") continue;
        for (const item of bulletsOf(actor)) {
            if (secretOf(item.uuid).remnantId !== remnantTokenId) continue;
            try {
                await setSecret(item.uuid, { realType }, { ifLive: true });
                if (isIdentified(item)) {
                    await item.update({
                        [`flags.${MODULE_ID}.${TRUTH_BULLET_FLAGS.shownType}`]: realType
                    });
                }
                touched++;
            } catch (err) {
                error(`Could not move the corrected type onto "${item.name}"`, err);
            }
        }
    }
    return touched;
}

/**
 * The Autopsy bullet - decision D2: issued by hand from the GM panel, never
 * rolled for. Guide, p. 29: "Zawsze dostarczana graczom w każdym rozdziale jako
 * pierwsza poszlaka."
 *
 * @param {Actor[]} actors
 */
export async function issueAutopsy(actors, { name, playerText = "", gmNote = "" } = {}) {
    if (!game.user.isGM) return 0;

    let issued = 0;
    for (const actor of actors ?? []) {
        const item = await createTruthBullet(actor, {
            name,
            realType: "autopsy",
            // Autopsy findings are handed over openly - there is nothing to spot.
            visibility: "obvious",
            playerText,
            gmNote,
            // The autopsy is BY DEFINITION about the murder, and it arrives
            // identified - so it takes its place at the top of the pack's
            // murder-first sort from the moment it lands.
            tiedToCrime: true
        });
        if (!item) continue;
        issued++;
        await whisperToOwner(actor, `
            <h3>${game.i18n.localize("DRPG.TruthBullet.received")}</h3>
            <p><strong>${foundry.utils.escapeHTML(name)}</strong> - ${
                foundry.utils.escapeHTML(TRUTH_BULLET_TYPES.autopsy.label)
            }</p>
            ${playerText ? `<p>${foundry.utils.escapeHTML(playerText)}</p>` : ""}`);
    }

    if (issued) log(`Issued an Autopsy Truth Bullet to ${issued} character(s).`);
    return issued;
}

/* ==========================================================================
 * MIGRATION
 * --------------------------------------------------------------------------
 * Bullets handed out before this file existed are plain items with a category.
 * Worse, `macros/03` wrote the visibility index into the `tier` field, because
 * a bullet had nowhere else to put it - so an "Evident" bullet reads as Tier 1.
 * That mapping is recoverable exactly, which is why it is used rather than
 * guessed at.
 *
 * What cannot be recovered is what each bullet really was. The module does not
 * invent an answer: everything lands as `neutral` and the GMs get a list to
 * correct by hand.
 * ========================================================================== */

/**
 * Move Faint off the player's item and into the ledger, where it belongs.
 *
 * A world made before 1.2.47 carries `faint` on every bullet's item, whether or
 * not its holder has analysed it - see the note on the flag. That is a fact
 * about the object sitting in a player's own data, and it is the one kind of
 * leak this module has spent three releases closing.
 *
 * IT USED TO BE THE ROAD THAT ERASED THE ANSWER KEY (E04, audit S05-01). It ran
 * on every GM at every load, and for a bullet whose row this GM did not hold it
 * built one from nothing - `{ faint, updated: now }` - which the whole-entry
 * merge then took over the full row on every other GM. Now it is a clause of the
 * migration (`faintIntoSecrets`), run once by the primary after the other GMs'
 * copies have arrived, and its write can derive nothing from absence: `ifLive`,
 * so a bullet with no row here gets none (its item keeps the flag, and it is
 * counted), and `weak`, so a Faint any GM decided wins over the item's. The
 * item's flag comes off only where the row, read back from storage and not from
 * memory, holds a Faint.
 *
 * IDEMPOTENT: a second run finds `typeof secret.faint === "boolean"` wherever it
 * wrote, and nothing else to do.
 *
 * @returns {Promise<{moved: number, kept: number}>} rows given a Faint, and
 *   bullets with no row whose item still carries it.
 */
export async function migrateFaintIntoSecrets() {
    if (!game.user.isGM) return { moved: 0, kept: 0 };
    if (await bulletStore.whenHydrated() === "timedOut") {
        throw new Error("the other GMs' copies of the answer key did not arrive; the next load tries again");
    }

    let moved = 0, kept = 0;
    for (const actor of game.actors ?? []) {
        for (const item of actor.items ?? []) {
            if (!isTruthBullet(item)) continue;
            const secret = secretOf(item.uuid);
            if (typeof secret.faint === "boolean") continue;

            const onItem = !!item.getFlag(MODULE_ID, TRUTH_BULLET_FLAGS.faint);
            if (!bulletStore.has(item.uuid)) {
                if (onItem) kept++;
                continue;
            }
            try {
                await setSecret(item.uuid, { faint: onItem }, { ifLive: true, weak: true });
                if (onItem && !isIdentified(item) && typeof bulletStore.persisted(item.uuid)?.faint === "boolean") {
                    await item.update({
                        [`flags.${MODULE_ID}.${TRUTH_BULLET_FLAGS.faint}`]: false
                    });
                }
                moved++;
            } catch (err) {
                error(`Could not move Faint into the ledger for "${item.name}"`, err);
            }
        }
    }

    if (moved || kept) log(`Moved Faint into the ledger for ${moved} Truth Bullet(s); ${kept} with no row here keep it on the item.`);
    return { moved, kept };
}

/**
 * Bring bullets made by the old macros to the Stage 1 shape: the item's flags as
 * before, and a row that says "neutral" - weak and only where the row has no
 * realType, so an answer any GM wrote is never replaced by the default (E04: it
 * ran on every load of the primary; it is the clause `truthBulletShape` now, run
 * once, after the other GMs' copies have arrived). Also `game.drpg.migrateTruthBullets()`.
 */
export async function migrateTruthBullets() {
    if (!game.user.isGM || !isPrimaryGm()) return 0;
    if (await bulletStore.whenHydrated() === "timedOut") {
        throw new Error("the other GMs' copies of the answer key did not arrive; the next load tries again");
    }

    const { getClock } = await import("./clock.mjs");
    const chapter = getClock().chapter;
    const migrated = [];

    for (const actor of game.actors) {
        if (actor.type !== "character") continue;

        for (const item of bulletsOf(actor)) {
            // Idempotent: the presence of a shown type is what "already done"
            // means, so a reload or a second GM cannot double-migrate.
            if (item.getFlag(MODULE_ID, TRUTH_BULLET_FLAGS.shownType)) continue;

            const tier = item.getFlag(MODULE_ID, "tier");
            const visibility = Number.isInteger(tier) && REMNANT_VISIBILITY[tier]
                ? REMNANT_VISIBILITY[tier]
                : "evident";

            try {
                await item.update({
                    [`flags.${MODULE_ID}.${TRUTH_BULLET_FLAGS.isBullet}`]: true,
                    [`flags.${MODULE_ID}.${TRUTH_BULLET_FLAGS.shownType}`]: "neutral",
                    [`flags.${MODULE_ID}.${TRUTH_BULLET_FLAGS.visibility}`]: visibility,
                    [`flags.${MODULE_ID}.${TRUTH_BULLET_FLAGS.faint}`]: false,
                    [`flags.${MODULE_ID}.${TRUTH_BULLET_FLAGS.analyzed}`]: false,
                    [`flags.${MODULE_ID}.${TRUTH_BULLET_FLAGS.chapter}`]: chapter,
                    [`flags.${MODULE_ID}.${TRUTH_BULLET_FLAGS.playerText}`]: "",
                    [`flags.${MODULE_ID}.${TRUTH_BULLET_FLAGS.lockedChapter}`]: null,
                    // The old visibility-as-tier smuggling ends here.
                    [`flags.${MODULE_ID}.tier`]: null
                });
                await setSecret(item.uuid, { realType: "neutral", gmNote: "" }, { weak: true, fillOnly: true });
                migrated.push({ actor: actor.name, name: item.name, visibility });
            } catch (err) {
                error(`Could not migrate the Truth Bullet "${item.name}" on ${actor.name}`, err);
            }
        }
    }

    if (migrated.length) {
        const rows = migrated.map(m =>
            `<li>${foundry.utils.escapeHTML(m.actor)} - <strong>${
                foundry.utils.escapeHTML(m.name)
            }</strong> (${REMNANT_VISIBILITY_LABELS[m.visibility] ?? m.visibility})</li>`).join("");
        await whisperToGms(`
            <h3>${game.i18n.localize("DRPG.TruthBullet.migratedTitle")}</h3>
            <p>${plural("DRPG.TruthBullet.migrated", { n: migrated.length })}</p>
            <ul>${rows}</ul>`);
        log(`Migrated ${migrated.length} Truth Bullet(s) to the Stage 1 shape.`);
    }

    return migrated.length;
}

/* ==========================================================================
 * WIRING
 * ========================================================================== */

/**
 * The option that says "this write came from the trace".
 *
 * See `watchBulletEdits`. One word, on the options rather than in the data,
 * because it is a fact about the write and not about the bullet - and because
 * anything stored on the document would have to be cleaned off again.
 */
const FROM_REMNANT = "drpgFromRemnant";

/**
 * A write the MODULE makes to a bullet as bookkeeping, which is not anybody
 * describing the object - so the edit sync below must not carry it up to the trace.
 *
 * Measured 21.09, on 1.2.47 as shipped: a rerolled Analyze that loses clears the
 * reading it had published (`analyzedText: ""`), `watchBulletEdits` took that for
 * a GM rewriting the bullet, wrote the empty string onto the TRACE, and the trace
 * sent it down to every copy. One player's failed reroll erased the GM's sentence
 * for the whole table. `identify` had the quieter half of the same hole: it
 * publishes the reading from the bullet's secret, and a secret older than the
 * trace would have been pushed up over the GM's newer words.
 *
 * On the OPTIONS rather than in the data, like `FROM_REMNANT`, and for the same
 * reason: it is a fact about who is writing, not about what is written.
 */
export const NOT_AN_EDIT = "drpgNotAnEdit";

/**
 * A bullet edited anywhere writes back to the trace it came from.
 *
 * Dawid, 28.08: "the synchronisation is to be full, continuous, regardless of
 * when and where the edit happens, between remnant and truth bullet."
 *
 * HALF OF THIS ALREADY EXISTED and that is exactly why it was worth saying out
 * loud. `propagateRemnantPublic` has always pushed the trace's record onto every
 * bullet copied from it - measured, two holders, both followed. What had no
 * road at all was the other direction: a GM correcting a bullet on its own item
 * sheet, or in the item manager, changed that one copy and nothing else. The
 * player next to them went on holding the old words for the same object, which
 * in a trial is not a cosmetic difference - it is a false contradiction the
 * table has to spend the trial resolving.
 *
 * So the trace stays the single record and the bullet is a view of it, edited
 * from either end. A GM's correction goes UP to the trace, and the trace sends
 * it back DOWN to every copy including the one just edited - which is what
 * makes two GMs editing two different copies converge instead of fighting.
 *
 * THE LOOP IS BROKEN AT THE TOP, not by comparing values: `propagateRemnantPublic`
 * stamps its own writes with `FROM_REMNANT` and this ignores those. Comparing
 * would have worked for the name and failed for the description, which is stored
 * twice - once as a flag and once wrapped in `<p>` - and would have looped
 * forever on the wrapping.
 */
/* ==========================================================================
 * WHAT A PLAYER CANNOT CHANGE ON THEIR OWN BULLET (E03, 24.09.2026; audit S05-12)
 * --------------------------------------------------------------------------
 * A player owns the character, so they own its items - Truth Bullets included -
 * and can write any field of one from the console. The watcher below then took
 * the change as a GM's: it carried a new description up to the trace, and the
 * trace pushed it down onto every other player's copy, so a killer holding a
 * copy of the knife could rewrite the lab reading the whole table would bring to
 * the trial. And the flags that say what a bullet IS - analysed or not, what it
 * shows, the chapter lock - were theirs to set too.
 *
 * So every GM's browser keeps a copy of those fields for every bullet
 * (`guards`, below), refreshed by every write a GM makes, and the primary GM
 * puts a player's change to any of them back from it - only the fields the
 * change touched, so nothing else a player writes is undone - and the GMs are
 * told. That the author is really a player relies on Daggerheart's relay never
 * writing a guarded field for a player: relay-guard.mjs lets it write only an
 * item's charges and quantity, and a relayed write is authored by the GM who
 * ran it.
 *
 * IN MEMORY, NOT IN THE LEDGER (E03 second review, 24.09.2026). The first build
 * kept the copy as `guard` in the bullet's secret, and recording it at load
 * stamped every entry written before E03 - and a stub for every bullet this
 * browser had no entry for - as the newest. The ledger's merge keeps the newest
 * entry whole, so the other GMs' real answer keys, and a restored backup, lost
 * to those stamps. The copy is a GM's view of the bullets as they stand, which
 * every GM can rebuild at load from the items themselves; it has no business
 * travelling with the answer key.
 * ========================================================================== */

const GUARDED_BULLET_FLAGS = [
    "playerText", "analyzedText", "shownType", "analyzed", "lockedChapter", "faint",
    "tiedToCrime", "sourceAction", "visibility", "remnantRef", "isBullet"
].map(key => TRUTH_BULLET_FLAGS[key]);

/** The guarded fields of a bullet as it stands, keyed by update path. */
function guardedValues(item) {
    const values = {
        name: item.name,
        img: item.img,
        "system.description": item.system?.description ?? ""
    };
    for (const key of GUARDED_BULLET_FLAGS) {
        values[`flags.${MODULE_ID}.${key}`] = item.getFlag(MODULE_ID, key) ?? null;
    }
    return values;
}

/** Which guarded paths an update touched, deletions (`-=key`) included. */
export function guardedPathsIn(changes) {
    const touched = [];
    if (changes?.name !== undefined) touched.push("name");
    if (changes?.img !== undefined) touched.push("img");
    if (changes?.system?.description !== undefined) touched.push("system.description");
    const flags = changes?.flags?.[MODULE_ID] ?? {};
    for (const key of GUARDED_BULLET_FLAGS) {
        if (key in flags || `-=${key}` in flags) touched.push(`flags.${MODULE_ID}.${key}`);
    }
    return touched;
}

/** uuid -> the guarded fields as a GM last left them, on this browser. */
const guards = new Map();

/** Keep this GM's copy of a bullet's guarded fields up to date. */
function refreshGuard(item) {
    guards.set(item.uuid, guardedValues(item));
}

/** Put a player's change to a guarded field back, and tell the GMs. */
async function revertPlayerBulletEdit(item, touched, author) {
    const guard = guards.get(item.uuid) ?? null;
    const patch = {};
    for (const path of touched) {
        if (guard && path in guard) patch[path] = guard[path];
    }
    const missed = touched.filter(path => !(path in patch));
    if (Object.keys(patch).length) {
        await item.update(patch, { [NOT_AN_EDIT]: true });
    }
    warn(`${author?.name ?? "A player"} edited the Truth Bullet "${item.name}" (${touched.join(", ")}): ${
        missed.length ? `no record to restore ${missed.join(", ")}` : "put back"}.`);
    // Only what was really put back is called put back. A field with no record
    // stays as the player wrote it, on this copy alone - the edit is never
    // carried up to the trace - and the GMs are told to look.
    await whisperToGms(`<p class="drpg-warning">${game.i18n.format(
        missed.length ? "DRPG.TruthBullet.editUnrestored" : "DRPG.TruthBullet.editReverted", {
            player: foundry.utils.escapeHTML(author?.name ?? "?"),
            bullet: foundry.utils.escapeHTML(String(patch.name ?? item.name ?? "?"))
        })}</p>`);
}

/**
 * Every bullet is recorded as it stands - once, at load, on every GM's browser,
 * so whichever GM is primary later has a copy to put a player's edit back from.
 *
 * TAKEN AS THE TRUTH, NOT COMPARED. An edit a player made while no GM was
 * online is already in the item by now, and nothing older survives a reload to
 * compare it with. That comparison waits for a record every GM shares (E04,
 * GmStore); until then it is a known gap (AUDIT §9).
 */
function guardAllBullets() {
    if (!game.user?.isGM) return;
    guardRuns.runs++;
    for (const actor of game.actors ?? []) {
        for (const item of bulletsOf(actor)) refreshGuard(item);
    }
    guardRuns.recorded = guards.size;
}

/**
 * Drop this browser's copy of one bullet - the state a bullet this GM never saw
 * a GM write is in. For the harness, which has no second browser to start cold.
 */
export function forgetBulletGuard(uuid) {
    guards.delete(uuid);
}

/** How often the load-time record ran here, how many bullets it held then and now - for the harness. */
const guardRuns = { runs: 0, recorded: 0 };
export function bulletGuardStatus() {
    return { ...guardRuns, known: guards.size };
}

function watchBulletEdits() {
    /*
     * RUN NOW when the world is already up. This is called from the module's own
     * `ready` handler, and a `Hooks.once("ready")` registered inside `ready` is
     * never called (dice-sync.mjs says the same): the first version waited for it
     * and recorded nothing, so no bullet made before E03 had a record to be put
     * back from (measured by the E03 review, 24.09.2026).
     */
    const guardAll = () => {
        try { guardAllBullets(); } catch (err) { error("Could not record the Truth Bullets' guarded fields", err); }
    };
    if (game.ready) guardAll();
    else Hooks.once("ready", guardAll);
    Hooks.on("createItem", (item, options, userId) => {
        if (!game.user?.isGM || !isTruthBullet(item)) return;
        if (!game.users.get(userId ?? "")?.isGM) return;
        refreshGuard(item);
    });
    Hooks.on("deleteItem", item => { guards.delete(item.uuid); });
    Hooks.on("updateItem", async (item, changes, options, userId) => {
        try {
            // Every GM's copy follows a GM's write - the next primary may be any
            // of them. Memory only: nothing is written, so no GM doubles anything.
            const touched = isTruthBullet(item) ? guardedPathsIn(changes) : [];
            const author = game.users.get(userId ?? "");
            if (touched.length && author?.isGM && game.user?.isGM) refreshGuard(item);
            /*
             * THE PRIMARY GM, not "a GM" - and with two Gamemasters at this
             * table that is not pedantry. `updateItem` fires on every client,
             * so `isGM` alone had both of them writing the same patch to the
             * trace, each one pushing it back down onto every copy and each
             * one syncing the ledger to the other. One rename became two
             * cascades. Same rule the trap relay and the search tokens use.
             */
            if (!isPrimaryGm()) return;
            if (touched.length && !author?.isGM) {
                await revertPlayerBulletEdit(item, touched, author);
                return;
            }
            if (options?.[FROM_REMNANT]) return;              // the trace talking
            if (options?.[NOT_AN_EDIT]) return;               // the module keeping books
            if (!isTruthBullet(item)) return;

            const ref = item.getFlag(MODULE_ID, TRUTH_BULLET_FLAGS.remnantRef);
            if (!ref) return;                                  // not copied from a trace
            const [sceneId, tokenId] = String(ref).split(".");
            if (!sceneId || !tokenId) return;

            // Only the things the trace owns. A GM ticking `identified` or
            // burning an analysis is not describing the object.
            const patch = {};
            if (changes.name !== undefined) patch.name = item.name;
            const flags = changes.flags?.[MODULE_ID] ?? {};
            if (flags[TRUTH_BULLET_FLAGS.playerText] !== undefined) {
                patch.playerText = item.getFlag(MODULE_ID, TRUTH_BULLET_FLAGS.playerText) ?? "";
            }
            if (flags[TRUTH_BULLET_FLAGS.analyzedText] !== undefined) {
                patch.analyzedText = item.getFlag(MODULE_ID, TRUTH_BULLET_FLAGS.analyzedText) ?? "";
            }
            /*
             * The description is edited on the item sheet as HTML, and the flag
             * is the same sentence in plain text. A GM typing into the sheet
             * changes only the first, so it is read back and stripped - without
             * this, editing a bullet the ordinary way would write the name to the
             * trace and silently drop the words.
             *
             * THE ANALYSIS PARAGRAPH IS CUT OUT BEFORE THE SCRAPE, and it has to
             * be. `bulletDescription` renders two blocks into this one field, so
             * a flat `textContent` would fold the lab reading - and the heading
             * in front of it - into `playerText` and then push that sentence
             * down onto every copy of the trace, including the copies held by
             * people who have not analysed anything. One GM opening a bullet's
             * sheet would publish the answer to the whole table.
             *
             * Cut by the class `bulletDescription` stamps, which is the only
             * thing here that knows the two halves apart.
             */
            if (changes.system?.description !== undefined && patch.playerText === undefined) {
                // A template, whose content is inert: read for its text, never run.
                const wrap = document.createElement("template");
                wrap.innerHTML = String(item.system?.description ?? "");
                for (const block of wrap.content.querySelectorAll(".drpg-bullet-analysis")) block.remove();
                patch.playerText = wrap.content.textContent.replace(/\s+/g, " ").trim();
            }
            if (!Object.keys(patch).length) return;

            const { setRemnantPublicById } = await import("./remnants.mjs");
            await setRemnantPublicById(sceneId, tokenId, patch);
        } catch (err) {
            error("Could not carry a Truth Bullet's edit back to its trace", err);
        }
    });
}

export function registerTruthBullets() {
    watchBulletEdits();
    /*
     * NO SOCKET OF ITS OWN SINCE E04 (1.2.63). The answer key travelled between GMs
     * here - a push per write, a request at load, a whole ledger in answer - merged
     * by whole entries, which is how a GM who joined erased it (S05-01). It is a GM
     * store now (gm-stores.mjs), and the engine carries it. Nor does it migrate at
     * load any more: the two passes that ran on every GM's every load are clauses
     * of the migration (migrate.mjs, `truthBulletShape` and `faintIntoSecrets`),
     * run once, by the primary, after the other GMs' copies have arrived.
     */
}
