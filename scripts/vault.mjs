/**
 * Danganronpa RPG - the stash.
 * ---------------------------------------------------------------------------
 * A character carries three usable items and two pieces of gear - a weapon, a
 * cleaning tool or a tool, in any mix, one of them in a hand - and not one
 * thing more. The stash is where the rest of what they own lives: their own
 * bedroom, three things to a stash (`VAULT_LIMIT`), and - this being a killing game - searchable by anybody
 * who walks in while they are elsewhere.
 *
 * Two flags carry the whole thing:
 *
 *   on the ROOM    `drpgVaultOwner`     whose bedroom this is
 *                  `drpgVaultConcealed` they have built a hiding place in it
 *   on the ITEM    `location`           carried, or stashed
 *
 * The item flag is the important design choice. A stashed item is still an
 * ordinary item on its owner's sheet, not a document living somewhere else -
 * so everything that sweeps a character's belongings reaches it without having
 * to know stashes exist. That is also why `killCharacter` has never needed a
 * line about stashes: back when death took the whole inventory it took the
 * stash with it, and now that it takes only the Truth Bullets it takes the
 * stashed ones alongside the carried ones. Everything else stays where it was
 * put, to be found on the body.
 */

import { MODULE_ID, ITEM_CATEGORIES, BEDROOM_KEY_FLAG, ACTIONS, VAULT_LIMIT, ROOMS_PER_PLAYER, LIMIT_GROUPS }
    from "./config.mjs";
import { ITEM_FLAGS, LOCATIONS, isStashed, canCarry, pickableCategories, capacityLabel, readyForShape } from "./inventory.mjs";
import { trustedWrite, trustedDelete } from "./resource-guard.mjs";
// Static because `keysHeldBy` is synchronous; sheet-audit.mjs reaches nothing that imports this file (R161).
import { itemsHeldNow, judgedFor, flagsAsHeld, flagsHeldNow } from "./sheet-audit.mjs";
// The one room lookup. movement.mjs does not reach back into this file.
// The key rule both this file and the door read (E14 part 1 C2; bedroom-keys.mjs's header).
import { keyRooms, bedroomShutTo } from "./bedroom-keys.mjs";
import { locateActor, sceneOfActor, neighbouringRooms, ROOM_FLAGS, roomBroken } from "./movement.mjs";
// Static because the reader is synchronous. From settings.mjs, which is a leaf
// - this is one client-scoped boolean, and the note above the function there
// explains why it stopped living in mastermind.mjs.
import { iAmTheMastermind, SETTINGS, isDeceased, isDeadForGm, getClock } from "./settings.mjs";
import { SEARCH_FLAGS } from "./search-tokens.mjs";
import { SearchTokens } from "./search-tokens.mjs";
// Static is safe: tables.mjs only reaches back into this file lazily.
import { roomStockTables } from "./tables.mjs";
import { dialogContent, tableDialog, whisperToOwner, whisperToGms, announce, log, error, plural, serialWrite,
    workingScene, pinFooterAcrossScroll, wireDashboardTabs, esc, isPrimaryGm, forcedDeletion, wirePortraitPickers, forgeAsset } from "./utils.mjs";
import { alreadyOpen, keepFresh } from "./live.mjs";
// A leaf (it imports config.mjs alone): what a room is, and the writer of its flag.
import { ROOM_FLAG, canBeRoom, namedRegions, playerRegionIds, roomDecided, setRoomFlag, roomPieces, roomFlag, roomNames, placeScenes,
    roomRegions, flagOver, listOver, piecesByName, writablePieces, isRoom, joinsAnotherRoom, RENAMED_FROM, isTrialScene, homeScene, sceneHoldsRooms } from "./rooms.mjs";
// Statically since E12 fix r1-G1 (11.10.2026), for `clearSplitPiece`'s list of a room's flags: rest.mjs read
// its rooms through `regionsByName` here until then, which made the import a cycle; it reads rooms.mjs now.
import { REST_FLAGS } from "./rest.mjs";

const DialogV2 = foundry.applications.api.DialogV2;

/**
 * Region flags. Prefixed like the other room flags a GM might read by hand.
 *
 * `table` and `favours` are not about stashes at all - they are what makes a
 * room a *place* rather than a name: what turns up when you search it, and what
 * it is a good place to search FOR. They live here because they are set on the
 * same screen, from the same region documents, as the rest of it.
 */
export const VAULT_FLAGS = {
    /**
     * WHOSE BEDROOM THIS IS, and nothing else any more.
     *
     * Until E11 this one flag did four jobs at once: whose room it is, where
     * their stash is, whose door is shut and who gets the key. Three of those
     * are the same fact and one of them is not - a stash is a piece of
     * furniture, and there is no reason the only place you may own one is the
     * room with your name on the door.
     *
     * So this keeps the bedroom half - the locked door in `mayEnterBedroom` and
     * the key `grantBedroomKey` issues - and hands the stash half to `stashes`
     * below. Deliberately NOT widened: a stash in somebody else's room must not
     * generate a key, or "let me hide this at your place" would buy free entry
     * to their bedroom for ever after.
     */
    owner: "drpgVaultOwner",
    /**
     * EVERY STASH IN THIS ROOM: `[{ actorId, concealed }]`.
     *
     * The bedroom owner's own stash is an ordinary member of this list - there
     * is no such thing as an "extra" stash, which is what makes the model worth
     * having. A room can hold several, none, or one belonging to somebody who
     * cannot even open the door without borrowing a key.
     *
     * ABSENT IS NOT EMPTY. A region that has never been touched since E11 falls
     * back to "the bedroom owner has an open stash here", reconstructed at read
     * time from `owner` and `concealed` - see `stashesIn`. That is the whole
     * migration: no pass to run, no world to convert, and a GM who never opens
     * the new tab sees a module that behaves exactly as it did.
     */
    stashes: "drpgStashes",
    /**
     * LEGACY, and read only through `stashesIn`'s fallback.
     *
     * Whether the bedroom owner's stash was hidden, back when a room had one
     * stash and the room was the stash. `setStash` writes `stashes` instead, so
     * this stops changing the moment a GM edits anything on the new tab - and
     * goes on being the honest answer for every region they never touch.
     */
    concealed: "drpgVaultConcealed",
    /** Name of a RollTable this room draws from, instead of the global pool. */
    table: "drpgItemTable",
    /** Item categories this room is a sensible place to look for. */
    favours: "drpgFavours",
    /** Item categories this room is a POOR place to look for - the mirror of
        `favours`: disadvantage instead of advantage on a Search aimed at one.
        A category is never on both lists; Room Setup keeps them exclusive. */
    hinders: "drpgHinders",
    /**
     * What this room looks like, in the GM's own words.
     *
     * Written in Room Setup, read by anyone standing in it - see the state
     * window in `explain.mjs`. Plain text rather than HTML: it is typed into a
     * textarea by a GM mid-session, it is shown to players, and a description
     * box that renders markup is a description box somebody can put a script
     * tag in. Escaped at every point of display.
     */
    description: "drpgRoomDescription",
    /**
     * The room's picture, as a path of this server's files (E77 C1, the owner's A8 of 11.10.2026).
     *
     * Written beside the description, by the same writer and on the same pieces, and as public as
     * it: every browser holds a region's flags, as it holds the map (the owner's answer Q12 of
     * 11.10). A path, never markup, and a path is only ever one `safeRoomImage` accepts - at the
     * write in `setVaultRoom` and again at every read in `roomImage`, because whether a player can
     * write a region's flags by another road in v14 is not measured (LIVE-E12-04).
     */
    image: "drpgRoomImage",
    /**
     * ON A CHARACTER, not on a region - the only entry here that is.
     *
     * Which hiding places this person has FOUND, as `scene::room::ownerId`
     * strings. Written by a GM's client when a Locate roll beats its number
     * (`resolveStashSearch`), read by `openStashesHere` and by the theft
     * authority in `stealFromVault`.
     *
     * It lives on the finder because the alternative lives on the room, and the
     * room is the screen its owner opens to check their own things. Neither is
     * hidden from a console - this module has no secrets from a determined
     * player - but only one of them is somewhere the victim looks by accident.
     */
    found: "drpgStashesFound",
    /**
     * This region is not a room the cast can be alone in (Dawid, 02.09.2026).
     *
     * G-36 asks for about one and a half rooms per player "corridors and
     * dormitories aside", and until now nothing could say which regions were
     * the corridors. Both places that print the ratio counted every region they
     * could see, so a map with six corridors read as six rooms better supplied
     * than it is - and the number exists precisely to answer "can two private
     * conversations happen at once", which a corridor cannot host.
     *
     * ABSENT MEANS IT COUNTS, so every existing world reads exactly as it did
     * and a GM opts individual regions out. Bedrooms are excluded without this
     * flag, by having an owner: a bedroom belongs to one person whether or not
     * anybody else can get in.
     *
     * It changes NO rule. Movement, Search, rests, fog and voice all treat an
     * excluded region as the room it is; the only thing that reads this is the
     * advice printed on two screens.
     */
    notShared: "drpgNotShared"
};

/* ==========================================================================
 * BEDROOM KEYS
 * --------------------------------------------------------------------------
 * The guide gives every student a room of their own, and a room of your own is
 * only worth having if the door means something. So a bedroom is shut to
 * everybody except the person it belongs to - and the way in for anybody else
 * is a KEY, which is an ordinary item on a character sheet.
 *
 * An item rather than a permission list, deliberately. A key can be copied and
 * handed over exactly like a Truth Bullet, so "let me into your room" is a
 * thing two players do between themselves, at the table, with an object that
 * shows up in the inventory of whoever is holding it. A permission list would
 * have been the GM's to edit and invisible to everyone else.
 *
 * The key names its room in a flag rather than in its name, so that what it
 * opens is read off one place. The flag is still a NAME: until 1.2.74 a GM who
 * renamed the room left every key naming the old one, and the door stayed shut
 * to all of them (audit S08-18; this note said the flag guarded against it,
 * which it never did). A GM's rename now carries the keys with it, on the
 * primary - `carryRoomOnSheets` below, reached from fog.mjs's region listener.
 * ========================================================================== */

/** The flag that makes an item a key, holding the room it opens. Declared in
    config.mjs, because movement.mjs reads the same flag and cannot import this
    file - see the note there. */
export const KEY_FLAG = BEDROOM_KEY_FLAG;

/** Is this item a key, and to what? */
export function keyRoomOf(item) {
    return item?.getFlag?.(MODULE_ID, KEY_FLAG) ?? null;
}

/**
 * Every key this character is carrying, as room names.
 *
 * ON A GM, AS THE GMS HOLD THE ITEMS (E11 C10, 10.10.2026; the plan's 1b.2). `grantBedroomKey` asks
 * this before it makes a key, and since C10 the season reset asks it for every student straight
 * after their items went. It read the document: a key's room written by a player's browser on an
 * item of their own, which the GMs' mark does not hold, read as a key already held, so the real one
 * was not made. On a GM it reads `itemsHeldNow`: the key's room as the mark holds it on the primary,
 * the document's everywhere the GMs keep no mark (a GM who is not the primary, a character never
 * marked). An item the mark does not hold yet reads with no room (sheet-audit.mjs `ITEM_UNHELD`),
 * so `grantBedroomKey` waits for the student's queued judgements first. A key deleted on the sheet is not on this list in either read: `itemsHeldNow`
 * walks the document's items. A player's browser reads its own document, as it did.
 *
 * IN HAND (E14 part 1 C2, 24.10.2026; audit S08-31): a key put away in a stash is not on this list - it opens no door,
 * here as at the door (bedroom-keys.mjs `keyRooms`, the one rule). Its place is read as the key's room is, held on the
 * GM (`ITEM_PLACE` is judged: sheet-audit.mjs `placeStands`). `stashed: true` lists the stash's keys too, for the
 * questions that are not the door's: `grantBedroomKey`'s "already holds one" and the GMs' list of keys to give, so a
 * student who put their key away is not handed a second one by the next sweep.
 */
export function keysHeldBy(actor, { stashed = false } = {}) {
    return keyRooms(game.user?.isGM ? itemsHeldNow(actor) : actor?.items ?? [], { stashed });
}

/**
 * May this character open this room's door?
 *
 * The door's own rule (bedroom-keys.mjs `bedroomShutTo`, which movement.mjs `bedroomShut` asks; E14 part 1 C2): a room
 * nobody owns is no bedroom, the owner needs no key, a key in hand opens it and a stashed one does not, and in the
 * Investigation a dead owner's room opens once the death is published (D15).
 */
export function mayEnterBedroom(actor, room, scene = null) {
    if (!actor || !room) return true;
    // A bedroom a breach forced (movement.mjs `roomBroken`, E15 part 2 C4) opens to everyone: on the scene named, else
    // wherever the room is drawn, as its owner is read below.
    if (scene ? roomBroken(scene, room) : (game.scenes?.contents ?? [...(game.scenes ?? [])]).some(s => roomBroken(s, room))) return true;
    // The scene the caller names, else the room wherever it is drawn (E12 C2a): a key is
    // a room's name, and the camera's scene answered "nobody's" for a bedroom one map over.
    const owner = scene ? vaultOwnerOf(room, scene) : bedroomOwnerAnywhere(room);
    return !bedroomShutTo({ actorId: actor.id, room, ownerId: owner, keys: keysHeldBy(actor),
        phase: getClock().phase, ownerDead: Boolean(owner) && isDeceased(game.actors.get(owner)) });
}

/**
 * Put a key to `room` on a character's sheet, unless they already hold one.
 *
 * Idempotent on purpose: Room Setup saves the whole table every time, so this
 * runs on rooms whose owner has not changed at all.
 */
export async function grantBedroomKey(actor, room, { silent = false, scene, tidy = false } = {}) {
    if (!game.user.isGM || !actor || !room) return null;
    /* ONE GRANT AT A TIME PER STUDENT (H84, 27.10.2026; the owner's session on 1.2.85, triage A1 (b)). The read below
       and the create were two steps with an await between them, and nothing queued them: the primary's ready sweep is
       started and not awaited, and Room Setup's Apply, a GM's Give and a key's handover can each land inside it, so two
       grants both read "holds none" and both made a key (tier 2 "H84-01: one key per room ...": two grants at once made
       2 at 774b28a9, 1 here). The whole grant is one step of `serialWrite` under the student's key; the step awaits
       the audit's queue, the item's create and a whisper, none of which waits for a grant (read in the code,
       27.10.2026). Two GMs granting at once on two browsers are not queued by this (the queue is per browser): the
       ready sweep runs on the primary alone, the other roads are a GM's click. */
    return serialWrite(bedroomKeyKey(actor.id), () => grantKeyNow(actor, room, { silent, scene, tidy }));
}

/** The queue key of a student's key grants (`grantBedroomKey`). */
export const bedroomKeyKey = actorId => `bedroomKey/${actorId}`;

/** `grantBedroomKey`'s step, inside its queue. */
async function grantKeyNow(actor, room, { silent, scene, tidy = false }) {
    /* Every write queued on the student judged first (E11 C10), so a key this GM made a moment ago
       is in the mark and reads as held. Measured on the harness on 10.10.2026: with nothing else
       queued on the student the key was in the mark by a second grant made at once without this
       wait (tier 2 "each cast group of the reset ...", with the wait taken out, still green). The
       wait is for a queue that holds a player's write before it - the audit judges a student's
       writes one after another (sheet-audit.mjs `inOrder`); read in the code, not measured. A key
       a player's browser deleted is not put back by the audit - it is flagged, and an Undo makes
       it again (read in the code, sheet-audit.mjs `itemFindings`, 10.10.2026) - so it reads as
       gone and is made again. Nothing the audit judges waits for this (H17): it is reached from
       Room Setup, the ready sweep, the reset, the GMs' item manager and a key's handover (read in
       the code, 10.10.2026). */
    await judgedFor(actor.id);
    // Named on the key, so it reads as "Kaede's room" rather than "Room 3".
    // The scene is passed in by the sweep, which walks rooms on scenes nobody
    // is currently looking at - the default lookup would find no owner there
    // and write a dash into the description of a perfectly good key.
    // The scene the caller named, else wherever the room is drawn: a key shared
    // while the GM looks at another scene used to read "Owner: -" (ITEM-16).
    const owner = game.actors.get((scene ? vaultOwnerOf(room, scene) : null)
        ?? bedroomOwnerAnywhere(room) ?? "");
    // The sweep's (`tidy`): the owner's extra keys to their own bedroom go first, in this same step (H84 fix G2).
    if (tidy && owner?.id === actor.id) await tidyRoomKeys(actor, room);
    // A key in the student's stash is still theirs (E14 part 1 C2): the sweep makes no second one beside it.
    if (keysHeldBy(actor, { stashed: true }).has(room)) return null;

    const { grantItem } = await import("./inventory.mjs");
    const repointed = owner?.id === actor.id ? await repointDeadKey(actor, room) : null;
    if (repointed) return repointed;
    const item = await grantItem(actor, {
        reason: "gmRuling",
        name: game.i18n.format("DRPG.Vault.keyName", { room }),
        category: "bedroomKey",
        tier: null,
        description: `<p>${game.i18n.format("DRPG.Vault.keyDescription", {
            room: foundry.utils.escapeHTML(room),
            owner: foundry.utils.escapeHTML(owner?.name ?? "-")
        })}</p>`,
        // NO PICTURE NAMED HERE. `grantItem` falls back to the category's own
        // icon, and the category has had one since v1.1.60 - this line was
        // Foundry's padlock, hard-coded, which is why keys were the one thing
        // in the game still wearing core art (Dawid, 28.08).
        extraFlags: { [KEY_FLAG]: room }
    });

    if (item && !silent) {
        await whisperToOwner(actor, `<p>${game.i18n.format("DRPG.Vault.keyGranted",
            { room: foundry.utils.escapeHTML(room) })}</p>`);
    }
    return item;
}

/**
 * THE OWNER'S KEY A RENAME LEFT DEAD IS THE ROOM'S KEY (H84, 27.10.2026; triage A1 (a)). A key is a room's name, and a
 * rename carries the keys only where fog.mjs `noteRegionName` carries it - on the primary, for the room's last piece of
 * that name, from a name that GM saw, and where no other scene holds a bedroom of the old name (`carryRoomOnSheets`). In
 * every other case the owner's key named a room that is no bedroom anywhere, and the next sweep made a key of the new
 * name beside it: two rows under Room Keys, one of them opening nothing. Here, for the owner of `room` who holds no key
 * to it, such a dead key is written to name `room` instead (`trustedWrite`, "setup", as the carry writes it; its name and
 * description too while they are still `grantBedroomKey`'s), so no second key is made. Only when it cannot be another
 * room's: exactly one dead key among the owner's (carried or stashed, read as the GMs hold them), and `room` the one
 * bedroom of theirs they hold no key to. Otherwise the key is made as before and the dead one stays for a GM.
 *
 * ONLY A KEY THAT WAS THEIR OWN (H84 fix G2, 27.10.2026; the end review's H84R-03, H84R-3). A dead key is any key to a
 * room no bedroom bears, and 477bd5b2 counted a copy among them: a key another student shared (handover.mjs `shareKey`)
 * whose room's owner the GM then cleared, or one stolen from a student whose room a rename the carry missed left dead,
 * was rewritten into the owner's key to their own bedroom - named for it, still described as the other student's, and
 * the copy the GM was told of gone. Only a key `grantBedroomKey` made for this student as the room's owner is counted:
 * its description is the grant's, naming its room and this student as owner (`text` below), as the GMs hold it. A copy
 * names its own owner, so it stays where it is and a key is made (tier 2 "H84-01 ...": the shared copy repointed at
 * 68aa984e, a new key beside it here). A key
 * opens nothing for its owner at their own door (bedroom-keys.mjs `bedroomShutTo`), so this changes no door. Answers the
 * key, or null.
 */
async function repointDeadKey(actor, room) {
    const held = itemsHeldNow(actor);
    const text = name => `<p>${game.i18n.format("DRPG.Vault.keyDescription", {
        room: foundry.utils.escapeHTML(name), owner: foundry.utils.escapeHTML(actor.name ?? "-") })}</p>`;
    const ownGrant = item => (item.system?.description ?? actor.items.get(item.id)?.system?.description) === text(keyRoomOf(item));
    const dead = held.filter(item => keyRoomOf(item) && !bedroomOwnerAnywhere(keyRoomOf(item)) && ownGrant(item));
    if (dead.length !== 1) return null;
    const keyed = keyRooms(held, { stashed: true });
    const lacking = new Set();
    for (const scene of game.scenes ?? []) {
        for (const region of scene.regions ?? []) {
            if (region.name && region.getFlag(MODULE_ID, VAULT_FLAGS.owner) === actor.id && !keyed.has(region.name)) lacking.add(region.name);
        }
    }
    if (lacking.size !== 1 || !lacking.has(room)) return null;
    const key = actor.items.get(dead[0].id);
    if (!key) return null;
    const was = keyRoomOf(dead[0]);
    const changes = { [`flags.${MODULE_ID}.${KEY_FLAG}`]: room };
    if (key.name === game.i18n.format("DRPG.Vault.keyName", { room: was })) changes.name = game.i18n.format("DRPG.Vault.keyName", { room });
    if (key.system?.description === text(was)) changes["system.description"] = text(room);
    try {
        await trustedWrite(key, changes, { reason: "setup" });
    } catch (err) {
        error(`Could not point ${actor.name}'s key to ${was} at ${room}`, err);
        return null;
    }
    log(`${actor.name}'s key named "${was}", which is no bedroom any more; it opens "${room}" now, and no second key was made.`);
    return keyRoomOf(actor.items.get(key.id)) === room ? key : null;
}

/**
 * THE SWEEP KEEPS ONE KEY OF THE OWNER'S TO THEIR OWN BEDROOM (H84 fix G2, 27.10.2026; the end review's H84R-02, H84R-2;
 * NOTES H84-01 "sweep deduplicates by room"). 477bd5b2 stopped a third key, and two already on a sheet stayed: the 1.2.85
 * races left them in the owner's world, and two GMs granting on two browsers at once can still make a pair
 * (LIVE-H84-01 (a)). For the owner of `room`, inside their `bedroomKeyKey` step after `judgedFor`, every key of theirs
 * to that room but one is taken by a GM's ruling (`trustedDelete`, "gmRuling", as `takeOldOwnersKeys` takes a key):
 * the one kept is a carried key before a stashed one, then the oldest (`_stats.createdTime`), then the lower id. Read
 * as the GMs hold the student (`itemsHeldNow`). A copy of another student's key to another room is never touched. The
 * GM is told on screen and in the log. Answers how many were taken.
 */
async function tidyRoomKeys(actor, room) {
    const keys = itemsHeldNow(actor).filter(item => keyRoomOf(item) === room)
        .map(item => ({ item, doc: actor.items.get(item.id) })).filter(({ doc }) => doc);
    if (keys.length < 2) return 0;
    keys.sort((a, b) => (Number(isStashed(a.item)) - Number(isStashed(b.item)))
        || ((a.doc._stats?.createdTime ?? 0) - (b.doc._stats?.createdTime ?? 0)) || a.doc.id.localeCompare(b.doc.id));
    let taken = 0;
    for (const { doc } of keys.slice(1)) {
        try {
            await trustedDelete(doc, { reason: "gmRuling" });
            taken++;
        } catch (err) {
            error(`Could not take ${actor.name}'s extra key to ${room}`, err);
        }
    }
    if (taken) {
        log(`${actor.name} held ${keys.length} keys to their own bedroom "${room}"; one is kept (${keys[0].doc.id}) and ${taken} taken.`);
        ui.notifications?.info(game.i18n.format("DRPG.Vault.keyDuplicatesTaken", { actor: actor.name, room }));
    }
    return taken;
}

/**
 * Make the world true: every bedroom's owner holds the key to it.
 *
 * WHY A SWEEP AND NOT AN EVENT. The first version issued the key from the one
 * place a room changes hands - the owner column in Room Setup - and that is
 * exactly the room that had none. The save loop skips a row whose flags did not
 * change, so every bedroom assigned BEFORE keys existed was, by definition, a
 * row nothing had changed about; the key was never issued for any of them, and
 * re-saving the screen could not fix it because there was nothing left to
 * change. An event fires once and cannot be replayed. A sweep is a statement
 * about how the world should look, and it can be run again.
 *
 * Every scene, not the viewed one: a GM setting the dorms up from the trial
 * hall is an ordinary thing to do, and rooms on a scene nobody is looking at
 * are still somebody's bedroom.
 *
 * Writes nothing when there is nothing missing, so running it on every load
 * costs one pass over the regions.
 *
 * @returns {Promise<number>} how many keys had to be made.
 */
export async function reconcileBedroomKeys({ silent = true, owners = null } = {}) {
    if (!game.user.isGM) return 0;

    let made = 0;
    for (const scene of game.scenes ?? []) {
        for (const region of scene.regions ?? []) {
            if (!region.name) continue;
            const ownerId = region.getFlag(MODULE_ID, VAULT_FLAGS.owner);
            if (!ownerId) continue;
            // `owners`: the season reset's `items` group hands out again only the keys it took (E11 C10).
            if (owners && !owners.includes(ownerId)) continue;
            const owner = game.actors.get(ownerId);
            if (!owner) continue;
            // `tidy`: the owner's extra keys to this room are taken first (`tidyRoomKeys`, H84 fix G2).
            if (await grantBedroomKey(owner, region.name, { silent, scene, tidy: true })) made++;
        }
    }

    if (made) log(`Issued ${made} missing bedroom key(s).`);
    return made;
}

