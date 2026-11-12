/**
 * Danganronpa RPG - the bridge's runs: what a student does.
 * ---------------------------------------------------------------------------
 * The runs of BRIDGE_ACTIONS that carry out a student's act, each with the
 * derives its declaration reads: Observe and Analyze, the cleanable traces,
 * the Level Up and its offers (`sendOffersTo`), a Truth Bullet or an item
 * handed over, the passages, the stashes, Plant, Steal, Frisk and Palm with
 * the rolls they are scored on (`friskRolls`, `palmRolls`, `friskForceRoll`,
 * `findPassageRoll`, `searchTheftOf` ...), the opening roll's result, the
 * crisis, the park, the betrayal, the clean-up, a Monocub's ability, and the
 * rulings asked by card (a Call, a Dynamic action's difficulty and answer, a
 * trait ruling, a ruling received or expired).
 *
 * WHERE IT SITS. Moved out of gm-bridge.mjs by E41 C5a (1.2.97), a pure move
 * that `node tools/moved-only.mjs` proves line by line, in gm-bridge.mjs's
 * order. The runs and derives the table names are exported for it;
 * gm-bridge.mjs re-exports `sendOffersTo`, which it exported. Nothing here
 * imports gm-bridge.mjs (the facade rule, .claude/rules/code.md): the wire
 * names are bridge-wire.mjs's, the GM's cards call-gm.mjs's. "THE RUNS",
 * below, is the comment that stood over the first run in gm-bridge.mjs.
 */

import { TRAITS, LEVEL_UP, LEVEL_UP_OPTIONS } from "./config.mjs";
import { whisperToGms, debug, error, esc, serialWrite } from "./utils.mjs";
import { gmStoresQuiet, whenGmStoresAudible } from "./gm-store.mjs";
import {
    askHopeCallByCard, askDynamicByCard, askTraitByCard, expiredOnPrimary, receivedOnPrimary, yesOnPrimary,
    dynamicOnPrimary
} from "./call-gm.mjs";
import { SOCKET_EVENT, ACTION_ADVANCEMENT_OFFERS, ACTION_SHARE_BULLET, ACTION_DONE } from "./bridge-wire.mjs";
import { facilityUseStore } from "./gm-stores.mjs";
import { facilityMark, facilityCost, facilityShut } from "./facilities.mjs";
import { offerAt, overflowNow, closeForAll, applyEffects, leaveTrace, tellUse } from "./facilities-gm.mjs";

/*
 * THE RUNS (E31, 25.09.2026). Each handler below is the `run` of one
 * declaration in BRIDGE_ACTIONS (bridge-table.mjs), and keeps its name,
 * its order and its first parameter, `payload` - which is no longer the packet
 * but a copy with only the fields the declaration lists (`sanitize`). By the
 * time a run is called, `judge` (bridge-guards.mjs) has asked who sent the
 * packet and every guard the declaration names, in order; the run carries the
 * request out, and answers by what it returns: nothing, `{ reply }`,
 * `{ refused: "<English reason>" }`, or `{ later: true }` for a ruling a GM
 * gives from a card. A run never emits a packet and never calls `refuse`.
 */

    // Observe is scored on this side, because everything it is scored against -
    // which Remnants are in the room, what they are, what the difficulty is -
    // is exactly what the observer must not know. See observe.mjs.
export async function handleObserveTarget(payload, sender, ctx) {
    const { chooseObserveTarget } = await import("./observe.mjs");
    const result = await chooseObserveTarget({
        actorId: payload.actorId,
        declaration: payload.declaration,
        request: payload.request,
        // The key is minted for this account and no other (E03; audit S05-03).
        userId: sender.isGM ? null : sender.id,
        // A focused gaze is put on every GM's card and answered later (E09 C12).
        asked: ctx
    });
    return result?.later || result?.refused ? result : { reply: result };
}

    // Stage 6's picker. Which traces a killer's own client may act on is
    // computed here for the same reason Observe is: the ledger - the answer
    // key `cleanableRemnants` reads to build the list - lives only on a GM
    // client, and `cleanableTracesForPlayer` (cleanup.mjs) is what strips it
    // back down to id, label, the reinforced flag and the number the roll window
    // shows (E16 part 2 C0, the owner's Q7) before it goes out.
export async function handleCleanupTraces(payload, sender, ctx) {
    const { cleanableTracesForPlayer } = await import("./cleanup.mjs");
    return { reply: cleanableTracesForPlayer(payload.actorId, { mine: payload.mine }) };
}

export async function handleObserveResolve(payload, sender, ctx) {
    // The sender has to own the character the packet names (the declaration's
    // guard). That alone was taken to mean "the person who asked for this key",
    // and it did not: the key named a character of its own and nothing compared
    // the two (audit S05-03). `resolveObserve` now holds the key to its
    // character, its account and one use (`observeResolveRefusal`); an undo is
    // a GM's alone (`guardUndoIsTheGms`, E08+E28 C8).
    const { resolveObserve } = await import("./observe.mjs");
    const result = await resolveObserve({
        key: payload.key,
        // Carried so a resolve that finds no record can still name who is
        // waiting for it (ACT-08). Already checked against the sender.
        actorId: payload.actorId,
        total: payload.total,
        isCritical: payload.isCritical,
        undo: payload.undo,
        senderId: sender.id,
        senderIsGm: sender.isGM,
        rollId: payload.rollId
    });
    // Not a guard: the key is judged inside `resolveObserve`, against the entry
    // it has just read, and for a GM's own resolve as much as for a packet.
    if (result?.refused) return { refused: result.refused };
}

/**
 * The bridge's run of `facility.use` (bridge-table.mjs): `{ actorId, actionId, total, isCritical, rollId }`, the total
 * and the critical the GMs' record of the roll's where `rollId` names one. Answers `{ reply: { success, source,
 * label, lines } }`, or `{ refused }` - each refusal a reason of bridge-guards.mjs `REASON_PATTERNS`.
 */
