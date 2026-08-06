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
import { log, warn } from "./utils.mjs";

/** Flag keys stored on every item this module creates. */
export const ITEM_FLAGS = {
    category: "category",
    tier: "tier"
};

const ICONS = {
    usable: "icons/consumables/food/vegetable-fruit-apple-red.webp",
    crimeTool: "icons/weapons/axes/axe-broad-brown.webp",
    cleaningTool: "icons/tools/hand/broom-blue.webp",
    truthBullet: "icons/sundries/documents/document-sealed-red-yellow.webp"
};

/** How many of this category the character is already carrying. */
export function countInCategory(actor, category) {
    return actor.items.filter(i => i.getFlag(MODULE_ID, ITEM_FLAGS.category) === category).length;
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
 * @returns {Promise<Item|null>}
 */
export async function grantItem(actor, { name, category, tier, description = "" }) {
    if (!actor || !name) return null;

    const room = canCarry(actor, category);
    if (!room.ok) {
        ui.notifications.warn(game.i18n.format("DRPG.Inventory.full", {
            category: ITEM_CATEGORIES[category]?.plural ?? category,
            limit: room.limit
        }));
        return null;
    }

    const type = category === "usable" ? "consumable" : "loot";
    const effect = TIER_EFFECTS[category]?.[tier] ?? "";

    try {
        const [item] = await actor.createEmbeddedDocuments("Item", [{
            name,
            type,
            img: ICONS[category] ?? ICONS.usable,
            system: {
                description: description || `<p>Tier ${tier}. ${effect}</p>`,
                quantity: 1
            },
            flags: {
                [MODULE_ID]: {
                    [ITEM_FLAGS.category]: category,
                    [ITEM_FLAGS.tier]: tier
                }
            }
        }]);

        log(`${actor.name} gained ${name} (${category}, Tier ${tier}).`);
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
    Hooks.on("preCreateItem", (item, data) => {
        const actor = item.parent;
        if (!actor || actor.type !== "character") return;

        const category = data.flags?.[MODULE_ID]?.[ITEM_FLAGS.category];
        if (!category) return;

        const room = canCarry(actor, category);
        if (room.ok) return;

        ui.notifications.warn(game.i18n.format("DRPG.Inventory.full", {
            category: ITEM_CATEGORIES[category]?.plural ?? category,
            limit: room.limit
        }));
        return false;
    });
}

/** Everything the character carries in one category. */
export function itemsInCategory(actor, category) {
    return actor.items.filter(i => i.getFlag(MODULE_ID, ITEM_FLAGS.category) === category);
}

/** A short inventory summary for the GM. */
export function inventorySummary(actor) {
    return Object.entries(ITEM_CATEGORIES).map(([key, cat]) => {
        const held = countInCategory(actor, key);
        return `${cat.plural}: ${held}${cat.limit ? `/${cat.limit}` : ""}`;
    }).join(" · ");
}
