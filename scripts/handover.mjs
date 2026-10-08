/**
 * Danganronpa RPG - passing things between characters.
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
 * about the world and not the world - and only this side may write to another
 * player's sheet in the first place.
 */

import { MODULE_ID, FLAGS, BEDROOM_KEY_FLAG } from "./config.mjs";
import { grantItem, canCarry, preservedFlags, capacityLabel, isStashed } from "./inventory.mjs";
import { createTruthBullet, truthBulletData, secretOf, isTruthBullet, bulletAsHeld } from "./truth-bullets.mjs";
import { dialogContent, whisperToOwner, log, warn, error, isPrimaryGm, forcedDeletion } from "./utils.mjs";
import { answerKeysRefusal, lootTraceStore, deathStore } from "./gm-stores.mjs";

const DialogV2 = foundry.applications.api.DialogV2;

/* ==========================================================================
 * PLAYER SIDE - WHO IS STANDING HERE
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
            room: roomOfActor(actor) ?? "-"
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
                room: foundry.utils.escapeHTML(roomOfActor(actor) ?? "-")
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
    const res = await requestShareBullet({ fromId: actor.id, toId: targetId, itemId: item.id });
    return res.ok;
}

/**
 * Hand one of my items to somebody in this room.
 *
 * `copying` is about the WORDING, not the mechanism. The GM side decides what
 * actually happens to the document - an ordinary item moves, a bedroom key is
 * copied (see `shareKey`) - and this flag makes the dialog say the same thing
 * the item is about to do. Getting it wrong is worse than it sounds: "you will
 * no longer have it" on a key would make a player think twice about the one
 * social move keys exist for.
 */
