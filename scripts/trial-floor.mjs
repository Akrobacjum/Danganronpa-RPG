/**
 * Danganronpa RPG - who may speak, in which of the trial's three modes.
 * ---------------------------------------------------------------------------
 * THIS FILE USED TO BE A QUEUE, AND IS NOT ONE ANY MORE.
 *
 * The guide's original shape was a rota: "Gracze wypowiadają się w kolejności
 * wskazówek zegara zaczynając od ochotnika. Każdy ma maks trzy minuty
 * nieprzerwanego monologu." That is what the old `{ order, current }` state
 * modelled - an alphabetical rotation and a pointer into it.
 *
 * A trial at the table does not behave like that. People talk over each other,
 * follow one another's thoughts, and go quiet when somebody produces
 * something. The rota's job was really to answer one question - who is allowed
 * to be talking right now - and it answered it in the one situation where the
 * answer is obvious (everybody is arguing) while having nothing to say about
 * the situation where it matters (somebody has just cut in with evidence).
 *
 * So there are three MODES instead, and the interesting thing about them is
 * that only two are restrictive:
 *
 *   debate      everybody, freely. The clock is the GM's budget for the whole
 *               debate, and running past it turns the bar red rather than
 *               ending anything - a human decides when an argument is over.
 *   objection   the objector alone, for one minute. This is the only moment in
 *               the game where somebody TAKES the floor from everybody else,
 *               and it is bought by putting a Truth Bullet on the table.
 *   rebuttal    the objector AND the person they aimed at, for two minutes.
 *               Nobody else. Then it returns to open debate by itself.
 *
 * SILENCE IS ENFORCED SOCIALLY, NOT TECHNICALLY. The module does not mute
 * anybody on Discord or in LiveKit, because the talking happens outside
 * Foundry. What the code owes the table is that the state is unmistakable and
 * identical on every screen at once: the bar says which mode is running, who
 * holds the floor and how long is left, and the Objection button is refused to
 * everyone it is not currently for.
 *
 * The countdown is derived from `startedAt` rather than ticked down and
 * stored, exactly as it was before this rewrite and for the same reason: a
 * stored counter drifts per client and has to be written every second, while a
 * timestamp is written once and every client can work out the rest for itself.
 * The one thing that must NOT be worked out independently is the mode
 * TRANSITION - see `advanceIfDue`.
 *
 * "Every client can work out the rest" held only while every machine's clock
 * agreed: the stamp was the writing GM's `Date.now()` and each reader counted
 * from its own, so a player whose clock ran a minute fast saw the debate a
 * minute shorter (E10 C13, 1.2.71; audit S06-37). Both ends read the server's
 * clock now (utils.mjs `serverNow`); scenario 63 J1 reads a player a minute off
 * within one second of the GM.
 */

import { MODULE_ID, TRIAL } from "./config.mjs";
import { SETTINGS, getClock } from "./settings.mjs";
import { isPrimaryGm, error, serverNow, serialWrite } from "./utils.mjs";
import { bridgeRequest, sayNotDone } from "./bridge-guards.mjs";
import { SEIZE_KEY, objectionRecord } from "./trial.mjs";
import { MODES, nextFloor, modeSecondsOf, overruleTarget, leftAt } from "./floor-machine.mjs";

const WIDGET_ID = "drpg-trial-floor";
let ticker = null;

/** The three modes, spelled out once so nothing else has to spell them (floor-machine.mjs `MODES`, since E70 C1). */
export const FLOOR_MODES = MODES;

/*
 * WHAT EACH MODE ALLOWS, IN ONE TABLE (E70 C1, 27.10.2026; S18-79's table, amend 4 (e)). `maySpeak`, `floorRefusal` and
 * `targetRefusal` each spelled a mode's rule in a switch of its own, so the HUD, the Objection window and the primary's
 * judgement could drift apart one mode at a time; they answer from this row now (`modeAllows`), and part 2's modes are
 * rows here. Its columns:
 *   family   which of the console's footers the mode belongs to (trial-floor-ui.mjs `trialSignature`): an Objection
 *            and its rebuttal are the debate's own exchange, so the console stays open across them (E70-06);
 *   speak    who may be speaking: "all", the objector alone ("holder"), or the two in the exchange ("pair");
 *   present  who may present a Truth Bullet: everybody in today's three modes (free since E79 C16);
 *   object   whether an Objection may be raised: never inside an Objection's own minute;
 *   target   who an Objection may be aimed at: anybody, or during a rebuttal only the two in it (Dawid, 28.08);
 *   adjust   whether the GM's -30 s and +30 s move this mode's clock.
 * Discussion - no floor at all - is the row `null` answers: everybody speaks, nobody objects (no floor to take).
 * Tier 1 R1023 holds the table to the three functions' answers at 1.2.89 on every state.
 */
export const MODE_RULES = Object.freeze({
    [MODES.debate]: Object.freeze({ family: "debate", speak: "all", present: "all", object: true, target: "any", adjust: true }),
    [MODES.objection]: Object.freeze({ family: "debate", speak: "holder", present: "all", object: false, target: "any", adjust: true }),
    [MODES.rebuttal]: Object.freeze({ family: "debate", speak: "pair", present: "all", object: true, target: "pair", adjust: true })
});

/** The console's family of `floor`'s mode, "none" with no floor (trial-floor-ui.mjs `trialSignature`). */
export function floorFamily(floor = trialFloor()) {
    return floor ? (MODE_RULES[floor.mode]?.family ?? floor.mode) : "none";
}

/**
 * Whether `floor` allows `kind` ("speak", "present", "object", "target", "adjust") to `actorId`: for "target",
 * whether `actorId` may be aimed at. The one question `maySpeak`, `floorRefusal` and `targetRefusal` ask.
 */
export function modeAllows(floor, kind, actorId = null) {
    if (!floor) return kind === "speak" || kind === "present";
    const rule = MODE_RULES[floor.mode] ?? MODE_RULES[MODES.debate];
    const among = who => who === "all" || who === "any"
        || (who === "holder" && actorId === floor.holderId)
        || (who === "pair" && (actorId === floor.holderId || actorId === floor.targetId));
    switch (kind) {
        case "speak": return among(rule.speak);
        case "present": return among(rule.present);
        case "object": return rule.object === true;
        case "target": return among(rule.target);
        case "adjust": return rule.adjust === true;
        default: return false;
    }
}

/**
 * The floor state, or `null` when the trial is not in session.
 *
 * MIGRATION LIVES HERE, in the one function every reader goes through. A world
 * updated mid-trial has the old `{ active, order, current, seconds, startedAt }`
 * in its setting, and every field of it except `order`/`current` still means
 * what it used to. A state with no `mode` is therefore read as an open debate
 * that is already running: the trial carries on, the queue quietly stops
 * existing, and nothing has to be migrated by hand at exactly the moment a
 * table is mid-argument.
 *
 * The same applies to the rename underneath it. `debate` was stored as
 * "discussion" until the word was fixed, and a world saved mid-trial still
 * holds that string, so it is read here as what it always meant. One line,
 * and it is the only place any reader could meet the old spelling.
 */
export function trialFloor() {
    const stored = game.settings.get(MODULE_ID, SETTINGS.trialQueue) ?? {};
    if (!stored.active) return null;

    return {
        ...stored,
        mode: stored.mode === "discussion" ? FLOOR_MODES.debate
            : stored.mode ?? FLOOR_MODES.debate,
        holderId: stored.holderId ?? null,
        targetId: stored.targetId ?? null,
        seconds: stored.seconds ?? TRIAL.speakSeconds,
        // An Objection waiting for its Truth Bullet, and the card that waits with it (E79 C16): absent on every
        // floor written before 1.2.79, which is an objection with its evidence already on the table.
        pending: stored.pending === true,
        messageId: stored.messageId ?? null
    };
}

