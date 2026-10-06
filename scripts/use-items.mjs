/**
 * Danganronpa RPG - using an item, and holding one ready.
 * ---------------------------------------------------------------------------
 * Guide: "Przedmioty zużywalne mogą odnawiać hp, stress lub hope. Przedmioty
 * narzędzia zbrodni ułatwiają incydent morderstwa. Przedmioty sprzątające
 * ułatwiają rozwiązanie morderstwa."
 *
 * Until now the module could only put items INTO an inventory. A Tier 2 first
 * aid kit sat on the sheet for the whole season with no way to open it, and the
 * incident engine picked a weapon by guessing the highest tier the killer
 * happened to own. Two verbs close both gaps:
 *
 *   USE      a Usable Item, spent on the spot. What it restores comes from
 *            USABLE_EFFECTS plus the item's KIND: every usable is a healing
 *            item (Health) or a stress-relief item (Sanity), decided by which item
 *            table it came from - see `usableKindOf`. Tiers 1 and 2 apply
 *            that kind's resource without asking; tier 3 is the one tier that
 *            still offers the Health-or-Sanity choice, with 2 Hope on top either
 *            way; tier 0 is "open to creative use" and has no table entry, so
 *            it goes to the GM as a ruling.
 *
 *   EQUIP    a Crime Tool or a Cleaning Tool, held ready. One per category -
 *            you have two hands and the fiction only ever cares which single
 *            object you are swinging. `murder.mjs` reads this before it falls
 *            back to "the best one you own".
 *
 * Neither costs an action. The guide charges actions for finding, making and
 * hiding things; drinking what you already found is not one of the ten.
 */

import { MODULE_ID, USABLE_EFFECTS, USABLE_KINDS, EQUIPPABLE, STARTING, BROKEN_ITEMS,
    ITEM_CATEGORIES, LIMIT_GROUPS }
    from "./config.mjs";
import { usableKindFor } from "./tables.mjs";
import { ITEM_FLAGS, isStashed, isBroken, breakItem, wearItem, durabilityOf, servesAs }
    from "./inventory.mjs";
import { resourceValue, resourceMax } from "./character.mjs";
// Only to answer "is there a murder to be tidying up after" - see
// `discardRemnantType`. `murder.mjs` imports this file back, so it is reached
// dynamically inside the function; `settings.mjs` does not and can be static.
import { bodyDiscovery } from "./settings.mjs";
import { trustedWrite, trustedDelete } from "./resource-guard.mjs";
import { overflowBlocksHope } from "./overflow.mjs";
import { dialogContent, whisperToOwner, resolveThreshold, log, error } from "./utils.mjs";

const DialogV2 = foundry.applications.api.DialogV2;

/** Flag marking the one item of its category the character is holding ready. */
export const EQUIPPED_FLAG = "equipped";

/* ==========================================================================
 * EQUIPPING
 * ========================================================================== */

/** Can this item be held ready at all? */
export function isEquippable(item) {
    return EQUIPPABLE.includes(item?.getFlag(MODULE_ID, ITEM_FLAGS.category));
}

export function isEquipped(item) {
    return Boolean(item?.getFlag(MODULE_ID, EQUIPPED_FLAG));
}

/**
 * The item this character is holding ready in one category, if any.
 *
 * Broken is excluded here rather than only at the point of equipping, and that
 * is the important half: this is what the incident engine asks for its weapon
 * and what Stage 6 asks for its gloves. `breakItem` already clears the readied
 * flag, so this is the belt to that braces - a tool broken by any other route
 * (a GM's hand-edit, a world restored from an older save) still cannot be
 * swung.
 */
export function equippedIn(actor, category) {
    return actor?.items?.find(i =>
        i.getFlag(MODULE_ID, ITEM_FLAGS.category) === category
        && i.getFlag(MODULE_ID, EQUIPPED_FLAG)
        && !isBroken(i)
        && !isStashed(i)) ?? null;
}

/**
 * What this character is holding ready that can do the job of `role`.
 *
 * The capability question, where `equippedIn` is the slot question. An item's
 * category is its HOME - which slot it takes, which row it sits in, which table
 * it came from - and `servesAs` is what it can actually do. A screwdriver filed
 * under Tools answers `equippedFor(actor, "crimeTool")` because it can be swung;
 * `equippedIn(actor, "crimeTool")` still says no, and `toggleEquipped` needs it
 * to, or readying the screwdriver would put the knife away.
 *
 * THE SPECIALIST WINS. Both can be readied at once - one per home, and the
 * homes are different - so this has to choose. It prefers the item whose home
 * IS the role: the knife is a better weapon than the screwdriver, and the
 * screwdriver wears out before the knife does when the roll goes badly. A rule
 * that is easy to say out loud at the table beats one that depends on which
 * item was picked up first.
 *
 * Broken and stashed are excluded here, for the same reason `equippedIn` does
 * it: this is what the incident asks for its weapon and what Stage 6 asks for
 * its gloves.
 */
