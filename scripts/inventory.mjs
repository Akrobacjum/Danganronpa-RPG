/**
 * Danganronpa RPG — putting found things into the inventory.
 * ---------------------------------------------------------------------------
 * A Search that only tells you what you found is a Search that ends in
 * bookkeeping. This creates the actual item on the character, tagged with the
 * category and tier so the carry limits from the guide can be enforced.
 *
 * Usable items become Daggerheart consumables (they get spent); tools become
 * loot (they persist until used in a crime and removed).
 */

import { MODULE_ID, ITEM_CATEGORIES, TIER_EFFECTS } from "./config.mjs";
import { whisperToOwner, log, warn } from "./utils.mjs";

/** Flag keys stored on every item this module creates. */
export const ITEM_FLAGS = {
    category: "category",
    tier: "tier",
    /**
     * Where the thing physically is: in their hands, or in their stash.
     *
     * A flag rather than a second inventory, which has one consequence worth
     * stating: a stashed item is still an item on the owner's sheet, so
     * everything that sweeps a character's belongings — the death procedure
     * above all (decision D1) — reaches it without knowing stashes exist.
     */
    location: "location",
    /**
     * This one has been used up, and is still here.
     *
     * `{ at }` — a timestamp, so the flag is truthy and says when. See
     * BROKEN_ITEMS in config.mjs for why the three moments that used to delete
     * an item now set this instead.
     *
     * A flag on the item rather than a name change or a new category: the guide
     * is clear that what stays behind is the same object, and the carry limit,
     * the tier, the description and the picture all still describe it. Only what
     * it can DO has changed, and that is a question three functions ask (`isUsable`,
     * `isEquippable` and the incident engine's weapon lookup) rather than a
     * property of the row on the sheet.
     */
    broken: "broken"
};

/**
 * The flags a COPY of an item has to carry to still be the same object.
 *
 * An item that changes hands is not moved, it is recreated on the other person
 * and deleted from this one — see `handover.mjs` and the stash theft in
 * `vault.mjs`. That is fine for everything `grantItem` already takes (name,
 * category, tier, description, picture) and was quietly a laundry service for
 * anything else: a ruined Crime Tool handed to an accomplice, or stolen out of
 * a bedroom, came out of the transfer working again.
 *
 * One entry today. It is a function rather than a spread at each call site so
 * the next piece of per-item state has one place to be added to instead of two
 * to be remembered in.
 */
export function preservedFlags(item) {
    return isBroken(item)
        ? { [ITEM_FLAGS.broken]: item.getFlag(MODULE_ID, ITEM_FLAGS.broken) }
        : {};
}

/** Has this been used up? A broken item still occupies its slot. */
export function isBroken(item) {
    return Boolean(item?.getFlag(MODULE_ID, ITEM_FLAGS.broken));
}

/**
 * Use this thing up without taking it off the sheet.
 *
 * Replaces the `item.delete()` that used to sit at the end of a murder, a
 * clean-up and every Usable Item. Also puts the thing DOWN — a ruined tool that
 * is still marked as readied would go on arming its owner in the incident
 * engine, which reads `equippedIn`.
 *
 * Idempotent: breaking what is already broken changes nothing and reports
 * success, because the caller's intent — "this is used up now" — is satisfied.
 *
 * @returns {Promise<boolean>} whether the item is now broken.
 */
export async function breakItem(item) {
    if (!item) return false;
    if (isBroken(item)) return true;

    try {
        // One write, two facts. Written through `update` rather than two
        // `setFlag` calls so a sheet cannot render between them and show a
        // broken tool that is still in somebody's hand.
        await item.update({
            [`flags.${MODULE_ID}.${ITEM_FLAGS.broken}`]: { at: Date.now() },
            [`flags.${MODULE_ID}.equipped`]: false
        });
    } catch (err) {
        warn("Could not mark the item as broken", err);
        return false;
    }

    log(`"${item.name}" is broken and stays in ${item.parent?.name ?? "the"} inventory.`);
    return true;
}

/** The two places an item can be. Anything unmarked is carried. */
export const LOCATIONS = { carried: "carried", vault: "vault" };

/** Where this item is. Items made before stashes existed are carried. */
export function locationOf(item) {
    return item?.getFlag(MODULE_ID, ITEM_FLAGS.location) ?? LOCATIONS.carried;
}

/** Is this item in its owner's stash rather than their hands? */
export function isStashed(item) {
    return locationOf(item) === LOCATIONS.vault;
}

/**
 * Update-option marking a creation the carry limit must not refuse.
 *
 * The limit is enforced in a `preCreateItem` hook so it also catches items
 * dragged in from a compendium or handed over by another player. That hook would
 * equally refuse the GM's own deliberate grant, so the grant marks itself.
 */
export const CAP_OVERRIDE = "drpgIgnoreCarryLimit";

/**
 * Every path here must exist in the core icon set, or the item is created with a
 * broken image and a 404 in the console. Two of these did not: `vegetable-fruit-
 * apple-red.webp` and `broom-blue.webp` are not shipped by Foundry v14, so every
 * Usable Item and every Cleaning Tool the module ever made showed a blank frame.
 * Both replaced with paths verified against the installed icon set.
 */
const ICONS = {
    usable: "icons/consumables/food/berries-ration-round-red.webp",
    crimeTool: "icons/weapons/axes/axe-broad-brown.webp",
    cleaningTool: "icons/tools/hand/broom-straw-brown.webp",
    truthBullet: "icons/sundries/documents/document-sealed-red-yellow.webp"
};

/**
 * How many of this category the character is CARRYING.
 *
 * The stash does not count against the limit — that is the whole point of one.
 * The guide caps what you have on you, not what you own.
 */