/*
 * ONE WRITER OF THE FLOOR, IN ONE QUEUE (E70 C0, 27.10.2026; E70-01, E70-02, amend 5 (d) of the plan's E70). Every
 * public writer below wrote the floor on whichever GM called it, each spreading its patch over the floor it read: a
 * second GM's +30 s beside the primary's heartbeat, or a seizure beside the console's Back to debate, read the same
 * floor and the later write dropped the earlier one's move (tier 2 E70-T1 at e2085d7b: the GM's +30 s moved the floor
 * while a step of the seizures' key was held). Now the floor is written only on the primary GM, and only inside a step
 * of trial.mjs `SEIZE_KEY` - the key E17 C0 gave the seizures - read and written in the same step:
 *   - each public writer is `floorStep(op, args)`: on the primary a step of the key running the op's in-step twin
 *     (`FLOOR_OPS`), on another GM the request "trial.gm" (gm-bridge.mjs, gmOnly), which runs the same step there;
 *   - the heartbeat's tick and the GM's Now are steps of the key too (`advanceIfDue`, `advanceFloorOnPrimary`), and the
 *     latch `advancing` stays: it keeps a second tick from queueing a second move behind the first;
 *   - a step never calls a public writer, which would queue behind itself and wait for ever: the seizures
 *     (trial.mjs `seizeFloor`, `objectOnPrimary`, `evidenceOnPrimary`, `unfill`) and `advanceFrom` call the twins.
 * The census is tier 0 R991's floor row and R1020 (who writes the setting), R1021 (no step reaches its key's wrapper)
 * and R1022 (the primary-only reads).
 */
async function writeFloor(patch) {
    if (!isPrimaryGm()) return null;
    const next = { ...(game.settings.get(MODULE_ID, SETTINGS.trialQueue) ?? {}), ...patch };
    await game.settings.set(MODULE_ID, SETTINGS.trialQueue, next);
    return next;
}

/** The ops a GM's change of the floor names, here and in gm-bridge.mjs "trial.gm" (its `as.oneOf`): `FLOOR_OPS`' keys. */
export const FLOOR_OP_NAMES = Object.freeze(["start", "objection", "rebuttal", "fill", "withdraw", "repoint", "back", "extend", "end",
    "adjust", "endMode", "overrule"]);

/*
 * Each op's in-step twin, handed what the op reads. A count the bridge did not carry reads 0 there (`as.num`), and
 * stands for the default it stood for before the request existed.
 */
const FLOOR_OPS = {
    start: ({ seconds }) => startFloorInStep(Number(seconds) > 0 ? seconds : TRIAL.speakSeconds),
    // A pending Objection's `messageId` is the card it waits on; an Objection with its evidence names its card the
    // same way (`openObjection`'s `cardId`), which goes on the floor's stack (E70 C1).
    objection: ({ actorId, targetId, pending = false, messageId = null }) =>
        openObjectionInStep(actorId, targetId, { pending, messageId: pending ? messageId : null, cardId: pending ? null : messageId }),
    rebuttal: () => openRebuttalInStep(),
    fill: ({ actorId, messageId }) => fillObjectionInStep(actorId, messageId),
    withdraw: ({ actorId, messageId }) => withdrawObjectionInStep(actorId, messageId),
    repoint: ({ targetId }) => repointObjectionInStep(targetId),
    // The GM's Back to the debate (the bar's, the API's): told in the Event panel ("GM: back to the debate").
    back: ({ seconds }) => returnToDebateInStep({ seconds: Number(seconds) > 0 ? seconds : null, note: true }),
    extend: ({ seconds }) => extendFloorInStep(Number(seconds) > 0 ? seconds : 30),
    end: () => endFloorInStep(),
    // The bar's two new ops (E70 C1), each only in a Class Trial (DX2 = 2): -30 s / +30 s, and End this mode.
    adjust: ({ seconds }) => (inClassTrial() && modeAllows(trialFloor(), "adjust") ? extendFloorInStep(Number(seconds) || 0) : null),
    endMode: () => (inClassTrial() ? endModeInStep() : null),
    // The GM's Overrule (E70 C2): the card it names, or the newest; only in a Class Trial, judged in the step.
    overrule: ({ messageId = null }) => overruleInStep({ messageId: messageId || null })
};

/** Whether the campaign is in its Class Trial phase: the GM's bar moves nothing outside it (DX2 = 2). */
export function inClassTrial() {
    return getClock()?.phase === "classTrial";
}

/*
 * THE ONE WRITE OF A MACHINE'S ANSWER (E70 C1). Every in-step twin asks `nextFloor` and hands its answer here, in the
 * step it runs in: nothing for a refusal; the empty floor through `endFloorInStep` (the one writer of `{}`, R1020) or
 * the new floor through `writeFloor`; a pending Objection's card marked withdrawn when the floor that replaced it is
 * not that Objection (E79 C16's `withdrawReplaced`, which each twin called before); the machine's cards posted; and
 * `drpgTrialStep` called with the op and the floor written, on this primary, after each step (E70-19 reads it in C5).
 */
async function commitFloor(prev, result, op, { replaced = true } = {}) {
    if (!result || result.refused) return null;
    let written;
    if (result.floor === null) {
        written = await endFloorInStep({ withdraw: false });
        if (!written) return null;
    } else {
        written = await writeFloor(result.floor);
        if (!written) return null;
    }
    // An Overrule's Objection is overruled, not withdrawn (E70 C2): its card is marked by `overruleInStep`.
    const kept = result.floor?.mode === FLOOR_MODES.objection && result.floor?.messageId === prev?.messageId;
    if (!kept && replaced) await withdrawReplaced(prev);
    for (const card of result.cards ?? []) await postFloorCard(card, prev);
    try {
        Hooks.callAll("drpgTrialStep", { op, floor: written });
    } catch (err) {
        error("A listener of the trial's step threw", err);
    }
    return written;
}

/**
 * A card of the GM's intervention, told to the table as something that happened (E70-07): "Turn skipped: {name}.",
 * "The GM ends the {mode}." - the trial's own cards' markup (trial-floor-ui.mjs `trialEventCard`).
 */
async function postFloorCard(card, prev) {
    try {
        const { trialEventCard } = await import("./trial-floor-ui.mjs");
        const { announce, esc } = await import("./utils.mjs");
        const name = esc(game.actors.get(card.actorId ?? "")?.name ?? "-");
        const mode = game.i18n.localize(`DRPG.Floor.mode.${card.mode ?? prev?.mode ?? "debate"}`);
        await announce({ content: trialEventCard("DRPG.Floor.gmStepTitle", game.i18n.format(card.key, { name, mode })) });
    } catch (err) {
        error("Could not post the card of the GM's change of the floor", err);
    }
}

/**
 * A change of the floor on the primary GM: a step of `SEIZE_KEY` running `op`'s twin, its answer the floor written
 * (`{}` for an end) or null when the op refused or this is not the primary. Asked by `floorStep` here and by the
 * bridge's "trial.gm" for another GM.
 */
export function floorOnPrimary(op, args = {}) {
    if (!isPrimaryGm() || !FLOOR_OP_NAMES.includes(op)) return Promise.resolve(null);
    return serialWrite(SEIZE_KEY, () => FLOOR_OPS[op](args ?? {}));
}

/**
 * A GM's change of the floor, wherever it is asked: on the primary its step (`floorOnPrimary`), on another GM the
 * request "trial.gm" to the primary (gm-bridge.mjs `requestTrialGm`), whose answer is the floor written or null; the
 * bridge has told this GM why when it is refused. Null on a player's browser.
 */
export async function floorStep(op, args = {}) {
    if (!game.user.isGM) return null;
    if (isPrimaryGm()) return floorOnPrimary(op, args);
    const { requestTrialGm } = await import("./gm-bridge.mjs");
    const res = await requestTrialGm(op, args);
    return res.ok ? (res.value ?? null) : null;
}

