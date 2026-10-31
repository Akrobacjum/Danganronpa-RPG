/**
 * Danganronpa RPG - what one student may see of another.
 * ---------------------------------------------------------------------------
 * THE GUIDE SAYS SHEETS ARE PRIVATE, AND THIS FILE USED TO ENFORCE THAT:
 * "Character sheets are anonymous during play - other players have no access to
 * someone else's sheet." Ownership was pinned at NONE and any sheet that reached
 * a non-owner was closed on sight.
 *
 * Since E9 it is a REDACTION rather than a refusal (Dawid, 27.08 - recorded as
 * G-44). Some of what a sheet holds is not secret in the fiction at all: you can
 * see that somebody is hurt, and you can see what they are holding. Making the
 * interface hide those was making players ask for information the room already
 * gives them.
 *
 * SO THE SHEET KEEPS ITS SHAPE (Dawid, 27.08, second pass). The first attempt
 * used Daggerheart's own `limited` part, which is safe - the other parts are
 * never built at all - and wrong to look at: no tabs, no traits, no anything,
 * just a card. A sheet that has been emptied tells you nothing about the person;
 * a sheet that has been CENSORED tells you there is a person there. So the whole
 * sheet renders, and this file takes things out of it:
 *
 *     shown        name, portrait, Ultimate, Health, Sanity, what is in their
 *                  hands, and how many Experiences they have
 *     "?"          every trait value, every Action pip, every Hope pip (in the
 *                  Hope gold, because a redacted Hope is still Hope)
 *     "???" / "+?" each Experience - that they have one, and that it is worth
 *                  something, without saying what or how much
 *     greyed       every tab, unclickable, and its contents removed from the
 *                  page rather than merely hidden
 *
 * THE PANES ARE EMPTIED, NOT HIDDEN, and that is the one place this file works
 * harder than it looks. A greyed-out tab whose inventory is still sitting in the
 * DOM is a curtain drawn over an open window: `display: none` is one devtools
 * click from undone. The tab STAYS so the sheet still reads as a sheet; what was
 * inside it goes.
 *
 * FAIL CLOSED. Everything below runs inside one try/catch, and the catch CLOSES
 * THE SHEET. This is the trade the second pass made: the old design could not
 * leak because nothing was rendered, and this one can if the redaction does not
 * finish. So a redaction that throws must not leave a readable sheet on screen.
 *
 * AND IT IS STILL A CURTAIN, NOT A WALL. Foundry sends every world document to
 * every client, so a player with a console can read anything here regardless.
 * That was equally true of the old closed sheet. It means one thing, worth
 * writing down: nothing may sit behind this whose leak would spoil the game.
 */

import { MODULE_ID } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { isDeadForGm, isDeceased } from "./chapter.mjs";
import { isStashed } from "./inventory.mjs";
import { isTruthBullet } from "./truth-bullets.mjs";
import { whisperToGms, gmReport, isPrimaryGm, debug, error, plural } from "./utils.mjs";

const NONE = 0;     // CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE
const OBSERVER = 2; // …OBSERVER - enough to render the sheet, never to edit it.

export function registerAnonymity() {
    Hooks.on("preCreateActor", onPreCreateActor);
    Hooks.on("preUpdateActor", onPreUpdateActor);
    // AFTER THE FACT, TOO (E03; audit S11-04) - see `lowerOwnership`.
    Hooks.on("updateActor", actor => { lowerOwnership(actor); });
    // On the client whose window it was - which may be a GM who is not the
    // primary one, and the only client this hook fires on at all.
    Hooks.on("closeDocumentOwnershipConfig", app => {
        const doc = app?.document;
        if (doc?.documentName === "Actor") setTimeout(() => lowerOwnership(doc, { closedHere: true }), 500);
    });
    Hooks.once("ready", () => {
        for (const actor of game.actors ?? []) lowerOwnership(actor);
    });
    // ONE hook only. ApplicationV2 fires a render hook for every class in the
    // inheritance chain, so listening to both the concrete sheet and its base
    // class ran this twice and produced two identical errors.
    Hooks.on("renderActorSheetV2", onRenderSheet);
    // An open body's loot window reads the gate again when the taker or the body moves, or the clock does (fix e1-G6).
    Hooks.on("updateToken", token => {
        const id = token?.actorId ?? token?.actor?.id;
        if (id && document.querySelector(`.drpg-loot-list[data-drpg-taker="${CSS.escape(id)}"], .drpg-loot-list[data-drpg-body="${CSS.escape(id)}"]`)) regreyOpenLoot();
    });
    Hooks.on("updateSetting", setting => { if (setting?.key === `${MODULE_ID}.${SETTINGS.clock}`) regreyOpenLoot(); });
}