export async function handOverDialog(actor, item, { copying = false } = {}) {
    const targetId = await askRecipient(actor, item, { copying });
    if (!targetId) return false;

    const { requestGiveItem } = await import("./gm-bridge.mjs");
    const res = await requestGiveItem({ fromId: actor.id, toId: targetId, itemId: item.id });
    return res.ok;
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
        await whisperToOwner(from, `<p>${game.i18n.format("DRPG.Handover.alreadyHasKey", {
            who: foundry.utils.escapeHTML(to.name)
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
 * GM SIDE - THE PART THAT ACTUALLY WRITES
 * ========================================================================== */

/** Shared preflight: everyone exists, the item is real, and they are together. */
async function verify(fromId, toId, itemId) {
    const from = game.actors.get(fromId);
    const to = game.actors.get(toId);
    if (!from || !to || from.id === to.id) return null;

    const item = from.items.get(itemId);
    if (!item) return null;

    // Not during an Eclipse, on this side too (E03; audit S08-33). The dialog
    // checks it, and a dialog opened a moment before the lights went out and
    // confirmed after still went through.
    const { isEclipse } = await import("./eclipse.mjs");
    if (isEclipse()) {
        await whisperToOwner(from, `<p>${game.i18n.localize("DRPG.Eclipse.actionsLocked")}</p>`);
        return null;
    }

    const { sameRoom } = await import("./movement.mjs");
    if (!sameRoom(from, to)) {
        warn(`Handover refused: ${from.name} and ${to.name} are not in the same room.`);
        await whisperToOwner(from, `<p>${game.i18n.format("DRPG.Handover.tooFar", {
            name: foundry.utils.escapeHTML(to.name)
        })}</p>`);
        return null;
    }

    // The dead take nothing. `askRecipient` already leaves them out of the
    // picker, because it builds the list from `othersInRoom` - but this side is
    // the one that decides, and it was asking `sameRoom`, which counts a body
    // as an occupant. Two ways past that: a socket message naming a corpse
    // directly, and the ordinary race where the recipient dies between the
    // giver choosing them and this running. Either way the item would land on
    // an actor whose inventory has already been destroyed, and stay there.
    const { isDeadForGm, isDeceased } = await import("./chapter.mjs");
    if (isDeadForGm(to)) {
        warn(`Handover refused: ${to.name} is dead${isDeceased(to) ? "" : " (nobody has found the body)"}.`);
        /* Rule D (E05 C10): a body nobody has found is not named to the giver, who may not
           know of it - they are told it cannot be done now, and the reason stays here. */
        await whisperToOwner(from, `<p>${isDeceased(to)
            ? game.i18n.format("DRPG.Handover.recipientDead", { name: foundry.utils.escapeHTML(to.name) })
            : game.i18n.localize("DRPG.Bridge.why.cannotNow")}</p>`);
        return null;
    }

    // And the dead give nothing either.
    //
    // Normally moot, because `killCharacter` destroys the inventory - but not
    // when the GM ticked "keep their items" for a death that is not a
    // killing-game murder, and not for the window between a sheet being left
    // open and the body being found. A corpse quietly passing its Truth Bullets
    // around the room is the same leak as one that can still be heard on voice.
    if (isDeadForGm(from)) {
        warn(`Handover refused: ${from.name} is dead.`);
        return null;
    }

    return { from, to, item };
}

/**
 * Copy a Truth Bullet onto another character.
 *
 * The copy carries everything the giver knows, including the answer key entry -
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

    /* NO ANSWER KEY, NO COPY (E04's fix round; the review's C-m17). The copy below was
       minted with `realType ?? "neutral"`: a bullet whose answer key this GM's browser
       lacks - lost, or a copy not arrived - was handed over as an explicit Neutral, a
       reading nobody made, while an Analyze of the original was refused for the same
       reason (analyze.mjs). It waits for the other GMs' copies as the Analyze does, and
       is then refused, and the giver told. The wait is the Analyze's too (fix round 10):
       bounded, and on a GM whose stores did not open it is refused through the bridge
       (`keysNotOpen`, which its run passes on) - measured on 05ac984 with the store held
       (61 M): in 24 s its giver was told nothing, and nothing was copied. A handover
       costs nothing, so nothing is handed back. */
    const notOpen = await answerKeysRefusal();
    if (notOpen) return { refused: notOpen };
    /* AS THE GMS HOLD IT (E29 fix r2-H17, 06.10.2026): what the copy is minted from - its name, its text, what it
       shows and whether it was read, which decide whether the copy is born with the reading - is read off the GMs'
       copy of the bullet (truth-bullets.mjs `bulletAsHeld`), never off a player's write of it still waiting for its
       put-back. */
    const data = truthBulletData(bulletAsHeld(item));
    const secret = secretOf(item.uuid);
    if (!secret.realType) {
        await whisperToOwner(from, `<p>${game.i18n.format("DRPG.Handover.answerKeyMissing", {
            name: foundry.utils.escapeHTML(data.name)
        })}</p>`);
        return null;
    }

    // One trace, one copy per person - the same rule Observe enforces, applied
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
                name: foundry.utils.escapeHTML(data.name)
            })}</p>`);
            return null;
        }
    }

    const copy = await createTruthBullet(to, {
        name: data.name,
        realType: secret.realType,
        shownType: data.shownType,
        analyzed: data.analyzed,
        visibility: data.visibility,
        playerText: data.playerText,
        gmNote: secret.gmNote ?? "",
        remnantId: secret.remnantId ?? null,
        sceneId: secret.sceneId ?? null,
        // The copy documents the original discovery, not the moment of copying.
        room: data.room,
        stamp: { chapter: data.chapter, day: data.day, timeOfDay: data.timeOfDay },
        // The find's chapter for the Key fee from the giver's ANSWER KEY (E09 fix r1-G3): the
        // stamp above is the giver's item flag, which the giver writes. A copy made before that
        // fix names none, and neither does this one.
        foundIn: secret.chapter ?? null,
        // From the SECRET, not the item: `createTruthBullet` publishes these
        // onto the copy only if it is born identified, so handing over an
        // unidentified bullet still hands over nothing the giver cannot see.
        //
        // `analyzedText` rides the same road for the same reason, and the
        // symmetry is the point. Hand over evidence you HAVE analysed and the
        // copy is born identified, so the receiver gets your reading with it -
        // which is what sharing findings in this game means. Hand over
        // something you have not, and the copy is born Neutral: the reading is
        // in its secret, waiting for the receiver's own Head roll, and their
        // browser holds not one word of it in the meantime.
        sourceAction: secret.sourceAction ?? null,
        tiedToCrime: secret.tiedToCrime ?? null,
        analyzedText: secret.analyzedText ?? "",
        /* And `faint` moved onto this road in 1.2.47. Read off the giver's ITEM
           it would have come back false for every unidentified bullet, so every
           copy of a doubtful trace would have quietly stopped being doubtful -
           and the chapter's clear would then have taken it. */
        faint: typeof secret.faint === "boolean"
            ? secret.faint
            : Boolean(data.faint)
    });

    if (!copy) {
        await whisperToOwner(from, `<p>${game.i18n.localize("DRPG.Handover.failed")}</p>`);
        return null;
    }

    await whisperToOwner(to, `
        <h3>${game.i18n.localize("DRPG.Handover.receivedBullet")}</h3>
        <p>${game.i18n.format("DRPG.Handover.receivedBulletFrom", {
            who: foundry.utils.escapeHTML(from.name),
            name: foundry.utils.escapeHTML(data.name)
        })}</p>
        ${data.playerText ? `<p>${foundry.utils.escapeHTML(data.playerText)}</p>` : ""}`);

    await whisperToOwner(from, `<p>${game.i18n.format("DRPG.Handover.shared", {
        name: foundry.utils.escapeHTML(data.name),
        who: foundry.utils.escapeHTML(to.name)
    })}</p>`);

    log(`${from.name} shared the Truth Bullet "${data.name}" with ${to.name}.`);
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
 * else about it is `giveItem` - the object MOVES, it is not copied, because a
 * knife that is both on the corpse and in a pocket is the sort of bug an
 * investigation cannot recover from.
 *
 * TWO THINGS HAPPEN BESIDES THE MOVE, and they are the point of the feature
 * rather than decoration on it:
 *
 *   the taker gets a TRUTH BULLET naming what they took and off whom. Not
 *   analysed - the name says what and where, and whether it MATTERS is what an
 *   Analyze answers. Looting gives you a lead, not a conclusion.
 *
 *   the body gets ONE TRACE, and one only, however many things leave it. "Ktoś
 *   grzebał przy ciele" (Dawid, 27.08): the GM writes what it looks like, the
 *   analysis names the objects, and it never names the person - you cannot read
 *   a hand off a turned-out pocket.
 *
 * The trace is what stops this being the only free, invisible way to destroy
 * evidence in the game. Everything else that hides something goes through Stage
 * 6: an action, a roll, a threshold, and Despair breaking your tool. Looting
 * bypassed all of it. The trace does not take the suppression away - it prices
 * it, in the machinery that already exists.
 */
