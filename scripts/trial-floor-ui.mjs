/**
 * Danganronpa RPG - the GM's controls for a Class Trial in session.
 *
 * Kept apart from `trial-floor.mjs` on purpose: that file is the shared clock
 * every client runs, and it has to stay cheap to import. This is the GM's
 * console for it, loaded only when they open it.
 */

import { MODULE_ID, TRIAL } from "./config.mjs";
import {
    trialFloor, floorHolder, floorTarget, secondsLeft, startFloor, endFloor,
    returnToDebate, FLOOR_MODES, floorFamily, BAR_OPS, barRefusal, skipStep, adjustTime, endMode, overruleObjection
} from "./trial-floor.mjs";
import { topicOf } from "./floor-machine.mjs";
import { dialogContent, placeRoomOptions, plural, error, esc, serverNow } from "./utils.mjs";
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
 *   Start the Class Trial   the phase moves, and the phase opens the trial's
 *                           budget (T-1). The trial opens in discussion, which
 *                           is people talking, not a debate.
 *   Open Debate             the floor opens. From here evidence takes it.
 *   Close Debate            back to discussion, trial still running.
 *   Vote                    send the ballots, then count them.
 *   Verdict                 only once there is a count to deliver one on, and
 *                           only once (F2).
 *   End of chapter          reachable before the verdict, the default after it.
 *   End the Class Trial     and Daily Life comes back.
 *
 * The gates are `trialProgress()` in vote.mjs. They disable rather than hide:
 * a GM needs to see that the verdict is coming and why it is not available yet,
 * which is what the note under each section says.
 * ========================================================================== */

/**
 * A CARD OF THE TRIAL'S IN THE CHAT, TOLD AS SOMETHING THAT HAPPENED (E10 C15, 1.2.71; audit S06-31).
 * The four cards - the trial begins, the debate opens, the debate closes, the trial is over - were
 * headed with the button's own label ("Start the Class Trial", "Open Debate", "Close Debate", "End the
 * trial"), which a player reads as an order given to them and not as news, and the end card was a small
 * h3 where the vote's two cards are a red banner: two cards of one trial that did not look alike. They
 * are the vote's own markup now (`drpg-evidence-card` and its banner, vote.mjs `openVote`), each with a
 * title key of its own. The body keys (`Floor.debateOpened`, `debateClosed`, `trialClosed`,
 * `trialOpened`) are unchanged: tier 2 finds an end card by the words of its body.
 */
export function trialEventCard(titleKey, ...paragraphs) {
    return `<div class="drpg-evidence-card">
            <div class="drpg-objection-banner">${game.i18n.localize(titleKey)}</div>
            ${paragraphs.map(text => `<p>${text}</p>`).join("\n            ")}
        </div>`;
}

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

    /* NOT IN AN ECLIPSE (E10 C12, 1.2.71; audit S06-18). In the dark Analyze and an Objection - the
       trial's two paid moves - are refused, and the HUD hides the chevron that ends the Eclipse (the
       audit's reading, not re-measured here), so a trial opened in one sat with its rules switched
       off. Refused before any window opens, and told. */
    const { isEclipse, isDeceased } = await import("./settings.mjs");
    if (isEclipse()) {
        ui.notifications.warn(game.i18n.localize("DRPG.Floor.eclipseFirst"));
        return null;
    }

    /* WHO IS ALIVE, AS THE GMS HOLD THEM (E10 C12; the census's row for this button). The count
       was `livingStudents()`, off the documents, which a student's owner can write: a `deceased`
       flag written from a console is put back by the GMs' audit (GM_FLAGS) a server round trip
       later, and a click inside that window read it. Every write queued on a student is judged
       first (`judgedFor`), then each is read as the primary holds it (`flagsHeldNow`) in one
       synchronous pass, as the vote's `trialParticipants` reads them; on another GM's browser,
       which keeps no mark, the document's. */
    const { studentActors } = await import("./monokuma.mjs");
    const { judgedFor, flagsHeldNow } = await import("./sheet-audit.mjs");
    const students = studentActors();
    await judgedFor(...students.map(actor => actor.id));
    const living = students.filter(actor => !isDeceased(flagsHeldNow(actor)));
    if (!living.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Floor.nobodyForTrial"));
        return null;
    }

    /* WHERE THE TABLE GOES, AND ITS RULE (E13 C6, 12.10.2026; plan-E13 C6, D8, doneWhen 4). Since C3 the
       phase takes every browser to the trial hall, and this window said nothing of it; it now names the
       hall, or that none is linked and the table stays (trial-scene.mjs `startTrialLines`), and the
       table's rule "the dead listen but do not speak in the trial" as one sentence beside the button.
       WHO TAKES PART (E81 DZ6, 12.10.2026; the owner: "kto bierze udział, a kogo nie przenosić"): with a
       hall linked the window holds the cast picker the Scenes tab draws (`castPickerHtml`), an actor a
       tick, prefilled from the GMs' stored choice or `defaultReveal` over the flags as the GMs hold them
       (`readCastActors`, one synchronous pass after `judgedFor` above, H3); until then it counted the
       tokens the entry would show, a number that goes stale as soon as a tick moves. Start stores the
       ticks the GM changed (`readCastPicker`, as the tab's Apply) only after both questions below said
       yes and before the phase moves, so the entry reads them; Cancel, or a no to either question,
       stores nothing and starts nothing. The hall's textures are asked for on every connected client while the GM
       reads (`Scenes#preload` with `push`), not awaited: what that saves at a table is not measured
       (the harness keeps the call and loads nothing, LIVE-E13-02's ground). R437, scenario 41 k1. */
    const { trialScene } = await import("./rooms.mjs");
    const { castPickerHtml, readCastPicker, saveTrialCast, startTrialLines } = await import("./trial-scene.mjs");
    const hall = trialScene();
    if (hall) Promise.resolve(game.scenes.preload?.(hall.id, true)).catch(err => error("Could not preload the trial hall", err));
    const lines = startTrialLines({ hall });
    const castPicker = hall ? castPickerHtml(hall, { heading: "DRPG.TrialScene.castPickHeading" }) : "";

    const result = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Floor.startTrial") },
        classes: ["drpg-panel"],
        content: dialogContent(`<form>
            <p>${game.i18n.localize("DRPG.Floor.startTrialIntro")}</p>
            <ul class="drpg-briefing-facts drpg-trial-facts">
                <li>${game.i18n.localize("DRPG.Floor.startTrialStepPhase")}</li>
                <li>${lines.table}</li>
                <li>${game.i18n.localize("DRPG.Floor.startTrialStepDiscussion")}</li>
                <li>${game.i18n.localize("DRPG.Floor.startTrialStepAnnounce")}</li>
            </ul>
            <p class="notes">${game.i18n.localize("DRPG.Floor.startTrialNote")}</p>
            <p>${lines.rule}</p>
            <p class="notes">${lines.voices}</p>
            ${castPicker}
        </form>`),
        buttons: [
            { action: "ok", label: game.i18n.localize("DRPG.Floor.startTrial"), default: true,
                callback: (e, b, d) => ({ cast: readCastPicker(d.element) }) },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    if (!result || result === "cancel") return null;
    if (!(await incidentClosedFirst())) return null;
    if (!(await confirmNewTrial())) return null;
    const picked = result.cast;
    if (hall && picked?.sceneId === hall.id && Object.keys(picked.changes ?? {}).length) await saveTrialCast(hall, picked.changes);

    // ONE WRITE, TWO FACTS. The phase and the elapsed clock's stamp go together
    // - see `resetElapsed` - so the HUD redraws once. Two writes would redraw
    // it twice a few milliseconds apart, and the second redraw would land in
    // the middle of the turn-over animation the first one started.
    // A fresh trial has not voted and has not delivered a verdict, G-32
    // charges for the Key Remnants nobody found, and T-1 opens the trial's
    // budget - the time of day's actions, for Analyze and an Objection. None of
    // the three is this button's: they belong to the phase, and `reconcilePhase`
    // in clock.mjs runs them off the write below - which is what makes the clock
    // editor, `setPhase` and a debate opened outside a trial open one the same
    // way this does. A null is `setClock` refusing a trial in an Eclipse begun while this button's
    // windows stood open (E10 fix r2-G5): it told the GM, and no trial is announced.
    if (await setClock({ phase: "classTrial", timeOfDayStartedAt: serverNow() }) === null) return null;

    // The refill is announced rather than done quietly: a rule the table cannot
    // see is a rule the table does not use, and "you have your actions again" is
    // the difference between an Objection somebody dares to make and one they
    // assume they cannot afford. Counted from the living students, because the
    // refill ran inside `setClock` above and hands nothing back to this button.
    const { announce } = await import("./utils.mjs");
    const { livingStudents } = await import("./chapter.mjs");
    await announce({
        content: trialEventCard("DRPG.Floor.trialBegins", game.i18n.localize("DRPG.Floor.trialOpened"),
            plural("DRPG.Floor.trialBudget", { n: livingStudents().length }))
    });

    return true;
}