/**
 * Somebody else's sheet: everything is there, and almost nothing is readable.
 *
 * Fails CLOSED - see the header. If any step throws, the sheet is shut rather
 * than left half-redacted.
 */
function onRenderSheet(app, element) {
    const root = element instanceof HTMLElement ? element : element?.[0];

    try {
        if (!enforcing()) return;
        const actor = app?.document;
        if (!actor || actor.type !== "character") return;

        // Nobody may open the settings sheet, their own included (Dawid,
        // 27.08). It is Daggerheart's configuration for the character, and it
        // is the GM's business - a player who opens it is looking at knobs no
        // rule in this game lets them turn.
        if (!game.user.isGM) lockSettings(root);

        if (game.user.isGM || actor.testUserPermission(game.user, "OWNER")) return;
        if (!root) return;

        disarmSheet(root);
        redactTabs(root);
        redactValues(root);
        // The greying of a refused Take lands a moment after the draw (`greyRefused`): a sheet it finds gone is left be.
        buildBodyLoot(root, actor)?.catch?.(err => error("Could not read whether the body's Take is open", err));
        root.classList.add("drpg-redacted-sheet");
    } catch (err) {
        error("Could not redact a character sheet - closing it instead", err);
        try {
            if (root) root.style.display = "none";
            app?.close?.({ force: true, animate: false })?.catch?.(() => {});
        } catch {
            // Nothing left to try. The error above is the record.
        }
    }
}

/**
 * Nothing on this sheet does anything, and the list of what may is short.
 *
 * AN ALLOW-LIST, NOT A HUNT. Stripping the controls one at a time is how you
 * ship a leak: the sheet was rolling somebody else's traits from `div.trait`
 * (Dawid found it), and beside it sat `toggleHope` on the Hope pips,
 * `toggleResourceManagement`, `useItem` on the portrait and `editImage` - every
 * one a thing a viewer could do to a character that is not theirs. A system
 * update adds another next month and a blacklist would not know.
 *
 * So everything with a `data-action` is disarmed except what lives in the
 * window frame, which is Foundry's own furniture: close the window, copy the
 * uuid, toggle the frame controls. Those belong to the viewer, not to the
 * character.
 *
 * `data-action` is REMOVED as well as the click swallowed, because
 * ApplicationV2 dispatches on the attribute - a listener alone is one missed
 * event from a roll nobody meant to make. Marked `drpg-disarmed` rather than
 * `drpg-locked`: the greyed look belongs to the tabs and the settings button,
 * which are meant to be seen as shut; greying every element on the sheet would
 * grey the sheet.
 */
function disarmSheet(root) {
    for (const el of root.querySelectorAll("[data-action]")) {
        if (el.closest(".window-header")) continue;
        delete el.dataset.action;
        el.classList.add("drpg-disarmed");
        el.addEventListener("click", stop, { capture: true });
    }
}

/**
 * The tabs stay, greyed, and their contents go.
 *
 * Greyed rather than removed (Dawid, 27.08): a sheet with no tabs says nothing
 * about the person, while a sheet whose tabs are shut says there is something
 * behind them. `data-action` is stripped as well as the click being swallowed,
 * because ApplicationV2 dispatches on that attribute - leaving it and relying on
 * the listener alone would mean one missed event is one opened tab.
 *
 * EMPTIED, NOT HIDDEN. A pane left in the page with `display: none` is a
 * devtools click from being read; there is no version of this where the
 * inventory may stay in the DOM.
 */
function redactTabs(root) {
    // BY `data-tab`, NOT BY `data-action`. `disarmSheet` runs first and has
    // already taken the action off every one of them, so selecting on the
    // action found nothing and the tabs came out disarmed but not greyed -
    // which is the worst of both, because an ungreyed tab invites the click it
    // will not honour. Shipped that way in 1.1.22 and caught by looking.
    for (const tab of root.querySelectorAll("a[data-tab]")) {
        delete tab.dataset.action;
        tab.classList.add("drpg-locked");
        tab.setAttribute("aria-disabled", "true");
        tab.dataset.tooltip = game.i18n.localize("DRPG.Redacted.tabLocked");
        tab.addEventListener("click", stop, { capture: true });
    }

    for (const pane of root.querySelectorAll("section.tab[data-tab]")) {
        pane.replaceChildren(lockedPlaceholder());
        pane.classList.add("drpg-redacted-pane");
    }
}

