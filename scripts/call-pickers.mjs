/**
 * Danganronpa RPG - the windows a Call opens to ask what it is pointed at.
 * ---------------------------------------------------------------------------
 * `pickTarget` and the pickers behind it - a room, a player, a project, a text,
 * a motive, a Monocub, an item - each opened under the same lines that name the
 * Call, its effect and its price (`callHeader`, built by `pickTarget` and handed
 * to each picker). They only ask. Nothing here pays for a Call, arms it or
 * applies it: that is calls.mjs (`confirmCall`) and call-effects.mjs (`applyCall`).
 *
 * AND EVERY CALL WINDOW IS DRAWN HERE (E51 C2, 30.10.2026; audit S17-48):
 * `callWindow`, which the pickers, calls.mjs's confirmation and the GM's ruling,
 * the Monocub's Confusion (monocub.mjs) and the sheet's "call off the assembly"
 * all open through - one look, by the Call's side, under the header the caller
 * hands in. R1110 reads that no Call window opens any other way.
 *
 * WHERE IT SITS. Moved out of call-effects.mjs by E34 (1.2.70), a pure move that
 * `node tools/moved-only.mjs` proves line by line. The file above it is
 * call-effects.mjs, which re-exports `pickTarget` - the one name here another
 * file reads (sheet.mjs, through that facade) - so importers keep importing
 * call-effects.mjs, and nothing here imports it back: R161 counts an
 * `export ... from` as an edge, and the import would close a cycle. Below it are
 * config.mjs and utils.mjs, statically, and since E51's fix round live.mjs
 * (`alreadyOpen`, `keepLive`, which import config.mjs and utils.mjs alone); the modules a picker reads the world
 * through (movement, projects, chapter, monokuma, monocub) stay lazy `import()`s,
 * as they were. The `DialogV2` alias came along, because nothing left in
 * call-effects.mjs opens a window through it; since E51 C2 `callWindow` is its
 * one reader. calls.mjs, monocub.mjs and sheet.mjs import `callWindow` and
 * `callHeader` from here directly: neither is a name of the facade, and this
 * file imports none of them back statically, so no cycle closes (R161).
 */

import { MODULE_ID, HOPE_CALLS, DESPAIR_CALLS, MOTIVE, callEffect } from "./config.mjs";
import { dialogContent, esc, wholeNumber } from "./utils.mjs";
import { alreadyOpen, keepLive } from "./live.mjs";

const DialogV2 = foundry.applications.api.DialogV2;

/* ==========================================================================
 * THE CALL WINDOW
 * ========================================================================== */

/**
 * Every window a Call opens, from one builder (E51 C2, 30.10.2026; audit S17-48).
 *
 * Seven windows used to be built in seven places: the pickers in `drpg-despair-dialog` whatever
 * the Call (`choose` in no side's class at all), the confirmation and the GM's ruling in classes
 * of their own, Confusion as a plain panel, the sheet's "call off the assembly" a bare confirm -
 * and the pickers' confirm said "Do it" (`DRPG.Action.proceed`), which says nothing about what
 * it does. Now:
 *
 *   THE SIDE IS THE CLASS. `kind` "hope" gives `drpg-hope-dialog` (gold), anything else
 *   `drpg-despair-dialog` (blood) - the stylesheet's `--drpg-call-ink`, on the header's stripe and
 *   title (danganronpa.css, "the Call window's side").
 *   THE HEADER IS HANDED IN. The caller builds it (`callHeader`) and it is drawn above the body;
 *   nothing is read from module state, so two windows open at once keep their own (the module
 *   `let pendingHeader` this replaced was shared by both).
 *   THE GM ROAD IS RED. `gmRoute` puts `drpg-gm-route` (D11, the class `chooseVariant`'s rows and
 *   every "this waits for a GM" button carry) on each button but the cancel.
 *   THE BUTTONS SAY WHAT THEY DO, the caller's own, and the cancel is `DRPG.Calls.cancel` (or the
 *   key `cancel` names; `false` for none).
 *
 * The content goes through `dialogContent`, which keeps a textarea's placeholder (utils.mjs).
 * `title` defaults to the Call's label; `render` and `modal` pass through to DialogV2.
 *
 * ONE OF EACH, AND TRUE WHILE IT STANDS (E51 fix round FG7, 31.10.2026; review goal G2: the owner's
 * amend of 27.10, variant B, "callWindow powstaje na DialogV2 z keepLive i alreadyOpen", which C2
 * did not build). `once` is a class (`callWindowClass`): while a window carrying it is open
 * (live.mjs `alreadyOpen`) that one is raised and this answers null, opening nothing - a sheet
 * redrawn under a Call window puts its tile back live, and a second press opened a second window
 * for the same Call. `live` is `keepLive`'s `{ region, build, watch, after }`, started on the drawn
 * window: the confirmation's header redrawn from what the buyer holds now, and its Spend with it
 * (calls.mjs `confirmCall`). Tier 2's E51-T29 opens one twice and grants Hope while it stands.
 *
 * @returns {Promise<*>} what `DialogV2.wait` answers: a button's callback's value, its action,
 *   or null for a closed window (or for a window of `once` already open).
 */
