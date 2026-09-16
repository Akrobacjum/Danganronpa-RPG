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
 * It is paid down three ways - every GM holds a full copy, a GM joining asks
 * the others for anything it is missing, and `exportLedger()` writes a backup.
 * The ledger's useful life is one chapter, which keeps the exposure small.
 */

import {
    MODULE_ID, REMNANT_VISIBILITY, REMNANT_VISIBILITY_LABELS, TRUTH_BULLET_TYPES
} from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { getClock } from "./clock.mjs";
import { grantItem, itemsInCategory } from "./inventory.mjs";
import { gmIds, whisperToOwner, whisperToGms, isPrimaryGm, log, warn, error, plural } from "./utils.mjs";
import { playSfxFor } from "./sfx.mjs";

const SOCKET_EVENT = `module.${MODULE_ID}`;

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
    /** Is the shown type confirmed rather than a placeholder? */
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
     * only once the bullet is identified, exactly like `sourceAction` and
     * `tiedToCrime` two entries down and for exactly the same reason: a world
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

/** Socket actions, all addressed to GMs only. */
const TB = {
    secret: "tb.secret",
    request: "tb.ledgerRequest",
    full: "tb.ledgerFull"
};

/* ==========================================================================
 * THE ANSWER KEY
 * --------------------------------------------------------------------------
 * Three functions are the whole interface: `secretOf`, `setSecret`, `dropSecret`.
 * Everything else in the module goes through them, so where the answer key
 * lives is one file's business and can be changed without touching callers.
 * ========================================================================== */

/**
 * The parsed ledger, held between writes.
 *
 * THE SAME MEASUREMENT THE REMNANT LEDGER ALREADY ACTED ON (E17, audit A10).
 * A client-scoped setting lives in `localStorage` as a string, so every read
 * re-parses the whole thing and pays Foundry's validation on top; the Remnant
 * ledger measured 0.858 ms per read at 685 entries and cached it for exactly
 * this reason. This one is read PER BULLET: the Investigation dashboard asks
 * `secretOf` for every bullet of every student on every rebuild, and it
 * rebuilds whenever any item on any actor changes.
 *
 * Safe to hold because every write goes through `writeLedger`, which replaces
 * it - including the merges arriving from another GM's socket. The call sites
 * that mutate the object in place write immediately afterwards, and a mutation
 * that reaches the cache before the write is the value we want to be reading.
 */
let ledgerCache = null;

/** The ledger is stale - parse it again on the next read. */
export function forgetTruthBulletLedger() {
    ledgerCache = null;
}

function readLedger() {
    if (!game.user.isGM) return {};
    if (ledgerCache) return ledgerCache;
    try {
        ledgerCache = game.settings.get(MODULE_ID, SETTINGS.truthBulletSecrets) ?? {};
        return ledgerCache;
    } catch (err) {
        warn("Could not read the Truth Bullet ledger", err);
        return {};
    }
}

async function writeLedger(ledger) {
    if (!game.user.isGM) return;
    try {
        await game.settings.set(MODULE_ID, SETTINGS.truthBulletSecrets, ledger);
        // Held rather than dropped: this IS the newest ledger, and dropping it
        // would make the next read pay for an answer we already have.
        ledgerCache = ledger;
    } catch (err) {
        error("Could not write the Truth Bullet ledger", err);
        ledgerCache = null;
    }
}

/**
 * What a bullet really is. `{}` for anyone who is not a GM - not an error, the
 * honest answer to "what do you know about this".
 *
 * @param {string} uuid  Item uuid. Not `item.id`: an embedded item's id is only
 *   unique inside its own actor, and bullets get copied between actors.
 */
export function secretOf(uuid) {
    if (!game.user.isGM || !uuid) return {};
    const entry = readLedger()[uuid];
    if (!entry || entry.deleted) return {};
    return entry;
}

/** Record or amend what a bullet really is, and tell the other GMs. */
export async function setSecret(uuid, patch = {}) {
    if (!game.user.isGM || !uuid) return null;

    const ledger = readLedger();
    const entry = { ...(ledger[uuid] ?? {}), ...patch, updated: Date.now() };
    delete entry.deleted;
    ledger[uuid] = entry;

    await writeLedger(ledger);
    pushSecret(uuid, entry);
    return entry;
}

/**
 * Forget a bullet. A tombstone rather than a plain delete, so the removal still
 * reaches a GM who was offline when it happened - otherwise their copy would
 * resurrect the entry at the next full sync.
 */
export async function dropSecret(uuid) {
    if (!game.user.isGM || !uuid) return;

    const ledger = readLedger();
    if (!ledger[uuid]) return;

    ledger[uuid] = { deleted: true, updated: Date.now() };
    await writeLedger(ledger);
    pushSecret(uuid, ledger[uuid]);
}

/** Push one entry to every other GM. Players are not among the recipients. */
function pushSecret(uuid, entry) {
    const recipients = gmIds().filter(id => id !== game.user.id);
    if (!recipients.length) return;
    try {
        game.socket.emit(
            SOCKET_EVENT,
            { action: TB.secret, from: game.user.id, uuid, entry },
            { recipients }
        );
    } catch (err) {
        error("Could not sync the Truth Bullet ledger", err);
    }
}

