/**
 * Danganronpa RPG - the three zone modes of the Class Trial as rows of the floor's one engine (E73 C3-C5, 12.11.2026).
 * ---------------------------------------------------------------------------
 * PURE, as floor-machine.mjs is: `zoneStep(floor, event, ctx)` answers what a zone mode's floor becomes after an event,
 * the cards that tell the table, what the trial's record keeps of it (`zoneRecord`) and what the GMs' store of Logic
 * Dive sets keeps (`dive`) - or `{ refused }`. It reads no setting, actor or clock: the primary GM's step of trial.mjs
 * `SEIZE_KEY` reads the sides (trial-zones.mjs `sidesNow`) and, for Logic Dive, the question's truth from the GMs' store,
 * hands them in `ctx`, and writes the answer (trial-floor.mjs `commitFloor`). floor-machine.mjs `nextFloor` hands every
 * event on a zone mode's floor here, and the start (`zone`), so the heartbeat, the GM's bar and the API move the modes
 * by the same rows. Imports config.mjs alone: floor-machine.mjs reads its modes from here, not the other way round
 * (R161).
 *
 * THE MODES (the owner's TR1 = 2, TR2 = 1, TR3 = 2, TR27, TR32 = 2; docs/dev/e73/STATUS.md C0). A zone mode's floor is
 * `{ mode, seconds, startedAt, holderId, zone }`, `zone` `{ phase, question, answers: { a, b }, picks, stands, openedAt,
 * step, ... }`:
 *   straw  Straw Poll. `vote` for 45 s; the clock or Count now counts the sides once: the larger side with at least two
 *          thirds of those counted is a Finding ("The class thinks: {answer}"), anything less a split ("The class is
 *          split: A {a}, B {b}") whose next step is Scrum Debate (`zoneRecord.strawPoll.split`).
 *   dive   Logic Dive, one question of a set at a time (`set { id, index, total }`). `vote` for 60 s - closed early by
 *          Count now, or once everybody taking part stands on one side after `earlyAfterSeconds` - then `pause` 5 s with
 *          the count on the floor, then the judgement against the truth the step hands in (`ctx.truth`, never on the
 *          floor): right -> the next question (`ctx.next`) or, after the last, the set's Finding; wrong, or a tie (0:0
 *          too), ends the set and shows no truth (TR3, TR27). Skip question goes on with no answer kept.
 *   scrum  Scrum Debate. `setup` 45 s for the camps to form; then `speak`: 2 x the larger camp's turns, the smaller camp
 *          first, the camps in turn and each camp's speakers in rotation, `scrumTurnSeconds` each; anybody may cross
 *          (each turn's speaker is taken from the camp as it stands then); an empty camp ends it, the other camp's
 *          answer a Finding; after the last turn the camps are told and no Finding is made (TR3 = 2).
 * Every end - its own, End this mode, the vote's opening - leaves no floor; the trial's discussion follows, and the
 * step puts every participant's hall token back on its stand (trial-zones.mjs `returnToStands`).
 */

import { TRIAL } from "./config.mjs";

/** The three zone modes, spelled once; floor-machine.mjs `MODES` spreads them in. */
export const ZONE_MODES = Object.freeze({ straw: "straw", dive: "dive", scrum: "scrum" });

/** Whether `mode` is a zone mode. */
export function isZoneMode(mode) {
    return Object.values(ZONE_MODES).includes(mode);
}

/** The floor's zone object, or null: on a zone mode's floor only. */
export function zoneOf(floor) {
    const zone = floor?.zone;
    return floor && isZoneMode(floor.mode) && zone && typeof zone === "object" && typeof zone.phase === "string" ? zone : null;
}

/** The zone modes' numbers (config.mjs `TRIAL.modes.zones`). */
function cfg() {
    return TRIAL.modes?.zones ?? {};
}

