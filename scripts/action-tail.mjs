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
import { tipAttr } from "./ui-kit.mjs";
import { nameAsSeen, seenHere } from "./mask-gm.mjs";

/** Whom this character may tail from here, as this browser sees the room: students on tokens it can see, no Monocub or Monokuma. */
export function tailTargets(actor) {
    // a veiled killer this browser does not draw is not one (mask-gm.mjs `seenHere`, 1.2.119)
    return seenHere(othersInRoom(actor)).filter(a => a?.type === "character" && !isMonokuma(a) && !a.getFlag(MODULE_ID, FLAGS.monocub));
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
    /* THE LIST FOLLOWS THE ROOM (the audit's REFR-20, 1.2.122). The targets were read once, at the window's opening: a
       student who walked out stood on the list, one who walked in was not on it. The select is rebuilt from
       `tailTargets` on every token write (live.mjs `keepLive`). */
    const whoSelect = list => `<span class="drpg-tail-who"><select name="who"${tipAttr("DRPG.Tips.Sweep.Actions.tailWhoTooltip")}>${list
        .map(a => `<option value="${a.id}">${esc(nameAsSeen(a))}</option>`).join("")}</select></span>`;
    const picked = options.target ? { targetId: options.target, proposed: traits.includes(options.proposed) ? options.proposed : null, note: "" }
        : await actionWindow({
            title: label,
            classes: ["drpg-panel"],
            brief: briefingBlock(actor, "tail", { label, cost, description: game.i18n.localize("DRPG.Infiltrate.row.tail.hint") }),
            ask: `<form>
                <p>${esc(game.i18n.format("DRPG.Infiltrate.tail.prompt", { n: rule.unseen.threshold }))}</p>
                <label>${esc(game.i18n.localize("DRPG.Infiltrate.tail.who"))}
                    ${whoSelect(targets)}</label>
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
            rejectClose: false,
            live: {
                region: ".drpg-tail-who",
                // The student picked is carried by the rebuild (live.mjs `capture`, a changed select); one who left is
                // carried too and so picks nothing, and Roll says they are gone.
                build: () => whoSelect(tailTargets(actor)),
                watch: { tokens: true }
            }
        });
    if (!picked || picked === "cancel") return null;
    // The list as the room holds it now (the select may name a student who came in after the window opened).
    const target = tailTargets(actor).find(a => a.id === picked.targetId) ?? null;
    if (!target) {
        const was = targets.find(a => a.id === picked.targetId);
        if (was) ui.notifications.warn(game.i18n.format("DRPG.Infiltrate.tail.gone", { name: nameAsSeen(was) }));
        return null;
    }

    // The effect's statistic: the player proposes, a GM picks (E68's card); nothing is paid before the answer.
    const { traitFor } = await import("./trait-ruling.mjs");
    const ruled = await traitFor(actor, { kind: "generic", key: "tail" }, { proposed: picked.proposed ?? null, note: picked.note ?? "" });
    if (!ruled?.trait) return null;

    /* THE TARGET HELD TO THE ROOM AGAIN BEFORE THE PRICE (the audit's REFR-20, 1.2.122). The list was read before the
       window and the GM's statistic card, which can wait on a person; a target who walked out meanwhile was refused by
       the primary only after the action was paid and both rolls thrown. Read again here, as this browser sees the room:
       one gone is said, and nothing is paid. */
    if (!tailTargets(actor).some(a => a.id === target.id)) {
        ui.notifications.warn(game.i18n.format("DRPG.Infiltrate.tail.gone", { name: nameAsSeen(target) }));
        return null;
    }
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
    /* A TARGET WHO LEFT AFTER THE LAST LOOK COSTS NOTHING EITHER (the audit's REFR-20, 1.2.122). Between the look above
       and the GMs' reading of the room go two drawn rolls; a target who walked out then was refused there ("notThere")
       and the action was lost. That refusal alone gives it back, as the look above would have kept it: the receipt
       `spendAction` handed back, judged on the primary against the payment it saw (sheet-audit.mjs, a refund's credit),
       so a free Tail gives nothing back. The rolls stand as thrown. Any other refusal keeps the action spent, as a roll
       that landed does (`spentAfterRoll`, ROLL-05). */
    if (!res.ok && res.refused && res.reason === "notThere") {
        await abort(actor, paid);
        if (paid) ui.notifications.info(game.i18n.format("DRPG.Infiltrate.tail.actionBack", { name: nameAsSeen(target) }));
        return null;
    }
    if (!res.ok || res.value?.refused) return null;
    const seen = res.value?.seen === true;
    // The roller's result: E49's card under the Infiltrate tile's glyph (the coordinator's rule of 12.11.2026), its words as before.
    await whisperToOwner(actor, { glyph: "ACTIONS.listen", body: `<p>${esc(game.i18n.format(seen ? "DRPG.Infiltrate.tail.startedSeen" : "DRPG.Infiltrate.tail.started", { name: target.name }))}</p>` });
    Hooks.callAll("drpgActionResolved", { actor, actionKey: "tail", roll, outcome: { success: true, seen, target: target.name } });
    return { seen, target: target.name, roll };
}
