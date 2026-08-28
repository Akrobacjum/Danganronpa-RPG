/**
 * Danganronpa RPG — Rest.
 * ---------------------------------------------------------------------------
 * Guide:
 *   Long rest  — 2 actions, pick 2 of Sleep / Meal / Breath, once per session,
 *                bedroom only.
 *   Short rest — 1 action, pick 1, once per time of day.
 *   "The pool of rooms allowing a short rest can be larger and depends entirely
 *    on the map prepared for the season. A long rest happens only in a bedroom."
 *
 * Which rooms permit which rest is therefore map data, not a fixed rule: rooms
 * are Scene Regions and the GM flags them. A region flagged for neither offers
 * no rest at all.
 */

import { MODULE_ID, FLAGS, REST, STARTING } from "./config.mjs";
import { actionsLeft, spendAction, canPayFor } from "./actions.mjs";
import { roomOfActor } from "./movement.mjs";
import { getClock } from "./clock.mjs";
import { resourceMax, resourceValue } from "./character.mjs";
import { whisperToOwner, log, error, plural, cardHead } from "./utils.mjs";

const DialogV2 = foundry.applications.api.DialogV2;

/** Flags set on a Scene Region. */
export const REST_FLAGS = {
    short: "restShort",
    long: "restLong"
};

/* ==========================================================================
 * WHERE
 * ========================================================================== */

/** Region documents on the current scene, by name. */
function regionsByName() {
    const map = new Map();
    for (const region of canvas?.scene?.regions ?? []) {
        if (region.name) map.set(region.name, region);
    }
    return map;
}

/** Does this room allow the given kind of rest? */
export function roomAllows(room, kind) {
    if (!room) return false;
    const region = regionsByName().get(room);
    if (!region) return false;
    return Boolean(region.getFlag(MODULE_ID, kind === "long" ? REST_FLAGS.long : REST_FLAGS.short));
}

/** Rooms flagged for a kind of rest. */
export function restRooms(kind) {
    return Array.from(regionsByName().entries())
        .filter(([, region]) => region.getFlag(MODULE_ID, kind === "long" ? REST_FLAGS.long : REST_FLAGS.short))
        .map(([name]) => name)
        .sort();
}

/** Mark or unmark a room. GM only. */
export async function setRestRoom(roomName, { short = null, long = null } = {}) {
    if (!game.user.isGM) return null;

    const region = regionsByName().get(roomName);
    if (!region) return null;

    const update = {};
    if (short !== null) update[`flags.${MODULE_ID}.${REST_FLAGS.short}`] = short;
    if (long !== null) update[`flags.${MODULE_ID}.${REST_FLAGS.long}`] = long;
    if (!Object.keys(update).length) return null;

    await region.update(update);
    return region;
}

/* ==========================================================================
 * HOW OFTEN
 * --------------------------------------------------------------------------
 * A short rest is once per time of day, a long rest once per session. Both are
 * recorded as the clock reading at the moment they were taken, so they expire on
 * their own when the clock moves rather than needing a reset pass.
 * ========================================================================== */

/** The stamp that identifies "this rest, in this window". */
function restStamp(kind, clock) {
    return kind === "long" ? `s${clock.session}` : `d${clock.day ?? 1}:${clock.timeOfDay}`;
}

function restsTaken(actor) {
    return actor?.getFlag(MODULE_ID, FLAGS.restsTaken) ?? {};
}

/**
 * Has this character already used up this kind of rest in the current window?
 * @returns {boolean}
 */
export function restSpent(actor, kind, clock = null) {
    const rules = REST[kind];
    if (!rules) return true;
    // A kind with no declared frequency is unlimited.
    if (!rules.perSession && !rules.perTimeOfDay) return false;

    const now = clock ?? currentClock();
    return restsTaken(actor)[kind] === restStamp(kind, now);
}

async function markRestTaken(actor, kind, clock) {
    const all = { ...restsTaken(actor), [kind]: restStamp(kind, clock) };
    await actor.setFlag(MODULE_ID, FLAGS.restsTaken, all);
}

/**
 * The clock, through the one function that owns what it says.
 *
 * This used to read the setting itself and, on any failure, hand back a clock it
 * had invented on the spot: day 1, session 1, morning. That is not a fallback,
 * it is a lie with consequences — a rest is stamped with the day it was taken,
 * and a rest stamped day 1 on day six is a Long Rest the character can either
 * never take again or take twice, depending on which way the comparison falls.
 *
 * `getClock` merges `DEFAULT_CLOCK` over whatever is stored, so the defaults are
 * declared once, in settings.mjs, beside the setting they belong to. There were
 * three copies of "what the clock says when we cannot read it" in this module
 * and two of them were written from memory.
 */
