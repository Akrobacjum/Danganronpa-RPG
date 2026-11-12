/**
 * Danganronpa RPG - Listen.
 * ---------------------------------------------------------------------------
 * The Listen action (`performListen`) and the names its picker and its lines
 * give the rooms next door, a room this viewer has not been in unnamed
 * (`listenLabels`, which a new project's passage options read too).
 *
 * WHERE IT SITS. Moved out of action-rolls.mjs by E41 C4 (1.2.97), a pure move
 * that `node tools/moved-only.mjs` proves line by line. action-rolls.mjs
 * re-exports `listenLabels`, the one name here it exported before, and nothing
 * here imports it back (the facade rule, .claude/rules/code.md).
 * `performListen` is exported now because `performAction`, which stays there,
 * dispatches to it; action-rolls.mjs does not re-export it. Of the action
 * family it reads the shared layer alone.
 */

import { ACTIONS, INFILTRATE } from "./config.mjs";
import { spendAction, actionsLeft } from "./actions.mjs";
import { roomOfActor, locateActor, neighbouringRooms } from "./movement.mjs";
import { resolveThreshold, whisperToOwner, plural } from "./utils.mjs";
import { rollTrait, noteRollContext, abort, canAfford } from "./action-pipeline.mjs";
import { rollCardFlags, rollHead } from "./action-report.mjs";
import { briefingBlock } from "./action-briefing.mjs";
import { actionWindow, chooseVariant } from "./action-menus.mjs";

/**
 * THE DOORS, NOT THE ROOMS BEHIND THEM (22.09). The picker named every neighbouring room,
 * discovered or not, so opening Listen in a room with an unexplored neighbour printed that
 * room's name - the one thing the fog and the refused crossing (`notConnectedText`) are
 * careful never to say. A room this viewer has not been in is "Unexplored room 1, 2...",
 * in the picker and in the answer alike, and the option values are indices, so the page
 * carries no name either. A GM and the Mastermind, who know the map, see every name
 * (`known` is `roomsKnownToMe()`, `null` for them). One function since E08+E28 fix r1-G4
 * (04.10.2026): a Reroll's lines are built on the roller's browser from the same rooms
 * (reroll.mjs `heardLines`), so the same door gets the same number twice.
 */
export function listenLabels(neighbours, known) {
    let unexplored = 0;
    return new Map(neighbours.map(r => [r, !known || known.has(r)
        ? r
        : game.i18n.format("DRPG.Listen.unknownRoom", { n: ++unexplored })]));
}

/** Each row's icon in the Infiltrate window. */
const ROW_ICONS = Object.freeze({ listen: "fa-ear-listen", tail: "fa-shoe-prints", dash: "fa-person-running", shut: "fa-door-closed" });
/** The rows whose action is built on this branch; the rest stand greyed with "Not built yet" (docs/dev/e69/SPEC.md). */
const BUILT = new Set(["listen", "tail", "dash", "shut"]);

/**
 * THE INFILTRATE WINDOW'S ROWS (E69 C1, 12.11.2026; DA28: one list, no groups). One row a key of `ACTIONS.listen.variants`
 * (config.mjs `INFILTRATE`'s order), each with its price and why it is shut: Listen in a room with no neighbour (until
 * C1 that was a warning after the tile was pressed), a row not built yet. Read by `performListen` and by tier 1's R3756.
 */
export function infiltrateRows(actor) {
    const scene = locateActor(actor)?.scene ?? null;
    const neighbours = neighbouringRooms(scene, roomOfActor(actor));
    return (ACTIONS.listen.variants ?? ["listen"]).map(key => {
        const row = INFILTRATE[key] ?? {};
        const why = !BUILT.has(key) ? game.i18n.localize("DRPG.Infiltrate.notBuilt")
            : key === "listen" && !neighbours.length ? game.i18n.localize("DRPG.Listen.noNeighbours") : null;
        return {
            value: key, icon: ROW_ICONS[key] ?? "fa-circle",
            label: game.i18n.localize(`DRPG.Infiltrate.row.${key}.label`),
            hint: `${plural("DRPG.Action.willCost", { n: row.cost ?? 1, left: actionsLeft(actor) })} · ${
                game.i18n.localize(`DRPG.Infiltrate.row.${key}.hint`)}`,
            disabled: Boolean(why), why: why ?? ""
        };
    });
}

