/**
 * Danganronpa RPG - the Class Trial's tools beside the debate: the rounds (E70 C7, 28.10.2026).
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
import { MODES, turnRange, isRoundMode } from "./floor-machine.mjs";

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
    if (!floor?.round || !isRoundMode(floor.round.mode)) return { refused: "no round holds the floor now" };
    if (!floor.round.order.includes(actorId)) return { refused: "that character takes no part in the round" };
    if (kind === "over") {
        const key = `${senderId ?? "-"}|${floor.round.openedAt ?? "-"}|${Number(step) || 0}`;
        if (overHeard.has(key)) return { refused: "that player has already called that turn over" };
        if (overHeard.size > 500) overHeard.clear();
        overHeard.add(key);
    }
    const event = kind === "over" ? { type: "over", step: Number(step) || 0 } : { type: kind, actorId, step: Number(step) || 0 };
    const out = await serialWrite(SEIZE_KEY, () => floorMod.roundStepInStep(event));
    // The machine's reasons, in the bridge's closed words (bridge-guards.mjs `REASON_PATTERNS`).
    switch (out?.refused ?? null) {
        case null: return { reply: { step: out?.written?.round?.step ?? null } };
        case "DRPG.Floor.bar.notTrial": return { refused: "no Class Trial is in session" };
        case "DRPG.Floor.round.noTurn": return { refused: "no round holds the floor now" };
        case "DRPG.Floor.round.notSpeaker": return { refused: "it is not that character's turn" };
        case "DRPG.Floor.round.notDue": return { refused: "that turn has not run out yet" };
        default: return { refused: "the round has moved on since that turn" };
    }
}
