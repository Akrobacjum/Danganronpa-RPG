/**
 * The action panel (E54, the sheet's family): the rules panel that replaces the Effects tab, `injectActionPanel`
 * with the Monocub and Calls panels and their buttons, whether Tamper has anything to work on (`forgetTamper`), and the
 * tile itself with its price (`actionButton`).
 */

import { ACTIONS, ACTION_GRID, MONOCUB, STARTING, PRICE_CHAINS } from "./config.mjs";
import { nextCrossingPrice, actionsLeft, actionsMax, hasFreeMove, freeActionsLeft, freeMovesLeft, canPayFor } from "./actions.mjs";
import { resourceMax, resourceValue } from "./character.mjs";
import { poolUserFor } from "./monokuma.mjs";
import { spendableDespair } from "./despair.mjs";
import { hopeHeld, hopeMax, affordableHopeCalls, despairCallsFor, callAsksGm } from "./calls.mjs";
import { isEclipse, movesLeft as eclipseMovesLeft } from "./eclipse.mjs";
import { getClock } from "./clock.mjs";
import { inClassTrial } from "./trial.mjs";
import { facilitiesShutReason } from "./action-facilities.mjs";
import { murderState, sideOf, isTheirTurn, betrayalTarget, crisisTileLabel } from "./murder.mjs";
import { incidentTurnText, actingActor } from "./events.mjs";
import { isCrimeSilenced, purseOf, cubPanelLines, cubBlockSaid } from "./monocub.mjs";
import { isCallSilenced, pendingGather, alreadyArmed } from "./call-effects.mjs";
import { witnessesTo, isCleaner, freeTonightText, tamperQuote } from "./cleanup.mjs";
import { stripeKindFor, quotePrice, priceLabel } from "./price.mjs";
import { neighbouringRooms, othersInRoom, locateActor, roomOfActor } from "./movement.mjs";
import { moveLine } from "./action-rolls.mjs";
import { SearchTokens } from "./search-tokens.mjs";
import { rules } from "./rules.mjs";
import { plural, proseOf, GM_ROUTE_CLASS, error, debug } from "./utils.mjs";
import { overflowBlocksFreeMove, overflowBlocksCalls } from "./overflow.mjs";
import { modeOf, sheetMode, sheetsFor } from "./sheet-mode.mjs";
import { softWrap } from "./sheet-fit.mjs";

/* ==========================================================================
 * THE KILLING GAME'S RULES
 * --------------------------------------------------------------------------
 * Daggerheart's Effects tab lists magical conditions applied by spells and
 * armour. This game has two conditions, both automatic (see states.mjs), and
 * no spells - so the tab was an empty box on every sheet in the world.
 *
 * What every sheet should carry instead is the thing every character is
 * actually bound by: Monokuma's standing rules. They were being announced once
 * in chat and then scrolling away, which for a rule is the same as not having
 * one.
 *
 * The tab is TAKEN OVER rather than removed and rebuilt. ApplicationV2 owns
 * the tab machinery - which part is active, what a click does, how the nav is
 * rendered - and adding or deleting a part from outside is how you end up with
 * a sheet that cannot switch tabs. Relabelling the nav entry and replacing the
 * section's contents leaves all of that untouched.
 * ========================================================================== */

export function replaceEffectsTab(app, element) {
    const section = element.querySelector('section[data-application-part="effects"]')
        ?? element.querySelector('section.tab[data-tab="effects"]');
    if (!section) return;

    relabelEffectsNav(element);

    section.classList.add("drpg-rules-tab");
    section.replaceChildren(buildRulesPanel(app));
}

/**
 * The nav entry keeps its slot and loses its name.
 *
 * Matched by `[data-tab="effects"]` inside the tab bar specifically - the same
 * attribute is on the content section, and grabbing that one instead is how
 * the action panel once ended up rendered inside a navigation link.
 */
function relabelEffectsNav(element) {
    const nav = element.querySelector("nav.sheet-tabs, .sheet-tabs, nav.tabs");
    const link = nav?.querySelector('[data-tab="effects"]');
    if (!link || link.dataset.drpgRules) return;
    link.dataset.drpgRules = "1";

    const label = game.i18n.localize("DRPG.Rules.tab");
    link.setAttribute("aria-label", label);
    link.dataset.tooltip = label;

    // Foundry renders these as an icon plus a caption, and which of the two is
    // present varies with the UI module in play. Replace whichever exists.
    const icon = link.querySelector("i");
    if (icon) icon.className = "fa-solid fa-gavel";

    for (const node of link.childNodes) {
        if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
            node.textContent = ` ${label}`;
            return;
        }
    }
    const caption = link.querySelector("span");
    if (caption) caption.textContent = label;
    else if (!icon) link.textContent = label;
}

/** The list itself. Read-only for players; the GM gets a way in. */
function buildRulesPanel(app) {
    const panel = document.createElement("div");
    panel.className = "drpg-rules-panel";

    // "Monokuma's rules", not the tab's "Rules" again (E49 B2, S03-39 and S12-67).
    const title = document.createElement("h3");
    title.className = "drpg-keep";
    title.textContent = game.i18n.localize("DRPG.Rules.sheetTitle");
    panel.append(title);

    const intro = document.createElement("p");
    intro.className = "notes";
    intro.textContent = game.i18n.localize("DRPG.Rules.sheetIntro");
    panel.append(intro);

    const current = rules();

    if (!current.length) {
        const empty = document.createElement("p");
        empty.className = "drpg-rules-empty";
        empty.textContent = game.i18n.localize("DRPG.Rules.none");
        panel.append(empty);
    } else {
        const list = document.createElement("ol");
        list.className = "drpg-rules-list";
        for (const rule of current) {
            const li = document.createElement("li");

            const text = document.createElement("div");
            text.className = "drpg-rule-text";
            // textContent, never innerHTML - a rule is free text a GM typed.
            text.textContent = rule.text;
            li.append(text);

            if (rule.chapter) {
                const stamp = document.createElement("div");
                stamp.className = "drpg-rule-stamp";
                stamp.textContent = game.i18n.format("DRPG.Rules.added", { chapter: rule.chapter });
                li.append(stamp);
            }

            list.append(li);
        }
        panel.append(list);
    }

    /*
     * NO EDIT BUTTON HERE (Dawid, 28.08).
     *
     * A character sheet is where the handbook is READ. It was edited from here
     * too, for a GM, and the button was invisible until the first rule existed
     * - so it arrived unannounced in the middle of a session, most often right
     * after a New Rule was announced, on a sheet somebody had open for another
     * reason entirely.
     *
     * The rules manager has a door already: the Rules tile in the GM panel,
     * where the rest of the GM's tools are. Two doors to one window is the
     * thing that made this one a surprise.
     */

    return panel;
}

/* ==========================================================================
 * ACTION PANEL
 * --------------------------------------------------------------------------
 * The guide's actions, as buttons at the top of the Features tab. Clicking one
 * rolls the right trait, resolves the threshold and reports back privately -
 * no GM required for the repeatable ones.
 * ========================================================================== */

