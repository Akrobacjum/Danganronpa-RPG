/**
 * Danganronpa RPG - the Reroll's replays of the Infiltrate tile's rolls and a Facilities roll.
 * ---------------------------------------------------------------------------
 * E69 and E74 C7, E93 (12.11.2026; the coordinator's item 2 of that day). reroll.mjs `replayAction` hands these keys here:
 * a Dash, Tail Someone, Shut the Door, Force the Door, Pick the Lock, Keep Watch and a GM's room action of the Facilities
 * tile. Until this file each fell to `default`, which tells the GMs "this roll left no lasting effect" and leaves what the
 * first roll did standing. Each replay runs on the primary GM, where the Reroll is made, from the GMs' row of the roll and the
 * facts the GMs' run of the action wrote on it (`noteFactOfRoll`: `dashMoves`, `tailTargetId`, `barricadeKey`, `forceRoom`
 * and `forced`, `pickRoom`, `opened` and the cover's, `watchKept`, `facilityKey` and `facilitySuccess`), and answers the
 * facts it changed, which reroll.mjs writes on the row once.
 *
 * WHAT A REPLAY CANNOT TAKE BACK, AND SAYS SO. A door forced, a lock picked whose pass the picker has used (they walked
 * in) and a room action's effects applied stand when the new roll is lower: each line says the first result stands. A
 * pass not yet used is taken back. Spent free crossings are not
 * taken back (only those left). Everything else is replaced: a Dash's crossings, a tail's and a barricade's strength, a
 * watch kept or let go, a door forced and a lock picked by a higher roll, a room action's effects by a success.
 */

import { INFILTRATE, MODULE_ID, FLAGS } from "./config.mjs";
import { log } from "./utils.mjs";

/** The action keys this file replays. */
export const INFILTRATE_REROLLS = Object.freeze(["dash", "tail", "shut", "force", "pick", "keepWatch", "facility"]);

const line = (key, data = {}) => game.i18n.format(`DRPG.Reroll.infiltrate.${key}`, data);

/** Replay `bookmark.actionKey` with the new result `after` (`{ total, isCritical, withHope }`); pushes its line on `done`. */
export async function settleInfiltrate(actor, bookmark, after, done) {
    const total = Number(after?.total) || 0, isCritical = Boolean(after?.isCritical), withHope = after?.withHope !== false;
    switch (bookmark?.actionKey) {
        case "dash": return settleDash(actor, bookmark, total, isCritical, done);
        case "tail": return settleTail(actor, bookmark, total, isCritical, done);
        case "shut": return settleShut(actor, bookmark, total, done);
        case "force": return settleForce(actor, bookmark, total, isCritical, withHope, done);
        case "pick": return settlePick(actor, bookmark, total, isCritical, withHope, done);
        case "keepWatch": return settleWatch(actor, total, isCritical, done);
        case "facility": return settleFacility(actor, bookmark, total, isCritical, done);
        default: return {};
    }
}

/** A Dash: the band of the new total; crossings granted up to it, or those still left taken down to it. */
async function settleDash(actor, bookmark, total, isCritical, done) {
    const { freeMovesLeft, grantFreeMoves } = await import("./actions.mjs");
    const { trustedWrite } = await import("./resource-guard.mjs");
    const rule = INFILTRATE.dash;
    const band = [...rule.bands].sort((a, b) => b.min - a.min).find(b => total >= b.min);
    const moves = isCritical ? rule.critical.moves : band?.moves ?? 0;
    const before = Number(bookmark.dashMoves) || 0;
    if (moves > before) await grantFreeMoves(actor, moves - before, { reason: "infiltrate" });
    else if (moves < before) {
        const left = freeMovesLeft(actor);
        await trustedWrite(actor, { [`flags.${MODULE_ID}.${FLAGS.freeMoveGrants}`]: Math.max(0, left - (before - moves)) }, { reason: "infiltrate" });
    }
    done.push(line("dash", { n: moves }));
    return { dashMoves: moves };
}

/** A tail's strength: the new total and critical, where the tail still stands on the same target. */
async function settleTail(actor, bookmark, total, isCritical, done) {
    const { tailStore } = await import("./gm-stores.mjs");
    const row = tailStore.get(actor.id);
    if (!row || row.targetId !== bookmark.tailTargetId) {
        done.push(line("tailGone"));
        return {};
    }
    await tailStore.patch(actor.id, { total, critical: isCritical });
    done.push(line("tail", { n: total }));
    return {};
}

