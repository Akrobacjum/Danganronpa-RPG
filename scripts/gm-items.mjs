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
    MODULE_ID, ITEM_CATEGORIES, LIMIT_GROUPS, ITEM_TIERS, TIER_EFFECTS, USABLE_KINDS,
    USABLE_KIND_EFFECTS,
    TRUTH_BULLET_TYPES, REMNANT_VISIBILITY, REMNANT_VISIBILITY_LABELS
} from "./config.mjs";
import { grantItem, itemsInCategory, countInCategory, countInGroup, inventorySummary }
    from "./inventory.mjs";
import { createTruthBullet, issueAutopsy, BULLET_CATEGORY } from "./truth-bullets.mjs";
import { ITEM_POOLS, USABLE_GOALS, moduleTables } from "./tables.mjs";
import { studentActors } from "./monokuma.mjs";
import { whisperToOwner, dialogContent, panelTabs, wirePanelTabs, log, error, plural, cardHead }
    from "./utils.mjs";

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
    /*
     * CANCELLING A STEP COMES BACK HERE (D-F5-2).
     *
     * Every branch used to read `made ? openItemManager(target) : null`, so
     * succeeding returned to the hub and CANCELLING closed the whole thing —
     * and with it the character this window is about. A GM who opened Give,
     * thought better of it and pressed Cancel was put back in the GM panel
     * having to pick the student again, which is the one thing the hub exists
     * to save them.
     *
     * Two different depths for the same gesture, and the wrong one was the
     * cheaper to reach. Now every step returns to the hub whatever the answer,
     * and the hub's own Close is the single way out — one exit, at the level
     * the GM opened.
     */
    if (choice === "give") {
        await giveItemDialog(target);
        // Straight back to the manager, so handing over three things is three
        // clicks rather than three trips through the menu.
        return openItemManager(target);
    }
    if (choice === "bullet") {
        await giveTruthBulletDialog(target);
        return openItemManager(target);
    }
    if (choice === "key") {
        await giveKeyDialog(target);
        return openItemManager(target);
    }
    if (choice === "take") {
        await takeItemDialog(target);
        return openItemManager(target);
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
        .flatMap(([key, cat]) => {
            // The shared budget, where there is one: three rows drawing on
            // three slots have to show the same number, or the GM reads "1/1"
            // beside a free slot and believes it. See `capacityLabel`.
            const group = cat.limitGroup ?? null;
            const held = group ? countInGroup(actor, group) : countInCategory(actor, key);
            const limit = group ? LIMIT_GROUPS[group]?.limit : cat.limit;
            const cap = limit ? ` — ${held}/${limit}` : ` — ${held}`;
            // A usable is a healing or a stress-relief item — that decides what
            // it does when drunk, so the GM says which here rather than the
            // player being asked later. Both halves share the one carry count:
            // the inventory does not split the category, only the effect does.
            if (key === "usable") {
                return Object.entries(USABLE_KINDS).map(([kind, def]) =>
                    `<option value="${key}:${kind}">${foundry.utils.escapeHTML(
                        `${cat.label} — ${def.label}`)}${cap}</option>`);
            }
            return [`<option value="${key}">${foundry.utils.escapeHTML(cat.label)}${cap}</option>`];
        }).join("");

    const tiers = ITEM_TIERS
        .map(t => `<option value="${t}"${t === 2 ? " selected" : ""}>${
            game.i18n.format("DRPG.Items.tierN", { n: t })
        }</option>`).join("");

    // Every built-in name, offered as autocomplete. The GM can type anything.
    const suggestions = Array.from(new Set([
        ...Object.values(ITEM_POOLS).flatMap(byTier => Object.values(byTier).flat()),
        ...Object.values(USABLE_GOALS).flatMap(({ pool }) => Object.values(pool).flat())
    ])).sort();

    // THE CATALOGUE — the item tables read the other way round: not "what can
    // a Search produce" but "what is there to hand over". Giving from here is
    // what keeps a hand-out consistent with the world: the entry's own icon
    // and description come along, and a usable's kind is whatever its table
    // already says. (Dawid, 2026-08-26: create-new was the only mode, so every
    // give retyped an item the tables already knew.)
    const esc = s => foundry.utils.escapeHTML(String(s ?? ""));
    const catalogue = moduleTables().filter(t => t.results.size);
    const catalogueOptions = catalogue.map(table => {
        const cat = table.getFlag(MODULE_ID, "category") ?? "";
        const tier = table.getFlag(MODULE_ID, "tier");
        const goal = table.getFlag(MODULE_ID, "goal") ?? "";
        return `<optgroup label="${esc(table.name)}">${Array.from(table.results).map(r =>
            `<option value="${table.id}:${r.id}" data-category="${esc(cat)}" data-tier="${
                tier ?? ""}" data-goal="${esc(goal)}">${esc(r.name ?? r.text ?? "")}</option>`
        ).join("")}</optgroup>`;
    }).join("");

    const existingPane = catalogue.length
        ? `<label>${game.i18n.localize("DRPG.Items.pickExisting")}
                <select name="existing">${catalogueOptions}</select></label>
            <label>${game.i18n.localize("DRPG.Items.category")}
                <select name="exCategory">${categories}</select></label>
            <label>${game.i18n.localize("DRPG.Items.tier")}
                <select name="exTier">${tiers}</select></label>
            <p class="notes">${game.i18n.localize("DRPG.Items.existingNote")}</p>`
        : `<p class="notes">${game.i18n.localize("DRPG.Items.existingEmpty")}</p>`;

    const result = await DialogV2.wait({
        window: { title: game.i18n.format("DRPG.Items.giveTo", { actor: actor.name }) },
        classes: ["drpg-panel"],
        // Two tabs, one verb (Dawid, 2026-08-26). The footer's Give reads
        // whichever pane is showing; the tell-player switch and the cap note
        // sit below the tabs because they are true of both.
        content: dialogContent(`<form>${panelTabs([
            { key: "existing", label: game.i18n.localize("DRPG.Items.tabGiveExisting"),
              html: existingPane },
            { key: "create", label: game.i18n.localize("DRPG.Items.tabCreateNew"), html: `
            <label>${game.i18n.localize("DRPG.Items.category")}
                <select name="category">${categories}</select></label>
            <label>${game.i18n.localize("DRPG.Items.tier")}
                <select name="tier">${tiers}</select></label>
            <label>${game.i18n.localize("DRPG.Items.name")}
                <input type="text" name="name" list="drpg-item-names"
                       placeholder="${game.i18n.localize("DRPG.Items.namePlaceholder")}" /></label>
            <datalist id="drpg-item-names">${
                suggestions.map(n => `<option value="${esc(n)}"></option>`).join("")
            }</datalist>
            <label>${game.i18n.localize("DRPG.Items.description")}
                <textarea name="description" rows="2"
                    placeholder="${game.i18n.localize("DRPG.Items.descriptionPlaceholder")}"></textarea></label>` }
        ])}
            <label class="drpg-checkbox">
                <input type="checkbox" name="tell" checked />
                ${game.i18n.localize("DRPG.Items.tellPlayer")}</label>
            <p class="notes">${game.i18n.localize("DRPG.Items.overCapNote")}</p>
        </form>`),
        render: (event, dialog) => {
            wirePanelTabs(dialog.element);

            // The picked entry announces its table's category, tier and kind,
            // and the two selects follow. They stay editable: a room pool's
            // table says nothing, and there the GM's choice is the only one.
            const form = dialog.element.querySelector("form");
            const existing = form?.elements?.existing;
            if (!existing) return;
            const sync = () => {
                const opt = existing.selectedOptions?.[0];
                if (!opt) return;
                const { category, tier, goal } = opt.dataset;
                if (category) {
                    const value = category === "usable" && goal ? `${category}:${goal}` : category;
                    if (form.elements.exCategory.querySelector(`option[value="${CSS.escape(value)}"]`)) {
                        form.elements.exCategory.value = value;
                    }
                }
                if (tier !== "") form.elements.exTier.value = tier;
            };
            existing.addEventListener("change", sync);
            sync();
        },
        buttons: [
            {
                action: "ok", label: game.i18n.localize("DRPG.Items.give"), default: true,
                callback: (e, b, d) => {
                    const f = d.element.querySelector("form");
                    const active = d.element.querySelector(".drpg-gmt-section.active")
                        ?.dataset.drpgGmtSection ?? "create";

                    if (active === "existing" && f.elements.existing) {
                        const [tableId, resultId] = f.elements.existing.value.split(":");
                        const [category, kind = null] = f.elements.exCategory.value.split(":");
                        return { mode: "existing", tableId, resultId, category, kind,
                                 tier: Number(f.elements.exTier.value), tell: f.elements.tell.checked };
                    }

                    // "usable:healing" carries the kind after the colon; the
                    // plain categories have nothing to split.
                    const [category, kind = null] = f.elements.category.value.split(":");
                    return {
                        mode: "create",
                        category,
                        kind,
                        tier: Number(f.elements.tier.value),
                        name: f.elements.name.value.trim(),
                        description: f.elements.description.value.trim(),
                        tell: f.elements.tell.checked
                    };
                }
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    if (!result || result === "cancel") return false;

    // Both tabs funnel into one shape, so everything below — the grant, the
    // receipt, the log line — cannot diverge between them.
    let give;
    if (result.mode === "existing") {
        const entry = game.tables.get(result.tableId)?.results?.get(result.resultId);
        if (!entry) {
            ui.notifications.error(game.i18n.localize("DRPG.Items.failed"));
            return false;
        }
        const name = entry.name ?? entry.text ?? "";
        give = {
            name,
            category: result.category,
            kind: result.kind,
            tier: result.tier,
            // The same rule drawItem applies: a description that is only the
            // name again adds nothing over the tier line the item will get.
            description: entry.description && entry.description !== name ? entry.description : "",
            img: entry.img ?? null
        };
    } else {
        if (!result.name) {
            ui.notifications.warn(game.i18n.localize("DRPG.Items.needsName"));
            return false;
        }
        give = { ...result, img: null };
    }

    const item = await grantItem(actor, {
        name: give.name,
        category: give.category,
        tier: give.tier,
        goal: give.kind,
        img: give.img,
        description: give.description
            ? `<p>${esc(give.description)}</p>`
            : "",
        // A GM handing something over outranks the carry limit.
        override: true
    });

    if (!item) {
        ui.notifications.error(game.i18n.localize("DRPG.Items.failed"));
        return false;
    }

    log(`GM gave ${actor.name} "${give.name}" (${give.category}, Tier ${give.tier}).`);
    ui.notifications.info(game.i18n.format("DRPG.Items.gave", {
        item: give.name, actor: actor.name
    }));

    if (result.tell) {
        const effect = USABLE_KIND_EFFECTS[give.kind]?.[give.tier]
            ?? TIER_EFFECTS[give.category]?.[give.tier] ?? "";
        const label = USABLE_KINDS[give.kind]
            ? `${ITEM_CATEGORIES[give.category]?.label} — ${USABLE_KINDS[give.kind].label}`
            : ITEM_CATEGORIES[give.category]?.label ?? give.category;
        await whisperToOwner(actor, `
            <h3>${game.i18n.localize("DRPG.Items.received")}</h3>
            <p><strong>${esc(give.name)}</strong> — ${esc(label)
            }, ${game.i18n.format("DRPG.Items.tierN", { n: give.tier })}</p>
            ${give.description ? `<p>${esc(give.description)}</p>` : ""}
            ${effect ? `<p><em>${esc(effect)}</em></p>` : ""}`);
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
            <label class="drpg-checkbox">
                <input type="checkbox" name="tied" />
                ${game.i18n.localize("DRPG.TruthBullet.tiedField")}</label>
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
                        tied: f.tied.checked,
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
        // The GM's manual verdict (Dawid, 26.08). Into the bullet's secret at
        // creation; public on the item only once identified, like every tie.
        tiedToCrime: result.tied,
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
