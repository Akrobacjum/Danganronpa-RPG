/**
 * The sheet's header (E54, the sheet's family): the trait frames and glyphs, the action bar with the time of day
 * and Hope's flash, the starting resources' button, Advancement, the death mark and the GM's controls, giving and taking
 * items, the Ultimate and its public helpers (`getUltimate`, `setUltimate`, `findDuplicateUltimates`).
 */

import { STARTING, HOPE_CALLS, DESPAIR_CALLS, MODULE_ID, FLAGS } from "./config.mjs";
import { setActions, hasFreeMove, actionsLeft, actionsMax, actionBudget } from "./actions.mjs";
import { needsStartingResources, initCharacter } from "./character.mjs";
import { standingOffers, advanceKindName } from "./level-up.mjs";
import { isEclipse, movesLeft as eclipseMovesLeft } from "./eclipse.mjs";
import { isCrimeSilenced } from "./monocub.mjs";
import { armedCallsShown, isCallSilenced, isChained } from "./call-effects.mjs";
import { spentSince, markSpent } from "./motion.mjs";
import { plural, error, debug } from "./utils.mjs";
import { drpgConfirm } from "./ui-kit.mjs";
import { markStatName, statOfTrait } from "./stat-glyphs.mjs";
import { trustedWrite } from "./resource-guard.mjs";
import { overflowBlocksFreeMove } from "./overflow.mjs";
import { effectBadges as timedBadges } from "./timed-effects.mjs";
import { modeOf, sheetMode } from "./sheet-mode.mjs";

/* ==========================================================================
 * TRAIT FRAMES
 * --------------------------------------------------------------------------
 * The purple rectangle around each trait value used to be pure CSS, hung off
 * Daggerheart's `.trait-value-area`. That worked on one install and not on
 * another with the identical stylesheet, which means the selector - not the
 * rule - is what varies: a system build, a UI module or a sheet replacement
 * that renders the trait block under different class names leaves the CSS with
 * nothing to match and no way to say so.
 *
 * So the frame is claimed here instead. The element is found by several routes,
 * tagged with our own class, and styled off that. A class this file puts there
 * cannot be renamed by anyone else, and the fallback below means even a sheet
 * that has no `.trait-value-area` at all still gets framed around whatever holds
 * the number.
 * ========================================================================== */

const TRAIT_AREA_SELECTORS = [
    ".character-header-sheet .character-traits .trait .trait-value-area",
    ".character-traits .trait .trait-value-area",
    ".character-traits .trait-value-area",
    ".trait .trait-value-area"
];

export function frameTraits(element) {
    for (const selector of TRAIT_AREA_SELECTORS) {
        const areas = element.querySelectorAll(selector);
        if (!areas.length) continue;
        areas.forEach(area => area.classList.add("drpg-trait-frame"));
        return;
    }

    // Nothing named `trait-value-area` on this sheet. Frame the box the trait
    // number sits in, whatever it is called.
    const values = element.querySelectorAll(".character-traits .trait-value, .trait .trait-value");
    for (const value of values) {
        (value.closest(".trait") ?? value.parentElement ?? value).classList.add("drpg-trait-frame");
    }
}

/*
 * EACH STATISTIC'S GLYPH IN ITS MARK (E49, the owner's ask of 11.11.2026 night and his answer of 12.11.2026; stat-glyphs.mjs).
 * Daggerheart 2.6.5's header (header.hbs:107) draws `.character-traits > .trait[data-attribute="<its key>"]`, and in each
 * `.trait-name` a `.tier-mark` before the name's span: a disc half outside the plate's left end that shows
 * `system.traits.<key>.tierMarked` as the class `marked` (a gold dot) - set only by Daggerheart's own level-up automation
 * (character.mjs `prepareBaseData`), which the module never feeds, and with no action of its own (a click on it is the
 * trait's `rollAttribute`). The owner: enlarge the marks and put the glyph inside them. So the glyph goes in the mark, the
 * mark is marked `drpg-stat-mark` and its plate `drpg-stat-named` (danganronpa.css and stained-glass.css size and paint them
 * by those, the plate padded clear of the larger mark), and `marked` is left as Daggerheart drew it, so the state still
 * shows: marked, the holder is drawn in reverse (R3594). A sheet whose trait has no mark gets the glyph first in its name
 * instead. The statistic is read off `data-attribute`, not off the label (a translation). Every render draws the header
 * anew, and `markStatName` keeps a glyph already there, so a step that runs again adds nothing.
 */
export function markTraitGlyphs(element) {
    for (const trait of element.querySelectorAll(".character-traits .trait[data-attribute]")) {
        const plate = trait.querySelector(".trait-name"), mark = plate?.querySelector(":scope > .tier-mark");
        const key = statOfTrait(trait.dataset.attribute);
        if (!key || !plate) continue;
        if (mark) {
            mark.classList.add("drpg-stat-mark");
            plate.classList.add("drpg-stat-named");
        }
        markStatName(mark ?? plate.querySelector(":scope > span"), key);
    }
}

