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
 * closed), and `cards` the chat cards the step posts, each `{ key, actorId?, mode? }`, worded on the poster's side,
 * and `again: true` on a floor its exchange closed (E70 C3, `ended`); or `{ refused: <a DRPG key> }`, the reason a GM's greyed button shows (trial-floor-ui.mjs `trialBar` asks the same
 * rows, so a dead button says its own op's reason).
 *
 * THE STACK (`before`): every Objection pushes `{ messageId, before, leftAtObjection }` - the floor it interrupted
 * (its mode, holder, target and budget) and that floor's seconds left - and a rebuttal keeps it. Back to the debate
 * gives the newest debate on it the seconds it had left (TR31: "Back to the debate gives the rest"), not its whole
 * budget again; a floor written before 1.2.90 has no stack and gets its `seconds`, as before. A debate has nothing
 * under it, so every write of a debate empties the stack. The Overrule (C2) takes the top off it (`overrule`).
 */

import { TRIAL } from "./config.mjs";

/**
 * The floor's modes, spelled once (trial-floor.mjs `FLOOR_MODES` is this object): the debate and its exchange, and since
 * E70 C7 the two rounds, Testimony and Panic Round (S18-72), whose speaker is the round's, one after another.
 */
export const MODES = Object.freeze({ debate: "debate", objection: "objection", rebuttal: "rebuttal", testimony: "testimony", panic: "panic" });

/*
 * THE ROUNDS (E70 C7, 28.10.2026; S18-72; the owner's TR6 "Zeznanie - maks 2 minuty na osobe. Nie 3.", TR14 = 3, of
 * 27.10 "Skrocmy proponowane testimony do 1 minuty", and Panic Round "10-15 sekund maks"). A round is a floor whose
 * speaker is one participant at a time, in an order frozen at its start: `round` `{ mode, order, index, step, seconds,
 * openedAt }`
 * - the mode the round is, the actors in order, whose turn it is, the step (every move of the round counts one, so a
 * participant's Done, Pass or step over names the step it was meant for and a late one changes nothing - "trial.turn",
 * trial-modes.mjs `turnOnPrimary`) and the turn's length. The round stays on the floor through an Objection's
 * exchange (every row spreads the floor), so the exchange's end can resume it.
 */
export const ROUND_MODES = Object.freeze([MODES.testimony, MODES.panic]);

/** Whether `mode` is a round's: Testimony or Panic Round. */
export function isRoundMode(mode) {
    return ROUND_MODES.includes(mode);
}

/**
 * A round mode's turn range, `{ min, max }` in seconds (config.mjs `TRIAL.modes.round`), or null for any other mode: the
 * start is held to it (TR26 = 1: a start limit guards the start and the API only - +30 s during a turn may pass it).
 */
export function turnRange(mode) {
    const row = TRIAL.modes?.round?.[mode];
    return row ? { min: Number(row.min) || 0, max: Number(row.max) || 0 } : null;
}

/** The floor's round, or null: on a round's own mode, and under its exchange. */
function roundOf(floor) {
    const round = floor?.round;
    return round && isRoundMode(round.mode) && Array.isArray(round.order) ? round : null;
}

/**
 * The round's turn at `from` or after: the first speaker whose owner is connected (`absent` lists the actors with none -
 * the step's caller reads the users), each passed over told as passing ("{name} passes.", E70-45); none left ends the
 * round with its card. `step` is the step the new turn is.
 */
function turnAt(floor, round, from, now, cards, absent, step) {
    const out = [...cards];
    const away = new Set(Array.isArray(absent) ? absent : []);
    for (let i = from; i < round.order.length; i++) {
        const id = round.order[i];
        if (away.has(id)) {
            out.push({ key: "DRPG.Floor.round.passes", actorId: id, title: `DRPG.Floor.mode.${round.mode}` });
            continue;
        }
        return { floor: {
            ...floor, mode: round.mode, holderId: id, targetId: null, seconds: round.seconds ?? floor.seconds, startedAt: now,
            pending: false, messageId: null, before: [], gmNote: null, round: { ...round, index: i, step }
        }, cards: out };
    }
    return { floor: null, cards: [...out, { key: "DRPG.Floor.round.over", mode: round.mode, title: `DRPG.Floor.mode.${round.mode}` }] };
}