export async function handleFacilityUse(payload, sender) {
    const actor = game.actors.get(payload.actorId ?? "");
    if (!actor) return { refused: "no such character" };
    const { gmPlaceOf } = await import("./movement.mjs");
    const place = gmPlaceOf(actor);
    if (!place?.room) return { refused: "the character is not standing in any room" };
    const offer = await offerAt(actor, place, payload.actionId, sender);
    if (!offer) return { refused: "that action is not in the character's room" };
    const { states, toll } = await overflowNow();
    if (facilityShut(offer.source, states)) return { refused: "that room action is shut by the overflow" };
    if (offer.source === "gm" && !sender?.isGM && typeof payload.rollId !== "string") {
        const { rollDrawState } = await import("./roll-draw.mjs");
        if (rollDrawState().state === "ok") return { refused: "no roll the GM drew is named" };
    }
    await facilityUseStore.whenHydrated();
    return serialWrite(`facility:${offer.key}`, async () => {
        const mark = facilityMark();
        if (facilityUseStore.get(offer.key)?.mark === mark) return { refused: "that room action has been used already this time of day" };
        if (offer.source === "project") {
            const cost = facilityCost("project", offer.facility, toll);
            const { actionsLeft, spendAction } = await import("./actions.mjs");
            if (cost > 0 && (actionsLeft(actor) < cost || !await spendAction(actor, cost, { quiet: true }))) {
                return { refused: "the character has not enough actions for that room action" };
            }
        }
        const success = offer.source === "project" || Boolean(payload.isCritical) || Number(payload.total) >= offer.action.dc;
        await facilityUseStore.patch(offer.key, { mark, actorId: actor.id, userId: sender?.id ?? null, at: Date.now(), success });
        if (offer.source === "gm") await closeForAll(offer.key, mark);
        const effects = offer.source === "gm" ? offer.action.effects : offer.facility.effects;
        const lines = success ? await applyEffects(actor, effects, place, sender) : [];
        if (offer.source === "gm") await leaveTrace(actor, offer.label);
        await tellUse(actor, offer, success, lines);
        debug(`${actor.name} used the room action "${offer.label}" in ${place.room} (${offer.source}): ${success ? "success" : "failure"}.`);
        Hooks.callAll("drpgFacilityUsed", { actor, source: offer.source, key: offer.key, success });
        if (offer.source === "gm") await factsForReroll(payload.rollId, sender, actor.id, "facility", { facilityKey: offer.key, facilitySuccess: success });
        return { reply: { success, source: offer.source, label: offer.label, lines } };
    });
}

/**
 * The facts a Reroll's replay reads (infiltrate-reroll.mjs), on the GMs' row of the roll `rollId` names (action-pipeline.mjs
 * `noteFactOfRoll`, which keeps them only on that sender's roll of that character for `key`). Nothing where no roll is named.
 */
async function factsForReroll(rollId, sender, actorId, key, facts) {
    if (typeof rollId !== "string" || !rollId || !sender?.id) return false;
    const { noteFactOfRoll } = await import("./action-pipeline.mjs");
    return noteFactOfRoll(rollId, { by: sender.id, actorId, actions: [key] }, facts);
}

/**
 * A DASH, SETTLED ON THE GMS' RECORD OF ITS ROLL (E69 C5, 12.11.2026; config.mjs `INFILTRATE.dash`). The bridge's run of
 * `dash.settle`: `{ actorId, total, isCritical, rollId }`, the total and the critical the GMs' record's (the declaration
 * always names a roll). The free crossings the band reached - the highest of `bands` the total meets, `critical.moves` on a
 * critical, none on a miss - are granted by this GM (actions.mjs `grantFreeMoves`, the reason `infiltrate`, a GM's alone).
 * Answers `{ reply: { moves } }`.
 */
export async function handleDash(payload, sender) {
    const actor = game.actors.get(payload.actorId ?? "");
    if (!actor) return { refused: "no such character" };
    const { INFILTRATE } = await import("./config.mjs");
    const rule = INFILTRATE.dash;
    const total = Number(payload.total) || 0;
    const band = [...rule.bands].sort((a, b) => b.min - a.min).find(b => total >= b.min);
    const moves = payload.isCritical ? rule.critical.moves : band?.moves ?? 0;
    if (moves > 0) {
        const { grantFreeMoves } = await import("./actions.mjs");
        await grantFreeMoves(actor, moves, { reason: "infiltrate" });
    }
    // A tail on the dasher below the Dash's total is lost (E69 C4; tail-gm.mjs `tailsAfterDash`).
    const { tailsAfterDash } = await import("./tail-gm.mjs");
    await tailsAfterDash(actor, total, Boolean(payload.isCritical));
    await factsForReroll(payload.rollId, sender, actor.id, "dash", { dashMoves: moves });
    debug(`${actor.name} dashed: ${moves} free crossing(s).`);
    return { reply: { moves } };
}

/**
 * SHUT THE DOOR (E74 C2, 12.11.2026; doors-gm.mjs). The room and its rules are judged on this GM (`shutRefusal`); the
 * strength is the GMs' record of the Body roll (the runner's `onRecord`). Answers `{ reply: { room } }`.
 */
export async function handleDoorShut(payload, sender) {
    const actor = game.actors.get(payload.actorId ?? "");
    if (!actor) return { refused: "no such character" };
    const { shutDoor } = await import("./doors-gm.mjs");
    const out = await shutDoor({ actor, total: payload.total, user: sender });
    if (out.refused) return { refused: out.refused };
    const { barricadeKey } = await import("./doors-gm.mjs");
    const { gmPlaceOf } = await import("./movement.mjs");
    await factsForReroll(payload.rollId, sender, actor.id, "shut", { barricadeKey: barricadeKey(gmPlaceOf(actor)?.scene?.id ?? "", out.room) });
    return { reply: { room: out.room } };
}

/**
 * FORCE THE DOOR (E74 C3, 12.11.2026; doors-gm.mjs). What holds the door is read on this GM, the roll off the GMs' record of
 * it. Answers `{ reply: { forced, held } }`.
 */
export async function handleDoorForce(payload, sender) {
    const actor = game.actors.get(payload.actorId ?? "");
    if (!actor) return { refused: "no such character" };
    const { forceDoor } = await import("./doors-gm.mjs");
    const out = await forceDoor({ actor, room: payload.room, total: payload.total, isCritical: payload.isCritical, withHope: payload.withHope });
    if (out.refused) return { refused: out.refused };
    await factsForReroll(payload.rollId, sender, actor.id, "force", { forceRoom: payload.room, forced: Boolean(out.forced) });
    return { reply: { forced: out.forced, held: out.held } };
}

/** The two rolls of a pick (E74 C4): the Hand and the Shadow cover the two rooms' seeing is read from. */
export function pickRolls(actor) {
    return [
        { field: "rollId", actor, kind: "pick" },
        { field: "coverRollId", actor, kind: "pickCover", into: { total: "coverTotal", isCritical: "coverCritical" } }
    ];
}

/** PICK THE LOCK (E74 C4, 12.11.2026; doors-gm.mjs). Answers `{ reply: { opened, held } }`. */
export async function handleDoorPick(payload, sender) {
    const actor = game.actors.get(payload.actorId ?? "");
    if (!actor) return { refused: "no such character" };
    const { pickLock } = await import("./doors-gm.mjs");
    const out = await pickLock({ actor, room: payload.room, total: payload.total, isCritical: payload.isCritical, withHope: payload.withHope,
        coverTotal: payload.coverTotal, coverCritical: payload.coverCritical });
    if (out.refused) return { refused: out.refused };
    await factsForReroll(payload.rollId, sender, actor.id, "pick", { pickRoom: payload.room, opened: Boolean(out.opened),
        coverTotal: Number(payload.coverTotal) || 0, coverCritical: Boolean(payload.coverCritical) });
    return { reply: { opened: out.opened, held: out.held } };
}