/** How long the current mode is meant to run. */
export function modeSeconds(floor = trialFloor()) {
    // The objector's seconds to choose the bullet (E79 C16) are a pending Objection's: the machine's one answer.
    return modeSecondsOf(floor);
}

/** Seconds left in the current mode. Negative once it has overrun. */
export function secondsLeft(floor = trialFloor()) {
    if (!floor?.startedAt) return 0;
    const spent = (serverNow() - floor.startedAt) / 1000;
    return Math.round(modeSeconds(floor) - spent);
}

/*
 * A PENDING OBJECTION'S SECONDS, TO THE MILLISECOND (E79 fix r4-G2, 1.2.79; the round-4 review's cor F3). The primary
 * asked `secondsLeft`, which rounds, so a Truth Bullet sent in the last half second was refused and the heartbeat
 * lapsed the Objection then, while the objector's picker, which rounds up, still showed 1 s. The primary's test
 * (`pendingFor`), its lapse (`advanceIfDue`) and the picker (trial.mjs `pickObjectionEvidence`) read this one count
 * now, so the picker shows no second the primary would refuse. Measured in tier 2 "a pending Objection's seconds
 * are the floor's...": a bullet 450 ms before the end is put on the card (refused before this fix).
 */
export function msLeft(floor = trialFloor()) {
    if (!floor?.startedAt) return 0;
    return modeSeconds(floor) * 1000 - (serverNow() - floor.startedAt);
}

/** Whoever took the floor - the objector, in both restrictive modes. */
export function floorHolder(floor = trialFloor()) {
    return floor?.holderId ? (game.actors.get(floor.holderId) ?? null) : null;
}

/** Whoever an objection was aimed at. */
export function floorTarget(floor = trialFloor()) {
    return floor?.targetId ? (game.actors.get(floor.targetId) ?? null) : null;
}

/**
 * May this character be speaking right now?
 *
 * The answer every restriction in this stage is built on, in one place so the
 * bar, the Objection button and the GM's window cannot disagree about it.
 * A trial that is not running answers `true`: this governs the trial's own
 * modes, and has no opinion about ordinary play.
 */
export function maySpeak(actorId, floor = trialFloor()) {
    // The mode's row (`MODE_RULES`, E70 C1): the objector alone in an Objection, the two in a rebuttal, else anybody.
    return modeAllows(floor, "speak", actorId);
}

/* ==========================================================================
 * RUNNING THE FLOOR
 * ========================================================================== */

/**
 * Open the floor as a free debate.
 *
 * No volunteer, no rotation, no order to preview - the whole table may speak
 * from the first second. All the GM chooses is how long they expect it to run,
 * and even that is a budget rather than a limit.
 */
export async function startFloor({ seconds = TRIAL.speakSeconds, confirmNewTrial = false } = {}) {
    if (!game.user.isGM) return null;

    // THE PHASE FOLLOWS THE FLOOR, and it is set here rather than at the call
    // site because there has been more than one way in. `startClassTrial` did
    // set it; the GM panel's separate "open the floor" route did not, so
    // opening a trial that way left the campaign window still reading Daily
    // Life or Investigation while a trial was demonstrably running. That
    // second route is gone - there is one trial window now - but the rule
    // stays where it is: an open floor IS the trial being in session, and the
    // two cannot sensibly disagree whoever opens it.
    //
    // Imported lazily: clock.mjs is not needed to READ the floor, and this
    // file is imported by the widget on every client.
    try {
        const { getClock, setPhase } = await import("./clock.mjs");
        if (getClock().phase !== "classTrial") {
            /*
             * THE OTHER ROAD INTO A TRIAL (T-1), and it pays the budget without
             * paying it here. `openDebate` never asks the phase, so a table that opens
             * a debate without pressing "Start Class Trial" gets here; `setPhase` goes
             * through `setClock`, and `reconcilePhase` hands out the budget on every
             * road into a trial. Calling it here as well paid this road twice.
             *
             * Inside the `if`, so the second and third debate of the same trial
             * move nothing and refill nothing.
             *
             * A REFUSAL IS NOT THAT COSMETIC PROBLEM (E10 C11). In a chapter with a verdict
             * `setPhase` refuses a trial nobody confirmed and answers null; a floor opened then
             * would be a debate in Daily Life beside a verdict, so the floor stays shut too.
             * `confirmNewTrial` is passed on from a caller that asked (`openDebate`).
             */
            if (await setPhase("classTrial", { confirmNewTrial }) === null) return null;
        }
    } catch (err) {
        // A phase that did not move is a cosmetic problem; a floor that did
        // not open is not. Never let the first prevent the second.
        error("Could not switch the campaign phase to the Class Trial", err);
    }

    // The phase above on this GM, as before (its own key, CLOCK_KEY); the floor in the floor's step on the primary.
    return floorStep("start", { seconds });
}

/** `startFloor`'s write, in a step of `SEIZE_KEY` on the primary. */
export async function startFloorInStep(seconds = TRIAL.speakSeconds) {
    // The machine's `start` row (E70 C1): a debate of `seconds`, its stack empty, and the old queue's rota cleared
    // rather than ignored, so a world that has been through this update keeps no stale rota for somebody to find.
    const replaced = trialFloor();
    const written = await commitFloor(replaced, nextFloor(replaced, { type: "start", seconds }, { now: serverNow() }), "start");
    // A debate opened by any road takes up the console's offer to open it again after an Overrule (E70 C2).
    if (written && overruleRecord().again) {
        const { setTrialProgress } = await import("./vote.mjs");
        await setTrialProgress(record => (record.againAfterOverrule ? { againAfterOverrule: null } : null));
    }
    return written;
}

/**
 * Why nobody may object right now, whoever they are and whoever they aim at.
 *
 * THE ADMISSION RULE IS TWO QUESTIONS, ASKED AT TWO MOMENTS (T-1). This half is
 * everything knowable before a target exists - no floor, or somebody's minute
 * already running - and it is the half a window may ask while it is still being
 * built. `targetRefusal` below is the other half, and it can only be asked of a
 * submitted form.
 *
 * Splitting them is not tidiness. A single combined refusal, asked with an empty
 * target, answers "you named nobody" - so the button would be greyed for a
 * rebuttal cut-in Dawid ruled legal on 28.08, and the player would be told the
 * move is illegal when it is not.
 *
 * @returns {string|null} a localised reason, or null.
 */
export function floorRefusal(floor = trialFloor()) {
    if (!floor) return game.i18n.localize("DRPG.Trial.objectionNoFloor");
    /*
     *   during an objection   somebody has ONE minute alone. A second objection
     *                         inside it would reset the clock onto a new pair and
     *                         the rebuttal the first one bought would never
     *                         happen at all.
     */
    if (!modeAllows(floor, "object")) {
        return game.i18n.localize("DRPG.Trial.objectionDuringObjection");
    }
    return null;
}

/**
 * Whether an Objection may be raised on `floor`: `floorRefusal`'s question without its words, for a judge that says
 * its own from the bridge's closed list (trial.mjs `objectOnPrimary`, E79 C16).
 */
export function objectionOpen(floor = trialFloor()) {
    return floorRefusal(floor) === null;
}

/** Whether `objectorId` may aim at `targetId` on `floor`: `targetRefusal`'s question without its words, as above. */
export function mayObjectTo(objectorId, targetId, floor = trialFloor()) {
    return targetRefusal(objectorId, targetId, floor) === null;
}

/**
 * Why this objector may not aim at this target.
 *
 * The submit-time half: it needs both names, so it cannot grey a button in
 * advance without refusing the legal cut-in described above.
 *
 * @returns {string|null} a localised reason, or null.
 */