/* ==========================================================================
 * ACTION BAR + TIME OF DAY
 * --------------------------------------------------------------------------
 * Daggerheart only shows extra resources inside a pop-out tooltip, which is no
 * good for something spent twice per time of day. This draws the budget right
 * next to Hope, with the current time of day beside it.
 * ========================================================================== */

/**
 * Flash the Hope that was just spent.
 *
 * Hope is Daggerheart's own track and this module only restyles it - the pixel
 * diamonds in the stylesheet are masks over the system's markup, not a widget
 * of ours. So the flash is a class added to the system's slots after it has
 * drawn them, which is also why there is nothing to clean up: the sheet rebuilds
 * them from scratch on the next render.
 *
 * The count comes from the DOM rather than from `hopeHeld`, because the DOM is
 * what is being animated. A slot is filled when the system has put a solid
 * glyph in it - the same test the stylesheet's `:has()` makes to choose the
 * filled sprite - so the two cannot disagree about which diamonds are lit.
 */
export function flashHope(app, element, fresh = false, mode = modeOf(app)) {
    // Still for the dead and an NPC (E24 C3a; the mode's header since E45 C1): counted, never marked, as a first draw is.
    // And on a sheet the redaction takes (E45-C3b): see `markHopeChange`.
    markHopeChange(app.document, element, fresh || !mode.header.acts || mode.redact);
}

/**
 * Mark the Hope diamonds that just moved.
 *
 * SPLIT OUT BECAUSE THE FLARE HAD TWO WAYS IN AND ONLY ONE OF THEM WORKED.
 *
 * E4's flicker fix skips the whole render for an update that touches nothing
 * but a repaintable resource, and `repaintInPlace` draws what the render would
 * have drawn. It drew the diamonds correctly and never announced the change:
 * Hope moved, the pip count followed, and nothing flashed. The comment there
 * called toggling the glyph "the whole repaint", which was the mistake - the
 * mark is part of what a render does, and a repaint that stands in for a render
 * owes everything the render owed.
 *
 * `spentSince` is called even on a first draw, and only the MARKING is skipped:
 * a surface that never learned where the count started would flash the whole
 * difference on its second draw.
 */
export function markHopeChange(actor, element, fresh = false) {
    /*
     * NEVER ON A REDACTED SHEET (E45-C3b, 09.11.2026; found by scenario 71 J3). The count comes from the glyphs, and the
     * redaction (anonymity.mjs `redactValues`) takes them out after the render counted them: the first repaint read 0
     * held and marked every diamond the render had seen as spent - on p2's view of Aiko, three marked for her three
     * Hope ({"hopeText":"??????","hopeClasses":3}), and a mark the redaction never strips. Its callers pass `fresh`
     * for a sheet the mode redacts, so nothing on it is marked; counted as a first draw is.
     */
    const slots = element?.querySelectorAll?.(
        ".character-header-sheet .hope-section .hope-value") ?? [];
    if (!slots.length) return;

    const held = Array.from(slots).filter(s => s.querySelector("i.fa-solid")).length;
    const spent = spentSince("sheet:hope", actor.id, held);
    if (fresh || !spent) return;

    /*
     * WIPE THE LAST MARK BEFORE MAKING A NEW ONE.
     *
     * `markSpent` adds a class and never takes it off, which was always true
     * and never mattered: a render builds new elements, so the mark went with
     * the old ones. Since E4 a Hope change SKIPS the render - `repaintInPlace`
     * stands in for it - and these same six diamonds live on across every
     * change. Two things then went wrong at once, and together they are
     * exactly "it does not fire and it shows the wrong thing":
     *
     *   the class stayed, so a pip spent an hour ago still read as spent, and a
     *   pip that was spent and later regained carried BOTH marks;
     *
     *   and adding a class an element already has does not restart a CSS
     *   animation, so the second spend of the same diamond flashed nothing.
     *
     * Cleared on every slot rather than only the ones about to be marked: the
     * stale mark is on whichever pips moved LAST time, which is not the set
     * moving now. The read of `offsetWidth` is what makes the browser commit the
     * removal, so re-adding counts as a change and the animation runs again.
     */
    for (const slot of slots) {
        slot.classList.remove("drpg-spent", "drpg-gained");
        slot.style.removeProperty("animation-delay");
        slot.style.removeProperty("--drpg-spent-age");
    }
    void slots[0].offsetWidth;

    for (let i = spent.from; i <= Math.min(spent.to, slots.length); i++) {
        markSpent(slots[i - 1], spent, i);
    }
}