/**
 * Listen - fully automatic, no GM.
 *
 * The guide's three outcomes map onto three amounts of information:
 *   pass      you learn how many people are in the chosen room, not who
 *   strong    you learn who they are
 *   critical  every neighbouring room at once
 *
 * The anonymous tier matters: "someone is in the kitchen" is a very different
 * piece of information from "Kaede is in the kitchen", and the guide draws that
 * line deliberately.
 */
export async function performListen(actor, def, options) {
    // The Infiltrate window first (E69 C1): its rows, the first usable one picked; Listen goes on to its room below.
    const variant = options.variant ?? (await chooseVariant({
        actor, title: def.label, intro: briefingBlock(actor, "listen", def), options: infiltrateRows(actor), showShut: true
    }))?.value ?? null;
    if (variant === "dash") return performDash(actor, options);
    if (variant === "tail") return (await import("./action-tail.mjs")).performTail(actor, options);
    if (variant === "shut") return (await import("./action-doors.mjs")).performShut(actor, options);
    if (variant !== "listen") return null;
    const cost = options.free ? 0 : def.cost;
    if (!canAfford(actor, cost)) return null;

    const { neighbouringRooms, occupantsOf, roomsKnownToMe } = await import("./movement.mjs");
    const here = roomOfActor(actor);
    // The rooms next to this one on the scene the character stands on (E12 C2a), not the camera's;
    // who is in them and which of them this player has found, on the same scene (E12 fix r1-G4).
    const scene = locateActor(actor)?.scene ?? null;
    const neighbours = neighbouringRooms(scene, here);

    if (!neighbours.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Listen.noNeighbours"));
        return null;
    }

    const labelOf = listenLabels(neighbours, roomsKnownToMe(scene));

    const options_ = neighbours
        .map((r, i) => `<option value="${i}">${foundry.utils.escapeHTML(labelOf.get(r))}</option>`)
        .join("");

    // An action's window (E68 C12, action-menus.mjs `actionWindow`): the briefing on the left, the question on the right.
    const target = await actionWindow({
        title: def.label,
        classes: ["drpg-panel"],
        brief: briefingBlock(actor, "listen", def),
        ask: `<form>
            <p>${game.i18n.format("DRPG.Listen.prompt", { room: foundry.utils.escapeHTML(here ?? "-") })}</p>
            <label>${game.i18n.localize("DRPG.Listen.which")}
                <select name="room">${options_}</select></label>
        </form>`,
        footer: {
            primary: {
                action: "ok", label: game.i18n.localize("DRPG.Action.roll"),
                callback: (e, b, d) => neighbours[Number(d.element.querySelector("[name=room]").value)] ?? null
            },
            close: "cancel"
        },
        rejectClose: false
    });

    if (!target || target === "cancel") return null;
    const shownAs = labelOf.get(target) ?? target;

    // Paid before the dice - see `abort` and ACT-07 above it.
    const paid = cost > 0 ? await spendAction(actor, cost) : null;
    if (cost > 0 && !paid) return null;
    const roll = await rollTrait(actor, "shadow", {
        actionKey: "listen",
        dc: (def.thresholds ?? []).map(t => t.min).join(" / "),
        context: { room: here, target }
    });
    if (!roll) return abort(actor, paid);

    // Listen produces information and nothing else, so Reroll has nothing to
    // undo - it simply asks the walls again with the new number.
    await noteRollContext(actor, { actionKey: "listen", room: here, target });

    const hit = resolveThreshold(roll.total, def.thresholds);
    const lines = [];
    let outcome;

    // The "named" tier is the highest threshold the action declares, read from
    // the table rather than repeated here. The old hardcoded `>= 18` was a copy
    // of a config value: retuning Listen in config.mjs silently left the code
    // handing out names at the old number.
    const namedFrom = Math.max(...def.thresholds.map(t => t.min));

    if (roll.isCritical) {
        // Everything, everywhere.
        const sweep = neighbours.map(room => {
            const who = occupantsOf(room, actor, scene).map(a => a.name);
            return `<li><strong>${foundry.utils.escapeHTML(labelOf.get(room) ?? room)}</strong> - ${
                who.length ? who.map(n => foundry.utils.escapeHTML(n)).join(", ") : game.i18n.localize("DRPG.Listen.empty")
            }</li>`;
        }).join("");
        lines.push(`<p>${game.i18n.localize("DRPG.Listen.critical")}</p><ul>${sweep}</ul>`);
        outcome = { success: true, isCritical: true, rooms: neighbours };
    } else if (hit && hit.min >= namedFrom) {
        // Named.
        const who = occupantsOf(target, actor, scene).map(a => a.name);
        lines.push(`<p>${game.i18n.format("DRPG.Listen.named", {
            room: foundry.utils.escapeHTML(shownAs),
            who: who.length ? who.map(n => foundry.utils.escapeHTML(n)).join(", ") : game.i18n.localize("DRPG.Listen.empty")
        })}</p>`);
        outcome = { success: true, room: target, named: who };
    } else if (hit) {
        // Anonymous: a count, no identities.
        const count = occupantsOf(target, actor, scene).length;
        lines.push(`<p>${count
            ? plural("DRPG.Listen.anonymous", { room: foundry.utils.escapeHTML(shownAs), n: count })
            : game.i18n.format("DRPG.Listen.emptyRoom", { room: foundry.utils.escapeHTML(shownAs) })
        }</p>`);
        outcome = { success: true, room: target, count };
    } else {
        lines.push(`<p>${def.failure}</p>`);
        outcome = { success: false };
    }

    await whisperToOwner(actor, `${rollHead(def, roll)}${lines.join("")}`, rollCardFlags(def, roll));

    Hooks.callAll("drpgActionResolved", { actor, actionKey: "listen", roll, outcome });
    return outcome;
}