export function targetRefusal(objectorId, targetId, floor = trialFloor()) {
    if (!objectorId || !targetId) return game.i18n.localize("DRPG.Trial.objectionNobody");
    if (objectorId === targetId) return game.i18n.localize("DRPG.Trial.objectionSelf");

    /*
     * AND DURING A REBUTTAL, ONLY THE TWO IN IT MAY BE AIMED AT (Dawid, 28.08,
     * correcting the reading of the ruling in `openObjection`).
     *
     * The two rules are about different people and it is worth saying which is
     * which, because they were read as one and the wrong half was lifted. WHO
     * MAY SPEAK is anybody: the moment somebody listening sees the hole is the
     * moment interrupting is worth anything. WHO MAY BE SPOKEN AT is the pair,
     * because an objection RE-POINTS the floor - aiming a bystander at another
     * bystander would take a rebuttal two people earned and hand it to two who
     * have not said a word, which is not an interruption but a change of
     * subject.
     *
     * So a third party cutting in joins THIS argument rather than starting their
     * own. The picker in trial.mjs offers exactly these two; this is the rule
     * that holds when something reaches here by another road.
     */
    if (floor && !modeAllows(floor, "target", targetId)) {
        return game.i18n.localize("DRPG.Trial.objectionRebuttalOutsider");
    }
    return null;
}

/**
 * An OBJECTION: the objector takes the floor for one minute, aimed at
 * somebody in particular.
 *
 * The target is required, and that is the design decision this stage turns on.
 * An objection without a target is just a loud presentation; with one, it is
 * the opening half of a two-part exchange, because the target is exactly who
 * gets the two minutes of rebuttal when this minute runs out.
 *
 * REFUSED DURING SOMEBODY ELSE'S OBJECTION OR REBUTTAL. Without that, a second
 * objection would reset the clock onto a new pair and the first rebuttal would
 * never happen - the minute would keep being bought out from under whoever was
 * about to answer. Refusing it is also checked on the caller's side before the
 * card is ever posted (see `trial.mjs`), so a player is told why rather than
 * watching their objection silently fail to take the floor.
 *
 * @returns {object|null} the new state, or `null` when refused.
 */
export async function openObjection(objectorId, targetId, { pending = false, messageId = null, cardId = null } = {}) {
    // STAYS HERE, and does not move into either helper: the two refusals are
    // asked by the player's own window as well, and a client-side isGM test
    // would refuse every player in the game.
    if (!game.user.isGM) return null;
    return floorStep("objection", { actorId: objectorId, targetId, pending, messageId: messageId ?? cardId });
}

/** `openObjection`'s judgement and write, in a step of `SEIZE_KEY` on the primary (the seizures call it there). */
export async function openObjectionInStep(objectorId, targetId, { pending = false, messageId = null, cardId = null } = {}) {
    const floor = trialFloor();

    // WHICH MODES AN OBJECTION MAY INTERRUPT.
    //
    //   debate      always. This is what the debate is for.
    //   rebuttal    ALWAYS, from anybody. Changed 28.08 on Dawid's ruling.
    //
    //               This used to be "only from the two already on it", on the
    //               reasoning that a third party would be taking a floor they
    //               are not on. That is true of the floor and wrong about the
    //               table: the two minutes of a rebuttal are exactly when
    //               somebody listening sees the hole in what is being said,
    //               and a rule that makes them wait until the argument is over
    //               is a rule against the only moment interrupting is worth
    //               anything. The pair is not a private room - it is a pair the
    //               rest of the trial is watching.
    //
    //               Nothing is lost by allowing it, because an objection
    //               RE-POINTS the floor rather than ending it: the interrupter
    //               takes the minute and whoever they aimed at gets the
    //               answering two. That is the same exchange the first
    //               objection bought, now with the person who earned it.
    //   objection   never, and this is the one that stays. Somebody has ONE
    //               minute alone; a second objection inside it would reset the
    //               clock onto a new pair and the rebuttal the first one
    //               bought would never happen at all. Cutting in during a
    //               rebuttal costs the objector the same as objecting in a
    //               debate (T-1, Dawid 17.09) - what is free about it is the
    //               floor, not the price.
    //
    // THE RULES THEMSELVES ARE THE TWO FUNCTIONS ABOVE, asked here and asked
    // again by the player's window before the card is posted, so a player is
    // told why rather than watching their objection land as an ordinary card.
    // This is the rule; that is the courtesy. They are one pair of functions so
    // the two cannot drift.
    const refusal = floorRefusal(floor) ?? targetRefusal(objectorId, targetId, floor);
    if (refusal) return null;

    /*
     * PENDING, OR WITH ITS EVIDENCE (E79 C16, 1.2.79). A player's Objection opens the floor before its Truth Bullet
     * is chosen (trial.mjs `objectOnPrimary`, the owner's rule of 17.10.2026): `pending` gives the objector
     * `TRIAL.objectionPickSeconds` to fill the card `messageId` names, and the minute starts at the fill
     * (`fillObjection`). Every other caller - the GM's card road (`seizeFloor`), the API, the suite - opens it with
     * its evidence, as before.
     */
    /*
     * THE FLOOR IT INTERRUPTED GOES ON THE STACK (E70 C1; the machine's `objection` row): `before` gains the entry
     * `{ messageId, before, leftAtObjection }` - the card (the pending one, or the GM's card road's `cardId`), the
     * mode, holder, target and budget it interrupted, and that mode's seconds left - so Back to the debate gives the
     * debate the time it had (TR31) and C2's Overrule knows where to go back to. The API's Objection pushes it too.
     */
    const opened = await commitFloor(floor, nextFloor(floor, {
        type: "objection", holderId: objectorId, targetId, pending: pending === true, messageId, cardId
    }, { now: serverNow() }), "objection");

    /*
     * AN OBJECTION RESTARTS THE OBJECTION MUSIC, ALWAYS (Dawid, 28.08).
     *
     * A rebuttal already plays the objection state - it is the answering half
     * of the same exchange, and changing the music under it would cut the
     * argument in two. So cutting INTO a rebuttal was, to the state machine, no
     * change at all: same state, nothing to do, and the loudest moment in a
     * trial arrived in silence.
     *
     * `refreshMusic` drops what is playing and re-applies the state rather than
     * comparing it, so the playlist advances - measured, three objections in a
     * row take two, one, two. The interruption sounds like an interruption
     * because a new track starts, which is the whole of what the table hears.
     *
     * Unconditional rather than "only from a rebuttal": objection-to-objection
     * is refused above, and debate-to-objection changed state anyway, so the
     * only case this alters is the one that was wrong.
     */
    if (opened) {
        try {
            const { refreshMusic } = await import("./music.mjs");
            /*
             * NOW, NOT AFTER THE SETTLE WINDOW.
             *
             * `schedule()` waits 400ms and collapses everything asked for in
             * that window into one apply - which is right for a clock turning
             * and wrong for a cue. Two objections inside the window became ONE
             * track change, so the second one landed in silence. Found by the
             * scenario, which failed on a run where the two calls happened to
             * fall closer together than on the run before it: the behaviour was
             * always a race, and only the timing changed.
             *
             * `runApply` chains applies in order, so asking immediately twice
             * is two applies in sequence rather than two crossfades interleaved.
             */
            refreshMusic({ now: true });
        } catch (err) {
            // A floor that opened without its music is far better than one that
            // did not open.
            error("Could not restart the objection music", err);
        }
    }

    return opened;
}

/** Move to the rebuttal: the same pair, two minutes, both of them talking. */
export async function openRebuttal() {
    if (!game.user.isGM) return null;
    return floorStep("rebuttal");
}

