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
 * reads what holds the door on the GM (doors-gm.mjs `forceDoor`). Pick the Lock is `performPick` below (E74 C4); Keep
 * Watch is action-watch.mjs (E74 C6).
 */

import { INFILTRATE } from "./config.mjs";
import { spendAction } from "./actions.mjs";
import { whisperToOwner, esc } from "./utils.mjs";
import { rollTrait, rollInHand, abort, spentAfterRoll, canAfford, neededNote } from "./action-pipeline.mjs";
import { rollResultCard } from "./action-report.mjs";
import { locateActor, roomOfActor, neighbouringRooms, roomsKnownToMe } from "./movement.mjs";
import { listenLabels } from "./action-listen.mjs";
import { actionWindow } from "./action-menus.mjs";
import { briefingBlock } from "./action-briefing.mjs";
import { tipAttr, tipText } from "./ui-kit.mjs";
import { coverWhileHidden, coverLine as hiddenCoverLine } from "./hide.mjs";

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
    // The roller's result: E49's card under the Infiltrate tile's glyph (the coordinator's rule of 12.11.2026), its words as before.
    // With its roll, in the middle of the roller's screen (action-report.mjs `rollResultCard`, 1.2.124).
    await whisperToOwner(actor, ...rollResultCard(game.i18n.localize("DRPG.Infiltrate.row.shut.label"), roll,
        `<p>${esc(game.i18n.format("DRPG.Infiltrate.shut.done", { room }))}</p>`));
    return { room, roll };
}

/**
 * A door action's card (Force the Door, Pick the Lock; 1.2.124, 1.2.125): its roll's head and dice and the sentence of what
 * the door did (`done` forced or opened, else held by what `held` names, else nothing held it), through action-report.mjs
 * `rollResultCard`. The roll's window named the lock's number (`rollTrait`'s `dc`: Force's 18, Pick's 15), and the card
 * says "needed N" with it; whether the total reached it is marked only where that number decided the outcome - the door
 * held by a lock or a seal alone (doors-gm.mjs `forceDoor` judges both by the lock's number, `pickLock` opens nothing a
 * barricade holds). A barricade is passed by its own strength and stops a pick whatever the roll, and an open door holds
 * nothing: there a mark beside the lock's number said "reached" beside "The door ... holds", or "not reached" beside
 * "gives way" (the auditor's r124-N-1, read on v1.2.124; R8677). Answers `[spec, flags]` for `whisperToOwner`.
 */