/**
 * How good a thing is, as a number, or 0 when nothing says.
 *
 * Returns 0 rather than null on purpose: every caller feeds it to arithmetic,
 * and a null reaching a subtraction is a NaN threshold that lets everything
 * through. `cleaningTier` in cleanup.mjs makes the same choice.
 */
export function tierOf(item) {
    return Number(item?.getFlag(MODULE_ID, ITEM_FLAGS.tier) ?? 0);
}

/**
 * Everything in a limit group that is NOT in a hand.
 *
 * The question the shape rule asks. Counted off the same two facts every other
 * reader uses - the item's home category and its readied flag - so a world
 * halfway through any migration answers the same way this does.
 */
export function stowedInGroup(actor, group) {
    return (actor?.items ?? []).filter(i => {
        const category = i.getFlag(MODULE_ID, ITEM_FLAGS.category);
        if (ITEM_CATEGORIES[category]?.limitGroup !== group) return false;
        if (isStashed(i)) return false;
        return !i.getFlag(MODULE_ID, EQUIPPED_FLAG);
    });
}

/**
 * May this item be put away, or is it the only thing keeping the shape legal?
 *
 * @returns {{ok: boolean, stowed: number, max: number|null}}
 */
export function mayStow(actor, item) {
    const category = item?.getFlag(MODULE_ID, ITEM_FLAGS.category);
    const group = ITEM_CATEGORIES[category]?.limitGroup ?? null;
    const max = group ? LIMIT_GROUPS[group]?.maxStowed ?? null : null;
    if (max === null) return { ok: true, stowed: 0, max: null };

    // The item itself is in the hand right now, so it is not in the count yet.
    const stowed = stowedInGroup(actor, group).filter(i => i.id !== item.id).length;
    return { ok: stowed < max, stowed, max };
}

export function equippedFor(actor, role) {
    // At most one, since E9 - but read as a list anyway. A world mid-upgrade
    // can still have several readied from the per-category rule, and the
    // preference below is what decides between them until the next time
    // anybody picks something up: the item whose HOME is the role wins, so a
    // knife beats a screwdriver at being a weapon.
    const ready = readiedItems(actor).filter(i => servesAs(i, role));
    if (!ready.length) return null;

    return ready.find(i => i.getFlag(MODULE_ID, ITEM_FLAGS.category) === role) ?? ready[0];
}

/** Everything this character is holding ready and could actually use. */
export function readiedItems(actor) {
    return actor?.items?.filter(i =>
        i.getFlag(MODULE_ID, EQUIPPED_FLAG)
        && !isBroken(i)
        && !isStashed(i)) ?? [];
}

/** The one thing in their hands, whatever it is. */
export function readiedItem(actor) {
    return readiedItems(actor)[0] ?? null;
}

/**
 * Despair breaks whatever was in your hands.
 *
 * The guide has no durability rule, so this is the module's, and it is decided
 * by the SIDE OF THE ROLL rather than by a threshold of its own:
 *
 *     critical              whole
 *     success with Hope     whole
 *     success with Despair  BREAKS
 *     failure with Hope     whole
 *     failure with Despair  BREAKS
 *
 * One sentence to remember: Despair breaks the tool, whether or not the action
 * worked. That is consistent with everything else Despair does in this system -
 * it exposes a sabotage, it spoils a cleanup, it costs Sanity - and it is the
 * reason the rejected alternative ("total under 12 breaks it") is not here: that
 * would break the tool exactly when it had already achieved nothing, which is
 * two punishments for one bad roll and leaves Despair meaning nothing at all.
 *
 * THE TOOL IS PASSED IN, NOT LOOKED UP (trap 62). Reading `equippedFor` after
 * the roll can return something else or nothing at all - the roll's own
 * consequences move items around, and an unarmed attack that succeeds hands the
 * killer an improvised weapon. Capturing the reference before the dice means a
 * tool created by this roll cannot be broken by it (trap 63), which is the
 * difference between a rule and a joke.
 *
 * @param {Actor}     actor
 * @param {Item|null} tool  Captured BEFORE the roll.
 * @param {object}    roll  What `rollTrait` returned.
 * @param {object}    [held]  The tool as the GMs hold it, where a GM's road read it so (the
 *   crisis's swing, murder.mjs `wearSwing`; E29 fix r2-H18): whether it is broken and how much
 *   it can take are read off it, and the wear is written to `tool` (inventory.mjs `wearItem`).
 * @returns {Promise<string|null>} the name of what broke, or null.
 */
