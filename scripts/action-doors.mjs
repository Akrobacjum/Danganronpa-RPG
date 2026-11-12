/**
 * Danganronpa RPG - the doors of the Infiltrate tile, the player's half: Shut the Door.
 * ---------------------------------------------------------------------------
 * E74 C2 (12.11.2026; the owner's audit entry E74, DA25; config.mjs `INFILTRATE.shut`). A row of the Infiltrate tile
 * (action-listen.mjs `performListen` dispatches here). One action paid, a Body roll drawn on the primary GM, then
 * `door.shut`: the GM judges the room and keeps the barricade, its strength the roll's total off its own record
 * (doors-gm.mjs `shutDoor`). With no GM connected nothing is paid.
 *
 * Force the Door (E74 C3; `INFILTRATE.force`): the door picked among the rooms next to this one, named as Listen names
 * them (a room never entered is "Unexplored room n"), one action, a Body roll drawn on the GM, then `door.force`, which
 * reads what holds the door on the GM (doors-gm.mjs `forceDoor`). Pick the Lock and Keep Watch come in later commits
 * (docs/dev/e74/STATUS.md).
 */

import { INFILTRATE } from "./config.mjs";
import { spendAction } from "./actions.mjs";
import { whisperToOwner, esc } from "./utils.mjs";
import { rollTrait, rollInHand, abort, canAfford } from "./action-pipeline.mjs";
import { locateActor, roomOfActor, neighbouringRooms, roomsKnownToMe } from "./movement.mjs";
import { listenLabels } from "./action-listen.mjs";
import { actionWindow } from "./action-menus.mjs";

/** Shut the Door: the action, the Body roll, the ask. Answers `{ room, roll }` or null. */
export async function performShut(actor, options = {}) {
    const { gmOnline, sayNotDone } = await import("./bridge-guards.mjs");
    if (!gmOnline()) {
        sayNotDone("door.shut", "noGm", { nothingSpent: true });
        return null;
    }
    const rule = INFILTRATE.shut;
    const cost = options.free ? 0 : rule.cost;
    if (!canAfford(actor, cost)) return null;
    const paid = cost > 0 ? await spendAction(actor, cost) : null;
    if (cost > 0 && !paid) return null;
    const roll = await rollTrait(actor, rule.traits[0], { actionKey: "shut", title: game.i18n.localize("DRPG.Infiltrate.row.shut.label") });
    if (!roll) return abort(actor, paid);
    const { requestDoorShut } = await import("./bridge-asks.mjs");
    const res = await requestDoorShut({ actorId: actor.id, total: roll.total, rollId: rollInHand(actor)?.messageId ?? null });
    if (!res.ok || res.value?.refused) return null;
    const room = res.value?.room ?? "";
    await whisperToOwner(actor, `<p>${esc(game.i18n.format("DRPG.Infiltrate.shut.done", { room }))}</p>`);
    return { room, roll };
}

/** Force the Door: the door, the action, the Body roll, the ask. Answers `{ forced, held, room, roll }` or null. */
export async function performForce(actor, options = {}) {
    const { gmOnline, sayNotDone } = await import("./bridge-guards.mjs");
    if (!gmOnline()) {
        sayNotDone("door.force", "noGm", { nothingSpent: true });
        return null;
    }
    const rule = INFILTRATE.force;
    const label = game.i18n.localize("DRPG.Infiltrate.row.force.label");
    const cost = options.free ? 0 : rule.cost;
    if (!canAfford(actor, cost)) return null;
    const here = roomOfActor(actor);
    const scene = locateActor(actor)?.scene ?? null;
    const doors = neighbouringRooms(scene, here);
    if (!doors.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Listen.noNeighbours"));
        return null;
    }
    const labelOf = listenLabels(doors, roomsKnownToMe(scene));
    const room = options.room ? (doors.includes(options.room) ? options.room : null) : await actionWindow({
        title: label,
        classes: ["drpg-panel"],
        ask: `<form>
            <p>${esc(game.i18n.format("DRPG.Infiltrate.force.prompt", { room: here ?? "-", n: rule.lockDc }))}</p>
            <label>${esc(game.i18n.localize("DRPG.Infiltrate.force.which"))}
                <select name="room">${doors.map((r, i) => `<option value="${i}">${esc(labelOf.get(r))}</option>`).join("")}</select></label>
        </form>`,
        footer: {
            primary: { action: "ok", label: game.i18n.localize("DRPG.Action.roll"),
                callback: (e, b, d) => doors[Number(d.element.querySelector("[name=room]").value)] ?? null },
            close: "cancel"
        },
        rejectClose: false
    });
    if (!room || room === "cancel") return null;
    const paid = cost > 0 ? await spendAction(actor, cost) : null;
    if (cost > 0 && !paid) return null;
    const roll = await rollTrait(actor, rule.traits[0], { actionKey: "force", title: label, dc: rule.lockDc, context: { room } });
    if (!roll) return abort(actor, paid);
    const { requestDoorForce } = await import("./bridge-asks.mjs");
    const res = await requestDoorForce({ actorId: actor.id, room, total: roll.total, isCritical: Boolean(roll.isCritical),
        withHope: Boolean(roll.withHope), rollId: rollInHand(actor)?.messageId ?? null });
    if (!res.ok || res.value?.refused) return null;
    const forced = res.value?.forced === true;
    const held = Array.isArray(res.value?.held) ? res.value.held : [];
    const shown = labelOf.get(room) ?? room;
    const key = forced ? "forced" : held.length ? "held" : "open";
    await whisperToOwner(actor, `<p>${esc(game.i18n.format(`DRPG.Infiltrate.force.${key}`, { room: shown }))}</p>`);
    return { forced, held, room, roll };
}
