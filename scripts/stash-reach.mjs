/**
 * Danganronpa RPG - the stash's reach.
 * ---------------------------------------------------------------------------
 * What a character does at a stash, and what a GM judges of it: whether this is
 * their own stash, here (`myStashHere`, `atOwnVault`); putting an item away and
 * taking one out (`stow`, `retrieve`) with the refusals both give
 * (`tellNotHere`, `refuseTheDead`); the stashes open to a character in a room
 * (`openStashesHere`, `openStashHere`); the rifle - its window, its key and its
 * mark (`rifleStashDialog`, `rifleKey`, `rifleMark`) - and the GM's side of
 * taking from somebody else's stash (`stealFromVault`) with the owner's notice
 * when they next walk in (`tellStashDisturbed`); a Find Stash scored on
 * a GM's browser (`resolveStashSearch`); and the GM's inspector of every stash
 * (`openVaultInspector`).
 *
 * WHERE IT SITS. Moved out of vault.mjs by E41 C6 (1.2.97), a pure move that
 * `node tools/moved-only.mjs` proves line by line. vault.mjs re-exports the 13
 * names here it exported before, so every importer still imports vault.mjs -
 * the bridge's runs reach `stealFromVault` and `resolveStashSearch` through
 * `import("./vault.mjs")`, which answers for this file - and nothing here
 * imports it back (the facade rule, .claude/rules/code.md). Of the stash's
 * family it reads vault-store.mjs alone.
 */

