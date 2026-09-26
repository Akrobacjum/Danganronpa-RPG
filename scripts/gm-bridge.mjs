/**
 * Danganronpa RPG - calling the GM, and asking them to write.
 * ---------------------------------------------------------------------------
 * Two jobs:
 *
 *   callGm()  - the guide's actions that need a human ruling (Think, Listen,
 *               Analyze, Direct Murder, starting a project). The player's roll
 *               and request are whispered to the GMs with the context they need
 *               to answer, so nobody has to shout across the table.
 *
 *   request*() - world settings can only be written by a GM client, so a
 *               player's project progress is forwarded over the socket.
 */

import {
    MODULE_ID, TRAITS, HOPE_CALLS, DESPAIR_CALLS, STARTING, PROJECT_SCALE, TIMING,
    LEVEL_UP, LEVEL_UP_OPTIONS
} from "./config.mjs";
import { announce, whisperToGms, whisperToOwner, ownerOf, isPrimaryGm, primaryGmId, dialogContent, debug, error, cardHead, esc } from "./utils.mjs";
import {
    firstRefusal, guardObserveReceipt, guardAnalyzeReceipt, guardCrisisAction, guardCrisisUndo,
    guardCrisisReceipt, guardCleanupReceipt, guardProgressOwner, guardProgressReceipt, guardShareSecret,
    guardShareGuest, guardTieTraceHolder, guardRemnantEditReceipt, guardUnsabotagePair, guardUnsabotageOwner,
    guardUnsabotageReceipt, guardSendbackPlace, armBuyerId, guardArmCharacter, guardArmPlayerCall,
    guardArmCallGrants, guardArmNotHeld, guardArmBuyer, guardArmOtherCharacter, guardArmHopeCallAllowed,
    guardArmBuyerHope, guardDespairOwner, guardDespairMonokuma, guardDespairDelta, guardDespairPool,
    guardDespairReceipt, table, tokenActorOf, remnantSourceOf, knownSender, owns, ownsActorAt, gmOnly,
    playersOnly, canSeeProject, inRange, as, pick, judge, replyForMe, bridgeRequest, resendOnGmReady
} from "./bridge-guards.mjs";
// R148 and anything else that asked gm-bridge.mjs for it keep finding it here (E31).
export { removalRefusal } from "./bridge-guards.mjs";

import { contentOf } from "./secret.mjs";
import { gmStoresQuiet, whenGmStoresAudible } from "./gm-store.mjs";
const SOCKET_EVENT = `module.${MODULE_ID}`;
const ACTION_PROGRESS = "project.progress";
const ACTION_SHARE = "project.share";
const ACTION_REMNANT = "remnant.place";
/* The weapon was swung on the player's client; the ledger that records
   which trace handed it over is the GM's. See `tieTraceForItem`. */
const ACTION_TIE_TRACE = "remnant.tieForItem";
const ACTION_REMNANT_EDIT = "remnant.edit";
const ACTION_SABOTAGE = "project.sabotage";
const ACTION_UNSABOTAGE = "project.unsabotage";
const ACTION_SENDBACK = "token.sendBack";
const ACTION_ECLIPSE_MOVE = "eclipse.move";
const ACTION_ARM = "call.arm";
const ACTION_DESPAIR = "despair.adjust";
const ACTION_DIFFICULTY = "dynamic.difficulty";
/** player -> GM: "may I spend this Call, and here is what for". */
const ACTION_HOPE_CALL = "call.approve";
const ACTION_OBSERVE_TARGET = "observe.target";
const ACTION_OBSERVE_RESOLVE = "observe.resolve";
const ACTION_CLEANUP_TRACES = "cleanup.traces";
const ACTION_ANALYZE_RESOLVE = "analyze.resolve";
/* N-2: the player picked their own Level Up and the GM's client writes it. */
const ACTION_ADVANCEMENT = "advancement.apply";
/* ...and where the offer itself lives: a GM asks the primary to record or withdraw
   one, an owner asks the primary for theirs, and the primary answers with the set.
   See "WHERE AN OFFER LIVES" in level-up.mjs. */
const ACTION_ADVANCEMENT_OFFER = "advancement.offer";
const ACTION_ADVANCEMENT_ASK = "advancement.ask";
const ACTION_ADVANCEMENT_OFFERS = "advancement.offers";
const ACTION_SHARE_BULLET = "handover.bullet";
const ACTION_GIVE_ITEM = "handover.item";
const ACTION_VAULT_STEAL = "vault.steal";
const ACTION_STEAL = "action.steal";
const ACTION_FIND_STASH = "vault.findStash";
const ACTION_PLANT = "action.plant";
const ACTION_CRISIS = "murder.crisis";
/** GM -> player: "Stage 4 is yours to throw." */
const ACTION_OPENING_ASK = "murder.openingAsk";
const ACTION_OPENING_CANCEL = "murder.openingCancel";
/** player -> GM: what it came up. */
const ACTION_OPENING_RESULT = "murder.openingResult";
const ACTION_CLEANUP = "murder.cleanup";
const ACTION_BETRAYAL = "murder.betrayal";
const ACTION_PARK_MURDER = "murder.park";
const ACTION_MEDDLE = "monocub.meddle";
/** GM -> player: a request carried out, with its answer - see `bridgeRequest` in bridge-guards.mjs. */
const ACTION_DONE = "bridge.done";
/** A GM's world has finished loading - see `registerGmBridge`. */
const ACTION_GM_READY = "bridge.gmReady";
const ACTION_LOOT = "body.loot";

/**
 * A primary GM has finished loading and can answer questions again.
 *
 * THE GM'S BROWSER IS ALLOWED TO CRASH. A ruling lives in a card or a dialog on
 * their screen and in nothing else: reloading with it open threw the question
 * away, and the player sat on "Awaiting a ruling." until their own clock gave
 * up. The action was spent and the roll was thrown, so what they lost was real,
 * and neither side had any way back to it (B-F5-1). The asking client is the
 * one that survives all this, so it is the one that repeats itself: when the
 * primary GM's world has loaded and this browser is still waiting, each request
 * that asked for it goes out again once, with the SAME request id, so the answer
 * lands in the promise already waiting for it (`resendOnGmReady`,
 * bridge-guards.mjs). Once per request, and only while it is still waiting.
 */
function onGmReady(payload, senderId) {
    if (payload?.action !== ACTION_GM_READY) return;
    if (!game.users.get(senderId)?.isGM) return;
    // The PRIMARY GM's arrival, not any GM's (COMM-05): a second GM joining
    // while the primary still had the question open made this client ask it
    // again, and the primary was answering the same request twice. When the
    // primary role has moved to the newcomer, the newcomer IS the primary.
    // Its own packet says it is up, whether or not this client has seen it connect (E04's fix round).
    if (senderId !== primaryGmId({ arriving: senderId })) return;
    resendOnGmReady();
    // And the Level Ups: a primary that has just arrived is the one holding them.
    askForOffers();
    /* And every copy a player holds of a GM store - the door, the cast, the fog - asks the
       arriving primary the same way (E04's fix round: the fix list's 15 and the round-2
       review's m4). They asked on `userConnected`, which on a live reload fires before the
       GM's world has loaded and its listeners exist: the question was lost, and a player
       who had loaded first held no copy until its own next load. The hook carries the
       primary's id, so a client that has not seen it connect yet still knows whom to ask. */
    Hooks.callAll("drpgPrimaryReady", senderId);
}

export function registerGmBridge() {
    /* THE RESCUE SIGNAL IS "A GM IS LISTENING", NOT "A GM IS CONNECTED".
       -----------------------------------------------------------------------
       `userConnected` fires when a GM's socket comes up, which is many seconds
       before their world has finished loading and this very function has run -
       measured on a live reload: the re-sent question left before the GM had a
       listener for it and vanished. So the GM announces themselves once, HERE,
       at the point where they can actually answer, and anybody still waiting
       asks again. */
    if (game.user.isGM) game.socket.emit(SOCKET_EVENT, { action: ACTION_GM_READY });
    else game.socket.on(SOCKET_EVENT, onGmReady);

    // A ruling card with no thread to live in (see the fallback in `callGm`)
    // is a chat card, and its buttons need the same wiring a bubble gets.
    // After the secret swap: the import is a microtask, and the swap ran in
    // this same hook dispatch.
    if (game.user.isGM) {
        Hooks.on("renderChatMessageHTML", (message, element) => {
            if (!message.getFlag(MODULE_ID, "callCard")) return;
            import("./messenger-app.mjs")
                .then(m => m.wireCallActions(element.querySelector(".message-content") ?? element, message))
                .catch(err => debug("Could not wire a ruling card in the log", err));
        });
    }
    game.socket.on(SOCKET_EVENT, onSocket);
    // The answers to this client's own requests - "got it", done, refused - come
    // back through the one listener `registerBridgeReplies` puts up (module.mjs).
    // The one request that travels the other way - GM to player - so it cannot
    // sit behind the `isPrimaryGm` gate in `onSocket` either.
    game.socket.on(SOCKET_EVENT, onOpeningAsk);
    // And its withdrawal, which travels the same way for the same reason.
    game.socket.on(SOCKET_EVENT, onOpeningCancel);
    // The Level Ups offered to this user's characters travel GM -> owner as well.
    // Asked for once the listener is up - never pushed on `userConnected`, which
    // arrives before a newcomer can hear it (see the note at the top).
    game.socket.on(SOCKET_EVENT, onAdvancementOffers);
    askForOffers();
}

/**
 * Stage 4, thrown by the person it is about.
 *
 * The opening rolls used to be thrown on the GM's client, which meant the two
 * dice that decide whether a murder happens at all were rolled by somebody who
 * is not the killer and not the victim - and the roll window, the Hope it grants
 * and any Call armed for it all landed on the wrong screen. This carries the
 * request to the participant's own client; the answer comes back through
 * `ACTION_OPENING_RESULT` and is applied by a GM, because Stage 4 writes world
 * state.
 *
 * `senderId` is checked rather than the payload: an invitation to roll is an
 * instruction to spend this character's resources, and only a GM may issue it.
 */
async function onOpeningAsk(payload, senderId) {
    if (payload?.action !== ACTION_OPENING_ASK) return;
    if (payload.userId !== game.user.id) return;
    if (!game.users.get(senderId)?.isGM) return;

    const { throwOpeningRoll } = await import("./murder.mjs");
    await throwOpeningRoll(payload.side, payload.actorId);
}

/**
 * Ask a participant's own client to throw their Stage 4 roll.
 * @returns {boolean} false when nobody is there to ask, so the GM throws it.
 */
export function askOpeningRoll({ userId, actorId, side }) {
    if (!userId || !game.users.get(userId)?.active) return false;
    game.socket.emit(SOCKET_EVENT, {
        action: ACTION_OPENING_ASK, userId, actorId, side
    }, { recipients: [userId] });
    return true;
}

/**
 * Take the invitation back.
 *
 * An invitation is an instruction to spend a character's resources, so its
 * withdrawal is checked the same way it was issued: `senderId`, not the claim
 * in the payload.
 */
async function onOpeningCancel(payload, senderId) {
    if (payload?.action !== ACTION_OPENING_CANCEL) return;
    if (payload.userId !== game.user.id) return;
    if (!game.users.get(senderId)?.isGM) return;

    const { closeOpeningRoll } = await import("./murder.mjs");
    closeOpeningRoll();
}

/** Withdraw a Stage 4 invitation from whoever is sitting in front of it. */
export function cancelOpeningRoll({ userId }) {
    if (!userId || !game.users.get(userId)?.active) return false;
    game.socket.emit(SOCKET_EVENT, {
        action: ACTION_OPENING_CANCEL, userId
    }, { recipients: [userId] });
    return true;
}