/** `openRebuttal`'s write, in a step of `SEIZE_KEY` on the primary. */
export async function openRebuttalInStep() {
    const floor = trialFloor();
    if (!floor) return null;

    return commitFloor(floor, nextFloor(floor, { type: "rebuttal" }, { now: serverNow() }), "rebuttal");
}

/**
 * The Truth Bullet is on the pending Objection's card: the objector's minute starts now (E79 C16, 1.2.79). Only
 * the Objection `objectorId` holds with the card `messageId`, still pending and inside its seconds - anything else
 * answers null and writes nothing (a late pick, somebody else's, a floor that moved on). Counted from the fill and
 * not from the press, so the minute is the minute the objector argues with the card on the table.
 *
 * @returns {Promise<object|null>} the floor written, or null
 */
export async function fillObjection(objectorId, messageId) {
    if (!game.user.isGM) return null;
    return floorStep("fill", { actorId: objectorId, messageId });
}

/** `fillObjection`'s judgement and write, in a step of `SEIZE_KEY` on the primary (trial.mjs `evidenceOnPrimary`). */
export async function fillObjectionInStep(objectorId, messageId) {
    // Under the heartbeat's latch (`advancing`): a fill read inside the seconds and written after the lapse would
    // turn the debate the lapse wrote into an objection's floor with nobody's card on it.
    if (!game.user.isGM || advancing) return null;
    const floor = trialFloor();
    if (!pendingFor(floor, objectorId, messageId)) return null;
    advancing = true;
    try {
        return await commitFloor(floor, nextFloor(floor, { type: "fill" }, { now: serverNow() }), "fill");
    } finally {
        advancing = false;
    }
}

/** Whether `floor` is `objectorId`'s Objection, waiting for the card `messageId`, with seconds left to fill it. */
export function pendingFor(floor, objectorId, messageId) {
    return Boolean(floor) && floor.mode === FLOOR_MODES.objection && floor.pending === true
        && Boolean(objectorId) && floor.holderId === objectorId && Boolean(messageId) && floor.messageId === messageId
        && msLeft(floor) > 0;
}

/*
 * A PENDING OBJECTION IS WITHDRAWN ON EVERY ROAD THAT REPLACES ITS FLOOR (E79 fix r4-G2, 1.2.79; the round-4
 * review's cor F2). Only the lapse marked the card, so the GM's Back to debate, a floor closed, the trial's end
 * (`reconcilePhase` closes the floor) and a debate opened over it left the card saying "pending" on every screen and
 * in every notice history, and the objector's picker open to a deadline nobody kept. Each writer that replaces a
 * floor hands the floor it replaced here, after its own write, so a card that cannot be marked leaves no floor
 * waiting for it; the fill does not (its floor stays the Objection's), and the card is marked once whoever asks
 * twice (trial.mjs `withdrawObjectionCard` marks only a card still pending). Nothing is given back (D4).
 */
async function withdrawReplaced(floor) {
    if (floor?.mode !== FLOOR_MODES.objection || floor.pending !== true || !floor.messageId) return false;
    try {
        const { withdrawObjectionCard } = await import("./trial.mjs");
        return await withdrawObjectionCard(floor.messageId);
    } catch (err) {
        error("Could not mark the withdrawn Objection's card", err);
        return false;
    }
}

/**
 * The objector takes their pending Objection back (E79 fix r4-G2, 1.2.79; cor F4: the handbooks' "Close the window
 * ... and the Objection is withdrawn"): the picker closed or cancelled, asked of the primary (trial.mjs
 * `withdrawOnPrimary`, `trial.withdraw`). Only `objectorId`'s Objection on the card `messageId`, still pending - a
 * floor that moved on, somebody else's or a newer Objection's answers null and writes nothing. The floor goes back to
 * the debate and the card is marked as at a lapse, nothing given back. Under the heartbeat's latch, as the fill is.
 *
 * @returns {Promise<object|null>} the floor written, or null
 */
export async function withdrawObjection(objectorId, messageId) {
    if (!game.user.isGM) return null;
    return floorStep("withdraw", { actorId: objectorId, messageId });
}

/** `withdrawObjection`'s judgement and write, in a step of `SEIZE_KEY` on the primary. */
export async function withdrawObjectionInStep(objectorId, messageId) {
    if (!game.user.isGM || advancing) return null;
    const floor = trialFloor();
    if (!pendingFor(floor, objectorId, messageId)) return null;
    advancing = true;
    try {
        // Back to the debate with the seconds it had when the Objection cut in (the stack's top), nothing given back.
        return await commitFloor(floor, nextFloor(floor, { type: "withdraw" }, { now: serverNow() }), "withdraw");
    } finally {
        advancing = false;
    }
}

/**
 * A GM points the running Objection at somebody else (E79 C16; the trial console's Re-point, run on the primary
 * through `floor.repoint`): the target alone changes, the clock does not. Refused - null, nothing written - with no
 * Objection on the floor or a target `targetRefusal` turns down.
 *
 * @returns {Promise<object|null>}
 */
export async function repointObjection(targetId) {
    if (!game.user.isGM) return null;
    return floorStep("repoint", { targetId });
}

/** `repointObjection`'s judgement and write, in a step of `SEIZE_KEY` on the primary. */
export async function repointObjectionInStep(targetId) {
    const floor = trialFloor();
    if (floor?.mode !== FLOOR_MODES.objection) return null;
    if (targetRefusal(floor.holderId, targetId, floor)) return null;
    // The stack's entry stays: it is the same Objection, aimed elsewhere.
    return commitFloor(floor, nextFloor(floor, { type: "repoint", targetId }, { now: serverNow() }), "repoint");
}

/**
 * Back to everybody talking at once (the bar's Back to the debate; TR31 = 1). Without `seconds` the debate gets the
 * seconds it had left when the Objection on top of the stack cut in (`leftAtObjection`, never below zero), not its
 * whole budget again; a floor written before 1.2.90 has no stack and gets its budget, as before. With `seconds`, a
 * debate of that length (the API's). In a debate without `seconds` there is nothing to go back to, and nothing moves.
 */
export async function returnToDebate({ seconds = null } = {}) {
    if (!game.user.isGM) return null;
    return floorStep("back", { seconds });
}

/** `returnToDebate`'s write, in a step of `SEIZE_KEY` on the primary (a lapse, a withdrawal, trial.mjs `unfill`). */
export async function returnToDebateInStep({ seconds = null, note = false } = {}) {
    const floor = trialFloor();
    if (!floor) return null;
    // `note`: the GM's own press, told in the Event panel ("GM: back to the debate"); a lapse or a put-back is not.
    return commitFloor(floor, nextFloor(floor, { type: "back", seconds, note }, { now: serverNow() }), "back");
}

/** Give the current mode more time, without changing whose it is. */
export async function extendFloor(extraSeconds = 30) {
    if (!game.user.isGM) return null;
    return floorStep("extend", { seconds: extraSeconds });
}

/** `extendFloor`'s write, in a step of `SEIZE_KEY` on the primary. */
export async function extendFloorInStep(extraSeconds = 30) {
    const floor = trialFloor();
    if (!floor) return null;

    /*
     * Pushing `startedAt` rather than growing a stored duration: the duration of
     * `objection` and `rebuttal` is a constant (see TRIAL), and the clock
     * everybody is reading is `now - startedAt`. Moving the start is what "thirty
     * more seconds" means to every client at once, with no extra field for anyone
     * to disagree about.
     *
     * FROM NOW, NOT FROM A CLOCK THAT HAS ALREADY RUN OUT (F9).
     *
     * It used to add thirty seconds to `startedAt` flat, and `secondsLeft` is
     * `modeSeconds - (now - startedAt)`: on a debate 137 s over its budget the
     * press moved it to 107 s over, which is the one moment a GM ever reaches for
     * this button and the one moment it did nothing they could see. config.mjs
     * says it out loud beside `objectionSeconds` - "a GM who needs a longer one
     * has +30 s" - and they did not have it.
     *
     * Written as how much should be LEFT, so one line covers all three modes:
     * clamped at zero it is thirty seconds from now, above zero it is exactly the
     * old behaviour. It is not only a debate that can be found expired - only the
     * primary GM's one-second heartbeat advances an objection, and a browser
     * throttles that tab in the background, so a minute can sit forty seconds
     * past zero. Before this, +30 there wrote left = -10 and the next tick threw
     * it away.
     */
    // The arithmetic is the machine's `adjust` row since E70 C1 (floor-machine.mjs): from what is left, clamped at
    // zero, and told in the Event panel as "GM: +30 s"; -30 s there too, where a timed mode taken to zero is Skip.
    return commitFloor(floor, nextFloor(floor, { type: "adjust", seconds: extraSeconds }, { now: serverNow() }), "adjust");
}

