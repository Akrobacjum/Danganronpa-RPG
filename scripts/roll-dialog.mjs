/**
 * Danganronpa RPG — locking down the roll dialog.
 * ---------------------------------------------------------------------------
 * Daggerheart's roll window lets the roller swap dice, pick a trait, toggle
 * advantage and spend Hope on experiences. In this game none of that is the
 * player's to choose:
 *
 *   dice          fixed at d12/d12 by the guide
 *   trait         chosen before the dialog, by the action or by the GM
 *   advantage     granted by a Hope Call or a Despair Call, never self-served
 *   experiences   a Hope Call — so it must not silently charge Hope here
 *
 * The dialog is found by its `roll-selection` CSS class rather than by class
 * name, so a system rename cannot quietly disable this.
 */

import { MODULE_ID, FLAGS } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { debug } from "./utils.mjs";

export function registerRollDialog() {
    Hooks.on("renderApplicationV2", onRenderApplication);
    Hooks.on("closeApplicationV2", onCloseApplication);
}

/**
 * A Call buys one roll. Consuming the flag when the dialog is submitted covers
 * traits rolled straight from the sheet as well as actions — otherwise advantage
 * bought for one roll silently stayed switched on for every roll afterwards.
 *
 * `config` is set to `false` by the dialog when it closes unsubmitted, so
 * backing out costs nothing.
 */
async function onCloseApplication(app) {
    try {
        if (!isRollDialog(app)) return;
        if (!app.config) return;

        const actor = actorOf(app);
        if (!actor?.isOwner) return;

        const { consumeCall } = await import("./call-effects.mjs");
        await consumeCall(actor);
    } catch {
        // Never let bookkeeping break a roll.
    }
}

/**
 * Is this Daggerheart's roll window?
 *
 * Matched on the CSS class rather than the class name so a system rename cannot
 * quietly switch the lock off. The DOM is checked first; by close time the
 * element may already be gone, so the registered options are the fallback.
 */
function isRollDialog(app) {
    if (app?.element?.classList?.contains?.("roll-selection")) return true;
    const classes = app?.options?.classes;
    return Array.isArray(classes) && classes.includes("roll-selection");
}

function onRenderApplication(app, element) {
    const root = element instanceof HTMLElement ? element : element?.[0];
    if (!root?.classList?.contains?.("roll-selection")) return;

    try {
        stripExperienceCosts(app);
        if (!game.user.isGM && locking()) lockControls(root, app);
    } catch {
        // Never break the roll dialog itself.
    }
}

/**
 * The actor this dialog is rolling for.
 *
 * `config.source.actor` is the documented route, but it is not always populated
 * — a trait rolled straight from the sheet can leave it empty, and then nothing
 * downstream could tell which character's Calls to honour. Every other handle
 * the config offers is tried before giving up.
 */
function actorOf(app) {
    const config = app?.config;
    if (!config) return null;

    const uuid = config.source?.actor;
    if (uuid) {
        const doc = fromUuidSync(uuid);
        const actor = doc?.documentName === "Actor" ? doc : doc?.actor;
        if (actor) return actor;
    }

    // The roll data usually carries the actor's own data model.
    const parent = config.data?.parent;
    if (parent?.documentName === "Actor") return parent;
    if (parent?.actor) return parent.actor;

    // Failing that, the speaker.
    const speaker = config.message?.speaker ?? config.speaker;
    if (speaker?.actor) return game.actors.get(speaker.actor) ?? null;

    // Last resort: the user's own character.
    return game.user?.character ?? null;
}

function locking() {
    try {
        return game.settings.get(MODULE_ID, SETTINGS.lockRollDialog);
    } catch {
        return true;
    }
}

/**
 * Selecting an experience adds a Hope cost to the roll. In this game spending
 * Hope on an experience is the "Experience" Hope Call, paid deliberately — not
 * a silent charge for ticking a box. The cost is removed on every render, which
 * is also every time the config changes, because the dialog submits on change.
 */
function stripExperienceCosts(app) {
    const costs = app?.config?.costs;
    if (!Array.isArray(costs) || !costs.length) return;

    const kept = costs.filter(c => !(c?.extKey && (c.key === "hope" || c.key === "fear")));
    if (kept.length === costs.length) return;

    app.config.costs = kept;
    debug("Removed the automatic Hope cost from an experience.");
}

/**
 * Disable everything a player should not be choosing — unless a Call has paid
 * for it. A Hope Call is the permission slip: Ultimate buys advantage,
 * Experience buys the experience chips, Determination buys the trait picker.
 */