// Always draw the full base budget. A wounded character keeps both circles,
// but the one they have lost shows as a locked red slot - clearer than
// silently rendering "1 / 1", which reads like an action already spent.
function actionPips(actor, { left, max, spentActions, fresh, viewer = false, still = false, gm = false }) {
    const pips = [];
    const budget = Math.max(max, 1);
    for (let i = 1; i <= Math.max(STARTING.actions, budget); i++) {
        const locked = i > budget;
        const filled = !locked && i <= left;

        const pip = document.createElement("span");
        pip.className = `drpg-action-pip${filled ? " filled" : ""}${locked ? " locked" : ""}`;
        // The pips between the old reading and the new one: the ones just paid.
        // Built empty like any other unspent socket; the mark only says how
        // they got that way. See the keyframes in the stylesheet.
        markSpent(pip, fresh || still ? null : spentActions, i);
        pip.dataset.value = String(i);
        pip.innerHTML = `<i class="fa-${filled ? "solid" : "regular"} fa-circle" inert></i>`;

        if (still) {
            // The dead's and an NPC's pips are drawn still (E24 C3a, the mode's header): no budget to read, none to correct.
        } else if (locked) {
            // A viewer's pips say nothing (S03-06, the mode's `viewer`); the redaction marks them.
            if (!viewer) pip.dataset.tooltip = game.i18n.localize("DRPG.Actions.lockedTooltip");
        } else if (gm) {
            // GM only: players spend actions by taking actions, not by clicking.
            pip.classList.add("gm-editable");
            pip.dataset.tooltip = game.i18n.format("DRPG.Actions.pipTooltip", { n: i });
            // A `<span>` with a click handler is invisible to the keyboard, and
            // this is the only way a GM corrects somebody's budget by hand.
            pip.tabIndex = 0;
            pip.setAttribute("role", "button");
            pip.setAttribute("aria-label", game.i18n.format("DRPG.Actions.pipTooltip", { n: i }));
            const set = () => setActions(actor, i === left ? i - 1 : i);
            pip.addEventListener("click", set);
            pip.addEventListener("keydown", event => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                set();
            });
        } else if (!viewer) {
            pip.dataset.tooltip = plural("DRPG.Actions.pipReadOnly", { left, max: budget }, "max");
        }
        pips.push(pip);
    }
    return pips;
}

/* ---- free move ---- */

/**
 * THE MOVE IS TWO FEET, ALWAYS (E49 B2; the owner, 10.11.2026: "dwie stópki: jedna taka jak teraz, druga w kolorze
 * eclipse, by było wiadomo czemu gracz ma 2 sloty ruchu w porze dnia, ale tylko 1 dostępny ... zależy nam na stałych
 * layoutach"). Until B2 the sheet drew one foot from `hasFreeMove` and read nothing of the Eclipse, while the HUD strip
 * drew one foot per crossing LEFT (none left: one outlined) - a row that changed its length with the Eclipse and with
 * every crossing. Now both draw these two slots in the same places: the first the time of day's free Move, the second
 * the Eclipse's own colour. Outside an Eclipse the second is `off` (drawn, dimmed: the slot exists and is not yours
 * now); in one the two are its crossings, the first lit while one is left and the second while two are (eclipse.mjs
 * `movesLeft`; a Call that grants a third shows two lit and says the number in the tooltip), and a free placement
 * (`null`, D197) is `anywhere` on both. Nothing appears, vanishes or moves when the Eclipse starts or ends.
 *
 * @param {{eclipse?: boolean, moves?: number|null, free?: boolean, fog?: boolean}} state
 * @returns {{slot: "free"|"eclipse", state: "available"|"spent"|"fogged"|"off"|"anywhere"}[]}
 */
export function moveSlots({ eclipse = false, moves = null, free = false, fog = false } = {}) {
    if (!eclipse) return [{ slot: "free", state: free ? "available" : fog ? "fogged" : "spent" }, { slot: "eclipse", state: "off" }];
    if (moves === null) return [{ slot: "free", state: "anywhere" }, { slot: "eclipse", state: "anywhere" }];
    const n = Math.max(0, Number(moves) || 0);
    return [{ slot: "free", state: n >= 1 ? "available" : "spent" }, { slot: "eclipse", state: n >= 2 ? "available" : "spent" }];
}

/** The two feet's markup: solid while a slot can be taken, outlined otherwise (the action pips' pair). */
export function moveFeetHtml(slots) {
    return slots.map(({ slot, state }) => `<i class="fa-${state === "available" || state === "anywhere" ? "solid" : "regular"} fa-shoe-prints drpg-move-slot" data-drpg-slot="${slot}" data-drpg-state="${state}" inert></i>`).join("");
}

