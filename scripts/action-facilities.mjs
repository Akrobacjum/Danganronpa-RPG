/**
 * Danganronpa RPG - the Facilities tile's room actions, on the user's browser.
 * ---------------------------------------------------------------------------
 * E93 C3/C4 (12.11.2026; docs/dev/e93/SPEC.md). The Facilities window (action-rest.mjs `performRest`, the tile that was
 * Rest) lists the two rests and the room's actions; this file draws the room actions' rows (`facilityRows`) and carries
 * out the one picked (`useFacility`). Nothing is judged here that the primary GM does not judge again (facilities-gm.mjs
 * `handleFacilityUse`): the rows are greyed with their reasons so an honest player is not asked to pay for what will be
 * refused, and the price of a GM's action is paid here before its roll, as every rolled action's is.
 *
 * A GM'S ACTION: its price (FACILITIES.gmCost, the Toll's `by` more) paid, its roll thrown on the GM's statistic and
 * difficulty for this action (`actionKey` "facility", its context naming the action, which the GM's draw reads the
 * statistic from), then `facility.use` asked with the roll. A refusal that says nothing was carried out (the action
 * closed by somebody else in the meantime, or shut) gives the price back, as Analyze's key refusals do.
 * A PROJECT'S ACTION: no roll; `facility.use` asked, and the GM takes its price.
 *
 * THE WINDOW AND ITS TILE READ ONE LIST (fix line 113f, 13.11.2026). The owner's report at a table on 1.2.112: "The
 * Facilities action is struck through when there are no rests available in the room, even though a GM's room action or
 * a project's action is available." The tile (sheet-actions.mjs `roomBlockFor`) read rest.mjs's `restShutReason`, the two rests
 * alone, written before E93 put the room's actions in the window. Now the window's rows are `facilitiesRows` and the
 * tile's reason is `facilitiesShutReason`, which reads them: the tile is dimmed when every row is, and not otherwise.
 * For the tile to read them as the sheet draws, the rows are judged synchronously: the projects' through facilities.mjs
 * `projectActionsWith` on this file's static import of projects.mjs (`projectActionsAt` waits only on an `import()`),
 * the Overflow's word through overflow.mjs's own static readers. The sheet imports this file statically since.
 */

import { FACILITIES, TRAITS } from "./config.mjs";
import { esc, plural } from "./utils.mjs";
import { actionsLeft, canPayFor, spendAction, refundAction } from "./actions.mjs";
import { locateActor } from "./movement.mjs";
import {
    roomActions, projectActionsWith, closedNow, gmActionKey, facilityCost, facilityShut, PROJECT_PREFIX
} from "./facilities.mjs";
import { allProjects, standsAtProject, canSee } from "./projects.mjs";
import { overflowFacilityStates, overflowFacilityToll } from "./overflow.mjs";
import { restVariants } from "./rest.mjs";

/** The refusals after which nothing was carried out, so a GM's action's price comes back (`useFacility`). */
const NOTHING_DONE = new Set(["alreadyDone", "actionBlocked", "notThere"]);

/** The Overflow's word on room actions, read where it lives. */
function overflowNow() {
    return { states: overflowFacilityStates(), toll: overflowFacilityToll() };
}

/**
 * The room's actions as rows of the Facilities window (action-menus.mjs `chooseVariant`): the GM's first, then the
 * completed projects', each with its price, its source and, for a project's, its time left; greyed with the reason
 * where the Overflow shuts it, a GM's action is closed this time of day, or the actions do not cover the price. A
 * project's own per-person limit is the GM's to say: this browser does not hold who used what. Synchronous since fix
 * line 113f (the file's header): the sheet's tile reads these rows as it draws.
 */
