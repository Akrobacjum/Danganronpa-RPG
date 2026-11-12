/**
 * Danganronpa RPG - the doors of the Infiltrate tile, the player's half: Shut the Door.
 * ---------------------------------------------------------------------------
 * E74 C2 (12.11.2026; the owner's audit entry E74, DA25; config.mjs `INFILTRATE.shut`). A row of the Infiltrate tile
 * (action-listen.mjs `performListen` dispatches here). One action paid, a Body roll drawn on the primary GM, then
 * `door.shut`: the GM judges the room and keeps the barricade, its strength the roll's total off its own record
 * (doors-gm.mjs `shutDoor`). With no GM connected nothing is paid. Force the Door, Pick the Lock and Keep Watch come in
 * later commits (docs/dev/e74/STATUS.md).
 */

import { INFILTRATE } from "./config.mjs";
import { spendAction } from "./actions.mjs";
import { whisperToOwner, esc } from "./utils.mjs";
import { rollTrait, rollInHand, abort, canAfford } from "./action-pipeline.mjs";

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