export async function breakOnDespair(actor, tool, roll, held = tool) {
    if (!tool || !roll) return null;
    if (!roll.withFear || roll.isCritical) return null;
    if (isBroken(held)) return null;

    let outcome = null;
    try {
        /*
         * WEAR, NOT DEATH (Dawid, 28.08). A Despair costs the tool one point of
         * its durability; only the point that fills it breaks the thing. A tier
         * 0 or 1 item has one point, so for half the table nothing has changed
         * and the first bad roll still ends it.
         *
         * `wearItem` breaks it ITSELF on the filling point rather than telling
         * us to, which is what keeps the break on the roll that caused it: the
         * hand is emptied here, not by something sweeping up after the incident.
         */
        outcome = await wearItem(tool, { reason: "itemWear", ref: tool.id, held });
        if (!outcome) return null;
    } catch (err) {
        // A tool that failed to wear is a great deal better than an action
        // that failed to resolve.
        error("Could not wear the tool the roll ruined", err);
        return null;
    }

    if (!outcome.broke) {
        try {
            await whisperToOwner(actor, `<p>${game.i18n.format("DRPG.Items.woreOnDespair", {
                item: foundry.utils.escapeHTML(tool.name),
                left: outcome.left, total: durabilityOf(held)
            })}</p>`, { flags: { [MODULE_ID]: { sfx: "toolBroke" } } });
        } catch {
            // The wear is recorded; the sentence about it is a courtesy.
        }
        // Not the name of something that broke, because nothing did. The
        // callers print this, and "Hammer" in a break line would be a lie.
        return null;
    }

    try {
        // On the card rather than through `playSfx`, because this function has
        // no idea whose client it is on: it is called from the action rolls
        // (the player's), from Stage 6 (the player's) and from the incident
        // resolver (the GM's). The flag follows the card to the owner in all
        // three, which is the one audience that is right in all three.
        await whisperToOwner(actor, `<p>${game.i18n.format("DRPG.Items.brokeOnDespair", {
            item: foundry.utils.escapeHTML(tool.name)
        })}</p>`, { flags: { [MODULE_ID]: { sfx: "toolBroke" } } });
    } catch {
        // The item is broken either way; the card is the courtesy.
    }
    return tool.name;
}

/**
 * Hold this one ready, putting away whatever was.
 *
 * ONE THING IN YOUR HANDS, WHATEVER IT IS (Dawid, 27.08). This used to be one
 * per category, so a character could hold a knife, a rag and a screwdriver at
 * the same time - which was invisible while the sheet drew three separate rows
 * and absurd the moment they became one. Three items marked "ready" in a list
 * of three reads as a limit that does nothing.
 *
 * It is also what makes the tags matter. With one hand, an item that fills two
 * roles lets you hold one thing and do two jobs, and that is a real decision
 * rather than a curiosity - which is why the two-tag rule and this rule arrived
 * together.
 *
 * Enforced by clearing whatever was, rather than by refusing: "equip" means
 * "this is the one I am using now", and making the player un-equip first would
 * be a second click for no decision.
 */
export async function toggleEquipped(actor, item) {
    if (!actor || !item || !isEquippable(item)) return false;

    if (isStashed(item)) {
        ui.notifications.warn(game.i18n.localize("DRPG.Items.equipStashed"));
        return false;
    }

    if (isBroken(item)) {
        ui.notifications.warn(game.i18n.format("DRPG.Items.brokenUseless", {
            item: item.name
        }));
        return false;
    }

    const wasEquipped = isEquipped(item);

    // ONE IN A HAND, ONE STOWED, NEVER TWO STOWED. Putting this one away is the
    // only move that can break the shape: readying already clears the others.
    if (wasEquipped) {
        const shape = mayStow(actor, item);
        if (!shape.ok) {
            ui.notifications.warn(game.i18n.format("DRPG.Items.stowShape", {
                item: item.name,
                group: LIMIT_GROUPS.gear.label
            }));
            return false;
        }
    }

    try {
        if (!wasEquipped) {
            // Everything else goes down, not just the others of its kind. A
            // list rather than one item: a world that has been through the
            // per-category rule can have three things readied already, and the
            // first hand that picks something up has to tidy all of them.
            for (const previous of readiedItems(actor)) {
                if (previous.id === item.id) continue;
                await previous.setFlag(MODULE_ID, EQUIPPED_FLAG, false);
            }
        }
        await item.setFlag(MODULE_ID, EQUIPPED_FLAG, !wasEquipped);
    } catch (err) {
        error("Could not change what is held ready", err);
        return false;
    }

    log(`${actor.name} ${wasEquipped ? "put away" : "readied"} "${item.name}".`);
    return !wasEquipped;
}

/* ==========================================================================
 * USING
 * ========================================================================== */

/** Is this something that can be drunk, eaten or applied? */
export function isUsable(item) {
    return item?.getFlag(MODULE_ID, ITEM_FLAGS.category) === "usable";
}