export function injectActionPanel(app, element, mode = modeOf(app)) {
    if (!mode.actions) return;

    // Must be the CONTENT section, never the navigation link.
    //
    // `[data-tab="features"]` also matches the <a> in the tab bar, which comes
    // first in the DOM - so a looser selector put the whole panel inside a
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

    // A Monokuma has no action economy at all. Their sheet is Despair Calls.
    if (mode.actions === "calls") {
        injectCallsPanel(tab, actor, true);
        attachActionDelegate(app, element);
        return;
    }

    // Not in the class (E24 C3a, E24-20): an NPC the GMs play takes no actions and buys no Calls, and its sheet
    // says so to the GM in the panel's place. A player's sheet of one draws nothing here.
    if (mode.actions === "npc") {
        const note = document.createElement("div");
        note.className = "drpg-action-panel drpg-npc-panel";
        const line = document.createElement("p");
        line.className = "notes drpg-keep";
        line.textContent = game.i18n.localize("DRPG.Class.npcLine");
        note.append(line);
        tab.prepend(note);
        return;
    }

    // A Monocub keeps the normal action budget but only two things to spend it
    // on. Its own panel entirely, not a filtered version of the student grid -
    // Meddle targets another actor and has no place in the generic delegate.
    if (mode.actions === "monocub") {
        injectMonocubPanel(tab, actor);
        attachActionDelegate(app, element);
        return;
    }

    // Dead, and not promoted to a Monocub. Both branches above are about what
    // somebody IS; this one is about somebody who has stopped.
    //
    // Nothing used to catch this case, so a student who had been executed or
    // murdered kept the whole living grid - Search, Rest, Work on Project, even
    // Direct Murder - plus their Hope Calls, and `resetActionsFor` refilled the
    // budget every time of day because it only ever skipped Monokumas. Becoming
    // a Monocub is a separate GM step that may come a whole trial later, or
    // never, and that gap is exactly where a corpse could keep taking turns.
    if (mode.actions === "dead") {
        const note = document.createElement("div");
        note.className = "drpg-action-panel drpg-dead-panel";
        const heading = document.createElement("h3");
        heading.className = "drpg-keep";
        heading.textContent = game.i18n.localize("DRPG.Chapter.deadPanelTitle");
        const body = document.createElement("p");
        body.className = "notes";
        body.textContent = game.i18n.localize("DRPG.Chapter.deadPanelNote");
        // What the dead still do (E24 C3a, E24-18): speak outside the trial; in it, no microphone and no ballot.
        const still = document.createElement("p");
        still.className = "notes drpg-dead-still";
        still.textContent = game.i18n.localize("DRPG.Class.deadStill");
        note.append(heading, body, still);
        // Dead, and nobody has found them yet (E05 C10): the victim's own player, and a GM.
        if (mode.unfound) {
            const unfound = document.createElement("p");
            unfound.className = "notes";
            unfound.textContent = game.i18n.localize(mode.gm ? "DRPG.Chapter.deadUnfound" : "DRPG.Chapter.nobodyFoundYou");
            note.append(unfound);
        }
        tab.prepend(note);
        return;
    }

    /*
     * IN A FIGHT, THE GRID STAYS UP AND GOES DARK (Dawid, 28.08).
     *
     * This used to replace the whole grid with a crisis panel, because ten
     * tiles that all refuse you is ten wrong answers. The fix was right about
     * the problem and wrong about the shape: the answer is not a different grid
     * in the same place, it is the SAME grid saying what is happening. Every
     * tile greys out with "you are in an incident" on it, and the one that
     * still works is Direct Murder - which is where the incident's own actions
     * now live, on the tile whose whole subject is killing somebody.
     *
     * Nothing about who may do what changed. `availableCrisisActions` still
     * decides what is offered and `performAction`'s own guard still refuses the
     * rest; see `actionButton`, which draws the lock, and `openCrisisMenu`.
     *
     * Hope Calls stay live, as before: they are bought with Hope rather than
     * actions, they go through a different path entirely, and they are what a
     * cornered player reaches for.
     */

    const panel = document.createElement("div");
    panel.className = "drpg-action-panel";

    // THE BUDGET IS THE PANEL'S FIRST ROW (E49 B2, S03-38: "the ACTIONS bar repeats the open tab and pushes the Hope
    // Calls under the sheet's edge"). The panel's own "Actions" heading stood under a tab of the same name; the line
    // that says what is left ("2 of 2 actions - Free Move unused") is the row it keeps, and the heading's word is the
    // panel's name for a screen reader.
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-label", game.i18n.localize("DRPG.Action.panelTitle"));
    panel.append(budgetLine(actor));

    const grid = document.createElement("div");
    grid.className = "drpg-action-grid";

    // Dynamic actions are the guide's catch-all: describe it, the GM sets a
    // threshold, and the reward scale is deliberately gentler. Built here
    // because its three strings are localised and ACTIONS is evaluated before
    // `game.i18n` exists - the table carries a placeholder row (`deferred`)
    // holding its PLACE in the order, and this is what fills it.
    const dynamic = {
        label: game.i18n.localize("DRPG.Action.dynamicLabel"),
        hint: game.i18n.localize("DRPG.Action.dynamicHint"),
        icon: "fa-wand-magic-sparkles",
        cost: 1,
        // Describing something and waiting for a threshold IS the GM branch -
        // this one is defined inline rather than in ACTIONS, so it has to say so
        // for itself.
        callsGm: true
    };

    // ONE LOOP, AND ONE LIST IS THE LAYOUT. The dynamic tile used to be
    // appended after this, which is why it sat last whatever config.mjs said -
    // and "last" is a position somebody has to be able to choose. Since E103
    // the place is config.mjs `ACTION_GRID`'s (the owner's order of 13.11.2026),
    // not ACTIONS' key order; a key it names that is no universal entry draws
    // nothing.
    for (const key of ACTION_GRID) {
        const def = ACTIONS[key];
        if (def?.kind !== "universal") continue;
        grid.append(actionButton(actor, key, def.deferred ? dynamic : def));
    }

    panel.append(grid);
    tab.prepend(panel);

    // Hope Calls sit underneath the actions, in the colour of the Hope die.
    injectCallsPanel(tab, actor, false);
    attachActionDelegate(app, element);
}

/**
 * The Monocub's abilities, one tile each (`monocubTiles`): bespoke, because Confusion needs a target and a Help/Hinder
 * choice before there is anything to roll. No Move tile since E103 (the owner, 13.11.2026: "kafel move u monocuba
 * usuwamy"): its click only showed the Move's briefing, and a Monocub's Move is its token crossing a room, which costs
 * it nothing (movement.mjs `cubStep`, E72 C10) - the header's two feet say so (`freeMovePip`).
 */
function injectMonocubPanel(tab, actor) {
    const panel = document.createElement("div");
    panel.className = "drpg-action-panel drpg-monocub-panel";

    const title = document.createElement("h3");
    title.className = "drpg-keep";
    title.textContent = game.i18n.localize("DRPG.Monocub.panelTitle");
    panel.append(title);

    // No Hope read-out here. The Hope pips are already on the sheet header,
    // right next to this panel, and the Meddle tile's own price line says what
    // it costs - a third copy of the same number, plus a sentence about who is
    // allowed to top it up, was telling the player something they can see and
    // something they cannot act on.

    const grid = document.createElement("div");
    grid.className = "drpg-action-grid";
    grid.append(...monocubTiles(actor));
    panel.append(grid);

    // THE PURSE (E72 C14; DC37): Hope a Bribe or a Bounty paid, kept by the GMs beside the sheet's and spent first.
    const purse = purseOf(actor);
    if (purse > 0) {
        const line = document.createElement("p");
        line.className = "notes drpg-monocub-purse";
        line.textContent = game.i18n.format("DRPG.Monocub.purseLine", { n: purse });
        panel.append(line);
    }

    /* PART B, UNDER THE TILES (E72 C19): each Bribe waiting with its Accept and Refuse (the same answer as the window,
       monocub.mjs `openBribeOffer`), each open Bounty, and the Monocub's own Ghost Bet (`cubPanelLines`). Words only, as
       the purse's line: no side, colour or title (DC39). */
    for (const item of cubPanelLines(actor)) {
        const line = document.createElement("p");
        line.className = `notes drpg-monocub-${item.kind}`;
        const words = document.createElement("span");
        words.textContent = item.kind === "offer" ? game.i18n.format("DRPG.Monocub.panelOffer", { name: item.name, cost: item.cost })
            : item.kind === "bounty" ? game.i18n.format("DRPG.Monocub.panelBounty", { name: item.name, reward: item.reward })
                : game.i18n.format("DRPG.Monocub.panelBet", { name: item.name, n: item.value });
        line.append(words);
        // Wherever the panel is drawn (sheetMode's question, asked once above): the GM side judges the answer's sender.
        if (item.kind === "offer") {
            for (const accept of [true, false]) {
                const button = document.createElement("button");
                button.type = "button";
                button.className = "drpg-mini-button";
                button.textContent = game.i18n.localize(accept ? "DRPG.Monocub.bribeAccept" : "DRPG.Monocub.bribeRefuse");
                button.addEventListener("click", async () => {
                    button.disabled = true;
                    const { requestBribeAnswer } = await import("./gm-bridge.mjs");
                    await requestBribeAnswer({ cubId: actor.id, bribeId: item.id, accept });
                });
                line.append(" ", button);
            }
        }
        panel.append(line);
    }

    if (isCrimeSilenced(actor)) {
        const note = document.createElement("p");
        note.className = "notes drpg-monocub-silenced";
        note.textContent = game.i18n.localize("DRPG.Monocub.silencedNoteShort");
        panel.append(note);
    }

    // Move's line, on screen (E100, R4107): its window is gone; the owner wants "Free" here, not the whole description.
    panel.append(monocubMoveNote(actor));

    tab.prepend(panel);
}

/*
 * MOVE'S DESCRIPTION STAYS ON SCREEN (E100, 12.11.2026; the owner's rule on E100's review: an action's description is
 * never hidden, folded or collapsed - "nie chowajmy w oknach akcji ... opisu akcji NIGDY"). Item 1 took Move's window
 * away, the one place its description stood; the tile says the name, the price and "Drag your token", its tooltip the
 * hint. The description is a line of the Monocub's panel under its tiles, as the silenced note is. R4107.
 * CUT DOWN THE SAME DAY: the owner, passed on by the coordinator - on the Monocub's panel Move needs only "za darmo",
 * not the whole description. The line reads `DRPG.Move.free` ("Free" / "Za darmo"), still a line of its own, not folded.
 */
