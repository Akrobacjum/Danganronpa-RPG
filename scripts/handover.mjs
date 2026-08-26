/**
 * Danganronpa RPG — passing things between characters.
 * ---------------------------------------------------------------------------
 * Two handovers that look alike and are not:
 *
 *   a Truth Bullet is COPIED. Evidence is knowledge, and telling somebody what
 *     you found does not stop you knowing it. Both characters end up holding
 *     one. This is what makes an Investigation a group activity at all.
 *
 *   an item is MOVED. A crowbar in your hand is not in mine. The giver loses
 *     it, and the receiver's carry limit has a say in whether they can take it.
 *
 * Neither costs an action, and both are refused unless the two characters are
 * standing in the same room.
 *
 * The room check is made twice on purpose. The player's client uses it to build
 * the list of who is nearby, because that is what it can see. The GM's client
 * makes it again before touching anything, because a socket message is a claim
 * about the world and not the world — and only this side may write to another
 * player's sheet in the first place.
 */

import { MODULE_ID, ITEM_CATEGORIES, BEDROOM_KEY_FLAG } from "./config.mjs";
import { grantItem, canCarry, preservedFlags } from "./inventory.mjs";
import { createTruthBullet, truthBulletData, secretOf, isTruthBullet } from "./truth-bullets.mjs";
import { dialogContent, whisperToOwner, log, warn, error } from "./utils.mjs";

const DialogV2 = foundry.applications.api.DialogV2;

/* ==========================================================================
 * PLAYER SIDE — WHO IS STANDING HERE
 * ========================================================================== */