export async function lootBody({ takerId, bodyId, itemId, askedBy = null } = {}) {
    if (!game.user.isGM) return null;

    const taker = game.actors.get(takerId);
    const body = game.actors.get(bodyId);
    const item = body?.items?.get(itemId);
    if (!taker || !body || !item) return null;

    /* BEFORE THE DISCOVERY, BY THOSE WHO KNOW (E05 C10; the owner's Q2, 26.09.2026). A body
       nobody has found may be searched by whoever knows of the death - the incident's
       players, the victim's own, a GM - asked of the GMs' record by the user who sent the
       request (`askedBy`, Foundry's sender; a GM's own button sends none), never of the
       public fact. The item moving between two sheets is world data every console reads,
       which the owner chose knowing it. */
    const { isDeceased, isDeadForGm } = await import("./chapter.mjs");
    if (!isDeceased(body)) {
        const { knowsOfDeath } = await import("./murder.mjs");
        const asker = askedBy ? game.users.get(askedBy) : game.user;
        if (!isDeadForGm(body) || !knowsOfDeath(asker, body.id)) {
            warn(`Refused to loot ${body.name}: ${isDeadForGm(body) ? "the asker does not know of the death" : "they are not dead"}.`);
            return null;
        }
    }
    // As the GMs hold it, from here to the grant (E29 fix r2-H17, `giveItem`): a body's owner can still write it.
    // And the taker's hands as the GMs hold them, which `grantItem`'s cap counts (fix r2-H18, `giveItem`).
    const { itemAsHeld, actorAsHeld, judgedFor, creationRefusal } = await import("./sheet-audit.mjs");
    await judgedFor(body.id, taker.id);
    const held = await itemAsHeld(body, item.id);
    const counted = await actorAsHeld(taker);
    if (!held) return null;
    // An item a player made on the body's sheet that no GM has decided on yet is taken by nobody, and the taker told
    // (E29 fix r2-H21, sheet-audit.mjs `creationRefusal`).
    const undecided = creationRefusal(body, held.id);
    if (undecided) {
        warn(`Refused to loot ${body.name}: ${undecided}.`);
        return { refused: undecided };
    }
    if (isTruthBullet(held)) {
        // They perish at death and should never be here to take.
        warn("Refused to loot a Truth Bullet from a body.");
        return null;
    }

    const category = held.getFlag(MODULE_ID, "category");
    if (!category) return null;
    // The loot picker already filters these out; the authority has to agree
    // with it (ITEM-06): a stash across the map is not on the body.
    if (isStashed(held)) {
        warn(`Refused to loot "${held.name}" from ${body.name}: it is in a stash, not on the body.`);
        return null;
    }

    const name = held.name;
    const taken = await grantItem(taker, {
        reason: "gmRuling",
        name,
        category,
        tier: held.getFlag(MODULE_ID, "tier") ?? null,
        description: held.system?.description ?? "",
        img: held.img,
        // Roles included since E9 - see `preservedFlags`. A crowbar off a body
        // is still a crowbar that can be swung.
        extraFlags: preservedFlags(held),
        counted
    });
    // `grantItem` puts it in the stash when the hands are full and says so, so
    // "no room" is not a failure here - only a refusal is.
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
    /* THE BULLET WAITS FOR THE TABLE (E05 fix r2-F0b, 27.09.2026; the owner's Q1-Q3, the plan's
       section 2). The Truth Bullet of a loot names the body it came off, and it is an item on the
       taker's sheet, which every console reads: minted here before the discovery, it told a death
       nobody had been told of - measured on e47a5d5: in 72-canary its creation reached p1, who knew
       nothing, carrying "Taken from Botan Kage's body.", and in tier 2 a body's second loot kept
       those words at rest (the first's were covered by its trace's reveal, below). A body the
       table does not know is dead gets the item's move alone, which the owner chose (Q2); the
       bullet is owed by the death's row in the GMs' store and given by the publication
       (chapter.mjs `publishDeath`), dated when and where the item was taken. The taker knows
       what they took; the GMs have the row. */
    const loot = await lootRecord(taker, held, name, trace);
    if (isDeceased(body)) await mintLootBullet(taker, body, loot);
    else await oweLootBullet(body, loot);

    log(`${taker.name} took "${name}" from ${body.name}'s body.`);
    return taken;
}

