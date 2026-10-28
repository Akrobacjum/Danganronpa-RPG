/**
 * Danganronpa RPG - a round's turn on a participant's own browser (E70 C7, 28.10.2026; E70-44, E70-45).
 * ---------------------------------------------------------------------------
 * Two things a player's browser does in Testimony and in a Panic Round, both asked of the primary GM by the bridge's
 * "trial.turn" and judged there (trial-modes.mjs `turnOnPrimary`): nothing here moves the floor.
 *
 *   YOUR TURN. When the round's speaker is this player's own student, a window "Your turn - {seconds} s" with Done
 *   (the turn is over) and Pass (the next speaker's turn). It closes itself when the round moves on - its seconds run
 *   out, the GM skips it, an Objection cuts in - and opens again for the next turn this player has. `alreadyOpen` keeps
 *   it one. The sound is sfx.mjs `yourTurn`, for the speaker's player alone.
 *
 *   A TURN RUN OUT. Every participant's browser counts the turn from the floor's stamp on the server's clock
 *   (trial-floor.mjs `msLeft`) and, once it reads zero, calls the turn over once for that step. The primary's
 *   heartbeat moves the turn on as well; a browser throttles that heartbeat in a tab nobody looks at (audit S06-38),
 *   and these calls are the round's road past it. The first that names the step moves it, the rest change nothing.
 *
 * A GM's browser does neither: a GM's students are the GM's spares, who pass at once when nobody plays them
 * (trial-floor.mjs `absentOf`), and the primary's own clock is its heartbeat.
 *
 * THE CLOSING ARGUMENT (E70 C8, 28.10.2026; E70-51, E70-55). In its volunteers' 30 s every participant's player is asked
 * "I'll sum up?" once ("trial.claim"; Not me is the default, so Enter volunteers nobody); its speaker gets the same
 * window as a round's, Done and Pass - Pass in a drawn or picked speaker's first 30 s hands the choice back to the GM,
 * later it ends the Closing (floor-machine.mjs) - and every participant's browser calls the speaker's time over as in a
 * round, and the volunteers' 30 s too (E70 fix p2-G3).
 */

import { MODULE_ID } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { error, ownerOf, dialogContent } from "./utils.mjs";
import { alreadyOpen } from "./live.mjs";
import { isRoundMode, MODES, closingOf } from "./floor-machine.mjs";

const DialogV2 = foundry.applications.api.DialogV2;
const WINDOW_CLASS = "drpg-your-turn";
let ticker = null;
let calledOver = null;
let promptedFor = null;
let claimedFor = null;
const CLAIM_CLASS = "drpg-closing-claim";

/** The Closing on `floor` in `phase`, or null (E70 C8). */
function closingIn(floor, phase) {
    return floor?.mode === MODES.closing && closingOf(floor)?.phase === phase ? closingOf(floor) : null;
}

/**
 * This player's student in the round's order (the first, for an account with two), or null; in the Closing, the
 * student this player takes part in the trial with (vote.mjs `trialParticipants`).
 */
async function myParticipant(floor) {
    if (game.user.isGM) return null;
    if (floor?.mode === MODES.closing) {
        const { trialParticipants } = await import("./vote.mjs");
        return trialParticipants().find(p => p.user?.id === game.user.id)?.actor?.id ?? null;
    }
    return (floor?.round?.order ?? []).find(id => ownerOf(game.actors.get(id))?.id === game.user.id) ?? null;
}

/** The step a floor's turn is: the round's start and its step, the Closing's speaker's, or null outside a turn. */
function turnKey(floor) {
    if (floor && isRoundMode(floor.mode) && floor.round) return `${floor.round.openedAt ?? "-"}|${floor.round.step}`;
    const closing = closingIn(floor, "speak");
    return closing ? `closing|${closing.openedAt ?? "-"}|${closing.step}` : null;
}

/** The step a turn's request names: the round's, or the Closing's. */
function stepOf(floor) {
    return floor?.round?.step ?? closingOf(floor)?.step ?? 0;
}

/**
 * "I'LL SUM UP" (E70 C8; E70-51): once a Closing, in its volunteers' window, to a player whose student takes part. The
 * window closes itself when the window does; the press asks the primary ("trial.claim"), which counts it or says why not.
 */
async function promptClaim(floor) {
    const closing = closingIn(floor, "volunteer");
    if (!closing || game.user.isGM) return;
    const key = String(closing.openedAt ?? "-");
    if (claimedFor === key || alreadyOpen(CLAIM_CLASS)) return;
    const actorId = await myParticipant(floor);
    if (!actorId) return;
    claimedFor = key;
    const { trialFloor, secondsLeft } = await import("./trial-floor.mjs");
    const still = () => String(closingIn(trialFloor(), "volunteer")?.openedAt ?? "") === key;
    const choice = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Floor.mode.closing") },
        classes: ["drpg-panel", CLAIM_CLASS],
        content: dialogContent(`<p>${game.i18n.format("DRPG.Trial.claim.body", { seconds: Math.max(secondsLeft(floor), 0) })}</p>`),
        buttons: [
            { action: "claim", label: game.i18n.localize("DRPG.Trial.claim.yes") },
            { action: "no", label: game.i18n.localize("DRPG.Trial.claim.no"), default: true }
        ],
        render: (event, dialog) => {
            const watch = setInterval(() => {
                if (!dialog.element?.isConnected) return void clearInterval(watch);
                if (still()) return;
                clearInterval(watch);
                dialog.close();
            }, 500);
        },
        rejectClose: false
    });
    if (choice !== "claim" || !still()) return;
    const { requestClaim } = await import("./gm-bridge.mjs");
    const res = await requestClaim({ actorId });
    if (res.ok) ui.notifications.info(game.i18n.localize("DRPG.Trial.claim.counted"));
}