/**
 * Close the debate. The TRIAL carries on.
 *
 * This used to be reachable only by ending the whole trial, which is why the
 * two were confused with each other: a GM who wanted the room to stop arguing
 * for a moment had to end the Class Trial to get it. The trial's phase is not
 * touched here - see `endClassTrial` in trial-floor-ui.mjs for the other one.
 */
export async function endFloor() {
    if (!game.user.isGM) return null;
    // On another GM (clock.mjs `reconcilePhase` out of the trial, the console's Close the debate): "trial.gm".
    await floorStep("end");
    return null;
}

/**
 * `endFloor`'s write, in a step of `SEIZE_KEY` on the primary: the empty queue, `{}` its answer. `withdraw: false`
 * from `commitFloor`, which marks the replaced Objection's card itself.
 */
export async function endFloorInStep({ withdraw = true } = {}) {
    if (!isPrimaryGm()) return null;
    const floor = trialFloor();
    await game.settings.set(MODULE_ID, SETTINGS.trialQueue, {});
    if (withdraw) await withdrawReplaced(floor);
    return {};
}

/**
 * END THIS MODE (E70 C1; TR21, TR11 = 1), the bar's: a debate's end closes it; an Objection or a rebuttal the GM ends
 * ends the floor as a rebuttal's own end does - the exchange is over and the trial is back in discussion, not in a
 * debate nobody opened. Told in chat ("The GM ends the {mode}."). In a step of `SEIZE_KEY` on the primary.
 */
export async function endModeInStep() {
    const floor = trialFloor();
    if (!floor) return null;
    return commitFloor(floor, nextFloor(floor, { type: "endMode" }, { now: serverNow() }), "endMode");
}

/*
 * THE GM'S BAR (E70 C1, 27.10.2026; S18-75, S18-76; the owner's TR21: "GM zawsze ma mieć maksimum kontroli, tzn móc
 * kończyć tryb, dodawać i odejmować czas, a nawet pomijać mówców"; DX2 = 2, only in the trial; TR26 = 1, +30 s may
 * pass a mode's own length). Its buttons, in the order the console draws them (trial-floor-ui.mjs `trialBar`):
 *   skip     the turn now running is over: an Objection's minute becomes the rebuttal, a rebuttal ends the floor, a
 *            pending Objection lapses (`skipStep`, through the GM's Now and its seen floor, E10 fix r2-G7);
 *   minus    -30 s: a debate down to zero at most; a timed mode taken to zero or below is its Skip;
 *   plus     +30 s from what is left, never from a clock already run out (F9);
 *   endMode  End this mode (`endMode`); back  Back to the debate with the time it had (`returnToDebate`);
 *   repoint  the running Objection aimed at somebody else (trial.mjs `repointDialog`).
 *   overrule the newest Objection overruled (E70 C2, `overruleObjection`): during its exchange the floor goes back to
 *            whom or what it interrupted, with the time it had; after it, only the receipt and the card are marked.
 * A button whose op would change nothing is greyed with the reason the machine gives for it (`barRefusal`), so a dead
 * button says why; the primary asks the same rows again in its step.
 */
export const BAR_OPS = Object.freeze(["skip", "minus", "plus", "overrule", "endMode", "back", "repoint"]);

/** The machine's event for a bar `op` (null for one the machine does not run: Re-point is its own window). */
function barEvent(op, seconds) {
    const step = Math.abs(Number(seconds) || TRIAL.modes.gm.adjustSeconds);
    switch (op) {
        case "skip": return { type: "skip" };
        case "minus": return { type: "adjust", seconds: -step };
        case "plus": return { type: "adjust", seconds: step };
        case "endMode": return { type: "endMode" };
        case "back": return { type: "back" };
        default: return null;
    }
}

/**
 * Why the bar's `op` would change nothing on `floor` now - a DRPG key the greyed button shows - or null. Outside a
 * Class Trial every op refuses (DX2); a mode whose row does not let the GM move its clock refuses -30 s and +30 s.
 * `record` stands for the trial record's receipts (`{ objections, trialStartedAt }`, the suite's), read when not given.
 */
export function barRefusal(op, floor = trialFloor(), { running = inClassTrial(), now = serverNow(), seconds = null, record = null } = {}) {
    if (!running) return "DRPG.Floor.bar.notTrial";
    // Asked before the floor: an Objection whose exchange is over is overruled with no floor at all (E70 C2).
    if (op === "overrule") return overruleTarget({ floor, ...overruleRecord(record), running }).refused ?? null;
    if (!floor) return "DRPG.Floor.bar.noMode";
    if (op === "repoint") return floor.mode === FLOOR_MODES.objection ? null : "DRPG.Floor.bar.noObjection";
    if ((op === "minus" || op === "plus") && !modeAllows(floor, "adjust")) return "DRPG.Floor.bar.noAdjust";
    const event = barEvent(op, seconds);
    if (!event) return "DRPG.Floor.bar.noMode";
    return nextFloor(floor, event, { now }).refused ?? null;
}

/** A bar op refused here, told to this GM; true when it may go on to the primary. */
function barMay(op, seconds = null) {
    const refused = barRefusal(op, trialFloor(), { seconds });
    if (refused) ui.notifications.warn(game.i18n.localize(refused));
    return !refused;
}

/** Skip: the running turn is over now (the bar's first button in an Objection or a rebuttal). */
export async function skipStep() {
    if (!game.user.isGM || !barMay("skip")) return null;
    return advanceFloorNow();
}

/** -30 s or +30 s (`seconds` signed, `TRIAL.modes.gm.adjustSeconds` by default) on the running mode's clock. */
export async function adjustTime(seconds = TRIAL.modes.gm.adjustSeconds) {
    const by = Number(seconds) || 0;
    if (!game.user.isGM || !by || !barMay(by < 0 ? "minus" : "plus", by)) return null;
    return floorStep("adjust", { seconds: by });
}

/*
 * OVERRULE (E70 C2, 27.10.2026; S18-77; TR25, TR35, DB41; E70-09 to E70-12). The owner, TR25: "koszt ma zostac, ale do
 * glosu ma wrocic osoba (lub tryb), wobec ktorej padlo objection z czasem, jaki jej wtedy pozostal". So:
 *   - the price stays: nothing on this road gives anything back - no refund, no put-back of a pip (tier 0 R1028 reads
 *     every function the step reaches for one);
 *   - during the Objection's exchange (its minute, its pending seconds or its rebuttal) the floor goes back to what it
 *     interrupted, with the seconds that had left then: floor-machine.mjs `overrule`, the top of the stack E70 C1 keeps;
 *     a chain - an Objection inside a rebuttal - is two presses, each the newest one then (TR35);
 *   - after its exchange nothing on the floor moves: the receipt and the card are marked, and the console offers the
 *     debate again with the time the debate had (`againAfterOverrule`, trial-floor-ui.mjs `trialNextStep`);
 *   - the record is the receipt the primary wrote from the price it took (trial.mjs `keepReceipt`), never a flag on the
 *     card: a card's flag is what a chat log draws the stamp from (`objectionOverruled`, display only), and the log, the
 *     judgement and the offer read the receipt (`presentedThisChapter`).
 * Judged on the primary, in a step of the floor's key, from the floor and the record as the step finds them
 * (`overruleTarget`); a GM that is not the primary asks it by "trial.gm". The pressing GM is told a refusal first.
 */

