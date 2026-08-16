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
import { actionsLeft, actionsMax, hasFreeMove } from "./actions.mjs";   // hasFreeMove: player view only
import { isEclipse, movesLeft as eclipseMovesLeft } from "./eclipse.mjs";
import { hopeHeld } from "./calls.mjs";
import { isMonokuma } from "./monokuma.mjs";
import { isDeceased } from "./chapter.mjs";
import { isMonocub } from "./monocub.mjs";
import { error } from "./utils.mjs";

const WIDGET_ID = "drpg-player-status";

export function registerPlayerStatus() {
    Hooks.once("ready", () => {
        renderPlayerStatus();
        keepMounted();
    });
    Hooks.on("canvasReady", () => renderPlayerStatus());

    // Actions, Hope and the free-Move flag all live on the actor, so one hook
    // covers every route that changes them: spending an action, a rest, an
    // Eclipse refill, a GM correction.
    Hooks.on("updateActor", actor => {
        if (relevant(actor)) renderPlayerStatus();
    });
    // The clock refills budgets.
    Hooks.on("updateSetting", setting => {
        if (setting?.key?.startsWith(`${MODULE_ID}.`)) renderPlayerStatus();
    });
    // A character being assigned, reassigned or cleared changes whose numbers
    // these are — and until now nothing redrew for it, so a player who was
    // given their character after joining had an empty rail until the next
    // scene change.
    Hooks.on("updateUser", user => {
        if (user?.id === game.user.id) renderPlayerStatus();
    });
    // The Eclipse rewrites every row on this panel and is not an actor update.
    Hooks.on("drpgEclipseChanged", () => renderPlayerStatus());
}

/** Does this actor's change affect what is currently on screen? */
function relevant(actor) {
    if (!actor) return false;
    // The GM's strip counts every student, so any student's change moves it.
    if (!ownCharacter() && game.user.isGM) {
        return actor.type === "character" && !isMonokuma(actor);
    }
    return actor.id === ownCharacter()?.id;
}

/** Is there anything for this account in that corner at all? */
function hasStatusToShow() {
    return Boolean(ownCharacter()) || game.user.isGM;
}

/**
 * Whose numbers these are.
 *
 * `game.user.character` is the answer when it is set, and it is not always set:
 * a player can own exactly one character without it ever having been dropped
 * into the "assigned character" field, and the panel then showed nothing at all
 * for someone who plainly has a character.
 *
 * The fallback only fires on an unambiguous case — one owned, living-or-dead
 * student. A GM owns every actor in the world, so the filter never resolves to
 * one for them and they fall through to null, which is the intended answer:
 * a GM with no character of their own has no budget to show.
 */
function ownCharacter() {
    const assigned = game.user.character;
    if (assigned && !isMonokuma(assigned)) return assigned;
    if (assigned) return null;   // a Monokuma account: see buildPlayerView

    const owned = game.actors.filter(a =>
        a.type === "character" && a.isOwner && !isMonokuma(a));
    return owned.length === 1 ? owned[0] : null;
}

/**
 * Put the panel back if anything removes it.
 *
 * Everything else on this rail belongs to Foundry or to Daggerheart, and both
 * rebuild their own widgets whenever they feel like it. Ours is a guest in that
 * column: a re-render that replaces the column's children takes it with them,
 * and the only things that redrew it were a scene change, an actor update and a
 * module setting. Between those it simply stayed gone.
 *
 * So it watches. The observer fires only when the node is actually missing and
 * we still have a character, which makes the re-render idempotent — and
 * `renderPlayerStatus` removes the old node first, so its own churn cannot
 * feed itself.
 */
function keepMounted() {
    const root = document.getElementById("interface") ?? document.body;
    if (!root || root.dataset.drpgStatusWatch) return;
    root.dataset.drpgStatusWatch = "1";

    let queued = false;
    const observer = new MutationObserver(() => {
        if (queued) return;
        if (document.getElementById(WIDGET_ID)) return;
        if (!hasStatusToShow()) return;
        queued = true;
        requestAnimationFrame(() => {
            queued = false;
            if (!document.getElementById(WIDGET_ID)) renderPlayerStatus();
        });
    });

    observer.observe(root, { childList: true, subtree: true });
}

