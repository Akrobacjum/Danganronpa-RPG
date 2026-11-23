/**
 * Danganronpa RPG - a round's turn on a participant's own browser (E70 C7, 28.10.2026; E70-44, E70-45).
 * ---------------------------------------------------------------------------
 * Two things a player's browser does in Testimony and in a Panic Round, both asked of the primary GM by the bridge's
 * "trial.turn" and judged there (trial-modes.mjs `turnOnPrimary`): nothing here moves the floor.
 *
 *   YOUR TURN. When the round's speaker is this player's own student, a window "Your turn - {seconds} s" with Done
 *   (the turn is over) and Pass (the next speaker's turn). It closes itself when the round moves on - its seconds run
 *   out, the GM skips it, an Objection cuts in - and opens again for the next turn this player has; closed by Keep
 *   speaking, it comes back `KEEP_SPEAKING_MS` later in the same turn (1.2.122). Its seconds are those left, kept true
 *   while it stands. `alreadyOpen` keeps it one. The sound is sfx.mjs `yourTurn`, for the speaker's player alone.
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

import { MODULE_ID, TRIAL } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { error, playerOwns } from "./utils.mjs";
import { drpgWindow, tipAttr, tipText } from "./ui-kit.mjs";
import { alreadyOpen } from "./live.mjs";
import { isRoundMode, MODES, closingOf } from "./floor-machine.mjs";

const WINDOW_CLASS = "drpg-your-turn";
let ticker = null;
let calledOver = null;
let promptedFor = null;
let claimedFor = null;
const CLAIM_CLASS = "drpg-closing-claim";
/** The objector's "Finish your turn now?" (E129 S0-SKIP): its class, and the Objection it was offered for. */
const FINISH_CLASS = "drpg-finish-turn";
let finishedFor = null;

/**
 * How long Keep speaking (or the X, or Escape) hides Your turn before it comes back with Done and Pass (1.2.122; CTRL-03,
 * CASE-38). Until 1.2.122 the window came once a turn: the default answer took Done and Pass away for the rest of it, and
 * nothing else on the speaker's screen ends a turn.
 */
export const KEEP_SPEAKING_MS = 20000;

/** The seconds a prompt shows: those left on the floor's clock, whole, never below zero (CASE-64, REFR-66). */
function leftNow(secondsLeft, floor) {
    return Math.max(Math.round(Number(secondsLeft(floor)) || 0), 0);
}

/**
 * A prompt's seconds kept true while it stands (REFR-66): each `[data-drpg-left]` of its body, and its title where the
 * window's title is an element (v14's; the harness's is a string). A GM's +30 s or -30 s moves the floor's start, and
 * the number on the window follows it.
 */
function paintLeft(dialog, seconds, titleKey = null) {
    for (const el of dialog?.element?.querySelectorAll?.("[data-drpg-left]") ?? []) el.textContent = String(seconds);
    const title = dialog?.window?.title;
    if (titleKey && title && typeof title === "object" && "textContent" in title) title.textContent = game.i18n.format(titleKey, { seconds });
}

/** A Scrum Debate's turn on `floor` (E110 C3): its zone in the `speak` phase, or null. */
function scrumTurn(floor) {
    return floor?.mode === MODES.scrum && floor.zone?.phase === "speak" && floor.holderId ? floor.zone : null;
}

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
    if (floor?.mode === MODES.closing || scrumTurn(floor)) {
        const { trialParticipants } = await import("./vote.mjs");
        return trialParticipants().find(p => p.user?.id === game.user.id)?.actor?.id ?? null;
    }
    return (floor?.round?.order ?? []).find(id => playerOwns(game.actors.get(id))) ?? null;
}

/** The step a floor's turn is: the round's start and its step, the Closing's speaker's, or null outside a turn. */
function turnKey(floor) {
    if (floor && isRoundMode(floor.mode) && floor.round) return `${floor.round.openedAt ?? "-"}|${floor.round.step}`;
    const closing = closingIn(floor, "speak");
    if (closing) return `closing|${closing.openedAt ?? "-"}|${closing.step}`;
    const scrum = scrumTurn(floor);
    return scrum ? `scrum|${scrum.openedAt ?? "-"}|${scrum.step}` : null;
}

