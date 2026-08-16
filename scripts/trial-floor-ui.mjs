/**
 * Danganronpa RPG — the GM's controls for a Class Trial in session.
 *
 * Kept apart from `trial-floor.mjs` on purpose: that file is the shared clock
 * every client runs, and it has to stay cheap to import. This is the GM's
 * console for it, loaded only when they open it.
 */

import { TRIAL } from "./config.mjs";
import { trialQueue, speaker, secondsLeft, startFloor, nextSpeaker, endFloor }
    from "./trial-floor.mjs";
import { dialogContent, plural } from "./utils.mjs";
import { getClock } from "./clock.mjs";

const DialogV2 = foundry.applications.api.DialogV2;

/**
 * Start a Class Trial. One button, one decision.
 * ---------------------------------------------------------------------------
 * Starting a trial used to be six steps across three windows: open Edit
 * Campaign, set the phase to Class Trial, close it, open the GM panel, open the
 * floor, choose who speaks first. Every one of those is a separate `await`, and
 * they are independent — so the half-states are all reachable. A phase set with
 * no floor open is a trial nobody can speak in; a floor open in Daily Life is a
 * queue running against an action economy that is still live.
 *
 * In the fiction none of that is six decisions. The trial starts. So this asks
 * the one question that is genuinely the GM's — who opens — shows exactly what
 * it is about to do, and then does all of it.
 *
 * No handbook rule moves. These are the same operations in the same order; the
 * music follows the queue on its own (see music.mjs, which watches
 * `trialQueue`), and the speaking order is the same alphabetical rotation
 * `startFloor` has always built.
 */
export async function startClassTrial() {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    // Already running: this is the same button, so it does the useful thing
    // rather than refusing. A GM pressing "start" on a trial in progress means
    // "show me the trial".
    if (trialQueue()) return openFloorDialog();

    const { livingStudents } = await import("./chapter.mjs");
    const alive = livingStudents().sort((a, b) => a.name.localeCompare(b.name));
    if (!alive.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Floor.nobody"));
        return null;
    }

    const names = alive.map(a => foundry.utils.escapeHTML(a.name));
    const orderFrom = id => {
        const at = alive.findIndex(a => a.id === id);
        const rotated = at < 0 ? names : [...names.slice(at), ...names.slice(0, at)];
        return rotated.join(" → ");
    };

    const result = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Floor.startTrial") },
        classes: ["drpg-panel"],
        content: dialogContent(`<form>
            <p>${game.i18n.localize("DRPG.Floor.startTrialIntro")}</p>
            <ul class="drpg-briefing-facts">
                <li>${game.i18n.localize("DRPG.Floor.startTrialStepPhase")}</li>
                <li>${game.i18n.localize("DRPG.Floor.startTrialStepFloor")}</li>
                <li>${game.i18n.localize("DRPG.Floor.startTrialStepAnnounce")}</li>
            </ul>
            <label>${game.i18n.localize("DRPG.Floor.volunteer")}
                <select name="who">${alive.map(a =>
                    `<option value="${a.id}">${foundry.utils.escapeHTML(a.name)}</option>`
                ).join("")}</select></label>
            <label>${game.i18n.localize("DRPG.Floor.seconds")}
                <input type="number" name="seconds" min="30" step="10"
                       value="${TRIAL.speakSeconds}" /></label>
            <p class="notes drpg-trial-order">${game.i18n.format("DRPG.Floor.orderPreview",
                { order: orderFrom(alive[0].id) })}</p>
        </form>`),
        buttons: [
            {
                action: "ok", label: game.i18n.localize("DRPG.Floor.startTrial"), default: true,
                callback: (e, b, d) => {
                    const f = d.element.querySelector("form");
                    return { who: f.who.value, seconds: Number(f.seconds.value) || TRIAL.speakSeconds };
                }
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        // The order is the one thing a GM cannot work out from the field above
        // it — it depends on who they pick — so it is shown and kept true while
        // they are still deciding, rather than after they have committed.
        render: (event, dialog) => {
            const form = dialog.element.querySelector("form");
            const line = dialog.element.querySelector(".drpg-trial-order");
            form?.who?.addEventListener("change", () => {
                line.textContent = game.i18n.format("DRPG.Floor.orderPreview",
                    { order: orderFrom(form.who.value) });
            });
        },
        rejectClose: false
    });

    if (!result || result === "cancel") return null;

    const { setPhase } = await import("./clock.mjs");
    await setPhase("classTrial");
    await startFloor(result.who, { seconds: result.seconds });

    const { announce } = await import("./utils.mjs");
    await announce({
        content: `<div class="drpg-card"><h3>${
            game.i18n.localize("DRPG.Floor.startTrial")}</h3><p>${
            game.i18n.format("DRPG.Floor.trialOpened", {
                who: foundry.utils.escapeHTML(game.actors.get(result.who)?.name ?? "?")
            })}</p><p class="notes">${orderFrom(result.who)}</p></div>`
    });

    return openFloorDialog();
}

