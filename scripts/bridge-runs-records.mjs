/**
 * Danganronpa RPG - the bridge's runs: the records the GMs keep.
 * ---------------------------------------------------------------------------
 * The runs of BRIDGE_ACTIONS that write a record the GMs hold, each with the
 * derives its declaration reads: a project's progress, share, sabotage,
 * change, undo and send-back (`progressOf`, `repairOf`, `sabotageAgain`), the
 * Remnants (`TRACE_OF_ROLL`, `traceBandOf`, `dynamicRulingOf`), the loot, the
 * Calls armed (`armedEntry`, `tellBeneficiary`, `armPaidByPlayer` - R290's
 * two jobs and their callees together), the Overflow and Despair, an Eclipse
 * move, notes, bookmarks, the Reroll, the audit's decision, the Keys' fee, the
 * trial's record, entry, vote, floor, Objection, evidence, turn, claim and
 * Present, the readiness round, the reshape ruling, the observe pick, and a
 * card's claim and post.
 *
 * WHERE IT SITS. Moved out of gm-bridge.mjs by E41 C5a (1.2.97), a pure move
 * that `node tools/moved-only.mjs` proves line by line, in gm-bridge.mjs's
 * order. The runs and derives the table names are exported for it;
 * gm-bridge.mjs re-exports `dynamicRulingOf`, which it exported. Nothing here
 * imports gm-bridge.mjs (the facade rule, .claude/rules/code.md).
 */

import { HOPE_CALLS, DESPAIR_CALLS, TIMING, ACTIONS, DYNAMIC_THRESHOLDS } from "./config.mjs";
import { announce, whisperToOwner, debug, error, cardHead } from "./utils.mjs";
import {
    firstRefusal, armBuyerId, guardArmLiving, guardArmNotHeld, guardArmBuyer, guardArmOtherCharacter,
    guardArmHopeCallAllowed, guardArmBuyerHope, guardArmGmYes
} from "./bridge-guards.mjs";
import { cardFlag, cardWriter } from "./secret.mjs";
import { claimOnPrimary, observePickOnPrimary } from "./call-gm.mjs";

export async function handleProgress(payload, sender, ctx) {
    const { asker } = ctx;
    // Sight of the project and the size of the step are the declaration's
    // guards now; progress taken back is the GM's own Reroll's - see `guardUndoIsTheGms`.
    // A Work on a Project's amount is what its roll earned, on the GMs' record (`progressOf`).
    const amount = Math.trunc(payload.amount);
    const { addProgress } = await import("./projects.mjs");
    const rolls = await import("./action-rolls.mjs");
    // The roll this progress is for, as the request arrives (E08+E28 C2): see `noteProgressFact`.
    const kept = amount > 0 && payload.rollId ? await rolls.rollOfSenderNaming(sender.id, "project", payload.rollId) : null;
    const roll = kept?.messageId === payload.rollId ? kept : null;
    // Who asked, so a finished project can fall back to them when nobody
    // recorded who proposed it; and whose character's roll it was (`owns`), so the change is that
    // character's in the entry (E36 C3): a completion row that keeps a project for a Reroll reads it.
    const result = await addProgress(payload.countdownId, amount, { by: asker, actorId: payload.actorId ?? null, kind: sender.isGM ? "gm" : "player" });
    debug(`Applied ${amount} progress to ${payload.countdownId} on behalf of a player.`, result);
    // Null: the project is not there any more - nothing was added, and the asker
    // is told so once, by the refusal (E31 review). A project that did not move
    // (already full) is an answer, whispered below; a frozen one is refused
    // before this since E08+E28 C16 (`guardProjectFrozen`).
    if (!result) return { refused: "nothing was carried out: addProgress found no such project" };
    await noteProgressFact(rolls, roll, payload.countdownId, result);

    // Report back to whoever asked.
    //
    // A player cannot see whether their request arrived, was applied, or was
    // clamped to nothing - so a project that refused to move looked exactly
    // like a socket that never fired. Now it says which of the three it was.
    const to = asker ? [asker] : [];
    if (!to.length) return;

    const line = result.changed === false
        ? game.i18n.format(result.reason ?? "DRPG.Project.alreadyFull", {
              name: result.name, current: result.from, target: result.target
          })
        : game.i18n.format("DRPG.Project.now", {
              project: result.name, current: result.to, target: result.target
          });

    await announce({
        content: `<p><strong>${game.i18n.localize("DRPG.Project.title")}</strong> - ${
            foundry.utils.escapeHTML(line)
        }</p>`,
        whisper: to
    });
}

/**
 * THE PROGRESS A PLAYER'S PROJECT ROLL ADDED, ON THE GMS' BOOKMARK (E08+E28 C2). The packet
 * names no character; a Work on a Project names its roll's message, and it is written only
 * when that is the sender's newest kept Work on a Project (`rollOfSender`). A Call's progress
 * names no roll, and a Reroll's taking back (a negative amount) writes none. What moved, from
 * the project's own answer: a full project adds 0 (a frozen one is refused before, `guardProjectFrozen`).
 */
async function noteProgressFact(rolls, roll, projectId, result) {
    if (!roll) return;
    const progress = result.changed === false ? 0 : (Number(result.to) || 0) - (Number(result.from) || 0);
    await rolls.noteRollFact(roll.actorId, roll.messageId, { projectId, progress });
}

export async function handleShare(payload, sender, ctx, prepared) {
    // projects.mjs came in the declaration's `prepare`, before the guards, as it
    // was imported here: sight asked again with nothing awaited before the write.
    // The guards import, and a project resealed in between must not be shared out.
    const { canSee, shareWith } = prepared;
    if (!canSee(payload.countdownId, sender)) return { refused: "sender cannot see that project" };

    // Null: the project is not secret any more, and nothing was shared (E31 review).
    // The sender named: a share a finder of the project asked makes the one let in a finder too (E15 part 2 fix e1-G1).
    if (!await shareWith(payload.countdownId, payload.targetUserId, { senderId: sender.id })) {
        return { refused: "nothing was carried out: shareWith shared nothing" };
    }
    debug(`Shared project ${payload.countdownId} with ${payload.targetUserId} on behalf of a player.`);
}

/** The actions whose Reroll takes back the trace their roll left (reroll.mjs `settleSearch`, `settleSabotage`, `settleDynamic`). */
export const TRACE_OF_ROLL = Object.freeze(["search", "sabotage", "dynamic"]);

