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

import { MODULE_ID, ITEM_CATEGORIES, ITEM_DURABILITY, LIMIT_GROUPS, TIER_EFFECTS, USABLE_KINDS, USABLE_KIND_EFFECTS, itemIcon }
    from "./config.mjs";
import { whisperToOwner, log, warn, error } from "./utils.mjs";

/** Flag keys stored on every item this module creates. */
export const ITEM_FLAGS = {
    category: "category",
    tier: "tier",
    /**
     * How much of this thing's durability has been spent — a number, counting
     * up to `durabilityOf`. Absent means none, which is what every item made
     * before durability existed correctly reports.
     */
    wear: "wear",
    /**
     * A NAME, NOT A MARK — and the difference is the whole of E21's fifth
     * trigger.
     *
     * An indirect murder can ride an OBJECT: you leave something behind and
     * whoever finds it and uses it is the one it kills. The module has to be
     * able to recognise that object later, and it cannot do it by document id,
     * because an item moved between characters — Palm to Plant, a theft, a
     * hand-over — is DELETED and re-created with a new one. That is precisely
     * the journey the trap is about, so an id-keyed record breaks at the only
     * moment it is needed.
     *
     * So every item this module creates gets a random identity that travels
     * with it (see `preservedFlags`). A player reading their own console sees
     * `drpgItemId: "a7f3…"` on everything in their bag and learns nothing from
     * it: it is on the water bottle as well as the poison. Which of those
     * identities is poisoned lives only in the GM's own `trapLedger` — see the
     * header of traps.mjs for why a flag saying "this is the trap" would be a
     * poisoned first aid kit with POISONED written on it.
     */
    identity: "drpgItemId",
    /**
     * WHICH stash this item is lying in, by room name.
     *
     * Meaningless unless `location` is `vault`. Absent means the owner's
     * PRIMARY stash — which is what every item stashed before E11 has, and why
     * this needs no migration pass of its own: one stash per person was the
     * only thing that could be true, so "unmarked" and "the only one" were the
     * same answer and still are.
     *
     * A NAME rather than a region id, to match how every other room reference
     * in this module works (`roomOfActor`, the key flag, the fog mirror). The
     * cost is that renaming a region orphans them, which is the same cost the
     * bedroom keys already pay and is documented at `KEY_FLAG`.
     */
    stashRoom: "stashRoom",
    /**
     * What else this item can do, beyond the category it lives in.
     *
     * An array of category keys — `["crimeTool"]` on a screwdriver filed under
     * Tools. Set from the item table the thing was drawn from, so a found
     * screwdriver arrives knowing it can be swung and nobody has to remember;
     * the GM can change it on the item afterwards.
     *
     * Absent means an empty list, which means exactly the behaviour this module
     * had before roles existed. That is why this needs no migration clause.
     */
    roles: "roles",
    /**
     * Which kind of usable this is: "healing" or "stress" (USABLE_KINDS).
     *
     * A record of where the item came from, not the authority on what it does —
     * the item tables outrank it (see `usableKindOf` in use-items.mjs). It is
     * what keeps a room-table find working: "Herbal tea" drawn in the infirmary
     * exists in no Healing table, and this flag is the only place its kind was
     * ever written down.
     */
    kind: "usableKind",
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
 * A function rather than a spread at each call site so the next piece of
 * per-item state has one place to be added to instead of two to be
 * remembered in.
 */
export function preservedFlags(item) {
    const flags = {};
    if (isBroken(item)) {
        flags[ITEM_FLAGS.broken] = item.getFlag(MODULE_ID, ITEM_FLAGS.broken);
    }
    // A healing item is still a healing item in somebody else's hands.
    const kind = item?.getFlag(MODULE_ID, ITEM_FLAGS.kind);
    if (kind) flags[ITEM_FLAGS.kind] = kind;

    // And a crowbar is still a weapon. Missing until E9, so handing over a
    // two-tag item quietly halved it — the receiver got a tool where the giver
    // had a tool that could be swung.
    const roles = rolesOf(item);
    if (roles.length) flags[ITEM_FLAGS.roles] = roles;

    /*
     * AND THE IDENTITY, which is the reason `preservedFlags` matters at all to
     * E21. Everything else here survives a hand-over because it would be absurd
     * for it not to — a broken thing stays broken, a crowbar stays a weapon.
     * This one survives because the trap is ABOUT the hand-over: an object that
     * changes identity when it changes hands cannot be the object somebody left
     * for somebody else to pick up.
     */
    const identity = item?.getFlag(MODULE_ID, ITEM_FLAGS.identity);
    if (identity) flags[ITEM_FLAGS.identity] = identity;

    return flags;
}

/** A fresh identity for an item this module is about to create. */
export function newItemIdentity() {
    return foundry.utils.randomID(16);
}

/**
 * How many bad rolls this thing has left in it, and how many it has taken.
 *
 * The tier decides the total (`ITEM_DURABILITY`); anything with no tier
 * recorded answers 1, so a hand-made item and a world made before durability
 * existed behave exactly as everything did before it: one Despair and it is
 * done.
 */
export function durabilityOf(item) {
    const tier = Number(item?.getFlag(MODULE_ID, ITEM_FLAGS.tier));
    return ITEM_DURABILITY[tier] ?? 1;
}

/** How much wear this thing carries. Never more than it can take. */
export function wearOf(item) {
    const worn = Number(item?.getFlag(MODULE_ID, ITEM_FLAGS.wear)) || 0;
    return Math.min(Math.max(0, worn), durabilityOf(item));
}

/** Bad rolls this thing can still absorb before it goes. */
export function durabilityLeft(item) {
    return isBroken(item) ? 0 : Math.max(0, durabilityOf(item) - wearOf(item));
}

/**
 * One bad roll's worth of wear, and the break when there is no more to give.
 *
 * THE BREAK HAPPENS HERE, on the roll that fills it, rather than being noticed
 * later by something sweeping up (Dawid, 28.08). `breakItem` already takes the
 * thing out of the hand it is in, so a tool that goes on the last point of its
 * durability is out of play from that moment — not from the end of the
 * incident, which is when the old rule got round to it.
 *
 * @returns {Promise<{worn: number, left: number, broke: boolean}|null>}
 */
export async function wearItem(item) {
    if (!item || isBroken(item)) return null;

    const total = durabilityOf(item);
    const worn = Math.min(total, wearOf(item) + 1);

    if (worn >= total) {
        const broke = await breakItem(item);
        return { worn: total, left: 0, broke };
    }

    try {
        await item.setFlag(MODULE_ID, ITEM_FLAGS.wear, worn);
    } catch (err) {
        warn("Could not record the wear on an item", err);
        return null;
    }
    log(`"${item.name}" is worn ${worn}/${total}.`);
    return { worn, left: total - worn, broke: false };
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
 * Icons the module used to hand out, so a world made before v1.1.60 can be
 * brought up to date without overwriting anything a GM chose themselves.
 *
 * Two of these never existed in Foundry v14 at all — they were the module's
 * defaults for a while and every item made in that window is still carrying a
 * broken path. They are the clearest case of "replaceable": a picture that was
 * never a picture.
 */
const SUPERSEDED = new Set([
    "icons/consumables/food/berries-ration-round-red.webp",
    "icons/weapons/axes/axe-broad-brown.webp",
    "icons/tools/hand/broom-straw-brown.webp",
    "icons/sundries/documents/document-sealed-red-yellow.webp",
    "icons/consumables/fruit/vegetable-fruit-apple-red.webp",
    "icons/tools/hand/broom-blue.webp",
    // The padlock every bedroom key wore until v1.1.69.
    "icons/svg/padlock.svg",
    "icons/svg/item-bag.svg",
    "icons/svg/mystery-man.svg"
]);

/** Is this picture one the module put there, or no picture at all? */
function replaceableIcon(img) {
    if (!img) return true;
    if (SUPERSEDED.has(img)) return true;
    // Our own, including a category whose drawing has since been redrawn or
    // whose key has moved: re-running must be able to correct itself.
    return img.includes(`/${MODULE_ID}/icons/item-`);
}

/**
 * PUT THE PLACEHOLDER ICONS ON A WORLD THAT ALREADY EXISTS.
 *
 *     game.drpg.pinItemIcons()              // see what would change
 *     game.drpg.pinItemIcons({ apply: true })
 *     game.drpg.pinItemIcons({ apply: true, all: true })
 *
 * The icons ship inside the module, so nothing is uploaded anywhere — update
 * the module and the files are on the server. What this fixes is everything
 * made BEFORE that: items already in somebody's bag and rows already written
 * into the item tables, which kept whatever picture they were created with.
 *
 * IT LOOKS FIRST AND REFUSES TO GUESS. Only a picture the module itself put
 * there — or none at all — is replaced; a Truth Bullet wearing the photograph
 * of the trace it came from, or an item a GM picked art for, is left alone.
 * `all: true` drops that rule for a GM who wants every module item reset to its
 * category's placeholder, and says so in what it reports.
 *
 * @param {object}  [options]
 * @param {boolean} [options.apply]  Write. Without it, nothing is changed.
 * @param {boolean} [options.all]    Replace chosen pictures too.
 * @returns {Promise<object>} what changed, or what would.
 */
export async function pinItemIcons({ apply = false, all = false } = {}) {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    const wanted = item => itemIcon(item.getFlag(MODULE_ID, ITEM_FLAGS.category));
    const plan = { items: [], results: [], skipped: 0 };

    for (const actor of game.actors) {
        for (const item of actor.items) {
            const category = item.getFlag(MODULE_ID, ITEM_FLAGS.category);
            if (!category || !ITEM_CATEGORIES[category]) continue;
            const target = wanted(item);
            if (item.img === target) continue;
            if (!all && !replaceableIcon(item.img)) { plan.skipped++; continue; }
            plan.items.push({ actor: actor.name, item: item.name, category, from: item.img, to: target });
        }
    }

    for (const table of game.tables) {
        const category = table.getFlag(MODULE_ID, "category");
        if (!category || !ITEM_CATEGORIES[category]) continue;
        const target = itemIcon(category);
        for (const result of table.results) {
            if (result.img === target) continue;
            if (!all && !replaceableIcon(result.img)) { plan.skipped++; continue; }
            plan.results.push({ table: table.name, row: result.name ?? result.text, to: target, id: result.id });
        }
    }

    const summary = {
        wouldChangeItems: plan.items.length,
        wouldChangeTableRows: plan.results.length,
        leftAlone: plan.skipped,
        applied: false
    };

    if (!apply) {
        log(`pinItemIcons (looking only): ${summary.wouldChangeItems} item(s), `
            + `${summary.wouldChangeTableRows} table row(s), ${summary.leftAlone} left alone. `
            + "Run game.drpg.pinItemIcons({ apply: true }) to write.");
        console.log(`${MODULE_ID} | pinItemIcons`, { ...summary, items: plan.items, results: plan.results });
        return { ...summary, items: plan.items, results: plan.results };
    }

    let items = 0;
    for (const actor of game.actors) {
        const updates = plan.items
            .filter(row => row.actor === actor.name)
            .map(row => {
                const item = actor.items.find(i => i.name === row.item && i.img === row.from);
                return item ? { _id: item.id, img: row.to } : null;
            })
            .filter(Boolean);
        if (!updates.length) continue;
        try {
            await actor.updateEmbeddedDocuments("Item", updates);
            items += updates.length;
        } catch (err) {
            error(`Could not put the icons on ${actor.name}'s items`, err);
        }
    }

    let rows = 0;
    for (const table of game.tables) {
        const mine = plan.results.filter(row => row.table === table.name);
        if (!mine.length) continue;
        try {
            await table.updateEmbeddedDocuments("TableResult",
                mine.map(row => ({ _id: row.id, img: row.to })));
            rows += mine.length;
        } catch (err) {
            error(`Could not put the icons on "${table.name}"`, err);
        }
    }

    summary.applied = true;
    summary.items = items;
    summary.tableRows = rows;
    log(`pinItemIcons: ${items} item(s) and ${rows} table row(s) now wear their category's icon`
        + `${plan.skipped ? `; ${plan.skipped} left alone (they carry a chosen picture)` : ""}.`);
    ui.notifications.info(game.i18n.format("DRPG.Items.iconsPinned", { items, rows }));
    return summary;
}

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

/** Every category drawing on one shared budget. See LIMIT_GROUPS. */
export function categoriesInGroup(group) {
    return Object.entries(ITEM_CATEGORIES)
        .filter(([, cat]) => cat.limitGroup === group)
        .map(([key]) => key);
}

/** How much of a shared budget this character has spent. */
export function countInGroup(actor, group) {
    return categoriesInGroup(group)
        .reduce((total, key) => total + countInCategory(actor, key), 0);
}

/**
 * Is there room for another one? Truth Bullets are deliberately uncapped.
 *
 * A category belonging to a LIMIT GROUP is counted across the whole group, so
 * "one more Murder Weapon?" is really "is there a free slot?" — three between
 * the weapons, the cleaning tools and the tools (G-43, Dawid 27.08). A category
 * with no group behaves exactly as it always did.
 *
 * The shape of the answer is unchanged on purpose: four callers put `limit` into
 * a refusal message, and they should not have to learn about groups to say "2 of
 * 3" instead of "1 of 1".
 *
 * @returns {{ok: boolean, held: number, limit: number|null, group: string|null}}
 */
export function canCarry(actor, category) {
    const group = ITEM_CATEGORIES[category]?.limitGroup ?? null;
    if (group) {
        const limit = LIMIT_GROUPS[group]?.limit ?? null;
        const held = countInGroup(actor, group);
        return { ok: limit === null || held < limit, held, limit, group };
    }

    const limit = ITEM_CATEGORIES[category]?.limit ?? null;
    const held = countInCategory(actor, category);
    return { ok: limit === null || held < limit, held, limit, group: null };
}

/* ==========================================================================
 * ONE HOME, SEVERAL ROLES
 * --------------------------------------------------------------------------
 * A saw is a tool and a weapon. Duct tape is a cleaning tool and a tool. A
 * screwdriver is both, depending on what the moment needs.
 *
 * The category stays ONE value, because it is the key to five separate things —
 * the carry slot, the row on the sheet, the search table, what may be held
 * ready, and the mechanic — and only the last of those is what this is about.
 * So the category remains the item's HOME, and a second flag lists the other
 * roles it can fill.
 *
 * Every question of the form "is this a weapon" goes through `servesAs`; every
 * question of the form "which slot does this take" stays on the category. An
 * item costs one slot, in its home, whatever else it can do — which is only
 * fair because the slots are shared (see LIMIT_GROUPS).
 * ========================================================================== */

/** The roles this item fills beyond its home. Always an array. */
export function rolesOf(item) {
    const roles = item?.getFlag?.(MODULE_ID, ITEM_FLAGS.roles);
    return Array.isArray(roles) ? roles : [];
}

/** Can this item do the job of `role` — either as its home or as a role? */
export function servesAs(item, role) {
    if (!item || !role) return false;
    return item.getFlag(MODULE_ID, ITEM_FLAGS.category) === role || rolesOf(item).includes(role);
}

/** Everything on them that can do this job, stash excluded. */
export function carriedFor(actor, role) {
    return actor?.items?.filter(i => servesAs(i, role) && !isStashed(i)) ?? [];
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
    name, category, tier, goal = null, description = "", override = false, img = null,
    roles = null, extraFlags = {}, location = LOCATIONS.carried, quiet = false
}) {
    if (!actor || !name) return null;

    // Set only when a full inventory pushes this into a stash — see below.
    // `null` for everything else, including an item granted straight into a
    // stash by a caller, which means the owner's primary and says so by
    // leaving the flag off.
    let overflowRoom = null;

    // Search hands its goal straight through ("healing", "stress" — but also
    // "crimeTool", which is not a usable kind). A usable granted with no goal
    // — the GM's console, a season's starting item — asks the item tables for
    // its name instead, so an Apple says "Restores 1 Health" however it arrived.
    // Only the two kinds are worth writing down, and only on a usable.
    let kind = null;
    if (category === "usable") {
        kind = USABLE_KINDS[goal] ? goal : null;
        if (!kind) {
            const { usableKindFor } = await import("./tables.mjs");
            const assigned = usableKindFor(name);
            kind = USABLE_KINDS[assigned] ? assigned : null;
        }
    }

    const room = canCarry(actor, category);
    if (!room.ok && location !== LOCATIONS.vault) {
        // A GM handing something over outranks the cap — they are making a
        // ruling, not finding something in a cupboard. Search never passes
        // `override`, so the guide's limits still bind the players.
        if (override) {
            ui.notifications.warn(game.i18n.format("DRPG.Inventory.overCap", {
                actor: actor.name,
                category: capacityLabel(category),
                held: room.held + 1,
                limit: room.limit
            }));
        } else {
            // The guide does not have you drop what you found because your hands
            // are full — it goes in your stash. Refusing outright is only right
            // when there is no stash to put it in.
            // WHICH stash the overflow lands in, not merely whether one
            // exists: an unaddressed item would otherwise be read as living in
            // whichever stash `primaryStashRoom` happens to answer later, and
            // that answer can change when a GM adds or removes one.
            const { primaryStashRoom } = await import("./vault.mjs");
            overflowRoom = primaryStashRoom(actor);
            if (overflowRoom) {
                location = LOCATIONS.vault;
                await whisperToOwner(actor, `<p>${game.i18n.format("DRPG.Vault.overflowed", {
                    item: foundry.utils.escapeHTML(name),
                    category: foundry.utils.escapeHTML(
                        ITEM_CATEGORIES[category]?.plural ?? category)
                })}</p>`);
            } else {
                ui.notifications.warn(game.i18n.format("DRPG.Inventory.full", {
                    category: capacityLabel(category),
                    limit: room.limit
                }));
                return null;
            }
        }
    }

    const type = category === "usable" ? "consumable" : "loot";
    const effect = USABLE_KIND_EFFECTS[kind]?.[tier] ?? TIER_EFFECTS[category]?.[tier] ?? "";

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
            img: img ?? itemIcon(category),
            system: {
                description: description || fallbackDescription,
                quantity: 1
            },
            flags: {
                [MODULE_ID]: {
                    [ITEM_FLAGS.category]: category,
                    [ITEM_FLAGS.tier]: tier,
                    [ITEM_FLAGS.location]: location,
                    ...(overflowRoom ? { [ITEM_FLAGS.stashRoom]: overflowRoom } : {}),
                    ...(kind ? { [ITEM_FLAGS.kind]: kind } : {}),
                    // Only when there are any: an empty array and a missing
                    // flag mean the same thing, and the missing one is what
                    // every item written before E8 already has.
                    ...(roles?.length ? { [ITEM_FLAGS.roles]: [...roles] } : {}),
                    // EVERY item, not only the interesting ones — see the note
                    // on `ITEM_FLAGS.identity`. Before `extraFlags` so a caller
                    // that already has an identity for this thing (a planted
                    // trap item, a hand-over carrying `preservedFlags`) keeps
                    // theirs rather than being given a second one.
                    [ITEM_FLAGS.identity]: newItemIdentity(),
                    ...extraFlags
                }
            }
        }], {
            [CAP_OVERRIDE]: override,
            /*
             * `quiet` SUPPRESSES THE RECEIVER'S RE-RENDER, and it exists for
             * exactly one caller: a Plant nobody noticed (`plantOnPerson`).
             * Foundry carries this option over its own socket, so the sheet on
             * the victim's screen does not redraw FOR THIS CHANGE — the item is
             * really there, and what is suppressed is the refresh.
             *
             * The mirror of the silent Steal's `item.delete({ render: false })`,
             * and the same promise: not "they will never see", but "they will
             * not see because of this".
             */
            ...(quiet ? { render: false } : {})
        });

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

