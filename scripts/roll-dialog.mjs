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

import { MODULE_ID } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
// Statically imported: the lock runs inside a synchronous render hook and has no
// opportunity to await. Neither module reaches back here, so no cycle.
import { pendingCall, situationalAdvantage } from "./call-effects.mjs";
import { isMonokuma } from "./monokuma.mjs";
import { isBrokenDown } from "./character.mjs";
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
        // The submit button's die. The system draws `fa-dice` — a d6 pair from
        // a game with no d6 in it. This one rolls two d12s and the module says
        // so; a class swap in the render hook because the glyph lives in the
        // system's template, not in anything CSS can reword.
        const die = root.querySelector("button.submit-btn i.fa-dice");
        die?.classList.replace("fa-dice", "fa-dice-d12");

        stripExperienceCosts(app);

        const actor = actorOf(app);

        // A Free Critical opens a roll window whose outcome is already
        // decided, and the window should say so before the dice do. Red — the
        // sanctioned exception to "red means the GM" (Dawid, 26.08): this is
        // the rarest, most expensive thing a player can buy, and the six Hope
        // deserve a window that does not look like every other roll.
        if (actor && pendingGrants(actor) === "critical") {
            root.classList.add("drpg-forced-critical");
        }

        if (!isStudentRoll(actor)) return;

        if (locking()) {
            lockControls(root, app);
            return;
        }

        // Locking is OFF, and that is a decision about the interface, not about
        // the rules.
        //
        // "Let the players drive their own roll window" is what this setting
        // says. It cannot also mean "Breakdown stops existing" — the guide's
        // "przy utracie całego stresu dostaje disadvantage na każdy rzut" is a
        // penalty, and a penalty nobody applies to themselves is a penalty that
        // is not in the game. So the state modifier is imposed either way; only
        // the chips stay clickable.
        const fromState = stateGrant(actor);
        if (fromState !== 0) forceAdvantage(app, fromState);
    } catch {
        // Never break the roll dialog itself.
    }
}

/**
 * Should this particular roll be locked down?
 *
 * The lock exists to stop a *student* from picking their own advantage, trait
 * or experience outside a Call — it has nothing to do with who is logged in.
 * Gating it on `game.user.isGM` instead meant every roll a GM triggered went
 * unlocked, including a student's own Sabotage or Work on Project: a GM can
 * open any student's sheet and click its action grid exactly as the player
 * can (and `game.drpg.performAction(actor, ...)` exists for exactly this),
 * and that roll was walking straight past every restriction
 * this file exists to enforce. Monokuma is exempt on purpose — they run on
 * Despair, not the Call economy, and have no action grid to lock in the
 * first place.
 */