/**
 * A body's pockets are the one thing on a redacted sheet you may look through.
 *
 * THE THIRD STATE (trap 138). Your own sheet, somebody else's, and somebody
 * else's corpse are three things, not two - and the corpse differs in two ways
 * at once: its belongings are visible AND takeable, while its Truth Bullets do
 * not exist at all, having died with it.
 *
 * So the Inventory tab is given back - just that one - and filled with a list
 * this file builds rather than the sheet's own. Not because the sheet's list
 * would be wrong, but because it holds the Truth Bullet rows, the stash, the
 * use buttons and the handover buttons, none of which belong to somebody
 * standing over a body.
 *
 * A TAKE THE GATE REFUSES IS GREYED, WITH ITS REASON (E14 part 1 C1; audit S11-06). The Take showed on every row of a
 * body this browser knows dead, wherever the viewer's character stood: from a bedroom across the school, in a Class
 * Trial, as a dead spectator. Each row's Take now asks the one gate the GMs judge the loot by (inventory.mjs
 * `transferRefusal`, mode "loot"), read on this browser, and one it refuses is shut with the sentence the player would
 * be told (`DRPG.Bridge.why.<code>`). A display: the GMs' gate judges the request again.
 *
 * READ AGAIN AS THE TABLE MOVES (E14 fix e1-G6, 24.10.2026; the review's E14R-07, goal): the greying was read once, when
 * the sheet was drawn, so a viewer who walked into the body's room with the sheet open found every Take still shut "not
 * where it needs to be" (and one who walked out, or whose Class Trial began, found them open) until the sheet was
 * opened again, which nothing told them to do. The list carries the body and the taker (`data-drpg-body`,
 * `data-drpg-taker`), and `regreyOpenLoot` reads the gate again for every list on the page when either one's token is
 * written or the clock is (registerAnonymity's hooks), opening a Take it no longer refuses. A Take already pressed stays
 * shut. `taker` is the viewer's character (`myCharacter`); a test hands its own. Answers the greying's promise, or
 * undefined where there is no Take.
 */
export function buildBodyLoot(root, actor, taker = myCharacter()) {
    // A body this browser knows of (E05 C10, the owner's Q2): the table's, or one nobody has
    // found that this player was in the incident of - the GMs judge the taking again.
    if (!isDeadForGm(actor)) return;

    const pane = root.querySelector('section.tab[data-tab="inventory"]');
    const tab = root.querySelector('a[data-tab="inventory"]');
    if (!pane || !tab) return;

    reopenTab(tab);
    pane.classList.remove("drpg-redacted-pane");

    const box = document.createElement("div");
    box.className = "drpg-loot";

    const items = actor.items.filter(i =>
        i.getFlag(MODULE_ID, "category") && !isTruthBullet(i) && !isStashed(i));

    box.innerHTML = `<h4>${game.i18n.localize("DRPG.Loot.heading")}</h4>`;
    if (!items.length) {
        box.innerHTML += `<p class="notes">${game.i18n.localize("DRPG.Loot.empty")}</p>`;
        pane.replaceChildren(box);
        return;
    }

    const list = document.createElement("ul");
    list.className = "drpg-loot-list";
    list.dataset.drpgBody = actor.id;
    if (taker) list.dataset.drpgTaker = taker.id;
    for (const item of items) {
        const row = document.createElement("li");
        row.innerHTML = `<img src="${foundry.utils.escapeHTML(item.img ?? "")}" alt="" />
            <span class="drpg-item-name">${foundry.utils.escapeHTML(item.name)}</span>`;

        const take = document.createElement("button");
        take.type = "button";
        take.className = "drpg-mini-button drpg-loot-take";
        take.textContent = game.i18n.localize("DRPG.Loot.take");
        take.dataset.tooltip = game.i18n.localize("DRPG.Loot.takeTooltip");
        take.addEventListener("click", async event => {
            event.preventDefault();
            event.stopPropagation();
            // Disabled on the way in, not on the way back: the round trip goes
            // through the GM's client and a second click would take the same
            // object twice.
            take.disabled = true;
            take.dataset.drpgTaken = "true";
            if (await takeFromBody(actor, item)) return;
            /* NOTHING TAKEN, SO THE TAKE IS OPEN AGAIN (E50 C4; audit S11-36). Until C4 a Take the primary refused (the
               taker gone from the room, the body looted by somebody else meanwhile), one no GM answered and one with no
               character stayed shut, marked as pressed, until the sheet was drawn again, and the gate's re-reading
               passed it by. Now it is the gate's again: open, then shut with the reason's sentence where the gate still
               refuses it here. A Take that took stays shut. */
            delete take.dataset.drpgTaken;
            take.disabled = false;
            take.removeAttribute("aria-disabled");
            if (taker) await greyRefused(list, actor, taker);
        });
        row.append(take);
        list.append(row);
    }

    box.append(list);
    pane.replaceChildren(box);
    return taker ? greyRefused(list, actor, taker) : undefined;
}

