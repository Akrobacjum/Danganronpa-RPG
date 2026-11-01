/**
 * Danganronpa RPG - the player's own three numbers, on screen.
 * ---------------------------------------------------------------------------
 * The HUD carries world state: campaign, chapter, day, phase, time of day. All
 * of it changes roughly once every forty minutes.
 *
 * The three things a player checks constantly - how many actions are left,
 * whether the free Move is still there, how much Hope they hold - lived only on
 * the character sheet. So the sheet had to be open, on top, and on the right tab
 * to answer "can I still do this?", which is a question that comes up before
 * every single declaration.
 *
 * This is that answer, pinned above the Projects tray, where the eye already
 * goes for the other standing numbers.
 *
 * Deliberately not on the HUD itself: the HUD is what everyone shares and reads
 * the same way, and this is personal. A GM has no character, so they get the
 * table's view instead - how many players still have actions left, which is the
 * same question from the other side.
 */

import { MODULE_ID } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { actionsLeft, actionsMax, hasFreeMove } from "./actions.mjs";   // hasFreeMove: player view only
import { isEclipse, movesLeft as eclipseMovesLeft, movesUsed as eclipseMovesUsed, eclipseAllowance } from "./eclipse.mjs";
import { hopeHeld } from "./calls.mjs";
import { isMonokuma } from "./monokuma.mjs";
import { isDeadForGm, livingStudents } from "./chapter.mjs";
import { isMonocub } from "./monocub.mjs";
import { matchStripToDespair, viewerActor } from "./hud.mjs";
import { spentSince, markSpent } from "./motion.mjs";
import { error, plural, markLanguage } from "./utils.mjs";
// E88 C0: the counters `fps()` and scenario 86 read (perf-counters.mjs); an increment each, nothing timed.
import { count } from "./perf-counters.mjs";

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

    // The system's effects widget only ever has something to say in this game
    // when a character is Wounded or in Breakdown - see `syncEffectsWidget`.
    Hooks.on("createActiveEffect", effect => {
        if (relevant(effect?.parent)) syncEffectsWidget();
    });
    Hooks.on("deleteActiveEffect", effect => {
        if (relevant(effect?.parent)) syncEffectsWidget();
    });
    // The clock refills budgets; the settings the strip reads, and no other (E88 C4: `stripReadsSetting`).
    Hooks.on("updateSetting", setting => {
        if (stripReadsSetting(setting)) renderPlayerStatus();
    });
    // A character being assigned, reassigned or cleared changes whose numbers
    // these are - and until now nothing redrew for it, so a player who was
    // given their character after joining had an empty rail until the next
    // scene change.
    Hooks.on("updateUser", user => {
        if (user?.id === game.user.id) renderPlayerStatus();
    });
    // The Eclipse rewrites every row on this panel and is not an actor update.
    Hooks.on("drpgEclipseChanged", () => renderPlayerStatus());
}

/**
 * HIDE THE EFFECTS WIDGET WHEN THERE ARE NO EFFECTS.
 * ---------------------------------------------------------------------------
 * Daggerheart draws an effects panel in the right rail, under the player strip,
 * and it draws the frame whether or not anything is in it. In most games that
 * is a reasonable default - a character usually has a few effects. In this one
 * `states.mjs` removes the system's own statuses and puts exactly two back:
 * Breakdown (Sanity full) and Wounded (Health at zero). So "no active effects" and
 * "unhurt and composed" are the same sentence here, and the widget spends the
 * entire session as an empty box in the corner.
 *
 * A class on `<body>` rather than a style on the widget: the rail rebuilds its
 * children whenever the system feels like it, and an inline style goes with
 * them - the same reasoning `matchStripToDespair` gives for publishing the
 * Despair height as a custom property instead of setting a height.
 *
 * Safe if the system already removes its own empty widget: hiding something
 * that is not there does nothing.
 */