/** Newest write wins, per entry. */
async function mergeEntries(incoming = {}) {
    if (!game.user.isGM) return;

    const ledger = readLedger();
    let changed = false;

    for (const [uuid, entry] of Object.entries(incoming)) {
        if (!entry || typeof entry !== "object") continue;
        const mine = ledger[uuid];
        if (mine && (mine.updated ?? 0) >= (entry.updated ?? 0)) continue;
        ledger[uuid] = entry;
        changed = true;
    }

    if (changed) await writeLedger(ledger);
}

/**
 * A GM who just joined asks the others for anything they are missing.
 *
 * Cheap and unconditional: the ledger is small, and a GM whose browser storage
 * was cleared looks exactly like a GM who was offline for one write.
 */
function requestLedger() {
    const recipients = gmIds().filter(id => id !== game.user.id);
    if (!recipients.length) return;
    try {
        game.socket.emit(SOCKET_EVENT, { action: TB.request, from: game.user.id }, { recipients });
    } catch (err) {
        error("Could not ask the other GMs for the Truth Bullet ledger", err);
    }
}

/** Back up the answer key. Browser storage is not a safe place for one copy. */
export function exportLedger() {
    if (!game.user.isGM) return null;
    const ledger = readLedger();
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    foundry.utils.saveDataToFile(
        JSON.stringify(ledger, null, 2),
        "application/json",
        `drpg-truth-bullets-${stamp}.json`
    );
    return ledger;
}