/**
 * DASH (E69 C5, 12.11.2026; config.mjs `INFILTRATE.dash`). One action paid here, a Leg roll the primary GM draws (its
 * statistic the GM's config's, `actionKey` "dash"), then `dash.settle`: the GM reads the total off its own record of the
 * roll and grants the free crossings its band earns (bridge-runs-acts.mjs `handleDash`). With no GM connected nothing is
 * paid. The card says how many came.
 */
export async function performDash(actor, options = {}) {
    const { gmOnline, sayNotDone } = await import("./bridge-guards.mjs");
    if (!gmOnline()) {
        sayNotDone("dash.settle", "noGm", { nothingSpent: true });
        return null;
    }
    const cost = options.free ? 0 : INFILTRATE.dash.cost;
    if (!canAfford(actor, cost)) return null;
    const paid = cost > 0 ? await spendAction(actor, cost) : null;
    if (cost > 0 && !paid) return null;
    const roll = await rollTrait(actor, INFILTRATE.dash.traits[0], {
        actionKey: "dash", title: game.i18n.localize("DRPG.Infiltrate.row.dash.label"),
        dc: INFILTRATE.dash.bands.map(b => b.min).join(" / ")
    });
    if (!roll) return abort(actor, paid);
    const { requestDash } = await import("./bridge-asks.mjs");
    const { rollInHand } = await import("./action-pipeline.mjs");
    const res = await requestDash({ actorId: actor.id, total: roll.total, isCritical: Boolean(roll.isCritical),
        rollId: rollInHand(actor)?.messageId ?? null });
    if (!res.ok) return null;
    const moves = Number(res.value?.moves) || 0;
    await whisperToOwner(actor, `<p>${plural("DRPG.Infiltrate.dashResult", { n: moves })}</p>`);
    return { roll, moves };
}