export function doorCard(kind, label, roll, { done = false, held = [], room = "", extra = "" } = {}) {
    const key = done ? (kind === "force" ? "forced" : "opened") : held.length ? "held" : "open";
    const decides = held.length > 0 && !held.includes("barricade");
    return rollResultCard(label, roll, `<p>${esc(game.i18n.format(`DRPG.Infiltrate.${kind}.${key}`, { room }))}</p>`, { extra, decides });
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
        brief: briefingBlock(actor, "force", { label, cost, description: game.i18n.localize("DRPG.Infiltrate.row.force.hint") }),
        ask: `<form>
            <p>${esc(game.i18n.format("DRPG.Infiltrate.force.prompt", { room: here ?? "-", n: rule.lockDc }))}</p>
            <label>${esc(game.i18n.localize("DRPG.Infiltrate.force.which"))}
                <select name="room"${tipAttr("DRPG.Tips.Sweep.Actions.forceDoorTooltip")}>${doors.map((r, i) => `<option value="${i}">${esc(labelOf.get(r))}</option>`).join("")}</select></label>
        </form>`,
        footer: {
            primary: { action: "ok", label: game.i18n.localize("DRPG.Action.roll"), tooltip: tipText("DRPG.Tips.Sweep.Actions.forceRollTooltip"),
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
    // With its roll against the lock's number, in the middle of the roller's screen (`doorCard`, 1.2.124; 1.2.125).
    await whisperToOwner(actor, ...doorCard("force", label, roll, { done: forced, held, room: shown }));
    return { forced, held, room, roll };
}

/**
 * Pick the Lock (E74 C4; `INFILTRATE.pick`): the door, one action, the Shadow cover and the Hand, both drawn on the GM, then
 * `door.pick` (doors-gm.mjs `pickLock`), which gives the character a pass to the room on an open (lockpick-gm.mjs, DA9).
 * Answers `{ opened, held, room }` or null.
 */
export async function performPick(actor, options = {}) {
    const { gmOnline, sayNotDone } = await import("./bridge-guards.mjs");
    if (!gmOnline()) {
        sayNotDone("door.pick", "noGm", { nothingSpent: true });
        return null;
    }
    const rule = INFILTRATE.pick;
    const label = game.i18n.localize("DRPG.Infiltrate.row.pick.label");
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
        brief: briefingBlock(actor, "pick", { label, cost, description: game.i18n.localize("DRPG.Infiltrate.row.pick.hint") }),
        ask: `<form>
            <p>${esc(game.i18n.format("DRPG.Infiltrate.pick.prompt", { room: here ?? "-", n: rule.dc, clean: rule.clean, cover: rule.cover.threshold }))}</p>
            <label>${esc(game.i18n.localize("DRPG.Infiltrate.force.which"))}
                <select name="room"${tipAttr("DRPG.Tips.Sweep.Actions.pickDoorTooltip")}>${doors.map((r, i) => `<option value="${i}">${esc(labelOf.get(r))}</option>`).join("")}</select></label>
        </form>`,
        footer: {
            primary: { action: "ok", label: game.i18n.localize("DRPG.Action.roll"), tooltip: tipText("DRPG.Tips.Sweep.Actions.pickRollTooltip"),
                callback: (e, b, d) => doors[Number(d.element.querySelector("[name=room]").value)] ?? null },
            close: "cancel"
        },
        rejectClose: false
    });
    if (!room || room === "cancel") return null;
    const paid = cost > 0 ? await spendAction(actor, cost) : null;
    if (cost > 0 && !paid) return null;
    // The cover first, a supporting roll nothing remembers (as a Palm's), then the Hand; while hidden the cover is not
    // thrown and passes (S0-HIDE, hide.mjs `coverWhileHidden`).
    const cover = coverWhileHidden(actor) ?? await rollTrait(actor, rule.cover.trait, { remember: false, actionKey: "pickCover",
        title: game.i18n.localize("DRPG.Infiltrate.pick.coverTitle"), dc: rule.cover.threshold });
    if (!cover) return abort(actor, paid);
    const roll = await rollTrait(actor, rule.traits[0], { actionKey: "pick", title: label, dc: rule.dc, context: { room } });
    if (!roll) return spentAfterRoll(actor, { label });
    const { requestDoorPick } = await import("./bridge-asks.mjs");
    const res = await requestDoorPick({ actorId: actor.id, room, total: roll.total, isCritical: Boolean(roll.isCritical),
        withHope: Boolean(roll.withHope), coverTotal: cover.total, coverCritical: Boolean(cover.isCritical),
        rollId: rollInHand(actor)?.messageId ?? null, coverRollId: cover.raw?.message?.id ?? cover.raw?.message?._id ?? null });
    if (!res.ok || res.value?.refused) return null;
    const opened = res.value?.opened === true;
    const held = Array.isArray(res.value?.held) ? res.value.held : [];
    const shown = labelOf.get(room) ?? room;
    // With both rolls - the Hand against the lock's number, the cover against its own (`neededNote`) - in the middle of
    // the roller's screen (`doorCard`, 1.2.124; 1.2.125).
    const coverLine = cover.hidden ? hiddenCoverLine(cover)
        : `<p><small>${esc(game.i18n.localize("DRPG.Infiltrate.pick.coverTitle"))} - <b>${esc(String(cover.total ?? ""))}</b>${esc(neededNote(rule.cover.threshold))}</small></p>`;
    await whisperToOwner(actor, ...doorCard("pick", label, roll, { done: opened, held, room: shown, extra: coverLine }));
    return { opened, held, room, roll };
}