/**
 * Shut every Take in `list` the one gate refuses `taker` off `body` now, with the reason's sentence, and open again one
 * it no longer refuses (`buildBodyLoot`, `regreyOpenLoot`); a Take already pressed stays shut.
 */
async function greyRefused(list, body, taker) {
    const { transferRefusal } = await import("./inventory.mjs");
    const why = await transferRefusal(body, taker, { mode: "loot", asker: game.user });
    const { reasonOf } = await import("./bridge-guards.mjs");
    const said = why ? game.i18n.localize(`DRPG.Bridge.why.${reasonOf(why)}`) : game.i18n.localize("DRPG.Loot.takeTooltip");
    for (const take of list.querySelectorAll(".drpg-loot-take")) {
        if (take.dataset.drpgTaken) continue;
        take.disabled = Boolean(why);
        if (why) take.setAttribute("aria-disabled", "true");
        else take.removeAttribute("aria-disabled");
        take.dataset.tooltip = said;
    }
}

/** Every body's loot window on this page, its Takes read against the one gate again (fix e1-G6; `buildBodyLoot`). */
function regreyOpenLoot() {
    for (const list of document.querySelectorAll(".drpg-loot-list[data-drpg-taker]")) {
        const body = game.actors.get(list.dataset.drpgBody ?? ""), taker = game.actors.get(list.dataset.drpgTaker ?? "");
        if (!body || !taker) continue;
        greyRefused(list, body, taker).catch(err => error("Could not read again whether the body's Take is open", err));
    }
}

/**
 * Whose character is doing the taking.
 *
 * The one the viewer plays, which is nearly always exactly one - and if it is
 * somehow none, the button says so rather than sending a request the GM will
 * refuse.
 *
 * Answers whether something was taken (E50 C4): true only on the GM's answer that took it, so the Take opens again
 * on a refusal, on no GM answering and with no character (`buildBodyLoot`).
 */
async function takeFromBody(body, item) {
    const taker = myCharacter();
    if (!taker) {
        ui.notifications.warn(game.i18n.localize("DRPG.Loot.noCharacter"));
        return false;
    }

    const { requestBodyLoot } = await import("./gm-bridge.mjs");
    const res = await requestBodyLoot({ takerId: taker.id, bodyId: body.id, itemId: item.id });
    // Only what the GM has: a refusal has been said, and "you took it" beside it would be two answers.
    // Off a body nobody has found, the Truth Bullet waits for the death to be known (E05 fix r2-F0b).
    const took = Boolean(res.ok && !res.value?.refused);
    if (res.ok && !res.value?.refused) ui.notifications.info(game.i18n.format(isDeceased(body) ? "DRPG.Loot.took" : "DRPG.Loot.tookUnfound", { item: item.name }));
    return took;
}

/**
 * The character this viewer is playing.
 *
 * By OWNERSHIP first, then by `game.user.character` - the order hud.mjs settled
 * on and for the reason written out there: nothing in this game asks anybody to
 * set the actor in Foundry's user configuration, so a table that assigns
 * characters the module's own way leaves it null for every player.
 */
function myCharacter() {
    const owned = game.actors.filter(a =>
        a.type === "character" && a.testUserPermission(game.user, "OWNER"));
    if (owned.length === 1) return owned[0];
    // Two characters, or none owned: the one they picked, if they picked one.
    return game.user.character ?? owned[0] ?? null;
}