/**
 * THE OLD OWNER'S KEYS GO WITH THE ROOM (E14 part 1 C2, 24.10.2026; audit S08-11). Room Setup and the sweep above only
 * ever added keys: a GM who moved Kaede from Room 3 to Room 5 and gave Room 3 to Shuichi left Kaede the key to Room 3,
 * and she walked into Shuichi's bedroom; nothing told the GM, who had to find the key by hand. `applyRoomRows` hands
 * this every room whose owner changed in the Apply, with the owner before: each key of theirs to that room - carried or
 * stashed, since a stashed one would open again once taken out - is taken by a GM's ruling (`trustedDelete`,
 * "gmRuling"), the GM told who lost which key and the old owner that it was taken back. Read as the GMs hold the
 * student (`itemsHeldNow` after `judgedFor`), so an item a player's browser wrote a key's room on is not deleted for it.
 * Kept where the old owner still owns a room of that name on another scene: a key is a room's name, and the sweep
 * would only hand it back. Keys the old owner shared with others stay theirs (`keyCopiesAfterOwnerLeft`, below).
 *
 * ON EVERY ROAD THAT GIVES A ROOM AWAY (E14 fix e1-G2, 24.10.2026; the review's E14R-2). C2 called this from Room
 * Setup's Apply alone, so `game.drpg.setVaultRoom(room, { owner })`, the console road the GM handbook names, left the
 * old owner a key that opened the new owner's door. `setVaultRoom` calls it now, and Room Setup writes its rows through
 * `setVaultRoom`. Tier 2 "a bedroom given away from the console takes the old owner's keys ...".
 *
 * @param {{ room: string, from: string, to?: string|null }[]} left  `to`: the new owner, or none
 * @returns {Promise<number>} how many keys were taken.
 */
export async function takeOldOwnersKeys(left) {
    if (!game.user.isGM) return 0;
    let taken = 0;
    for (const { room, from, to = null } of left ?? []) {
        const old = game.actors.get(from ?? "");
        if (!old || !room || ownsBedroomNamed(old.id, room)) continue;
        await judgedFor(old.id);
        let gone = 0;
        for (const held of itemsHeldNow(old).filter(item => keyRoomOf(item) === room)) {
            const item = old.items.get(held.id);
            if (!item) continue;
            try {
                await trustedDelete(item, { reason: "gmRuling" });
                gone++;
            } catch (err) {
                error(`Could not take ${old.name}'s key to ${room}`, err);
            }
        }
        if (gone) {
            taken += gone;
            ui.notifications.info(game.i18n.format("DRPG.Vault.keyTakenGm", { actor: old.name, room }));
            await whisperToOwner(old, `<p>${game.i18n.format("DRPG.Vault.keyTakenBack", { room: esc(room) })}</p>`);
        }
        await keyCopiesAfterOwnerLeft(room, old, game.actors.get(to ?? "") ?? null);
    }
    if (taken) log(`Took ${taken} bedroom key(s) from owners whose room was given away.`);
    return taken;
}

/**
 * THE COPIES OF THE OLD OWNER'S KEY (E14 fix e1-G2, 24.10.2026; the review's E14R-1, E14R-09, E14R-08). A copy the old
 * owner gave somebody stays with its holder - whether the copies should go with the room too is the owner's to rule
 * (STATUS Open) - and a key is a room's name, so it opens the new owner's door. Two things were wrong with that whatever
 * the ruling: nothing told the GM those keys exist, and each still read "which belongs to" the old owner. So each
 * character but the new owner who holds a key to the room, carried or stashed, as the GMs hold it (`itemsHeldNow` after
 * `judgedFor`), is named to the GM, and every key to the room whose text is the module's own for the old owner
 * (`grantBedroomKey`'s, in this GM's language) is rewritten for the new one by a GM's ruling. A text a GM wrote, or one
 * written in another language, is left as it is. Answers the holders named.
 */
async function keyCopiesAfterOwnerLeft(room, old, owner) {
    const text = name => `<p>${game.i18n.format("DRPG.Vault.keyDescription", {
        room: foundry.utils.escapeHTML(room), owner: foundry.utils.escapeHTML(name ?? "-") })}</p>`;
    const before = text(old.name), after = text(owner?.name);
    const holders = [];
    for (const actor of game.actors ?? []) {
        if (actor.id === old.id || !actor.items?.some(i => i.getFlag(MODULE_ID, BEDROOM_KEY_FLAG) === room)) continue;
        await judgedFor(actor.id);
        const keys = itemsHeldNow(actor).filter(item => keyRoomOf(item) === room).map(held => actor.items.get(held.id)).filter(Boolean);
        if (!keys.length) continue;
        if (actor.id !== owner?.id) holders.push(actor.name);
        if (before === after) continue;
        for (const key of keys.filter(key => key.system?.description === before)) {
            try {
                await trustedWrite(key, { "system.description": after }, { reason: "gmRuling" });
            } catch (err) {
                error(`Could not rewrite ${actor.name}'s key to ${room}`, err);
            }
        }
    }
    if (holders.length) ui.notifications.info(game.i18n.format("DRPG.Vault.keyCopiesGm", { room, holders: holders.join(", ") }));
    return holders;
}

/** Does this character own a bedroom of this name on any scene? */
function ownsBedroomNamed(actorId, room) {
    return Array.from(game.scenes ?? []).some(scene => Array.from(scene.regions ?? [])
        .some(region => region.name === room && region.getFlag(MODULE_ID, VAULT_FLAGS.owner) === actorId));
}

/** The RollTable this room draws from, or `null` for the global pool. */
export function roomTable(room, scene) {
    return roomFlag(scene, room, VAULT_FLAGS.table) || null;
}

/**
 * What the GM wrote about this room, or "" if they wrote nothing.
 *
 * Read by every client, not just the GM's - a room description is one of the
 * few pieces of the GM's own prose this game means for the table to see.
 */
export function roomDescription(room, scene) {
    return roomFlag(scene, room, VAULT_FLAGS.description) ?? "";
}

/* The picture formats a room may show, by the path's extension and nothing else: no file is opened to read
   what it holds. No gif and no apng, because `prefers-reduced-motion` does not stop an animation in an
   `<img>` or a CSS `url()` (the A8 design's step 9, 11.10.2026) - but an animated PNG, WebP or AVIF saved
   under a still name is not detected and moves on every screen that shows the room (E77 round 1, sec F2;
   telling one by decoding it is E20/E46's picture-checks row, decision D5). No svg (E77 fix r1-G1,
   13.10.2026): the decision was to keep it only if this module drew a picture as an `<img>` alone, and it
   draws it three ways - Room Setup's thumbnail `<img>` (`roomCells`), the tile's CSS `background-image`
   and its probe `Image` (room-tile.mjs `paintRoomTile`, `openRoomImage`) - and hands it to Foundry's
   ImagePopout, whose markup is not in this repository and was not read. */
const ROOM_IMAGE_TYPES = new Set(["jpg", "jpeg", "png", "webp", "avif"]);

/**
 * A room picture's path if it is a picture of this server, else `null` (E77 C1; pure, every client).
 *
 * The picture is a URL somebody else wrote that every player's browser fetches, so it may only be a file
 * this server serves: a relative path (Foundry's own, `worlds/<id>/rooms/hall.webp`, with a route prefix or
 * not) or an absolute URL of this origin. Refused: any other scheme (`javascript:`, `data:`, `blob:`,
 * `file:`), another host (`//host/x.png`, `https://host/x.png`), a query or a fragment (`/route?x.png`),
 * a `..` segment (plain or `%2e`), a backslash, a quote, a bracket or a control character (the path ends
 * up inside a CSS `url("...")` on the tile), a slash or a backslash written as `%2f` or `%5c`, and an
 * extension not in ROOM_IMAGE_TYPES. Answers the relative path as written, or an absolute one's pathname,
 * trimmed - and only when that answer, read again against this page, is the same URL: the answer is final,
 * so `safeRoomImage(safeRoomImage(x)) === safeRoomImage(x)` over every row R505 reads (its KEPT, REFUSED
 * and EMPTY tables - not over every string, which nothing here measures) and a reader may hand it to a
 * fetch as it is. A path it cannot read is refused as `null`, not thrown (R505 reads that no row of its
 * tables throws; E77 fix r2-H1).
 *
 * What it does not settle: what the server answers to the path - a redirect to elsewhere is no reading of
 * the string (LIVE-E77-03) - and S3 sources, which are another host and refused (the Description tab's note
 * names what can be picked: this game's files, or on The Forge the Assets Library).
 *
 * THE FORGE (E78 fix h76-HF1, 14.10.2026; the owner's report on 1.2.76: every picture refused there, whatever
 * its format). While the game runs on The Forge one more origin passes, its Assets Library's (utils.mjs
 * `forgeAsset`, `https:` only), under every other refusal above; such a URL is answered as its full address,
 * origin and path, since its path alone would read as this page's. Off The Forge it is refused as before.
 * Since E78 C3 this also judges paths a player writes - the voice tile's portraits, a character's `img` its
 * owner sets and the account's avatar (voice-tile.mjs `voicePortrait`) - so on The Forge a player's portrait
 * may be any file of that host, which every browser of their voice room then fetches.
 */