function isStudentRoll(actor) {
    return Boolean(actor) && actor.type === "character" && !isMonokuma(actor);
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

    // Dice size: fixed by the rules, always — the advantage die INCLUDED.
    // This used to skip the advantage selects while advantage was armed, on
    // the reasoning that the Call had bought the player the controls. It had
    // bought them the DIE: the guide's advantage is one d6, and the unlocked
    // selects let the beneficiary quietly upgrade it to four d20s (Dawid,
    // 26.08: locked).
    // Both selector shapes on purpose: the hope/fear dice are named
    // `roll.dice.*`, while the advantage pair (count and faces) sits in the
    // modifier fieldset's `.nest-inputs` — one net would miss the other.
    for (const select of root.querySelectorAll(
        'select[name^="roll.dice."], .modifier-container .nest-inputs select'
    )) {
        disable(select, "DRPG.RollDialog.diceFixed");
    }

    // Trait: chosen before this window opened, unless Determination is armed.
    const trait = root.querySelector('select[name="trait"]');
    if (trait && armed !== "trait") disable(trait, "DRPG.RollDialog.traitFixed");
    else if (trait) unlock(trait, "DRPG.RollDialog.unlockedByCall");

    // Advantage and disadvantage.
    //
    // Neither is offered, both are imposed: the modifier is applied and then the
    // buttons are locked. Otherwise a player could simply decline the
    // disadvantage a Monokuma just paid two Despair for.
    //
    // Two sources feed in — a Call somebody paid Hope or Despair for, and the
    // situation itself (searching a fitting room, digging through a hidden
    // stash). They are added and clamped, so they cancel rather than one
    // silently outranking the other: a Monokuma's Obstacle against a player
    // rummaging in exactly the right place is a fair fight, not a loss for
    // whichever mechanism happens to be read second.
    const adv = root.querySelectorAll(".advantage-chip");
    const dis = root.querySelectorAll(".disadvantage-chip");

    // Three sources now, all added and then clamped so they cancel rather than
    // one silently outranking another: a Call somebody paid for, the situation,
    // and the character's own state. Breakdown is the guide's "Gracz przy
    // utracie całego stresu dostaje disadvantage na każdy rzut" — a standing
    // penalty that was declared in config and never reached a die.
    const fromCall = armed === "advantage" ? 1 : armed === "disadvantage" ? -1 : 0;
    const fromRoom = situationalGrant();
    const fromState = stateGrant(actor);
    const value = Math.max(-1, Math.min(1, fromCall + fromRoom + fromState));

    if (value !== 0) {
        forceAdvantage(app, value);

        // The tooltip has to say WHICH, or a player sees a locked advantage they
        // never bought and reads it as a bug.
        const reason = fromCall !== 0
            ? "DRPG.RollDialog.forcedByCall"
            : "DRPG.RollDialog.forcedBySituation";

        for (const chip of adv) {
            chip.classList.toggle("selected", value === 1);
            lockChip(chip, value === 1 ? reason : "DRPG.RollDialog.lockedByCall");
            if (value === 1) chip.classList.add("drpg-call-unlocked");
        }
        for (const chip of dis) {
            chip.classList.toggle("selected", value === -1);
            lockChip(chip, value === -1 ? reason : "DRPG.RollDialog.lockedByCall");
            if (value === -1) chip.classList.add("drpg-call-unlocked");
        }
    } else {
        for (const chip of [...adv, ...dis]) lockChip(chip, "DRPG.RollDialog.advantageLocked");
    }

    // Experiences: always visible, greyed out, and selectable only while the
    // Experience Call is armed — at which point they are selected and frozen.
    const chips = root.querySelectorAll('[data-action="selectExperience"]');
    if (armed === "experience") {
        // The Call buys ONE experience, and which one is the player's choice:
        // "the subject of the roll must be connected to the experience". The
        // chips are therefore unlocked, not force-selected — selecting every
        // experience the character owns was adding all of them to the total, so
        // a 1-Hope Call was worth +4 on a starting character with two.
        for (const chip of chips) unlock(chip, "DRPG.RollDialog.pickOneExperience");
        capExperiences(app);
    } else {
        for (const chip of chips) lockChip(chip, "DRPG.RollDialog.experienceLocked");
    }

    // Selecting an experience normally adds a Hope cost. The Call has already
    // been paid for, so the cost block is meaningless here — remove it.
    hideCostSection(root);

    if (armed === "critical") announceFreeCritical(root);

    // Free-text bonus. Ordinarily a back door around everything above, so it
    // stays disabled — except for `grants: "bonus"`, the one Call that IS a
    // flat modifier (Monocub's Meddle at its lower tier). Imposed the same way
    // advantage is: pre-filled and read-only, not offered for the player to
    // edit or clear.
    const extra = root.querySelector('input[name="extraFormula"]');
    if (extra) {
        const amount = armed === "bonus" ? pendingAmount(actor) : null;
        if (amount) {
            // Unlike advantage, a flat bonus only ever comes from a Call —
            // `situationalAdvantage()` deals in advantage/disadvantage, not
            // in numbers — so the tooltip does not need the two-way check above.
            extra.value = amount > 0 ? `+${amount}` : `${amount}`;
            unlock(extra, "DRPG.RollDialog.forcedByCall");
            extra.readOnly = true;
        } else {
            disable(extra, "DRPG.RollDialog.bonusLocked");
        }
    }

    // Roll mode: privacy is enforced by the module, not chosen per roll.
    const mode = root.querySelector('select[name="selectedMessageMode"]');
    if (mode) disable(mode, "DRPG.RollDialog.modeLocked");
}

/**
 * What the armed Call on this actor permits, if anything.
 *
 * Read through `pendingCall` rather than off the flag directly, so a roll that
 * has deliberately shielded itself from the armed Call — a sabotage's
 * concealment roll, an indirect murder hiding its traces — opens the same locked
 * window as any other supporting roll. Reading the flag here while the roll
 * pipeline was ignoring it handed the advantage to the wrong dice.
 */
function pendingGrants(actor) {
    try {
        return pendingCall(actor)?.grants ?? null;
    } catch {
        return null;
    }
}

/** The magnitude behind a `grants: "bonus"` Call — see armCall's `amount`. */
function pendingAmount(actor) {
    try {
        return pendingCall(actor)?.amount ?? null;
    } catch {
        return null;
    }
}

/** Advantage the situation gives, with no Call behind it. See call-effects.mjs. */
function situationalGrant() {
    try {
        return situationalAdvantage();
    } catch {
        return 0;
    }
}

/**
 * Disadvantage the character is carrying around with them.
 *
 * Breakdown only, and it is not shielded the way a Call is: a supporting roll
 * made while every point of Sanity is marked is still made by somebody in
 * pieces, so `shieldCalls()` deliberately does not reach this.
 */
function stateGrant(actor) {
    try {
        return isBrokenDown(actor) ? -1 : 0;
    } catch {
        return 0;
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

/**
 * Hold the player to a single experience.
 *
 * Daggerheart's own chip handler appends to `config.experiences`, so nothing
 * stops someone ticking all of them. The Call paid for one, so anything beyond
 * the most recent pick is dropped — which reads as "clicking a second one moves
 * the choice" rather than as a refusal.
 *
 * No re-entrancy guard is needed: the length test below is what stops the render
 * this triggers from looping.
 */
function capExperiences(app) {
    try {
        const chosen = app.config.experiences ?? [];
        if (chosen.length <= 1) return;

        app.config.experiences = [chosen[chosen.length - 1]];
        app.render();
    } catch {
        // A miscounted experience is better than a broken roll window.
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
