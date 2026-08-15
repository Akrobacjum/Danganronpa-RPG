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
import { dialogContent } from "./utils.mjs";

const DialogV2 = foundry.applications.api.DialogV2;

/** Open the floor, or drive it once it is open. */
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
        ui.notifications.info(game.i18n.format("DRPG.Vote.reminded", { n: remindVoters() }));
        return openVoteDialog();
    }
    if (action === "close") return closeVote();
    return null;
}
