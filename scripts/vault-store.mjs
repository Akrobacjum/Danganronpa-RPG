/**
 * Danganronpa RPG - the stash's record and the rooms' flags.
 * ---------------------------------------------------------------------------
 * A character carries three usable items and two pieces of gear - a weapon, a
 * cleaning tool or a tool, in any mix, one of them in a hand - and not one
 * thing more. The stash is where the rest of what they own lives: their own
 * bedroom, three things to a stash (`VAULT_LIMIT`), and - this being a killing
 * game - searchable by anybody who walks in while they are elsewhere.
 *
 * Two flags carry the whole thing:
 *
 *   on the ROOM    `drpgVaultOwner`     whose bedroom this is
 *                  `drpgVaultConcealed` they have built a hiding place in it
 *   on the ITEM    `location`           carried, or stashed
 *
 * The item flag is the important design choice. A stashed item is still an
 * ordinary item on its owner's sheet, not a document living somewhere else - so
 * everything that sweeps a character's belongings reaches it without having to
 * know stashes exist. That is also why `killCharacter` has never needed a line
 * about stashes: back when death took the whole inventory it took the stash
 * with it, and now that it takes only the Truth Bullets it takes the stashed
 * ones alongside the carried ones. Everything else stays where it was put, to
 * be found on the body.
 *
 * WHAT IS HERE. The rooms' flags (`VAULT_FLAGS`) and the bedroom keys
 * (`KEY_FLAG`, `keysHeldBy`, `mayEnterBedroom`, `grantBedroomKey`,
 * `reconcileBedroomKeys`, `takeOldOwnersKeys` and their steps); a room's table,
 * description, picture and favours (`roomTable`, `roomDescription`,
 * `safeRoomImage`, `roomImage`, `roomFavours`, `roomHinders`); `regionsByName`
 * and the one write of a room's region flags (`updateRoom`); the stashes'
 * record - whose bedroom, which stashes a room holds and what they hold, their
 * gaps, their concealment and their lock (`vaultOwnerOf`, `stashesIn`,
 * `stashIn`, `setStash`, `ensureBedroomStash`, `bedroomStashGaps`,
 * `unconcealStashes`, `startLocked`, `isConcealed`, `stashItemsIn`,
 * `vaultContents`); the bedrooms and the room census (`allBedrooms`,
 * `allBedroomsAnywhere`, `carryRoomOnSheets`, `roomCensusOf`, `roomRatioLine`,
 * `roomsWantedFor`, `allVaults`); `setVaultRoom`; a room's pieces and a rename
 * that splits one (`registerRoomPieces`, `bedroomsOfNewScene`,
 * `clearSplitPiece`); and the marks of a stash found (`foundKey`,
 * `hasFoundStash`, `stashesFoundBy`, `forgetAllStashesFound`).
 *
 * WHERE IT SITS. Moved out of vault.mjs by E41 C6 (1.2.97), a pure move that
 * `node tools/moved-only.mjs` proves line by line, with the account of the
 * stash above, which vault.mjs's header held. vault.mjs re-exports the 51 names
 * here it exported before, so every importer but two still imports vault.mjs,
 * and nothing here imports it back (the facade rule, .claude/rules/code.md).
 * The two are fog.mjs (`roomCensus`) and fog-diagnostics.mjs (`VAULT_FLAGS`),
 * which import this file: palm.mjs reaches both by static imports (through
 * action-briefing.mjs and projects.mjs), so vault.mjs, which re-exports
 * palm.mjs, would close a static import cycle through either (R161). Room Setup
 * (room-setup.mjs) reads fifteen names of this file and the stash's reach
 * (stash-reach.mjs) ten, which is why the store is a file of its own;
 * `updateRoom` is exported now for room-setup.mjs and `foundKey` for
 * stash-reach.mjs, and vault.mjs re-exports neither.
 */

