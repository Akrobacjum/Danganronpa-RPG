/**
 * Danganronpa RPG - the Class Trial's tools beside the debate: the rounds (E70 C7, 28.10.2026) and the Closing Argument
 * (E70 C8, 28.10.2026).
 * ---------------------------------------------------------------------------
 * The guide's trial is more than a debate and its Objections. TESTIMONY: every participant in turn, a minute each (the
 * owner, TR6: "Zeznanie - maks 2 minuty na osobe. Nie 3."; 27.10: "Skrocmy proponowane testimony do 1 minuty"), the GM
 * typing the turn at every start between 30 and 120 s (TR14 = 3, TR26 = 1). PANIC ROUND: everyone in turn, "10-15 sekund
 * maks" - 15 s, 10 s offered from 12 participants on - and no Objection. Pass is always legal; no Consent, no Last
 * defence, no question from the floor (TR8, TR10, TR19 = 2).
 *
 * Both are rows of the floor's one engine (floor-machine.mjs: `MODES.testimony`, `MODES.panic`, the `round` start and
 * the round's steps), written in its one queue on the primary GM (trial-floor.mjs `startRoundInStep`,
 * `roundStepInStep`, steps of trial.mjs `SEIZE_KEY`). This file holds what the GM's window and the API ask before a
 * start (the offer and the guard, in the GM's words), the start itself on whichever GM asks, and the primary's
 * judgement of a participant's "trial.turn" (gm-bridge.mjs).
 *
 * A TURN ENDS FROM THE TABLE, NOT ONLY FROM THE GM'S TAB (E70-44; audit S06-38). The primary's one-second heartbeat moves
 * a turn on when its clock runs out, and a browser throttles that heartbeat in a tab nobody looks at: a 15-second turn
 * could stand for a minute. So the speaker ends their own turn (Done, Pass - trial-prompt.mjs), and every participant's
 * browser calls a turn over once it has run out on the primary's clock (`over`); the first that names the floor's step
 * moves it, and the heartbeat stays the backstop. Tier 2 E70-T9 holds the heartbeat as a background tab does. How long a
 * round runs at a table of 14-15, and whether a step over lands within its second's grace on a real server, is not
 * measured headless: LIVE-E70-07, LIVE-E70-08.
 */

import { TRIAL } from "./config.mjs";
import { error, isPrimaryGm, serialWrite } from "./utils.mjs";
import { MODES, turnRange, isRoundMode, closingOf } from "./floor-machine.mjs";
import { closingClaimStore } from "./gm-stores.mjs";
import { RECORD } from "./gm-store.mjs";

/** The turn the Testimony window offers (60 s since the owner's 27.10 answer; the range stays 30-120 s). */
export function testimonyOffer() {
    return Number(TRIAL.modes.round.testimony.offered) || 60;
}

/** The turn the Panic Round window offers for `participants`: 15 s, 10 s from `smallFrom` (12) on. */
export function panicSuggest(participants = 0) {
    const row = TRIAL.modes.round.panic;
    return Number(participants) >= Number(row.smallFrom) ? Number(row.small) : Number(row.offered);
}

/**
 * Why a round of `mode` cannot start with a turn of `seconds`, in the GM's words, or null: the machine's own range
 * (floor-machine.mjs `turnRange`), so the window, the API and the primary hold the same numbers.
 */
export function roundRefusal(mode, seconds) {
    const range = turnRange(mode);
    if (!range) return game.i18n.localize("DRPG.Floor.bar.noMode");
    const s = Math.round(Number(seconds) || 0);
    if (s < range.min) return game.i18n.format("DRPG.Floor.round.tooShortSeconds", { min: range.min });
    if (s > range.max) return game.i18n.format("DRPG.Floor.round.tooLongSeconds", { max: range.max });
    return null;
}

/** `roundRefusal` for Testimony: "A turn cannot be set longer than 120 s." past it (E70-41). */
export function testimonyRefusal(seconds) {
    return roundRefusal(MODES.testimony, seconds);
}

/** `roundRefusal` for Panic Round (10-15 s). */
export function panicRefusal(seconds) {
    return roundRefusal(MODES.panic, seconds);
}

