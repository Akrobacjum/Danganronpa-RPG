/**
 * Danganronpa RPG — character sheet surgery.
 * ---------------------------------------------------------------------------
 * The guide's sheet has no class, subclass, ancestry or community. What sits
 * under the character's name is their Ultimate: "the thing this character does
 * best". Daggerheart renders that row as `.character-details`, so we replace
 * its contents with an editable Ultimate line.
 *
 * Everything else that gets removed (Loadout tab, armour, proficiency, damage
 * thresholds, the Daggerheart level pill) is handled in danganronpa.css. Only
 * the parts that need real behaviour live here.
 */

import { MODULE_ID, FLAGS, ACTIONS, STARTING, ITEM_CATEGORIES } from "./config.mjs";
import { actionsLeft, actionsMax, actionBudget, hasFreeMove, setActions } from "./actions.mjs";
import { isMonokuma, poolUserFor } from "./monokuma.mjs";
import { getDespair } from "./despair.mjs";
import { hopeHeld, hopeMax, affordableHopeCalls, despairCallsFor } from "./calls.mjs";
import { debug, error } from "./utils.mjs";

export function registerSheetTweaks() {
    // ApplicationV2 fires a render hook per class in the inheritance chain,
    // so the concrete Daggerheart sheet class name is the precise target.
    Hooks.on("renderCharacterSheet", onRenderCharacterSheet);
}

function onRenderCharacterSheet(app, element) {
    try {
        if (app?.document?.type !== "character") return;
        // CSS keys off this to grey out the parts a Monokuma does not use.
        const root = element instanceof HTMLElement ? element : element?.[0];
        root?.classList?.toggle("drpg-monokuma", isMonokuma(app.document));

        injectUltimate(app, element);
        injectAdvanceButton(app, element);
        injectActionBar(app, element);
        injectActionPanel(app, element);
        tidySidebar(element);
        tidyBiography(element);
        groupInventory(app, element);
    } catch (err) {
        error("Failed to render the Danganronpa sheet parts", err);
    }
}

/* ==========================================================================
 * ACTION BAR + TIME OF DAY
 * --------------------------------------------------------------------------
 * Daggerheart only shows extra resources inside a pop-out tooltip, which is no
 * good for something spent twice per time of day. This draws the budget right
 * next to Hope, with the current time of day beside it.
 * ========================================================================== */

function injectActionBar(app, element) {
    const row = element.querySelector(".character-header-sheet .character-row");
    if (!row || row.querySelector(".drpg-actions-section")) return;

    const actor = app.document;
    const left = actionsLeft(actor);
    const max = actionsMax(actor);
    const { wounded } = actionBudget(actor);

    const section = document.createElement("div");
    section.className = "drpg-actions-section";

    /* ---- action pips ---- */
    const actions = document.createElement("div");
    actions.className = "drpg-actions";

    const label = document.createElement("h4");
    label.textContent = game.i18n.localize("DRPG.Actions.label");
    if (wounded) {
        label.classList.add("drpg-wounded");
        label.dataset.tooltip = game.i18n.localize("DRPG.Actions.woundedTooltip");
    }
    actions.append(label);

    // Always draw the full base budget. A wounded character keeps both circles,
    // but the one they have lost shows as a locked red slot — clearer than
    // silently rendering "1 / 1", which reads like an action already spent.
    const budget = Math.max(max, 1);
    for (let i = 1; i <= Math.max(STARTING.actions, budget); i++) {
        const locked = i > budget;
        const filled = !locked && i <= left;

        const pip = document.createElement("span");
        pip.className = `drpg-action-pip${filled ? " filled" : ""}${locked ? " locked" : ""}`;
        pip.dataset.value = String(i);
        pip.innerHTML = `<i class="fa-${filled ? "solid" : "regular"} fa-circle" inert></i>`;

        if (locked) {
            pip.dataset.tooltip = game.i18n.localize("DRPG.Actions.lockedTooltip");
        } else if (game.user.isGM) {
            // GM only: players spend actions by taking actions, not by clicking.
            pip.classList.add("gm-editable");
            pip.dataset.tooltip = game.i18n.format("DRPG.Actions.pipTooltip", { n: i });
            pip.addEventListener("click", () => setActions(actor, i === left ? i - 1 : i));
        } else {
            pip.dataset.tooltip = game.i18n.format("DRPG.Actions.pipReadOnly", { left, max: budget });
        }
        actions.append(pip);
    }

    /* ---- free move ---- */
    const move = document.createElement("span");
    const freeMove = hasFreeMove(actor);
    move.className = `drpg-free-move${freeMove ? " available" : " spent"}`;
    move.dataset.tooltip = game.i18n.localize(
        freeMove ? "DRPG.Actions.freeMoveAvailable" : "DRPG.Actions.freeMoveSpent"
    );
    move.innerHTML = `<i class="fa-solid fa-shoe-prints" inert></i>`;
    actions.append(move);

    section.append(actions);

    // Sit right after Hope, before the domains/downtime buttons.
    const hope = row.querySelector(".resource-section");
    if (hope) hope.after(section);
    else row.prepend(section);
}