/** The next speaker's turn: the queue goes on (a turn done, passed, run out or skipped; an exchange in it over). */
function nextTurn(floor, now, cards, ctx) {
    const round = roundOf(floor);
    return turnAt(floor, round, (Number(round.index) || 0) + 1, now, cards, ctx?.absent, (Number(round.step) || 0) + 1);
}

/**
 * The interrupted speaker again, with the seconds the turn had when the Objection cut in (the stack's round entry,
 * `leftAtObjection`): an Objection that lapsed or was withdrawn, Back to the round, as an Overrule gives it (TR25).
 */
function speakerAgain(floor, now, gmNote = null) {
    const round = roundOf(floor);
    const entry = stackOf(floor).find(e => isRoundMode(e?.before?.mode)) ?? null;
    const was = entry?.before ?? { mode: round.mode, holderId: round.order[round.index] ?? null, seconds: round.seconds };
    const back = {
        ...floor, mode: was.mode, holderId: was.holderId ?? null, targetId: null, seconds: was.seconds ?? round.seconds,
        pending: false, messageId: null, before: [], gmNote, round: { ...round, step: (Number(round.step) || 0) + 1 }
    };
    back.startedAt = now - (modeSecondsOf(back) - Math.max(Number(entry?.leftAtObjection) || 0, 0)) * 1000;
    return { floor: back, cards: [] };
}

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
        gmNote,
        round: null
    };
}

/**
 * The floor closed: an empty floor, and the cards that say so. `again` marks an end by the exchange (E70 C3; TR11 = 1):
 * a rebuttal over, or an Objection or a rebuttal the GM ended - the debate it cut into is over with it, and the
 * console's next step is "Open the debate again" with its question and budget (trial-floor.mjs `commitFloor` writes
 * the record's `debateAgain` from it). A debate the GM closes or ends is not marked: the GM meant it.
 */
function ended(cards = [], again = false) {
    return again ? { floor: null, cards, again: true } : { floor: null, cards };
}

/**
 * THE DEBATE'S QUESTION (E70 C3, 27.10.2026; S18-70). Optional, the GM's own words: a string trimmed and cut to
 * `TRIAL.modes.topicLength`, else null - nothing else is a question. On the floor from the debate's `start`, and kept by
 * every row that spreads the floor (an Objection, its rebuttal, Back to the debate, an Overrule), so the cards of the
 * exchange read the question of the debate they cut into; gone with the floor, kept in the trial record (vote.mjs).
 */
export function topicOf(value) {
    if (typeof value !== "string") return null;
    const text = value.trim().slice(0, Number(TRIAL.modes?.topicLength) || 200).trim();
    return text || null;
}

/**
 * The timed modes' next step, when their clock runs out (`due`) or a GM skips it (`skip`): a pending Objection lapses
 * back to the debate with nothing given back (E79 C16), an Objection's minute becomes the rebuttal, and a rebuttal
 * ends the floor (Dawid, 28.08: the exchange is over and the trial is back in discussion, not in a debate nobody
 * opened). A debate has no next step: it never runs out by itself, and nobody's turn is in it to skip.
 */
function stepOn(floor, now, cards, ctx = {}) {
    const inRound = Boolean(roundOf(floor));
    if (floor.mode === MODES.objection && floor.pending) return inRound ? { ...speakerAgain(floor, now), cards } : { floor: debateAgain(floor, null, now), cards };
    if (floor.mode === MODES.objection) return { floor: { ...floor, mode: MODES.rebuttal, startedAt: now, pending: false, gmNote: null }, cards };
    // A rebuttal in a round resumes the queue at the next speaker (E70-42), the due tick's road and Skip's alike.
    if (floor.mode === MODES.rebuttal) return inRound ? nextTurn(floor, now, cards, ctx) : ended(cards, true);
    if (isRoundMode(floor.mode) && inRound) return nextTurn(floor, now, cards, ctx);
    return { refused: "DRPG.Floor.bar.noTurn" };
}