/** A round's whole length for the window's live line, in m:ss: `seconds` a turn for `participants`. */
export function roundLength(seconds, participants) {
    const total = Math.max(Math.round(Number(seconds) || 0), 0) * Math.max(Number(participants) || 0, 0);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * Start a round of `mode` on whichever GM asks (the console's window, `game.drpg.startTestimony` and
 * `startPanicRound`): only in a Class Trial, the turn held to its range here first, so the GM is told why in their own
 * words, and again on the primary by the machine (a console's packet included). `order`: actor ids, the GM's order;
 * the participants it leaves out are drawn after it. Answers the floor written, or null. The table is told the order.
 */
async function startRound(mode, { seconds = null, order = null } = {}) {
    if (!game.user.isGM) return null;
    const { inClassTrial, floorStep } = await import("./trial-floor.mjs");
    if (!inClassTrial()) {
        ui.notifications.warn(game.i18n.localize("DRPG.Floor.bar.notTrial"));
        return null;
    }
    const turn = Number(seconds) || (mode === MODES.panic ? panicSuggest(await participantCount()) : testimonyOffer());
    const refused = roundRefusal(mode, turn);
    if (refused) {
        ui.notifications.warn(refused);
        return null;
    }
    const written = await floorStep(mode, { seconds: turn, order: Array.isArray(order) ? order : null });
    if (!written?.round) {
        if (written !== null) ui.notifications.warn(game.i18n.localize("DRPG.Floor.round.notStarted"));
        return null;
    }
    try {
        const { announce, esc } = await import("./utils.mjs");
        const { trialEventCard } = await import("./trial-floor-ui.mjs");
        const names = written.round.order.map(id => esc(game.actors.get(id)?.name ?? "-")).join(", ");
        await announce({ content: trialEventCard(`DRPG.Floor.mode.${mode}`,
            game.i18n.format("DRPG.Floor.round.startedLine", { seconds: turn, names })) });
    } catch (err) {
        error("Could not post the round's start", err);
    }
    return written;
}

/** How many take part in a trial now (vote.mjs `trialParticipants`), for the Panic Round's offer. */
async function participantCount() {
    const { trialParticipants } = await import("./vote.mjs");
    return trialParticipants().length;
}

/** `game.drpg.startTestimony({ seconds, order })` (E70-46): a Testimony, 60 s offered, 30-120 s. */
export function startTestimony(options = {}) {
    return startRound(MODES.testimony, options ?? {});
}

/** `game.drpg.startPanicRound({ seconds, order })` (E70-46): a Panic Round, 15 s (10 s from 12 participants), 10-15 s. */
export function startPanicRound(options = {}) {
    return startRound(MODES.panic, options ?? {});
}

/*
 * ONE STEP OVER PER SENDER AND STEP (E70 C7; the spec's write road "trial.turn"): a browser that calls a turn over and
 * is refused (its clock a second early) is not heard again for that step; the GM's heartbeat and the other browsers
 * carry it. Kept on this primary for the steps of the running round only - each new step's key is new, so the set is
 * cleared when it grows past a trial's worth.
 */
const overHeard = new Set();

/**
 * A participant's "trial.turn" on the primary (gm-bridge.mjs `handleTrialTurn`; the speaker's own window and every
 * participant's step over, trial-prompt.mjs): `{ reply: { step } }` with the step written, or `{ refused }` in the
 * bridge's closed words. The sender's ownership of `actorId` is the bridge's guard; here: a Class Trial, a round on the
 * floor, the character in its order, one step over per sender and step, and the machine's judgement in the floor's step.
 */
export async function turnOnPrimary({ actorId, kind, step }, senderId = null) {
    if (!isPrimaryGm()) return { refused: "nothing was carried out: this GM's browser is not the primary" };
    // The module, not its step's function: R991 holds every use of a floor writer to a step of `SEIZE_KEY`.
    const floorMod = await import("./trial-floor.mjs");
    const { SEIZE_KEY } = await import("./trial.mjs");
    if (!floorMod.inClassTrial()) return { refused: "no Class Trial is in session" };
    const floor = floorMod.trialFloor();
    // The Closing's speaker ends or passes their own stretch, and anyone taking part calls its time over (E70 C8).
    const closing = floor?.mode === MODES.closing && closingOf(floor)?.phase === "speak" ? closingOf(floor) : null;
    if (!closing && (!floor?.round || !isRoundMode(floor.round.mode))) return { refused: "no round holds the floor now" };
    if (closing) {
        const { trialParticipants } = await import("./vote.mjs");
        if (!trialParticipants().some(p => p.actor.id === actorId)) return { refused: "that character takes no part in the round" };
    } else if (!floor.round.order.includes(actorId)) return { refused: "that character takes no part in the round" };
    if (kind === "over") {
        const key = `${senderId ?? "-"}|${(closing ? closing.openedAt : floor.round.openedAt) ?? "-"}|${Number(step) || 0}`;
        if (overHeard.has(key)) return { refused: "that player has already called that turn over" };
        if (overHeard.size > 500) overHeard.clear();
        overHeard.add(key);
    }
    const event = kind === "over" ? { type: "over", step: Number(step) || 0 } : { type: kind, actorId, step: Number(step) || 0 };
    const out = await serialWrite(SEIZE_KEY, () => floorMod.roundStepInStep(event));
    // The machine's reasons, in the bridge's closed words (bridge-guards.mjs `REASON_PATTERNS`).
    switch (out?.refused ?? null) {
        case null: return { reply: { step: out?.written?.round?.step ?? out?.written?.closing?.step ?? null } };
        case "DRPG.Floor.bar.notTrial": return { refused: "no Class Trial is in session" };
        case "DRPG.Floor.round.noTurn": return { refused: "no round holds the floor now" };
        case "DRPG.Floor.round.notSpeaker": return { refused: "it is not that character's turn" };
        case "DRPG.Floor.round.notDue": return { refused: "that turn has not run out yet" };
        default: return { refused: "the round has moved on since that turn" };
    }
}

/* ==========================================================================
 * THE CLOSING ARGUMENT (E70 C8, 28.10.2026; S18-73, S18-74; the owner's TR7 "proponuje 5 minut", one per trial; TR23 = 1;
 * TR24 "Mowca ma rebuttal, w oparciu o ktory gm decyduje, kto kontynuuje closing argument"; TR29 = 4 "Brak ochrony,
 * chroni tylko GM"; TR34 = 1; DA18 "Wszedzie gracz ma proponowac, a DM zatwierdzac lub zmieniac"; amend 7 of 14.10:
 * "Chcialbym usunac nagrode +3 hope za ostatni glos" - no reward of any kind here).
 * --------------------------------------------------------------------------
 * The rows are the floor's (floor-machine.mjs `closingStep`, `closingOwnStep`), written in its one queue on the primary
 * (trial-floor.mjs `closingStepInStep`). What lives here: the GM's calls on whichever GM asks (`startClosing`,
 * `confirmClosingSpeaker`, `pickClosingSpeaker`, `continueClosing`, `resumeClosing`, the API's and the console's), the
 * console's refusal, a volunteer's "trial.claim" on the primary (`volunteerOnPrimary`), the draw, and the vote's end of it.
 *
 * THE VOLUNTEERS ARE THE GMS' (the stage's write roads; E70-51). Who volunteered and whom the draw named are in the GM
 * store `closingClaimStore` (`{ volunteers, drawn, openedAt }`), never in world data: the floor says how many volunteered
 * and whether there is a drawn speaker to confirm, so the GM's change of the draw is never told (E70-52: "the card never
 * tells a change"). world-secrets.mjs keeps `volunteers` and `drawn` out of the floor's setting.
 * ========================================================================== */

/** The GMs' record of the Closing's volunteers, once it has come in from the other GMs: `{ volunteers, drawn, openedAt }`. */
export async function closingHeld() {
    await closingClaimStore.whenHydrated();
    const row = closingClaimStore.get(RECORD) ?? {};
    return { volunteers: Array.isArray(row.volunteers) ? [...row.volunteers] : [], drawn: row.drawn ?? null, openedAt: row.openedAt ?? null };
}

/** The volunteers emptied for a new Closing, in its start's step on the primary (trial-floor.mjs `closingStepInStep`). */
export async function clearClaims(openedAt = null) {
    await closingClaimStore.whenHydrated();
    await closingClaimStore.patch(RECORD, { volunteers: [], drawn: null, openedAt });
}

/**
 * THE DRAW, in a step of the floor's key on the primary (trial-floor.mjs `advanceFrom`): one of the volunteers still
 * taking part - a volunteer who died or became a Monocub in the window is dropped (vote.mjs `trialParticipants`) -
 * at random, kept as `drawn`; null, kept as well, when nobody is left.
 */
export async function drawInStep() {
    const { trialParticipants } = await import("./vote.mjs");
    const taking = new Set(trialParticipants().map(p => p.actor.id));
    const held = await closingHeld();
    const left = held.volunteers.filter(id => taking.has(id));
    const drawn = left.length ? left[Math.floor(Math.random() * left.length)] : null;
    await closingClaimStore.patch(RECORD, { drawn });
    return drawn;
}

/**
 * Why the console's Closing Argument cannot start now, in the GM's words, or null (E70-50): this trial has had its
 * Closing ("This trial has already had its Closing Argument."; a second trial's record starts without one, D17), or a
 * mode other than an open debate holds the floor.
 */
export function closingRefusal(progress, floor) {
    if (progress?.closing?.done === true) return game.i18n.localize("DRPG.Floor.closing.already");
    if (floor && floor.mode !== MODES.debate) return game.i18n.localize("DRPG.Floor.closing.busy");
    return null;
}

/** A GM's call on the Closing, on whichever GM asks: only in a Class Trial; the floor written, or null with a warning. */
async function closingCall(op, args = {}) {
    if (!game.user.isGM) return null;
    const { inClassTrial, floorStep } = await import("./trial-floor.mjs");
    if (!inClassTrial()) {
        ui.notifications.warn(game.i18n.localize("DRPG.Floor.bar.notTrial"));
        return null;
    }
    const written = await floorStep(op, args);
    if (written === null) ui.notifications.warn(game.i18n.localize("DRPG.Floor.closing.notDone"));
    return written;
}

/**
 * `game.drpg.startClosing()` (E70-57): the volunteers' window (30 s), refused once this trial has had its Closing and
 * while another mode holds the floor - said in the GM's words here, judged again on the primary.
 */
export async function startClosing() {
    if (!game.user.isGM) return null;
    const { trialFloor } = await import("./trial-floor.mjs");
    const { trialProgress } = await import("./vote.mjs");
    const refused = closingRefusal(trialProgress(), trialFloor());
    if (refused) {
        ui.notifications.warn(refused);
        return null;
    }
    return closingCall("closing");
}

/** `game.drpg.confirmClosingSpeaker()`: the drawn volunteer speaks (300 s). */
export function confirmClosingSpeaker() {
    return closingCall("closingConfirm");
}

/** `game.drpg.pickClosingSpeaker(actorId)`: anyone taking part in the trial speaks instead, a volunteer or not (DA18). */
export function pickClosingSpeaker(actorId) {
    return closingCall("closingPick", { actorId: actorId?.id ?? actorId ?? null });
}

/**
 * `game.drpg.continueClosing(actorId)` after an exchange (TR24, TR34 = 1): the speaker, with the seconds they had at the
 * Objection, or one of the exchange's objectors with a new 300 s.
 */
export function continueClosing(actorId) {
    return closingCall("closingContinue", { actorId: actorId?.id ?? actorId ?? null });
}

/** `game.drpg.resumeClosing()`: the Closing's last speaker again with the seconds they had left, until the vote opens. */
export function resumeClosing() {
    return closingCall("closingResume");
}

/**
 * A volunteer's "trial.claim" on the primary (gm-bridge.mjs `handleTrialClaim`; the "I'll sum up" window,
 * trial-prompt.mjs): `{ reply: { count } }` or `{ refused }` in the bridge's closed words. The sender's ownership of
 * `actorId` is the bridge's guard; here, in one step of the floor's key: a Class Trial, the volunteers' window open, the
 * character taking part (vote.mjs `trialParticipants`), once; the name kept in the GMs' store and the count on the floor.
 */
export async function volunteerOnPrimary({ actorId }) {
    if (!isPrimaryGm()) return { refused: "nothing was carried out: this GM's browser is not the primary" };
    const floorMod = await import("./trial-floor.mjs");
    const { SEIZE_KEY } = await import("./trial.mjs");
    const { trialParticipants } = await import("./vote.mjs");
    return serialWrite(SEIZE_KEY, async () => {
        if (!floorMod.inClassTrial()) return { refused: "no Class Trial is in session" };
        const floor = floorMod.trialFloor();
        if (floor?.mode !== MODES.closing || closingOf(floor)?.phase !== "volunteer") return { refused: "nobody is volunteering for the Closing Argument now" };
        if (!trialParticipants().some(p => p.actor.id === actorId)) return { refused: "that character takes no part in the round" };
        const held = await closingHeld();
        if (held.volunteers.includes(actorId)) return { refused: "that character has already volunteered" };
        const volunteers = [...held.volunteers, actorId];
        await closingClaimStore.patch(RECORD, { volunteers });
        const out = await floorMod.closingStepInStep({ type: "claim", count: volunteers.length }, { why: true });
        if (out?.refused) return { refused: "nobody is volunteering for the Closing Argument now" };
        return { reply: { count: volunteers.length } };
    });
}

/**
 * THE VOTE ENDS THE CLOSING (E70 C8; E70-56): the vote's opening (vote.mjs `openRound`, on the primary) ends a Closing
 * still on the floor or in its exchange, as End this mode would, its record done. Nothing on any other floor.
 */
export async function endClosingForVote() {
    if (!isPrimaryGm()) return null;
    const floorMod = await import("./trial-floor.mjs");
    if (!closingOf(floorMod.trialFloor())) return null;
    const { SEIZE_KEY } = await import("./trial.mjs");
    try {
        return await serialWrite(SEIZE_KEY, () => (closingOf(floorMod.trialFloor()) ? floorMod.closingStepInStep({ type: "closingEnd" }) : null));
    } catch (err) {
        error("Could not end the Closing Argument as the vote opened", err);
        return null;
    }
}