/** The speaker's window, for the turn `floor` holds, when the speaker is this player's own student. */
async function promptTurn(floor) {
    const key = turnKey(floor);
    const actor = game.actors.get(floor?.holderId ?? "");
    if (!key || !actor || game.user.isGM || ownerOf(actor)?.id !== game.user.id) return;
    if (promptedFor === key || alreadyOpen(WINDOW_CLASS)) return;
    promptedFor = key;
    const { trialFloor } = await import("./trial-floor.mjs");
    const step = stepOf(floor);
    const mode = game.i18n.localize(`DRPG.Floor.mode.${floor.mode}`);
    // The Closing's speaker may hold less than the whole stretch (the rest after an exchange), and is told what Pass does.
    const closing = closingIn(floor, "speak");
    const { secondsLeft } = await import("./trial-floor.mjs");
    const seconds = closing ? Math.max(secondsLeft(floor), 0) : floor.seconds;
    const passLine = closing ? `<p class="notes">${game.i18n.localize(Number(closing.resignUntil) > 0
        ? "DRPG.Trial.turn.closingPassEarly" : "DRPG.Trial.turn.closingPass")}</p>` : "";
    const choice = await DialogV2.wait({
        window: { title: game.i18n.format("DRPG.Trial.turn.title", { seconds }) },
        classes: ["drpg-panel", WINDOW_CLASS],
        content: dialogContent(`<p>${game.i18n.format("DRPG.Trial.turn.body", { mode: foundry.utils.escapeHTML(mode) })}</p>${passLine}`),
        /* NOTHING ENDS ON ENTER (E70 fix p2-G3; the review's E70P2-R12): Done was the default, so a speaker clearing the
           window with Enter or Space while talking ended their own turn - and Back is refused in a round, and in the
           Closing it ended the whole Closing Argument. "Keep speaking" is the default and closes the window alone; the
           turn runs on its clock, the GM's bar still skips it. As the volunteers' window's "Not me". */
        buttons: [
            { action: "done", label: game.i18n.localize("DRPG.Trial.turn.done") },
            { action: "pass", label: game.i18n.localize("DRPG.Trial.turn.pass") },
            { action: "keep", label: game.i18n.localize("DRPG.Trial.turn.keep"), default: true }
        ],
        // Closed as soon as the floor is no longer this turn: the round moved on without the speaker's press.
        render: (event, dialog) => {
            const watch = setInterval(() => {
                if (!dialog.element?.isConnected) return void clearInterval(watch);
                if (turnKey(trialFloor()) === key) return;
                clearInterval(watch);
                dialog.close();
            }, 500);
        },
        rejectClose: false
    });
    if (choice !== "done" && choice !== "pass") return;
    if (turnKey(trialFloor()) !== key) return;
    const { requestTurn } = await import("./gm-bridge.mjs");
    await requestTurn({ actorId: actor.id, kind: choice, step });
}

/** Once a second while a round holds the floor: a turn run out on the server's clock is called over, once a step. */
async function tick() {
    try {
        const { trialFloor, msLeft } = await import("./trial-floor.mjs");
        const floor = trialFloor();
        const volunteering = closingIn(floor, "volunteer");
        if (volunteering) {
            promptClaim(floor).catch(err => error("Could not open the Closing Argument's volunteer window", err));
            /* The volunteers' 30 s called over as a turn's are (E70 fix p2-G3; the review's BEH-4; S06-38): the draw waited
               for the primary's heartbeat, which a GM's tab in the background throttles. Once a window, from a participant. */
            const key = `volunteer|${volunteering.openedAt ?? "-"}|${volunteering.step}`;
            if (calledOver === key || msLeft(floor) > 0) return;
            const mine = await myParticipant(floor);
            if (!mine) return;
            calledOver = key;
            const { requestTurn } = await import("./gm-bridge.mjs");
            await requestTurn({ actorId: mine, kind: "over", step: volunteering.step });
            return;
        }
        const key = turnKey(floor);
        if (!key) return;
        promptTurn(floor).catch(err => error("Could not open the round's turn window", err));
        const mine = await myParticipant(floor);
        if (!mine || calledOver === key || msLeft(floor) > 0) return;
        calledOver = key;
        const { requestTurn } = await import("./gm-bridge.mjs");
        await requestTurn({ actorId: mine, kind: "over", step: stepOf(floor) });
    } catch (err) {
        error("Could not read the round's turn", err);
    }
}

/** Start or stop the participant's clock to match the floor; called on every write of the floor (and at ready). */
export async function renderTrialPrompt() {
    try {
        const { trialFloor } = await import("./trial-floor.mjs");
        const floor = trialFloor();
        const round = (Boolean(turnKey(floor)) || Boolean(closingIn(floor, "volunteer"))) && !game.user.isGM;
        if (!round) {
            if (ticker) clearInterval(ticker);
            ticker = null;
            return;
        }
        if (!ticker) ticker = setInterval(() => { tick(); }, 1000);
        tick();
    } catch (err) {
        error("Could not start the round's turn on this browser", err);
    }
}

/** The hooks: the floor's setting written, and the page ready. */
export function registerTrialPrompt() {
    Hooks.once("ready", () => { renderTrialPrompt(); });
    Hooks.on("updateSetting", setting => {
        if (setting?.key === `${MODULE_ID}.${SETTINGS.trialQueue}`) renderTrialPrompt();
    });
}