/** The counts of `sides` ({ a: [ids], b: [ids] }), as numbers. */
export function countsOf(sides) {
    const n = side => (Array.isArray(sides?.[side]) ? sides[side].length : 0);
    return { a: n("a"), b: n("b") };
}

/**
 * THE STRAW POLL'S RULE (TR3 = 2, the plan's 2/3; R3907): the larger side when it holds at least two thirds of those
 * counted (`3 * larger >= 2 * counted`, whole numbers, no rounding), else a split. Nobody counted is a split too.
 * `{ answer: "a" | "b" | null, split }`.
 */
export function strawVerdict(counts) {
    const a = Math.max(Number(counts?.a) || 0, 0), b = Math.max(Number(counts?.b) || 0, 0);
    const total = a + b;
    const larger = a >= b ? "a" : "b";
    if (total > 0 && a !== b && 3 * Math.max(a, b) >= 2 * total) return { answer: larger, split: false };
    return { answer: null, split: true };
}

/**
 * LOGIC DIVE'S JUDGEMENT (TR3 = 2, TR27: simple majority; a tie, 0:0 too, is wrong; R3910): "right" when the larger side
 * is `truth`, "tie" when the sides are equal, else "wrong". A truth that is neither side judges every answer wrong.
 */
export function diveVerdict(counts, truth) {
    const a = Math.max(Number(counts?.a) || 0, 0), b = Math.max(Number(counts?.b) || 0, 0);
    if (a === b) return "tie";
    return (a > b ? "a" : "b") === truth ? "right" : "wrong";
}

/** Scrum Debate's turns: twice the larger camp (the plan's C5). */
export function scrumTurns(a, b) {
    return 2 * Math.max(Math.max(Number(a) || 0, 0), Math.max(Number(b) || 0, 0));
}

/**
 * A Scrum turn's seconds (`scrumTurnSeconds`; R3913): the debate's budget (`budgetSeconds`, 300) over its turns, held
 * between `minTurn` (20) and `maxTurn` (40). 3:2 -> 40 s, 4:3 -> 37.5 s, 8:7 and 10:5 -> 20 s. 0 with nobody in a camp.
 */
export function scrumTurnSeconds(a, b) {
    const turns = scrumTurns(a, b);
    if (!turns) return 0;
    const row = cfg().scrum ?? {};
    const budget = Number(row.budgetSeconds) || 300, min = Number(row.minTurn) || 20, max = Number(row.maxTurn) || 40;
    return Math.min(Math.max(budget / turns, min), max);
}

/** The other side. */
function other(side) {
    return side === "a" ? "b" : "a";
}

/** A zone mode's question or answer as the GM typed it: a string trimmed and cut to `length`, else null. */
export function zoneText(value, length) {
    if (typeof value !== "string") return null;
    const text = value.trim().slice(0, Number(length) || 200).trim();
    return text || null;
}

/** A card of the step, titled by its mode. */
function card(mode, key, words = {}, extra = {}) {
    return { key, title: `DRPG.Floor.mode.${mode}`, mode, words, ...extra };
}

/** The floor's seconds left at `now`, as floor-machine.mjs `leftAt` counts them. */
function leftOf(floor, now) {
    return Math.round((Number(floor.seconds) || 0) - (now - (Number(floor.startedAt) || 0)) / 1000);
}

/** The floor ended: no floor, the cards, and what the record and the GMs' store keep. */
function over(cards, { zoneRecord = null, dive = null } = {}) {
    return { floor: null, cards, ...(zoneRecord ? { zoneRecord } : {}), ...(dive ? { dive } : {}), zoneEnded: true };
}

/** The same zone floor in a new phase from `now`, `seconds` long, with `patch` on its zone and `top` on the floor. */
function phase(floor, name, seconds, now, patch = {}, top = {}) {
    const zone = zoneOf(floor);
    return { ...floor, ...top, seconds, startedAt: now, gmNote: null, zone: { ...zone, ...patch, phase: name, step: (Number(zone.step) || 0) + 1 } };
}