export async function handleRemnant(payload, sender, ctx) {
    /*
     * REBUILT, NOT NARROWED (CASE-13, then E03; audit S05-13, S10-10). A
     * player's action leaves a Preparation trace, or a Tamper one after a
     * murder; it never plants a Key, Final Truth or Autopsy Remnant, never a
     * reinforced one, and never decides for itself that it is tied to the
     * crime. Narrowing those three still took who left it, where, pointing at
     * whom and whether the sweep would clear it from the packet - see
     * `narrowPlayerRemnant`, which now builds every one of them here.
     */
    const { placeRemnant, narrowPlayerRemnant } = await import("./remnants.mjs");
    const { noteFactOfRoll } = await import("./action-rolls.mjs");
    let data = { ...(payload.data ?? {}) };
    if (!sender.isGM) {
        const actor = game.actors.get(data.sourceActor);
        const { locateActor } = await import("./movement.mjs");
        const { getClock } = await import("./clock.mjs");
        // Not split into a guard (E03): it refuses and rebuilds from ONE reading of
        // where the character stands, and split, the two could read two places.
        const narrowed = narrowPlayerRemnant(data, actor, locateActor(actor, { sceneId: data.sceneId ?? null }), getClock());
        if (narrowed.refused) return { refused: narrowed.refused };
        data = narrowed.data;
        /* NO DISCARD IN THE CLASS TRIAL (E51 C6, 31.10.2026; amend 14.10 (2); Q1: the phase; E51-41). The discarder's
           browser refuses it before its window (use-items.mjs `discardBroken`, `noDiscardNow`), so a discard's trace
           that reaches the primary in the trial is a console's, or a discard begun before the trial and landing in it.
           Refused before its type is filed and before anything is placed, so the browser, answered refused, keeps the
           item (`trustedDelete` runs only on a trace placed); the roll is spent, and the whisper there says so. */
        if (data.action === "discard" && getClock()?.phase === "classTrial") return { refused: "that waits until the Class Trial is over" };
        /* A DISCARD'S TYPE IS THE GM'S (E14 part 1 C5, 24.10.2026; audit S08-13). `narrowPlayerRemnant` keeps the
           packet's type within Preparation and Tamper, and the discarder's browser chose it by what it could read: an
           innocent's browser cannot see whose incident runs, and a console could file a weapon's disposal as preparation.
           Filed here by the same reading on what the GMs hold (use-items.mjs `discardRemnantType`). */
        if (data.action === "discard") data.type = await (await import("./use-items.mjs")).discardRemnantType(actor);
        if (await worksOwnMurder(payload, actor, data.action, sender)) data.tiedToCrime = true;
    }
    // A trace this client could not place (no scene, no Remnant actor, a token
    // that could not be created) is a failure, not "placed" (E31 review): the
    // player's item stays on the sheet.
    const placed = await placeRemnant(data);
    if (!placed) return { refused: "the trace could not be placed" };
    /* THE DISCARD'S TICKET (E51 fix FG5; the end review's S1): the deletion the discarder's browser makes next stands on
       this trace placed, once (sheet-audit.mjs `noteDiscardTrace`); a stamped delete with no trace behind it is flagged. */
    if (!sender.isGM && data.action === "discard") (await import("./sheet-audit.mjs")).noteDiscardTrace(data.sourceActor, data.subject);
    /* WHICH TRACE, ON THE GMS' BOOKMARK (E08+E28 C2; audit S05-08). The player's browser is
       answered as before, with no id: a Reroll that retunes or removes this trace is the GM's
       from C4a, and finds it by this fact - the browser's `remnantRef` named none. Written on
       the row of the roll the packet names, when it is the sender's roll of this character and
       its action is one whose replay owns a trace and placed this one (fix r1-G1; the review's
       M3 = S2): until then it went on the character's newest row, whatever had placed it, and a
       discarded item's trace became the Search's before it, for that Search's Reroll to lift. A
       placement naming no roll writes none. */
    const doc = placed.document ?? placed;
    const owner = TRACE_OF_ROLL.includes(data.action) ? [data.action] : [];
    if (doc?.id && payload.rollId && owner.length) {
        await noteFactOfRoll(payload.rollId, { by: sender.id, actorId: data.sourceActor, actions: owner },
            { remnantId: doc.id, remnantScene: doc.parent?.id ?? data.sceneId ?? null });
    }
    debug("Placed a Remnant on behalf of a player.");
}

/**
 * A PLAYER'S WORK ON THEIR OWN INDIRECT MURDER IS THE CRIME'S TRACE (E32+E07 fix r2-G3, 03.10.2026;
 * the round-2 review's C2-m9 (a)). The module's own drop says so (action-project.mjs
 * `hideProjectTraces`: an indirect murder is the murder, built in instalments), and the rebuild
 * above drops every packet's `tiedToCrime` - so since E03 a trap built from a player's browser left
 * untied traces, which the chapter's end sweeps. Judged here on the GMs' record, not on the packet:
 * the project it names is an indirect murder, and the sender's character is its killer or the one
 * who proposed it.
 *
 * AND A SABOTAGE OF IT (E09 C5, 08.10.2026; audit S10-17). The roller's browser ties the trace of a
 * Sabotage of an indirect murder (action-project.mjs `dropSabotageTrace`) and the rebuild dropped that
 * too, so the killer's Sabotage of their own trap left an untied trace (read in the code at C5's parent:
 * this answered false for every action but a Work; the tier-2 tests' red is in C5's message). The
 * project is not the packet's: it is the target `handleSabotage` noted on the GMs' row of the roll the
 * trace names (`noteFactOfRoll`; parked there while the row is not kept yet - `factsOfRoll`), and that
 * row must be the sender's Sabotage roll of the trace's own character. The tie then asks the same as
 * a Work's: an indirect murder whose killer or proposer is that character (projects.mjs
 * `buildsOwnMurder`, which a GM's own drop asks too since E09 fix r1-G4). A bystander's Sabotage of
 * somebody else's trap leaves an untied trace, as the plan decided (E09 plan, C5). A Sabotage of a
 * project already frozen freezes nothing and notes its target all the same since fix r1-G4
 * (`handleSabotage`; the round-1 security review's F7): until then its trace was left undecided where
 * the same Sabotage of a trap not frozen yet was tied (tier 2 "a Sabotage of the saboteur's own trap
 * already frozen leaves a tied trace").
 */
async function worksOwnMurder(payload, actor, action, sender) {
    if (!actor) return false;
    let projectId = null;
    if (action === "project") projectId = payload.data?.projectId;
    else if (action === "sabotage") {
        const { factsOfRoll } = await import("./action-rolls.mjs");
        projectId = (await factsOfRoll(payload.rollId, { by: sender.id, actorId: actor.id, actions: ["sabotage"] }))?.targetProjectId;
    }
    if (typeof projectId !== "string" || !projectId) return false;
    const { buildsOwnMurder } = await import("./projects.mjs");
    return buildsOwnMurder(projectId, actor.id);
}