export function syncEffectsWidget() {
    try {
        const actor = statusActor();
        // No character to speak for - leave the widget alone rather than
        // hiding a panel that might belong to somebody else's view.
        const empty = Boolean(actor) && (actor.effects?.size ?? 0) === 0;
        document.body.classList.toggle("drpg-no-effects", empty);
    } catch {
        // Cosmetic to the last.
    }
}

/** Does this actor's change affect what is currently on screen? */
function relevant(actor) {
    if (!actor) return false;
    // The GM's strip counts every student, so any student's change moves it.
    if (game.user.isGM) {
        return actor.type === "character" && !isMonokuma(actor);
    }
    return actor.id === statusActor()?.id;
}

/** Is there anything for this account in that corner at all? */
function hasStatusToShow() {
    return Boolean(statusActor()) || game.user.isGM;
}

/**
 * Whose numbers these are.
 *
 * `game.user.character` is the answer when it is set, and it is not always set:
 * a player can own exactly one character without it ever having been dropped
 * into the "assigned character" field, and the panel then showed nothing at all
 * for someone who plainly has a character.
 *
 * A PLAYER'S IS THE SCREEN'S ONE VIEWER, A GM'S IS NOBODY (E51 C4, 31.10.2026; E51-25, E51-26, audit S10-49). This
 * was monokuma.mjs `ownStudent` with no role check: a player with two students and none assigned got the table's
 * numbers (none was unambiguous), and a GM - a Gamemaster or an Assistant - who had a student assigned got that
 * student's budget instead of the table's. A player's is hud.mjs `viewerActor` now, the one the clock and the room
 * tile ask (the assigned character, else the one owned student, else of several the controlled one, else the first
 * by name; nobody for a Monokuma account: see buildPlayerView); a GM's is null whatever is assigned, so a GM is drawn
 * the table's view (R1118). Exported for the suite.
 */