/**
 * Which kind of usable this item is: "healing", "stress", or null when the
 * module honestly does not know.
 *
 * THE KIND IT WAS MADE AS (E29 fix r2-H8, 06.10.2026; review round 2 sec m4 =
 * cor m2). The flag the item was made with answers first - the kind of the table
 * its Search drew it from, or the one the item tables gave its name when it was
 * handed over (inventory.mjs `grantItem`) - and only a GM changes it (the GMs'
 * audit puts a player's write of it back, sheet-audit.mjs `ITEM_FIXED`). The
 * tables answer for an item made with none. Until this fix the tables were asked
 * first, so that a GM moving "Pills" from Sanity Relief to Healing changed every
 * jar already found; but the name is the player's to write, and a module item
 * renamed after a usable of the other kind healed that kind, and the audit
 * judged the use by the same reading (`itemCovers`): measured at 0d86603
 * (06.10.2026, e29run/r2h8red) by tier 2 - a healing usable renamed "Chewing
 * gum" read as Sanity Relief, and its use on Sanity stood; since, it reads as
 * healing and the use is flagged. A GM's edit of the tables now reaches the items
 * made after it, as the GM's handbook already said ("the kind comes from the
 * table it was drawn from").
 */
export function usableKindOf(item) {
    if (!item) return null;

    const flagged = item.getFlag(MODULE_ID, ITEM_FLAGS.kind);
    if (USABLE_KINDS[flagged]) return flagged;

    const assigned = usableKindFor(item.name);
    return USABLE_KINDS[assigned] ? assigned : null;
}

/**
 * Use a Usable Item.
 *
 * Consumed when actually used - the guide's usable items are one-shot, and an
 * item that restores nothing because the character was already whole is still
 * an item that has been opened. Cancelling either dialog spends nothing. The
 * dialogs used to say "the item is used up either way", which read as though
 * cancelling destroyed it too; the line is gone (Dawid, 2026-08-26).
 *
 * @returns {Promise<object|null>} what was restored, or null if it did not happen.
 */
/**
 * What the GM needs on a "somebody used this" card to recognise a trap.
 *
 * THE FLAG IS ON THE CARD, NOT ON THE ITEM, and that is the whole shape of
 * E21's fifth trigger. The card is already going to the GMs; this reads the
 * identity off the item as it is spent and puts it where a GM-side listener can
 * see it. A player can read this flag on their own card, and it tells them
 * nothing they could not already read off the item - every item in the game
 * carries an identity, and only the GM's own ledger knows which are poisoned.
 *
 * The name travels with it purely so the alert can say what was used; the
 * decision is made on the id.
 */
function usedStamp(actor, item) {
    const id = item?.getFlag(MODULE_ID, ITEM_FLAGS.identity);
    if (!id) return {};
    return {
        flags: {
            [MODULE_ID]: {
                usedItem: { id, name: item?.name ?? "", actorId: actor?.id ?? null }
            }
        }
    };
}

/*
 * `again` (E08+E28 C6b, 03.10.2026; audit S04-18): `{ resource }`, a use a Reroll's replay makes
 * again on a GM after its rewind gave the item and the heal back (murder.mjs `afterCrisisRoll`).
 * Its questions were asked at the first use, so it asks none: the reserve is the one the first
 * use restored (`resource`, where this item can restore it, else the first it offers). Its Hope
 * bonus is paid as a fresh use's is: the rewind takes the first use's back (murder.mjs
 * `undoLastCrisis`, fix r1-G6; the round-1 review's m5 - C6b paid none and took none back, so a
 * tier 3 rerolled into a miss kept 2 Hope for a use that no longer happened). No card and no
 * stamp: the first use's card stands, and a trap that watches for the item heard it then
 * (traps.mjs `onChatMessage`). A creative use is the GM's ruling, not asked again of the die:
 * it counts as used and restores nothing.
 *
 * `held` (E29 fix r2-H20, 06.10.2026; as H19's ruling) is the item as the GMs hold it, where a
 * GM's road read it so - the replay's use (murder.mjs `afterCrisisRoll`, from `applyCrisisAction`'s
 * `held`): whether it is a usable, broken or stashed, its tier and its kind are read off it, and
 * its count by `consume`; the writes go to `item`, the document. Until this fix (4d1532c,
 * e29run/r2h20red, 06.10.2026) the replay of a Tier 1 healing pack given tier 3 where the GMs'
 * mark did not see it healed 2 Health marks, not 1.
 */
