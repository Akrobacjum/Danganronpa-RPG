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
// One string, and nothing in action-rolls.mjs reaches back here — the roll
// dialog is opened BY the system, not by that file.
import { DRPG_ACTION_ROLL } from "./action-rolls.mjs";

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

        // BEFORE the general lock, because it changes what the roll IS rather
        // than what the player may touch — and because it applies whether or
        // not the lock is on. "Let the players drive their own roll window"
        // cannot also mean "let them mint Hope by clicking a statistic".
        forceReaction(root, app);

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
        // One die, explicitly: Breakdown is a single standing penalty, and the
        // stacking above is about sources this branch deliberately ignores.
        if (fromState !== 0) forceAdvantage(app, fromState, 1);
    } catch {
        // Never break the roll dialog itself.
    }
}

/**
 * A roll that is not one of the module's actions is a REACTION, locked on.
 *
 * Daggerheart's reaction roll is a duality roll that pays nothing, and that is
 * exactly the right shape for the other reason somebody rolls in this game: a
 * GM says "roll Body" and the player clicks the statistic on their sheet. It
 * is not an action — nothing was declared, nothing was spent, no room was
 * involved — so it must not feed the economy either.
 *
 * MEASURED, AND IT WAS FEEDING IT. `onChatMessage` in despair-award.mjs fires
 * on any duality message: every bare statistic click was pushing a point into a
 * Monokuma's Despair pool on a Fear result, and paying the critical's second
 * Hope on a crit. A player with a sheet open and nothing to do had a Hope
 * generator and a Despair faucet, and neither cost anything.
 *
 * Two halves, and both are needed. The chip is forced on and made unclickable
 * here so the player can SEE what kind of roll this is; `despair-award.mjs`
 * reads the same fact off the finished message, because a lock on a control is
 * an interface and the rule has to hold whatever the interface does.
 *
 * Monokumas are exempt, like everywhere else in this file: they are not on the
 * Hope/Despair economy in the first place.
 */