/** KEEP WATCH (E74 C6, 12.11.2026; watch-gm.mjs). Answers `{ reply: { kept } }`. */
export async function handleWatchDeclare(payload, sender) {
    const actor = game.actors.get(payload.actorId ?? "");
    if (!actor) return { refused: "no such character" };
    const { declareWatch } = await import("./watch-gm.mjs");
    const out = await declareWatch({ actor, total: payload.total, isCritical: payload.isCritical, userId: sender?.id ?? null });
    if (out.refused) return { refused: out.refused };
    await factsForReroll(payload.rollId, sender, actor.id, "keepWatch", { watchKept: Boolean(out.kept) });
    return { reply: { kept: out.kept } };
}

/** The two rolls of a tail, as `rolled` names them (E69 C3): the effect's and the Shadow the target's noticing is read from. */
export function tailRolls(actor) {
    return [
        { field: "rollId", actor, kind: "tail" },
        { field: "unseenRollId", actor, kind: "tailUnseen", into: { total: "unseenTotal", isCritical: "unseenCritical" } }
    ];
}

/**
 * TAIL SOMEONE BEGUN (E69 C3, 12.11.2026; tail-gm.mjs). The target is judged before anything is kept (`tailRefusal`); the
 * effect's total and critical and the Shadow's are the GMs' record of each roll (the runner's `onRecord`). Answers
 * `{ reply: { seen } }`: whether the target was told who follows them.
 */
export async function handleTailStart(payload, sender) {
    const tailer = game.actors.get(payload.tailerId ?? "");
    const target = game.actors.get(payload.targetId ?? "");
    if (!tailer || !target) return { refused: "no such character" };
    const { startTail } = await import("./tail-gm.mjs");
    const out = await startTail({ tailer, target, total: payload.total, isCritical: payload.isCritical,
        unseenTotal: payload.unseenTotal, unseenCritical: payload.unseenCritical, userId: sender?.id ?? null });
    if (out.refused) return { refused: out.refused };
    await factsForReroll(payload.rollId, sender, tailer.id, "tail", { tailTargetId: target.id });
    return { reply: { seen: out.seen } };
}

    // Analyze is scored here for the same reason as Observe: the difficulty is
    // read from what the bullet really is, which is the answer being bought.
export async function handleAnalyzeResolve(payload, sender, ctx) {
    const { resolveAnalyze } = await import("./analyze.mjs");
    const result = await resolveAnalyze({
        actorId: payload.actorId,
        itemId: payload.itemId,
        total: payload.total,
        isCritical: payload.isCritical,
        undo: payload.undo,
        rollId: payload.rollId,
        by: sender.id
    });
    // Not a guard: one Analyze per bullet per chapter is the resolver's own
    // rule, asked of a GM's throw too (analyze.mjs).
    if (result?.refused) return { refused: result.refused };
    // Null: no such Truth Bullet on that character - nothing was analysed, so the
    // asker is not answered as though it were (E31 review).
    if (!result) return { refused: "nothing was carried out: resolveAnalyze analysed nothing" };
}

/*
 * A LEVEL UP THE PLAYER CHOSE, APPLIED BY THE GM WHO OFFERED IT (N-2).
 *
 * EVERY FIELD OF THIS PACKET IS A CLAIM. The sender says which character, which
 * kind and which options; a player who can open a console can say anything. So:
 * the sender has to own the character (the declaration's guard), the character
 * has to be CARRYING an offer, the kind comes off THE OFFER rather than off the
 * packet (whose `kind` is not even on the whitelist), the number of picks has
 * to be the number that kind buys, and every option has to be one of the five.
 * Nothing here trusts the claim except the picks themselves, which are the one
 * thing the offer was made to let them choose.
 *
 * The offer it names is cleared by `applyAdvancement`, so a second packet naming
 * it is refused by the same test that admitted the first.
 *
 * WHICH OFFER (E10 C6, 1.2.71; audit S03-17). A character holds a list of offers now, and
 * the packet names the one it spends (`offerId`): it has to stand in this character's list
 * as this GM holds it, and the picks are the ones THAT offer buys - its kind's and its extra
 * (level-up.mjs `offerPicks`). One taken back, or spent, names nothing and is refused.
 */
export async function handleAdvancement(payload, sender, ctx) {
    const actor = game.actors.get(payload.actorId);
    if (!actor) return { refused: "no such character" };

    const { standingOffers, offerPicks, applyAdvancement, advancing } = await import("./level-up.mjs");
    const { numberHeld } = await import("./sheet-audit.mjs");
    const standing = standingOffers(actor);
    const offer = standing.find(held => held.id === payload.offerId) ?? null;
    if (!standing.length) {
        /* THE GMs ARE TOLD WHEN THE REFUSAL MAY BE THIS BROWSER'S (E04 C8; E31 row 5):
           the offers store has not heard from the other GMs yet, or holds nothing at
           all - a primary that came with an empty browser, which is the case the
           owner's lit button now survives. Nothing is awaited between this read and
           the latch below. */
        const { offerStore } = await import("./gm-stores.mjs");
        if ((!offerStore.isHydrated() || !Object.keys(offerStore.entries()).length) && !offerMissingTold.has(actor.id)) {
            // Once per character and load: a player pressing again is not news, and a whisper each time would be a way to flood the GMs.
            offerMissingTold.add(actor.id);
            void whisperToGms(`<p class="drpg-warning">${esc(game.i18n.format("DRPG.Advance.notOfferedHere", { name: actor.name, player: sender.name }))}</p>`)
                .catch(err => debug("Could not tell the GMs about a Level Up this browser does not hold", err));
        }
        return { refused: "no Level Up is on offer for that character" };
    }
    if (!offer) return { refused: "no Level Up is on offer under that name for that character" };

    const wanted = offerPicks(offer);
    const picks = Array.isArray(payload.picks) ? payload.picks : [];
    if (picks.length !== wanted) {
        return { refused: `that offer buys ${wanted} pick(s), the packet carried ${picks.length}` };
    }
    if (picks.some(p => !LEVEL_UP_OPTIONS[p?.option])) {
        return { refused: "a pick names something that is not an option" };
    }

    /* Bounded on arrival as well as caught on the player's screen (level-up.mjs):
       a packet from an older client, or a forged one, must not spend the offer on
       a new experience that has no name. */
    if (picks.some(p => p.option === "experienceNew" && !String(p.name ?? "").trim())) {
        return { refused: "a new experience has no name" };
    }

    /* A PICK THE SHEET CANNOT TAKE IS REFUSED, NOT SKIPPED (E10 C8, 1.2.71; audit S03-22). A statistic
       that is not one of TRAITS, and an experience to raise that the character does not have - none
       named, as a form with no experience to list sends it, or one not on the sheet as the GMs hold
       it (`numberHeld` at the experiences' root: the primary's mark, the sheet elsewhere) - went to
       `applyAdvancement`, which skipped the first kind and wrote a value under the second: the
       offer was spent either way, a pick of a Reinforced's three lost or written on an experience
       with no name. Refused here, before the latch, and told; the offer stands. An experience the
       GMs hold is an entry with a value to add to: a console's write of a new experience's value,
       put back, leaves the entry in the mark empty ({}; read on 10.10.2026 under tier 2's "a Level
       Up raises no experience a player's console made"), and a check of the entry alone let it be
       raised from 0. `applyAdvancement` checks the experiences again in its own job, where a write
       heard meanwhile has been judged. */
    const statistics = new Set(Object.values(TRAITS).map(trait => trait.dh));
    if (picks.some(p => p.option === "trait" && !statistics.has(p.trait))) {
        return { refused: "a pick raises a statistic that is not one" };
    }
    const experiences = numberHeld(actor, "system.experiences") ?? {};
    const held = id => typeof id === "string" && Object.hasOwn(experiences, id) && typeof experiences[id]?.value === "number";
    if (picks.some(p => p.option === "experienceUp" && !held(p.experience))) {
        return { refused: "a pick raises an experience the character does not have" };
    }

    /* ONE AT A TIME PER CHARACTER. The offer is only withdrawn once
       `applyAdvancement` has written the rises and awaited the store, three round
       trips later; two packets inside that window - two stacked pickers, a double
       press on a slow server - both found the offer standing and both applied. The
       lines above are synchronous, so nothing interleaves between reading the offer
       and taking the latch. The latch is level-up.mjs's since E10 fix r1-G2: a take-back
       of the offer reads it and is refused while it is held, and since r2-G4 holds it
       across its own drop, so a Level Up that arrives while that drop waits is refused here. */
    if (advancing.has(actor.id)) {
        return { refused: "a Level Up for that character is already being written" };
    }
    advancing.add(actor.id);
    try {
        await applyAdvancement(actor, picks, offer.kind, { offerId: offer.id });
    } finally {
        advancing.delete(actor.id);
    }
}