export async function callWindow({
    call = null, kind = "hope", header = "", body = "", buttons = [], gmRoute = false,
    title = null, cancel = true, cancelDefault = false, render, modal, once = null, live = null
} = {}) {
    if (once && alreadyOpen(once)) return null;
    const routed = buttons.map(b => gmRoute && b.action !== "cancel"
        ? { ...b, class: [b.class, "drpg-gm-route"].filter(Boolean).join(" ") } : b);
    if (cancel !== false) {
        routed.push({ action: "cancel", label: game.i18n.localize(typeof cancel === "string" ? cancel : "DRPG.Calls.cancel"),
            default: cancelDefault });
    }
    const drawn = live || render ? (event, dialog) => {
        if (live) {
            // keepLive hands `after` the new element alone; the window goes with it here.
            keepLive(dialog, live.after ? { ...live, after: next => live.after(next, dialog) } : live);
            live.after?.(dialog?.element?.querySelector(live.region) ?? null, dialog);
        }
        render?.(event, dialog);
    } : null;
    return DialogV2.wait({
        window: { title: title ?? call?.label ?? "" },
        classes: ["drpg-panel", kind === "hope" ? "drpg-hope-dialog" : "drpg-despair-dialog", ...(once ? [once] : [])],
        content: dialogContent(`${header}${body}`),
        buttons: routed,
        ...(drawn ? { render: drawn } : {}),
        ...(modal !== undefined ? { modal } : {}),
        rejectClose: false
    });
}

/**
 * The class a Call's window carries for `callWindow`'s `once` (E51 fix round FG7): one per Call, its side
 * and its step - `pick` for the pickers, `confirm` for the confirmation - so the picker and the confirmation of
 * one purchase, which hand over in the same breath, never refuse each other. Null for a Call that is no row of
 * the two tables (the GM's ruling window is built from a stand-in).
 */
export function callWindowClass(call, kind, step) {
    const table = kind === "hope" ? HOPE_CALLS : DESPAIR_CALLS;
    const key = Object.keys(table).find(k => table[k] === call);
    return key ? `drpg-call-${kind === "hope" ? "hope" : "despair"}-${key}-${step}` : null;
}

/**
 * A window of this Call open now, either step, raised; or null (E51 fix round FG7). The sheet asks it at the press
 * (sheet.mjs `runCall`), so a second press while the first purchase's picker or confirmation stands opens nothing.
 */
export function callWindowOpen(call, kind) {
    for (const step of ["pick", "confirm"]) {
        const cls = callWindowClass(call, kind, step);
        const open = cls ? alreadyOpen(cls) : null;
        if (open) return open;
    }
    return null;
}

/* ==========================================================================
 * PICKERS
 * ========================================================================== */