/** What the two feet mean, said once beside the row's own sentence (S03-31's legend). */
export function moveLegend() {
    return game.i18n.localize("DRPG.Actions.moveLegend");
}

function freeMovePip(actor, { spentMove, fresh, viewer = false, still = false }) {
    const move = document.createElement("span");
    const freeMove = hasFreeMove(actor);
    /* FOG IS A THIRD STATE (E24 C3b, 08.11.2026; E24-24, audit S03-13). `hasFreeMove` answers no under the Overflow's
       Fog, and the pip said "Free Move used" of a Move nobody spent. Drawn as a spent one (it is not there to take),
       with `drpg-fogged` and Fog's reason in the tooltip. */
    const fog = !freeMove && overflowBlocksFreeMove();
    const eclipse = isEclipse();
    const moves = eclipse ? eclipseMovesLeft(actor) : null;
    const slots = moveSlots({ eclipse, moves, free: freeMove, fog: fog && !eclipse });
    const lit = slots.some(({ state }) => state === "available" || state === "anywhere");
    move.className = `drpg-free-move${lit ? " available" : " spent"}${fog && !eclipse ? " drpg-fogged" : ""}`;
    markSpent(move, fresh || still ? null : spentMove);
    if (!viewer && !still) {
        const says = eclipse
            ? `${moves === null ? game.i18n.localize("DRPG.Actions.eclipseFreePlacement") : plural("DRPG.Actions.eclipseMovesLeft", { n: moves })}.`
            : game.i18n.localize(freeMove ? "DRPG.Actions.freeMoveAvailable" : fog ? "DRPG.SheetNotes.fogFreeMove" : "DRPG.Actions.freeMoveSpent");
        move.dataset.tooltip = `${says} ${moveLegend()}`;
    }
    // Solid while it is there, OUTLINED once it is gone - the same pair the
    // action pips use (`fa-solid fa-circle` / `fa-regular fa-circle`), so a
    // spent Move and a spent action say the same thing in the same way. Foundry
    // ships Font Awesome Pro, which carries every icon in both weights.
    move.innerHTML = moveFeetHtml(slots);
    return move;
}

/* ---- a Call waiting on the next roll ---- */
//
// Until now the only place an armed Call was visible was inside the roll
// window. That is too late twice over: a player who has banked a Free
// Critical forgets it is there, and a player a Monokuma has just saddled
// with Obstacle has no idea until the dice are already in front of them.
//
// BESIDE the pips, not below them.
//
// Underneath, the badge pushed the whole header down and read as a footnote
// to the action count. What it actually is, is the other half of the same
// sentence: this is what you have, and this is what is riding on your next
// roll. Side by side is where a player reads them together.
//
// A column, not a single slot: a Hope Call the player armed and a Despair
// Call or a Monocub's Meddle landing on them are two different facts about
// the same turn, and the layout has room for both stacked without moving
// anything else.
export function pendingStack(actor) {
    const stack = document.createElement("div");
    stack.className = "drpg-pending-stack";

    // WHAT IS ON THEM NOW, not only what is riding on the next roll.
    //
    // The badge shipped in 17.5 read `pendingCall` and nothing else, so it
    // showed the half of this that is about dice and silently dropped the half
    // that is about the rest of the turn. Silenced and chained do not arrive
    // through `pendingCall` at all - they live in the world's `restrictions`
    // setting - and a Monocub silenced for the chapter is a flag on the actor.
    // A player under all three saw an empty corner.
    //
    // Same pink treatment as a Despair Call: these are all things done TO them.
    for (const effect of standingEffects(actor)) {
        const badge = document.createElement("div");
        badge.className = "drpg-pending-call drpg-pending-despair";
        badge.dataset.tooltip = game.i18n.localize(effect.tooltip);
        badge.innerHTML = `<i class="fa-solid ${effect.icon}" inert></i>
                           <span>${foundry.utils.escapeHTML(game.i18n.localize(effect.label))}</span>`;
        stack.append(badge);
    }

    // One badge per armed Call: they stack (CALL-02), and the sheet has drawn a
    // list here since before they did. A Confusion's from the GMs' store or the
    // owner's copy, not the flag (E06 fix r2-G4).
    for (const entry of armedCallsShown(actor)) {
        const despair = entry.kind === "despair";
        // The badge wears the CALL'S NAME - "Determination", "Obstacle" - not
        // the grant phrase behind it. The phrases were written for sentences
        // ("waiting on your next roll: …") and did not fit the sheet, which is
        // exactly where Dawid met "a statistic of their choice" overflowing
        // its badge. The armed entry has carried the call's key all along; the
        // phrase stays as the fallback for an entry old enough not to.
        const call = (despair ? DESPAIR_CALLS : HOPE_CALLS)[entry.key];
        // The nominative, standing alone on the badge and after the tooltip's colon (call-effects.mjs `grantWords`, E66 C3).
        const label = call?.label ?? game.i18n.localize(`DRPG.Calls.grantsNom.${entry.grants}`);
        const badge = document.createElement("div");
        badge.className = `drpg-pending-call drpg-pending-${despair ? "despair" : "hope"}`;
        badge.dataset.tooltip = game.i18n.format("DRPG.Calls.pendingTooltip", {
            what: game.i18n.localize(`DRPG.Calls.grantsNom.${entry.grants}`)
        });
        badge.innerHTML = `<i class="fa-solid ${despair ? "fa-skull" : "fa-hand-sparkles"}" inert></i>
                           <span>${foundry.utils.escapeHTML(label)}</span>`;
        stack.append(badge);
    }

    // A room action's timed effects (the owner's answer to Q-E93-3; the owner's asks of 12.11.2026, "w podobnym miejscu co
    // efekty hope calls", then a name of one or two words, the rest in the tooltip, and white): a Call's badge as a white
    // chip, apart from the Hope Calls' gold - its short name on it, what it does and until when in the tooltip - read on a
    // GM off the GMs' store and on an owner's browser off their copy (timed-effects.mjs `effectBadges`). Stained Glass
    // wears the candle on it (tools/glyphs.json glass "timed-effect").
    for (const { short, what, until } of timedBadges(actor)) {
        const badge = document.createElement("div");
        badge.className = "drpg-pending-call drpg-pending-timed drpg-timed-badge";
        badge.dataset.tooltip = game.i18n.format("DRPG.Facility.timedBadge", { what, until });
        badge.innerHTML = `<i class="fa-solid fa-hourglass-half" inert></i>
                           <span>${foundry.utils.escapeHTML(short)}</span>`;
        stack.append(badge);
    }
    return stack;
}