function currentClock() {
    return getClock();
}

/* ==========================================================================
 * RESTING
 * ========================================================================== */

/**
 * Take a rest.
 *
 * @param {Actor} actor
 * @param {"short"|"long"} kind
 * @param {object} [options]  All four are the Relief Hope Call and nothing else
 *   (E13). Each one SKIPS a gate rather than passing it: `takeRest` refuses with
 *   its own warning at three separate points, and a Call that "passed" them
 *   would show the player "you have already rested this time of day" and then
 *   hand their five Hope back — trap 99.
 * @param {boolean} [options.free]         costs no action
 * @param {boolean} [options.ignoreRoom]   no marked room required
 * @param {boolean} [options.ignoreLimit]  neither checks nor spends the once-per
 *   window allowance, so the ordinary Short Rest is still there afterwards
 * @param {boolean} [options.quiet]        no card of its own; the caller prints one
 */
export async function takeRest(actor, kind = "short", {
    free = false, ignoreRoom = false, ignoreLimit = false, quiet = false
} = {}) {
    try {
        const rules = REST[kind];
        if (!actor || !rules) return null;

        const clock = currentClock();
        if (!ignoreLimit && restSpent(actor, kind, clock)) {
            ui.notifications.warn(game.i18n.format(
                kind === "long" ? "DRPG.Rest.alreadyThisSession" : "DRPG.Rest.alreadyThisTimeOfDay",
                { kind: kindLabel(kind) }
            ));
            return null;
        }

        const room = roomOfActor(actor);
        if (!ignoreRoom && !roomAllows(room, kind)) {
            const allowed = restRooms(kind);
            ui.notifications.warn(allowed.length
                ? game.i18n.format("DRPG.Rest.wrongRoom", {
                    kind: kindLabel(kind),
                    room: room ?? "—",
                    rooms: allowed.join(", ")
                  })
                : game.i18n.format("DRPG.Rest.noRooms", { kind: kindLabel(kind) }));
            return null;
        }

        const cost = free ? 0 : rules.actionCost;
        if (cost > 0 && !canPayFor(actor, cost)) {
            ui.notifications.warn(plural("DRPG.Actions.notEnough", {
                actor: actor.name, left: actionsLeft(actor), needed: cost
            }, "left"));
            return null;
        }

        const picks = await choosePicks(kind, rules.picks);
        if (!picks) return null;

        if (cost > 0 && !await spendAction(actor, cost)) return null;

        // The benefits first, the "used up" stamp second. The other order meant
        // a failed write left the rest spent and nothing restored — and a long
        // rest is once per session, so that is a session's worth of recovery
        // gone to a database hiccup.
        const applied = await applyRest(actor, kind, picks);
        // Relief does not use the allowance up, which is half of what it buys:
        // the Short Rest this character had before it is still there.
        if (!ignoreLimit) await markRestTaken(actor, kind, clock);

        if (!quiet) {
            await whisperToOwner(actor, `${cardHead({ action: kindLabel(kind), room })}
                <ul>${applied.map(a => `<li>${foundry.utils.escapeHTML(a)}</li>`).join("")}</ul>`);
        }

        log(`${actor.name} took a ${kind} rest in ${room}: ${picks.join(", ")}`);
        Hooks.callAll("drpgRested", { actor, kind, picks, room });
        return { kind, picks, room, applied };
    } catch (err) {
        error("Rest failed", err);
        return null;
    }
}

