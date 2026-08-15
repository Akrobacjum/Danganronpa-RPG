/**
 * Danganronpa RPG — the vote, and what it costs.
 * ---------------------------------------------------------------------------
 * Guide, pp. 31–32: "Gracze anonimowo głosują na to, kogo uznać za mordercę.
 * Remis jest uznany za porażkę graczy. Wyniki są jawne, ale głosy - nie.
 * Blackened bierze udział w głosowaniu. Można głosować na Monokumę oraz na
 * martwych graczy. Nie można głosować na siebie."
 *
 * "Wyniki jawne, głosy nie" is the whole design problem, and D6 is why it is a
 * problem: nothing in Foundry's world data is private, so a ballot written to a
 * setting, a flag or a whisper is a ballot anybody can read from the console.
 *
 * So a vote never enters world data at all. It travels on the module socket
 * addressed to the GMs — the server delivers those only to the named users —
 * and is tallied in a plain Map on the collecting GM's client. When the count
 * is published, only the count is published. Nothing is stored afterwards,
 * which also means nothing can be dug up afterwards.
 *
 * The consequences are the other half of this file, and the guide is blunt
 * about them: getting it right executes the Blackened and levels everybody up.
 * Getting it wrong executes an innocent, leaves the Blackened anonymous and in
 * play with a Reinforced Level Up and a new rule of their choosing, and fills
 * every Monokuma's Despair to maximum.
 */

import { MODULE_ID, TRIAL } from "./config.mjs";
import { studentActors } from "./monokuma.mjs";
import { monokumas, fillAllDespair, poolLabel } from "./despair.mjs";
import { isDeceased, livingStudents, killCharacter } from "./chapter.mjs";
import { announce, dialogContent, whisperToGms, log, warn, error } from "./utils.mjs";

const DialogV2 = foundry.applications.api.DialogV2;
const SOCKET_EVENT = `module.${MODULE_ID}`;

const ACTION_BALLOT = "vote.ballot";
const ACTION_OPEN = "vote.open";

/**
 * Ballots for the vote in progress, on the collecting GM's client only.
 *
 * A Map, not a setting. It is deliberately impossible to persist: the ballots
 * exist for the five minutes of the vote and then stop existing.
 */
let ballots = null;

/* ==========================================================================
 * RUNNING A VOTE
 * ========================================================================== */

export function registerVote() {
    // `senderId` is Foundry's own second argument — who actually emitted this.
    // Everything in here is decided from it and never from the payload, because
    // the payload is a claim any player's console can make, and this is the one
    // socket in the module where a forged claim decides who gets executed.
    game.socket.on(SOCKET_EVENT, (payload, senderId) => {
        if (payload?.action === ACTION_OPEN) return onBallotOpened(payload, senderId);
        if (payload?.action === ACTION_BALLOT) return onBallotCast(payload, senderId);
    });
}

/**
 * A GM has opened the vote and this client is being handed a ballot.
 *
 * The GM check is the point: without it any player could push a ballot dialog
 * onto everybody else's screen, with a candidate list of their own choosing.
 */
function onBallotOpened(payload, senderId) {
    if (game.user.isGM) return;
    if (!game.users.get(senderId)?.isGM) return;

    castBallot(payload.candidates, payload.voterActorId, Number(payload.picks) || 1)
        .catch(err => error("Could not open the ballot", err));
}

/**
 * A ballot arriving at a GM.
 *
 * Keyed by the SENDER's user id, not by the actor id the payload names. That one
 * line is the whole secret ballot: the tally used to be keyed by whatever actor
 * id the packet claimed, so a single player could emit one ballot per student
 * and decide the entire Class Trial from their own console — replacing everyone
 * else's vote, since a repeat arrival overwrites rather than adds.
 *
 * The choice is checked against the candidate list this side computes for that
 * voter, which is also what enforces the guide's "nie można głosować na siebie"
 * rather than trusting a `<select>` on a client to have offered honest options.
 */
function onBallotCast(payload, senderId) {
    if (!game.user.isGM) return;
    if (!ballots) return;

    const sender = game.users.get(senderId);
    if (!sender || sender.isGM) return refuseBallot(senderId, "not a player");

    const actor = studentActors().find(a => a.testUserPermission(sender, "OWNER"));
    if (!actor) return refuseBallot(senderId, "owns no student");

    // A ballot is a LIST of names now — one for an ordinary night, two when the
    // night produced two Blackened. Normalised here so a client on older code,
    // or a hand-built packet, still lands somewhere sane.
    const picked = Array.isArray(payload?.choice) ? payload.choice : [payload?.choice];
    const allowedIds = new Set(candidatesFor(actor.id).map(c => c.id));
    const clean = picked.filter(id => allowedIds.has(id));
    if (!clean.length) return refuseBallot(senderId, `nothing on "${picked.join(", ")}" is on their ballot`);

    // One ballot per voter. A second arrival replaces the first rather than
    // adding to the tally — a resend must never double a vote.
    ballots.set(senderId, clean);
    log(`Ballot received with ${clean.length} name(s) (${ballots.size} so far).`);
}