/**
 * A SECOND TRIAL IN A CHAPTER WITH A VERDICT ASKS FIRST (E10 C11, 1.2.71; audit S06-33; D17 option 1).
 *
 * Entering the trial's phase blanks the chapter's trial record (`reconcilePhase` in clock.mjs), and
 * `verdictApplied` in that record is the only thing that keeps a second verdict out: the verdict's
 * window refuses while it stands. So End the trial and Start it again, or the phase moved back from
 * Edit campaign, opened a fresh trial with no word said, and its verdict meant another execution and
 * another round of Level Ups. A second trial is a thing a table may want (the owner's D17: allowed,
 * asked), so this asks rather than refuses, and Cancel is the first button and the only default:
 * Enter presses the first submit button in DOM order (the finding behind the verdict's footer, E10
 * C4), so Enter keeps the verdict. Answers true when the chapter has no verdict, without asking.
 * Measured on the harness: tier 2 "re-entering the trial after a verdict asks and Cancel keeps the
 * lock" and scenario 63's H; the key itself in Foundry's window is not measured here (LIVE-E10-02's).
 *
 * @param {number} [chapter]  the chapter the trial opens in: the clock's, or the one Edit campaign is
 *   moving the clock to (E10 fix r2-G5; round 2's cor m3 - the record it blanks is that chapter's).
 */
export async function confirmNewTrial(chapter) {
    const { trialProgress } = await import("./vote.mjs");
    if (!trialProgress(chapter).verdictApplied) return true;
    const answer = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Floor.newTrialTitle") },
        classes: ["drpg-panel", "drpg-narrow"],
        content: dialogContent(`<p>${game.i18n.localize("DRPG.Floor.newTrialConfirm")}</p>`),
        buttons: [
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel"), default: true },
            { action: "ok", label: game.i18n.localize("DRPG.Floor.newTrialTitle") }
        ],
        rejectClose: false
    });
    return answer === "ok";
}

/**
 * AN INCIDENT STILL OPEN ASKS FIRST (E10 C12, 1.2.71; audit S06-18), at the three doors that lean on
 * the Blackened register: Start the Class Trial, the vote window's Send the ballots and the End of
 * chapter window. The register takes an incident's killers when the incident is closed
 * (murder-rules.mjs `closeIncident` -> `recordBlackened`, read in the code), so a trial run past an
 * open one asked for no name or too few and left the verdict to the lists by hand, and a chapter
 * ended over one closed its trial without its killer (since E09 fix r2-G4 the late row goes under
 * the incident's own chapter, which no trial reads again). The GM panel's Next line said so; the
 * windows did not. This offers the close (`endMurder`, as the incident
 * tracker's Close the murder calls it) and lets the GM go on with it open: a warning, not a refusal.
 * Cancel is the first button and the only default, so Enter closes nothing and opens nothing (Enter
 * presses the first submit button, E10 C4's finding). True at once when no incident is open; after a
 * close, true only when the incident is gone.
 */
export async function incidentClosedFirst() {
    const { murderState, endMurder } = await import("./murder.mjs");
    if (!murderState()) return true;
    const answer = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Floor.incidentTitle") },
        classes: ["drpg-panel", "drpg-narrow"],
        content: dialogContent(`<p>${game.i18n.localize("DRPG.Floor.incidentOpen")}</p>`),
        buttons: [
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel"), default: true },
            { action: "close", label: game.i18n.localize("DRPG.Murder.endMurder") },
            { action: "keep", label: game.i18n.localize("DRPG.Floor.incidentKeep") }
        ],
        rejectClose: false
    });
    if (answer === "keep") return true;
    if (answer !== "close") return false;
    await endMurder();
    return !murderState();
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
 * THE DEBATE'S QUESTION (E70 C3, 27.10.2026; S18-70): in the games each Nonstop Debate has its question at the top
 * of the screen, and a debate without one drifts. The window asks for it beside the length, optional; `topic` gives
 * it without the window. It is on the floor for the debate's life (the Event panel's card, the cards of its
 * Objections) and in the trial record for the trial ("Open the debate again", `reopenDebate`).
 *
 * @param {number|{seconds?: number, topic?: string}} [options]  Skip the question and use this
 *   many seconds. A bare number is accepted as well as `{ seconds }`, because
 *   the console form a macro reaches for is `game.drpg.openDebate(180)` and
 *   being right about the shape is not a thing to make somebody guess.
 */