export function monocubMoveNote(actor = null) {
    const note = document.createElement("p");
    note.className = "notes drpg-monocub-move";
    /* "Free" for a Monocub whatever its purse (1.2.113, 13.11.2026; R5701). The r112 review's P2 made the line say the
       next price once the Free Move was spent (action-briefing.mjs `moveLine`, actions.mjs `nextCrossingPrice`), on the
       premise that a Monocub pays its crossings as a student does. It does not: movement.mjs `chargeRoute` lets a
       Monocub's drag through with nothing taken - no Free Move, free crossing, Burst or action (E72 C10) - and tier 2
       "1.2.113 a Monocub's crossing costs nothing ..." measured it with nothing left to pay with. A character that is no
       Monocub, which the panel never holds, still reads the next price; with no character, the owner's word. Whether it
       is a Monocub is `sheetMode`'s (R1470: one sheet mode). The panel's repaint draws the line again
       (`refreshMonocubTiles`). */
    note.textContent = !actor || sheetMode(actor).monocub || nextCrossingPrice(actor) === "free" ? game.i18n.localize("DRPG.Move.free") : moveLine(actor);
    return note;
}

/**
 * Whether Move's "drag your token" is true for this character now (the r112 review's P2, 13.11.2026): not in a Class
 * Trial, where the drag is refused (movement.mjs `trialLocked`), nor in an incident the character is in
 * (`lockedInIncident`); the tile is locked in both (`actionButton`). The HUD's Move row and the Monocub's Move tile ask
 * it. `trial` and `incident` are for the suite (R4472).
 */
export function moveDragSaid(actor, { trial = inClassTrial(), incident = Boolean(murderState()?.stage === "incident" && sideOf(actor)) } = {}) {
    return !trial && !incident;
}

/* A Monocub's tiles: one per row of its table (E33 C10), in the table's order - Confusion, Redeem, Ask for Hope,
   Tinker, Ghost Bet. The Move drawn first until E103 is gone (the owner, 13.11.2026). The panel's build and the
   repaint's (`refreshMonocubTiles`, E45 C2) both draw these. */
export function monocubTiles(actor) {
    return Object.entries(MONOCUB.abilities).map(([key, def]) => abilityButton(actor, key, def));
}

function abilityButton(actor, key, def) {
    // The sheet's Hope and the purse's (E72 C14; DC37): a price may be paid from either.
    const held = hopeHeld(actor) + purseOf(actor);
    const affordable = actionsLeft(actor) >= def.cost && held >= def.hopeCost;
    /* SHUT, AND WHY (E72 C9, 12.11.2026; audit S18-62, DC22): a row's blocks this browser can read - Redeem used today,
       the Hope full, an Ask for Hope still open (monocub.mjs `cubBlockSaid`, the owner's copy of the GMs' row) - grey
       the tile with the block's own sentence. The GM asks them again before the price; this is the courtesy. */
    const shut = cubBlockSaid(actor, def);
    const free = def.cost === 0 && def.hopeCost === 0;

    const button = document.createElement("button");
    button.type = "button";
    button.className = `drpg-action-button${affordable && !shut ? "" : " unaffordable"}`;
    // Counted on the actions (E66 C2; S18-36): Hope agrees with nothing in either language.
    // The grid's own words for a price with no Hope (`costLabelFor`): "free", "1 action".
    const price = free ? game.i18n.localize("DRPG.Action.costFree") : def.hopeCost === 0 ? plural("DRPG.Action.costActions", { n: def.cost })
        : plural("DRPG.Monocub.meddleCost", { actions: def.cost, hope: def.hopeCost }, "actions");
    const why = shut ? game.i18n.localize(shut) : affordable ? "" : game.i18n.localize("DRPG.Monocub.cannotMeddle");
    button.dataset.tooltip = `${foundry.utils.escapeHTML(price)}${why ? `<br><em>${foundry.utils.escapeHTML(why)}</em>` : ""}`;
    // "1 · 1◆" was unreadable without already knowing which number was which.
    // Confusion is the only action in the game that costs two different things,
    // so the tile spells both out in the same order the tooltip does.
    button.innerHTML = `
        <i class="fa-solid ${def.icon} drpg-action-icon" inert></i>
        <span class="drpg-action-name">${softWrap(foundry.utils.escapeHTML(def.label))}</span>
        <span class="drpg-action-cost">${free ? game.i18n.localize("DRPG.Action.costFree") : def.hopeCost === 0
            ? plural("DRPG.Action.costActions", { n: def.cost })
            : plural("DRPG.Monocub.meddleCostShort", { actions: def.cost, hope: def.hopeCost }, "actions")}</span>`;

    button.addEventListener("click", async () => {
        const { cubAbilityDialog } = await import("./monocub.mjs");
        await cubAbilityDialog(actor, key);
    });

    return button;
}

/**
 * What the player has to spend, stated before the grid rather than inferred
 * from it.
 *
 * The grid dims what you cannot afford, which answers "can I press this" one
 * button at a time and never answers the question actually being asked, which is
 * "what can I get done this time of day". Ten tiles carrying a small `1 · 0◆` in
 * the corner is a lot of arithmetic for a decision the numbers could just state.
 *
 * The free Move is called out separately because it is the one piece of the
 * budget that is not interchangeable - it buys a room crossing and nothing else,
 * and a player who does not know they still have it will pay an action for a
 * door they could have walked through.
 */
export function budgetLine(actor, state = murderState()) {
    const line = document.createElement("p");
    line.className = "notes drpg-keep drpg-budget-line";

    /*
     * IN A FIGHT THIS ROW SAYS WHOSE TURN IT IS (E49 B2's turn line; audit S03-30, "the victim, at the start of their
     * turn, sees only the sheet and nothing says 'your turn'"; its fix: "in an incident, the turn's banner in the sheet
     * itself"). The same row, not a new one: the owner's rule of 10.11 is that a state changes the look and never the
     * layout, and in an incident the budget has nothing to say - every tile but the fight's is shut and a crisis action
     * spends no action (`costOf`). The words are the incident card's (events.mjs `incidentTurnText`), so the card and
     * the sheet cannot disagree; the light is `isTheirTurn`'s, the predicate that dims the fight's tile under it. Every
     * seat `sideOf` names (a third party who walked in too: their tiles are shut as well) reads it; anyone outside the
     * incident reads the budget as before.
     */
    if (state?.stage === "incident" && sideOf(actor, state)) {
        const mine = isTheirTurn(actor, state);
        line.textContent = incidentTurnText({ state, mine: actor.id, myTurn: mine, acting: actingActor(state) });
        line.classList.add("drpg-budget-turn");
        if (mine) line.classList.add("drpg-budget-mine");
        return line;
    }

    const left = actionsLeft(actor);
    const parts = [plural("DRPG.Actions.leftOf", {
        left, max: actionsMax(actor)
    }, "max")];

    if (hasFreeMove(actor)) parts.push(game.i18n.localize("DRPG.Actions.freeMoveLeft"));
    // Fog took it (E24 C3b; E24-24): said, so a Move that is not there reads as the weather's and not as spent.
    else if (overflowBlocksFreeMove()) parts.push(game.i18n.localize("DRPG.SheetNotes.fogBudget"));

    // What is already banked, next to what the day gave you: a Burst bought with Hope, and the free crossings a Sprint,
    // a Dash, a Facilities room action or Infiltrate banked into one counter (actions.mjs `grantFreeMoves`), which keeps
    // no record of what filled it - so the line names the crossing, not what paid for it (the audit of 1.2.113, A113-C4-2).
    //
    // On the budget line rather than on the tiles, for the same reason the
    // action count is: the question a player is asking here is "what can I get
    // done", and a banked Burst is part of that answer everywhere at once
    // rather than on any one tile.
    const burst = freeActionsLeft(actor);
    if (burst) parts.push(plural("DRPG.Actions.burstBanked", { n: burst }));
    const sprint = freeMovesLeft(actor);
    if (sprint) parts.push(plural("DRPG.Actions.sprintBanked", { n: sprint }));

    if (isEclipse()) {
        const left = eclipseMovesLeft(actor);
        // `null` is a Morning or Night Eclipse: free placement, so there is no
        // count to report - saying "null crossings" or "0 crossings" would both
        // be worse than saying what the rule actually is.
        parts.push(left === null
            ? game.i18n.localize("DRPG.Actions.eclipseFreePlacement")
            : plural("DRPG.Actions.eclipseMovesLeft", { n: left }));
    }

    line.textContent = parts.join(" · ");
    // "Empty" means nothing left to spend, and a banked Burst is something.
    if (!left && !burst) line.classList.add("drpg-budget-empty");
    return line;
}

/*
 * THE STAGE 6 PANEL IS GONE ENTIRELY (Dawid, 29.08).
 *
 * It had already lost its three clean-up actions to the Tamper tile on 28.08,
 * which left one tile in a panel of its own: "Turn on your partner". That has
 * now moved inside Direct Murder, where it belongs - turning on your partner
 * IS a direct murder, and the only one the guide lets you commit without
 * declaring it in an Eclipse first. See `performBetrayal` in action-murder.mjs.
 *
 * So a killer in Stage 6 reads ONE grid of ten tiles, which is what the grid
 * was always for. Nothing here decides placement any more because there is
 * nothing left to place.
 */
