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

import { MODULE_ID, REST, STARTING } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { actionsLeft, spendAction } from "./actions.mjs";
import { roomOfActor } from "./movement.mjs";
import { resourceMax, resourceValue } from "./character.mjs";
import { whisperToOwner, log, error } from "./utils.mjs";

const DialogV2 = foundry.applications.api.DialogV2;

/**
 * Flags set on a Scene Region.
 *
 * `dormitory` doubles as the guide's Vault: "surplus items are moved to the
 * player's room, from where they can be picked up without a roll". Every
 * player's room is the one dormitory region, so there is nothing per-player to
 * model — being in the dormitory is what grants access.
 */
export const REST_FLAGS = {
    short: "restShort",
    long: "restLong",
    dormitory: "dormitory"
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
export async function setRestRoom(roomName, { short = null, long = null, dormitory = null } = {}) {
    if (!game.user.isGM) return null;

    const region = regionsByName().get(roomName);
    if (!region) return null;

    const update = {};
    if (short !== null) update[`flags.${MODULE_ID}.${REST_FLAGS.short}`] = short;
    if (long !== null) update[`flags.${MODULE_ID}.${REST_FLAGS.long}`] = long;
    if (dormitory !== null) update[`flags.${MODULE_ID}.${REST_FLAGS.dormitory}`] = dormitory;
    if (!Object.keys(update).length) return null;

    await region.update(update);
    return region;
}

/** The dormitory region on this scene, if one is marked. */
export function dormitoryRoom() {
    for (const [name, region] of regionsByName()) {
        if (region.getFlag(MODULE_ID, REST_FLAGS.dormitory)) return name;
    }
    return null;
}

/**
 * Is this character in the dormitory — i.e. can they reach their stored items?
 * The guide's Vault is simply "your room", and every room is in the dormitory.
 */
export function canReachVault(actor) {
    const dorm = dormitoryRoom();
    return Boolean(dorm && roomOfActor(actor) === dorm);
}

/* ==========================================================================
 * RESTING
 * ========================================================================== */

/**
 * Take a rest.
 *
 * @param {Actor} actor
 * @param {"short"|"long"} kind
 */
export async function takeRest(actor, kind = "short") {
    try {
        const rules = REST[kind];
        if (!actor || !rules) return null;

        const room = roomOfActor(actor);
        if (!roomAllows(room, kind)) {
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

        const cost = rules.actionCost;
        if (actionsLeft(actor) < cost) {
            ui.notifications.warn(game.i18n.format("DRPG.Actions.notEnough", {
                actor: actor.name, left: actionsLeft(actor), needed: cost
            }));
            return null;
        }

        const picks = await choosePicks(kind, rules.picks);
        if (!picks) return null;

        await spendAction(actor, cost);
        const applied = await applyRest(actor, kind, picks);

        await whisperToOwner(actor, `<p><strong>${kindLabel(kind)}</strong> — ${foundry.utils.escapeHTML(room)}</p>
            <ul>${applied.map(a => `<li>${foundry.utils.escapeHTML(a)}</li>`).join("")}</ul>`);

        log(`${actor.name} took a ${kind} rest in ${room}: ${picks.join(", ")}`);
        Hooks.callAll("drpgRested", { actor, kind, picks, room });
        return { kind, picks, room };
    } catch (err) {
        error("Rest failed", err);
        return null;
    }
}

/** Ask which benefits to take. A long rest takes two, a short one takes one. */
async function choosePicks(kind, count) {
    const options = Object.entries(REST.options)
        .map(([key, opt]) => `<label class="drpg-rest-option">
                <input type="checkbox" name="pick" value="${key}" />
                <span><strong>${opt.label}</strong> — ${kind === "long" ? opt.long : opt.short}</span>
            </label>`).join("");

    const picks = await DialogV2.wait({
        window: { title: kindLabel(kind) },
        classes: ["drpg-panel", "drpg-rest"],
        content: `<form>
            <p>${game.i18n.format("DRPG.Rest.choose", { n: count })}</p>
            ${options}
        </form>`,
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

    if (picks.length !== count) {
        ui.notifications.warn(game.i18n.format("DRPG.Rest.pickExactly", { n: count }));
        return null;
    }
    return picks;
}

/**
 * Apply the chosen benefits.
 *
 * HP and Stress are reverse resources — `value` counts marks upward — so
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
            applied.push(`${opt.label}: ${healed} HP recovered`);
        }

        if (pick === "meal") {
            const marks = resourceValue(actor, "stress");
            const cleared = full ? marks : Math.ceil(marks / 2);
            update["system.resources.stress.value"] = marks - cleared;
            applied.push(`${opt.label}: ${cleared} Stress cleared`);
        }

        if (pick === "breath") {
            const gain = full ? 2 : 1;
            const max = resourceMax(actor, "hope") || STARTING.hopeMax;
            const next = Math.min(max, resourceValue(actor, "hope") + gain);
            update["system.resources.hope.value"] = next;
            applied.push(`${opt.label}: +${gain} Hope`);
        }
    }

    if (Object.keys(update).length) await actor.update(update);
    return applied;
}

function kindLabel(kind) {
    return game.i18n.localize(kind === "long" ? "DRPG.Rest.long" : "DRPG.Rest.short");
}

/* ==========================================================================
 * GM: WHICH ROOMS ALLOW REST
 * ========================================================================== */

/**
 * Flag rooms on the current scene. Per scene on purpose — the guide says the
 * pool of rest rooms "depends entirely on the map prepared for the season".
 */
export async function openRestRoomsDialog() {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return;
    }

    const regions = Array.from(regionsByName().entries());
    if (!regions.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Rest.noRegions"));
        return;
    }

    const rows = regions.map(([name, region]) => `
        <tr>
            <td>${foundry.utils.escapeHTML(name)}</td>
            <td style="text-align:center">
                <input type="checkbox" name="short.${foundry.utils.escapeHTML(name)}"
                       ${region.getFlag(MODULE_ID, REST_FLAGS.short) ? "checked" : ""} />
            </td>
            <td style="text-align:center">
                <input type="checkbox" name="long.${foundry.utils.escapeHTML(name)}"
                       ${region.getFlag(MODULE_ID, REST_FLAGS.long) ? "checked" : ""} />
            </td>
            <td style="text-align:center">
                <input type="checkbox" name="dorm.${foundry.utils.escapeHTML(name)}"
                       ${region.getFlag(MODULE_ID, REST_FLAGS.dormitory) ? "checked" : ""} />
            </td>
        </tr>`).join("");

    const result = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Rest.manageTitle") },
        classes: ["drpg-panel", "drpg-projects"],
        content: `<form>
            <p>${game.i18n.localize("DRPG.Rest.manageIntro")}</p>
            <table>
                <thead><tr>
                    <th>${game.i18n.localize("DRPG.Project.room")}</th>
                    <th>${game.i18n.localize("DRPG.Rest.shortColumn")}</th>
                    <th>${game.i18n.localize("DRPG.Rest.longColumn")}</th>
                    <th>${game.i18n.localize("DRPG.Rest.dormColumn")}</th>
                </tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </form>`,
        buttons: [
            {
                action: "save",
                label: game.i18n.localize("DRPG.Assign.save"),
                default: true,
                callback: (e, b, d) => {
                    const form = d.element.querySelector("form");
                    return regions.map(([name]) => ({
                        name,
                        short: form.querySelector(`[name="short.${CSS.escape(name)}"]`)?.checked ?? false,
                        long: form.querySelector(`[name="long.${CSS.escape(name)}"]`)?.checked ?? false,
                        dormitory: form.querySelector(`[name="dorm.${CSS.escape(name)}"]`)?.checked ?? false
                    }));
                }
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Panel.close") }
        ],
        rejectClose: false
    });

    if (!result || result === "cancel") return;

    for (const entry of result) {
        await setRestRoom(entry.name, {
            short: entry.short, long: entry.long, dormitory: entry.dormitory
        });
    }
    ui.notifications.info(game.i18n.localize("DRPG.Rest.saved"));
}
