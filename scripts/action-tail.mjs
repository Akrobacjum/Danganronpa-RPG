/**
 * Danganronpa RPG - Tail Someone, the player's half.
 * ---------------------------------------------------------------------------
 * E69 C3 (12.11.2026; the owner's audit entry E69, DA8, DA19, DA21, DA32; config.mjs `INFILTRATE.tail`). A row of the
 * Infiltrate tile (action-listen.mjs `performListen` dispatches here). The window asks whom to tail - a student standing
 * in the room - and proposes the effect's statistic, Leg or Shadow, with a sentence of how (E68's proposal field); a GM
 * picks on E68's card (trait-ruling.mjs `traitFor`, the generic `tail`). Then one action is paid and two rolls thrown,
 * both drawn on the primary GM: Shadow against `unseen.threshold`, whether the target notices (`tailUnseen`), and the
 * effect on the statistic the GM picked (`tail`). The bridge road `tail.start` reads both off the GMs' record and begins
 * the tail there (tail-gm.mjs `startTail`); the cards come from the GM as the target crosses. With no GM connected
 * nothing is paid.
 */

import { INFILTRATE, MODULE_ID, FLAGS } from "./config.mjs";
import { spendAction } from "./actions.mjs";
import { othersInRoom } from "./movement.mjs";
import { whisperToOwner, esc } from "./utils.mjs";
import { rollTrait, rollInHand, abort, spentAfterRoll, canAfford } from "./action-pipeline.mjs";
import { briefingBlock } from "./action-briefing.mjs";
import { actionWindow, traitFieldHtml, readProposal } from "./action-menus.mjs";
import { isMonokuma } from "./monokuma.mjs";

/** Whom this character may tail from here, as this browser sees the room: students on tokens it can see, no Monocub or Monokuma. */
export function tailTargets(actor) {
    return othersInRoom(actor).filter(a => a?.type === "character" && !isMonokuma(a) && !a.getFlag(MODULE_ID, FLAGS.monocub));
}

/** Tail Someone: the window, the GM's pick, the action, the two rolls, the ask. Answers `{ seen, target }` or null. */
export async function performTail(actor, options = {}) {
    const { gmOnline, sayNotDone } = await import("./bridge-guards.mjs");
    if (!gmOnline()) {
        sayNotDone("tail.start", "noGm", { nothingSpent: true });
        return null;
    }
    const rule = INFILTRATE.tail;
    const label = game.i18n.localize("DRPG.Infiltrate.row.tail.label");
    const cost = options.free ? 0 : rule.cost;
    if (!canAfford(actor, cost)) return null;
    const targets = tailTargets(actor);
    if (!targets.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Infiltrate.tail.nobody"));
        return null;
    }
    const traits = [...rule.traits];
    const picked = options.target ? { targetId: options.target, proposed: traits.includes(options.proposed) ? options.proposed : null, note: "" }
        : await actionWindow({
            title: label,
            classes: ["drpg-panel"],
            brief: briefingBlock(actor, "tail", { label, cost, description: game.i18n.localize("DRPG.Infiltrate.row.tail.hint") }),
            ask: `<form>
                <p>${esc(game.i18n.format("DRPG.Infiltrate.tail.prompt", { n: rule.unseen.threshold }))}</p>
                <label>${esc(game.i18n.localize("DRPG.Infiltrate.tail.who"))}
                    <select name="who">${targets.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join("")}</select></label>
                ${traitFieldHtml(actor, traits, { propose: true })}
            </form>`,
            footer: {
                primary: {
                    // Roll, as Search's (E100 item 6's one word per kind, R4105; e93's Tail met it in the r112 merge, 13.11.2026).
                    action: "ok", label: game.i18n.localize("DRPG.Action.roll"),
                    callback: (e, b, d) => ({ targetId: d.element.querySelector("[name=who]")?.value ?? null, ...readProposal(d.element, traits) })
                },
                close: "cancel"
            },
            rejectClose: false
        });
    if (!picked || picked === "cancel") return null;
    const target = targets.find(a => a.id === picked.targetId) ?? null;
    if (!target) return null;

    // The effect's statistic: the player proposes, a GM picks (E68's card); nothing is paid before the answer.
    const { traitFor } = await import("./trait-ruling.mjs");
    const ruled = await traitFor(actor, { kind: "generic", key: "tail" }, { proposed: picked.proposed ?? null, note: picked.note ?? "" });
    if (!ruled?.trait) return null;

    const paid = cost > 0 ? await spendAction(actor, cost) : null;
    if (cost > 0 && !paid) return null;
    // Whether the target notices: a supporting roll, nothing remembers it (as a Palm's cover).
    const shadow = await rollTrait(actor, rule.unseen.trait, {
        remember: false, actionKey: "tailUnseen", title: game.i18n.localize("DRPG.Infiltrate.tail.unseenTitle"), dc: rule.unseen.threshold
    });
    if (!shadow) return abort(actor, paid);
    const roll = await rollTrait(actor, ruled.trait, { actionKey: "tail", title: label, byGm: ruled.byGm, context: { targetId: target.id } });
    // The Shadow roll has landed and paid out; closing this window does not hand the action back (as a Palm's).
    if (!roll) return spentAfterRoll(actor, { label });

    const { requestTailStart } = await import("./bridge-asks.mjs");
    const res = await requestTailStart({
        tailerId: actor.id, targetId: target.id, total: roll.total, isCritical: Boolean(roll.isCritical),
        unseenTotal: shadow.total, unseenCritical: Boolean(shadow.isCritical),
        rollId: rollInHand(actor)?.messageId ?? null, unseenRollId: shadow.raw?.message?.id ?? shadow.raw?.message?._id ?? null
    });
    if (!res.ok || res.value?.refused) return null;
    const seen = res.value?.seen === true;
    // The roller's result: E49's card under the Infiltrate tile's glyph (the coordinator's rule of 12.11.2026), its words as before.
    await whisperToOwner(actor, { glyph: "ACTIONS.listen", body: `<p>${esc(game.i18n.format(seen ? "DRPG.Infiltrate.tail.startedSeen" : "DRPG.Infiltrate.tail.started", { name: target.name }))}</p>` });
    Hooks.callAll("drpgActionResolved", { actor, actionKey: "tail", roll, outcome: { success: true, seen, target: target.name } });
    return { seen, target: target.name, roll };
}
