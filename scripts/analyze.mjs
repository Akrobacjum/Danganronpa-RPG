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
import {
    TRUTH_BULLET_FLAGS, secretOf, isTruthBullet, bulletDescription, faintOf, NOT_AN_EDIT
} from "./truth-bullets.mjs";
// The trace's own `public` record, for a reading a bullet's secret was minted
// without (T-2). Static: remnants.mjs does not import this file.
import { remnantPublicById } from "./remnants.mjs";
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
            // the rest of the truth - an un-analysed bullet knows nothing.
            [`flags.${MODULE_ID}.${TRUTH_BULLET_FLAGS.sourceAction}`]: null,
            [`flags.${MODULE_ID}.${TRUTH_BULLET_FLAGS.tiedToCrime}`]: null,
            // And Faint, which `identify` joined to this list in 1.2.47 and this
            // undo was never told about: a rerolled Analyze that lost left the
            // doubtful-trace badge the first throw had published. `faintOf` reads
            // the secret first, so taking the flag off the item loses nothing.
            [`flags.${MODULE_ID}.${TRUTH_BULLET_FLAGS.faint}`]: null,
            // The reading goes back too, ITEM AND DESCRIPTION BOTH. Clearing the
            // flag and leaving the rendered paragraph would hand the reroll for
            // free: the player reads the sentence off their own sheet while the
            // module believes they never bought it. The secret still holds it,
            // so the second throw can pay out exactly the same words.
            [`flags.${MODULE_ID}.${TRUTH_BULLET_FLAGS.analyzedText}`]: "",
            "system.description": bulletDescription(
                item.getFlag(MODULE_ID, TRUTH_BULLET_FLAGS.playerText) ?? "")
        };
        if (item.getFlag(MODULE_ID, TRUTH_BULLET_FLAGS.lockedChapter) === chapter) {
            patch[`flags.${MODULE_ID}.${TRUTH_BULLET_FLAGS.lockedChapter}`] = null;
        }
        try {
            // NOT_AN_EDIT: see truth-bullets.mjs. Without it this cleared reading
            // travelled up to the trace and wiped it for every holder.
            await item.update(patch, { [NOT_AN_EDIT]: true });
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
    // The moment of analysis is when four more facts go public - which action
    // left the source trace (the Remnant token's icon on this player's map),
    // whether it belongs to the murder (the pack's sort), whether the connection
    // is doubtful at all (Faint), and what the lab actually says about the
    // object. All four were waiting in the bullet's secret since creation, so a
    // trace the killer has since wiped still identifies completely.
    const secret = secretOf(item.uuid);

    /*
     * THE SECRET IS THE FAST PATH, THE TRACE IS THE FALLBACK (T-2).
     *
     * `propagateRemnantPublic` files a rewritten reading into every copy's
     * secret, analysed or not - but only the copies it can see at that moment.
     * A copy minted afterwards from a trace that was already revealed is never
     * reconciled by `revealSourceOf`, and a secret filed on another GM's
     * browser may not have reached this one, so a secret can hold "" while the
     * trace holds the GM's words. `identify` only ever runs on a GM's client,
     * which can read the trace's `public` record directly: one lookup here
     * instead of an audit of every creation site. A bullet with no trace
     * behind it keeps whatever its secret was given.
     */
    const analyzedText = secret.analyzedText
        || remnantPublicById(secret.sceneId, secret.remnantId)?.analyzedText
        || "";
    try {
        await item.update({
            [`flags.${MODULE_ID}.${TRUTH_BULLET_FLAGS.shownType}`]: realType,
            [`flags.${MODULE_ID}.${TRUTH_BULLET_FLAGS.analyzed}`]: true,
            [`flags.${MODULE_ID}.${TRUTH_BULLET_FLAGS.sourceAction}`]: secret.sourceAction ?? null,
            [`flags.${MODULE_ID}.${TRUTH_BULLET_FLAGS.tiedToCrime}`]: secret.tiedToCrime ?? null,
            /* Faint joined this list in 1.2.47. It used to sit on the item from
               creation, so the badge announced a doubtful trace to somebody who
               had not analysed it - `faintOf` knows both roads for a world made
               before that. */
            [`flags.${MODULE_ID}.${TRUTH_BULLET_FLAGS.faint}`]: faintOf(item),
            [`flags.${MODULE_ID}.${TRUTH_BULLET_FLAGS.analyzedText}`]: analyzedText,
            // Rebuilt from the FLAG rather than patched onto whatever the
            // description currently holds: a GM may have rewritten the Observe
            // half since this bullet was created, and the flag is the copy that
            // followed that edit. Reading the rendered HTML back would make the
            // description its own source of truth, which is how the two halves
            // would start to disagree.
            "system.description": bulletDescription(
                item.getFlag(MODULE_ID, TRUTH_BULLET_FLAGS.playerText) ?? "", analyzedText)
        }, { [NOT_AN_EDIT]: true });
    } catch (err) {
        error("Could not identify the Truth Bullet after a successful Analyze", err);
        return;
    }

    const label = TRUTH_BULLET_TYPES[realType]?.label ?? realType;
    /* A BULLET THAT CAME OUT NEUTRAL GETS THE SENTENCE FOR THAT (ACT-10). The
       per-type `hint` is the UN-analysed line, and for neutral it reads "analysis
       turns it into a real category" - printed, until now, on the card announcing
       the analysis that did not. */
    const hint = (realType === "neutral"
        ? (TRUTH_BULLET_TYPES.neutral.analysedHint ?? TRUTH_BULLET_TYPES.neutral.hint)
        : TRUTH_BULLET_TYPES[realType]?.hint) ?? "";

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
    /*
     * THE CARD CARRIES THE READING, NOT JUST THE CATEGORY.
     *
     * The category alone is a label; the sentence the GM wrote for analysis is
     * the thing the player actually spent a Head roll on, and asking them to go
     * and reopen their inventory to find out what they bought is the same
     * mistake the Observe card would be making if it named the trace and left
     * the description on the sheet. It is on the item as well - this is the
     * announcement, the item is the record.
     *
     * `typeHint` is the module's own line about what this CATEGORY means and it
     * stays where it was, under the reading: general first-read guidance after
     * the specific fact, not instead of it.
     */
    await whisperToOwner(actor, `
        <h3>${game.i18n.localize("DRPG.Analyze.identifiedTitle")}</h3>
        <p>${game.i18n.format("DRPG.Analyze.identified", {
            a: article(label),
            name: foundry.utils.escapeHTML(item.name),
            type: foundry.utils.escapeHTML(label)
        })}</p>
        ${analyzedText ? `<p class="drpg-bullet-analysis"><strong>${
            game.i18n.localize("DRPG.TruthBullet.analysisHeading")
        }</strong> ${foundry.utils.escapeHTML(analyzedText)}</p>` : ""}
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
                gmBody: `<p>${game.i18n.format("DRPG.Analyze.critPrompt", {
                    a: article(label),
                    actor: foundry.utils.escapeHTML(actor.name),
                    name: foundry.utils.escapeHTML(item.name),
                    type: foundry.utils.escapeHTML(label)
                })}</p>`,
                // The hint is the answer, so the card carries the way to give
                // it; nothing to refund, the Analyze already resolved (COMM-07).
                actions: [
                    { action: "reply", label: game.i18n.localize("DRPG.Bridge.reply"), data: { by: actor.id } },
                    { action: "decline", label: game.i18n.localize("DRPG.Bridge.nothingThere"),
                      data: { by: actor.id, cost: "0" } }
                ]
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