/** Characters whose refused Level Up the GMs were told this browser may not hold (see handleAdvancement). */
const offerMissingTold = new Set();

/**
 * A GM asks the primary to give an offer or take one back (N-2; E10 C6). Only a GM - the
 * declaration's first guard. `add` appends one of `kind` and answers its id - with `extra`
 * picks and how many of them waited for the class (`deferred`) when the verdict's window
 * gives it (E10 C7), bounded to whole numbers by `recordOffer`; `take` names an offer standing
 * on that character as the primary holds it (`offerId`), else it is refused.
 */
export async function handleAdvancementOffer(payload, sender, ctx) {
    const actor = game.actors.get(payload.actorId);
    if (!actor || actor.type !== "character") return { refused: "no such character" };
    const { recordOffer, dropOffer, standingOffers, advancing, takingBack } = await import("./level-up.mjs");
    if (payload.op === "take") {
        if (!standingOffers(actor).some(offer => offer.id === payload.offerId)) {
            return { refused: "no Level Up is on offer under that name for that character" };
        }
        // Not while the Level Up it would spend is being written, and that Level Up not while the drop
        // waits for the offers store (level-up.mjs `takeBackOffer`; E10 fix r1-G2, r2-G4). `takingBack` lets the
        // primary's own menu tell a second take-back from a Level Up (r2-G6); this road's refusal is told as busy.
        if (advancing.has(actor.id)) return { refused: "a Level Up for that character is already being written" };
        advancing.add(actor.id);
        takingBack.add(actor.id);
        try {
            await dropOffer(actor.id, payload.offerId);
        } finally {
            advancing.delete(actor.id);
            takingBack.delete(actor.id);
        }
        return { reply: { taken: payload.offerId } };
    }
    if (payload.op !== "add") return { refused: "an offer is given or taken back, nothing else" };
    const kind = payload.kind;
    if (!LEVEL_UP[kind]?.picks) return { refused: `no such Level Up: ${kind}` };
    const added = await recordOffer(actor.id, { kind, extra: payload.extra, deferred: payload.deferred });
    return { reply: added ? { id: added.id } : null };
}

/**
 * An owner asks for the offers on their own characters; the answer is the set - once
 * tier 2 lets the stores go, when it holds them (R2-M1), from this world's offers. Not
 * awaited: the ask is a report nobody waits on, and the runner is not held for it.
 */
export async function handleAdvancementAsk(payload, sender, ctx) {
    whenGmStoresAudible().then(() => sendOffersTo(sender.id)).catch(err => error("Could not answer an owner's offers", err));
}

/**
 * Primary GM: send one user the whole set of offers on their own characters.
 * Addressed - nobody else's browser receives it - and only when they are there.
 * With a stamp per character they own (E04): the owner's copy takes only what is
 * newer (level-up.mjs `offersFor`, gm-stores.mjs `offerCopy`).
 */
export async function sendOffersTo(userId) {
    const user = game.users.get(userId);
    if (!user?.active || user.isGM) return;
    // While tier 2 holds the stores the offers are a fixture's: no owner is sent them (R2-M1).
    if (gmStoresQuiet()) return;
    const { offersFor } = await import("./level-up.mjs");
    const { offers, stamps } = offersFor(userId);
    game.socket.emit(SOCKET_EVENT, {
        action: ACTION_ADVANCEMENT_OFFERS, userId, offers, stamps
    }, { recipients: [userId] });
}

    // Handing something to another character writes to a sheet the sender does
    // not own, so it can only happen here. The same-room condition is checked
    // again inside handover.mjs - the payload only claims it. One run for the
    // two actions: which one is `ctx.action`, the runner's, not a packet field.
export async function handleShareBulletOrGiveItem(payload, sender, ctx) {
    const { shareBullet, giveItem } = await import("./handover.mjs");
    const args = { fromId: payload.fromId, toId: payload.toId, itemId: payload.itemId };
    // A bullet whose answer keys this GM's stores could not open in time, the one gate's
    // refusals (inventory.mjs `transferRefusal`, asked by handover.mjs `verify`: notThere,
    // cannotNow, missing; E14 part 1 C1) and an item no GM has decided on come back with their
    // reason and are told by its code; a hand-over into full hands with no stash is the
    // giver's whisper (handover.mjs `giveItem`).
    const out = ctx.action === ACTION_SHARE_BULLET ? await shareBullet(args) : await giveItem(args);
    if (out?.refused) return { refused: out.refused };
}

    // Showing a secret passage (E79 C7): the recipient learns it in the GMs' records, which only the
    // primary writes. Every check past the sender's ownership of the giver is `shareRefusal`'s, and whether
    // the sender acts as the Mastermind through the giver is asked of the sender (E79 fix r2-G2, SEC M3).
export async function handlePassageShare(payload, sender) {
    const { sharePassage } = await import("./passages-gm.mjs");
    const out = await sharePassage({ actorId: payload.actorId, targetId: payload.targetId, passageId: payload.passageId }, { asker: sender });
    if (out?.refused) return { refused: out.refused };
}