/**
 * The other end of the same button.
 *
 * Closing a trial is the mirror of opening one and was scattered the same way:
 * close the floor, remember to open the vote, remember the verdict after it.
 * The floor window already carries the vote and the verdict as steps, so this
 * closes the floor and hands straight over to the vote — which is what happens
 * next in every trial the handbook describes.
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
    return openVoteDialog();
}

/** Open the floor, or drive it once it is open. */
/**
 * One door to the Class Trial, labelled by where the table is.
 *
 * Starting and ending a trial used to be two tiles in two different sections —
 * "Start the Class Trial" filed under the case, "End the trial" under the
 * trial — so the pair a GM reaches for at the two ends of the same scene never
 * appeared on screen together. This is both, plus the floor, behind the one
 * name that covers all of it.
 */
export async function manageClassTrial() {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    const running = getClock().phase === "classTrial";

    const action = await DialogV2.wait({
        classes: ["drpg-panel"],
        window: { title: game.i18n.localize("DRPG.Floor.manageTrial") },
        content: dialogContent(`<div>
            <p>${game.i18n.localize(running
                ? "DRPG.Floor.manageRunning" : "DRPG.Floor.manageNotRunning")}</p>
        </div>`),
        buttons: [
            ...(running
                ? [{ action: "floor", default: true,
                     label: game.i18n.localize("DRPG.Floor.manageTitle") },
                   { action: "end", label: game.i18n.localize("DRPG.Floor.endTrial") }]
                : [{ action: "start", default: true,
                     label: game.i18n.localize("DRPG.Floor.startTrial") }]),
            { action: "close", label: game.i18n.localize("DRPG.Panel.close") }
        ],
        rejectClose: false
    });

    if (action === "start") return startClassTrial();
    if (action === "end") return endClassTrial();
    if (action === "floor") return openFloorDialog();
    return null;
}

export async function openFloorDialog() {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    const queue = trialQueue();
    return queue ? driveFloor(queue) : startFloorDialog();
}

async function startFloorDialog() {
    const { livingStudents } = await import("./chapter.mjs");
    const alive = livingStudents().sort((a, b) => a.name.localeCompare(b.name));

    if (!alive.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Floor.nobody"));
        return null;
    }

    const result = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Floor.manageTitle") },
        classes: ["drpg-panel"],
        content: dialogContent(`<form>
            <p>${game.i18n.localize("DRPG.Floor.startIntro")}</p>
            <label>${game.i18n.localize("DRPG.Floor.volunteer")}
                <select name="who">${alive.map(a =>
                    `<option value="${a.id}">${foundry.utils.escapeHTML(a.name)}</option>`
                ).join("")}</select></label>
            <label>${game.i18n.localize("DRPG.Floor.seconds")}
                <input type="number" name="seconds" min="30" step="10"
                       value="${TRIAL.speakSeconds}" /></label>
            <p class="notes">${game.i18n.localize("DRPG.Floor.startNote")}</p>
        </form>`),
        buttons: [
            {
                action: "ok", label: game.i18n.localize("DRPG.Floor.start"), default: true,
                callback: (e, b, d) => {
                    const f = d.element.querySelector("form");
                    return { who: f.who.value, seconds: Number(f.seconds.value) || TRIAL.speakSeconds };
                }
            },
            // The vote and the verdict used to be their own GM-panel tiles. A
            // trial runs floor -> vote -> verdict in that order, every time, so
            // they are steps on one screen rather than three separate errands
            // through the panel.
            { action: "vote", label: game.i18n.localize("DRPG.Vote.openTitle") },
            { action: "verdict", label: game.i18n.localize("DRPG.Vote.verdictTitle") },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    if (!result || result === "cancel") return null;
    if (result === "vote") { await openVoteDialog(); return openFloorDialog(); }
    if (result === "verdict") {
        const { openVerdictDialog } = await import("./vote.mjs");
        await openVerdictDialog();
        return openFloorDialog();
    }
    await startFloor(result.who, { seconds: result.seconds });
    return openFloorDialog();
}

async function driveFloor(queue) {
    const who = speaker(queue);
    const left = secondsLeft(queue);
    const order = queue.order
        .map((id, i) => {
            const actor = game.actors.get(id);
            const name = foundry.utils.escapeHTML(actor?.name ?? "?");
            return i === queue.current ? `<strong>${name}</strong>` : name;
        })
        .join(" → ");

    const action = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Floor.manageTitle") },
        classes: ["drpg-panel"],
        content: dialogContent(`<div>
            <p>${game.i18n.format("DRPG.Floor.holding", {
                name: foundry.utils.escapeHTML(who?.name ?? "—"),
                seconds: left
            })}</p>
            <p class="notes">${order}</p>
            <p class="notes">${game.i18n.localize("DRPG.Floor.objectionNote")}</p>
        </div>`),
        buttons: [
            { action: "next", label: game.i18n.localize("DRPG.Floor.next"), default: true },
            { action: "end", label: game.i18n.localize("DRPG.Floor.end") },
            { action: "vote", label: game.i18n.localize("DRPG.Vote.openTitle") },
            { action: "verdict", label: game.i18n.localize("DRPG.Vote.verdictTitle") },
            { action: "close", label: game.i18n.localize("DRPG.Panel.close") }
        ],
        rejectClose: false
    });

    if (action === "next") {
        await nextSpeaker();
        return openFloorDialog();
    }
    if (action === "vote") { await openVoteDialog(); return openFloorDialog(); }
    if (action === "verdict") {
        const { openVerdictDialog } = await import("./vote.mjs");
        await openVerdictDialog();
        return openFloorDialog();
    }
    if (action === "end") await endFloor();
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
    // not answer — a player who dismissed their ballot by accident was simply
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