import { MODULE_ID, ITEM_CATEGORIES, BEDROOM_KEY_FLAG, ACTIONS, VAULT_LIMIT, LIMIT_GROUPS } from "./config.mjs";
import { ITEM_FLAGS, LOCATIONS, isStashed, canCarry, capacityLabel, readyForShape } from "./inventory.mjs";
import { trustedWrite } from "./resource-guard.mjs";
import { flagsAsHeld } from "./sheet-audit.mjs";
import { locateActor, sceneOfActor } from "./movement.mjs";
// Static because the reader is synchronous. From settings.mjs, which is a leaf
// - this is one client-scoped boolean, and the note above the function there
// explains why it stopped living in mastermind.mjs.
import { iAmTheMastermind, isDeadForGm, getClock } from "./settings.mjs";
import { whisperToOwner, whisperToGms, log, error, esc } from "./utils.mjs";
import { drpgWindow } from "./ui-kit.mjs";
import { alreadyOpen, RAISED } from "./live.mjs";
import { placeScenes } from "./rooms.mjs";
import {
    VAULT_FLAGS, stashesIn, stashIn, stashRoomsFor, stashRoomOfItem, stashItemsIn, allVaults, foundKey, hasFoundStash,
    stashesFoundBy
} from "./vault-store.mjs";

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
 * bridge (`vault.steal`), and `stealFromVault` re-checks everything on that
 * side. This is the picker, not the authority. Since 1.2.112 it is the one road
 * into somebody else's stash: a Search reaches into none.
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

    // On the kit's frame (E21 C5a).
    const picked = await drpgWindow({
        title: game.i18n.format("DRPG.Vault.rifleTitle", { room }),
        classes: ["drpg-panel"],
        body: `<form>
            <p>${game.i18n.format("DRPG.Vault.rifleIntro", {
                who: esc(stocked.map(entry => entry.owner.name).join(", ")),
                room: esc(room)
            })}</p>
            <label>${game.i18n.localize("DRPG.Items.whichItem")}
                <select name="item">${options}</select></label>
            <p class="notes">${game.i18n.localize("DRPG.Vault.rifleNote")}</p>
        </form>`,
        footer: {
            primary: {
                action: "take", label: game.i18n.localize("DRPG.Vault.take"),
                callback: (e, b, d) => d.element.querySelector("[name=item]").value
            },
            close: "cancel"
        },
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
 * noticing that something is missing is the entire point: they are told when
 * they next walk into the room, unless they watched it happen (`tellStashDisturbed`).
 */
export async function stealFromVault({ thiefId, ownerId, itemId } = {}) {
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
     * A HIDDEN STASH OPENS TO FIND STASH ALONE (1.2.112; the owner's decision of 13.11.2026: "a roll to discover, no
     * roll to search or take an item"). This is the drawer-in-a-bedroom case: no action, no roll, and therefore no
     * business opening a hiding place its owner built a project for until it has been found. From E08+E28 C15 until
     * 1.2.112 a second road came here - a Search that had beaten the concealment at one more step of disadvantage
     * (`viaSearch`, read off that Search's record by bridge-runs-acts.mjs `searchTheftOf`) - and passed this gate;
     * a Search reaches into no stash now, and nothing a packet says opens one.
     */
    if (entry.concealed) {
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
     * ONCE A TIME OF DAY (E14 part 1 C4; D15). Every reach: until 1.2.112 a Search's find (`viaSearch`) paid an action
     * for its reach, and neither asked the count nor wrote it. The Mastermind is counted as anyone is: their exception is the
     * hiding place, not the hand. Asked after every wait above and stamped with no wait between, so of two reaches
     * served at once on one GM the second finds the first's stamp (read in the code; no test drives two at once); the
     * stamp is taken off again when nothing came out, so a reach that moved nothing - full hands and no stash, a piece
     * already gone - costs nothing (tier 2 E35-T10 rifles a stash into full hands, then again with a stash). The thief
     * is told `alreadyDone` (tier 2 E14-T5).
     */
    const { rifleStore } = await import("./gm-stores.mjs");
    const reach = rifleKey(thief.id, owner.id, where.scene?.id, where.room);
    await rifleStore.whenHydrated();
    const mark = rifleMark();
    const earlier = rifleStore.get(reach)?.at ?? null;
    if (earlier === mark) {
        refuse("that stash has been gone through already this time of day");
        /* The code's words are the closed list's, "That has already been settled.", which say neither what nor when
           (E14 fix e1-G1; the review's E14R-04): the thief's player is whispered both, beside the code. */
        await whisperToOwner(thief, `<p>${game.i18n.format("DRPG.Vault.rifledAgain",
            { who: foundry.utils.escapeHTML(owner.name) })}</p>`).catch(() => {});
        return { refused: "that stash has been gone through already this time of day" };
    }
    // The store's own copy takes the row as `patch` is called, before its save is awaited.
    await rifleStore.patch(reach, { at: mark });
    // A row that still holds an earlier reach's pending notice (`unseen`, below) keeps it: its stamp goes back instead.
    const unreach = async () => {
        if (rifleStore.get(reach)?.at !== rifleMark()) return;
        if (rifleStore.get(reach)?.unseen === true) await rifleStore.patch(reach, { at: earlier });
        else await rifleStore.drop(reach);
    };

    /*
     * ON THE ONE ROAD (E35 C3; S17-16, S08-37, S08-34, S08-38): the copy, the count, the flags it carries - a ruined
     * thing lifted out of a drawer stays ruined, or hiding one there and having it lifted would launder a broken
     * murder weapon - and the hands it lands in are inventory.mjs `transferItem`'s. Full hands put it in the thief's
     * own stash (TRANSFER_POLICY.rifle), and only a thief with none is refused; one piece of a stack leaves the
     * stash; a key to a room the thief already holds leaves it and is not copied, the thief told; a piece the stash
     * keeps after the thief has its copy is told to the GMs. Unseen (`quiet`): the owner's open sheet does not redraw
     * for the piece leaving, as a Palm's unseen steal's does not (S08-34); the owner hears of it on walking in.
     */
    const { transferItem } = await import("./inventory.mjs");
    const name = held.name;
    const moved = await transferItem(owner, thief, held, { mode: "rifle", quiet: true });
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
     * THE OWNER HEARS OF IT ON WALKING IN (1.2.112; the owner's decision of 13.11.2026). Until then the owner was told
     * only of a Search that took a thing out with Despair, at once, and a rifle - the drawer's free road - never. Now a
     * reach that moved something while the owner was not standing in that room leaves a pending notice on its row of
     * the GMs' store (`unseen`), and `tellStashDisturbed` delivers it when the owner next crosses into the room: one
     * notice however many reaches came before, none for a reach made before the owner's eyes (they saw it), none for
     * the owner's own. On the GMs' side - the store the count already writes, never the thief's browser nor world data
     * every browser holds - so no player learns from it who, or when. A reach that moved nothing was taken off the
     * count above (`unreach`) and leaves no notice either.
     */
    const ownerHere = locateActor(owner);
    const watched = ownerHere?.room === where.room && (ownerHere?.scene?.id ?? null) === (where.scene?.id ?? null);
    if (owner.id !== thief.id && !watched) await rifleStore.patch(reach, { unseen: true });

    log(`${thief.name} took "${name}" from ${owner.name}'s stash${watched ? ", in front of its owner" : ""}.`);
    return copy ?? true;
}

/**
 * THE NOTICE OF A STASH GONE THROUGH (1.2.112; the owner's decision of 13.11.2026), on the primary GM: `owner` has just
 * crossed into `room` on `scene` (traps.mjs `onCrossed`, which hears a player's crossing through its relay). Every row
 * of the GMs' rifle store for a reach into that owner's stash in that room with a notice pending (`stealFromVault`'s
 * `unseen`) is cleared, and the owner is whispered once "somebody has been in your stash" - never who, never when - as
 * the old disturbed notice was (`DRPG.Vault.noticed`, the "stolen" sound). Dropped unsaid when the stash is no longer
 * there or the owner is dead. Answers whether a notice went. Tier 2's "a stash gone through while its owner was away is
 * told ..." reads it.
 */
export async function tellStashDisturbed(owner, room, scene) {
    if (!owner || !room || !scene || !game.user.isGM) return false;
    const { rifleStore } = await import("./gm-stores.mjs");
    await rifleStore.whenHydrated();
    const tail = `:${owner.id}:${scene.id}:${room}`;
    // A row's key is `<thief>:<owner>:<scene>:<room>` (`rifleKey`): the thief's id holds no colon, a room's name may.
    const pending = Object.entries(rifleStore.entries() ?? {})
        .filter(([key, row]) => row?.unseen === true && key.endsWith(tail) && key.length > tail.length && !key.slice(0, -tail.length).includes(":"))
        .map(([key]) => key);
    if (!pending.length) return false;
    await rifleStore.patchMany(Object.fromEntries(pending.map(key => [key, { unseen: false }])));
    if (isDeadForGm(owner) || !stashIn(room, owner.id, scene)) return false;
    try {
        await whisperToOwner(owner, `<p>${game.i18n.localize("DRPG.Vault.noticed")}</p>`, {
            flags: { [MODULE_ID]: { sfx: "stolen" } }
        });
    } catch (err) {
        error("Could not tell the owner their stash had been gone through", err);
        return false;
    }
    log(`${owner.name} was told somebody had been in their stash in ${room}.`);
    return true;
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
 * and floor ids), which the GMs keep with their facts on its roll (`findPlace`: bridge-runs-acts.mjs
 * `handleFindStash`, a GM's own action-analyze.mjs `locateStash`). A replay handed that place
 * (`at`) searches it only while the GMs still read the character there (movement.mjs
 * `gmPlaceOf`), and answers noRoom otherwise - and for `at` null, a row written before the
 * place was kept - so its Reroll is given back whole. Until then it searched wherever the
 * character stood at the Reroll: a miss in an empty room, rerolled after a walk into another
 * student's bedroom, opened the stash hidden there, where no Analyze was paid or thrown and
 * no trap watching for a hunt was told.
 *
 * NO HUNT IN A CLASS TRIAL (E16 part 2 C3, 26.10.2026; audit S02-70, the owner's D16: "odmawia choice 'hint' i 'stash'
 * w classTrial, także z pakietu"). In a trial Analyze only identifies Truth Bullets, and its picker no longer offers the
 * hunt (action-analyze.mjs `ANALYZE_TRIAL_FILTER`) - but a console's packet, a GM's own call and a Reroll of a hunt thrown
 * before the trial all come here, so here is where it is refused, on this GM's clock, before the throw is read: no trap
 * told, nothing whispered, nothing written. `{ refused }`, told by the bridge as `trialLocked` (bridge-runs-acts.mjs
 * `handleFindStash`, bridge-asks.mjs `requestStashSearch`), and a Reroll's replay is given back whole (reroll.mjs `settleStashFind`).
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

/** GM: look inside anybody's stash, and pull things out of it. */
export async function openVaultInspector() {
    // ONE OF THESE, NOT FOUR - see `alreadyOpen` in live.mjs. Two copies of a
    // window each read the world when they opened and neither knows about the
    // other, so the older one goes on looking authoritative while showing
    // something that stopped being true. Raised rather than refused: pressing
    // twice usually means the window is behind something.
    if (alreadyOpen("drpg-window-stashes")) return RAISED;

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

    // On the kit's frame (E21 C5a): a read-only window, its one word Close (foldable, as every kit window).
    return drpgWindow({
        title: game.i18n.localize("DRPG.Vault.inspectTitle"),
        classes: ["drpg-panel", "drpg-window-stashes"],
        body: `<div>${sections}
            <p class="notes">${game.i18n.localize("DRPG.Vault.inspectNote")}</p></div>`,
        footer: { close: "close" },
        rejectClose: false
    });
}