/**
 * The Objection an objector may end now (E129 S0-SKIP; config.mjs `TRIAL.objectorMayFinish`): its own seconds running -
 * the bullet on the table - keyed by its start, or null. The rebuttal (two speakers) and the bullet's pick are not.
 */
function finishKey(floor) {
    if (!TRIAL.objectorMayFinish || floor?.mode !== MODES.objection || floor.pending || !floor.holderId) return null;
    return `objection|${floor.startedAt ?? "-"}|${floor.holderId}`;
}

/** The step a turn's request names: the round's, or the Closing's. */
function stepOf(floor) {
    return floor?.round?.step ?? closingOf(floor)?.step ?? scrumTurn(floor)?.step ?? 0;
}

/*
 * M13'S CARD (E21 C4, 06.11.2026; docs/design/windows.md, approved 04.11.2026 on DR-E44-M1 #14). Your turn and the
 * volunteers' window are kit windows (ui-kit.mjs `drpgWindow`), their footers by roles as the card draws Your turn: the
 * answer that keeps the turn running - Keep speaking, Not me - the primary, on the right and the first submit button in
 * the tree, so Enter and Space change nothing (E70 fix p2-G3's rule, kept); the two that end or hand on a turn - Done
 * and Pass, I'll sum up - secondaries on the left. No closing word: the primary closes the window and changes nothing,
 * as a closing word would, and the card shows none. Exported for the suite (R1365), which reads each footer's tree.
 */

/**
 * Your turn's footer: Keep speaking the primary; Done and Pass, in that order, on the left - and in a Scrum Debate's
 * turn (E110 C3; the handbook's "the speaker may post a short thesis") Post thesis after them.
 */
export function turnFooter({ thesis = false } = {}) {
    return {
        primary: { action: "keep", label: game.i18n.localize("DRPG.Trial.turn.keep") },
        secondary: [
            { action: "done", label: game.i18n.localize("DRPG.Trial.turn.done") },
            { action: "pass", label: game.i18n.localize("DRPG.Trial.turn.pass") },
            ...(thesis ? [{ action: "thesis", label: game.i18n.localize("DRPG.Trial.turn.thesis") }] : [])
        ]
    };
}

/**
 * THE SCRUM SPEAKER'S THESIS (E110 C3): one short line for the camp, asked of the primary ("trial.keyword", trial-zones.mjs
 * `thesisOnPrimary`), which posts it as the mode's card while the turn is this speaker's. Cancel posts nothing.
 */
async function promptThesis(actor) {
    const length = Number(TRIAL.modes?.zones?.scrum?.thesisLength) || 120;
    const text = await drpgWindow({
        title: game.i18n.localize("DRPG.Trial.turn.thesisTitle"),
        classes: ["drpg-panel", "drpg-scrum-thesis"],
        body: `<form><label>${game.i18n.localize("DRPG.Trial.turn.thesisLabel")}
            <input type="text" name="thesis" maxlength="${length}" autofocus ${tipAttr("DRPG.Tips.Trial.thesisLineTooltip")}></label></form>`,
        footer: {
            primary: { action: "post", label: game.i18n.localize("DRPG.Trial.turn.thesisPost"), tooltip: tipText("DRPG.Tips.Trial.thesisPostTooltip"),
                callback: (e, b, d) => d.element.querySelector("[name=thesis]")?.value ?? "" },
            close: "cancel"
        },
        rejectClose: false
    });
    if (typeof text !== "string" || text === "cancel" || !text.trim()) return;
    const { requestTrialKeyword } = await import("./gm-bridge.mjs");
    await requestTrialKeyword({ actorId: actor.id, text: text.trim() });
}

