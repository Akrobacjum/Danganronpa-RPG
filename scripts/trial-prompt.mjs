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
 */

import { MODULE_ID } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { error, ownerOf, dialogContent } from "./utils.mjs";
import { alreadyOpen } from "./live.mjs";
import { isRoundMode } from "./floor-machine.mjs";

const DialogV2 = foundry.applications.api.DialogV2;
const WINDOW_CLASS = "drpg-your-turn";
let ticker = null;
let calledOver = null;
let promptedFor = null;

/** This player's student in the round's order (the first, for an account with two), or null. */
function myParticipant(floor) {
    if (game.user.isGM) return null;
    return (floor?.round?.order ?? []).find(id => ownerOf(game.actors.get(id))?.id === game.user.id) ?? null;
}

/** The step a floor's turn is: the round's start and its step, or null outside a round's own turn. */
function turnKey(floor) {
    return floor && isRoundMode(floor.mode) && floor.round ? `${floor.round.openedAt ?? "-"}|${floor.round.step}` : null;
}

/** The speaker's window, for the turn `floor` holds, when the speaker is this player's own student. */
async function promptTurn(floor) {
    const key = turnKey(floor);
    const actor = game.actors.get(floor?.holderId ?? "");
    if (!key || !actor || game.user.isGM || ownerOf(actor)?.id !== game.user.id) return;
    if (promptedFor === key || alreadyOpen(WINDOW_CLASS)) return;
    promptedFor = key;
    const { trialFloor } = await import("./trial-floor.mjs");
    const step = floor.round.step;
    const mode = game.i18n.localize(`DRPG.Floor.mode.${floor.mode}`);
    const choice = await DialogV2.wait({
        window: { title: game.i18n.format("DRPG.Trial.turn.title", { seconds: floor.seconds }) },
        classes: ["drpg-panel", WINDOW_CLASS],
        content: dialogContent(`<p>${game.i18n.format("DRPG.Trial.turn.body", { mode: foundry.utils.escapeHTML(mode) })}</p>`),
        buttons: [
            { action: "done", label: game.i18n.localize("DRPG.Trial.turn.done"), default: true },
            { action: "pass", label: game.i18n.localize("DRPG.Trial.turn.pass") }
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
        const key = turnKey(floor);
        if (!key) return;
        promptTurn(floor).catch(err => error("Could not open the round's turn window", err));
        const mine = myParticipant(floor);
        if (!mine || calledOver === key || msLeft(floor) > 0) return;
        calledOver = key;
        const { requestTurn } = await import("./gm-bridge.mjs");
        await requestTurn({ actorId: mine, kind: "over", step: floor.round.step });
    } catch (err) {
        error("Could not read the round's turn", err);
    }
}

/** Start or stop the participant's clock to match the floor; called on every write of the floor (and at ready). */
export async function renderTrialPrompt() {
    try {
        const { trialFloor } = await import("./trial-floor.mjs");
        const floor = trialFloor();
        const round = Boolean(turnKey(floor)) && !game.user.isGM;
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
