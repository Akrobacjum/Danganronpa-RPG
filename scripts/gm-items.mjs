/**
 * Danganronpa RPG — the GM hands things out, and takes them away.
 * ---------------------------------------------------------------------------
 * Search puts items into an inventory on its own, but plenty of things arrive
 * by other routes: a project that produced a tool, a reward, a Truth Bullet the
 * GM is issuing for a Remnant somebody Observed, or a crime tool being confiscated
 * after the trial. All of those were console work before this.
 *
 * Truth Bullets matter most here. They are the one category nothing in the module
 * creates automatically, so until the investigation loop exists this dialog is
 * how evidence reaches a player's sheet — and it writes the same category flag
 * the sheet groups on, which is exactly what the old hand-rolled macro did not.
 */

import {
    MODULE_ID, ITEM_CATEGORIES, ITEM_TIERS, TIER_EFFECTS,
    TRUTH_BULLET_TYPES, REMNANT_VISIBILITY, REMNANT_VISIBILITY_LABELS
} from "./config.mjs";
import { grantItem, itemsInCategory, countInCategory, inventorySummary } from "./inventory.mjs";
import { createTruthBullet, issueAutopsy, BULLET_CATEGORY } from "./truth-bullets.mjs";
import { ITEM_POOLS } from "./tables.mjs";
import { studentActors } from "./monokuma.mjs";
import { whisperToOwner, dialogContent, log, error, plural, cardHead } from "./utils.mjs";

const DialogV2 = foundry.applications.api.DialogV2;

/* ==========================================================================
 * ENTRY POINT
 * ========================================================================== */

/**
 * Open the item manager. GM only.
 *
 * @param {Actor} [actor]  Skip the character picker when the caller knows who.
 */
export async function openItemManager(actor = null) {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    const target = actor ?? await pickCharacter();
    if (!target) return null;

    const choice = await DialogV2.wait({
        window: { title: game.i18n.format("DRPG.Items.title", { actor: target.name }) },
        classes: ["drpg-panel"],
        content: `<div>
            <p><strong>${foundry.utils.escapeHTML(target.name)}</strong></p>
            <p class="notes">${foundry.utils.escapeHTML(inventorySummary(target))}</p>
        </div>`,
        buttons: [
            { action: "give", label: game.i18n.localize("DRPG.Items.give"), default: true },
            { action: "bullet", label: game.i18n.localize("DRPG.TruthBullet.give") },
            // A key is not something to type a name for — it names a room, and
            // the rooms are already on the map. See the note on keys in
            // vault.mjs; this is the GM's way to hand somebody a copy of
            // another player's key without either player being involved.
            { action: "key", label: game.i18n.localize("DRPG.Vault.giveKey") },
            { action: "take", label: game.i18n.localize("DRPG.Items.take") },
            // A stashed item is an ordinary item on its owner's sheet, which is
            // exactly what this window edits — so the inspector is a button on
            // it rather than a tile of its own in the GM panel.
            { action: "stashes", label: game.i18n.localize("DRPG.Vault.inspectTitle") },
            { action: "cancel", label: game.i18n.localize("DRPG.Panel.close") }
        ],
        rejectClose: false
    });

    if (choice === "stashes") {
        const { openVaultInspector } = await import("./vault.mjs");
        await openVaultInspector();
        return openItemManager(target);
    }
    if (choice === "give") {
        const made = await giveItemDialog(target);
        // Straight back to the manager, so handing over three things is three
        // clicks rather than three trips through the menu.
        return made ? openItemManager(target) : null;
    }
    if (choice === "bullet") {
        const made = await giveTruthBulletDialog(target);
        return made ? openItemManager(target) : null;
    }
    if (choice === "key") {
        const given = await giveKeyDialog(target);
        return given ? openItemManager(target) : null;
    }
    if (choice === "take") {
        const taken = await takeItemDialog(target);
        return taken ? openItemManager(target) : null;
    }
    return null;
}

/**
 * Hand this character a key to somebody's bedroom.
 *
 * Only rooms that HAVE an owner are offered: a room nobody sleeps in is not a
 * bedroom and its door is not shut in the first place, so a key to it would
 * open nothing. Each option says whose room it is, because "Room 3" is not how
 * anybody at the table refers to it.
 */