/** Give one tab back what `disarmSheet` and `redactTabs` took off it. */
function reopenTab(tab) {
    tab.dataset.action = "tab";
    tab.classList.remove("drpg-locked", "drpg-disarmed");
    tab.removeAttribute("aria-disabled");
    delete tab.dataset.tooltip;
    tab.removeEventListener("click", stop, { capture: true });
}

/** One pixel question mark, so an emptied pane does not read as a broken one. */
function lockedPlaceholder() {
    const box = document.createElement("div");
    box.className = "drpg-redacted-empty";
    box.innerHTML = `<i aria-hidden="true"></i><span>${
        game.i18n.localize("DRPG.Redacted.tabLocked")}</span>`;
    return box;
}

/**
 * Numbers become question marks; names become nothing at all.
 *
 * WHAT SURVIVES IS THE POINT. Health and Sanity keep their figures and the
 * Equipped panel keeps its item, because those are the things the fiction shows
 * anyone in the room. Everything with a number attached to it - traits, Actions,
 * Hope - becomes a question mark, and an Experience keeps its ROW while losing
 * both its name and its size: you can see that they have two of them and that
 * both are worth something, which is exactly what watching somebody work would
 * tell you.
 */
function redactValues(root) {
    // A question mark that still carries its tooltip is not a question mark (S03-06, E05
    // C15, 27.09.2026): "1 of 2 actions this time of day" and "Free Move used" were a
    // hover away on every pip this made "?". The label a screen reader reads goes with it.
    const mark = (el, text, cls) => {
        el.textContent = text;
        el.classList.add("drpg-redacted-value");
        if (cls) el.classList.add(cls);
        el.removeAttribute("data-tooltip");
        el.removeAttribute("aria-label");
    };

    for (const value of root.querySelectorAll(".trait-value")) mark(value, "?");
    for (const pip of root.querySelectorAll(".drpg-action-pip")) {
        pip.classList.remove("filled");
        mark(pip, "?");
    }
    // Hope keeps its colour. A hidden Hope is still Hope, and the gold is how
    // this module says so everywhere else.
    for (const pip of root.querySelectorAll(".hope-value")) mark(pip, "?", "drpg-redacted-hope");

    // The free Move is a drawn mark rather than a number, so it is replaced
    // rather than overwritten: whether somebody still has their step is as much
    // of a tell as how many actions they have left.
    for (const move of root.querySelectorAll(".drpg-free-move")) {
        move.classList.remove("available");
        mark(move, "?");
    }

    for (const row of root.querySelectorAll(".experience-row")) {
        const value = row.querySelector(".experience-value");
        const name = row.querySelector(".experience-name");
        if (value) mark(value, "+?");
        if (name) mark(name, "???");
        // The little "send to chat" control belongs to whoever owns it.
        row.querySelector(".controls")?.remove();
        row.removeAttribute("data-tooltip-text");
    }

    // The Calls armed on the owner's next roll and what is standing on them: whispered
    // to the owner and the GM everywhere else. sheet.mjs draws none for a viewer
    // (`viewerOf`); removed here as well, so a stack drawn by anything else goes too -
    // EMPTIED, NOT HIDDEN, as the tabs are.
    for (const badge of root.querySelectorAll(".drpg-pending-call")) badge.remove();
    for (const stack of root.querySelectorAll(".drpg-pending-stack")) stack.remove();
}

/**
 * The settings sheet is nobody's but the GM's.
 *
 * Left in place and greyed for the same reason the tabs are: a button that
 * disappears teaches nothing about who it belongs to.
 */
function lockSettings(root) {
    for (const button of root?.querySelectorAll('[data-action="openSettings"]') ?? []) {
        delete button.dataset.action;
        button.classList.add("drpg-locked");
        button.setAttribute("aria-disabled", "true");
        button.dataset.tooltip = game.i18n.localize("DRPG.Redacted.settingsLocked");
        button.addEventListener("click", stop, { capture: true });
    }
}

function stop(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
}

function enforcing() {
    try {
        return game.settings.get(MODULE_ID, SETTINGS.enforceAnonymity);
    } catch {
        return false;
    }
}

/**
 * New characters open at OBSERVER.
 *
 * Which is the level that renders the sheet in full and still refuses every
 * edit - `isEditable` is false below OWNER, so every field arrives disabled
 * without this file touching one. NONE would leave a window nobody can open and
 * a redaction with nothing to redact.
 */
