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
 *     shown        name, portrait, Ultimate, Health, what is in their hands,
 *                  and how many Experiences they have
 *     "?"          every trait value, every Action pip, every Hope pip (in the
 *                  Hope gold, because a redacted Hope is still Hope), and
 *                  Sanity (E24 C1a: the owner's 28.10 - another player does not
 *                  read a student's Sanity; its block stays, emptied)
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

import { MODULE_ID, FLAGS, LOOT } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { isDeadForGm, isDeceased, BODY_ANNOUNCED_HOOK } from "./chapter.mjs";
import { isStashed } from "./inventory.mjs";
import { isTruthBullet } from "./truth-bullets.mjs";
import { whisperToGms, gmReport, isPrimaryGm, activeGmIds, debug, error, plural, esc } from "./utils.mjs";
import { sheetMode } from "./sheet.mjs";

import { tipAttr, setTip } from "./ui-kit.mjs";
import { choiceRowHtml } from "./ui-columns.mjs";

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
    /* AND WHEN A BODY IS ANNOUNCED (E68 C10; audit D006, E14p1/STATUS.md:96): the gate reads whether the taker knows of
       the death, and an open list kept the Takes it drew before the announcement until the sheet was drawn again. */
    Hooks.on(BODY_ANNOUNCED_HOOK, () => { if (document.querySelector(".drpg-loot-list[data-drpg-taker]")) regreyOpenLoot(); });
    /* AND WHEN THE BODY'S TILE IS LAID, HIDDEN, MOVED OR DELETED (E95 C3, 10.11.2026; STATUS E95 Open 2). From E95 C1
       the gate reads a body where its tile lies (body-tile.mjs `bodyPlaceOf`), and a GM's write on the tile moved the
       gate with no token written, so an open window kept a Take the gate now refused, or shut one it now allowed, until
       the sheet was drawn again. A tile that carries a body's flag, or whose write touched the module's flags (a flag
       taken off), reads the gate again for the open lists of that body, or of every body when the flag is gone. */
    const onBodyTile = (tile, changes) => {
        const id = tile?.getFlag?.(MODULE_ID, FLAGS.bodyOf)?.actorId ?? null;
        if (!id && !changes?.flags?.[MODULE_ID]) return;
        const lists = id ? `.drpg-loot-list[data-drpg-body="${CSS.escape(id)}"]` : ".drpg-loot-list[data-drpg-body]";
        if (document.querySelector(lists)) regreyOpenLoot();
    };
    Hooks.on("createTile", tile => onBodyTile(tile));
    Hooks.on("updateTile", (tile, changes) => onBodyTile(tile, changes));
    Hooks.on("deleteTile", tile => onBodyTile(tile));
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
        // Who is looking, from the sheet's one mode (E45 C1): a GM, the owner, or a viewer whose sheet is redacted.
        // A throw in it is a throw here, and closes the sheet as any other.
        const mode = sheetMode(actor, game.user, { app });
        if (!mode.gm) lockSettings(root);

        if (!mode.redact) return;
        if (!root) return;

        redactSheet(root);
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
 * Another player's sheet, censored: disarmed, its tabs shut and emptied, its numbers taken (E24 C1a: one function, so
 * R1445 can redact a stand-in as a viewer's browser would). Sanity's blocks are found first, before the toggles lose
 * their `data-action`, which names the pip layout's.
 */
export function redactSheet(root) {
    const sanity = sanityBlocks(root);
    disarmSheet(root);
    redactTabs(root);
    redactValues(root, sanity);
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
 * THE SHEET SHOWS, THE WINDOW TAKES (1.2.113; A113-C5-7, the owner's E68 decision of 10.11.2026, "Q4 ... zastosowac to
 * do wszystkich akcji", .github/release-notes/v1.2.104.md:231-232). Until 1.2.113 each row here carried its own Take and
 * a tick, and a button under the list took the ticked: the one action left on the sheet's own list when every other
 * action had moved onto the two-column window (E68 C12; v1.2.104.md:256 recorded it as a gap). The list is now what the
 * body carries, its picture and its name, and nothing on it takes; one button under it opens the action's window
 * (`openBodyLoot`), where the rows are picked and greyed. The taker is read when the button is pressed (`openBodyLoot`'s
 * default, `myCharacter`), as the row's Take read it.
 */
export function buildBodyLoot(root, actor) {
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

    const items = lootableItems(actor);
    box.innerHTML = `<h4>${game.i18n.localize("DRPG.Loot.heading")}</h4>`;
    if (!items.length) {
        box.innerHTML += `<p class="notes">${game.i18n.localize("DRPG.Loot.empty")}</p>`;
        pane.replaceChildren(box);
        return;
    }

    const list = document.createElement("ul");
    list.className = "drpg-loot-items";
    for (const item of items) {
        const row = document.createElement("li");
        row.innerHTML = `<img src="${foundry.utils.escapeHTML(item.img ?? "")}" alt="" />
            <span class="drpg-item-name">${foundry.utils.escapeHTML(item.name)}</span>`;
        list.append(row);
    }

    const foot = document.createElement("p");
    foot.className = "drpg-loot-foot";
    const open = document.createElement("button");
    open.type = "button";
    open.className = "drpg-mini-button drpg-loot-open";
    open.innerHTML = `<i class="fa-solid fa-hand" inert></i> ${foundry.utils.escapeHTML(game.i18n.localize("DRPG.Loot.open"))}`;
    open.dataset.tooltip = game.i18n.localize("DRPG.Loot.openTooltip");
    open.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        openBodyLoot(actor).catch(err => error("Could not open Take from the Body", err));
    });
    foot.append(open);

    box.append(list, foot);
    pane.replaceChildren(box);
}

/** What a body carries that may be taken: the module's items, no Truth Bullet (they die with it), nothing in a stash. */
function lootableItems(body) {
    return body.items.filter(i => i.getFlag(MODULE_ID, "category") && !isTruthBullet(i) && !isStashed(i));
}

/**
 * TAKE FROM THE BODY, THE ACTION'S WINDOW (1.2.113; A113-C5-7). On the module's one layout for an action (action-menus.mjs
 * `actionWindow`, E68 C12): the briefing on the left - what the Take rolls and costs, the room, who would see it - and
 * on the right the body's things as rows (ui-columns.mjs `choiceRowHtml`, ticks, the first open one ticked), and Take.
 * Answers whether something was taken (`takeFromBody`), null when the window was closed or nothing was ticked.
 *
 * A ROW THE GATE REFUSES IS GREYED, WITH ITS REASON (E14 part 1 C1; audit S11-06), as the sheet's row was: the one gate
 * the GMs judge the loot by (inventory.mjs `transferRefusal`, mode "loot"), read on this browser, shuts every row and
 * Take with the sentence the player would be told (`DRPG.Bridge.why.<code>`). A row is also shut on its own where the
 * taker's hands hold the most of its kind and they have no stash to take the rest (inventory.mjs `canCarry`, the GM's
 * `transferItem` with TRANSFER_POLICY.loot "overflow"; the words of `DRPG.Loot.handsFull`); with a stash it is open and
 * says the thing goes there. A display: the GMs' gate judges the request again, and a piece that joins a stack the taker
 * holds takes no slot there, so a row is left open wherever this browser cannot tell.
 *
 * READ AGAIN AS THE TABLE MOVES (E14 fix e1-G6, E95 C3): the window's list carries the body and the taker
 * (`data-drpg-body`, `data-drpg-taker`), and `regreyOpenLoot` reads the gate again for every open list when either one's
 * token, the body's tile, the clock or a body's announcement changes (registerAnonymity's hooks), opening a row it no
 * longer refuses.
 *
 * THE TAKE IS THE ONE ROAD AS BEFORE: the picked items go to `takeFromBody`, which rolls Hand once for all of them (and
 * Shadow with a witness), spends no action (E68 C10) and asks the primary (gm-bridge.mjs `requestBodyLoot`), whose card,
 * trace and Truth Bullet are handover.mjs `lootBody`'s. `taker` is read when the window is asked for (`myCharacter`):
 * with none it says so and opens nothing. `check`: the ids ticked when the window opens (a test's, a scenario's).
 */
export async function openBodyLoot(body, { taker = myCharacter(), check = null } = {}) {
    if (!taker) {
        ui.notifications.warn(game.i18n.localize("DRPG.Loot.noCharacter"));
        return false;
    }
    if (!body || !isDeadForGm(body)) return null;
    const items = lootableItems(body);
    const reading = await lootReading(body, taker, items);
    const ticked = check ? new Set([].concat(check)) : new Set([items.find(i => !reading.rows.get(i.id)?.why && !reading.gate)?.id].filter(Boolean));
    const rows = items.map(item => {
        const row = reading.rows.get(item.id);
        const why = reading.gate ?? row.why;
        return choiceRowHtml({ value: item.id, label: item.name, icon: "fa-hand", hint: row.hint, disabled: Boolean(why), why },
            { type: "checkbox", name: "item", checked: !why && ticked.has(item.id) });
    }).join("");
    const ask = items.length
        ? `<p>${esc(game.i18n.localize("DRPG.Loot.prompt"))}</p>
            <div class="drpg-choice-list drpg-loot-list" data-drpg-body="${esc(body.id)}" data-drpg-taker="${esc(taker.id)}">${rows}</div>`
        : `<p class="notes">${esc(game.i18n.localize("DRPG.Loot.empty"))}</p>`;

    const { briefingBlock } = await import("./action-briefing.mjs");
    const { actionWindow } = await import("./action-menus.mjs");
    const brief = briefingBlock(taker, "loot", {
        description: game.i18n.format("DRPG.Loot.brief", { body: body.name }),
        traits: [LOOT.trait],
        cost: 0
    }, { extraFacts: [game.i18n.localize("DRPG.Loot.noAction"), game.i18n.format("DRPG.Loot.coverFact", { n: LOOT.cover.threshold })] });

    const picked = await actionWindow({
        title: game.i18n.localize("DRPG.Loot.windowTitle"),
        classes: ["drpg-loot-window"],
        // A declaration the game waits on, kept above the sheet it was opened from, as every action menu (stacking.mjs).
        prompt: true,
        brief,
        ask,
        render: (event, dialog) => wireLootRows(dialog?.element, reading),
        footer: !items.length ? { close: "close" } : {
            primary: {
                action: "ok",
                label: game.i18n.localize("DRPG.Loot.take"),
                callback: (e, b, d) => [...(d?.element?.querySelectorAll('.drpg-loot-list input[name="item"]:checked') ?? [])]
                    .filter(box => !box.disabled).map(box => box.value)
            },
            close: "cancel"
        },
        rejectClose: false
    });
    if (!Array.isArray(picked)) return null;
    const chosen = picked.map(id => body.items.get(id)).filter(Boolean);
    if (!chosen.length) {
        ui.notifications.info(game.i18n.localize("DRPG.Loot.pickNone"));
        return null;
    }
    return takeFromBody(body, chosen);
}

/**
 * What the gate and the hands say of a Take of `items` off `body` by `taker`, on this browser (`openBodyLoot`): `gate`,
 * the sentence of the one gate's refusal or null; `rows`, per item id `{ why, hint }` - `why` the row's own refusal (full
 * hands and no stash) or null, `hint` the line an open row reads.
 */
async function lootReading(body, taker, items = lootableItems(body)) {
    const { transferRefusal, canCarry, capacityLabel, ITEM_FLAGS } = await import("./inventory.mjs");
    const { reasonOf } = await import("./bridge-guards.mjs");
    const refused = await transferRefusal(body, taker, { mode: "loot", asker: game.user });
    const gate = refused ? game.i18n.localize(`DRPG.Bridge.why.${reasonOf(refused)}`) : null;
    let stash;
    const stashOf = async () => {
        if (stash !== undefined) return stash;
        const { primaryStashRoom } = await import("./vault.mjs");
        const { locateActor } = await import("./movement.mjs");
        const { homeScene } = await import("./rooms.mjs");
        return (stash = primaryStashRoom(taker, locateActor(taker)?.scene ?? homeScene()) ?? null);
    };
    const rows = new Map();
    for (const item of items) {
        const category = item.getFlag(MODULE_ID, ITEM_FLAGS.category);
        const kind = capacityLabel(category);
        const room = canCarry(taker, category);
        const identity = item.getFlag(MODULE_ID, ITEM_FLAGS.identity);
        const joins = Boolean(identity) && taker.items.some(i => i.name === item.name && !isStashed(i) && i.getFlag(MODULE_ID, ITEM_FLAGS.identity) === identity);
        if (room.ok || joins) { rows.set(item.id, { why: null, hint: kind }); continue; }
        const into = await stashOf();
        rows.set(item.id, into
            ? { why: null, hint: game.i18n.format("DRPG.Loot.toStash", { category: kind, room: into }) }
            : { why: game.i18n.format("DRPG.Loot.rowHandsFull", { category: kind, limit: room.limit }), hint: kind });
    }
    return { gate, rows };
}

/**
 * The drawn window's rows and Take, as `reading` says (`openBodyLoot`, `greyRefused`): a refused row shut, its line its
 * reason; an open one its hint. The Take (`drpg-loot-take`) is shut with the gate's sentence, or with the
 * rows' while no row is open, or while nothing is ticked; open, it says what a Take does. A tick tells the Take again.
 */
function wireLootRows(root, reading) {
    const list = root?.querySelector?.(".drpg-loot-list[data-drpg-taker]");
    if (!list) return;
    for (const box of list.querySelectorAll('input[name="item"]')) setTip(box, "DRPG.Tips.Setup.onALootedItemTooltip");
    root.querySelector('[data-action="ok"]')?.classList.add("drpg-loot-take");
    list.addEventListener("change", () => syncLootTake(list));
    paintLootRows(list, reading);
}

function paintLootRows(list, { gate, rows }) {
    for (const box of list.querySelectorAll('input[name="item"]')) {
        const row = rows.get(box.value) ?? { why: null, hint: "" };
        const why = gate ?? row.why;
        // A tick stays under a shut row (the Take reads only open ones), so a row the gate opens again is ticked as it was.
        box.disabled = Boolean(why);
        const label = box.closest(".drpg-choice");
        label?.classList.toggle("unavailable", Boolean(why));
        const line = label?.querySelector(".drpg-choice-text small");
        if (line) line.textContent = why ?? row.hint ?? "";
    }
    list.drpgGate = gate;
    list.drpgRowWhy = [...rows.values()].find(r => r.why)?.why ?? null;
    syncLootTake(list);
}

function syncLootTake(list) {
    const take = list.closest(".drpg-loot-window")?.querySelector(".drpg-loot-take");
    if (!take) return;
    const boxes = [...list.querySelectorAll('input[name="item"]')];
    const open = boxes.some(box => !box.disabled);
    const said = list.drpgGate ?? (!open ? list.drpgRowWhy : null)
        ?? (boxes.some(box => box.checked && !box.disabled) ? null : game.i18n.localize("DRPG.Loot.pickNone"));
    take.disabled = Boolean(said);
    if (said) take.setAttribute("aria-disabled", "true");
    else take.removeAttribute("aria-disabled");
    take.dataset.tooltip = said ?? game.i18n.localize("DRPG.Loot.takeTooltip");
}

/** Shut every row of an open window's `list` the gate or the hands refuse now, and open one they no longer refuse. */
async function greyRefused(list, body, taker) {
    paintLootRows(list, await lootReading(body, taker));
}

/** Every open Take from the Body window on this page, its rows read against the one gate again (fix e1-G6; `openBodyLoot`). */
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
 * Answers whether something was taken (E50 C4): true only on the GM's answer that took it - false on a refusal, on no
 * GM answering and with no character. Since 1.2.113 the Take from the Body window's Take (`openBodyLoot`), which closes
 * as it is pressed, as every action window; the window opened again reads the gate afresh.
 */
async function takeFromBody(body, items) {
    const taker = myCharacter();
    if (!taker) {
        ui.notifications.warn(game.i18n.localize("DRPG.Loot.noCharacter"));
        return false;
    }
    const list = [].concat(items).filter(Boolean);
    if (!list.length) return false;
    const { requestBodyLoot } = await import("./gm-bridge.mjs");
    const one = list.length === 1;
    const picked = one ? { itemId: list[0].id } : { itemIds: list.map(item => item.id) };

    /* NO GM, NO DICE (E68 fix CI a5ebfeaa). A player's roll is the primary's to draw (roll-draw.mjs), so with no GM
       connected the Hand roll below was not made and said "An action roll waits for a GM" - not the Take's own
       sentence, and 87-messenger-sound E2 measured it so at a5ebfeaa. The request is asked as before the roll was:
       with no GM the bridge sends nothing and says once, in its sentence, that no GM is connected (bridge-guards.mjs
       `bridgeRequest`, `noGm`); nothing is thrown. */
    if (!game.user.isGM && !activeGmIds().length) {
        await requestBodyLoot({ takerId: taker.id, bodyId: body.id, ...picked });
        return false;
    }

    /* THE TAKE ROLLS HAND (E68 C10; config.mjs `LOOT`): once for the items it takes, no action spent; the total says how
       plain the body's trace reads (handover.mjs `lootVisibilityOf`), and the primary reads it off its record of the
       roll. With somebody else in the room as this browser sees it, a Shadow roll covers it; the primary counts who
       watches itself (handover.mjs `lootCover`). A closed window takes nothing. */
    /* EVERY TAKE ROLLS, AND ONLY ITS FIRST ROLL COUNTS (E68 C10 loot bind, 10.11.2026; the owner's Q8 "nie": every Take
       rolls Hand again, in the same time of day too; roll-draw.mjs `lootDrawRefusal`). Each roll names the body
       (`context.bodyId`), and the primary counts, for this taker's next Take of this body, the first Hand and the first
       Shadow drawn since their last Take that moved something (bridge-runs-records.mjs `handleLoot`); a later roll
       before that Take settles nothing. So this window rolls for every Take, as before. A Take the GM refused (the wrong
       room) keeps its roll for the next try, and that try's new dice count for nothing. The GM's answer says so (`again`), and
       the page says nothing of it: a Take that lands says one thing, that it was taken (87-messenger-sound E3, after E1's
       refused try). */
    const { rollTrait } = await import("./action-rolls.mjs");
    const idOf = roll => roll?.raw?.message?.id ?? roll?.raw?.message?._id ?? null;
    const context = { bodyId: body.id };
    const roll = await rollTrait(taker, LOOT.trait, { actionKey: "loot", context, title: game.i18n.localize("DRPG.Loot.rollTitle") });
    if (!roll) return false;
    const hand = { rollId: idOf(roll), total: roll.total, isCritical: roll.isCritical, withHope: roll.withHope };
    let cover = null;
    const { othersInRoom } = await import("./movement.mjs");
    if (othersInRoom(taker).some(other => other?.id !== body.id)) {
        const shadow = await rollTrait(taker, LOOT.cover.trait, {
            remember: false, actionKey: "lootCover", context, title: game.i18n.localize("DRPG.Loot.coverTitle"), dc: LOOT.cover.threshold
        });
        if (shadow) cover = { rollId: idOf(shadow), total: shadow.total, isCritical: shadow.isCritical, withHope: shadow.withHope };
    }

    // What this Take reads of the bridge's answer: whether it went, its value and its reason.
    const ask = async (handNamed, coverNamed) => {
        const out = await requestBodyLoot({ takerId: taker.id, bodyId: body.id, ...picked, hand: handNamed, cover: coverNamed });
        return { ok: out.ok, value: out.value ?? null, reason: out.reason ?? null };
    };
    let res = await ask(hand, cover);
    // The primary counts a watcher this page did not, and holds no Shadow for this Take (E68 review R1, handover.mjs
    // `lootBody`): the Shadow is rolled now and the Take asked again on the Hand already bound. Closed, nothing is taken.
    if (res.ok && res.value?.coverNeeded && !game.user.isGM) {
        const shadow = await rollTrait(taker, LOOT.cover.trait, {
            remember: false, actionKey: "lootCover", context, title: game.i18n.localize("DRPG.Loot.coverTitle"), dc: LOOT.cover.threshold
        });
        if (!shadow) return false;
        res = await ask(null, { rollId: idOf(shadow), total: shadow.total, isCritical: shadow.isCritical, withHope: shadow.withHope });
    }
    // Only what the GM has: a refusal has been said, and "you took it" beside it would be two answers.
    // Off a body nobody has found, the Truth Bullet waits for the death to be known (E05 fix r2-F0b).
    const took = Boolean(res.ok && !res.value?.refused && !res.value?.coverNeeded);
    const names = list.map(item => item.name).join(", ");
    if (took) ui.notifications.info(game.i18n.format(isDeceased(body) ? "DRPG.Loot.took" : "DRPG.Loot.tookUnfound", { item: names }));
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
 * Sanity's blocks in the sidebar, in either layout (E24 C1a): marked by sheet.mjs
 * `paintReserves` (`data-drpg-reserve`), which runs on the system's own render
 * hook before this one, or else found as the painter finds them - the bar by its
 * number field's name, the pips by their toggle. A selector, and no number read.
 */
function sanityBlocks(root) {
    const key = "stress";
    return [...new Set([
        ...root.querySelectorAll(`[data-drpg-reserve="${key}"]`),
        root.querySelector(`input.bar-input[name="system.resources.${key}.value"]`)?.closest(".status-bar"),
        root.querySelector(".slot[data-action='toggleStress']")?.closest(".slot-value")
    ].filter(Boolean))];
}

/**
 * Numbers become question marks; names become nothing at all.
 *
 * WHAT SURVIVES IS THE POINT. Health keeps its figures and the Equipped panel
 * keeps its item, because those are the things the fiction shows anyone in the
 * room. Sanity does not since E24 C1a (the owner, 28.10: other players do not see
 * another player's Sanity): its block keeps its plate and is EMPTIED - the row
 * "?", the track at nothing, no pip, and the system's own progress, number
 * field, maximum, label and slots stripped of every number they carry. The
 * document itself still reaches this browser; a console reads it. Everything with a number attached to it - traits, Actions,
 * Hope - becomes a question mark, and an Experience keeps its ROW while losing
 * both its name and its size: you can see that they have two of them and that
 * both are worth something, which is exactly what watching somebody work would
 * tell you.
 */
function redactValues(root, sanity = sanityBlocks(root)) {
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
    //
    // ONE "?" FOR HOPE, NOT ONE A DIAMOND (E49 B2, 10.11.2026; the owner's Q1, "prośba": on another player's sheet the
    // maximum of Hope reads "?" as Sanity's does). The header draws one diamond per point of the maximum, each carrying
    // its point in `data-value`, so a "?" a diamond still counted the maximum out - six "?" for six (71 J3 read
    // "??????") - and the page kept 1..max. Each row of diamonds keeps its first slot, emptied, its `data-value` taken
    // off, as the one "?", and loses the rest; whatever the maximum, the viewer reads the same single mark (the owner's
    // rule of the same day: a state changes look, never layout). Sanity's block below already reads one "?" with no
    // maximum (character.mjs `reserveRow`), and is emptied as before.
    const hopeRows = new Map();
    for (const pip of root.querySelectorAll(".hope-value")) {
        const row = hopeRows.get(pip.parentElement) ?? [];
        row.push(pip);
        hopeRows.set(pip.parentElement, row);
    }
    for (const [holder, [first, ...rest]] of hopeRows) {
        for (const pip of rest) pip.remove();
        first.removeAttribute("data-value");
        mark(first, "?", "drpg-redacted-hope");
        holder?.removeAttribute?.("data-tooltip");
        holder?.removeAttribute?.("aria-label");
    }

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
    // (its `sheetMode`'s `viewer`); removed here as well, so a stack drawn by anything else goes too -
    // EMPTIED, NOT HIDDEN, as the tabs are.
    for (const badge of root.querySelectorAll(".drpg-pending-call")) badge.remove();
    for (const stack of root.querySelectorAll(".drpg-pending-stack")) stack.remove();

    for (const block of sanity) {
        for (const row of block.querySelectorAll(".drpg-reserve-row")) mark(row, "?");
        for (const fill of block.querySelectorAll(".drpg-resource-fill")) fill.style.width = "0%";
        block.querySelectorAll(".drpg-resource-delta, .drpg-reserve-pip").forEach(el => el.remove());
        for (const progress of block.querySelectorAll("progress")) {
            progress.removeAttribute("value");
            progress.removeAttribute("max");
            progress.style.removeProperty("--drpg-bar-pct");
        }
        for (const input of block.querySelectorAll("input")) {
            input.removeAttribute("value");
            input.removeAttribute("max");
            input.value = "";
        }
        for (const label of block.querySelectorAll(".bar-label, .slot-label .value")) label.textContent = "";
        for (const slot of block.querySelectorAll(".slot")) {
            slot.classList.remove("filled");
            slot.removeAttribute("data-value");
        }
        for (const el of block.querySelectorAll("[data-tooltip], [aria-label]")) {
            el.removeAttribute("data-tooltip");
            el.removeAttribute("aria-label");
        }
    }
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
function onPreCreateActor(actor, data, options) {
    if (actor.type !== "character" || !enforcing()) return;
    // A dead student's Spectator (E62 C3b, spectator-dead.mjs) is made owned by its player and seen by nobody else: a
    // sheet the whole table could open would list a death nobody has found in every player's Actors tab.
    if (options?.drpgDeadSpectator) return;
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
            await whisperToGms({ tone: "warning", body: `<p>${game.i18n.format("DRPG.Anonymity.reverted", {
                actor: foundry.utils.escapeHTML(actor.name)
            })}</p>` });
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
            sections.push(`<p><button type="button" data-drpg-anon-fix${tipAttr("DRPG.Tips.Setup.setThemToObserverTooltip")}>${escape(game.i18n.localize("DRPG.Anonymity.audit.fix"))}</button></p>`);
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
