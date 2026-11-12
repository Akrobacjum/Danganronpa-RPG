/**
 * Danganronpa RPG - Facilities, the GM's side: what a room action's use is judged by and carried out with, on the
 * primary GM.
 * ---------------------------------------------------------------------------
 * E93 C3 (12.11.2026; the owner's audit entry E93 (2), (3), (5), the 05.11 limits and the 08.11 switch;
 * docs/dev/e93/SPEC.md). A player's browser asks `facility.use` (bridge-wire.mjs `ACTION_FACILITY_USE`); its run is
 * bridge-runs-acts.mjs `handleFacilityUse`, as every run of the bridge's table lives in a runs file (R1239), and this file
 * holds what the run reaches into. Everything it judges is read on the GM, never off the packet:
 *
 *   - WHERE: the room the GMs hold the character in (movement.mjs `gmPlaceOf`), and the action looked up in that room
 *     alone - a GM's action on the room's own pieces (facilities.mjs `roomActions`), a project's among the completed
 *     projects standing there that the sender can see and whose lifetime runs (`projectActionsAt`).
 *   - WHETHER: the Despair Overflow's Lockdown and Power cut (`facilityShut`), and the limit, in the GMs' store
 *     (`facilityUseStore`): a GM's action closed for everyone once anyone used it this time of day, a failed roll
 *     too; a project's once per character. Judged and written in one step of the action's key (utils.mjs
 *     `serialWrite`), so two players at once cannot both take a GM's action.
 *   - THE ROLL: a GM's action's, named in the declaration's `rolled` (kind `facility`, its record naming this action),
 *     so the runner hands this the GMs' record of the total and the critical (bridge-guards.mjs `rollsFor`). A
 *     player's packet for a GM's action that names no roll is refused while the GMs draw rolls. A success is a
 *     critical or a total at the action's difficulty or above.
 *   - THE PRICE: a GM's action is paid on the roller's browser before its roll (the draw takes that payment's ticket,
 *     roll-draw.mjs `drawRefusal`); a project's action, which has no roll, is paid here, by this GM (`spendAction`):
 *     FACILITIES.projectCost or none as the project's switch says, and the Toll's `by` more.
 *   - WHAT IT DOES: each effect written by this GM (`applyEffects`), on the user or on those standing in the room at
 *     this moment (Q-E93-5's default), and a faint Subtle trace in the room for every use, a GM's action's and a project's (Q-E93-6, the owner 12.11.2026).
 *
 * What a console can still do, said here so that it is not mistaken for covered: the Toll's extra action on a GM's
 * action is paid by the roller's browser with the base one, and the draw's ticket proves one payment, not its size
 * (roll-draw.mjs: a ticket is one write) - a console that pays one action under Toll rolls all the same. Watched, not
 * caught: docs/dev/e93/STATUS.md.
 */

import { MODULE_ID, FACILITIES, STARTING } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { serialWrite, whisperToOwner, log, esc, plural } from "./utils.mjs";
import { roomActions, projectActionsAt, gmActionKey, projectActionKey, PROJECT_PREFIX } from "./facilities.mjs";

/**
 * The action `actionId` names where the GMs hold `actor`, for `sender`, or null: `{ source, key, label, action?,
 * facility?, project? }` - `source` "gm" or "project", `key` its row in the GMs' store.
 */
export async function offerAt(actor, place, actionId, sender) {
    if (!place?.room || !place.scene || typeof actionId !== "string") return null;
    if (actionId.startsWith(PROJECT_PREFIX)) {
        const projectId = actionId.slice(PROJECT_PREFIX.length);
        const found = (await projectActionsAt(place, sender)).find(row => row.project.id === projectId);
        return found ? { source: "project", key: projectActionKey(projectId, actor.id), label: found.facility.label,
            facility: found.facility, project: found.project } : null;
    }
    const action = roomActions(place.scene, place.room).find(row => row.id === actionId);
    return action ? { source: "gm", key: gmActionKey(place.scene.id, place.room, action.id), label: action.label, action } : null;
}

/** The Overflow's word on room actions now, read where it lives (overflow.mjs). */
export async function overflowNow() {
    const { overflowFacilityStates, overflowFacilityToll } = await import("./overflow.mjs");
    return { states: overflowFacilityStates(), toll: overflowFacilityToll() };
}

/**
 * Close a GM's action for everyone until the next time of day: its key in the public `facilityClosed`, the keys of
 * another mark dropped. In a step of the setting, on the GM that served the use.
 */
export async function closeForAll(key, mark) {
    return serialWrite(`${MODULE_ID}.${SETTINGS.facilityClosed}`, async () => {
        const stored = game.settings.get(MODULE_ID, SETTINGS.facilityClosed) ?? {};
        const keys = stored.mark === mark && Array.isArray(stored.keys) ? stored.keys : [];
        if (keys.includes(key)) return;
        await game.settings.set(MODULE_ID, SETTINGS.facilityClosed, { mark, keys: [...keys, key] });
    });
}

/** Who an effect falls on: the user, everyone in the room now, or everyone there but the user (characters only). */
async function targetsOf(actor, scope, place) {
    if (scope === "self") return [actor];
    const { occupantsOf } = await import("./movement.mjs");
    const others = occupantsOf(place.room, actor, place.scene).filter(a => a?.type === "character");
    return scope === "others" ? others : [actor, ...others];
}

/**
 * Carry out an action's effects on this GM, each in its own write; answers the lines its card says, in the table's
 * language. A write a GM makes is judged by nothing (resource-guard.mjs: a GM's write names no reason a judge reads);
 * the reason `facility` says on the GMs' own side which road it was.
 */