/*
 * A TRACE'S BAND IS THE GM'S (E08+E28 C15, 04.10.2026; audit S10-06; the plan's 3.5). A player's
 * Search, Sabotage or Dynamic action leaves a trace whose visibility its roll decides, and the
 * packet said which: a console could leave every trace hidden. The packet names that roll now
 * (`rollId`, as it has since fix r1-G1 for the GMs' row), and the band is read off the GMs' record
 * of it with the action's own table, as the roller's browser reads it:
 *   - a Search: the tier its total reaches with the hidden stash's step the GM drew, or the
 *     critical's band (action-search.mjs `searchTier`, `leaveSearchTrace`);
 *   - a Sabotage: the band its total reaches (`sabotageHit`), with the concealment's penalty and
 *     the readied tool's relief the roller claimed for that roll (the GMs' bookmark,
 *     `ROLL_CLAIMS.sabotage`), held as its repair holds them (action-project.mjs
 *     `sabotageExtrasHeld`) - the concealment's own roll names no action, so its Despair is not on
 *     a record yet; a miss leaves the table's `failureRemnant`. The relief was the tool readied
 *     on the sheet now until fix r2-H3 (the round-2 review's S2-9): a tool that broke on a roll
 *     with Fear was in no hand, and the trace of a Sabotage whose repair froze the project was
 *     left at a miss's band;
 *   - a Dynamic action: the difficulty a GM set on its card (`dynamicRulingOf`); a roll under it
 *     leaves no trace (`performDynamic`). The roller's band is no claim since fix r2-H3.
 * A roll that leaves no trace is refused, and a packet whose visibility differs is placed at the
 * GM's band and logged (bridge-guards.mjs `onRecord`). Whether a trace is placed at all is still
 * the roller's browser's: a console that sends no `remnant.place` leaves none, and a Work's trace
 * (`project`, not in `TRACE_OF_ROLL`) takes the band its packet names - .claude/rules/trust-model.md's "What stays
 * open" (the round-2 review's S2-8; fix r2-H7).
 */
export async function traceBandOf(record) {
    let band = null;
    if (record.actionKey === "search") {
        const { searchTier } = await import("./action-rolls.mjs");
        const { hit } = searchTier(record, record.used?.stash?.change ?? 0);
        band = record.isCritical ? ACTIONS.search.critical?.remnant : hit?.remnant;
    } else if (record.actionKey === "sabotage") {
        const { sabotageHit, sabotageExtrasHeld } = await import("./action-rolls.mjs");
        const { rerollBookmarkStore } = await import("./gm-stores.mjs");
        const row = rerollBookmarkStore.get(record.actorId);
        const hit = sabotageHit(record, await sabotageExtrasHeld(record, row?.messageId === record.messageId ? row.claims : null));
        band = hit ? hit.remnant : ACTIONS.sabotage.failureRemnant;
    } else if (record.actionKey === "dynamic") {
        const ruled = DYNAMIC_THRESHOLDS[dynamicRulingOf(record)?.tier];
        if (!ruled) return { why: "no ruling of a GM's sets that roll's band" };
        band = record.isCritical || (Number(record.total) || 0) >= ruled.range[0] ? ruled.remnant : null;
    }
    return band ? { fields: { "data.visibility": band } } : { why: "that roll leaves no trace" };
}

/**
 * The difficulty a GM set on a Dynamic action's card for this roll's character: the newest ruling
 * kept in a card's meta (`keepRuling`, as the primary sends it on) within a Reroll's
 * reach of the roll, as a GM's pick of a statistic is found (roll-draw.mjs `gmPickOf`), or null.
 * `record` needs `actorId` and `at`; the Reroll's replay reads it too (reroll.mjs `settleDynamic`).
 * A card counts only where a GM wrote it (secret.mjs `cardWriter`; E29 fix r2-H2, 05.10.2026, the
 * round-2 security review's B2): until then any card's `ruling` was read, the document's flag
 * first - at a4a7f25's runtime a card a player's browser posted after a GM's was the difficulty
 * read (tier 2 and 30-security, e29run/r2h2red), and with it, by reading, the band of that
 * character's trace and of its Reroll.
 */
export function dynamicRulingOf(record) {
    const since = (record.at ?? 0) - TIMING.rerollWindowMinutes * 60_000;
    const messages = game.messages?.contents ?? [];
    for (let i = messages.length - 1; i >= 0; i--) {
        const message = messages[i];
        if (typeof message.timestamp === "number" && message.timestamp < since) break;
        const ruling = cardFlag(message, "ruling");
        if (ruling?.type === "dynamic" && ruling.actorId === record.actorId && cardWriter(message)?.isGM) return ruling;
    }
    return null;
}

/*
 * WHAT A PROJECT'S ROLL EARNED IS THE GM'S (E08+E28 C16, 04.10.2026; audit S10-08, S10-06; the plan's
 * 3.5). Progress and a Sabotage's repair were the packet's numbers, held only to a range: a console
 * that named a roll of 7 added 12. The packet names its roll now, and the GM reads what it earned
 * off its record with the action's own table, as the roller's browser reads it (action-project.mjs
 * `projectProgress`, `sabotageHit`, `sabotageRepairScale`). What only the roller saw rides on the
 * packet and is held to what the rules allow (action-project.mjs `projectExtrasHeld`,
 * `sabotageExtrasHeld`, which the Reroll's replays and a Sabotage's trace read too since fix
 * r2-H3): an indirect murder's concealment adds at most `PROJECT_BONUS_MOST`, and to nothing else;
 * a Sabotage's concealment takes off at most what one thrown with Despair takes; the readied
 * tool's relief is at most the GM's reading of the sheet. Read off the packet, not the GMs'
 * bookmark of the roll, because the packet can arrive first (fix r1-G1 measured it so). A Work
 * whose roll earned nothing and claims no held bonus is refused; a Sabotage's miss is a repair of
 * 0, which freezes nothing (`handleSabotage`).
 *
 * A MISS ON A MURDER PLAN PAYS ITS HELD BONUS (E15 C2, 25.10.2026; audit S02-08, the owner's D13).
 * The concealment's bonus rides on any outcome now (action-project.mjs `projectProgress`), so a miss
 * that was refused here adds the bonus its packet claims, held as a hit's is: at most
 * `PROJECT_BONUS_MOST` on an indirect murder, nothing on any other project, whose miss is refused
 * as before. E15-T3 sends a miss claiming 40 to each: 1 and refused.
 */
export async function progressOf(record, payload) {
    const { projectProgress, projectExtrasHeld } = await import("./action-rolls.mjs");
    const { progress } = projectProgress(record, await projectExtrasHeld(record, { relief: payload.relief, bonus: payload.bonus }, payload.countdownId));
    return progress > 0 ? { fields: { amount: progress } } : { why: "that roll earned no progress" };
}

export async function repairOf(record, payload) {
    const { sabotageHit, sabotageRepairScale, sabotageExtrasHeld } = await import("./action-rolls.mjs");
    const { penalty, relief } = await sabotageExtrasHeld(record, { penalty: payload.penalty, relief: payload.relief });
    const hit = sabotageHit(record, { penalty, relief });
    return { fields: { difficulty: hit ? sabotageRepairScale(record, (Number(record.total) || 0) + penalty, relief) : 0 } };
}

export async function handleTieTrace(payload, sender, ctx) {
    // Only the one holding the object, and only in the fight - see `guardTieTraceHolder`.
    const { tieTraceForItem } = await import("./remnants.mjs");
    await tieTraceForItem(payload.identity);
}