/** The volunteers' footer: Not me the primary, I'll sum up on the left. */
export function claimFooter() {
    return {
        primary: { action: "no", label: game.i18n.localize("DRPG.Trial.claim.no") },
        secondary: [{ action: "claim", label: game.i18n.localize("DRPG.Trial.claim.yes") }]
    };
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
    const choice = await drpgWindow({
        title: game.i18n.localize("DRPG.Floor.mode.closing"),
        classes: ["drpg-panel", CLAIM_CLASS],
        // The trial's prompts are kept above the sheet (stacking.mjs; E23 C5a).
        prompt: true,
        body: `<p>${game.i18n.format("DRPG.Trial.claim.body", { seconds: `<span data-drpg-left>${leftNow(secondsLeft, floor)}</span>` })}</p>`,
        footer: claimFooter(),
        render: (event, dialog) => {
            const watch = setInterval(() => {
                if (!dialog.element?.isConnected) return void clearInterval(watch);
                if (still()) return void paintLeft(dialog, leftNow(secondsLeft, trialFloor()));
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

/**
 * FINISH YOUR TURN NOW? (E129 S0-SKIP, 23.11.2026; the owner's note of session 0: "niech maja od tego pop up"). Once an
 * Objection's own seconds, to the objector's player: a window in the middle of the screen, kept above the sheet as the
 * trial's prompts are (`prompt`). Keep speaking, the primary, closes it and changes nothing, so Enter ends nothing (the
 * rule "Your turn" keeps); Finish my turn asks the primary ("trial.turn" kind "done", its step the Objection's start),
 * which moves the floor as the GM's Skip does. It closes itself when the Objection's seconds are over by any road, and is
 * not offered again for the same Objection once answered. The words are buttons with their verbs (docs/text-style.md
 * O11), not a bare Yes and No.
 */
async function promptFinish(floor) {
    const key = finishKey(floor);
    const actor = game.actors.get(floor?.holderId ?? "");
    if (!key || !actor || game.user.isGM || !playerOwns(actor)) return;
    if (finishedFor === key || alreadyOpen(FINISH_CLASS)) return;
    finishedFor = key;
    const { trialFloor, secondsLeft } = await import("./trial-floor.mjs");
    const step = Number(floor.startedAt) || 0;
    const seconds = leftNow(secondsLeft, floor);
    const choice = await drpgWindow({
        title: game.i18n.localize("DRPG.Trial.finish.title"),
        classes: ["drpg-panel", FINISH_CLASS],
        prompt: true,
        body: `<p>${game.i18n.format("DRPG.Trial.finish.body", { seconds: `<span data-drpg-left>${seconds}</span>` })}</p>`,
        footer: {
            primary: { action: "keep", label: game.i18n.localize("DRPG.Trial.turn.keep") },
            secondary: [{ action: "done", label: game.i18n.localize("DRPG.Trial.finish.yes") }]
        },
        render: (event, dialog) => {
            const watch = setInterval(() => {
                if (!dialog.element?.isConnected) return void clearInterval(watch);
                if (finishKey(trialFloor()) === key) return void paintLeft(dialog, leftNow(secondsLeft, trialFloor()));
                clearInterval(watch);
                dialog.close();
            }, 500);
        },
        rejectClose: false
    });
    if (choice !== "done" || finishKey(trialFloor()) !== key) return;
    const { requestTurn } = await import("./gm-bridge.mjs");
    await requestTurn({ actorId: actor.id, kind: "done", step });
}

/** The speaker's window, for the turn `floor` holds, when the speaker is this player's own student. */
async function promptTurn(floor) {
    const key = turnKey(floor);
    const actor = game.actors.get(floor?.holderId ?? "");
    if (!key || !actor || game.user.isGM || !playerOwns(actor)) return;
    if (promptedFor === key || alreadyOpen(WINDOW_CLASS)) return;
    promptedFor = key;
    const { trialFloor } = await import("./trial-floor.mjs");
    const step = stepOf(floor);
    const mode = game.i18n.localize(`DRPG.Floor.mode.${floor.mode}`);
    // The Closing's speaker may hold less than the whole stretch (the rest after an exchange), and is told what Pass does.
    const closing = closingIn(floor, "speak");
    const { secondsLeft } = await import("./trial-floor.mjs");
    /* The seconds left on the turn's clock, whole (a Scrum turn's can be a fraction, zone-machine.mjs `scrumTurnSeconds`),
       in every mode (1.2.122, CASE-64): a round's speaker given back the rest of a turn after an Objection was shown the
       whole turn's length, the Closing's alone the rest. Kept true while the window stands (`paintLeft`, REFR-66). */
    const seconds = leftNow(secondsLeft, floor);
    // The early Pass's seconds are the window floor-machine.mjs gives it (E66 fix r1 F9; STATUS Open 26).
    const passLine = closing ? `<p class="notes">${Number(closing.resignUntil) > 0
        ? game.i18n.format("DRPG.Trial.turn.closingPassEarly", { seconds: TRIAL.modes.closing.passWindowSeconds })
        : game.i18n.localize("DRPG.Trial.turn.closingPass")}</p>` : "";
    let closedByFloor = false;
    const choice = await drpgWindow({
        title: game.i18n.format("DRPG.Trial.turn.title", { seconds }),
        classes: ["drpg-panel", WINDOW_CLASS],
        prompt: true,
        body: `<p>${game.i18n.format("DRPG.Trial.turn.body", { mode: foundry.utils.escapeHTML(mode) })}</p>${passLine}
            <p class="drpg-turn-left">${game.i18n.format("DRPG.Trial.turn.left", { seconds: `<span data-drpg-left>${seconds}</span>` })}</p>
            <p class="notes">${game.i18n.format("DRPG.Trial.turn.keepNote", { seconds: Math.round(KEEP_SPEAKING_MS / 1000) })}</p>`,
        /* NOTHING ENDS ON ENTER (E70 fix p2-G3; the review's E70P2-R12): Done was the default, so a speaker clearing the
           window with Enter or Space while talking ended their own turn - and Back is refused in a round, and in the
           Closing it ended the whole Closing Argument. "Keep speaking" is the default and closes the window alone; the
           turn runs on its clock, the GM's bar still skips it. As the volunteers' window's "Not me". Since 1.2.122 the
           window comes back `KEEP_SPEAKING_MS` later while the turn is still this speaker's, so Done and Pass stay in
           reach (CTRL-03); the window says so. */
        footer: turnFooter({ thesis: Boolean(scrumTurn(floor)) }),
        // Closed as soon as the floor is no longer this turn: the round moved on without the speaker's press.
        render: (event, dialog) => {
            const watch = setInterval(() => {
                if (!dialog.element?.isConnected) return void clearInterval(watch);
                if (turnKey(trialFloor()) === key) return void paintLeft(dialog, leftNow(secondsLeft, trialFloor()), "DRPG.Trial.turn.title");
                clearInterval(watch);
                closedByFloor = true;
                dialog.close();
            }, 500);
        },
        rejectClose: false
    });
    if (choice === "thesis" && turnKey(trialFloor()) === key) {
        // The window closed on the thesis; the turn runs on, and the window opens again for the rest of it once the
        // thesis window is closed.
        await promptThesis(actor);
        if (turnKey(trialFloor()) === key) promptedFor = null;
        return;
    }
    if (choice !== "done" && choice !== "pass") {
        // Keep speaking, the X or Escape: hidden for a while, then offered again while the turn is still this speaker's.
        if (closedByFloor || turnKey(trialFloor()) !== key) return;
        setTimeout(() => {
            if (turnKey(trialFloor()) === key && promptedFor === key) promptedFor = null;
        }, KEEP_SPEAKING_MS);
        return;
    }
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
        // An Objection's own seconds (E129 S0-SKIP): the objector's window; nothing is called over here, the primary's clock runs it.
        if (finishKey(floor)) return void promptFinish(floor).catch(err => error("Could not open the objector's finish window", err));
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
async function renderTrialPrompt() {
    try {
        const { trialFloor } = await import("./trial-floor.mjs");
        const floor = trialFloor();
        const round = (Boolean(turnKey(floor)) || Boolean(closingIn(floor, "volunteer")) || Boolean(finishKey(floor))) && !game.user.isGM;
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
    /* Both hooks (1.2.122, CTRL-05): a world setting's first write makes its document, and Foundry fires createSetting for
       it, not updateSetting (gm-store.mjs and trial-scene.mjs hear both for the same reason); in a world whose floor was
       never written, the first mode started opened no prompt and called no turn over on any player. */
    for (const hook of ["updateSetting", "createSetting"]) {
        Hooks.on(hook, setting => {
            if (setting?.key === `${MODULE_ID}.${SETTINGS.trialQueue}`) renderTrialPrompt();
        });
    }
}