/**
 * A ZONE MODE STARTS (`{ type: "zone", mode, question, answers: { a, b }, seconds?, set?, thesis? }`): on no floor or on
 * an open debate, never inside an exchange, a round, the Closing or another zone mode; with two answers (a Logic Dive
 * question's come from its set); the stands the step read (`ctx.stands`) and the sides as they are (`ctx.sides`, for a
 * Scrum's start, nothing else).
 */
export function zoneStart(floor, event, ctx = {}) {
    const now = Number(ctx.now) || 0;
    const mode = event?.mode;
    if (!isZoneMode(mode)) return { refused: "DRPG.Floor.bar.noMode" };
    if (floor && floor.mode !== "debate") return { refused: "DRPG.Zones.busy" };
    if (ctx.zonesReady === false) return { refused: "DRPG.Zones.noZones" };
    const len = cfg();
    const answers = { a: zoneText(event.answers?.a, len.answerLength), b: zoneText(event.answers?.b, len.answerLength) };
    if (!answers.a || !answers.b) return { refused: "DRPG.Zones.noAnswers" };
    const question = zoneText(event.question, len.questionLength);
    if (mode === ZONE_MODES.dive && !question) return { refused: "DRPG.Zones.noQuestion" };
    const set = mode === ZONE_MODES.dive ? { id: String(event.set?.id ?? ""), index: Math.max(Number(event.set?.index) || 0, 0),
        total: Math.max(Number(event.set?.total) || 1, 1) } : null;
    if (set && !set.id) return { refused: "DRPG.Zones.noSet" };
    const seconds = mode === ZONE_MODES.straw ? Number(len.straw?.seconds) || 45
        : mode === ZONE_MODES.dive ? Number(len.dive?.seconds) || 60 : Number(len.scrum?.setupSeconds) || 45;
    const zone = {
        phase: mode === ZONE_MODES.scrum ? "setup" : "vote", question, answers, picks: {}, stands: ctx.stands ?? {}, openedAt: now, step: 1,
        counts: null, set, thesis: mode === ZONE_MODES.scrum ? zoneText(event.thesis, len.scrum?.thesisLength) : null,
        turn: 0, turns: 0, turnSeconds: 0, first: null, spoke: { a: 0, b: 0 }, theses: []
    };
    return { floor: {
        active: true, mode, holderId: null, targetId: null, seconds, startedAt: now, pending: false, messageId: null, before: [], gmNote: null,
        topic: null, order: null, current: null, round: null, closing: null, zone
    }, cards: [] };
}

/** Whether everybody counted stands on one side and nobody taking part is left out: Logic Dive's early close. */
export function unanimous(sides, participants) {
    const c = countsOf(sides);
    const total = Math.max(Number(participants) || 0, 0);
    return total > 0 && (c.a === total || c.b === total);
}

/** A Straw Poll counted: its Finding or its split, the floor ended. */
function strawCount(floor, ctx) {
    const zone = zoneOf(floor);
    const counts = countsOf(ctx.sides);
    const verdict = strawVerdict(counts);
    const words = { a: String(counts.a), b: String(counts.b), answer: verdict.answer ? zone.answers[verdict.answer] : "" };
    if (verdict.split) {
        return over([card(floor.mode, "DRPG.Zones.straw.split", words, { sfx: "strawPollResult" })],
            { zoneRecord: { strawPoll: { split: true, ...counts, question: zone.question } } });
    }
    return over([card(floor.mode, "DRPG.Zones.straw.finding", words, { sfx: "strawPollResult" })],
        { zoneRecord: { strawPoll: { split: false, ...counts, question: zone.question },
            finding: { text: zone.answers[verdict.answer], question: zone.question, mode: floor.mode, side: verdict.answer, ...counts } } });
}

