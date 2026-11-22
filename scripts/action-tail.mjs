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
import { rollTrait, rollInHand, abort, spentAfterRoll, canAfford, dualityOf } from "./action-pipeline.mjs";
import { rollHead, rollCardFlags } from "./action-report.mjs";
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

/** Whether any of `rolls` (`rollTrait`'s results) came up with Hope or a critical (`dualityOf`): the rolls that earn the roller Hope (r122-F-2). Pure. */
export function rollsEarnedHope(rolls) {
    return (rolls ?? []).some(r => { const d = dualityOf(r); return Boolean(d.withHope || d.isCritical); });
}

/**
 * The tailer's card (1.2.124; the owner, 22.11.2026: a centred action card says "wynik rzutu vs threshold oraz efekt"):
 * first the Shadow roll, whether the target notices - its head with "needed N" (the threshold the window named,
 * `rollTrait`'s `dc`) and its dice (`rollHead`) - then the effect roll's head and dice, then the sentence. Noticed, it is
 * a failed Shadow in the middle of the roller's screen (notice-centre.mjs "failedShadow"), else an action's result.
 * Answers `[spec, flags]` for `whisperToOwner`. Until 1.2.124 the card said the sentence alone.
 */
export function tailCard(label, roll, shadow, seen, name) {
    const flags = rollCardFlags({ label }, roll);
    flags.flags[MODULE_ID].popupCentre = seen ? "failedShadow" : "actionResult";
    return [{ glyph: "ACTIONS.listen", body: `${rollHead({ label: game.i18n.localize("DRPG.Infiltrate.tail.unseenTitle") }, shadow)}${
        rollHead({ label }, roll)}<p>${esc(game.i18n.format(seen ? "DRPG.Infiltrate.tail.startedSeen" : "DRPG.Infiltrate.tail.started", { name }))}</p>` }, flags];
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
    /* WHOM THE PLAYER PICKED, KEPT BESIDE THE SELECT (the audit's r122-F-3, 1.2.123). A rebuild carries a changed select's
       value (live.mjs `restore`, `node.value = was.value`); with that student's option gone the select holds none and Roll
       sent "", so the window closed with no word, against the note below. The last student picked is kept here as they
       are picked (the first listed at the opening), and Roll with that student gone - or the list emptied - says so. */
    let lastPicked = targets[0]?.id ?? null;
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
            render: (event, dialog) => dialog.element?.addEventListener("change", e => {
                if (e.target?.name === "who" && e.target.value) lastPicked = e.target.value;
            }),
            live: {
                region: ".drpg-tail-who",
                // The student picked is carried by the rebuild (live.mjs `capture`, a changed select); one who left is
                // carried too and so picks nothing, and Roll says they are gone (`lastPicked`).
                build: () => whoSelect(tailTargets(actor)),
                watch: { tokens: true }
            }
        });
    if (!picked || picked === "cancel") return null;
    // The list as the room holds it now (the select may name a student who came in after the window opened).
    const target = tailTargets(actor).find(a => a.id === picked.targetId) ?? null;
    if (!target) {
        const was = game.actors?.get?.(picked.targetId || lastPicked || "") ?? null;
        if (was) ui.notifications.warn(game.i18n.format("DRPG.Infiltrate.tail.gone", { name: nameAsSeen(was) }));
        else ui.notifications.warn(game.i18n.localize("DRPG.Infiltrate.tail.nobody"));
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
       that landed does (`spentAfterRoll`, ROLL-05).
       NOT WHEN A ROLL BROUGHT HOPE (the audit's r122-F-2, 1.2.123). Both rolls are drawn and an action roll earns its Hope
       (action-pipeline.mjs `rollTrait`): two players who agreed - one steps out while the other rolls - repeated Tail for
       its Hope at no action, the free generator ROLL-05 shut. The action comes back only where neither roll came up with
       Hope or a critical (`dualityOf`), so a repeat earns the roller nothing; else it stays spent and the player is told
       why. A roll with Despair gives the GM theirs either way, as any thrown roll does. */
    if (!res.ok && res.refused && res.reason === "notThere") {
        const earned = rollsEarnedHope([shadow, roll]);
        if (!earned) await abort(actor, paid);
        if (paid) ui.notifications.info(game.i18n.format(earned ? "DRPG.Infiltrate.tail.goneKept" : "DRPG.Infiltrate.tail.actionBack", { name: nameAsSeen(target) }));
        return null;
    }
    if (!res.ok || res.value?.refused) return null;
    const seen = res.value?.seen === true;
    // The roller's result: E49's card under the Infiltrate tile's glyph (the coordinator's rule of 12.11.2026), its words as before.
    /* In the middle of the roller's screen (notice-centre.mjs, 1.2.124): noticed, a failed Shadow with its consequence.
       With both rolls, as the owner asked of a centred action card (22.11.2026: "wynik rzutu vs threshold oraz efekt"):
       the effect's roll under the action's head (`rollHead`, no threshold - a Tail's effect has none) and the Shadow
       roll against the 15 that decides whether the target notices (tail-gm.mjs `startTail`), "needed 15" as every
       other card says it (`neededNote`). Until 1.2.124 the card said only the sentence. */
    await whisperToOwner(actor, ...tailCard(label, roll, shadow, seen, target.name));
    Hooks.callAll("drpgActionResolved", { actor, actionKey: "tail", roll, outcome: { success: true, seen, target: target.name } });
    return { seen, target: target.name, roll };
}