/* ==========================================================================
 * ADVANCEMENT BUTTON
 * --------------------------------------------------------------------------
 * The Daggerheart level pill is hidden, so advancement needs its own way in.
 * A button on the sheet beats a macro the GM has to install by hand.
 * ========================================================================== */

function injectAdvanceButton(app, element) {
    if (!game.user.isGM) return;

    const nameRow = element.querySelector(".character-header-sheet .name-row");
    if (!nameRow || nameRow.querySelector("[data-drpg-advance]")) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "drpg-advance-button";
    button.dataset.drpgAdvance = "";
    button.dataset.tooltip = game.i18n.localize("DRPG.Advance.buttonTooltip");
    button.setAttribute("aria-label", game.i18n.localize("DRPG.Advance.buttonTooltip"));
    button.innerHTML = `<i class="fa-solid fa-angles-up" inert></i>`;

    button.addEventListener("click", async () => {
        const { openAdvancementFor } = await import("./level-up.mjs");
        await openAdvancementFor(app.document);
    });

    nameRow.append(button);
}

/* ==========================================================================
 * ULTIMATE
 * ========================================================================== */

function injectUltimate(app, element) {
    const details = element.querySelector(".character-header-sheet .character-details");
    if (!details) return;

    const actor = app.document;
    const ultimate = actor.getFlag(MODULE_ID, FLAGS.ultimate) ?? "";
    const editable = app.isEditable;

    details.classList.add("drpg-ultimate");
    details.replaceChildren(buildUltimateRow(ultimate, editable));

    if (!editable) return;

    const field = details.querySelector("[data-drpg-ultimate]");
    if (!field) return;

    // Commit on blur, and let Enter mean "done" rather than "new line".
    field.addEventListener("blur", () => commitUltimate(actor, field));
    field.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            event.preventDefault();
            field.blur();
        } else if (event.key === "Escape") {
            event.preventDefault();
            field.textContent = actor.getFlag(MODULE_ID, FLAGS.ultimate) ?? "";
            field.blur();
        }
    });
}

function buildUltimateRow(ultimate, editable) {
    const row = document.createElement("div");
    row.className = "drpg-ultimate-row";

    const label = document.createElement("span");
    label.className = "drpg-ultimate-label";
    label.textContent = game.i18n.localize("DRPG.Sheet.ultimateLabel");
    row.append(label);

    const value = document.createElement("span");
    value.className = "drpg-ultimate-value";
    // textContent, never innerHTML — this string is player-supplied.
    value.textContent = ultimate;
    value.dataset.drpgUltimate = "";
    value.dataset.placeholder = game.i18n.localize("DRPG.Sheet.ultimatePlaceholder");

    if (editable) {
        value.contentEditable = "plaintext-only";
        value.spellcheck = false;
        value.setAttribute("role", "textbox");
        value.setAttribute("aria-label", game.i18n.localize("DRPG.Sheet.ultimateLabel"));
    }

    row.append(value);
    return row;
}