/**
 * What a loot's Truth Bullet is made of, as plain data: minted at once for a body the table
 * knows is dead, kept in the death's row until the publication for one it does not (E05 fix
 * r2-F0b). The stamp and the room are the loot's own - the clock and the taker's room now.
 */
async function lootRecord(taker, item, name, trace) {
    const { servesAs } = await import("./inventory.mjs");
    const { roomOfActor } = await import("./movement.mjs");
    const { getClock } = await import("./clock.mjs");
    const clock = getClock();
    return {
        takerId: taker.id, item: name, img: item.img ?? null,
        tied: ["crimeTool", "cleaningTool"].some(role => servesAs(item, role)),
        sceneId: trace?.sceneId ?? null, tokenId: trace?.tokenId ?? null,
        room: roomOfActor(taker) ?? null, chapter: clock.chapter ?? null, day: clock.day ?? null, timeOfDay: clock.timeOfDay ?? null
    };
}

/**
 * A loot of a body nobody has found (E05 fix r2-F0b): its bullet's record joins the death's row,
 * which only a GM holds (`deathsFor` sends a player the kill's chapter, day and time of day, and
 * nothing else of it). `ifLive`: a death revived in the meantime has no row, and a loot off it
 * owes nothing.
 * A RECORD OF ITS OWN (E05 fix r2-G3, 27.09.2026; F0b's note). `loot` was one list, rewritten
 * whole by each loot, and the store keeps the newer of two writes of one field: measured on the
 * harness (61 S), two GMs each serving a loot of one body without having heard of the other's
 * ended holding one record, and the publication gave one taker nothing. It is a split field now
 * (gm-stores.mjs `deathStore`), a record per loot under a key of its own - when, on which GM -
 * so the merge keeps both, as the owed Despair keeps a row per conversion (despair.mjs). Not
 * covered, read and not measured: a loot served on one GM in the moment another publishes the
 * death - the publication drops the row, a record stamped before the drop goes with it, and the
 * item has moved with no bullet given.
 */
function oweLootBullet(body, loot) {
    const key = `${Date.now()}:${game.user.id}:${foundry.utils.randomID(4)}`;
    return deathStore.patch(body.id, { loot: { [key]: loot } }, { ifLive: true });
}

