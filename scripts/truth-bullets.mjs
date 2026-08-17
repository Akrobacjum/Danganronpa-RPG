/**
 * Danganronpa RPG — Truth Bullets as real objects.
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
 * the whole world database on join — `World##g()` dumps ChatMessage (whispers
 * included), Setting, Actor, Item and JournalEntry with no user and no filter,
 * and compendium reads are gated only on create/update/delete. A world setting,
 * a GM-only whisper and a GM-only compendium are all equally readable from a
 * player's console. So the answer key is client-scoped on GM browsers and
 * travels between GMs on a socket the server addresses to named recipients
 * (`handleCustomSocket` honours `recipients` server-side). A player's client
 * never receives it.
 *
 * The cost of that choice is durability: browser storage, not the world file.
 * It is paid down three ways — every GM holds a full copy, a GM joining asks
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
    /** obvious | evident | subtle | hidden — the DC input for Observe/Analyze. */
    visibility: "visibility",
    /** Survives the sweep at the start of the next session. */
    faint: "faint",
    /** Is the shown type confirmed rather than a placeholder? */
    analyzed: "analyzed",
    /** Chapter this bullet was created in. */
    chapter: "chapter",
    /** Where and when it was picked up. */
    room: "room",
    day: "day",
    timeOfDay: "timeOfDay",
    /** The description written for the player. */
    playerText: "playerText",
    /**
     * Chapter in which this holder burned their analysis of this bullet.
     * Written from Stage 3 onwards; recorded here now so the flag has one
     * spelling across the whole module.
     */
    lockedChapter: "lockedChapter"
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

function readLedger() {
    if (!game.user.isGM) return {};
    try {
        return game.settings.get(MODULE_ID, SETTINGS.truthBulletSecrets) ?? {};
    } catch (err) {
        warn("Could not read the Truth Bullet ledger", err);
        return {};
    }
}

async function writeLedger(ledger) {
    if (!game.user.isGM) return;
    try {
        await game.settings.set(MODULE_ID, SETTINGS.truthBulletSecrets, ledger);
    } catch (err) {
        error("Could not write the Truth Bullet ledger", err);
    }
}

/**
 * What a bullet really is. `{}` for anyone who is not a GM — not an error, the
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
 * reaches a GM who was offline when it happened — otherwise their copy would
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
 * player's client can work this out for itself — unlike the difficulty, which
 * it cannot. See analyze.mjs.
 *
 * The chapter comparison is what gives Faint bullets their second life: a lock
 * stamped in chapter 1 stops mattering the moment chapter 2 begins, which is
 * the guide's "można je przeanalizować ponownie w trakcie Investigation".
 */
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
 * The old version's `?? 1` decided a rules question — whether an Analyze attempt
 * is still locked to the chapter it failed in — from a number this file made up,
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
 * a player's client has no way to work this out — which is the whole reason
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
 * Neither ever enters the Analyze table — which is exactly why ANALYZE_DC has
 * `key: null` and no `autopsy` column at all.
 */
const SELF_EVIDENT = ["key", "autopsy", "final"];

/**
 * Create a Truth Bullet on a character. The single path — the GM's dialog,
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
 * @param {string} [data.playerText]   Description for the player.
 * @param {string} [data.gmNote]       Note for the GM. Never leaves the ledger.
 * @param {string} [data.remnantId]    Source token id, when there is one.
 * @param {string} [data.sceneId]
 * @param {string} [data.room]         Where it was picked up. Pass this when the
 *   creating client is not the one looking at the character's scene — the room
 *   lookup below is canvas-bound, and Observe runs on the GM's client.
 * @param {boolean} [data.analyzed]    Override. `null` derives it from the type,
 *   which is what a fresh find wants; a copy passes the original's state so
 *   handing over identified evidence hands over what the giver knows.
 * @param {object} [data.stamp]        `{chapter, day, timeOfDay}` override. A
 *   copy records the discovery it documents, not the moment it was copied.
 * @returns {Promise<Item|null>}
 */
