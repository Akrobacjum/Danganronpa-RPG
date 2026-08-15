/**
 * Danganronpa RPG — who has the floor, and for how long.
 * ---------------------------------------------------------------------------
 * Guide, p. 31: "Gracze wypowiadają się w kolejności wskazówek zegara zaczynając
 * od ochotnika. Każdy ma maks trzy minuty nieprzerwanego monologu. Żeby
 * przerwać, inni gracze mogą zrobić Objection pod warunkiem, że pokażą Truth
 * Bullet na czacie w Foundry VTT. Wtedy oni zaczynają monolog - kolejka zmienia
 * miejsce."
 *
 * Two halves, and the interesting one is the second:
 *
 *   the queue   an order and a pointer, in a world setting so that every client
 *               is counting down the same three minutes rather than its own.
 *   the steal   an OBJECTION does not just interrupt — it takes the floor. That
 *               is already wired: `trial.mjs` posts the card, and this listens
 *               for it. Showing the evidence and taking the floor are one act
 *               in the guide, so they are one act here.
 *
 * The countdown is drawn from `startedAt` rather than ticked down and stored.
 * A stored counter drifts per client and has to be written every second; a
 * timestamp is written once when the floor moves, and every client can work out
 * the rest for itself.
 */

import { MODULE_ID, TRIAL } from "./config.mjs";
import { TRIAL_FLAGS } from "./trial.mjs";
import { getClock } from "./clock.mjs";
import { SETTINGS } from "./settings.mjs";
import { error } from "./utils.mjs";

const WIDGET_ID = "drpg-trial-floor";
let ticker = null;

/** The queue, or `null` when nobody is speaking. */
export function trialQueue() {
    const stored = game.settings.get(MODULE_ID, SETTINGS.trialQueue) ?? {};
    return stored.active ? stored : null;
}

async function writeQueue(patch) {
    if (!game.user.isGM) return null;
    const next = { ...(game.settings.get(MODULE_ID, SETTINGS.trialQueue) ?? {}), ...patch };
    await game.settings.set(MODULE_ID, SETTINGS.trialQueue, next);
    return next;
}

/** Seconds left on the current monologue. Negative once it has overrun. */
export function secondsLeft(queue = trialQueue()) {
    if (!queue?.startedAt) return 0;
    const spent = (Date.now() - queue.startedAt) / 1000;
    return Math.round((queue.seconds ?? TRIAL.speakSeconds) - spent);
}

/** Whoever currently holds the floor. */
export function speaker(queue = trialQueue()) {
    if (!queue) return null;
    return game.actors.get(queue.order?.[queue.current] ?? "") ?? null;
}

/* ==========================================================================
 * RUNNING THE QUEUE
 * ========================================================================== */

/**
 * Open the floor, starting from a volunteer.
 *
 * "Clockwise" is a thing that happens at a table, not in a database, so the
 * order is the living students by name rotated to begin at the volunteer —
 * stable, predictable, and the same on everybody's screen.
 */
export async function startFloor(volunteerId, { seconds = TRIAL.speakSeconds } = {}) {
    if (!game.user.isGM) return null;

    const { livingStudents } = await import("./chapter.mjs");
    const order = livingStudents()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(a => a.id);

    const at = order.indexOf(volunteerId);
    if (at < 0) return null;

    const rotated = [...order.slice(at), ...order.slice(0, at)];
    return writeQueue({
        active: true,
        order: rotated,
        current: 0,
        seconds,
        startedAt: Date.now()
    });
}

/** Hand the floor to the next person in the order. */
export async function nextSpeaker() {
    if (!game.user.isGM) return null;
    const queue = trialQueue();
    if (!queue) return null;

    return writeQueue({
        current: (queue.current + 1) % queue.order.length,
        startedAt: Date.now()
    });
}

/**
 * An Objection takes the floor.
 *
 * Called from `trial.mjs` the moment an objection card is posted, so the
 * evidence and the interruption are one act. A speaker objecting to themselves
 * would just reset their own clock, so that is refused.
 */
export async function seizeFloor(actorId) {
    if (!game.user.isGM) return null;
    const queue = trialQueue();
    if (!queue) return null;

    const at = queue.order.indexOf(actorId);
    if (at < 0 || at === queue.current) return null;

    return writeQueue({ current: at, startedAt: Date.now() });
}

/** Close the floor. */
export async function endFloor() {
    if (!game.user.isGM) return null;
    await game.settings.set(MODULE_ID, SETTINGS.trialQueue, {});
    return null;
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

        const queue = trialQueue();
        if (!queue) return;

        const host = document.querySelector("#ui-top") ?? document.querySelector("#ui-middle");
        if (!host) return;

        const bar = document.createElement("div");
        bar.id = WIDGET_ID;
        bar.className = "drpg-trial-floor";
        bar.addEventListener("pointerdown", event => event.stopPropagation());
        host.append(bar);

        const paint = () => {
            const live = trialQueue();
            if (!live) {
                renderTrialFloor();
                return;
            }
            const who = speaker(live);
            const left = secondsLeft(live);
            const over = left < 0;
            const mins = Math.floor(Math.abs(left) / 60);
            const secs = String(Math.abs(left) % 60).padStart(2, "0");

            bar.classList.toggle("overrun", over);
            // How much has actually been put on the table. A trial is argued
            // in evidence, and until now the only way to know how much had been
            // shown was to scroll the log back and count — during the one part
            // of the game where nobody has a spare hand. It sits with the
            // speaker and the clock because those are the three numbers the
            // whole table is tracking at once.
            const shown = evidenceShown();

            bar.innerHTML = `
                <span class="drpg-floor-label">${game.i18n.localize("DRPG.Floor.speaking")}</span>
                <span class="drpg-floor-name">${
                    foundry.utils.escapeHTML(who?.name ?? "—")}</span>
                <span class="drpg-floor-time">${over ? "+" : ""}${mins}:${secs}</span>
                <span class="drpg-floor-evidence" data-tooltip="${
                    game.i18n.localize("DRPG.Floor.evidenceHint")}">${
                    game.i18n.format("DRPG.Floor.evidence", { n: shown })}</span>`;
        };

        paint();
        // One second is plenty for a three-minute clock, and the paint is a
        // dozen characters of text — no reason to animate it.
        ticker = setInterval(paint, 1000);
    } catch (err) {
        error("Could not render the trial floor", err);
    }
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