/** Send a thrown opening roll to the GM, who owns Stage 4's state. */
export function requestOpeningResult({ actorId, side, total, isCritical, withHope }) {
    return ask(ACTION_OPENING_RESULT, { actorId, side, total, isCritical, withHope }, {
        local: () => import("./murder.mjs").then(m => m.resolveOpening({ actorId, side, total, isCritical, withHope }))
    });
}

/*
 * THE RUNS (E31, 25.09.2026). Each handler below is the `run` of one
 * declaration in BRIDGE_ACTIONS, at the end of this file, and keeps its name,
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
async function handleObserveTarget(payload, sender, ctx) {
    const { chooseObserveTarget } = await import("./observe.mjs");
    const result = await chooseObserveTarget({
        actorId: payload.actorId,
        declaration: payload.declaration,
        request: payload.request,
        // The key is minted for this account and no other (E03; audit S05-03).
        userId: sender.isGM ? null : sender.id
    });
    return { reply: result };
}

    // Stage 6's picker. Which traces a killer's own client may act on is
    // computed here for the same reason Observe is: the ledger - the answer
    // key `cleanableRemnants` reads to build the list - lives only on a GM
    // client, and `cleanableTracesForPlayer` (cleanup.mjs) is what strips it
    // back down to id, label and the reinforced flag before it goes out.
async function handleCleanupTraces(payload, sender, ctx) {
    const { cleanableTracesForPlayer } = await import("./cleanup.mjs");
    return { reply: cleanableTracesForPlayer(payload.actorId, { mine: payload.mine }) };
}

async function handleObserveResolve(payload, sender, ctx) {
    // The sender has to own the character the packet names (the declaration's
    // guard). That alone was taken to mean "the person who asked for this key",
    // and it did not: the key named a character of its own and nothing compared
    // the two (audit S05-03). `resolveObserve` now holds the key to its
    // character, its account and one use (`observeResolveRefusal`), and an undo
    // to a Reroll (`guardObserveReceipt`).
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
        senderIsGm: sender.isGM
    });
    // Not a guard: the key is judged inside `resolveObserve`, against the entry
    // it has just read, and for a GM's own resolve as much as for a packet.
    if (result?.refused) return { refused: result.refused };
}

    // Analyze is scored here for the same reason as Observe: the difficulty is
    // read from what the bullet really is, which is the answer being bought.
async function handleAnalyzeResolve(payload, sender, ctx) {
    const { resolveAnalyze } = await import("./analyze.mjs");
    const result = await resolveAnalyze({
        actorId: payload.actorId,
        itemId: payload.itemId,
        total: payload.total,
        isCritical: payload.isCritical,
        undo: payload.undo
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
 * The offer is cleared by `applyAdvancement`, so a second packet finds nothing
 * standing and is refused by the same test that admitted the first.
 */