function forceReaction(root, app) {
    const chip = root.querySelector('[data-action="toggleReaction"]');
    if (!chip) return;                                   // template moved

    const actor = actorOf(app);
    if (!isStudentRoll(actor)) return;
    // An action declared it. Leave the chip alone — a player may legitimately
    // want a reaction roll for an action in some corner the guide has not
    // reached, and this is not the place to decide they cannot.
    if (app?.config?.[DRPG_ACTION_ROLL]) return;

    // The dialog's own state, set the way its own handler sets it. Not through
    // a synthetic click on the chip: `toggleReaction` calls `render()`, and a
    // render triggered from inside a render hook is a loop.
    app.reactionOverride = true;
    app.config.actionType = "reaction";

    // And painted here for the same reason — the template will draw it selected
    // on the next render, and there may not be one.
    chip.classList.add("selected", "drpg-locked");
    chip.querySelector("i")?.classList?.replace("fa-regular", "fa-solid");
    chip.dataset.tooltip = game.i18n.localize("DRPG.RollDialog.reactionLocked");
    chip.addEventListener("click", stop, { capture: true });
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

/*
 * WHICH STATISTICS THE NEXT ROLL MAY OFFER.
 *
 * Normally the trait is decided before this window opens and the select is
 * dead, because letting a student pick their own statistic is letting them pick
 * their own difficulty. Search is the exception (Dawid, 29.08): looking for
 * something is either a careful look or a quick rummage, and which one you are
 * doing is a real choice that belongs in the moment of rolling rather than in a
 * menu two windows earlier.
 *
 * A MODULE-LEVEL HANDOFF, NOT A FLAG, and deliberately: this is a permission
 * for ONE window that is about to open on this very client, microseconds from
 * now, in the same call stack. An actor flag would be an asynchronous write
 * racing the dialog it is meant to configure, and a persisted one would outlive
 * the roll it was for — the failure being a player who gets the choice on the
 * next roll too, which is the whole thing this is meant not to do.
 *
 * Consumed on read for the same reason: one permission, one roll.
 */
let nextTraitChoice = null;

/** Let the next roll dialog offer these statistics. See the note above. */
export function allowTraitsForNextRoll(traits) {
    nextTraitChoice = Array.isArray(traits) && traits.length ? [...traits] : null;
}

function takeTraitChoice() {
    const taken = nextTraitChoice;
    nextTraitChoice = null;
    return taken;
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

    /*
     * Trait: chosen before this window opened — with two exceptions.
     *
     *   Determination (`armed === "trait"`) buys the whole picker. That is what
     *   the Call is FOR, so nothing is narrowed.
     *
     *   An action may open the door part-way: Search offers Eye or Hand and
     *   nothing else. The options outside the list are removed rather than
     *   disabled, because a select full of greyed rows reads as a broken menu,
     *   while a short menu reads as a short menu.
     *
     * Order matters. The Call is checked first, so a player who paid for the
     * picker is never handed the narrower version of it.
     */
    const trait = root.querySelector('select[name="trait"]');
    const allowed = takeTraitChoice();

    if (trait && armed === "trait") {
        unlock(trait, "DRPG.RollDialog.unlockedByCall");
    } else if (trait && allowed?.length) {
        for (const option of [...trait.options]) {
            if (!allowed.includes(option.value)) option.remove();
        }
        unlock(trait, "DRPG.RollDialog.pickYourApproach");
    } else if (trait) {
        disable(trait, "DRPG.RollDialog.traitFixed");
    }

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

    const { sign, count, capped, sources } = advantageSources(actor, armed);

    if (sign !== 0) {
        forceAdvantage(app, sign, count);

        // The tooltip has to say WHICH, or a player sees a locked advantage they
        // never bought and reads it as a bug.
        //
        // ONE SOURCE GETS ITS OWN SENTENCE; two or more get the list. This used
        // to fall back to "set by where you are and what you are looking for"
        // for everything that was not a Call — which told a character in
        // Breakdown that the disadvantage they carry everywhere came from the
        // room they happen to be standing in. Measured on the live window with
        // Sanity full: the chip was correctly selected and locked, and correctly
        // explained by the wrong cause.
        //
        // Since E7 there is a second way to be wrong about it, and it is worse:
        // two sources that partly cancel leave ONE die and two explanations, so
        // naming either one alone is a half-truth about a number the player is
        // being held to. The list is used the moment there is more than one.
        //
        // The window opens on every roll again (28.08), so this is no longer
        // the only sentence explaining why a modifier is there — but it is
        // still the only one that says WHICH source put it there.
        const reason = explainAdvantage(sign, count, capped, sources);

        for (const chip of adv) {
            const mine = sign === 1;
            chip.classList.toggle("selected", mine);
            lockChip(chip, mine ? reason : "DRPG.RollDialog.lockedByCall");
            if (mine) {
                chip.classList.add("drpg-call-unlocked");
                markChipCount(chip, count);
            }
        }
        for (const chip of dis) {
            const mine = sign === -1;
            chip.classList.toggle("selected", mine);
            lockChip(chip, mine ? reason : "DRPG.RollDialog.lockedByCall");
            if (mine) {
                chip.classList.add("drpg-call-unlocked");
                markChipCount(chip, count);
            }
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

/*
 * A WINDOW WITH NOTHING IN IT USED TO PRESS ITS OWN BUTTON, AND NO LONGER DOES.
 *
 * `maybeRollItself` lived here. With the lock on and no Call armed the dialog
 * offers a student nothing — the dice are fixed by the guide, the trait was
 * chosen before the window opened, advantage is not self-served, the
 * experiences are greyed out, the bonus field is disabled and the roll mode is
 * the module's — so what was left looked like a modal whose only live element
 * meant "yes".
 *
 * That reasoning was about the CONTROLS, and the controls were never the whole
 * of what the window is. It is the beat between deciding and finding out. It is
 * where the two faces and the modifier are read before the total lands. It is
 * where a player sees the red border of a Free Critical, or a disadvantage chip
 * they did not expect. And it is the last place to stop — the briefing's Cancel
 * is one screen and one decision earlier, which is not the same thing as being
 * able to change your mind with the dice in your hand.
 *
 * Removed on Dawid's call, 28.08: "to regresja. Nie chcemy tego — przywróćmy
 * ekran rzutu." Everything `lockControls` does stays exactly as it was; what
 * goes is only the automatic press.
 */

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

/* ==========================================================================
 * HOW MANY DICE, AND WHY
 * --------------------------------------------------------------------------
 * CANCELLING ALREADY WORKED. The three sources were summed and then clamped to
 * [-1, 1], so a player's advantage and a Monokuma's Obstacle met and produced a
 * normal roll — which is right, and is the half of this the module got correct
 * from the start.
 *
 * WHAT THE CLAMP ALSO DID was flatten two advantages into one. Every source
 * beyond the first was silently free: a Hope Call spent in a room that favours
 * exactly what you are looking for bought nothing the room had not already
 * given. And the arithmetic being thrown away was real — `performSearch` sums a
 * favouring room, a hindering room and a concealed stash; a crisis roll sums a
 * weapon in hand, a second try after a miss and the guide's compensation for
 * dying alone to a trap. All of it computed, then rounded to a sign.
 *
 * So the sum stands and only its SIZE is capped. Disadvantage subtracts from
 * the same total, which means a Monokuma's Obstacle takes away one die rather
 * than the whole bonus — the cancelling behaviour, kept, now with a scale
 * underneath it.
 *
 * THREE IS THE CEILING. Above it the difference stops being measurable: `kh` on
 * four d6 is a flat +6 in all but name, and a roll nobody can lose is not a
 * roll. Three is also the most sources this game can actually hand one
 * character at once, so the cap is a guard rather than a rule players will meet.
 * ========================================================================== */

/** The most dice any one roll can be given, in either direction. */
const ADVANTAGE_CAP = 3;

/**
 * Everything pushing on this roll, added up.
 *
 * @param {Actor}  actor
 * @param {string|null} armed  What the pending Call grants, if any.
 * @returns {{net:number, sign:number, count:number, capped:boolean, sources:object[]}}
 */
function advantageSources(actor, armed) {
    const sources = [];

    // A Call somebody paid Hope or Despair for. Always one die: a Call is a
    // purchase, and two purchases are two Calls, which sum here like anything
    // else.
    const fromCall = armed === "advantage" ? 1 : armed === "disadvantage" ? -1 : 0;
    if (fromCall) sources.push({ key: "call", value: fromCall });

    // The situation, already summed by whoever armed it - see armSituational.
    const fromRoom = situationalGrant();
    if (fromRoom) sources.push({ key: "situation", value: fromRoom });

    // The guide's "Gracz przy utracie całego stresu dostaje disadvantage na
    // każdy rzut" — a standing penalty that was declared in config and never
    // reached a die until it was wired here.
    const fromState = stateGrant(actor);
    if (fromState) sources.push({ key: "state", value: fromState });

    const net = fromCall + fromRoom + fromState;
    const size = Math.abs(net);
    return {
        net,
        sign: Math.sign(net),
        count: Math.min(ADVANTAGE_CAP, size),
        capped: size > ADVANTAGE_CAP,
        sources
    };
}

/** What the locked chip says when the player hovers it. */
function explainAdvantage(sign, count, capped, sources) {
    // One source, one die: the sentence that names the cause outright. Kept
    // because it reads better than a list of one, and because these three
    // strings are what a player has learned to recognise.
    if (sources.length === 1 && count === 1) {
        return sources[0].key === "call"
            ? "DRPG.RollDialog.forcedByCall"
            : sources[0].key === "situation"
                ? "DRPG.RollDialog.forcedBySituation"
                : "DRPG.RollDialog.forcedByState";
    }

    const list = sources
        .map(source => `${game.i18n.localize(`DRPG.RollDialog.source.${source.key}`)} ${
            source.value > 0 ? "+" : "\u2212"}${Math.abs(source.value)}`)
        .join(", ");

    // THREE SHAPES, NOT TWO. Several sources can still come to one die — a Call
    // against a doubly hostile room is exactly that — and the counting sentence
    // then has to say "1 dice", which is the sort of thing a player reads as the
    // module not knowing what it is doing. So that case gets its own wording,
    // which is about the sources rather than about the number.
    const stacked = count > 1;
    const text = game.i18n.format(
        stacked
            ? (sign === 1 ? "DRPG.RollDialog.stackedAdvantage" : "DRPG.RollDialog.stackedDisadvantage")
            : (sign === 1 ? "DRPG.RollDialog.mixedAdvantage" : "DRPG.RollDialog.mixedDisadvantage"),
        { n: count, sources: list });

    return capped
        ? `${text} ${game.i18n.format("DRPG.RollDialog.advantageCapped", { cap: ADVANTAGE_CAP })}`
        : text;
}

/**
 * Put the number on the chip.
 *
 * Trap 55: this window opens for a student ONLY when something is forced, so
 * the chip is the entire report. A chip that looks identical at one die and at
 * three tells a player they have advantage while saying nothing about the
 * advantage they are actually getting — and the tooltip is a hover away on a
 * modal they are about to dismiss with the one live button on it.
 *
 * Appended rather than written into the label: the label is the system's, and
 * a render replaces the whole chip, so this runs again on fresh markup every
 * time and needs no cleanup.
 */
function markChipCount(chip, count) {
    if (count <= 1) return;
    if (chip.querySelector(".drpg-adv-count")) return;

    const badge = document.createElement("span");
    badge.className = "drpg-adv-count";
    badge.textContent = `\u00d7${count}`;
    chip.append(badge);
}

function disable(el, tooltipKey) {
    el.disabled = true;
    el.classList.add("drpg-locked");
    el.dataset.tooltip = game.i18n.localize(tooltipKey);
}

/**
 * @param {string} tooltip  A lang KEY, or text already built.
 *   `game.i18n.localize` returns its argument unchanged when there is no such
 *   key, so the stacked explanation — which is assembled from three strings and
 *   a list — passes through untouched. One parameter rather than two, because a
 *   second one would have to be threaded through every one of the nine call
 *   sites that only ever pass a key.
 */
function lockChip(chip, tooltip) {
    chip.disabled = true;
    chip.classList.add("drpg-locked");
    chip.dataset.tooltip = game.i18n.localize(tooltip);
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

const forced = new WeakMap();

/**
 * Impose a direction AND a number of dice.
 *
 * The count is Daggerheart's own: `DualityRoll` carries `advantageNumber`, and
 * its `applyAdvantage()` builds `new advDieClass({faces, number})` and attaches
 * `kh` as soon as the number is above one. So two advantage dice are 2d6 keep
 * the highest — not 2d6 added — and it renders in the formula and in Dice So
 * Nice with nothing further from us.
 *
 * THE GUARD REMEMBERS THE PAIR, NOT THE FACT (trap 53). It used to be a
 * WeakSet, which answers "has this dialog been forced" — and that was enough
 * while there was only ever one thing to force. It is not enough now: a dialog
 * whose advantage is already 1 would satisfy the old early-out and never get
 * its second die, so a Hope Call in a favouring room would quietly be worth the
 * same as either one alone. The key is the direction and the count together;
 * asking for what is already set is still free, which is what keeps the render
 * this triggers from looping.
 */
function forceAdvantage(app, advantage, count = 1) {
    try {
        const want = `${advantage}:${count}`;
        if (forced.get(app) === want) return;

        // Already exactly right — from a previous pass, or because the player
        // is a Monokuma whose window we do not lock. Recorded so the next
        // render short-circuits above rather than re-deriving this.
        if (app.config.roll.advantage === advantage
            && Number(app.roll?.advantageNumber) === count) {
            forced.set(app, want);
            return;
        }
        forced.set(app, want);

        app.config.roll.advantage = advantage;
        app.advantage = advantage === 1;
        app.disadvantage = advantage === -1;
        // Written even when it is 1: "one die" has to be said out loud, or a
        // count left over from an earlier pass would outlive the reason for it.
        if (app.roll) app.roll.advantageNumber = count;

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
