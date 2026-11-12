/**
 * Danganronpa RPG - Keep Watch, the player's half.
 * ---------------------------------------------------------------------------
 * E74 C6 (12.11.2026; the owner's audit entry E74, DA34; config.mjs `INFILTRATE.keepWatch`; Q-E74-3's default: a file of
 * its own beside action-doors.mjs). A row of the Infiltrate tile (action-listen.mjs `performListen` dispatches here),
 * struck through in an Eclipse and before the Night Eclipse (`watchShutWhy`). One action paid, a Body roll drawn on the
 * primary GM, then `watch.declare`: the GM keeps the watch, and its cards come from the GM through the Eclipse
 * (watch-gm.mjs). With no GM connected nothing is paid.
 */

import { INFILTRATE } from "./config.mjs";
import { spendAction } from "./actions.mjs";
import { getClock, incomingTimeOfDay, isEclipse } from "./settings.mjs";
import { whisperToOwner, esc } from "./utils.mjs";
import { rollTrait, rollInHand, abort, canAfford } from "./action-pipeline.mjs";

/** Why the Keep Watch row is shut now, as this browser reads the clock, or null: an Eclipse running, or the Night one next. */
export function watchShutWhy(clock = getClock()) {
    if (isEclipse()) return game.i18n.localize("DRPG.Infiltrate.watch.notInEclipse");
    if (incomingTimeOfDay(clock) === "night") return game.i18n.localize("DRPG.Infiltrate.watch.notAtNight");
    return null;
}

/** Keep Watch: the action, the Body roll, the ask. Answers `{ kept, roll }` or null. */
export async function performWatch(actor, options = {}) {
    const { gmOnline, sayNotDone } = await import("./bridge-guards.mjs");
    if (!gmOnline()) {
        sayNotDone("watch.declare", "noGm", { nothingSpent: true });
        return null;
    }
    const why = watchShutWhy();
    if (why) {
        ui.notifications.warn(why);
        return null;
    }
    const rule = INFILTRATE.keepWatch;
    const cost = options.free ? 0 : rule.cost;
    if (!canAfford(actor, cost)) return null;
    const paid = cost > 0 ? await spendAction(actor, cost) : null;
    if (cost > 0 && !paid) return null;
    const roll = await rollTrait(actor, rule.traits[0], { actionKey: "keepWatch", title: game.i18n.localize("DRPG.Infiltrate.row.keepWatch.label"), dc: rule.dc });
    if (!roll) return abort(actor, paid);
    const { requestWatchDeclare } = await import("./bridge-asks.mjs");
    const res = await requestWatchDeclare({ actorId: actor.id, total: roll.total, isCritical: Boolean(roll.isCritical),
        rollId: rollInHand(actor)?.messageId ?? null });
    if (!res.ok || res.value?.refused) return null;
    const kept = res.value?.kept === true;
    await whisperToOwner(actor, `<p>${esc(game.i18n.localize(kept ? "DRPG.Infiltrate.watch.kept" : "DRPG.Infiltrate.watch.notKept"))}</p>`);
    return { kept, roll };
}