/** Ask who to hand this to. `null` when there is nobody, or the player backs out. */
async function askRecipient(actor, item, { copying }) {
    const { isEclipse } = await import("./eclipse.mjs");
    if (isEclipse()) {
        ui.notifications.warn(game.i18n.localize("DRPG.Eclipse.actionsLocked"));
        return null;
    }

    const { othersInRoom, roomOfActor } = await import("./movement.mjs");
    const here = othersInRoom(actor);
    if (!here.length) {
        ui.notifications.warn(game.i18n.format("DRPG.Handover.nobodyHere", {
            room: roomOfActor(actor) ?? "—"
        }));
        return null;
    }

    const options = here
        .map(a => `<option value="${a.id}">${foundry.utils.escapeHTML(a.name)}</option>`).join("");

    const picked = await DialogV2.wait({
        window: {
            title: copying
                ? game.i18n.format("DRPG.Handover.shareTitle", { name: item.name })
                : game.i18n.format("DRPG.Handover.giveTitle", { name: item.name })
        },
        classes: ["drpg-panel"],
        content: dialogContent(`<form>
            <p>${game.i18n.format(copying ? "DRPG.Handover.shareIntro" : "DRPG.Handover.giveIntro", {
                name: foundry.utils.escapeHTML(item.name),
                room: foundry.utils.escapeHTML(roomOfActor(actor) ?? "—")
            })}</p>
            <label>${game.i18n.localize("DRPG.Handover.who")}
                <select name="target">${options}</select></label>
            <p class="notes">${game.i18n.localize(
                copying ? "DRPG.Handover.shareNote" : "DRPG.Handover.giveNote"
            )}</p>
        </form>`),
        buttons: [
            {
                action: "ok",
                label: game.i18n.localize(copying ? "DRPG.Handover.share" : "DRPG.Handover.give"),
                default: true,
                callback: (e, b, d) => d.element.querySelector("[name=target]").value
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    if (!picked || picked === "cancel") return null;
    return picked;
}

/** Copy one of my Truth Bullets to somebody in this room. Costs nothing. */
export async function shareBulletDialog(actor, item) {
    if (!isTruthBullet(item)) return false;

    const targetId = await askRecipient(actor, item, { copying: true });
    if (!targetId) return false;

    const { requestShareBullet } = await import("./gm-bridge.mjs");
    await requestShareBullet({ fromId: actor.id, toId: targetId, itemId: item.id });
    return true;
}

/**
 * Hand one of my items to somebody in this room.
 *
 * `copying` is about the WORDING, not the mechanism. The GM side decides what
 * actually happens to the document — an ordinary item moves, a bedroom key is
 * copied (see `shareKey`) — and this flag makes the dialog say the same thing
 * the item is about to do. Getting it wrong is worse than it sounds: "you will
 * no longer have it" on a key would make a player think twice about the one
 * social move keys exist for.
 */
export async function giveItemDialog(actor, item, { copying = false } = {}) {
    const targetId = await askRecipient(actor, item, { copying });
    if (!targetId) return false;

    const { requestGiveItem } = await import("./gm-bridge.mjs");
    await requestGiveItem({ fromId: actor.id, toId: targetId, itemId: item.id });
    return true;
}

/**
 * Copy a bedroom key onto somebody else's sheet.
 *
 * One key per room per person: two copies of the same key open the same door
 * and only make the inventory longer. Refusing quietly would look broken, so
 * the giver is told.
 */
async function shareKey({ from, to, item }) {
    const room = item.getFlag(MODULE_ID, BEDROOM_KEY_FLAG);
    if (!room) return null;

    const already = to.items.some(i => i.getFlag(MODULE_ID, BEDROOM_KEY_FLAG) === room);
    if (already) {
        await whisperToOwner(from, `<p>${game.i18n.format("DRPG.Handover.alreadyHasIt", {
            who: foundry.utils.escapeHTML(to.name),
            name: foundry.utils.escapeHTML(item.name)
        })}</p>`);
        return null;
    }

    const { grantBedroomKey } = await import("./vault.mjs");
    const copy = await grantBedroomKey(to, room, { silent: true });
    if (!copy) return null;

    await whisperToOwner(to, `<p>${game.i18n.format("DRPG.Vault.keyShared", {
        room: foundry.utils.escapeHTML(room),
        who: foundry.utils.escapeHTML(from.name)
    })}</p>`);
    await whisperToOwner(from, `<p>${game.i18n.format("DRPG.Vault.keyGave", {
        room: foundry.utils.escapeHTML(room),
        who: foundry.utils.escapeHTML(to.name)
    })}</p>`);
    log(`${from.name} shared the key to ${room} with ${to.name}.`);
    return copy;
}

/* ==========================================================================
 * GM SIDE — THE PART THAT ACTUALLY WRITES
 * ========================================================================== */

/** Shared preflight: everyone exists, the item is real, and they are together. */
async function verify(fromId, toId, itemId) {
    const from = game.actors.get(fromId);
    const to = game.actors.get(toId);
    if (!from || !to || from.id === to.id) return null;

    const item = from.items.get(itemId);
    if (!item) return null;

    const { sameRoom } = await import("./movement.mjs");
    if (!sameRoom(from, to)) {
        warn(`Handover refused: ${from.name} and ${to.name} are not in the same room.`);
        await whisperToOwner(from, `<p>${game.i18n.format("DRPG.Handover.tooFar", {
            name: foundry.utils.escapeHTML(to.name)
        })}</p>`);
        return null;
    }

    // The dead take nothing. `askRecipient` already leaves them out of the
    // picker, because it builds the list from `othersInRoom` — but this side is
    // the one that decides, and it was asking `sameRoom`, which counts a body
    // as an occupant. Two ways past that: a socket message naming a corpse
    // directly, and the ordinary race where the recipient dies between the
    // giver choosing them and this running. Either way the item would land on
    // an actor whose inventory has already been destroyed, and stay there.
    const { isDeceased } = await import("./chapter.mjs");
    if (isDeceased(to)) {
        warn(`Handover refused: ${to.name} is dead.`);
        await whisperToOwner(from, `<p>${game.i18n.format("DRPG.Handover.recipientDead", {
            name: foundry.utils.escapeHTML(to.name)
        })}</p>`);
        return null;
    }

    // And the dead give nothing either.
    //
    // Normally moot, because `killCharacter` destroys the inventory — but not
    // when the GM ticked "keep their items" for a death that is not a
    // killing-game murder, and not for the window between a sheet being left
    // open and the body being found. A corpse quietly passing its Truth Bullets
    // around the room is the same leak as one that can still be heard on voice.
    if (isDeceased(from)) {
        warn(`Handover refused: ${from.name} is dead.`);
        return null;
    }

    return { from, to, item };
}

/**
 * Copy a Truth Bullet onto another character.
 *
 * The copy carries everything the giver knows, including the answer key entry —
 * so a bullet the giver had already identified arrives identified. What it does
 * NOT carry is the giver's failed attempt: `createTruthBullet` always writes a
 * null lock, which is the whole reason handing a bullet to somebody else is
 * worth doing after you have burned your own analysis on it.
 */
export async function shareBullet({ fromId, toId, itemId } = {}) {
    if (!game.user.isGM) return null;

    const checked = await verify(fromId, toId, itemId);
    if (!checked) return null;
    const { from, to, item } = checked;

    if (!isTruthBullet(item)) return null;

    const data = truthBulletData(item);
    const secret = secretOf(item.uuid);

    // One trace, one copy per person — the same rule Observe enforces, applied
    // to the other way a trace can reach somebody. Without it, two players who
    // both found the same Remnant could hand it back and forth and end up with
    // a stack of identical evidence.
    //
    // Only checkable when the bullet came from a Remnant. A bullet the GM
    // invented by hand has no source to compare, and duplicating one of those
    // is the GM's business rather than a rule to enforce.
    if (secret.remnantId) {
        const { copiedRemnants } = await import("./truth-bullets.mjs");
        if (copiedRemnants(to).has(secret.remnantId)) {
            await whisperToOwner(from, `<p>${game.i18n.format("DRPG.Handover.alreadyHasIt", {
                who: foundry.utils.escapeHTML(to.name),
                name: foundry.utils.escapeHTML(item.name)
            })}</p>`);
            return null;
        }
    }

    const copy = await createTruthBullet(to, {
        name: item.name,
        realType: secret.realType ?? "neutral",
        shownType: data.shownType,
        analyzed: data.analyzed,
        visibility: data.visibility,
        faint: data.faint,
        playerText: data.playerText,
        gmNote: secret.gmNote ?? "",
        remnantId: secret.remnantId ?? null,
        sceneId: secret.sceneId ?? null,
        // The copy documents the original discovery, not the moment of copying.
        room: data.room,
        stamp: { chapter: data.chapter, day: data.day, timeOfDay: data.timeOfDay },
        // From the SECRET, not the item: `createTruthBullet` publishes these
        // onto the copy only if it is born identified, so handing over an
        // unidentified bullet still hands over nothing the giver cannot see.
        sourceAction: secret.sourceAction ?? null,
        tiedToCrime: secret.tiedToCrime ?? null
    });

    if (!copy) {
        await whisperToOwner(from, `<p>${game.i18n.localize("DRPG.Handover.failed")}</p>`);
        return null;
    }

    await whisperToOwner(to, `
        <h3>${game.i18n.localize("DRPG.Handover.receivedBullet")}</h3>
        <p>${game.i18n.format("DRPG.Handover.receivedBulletFrom", {
            who: foundry.utils.escapeHTML(from.name),
            name: foundry.utils.escapeHTML(item.name)
        })}</p>
        ${data.playerText ? `<p>${foundry.utils.escapeHTML(data.playerText)}</p>` : ""}`);

    await whisperToOwner(from, `<p>${game.i18n.format("DRPG.Handover.shared", {
        name: foundry.utils.escapeHTML(item.name),
        who: foundry.utils.escapeHTML(to.name)
    })}</p>`);

    log(`${from.name} shared the Truth Bullet "${item.name}" with ${to.name}.`);
    return copy;
}

/**
 * Move an item from one character to another.
 *
 * Refused when the receiver is already carrying their limit. A GM handing
 * something over is making a ruling and may go over the cap; two players
 * swapping crowbars are not, and letting them would make the guide's limits
 * a formality anyone could route around.
 *
 * Created before deleted, deliberately. If the create fails the giver still has
 * their item; the other order can lose it entirely.
 */
export async function giveItem({ fromId, toId, itemId } = {}) {
    if (!game.user.isGM) return null;

    const checked = await verify(fromId, toId, itemId);
    if (!checked) return null;
    const { from, to, item } = checked;

    // Truth Bullets are copied, never moved — see `shareBullet`.
    if (isTruthBullet(item)) return shareBullet({ fromId, toId, itemId });

    // So are keys, for the same reason in a different shape: handing somebody
    // the key to your room should not take you out of it. The copy carries the
    // room flag, which is the only thing that makes a key a key.
    if (item.getFlag(MODULE_ID, BEDROOM_KEY_FLAG)) return shareKey({ from, to, item });

    const category = item.getFlag(MODULE_ID, "category");
    if (!category) {
        warn(`Handover refused: "${item.name}" is not an item this module tracks.`);
        return null;
    }

    const room = canCarry(to, category);
    if (!room.ok) {
        await whisperToOwner(from, `<p>${game.i18n.format("DRPG.Handover.theirHandsFull", {
            who: foundry.utils.escapeHTML(to.name),
            category: foundry.utils.escapeHTML(ITEM_CATEGORIES[category]?.plural ?? category),
            limit: room.limit
        })}</p>`);
        return null;
    }

    const name = item.name;
    const copy = await grantItem(to, {
        name,
        category,
        tier: item.getFlag(MODULE_ID, "tier") ?? null,
        description: item.system?.description ?? "",
        img: item.img,
        // A ruined thing stays ruined on the other side of the table. Without
        // this, handing the murder weapon to an accomplice repaired it.
        extraFlags: preservedFlags(item)
    });

    if (!copy) {
        await whisperToOwner(from, `<p>${game.i18n.localize("DRPG.Handover.failed")}</p>`);
        return null;
    }

    try {
        await item.delete();
    } catch (err) {
        // The receiver has it and the giver still does. Say so loudly rather
        // than leave the table to discover the duplicate at the trial.
        error("Could not remove the handed-over item from the giver", err);
        const { whisperToGms } = await import("./utils.mjs");
        await whisperToGms(`<p class="drpg-warning">${game.i18n.format("DRPG.Handover.stuck", {
            name: foundry.utils.escapeHTML(name),
            who: foundry.utils.escapeHTML(from.name)
        })}</p>`);
    }

    await whisperToOwner(to, `
        <h3>${game.i18n.localize("DRPG.Handover.receivedItem")}</h3>
        <p>${game.i18n.format("DRPG.Handover.receivedItemFrom", {
            who: foundry.utils.escapeHTML(from.name),
            name: foundry.utils.escapeHTML(name)
        })}</p>`);

    await whisperToOwner(from, `<p>${game.i18n.format("DRPG.Handover.gave", {
        name: foundry.utils.escapeHTML(name),
        who: foundry.utils.escapeHTML(to.name)
    })}</p>`);

    log(`${from.name} gave "${name}" to ${to.name}.`);
    return copy;
}