export async function useItem(actor, item, { again = null, held = item } = {}) {
    if (!actor || !isUsable(held)) return null;

    // An opened kit is an empty box. It is still in the bag, and it still takes
    // up the slot - see `consume` below and BROKEN_ITEMS in config.mjs.
    if (isBroken(held)) {
        ui.notifications.warn(game.i18n.format("DRPG.Items.brokenUseless", {
            item: item.name
        }));
        return null;
    }

    if (isStashed(held)) {
        ui.notifications.warn(game.i18n.localize("DRPG.Items.useStashed"));
        return null;
    }

    const tier = tierOf(held);
    const effect = USABLE_EFFECTS[tier];

    // Tier 0 is "a random, seemingly useless object, open to creative use" -
    // there is no table row to apply, so a human decides what it is worth.
    if (!effect || effect.creative) return again ? {} : useCreatively(actor, item);

    // What lands where. Tier 3 asks Health-or-Sanity and adds its Hope on top;
    // tiers 1 and 2 read the item's kind and ask nothing - the only time the
    // dialog still appears there is when the kind is unknown (an item in no
    // table, with no flag), because guessing which half of somebody's sheet to
    // heal is worse than asking.
    let asked = false;
    let amounts;

    const sameAgain = choose => choose.includes(again.resource) ? again.resource : choose[0];
    if (effect.choose) {
        const choice = again ? sameAgain(effect.choose) : await askWhichResource(item, effect);
        if (!choice) return null;
        asked = true;
        amounts = { [choice]: effect.amount, ...(effect.bonus ?? {}) };
    } else {
        const kind = usableKindOf(held);
        const resource = USABLE_KINDS[kind]?.resource;
        if (resource) {
            amounts = { [resource]: effect.amount };
        } else {
            const choice = again ? sameAgain(["hitPoints", "stress"]) : await askWhichResource(item, {
                ...effect, choose: ["hitPoints", "stress"]
            });
            if (!choice) return null;
            asked = true;
            amounts = { [choice]: effect.amount };
        }
    }

    // Ask before destroying it.
    //
    // Whatever went through the which-resource dialog has had its confirmation.
    // Everything else - which is now the common case, a tier 1 or 2 item whose
    // kind the tables already decided - used to be spent by a single click on a
    // small icon, with no way back, so it gets the confirm instead.
    //
    // Either way, an item that would restore NOTHING gets stopped: drinking a
    // first aid kit at full health is a mistake the sheet can see coming, and
    // silently eating it is the least helpful thing this could do.
    const preview = wouldRestore(actor, amounts);
    const pointless = !Object.keys(preview).length;

    if (!again && (pointless || !asked)) {
        const go = await confirmUse(item, preview, pointless);
        if (!go) return null;
    }

    // Read BEFORE `consume`, which may clear the flags along with the item.
    const stamp = usedStamp(actor, item);

    const restored = await restore(actor, amounts, { reason: "itemUse", ref: item.id });
    await consume(item, { reason: "itemUse", held });
    if (again) return restored;

    const summary = describe(restored);
    await whisperToOwner(actor, `
        <p><strong>${game.i18n.format("DRPG.Items.used", {
            item: foundry.utils.escapeHTML(item.name)
        })}</strong></p>
        <p>${summary || game.i18n.localize("DRPG.Items.usedNothing")}</p>`, stamp);

    log(`${actor.name} used "${item.name}" (Tier ${tier}): ${summary || "no effect"}.`);
    return restored;
}

/** Tier 0: the GM says whether the idea works, and what it does. */
async function useCreatively(actor, item) {
    const { promptAndCallGm } = await import("./gm-bridge.mjs");

    // Three answers on the card (ITEM-07): it works and here is what it does,
    // it works and is simply used up, or it does not. The ruling used to be a
    // console call, which meant it was never made.
    const data = { by: actor.id, item: item.id };
    const request = await promptAndCallGm(actor, {
        title: game.i18n.format("DRPG.Items.useTitle", { item: item.name }),
        prompt: game.i18n.format("DRPG.Items.creativePrompt", {
            item: foundry.utils.escapeHTML(item.name)
        }),
        placeholder: game.i18n.localize("DRPG.Items.creativePlaceholder"),
        room: (await import("./movement.mjs")).roomOfActor(actor),
        actions: [
            { action: "itemWorks", label: game.i18n.localize("DRPG.Items.itemWorks"), data },
            { action: "itemNoEffect", label: game.i18n.localize("DRPG.Items.itemNoEffect"), data },
            { action: "itemRefuse", label: game.i18n.localize("DRPG.Items.itemRefuse"), data }
        ]
    });
    if (request === null) return null;

    // Deliberately NOT consumed here. Whether the idea works at all is the
    // GM's ruling, and destroying the object before they have made it would
    // charge the player for an answer they have not been given.
    await whisperToOwner(actor, `<p>${game.i18n.localize("DRPG.Items.creativeSent")}</p>`);
    return { pending: true };
}