async function commitUltimate(actor, field) {
    const next = field.textContent.trim();
    const current = actor.getFlag(MODULE_ID, FLAGS.ultimate) ?? "";
    if (next === current) return;

    try {
        await actor.setFlag(MODULE_ID, FLAGS.ultimate, next);
        debug(`Ultimate for ${actor.name} set to "${next}".`);
    } catch (err) {
        error("Could not save the Ultimate", err);
        field.textContent = current;
    }
}

/* ==========================================================================
 * SIDEBAR
 * --------------------------------------------------------------------------
 * "Equipment" becomes "Equipped" — in this game the word equipment means the
 * whole inventory, and the sidebar block only lists what is in hand. Loadout is
 * removed outright: it holds domain cards, which do not exist here.
 * ========================================================================== */

function tidySidebar(element) {
    const sidebar = element.querySelector(".character-sidebar-sheet");
    if (!sidebar) return;

    for (const heading of sidebar.querySelectorAll("h3, .title h3, .title")) {
        const text = heading.textContent.trim().toLowerCase();

        if (text === "equipment") {
            const label = heading.querySelector("h3") ?? heading;
            if (label.dataset.drpgRenamed) continue;
            label.textContent = game.i18n.localize("DRPG.Sheet.equipped");
            label.dataset.drpgRenamed = "1";
        }

        if (text === "loadout") {
            // Hide the heading and the list that follows it.
            const block = heading.closest(".loadout-section, section, fieldset") ?? heading.parentElement;
            (block ?? heading).classList.add("drpg-hidden-block");
        }
    }
}

/**
 * Biography: the guide asks for three sentences of backstory. Pronouns, Age,
 * Faith and Connections belong to a different game.
 *
 * Removed here rather than in CSS because the markup gives them no class or
 * name to hang a selector on — they are bare headings beside their inputs. The
 * captions are matched by text and the whole labelled block removed with them,
 * which is why hiding the input alone left the word floating on its own.
 */
const BIOGRAPHY_CUTS = ["pronouns", "age", "faith", "connections"];

function tidyBiography(element) {
    const tab = element.querySelector('section[data-application-part="biography"]');
    if (!tab) return;

    // Anything whose own text is one of the unwanted captions.
    for (const node of tab.querySelectorAll("h1, h2, h3, h4, label, legend, span, div")) {
        const text = node.textContent?.trim().toLowerCase().replace(/[:*]/g, "");
        if (!text || text.length > 12) continue;
        if (!BIOGRAPHY_CUTS.includes(text)) continue;

        // Take the labelled block, not just the caption.
        const block = node.closest("fieldset, .form-group, .biography-field, label") ?? node;
        block.classList.add("drpg-hidden-block");
        // The input usually sits next to the caption rather than inside it.
        const sibling = block.nextElementSibling;
        if (sibling && sibling.querySelector?.("input, select, textarea, [contenteditable]")) {
            sibling.classList.add("drpg-hidden-block");
        }
    }

    // And any field still identifiable by name.
    for (const field of tab.querySelectorAll('[name*="characteristics"], [name*="connections"]')) {
        (field.closest("fieldset, .form-group, label") ?? field).classList.add("drpg-hidden-block");
    }
}

/* ==========================================================================
 * INVENTORY GROUPS
 * --------------------------------------------------------------------------
 * The guide's inventory is three capped categories, not one flat list. Items
 * carry their category as a flag, so they are sorted into labelled groups with
 * the carry limit shown — a player should be able to see "Weapons 1/1" without
 * counting.
 * ========================================================================== */

const INVENTORY_GROUPS = [
    { key: "usable", labelKey: "DRPG.Sheet.groupUsables" },
    { key: "crimeTool", labelKey: "DRPG.Sheet.groupWeapons" },
    { key: "cleaningTool", labelKey: "DRPG.Sheet.groupCleaners" },
    { key: "truthBullet", labelKey: "DRPG.Sheet.groupTruthBullets" }
];