export function facilityRows(actor) {
    const place = locateActor(actor);
    if (!place?.room || !place.scene) return [];
    const { states, toll } = overflowNow();
    const closed = closedNow();
    const left = actionsLeft(actor);
    const rows = [];
    const priced = (cost, hint) => `${plural("DRPG.Action.willCost", { n: cost, left })} · ${hint}`;
    for (const action of roomActions(place.scene, place.room)) {
        const cost = facilityCost("gm", null, toll);
        const shut = facilityShut("gm", states);
        const why = shut ? game.i18n.localize(`DRPG.Facility.shut.${shut}`)
            : closed.has(gmActionKey(place.scene.id, place.room, action.id)) ? game.i18n.localize("DRPG.Facility.closed")
                : !canPayFor(actor, cost) ? game.i18n.localize("DRPG.Facility.noActions") : null;
        rows.push({
            value: `gm:${action.id}`, icon: "fa-door-open", label: action.label,
            hint: priced(cost, game.i18n.format("DRPG.Facility.gmHint", {
                trait: TRAITS[action.trait]?.label ?? action.trait, dc: action.dc })),
            disabled: Boolean(why), why: why ?? ""
        });
    }
    for (const { project, facility, timesLeft } of projectActionsWith({ allProjects, standsAtProject, canSee }, place)) {
        const cost = facilityCost("project", facility, toll);
        const shut = facilityShut("project", states);
        const why = shut ? game.i18n.localize(`DRPG.Facility.shut.${shut}`)
            : cost > 0 && !canPayFor(actor, cost) ? game.i18n.localize("DRPG.Facility.noActions") : null;
        const life = timesLeft === null ? game.i18n.localize("DRPG.Facility.forGood")
            : plural("DRPG.Facility.timesLeft", { n: timesLeft });
        rows.push({
            value: `${PROJECT_PREFIX}${project.id}`, icon: "fa-screwdriver-wrench", label: facility.label,
            hint: priced(cost, game.i18n.format("DRPG.Facility.projectHint", { project: project.name, life })),
            disabled: Boolean(why), why: why ?? ""
        });
    }
    return rows;
}

/**
 * Every row of the Facilities window (action-rest.mjs `performRest`), in its order: the two rests (rest.mjs
 * `restVariants`), then the room's actions (`facilityRows`). The one list the window shows and the tile is judged on.
 */
export function facilitiesRows(actor) {
    return [...restVariants(actor), ...facilityRows(actor)];
}

/**
 * Why no row of the Facilities window can be taken now, row by row ("Short Rest: ... · Long Rest: ... · <action>: ..."),
 * or null while one can: the Facilities tile's tooltip (sheet-actions.mjs `roomBlockFor`). It was rest.mjs `restShutReason`, the
 * two rests alone (E16 part 2 C4, audit S02-26), until fix line 113f. The tile stays pressable, as every dimmed tile
 * does, and its window shows the same rows greyed.
 */
export function facilitiesShutReason(actor) {
    const rows = facilitiesRows(actor);
    if (rows.some(row => !row.disabled)) return null;
    return rows.map(row => `${row.label}: ${row.why}`).join(" · ");
}

/** Carry out the room action a Facilities row names (`gm:<id>` or `project:<id>`). Answers the GM's reply, or null. */
export async function useFacility(actor, value) {
    const { gmOnline, sayNotDone } = await import("./bridge-guards.mjs");
    if (!gmOnline()) {
        sayNotDone("facility.use", "noGm", { nothingSpent: true });
        return null;
    }
    const { requestFacilityUse } = await import("./bridge-asks.mjs");
    if (typeof value === "string" && value.startsWith(PROJECT_PREFIX)) {
        const res = await requestFacilityUse({ actorId: actor.id, actionId: value });
        return res.ok ? res.value ?? null : null;
    }
    const id = typeof value === "string" && value.startsWith("gm:") ? value.slice(3) : null;
    const place = locateActor(actor);
    const action = id ? roomActions(place?.scene, place?.room).find(row => row.id === id) : null;
    if (!action) return null;
    const { toll } = overflowNow();
    const cost = facilityCost("gm", null, toll);
    if (!canPayFor(actor, cost)) {
        ui.notifications.warn(game.i18n.localize("DRPG.Facility.noActions"));
        return null;
    }
    const receipt = await spendAction(actor, cost);
    if (!receipt) return null;
    const { rollTrait, rollInHand } = await import("./action-pipeline.mjs");
    const roll = await rollTrait(actor, action.trait, {
        actionKey: "facility", dc: action.dc, title: action.label, context: { facilityId: action.id }
    });
    if (!roll) {
        await refundAction(actor, cost, receipt);
        return null;
    }
    const res = await requestFacilityUse({
        actorId: actor.id, actionId: action.id, total: roll.total, isCritical: Boolean(roll.isCritical),
        rollId: rollInHand(actor)?.messageId ?? null
    });
    if (!res.ok && res.refused && NOTHING_DONE.has(res.reason)) await refundAction(actor, cost, receipt);
    return res.ok ? res.value ?? null : null;
}

/** The effects of an action as a line for the GM's editor and the handbook's examples: "Health 2, Hope 1 (those present)". */
export function effectsLine(effects) {
    return (effects ?? []).map(effect => {
        const name = game.i18n.localize(`DRPG.Facility.effect.${effect.kind}`);
        const n = FACILITIES.effects[effect.kind]?.text ? "" : ` ${effect.n}`;
        const scope = effect.scope && effect.scope !== "self" ? ` (${game.i18n.localize(`DRPG.Facility.scope.${effect.scope}`)})` : "";
        return `${esc(name)}${n}${scope}`;
    }).join(", ");
}
