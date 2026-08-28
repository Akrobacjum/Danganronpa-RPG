/**
 * Danganronpa RPG — who may speak, in which of the trial's three modes.
 * ---------------------------------------------------------------------------
 * THIS FILE USED TO BE A QUEUE, AND IS NOT ONE ANY MORE.
 *
 * The guide's original shape was a rota: "Gracze wypowiadają się w kolejności
 * wskazówek zegara zaczynając od ochotnika. Każdy ma maks trzy minuty
 * nieprzerwanego monologu." That is what the old `{ order, current }` state
 * modelled — an alphabetical rotation and a pointer into it.
 *
 * A trial at the table does not behave like that. People talk over each other,
 * follow one another's thoughts, and go quiet when somebody produces
 * something. The rota's job was really to answer one question — who is allowed
 * to be talking right now — and it answered it in the one situation where the
 * answer is obvious (everybody is arguing) while having nothing to say about
 * the situation where it matters (somebody has just cut in with evidence).
 *
 * So there are three MODES instead, and the interesting thing about them is
 * that only two are restrictive:
 *
 *   discussion  everybody, freely. The clock is the GM's budget for the whole
 *               discussion, and running past it turns the bar red rather than
 *               ending anything — a human decides when an argument is over.
 *   objection   the objector alone, for one minute. This is the only moment in
 *               the game where somebody TAKES the floor from everybody else,
 *               and it is bought by putting a Truth Bullet on the table.
 *   rebuttal    the objector AND the person they aimed at, for two minutes.
 *               Nobody else. Then it returns to discussion by itself.
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
 * TRANSITION — see `advanceIfDue`.
 */

import { MODULE_ID, TRIAL } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { isPrimaryGm, error } from "./utils.mjs";

const WIDGET_ID = "drpg-trial-floor";
let ticker = null;

/** The three modes, spelled out once so nothing else has to spell them. */
export const FLOOR_MODES = {
    discussion: "discussion",
    objection: "objection",
    rebuttal: "rebuttal"
};

/** How long each mode runs. `discussion` is the GM's, so it is not here. */
const MODE_SECONDS = {
    [FLOOR_MODES.objection]: TRIAL.objectionSeconds,
    [FLOOR_MODES.rebuttal]: TRIAL.rebuttalSeconds
};

/**
 * The floor state, or `null` when the trial is not in session.
 *
 * MIGRATION LIVES HERE, in the one function every reader goes through. A world
 * updated mid-trial has the old `{ active, order, current, seconds, startedAt }`
 * in its setting, and every field of it except `order`/`current` still means
 * what it used to. A state with no `mode` is therefore read as a discussion
 * that is already running: the trial carries on, the queue quietly stops
 * existing, and nothing has to be migrated by hand at exactly the moment a
 * table is mid-argument.
 */
export function trialFloor() {
    const stored = game.settings.get(MODULE_ID, SETTINGS.trialQueue) ?? {};
    if (!stored.active) return null;

    return {
        ...stored,
        mode: stored.mode ?? FLOOR_MODES.discussion,
        holderId: stored.holderId ?? null,
        targetId: stored.targetId ?? null,
        seconds: stored.seconds ?? TRIAL.speakSeconds
    };
}

/**
 * The old name, kept because `music.mjs`, `gm-panel.mjs` and `api.mjs` all ask
 * the same yes/no question through it — "is a trial running" — and that answer
 * has not changed. Only the shape behind it has.
 */
export const trialQueue = trialFloor;

async function writeFloor(patch) {
    if (!game.user.isGM) return null;
    const next = { ...(game.settings.get(MODULE_ID, SETTINGS.trialQueue) ?? {}), ...patch };
    await game.settings.set(MODULE_ID, SETTINGS.trialQueue, next);
    return next;
}

/** How long the current mode is meant to run. */
export function modeSeconds(floor = trialFloor()) {
    if (!floor) return 0;
    return MODE_SECONDS[floor.mode] ?? floor.seconds ?? TRIAL.speakSeconds;
}

/** Seconds left in the current mode. Negative once it has overrun. */
export function secondsLeft(floor = trialFloor()) {
    if (!floor?.startedAt) return 0;
    const spent = (Date.now() - floor.startedAt) / 1000;
    return Math.round(modeSeconds(floor) - spent);
}