export async function handleRemnantEdit(payload, sender, ctx) {
    /*
     * NARROWED, NOT FORWARDED.
     *
     * This used to hand the player's patch straight to `retuneRemnant`, and
     * that was survivable while the only field was a visibility band. G-20
     * gave the function a `type`, and type is a different kind of power: a
     * killer relabelling their own Incident trace as Faint would have the
     * chapter-end sweep clear the crime scene for them, and one relabelled
     * as Key would put a fake anchor into the investigation.
     *
     * So the two fields are read out by name and checked against the same
     * lists the rules use, and everything else in the packet is dropped.
     * `remove` stays as it was - it is the Reroll's own half and
     * `retuneRemnant` already refuses to delete a reinforced trace.
     */
    const { REMNANT_VISIBILITY_LABELS, CLEANUP } = await import("./config.mjs");
    const asked = payload.patch ?? {};
    const narrowed = { remove: Boolean(asked.remove) };
    if (REMNANT_VISIBILITY_LABELS[asked.visibility]) narrowed.visibility = asked.visibility;
    // The type is a GM's to change, never a player's (and since E08+E28 C8 no
    // player edits a trace at all): a player's Reroll sent a band and nothing
    // else, and a trace's type decides who may tamper with it and how hard it
    // is to Observe (E03 second review). The killer's own re-typing goes through cleanup.mjs on the GM.
    if (sender.isGM && CLEANUP.transform?.types?.includes(asked.type)) narrowed.type = asked.type;

    const { retuneRemnant } = await import("./remnants.mjs");
    // Null: no such token, a reinforced trace asked to go, or nothing to change -
    // nothing was done (E31 review), and it is told as refused.
    if (!await retuneRemnant(payload.sceneId, payload.tokenId, narrowed)) {
        return { refused: "nothing was carried out: retuneRemnant changed nothing" };
    }
    debug(`Retuned a Remnant on behalf of ${sender.name}.`, narrowed);
}

/*
 * A SABOTAGE ASKED AGAIN (E18 C7, 26.10.2026; audit S10-43 part 2, the stage's row E18-32): the repair a player's
 * Sabotage made keeps the request it was made under beside its saboteur (projects.mjs `sabotageOfRequest`), so the same
 * sender's resend under that id is answered the first result (bridge-guards.mjs `judge`, `again`) instead of being
 * refused by the roll it settled. A miss made no repair and a refused one none either: their resend is judged anew, and
 * refused, as the first answered nothing.
 */
export async function sabotageAgain(sender, ctx) {
    if (sender.isGM) return null;
    const { sabotageOfRequest } = await import("./projects.mjs");
    const first = sabotageOfRequest(sender.id, ctx.requestId);
    return first ? { reply: first } : null;
}

export async function handleSabotage(payload, sender, ctx) {
    const { sabotageProject } = await import("./projects.mjs");
    const rolls = await import("./action-rolls.mjs");
    /* The repair is what the roll earned, on the GMs' record (`repairOf`); 0 is a miss, which
       freezes nothing and names its target for the GM's Reroll of it (E08+E28 C16; the
       orchestrator's decision of 04.10.2026): until fix r1-G1 the roller's bookmark kept the
       target of any Sabotage, and since then the GM learns it only from this packet, so a miss
       rerolled into a success froze nothing. */
    const difficulty = Math.trunc(payload.difficulty);
    // Who asked, so that only their own Reroll can take it back (E03).
    // And under which request (E18 C7): a resend of it answers this result again (`sabotageAgain`).
    const result = difficulty > 0 ? await sabotageProject(payload.targetId, difficulty,
        { saboteur: sender.isGM ? null : sender.id, requestId: sender.isGM ? null : ctx?.requestId ?? null }) : null;
    /* Which project it froze and the repair it made, for the Reroll's undo on a GM (C4a), on the
       row of the roll the packet names (fix r1-G1; the review's B1). The sender's newest Sabotage
       row, read as the packet arrived, was the previous Sabotage's or none: `roll.bookmark`'s run
       ended after this one in 5 of 5 of the review's runs at f941051 (2 of 3 of its 97 at d20fadb),
       and the Reroll into a miss left the project frozen. The fact now waits for its row (`noteFactOfRoll`); a packet naming no roll
       writes none. Since E09 C5 the fact names the packet's character too: the trace that follows reads
       its target off this fact to decide its tie, and asks it of the trace's character (`worksOwnMurder`);
       `owns` and the roll's record (`rolled.actor`) have held `actorId` to the sender's and the roll's.
       And whatever the freeze did (E09 fix r1-G4, 08.10.2026; the round-1 security review's F7): a
       Sabotage of a project frozen since its picker was drawn freezes nothing, and noted nothing, so
       its trace was left undecided where the C5 rule ties the saboteur's own. The target is the one
       the roll was drawn for (`rolled.named`) and the sender can see (`canSeeProject`); the repair is
       noted only when one was made, so a Reroll of it takes back nothing (reroll.mjs `settleSabotage`). */
    if (payload.rollId) {
        await rolls.noteFactOfRoll(payload.rollId, { by: sender.id, actorId: payload.actorId ?? null, actions: ["sabotage"] },
            { targetProjectId: payload.targetId, repairId: result?.repair?.id ?? null });
    }
    if (!difficulty) return { reply: null };

    // Tell the asker what actually happened - not just that the request
    // arrived. Without this a player's own sabotage always reported success
    // and a repair project by name, whether or not the freeze and the
    // repair it depends on were ever written. The runner addresses the answer
    // to them alone: a broadcast announced every sabotage - and the name of
    // the repair project it created - to the whole table, which is the one
    // thing a saboteur is buying secrecy for. Null - no such project, one already
    // frozen, a repair - froze nothing, and is a refusal, not an answer (E31 review).
    if (!result) return { refused: "nothing was carried out: sabotageProject froze nothing" };
    return { reply: result };
}

/**
 * Another GM's change of a project, on the primary (E36 C1): the change cut to the keys the step knows
 * (projects.mjs `cleanProjectChange`), `by` that GM's claim of whose change it is, which a GM may make -
 * the kind and the character as named, the user one of this world's or the sender. Answers the step's
 * result; a change of nothing, or of a project that is gone, carried out nothing.
 */
export async function handleProjectChange(payload, sender) {
    const { applyProjectChange, cleanProjectChange } = await import("./projects.mjs");
    const change = cleanProjectChange(payload.change);
    if (!change) return { refused: "nothing was carried out: the change named nothing the step knows" };
    const by = payload.by && typeof payload.by === "object" ? payload.by : {};
    const result = await applyProjectChange(payload.countdownId, change, {
        by: { kind: by.kind, userId: game.users.get(by.userId ?? "") ? by.userId : sender.id, actorId: by.actorId ?? null }
    });
    if (!result) return { refused: "nothing was carried out: applyProjectChange found no such project" };
    return { reply: result };
}

export async function handleUnsabotage(payload, sender, ctx) {
    // A GM's alone since E08+E28 C8 (`guardUndoIsTheGms`); the pair is still asked (`unsabotageRefusal`).
    const { undoSabotage } = await import("./projects.mjs");
    // Null: `unsabotageRefusal` kept it to the GM's console - nothing was undone (E31 review).
    if (!await undoSabotage(payload.targetId, payload.repairId, { senderId: sender.isGM ? null : sender.id })) {
        return { refused: "nothing was carried out: undoSabotage undid nothing" };
    }
}