/** The record's receipts, stamp and offer (trial.mjs `objectionRecord`), or the suite's `given`. */
function overruleRecord(given = null) {
    return objectionRecord({ given });
}

/** Overrule the Objection on the card `messageId`, or the newest (the bar's, the log's, `game.drpg.overruleObjection`). */
export async function overruleObjection(messageId = null) {
    if (!game.user.isGM) return null;
    const refused = overruleTarget({ floor: trialFloor(), ...overruleRecord(), messageId: messageId || null, running: inClassTrial() }).refused;
    if (refused) {
        ui.notifications.warn(game.i18n.localize(refused));
        return null;
    }
    return floorStep("overrule", { messageId: messageId || null });
}

/** Where the trial went back to, in the words of the Overrule's card: the debate or the rebuttal, and its time. */
function overruledState(floor) {
    const seconds = Math.max(leftAt(floor, serverNow()), 0);
    if (floor?.mode === FLOOR_MODES.rebuttal) {
        return game.i18n.format("DRPG.Floor.overrule.stateRebuttal", {
            who: game.actors.get(floor.holderId ?? "")?.name ?? "-", target: game.actors.get(floor.targetId ?? "")?.name ?? "-", seconds
        });
    }
    if (floor?.mode === FLOOR_MODES.objection) return game.i18n.localize("DRPG.Floor.mode.objection");
    return game.i18n.format("DRPG.Floor.overrule.stateDebate", { seconds });
}

/**
 * `overruleObjection`'s judgement and writes, in a step of `SEIZE_KEY` on the primary: the floor back (during the
 * exchange), the receipt marked overruled and, after the exchange, the offer of the debate again - one write of the
 * record - then the card and the table told (trial.mjs `markOverruled`). Its answer is the floor written, or
 * `{ overruled }` when the floor did not move; null for a refusal.
 */
export async function overruleInStep({ messageId = null } = {}) {
    if (!isPrimaryGm() || !inClassTrial()) return null;
    const floor = trialFloor();
    const judged = overruleTarget({ floor, ...overruleRecord(), messageId, running: true });
    if (judged.refused) return null;
    const now = serverNow();
    let written = null;
    if (judged.during) {
        written = await commitFloor(floor, nextFloor(floor, { type: "overrule" }, { now }), "overrule", { replaced: false });
        if (!written) return null;
    }
    const id = judged.messageId;
    if (judged.receipt || !judged.during) {
        const { setTrialProgress } = await import("./vote.mjs");
        await setTrialProgress(record => {
            const objections = { ...(record.objections ?? {}) };
            if (id && objections[id]) objections[id] = { ...objections[id], overruled: true, overruledAt: now };
            const change = { objections };
            // The debate's time when the Objection cut in (the newest debate under it, TR31's rest) - offered only
            // with no floor: a debate the GM already opened again is the debate.
            if (!judged.during && !floor) change.againAfterOverrule = { messageId: id, seconds: Number(judged.receipt?.debateLeft ?? judged.receipt?.leftAtObjection) || 0 };
            return change;
        });
    }
    try {
        const { markOverruled } = await import("./trial.mjs");
        await markOverruled(id, {
            objectorId: judged.receipt?.objectorId ?? (judged.during ? floor.holderId : null),
            state: judged.during ? overruledState(written) : null
        });
    } catch (err) {
        error("Could not mark the overruled Objection's card", err);
    }
    return written ?? { overruled: id };
}

/** End this mode: a debate closed, an Objection or a rebuttal ended into the discussion (TR11 = 1). */
export async function endMode() {
    if (!game.user.isGM || !barMay("endMode")) return null;
    return floorStep("endMode");
}

/* ==========================================================================
 * AUTOMATIC TRANSITIONS
 * ========================================================================== */

/**
 * The same transition the clock would have made, made now.
 *
 * Stage 4's manual override: a minute of objection the GM wants over after
 * twenty seconds, a two-minute rebuttal that ran out of argument. It is
 * deliberately NOT "close the floor" - the trial carries on, the mode simply
 * moves to whatever came next anyway, so the GM is skipping a timer rather
 * than ending a scene.
 *
 * An open debate has no next mode: it does not expire by design, so there is
 * nothing here to bring forward and this says so by doing nothing.
 */
export async function advanceFloorNow() {
    /* ON THE PRIMARY GM (E10 fix r2-G6, 1.2.71; r2-G5's open road). The latch below is one browser's, and
       the GM's Now wrote its transition on whichever GM pressed it: Now on a GM that is not the primary,
       while the primary's heartbeat wrote the same move, wrote it a second time and restarted the
       rebuttal's two minutes. It is asked of the primary now (`floor.now`, as `vote.run` is), which runs
       it under the latch its heartbeat takes; on the primary it runs here. Measured in scenario 63 X at 616d1e2,
       gm3 pressing Now: while gm2's heartbeat wrote the rebuttal, and with gm2's heartbeat passing zero while it
       was on its way, the rebuttal was written twice, once on each GM; alone, once, on gm3. */
    /* THE FLOOR IT SAW (E10 fix r2-G7, 1.2.71; the read of round 2's fixes, F1). The primary's latch covers a
       write on its way and nothing after it: another GM's Now that reached the primary after the move it was
       pressed for had landed there read the floor that move wrote and moved it on again, so the rebuttal that had
       just opened was ended. Measured in scenario 63 X2 at c51d2bd, gm3's packet held 3 s: gm2 wrote the
       objection, the rebuttal and an empty floor, whether its heartbeat or its own Now made the first move. The
       press carries the floor this GM read, and the primary moves that floor or nothing (`floorAsSeen`); this GM
       is told when it had moved on. An open debate has no next mode, so it is asked nothing. */
    if (!game.user.isGM) return null;
    const floor = trialFloor();
    if (floor?.mode !== FLOOR_MODES.objection && floor?.mode !== FLOOR_MODES.rebuttal) return null;
    const seen = { mode: floor.mode, startedAt: floor.startedAt };
    const res = await bridgeRequest("floor.now", seen, { settle: "reply", onPrimary: true, quiet: true, local: () => advanceFloorOnPrimary(seen) });
    if (res.ok) return res.value ?? null;
    // Its own words for a floor that moved on; the bridge's for the rest, which the request would have said itself.
    if (res.reason === "movedOn") ui.notifications.warn(game.i18n.localize("DRPG.Floor.nowMovedOn"));
    else sayNotDone("floor.now", res.reason);
    return null;
}

/**
 * Whether the trial's floor is still the one a GM's Now was pressed on, `seen` = its mode and its start
 * (E10 fix r2-G7): a floor moved on, ended or given thirty seconds since is another floor.
 */
export function floorAsSeen(seen, floor = trialFloor()) {
    return Boolean(floor) && floor.mode === seen?.mode && floor.startedAt === seen?.startedAt;
}

/**
 * The GM's Now on the primary GM, for itself or asked by another GM (gm-bridge.mjs `floor.now`): the floor
 * written, or null - null too when the floor is no longer the one the GM saw (`seen`, `floorAsSeen`).
 */