function onPreCreateActor(actor, data) {
    if (actor.type !== "character" || !enforcing()) return;
    if ((data.ownership?.default ?? NONE) === OBSERVER) return;

    actor.updateSource({ "ownership.default": OBSERVER });
    debug(`Set default ownership to OBSERVER on new character "${data.name}".`);
}

/**
 * Stop anyone handing a student to the whole table as OWNER.
 *
 * OBSERVER is the ceiling because it is exactly enough: the sheet opens, the
 * redaction below runs, and nothing can be changed. OWNER by default would give
 * every player the run of somebody else's character - and it would skip the
 * redaction entirely, since that only runs for a viewer who is not the owner.
 *
 * Lowering is not blocked. A GM sealing one character shut is making a ruling,
 * and all they lose is a window.
 */
function onPreUpdateActor(actor, changes) {
    if (actor.type !== "character" || !enforcing()) return;

    const next = changes.ownership?.default;
    if (next === undefined || next <= OBSERVER) return;

    delete changes.ownership.default;
    if (!Object.keys(changes.ownership).length) delete changes.ownership;

    ui.notifications.warn(game.i18n.format("DRPG.Anonymity.blocked", { actor: actor.name }));
    debug(`Blocked a default-ownership raise on "${actor.name}" - OBSERVER is the ceiling.`);
}

/**
 * The same ceiling, put back after the write (E03, 24.09.2026; audit S11-04).
 *
 * The guard above never saw the one window a GM actually uses for this:
 * Configure Ownership saves with `noHook: true`, which skips every `pre`
 * hook, so "All Players: Owner" went through and handed the whole table an
 * unredacted sheet, Truth Bullets and all. Whether `noHook` also silences the
 * `updateActor` hook for that save has not been read off a live v14 table
 * (AUDIT §9), so three roads lead here: that hook on the primary GM, the
 * ownership window closing on the GM who used it, and a sweep at `ready`. The
 * harness takes the pessimistic reading - `noHook` silences both - so what it
 * proves is the window road, on a table with one GM, who is also the primary:
 * a GM who is not the primary closing the window is not measured. The GM
 * lowers it back to OBSERVER and says so.
 * Characters only, and only while anonymity is enforced; lowering is never
 * undone.
 */
async function lowerOwnership(actor, { closedHere = false } = {}) {
    try {
        // Both writers are a GM: any GM for the window it closed itself, the primary for the
        // rest. Said first as the gate R220's census reads (E33 C1a, 06.10.2026); the same
        // test it was, which a player's browser never passed.
        if (!game.user?.isGM) return;
        const writer = closedHere || isPrimaryGm();
        if (!writer || !actor || actor.type !== "character" || !enforcing()) return;
        if ((actor.ownership?.default ?? NONE) <= OBSERVER) return;
        // Two roads can arrive on one client before the first write has come
        // back (the hook and the window closing): one lowers, one says so.
        if (lowering.has(actor.id)) return;
        lowering.add(actor.id);
        try {
            const updated = await actor.update({ "ownership.default": OBSERVER });
            if (!updated) return;   // somebody else's write got there first
            await whisperToGms(`<p class="drpg-warning">${game.i18n.format("DRPG.Anonymity.reverted", {
                actor: foundry.utils.escapeHTML(actor.name)
            })}</p>`);
            debug(`Lowered the default ownership of "${actor.name}" back to OBSERVER.`);
        } finally {
            lowering.delete(actor.id);
        }
    } catch (err) {
        error(`Could not lower the default ownership of "${actor?.name}"`, err);
    }
}

/** Actors this client is lowering right now. */
const lowering = new Set();

/* ==========================================================================
 * AUDIT
 * ========================================================================== */

/**
 * Everyone who can open this actor's sheet, with enough detail to explain why.
 *
 * Note: `User#isGM` is true for Assistant GMs as well as full GMs. An Assistant
 * playing a student would be invisible to a naive "not a GM" filter *and* able
 * to read every other sheet, so assistants are reported separately rather than
 * quietly skipped.
 */