/**
 * The header's Actions section. A viewer - somebody looking at a sheet that is not theirs, neither a GM nor an owner
 * (the mode's `viewer`, E45 C1) - is drawn no tooltip and no stack:
 *
 * A VIEWER IS DRAWN NOTHING THE REDACTION WOULD HAVE TO TAKE BACK (E05 C15,
 * 27.09.2026; audit S03-06). anonymity.mjs turns a viewer's pips and free Move
 * into question marks, and their tooltips stayed - "1 of 2 actions this time of
 * day", "Free Move used" - a hover away; and the stack beside them showed the
 * Calls armed on the owner's next roll, whispered to the owner and the GM
 * everywhere else, with nothing on the sheet taking it off. So the three are not
 * drawn for a viewer at all, whether or not the table enforces anonymity, and the
 * redaction strips them too (`redactValues`) for anything a later hand adds.
 */
export function injectActionBar(app, element, fresh = false, mode = modeOf(app)) {
    const row = element.querySelector(".character-header-sheet .character-row");
    if (!row || row.querySelector(".drpg-actions-section")) return;

    const actor = app.document;
    const { viewer, pipEdit: gm } = mode;
    const still = !mode.header.acts;
    const left = actionsLeft(actor);
    const max = actionsMax(actor);
    // The lost action's mark, not the state's (E64 C1c): Wounded takes no action in the Class Trial.
    const { costsAction: wounded } = actionBudget(actor);

    // What went out since this sheet last drew itself. Recorded even when it is
    // not shown - a first draw still has to know where the count started, or
    // the NEXT draw would flash the whole difference.
    const spentActions = spentSince("sheet:actions", actor.id, left);
    const spentMove = spentSince("sheet:move", actor.id, hasFreeMove(actor) ? 1 : 0);

    const section = document.createElement("div");
    section.className = `drpg-actions-section${still ? " drpg-still" : ""}`;

    /* ---- action pips ---- */
    const actions = document.createElement("div");
    actions.className = "drpg-actions";

    const label = document.createElement("h4");
    label.textContent = game.i18n.localize("DRPG.Actions.label");
    if (wounded && !still) {
        label.classList.add("drpg-wounded");
        label.dataset.tooltip = game.i18n.localize("DRPG.Actions.woundedTooltip");
    }
    actions.append(label);

    for (const pip of actionPips(actor, { left, max, spentActions, fresh, viewer, still, gm })) actions.append(pip);

    actions.append(freeMovePip(actor, { spentMove, fresh, viewer, still }));

    section.append(actions);

    const stack = viewer || still ? null : pendingStack(actor);
    if (stack?.children.length) section.append(stack);

    // Sit right after Hope, before the domains/downtime buttons.
    const hope = row.querySelector(".resource-section");
    if (hope) hope.after(section);
    else row.prepend(section);
}