function injectCallsPanel(tab, actor, monokuma) {
    const held = monokuma ? monokumaPool(actor) : hopeHeld(actor);
    const max = monokuma ? STARTING.despairMax : hopeMax(actor);

    const panel = document.createElement("div");
    // A Despair Call that silences somebody closes this whole menu until the
    // clock moves, and until now it closed it INVISIBLY: `calls.mjs` refuses a
    // silenced player's Call with a notification, and every button on the panel
    // went on looking exactly as available as it had a moment earlier. The
    // stylesheet has had the greyed-out state written for it the whole time -
    // `.drpg-calls-panel.drpg-silenced`, dimmed with a `not-allowed` cursor on
    // the buttons - and nothing ever put the class on. Found by sweeping for
    // CSS classes the code never names.
    //
    // Refusal stays where it is. The dimming says "not now"; pressing anyway is
    // still how a player is told why.
    panel.className = `drpg-calls-panel ${monokuma ? "drpg-despair-panel" : "drpg-hope-panel"}${
        isCallSilenced(actor) || (!monokuma && overflowBlocksCalls()) ? " drpg-silenced" : ""}`;

    // The pool is on the bar for a Monokuma and nowhere else: Despair is the
    // only thing their sheet is about, and the number is not repeated anywhere
    // they can see. A student already reads their Hope twice over - the pips in
    // the sheet header and the player strip in the corner - so a third copy on
    // the drawer was noise on the one line that has to stay scannable.
    const title = document.createElement("h3");
    title.className = "drpg-keep";
    const heading = game.i18n.localize(
        monokuma ? "DRPG.Calls.despairTitle" : "DRPG.Calls.hopeTitle");
    title.innerHTML = monokuma
        ? `<span>${heading}</span><span class="drpg-calls-pool">${held} / ${max}</span>`
        : `<span>${heading}</span>`;
    panel.append(title);

    const grid = document.createElement("div");
    grid.className = "drpg-action-grid";

    // A Call is not a room crossing either - see spendHopeCall/spendDespairCallFor
    // in calls.mjs, which refuse it outright while the Eclipse is running.
    //
    // And a Despair Call is shut for the length of a Class Trial (T-1), which a
    // Hope Call is not - so the note is per drawer rather than per sheet.
    const lockNote = callLockNote(monokuma);

    const calls = monokuma ? despairCallsFor(held) : affordableHopeCalls(actor);
    for (const call of calls) grid.append(callButton(call, monokuma, lockNote));

    panel.append(grid);
    tab.append(panel);
}

/**
 * Why every Call on one drawer is grey right now, or null.
 *
 * One reader for the injection and the repaint, so the two cannot disagree about
 * a drawer the player is looking at.
 */
export function callLockNote(monokuma) {
    if (isEclipse()) return game.i18n.localize("DRPG.Eclipse.callsLocked");
    if (monokuma && inClassTrial()) return game.i18n.localize("DRPG.Trial.callsLocked");
    /* SILENCE, THE WEATHER, ON THE DRAWER (E24 C3b, 08.11.2026; E24-24, audit S03-13). calls.mjs refuses every Hope
       Call while the Overflow's Silence runs (`overflowBlocksCalls`, `DRPG.Overflow.silenced`), and the drawer went
       on looking open: a player read six Hope and seven live tiles and learnt the rule from the refusal. A Despair
       Call is not a Hope Call, so a Monokuma's drawer stays as it is. */
    if (!monokuma && overflowBlocksCalls()) return game.i18n.localize("DRPG.Overflow.silenced");
    return null;
}

/**
 * A Call tile, built to exactly the same template as an action tile: icon on
 * top, name, price underneath. Only the colour and the icon differ, so a player
 * reads the whole sheet the same way rather than learning two layouts.
 */
export function callButton(call, monokuma, lockNote = null) {
    const button = document.createElement("button");
    button.type = "button";

    /*
     * ONE TILE, TWO JOBS - AND THAT IS DELIBERATE (E14).
     *
     * While an assembly is pending, Public Announcement becomes the button
     * that calls it off. Not a control in the GM panel: the person who wants
     * to cancel is the person looking at the tile they bought it with, and
     * making them find another window to undo a thing they did here is how a
     * pending order gets left standing by accident.
     *
     * The whole state is computed once, here, because both the price and the
     * grey depend on it - see trap 103 immediately below.
     */
    const pending = call.defers ? pendingGather() : null;
    // Two reasons a Call is grey, and they are not the same reason.
    //
    // "You cannot afford it" is fixed by holding Hope; "the Eclipse is running"
    // is fixed by waiting, and applies to every Call at once regardless of the
    // pool. Sharing one look meant a player with six Hope saw seven identical
    // grey tiles next to a full pool and had nothing to read but the tooltip.
    /*
     * TRAP 103. A cancel costs nothing, so "you cannot afford it" cannot be
     * allowed to grey it out - and the pool is at its emptiest exactly when
     * somebody wants to cancel, because they have just spent six on the thing
     * they are cancelling. Affordability drops out of the class entirely while
     * the tile is in its pending state.
     *
     * BONE, NOT RED. Red already means one thing in this module - the Call
     * hands the turn to a GM (`GM_ROUTE_CLASS`, below) - and gold is Hope's. A third
     * meaning on red is the mistake the stylesheet's note about outline colour
     * warns against. Bone plus the pulsing dot reads as "this is standing and
     * about to go off", which is what it is.
     */
    // `drpg-locked-eclipse` whatever shut it: the class is the LOOK of a Call
    // that is closed until something ends, and the reason is in the note. A
    // second class would be a second stylesheet rule for the same grey.
    /* A CALL A GM RULES IS RED, WITH THE GM'S CHIP (E22 C5c; A4, audit S03-26, S09-22): Experience and Ultimate
       (`needsGm`) wait for a GM's yes before anything is spent (calls.mjs: their window's Send is on the GM's road,
       `callWindow`'s `gmRoute`), and their tiles looked like every Call a player simply buys. The flag that makes the
       window's Send red makes the tile red, and the chip under the cost says who it waits for, as an action tile's. */
    // And Talent's tile, whose two Calls a GM rules (E72; calls.mjs `callAsksGm`).
    const askGm = callAsksGm(call, monokuma ? "despair" : "hope") && !pending;
    button.className = `drpg-action-button drpg-call-button${
        pending ? " drpg-call-pending"
            : lockNote ? " drpg-locked-eclipse"
            : call.affordable ? "" : " unaffordable"}${askGm ? ` ${GM_ROUTE_CLASS}` : ""}`;
    button.dataset.drpgCall = call.key;
    button.dataset.drpgCallKind = monokuma ? "despair" : "hope";

    const costLabel = pending
        ? game.i18n.localize("DRPG.Calls.freeShort")
        : game.i18n.format(
            monokuma ? "DRPG.Calls.costsDespairShort" : "DRPG.Calls.costsHopeShort",
            { cost: call.cost }
        );
    const note = pending
        ? `<br><em>${game.i18n.localize("DRPG.Calls.gatherNoRefund")}</em>`
        : lockNote
        ? `<br><em>${foundry.utils.escapeHTML(lockNote)}</em>`
        : call.affordable ? "" : `<br><em>${game.i18n.localize("DRPG.Calls.cannotAfford")}</em>`;
    const summary = pending
        ? game.i18n.format("DRPG.Calls.gatherBody", {
            room: foundry.utils.escapeHTML(pending.room)
        })
        : foundry.utils.escapeHTML(proseOf(call, "effect"));
    // Same as the action tiles: `costLabel` is on the face of this button, so
    // the hover carries what the Call does and, when it applies, why it cannot
    // be taken (E3).
    button.dataset.tooltip = `${summary}${note}`;

    const label = pending
        ? game.i18n.localize("DRPG.Calls.gatherCancel")
        : call.label;

    button.innerHTML = `
        <i class="fa-solid ${call.icon ?? "fa-circle"} drpg-action-icon" inert></i>
        <span class="drpg-action-name">${softWrap(foundry.utils.escapeHTML(label))}</span>
        <span class="drpg-action-cost">${costLabel}</span>${askGm
            ? `<span class="drpg-action-gm">${game.i18n.localize("DRPG.Action.waitsForGm")}</span>` : ""}`;

    return button;
}