export async function handleSendback(payload, sender, ctx, prepared) {
    // `REVERT` came in the declaration's `prepare`, before the guard, so the
    // guard's judgement and the write below have nothing but microtasks between
    // them. Back, and only back - see `guardSendbackPlace`.
    const token = game.scenes.get(payload.sceneId)?.tokens?.get(payload.tokenId);
    // Read out by name (E03): x and y, and elevation and level only when asked.
    const asked = payload.position ?? {};
    const to = { x: Number(asked.x), y: Number(asked.y) };
    if (asked.elevation !== undefined) to.elevation = Number(asked.elevation);
    if (asked.level !== undefined) to.level = asked.level;
    // Marked as the bridge's (E12 C12): the witness judge reads a send-back as the player's own
    // revert, though this GM writes it - honoured only back to where the judge left the token.
    // The mark names the player who asked (E79 fix r2-G1; review r2, SEC M1): the GMs' audit judges
    // the write as that player's own revert (movement-audit.mjs `askerOf`). Walls ignored (E79 C4):
    // the place is a spot of the GMs' record or the centre of a room the token stood in within the
    // minute (`guardSendbackPlace`), and a wall between the two must not stop the way back
    // (movement.mjs `sendBack`'s note); a centre across a wall is the audit's to judge.
    await token.update(to, { animate: false, [prepared.REVERT]: true, [prepared.SENT_BACK]: sender.isGM ? false : sender.id, constrainOptions: { ignoreWalls: true } });
}

export async function handleLoot(payload, sender, ctx) {
    const { lootBody } = await import("./handover.mjs");
    // Everything else it needs to refuse `lootBody` checks itself, because the GM's own
    // button goes through the same door. The one gate's refusals - the room, both lives,
    // the death the taker knows, the phase, the Eclipse (inventory.mjs `transferRefusal`;
    // E14 part 1 C1) - and an item no GM has decided on (E29 fix r2-H21) come back with
    // their reason and are told by its code. It answers null when it took nothing for any
    // other reason (a Truth Bullet, full hands with no stash), with its reason on the GM's
    // console, and the asker is told only that nothing was carried out (E31 review).
    // E68 C10: the items under one Take and its rolls, on the GMs' record of each (the declaration's `rolled`).
    const itemIds = Array.isArray(payload.itemIds) ? payload.itemIds.filter(id => typeof id === "string") : null;
    /* THE FIRST ROLLS COUNT (E68 C10 loot bind, 10.11.2026; roll-draw.mjs `lootDrawRefusal`). A player's Take reads the
       first Hand and the first Shadow the primary drew for the taker at this body since their last Take of it that moved
       something (handover.mjs `lootRollsBound`), whichever roll the packet names, and clears them once it moves
       something (`releaseLootRolls`), so every Take rolls and counts its own first roll (the owner's Q8): the packet's own was held to this taker and body above
       (`rolled`, `named`), and a later one settles nothing. No Hand bound is refused - a Take with no roll laid the
       Remnant Subtle until C10. A GM's own button sends the GM's roll, as before: the GM rules. `again` says that
       this Take counted an earlier roll (a try refused kept it); the taker's page says nothing of it (anonymity.mjs `takeFromBody`). */
    const bound = sender.isGM ? null : await (await import("./handover.mjs")).lootRollsBound(payload.takerId, payload.bodyId);
    if (!sender.isGM && !bound?.loot) return { refused: "no Hand roll of that character's stands for that Take" };
    const taken = await lootBody({
        takerId: payload.takerId, bodyId: payload.bodyId, itemId: payload.itemId, itemIds,
        hand: bound ? bound.loot : { total: payload.total, isCritical: payload.isCritical, withHope: payload.withHope },
        cover: bound ? bound.lootCover
            : payload.coverRollId ? { total: payload.coverTotal, isCritical: payload.coverCritical, withHope: payload.coverHope } : null,
        askedBy: sender.isGM ? null : sender.id, coverRequired: !sender.isGM
    });
    if (taken?.refused) return { refused: taken.refused };
    // Watched, and no Shadow bound (E68 review R1, handover.mjs `lootBody`): nothing moved; the taker's window rolls it and asks again.
    if (taken?.coverNeeded) return { reply: { coverNeeded: true } };
    if (!taken) return { refused: "nothing was carried out: lootBody took nothing" };
    if (bound) await (await import("./handover.mjs")).releaseLootRolls(payload.takerId, payload.bodyId);
    if (bound && payload.rollId !== bound.loot.messageId) return { reply: { again: true } };
}

export async function handleArm(payload, sender, ctx, prepared) {
    // What a player may arm on somebody else or on their own character (E29 C8), and who pays - see `guardArmPlayerCall`.
    // The beneficiary was read once, in the declaration's `prepare` - before any
    // guard imports - and is handed down, so a character deleted in between fails
    // the write (and the player's Hope goes back) instead of being re-read as nobody.
    const { actor, appendArmedCall } = prepared;
    if (!sender.isGM) return armPaidByPlayer(actor, sender, payload, ctx, prepared);

    // `appendArmedCall` came before the guards too: the check and the append that
    // follows it have nothing but microtasks between them (CALL-02 refuses a second copy).
    const twice = await firstRefusal(sender, payload, ctx, guardArmNotHeld);
    if (twice) return { refused: twice };
    const call = HOPE_CALLS[payload.call.key] ?? DESPAIR_CALLS[payload.call.key];
    const kind = HOPE_CALLS[payload.call.key] ? "hope" : "despair";

    // Appended, not written over: Calls stack (CALL-02). Armed on that GM's word (E29 fix r2-H7, `by`).
    await appendArmedCall(actor, armedEntry(payload.call, call, kind), { by: sender });
    debug(`Armed ${payload.call.key} on ${actor.name} on behalf of ${sender.name}.`);
    void tellBeneficiary(actor, kind, call.grants);
    return { reply: { ok: true, left: null } };
}

/**
 * The armed entry as this side builds it: the table's `grants`, never the packet's extras. Who
 * paid is the request's (`armBuyerId`) and is not stored (E06 C10; call-effects.mjs `unsigned`).
 */
function armedEntry(asked, call, kind) {
    return {
        key: asked.key, kind, grants: call.grants,
        amount: null,
        nonce: String(asked.nonce ?? foundry.utils.randomID()).slice(0, 32)
    };
}

/**
 * The beneficiary is not the buyer: tell them what they have been given, or they
 * will meet a locked roll dialog with no idea why it opened up.
 *
 * Started and not waited for, and never thrown: the Call is armed and paid for
 * by now, and the runner sends the buyer their answer as soon as the run
 * returns, whatever the whisper does. A whisper that failed used to take the
 * answer down with it - the buyer waited out the clock and was told "not armed,
 * not charged" about a Call that was both (the E03 review).
 */