/** Logic Dive's question counted: the pause with the count on the floor. */
function diveCount(floor, ctx, now) {
    const counts = countsOf(ctx.sides);
    return { floor: phase(floor, "pause", Number(cfg().dive?.pauseSeconds) || 5, now, { counts }), cards: [] };
}

/**
 * Logic Dive's question judged at the pause's end: `ctx.truth` the side the GMs hold true, `ctx.next` the set's next
 * question `{ question, answers, index }` or null, `ctx.conclusion` the set's Finding text or null.
 */
function diveJudge(floor, ctx, now) {
    const zone = zoneOf(floor);
    const counts = zone.counts ?? { a: 0, b: 0 };
    const verdict = diveVerdict(counts, ctx.truth);
    const words = { a: String(counts.a), b: String(counts.b), n: String((zone.set?.index ?? 0) + 1), total: String(zone.set?.total ?? 1) };
    const at = { setId: zone.set?.id ?? null, index: zone.set?.index ?? 0 };
    if (verdict !== "right") {
        return over([card(floor.mode, verdict === "tie" ? "DRPG.Zones.dive.tie" : "DRPG.Zones.dive.wrong", words, { sfx: "answerWrong" })],
            { dive: { ...at, outcome: verdict } });
    }
    const right = card(floor.mode, "DRPG.Zones.dive.right", words, { sfx: "answerRight" });
    if (ctx.next && ctx.next.question) return diveQuestion(floor, ctx.next, now, [right]);
    const text = zoneText(ctx.conclusion, cfg().answerLength * 3) ?? zone.answers[ctx.truth];
    return over([right, card(floor.mode, "DRPG.Zones.dive.solved", { finding: text })],
        { dive: { ...at, outcome: "solved" }, zoneRecord: { finding: { text, question: zone.question, mode: floor.mode, setId: at.setId, ...counts } } });
}

/** The set's next question on the floor, the vote's clock from `now`. */
function diveQuestion(floor, next, now, cards = []) {
    const zone = zoneOf(floor);
    const len = cfg();
    const answers = { a: zoneText(next.answers?.a, len.answerLength), b: zoneText(next.answers?.b, len.answerLength) };
    const question = zoneText(next.question, len.questionLength);
    if (!question || !answers.a || !answers.b) return over(cards, { dive: { setId: zone.set?.id ?? null, index: Number(next.index) || 0, outcome: "broken" } });
    const seconds = Number(len.dive?.seconds) || 60;
    const index = Math.max(Number(next.index) || 0, 0);
    // The next question told as the first was (trial-floor.mjs `zoneStartInStep`'s card): its words and both answers.
    const told = card(floor.mode, "DRPG.Zones.dive.opened", { question, a: answers.a, b: answers.b, n: String(index + 1),
        total: String(zone.set?.total ?? 1), seconds: String(seconds) });
    return { floor: phase(floor, "vote", seconds, now, { question, answers, counts: null, set: { ...zone.set, index } }), cards: [...cards, told] };
}

/** Scrum Debate's next turn: turn `turn` of the camp it falls to, its next speaker as the camp stands now. */
function scrumTurn(floor, ctx, now, cards = []) {
    const zone = zoneOf(floor);
    const turn = Number(zone.turn) || 0;
    const counts = countsOf(ctx.sides);
    if (turn >= (Number(zone.turns) || 0)) {
        return over([...cards, card(floor.mode, "DRPG.Zones.scrum.over", { a: String(counts.a), b: String(counts.b) })]);
    }
    const empty = ["a", "b"].find(side => counts[side] === 0);
    if (empty) return scrumEmpty(floor, empty, counts, cards);
    const side = turn % 2 === 0 ? zone.first : other(zone.first);
    const members = ctx.sides[side];
    const spoke = Number(zone.spoke?.[side]) || 0;
    const speaker = members[spoke % members.length];
    return { floor: phase(floor, "speak", zone.turnSeconds, now, { turn: turn + 1, side, spoke: { ...zone.spoke, [side]: spoke + 1 } },
        { holderId: speaker }), cards };
}