export function countInCategory(actor, category) {
    return actor.items.filter(i =>
        i.getFlag(MODULE_ID, ITEM_FLAGS.category) === category && !isStashed(i)).length;
}

/**
 * Is there room for another one? Truth Bullets are deliberately uncapped.
 * @returns {{ok: boolean, held: number, limit: number|null}}
 */
export function canCarry(actor, category) {
    const limit = ITEM_CATEGORIES[category]?.limit ?? null;
    const held = countInCategory(actor, category);
    return { ok: limit === null || held < limit, held, limit };
}

/**
 * Create a found item on the character.
 *
 * Refuses when the category is full rather than silently exceeding the limit —
 * the guide caps crime tools at one and cleaning tools at two on purpose.
 *
 * @param {object} [options.extraFlags]  Further module flags written in the same
 *   creation. Truth Bullets carry a good deal more than a category and a tier,
 *   and patching them on afterwards would leave a moment — one database write
 *   long, but a real one — where a Truth Bullet exists with no type at all.
 * @returns {Promise<Item|null>}
 */
export async function grantItem(actor, {
    name, category, tier, description = "", override = false, img = null, extraFlags = {},
    location = LOCATIONS.carried
}) {
    if (!actor || !name) return null;

    const room = canCarry(actor, category);
    if (!room.ok && location !== LOCATIONS.vault) {
        // A GM handing something over outranks the cap — they are making a
        // ruling, not finding something in a cupboard. Search never passes
        // `override`, so the guide's limits still bind the players.
        if (override) {
            ui.notifications.warn(game.i18n.format("DRPG.Inventory.overCap", {
                actor: actor.name,
                category: ITEM_CATEGORIES[category]?.plural ?? category,
                held: room.held + 1,
                limit: room.limit
            }));
        } else {
            // The guide does not have you drop what you found because your hands
            // are full — it goes in your stash. Refusing outright is only right
            // when there is no stash to put it in.
            const { vaultRoomFor } = await import("./vault.mjs");
            if (vaultRoomFor(actor)) {
                location = LOCATIONS.vault;
                await whisperToOwner(actor, `<p>${game.i18n.format("DRPG.Vault.overflowed", {
                    item: foundry.utils.escapeHTML(name),
                    category: foundry.utils.escapeHTML(
                        ITEM_CATEGORIES[category]?.plural ?? category)
                })}</p>`);
            } else {
                ui.notifications.warn(game.i18n.format("DRPG.Inventory.full", {
                    category: ITEM_CATEGORIES[category]?.plural ?? category,
                    limit: room.limit
                }));
                return null;
            }
        }
    }

    const type = category === "usable" ? "consumable" : "loot";
    const effect = TIER_EFFECTS[category]?.[tier] ?? "";

    // The tier line is a fallback for things that HAVE a tier. A Truth Bullet
    // does not, and passing `tier: null` through the old unconditional template
    // wrote "Tier null." into the description of every bullet issued without
    // player text.
    const hasTier = tier !== null && tier !== undefined;
    const fallbackDescription = hasTier ? `<p>Tier ${tier}. ${effect}</p>` : "";

    try {
        const [item] = await actor.createEmbeddedDocuments("Item", [{
            name,
            type,
            img: img ?? ICONS[category] ?? ICONS.usable,
            system: {
                description: description || fallbackDescription,
                quantity: 1
            },
            flags: {
                [MODULE_ID]: {
                    [ITEM_FLAGS.category]: category,
                    [ITEM_FLAGS.tier]: tier,
                    [ITEM_FLAGS.location]: location,
                    ...extraFlags
                }
            }
        }], { [CAP_OVERRIDE]: override });

        log(`${actor.name} gained ${name} (${category}${hasTier ? `, Tier ${tier}` : ""}).`);
        return item ?? null;
    } catch (err) {
        warn("Could not create the item", err);
        return null;
    }
}

/**
 * Enforce the carry limits when items arrive by any other route — dragged from
 * a compendium, handed over by another player, granted by the GM.
 */
export function registerInventoryLimits() {
    Hooks.on("preCreateItem", (item, data, options) => {
        const actor = item.parent;
        if (!actor || actor.type !== "character") return;
        // The GM's own grant has already said it means it.
        if (options?.[CAP_OVERRIDE]) return;

        const category = data.flags?.[MODULE_ID]?.[ITEM_FLAGS.category];
        if (!category) return;
        // A stash has no limit, so an item going straight into one has nothing
        // to be measured against.
        if (data.flags?.[MODULE_ID]?.[ITEM_FLAGS.location] === LOCATIONS.vault) return;

        const room = canCarry(actor, category);
        if (room.ok) return;

        ui.notifications.warn(game.i18n.format("DRPG.Inventory.full", {
            category: ITEM_CATEGORIES[category]?.plural ?? category,
            limit: room.limit
        }));
        return false;
    });
}

/**
 * Everything the character has in one category, stash included.
 *
 * Deliberately not filtered by location: Truth Bullets are never stashed, and
 * the GM's take-away dialog has to be able to reach into a stash. Callers that
 * mean "in their hands" want `carriedInCategory`.
 */
export function itemsInCategory(actor, category) {
    return actor.items.filter(i => i.getFlag(MODULE_ID, ITEM_FLAGS.category) === category);
}

/** Only what is actually on them. */
export function carriedInCategory(actor, category) {
    return itemsInCategory(actor, category).filter(i => !isStashed(i));
}

/** A short inventory summary for the GM. */
export function inventorySummary(actor) {
    return Object.entries(ITEM_CATEGORIES).map(([key, cat]) => {
        const held = countInCategory(actor, key);
        return `${cat.plural}: ${held}${cat.limit ? `/${cat.limit}` : ""}`;
    }).join(" · ");
}