// 'Go through' a tunnel (E80 C2): the token moved by the primary, which alone writes it for a player. Every check
// past the sender's ownership of the character is `crossTunnel`'s, against the GMs' records and the map as it is now.
export async function handlePassageCross(payload, sender) {
    const { crossTunnel } = await import("./passages-gm.mjs");
    const out = await crossTunnel({ actorId: payload.actorId, passageId: payload.passageId }, { asker: sender });
    if (out?.refused) return { refused: out.refused };
    return { reply: true };
}

/** The run of `token.refundCrossing` (E17 C3): the primary's own refund (movement.mjs `refundLastCrossing`), its reply or its refusal. */
export async function handleRefundCrossing(payload) {
    const { refundLastCrossing } = await import("./movement.mjs");
    const out = await refundLastCrossing(payload.actorId);
    if (out?.refused) return { refused: out.refused };
    return { reply: out?.reply ?? null };
}

// Find Passage (E80 C3): a `found` cell in the GMs' records, which only the primary writes. Every check past the sender's
// ownership of the character is `resolvePassageSearch`'s - the phase, the character, its room and floor where the GMs read
// it (movement.mjs `gmPlaceOf`), the passages it does not know - and the total is the GMs' record of the roll (`rolled`,
// `findPassageRoll`), never the packet's.
export async function handlePassageFind(payload, sender) {
    const { resolvePassageSearch } = await import("./passages-gm.mjs");
    const out = await resolvePassageSearch({ actorId: payload.actorId, total: payload.total, isCritical: payload.isCritical, rollId: payload.rollId },
        { asker: sender });
    if (out?.refused) return { refused: out.refused };
    return { reply: true };
}

/*
 * A FRISK'S TWO ROLLS, EACH THE GMS' RECORD (E80 part 2 C2; the A11 design's step 10), as a Palm's (`palmRolls`): the
 * hand's (`rollId`, thrown as "rummage") and the cover's (`unseenRollId`, thrown as "palm"), whose result goes in
 * `unseenTotal` and `unseenCritical`.
 */
export function friskRolls(actor) {
    return [
        { field: "rollId", actor, kind: "rummage" },
        { field: "unseenRollId", actor, kind: "palm", into: { total: "unseenTotal", isCritical: "unseenCritical" } }
    ];
}

/* A Find Passage's roll is an Analyze thrown as one (roll-draw.mjs keeps `findPassage` on its record): an Analyze for a
   hint or a bullet settles no passage search. Read off the GMs' record by the runner (bridge-guards.mjs `rollsFor`). */
export function findPassageRoll(record) {
    return record?.findPassage === true ? null : { why: "that roll was not thrown for that action" };
}

/* And the other way (E80 fix r1-G7, review E80-SEC-5): an Analyze thrown as a Find Passage settles no bullet and no stash
   search, so a console cannot pick the road after it sees the total, against the road the GMs' record says it was thrown
   for. A record that says nothing of it (drawn before C3, or `findPassage` false) is an Analyze for those roads. */
export function notFindPassageRoll(record) {
    return record?.findPassage === true ? { why: "that roll was not thrown for that action" } : null;
}

/*
 * A PALM'S TWO ROLLS, EACH THE GMS' RECORD (E08+E28 C15, 04.10.2026; audit S10-06). A Steal and a
 * Plant were scored on the packet's two totals - the hand's against the action's bar, the unseen
 * one against whether anybody watched (`stealFromPerson`, `plantOnPerson`). The packet names both
 * rolls now: the hand's (`rollId`, thrown as "steal" for a Steal and a Plant alike, as it always
 * was) and the unseen one (`unseenRollId`, thrown as "palm" since C15, palm.mjs
 * `performPalm`), whose result goes in `unseenTotal` and `unseenCritical`.
 * One hand's roll settles one Steal or one Plant.
 */
export function palmRolls(actor) {
    return [
        { field: "rollId", actor, kind: "steal" },
        { field: "unseenRollId", actor, kind: "palm", into: { total: "unseenTotal", isCritical: "unseenCritical" } }
    ];
}

    // And into them. Same guards as the theft, mirrored - the sender has to own
    // the character whose pocket the item is leaving. An item no GM has decided on
    // (E29 fix r2-H21), the one gate's refusals before the rolls (inventory.mjs
    // `transferRefusal`; E14 part 1 C1) and a stash's own (stash-reach.mjs `stealFromVault`;
    // E14 fix e1-G1) come back as { refused } and are told by their code; the gate's
    // second asking, after the rolls, is told as nothing carried out (fix e1-G4). What a
    // run carries out - a missed hand, full pockets - is the asker's whisper.
export async function handlePlant(payload, sender, ctx) {
    const { plantOnPerson } = await import("./vault.mjs");
    // The sender: a body the GMs keep from them is planted on as a living victim is (E80 fix sec1-G1; the one gate,
    // inventory.mjs `transferRefusal`, reads it so since E14 part 1 C1).
    const out = await plantOnPerson({
        plannerId: payload.plannerId,
        victimId: payload.victimId,
        itemId: payload.itemId,
        total: payload.total,
        isCritical: payload.isCritical,
        unseenTotal: payload.unseenTotal,
        unseenCritical: payload.unseenCritical
    }, { asker: sender });
    if (out?.refused) return { refused: out.refused };
}

    // Looking for a hiding place. The finder owns their own sheet and could
    // write the flag themselves - which is exactly why they do not: that write
    // is the whole distance between beating a 16 and reading other people's
    // stashes, so it happens where the threshold is checked.
export async function handleFindStash(payload, sender, ctx) {
    const { resolveStashSearch } = await import("./vault.mjs");
    const out = await resolveStashSearch({
        actorId: payload.actorId,
        total: payload.total,
        isCritical: payload.isCritical
    });
    // Refused in a Class Trial (E16 part 2 C3, S02-70) before the throw is read: told by its code, and no fact on the roll.
    if (out?.refused) return { refused: out.refused };
    // The GMs' fact on the roll the packet names (E80 C4, S16-19): it was a Find Stash, and whether it opened one. Its
    // Reroll replays the search from these (reroll.mjs `settleStashFind`), never from the roller's word - in the place
    // this search was made (`findPlace`, E80 fix r1-G4; the review's E80-G-1), never where the student stands by then.
    const rolls = await import("./action-rolls.mjs");
    await rolls.noteFactOn(rolls.rollOfFact({ rollId: payload.rollId ?? null, by: sender?.id ?? null, actorId: payload.actorId,
        actions: ["analyze"] }), { findStash: true, stashFound: Boolean(out?.found), ...(out?.place ? { findPlace: out.place } : {}) });
    // Answered once judged (E16 fix e1-G2): the asker gives the price back on a refusal, which it hears only so.
    return { reply: true };
}

    // And out of their pockets. Same reasoning as the stash below, plus one
    // more: the thief's client is the one that would benefit from getting the
    // arithmetic wrong, so it does none of it.