export async function createTruthBullet(actor, {
    name, realType = "neutral", shownType = null, visibility = "evident",
    faint = false, playerText = "", gmNote = "", remnantId = null, sceneId = null,
    room = null, analyzed = null, stamp = null
} = {}) {
    if (!actor || !name) return null;

    if (!game.user.isGM) {
        // Not a limitation to route around: the answer key only exists on a GM's
        // browser, so a bullet created here would be one whose truth nobody
        // recorded. Observe already goes the right way — the roll travels to the
        // GM's client and `createFind` runs there. See observe.mjs.
        warn("Only a GM can create a Truth Bullet.");
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    if (!TRUTH_BULLET_TYPES[realType]) realType = "neutral";
    if (!REMNANT_VISIBILITY.includes(visibility)) visibility = "evident";

    const selfEvident = SELF_EVIDENT.includes(realType);
    const shown = shownType ?? (selfEvident ? realType : "neutral");

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
        // so the sheet can tell "no tier" from "tier 0" — the old macro used to
        // smuggle a visibility index through this field.
        tier: null,
        description: playerText ? `<p>${foundry.utils.escapeHTML(playerText)}</p>` : "",
        extraFlags: {
            [TRUTH_BULLET_FLAGS.isBullet]: true,
            [TRUTH_BULLET_FLAGS.shownType]: shown,
            [TRUTH_BULLET_FLAGS.visibility]: visibility,
            [TRUTH_BULLET_FLAGS.faint]: !!faint,
            [TRUTH_BULLET_FLAGS.analyzed]: analyzed ?? selfEvident,
            [TRUTH_BULLET_FLAGS.chapter]: stamp?.chapter ?? clock.chapter,
            [TRUTH_BULLET_FLAGS.room]: room ?? roomOfActor(actor) ?? null,
            [TRUTH_BULLET_FLAGS.day]: stamp?.day ?? clock.day,
            [TRUTH_BULLET_FLAGS.timeOfDay]: stamp?.timeOfDay ?? clock.timeOfDay,
            [TRUTH_BULLET_FLAGS.playerText]: playerText,
            // Never inherited. A failed analysis is a fact about the person who
            // failed, not about the evidence — guide, Stage 3.
            [TRUTH_BULLET_FLAGS.lockedChapter]: null
        }
    });

    if (!item) return null;

    await setSecret(item.uuid, { realType, gmNote, remnantId, sceneId });

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
        chapter: flag(TRUTH_BULLET_FLAGS.chapter) ?? null,
        room: flag(TRUTH_BULLET_FLAGS.room) ?? null,
        day: flag(TRUTH_BULLET_FLAGS.day) ?? null,
        timeOfDay: flag(TRUTH_BULLET_FLAGS.timeOfDay) ?? null,
        playerText: flag(TRUTH_BULLET_FLAGS.playerText) ?? "",
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
        remnantId: game.user.isGM ? (secret.remnantId ?? null) : undefined,
        sceneId: game.user.isGM ? (secret.sceneId ?? null) : undefined
    };
}

/**
 * The Autopsy bullet — decision D2: issued by hand from the GM panel, never
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
            // Autopsy findings are handed over openly — there is nothing to spot.
            visibility: "obvious",
            playerText,
            gmNote
        });
        if (!item) continue;
        issued++;
        await whisperToOwner(actor, `
            <h3>${game.i18n.localize("DRPG.TruthBullet.received")}</h3>
            <p><strong>${foundry.utils.escapeHTML(name)}</strong> — ${
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
 * a bullet had nowhere else to put it — so an "Evident" bullet reads as Tier 1.
 * That mapping is recoverable exactly, which is why it is used rather than
 * guessed at.
 *
 * What cannot be recovered is what each bullet really was. The module does not
 * invent an answer: everything lands as `neutral` and the GMs get a list to
 * correct by hand.
 * ========================================================================== */

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
            `<li>${foundry.utils.escapeHTML(m.actor)} — <strong>${
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

export function registerTruthBullets() {
    /*
     * Every one of these is GM-to-GM, checked at BOTH ends.
     *
     * The receiving end alone was not enough. "A player's client never receives
     * them — the server filters by `recipients`" describes what this module
     * sends, not what a player's console can send, and this ledger is the answer
     * key to every Truth Bullet in the season:
     *
     *   · a forged `secret` or `full` rewrote what a bullet REALLY is on every
     *     GM's client — the trial's own answer sheet, edited by a player;
     *   · a forged `request` was answered to `payload.from`, an id the sender
     *     chose, so any player could ask the GMs for the entire ledger and be
     *     sent it.
     *
     * `senderId` is Foundry's own argument and cannot be forged. `from` survives
     * only as a GM's way of ignoring its own broadcast.
     */
    game.socket.on(SOCKET_EVENT, async (payload, senderId) => {
        if (!game.user.isGM) return;
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
        migrateTruthBullets().catch(err => error("Truth Bullet migration failed", err));
    }
}