export async function advanceFloorOnPrimary(seen) {
    /* UNDER THE TICK'S LATCH (E10 fix r2-G5, 1.2.71; round 2's cor m4, goal S06-38's residual). The GM's
       Now wrote its transition outside `advancing`, so Now pressed while the heartbeat's write was on its
       way read the floor still expired and wrote the rebuttal again, and a tick during Now's own write did
       the same: each write restarts the rebuttal's two minutes. A press while a write is on its way does
       nothing - that write is the move Now asks for. Measured in tier 2 "the GM's Now during the
       heartbeat's write opens one rebuttal" (red at c494855). The latch is this browser's, which is why
       another GM's Now is asked of this one (above). */
    if (!game.user.isGM || advancing) return null;
    const floor = trialFloor();
    if (!floorAsSeen(seen, floor)) return null;

    advancing = true;
    try {
        // Read again in the step (E70 C0): a step queued ahead of this one may have moved the floor on.
        return await serialWrite(SEIZE_KEY, () => {
            const now = trialFloor();
            return floorAsSeen(seen, now) ? advanceFrom(now, "skip") : null;
        });
    } finally {
        advancing = false;
    }
}

/**
 * `advanceFloorOnPrimary`'s and the heartbeat's write, held under `advancing`: the machine's `due` row for the
 * heartbeat, its `skip` row for a GM's Now (the bar's Skip, told in chat as "Turn skipped: {name}."). Since E70 C1 the
 * rows are floor-machine.mjs `stepOn`'s: a pending Objection lapses back to the debate with the seconds it had (E79
 * C16: no evidence came, so there is nothing to answer, and nothing is given back), an Objection's minute becomes the
 * rebuttal, and a rebuttal ends the floor:
 *
 * A REBUTTAL ENDS THE FLOOR (Dawid, 28.08), rather than dropping back into
 * an open debate.
 *
 * Debate and discussion are two different things, and this file used to
 * spell both of them "discussion". A DEBATE is a floor, with a budget and
 * a clock the GM is watching; the trial's own DISCUSSION is no floor at
 * all, which is what the console calls "in open discussion" and what the
 * music still keys off as `trial.discussion`.
 *
 * So the old behaviour handed the trial back a running debate clock that
 * nobody had asked to open: the objection was over, the answer was given,
 * and the table was still being timed. Ending it puts them back where the
 * exchange began.
 */
async function advanceFrom(floor, type = "due") {
    return commitFloor(floor, nextFloor(floor, { type }, { now: serverNow() }), type);
}

let advancing = false;

/**
 * Whether the floor's mode has run out into a move: a pending Objection's seconds are the primary's test's, to the
 * millisecond (`msLeft`, fix r4-G2). A debate past its budget makes no move (it turns the clock red), so it is never due
 * and the heartbeat queues no step for it.
 */
function isDue(floor) {
    if (floor.mode === FLOOR_MODES.debate) return false;
    return floor.mode === FLOOR_MODES.objection && floor.pending ? msLeft(floor) <= 0 : secondsLeft(floor) <= 0;
}

/**
 * Objection runs out into rebuttal; rebuttal runs out into the trial's own
 * discussion - which is NO FLOOR at all, not a debate.
 *
 * EVERY client counts the clock - that is the point of deriving it from
 * `startedAt` - but exactly ONE client may write the transition, or two GMs
 * would both notice the same expiry in the same second and write it twice,
 * restarting the next mode's timer on the second write. `isPrimaryGm()` is the
 * same guard `trial.mjs` already uses to keep two GMs from racing on the
 * floor, applied to the same class of problem.
 *
 * Discussion deliberately does NOT expire. Running past the GM's budget turns
 * the clock red and nothing else: ending an argument is a judgement call, and
 * the module has no business making it.
 *
 * ONE CLIENT WAS NOT ENOUGH: ONE WRITE AT A TIME (E10 C13, 1.2.71; audit S06-38).
 * The heartbeat ticks every second whether or not the last tick's write has
 * landed, and until it lands the floor still reads the expired mode - so a write
 * slower than a second was written again by the next tick, each one restarting
 * the rebuttal's two minutes (tier 2 "two ticks during one write open one
 * rebuttal": three writes before this, with every write held for 2.5 s). `advancing`
 * is set before the write and cleared in `finally`, so a write that throws does
 * not stop the clock for good. Still the primary's alone: a transition waits for
 * the primary, and no other client writes one (the plan's amend of 05.10.2026).
 * The GM's Now takes the same latch (`advanceFloorOnPrimary`, E10 fix r2-G5), on the primary (r2-G6).
 */

async function advanceIfDue() {
    if (advancing) return;
    const floor = trialFloor();
    if (!floor || !isPrimaryGm()) return;
    if (!isDue(floor)) return;

    advancing = true;
    try {
        // Same rule when the clock runs it out as when the GM brings it forward - see `advanceFloorNow` - and in a
        // step of the floor's key (E70 C0), the floor read again there: a step ahead of this one may have moved it.
        await serialWrite(SEIZE_KEY, () => {
            const now = trialFloor();
            return now && isDue(now) ? advanceFrom(now) : null;
        });
    } catch (err) {
        error("Could not advance the trial floor to its next mode", err);
    } finally {
        advancing = false;
    }
}

/* ==========================================================================
 * THE CLOCK THAT MOVES THE MODES ALONG
 * --------------------------------------------------------------------------
 * THERE USED TO BE A BAR HERE, and it is now three rows of the campaign HUD -
 * see `buildTimeRow`, `paintElapsed` and `buildRoom` in hud.mjs. It appeared in
 * the place the table reads the time of day, at the one moment in a session
 * nobody has attention to spare for furniture moving, and it said three things
 * the clock already had rows for: which mode, how long is left, and who.
 *
 * What CANNOT move to the HUD is this: the one-second heartbeat that notices a
 * mode has run out and writes the transition. It has to keep running whether or
 * not anybody is looking at a clock, and only the primary GM's tick does any
 * work (see `advanceIfDue`) - every other client is counting the same seconds
 * off the same timestamp and needs nobody's permission to do it.
 *
 * `renderTrialFloor` keeps its name because sync.mjs and module.mjs call it and
 * the question it answers has not changed: the floor moved, react.
 * ========================================================================== */

export function registerTrialFloor() {
    Hooks.once("ready", renderTrialFloor);
    Hooks.on("canvasReady", renderTrialFloor);
    /*
     * A BACKGROUND TAB IS A SLOW CLOCK (E10 C13, 1.2.71; audit S06-38). A browser throttles
     * the timers of a tab nobody is looking at, so the primary GM's heartbeat can leave an
     * objection forty seconds past zero (`extendFloor` says how that was seen); on the tab's
     * return the transition is asked for at once rather than at the next tick. Either way the
     * document's visibility changes: `advanceIfDue` asks only whether the mode is due and
     * whether this is the primary, so the event when the tab is hidden costs one reading.
     * Measured in tier 2 "the primary GM's tab coming back moves an expired objection on at
     * once", with the heartbeat held; how long a real browser holds it is LIVE-E10-05.
     */
    document.addEventListener("visibilitychange", () => {
        advanceIfDue().catch(err => error("Could not advance the trial floor on the tab's return", err));
    });
}

/** Start or stop the heartbeat to match the floor. Safe to call repeatedly. */
export function renderTrialFloor() {
    try {
        // A world updated mid-trial has the old bar sitting in the document,
        // drawn by the version that was loaded when the page opened. It has no
        // painter any more, so it would hang there frozen on whichever second
        // it was showing when this file was replaced.
        document.getElementById(WIDGET_ID)?.remove();

        if (ticker) {
            clearInterval(ticker);
            ticker = null;
        }
        if (!trialFloor()) return;

        ticker = setInterval(() => {
            // The floor closing is what stops this, and it can close on another
            // client - so the tick checks rather than trusting that somebody
            // remembered to call this function again.
            if (!trialFloor()) {
                clearInterval(ticker);
                ticker = null;
                return;
            }
            advanceIfDue();
        }, 1000);
    } catch (err) {
        error("Could not start the trial floor's clock", err);
    }
}