async function giveKeyDialog(actor) {
    const { allVaults, grantBedroomKey, keysHeldBy } = await import("./vault.mjs");

    const held = keysHeldBy(actor);
    const rooms = allVaults()
        .filter(v => v.owner && v.owner.id !== actor.id && !held.has(v.room));

    if (!rooms.length) {
        ui.notifications.info(game.i18n.localize("DRPG.Vault.noKeysToGive"));
        return false;
    }

    const options = rooms.map(v =>
        `<option value="${foundry.utils.escapeHTML(v.room)}">${
            foundry.utils.escapeHTML(v.room)} — ${
            foundry.utils.escapeHTML(v.owner.name)}</option>`).join("");

    const room = await DialogV2.wait({
        window: { title: game.i18n.format("DRPG.Vault.giveKeyTo", { actor: actor.name }) },
        classes: ["drpg-panel"],
        content: dialogContent(`<form>
            <label>${game.i18n.localize("DRPG.Vault.whichKey")}
                <select name="room">${options}</select></label>
            <p class="notes">${game.i18n.localize("DRPG.Vault.giveKeyNote")}</p>
        </form>`),
        buttons: [
            {
                action: "ok", label: game.i18n.localize("DRPG.Items.give"), default: true,
                callback: (e, b, d) => d.element.querySelector("[name=room]").value
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    if (!room || room === "cancel") return false;

    const made = await grantBedroomKey(actor, room);
    if (made) {
        ui.notifications.info(game.i18n.format("DRPG.Vault.keyGivenGm",
            { room, actor: actor.name }));
    }
    return Boolean(made);
}

/** Which student. Monokumas are excluded — they carry nothing. */
async function pickCharacter() {
    const actors = studentActors();
    if (!actors.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.noCharacters"));
        return null;
    }

    // The name alone. The options used to append `inventorySummary`, which
    // made every row a full line of counts — the same information the give
    // dialog already shows for the chosen character, one step later, where it
    // is actually needed (Dawid, 26.08).
    const options = actors
        .map(a => `<option value="${a.id}">${foundry.utils.escapeHTML(a.name)}</option>`)
        .join("");

    const id = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Items.whichCharacter") },
        classes: ["drpg-panel"],
        content: `<form><label>${game.i18n.localize("DRPG.Items.whichCharacter")}
                    <select name="actor">${options}</select></label></form>`,
        buttons: [
            {
                action: "ok", label: game.i18n.localize("DRPG.Action.proceed"), default: true,
                callback: (e, b, d) => d.element.querySelector("[name=actor]").value
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    if (!id || id === "cancel") return null;
    return game.actors.get(id) ?? null;
}

/* ==========================================================================
 * GIVING
 * ========================================================================== */

/**
 * Hand over one item.
 *
 * The carry limit is shown rather than silently enforced: a GM putting something
 * on a sheet is making a ruling, and being told "Crime Tools 1/1" is more useful
 * than being refused. Going over the cap is deliberate and flagged.
 */
export async function giveItemDialog(actor) {
    // Truth Bullets have their own dialog. They share nothing with a physical
    // item but the word "give": no tier, no carry limit, and half a dozen fields
    // this form has no place for.
    const categories = Object.entries(ITEM_CATEGORIES)
        // Truth Bullets and keys both have windows of their own: one carries a
        // secret this form has no fields for, the other names a room rather
        // than being typed. Offering either here would produce an item that
        // looks right and does nothing.
        .filter(([key]) => key !== BULLET_CATEGORY && key !== "bedroomKey")
        .map(([key, cat]) => {
            const held = countInCategory(actor, key);
            const cap = cat.limit ? ` — ${held}/${cat.limit}` : ` — ${held}`;
            return `<option value="${key}">${foundry.utils.escapeHTML(cat.label)}${cap}</option>`;
        }).join("");

    const tiers = ITEM_TIERS
        .map(t => `<option value="${t}"${t === 2 ? " selected" : ""}>${
            game.i18n.format("DRPG.Items.tierN", { n: t })
        }</option>`).join("");

    // Every built-in name, offered as autocomplete. The GM can type anything.
    const suggestions = Array.from(new Set(
        Object.values(ITEM_POOLS).flatMap(byTier => Object.values(byTier).flat())
    )).sort();

    const result = await DialogV2.wait({
        window: { title: game.i18n.format("DRPG.Items.giveTo", { actor: actor.name }) },
        classes: ["drpg-panel"],
        content: dialogContent(`<form>
            <label>${game.i18n.localize("DRPG.Items.category")}
                <select name="category">${categories}</select></label>
            <label>${game.i18n.localize("DRPG.Items.tier")}
                <select name="tier">${tiers}</select></label>
            <label>${game.i18n.localize("DRPG.Items.name")}
                <input type="text" name="name" list="drpg-item-names" autofocus
                       placeholder="${game.i18n.localize("DRPG.Items.namePlaceholder")}" /></label>
            <datalist id="drpg-item-names">${
                suggestions.map(n => `<option value="${foundry.utils.escapeHTML(n)}"></option>`).join("")
            }</datalist>
            <label>${game.i18n.localize("DRPG.Items.description")}
                <textarea name="description" rows="2"
                    placeholder="${game.i18n.localize("DRPG.Items.descriptionPlaceholder")}"></textarea></label>
            <label class="drpg-checkbox">
                <input type="checkbox" name="tell" checked />
                ${game.i18n.localize("DRPG.Items.tellPlayer")}</label>
            <p class="notes">${game.i18n.localize("DRPG.Items.overCapNote")}</p>
        </form>`),
        buttons: [
            {
                action: "ok", label: game.i18n.localize("DRPG.Items.give"), default: true,
                callback: (e, b, d) => {
                    const f = d.element.querySelector("form");
                    return {
                        category: f.category.value,
                        tier: Number(f.tier.value),
                        name: f.name.value.trim(),
                        description: f.description.value.trim(),
                        tell: f.tell.checked
                    };
                }
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    if (!result || result === "cancel") return false;
    if (!result.name) {
        ui.notifications.warn(game.i18n.localize("DRPG.Items.needsName"));
        return false;
    }

    const item = await grantItem(actor, {
        name: result.name,
        category: result.category,
        tier: result.tier,
        description: result.description
            ? `<p>${foundry.utils.escapeHTML(result.description)}</p>`
            : "",
        // A GM handing something over outranks the carry limit.
        override: true
    });

    if (!item) {
        ui.notifications.error(game.i18n.localize("DRPG.Items.failed"));
        return false;
    }

    log(`GM gave ${actor.name} "${result.name}" (${result.category}, Tier ${result.tier}).`);
    ui.notifications.info(game.i18n.format("DRPG.Items.gave", {
        item: result.name, actor: actor.name
    }));

    if (result.tell) {
        const effect = TIER_EFFECTS[result.category]?.[result.tier] ?? "";
        await whisperToOwner(actor, `
            <h3>${game.i18n.localize("DRPG.Items.received")}</h3>
            <p><strong>${foundry.utils.escapeHTML(result.name)}</strong> — ${
                foundry.utils.escapeHTML(ITEM_CATEGORIES[result.category]?.label ?? result.category)
            }, ${game.i18n.format("DRPG.Items.tierN", { n: result.tier })}</p>
            ${result.description ? `<p>${foundry.utils.escapeHTML(result.description)}</p>` : ""}
            ${effect ? `<p><em>${foundry.utils.escapeHTML(effect)}</em></p>` : ""}`);
    }

    return true;
}

/* ==========================================================================
 * TRUTH BULLETS
 * --------------------------------------------------------------------------
 * A separate dialog rather than a branch of the one above. What a bullet needs
 * — what it really is, what the player is told it is, how visible the original
 * was — has no overlap with tier and carry limits, and the two forms would have
 * had to hide each other's fields.
 * ========================================================================== */

/** Options shared by both dialogs below. */
function typeOptions(selected = "neutral") {
    return Object.entries(TRUTH_BULLET_TYPES)
        .map(([key, t]) => `<option value="${key}"${key === selected ? " selected" : ""}>${
            foundry.utils.escapeHTML(t.label)
        }</option>`).join("");
}

function visibilityOptions(selected = "evident") {
    return REMNANT_VISIBILITY
        .map(key => `<option value="${key}"${key === selected ? " selected" : ""}>${
            foundry.utils.escapeHTML(REMNANT_VISIBILITY_LABELS[key] ?? key)
        }</option>`).join("");
}

/** Hand one Truth Bullet to one character. */
async function giveTruthBulletDialog(actor) {
    const result = await DialogV2.wait({
        window: { title: game.i18n.format("DRPG.TruthBullet.giveTo", { actor: actor.name }) },
        classes: ["drpg-panel"],
        content: dialogContent(`<form>
            <label>${game.i18n.localize("DRPG.TruthBullet.name")}
                <input type="text" name="name" autofocus
                       placeholder="${game.i18n.localize("DRPG.TruthBullet.namePlaceholder")}" /></label>
            <label>${game.i18n.localize("DRPG.TruthBullet.realType")}
                <select name="realType">${typeOptions("neutral")}</select></label>
            <label>${game.i18n.localize("DRPG.TruthBullet.shown")}
                <select name="shown">
                    <option value="auto" selected>${game.i18n.localize("DRPG.TruthBullet.shownAuto")}</option>
                    <option value="neutral">${game.i18n.localize("DRPG.TruthBullet.shownNeutral")}</option>
                    <option value="real">${game.i18n.localize("DRPG.TruthBullet.shownReal")}</option>
                </select></label>
            <label>${game.i18n.localize("DRPG.TruthBullet.visibility")}
                <select name="visibility">${visibilityOptions("evident")}</select></label>
            <label class="drpg-checkbox">
                <input type="checkbox" name="faint" />
                ${game.i18n.localize("DRPG.TruthBullet.faintField")}</label>
            <label>${game.i18n.localize("DRPG.TruthBullet.playerText")}
                <textarea name="playerText" rows="2"
                    placeholder="${game.i18n.localize("DRPG.TruthBullet.playerTextPlaceholder")}"></textarea></label>
            <label>${game.i18n.localize("DRPG.TruthBullet.gmNote")}
                <textarea name="gmNote" rows="2"
                    placeholder="${game.i18n.localize("DRPG.TruthBullet.gmNotePlaceholder")}"></textarea></label>
            <label class="drpg-checkbox">
                <input type="checkbox" name="tell" checked />
                ${game.i18n.localize("DRPG.Items.tellPlayer")}</label>
            <p class="notes">${game.i18n.localize("DRPG.TruthBullet.secretNote")}</p>
        </form>`),
        buttons: [
            {
                action: "ok", label: game.i18n.localize("DRPG.TruthBullet.give"), default: true,
                callback: (e, b, d) => {
                    const f = d.element.querySelector("form");
                    return {
                        name: f.name.value.trim(),
                        realType: f.realType.value,
                        shown: f.shown.value,
                        visibility: f.visibility.value,
                        faint: f.faint.checked,
                        playerText: f.playerText.value.trim(),
                        gmNote: f.gmNote.value.trim(),
                        tell: f.tell.checked
                    };
                }
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    if (!result || result === "cancel") return false;
    if (!result.name) {
        ui.notifications.warn(game.i18n.localize("DRPG.Items.needsName"));
        return false;
    }

    // "auto" means "let the rules decide" — Key, Autopsy and Final bullets
    // arrive identified, everything else starts Neutral. See createTruthBullet.
    const shownType = result.shown === "auto" ? null
        : (result.shown === "real" ? result.realType : "neutral");

    const item = await createTruthBullet(actor, {
        name: result.name,
        realType: result.realType,
        shownType,
        visibility: result.visibility,
        faint: result.faint,
        playerText: result.playerText,
        gmNote: result.gmNote
    });

    if (!item) {
        ui.notifications.error(game.i18n.localize("DRPG.Items.failed"));
        return false;
    }

    ui.notifications.info(game.i18n.format("DRPG.TruthBullet.gave", {
        item: result.name, actor: actor.name
    }));

    if (result.tell) {
        await whisperToOwner(actor, `
            <h3>${game.i18n.localize("DRPG.TruthBullet.received")}</h3>
            <p><strong>${foundry.utils.escapeHTML(result.name)}</strong></p>
            ${result.playerText ? `<p>${foundry.utils.escapeHTML(result.playerText)}</p>` : ""}
            <p><small>${game.i18n.localize("DRPG.TruthBullet.whereToFind")}</small></p>`);
    }

    return true;
}

/**
 * The Autopsy bullet, handed to everyone at once.
 *
 * Decision D2: issued by hand, never rolled for — which is why the `autopsy`
 * column is absent from both OBSERVE_DC and ANALYZE_DC.
 *
 * Everyone still alive gets one. The dead are listed but start unticked rather
 * than hidden: a GM correcting a mis-marked death should not have to go and
 * find a different screen to do it from.
 */
export async function issueAutopsyDialog() {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return false;
    }

    const actors = studentActors();
    if (!actors.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.noCharacters"));
        return false;
    }

    const { isDeceased } = await import("./chapter.mjs");
    const rows = actors.map(a => {
        const dead = isDeceased(a);
        return `<label class="drpg-checkbox">
            <input type="checkbox" name="target" value="${a.id}"${dead ? "" : " checked"} />
            ${foundry.utils.escapeHTML(a.name)}${
                dead ? ` — <em>${game.i18n.localize("DRPG.Chapter.deadShort")}</em>` : ""
            }</label>`;
    }).join("");

    const result = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.TruthBullet.autopsyTitle") },
        classes: ["drpg-panel"],
        content: dialogContent(`<form>
            <p class="notes">${game.i18n.localize("DRPG.TruthBullet.autopsyHint")}</p>
            <label>${game.i18n.localize("DRPG.TruthBullet.name")}
                <input type="text" name="name" autofocus
                       placeholder="${game.i18n.localize("DRPG.TruthBullet.autopsyNamePlaceholder")}" /></label>
            <label>${game.i18n.localize("DRPG.TruthBullet.playerText")}
                <textarea name="playerText" rows="3"
                    placeholder="${game.i18n.localize("DRPG.TruthBullet.autopsyTextPlaceholder")}"></textarea></label>
            <label>${game.i18n.localize("DRPG.TruthBullet.gmNote")}
                <textarea name="gmNote" rows="2"
                    placeholder="${game.i18n.localize("DRPG.TruthBullet.gmNotePlaceholder")}"></textarea></label>
            <fieldset><legend>${game.i18n.localize("DRPG.TruthBullet.autopsyWho")}</legend>${rows}</fieldset>
        </form>`),
        buttons: [
            {
                action: "ok", label: game.i18n.localize("DRPG.TruthBullet.autopsyIssue"), default: true,
                callback: (e, b, d) => {
                    const f = d.element.querySelector("form");
                    return {
                        name: f.name.value.trim(),
                        playerText: f.playerText.value.trim(),
                        gmNote: f.gmNote.value.trim(),
                        targets: Array.from(f.querySelectorAll("[name=target]:checked")).map(i => i.value)
                    };
                }
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    if (!result || result === "cancel") return false;
    if (!result.targets.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.TruthBullet.autopsyNobody"));
        return false;
    }

    const name = result.name || TRUTH_BULLET_TYPES.autopsy.label;
    const issued = await issueAutopsy(
        result.targets.map(id => game.actors.get(id)).filter(Boolean),
        { name, playerText: result.playerText, gmNote: result.gmNote }
    );

    ui.notifications.info(plural("DRPG.TruthBullet.autopsyIssued", { n: issued }));
    return issued > 0;
}

/* ==========================================================================
 * TAKING AWAY
 * ========================================================================== */

/** Remove one item the module knows about. */
async function takeItemDialog(actor) {
    const owned = Object.keys(ITEM_CATEGORIES)
        .flatMap(key => itemsInCategory(actor, key).map(item => ({ item, category: key })));

    if (!owned.length) {
        ui.notifications.warn(game.i18n.format("DRPG.Items.nothingToTake", { actor: actor.name }));
        return false;
    }

    const options = owned.map(({ item, category }) => {
        // A Truth Bullet carries `tier: null` on purpose, and `!== undefined`
        // let that through — every bullet in this picker read "(Tnull)".
        const tier = item.getFlag(MODULE_ID, "tier");
        const label = `${ITEM_CATEGORIES[category]?.label ?? category} · ${item.name}${
            tier !== undefined && tier !== null ? ` (T${tier})` : ""
        }`;
        return `<option value="${item.id}">${foundry.utils.escapeHTML(label)}</option>`;
    }).join("");

    const result = await DialogV2.wait({
        window: { title: game.i18n.format("DRPG.Items.takeFrom", { actor: actor.name }) },
        classes: ["drpg-panel"],
        content: `<form>
            <label>${game.i18n.localize("DRPG.Items.whichItem")}
                <select name="item">${options}</select></label>
            <label class="drpg-checkbox">
                <input type="checkbox" name="tell" checked />
                ${game.i18n.localize("DRPG.Items.tellPlayer")}</label>
        </form>`,
        buttons: [
            {
                action: "ok", label: game.i18n.localize("DRPG.Items.take"), default: true,
                callback: (e, b, d) => {
                    const f = d.element.querySelector("form");
                    return { id: f.item.value, tell: f.tell.checked };
                }
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    if (!result || result === "cancel") return false;

    const item = actor.items.get(result.id);
    if (!item) return false;

    const name = item.name;
    // The answer key is keyed by item uuid, so deleting the item without this
    // would leave an entry nothing can ever reach or clear again.
    const uuid = item.uuid;
    try {
        await item.delete();
        const { dropSecret } = await import("./truth-bullets.mjs");
        await dropSecret(uuid);
    } catch (err) {
        error("Could not remove the item", err);
        ui.notifications.error(game.i18n.localize("DRPG.Items.failed"));
        return false;
    }

    log(`GM took "${name}" from ${actor.name}.`);
    ui.notifications.info(game.i18n.format("DRPG.Items.took", { item: name, actor: actor.name }));

    if (result.tell) {
        await whisperToOwner(actor, `${cardHead({
            action: game.i18n.localize("DRPG.Items.lostTitle")
        })}<p>${
            game.i18n.format("DRPG.Items.lost", { item: foundry.utils.escapeHTML(name) })
        }</p>`);
    }

    return true;
}