export function explainOwnership(actor) {
    const roles = CONST.USER_ROLES;
    const entries = [];

    for (const user of game.users) {
        const level = actor.getUserLevel(user);
        if (level === null || level <= NONE) continue;

        entries.push({
            user,
            level,
            levelName: Object.entries(CONST.DOCUMENT_OWNERSHIP_LEVELS).find(([, v]) => v === level)?.[0] ?? String(level),
            isFullGm: user.role === roles.GAMEMASTER,
            isAssistant: user.role === roles.ASSISTANT,
            isPlayer: user.role < roles.ASSISTANT
        });
    }

    return {
        actor,
        defaultLevel: actor.ownership?.default ?? NONE,
        entries,
        playerOwners: entries.filter(e => e.isPlayer && e.level >= 3),
        assistantOwners: entries.filter(e => e.isAssistant && e.level >= 3)
    };
}

/**
 * Inspect every character and report anything that leaks. Returns the findings
 * and, unless told otherwise, whispers a report to the GM who asked (`gmReport`, E06 C11).
 *
 * ONLY ABOVE OBSERVER IS A FIX (E20 C2, 29.10.2026; audit S11-19, the owner's Q-6). Until then every
 * character above None was listed "Visible to all players - fix these", and Observer is the level this
 * module sets on purpose (`onPreCreateActor`, the 1.1.21 migration): it renders the sheet so the
 * redaction can run. A GM was told to undo the module's own work, in Foundry's API names ("default is
 * OBSERVER"). Now "fix these" is the sheets every player owns, which the redaction never touches, with
 * a Set them to Observer the on-screen copy carries (`wireAnonymityFix`); a sheet closed to the other
 * players is an info line, since nobody can open it to loot the body; the levels are words.
 * `actors` is every character unless handed in (R1506 hands its own).
 *
 * WITH THE SWITCH OFF (E20 fix round, the goal review's G-3). Observer hides the secrets only while "Keep character
 * sheets anonymous" is on: off, the redaction never runs and every player reads an Observer sheet whole. The audit then
 * lists the Observer sheets (`unredacted`) under a line naming the switch, and its words, here and in Set them to
 * Observer's notice, no longer say "its secrets hidden". `enforced` is the switch unless handed in (R1534).
 */
export async function auditAnonymity({ toChat = true, actors = game.actors, enforced = enforcing() } = {}) {
    const exposed = [];
    const closed = [];
    const shared = [];
    const orphaned = [];
    const assistants = [];
    const unredacted = [];
    const on = enforced === true;

    for (const actor of actors ?? []) {
        if (actor.type !== "character") continue;

        const info = explainOwnership(actor);

        if (info.defaultLevel > OBSERVER) exposed.push(info);
        else if (info.defaultLevel < OBSERVER) closed.push(info);
        else if (!on) unredacted.push(info);
        if (info.assistantOwners.length) assistants.push(info);
        if (info.playerOwners.length > 1) shared.push(info);
        if (info.playerOwners.length === 0 && info.assistantOwners.length === 0) orphaned.push(info);
    }

    const findings = { exposed, closed, shared, orphaned, assistants, unredacted };

    const sections = [];

    if (exposed.length) {
        sections.push(section("DRPG.Anonymity.audit.exposed", exposed.map(i =>
            `${escape(i.actor.name)} - ${escape(levelWords(i.defaultLevel, "everyone", on))}`
        )));
        // A button only where somebody can press it: a whispered copy is a chat card nothing wires.
        if (!toChat) {
            sections.push(`<p><button type="button" data-drpg-anon-fix>${escape(game.i18n.localize("DRPG.Anonymity.audit.fix"))}</button></p>`);
        }
    }

    if (unredacted.length) {
        sections.push(section("DRPG.Anonymity.audit.switchOff", unredacted.map(i =>
            `${escape(i.actor.name)} - ${escape(levelWords(i.defaultLevel, "everyone", on))}`
        )));
    }

    if (assistants.length) {
        sections.push(section("DRPG.Anonymity.audit.assistants", assistants.map(i =>
            `${escape(i.actor.name)} - ${i.assistantOwners.map(e => escape(e.user.name)).join(", ")}`
        )));
    }

    if (shared.length) {
        sections.push(section("DRPG.Anonymity.audit.shared", shared.map(i =>
            `${escape(i.actor.name)} - ${i.playerOwners.map(e => escape(e.user.name)).join(", ")}`
        )));
    }

    if (orphaned.length) {
        sections.push(section("DRPG.Anonymity.audit.orphaned", orphaned.map(i => {
            // Say who *does* have access, so "no owner" is never a mystery.
            const others = i.entries.length
                ? i.entries.map(e => `${escape(e.user.name)}: ${escape(levelWords(e.level, "level", on))}${e.isFullGm
                    ? ` ${escape(game.i18n.localize("DRPG.Anonymity.role.gm"))}`
                    : e.isAssistant ? ` ${escape(game.i18n.localize("DRPG.Anonymity.role.assistant"))}` : ""}`).join(", ")
                : game.i18n.localize("DRPG.Anonymity.audit.nobody");
            return `${escape(i.actor.name)} - ${others}`;
        })));
    }

    // Nothing to fix still says so when the only lines are the closed sheets' note below it.
    const body = `${sections.length ? sections.join("") : `<p>✓ ${escape(game.i18n.localize("DRPG.Anonymity.audit.clean"))}</p>`}${
        closed.length ? section("DRPG.Anonymity.audit.closed", closed.map(i =>
            `${escape(i.actor.name)} - ${escape(levelWords(i.defaultLevel, "everyone", on))}`)) : ""}`;

    // The rendered body travels back with the findings, so a caller that puts
    // the answer on screen itself gets the same prose the whisper would have
    // carried instead of reassembling it worse.
    findings.body = body;

    if (!toChat) return findings;

    await gmReport(game.i18n.localize("DRPG.Anonymity.audit.title"), body);
    return findings;
}