async function tellBeneficiary(actor, kind, grants) {
    try {
        await whisperToOwner(actor, `${cardHead({
            action: game.i18n.localize("DRPG.Calls.armedTitle")
        })}<p>${
            // The accusative (call-effects.mjs `grantWords`, E66 C3): "nałożył na twój następny rzut {what}", "rzut ma {what}".
            game.i18n.format(kind === "despair" ? "DRPG.Calls.armedByMonokuma" : "DRPG.Calls.armedForYou", {
                what: game.i18n.localize(`DRPG.Calls.grants.${grants}`)
            })
        }</p>`);
    } catch (err) {
        error(`Could not tell ${actor?.name ?? "the beneficiary"} about the Call armed for them`, err);
    }
}

/**
 * A player's Call - a Support on somebody else's character, or since E29 C8 a Call on
 * their own: checked, charged and armed on this side, in that order, and refunded if
 * the arming itself fails. Asks its own guards (the declaration's `runGuards`): the
 * player's road has checks the GM's does not, and the replayed purchase below answers
 * "armed" between them. The buyer is told by the answer; only somebody else is
 * whispered to.
 */
async function armPaidByPlayer(actor, sender, payload, ctx, prepared) {
    const who = await firstRefusal(sender, payload, ctx, guardArmBuyer, guardArmOtherCharacter);
    if (who) return { refused: who };
    const buyer = game.actors.get(armBuyerId(payload));
    const call = HOPE_CALLS[payload.call.key];

    // The same purchase asked twice - a GM who came back and was asked again
    // (`resendOnGmReady`) after arming it - is answered, not charged again.
    // Not a guard, and asked before the three below: it answers "armed" rather
    // than refusing, and a purchase already paid for can fail the Hope check it
    // passed the first time.
    const { appendArmedCall, pendingCalls, gmMeansWrite, trustedWrite } = prepared;
    const nonce = String(payload.call.nonce ?? "").slice(0, 32);
    if (nonce && pendingCalls(actor).some(entry => entry.nonce === nonce)) return { reply: { ok: true, left: null } };

    // `guardArmLiving` is asked after every refusal a living beneficiary would get as
    // well (E05 fix r2-G3): see its note. A Call that waits for the GM's yes takes the one
    // the primary kept for it just before (E29 fix r2-H4): see `guardArmGmYes`.
    const why = await firstRefusal(sender, payload, ctx, guardArmHopeCallAllowed, guardArmNotHeld, guardArmBuyerHope, guardArmGmYes, guardArmLiving);
    if (why) return { refused: why };
    // Paid from the Hope the GMs hold, in the buyer's audit queue (sheet-audit.mjs `gmMeansWrite`,
    // E29 fix r1-G5): a forged Hope that landed while the guards ran is judged before this write or
    // after it, never under it - so `guardArmBuyerHope`'s question is asked again here, of that value.
    const paid = await gmMeansWrite(buyer, async ({ hope }) => {
        if (hope < call.cost) return { held: hope, left: null };
        await trustedWrite(buyer, { "system.resources.hope.value": hope - call.cost }, { reason: "call" });
        return { held: hope, left: hope - call.cost };
    });
    if (paid.left === null) return { refused: `the buyer holds ${paid.held} Hope, the Call costs ${call.cost}` };
    try {
        // The player's own purchase: armed on their word, so it carries no GM's `by` (E29 fix r2-H7).
        await appendArmedCall(actor, armedEntry(payload.call, call, "hope"), { by: sender });
    } catch (err) {
        error(`Could not arm ${payload.call.key} on ${actor.name}; the Hope goes back`, err);
        await gmMeansWrite(buyer, ({ hope }) => trustedWrite(buyer, { "system.resources.hope.value": hope + call.cost }, { reason: "refund" }));
        return { refused: "the Call could not be armed" };
    }
    debug(`Armed ${payload.call.key} on ${actor.name}, paid by ${buyer.name} on this side.`);
    if (buyer.id !== actor.id) void tellBeneficiary(actor, "hope", call.grants);
    return { reply: { ok: true, left: paid.left } };
}

/** The run of `overflow.add` (E17 C5): the primary's own `addOverflow`, its count after, or a refusal when nothing was added. */
export async function handleOverflowAdd(payload, sender, ctx) {
    const { addOverflow } = await import("./overflow.mjs");
    const after = await addOverflow(Math.trunc(payload.amount), { reason: payload.reason || `asked by ${sender.name}` });
    if (after === null) return { refused: "nothing was carried out: the overflow took nothing" };
    return { reply: { after } };
}

/** The run of `overflow.clear` (H84-06): the primary's own `resetOverflow` of the count alone, for the GM who asked. */
export async function handleOverflowClear(payload, sender, ctx) {
    const { resetOverflow } = await import("./overflow.mjs");
    const cleared = await resetOverflow({ reason: `a GM (${sender.name})`, countOnly: true });
    if (!cleared) return { refused: "nothing was carried out: the overflow was not cleared" };
    return { reply: { cleared: true } };
}

/** The run of `despair.set` (E37 C7): the primary's own `setDespair`, the pool it wrote. */
export async function handleDespairSet(payload, sender, ctx) {
    const { setDespair } = await import("./despair.mjs");
    const value = await setDespair(payload.targetUserId, payload.value);
    if (value === null) return { refused: "nothing was carried out: the pool was not set" };
    return { reply: { value } };
}

/** The run of `despair.all` (E37 C7): the primary's own `fillAllDespair` or `zeroAllDespair`, the pools it wrote. */
export async function handleDespairAll(payload, sender, ctx) {
    const { fillAllDespair, zeroAllDespair } = await import("./despair.mjs");
    const pools = payload.op === "fill" ? await fillAllDespair() : payload.op === "zero" ? await zeroAllDespair() : null;
    if (!pools) return { refused: "nothing was carried out: the pools were not written" };
    return { reply: { pools } };
}

/**
 * The run of `despair.roster` (E37 C7): the primary's own `addPool`, `removePool` or `setPoolLabel`. A grant or a revoke
 * that changed nothing (the pool granted already, or not granted) carried nothing out; a label is written for a user of
 * this world, and answers the label it holds now, null when cleared.
 */
export async function handleDespairRoster(payload, sender, ctx) {
    const { addPool, removePool, setPoolLabel } = await import("./despair.mjs");
    const id = payload.targetUserId;
    if (payload.op === "label") {
        if (!game.users.get(id ?? "")) return { refused: "nothing was carried out: no such user" };
        return { reply: { label: await setPoolLabel(id, payload.label) } };
    }
    const done = payload.op === "add" ? await addPool(id) : payload.op === "remove" ? await removePool(id) : null;
    if (!done) return { refused: "nothing was carried out: the pool was not granted or revoked" };
    return { reply: { done: true } };
}

/** The run of `overflow.take` (E37 C7): the primary's own `takeOverflow`, the points it took (0 when the count held none). */
export async function handleOverflowTake(payload, sender, ctx) {
    const { takeOverflow } = await import("./overflow.mjs");
    const taken = await takeOverflow(Math.trunc(payload.amount), { reason: payload.reason || `asked by ${sender.name}` });
    return { reply: { taken } };
}