export function renderPlayerStatus() {
    try {
        document.getElementById(WIDGET_ID)?.remove();

        // Above the Projects tray. Falling back through the column and then the
        // right rail keeps this working on a layout module that has moved or
        // renamed the tray rather than dropping the widget entirely.
        const projects = document.querySelector("#countdowns");
        const host = document.querySelector("#ui-right-column-1")
            ?? projects?.parentElement
            ?? document.querySelector("#ui-right");
        if (!host) return;

        // Having a character decides WHICH view, not whether there is one.
        //
        // The role check that used to sit here refused anyone `game.user.isGM`
        // was true for, and in Foundry that is BOTH a Gamemaster and an
        // Assistant — so an assistant running a student of their own saw no
        // panel and had no way to get one. An account with a character gets
        // that character's budget whatever else it may do to the world.
        //
        // An account WITHOUT one gets the table's numbers instead. That view
        // existed until v0.14.2 and was taken out for a good reason: it wore
        // the player's own labels, "Actions" and "Move", so the counts read as
        // the GM's personal budget, and a GM has none. The answer to that is
        // labels that say whose numbers these are — not an empty corner.
        const el = ownCharacter() ? buildPlayerView() : buildTableView();
        if (!el) return;

        el.id = WIDGET_ID;
        el.addEventListener("pointerdown", event => event.stopPropagation());

        // Always first. The old code inserted before the Projects tray when it
        // could find it and prepended when it could not, so the panel's place
        // in the column depended on whether Daggerheart had finished building
        // the tray yet — first on a cold load, third on a redraw. The CSS
        // orders this column explicitly anyway (`order: 0`), so first is both
        // the honest DOM position and the one that already matches.
        host.prepend(el);
    } catch (err) {
        error("Could not render the player status strip", err);
    }
}