/** A barricade's strength: the new total, where it still stands and is this character's. */
async function settleShut(actor, bookmark, total, done) {
    const { barricadeStore } = await import("./gm-stores.mjs");
    const row = bookmark.barricadeKey ? barricadeStore.get(bookmark.barricadeKey) : null;
    if (!row || row.authorId !== actor.id) {
        done.push(line("shutGone"));
        return {};
    }
    await barricadeStore.patch(bookmark.barricadeKey, { strength: total });
    done.push(line("shut", { n: total }));
    return {};
}

/** A door: forced already, it stays forced; not forced, the new roll is tried against what holds it now. */
async function settleForce(actor, bookmark, total, isCritical, withHope, done) {
    if (bookmark.forced) {
        done.push(line("forceStands"));
        return {};
    }
    const { forceDoor } = await import("./doors-gm.mjs");
    const out = await forceDoor({ actor, room: bookmark.forceRoom ?? null, total, isCritical, withHope });
    if (out.refused) {
        done.push(line("forceRefused"));
        return {};
    }
    done.push(line(out.forced ? "forced" : "forceHeld"));
    return { forced: Boolean(out.forced) };
}

/**
 * A lock. Picked by the first roll: a pass the picker has used stands (they walked in); one not used is taken back by a new
 * roll below the number (lockpick-gm.mjs `endPass`). Not picked: the new Hand is tried, the cover as the first throw had it.
 */
async function settlePick(actor, bookmark, total, isCritical, withHope, done) {
    if (bookmark.opened) {
        const { passOf, endPass } = await import("./lockpick-gm.mjs");
        const row = passOf(actor.id);
        const unused = row && !row.entered && row.room === (bookmark.pickRoom ?? null);
        if (unused && !isCritical && total < INFILTRATE.pick.dc) {
            await endPass(actor.id);
            done.push(line("pickTaken"));
            return { opened: false };
        }
        done.push(line("pickStands"));
        return {};
    }
    const { pickLock } = await import("./doors-gm.mjs");
    const out = await pickLock({ actor, room: bookmark.pickRoom ?? null, total, isCritical, withHope,
        coverTotal: bookmark.coverTotal, coverCritical: bookmark.coverCritical, tell: false });
    if (out.refused) {
        done.push(line("pickRefused"));
        return {};
    }
    done.push(line(out.opened ? "picked" : "pickHeld"));
    return { opened: Boolean(out.opened) };
}

/** A watch: kept or let go by the new total; refused where a watch can be declared no more (an Eclipse has begun). */
async function settleWatch(actor, total, isCritical, done) {
    const { watchStore } = await import("./gm-stores.mjs");
    const { watchRefusal, declareWatch } = await import("./watch-gm.mjs");
    if (await watchRefusal(actor)) {
        done.push(line("watchStands"));
        return {};
    }
    if (watchStore.get(actor.id)) await watchStore.drop(actor.id);
    const out = await declareWatch({ actor, total, isCritical });
    done.push(line(out.kept ? "watchKept" : "watchNone"));
    return { watchKept: Boolean(out.kept) };
}

/** A GM's room action: a failure rerolled into a success applies its effects; a success stands (its effects are given). */
async function settleFacility(actor, bookmark, total, isCritical, done) {
    if (bookmark.facilitySuccess || !bookmark.facilityKey) {
        done.push(line(bookmark.facilitySuccess ? "facilityStands" : "facilityGone"));
        return {};
    }
    const { gmPlaceOf } = await import("./movement.mjs");
    const F = await import("./facilities.mjs");
    const { applyEffects } = await import("./facilities-gm.mjs");
    const { facilityUseStore } = await import("./gm-stores.mjs");
    const place = gmPlaceOf(actor);
    const action = place?.room ? F.roomActions(place.scene, place.room).find(row => F.gmActionKey(place.scene.id, place.room, row.id) === bookmark.facilityKey) : null;
    if (!action) {
        done.push(line("facilityGone"));
        return {};
    }
    const success = isCritical || total >= action.dc;
    if (!success) {
        done.push(line("facilityMissed"));
        return {};
    }
    await facilityUseStore.patch(bookmark.facilityKey, { success: true });
    const lines = await applyEffects(actor, action.effects, place, null);
    done.push(line("facility"), ...lines.filter(l => typeof l === "string"));
    log(`A Reroll of ${actor.name}'s room action "${action.label}" turned it into a success.`);
    return { facilitySuccess: true };
}