export async function openDebate(options = {}) {
    if (!game.user.isGM) return null;
    if (trialFloor()) return null;

    const { trialProgress, setTrialProgress } = await import("./vote.mjs");
    /* A debate opened outside a trial opens the trial (`startFloor` moves the phase), so in a
       chapter with a verdict it is a second trial with no question asked (E10 C11; D17). It is
       refused here, before the length is asked or remembered into the verdict's record, and the
       GM is told where the asked road is. `confirmNewTrial: true` is the caller saying it asked. */
    const confirmed = options?.confirmNewTrial === true;
    if (getClock().phase !== "classTrial" && trialProgress().verdictApplied && !confirmed) {
        ui.notifications.warn(game.i18n.localize("DRPG.Floor.newTrialRefused"));
        return null;
    }
    const remembered = trialProgress().seconds || TRIAL.speakSeconds;

    const given = typeof options === "number" ? options : options?.seconds;
    let budget = Number(given) || null;
    let topic = topicOf(typeof options === "object" ? options?.topic : null);
    if (!budget) {
        const asked = await DialogV2.wait({
            window: { title: game.i18n.localize("DRPG.Floor.openDebate") },
            classes: ["drpg-panel", "drpg-narrow"],
            content: dialogContent(`<form>
                <p>${game.i18n.localize("DRPG.Floor.openDebateIntro")}</p>
                <label>${game.i18n.localize("DRPG.Floor.seconds")}
                    <input type="number" name="seconds" min="30" step="10"
                           value="${remembered}" /></label>
                <label>${game.i18n.localize("DRPG.Floor.topic")}
                    <input type="text" name="topic" maxlength="${Number(TRIAL.modes.topicLength) || 200}"
                           placeholder="${esc(game.i18n.localize("DRPG.Floor.topicHint"))}" /></label>
                <p class="notes">${game.i18n.localize("DRPG.Floor.discussionNote")}</p>
            </form>`),
            buttons: [
                {
                    action: "ok", label: game.i18n.localize("DRPG.Floor.openDebate"), default: true,
                    callback: (e, b, d) => ({
                        seconds: Number(d.element.querySelector("form").seconds.value) || remembered,
                        topic: d.element.querySelector("form").topic?.value ?? ""
                    })
                },
                { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
            ],
            rejectClose: false
        });
        if (!asked || asked === "cancel") return null;
        budget = asked.seconds;
        topic = topicOf(asked.topic);
    }

    /* Remembered for the next one in this trial, which is what makes the default above worth
       having - AFTER the floor opens (E10 C12, 1.2.71; audit S06-36). A debate opened outside a
       trial moves the phase (`startFloor` -> `setPhase`), and entering the trial blanks its record
       to the default length (`reconcilePhase` -> `resetTrialProgress`): written first, the length
       was eaten a moment later, so `game.drpg.openDebate(300)` outside a trial remembered 180 s.
       And a floor that did not open (`startFloor` answered null: a refused phase) is no debate to
       remember or to announce. */
    if (!(await startFloor({ seconds: budget, confirmNewTrial: confirmed, topic }))) return null;
    // The debate again after an Overrule (E70 C2) runs on the time that was left, which is no budget to remember. The
    // question is the trial's (E70 C3), written by the same rule: after the floor, so a debate that entered the trial
    // is not blanked by its entry; none asked is none, so the debate again does not bring back an older one.
    await setTrialProgress({ topic, ...(options?.remember !== false ? { seconds: budget } : {}) });

    const { announce } = await import("./utils.mjs");
    await announce({
        content: trialEventCard("DRPG.Floor.debateOpenedTitle", game.i18n.localize("DRPG.Floor.debateOpened"),
            ...(topic ? [game.i18n.format("DRPG.Floor.topicLine", { topic: esc(topic) })] : []))
    });
    return true;
}

/**
 * OPEN THE DEBATE AGAIN (E70 C3, 27.10.2026; S18-70; TR11 = 1). A Rebuttal ends the debate it cut into (Dawid, 28.08),
 * and opening it again took the window and the budget typed again. This is the console's step after an exchange ended
 * the debate (the record's `debateAgain`, trial-floor.mjs `commitFloor`), and `game.drpg.reopenDebate()`: the same
 * question and the same budget as the trial record holds them, no window. Only while a Class Trial runs and no floor
 * is open.
 */
export async function reopenDebate() {
    if (!game.user.isGM) return null;
    if (trialFloor()) return null;
    if (getClock().phase !== "classTrial") {
        ui.notifications.warn(game.i18n.localize("DRPG.Floor.bar.notTrial"));
        return null;
    }
    const { trialProgress } = await import("./vote.mjs");
    const record = trialProgress();
    return openDebate({ seconds: Number(record.seconds) > 0 ? Number(record.seconds) : TRIAL.speakSeconds, topic: record.topic ?? "" });
}

/**
 * THE TRIAL'S CLOCK (E70 C3, 27.10.2026; S18-80; TR17 = 1). The guide: "Class Trial lacznie powinien trwac 4.5
 * godziny" at 16 players, shortened by N/16. `record` is the trial record (`trialStartedAt` on the server's clock,
 * `trialSize` the players at its start), `now` the server's clock; the answer is the whole minutes since the start and
 * the budget in minutes, null for a trial of nobody, or null for a record with no start (a world from before 1.2.90).
 * An estimate for the GM's console only, which blocks nothing ("to tylko liczby szacunkowe").
 */
export function trialTime(record, now) {
    const start = Number(record?.trialStartedAt);
    if (!Number.isFinite(start) || start <= 0) return null;
    const size = Math.max(Number(record?.trialSize) || 0, 0);
    const used = Math.max(Math.floor((Number(now) - start) / 60_000), 0);
    return { used, budget: size > 0 ? Math.round((Number(TRIAL.modes.budget.minutesAt16) || 270) * size / 16) : null };
}

/** Close it again. The trial carries on; the room goes back to talking. */
export async function closeDebate() {
    if (!game.user.isGM) return null;
    if (!trialFloor()) return null;

    await endFloor();

    const { announce } = await import("./utils.mjs");
    await announce({
        content: trialEventCard("DRPG.Floor.debateClosedTitle", game.i18n.localize("DRPG.Floor.debateClosed"))
    });
    return true;
}

/**
 * End the Class Trial, and mean it.
 *
 * THIS IS THE HALF THAT WAS MISSING. It closed the floor and opened the vote,
 * and never touched the campaign phase - so the trial "ended" while every
 * screen in the game went on saying Class Trial and Daily Life had to be
 * restored by hand from Edit Campaign. Ending a trial is the campaign going
 * back to ordinary play, and that is what this does.
 *
 * Since T-1 that is a bigger thing than it was: a trial in session shuts every
 * action tile except Analyze, every room crossing, every Despair Call and
 * Confusion. This is what reopens all of them.
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

    /* AFTER A VERDICT, ENDING THE TRIAL IS NOT ENDING THE CHAPTER (E10 C14, 1.2.71; audit S13-13). The two
       buttons stood side by side after a verdict, and this one's question named the debate, the trial and Daily
       Life - nothing about the Truth Bullets' reveal or the next chapter, which only End the chapter does (and it
       closes the trial itself, its "end the Class Trial" box). A GM who pressed this one and said yes had a
       finished-looking table and an open chapter. It stays - a trial can end without a verdict - and is never
       the console's default; once the verdict is in, its question says so. */
    const { trialProgress, pendingSentence } = await import("./vote.mjs");
    /* AND WHOM IT EXECUTES (E70 C4; DC36): the sentence is carried out as the trial ends, so its question names
       them - a Final Trial's too, read off the GMs' store, on this GM's screen alone. */
    const sentenced = await pendingSentence();
    const notChapter = (trialProgress().verdictApplied
        ? `<p class="drpg-warning">${game.i18n.localize("DRPG.Floor.endTrialNotChapter")}</p>` : "")
        + (sentenced.length ? `<p class="drpg-warning">${game.i18n.format("DRPG.Floor.endTrialExecutes", {
            names: sentenced.map(actor => foundry.utils.escapeHTML(actor.name)).join(", ") })}</p>` : "");

    /* AND IT SAYS WHERE THE TABLE GOES (E13 C3b, 12.10.2026; the owner's answer f of 09.10). With a
       trial hall linked, leaving the trial takes the table out of the hall, and the students' tokens
       on the school still stand where the incident left them - the GM moved them by hand at every
       return. So this question asks for a room of a place scene (`placeRoomOptions`, the house's
       room select: the school first, every option carrying its scene), and the living go there once
       the phase has moved (trial-scene.mjs `returnTheLiving`). Its buttons are End the trial and
       Cancel only: the owner's item 3 of 10.10 is that the move cannot be skipped. With no hall
       linked, or no room anywhere, the table never left the school and the question is the one it
       was. */
    const { trialScene, placeScenes } = await import("./rooms.mjs");
    if (trialScene() && placeScenes().length) {
        const exit = await askTrialExit(notChapter);
        if (!exit || typeof exit !== "object") return null;
        return closeTrial(exit);
    }
    const confirmed = await DialogV2.confirm({
        classes: ["drpg-panel"],
        window: { title: game.i18n.localize("DRPG.Floor.endTrial") },
        content: `<p>${game.i18n.localize("DRPG.Floor.endTrialConfirm")}</p>${notChapter}`,
        rejectClose: false
    });
    if (!confirmed) return null;

    return closeTrial();
}

/**
 * End the trial's question when a hall is linked: the same words, and one select of every room of
 * every place scene, the school's first room chosen. Answers `{ sceneId, room }` from the chosen
 * option, or what the window answered otherwise (Cancel, a close) - which `endClassTrial` reads as
 * no.
 */