/** What the Despair pool backing a Monokuma actor can spend: less what it owes (E05 C12). */
export function monokumaPool(actor) {
    try {
        const user = poolUserFor(actor);
        return user ? spendableDespair(user.id) : 0;
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
    const { confirmCall, spendHopeCall, spendDespairCallFor, hopeHeld, callBarred } =
        await import("./calls.mjs");

    const despair = kind === "despair";
    let call = despair ? DESPAIR_CALLS[key] : HOPE_CALLS[key];
    if (!call) return;
    /* A tile of two Calls asks which first (call-pickers.mjs `pickChoice`, E72); the rest runs on the chosen Call's own
       row. A tile whose two a GM rules (Talent) asks it in its confirmation instead, with the note (`confirmCall`'s
       `choices`, R3818): the rest runs on the tile's row up to there. */
    const table = despair ? DESPAIR_CALLS : HOPE_CALLS;
    const ruled = Array.isArray(call.choices) && callAsksGm(call, despair ? "despair" : "hope");
    if (Array.isArray(call.choices) && !ruled) {
        const { pickChoice } = await import("./call-pickers.mjs");
        const chosen = await pickChoice(call, despair ? "despair" : "hope");
        if (!chosen) return;
        key = chosen;
        call = table[key];
    }

    /*
     * ONE PURCHASE OF A CALL AT A TIME (E51 fix round FG7, 31.10.2026; review goal G2). A sheet redrawn while this
     * Call's picker or confirmation stands puts its tile back live (the delegate above disables only the element that
     * was pressed), and a second press opened a second window of the same purchase. Raised instead, and nothing more
     * (call-pickers.mjs `callWindowOpen`; each window also refuses a twin of itself, `callWindow`'s `once`).
     */
    const { callWindowOpen } = await import("./call-pickers.mjs");
    if (callWindowOpen(call, despair ? "despair" : "hope")) return;

    /*
     * WHAT SHUTS THE WHOLE MENU IS ASKED FIRST (CALL-17, 20.09).
     *
     * An Eclipse, the overflow's Silence, a Class Trial for a Monokuma, a dead
     * student: all four were only asked inside the spenders, which this function
     * reaches after the target picker and the confirmation. So the answer to "may I
     * do this at all" arrived three windows late, and the player had by then chosen
     * a victim and read a price. `callBarred` is the same reader the spenders use -
     * see the note on it for why they go on asking as well.
     */
    const barred = await callBarred(actor, { despair });
    if (barred) {
        ui.notifications.warn(barred);
        return;
    }

    /*
     * TRAP 102, AND IT HAS TO BE THE FIRST THING IN THIS FUNCTION.
     *
     * Everything below - the affordability check, the target picker, the
     * confirmation, `spendDespairCallFor` - assumes a purchase. Calling off an
     * assembly is not one: it costs nothing and there is nothing left to point
     * at. Reached one line later, through `spendDespairCallFor`, it would have
     * taken a second six Despair for the privilege of undoing the first.
     */
    const standing = call.defers ? pendingGather() : null;
    if (standing) {
        const { cancelGather } = await import("./call-effects.mjs");
        // A Call window (E51 C2; call-pickers.mjs `callWindow`): the Despair Call's own, with no header -
        // nothing is bought - and buttons saying what each does: the default calls the assembly off, as the
        // confirm's yes did, and the other keeps it.
        const { callWindow, callWindowClass } = await import("./call-pickers.mjs");
        const answer = await callWindow({
            call, kind,
            body: `<p>${game.i18n.format("DRPG.Calls.gatherCancelAsk", {
                room: foundry.utils.escapeHTML(standing.room)
            })}</p><p class="notes">${game.i18n.localize("DRPG.Calls.gatherNoRefund")}</p>`,
            // The kit's slots (E21 C5a): Call it off the primary; the closing word is the kit's Cancel, which keeps it.
            footer: { primary: { action: "yes", label: game.i18n.localize("DRPG.Calls.gatherCallOff") } },
            modal: true,
            /* ONE AT A TIME (E44 C2c, 04.11.2026; D176): the call-off window as the confirmation step of its Call, so
               `callWindowOpen` above raises it on a second press, and `callWindow` refuses a twin of it (null: kept). */
            once: callWindowClass(call, "despair", "confirm")
        });
        if (answer !== "yes") return;
        await cancelGather();
        actor.sheet?.render(false);
        return;
    }

    const held = despair ? monokumaPool(actor) : hopeHeld(actor);
    if (held < call.cost) {
        ui.notifications.warn(game.i18n.format(
            despair ? "DRPG.Calls.costsDespair" : "DRPG.Calls.costsHope",
            { cost: call.cost, held }
        ));
        return;
    }

    // Silence, the Despair Call, is `callBarred`'s above since E15 C4 (audit S09-35).

    // Experience buys the use of an experience. With none written on the sheet
    // there is nothing to buy, and the Call would have been paid for, armed, and
    // then met a roll window with no chips to tick.
    if (call.grants === "experience" && !Object.keys(actor.system?.experiences ?? {}).length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Calls.noExperiences"));
        return;
    }

    // Hope granted under the Despair darkening lands nowhere - said before the
    // picker rather than after it and the confirmation (review of CALL-05).
    if (despair && call.grantsHope) {
        const { overflowBlocksHope } = await import("./overflow.mjs");
        if (overflowBlocksHope()) {
            ui.notifications.warn(game.i18n.localize("DRPG.Overflow.noHopeNow"));
            return;
        }
    }

    /*
     * A SECOND COPY IS REFUSED BEFORE THE PRICE (E15 C4, 25.10.2026; audit S09-35). A second Loaded
     * Die or Experience on a student already holding one went through the confirmation and the
     * Spend, and was refused only then (an Experience after the GM's decision). A Call with no
     * target arms its buyer, so the question is answerable here; one with a target is asked after
     * the picker by `refusalBeforePaying` (Despair) and by the GM (`call.arm`). By the row's key,
     * which is how its entry is stored.
     */
    if (call.target === "none" && call.grants && alreadyArmed(actor, { ...call, key })) {
        ui.notifications.warn(game.i18n.format("DRPG.Calls.alreadyArmed", { name: actor.name, call: call.label }));
        return;
    }

    // Point it at something first: a player, a project, a room, an item.
    const { pickTarget, refusalBeforePaying } = await import("./call-effects.mjs");
    const choice = await pickTarget(actor, call, despair ? "despair" : "hope");
    if (choice === null) return;

    // And the target-specific refusals before the confirmation, not after it.
    // `spendDespairCallFor` asks again: the world can move while a window is open.
    if (despair) {
        const refusal = refusalBeforePaying(call, choice);
        if (refusal) {
            ui.notifications.warn(refusal);
            return;
        }
    }

    /* Talent's rows (`ruled`, above): one shut with its reason - Experience with none on the sheet, a Call already held -
       stays greyed in the window, as an action's row, and the checks below the window are asked again of the one picked. */
    const shut = {};
    if (ruled) for (const k of call.choices) {
        if (table[k].grants === "experience" && !Object.keys(actor.system?.experiences ?? {}).length) shut[k] = game.i18n.localize("DRPG.Calls.rowNoExperiences");
        else if (table[k].grants && alreadyArmed(actor, { ...table[k], key: k })) shut[k] = game.i18n.localize("DRPG.Calls.rowArmed");
    }
    let note = await confirmCall(call, { kind: despair ? "despair" : "hope", held, choice, actor, ...(ruled ? { choices: call.choices, shut } : {}) });
    if (note === null) return;
    if (ruled) {
        if (!call.choices.includes(note.key) || shut[note.key]) return;
        key = note.key;
        call = table[key];
        note = note.note;
    }

    if (despair) await spendDespairCallFor(actor, key, { note, choice });
    else await spendHopeCall(actor, key, { note, choice });

    actor.sheet?.render(false);
}

/**
 * Why this action would fail here, if it would - before anybody spends a click.
 *
 * Every one of these checks already existed; they just ran on the far side of
 * the button. A player picked Search, watched the briefing open, read the
 * options, rolled, and only then learned the room had been picked clean - and
 * in the unanswered case the module had to hand the action back afterwards.
 * The knowledge was there the whole time. This asks the same questions while
 * the tile is being drawn.
 *
 * Returns a reason string to show, or null when the action is fine.
 *
 * Deliberately NOT a hard block: the tile stays clickable and still opens its
 * briefing, because "what would this have done" is worth reading even when the
 * answer is "nothing here". The dimming is advice, not a gate - and the real
 * guards downstream stay exactly where they are, since a room's state can
 * change between a sheet render and a click.
 */
export function roomBlockFor(actor, key) {
    try {
        // Facilities (the tile keyed "rest") is dimmed only when no row of its window can be taken: the tooltip names
        // every row's reason, and the window shows them all greyed (E16 part 2 C4, 26.10.2026; audit S02-26: the tile
        // looked live and its press answered "Nothing here can be done right now." alone). Its rows are the two rests
        // and, since E93, the room's actions; until fix line 113f (13.11.2026) the tile read the rests alone and was
        // struck through while a GM's room action or a project's stood open (the owner's report at a table on 1.2.112).
        // One list for both: action-facilities.mjs `facilitiesRows`.
        if (key === "rest") return facilitiesShutReason(actor);

        // Only the five actions whose subject lives in the room can be blocked
        // by the room. Move and the rest are about the actor. Not Projects (E16 part 2 C4; audit S03-24): it
        // was on this list, so outside every room its tile was struck through with "You are not in any room",
        // while proposing a project works anywhere (the note at the end of this function) - the corridor hid
        // the one road to the first project. `performProject` still shuts its "work on" row by itself.
        const roomBound = ["search", "observe", "listen", "palm", "tamper"];
        if (!roomBound.includes(key)) return null;

        // `roomOfActor` answers with the room's NAME, not a region document -
        // every other caller in the module treats it as a string, and reading
        // `.name` off it silently yields undefined, which reads as "outside
        // every room" no matter where the token is standing.
        const place = locateActor(actor);
        const here = place?.room ?? null;

        // SABOTAGE USED TO BE ANSWERED HERE, and is not any more: it has no
        // tile to dim. It is the third row of the Projects menu now, where
        // "nothing here to break" is a struck-through option with the reason
        // written beside it - which is the same information said better, and
        // said in the window where the alternative is one row away. The check
        // itself moved verbatim into `performProject`.

        if (!here) return game.i18n.localize("DRPG.Action.noRoomNote");

        // Sealed first: it outranks the counter, and it is the more useful
        // sentence. A room with nothing to find in it reading "already picked
        // clean" sends the player back at the next time of day to try again.
        if (key === "search" && SearchTokens.sealed(here, place?.scene))
            return game.i18n.localize("DRPG.SearchTokens.sealed");

        // `exhausted`, not `pickedClean` - the latter says "the action is
        // spent", which is true after a roll and a lie before one.
        if (key === "search" && SearchTokens.left(here, place?.scene) <= 0)
            return game.i18n.localize("DRPG.SearchTokens.exhausted");

        if (key === "listen" && neighbouringRooms(place?.scene, here).length === 0)
            return game.i18n.localize("DRPG.Listen.noNeighbours");

        // Palm needs a pocket, and a pocket needs somebody standing in it -
        // true of both directions. The same question `performPalm` asks, on
        // the scene the character stands on (`othersInRoom`, E12 C3), so the
        // tile tells the truth about the room rather than guessing.
        if (key === "palm" && othersInRoom(actor).length === 0)
            return game.i18n.localize("DRPG.Steal.nobodyHere");

        // TAMPER IS ANSWERED, AND IT USED TO SAY IT COULD NOT BE.
        //
        // The note that stood here said Tamper has "a second branch which
        // always works", so asking the GM's ledger would be "a socket round
        // trip to dim nothing". The second branch does not always work:
        // `framingCandidates` is empty in a cast down to its last two, and
        // both branches being shut is exactly the case a player needs told.
        //
        // Dawid, 28.08: the tile greys out only after you click it. That is
        // true and it is this line - the strike-through was appearing inside
        // the variant window, on two struck rows, one click too late.
        //
        // So the answer is cached rather than skipped. See `tamperBlock`: the
        // free half is computed here every render, the half that needs the
        // ledger is asked once per room per time of day and repainted onto the
        // tile when it lands.
        if (key === "tamper") return tamperBlock(actor);

        // NOT the project tile. An empty room is a reason there is nothing to
        // work ON, and the tile has two branches: working on a project and
        // proposing one. Proposing works anywhere, so striking the tile through
        // in a room with no projects hid the only route to creating the first
        // one - and the first one is always proposed from a room with none.
        // `performProject` still refuses the "work on it" half by itself.

        return null;
    } catch (err) {
        // A tile that cannot work out whether it is blocked is shown as normal.
        // Guessing "blocked" would hide a legal action; guessing "fine" only
        // means the existing guard downstream does its job.
        debug("Could not decide whether an action is blocked here", err);
        return null;
    }
}

/* ==========================================================================
 * WHETHER TAMPER HAS ANYTHING TO WORK ON
 * --------------------------------------------------------------------------
 * Two branches, two costs to find out.
 *
 *   frame  - is there anybody left to point at? `framingCandidates` reads the
 *            living cast on this client. Free, so it is asked every render.
 *   cover  - is there a trace of yours here that is not reinforced? Only the
 *            GM's ledger knows, and on a player's client that is a socket
 *            round trip. Asked once per room per time of day, cached, and
 *            painted onto the tile when the answer arrives.
 *
 * The tile is struck through only when EVERY branch is shut. A tile dimmed
 * because one of two routes is closed would be lying in the more expensive
 * direction: it would hide the route that still works.
 *
 * THE CACHE KEY IS THE STATE THE ANSWER DEPENDS ON, not a duration. Traces
 * belong to rooms, so the room is in it; they are laid and swept as the clock
 * turns, so the time of day is in it. Anything else that could change the
 * answer mid-scene - a trace erased, one planted - arrives as a settings
 * update, which `forgetTamper` below hangs on.
 * ========================================================================== */

const tamperAnswers = new Map();   // actorId -> { key, blocked }
const tamperAsking = new Set();    // actorId - one question in flight at a time

function tamperKey(actor) {
    const clock = getClock();
    return `${roomOfActor(actor) ?? "-"}|${clock.timeOfDay}|${clock.day}|${clock.session}`;
}

/** Drop every cached answer. Anything that could have changed a trace. */
export function forgetTamper() {
    tamperAnswers.clear();
}

function tamperBlock(actor) {
    // Nowhere to do it is answered by the caller's own `here` check, which runs
    // before this. Reaching here means the character is standing in a room.

    /*
     * BEING WATCHED WITH A FULL TRACK IS THE FIRST ANSWER, and it is free
     * (Dawid, 17.09, correcting 29.08).
     *
     * A full Sanity track used to refuse every Tamper outright, which was the old
     * double price showing through: the attempt is paid for by the chain now, and
     * an action pays it perfectly well. What a full track cannot pay for is the
     * CONCEALMENT - so the refusal is about who can see you, and it exempts a
     * killer's accomplices exactly as `witnessesTo` does for the roll.
     *
     * Asked before the ledger, because a tile that waits on a socket round trip to
     * say "you have nothing left" makes the player press it to find out. The
     * PRICE's own refusal is not here at all: `actionButton` has the quote.
     */
    if (resourceValue(actor, "stress") >= resourceMax(actor, "stress")
        && witnessesTo(actor, othersInRoom(actor)).length) {
        return game.i18n.localize("DRPG.Tamper.watchedNoSanity");
    }

    const key = tamperKey(actor);
    const seen = tamperAnswers.get(actor.id);
    if (seen?.key === key) return seen.blocked;

    // No answer for this room yet. Go and get one - and say nothing in the
    // meantime, because a tile dimmed on a guess is worse than one that is a
    // beat late. See the note above `roomBlockFor` on why this is advice.
    askTamper(actor, key);
    return null;
}

async function askTamper(actor, key) {
    if (tamperAsking.has(actor.id)) return;
    tamperAsking.add(actor.id);
    try {
        const cleanup = await import("./cleanup.mjs");
        const { requestCleanableTraces } = await import("./gm-bridge.mjs");

        // The same two questions `performTamper` asks, in the same shapes -
        // including `mine`, which is what separates an ordinary character
        // tidying after themselves from a killer standing on their own scene.
        const stageSix = cleanup.isCleaner(actor);
        const [mine, candidates] = await Promise.all([
            // Quiet: the sheet asks as it draws, and a message here would be for nothing the player pressed.
            requestCleanableTraces(actor.id, { mine: !stageSix, quiet: true }),
            cleanup.framingCandidates(actor)
        ]);

        const erasable = mine.filter(t => !t.reinforced);
        // A killer standing over their own body has a third route, and it is
        // the one they are most likely to want.
        const body = stageSix && cleanup.bodyIsHere(actor);

        const blocked = (erasable.length || candidates.length || body)
            ? null
            : game.i18n.localize(mine.length
                ? "DRPG.Tamper.onlyReinforced" : "DRPG.Tamper.nothingOfYours");

        // The world may have moved while the socket was out. Storing an answer
        // under the key it was ASKED for means a stale one is simply never
        // matched again, rather than being believed for the wrong room.
        tamperAnswers.set(actor.id, { key, blocked });
        paintTamper(actor, blocked);
    } catch (err) {
        // No answer is the same as "no reason to dim it", which is where the
        // tile already is. The guard inside `performTamper` is untouched.
        debug("Could not work out whether Tamper has anything to work on", err);
    } finally {
        tamperAsking.delete(actor.id);
    }
}

/**
 * Paint the answer onto the tile without re-rendering the sheet.
 *
 * A full render here would be a sheet redrawing itself a moment after opening,
 * every time, for one class on one button - and it would fight `growForCalls`
 * and the tile fitter for the frame it happens to land in.
 */
function paintTamper(actor, blocked) {
    for (const app of sheetsFor(actor)) {
        for (const tile of app.element.querySelectorAll('[data-drpg-action="tamper"]')) {
            tile.classList.toggle("drpg-no-subject", Boolean(blocked));

            /*
             * REBUILT FROM THE TWO HALVES THE TILE KEPT, NOT BY CUTTING THE LAST
             * LINE OFF WHAT IS THERE.
             *
             * It used to strip the final `<br><em>…</em>` and put its own back -
             * which ate whatever the last line happened to be. Measured on the
             * player's sheet in a Class Trial (19.09): every tile carried "The
             * Class Trial is in session…", and a second after the ledger answered,
             * the Tamper tile alone lost its reason and sat there dimmed and
             * silent. The same cut would have eaten the Eclipse's line, and the
             * fight's.
             *
             * `actionButton` stores the head (the hint plus whatever locks the
             * tile) and the tail (the killer's free-tonight line) so this can put
             * its own sentence between them, which is where it belongs.
             */
            const head = tile.dataset.drpgTipHead ?? tile.dataset.tooltip ?? "";
            const tail = tile.dataset.drpgTipTail ?? "";
            const why = blocked ? `<br><em>${foundry.utils.escapeHTML(blocked)}</em>` : "";
            tile.dataset.tooltip = `${head}${why}${tail}`;
        }
    }
}

/** Exported for the suite, which reads the tile a fight draws (E32+E07 C16). */
export function actionButton(actor, key, def) {
    const button = document.createElement("button");
    button.type = "button";

    // An action the budget cannot pay for is dimmed exactly the way an
    // unaffordable Hope Call is - same class, same look. The tile stays visible
    // and still opens its briefing, because knowing what an action would do is
    // half of deciding whether to save an action for it.
    const cost = costOf(actor, key, def);
    /*
     * CAN THIS BE PAID FOR AT ALL - and for a priced action that is the whole
     * chain, not the action step (T-1). A student with no actions and one Hope
     * can still object and still analyse in a trial, so the tile must not be
     * dimmed; the same student with nothing at all is dimmed with the chain's own
     * sentence under it.
     *
     * The stripe still says "1 action" when an action is what pays, even with a
     * banked Burst covering it - that IS what it costs. See `canPayFor`.
     */
    const priced = PRICE_CHAINS[key] ? priceQuoteFor(actor, key) : null;
    const affordable = priced ? !priced.blocked : canPayFor(actor, cost);
    const eclipse = isEclipse();

    // Nothing here to do it to - a separate state from "cannot pay for it",
    // because the answer is different: one is fixed by waiting for the next
    // time of day, the other by walking into another room.
    const blocked = roomBlockFor(actor, key);

    // `nothingToBreak` lived here: the sabotage tile went out entirely when its
    // room held nothing to break, because unlike every other dimmed tile it had
    // no second half to offer. It has a second half now - it is one row of the
    // Projects menu, next to "work on" and "propose" - so the tile it used to
    // switch off does not exist and neither does the rule.

    // WHICH TILES ARE OUT, AND WHY EACH ONE IS.
    //
    // The Eclipse is placement-only - see the guard in action-rolls.mjs's
    // `performAction`. Move is exempt there; it was exempt here too while the
    // Monocub's panel drew a Move tile, and no tile draws it since E103.
    //
    // Direct Murder is exempt the other way round, and this tile is the reason
    // the rule needs stating twice: the guard refuses the action, but a tile
    // that looks pressable and then refuses is worse than one that says no in
    // advance. Greyed outside an Eclipse, live inside one - the exact inverse
    // of every other tile on the sheet.
    /*
     * IN AN INCIDENT, EVERYTHING BUT DIRECT MURDER IS SHUT.
     *
     * The guide's turn structure assumes the two people in a fight are doing
     * nothing else, and `performAction` has always refused them - but a tile
     * that looks pressable and then refuses is worse than one that says no in
     * advance, which is the rule this file has applied to the Eclipse since it
     * was written. Direct Murder is the exception because it is no longer only
     * Direct Murder: during an incident it opens that incident's own actions.
     */
    const inIncident = Boolean(murderState()?.stage === "incident" && sideOf(actor));

    /*
     * DIRECT MURDER HAS A THIRD OPEN WINDOW NOW (Dawid, 29.08): Stage 6 with a
     * partner still standing, where it means "turn on them". Without this the
     * tile stayed greyed out for exactly the person the guide gives that
     * decision to - the rule would have existed with no way to reach it.
     */
    const canBetray = key === "directMurder" && Boolean(betrayalTarget(actor));

    /*
     * AND IN A CLASS TRIAL, ONE TILE (T-1, Dawid 17.09).
     *
     * Analyze. The other nine are shut, Move included, and the reason the player
     * reads is the trial rather than the Eclipse - the same rule `performAction`
     * enforces, said here in advance so nobody presses a tile to be told no.
     * Direct Murder keeps its inverted rule and needs no branch: it is open only
     * in an Eclipse, a fight or a betrayal, none of which a trial is.
     */
    const inTrial = inClassTrial();

    const locked = key === "directMurder"
        ? (!eclipse && !inIncident && !canBetray)
        : (inIncident || eclipse || (inTrial && key !== "analyze"));

    /*
     * AND THE OTHER HALF: WHICH TILE IS THE MOVE (D12, Dawid 29.08).
     *
     * Dimming nine tiles says what you cannot do. It does not say what you can,
     * and in both of these moments the player is looking at a sheet that has
     * just changed under them and needs an answer, not an elimination.
     *
     * TWO MOMENTS, AND THE SECOND IS THE ONE THAT EARNS THIS.
     *
     *   In an incident: everything is shut except Direct Murder, which is no
     *   longer Direct Murder - it opens the incident's own actions. Lighting it
     *   turns "why is everything grey" into "press this".
     *
     *   After the kill: nothing is shut. The killer has their whole budget and
     *   no reason to suspect that one tile now behaves differently - Tamper is
     *   free of the action economy for the rest of this time of day (D3). A
     *   rule nobody is told about is a rule that does not exist at the table,
     *   and this is the only place it can be said at the moment it applies.
     *
     * `isCleaner` is the same window D3 charges by, read from the same module,
     * so the light and the discount cannot disagree.
     */
    const cleaningNow = key === "tamper" && isCleaner(actor);
    // Lit in all three of its open windows: the fight, and the betrayal, and
    // the killer's own clean-up on the tile next to it. A door nobody can see
    // is the same as a locked one (D12).
    const theMove = (key === "directMurder" && (inIncident || canBetray)) || cleaningNow;

    /*
     * IN A FIGHT THE TILE IS THE FIGHT'S (E32+E07 C16, 03.10.2026; audit S02-33, measured at
     * a table of three). It read "Direct Murder / 1 action / GM" for both sides: the victim
     * was told their crisis actions were under Actions and found a tile offering to murder
     * somebody, and the cost and the chip were both wrong - a crisis action spends no action
     * (`costOf`) and asks no ruling of the tile (config.mjs `murderParksForGm`). It is named
     * for the side now (`crisisTileLabel`), lit as it was, and off-turn it is dimmed with the
     * sentence the press answers (`openCrisisMenu`) - `aria-disabled` and not `disabled`,
     * because a disabled button takes no pointer, so its tooltip never shows (read, not
     * measured here: the harness draws no tooltip), and the press is what says it in words.
     */
    const fightTile = key === "directMurder" && inIncident;
    const offTurn = fightTile && !isTheirTurn(actor);

    button.className = `drpg-action-button${(affordable && !locked && !offTurn) ? "" : " unaffordable"}${
        blocked ? " drpg-no-subject" : ""}${theMove ? " drpg-action-hot" : ""}`;
    if (offTurn) button.setAttribute("aria-disabled", "true");

    // NOT `data-action`: ApplicationV2 claims that attribute for its own action
    // dispatch and swallows the click looking for a handler it does not have.
    button.dataset.drpgAction = key;

    // What this tile costs you, as a stripe rather than a sentence.
    //
    // Three kinds, and a player picks differently for each: one is free and can
    // always be taken, one spends a slice of a budget of two, and one hands the
    // turn to the GM and comes back at their pace. The cost line underneath
    // already says which - but it says it in words, at 11px, on ten tiles at
    // once, which is a paragraph to read before every decision.
    //
    // Derived from the definition rather than listed here, so an action whose
    // cost or GM involvement changes in config.mjs brings its stripe with it.
    const callsGm = callsGmFor(actor, def);
    // Four kinds and no fifth: a Sanity step takes the "stress" stripe both
    // stylesheets already carry, and a Hope step keeps whatever this tile would
    // have had - there is no `hope` stripe, and adding one means a new rule in
    // danganronpa.css AND in stained-glass.css for a colour a player meets once a
    // season (T-1).
    const ordinary = cost === 0 ? "free" : callsGm ? "gm" : "action";
    button.dataset.drpgCostKind = priced ? stripeKindFor(priced, ordinary) : ordinary;

    const costLabel = costLabelFor(actor, key, def);
    // Order matters: an Eclipse stops everything, so it is said first; not
    // being able to pay comes next; and "nothing here" is the one worth adding
    // even when something else already applies, because it is the only reason
    // that will still be true after the Eclipse ends.
    // The trial reason comes after the two that outrank it and before the
    // Eclipse's, so a trial running inside an Eclipse still says "the lights are
    // out" - that is the one the player can do something about.
    const lockReason = inIncident
        ? "DRPG.Murder.actionsLocked"
        : key === "directMurder"
            ? "DRPG.Eclipse.murderOnlyInEclipse"
            : inTrial && !eclipse
                ? "DRPG.Trial.actionsLocked"
                : "DRPG.Eclipse.actionsLocked";
    const note = locked
        ? `<br><em>${inIncident ? game.i18n.format(lockReason, { tile: crisisTileLabel(actor) }) : game.i18n.localize(lockReason)}</em>`
        : offTurn
            ? `<br><em>${game.i18n.localize("DRPG.Murder.offTurn")}</em>`
        : affordable
            ? ""
            // The chain's own sentence when there is one: "no action, no Hope and
            // no Sanity left" is a different refusal from "you have 0 of 1 action",
            // and it is the one that tells the player what to do about it.
            : `<br><em>${priced?.blocked
                ?? plural("DRPG.Action.cannotAfford",
                    { left: actionsLeft(actor), needed: cost }, "left")}</em>`;
    const why = blocked ? `<br><em>${foundry.utils.escapeHTML(blocked)}</em>` : "";
    // The light says "press this"; this says why it is free, because a discount
    // nobody can read is a discount nobody counts on (D3 + D12). Last, because
    // it is the only line here that is good news.
    const bonus = cleaningNow
        ? `<br><em>${freeTonightText()}</em>` : "";
    /*
     * THE TOOLTIP DOES NOT REPEAT THE COST (E3).
     *
     * `costLabel` is printed on the face of this very tile, three lines down,
     * and the stripe above says what kind of cost it is. Saying it a third time
     * in the hover made the tooltip two lines where one would do - on ten tiles
     * at once, which is how a player learns to stop reading them.
     *
     * What is left is the hint plus whatever is true right now and CANNOT be
     * read off the tile: why it is locked, why it cannot be paid for, why there
     * is nothing here to do it to, and why it is free tonight. Those appear one
     * at a time and only when they apply, so the ordinary hover is one line.
     */
    /*
     * KEPT IN TWO HALVES as well as composed, because `paintTamper` writes the
     * middle line a second later when the GM's ledger answers - see the note
     * there. Without these it cut off whatever the last line was.
     */
    // In a fight the definition's hint - "Open a direct murder" - is about another tile, and
    // off-turn the sentence is the whole of it.
    const hint = !fightTile ? def.hint ?? "" : offTurn ? "" : game.i18n.localize("DRPG.Murder.yourTurn");
    button.dataset.drpgTipHead = hint ? `${foundry.utils.escapeHTML(hint)}${note}` : note.replace(/^<br>/, "");
    button.dataset.drpgTipTail = bonus;
    button.dataset.tooltip = `${button.dataset.drpgTipHead}${why}${bonus}`;

    // Say what the stripe means, or the stripe means nothing.
    //
    // Four tiles read "1 action" and carry a grey stripe; five read "1 action"
    // and carry a red one. From the outside that is the same label with two
    // random colours. The difference is real - the grey ones hand the turn to
    // the GM - but it was only ever in the tooltip, and a colour whose key is
    // hidden is decoration.
    /*
     * ITS OWN LINE, UNDER THE COST (Dawid, 28.08).
     *
     * It used to sit inside the cost span, so the tile read "1 action GM" on
     * one line and the badge looked like part of the price rather than a fact
     * about who resolves it. Below the cost it reads as what it is: the cost,
     * and then who the tile hands the turn to.
     */
    const gmMark = callsGm
        ? `<span class="drpg-action-gm">${game.i18n.localize("DRPG.Action.waitsForGm")}</span>`
        : "";

    // No cost line in a fight: nothing is spent, and "Free" on the one live tile reads as a discount.
    button.innerHTML = `
        <i class="fa-solid ${def.icon ?? "fa-circle"} drpg-action-icon" inert></i>
        <span class="drpg-action-name">${softWrap(foundry.utils.escapeHTML(fightTile ? crisisTileLabel(actor) : def.label))}</span>${
        fightTile ? "" : `
        <span class="drpg-action-cost">${costLabel}</span>`}${gmMark}`;

    return key === "move" ? stillMoveTile(button, locked) : button;
}

/*
 * THE MOVE TILE OPENS NOTHING (E100 item 1, 12.11.2026; the owner on the player-screens review, #2: the Move window had
 * one button, Got it, and only said "drag your token"). The tile a Monocub's panel draws keeps its price and its
 * tooltip, and says on its face what to do (`DRPG.Move.dragShort`); it is a `div`, not a button, with no
 * `data-drpg-action`, so the delegate (`attachActionDelegate`) has nothing to press and the stylesheets' hover, which
 * reads `:not(.drpg-action-still)`, does not light it as if it could be pressed. R4100.
 */
export function stillMoveTile(button, locked = false) {
    const tile = document.createElement("div");
    tile.className = button.className;
    tile.classList.add("drpg-action-still");
    for (const [k, v] of Object.entries(button.dataset)) if (k !== "drpgAction") tile.dataset[k] = v;
    tile.dataset.drpgTile = "move";
    tile.innerHTML = button.innerHTML;
    // No "Drag your token" where the tile is locked: a Class Trial or an incident refuses the drag (the r112 review's P2).
    if (!locked) {
        const line = document.createElement("span");
        line.className = "drpg-action-cost";
        line.textContent = game.i18n.localize("DRPG.Move.dragShort");
        tile.append(line);
    }
    /* Reached by the keyboard (the r112 review's P4): a `div` takes no focus, and Foundry shows `data-tooltip` on focus, so
       the hint and a lock's reason were the mouse's alone. Its words as its label, for a screen reader. Exported for R4472. */
    tile.tabIndex = 0;
    tile.setAttribute("role", "note");
    tile.setAttribute("aria-label", [tile.textContent.replace(/\s+/g, " ").trim(), button.dataset.tooltip ?? ""].filter(Boolean).join(". "));
    return tile;
}

/**
 * Does this action hand the turn to the GM - for THIS character, right now?
 *
 * `callsGm` used to be a constant, and for some of the actions carrying it that
 * is still the truth. For the others it was a half-truth that showed on the tile
 * as a promise the action often did not keep - Analyze with three unidentified
 * bullets in the bag is a roll, Work on Project in a room with a project in it is
 * a roll, and Direct Murder waits for the GM only as a declaration: in a fight it
 * opens the crisis actions, and at Stage 6 outside an Eclipse it is the betrayal,
 * which the player decides (E32+E07 C16; config.mjs `murderParksForGm`).
 *
 * So the flag may also be a predicate, and both forms are read here, in the one
 * place both consumers can share: the cost stripe and the "waits for the GM"
 * mark on the tile. Anything that throws counts as false - see the note on the
 * predicates in config.mjs.
 */
function callsGmFor(actor, def) {
    const flag = def?.callsGm;
    if (typeof flag !== "function") return Boolean(flag);
    try {
        return Boolean(flag(actor));
    } catch {
        return false;
    }
}

/**
 * What this action would cost right now.
 *
 * Until E103 a Move tile (the Monocub's) read its price here too - free in an
 * Eclipse, else the free Move or an action. No tile draws the Move since
 * (the owner, 13.11.2026), so every tile's price is its definition's, a chain's
 * quote or Direct Murder's free cases.
 */
function costOf(actor, key, def) {
    /*
     * A PRICED ACTION IS QUOTED, NOT COUNTED (T-1).
     *
     * The killer's own night still skips the action step (D3) - but that is now
     * `tamperPriceSkip`, the same list `chargeTamper` reads (through `tamperQuote`,
     * which also knows a critical Finishing blow's free attempt), rather than a
     * separate `isCleaner` test in this file that had to be kept in step by hand.
     * What comes back is the step that will really pay, so a Tamper about to cost
     * a Sanity mark no longer reads "1 action".
     */
    if (PRICE_CHAINS[key]) {
        const quote = priceQuoteFor(actor, key);
        return quote.pay === "action" ? quote.amount : 0;
    }

    if (key === "directMurder" && directMurderIsFree(actor)) return 0;
    return def.cost ?? 1;
}

/**
 * Whether Direct Murder spends nothing for this character now (E32+E07 C16, 03.10.2026; audit
 * S02-33): in a fight it opens the crisis actions, which `takeCrisisAction` charges nothing
 * for, and at Stage 6 outside an Eclipse it is the betrayal, which `performBetrayal` charges
 * only in an Eclipse. The tile said "1 action" for both, and dimmed itself as unaffordable for
 * a killer with no action left at the one moment it was the only thing to press.
 */
function directMurderIsFree(actor) {
    if (murderState()?.stage === "incident" && sideOf(actor)) return true;
    return !isEclipse() && Boolean(betrayalTarget(actor));
}

/**
 * One quote per tile, per render, from the table the charge reads.
 *
 * The skip list is what expresses D3 - the killer's own clean-up pays no action
 * step - and it lives in cleanup.mjs beside the charge, so the tile and the
 * charge cannot disagree about the price the way they did on the E23 round.
 */
function priceQuoteFor(actor, key) {
    return key === "tamper" ? tamperQuote(actor) : quotePrice(actor, key);
}

/**
 * A tile's price in words: a chain's step that will pay, else a flat price.
 *
 * Until E103 the Monocub's Move tile showed its live state here, an Eclipse's
 * crossings left ("1 / 2 crossings", "any room"); the header's two feet say that
 * now (`freeMovePip`), and no tile draws the Move (the owner, 13.11.2026).
 */
function costLabelFor(actor, key, def) {
    // The step that will pay, in words: "1 action", "1 Hope", "1 Sanity" (T-1).
    if (PRICE_CHAINS[key]) {
        const quote = priceQuoteFor(actor, key);
        return quote.blocked
            ? game.i18n.localize("DRPG.Action.costFree")
            : priceLabel(quote);
    }

    const cost = costOf(actor, key, def);
    return cost === 0
        ? game.i18n.localize("DRPG.Action.costFree")
        : plural("DRPG.Action.costActions", { n: cost });
}