/** The run of `overflow.check` (E37 C7): the primary's own `checkOverflow`, the stamp it armed (null when nothing fired). */
export async function handleOverflowCheck(payload, sender, ctx) {
    const { checkOverflow } = await import("./overflow.mjs");
    // The asker's boundary (E37 fix FG4, C-m3): a GM's claim, held to this clock's own in `checkOverflow`.
    const target = payload.timeOfDay ? { session: payload.session, day: payload.day, timeOfDay: payload.timeOfDay } : null;
    const armed = await checkOverflow({ ahead: payload.ahead === true, target });
    return { reply: { armed } };
}

export async function handleDespair(payload, sender, ctx) {
    // A GM's alone since E08+E28 C8, as a Reroll's point is the GM's own (reroll.mjs); the size
    // and the pool are the declaration's guards.
    const delta = Math.trunc(payload.delta);
    const target = game.users.get(payload.targetUserId);
    const { adjustDespair } = await import("./despair.mjs");
    await adjustDespair(target.id, delta, { clamp: payload.clamp === true });
    debug(`Adjusted Despair for ${target.name} by ${delta} on behalf of ${sender.name}.`);
}

    // An Eclipse crossing. Counted on this side, where the allowance is judged since E05
    // (a crossing beyond it is refused, and counts nothing); the answer's `used`/`left` are
    // not read by the mover's own sheet, which redraws off its copy of the store, but by 33's
    // B13 and 30 - the two places that check what the count came back as (E05 fix r1-G5, M10).
export async function handleEclipseMove(payload, sender, ctx) {
    const { applyRecordedMove } = await import("./eclipse.mjs");
    const out = await applyRecordedMove(payload.actorId, { to: payload.to });
    if (!out) return { refused: "nothing was carried out: no Eclipse is running, or no such character" };
    if (out.refused) return { refused: out.refused };
    return { reply: { used: out.used, left: out.left } };
}

/**
 * A player's own pre-session note (E05 C6; audit S11-03, S01-08), into the GMs' store
 * under the sender's id: the user Foundry names, since the packet names nobody - one
 * that carries another user's id writes only its sender's own note. Past the player
 * text cap it is refused, as a private card is (secret.mjs). The answer is when the
 * store wrote it and the row's stamp, which the player's copy takes as the GMs' own.
 */
export async function handleNoteSave(payload, sender) {
    const { writeNote, noteTooLong } = await import("./pre-session-note.mjs");
    if (noteTooLong(payload.text)) return { refused: "the note is longer than a player's words may be" };
    const out = await writeNote(sender.id, payload.text, { byGm: false });
    if (!out) return { refused: "nothing was carried out: the note's writer is not a user of this world" };
    return { reply: { updatedAt: out.updatedAt, stamp: out.stamp } };
}

/** The run of `roll.bookmark` (E08+E28 C2): the guards tied the message to the sender and the character to them. */
export async function handleRollBookmark(payload, sender) {
    const { keepGmBookmark } = await import("./action-rolls.mjs");
    await keepGmBookmark({
        actorId: payload.actorId,
        messageId: payload.messageId,
        actionKey: payload.actionKey,
        trait: payload.trait,
        experiences: payload.experiences,
        context: payload.context,
        reportMessageId: payload.reportMessageId
    }, sender);
}

/**
 * The run of `reroll.ask` (E08+E28 C4a): the GM makes the sender's Reroll of their character
 * and answers the lines of the Call's card, or refuses with why - before anything was paid,
 * or after giving back what was.
 */
export async function handleReroll(payload, sender) {
    const { rerollOnGm } = await import("./reroll.mjs");
    const out = await rerollOnGm(game.actors.get(payload.actorId), sender);
    if (out?.refused) return { refused: out.refused };
    return { reply: { lines: out?.lines ?? [] } };
}

/** The run of `audit.decide` (E29 C5): the primary's own decision (sheet-audit.mjs `decideWrite`), recorded as the asking GM's. */
export async function handleAuditDecide(payload, sender) {
    const { decideWrite } = await import("./sheet-audit.mjs");
    return { reply: await decideWrite(payload.rowId, payload.keep, sender.id) };
}

/** The run of `keys.charge` (E09 fix r1-G3): the primary's own charge (investigation.mjs `chargeForUnfoundKeys`), what was paid or null. */
export async function handleKeysCharge() {
    const { chargeForUnfoundKeys } = await import("./investigation.mjs");
    return { reply: await chargeForUnfoundKeys() };
}

/** The run of `trial.record` (E70 fix p1-G2): the record's write on this primary (trial-progress.mjs `recordOnPrimary`), its answer or null. */
export async function handleTrialRecord(payload) {
    const { recordOnPrimary } = await import("./vote.mjs");
    return { reply: await recordOnPrimary(payload.op, { patch: payload.patch, seconds: payload.seconds, chapter: payload.chapter }) ?? null };
}

/** The run of `trial.enter` (E70 C5): the primary's own settle of the trial's voices (voice.mjs `settleTrialVoices`), its answer or null. */
export async function handleTrialEnter() {
    const { settleTrialVoices } = await import("./voice.mjs");
    return { reply: await settleTrialVoices() };
}

/** The run of `vote.run` (E10 C1): the primary's own step of the vote (vote.mjs `runVoteOp`), its reply or status. */
export async function handleVoteRun(payload) {
    const { runVoteOp } = await import("./vote.mjs");
    return { reply: await runVoteOp(payload.op, { picks: payload.picks }) };
}

/** The run of `vote.cast` (E10 C2): the primary's own judgement and record of the sender's ballot (vote.mjs `recordBallot`). */
export async function handleBallot(payload, sender) {
    const { recordBallot } = await import("./vote.mjs");
    const out = await recordBallot(sender, payload.round, payload.choice);
    if (out.refused) return { refused: out.refused };
    return { reply: out.reply };
}

/** The run of `vote.ask` (E10 C2): the sender's own ballot, as the primary holds the vote (vote.mjs `ballotFor`), or null. */
export async function handleBallotAsk(payload, sender) {
    const { ballotFor } = await import("./vote.mjs");
    return { reply: await ballotFor(sender) };
}

/**
 * The run of `floor.now` (E10 fix r2-G6): the primary's own Now, under its heartbeat's latch (trial-floor.mjs
 * `advanceFloorOnPrimary`), on the floor the pressing GM saw (r2-G7). A floor that moved on is refused here, so that
 * GM is told; `advanceFloorOnPrimary` holds the same comparison in the same synchronous step for the local road.
 */
export async function handleFloorNow(payload) {
    const { advanceFloorOnPrimary, floorAsSeen } = await import("./trial-floor.mjs");
    const seen = { mode: payload.mode, startedAt: payload.startedAt };
    if (!floorAsSeen(seen)) return { refused: "the trial's floor has moved on since that Now was pressed" };
    return { reply: await advanceFloorOnPrimary(seen) };
}