export function statusActor() {
    return game.user.isGM ? null : viewerActor();
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
 * we still have a character, which makes the re-render idempotent - and
 * `renderPlayerStatus` removes the old node first, so its own churn cannot
 * feed itself.
 */
function keepMounted() {
    // Every render is also a chance to get the effects widget right: an actor
    // update that changed Health is what removes Wounded, and the strip redraws for
    // it anyway.
    syncEffectsWidget();

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
    count("playerStatus.render");
    try {
        // Same rail, same moment: whatever redrew the strip may also have
        // changed whether the effects widget has anything to show.
        syncEffectsWidget();

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
        // Assistant - so an assistant running a student of their own saw no
        // panel and had no way to get one. Since E51 C4 a GM of either kind is
        // drawn the table's view, the one this corner keeps for them, whatever
        // is assigned (`statusActor`; the slice's edge case, E51-26): no GM
        // spends a student's budget from here any more.
        //
        // An account WITHOUT one gets the table's numbers instead. That view
        // existed until v0.14.2 and was taken out for a good reason: it wore
        // the player's own labels, "Actions" and "Move", so the counts read as
        // the GM's personal budget, and a GM has none. The answer to that is
        // labels that say whose numbers these are - not an empty corner.
        const el = statusActor() ? buildPlayerView() : buildTableView();
        if (!el) { document.getElementById(WIDGET_ID)?.remove(); return; }

        el.id = WIDGET_ID;
        // Its language, the page's (E66 C3; C1's `lang` on the module's containers, STATUS Open 3).
        markLanguage(el);

        /*
         * AND IF IT WOULD COME OUT THE SAME, IT STAYS WHERE IT IS.
         *
         * This strip redraws on every module setting write and on every update
         * of any student - which on a GM's client is every action anybody at
         * the table takes. It used to redraw by removing its node and
         * prepending a new one, and under Stained Glass that pair of child-list
         * mutations is a recut of the curtain: measured 1:1 in the glass
         * harness, five remove-and-prepend cycles produced five geometry passes
         * under Stained Glass and none under Monokuma Legacy, at 13-19 ms of
         * blocking JS each, 150 ms after the fact. Most of those writes change
         * nothing this strip prints.
         *
         * The same guard the Event panel already carries (events.mjs), and for
         * the reason stated there: the panel is on the curtain, so every
         * rebuild of it is a recut of the glass around it.
         *
         * The markup IS the signature. The alternative - a list of the values
         * printed - is a second statement of what the builders draw and would
         * go stale the first time one of them learns a new field. Building the
         * element costs a few dozen detached nodes and no layout; it is the
         * INSERTION that costs, and that is what this skips.
         */
        const signature = el.outerHTML;
        const standing = document.getElementById(WIDGET_ID);
        /* AND NEVER SKIP A BUILD THAT FLARED. `markSpent` (motion.mjs) is called while the
           pips are being built and, under Stained Glass, asks the pane under the pip to beat
           - a side effect that has already happened by the time the markup can be compared.
           Whenever it fires it also leaves `drpg-spent` or `drpg-gained` in the markup, so
           the signature would differ anyway in every case but an exact tie in the resumed
           animation's delay; this says so outright rather than resting on that. */
        if (standing && standing.parentElement === host
            && standing.dataset.drpgSignature === signature
            && !el.querySelector(".drpg-spent, .drpg-gained")) {
            matchStripToDespair();
            return;
        }
        el.dataset.drpgSignature = signature;

        el.addEventListener("pointerdown", event => event.stopPropagation());
        standing?.remove();

        // Always first. The old code inserted before the Projects tray when it
        // could find it and prepended when it could not, so the panel's place
        // in the column depended on whether Daggerheart had finished building
        // the tray yet - first on a cold load, third on a redraw. The CSS
        // orders this column explicitly anyway (`order: 0`), so first is both
        // the honest DOM position and the one that already matches.
        host.prepend(el);

        // The strip is as tall as the Despair panel opposite it, and how tall
        // that is depends on how many Monokumas the campaign has. Re-measured
        // here as well as in the HUD render, because this widget redraws far
        // more often than the clock does - every action spent - and the two
        // boxes must never be seen at different heights.
        matchStripToDespair();
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
 * those shapes without counting - "two dots left" lands before "2/2" does. A
 * strip that said 2/2 in text was a second, competing way of saying the thing
 * the sheet already says well, which is exactly how two readings of the same
 * number end up disagreeing in someone's head mid-turn.
 *
 * The classes are the sheet's own, so the masks, the filled/empty states and
 * the pixel rendering all come from the rules that already style them.
 */
/**
 * @param {{from: number, to: number}|null} [options.spent]  Which pips went out
 *   since this tray last drew this pool - see `spentSince`. The tray keeps its
 *   own memory separate from the sheet's, so both surfaces flash the same
 *   spend rather than racing each other for it.
 */
function pips(className, held, max, { cap = 12, spent = null } = {}) {
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
        markSpent(pip, spent, i);
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
 * Every row reads something derived - an Eclipse state, a Hope pool, a free
 * Move flag - and any of them can throw on a half-migrated actor. They used to
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

/**
 * What the strip says, as data (E17 C8, 26.10.2026; audit S10-19, S10-30): the three readings `buildPlayerView`
 * draws and `buildTableView` counts, pure, so the suite reads them with the inputs it names (R997) where tier 1
 * can open no Eclipse and kill nobody.
 *
 * `eclipseMoveRow(moves)` is the Move row in an Eclipse, `moves` being eclipse.mjs `movesLeft`: a count, or `null`
 * in a placement that allows any room. Until this commit `null` went through `moves > 0` and `moves <= 0` as a
 * number: the row was "spent" with one outlined foot - "you have no moves" in the one window that allows every
 * room - while the sheet's budget line, which asks `null` first, said "place anywhere". Its tooltip was the
 * actions' ("Placement only. Actions are already back ..."); it now names what the row counts: the crossings
 * left, or any room.
 *
 * FREE PLACEMENT LIVES UNTIL E37 (S18-90 takes `ECLIPSE_FREE_PLACEMENT` and `isFreePlacement` out): each branch
 * that reads `null` here and in `stillPlacing` is one `if` that its removal deletes whole.
 *
 * @param {number|null} moves
 * @returns {{available: boolean, feet: number, solid: boolean, tooltip: string}}
 */
export function eclipseMoveRow(moves) {
    if (moves === null) {   // free placement (until E37): one full foot, anywhere
        return { available: true, feet: 1, solid: true, tooltip: game.i18n.localize("DRPG.Actions.eclipseFreePlacement") };
    }
    const n = Math.max(0, Number(moves) || 0);
    return { available: n > 0, feet: Math.max(n, 1), solid: n > 0, tooltip: plural("DRPG.Actions.eclipseMovesLeft", { n }) };
}

/**
 * The actions row's tooltip. In an Eclipse it says the one thing an action buys there - a Direct Murder - and a
 * Monocub, who commits none, is told the placement alone (`DRPG.Eclipse.placementOnly`; until E17 C8 a Monocub read
 * the killer's sentence). Out of one, the count it covers: `pipReadOnly` carries `{left}` and `{max}`, and this row
 * localized it without them, so the tooltip read "{left} of {max} actions" (read in the code at eb703938; the
 * sheet's pips have always formatted it).
 */
export function actionsTooltip({ eclipse, monocub, left, max }) {
    if (eclipse) return game.i18n.localize(monocub ? "DRPG.Eclipse.placementOnly" : "DRPG.Eclipse.actionsMurderOnly");
    return left ? plural("DRPG.Actions.pipReadOnly", { left, max }, "max") : game.i18n.localize("DRPG.Actions.allSpent");
}

/**
 * How many of `students` still have to place, for the GM's "Still placing" row: a crossing left, or, in free
 * placement (`null` left, until E37), no crossing made yet (`movesUsed === 0`). Until E17 C8 `null > 0` counted
 * nobody, and the GM read "Still placing 0 / N" over a table where nobody had moved.
 *
 * @param {Actor[]} students
 * @param {{left?: (actor: Actor) => number|null, used?: (actor: Actor) => number}} [readers]  the suite's; eclipse.mjs's otherwise
 */
export function stillPlacing(students, { left = eclipseMovesLeft, used = eclipseMovesUsed } = {}) {
    return students.filter(actor => {
        const n = left(actor);
        if (n === null) return used(actor) === 0;   // free placement (until E37)
        return n > 0;
    }).length;
}

/**
 * A dead student who is no Monocub has nothing on this strip to spend: death does not empty the action pool and the
 * time of day's refill passes a body by, so until E17 C8 the strip went on saying "1/2", a full foot and, in each
 * Eclipse, two crossings, all of which the module refuses (audit S10-30). The strip is then one row of state. Dead
 * as this browser may know it (`isDeadForGm`: the flag, or the player's own copy of a death not yet published), as
 * the Hope row below has always asked. A Monocub keeps every row: Confusion costs an action and a point of Hope.
 */
export function showsDeathOnly(actor) {
    return isDeadForGm(actor) && !isMonocub(actor);
}

/**
 * The strip for `actor`, this browser's own character by default. The options are the suite's (R997), each read off
 * the world when left out: `eclipse`, `moves` (`null` is free placement), `dead`, and `remember: false`, which keeps
 * the flash memory (`spentSince`) of the page untouched for a strip nobody sees.
 */
export function buildPlayerView(actor = statusActor(), options = {}) {
    // No character of our own - or a Monokuma, which has no action economy at
    // all. Nothing here applies, so show nothing rather than a row of zeroes.
    if (!actor || isMonokuma(actor)) return null;
    const since = options.remember === false ? () => null : spentSince;

    const el = box();

    if (options.dead ?? safeRow(() => showsDeathOnly(actor))) {
        el.append(field("is-state", game.i18n.localize("DRPG.Panel.stateColumn"),
            game.i18n.localize("DRPG.Panel.state.dead"), null, true));
        return el;
    }

    // An Eclipse suspends the action economy almost entirely - see the guard in
    // action-rolls.mjs.
    //
    // "Almost" is new, and this row had to change with it: Direct Murder is now
    // the one action that works during placement, and it costs an action like
    // any other. Reading zero here was right when every tile refused you; with
    // one that does not, it would tell a killer they cannot afford the thing
    // they are about to do. So the count stays true and the tooltip carries the
    // qualification instead.
    const eclipse = options.eclipse ?? safeRow(() => isEclipse()) ?? false;

    el.append(...[
        safeRow(() => {
            const max = actionsMax(actor);
            const left = actionsLeft(actor);
            const row = marks("is-actions", game.i18n.localize("DRPG.Actions.label"),
                pips("drpg-status-pip drpg-action-pip", left, max,
                    { spent: since("strip:actions", actor.id, left) }),
                null, !left);
            row.dataset.tooltip = actionsTooltip({ eclipse, monocub: isMonocub(actor), left, max });
            if (eclipse) row.classList.add("is-eclipse");
            return row;
        }),

        // The sheet marks the free Move with a footprint rather than a pip,
        // because there is only ever one of it - so this does too.
        safeRow(() => {
            const foot = document.createElement("span");
            if (eclipse) {
                // One footprint per crossing the Eclipse still allows. This is
                // the whole of what a player can do right now, so it is the one
                // row that should be lit while everything above it is not.
                //
                // Its own memory, separate from the ordinary free Move's: the
                // two are different counts of different things, and sharing a
                // key would flash a spend every time an Eclipse opened or shut
                // and the number changed shape underneath the row.
                const moves = "moves" in options ? options.moves : eclipseMovesLeft(actor);
                const shown = eclipseMoveRow(moves);
                // Free placement has no count to flash (`spentSince` learns nothing from `null`).
                const wentOut = since("strip:eclipseMove", actor.id, moves);
                foot.className = `drpg-status-pips drpg-free-move ${shown.available ? "available" : "spent"}`;
                // One element for the whole pool, so any crossing going out
                // flares the row. The index `markSpent` takes is meant for a
                // track drawn a pip each; here the second of three would be
                // asked for at position one and quietly declined.
                markSpent(foot, wentOut && { ...wentOut, from: 1 });
                // Crossings still available are solid; with none left the row
                // keeps one outlined footprint rather than emptying itself, so
                // there is still something there saying what it is.
                foot.innerHTML = Array.from({ length: shown.feet },
                    () => `<i class="fa-${shown.solid ? "solid" : "regular"} fa-shoe-prints" inert></i>`).join("");
                const row = marks("is-move", game.i18n.localize("DRPG.Move.title"), foot, null, !shown.available);
                row.dataset.tooltip = shown.tooltip;
                return row;
            }
            const free = hasFreeMove(actor);
            const wentOut = since("strip:move", actor.id, free ? 1 : 0);
            foot.className = `drpg-status-pips drpg-free-move ${
                free ? "available" : "spent"}`;
            markSpent(foot, wentOut);
            foot.innerHTML = `<i class="fa-${free ? "solid" : "regular"} fa-shoe-prints" inert></i>`;
            return marks("is-move", game.i18n.localize("DRPG.Move.title"), foot,
                free ? "DRPG.Actions.freeMoveAvailable" : "DRPG.Actions.freeMoveSpent",
                !free);
        }),

        // Hope is shown to the living and to Monocubs, and to nobody else.
        //
        // A Monocub is dead, but Confusion - the one action they have left -
        // costs an action AND a point of Hope, and that Hope only exists
        // because a GM converted Despair into it. So it is the number they most
        // need on screen: a Monocub with actions left and no Hope cannot do the
        // single thing they are still at the table to do, and nothing else
        // would tell them why.
        //
        // A plainly dead student reaches none of these rows since E17 C8: the
        // strip is their state alone (`showsDeathOnly`, above).
        safeRow(() => {
            const held = hopeHeld(actor);
            const hopeMax = Number(actor.system?.resources?.hope?.max ?? held);
            return marks("is-hope", game.i18n.localize("DAGGERHEART.GENERAL.hope") || "Hope",
                pips("drpg-status-pip drpg-status-hope-pip", held, hopeMax,
                    { spent: since("strip:hope", actor.id, held) }),
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
    return livingStudents();
}

/**
 * The table's numbers, for an account with no character of its own.
 *
 * The same question a player asks - "is there anything left to spend?" - from
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
            // During an Eclipse nobody acts but by a Direct Murder, so the count
            // is not stale - it is beside the point: who has still to place is
            // the row below.
            if (eclipse) return null;
            const left = students.filter(a => actionsLeft(a) > 0).length;
            return field("is-actions", game.i18n.localize("DRPG.Hud.stillToAct"),
                `${left} / ${students.length}`, "DRPG.Hud.stillToActTooltip", !left);
        }),

        // No free-Move row outside an Eclipse.
        //
        // It counted students who still held their free Move, but read as the
        // GM's own - "Free moves 3 / 3" on the GM's panel says the GM has three,
        // and a GM moves wherever they like. It is also not a thing anybody
        // waits for: nobody holds up a time of day over an unspent free Move.
        //
        // During an Eclipse the same count IS the thing a GM waits for - who has
        // still to place - so it stays, under a label that says that and nothing
        // about a budget. In free placement (until E37) that is who has not moved
        // yet: see `stillPlacing`.
        safeRow(() => {
            if (!eclipse) return null;
            const left = stillPlacing(students);
            return field("is-move", game.i18n.localize("DRPG.Hud.stillPlacing"),
                `${left} / ${students.length}`,
                eclipseAllowance() === null ? "DRPG.Hud.stillPlacingFreeTooltip" : "DRPG.Hud.stillPlacingTooltip", !left);
        })
    ].filter(Boolean));

    return el.children.length ? el : null;
}

export { WIDGET_ID };

/*
 * THE SETTINGS THIS STRIP READS, AND NO OTHER (E88 C4, 27.10.2026; E88-09). The `updateSetting` listener redrew the
 * strip for every module setting written - a Despair spent, a rule reworded, a project advanced - and scenario 86 at
 * 7baff238 counted a strip built on every browser for each Despair write, which reads nothing of a pool (the strip's
 * height opposite the Despair panel is a body property the panel's own render sets: despair.mjs, `matchStripToDespair`).
 * Gathered off `game.settings.get` while the strip was built (R1013, on the GM's browser, a student's strip in and
 * out of an Eclipse and the table's): `clock`, `overflow` and `language`. Added by reading, for the branches that run
 * did not take: `overflowRules` (overflow.mjs `overflowRules`, read while a darkening costs an action or the free
 * Move) and `theme` (motion.mjs reads it when a spent pip flares). The actor, the user and the Eclipse have their own
 * hooks above; the GMs' stores and their copies are client settings, which fire no `updateSetting`. R1013 fails when
 * the strip reads a module setting this list lacks.
 */
const STRIP_SETTINGS = new Set([SETTINGS.clock, SETTINGS.overflow, SETTINGS.overflowRules, SETTINGS.language, SETTINGS.theme]);
/** Whether a written Setting document is one the strip reads (its `updateSetting` listener). */
export function stripReadsSetting(setting) {
    const key = String(setting?.key ?? "");
    return key.startsWith(`${MODULE_ID}.`) && STRIP_SETTINGS.has(key.slice(MODULE_ID.length + 1));
}