/** The loots a death's row owes, oldest first (`oweLootBullet`'s keys start with the time). */
export function owedLoot(row) {
    const owed = row?.loot;
    if (!owed || typeof owed !== "object" || Array.isArray(owed)) return [];
    return Object.entries(owed).filter(([, loot]) => loot && typeof loot === "object")
        .sort(([a], [b]) => (parseInt(a, 10) || 0) - (parseInt(b, 10) || 0) || (a < b ? -1 : a > b ? 1 : 0))
        .map(([, loot]) => loot);
}

/**
 * THE PUBLICATION GIVES WHAT A LOOT BEFORE IT OWED (E05 fix r2-F0b): each taker the Truth Bullet
 * of what they took, as a loot of a published body mints it, with the loot's own stamp and room.
 * Run by chapter.mjs `publishDeath` with the row it drops; a taker no longer in the world is
 * passed over. Answers how many were given.
 */
export async function payOwedLoot(body, owed = []) {
    if (!game.user.isGM || !body) return 0;
    let paid = 0;
    for (const loot of Array.isArray(owed) ? owed : []) {
        const taker = game.actors.get(loot?.takerId ?? "");
        if (!taker) continue;
        await mintLootBullet(taker, body, loot);
        paid++;
    }
    return paid;
}

/**
 * One trace per body, and the list of what has left it grows inside it.
 *
 * The remnant is recorded against the CORPSE rather than looked up on the map,
 * because "is there already a trace here" is a question the map answers badly:
 * a room can hold a dozen traces and none of them about this body.
 *
 * NO TOKEN, NO TRACE, AND NO FAILURE (trap 142). `dropRemnant` is loud about a
 * missing token - rightly, since a silent missing trace is the one failure an
 * investigation never recovers from - but a body with no token on the scene is
 * a situation rather than a fault, and it must not cost the player their loot.
 *
 * THE RECORD IS THE GMS' (E05 C14, 27.09.2026; audit S05-39 (3)). It was the body's
 * own `lootTrace` flag - the trace's token id and every item's name - and every
 * browser holds every actor's flags: a console read which trace on the map was the
 * body's, and what had left it, before anybody had found either. It is a row of the
 * GMs' `lootTraces` store now, read after the other GMs' copies have arrived, since
 * a row this browser has not received yet would read as a body nobody has touched
 * and a second trace would go down beside the first. The old flag is read while its
 * clause has not taken it (`liftLootTraces`, which runs once, on the primary, a
 * moment after the first load of 1.2.64): a loot in that moment adds to the trace
 * the flag names, and the clause, fill-only, then finds the row written and only
 * takes the flag off.
 */
async function markBodyDisturbed(body, itemName) {
    await lootTraceStore.whenHydrated();
    const record = lootTraceStore.get(body.id) ?? body.getFlag(MODULE_ID, FLAGS.lootTrace) ?? null;
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
        await lootTraceStore.patch(body.id, { sceneId: record.sceneId, tokenId: record.tokenId, taken });
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
    await lootTraceStore.patch(body.id, next);
    return next;
}

/**
 * A world from before 1.2.64 records each looted body's trace in the body's own
 * `lootTrace` flag, which every browser reads (audit S05-39 (3)). The clause
 * `liftLootTraces` (migrate.mjs, since 1.2.64) runs this once, on the primary, after
 * the store holds the other GMs' copies (E05 C14).
 *
 * Each record goes into the body's row weak and fill-only - a row a loot wrote since
 * keeps its own - and the flag leaves the actor only once the row reads back from
 * storage holding a `tokenId`. A flag that names no trace (a record with no token id,
 * a `null`) has nothing to lift and is deleted. A flag still on an actor after that
 * throws, with the count, so the world is not stamped and the next load tries again
 * (E05 fix r1-G1; migrate.mjs, above the lifts). Idempotent: a world already through
 * this holds no such flag.
 *
 * @returns {Promise<null|{notPrimary: true}|{lifted: number, dropped: number, kept: number}>}  `kept` 0:
 *   anything else throws.
 */