import { MODULE_ID, BEDROOM_KEY_FLAG, ROOMS_PER_PLAYER } from "./config.mjs";
import { ITEM_FLAGS, isStashed } from "./inventory.mjs";
import { trustedWrite, trustedDelete } from "./resource-guard.mjs";
// Static because `keysHeldBy` is synchronous; sheet-audit.mjs reaches this file by no static import (R161).
import { itemsHeldNow, judgedFor, flagsHeldNow } from "./sheet-audit.mjs";
// The key rule both this file and the door read (E14 part 1 C2; bedroom-keys.mjs's header).
import { keyRooms, bedroomShutTo } from "./bedroom-keys.mjs";
// The one room lookup. movement.mjs does not reach back into this file.
import { ROOM_FLAGS, roomBroken } from "./movement.mjs";
import { isDeceased, getClock } from "./settings.mjs";
import { SEARCH_FLAGS } from "./search-tokens.mjs";
import {
    whisperToOwner, whisperToGms, log, error, plural, serialWrite, esc, isPrimaryGm, forgeAsset, localeFormat
} from "./utils.mjs";
// A leaf (it imports config.mjs alone): what a room is, and the writer of its flag.
import {
    roomPieces, roomFlag, roomNames, roomRegions, flagOver, listOver, piecesByName, writablePieces, isRoom,
    joinsAnotherRoom, RENAMED_FROM
} from "./rooms.mjs";
// Statically since E12 fix r1-G1 (11.10.2026), for `clearSplitPiece`'s list of a room's flags: rest.mjs read
// its rooms through `regionsByName` here until then, which made the import a cycle; it reads rooms.mjs now.
import { REST_FLAGS } from "./rest.mjs";
// A leaf (season-exceptions.mjs alone): the registry of season state the reset walks (E42 C3).
import { registerSeasonState } from "./season-reset.mjs";

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
export async function updateRoom(scene, room, update) {
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

/*
 * A BEDROOM HAS ITS OWNER'S STASH (E89 C7, 30.10.2026; E89-22; the owner's report of 30.10: a Bedroom made no stash
 * by itself and the GM had to make one by hand). Until 1.2.91 one road seeded it - Room Setup's Apply, when a row's
 * owner changed - and three did not: `setVaultRoom` from the console, a room marked after its owner was given, and
 * (through the Stashes tab, `applyStashMatrix`) a stash read by its owner and never stored. Called on an event only,
 * never on every Apply (TRAP 76: a stash the GM removed on the Stashes tab stays removed): `setVaultRoom` when the
 * owner changes, Room Setup when a room's mark goes from none to marked, and C8's migration clause once a world.
 * Writes nothing when the room is no marked room (`setStash` refuses those), has no owner, or the owner is no actor;
 * and nothing when the owner's stash is stored already. A stash read by its owner with no stored list (the pre-E11
 * shape) is written as stored, concealment kept, so a later write of the list cannot lose it. Answers the list written,
 * or null.
 */
export async function ensureBedroomStash(scene, room) {
    if (!game.user?.isGM || !scene || !room) return null;
    const pieces = roomRegions(scene, room);
    if (!pieces.length) return null;
    const owner = vaultOwnerOf(room, scene);
    if (!owner || !game.actors?.get(owner)) return null;
    const has = stashIn(room, owner, scene);
    const stored = pieces.every(piece => Array.isArray(piece.getFlag(MODULE_ID, VAULT_FLAGS.stashes)));
    if (has && stored) return null;
    return setStash(room, owner, has ? { scene } : { concealed: false, scene });
}

/**
 * The Bedrooms of this scene whose owner has no stash in them, by name: a marked room whose owner is an actor of this
 * world and is not on its list (`stashesIn`, so a room with no stored list counts its owner's). The trial hall holds
 * no room (`roomPieces`), so none of it. Read by the clause `bedroomStashes` (E89 C8) and by R1053.
 */
export function bedroomStashGaps(scene) {
    const gaps = [];
    for (const [name, pieces] of piecesByName(scene)) {
        const owner = flagOver(pieces, VAULT_FLAGS.owner);
        if (!owner || !game.actors?.get(owner)) continue;
        if (!stashesOver(pieces).some(entry => entry.actorId === owner)) gaps.push(name);
    }
    return gaps.sort((x, y) => x.localeCompare(y));
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
 * The season reset's doors group (E42 C3; a run of season-setup.mjs `wipeSeason` until then): every piece of every
 * room (rooms.mjs) locked or open as it starts (`startLocked`); a region that is no room keeps whatever it carries. The
 * primary GM's alone.
 */
export async function clearSeasonDoors() {
    if (!isPrimaryGm()) throw new Error("the season's doors are set on the primary GM's browser alone");
    for (const scene of game.scenes) {
        for (const region of roomPieces(scene)) {
            const shouldBe = startLocked(region);
            if (Boolean(region.getFlag(MODULE_ID, ROOM_FLAGS.locked)) !== shouldBe) {
                await region.setFlag(MODULE_ID, ROOM_FLAGS.locked, shouldBe);
            }
        }
    }
}

registerSeasonState({ group: "doors", clear: clearSeasonDoors });

/**
 * Is the BEDROOM OWNER's stash in this room hidden?
 *
 * Kept because `game.drpg` exports it (api.mjs) and a GM's macro may be calling
 * it. It now answers through
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
        /* Both decimals in the page's language, "1,5" on a Polish page (E66 fix r1 F4; STATUS Open 13): the quotient with
           the one decimal `toFixed(1)` gave it, the season's rooms per student as config writes it. */
        per: living ? localeFormat("number", census.count / living, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : "-",
        target: localeFormat("number", ROOMS_PER_PLAYER),
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

    /* AN OWNER CHANGE KEEPS THE ROOM'S STASHES AND GIVES THE NEW OWNER ONE (E89 C7, 30.10.2026; E89-20, E89-22,
       Q-E89-5). A room with no stored list reads its owner as its one stash (`stashesOn`), so the owner written
       below would take the old owner's stash with it and leave what they had stashed there in no stash at all: the
       list as read now is written first (`setStash` writes the whole list it reads, so one call on its first entry
       stores it). After the write the
       new owner is given an open stash when they have none (`ensureBedroomStash`) - from the console too, which
       seeded nothing until 1.2.91 (the tier-2 "a Bedroom set up the usual way ...", red at 55ed2e36 on that road). */
    const ownerMoves = owner !== undefined && (ownerBefore ?? null) !== (owner || null);
    if (ownerMoves) {
        const pieces = roomRegions(scene, room);
        if (pieces.some(piece => !Array.isArray(piece.getFlag(MODULE_ID, VAULT_FLAGS.stashes)))) {
            const [first] = stashesOver(pieces);
            if (first) await setStash(room, first.actorId, { scene });
        }
    }
    await updateRoom(scene, room, update);
    if (ownerMoves) await ensureBedroomStash(scene, room);
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
    Hooks.on("createScene", scene => bedroomsOfNewScene(scene));
}

/**
 * A SCENE MADE WITH ITS BEDROOMS (E89 fix FG2, 30.10.2026; finding G7 of the goal review of 15c68d96). The clause
 * `bedroomStashes` (migrate.mjs, E89 C8) gives every Bedroom without its owner's stash an open one once a world, so a
 * scene exported before 1.2.91, or kept in a compendium, whose Bedroom carries the empty list the old Stashes tab wrote
 * was never seeded when imported after the clause had run. A scene's creation - an import from a compendium, a copy, a
 * script's - is an event, once a scene, so on the primary GM it runs the clause's seeding over that scene alone
 * (migrate.mjs `seedBedroomStashes`), the GMs told which rooms were written. Never at a load and never on a later event
 * of the scene (TRAP 76: a stash the GM removed stays removed). A copy of a scene whose stash a GM had removed on purpose
 * gets it back on the copy; the report is how they see it. Not this road: a scene's data replaced by Import Data on an
 * existing scene, which arrives as an update of it, not a creation (not read on v14). Answers the rows the seeding wrote
 * (a promise), or null when this browser is not the primary or the scene has no such Bedroom.
 */
export function bedroomsOfNewScene(scene) {
    if (!isPrimaryGm() || !scene || !bedroomStashGaps(scene).length) return null;
    return import("./migrate.mjs").then(m => m.seedBedroomStashes([scene])).catch(err => {
        error("Could not give the Bedrooms of a new scene their stashes", err);
        return null;
    });
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
export function foundKey(room, ownerId, scene) {
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