/**
 * Restrictions currently in force on this character.
 *
 * Three separate stores, because they are three separate rules with three
 * separate lifetimes, and merging them would be a lie about how long each one
 * lasts:
 *
 *   silenced (Call)   world `restrictions`, until this time of day ends
 *   chained           world `restrictions`, until this time of day ends
 *   silenced (cub)    a flag on the actor, for the rest of the chapter
 *
 * Read rather than cached: all three can be lifted by somebody else's screen
 * between one render of this sheet and the next.
 */
function standingEffects(actor) {
    const out = [];
    if (!actor) return out;

    if (isCallSilenced(actor)) {
        out.push({ icon: "fa-comment-slash", label: "DRPG.Calls.silencedBadge",
                   tooltip: "DRPG.Calls.silencedNotice" });
    }
    if (isChained(actor)) {
        out.push({ icon: "fa-link", label: "DRPG.Calls.chainedBadge",
                   tooltip: "DRPG.Calls.chainedNotice" });
    }
    // The Monocub's is a different silence - it is about speaking at the table,
    // not about spending Hope - so it says so rather than sharing a label.
    if (isCrimeSilenced(actor)) {
        out.push({ icon: "fa-user-slash", label: "DRPG.Monocub.silencedBadge",
                   tooltip: "DRPG.Monocub.silencedTooltip" });
    }
    return out;
}

/* ==========================================================================
 * STARTING RESOURCES
 * --------------------------------------------------------------------------
 * Daggerheart derives max Health and Sanity from a class, and this game has no
 * classes - so `initCharacter` is the only thing that ever writes them. Until
 * it runs, a fresh student reads `max: 0` on both tracks, which means
 * `remaining() <= 0` on both: Wounded AND Breakdown, one action instead of two,
 * and disadvantage forced onto every roll. Every one of those is correct
 * behaviour for a character who has been through something; none of it is
 * correct for a character who has not been set up yet.
 *
 * The button only exists while that is true, so it is a warning as much as a
 * control: a sheet showing it is a sheet that is not ready to play, and it
 * disappears the moment it is used.
 * ========================================================================== */

/** Has this character been given the guide's starting resources? */
function needsInit(actor) {
    // Below, not different: an advanced sheet is a set-up sheet (SEASON-01).
    return needsStartingResources(actor);
}

export function injectInitButton(app, element, mode = modeOf(app)) {
    if (!mode.init) return;
    const actor = app.document;
    // A Monokuma has no tracks worth setting - `setMonokuma` deliberately zeroes
    // what a student uses, so this would light up permanently on the GM's own sheet.
    if (!needsInit(actor)) return;

    const nameRow = element.querySelector(".character-header-sheet .name-row");
    if (!nameRow || nameRow.querySelector("[data-drpg-init]")) return;

    const tip = game.i18n.format("DRPG.Character.initTooltip", {
        hp: STARTING.hp, stress: STARTING.stress, hope: STARTING.hope
    });

    const button = headerButton({ cls: "drpg-init-button", data: { drpgInit: "" }, icon: "fa-wand-sparkles", tip });

    button.addEventListener("click", async () => {
        // A question on the kit's frame (E21 C5a).
        const confirmed = await drpgConfirm({
            yes: { label: game.i18n.localize("DRPG.Dialog.yes") },
            title: game.i18n.localize("DRPG.Character.initTitle"),
            classes: ["drpg-panel", "drpg-narrow"],
            body: `<p>${game.i18n.format("DRPG.Character.initConfirm", {
                actor: foundry.utils.escapeHTML(actor.name),
                hp: STARTING.hp, stress: STARTING.stress, hope: STARTING.hope
            })}</p>
            <p class="notes">${game.i18n.localize("DRPG.Character.initNote")}</p>`,
            rejectClose: false
        });
        if (!confirmed) return;

        await initCharacter(actor);
        // The two conditions key off the tracks this just wrote, so they have to
        // be re-derived rather than left showing the pre-init state.
        const { syncStates } = await import("./states.mjs");
        await syncStates(actor).catch(() => {});
        app.render(false);
    });

    nameRow.append(button);
}

/* ==========================================================================
 * ADVANCEMENT BUTTON
 * --------------------------------------------------------------------------
 * The Daggerheart level pill is hidden, so advancement needs its own way in.
 * A button on the sheet beats a macro the GM has to install by hand.
 * ========================================================================== */