function groupInventory(app, element) {
    const tab = element.querySelector('section[data-application-part="inventory"]');
    if (!tab) return;

    tab.querySelector(".drpg-inventory-groups")?.remove();

    const actor = app.document;
    const box = document.createElement("div");
    box.className = "drpg-inventory-groups";

    for (const group of INVENTORY_GROUPS) {
        const cat = ITEM_CATEGORIES[group.key];
        const items = actor.items.filter(i => i.getFlag(MODULE_ID, "category") === group.key);
        const limit = cat?.limit;

        const section = document.createElement("div");
        section.className = "drpg-inventory-group";
        section.dataset.category = group.key;

        const head = document.createElement("h4");
        head.innerHTML = `<span>${game.i18n.localize(group.labelKey)}</span>
                          <span class="drpg-group-count${limit && items.length >= limit ? " full" : ""}">${
                              items.length}${limit ? ` / ${limit}` : ""}</span>`;
        section.append(head);

        const list = document.createElement("ul");
        list.className = "drpg-inventory-list";

        if (!items.length) {
            const empty = document.createElement("li");
            empty.className = "drpg-inventory-empty";
            empty.textContent = game.i18n.localize("DRPG.Sheet.groupEmpty");
            list.append(empty);
        } else {
            for (const item of items) {
                const li = document.createElement("li");
                li.dataset.itemUuid = item.uuid;
                const tier = item.getFlag(MODULE_ID, "tier");
                li.innerHTML = `<img src="${item.img}" alt="" />
                                <span class="drpg-item-name">${foundry.utils.escapeHTML(item.name)}</span>
                                ${tier !== undefined ? `<span class="drpg-item-tier">T${tier}</span>` : ""}`;
                li.addEventListener("click", () => item.sheet?.render(true));
                list.append(li);
            }
        }

        section.append(list);
        box.append(section);
    }

    tab.prepend(box);
}

/* ==========================================================================
 * ACTION PANEL
 * --------------------------------------------------------------------------
 * The guide's actions, as buttons at the top of the Features tab. Clicking one
 * rolls the right trait, resolves the threshold and reports back privately —
 * no GM required for the repeatable ones.
 * ========================================================================== */

function injectActionPanel(app, element) {
    if (!app.isEditable) return;

    // Must be the CONTENT section, never the navigation link.
    //
    // `[data-tab="features"]` also matches the <a> in the tab bar, which comes
    // first in the DOM — so a looser selector put the whole panel inside a
    // navigation link. That made it collapse to the link's width and, worse,
    // silently swallowed every click: ApplicationV2 treats clicks inside
    // `[data-tab]` as "switch to this tab" and never reached our handler.
    const tab = element.querySelector('section[data-application-part="features"]')
        ?? element.querySelector('section.tab[data-tab="features"]')
        ?? element.querySelector('.tab[data-tab="features"]');
    if (!tab || tab.matches("a, nav, .sheet-tabs")) return;

    // Panels are rebuilt every render so costs and affordability stay current.
    tab.querySelectorAll(".drpg-action-panel, .drpg-calls-panel").forEach(p => p.remove());

    const actor = app.document;
    const monokuma = isMonokuma(actor);

    // A Monokuma has no action economy at all. Their sheet is Despair Calls.
    if (monokuma) {
        injectCallsPanel(tab, actor, true);
        attachActionDelegate(app, element);
        return;
    }

    const panel = document.createElement("div");
    panel.className = "drpg-action-panel";

    const title = document.createElement("h3");
    title.textContent = game.i18n.localize("DRPG.Action.panelTitle");
    panel.append(title);

    const grid = document.createElement("div");
    grid.className = "drpg-action-grid";

    for (const [key, def] of Object.entries(ACTIONS)) {
        if (def.kind !== "universal") continue;
        grid.append(actionButton(actor, key, def));
    }

    // Dynamic actions are the guide's catch-all: describe it, the GM sets a
    // threshold, and the reward scale is deliberately gentler.
    grid.append(actionButton(actor, "dynamic", {
        label: game.i18n.localize("DRPG.Action.dynamicLabel"),
        hint: game.i18n.localize("DRPG.Action.dynamicHint"),
        icon: "fa-wand-magic-sparkles",
        cost: 1
    }));

    panel.append(grid);
    tab.prepend(panel);

    // Hope Calls sit underneath the actions, in the colour of the Hope die.
    injectCallsPanel(tab, actor, false);
    attachActionDelegate(app, element);
}