/** Whoever took the floor — the objector, in both restrictive modes. */
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
    if (!floor) return true;
    switch (floor.mode) {
        case FLOOR_MODES.objection:
            return actorId === floor.holderId;
        case FLOOR_MODES.rebuttal:
            return actorId === floor.holderId || actorId === floor.targetId;
        default:
            return true;
    }
}

/* ==========================================================================
 * RUNNING THE FLOOR
 * ========================================================================== */

/**
 * Open the floor as a free discussion.
 *
 * No volunteer, no rotation, no order to preview — the whole table may speak
 * from the first second. All the GM chooses is how long they expect it to run,
 * and even that is a budget rather than a limit.
 */
export async function startFloor({ seconds = TRIAL.speakSeconds } = {}) {
    if (!game.user.isGM) return null;

    // THE PHASE FOLLOWS THE FLOOR, and it is set here rather than at the call
    // site because there has been more than one way in. `startClassTrial` did
    // set it; the GM panel's separate "open the floor" route did not, so
    // opening a trial that way left the campaign window still reading Daily
    // Life or Investigation while a trial was demonstrably running. That
    // second route is gone — there is one trial window now — but the rule
    // stays where it is: an open floor IS the trial being in session, and the
    // two cannot sensibly disagree whoever opens it.
    //
    // Imported lazily: clock.mjs is not needed to READ the floor, and this
    // file is imported by the widget on every client.
    try {
        const { getClock, setPhase } = await import("./clock.mjs");
        if (getClock().phase !== "classTrial") await setPhase("classTrial");
    } catch (err) {
        // A phase that did not move is a cosmetic problem; a floor that did
        // not open is not. Never let the first prevent the second.
        error("Could not switch the campaign phase to the Class Trial", err);
    }

    return writeFloor({
        active: true,
        mode: FLOOR_MODES.discussion,
        holderId: null,
        targetId: null,
        seconds,
        startedAt: Date.now(),
        // Left over from the queue. Cleared rather than ignored, so a world
        // that has been through this update does not keep a stale rota in its
        // settings for somebody to find later and wonder about.
        order: null,
        current: null
    });
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
 * never happen — the minute would keep being bought out from under whoever was
 * about to answer. Refusing it is also checked on the caller's side before the
 * card is ever posted (see `trial.mjs`), so a player is told why rather than
 * watching their objection silently fail to take the floor.
 *
 * @returns {object|null} the new state, or `null` when refused.
 */
export async function openObjection(objectorId, targetId) {
    if (!game.user.isGM) return null;

    const floor = trialFloor();
    if (!floor) return null;
    if (!objectorId || !targetId || objectorId === targetId) return null;

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
    //               anything. The pair is not a private room — it is a pair the
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
    //               bought would never happen at all. Cutting in costs nothing
    //               during a rebuttal precisely because the rebuttal is what
    //               it becomes.
    //
    // Checked again on the caller's side before the card is posted (see
    // `presentDialog`), so a player is told why rather than watching their
    // objection land as an ordinary card. This is the rule; that is the
    // courtesy.
    if (floor.mode === FLOOR_MODES.objection) return null;

    const opened = await writeFloor({
        mode: FLOOR_MODES.objection,
        holderId: objectorId,
        targetId,
        startedAt: Date.now()
    });

    /*
     * AN OBJECTION RESTARTS THE OBJECTION MUSIC, ALWAYS (Dawid, 28.08).
     *
     * A rebuttal already plays the objection state — it is the answering half
     * of the same exchange, and changing the music under it would cut the
     * argument in two. So cutting INTO a rebuttal was, to the state machine, no
     * change at all: same state, nothing to do, and the loudest moment in a
     * trial arrived in silence.
     *
     * `refreshMusic` drops what is playing and re-applies the state rather than
     * comparing it, so the playlist advances — measured, three objections in a
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
             * that window into one apply — which is right for a clock turning
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
    const floor = trialFloor();
    if (!floor) return null;

    return writeFloor({ mode: FLOOR_MODES.rebuttal, startedAt: Date.now() });
}

/** Back to everybody talking at once. The GM's budget starts again. */
export async function returnToDiscussion({ seconds = null } = {}) {
    if (!game.user.isGM) return null;
    const floor = trialFloor();
    if (!floor) return null;

    return writeFloor({
        mode: FLOOR_MODES.discussion,
        holderId: null,
        targetId: null,
        seconds: seconds ?? floor.seconds ?? TRIAL.speakSeconds,
        startedAt: Date.now()
    });
}

/** Give the current mode more time, without changing whose it is. */
export async function extendFloor(extraSeconds = 30) {
    if (!game.user.isGM) return null;
    const floor = trialFloor();
    if (!floor) return null;

    // Pushing `startedAt` forward rather than growing a stored duration: the
    // duration of `objection` and `rebuttal` is a constant (see TRIAL), and
    // the clock everybody is reading is `now - startedAt`. Moving the start is
    // what "thirty more seconds" means to every client at once, with no extra
    // field for anyone to disagree about.
    return writeFloor({ startedAt: (floor.startedAt ?? Date.now()) + extraSeconds * 1000 });
}

/**
 * Close the debate. The TRIAL carries on.
 *
 * This used to be reachable only by ending the whole trial, which is why the
 * two were confused with each other: a GM who wanted the room to stop arguing
 * for a moment had to end the Class Trial to get it. The trial's phase is not
 * touched here — see `endClassTrial` in trial-floor-ui.mjs for the other one.
 */
export async function endFloor() {
    if (!game.user.isGM) return null;
    await game.settings.set(MODULE_ID, SETTINGS.trialQueue, {});
    return null;
}

/* ==========================================================================
 * AUTOMATIC TRANSITIONS
 * ========================================================================== */

/**
 * The same transition the clock would have made, made now.
 *
 * Stage 4's manual override: a minute of objection the GM wants over after
 * twenty seconds, a two-minute rebuttal that ran out of argument. It is
 * deliberately NOT "close the floor" — the trial carries on, the mode simply
 * moves to whatever came next anyway, so the GM is skipping a timer rather
 * than ending a scene.
 *
 * Free discussion has no next mode: it does not expire by design, so there is
 * nothing here to bring forward and this says so by doing nothing.
 */
export async function advanceFloorNow() {
    if (!game.user.isGM) return null;
    const floor = trialFloor();
    if (!floor) return null;

    if (floor.mode === FLOOR_MODES.objection) return openRebuttal();
    if (floor.mode === FLOOR_MODES.rebuttal) return returnToDiscussion();
    return null;
}

/**
 * Objection runs out into rebuttal; rebuttal runs out into discussion.
 *
 * EVERY client counts the clock — that is the point of deriving it from
 * `startedAt` — but exactly ONE client may write the transition, or two GMs
 * would both notice the same expiry in the same second and write it twice,
 * restarting the next mode's timer on the second write. `isPrimaryGm()` is the
 * same guard `trial.mjs` already uses to keep two GMs from racing on the
 * floor, applied to the same class of problem.
 *
 * Discussion deliberately does NOT expire. Running past the GM's budget turns
 * the clock red and nothing else: ending an argument is a judgement call, and
 * the module has no business making it.
 */
async function advanceIfDue() {
    const floor = trialFloor();
    if (!floor || !isPrimaryGm()) return;
    if (secondsLeft(floor) > 0) return;

    try {
        if (floor.mode === FLOOR_MODES.objection) await openRebuttal();
        else if (floor.mode === FLOOR_MODES.rebuttal) await returnToDiscussion();
    } catch (err) {
        error("Could not advance the trial floor to its next mode", err);
    }
}

/* ==========================================================================
 * THE CLOCK THAT MOVES THE MODES ALONG
 * --------------------------------------------------------------------------
 * THERE USED TO BE A BAR HERE, and it is now three rows of the campaign HUD —
 * see `buildTimeRow`, `paintElapsed` and `buildRoom` in hud.mjs. It appeared in
 * the place the table reads the time of day, at the one moment in a session
 * nobody has attention to spare for furniture moving, and it said three things
 * the clock already had rows for: which mode, how long is left, and who.
 *
 * What CANNOT move to the HUD is this: the one-second heartbeat that notices a
 * mode has run out and writes the transition. It has to keep running whether or
 * not anybody is looking at a clock, and only the primary GM's tick does any
 * work (see `advanceIfDue`) — every other client is counting the same seconds
 * off the same timestamp and needs nobody's permission to do it.
 *
 * `renderTrialFloor` keeps its name because sync.mjs and module.mjs call it and
 * the question it answers has not changed: the floor moved, react.
 * ========================================================================== */

export function registerTrialFloor() {
    Hooks.once("ready", renderTrialFloor);
    Hooks.on("canvasReady", renderTrialFloor);
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
            // client — so the tick checks rather than trusting that somebody
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
