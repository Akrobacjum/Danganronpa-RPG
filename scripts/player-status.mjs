/**
 * Danganronpa RPG — the player's own three numbers, on screen.
 * ---------------------------------------------------------------------------
 * The HUD carries world state: campaign, chapter, day, phase, time of day. All
 * of it changes roughly once every forty minutes.
 *
 * The three things a player checks constantly — how many actions are left,
 * whether the free Move is still there, how much Hope they hold — lived only on
 * the character sheet. So the sheet had to be open, on top, and on the right tab
 * to answer "can I still do this?", which is a question that comes up before
 * every single declaration.
 *
 * This is that answer, pinned above the Projects tray, where the eye already
 * goes for the other standing numbers.
 *
 * Deliberately not on the HUD itself: the HUD is what everyone shares and reads
 * the same way, and this is personal. A GM has no character, so they get the
 * table's view instead — how many players still have actions left, which is the
 * same question from the other side.
 */

import { MODULE_ID } from "./config.mjs";
import { actionsLeft, actionsMax, hasFreeMove } from "./actions.mjs";
import { hopeHeld } from "./calls.mjs";
import { isMonokuma } from "./monokuma.mjs";
import { isDeceased } from "./chapter.mjs";
import { isMonocub } from "./monocub.mjs";
import { error } from "./utils.mjs";

const WIDGET_ID = "drpg-player-status";

export function registerPlayerStatus() {
    Hooks.once("ready", renderPlayerStatus);
    Hooks.on("canvasReady", () => renderPlayerStatus());

    // Actions, Hope and the free-Move flag all live on the actor, so one hook
    // covers every route that changes them: spending an action, a rest, an
    // Eclipse refill, a GM correction.
    Hooks.on("updateActor", actor => {
        if (relevant(actor)) renderPlayerStatus();
    });
    // The clock refills budgets, and a GM's readout counts every player.
    Hooks.on("updateSetting", setting => {
        if (setting?.key?.startsWith(`${MODULE_ID}.`)) renderPlayerStatus();
    });
}

/** Does this actor's change affect what is currently on screen? */
function relevant(actor) {
    if (!actor) return false;
    return game.user.isGM || actor.id === game.user.character?.id;
}

/** Every student whose budget a GM is watching. */
function trackedStudents() {
    return game.actors.filter(a =>
        a.type === "character" && !isMonokuma(a) && !isDeceased(a));
}

export function renderPlayerStatus() {
    try {
        document.getElementById(WIDGET_ID)?.remove();

        // Above the Projects tray. Falling back through the column and then the
        // right rail keeps this working on a layout module that has moved or
        // renamed the tray rather than dropping the widget entirely.
        const projects = document.querySelector("#countdowns");
        const host = projects?.parentElement
            ?? document.querySelector("#ui-right-column-1")
            ?? document.querySelector("#ui-right");
        if (!host) return;

        const el = game.user.isGM ? buildGmView() : buildPlayerView();
        if (!el) return;

        el.id = WIDGET_ID;
        el.addEventListener("pointerdown", event => event.stopPropagation());

        if (projects && projects.parentElement === host) host.insertBefore(el, projects);
        else host.prepend(el);
    } catch (err) {
        error("Could not render the player status strip", err);
    }
}

function box() {
    const el = document.createElement("div");
    el.className = "drpg-status";
    return el;
}

function field(className, label, value, tooltipKey) {
    const wrap = document.createElement("div");
    wrap.className = `drpg-status-field ${className}`;
    if (tooltipKey) wrap.dataset.tooltip = game.i18n.localize(tooltipKey);

    const k = document.createElement("span");
    k.className = "drpg-status-label";
    k.textContent = label;

    const v = document.createElement("span");
    v.className = "drpg-status-value";
    v.textContent = value;

    wrap.append(k, v);
    return wrap;
}

/**
 * The same marks the sheet draws, in the same order.
 *
 * A number and a row of pips are not interchangeable here. The sheet has always
 * shown actions as pixel dots and Hope as pixel diamonds, and a player reads
 * those shapes without counting — "two dots left" lands before "2/2" does. A
 * strip that said 2/2 in text was a second, competing way of saying the thing
 * the sheet already says well, which is exactly how two readings of the same
 * number end up disagreeing in someone's head mid-turn.
 *
 * The classes are the sheet's own, so the masks, the filled/empty states and
 * the pixel rendering all come from the rules that already style them.
 */
