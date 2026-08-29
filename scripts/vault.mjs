/**
 * Danganronpa RPG — the stash.
 * ---------------------------------------------------------------------------
 * A character carries three usable items, one crime tool and two cleaning
 * tools, and not one thing more. The stash is where the rest of what they own
 * lives: their own bedroom, uncapped, and — this being a killing game —
 * searchable by anybody who walks in while they are elsewhere.
 *
 * Two flags carry the whole thing:
 *
 *   on the ROOM    `drpgVaultOwner`     whose bedroom this is
 *                  `drpgVaultConcealed` they have built a hiding place in it
 *   on the ITEM    `location`           carried, or stashed
 *
 * The item flag is the important design choice. A stashed item is still an
 * ordinary item on its owner's sheet, not a document living somewhere else —
 * so everything that sweeps a character's belongings reaches it without having
 * to know stashes exist. Decision D1's "przedmioty noszone i w skrytce znikają"
 * was already true the moment this flag landed; `killCharacter` needed no
 * change at all.
 */

import { MODULE_ID, ITEM_CATEGORIES, BEDROOM_KEY_FLAG, ACTIONS, VAULT_LIMIT } from "./config.mjs";
import { ITEM_FLAGS, LOCATIONS, isStashed, canCarry } from "./inventory.mjs";
// The one room lookup. movement.mjs does not reach back into this file.
import { roomOfActor, ROOM_FLAGS } from "./movement.mjs";
// Static because the reader is synchronous. From settings.mjs, which is a leaf
// — this is one client-scoped boolean, and the note above the function there
// explains why it stopped living in mastermind.mjs.
import { iAmTheMastermind } from "./settings.mjs";
import { SEARCH_FLAGS } from "./search-tokens.mjs";
import { SearchTokens } from "./search-tokens.mjs";
// Static is safe: tables.mjs only reaches back into this file lazily.
import { isTierPool } from "./tables.mjs";
import { dialogContent, tableDialog, whisperToOwner, whisperToGms, announce, log, error, plural,
    workingScene, pinFooterAcrossScroll } from "./utils.mjs";
import { alreadyOpen } from "./live.mjs";

const DialogV2 = foundry.applications.api.DialogV2;

/**
 * Region flags. Prefixed like the other room flags a GM might read by hand.
 *
 * `table` and `favours` are not about stashes at all — they are what makes a
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
     * are the same fact and one of them is not — a stash is a piece of
     * furniture, and there is no reason the only place you may own one is the
     * room with your name on the door.
     *
     * So this keeps the bedroom half — the locked door in `mayEnterBedroom` and
     * the key `grantBedroomKey` issues — and hands the stash half to `stashes`
     * below. Deliberately NOT widened: a stash in somebody else's room must not
     * generate a key, or "let me hide this at your place" would buy free entry
     * to their bedroom for ever after.
     */
    owner: "drpgVaultOwner",
    /**
     * EVERY STASH IN THIS ROOM: `[{ actorId, concealed }]`.
     *
     * The bedroom owner's own stash is an ordinary member of this list — there
     * is no such thing as an "extra" stash, which is what makes the model worth
     * having. A room can hold several, none, or one belonging to somebody who
     * cannot even open the door without borrowing a key.
     *
     * ABSENT IS NOT EMPTY. A region that has never been touched since E11 falls
     * back to "the bedroom owner has an open stash here", reconstructed at read
     * time from `owner` and `concealed` — see `stashesIn`. That is the whole
     * migration: no pass to run, no world to convert, and a GM who never opens
     * the new tab sees a module that behaves exactly as it did.
     */
    stashes: "drpgStashes",
    /**
     * LEGACY, and read only through `stashesIn`'s fallback.
     *
     * Whether the bedroom owner's stash was hidden, back when a room had one
     * stash and the room was the stash. `setStash` writes `stashes` instead, so
     * this stops changing the moment a GM edits anything on the new tab — and
     * goes on being the honest answer for every region they never touch.
     */
    concealed: "drpgVaultConcealed",
    /** Name of a RollTable this room draws from, instead of the global pool. */
    table: "drpgItemTable",
    /** Item categories this room is a sensible place to look for. */
    favours: "drpgFavours",
    /** Item categories this room is a POOR place to look for — the mirror of
        `favours`: disadvantage instead of advantage on a Search aimed at one.
        A category is never on both lists; Room Setup keeps them exclusive. */
    hinders: "drpgHinders",
    /**
     * What this room looks like, in the GM's own words.
     *
     * Written in Room Setup, read by anyone standing in it — see the state
     * window in `explain.mjs`. Plain text rather than HTML: it is typed into a
     * textarea by a GM mid-session, it is shown to players, and a description
     * box that renders markup is a description box somebody can put a script
     * tag in. Escaped at every point of display.
     */
    description: "drpgRoomDescription",
    /**
     * ON A CHARACTER, not on a region — the only entry here that is.
     *
     * Which hiding places this person has FOUND, as `scene::room::ownerId`
     * strings. Written by a GM's client when a Locate roll beats its number
     * (`resolveStashSearch`), read by `openStashesHere` and by the theft
     * authority in `stealFromVault`.
     *
     * It lives on the finder because the alternative lives on the room, and the
     * room is the screen its owner opens to check their own things. Neither is
     * hidden from a console — this module has no secrets from a determined
     * player — but only one of them is somewhere the victim looks by accident.
     */
    found: "drpgStashesFound"
};

/* ==========================================================================
 * BEDROOM KEYS
 * --------------------------------------------------------------------------
 * The guide gives every student a room of their own, and a room of your own is
 * only worth having if the door means something. So a bedroom is shut to
 * everybody except the person it belongs to — and the way in for anybody else
 * is a KEY, which is an ordinary item on a character sheet.
 *
 * An item rather than a permission list, deliberately. A key can be copied and
 * handed over exactly like a Truth Bullet, so "let me into your room" is a
 * thing two players do between themselves, at the table, with an object that
 * shows up in the inventory of whoever is holding it. A permission list would
 * have been the GM's to edit and invisible to everyone else.
 *
 * The key names its room in a flag rather than in its name, because a GM can
 * rename a region and a key that stopped matching would silently stop working.
 * ========================================================================== */

/** The flag that makes an item a key, holding the room it opens. Declared in
    config.mjs, because movement.mjs reads the same flag and cannot import this
    file — see the note there. */
export const KEY_FLAG = BEDROOM_KEY_FLAG;

/** Is this item a key, and to what? */
export function keyRoomOf(item) {
    return item?.getFlag?.(MODULE_ID, KEY_FLAG) ?? null;
}

/** Every key this character is carrying, as room names. */
export function keysHeldBy(actor) {
    const rooms = new Set();
    for (const item of actor?.items ?? []) {
        const room = keyRoomOf(item);
        if (room) rooms.add(room);
    }
    return rooms;
}

/**
 * May this character open this room's door?
 *
 * A room nobody owns is not a bedroom and is not locked by this rule. The owner
 * never needs a key to their own room — losing your own key would otherwise
 * lock you out of the one place the guide says is yours.
 */
export function mayEnterBedroom(actor, room, scene = workingScene()) {
    if (!actor || !room) return true;
    const owner = vaultOwnerOf(room, scene);
    if (!owner || owner === actor.id) return true;
    return keysHeldBy(actor).has(room);
}

/**
 * Put a key to `room` on a character's sheet, unless they already hold one.
 *
 * Idempotent on purpose: Room Setup saves the whole table every time, so this
 * runs on rooms whose owner has not changed at all.
 */