export async function handleSteal(payload, sender, ctx) {
    const { stealFromPerson } = await import("./vault.mjs");
    // The sender: a body the GMs keep from them is robbed as a living victim is (E80 fix sec1-G1; the one gate,
    // inventory.mjs `transferRefusal`, reads it so since E14 part 1 C1).
    const out = await stealFromPerson({
        thiefId: payload.thiefId,
        victimId: payload.victimId,
        itemId: payload.itemId,
        total: payload.total,
        isCritical: payload.isCritical,
        unseenTotal: payload.unseenTotal,
        unseenCritical: payload.unseenCritical
    }, { asker: sender });
    if (out?.refused) return { refused: out.refused };
}

/* An unseen Frisk (E80 part 2 C2): judged and its cards posted on the primary, on the two rolls' records (`friskRolls`). */
export async function handleFriskUnseen(payload, sender) {
    const { friskPerson } = await import("./frisk.mjs");
    const out = await friskPerson({
        searcherId: payload.searcherId, targetId: payload.targetId, total: payload.total, isCritical: payload.isCritical,
        unseenTotal: payload.unseenTotal, unseenCritical: payload.unseenCritical, rollId: payload.rollId ?? null
    }, { asker: sender });
    if (out?.refused) return { refused: out.refused };
    return { reply: out?.outcome ?? "settled" };
}

/* An open Frisk's ask (E80 part 2 C3): judged on the primary, which answers it later, when the target has answered or
   the clock has run (frisk.mjs `askToFrisk`), with the request's own `bridge.done`. */
export async function handleFriskAsk(payload, sender, ctx) {
    const { askToFrisk } = await import("./frisk.mjs");
    const reply = value => {
        if (!ctx?.requestId || !ctx.asker) return;
        game.socket.emit(SOCKET_EVENT, { action: ACTION_DONE, requestId: ctx.requestId, userId: ctx.asker, value }, { recipients: [ctx.asker] });
    };
    // The request id is the ask's on E18's one road: the searcher's expiry names it (`expiredOnPrimary`, E18 C7).
    const out = await askToFrisk({ searcherId: payload.searcherId, targetId: payload.targetId }, { asker: sender, reply, requestId: ctx?.requestId ?? null });
    if (out?.refused) return { refused: out.refused };
    if (out?.later) return { later: true };
    return { reply: out?.value ?? null };
}

/* An answer to that ask, judged by who sent it (frisk.mjs `answerFrisk`). */
export async function handleFriskAnswer(payload, sender) {
    const { answerFrisk } = await import("./frisk.mjs");
    const out = await answerFrisk({ askId: payload.askId, allow: payload.allow }, sender);
    if (out?.refused) return { refused: out.refused };
    return { reply: out?.outcome ?? null };
}

/* A force or a 'Leave it' (frisk.mjs `followFrisk`), its roll's result read off the GMs' record (`friskForceRoll`). */
export async function handleFriskFollow(payload, sender) {
    const { followFrisk } = await import("./frisk.mjs");
    const out = await followFrisk({ searcherId: payload.searcherId, askId: payload.askId, rollId: payload.rollId,
        total: payload.total, isCritical: payload.isCritical }, sender);
    if (out?.refused) return { refused: out.refused };
    return { reply: out?.outcome ?? null };
}

/*
 * A FORCE'S ROLL, FOR THE ASK IT NAMES (E80 part 2 C3). The runner holds the record to the searcher, to a `frisk` roll and
 * to one settlement (`rollRefusal`); this holds it to the ask: one the primary holds for that searcher, a roll drawn after
 * the ask was made and no later than its force's window, its grace and the roll's window (frisk.mjs `forceDrawnBy`, which
 * `friskForceOpen` held the draw to; E80 fix r1-G1, r1-G2), so a Body roll drawn for one ask settles no other. Its fields
 * are the record's result.
 */
export async function friskForceRoll(record, payload) {
    const { friskAsks, forceDrawnBy } = await import("./frisk.mjs");
    const row = friskAsks.get(typeof payload?.askId === "string" ? payload.askId : "") ?? null;
    if (!row) return { why: "no such Frisk ask" };
    if (row.searcherId !== record.actorId) return { why: "not their character" };
    if (!(Number(record.at) >= Number(row.at))) return { why: "that roll was not thrown for that action" };
    if (!(Number(record.at) <= forceDrawnBy(row))) return { why: "that roll is too old to settle anything" };
    return { fields: { total: Number(record.total) || 0, isCritical: Boolean(record.isCritical) } };
}

    // Taking something out of somebody else's stash writes to two sheets, one of
    // which the thief has no business writing to.
export async function handleVaultSteal(payload, sender, ctx) {
    const { stealFromVault } = await import("./vault.mjs");
    const out = await stealFromVault({
        thiefId: payload.thiefId, ownerId: payload.ownerId, itemId: payload.itemId,
        // Set only by the Search action, which pays for the concealment it is
        // beating. See the note in `stealFromVault`. Since E08+E28 C15 a packet
        // that says so names the Search's roll, and this is the GMs' record of it
        // (`searchTheftOf`).
        viaSearch: payload.viaSearch,
        // Whether the Search fumbled it, read off the same record: the sender's
        // word until C15, which a client could only ever bend one way - a steady
        // hand, and the victim not told. On a GM whose Daggerheart is not the build
        // the draw was written for nobody keeps a record, and it is the sender's
        // word again (bridge-guards.mjs, "TWO PACKETS PASS WITH NO RECORD").
        clumsy: payload.clumsy
    });
    if (out?.refused) return { refused: out.refused };
    // Whether the thing moved (E16 fix e1-G2): a Search leaves its trace only on `taken` (action-search.mjs `searchStash`).
    return { reply: { taken: Boolean(out) } };
}

/*
 * WHAT A SEARCH EARNED AT A STASH, ON THE GMS' RECORD (E08+E28 C15, 04.10.2026; audit S10-06).
 * `viaSearch` and `clumsy` were the sender's word: that a Search had paid for a concealed stash,
 * and that its hand was steady. A packet that says `viaSearch` now names the Search's roll, and
 * both are read off the GMs' record of it: the Search found the stash when its total, with the
 * hidden stash's step the GM drew with the dice (`used.stash`, roll-draw.mjs `drawOnGm`), reaches
 * a tier of the Search's table, or the roll is a critical - action-search.mjs `searchTier`, as
 * `performSearch` reads it before it opens the stash (`searchStash`); it fumbled on Despair with no
 * critical, as `searchStash` says. A packet that does not say `viaSearch` asks no roll: it is the
 * drawer's free route, which `stealFromVault` holds to a stash that is not concealed or was found,
 * and its `clumsy` can only tell the stash's owner on the sender.
 */