function pips(className, held, max, { cap = 12 } = {}) {
    const row = document.createElement("span");
    row.className = "drpg-status-pips";

    // A generous Hope or action pool would otherwise push the three fields out
    // of the tray's width. Past the cap it falls back to the number, which is
    // the one case where the digits genuinely read better.
    if (max > cap) {
        const text = document.createElement("span");
        text.className = "drpg-status-value";
        text.textContent = `${held}/${max}`;
        row.append(text);
        return row;
    }

    for (let i = 1; i <= max; i++) {
        const pip = document.createElement("span");
        pip.className = `${className}${i <= held ? " filled" : ""}`;
        row.append(pip);
    }
    return row;
}

function marks(className, label, node, tooltipKey, spent) {
    const wrap = document.createElement("div");
    wrap.className = `drpg-status-field ${className}${spent ? " spent" : ""}`;
    if (tooltipKey) wrap.dataset.tooltip = game.i18n.localize(tooltipKey);

    const k = document.createElement("span");
    k.className = "drpg-status-label";
    k.textContent = label;

    wrap.append(k, node);
    return wrap;
}

function buildPlayerView() {
    const actor = game.user.character;
    // No character, or a Monokuma actor assigned to a player account: nothing
    // here applies, so show nothing rather than a row of zeroes.
    if (!actor || isMonokuma(actor)) return null;

    const el = box();
    const left = actionsLeft(actor);
    const max = actionsMax(actor);
    const free = hasFreeMove(actor);

    el.append(marks("is-actions", game.i18n.localize("DRPG.Actions.label"),
        pips("drpg-status-pip drpg-action-pip", left, max),
        left ? "DRPG.Actions.pipReadOnly" : "DRPG.Actions.allSpent",
        !left));

    // The sheet marks the free Move with a footprint rather than a pip, because
    // there is only ever one of it — so this does too.
    const foot = document.createElement("span");
    foot.className = `drpg-status-pips drpg-free-move ${free ? "available" : "spent"}`;
    foot.innerHTML = `<i class="fa-solid fa-shoe-prints" inert></i>`;
    el.append(marks("is-move", game.i18n.localize("DRPG.Move.title"), foot,
        free ? "DRPG.Actions.freeMoveAvailable" : "DRPG.Actions.freeMoveSpent",
        !free));

    // Hope is shown to the living and to Monocubs, and to nobody else.
    //
    // A Monocub is dead, but Confusion — the one action they have left — costs
    // an action AND a point of Hope, and that Hope only exists because a GM
    // converted Despair into it. So it is the number they most need on screen:
    // a Monocub with actions left and no Hope cannot do the single thing they
    // are still at the table to do, and nothing else would tell them why.
    //
    // A plainly dead student spends nothing, so for them the row really is
    // furniture and stays hidden.
    if (!isDeceased(actor) || isMonocub(actor)) {
        const held = hopeHeld(actor);
        const hopeMax = Number(actor.system?.resources?.hope?.max ?? held);
        el.append(marks("is-hope", game.i18n.localize("DAGGERHEART.GENERAL.hope") || "Hope",
            pips("drpg-status-pip drpg-status-hope-pip", held, hopeMax),
            null, held === 0));
    }

    return el;
}

/**
 * The GM's version of the same question: who can still act.
 *
 * A GM waiting to move the clock wants one number — how many students have
 * anything left — not five personal budgets they would have to add up.
 */
function buildGmView() {
    const students = trackedStudents();
    if (!students.length) return null;

    const withActions = students.filter(a => actionsLeft(a) > 0).length;
    const withMove = students.filter(a => hasFreeMove(a)).length;

    const el = box();
    el.classList.add("is-gm");

    const actions = field("is-actions", game.i18n.localize("DRPG.Actions.label"),
        `${withActions}/${students.length}`, "DRPG.Hud.stillToActTooltip");
    if (!withActions) actions.classList.add("spent");
    el.append(actions);

    const move = field("is-move", game.i18n.localize("DRPG.Move.title"),
        `${withMove}/${students.length}`, "DRPG.Hud.freeMovesLeftTooltip");
    if (!withMove) move.classList.add("spent");
    el.append(move);

    return el;
}

export { WIDGET_ID };