function refuseBallot(senderId, why) {
    warn(`Refused a ballot from ${game.users.get(senderId)?.name ?? senderId}: ${why}.`);
}

/** Everyone who can be accused, from the perspective of one voter. */
function candidatesFor(voterActorId) {
    const out = studentActors()
        // "Można głosować na siebie" (guide p. 32). The voter used to be filtered
        // out of their own ballot, which quietly forbade the one accusation a
        // cornered Blackened is most likely to make — and is exactly the bluff
        // the rule exists to allow.
        .filter(a => TRIAL.allowVotingForSelf || a.id !== voterActorId)
        .filter(a => TRIAL.allowVotingForDead || !isDeceased(a))
        .map(a => ({
            id: a.id,
            name: a.name,
            dead: isDeceased(a)
        }));

    if (TRIAL.allowVotingForMonokuma) {
        out.push({ id: "monokuma", name: game.i18n.localize("DRPG.Vote.monokuma"), dead: false });
    }
    return out;
}

/**
 * Open the vote. Every player with a living or dead student gets a ballot; the
 * Blackened votes too, and nothing here knows or cares which of them that is.
 */
/**
 * @param {object} [options]
 * @param {number} [options.picks]  How many names each ballot must carry.
 *   Guide, p. 32: "Jeśli jest dwóch blackened jednej nocy, należy wskazać obu."
 *   A night can produce two Blackened — a role reversal, or a third party who
 *   took the second kill — and then a ballot naming one of them is not an
 *   answer. The GM says how many the night produced; everything downstream
 *   counts names rather than ballots, so the tally needs no special case.
 */
export async function openVote({ picks = 1 } = {}) {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    picksRequired = Math.max(1, Math.trunc(picks) || 1);
    ballots = new Map();

    const voters = eligibleVoters();

    if (!voters.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Vote.noVoters"));
        ballots = null;
        return null;
    }

    sendBallots(voters);

    await announce({
        content: `<div class="drpg-evidence-card">
            <div class="drpg-objection-banner">${game.i18n.localize("DRPG.Vote.banner")}</div>
            <p>${game.i18n.format("DRPG.Vote.opened", { n: voters.length })}</p>
        </div>`
    });

    log(`Vote opened to ${voters.length} player(s).`);
    return voters.length;
}

function sendBallots(voters) {
    for (const { user, actor } of voters) {
        try {
            game.socket.emit(SOCKET_EVENT, {
                action: ACTION_OPEN,
                voterActorId: actor.id,
                picks: picksRequired,
                candidates: candidatesFor(actor.id)
            }, { recipients: [user.id] });
        } catch (err) {
            error(`Could not send a ballot to ${user.name}`, err);
        }
    }
}

/** Everyone with a ballot out who has not returned it. */
function eligibleVoters() {
    const out = [];
    for (const actor of studentActors()) {
        const user = game.users.find(u => !u.isGM && u.active && actor.testUserPermission(u, "OWNER"));
        if (user) out.push({ user, actor });
    }
    return out;
}

/**
 * Who is still outstanding, by name.
 *
 * A vote is closed on a human's judgement of "everyone has voted", and until
 * this existed that judgement had nothing to go on — the counts only appear
 * after closing, and closing is irreversible. A player who dismissed the dialog
 * by accident was simply not counted, and nobody could tell.
 *
 * Names only: WHO has voted is not the same as HOW they voted, and the second is
 * the thing the guide keeps secret.
 */
export function pendingVoters() {
    if (!game.user.isGM || !ballots) return null;
    return eligibleVoters()
        .filter(({ user }) => !ballots.has(user.id))
        .map(({ user, actor }) => ({ user, actor, name: actor.name }));
}

/**
 * Hand a fresh ballot to everyone who has not returned one.
 *
 * Safe to run repeatedly: a resend replaces a ballot rather than adding one, and
 * anybody who has already voted is skipped so their answer cannot be disturbed.
 */
export function remindVoters() {
    if (!game.user.isGM) return 0;
    const pending = pendingVoters();
    if (!pending?.length) return 0;

    sendBallots(pending);
    log(`Re-sent ballots to ${pending.length} player(s).`);
    return pending.length;
}

