/**
 * Danganronpa RPG — using an item, and holding one ready.
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
 *            USABLE_EFFECTS, which is TIER_EFFECTS in an appliable shape. The
 *            guide writes tiers 1 and 2 as "N HP **or** N Stress", so those ask
 *            which; tier 3 gives all three at once; tier 0 is "open to creative
 *            use" and has no table entry, so it goes to the GM as a ruling.
 *
 *   EQUIP    a Crime Tool or a Cleaning Tool, held ready. One per category —
 *            you have two hands and the fiction only ever cares which single
 *            object you are swinging. `murder.mjs` reads this before it falls
 *            back to "the best one you own".
 *
 * Neither costs an action. The guide charges actions for finding, making and
 * hiding things; drinking what you already found is not one of the ten.
 */

import { MODULE_ID, USABLE_EFFECTS, EQUIPPABLE, STARTING } from "./config.mjs";
import { ITEM_FLAGS, isStashed } from "./inventory.mjs";
import { resourceValue, resourceMax } from "./character.mjs";
import { automatedUpdate } from "./resource-guard.mjs";
import { dialogContent, whisperToOwner, log, error } from "./utils.mjs";

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

/** The item this character is holding ready in one category, if any. */
export function equippedIn(actor, category) {
    return actor?.items?.find(i =>
        i.getFlag(MODULE_ID, ITEM_FLAGS.category) === category
        && i.getFlag(MODULE_ID, EQUIPPED_FLAG)
        && !isStashed(i)) ?? null;
}

/**
 * Hold this one ready, putting away whatever was.
 *
 * One per category, enforced by clearing the others rather than by refusing:
 * "equip" means "this is the one I am using now", and making the player
 * un-equip first would be a second click for no decision.
 */
export async function toggleEquipped(actor, item) {
    if (!actor || !item || !isEquippable(item)) return false;

    if (isStashed(item)) {
        ui.notifications.warn(game.i18n.localize("DRPG.Items.equipStashed"));
        return false;
    }

    const category = item.getFlag(MODULE_ID, ITEM_FLAGS.category);
    const wasEquipped = isEquipped(item);

    try {
        if (!wasEquipped) {
            const previous = equippedIn(actor, category);
            if (previous && previous.id !== item.id) {
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
 * Use a Usable Item.
 *
 * Consumed whatever happens — the guide's usable items are one-shot, and an
 * item that restores nothing because the character was already whole is still
 * an item that has been opened. The dialog says so before it is spent.
 *
 * @returns {Promise<object|null>} what was restored, or null if it did not happen.
 */
export async function useItem(actor, item) {
    if (!actor || !isUsable(item)) return null;

    if (isStashed(item)) {
        ui.notifications.warn(game.i18n.localize("DRPG.Items.useStashed"));
        return null;
    }

    const tier = item.getFlag(MODULE_ID, ITEM_FLAGS.tier) ?? 0;
    const effect = USABLE_EFFECTS[tier];

    // Tier 0 is "a random, seemingly useless object, open to creative use" —
    // there is no table row to apply, so a human decides what it is worth.
    if (!effect || effect.creative) return useCreatively(actor, item);

    const choice = effect.choose ? await askWhichResource(item, effect) : "fixed";
    if (!choice) return null;

    const amounts = effect.fixed ? effect.fixed : { [choice]: effect.amount };

    // Ask before destroying it.
    //
    // Tier 1 and 2 have already been through the which-resource dialog, so that
    // was the confirmation. Tier 3 has nothing to choose — it restores all three
    // at once — and so used to be spent by a single click on a small icon, with
    // no way back. It is the rarest item the guide describes.
    //
    // Either way, an item that would restore NOTHING gets stopped: drinking a
    // first aid kit at full health is a mistake the sheet can see coming, and
    // silently eating it is the least helpful thing this could do.
    const preview = wouldRestore(actor, amounts);
    const pointless = !Object.keys(preview).length;

    if (pointless || effect.fixed) {
        const go = await confirmUse(item, preview, pointless);
        if (!go) return null;
    }

    const restored = await restore(actor, amounts);
    await consume(item);

    const summary = describe(restored);
    await whisperToOwner(actor, `
        <p><strong>${game.i18n.format("DRPG.Items.used", {
            item: foundry.utils.escapeHTML(item.name)
        })}</strong></p>
        <p>${summary || game.i18n.localize("DRPG.Items.usedNothing")}</p>`);

    log(`${actor.name} used "${item.name}" (Tier ${tier}): ${summary || "no effect"}.`);
    return restored;
}

/** Tier 0: the GM says whether the idea works, and what it does. */
async function useCreatively(actor, item) {
    const { promptAndCallGm } = await import("./gm-bridge.mjs");

    const request = await promptAndCallGm(actor, {
        title: game.i18n.format("DRPG.Items.useTitle", { item: item.name }),
        prompt: game.i18n.format("DRPG.Items.creativePrompt", {
            item: foundry.utils.escapeHTML(item.name)
        }),
        placeholder: game.i18n.localize("DRPG.Items.creativePlaceholder"),
        room: (await import("./movement.mjs")).roomOfActor(actor)
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
            <p class="notes">${game.i18n.localize("DRPG.Items.useConsumes")}</p>
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
    for (const [key, amount] of Object.entries(amounts)) {
        if (key === "hope") {
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
        }</p>
        <p class="notes">${game.i18n.localize("DRPG.Items.useConsumes")}</p>`,
        rejectClose: false
    });
}

/**
 * Apply the restore.
 *
 * HP and Stress are reverse resources — marks count UP toward max — so healing
 * subtracts. Hope is a normal one and adds. Everything is clamped, and what was
 * actually restored is reported rather than what was offered: a character with
 * one mark of HP who drinks a Tier 2 kit recovers one, not two.
 */
async function restore(actor, amounts) {
    const update = {};
    const done = {};

    for (const [key, amount] of Object.entries(amounts)) {
        if (key === "hope") {
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
            await automatedUpdate(actor, update);
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

/** A usable item is one-shot: spend a charge, delete when it runs out. */
async function consume(item) {
    const quantity = Number(item.system?.quantity ?? 1);
    try {
        if (quantity > 1) await item.update({ "system.quantity": quantity - 1 });
        else await item.delete();
    } catch (err) {
        error("Could not consume the item", err);
    }
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

    const restored = await restore(actor, amounts);
    if (item && consumeItem) await consume(item);

    const summary = describe(restored);
    await whisperToOwner(actor, `<p>${game.i18n.format("DRPG.Items.used", {
        item: foundry.utils.escapeHTML(item?.name ?? "?")
    })} — ${summary || game.i18n.localize("DRPG.Items.usedNothing")}</p>`);

    return restored;
}
