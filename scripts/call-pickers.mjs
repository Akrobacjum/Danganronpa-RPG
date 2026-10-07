/**
 * Danganronpa RPG - the windows a Call opens to ask what it is pointed at.
 * ---------------------------------------------------------------------------
 * `pickTarget` and the pickers behind it - a room, a player, a project, a text,
 * a motive, a Monocub, an item - each opened under the same lines that name the
 * Call, its effect and its price (`callHeader`, carried on `pendingHeader`).
 * They only ask. Nothing here pays for a Call, arms it or applies it: that is
 * calls.mjs (`confirmCall`) and call-effects.mjs (`applyCall`).
 *
 * WHERE IT SITS. Moved out of call-effects.mjs by E34 (1.2.70), a pure move that
 * `node tools/moved-only.mjs` proves line by line. The file above it is
 * call-effects.mjs, which re-exports `pickTarget` - the one name here another
 * file reads (sheet.mjs, through that facade) - so importers keep importing
 * call-effects.mjs, and nothing here imports it back: R161 counts an
 * `export ... from` as an edge, and the import would close a cycle. Below it are
 * config.mjs and utils.mjs, statically; the modules a picker reads the world
 * through (movement, projects, chapter, monokuma, monocub) stay lazy `import()`s,
 * as they were. `pendingHeader` is a module `let` that `pickTarget` writes and
 * the pickers read, so it lives with them - no module can assign another's
 * binding - and the `DialogV2` alias came along, because nothing left in
 * call-effects.mjs opens a window through it.
 */

import { MODULE_ID, DESPAIR_CALLS, MOTIVE, callEffect } from "./config.mjs";
import { dialogContent, esc } from "./utils.mjs";

const DialogV2 = foundry.applications.api.DialogV2;

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
    // Carried on `pendingHeader` rather than passed down through six pickers:
    // every one of them ends in `choose()` or a small form of its own, and
    // threading a header parameter through all of them to reach two template
    // strings is more moving parts than the same fact read once at the point
    // it is rendered.
    pendingHeader = callHeader(call, kind);
    try {
        // The one Call whose content is the point: a new rule has to be written
        // before it can be announced.
        if (call.announces) return await pickText(call);
        // …and the one that needs three answers rather than a target.
        if (call.setsMotive) return await pickMotive(call);

        switch (call.target) {
            case "player": return await pickPlayer(actor, call, kind);
            case "monocub": return await pickMonocub();
            case "project": return await pickProject(actor, kind, call);
            case "room": return await pickRoom();
            case "item": return await pickItem();
            default: return {};
        }
    } finally {
        pendingHeader = "";
    }
}

/**
 * The name, the effect and the price - the same three lines `confirmCall`
 * shows, rendered above whichever picker this Call needs.
 */
let pendingHeader = "";

function callHeader(call, kind) {
    return `<div class="drpg-call-header">
        <h3>${esc(call.label)}</h3>
        <p>${esc(callEffect(call))}</p>
        <p class="notes">${game.i18n.format(
            kind === "hope" ? "DRPG.Calls.costsHopeShort" : "DRPG.Calls.costsDespairShort",
            { cost: call.cost })}</p>
    </div>`;
}

/**
 * Which Monocub is being fuelled.
 *
 * Only actual Monocubs: a dead student who has not opted in has nothing to
 * spend Hope on, and a living one is not what this Call is for.
 */
async function pickMonocub() {
    const { monocubActors } = await import("./monocub.mjs");
    const cubs = monocubActors();

    if (!cubs.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Monocub.noneYet"));
        return null;
    }

    const id = await choose("DRPG.Monocub.who",
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
async function pickText(call) {
    const text = await DialogV2.wait({
        window: { title: call.label },
        classes: ["drpg-panel", "drpg-despair-dialog"],
        content: dialogContent(`${pendingHeader}<form>
            <p>${game.i18n.localize("DRPG.Calls.newRulePrompt")}</p>
            <textarea name="text" rows="3"
                placeholder="${game.i18n.localize("DRPG.Calls.newRulePlaceholder")}"></textarea>
            <p class="notes">${game.i18n.format("DRPG.Calls.newRuleNote", { cost: DESPAIR_CALLS.newRule.cost })}</p>
        </form>`),
        buttons: [
            {
                action: "ok", label: game.i18n.localize("DRPG.Action.proceed"), default: true,
                callback: (e, b, d) => d.element.querySelector("[name=text]").value.trim()
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
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
async function pickMotive(call) {
    const record = await DialogV2.wait({
        window: { title: call.label },
        classes: ["drpg-panel", "drpg-despair-dialog"],
        content: dialogContent(`${pendingHeader}<form>
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
        </form>`),
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
        buttons: [
            {
                action: "ok", label: game.i18n.localize("DRPG.Action.proceed"), default: true,
                callback: (e, b, d) => {
                    const f = d.element.querySelector("form");
                    return {
                        text: f.querySelector("[name=text]").value.trim(),
                        consequence: f.querySelector("[name=consequence]").value.trim(),
                        timesOfDay: Number(f.querySelector("[name=timesOfDay]").value)
                    };
                }
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    // The backstop behind the disabled button, for the same reason the rest
    // picker keeps one: a template change or a render that never fired would
    // take the guard away and leave nothing behind it.
    if (!record || record === "cancel" || !record.text) return null;
    return { motive: record };
}

async function pickPlayer(actor, call, kind) {
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

    const id = await choose("DRPG.Calls.whichPlayer",
        pool.map(a => ({ value: a.id, label: a.name })));
    if (!id) return null;
    return { target: pool.find(a => a.id === id) };
}

async function pickProject(actor, kind = "hope", call = null) {
    const { knownProjects, projectsAvailableIn, isComplete, isFrozen } = await import("./projects.mjs");
    const { roomOfActor } = await import("./movement.mjs");

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
    const room = roomOfActor(actor);
    const here = projectsAvailableIn(room);
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

    const id = await choose("DRPG.Calls.whichProject",
        pool.map(p => ({ value: p.id, label: `${p.name} - ${p.current}/${p.start}` })));
    if (!id) return null;
    return { project: id };
}

async function pickRoom() {
    const { allRooms } = await import("./movement.mjs");
    const rooms = allRooms();
    if (!rooms.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Rest.noRegions"));
        return null;
    }
    const room = await choose("DRPG.Calls.whichRoom", rooms.map(r => ({ value: r, label: r })));
    return room ? { room } : null;
}

async function pickItem() {
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
    const uuid = await choose("DRPG.Calls.whichItem", entries);
    if (!uuid) return null;
    return { item: await fromUuid(uuid) };
}

/** One-dropdown picker. */
async function choose(promptKey, options) {
    const html = options
        .map(o => `<option value="${foundry.utils.escapeHTML(o.value)}">${foundry.utils.escapeHTML(o.label)}</option>`)
        .join("");

    const picked = await DialogV2.wait({
        window: { title: game.i18n.localize(promptKey) },
        classes: ["drpg-panel"],
        content: `${pendingHeader}<form><label>${game.i18n.localize(promptKey)}
                    <select name="choice">${html}</select></label></form>`,
        buttons: [
            {
                action: "ok", label: game.i18n.localize("DRPG.Action.proceed"), default: true,
                callback: (e, b, d) => d.element.querySelector("[name=choice]").value
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    return (picked && picked !== "cancel") ? picked : null;
}