/**
 * Ask for whatever the Call needs pointing at. Returns null if cancelled, or an
 * empty object when the Call needs nothing.
 */
export async function pickTarget(actor, call, kind) {
    // WHAT AM I BUYING? - asked before the first decision, not after it.
    //
    // A Call with no target (Reroll) goes straight to `confirmCall`, which
    // opens with the name, the sentence and the price. A Call WITH a target
    // used to open with a bare dropdown of names and no explanation at all,
    // and only reached that sentence once the target had been chosen. Same
    // purchase, two different orders, and the one that showed the price last
    // was the one where the choice mattered more.
    //
    // HANDED ON, NOT CARRIED (E51 C2, 30.10.2026; audit S17-48). The header was a module `let`
    // (`pendingHeader`) set here and cleared when this picker's window closed, on the grounds that
    // threading it through six pickers was more moving parts than reading one binding. The binding
    // was one for every Call: a picker that awaits an import before its window (the player's, the
    // project's, the room's, the item's, the Monocub's) drew whatever Call had set it last, and the
    // first window to close cleared the other's. R1111 opens two at once. So each picker is handed
    // `ask` - the Call, its side and its header - and passes it to `callWindow`.
    // `once` (E51 fix round FG7): one picker of this Call at a time (`callWindow`).
    const ask = { call, kind, header: callHeader(call, kind), once: callWindowClass(call, kind, "pick") };
    // The one Call whose content is the point: a new rule has to be written
    // before it can be announced.
    if (call.announces) return await pickText(ask);
    // …and the one that needs three answers rather than a target.
    if (call.setsMotive) return await pickMotive(ask);

    switch (call.target) {
        case "player": return await pickPlayer(actor, ask);
        case "monocub": return await pickMonocub(ask);
        case "project": return await pickProject(actor, ask);
        case "room": return await pickRoom(actor, ask);
        case "item": return await pickItem(ask);
        default: return {};
    }
}

/**
 * The name, the effect and the price - the lines above every Call window, the
 * pickers' and the confirmation's, so the two screens read as one purchase.
 *
 * `held` (the confirmation's) turns the short price into the sentence with what
 * the buyer holds, in the warning colour when it is not enough. `effect` and
 * `price` replace the Call's own sentence and price, for a window whose row is
 * not a Call's (monocub.mjs's Confusion). A Call with no target has no name to
 * add: the header is the Call's, never the target's (that is the body's
 * "Aimed at").
 */
export function callHeader(call, kind, { held = null, effect = null, price = null } = {}) {
    const hope = kind === "hope";
    const priceLine = price ?? (held === null
        ? game.i18n.format(hope ? "DRPG.Calls.costsHopeShort" : "DRPG.Calls.costsDespairShort", { cost: call.cost })
        : game.i18n.format(hope ? "DRPG.Calls.costsHope" : "DRPG.Calls.costsDespair", { cost: call.cost, held }));
    const short = held !== null && held < call.cost;
    return `<div class="drpg-call-header">
        <h3>${esc(call.label)}</h3>
        <p>${esc(effect ?? callEffect(call))}</p>
        <p class="${short ? "drpg-warning" : "notes"}">${esc(priceLine)}</p>
    </div>`;
}

/**
 * Which Monocub is being fuelled.
 *
 * Only actual Monocubs: a dead student who has not opted in has nothing to
 * spend Hope on, and a living one is not what this Call is for.
 */
async function pickMonocub(ask) {
    const { monocubActors } = await import("./monocub.mjs");
    const cubs = monocubActors();

    if (!cubs.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Monocub.noneYet"));
        return null;
    }

    const id = await choose(ask, "DRPG.Monocub.who",
        cubs.map(a => ({
            value: a.id,
            label: `${a.name} - ${game.i18n.format("DRPG.Monocub.hopeShort", {
                held: a.system?.resources?.hope?.value ?? 0
            })}`
        })));
    if (!id) return null;
    return { target: cubs.find(a => a.id === id) };
}