/* ==========================================================================
 * HOPE CALLS  /  DESPAIR CALLS
 * --------------------------------------------------------------------------
 * The same grid as the actions, in the colour of the die that pays for it:
 * gold for Hope, purple for Despair. Calls you cannot afford stay visible but
 * dimmed — half the point of the menu is seeing what you are saving towards.
 * ========================================================================== */

function injectCallsPanel(tab, actor, monokuma) {
    const panel = document.createElement("div");
    panel.className = `drpg-calls-panel ${monokuma ? "drpg-despair-panel" : "drpg-hope-panel"}`;

    const held = monokuma ? monokumaPool(actor) : hopeHeld(actor);
    const max = monokuma ? STARTING.despairMax : hopeMax(actor);

    const title = document.createElement("h3");
    title.innerHTML = `<span>${game.i18n.localize(
        monokuma ? "DRPG.Calls.despairTitle" : "DRPG.Calls.hopeTitle"
    )}</span><span class="drpg-calls-pool">${held} / ${max}</span>`;
    panel.append(title);

    const grid = document.createElement("div");
    grid.className = "drpg-action-grid";

    const calls = monokuma ? despairCallsFor(held) : affordableHopeCalls(actor);
    for (const call of calls) grid.append(callButton(call, monokuma));

    panel.append(grid);
    tab.append(panel);
}

/**
 * A Call tile, built to exactly the same template as an action tile: icon on
 * top, name, price underneath. Only the colour and the icon differ, so a player
 * reads the whole sheet the same way rather than learning two layouts.
 */
function callButton(call, monokuma) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `drpg-action-button drpg-call-button${call.affordable ? "" : " unaffordable"}`;
    button.dataset.drpgCall = call.key;
    button.dataset.drpgCallKind = monokuma ? "despair" : "hope";

    const costLabel = game.i18n.format(
        monokuma ? "DRPG.Calls.costsDespairShort" : "DRPG.Calls.costsHopeShort",
        { cost: call.cost }
    );
    button.dataset.tooltip = `${foundry.utils.escapeHTML(call.effect)}<br><em>${costLabel}</em>`;

    button.innerHTML = `
        <i class="fa-solid ${call.icon ?? "fa-circle"} drpg-action-icon" inert></i>
        <span class="drpg-action-name">${foundry.utils.escapeHTML(call.label)}</span>
        <span class="drpg-action-cost">${costLabel}</span>`;

    return button;
}

/** The Despair pool backing a Monokuma actor. */
function monokumaPool(actor) {
    try {
        const user = poolUserFor(actor);
        return user ? getDespair(user.id) : 0;
    } catch {
        return 0;
    }
}

/**
 * One delegated listener on the sheet root, instead of one per button.
 *
 * Per-button listeners were being lost: ApplicationV2 replaces the innerHTML of
 * a part when it re-renders, so any node we had attached to was discarded while
 * a visually identical one took its place. Delegation survives that, and the
 * `capture` phase means the sheet's own handlers cannot swallow the click
 * first.
 */
function attachActionDelegate(app, element) {
    if (element.dataset.drpgActionDelegate) return;
    element.dataset.drpgActionDelegate = "1";

    element.addEventListener("click", async event => {
        const button = event.target.closest?.("[data-drpg-action], [data-drpg-call]");
        if (!button || !element.contains(button)) return;

        event.preventDefault();
        event.stopPropagation();
        if (button.disabled) return;

        button.disabled = true;
        try {
            if (button.dataset.drpgCall) {
                await runCall(app.document, button.dataset.drpgCall, button.dataset.drpgCallKind);
            } else {
                const { performAction } = await import("./action-rolls.mjs");
                await performAction(app.document, button.dataset.drpgAction);
            }
        } catch (err) {
            error("Action failed", err);
            ui.notifications.error(game.i18n.localize("DRPG.Action.failed"));
        } finally {
            button.disabled = false;
        }
    }, { capture: true });
}