/**
 * How many names this vote asks for. Set by `openVote`, read by `sendBallots`.
 * Module-level rather than per-ballot because it is a property of the NIGHT,
 * not of the voter.
 */
let picksRequired = 1;

/** The ballot itself, on a player's screen. */
async function castBallot(candidates, voterActorId, picks = 1) {
    if (!Array.isArray(candidates) || !candidates.length) return;

    const options = candidates.map(c =>
        `<option value="${c.id}">${foundry.utils.escapeHTML(c.name)}${
            c.dead ? ` — ${game.i18n.localize("DRPG.Chapter.deadShort")}` : ""
        }</option>`).join("");

    // One select per name the night demands. Two Blackened means two answers,
    // and the guide is explicit that half an answer is not one.
    const fields = Array.from({ length: Math.max(1, picks) }, (_, i) => `
            <label>${picks > 1
                ? game.i18n.format("DRPG.Vote.whoNth", { n: i + 1 })
                : game.i18n.localize("DRPG.Vote.who")}
                <select name="choice${i}">${options}</select></label>`).join("");

    const choice = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Vote.ballotTitle") },
        classes: ["drpg-panel"],
        content: dialogContent(`<form>
            <p>${game.i18n.localize("DRPG.Vote.ballotIntro")}</p>
            ${picks > 1 ? `<p class="drpg-warning">${
                game.i18n.format("DRPG.Vote.twoBlackened", { n: picks })}</p>` : ""}
            ${fields}
            <p class="notes">${game.i18n.localize("DRPG.Vote.ballotNote")}</p>
        </form>`),
        buttons: [
            {
                action: "ok", label: game.i18n.localize("DRPG.Vote.cast"), default: true,
                callback: (e, b, d) => Array.from({ length: Math.max(1, picks) }, (_, i) =>
                    d.element.querySelector(`[name=choice${i}]`)?.value).filter(Boolean)
            }
        ],
        rejectClose: false
    });

    // Dismissed rather than answered. Silence used to be the end of it — the
    // ballot was gone and there was no way to ask for another — so a misclick
    // disenfranchised somebody in the one vote the whole game turns on. Now it
    // says so, and the GM's own screen lists who is still outstanding.
    if (!choice || choice === "ok" || !choice.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Vote.dismissed"));
        return;
    }

    try {
        // Addressed to the GMs and nobody else — the server delivers it only to
        // them, so no other player's client ever sees this packet.
        //
        // No voter id in the payload: the GM keys the tally by who actually sent
        // the packet. See `onBallotCast`.
        const { gmIds } = await import("./utils.mjs");
        game.socket.emit(SOCKET_EVENT, {
            action: ACTION_BALLOT,
            choice
        }, { recipients: gmIds() });
        ui.notifications.info(game.i18n.localize("DRPG.Vote.castConfirmed"));
    } catch (err) {
        error("Could not send the ballot", err);
    }
}

/**
 * Close the vote and publish the counts.
 *
 * The counts, and only the counts. The Map is dropped on the way out.
 */
export async function closeVote() {
    if (!game.user.isGM) return null;
    if (!ballots) {
        ui.notifications.warn(game.i18n.localize("DRPG.Vote.notOpen"));
        return null;
    }

    const tally = new Map();
    for (const choice of ballots.values()) {
        // Every name on the ballot counts. A two-Blackened night puts two names
        // on each, and both of them are the voter's answer.
        for (const id of (Array.isArray(choice) ? choice : [choice])) {
            if (!id) continue;
            tally.set(id, (tally.get(id) ?? 0) + 1);
        }
    }

    const total = ballots.size;
    ballots = null;

    if (!total) {
        ui.notifications.warn(game.i18n.localize("DRPG.Vote.nobodyVoted"));
        return null;
    }

    const named = id => id === "monokuma"
        ? game.i18n.localize("DRPG.Vote.monokuma")
        : (game.actors.get(id)?.name ?? "?");

    const rows = Array.from(tally.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([id, n]) => ({ id, name: named(id), n }));

    const top = rows[0];
    const tied = rows.filter(r => r.n === top.n).length > 1;

    await announce({
        content: `<div class="drpg-evidence-card">
            <div class="drpg-objection-banner">${game.i18n.localize("DRPG.Vote.resultBanner")}</div>
            <table class="drpg-vault-table"><tbody>${rows.map(r => `<tr>
                <td>${foundry.utils.escapeHTML(r.name)}</td>
                <td style="text-align:right">${r.n}</td>
            </tr>`).join("")}</tbody></table>
            <p>${tied
                ? game.i18n.localize("DRPG.Vote.tied")
                : game.i18n.format("DRPG.Vote.accused", {
                    name: foundry.utils.escapeHTML(top.name), n: top.n, total
                })}</p>
        </div>`
    });

    log(`Vote closed: ${total} ballot(s), ${tied ? "tied" : `${top.name} accused`}.`);
    return { rows, total, tied, accusedId: tied ? null : top.id };
}