/** Whose turn a Skip passes over: the objector's minute, the answer's two minutes (the Event card's speaker). */
function turnOf(floor) {
    return floor.mode === MODES.rebuttal ? (floor.targetId ?? floor.holderId) : floor.holderId;
}

/**
 * WHICH OBJECTION AN OVERRULE NAMES, AND WHETHER IT MAY (E70 C2, 27.10.2026; TR35: only the newest not overruled;
 * E70-10, E70-11). Pure, as `nextFloor` is: `floor` as `trialFloor()` reads it, `objections` the trial record's receipts
 * (vote.mjs `trialProgress().objections`, by card: `{ objectorId, targetId, paid, mode, trialStartedAt,
 * leftAtObjection, debateLeft, at, overruled }`, written by the primary from the price it took - trial.mjs
 * `keepReceipt`), `trialStartedAt` the running trial's stamp, `messageId` the card the GM named or null for "the
 * newest", `running` whether a Class Trial is in session. Answers `{ messageId, receipt, during }` or `{ refused }`:
 *   - while an Objection or its rebuttal holds the floor (`during`), only that one: the stack's top, the card it was
 *     raised on, its receipt if it has one - an Objection the API opened has none and is overruled from the stack alone;
 *   - after its exchange, the newest receipt of this trial not yet overruled: an older one, one overruled already, a
 *     card with no receipt (refused, withdrawn, never one) or another trial's is refused, and so is every one once the
 *     trial is over. A card deleted since blocks nothing: the receipt is the record, never the card.
 */
export function overruleTarget({ floor = null, objections = {}, trialStartedAt = null, messageId = null, running = true } = {}) {
    if (!running) return { refused: "DRPG.Floor.overrule.trialOver" };
    const receipts = objections && typeof objections === "object" ? objections : {};
    if (floor && floor.mode !== MODES.debate) {
        const top = stackOf(floor).at(-1)?.messageId ?? floor.messageId ?? null;
        if (messageId && messageId !== top) return { refused: "DRPG.Floor.overrule.onlyNewest" };
        return { messageId: top, receipt: (top && receipts[top]) || null, during: true };
    }
    const sameTrial = r => (r?.trialStartedAt ?? null) === (trialStartedAt ?? null);
    const newest = Object.entries(receipts)
        .filter(([, r]) => r && sameTrial(r) && !r.overruled)
        .sort((a, b) => (Number(b[1].at) || 0) - (Number(a[1].at) || 0))[0] ?? null;
    if (messageId) {
        const receipt = receipts[messageId] ?? null;
        if (receipt && !sameTrial(receipt)) return { refused: "DRPG.Floor.overrule.trialOver" };
        if (!receipt || receipt.overruled || newest?.[0] !== messageId) return { refused: "DRPG.Floor.overrule.onlyNewest" };
        return { messageId, receipt, during: false };
    }
    if (!newest) return { refused: "DRPG.Floor.bar.noOverrule" };
    return { messageId: newest[0], receipt: newest[1], during: false };
}

/**
 * What `floor` becomes after `event`, at `ctx.now`. Events: `start` { seconds, topic }, `round` { mode, seconds, order },
 * `objection` { holderId, targetId, pending, messageId, cardId }, `fill`, `repoint` { targetId }, `rebuttal`, `due`,
 * `skip`, `lapse`, `withdraw`, `adjust` { seconds, signed }, `back` { seconds, note }, `overrule`, `end`, `endMode`, and a
 * round's `done` / `pass` { actorId, step }, `over` { step } and `gone` { actorId }. `ctx.absent`: the actors whose owner
 * is not connected (a round passes them, E70-45). Never mutates `floor`.
 */