export async function grantBedroomKey(actor, room, { silent = false, scene } = {}) {
    if (!game.user.isGM || !actor || !room) return null;
    if (keysHeldBy(actor).has(room)) return null;

    const { grantItem } = await import("./inventory.mjs");
    // Named on the key, so it reads as "Kaede's room" rather than "Room 3".
    // The scene is passed in by the sweep, which walks rooms on scenes nobody
    // is currently looking at — the default lookup would find no owner there
    // and write a dash into the description of a perfectly good key.
    const owner = game.actors.get(vaultOwnerOf(room, scene ?? workingScene()) ?? "");
    const item = await grantItem(actor, {
        name: game.i18n.format("DRPG.Vault.keyName", { room }),
        category: "bedroomKey",
        tier: null,
        description: `<p>${game.i18n.format("DRPG.Vault.keyDescription", {
            room: foundry.utils.escapeHTML(room),
            owner: foundry.utils.escapeHTML(owner?.name ?? "—")
        })}</p>`,
        // NO PICTURE NAMED HERE. `grantItem` falls back to the category's own
        // icon, and the category has had one since v1.1.60 — this line was
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
 * Make the world true: every bedroom's owner holds the key to it.
 *
 * WHY A SWEEP AND NOT AN EVENT. The first version issued the key from the one
 * place a room changes hands — the owner column in Room Setup — and that is
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
export async function reconcileBedroomKeys({ silent = true } = {}) {
    if (!game.user.isGM) return 0;

    let made = 0;
    for (const scene of game.scenes ?? []) {
        for (const region of scene.regions ?? []) {
            if (!region.name) continue;
            const ownerId = region.getFlag(MODULE_ID, VAULT_FLAGS.owner);
            if (!ownerId) continue;
            const owner = game.actors.get(ownerId);
            if (!owner) continue;
            if (await grantBedroomKey(owner, region.name, { silent, scene })) made++;
        }
    }

    if (made) log(`Issued ${made} missing bedroom key(s).`);
    return made;
}

/** The RollTable this room draws from, or `null` for the global pool. */
export function roomTable(room, scene = workingScene()) {
    return regionsByName(scene).get(room)?.getFlag(MODULE_ID, VAULT_FLAGS.table) || null;
}

/**
 * What the GM wrote about this room, or "" if they wrote nothing.
 *
 * Read by every client, not just the GM's — a room description is one of the
 * few pieces of the GM's own prose this game means for the table to see.
 */
export function roomDescription(room, scene = workingScene()) {
    return regionsByName(scene).get(room)?.getFlag(MODULE_ID, VAULT_FLAGS.description) ?? "";
}

/** Categories this room is a good place to search for. */
export function roomFavours(room, scene = workingScene()) {
    return regionsByName(scene).get(room)?.getFlag(MODULE_ID, VAULT_FLAGS.favours) ?? [];
}

/**
 * Does looking for this here make sense?
 *
 * The medic's office is where the medicine is. Searching the boiler room for
 * bandages should not be as good a bet, and the guide agrees: "co się znajdzie,
 * może zależeć od pomieszczenia".
 */
export function favoursCategory(room, category) {
    return roomFavours(room).includes(category);
}

/** Categories this room is a poor place to search for. */
export function roomHinders(room, scene = workingScene()) {
    return regionsByName(scene).get(room)?.getFlag(MODULE_ID, VAULT_FLAGS.hinders) ?? [];
}

/**
 * Does looking for this here make no sense?
 *
 * The other half of `favoursCategory`: bandages in the boiler room. Marked per
 * room by the GM on the same screen as the favours, and worth a real
 * disadvantage rather than mere absence of the bonus — a room can be actively
 * the wrong place to dig for a thing, not just not the best one.
 */
export function hindersCategory(room, category) {
    return roomHinders(room).includes(category);
}

/* ==========================================================================
 * WHOSE ROOM IS THIS
 * ========================================================================== */

function regionsByName(scene = workingScene()) {
    const map = new Map();
    for (const region of scene?.regions ?? []) {
        if (region.name) map.set(region.name, region);
    }
    return map;
}

/** The actor id whose BEDROOM this is, or `null`. Doors and keys, not stashes. */
export function vaultOwnerOf(room, scene = workingScene()) {
    return regionsByName(scene).get(room)?.getFlag(MODULE_ID, VAULT_FLAGS.owner) ?? null;
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
 * way. A region with no `stashes` flag is not a room with no stashes — it is a
 * room nobody has edited since E11 — so the old pair of flags is translated on
 * the spot into the one entry they used to mean. Nothing is written, which
 * matters more than it looks: this runs on players' clients too, where a write
 * would be refused, and a migration that only completes when a GM logs in is a
 * migration that makes the same world behave differently for different people.
 *
 * The array is rebuilt rather than handed back, so no caller can edit the
 * region's stored flag by mutating what it was given.
 */
export function stashesIn(room, scene = workingScene()) {
    return stashesOn(regionsByName(scene).get(room));
}

/**
 * The same answer, from a region already in hand.
 *
 * `regionsByName` rebuilds its Map on every call — cheap once, and quadratic
 * from anything that wants to look at every room. Splitting the body out is
 * what lets the walkers below build that Map once instead of once per room.
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
export function stashIn(room, actorId, scene = workingScene()) {
    return stashesIn(room, scene).find(entry => entry.actorId === actorId) ?? null;
}

/** Every room on the scene where this character has a stash. */
export function stashRoomsFor(actor, scene = workingScene()) {
    if (!actor) return [];
    const out = [];
    for (const [name, region] of regionsByName(scene)) {
        const mine = stashesOn(region).find(entry => entry.actorId === actor.id);
        if (mine) out.push({ room: name, concealed: mine.concealed });
    }
    return out;
}

/**
 * The stash an unaddressed item belongs to — overflow, and anything stashed
 * before E11.
 *
 * THEIR BEDROOM WINS when they have a stash in it, even if they built another
 * one first. Any other rule makes "where did my overflow go" depend on the
 * order a GM happened to tick boxes in, and the bedroom is the one room a
 * player can always get back into.
 */
export function primaryStashRoom(actor, scene = workingScene()) {
    if (!actor) return null;

    // ONE WALK ANSWERS BOTH HALVES. The obvious spelling — `stashRoomsFor` and
    // then `vaultRoomOwnedBy` — builds the region map twice inside a function
    // that `stashItemsIn` used to call once per stashed item: measured at
    // 0.218 ms per call with twelve things in a stash and eighteen regions,
    // which is the same order as the whole visibility pass this module
    // deliberately keeps. Not a fire, but a quadratic with a free fix.
    let first = null;
    let bedroom = null;
    for (const [name, region] of regionsByName(scene)) {
        if (!stashesOn(region).some(entry => entry.actorId === actor.id)) continue;
        if (first === null) first = name;
        if (region.getFlag(MODULE_ID, VAULT_FLAGS.owner) === actor.id) bedroom = name;
    }
    return bedroom ?? first;
}

/** The room this character's bedroom IS, owner flag only. */
export function vaultRoomOwnedBy(actor, scene = workingScene()) {
    if (!actor) return null;
    for (const [name, region] of regionsByName(scene)) {
        if (region.getFlag(MODULE_ID, VAULT_FLAGS.owner) === actor.id) return name;
    }
    return null;
}

/**
 * GM: add, remove or re-hide one person's stash in one room.
 *
 * Writes the whole list because a region flag has no per-element update — and
 * writing it at all is what materialises `stashesIn`'s reconstruction for that
 * region, which is exactly when it should happen: the moment somebody edits
 * this room, the old two-flag shape stops being the source of truth for it.
 */
export async function setStash(room, actorId, { present = undefined, concealed = undefined } = {}) {
    if (!game.user.isGM || !room || !actorId) return null;

    const region = regionsByName().get(room);
    if (!region) return null;

    const list = stashesIn(room);
    const at = list.findIndex(entry => entry.actorId === actorId);

    if (present === false) {
        if (at < 0) return list;

        /*
         * A STASH WITH SOMETHING IN IT IS NOT REMOVED (E11, measured in E17).
         *
         * The Room Setup dialog has always refused this and named the count, so
         * at the table it was covered. `setStash` itself did not, and it is on
         * `game.drpg` — so a macro, a console line or a feature written next
         * month could take the stash away and leave the items behind: still
         * flagged as stashed, so hidden from their owner's sheet, in a room with
         * nowhere to take them out of. A lost item, silently.
         *
         * Measured before this: stash removed, `stashItemsIn` still returning 1,
         * and not a single notification.
         *
         * The dialog keeps its own pre-check, because refusing one cell in a
         * batch and carrying on is better than failing the Apply — this is the
         * floor under it, not a replacement for it.
         */
        const owner = game.actors.get(actorId);
        const held = owner ? stashItemsIn(owner, room).length : 0;
        if (held) {
            ui.notifications.warn(game.i18n.format("DRPG.Vault.stashNotEmpty", {
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

    await region.update({ [`flags.${MODULE_ID}.${VAULT_FLAGS.stashes}`]: list });
    return list;
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
 * Kept because `game.drpg` exports it and a GM's macro may be calling it — see
 * the compatibility note at the bottom of this file. It now answers through
 * `stashesIn`, so it means the same thing it always did on an untouched world
 * and the right thing on an edited one. Anything asking about a specific
 * person's stash should call `stashIn(room, actorId).concealed` instead: this
 * cannot answer for the stash somebody built in a room that is not theirs.
 */
export function isConcealed(room, scene = workingScene()) {
    const ownerId = vaultOwnerOf(room, scene);
    if (!ownerId) return false;
    return Boolean(stashIn(room, ownerId, scene)?.concealed);
}

/**
 * The room this character stashes things in by default.
 *
 * A compatibility name: before E11 there was only ever one, so "their stash
 * room" and "their bedroom" were the same sentence. It answers `primaryStashRoom`
 * now — the bedroom when they have a stash in it, the first one otherwise —
 * which is the closest true thing to what every existing caller meant.
 */
export function vaultRoomFor(actor, scene = workingScene()) {
    return primaryStashRoom(actor, scene);
}

/** Which stash an item is lying in. Unmarked means the owner's primary. */
export function stashRoomOfItem(item, owner, scene = workingScene()) {
    return item?.getFlag?.(MODULE_ID, ITEM_FLAGS.stashRoom)
        ?? primaryStashRoom(owner, scene);
}

/** What this character has stashed in ONE room. */
export function stashItemsIn(actor, room, scene = workingScene()) {
    if (!actor || !room) return [];
    // The primary is a fact about the CHARACTER, not about each item, so it is
    // worked out once. Calling `stashRoomOfItem` per item asked the same
    // question of the same region map once per thing in the drawer.
    const primary = primaryStashRoom(actor, scene);
    return vaultContents(actor).filter(i =>
        (i.getFlag(MODULE_ID, ITEM_FLAGS.stashRoom) ?? primary) === room);
}

/**
 * Every BEDROOM on the scene, as {room, owner}.
 *
 * Split out of `allVaults` at E11, and the split is a rule rather than tidying:
 * keys are a bedroom fact and stashes are not. `allVaults` now lists stashes,
 * so a key dialog reading it would happily offer a key to a room where somebody
 * merely built a hiding place — and "let me stash this at your place" would buy
 * permanent entry to their bedroom. That is precisely the leak the two flags
 * were separated to prevent.
 */
export function allBedrooms(scene = workingScene()) {
    const out = [];
    for (const [name, region] of regionsByName(scene)) {
        const ownerId = region.getFlag(MODULE_ID, VAULT_FLAGS.owner);
        if (!ownerId) continue;
        out.push({ room: name, owner: game.actors.get(ownerId) ?? null });
    }
    return out;
}

/** Every stash on the scene, wherever it is and whoever it belongs to. */
export function allVaults(scene = workingScene()) {
    const out = [];
    for (const [name] of regionsByName(scene)) {
        for (const entry of stashesIn(name, scene)) {
            out.push({
                room: name,
                owner: game.actors.get(entry.actorId) ?? null,
                concealed: entry.concealed,
                // Whether this is the room with their name on the door. The
                // Stashes tab shades that column, and it is the difference
                // between "their drawer" and "something they built at
                // somebody else's place".
                bedroom: vaultOwnerOf(name, scene) === entry.actorId
            });
        }
    }
    return out;
}

/** GM: point a room at an owner, and say whether it is concealed. */
export async function setVaultRoom(room, {
    owner = undefined, concealed = undefined, table = undefined,
    favours = undefined, hinders = undefined, description = undefined
} = {}) {
    if (!game.user.isGM) return null;

    const region = regionsByName().get(room);
    if (!region) return null;

    const update = {};
    if (owner !== undefined) update[`flags.${MODULE_ID}.${VAULT_FLAGS.owner}`] = owner || null;
    if (concealed !== undefined) {
        update[`flags.${MODULE_ID}.${VAULT_FLAGS.concealed}`] = Boolean(concealed);
    }
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
    if (!Object.keys(update).length) return null;

    await region.update(update);
    return region;
}

/* ==========================================================================
 * WHAT IS IN IT
 * ========================================================================== */

/** Everything this character has stashed. Uncapped by design. */
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
 * onto the item — a boolean would have made the caller ask the same question
 * again and get a different answer for anybody with two stashes.
 */
export async function myStashHere(actor) {
    if (!actor) return null;
    const { roomOfActor } = await import("./movement.mjs");
    const room = roomOfActor(actor);
    if (!room) return null;
    return stashIn(room, actor.id) ? room : null;
}

/** Compatibility: `game.drpg.atOwnVault` predates several stashes. */
export async function atOwnVault(actor) {
    return Boolean(await myStashHere(actor));
}

/**
 * Put something away. No action, no roll — but you have to be there.
 *
 * Truth Bullets are refused outright: they are not objects in a drawer, they
 * are what the character knows, and hiding one would only mean hiding it from
 * the trial the whole game is pointed at.
 */
export async function stow(actor, item) {
    if (!actor || !item) return false;

    if (item.getFlag(MODULE_ID, ITEM_FLAGS.category) === "truthBullet") {
        ui.notifications.warn(game.i18n.localize("DRPG.Vault.noBullets"));
        return false;
    }
    if (isStashed(item)) return false;

    // WHICH stash, not whether. A character may have one here, one in their
    // bedroom and none at all, and the thing goes in the one they are standing
    // over — stamped onto the item so nothing has to work it out again.
    const room = await myStashHere(actor);
    if (!room) {
        ui.notifications.warn(game.i18n.localize("DRPG.Vault.notHere"));
        return false;
    }

    /*
     * A STASH HOLDS THREE (D10b).
     *
     * It held everything, which made the carry limits above it decorative: a
     * character with a full stash in their bedroom was carrying two things and
     * OWNING nine, and the question the limits exist to ask — what do you have
     * on you tonight — had a free answer waiting at home.
     *
     * Counted PER ROOM rather than per character, because that is what a stash
     * is: two hiding places are two hiding places, and somebody who has earned
     * a second one has earned what it holds.
     */
    const here = vaultContents(actor)
        .filter(i => i.getFlag(MODULE_ID, ITEM_FLAGS.stashRoom) === room);
    if (here.length >= VAULT_LIMIT) {
        ui.notifications.warn(game.i18n.format("DRPG.Vault.full",
            { room, limit: VAULT_LIMIT }));
        return false;
    }

    try {
        await item.update({
            [`flags.${MODULE_ID}.${ITEM_FLAGS.location}`]: LOCATIONS.vault,
            [`flags.${MODULE_ID}.${ITEM_FLAGS.stashRoom}`]: room
        });
    } catch (err) {
        error("Could not stash the item", err);
        return false;
    }

    log(`${actor.name} stashed "${item.name}" in ${room}.`);
    return true;
}

/** Take something back out. The carry limit has a say on the way out. */
export async function retrieve(actor, item) {
    if (!actor || !item || !isStashed(item)) return false;

    // In the room this particular thing is in — not merely in one of yours.
    // Two stashes and a shared "am I at a stash" test would let a player pull
    // something out of a drawer on the other side of the building.
    const here = await myStashHere(actor);
    if (!here || stashRoomOfItem(item, actor) !== here) {
        ui.notifications.warn(game.i18n.localize("DRPG.Vault.notHere"));
        return false;
    }

    const category = item.getFlag(MODULE_ID, ITEM_FLAGS.category);
    const room = canCarry(actor, category);
    if (!room.ok) {
        ui.notifications.warn(game.i18n.format("DRPG.Inventory.full", {
            category: ITEM_CATEGORIES[category]?.plural ?? category,
            limit: room.limit
        }));
        return false;
    }

    try {
        // The stash it was in goes with it: a carried item has no stash, and a
        // stale room name would decide where it lands if it is ever put back.
        await item.update({
            [`flags.${MODULE_ID}.${ITEM_FLAGS.location}`]: LOCATIONS.carried,
            [`flags.${MODULE_ID}.${ITEM_FLAGS.stashRoom}`]: null
        });
    } catch (err) {
        error("Could not take the item out of the stash", err);
        return false;
    }

    log(`${actor.name} took "${item.name}" out of their stash.`);
    return true;
}

/* ==========================================================================
 * SOMEBODY ELSE'S STASH
 * ========================================================================== */

/**
 * Whose stash is in the room this character is standing in, if it is open.
 *
 * "Open" means not concealed. A concealed stash is one its owner has built a
 * hiding place for — a project — and finding that is what the Search action's
 * own stash branch is for, at a penalty, with a roll. An unconcealed stash is
 * just a drawer in a bedroom: anyone who walks in can go through it, which is
 * exactly the pressure a killing game wants on leaving your things lying about.
 *
 * @returns {{owner: Actor, room: string, items: Item[]}|null}
 */
export function openStashesHere(actor) {
    if (!actor) return [];

    // `roomOfActor` is the module's one answer to "which room is this actor in"
    // — it already handles unlinked tokens, an empty region set and the
    // geometric fallback. A local re-implementation here was a third copy of
    // that logic, and a copy of a geometric test is a copy that drifts.
    const room = roomOfActor(actor);
    if (!room) return [];

    const mastermind = iAmTheMastermind();
    const out = [];
    for (const entry of stashesIn(room)) {
        if (entry.actorId === actor.id) continue;         // yours is not a theft
        // Hidden: needs a Search — unless you are the Mastermind, to whom a
        // hiding place is furniture they watched being built (Dawid, 26.08).
        // The GM-side authority in `stealFromVault` makes the same exception.
        //
        // Or unless you FOUND it: `Analyze -> Locate a hidden stash` opens one
        // hiding place to one person, and after that it is simply a stash they
        // know about. See `resolveStashSearch`.
        if (entry.concealed && !mastermind
            && !hasFoundStash(actor, room, entry.actorId)) continue;

        const owner = game.actors.get(entry.actorId);
        if (!owner) continue;
        out.push({ owner, room, items: stashItemsIn(owner, room) });
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
 * The write itself is GM-only — it touches two sheets — so it goes over the
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
        ui.notifications.info(game.i18n.format("DRPG.Vault.stashEmpty", {
            who: stashes.map(entry => entry.owner.name).join(", ")
        }));
        return false;
    }

    const room = stocked[0].room;
    const esc = foundry.utils.escapeHTML;
    const describe = i => {
        const tier = i.getFlag(MODULE_ID, ITEM_FLAGS.tier);
        const cat = ITEM_CATEGORIES[i.getFlag(MODULE_ID, ITEM_FLAGS.category)]?.label ?? "";
        return esc(`${i.name}${cat ? ` — ${cat}` : ""}${
            tier !== null && tier !== undefined ? ` (T${tier})` : ""}`);
    };

    /*
     * ONE LIST, GROUPED BY WHOSE IT IS.
     *
     * A room can hold several stashes now, and asking "whose drawer?" and then
     * "which thing?" would be two questions where the answer to the first is
     * visible in the second. So they are one `<select>` with an `<optgroup>`
     * per owner — and the owner id rides in the value, because the GM side has
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
    await requestVaultSteal({ thiefId: actor.id, ownerId, itemId });
    return true;
}

/**
 * Take one thing out of a stash that is not yours. GM-side: it writes to the
 * owner's sheet and to the thief's.
 *
 * The item moves rather than being copied — this is theft, and the owner
 * noticing that something is missing is the entire point.
 *
 * AND UNTIL NOW THE OWNER WAS NEVER TOLD. The sentence above has been in this
 * file since it was written, the thief's own card said "They will notice it is
 * gone", and no code anywhere put that in front of the victim: the only whisper
 * went to the thief. `clumsy` is what closes it — see below.
 */
export async function stealFromVault({
    thiefId, ownerId, itemId, viaSearch = false, clumsy = false
} = {}) {
    if (!game.user.isGM) return null;

    const thief = game.actors.get(thiefId);
    const owner = game.actors.get(ownerId);
    const item = owner?.items?.get(itemId);
    if (!thief || !owner || !item || !isStashed(item)) return null;

    // The dead rob nobody. A socket payload is a claim, and this side is the
    // one that decides — the same reasoning `handover.mjs` applies to a gift.
    const { isDeceased } = await import("./chapter.mjs");
    if (isDeceased(thief)) {
        error(`Refused a stash theft: ${thief.name} is dead.`);
        return null;
    }

    /*
     * And you have to be standing in it.
     *
     * `rifleStashDialog` says in its own comment that "stealFromVault re-checks
     * everything on that side" — and this side checked that the item was stashed
     * and nothing else. Every condition that makes a stash a stash lived only in
     * the picker on the thief's own client, so a payload naming an owner and an
     * item id took anything from anyone: from across the map, from a stash the
     * thief had never found, from one still concealed by its owner's project.
     *
     * `locateActor`, not `roomOfActor`: this runs on a GM's client, which is
     * usually looking at a different scene from the theft, and the canvas-bound
     * lookup would report the thief as standing nowhere and refuse every honest
     * attempt instead.
     */
    const { locateActor } = await import("./movement.mjs");
    const where = locateActor(thief);
    const refuse = why => {
        error(`Refused a stash theft by ${thief.name}: ${why}.`);
        return null;
    };

    if (!where?.room) return refuse("they are not standing in any room");

    /*
     * "IS THERE A STASH OF THEIRS HERE", not "is this their bedroom".
     *
     * These were the same question until E11 and are not any more: a stash
     * built in somebody else's room has no `drpgVaultOwner` pointing at its
     * owner, so the old test refused every theft from one as a forged packet —
     * the honest player would have been the only person it stopped.
     */
    const entry = stashIn(where.room, owner.id, where.scene);
    if (!entry) {
        return refuse(`"${where.room}" holds no stash of ${owner.name}'s`);
    }

    // And the thing has to be in THAT stash, not merely in one of theirs
    // somewhere on the map — the same distinction `retrieve` makes.
    if (stashRoomOfItem(item, owner, where.scene) !== where.room) {
        return refuse(`"${item.name}" is not in the stash in "${where.room}"`);
    }

    /*
     * Concealment is a gate on the FREE route only.
     *
     * Two things call this. `rifleStashDialog` is the drawer-in-a-bedroom case:
     * no action, no roll, and therefore no business opening a hiding place its
     * owner built a project for. The Search action is the other, and it is the
     * one the concealment penalty exists FOR — `performSearch` subtracts a
     * situational -1 precisely because the stash is hidden, spends a search
     * token and an action, and only then asks for a specific item.
     *
     * Refusing both left the paid route unable to produce anything at all: a
     * player could roll against a stiffer difficulty, succeed, be told what they
     * found, and receive nothing — while an unconcealed stash handed its
     * contents over for free. The guard was inverting the value of the project
     * that concealed it.
     *
     * `viaSearch` is a claim the sender makes, like the `total` on an Observe
     * and for the same reason: this side can verify who you are and where you
     * are standing, never what you spent. Forging it buys exactly what an honest
     * Search of the same room would have bought — the room and owner checks
     * above still bind — so it is worth no more than the action it skips.
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
        if (!isMastermind(thief)
            && !hasFoundStash(thief, where.room, owner.id, where.scene)) {
            return refuse("that stash is concealed and has to be found first");
        }
    }

    const category = item.getFlag(MODULE_ID, ITEM_FLAGS.category);
    const { grantItem, preservedFlags } = await import("./inventory.mjs");

    const copy = await grantItem(thief, {
        name: item.name,
        category,
        tier: item.getFlag(MODULE_ID, ITEM_FLAGS.tier) ?? null,
        description: item.system?.description ?? "",
        img: item.img,
        // Stealing a ruined thing out of somebody's drawer does not mend it —
        // and hiding one there and having it lifted was the obvious way to
        // launder a broken murder weapon back into a working one.
        extraFlags: preservedFlags(item)
    });
    if (!copy) return null;

    try {
        await item.delete();
    } catch (err) {
        error("Could not remove the stolen item from the stash", err);
    }

    await whisperToOwner(thief, `<p>${game.i18n.format("DRPG.Vault.stole", {
        item: foundry.utils.escapeHTML(item.name),
        who: foundry.utils.escapeHTML(owner.name)
    })}</p>`);

    /*
     * THE VICTIM, WHEN THE THIEF FUMBLED IT.
     *
     * Not every theft: a stash you already knew about and opened deliberately
     * stays silent, which is what makes finding one worth the action. Only a
     * Search that came up with Despair — the module's standing shorthand for
     * "you did it, badly" — leaves the drawer disturbed enough to notice.
     *
     * NO NAME, EVER, and not even a category. What arrives is "somebody has
     * been in here", because that is what an emptied hiding place tells you;
     * working out who is what Observe, Analyze and the trial are for.
     *
     * AND THE THIEF IS NOT TOLD THEY WERE SLOPPY. That is this module's rule
     * for every trace it drops, not a special case invented here: Hope and a
     * critical tell you what you left behind, a plain Despair never does. Which
     * is also why `DRPG.Vault.stole` no longer ends "They will notice it is
     * gone" — it said so unconditionally, and it was false in both directions.
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

    log(`${thief.name} took "${item.name}" from ${owner.name}'s stash`
        + `${clumsy ? " and was clumsy enough to leave it showing" : ""}.`);
    return copy;
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
 * Take something out of somebody's pockets. GM side.
 *
 * TWO NUMBERS ARRIVE, TWO VERDICTS ARE MADE HERE. The thief's client throws the
 * dice and names a victim; whether 14 was beaten, whether 15 was beaten, what
 * the pool actually contains and whether the victim is told are all decided on
 * this side against `ACTIONS.steal` — the same division of labour as Observe,
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
 */
export async function stealFromPerson({
    thiefId, victimId, itemId = null,
    total = 0, isCritical = false, unseenTotal = 0, unseenCritical = false
} = {}) {
    if (!game.user.isGM) return null;

    const thief = game.actors.get(thiefId);
    const victim = game.actors.get(victimId);
    if (!thief || !victim || thief.id === victim.id) return null;

    const refuse = why => {
        error(`Refused a theft by ${thief.name}: ${why}.`);
        return null;
    };

    // The dead neither rob nor are robbed. Looting a body is a different action
    // with different rules — see `requestBodyLoot` — and routing it through here
    // would let a corpse be picked over from the far side of a Shadow roll.
    const { isDeceased } = await import("./chapter.mjs");
    if (isDeceased(thief)) return refuse("they are dead");
    if (isDeceased(victim)) return refuse(`${victim.name} is dead; that is looting, not theft`);

    /*
     * AND YOU HAVE TO BE STANDING NEXT TO THEM.
     *
     * `locateActor`, not `roomOfActor`: this runs on a GM's client, which is
     * usually looking at a different scene from the theft, and the canvas-bound
     * lookup would report both of them as standing nowhere.
     */
    const { locateActor } = await import("./movement.mjs");
    const here = locateActor(thief);
    const there = locateActor(victim);
    if (!here?.room) return refuse("they are not standing in any room");
    if (here.room !== there?.room) {
        return refuse(`${victim.name} is not in "${here.room}"`);
    }

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
     * whatever comes out — the id is ignored, not honoured quietly, because a
     * client that sends one on a non-critical is either out of date or trying
     * it on, and both deserve the same answer.
     */
    const { carriedInCategory, preservedFlags, grantItem } = await import("./inventory.mjs");
    const pool = Object.keys(ITEM_CATEGORIES)
        .filter(c => c !== "truthBullet")
        .flatMap(c => carriedInCategory(victim, c));

    let item = null;
    if (success && pool.length) {
        const wanted = isCritical ? pool.find(i => i.id === itemId) : null;
        item = wanted ?? pool[Math.floor(Math.random() * pool.length)];
    }

    // Nothing in their pockets is not a failure — the hand went in, and whether
    // it was noticed is still a live question. The two whispers below say so.
    const empty = success && !pool.length;

    let copy = null;
    let handsFull = false;
    if (item) {
        copy = await grantItem(thief, {
            name: item.name,
            category: item.getFlag(MODULE_ID, ITEM_FLAGS.category),
            tier: item.getFlag(MODULE_ID, ITEM_FLAGS.tier) ?? null,
            description: item.system?.description ?? "",
            img: item.img,
            // A stolen broken thing stays broken, and a stolen crowbar is still
            // a weapon. Same reasoning as the stash theft directly above.
            extraFlags: preservedFlags(item)
        });

        if (copy) {
            try {
                /*
                 * THE QUIET HALF, AND IT IS ONE OPTION ON ONE CALL.
                 *
                 * `render: false` travels with the deletion over Foundry's own
                 * socket, so the victim's open sheet does not redraw for THIS
                 * change. The item has really gone — they cannot use it, give
                 * it away or find it again — and what is suppressed is the
                 * redraw, not the fact.
                 *
                 * A sheet redraws for a great many other reasons (a resource
                 * moving, Despair, an incident starting), so the row can come
                 * off the screen a moment later. That is the promise being made
                 * and it is the honest one: not "they will never see", but
                 * "they will not see because of this" — trap 90. Clicking the
                 * stale row is handled where the rows are drawn (trap 91).
                 *
                 * When they ARE told, there is nothing to hide and the render
                 * goes ahead: a suppressed refresh next to a whisper naming the
                 * thief is just a way of losing one of the two messages.
                 */
                await item.delete({ render: seen });
            } catch (err) {
                error("Could not take the stolen item off its owner", err);
            }
        } else {
            // The carry limit refused it. The item stays where it is — the
            // alternative is deleting somebody's property to make room for a
            // copy that was never created.
            handsFull = true;
        }
    }

    const esc = foundry.utils.escapeHTML;
    const took = Boolean(copy);

    // The thief always learns what happened to them, including whether they
    // were noticed — that is what the Shadow roll was for.
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
     * something you catch somebody doing. So this says who — and, when they
     * actually got something, what.
     *
     * Both failures are worth telling. Being caught trying is one of the better
     * scenes this action produces, and a Shadow roll that answers "did they
     * notice you" has to be allowed to answer it about an attempt.
     */
    if (seen) {
        try {
            await whisperToOwner(victim, `<p>${game.i18n.format(
                took ? "DRPG.Steal.caughtTaking" : "DRPG.Steal.caughtTrying",
                { who: esc(thief.name), item: esc(item?.name ?? "") }
            )}</p>`, { flags: { [MODULE_ID]: { sfx: "stolen" } } });
        } catch (err) {
            error("Could not tell the victim of a theft", err);
        }
    }

    log(`${thief.name} ${took ? "took" : "failed to take"} `
        + `${took ? `"${item.name}" ` : ""}from ${victim.name}`
        + `${seen ? " and was seen" : " unseen"}.`);

    return { took, seen, item: item?.name ?? null, handsFull, empty };
}



/**
 * Leave something in somebody's pocket. GM side, and the mirror of the theft
 * directly above — same two axes, same two numbers, the item travelling the
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
 *   pockets — no critical branch, because there is nothing left to choose.
 * @param {number} options.total        The Hand roll.
 * @param {number} options.unseenTotal  The Shadow roll.
 */
export async function plantOnPerson({
    plannerId, victimId, itemId = null,
    total = 0, isCritical = false, unseenTotal = 0, unseenCritical = false
} = {}) {
    if (!game.user.isGM) return null;

    const planter = game.actors.get(plannerId);
    const victim = game.actors.get(victimId);
    const item = planter?.items?.get(itemId ?? "");
    if (!planter || !victim || planter.id === victim.id || !item) return null;

    const refuse = why => {
        error(`Refused a plant by ${planter.name}: ${why}.`);
        return null;
    };

    const { isDeceased } = await import("./chapter.mjs");
    if (isDeceased(planter)) return refuse("they are dead");
    // Planting evidence on a corpse is a real thing somebody will want to do,
    // and it is not this action: a body is not carrying anything any more, and
    // the crime scene has its own rules. Refused here rather than silently
    // allowed, so the reason exists in one place.
    if (isDeceased(victim)) return refuse(`${victim.name} is dead`);

    const { locateActor } = await import("./movement.mjs");
    const here = locateActor(planter);
    const there = locateActor(victim);
    if (!here?.room) return refuse("they are not standing in any room");
    if (here.room !== there?.room) return refuse(`${victim.name} is not in "${here.room}"`);

    /*
     * THE POOL IS REBUILT HERE, exactly as it is for a theft (trap 92) — and
     * the same two exclusions, for the same reasons read backwards. A Truth
     * Bullet cannot be planted because it is knowledge rather than an object,
     * and something in a stash cannot be planted because it is not in a hand.
     */
    const { carriedInCategory, preservedFlags, grantItem } = await import("./inventory.mjs");
    const pool = Object.keys(ITEM_CATEGORIES)
        .filter(c => c !== "truthBullet")
        .flatMap(c => carriedInCategory(planter, c));
    if (!pool.some(i => i.id === item.id)) {
        return refuse(`"${item.name}" is not something they are carrying`);
    }

    const def = ACTIONS.palm;
    const success = Boolean(isCritical) || Number(total) >= def.threshold;
    const seen = !(Boolean(unseenCritical) || Number(unseenTotal) >= def.unseen.threshold);

    let landed = null;
    let handsFull = false;
    if (success) {
        landed = await grantItem(victim, {
            name: item.name,
            category: item.getFlag(MODULE_ID, ITEM_FLAGS.category),
            tier: item.getFlag(MODULE_ID, ITEM_FLAGS.tier) ?? null,
            description: item.system?.description ?? "",
            img: item.img,
            // A planted broken thing stays broken — which is most of the point.
            // The best use of this action is getting a ruined murder weapon out
            // of your own pocket and into somebody else's, and it would be
            // worth nothing if the transfer mended it.
            extraFlags: preservedFlags(item),
            // The quiet half, and the mirror of the silent Steal: the victim's
            // sheet does not redraw FOR THIS. See `grantItem`.
            quiet: !seen
        });

        if (landed) {
            try {
                await item.delete();
            } catch (err) {
                error("Could not take the planted item off the person planting it", err);
            }
        } else {
            // Their pockets are full. The item stays where it was — the
            // alternative is deleting somebody's property into a copy that was
            // never created.
            handsFull = true;
        }
    }

    const esc = foundry.utils.escapeHTML;
    const done = Boolean(landed);

    await whisperToOwner(planter, `<p>${game.i18n.format(
        done ? "DRPG.Steal.cardPlanted"
            : handsFull ? "DRPG.Steal.cardTheirHandsFull"
            : "DRPG.Steal.cardPlantMissed",
        { item: esc(item.name), who: esc(victim.name) }
    )}</p><p><small>${game.i18n.localize(seen
        ? "DRPG.Steal.cardSeen" : "DRPG.Steal.cardUnseen")}</small></p>`);

    /*
     * AND THE VICTIM, ONLY WHEN THEY NOTICED — with the item named.
     *
     * The asymmetry with a theft is worth stating: a stolen thing is missed
     * later, so the silent case has a natural discovery. A planted thing has
     * none — nobody audits their own pockets for things that should not be
     * there — which is exactly what makes the unnoticed plant worth an action,
     * and exactly why the noticed one has to be unambiguous.
     */
    if (seen) {
        try {
            await whisperToOwner(victim, `<p>${game.i18n.format(
                done ? "DRPG.Steal.caughtPlanting" : "DRPG.Steal.caughtTryingPlant",
                { who: esc(planter.name), item: esc(item.name) }
            )}</p>`, { flags: { [MODULE_ID]: { sfx: "stolen" } } });
        } catch (err) {
            error("Could not tell the victim of a plant", err);
        }
    }

    log(`${planter.name} ${done ? "planted" : "failed to plant"} `
        + `"${item.name}" on ${victim.name}${seen ? " and was seen" : " unseen"}.`);

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
 * Either is world data and therefore readable from any console — this module
 * has no secrets from a determined player, and never claims to. What differs is
 * where somebody looks by accident: a flag on the region is on the screen the
 * owner opens to check their own room, while a flag on the finder's sheet is
 * somewhere the owner has no reason to be. Same leak on paper, a different one
 * in practice.
 *
 * WRITTEN BY A GM'S CLIENT, though the finder owns their own actor and could
 * write it themselves. The write is the only thing standing between "rolled a
 * 16" and "reads other people's hiding places", so it goes the same way every
 * other verdict in this module goes — see `resolveStashSearch`.
 * ========================================================================== */

/** One key per stash, so two stashes in one room stay separate. */
function foundKey(room, ownerId, scene = workingScene()) {
    return `${scene?.id ?? "?"}::${room}::${ownerId}`;
}

/** Has this character already found that hiding place? */
export function hasFoundStash(actor, room, ownerId, scene = workingScene()) {
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
 * concealed one at all. Not "every stash here" — a room can hold several, and
 * one roll opening all of them would make the second one free.
 *
 * A miss and an empty room are told apart for the FINDER and not for anybody
 * else: "you found nothing" is what an action buys, and it is the same sentence
 * whether the room was empty or the dice were bad. Saying which would answer the
 * question the next attempt is for.
 */
export async function resolveStashSearch({ actorId, total = 0, isCritical = false } = {}) {
    if (!game.user.isGM) return null;

    const actor = game.actors.get(actorId);
    if (!actor) return null;

    const { locateActor } = await import("./movement.mjs");
    const where = locateActor(actor);
    if (!where?.room) return { found: false, reason: "noRoom" };

    const beat = Boolean(isCritical) || Number(total) >= (ACTIONS.analyze?.stashThreshold ?? 16);
    if (!beat) {
        await whisperToOwner(actor, `<p>${game.i18n.localize("DRPG.Analyze.stashNothing")}</p>`);
        return { found: false, reason: "missed" };
    }

    // Yours is not a discovery, and one already found is not a second one.
    const here = stashesIn(where.room, where.scene)
        .filter(e => e.concealed && e.actorId !== actor.id)
        .filter(e => !hasFoundStash(actor, where.room, e.actorId, where.scene));

    let target = null;
    for (const entry of here) {
        const owner = game.actors.get(entry.actorId);
        if (!owner) continue;
        if (!target) target = { entry, owner };
        if (stashItemsIn(owner, where.room, where.scene).length) { target = { entry, owner }; break; }
    }

    if (!target) {
        await whisperToOwner(actor, `<p>${game.i18n.localize("DRPG.Analyze.stashNothing")}</p>`);
        return { found: false, reason: "none" };
    }

    const found = stashesFoundBy(actor);
    found.push(foundKey(where.room, target.owner.id, where.scene));
    await actor.setFlag(MODULE_ID, VAULT_FLAGS.found, found);

    const esc = foundry.utils.escapeHTML;
    await whisperToOwner(actor, `<p>${game.i18n.format("DRPG.Analyze.stashFound", {
        who: esc(target.owner.name), room: esc(where.room)
    })}</p>`);

    /*
     * THE OWNER IS NOT TOLD, and that is the rule this action was written with
     * — "bez powiadamiania właściciela". Being found out is something they
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
    return { found: true, owner: target.owner.name, room: where.room };
}

/* ==========================================================================
 * GM SETUP
 * ========================================================================== */

/**
 * One screen for everything a room IS.
 *
 * Whose bedroom it is, whether the stash in it is hidden, what searching it
 * draws from, what it is a good place to search for — and, since they are the
 * same kind of question asked of the same regions on the same evening, which
 * rests it allows. Those two used to be separate dialogs on separate GM-panel
 * entries, which meant setting up a map was a lap of the panel per room rather
 * than one pass down a table.
 *
 * Every column is a region flag written when the map is built. `rest.mjs` still
 * owns the two rest flags and their readers; this only edits them.
 */
export async function openRoomSetupDialog({ tab = "bedrooms" } = {}) {
    // ONE OF THESE, NOT FOUR — see `alreadyOpen` in live.mjs. Two copies of a
    // window each read the world when they opened and neither knows about the
    // other, so the older one goes on looking authoritative while showing
    // something that stopped being true. Raised rather than refused: pressing
    // twice usually means the window is behind something.
    if (alreadyOpen("drpg-window-rooms")) return null;

    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    // Alphabetical, because a GM opens this looking for ONE room by name. The
    // order regions come in is the order somebody happened to draw the map,
    // which is nobody's mental model of the building.
    const rooms = Array.from(regionsByName().keys()).sort((a, b) => a.localeCompare(b));
    if (!rooms.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Vault.noRooms"));
        return null;
    }

    const { studentActors } = await import("./monokuma.mjs");
    const { REST_FLAGS, setRestRoom } = await import("./rest.mjs");
    const { discoveredFor, saveDiscoveryMatrix, setDiscovery, sceneUncoveredPercent } =
        await import("./fog.mjs");
    const scene = workingScene();
    const students = studentActors();
    // Room pools only. The tier pools (`tableName()`'s family) answer dice
    // rolls and are never a room's stock — see `isTierPool` in tables.mjs.
    const tables = Array.from(game.tables ?? [])
        .map(t => t.name)
        .filter(n => !isTierPool(n))
        .sort();
    // Truth Bullets are not searched for, so they are not a category a room can
    // stock or favour.
    const categories = Object.entries(ITEM_CATEGORIES).filter(([key]) => key !== "truthBullet");
    const regions = regionsByName();

    const uncovered = sceneUncoveredPercent(scene);
    const maxTokens = SearchTokens.max;

    /*
     * ROOMS DOWN, PEOPLE ACROSS — the same way round as every other tab here.
     *
     * It used to be the other way, and it was the only table in the window that
     * was: rooms across the top, students down the side. With eighteen rooms the
     * headings had to be stood on end to fit, and a column heading you read by
     * tilting your head is one you read twice.
     *
     * The shape decides it. A cast is four to eight; a map is six to thirty-six.
     * The long axis belongs to the side that scrolls, and the short one to the
     * side that has to stay on screen — so rooms are rows and people are columns
     * whose names lie down and read at a glance.
     *
     * THE INPUT NAMES DO NOT CHANGE. `fog:${room}:${actorId}` carries both
     * coordinates, so Apply reads the same form it always did and never learns
     * which way the table was laid out.
     */
    const known = new Map(students.map(a => [a.id, new Set(discoveredFor(scene?.id, a.id))]));
    const fogHeads = students
        .map(a => `<th>${foundry.utils.escapeHTML(a.name)}</th>`)
        .join("");
    const fogRows = rooms.map(room => {
        const escRoom = foundry.utils.escapeHTML(room);
        const boxes = students.map(actor =>
            `<td style="text-align:center"><input type="checkbox"
                name="fog:${escRoom}:${actor.id}" ${
                known.get(actor.id)?.has(room) ? "checked" : ""} /></td>`).join("");
        return `<tr><td><strong>${escRoom}</strong></td>${boxes}</tr>`;
    }).join("");

    /*
     * THE STASH MATRIX. Same shape as the Fog one above — rooms down, students
     * across — because four tables that look alike read as one window.
     *
     * ONE BUTTON PER CELL, NOT TWO CHECKBOXES. A stash cell carries two facts
     * ("is there one" and "is it hidden") and the obvious encoding is a pair of
     * boxes. At eight students and twelve rooms that is 192 targets to hit, half
     * of which are meaningless — "hidden" on a room with no stash — so the cell
     * cycles through the three states that actually exist instead.
     *
     * The state lives in a hidden input rather than on the button, because Apply
     * reads this form by input NAME and knows nothing about how the cell was
     * drawn — the same contract the fog matrix keeps.
     */
    const stashState = (room, actorId) => {
        const entry = stashIn(room, actorId, scene);
        if (!entry) return "";
        return entry.concealed ? "hidden" : "open";
    };
    const stashGlyph = state => state === "open"
        ? '<i class="fa-solid fa-box-open"></i>'
        : state === "hidden"
            ? '<i class="fa-solid fa-box"></i><i class="fa-solid fa-lock drpg-stash-lock"></i>'
            : '<span class="drpg-stash-none">&mdash;</span>';
    const stashHeads = students
        .map(a => `<th>${foundry.utils.escapeHTML(a.name)}</th>`)
        .join("");
    const stashRows = rooms.map(room => {
        const escRoom = foundry.utils.escapeHTML(room);
        const bedroomOwner = vaultOwnerOf(room, scene);
        const cells = students.map(actor => {
            const state = stashState(room, actor.id);
            // The bedroom owner's column is shaded so a GM can see at a glance
            // which stash appeared by itself when they assigned the room.
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

    /* One pass gathers every fact about a room; the tabs then deal the same
     * cells into four thematic tables. The input NAMES are the contract with
     * the Apply callback below, identical whichever table a cell sits in —
     * Apply reads the whole form and never asks which tab was showing. */
    const cells = rooms.map(room => {
        const owner = vaultOwnerOf(room) ?? "";
        const table = roomTable(room) ?? "";
        const favours = roomFavours(room);
        const hinders = roomHinders(room);
        const region = regions.get(room);
        // NOT `esc`: every other file in this module uses that name for the
        // escaping FUNCTION, so a local string by the same name here means the
        // next `esc(x)` written inside this block is a TypeError.
        const escRoom = foundry.utils.escapeHTML(room);

        const people = students.map(a =>
            `<option value="${a.id}"${a.id === owner ? " selected" : ""}>${
                foundry.utils.escapeHTML(a.name)}</option>`).join("");
        const tableOptions = tables.map(t =>
            `<option value="${foundry.utils.escapeHTML(t)}"${t === table ? " selected" : ""}>${
                foundry.utils.escapeHTML(t)}</option>`).join("");
        // The same set of category boxes twice, under two prefixes: `fav` for
        // the advantage column, `hin` for the disadvantage one. The render
        // hook below keeps one category from being ticked in both.
        const categoryBoxes = (prefix, ticked) => categories.map(([key, cat]) =>
            `<label class="drpg-inline-check"><input type="checkbox"
                name="${prefix}:${escRoom}:${key}" ${ticked.includes(key) ? "checked" : ""} />${
                foundry.utils.escapeHTML(cat.label)}</label>`).join(" ");

        const check = (name, on, title = "") => `<td style="text-align:center"${
            title ? ` title="${title}"` : ""}><input type="checkbox" name="${name}:${escRoom}"
                ${on ? "checked" : ""} /></td>`;

        return {
            name: `<td><strong>${escRoom}</strong></td>`,
            owner: `<td><select name="owner:${escRoom}"><option value="">—</option>${people}</select></td>`,
            concealed: check("concealed", isConcealed(room)),
            short: check("short", region?.getFlag(MODULE_ID, REST_FLAGS.short)),
            long: check("long", region?.getFlag(MODULE_ID, REST_FLAGS.long)),
            locked: check("locked", region?.getFlag(MODULE_ID, ROOM_FLAGS.locked)),
            startlocked: check("startlocked", startLocked(region),
                game.i18n.localize("DRPG.Vault.lockedAtStartHint")),
            nosearch: check("nosearch", region?.getFlag(MODULE_ID, SEARCH_FLAGS.sealed)),
            tokens: `<td class="drpg-token-cell" style="text-align:center">
                <span data-drpg-tokens="${escRoom}">${SearchTokens.left(room, scene)}</span> / ${maxTokens}
                <button type="button" class="drpg-mini-button" data-drpg-token="${escRoom}"
                    data-drpg-token-by="-1" title="${
                        game.i18n.localize("DRPG.SearchTokens.spendOne")}">−</button>
                <button type="button" class="drpg-mini-button" data-drpg-token="${escRoom}"
                    data-drpg-token-by="1" title="${
                        game.i18n.localize("DRPG.SearchTokens.giveOne")}">+</button>
                <button type="button" class="drpg-mini-button" data-drpg-token="${escRoom}"
                    data-drpg-token-by="max" title="${
                        game.i18n.localize("DRPG.SearchTokens.refillRoom")}">↺</button>
            </td>`,
            table: `<td><select name="table:${escRoom}">
                <option value="">${game.i18n.localize("DRPG.Vault.globalPool")}</option>
                ${tableOptions}</select></td>`,
            favours: `<td>${categoryBoxes("fav", favours)}</td>`,
            hinders: `<td>${categoryBoxes("hin", hinders)}</td>`,
            // A textarea, not an input: these are sentences. The cell escapes
            // the wrapping-cell rule the rest of this table lives under — see
            // the `:has(input[type="text"], textarea)` exception in the
            // stylesheet — so the prose wraps instead of stretching the window.
            description: `<td><textarea name="desc:${escRoom}" rows="2"
                placeholder="${game.i18n.localize("DRPG.Vault.descriptionPlaceholder")}"
                >${foundry.utils.escapeHTML(roomDescription(room))}</textarea></td>`
        };
    });

    const th = key => `<th>${game.i18n.localize(key)}</th>`;
    const tableFor = (heads, cols) => `<table class="drpg-vault-table"><thead><tr>${
        th("DRPG.Vault.room")}${heads.join("")}</tr></thead><tbody>${
        cells.map(c => `<tr>${c.name}${cols.map(k => c[k]).join("")}</tr>`).join("")
    }</tbody></table>`;

    const TABS = [
        ["bedrooms", "DRPG.Vault.tabBedrooms"],
        ["doors", "DRPG.Vault.tabDoors"],
        ["search", "DRPG.Vault.tabSearching"],
        ["rest", "DRPG.Vault.tabRest"],
        ["stashes", "DRPG.Vault.tabStashes"],
        ["description", "DRPG.Vault.tabDescription"],
        ["fog", "DRPG.Vault.tabFog"]
    ];
    const initial = TABS.some(([key]) => key === tab) ? tab : "bedrooms";
    const nav = TABS.map(([key, label]) =>
        `<button type="button" class="drpg-dashboard-tab${key === initial ? " active" : ""}"
            data-drpg-tab="${key}">${game.i18n.localize(label)}</button>`).join("");
    const panel = (key, inner) =>
        `<div data-drpg-panel="${key}"${key === initial ? "" : ' style="display:none"'}>${inner}</div>`;

    const result = await tableDialog({
        window: { title: game.i18n.localize("DRPG.Vault.manageTitle") },
        // `drpg-projects` as well as `drpg-panel`: that is the class the
        // stylesheet hangs the table treatment on — full width, a scrolling
        // window-content and sane select sizing. Without it this dialog asked
        // for 860px, lost to the 26rem `.drpg-panel` cap, and clipped its own
        // right-hand columns with no way to scroll to them.
        classes: ["drpg-panel", "drpg-projects", "drpg-room-setup", "drpg-window-rooms"],
        // One size for all five tabs, taken from the biggest of them — see
        // `fitWindowToTabs`. Without it the window is fitted to whichever tab
        // is showing and jumps between 708px and 1504px as the GM switches.
        fitTabs: true,
        content: dialogContent(`<form>
            <p class="notes">${game.i18n.localize("DRPG.Vault.manageIntro")}</p>
            <nav class="drpg-dashboard-tabs">${nav}</nav>

            ${panel("bedrooms", `
                <p>${game.i18n.localize("DRPG.Vault.bedroomsIntro")}</p>
                ${tableFor([th("DRPG.Vault.owner"), th("DRPG.Vault.concealed")],
                    ["owner", "concealed"])}
            `)}

            ${panel("doors", `
                <p>${game.i18n.localize("DRPG.Vault.doorsIntro")}</p>
                ${tableFor([th("DRPG.Vault.lockedColumn"), th("DRPG.Vault.lockedAtStartColumn")],
                    ["locked", "startlocked"])}
            `)}

            ${panel("search", `
                <p>${game.i18n.localize("DRPG.Vault.searchIntro")}</p>
                ${tableFor([
                    th("DRPG.SearchTokens.sealedColumn"), th("DRPG.SearchTokens.title"),
                    th("DRPG.Vault.table"), th("DRPG.Vault.favours"), th("DRPG.Vault.hinders")
                ], ["nosearch", "tokens", "table", "favours", "hinders"])}
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
                <table class="drpg-vault-table"><thead><tr>
                    <th>${game.i18n.localize("DRPG.Vault.room")}</th>
                    ${stashHeads}
                </tr></thead><tbody>${stashRows}</tbody></table>
                <p class="notes">${game.i18n.localize("DRPG.Vault.stashesNote")}</p>
            `)}

            ${panel("description", `
                <p>${game.i18n.localize("DRPG.Vault.descriptionIntro")}</p>
                ${tableFor([th("DRPG.Vault.descriptionColumn")], ["description"])}
                <p class="notes">${game.i18n.localize("DRPG.Vault.descriptionNote")}</p>
            `)}

            ${panel("fog", `
                <p>${game.i18n.localize("DRPG.Vault.fogIntro")}</p>
                ${uncovered > 0 ? `<p class="drpg-warning">${game.i18n.format("DRPG.Vault.fogUncovered",
                    { pct: uncovered })}</p>` : ""}
                <table class="drpg-vault-table"><thead><tr>
                    <th>${game.i18n.localize("DRPG.Vault.room")}</th>
                    ${fogHeads}
                </tr></thead><tbody>${fogRows}</tbody></table>
                <p class="notes">${game.i18n.localize("DRPG.Vault.fogNote")}</p>
            `)}
        </form>`),
        buttons: [
            {
                action: "ok", label: game.i18n.localize("DRPG.Panel.apply"), default: true,
                callback: (e, b, d) => {
                    const f = d.element.querySelector("form");
                    const pick = name => f.querySelector(`[name="${CSS.escape(name)}"]`);
                    const roomRows = rooms.map(room => ({
                        room,
                        owner: pick(`owner:${room}`)?.value ?? "",
                        concealed: Boolean(pick(`concealed:${room}`)?.checked),
                        shortRest: Boolean(pick(`short:${room}`)?.checked),
                        longRest: Boolean(pick(`long:${room}`)?.checked),
                        locked: Boolean(pick(`locked:${room}`)?.checked),
                        lockedAtStart: Boolean(pick(`startlocked:${room}`)?.checked),
                        noSearch: Boolean(pick(`nosearch:${room}`)?.checked),
                        description: (pick(`desc:${room}`)?.value ?? "").trim(),
                        table: pick(`table:${room}`)?.value ?? "",
                        favours: categories
                            .map(([key]) => key)
                            .filter(key => pick(`fav:${room}:${key}`)?.checked),
                        // The render hook keeps the two columns exclusive in
                        // the UI; the filter repeats it here so a row somebody
                        // edited by other means still cannot say both.
                        hinders: categories
                            .map(([key]) => key)
                            .filter(key => pick(`hin:${room}:${key}`)?.checked
                                && !pick(`fav:${room}:${key}`)?.checked)
                    }));
                    const fogMatrix = {};
                    for (const actor of students) {
                        fogMatrix[actor.id] = rooms.filter(room =>
                            pick(`fog:${room}:${actor.id}`)?.checked);
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
                    return { rooms: roomRows, fog: fogMatrix, stashes: stashMatrix };
                }
            },
            { action: "discoverAll", label: game.i18n.localize("DRPG.Vault.discoverAll") },
            { action: "hideAll", label: game.i18n.localize("DRPG.Vault.hideAll") },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        render: (event, dialog) => {
            const root = dialog.element;

            const tabs = root.querySelectorAll("[data-drpg-tab]");
            const panels = root.querySelectorAll("[data-drpg-panel]");
            for (const tabButton of tabs) {
                tabButton.addEventListener("click", () => {
                    for (const t of tabs) t.classList.toggle("active", t === tabButton);
                    for (const p of panels) {
                        p.style.display = p.dataset.drpgPanel === tabButton.dataset.drpgTab ? "" : "none";
                    }
                    // Deliberately no REFIT here. The window was measured for
                    // the biggest tab when it opened and keeps that size for
                    // all of them: switching tabs is a comparison, and a
                    // window that resizes under a comparison is the thing
                    // being complained about.
                    //
                    // The footer pin is a different question and does have to
                    // be redone: each tab holds a different table, so whether
                    // this window scrolls sideways changes with the tab, and a
                    // bar pinned for the Fog tab is wrong for Bedrooms (C-F5-8).
                    requestAnimationFrame(() => pinFooterAcrossScroll(dialog));
                });
            }

            /*
             * Cycle a stash cell: none -> open -> hidden -> none.
             *
             * The hidden input is the truth and the glyph follows it, never the
             * other way round — Apply reads the input, and a cell whose picture
             * and value could disagree is a cell that lies to whoever saves it.
             */
            const GLYPHS = {
                "": '<span class="drpg-stash-none">&mdash;</span>',
                open: '<i class="fa-solid fa-box-open"></i>',
                hidden: '<i class="fa-solid fa-box"></i><i class="fa-solid fa-lock drpg-stash-lock"></i>'
            };
            const NEXT = { "": "open", open: "hidden", hidden: "" };
            for (const button of root.querySelectorAll("[data-drpg-stash]")) {
                button.addEventListener("click", ev => {
                    ev.preventDefault();
                    const input = button.parentElement?.querySelector("input[type=hidden]");
                    if (!input) return;
                    input.value = NEXT[input.value] ?? "open";
                    button.innerHTML = GLYPHS[input.value];
                });
            }

            // A room cannot favour and hinder the same category. Ticking one
            // side clears the other quietly — refusing at Apply instead would
            // send the GM hunting through checkboxes for the contradiction.
            // The room name may itself contain ":", so the category is read
            // from the LAST segment and the room is everything between.
            root.querySelector("form")?.addEventListener("change", ev => {
                const m = ev.target?.name?.match(/^(fav|hin):(.+):([^:]+)$/);
                if (!m || !ev.target.checked) return;
                const twin = root.querySelector(`[name="${
                    CSS.escape(`${m[1] === "fav" ? "hin" : "fav"}:${m[2]}:${m[3]}`)}"]`);
                if (twin) twin.checked = false;
            });

            // The search-token controls act AT ONCE and recount in place.
            //
            // They are not part of Apply, for the same reason the Monocub
            // manager's "give Hope" button is not: this is a counter the table
            // is currently spending, and a GM who nudges it and then cancels the
            // rest of the form should not find the nudge undone with it. The
            // count is re-read from `SearchTokens` after the write rather than
            // guessed from the cell, so a spend that arrived from a player's
            // client mid-edit is reflected instead of overwritten.
            for (const button of root.querySelectorAll("[data-drpg-token]")) {
                button.addEventListener("click", async ev => {
                    ev.preventDefault();
                    const room = button.dataset.drpgToken;
                    const by = button.dataset.drpgTokenBy;
                    const now = SearchTokens.left(room, scene);
                    const want = by === "max" ? SearchTokens.max : now + Number(by);
                    const stored = await SearchTokens.setFor(room, want, scene);
                    const cell = root.querySelector(`[data-drpg-tokens="${CSS.escape(room)}"]`);
                    if (cell && stored !== null) cell.textContent = String(stored);
                });
            }
        },
        rejectClose: false
    });

    if (!result || result === "cancel") return null;

    if (result === "discoverAll" || result === "hideAll") {
        await setDiscovery(scene, { rooms, value: result === "discoverAll" });
        // Back onto the tab those two buttons act on — reopening at the first
        // tab made the GM walk back to Fog to see what they just did.
        return openRoomSetupDialog({ tab: "fog" });
    }

    if (result.fog) await saveDiscoveryMatrix(scene, result.fog);

    const rowResults = result.rooms;
    if (!Array.isArray(rowResults)) return null;

    // One owner, one room. Two bedrooms pointing at the same student would make
    // `vaultRoomFor` answer differently depending on region order, which is the
    // kind of bug that only shows up mid-session.
    const claimed = new Map();
    for (const row of rowResults) {
        if (!row.owner) continue;
        if (claimed.has(row.owner)) {
            ui.notifications.error(game.i18n.format("DRPG.Vault.twoRooms", {
                name: game.actors.get(row.owner)?.name ?? "?",
                a: claimed.get(row.owner), b: row.room
            }));
            return null;
        }
        claimed.set(row.owner, row.room);
    }

    let changed = 0;
    // Rooms whose BEDROOM OWNER moved in this Apply. Collected rather than acted
    // on inline because the seeding below has to run after the stash matrix has
    // been written, or it would seed into a list it is about to overwrite.
    const ownerMoved = [];
    for (const row of rowResults) {
        const region = regionsByName().get(row.room);
        if (!region) continue;

        const before = {
            owner: region.getFlag(MODULE_ID, VAULT_FLAGS.owner) ?? null,
            concealed: Boolean(region.getFlag(MODULE_ID, VAULT_FLAGS.concealed)),
            table: region.getFlag(MODULE_ID, VAULT_FLAGS.table) ?? null,
            favours: region.getFlag(MODULE_ID, VAULT_FLAGS.favours) ?? [],
            hinders: region.getFlag(MODULE_ID, VAULT_FLAGS.hinders) ?? [],
            description: region.getFlag(MODULE_ID, VAULT_FLAGS.description) ?? ""
        };
        const beforeRest = {
            short: Boolean(region.getFlag(MODULE_ID, REST_FLAGS.short)),
            long: Boolean(region.getFlag(MODULE_ID, REST_FLAGS.long))
        };
        const wasLocked = Boolean(region.getFlag(MODULE_ID, ROOM_FLAGS.locked));
        const wasLockedAtStart = startLocked(region);
        const wasSealed = Boolean(region.getFlag(MODULE_ID, SEARCH_FLAGS.sealed));

        const same = before.owner === (row.owner || null)
            && before.concealed === row.concealed
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
            && before.description === row.description;
        if (before.owner !== (row.owner || null) && row.owner) {
            ownerMoved.push({ room: row.room, owner: row.owner });
        }
        if (same) continue;

        await setVaultRoom(row.room, {
            owner: row.owner,
            concealed: row.concealed,
            table: row.table,
            favours: row.favours,
            hinders: row.hinders,
            description: row.description
        });

        // Through rest.mjs's own writer rather than a second flag path, so the
        // two rest flags keep one owner.
        await setRestRoom(row.room, { short: row.shortRest, long: row.longRest });

        // No announcement either way. A room nobody can search says so on the
        // action tile the moment anybody stands in it and looks — which is a
        // better place to learn it than a chat line scrolling past hours
        // earlier, and it does not tell the whole cast which room the GM has
        // just decided is interesting enough to close.
        if (wasSealed !== row.noSearch) {
            await region.setFlag(MODULE_ID, SEARCH_FLAGS.sealed, row.noSearch);
        }

        // Written whether or not it changed, because "unset" and "unset but
        // equal to the current lock" are the same thing to `startLocked` and
        // only one of them survives a mid-season change to the lock itself.
        await region.setFlag(MODULE_ID, ROOM_FLAGS.lockedAtStart, row.lockedAtStart);

        if (wasLocked !== row.locked) {
            await region.setFlag(MODULE_ID, ROOM_FLAGS.locked, row.locked);
            // Only unlocking is announced. A GM locking a door mid-session is
            // often the point the players finding out is meant to come from
            // walking into it and reading "Drzwi są zamknięte." themselves —
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

        changed++;
    }

    /*
     * THE STASH MATRIX, and the two rules that make it safe.
     *
     * TRAP 77 — A STASH WITH THINGS IN IT IS NOT REMOVED. Taking one away would
     * leave every item in it pointing at a stash that no longer exists, which is
     * an item on no list at all: not carried, not in any drawer, gone from the
     * sheet and findable only by a GM reading flags. So the removal is refused,
     * with the count, and the GM is told whose things and how many. The cell
     * snaps back on the next open because the form is redrawn from the flags.
     */
    if (result.stashes && typeof result.stashes === "object") {
        for (const [room, wanted] of Object.entries(result.stashes)) {
            const current = stashesIn(room, scene);
            const keep = new Map(wanted.map(entry => [entry.actorId, entry]));

            for (const entry of current) {
                if (keep.has(entry.actorId)) continue;
                const owner = game.actors.get(entry.actorId);
                const held = owner ? stashItemsIn(owner, room, scene).length : 0;
                if (held) {
                    ui.notifications.warn(game.i18n.format("DRPG.Vault.stashNotEmpty", {
                        name: owner?.name ?? "?", room, n: held
                    }));
                    keep.set(entry.actorId, entry);      // refused: leave it alone
                    continue;
                }
                await setStash(room, entry.actorId, { present: false });
                changed++;
            }

            for (const entry of keep.values()) {
                const was = current.find(e => e.actorId === entry.actorId);
                if (was && was.concealed === entry.concealed) continue;
                await setStash(room, entry.actorId, { concealed: entry.concealed });
                changed++;
            }
        }
    }

    /*
     * TRAP 76 — SEEDING RUNS ON AN OWNER CHANGE, NEVER ON EVERY APPLY.
     *
     * Giving somebody a bedroom gives them a stash in it, which is what makes
     * the split invisible to a GM who never opens the new tab. But if it ran
     * every time the form was saved, then removing a stash on the Stashes tab
     * and pressing Apply would put it straight back — a button that unclicks
     * itself, and the GM would have no way to tell it apart from a bug.
     *
     * `?? false` rather than a plain create: `setStash` leaves an existing entry
     * alone when told nothing about concealment, so a GM who already hid the
     * owner's stash keeps it hidden.
     */
    for (const { room, owner } of ownerMoved) {
        if (stashIn(room, owner, scene)) continue;
        await setStash(room, owner, { concealed: false });
        changed++;
    }

    // AFTER the loop, and outside it: keys are issued by sweeping every owned
    // room, not by noticing an owner change. See `reconcileBedroomKeys` for why
    // — in short, a row the GM did not touch is skipped above, and rooms
    // assigned before keys existed are all of those. Not silent: a key arriving
    // on your sheet is news, and the sweep only writes when one was missing.
    await reconcileBedroomKeys({ silent: false });

    ui.notifications.info(plural("DRPG.Vault.saved", { n: changed }));
    return changed;
}

/** GM: look inside anybody's stash, and pull things out of it. */
export async function openVaultInspector() {
    // ONE OF THESE, NOT FOUR — see `alreadyOpen` in live.mjs. Two copies of a
    // window each read the world when they opened and neither knows about the
    // other, so the older one goes on looking authoritative while showing
    // something that stopped being true. Raised rather than refused: pressing
    // twice usually means the window is behind something.
    if (alreadyOpen("drpg-window-stashes")) return null;

    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    const vaults = allVaults().filter(v => v.owner);
    if (!vaults.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Vault.noneSet"));
        return null;
    }

    const sections = vaults.map(v => {
        const items = vaultContents(v.owner);
        const list = items.length
            ? items.map(i => `<li>${foundry.utils.escapeHTML(i.name)} — ${
                foundry.utils.escapeHTML(
                    ITEM_CATEGORIES[i.getFlag(MODULE_ID, ITEM_FLAGS.category)]?.label ?? "?")
            }</li>`).join("")
            : `<li class="notes">${game.i18n.localize("DRPG.Sheet.groupEmpty")}</li>`;
        return `<div class="drpg-vault-section">
            <h4>${foundry.utils.escapeHTML(v.owner.name)} — ${foundry.utils.escapeHTML(v.room)}${
                v.concealed ? ` · <em>${game.i18n.localize("DRPG.Vault.concealedShort")}</em>` : ""
            }</h4>
            <ul>${list}</ul>
        </div>`;
    }).join("");

    return DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Vault.inspectTitle") },
        classes: ["drpg-panel", "drpg-window-stashes"],
        content: dialogContent(`<div>${sections}
            <p class="notes">${game.i18n.localize("DRPG.Vault.inspectNote")}</p></div>`),
        buttons: [{ action: "close", label: game.i18n.localize("DRPG.Panel.close"), default: true }],
        rejectClose: false
    });
}