export async function liftLootTraces() {
    if (!isPrimaryGm()) return { notPrimary: true };
    if (await lootTraceStore.whenHydrated() === "timedOut") {
        throw new Error("the other GMs' copies of the bodies' loot traces did not arrive; the next load tries again");
    }
    const flag = FLAGS.lootTrace;
    const flagged = () => (game.actors?.contents ?? []).filter(actor => Object.hasOwn(actor.flags?.[MODULE_ID] ?? {}, flag));
    const found = flagged();
    if (!found.length) return null;
    const rows = {};
    for (const actor of found) {
        const record = actor.flags[MODULE_ID][flag];
        if (typeof record?.tokenId !== "string" || !record.tokenId) continue;
        rows[actor.id] = { sceneId: typeof record.sceneId === "string" ? record.sceneId : null, tokenId: record.tokenId,
            taken: Array.isArray(record.taken) ? record.taken.map(String) : [] };
    }
    if (Object.keys(rows).length) {
        await lootTraceStore.patchMany(rows, { weak: true, fillOnly: true });
        await lootTraceStore.idle();
    }
    const deletion = forcedDeletion();
    let lifted = 0, dropped = 0, kept = 0;
    for (const actor of found) {
        if (rows[actor.id]) {
            const row = lootTraceStore.persisted(actor.id);
            if (!row || !Object.hasOwn(row, "tokenId")) {
                kept++;
                continue;
            }
            lifted++;
        } else {
            dropped++;
        }
        if (deletion) await actor.update({ [`flags.${MODULE_ID}.${flag}`]: deletion });
        else await actor.unsetFlag(MODULE_ID, flag);
    }
    const left = flagged().length;
    if (lifted || dropped) {
        log(`Took ${lifted + dropped} body loot record(s) out of world data (${lifted} held by the GM store, ${dropped} naming no trace); ${left} left.`);
    }
    if (left) {
        throw new Error(`${left} bod(ies) still name their loot trace in a flag (${kept} whose row the GM store did not read back); the next load tries again`);
    }
    return { lifted, dropped, kept };
}

/**
 * The Truth Bullet the taker walks away with.
 *
 * `neutral` and NOT analysed on purpose. The name already says what was taken
 * and off whom - that is the fact, and it is free. Whether the thing bears on
 * the murder is the question, and questions cost an Analyze in this game.
 *
 * `tiedToCrime` mirrors what Search already does with crime gear: true when the
 * thing can do a killer's work, left undecided otherwise. It is the GM-side
 * answer key, published on analysis, so a cereal bar off a body does not arrive
 * pre-labelled as meaningless either.
 */