export async function applyEffects(actor, effects, place, sender = null) {
    const { trustedWrite } = await import("./resource-guard.mjs");
    const lines = [];
    // Health, Sanity and Hope count what moved, so they are plural families on {n} (R1157); the rest are sentences.
    const t = (key, data) => (game.i18n.has(`DRPG.Facility.applied.${key}.other`)
        ? plural(`DRPG.Facility.applied.${key}`, data) : game.i18n.format(`DRPG.Facility.applied.${key}`, data));
    for (const effect of effects ?? []) {
        const rule = FACILITIES.effects[effect.kind];
        if (!rule) continue;
        if (effect.kind === "overflowDown") {
            const { takeOverflow } = await import("./overflow.mjs");
            const took = await takeOverflow(effect.n, { reason: "a room action" });
            lines.push(t("overflowDown", { n: Number(took) || 0 }));
            continue;
        }
        if (effect.kind === "searchToken") {
            const { SearchTokens } = await import("./search-tokens.mjs");
            for (let i = 0; i < effect.n; i++) await SearchTokens.giveBack(place.room, place.scene.id);
            lines.push(t("searchToken", { n: effect.n, room: place.room }));
            continue;
        }
        for (const target of await targetsOf(actor, effect.scope, place)) {
            const name = target.name;
            const r = target.system?.resources ?? {};
            if (effect.kind === "health" || effect.kind === "sanity") {
                const path = effect.kind === "health" ? "hitPoints" : "stress";
                const marks = Number(r[path]?.value) || 0, cleared = Math.min(marks, effect.n);
                if (cleared) await trustedWrite(target, { [`system.resources.${path}.value`]: marks - cleared }, { reason: "facility" });
                lines.push(t(effect.kind, { name, n: cleared }));
            } else if (effect.kind === "hope") {
                const { overflowBlocksHope } = await import("./overflow.mjs");
                if (overflowBlocksHope()) { lines.push(t("hopeBlocked", { name })); continue; }
                const now = Number(r.hope?.value) || 0, max = Number(r.hope?.max) || STARTING.hopeMax;
                const next = Math.min(max, now + effect.n);
                if (next !== now) await trustedWrite(target, { "system.resources.hope.value": next }, { reason: "facility" });
                lines.push(t("hope", { name, n: next - now }));
            } else if (effect.kind === "freeMove") {
                const { grantFreeMoves } = await import("./actions.mjs");
                await grantFreeMoves(target, effect.n, { reason: "facility" });
                lines.push(t("freeMove", { name, n: effect.n }));
            } else if (effect.kind === "text") {
                await whisperToOwner(target, `<p>${esc(effect.text)}</p>`);
                lines.push(t("text", { name }));
            } else if (rule.state) {
                // A state ended (the owner's answer to Q-E93-3): one mark off its full track; the primary's hook on the
                // write takes the status off (states.mjs `syncStates`).
                const { STATES } = await import("./config.mjs");
                const { stateHeld } = await import("./states.mjs");
                const state = STATES[rule.state], path = state?.resource;
                const marks = Number(r[path]?.value) || 0;
                if (state && stateHeld(target, state) && marks > 0) {
                    await trustedWrite(target, { [`system.resources.${path}.value`]: marks - 1 }, { reason: "facility" });
                    lines.push(game.i18n.format("DRPG.Facility.applied.stateEnded", { name, state: game.i18n.localize(`DRPG.Facility.state.${rule.state}`) }));
                } else {
                    lines.push(game.i18n.format("DRPG.Facility.applied.stateNotHeld", { name, state: game.i18n.localize(`DRPG.Facility.state.${rule.state}`) }));
                }
            } else if (effect.kind === "durability") {
                const { mendWear } = await import("./inventory.mjs");
                const mended = await mendWear(target, effect.n);
                lines.push(mended ? t("durability", { name, item: mended.name, n: mended.back }) : t("durabilityNone", { name }));
            } else if (effect.kind === "advantage") {
                // A Call of advantage the GM arms on the character (the owner's answer to Q-E93-3): the roll window counts it,
                // the GM's draw applies it off the list the GMs hold, the roll spends it, the sheet lists it.
                const { appendArmedCall } = await import("./call-effects.mjs");
                if (await appendArmedCall(target, { key: "facility", kind: "hope", grants: "advantage", nonce: foundry.utils.randomID(16) })) {
                    lines.push(t("advantage", { name }));
                }
            }
            // A timed effect (the owner's answer to Q-E93-3, 12.11.2026): given and kept by this GM until its end.
            if (rule.untils) {
                const { giveTimed, timedLine } = await import("./timed-effects.mjs");
                if (await giveTimed(target, effect)) lines.push(game.i18n.format("DRPG.Facility.applied.timed", { name, what: timedLine(effect) }));
            }
        }
    }
    return lines;
}

/** A room action's use leaves a trace in its room, a GM's action's and a project's (Q-E93-6, the owner 12.11.2026: faint, Subtle), placed by this GM. */
export async function leaveTrace(actor, label) {
    try {
        const { dropRemnant } = await import("./remnants.mjs");
        await dropRemnant(actor, { ...FACILITIES.trace, note: game.i18n.format("DRPG.Facility.traceNote", { action: label }), action: "facility" });
    } catch (err) {
        log(`The room action's trace could not be placed: ${err?.message ?? err}`);
    }
}

/** The user's card: what was used, whether it worked, and what it did. */
export async function tellUse(actor, offer, success, lines) {
    const head = game.i18n.format(success ? "DRPG.Facility.usedOk" : "DRPG.Facility.usedFailed", { action: esc(offer.label) });
    await whisperToOwner(actor, `<p><strong>${head}</strong></p>${lines.length ? `<ul>${lines.map(line => `<li>${esc(line)}</li>`).join("")}</ul>` : ""}`);
}