async function handleAdvancement(payload, sender, ctx) {
    const actor = game.actors.get(payload.actorId);
    if (!actor) return { refused: "no such character" };

    const { pendingAdvance, applyAdvancement } = await import("./level-up.mjs");
    const offer = pendingAdvance(actor);
    if (!offer) {
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

    const wanted = LEVEL_UP[offer.kind]?.picks ?? 0;
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

    /* ONE AT A TIME PER CHARACTER. The offer is only withdrawn once
       `applyAdvancement` has written the rises and awaited the store, three round
       trips later; two packets inside that window - two stacked pickers, a double
       press on a slow server - both found the offer standing and both applied. The
       lines above are synchronous, so nothing interleaves between reading the offer
       and taking the latch. */
    if (advancing.has(actor.id)) {
        return { refused: "a Level Up for that character is already being written" };
    }
    advancing.add(actor.id);
    try {
        await applyAdvancement(actor, picks, offer.kind);
    } finally {
        advancing.delete(actor.id);
    }
}

/** Characters whose Level Up is being written right now (see handleAdvancement). */
const advancing = new Set();
/** Characters whose refused Level Up the GMs were told this browser may not hold (see handleAdvancement). */
const offerMissingTold = new Set();

/** A GM asks the primary to record or withdraw an offer (N-2). Only a GM - the declaration's first guard. */
async function handleAdvancementOffer(payload, sender, ctx) {
    const actor = game.actors.get(payload.actorId);
    if (!actor || actor.type !== "character") return { refused: "no such character" };
    const kind = payload.kind;
    if (kind !== null && !LEVEL_UP[kind]?.picks) return { refused: `no such Level Up: ${kind}` };
    const { recordOffer } = await import("./level-up.mjs");
    await recordOffer(actor.id, kind);
}

/**
 * An owner asks for the offers on their own characters; the answer is the set - once
 * tier 2 lets the stores go, when it holds them (R2-M1), from this world's offers. Not
 * awaited: the ask is a report nobody waits on, and the runner is not held for it.
 */
async function handleAdvancementAsk(payload, sender, ctx) {
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

/** A GM other than the primary: have the primary record or withdraw an offer. */
export function requestOfferRecord(actorId, kind) {
    return ask(ACTION_ADVANCEMENT_OFFER, { actorId, kind });
}

/** An owner's browser: take the set the primary sent. Outside the primary gate. */
function onAdvancementOffers(payload, senderId) {
    if (payload?.action !== ACTION_ADVANCEMENT_OFFERS) return;
    if (!replyForMe(payload, senderId)) return;
    import("./level-up.mjs")
        .then(m => m.receiveOffers(payload.offers, payload.stamps))
        .catch(err => error("Could not keep the Level Ups offered to you", err));
}

/**
 * An owner's browser: ask the primary for this user's offers. A background
 * question nobody waits on (the answer is a packet of its own), so it is quiet,
 * and with no GM connected it is not sent - it used to be broadcast to every
 * client then.
 */
function askForOffers() {
    if (game.user.isGM) return;
    void ask(ACTION_ADVANCEMENT_ASK, {});
}

    // Handing something to another character writes to a sheet the sender does
    // not own, so it can only happen here. The same-room condition is checked
    // again inside handover.mjs - the payload only claims it. One run for the
    // two actions: which one is `ctx.action`, the runner's, not a packet field.
async function handleShareBulletOrGiveItem(payload, sender, ctx) {
    const { shareBullet, giveItem } = await import("./handover.mjs");
    const args = { fromId: payload.fromId, toId: payload.toId, itemId: payload.itemId };
    // A bullet whose answer keys this GM's stores could not open in time is refused
    // through the bridge, with its reason (E04's fix round 10); every other refusal of a
    // handover is the giver's whisper, as it was.
    const out = ctx.action === ACTION_SHARE_BULLET ? await shareBullet(args) : await giveItem(args);
    if (out?.refused) return { refused: out.refused };
}

    // And into them. Same guards as the theft, mirrored - the sender has to own
    // the character whose pocket the item is leaving.
async function handlePlant(payload, sender, ctx) {
    const { plantOnPerson } = await import("./vault.mjs");
    await plantOnPerson({
        plannerId: payload.plannerId,
        victimId: payload.victimId,
        itemId: payload.itemId,
        total: payload.total,
        isCritical: payload.isCritical,
        unseenTotal: payload.unseenTotal,
        unseenCritical: payload.unseenCritical
    });
}

    // Looking for a hiding place. The finder owns their own sheet and could
    // write the flag themselves - which is exactly why they do not: that write
    // is the whole distance between beating a 16 and reading other people's
    // stashes, so it happens where the threshold is checked.
async function handleFindStash(payload, sender, ctx) {
    const { resolveStashSearch } = await import("./vault.mjs");
    await resolveStashSearch({
        actorId: payload.actorId,
        total: payload.total,
        isCritical: payload.isCritical
    });
}

    // And out of their pockets. Same reasoning as the stash below, plus one
    // more: the thief's client is the one that would benefit from getting the
    // arithmetic wrong, so it does none of it.
async function handleSteal(payload, sender, ctx) {
    const { stealFromPerson } = await import("./vault.mjs");
    await stealFromPerson({
        thiefId: payload.thiefId,
        victimId: payload.victimId,
        itemId: payload.itemId,
        total: payload.total,
        isCritical: payload.isCritical,
        unseenTotal: payload.unseenTotal,
        unseenCritical: payload.unseenCritical
    });
}

    // Taking something out of somebody else's stash writes to two sheets, one of
    // which the thief has no business writing to.
async function handleVaultSteal(payload, sender, ctx) {
    const { stealFromVault } = await import("./vault.mjs");
    await stealFromVault({
        thiefId: payload.thiefId, ownerId: payload.ownerId, itemId: payload.itemId,
        // Set only by the Search action, which pays for the concealment it is
        // beating. See the note in `stealFromVault`.
        viaSearch: payload.viaSearch,
        // Trusted from the sender, and it is worth saying why when nothing
        // else in this handler is. A client that lied would only ever lie
        // one way - claiming a steady hand - and the cost of believing it is
        // that the victim is not told. That is exactly the state this branch
        // shipped in for four updates, so a forged `false` buys a cheat
        // nothing it did not already have, while re-rolling the dice here to
        // check would be a second roll for one action.
        clumsy: payload.clumsy
    });
}

    // Stage 4 thrown on the participant's own client. Same guard as a crisis
    // action: the sender has to own the character the roll is about, or one
    // player could open somebody else's murder for them.
async function handleOpeningResult(payload, sender, ctx) {
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
async function handleCrisis(payload, sender, ctx, prepared) {
    const { resolveCrisisAction, freeResolutionFor, sideOf } = prepared;
    const actor = game.actors.get(payload.actorId);
    const result = await resolveCrisisAction({
        actorId: payload.actorId,
        key: payload.key,
        total: payload.total,
        isCritical: payload.isCritical,
        withHope: payload.withHope,
        // A Reroll replacing this actor's own last crisis action. The GM
        // side checks the receipt belongs to them before unwinding anything.
        undo: payload.undo,
        // Narrowed rather than trusted, by the whitelist: the only two answers
        // this can carry are the two resources a critical Strike may take.
        choice: payload.choice,
        // An id, and one the sender's own character actually holds. It only
        // ever becomes a receipt line, but a receipt naming somebody else's
        // item would give a Reroll the run of another sheet.
        usedItemId: actor?.items?.has(payload.usedItemId) ? payload.usedItemId : null,
        // Same test: the swing memo names an item, and only one the sender holds.
        swungId: actor?.items?.has(payload.swungId) ? payload.swungId : null,
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
async function handleParkMurder(payload, sender, ctx) {
    const eclipse = await import("./eclipse.mjs");
    await eclipse.writeParkedMurder({
        killerId: payload.killerId,
        room: payload.room,
        note: payload.note
    });
}

    // The newcomer turns on the person they just helped. Opening a murder is a
    // world write and a second death, so the request travels and the decision
    // is re-derived from the incident on this side - `betrayAsPlayer` refuses
    // anyone the state does not put in that position.
async function handleBetrayal(payload, sender, ctx) {
    const murder = await import("./murder.mjs");
    await murder.betrayAsPlayer(payload.actorId);
}

    // Stage 6. Deleting a Remnant token, placing the new one a botched wipe
    // leaves, and reading how visible the trace was in the first place are all
    // GM-only - the last of those most of all, since it is the threshold the
    // roll is being measured against. See cleanup.mjs. cleanup.mjs is imported
    // in the declaration's `prepare`, before the receipt guard, as it was here.
async function handleCleanup(payload, sender, ctx, prepared) {
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
            grant: payload.grant
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
        viaAction: payload.viaAction
    });
    if (!cleaned) return { refused: "nothing was carried out: resolveCleanup cleaned nothing" };
}

    // A Meddle writes to the TARGET's sheet, not the Monocub's own - arming a
    // Call is exactly the write a player has no permission to make on somebody
    // else's actor.
async function handleMeddle(payload, sender, ctx) {
    const { resolveMeddle } = await import("./monocub.mjs");
    await resolveMeddle({
        actorId: payload.actorId,
        targetId: payload.targetId,
        help: payload.help,
        total: payload.total,
        isCritical: payload.isCritical
    });
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
async function handleHopeCall(payload, sender, ctx) {
    return askHopeCallByCard(payload, ctx);
}

async function handleDifficulty(payload, sender, ctx) {
    return askDynamicByCard(payload, ctx);
}

async function handleProgress(payload, sender, ctx) {
    const { asker } = ctx;
    // Sight of the project and the size of the step are the declaration's
    // guards now; progress taken back is a Reroll's - see `guardProgressOwner`.
    const amount = Math.trunc(payload.amount);
    const { addProgress } = await import("./projects.mjs");
    // Who asked, so a finished project can fall back to them when nobody
    // recorded who proposed it.
    const result = await addProgress(payload.countdownId, amount, { by: asker });
    debug(`Applied ${amount} progress to ${payload.countdownId} on behalf of a player.`, result);
    // Null: the project is not there any more - nothing was added, and the asker
    // is told so once, by the refusal (E31 review). A project that did not move
    // (frozen, already full) is an answer, whispered below.
    if (!result) return { refused: "nothing was carried out: addProgress found no such project" };

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

async function handleShare(payload, sender, ctx, prepared) {
    // projects.mjs came in the declaration's `prepare`, before the guards, as it
    // was imported here: sight asked again with nothing awaited before the write.
    // The guards import, and a project resealed in between must not be shared out.
    const { canSee, shareWith } = prepared;
    if (!canSee(payload.countdownId, sender)) return { refused: "sender cannot see that project" };

    // Null: the project is not secret any more, and nothing was shared (E31 review).
    if (!await shareWith(payload.countdownId, payload.targetUserId)) {
        return { refused: "nothing was carried out: shareWith shared nothing" };
    }
    debug(`Shared project ${payload.countdownId} with ${payload.targetUserId} on behalf of a player.`);
}

async function handleRemnant(payload, sender, ctx) {
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
    }
    // A trace this client could not place (no scene, no Remnant actor, a token
    // that could not be created) is a failure, not "placed" (E31 review): the
    // player's item stays on the sheet.
    if (!await placeRemnant(data)) return { refused: "the trace could not be placed" };
    debug("Placed a Remnant on behalf of a player.");
}

async function handleTieTrace(payload, sender, ctx) {
    // Only the one holding the object, and only in the fight - see `guardTieTraceHolder`.
    const { tieTraceForItem } = await import("./remnants.mjs");
    await tieTraceForItem(payload.identity);
}

async function handleRemnantEdit(payload, sender, ctx) {
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
    // The type is a GM's to change, never a player's: the one honest player
    // sender (reroll.mjs) sends a band and nothing else, and a trace's type
    // decides who may tamper with it and how hard it is to Observe (E03 second
    // review). The killer's own re-typing goes through cleanup.mjs on the GM.
    if (sender.isGM && CLEANUP.transform?.types?.includes(asked.type)) narrowed.type = asked.type;

    const { retuneRemnant } = await import("./remnants.mjs");
    // Null: no such token, a reinforced trace asked to go, or nothing to change -
    // nothing was done (E31 review), and it is told with the declaration's `tell`.
    if (!await retuneRemnant(payload.sceneId, payload.tokenId, narrowed)) {
        return { refused: "nothing was carried out: retuneRemnant changed nothing" };
    }
    debug("Retuned a Remnant on behalf of a player.", narrowed);
}

async function handleSabotage(payload, sender, ctx) {
    const { sabotageProject } = await import("./projects.mjs");
    // Who asked, so that only their own Reroll can take it back (E03).
    const result = await sabotageProject(payload.targetId, Math.trunc(payload.difficulty),
        { saboteur: sender.isGM ? null : sender.id });

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

async function handleUnsabotage(payload, sender, ctx) {
    // The pair, the character and the Reroll - see `guardUnsabotagePair`.
    const { undoSabotage } = await import("./projects.mjs");
    // Null: `unsabotageRefusal` kept it to the GM's console - nothing was undone (E31 review).
    if (!await undoSabotage(payload.targetId, payload.repairId, { senderId: sender.isGM ? null : sender.id })) {
        return { refused: "nothing was carried out: undoSabotage undid nothing" };
    }
}

async function handleSendback(payload, sender, ctx, prepared) {
    // `REVERT` came in the declaration's `prepare`, before the guard, so the
    // guard's judgement and the write below have nothing but microtasks between
    // them. Back, and only back - see `guardSendbackPlace`.
    const token = game.scenes.get(payload.sceneId)?.tokens?.get(payload.tokenId);
    // Read out by name (E03): x and y, and elevation and level only when asked.
    const asked = payload.position ?? {};
    const to = { x: Number(asked.x), y: Number(asked.y) };
    if (asked.elevation !== undefined) to.elevation = Number(asked.elevation);
    if (asked.level !== undefined) to.level = asked.level;
    await token.update(to, { animate: false, [prepared.REVERT]: true });
}

async function handleLoot(payload, sender, ctx) {
    const { lootBody } = await import("./handover.mjs");
    // Everything else it needs to refuse - the body being alive, the item
    // being a Truth Bullet - `lootBody` checks itself, because the GM's own
    // button goes through the same door. It answers null when it took nothing,
    // with its reason on the GM's console; the asker is told only that nothing
    // was carried out, whichever reason it was (E31 review).
    const taken = await lootBody({
        takerId: payload.takerId, bodyId: payload.bodyId, itemId: payload.itemId
    });
    if (!taken) return { refused: "nothing was carried out: lootBody took nothing" };
}

async function handleArm(payload, sender, ctx, prepared) {
    // What a player may arm on somebody else, and who pays - see `guardArmPlayerCall`.
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

    // Appended, not written over: Calls stack (CALL-02).
    await appendArmedCall(actor, armedEntry(payload.call, call, kind));
    debug(`Armed ${payload.call.key} on ${actor.name} on behalf of ${sender.name}.`);
    void tellBeneficiary(actor, kind, call.grants);
    return { reply: { ok: true, left: null } };
}

/** The armed entry as this side builds it: the table's `grants`, never the packet's extras. */
function armedEntry(asked, call, kind) {
    return {
        key: asked.key, kind, grants: call.grants,
        amount: null, from: asked.from ?? null,
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
            game.i18n.format(kind === "despair" ? "DRPG.Calls.armedByMonokuma" : "DRPG.Calls.armedForYou", {
                what: game.i18n.localize(`DRPG.Calls.grants.${grants}`)
            })
        }</p>`);
    } catch (err) {
        error(`Could not tell ${actor?.name ?? "the beneficiary"} about the Call armed for them`, err);
    }
}

/**
 * A player's Support on somebody else's character: checked, charged and armed on
 * this side, in that order, and refunded if the arming itself fails. Asks its own
 * guards (the declaration's `runGuards`): the player's road has checks the GM's
 * does not, and the replayed purchase below answers "armed" between them.
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
    const { appendArmedCall, pendingCalls, hopeHeld, automatedUpdate, HOPE_REFUND } = prepared;
    const nonce = String(payload.call.nonce ?? "").slice(0, 32);
    if (nonce && pendingCalls(actor).some(entry => entry.nonce === nonce)) return { reply: { ok: true, left: null } };

    // `hopeHeld` came before the guards (`prepare`), so the Hope read below follows
    // the guard's own read with nothing awaited in between but the guards themselves.
    const why = await firstRefusal(sender, payload, ctx, guardArmHopeCallAllowed, guardArmNotHeld, guardArmBuyerHope);
    if (why) return { refused: why };
    const held = hopeHeld(buyer);

    await automatedUpdate(buyer, { "system.resources.hope.value": held - call.cost });
    try {
        await appendArmedCall(actor, armedEntry(payload.call, call, "hope"));
    } catch (err) {
        error(`Could not arm ${payload.call.key} on ${actor.name}; the Hope goes back`, err);
        const now = hopeHeld(buyer);
        await automatedUpdate(buyer, { "system.resources.hope.value": now + call.cost }, { [HOPE_REFUND]: true });
        return { refused: "the Call could not be armed" };
    }
    debug(`Armed ${payload.call.key} on ${actor.name}, paid by ${buyer.name} on this side.`);
    void tellBeneficiary(actor, "hope", call.grants);
    return { reply: { ok: true, left: held - call.cost } };
}

async function handleDespair(payload, sender, ctx) {
    // A player's point is a Reroll's, on their own Monokuma - see `guardDespairOwner`.
    // The size and the pool are asked BEFORE the receipt is spent (the review of
    // the guard split; the declaration's order): a packet that fails them must
    // not use up the Reroll.
    const delta = Math.trunc(payload.delta);
    const target = game.users.get(payload.targetUserId);
    const { adjustDespair } = await import("./despair.mjs");
    await adjustDespair(target.id, delta);
    debug(`Adjusted Despair for ${target.name} by ${delta} on behalf of ${sender.name}.`);
}

    // An Eclipse crossing. Counted on this side, where the allowance is judged since E05
    // (a crossing beyond it is refused, and counts nothing); the answer is the new count,
    // which the mover's sheet reads before its copy arrives.
async function handleEclipseMove(payload, sender, ctx) {
    const { applyRecordedMove } = await import("./eclipse.mjs");
    const out = await applyRecordedMove(payload.actorId);
    if (!out) return { refused: "nothing was carried out: no Eclipse is running, or no such character" };
    if (out.refused) return { refused: out.refused };
    return { reply: { used: out.used, left: out.left } };
}

/**
 * WHAT THE PRIMARY GM ANSWERS, ONE DECLARATION PER REQUEST (E31, 25.09.2026;
 * audit S17-08).
 *
 * Each declaration names the guards its request is judged by, in the order
 * they are asked - `knownSender` (or `gmOnly`) first; for every id the run
 * receives, a guard that names it or a `claims` line saying who judges it; a
 * guard that spends a Reroll receipt last - the fields the run may read
 * (`sanitize`), the run, and how the asker is answered: `reply` once the run
 * has carried it out, with its answer - every request whose asker says or
 * counts on it that it was done (E31 review), and every queued one; `ack` once
 * the guards have passed, for a request whose asker says only that the GM's
 * client has it, or nothing; `none` for a request nobody waits on (quiet: its
 * refusals are logged, not told). `prepare` holds what a handler did before its
 * guards and must still do before them: an import that must not come between
 * the last check and the write, a reading the write must share. `queue` keeps
 * the project writes in the order they arrived, and is acknowledged as each
 * arrives.
 * `judge` (bridge-guards.mjs) carries every one of them out; R1b reads this
 * table, R163 the fields each run reads, and 33-bridge-paths drives the legal
 * roads through it.
 *
 *
 * `project.create` USED TO BE IN THE TABLE, and it is gone rather than mended.
 * Nothing sent it: a project is created by the GM, from the panel or from an
 * Approve button on a proposal card, and a player's proposal reaches them as a
 * card rather than as a write. So the branch was a GM-side handler with no
 * caller - and it still accepted a `project.create` payload from any connected
 * client, checked only that the sender was somebody, and created the project.
 * Including one flagged `indirectMurder`. A door nobody used and anybody could
 * open.
 */
export const BRIDGE_ACTIONS = table({
    [ACTION_OBSERVE_TARGET]: {
        label: "DRPG.Bridge.what.observe.target",
        guards: [knownSender, owns("actorId", "sender does not own that character")],
        sanitize: pick({ actorId: as.id, declaration: as.raw, request: as.text }),
        run: handleObserveTarget,
        answer: "reply", patient: true, resend: true,
        claims: { declaration: "compared to DECLARATIONS by chooseObserveTarget (observe.mjs); an unknown one is answered with a reason, never used" }
    },
    [ACTION_CLEANUP_TRACES]: {
        label: "DRPG.Bridge.what.cleanup.traces",
        guards: [knownSender, owns("actorId", "sender does not own that character")],
        sanitize: pick({ actorId: as.id, mine: as.bool }),
        run: handleCleanupTraces,
        answer: "reply", resend: true
    },
    [ACTION_OBSERVE_RESOLVE]: {
        label: "DRPG.Bridge.what.observe.resolve",
        guards: [knownSender, owns("actorId", "sender does not own that character"), guardObserveReceipt],
        sanitize: pick({ actorId: as.id, key: as.text, total: as.num, isCritical: as.bool, undo: as.bool }),
        run: handleObserveResolve,
        // The "got it" only: the run can wait on the GM describing what was found
        // (`describeFind`, observe.mjs), and what its asker says on the answer is
        // that the GM has it - "The GM is judging what you found", and a Reroll's
        // "goes back to the GM" (E31 review).
        answer: "ack"
    },
    [ACTION_ANALYZE_RESOLVE]: {
        label: "DRPG.Bridge.what.analyze.resolve",
        guards: [knownSender, owns("actorId", "sender does not own that character"), guardAnalyzeReceipt],
        sanitize: pick({ actorId: as.id, itemId: as.id, total: as.num, isCritical: as.bool, undo: as.bool }),
        run: handleAnalyzeResolve,
        answer: "reply",
        claims: { itemId: "looked up on that one character by resolveAnalyze (analyze.mjs), never across the world" }
    },
    [ACTION_ADVANCEMENT]: {
        label: "DRPG.Bridge.what.advancement.apply",
        guards: [knownSender, owns("actorId", "sender does not own that character")],
        sanitize: pick({ actorId: as.id, picks: as.raw }),
        run: handleAdvancement,
        answer: "ack",
        claims: { picks: "checked in the run against the offer standing on this side: as many as its kind buys, each a Level Up option, a new experience named" }
    },
    [ACTION_ADVANCEMENT_OFFER]: {
        label: "DRPG.Bridge.what.advancement.offer",
        // A GM owns every character, so `owns` refuses nothing a real GM sends; it
        // stays because every declaration that acts on `actorId` answers the same
        // two questions, and a rule with an exception is two rules.
        guards: [gmOnly("only a GM hands out a Level Up"), owns("actorId", "sender does not own that character")],
        sanitize: pick({ actorId: as.id, kind: as.maybeText }),
        run: handleAdvancementOffer,
        answer: "reply"
    },
    [ACTION_ADVANCEMENT_ASK]: {
        label: "DRPG.Bridge.what.advancement.ask",
        guards: [knownSender, playersOnly("a GM asks for nothing here")],
        sanitize: pick({}),
        run: handleAdvancementAsk,
        answer: "none", quiet: true,
        why: "answers only about the sender's own characters, found from the id Foundry gives, and names none"
    },
    [ACTION_SHARE_BULLET]: handover("DRPG.Bridge.what.handover.bullet"),
    [ACTION_GIVE_ITEM]: handover("DRPG.Bridge.what.handover.item"),
    [ACTION_PLANT]: {
        label: "DRPG.Bridge.what.action.plant",
        guards: [knownSender, owns("plannerId", "sender does not own the character planting")],
        sanitize: pick({ plannerId: as.id, victimId: as.id, itemId: as.id, total: as.num, isCritical: as.bool,
            unseenTotal: as.num, unseenCritical: as.bool }),
        run: handlePlant,
        answer: "ack",
        claims: {
            victimId: "judged by plantOnPerson (vault.mjs): a living victim in the planter's room",
            itemId: "judged by plantOnPerson (vault.mjs): an item in the planter's own hands"
        }
    },
    [ACTION_FIND_STASH]: {
        label: "DRPG.Bridge.what.vault.findStash",
        guards: [knownSender, owns("actorId", "sender does not own that character")],
        sanitize: pick({ actorId: as.id, total: as.num, isCritical: as.bool }),
        run: handleFindStash,
        answer: "ack"
    },
    [ACTION_STEAL]: {
        label: "DRPG.Bridge.what.action.steal",
        guards: [knownSender, owns("thiefId", "sender does not own the character stealing")],
        sanitize: pick({ thiefId: as.id, victimId: as.id, itemId: as.id, total: as.num, isCritical: as.bool,
            unseenTotal: as.num, unseenCritical: as.bool }),
        run: handleSteal,
        answer: "ack",
        claims: {
            victimId: "judged by stealFromPerson (vault.mjs): a living victim in the thief's room",
            itemId: "honoured by stealFromPerson (vault.mjs) only on a critical, and only if it is in the victim's pockets"
        }
    },
    [ACTION_VAULT_STEAL]: {
        label: "DRPG.Bridge.what.vault.steal",
        guards: [knownSender, owns("thiefId", "sender does not own the character searching")],
        sanitize: pick({ thiefId: as.id, ownerId: as.id, itemId: as.id, viaSearch: as.bool, clumsy: as.bool }),
        run: handleVaultSteal,
        answer: "ack",
        claims: {
            ownerId: "judged by stealFromVault (vault.mjs): the owner of a stash the thief can reach",
            itemId: "judged by stealFromVault (vault.mjs): an item that owner has stashed"
        }
    },
    [ACTION_OPENING_RESULT]: {
        label: "DRPG.Bridge.what.murder.openingResult",
        guards: [knownSender, owns("actorId", "sender does not own that character")],
        sanitize: pick({ actorId: as.id, side: as.raw, total: as.num, isCritical: as.bool, withHope: as.bool }),
        run: handleOpeningResult,
        answer: "ack",
        claims: { side: "compared by resolveOpening (murder.mjs) with the side the incident's own state gives that character" }
    },
    [ACTION_CRISIS]: {
        label: "DRPG.Bridge.what.murder.crisis",
        guards: [knownSender, owns("actorId", "sender does not own that character"),
            guardCrisisAction, guardCrisisUndo, guardCrisisReceipt],
        // murder.mjs before the guards, as the handler imported it (the plan's W2).
        prepare: () => import("./murder.mjs"),
        sanitize: pick({ actorId: as.id, key: as.text, total: as.num, isCritical: as.bool, withHope: as.bool, undo: as.bool,
            choice: as.oneOf("stress", "hp"), usedItemId: as.id, swungId: as.id, free: as.bool }),
        run: handleCrisis,
        // Answered once applied, which can wait on the GM: two killers' victim
        // running out is asked of them (`checkVictimSpent`, murder.mjs).
        answer: "reply",
        claims: {
            usedItemId: "narrowed in the run to an item the acting character holds, else null",
            swungId: "narrowed in the run to an item the acting character holds, else null"
        }
    },
    [ACTION_PARK_MURDER]: {
        label: "DRPG.Bridge.what.murder.park",
        guards: [knownSender, owns("killerId", "sender does not own that character")],
        sanitize: pick({ killerId: as.id, room: as.maybeText, note: as.text }),
        run: handleParkMurder,
        answer: "reply"
    },
    [ACTION_BETRAYAL]: {
        label: "DRPG.Bridge.what.murder.betrayal",
        guards: [knownSender, owns("actorId", "sender does not own that character")],
        sanitize: pick({ actorId: as.id }),
        run: handleBetrayal,
        answer: "ack"
    },
    [ACTION_CLEANUP]: {
        label: "DRPG.Bridge.what.murder.cleanup",
        guards: [knownSender, owns("actorId", "sender does not own that character"), guardCleanupReceipt],
        // cleanup.mjs before the receipt guard, as the handler imported it.
        prepare: () => import("./cleanup.mjs"),
        sanitize: pick({ actorId: as.id, tokenId: as.id, key: as.text, targetId: as.id, total: as.num, isCritical: as.bool,
            withHope: as.bool, viaAction: as.bool, undo: as.bool, grant: as.bool, price: as.raw, transform: as.raw, change: as.raw }),
        run: handleCleanup,
        answer: "reply",
        claims: {
            tokenId: "resolveCleanup (cleanup.mjs) finds the trace in the cleaner's room and judges it, or refuses",
            targetId: "resolveStageSix (cleanup.mjs) judges who may be framed and where the body lies",
            price: "bounded on arrival against PRICE_CHAINS by the resolvers (T-1)",
            transform: "bounded on arrival against CLEANUP.transform by resolveCleanup (G-20)",
            change: "bounded on arrival against CLEANUP.transform by resolveCleanup (Z5)"
        }
    },
    [ACTION_MEDDLE]: {
        label: "DRPG.Bridge.what.monocub.meddle",
        guards: [knownSender, owns("actorId", "sender does not own that Monocub")],
        sanitize: pick({ actorId: as.id, targetId: as.id, help: as.bool, total: as.num, isCritical: as.bool }),
        run: handleMeddle,
        answer: "ack",
        claims: { targetId: "judged by resolveMeddle (monocub.mjs): a living student in the Monocub's room" }
    },
    [ACTION_HOPE_CALL]: {
        label: "DRPG.Bridge.what.call.approve",
        guards: [knownSender, owns("actorId", "sender does not own that character")],
        // `cost` and `actorName` are sent and never read: the price comes from HOPE_CALLS
        // here, the name from the character (E02; E31).
        sanitize: pick({ actorId: as.id, key: as.text, callLabel: as.text, effect: as.text, note: as.text }),
        run: handleHopeCall,
        answer: "reply", patient: true, resend: true, timeoutMs: TIMING.hopeCallRulingMs
    },
    [ACTION_DIFFICULTY]: {
        label: "DRPG.Bridge.what.dynamic.difficulty",
        guards: [knownSender, owns("actorId", "sender does not own that character")],
        sanitize: pick({ actorId: as.id, description: as.text, actorName: as.text, room: as.maybeText }),
        run: handleDifficulty,
        answer: "reply", patient: true, resend: true
    },
    [ACTION_PROGRESS]: {
        label: "DRPG.Bridge.what.project.progress",
        guards: [
            knownSender,
            /*
             * ONLY A PROJECT THE SENDER MAY KNOW ABOUT (E01, 24.09.2026; audit S14-03).
             * This checked that the sender exists and nothing else, so a player who had
             * learnt the id of a secret project - from an old packet, from a macro - could
             * push its bar from outside it, and the finished project would then credit
             * whoever the packet's own `userId` named. `canSee` is the secrecy gate the
             * share and sabotage handlers already use; every road a player's own client
             * sends progress down (an action, a Call, a Reroll) picks the project from
             * what that player can see, so nothing honest is refused. The credit goes to
             * the sender Foundry names, never to the payload's claim.
             */
            canSeeProject("countdownId", "sender may not see that project"),
            // Progress comes from an action or a Call, so it is small by definition.
            // A payload asking for +999 is not the rules asking.
            inRange("amount", n => Number.isFinite(n) && n !== 0 && Math.abs(n) <= STARTING.despairMax,
                sent => `amount ${sent} is out of range`),
            guardProgressOwner, guardProgressReceipt
        ],
        sanitize: pick({ countdownId: as.id, amount: as.num }),
        run: handleProgress,
        answer: "reply", queue: "project"
    },
    [ACTION_SHARE]: {
        label: "DRPG.Bridge.what.project.share",
        guards: [
            knownSender,
            // You may only share what you can already see.
            //
            // This used to check that the sender was a real user and nothing else,
            // so "share this project with me" was a single socket emit - aimed at
            // any project in the world, including somebody else's SECRET one. A
            // secret project is a murder plan; `resealSecretProjects` exists to keep
            // players out of exactly these, and this handler let a player back in
            // through the front door.
            canSeeProject("countdownId", "sender cannot see that project"),
            guardShareSecret, guardShareGuest
        ],
        // projects.mjs before the guards, as the handler imported it: the run asks
        // `canSee` again with nothing awaited between that and the write.
        prepare: () => import("./projects.mjs"),
        sanitize: pick({ countdownId: as.id, targetUserId: as.id }),
        run: handleShare,
        answer: "reply",
        claims: { targetUserId: guardShareGuest }
    },
    [ACTION_REMNANT]: {
        label: "DRPG.Bridge.what.remnant.place",
        guards: [knownSender, ownsActorAt(payload => payload?.data?.sourceActor, "sender does not own the character leaving it", ["data"])],
        sanitize: pick({ data: as.raw }),
        run: handleRemnant,
        // Answered once placed (E31), and as failed when it could not be (E31 review):
        // the item a planted trace stands for leaves the sheet only when it was.
        answer: "reply",
        claims: { data: "a player's is rebuilt from a whitelist by narrowPlayerRemnant (remnants.mjs); a GM's is placed as written" }
    },
    [ACTION_TIE_TRACE]: {
        label: "DRPG.Bridge.what.remnant.tieForItem",
        guards: [knownSender, guardTieTraceHolder],
        sanitize: pick({ identity: as.id }),
        run: handleTieTrace,
        answer: "ack",
        claims: { identity: guardTieTraceHolder }
    },
    [ACTION_REMNANT_EDIT]: {
        label: "DRPG.Bridge.what.remnant.edit",
        guards: [
            knownSender,
            // Only the character who left it may re-rate it, which is what a reroll
            // of their own action is. Anyone else editing evidence is the one thing
            // an investigation cannot survive. From the ledger, which this GM holds
            // (`remnantSourceOf`) - the token has carried no `sourceActor` flag since
            // the answer key moved off it (CASE-09). A refusal is asked again after
            // the receipt's retry, as the receipt's own is.
            ownsActorAt(remnantSourceOf, "sender did not leave that Remnant", ["sceneId", "tokenId"],
                { retryMs: TIMING.rerollReceiptRetryMs }),
            guardRemnantEditReceipt
        ],
        sanitize: pick({ sceneId: as.id, tokenId: as.id, patch: as.raw }),
        run: handleRemnantEdit,
        answer: "reply",
        // Every refusal - by these guards or by the run - is told to the asker as this
        // one code; the GM's log keeps each one's own reason (E31 review).
        tell: "traceOutOfReach",
        claims: { patch: "narrowed in the run: remove as a flag, a visibility from REMNANT_VISIBILITY_LABELS, a type from a GM only" }
    },
    [ACTION_SABOTAGE]: {
        label: "DRPG.Bridge.what.project.sabotage",
        guards: [
            knownSender,
            // Freezing somebody's work is aimed at a project you found, not at an
            // id. Seeing it is the condition the picker is built from
            // (`sabotageTargetsIn` lists what this user can see), and it was the one
            // thing this side never asked - so any project in the world could be
            // frozen from a console, including a secret one whose existence the
            // sender had no way to learn honestly.
            canSeeProject("targetId", "sender cannot see that project"),
            // `difficulty` becomes the repair project's progress target, so it is
            // how much work the freeze costs its owner to undo. It arrived unread: a
            // payload asking for a target of 9999 froze a project for the rest of
            // the season. The ceiling is the hardest scale the rules define, read
            // from the table rather than written out here.
            inRange("difficulty", n => Number.isFinite(n) && n >= 1 && n <= hardestRepair(),
                sent => `difficulty ${sent} is out of range (1-${hardestRepair()})`)
        ],
        sanitize: pick({ targetId: as.id, difficulty: as.num }),
        run: handleSabotage,
        answer: "reply", resend: true, queue: "project"
    },
    [ACTION_UNSABOTAGE]: {
        label: "DRPG.Bridge.what.project.unsabotage",
        guards: [
            knownSender,
            // Same rule as freezing it. Thawing is the completion of a repair
            // project, so the sender has to be able to see what they are thawing.
            canSeeProject("targetId", "sender cannot see that project"),
            guardUnsabotagePair, guardUnsabotageOwner, guardUnsabotageReceipt
        ],
        sanitize: pick({ targetId: as.id, repairId: as.id }),
        run: handleUnsabotage,
        answer: "reply", queue: "project",
        claims: { repairId: guardUnsabotagePair }
    },
    [ACTION_SENDBACK]: {
        label: "DRPG.Bridge.what.token.sendBack",
        // `knownSender` is new here (E31): a sender Foundry does not know used to be
        // refused as "sender does not own that token", which was true but not why.
        guards: [knownSender, ownsActorAt(tokenActorOf, "sender does not own that token", ["sceneId", "tokenId"]), guardSendbackPlace],
        // `REVERT` before the guard, as the handler imported it: the guard's
        // judgement and the write have nothing but microtasks between them.
        prepare: () => import("./movement.mjs"),
        sanitize: pick({ sceneId: as.id, tokenId: as.id, position: as.raw }),
        run: handleSendback,
        answer: "ack",
        claims: { position: guardSendbackPlace }
    },
    [ACTION_LOOT]: {
        label: "DRPG.Bridge.what.body.loot",
        // You may fill your own pockets and nobody else's. Without this, "move
        // that knife onto whoever I like" was a single socket emit away.
        guards: [knownSender, owns("takerId", "sender does not own the character doing the taking")],
        sanitize: pick({ takerId: as.id, bodyId: as.id, itemId: as.id }),
        run: handleLoot,
        answer: "reply",
        // Where the taker stands is not asked (the E31 design's map of the GM side,
        // row 30) - written down here, not added: E31 adds no check.
        claims: {
            bodyId: "lootBody (handover.mjs) takes only from a body that is dead, and refuses otherwise",
            itemId: "lootBody (handover.mjs) takes only an item on that body that is not a Truth Bullet"
        }
    },
    [ACTION_ARM]: {
        label: "DRPG.Bridge.what.call.arm",
        guards: [
            // Refused out loud, and before the sender is, as the handler asked it.
            guardArmCharacter,
            knownSender,
            // The BUYER has to be the sender's own character - never the
            // beneficiary, who is somebody else's by definition for Support and For
            // the Game. Every other handler here checked ownership and this one did
            // not, so "arm me a Free Critical" was a single socket emit away, paid
            // for with nothing.
            owns(armBuyerId, "sender does not own the character paying for it"),
            guardArmPlayerCall, guardArmCallGrants
        ],
        // The player's road asks these itself, around a replayed purchase that is
        // answered rather than refused (`armPaidByPlayer`).
        runGuards: [guardArmBuyer, guardArmOtherCharacter, guardArmHopeCallAllowed, guardArmNotHeld, guardArmBuyerHope],
        // The beneficiary read once, and every import the two roads make, before
        // the guards - never later than the handler made them.
        prepare: async payload => {
            const effects = await import("./call-effects.mjs");
            const calls = await import("./calls.mjs");
            const guard = await import("./resource-guard.mjs");
            return {
                actor: game.actors.get(payload?.actorId ?? ""),
                appendArmedCall: effects.appendArmedCall, pendingCalls: effects.pendingCalls,
                hopeHeld: calls.hopeHeld, automatedUpdate: guard.automatedUpdate, HOPE_REFUND: guard.HOPE_REFUND
            };
        },
        sanitize: pick({ actorId: as.id, call: as.raw }),
        run: handleArm,
        answer: "reply", resend: true,
        claims: { actorId: guardArmCharacter, call: guardArmPlayerCall }
    },
    [ACTION_DESPAIR]: {
        label: "DRPG.Bridge.what.despair.adjust",
        guards: [knownSender, guardDespairOwner, guardDespairMonokuma, guardDespairDelta, guardDespairPool, guardDespairReceipt],
        sanitize: pick({ targetUserId: as.id, delta: as.num }),
        run: handleDespair,
        answer: "reply",
        claims: { targetUserId: guardDespairPool }
    },
    [ACTION_ECLIPSE_MOVE]: {
        label: "DRPG.Bridge.what.eclipse.move",
        // `knownSender` is new here (E31), as for token.sendBack.
        guards: [knownSender, owns("actorId", "sender does not own that character")],
        sanitize: pick({ actorId: as.id }),
        run: handleEclipseMove,
        answer: "reply"
    }
});

/** The two handovers: one declaration, told apart by the runner's `ctx.action`. */
function handover(label) {
    return {
        label,
        guards: [knownSender, owns("fromId", "sender does not own the character giving it away")],
        sanitize: pick({ fromId: as.id, toId: as.id, itemId: as.id }),
        run: handleShareBulletOrGiveItem,
        answer: "ack",
        claims: {
            toId: "handover's verify (handover.mjs): a living recipient, not the giver, in the giver's room",
            itemId: "handover's verify (handover.mjs): an item of the giver's, not an Eclipse"
        }
    };
}

/** The largest repair a sabotage can demand: the hardest scale the rules define. */
function hardestRepair() {
    return Math.max(...Object.values(PROJECT_SCALE).map(s => s.progress));
}

/**
 * The primary GM's one listener for what a player asks (E31). The primary gate
 * is here, not in `judge`, so the suite can drive the runner on any client
 * (R162); whatever is not a key of the table - another file's packet, a reply
 * travelling back to a player - is not judged and not acknowledged. A packet in
 * flight while this client is still loading or already closing finds no
 * `game.user` and is left alone, as the listener before the table left it.
 */
function onSocket(payload, senderId) {
    return isPrimaryGm() && game.user ? judge(BRIDGE_ACTIONS, payload, senderId) : null;
}

/* ==========================================================================
 * ASKING THE GM (E31, 25.09.2026; audit S17-09)
 * --------------------------------------------------------------------------
 * Every request below goes through `ask`, which reads how to wait off the
 * action's declaration in BRIDGE_ACTIONS - its `answer`, whether it is
 * `patient`, whether it is asked again when a GM's world has loaded, how long
 * its clock runs - and hands it to `bridgeRequest` (bridge-guards.mjs), the one
 * wait. Each answers the bridge's result, `{ ok, pending?, value?, refused?,
 * reason? }`, which is truthy whatever it says: so it is read in the function
 * that asked for it, and does not leave it (the lint rule drpg/bridge-result,
 * eslint.config.mjs). A failure has been told to the player once, in their
 * language, by the time the result arrives; a caller says only what follows
 * from it. A GM does the work on its own client (`local`), as each request
 * did, and a request with no GM connected is refused before anything is sent.
 * ========================================================================== */

/** Ask for `action` as its declaration says; `opts` adds what only the caller knows (local, quiet, nothingSpent, a clock). */
function ask(action, payload, opts = {}) {
    const decl = BRIDGE_ACTIONS[action];
    return bridgeRequest(action, payload, {
        settle: decl.answer, patient: Boolean(decl.patient), resend: Boolean(decl.resend), quiet: Boolean(decl.quiet),
        ...(decl.timeoutMs ? { timeoutMs: decl.timeoutMs } : {}),
        ...opts
    });
}

/**
 * Take something off a body.
 *
 * Everything the taking does needs the GM: the Truth Bullet's answer key exists
 * only on their browser (`createTruthBullet` refuses elsewhere), placing a token
 * needs their permission, and the item has to leave a sheet the player does not
 * own. ONE request rather than three, because three would have intermediate
 * states in which the knife has left the body and arrived nowhere.
 */
export function requestBodyLoot({ takerId, bodyId, itemId }) {
    return ask(ACTION_LOOT, { takerId, bodyId, itemId }, {
        local: () => import("./handover.mjs").then(m => m.lootBody({ takerId, bodyId, itemId }))
    });
}

/**
 * Arm a Call on somebody else's character.
 *
 * Support gives another player advantage. Flags live on the beneficiary's actor,
 * which the buyer has no write access to - hence "Player A lacks permission".
 * The GM owns everything, so they set it.
 *
 * AWAITED, LIKE A SABOTAGE (E03). The GM takes the Hope for a Support on
 * somebody else's character, and may refuse it - no Hope, a Silence, a GM who
 * sees the world differently - so "sent" is not "armed". The answer's `value`
 * is the GM's `{ ok, left }`; a GM arming it on its own client answers `true`,
 * or null for a character that is not there.
 */
export function requestArmCall(actorId, call, timeoutMs = TIMING.rulingMs) {
    return ask(ACTION_ARM, { actorId, call }, {
        timeoutMs,
        local: async () => {
            const actor = game.actors.get(actorId);
            if (!actor) return null;
            const { appendArmedCall } = await import("./call-effects.mjs");
            await appendArmedCall(actor, call);
            return true;
        }
    });
}

/**
 * Despair pools are a world setting; a player's reroll asks the GM to fix one.
 *
 * `userId` is the sender, `targetUserId` the Monokuma being adjusted. They used
 * to be the same field, which is how the GM side had no way of telling who was
 * asking from whose pool was moving. `actorId` is the rerolling character: the
 * GM pays a player's point from the receipt of that character's Reroll (E03).
 */
export function requestDespairAdjust(targetUserId, delta, { actorId = null } = {}) {
    return ask(ACTION_DESPAIR, { targetUserId, delta, actorId }, {
        local: () => import("./despair.mjs").then(m => m.adjustDespair(targetUserId, delta))
    });
}

/**
 * An assistant GM's Despair change, sent to the primary to write (DESP-12).
 *
 * NOT `requestDespairAdjust`, whose GM road hands the change straight back to
 * `adjustDespair` - which, on an assistant, would route here again for ever.
 * 1.2.47 wired the receiving half (`handleDespair` admits a GM sender at any size)
 * and reached for the sending half through `hasGm`, which this file never
 * exported: the import came back undefined, the call threw, `adjustDespair`'s
 * catch wrote the pool locally, and the race DESP-12 exists to close - two GM
 * clients each writing the whole pools object from their own cache - stayed open.
 *
 * The caller has already checked that the primary is online and is somebody else.
 * The runner judges on the primary GM only, so there is one writer.
 */
export function sendDespairToPrimary(targetUserId, delta) {
    return ask(ACTION_DESPAIR, { targetUserId, delta });
}

/**
 * Sabotage writes two world settings; the GM applies it and this waits for the
 * real outcome rather than assuming the request will land.
 *
 * `sabotageProject` used to return `{pending: true}` here and let the action
 * report success on the strength of that alone - the freeze and the repair
 * project it depends on were still just an emitted socket message, applied
 * whenever the GM's client got around to it. A player who then tried to keep
 * working the same project immediately afterwards could land inside that gap
 * and find it not frozen yet, and the "repair created" text was reading a
 * repair object that did not exist yet either. This answers once the GM's
 * client says what it actually wrote (`value`), so the roll does not call
 * itself done until it is. Two clocks (COMM-17): the "got it" says the request
 * arrived, and the answer - two world writes and a repair project - may take
 * longer than that on a slow client.
 */
export function requestSabotage(targetId, difficulty, timeoutMs = TIMING.rulingMs) {
    return ask(ACTION_SABOTAGE, { targetId, difficulty }, { timeoutMs });
}

/**
 * Taking a sabotage back writes the same two settings. It is only ever called by
 * Reroll, after the Call has already been paid for and the new roll is about to
 * replace the old effect, so the player has nothing to race against; it waits
 * for the thaw all the same, because the Reroll says the sabotage was undone
 * only once it was (E31 review).
 */
export function requestUndoSabotage(targetId, repairId, actorId = null) {
    return ask(ACTION_UNSABOTAGE, { targetId, repairId, actorId });
}

/** A player whose token cannot be moved back asks the GM to do it. */
export function requestSendBack(sceneId, tokenId, position) {
    return ask(ACTION_SENDBACK, { sceneId, tokenId, position });
}

/** Count an Eclipse crossing on the GM's copy of the world setting. */
export function requestEclipseMove(actorId) {
    return ask(ACTION_ECLIPSE_MOVE, { actorId });
}

/**
 * The trace that handed over this object is evidence now.
 *
 * Asked by the killer's own client at the moment they swing, answered on the
 * GM's, because the answer key is theirs. Nothing waits on it: a trace that
 * cannot be re-labelled must not stop a murder that is already happening, and
 * the GM can tick the box by hand in the case dashboard. It carries a request
 * id since E31, like every request, so a refusal reaches the killer. No
 * identity is a caller's mistake, not the player's, and is said to nobody.
 */
export function requestTieTrace(identity) {
    if (!identity) return Promise.resolve({ ok: false, reason: "badRequest" });
    return ask(ACTION_TIE_TRACE, { identity }, {
        local: () => import("./remnants.mjs").then(m => m.tieTraceForItem(identity))
    });
}

/**
 * Creating tokens is GM-only, so a player's Remnant is placed for them. Answered
 * when it is placed (E31), not when it arrived, and refused as failed when the
 * GM's client could not place it (E31 review): the item a planted trace stands
 * for is taken off the sheet only when it was placed, and "trace left" is said
 * only then.
 */
export function requestRemnant(data) {
    return ask(ACTION_REMNANT, { data });
}

/**
 * Retune or remove a Remnant a player's own action left behind - a reroll has
 * changed how well they hid it, or removed the reason for the trace entirely.
 * Editing tokens is GM-only, same as creating them.
 */
export function requestRemnantEdit(sceneId, tokenId, patch) {
    return ask(ACTION_REMNANT_EDIT, { sceneId, tokenId, patch });
}

/*
 * A RULING THAT NEEDS A HUMAN IS A CARD, LIKE EVERY OTHER RULING (COMM-04).
 *
 * A Hope Call that needs the GM (Experience, Ultimate) and a Dynamic action
 * used to open a DialogV2 on the primary GM's client and nowhere else: no
 * card, no popup, no sound, and a second GM never learned the question
 * existed. If that dialog sat behind a sheet the player waited out the whole
 * timeout looking at nothing. Now both are `callGm` cards in the player's
 * thread with the answers on them - any GM may press either - and the answer
 * travels back as the request's `bridge.done` (`answerHopeCall`,
 * `answerDynamic`).
 *
 * `askedByCard` is the dedupe: a player's client asks again for an unanswered
 * ruling when a GM's world finishes loading, and the card is already up.
 */
const askedByCard = new Set();

async function askHopeCallByCard(payload, ctx) {
    if (!ctx.requestId || askedByCard.has(ctx.requestId)) return { later: true };
    askedByCard.add(ctx.requestId);
    const actor = game.actors.get(payload.actorId ?? "");
    const data = { rid: ctx.requestId, asker: ctx.asker, by: payload.actorId ?? "" };
    /*
     * THE PRICE FROM THIS SIDE'S TABLE, NOT THE PACKET'S (E02, 24.09.2026; audit
     * S10-02). `cost` was the one field on this card printed raw - into
     * `game.i18n.format`, then into the card's HTML - so a packet carrying
     * `<img src=x onerror=...>` as its cost ran script on every GM's screen. The
     * GM holds the same `HOPE_CALLS`, so the number never had to travel; a key
     * this side does not know prints as "?". Every other field is escaped, and
     * since E31 `cost` is not on the declaration's whitelist at all.
     */
    const call = HOPE_CALLS[payload.key] ?? null;
    const posted = await callGm(actor, {
        title: game.i18n.format("DRPG.Calls.approveTitle", { call: call?.label ?? payload.callLabel ?? "" }),
        request: payload.note ?? "",
        body: `<p>${esc(payload.effect ?? "")}</p><p class="notes">${
            game.i18n.format("DRPG.Calls.approveCost", { cost: Number.isFinite(call?.cost) ? call.cost : "?" })}</p>`,
        gmBody: game.i18n.localize("DRPG.Calls.approveHint"),
        actions: [
            { action: "approveCall", label: game.i18n.localize("DRPG.Calls.approveYes"), data },
            { action: "refuseCall", label: game.i18n.localize("DRPG.Calls.approveNo"), data }
        ]
    });
    // A card that could not be posted is a ruling nobody can give: said now,
    // rather than after the player's clock (map-gmSide 3, E31).
    return posted === false ? { refused: "the ruling card could not be posted" } : { later: true };
}

async function askDynamicByCard(payload, ctx) {
    if (!ctx.requestId || askedByCard.has(ctx.requestId)) return { later: true };
    askedByCard.add(ctx.requestId);
    const actor = game.actors.get(payload.actorId ?? "");
    const data = {
        rid: ctx.requestId, asker: ctx.asker, by: payload.actorId ?? "",
        room: payload.room ?? "", desc: payload.description ?? "", name: payload.actorName ?? ""
    };
    const posted = await callGm(actor, {
        title: game.i18n.localize("DRPG.Action.dynamicTitle"),
        request: payload.description ?? "",
        room: payload.room ?? null,
        actions: [
            { action: "setDifficulty", label: game.i18n.localize("DRPG.Action.dynamicSet"), data },
            { action: "refuseDynamic", label: game.i18n.localize("DRPG.Action.dynamicRefuse"), data }
        ]
    });
    return posted === false ? { refused: "the ruling card could not be posted" } : { later: true };
}

/**
 * A GM's answer to a Hope Call card, sent to the player who asked: the request's
 * `bridge.done`, `true` to allow and `false` to refuse. Returns true once sent,
 * as it always did (40-flow reads it).
 */
export function answerHopeCall(requestId, asker, verdict) {
    if (!game.user.isGM || !requestId || !asker) return false;
    game.socket.emit(SOCKET_EVENT, {
        action: ACTION_DONE, requestId, userId: asker, value: Boolean(verdict)
    }, { recipients: [asker] });
    return true;
}

/** A GM's answer to a Dynamic action card: `{ tier, trait }`, or `false` to refuse. */
export function answerDynamic(requestId, asker, ruling) {
    if (!game.user.isGM || !requestId || !asker) return false;
    game.socket.emit(SOCKET_EVENT, {
        action: ACTION_DONE, requestId, userId: asker, value: ruling ?? false
    }, { recipients: [asker] });
    return true;
}

/**
 * "May I spend this, and here is what for." Waits for a human (Dawid, 29.08).
 *
 * The same shape as `requestDynamicDifficulty` below, and for the same reason:
 * a question only a person can answer, so the clock is generous, there is no
 * clock for the "got it" (`patient`), and the question is asked again when a
 * GM's world has loaded. Nothing is charged on this side - see `spendHopeCall`,
 * which pays only against a yes - so a failure says "Nothing was spent."
 *
 * @returns {Promise<object>} the bridge's result; `value` true to allow, false to refuse.
 */
export function requestHopeCallApproval(
    { actorId, actorName, key, callLabel, effect, cost, note }, timeoutMs = TIMING.hopeCallRulingMs) {
    return ask(ACTION_HOPE_CALL, { actorId, actorName, key, callLabel, effect, cost, note }, { timeoutMs, nothingSpent: true });
}

/**
 * Ask a GM how hard a described action is.
 *
 * The guide gives the threshold to the GM: "the player describes something, the
 * GM picks a threshold". The picker used to render on the player's own client,
 * so the person being tested chose their own difficulty - and would always
 * choose the easiest band. The card now goes to the GMs and the answer comes
 * back over the socket.
 *
 * Generous clock on purpose: a GM reading a description and making a ruling is
 * a human taking their time, not a machine failing to answer.
 *
 * @returns {Promise<object>} the bridge's result; `value` `{tier, trait}`, or false when the GM refused.
 */
export function requestDynamicDifficulty({ description, actorName, room, actorId = null }, timeoutMs = TIMING.rulingMs) {
    return ask(ACTION_DIFFICULTY, { description, actorName, room, actorId }, { timeoutMs, nothingSpent: true });
}

/**
 * Ask a GM which Remnant this Observe is aimed at, before the dice are thrown.
 *
 * A GM runs this locally instead of talking to themselves. Everyone else waits
 * on the socket, as patiently as for the Dynamic ruling, since a "specific"
 * declaration opens a picker a human has to read.
 *
 * The answer says only whether there is something to look at. The Remnant, its
 * kind and its difficulty stay on the GM's client: the observer is told what
 * they found, never what they were up against.
 *
 * ONE OF THE TWO REQUESTS THAT ANSWER THEIR VALUE, NOT THE BRIDGE'S RESULT
 * (E31), with `requestCleanableTraces`: the GM's `{ ok, key?, reason? }`, or
 * null when the request was not carried out, which has been said once already
 * with "Nothing was spent.". Its callers and 30-security read `.ok` and `.key`
 * off it, and the GM's own `ok: false` (an empty room, a declaration it does not
 * know) is a ruling, told apart from null.
 *
 * @returns {Promise<{ok: boolean, key?: string, reason?: string}|null>}
 */
export async function requestObserveTarget({ actorId, declaration, request = "" }, timeoutMs = TIMING.rulingMs) {
    const res = await ask(ACTION_OBSERVE_TARGET, { actorId, declaration, request }, {
        timeoutMs, nothingSpent: true,
        local: () => import("./observe.mjs").then(m => m.chooseObserveTarget({ actorId, declaration, request }))
    });
    return res.ok ? res.value ?? null : null;
}

/**
 * Ask a GM which of a killer's traces they may act on, before Stage 6's picker
 * opens.
 *
 * A GM runs this locally instead of talking to themselves - the same shape as
 * `requestObserveTarget`. Everyone else waits on the socket.
 *
 * THE ONE REQUEST THAT ANSWERS A LIST, NOT THE BRIDGE'S RESULT (E31). It writes
 * nothing, and an empty list - nothing to act on - is the safe answer to every
 * failure, which has been told once already; its three callers and
 * 30-security read an array, and a null on a refusal used to crash one of them.
 * `quiet` for a sheet that asks in the background.
 *
 * @returns {Promise<Array<{id: string, label: string, reinforced: boolean}>>}
 *   Never DC, never `tiedToCrime` - see `cleanableTracesForPlayer` in
 *   cleanup.mjs, which is the only thing that ever builds this array.
 */
export async function requestCleanableTraces(actorId, { mine = false, quiet = false } = {}, timeoutMs = TIMING.rulingMs) {
    const res = await ask(ACTION_CLEANUP_TRACES, {
        // `mine` narrows the answer to what this character knows is there.
        // `false` asks for the whole room, which is Stage 6's - and the GM's
        // side decides whether this character is in Stage 6, not this
        // flag (E03; audit S05-04). See `cleanableTracesForPlayer`.
        actorId, mine
    }, {
        timeoutMs, quiet,
        local: () => import("./cleanup.mjs").then(m => m.cleanableTracesForPlayer(actorId, { mine }))
    });
    return res.ok && Array.isArray(res.value) ? res.value : [];
}

/**
 * Hand a thrown Observe to the GM to be scored.
 *
 * The answer is the whisper the player gets when the GM's client has finished -
 * a Truth Bullet on their sheet or 2 Sanity - which can wait on the GM
 * describing what was found, so the request waits only for the "got it", and a
 * refusal after it is still told.
 */
export function requestObserveResolve({ actorId, key, total, isCritical, undo = false }) {
    return ask(ACTION_OBSERVE_RESOLVE, { actorId, key, total, isCritical, undo }, {
        local: () => import("./observe.mjs").then(m => m.resolveObserve({ key, total, isCritical, undo, actorId }))
    });
}

/**
 * Hand a thrown Analyze to the GM to be scored.
 *
 * The verdict is the whisper the player gets once the GM's client has
 * converted the bullet or locked it; unlike Observe, nothing in that waits on a
 * person, so the request waits for it (E31 review) and a Reroll says the bullet
 * was analysed again only when it was.
 */
export function requestAnalyzeResolve({ actorId, itemId, total, isCritical, undo = false }) {
    return ask(ACTION_ANALYZE_RESOLVE, { actorId, itemId, total, isCritical, undo }, {
        local: () => import("./analyze.mjs").then(m => m.resolveAnalyze({ actorId, itemId, total, isCritical, undo }))
    });
}

/**
 * A player's Level Up picks, sent to the GM who offered it (N-2, Dawid 20.09).
 *
 * `applyAdvancement` writes through `automatedUpdate`, which bypasses the resource
 * guard on purpose - so it is GM-only, and it has to stay that way. The player
 * picks; the GM's client checks the offer again and writes.
 */
export function requestAdvancement({ actorId, picks, kind }) {
    return ask(ACTION_ADVANCEMENT, { actorId, picks, kind }, {
        local: () => import("./level-up.mjs").then(m => {
            const actor = game.actors.get(actorId);
            return actor ? m.applyAdvancement(actor, picks, kind) : null;
        })
    });
}

/**
 * Copy one of my Truth Bullets onto somebody else's sheet.
 *
 * Writing to another player's actor is GM-only, and the answer key entry that
 * travels with the copy can only be written on a GM's client anyway.
 */
export function requestShareBullet({ fromId, toId, itemId }) {
    return ask(ACTION_SHARE_BULLET, { fromId, toId, itemId }, {
        local: () => import("./handover.mjs").then(m => m.shareBullet({ fromId, toId, itemId }))
    });
}

/** Move one of my items onto somebody else's sheet, and off mine. */
export function requestGiveItem({ fromId, toId, itemId }) {
    return ask(ACTION_GIVE_ITEM, { fromId, toId, itemId }, {
        local: () => import("./handover.mjs").then(m => m.giveItem({ fromId, toId, itemId }))
    });
}

/** Hand a thrown crisis action to the GM to be scored and applied. */
export function requestCrisisResult({
    actorId, key, total, isCritical, withHope, undo = false,
    // G-18: this one was taken rather than rolled - a critical Self-defence's
    // free resolution action. Re-checked GM-side against the incident state,
    // like everything else that arrives over this socket.
    free = false,
    // What the player's own client used up, if the action was "use an item".
    // Carried rather than decided here: the GM records it so a Reroll can put
    // it back, but the spending happened where the dialogs belong.
    usedItemId = null,
    // Which resource a critical Strike takes. Decided by the killer on their own
    // client while the dice are still up, and carried here rather than asked
    // again on the GM's - see `askCriticalTarget`.
    choice = null,
    // The weapon the roll was thrown with. Remembered GM-side for Stage 6.
    swungId = null
}) {
    return ask(ACTION_CRISIS, { actorId, key, total, isCritical, withHope, undo, choice, usedItemId, free, swungId }, {
        local: () => import("./murder.mjs").then(m => m.resolveCrisisAction({
            actorId, key, total, isCritical, withHope, undo, choice, usedItemId, free, swungId
        }))
    });
}

/** Hand a thrown Stage 6 clean-up to the GM to be scored against the trace. */
export function requestCleanup({
    actorId, tokenId, total, isCritical, withHope, undo = false,
    // G-20: what a critical chose to turn the trace into, if anything. Shaped
    // and bounded on the far side - see `resolveCleanup`.
    transform = null,
    // Z5: what the transform action was declared as, before the dice. Same
    // treatment - sent as given, bounded on arrival.
    change = null,
    // Stage 6 has four actions now. `key` names which; absent means the
    // original one, so every existing caller keeps working unchanged.
    key = "eraseTrace", targetId = null,
    // Which door this came through: the Tamper tile, or Stage 6's own panel.
    // It decides which guard runs - see cleanup.mjs.
    viaAction = false,
    // T-1: which step of Tamper's price chain the client already paid, and
    // whether a Burst paid it. Absent means "nothing was paid on the client",
    // and the resolver charges the Sanity itself.
    price = null, grant = false
}) {
    // The two that aim at a TRACE go to `resolveCleanup`; the two that roll
    // against a flat threshold go to `resolveStageSix`. Naming the first pair
    // rather than excluding the second means a fifth action added later lands
    // in the branch that reads its own threshold, which is the safe default.
    const aimed = key === "eraseTrace" || key === "transformTrace";
    const mode = key === "transformTrace" ? "transform" : "erase";
    return ask(ACTION_CLEANUP, {
        actorId, tokenId, total, isCritical, withHope, undo, key, targetId, transform,
        change, viaAction, price, grant
    }, {
        local: () => import("./cleanup.mjs").then(m => aimed
            ? m.resolveCleanup({
                actorId, tokenId, total, isCritical, withHope, undo, transform,
                mode, change, viaAction, price, grant
            })
            : m.resolveStageSix({
                actorId, key, targetId, total, isCritical, withHope, viaAction,
                price, grant
            }))
    });
}

/** Record a direct murder declared during an Eclipse. See eclipse.mjs. */
export function requestParkMurder({ killerId, room = null, note = "" }) {
    return ask(ACTION_PARK_MURDER, { killerId, room, note }, {
        local: () => import("./eclipse.mjs").then(m => m.writeParkedMurder({ killerId, room, note }))
    });
}

/**
 * Ask a GM to open the betrayal: the newcomer kills the killer they helped.
 *
 * No dice and no numbers travel - this is a declaration, and the GM's own
 * confirmation is what turns it into a second incident.
 */
export function requestBetrayal({ actorId }) {
    return ask(ACTION_BETRAYAL, { actorId }, {
        local: () => import("./murder.mjs").then(m => m.betrayAsPlayer(actorId))
    });
}

/** Hand a thrown Meddle to the GM to be scored and applied to the target. */
export function requestMeddleResolve({ actorId, targetId, help, total, isCritical }) {
    return ask(ACTION_MEDDLE, { actorId, targetId, help, total, isCritical }, {
        local: () => import("./monocub.mjs").then(m => m.resolveMeddle({ actorId, targetId, help, total, isCritical }))
    });
}

/**
 * Pull one item out of somebody else's stash. GM-only on both ends.
 *
 * `viaSearch` marks the route that has already paid for a concealed stash with
 * an action, a search token and a penalised roll - see `stealFromVault`.
 */
export function requestVaultSteal({ thiefId, ownerId, itemId, viaSearch = false, clumsy = false }) {
    return ask(ACTION_VAULT_STEAL, { thiefId, ownerId, itemId, viaSearch, clumsy }, {
        local: () => import("./vault.mjs").then(m => m.stealFromVault({ thiefId, ownerId, itemId, viaSearch, clumsy }))
    });
}

/**
 * Go through somebody's pockets. GM-only on both ends, like its sibling above.
 *
 * The two totals travel and the verdicts are made on the other side - see
 * `stealFromPerson`. `itemId` is a request rather than an instruction: it is
 * honoured only on a critical, and only if it is really in the victim's pockets.
 */
export function requestSteal({
    thiefId, victimId, itemId = null,
    total = 0, isCritical = false, unseenTotal = 0, unseenCritical = false
}) {
    return ask(ACTION_STEAL, { thiefId, victimId, itemId, total, isCritical, unseenTotal, unseenCritical }, {
        local: () => import("./vault.mjs").then(m => m.stealFromPerson({
            thiefId, victimId, itemId, total, isCritical, unseenTotal, unseenCritical
        }))
    });
}

/**
 * Leave something in somebody's pocket. The mirror of `requestSteal`, and the
 * same division of labour: the two totals travel, both verdicts are made on the
 * other side against `ACTIONS.palm`.
 *
 * `itemId` is not a request here but a statement - it came out of the planter's
 * own pockets and there is nothing secret about it. The GM side still checks it
 * is really there, for the same reason it checks everything else.
 */
export function requestPlant({
    plannerId, victimId, itemId,
    total = 0, isCritical = false, unseenTotal = 0, unseenCritical = false
}) {
    return ask(ACTION_PLANT, { plannerId, victimId, itemId, total, isCritical, unseenTotal, unseenCritical }, {
        local: () => import("./vault.mjs").then(m => m.plantOnPerson({
            plannerId, victimId, itemId, total, isCritical, unseenTotal, unseenCritical
        }))
    });
}

/**
 * Hand a Locate-a-hidden-stash roll to the GM to be scored.
 *
 * Like Observe: the answer is the whisper the finder gets, and the write it may
 * cause is a flag on their own sheet. The number travels; the threshold, the
 * room and which stash it opens are all decided on the far side - see
 * `resolveStashSearch`.
 */
export function requestStashSearch({ actorId, total = 0, isCritical = false }) {
    return ask(ACTION_FIND_STASH, { actorId, total, isCritical }, {
        local: () => import("./vault.mjs").then(m => m.resolveStashSearch({ actorId, total, isCritical }))
    });
}

/**
 * Ask the GM to add project progress on our behalf. What actually changed is
 * whispered back by the GM's client; the request knows that it was carried out
 * (E31 review), not what it changed.
 */
export function requestProjectProgress(countdownId, amount, actorId = null) {
    return ask(ACTION_PROGRESS, { countdownId, amount, actorId });
}

/**
 * Ask the GM to let another player in on a secret project. Players are allowed
 * to bring someone in on their own plan - the guide's whole social engine runs
 * on conspiracies - but the write itself has to happen GM-side.
 */
export function requestProjectShare(countdownId, userId) {
    return ask(ACTION_SHARE, { countdownId, targetUserId: userId });
}

/* ==========================================================================
 * CALLING THE GM
 * ========================================================================== */

/**
 * Post a ruling request into the actor owner's messenger thread - one message,
 * visible to the player and every GM at once. An actor with no player owner
 * (a Monokuma, a bare NPC) has no thread to post into, so this falls back to
 * the old GM-only whisper.
 *
 * @param {Actor} actor
 * @param {object} params
 * @param {string} params.title     What is being asked, e.g. "Think".
 * @param {string} [params.body]    Extra context, already escaped.
 * @param {object} [params.roll]    Result of the roll, if one was made.
 * @param {string} [params.request] The player's own words.
 * @param {string} [params.room]    Where they are standing.
 */
export async function callGm(actor, {
    title, body = "", roll = null, request = "", room = null,
    /**
     * Prose for the GM alone: a threshold table, "score it against...", a
     * reminder of what is owed. The card lives in the player's thread, so
     * anything here is wrapped in `.drpg-gm-only` and taken off the card on a
     * player's client, the same way the buttons are (COMM-06).
     */
    gmBody = "",
    /**
     * Buttons for the GM, rendered into the card itself.
     *
     * Each is `{ action, label, data }`. `data` becomes `data-*` attributes on
     * the button, which is how the ruling carries its own subject: a Direct
     * Murder declaration names the killer and the victim, so the card that
     * announces it can open the incident without a GM re-picking two names off
     * a list they are already reading.
     *
     * Safe to render for everybody: the GM-only buttons are stripped from a
     * player's copy (`wireCallActions`), and every action behind them is
     * GM-gated again on arrival, so a player who forges a click into their own
     * DOM achieves nothing.
     */
    actions = [],
    /**
     * NEVER SHOW THIS TO THE PLAYER WHOSE ACTOR IT NAMES.
     *
     * Everything else `callGm` sends is a card the player ASKED for: they made
     * a request, they are waiting on a ruling, and the conversation belongs in
     * their thread where they can read it.
     *
     * E21's trap alerts are the opposite. The module tells the GM what it just
     * saw, and the actor it names is the KILLER - so the ordinary path posts
     * into the killer's own messenger thread a card saying their trap has been
     * tripped and, worse, WHO tripped it. Measured on the first run of this:
     * "Player B, in Big IT Room" delivered straight to Player A, before the GM
     * had decided anything at all.
     *
     * That is trap 156 of this stage, which warned that the alert would travel
     * the same road as every ruling card and that the road was the risk. It
     * cost one line to open and one line to close.
     */
    gmOnly = false
} = {}) {
    const parts = [];

    parts.push(`<h3>${esc(title)}</h3>`);
    parts.push(`<p><strong>${esc(actor?.name ?? "?")}</strong>${room ? ` · ${esc(room)}` : ""}</p>`);

    if (roll) {
        const traitLabel = TRAITS[roll.trait]?.label ?? roll.trait ?? "";
        parts.push(`<p>${traitLabel} · <strong>${roll.total}</strong>${
            roll.isCritical ? ` · <em>${game.i18n.localize("DRPG.Action.critical")}</em>`
            : roll.withHope ? ` · ${game.i18n.localize("DRPG.Explain.status.hopeTitle")}`
            : roll.withFear ? ` · ${game.i18n.localize("DRPG.Despair.label")}` : ""
        }</p>`);

        // The guide owes the player a substantial hint on a critical Observe or
        // Analyze. Say so loudly rather than leaving the GM to remember it.
        if (roll.isCritical) {
            parts.push(`<div class="drpg-gm-only"><p class="drpg-warning"><strong>${
                game.i18n.localize("DRPG.Bridge.criticalHint")
            }</strong></p></div>`);
        }
    }

    // ORDER: what happened, then what they said, then the reference.
    //
    // It used to run name → roll → their words → the GM's reference table →
    // "awaiting a ruling", which put the player's own sentence between two
    // blocks of numbers. The GM reads this top to bottom while deciding: the
    // roll is the fact, the quote is the request being ruled on, and the
    // threshold table is the thing you look at last, to price the answer.
    if (request) parts.push(`<blockquote>${esc(request)}</blockquote>`);
    if (body) parts.push(`<p>${body}</p>`);
    if (gmBody) parts.push(`<div class="drpg-gm-only">${gmBody}</div>`);
    // Classed so `settleCall` can take it off again once the card is answered.
    parts.push(`<p class="drpg-call-awaiting"><em>${
        game.i18n.localize("DRPG.Bridge.awaitingRuling")}</em></p>`);

    if (actions.length) {
        parts.push(`<div class="drpg-call-actions">${actions.map(a => {
            const attrs = Object.entries(a.data ?? {})
                .map(([k, v]) => ` data-${esc(k)}="${esc(v)}"`).join("");
            return `<button type="button" class="drpg-call-action" data-drpg-call="${
                esc(a.action)}"${attrs}>${esc(a.label)}</button>`;
        }).join("")}</div>`);
    }

    const content = parts.join("");

    const owner = gmOnly ? null : ownerOf(actor);
    if (!owner) {
        /*
         * NO THREAD TO LIVE IN, so the chat log - and the log has to behave
         * like a thread for it (COMM-02). Before this a trap alert landed as a
         * silent sidebar line: no popup (a GM's whispers never raise one
         * unless the poster insists), no sound, and two buttons nothing wired,
         * because the only wiring lived in the messenger's bubbles. `callCard`
         * is what the render hook in `registerGmBridge` keys on.
         */
        try {
            await whisperToGms(content, {
                flags: { [MODULE_ID]: {
                    callCard: true, gmPopup: true, popupTitle: title,
                    sfx: { key: "gmAsk", gm: true }
                } }
            });
            return true;
        } catch (err) {
            error("Could not reach the GM", err);
            return false;
        }
    }

    try {
        const { postToThread } = await import("./messenger.mjs");
        // Every callGm card is, by definition, a call ON the GM - the flag is
        // what tells the messenger's notifier to interrupt them for it. See
        // MESSENGER_FLAGS.gmAsk for why this cannot be derived from the author.
        return Boolean(await postToThread(owner.id, content, { gmAsk: true }));
    } catch (err) {
        error("Could not reach the GM", err);
        return false;
    }
}

/**
 * Close a ruling card out: the ask becomes a receipt.
 *
 * A card kept saying "Awaiting a ruling." after the ruling had been made. The
 * GM answered in words, the answer landed two bubbles further down, and the
 * card above it still read as an open question - with its buttons still on it,
 * inviting a second ruling on something already ruled (Dawid, 26.08).
 *
 * Rewritten on the MESSAGE, not hidden on the client that clicked: the card
 * lives in a thread the player and every other GM are reading, and a receipt
 * only one screen can see is the bug again with a smaller audience.
 *
 * @param {ChatMessage} message  The card.
 * @param {string} text          What settled it, in plain words.
 */
export async function settleCall(message, text) {
    if (!message || !game.user.isGM) return null;

    // A `<template>`, not a `<div>` (E02 review): markup parsed into a
    // detached div still loads its images, so an `onerror` in the card's words
    // would run right here, on the GM's client. A template's content is inert.
    const wrap = document.createElement("template");
    wrap.innerHTML = contentOf(message);

    wrap.content.querySelectorAll(".drpg-call-actions, .drpg-call-awaiting").forEach(el => el.remove());
    // Cards posted before the marker class existed carry the same sentence with
    // nothing to hook onto, so they are matched by what they say.
    const awaiting = game.i18n.localize("DRPG.Bridge.awaitingRuling");
    for (const p of wrap.content.querySelectorAll("p")) {
        if (p.textContent.trim() === awaiting) p.remove();
    }

    const note = document.createElement("p");
    note.className = "drpg-call-settled";
    note.textContent = text;
    wrap.content.append(note);

    try {
        const { MESSENGER_FLAGS } = await import("./messenger.mjs");
        const flags = { [MODULE_ID]: { [MESSENGER_FLAGS.settled]: true } };
        if (message.getFlag(MODULE_ID, "secret")) {
            // The words live off the document (secret.mjs). Writing them into
            // `content` here would hand every client the private text in
            // clear; the receipt travels the road the question did.
            const { updateSecret } = await import("./secret.mjs");
            await updateSecret(message, wrap.innerHTML);
            return await message.update({ flags });
        }
        return await message.update({ content: wrap.innerHTML, flags });
    } catch (err) {
        error("Could not close out the ruling card", err);
        return null;
    }
}

/**
 * Ask the player what they want, then send it to the GM. Returns the text, or
 * null if they backed out.
 */
export async function promptAndCallGm(actor, {
    title, prompt, placeholder = "", roll = null, room = null,
    // Optional HTML shown above the prompt. Used to fold an action's briefing
    // into this window instead of spending a separate one on it.
    intro = "",
    // Optional HTML for the GM's CARD rather than the player's window - the
    // answers a form collected, so the GM reads them without opening anything.
    // `intro` is what the player sees; this is what the GM sees.
    body = "",
    // Buttons for the GM on the card this produces. See `callGm`.
    actions = []
}) {
    const DialogV2 = foundry.applications.api.DialogV2;

    const text = await DialogV2.wait({
        classes: ["drpg-panel"],
        window: { title },
        content: dialogContent(`${intro}<form>
                    <p>${prompt}</p>
                    <textarea name="request" rows="3" placeholder="${foundry.utils.escapeHTML(placeholder)}"></textarea>
                  </form>`),
        buttons: [
            {
                action: "send",
                label: game.i18n.localize("DRPG.Bridge.send"),
                default: true,
                callback: (event, button, dialog) => dialog.element.querySelector("[name=request]").value.trim()
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    if (text === "cancel" || text === null || text === undefined) return null;

    /*
     * NULL MEANS NOTHING WAS SENT, AND IT HAS TO MEAN IT IN BOTH CASES (ACT-15,
     * 20.09).
     *
     * This returned the text whatever `callGm` answered, so every caller had two
     * roads to "the request never went" and could only see one of them: the player
     * closed the second window, or there was no GM connected to take it. Both left
     * the caller going on to whisper "your proposal has been sent". `callGm` already
     * answers false without throwing for the second - one caller in action-rolls.mjs
     * checks it by hand, which is what made this worth fixing here rather than at
     * three call sites.
     */
    const sent = await callGm(actor, { title, roll, request: text, room, body, actions });
    return sent === false ? null : text;
}