/** A camp emptied: the Scrum ends, the other camp's answer the Finding. */
function scrumEmpty(floor, empty, counts, cards = []) {
    const zone = zoneOf(floor);
    const won = other(empty);
    const text = zone.answers[won];
    return over([...cards, card(floor.mode, "DRPG.Zones.scrum.empty", { zone: empty.toUpperCase(), answer: text })],
        { zoneRecord: { finding: { text, question: zone.question, mode: floor.mode, side: won, ...counts } } });
}

/** Scrum Debate's setup over: the camps as they stand fix the turns and their length; the smaller camp speaks first. */
function scrumBegin(floor, ctx, now) {
    const counts = countsOf(ctx.sides);
    const empty = ["a", "b"].find(side => counts[side] === 0);
    if (empty) return scrumEmpty(floor, empty, counts);
    const first = counts.b < counts.a ? "b" : "a";
    const zone = zoneOf(floor);
    const begun = { ...floor, zone: { ...zone, turns: scrumTurns(counts.a, counts.b), turnSeconds: scrumTurnSeconds(counts.a, counts.b), first, turn: 0 } };
    const told = card(floor.mode, "DRPG.Zones.scrum.begins", { zone: first.toUpperCase(), turns: String(begun.zone.turns),
        seconds: String(Math.round(begun.zone.turnSeconds * 10) / 10) });
    return scrumTurn(begun, ctx, now, [told]);
}

/** The phase's own move when its clock runs out, or when a GM's Count now or Skip brings it forward. */
function zoneDue(floor, ctx, now, { skip = false } = {}) {
    const zone = zoneOf(floor);
    if (floor.mode === ZONE_MODES.straw) return strawCount(floor, ctx);
    if (floor.mode === ZONE_MODES.dive) return zone.phase === "vote" ? diveCount(floor, ctx, now) : diveJudge(floor, ctx, now);
    if (zone.phase === "setup") return scrumBegin(floor, ctx, now);
    const skipped = skip && floor.holderId ? [{ key: "DRPG.Floor.turnSkipped", actorId: floor.holderId }] : [];
    return scrumTurn(floor, ctx, now, skipped);
}

/**
 * WHAT A ZONE MODE'S FLOOR BECOMES AFTER `event` (floor-machine.mjs `nextFloor` hands it every event on such a floor).
 * `ctx`: `now`; `sides` { a, b } (actor ids, the step's `sidesNow`); `participants` how many take part; for Logic Dive's
 * judgement `truth`, `next`, `conclusion`. Events: `due` (the clock, or early: Logic Dive's unanimity after its grace,
 * Scrum's empty camp), `count` (Count now), `skip`, `skipQuestion`, `adjust` { seconds }, `pick` { actorId, side },
 * `thesis` { actorId, text }, `endMode`, `end`.
 */