export function safeRoomImage(path) {
    if (typeof path !== "string") return null;
    const text = path.trim();
    if (!text || /[\u0000-\u001f\u007f"'()<>\\?#]/.test(text)) return null;
    if (/(?:^|\/)(?:\.|%2e){2}(?:\/|$)/i.test(text) || /%(?:2f|5c)/i.test(text)) return null;
    let url;
    try {
        url = new URL(text, document.baseURI);
    } catch {
        return null;
    }
    // The protocol as well as the origin: a `blob:` URL's origin is the page's that made it. The page's
    // origin is the one `document.baseURI` resolves to, as notice-history.mjs's `imageAllowed` reads it:
    // the headless harness's clients have a `document` and no global `location` (measured 13.10, every
    // path was refused while this read `globalThis.location`).
    const here = url.origin === new URL(document.baseURI).origin;
    if (!/^https?:$/.test(url.protocol) || !(here || forgeAsset(url)) || url.search || url.hash) return null;
    const type = url.pathname.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
    if (!ROOM_IMAGE_TYPES.has(type)) return null;
    /* THE ANSWER IS READ AGAIN (E77 fix r1-G1, round 1's sec F1). An absolute URL of this origin whose path
       starts with an empty segment - `<origin>//host/x.png`, `<origin>/.//host/x.png`, `https:.//host/x.png`
       - passed every check above and answered its pathname, `//host/x.png`, which a browser reads as another
       host (measured 13.10.2026 in Node: once `//other.example/x.png`, twice null). Room Setup's thumbnail
       judged it once and drew it. The answer is kept only when it resolves to the very URL judged; `%2f` and
       `%5c` are refused above because a server that decodes them before it routes would read the same
       empty segment (not measured on Foundry's server; no file this module offers carries either). */
    /* The Assets Library's answer is its origin and path (E78 fix h76-HF1): a name or a password in the URL
       makes the re-read below differ, so it is refused rather than answered without them. */
    const answer = !here ? `${url.origin}${url.pathname}` : /^[a-z][a-z0-9+.-]*:/i.test(text) ? url.pathname : text;
    /* The re-read can throw (E77 fix r2-H1, review round 2's sec F1): after the empty segment comes what the URL
       parser will not take as a host - a port that is no number or out of range, a space or `%20`, an unclosed
       `[`, a bare `%` - and `new URL` rejects the answer (measured 13.10.2026 in Node at 2babd4c: 18 of 18 such
       paths threw TypeError, each of the six written after `//`, `/.//` and `<scheme>.//`). The tile, Room
       Setup's cells and setVaultRoom all stopped on the throw, so a stored value of that class kept the tile on
       the room before and closed Room Setup on its scene. Refused here like every other: `null`. */
    try {
        return new URL(answer, document.baseURI).href === url.href ? answer : null;
    } catch {
        return null;
    }
}

/**
 * The room's picture, a path `safeRoomImage` accepts, or `null` (E77 C1). Checked again on every read: a
 * value written by a console, or by a road nobody has measured, is never handed to a fetch. The answer is
 * `safeRoomImage`'s final one, safe to use as a URL as it is (E77 fix r1-G1).
 */
export function roomImage(room, scene) {
    return safeRoomImage(roomFlag(scene, room, VAULT_FLAGS.image));
}

/** Categories this room is a good place to search for. */
export function roomFavours(room, scene) {
    return listOver(roomRegions(scene, room), VAULT_FLAGS.favours);
}

/**
 * Does looking for this here make sense?
 *
 * The medic's office is where the medicine is. Searching the boiler room for
 * bandages should not be as good a bet, and the guide agrees: "co się znajdzie,
 * może zależeć od pomieszczenia".
 */
export function favoursCategory(room, category, scene) {
    return roomFavours(room, scene).includes(category);
}

/** Categories this room is a poor place to search for. */
export function roomHinders(room, scene) {
    return listOver(roomRegions(scene, room), VAULT_FLAGS.hinders);
}

/**
 * Does looking for this here make no sense?
 *
 * The other half of `favoursCategory`: bandages in the boiler room. Marked per
 * room by the GM on the same screen as the favours, and worth a real
 * disadvantage rather than mere absence of the bonus - a room can be actively
 * the wrong place to dig for a thing, not just not the best one.
 */
export function hindersCategory(room, category, scene) {
    return roomHinders(room, scene).includes(category);
}

/* ==========================================================================
 * WHOSE ROOM IS THIS
 * ========================================================================== */

/**
 * The rooms on a scene, by name, one piece each: a handle on a room's region, for a caller that
 * needs a region and decides nothing by its flags.
 *
 * ROOMS, ON THE SCENE NAMED (E12 C2a, audit S07-05, S07-06, S08-17). Until 1.2.74 this took
 * every named region of the camera's scene (`workingScene()`), a Teleport's included, and
 * its map kept the LAST region of a name - which is the piece Room Setup wrote, while the
 * crossing veto read the FIRST. A room is now what rooms.mjs says it is, the caller names
 * the scene, and every writer here writes all the pieces of a name that can be rooms
 * (`updateRoom`). The piece this map holds is still the last, so no rule reads through it
 * any more (E12 fix r1-G1, 11.10.2026): until then the stashes, the bedroom walkers, the
 * table, the favours and rest.mjs's rest rooms did, and a piece drawn and marked after a room
 * was set up hid all of it (rooms.mjs, "ONE ROOM OF MANY PIECES").
 */
export function regionsByName(scene) {
    const map = new Map();
    for (const region of roomPieces(scene)) map.set(region.name, region);
    return map;
}

/**
 * One update written to every region of a room's name on this scene that can be a room, marked
 * or not (`writablePieces`), in one update of the scene's regions (E12 C2a): the writers below
 * wrote the one piece `regionsByName` held, so a Kitchen of two pieces had its owner, its stash
 * or its lock on one of them. Until E12 fix r1-G1 a Teleport or a player's region of the name
 * was written too. Answers the regions written. A GM's write, on a GM's client only.
 */
async function updateRoom(scene, room, update) {
    if (!game.user.isGM || !scene) return [];
    const pieces = writablePieces(scene, room);
    if (pieces.length) await scene.updateEmbeddedDocuments("Region", pieces.map(r => ({ _id: r.id, ...update })));
    return pieces;
}

/**
 * The actor id whose BEDROOM this is, or `null`. Doors and keys, not stashes. Read over
 * every piece of the room on the scene named (E12 C2a) - no scene, no answer.
 */
export function vaultOwnerOf(room, scene) {
    return roomFlag(scene, room, VAULT_FLAGS.owner) ?? null;
}

/* ==========================================================================
 * STASHES
 * --------------------------------------------------------------------------
 * A stash is an object that lives in a room, not the room itself. Everything
 * below reads that list; `setStash` is the only thing that writes it.
 * ========================================================================== */

/**
 * Every stash in one room, as `[{ actorId, concealed }]`.
 *
 * MIGRATION HAPPENS HERE, BY READING, and that is the point of doing it this
 * way. A region with no `stashes` flag is not a room with no stashes - it is a
 * room nobody has edited since E11 - so the old pair of flags is translated on
 * the spot into the one entry they used to mean. Nothing is written, which
 * matters more than it looks: this runs on players' clients too, where a write
 * would be refused, and a migration that only completes when a GM logs in is a
 * migration that makes the same world behave differently for different people.
 *
 * The array is rebuilt rather than handed back, so no caller can edit the
 * region's stored flag by mutating what it was given.
 */
export function stashesIn(room, scene) {
    return stashesOver(roomRegions(scene, room));
}

/**
 * Every piece's stashes as one list (E12 fix r1-G1): the first piece that lists a person answers
 * for their stash. The writer gives every piece the same list, so the pieces disagree only where
 * one was drawn after the last edit, and that piece lists nobody.
 */
function stashesOver(pieces) {
    const byActor = new Map();
    for (const piece of pieces) {
        for (const entry of stashesOn(piece)) if (!byActor.has(entry.actorId)) byActor.set(entry.actorId, entry);
    }
    return [...byActor.values()];
}

/**
 * The same answer, from a region already in hand.
 *
 * A room's pieces are found by a pass over the scene's regions - cheap once,
 * and quadratic from anything that wants to look at every room. Splitting the
 * body out is what lets the walkers below group them once (`piecesByName`)
 * instead of once per room.
 */
function stashesOn(region) {
    if (!region) return [];

    const stored = region.getFlag(MODULE_ID, VAULT_FLAGS.stashes);
    if (Array.isArray(stored)) {
        return stored
            .filter(entry => entry?.actorId)
            .map(entry => ({ actorId: entry.actorId, concealed: Boolean(entry.concealed) }));
    }

    const owner = region.getFlag(MODULE_ID, VAULT_FLAGS.owner);
    if (!owner) return [];
    return [{
        actorId: owner,
        concealed: Boolean(region.getFlag(MODULE_ID, VAULT_FLAGS.concealed))
    }];
}

/** One person's stash in one room, or `null`. */
export function stashIn(room, actorId, scene) {
    return stashesIn(room, scene).find(entry => entry.actorId === actorId) ?? null;
}

/** Every room on the scene where this character has a stash. */
export function stashRoomsFor(actor, scene) {
    if (!actor) return [];
    const out = [];
    for (const [name, pieces] of piecesByName(scene)) {
        const mine = stashesOver(pieces).find(entry => entry.actorId === actor.id);
        if (mine) out.push({ room: name, concealed: mine.concealed });
    }
    return out;
}

/**
 * The stash an unaddressed item belongs to - overflow, and anything stashed
 * before E11.
 *
 * THEIR BEDROOM WINS when they have a stash in it, even if they built another
 * one first. Any other rule makes "where did my overflow go" depend on the
 * order a GM happened to tick boxes in, and the bedroom is the one room a
 * player can always get back into.
 */
export function primaryStashRoom(actor, scene) {
    if (!actor) return null;

    // ONE WALK ANSWERS BOTH HALVES. The obvious spelling - `stashRoomsFor` and
    // then `vaultRoomOwnedBy` - builds the region map twice inside a function
    // that `stashItemsIn` used to call once per stashed item: measured at
    // 0.218 ms per call with twelve things in a stash and eighteen regions,
    // which is the same order as the whole visibility pass this module
    // deliberately keeps. Not a fire, but a quadratic with a free fix.
    let first = null;
    let bedroom = null;
    for (const [name, pieces] of piecesByName(scene)) {
        if (!stashesOver(pieces).some(entry => entry.actorId === actor.id)) continue;
        if (first === null) first = name;
        if (flagOver(pieces, VAULT_FLAGS.owner) === actor.id) bedroom = name;
    }
    return bedroom ?? first;
}

/** The room this character's bedroom IS, owner flag only. */
export function vaultRoomOwnedBy(actor, scene) {
    if (!actor) return null;
    for (const [name, pieces] of piecesByName(scene)) {
        if (flagOver(pieces, VAULT_FLAGS.owner) === actor.id) return name;
    }
    return null;
}

/**
 * GM: add, remove or re-hide one person's stash in one room.
 *
 * Writes the whole list because a region flag has no per-element update - and
 * writing it at all is what materialises `stashesIn`'s reconstruction for that
 * region, which is exactly when it should happen: the moment somebody edits
 * this room, the old two-flag shape stops being the source of truth for it.
 */
export async function setStash(room, actorId, { present = undefined, concealed = undefined, scene = null } = {}) {
    if (!game.user.isGM || !room || !actorId) return null;

    // The scene the caller names, with no default since E12 C6. The list is every piece's
    // (`stashesIn`) and goes to every piece that can be a room (`updateRoom`): until E12 fix r1-G1
    // it was read off the last piece, so an edit after a piece was drawn and marked wrote that
    // piece's empty list over the room's.
    if (!roomRegions(scene, room).length) return null;

    const list = stashesIn(room, scene);
    const at = list.findIndex(entry => entry.actorId === actorId);

    if (present === false) {
        if (at < 0) return list;

        /*
         * A STASH WITH SOMETHING IN IT IS NOT REMOVED (E11, measured in E17).
         *
         * The Room Setup dialog has always refused this and named the count, so
         * at the table it was covered. `setStash` itself did not, and it is on
         * `game.drpg` - so a macro, a console line or a feature written next
         * month could take the stash away and leave the items behind: still
         * flagged as stashed, so hidden from their owner's sheet, in a room with
         * nowhere to take them out of. A lost item, silently.
         *
         * Measured before this: stash removed, `stashItemsIn` still returning 1,
         * and not a single notification.
         *
         * The dialog keeps its own pre-check, because refusing one cell in a
         * batch and carrying on is better than failing the Apply - this is the
         * floor under it, not a replacement for it.
         */
        const owner = game.actors.get(actorId);
        const held = owner ? stashItemsIn(owner, room, scene).length : 0;
        if (held) {
            ui.notifications.warn(plural("DRPG.Vault.stashNotEmpty", {
                name: owner?.name ?? "?", room, n: held
            }));
            return null;
        }

        list.splice(at, 1);
    } else if (at < 0) {
        // Anything but an explicit `present: false` creates it when missing:
        // a GM cycling a cell to "hidden" on an empty square means "give them
        // one, hidden", not "hide the stash that is not there".
        list.push({ actorId, concealed: Boolean(concealed) });
    } else if (concealed !== undefined) {
        list[at] = { actorId, concealed: Boolean(concealed) };
    }

    await updateRoom(scene, room, { [`flags.${MODULE_ID}.${VAULT_FLAGS.stashes}`]: list });

    // A hiding place taken away is one nobody has "found" any more (ITEM-09):
    // the finders' notes pointed at it by room and owner, and left standing
    // they opened the same drawer for free next season. This block sat AFTER the
    // `return` above it until 22.09, so it never ran.
    if (present === false) {
        try {
            await forgetStashFound(room, actorId, scene);
        } catch (err) {
            error("Could not clear who had found a removed stash", err);
        }
    }
    return list;
}

/**
 * Every finder's note about one stash, gone - the stash of that owner in that room ON THAT
 * SCENE. A note is keyed `sceneId::room::ownerId` (`foundKey`); this matched the end of the key
 * until E12 C3 (11.10.2026; audit S08-39), so taking away a stash in one scene's Kitchen also
 * made every finder forget the same owner's stash in another scene's Kitchen. A note written
 * with no scene (`?`) names none, so it goes with any of them.
 */
async function forgetStashFound(room, ownerId, scene) {
    const gone = new Set([foundKey(room, ownerId, scene), foundKey(room, ownerId, null)]);
    // The finders' notes as the GMs hold them (E16 fix e1-G1, 26.10.2026; the review's E16p2-SEC-2 = E16R-05), as
    // `carryRoomOnSheets` reads them: every write queued on a student judged first, then read in one pass. Read off the
    // document, a player's note written while its put-back was on its way rode into this GM's write, which the audit
    // takes as the GMs' - a forged find that then opened a concealed stash (`stealFromVault`). Measured: E16-T29.
    const finders = [...(game.actors ?? [])];
    await judgedFor(...finders.map(actor => actor.id));
    for (const actor of finders) {
        const found = stashesFoundBy(flagsHeldNow(actor));
        if (!found.length) continue;
        const kept = found.filter(key => !gone.has(String(key)));
        if (kept.length === found.length) continue;
        await actor.setFlag(MODULE_ID, VAULT_FLAGS.found, kept);
    }
}

/** Nobody remembers finding anything: the season reset's step. GM-side. */
export async function forgetAllStashesFound(actors = game.actors) {
    let cleared = 0;
    for (const actor of actors) {
        if (actor.getFlag?.(MODULE_ID, VAULT_FLAGS.found) === undefined) continue;
        await actor.unsetFlag(MODULE_ID, VAULT_FLAGS.found);
        cleared += 1;
    }
    return cleared;
}

/**
 * Every hiding place over this character's stashes taken off, on every scene, the stashes kept
 * (E11 C10, 10.10.2026; audit S08-32): the season reset's `stashesFound` group, beside the finders'
 * notes. A hiding place is a stash's `concealed`, which the GM sets in Room Setup (`applyStashMatrix`
 * through `setStash`), and it outlived the reset that took the projects, the notes of who had found it
 * and the doors with it - so the new season opened on a drawer nobody had hidden in it yet (read in
 * the code, 10.10.2026: no step of the reset wrote `stashes` or the legacy flag). A stash itself is the map's, as
 * a bedroom's owner is: it stays. Every scene and not the one the GM is looking at, which
 * `regionsByName()` read until E12 C2a made its scene a parameter (ITEM-16); the legacy
 * one-stash flag too, which `stashesOn` still reads where a room was never edited since the
 * list came in. GM-side.
 *
 * @returns {Promise<number>} how many rooms had a hiding place taken off.
 */
export async function unconcealStashes(actorId) {
    if (!game.user.isGM || !actorId) return 0;
    let rooms = 0;
    for (const scene of game.scenes ?? []) {
        for (const region of scene.regions ?? []) {
            if (!region.name) continue;
            const stored = region.getFlag(MODULE_ID, VAULT_FLAGS.stashes);
            const listed = Array.isArray(stored) && stored.some(entry => entry?.actorId === actorId && entry.concealed);
            const legacy = region.getFlag(MODULE_ID, VAULT_FLAGS.owner) === actorId && Boolean(region.getFlag(MODULE_ID, VAULT_FLAGS.concealed));
            if (!listed && !legacy) continue;
            const update = {};
            if (listed) {
                update[`flags.${MODULE_ID}.${VAULT_FLAGS.stashes}`] = stored.map(entry =>
                    entry?.actorId === actorId ? { ...entry, concealed: false } : entry);
            }
            if (legacy) update[`flags.${MODULE_ID}.${VAULT_FLAGS.concealed}`] = false;
            await region.update(update);
            rooms++;
        }
    }
    return rooms;
}

/** Has a "build a stash" project made this room's contents hard to find? */
/**
 * Is this room locked when a season begins?
 *
 * A room nobody has answered for falls back to how it is locked right now. That
 * is the honest default for a world where this column did not exist yesterday:
 * whatever the map is set to today is what it was built as, and a reset that
 * changed nothing is better than one that flings every door open because a flag
 * was missing.
 */
export function startLocked(region) {
    const stored = region?.getFlag(MODULE_ID, ROOM_FLAGS.lockedAtStart);
    if (stored === undefined || stored === null) {
        return Boolean(region?.getFlag(MODULE_ID, ROOM_FLAGS.locked));
    }
    return Boolean(stored);
}

/**
 * Is the BEDROOM OWNER's stash in this room hidden?
 *
 * Kept because `game.drpg` exports it and a GM's macro may be calling it - see
 * the compatibility note at the bottom of this file. It now answers through
 * `stashesIn`, so it means the same thing it always did on an untouched world
 * and the right thing on an edited one. Anything asking about a specific
 * person's stash should call `stashIn(room, actorId).concealed` instead: this
 * cannot answer for the stash somebody built in a room that is not theirs.
 */
export function isConcealed(room, scene) {
    const ownerId = vaultOwnerOf(room, scene);
    if (!ownerId) return false;
    return Boolean(stashIn(room, ownerId, scene)?.concealed);
}

/**
 * The room this character stashes things in by default.
 *
 * A compatibility name: before E11 there was only ever one, so "their stash
 * room" and "their bedroom" were the same sentence. It answers `primaryStashRoom`
 * now - the bedroom when they have a stash in it, the first one otherwise -
 * which is the closest true thing to what every existing caller meant.
 */
export function vaultRoomFor(actor, scene) {
    return primaryStashRoom(actor, scene);
}

/** Which stash an item is lying in. Unmarked means the owner's primary. */
export function stashRoomOfItem(item, owner, scene) {
    return item?.getFlag?.(MODULE_ID, ITEM_FLAGS.stashRoom)
        ?? primaryStashRoom(owner, scene);
}

/** What this character has stashed in ONE room. */
export function stashItemsIn(actor, room, scene) {
    if (!actor || !room) return [];
    // The primary is a fact about the CHARACTER, not about each item, so it is
    // worked out once. Calling `stashRoomOfItem` per item asked the same
    // question of the same region map once per thing in the drawer.
    const primary = primaryStashRoom(actor, scene);
    return vaultContents(actor).filter(i =>
        (i.getFlag(MODULE_ID, ITEM_FLAGS.stashRoom) ?? primary) === room);
}

/**
 * Every BEDROOM on the scene, as {room, owner, scene}.
 *
 * Split out of `allVaults` at E11, and the split is a rule rather than tidying:
 * keys are a bedroom fact and stashes are not. `allVaults` now lists stashes,
 * so a key dialog reading it would happily offer a key to a room where somebody
 * merely built a hiding place - and "let me stash this at your place" would buy
 * permanent entry to their bedroom. That is precisely the leak the two flags
 * were separated to prevent.
 */
export function allBedrooms(scene) {
    const out = [];
    // The scene named, every piece of each room read as one (E12 C2a): no camera.
    for (const name of roomNames(scene)) {
        const ownerId = vaultOwnerOf(name, scene);
        if (!ownerId) continue;
        // The scene it was read on (E11 C10b): the reset's "each to their own bedroom" moves a
        // token only on the map its bedroom is drawn on, and `allBedroomsAnywhere` mixes scenes.
        out.push({ room: name, owner: game.actors.get(ownerId) ?? null, scene });
    }
    return out;
}

/**
 * Every bedroom on every scene, first scene wins on a name clash.
 *
 * `workingScene()` is the scene the GM is LOOKING AT, and a GM parked on the
 * trial hall asking to give a key was told there were no keys to give
 * (ITEM-16). The dorms are usually one scene over.
 */
export function allBedroomsAnywhere() {
    const seen = new Map();
    for (const scene of game.scenes ?? []) {
        for (const entry of allBedrooms(scene)) {
            if (!seen.has(entry.room)) seen.set(entry.room, entry);
        }
    }
    return [...seen.values()];
}

/** The owner of a bedroom, whichever scene it is drawn on. */
export function bedroomOwnerAnywhere(room) {
    for (const scene of game.scenes ?? []) {
        const id = vaultOwnerOf(room, scene);
        if (id) return id;
    }
    return null;
}

/**
 * A ROOM RENAMED, ON THE SHEETS (E12 C8, 11.10.2026; audit S08-18). A stashed item names its
 * stash's room (`ITEM_FLAGS.stashRoom`), a key the room it opens (`KEY_FLAG`), and a note of a
 * found stash `sceneId::room::ownerId` (`foundKey`) - all by name, so a GM who renamed a room
 * left the items in a drawer nobody could open, the keys opening nothing and the notes pointing
 * at nothing; and the next sweep (`reconcileBedroomKeys`) hands the owner a key of the new name
 * beside the dead one (read in the code, not run).
 * fog.mjs `carryRename` calls this on the primary, for a GM's rename of the room's last piece
 * of that name on `scene` onto a name no other room there has (E12 fix r2-H4), with the room's
 * pieces as the rename's hook found them, and does the discovery record itself. Answers how many keys, stashed
 * items and found notes now name `to`.
 *
 * Neither an item's room nor a key's names a scene, so each goes with the rename only where it
 * cannot mean a room of the same name on another scene: a stashed item when its owner has a
 * stash in this room and none in a room of the old name elsewhere, a key when this room is a
 * bedroom and no other scene holds a bedroom of the old name. A found note does name its scene;
 * a note written with none (`?`) goes with this scene's, as `forgetStashFound` takes it for
 * any scene, and keeps its `?`. The items are read as the GMs hold them (`itemsHeldNow`),
 * after every write queued on their owners has been judged (`judgedFor`), and in one
 * synchronous pass; each is one write
 * (`trustedWrite`: the stash's room is a protected flag), and a key whose name is still the one
 * `grantBedroomKey` gave it is renamed with it. The notes are read as the GMs hold them (`flagsHeldNow`, after
 * `judgedFor`): the found list is a GM's flag since E16 part 2 C3.
 */
export async function carryRoomOnSheets(scene, from, to, pieces = roomRegions(scene, to)) {
    if (!isPrimaryGm() || !scene || !from || !to || from === to) return { keys: 0, items: 0, found: 0 };
    const elsewhere = [...(game.scenes ?? [])].filter(s => s.id !== scene.id);
    // The room's pieces as the rename's hook found them (E12 fix r2-H4, EARLY-C8-2): a second rename
    // landing while this one waits must not empty the room it carries to.
    const stashed = new Set(pieces.flatMap(r => stashesOn(r).map(entry => entry.actorId)));
    const itemsGo = id => stashed.has(id) && !elsewhere.some(s => stashesIn(from, s).some(entry => entry.actorId === id));
    const keysGo = Boolean(flagOver(pieces, VAULT_FLAGS.owner)) && !elsewhere.some(s => vaultOwnerOf(from, s));
    const named = item => keyRoomOf(item) === from || (isStashed(item) && item.getFlag?.(MODULE_ID, ITEM_FLAGS.stashRoom) === from);
    const actors = [...(game.actors ?? [])].filter(actor => actor.items?.some?.(named));
    await judgedFor(...actors.map(actor => actor.id));

    const writes = [];
    let keys = 0, items = 0;
    for (const actor of actors) {
        for (const held of itemsHeldNow(actor)) {
            const key = keysGo && keyRoomOf(held) === from;
            const stash = itemsGo(actor.id) && isStashed(held) && held.getFlag?.(MODULE_ID, ITEM_FLAGS.stashRoom) === from;
            if (!key && !stash) continue;
            const changes = {};
            if (key) {
                changes[`flags.${MODULE_ID}.${KEY_FLAG}`] = to;
                if (held.name === game.i18n.format("DRPG.Vault.keyName", { room: from })) changes.name = game.i18n.format("DRPG.Vault.keyName", { room: to });
                keys++;
            }
            if (stash) {
                changes[`flags.${MODULE_ID}.${ITEM_FLAGS.stashRoom}`] = to;
                items++;
            }
            writes.push([actor.items.get(held.id), changes]);
        }
    }
    for (const [item, changes] of writes) if (item) await trustedWrite(item, changes, { reason: "setup" });

    let found = 0;
    const renamed = [`${scene.id}::${from}::`, `?::${from}::`];
    // The finders' notes as the GMs hold them (E16 part 2 C3; `GM_FLAGS`): every write queued on a student judged first,
    // then read in one pass, so a player's own note written here is not carried into the GMs' write.
    const finders = [...(game.actors ?? [])];
    await judgedFor(...finders.map(actor => actor.id));
    for (const actor of finders) {
        const notes = stashesFoundBy(flagsHeldNow(actor));
        const next = notes.map(note => {
            const at = renamed.find(head => String(note).startsWith(head));
            return at ? `${at.split("::")[0]}::${to}::${String(note).slice(at.length)}` : note;
        });
        const moved = next.filter((note, i) => note !== notes[i]).length;
        if (!moved) continue;
        await actor.setFlag(MODULE_ID, VAULT_FLAGS.found, next);
        found += moved;
    }
    return { keys, items, found };
}

/**
 * The rooms that count towards the guide's rooms-per-player ratio (audit A21).
 *
 * G-36: about one and a half rooms per player, "corridors and dormitories
 * aside". Three kinds of region are therefore not on this list:
 *
 *   unnamed      not a room at all - `piecesByName` never yields it
 *   a bedroom    it belongs to one person, whoever else can open the door
 *   marked       a corridor, a stairwell, a wing nobody has opened; the GM
 *                says so with the "Counts as a room" column in Room Setup
 *
 * ONE LIST, BECAUSE THERE WERE TWO NUMBERS. The season checklist counted every
 * region on the scene - bedrooms, corridors and unnamed shapes included - while
 * Room Setup counted the unowned ones and rounded differently. The same map got
 * two answers, and neither of them was the guide's.
 */
export function sharedRooms(scene) {
    return roomCensus(scene).rooms;
}

/*
 * ONE CENSUS, THREE READERS (E20 C1, S07-38; the owner's Q-3, 29.10.2026). The Doors tab left
 * locked rooms out and counted the living, the season checklist counted locked rooms and every
 * student, and Pre-season checks counted every marked room, bedrooms included: one map read
 * "17", "17" and "18" with three different cast sizes beside them. The rule is stated once here:
 * a room counts when a GM marked it, nobody owns it (a bedroom) and it is not "No privacy";
 * a locked room counts (the owner's answer), and is listed apart so a window can say how many
 * of them are shut. `roomCensusOf` takes the rows, so the Doors tab applies the rule to the boxes
 * on screen and `roomCensus` to the flags; `roomRatioLine` is the one sentence both print.
 */

/** The census of rows `{ name, room, owner, notShared, locked }`: `rooms` (the count), `locked` among them, `bedrooms`, `noPrivacy`. */
export function roomCensusOf(rows) {
    const out = { rooms: [], locked: [], bedrooms: [], noPrivacy: [] };
    for (const row of rows ?? []) {
        if (!row?.room) continue;
        if (row.owner) out.bedrooms.push(row.name);
        else if (row.notShared) out.noPrivacy.push(row.name);
        else {
            out.rooms.push(row.name);
            if (row.locked) out.locked.push(row.name);
        }
    }
    return { ...out, count: out.rooms.length };
}

/** The census of this scene's rooms as their flags stand (see above); every piece of a room read as one (`flagOver`). */
export function roomCensus(scene) {
    return roomCensusOf([...piecesByName(scene)].map(([name, pieces]) => ({
        name,
        room: true,
        owner: flagOver(pieces, VAULT_FLAGS.owner),
        notShared: flagOver(pieces, VAULT_FLAGS.notShared),
        locked: flagOver(pieces, ROOM_FLAGS.locked)
    })));
}

/** The rooms-per-student sentence of the Doors tab and the season checklist: a census against the living students. */
export function roomRatioLine(census, living) {
    const want = roomsWantedFor(living);
    const line = game.i18n.format("DRPG.Vault.roomRatio", {
        rooms: plural("DRPG.Vault.roomCensus", { n: census.count }),
        living,
        per: living ? (census.count / living).toFixed(1) : "-",
        target: ROOMS_PER_PLAYER,
        want
    });
    return census.locked.length ? `${line} ${plural("DRPG.Vault.roomCensusLocked", { n: census.locked.length })}` : line;
}

/**
 * How many shared rooms a cast of this size wants. The one rounding.
 *
 * `Math.ceil`, so "1.5 rooms per player" never reads as satisfied by fewer
 * rooms than the guide asks for. Room Setup used to round instead, which meant
 * an odd cast size wanted one room less there than on the checklist.
 */
export function roomsWantedFor(people) {
    return Math.ceil((Number(people) || 0) * ROOMS_PER_PLAYER);
}

/** Every stash on the scene, wherever it is and whoever it belongs to. */
export function allVaults(scene) {
    const out = [];
    for (const [name, pieces] of piecesByName(scene)) {
        const owner = flagOver(pieces, VAULT_FLAGS.owner);
        for (const entry of stashesOver(pieces)) {
            out.push({
                room: name,
                owner: game.actors.get(entry.actorId) ?? null,
                concealed: entry.concealed,
                // Whether this is the room with their name on the door. The
                // Stashes tab shades that column, and it is the difference
                // between "their drawer" and "something they built at
                // somebody else's place".
                bedroom: owner === entry.actorId
            });
        }
    }
    return out;
}

/** GM: point a room at an owner, and say whether it is concealed. */
export async function setVaultRoom(room, {
    owner = undefined, table = undefined,
    favours = undefined, hinders = undefined, description = undefined, image = undefined, scene = null
} = {}) {
    if (!game.user.isGM) return null;

    // The scene the caller names, with no default since E12 C6 (it was the camera's, moved up
    // here from `regionsByName` by E12 C2a). Every region of the name that can be a room is written (`updateRoom`),
    // marked or not: Room Setup lists the named regions so that a GM can make one a room.
    const pieces = writablePieces(scene, room);
    const region = pieces.at(-1);
    if (!region) return null;
    // The owner before, for the old owner's keys (E14 fix e1-G2: every road that gives a room away takes them).
    const ownerBefore = flagOver(pieces, VAULT_FLAGS.owner);

    const update = {};
    if (owner !== undefined) update[`flags.${MODULE_ID}.${VAULT_FLAGS.owner}`] = owner || null;
    // `concealed` is never written here any more: `setStash` owns it (ITEM-02).
    if (table !== undefined) update[`flags.${MODULE_ID}.${VAULT_FLAGS.table}`] = table || null;
    if (favours !== undefined) {
        update[`flags.${MODULE_ID}.${VAULT_FLAGS.favours}`] = Array.isArray(favours) ? favours : [];
    }
    if (hinders !== undefined) {
        update[`flags.${MODULE_ID}.${VAULT_FLAGS.hinders}`] = Array.isArray(hinders) ? hinders : [];
    }
    if (description !== undefined) {
        update[`flags.${MODULE_ID}.${VAULT_FLAGS.description}`] = String(description ?? "");
    }
    // The picture (E77 C1): null or "" clears it; a path `safeRoomImage` refuses is not written and the GM
    // is told - Room Setup checks its rows first and hands a refused one on as `undefined`, so this warning
    // is `game.drpg.setVaultRoom`'s.
    if (image !== undefined) {
        const path = image ? safeRoomImage(image) : null;
        if (image && !path) ui.notifications.warn(game.i18n.format("DRPG.Vault.imageRefused", { room }));
        else update[`flags.${MODULE_ID}.${VAULT_FLAGS.image}`] = path;
    }
    if (!Object.keys(update).length) return null;

    await updateRoom(scene, room, update);
    if (owner !== undefined && ownerBefore && ownerBefore !== (owner || null)) {
        await takeOldOwnersKeys([{ room, from: ownerBefore, to: owner || null }]);
    }
    return region;
}

/*
 * A PIECE RENAMED OUT OF A ROOM OF SEVERAL (E12 fix r1-G1, 11.10.2026; review round 1 CR1-3).
 * Every writer here writes every piece of a room's name, so each piece carries a whole copy of
 * the room. Renaming one piece of a two-piece Kitchen to "Pantry" made the Pantry a second copy:
 * measured by the review on b5baaf5, `vaultOwnerOf("Pantry")` answered the Kitchen's owner, who
 * had two bedrooms then, and read in the code, the Pantry was shut to everyone else and the next
 * Room Setup Apply gave her its key (`reconcileBedroomKeys` walks every named region). A GM's
 * rename of a piece whose old name keeps other room pieces now takes the room's flags off that
 * piece in the same update, and the GMs are told what it carried; the room keeps all of it on
 * its other pieces. A rename of a room's only piece is the room's own rename and keeps its flags
 * (E12 C8 carries the rest of the room with it) - unless its new name is a room that stands on the
 * scene already: then the piece joins that room and its flags come off the same way (E12 fix r2-H4). Judged in `preUpdateRegion`, which runs on the
 * client that writes the update and hands it the old name beside the changes before they are
 * sent; a write that skips the hooks (`noHook`) is not seen, and a player's rename is not judged
 * here (what v14 lets a player write to a Region is LIVE-E12-04).
 */

/** The flags a piece carries for its room, each with the Room Setup column that sets it. A function: read at a rename, not at load. */
function pieceData() {
    return [
        [VAULT_FLAGS.owner, "DRPG.Vault.owner"], [VAULT_FLAGS.stashes, "DRPG.Vault.tabStashes"],
        [VAULT_FLAGS.concealed, "DRPG.Vault.tabStashes"], [VAULT_FLAGS.table, "DRPG.Vault.table"],
        [VAULT_FLAGS.favours, "DRPG.Vault.favours"], [VAULT_FLAGS.hinders, "DRPG.Vault.hinders"],
        [VAULT_FLAGS.description, "DRPG.Vault.descriptionColumn"], [VAULT_FLAGS.image, "DRPG.Vault.imageColumn"],
        [VAULT_FLAGS.notShared, "DRPG.Vault.notSharedColumn"],
        [REST_FLAGS.short, "DRPG.Rest.shortColumn"], [REST_FLAGS.long, "DRPG.Rest.longColumn"],
        [ROOM_FLAGS.locked, "DRPG.Vault.lockedColumn"], [ROOM_FLAGS.lockedAtStart, "DRPG.Vault.lockedAtStartColumn"],
        [SEARCH_FLAGS.sealed, "DRPG.SearchTokens.sealedColumn"],
        // A room's Neighbours (E12 C14) was left on the piece (E12 fix r2-H2, 11.10.2026; correctness
        // review r2 R2-1, security review r2 SEC2-6): the piece renamed off a room spoke that room's list
        // as its own, and by "either declares" every room on it gained the new name as a door - measured
        // by the review on the harness (97-corr-split.mjs): the split-off piece was the Hall's neighbour.
        [ROOM_FLAGS.neighbours, "DRPG.Vault.neighboursColumn"]
    ];
}

const carriesValue = value => value !== undefined && value !== null && value !== false && value !== ""
    && !(Array.isArray(value) && !value.length);

export function registerRoomPieces() {
    Hooks.on("preUpdateRegion", (region, changes, options, userId) => clearSplitPiece(region, changes, userId));
}

/**
 * A GM's rename of one piece of a room of several, or onto a room that stands on the scene: the
 * piece's room flags are set to none in the update itself (the note above), and the GMs told.
 * Answers the flags taken off, or null.
 */
export function clearSplitPiece(region, changes, userId) {
    if (!game.user?.isGM || userId !== game.user.id) return null;
    const was = region?.name, now = changes?.name;
    if (!was || now === undefined || now === was) return null;
    const scene = region.parent;
    /* A rename onto a room that stands on the scene (E12 fix r2-H4, rooms.mjs `joinsAnotherRoom`): the
       piece joins that room, so what it carried for its old one comes off it as a split piece's does, and
       fog.mjs carries nothing. A room's piece that was the last of its name is told even when it carried
       nothing, because then the old room is gone and what named it (keys, stashes, discovery) still does.
       A region no GM made a room is told only of what it carried: naming a new piece after a room is how
       a room gains one. */
    const joins = joinsAnotherRoom(scene, region, was, now);
    const split = roomRegions(scene, was).some(piece => piece.id !== region.id);
    if (!joins && !split) return null;
    const written = changes.flags?.[MODULE_ID] ?? {};
    const carried = pieceData().filter(([key]) => !(key in written) && carriesValue(region.getFlag(MODULE_ID, key)));
    /* The record of the rename, in the same update (rooms.mjs `RENAMED_FROM`; E12 fix k3-K2): the first
       pieces of a room renamed piece by piece say which name they left, and a piece that joins another
       room says nothing - an older record on it is taken off. */
    const from = split && !joins && isRoom(region) ? was : null;
    const record = from || region.getFlag(MODULE_ID, RENAMED_FROM) ? { [RENAMED_FROM]: from } : {};
    if (carried.length || RENAMED_FROM in record) {
        changes.flags = { ...(changes.flags ?? {}), [MODULE_ID]: { ...written, ...Object.fromEntries(carried.map(([key]) => [key, null])), ...record } };
    }
    if (!carried.length && !(joins && !split && isRoom(region))) return null;
    const keys = carried.map(([key]) => key);
    log(`"${was}" on "${scene?.name}" renamed "${now}" ${joins ? "joined a room of that name" : "was one piece of several"}: `
        + `it no longer carries ${keys.join(", ") || "anything"}.`);
    const labels = [...new Set(carried.map(([, label]) => game.i18n.localize(label)))].join(", ")
        || game.i18n.localize("DRPG.Rooms.carriedNothing");
    whisperToGms(`<p class="drpg-warning">${esc(game.i18n.format(joins ? "DRPG.Rooms.renameJoined" : "DRPG.Rooms.pieceSplit", {
        name: now, room: was, scene: scene?.name ?? "", carried: labels
    }))}</p>`).catch(err => error(`Could not tell the GMs what "${now}" no longer carries`, err));
    return keys;
}

/* ==========================================================================
 * WHAT IS IN IT
 * ========================================================================== */

/** Everything this character has stashed, in every stash they own. Each stash takes `VAULT_LIMIT`. */
export function vaultContents(actor) {
    if (!actor) return [];
    return actor.items.filter(i =>
        i.getFlag(MODULE_ID, ITEM_FLAGS.category) && isStashed(i));
}

/**
 * The stash of my own I am standing in, or `null`.
 *
 * Was "am I in my one stash room" and is now "which of mine is this", because
 * the answer stopped being unique. Returns the room NAME so `stow` can stamp it
 * onto the item - a boolean would have made the caller ask the same question
 * again and get a different answer for anybody with two stashes. The room and its stash
 * are read on the scene the character stands on (E12 C6), as `stow` and `retrieve` read it.
 */
export async function myStashHere(actor) {
    if (!actor) return null;
    const place = locateActor(actor);
    if (!place?.room) return null;
    return stashIn(place.room, actor.id, place.scene) ? place.room : null;
}

/** Whether this character stands in one of its own stashes (`myStashHere`). Not on `game.drpg`, and nothing in the
 *  module calls it (E52 C6, S01-52: this comment named it there as a compatibility entry). */
export async function atOwnVault(actor) {
    return Boolean(await myStashHere(actor));
}

/**
 * Put something away. No action, no roll - but you have to be there.
 *
 * Truth Bullets are refused outright: they are not objects in a drawer, they
 * are what the character knows, and hiding one would only mean hiding it from
 * the trial the whole game is pointed at.
 */
export async function stow(actor, item) {
    if (!actor || !item) return false;
    // The dead keep their hands still (E14 part 1 C3; audit S08-12, D15): what is on
    // the body stays there to be found, a Monocub's too. A death this browser may know
    // (`isDeadForGm`: the victim's own player knows it before the table); the GMs judge
    // a write past this as they judge any (sheet-audit.mjs `placeStands`).
    if (refuseTheDead(actor)) return false;

    if (item.getFlag(MODULE_ID, ITEM_FLAGS.category) === "truthBullet") {
        ui.notifications.warn(game.i18n.localize("DRPG.Vault.noBullets"));
        return false;
    }
    if (isStashed(item)) return false;

    // WHICH stash, not whether. A character may have one here, one in their
    // bedroom and none at all, and the thing goes in the one they are standing
    // over - stamped onto the item so nothing has to work it out again.
    const room = await myStashHere(actor);
    if (!room) {
        tellNotHere(actor);
        return false;
    }

    /*
     * A STASH HOLDS THREE (D10b).
     *
     * It held everything, which made the carry limits above it decorative: a
     * character with a full stash in their bedroom was carrying two things and
     * OWNING nine, and the question the limits exist to ask - what do you have
     * on you tonight - had a free answer waiting at home.
     *
     * Counted PER ROOM rather than per character, because that is what a stash
     * is: two hiding places are two hiding places, and somebody who has earned
     * a second one has earned what it holds.
     */
    // `stashItemsIn`, not a bare flag match. An item stashed before E11 has
    // no room stamp and belongs to the primary stash by the rule written on
    // `ITEM_FLAGS.stashRoom` - the rule `stashItemsIn` applies and this line
    // did not, so an old stash listed three things and still took a fourth
    // (audit A3).
    const here = stashItemsIn(actor, room, sceneOfActor(actor));
    if (here.length >= VAULT_LIMIT) {
        ui.notifications.warn(game.i18n.format("DRPG.Vault.full",
            { room, limit: VAULT_LIMIT }));
        return false;
    }

    try {
        await trustedWrite(item, {
            [`flags.${MODULE_ID}.${ITEM_FLAGS.location}`]: LOCATIONS.vault,
            // Put down as well as put away: a thing in a drawer is not in a
            // hand, and `retrieve` writes only the location back, so the
            // readied flag would otherwise come out of the stash with it.
            [`flags.${MODULE_ID}.equipped`]: false,
            [`flags.${MODULE_ID}.${ITEM_FLAGS.stashRoom}`]: room
        }, { reason: "stash" });
    } catch (err) {
        error("Could not stash the item", err);
        return false;
    }

    log(`${actor.name} stashed "${item.name}" in ${room}.`);
    return true;
}

/* WHERE THE STASH IS, NOT "YOUR OWN ROOM" (E14 part 2 C8; audit S08-48): a stash may be in the library as well as in a
   bedroom, and the line sent the player to their bedroom whatever. `room` is the stash the thing lies in (`retrieve`);
   with none, every room of this scene where the character keeps one (`stow`), and a sentence of its own when there is
   no such room. The character's own stashes: nothing here is anybody else's. Exported for the suite (E14 fix e1-G7). */
export function tellNotHere(actor, room = null) {
    const rooms = room ? [room] : stashRoomsFor(actor, sceneOfActor(actor)).map(entry => entry.room);
    ui.notifications.warn(rooms.length
        ? game.i18n.format("DRPG.Vault.notHere", { room: rooms.join(", ") })
        : game.i18n.localize("DRPG.Vault.noStashOnScene"));
}

/** True, and the player told, when `actor` is dead as this browser may know it (`stow`, `retrieve`). */
function refuseTheDead(actor) {
    if (!isDeadForGm(actor)) return false;
    ui.notifications.warn(game.i18n.format("DRPG.Items.deadHands", { name: actor.name }));
    return true;
}

/** Take something back out. The carry limit has a say on the way out. */
export async function retrieve(actor, item) {
    if (!actor || !item || !isStashed(item)) return false;
    if (refuseTheDead(actor)) return false;

    // In the room this particular thing is in - not merely in one of yours.
    // Two stashes and a shared "am I at a stash" test would let a player pull
    // something out of a drawer on the other side of the building.
    const here = await myStashHere(actor);
    const at = stashRoomOfItem(item, actor, sceneOfActor(actor));
    if (!here || at !== here) {
        tellNotHere(actor, at);
        return false;
    }

    const category = item.getFlag(MODULE_ID, ITEM_FLAGS.category);
    const room = canCarry(actor, category);
    if (!room.ok) {
        ui.notifications.warn(game.i18n.format("DRPG.Inventory.full", {
            category: capacityLabel(category),
            limit: room.limit
        }));
        return false;
    }
    // ONE IN A HAND, ONE STOWED, NEVER TWO STOWED, ON THE WAY OUT TOO (E14 part 1 C5; audit S08-36, D4). A piece that
    // would stand stowed past the group's limit with nothing of the group to hold ready - itself broken, every other
    // stowed piece broken too - stays in the stash; with a working one beside it, `keepGearShape` readies that.
    const group = ITEM_CATEGORIES[category]?.limitGroup;
    const maxStowed = group ? LIMIT_GROUPS[group]?.maxStowed : null;
    if (maxStowed !== null && maxStowed !== undefined) {
        const { stowedInGroup } = await import("./use-items.mjs");
        if (stowedInGroup(actor, group).length + 1 > maxStowed && !readyForShape(actor, item, group)) {
            ui.notifications.warn(game.i18n.format("DRPG.Vault.handFirst", { item: item.name, group: LIMIT_GROUPS[group].label }));
            return false;
        }
    }

    try {
        // The stash it was in goes with it: a carried item has no stash, and a
        // stale room name would decide where it lands if it is ever put back.
        await trustedWrite(item, {
            [`flags.${MODULE_ID}.${ITEM_FLAGS.location}`]: LOCATIONS.carried,
            [`flags.${MODULE_ID}.${ITEM_FLAGS.stashRoom}`]: null
        }, { reason: "retrieve" });
    } catch (err) {
        error("Could not take the item out of the stash", err);
        return false;
    }

    log(`${actor.name} took "${item.name}" out of their stash.`);
    // The shape rule on the way out of the stash too (D4).
    const { keepGearShape } = await import("./inventory.mjs");
    await keepGearShape(actor, item);
    return true;
}

/* ==========================================================================
 * SOMEBODY ELSE'S STASH
 * ========================================================================== */

/**
 * Whose stash is in the room this character is standing in, if it is open.
 *
 * "Open" means not concealed. A concealed stash is one its owner has built a
 * hiding place for - a project - and finding that is what the Search action's
 * own stash branch is for, at a penalty, with a roll. An unconcealed stash is
 * just a drawer in a bedroom: anyone who walks in can go through it, which is
 * exactly the pressure a killing game wants on leaving your things lying about.
 *
 * @returns {{owner: Actor, room: string, items: Item[]}|null}
 */
export function openStashesHere(actor) {
    if (!actor) return [];

    // `locateActor` is the module's one answer to "where is this actor" - it
    // already handles unlinked tokens, an empty region set and the geometric
    // fallback. A local re-implementation here was a third copy of that logic,
    // and a copy of a geometric test is a copy that drifts. Its scene is the one
    // the stashes are read on (E12 C6): until 1.2.74 they were read on the scene
    // on screen, so a GM's browser listed another map's stashes for a room of
    // the same name.
    const place = locateActor(actor);
    const room = place?.room ?? null;
    const scene = place?.scene ?? null;
    if (!room) return [];

    const mastermind = iAmTheMastermind();
    const out = [];
    for (const entry of stashesIn(room, scene)) {
        if (entry.actorId === actor.id) continue;         // yours is not a theft
        // Hidden: needs a Search - unless you are the Mastermind, to whom a
        // hiding place is furniture they watched being built (Dawid, 26.08).
        // The GM-side authority in `stealFromVault` makes the same exception.
        //
        // Or unless you FOUND it: `Analyze -> Locate a hidden stash` opens one
        // hiding place to one person, and after that it is simply a stash they
        // know about. See `resolveStashSearch`.
        if (entry.concealed && !mastermind
            && !hasFoundStash(actor, room, entry.actorId, scene)) continue;

        const owner = game.actors.get(entry.actorId);
        if (!owner) continue;
        out.push({ owner, room, items: stashItemsIn(owner, room, scene) });
    }
    return out;
}

/**
 * Compatibility: one stash, the way `game.drpg` has exported it since E1.
 *
 * Answers the first reachable one. Kept rather than deleted because a GM's
 * macro may call it, and a caller that only ever handled one stash is better
 * served by being handed one than by being handed an array it will index into
 * as if it were an object.
 */
export function openStashHere(actor) {
    return openStashesHere(actor)[0] ?? null;
}

/**
 * Go through an open stash and take one thing. No action, no roll.
 *
 * The write itself is GM-only - it touches two sheets - so it goes over the
 * same bridge the Search branch uses, and `stealFromVault` re-checks everything
 * on that side. This is the picker, not the authority.
 */
export async function rifleStashDialog(actor) {
    const stashes = openStashesHere(actor);
    if (!stashes.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Vault.noOpenStashHere"));
        return false;
    }

    const stocked = stashes.filter(entry => entry.items.length);
    if (!stocked.length) {
        ui.notifications.warn(game.i18n.format("DRPG.Vault.stashEmpty", {
            who: stashes.map(entry => entry.owner.name).join(", ")
        }));
        return false;
    }

    const room = stocked[0].room;
    const describe = i => {
        const tier = i.getFlag(MODULE_ID, ITEM_FLAGS.tier);
        const cat = ITEM_CATEGORIES[i.getFlag(MODULE_ID, ITEM_FLAGS.category)]?.label ?? "";
        return esc(`${i.name}${cat ? ` - ${cat}` : ""}${
            tier !== null && tier !== undefined ? ` (T${tier})` : ""}`);
    };

    /*
     * ONE LIST, GROUPED BY WHOSE IT IS.
     *
     * A room can hold several stashes now, and asking "whose drawer?" and then
     * "which thing?" would be two questions where the answer to the first is
     * visible in the second. So they are one `<select>` with an `<optgroup>`
     * per owner - and the owner id rides in the value, because the GM side has
     * to be told which sheet to take from and the item id alone cannot say.
     *
     * A single stash keeps its old shape exactly: one group, and a heading the
     * player can ignore.
     */
    const options = stocked.map(entry =>
        `<optgroup label="${esc(entry.owner.name)}">${entry.items.map(i =>
            `<option value="${entry.owner.id}:${i.id}">${describe(i)}</option>`
        ).join("")}</optgroup>`).join("");

    const picked = await DialogV2.wait({
        window: { title: game.i18n.format("DRPG.Vault.rifleTitle", { room }) },
        classes: ["drpg-panel"],
        content: dialogContent(`<form>
            <p>${game.i18n.format("DRPG.Vault.rifleIntro", {
                who: esc(stocked.map(entry => entry.owner.name).join(", ")),
                room: esc(room)
            })}</p>
            <label>${game.i18n.localize("DRPG.Items.whichItem")}
                <select name="item">${options}</select></label>
            <p class="notes">${game.i18n.localize("DRPG.Vault.rifleNote")}</p>
        </form>`),
        buttons: [
            {
                action: "take", label: game.i18n.localize("DRPG.Vault.take"), default: true,
                callback: (e, b, d) => d.element.querySelector("[name=item]").value
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    if (!picked || picked === "cancel") return false;

    const [ownerId, itemId] = String(picked).split(":");
    if (!ownerId || !itemId) return false;

    const { requestVaultSteal } = await import("./gm-bridge.mjs");
    const res = await requestVaultSteal({ thiefId: actor.id, ownerId, itemId });
    // A GM's own click settles as done with the refusal as its value, told already (E14 fix e1-G1).
    return res.ok && !res.value?.refused;
}

/**
 * ONE FREE REACH A TIME OF DAY (E14 part 1 C4, 24.10.2026; audit S08-06, the owner's D15: "jeden rifle na postac na
 * skrytke na pore dnia"). Until 1.2.83 the window said "Take one thing" and nothing counted: a player at an open
 * stash clicked Rifle again and again and carried it all off, free and unnoticed. `rifleKey` is a thief's row in the
 * GMs' store of reaches (gm-stores.mjs `rifleStore`): per stash, so a second stash in the same room is a reach of its
 * own, and by scene and room, so a same-named room on another map is another stash. `rifleMark` is the time of day
 * a reach was made in: the season's epoch (`seasonStartedAt`, as `seasonEpoch` reads it), so a reset that keeps the
 * rows does not carry the old season's first morning into the new one's, and the chapter, session, day and time of
 * day - not the phase, so an Investigation that opens in the afternoon does not open a stash the afternoon's Daily
 * Life already went through. Pure, but for `rifleMark`'s default: the clock as it stands.
 */
export function rifleKey(thiefId, ownerId, sceneId, room) {
    return `${thiefId}:${ownerId}:${sceneId ?? ""}:${room}`;
}

export function rifleMark(clock = getClock()) {
    return [clock?.seasonStartedAt ?? 0, clock?.chapter ?? 1, clock?.session ?? 0, clock?.day ?? 1, clock?.timeOfDay ?? ""].join(".");
}

/**
 * Take one thing out of a stash that is not yours. GM-side: it writes to the
 * owner's sheet and to the thief's.
 *
 * The item moves rather than being copied - this is theft, and the owner
 * noticing that something is missing is the entire point.
 *
 * AND UNTIL NOW THE OWNER WAS NEVER TOLD. The sentence above has been in this
 * file since it was written, the thief's own card said "They will notice it is
 * gone", and no code anywhere put that in front of the victim: the only whisper
 * went to the thief. `clumsy` is what closes it - see below.
 */
export async function stealFromVault({
    thiefId, ownerId, itemId, viaSearch = false, clumsy = false
} = {}) {
    if (!game.user.isGM) return null;

    const thief = game.actors.get(thiefId);
    const owner = game.actors.get(ownerId);
    const item = owner?.items?.get(itemId);
    /*
     * THE STASH'S OWN REFUSALS ARE TOLD TOO (E14 fix e1-G1, 24.10.2026; the review's E14R-3, E14R-03, E14R-06). Until this
     * fix each of them below returned nothing and was the GM's log alone: a player whose pick was taken out of the
     * stash, or hidden, or who walked out between opening the window and pressing Take, got no item and no word, as
     * the bridge had answered the packet already (S08-20). Each now hands the bridge a reason of the closed list:
     * `notThere` for a thief standing in no room, `missing` for everything about the stash and the thing - and a stash
     * of nobody's here, a hidden one not found and a thing not in the stash read alike, so a forged packet learns no
     * more of a hiding place than that nothing is there. The GM's log keeps which it was. A thief and an owner the
     * bridge names are characters (`owns`); an owner gone meanwhile is the closed list's own "no such character".
     * Measured: tier 2 "the rifle's own refusals are told".
     */
    if (!thief || !owner) return { refused: "no such character" };
    // Whether it is stashed, and where, is asked below of the item as the GMs hold it (fix r2-H17).
    if (!item) return { refused: "no such thing in that stash" };

    // The dead rob nobody, and nobody rifles a stash in an Eclipse or a Class Trial. A socket payload is a claim, and
    // this side is the one that decides: the one gate (inventory.mjs `transferRefusal`, mode "rifle"; E14 part 1 C1),
    // its refusal told to the thief by its code. The stash's own conditions are below.
    const { transferRefusal } = await import("./inventory.mjs");
    const barred = await transferRefusal(owner, thief, { mode: "rifle" });
    if (barred) {
        error(`Refused a stash theft by ${thief.name}: ${barred}.`);
        return { refused: barred };
    }

    /*
     * And you have to be standing in it.
     *
     * `rifleStashDialog` says in its own comment that "stealFromVault re-checks
     * everything on that side" - and this side checked that the item was stashed
     * and nothing else. Every condition that makes a stash a stash lived only in
     * the picker on the thief's own client, so a payload naming an owner and an
     * item id took anything from anyone: from across the map, from a stash the
     * thief had never found, from one still concealed by its owner's project.
     *
     * `locateActor`: this runs on a GM's client, which is usually looking at a
     * different scene from the theft, and a canvas-bound lookup - `roomOfActor`
     * was one until E12 C3 - would report the thief as standing nowhere and
     * refuse every honest attempt instead.
     */
    const { locateActor } = await import("./movement.mjs");
    const where = locateActor(thief);
    const refuse = why => {
        error(`Refused a stash theft by ${thief.name}: ${why}.`);
        return null;
    };

    if (!where?.room) {
        refuse("they are not standing in any room");
        return { refused: "the character is not standing in any room" };
    }

    /*
     * "IS THERE A STASH OF THEIRS HERE", not "is this their bedroom".
     *
     * These were the same question until E11 and are not any more: a stash
     * built in somebody else's room has no `drpgVaultOwner` pointing at its
     * owner, so the old test refused every theft from one as a forged packet -
     * the honest player would have been the only person it stopped.
     */
    const entry = stashIn(where.room, owner.id, where.scene);
    if (!entry) {
        refuse(`"${where.room}" holds no stash of ${owner.name}'s`);
        return { refused: "no such stash where the character stands" };
    }

    /*
     * Concealment is a gate on the FREE route only.
     *
     * Two things call this. `rifleStashDialog` is the drawer-in-a-bedroom case:
     * no action, no roll, and therefore no business opening a hiding place its
     * owner built a project for. The Search action is the other, and it is the
     * one the concealment penalty exists FOR - `performSearch` takes a step of
     * disadvantage (action-rolls.mjs `stashStep`) precisely because the stash is
     * hidden, spends a search token and an action, and only then asks for a
     * specific item.
     *
     * Refusing both left the paid route unable to produce anything at all: a
     * player could roll against a stiffer difficulty, succeed, be told what they
     * found, and receive nothing - while an unconcealed stash handed its
     * contents over for free. The guard was inverting the value of the project
     * that concealed it.
     *
     * `viaSearch` is a claim the sender makes, like the `total` on an Observe
     * and for the same reason: this side can verify who you are and where you
     * are standing, never what you spent. Forging it buys exactly what an honest
     * Search of the same room would have bought - the room and owner checks
     * above still bind - so it is worth no more than the action it skips.
     */
    if (!viaSearch && entry.concealed) {
        // The Mastermind's exception, verified on THIS side the way every
        // other claim in this function is: `isMastermind` reads the GM's own
        // synced copy of the pick, never anything the packet says.
        //
        // And the found-it exception, verified the same way: the flag is
        // written by a GM's client in `resolveStashSearch` and read here, so
        // "has to be found first" is exactly what it says.
        const { isMastermind } = await import("./mastermind.mjs");
        // The list as the GMs hold it (E16 part 2 C3; design-notes D10): a player's own write of it is put back
        // (sheet-audit.mjs `GM_FLAGS`), and read held it opens nothing while the put-back is on its way.
        if (!isMastermind(thief)
            && !hasFoundStash(await flagsAsHeld(thief), where.room, owner.id, where.scene)) {
            // Told as a stash nobody has here: the hiding place is not named to one who has not found it.
            refuse("that stash is concealed and has to be found first");
            return { refused: "no such stash where the character stands" };
        }
    }

    /*
     * THE ITEM AS THE GMS HOLD IT (E29 fix r2-H17, 06.10.2026): once every write queued on the owner has been judged,
     * its place, category, tier, roles, kind, broken and wear as the sheet audit's mark holds them (sheet-audit.mjs
     * `itemsAsHeld`, which says why the wait is enough here) - so neither a place nor roles, a tier or a mend the
     * owner's console wrote a moment before decide the theft. The gates below read it so; what moves, and the thief's
     * hands it is counted against (fix r2-H18), are read again by inventory.mjs `transferItem` after its own wait.
     */
    const { itemAsHeld, judgedFor, creationRefusal } = await import("./sheet-audit.mjs");
    await judgedFor(owner.id, thief.id);
    const held = await itemAsHeld(owner, item.id);
    if (!held || !isStashed(held)) {
        refuse(`"${item.name}" is not in a stash of ${owner.name}'s`);
        return { refused: "no such thing in that stash" };
    }

    // And the thing has to be in THAT stash, not merely in one of theirs
    // somewhere on the map - the same distinction `retrieve` makes.
    if (stashRoomOfItem(held, owner, where.scene) !== where.room) {
        refuse(`"${held.name}" is not in the stash in "${where.room}"`);
        return { refused: "no such thing in that stash" };
    }
    // An item the owner's player made that no GM has decided on yet is taken by nobody, and the thief told (E29 fix
    // r2-H21, sheet-audit.mjs `creationRefusal`).
    const undecided = creationRefusal(owner, held.id);
    if (undecided) {
        refuse(undecided);
        return { refused: undecided };
    }

    /*
     * ONCE A TIME OF DAY (E14 part 1 C4; D15). The drawer's free route only: a Search's find (`viaSearch`, which the
     * bridge reads off the GMs' record of the Search's roll - gm-bridge.mjs `searchTheftOf`) paid an action for its
     * reach, and neither asks the count nor writes it. The Mastermind is counted as anyone is: their exception is the
     * hiding place, not the hand. Asked after every wait above and stamped with no wait between, so of two reaches
     * served at once on one GM the second finds the first's stamp (read in the code; no test drives two at once); the
     * stamp is taken off again when nothing came out, so a reach that moved nothing - full hands and no stash, a piece
     * already gone - costs nothing (tier 2 E35-T10 rifles a stash into full hands, then again with a stash). The thief
     * is told `alreadyDone` (tier 2 E14-T5).
     */
    const { rifleStore } = await import("./gm-stores.mjs");
    const reach = viaSearch ? null : rifleKey(thief.id, owner.id, where.scene?.id, where.room);
    if (reach) {
        await rifleStore.whenHydrated();
        const mark = rifleMark();
        if (rifleStore.get(reach)?.at === mark) {
            refuse("that stash has been gone through already this time of day");
            /* The code's words are the closed list's, "That has already been settled.", which say neither what nor when
               (E14 fix e1-G1; the review's E14R-04): the thief's player is whispered both, beside the code. */
            await whisperToOwner(thief, `<p>${game.i18n.format("DRPG.Vault.rifledAgain",
                { who: foundry.utils.escapeHTML(owner.name) })}</p>`).catch(() => {});
            return { refused: "that stash has been gone through already this time of day" };
        }
        // The store's own copy takes the row as `patch` is called, before its save is awaited.
        await rifleStore.patch(reach, { at: mark });
    }
    const unreach = async () => { if (reach && rifleStore.get(reach)?.at === rifleMark()) await rifleStore.drop(reach); };

    /*
     * ON THE ONE ROAD (E35 C3; S17-16, S08-37, S08-34, S08-38): the copy, the count, the flags it carries - a ruined
     * thing lifted out of a drawer stays ruined, or hiding one there and having it lifted would launder a broken
     * murder weapon - and the hands it lands in are inventory.mjs `transferItem`'s. Full hands put it in the thief's
     * own stash (TRANSFER_POLICY.rifle), and only a thief with none is refused; one piece of a stack leaves the
     * stash; a key to a room the thief already holds leaves it and is not copied, the thief told; a piece the stash
     * keeps after the thief has its copy is told to the GMs. Unseen unless clumsy (`quiet`): the owner's open sheet
     * does not redraw for the piece leaving, as a Palm's unseen steal's does not (S08-34).
     */
    const { transferItem } = await import("./inventory.mjs");
    const name = held.name;
    const moved = await transferItem(owner, thief, held, { mode: "rifle", quiet: !clumsy });
    if (!moved?.ok) await unreach();
    // Refused by the one gate on its second asking (the lights went out meanwhile): told by its code, not as full hands.
    if (moved?.refused) return { refused: moved.refused };
    // Gone by its turn - another reach for the same piece took it first: told as a thing no longer there (E14 fix e1-G1).
    if (moved?.missing) return { refused: "no such thing in that stash" };
    if (!moved?.ok) {
        // Full hands and no stash of their own, or not written: the thief is told, or the Search card that follows
        // says "what comes out settles in a moment" and nothing ever does (ROLL-10).
        await whisperToOwner(thief, `<p>${game.i18n.localize("DRPG.Vault.handsFull")}</p>`).catch(() => {});
        return null;
    }
    // What the thief holds of it now: the copy, or under the key rule the key they already had.
    const copy = moved.copy ?? thief.items.find(i => i.getFlag(MODULE_ID, BEDROOM_KEY_FLAG) === moved.keyHeld) ?? null;

    await whisperToOwner(thief, `<p>${game.i18n.format("DRPG.Vault.stole", {
        item: foundry.utils.escapeHTML(name),
        who: foundry.utils.escapeHTML(owner.name)
    })}</p>`);

    /*
     * THE VICTIM, WHEN THE THIEF FUMBLED IT.
     *
     * Not every theft: a stash you already knew about and opened deliberately
     * stays silent, which is what makes finding one worth the action. Only a
     * Search that came up with Despair - the module's standing shorthand for
     * "you did it, badly" - leaves the drawer disturbed enough to notice.
     *
     * NO NAME, EVER, and not even a category. What arrives is "somebody has
     * been in here", because that is what an emptied hiding place tells you;
     * working out who is what Observe, Analyze and the trial are for.
     *
     * AND THE THIEF IS NOT TOLD THEY WERE SLOPPY. That is this module's rule
     * for every trace it drops, not a special case invented here: Hope and a
     * critical tell you what you left behind, a plain Despair never does. Which
     * is also why `DRPG.Vault.stole` no longer ends "They will notice it is
     * gone" - it said so unconditionally, and it was false in both directions.
     */
    if (clumsy) {
        try {
            await whisperToOwner(owner, `<p>${game.i18n.localize("DRPG.Vault.noticed")}</p>`, {
                flags: { [MODULE_ID]: { sfx: "stolen" } }
            });
        } catch (err) {
            // The item has already moved. A victim who was not told is the
            // state this shipped in; a theft that half-happened is not.
            error("Could not tell the owner their stash had been disturbed", err);
        }
    }

    log(`${thief.name} took "${name}" from ${owner.name}'s stash`
        + `${clumsy ? " and was clumsy enough to leave it showing" : ""}.`);
    return copy ?? true;
}


/* ==========================================================================
 * STEALING FROM A PERSON
 * --------------------------------------------------------------------------
 * The stash's sibling, and it lives here for one reason: this file is already
 * the module's authority on taking something that is not yours. `stealFromVault`
 * above owns the rules about hiding places; this owns the rules about pockets.
 * Both move an item between two sheets, both preserve what a transfer must not
 * mend, and both are GM-only for the same reason.
 * ========================================================================== */

/**
 * What `victim` carries, as the GMs hold it: the one pool a theft draws from and a Frisk lists (E80 part 2 C1, the
 * A11 design's step 4; S17-16, no further copy of it). Every write queued on the victim and on `asker` judged first
 * (sheet-audit.mjs `judgedFor`), then the victim's items as the GMs' mark holds them (`itemsAsHeld`), in the order of
 * the module's categories (`pocketsFrom`): no Truth Bullet, which is knowledge and not a thing in a pocket, and nothing
 * in a stash, whose very existence a pocket does not tell. `undecided` "drop" leaves out an item a player's browser
 * made that no GM has decided on yet (`creationRefusal`), with a line in the GM's log: a Frisk's list. A theft keeps it
 * in the draw, and refuses the theft when the draw takes it, so a pocket that holds only that one is not told empty.
 */
export async function pocketsAsHeld(victim, asker = null, { undecided = "keep" } = {}) {
    const { itemsAsHeld, creationRefusal } = await import("./sheet-audit.mjs");
    await judgedFor(victim?.id, asker?.id);
    const pockets = await itemsAsHeld(victim);
    return pocketsFrom(pockets, undecided === "drop" ? { undecided: item => creationRefusal(victim, item.id) } : {});
}

/**
 * The pool out of a list of items as held (`pocketsAsHeld`), with no read of its own: the module's categories in
 * `ITEM_CATEGORIES` order, never a Truth Bullet, never a stashed item (inventory.mjs `isStashed`), and, given
 * `undecided` (an item's reason or null), never an item it names, each such left out logged for the GM.
 */
export function pocketsFrom(items, { undecided = null } = {}) {
    const pool = Object.keys(ITEM_CATEGORIES)
        .filter(c => c !== "truthBullet")
        .flatMap(c => items.filter(i => i.getFlag(MODULE_ID, ITEM_FLAGS.category) === c && !isStashed(i)));
    if (!undecided) return pool;
    return pool.filter(item => {
        const why = undecided(item);
        if (why) log(`Left out of a list of what somebody carries: ${why}.`);
        return !why;
    });
}

/**
 * The card a Palm's victim reads when it noticed (`seen`): veiled (utils.mjs `whisperToOwner(..., { veiled: true })`),
 * so its document is addressed to every browser in nobody's voice, with the `stolen` sound for its reader. At a body the
 * GMs keep from the asker the same document is posted, its words to the GMs alone (`whisperToGms`): the body feels
 * nothing and no player reads it, and every browser gets the documents a living victim's Palm posts (E80 fix sec1-G1).
 *
 * A BODY THE GMS KEEP FROM THE ASKER (E80 fix sec1-G1, the review's sec-1; the owner's Q8, option A, 20.10.2026): dead
 * for the GMs, not published, and a death the asking user may not know (incident-store.mjs `knowsOfDeath`: not a GM,
 * not in the row's `known`, not the body's owner). Such a victim is taken from and planted on as a living one is, on
 * the same dice, so the thief's or planter's side reads as at a living victim; only the victim's card changes. Since
 * E14 part 1 C1 that is the one gate's reading (inventory.mjs `transferRefusal`, frisk.mjs `knownDeath`): a dead victim
 * it lets through is one kept from the asker, and one the asker knows dead - a GM's own Palm, with no asker, knows
 * every death - is refused, its road being the loot.
 */
async function tellPalmVictim(victim, html, { body = false } = {}) {
    const card = { veiled: true, flags: { [MODULE_ID]: { sfx: "stolen" } } };
    return body ? whisperToGms(html, card) : whisperToOwner(victim, html, card);
}

/**
 * Take something out of somebody's pockets. GM side.
 *
 * TWO NUMBERS ARRIVE, TWO VERDICTS ARE MADE HERE. The thief's client throws the
 * dice and names a victim; whether 14 was beaten, whether 15 was beaten, what
 * the pool actually contains and whether the victim is told are all decided on
 * this side against `ACTIONS.steal` - the same division of labour as Observe,
 * and for the same reason: the rule must live in one place, and it must not be
 * the place that benefits from the answer.
 *
 * @param {object} options
 * @param {string} options.thiefId
 * @param {string} options.victimId
 * @param {string|null} [options.itemId]   Honoured only on a critical.
 * @param {number} options.total           The Hand roll.
 * @param {boolean} [options.isCritical]
 * @param {number} options.unseenTotal     The Shadow roll.
 * @param {boolean} [options.unseenCritical]
 * @param {object} [context]
 * @param {User|null} [context.asker]     The user whose packet asked (gm-bridge.mjs `handleSteal`): a body the GMs keep
 *   from that user is robbed as a living victim is (inventory.mjs `transferRefusal`).
 */
export async function stealFromPerson({
    thiefId, victimId, itemId = null,
    total = 0, isCritical = false, unseenTotal = 0, unseenCritical = false
} = {}, { asker = null } = {}) {
    if (!game.user.isGM) return null;

    const thief = game.actors.get(thiefId);
    const victim = game.actors.get(victimId);
    if (!thief || !victim || thief.id === victim.id) return null;

    const refuse = why => {
        error(`Refused a theft by ${thief.name}: ${why}.`);
        return null;
    };

    /*
     * THE ONE GATE, BEFORE THE ROLLS ARE READ (E14 part 1 C1; audit S16-30, S08-20; the owner's Q3). The dead neither
     * rob nor are robbed - looting a body is a different action with different rules, see `requestBodyLoot` - save a
     * body the GMs keep from the asker, whose thief reads what a living victim's reads (`tellPalmVictim`); and you
     * have to be standing next to them, as the GMs read both (scene, floor and room: E12 C3, audit S08-39), neither a
     * Monocub nor a Monokuma, the victim on a token the GMs have not hidden, no Eclipse, no Class Trial, the thief no
     * side of the running incident: inventory.mjs `transferRefusal`, mode "steal", which `transferItem` asks again. Its
     * refusal is handed back to be told by its code, and the thief's browser gives back the action it paid (action-rolls
     * `performPalm`): nothing was read of the rolls. Until C1 each refusal here was the GM's log alone.
     */
    const { isDeadForGm } = await import("./chapter.mjs");
    const { transferRefusal } = await import("./inventory.mjs");
    const why = await transferRefusal(victim, thief, { mode: "steal", asker });
    if (why) {
        refuse(why);
        return { refused: why };
    }
    const body = isDeadForGm(victim);

    const def = ACTIONS.palm;
    const success = Boolean(isCritical) || Number(total) >= def.threshold;
    const seen = !(Boolean(unseenCritical) || Number(unseenTotal) >= def.unseen.threshold);

    /*
     * THE POOL IS REBUILT HERE, NOT TRUSTED (trap 92).
     *
     * What travels is an item id, and an id is a request. A packet naming a
     * Truth Bullet or something sitting in a stash has to be refused on this
     * side, because the only thing that stopped it on the other side was a
     * `<select>` built by the person who benefits from it being wrong.
     *
     * And the CHOICE is a critical's privilege. An ordinary success takes
     * whatever comes out - the id is ignored, not honoured quietly, because a
     * client that sends one on a non-critical is either out of date or trying
     * it on, and both deserve the same answer.
     *
     * OUT OF THE POCKETS AS THE GMS HOLD THEM (E29 fix r2-H17, 06.10.2026): the
     * victim's items once every write queued on them has been judged, each with
     * its place, category, tier, roles, kind, broken and wear as the sheet
     * audit's mark holds them (sheet-audit.mjs `itemsAsHeld`, which says why the
     * wait is enough here), in the order `carriedInCategory` gave. The pool is
     * `pocketsAsHeld`'s since E80 part 2 C1, the one a Frisk lists, and the
     * only one a theft reads: what moves and the thief's hands it is counted
     * against (fix r2-H18) are read again, by id, by inventory.mjs
     * `transferItem` after its own wait (E35 C3; the owner, 13.10: no further
     * copy of the pool).
     */
    const { creationRefusal } = await import("./sheet-audit.mjs");
    const pool = await pocketsAsHeld(victim, thief);

    let item = null;
    if (success && pool.length) {
        const wanted = isCritical ? pool.find(i => i.id === itemId) : null;
        item = wanted ?? pool[Math.floor(Math.random() * pool.length)];
    }
    /*
     * An item the victim's player made that no GM has decided on yet is taken by nobody (E29 fix r2-H21, sheet-audit.mjs
     * `creationRefusal`): the theft is refused before anything is written - nobody told of a hand that was or was not
     * seen - and the thief told, whether they named it on a critical or the draw took it. Left out of the draw instead,
     * a hand in a pocket holding only that would come out empty, and the thief would be told of an empty pocket.
     */
    const undecided = item ? creationRefusal(victim, item.id) : null;
    if (undecided) {
        refuse(undecided);
        return { refused: undecided };
    }

    // Nothing in their pockets is not a failure - the hand went in, and whether
    // it was noticed is still a live question. The two whispers below say so.
    const empty = success && !pool.length;

    /*
     * ON THE ONE ROAD (E35 C3; S17-16, S08-37, S08-38): the copy, the count, the
     * flags it carries - a stolen broken thing stays broken, a stolen crowbar
     * is still a weapon - and the hands it lands in are inventory.mjs
     * `transferItem`'s. Full hands put it in the thief's own stash
     * (TRANSFER_POLICY.steal), and only a thief with none comes away with
     * nothing, the item staying where it is; one piece of a stack moves; a key
     * to a room the thief already holds leaves the victim and is not copied.
     *
     * THE QUIET HALF IS STILL ONE OPTION (`quiet`, unseen): the piece leaves
     * the victim with `render: false`, which travels with the write over
     * Foundry's own socket, so their open sheet does not redraw for THIS
     * change. The item has really gone - they cannot use it, give it away or
     * find it again - and what is suppressed is the redraw, not the fact. A
     * sheet redraws for a great many other reasons (a resource moving,
     * Despair, an incident starting), so the row can come off the screen a
     * moment later: not "they will never see", but "they will not see because
     * of this" - trap 90. Clicking the stale row is handled where the rows are
     * drawn (trap 91). When they ARE told, the render goes ahead: a suppressed
     * refresh next to a whisper naming the thief is a way of losing one of the
     * two messages.
     */
    let moved = null;
    if (item) {
        const { transferItem } = await import("./inventory.mjs");
        moved = await transferItem(victim, thief, item, { mode: "steal", quiet: !seen, asker });
        /* The one gate asked again by the move refused it: the two parted, or the phase moved on, while the dice were
           read. Nothing moved and nobody is told of a hand. AFTER THE ROLLS (E14 fix e1-G4; the review's E14R-07): the
           owner's Q3 gives the action back for a refusal before the rolls are read, and this one comes after - the dice
           were read and paid out. Told as nothing carried out (the closed list's `refused`), not by the gate's code, so
           the thief's browser, which refunds on the gate's codes (action-rolls.mjs `TRANSFER_REFUSED`), keeps it spent;
           the GM's log keeps why. Read in the code: no test parts the two between the two askings. */
        if (moved?.refused) return { refused: `nothing was carried out: ${moved.refused}` };
    }
    // Not written (`failed`) is read as full hands, as a refused copy was before: the item stays where it is. Gone by
    // its turn (`missing`, a second hand after the same piece) comes away empty.
    const handsFull = Boolean(moved?.handsFull || moved?.failed);

    const took = Boolean(moved?.ok);

    // The thief always learns what happened to them, including whether they
    // were noticed - that is what the Shadow roll was for.
    await whisperToOwner(thief, `<p>${game.i18n.format(
        took ? "DRPG.Steal.cardTook"
            : handsFull ? "DRPG.Steal.cardHandsFull"
            : empty ? "DRPG.Steal.cardEmpty"
            : "DRPG.Steal.cardMissed",
        { item: esc(item?.name ?? ""), who: esc(victim.name) }
    )}</p><p><small>${game.i18n.localize(seen
        ? "DRPG.Steal.cardSeen" : "DRPG.Steal.cardUnseen")}</small></p>`);

    /*
     * THE VICTIM, AND ONLY WHEN THEY NOTICED.
     *
     * Named, unlike the stash's "somebody has been in here", and that asymmetry
     * is the point of the two rolls. An emptied hiding place is discovered
     * later, by its owner, with nothing to go on; a hand in your pocket is
     * something you catch somebody doing. So this says who - and, when they
     * actually got something, what.
     *
     * Both failures are worth telling. Being caught trying is one of the better
     * scenes this action produces, and a Shadow roll that answers "did they
     * notice you" has to be allowed to answer it about an attempt.
     *
     * Veiled since E80 fix sec1-G1, and at a body the GMs keep its words go to
     * the GMs alone (`tellPalmVictim`).
     */
    if (seen) {
        try {
            await tellPalmVictim(victim, `<p>${game.i18n.format(
                took ? "DRPG.Steal.caughtTaking" : "DRPG.Steal.caughtTrying",
                { who: esc(thief.name), item: esc(item?.name ?? "") }
            )}</p>`, { body });
        } catch (err) {
            error("Could not tell the victim of a theft", err);
        }
    }

    log(`${thief.name} ${took ? "took" : "failed to take"} `
        + `${took ? `"${item.name}" ` : ""}from ${victim.name}`
        + `${seen ? " and was seen" : " unseen"}${body ? ", a body the GMs keep, as a living victim (its card's words to the GMs alone)" : ""}.`);

    return { took, seen, item: item?.name ?? null, handsFull, empty };
}



/**
 * Leave something in somebody's pocket. GM side, and the mirror of the theft
 * directly above - same two axes, same two numbers, the item travelling the
 * other way.
 *
 * WHY IT DESERVES ITS OWN FUNCTION rather than a `direction` flag on the one
 * above: every guard reads differently. The pool is the PLANTER'S, the carry
 * limit that can refuse is the VICTIM'S, and "their hands are full" means the
 * item stays where it started rather than vanishing. A shared body with four
 * conditionals in it would be the same code twice with the harder half hidden.
 *
 * @param {object} options
 * @param {string} options.plannerId
 * @param {string} options.victimId
 * @param {string} options.itemId       Chosen before the roll, out of their own
 *   pockets - no critical branch, because there is nothing left to choose.
 * @param {number} options.total        The Hand roll.
 * @param {number} options.unseenTotal  The Shadow roll.
 * @param {object} [context]
 * @param {User|null} [context.asker]   The user whose packet asked (gm-bridge.mjs `handlePlant`): a body the GMs keep
 *   from that user is planted on as a living victim is (inventory.mjs `transferRefusal`).
 */
export async function plantOnPerson({
    plannerId, victimId, itemId = null,
    total = 0, isCritical = false, unseenTotal = 0, unseenCritical = false
} = {}, { asker = null } = {}) {
    if (!game.user.isGM) return null;

    const planter = game.actors.get(plannerId);
    const victim = game.actors.get(victimId);
    const item = planter?.items?.get(itemId ?? "");
    if (!planter || !victim || planter.id === victim.id || !item) return null;

    const refuse = why => {
        error(`Refused a plant by ${planter.name}: ${why}.`);
        return null;
    };

    // Planting evidence on a corpse is a real thing somebody will want to do, and it is not this action: a body is not
    // carrying anything any more, and the crime scene has its own rules - save a body the GMs keep from the asker, whose
    // planter reads what a living victim's reads. That, the room and the person are the one gate's, mode "plant", as a
    // theft's (E14 part 1 C1: inventory.mjs `transferRefusal`), asked before the rolls are read and told by its code.
    const { isDeadForGm } = await import("./chapter.mjs");
    const { transferRefusal } = await import("./inventory.mjs");
    const why = await transferRefusal(planter, victim, { mode: "plant", asker });
    if (why) {
        refuse(why);
        return { refused: why };
    }
    const body = isDeadForGm(victim);

    /*
     * THE POOL IS REBUILT HERE, exactly as it is for a theft (trap 92) - and
     * the same two exclusions, for the same reasons read backwards. A Truth
     * Bullet cannot be planted because it is knowledge rather than an object,
     * and something in a stash cannot be planted because it is not in a hand.
     * Out of the pockets as the GMs hold them, as a theft's (E29 fix r2-H17):
     * what lands on the victim is never roles, a tier or a mend the planter's
     * console wrote a moment before asking. The pool is `pocketsAsHeld`'s, a
     * theft's read the other way (E35 C3; the copy of it written here went, the
     * owner's 13.10: no further copy); the victim's hands, as the GMs hold them
     * (fix r2-H18), are inventory.mjs `transferItem`'s to count.
     */
    const { creationRefusal } = await import("./sheet-audit.mjs");
    const pool = await pocketsAsHeld(planter, victim);
    const held = pool.find(i => i.id === item.id);
    if (!held) {
        return refuse(`"${item.name}" is not something they are carrying`);
    }
    // An item the planter's player made that no GM has decided on yet goes into nobody's pocket, and the planter told
    // (E29 fix r2-H21, sheet-audit.mjs `creationRefusal`) - before the rolls are read, so nobody is told of a hand seen.
    const undecided = creationRefusal(planter, held.id);
    if (undecided) {
        refuse(undecided);
        return { refused: undecided };
    }

    // THE PLANT BARS, NOT THE STEAL ONES (ACT-01, 17.09). The player's client
    // measured against `def.plant` - D10a, planting is easier on both axes - and
    // this side, which is the one that decides, measured against the theft's:
    // an 8 or 9 failed to plant and a 13 or 14 was seen, with the victim told
    // they had caught somebody. Same `??` as the client, so the two cannot drift.
    const def = ACTIONS.palm;
    const bar = def.plant?.threshold ?? def.threshold;
    const unseenBar = def.plant?.unseen ?? def.unseen.threshold;
    const success = Boolean(isCritical) || Number(total) >= bar;
    const seen = !(Boolean(unseenCritical) || Number(unseenTotal) >= unseenBar);

    /*
     * ON THE ONE ROAD (E35 C3; S17-16, S08-37): the copy, the count and the flags
     * it carries are inventory.mjs `transferItem`'s - a planted broken thing
     * stays broken, which is most of the point: the best use of this action is
     * getting a ruined murder weapon out of your own pocket and into somebody
     * else's, worth nothing if the transfer mended it. One piece of a stack.
     *
     * FULL POCKETS REFUSE IT (D42, the owner's option 1; S17-15, S08-41). It went
     * into the victim's stash and whispered them that their hands were full, so
     * an unseen Plant told its victim what it was, and the planter read that it
     * was in their pocket. Now the item stays with the planter, who is told so,
     * and the victim is told nothing - seen or not, stash or none: no card, no
     * write, nothing to redraw (TRANSFER_POLICY.plant).
     *
     * The quiet half, and the mirror of the silent Steal (`quiet`, unseen): the
     * victim's sheet does not redraw FOR THIS, and nothing on the way in speaks
     * to them - not a key they hold already, not the Gear shape (inventory.mjs
     * `keepGearShape`, S08-02).
     */
    let moved = null;
    if (success) {
        const { transferItem } = await import("./inventory.mjs");
        moved = await transferItem(planter, victim, held, { mode: "plant", quiet: !seen, asker });
        // As a theft's: the gate asked again by the move, after the rolls, nothing moved, the action kept spent (Q3; fix e1-G4).
        if (moved?.refused) return { refused: `nothing was carried out: ${moved.refused}` };
    }
    // Not written (`failed`) is read as full pockets, as a refused copy was before: the item stays with the planter.
    // Gone by its turn (`missing`, a second Plant of the same piece) did not go in.
    const handsFull = Boolean(moved?.handsFull || moved?.failed);
    const landed = Boolean(moved?.ok);

    const done = landed;

    await whisperToOwner(planter, `<p>${game.i18n.format(
        done ? "DRPG.Steal.cardPlanted"
            : handsFull ? "DRPG.Steal.cardTheirHandsFull"
            : "DRPG.Steal.cardPlantMissed",
        { item: esc(item.name), who: esc(victim.name) }
    )}</p><p><small>${game.i18n.localize(handsFull ? "DRPG.Steal.cardUnfelt"
        : seen ? "DRPG.Steal.cardSeen" : "DRPG.Steal.cardUnseen")}</small></p>`);
    // FULL POCKETS: NO "THEY NOTICED" (E35 fix e1-G3; the review's E35-R1). A missed Shadow roll into full pockets told
    // the planter "They noticed." while D42 tells the victim nothing - the planter played a scene of being caught that
    // the victim's player knew nothing of (E35-T6's seen rows, at 78457d7: the card read "... It stays with you.They
    // noticed."). The pocket was never reached, so the line says the victim felt nothing, seen or not.

    /*
     * AND THE VICTIM, ONLY WHEN THEY NOTICED - with the item named.
     *
     * The asymmetry with a theft is worth stating: a stolen thing is missed
     * later, so the silent case has a natural discovery. A planted thing has
     * none - nobody audits their own pockets for things that should not be
     * there - which is exactly what makes the unnoticed plant worth an action,
     * and exactly why the noticed one has to be unambiguous.
     *
     * NOT WHEN THEIR POCKETS WERE FULL (D42): the owner's answer gives that victim no whisper, seen or not.
     */
    if (seen && !handsFull) {
        try {
            await tellPalmVictim(victim, `<p>${game.i18n.format(
                done ? "DRPG.Steal.caughtPlanting" : "DRPG.Steal.caughtTryingPlant",
                { who: esc(planter.name), item: esc(item.name) }
            )}</p>`, { body });
        } catch (err) {
            error("Could not tell the victim of a plant", err);
        }
    }

    log(`${planter.name} ${done ? "planted" : "failed to plant"} `
        + `"${item.name}" on ${victim.name}${seen ? " and was seen" : " unseen"}${
            body ? ", a body the GMs keep, as a living victim (its card's words to the GMs alone)" : ""}.`);

    return { done, seen, item: item.name, handsFull };
}

/* ==========================================================================
 * FINDING A HIDING PLACE
 * --------------------------------------------------------------------------
 * `Analyze -> Locate a hidden stash` (E12, automated 28.08). A concealed stash
 * is invisible to everybody but its owner and the Mastermind; beating 16 on a
 * Head roll opens ONE of them to ONE person, permanently.
 *
 * WHERE THE RECORD LIVES, and why on the finder rather than on the room.
 * Either is world data and therefore readable from any console - this module
 * has no secrets from a determined player, and never claims to. What differs is
 * where somebody looks by accident: a flag on the region is on the screen the
 * owner opens to check their own room, while a flag on the finder's sheet is
 * somewhere the owner has no reason to be. Same leak on paper, a different one
 * in practice.
 *
 * WRITTEN BY A GM'S CLIENT, though the finder owns their own actor and could
 * write it themselves. The write is the only thing standing between "rolled a
 * 16" and "reads other people's hiding places", so it goes the same way every
 * other verdict in this module goes - see `resolveStashSearch`.
 * ========================================================================== */

/** One key per stash, so two stashes in one room stay separate. */
function foundKey(room, ownerId, scene) {
    return `${scene?.id ?? "?"}::${room}::${ownerId}`;
}

/** Has this character already found that hiding place? */
export function hasFoundStash(actor, room, ownerId, scene) {
    const found = actor?.getFlag?.(MODULE_ID, VAULT_FLAGS.found);
    return Array.isArray(found) && found.includes(foundKey(room, ownerId, scene));
}

/** Everything this character has found, for the GM screen and the tests. */
export function stashesFoundBy(actor) {
    const found = actor?.getFlag?.(MODULE_ID, VAULT_FLAGS.found);
    return Array.isArray(found) ? [...found] : [];
}

/**
 * Score a search for a hiding place, and open one if it worked. GM side.
 *
 * The threshold is `ACTIONS.analyze.stashThreshold`, read here rather than sent,
 * for the same reason every other number in this module is: the rule lives in
 * one place and it is not the client that benefits from the answer.
 *
 * WHAT A SUCCESS IS WORTH, precisely: one stash, the first concealed one in the
 * room with something in it, and if none of them holds anything then the first
 * concealed one at all. Not "every stash here" - a room can hold several, and
 * one roll opening all of them would make the second one free.
 *
 * A miss and an empty room are told apart for the FINDER and not for anybody
 * else: "you found nothing" is what an action buys, and it is the same sentence
 * whether the room was empty or the dice were bad. Saying which would answer the
 * question the next attempt is for.
 *
 * THE HUNT IS TOLD HERE (E80 fix r1-G1, 18.10.2026; the review's E80-SEC-1). A trap
 * watching for a stash hunt fires on every attempt, before the roll is scored
 * (Dawid, 28.08); until that fix the finder's own browser raised it (action-rolls.mjs
 * `locateStash`), so a console that asked for the search without raising it hunted
 * past every trap. It is raised here, on the GM that judges the search, for the room
 * this GM reads the finder in - a non-primary GM's own search relays it to the primary
 * as a GM's report (traps.mjs). A Reroll's replay (`replay`, reroll.mjs
 * `settleStashFind`) is the same attempt, and no second hunt. `hunted` is the suite's.
 *
 * THE REPLAY SEARCHES WHERE THE ROLL WAS THROWN (E80 fix r1-G4, 19.10.2026; the review's
 * E80-G-1 = E80-COR-2). Every first search answers where it searched (`place`: scene, room
 * and floor ids), which the GMs keep with their facts on its roll (`findPlace`: gm-bridge.mjs
 * `handleFindStash`, a GM's own action-rolls.mjs `locateStash`). A replay handed that place
 * (`at`) searches it only while the GMs still read the character there (movement.mjs
 * `gmPlaceOf`), and answers noRoom otherwise - and for `at` null, a row written before the
 * place was kept - so its Reroll is given back whole. Until then it searched wherever the
 * character stood at the Reroll: a miss in an empty room, rerolled after a walk into another
 * student's bedroom, opened the stash hidden there, where no Analyze was paid or thrown and
 * no trap watching for a hunt was told.
 *
 * NO HUNT IN A CLASS TRIAL (E16 part 2 C3, 26.10.2026; audit S02-70, the owner's D16: "odmawia choice 'hint' i 'stash'
 * w classTrial, także z pakietu"). In a trial Analyze only identifies Truth Bullets, and its picker no longer offers the
 * hunt (action-rolls.mjs `ANALYZE_TRIAL_FILTER`) - but a console's packet, a GM's own call and a Reroll of a hunt thrown
 * before the trial all come here, so here is where it is refused, on this GM's clock, before the throw is read: no trap
 * told, nothing whispered, nothing written. `{ refused }`, told by the bridge as `trialLocked` (gm-bridge.mjs
 * `handleFindStash`, `requestStashSearch`), and a Reroll's replay is given back whole (reroll.mjs `settleStashFind`).
 */
export async function resolveStashSearch({ actorId, total = 0, isCritical = false, replay = false, at = undefined } = {},
    { hunted = event => Hooks.callAll("drpgStashHunted", event) } = {}) {
    if (!game.user.isGM) return null;
    if (getClock()?.phase === "classTrial") return { refused: "the Class Trial is in session" };

    const actor = game.actors.get(actorId);
    if (!actor) return null;
    // What the finder has found, as the GMs hold it (E16 part 2 C3; design-notes D10): the list is a GM's flag
    // (sheet-audit.mjs `GM_FLAGS`), and a write of the finder's own waiting for its put-back is neither a find this
    // search skips nor a note carried into the GMs' write below.
    const held = await flagsAsHeld(actor);

    const { locateActor, gmPlaceOf } = await import("./movement.mjs");
    const floor = level => level?.id ?? level ?? null;
    let where = null;
    if (replay && at !== undefined) {
        const held = at && typeof at.sceneId === "string" && at.sceneId && typeof at.room === "string" && at.room ? at : null;
        const now = held ? gmPlaceOf(actor, { sceneId: held.sceneId }) : null;
        const still = Boolean(now?.room) && now.scene?.id === held.sceneId && now.room === held.room
            && floor(now.level) === (typeof held.level === "string" ? held.level : null);
        if (!still) return { found: false, reason: "noRoom" };
        where = now;
    } else where = locateActor(actor);
    // A finder standing in no room paid an Analyze and was told nothing (S08-20; E14 part 1 C1): told what a search that
    // finds nothing is told. A Reroll's replay of a search made elsewhere is given back whole by its caller instead.
    if (!where?.room) {
        if (!replay) await whisperToOwner(actor, `<p>${game.i18n.localize("DRPG.Analyze.stashNothing")}</p>`);
        return { found: false, reason: "noRoom" };
    }
    const place = { sceneId: where.scene?.id ?? null, room: where.room, level: floor(where.level) };

    if (!replay) hunted({ actor, room: where.room });

    const beat = Boolean(isCritical) || Number(total) >= (ACTIONS.analyze?.stashThreshold ?? 16);
    if (!beat) {
        await whisperToOwner(actor, `<p>${game.i18n.localize("DRPG.Analyze.stashNothing")}</p>`);
        return { found: false, reason: "missed", place };
    }

    // Yours is not a discovery, and one already found is not a second one.
    const here = stashesIn(where.room, where.scene)
        .filter(e => e.concealed && e.actorId !== actor.id)
        .filter(e => !hasFoundStash(held, where.room, e.actorId, where.scene));

    let target = null;
    for (const entry of here) {
        const owner = game.actors.get(entry.actorId);
        if (!owner) continue;
        if (!target) target = { entry, owner };
        if (stashItemsIn(owner, where.room, where.scene).length) { target = { entry, owner }; break; }
    }

    if (!target) {
        await whisperToOwner(actor, `<p>${game.i18n.localize("DRPG.Analyze.stashNothing")}</p>`);
        return { found: false, reason: "none", place };
    }

    const found = stashesFoundBy(held);
    found.push(foundKey(where.room, target.owner.id, where.scene));
    await actor.setFlag(MODULE_ID, VAULT_FLAGS.found, found);

    await whisperToOwner(actor, `<p>${game.i18n.format("DRPG.Analyze.stashFound", {
        who: esc(target.owner.name), room: esc(where.room)
    })}</p>`);

    /*
     * THE OWNER IS NOT TOLD, and that is the rule this action was written with
     * - "bez powiadamiania właściciela". Being found out is something they
     * discover when something goes missing, which is `stealFromVault`'s job and
     * has its own Despair test.
     *
     * The GMs are told, because a hiding place opening is a fact about the
     * chapter and the one person who has to be able to narrate it is not on
     * either side of it.
     */
    await whisperToGms(`<p>${game.i18n.format("DRPG.Analyze.stashFoundGm", {
        finder: esc(actor.name), who: esc(target.owner.name), room: esc(where.room), total
    })}</p>`);

    log(`${actor.name} found ${target.owner.name}'s hidden stash in ${where.room} (rolled ${total}).`);
    return { found: true, owner: target.owner.name, room: where.room, place };
}

/* ==========================================================================
 * GM SETUP
 * ========================================================================== */

/**
 * One screen for everything a room IS.
 *
 * Whose bedroom it is, whether the stash in it is hidden, what searching it
 * draws from, what it is a good place to search for - and, since they are the
 * same kind of question asked of the same regions on the same evening, which
 * rests it allows. Those two used to be separate dialogs on separate GM-panel
 * entries, which meant setting up a map was a lap of the panel per room rather
 * than one pass down a table.
 *
 * Every column is a region flag written when the map is built. `rest.mjs` still
 * owns the two rest flags and their readers; this only edits them.
 */
/**
 * Write the live search-token count into every cell that has one.
 *
 * Read from `SearchTokens` rather than from the cell, so a spend that arrived from a
 * player's client is reflected instead of overwritten - which is the whole point of
 * having this run on somebody else's write as well as on the GM's own.
 */
function recountTokenCells(root, scene) {
    for (const cell of root.querySelectorAll("[data-drpg-tokens]")) {
        const left = SearchTokens.left(cell.dataset.drpgTokens, scene);
        const text = String(left);
        if (cell.textContent !== text) cell.textContent = text;
    }
}

/*
 * ROOMS DOWN, PEOPLE ACROSS - the same way round as every other tab here.
 *
 * It used to be the other way, and it was the only table in the window that
 * was: rooms across the top, students down the side. With eighteen rooms the
 * headings had to be stood on end to fit, and a column heading you read by
 * tilting your head is one you read twice.
 *
 * The shape decides it. A cast is four to eight; a map is six to thirty-six.
 * The long axis belongs to the side that scrolls, and the short one to the
 * side that has to stay on screen - so rooms are rows and people are columns
 * whose names lie down and read at a glance.
 *
 * THE INPUT NAMES DO NOT CHANGE. `fog:${room}:${actorId}` carries both
 * coordinates, so Apply reads the same form it always did and never learns
 * which way the table was laid out.
 */
function fogMatrixRows(rooms, students, known) {
    return rooms.map(room => {
        const escRoom = foundry.utils.escapeHTML(room);
        // Both coordinates, as the input's name has them: a screen reader walking the
        // grid hears "Big IT Room - Player A", not "checkbox" seventy-two times.
        const boxes = students.map(actor =>
            `<td style="text-align:center"><input type="checkbox"
                aria-label="${escRoom} - ${foundry.utils.escapeHTML(actor.name)}"
                name="fog:${escRoom}:${actor.id}" ${
                known.get(actor.id)?.has(room) ? "checked" : ""} /></td>`).join("");
        return `<tr><td><strong>${escRoom}</strong></td>${boxes}</tr>`;
    }).join("");
}

/* One column heading per student, for the two matrices. On one line and cut with an ellipsis
   where the column ends, the whole name in the title (E12 C15, audit S12-23): the audit read the
   student columns at 52-79 px beside a 1030 px Room column, and the names broke over two and three
   lines, each aligned differently. */
function studentHeads(students) {
    return students.map(a => {
        const name = foundry.utils.escapeHTML(a.name);
        return `<th class="drpg-student-head" title="${name}">${name}</th>`;
    }).join("");
}

/*
 * THE STASH MATRIX. Same shape as the Fog one above - rooms down, students
 * across - because four tables that look alike read as one window.
 *
 * ONE BUTTON PER CELL, NOT TWO CHECKBOXES. A stash cell carries two facts
 * ("is there one" and "is it hidden") and the obvious encoding is a pair of
 * boxes. At eight students and twelve rooms that is 192 targets to hit, half
 * of which are meaningless - "hidden" on a room with no stash - so the cell
 * cycles through the three states that actually exist instead.
 *
 * The state lives in a hidden input rather than on the button, because Apply
 * reads this form by input NAME and knows nothing about how the cell was
 * drawn - the same contract the fog matrix keeps.
 */
const STASH_GLYPHS = {
    "": '<span class="drpg-stash-none">-</span>',
    open: '<i class="fa-solid fa-box-open"></i>',
    hidden: '<i class="fa-solid fa-box"></i><i class="fa-solid fa-lock drpg-stash-lock"></i>'
};

function stashState(room, actorId, scene) {
    const entry = stashIn(room, actorId, scene);
    if (!entry) return "";
    return entry.concealed ? "hidden" : "open";
}

function stashGlyph(state) {
    return STASH_GLYPHS[state] ?? STASH_GLYPHS[""];
}

/* The three states a stash cell cycles, drawn with the cells' own glyphs above the table (E12 C15,
   audit S12-23: the icons had no legend, and the dash of an empty cell was all but invisible). */
function stashLegend() {
    const STATES = [["", "DRPG.Vault.stashNone"], ["open", "DRPG.Vault.stashOpen"], ["hidden", "DRPG.Vault.stashHidden"]];
    return `<p class="drpg-stash-legend" data-drpg-stash-legend>${STATES.map(([state, key]) =>
        `<span data-drpg-stash-state="${state}">${stashGlyph(state)} ${game.i18n.localize(key)}</span>`).join("")
    }<span><span class="drpg-stash-swatch"></span> ${game.i18n.localize("DRPG.Vault.stashOwnBedroom")}</span></p>`;
}

/*
 * A room's place for one category: neither, good or bad (E12 C15) - see `placeSwitches` in
 * `roomCells`. The button says its state three ways, because each reader needs a different one:
 * the glyph and the colour for the eye, the words in its accessible name for a screen reader, and
 * `data-drpg-place` for the click that moves it on.
 */
const PLACE_STATES = {
    "": { glyph: "fa-regular fa-circle", key: "DRPG.Vault.placeNeither" },
    good: { glyph: "fa-solid fa-thumbs-up", key: "DRPG.Vault.favours" },
    bad: { glyph: "fa-solid fa-thumbs-down", key: "DRPG.Vault.hinders" }
};

function placeToggle(state, label) {
    const { glyph, key } = PLACE_STATES[state] ?? PLACE_STATES[""];
    const name = foundry.utils.escapeHTML(label);
    return `<button type="button" class="drpg-place-toggle" data-drpg-place="${state}" data-drpg-label="${name}"
        aria-label="${name}: ${foundry.utils.escapeHTML(game.i18n.localize(key))}"
        title="${foundry.utils.escapeHTML(game.i18n.localize("DRPG.Vault.placeCycle"))}"><i class="${glyph}"></i> ${name}</button>`;
}

function stashMatrixRows(rooms, students, scene) {
    return rooms.map(room => {
        const escRoom = foundry.utils.escapeHTML(room);
        const bedroomOwner = vaultOwnerOf(room, scene);
        const cells = students.map(actor => {
            const state = stashState(room, actor.id, scene);
            // The bedroom owner's CELL is shaded - one per bedroom row, not a column -
            // so a GM can see at a glance which stash appeared by itself when they
            // assigned the room (the legend above the table says so, E12 C15).
            const own = bedroomOwner === actor.id ? " drpg-stash-bedroom" : "";
            return `<td class="drpg-stash-cell${own}">
                <input type="hidden" name="stash:${escRoom}:${actor.id}" value="${state}" />
                <button type="button" class="drpg-stash-toggle"
                    data-drpg-stash="${escRoom}:${actor.id}"
                    title="${foundry.utils.escapeHTML(
                        game.i18n.localize("DRPG.Vault.stashCycle"))}">${stashGlyph(state)}</button>
            </td>`;
        }).join("");
        return `<tr><td><strong>${escRoom}</strong></td>${cells}</tr>`;
    }).join("");
}

/* One pass gathers every fact about a room; the tabs then deal the same
 * cells into four thematic tables. The input NAMES are the contract with
 * the Apply callback below, identical whichever table a cell sits in -
 * Apply reads the whole form and never asks which tab was showing. */
function roomCells(rooms, { students, tables, categories, regions, scene, maxTokens, REST_FLAGS }) {
    return rooms.map(room => {
        // Off the pieces the form writes back (E12 C2a): the room readers read rooms only, and
        // this window lists every named region so that a GM can make one a room - a cell read
        // through them would show a region that is no room yet as empty, and Apply clear it.
        // Every piece that can be a room, read as one (E12 fix r1-G1, 11.10.2026; review round 1
        // EARLY-C2a-1, EARLY-C2a-2): until then the cells read the LAST region of the name - a
        // Teleport's, or a piece drawn after the room was set up - so they showed the room
        // unowned, unlocked and unsealed while the rules read it locked, and Apply wrote that.
        const pieces = regions.get(room) ?? [];
        const owner = flagOver(pieces, VAULT_FLAGS.owner) ?? "";
        const table = flagOver(pieces, VAULT_FLAGS.table) || "";
        const favours = listOver(pieces, VAULT_FLAGS.favours);
        const hinders = listOver(pieces, VAULT_FLAGS.hinders);
        // NOT `esc`: every other file in this module uses that name for the
        // escaping FUNCTION, so a local string by the same name here means the
        // next `esc(x)` written inside this block is a TypeError.
        const escRoom = foundry.utils.escapeHTML(room);
        const picture = safeRoomImage(flagOver(pieces, VAULT_FLAGS.image));
        const pickLabel = foundry.utils.escapeHTML(game.i18n.localize("DRPG.Vault.imagePick"));
        const clearLabel = foundry.utils.escapeHTML(game.i18n.localize("DRPG.Vault.imageClear"));

        const people = students.map(a =>
            `<option value="${a.id}"${a.id === owner ? " selected" : ""}>${
                foundry.utils.escapeHTML(a.name)}</option>`).join("");
        const tableOptions = tables.map(t =>
            `<option value="${foundry.utils.escapeHTML(t)}"${t === table ? " selected" : ""}>${
                foundry.utils.escapeHTML(t)}</option>`).join("");
        /*
         * ONE SWITCH A CATEGORY, THREE STATES (E12 C15, audit S08-26). This was the same set of
         * category boxes twice, in a "Good place" and a "Bad place" column, so a category could be
         * ticked as both and a render hook had to untick the other side. Now one button a category
         * cycles neither -> good -> bad, as a stash cell cycles its three states. The two boxes are
         * still in the cell, hidden, under the names Apply has always read (`fav:` and `hin:`); the
         * button ticks at most one of them, so the form posts the same names and values as before
         * and `readRoomSetupForm` is unchanged. A stored row holding a category in both lists is
         * drawn as good, which is what Apply's own filter has always kept of it.
         */
        /* The two boxes are hidden, and still controls: a11y.mjs `CONTROLS` reads a checkbox with the
           `hidden` attribute as one, and a reader that reaches it reads it out. With no name they
           turned both control-name sweeps of tier 2 red - "every standing GM window names every
           control it draws" counted 48 unnamed on Floor 1's Room Setup (harness, 19abd42 with this
           commit's tests, 11.10.2026; E12 fix r2-S2, review EARLY-C15-1). Each is named as `named`
           below names a column - "Good place to look for: Usable: Big IT Room". */
        const boxName = (key, label) => ` aria-label="${foundry.utils.escapeHTML(game.i18n.localize(key))}: ${
            foundry.utils.escapeHTML(label)}: ${escRoom}"`;
        const placeSwitches = categories.map(([key, cat]) => {
            const state = favours.includes(key) ? "good" : hinders.includes(key) ? "bad" : "";
            return `<span class="drpg-place-switch">
                <input type="checkbox" hidden class="drpg-place-box" name="fav:${escRoom}:${key}"${
                    boxName("DRPG.Vault.favours", cat.label)}${state === "good" ? " checked" : ""} />
                <input type="checkbox" hidden class="drpg-place-box" name="hin:${escRoom}:${key}"${
                    boxName("DRPG.Vault.hinders", cat.label)}${state === "bad" ? " checked" : ""} />
                ${placeToggle(state, cat.label)}</span>`;
        }).join("");

        /* A NAME A SCREEN READER CAN SAY (21.09). A control in a table row is named by
           its column header only for the eye; 1.2.47's a11y sweep found these with no
           name at all, and it can only copy a name the control already carries. Each
           says its column and its room: "Locked: Big IT Room", not "checkbox". */
        const COLUMN = {
            owner: "DRPG.Vault.owner", isroom: "DRPG.Vault.isRoomColumn", locked: "DRPG.Vault.lockedColumn",
            startlocked: "DRPG.Vault.lockedAtStartColumn", notshared: "DRPG.Vault.notSharedColumn",
            neighbours: "DRPG.Vault.neighboursColumn",
            nosearch: "DRPG.SearchTokens.sealedColumn", table: "DRPG.Vault.table",
            short: "DRPG.Rest.shortColumn", long: "DRPG.Rest.longColumn",
            desc: "DRPG.Vault.descriptionColumn"
        };
        const named = key => COLUMN[key]
            ? ` aria-label="${foundry.utils.escapeHTML(game.i18n.localize(COLUMN[key]))}: ${escRoom}"` : "";
        const check = (name, on, title = "") => `<td style="text-align:center"${
            title ? ` title="${title}"` : ""}><input type="checkbox" name="${name}:${escRoom}"${named(name)}
                ${on ? "checked" : ""} /></td>`;
        /*
         * THIS IS A ROOM (E12 C1, 11.10.2026; rooms.mjs). Every region of the name, since a room is
         * a name on a scene. Decided - every piece carries the flag - the box reads whether any
         * piece is marked; undecided, whether a piece may be a room at all, which is what Apply then
         * writes: the GM who applies this window has decided. No piece may be one (a passage's
         * behaviour, a region a player drew): the box is drawn off and Apply writes nothing. The
         * pieces are those that may be rooms (`namedByName`), so a Teleport of the name, which is
         * never decided, leaves the box reading what the GM decided of the rest.
         */
        const possible = pieces.length > 0;
        const decided = pieces.length > 0 && pieces.every(roomDecided);
        const isRoomNow = decided ? pieces.some(piece => piece.getFlag(MODULE_ID, ROOM_FLAG) === true) : possible;
        // Undecided, the box is a suggestion until Apply (E20 fix round, C-10): the ratio line counts it apart.
        const undecidedMark = possible && !decided ? " data-drpg-undecided" : "";

        return {
            name: `<td><strong>${escRoom}</strong></td>`,
            owner: `<td><select name="owner:${escRoom}"${named("owner")}><option value="">-</option>${people}</select></td>`,
            isroom: `<td style="text-align:center" title="${foundry.utils.escapeHTML(game.i18n.localize("DRPG.Vault.isRoomHint"))}"><input
                type="checkbox" name="isroom:${escRoom}"${named("isroom")} ${isRoomNow ? "checked" : ""}${possible ? "" : " disabled"}${undecidedMark} /></td>`,
            concealed: check("concealed", isConcealed(room, scene)),
            short: check("short", flagOver(pieces, REST_FLAGS.short)),
            long: check("long", flagOver(pieces, REST_FLAGS.long)),
            locked: check("locked", flagOver(pieces, ROOM_FLAGS.locked)),
            startlocked: check("startlocked", pieces.some(startLocked),
                game.i18n.localize("DRPG.Vault.lockedAtStartHint")),
            nosearch: check("nosearch", flagOver(pieces, SEARCH_FLAGS.sealed)),
            // Advice only: it changes no rule, just which regions the ratio
            // line above the table counts. See `sharedRooms`.
            notshared: check("notshared", flagOver(pieces, VAULT_FLAGS.notShared),
                game.i18n.localize("DRPG.Vault.notSharedHint")),
            // The list every piece holds (E12 C14); greyed under it when blank, the rooms the
            // rules connect this one to now - its walls and the lists that name it.
            neighbours: `<td><input type="text" name="neighbours:${escRoom}"${named("neighbours")}
                value="${foundry.utils.escapeHTML(neighboursWritten(pieces))}"
                placeholder="${foundry.utils.escapeHTML(neighbouringRooms(scene, room).join(", "))}"
                title="${foundry.utils.escapeHTML(game.i18n.localize("DRPG.Vault.neighboursHint"))}" /></td>`,
            /* [-] 2 / 3 [+] [refill] on one line (E12 C15, audit S08-26): the count between the two
               buttons that move it, and all four in one inline row. A button is a block in
               Foundry's own sheet, so the three of them stood one under another after the count
               and a room's row was about 128 px tall in the audit's screenshot - 2200 px of
               scrolling for 17 rooms. */
            tokens: `<td class="drpg-token-cell" style="text-align:center"><span class="drpg-token-step">
                <button type="button" class="drpg-mini-button" data-drpg-token="${escRoom}"
                    data-drpg-token-by="-1" title="${
                        game.i18n.localize("DRPG.SearchTokens.spendOne")}">−</button>
                <span class="drpg-token-count"><span data-drpg-tokens="${escRoom}">${
                    SearchTokens.left(room, scene)}</span> / ${maxTokens}</span>
                <button type="button" class="drpg-mini-button" data-drpg-token="${escRoom}"
                    data-drpg-token-by="1" title="${
                        game.i18n.localize("DRPG.SearchTokens.giveOne")}">+</button>
                <button type="button" class="drpg-mini-button" data-drpg-token="${escRoom}"
                    data-drpg-token-by="max" title="${
                        game.i18n.localize("DRPG.SearchTokens.refillRoom")}">↺</button>
            </span></td>`,
            table: `<td><select name="table:${escRoom}"${named("table")}>
                <option value="">${game.i18n.localize("DRPG.Vault.globalPool")}</option>
                ${tableOptions}</select></td>`,
            place: `<td><span class="drpg-place-switches">${placeSwitches}</span></td>`,
            // A textarea, not an input: these are sentences. The cell escapes
            // the wrapping-cell rule the rest of this table lives under - see
            // the `:has(input[type="text"], textarea)` exception in the
            // stylesheet - so the prose wraps instead of stretching the window.
            description: `<td><textarea name="desc:${escRoom}" rows="5"${named("desc")}
                placeholder="${game.i18n.localize("DRPG.Vault.descriptionPlaceholder")}"
                >${foundry.utils.escapeHTML(flagOver(pieces, VAULT_FLAGS.description) ?? "")}</textarea></td>`,
            /* The picture (E77 C1): `wirePortraitPickers`' thumbnail and hidden field, keyed by the room's name
               as the description is, and a button that empties both. The thumbnail shows only what
               `safeRoomImage` accepts of the stored path - a value it refuses is drawn as no picture, and the
               next Apply of the row writes what the window shows. */
            image: `<td><img class="drpg-room-picture" data-drpg-portrait="${escRoom}" alt=""${
                picture ? ` src="${foundry.utils.escapeHTML(picture)}"` : ""}
                title="${pickLabel}" aria-label="${pickLabel}: ${escRoom}" />
                <input type="hidden" name="img:${escRoom}" value="${foundry.utils.escapeHTML(picture ?? "")}" />
                <button type="button" class="drpg-mini-button" data-drpg-picture-clear
                    title="${clearLabel}" aria-label="${clearLabel}: ${escRoom}">✕</button></td>`
        };
    });
}

/* The Scenes tab last (E13 C5; the owner's answer Q-E13-1 e, 09.10.2026): it is set once a season,
   the others every session. Its panel is trial-scene.mjs's (`scenesTabHtml`). The Passages tab
   after Doors (E79 C5; the plan's D31 mockup): a secret passage is a way between two rooms, as a
   door is. Its panel is passages-tab.mjs's (`passagesTabHtml`), and its buttons write at once. */
export const ROOM_SETUP_TABS = Object.freeze([
    ["bedrooms", "DRPG.Vault.tabBedrooms"],
    ["doors", "DRPG.Vault.tabDoors"],
    ["passages", "DRPG.Vault.tabPassages"],
    ["search", "DRPG.Vault.tabSearching"],
    ["rest", "DRPG.Vault.tabRest"],
    ["stashes", "DRPG.Vault.tabStashes"],
    ["description", "DRPG.Vault.tabDescription"],
    ["fog", "DRPG.Vault.tabFog"],
    ["scenes", "DRPG.Vault.tabScenes"]
]);

/**
 * The tab Room Setup opens on: the one asked for when it is a tab, else Bedrooms on a scene that
 * holds a room and Scenes on one that holds none (Q-E13-1 e) - a GM who opens Room Setup on a new
 * map, or before any room is marked, has nothing to set on the room tabs yet.
 */
export function roomSetupTab(tab, holdsRooms) {
    if (ROOM_SETUP_TABS.some(([key]) => key === tab)) return tab;
    return holdsRooms ? "bedrooms" : "scenes";
}

/*
 * FIXED COLUMNS, ONE WIDTH A KIND OF CELL (E12 C15, audit S08-26 and S12-23).
 *
 * The tables were laid out by their content, so the audit read the checkbox columns of Doors and
 * Fog at anything from 190 to 460 px in a 1400 px window that was mostly empty, a Room column of
 * 1030 px on Stashes beside student columns of 52-79 px, and a different width for the same kind
 * of column on every tab. Each table now states its columns with a `<col>` per column, the room
 * first, and the stylesheet gives each kind one width (`.drpg-col-*`, `table-layout: fixed`), so
 * the column of a checkbox is as wide on Doors as on Rests and every student's column on Stashes is
 * as wide as on Fog. What a column holds is the key below; the student matrices are "student".
 */
const ROOM_SETUP_COLUMN = {
    owner: "select", isroom: "check", locked: "check", startlocked: "check", notshared: "check",
    neighbours: "text", nosearch: "check", tokens: "step", table: "select", place: "place",
    short: "check", long: "check", description: "prose", image: "picture"
};

function roomSetupColumns(kinds) {
    return `<colgroup><col class="drpg-col-room" />${
        kinds.map(kind => `<col class="drpg-col-${kind}" />`).join("")}</colgroup>`;
}

/** The window's body: the tab strip and one panel per tab, dealt from the same cells. */
function roomSetupContent({ initial, cells, students, stashRows, fogRows, uncovered, maxTokens, scenesPanel, passagesPanel = "" }) {
    const th = key => `<th>${game.i18n.localize(key)}</th>`;
    const TABLE = "drpg-vault-table drpg-room-setup-table";
    const tableFor = (heads, cols) => `<table class="${TABLE}">${
        roomSetupColumns(cols.map(k => ROOM_SETUP_COLUMN[k]))}<thead><tr>${
        th("DRPG.Vault.room")}${heads.join("")}</tr></thead><tbody>${
        cells.map(c => `<tr>${c.name}${cols.map(k => c[k]).join("")}</tr>`).join("")
    }</tbody></table>`;
    const matrix = rows => `<table class="${TABLE}">${
        roomSetupColumns(students.map(() => "student"))}<thead><tr>
            <th>${game.i18n.localize("DRPG.Vault.room")}</th>
            ${studentHeads(students)}
        </tr></thead><tbody>${rows}</tbody></table>`;

    const nav = ROOM_SETUP_TABS.map(([key, label]) =>
        `<button type="button" class="drpg-dashboard-tab${key === initial ? " active" : ""}"
            data-drpg-tab="${key}">${game.i18n.localize(label)}</button>`).join("");
    const panel = (key, inner) =>
        `<div data-drpg-panel="${key}"${key === initial ? "" : ' style="display:none"'}>${inner}</div>`;

    return dialogContent(`<form>
            <p class="notes">${game.i18n.localize("DRPG.Vault.manageIntro")}</p>
            ${cells.length ? "" : `<p class="drpg-warning">${game.i18n.localize("DRPG.Vault.noRooms")}</p>`}
            <nav class="drpg-dashboard-tabs">${nav}</nav>

            ${panel("bedrooms", `
                <p>${game.i18n.localize("DRPG.Vault.bedroomsIntro")}</p>
                <p class="drpg-warning" data-drpg-two-rooms style="display:none"></p>
                ${tableFor([th("DRPG.Vault.owner")], ["owner"])}
            `)}

            ${panel("doors", `
                <p>${game.i18n.localize("DRPG.Vault.doorsIntro")}</p>
                <p class="notes" data-drpg-ratio></p>
                ${tableFor([th("DRPG.Vault.isRoomColumn"), th("DRPG.Vault.lockedColumn"),
                    th("DRPG.Vault.lockedAtStartColumn"), th("DRPG.Vault.notSharedColumn"),
                    th("DRPG.Vault.neighboursColumn")],
                    ["isroom", "locked", "startlocked", "notshared", "neighbours"])}
                <p class="notes">${game.i18n.localize("DRPG.Vault.notSharedNote")}</p>
                <p class="notes">${game.i18n.localize("DRPG.Vault.neighboursNote")}</p>
            `)}

            ${panel("passages", passagesPanel)}

            ${panel("search", `
                <p>${game.i18n.localize("DRPG.Vault.searchIntro")}</p>
                ${tableFor([
                    th("DRPG.SearchTokens.sealedColumn"), th("DRPG.SearchTokens.title"),
                    th("DRPG.Vault.table"), th("DRPG.Vault.placeColumn")
                ], ["nosearch", "tokens", "table", "place"])}
                <p class="notes">${game.i18n.localize("DRPG.Vault.manageNote")}</p>
                <p class="notes">${game.i18n.format("DRPG.SearchTokens.roomSetupNote",
                    { max: maxTokens })}</p>
                <p class="notes">${game.i18n.localize("DRPG.SearchTokens.sealedNote")}</p>
            `)}

            ${panel("rest", `
                <p>${game.i18n.localize("DRPG.Rest.manageIntro")}</p>
                ${tableFor([th("DRPG.Rest.shortColumn"), th("DRPG.Rest.longColumn")],
                    ["short", "long"])}
            `)}

            ${panel("stashes", `
                <p>${game.i18n.localize("DRPG.Vault.stashesIntro")}</p>
                ${stashLegend()}
                ${matrix(stashRows)}
                <p class="notes">${game.i18n.localize("DRPG.Vault.stashesNote")}</p>
            `)}

            ${panel("description", `
                <p>${game.i18n.localize("DRPG.Vault.descriptionIntro")}</p>
                ${tableFor([th("DRPG.Vault.descriptionColumn"), th("DRPG.Vault.imageColumn")], ["description", "image"])}
                <p class="notes">${game.i18n.localize("DRPG.Vault.descriptionNote")}</p>
            `)}

            ${panel("fog", `
                <p>${game.i18n.localize("DRPG.Vault.fogIntro")}</p>
                ${uncovered > 0 ? `<p class="drpg-warning">${game.i18n.format("DRPG.Vault.fogUncovered",
                    { pct: uncovered })}</p>` : ""}
                <div class="drpg-fog-bulk">
                    <button type="button" class="drpg-mini-button" data-drpg-fog-all="discover">${
                        game.i18n.localize("DRPG.Vault.discoverAll")}</button>
                    <button type="button" class="drpg-mini-button" data-drpg-fog-all="hide">${
                        game.i18n.localize("DRPG.Vault.hideAll")}</button>
                </div>
                ${matrix(fogRows)}
                <p class="notes">${game.i18n.localize("DRPG.Vault.fogNote")}</p>
            `)}

            ${panel("scenes", scenesPanel)}
        </form>`);
}

/** What Apply hands back: every row, the Fog boxes the GM changed and the stash matrix, read off the form by input name. */
function readRoomSetupForm(d, { rooms, students, categories }) {
    const f = d.element.querySelector("form");
    const pick = name => f.querySelector(`[name="${CSS.escape(name)}"]`);
    // `null` when the box is drawn off: no piece of the name may be a room (`roomCells`).
    const roomBox = box => box && !box.disabled ? box.checked : null;
    const roomRows = rooms.map(room => ({
        room,
        owner: pick(`owner:${room}`)?.value ?? "",
        shortRest: Boolean(pick(`short:${room}`)?.checked),
        longRest: Boolean(pick(`long:${room}`)?.checked),
        locked: Boolean(pick(`locked:${room}`)?.checked),
        lockedAtStart: Boolean(pick(`startlocked:${room}`)?.checked),
        noSearch: Boolean(pick(`nosearch:${room}`)?.checked),
        notShared: Boolean(pick(`notshared:${room}`)?.checked),
        isRoom: roomBox(pick(`isroom:${room}`)),
        ...neighboursTyped(pick(`neighbours:${room}`), room, rooms),
        description: (pick(`desc:${room}`)?.value ?? "").trim(),
        // The picture's hidden field (E77 C1), checked by `applyRoomRows` before anything is written.
        image: (pick(`img:${room}`)?.value ?? "").trim(),
        table: pick(`table:${room}`)?.value ?? "",
        favours: categories
            .map(([key]) => key)
            .filter(key => pick(`fav:${room}:${key}`)?.checked),
        // The place switch ticks at most one of the two boxes
        // (E12 C15); the filter repeats it here so a row somebody
        // edited by other means still cannot say both.
        hinders: categories
            .map(([key]) => key)
            .filter(key => pick(`hin:${room}:${key}`)?.checked
                && !pick(`fav:${room}:${key}`)?.checked)
    }));
    // Only the boxes the GM changed, against what the window drew - see
    // `applyDiscoveryChanges` (ROOM-01). The ledger keeps growing while this
    // is open, and a box nobody touched says nothing about a room found since.
    const fogChanges = [];
    for (const actor of students) {
        for (const room of rooms) {
            const box = pick(`fog:${room}:${actor.id}`);
            if (box && box.checked !== box.defaultChecked) {
                fogChanges.push({ actorId: actor.id, room, value: box.checked });
            }
        }
    }
    // Room -> the stashes the GM left in it. Empty cells are
    // simply absent, which is what "no stash" means.
    const stashMatrix = {};
    for (const room of rooms) {
        stashMatrix[room] = students
            .map(actor => ({
                actorId: actor.id,
                state: pick(`stash:${room}:${actor.id}`)?.value ?? ""
            }))
            .filter(entry => entry.state)
            .map(entry => ({
                actorId: entry.actorId,
                concealed: entry.state === "hidden"
            }));
    }
    return { rooms: roomRows, fogChanges, stashes: stashMatrix };
}

/*
 * HOW BIG THIS BUILDING IS FOR THE PEOPLE STILL IN IT (Dawid, 31.08).
 *
 * G-36 asks for one and a half SHARED rooms per player, and that rule
 * lives at season setup where nobody reads it again. Students die and
 * rooms do not: after the third trial eight people rattle around a
 * building built for sixteen, nobody meets anybody, and there are no
 * witnesses to anything.
 *
 * Deliberately not a mechanic - the GM closes wings by hand, which is
 * what the locks below are for. The line follows the boxes as they are
 * ticked rather than reporting the state the window opened in.
 *
 * ONE CENSUS (E20 C1; the owner's Q-3, 29.10.2026). The count is
 * `roomCensusOf`'s, the rule the checklist and Pre-season checks read off
 * the flags: marked, no owner, not "No privacy", and a locked room
 * counted - this line used to drop it, so a locked room and a dead
 * student made it disagree with the checklist about one map. How many
 * of the counted rooms are locked is said after the ratio, so closing a
 * wing still shows here. Exported for R1500, which reads it on a form of
 * its own.
 */
export function wireRoomRatio(dialog, rooms, living) {
    const ratio = dialog.element.querySelector("[data-drpg-ratio]");
    if (ratio) {
        const paintRatio = () => {
            const form = dialog.element.querySelector("form");
            /*
             * READ OFF THE FORM, NOT OFF THE FLAGS (audit A21).
             *
             * Every column the census asks is one the GM is looking at
             * right now - the owner on the Bedrooms tab, "This is a room",
             * "No privacy" and the lock on this one - so the line follows
             * the ticks rather than the saved state.
             */
            const field = (prefix, room) => form?.querySelector(`[name="${CSS.escape(`${prefix}:${room}`)}"]`);
            const ticked = (prefix, room) => Boolean(field(prefix, room)?.checked);
            /* A box drawn off is a name no piece of which may be a room (`roomCells`). A box nobody decided yet is ticked
               as a suggestion (`data-drpg-undecided`), and counted only once the GM has changed it in this window: on a
               fresh map every named region read as a room here, 12 against the checklist's 0 (E20 fix round, the
               correctness review's C-10). The suggestions are said apart, after the ratio. */
            const box = room => field("isroom", room);
            const open = room => Boolean(box(room) && !box(room).disabled && box(room).checked);
            const suggested = room => open(room) && box(room).hasAttribute("data-drpg-undecided") && !changed.has(room);
            const census = roomCensusOf(rooms.map(room => ({
                name: room,
                room: open(room) && !suggested(room),
                owner: field("owner", room)?.value ?? "",
                notShared: ticked("notshared", room),
                locked: ticked("locked", room)
            })));
            const pending = rooms.filter(suggested).length;
            ratio.textContent = pending ? `${roomRatioLine(census, living)} ${plural("DRPG.Vault.roomCensusUndecided", { n: pending })}`
                : roomRatioLine(census, living);
            ratio.classList.toggle("drpg-warning", living > 0 && census.count > roomsWantedFor(living));
        };
        const changed = new Set();
        dialog.element.addEventListener("change", ev => {
            const name = String(ev.target?.name ?? "");
            if (name.startsWith("isroom:")) changed.add(name.slice("isroom:".length));
            if (name.startsWith("locked:") || name.startsWith("notshared:")
                || name.startsWith("owner:") || name.startsWith("isroom:")) paintRatio();
        });
        paintRatio();
    }
}

/*
 * Cycle a stash cell: none -> open -> hidden -> none.
 *
 * The hidden input is the truth and the glyph follows it, never the
 * other way round - Apply reads the input, and a cell whose picture
 * and value could disagree is a cell that lies to whoever saves it.
 */
function wireStashCells(root) {
    const NEXT = { "": "open", open: "hidden", hidden: "" };
    for (const button of root.querySelectorAll("[data-drpg-stash]")) {
        button.addEventListener("click", ev => {
            ev.preventDefault();
            const input = button.parentElement?.querySelector("input[type=hidden]");
            if (!input) return;
            input.value = NEXT[input.value] ?? "open";
            button.innerHTML = stashGlyph(input.value);
        });
    }
}

/*
 * Cycle a place switch: neither -> good -> bad -> neither (E12 C15).
 *
 * A room cannot favour and hinder the same category, and with one switch it
 * cannot be asked to: each state ticks at most one of the cell's two hidden
 * boxes. This replaced a change listener that unticked the other column's box
 * when one was ticked. The boxes are the truth and the button follows them,
 * as in `wireStashCells` above.
 */
function wirePlaceSwitches(root) {
    const NEXT = { "": "good", good: "bad", bad: "" };
    for (const button of root.querySelectorAll("[data-drpg-place]")) {
        button.addEventListener("click", ev => {
            ev.preventDefault();
            const [fav, hin] = button.parentElement?.querySelectorAll("input.drpg-place-box") ?? [];
            if (!fav || !hin) return;
            const state = NEXT[fav.checked ? "good" : hin.checked ? "bad" : ""];
            fav.checked = state === "good";
            hin.checked = state === "bad";
            const { glyph, key } = PLACE_STATES[state];
            button.dataset.drpgPlace = state;
            button.querySelector("i")?.setAttribute("class", glyph);
            button.setAttribute("aria-label", `${button.dataset.drpgLabel}: ${game.i18n.localize(key)}`);
        });
    }
}

// The search-token controls act AT ONCE and recount in place.
//
// They are not part of Apply, for the same reason the Monocub
// manager's "give Hope" button is not: this is a counter the table
// is currently spending, and a GM who nudges it and then cancels the
// rest of the form should not find the nudge undone with it. The
// count is re-read from `SearchTokens` after the write rather than
// guessed from the cell, so a spend that arrived from a player's
// client mid-edit is reflected instead of overwritten.
function wireTokenButtons(root, scene, recount) {
    for (const button of root.querySelectorAll("[data-drpg-token]")) {
        button.addEventListener("click", async ev => {
            ev.preventDefault();
            const room = button.dataset.drpgToken;
            const by = button.dataset.drpgTokenBy;
            const now = SearchTokens.left(room, scene);
            const want = by === "max" ? SearchTokens.max : now + Number(by);
            await SearchTokens.setFor(room, want, scene);
            // The write comes back through `recount` below like anybody
            // else's, so there is no second copy of "what the cell says".
            recount(root);
        });
    }
}

/*
 * DISCOVER ALL / HIDE ALL TICK THE BOXES, AND APPLY DECIDES (ROOM-03).
 *
 * They used to be submit buttons that wrote the ledger and reopened the
 * window, which threw away every unapplied edit on the other six tabs - and
 * they sat in the footer of all of them, so "Hide all" pressed from Bedrooms
 * emptied the fog with no warning. Since ROOM-03 they tick the Fog tab's boxes
 * and Apply or Cancel decides, like every other box in this window.
 *
 * ABOVE THE TABLE, NOT IN THE FOOTER (E12 C15, audit S08-26). They were footer
 * buttons shown on the Fog tab only, and the footer centres its buttons, so
 * switching to Fog moved Apply by about 270 px (the audit's reading) for two
 * buttons that only tick boxes. They sit over the matrix they tick now, and
 * the footer is Apply and Cancel on every tab. Not in DialogV2's `buttons`
 * and with no `data-action`, so the window's own click handling never hears
 * them, and `type="button"`, so the form is not submitted.
 */
function wireFogButtons(root) {
    for (const button of root.querySelectorAll("[data-drpg-fog-all]")) {
        button.addEventListener("click", ev => {
            ev.preventDefault();
            const value = button.dataset.drpgFogAll === "discover";
            for (const box of root.querySelectorAll('input[type="checkbox"][name^="fog:"]')) {
                box.checked = value;
            }
        });
    }
}

/*
 * ONE STUDENT, ONE BEDROOM - REFUSED WHILE THE FORM IS STILL HERE (ROOM-02).
 *
 * The check used to run after the window had closed and after the fog had
 * been written, and then gave up on everything else: a GM who moved a
 * student by picking the new room before clearing the old one lost every
 * description, lock and stash typed since opening. Apply now waits, greyed,
 * with the reason on the Bedrooms tab and on the button. `bedroomClaimedTwice`
 * below is the backstop for a form that got past this.
 */
function wireTwoRoomsCheck(root, rooms) {
    const twoRoomsNote = root.querySelector("[data-drpg-two-rooms]");
    const checkBedrooms = () => {
        const seen = new Map();
        let clash = null;
        for (const room of rooms) {
            const owner = root.querySelector(`[name="${CSS.escape(`owner:${room}`)}"]`)?.value;
            if (!owner) continue;
            if (seen.has(owner)) {
                clash = { name: game.actors.get(owner)?.name ?? "?", a: seen.get(owner), b: room };
                break;
            }
            seen.set(owner, room);
        }
        const text = clash ? game.i18n.format("DRPG.Vault.twoRooms", clash) : "";
        setApplyBlock(root, "bedrooms", text || null);
        if (twoRoomsNote) {
            twoRoomsNote.textContent = text;
            twoRoomsNote.style.display = clash ? "" : "none";
        }
    };
    root.addEventListener("change", ev => {
        if (String(ev.target?.name ?? "").startsWith("owner:")) checkBedrooms();
    });
    checkBedrooms();
}

/*
 * TWO REASONS TO HOLD APPLY, ONE BUTTON (E13 C5; the A5 design's step 16). One student in two
 * bedrooms held Apply by writing `disabled` itself, and the Scenes tab holds it while both its
 * selects name one scene: two checks writing the same field would each free the button the other
 * held. So each sets or clears its own reason here, and Apply is free only when none is left; its
 * label is the first reason still standing.
 */
const applyBlocks = new WeakMap();

export function setApplyBlock(root, key, reason) {
    const apply = root?.querySelector?.('footer button[data-action="ok"]');
    if (!apply) return;
    const reasons = applyBlocks.get(apply) ?? new Map();
    applyBlocks.set(apply, reasons);
    if (reason) reasons.set(key, reason);
    else reasons.delete(key);
    const text = reasons.values().next().value ?? null;
    apply.disabled = Boolean(text);
    if (text) {
        apply.setAttribute("data-tooltip", "");
        apply.setAttribute("aria-label", text);
    } else {
        apply.removeAttribute("data-tooltip");
        apply.removeAttribute("aria-label");
    }
}

// One owner, one room. Two bedrooms pointing at the same student would make
// `vaultRoomFor` answer differently depending on region order, which is the
// kind of bug that only shows up mid-session. The form greys Apply while that
// is on screen (`wireTwoRoomsCheck`); this is the backstop, and Apply runs it
// before ANY write so a refusal is never half a save (ROOM-02).
function bedroomClaimedTwice(rowResults) {
    const claimed = new Map();
    for (const row of rowResults) {
        if (!row.owner) continue;
        if (claimed.has(row.owner)) {
            ui.notifications.error(game.i18n.format("DRPG.Vault.twoRooms", {
                name: game.actors.get(row.owner)?.name ?? "?",
                a: claimed.get(row.owner), b: row.room
            }));
            return true;
        }
        claimed.set(row.owner, row.room);
    }
    return false;
}

/**
 * A room's Neighbours as its pieces hold them (`ROOM_FLAGS.neighbours`, E12 C14): every piece's
 * list, each name once, in the order written, joined as the column draws it.
 */
function neighboursWritten(pieces) {
    const names = pieces.flatMap(piece => {
        const value = piece.getFlag(MODULE_ID, ROOM_FLAGS.neighbours);
        return typeof value === "string" ? value.split(",").map(name => name.trim()).filter(Boolean) : [];
    });
    return [...new Set(names)].join(", ");
}

/**
 * A Neighbours cell as Apply writes it (E12 C14): each name typed once, in the order typed, spelt
 * as the window's row of that name when one matches it without regard to case, never the room's
 * own; `neighbours` null when the window drew no cell. A room whose name holds a comma cannot be
 * listed: the list is the flag's comma-separated string, which GMs typed by hand before this
 * column. Which of the names is no room is `applyRoomRows`'s to say (E12 fix r2-H2).
 */
function neighboursTyped(cell, room, rooms) {
    if (!cell) return { neighbours: null };
    const lower = new Map(rooms.map(name => [name.toLowerCase(), name]));
    const listed = [];
    for (const typed of String(cell.value ?? "").split(",").map(name => name.trim()).filter(Boolean)) {
        const name = rooms.includes(typed) ? typed : lower.get(typed.toLowerCase()) ?? typed;
        if (name === room || listed.includes(name)) continue;
        listed.push(name);
    }
    return { neighbours: listed.join(", ") };
}

/**
 * The named regions of a scene by name - Room Setup's own map (E12 C2a): every name, with the
 * pieces of it that can be rooms, marked or not (none for a name only a Teleport or a player's
 * region carries). Not `piecesByName`, which holds rooms only: this window is where a region
 * becomes one. Until E12 fix r1-G1 it held the LAST region of a name, whatever it was, and the
 * window read and compared that one piece (rooms.mjs, "ONE ROOM OF MANY PIECES").
 */
function namedByName(scene) {
    const players = playerRegionIds();
    const map = new Map();
    for (const region of namedRegions(scene)) {
        if (!map.has(region.name)) map.set(region.name, []);
        if (canBeRoom(region, players)) map.get(region.name).push(region);
    }
    return map;
}

/**
 * Write every row that differs from its region. Answers the rooms it changed and whose bedroom moved.
 * Every write lands on every region of the row's name (E12 C2a, `updateRoom`): one write to the
 * piece `regionsByName` held left a Kitchen of two pieces locked on one of them (66 D1).
 */
async function applyRoomRows(rowResults, { REST_FLAGS, setRestRoom, scene }) {
    const changed = new Set();
    // Rooms whose BEDROOM OWNER moved in this Apply. Collected rather than acted
    // on inline because the seeding below has to run after the stash matrix has
    // been written, or it would seed into a list it is about to overwrite.
    const ownerMoved = [];
    // The owner each of them had is `setVaultRoom`'s to read: it takes the old owner's keys (E14 part 1 C2, S08-11; fix e1-G2).
    const named = namedByName(scene);
    /* The rooms of this scene once this Apply is written, for the Neighbours names that are none
       (E12 fix r2-H2, 11.10.2026; early review EARLY-C14-2). The names were checked against the
       window's rows, and a row is any named region that could be a room - so a list naming a Teleport
       or a region nobody marked was taken without a word, though `neighbouringRooms` reads rooms only
       and the name connected nothing. A box ticked or cleared in this same Apply counts. */
    const roomsAfter = new Set(roomNames(scene));
    for (const row of rowResults) {
        if (row.isRoom === true) roomsAfter.add(row.room);
        else if (row.isRoom === false) roomsAfter.delete(row.room);
    }
    for (const row of rowResults) {
        // The pieces that can be rooms, read as one as the cells were (E12 fix r1-G1): a name
        // with none - a Teleport's alone - has nothing a row may write.
        const pieces = named.get(row.room) ?? [];
        if (!pieces.length) continue;

        const before = {
            owner: flagOver(pieces, VAULT_FLAGS.owner),
            table: flagOver(pieces, VAULT_FLAGS.table),
            favours: listOver(pieces, VAULT_FLAGS.favours),
            hinders: listOver(pieces, VAULT_FLAGS.hinders),
            description: flagOver(pieces, VAULT_FLAGS.description) ?? "",
            // As stored, not as `safeRoomImage` reads it: a value it refuses was drawn as no picture, so a row
            // that leaves it so differs and its Apply writes null over it.
            image: flagOver(pieces, VAULT_FLAGS.image) ?? ""
        };
        /* THE PICTURE IS JUDGED BEFORE THE ROW IS COMPARED (E77 C1). A path `safeRoomImage` refuses is not
           written and the GM is told which room; the row's other columns are written as usual. `refused`
           also keeps the picture out of `same`, so a refused path alone writes nothing at all. */
        const picture = row.image ? safeRoomImage(row.image) : "";
        const refused = picture === null;
        if (refused) ui.notifications.warn(game.i18n.format("DRPG.Vault.imageRefused", { room: row.room }));
        const beforeRest = {
            short: Boolean(flagOver(pieces, REST_FLAGS.short)),
            long: Boolean(flagOver(pieces, REST_FLAGS.long))
        };
        const wasLocked = Boolean(flagOver(pieces, ROOM_FLAGS.locked));
        const wasLockedAtStart = pieces.some(startLocked);
        const wasSealed = Boolean(flagOver(pieces, SEARCH_FLAGS.sealed));
        const wasNotShared = Boolean(flagOver(pieces, VAULT_FLAGS.notShared));
        // Settled when every piece that can be a room already says what the row says (E12 C1);
        // the scene is the pieces' own, so the flag goes where the row was read.
        const roomSettled = row.isRoom === null
            || pieces.every(piece => piece.getFlag(MODULE_ID, ROOM_FLAG) === row.isRoom);
        // Likewise the Neighbours list (E12 C14): every piece holds the list the row says - the
        // pieces `updateRoom` writes, as for the mark (E12 fix r1-G1).
        const neighboursSettled = row.neighbours === null
            || pieces.every(piece => neighboursWritten([piece]) === row.neighbours);

        const same = before.owner === (row.owner || null)
            && before.table === (row.table || null)
            && beforeRest.short === row.shortRest
            && beforeRest.long === row.longRest
            && before.favours.length === row.favours.length
            && before.favours.every(f => row.favours.includes(f))
            && before.hinders.length === row.hinders.length
            && before.hinders.every(h => row.hinders.includes(h))
            && wasLocked === row.locked
            && wasLockedAtStart === row.lockedAtStart
            && wasSealed === row.noSearch
            && wasNotShared === row.notShared
            && roomSettled
            && neighboursSettled
            && before.description === row.description
            && (refused || before.image === picture);
        if (before.owner !== (row.owner || null) && row.owner) {
            ownerMoved.push({ room: row.room, owner: row.owner });
        }
        if (same) continue;

        // "Stash hidden" is the Stashes tab's business (ITEM-02): the column
        // this tab used to carry wrote the LEGACY flag, which the Stashes list
        // then read back and undid in the same Apply.
        await setVaultRoom(row.room, {
            owner: row.owner,
            table: row.table,
            favours: row.favours,
            hinders: row.hinders,
            description: row.description,
            image: refused ? undefined : picture || null,
            scene
        });

        // Through rest.mjs's own writer rather than a second flag path, so the
        // two rest flags keep one owner.
        await setRestRoom(row.room, { short: row.shortRest, long: row.longRest, scene });

        // No announcement either way. A room nobody can search says so on the
        // action tile the moment anybody stands in it and looks - which is a
        // better place to learn it than a chat line scrolling past hours
        // earlier, and it does not tell the whole cast which room the GM has
        // just decided is interesting enough to close.
        if (wasSealed !== row.noSearch) {
            await updateRoom(scene, row.room, { [`flags.${MODULE_ID}.${SEARCH_FLAGS.sealed}`]: row.noSearch });
        }

        // Nothing to announce: this moves a line of advice on two GM screens
        // and no rule at all.
        if (wasNotShared !== row.notShared) {
            await updateRoom(scene, row.room, { [`flags.${MODULE_ID}.${VAULT_FLAGS.notShared}`]: row.notShared });
        }

        // Nothing announced: whether a region is a room is the GM's map, not news.
        if (!roomSettled) await setRoomFlag(scene, row.room, ROOM_FLAG, row.isRoom);

        // Nothing announced: a door on the GM's map is learnt by walking through it. A name that
        // is no room of this scene is kept as typed and the GM told: it connects nothing, and the
        // room it names may be drawn or marked after this Apply.
        if (!neighboursSettled) {
            await updateRoom(scene, row.room, { [`flags.${MODULE_ID}.${ROOM_FLAGS.neighbours}`]:
                row.neighbours || (forcedDeletion() ?? null) });
            const unknown = (row.neighbours ?? "").split(", ").filter(name => name && !roomsAfter.has(name));
            if (unknown.length) {
                ui.notifications.warn(game.i18n.format("DRPG.Vault.neighboursUnknown",
                    { room: row.room, names: unknown.join(", ") }));
            }
        }

        // Written whether or not it changed, because "unset" and "unset but
        // equal to the current lock" are the same thing to `startLocked` and
        // only one of them survives a mid-season change to the lock itself.
        await updateRoom(scene, row.room, { [`flags.${MODULE_ID}.${ROOM_FLAGS.lockedAtStart}`]: row.lockedAtStart });

        if (wasLocked !== row.locked) {
            await updateRoom(scene, row.room, { [`flags.${MODULE_ID}.${ROOM_FLAGS.locked}`]: row.locked });
            // Only unlocking is announced. A GM locking a door mid-session is
            // often the point the players finding out is meant to come from
            // walking into it and reading "Drzwi są zamknięte." themselves -
            // the same reasoning `toggleFinalTrialFlag` in mastermind.mjs
            // applies to starting versus ending. Unlocking has no such
            // in-fiction moment of its own, so it says so out loud.
            if (wasLocked && !row.locked) {
                await announce({
                    content: `<p>${game.i18n.format("DRPG.Vault.unlockedAnnounce",
                        { room: foundry.utils.escapeHTML(row.room) })}</p>`
                });
            }
        }

        changed.add(row.room);
    }
    return { changed, ownerMoved };
}

/*
 * THE STASH MATRIX, and the two rules that make it safe.
 *
 * TRAP 77 - A STASH WITH THINGS IN IT IS NOT REMOVED. Taking one away would
 * leave every item in it pointing at a stash that no longer exists, which is
 * an item on no list at all: not carried, not in any drawer, gone from the
 * sheet and findable only by a GM reading flags. So the removal is refused,
 * with the count, and the GM is told whose things and how many. The cell
 * snaps back on the next open because the form is redrawn from the flags.
 */
async function applyStashMatrix(stashes, scene) {
    const changed = new Set();
    for (const [room, wanted] of Object.entries(stashes)) {
        const current = stashesIn(room, scene);
        const keep = new Map(wanted.map(entry => [entry.actorId, entry]));

        for (const entry of current) {
            if (keep.has(entry.actorId)) continue;
            const owner = game.actors.get(entry.actorId);
            const held = owner ? stashItemsIn(owner, room, scene).length : 0;
            if (held) {
                ui.notifications.warn(plural("DRPG.Vault.stashNotEmpty", {
                    name: owner?.name ?? "?", room, n: held
                }));
                keep.set(entry.actorId, entry);      // refused: leave it alone
                continue;
            }
            // Counted only when written (E12 fix r1-G1; review EARLY-C4-1): a cell of a name no
            // room carries - a Teleport's - wrote nothing and was counted a changed room.
            if (await setStash(room, entry.actorId, { present: false, scene })) changed.add(room);
        }

        for (const entry of keep.values()) {
            const was = current.find(e => e.actorId === entry.actorId);
            if (was && was.concealed === entry.concealed) continue;
            if (await setStash(room, entry.actorId, { concealed: entry.concealed, scene })) changed.add(room);
        }
    }
    return changed;
}

/*
 * TRAP 76 - SEEDING RUNS ON AN OWNER CHANGE, NEVER ON EVERY APPLY.
 *
 * Giving somebody a bedroom gives them a stash in it, which is what makes
 * the split invisible to a GM who never opens the new tab. But if it ran
 * every time the form was saved, then removing a stash on the Stashes tab
 * and pressing Apply would put it straight back - a button that unclicks
 * itself, and the GM would have no way to tell it apart from a bug.
 *
 * `?? false` rather than a plain create: `setStash` leaves an existing entry
 * alone when told nothing about concealment, so a GM who already hid the
 * owner's stash keeps it hidden.
 */
async function seedOwnerStashes(ownerMoved, scene) {
    const changed = new Set();
    for (const { room, owner } of ownerMoved) {
        if (stashIn(room, owner, scene)) continue;
        if (await setStash(room, owner, { concealed: false, scene })) changed.add(room);
    }
    return changed;
}

export async function openRoomSetupDialog({ tab = null } = {}) {
    // ONE OF THESE, NOT FOUR - see `alreadyOpen` in live.mjs. Two copies of a
    // window each read the world when they opened and neither knows about the
    // other, so the older one goes on looking authoritative while showing
    // something that stopped being true. Raised rather than refused: pressing
    // twice usually means the window is behind something.
    if (alreadyOpen("drpg-window-rooms")) return null;

    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    /*
     * THE SCENE THIS WINDOW WAS OPENED ON, AND NO OTHER (E12 C4, R119; audit S08-16).
     *
     * Read once, here, and handed to every read and every write below, Apply's included. Until
     * 1.2.74 the rows were written to the scene on screen when Apply was pressed (`regionsByName()`
     * read the camera inside them, and since E12 C2a the call below handed it `workingScene()`), and
     * the Stashes tab's cells and the stash a new bedroom owner is given went to `setStash`'s own
     * default, the camera too: a GM who opened this on the dorms, looked at the gym while deciding,
     * and pressed Apply wrote the dorms' table onto the gym's rooms of the same names (scenario 66
     * B1 read the lock on the Annex's Gym before this commit). The title names the scene, so the GM can see which
     * map the table is. Rooms are still listed alphabetically: a GM opens this looking for ONE
     * room by name, and the order regions were drawn in is nobody's mental model of the building.
     */
    // Never the trial hall (E13 C1, R115): nobody stands there and it holds no rooms whatever its
    // regions say (rooms.mjs), so a GM viewing it during a trial is shown the school's table.
    let scene = workingScene();
    if (isTrialScene(scene)) scene = homeScene();
    /* NO ROOM IS NO REFUSAL (E13 C5; the owner's answer Q-E13-1 e, 09.10.2026). This refused a
       scene with no named region, so the GM of a world with no rooms yet could not reach the
       Scenes tab, and over a scene whose only named region was a Teleport (no room) it opened on
       Bedrooms (read in the code, 12.10). It opens on the Scenes tab whenever its scene holds no room
       (`roomSetupTab`), the room tabs empty or listing the regions still to be marked; only
       with no scene at all is there nothing to open. */
    if (!scene) {
        ui.notifications.warn(game.i18n.localize("DRPG.Vault.noRooms"));
        return null;
    }
    const rooms = Array.from(namedByName(scene).keys()).sort((a, b) => a.localeCompare(b));
    const scenesTab = await import("./trial-scene.mjs");
    const passagesTab = await import("./passages-tab.mjs");

    const { studentActors, studentCensus } = await import("./monokuma.mjs");
    const { REST_FLAGS, setRestRoom } = await import("./rest.mjs");
    const { discoveredFor, applyDiscoveryChanges, sceneUncoveredPercent } =
        await import("./fog.mjs");
    const students = studentActors();
    // The living as the checklist counts them (E20 C1, `studentCensus`): `isDeceased` here missed a death the GMs keep.
    const living = studentCensus(students).count;
    // Room pools only. The tier pools (`tableName()`'s family) answer dice
    // rolls and are never a room's stock - see `roomStockTables` in tables.mjs:
    // by their flags since E14 fix e1-G2, so one the GM renamed in the sidebar
    // is not offered here as "Kitchen knives".
    const tables = roomStockTables();
    /*
     * WHAT A ROOM CAN BE GOOD OR BAD FOR (audit A24).
     *
     * Truth Bullets are not searched for, and neither are bedroom keys - a key
     * is granted with a room on it, never drawn from a pool - so neither is a
     * category a room can stock or favour. The key was on offer here because
     * this list was `ITEM_CATEGORIES` minus Truth Bullets alone; ticking it
     * bought nothing, because no Search ever asks for that category.
     *
     * `splitUsables: false` on purpose, and it is the one place that asks for
     * it: a Search hands `favoursCategory` the CATEGORY it is drawing on, and
     * both usable kinds draw on `usable`. Splitting the column would offer a
     * distinction the lookup cannot honour.
     */
    const categories = pickableCategories({ splitUsables: false })
        .map(c => [c.key, ITEM_CATEGORIES[c.key]]);
    const regions = namedByName(scene);

    const uncovered = sceneUncoveredPercent(scene);
    const maxTokens = SearchTokens.max;

    const known = new Map(students.map(a => [a.id, new Set(discoveredFor(scene?.id, a.id))]));
    const fogRows = fogMatrixRows(rooms, students, known);
    const stashRows = stashMatrixRows(rooms, students, scene);
    const cells = roomCells(rooms, { students, tables, categories, regions, scene, maxTokens, REST_FLAGS });

    const initial = roomSetupTab(tab, sceneHoldsRooms(scene));

    const result = await tableDialog({
        window: { title: game.i18n.format("DRPG.Vault.manageTitleOn", { scene: scene?.name ?? "" }) },
        // `drpg-projects` as well as `drpg-panel`: that is the class the
        // stylesheet hangs the table treatment on - full width, a scrolling
        // window-content and sane select sizing. Without it this dialog asked
        // for 860px, lost to the 26rem `.drpg-panel` cap, and clipped its own
        // right-hand columns with no way to scroll to them.
        classes: ["drpg-panel", "drpg-projects", "drpg-room-setup", "drpg-window-rooms"],
        // One size for all nine tabs, taken from the biggest of them - see
        // `fitWindowToTabs`. Without it the window is fitted to whichever tab
        // is showing and jumps between 708px and 1504px as the GM switches.
        fitTabs: true,
        content: roomSetupContent({ initial, cells, students, stashRows, fogRows, uncovered, maxTokens,
            scenesPanel: scenesTab.scenesTabHtml(), passagesPanel: passagesTab.passagesTabHtml(scene, { students }) }),
        buttons: [
            {
                action: "ok", label: game.i18n.localize("DRPG.Panel.apply"), default: true,
                callback: (e, b, d) => ({ ...readRoomSetupForm(d, { rooms, students, categories }),
                    scenes: scenesTab.readScenesTab(d.element) })
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        render: (event, dialog) => {
            wireRoomRatio(dialog, rooms, living);
            const root = dialog.element;

            // Deliberately no REFIT on a switch. The window was measured for
            // the biggest tab when it opened and keeps that size for all of
            // them: switching tabs is a comparison, and a window that resizes
            // under a comparison is the thing being complained about.
            //
            // The footer pin is a different question and does have to be
            // redone: each tab holds a different table, so whether this
            // window scrolls sideways changes with the tab, and a bar pinned
            // for the Fog tab is wrong for Bedrooms (C-F5-8). The footer's
            // buttons themselves are Apply and Cancel on every tab (E12 C15).
            wireFogButtons(root);
            wireDashboardTabs(root, {
                onSwitch: () => requestAnimationFrame(() => pinFooterAcrossScroll(dialog))
            });
            wireTwoRoomsCheck(root, rooms);
            scenesTab.wireScenesTab(root, reason => setApplyBlock(root, "scenes", reason));
            passagesTab.wirePassagesTab(root, scene, { dialog, students });

            const recount = where => recountTokenCells(where, scene);

            wireStashCells(root);
            wirePlaceSwitches(root);
            wireTokenButtons(root, scene, recount);

            // The picture column (E77 C1): the file picker on each thumbnail, its field named `img:<room>`
            // as the description's is `desc:<room>`, and the button that empties the cell it stands in.
            wirePortraitPickers(root, { prefix: "img:" });
            for (const button of root.querySelectorAll("[data-drpg-picture-clear]")) {
                button.addEventListener("click", () => {
                    const cell = button.closest("td");
                    const field = cell?.querySelector('input[type="hidden"]');
                    if (field) field.value = "";
                    cell?.querySelector("[data-drpg-portrait]")?.removeAttribute("src");
                });
            }

            /* AND THE COUNTS FOLLOW THE TABLE THAT IS SPENDING THEM.

               Every Search a player makes writes this number, and this window is open
               during Daily Life precisely because a GM is watching them do it. Measured
               on 11.09: with Room Setup open, a room went from 1 token to 0 and the cell
               went on reading 1.

               `keepFresh` rather than `keepLive`: the count sits in a row that also
               carries the sealed checkbox and the item-table select, and those are saved
               on Apply. Swapping the region out would throw away whatever the GM has
               ticked and not yet applied, and take the three buttons above with it. So
               the numbers are written in place and nothing else is touched.

               Scoped to the search-token setting: a window this size has no business
               redrawing because somebody rolled a die. */
            keepFresh(dialog, {
                run: recount,
                watch: { settings: [SETTINGS.searchTokens] }
            });
        },
        rejectClose: false
    });

    if (!result || typeof result !== "object") return null;

    const rowResults = result.rooms;
    if (!Array.isArray(rowResults)) return null;

    if (bedroomClaimedTwice(rowResults)) return null;
    // The Scenes tab's backstop, as `bedroomClaimedTwice` is the Bedrooms tab's: nothing is written.
    if (scenesTab.scenesClash(result.scenes)) {
        ui.notifications.warn(game.i18n.localize("DRPG.TrialScene.sameScene"));
        return null;
    }
    // And its second: the trial hall is not linked, relinked or unlinked while a Class Trial runs (E13 fix r1-F2;
    // the reason for a first hall since r2-H2).
    const hallLock = scenesTab.hallLockReason(result.scenes);
    if (hallLock) {
        ui.notifications.warn(game.i18n.localize(hallLock));
        return null;
    }

    await applyDiscoveryChanges(scene, result.fogChanges ?? []);

    /* ROOMS CHANGED, NOT WRITES MADE (E12 C4, audit S08-16). The count added one per row written,
       one per stash cell and one per stash a new owner was given: one room locked, given a stash and
       given to an owner in one Apply counted 3 (the tier-2 "Room Setup writes to the scene it was
       opened on ...", before this commit, 11.10.2026). It is now the rooms any of the three touched. */
    const { changed: rowsChanged, ownerMoved } = await applyRoomRows(rowResults,
        { REST_FLAGS, setRestRoom, scene });
    const changed = new Set(rowsChanged);

    if (result.stashes && typeof result.stashes === "object") {
        for (const room of await applyStashMatrix(result.stashes, scene)) changed.add(room);
    }

    for (const room of await seedOwnerStashes(ownerMoved, scene)) changed.add(room);

    // AFTER the loop, and outside it: keys are issued by sweeping every owned
    // room, not by noticing an owner change. See `reconcileBedroomKeys` for why
    // - in short, a row the GM did not touch is skipped above, and rooms
    // assigned before keys existed are all of those. Not silent: a key arriving
    // on your sheet is news, and the sweep only writes when one was missing.
    await reconcileBedroomKeys({ silent: false });

    await scenesTab.applyScenesTab(result.scenes);

    ui.notifications.info(plural("DRPG.Vault.appliedOn", { count: changed.size, scene: scene?.name ?? "" }, "count"));
    return changed.size;
}

/** GM: look inside anybody's stash, and pull things out of it. */
export async function openVaultInspector() {
    // ONE OF THESE, NOT FOUR - see `alreadyOpen` in live.mjs. Two copies of a
    // window each read the world when they opened and neither knows about the
    // other, so the older one goes on looking authoritative while showing
    // something that stopped being true. Raised rather than refused: pressing
    // twice usually means the window is behind something.
    if (alreadyOpen("drpg-window-stashes")) return null;

    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    /* EVERY PLACE SCENE, AND EACH STASH ITS OWN THINGS (E12 C5, 1.2.74; audit S08-43). The window
       read the stashes of the scene on the GM's screen, and under each it listed everything its
       owner had stashed anywhere (`vaultContents`): a student with two stashes showed the same
       things twice, and a stash on another scene not at all (read in the code). Each place scene is a heading when there is more than one
       (the school first, rooms.mjs `placeScenes`), and a stash lists what lies in it
       (`stashItemsIn` on that scene).
       ONCE, UNDER THE FIRST SCENE (E12 fix r1-G2, 11.10.2026; review round 1 EARLY-C5-2). A stashed
       thing carries the name of its room (`ITEM_FLAGS.stashRoom`) and no scene, so a student with a
       "Storage" stash on Floor 1 and another on the Annex had each thing listed under both, and an
       unstamped one under each scene's primary stash. Which of the two holds it is not written
       anywhere this window could read, so each thing is listed once: under the first scene in
       `placeScenes`' order whose stash of its owner and room takes it, and not again below. */
    const scenes = placeScenes().map(scene => ({ scene, vaults: allVaults(scene).filter(v => v.owner) }));
    const listed = new Set();
    if (!scenes.some(entry => entry.vaults.length)) {
        ui.notifications.warn(game.i18n.localize("DRPG.Vault.noneSet"));
        return null;
    }

    const section = scene => v => {
        const items = stashItemsIn(v.owner, v.room, scene).filter(i => !listed.has(`${v.owner.id}.${i.id}`));
        items.forEach(i => listed.add(`${v.owner.id}.${i.id}`));
        const list = items.length
            ? items.map(i => `<li>${foundry.utils.escapeHTML(i.name)} - ${
                foundry.utils.escapeHTML(
                    ITEM_CATEGORIES[i.getFlag(MODULE_ID, ITEM_FLAGS.category)]?.label ?? "?")
            }</li>`).join("")
            : `<li class="notes">${game.i18n.localize("DRPG.Sheet.groupEmpty")}</li>`;
        return `<div class="drpg-vault-section">
            <h4>${foundry.utils.escapeHTML(v.owner.name)} - ${foundry.utils.escapeHTML(v.room)}${
                v.concealed ? ` · <em>${game.i18n.localize("DRPG.Vault.concealedShort")}</em>` : ""
            }</h4>
            <ul>${list}</ul>
        </div>`;
    };
    const sections = scenes.length === 1
        ? scenes[0].vaults.map(section(scenes[0].scene)).join("")
        : scenes.map(({ scene, vaults }) => `<h3>${foundry.utils.escapeHTML(scene.name ?? scene.id)}</h3>${vaults.length
            ? vaults.map(section(scene)).join("")
            : `<p class="notes">${game.i18n.localize("DRPG.Vault.noStashesOnScene")}</p>`}`).join("");

    return DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Vault.inspectTitle") },
        classes: ["drpg-panel", "drpg-window-stashes"],
        content: dialogContent(`<div>${sections}
            <p class="notes">${game.i18n.localize("DRPG.Vault.inspectNote")}</p></div>`),
        buttons: [{ action: "close", label: game.i18n.localize("DRPG.Panel.close"), default: true }],
        rejectClose: false
    });
}