/** Ask which benefits to take. A long rest takes two, a short one takes one. */
async function choosePicks(kind, count) {
    /*
     * THE COUNT IS ENFORCED IN THE WINDOW, NOT AFTER IT.
     *
     * A Short Rest takes one of the three and a Long Rest takes two, and the
     * window used to let you tick all three and find out on the way past: the
     * check below fired, warned, and closed the dialog, sending the player back
     * to the start of an action they had already paid for.
     *
     * ONE PICK IS A RADIO GROUP. Not a checkbox that un-ticks its neighbour —
     * a radio, because that is what a browser already knows how to be, and
     * because a player who has used a radio button before knows what it will do
     * before they touch it. Two picks stay checkboxes and are capped live, with
     * the confirm button shut until exactly two are on.
     *
     * The check after the button STAYS. It is the authority; this is the
     * interface agreeing with it in advance.
     */
    const single = count === 1;
    const options = Object.entries(REST.options)
        .map(([key, opt]) => `<label class="drpg-rest-option">
                <input type="${single ? "radio" : "checkbox"}" name="pick" value="${key}" />
                <span><strong>${opt.label}</strong> — ${kind === "long" ? opt.long : opt.short}</span>
            </label>`).join("");

    const picks = await DialogV2.wait({
        window: { title: kindLabel(kind) },
        classes: ["drpg-panel", "drpg-rest"],
        content: `<form>
            <p>${game.i18n.format("DRPG.Rest.choose", { n: count })}</p>
            ${options}
        </form>`,
        render: (event, dialog) => {
            const root = dialog?.element;
            if (!root) return;
            const boxes = Array.from(root.querySelectorAll("[name=pick]"));
            const confirm = root.querySelector('button[data-action="ok"]');
            const sync = () => {
                const on = boxes.filter(b => b.checked);
                // Cap, so the third tick cannot happen at all — a box that
                // refuses the click is clearer than one that accepts it and is
                // told off later. Radios cap themselves.
                if (!single) {
                    for (const b of boxes) b.disabled = !b.checked && on.length >= count;
                }
                if (confirm) confirm.disabled = on.length !== count;
            };
            for (const b of boxes) b.addEventListener("change", sync);
            sync();
        },
        buttons: [
            {
                action: "ok",
                label: game.i18n.localize("DRPG.Action.proceed"),
                default: true,
                callback: (e, b, d) => Array.from(d.element.querySelectorAll("[name=pick]:checked")).map(i => i.value)
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    if (!picks || picks === "cancel") return null;

    // The authority, and it should now be unreachable from the window above.
    // Kept because "should be unreachable" is not a guarantee: a template
    // change, a UI module rewrapping the dialog, or a render that never fired
    // would all quietly take the cap away and leave nothing behind it.
    if (picks.length !== count) {
        ui.notifications.warn(game.i18n.format("DRPG.Rest.pickExactly", { n: count }));
        return null;
    }
    return picks;
}

/**
 * Apply the chosen benefits.
 *
 * Health and Sanity are reverse resources — `value` counts marks upward — so
 * recovering means subtracting. A long rest clears the track; a short rest
 * clears half, rounded up in the character's favour.
 */
async function applyRest(actor, kind, picks) {
    const full = kind === "long";
    const update = {};
    const applied = [];

    for (const pick of picks) {
        const opt = REST.options[pick];

        if (pick === "sleep") {
            const marks = resourceValue(actor, "hitPoints");
            const healed = full ? marks : Math.ceil(marks / 2);
            update["system.resources.hitPoints.value"] = marks - healed;
            applied.push(`${opt.label}: ${healed} Health recovered`);
        }

        if (pick === "meal") {
            const marks = resourceValue(actor, "stress");
            const cleared = full ? marks : Math.ceil(marks / 2);
            update["system.resources.stress.value"] = marks - cleared;
            applied.push(`${opt.label}: ${cleared} Sanity cleared`);
        }

        if (pick === "breath") {
            const gain = full ? 2 : 1;
            const max = resourceMax(actor, "hope") || STARTING.hopeMax;
            const next = Math.min(max, resourceValue(actor, "hope") + gain);
            update["system.resources.hope.value"] = next;
            applied.push(`${opt.label}: +${gain} Hope`);
        }
    }

    // Marked as automation: none of these three paths are in `GUARDED` today,
    // so a plain `actor.update()` happens to work — but Rest is the one place
    // in the module that wrote resources without the marker, and the day any
    // of the three joins the guarded list this call silently starts failing for
    // players while every other resource change in the module keeps working.
    if (Object.keys(update).length) {
        const { automatedUpdate } = await import("./resource-guard.mjs");
        await automatedUpdate(actor, update);
    }
    return applied;
}

function kindLabel(kind) {
    return game.i18n.localize(kind === "long" ? "DRPG.Rest.long" : "DRPG.Rest.short");
}

/* ==========================================================================
 * GM: WHICH ROOMS ALLOW REST
 * ========================================================================== */

/**
 * Which rooms allow which rest — now a pair of columns in Room Setup.
 *
 * Kept as a function because it is on `game.drpg`, but it
 * no longer opens a window of its own: setting up a map means answering seven
 * questions per room, and asking two of them on a separate screen meant a GM
 * walking the same list of regions twice. See `openRoomSetupDialog` in
 * vault.mjs, which edits these two flags through `setRestRoom` above.
 */
export async function openRestRoomsDialog() {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return;
    }
    const { openRoomSetupDialog } = await import("./vault.mjs");
    return openRoomSetupDialog();
}
