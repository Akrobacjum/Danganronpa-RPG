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

import { MODULE_ID, FLAGS, ITEM_CATEGORIES, BEDROOM_KEY_FLAG } from "./config.mjs";
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
/**
 * Take something off a body.
 *
 * A handover with nobody on the other side of it: the dead cannot refuse, so
 * this is the one transfer in the module that no one consents to. Everything
 * else about it is `giveItem` — the object MOVES, it is not copied, because a
 * knife that is both on the corpse and in a pocket is the sort of bug an
 * investigation cannot recover from.
 *
 * TWO THINGS HAPPEN BESIDES THE MOVE, and they are the point of the feature
 * rather than decoration on it:
 *
 *   the taker gets a TRUTH BULLET naming what they took and off whom. Not
 *   analysed — the name says what and where, and whether it MATTERS is what an
 *   Analyze answers. Looting gives you a lead, not a conclusion.
 *
 *   the body gets ONE TRACE, and one only, however many things leave it. "Ktoś
 *   grzebał przy ciele" (Dawid, 27.08): the GM writes what it looks like, the
 *   analysis names the objects, and it never names the person — you cannot read
 *   a hand off a turned-out pocket.
 *
 * The trace is what stops this being the only free, invisible way to destroy
 * evidence in the game. Everything else that hides something goes through Stage
 * 6: an action, a roll, a threshold, and Despair breaking your tool. Looting
 * bypassed all of it. The trace does not take the suppression away — it prices
 * it, in the machinery that already exists.
 */
export async function lootBody({ takerId, bodyId, itemId } = {}) {
    if (!game.user.isGM) return null;

    const taker = game.actors.get(takerId);
    const body = game.actors.get(bodyId);
    const item = body?.items?.get(itemId);
    if (!taker || !body || !item) return null;

    const { isDeceased } = await import("./chapter.mjs");
    if (!isDeceased(body)) {
        warn(`Refused to loot ${body.name}: they are not dead.`);
        return null;
    }
    if (isTruthBullet(item)) {
        // They perish at death and should never be here to take.
        warn("Refused to loot a Truth Bullet from a body.");
        return null;
    }

    const category = item.getFlag(MODULE_ID, "category");
    if (!category) return null;

    const name = item.name;
    const taken = await grantItem(taker, {
        name,
        category,
        tier: item.getFlag(MODULE_ID, "tier") ?? null,
        description: item.system?.description ?? "",
        img: item.img,
        // Roles included since E9 — see `preservedFlags`. A crowbar off a body
        // is still a crowbar that can be swung.
        extraFlags: preservedFlags(item)
    });
    // `grantItem` puts it in the stash when the hands are full and says so, so
    // "no room" is not a failure here — only a refusal is.
    if (!taken) return null;

    try {
        await item.delete();
    } catch (err) {
        error("Could not take the item off the body", err);
        const { whisperToGms } = await import("./utils.mjs");
        await whisperToGms(`<p class="drpg-warning">${game.i18n.format("DRPG.Handover.stuck", {
            name: foundry.utils.escapeHTML(name),
            who: foundry.utils.escapeHTML(body.name)
        })}</p>`);
    }

    const trace = await markBodyDisturbed(body, name);
    await mintLootBullet(taker, body, item, name, category, trace);

    log(`${taker.name} took "${name}" from ${body.name}'s body.`);
    return taken;
}

/**
 * One trace per body, and the list of what has left it grows inside it.
 *
 * The remnant is recorded on the CORPSE rather than looked up on the map,
 * because "is there already a trace here" is a question the map answers badly:
 * a room can hold a dozen traces and none of them about this body.
 *
 * NO TOKEN, NO TRACE, AND NO FAILURE (trap 142). `dropRemnant` is loud about a
 * missing token — rightly, since a silent missing trace is the one failure an
 * investigation never recovers from — but a body with no token on the scene is
 * a situation rather than a fault, and it must not cost the player their loot.
 */
async function markBodyDisturbed(body, itemName) {
    const record = body.getFlag(MODULE_ID, FLAGS.lootTrace) ?? null;
    const taken = [...(record?.taken ?? []), itemName];

    const { setRemnantSecretById } = await import("./remnants.mjs");
    const existing = record?.tokenId
        ? game.scenes.get(record.sceneId)?.tokens?.get(record.tokenId)
        : null;

    if (existing) {
        // The same trace, saying that one more thing has gone.
        await setRemnantSecretById(record.sceneId, record.tokenId, {
            note: game.i18n.format("DRPG.Loot.traceNote", { items: taken.join(", ") })
        });
        await body.setFlag(MODULE_ID, FLAGS.lootTrace, { ...record, taken });
        return record;
    }

    const { dropRemnant } = await import("./remnants.mjs");
    const token = await dropRemnant(body, {
        type: "neutral",
        // Subtle: it has to be found. Evident would make a billboard of it and
        // looting would stop being worth doing at all.
        visibility: "subtle",
        note: game.i18n.format("DRPG.Loot.traceNote", { items: taken.join(", ") }),
        action: "loot",
        subject: body.name,
        // About the body, so it survives the chapter-end sweep.
        tiedToCrime: true
    }).catch(() => null);

    if (!token) return null;

    const next = { sceneId: token.parent?.id ?? null, tokenId: token.id, taken };
    await body.setFlag(MODULE_ID, FLAGS.lootTrace, next);
    return next;
}

/**
 * The Truth Bullet the taker walks away with.
 *
 * `neutral` and NOT analysed on purpose. The name already says what was taken
 * and off whom — that is the fact, and it is free. Whether the thing bears on
 * the murder is the question, and questions cost an Analyze in this game.
 *
 * `tiedToCrime` mirrors what Search already does with crime gear: true when the
 * thing can do a killer's work, left undecided otherwise. It is the GM-side
 * answer key, published on analysis, so a cereal bar off a body does not arrive
 * pre-labelled as meaningless either.
 */
async function mintLootBullet(taker, body, item, name, category, trace) {
    try {
        const { createTruthBullet } = await import("./truth-bullets.mjs");
        const { servesAs } = await import("./inventory.mjs");
        const incriminating = ["crimeTool", "cleaningTool"].some(role => servesAs(item, role));

        await createTruthBullet(taker, {
            name: game.i18n.format("DRPG.Loot.bulletName", { item: name }),
            realType: "neutral",
            visibility: "evident",
            playerText: game.i18n.format("DRPG.Loot.bulletText", {
                item: name, who: body.name
            }),
            img: item.img,
            sourceAction: "loot",
            tiedToCrime: incriminating ? true : null,
            remnantId: trace?.tokenId ?? null,
            sceneId: trace?.sceneId ?? null
        });
    } catch (err) {
        // The object moved; the record of it did not. Worth saying out loud,
        // because the investigation is what this whole feature is for.
        error("Could not record what was taken off the body", err);
    }
}

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