export function nextFloor(floor, event = {}, ctx = {}) {
    const now = Number(ctx.now) || 0;
    const type = event?.type;
    if (type === "start") {
        return { floor: {
            active: true, mode: MODES.debate, holderId: null, targetId: null,
            seconds: Number(event.seconds) > 0 ? Number(event.seconds) : TRIAL.speakSeconds,
            startedAt: now, pending: false, messageId: null, before: [], gmNote: null, topic: topicOf(event.topic),
            // Left over from the queue the floor used to be: cleared rather than ignored.
            order: null, current: null, round: null
        }, cards: [] };
    }
    if (type === "round") {
        /*
         * A ROUND OPENS (E70 C7; E70-40, E70-41, E70-43): on no floor or on a debate, never inside an exchange or another
         * round; its turn held to the mode's range (`turnRange`: Testimony 30-120 s, Panic Round 10-15 s), here and so on
         * every road - the start window, the API, a GM's packet; the order as the caller froze it (trial-modes.mjs
         * `roundOrder`: the trial's participants), once each; the first speaker with an owner connected.
         */
        if (!isRoundMode(event.mode)) return { refused: "DRPG.Floor.bar.noMode" };
        if (floor && floor.mode !== MODES.debate) return { refused: "DRPG.Floor.round.busy" };
        const range = turnRange(event.mode);
        const seconds = Math.round(Number(event.seconds) || 0);
        if (seconds < range.min) return { refused: "DRPG.Floor.round.tooShort" };
        if (seconds > range.max) return { refused: "DRPG.Floor.round.tooLong" };
        const order = [...new Set((Array.isArray(event.order) ? event.order : []).filter(id => typeof id === "string" && id))];
        const base = { active: true, pending: false, messageId: null, before: [], gmNote: null, topic: null, order: null, current: null };
        // `openedAt` names this round (trial-modes.mjs `turnOnPrimary` keys a sender's step over by it).
        const opened = turnAt(base, { mode: event.mode, order, index: -1, step: 0, seconds, openedAt: now }, 0, now, [], ctx.absent, 1);
        return opened.floor ? opened : { refused: "DRPG.Floor.round.nobody" };
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
            return stepOn(floor, now, [], ctx);
        case "skip":
            if (floor.mode === MODES.debate) return { refused: "DRPG.Floor.bar.noTurn" };
            return stepOn(floor, now, [{ key: "DRPG.Floor.turnSkipped", actorId: turnOf(floor) }], ctx);
        case "lapse":
        case "withdraw":
            // In a round's exchange the speaker gets the turn's rest back, as the debate gets its rest (E79 C16).
            return roundOf(floor) ? speakerAgain(floor, now) : { floor: debateAgain(floor, null, now), cards: [] };
        case "done":
        case "pass":
        case "over":
        case "gone": {
            /*
             * A STEP OF THE ROUND FROM A PARTICIPANT'S BROWSER (E70 C7; E70-44, E70-45; S06-38). Done and Pass are the
             * speaker's alone; a step over is anybody's, once the turn has run out on this clock but for a second's grace
             * (`TRIAL.modes.round.graceSeconds`: a browser counting from the same stamp may round a second early); each
             * names the step it is for, so the first that matches moves the round and every later one finds the next
             * step - seven browsers' step overs move it once. A speaker gone (no owner connected) passes. The GM's clock
             * is the backstop: the heartbeat's `due` above.
             */
            const round = roundOf(floor);
            if (!round || !isRoundMode(floor.mode)) return { refused: "DRPG.Floor.round.noTurn" };
            if (type !== "gone" && Number(event.step) !== Number(round.step)) return { refused: "DRPG.Floor.round.stale" };
            if (type !== "over" && event.actorId !== floor.holderId) return { refused: "DRPG.Floor.round.notSpeaker" };
            const grace = (Number(TRIAL.modes?.round?.graceSeconds) || 0) * 1000;
            if (type === "over" && modeSecondsOf(floor) * 1000 - (now - (Number(floor.startedAt) || 0)) > grace) return { refused: "DRPG.Floor.round.notDue" };
            const told = type === "pass" || type === "gone" ? [{ key: "DRPG.Floor.round.passes", actorId: floor.holderId, title: `DRPG.Floor.mode.${round.mode}` }] : [];
            return nextTurn(floor, now, told, ctx);
        }
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
                return stepOn(floor, now, [{ key: "DRPG.Floor.turnSkipped", actorId: turnOf(floor) }], ctx);
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
            // A round has no debate to go back to; in its exchange, Back gives the speaker the turn's rest (E70 C7).
            if (isRoundMode(floor.mode)) return { refused: "DRPG.Floor.bar.inRound" };
            if (roundOf(floor)) return speakerAgain(floor, now);
            return { floor: debateAgain(floor, given, now, event.note ? { key: "DRPG.Floor.gmNoteBack", at: now } : null), cards: [] };
        }
        case "overrule": {
            /*
             * OVERRULE (E70 C2, 27.10.2026; TR25: "koszt ma zostac, ale do glosu ma wrocic osoba (lub tryb), wobec
             * ktorej padlo objection z czasem, jaki jej wtedy pozostal"). The Objection on top of the stack is taken
             * off it, and the floor it interrupted comes back - its mode, holder and target - with the seconds it had
             * left then (`leftAtObjection`, as it was: a debate overrun stays overrun), not with its whole length. The
             * price is not this function's: nothing here or in the step that asks it gives anything back. A floor with
             * no stack (written before 1.2.90) has nothing recorded to go back to and gets the debate with its budget,
             * as Back to the debate gives it. Inside a debate there is no Objection to overrule.
             */
            if (floor.mode === MODES.debate) return { refused: "DRPG.Floor.bar.noOverrule" };
            const note = { key: "DRPG.Floor.gmNoteOverrule", at: now };
            const stack = stackOf(floor);
            const entry = stack.at(-1);
            if (!entry?.before) return { floor: debateAgain(floor, null, now, note), cards: [] };
            const was = entry.before;
            // A round's speaker brought back (E70 C7; E70-46): the turn's rest, nothing under it, and the next step.
            if (isRoundMode(was.mode) && roundOf(floor)) return speakerAgain(floor, now, note);
            const back = {
                ...floor,
                mode: was.mode ?? MODES.debate,
                holderId: was.holderId ?? null,
                targetId: was.targetId ?? null,
                seconds: was.seconds ?? floor.seconds,
                pending: false,
                messageId: null,
                // A debate has nothing under it; a rebuttal brought back keeps the Objection it answers.
                before: (was.mode ?? MODES.debate) === MODES.debate ? [] : stack.slice(0, -1),
                gmNote: note
            };
            back.startedAt = now - (modeSecondsOf(back) - (Number(entry.leftAtObjection) || 0)) * 1000;
            return { floor: back, cards: [] };
        }
        case "end":
            return ended();
        case "endMode":
            /* END THIS MODE (TR21; TR11 = 1): a debate's end closes it, and an Objection or a rebuttal ended by the
               GM ends the floor as a rebuttal's own end does - the exchange is over, the trial is in discussion. A round
               ended ends it (E70 C7); an exchange in a round ended resumes the queue, as its rebuttal's end would. */
            if (isRoundMode(floor.mode)) return ended([{ key: "DRPG.Floor.modeEnded", mode: floor.mode }]);
            if (roundOf(floor)) return nextTurn(floor, now, [{ key: "DRPG.Floor.modeEnded", mode: floor.mode }], ctx);
            return ended([{ key: "DRPG.Floor.modeEnded", mode: floor.mode }], floor.mode !== MODES.debate);
        default:
            return { refused: "DRPG.Floor.bar.noMode" };
    }
}