/* ==========================================================================
 * CONSEQUENCES
 * ========================================================================== */

/**
 * Apply what the verdict costs. GM-driven, because only the GM knows whether
 * the accused was actually the Blackened — the module never learned it.
 *
 * A tie counts as getting it wrong (guide p. 31), which is why the dialog asks
 * for the verdict rather than reading it off the tally.
 */
export async function openVerdictDialog() {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    const students = studentActors();
    const options = students
        .map(a => `<option value="${a.id}">${foundry.utils.escapeHTML(a.name)}${
            isDeceased(a) ? ` — ${game.i18n.localize("DRPG.Chapter.deadShort")}` : ""
        }</option>`).join("");

    const result = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Vote.verdictTitle") },
        classes: ["drpg-panel"],
        content: dialogContent(`<form>
            <p>${game.i18n.localize("DRPG.Vote.verdictIntro")}</p>
            <label>${game.i18n.localize("DRPG.Vote.executed")}
                <select name="executed">${options}</select></label>
            <label>${game.i18n.localize("DRPG.Vote.blackened")}
                <select name="blackened">${options}</select></label>
            <p class="notes">${game.i18n.localize("DRPG.Vote.verdictNote")}</p>
        </form>`),
        buttons: [
            {
                action: "correct", label: game.i18n.localize("DRPG.Vote.gotItRight"), default: true,
                callback: (e, b, d) => {
                    const f = d.element.querySelector("form");
                    return { correct: true, executedId: f.executed.value, blackenedId: f.blackened.value };
                }
            },
            {
                action: "wrong", label: game.i18n.localize("DRPG.Vote.gotItWrong"),
                callback: (e, b, d) => {
                    const f = d.element.querySelector("form");
                    return { correct: false, executedId: f.executed.value, blackenedId: f.blackened.value };
                }
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    if (!result || result === "cancel") return null;
    return applyVerdict(result);
}

/** Execute somebody, and hand out what the guide says the table has earned. */
export async function applyVerdict({ correct, executedId, blackenedId } = {}) {
    if (!game.user.isGM) return null;

    const executed = game.actors.get(executedId);
    const blackened = game.actors.get(blackenedId);
    const done = [];

    if (executed && !isDeceased(executed)) {
        await killCharacter(executed);
        done.push(game.i18n.format("DRPG.Vote.wasExecuted", {
            name: foundry.utils.escapeHTML(executed.name)
        }));
    }

    if (correct) {
        // Everyone still alive advances. The Blackened is dead, so they are not
        // in this list — which is exactly right.
        const survivors = livingStudents();
        done.push(game.i18n.format("DRPG.Vote.levelUp", {
            n: survivors.length,
            kind: TRIAL.correct.levelUp
        }));
        await promptAdvancements(survivors, TRIAL.correct.levelUp);
    } else {
        if (blackened && !isDeceased(blackened)) {
            done.push(game.i18n.format("DRPG.Vote.blackenedRewarded", {
                kind: TRIAL.wrong.blackenedLevelUp
            }));
            await promptAdvancements([blackened], TRIAL.wrong.blackenedLevelUp);
        }
        if (TRIAL.wrong.fillDespair) {
            await fillAllDespair();
            done.push(game.i18n.format("DRPG.Vote.despairFilled", {
                who: monokumas().map(poolLabel).join(", ")
            }));
        }
        if (TRIAL.wrong.newRule) done.push(game.i18n.localize("DRPG.Vote.newRule"));
    }

    await whisperToGms(`
        <h3>${game.i18n.localize("DRPG.Vote.verdictTitle")}</h3>
        <p>${game.i18n.localize(correct ? "DRPG.Vote.correctSummary" : "DRPG.Vote.wrongSummary")}</p>
        <ul>${done.map(d => `<li>${d}</li>`).join("")}</ul>`);

    log(`Verdict applied: ${correct ? "correct" : "wrong"}.`);
    return done;
}

/**
 * Open the advancement dialog for each character who earned one.
 *
 * Opened on the GM's client rather than pushed at the players: a level-up is a
 * conversation about what the character became, and the module already puts the
 * same dialog behind a button on every sheet.
 */
async function promptAdvancements(actors, kind) {
    const { openAdvancement } = await import("./level-up.mjs");
    for (const actor of actors) {
        try {
            await openAdvancement(actor, kind);
        } catch (err) {
            error(`Could not open the advancement for ${actor.name}`, err);
        }
    }
}