async function mintLootBullet(taker, body, loot) {
    try {
        const { createTruthBullet } = await import("./truth-bullets.mjs");

        /*
         * WHAT ANALYSING THE TRACE WILL SAY, off the trace's own `public` record.
         *
         * The loot's trace is the bookmark on the body - a scene id and a token id
         * - not a ledger entry, so it has no reading of its own. The second
         * looter's trace already exists, a GM may have written its lab reading
         * hours ago, and it is usually already revealed - so the `revealSourceOf`
         * at the end of `createTruthBullet` returns before it reconciles this
         * copy. Without this the copy would be the one bullet in the game whose
         * analysis said nothing, however much the GM had written.
         */
        const { remnantPublicById, revealRemnantToFinderById } = await import("./remnants.mjs");
        const analyzedText = remnantPublicById(loot.sceneId, loot.tokenId)?.analyzedText ?? "";

        /*
         * THE TRACE IS REVEALED BEFORE THE BULLET IS MADE (E05 fix r2-F0b, 27.09.2026).
         * A body's first loot finds its trace hidden, and `createTruthBullet` reveals a
         * hidden trace at its end - which puts the trace's `public` record onto every
         * copy of it, this one included: the neutral word and no words, for a trace no
         * GM has described. Measured on e47a5d5: the first loot's bullet read "Trace" on
         * the GM (tier 2) and on p1 (72-canary), and said nothing of what was taken or off
         * whom; only a later loot's kept its words. Revealed here first, this one says what
         * the loot says, as every later one does - once the death is the table's (`lootBody`);
         * since E09 fix r2-G1 a reveal writes on no copy at all. The owners'
         * copy of the trace comes a moment after the reveal and redraws their map when it
         * arrives (visibility.mjs, on `drpgBulletRefsChanged`); the drawing needs a canvas,
         * which the harness has not, so that order is read in the code, not seen.
         */
        if (loot.sceneId && loot.tokenId) await revealRemnantToFinderById(loot.sceneId, loot.tokenId);

        await createTruthBullet(taker, {
            name: game.i18n.format("DRPG.Loot.bulletName", { item: loot.item }),
            realType: "neutral",
            visibility: "evident",
            playerText: game.i18n.format("DRPG.Loot.bulletText", {
                item: loot.item, who: body.name
            }),
            img: loot.img,
            sourceAction: "loot",
            tiedToCrime: loot.tied ? true : null,
            remnantId: loot.tokenId ?? null,
            sceneId: loot.sceneId ?? null,
            room: loot.room ?? null,
            stamp: { chapter: loot.chapter, day: loot.day, timeOfDay: loot.timeOfDay },
            analyzedText
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

    /*
     * THE ITEM AS THE GMS HOLD IT (E29 fix r2-H17, 06.10.2026). Everything below, down to the copy `grantItem` makes,
     * reads `held`: the item once every write queued on the giver has been judged, with the fields the sheet audit
     * judges - its place, category, tier, roles, kind, broken and wear among them - as its mark holds them
     * (sheet-audit.mjs `itemsAsHeld`, which says why the wait is enough here). Read once, with no await between the
     * read and the grant: roles, a tier or a mend a player's console wrote a moment before asking stay off the copy,
     * which a GM makes and every client takes as the GMs'. The deletion is the document's.
     *
     * AND THE RECEIVER'S HANDS AS THE GMS HOLD THEM (E29 fix r2-H18, 06.10.2026): `counted`, the receiver's items
     * as the mark holds them (sheet-audit.mjs `actorAsHeld`), is what the room below and `grantItem`'s cap count, so
     * a slot the receiver's console emptied a moment before - a stash its put-back undoes - is no room. One wait
     * for both students, then both reads, each of which finds its queue empty and so waits on nothing; the copy
     * roads of vault.mjs and `lootBody` read their receiver the same way. At 0c75739 (e29run/r2h18red, 06.10.2026) a
     * receiver whose slots for a Tool the mark held full, one of them stashed where the mark did not see it, took a
     * carried copy on a hand-over, a plant and both thefts; and in scenario 30 a theft from a stash p1 asked for at once
     * after stashing one of Aiko's two Tools left her carrying three on every client once the stash was put back.
     */
    const { itemAsHeld, actorAsHeld, judgedFor, creationRefusal } = await import("./sheet-audit.mjs");
    await judgedFor(from.id, to.id);
    const held = await itemAsHeld(from, item.id);
    const counted = await actorAsHeld(to);
    if (!held) return null;

    // An item a player made on the giver's sheet that no GM has decided on yet changes no hands (E29 fix r2-H21,
    // sheet-audit.mjs `creationRefusal`): asked before the stash, the bullet and the key, each of which would copy it,
    // and the giver told.
    const undecided = creationRefusal(from, held.id);
    if (undecided) {
        warn(`Handover refused: ${undecided}.`);
        return { refused: undecided };
    }

    // Something in a stash is not in a hand, and only a hand can give (ITEM-06).
    // The sheet hides the button on a stash row; the API and a hand-built
    // packet did not. Asked FIRST (E03; audit S08-33): below it sat after the
    // key branch, so a key lying in a stash across the map could still be
    // copied to anybody standing next to its owner.
    if (isStashed(held)) {
        await whisperToOwner(from, `<p>${game.i18n.format("DRPG.Handover.stashed", {
            name: foundry.utils.escapeHTML(held.name)
        })}</p>`);
        return null;
    }

    // Truth Bullets are copied, never moved - see `shareBullet`.
    if (isTruthBullet(held)) return shareBullet({ fromId, toId, itemId });

    // So are keys, for the same reason in a different shape: handing somebody
    // the key to your room should not take you out of it. The copy carries the
    // room flag, which is the only thing that makes a key a key.
    if (held.getFlag(MODULE_ID, BEDROOM_KEY_FLAG)) return shareKey({ from, to, item: held });

    const category = held.getFlag(MODULE_ID, "category");
    if (!category) {
        warn(`Handover refused: "${held.name}" is not an item this module tracks.`);
        return null;
    }

    const room = canCarry(counted, category);
    if (!room.ok) {
        await whisperToOwner(from, `<p>${game.i18n.format("DRPG.Handover.theirHandsFull", {
            who: foundry.utils.escapeHTML(to.name),
            category: foundry.utils.escapeHTML(capacityLabel(category)),
            limit: room.limit
        })}</p>`);
        return null;
    }

    const name = held.name;
    const copy = await grantItem(to, {
        reason: "gmRuling",
        name,
        category,
        tier: held.getFlag(MODULE_ID, "tier") ?? null,
        description: held.system?.description ?? "",
        img: held.img,
        // A ruined thing stays ruined on the other side of the table. Without
        // this, handing the murder weapon to an accomplice repaired it.
        extraFlags: preservedFlags(held),
        counted
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