/** Which of the two this particular item is being used for. */
async function askWhichResource(item, effect) {
    const rows = effect.choose.map((key, i) => `
        <label class="drpg-choice">
            <input type="radio" name="what" value="${key}"${i === 0 ? " checked" : ""}>
            <i class="fa-solid ${key === "hitPoints" ? "fa-heart" : "fa-brain"}" inert></i>
            <span class="drpg-choice-text">
                <strong>${game.i18n.localize(`DRPG.Items.restore.${key}`)}</strong>
                <small>${game.i18n.format("DRPG.Items.restoreN", { n: effect.amount })}</small>
            </span>
        </label>`).join("");

    const picked = await DialogV2.wait({
        window: { title: game.i18n.format("DRPG.Items.useTitle", { item: item.name }) },
        classes: ["drpg-panel", "drpg-narrow"],
        content: dialogContent(`<form>
            <p>${game.i18n.localize("DRPG.Items.usePrompt")}</p>
            <div class="drpg-choice-list">${rows}</div>
            ${effect.bonus?.hope ? `<p class="notes">${overflowBlocksHope()
                // The one preview a Tier 3 item gets: under the darkening it must
                // not promise the Hope `restore` will skip (review of CALL-05).
                ? game.i18n.localize("DRPG.Overflow.noHopeNow")
                : game.i18n.format("DRPG.Items.choiceBonus", { n: effect.bonus.hope })}</p>` : ""}
        </form>`),
        buttons: [
            {
                action: "ok", label: game.i18n.localize("DRPG.Items.useConfirm"), default: true,
                callback: (e, b, d) =>
                    d.element.querySelector('input[name="what"]:checked')?.value ?? null
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    return (picked && picked !== "cancel") ? picked : null;
}

/**
 * What this WOULD restore, without writing anything.
 *
 * Same arithmetic as `restore` below, which is deliberate: a preview computed
 * differently from the thing it previews is a preview that lies. Kept as a pure
 * function so the confirmation and the write cannot disagree.
 */
function wouldRestore(actor, amounts) {
    const out = {};
    // The same darkening rule `restore` applies, or the preview promises Hope the
    // use will not give and "this would restore nothing" never warns (review of
    // CALL-05).
    const hopeBlocked = overflowBlocksHope();
    for (const [key, amount] of Object.entries(amounts)) {
        if (key === "hope") {
            if (hopeBlocked) continue;
            const max = resourceMax(actor, "hope") || STARTING.hopeMax;
            const gain = Math.min(max, resourceValue(actor, "hope") + amount)
                - resourceValue(actor, "hope");
            if (gain > 0) out.hope = gain;
            continue;
        }
        const marks = resourceValue(actor, key);
        const healed = marks - Math.max(0, marks - amount);
        if (healed > 0) out[key] = healed;
    }
    return out;
}

/** "This will restore X, and the item is gone." */
async function confirmUse(item, preview, pointless) {
    const summary = describe(preview);

    return DialogV2.confirm({
        window: { title: game.i18n.format("DRPG.Items.useTitle", { item: item.name }) },
        classes: ["drpg-panel", "drpg-narrow"],
        content: `<p>${game.i18n.format("DRPG.Items.confirmUse", {
            item: foundry.utils.escapeHTML(item.name)
        })}</p>
        <p${pointless ? ' class="drpg-warning"' : ""}>${
            pointless
                ? game.i18n.localize("DRPG.Items.wouldRestoreNothing")
                : game.i18n.format("DRPG.Items.wouldRestore", { what: summary })
        }</p>`,
        rejectClose: false
    });
}

/**
 * Apply the restore.
 *
 * Health and Sanity are reverse resources - marks count UP toward max - so healing
 * subtracts. Hope is a normal one and adds. Everything is clamped, and what was
 * actually restored is reported rather than what was offered: a character with
 * one mark of Health who drinks a Tier 2 kit recovers one, not two.
 */
async function restore(actor, amounts, { reason, ref }) {
    const update = {};
    const done = {};
    // Under the Despair darkening a Hope write is stripped; reporting it as
    // restored would be the card lying (CALL-05). `wouldRestore` asks the same.
    const hopeBlocked = overflowBlocksHope();

    for (const [key, amount] of Object.entries(amounts)) {
        if (key === "hope") {
            if (hopeBlocked) continue;
            const max = resourceMax(actor, "hope") || STARTING.hopeMax;
            const held = resourceValue(actor, "hope");
            const next = Math.min(max, held + amount);
            if (next !== held) {
                update["system.resources.hope.value"] = next;
                done.hope = next - held;
            }
            continue;
        }

        const marks = resourceValue(actor, key);
        const next = Math.max(0, marks - amount);
        if (next !== marks) {
            update[`system.resources.${key}.value`] = next;
            done[key] = marks - next;
        }
    }

    if (Object.keys(update).length) {
        try {
            await trustedWrite(actor, update, { reason, ref });
        } catch (err) {
            error("Could not apply what the item restored", err);
            return {};
        }
    }
    return done;
}

function describe(restored) {
    const label = key => game.i18n.localize(`DRPG.Items.restore.${key}`);
    return Object.entries(restored ?? {})
        .filter(([, n]) => n > 0)
        .map(([key, n]) => `${n} ${label(key)}`)
        .join(", ");
}

/**
 * A usable item is one-shot: spend a charge, and break when it runs out.
 *
 * `break`, not `delete`. The empty packet is still in the bag and still counts
 * against the two you may carry, so using the last of your kit is a moment that
 * costs you something afterwards as well as at the time - see BROKEN_ITEMS.
 *
 * `held` is the item as the GMs hold it, where a GM's road read it so (E29 fix r2-H19: a
 * ruling, `grantItemEffect`): the count is read off it and written to `item`, the document.
 */
async function consume(item, { reason, held = item }) {
    const quantity = Number(held.system?.quantity ?? 1);
    try {
        if (quantity > 1) await trustedWrite(item, { "system.quantity": quantity - 1 }, { reason, ref: item.id });
        else await breakItem(item, { reason, ref: item.id });
    } catch (err) {
        error("Could not consume the item", err);
    }
}

/* ==========================================================================
 * THROWING A RUINED THING AWAY
 * ========================================================================== */

/**
 * Get rid of a broken item, somewhere, and leave the trace of having done it.
 *
 * The only route out of an inventory for something that has been used up, apart
 * from putting it in your own stash. Free - no action is charged, for the same
 * reason using an item is not: the guide charges actions for finding, making
 * and hiding things, and dropping a broken screwdriver in a bin is none of the
 * three. What it costs is not an action, it is a Remnant.
 *
 * How loud that Remnant is comes off a Shadow roll against the same table the
 * indirect murder's hide-traces roll uses (BROKEN_ITEMS.thresholds). A critical
 * leaves a Hidden trace: got rid of it, and nobody will ever prove where.
 *
 * The item goes for real at the end of this - a thrown-away thing is not in your
 * pockets any more. What is left on the map is the trace, and that is the
 * evidence the trial will be arguing about.
 *
 * @returns {Promise<object|null>} `{ visibility, told }`, or null if nothing happened.
 */
/**
 * Which kind of trace throwing a broken thing away leaves.
 *
 * "Zazwyczaj robi się to po morderstwie" - and when it is after, the trace is a
 * Tamper one: getting rid of the weapon is the same act as wiping the handle,
 * and the type exists to say so at the trial. Before any of that it is still
 * preparation, and a snapped lockpick has nothing to do with a murder that has
 * not happened.
 *
 * WHERE THE LINE IS, and why it is these two facts and not the clock's phase.
 * "After the murder" is not one moment: the killer's disposal happens during
 * Stage 6, BEFORE anybody has found the body, and that is the most Tamper-ish
 * discard there is - so waiting for the discovery would misfile exactly the
 * case this is for. And once a body HAS been found the case is open for
 * everybody, whoever is throwing what away. Either fact is enough; the clock's
 * phase is neither, because Daily Life continues after a body is found.
 *
 * Both reads are wrapped: a world mid-migration, or a client that has not been
 * told the murder state yet, must leave a trace rather than throw.
 *
 * Async because `murder.mjs` imports this file back, so it is reached through a
 * dynamic import rather than at the top - the same road `discardBroken` already
 * takes to `action-rolls` and `remnants`. It costs a microtask on a click.
 */
export async function discardRemnantType() {
    try {
        const { murderState } = await import("./murder.mjs");
        if (murderState()?.active) return BROKEN_ITEMS.remnantTypeAfter;
    } catch { /* no incident readable: fall through to the body */ }
    try {
        if (bodyDiscovery()) return BROKEN_ITEMS.remnantTypeAfter;
    } catch { /* nor a discovery: it is preparation as far as anyone can tell */ }
    return BROKEN_ITEMS.remnantTypeBefore;
}

export async function discardBroken(actor, item) {
    if (!actor || !item) return null;

    if (!isBroken(item)) {
        ui.notifications.warn(game.i18n.localize("DRPG.Items.discardOnlyBroken"));
        return null;
    }
    // From your hands. A thing in the stash is already put away, and throwing it
    // out of a drawer you are not standing at is not a move anybody can make.
    if (isStashed(item)) {
        ui.notifications.warn(game.i18n.localize("DRPG.Items.discardStashed"));
        return null;
    }

    const go = await DialogV2.confirm({
        window: { title: game.i18n.format("DRPG.Items.discardTitle", { item: item.name }) },
        classes: ["drpg-panel", "drpg-narrow"],
        content: `<p>${game.i18n.format("DRPG.Items.discardPrompt", {
            item: foundry.utils.escapeHTML(item.name)
        })}</p>
        <p class="notes">${game.i18n.localize("DRPG.Items.discardNote")}</p>`,
        rejectClose: false
    });
    if (!go) return null;

    // Kept before the roll: everything below reports on an object that is about
    // to stop existing, and reading a name off a deleted document is undefined.
    const name = item.name;

    const { rollTrait } = await import("./action-rolls.mjs");
    const roll = await rollTrait(actor, BROKEN_ITEMS.trait, {
        remember: false,
        title: game.i18n.format("DRPG.Items.discardTitle", { item: name })
    });
    // A cancelled roll is a cancelled decision. The item stays; the player has
    // spent nothing and thrown nothing away.
    if (!roll) return null;

    const hit = roll.isCritical
        ? BROKEN_ITEMS.critical
        : resolveThreshold(roll.total, BROKEN_ITEMS.thresholds);
    const visibility = hit?.remnant ?? "obvious";

    const { dropRemnant, traceFeedback } = await import("./remnants.mjs");
    const { roomOfActor } = await import("./movement.mjs");
    const placed = await dropRemnant(actor, {
        type: await discardRemnantType(),
        visibility,
        faint: BROKEN_ITEMS.faint,
        action: "discard",
        subject: name,
        note: game.i18n.format("DRPG.Remnant.discardNote", {
            actor: actor.name,
            item: name,
            room: roomOfActor(actor) ?? "?",
            total: roll.total
        })
    });

    // NO TRACE, NO DISPOSAL.
    //
    // `dropRemnant` returns nothing when the act did not happen: the character
    // has no token on any scene, so there is nowhere for the thing to have been
    // left, or the trace was not placed - no GM connected, or a GM's client that
    // refused it, did not answer or failed (E31). Each road has said why, once,
    // by the time it returns.
    //
    // Deleting the item anyway would be the one outcome this whole feature
    // exists to prevent - the murder weapon ceasing to exist, for free, with
    // nothing left behind. So it stays in the bag. "There was nowhere to leave
    // it" is added only where that is the reason; after the bridge's own
    // message it would contradict it, so the whisper says only that the item is
    // kept (E31 review).
    if (!placed) {
        const { tokenFor } = await import("./remnants.mjs");
        await whisperToOwner(actor, `<p class="drpg-warning">${
            game.i18n.format(tokenFor(actor) ? "DRPG.Items.discardKept" : "DRPG.Items.discardNoTrace", {
                item: foundry.utils.escapeHTML(name)
            })}</p>`);
        return null;
    }

    try {
        await trustedDelete(item, { reason: "discard" });
    } catch (err) {
        error("Could not remove the discarded item", err);
    }

    // Whether they are told they left something is the module's one uniform
    // rule for every action that leaves a trace - Hope and criticals show it,
    // a plain Despair does not. See `traceFeedback`.
    const told = traceFeedback(roll, placed);
    await whisperToOwner(actor, `
        <p><strong>${game.i18n.format("DRPG.Items.discarded", {
            item: foundry.utils.escapeHTML(name)
        })}</strong></p>
        ${told ? `<p><em>${game.i18n.localize("DRPG.Items.discardTrace")}</em></p>` : ""}`);

    log(`${actor.name} threw away "${name}" (${visibility} trace).`);
    return { visibility, told };
}

/* ==========================================================================
 * GM-SIDE
 * ========================================================================== */

/**
 * Finish a Tier 0 "creative use" the GM has agreed to.
 *
 * Exposed on `game.drpg` so the ruling is one call rather than a hand-edit:
 * `game.drpg.grantItemEffect(actor, item, { hitPoints: 1 })`.
 */
export async function grantItemEffect(actor, item, amounts = {}, { consumeItem = true } = {}) {
    if (!game.user.isGM || !actor) return null;

    /*
     * AS THE GMS HOLD IT (E29 fix r2-H19, 06.10.2026). The identity the card is stamped with - a trap watching it
     * reads the card (traps.mjs) - and the count the consumption spends are read off the item as the GMs hold it
     * (sheet-audit.mjs `itemAsHeld`), each just before its use: until this fix both were read off the item as it
     * stood, where a write of the player's the audit puts back stands until its put-back lands, or for good where it
     * fails: at 68150ec (e29run/r2h19red) a ruling on a usable the GMs hold one of spent one of the two written there,
     * so did not break it, and stamped its card with the identity written there. An item not on `actor` is read as it
     * stands, as before. The wait holds up nothing that holds it up, by reading: an item used waits for its own
     * user's consumption, and a ruling's is the GM's.
     */
    const { itemAsHeld } = await import("./sheet-audit.mjs");
    const heldNow = async () => item ? await itemAsHeld(actor, item.id) ?? item : null;
    const stamp = usedStamp(actor, await heldNow());

    const restored = await restore(actor, amounts, { reason: "gmRuling", ref: item?.id ?? null });
    if (item && consumeItem) await consume(item, { reason: "gmRuling", held: await heldNow() });

    const summary = describe(restored);
    await whisperToOwner(actor, `<p>${game.i18n.format("DRPG.Items.used", {
        item: foundry.utils.escapeHTML(item?.name ?? "?")
    })} - ${summary || game.i18n.localize("DRPG.Items.usedNothing")}</p>`, stamp);

    return restored;
}