/** The wording of a new killing game rule, which everyone will be shown. */
async function pickText(ask) {
    const text = await callWindow({
        ...ask,
        body: `<form>
            <p>${game.i18n.localize("DRPG.Calls.newRulePrompt")}</p>
            <textarea name="text" rows="3"
                placeholder="${game.i18n.localize("DRPG.Calls.newRulePlaceholder")}"></textarea>
            <p class="notes">${game.i18n.format("DRPG.Calls.newRuleNote", { cost: DESPAIR_CALLS.newRule.cost })}</p>
        </form>`,
        // The confirm stays shut until there is a rule to announce (E15 C4, 25.10.2026; audit S09-39), as
        // `pickMotive`'s: an empty text closed the window and did nothing, which read as a Call for nine
        // Despair that hung.
        render: (event, dialog) => {
            const root = dialog?.element;
            const field = root?.querySelector("[name=text]");
            const confirm = root?.querySelector('button[data-action="ok"]');
            if (!field || !confirm) return;
            const sync = () => { confirm.disabled = !field.value.trim(); };
            field.addEventListener("input", sync);
            sync();
        },
        buttons: [{
            action: "ok", label: game.i18n.localize("DRPG.Calls.next"), default: true,
            callback: (e, b, d) => d.element.querySelector("[name=text]").value.trim()
        }]
    });

    if (!text || text === "cancel") return null;
    return { text };
}

/**
 * The three questions a motive is made of: what Monokuma wants, how long the
 * cast has, and what happens when the time runs out.
 *
 * BOTH SENTENCES ARE REQUIRED, AND THE WINDOW SAYS SO BEFORE THE BUTTON (the
 * E13 lesson, learned on the rest picker). Nine Despair is three quarters of a
 * pool; a motive bought without a stated consequence is a threat the table
 * cannot be held to, and finding that out after paying is the version of this
 * that costs somebody their time of day.
 */
async function pickMotive(ask) {
    const record = await callWindow({
        ...ask,
        body: `<form>
            <label>${game.i18n.localize("DRPG.Motive.demandLabel")}
                <textarea name="text" rows="3"
                    placeholder="${game.i18n.localize("DRPG.Motive.demandPlaceholder")}"></textarea></label>
            <label>${game.i18n.localize("DRPG.Motive.deadlineLabel")}
                <input type="number" name="timesOfDay"
                    value="${MOTIVE.defaultTimesOfDay}"
                    min="${MOTIVE.minTimesOfDay}" max="${MOTIVE.maxTimesOfDay}" step="1" /></label>
            <p class="notes">${game.i18n.localize("DRPG.Motive.deadlineNote")}</p>
            <label>${game.i18n.localize("DRPG.Motive.consequenceLabel")}
                <textarea name="consequence" rows="2"
                    placeholder="${game.i18n.localize("DRPG.Motive.consequencePlaceholder")}"></textarea></label>
            <p class="notes">${game.i18n.localize("DRPG.Motive.publicNote")}</p>
        </form>`,
        render: (event, dialog) => {
            const root = dialog?.element;
            if (!root) return;
            const fields = ["text", "consequence"]
                .map(name => root.querySelector(`[name=${name}]`))
                .filter(Boolean);
            const confirm = root.querySelector('button[data-action="ok"]');
            const sync = () => {
                if (confirm) confirm.disabled = fields.some(f => !f.value.trim());
            };
            for (const f of fields) f.addEventListener("input", sync);
            sync();
        },
        buttons: [{
            action: "ok", label: game.i18n.localize("DRPG.Calls.next"), default: true,
            callback: (e, b, d) => {
                const f = d.element.querySelector("form");
                return {
                    text: f.querySelector("[name=text]").value.trim(),
                    consequence: f.querySelector("[name=consequence]").value.trim(),
                    timesOfDay: wholeNumber(f.querySelector("[name=timesOfDay]").value, { min: MOTIVE.minTimesOfDay, max: MOTIVE.maxTimesOfDay, fallback: MOTIVE.defaultTimesOfDay })
                };
            }
        }]
    });

    // The backstop behind the disabled button, for the same reason the rest
    // picker keeps one: a template change or a render that never fired would
    // take the guard away and leave nothing behind it.
    if (!record || record === "cancel" || !record.text) return null;
    return { motive: record };
}

