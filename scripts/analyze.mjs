/**
 * Danganronpa RPG - Analyze, resolved on the GM's client.
 * ---------------------------------------------------------------------------
 * Guide, p. 30: a Head roll turns a Neutral Truth Bullet into an identified
 * one. The difficulty is read from a table indexed by how visible the original
 * trace was and by what the bullet REALLY is - and a failed attempt locks that
 * bullet away from that player until the end of the chapter:
 *
 *   "Nieudany rzut na analizę blokuje temu graczowi dostęp do analizy tego
 *    Truth Bulletu do końca rozdziału. Truth Bullet pozostaje aktywny ale w
 *    Neutral kategorii."
 *
 * Same split as Observe, for the same reason. Half of the difficulty lookup is
 * the answer the roll is trying to buy, so the observer's client cannot compute
 * it without being handed the thing it is asking for. The player picks a bullet
 * and throws Head; the number comes here, and the verdict goes back.
 *
 * Unlike Observe there is no target-picking phase: the player chooses which of
 * their own bullets to work on, which is entirely their business.
 */

import { MODULE_ID, analyzeDc, TRUTH_BULLET_TYPES } from "./config.mjs";
import { TRUTH_BULLET_FLAGS, secretOf, isTruthBullet } from "./truth-bullets.mjs";
// The trace's own ledger entry, for the sentence a bullet's secret may have been
// minted without (T-2). Static: remnants.mjs does not import this file.
import { remnantData } from "./remnants.mjs";
import { whisperToOwner, whisperToGms, log, warn, error, article } from "./utils.mjs";

/**
 * Score a thrown Analyze against the bullet's real category.
 *
 * @param {object} options
 * @param {string} options.actorId
 * @param {string} options.itemId
 * @param {number} options.total
 * @param {boolean} options.isCritical
 * @param {boolean} [options.undo]  A Reroll replacing an earlier attempt.
 * @returns {Promise<{success: boolean, locked: boolean}|null>}
 */
export async function resolveAnalyze({
    actorId, itemId, total, isCritical = false, undo = false
} = {}) {
    if (!game.user.isGM) return null;

    const actor = game.actors.get(actorId);
    const item = actor?.items?.get(itemId);
    if (!actor || !item || !isTruthBullet(item)) {
        warn(`Analyze: no Truth Bullet ${itemId} on ${actorId}.`);
        return null;
    }

    const { getClock } = await import("./clock.mjs");
    const chapter = getClock().chapter;

    // A Reroll buys back the dice, not the attempt. Whatever the first throw
    // decided about this bullet is wound back before the second is scored.
    //
    // No stored record is needed: an analysable bullet has exactly one prior
    // state - shown as Neutral, not analysed, unlocked. The lock is only lifted
    // when it belongs to THIS chapter, so a genuine older lock survives.
    if (undo) {
        const patch = {
            [`flags.${MODULE_ID}.${TRUTH_BULLET_FLAGS.shownType}`]: "neutral",
            [`flags.${MODULE_ID}.${TRUTH_BULLET_FLAGS.analyzed}`]: false,
            // The three facts `identify` published go back into the secret with
            // the rest of the truth - an un-analysed bullet knows nothing. The
            // sentence goes back as "", which is what creation writes.
            [`flags.${MODULE_ID}.${TRUTH_BULLET_FLAGS.sourceAction}`]: null,
            [`flags.${MODULE_ID}.${TRUTH_BULLET_FLAGS.tiedToCrime}`]: null,
            [`flags.${MODULE_ID}.${TRUTH_BULLET_FLAGS.analysisText}`]: ""
        };
        if (item.getFlag(MODULE_ID, TRUTH_BULLET_FLAGS.lockedChapter) === chapter) {
            patch[`flags.${MODULE_ID}.${TRUTH_BULLET_FLAGS.lockedChapter}`] = null;
        }
        try {
            await item.update(patch);
        } catch (err) {
            error("Could not wind back the Analyze a reroll undid", err);
        }
    }

    const visibility = item.getFlag(MODULE_ID, TRUTH_BULLET_FLAGS.visibility) ?? "evident";
    const realType = secretOf(item.uuid).realType ?? "neutral";
    const dc = analyzeDc(visibility, realType);

    // `null` is the guide's "Bez rzutu" - Key, Autopsy and Final identify
    // themselves. Treated as an automatic conversion rather than as a missing
    // number, so a bullet the GM deliberately handed over as "unidentified"
    // still resolves instead of jamming.
    const success = dc === null || isCritical || total >= dc;

    if (!success) {
        await lockOut(item, actor, chapter, total);
        return { success: false, locked: true };
    }

    await identify(item, actor, realType, isCritical, dc, total);
    return { success: true, locked: false };
}

/**
 * A failure does not take the bullet away - it takes this player's ability to
 * work on it. The stamp is on the item, so a copy handed to somebody else
 * (Stage 4) carries no lock: it is a different item.
 */
async function lockOut(item, actor, chapter, total) {
    try {
        await item.update({
            [`flags.${MODULE_ID}.${TRUTH_BULLET_FLAGS.lockedChapter}`]: chapter
        });
    } catch (err) {
        error("Could not lock the Truth Bullet after a failed Analyze", err);
    }

    // ON THE CARD, NOT THROUGH `playSfx` - and the same correction applies to
    // `identify` below. See the note there: this function only ever runs on a
    // GM's browser.
    await whisperToOwner(actor, `
        <p><strong>${game.i18n.localize("DRPG.Analyze.failedTitle")}</strong></p>
        <p>${game.i18n.format("DRPG.Analyze.failed", {
            name: foundry.utils.escapeHTML(item.name)
        })}</p>`, { flags: { [MODULE_ID]: { sfx: "analyzeMiss" } } });

    log(`Analyze: ${actor.name} rolled ${total} on "${item.name}" and locked it for chapter ${chapter}.`);
}