/** Merge a previously exported file back in. Newest entry per bullet wins. */
export async function importLedger(json) {
    if (!game.user.isGM) return false;
    let data;
    try {
        data = typeof json === "string" ? JSON.parse(json) : json;
    } catch (err) {
        ui.notifications.error(game.i18n.localize("DRPG.TruthBullet.importFailed"));
        return false;
    }
    if (!data || typeof data !== "object") return false;

    await mergeEntries(data);
    // The importing GM is now the most complete copy; push it outward.
    for (const [uuid, entry] of Object.entries(readLedger())) pushSecret(uuid, entry);
    ui.notifications.info(plural("DRPG.TruthBullet.imported", {
        n: Object.keys(data).length
    }));
    return true;
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
    if (item.getFlag(MODULE_ID, TRUTH_BULLET_FLAGS.shownType) !== "neutral") return false;

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
 * identified, so Analyze never runs on one.
 *
 * WHICH IS WHY THE KEY-REMNANT PLANNER AND THE FINAL TRUTH FORM CARRY NO
 * ANALYSIS BOX, and their absence is a decision rather than an oversight: a
 * second tier on a bullet that identifies itself is a field no roll could ever
 * reveal, so it would be a box the GM fills in and nobody ever reads. The
 * Traces tab of the same dashboard has one, because those are the traces
 * Analyze is actually thrown at.
 */
const SELF_EVIDENT = ["key", "autopsy", "final"];

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
        // The analysis rides along only for a bullet that is born identified -
        // a Key, an Autopsy, a critical find, or a copy of something the giver
        // had already analysed. Everyone else gets the Observe half and buys
        // the rest with a Head roll.
        description: bulletDescription(playerText, identified ? analyzedText : ""),
        extraFlags: {
            [TRUTH_BULLET_FLAGS.isBullet]: true,
            [TRUTH_BULLET_FLAGS.shownType]: shown,
            [TRUTH_BULLET_FLAGS.visibility]: visibility,
            /* Gated like `tiedToCrime` and `sourceAction` below, and for the
               same reason - see the note on the flag itself. */
            [TRUTH_BULLET_FLAGS.faint]: identified ? !!faint : false,
            [TRUTH_BULLET_FLAGS.analyzed]: analyzed ?? selfEvident,
            [TRUTH_BULLET_FLAGS.chapter]: stamp?.chapter ?? clock.chapter,
            [TRUTH_BULLET_FLAGS.room]: room ?? roomOfActor(actor) ?? null,
            [TRUTH_BULLET_FLAGS.day]: stamp?.day ?? clock.day,
            [TRUTH_BULLET_FLAGS.timeOfDay]: stamp?.timeOfDay ?? clock.timeOfDay,
            [TRUTH_BULLET_FLAGS.playerText]: playerText,
            [TRUTH_BULLET_FLAGS.analyzedText]: identified ? analyzedText : "",
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
        shownHint: TRUTH_BULLET_TYPES[shownType]?.hint ?? "",
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
 * the gap for good the first time a GM logs in.
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
 * every analysed copy stale. So: secret always, item where `isIdentified`.
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
                // holding the older sentence.
                await setSecret(item.uuid, { analyzedText });

                // And this holder's own half. `isIdentified` is the whole gate:
                // a bullet still showing Neutral gets the Observe text and an
                // empty second tier, which is what its flags already said.
                const earned = isIdentified(item) ? analyzedText : "";

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
                await setSecret(item.uuid, { tiedToCrime: Boolean(tied) });
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
                await setSecret(item.uuid, { realType });
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
 * IDEMPOTENT BY CONSTRUCTION, with no marker setting to go stale. For each
 * bullet the ledger does not yet have a `faint` for, the item's flag is the
 * truth and is copied in; and where the bullet is NOT identified, the flag is
 * then cleared, because an unidentified bullet has no business carrying it. A
 * second run finds `typeof secret.faint === "boolean"` everywhere and does
 * nothing. A bullet made since the change is already in that state.
 *
 * GM-only, like every other reader of the ledger, and quiet: this corrects the
 * shape of stored data rather than the state of the game, so there is nothing a
 * GM would want a card about. The count goes to the log.
 */
export async function migrateFaintIntoSecrets() {
    if (!game.user.isGM) return 0;

    let moved = 0;
    for (const actor of game.actors ?? []) {
        for (const item of actor.items ?? []) {
            if (!isTruthBullet(item)) continue;
            const secret = secretOf(item.uuid);
            if (typeof secret.faint === "boolean") continue;

            const onItem = !!item.getFlag(MODULE_ID, TRUTH_BULLET_FLAGS.faint);
            try {
                await setSecret(item.uuid, { faint: onItem });
                if (onItem && !isIdentified(item)) {
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

    if (moved) log(`Moved Faint into the ledger for ${moved} Truth Bullet(s).`);
    return moved;
}

export async function migrateTruthBullets() {
    if (!game.user.isGM || !isPrimaryGm()) return 0;

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
                await setSecret(item.uuid, { realType: "neutral", gmNote: "" });
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
function watchBulletEdits() {
    Hooks.on("updateItem", async (item, changes, options) => {
        try {
            /*
             * THE PRIMARY GM, not "a GM" - and with two Gamemasters at this
             * table that is not pedantry. `updateItem` fires on every client,
             * so `isGM` alone had both of them writing the same patch to the
             * trace, each one pushing it back down onto every copy and each
             * one syncing the ledger to the other. One rename became two
             * cascades. Same rule the trap relay and the search tokens use.
             */
            if (!isPrimaryGm()) return;
            if (options?.[FROM_REMNANT]) return;              // the trace talking
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
                const wrap = document.createElement("div");
                wrap.innerHTML = String(item.system?.description ?? "");
                for (const block of wrap.querySelectorAll(".drpg-bullet-analysis")) block.remove();
                patch.playerText = wrap.textContent.replace(/\s+/g, " ").trim();
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
     * The cache above is dropped by `writeLedger` on every write this module
     * makes. This covers the writes it does NOT make: the regression suite
     * putting the world back, and a GM editing the store by hand from the
     * console. Same belt and braces the Remnant ledger carries, and the same
     * hook for the same reason - this setting is client-scoped, so it never
     * becomes a Setting document and `updateSetting` never fires for it. The
     * argument is the full "namespace.key" id.
     */
    Hooks.on("clientSettingChanged", key => {
        if (key === `${MODULE_ID}.${SETTINGS.truthBulletSecrets}`) forgetTruthBulletLedger();
    });

    /*
     * Every one of these is GM-to-GM, checked at BOTH ends.
     *
     * The receiving end alone was not enough. "A player's client never receives
     * them - the server filters by `recipients`" describes what this module
     * sends, not what a player's console can send, and this ledger is the answer
     * key to every Truth Bullet in the season:
     *
     *   · a forged `secret` or `full` rewrote what a bullet REALLY is on every
     *     GM's client - the trial's own answer sheet, edited by a player;
     *   · a forged `request` was answered to `payload.from`, an id the sender
     *     chose, so any player could ask the GMs for the entire ledger and be
     *     sent it.
     *
     * `senderId` is Foundry's own argument and cannot be forged. `from` survives
     * only as a GM's way of ignoring its own broadcast.
     */
    game.socket.on(SOCKET_EVENT, async (payload, senderId) => {
        if (!game.user?.isGM) return;
        if (!Object.values(TB).includes(payload?.action)) return;

        if (!game.users.get(senderId)?.isGM) {
            warn(`Refused a Truth Bullet "${payload.action}" from a non-GM (${
                game.users.get(senderId)?.name ?? senderId}).`);
            return;
        }
        if (senderId === game.user.id) return;

        switch (payload.action) {
            case TB.secret:
                if (payload.uuid) await mergeEntries({ [payload.uuid]: payload.entry });
                break;

            case TB.full:
                await mergeEntries(payload.ledger ?? {});
                break;

            case TB.request: {
                const ledger = readLedger();
                if (!Object.keys(ledger).length) return;
                try {
                    game.socket.emit(
                        SOCKET_EVENT,
                        { action: TB.full, from: game.user.id, ledger },
                        { recipients: [senderId] }
                    );
                } catch (err) {
                    error("Could not answer a Truth Bullet ledger request", err);
                }
                break;
            }
        }
    });

    if (game.user.isGM) {
        requestLedger();
        migrateTruthBullets()
            /* After, never beside: the Stage 1 migration writes a fresh secret for
               every bullet it touches, and this one reads secrets. Running them
               concurrently would race the ledger. */
            .then(() => migrateFaintIntoSecrets())
            .catch(err => error("Truth Bullet migration failed", err));
    }
}
