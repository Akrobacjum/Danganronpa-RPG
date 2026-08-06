/**
 * Danganronpa RPG — the Reroll Hope Call.
 * ---------------------------------------------------------------------------
 * Three Hope buys back the dice you have already thrown. Unlike every other
 * Hope Call this one looks backwards, so it is not armed and waited on: it acts
 * the moment it is paid for, on the single most recent roll and nothing older.
 *
 * "Replace the old result with the new one" means four separate ledgers have to
 * agree afterwards:
 *
 *   the dice      the chat message is rewritten in place, so the table sees one
 *                 roll with new numbers rather than two contradictory rolls
 *   Hope / Stress Daggerheart's own `DualityRoll#reroll` reverses these, since
 *                 it already knows what the previous duality granted
 *   Despair       ours, not the system's — a Despair result that becomes a Hope
 *                 result has to hand the point back to the Monokuma that got it
 *   progress      if the roll was Work on Project, the progress it bought is
 *                 removed and the new roll's progress applied instead
 *
 * What cannot be taken back is stated plainly rather than silently ignored: an
 * item already drawn into an inventory and a Remnant already on the map stay
 * where they are, and the whisper says so.
 */

import { MODULE_ID, FLAGS, ACTIONS } from "./config.mjs";
import { resolveThreshold, whisperToOwner, log, error } from "./utils.mjs";

/**
 * Reroll this character's last roll.
 * @returns {Promise<string[]>} lines describing what changed, for the Call's receipt.
 */
export async function rerollLastAction(actor) {
    const done = [];

    const bookmark = actor?.getFlag?.(MODULE_ID, FLAGS.lastAction) ?? null;
    const message = findMessage(actor, bookmark);
    if (!message) {
        ui.notifications.warn(game.i18n.localize("DRPG.Reroll.nothingToReroll"));
        return null;
    }

    const original = message.rolls?.[0];
    if (!original?.reroll) {
        ui.notifications.warn(game.i18n.localize("DRPG.Reroll.notARoll"));
        return null;
    }

    const before = dualityOfRoll(original);

    // `liveRoll` is what makes the system show the dice again and reverse the
    // Hope and Stress the first result granted.
    let rerolled;
    try {
        rerolled = await original.reroll({ liveRoll: true });
        await message.update({ rolls: [rerolled] });
    } catch (err) {
        error("Could not reroll the last action", err);
        ui.notifications.error(game.i18n.localize("DRPG.Reroll.failed"));
        return null;
    }

    const after = dualityOfRoll(rerolled);
    done.push(game.i18n.format("DRPG.Reroll.replaced", {
        old: before.total, new: after.total
    }));

    await settleDespair(actor, before, after, done);
    await settleProgress(actor, bookmark, after, done);
    await warnAboutLeftovers(bookmark, done);

    // The old roll is gone; the new one is now what Reroll would undo.
    try {
        await actor.setFlag(MODULE_ID, FLAGS.lastAction, {
            ...(bookmark ?? {}),
            messageId: message.id,
            total: after.total,
            withFear: after.withFear,
            isCritical: after.isCritical,
            rerolled: true
        });
    } catch {
        // A stale bookmark only costs a second Reroll.
    }

    log(`${actor.name} rerolled ${before.total} into ${after.total}.`);
    return done;
}

/* ==========================================================================
 * FINDING THE ROLL
 * ========================================================================== */

/**
 * The message to rewrite. The bookmark set when the roll was made is preferred;
 * a scan of recent chat covers rolls made straight from the sheet, which do not
 * pass through the action engine.
 */
function findMessage(actor, bookmark) {
    if (bookmark?.messageId) {
        const byId = game.messages.get(bookmark.messageId);
        if (byId?.rolls?.length) return byId;
    }

    const all = game.messages?.contents ?? Array.from(game.messages ?? []);
    const mine = all.filter(m => m.rolls?.length && belongsTo(m, actor));
    return mine.length ? mine[mine.length - 1] : null;
}

function belongsTo(message, actor) {
    if (message.speaker?.actor === actor.id) return true;
    const source = message.system?.source?.actor;
    return typeof source === "string" && source === actor.uuid;
}

/** Hope / Despair / critical, read straight off the dice so it always works. */
function dualityOfRoll(roll) {
    const hope = roll?.dHope?.total;
    const fear = roll?.dFear?.total;
    const total = roll?.total ?? 0;

    if (typeof hope === "number" && typeof fear === "number") {
        return { total, isCritical: hope === fear, withHope: hope > fear, withFear: hope < fear };
    }
    return {
        total,
        isCritical: Boolean(roll?.isCritical),
        withHope: Boolean(roll?.withHope),
        withFear: Boolean(roll?.withFear)
    };
}

/* ==========================================================================
 * PUTTING THE LEDGERS BACK
 * ========================================================================== */

/**
 * Despair is this module's own pool, so the system's reroll knows nothing about
 * it. A roll that was made with Despair and is no longer gives its point back;
 * one that becomes a Despair roll takes a point now.
 */
async function settleDespair(actor, before, after, done) {
    if (before.withFear === after.withFear) return;

    try {
        const { monokumaFor } = await import("./assignments.mjs");
        const monokuma = monokumaFor(actor);
        if (!monokuma) return;

        const delta = after.withFear ? 1 : -1;
        const { requestDespairAdjust } = await import("./gm-bridge.mjs");
        await requestDespairAdjust(monokuma.id, delta);

        done.push(game.i18n.format(delta > 0 ? "DRPG.Reroll.despairGained" : "DRPG.Reroll.despairReturned", {
            name: monokuma.name
        }));
    } catch (err) {
        error("Could not settle Despair after a reroll", err);
    }
}

/**
 * If the roll being taken back was Work on Project, its progress goes with it.
 * The new roll is scored against the same thresholds and applied in its place,
 * so the project ends up where the second roll would have left it.
 */
async function settleProgress(actor, bookmark, after, done) {
    if (bookmark?.actionKey !== "project" || !bookmark.projectId) return;

    try {
        const { addProgress, allProjects } = await import("./projects.mjs");
        const project = allProjects().find(p => p.id === bookmark.projectId);
        if (!project) return;

        const def = ACTIONS.project;
        const hit = after.isCritical ? def.critical : resolveThreshold(after.total, def.thresholds);
        const now = hit?.progress ?? 0;
        const was = bookmark.progress ?? 0;
        const delta = now - was;

        if (delta) await addProgress(bookmark.projectId, delta);
        done.push(game.i18n.format("DRPG.Reroll.progressAdjusted", {
            name: project.name, was, now
        }));

        await actor.setFlag(MODULE_ID, FLAGS.lastAction, {
            ...bookmark, progress: now
        });
    } catch (err) {
        error("Could not adjust project progress after a reroll", err);
    }
}

/** Say what the reroll could not take back, rather than pretending it did. */
async function warnAboutLeftovers(bookmark, done) {
    const key = bookmark?.actionKey;
    if (key === "search" || key === "sabotage" || bookmark?.remnant) {
        done.push(game.i18n.localize("DRPG.Reroll.leftovers"));
    }
}

/** Convenience for the API and the handbook. */
export async function announceReroll(actor, lines) {
    if (!lines?.length) return;
    await whisperToOwner(actor,
        `<h3>${game.i18n.localize("DRPG.Reroll.title")}</h3><ul>${
            lines.map(l => `<li>${foundry.utils.escapeHTML(l)}</li>`).join("")
        }</ul>`);
}
