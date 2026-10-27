/**
 * Danganronpa RPG - the trial floor's one engine: what the floor becomes after an event (E70 C1, 27.10.2026).
 * ---------------------------------------------------------------------------
 * PURE. `nextFloor(floor, event, ctx)` takes the floor as `trialFloor()` reads it (or null), an event and the moment
 * it happens (`ctx.now`, the server's clock as the caller read it), and answers what the floor becomes and which cards
 * tell the table - or why the event changes nothing. It reads no setting, no actor and no clock of its own, and writes
 * nothing: the primary GM's step of trial.mjs `SEIZE_KEY` judges who may ask (trial-floor.mjs), asks this, and writes
 * the answer (`commitFloor`). So every road that moves the floor - the heartbeat, the GM's bar, a seizure, the API -
 * moves it by the same rows, and tier 1 R1024 reads the rows without a world.
 *
 * Before this file each writer spelled its own transition (S18-72, S18-79): the heartbeat's, the GM's Now and the
 * lapse each had a copy of "an objection runs out into a rebuttal", and +30 s and Back to the debate each its own
 * arithmetic. Part 2 of E70 adds its modes as rows here, never as another writer.
 *
 * THE ANSWER: `{ floor, cards }`, where `floor` is the whole floor to write or null for an empty one (the floor
 * closed), and `cards` the chat cards the step posts, each `{ key, actorId?, mode? }`, worded on the poster's side;
 * or `{ refused: <a DRPG key> }`, the reason a GM's greyed button shows (trial-floor-ui.mjs `trialBar` asks the same
 * rows, so a dead button says its own op's reason).
 *
 * THE STACK (`before`): every Objection pushes `{ messageId, before, leftAtObjection }` - the floor it interrupted
 * (its mode, holder, target and budget) and that floor's seconds left - and a rebuttal keeps it. Back to the debate
 * gives the newest debate on it the seconds it had left (TR31: "Back to the debate gives the rest"), not its whole
 * budget again; a floor written before 1.2.90 has no stack and gets its `seconds`, as before. A debate has nothing
 * under it, so every write of a debate empties the stack. Part 2's Overrule (C2) reads the stack too.
 */

import { TRIAL } from "./config.mjs";

/** The three modes of today's floor, spelled once (trial-floor.mjs `FLOOR_MODES` is this object). */
export const MODES = Object.freeze({ debate: "debate", objection: "objection", rebuttal: "rebuttal" });

/** How long each timed mode runs; a debate's length is the GM's budget, the floor's `seconds`. */
const TIMED = { [MODES.objection]: TRIAL.objectionSeconds, [MODES.rebuttal]: TRIAL.rebuttalSeconds };

/** How long `floor`'s current mode is meant to run (trial-floor.mjs `modeSeconds` asks this). */
export function modeSecondsOf(floor) {
    if (!floor) return 0;
    // The objector's seconds to choose the bullet (E79 C16): the minute itself starts at the fill.
    if (floor.mode === MODES.objection && floor.pending) return TRIAL.objectionPickSeconds;
    return TIMED[floor.mode] ?? floor.seconds ?? TRIAL.speakSeconds;
}

/** Seconds left at `now`, rounded as trial-floor.mjs `secondsLeft` rounds them; negative once overrun. */
export function leftAt(floor, now) {
    if (!floor?.startedAt) return 0;
    return Math.round(modeSecondsOf(floor) - (now - floor.startedAt) / 1000);
}

/** The floor's stack, an empty one on a floor written before the stack existed. */
function stackOf(floor) {
    return Array.isArray(floor?.before) ? floor.before : [];
}

/**
 * The seconds the newest debate on the stack had left when it was interrupted, never below zero; null when there is
 * none (a floor from before 1.2.90, or an exchange the API opened with no debate under it).
 */
export function restOf(floor) {
    const entry = [...stackOf(floor)].reverse().find(e => e?.before?.mode === MODES.debate);
    return entry ? Math.max(Number(entry.leftAtObjection) || 0, 0) : null;
}

/** A debate again: the given seconds, else the rest the stack holds, else the floor's own budget (HEAD's answer). */
function debateAgain(floor, seconds, now, gmNote = null) {
    return {
        ...floor,
        mode: MODES.debate,
        holderId: null,
        targetId: null,
        seconds: seconds ?? restOf(floor) ?? floor.seconds ?? TRIAL.speakSeconds,
        startedAt: now,
        pending: false,
        messageId: null,
        before: [],
        gmNote
    };
}

/** The floor closed: an empty floor, and the cards that say so. */
function ended(cards = []) {
    return { floor: null, cards };
}

/**
 * The timed modes' next step, when their clock runs out (`due`) or a GM skips it (`skip`): a pending Objection lapses
 * back to the debate with nothing given back (E79 C16), an Objection's minute becomes the rebuttal, and a rebuttal
 * ends the floor (Dawid, 28.08: the exchange is over and the trial is back in discussion, not in a debate nobody
 * opened). A debate has no next step: it never runs out by itself, and nobody's turn is in it to skip.
 */
function stepOn(floor, now, cards) {
    if (floor.mode === MODES.objection && floor.pending) return { floor: debateAgain(floor, null, now), cards };
    if (floor.mode === MODES.objection) return { floor: { ...floor, mode: MODES.rebuttal, startedAt: now, pending: false, gmNote: null }, cards };
    if (floor.mode === MODES.rebuttal) return ended(cards);
    return { refused: "DRPG.Floor.bar.noTurn" };
}