export async function searchTheftOf(record) {
    const { searchTier } = await import("./action-rolls.mjs");
    const { sheetMarkStore } = await import("./gm-stores.mjs");
    const { hit } = searchTier(record, record.used?.stash?.change ?? 0);
    if (!hit && !record.isCritical) return { why: "that roll did not find the stash" };
    // A Search ends in a find or in a stash's loot, never both (`performSearch`): a record a find
    // already stood on (sheet-audit.mjs `searchFind`, the mark's `finds`) takes no theft (E29 fix r1-G8).
    if (sheetMarkStore.get(record.actorId)?.finds?.[record.rollId]) return { why: "that roll has already settled that action" };
    return { fields: { viaSearch: true, clumsy: Boolean(record.withFear) && !record.isCritical } };
}

    // Stage 4 thrown on the participant's own client. Same guard as a crisis
    // action: the sender has to own the character the roll is about, or one
    // player could open somebody else's murder for them.
export async function handleOpeningResult(payload, sender, ctx) {
    const { resolveOpening } = await import("./murder.mjs");
    await resolveOpening({
        actorId: payload.actorId,
        side: payload.side,
        total: payload.total,
        isCritical: payload.isCritical,
        withHope: payload.withHope
    });
}

    // A crisis action writes to the other participant's sheet, to the map and to
    // the shared incident state. All three are GM-only. It is judged again
    // before it lands - see `guardCrisisAction` - and murder.mjs is imported in
    // the declaration's `prepare`, before those guards, as it was here, so the
    // last guard and the write have nothing awaited between them.
export async function handleCrisis(payload, sender, ctx, prepared) {
    const { resolveCrisisAction, freeResolutionFor, sideOf } = prepared;
    const actor = game.actors.get(payload.actorId);
    // A player's packet that names no roll threw none (`guardCrisisRoll`): a decision or a free
    // take, scored on no dice - a total of 0, no critical, with Hope - as its asker sends it,
    // whatever this one says (E08+E28 C17). One that names its roll carries the GMs' record of it.
    const unrolled = !sender.isGM && !payload.rollId;
    const result = await resolveCrisisAction({
        actorId: payload.actorId,
        key: payload.key,
        total: unrolled ? 0 : payload.total,
        isCritical: unrolled ? false : payload.isCritical,
        withHope: unrolled ? true : payload.withHope,
        // A Reroll replacing this actor's own last crisis action: a GM's packet
        // alone carries it (`as.gmFlag`, E08+E28 C8).
        undo: payload.undo,
        // Narrowed rather than trusted, by the whitelist: the only two answers
        // this can carry are the two resources a critical Strike may take.
        choice: payload.choice,
        // An id, and one the sender's own character actually holds. It only
        // ever becomes a receipt line, but a receipt naming somebody else's
        // item would give a Reroll the run of another sheet.
        usedItemId: actor?.items?.has(payload.usedItemId) ? payload.usedItemId : null,
        // Same test: the swing names an item, and only one the sender holds. The
        // damage is read off it since E32+E07 C8, and murder-rules.mjs `swungWeapon`
        // narrows it further, to a readied Crime Tool on an action that swings.
        swungId: actor?.items?.has(payload.swungId) ? payload.swungId : null,
        // What the item's use started from, as the player read it: their own character's
        // (the declaration's `owns`), numbers or nothing (`resourcesBefore`). Kept on the
        // GMs' bookmark only (E08+E28 C2).
        before: payload.before,
        // The roll the GMs' fact of it goes on, for this sender (fix r1-G2): `rollOfFact`.
        rollId: payload.rollId,
        by: sender.id,
        /*
         * G-18, AND THIS IS THE ONE FIELD ON THIS SOCKET THAT COULD BUY
         * SOMETHING FOR NOTHING.
         *
         * A packet claiming `free` is claiming an automatic success on
         * Survive or Role reversal - the two actions that end an incident.
         * So it is not believed. The grant is looked up in the incident
         * state on THIS side, for the side this actor is actually on, and a
         * claim with nothing behind it is dropped to false: the action then
         * scores against its real threshold with a total of zero, which is
         * a failure. That is the right answer to a forged packet - refusing
         * outright would let a lost socket message turn a legitimate free
         * take into silence instead of a result.
         */
        free: payload.free && Boolean(freeResolutionFor(sideOf(actor)))
    });
    // Null: a Reroll's rewind that could not happen (the GMs have been told), or
    // no incident, character or action to score - nothing was applied (E31 review).
    if (!result) return { refused: "nothing was carried out: resolveCrisisAction resolved nothing" };
    // Said back only when the action's own resolution killed (E32+E07 C8b). The asker's
    // browser kept it on the roll's bookmark until E08+E28 C4a; the GM's Reroll now reads
    // the death off the action's receipt itself (reroll.mjs `replayRefusal`).
    // The asker is in that death card's audience already; any other answer is null, as before.
    if (result.lethal) return { reply: { lethal: true } };
}

    // A direct murder declared in the dark. The declaration is written in the GMs'
    // store (eclipse.mjs, since E05 - until then a world setting every browser
    // held, so the parking itself was the leak), and a player's client holds no
    // GM store, so it travels; the judgement happens when the Eclipse ends, on a
    // GM's side, off the final placement.
    //
    // Nothing about the outcome is decided here or sent back - that is the whole
    // point of parking it, and a bridge that answered "recorded" with anything
    // more would tell the asker what only the GMs know.
    //
    // Only while an Eclipse runs (E05 fix r1-G3; review S1-m8), as `eclipse.move` is: outside
    // one nothing is written and nobody is asked, and the asker is told.
export async function handleParkMurder(payload, sender, ctx) {
    const eclipse = await import("./eclipse.mjs");
    if (!eclipse.eclipseId()) return { refused: "no Eclipse is running" };
    await eclipse.writeParkedMurder({
        killerId: payload.killerId,
        room: payload.room,
        note: payload.note,
        proposed: payload.proposed
    });
}

    // The newcomer turns on the person they just helped. Opening a murder is a
    // world write and a second death, so the request travels and the decision
    // is re-derived from the incident on this side - `betrayAsPlayer` refuses
    // anyone the state does not put in that position.
    //
    // In an Eclipse it is a declaration (E32 C5b, 28.09.2026; the owner's Q3): the
    // asking client has paid an action for it, so it is answered - parked, or refused
    // and told, and the client gives the action back. Refused here unless the betrayal
    // is on offer to that character now, and - the offer stays in the cast until the
    // lights (fix r1-G2), so the tile stays lit - unless it is declared already;
    // `betrayAsPlayer` parks it.