function lockControls(root, app) {
    const actor = actorOf(app);
    const armed = actor ? pendingGrants(actor) : null;

    // Dice size: fixed by the rules, always.
    for (const select of root.querySelectorAll('select[name^="roll.dice."]')) {
        if (select.name.includes("advantage") && armed === "advantage") continue;
        disable(select, "DRPG.RollDialog.diceFixed");
    }

    // Trait: chosen before this window opened, unless Determination is armed.
    const trait = root.querySelector('select[name="trait"]');
    if (trait && armed !== "trait") disable(trait, "DRPG.RollDialog.traitFixed");
    else if (trait) unlock(trait, "DRPG.RollDialog.unlockedByCall");

    // Advantage and disadvantage.
    //
    // A Call does not offer these, it imposes them: the modifier is applied and
    // then both buttons are locked. Otherwise a player could simply decline the
    // disadvantage a Monokuma just paid two Despair for.
    const adv = root.querySelectorAll(".advantage-chip");
    const dis = root.querySelectorAll(".disadvantage-chip");

    if (armed === "advantage" || armed === "disadvantage") {
        const value = armed === "advantage" ? 1 : -1;
        forceAdvantage(app, value);

        for (const chip of adv) {
            chip.classList.toggle("selected", value === 1);
            lockChip(chip, value === 1 ? "DRPG.RollDialog.forcedByCall" : "DRPG.RollDialog.lockedByCall");
            if (value === 1) chip.classList.add("drpg-call-unlocked");
        }
        for (const chip of dis) {
            chip.classList.toggle("selected", value === -1);
            lockChip(chip, value === -1 ? "DRPG.RollDialog.forcedByCall" : "DRPG.RollDialog.lockedByCall");
            if (value === -1) chip.classList.add("drpg-call-unlocked");
        }
    } else {
        for (const chip of [...adv, ...dis]) lockChip(chip, "DRPG.RollDialog.advantageLocked");
    }

    // Experiences: always visible, greyed out, and selectable only while the
    // Experience Call is armed — at which point they are selected and frozen.
    const chips = root.querySelectorAll('[data-action="selectExperience"]');
    if (armed === "experience") {
        for (const chip of chips) {
            chip.classList.add("selected", "drpg-call-unlocked");
            lockChip(chip, "DRPG.RollDialog.forcedByCall");
        }
        forceExperiences(app);
    } else {
        for (const chip of chips) lockChip(chip, "DRPG.RollDialog.experienceLocked");
    }

    // Selecting an experience normally adds a Hope cost. The Call has already
    // been paid for, so the cost block is meaningless here — remove it.
    hideCostSection(root);

    if (armed === "critical") announceFreeCritical(root);

    // Free-text bonus: a back door around all of the above.
    const extra = root.querySelector('input[name="extraFormula"]');
    if (extra) disable(extra, "DRPG.RollDialog.bonusLocked");

    // Roll mode: privacy is enforced by the module, not chosen per roll.
    const mode = root.querySelector('select[name="selectedMessageMode"]');
    if (mode) disable(mode, "DRPG.RollDialog.modeLocked");
}

/** What the armed Call on this actor permits, if anything. */
function pendingGrants(actor) {
    try {
        const pending = actor.getFlag(MODULE_ID, FLAGS.pendingCall);
        return pending?.grants ?? null;
    } catch {
        return null;
    }
}

function disable(el, tooltipKey) {
    el.disabled = true;
    el.classList.add("drpg-locked");
    el.dataset.tooltip = game.i18n.localize(tooltipKey);
}

function lockChip(chip, tooltipKey) {
    chip.disabled = true;
    chip.classList.add("drpg-locked");
    chip.dataset.tooltip = game.i18n.localize(tooltipKey);
    chip.addEventListener("click", stop, { capture: true });
}

/* ==========================================================================
 * IMPOSING WHAT A CALL BOUGHT
 *
 * The buttons are cosmetic; the roll reads `config.roll.advantage` and
 * `config.experiences`. Both are written directly, so the modifier is real even
 * though the player never clicked anything — and cannot be clicked away, since
 * the buttons are locked immediately afterwards.
 *
 * Each dialog is forced once. Writing the config triggers a re-render, which
 * re-enters this hook, so without the guard this would loop forever.
 * ========================================================================== */

const forced = new WeakSet();

function forceAdvantage(app, advantage) {
    try {
        if (app.config.roll.advantage === advantage) return;
        if (forced.has(app)) return;
        forced.add(app);

        app.config.roll.advantage = advantage;
        app.advantage = advantage === 1;
        app.disadvantage = advantage === -1;

        // Match what clicking the button would have done to the bonus dice.
        const rules = app.config.data?.rules?.roll;
        const faces = Number.parseInt(
            advantage === 1 ? rules?.defaultAdvantageDice : rules?.defaultDisadvantageDice
        );
        if (!Number.isNaN(faces)) app.roll.advantageFaces = faces;

        app.render();
    } catch {
        // A forced modifier is better missing than fatal.
    }
}

function forceExperiences(app) {
    try {
        const all = Object.keys(app.config.data?.system?.experiences ?? {});
        if (!all.length) return;

        const current = app.config.experiences ?? [];
        if (all.every(id => current.includes(id)) && current.length === all.length) return;
        if (forced.has(app)) return;
        forced.add(app);

        app.config.experiences = all;
        app.render();
    } catch {
        // Ditto.
    }
}

/**
 * Remove the Hope-cost block.
 *
 * Experiences normally charge Hope when ticked. Here the Experience Hope Call
 * has already been paid, so the block would be charging twice — and offering a
 * checkbox that must not be unticked. `stripExperienceCosts` empties it from the
 * config; this clears the markup the current render already produced.
 */
function hideCostSection(root) {
    for (const input of root.querySelectorAll('input[name^="costs."]')) {
        input.closest("li")?.remove();
    }
    for (const fieldset of root.querySelectorAll("fieldset")) {
        const list = fieldset.querySelector("ul");
        if (list && !list.children.length) fieldset.remove();
    }
}

/** A Call paid for this: light it up rather than leaving it grey. */
function unlock(el, tooltipKey) {
    el.disabled = false;
    el.classList.remove("drpg-locked");
    el.classList.add("drpg-call-unlocked");
    el.dataset.tooltip = game.i18n.localize(tooltipKey);
}

/** Free Critical: the roll is a formality. */
function announceFreeCritical(root) {
    if (root.querySelector(".drpg-free-crit-banner")) return;

    const banner = document.createElement("p");
    banner.className = "drpg-free-crit-banner drpg-warning";
    banner.textContent = game.i18n.localize("DRPG.RollDialog.freeCritArmed");

    const container = root.querySelector(".roll-dialog-container") ?? root;
    container.prepend(banner);
}

function stop(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    ui.notifications.info(game.i18n.localize("DRPG.RollDialog.locked"));
}