/**
 * Set them to Observer: the sheets every player owns, back to the level the redaction runs at (E20 C2,
 * S11-19). A GM's own write, as `lowerOwnership`'s is; lowering is never refused (`onPreUpdateActor`).
 * Answers how many it set. `actors` is every character unless handed in (R1506).
 */
export async function fixExposed(actors = game.actors) {
    if (!game.user?.isGM) return 0;
    let set = 0;
    for (const actor of actors ?? []) {
        if (actor.type !== "character" || (actor.ownership?.default ?? NONE) <= OBSERVER) continue;
        try {
            await actor.update({ "ownership.default": OBSERVER });
            set++;
        } catch (err) {
            error(`Could not set "${actor.name}" back to Observer`, err);
        }
    }
    if (set) debug(`Set ${set} character(s) back to OBSERVER from the anonymity audit.`);
    return set;
}

/**
 * The on-screen audit's Set them to Observer (Pre-season checks): fix, say how many, and draw the audit
 * again in place. Answers `{ done() }`, the last press's promise, for a caller that waits on it (R1506,
 * E20-T1). `root` holds the audit's body, as `auditAnonymity({ toChat: false })` drew it. With the switch off
 * (`enforced`, the world's unless handed in; E20 fix round, G-3) the notice does not promise hidden secrets.
 */
export function wireAnonymityFix(root, { actors = game.actors, enforced = enforcing() } = {}) {
    let last = Promise.resolve();
    root?.addEventListener("click", ev => {
        const button = ev.target?.closest?.("[data-drpg-anon-fix]");
        if (!button) return;
        ev.preventDefault();
        button.disabled = true;
        last = (async () => {
            const n = await fixExposed(actors);
            ui.notifications?.info(plural(enforced === true ? "DRPG.Anonymity.audit.fixed" : "DRPG.Anonymity.audit.fixedOpen", { n }));
            const again = await auditAnonymity({ toChat: false, actors, enforced });
            root.innerHTML = again.body ?? "";
        })().catch(err => error("Could not set the sheets back to Observer", err));
    });
    return { done: () => last };
}

/**
 * An ownership level in words (E20 C2, S11-19): `everyone` for the default, what every player gets;
 * `level` for one user's. Foundry's own names (OBSERVER, ...) were what the audit printed until then.
 * Observer with "Keep character sheets anonymous" off (`enforced` false; E20 fix round, G-3) is the open
 * words (`observerOpen`): no redaction runs, so no secret is hidden.
 */
function levelWords(level, kind, enforced = true) {
    const L = CONST.DOCUMENT_OWNERSHIP_LEVELS;
    const name = level >= L.OWNER ? "owner" : level >= L.OBSERVER ? (enforced ? "observer" : "observerOpen") : level >= L.LIMITED ? "limited" : "none";
    return game.i18n.localize(`DRPG.Anonymity.${kind}.${name}`);
}

function section(labelKey, lines) {
    const items = lines.map(l => `<li>${l}</li>`).join("");
    return `<p><strong>${game.i18n.localize(labelKey)}</strong></p><ul>${items}</ul>`;
}

function escape(text) {
    return foundry.utils.escapeHTML(String(text ?? ""));
}
