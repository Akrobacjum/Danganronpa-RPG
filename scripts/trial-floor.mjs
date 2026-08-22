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
import { TRIAL_FLAGS } from "./trial.mjs";
import { getClock } from "./clock.mjs";
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
    if (floor.mode !== FLOOR_MODES.discussion) return null;

    return writeFloor({
        mode: FLOOR_MODES.objection,
        holderId: objectorId,
        targetId,
        startedAt: Date.now()
    });
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

/** Close the floor entirely. */
export async function endFloor() {
    if (!game.user.isGM) return null;
    await game.settings.set(MODULE_ID, SETTINGS.trialQueue, {});
    return null;
}

/* ==========================================================================
 * AUTOMATIC TRANSITIONS
 * ========================================================================== */

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
 * the bar red and nothing else: ending an argument is a judgement call, and
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
 * THE WIDGET
 * ========================================================================== */

export function registerTrialFloor() {
    Hooks.once("ready", renderTrialFloor);
    Hooks.on("canvasReady", renderTrialFloor);
}

/** Draw (or remove) the floor bar. Safe to call as often as you like. */
export function renderTrialFloor() {
    try {
        document.getElementById(WIDGET_ID)?.remove();
        if (ticker) {
            clearInterval(ticker);
            ticker = null;
        }

        const floor = trialFloor();
        if (!floor) return;

        const host = document.querySelector("#ui-top") ?? document.querySelector("#ui-middle");
        if (!host) return;

        const bar = document.createElement("div");
        bar.id = WIDGET_ID;
        bar.className = "drpg-trial-floor";
        bar.addEventListener("pointerdown", event => event.stopPropagation());
        host.append(bar);

        const paint = () => {
            const live = trialFloor();
            if (!live) {
                renderTrialFloor();
                return;
            }

            const left = secondsLeft(live);
            const over = left < 0;
            const mins = Math.floor(Math.abs(left) / 60);
            const secs = String(Math.abs(left) % 60).padStart(2, "0");

            // Overrun only means anything in a discussion — the other two modes
            // end themselves the moment they hit zero, so a red bar there would
            // just be the half-second before the transition lands.
            bar.classList.toggle("overrun", over && live.mode === FLOOR_MODES.discussion);
            bar.classList.toggle("objection", live.mode === FLOOR_MODES.objection);
            bar.classList.toggle("rebuttal", live.mode === FLOOR_MODES.rebuttal);

            bar.innerHTML = `
                <span class="drpg-floor-label">${game.i18n.localize(
                    `DRPG.Floor.mode.${live.mode}`)}</span>
                <span class="drpg-floor-name">${foundry.utils.escapeHTML(whoLine(live))}</span>
                <span class="drpg-floor-time">${over ? "+" : ""}${mins}:${secs}</span>
                <span class="drpg-floor-evidence" data-tooltip="${
                    game.i18n.localize("DRPG.Floor.evidenceHint")}">${
                    game.i18n.format("DRPG.Floor.evidence", { n: evidenceShown() })}</span>`;

            // Checked on the same beat the bar is painted, so the transition
            // lands within a second of the clock everybody is watching hitting
            // zero. Only the primary GM's call does anything (see above).
            advanceIfDue();
        };

        paint();
        // One second is plenty for a clock counting minutes, and the paint is a
        // dozen characters of text — no reason to animate it.
        ticker = setInterval(paint, 1000);
    } catch (err) {
        error("Could not render the trial floor", err);
    }
}

/** Who the bar names, which is a different question in each mode. */
function whoLine(floor) {
    const holder = floorHolder(floor)?.name ?? "—";

    if (floor.mode === FLOOR_MODES.objection) return holder;
    if (floor.mode === FLOOR_MODES.rebuttal) {
        return `${holder} ${game.i18n.localize("DRPG.Floor.versus")} ${
            floorTarget(floor)?.name ?? "—"}`;
    }
    // A free discussion has no holder to name, so the bar says so rather than
    // printing a dash the eye reads as "loading".
    return game.i18n.localize("DRPG.Floor.everyone");
}

/**
 * Truth Bullets presented in THIS chapter's trial.
 *
 * Scoped by chapter, because the log outlives the trial: without it a second
 * trial would open showing the first one's count and quietly claim the table
 * had already done its work.
 */
function evidenceShown() {
    try {
        const chapter = getClock().chapter;
        let n = 0;
        for (const message of game.messages) {
            if (!message.getFlag(MODULE_ID, TRIAL_FLAGS.present)) continue;
            if (message.getFlag(MODULE_ID, TRIAL_FLAGS.chapter) !== chapter) continue;
            n++;
        }
        return n;
    } catch {
        return 0;
    }
}