export function zoneStep(floor, event = {}, ctx = {}) {
    const now = Number(ctx.now) || 0;
    const zone = zoneOf(floor);
    if (!zone) return { refused: "DRPG.Floor.bar.noMode" };
    const type = event?.type;
    const sides = { a: Array.isArray(ctx.sides?.a) ? ctx.sides.a : [], b: Array.isArray(ctx.sides?.b) ? ctx.sides.b : [] };
    const c = { ...ctx, sides };
    switch (type) {
        case "due": {
            const left = leftOf(floor, now);
            if (left > 0) {
                // Early only where the mode closes early: Logic Dive's vote, everybody on one side past the grace;
                // a Scrum turn whose camp has emptied (or the other's).
                const grace = Number(cfg().dive?.earlyAfterSeconds) || 10;
                const ran = (now - (Number(floor.startedAt) || 0)) / 1000;
                if (floor.mode === ZONE_MODES.dive && zone.phase === "vote" && ran >= grace && unanimous(sides, ctx.participants)) return zoneDue(floor, c, now);
                const counts = countsOf(sides);
                if (floor.mode === ZONE_MODES.scrum && zone.phase === "speak" && (counts.a === 0 || counts.b === 0)) {
                    return scrumEmpty(floor, counts.a === 0 ? "a" : "b", counts);
                }
                return { refused: "DRPG.Floor.round.notDue" };
            }
            return zoneDue(floor, c, now);
        }
        case "count":
            if (zone.phase !== "vote") return { refused: "DRPG.Zones.noCount" };
            return zoneDue(floor, c, now);
        case "skip":
            // Skip moves the phase on: the Straw Poll counted, a Logic Dive question counted or judged, a Scrum turn passed.
            return zoneDue(floor, c, now, { skip: true });
        case "skipQuestion": {
            if (floor.mode !== ZONE_MODES.dive) return { refused: "DRPG.Zones.noQuestionHere" };
            const cards = [card(floor.mode, "DRPG.Zones.dive.skipped", { n: String((zone.set?.index ?? 0) + 1) })];
            if (ctx.next && ctx.next.question) return diveQuestion(floor, ctx.next, now, cards);
            return over(cards, { dive: { setId: zone.set?.id ?? null, index: zone.set?.index ?? 0, outcome: "skipped" } });
        }
        case "adjust": {
            const seconds = Number(event.seconds) || 0;
            if (!seconds) return { refused: "DRPG.Floor.bar.noMode" };
            const left = leftOf(floor, now);
            // Taken to zero or below it is the phase's move, as a timed mode's -30 s is its Skip (floor-machine.mjs).
            if (seconds < 0 && Math.max(left, 0) + seconds <= 0) return zoneDue(floor, c, now, { skip: true });
            const want = Math.max(Math.max(left, 0) + seconds, 0);
            return { floor: { ...floor, startedAt: now - ((Number(floor.seconds) || 0) - want) * 1000,
                gmNote: { key: "DRPG.Floor.gmNoteAdjust", seconds, at: now } }, cards: [] };
        }
        case "pick": {
            if (event.side !== "a" && event.side !== "b") return { refused: "DRPG.Zones.noSide" };
            if (typeof event.actorId !== "string" || !event.actorId) return { refused: "DRPG.Zones.noSide" };
            if (zone.picks?.[event.actorId] === event.side) return { refused: "DRPG.Zones.samePick" };
            return { floor: { ...floor, zone: { ...zone, picks: { ...(zone.picks ?? {}), [event.actorId]: event.side } } }, cards: [] };
        }
        case "thesis": {
            if (floor.mode !== ZONE_MODES.scrum || zone.phase !== "speak") return { refused: "DRPG.Zones.noThesis" };
            if (event.actorId !== floor.holderId) return { refused: "DRPG.Floor.round.notSpeaker" };
            const text = zoneText(event.text, cfg().scrum?.thesisLength);
            if (!text) return { refused: "DRPG.Zones.noThesis" };
            const theses = [...(Array.isArray(zone.theses) ? zone.theses : []), { actorId: event.actorId, side: zone.side ?? null, text, turn: zone.turn }];
            return { floor: { ...floor, zone: { ...zone, theses } },
                cards: [card(floor.mode, "DRPG.Zones.scrum.thesis", { text, zone: String(zone.side ?? "").toUpperCase() }, { actorId: event.actorId })] };
        }
        case "endMode":
        case "end":
        case "closingEnd": {
            const dive = floor.mode === ZONE_MODES.dive ? { dive: { setId: zone.set?.id ?? null, index: zone.set?.index ?? 0, outcome: "stopped" } } : {};
            return over([{ key: "DRPG.Floor.modeEnded", mode: floor.mode }], dive);
        }
        default:
            return { refused: "DRPG.Floor.bar.noMode" };
    }
}