export function injectAdvanceButton(app, element, mode = modeOf(app)) {
    /*
     * THE PLAYER GETS THIS BUTTON TOO, WHEN ONE IS WAITING FOR THEM (N-2, 20.09).
     *
     * It was the GM's alone, because advancement is the GM's to award. It still is:
     * what a player can reach is an OFFER the GM left on their character, and even
     * then the picks they make are sent to the GM's client to be checked and
     * written (see `openAdvancement` and `requestAdvancement`). No offer, no button.
     *
     * LIT UP RATHER THAN MERELY PRESENT. A player does not watch the top of their
     * own sheet for new controls; the class below is what makes it read as
     * something waiting to be answered, and the tooltip says which kind was earned.
     */
    // The owner's alone. Another player opening this sheet used to see the lit badge
    // and read the kind off its tooltip - after a wrong verdict, the Blackened's
    // Reinforced Level Up, on the one character who has it (review of stage D).
    //
    // AND THE GM'S (E10 C6, 1.2.71; audit S03-17). A GM was handed no offer here, so the
    // GM's button never lit and nothing said one stood: it lights from the GMs' store now,
    // and says how many stand; its menu takes one back (level-up.mjs `openAdvancementFor`).
    const offers = !mode.offers ? [] : standingOffers(app.document);
    const [offer] = offers;

    const nameRow = element.querySelector(".character-header-sheet .name-row");
    const standing = nameRow?.querySelector("[data-drpg-advance]");
    // No Level Up for an NPC not in the class (E24 C3a, E24-20): no verdict offers one, and the GM's button would.
    if (!mode.levelUp) {
        standing?.remove();
        return;
    }
    // A player with nothing on offer has no button: a header drawn again after the offer
    // was spent or taken back used to keep the lit one, whose press said "GM only" (S03-17).
    if (!mode.gm && !offer) {
        standing?.remove();
        return;
    }
    if (!nameRow) return;

    const count = offers.length > 1 ? plural("DRPG.Advance.standing", { n: offers.length }) : "";
    const tip = mode.gm
        ? (offer ? plural("DRPG.Advance.standing", { n: offers.length }) : game.i18n.localize("DRPG.Advance.buttonTooltip"))
        : [game.i18n.format("DRPG.Advance.offerTooltip", { kind: advanceKindName(offer.kind) }), count]
            .filter(Boolean).join(" ");
    if (standing) {
        // A sheet re-rendered after the offer was taken must not keep the glow.
        standing.classList.toggle("is-offered", Boolean(offer));
        standing.dataset.tooltip = tip;
        standing.setAttribute("aria-label", tip);
        return;
    }

    const button = headerButton({ data: { drpgAdvance: "" }, icon: "fa-angles-up", tip, caption: game.i18n.localize("DRPG.Advance.caption") });
    if (offer) button.classList.add("is-offered");

    button.addEventListener("click", async () => {
        const { openAdvancementFor, openAdvancement } = await import("./level-up.mjs");
        // The GM is asked which kind and who picks; the player is not asked
        // anything - the offer already says which kind, and they are the who.
        if (mode.gm) await openAdvancementFor(app.document);
        else await openAdvancement(app.document);
    });

    nameRow.append(button);
}


/* ==========================================================================
 * WHO THIS IS: THE DEATH MARK AND THE GM'S CONTROLS
 * --------------------------------------------------------------------------
 * E24 C3a, 08.11.2026 (audit S03-15, S03-36; E24-18, E24-19; the owner's
 * answer to Q-E24-5 and STAGE.md "Amend 08.11" A2).
 * ========================================================================== */

/**
 * The sheet's state on its root, for the stylesheet: `drpg-sheet-still` while the header is still (the mode's header),
 * `drpg-dead-sheet` and the stamp on the portrait for the dead (a Monocub's sheet plays on and carries neither),
 * `drpg-npc-sheet` for an NPC not in the class. Dead as the viewer may know it, so a player who does not know of a
 * death sees no mark (`sheetMode`'s death: the table's fact on anybody else's sheet).
 */
export function markSheetState(app, element, mode = modeOf(app)) {
    const root = element instanceof HTMLElement ? element : element?.[0];
    if (!root?.classList) return;
    const { acts, mark, npc } = mode.header;
    root.classList.toggle("drpg-sheet-still", !acts);
    root.classList.toggle("drpg-dead-sheet", mark);
    root.classList.toggle("drpg-npc-sheet", npc);
    const portrait = root.querySelector(".character-sidebar-sheet .portrait");
    portrait?.querySelectorAll(".drpg-death-mark").forEach(stamp => stamp.remove());
    if (!mark || !portrait) return;
    const stamp = document.createElement("span");
    stamp.className = "drpg-death-mark";
    stamp.textContent = game.i18n.localize("DRPG.Class.deathMark");
    portrait.append(stamp);
}

/**
 * THE GM'S CONTROLS OF WHO IS A STUDENT, ON THE SHEET'S HEADER. "Not in the class" (`FLAGS.notInClass`, a toggle, its
 * state on `aria-pressed`) on every character, and Mark as Monokuma on a student or Unmark as Monokuma on a Monokuma -
 * each in the state it changes. Mark and Unmark were the Actors directory's right-click entries (monokuma.mjs, E22
 * C3b); the mark of a player's character still asks first (`markFromSheet`), Unmark does not. A GM's only: a player's
 * sheet draws none, and the writes refuse a player (`setNotInClass`, `setMonokuma`) whatever a console calls.
 * Redrawn each render, so a control shows the state the sheet was drawn in.
 */