async function askTrialExit(notChapter) {
    return DialogV2.wait({
        classes: ["drpg-panel"],
        window: { title: game.i18n.localize("DRPG.Floor.endTrial") },
        content: dialogContent(`<form>
            <p>${game.i18n.localize("DRPG.Floor.endTrialConfirm")}</p>${notChapter}
            <p>${game.i18n.localize("DRPG.Floor.endTrialScene")}</p>
            <label>${game.i18n.localize("DRPG.Floor.endTrialRoom")}
                <select name="room">${placeRoomOptions()}</select></label>
        </form>`),
        buttons: [
            {
                action: "ok", label: game.i18n.localize("DRPG.Floor.endTrial"), default: true,
                callback: (e, b, d) => {
                    const option = d.element.querySelector("form select[name=room]")?.selectedOptions?.[0];
                    return option ? { sceneId: option.dataset.scene, room: option.value } : null;
                }
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });
}

/**
 * The trial closes and the campaign goes back to ordinary play. No asking.
 *
 * SPLIT OUT BECAUSE THE CHAPTER'S END NEEDS IT AND HAS ALREADY ASKED. The
 * confirmation above belongs to the button that says "End the trial" and to
 * nothing else: a GM who has just ticked a box on the End of chapter screen has
 * answered this question, and a second dialog behind a checkbox is the module
 * asking twice.
 *
 * Measured on 10.09, which is why the chapter-end screen wanted it: ending a
 * chapter moved the clock to chapter 2 and left `phase: "classTrial"` with the
 * debate floor still open. Every player's HUD read "Chapter 2 - Day 2 - Class
 * Trial", and the GM panel went on saying "The debate is open - Nonstop Debate."
 * This function was already the only route back - `setPhase("dailyLife")` has no
 * other caller anywhere in the module - and it was reachable from exactly one
 * button, below the one that ends the chapter.
 */
export async function closeTrial({ sceneId = null, room = null } = {}) {
    if (!game.user.isGM) return null;

    /* WHERE THE LIVING GO, HELD FOR THIS ONE WRITE (E13 C3b, 12.10.2026). End the trial's room, or
       the API's: held on this client (trial-scene.mjs `setTrialExit`) before the phase write, whose
       `reconcilePhase` takes it in `leaveTrialScene` on this same client, and dropped after it
       whatever the write did. A room that is no room of a place scene ends nothing - the GM asked
       for a move the module cannot make, and ending the trial without it would be the skip the
       owner ruled out (item 3 of 10.10). The chapter end hands nothing and moves nobody. */
    const { setTrialExit } = await import("./trial-scene.mjs");
    if ((sceneId || room) && !setTrialExit({ sceneId, room })) {
        ui.notifications.warn(game.i18n.format("DRPG.Calls.noSuchRoom", { room: room ?? "" }));
        return false;
    }

    /* THE SENTENCE FIRST (E70 C4; DC36, the plan's point (g) road 1): the convicted die as the trial ends - here, in the
       hall, before the phase moves and the living gather at school (trial-scene.mjs `followPhase`), in the trial's own
       chapter, which the chapter's end has already moved the clock past (vote.mjs `executeAtExit`). Once: the phase
       write's `reconcilePhase` asks again and finds it stamped. A throw is logged and ends nothing here: that road
       tries it again. */
    try {
        const { executeAtExit } = await import("./vote.mjs");
        await executeAtExit();
    } catch (err) {
        error("Could not carry out the trial's sentence as it ended", err);
    }

    try {
        // The floor closes with the phase - `reconcilePhase` in clock.mjs - which
        // is what makes ending a trial from the clock editor end it properly too.
        await setClock({ phase: "dailyLife", timeOfDayStartedAt: serverNow() });
    } catch (err) {
        /* A WRITE THAT THREW ENDED NOTHING (E10 C12, 1.2.71; audit S06-36). This said "the floor is
           shut either way" and went on to announce the trial over and answer true - but the floor
           shuts in `reconcilePhase`, behind the write that threw, so the debate went on running under
           a card saying Daily Life had resumed. The floor is closed here instead, and the table is
           told nothing: the phase did not move, which the GM can fix from Edit campaign. False, so
           a caller (the End of chapter's `endTrial`) knows. */
        error("Could not return the campaign to Daily Life", err);
        try {
            await endFloor();
        } catch (floorErr) {
            error("Could not close the debate floor after the trial failed to end", floorErr);
        }
        return false;
    } finally {
        setTrialExit(null);
    }

    const { announce } = await import("./utils.mjs");
    // With the trial's close's own sound (E70 C4; amend 0): the table goes back to school.
    await announce({
        flags: { [MODULE_ID]: { sfx: { key: "trialClose", gm: true } } },
        content: trialEventCard("DRPG.Floor.trialOver", game.i18n.localize("DRPG.Floor.trialClosed"))
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
function readTrial({ inFinalTrial, pendingVoters, voteBar, trialProgress, verdictStopped, verdictRunner, blackenedIds,
    studentActors, isDeadForGm, deathRecordFor, sameSeason, trialScene, schoolScene, trialReturnTo, leaveDestination, tableDoor }) {
        const floor = trialFloor();
        const { phase, chapter } = getClock();
        const running = phase === "classTrial";
        const progress = trialProgress();
        const view = {
            floor, running, progress,
            restrictive: Boolean(floor) && floor.mode !== FLOOR_MODES.debate,
            finalNow: inFinalTrial(),
            pending: pendingVoters(),
            bar: voteBar(),
            // THE LAST THREE STEPS OUTLIVE THE TRIAL, and they have to: ending
            // the trial puts the campaign back into Daily Life, and a GM who
            // does that before delivering the verdict must not find that the
            // buttons for it have gone with the phase.
            afterwards: running || progress.voteClosed || progress.verdictApplied,
            // A verdict that stopped halfway (E10 C5, S06-39): the steps it did
            // not finish, named, or null - see `verdictStopped` in vote.mjs.
            stopped: verdictStopped(progress),
            // The GM who may finish a verdict not yet done (E10 fix r2-G2) - see `verdictRunner` in vote.mjs.
            runner: verdictRunner(progress),
            /* THE BLACKENED REGISTER, COUNTED (E10 C12, 1.2.71; audit S06-18). The register takes a
               killer when their incident is closed, and the vote asks as many names as it holds, so
               an empty one in a chapter where somebody died is an incident nobody closed - or a GM
               store this browser has not been given - and the console says so before the vote does.
               The whole register (`blackenedIds`), as this GM holds it, and a death as this GM knows
               it (`isDeadForGm`, a death nobody has found included): a display, the GMs' own. */
            register: blackenedIds().length,
            // Of this season too (E11 C12): a reset that keeps the deaths starts the clock at chapter 1 again,
            // and last season's chapter-1 death read as this chapter's, an incident nobody closed.
            deathThisChapter: studentActors().some(actor => {
                if (!isDeadForGm(actor)) return false;
                const record = deathRecordFor(actor);
                return record?.chapter === chapter && sameSeason(record);
            })
        };
        /* WHERE THE TABLE IS, AND THE DOOR THAT MOVES IT WITHOUT THE PHASE (E13 C6): the active scene - the
           one Foundry takes every browser to, not the one this GM looks at - and "Show the hall" or "Back to
           school" (trial-scene.mjs `tableDoor`). Only in a running trial with a hall linked. */
        const hall = trialScene();
        view.table = tableDoor({ running, hall, active: game.scenes?.active ?? null,
            back: hall ? leaveDestination({ school: schoolScene(), returnTo: trialReturnTo(hall), hall }) : null });
        view.next = trialNextStep(view);
        /* THE BAR'S FIRST BUTTON (E70 C1): Skip while an Objection or a rebuttal runs - the step Enter pressed
           before the bar, which is no footer button now (the footer's step stays one for the whole debate, so the
           console does not reopen at every Objection, E70-06); the lead says what the floor waits for. */
        view.barNext = running && view.restrictive ? "skip" : null;
        view.lead = view.barNext ? "now" : view.next;
        return view;
}

/*
 * WHICH BUTTON ENTER PRESSES, AND THE LINE THAT SAYS WHY (E10 C14, 1.2.71; audit S06-27).
 *
 * Nine buttons can be on the console at the tensest moment of a session, and each branch used to
 * declare its own `default: <some condition>` - which is how a window ends up with two defaults in one
 * state and none in another. So exactly one action is the next step, and it is by construction one that
 * is present and not disabled.
 *
 * The chain before this asked "is there a floor?" before it asked how far the trial had got: with no
 * debate open it answered Open Debate whatever else was true, so after the count and after the verdict
 * Enter opened a debate; and with one open it fell through to The vote rather than closing it. Read at a
 * table (the audit's V10-vote-verdict-03 and V09-trial-console-20). Now a floor is asked about first only
 * while the trial runs, then the record from its far end back - the verdict, the count, the ballots - and
 * Open Debate is the step only before any ballot went out. A trial ended with its record standing
 * ("afterwards" without "running") goes on to its verdict and the chapter's end: those are the steps left,
 * and Start the Class Trial would ask first in a chapter with a verdict (E10 C11).
 *
 * A VERDICT ANOTHER GM RUNS HAS NO BUTTON HERE (E10 fix r2-G2, 1.2.71; round 2's cor M1, cor m1, sec S2-3).
 * After a failed step every GM's console made Finish the verdict its next step and Enter's default, and
 * Finish refuses on every GM but one; while another GM was still giving the verdict, or had reloaded
 * inside it, the console made End the chapter the default, which drops the steps not done. On a GM who is
 * not the verdict's runner (`verdictRunner`) the lead names the runner and no button is the next step, so
 * Enter presses nothing - the one state in which the next step is not a button.
 */
export function trialNextStep({ floor, running, progress, afterwards, stopped, runner }) {
    if (!afterwards) return "start";
    /* THE WHOLE DEBATE IS ONE STEP OF THE FOOTER (E70 C1, 27.10.2026; E70-06). An Objection or a rebuttal made
       Now the footer's step, and the step is in the console's signature, so the console closed and opened again at
       every Objection and at its rebuttal's end - under the GM's pointer, at the tensest moment of the trial. The
       footer's step is Close Debate for every mode of the debate now, and the bar's first button is Skip while an
       Objection or a rebuttal runs (`readTrial`'s `barNext`). Enter presses the footer's step only. */
    if (running && floor) return "closeDebate";
    if (progress.verdictApplied && runner && runner !== game.user.id) return stopped ? "finishElsewhere" : "verdictElsewhere";
    if (progress.verdictApplied) return stopped ? "finishVerdict" : "chapterEnd";
    if (progress.voteClosed) return "verdict";
    // Only a running trial gets here: `afterwards` without a count or a verdict is `running`.
    if (progress.vote.open) return "vote";
    /* THE DEBATE AGAIN AFTER AN OVERRULE (E70 C2; E70-11): an Objection overruled once its exchange was over leaves the
       trial in discussion, and the step is the debate again with the time it had when the Objection cut in. */
    /* AND AFTER ITS EXCHANGE (E70 C3; TR11 = 1): a rebuttal over, or an Objection or a rebuttal the GM ended, closed the
       debate it cut into, and the step is the same debate again - its question and its budget, no window. */
    if (progress.againAfterOverrule) return "openAgain";
    return progress.debateAgain ? "reopen" : "openDebate";
}

/**
 * A verdict's sentence the trial's end has not yet carried out (E70 C4; DC36): the console's lead says the trial goes
 * on and the sentence waits for its end. Read off the world's record, which names a Final Trial's convict nowhere
 * (`sentencePending`).
 */
function sentenceWaits(progress) {
    const verdict = progress?.verdict;
    if (!verdict || progress.executedAt) return false;
    return verdict.final ? Boolean(verdict.sentencePending) : (verdict.sentenced ?? []).length > 0;
}

/** The console's first line, by the next step: what the trial is waiting for, said once. */
const TRIAL_LEADS = {
    start: "DRPG.Floor.lead.start",
    openDebate: "DRPG.Floor.lead.openDebate",
    openAgain: "DRPG.Floor.lead.openAgain",
    reopen: "DRPG.Floor.lead.reopen",
    closeDebate: "DRPG.Floor.lead.closeDebate",
    now: "DRPG.Floor.lead.now",
    vote: "DRPG.Floor.lead.vote",
    verdict: "DRPG.Floor.lead.verdict",
    finishVerdict: "DRPG.Floor.lead.finishVerdict",
    finishElsewhere: "DRPG.Floor.lead.finishElsewhere",
    verdictElsewhere: "DRPG.Floor.lead.verdictElsewhere",
    chapterEnd: "DRPG.Floor.lead.chapterEnd"
};

/*
 * THE GM'S BAR (E70 C1, 27.10.2026; S18-75; TR21). Skip, -30 s, +30 s, End this mode, Back to the debate and Re-point,
 * in that order in every mode, so a button is where it was a second ago whatever the floor did (E70 C2 put Overrule after
 * +30 s): one that would change nothing is greyed - `aria-disabled`, still focusable and still showing its title - with
 * the reason trial-floor.mjs `barRefusal` gives, and pressing it says that reason. Only while a Class Trial runs (DX2).
 * Each button is a `game.drpg` function too (api.mjs), which another GM's console reaches the primary by.
 */
const BAR_LABELS = {
    skip: "DRPG.Floor.bar.skip",
    minus: "DRPG.Floor.bar.minus",
    plus: "DRPG.Floor.bar.plus",
    overrule: "DRPG.Floor.bar.overrule",
    endMode: "DRPG.Floor.bar.endMode",
    back: "DRPG.Floor.backToDebate",
    repoint: "DRPG.Floor.repoint"
};

const BAR_ACTIONS = {
    skip: () => skipStep(),
    minus: () => adjustTime(-TRIAL.modes.gm.adjustSeconds),
    plus: () => adjustTime(TRIAL.modes.gm.adjustSeconds),
    // E70 C2: the newest Objection overruled - during its exchange the floor goes back with its time.
    overrule: () => overruleObjection(),
    endMode: () => endMode(),
    back: () => returnToDebate(),
    // E79 C16: the running Objection aimed at somebody else, picked in a window of its own - this console's body is
    // redrawn every second and holds no field (`repointDialog`).
    repoint: async () => {
        const { repointDialog } = await import("./trial.mjs");
        await repointDialog();
    }
};

/** A bar button pressed: its op, or the reason it is greyed, said to this GM. */
function runBarOp(op) {
    const run = BAR_ACTIONS[op];
    if (!run) return;
    const refused = barRefusal(op);
    if (refused) {
        ui.notifications.warn(game.i18n.localize(refused));
        return;
    }
    Promise.resolve().then(run).catch(err => error(`The trial bar's ${op} failed`, err));
}

/** The bar's markup, by the console's reading (`readTrial`): nothing outside a running trial. */
function trialBar({ floor, running, barNext }) {
    if (!running) return "";
    const now = serverNow();
    const buttons = BAR_OPS.map(op => {
        const refused = barRefusal(op, floor, { running, now });
        const label = game.i18n.localize(BAR_LABELS[op]);
        const next = op === barNext ? " drpg-bar-next" : "";
        return `<button type="button" class="drpg-trial-bar-op${next}" data-drpg-bar="${op}"${refused
            ? ` aria-disabled="true" title="${esc(game.i18n.localize(refused))}"` : ""}>${esc(label)}</button>`;
    });
    return `<div class="drpg-trial-bar" role="toolbar" aria-label="${esc(game.i18n.localize("DRPG.Floor.bar.label"))}">
                ${buttons.join("\n                ")}
            </div>`;
}

/** The console's three sections, from one reading of the floor. */
function trialConsoleHtml(view) {
    const { floor, running, restrictive, finalNow, progress, pending, bar, afterwards, stopped, register, deathThisChapter,
        next, runner, table } = view;
        const left = floor ? secondsLeft(floor) : 0;

        /*
         * OVERRUN IS A DEBATE'S STATE, NOT A NEGATIVE NUMBER (F8).
         *
         * `secondsLeft` goes negative past the budget, and this line printed it
         * raw: "Open discussion - -137 s left on your budget". Only a debate can
         * sit there - the other two modes end themselves at zero - so for THEM a
         * negative reading is a transition that has not landed yet: one tick in
         * the ordinary case, up to a minute when the primary GM's tab is in the
         * background and the browser has throttled its timers. Printed as 0 s
         * rather than as a clock running backwards.
         *
         * The red is what `DRPG.Floor.discussionNote` already promises the table:
         * running past the budget turns the clock red and does nothing else.
         */
        const over = floor?.mode === FLOOR_MODES.debate && left < 0;
        const holder = floorHolder(floor);
        const target = floorTarget(floor);

        /* THE STATE'S NAME IS THE MODE'S (E10 C15, 1.2.71; audit S06-10). A running Nonstop Debate read
           "Open discussion - 175 s left on your budget", and the same word, discussion, then described the
           trial once the debate was closed - two opposite states, which the clock, the Event panel and the
           chat card all tell apart ("Debate" against "Discussion"), under one name in the console. The word
           discussion is now only the state with no debate (`inDiscussion`), and it is a line of the state,
           not a footnote: the same paragraph the other modes use. */
        const debateLine = !floor
            ? `<p>${game.i18n.localize("DRPG.Floor.inDiscussion")}</p>`
            : floor.mode === FLOOR_MODES.debate
                ? (over
                    ? `<p class="drpg-warning">${game.i18n.format(
                        "DRPG.Floor.holdingDebateOver", { seconds: Math.abs(left) })}</p>`
                    : `<p>${game.i18n.format("DRPG.Floor.holdingDebate", { seconds: left })}</p>`)
                : floor.mode === FLOOR_MODES.objection
                    // E79 C16: an Objection raised and still waiting for its Truth Bullet runs the seconds to pick.
                    ? `<p>${game.i18n.format(floor.pending ? "DRPG.Floor.holdingObjectionPending" : "DRPG.Floor.holdingObjection", {
                        who: esc(holder?.name ?? "-"), target: esc(target?.name ?? "-"),
                        seconds: Math.max(left, 0)
                    })}</p>`
                    : `<p>${game.i18n.format("DRPG.Floor.holdingRebuttal", {
                        who: esc(holder?.name ?? "-"), target: esc(target?.name ?? "-"),
                        seconds: Math.max(left, 0)
                    })}</p>`;

        // Who has not voted yet, if a vote is open at all. Names only: who has
        // voted is not how they voted, and only the second is the secret the
        // guide keeps. Same read as the vote window's own.
        // These are lines of the console's STATE, so they are body text and not `notes` (E10 C15; audit
        // S06-29): "No vote is open right now" is the answer a GM opens the console for, and `notes` set
        // it in the dim ink the audit measured at 3.56:1 and 4.06:1 (the audit's reading, not
        // measured again here). `notes` stays for the lines that EXPLAIN - `modeNote`, `objectionNote`.
        // Counted, it says nothing here: the lead line above says so ("The vote is counted. Deliver the
        // verdict..."), and the two lines together printed the count twice (E10 C14; audit S06-27).
        const voteLine = pending === null
            ? (progress.voteClosed ? "" : `<p>${game.i18n.localize("DRPG.Vote.notRunning")}</p>`)
            : pending.length
                ? `<p class="drpg-warning">${game.i18n.format("DRPG.Vote.stillOut", {
                    n: pending.length, who: esc(pending.map(v => v.name).join(", "))
                })}</p>`
                : `<p>${game.i18n.localize("DRPG.Vote.allIn")}</p>`;
        // How many are back and the bar a conviction needs, as the vote window
        // prints it (E10 C3): a player who joins mid-vote raises it, and this
        // region is redrawn when they do - on the world's record and on
        // `drpgBallotsChanged` (the vote window's redraw is 63's C3; this one's
        // is read in the code, not measured).
        const barLine = bar ? `<p>${game.i18n.format("DRPG.Vote.barLine", bar)}</p>` : "";

        // What the verdict's disabled button is waiting for, said out loud: a disabled button with no
        // explanation is a bug report. Once the vote is counted the lead line names the step, so this
        // says nothing more - but a verdict that stopped halfway says where, beside the button that
        // finishes it (E10 C5).
        const gateLine = !progress.voteClosed
            ? `<p>${game.i18n.localize("DRPG.Floor.gateVote")}</p>`
            : stopped
                ? `<p class="drpg-warning">${game.i18n.format("DRPG.Vote.verdictStopped", { steps: esc(stopped) })}</p>`
                : "";

        const registerLine = !register && deathThisChapter
            ? `<p class="drpg-warning">${game.i18n.localize("DRPG.Floor.registerEmpty")}</p>`
            : `<p>${plural("DRPG.Floor.registerCount", { n: register })}</p>`;
        const finalLine = finalNow
            ? `<p class="drpg-warning">${game.i18n.localize("DRPG.Mastermind.finalRunningNote")}</p>` : "";
        const tableLine = table
            ? `<p>${game.i18n.format("DRPG.TrialScene.tableOn", { scene: esc(table.scene ?? "-") })}</p>` : "";
        /* THE TRIAL'S CLOCK AND THE DEBATE'S QUESTION (E70 C3; S18-80, S18-70). The minutes since the trial's start
           against the guide's budget for the players it started with (`trialTime`), an estimate that blocks nothing
           (TR17), redrawn with the console every second; and the question of the debate on the floor, under the
           debate's line, which never says discussion (S06-10, tier 1 R1031). */
        const time = running ? trialTime(progress, serverNow()) : null;
        const timeLine = time
            ? `<p class="drpg-trial-time">${time.budget === null
                ? game.i18n.format("DRPG.Floor.trialTimeNoBudget", { used: time.used })
                : game.i18n.format("DRPG.Floor.trialTime", { used: time.used, budget: time.budget })}</p>` : "";
        const topicLine = floor?.topic
            ? `<p class="drpg-trial-topic">${game.i18n.format("DRPG.Floor.topicLine", { topic: esc(floor.topic) })}</p>` : "";

        /* NO TRIAL RUNNING IS ONE LINE (E10 C14, 1.2.71; audit S06-27). The three sections stood under "No
           Class Trial is running" saying there was no debate and no vote - and, after End the trial, "The
           verdict is in. The chapter can end." under the sentence that no trial was running, with The vote
           still pressable. Now the lead says what is left, if anything: the trial ended with its record
           standing says so first. The register's line stays (E10 C12: it is what to check before a Start),
           and so does a verdict that stopped, which Finish the verdict below it answers. */
        const lead = `<p class="drpg-trial-lead">${running || !afterwards ? ""
            : `${game.i18n.localize("DRPG.Floor.trialEnded")} `}${game.i18n.format(TRIAL_LEADS[view.lead ?? next],
                { name: esc(game.users.get(runner ?? "")?.name ?? "?") })}${
                running && next === "chapterEnd" && sentenceWaits(progress) ? ` ${game.i18n.localize("DRPG.Floor.lead.sentenceWaits")}` : ""}</p>`;
        if (!running) {
            return `<div class="drpg-trial-console">
            ${lead}
            ${registerLine}
            ${finalLine}
            ${stopped ? gateLine : ""}
        </div>`;
        }

        return `<div class="drpg-trial-console">
            <h4>${game.i18n.localize("DRPG.Floor.sectionTrial")}</h4>
            ${lead}
            ${timeLine}
            ${tableLine}
            ${registerLine}
            ${finalLine}

            <h4>${game.i18n.localize("DRPG.Floor.sectionDebate")}</h4>
            ${debateLine}
            ${topicLine}
            ${floor ? `<p class="notes">${game.i18n.localize(restrictive
                ? "DRPG.Floor.modeNote" : "DRPG.Floor.objectionNote")}</p>` : ""}
            ${trialBar(view)}

            <h4>${game.i18n.localize("DRPG.Floor.sectionVote")}</h4>
            ${voteLine}
            ${barLine}
            ${gateLine}
        </div>`;
}

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
function trialSignature(view) {
    const { floor, running, finalNow, progress, afterwards, stopped, next, table } = view;
        // `next` too (E10 C14): the default is a button's property, so a vote opened by another GM
        // moves Enter only by drawing the footer again. And the table's door (E13 C6), which another GM's
        // activation turns from one into the other.
        /* BY FAMILY, NOT BY MODE (E70 C1, 27.10.2026; E70-06). The mode was in it since 1.2.79, for Re-point, which
           stood in the footer only while an Objection ran: so every Objection and every rebuttal's end closed the
           console and opened it again (tier 2 E70-T2 at f388d722: a new window at the Objection). The buttons that
           depend on the mode are the bar's now, inside the live region (`trialBar`), and the footer changes only
           with the floor's family - a debate and its exchange are one, no floor is another (trial-floor.mjs
           `floorFamily`). Tier 0 R1026 holds this function to reading no mode. */
        return [running, floorFamily(floor), finalNow, afterwards,
            progress.voteClosed, progress.verdictApplied, Boolean(stopped), next, table?.action ?? "-"].join("|");
}

/** The footer, by state: the debate toggle, the three closing steps, start or end, the Final Trial switch, close. */
function trialButtons({ floor, running, finalNow, progress, afterwards, stopped, table, isDefault }) {
    return [
        ...(running
            ? [
                // The debate toggle first: it is the button pressed most
                // often in a trial, several times in each one.
                floor
                    ? { action: "closeDebate", default: isDefault("closeDebate"),
                        label: game.i18n.localize("DRPG.Floor.closeDebate") }
                    : progress.againAfterOverrule
                        // After an Overrule (E70 C2): the same button, the debate again with the time it had.
                        ? { action: "openAgain", default: isDefault("openAgain"),
                            label: game.i18n.format("DRPG.Floor.againAfterOverrule", { seconds: Math.max(Number(progress.againAfterOverrule.seconds) || 0, 0) }) }
                        : progress.debateAgain
                            // After its exchange closed it (E70 C3): the same question and budget, no window.
                            ? { action: "reopen", default: isDefault("reopen"), label: game.i18n.localize("DRPG.Floor.againSame") }
                            : { action: "openDebate", default: isDefault("openDebate"),
                                label: game.i18n.localize("DRPG.Floor.openDebate") },
                // End this mode now, Back to the debate, +30 seconds and Re-point stood here, each only in the
                // modes it served: they are the bar's since E70 C1 (`trialBar`), in every mode, greyed with a reason.
              ]
            : []),
        ...(afterwards
            ? [
                // Closed while no trial runs (E10 C14, S06-27): after End the trial it stayed
                // pressable, and Send the ballots would have opened a vote outside a trial.
                { action: "vote", label: game.i18n.localize("DRPG.Vote.openTitle"),
                  disabled: !running, default: isDefault("vote") },
                // Disabled rather than hidden, so the order of the trial is
                // visible from the first time this window is opened.
                // Closed again once it is applied (17.09, F2): a second verdict
                // executed the dropdown's default, refilled every pool and handed
                // out a second round of Level Ups.
                // In a Final Trial it is the Final Trial's verdict, and says so
                // (E10 C10, S06-16): `TRIAL_ACTIONS.verdict` opens that window then.
                { action: "verdict", label: game.i18n.localize(finalNow
                    ? "DRPG.Mastermind.verdictTitle" : "DRPG.Vote.verdictTitle"),
                  disabled: !progress.voteClosed || progress.verdictApplied,
                  default: isDefault("verdict") },
                // Only while a verdict stands stopped halfway: the lock above
                // keeps a second verdict out, and this runs the steps the first
                // one did not finish (E10 C5, S06-39).
                ...(stopped
                    ? [{ action: "finishVerdict", label: game.i18n.localize("DRPG.Vote.finishVerdict"),
                        default: isDefault("finishVerdict") }]
                    : []),
                // Reachable before the verdict (a chapter can end without
                // one); only the DEFAULT waits for it.
                { action: "chapterEnd", label: game.i18n.localize("DRPG.Chapter.endTitle"),
                  default: progress.verdictApplied && isDefault("chapterEnd") }
              ]
            : []),
        // The table's door (E13 C6), labelled by what it does now, as the Final Trial's switch below.
        ...(table?.action
            ? [{ action: table.action, label: game.i18n.localize(table.action === "showHall"
                ? "DRPG.TrialScene.showHall" : "DRPG.TrialScene.backToSchool") }]
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
    ];
}

/**
 * What each footer button does. Every one of them leaves a trial to keep
 * running, so the console reopens after it - see `manageClassTrial`; the
 * one that ends the chapter is handled there, because it may not come back.
 */
const TRIAL_ACTIONS = {
    start: () => startClassTrial(),
    end: () => endClassTrial(),
    openDebate: () => openDebate(),
    // E70 C2: the seconds the debate had when the overruled Objection cut in; none left, the length is asked.
    openAgain: async () => {
        const { trialProgress } = await import("./vote.mjs");
        const seconds = Number(trialProgress().againAfterOverrule?.seconds) || 0;
        // The same debate, so its question too (E70 C3).
        return openDebate(seconds > 0 ? { seconds, remember: false, topic: trialProgress().topic ?? "" } : {});
    },
    reopen: () => reopenDebate(),
    closeDebate: () => closeDebate(),
    vote: () => openVoteDialog(),
    /* THE FINAL TRIAL'S VERDICT IS THE MASTERMIND'S WINDOW (E10 C10, 1.2.71; audit S06-16). This
       button opened `openVerdictDialog` whatever the trial was, and in a Final Trial that is the
       ordinary verdict: executions, Level Ups, Despair and a rule, none of which the guide gives the
       Final Trial (gm-handbook section 8). The flag is read when the button is pressed, not when the
       console was drawn, so a flag taken down in between opens the ordinary one. */
    verdict: async () => {
        const { inFinalTrial, openFinalVerdictDialog } = await import("./mastermind.mjs");
        if (inFinalTrial()) return openFinalVerdictDialog();
        const { openVerdictDialog } = await import("./vote.mjs");
        await openVerdictDialog();
    },
    finishVerdict: async () => {
        const { finishVerdict } = await import("./vote.mjs");
        await finishVerdict();
    },
    toggleFinal: async () => {
        const { toggleFinalTrialFlag } = await import("./mastermind.mjs");
        await toggleFinalTrialFlag();
    },
    showHall: async () => {
        const { showCourtroom } = await import("./trial-scene.mjs");
        await showCourtroom();
    },
    backToSchool: async () => {
        const { showSchool } = await import("./trial-scene.mjs");
        await showSchool();
    }
};

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
    const { pendingVoters, voteBar, trialProgress, verdictStopped, verdictRunner } = await import("./vote.mjs");

    const { blackenedIds } = await import("./murder.mjs");
    const { studentActors } = await import("./monokuma.mjs");
    const { isDeadForGm, deathRecordFor, sameSeason } = await import("./settings.mjs");
    const { blackenedStore, deathStore } = await import("./gm-stores.mjs");
    const { trialScene, schoolScene } = await import("./rooms.mjs");
    const { trialReturnTo, leaveDestination, tableDoor } = await import("./trial-scene.mjs");
    const deps = { inFinalTrial, pendingVoters, voteBar, trialProgress, verdictStopped, verdictRunner, blackenedIds,
        studentActors, isDeadForGm, deathRecordFor, sameSeason, trialScene, schoolScene, trialReturnTo, leaveDestination, tableDoor };
    const read = () => readTrial(deps);
    const buildConsole = () => trialConsoleHtml(read());
    const signature = () => trialSignature(read());

    const view = read();
    const { floor, running, finalNow, progress, afterwards, stopped, table } = view;

    // WHICH BUTTON ENTER PRESSES: the next step, read with the rest (`trialNextStep`).
    const isDefault = action => view.next === action;

    const openedWith = signature();
    let reopening = false;

    const action = await DialogV2.wait({
        classes: ["drpg-panel", "drpg-window-trial"],
        window: { title: game.i18n.localize("DRPG.Floor.manageTrial") },
        content: dialogContent(buildConsole()),
        buttons: trialButtons({ floor, running, finalNow, progress, afterwards, stopped, table, isDefault }),
        render: (event, dialog) => {
            const live = keepLive(dialog, {
                region: ".drpg-trial-console",
                build: buildConsole,
                /*
                 * A BALLOT IS NOT IN THE WORLD, so `updateSetting` cannot report
                 * one (F8). Ballots travel on the bridge to the primary GM and are
                 * kept in the GMs' store on purpose - see `recordBallot` in vote.mjs - a
                 * client setting, whose change fires no `updateSetting` either,
                 * and this hook is the only thing that says the tally moved: the
                 * primary's record calls it, and so does the store's setting as a
                 * row is merged into another GM's copy or dropped from it
                 * (settings.mjs, E10 C1; measured on the headless harness with a
                 * second GM, 09.10.2026: one row merged, then dropped, each heard).
                 *
                 * AND NOTHING IS NARROWED BY ADDING IT. Naming `settings` here
                 * would turn "every setting of ours, plus this hook" into "this
                 * hook and the settings I remembered" - and this console prints
                 * the floor, the trial record and the Final Trial flag, all of
                 * which are settings.
                 *
                 * `userConnected` because a verdict stops halfway when the GM giving
                 * it leaves, and nothing in the world is written when they do: the
                 * record still says "applying" and only the user list has changed
                 * (`verdictStopped`; E10 C5, read in the code, not measured) - and with it the GM
                 * who may finish it (`verdictRunner`, fix r2-G2).
                 *
                 * The register and the deaths the GMs keep are GM stores too (`watch.stores`, E09 C3):
                 * the register's line is redrawn when a row lands in either (E10 C12; read in the
                 * code, not measured).
                 *
                 * `updateScene` for the table's line and door (E13 C6): a scene made active by another GM,
                 * or by Foundry's own control, writes the scene, not a setting of ours. That it reaches
                 * this window is read in the code, not measured: scenario 41 k2 presses the console's own
                 * door, after which the console reopens anyway.
                 */
                watch: { hooks: ["drpgBallotsChanged", "userConnected", "updateScene"], stores: [blackenedStore, deathStore] },
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
            });

            /*
             * AND THE SECONDS, WHICH ARE NOBODY'S EVENT (F8).
             *
             * The clock is derived from `startedAt` (see `secondsLeft`), so a
             * debate running down writes nothing and wakes nothing: a 180 s debate
             * still read "180 s left" two minutes in, while the HUD's own readout
             * beside it counted correctly.
             *
             * One second, and only while a floor is open - the period the HUD's
             * elapsed readout already runs on, for the reason written there: a
             * tick that changes nothing on screen is sixty rebuilds a minute for
             * nothing.
             *
             * Through `live.refresh()` rather than a painter of its own, so the
             * clock, the vote line and the gate note come from one builder and
             * cannot disagree. That is the FORCED rebuild path, which is right
             * while this region is a read-out: the day somebody puts a field in
             * this console, this tick has to stop forcing or it will rebuild under
             * the GM's cursor.
             */
            /*
             * THE BAR'S BUTTONS, BY DELEGATION (E70 C1). The bar is drawn inside the live region, which the tick below
             * replaces every second, so a listener on a button would be gone a second later: one listener on the
             * window, which outlives every rebuild, reads the button pressed. A press held across a rebuild would land
             * on the new button's parent and do nothing, so the tick waits while a pointer is down on the bar (not
             * measured headless: the harness draws no pointer; LIVE-E70-01). The window stays open: a bar op changes
             * the floor, and the console follows it by its live region and its signature.
             */
            let pressing = false;
            dialog.element?.addEventListener("pointerdown", event => {
                if (event.target?.closest?.("[data-drpg-bar]")) pressing = true;
            });
            dialog.element?.addEventListener("pointerup", () => { pressing = false; });
            dialog.element?.addEventListener("click", event => {
                const button = event.target?.closest?.("[data-drpg-bar]");
                if (!button) return;
                event.preventDefault();
                pressing = false;
                runBarOp(button.dataset.drpgBar);
            });

            const ticker = setInterval(() => {
                // Closed, or replaced by a newer console: so is the interval.
                if (!dialog.element?.isConnected) {
                    clearInterval(ticker);
                    return;
                }
                if (!trialFloor() || pressing) return;
                live.refresh();
            }, 1000);
        },
        rejectClose: false
    });

    // Everything comes back here, so the GM lands on the screen they pressed
    // the button from rather than on the scene - the same pattern the GM panel
    // uses for its tiles.
    if (!action || action === "close") return null;

    if (action === "chapterEnd") {
        const chapterWas = getClock().chapter;
        const { openChapterEndDialog } = await import("./chapter.mjs");
        await openChapterEndDialog();
        /* THE ONE ACTION ON THIS CONSOLE THAT DOES NOT COME BACK TO IT.

           Every other button here leaves a trial to keep running, so landing back on
           the screen you pressed it from is right. This one ends the chapter: the trial
           is closed, the clock has moved, and `trialProgress` answers blank for a record
           belonging to the chapter before. Reopening left a console standing over the
           new Daily Life offering to start the NEXT Class Trial - measured at the end of
           both chapters on 11.09, and it is the last thing on screen at the exact moment
           the GM is trying to close the scene.

           Read from the clock rather than from the dialog's answer, because a GM who
           unticked "next chapter" has not ended one and should keep their console. */
        if (getClock().chapter !== chapterWas) return null;
        return manageClassTrial();
    }
    const run = TRIAL_ACTIONS[action];
    if (!run) return null;
    await run();
    return manageClassTrial();
}

/** Open or close the vote. One button, because it is one moment either way. */
export async function openVoteDialog() {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }
    /* ONE OF THESE (E10 C14, 1.2.71; audit S06-26): a second press opened a second window, each with its
       own idea of who was still out - see `alreadyOpen` in live.mjs. */
    if (alreadyOpen("drpg-window-vote")) return null;

    const { openVote, closeVote, pendingVoters, remindVoters, votesIn, voteBar, ballotCopyStatus, trialProgress,
        ballotRecipients } = await import("./vote.mjs");

    // Who is still outstanding, while a vote is running.
    //
    // Counting the vote is irreversible and the counts only appear once it is
    // closed, so "has everybody voted?" used to be a question this screen could
    // not answer - a player who dismissed their ballot by accident was simply
    // never counted and nobody could tell. Names only: who has voted is not how
    // they voted, and only the second is the secret the guide keeps.
    const pending = pendingVoters();
    /* A vote is either running or it is not, and every button on this window means
       something different either way. `pendingVoters` answers null for "no vote", which
       is the same question - asked once here rather than three times below. */
    const running = pending !== null;
    const returned = votesIn() ?? 0;
    /* THE STATUS IS LIVE (E10 C3, 1.2.71). A player who joins mid-vote and asks for a ballot raises
       how many went out, and with it the bar a conviction needs (`voteBar`, `DRPG.Vote.barLine`): the
       window drawn before says so when it happens, redrawn as the trial console is - on the world's
       record and on `drpgBallotsChanged`. Only this block: the buttons are drawn once, as the
       console's are, so Send another ballot's count is the one read when the window opened.

       THIS BROWSER'S COPY OF THE BALLOTS (E10 C1). They are counted on the primary GM, and a
       GM's window shows the copy the GMs' store keeps here: until it has arrived the window says
       so rather than naming every voter as outstanding, and a vote opened before this browser
       loaded, with none of its ballots here, says that the count is the primary's to make. */
    /* BEFORE THE BALLOTS GO OUT (E10 C14, 1.2.71; audit S06-26). Send with nobody connected said so in a
       toast that was gone in seconds, and the window never said beforehand who would be handed a card; and
       Close and count looked pressable with no vote open, and answered with a toast. Now the window names
       the recipients - `ballotRecipients`, the list Send itself would use, as this GM reads it now - or says
       that nobody is connected, and Send waits for somebody; Close and count waits for the ballots. */
    const beforeSend = () => {
        const recipients = ballotRecipients();
        const who = recipients.length
            ? `<p>${plural("DRPG.Vote.recipients", {
                n: recipients.length, who: esc(recipients.map(r => `${r.name} (${r.user.name})`).join(", "))
            })}</p>`
            : `<p class="drpg-warning">${game.i18n.localize("DRPG.Vote.nobodyConnected")}</p>`;
        return `<p class="notes">${game.i18n.localize("DRPG.Vote.sendFirst")}</p>${who}`;
    };
    const statusHtml = () => {
        const waiting = pendingVoters();
        const copy = ballotCopyStatus();
        const bar = voteBar();
        const outstanding = waiting?.length
            ? `<p class="drpg-warning">${game.i18n.format("DRPG.Vote.stillOut", {
                n: waiting.length,
                who: foundry.utils.escapeHTML(waiting.map(p => p.name).join(", "))
            })}</p>`
            : `<p class="notes">${game.i18n.localize("DRPG.Vote.allIn")}</p>`;
        const status = waiting === null
            ? `<p class="notes">${game.i18n.localize("DRPG.Vote.notRunning")}</p>${beforeSend()}`
            : copy === "notReady"
                ? `<p class="drpg-warning">${game.i18n.localize("DRPG.Vote.storeNotReady")}</p>`
                : copy === "none"
                    ? `<p class="drpg-warning">${game.i18n.format("DRPG.Vote.openNoBallots", {
                        n: trialProgress().vote.round
                    })}</p>${outstanding}`
                    : outstanding;
        return `<div class="drpg-vote-status">${status}${
            bar ? `<p class="notes">${game.i18n.format("DRPG.Vote.barLine", bar)}</p>` : ""}</div>`;
    };

    /* THE FOOTER IS DRAWN ONCE, so the window opens again when it would change, as the trial console does
       (`trialSignature`): a vote opened or closed by another GM, the first player connecting, the last
       ballot coming back. Not on a count or a name changing - the window B of scenario 63 draws stays the
       same window while a late player raises the bar. */
    const hasRecipients = () => ballotRecipients().length > 0;
    const signature = () => {
        const waiting = pendingVoters();
        return [waiting !== null, hasRecipients(), Boolean(waiting?.length)].join("|");
    };
    const openedWith = signature();
    const canSend = hasRecipients();
    let reopening = false;

    const action = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Vote.openTitle") },
        classes: ["drpg-panel", "drpg-window-vote"],
        content: dialogContent(`<div>
            <p>${game.i18n.localize("DRPG.Vote.openIntro")}</p>
            ${statusHtml()}
            <p class="notes">${game.i18n.localize("DRPG.Vote.privacyNote")}</p>
        </div>`),
        buttons: [
            /* NOT `action: "close"`, AND THAT ONE WORD COST THE WHOLE TRIAL.

               ApplicationV2 dispatches centrally on `[data-action]` and case "close" is
               its own: `event.stopPropagation(); event.preventDefault(); this.close();`
               - the same handler the window header's X uses. A footer button carrying
               that action never reaches DialogV2's submit at all, so `DialogV2.wait`
               resolved as a dismissal and `closeVote()` below was unreachable.

               Measured on 11.09, running a chapter through the interface: press "Close
               and count" with three ballots in and `voteClosed` stays false, no tally
               card is posted, and the window simply shuts. The verdict button is gated
               on `voteClosed`, and the end-of-chapter button on the verdict - so the
               Class Trial could not be finished from the interface at all. Renaming the
               action and nothing else was measured to fix it, both directions.

               Every other `action: "close"` in this module is a literal "Close" whose
               handler returns null anyway, so they behave identically either way. This
               was the only one that had work to do. */
            { action: "open", default: !running && canSend, disabled: !canSend,
              label: game.i18n.localize(running ? "DRPG.Vote.sendAgain" : "DRPG.Vote.send") },
            ...(pending?.length
                ? [{ action: "remind", label: game.i18n.format("DRPG.Vote.remind", { n: pending.length }) }]
                : []),
            // THE DEFAULT ONCE THE BALLOTS ARE OUT, because from that moment it is the
            // only thing left to do here - and because the button it takes the default
            // FROM restarts the vote. Enter must not be the destructive one.
            // Closed with no vote open (E10 C14, S06-26): there is nothing to count, and the line
            // above the footer says to send the ballots first.
            { action: "tally", label: game.i18n.localize("DRPG.Vote.tally"), default: running, disabled: !running },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel"), default: !running && !canSend }
        ],
        render: (event, dialog) => keepLive(dialog, {
            // Every setting of ours, the world's trial record among them; the ballots, which no setting
            // reports; and a player connecting, who is a recipient a moment later.
            region: ".drpg-vote-status", build: statusHtml, watch: { hooks: ["drpgBallotsChanged", "userConnected"] },
            after: () => {
                if (reopening || signature() === openedWith) return;
                reopening = true;
                dialog.close()
                    .then(() => openVoteDialog())
                    .catch(err => error("Could not reopen the vote window", err));
            }
        }),
        rejectClose: false
    });

    if (action === "open") {
        // An incident still open asks first, as Start the Class Trial does (E10 C12): the ballot
        // asks as many names as the register holds, and the register is written at its close.
        if (!(await incidentClosedFirst())) return openVoteDialog();
        /* RE-SENDING IS STARTING OVER, so somebody has to say so out loud.

           With a vote running this button starts it over - a new round on the primary
           GM, and no ballot of the old one counts (`openVote({ restart })`, E10 C1) - and
           it has to, it is how a vote begins again. Measured when the ballots were a Map
           this button emptied: one ballot in, press it, and that ballot is gone with no
           warning and no card. It used to be the DEFAULT button on this window, so the way to
           lose the room's votes was to open this screen to see who was still out and
           press Enter.

           Send another ballot (`remind`, drawn beside this button while somebody has not
           answered) is what a GM chasing stragglers actually wants, so this stays available
           rather than being taken away: re-sending is a legitimate thing to do to a vote
           that has gone wrong. It just is not something to do by accident.

           AND IT ASKS WHERE THIS BROWSER CANNOT COUNT (E10 fix r1-G3; cor F3). `returned` is
           this browser's copy, and the restart drops the rows the primary holds: on a GM whose
           copy has not arrived, or holds none of a vote open when it loaded - the window that
           names Start the vote over as the way out - it read 0 and the restart ran unasked
           (the suite's "Start the vote over asks first on a GM whose copy of the ballots is
           not ready", red at f9be27d). There the question says it cannot tell how many. */
        const unseen = ballotCopyStatus() !== null;
        if (returned || unseen) {
            const sure = await DialogV2.confirm({
                classes: ["drpg-panel"],
                window: { title: game.i18n.localize("DRPG.Vote.sendAgain") },
                content: `<p>${unseen ? game.i18n.localize("DRPG.Vote.resendUnseen")
                    : plural("DRPG.Vote.resendWarning", { n: returned })}</p>`,
                rejectClose: false
            });
            if (!sure) return openVoteDialog();
        }
        return openVote({ restart: running });
    }
    if (action === "remind") {
        ui.notifications.info(plural("DRPG.Vote.reminded", { n: await remindVoters() }));
        return openVoteDialog();
    }
    if (action === "tally") return closeVote();
    return null;
}