/**
 * What the carry limit for this category is really about.
 *
 * Trap 69: four screens put a limit in front of somebody — the sheet's rows,
 * this summary, the item manager and the refusal message — and with a shared
 * budget all four have to say "2/3 Gear" rather than three separate "1/1"s. A
 * player who reads "Murder Weapons 1/1" beside an empty slot has been told two
 * contradictory things by the same window.
 */
export function capacityLabel(category) {
    const group = ITEM_CATEGORIES[category]?.limitGroup ?? null;
    return group
        ? (LIMIT_GROUPS[group]?.label ?? group)
        : (ITEM_CATEGORIES[category]?.plural ?? category);
}

/**
 * A short inventory summary for the GM.
 *
 * Grouped categories are folded into one entry, because that is what they are:
 * "Gear: 2/3" rather than three counters that each look nearly full.
 */
export function inventorySummary(actor) {
    const seen = new Set();
    const parts = [];

    for (const [key, cat] of Object.entries(ITEM_CATEGORIES)) {
        if (cat.limitGroup) {
            if (seen.has(cat.limitGroup)) continue;
            seen.add(cat.limitGroup);
            const group = LIMIT_GROUPS[cat.limitGroup];
            parts.push(`${group?.label ?? cat.limitGroup}: ${
                countInGroup(actor, cat.limitGroup)}/${group?.limit ?? "?"}`);
            continue;
        }
        const held = countInCategory(actor, key);
        parts.push(`${cat.plural}: ${held}${cat.limit ? `/${cat.limit}` : ""}`);
    }

    return parts.join(" · ");
}
