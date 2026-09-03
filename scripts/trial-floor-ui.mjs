/**
 * Danganronpa RPG - the GM's controls for a Class Trial in session.
 *
 * Kept apart from `trial-floor.mjs` on purpose: that file is the shared clock
 * every client runs, and it has to stay cheap to import. This is the GM's
 * console for it, loaded only when they open it.
 */

import { TRIAL } from "./config.mjs";
import {
    trialFloor, floorHolder, floorTarget, secondsLeft, startFloor, endFloor,
    extendFloor, returnToDebate, advanceFloorNow, FLOOR_MODES
} from "./trial-floor.mjs";
import { dialogContent, plural, error, esc} from "./utils.mjs";
import { getClock, setClock } from "./clock.mjs";
import { alreadyOpen, keepLive } from "./live.mjs";

const DialogV2 = foundry.applications.api.DialogV2;

/* ==========================================================================
 * THE TRIAL AS A SEQUENCE
 * --------------------------------------------------------------------------
 * A Class Trial has an order, and until now nothing in the module knew it. The
 * trial opened straight into a debate that could not be closed without ending
 * the trial; ending the trial ended nothing and left the campaign stuck in the
 * Class Trial phase; and the vote, the verdict and the end of the chapter were
 * three buttons pressable in any order, including the destructive one first.
 *
 *   Start the Class Trial   the phase moves. Nothing else - the trial opens in
 *                           discussion, which is people talking, not a debate.
 *   Open Debate             the floor opens. From here evidence takes it.
 *   Close Debate            back to discussion, trial still running.
 *   Vote                    send the ballots, then count them.
 *   Verdict                 only once there is a count to deliver one on.
 *   End of chapter          only once the verdict has been applied.
 *   End the Class Trial     and Daily Life comes back.
 *
 * The gates are `trialProgress()` in vote.mjs. They disable rather than hide:
 * a GM needs to see that the verdict is coming and why it is not available yet,
 * which is what the note under each section says.
 * ========================================================================== */

/**
 * Start a Class Trial.
 *
 * IT DOES NOT OPEN THE DEBATE, and that is the change this window exists to
 * make. A trial begins with people talking about what they found - the guide's
 * discussion - and a Nonstop Debate is a thing the GM starts inside it, with
 * its own clock and its own rules about who may speak. Opening one
 * automatically meant every trial began in the restrictive mode and the GM had
 * no way back to the loose one except by ending the trial.
 *
 * THE DEBATE'S LENGTH IS NOT ASKED FOR HERE EITHER. It used to be, and it was
 * the wrong moment for it: a trial holds several debates, and how long each one
 * is worth is a judgement the GM makes with the argument in front of them
 * rather than half an hour earlier, before anybody has said anything. The
 * question moved to `openDebate`, which is where it is answerable.
 */