function box() {
    const el = document.createElement("div");
    el.className = "drpg-status";
    return el;
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

/**
 * One row, and never the whole panel.
 *
 * Every row reads something derived — an Eclipse state, a Hope pool, a free
 * Move flag — and any of them can throw on a half-migrated actor. They used to
 * throw straight through `buildPlayerView` into the caller's try/catch, which
 * meant one bad number removed all three. A row that cannot be built is now
 * simply missing, and the two that work still appear.
 */
function safeRow(build) {
    try {
        return build();
    } catch (err) {
        error("Could not build a player status row", err);
        return null;
    }
}

function buildPlayerView() {
    const actor = ownCharacter();
    // No character of our own — or a Monokuma, which has no action economy at
    // all. Nothing here applies, so show nothing rather than a row of zeroes.
    if (!actor || isMonokuma(actor)) return null;

    const el = box();

    // An Eclipse suspends the action economy almost entirely — see the guard in
    // action-rolls.mjs.
    //
    // "Almost" is new, and this row had to change with it: Direct Murder is now
    // the one action that works during placement, and it costs an action like
    // any other. Reading zero here was right when every tile refused you; with
    // one that does not, it would tell a killer they cannot afford the thing
    // they are about to do. So the count stays true and the tooltip carries the
    // qualification instead.
    const eclipse = safeRow(() => isEclipse()) ?? false;

    el.append(...[
        safeRow(() => {
            const max = actionsMax(actor);
            const left = actionsLeft(actor);
            const row = marks("is-actions", game.i18n.localize("DRPG.Actions.label"),
                pips("drpg-status-pip drpg-action-pip", left, max),
                eclipse ? "DRPG.Eclipse.actionsMurderOnly"
                        : left ? "DRPG.Actions.pipReadOnly" : "DRPG.Actions.allSpent",
                !left);
            if (eclipse) row.classList.add("is-eclipse");
            return row;
        }),

        // The sheet marks the free Move with a footprint rather than a pip,
        // because there is only ever one of it — so this does too.
        safeRow(() => {
            const foot = document.createElement("span");
            if (eclipse) {
                // One footprint per crossing the Eclipse still allows. This is
                // the whole of what a player can do right now, so it is the one
                // row that should be lit while everything above it is not.
                const moves = eclipseMovesLeft(actor);
                foot.className = `drpg-status-pips drpg-free-move ${moves > 0 ? "available" : "spent"}`;
                foot.innerHTML = Array.from({ length: Math.max(moves, 0) },
                    () => `<i class="fa-solid fa-shoe-prints" inert></i>`).join("")
                    || `<i class="fa-solid fa-shoe-prints" inert></i>`;
                return marks("is-move", game.i18n.localize("DRPG.Move.title"), foot,
                    "DRPG.Eclipse.actionsLocked", moves <= 0);
            }
            const free = hasFreeMove(actor);
            foot.className = `drpg-status-pips drpg-free-move ${free ? "available" : "spent"}`;
            foot.innerHTML = `<i class="fa-solid fa-shoe-prints" inert></i>`;
            return marks("is-move", game.i18n.localize("DRPG.Move.title"), foot,
                free ? "DRPG.Actions.freeMoveAvailable" : "DRPG.Actions.freeMoveSpent",
                !free);
        }),

        // Hope is shown to the living and to Monocubs, and to nobody else.
        //
        // A Monocub is dead, but Confusion — the one action they have left —
        // costs an action AND a point of Hope, and that Hope only exists
        // because a GM converted Despair into it. So it is the number they most
        // need on screen: a Monocub with actions left and no Hope cannot do the
        // single thing they are still at the table to do, and nothing else
        // would tell them why.
        //
        // A plainly dead student spends nothing, so for them the row really is
        // furniture and stays hidden.
        safeRow(() => {
            if (isDeceased(actor) && !isMonocub(actor)) return null;
            const held = hopeHeld(actor);
            const hopeMax = Number(actor.system?.resources?.hope?.max ?? held);
            return marks("is-hope", game.i18n.localize("DAGGERHEART.GENERAL.hope") || "Hope",
                pips("drpg-status-pip drpg-status-hope-pip", held, hopeMax),
                null, held === 0);
        })
    ].filter(Boolean));

    // Every row failed. An empty bordered box says nothing and looks broken.
    return el.children.length ? el : null;
}

/**
 * A count of people, with the label saying so.
 *
 * Not `pips()`: those are a budget you spend, drawn as the sheet draws them,
 * and sixteen students would be sixteen dots meaning something else entirely.
 * Two numbers and a slash is the honest shape for "how many of them".
 */
function field(className, label, value, tooltipKey, spent) {
    const wrap = document.createElement("div");
    wrap.className = `drpg-status-field ${className}${spent ? " spent" : ""}`;
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

/** Living students, which is who the two counts below are about. */
function trackedStudents() {
    return game.actors.filter(a =>
        a.type === "character" && !isMonokuma(a) && !isDeceased(a));
}

/**
 * The table's numbers, for an account with no character of its own.
 *
 * The same question a player asks — "is there anything left to spend?" — from
 * the other side of the screen. Deliberately WITHOUT names: the roster panel
 * top left already spells out who is who, one row per student, and two widgets
 * competing to list the same people in two corners is how this one came to be
 * deleted the first time. This is the glance; the roster is the answer.
 *
 * "Still to act", not "Actions". The label is the whole fix.
 */
function buildTableView() {
    const students = trackedStudents();
    if (!students.length) return null;

    const el = box();
    el.classList.add("is-gm");

    const eclipse = safeRow(() => isEclipse()) ?? false;

    el.append(...[
        safeRow(() => {
            // During an Eclipse nobody may act at all, so the count is not
            // stale — it is meaningless. The row says the same thing the
            // player's own strip says at that moment: this is suspended.
            if (eclipse) return null;
            const left = students.filter(a => actionsLeft(a) > 0).length;
            return field("is-actions", game.i18n.localize("DRPG.Hud.stillToAct"),
                `${left} / ${students.length}`, "DRPG.Hud.stillToActTooltip", !left);
        }),

        // No free-Move row outside an Eclipse.
        //
        // It counted students who still held their free Move, but read as the
        // GM's own — "Free moves 3 / 3" on the GM's panel says the GM has three,
        // and a GM moves wherever they like. It is also not a thing anybody
        // waits for: nobody holds up a time of day over an unspent free Move.
        //
        // During an Eclipse the same count IS the thing a GM waits for — who has
        // still to place — so it stays, under a label that says that and nothing
        // about a budget.
        safeRow(() => {
            if (!eclipse) return null;
            const left = students.filter(a => eclipseMovesLeft(a) > 0).length;
            return field("is-move", game.i18n.localize("DRPG.Hud.stillPlacing"),
                `${left} / ${students.length}`, "DRPG.Hud.stillPlacingTooltip", !left);
        })
    ].filter(Boolean));

    return el.children.length ? el : null;
}

export { WIDGET_ID };