/** Confirm and pay for a Hope Call or a Despair Call. */
async function runCall(actor, key, kind) {
    const { HOPE_CALLS, DESPAIR_CALLS } = await import("./config.mjs");
    const { confirmCall, spendHopeCall, spendDespairCallFor, hopeHeld } = await import("./calls.mjs");

    const despair = kind === "despair";
    const call = despair ? DESPAIR_CALLS[key] : HOPE_CALLS[key];
    if (!call) return;

    const held = despair ? monokumaPool(actor) : hopeHeld(actor);
    if (held < call.cost) {
        ui.notifications.warn(game.i18n.format(
            despair ? "DRPG.Calls.costsDespair" : "DRPG.Calls.costsHope",
            { cost: call.cost, held }
        ));
        return;
    }

    // Point it at something first: a player, a project, a room, an item.
    const { pickTarget } = await import("./call-effects.mjs");
    const choice = await pickTarget(actor, call, despair ? "despair" : "hope");
    if (choice === null) return;

    const note = await confirmCall(call, { kind: despair ? "despair" : "hope", held, choice });
    if (note === null) return;

    if (despair) await spendDespairCallFor(actor, key, { note, choice });
    else await spendHopeCall(actor, key, { note, choice });

    actor.sheet?.render(false);
}

function actionButton(actor, key, def) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "drpg-action-button";

    // NOT `data-action`: ApplicationV2 claims that attribute for its own action
    // dispatch and swallows the click looking for a handler it does not have.
    button.dataset.drpgAction = key;

    const costLabel = costLabelFor(actor, key, def);
    button.dataset.tooltip = `${foundry.utils.escapeHTML(def.hint ?? "")}<br><em>${costLabel}</em>`;

    button.innerHTML = `
        <i class="fa-solid ${def.icon ?? "fa-circle"} drpg-action-icon" inert></i>
        <span class="drpg-action-name">${foundry.utils.escapeHTML(def.label)}</span>
        <span class="drpg-action-cost">${costLabel}</span>`;

    return button;
}

/** Move shows its live state; everything else shows a flat price. */
function costLabelFor(actor, key, def) {
    if (key === "move") {
        return hasFreeMove(actor)
            ? game.i18n.localize("DRPG.Action.costFree")
            : game.i18n.format("DRPG.Action.costActions", { n: 1 });
    }
    const cost = def.cost ?? 1;
    return cost === 0
        ? game.i18n.localize("DRPG.Action.costFree")
        : game.i18n.format("DRPG.Action.costActions", { n: cost });
}

/* ==========================================================================
 * PUBLIC HELPERS
 * ========================================================================== */

/** Read a character's Ultimate. */
export function getUltimate(actor) {
    return actor?.getFlag(MODULE_ID, FLAGS.ultimate) ?? "";
}

/** Set a character's Ultimate. */
export function setUltimate(actor, value) {
    return actor?.setFlag(MODULE_ID, FLAGS.ultimate, String(value ?? "").trim());
}

/**
 * Ultimates must be unique for a season. Returns every character whose
 * Ultimate collides with another, so the GM can catch duplicates at creation.
 */
export function findDuplicateUltimates() {
    const seen = new Map();
    for (const actor of game.actors) {
        if (actor.type !== "character") continue;
        const ultimate = getUltimate(actor).trim().toLowerCase();
        if (!ultimate) continue;
        if (!seen.has(ultimate)) seen.set(ultimate, []);
        seen.get(ultimate).push(actor);
    }
    return Array.from(seen.entries())
        .filter(([, actors]) => actors.length > 1)
        .map(([ultimate, actors]) => ({ ultimate, actors }));
}
