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

import { MODULE_ID, ITEM_CATEGORIES, BEDROOM_KEY_FLAG } from "./config.mjs";
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
import { dialogContent, tableDialog, whisperToOwner, announce, log, error, plural, workingScene,
    pinFooterAcrossScroll } from "./utils.mjs";

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
    owner: "drpgVaultOwner",
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
    description: "drpgRoomDescription"
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
        img: "icons/svg/padlock.svg",
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

/** The actor id whose stash lives in this room, or `null`. */
export function vaultOwnerOf(room, scene = workingScene()) {
    return regionsByName(scene).get(room)?.getFlag(MODULE_ID, VAULT_FLAGS.owner) ?? null;
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

export function isConcealed(room, scene = workingScene()) {
    return Boolean(regionsByName(scene).get(room)?.getFlag(MODULE_ID, VAULT_FLAGS.concealed));
}

/** The room this character stashes things in, or `null`. */
export function vaultRoomFor(actor, scene = workingScene()) {
    if (!actor) return null;
    for (const [name, region] of regionsByName(scene)) {
        if (region.getFlag(MODULE_ID, VAULT_FLAGS.owner) === actor.id) return name;
    }
    return null;
}

/** Every room on the scene that belongs to somebody. */
export function allVaults(scene = workingScene()) {
    const out = [];
    for (const [name, region] of regionsByName(scene)) {
        const owner = region.getFlag(MODULE_ID, VAULT_FLAGS.owner);
        if (!owner) continue;
        out.push({
            room: name,
            owner: game.actors.get(owner) ?? null,
            concealed: Boolean(region.getFlag(MODULE_ID, VAULT_FLAGS.concealed))
        });
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

/** Am I standing in my own stash room? */
export async function atOwnVault(actor) {
    const room = vaultRoomFor(actor);
    if (!room) return false;
    const { roomOfActor } = await import("./movement.mjs");
    return roomOfActor(actor) === room;
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

    if (!await atOwnVault(actor)) {
        ui.notifications.warn(game.i18n.localize("DRPG.Vault.notHere"));
        return false;
    }

    try {
        await item.setFlag(MODULE_ID, ITEM_FLAGS.location, LOCATIONS.vault);
    } catch (err) {
        error("Could not stash the item", err);
        return false;
    }

    log(`${actor.name} stashed "${item.name}".`);
    return true;
}

/** Take something back out. The carry limit has a say on the way out. */
export async function retrieve(actor, item) {
    if (!actor || !item || !isStashed(item)) return false;

    if (!await atOwnVault(actor)) {
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
        await item.setFlag(MODULE_ID, ITEM_FLAGS.location, LOCATIONS.carried);
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
export function openStashHere(actor) {
    if (!actor) return null;

    // `roomOfActor` is the module's one answer to "which room is this actor in"
    // — it already handles unlinked tokens, an empty region set and the
    // geometric fallback. A local re-implementation here was a third copy of
    // that logic, and a copy of a geometric test is a copy that drifts.
    const room = roomOfActor(actor);
    if (!room) return null;

    const ownerId = vaultOwnerOf(room);
    if (!ownerId || ownerId === actor.id) return null;   // yours is not a theft
    // Hidden: needs a Search — unless you are the Mastermind, to whom a
    // hiding place is furniture they watched being built (Dawid, 26.08). The
    // GM-side authority in `stealFromVault` makes the same exception.
    if (isConcealed(room) && !iAmTheMastermind()) return null;

    const owner = game.actors.get(ownerId);
    if (!owner) return null;

    return { owner, room, items: vaultContents(owner) };
}

/**
 * Go through an open stash and take one thing. No action, no roll.
 *
 * The write itself is GM-only — it touches two sheets — so it goes over the
 * same bridge the Search branch uses, and `stealFromVault` re-checks everything
 * on that side. This is the picker, not the authority.
 */
export async function rifleStashDialog(actor) {
    const here = openStashHere(actor);
    if (!here) {
        ui.notifications.warn(game.i18n.localize("DRPG.Vault.noOpenStashHere"));
        return false;
    }
    if (!here.items.length) {
        ui.notifications.info(game.i18n.format("DRPG.Vault.stashEmpty", {
            who: here.owner.name
        }));
        return false;
    }

    const options = here.items.map(i => {
        const tier = i.getFlag(MODULE_ID, ITEM_FLAGS.tier);
        const cat = ITEM_CATEGORIES[i.getFlag(MODULE_ID, ITEM_FLAGS.category)]?.label ?? "";
        return `<option value="${i.id}">${foundry.utils.escapeHTML(
            `${i.name}${cat ? ` — ${cat}` : ""}${tier !== null && tier !== undefined ? ` (T${tier})` : ""}`
        )}</option>`;
    }).join("");

    const picked = await DialogV2.wait({
        window: { title: game.i18n.format("DRPG.Vault.rifleTitle", { room: here.room }) },
        classes: ["drpg-panel"],
        content: dialogContent(`<form>
            <p>${game.i18n.format("DRPG.Vault.rifleIntro", {
                who: foundry.utils.escapeHTML(here.owner.name),
                room: foundry.utils.escapeHTML(here.room)
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

    const { requestVaultSteal } = await import("./gm-bridge.mjs");
    await requestVaultSteal({ thiefId: actor.id, ownerId: here.owner.id, itemId: picked });
    return true;
}

/**
 * Take one thing out of a stash that is not yours. GM-side: it writes to the
 * owner's sheet and to the thief's.
 *
 * The item moves rather than being copied — this is theft, and the owner
 * noticing that something is missing is the entire point.
 */
export async function stealFromVault({ thiefId, ownerId, itemId, viaSearch = false } = {}) {
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
    if (vaultOwnerOf(where.room, where.scene) !== owner.id) {
        return refuse(`"${where.room}" is not ${owner.name}'s stash`);
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
    if (!viaSearch && isConcealed(where.room, where.scene)) {
        // The Mastermind's exception, verified on THIS side the way every
        // other claim in this function is: `isMastermind` reads the GM's own
        // synced copy of the pick, never anything the packet says.
        const { isMastermind } = await import("./mastermind.mjs");
        if (!isMastermind(thief)) {
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

    log(`${thief.name} took "${item.name}" from ${owner.name}'s stash.`);
    return copy;
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
    const { discoveredFor, saveDiscoveryMatrix, setDiscovery, sceneUncoveredPercent,
        checkRegions } = await import("./fog.mjs");
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

    const fogRows = students.map(actor => {
        const escName = foundry.utils.escapeHTML(actor.name);
        const known = new Set(discoveredFor(scene?.id, actor.id));
        const boxes = rooms.map(room => {
            const escRoom = foundry.utils.escapeHTML(room);
            return `<td style="text-align:center"><input type="checkbox"
                name="fog:${escRoom}:${actor.id}" ${known.has(room) ? "checked" : ""} /></td>`;
        }).join("");
        return `<tr><td><strong>${escName}</strong></td>${boxes}</tr>`;
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
        const esc = foundry.utils.escapeHTML(room);

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
                name="${prefix}:${esc}:${key}" ${ticked.includes(key) ? "checked" : ""} />${
                foundry.utils.escapeHTML(cat.label)}</label>`).join(" ");

        const check = (name, on, title = "") => `<td style="text-align:center"${
            title ? ` title="${title}"` : ""}><input type="checkbox" name="${name}:${esc}"
                ${on ? "checked" : ""} /></td>`;

        return {
            name: `<td><strong>${esc}</strong></td>`,
            owner: `<td><select name="owner:${esc}"><option value="">—</option>${people}</select></td>`,
            concealed: check("concealed", isConcealed(room)),
            short: check("short", region?.getFlag(MODULE_ID, REST_FLAGS.short)),
            long: check("long", region?.getFlag(MODULE_ID, REST_FLAGS.long)),
            locked: check("locked", region?.getFlag(MODULE_ID, ROOM_FLAGS.locked)),
            startlocked: check("startlocked", startLocked(region),
                game.i18n.localize("DRPG.Vault.lockedAtStartHint")),
            nosearch: check("nosearch", region?.getFlag(MODULE_ID, SEARCH_FLAGS.sealed)),
            tokens: `<td class="drpg-token-cell" style="text-align:center">
                <span data-drpg-tokens="${esc}">${SearchTokens.left(room, scene)}</span> / ${maxTokens}
                <button type="button" class="drpg-mini-button" data-drpg-token="${esc}"
                    data-drpg-token-by="-1" title="${
                        game.i18n.localize("DRPG.SearchTokens.spendOne")}">−</button>
                <button type="button" class="drpg-mini-button" data-drpg-token="${esc}"
                    data-drpg-token-by="1" title="${
                        game.i18n.localize("DRPG.SearchTokens.giveOne")}">+</button>
                <button type="button" class="drpg-mini-button" data-drpg-token="${esc}"
                    data-drpg-token-by="max" title="${
                        game.i18n.localize("DRPG.SearchTokens.refillRoom")}">↺</button>
            </td>`,
            table: `<td><select name="table:${esc}">
                <option value="">${game.i18n.localize("DRPG.Vault.globalPool")}</option>
                ${tableOptions}</select></td>`,
            favours: `<td>${categoryBoxes("fav", favours)}</td>`,
            hinders: `<td>${categoryBoxes("hin", hinders)}</td>`,
            // A textarea, not an input: these are sentences. The cell escapes
            // the wrapping-cell rule the rest of this table lives under — see
            // the `:has(input[type="text"], textarea)` exception in the
            // stylesheet — so the prose wraps instead of stretching the window.
            description: `<td><textarea name="desc:${esc}" rows="2"
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
        classes: ["drpg-panel", "drpg-projects"],
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

            ${panel("description", `
                <p>${game.i18n.localize("DRPG.Vault.descriptionIntro")}</p>
                ${tableFor([th("DRPG.Vault.descriptionColumn")], ["description"])}
                <p class="notes">${game.i18n.localize("DRPG.Vault.descriptionNote")}</p>
            `)}

            ${panel("fog", `
                <p>${game.i18n.localize("DRPG.Vault.fogIntro")}</p>
                ${uncovered > 0 ? `<p class="drpg-warning">${game.i18n.format("DRPG.Vault.fogUncovered",
                    { pct: uncovered })}</p>` : ""}
                <p>${game.i18n.localize("DRPG.Vault.checkIntro")}</p>
                <p><button type="button" data-drpg-check>${
                    game.i18n.localize("DRPG.Vault.checkRooms")}</button></p>
                <div data-drpg-check-out class="drpg-room-check"></div>
                <hr>
                <table class="drpg-vault-table"><thead><tr>
                    <th>${game.i18n.localize("DRPG.Vault.student")}</th>
                    ${rooms.map(r => `<th>${foundry.utils.escapeHTML(r)}</th>`).join("")}
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
                    return { rooms: roomRows, fog: fogMatrix };
                }
            },
            { action: "discoverAll", label: game.i18n.localize("DRPG.Vault.discoverAll") },
            { action: "hideAll", label: game.i18n.localize("DRPG.Vault.hideAll") },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        render: (event, dialog) => {
            const root = dialog.element;

            /*
             * The room check reports INTO THE WINDOW, not only to the console.
             * The person who has to act on "this room overlaps that one" is a
             * GM in the region editor, and telling them to open devtools is
             * telling them not to bother. The console copy stays — it carries
             * the coordinates in a form that can be pasted.
             */
            const checkButton = root.querySelector("[data-drpg-check]");
            const checkOut = root.querySelector("[data-drpg-check-out]");
            checkButton?.addEventListener("click", () => {
                const findings = checkRegions();
                if (!findings.length) {
                    checkOut.innerHTML = `<p class="notes">${
                        game.i18n.localize("DRPG.Vault.checkClean")}</p>`;
                    return;
                }
                const marks = { error: "✕", warning: "!", info: "·" };
                checkOut.innerHTML = `<table class="drpg-vault-table drpg-room-check-table"><tbody>${
                    findings.map(f => `<tr>
                        <td>${marks[f.level] ?? "·"}</td>
                        <td>${foundry.utils.escapeHTML(f.room)}</td>
                        <td><strong>${foundry.utils.escapeHTML(f.problem)}</strong><br>
                            <small>${foundry.utils.escapeHTML(f.detail)}${
                                f.at ? ` (${f.at.x}, ${f.at.y})` : ""}</small></td>
                    </tr>`).join("")
                }</tbody></table>`;
                // The report is taller than the space it appeared in, and the
                // footer is sticky — without this the last findings sit under
                // it. Not a refit of the window: the window was measured for
                // its biggest tab and keeps that size on purpose.
                requestAnimationFrame(() => pinFooterAcrossScroll(dialog));
            });

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
        classes: ["drpg-panel"],
        content: dialogContent(`<div>${sections}
            <p class="notes">${game.i18n.localize("DRPG.Vault.inspectNote")}</p></div>`),
        buttons: [{ action: "close", label: game.i18n.localize("DRPG.Panel.close"), default: true }],
        rejectClose: false
    });
}