/** Whose turn a Skip passes over: the objector's minute, the answer's two minutes (the Event card's speaker). */
function turnOf(floor) {
    return floor.mode === MODES.rebuttal ? (floor.targetId ?? floor.holderId) : floor.holderId;
}

/**
 * What `floor` becomes after `event`, at `ctx.now`. Events: `start` { seconds }, `objection` { holderId, targetId,
 * pending, messageId, cardId }, `fill`, `repoint` { targetId }, `rebuttal`, `due`, `skip`, `lapse`, `withdraw`,
 * `adjust` { seconds, signed }, `back` { seconds, note }, `end`, `endMode`. Never mutates `floor`.
 */
export function nextFloor(floor, event = {}, ctx = {}) {
    const now = Number(ctx.now) || 0;
    const type = event?.type;
    if (type === "start") {
        return { floor: {
            active: true, mode: MODES.debate, holderId: null, targetId: null,
            seconds: Number(event.seconds) > 0 ? Number(event.seconds) : TRIAL.speakSeconds,
            startedAt: now, pending: false, messageId: null, before: [], gmNote: null,
            // Left over from the queue the floor used to be: cleared rather than ignored.
            order: null, current: null
        }, cards: [] };
    }
    if (!floor) return { refused: "DRPG.Floor.bar.noMode" };

    switch (type) {
        case "objection": {
            const pending = event.pending === true;
            const entry = {
                messageId: (pending ? event.messageId : event.cardId) ?? null,
                before: { mode: floor.mode, holderId: floor.holderId ?? null, targetId: floor.targetId ?? null, seconds: floor.seconds ?? null },
                leftAtObjection: leftAt(floor, now)
            };
            return { floor: {
                ...floor, mode: MODES.objection, holderId: event.holderId, targetId: event.targetId, startedAt: now,
                pending, messageId: pending ? (event.messageId ?? null) : null, before: [...stackOf(floor), entry], gmNote: null
            }, cards: [] };
        }
        case "fill":
            return { floor: { ...floor, pending: false, startedAt: now, gmNote: null }, cards: [] };
        case "repoint":
            // The entry stays: the Objection is the same one, aimed elsewhere.
            return { floor: { ...floor, targetId: event.targetId }, cards: [] };
        case "rebuttal":
            return { floor: { ...floor, mode: MODES.rebuttal, startedAt: now, pending: false, gmNote: null }, cards: [] };
        case "due":
            return stepOn(floor, now, []);
        case "skip":
            if (floor.mode === MODES.debate) return { refused: "DRPG.Floor.bar.noTurn" };
            return stepOn(floor, now, [{ key: "DRPG.Floor.turnSkipped", actorId: turnOf(floor) }]);
        case "lapse":
        case "withdraw":
            return { floor: debateAgain(floor, null, now), cards: [] };
        case "adjust": {
            const seconds = Number(event.seconds) || 0;
            if (!seconds) return { refused: "DRPG.Floor.bar.noMode" };
            const left = leftAt(floor, now);
            /*
             * NO TIME BELOW ZERO (E70 C1; TR21, the spec's mutant g4). A debate goes down to zero at most, and an
             * overrun one has nothing to take; a timed mode taken to zero or below is its Skip, which is what the GM
             * asked for ("-30 s at 20 s is Skip").
             */
            if (seconds < 0 && floor.mode === MODES.debate && left <= 0) return { refused: "DRPG.Floor.bar.noTime" };
            if (seconds < 0 && floor.mode !== MODES.debate && Math.max(left, 0) + seconds <= 0) {
                return stepOn(floor, now, [{ key: "DRPG.Floor.turnSkipped", actorId: turnOf(floor) }]);
            }
            /*
             * FROM NOW, NOT FROM A CLOCK THAT HAS ALREADY RUN OUT (F9), and past a mode's own length when the GM
             * wants it (TR26 = 1): "how much should be left" is written as the start that leaves it.
             */
            const want = Math.max(Math.max(left, 0) + seconds, 0);
            return { floor: {
                ...floor,
                startedAt: now - (modeSecondsOf(floor) - want) * 1000,
                gmNote: { key: "DRPG.Floor.gmNoteAdjust", seconds, at: now }
            }, cards: [] };
        }
        case "back": {
            const given = Number(event.seconds) > 0 ? Number(event.seconds) : null;
            // A debate restarted with a length the caller named is the API's, as before; without one there is
            // nothing to go back to.
            if (floor.mode === MODES.debate && given === null) return { refused: "DRPG.Floor.bar.inDebate" };
            return { floor: debateAgain(floor, given, now, event.note ? { key: "DRPG.Floor.gmNoteBack", at: now } : null), cards: [] };
        }
        case "end":
            return ended();
        case "endMode":
            /* END THIS MODE (TR21; TR11 = 1): a debate's end closes it, and an Objection or a rebuttal ended by the
               GM ends the floor as a rebuttal's own end does - the exchange is over, the trial is in discussion. */
            return ended([{ key: "DRPG.Floor.modeEnded", mode: floor.mode }]);
        default:
            return { refused: "DRPG.Floor.bar.noMode" };
    }
}