export async function startClassTrial() {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    if (getClock().phase === "classTrial") return null;

    const { livingStudents } = await import("./chapter.mjs");
    if (!livingStudents().length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Floor.nobody"));
        return null;
    }

    const result = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Floor.startTrial") },
        classes: ["drpg-panel"],
        content: dialogContent(`<form>
            <p>${game.i18n.localize("DRPG.Floor.startTrialIntro")}</p>
            <ul class="drpg-briefing-facts">
                <li>${game.i18n.localize("DRPG.Floor.startTrialStepPhase")}</li>
                <li>${game.i18n.localize("DRPG.Floor.startTrialStepDiscussion")}</li>
                <li>${game.i18n.localize("DRPG.Floor.startTrialStepAnnounce")}</li>
            </ul>
            <p class="notes">${game.i18n.localize("DRPG.Floor.startTrialNote")}</p>
        </form>`),
        buttons: [
            { action: "ok", label: game.i18n.localize("DRPG.Floor.startTrial"), default: true },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    if (!result || result === "cancel") return null;

    // ONE WRITE, TWO FACTS. The phase and the elapsed clock's stamp go together
    // - see `resetElapsed` - so the HUD redraws once. Two writes would redraw
    // it twice a few milliseconds apart, and the second redraw would land in
    // the middle of the turn-over animation the first one started.
    await setClock({ phase: "classTrial", timeOfDayStartedAt: Date.now() });

    // A fresh trial has not voted and has not delivered a verdict, whatever the
    // last one did. Stamped with this chapter, so the two cannot be confused.
    const { resetTrialProgress } = await import("./vote.mjs");
    await resetTrialProgress();

    // G-32, and it has to be AFTER the reset: the reset blanks this chapter's
    // trial record, and the "already charged" stamp lives in it. Charged before
    // it, the stamp would be wiped a line later and the next press would pay
    // Monokuma twice.
    const { chargeForUnfoundKeys } = await import("./investigation.mjs");
    await chargeForUnfoundKeys();

    const { announce } = await import("./utils.mjs");
    await announce({
        content: `<div class="drpg-card"><h3>${
            game.i18n.localize("DRPG.Floor.startTrial")}</h3><p>${
            game.i18n.localize("DRPG.Floor.trialOpened")}</p></div>`
    });

    return true;
}

/**
 * Open the Nonstop Debate, for as long as the GM thinks this one is worth.
 *
 * The moment the Objection rules come into force, which is why it is announced
 * rather than done quietly: until this happens a Truth Bullet goes on the table
 * as a Present and takes nothing from anybody, and from here the same button on
 * the same row is an Objection that takes the floor. The players' one button
 * changes meaning under them, so they are told.
 *
 * The length is asked for HERE, every time. A trial holds several debates and
 * they are not the same length - the first one opens wide and the one after a
 * confession is two minutes of tidying up - so the number belongs to the debate
 * rather than to the trial. The last one used is offered as the default,
 * because a table settles into a rhythm and re-typing it every time is a tax on
 * the rhythm rather than a decision.
 *
 * @param {number|{seconds?: number}} [options]  Skip the question and use this
 *   many seconds. A bare number is accepted as well as `{ seconds }`, because
 *   the console form a macro reaches for is `game.drpg.openDebate(180)` and
 *   being right about the shape is not a thing to make somebody guess.
 */
export async function openDebate(options = {}) {
    if (!game.user.isGM) return null;
    if (trialFloor()) return null;

    const { trialProgress, setTrialProgress } = await import("./vote.mjs");
    const remembered = trialProgress().seconds || TRIAL.speakSeconds;

    const given = typeof options === "number" ? options : options?.seconds;
    let budget = Number(given) || null;
    if (!budget) {
        const asked = await DialogV2.wait({
            window: { title: game.i18n.localize("DRPG.Floor.openDebate") },
            classes: ["drpg-panel", "drpg-narrow"],
            content: dialogContent(`<form>
                <p>${game.i18n.localize("DRPG.Floor.openDebateIntro")}</p>
                <label>${game.i18n.localize("DRPG.Floor.seconds")}
                    <input type="number" name="seconds" min="30" step="10"
                           value="${remembered}" /></label>
                <p class="notes">${game.i18n.localize("DRPG.Floor.discussionNote")}</p>
            </form>`),
            buttons: [
                {
                    action: "ok", label: game.i18n.localize("DRPG.Floor.openDebate"), default: true,
                    callback: (e, b, d) => ({
                        seconds: Number(d.element.querySelector("form").seconds.value) || remembered
                    })
                },
                { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
            ],
            rejectClose: false
        });
        if (!asked || asked === "cancel") return null;
        budget = asked.seconds;
    }

    // Remembered for the next one in this trial, which is what makes the
    // default above worth having.
    await setTrialProgress({ seconds: budget });
    await startFloor({ seconds: budget });

    const { announce } = await import("./utils.mjs");
    await announce({
        content: `<div class="drpg-card"><h3>${
            game.i18n.localize("DRPG.Floor.openDebate")}</h3><p>${
            game.i18n.localize("DRPG.Floor.debateOpened")}</p></div>`
    });
    return true;
}

/** Close it again. The trial carries on; the room goes back to talking. */
export async function closeDebate() {
    if (!game.user.isGM) return null;
    if (!trialFloor()) return null;

    await endFloor();

    const { announce } = await import("./utils.mjs");
    await announce({
        content: `<div class="drpg-card"><h3>${
            game.i18n.localize("DRPG.Floor.closeDebate")}</h3><p>${
            game.i18n.localize("DRPG.Floor.debateClosed")}</p></div>`
    });
    return true;
}

/**
 * End the Class Trial, and mean it.
 *
 * THIS IS THE HALF THAT WAS MISSING. It closed the floor and opened the vote,
 * and never touched the campaign phase - so the trial "ended" while every
 * screen in the game went on saying Class Trial, the action economy stayed
 * shut, and Daily Life had to be restored by hand from Edit Campaign. Ending a
 * trial is the campaign going back to ordinary play, and that is what this
 * does.
 *
 * It no longer opens the vote either. The vote is a step of the trial with its
 * own button above this one - running it on the way out put it after the thing
 * it is supposed to come before.
 *
 * The elapsed clock restarts, exactly as it does when the trial begins. A Class
 * Trial is a seam in play: the readout counting the afternoon that led up to it
 * is not about the trial, and the one counting the trial is not about the Daily
 * Life that follows. The handbook's "spend your first action inside fifteen
 * minutes" is advice about the time of day that is starting NOW, and it was
 * being given against a number that had been running since before the body was
 * found.
 */
export async function endClassTrial() {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    const confirmed = await DialogV2.confirm({
        classes: ["drpg-panel"],
        window: { title: game.i18n.localize("DRPG.Floor.endTrial") },
        content: `<p>${game.i18n.localize("DRPG.Floor.endTrialConfirm")}</p>`,
        rejectClose: false
    });
    if (!confirmed) return null;

    await endFloor();

    try {
        await setClock({ phase: "dailyLife", timeOfDayStartedAt: Date.now() });
    } catch (err) {
        // The floor is shut either way. A phase that did not move is something
        // the GM can fix from Edit Campaign; a debate still running is not.
        error("Could not return the campaign to Daily Life", err);
    }

    const { announce } = await import("./utils.mjs");
    await announce({
        content: `<div class="drpg-card"><h3>${
            game.i18n.localize("DRPG.Floor.endTrial")}</h3><p>${
            game.i18n.localize("DRPG.Floor.trialClosed")}</p></div>`
    });
    return true;
}

/**
 * ONE DOOR TO THE CLASS TRIAL.
 * ---------------------------------------------------------------------------
 * All of it, in the order a trial happens, read top to bottom:
 *
 *   the trial     is it running, and the button that starts or ends it
 *   the debate    open it, close it, and the three manual overrides for an
 *                 objection or a rebuttal already in progress
 *   the vote      who has not voted yet, then the verdict, then the chapter
 *
 * NO SECTION EVER DISAPPEARS. When nothing is running they hold one sentence
 * saying so. A section that vanishes teaches a GM that this window "sometimes
 * does not work", which is the wrong lesson from the right facts and the reason
 * they go looking for a second window to check.
 */
export async function manageClassTrial() {
    // ONE OF THESE, NOT FOUR - see `alreadyOpen` in live.mjs. Two copies of a
    // window each read the world when they opened and neither knows about the
    // other, so the older one goes on looking authoritative while showing
    // something that stopped being true. Raised rather than refused: pressing
    // twice usually means the window is behind something.
    if (alreadyOpen("drpg-window-trial")) return null;

    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    const { inFinalTrial } = await import("./mastermind.mjs");
    const { pendingVoters, trialProgress } = await import("./vote.mjs");

    /*
     * READ FRESH EVERY TIME, because this window is open while the floor moves
     * under it (E22, measured in E17).
     *
     * The console used to compute all of this once and then sit there. A player
     * objecting, a minute running out, the last vote arriving - none of it
     * reached the screen, and the GM was reading a photograph of the moment they
     * opened it. Measured before this: the whole window byte-identical across an
     * Eclipse starting and ending underneath it.
     */
    const read = () => {
        const floor = trialFloor();
        const running = getClock().phase === "classTrial";
        const progress = trialProgress();
        return {
            floor, running, progress,
            restrictive: Boolean(floor) && floor.mode !== FLOOR_MODES.debate,
            finalNow: inFinalTrial(),
            pending: pendingVoters(),
            // THE LAST THREE STEPS OUTLIVE THE TRIAL, and they have to: ending
            // the trial puts the campaign back into Daily Life, and a GM who
            // does that before delivering the verdict must not find that the
            // buttons for it have gone with the phase.
            afterwards: running || progress.voteClosed || progress.verdictApplied
        };
    };

    const buildConsole = () => {
        const { floor, running, restrictive, finalNow, progress, pending, afterwards } = read();
        const left = floor ? secondsLeft(floor) : 0;
        const holder = floorHolder(floor);
        const target = floorTarget(floor);

        const debateLine = !floor
            ? `<p class="notes">${game.i18n.localize(running
                ? "DRPG.Floor.inDiscussion" : "DRPG.Floor.noDebate")}</p>`
            : floor.mode === FLOOR_MODES.debate
                ? `<p>${game.i18n.format("DRPG.Floor.holdingDiscussion", { seconds: left })}</p>`
                : floor.mode === FLOOR_MODES.objection
                    ? `<p>${game.i18n.format("DRPG.Floor.holdingObjection", {
                        who: esc(holder?.name ?? "-"), target: esc(target?.name ?? "-"), seconds: left
                    })}</p>`
                    : `<p>${game.i18n.format("DRPG.Floor.holdingRebuttal", {
                        who: esc(holder?.name ?? "-"), target: esc(target?.name ?? "-"), seconds: left
                    })}</p>`;

        // Who has not voted yet, if a vote is open at all. Names only: who has
        // voted is not how they voted, and only the second is the secret the
        // guide keeps. Same read as the vote window's own.
        const voteLine = pending === null
            ? `<p class="notes">${game.i18n.localize(progress.voteClosed
                ? "DRPG.Vote.counted" : "DRPG.Vote.notRunning")}</p>`
            : pending.length
                ? `<p class="drpg-warning">${game.i18n.format("DRPG.Vote.stillOut", {
                    n: pending.length, who: esc(pending.map(v => v.name).join(", "))
                })}</p>`
                : `<p class="notes">${game.i18n.localize("DRPG.Vote.allIn")}</p>`;

        // What the two gated steps are waiting for, said out loud. A disabled
        // button with no explanation is a bug report.
        const gateLine = !progress.voteClosed
            ? `<p class="notes">${game.i18n.localize("DRPG.Floor.gateVote")}</p>`
            : !progress.verdictApplied
                ? `<p class="notes">${game.i18n.localize("DRPG.Floor.gateVerdict")}</p>`
                : `<p class="notes">${game.i18n.localize("DRPG.Floor.gateDone")}</p>`;

        return `<div class="drpg-trial-console">
            <h4>${game.i18n.localize("DRPG.Floor.sectionTrial")}</h4>
            <p>${game.i18n.localize(running
                ? "DRPG.Floor.manageRunning" : "DRPG.Floor.manageNotRunning")}</p>
            ${finalNow ? `<p class="drpg-warning">${
                game.i18n.localize("DRPG.Mastermind.finalRunningNote")}</p>` : ""}

            <h4>${game.i18n.localize("DRPG.Floor.sectionDebate")}</h4>
            ${debateLine}
            ${floor ? `<p class="notes">${game.i18n.localize(restrictive
                ? "DRPG.Floor.modeNote" : "DRPG.Floor.objectionNote")}</p>` : ""}

            <h4>${game.i18n.localize("DRPG.Floor.sectionVote")}</h4>
            ${voteLine}
            ${afterwards ? gateLine : ""}
        </div>`;
    };

    /*
     * WHAT THE BUTTONS ARE, IN ONE STRING.
     *
     * `keepLive` rebuilds a region of the CONTENT; it cannot add a button to a
     * DialogV2 footer that was built once. And a window whose text is true while
     * its buttons are stale is exactly the half-live shape trap 171 is about -
     * the GM panel's murder tile, all over again.
     *
     * So when the SET of available buttons would change, the window opens again
     * instead. That is not a special case bolted on: every action in this
     * console already ends with `return manageClassTrial()`, because the GM
     * should land on the screen they pressed the button from. This makes a
     * change arriving from somebody else behave the same as one they made.
     */
    const signature = () => {
        const { floor, running, restrictive, finalNow, progress, afterwards } = read();
        return [running, Boolean(floor), restrictive, finalNow, afterwards,
            progress.voteClosed, progress.verdictApplied].join("|");
    };

    const view = read();
    const { floor, running, restrictive, finalNow, progress, afterwards } = view;

    // WHICH BUTTON ENTER PRESSES, worked out once.
    //
    // Nine buttons can be on this window at the tensest moment of a session,
    // and each branch used to declare its own `default: <some condition>` -
    // which is how a window ends up with two defaults in one state and none in
    // another. Named here instead: exactly one action is the next step, and it
    // is by construction one that is present and not disabled.
    const defaultAction =
        !afterwards ? "start"
            : restrictive ? "now"
                : (running && !floor) ? "openDebate"
                    : !progress.voteClosed ? "vote"
                        : !progress.verdictApplied ? "verdict"
                            : "chapterEnd";
    const isDefault = action => defaultAction === action;

    const openedWith = signature();
    let reopening = false;

    const action = await DialogV2.wait({
        classes: ["drpg-panel", "drpg-window-trial"],
        window: { title: game.i18n.localize("DRPG.Floor.manageTrial") },
        content: dialogContent(buildConsole()),
        buttons: [
            ...(running
                ? [
                    // The debate toggle first: it is the button pressed most
                    // often in a trial, several times in each one.
                    floor
                        ? { action: "closeDebate", label: game.i18n.localize("DRPG.Floor.closeDebate") }
                        : { action: "openDebate", default: isDefault("openDebate"),
                            label: game.i18n.localize("DRPG.Floor.openDebate") },
                    // A debate in free discussion has nothing to cut short - it
                    // deliberately does not expire (see `advanceIfDue`), so
                    // "end now" would have nothing to end.
                    ...(restrictive
                        ? [{ action: "now", label: game.i18n.localize("DRPG.Floor.endNow"),
                            default: isDefault("now") },
                           { action: "debate", label: game.i18n.localize("DRPG.Floor.backToDebate") }]
                        : []),
                    ...(floor ? [{ action: "extend", label: game.i18n.localize("DRPG.Floor.extend") }] : [])
                  ]
                : []),
            ...(afterwards
                ? [
                    { action: "vote", label: game.i18n.localize("DRPG.Vote.openTitle"),
                      default: isDefault("vote") },
                    // Disabled rather than hidden, so the order of the trial is
                    // visible from the first time this window is opened.
                    { action: "verdict", label: game.i18n.localize("DRPG.Vote.verdictTitle"),
                      disabled: !progress.voteClosed, default: isDefault("verdict") },
                    { action: "chapterEnd", label: game.i18n.localize("DRPG.Chapter.endTitle"),
                      disabled: !progress.verdictApplied, default: isDefault("chapterEnd") }
                  ]
                : []),
            ...(running
                ? [{ action: "end", label: game.i18n.localize("DRPG.Floor.endTrial") }]
                : [{ action: "start", default: isDefault("start"),
                     label: game.i18n.localize("DRPG.Floor.startTrial") }]),
            // Labelled by state rather than "start or end": one button doing
            // two opposite things is a coin flip when the GM reads quickly.
            { action: "toggleFinal", label: game.i18n.localize(finalNow
                ? "DRPG.Mastermind.endFinalTrial" : "DRPG.Mastermind.startFinalTrial") },
            { action: "close", label: game.i18n.localize("DRPG.Panel.close") }
        ],
        render: (event, dialog) => keepLive(dialog, {
            region: ".drpg-trial-console",
            build: buildConsole,
            after: () => {
                if (reopening || signature() === openedWith) return;
                reopening = true;
                /*
                 * AWAITED, and the first run of this closed the window and left
                 * nothing behind. `close()` is asynchronous and `alreadyOpen`
                 * refuses a second copy - so reopening in the same tick asked
                 * for a window while the old one was still there, was correctly
                 * refused, and the GM was left looking at the scene.
                 *
                 * Closing resolves the `DialogV2.wait` above with null, which
                 * the handler below already returns for - so the reopen belongs
                 * here rather than smuggled into the action chain.
                 */
                dialog.close()
                    .then(() => manageClassTrial())
                    .catch(err => error("Could not reopen the trial console", err));
            }
        }),
        rejectClose: false
    });

    // Everything comes back here, so the GM lands on the screen they pressed
    // the button from rather than on the scene - the same pattern the GM panel
    // uses for its tiles.
    if (!action || action === "close") return null;

    if (action === "start") {
        await startClassTrial();
        return manageClassTrial();
    }
    if (action === "end") {
        await endClassTrial();
        return manageClassTrial();
    }
    if (action === "openDebate") {
        await openDebate();
        return manageClassTrial();
    }
    if (action === "closeDebate") {
        await closeDebate();
        return manageClassTrial();
    }
    if (action === "now") {
        await advanceFloorNow();
        return manageClassTrial();
    }
    if (action === "debate") {
        await returnToDebate();
        return manageClassTrial();
    }
    if (action === "extend") {
        await extendFloor(30);
        return manageClassTrial();
    }
    if (action === "vote") {
        await openVoteDialog();
        return manageClassTrial();
    }
    if (action === "verdict") {
        const { openVerdictDialog } = await import("./vote.mjs");
        await openVerdictDialog();
        return manageClassTrial();
    }
    if (action === "chapterEnd") {
        const { openChapterEndDialog } = await import("./chapter.mjs");
        await openChapterEndDialog();
        return manageClassTrial();
    }
    if (action === "toggleFinal") {
        const { toggleFinalTrialFlag } = await import("./mastermind.mjs");
        await toggleFinalTrialFlag();
        return manageClassTrial();
    }
    return null;
}

/** Open or close the vote. One button, because it is one moment either way. */
export async function openVoteDialog() {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    const { openVote, closeVote, pendingVoters, remindVoters } = await import("./vote.mjs");

    // Who is still outstanding, while a vote is running.
    //
    // Counting the vote is irreversible and the counts only appear once it is
    // closed, so "has everybody voted?" used to be a question this screen could
    // not answer - a player who dismissed their ballot by accident was simply
    // never counted and nobody could tell. Names only: who has voted is not how
    // they voted, and only the second is the secret the guide keeps.
    const pending = pendingVoters();
    const status = pending === null
        ? `<p class="notes">${game.i18n.localize("DRPG.Vote.notRunning")}</p>`
        : pending.length
            ? `<p class="drpg-warning">${game.i18n.format("DRPG.Vote.stillOut", {
                n: pending.length,
                who: foundry.utils.escapeHTML(pending.map(p => p.name).join(", "))
            })}</p>`
            : `<p class="notes">${game.i18n.localize("DRPG.Vote.allIn")}</p>`;

    const action = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Vote.openTitle") },
        classes: ["drpg-panel"],
        content: dialogContent(`<div>
            <p>${game.i18n.localize("DRPG.Vote.openIntro")}</p>
            ${status}
            <p class="notes">${game.i18n.localize("DRPG.Vote.privacyNote")}</p>
        </div>`),
        buttons: [
            { action: "open", label: game.i18n.localize("DRPG.Vote.send"), default: true },
            ...(pending?.length
                ? [{ action: "remind", label: game.i18n.format("DRPG.Vote.remind", { n: pending.length }) }]
                : []),
            { action: "close", label: game.i18n.localize("DRPG.Vote.tally") },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    if (action === "open") return openVote();
    if (action === "remind") {
        ui.notifications.info(plural("DRPG.Vote.reminded", { n: remindVoters() }));
        return openVoteDialog();
    }
    if (action === "close") return closeVote();
    return null;
}