async function pickPlayer(actor, ask) {
    const { kind } = ask;
    const { isMonokuma } = await import("./monokuma.mjs");
    const { othersInRoom } = await import("./movement.mjs");
    const { isDeadForGm } = await import("./chapter.mjs");

    // Support explicitly requires the same room; Monokuma reaches anyone.
    const sameRoomOnly = kind === "hope";
    const reachable = sameRoomOnly
        ? othersInRoom(actor)
        : game.actors.filter(a => a.type === "character" && !isMonokuma(a) && a.id !== actor.id);

    /*
     * THE DEAD ARE NOT A TARGET (D-F4).
     *
     * The wide pool filtered on type, on Monokuma and on "not me", and never
     * asked whether the person was still alive - so every Obstacle offered the
     * cast plus everybody the cast had already buried. Neither Call means
     * anything on a corpse: there is no roll of theirs to help and none to
     * hinder.
     *
     * Filtered here rather than at each Call, because it is a fact about who
     * can be targeted at all, not about what a particular Call does. A dead
     * student who opted in as a Monocub is still reachable - through
     * `pickMonocub`, which is the Call written for them.
     */
    const pool = reachable.filter(a => !isDeadForGm(a));

    if (!pool.length) {
        ui.notifications.warn(game.i18n.localize(
            sameRoomOnly ? "DRPG.Calls.nobodyHere" : "DRPG.Calls.noPlayers"));
        return null;
    }

    const id = await choose(ask, "DRPG.Calls.whichPlayer",
        pool.map(a => ({ value: a.id, label: a.name })));
    if (!id) return null;
    return { target: pool.find(a => a.id === id) };
}

async function pickProject(actor, ask) {
    const { kind, call } = ask;
    const { knownProjects, projectsAvailableIn, isComplete, isFrozen, projectLabel } = await import("./projects.mjs");
    const { locateActor } = await import("./movement.mjs");

    // Hope's Contribution is "a project being run in your current room";
    // Monokuma reaches any of them.
    //
    // Either way the list is filtered to what this user is allowed to know
    // exists. The fallback used to be `allProjects()`, so a player standing in a
    // room with no project was shown a dropdown of every secret plan at the
    // table - the same leak as Work on Project, one dialog further along.
    //
    // And the fallback is Monokuma's alone (DESP-14): `kind` used to go unread,
    // so a student in an empty room could Contribute across the map.
    // The room on its scene: a project is listed on its own scene only (E12 fix r1-G3).
    const here = projectsAvailableIn(locateActor(actor));
    // `knownProjects` rather than `visibleProjects` for the same reason the tray
    // uses it: the fallback is a list of NAMES, and a public project nobody has
    // walked into yet is not something this account should be able to read off a
    // dropdown. It changes nothing for a GM - `knowsProject` answers true for
    // them - and narrows a player-held Monokuma to the rooms they have found.
    const listed = here.length ? here : (kind === "despair" ? knownProjects() : []);

    /*
     * A CALL THAT MOVES PROGRESS NEEDS PROGRESS TO MOVE (CALL-10, Dawid 17.09).
     *
     * Game Integrity and Patronage used to be offered every project the reader
     * could see, finished and sabotage-frozen ones included. A finished project
     * has nothing left to take and taking from it would reopen something whose
     * completion has already armed a trap or thawed a repair; a frozen one is the
     * thing a repair exists to fix, and both Work on Project and Sabotage already
     * leave it out (projects.mjs). So the Calls that carry `progress` see the
     * same list those actions do. `projectsAvailableIn` has already dropped the
     * finished ones from this room's list; the frozen ones, and the whole of the
     * `knownProjects` fallback, are filtered here.
     */
    const pool = call?.progress
        ? listed.filter(p => !isComplete(p) && !isFrozen(p.id))
        : listed;

    // Two different empties: nothing on the list at all, or a list whose every
    // project is finished or frozen.
    if (!pool.length) {
        ui.notifications.warn(game.i18n.localize(listed.length
            ? "DRPG.Project.noneToMove" : "DRPG.Project.none"));
        return null;
    }

    const id = await choose(ask, "DRPG.Calls.whichProject",
        // The one formatter of a project's name in a list (projects.mjs `projectLabel`, E51 C1).
        pool.map(p => ({ value: p.id, label: projectLabel(p) })));
    if (!id) return null;
    return { project: id };
}