export function injectClassControls(app, element, mode = modeOf(app)) {
    const nameRow = element.querySelector(".character-header-sheet .name-row");
    nameRow?.querySelectorAll("[data-drpg-class-control]").forEach(button => button.remove());
    if (!mode.classControls || !nameRow) return;
    const actor = app.document;
    const { npc: out, monokuma } = mode;
    const control = (kind, icon, tip, run, pressed = null) => {
        const button = headerButton({ cls: "drpg-class-control", data: { drpgClassControl: kind }, icon, tip });
        if (pressed !== null) button.setAttribute("aria-pressed", String(pressed));
        button.addEventListener("click", async () => {
            button.disabled = true;
            try {
                await run();
            } catch (err) {
                error("Could not change who is a student", err);
            } finally {
                button.disabled = false;
            }
        });
        nameRow.append(button);
    };
    control("notInClass", "fa-user-slash", game.i18n.localize(out ? "DRPG.Class.inTooltip" : "DRPG.Class.outTooltip"), async () => {
        const { setNotInClass } = await import("./monokuma.mjs");
        await setNotInClass(actor, !sheetMode(actor).npc);
    }, out);
    if (monokuma) {
        control("unmark", "fa-masks-theater", game.i18n.localize("DRPG.Monokuma.unmark"), async () => {
            const { setMonokuma } = await import("./monokuma.mjs");
            await setMonokuma(actor, false);
        });
    } else {
        control("mark", "fa-masks-theater", game.i18n.localize("DRPG.Monokuma.toggle"), async () => {
            const { markFromSheet } = await import("./monokuma.mjs");
            await markFromSheet(actor);
        });
    }
}

/* ==========================================================================
 * GIVE / TAKE ITEMS
 * --------------------------------------------------------------------------
 * Right where the GM is already looking when they decide somebody should have
 * something - or should stop having it.
 * ========================================================================== */

export function injectItemButton(app, element, mode = modeOf(app)) {
    if (!mode.itemButton) return;

    const nameRow = element.querySelector(".character-header-sheet .name-row");
    if (!nameRow || nameRow.querySelector("[data-drpg-items]")) return;

    const button = headerButton({ cls: "drpg-items-button", data: { drpgItems: "" }, icon: "fa-box-open",
        tip: game.i18n.localize("DRPG.Items.buttonTooltip"), caption: game.i18n.localize("DRPG.Items.caption") });

    button.addEventListener("click", async () => {
        const { openItemManager } = await import("./gm-items.mjs");
        await openItemManager(app.document);
    });

    nameRow.append(button);
}

/**
 * ONE BUILDER FOR THE NAME ROW'S BUTTONS (E49 B2, S03-31: "buttons without captions: Level Up and Give/Take are bare
 * glyphs"). Initialise, Level Up, the class controls and Give / take were four copies of the same eight lines, each
 * an icon with its words in the tooltip alone. `caption` draws the words beside the icon as well, for the two a player
 * or a GM meets on every sheet (Level Up, Give / take); the GM's one-off controls keep the icon and the tooltip.
 */
function headerButton({ cls = "", data = {}, icon, tip, caption = "" }) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `drpg-advance-button${cls ? ` ${cls}` : ""}`;
    for (const [key, value] of Object.entries(data)) button.dataset[key] = value;
    button.dataset.tooltip = tip;
    button.setAttribute("aria-label", tip);
    button.innerHTML = `<i class="fa-solid ${icon}" inert></i>`
        + (caption ? `<span class="drpg-header-caption">${foundry.utils.escapeHTML(caption)}</span>` : "");
    return button;
}

/* ==========================================================================
 * ULTIMATE
 * ========================================================================== */

export function injectUltimate(app, element, mode = modeOf(app)) {
    const details = element.querySelector(".character-header-sheet .character-details");
    if (!details) return;

    const actor = app.document;
    const ultimate = actor.getFlag(MODULE_ID, FLAGS.ultimate) ?? "";
    const editable = mode.editable;

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
    // textContent, never innerHTML - this string is player-supplied.
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
        await trustedWrite(actor, { [`flags.${MODULE_ID}.${FLAGS.ultimate}`]: next }, { reason: "ultimate" });
        debug(`Ultimate for ${actor.name} set to "${next}".`);
    } catch (err) {
        error("Could not save the Ultimate", err);
        field.textContent = current;
    }
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
    return actor ? trustedWrite(actor, { [`flags.${MODULE_ID}.${FLAGS.ultimate}`]: String(value ?? "").trim() }, { reason: "ultimate" }) : undefined;
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