export async function handleBetrayal(payload, sender, ctx) {
    const murder = await import("./murder.mjs");
    const { isEclipse, betrayalDeclared } = await import("./eclipse.mjs");
    if (!isEclipse()) {
        await murder.betrayAsPlayer(payload.actorId, { note: payload.note, proposed: payload.proposed });
        return;
    }
    if (!murder.betrayalTarget(game.actors.get(payload.actorId))) return { refused: "that cannot be done now" };
    if (betrayalDeclared(payload.actorId)) return { refused: "that betrayal is already declared" };
    const parked = await murder.betrayAsPlayer(payload.actorId, { note: payload.note, proposed: payload.proposed });
    if (!parked) return { refused: "nothing was carried out: betrayAsPlayer parked nothing" };
    return { reply: true };
}

    // Stage 6. Deleting a Remnant token, placing the new one a botched wipe
    // leaves, and reading how visible the trace was in the first place are all
    // GM-only - the last of those most of all, since it is the threshold the
    // roll is being measured against. See cleanup.mjs. cleanup.mjs is imported
    // in the declaration's `prepare`, before the guards, as it was here.
export async function handleCleanup(payload, sender, ctx, prepared) {
    const cleanup = prepared;

    // The two added Stage 6 actions score differently - a flat threshold
    // rather than one read off a trace's visibility - so they have their own
    // resolver. Same guard, same sender check; only the maths differs.
    if (payload.key && payload.key !== "eraseTrace" && payload.key !== "transformTrace") {
        const result = await cleanup.resolveStageSix({
            actorId: payload.actorId,
            key: payload.key,
            targetId: payload.targetId,
            total: payload.total,
            isCritical: payload.isCritical,
            withHope: payload.withHope,
            viaAction: payload.viaAction,
            // Which step the client paid. Bounded on arrival against
            // PRICE_CHAINS, like `transform` and `change` (T-1).
            price: payload.price ?? null,
            grant: payload.grant,
            // Who sent it, as below: a give-back the GMs' audit cannot check is not
            // made on a player's word (cleanup.mjs `paidBack`, fix r2-G8).
            by: sender.id,
            // The roll the author's copy is noted on (cleanup.mjs `authorsCopy`, E70 C12): the bridge's `rolled` holds it.
            rollId: payload.rollId ?? null
        });
        // Not a guard: who may be framed and where the body lies are the
        // resolver's own rules, asked of a GM's Stage 6 too (cleanup.mjs).
        if (result?.refused) return { refused: result.refused };
        // Null: a refusal the resolver keeps to the GM's console - nothing was done (E31 review).
        if (!result) return { refused: "nothing was carried out: resolveStageSix did nothing" };
        return;
    }

    // Null is a refusal the resolver keeps to the GM's console, or a Reroll's rewind
    // that could not happen: nothing was done (E31 review). An answer that is not
    // null - a trace gone, not found, reinforced - has been whispered to the cleaner.
    const cleaned = await cleanup.resolveCleanup({
        actorId: payload.actorId,
        tokenId: payload.tokenId,
        total: payload.total,
        isCritical: payload.isCritical,
        withHope: payload.withHope,
        // G-20. Passed through as sent and bounded on arrival -
        // `resolveCleanup` checks both halves against `CLEANUP.transform`
        // before it touches anything, which is the same check a GM-side
        // call gets.
        transform: payload.transform ?? null,
        // Z5, and the same contract: sent as given, bounded on arrival.
        mode: payload.key === "transformTrace" ? "transform" : "erase",
        change: payload.change ?? null,
        undo: payload.undo,
        // T-1, same contract: sent as given, bounded on arrival.
        price: payload.price ?? null,
        grant: payload.grant,
        // A claim that WAIVES Stage 6's guards and ADDS one of its own: the
        // trace has to belong to the sender. Forging it costs them the
        // right to touch anybody else's trace, which is the only thing the
        // waived guards were protecting.
        viaAction: payload.viaAction,
        rollId: payload.rollId,
        by: sender.id
    });
    if (!cleaned) return { refused: "nothing was carried out: resolveCleanup cleaned nothing" };
}

    // A Monocub's ability writes to the TARGET's sheet, not the Monocub's own -
    // arming a Call is exactly the write a player has no permission to make on
    // somebody else's actor. Its dice are thrown here since E08+E28 C17, by the
    // row the packet's `key` names (E33 C10, `cubAbilityOnGm`), and the roll goes
    // back for the Monocub's card - none for one it refuses, which throws nothing
    // since fix r2-H7.
export async function handleCubAbility(payload, sender, ctx) {
    const { cubAbilityOnGm } = await import("./monocub.mjs");
    return { reply: await cubAbilityOnGm({ actorId: payload.actorId, key: payload.key, targetId: payload.targetId, choice: payload.choice }) };
}

/*
 * THE TWO RULINGS BY CARD CHECK WHOSE CHARACTER THEY ARE ABOUT (E01, 24.09.2026;
 * audit S14-03). Both handed the payload straight to `askHopeCallByCard` /
 * `askDynamicByCard`, which raise a `callGm` card on `payload.actorId` with the
 * sender's words on it - so any player could put a card on somebody else's
 * thread, in that character's name, asking for a ruling nobody at the table
 * requested. R1b could not see it: the handler bodies never spelled
 * `payload.actorId`, they passed the whole payload along. Both requests are made
 * by the asking player's own client with their own character's id (calls.mjs,
 * action-rolls.mjs), so the guard - an `owns` on `actorId` in each declaration
 * now - refuses nothing honest. The answer comes later, from the card, so the run
 * answers `{ later: true }`.
 */
export async function handleHopeCall(payload, sender, ctx) {
    return askHopeCallByCard(payload, ctx);
}

/** The run of `call.yes` (E29 fix r2-H4): another GM's yes on a Call's card, kept and sent on by this primary. */
export async function handleCallYes(payload, sender) {
    return (await yesOnPrimary(payload.rid, payload.asker, sender.id, payload.messageId))
        ? { reply: true } : { refused: "nothing was carried out: the primary GM holds no ask of that Call under that request" };
}

/** The run of `dynamic.answer` (E18 C1): another GM's difficulty or refusal on a Dynamic action's card, sent on by this primary. */
export async function handleDynamicAnswer(payload, sender) {
    const ruling = payload.refuse ? false : { tier: payload.tier, trait: payload.trait };
    return (await dynamicOnPrimary(payload.rid, payload.asker, ruling, sender.id, payload.messageId))
        ? { reply: true } : { refused: "nothing was carried out: the primary GM holds no Dynamic ask under that request" };
}

/** The run of `ruling.expired` (E18 C1): the asker's clock ran out, so its card ends here. */
export async function handleRulingExpired(payload, sender) {
    if (!(await expiredOnPrimary(payload.rid, sender.id))) return { refused: "nothing was carried out: the primary GM holds no ask of the sender under that id" };
}

/** The run of `ruling.received` (E18 C1): the ruling reached its asker, so its card is written as ruled here. */
export async function handleRulingReceived(payload, sender) {
    if (!(await receivedOnPrimary(payload.rid, sender.id))) return { refused: "nothing was carried out: the primary GM sent the sender no ruling under that id" };
}

export async function handleDifficulty(payload, sender, ctx) {
    return askDynamicByCard(payload, ctx);
}

export async function handleTraitRuling(payload, sender, ctx) {
    return askTraitByCard(payload, ctx);
}