/* THE CALLER'S SCENE, NOT THE ONE ON SCREEN (E12 C5, 1.2.74; audit S16-07). The list, for every Call
   that names a room, was the rooms of the scene this browser's camera showed. The GM who applies a
   gather judges its room against the caller's own scene (call-effects.mjs `gatherRefusal`), so the
   list is that scene's, read the same way from the same documents (call-world.mjs `gatherSceneOf`). */
async function pickRoom(actor, ask) {
    const { gatherSceneOf } = await import("./call-world.mjs");
    const { roomNames } = await import("./rooms.mjs");
    const rooms = roomNames(await gatherSceneOf(actor));
    if (!rooms.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Rest.noRegions"));
        return null;
    }
    const room = await choose(ask, "DRPG.Calls.whichRoom", rooms.map(r => ({ value: r, label: r })));
    return room ? { room } : null;
}

async function pickItem(ask) {
    /*
     * WHOSE THINGS CONTRABAND CAN REACH (CALL-14, Dawid 17.09).
     *
     * A body's belongings: yes. They stay on the corpse as evidence since 27.08,
     * and destroying one is exactly the kind of interference four Despair should
     * buy - the Monokuma reaching into a crime scene the cast has not searched yet.
     * A Truth Bullet: never. The price is written for "one object out of three
     * carried slots, replaceable by one Search", and knowledge is neither carried
     * nor replaceable. A Monokuma's or a Monocub's own sheet: no - the Call is
     * interference with the cast, and their own props are theirs to describe.
     */
    const { isMonokuma } = await import("./monokuma.mjs");
    const { isMonocub } = await import("./monocub.mjs");
    const { isDeadForGm } = await import("./chapter.mjs");

    const entries = [];
    for (const actor of game.actors) {
        if (actor.type !== "character") continue;
        if (isMonokuma(actor) || isMonocub(actor)) continue;
        for (const item of actor.items) {
            const category = item.getFlag(MODULE_ID, "category");
            if (!category || category === "truthBullet") continue;
            entries.push({
                value: item.uuid,
                label: isDeadForGm(actor)
                    ? game.i18n.format("DRPG.Calls.onTheBody", { name: actor.name, item: item.name })
                    : `${actor.name} - ${item.name}`
            });
        }
    }
    if (!entries.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Calls.noItems"));
        return null;
    }
    const uuid = await choose(ask, "DRPG.Calls.whichItem", entries);
    if (!uuid) return null;
    return { item: await fromUuid(uuid) };
}

/** One-dropdown picker, under the Call's header and in its side's class (`ask`). */
async function choose(ask, promptKey, options) {
    const html = options
        .map(o => `<option value="${foundry.utils.escapeHTML(o.value)}">${foundry.utils.escapeHTML(o.label)}</option>`)
        .join("");

    const picked = await callWindow({
        ...ask,
        title: game.i18n.localize(promptKey),
        body: `<form><label>${game.i18n.localize(promptKey)}
                    <select name="choice">${html}</select></label></form>`,
        buttons: [{
            action: "ok", label: game.i18n.localize("DRPG.Calls.next"), default: true,
            callback: (e, b, d) => d.element.querySelector("[name=choice]").value
        }]
    });

    return (picked && picked !== "cancel") ? picked : null;
}