/** The run of `trial.object` (E79 C16): the primary's judgement of the press, its payment and its pending card (trial.mjs `objectOnPrimary`). */
export async function handleTrialObject(payload) {
    const { objectOnPrimary } = await import("./trial.mjs");
    const out = await objectOnPrimary({ actorId: payload.actorId, targetId: payload.targetId });
    if (out?.refused) return { refused: out.refused };
    return { reply: out?.reply ?? null };
}

/** The run of `trial.evidence` (E79 C16): the Truth Bullet on the objector's own pending card (trial.mjs `evidenceOnPrimary`). */
export async function handleTrialEvidence(payload) {
    const { evidenceOnPrimary } = await import("./trial.mjs");
    const out = await evidenceOnPrimary({ actorId: payload.actorId, itemId: payload.itemId, comment: payload.comment,
        analysis: !payload.bare });
    if (out?.refused) return { refused: out.refused };
    return { reply: out?.reply ?? null };
}

/** The run of `trial.withdraw` (E79 fix r4-G2): the objector's own pending Objection taken back (trial.mjs `withdrawOnPrimary`). */
export async function handleTrialWithdraw(payload) {
    const { withdrawOnPrimary } = await import("./trial.mjs");
    const out = await withdrawOnPrimary({ actorId: payload.actorId, messageId: payload.messageId });
    if (out?.refused) return { refused: out.refused };
}

/** The run of `floor.repoint` (E79 C16): a GM's new target for the running Objection (trial.mjs `repointOnPrimary`). */
export async function handleFloorRepoint(payload) {
    const { repointOnPrimary } = await import("./trial.mjs");
    const out = await repointOnPrimary({ targetId: payload.targetId });
    if (out?.refused) return { refused: out.refused };
    return { reply: out?.reply ?? null };
}

/**
 * The run of `trial.gm` (E70 C0): a GM's change of the floor in a step of the floor's key on this primary (trial-floor.mjs
 * `floorOnPrimary`). An op that changed nothing - its own refusal, a floor that moved on - is refused here, so the GM
 * who pressed is told.
 */
export async function handleTrialGm(payload) {
    const { floorOnPrimary } = await import("./trial-floor.mjs");
    const out = await floorOnPrimary(payload.op, {
        seconds: payload.seconds, actorId: payload.actorId, targetId: payload.targetId, messageId: payload.messageId, text: payload.text,
        order: payload.order, slot: payload.slot, beyondPaid: payload.beyondPaid
    });
    if (out === null) return { refused: "nothing was carried out: the trial's floor did not take that change" };
    return { reply: out };
}

/** The run of `trial.turn` (E70 C7): a round's step, judged on this primary (trial-modes.mjs `turnOnPrimary`). */
export async function handleTrialTurn(payload, sender) {
    const { turnOnPrimary } = await import("./trial-modes.mjs");
    const out = await turnOnPrimary({ actorId: payload.actorId, kind: payload.kind, step: payload.step }, sender.id);
    if (out?.refused) return { refused: out.refused };
    return { reply: out?.reply ?? null };
}

/** The run of `trial.claim` (E70 C8): a volunteer for the Closing, judged on this primary (trial-modes.mjs `volunteerOnPrimary`). */
export async function handleTrialClaim(payload) {
    const { volunteerOnPrimary } = await import("./trial-modes.mjs");
    const out = await volunteerOnPrimary({ actorId: payload.actorId });
    if (out?.refused) return { refused: out.refused };
    return { reply: out?.reply ?? null };
}

/** The run of `ready.open` (E37 C3): the round opened, or the one open joined, on this primary (boundary.mjs `openRoundOnPrimary`). */
export async function handleReadyOpen(payload, sender) {
    const { openRoundOnPrimary } = await import("./boundary.mjs");
    const out = await openRoundOnPrimary({ kind: payload.kind, by: sender.id });
    if (out?.refused) return { refused: out.refused };
    return { reply: out?.reply ?? null };
}

/** The run of `ready.answer` (E37 C3): the sender's own answer, judged on this primary (boundary.mjs `answerOnPrimary`). */
export async function handleReadyAnswer(payload, sender) {
    const { answerOnPrimary } = await import("./boundary.mjs");
    const out = await answerOnPrimary(sender, { roundId: payload.roundId, ready: payload.ready });
    if (out?.refused) return { refused: out.refused };
    return { reply: out?.reply ?? null };
}

/** The run of `ready.end` (E37 C3): the round ended on this primary (boundary.mjs `endRoundOnPrimary`). */
export async function handleReadyEnd(payload) {
    const { endRoundOnPrimary } = await import("./boundary.mjs");
    const out = await endRoundOnPrimary({ roundId: payload.roundId, outcome: payload.outcome });
    if (out?.refused) return { refused: out.refused };
    return { reply: out?.reply ?? null };
}

/** The run of `trial.present` (E70 C10): the card and the copies, judged on this primary (trial.mjs `presentOnPrimary`). */
export async function handleTrialPresent(payload) {
    const { presentOnPrimary } = await import("./trial.mjs");
    const out = await presentOnPrimary({ actorId: payload.actorId, itemId: payload.itemId, comment: payload.comment,
        analysis: !payload.bare });
    if (out?.refused) return { refused: out.refused };
    return { reply: out?.reply ?? null };
}

/** The run of `cleanup.ruling` (E09 C10): the primary's own ruling (cleanup.mjs `ruleReshape`), recorded as the asking GM's. */
export async function handleReshapeRuling(payload, sender) {
    const { ruleReshape } = await import("./cleanup.mjs");
    return { reply: await ruleReshape({ actorId: payload.actorId, tokenId: payload.tokenId, attempt: payload.attempt,
        verdict: payload.verdict }, sender.id) };
}

/** The run of `observe.pick` (E09 C12): a GM's pick or refusal on an Observe card, held to the ask this primary keeps (`observePickOnPrimary`). */
export async function handleObservePick(payload, sender) {
    return { reply: await observePickOnPrimary({ rid: payload.rid, actorId: payload.actorId, tokenId: payload.tokenId,
        refuse: payload.refuse }, sender.id) };
}

/** The run of `card.claim` (E18 C3): a GM's claim of a card, decided on this primary (`claimOnPrimary`). */
export async function handleCardClaim(payload, sender) {
    if (!payload.step) return { refused: "nothing was carried out: a claim names no step it knows" };
    return { reply: await claimOnPrimary(payload.messageId, payload.step, sender.id) };
}

/** The run of `card.post` (E08+E28 fix r2-H5): the sender's card, posted by this GM (secret.mjs `postAsked`), or why not. */
export async function handleCardPost(payload, sender) {
    const { postAsked, cardTooLong } = await import("./secret.mjs");
    if (cardTooLong(payload.content, payload.flags)) return { refused: "the card is longer than a player's words may be" };
    const message = await postAsked(sender, { content: payload.content, whisper: payload.whisper, speaker: payload.speaker,
        flags: payload.flags, summary: payload.summary, veiled: payload.veiled });
    if (!message) return { refused: "nothing was carried out: the card could not be posted" };
    return { reply: { id: message.id } };
}
