/**
 * Danganronpa RPG — the Reroll Hope Call.
 * ---------------------------------------------------------------------------
 * Three Hope buys back the dice you have already thrown. Unlike every other
 * Hope Call this one looks backwards, so it is not armed and waited on: it acts
 * the moment it is paid for, on the single most recent roll and nothing older.
 *
 * "Replace the old result with the new one" is not a chat-card edit. It means
 * the action is taken back and run again:
 *
 *   the dice      the chat message is rewritten in place, so the table sees one
 *                 roll with new numbers rather than two contradictory rolls
 *   Hope / Stress Daggerheart's own `DualityRoll#reroll` reverses these, since
 *                 it already knows what the previous duality granted
 *   Despair       ours, not the system's — a Despair result that becomes a Hope
 *                 result has to hand the point back to the Monokuma that got it
 *   the action    whatever the roll actually did is undone and redone against
 *                 the new number: project progress, the item a Search drew, the
 *                 Remnant it left, the freeze and repair a Sabotage caused
 *
 * Which action to replay comes off the bookmark `rollTrait` writes. Until that
 * bookmark carried an `actionKey`, only Work on Project ever recorded one — so
 * Reroll genuinely did nothing but re-roll the dice for every other action,
 * which is exactly how "it only works on projects" happened.
 *
 * What still cannot be taken back is stated plainly rather than silently
 * ignored: a search token is spent whatever the dice say, and a ruling a human
 * already made is re-asked rather than rewritten.
 */

import { MODULE_ID, FLAGS, ACTIONS, PROJECT_SCALE, DYNAMIC_THRESHOLDS } from "./config.mjs";
import { resolveThreshold, replaceFlag, log, error } from "./utils.mjs";

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
    await settleCritHope(actor, before, after, done);

    // Undo and replay the action itself. Every branch returns the bookmark
    // fields it changed, so the flag is written once, at the end, from the state
    // the replay actually left behind. Writing it from the pre-reroll bookmark —
    // which is what used to happen — put the OLD progress figure back on the
    // flag straight after the replay had corrected it, so a second Reroll
    // subtracted a number the project no longer held.
    const patch = await replayAction(actor, bookmark, after, done);

    try {
        // Replacement, matching `rememberRoll`: the spread below is the whole
        // of the new bookmark, so a `patch` that nulls a field it consumed —
        // an item it removed, a Remnant it retuned — actually clears it.
        await replaceFlag(actor, FLAGS.lastAction, {
            ...(bookmark ?? {}),
            ...patch,
            messageId: message.id,
            total: after.total,
            withFear: after.withFear,
            isCritical: after.isCritical,
            rerolled: true
        });
    } catch {
        // A stale bookmark only costs a second Reroll.
    }

    log(`${actor.name} rerolled ${before.total} into ${after.total} (${bookmark?.actionKey ?? "no action"}).`);
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
/** How far back the fallback scan will look, in real minutes. */
const REROLL_WINDOW_MINUTES = 30;

