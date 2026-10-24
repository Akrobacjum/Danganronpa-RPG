/**
 * Danganronpa RPG - putting found things into the inventory.
 * ---------------------------------------------------------------------------
 * A Search that only tells you what you found is a Search that ends in
 * bookkeeping. This creates the actual item on the character, tagged with the
 * category and tier so the carry limits from the guide can be enforced.
 *
 * Usable items become Daggerheart consumables (they get spent); tools become
 * loot (they persist until used in a crime and removed).
 */

import { MODULE_ID, ITEM_CATEGORIES, ITEM_DURABILITY, LIMIT_GROUPS, TIER_EFFECTS, USABLE_KINDS, USABLE_KIND_EFFECTS, itemIcon,
    BEDROOM_KEY_FLAG }
    from "./config.mjs";
import { whisperToOwner, whisperToGms, log, warn, error, serialWrite } from "./utils.mjs";
import { trustedWrite, trustedCreate, trustedDelete } from "./resource-guard.mjs";

/** Flag keys stored on every item this module creates. */
export const ITEM_FLAGS = {
    category: "category",
    tier: "tier",
    /**
     * How much of this thing's durability has been spent - a number, counting
     * up to `durabilityOf`. Absent means none, which is what every item made
     * before durability existed correctly reports.
     */
    wear: "wear",
    /**
     * A NAME, NOT A MARK - and the difference is the whole of E21's fifth
     * trigger.
     *
     * An indirect murder can ride an OBJECT: you leave something behind and
     * whoever finds it and uses it is the one it kills. The module has to be
     * able to recognise that object later, and it cannot do it by document id,
     * because an item moved between characters - Palm to Plant, a theft, a
     * hand-over - is DELETED and re-created with a new one. That is precisely
     * the journey the trap is about, so an id-keyed record breaks at the only
     * moment it is needed.
     *
     * So every item this module creates gets a random identity that travels
     * with it (see `preservedFlags`). A player reading their own console sees
     * `drpgItemId: "a7f3…"` on everything in their bag and learns nothing from
     * it: it is on the water bottle as well as the poison. Which of those
     * identities is poisoned lives only in the GM's own `trapLedger` - see the
     * header of traps.mjs for why a flag saying "this is the trap" would be a
     * poisoned first aid kit with POISONED written on it.
     */
    identity: "drpgItemId",
    /**
     * WHICH stash this item is lying in, by room name.
     *
     * Meaningless unless `location` is `vault`. Absent means the owner's
     * PRIMARY stash - which is what every item stashed before E11 has, and why
     * this needs no migration pass of its own: one stash per person was the
     * only thing that could be true, so "unmarked" and "the only one" were the
     * same answer and still are.
     *
     * A NAME rather than a region id, to match how every other room reference
     * in this module works (`roomOfActor`, the key flag, the fog mirror). The
     * cost was that renaming a region orphaned them, as it did the bedroom
     * keys; since E12 C8 (1.2.74) a GM's rename carries both, on the primary
     * (vault.mjs `carryRoomOnSheets`, from fog.mjs's region listener).
     */
    stashRoom: "stashRoom",
    /**
     * What else this item can do, beyond the category it lives in.
     *
     * An array of category keys - `["crimeTool"]` on a screwdriver filed under
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
     * Where the item came from, and since E29 fix r2-H8 the authority on what it
     * does: it outranks the item tables (see `usableKindOf` in use-items.mjs), so
     * a renamed item heals what it was made as. It is also what keeps a
     * room-table find working: "Herbal tea" drawn in the infirmary exists in no
     * Healing table, and this flag is the only place its kind was ever written down.
     */
    kind: "usableKind",
    /**
     * Where the thing physically is: in their hands, or in their stash.
     *
     * A flag rather than a second inventory, which has one consequence worth
     * stating: a stashed item is still an item on the owner's sheet, so
     * everything that sweeps a character's belongings - the death procedure
     * above all (decision D1) - reaches it without knowing stashes exist.
     */
    location: "location",
    /**
     * This one has been used up, and is still here.
     *
     * `{ at }` - a timestamp, so the flag is truthy and says when. See
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
 * and deleted from this one - see `handover.mjs` and the stash theft in
 * `vault.mjs`. That is fine for everything `grantItem` already takes (name,
 * category, tier, description, picture) and was quietly a laundry service for
 * anything else: a ruined Crime Tool handed to an accomplice, or stolen out of
 * a bedroom, came out of the transfer working again.
 *
 * A function rather than a spread at each call site so the next piece of
 * per-item state has one place to be added to instead of two to be
 * remembered in.
 */
/**
 * Does finding this thing leave a trace? The rule of D-28.08: a trace is
 * evidence of having handled an OBJECT, so it is read off what was found -
 * the category plus the roles the table entry declared - and never off the
 * intention. One copy, used by the Search and by the Reroll that replays it.
 */
export function leavesTraceFor(category, roles = []) {
    const all = new Set([category, ...(roles ?? [])]);
    return all.has("crimeTool") || all.has("cleaningTool");
}

export function preservedFlags(item) {
    const flags = {};
    if (isBroken(item)) {
        flags[ITEM_FLAGS.broken] = item.getFlag(MODULE_ID, ITEM_FLAGS.broken);
    }
    // A healing item is still a healing item in somebody else's hands.
    const kind = item?.getFlag(MODULE_ID, ITEM_FLAGS.kind);
    if (kind) flags[ITEM_FLAGS.kind] = kind;

    // And a crowbar is still a weapon. Missing until E9, so handing over a
    // two-tag item quietly halved it - the receiver got a tool where the giver
    // had a tool that could be swung.
    const roles = rolesOf(item);
    if (roles.length) flags[ITEM_FLAGS.roles] = roles;

    /*
     * AND THE IDENTITY, which is the reason `preservedFlags` matters at all to
     * E21. Everything else here survives a hand-over because it would be absurd
     * for it not to - a broken thing stays broken, a crowbar stays a weapon.
     * This one survives because the trap is ABOUT the hand-over: an object that
     * changes identity when it changes hands cannot be the object somebody left
     * for somebody else to pick up.
     */
    const identity = item?.getFlag(MODULE_ID, ITEM_FLAGS.identity);
    if (identity) flags[ITEM_FLAGS.identity] = identity;

    // And the Despair it has already taken. Every transfer is a create-then-
    // delete, so without this a tool on its last point arrived on the other
    // sheet brand new - the laundry service this function exists to stop.
    const worn = wearOf(item);
    if (worn) flags[ITEM_FLAGS.wear] = worn;

    /* AND A KEY STILL OPENS ITS DOOR (22.09). The room a key opens is a flag on the key, and
       this list never carried it: a key Palmed off somebody, lifted from a stash or taken
       from a body arrived as a "Room Key" that opened nothing. Only "Give room key" made a
       working copy, because it writes the flag itself. */
    const keyRoom = item?.getFlag(MODULE_ID, BEDROOM_KEY_FLAG);
    if (keyRoom) flags[BEDROOM_KEY_FLAG] = keyRoom;

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
 * recorded answers 1 - a hand-made item, a world made before durability
 * existed. It is read as tier 0 by `tierOf` as well, so since E13 C8 it is
 * single use: the first roll it is used in spends it, not only a Despair
 * (use-items.mjs `rollSpends`, R439).
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
 * durability is out of play from that moment - not from the end of the
 * incident, which is when the old rule got round to it.
 *
 * `reason` and `ref` are the write's (resource-guard.mjs `WRITE_REASONS`): every caller in
 * the module names its own (R220); "gmRuling" is what a GM's macro or the suite gets.
 *
 * `held` is the item as the GMs hold it, where a GM's road read it so (E29 fix r2-H18: the
 * crisis's swing, murder-rules.mjs `wearSwing` through use-items.mjs `breakOnDespair`): whether it is
 * broken, its durability and the wear counted on are read off it, and the wear is written to
 * `item`, the document - so a mend or a tier a player's console wrote on the document a moment
 * before neither spares the weapon nor stretches its durability.
 *
 * @returns {Promise<{worn: number, left: number, broke: boolean}|null>}
 */
export async function wearItem(item, { reason = "gmRuling", ref = null, held = item } = {}) {
    if (!item || isBroken(held)) return null;

    const total = durabilityOf(held);
    const worn = Math.min(total, wearOf(held) + 1);

    if (worn >= total) {
        const broke = await breakItem(item, { reason, ref });
        return { worn: total, left: 0, broke };
    }

    try {
        await trustedWrite(item, { [`flags.${MODULE_ID}.${ITEM_FLAGS.wear}`]: worn }, { reason, ref });
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
 * clean-up and every Usable Item. Also puts the thing DOWN - a ruined tool that
 * is still marked as readied would go on arming its owner in the incident
 * engine, which reads `equippedIn`.
 *
 * Idempotent: breaking what is already broken changes nothing and reports
 * success, because the caller's intent - "this is used up now" - is satisfied.
 * Already broken means broken as the GMs hold it as well (E29 fix r2-H21,
 * sheet-audit.mjs `itemsHeldNow`, whose note names the callers): a `broken`
 * a player's write put on the document and the GMs' mark does not hold is
 * written over by this break, so the mark holds the break the caller reports.
 * On a player's browser, which holds no mark, the document is the record.
 *
 * `reason` and `ref` as `wearItem`'s.
 *
 * @returns {Promise<boolean>} whether the item is now broken.
 */
export async function breakItem(item, { reason = "gmRuling", ref = null } = {}) {
    if (!item) return false;
    const { itemsHeldNow } = await import("./sheet-audit.mjs");
    const held = item.parent ? itemsHeldNow(item.parent).find(each => each.id === item.id) : null;
    if (isBroken(item) && isBroken(held ?? item)) return true;

    try {
        // One write, two facts. Written through `update` rather than two
        // `setFlag` calls so a sheet cannot render between them and show a
        // broken tool that is still in somebody's hand.
        await trustedWrite(item, {
            [`flags.${MODULE_ID}.${ITEM_FLAGS.broken}`]: { at: Date.now() },
            [`flags.${MODULE_ID}.equipped`]: false
        }, { reason, ref });
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
 * Two of these never existed in Foundry v14 at all - they were the module's
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
 * The icons ship inside the module, so nothing is uploaded anywhere - update
 * the module and the files are on the server. What this fixes is everything
 * made BEFORE that: items already in somebody's bag and rows already written
 * into the item tables, which kept whatever picture they were created with.
 *
 * IT LOOKS FIRST AND REFUSES TO GUESS. Only a picture the module itself put
 * there - or none at all - is replaced; a Truth Bullet wearing the photograph
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
 * The stash does not count against the limit - that is the whole point of one.
 * The guide caps what you have on you, not what you own.
 */
export function countInCategory(actor, category) {
    return actor.items.filter(i =>
        i.getFlag(MODULE_ID, ITEM_FLAGS.category) === category && !isStashed(i)).length;
}

/**
 * The item categories a form may offer, decided in ONE place (audit A22-A24).
 *
 * Four windows built this list for themselves, each with its own filter over
 * `ITEM_CATEGORIES`, and only one of them kept up with the rules. Give / take
 * items split usables into Healing and Sanity Relief when that split became
 * what a usable DOES; the Item Tables editor, the trap's plant dialog and Room
 * Setup's "good place to look for" did not, so all three went on offering one
 * flat "Usable" - which resolves to the retired mixed tier pool - and two of
 * them offered "Room Key", an item that means nothing without a room flag the
 * form has no field for.
 *
 * Returned as descriptors rather than `<option>` markup because the callers
 * differ in what they put on a row: Give / take items appends a carry count,
 * Room Setup renders checkboxes rather than a select.
 *
 * @param {object} [options]
 * @param {boolean} [options.splitUsables]  Offer `usable:healing` and
 *   `usable:stress` separately. True wherever the answer decides what the item
 *   will DO; false where the caller only has a category to give (Search asks
 *   rooms about `usable`, not about a kind).
 * @param {boolean} [options.includeKeys]  Offer bedroom keys. Off by default:
 *   a key names a room, and a form that cannot ask which room produces a key
 *   to nowhere.
 * @param {boolean} [options.includeBullets]  Offer Truth Bullets. Off by
 *   default: they carry a secret no ordinary item form has fields for.
 * @returns {Array<{value: string, key: string, goal: string|null, label: string}>}
 */
export function pickableCategories({
    splitUsables = true, includeKeys = false, includeBullets = false
} = {}) {
    return Object.entries(ITEM_CATEGORIES)
        .filter(([key]) => (includeBullets || key !== "truthBullet")
            && (includeKeys || key !== "bedroomKey"))
        .flatMap(([key, cat]) => {
            if (key === "usable" && splitUsables) {
                return Object.entries(USABLE_KINDS).map(([goal, kind]) => ({
                    value: `${key}:${goal}`,
                    key,
                    goal,
                    label: `${cat.label} - ${kind.label}`
                }));
            }
            return [{ value: key, key, goal: null, label: cat.label }];
        });
}

/**
 * The categories that are an ordinary possession - something a student was
 * given, found or made.
 *
 * What it leaves out is the point (audit A25): a Truth Bullet is knowledge and
 * a bedroom key is a door, and neither is a thing anybody "carries" in the
 * sense the season checklist means when it asks whether everybody has their
 * opening item. Assigning a bedroom hands out a key, so counting keys made
 * every student with a room pass a test they had not been through.
 */
export function carriableCategories() {
    return pickableCategories({ splitUsables: false }).map(c => c.key);
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
 * "one more Murder Weapon?" is really "is there a free slot?" - two between the
 * weapons, the cleaning tools and the tools (G-43, Dawid 27.08; cut from three
 * to two by D10c, and one of those two has to be in a hand - see LIMIT_GROUPS).
 * A category with no group behaves exactly as it always did.
 *
 * The shape of the answer is unchanged on purpose: four callers put `limit` into
 * a refusal message, and they should not have to learn about groups to say "1 of
 * 2" instead of "1 of 1".
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
 * The category stays ONE value, because it is the key to five separate things -
 * the carry slot, the row on the sheet, the search table, what may be held
 * ready, and the mechanic - and only the last of those is what this is about.
 * So the category remains the item's HOME, and a second flag lists the other
 * roles it can fill.
 *
 * Every question of the form "is this a weapon" goes through `servesAs`; every
 * question of the form "which slot does this take" stays on the category. An
 * item costs one slot, in its home, whatever else it can do - which is only
 * fair because the slots are shared (see LIMIT_GROUPS).
 * ========================================================================== */

/** The roles this item fills beyond its home. Always an array. */
export function rolesOf(item) {
    const roles = item?.getFlag?.(MODULE_ID, ITEM_FLAGS.roles);
    return Array.isArray(roles) ? roles : [];
}

/** Can this item do the job of `role` - either as its home or as a role? */
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
 * Refuses when the category is full rather than silently exceeding the limit -
 * the carry limits (see LIMIT_GROUPS: one shared two-slot Gear group) are the rule.
 *
 * @param {object} [options.extraFlags]  Further module flags written in the same
 *   creation. Truth Bullets carry a good deal more than a category and a tier,
 *   and patching them on afterwards would leave a moment - one database write
 *   long, but a real one - where a Truth Bullet exists with no type at all.
 * @param {string} [options.reason]  the creation's reason and `ref`, as `wearItem`'s
 * @param {object} [options.counted]  the receiver as the GMs hold its items (sheet-audit.mjs
 *   `actorAsHeld`), where a GM's copy road read it so (E29 fix r2-H18): the carry cap is
 *   counted on it rather than on `actor`'s document, which a player's console can have
 *   written a moment before - a slot emptied by a stash its put-back undoes. The item is
 *   still created on `actor`.
 * @returns {Promise<Item|null>}
 */
export async function grantItem(actor, {
    name, category, tier, goal = null, description = "", override = false, img = null,
    roles = null, extraFlags = {}, location = LOCATIONS.carried, quiet = false, reason = "gmRuling", ref = null,
    counted = null
}) {
    if (!actor || !name) return null;

    // Set only when a full inventory pushes this into a stash - see below.
    // `null` for everything else, including an item granted straight into a
    // stash by a caller, which means the owner's primary and says so by
    // leaving the flag off.
    let overflowRoom = null;

    // Search hands its goal straight through ("healing", "stress" - but also
    // "crimeTool", which is not a usable kind). A usable granted with no goal
    // - the GM's console, a season's starting item - asks the item tables for
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

    const room = canCarry(counted ?? actor, category);
    if (!room.ok && location !== LOCATIONS.vault) {
        // A GM handing something over outranks the cap - they are making a
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
            // are full - it goes in your stash. Refusing outright is only right
            // when there is no stash to put it in.
            // WHICH stash the overflow lands in, not merely whether one
            // exists: an unaddressed item would otherwise be read as living in
            // whichever stash `primaryStashRoom` happens to answer later, and
            // that answer can change when a GM adds or removes one.
            // On the scene the character stands on, else the school's (E12 C3): the camera's
            // until then, so the overflow went to whatever stash the granting GM had on screen.
            const { primaryStashRoom } = await import("./vault.mjs");
            const { locateActor } = await import("./movement.mjs");
            const { homeScene } = await import("./rooms.mjs");
            overflowRoom = primaryStashRoom(actor, locateActor(actor)?.scene ?? homeScene());
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
        const [item] = await trustedCreate(actor, [{
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
                    // EVERY item, not only the interesting ones - see the note
                    // on `ITEM_FLAGS.identity`. Before `extraFlags` so a caller
                    // that already has an identity for this thing (a planted
                    // trap item, a hand-over carrying `preservedFlags`) keeps
                    // theirs rather than being given a second one.
                    [ITEM_FLAGS.identity]: newItemIdentity(),
                    ...extraFlags
                }
            }
        }], {
            reason, ref,
            [CAP_OVERRIDE]: override,
            /*
             * `quiet` SUPPRESSES THE RECEIVER'S RE-RENDER, and it exists for
             * exactly one caller: a Plant nobody noticed (`plantOnPerson`).
             * Foundry carries this option over its own socket, so the sheet on
             * the victim's screen does not redraw FOR THIS CHANGE - the item is
             * really there, and what is suppressed is the refresh.
             *
             * The mirror of the silent Steal's `item.delete({ render: false })`,
             * and the same promise: not "they will never see", but "they will
             * not see because of this".
             */
            ...(quiet ? { render: false } : {})
        });

        log(`${actor.name} gained ${name} (${category}${hasTier ? `, Tier ${tier}` : ""}).`);
        if (item && location === LOCATIONS.carried) await keepGearShape(actor, item);
        return item ?? null;
    } catch (err) {
        warn("Could not create the item", err);
        return null;
    }
}

/**
 * ONE IN A HAND, ONE STOWED, NEVER TWO STOWED - on the way IN as well (D4,
 * Dawid 13.09; audit ITEM-04).
 *
 * `LIMIT_GROUPS.gear.maxStowed` used to be enforced in one place: putting the
 * readied item down was refused while the other was stowed. Every way a piece
 * of Gear ARRIVES - a Search, a give, a handover, a theft, a plant, the stash -
 * only counted the two slots, so a character who never readied anything
 * carried two stowed tools indefinitely, which is the state the rule forbids.
 *
 * So the arriving item goes into the hand when the shape needs it, and the
 * owner is told which - it changes what the incident engine reads as "the
 * weapon in hand" (`equippedFor`), and that is not a thing to change quietly.
 */
export async function keepGearShape(actor, item) {
    try {
        const category = item?.getFlag(MODULE_ID, ITEM_FLAGS.category);
        const group = ITEM_CATEGORIES[category]?.limitGroup;
        const max = group ? LIMIT_GROUPS[group]?.maxStowed : null;
        if (max === null || max === undefined) return false;
        const { stowedInGroup, isEquipped, toggleEquipped } = await import("./use-items.mjs");
        if (isEquipped(item)) return false;
        if (stowedInGroup(actor, group).length <= max) return false;
        if (!await toggleEquipped(actor, item)) return false;
        await whisperToOwner(actor, `<p>${game.i18n.format("DRPG.Items.autoReadied", {
            item: foundry.utils.escapeHTML(item.name), group: LIMIT_GROUPS[group].label
        })}</p>`);
        return true;
    } catch (err) {
        error("Could not keep the Gear shape", err);
        return false;
    }
}

/* ==========================================================================
 * ONE ROAD FOR AN ITEM THAT CHANGES OWNER (E35 C1, 24.10.2026; audit S17-16, S08-37, S08-38; D42 option 1)
 * --------------------------------------------------------------------------
 * A give, a body's loot, a stash rifled, a Palm's steal and a Plant each moved an item by a pair of its own -
 * `grantItem` on the taker, then a bare `delete()` on the giver - five times over (handover.mjs `giveItem`,
 * `lootBody`; vault.mjs `stealFromVault`, `stealFromPerson`, `plantOnPerson`), each with its own overflow, flags and
 * messages, and none read `system.quantity`: a stack of three handed over arrived as one and left nothing behind
 * (S08-37). They meet here, on a GM: one hands-full policy (`TRANSFER_POLICY`), one piece a move, one key rule, one
 * whisper to the GMs when the giver's piece could not be taken off, one result.
 *
 * WHAT MOVES is the GMs' reading when the step runs (sheet-audit.mjs `itemAsHeld`, `actorAsHeld`, after
 * `judgedFor`), never the document a player's browser may just have written: the count, the flags `preservedFlags`
 * carries and the taker's hands. So a count a console raised and the GMs put back moves as the GMs hold it.
 *
 * ONE CHAIN PER GIVER (utils.mjs `serialWrite`, E80 C0's; E36 takes it over): a second transfer from the same sheet
 * waits for the first, then reads the item gone (`missing`). Two GMs on two browsers are not chained (E36, E38).
 *
 * The callers keep their gates and their words (who may ask, a body, a roll, a room); this function decides nothing
 * a gate decides, and adds no reason of WRITE_REASONS: every write here names "gmRuling".
 * ========================================================================== */

/**
 * What a full pair of hands does to each mode (D42, the owner's option 1): a give and a Plant are refused - the item
 * stays with the one giving it - and a loot, a stash rifled and a steal go to the taker's stash, as `grantItem` puts
 * them, and are refused only where the taker has none. Frisk moves nothing and is no mode (the owner, 13.10).
 */
export const TRANSFER_POLICY = Object.freeze({ give: "refuse", loot: "overflow", rifle: "overflow", steal: "overflow", plant: "refuse" });

/** The GMs' line, per mode, when the taker has the piece and the giver could not be relieved of theirs (S08-38: a body's said "handed over"). */
export const TRANSFER_STUCK = Object.freeze({
    give: "DRPG.Handover.stuckFor.give", loot: "DRPG.Handover.stuckFor.loot", rifle: "DRPG.Handover.stuckFor.rifle",
    steal: "DRPG.Handover.stuckFor.steal", plant: "DRPG.Handover.stuckFor.plant"
});

/**
 * Move one piece of `item` from `from` to `to`, on a GM, as `mode` (a key of TRANSFER_POLICY).
 *
 * `quiet` is an unseen Plant's or steal's: the victim's sheet - the taker's on a Plant, the giver's on a steal or a
 * rifle - is not redrawn for this write (`render: false`, the mirror of what `grantItem`'s `quiet` does), and the key
 * rule tells nobody. `grantItem`'s overflow whisper and `keepGearShape`'s still speak until C3 hands them `quiet`
 * (S08-02): no road that passes `quiet` is on this function before C3.
 *
 * One piece of a stack carries the stack's identity (`preservedFlags`), so the piece moved and the pieces left share
 * one `drpgItemId` - read in the code, not decided by a test: a trap's plant is found by `grantItem`, which writes a
 * count of one (action-rolls.mjs, reroll.mjs `settleSearch`).
 *
 * Answers one of:
 *   `{ ok: true, copy, left, keyHeld, stuck }` - `copy` the taker's new item (null under the key rule), `left` the
 *     pieces the giver still holds, `keyHeld` the room of a key the taker already held, `stuck` true when the
 *     giver's piece could not be taken off (the GMs are told);
 *   `{ handsFull: { held, limit, category } }` - refused by the policy, or no stash to overflow into; nothing written;
 *   `{ missing: true }` - the item is not on the giver, or not where this mode takes it from (a stash for a rifle,
 *     the hands for the rest): a second ask after the first moved it;
 *   `{ failed: true }` - the copy or the key's removal was not made; nothing changed hands;
 *   `{ refused }` - asked of no mode, or of one sheet to itself;
 *   null on a player's browser.
 */
export async function transferItem(from, to, item, { mode, quiet = false } = {}) {
    if (!game.user.isGM) return null;
    const policy = TRANSFER_POLICY[mode];
    const id = typeof item === "string" ? item : item?.id;
    if (!policy || !from?.id || !to?.id || from.id === to.id || !id) {
        return { refused: `no transfer of that kind (${String(mode)}) between those two` };
    }
    return serialWrite(`transfer/${from.id}`, async () => {
        const { itemAsHeld, actorAsHeld, judgedFor } = await import("./sheet-audit.mjs");
        // One wait for both students, then each read finds its queue empty: what moves and the hands it lands in are
        // read in the same moment (E29 fix r2-H17, r2-H18).
        await judgedFor(from.id, to.id);
        const held = await itemAsHeld(from, id);
        const counted = await actorAsHeld(to);
        const doc = from.items?.get(id) ?? null;
        if (!held || !doc || isStashed(held) !== (mode === "rifle")) return { missing: true };
        const category = held.getFlag(MODULE_ID, ITEM_FLAGS.category);
        if (!category) return { missing: true };
        const name = held.name;
        // The count as the GMs hold it; a document with none, or less than one, is one piece.
        const pieces = Math.max(1, Math.floor(Number(held.system?.quantity)) || 1);
        const hushFrom = quiet && mode !== "plant", hushTo = quiet && mode === "plant";

        // One piece off the giver: the count lowered by one where there are more, else the item deleted. Read back,
        // because a refused write (a pre-hook's false) resolves as quietly as one that landed.
        const takeOne = async () => {
            const render = hushFrom ? { render: false } : {};
            try {
                if (pieces > 1) {
                    await trustedWrite(doc, { "system.quantity": pieces - 1 }, { reason: "gmRuling", ...render });
                    return Number(from.items?.get(id)?.system?.quantity) === pieces - 1;
                }
                await trustedDelete(doc, { reason: "gmRuling", ...render });
                return !from.items?.has(id);
            } catch (err) {
                error(`Could not take "${name}" off ${from.name}`, err);
                return false;
            }
        };

        // THE KEY RULE (S08-38, E35-09): a key to a room the taker already holds is not copied - two rows under Room
        // Keys open one door - and leaves the giver all the same; the taker is told once, unless this is unseen.
        const keyRoom = held.getFlag(MODULE_ID, BEDROOM_KEY_FLAG);
        if (keyRoom) {
            const { keysHeldBy } = await import("./vault.mjs");
            if (keysHeldBy(to).has(keyRoom)) {
                if (!await takeOne()) return { failed: true };
                if (!quiet) {
                    await whisperToOwner(to, `<p>${game.i18n.format("DRPG.Handover.keyAlreadyHeld", {
                        room: foundry.utils.escapeHTML(keyRoom)
                    })}</p>`);
                }
                log(`${to.name} already held a key to ${keyRoom}; the one from ${from.name} was not copied.`);
                return { ok: true, copy: null, left: pieces - 1, keyHeld: keyRoom, stuck: false };
            }
        }

        const room = canCarry(counted, category);
        const full = { handsFull: { held: room.held, limit: room.limit, category } };
        if (!room.ok && policy === "refuse") return full;

        const copy = await grantItem(to, {
            reason: "gmRuling",
            name,
            category,
            tier: held.getFlag(MODULE_ID, ITEM_FLAGS.tier) ?? null,
            description: held.system?.description ?? "",
            img: held.img,
            // Broken, wear, roles, identity, kind and a key's room, as the GMs hold them.
            extraFlags: preservedFlags(held),
            counted,
            quiet: hushTo
        });
        if (!copy) return room.ok ? { failed: true } : full;

        const removed = await takeOne();
        if (!removed) {
            await whisperToGms(`<p class="drpg-warning">${game.i18n.format(TRANSFER_STUCK[mode], {
                name: foundry.utils.escapeHTML(name),
                from: foundry.utils.escapeHTML(from.name),
                to: foundry.utils.escapeHTML(to.name)
            })}</p>`);
        }
        return { ok: true, copy, left: removed ? pieces - 1 : pieces, keyHeld: null, stuck: !removed };
    });
}

/**
 * Enforce the carry limits when items arrive by any other route - dragged from
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
            category: capacityLabel(category),
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
 * Trap 69: four screens put a limit in front of somebody - the sheet's rows,
 * this summary, the item manager and the refusal message - and with a shared
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