/** Success converts the bullet: what it really is becomes what the player sees. */
async function identify(item, actor, realType, isCritical, dc, total) {
    // The moment of analysis is when three more facts go public - which action
    // left the source trace (the Remnant token's icon on this player's map),
    // whether it belongs to the murder (the pack's sort), and what the GM wrote
    // about this trace for the moment somebody read it (T-2). All three were
    // waiting in the bullet's secret since creation, so a trace the killer has
    // since wiped still identifies completely.
    const secret = secretOf(item.uuid);

    /*
     * THE TRACE IS THE SOURCE OF TRUTH, THE SECRET IS THE FAST PATH (T-2, 18.09).
     *
     * The secret gets `analysis` at creation and from `propagateAnalysis`, which
     * covers every route - but only if every route was reached. A bullet minted
     * before the GM wrote the sentence, or on a second GM whose ledger request
     * went unanswered, has a secret with nothing in it. `identify` only ever runs
     * on a GM's client, so the trace itself can answer here: one line instead of
     * an audit trail across four creation sites.
     */
    const said = secret.analysis
        || remnantData(game.scenes.get(secret.sceneId)?.tokens?.get(secret.remnantId))?.analysis
        || "";

    try {
        await item.update({
            [`flags.${MODULE_ID}.${TRUTH_BULLET_FLAGS.shownType}`]: realType,
            [`flags.${MODULE_ID}.${TRUTH_BULLET_FLAGS.analyzed}`]: true,
            [`flags.${MODULE_ID}.${TRUTH_BULLET_FLAGS.sourceAction}`]: secret.sourceAction ?? null,
            [`flags.${MODULE_ID}.${TRUTH_BULLET_FLAGS.tiedToCrime}`]: secret.tiedToCrime ?? null,
            [`flags.${MODULE_ID}.${TRUTH_BULLET_FLAGS.analysisText}`]: said
        });
    } catch (err) {
        error("Could not identify the Truth Bullet after a successful Analyze", err);
        return;
    }

    const label = TRUTH_BULLET_TYPES[realType]?.label ?? realType;
    // THE TRACE'S OWN SENTENCE IF THERE IS ONE (T-2). The per-type line is the
    // same for every Prep trace in the season; a GM who wrote about THIS one said
    // something the type sentence cannot. A trace with nothing written keeps the
    // generic line, which is what this has always printed.
    const hint = said || TRUTH_BULLET_TYPES[realType]?.hint || "";

    /*
     * THE SOUND RIDES THE CARD, AND IT USED NOT TO - a bug this file carried
     * from E5 until a play-through of the new sounds walked into it.
     *
     * `playSfx` at the top of this function claimed to be "local: whoever ran
     * the Analyze is the client this is running on", and that was simply false.
     * `resolveAnalyze` opens with `if (!game.user.isGM) return null`, so
     * `identify` and `lockOut` have only ever executed on a GM's browser: the
     * catalogue promised "heard by the student who ran it" and the GM heard it
     * instead, alone. Nobody would report that - the GM hears a plausible noise
     * at a plausible moment, and the player hears nothing they were told to
     * expect.
     *
     * The card is the fix because the card already has the audience the sound
     * wanted. `onCreateChatMessage` plays it for the people the whisper names
     * and leaves GMs out unless the flag says otherwise, which is exactly
     * "heard by the student who ran it".
     */
    await whisperToOwner(actor, `
        <h3>${game.i18n.localize("DRPG.Analyze.identifiedTitle")}</h3>
        <p>${game.i18n.format("DRPG.Analyze.identified", {
            a: article(label),
            name: foundry.utils.escapeHTML(item.name),
            type: foundry.utils.escapeHTML(label)
        })}</p>
        ${hint ? `<p><em>${foundry.utils.escapeHTML(hint)}</em></p>` : ""}`,
        { flags: { [MODULE_ID]: { sfx: "analyzeHit" } } });

    // The critical's second half is a human's to give, so the GMs are told to
    // give it rather than the module inventing one. Through the messenger, not
    // a bare GM whisper: this WAITS on an answer, and the thread is both where
    // the GM is interrupted for asks (the `gmAsk` notifier) and where their
    // reply already has a road back to the player. The whisper it replaces
    // sat in the sidebar log, which after the notification diet nobody was
    // told to read.
    if (isCritical) {
        try {
            const { callGm } = await import("./gm-bridge.mjs");
            await callGm(actor, {
                title: game.i18n.localize("DRPG.Analyze.critTitle"),
                body: game.i18n.format("DRPG.Analyze.critPrompt", {
                    a: article(label),
                    actor: foundry.utils.escapeHTML(actor.name),
                    name: foundry.utils.escapeHTML(item.name),
                    type: foundry.utils.escapeHTML(label)
                })
            });
        } catch (err) {
            // The old road, so a broken bridge cannot swallow the guide's owed
            // hint outright.
            error("Could not put the Analyze critical to the GM", err);
            await whisperToGms(`
                <p><strong>${game.i18n.localize("DRPG.Analyze.critTitle")}</strong></p>
                <p>${game.i18n.format("DRPG.Analyze.critPrompt", {
                    a: article(label),
                    actor: foundry.utils.escapeHTML(actor.name),
                    name: foundry.utils.escapeHTML(item.name),
                    type: foundry.utils.escapeHTML(label)
                })}</p>`);
        }
    }

    log(`Analyze: ${actor.name} rolled ${total} vs DC ${dc ?? "-"} and identified "${item.name}" as ${realType}.`);
}