function findMessage(actor, bookmark) {
    if (bookmark?.messageId) {
        const byId = game.messages.get(bookmark.messageId);
        if (byId?.rolls?.length) return byId;
    }

    // Bounded scan. Reroll undoes "your last action", not "the last roll you
    // ever made" — without a cutoff the fallback happily reached back into a
    // previous session and rewrote a roll nobody remembered making.
    const cutoff = Date.now() - REROLL_WINDOW_MINUTES * 60_000;

    const all = game.messages?.contents ?? Array.from(game.messages ?? []);
    const mine = all.filter(m =>
        m.rolls?.length &&
        belongsTo(m, actor) &&
        (m.timestamp ?? 0) >= cutoff);

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
 * The guide's "+2 Hope on a crit" is this module's own top-up on top of what
 * Daggerheart's own pipeline pays — see despair-award.mjs. That pipeline also
 * covers a crit reached *by* rerolling (Daggerheart's `updateResourcesForDualityReroll`
 * credits +1 Hope the same way a fresh crit does), but a reroll never fires
 * `createChatMessage`, so our top-up would otherwise never run for a reroll —
 * and would keep sitting there if the reroll rolled the crit away.
 */
async function settleCritHope(actor, before, after, done) {
    if (before.isCritical === after.isCritical) return;

    try {
        const { adjustCritHopeTopUp } = await import("./despair-award.mjs");
        const delta = after.isCritical ? 1 : -1;
        await adjustCritHopeTopUp(actor, delta);

        done.push(game.i18n.localize(
            delta > 0 ? "DRPG.Reroll.critHopeGained" : "DRPG.Reroll.critHopeReturned"
        ));
    } catch (err) {
        error("Could not settle the critical's Hope after a reroll", err);
    }
}

/* ==========================================================================
 * REPLAYING THE ACTION
 * --------------------------------------------------------------------------
 * One branch per action that produced something. Each undoes what the first
 * roll did and applies what the second one earns, and each returns the bookmark
 * fields it changed so the caller can write the flag once.
 *
 * Failure here is reported, never thrown: the dice have already been rewritten
 * and the Hope already spent, so a branch that cannot finish must say what it
 * could not do rather than take the whole Call down with it.
 * ========================================================================== */

async function replayAction(actor, bookmark, after, done) {
    const key = bookmark?.actionKey ?? null;

    try {
        // A ruling a human made cannot be rewritten by a die. Ask again instead.
        if (bookmark?.gmRuled) return await settleGmRuling(actor, bookmark, after, done);

        switch (key) {
            case "project": return await settleProgress(actor, bookmark, after, done);
            case "search": return await settleSearch(actor, bookmark, after, done);
            case "sabotage": return await settleSabotage(actor, bookmark, after, done);
            case "dynamic": return await settleDynamic(actor, bookmark, after, done);
            case "listen": return await settleListen(actor, bookmark, after, done);
            case "observe": return await settleObserve(actor, bookmark, after, done);
            case "analyze": return await settleAnalyze(actor, bookmark, after, done);
            case "crisis": return await settleCrisis(actor, bookmark, after, done);
            case "cleanup": return await settleCleanup(actor, bookmark, after, done);
            default:
                // A trait rolled straight from the sheet, or an action from
                // before this bookmark existed. The dice are the whole result.
                done.push(game.i18n.localize("DRPG.Reroll.noReplay"));
                return {};
        }
    } catch (err) {
        error(`Could not replay "${key}" after a reroll`, err);
        done.push(game.i18n.localize("DRPG.Reroll.replayFailed"));
        return {};
    }
}

/**
 * If the roll being taken back was Work on Project, its progress goes with it.
 * The new roll is scored against the same thresholds and applied in its place,
 * so the project ends up where the second roll would have left it.
 */
async function settleProgress(actor, bookmark, after, done) {
    if (!bookmark.projectId) {
        done.push(game.i18n.localize("DRPG.Reroll.noReplay"));
        return {};
    }

    const { addProgress, allProjects } = await import("./projects.mjs");
    const project = allProjects().find(p => p.id === bookmark.projectId);
    if (!project) {
        done.push(game.i18n.localize("DRPG.Project.gone"));
        return {};
    }

    const def = ACTIONS.project;
    const hit = after.isCritical ? def.critical : resolveThreshold(after.total, def.thresholds);

    // The bonus an indirect murder earned — for working alone, or for
    // concealing intent on a Despair roll — is not recomputable from the
    // dice, so it is carried on the bookmark and re-applied on top of the
    // new threshold result. Scoring the new roll on thresholds alone while
    // subtracting a stored total that included the bonus quietly destroyed
    // it: every reroll cost the killer progress they had already earned.
    const bonus = bookmark.bonus ?? 0;
    const threshold = hit?.progress ?? 0;
    const now = threshold ? threshold + bonus : 0;
    const was = bookmark.progress ?? 0;
    const delta = now - was;

    if (delta) await addProgress(bookmark.projectId, delta);
    done.push(game.i18n.format("DRPG.Reroll.progressAdjusted", {
        name: project.name, was, now
    }));

    // A critical on a project hands the action back. If the reroll gains or
    // loses the critical, that action has to move with it — otherwise a player
    // could reroll a crit away and keep the free action it paid for.
    const refunded = await settleActionRefund(actor, bookmark, Boolean(hit?.refundAction), done);

    return { progress: now, bonus, refunded };
}

/**
 * Take back a Search and run it again.
 *
 * The search token is deliberately NOT returned: the room was searched, and the
 * guide's three tokens count attempts, not successes.
 */
async function settleSearch(actor, bookmark, after, done) {
    const def = ACTIONS.search;
    const hit = resolveThreshold(after.total, def.thresholds);
    const found = Boolean(hit) || after.isCritical;

    const baseTier = hit?.tier ?? 0;
    const tier = after.isCritical
        ? Math.min(3, baseTier + (def.critical?.tierBonus ?? 1))
        : baseTier;

    // 1. The thing the first roll put in the inventory goes back on the shelf.
    let itemId = null;
    if (bookmark.itemId) {
        const item = actor.items.get(bookmark.itemId);
        if (item) {
            const name = item.name;
            try {
                await item.delete();
                done.push(game.i18n.format("DRPG.Reroll.itemTakenBack", { item: name }));
            } catch (err) {
                error("Could not take back the item a reroll undid", err);
                done.push(game.i18n.format("DRPG.Reroll.itemStuck", { item: name }));
                itemId = bookmark.itemId;
            }
        }
    }

    // 2. Draw again, from the same category and for the same goal.
    let drawnName = null;
    if (found && bookmark.category) {
        const { drawItem } = await import("./tables.mjs");
        const drawn = await drawItem(bookmark.category, tier, { goal: bookmark.goal ?? null });
        if (drawn?.name) {
            drawnName = drawn.name;
            const { grantItem } = await import("./inventory.mjs");
            const granted = await grantItem(actor, {
                name: drawn.name, category: bookmark.category, tier, goal: bookmark.goal ?? null
            });
            if (granted) itemId = granted.id;
            done.push(game.i18n.format("DRPG.Reroll.itemDrawn", { item: drawn.name, tier }));
        }
    } else {
        done.push(game.i18n.localize("DRPG.Reroll.searchNothing"));
    }

    // 3. The trace. Only murder and cleaning gear leaves one, per the guide, and
    //    only a Search that actually found something — but a Search that failed
    //    and is now a success has to leave the trace it never earned first time.
    const leaves = Boolean(bookmark.category) && bookmark.category !== "usable";
    const visibility = found
        ? (after.isCritical ? def.critical?.remnant : hit?.remnant)
        : null;

    const { ITEM_CATEGORIES } = await import("./config.mjs");
    const trace = await settleRemnant(actor, bookmark, leaves ? (visibility ?? null) : null, done, {
        type: "prep",
        faint: true,
        tiedToCrime: true,
        action: "search",
        subject: drawnName ?? "",
        note: game.i18n.format("DRPG.Remnant.searchNote", {
            actor: actor.name,
            room: bookmark.room ?? "?",
            category: ITEM_CATEGORIES[bookmark.category]?.label ?? bookmark.category ?? "?",
            item: drawnName ?? "?",
            tier,
            total: after.total
        })
    });

    done.push(game.i18n.localize("DRPG.Reroll.tokenKept"));
    return { itemId, tier: found ? tier : null, ...trace };
}

/**
 * Take back a Sabotage and run it again.
 *
 * The freeze and the repair project the first roll created are removed, then the
 * new score decides whether — and how badly — the target breaks this time. The
 * concealment penalty the pre-roll earned still applies: it was not part of this
 * roll and is not undone by rerolling it.
 */
async function settleSabotage(actor, bookmark, after, done) {
    const def = ACTIONS.sabotage;
    const penalty = bookmark.penalty ?? 0;
    const score = after.total + penalty;
    const hit = after.isCritical ? def.critical : resolveThreshold(score, def.thresholds);
    const success = Boolean(hit);

    const { undoSabotage, sabotageProject, allProjects } = await import("./projects.mjs");

    // 1. Unfreeze the target and remove the repair the first roll spawned.
    if (bookmark.repairId || bookmark.targetProjectId) {
        await undoSabotage(bookmark.targetProjectId ?? null, bookmark.repairId ?? null);
        if (bookmark.repairId) done.push(game.i18n.localize("DRPG.Reroll.sabotageUndone"));
    }

    // 2. Break it again, at whatever the new roll is worth.
    let repairId = null;
    if (success && bookmark.targetProjectId) {
        // Guide's Sabotage table, by the repair project it demands:
        //   12 -> trivial (3)   18 -> complex (6)   crit -> desperate (8)
        const difficulty = after.isCritical
            ? PROJECT_SCALE.desperate.progress
            : score >= 18 ? PROJECT_SCALE.complex.progress : PROJECT_SCALE.trivial.progress;

        const result = await sabotageProject(bookmark.targetProjectId, difficulty);
        repairId = result?.repair?.id ?? null;

        const target = allProjects().find(p => p.id === bookmark.targetProjectId);
        done.push(game.i18n.format("DRPG.Reroll.sabotageRedone", {
            name: target?.name ?? "?", n: difficulty
        }));
    } else if (bookmark.targetProjectId) {
        done.push(game.i18n.localize("DRPG.Reroll.sabotageNowFails"));
    }

    // 3. Sabotage always leaves a trace, success or not — only how loud changes.
    const visibility = success ? hit.remnant : def.failureRemnant;
    const name = allProjects().find(p => p.id === bookmark.targetProjectId)?.name ?? "?";

    const trace = await settleRemnant(actor, bookmark, visibility, done, {
        type: "prep",
        faint: true,
        action: "sabotage",
        subject: name,
        note: game.i18n.format("DRPG.Remnant.sabotageNote", {
            actor: actor.name,
            project: name,
            room: bookmark.room ?? "?",
            total: after.total,
            outcome: success
                ? game.i18n.format("DRPG.Remnant.sabotageWorked", { repair: "?" })
                : game.i18n.localize("DRPG.Remnant.sabotageFailed")
        })
    });

    return { repairId, penalty, ...trace };
}

/**
 * Take back a Dynamic action and run it again against the SAME difficulty band.
 *
 * The band is not re-asked: the GM ruled on what the player described, and that
 * description has not changed. Only the dice have.
 */
async function settleDynamic(actor, bookmark, after, done) {
    const band = DYNAMIC_THRESHOLDS[bookmark.bandIndex];
    if (!band) {
        done.push(game.i18n.localize("DRPG.Reroll.noReplay"));
        return {};
    }

    const success = after.isCritical || after.total >= band.range[0];
    const trace = await settleRemnant(actor, bookmark, success ? band.remnant : null, done, {
        type: "prep",
        faint: true,
        action: "dynamic",
        subject: String(bookmark.description ?? "").slice(0, 60),
        note: game.i18n.format("DRPG.Remnant.dynamicNote", {
            actor: actor.name,
            room: bookmark.room ?? "?",
            what: bookmark.description ?? "?",
            total: after.total
        })
    });

    done.push(success
        ? game.i18n.format("DRPG.Action.tierFound", { tier: band.tier })
        : game.i18n.localize("DRPG.Action.nothing"));

    return trace;
}

/**
 * Listen leaves nothing behind, so there is nothing to undo — the new number
 * simply buys a different amount of information about the same room.
 */
/**
 * Take back an Observe and score it again.
 *
 * The target does not move. The character was looking at one particular trace
 * and the Hope is buying back the dice, not the search — so the new number is
 * measured against the same Remnant and the same difficulty.
 *
 * All of that lives on the GM's client, which is also where the first result
 * was recorded, so the replay is one message: "same target, new number, undo
 * what the last one did". This side deliberately cannot compute the outcome —
 * see observe.mjs for why.
 */
async function settleObserve(actor, bookmark, after, done) {
    if (!bookmark.observeKey) {
        done.push(game.i18n.localize("DRPG.Reroll.noReplay"));
        return {};
    }

    const { requestObserveResolve } = await import("./gm-bridge.mjs");
    await requestObserveResolve({
        actorId: actor.id,
        key: bookmark.observeKey,
        total: after.total,
        isCritical: after.isCritical,
        undo: true
    });

    done.push(game.i18n.localize("DRPG.Reroll.observeReplayed"));
    return { observeKey: bookmark.observeKey };
}

/**
 * Take back a crisis action and run it again against the new number.
 *
 * The one that used to fall through to "the dice are the whole result", which
 * for an incident is the worst place to do that: the damage, the Remnant, the
 * hindrance and the turn all stood while the number underneath them changed.
 * Three Hope bought a cosmetic edit in the middle of a fight.
 *
 * Everything is done on the GM's client, because everything a crisis action
 * touches is: the other participant's sheet, the map, the shared incident
 * state. This side sends which action, the new number, and "take the old one
 * back first" — see `undoLastCrisis` in murder.mjs for what that involves.
 *
 * The turn is NOT spent twice. Rewinding restores whose turn it was, and the
 * replay passes it again, so the action costs one turn in total however many
 * times it is rerolled.
 *
 * `bookmark.crisis` is written by `takeCrisisAction`, which passes the action
 * key through `rollTrait`'s `context`.
 */
async function settleCrisis(actor, bookmark, after, done) {
    if (!bookmark.crisis) {
        done.push(game.i18n.localize("DRPG.Reroll.noReplay"));
        return {};
    }

    const { requestCrisisResult } = await import("./gm-bridge.mjs");
    await requestCrisisResult({
        actorId: actor.id,
        key: bookmark.crisis,
        total: after.total,
        isCritical: after.isCritical,
        withHope: after.withHope,
        undo: true
    });

    done.push(game.i18n.localize("DRPG.Reroll.crisisReplayed"));
    return { crisis: bookmark.crisis };
}

/**
 * Take back a Stage 6 clean-up and run it again.
 *
 * The trace it erased comes back, the trace a botched wipe left is removed, and
 * the Stress is refunded before the new number is scored — so a reroll costs the
 * Hope and one attempt's Stress, not two attempts' worth.
 *
 * `bookmark.cleanup` is the Remnant token id, written by `attemptCleanup`
 * through `rollTrait`'s `context`.
 */
async function settleCleanup(actor, bookmark, after, done) {
    if (!bookmark.cleanup) {
        done.push(game.i18n.localize("DRPG.Reroll.noReplay"));
        return {};
    }

    const { requestCleanup } = await import("./gm-bridge.mjs");
    await requestCleanup({
        actorId: actor.id,
        tokenId: bookmark.cleanup,
        total: after.total,
        isCritical: after.isCritical,
        withHope: after.withHope,
        undo: true
    });

    done.push(game.i18n.localize("DRPG.Reroll.cleanupReplayed"));
    return { cleanup: bookmark.cleanup };
}

/**
 * Take back an Analyze and score it again.
 *
 * Only the evidence branch reaches this: asking the GM for a hint is a ruling,
 * so it carries `gmRuled` and is re-asked instead. The GM's client winds the
 * bullet back to unidentified and unlocked before applying the new number —
 * which also means a Reroll can lift a lock the first roll had just stamped on.
 */
async function settleAnalyze(actor, bookmark, after, done) {
    if (!bookmark.bulletId) {
        done.push(game.i18n.localize("DRPG.Reroll.noReplay"));
        return {};
    }

    const { requestAnalyzeResolve } = await import("./gm-bridge.mjs");
    await requestAnalyzeResolve({
        actorId: actor.id,
        itemId: bookmark.bulletId,
        total: after.total,
        isCritical: after.isCritical,
        undo: true
    });

    done.push(game.i18n.localize("DRPG.Reroll.analyzeReplayed"));
    return { bulletId: bookmark.bulletId };
}

async function settleListen(actor, bookmark, after, done) {
    const def = ACTIONS.listen;
    const target = bookmark.target;
    if (!target) {
        done.push(game.i18n.localize("DRPG.Reroll.noReplay"));
        return {};
    }

    const { neighbouringRooms, occupantsOf } = await import("./movement.mjs");
    const hit = resolveThreshold(after.total, def.thresholds);
    const namedFrom = Math.max(...def.thresholds.map(t => t.min));

    if (after.isCritical) {
        for (const room of neighbouringRooms(bookmark.room)) {
            const who = occupantsOf(room, actor).map(a => a.name);
            done.push(`${room} — ${who.length ? who.join(", ") : game.i18n.localize("DRPG.Listen.empty")}`);
        }
    } else if (hit && hit.min >= namedFrom) {
        const who = occupantsOf(target, actor).map(a => a.name);
        done.push(game.i18n.format("DRPG.Listen.named", {
            room: target,
            who: who.length ? who.join(", ") : game.i18n.localize("DRPG.Listen.empty")
        }));
    } else if (hit) {
        const count = occupantsOf(target, actor).length;
        done.push(count
            ? game.i18n.format("DRPG.Listen.anonymous", { room: target, n: count })
            : game.i18n.format("DRPG.Listen.emptyRoom", { room: target }));
    } else {
        done.push(def.failure);
    }

    return {};
}

/**
 * Observe, Analyze, Direct Murder and a described Search all end in a human
 * ruling. A die cannot take that back, so the GM is asked again with the new
 * number and told the previous answer no longer stands.
 */
async function settleGmRuling(actor, bookmark, after, done) {
    const { callGm } = await import("./gm-bridge.mjs");

    await callGm(actor, {
        title: bookmark.label ?? game.i18n.localize("DRPG.Reroll.title"),
        request: bookmark.request ?? "",
        room: bookmark.room ?? null,
        roll: {
            trait: bookmark.trait,
            total: after.total,
            isCritical: after.isCritical,
            withHope: after.withHope,
            withFear: after.withFear
        },
        body: `<p class="drpg-warning">${game.i18n.format("DRPG.Reroll.rulingVoid", {
            old: bookmark.total ?? "?", new: after.total
        })}</p>`
    });

    done.push(game.i18n.localize("DRPG.Reroll.gmReasked"));
    return {};
}

/* ==========================================================================
 * SHARED PIECES
 * ========================================================================== */

/**
 * Bring the trace into line with the new roll: retune it, remove it, or leave
 * one where the first roll left none.
 *
 * All three cases are real. A trace whose visibility came from dice that no
 * longer exist is simply wrong; a trace left by an action that no longer
 * succeeds should not be there; and a roll that fails and is then rerolled into
 * a success has to leave the trace the first attempt never earned. Only the
 * first of the three used to happen, so a Search rerolled from nothing into a
 * crime tool put the tool in the inventory and left no evidence at all.
 *
 * Editing or creating a token is GM-only, so a player's request goes over the
 * bridge exactly as placing one does.
 *
 * @param {Actor} actor
 * @param {object} bookmark
 * @param {string|null} visibility  New band, or null when there should be none.
 * @param {object|null} [drop]      What to create if there is no trace yet.
 * @returns {Promise<object>} bookmark fields describing where the trace now is.
 */
async function settleRemnant(actor, bookmark, visibility, done, drop = null) {
    const { retuneRemnant, dropRemnant } = await import("./remnants.mjs");

    // Nothing there yet.
    if (!bookmark.remnantId) {
        if (visibility === null) return {};

        if (!drop) {
            // Placed on a player's behalf, so this client never learned its id.
            done.push(game.i18n.localize("DRPG.Reroll.remnantManual"));
            return {};
        }

        const placed = await dropRemnant(actor, { ...drop, visibility });
        const doc = placed?.document ?? placed;
        done.push(game.i18n.format("DRPG.Reroll.remnantLeft", { visibility }));
        return doc?.id
            ? { remnantId: doc.id, remnantScene: doc.parent?.id ?? canvas?.scene?.id ?? null }
            : {};
    }

    if (visibility === null) {
        await retuneRemnant(bookmark.remnantScene, bookmark.remnantId, { remove: true });
        done.push(game.i18n.localize("DRPG.Reroll.remnantRemoved"));
        return { remnantId: null, remnantScene: null };
    }

    await retuneRemnant(bookmark.remnantScene, bookmark.remnantId, { visibility });
    done.push(game.i18n.format("DRPG.Reroll.remnantRetuned", { visibility }));
    return {};
}

/**
 * A critical on Work on Project returns the action it cost. Gaining or losing
 * that critical on a reroll has to move the action with it.
 *
 * @returns {Promise<boolean>} whether the action is refunded after this.
 */
async function settleActionRefund(actor, bookmark, shouldRefund, done) {
    const wasRefunded = Boolean(bookmark.refunded);
    if (wasRefunded === shouldRefund) return wasRefunded;

    const { refundAction, spendAction } = await import("./actions.mjs");

    if (shouldRefund) {
        await refundAction(actor, 1);
        done.push(game.i18n.localize("DRPG.Action.actionReturned"));
        return true;
    }

    // The crit is gone, so the free action goes with it. If they have already
    // spent it there is nothing to take, and saying so beats a silent failure.
    const taken = await spendAction(actor, 1);
    done.push(game.i18n.localize(taken
        ? "DRPG.Reroll.actionTakenBack"
        : "DRPG.Reroll.actionOwed"));
    return false;
}
