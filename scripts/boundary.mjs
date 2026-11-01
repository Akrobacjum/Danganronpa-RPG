/**
 * Danganronpa RPG - the boundary between two times of day: one road to start and end an Eclipse, and the readiness round
 * before the clock moves.
 * ---------------------------------------------------------------------------
 * ONE ROAD (E37 C2, 01.11.2026; audit S10-54, decision D44b: "Obie drogi (szewron i panel) tą samą funkcją
 * toggleEclipse, z pytaniem tylko wtedy, gdy ktoś nie rozstawił postaci"). The HUD's chevron and the GM panel's "Do it"
 * were two roads with two behaviours: the chevron asked E17's question before a start and ended a running Eclipse at
 * once, over a student who had not placed; the panel started one without the question and showed the placement table
 * at every end, whoever had placed. Both call `toggleEclipse` now (tier 0 R1194, tier 2 E37-T2). The writes are
 * eclipse.mjs `startEclipse` and `endEclipse`, as before; this file asks the GM and chooses which.
 *
 * THE READINESS ROUND (E37 C3, 01.11.2026; E37-12 to E37-15, the owner's ask of 28.10: "Gdy GM próbuje zmienić porę
 * dnia albo zakończyć Eclipse, każdy gracz dostaje okno z wyborem "Done" albo "Jeszcze chwila". Jeśli pora dnia jeszcze
 * nie minęła, GM dostaje okno z listą osób gotowych i niegotowych."; its two open points with their defaults, Q-E37-2,
 * approved 01.11.2026: the GM may go on past a player who is not ready, after a confirmation, and a player who is not
 * connected counts as ready). A GM's press that would start an Eclipse, end one or move the time of day - the chevron,
 * the panel's "Do it" (`toggleEclipse`) and its "Next time of day" (`nextTimeOfDay`) - opens a round on the primary GM
 * first: the world setting `readyRound` (settings.mjs), written there alone, in a step of `READY_KEY`
 * (`openRoundOnPrimary`, `answerOnPrimary`, `endRoundOnPrimary`; the bridge's rows `ready.open`, `ready.answer`,
 * `ready.end`, gm-bridge.mjs). Every player who owns a student of the one cast (monokuma.mjs `actingStudents`) gets one
 * window, Done or One moment; the GM who pressed gets a live window listing them, which goes on by itself once every
 * connected player said Done, and whose own buttons go on past the others after a confirmation. A start asks E17's
 * question first (Q-E37-3): the question is the GM's yes, the round the players'.
 *
 * WHAT THE ROUND MOVES: nothing. A player's answer is that player's word about that player (Foundry's sender, never a
 * user id in the packet), and only the GM's own window, on the GM's browser, moves the clock - by the same writes as
 * before (`startEclipse`, `endEclipse`, clock.mjs `advanceTimeOfDay`). The API, the console, the campaign editor and the
 * rewind ask nobody.
 *
 * NO ROUND: while an incident runs before Stage 6 (the clock moves in private there, clock.mjs `announceTimeOfDay`, and a
 * window on every screen would tell the bystanders), in a Class Trial, and when no connected player owns a student of
 * the cast. A round reads as over (no round) once the clock has left its boundary by any road (`roundOf`), so a move
 * through the API ends it too; the season reset needs no clause of its own, the boundary stamps the season.
 * Measured headless (tier 2 E37-T3, scenario 40 part R); a reload mid-round and how long a round takes at a table are
 * LIVE-E37-02.
 *
 * In the clock's family (clock.mjs, eclipse.mjs), and imported by the HUD and the panel with `import()`, as they import
 * eclipse.mjs; the bridge and the GM stores by `import()` as well, where a static import would close a cycle.
 */

import { MODULE_ID } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { getClock, timeOfDayLabel, boundaryStamp, advanceTimeOfDay } from "./clock.mjs";
import { isEclipse, incomingTimeOfDay, startEclipse, endEclipse, startRefusal, placementStatus, eclipseLabel } from "./eclipse.mjs";
import { actingStudents } from "./monokuma.mjs";
import { tableDialog, dialogContent, serialWrite, isPrimaryGm, serverNow, listOf, plural, esc, error } from "./utils.mjs";
import { alreadyOpen, keepLive } from "./live.mjs";

/**
 * Start the Eclipse, or end the running one (D44b).
 *
 * A START: the refusals first, with their words (eclipse.mjs `startRefusal`: a body nobody has answered, an incident
 * before Stage 6, a Class Trial - the HUD dims its chevron with the same words), then E17's question (`askEclipse`,
 * "Not yet" the default), then the readiness round (`askReadiness`, E37 C3), then `startEclipse`. The panel's "Do it"
 * asks it too now (Q-E37-3, approved 01.11.2026): until E37 it started an Eclipse without asking, and a misclick there
 * cost the five-minute take-back.
 *
 * AN END: the readiness round first, whose window ends and moves the clock (or ends without advancing) once the GM goes
 * on; with a student who has not crossed and whose player has not said Done, the placement table below decides instead.
 * With no round, nothing is asked when every placing student has crossed at least once (`placementStatus`, the one
 * cast's `moved`): the Eclipse ends and the clock moves to the time of day it led into. Otherwise the placement table -
 * who has crossed and where they stand, the ones who have not dimmed - with End and move the clock, End without
 * advancing and Close. The Night Eclipse, which places freely (D197), reads the same: its crossings are counted too
 * (eclipse.mjs `countCrossingInStep`), so a student at 0 holds its end as well.
 */
export async function toggleEclipse() {
    if (!game.user.isGM) return null;
    if (!isEclipse()) {
        const refusal = await startRefusal(getClock());
        if (refusal) {
            ui.notifications.warn(game.i18n.localize(refusal));
            return null;
        }
        if (!await askEclipse(incomingTimeOfDay(getClock()))) return null;
        const ready = await askReadiness("eclipseStart");
        if (!ready.go) return null;
        await ready.close("go");
        return startEclipse();
    }

    const ready = await askReadiness("eclipseEnd");
    if (!ready.go) return null;
    if (ready.choice) {
        await ready.close("go");
        return endEclipse({ advance: ready.choice !== "endOnly" });
    }
    const rows = placementStatus();
    if (rows.every(s => s.moved > 0)) {
        await ready.close("go");
        return endEclipse({ advance: true });
    }
    const choice = await placementTable(rows);
    await ready.close(choice === "end" || choice === "endOnly" ? "go" : "stop");
    if (choice === "end") return endEclipse({ advance: true });
    if (choice === "endOnly") return endEclipse({ advance: false });
    return null;
}

/**
 * "Next time of day" on the GM panel (E37 C3; moved here from gm-panel.mjs `EXTRA_ACTIONS.advance`): refused during an
 * Eclipse, whose own end moves the clock (`DRPG.Panel.advanceDuringEclipse`), then the readiness round, then the same
 * call as before - clock.mjs `advanceTimeOfDay` with the refill, the day and the session ticking over at Night.
 */
export async function nextTimeOfDay() {
    if (!game.user.isGM) return null;
    if (isEclipse()) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.advanceDuringEclipse"));
        return null;
    }
    const ready = await askReadiness("next");
    if (!ready.go) return null;
    await ready.close("go");
    return advanceTimeOfDay({ resetActions: true });
}

/**
 * THE QUESTION ASKS FIRST, AND "NO" IS THE DEFAULT (E17 C7, 26.10.2026; audit S10-42; moved here from hud.mjs by E37 C2).
 * One press opened the Eclipse: the refill, the grants and the seals gone and a card on every screen, from a control
 * beside the rewind. The press asks, the Eclipse it opens named, and Enter or a closed window answers no. Asked on both
 * roads since E37 C2 (`toggleEclipse`), after the refusals, so a held start is refused with its words and not asked.
 */
async function askEclipse(incoming) {
    const DialogV2 = foundry.applications.api.DialogV2;
    const name = game.i18n.format("DRPG.Eclipse.named", { time: timeOfDayLabel(incoming) });
    return Boolean(await DialogV2.confirm({
        classes: ["drpg-panel"],
        window: { title: name },
        content: `<p>${eclipseQuestion(getClock(), name).text}</p>`,
        yes: { label: game.i18n.localize("DRPG.Hud.eclipseAskYes") },
        no: { label: game.i18n.localize("DRPG.Hud.eclipseAskNo"), default: true },
        rejectClose: false
    }));
}

/**
 * WHAT THE QUESTION SAYS (E17 fix p2-G2, 26.10.2026; the end review's E17p2-R4; moved here from hud.mjs by E37 C2):
 * `{ key, text }` for the Eclipse `name` over `clock`. A boundary refilled already (`refilledFor`, an Eclipse for it
 * ended without advancing more than five minutes ago) refills nobody again (eclipse.mjs `startEclipse`), and the
 * question said everyone's actions refill: it says so now. Pure but for the words (R1004).
 */
export function eclipseQuestion(clock, name) {
    const key = clock?.refilledFor && clock.refilledFor === boundaryStamp(clock) ? "DRPG.Hud.eclipseAskRefilled" : "DRPG.Hud.eclipseAsk";
    return { key, text: game.i18n.format(key, { name: foundry.utils.escapeHTML(String(name ?? "")) }) };
}

/**
 * The placement table, for an end with somebody who has not crossed (moved here from gm-panel.mjs `toggleEclipse` by
 * E37 C2): a row a placing student, the ones at 0 dimmed, under `DRPG.Eclipse.endPrompt`. Answers the button pressed:
 * "end", "endOnly", or "cancel" / null for Close.
 */
function placementTable(rows) {
    const body = rows.map(s => `
        <tr${s.moved === 0 ? ' style="opacity:.55"' : ""}>
            <td>${foundry.utils.escapeHTML(s.actor.name)}</td>
            <td>${foundry.utils.escapeHTML(s.room ?? "-")}</td>
            <td style="text-align:center">${
                // A free-placement Eclipse has no budget, so the column reports
                // how often they have crossed - whether they have placed at all,
                // which is the question the GM is holding this window open to answer.
                s.allowance === null ? s.moved : `${s.moved} / ${s.allowance}`
            }</td>
        </tr>`).join("");

    return tableDialog({
        window: { title: eclipseLabel() },
        classes: ["drpg-panel"],
        content: `<p>${game.i18n.localize("DRPG.Eclipse.endPrompt")}</p>
            <table><thead><tr>
                <th>${game.i18n.localize("DRPG.Panel.character")}</th>
                <th>${game.i18n.localize("DRPG.Project.room")}</th>
                <th>${game.i18n.localize("DRPG.Eclipse.movesColumn")}</th>
            </tr></thead><tbody>${body}</tbody></table>`,
        buttons: [
            { action: "end", label: game.i18n.localize("DRPG.Eclipse.endAndAdvance"), default: true },
            { action: "endOnly", label: game.i18n.localize("DRPG.Eclipse.endOnly") },
            { action: "cancel", label: game.i18n.localize("DRPG.Panel.close") }
        ],
        rejectClose: false
    });
}

/* ==========================================================================
 * THE READINESS ROUND (E37 C3)
 * ========================================================================== */

/**
 * The round's key in this browser's queue (utils.mjs `serialWrite`): every write of `readyRound` is a step of it on the
 * primary GM, read and written in the same step, so two answers landing within a server round trip each keep the
 * other's (tier 0 R1196 holds every write of the setting to a step of this key in this file).
 */
export const READY_KEY = "readyRound";

/** What a round is for: an Eclipse's start, its end, or the panel's "Next time of day". */
export const READY_KINDS = Object.freeze(["eclipseStart", "eclipseEnd", "next"]);

const GM_CLASS = "drpg-ready-gm";
const PLAYER_CLASS = "drpg-ready-player";

/**
 * The record as this browser holds it: `{ id, kind, boundary, by, at, answers: { [userId]: "done"|"wait" }, ended? }`,
 * or `{}` with none written. `ended` ("go" or "stop") is the GM's end of it, kept so a player's window can say which.
 */
export function readyRecord() {
    try {
        return game.settings.get(MODULE_ID, SETTINGS.readyRound) ?? {};
    } catch {
        return {};
    }
}

/**
 * The round `record` holds, while it is open over `clock`, or null: none written, ended by a GM, or stale - the clock
 * left its boundary (`boundary` is not the clock's `boundaryStamp`) or the Eclipse's flag no longer matches its kind (an
 * Eclipse started or ended at the same boundary). Pure.
 */
export function roundOf(record, clock) {
    if (!record?.id || record.ended || !READY_KINDS.includes(record.kind)) return null;
    if (record.boundary !== boundaryStamp(clock)) return null;
    if ((record.kind === "eclipseEnd") !== (clock?.eclipse === true)) return null;
    return record;
}

/**
 * Who a round asks, read live: every user who is no GM (an Assistant GM included among the GMs) and owns a student of
 * the one cast (monokuma.mjs `actingStudents`: the living and the Monocubs) - `{ id, name, active, actors: [{ id, name
 * }] }`, one per user however many students they play.
 */
export function roundUsers(actors = actingStudents(), users = game.users) {
    const out = new Map();
    for (const actor of actors) {
        for (const user of users) {
            if (user.isGM || !actor.testUserPermission(user, "OWNER")) continue;
            const row = out.get(user.id) ?? { id: user.id, name: user.name, active: Boolean(user.active), actors: [] };
            row.actors.push({ id: actor.id, name: actor.name });
            out.set(user.id, row);
        }
    }
    return [...out.values()];
}

/**
 * THE ROUND'S READING (tier 1 R1195), pure: `record` over `clock`, the asked `users` (`roundUsers`) and, at an Eclipse's
 * end, `placement` (`[{ actorId, moved }]`, eclipse.mjs `placementStatus`). Each user's row is Done ("done"), One moment
 * ("wait"), No answer yet ("none") or Not connected ("away", counted as done: Q-E37-2's default). `notDone` counts the
 * connected players who have not said Done. At an end, `unplaced` lists the placing students who have not crossed and
 * whose player has not said Done (a player away has said nothing, so that student holds the end, as the placement table
 * held it before the round). `ready` is true only when nobody is left in either. A stale round reads as none.
 */
export function roundReading(record, { users = [], clock = null, placement = null } = {}) {
    const round = roundOf(record, clock);
    if (!round) return { open: false, id: null, kind: null, rows: [], notDone: 0, unplaced: [], ready: false };
    const answers = round.answers ?? {};
    const rows = users.map(user => ({
        userId: user.id, name: user.name, actors: (user.actors ?? []).map(a => a.name),
        status: !user.active ? "away" : answers[user.id] === "done" ? "done" : answers[user.id] === "wait" ? "wait" : "none"
    }));
    const notDone = rows.filter(row => row.status === "wait" || row.status === "none").length;
    const saidDone = new Set(users.filter(user => user.active && answers[user.id] === "done").flatMap(user => (user.actors ?? []).map(a => a.id)));
    const unplaced = round.kind === "eclipseEnd" && Array.isArray(placement)
        ? placement.filter(s => !(s.moved > 0) && !saidDone.has(s.actorId)).map(s => s.actorId)
        : [];
    return { open: true, id: round.id, kind: round.kind, rows, notDone, unplaced, ready: notDone === 0 && unplaced.length === 0 };
}

/** The kind of round the clock is at: an end while an Eclipse runs, otherwise a start or the next time of day. */
function kindFits(kind, clock) {
    return kind === "eclipseEnd" ? clock?.eclipse === true : clock?.eclipse !== true;
}

/** No round while an incident runs before Stage 6 (its clock is private) or in a Class Trial (E37-12). */
async function roundAllowed(clock) {
    if (clock?.phase === "classTrial") return false;
    const { murderState } = await import("./murder.mjs");
    const state = murderState();
    return !(state && state.stage !== "resolution");
}

/**
 * OPEN A ROUND, ON THE PRIMARY GM (the run of `ready.open`, and the primary's own press): `{ reply: { round } }` with
 * the round now open - a new one, or the one already open for this boundary, which a second GM's press joins - or with
 * `round: null` when nobody is to be asked (an incident before Stage 6, a Class Trial, no connected player of the cast:
 * the press goes on as it did before the round); `{ refused }` for a kind the clock is not at, or while a round of
 * another kind is open here. `by` is the GM who pressed (Foundry's sender on the bridge).
 */
export async function openRoundOnPrimary({ kind, by = null } = {}) {
    if (!game.user.isGM || !isPrimaryGm()) return { refused: "nothing was carried out: this browser is not the primary GM" };
    return serialWrite(READY_KEY, async () => {
        const clock = getClock();
        if (!READY_KINDS.includes(kind) || !kindFits(kind, clock)) return { refused: "the clock is not at that boundary" };
        if (!await roundAllowed(clock)) return { reply: { round: null } };
        const users = roundUsers();
        if (!users.some(user => user.active)) return { reply: { round: null } };
        const open = roundOf(readyRecord(), clock);
        if (open && open.kind !== kind) return { refused: "another readiness round is open" };
        if (open) return { reply: { round: open } };
        const record = { id: foundry.utils.randomID(), kind, boundary: boundaryStamp(clock), by, at: serverNow(), answers: {} };
        await game.settings.set(MODULE_ID, SETTINGS.readyRound, record);
        return { reply: { round: record } };
    });
}

/**
 * A PLAYER'S ANSWER, ON THE PRIMARY GM (the run of `ready.answer`): `sender` is the user Foundry names as the sender,
 * and the answer is theirs alone - Done (`ready` true) or One moment - for the round `roundId` names, which must be the
 * one open; a sender who plays no student the round asks is refused. Nothing but the sender's own answer is written,
 * and nothing else moves: the clock is the GM's window's (E37-15).
 */
export async function answerOnPrimary(sender, { roundId, ready } = {}) {
    if (!game.user.isGM || !isPrimaryGm() || !sender) return { refused: "nothing was carried out: this browser is not the primary GM" };
    return serialWrite(READY_KEY, async () => {
        const round = roundOf(readyRecord(), getClock());
        if (!round) return { refused: "no readiness round is open" };
        if (round.id !== roundId) return { refused: "the readiness round has moved on since that answer" };
        if (!roundUsers().some(user => user.id === sender.id)) return { refused: "the sender plays no student the round asks" };
        const answer = ready === true ? "done" : "wait";
        if (round.answers?.[sender.id] !== answer) {
            await game.settings.set(MODULE_ID, SETTINGS.readyRound, { ...round, answers: { ...(round.answers ?? {}), [sender.id]: answer } });
        }
        return { reply: { answer } };
    });
}

/**
 * END A ROUND, ON THE PRIMARY GM (the run of `ready.end`, and the primary's own): the GM went on (`outcome` "go") or
 * stopped it ("stop", the GM's Not now). The record stays with `ended` set, so a player's window closes and says which;
 * a round already ended, or another's id, is refused and writes nothing.
 */
export async function endRoundOnPrimary({ roundId, outcome } = {}) {
    if (!game.user.isGM || !isPrimaryGm()) return { refused: "nothing was carried out: this browser is not the primary GM" };
    return serialWrite(READY_KEY, async () => {
        const record = readyRecord();
        if (!record?.id || record.id !== roundId || record.ended) return { refused: "nothing was carried out: that readiness round is not open" };
        const ended = outcome === "go" ? "go" : "stop";
        await game.settings.set(MODULE_ID, SETTINGS.readyRound, { ...record, ended });
        return { reply: { ended } };
    });
}

/** The window's title: the Eclipse's name (`Eclipse.named`), or the end of this time of day. */
function roundTitle(kind, clock = getClock()) {
    return kind === "next" ? game.i18n.localize("DRPG.Ready.titleNext") : eclipseLabel(clock);
}

/** The GM's buttons that go on: a start's "Start it", an end's two, the next time of day's "Move the clock". */
function goButtons(kind) {
    if (kind === "eclipseStart") return [{ action: "go", label: game.i18n.localize("DRPG.Hud.eclipseAskYes") }];
    if (kind === "eclipseEnd") return [{ action: "end", label: game.i18n.localize("DRPG.Eclipse.endAndAdvance") },
        { action: "endOnly", label: game.i18n.localize("DRPG.Eclipse.endOnly") }];
    return [{ action: "go", label: game.i18n.localize("DRPG.Ready.goNext") }];
}

/** The GM's window's body, from a reading: the count of players not done (or everyone's Done), then a row a player. */
function roundBody(reading) {
    const lede = reading.notDone > 0 ? plural("DRPG.Ready.notDone", { n: reading.notDone }) : game.i18n.localize("DRPG.Ready.allDone");
    const rows = reading.rows.map(row => `<tr data-drpg-user="${esc(row.userId)}" data-drpg-status="${row.status}">
            <td>${esc(row.name)}</td><td>${esc(listOf(row.actors))}</td><td>${esc(game.i18n.localize(`DRPG.Ready.status.${row.status}`))}</td>
        </tr>`).join("");
    return `<div class="drpg-ready-body"><p class="drpg-ready-lede">${lede}</p><table><tbody>${rows}</tbody></table></div>`;
}

/** The GM's confirmation before going on past `n` players who are not done: "Wait" the default (E37-14). */
async function confirmGo(n, title) {
    const DialogV2 = foundry.applications.api.DialogV2;
    return Boolean(await DialogV2.confirm({
        classes: ["drpg-panel"],
        window: { title },
        content: `<p>${plural("DRPG.Ready.confirmGo", { n })}</p>`,
        yes: { label: game.i18n.localize("DRPG.Ready.goAnyway") },
        no: { label: game.i18n.localize("DRPG.Ready.wait2"), default: true },
        rejectClose: false
    }));
}

/**
 * ASK THE PLAYERS BEFORE THE CLOCK MOVES (E37-12, E37-14), on the browser of the GM who pressed: the round is opened on
 * the primary (`ready.open`; the primary's own press locally), and with one open the GM's window. Answers `{ go:
 * false }` when the GM stopped (Not now, a closed window), the round went away (another GM ended it, the clock moved) or
 * the primary refused; otherwise `{ go: true, choice, close }` - `choice` the button that went on (null with no round,
 * and at an end with a student nobody has placed for, which the placement table decides), `close(outcome)` the round's
 * end on the primary, called by the caller right before it moves the clock (a no-op with no round).
 */
async function askReadiness(kind) {
    const { requestReadyOpen, requestReadyEnd } = await import("./gm-bridge.mjs");
    const res = await requestReadyOpen({ kind });
    if (!res.ok || !res.value) return { go: false };
    const round = res.value.round ?? null;
    if (!round) return { go: true, choice: null, close: async () => {} };
    const close = async outcome => {
        const ended = await requestReadyEnd({ roundId: round.id, outcome });
        if (!ended.ok) error(`The readiness round ${round.id} was not ended on the primary GM (${ended.reason ?? "refused"})`);
    };
    // The window is up on this browser already (a second press of the same GM): raised, and this press goes nowhere.
    if (alreadyOpen(GM_CLASS)) return { go: false };
    const choice = await roundWindow(round);
    if (choice === null) return { go: false };
    if (choice === "stop") {
        await close("stop");
        return { go: false };
    }
    return { go: true, choice: choice === "table" ? null : choice, close };
}

/**
 * THE GM'S WINDOW (E37-14): who is asked, each as Done, One moment, No answer yet or Not connected, kept live on the
 * round's setting, the Eclipse's crossings and who is connected (live.mjs `keepLive`). It goes on by itself once the
 * reading is `ready`; a go button with somebody not done asks to confirm first ("Wait" brings the window back); at an
 * end, a student nobody has placed for hands the decision to the placement table ("table"). Answers the action that
 * went on, "table", "stop" (Not now or a closed window), or null when the round went away under it.
 */
async function roundWindow(round) {
    const DialogV2 = foundry.applications.api.DialogV2;
    const { eclipseMoveStore } = await import("./gm-stores.mjs");
    const kind = round.kind;
    const placement = () => placementStatus().map(s => ({ actorId: s.actor.id, moved: s.moved }));
    const read = () => roundReading(readyRecord(), { users: roundUsers(), clock: getClock(), placement: kind === "eclipseEnd" ? placement() : null });
    const title = roundTitle(kind);
    let by = null;
    const choice = await DialogV2.wait({
        window: { title },
        classes: ["drpg-panel", GM_CLASS],
        content: dialogContent(roundBody(read())),
        buttons: [...goButtons(kind), { action: "notNow", label: game.i18n.localize("DRPG.Ready.notNow") }],
        render: (event, dialog) => {
            const check = () => {
                if (by || !dialog.element?.isConnected) return;
                const now = read();
                if (!now.open || now.id !== round.id) by = "gone";
                else if (now.ready) by = "ready";
                else return;
                dialog.close();
            };
            keepLive(dialog, {
                region: ".drpg-ready-body",
                build: () => roundBody(read()),
                watch: { settings: [SETTINGS.readyRound], stores: [eclipseMoveStore], hooks: ["userConnected"] },
                after: check
            });
            setTimeout(check, 0);
        },
        rejectClose: false
    });
    if (by === "gone") return null;
    if (by === "ready") return kind === "eclipseEnd" ? "end" : "go";
    if (!goButtons(kind).some(button => button.action === choice)) return "stop";
    const now = read();
    if (!now.open || now.id !== round.id) return null;
    if (now.unplaced.length) return "table";
    if (now.notDone > 0 && !await confirmGo(now.notDone, title)) return roundWindow(round);
    return choice;
}

/* --------------------------------------------------------------------------
 * The player's window (E37-13)
 * ------------------------------------------------------------------------ */

let shownFor = null;
let toldFor = null;

/**
 * On a player's browser, on every write of the round (sync.mjs `SYNC.ready`) and at ready: one window while a round
 * asks this player and they have not said Done - a reload mid-round opens it again, and a player who connects during the
 * round is asked. When the GM stops the round (Not now), the player is told once that the GM is waiting a little longer.
 * The window closes itself when the round ends (`promptPlayer`). A GM's browser does nothing here.
 */
export async function renderReadyRound() {
    try {
        if (game.user.isGM) return;
        const record = readyRecord();
        if (record?.id && record.ended === "stop" && record.id === shownFor && toldFor !== record.id) {
            toldFor = record.id;
            ui.notifications.info(game.i18n.localize("DRPG.Ready.cancelled"));
        }
        const round = roundOf(record, getClock());
        if (!round || round.answers?.[game.user.id] === "done") return;
        if (!actingStudents().some(actor => actor.testUserPermission(game.user, "OWNER"))) return;
        if (shownFor === round.id || alreadyOpen(PLAYER_CLASS)) return;
        shownFor = round.id;
        await promptPlayer(round, round.answers?.[game.user.id] === "wait");
    } catch (err) {
        error("Could not open the readiness round's window", err);
    }
}

/**
 * The player's window: what the GM wants to do, Done or One moment ("One moment" the default, so Enter moves nothing
 * on); after One moment the window comes back with the GM's word that they see it and Done alone. Closed, by the window
 * itself, as soon as the round it asks about is no longer open. Only the player's own answer is sent (`ready.answer`).
 */
async function promptPlayer(round, waited) {
    const DialogV2 = foundry.applications.api.DialogV2;
    const still = () => roundOf(readyRecord(), getClock())?.id === round.id;
    const clock = getClock();
    const ask = round.kind === "next" ? game.i18n.localize("DRPG.Ready.askNext")
        : game.i18n.format(round.kind === "eclipseStart" ? "DRPG.Ready.askStart" : "DRPG.Ready.askEnd", { name: esc(eclipseLabel(clock)) });
    const done = { action: "done", label: game.i18n.localize("DRPG.Ready.done") };
    const choice = await DialogV2.wait({
        window: { title: roundTitle(round.kind, clock) },
        classes: ["drpg-panel", PLAYER_CLASS],
        content: dialogContent(`<p>${ask}</p>${waited ? `<p class="notes">${game.i18n.localize("DRPG.Ready.waiting")}</p>` : ""}`),
        buttons: waited ? [{ ...done, default: true }] : [done, { action: "wait", label: game.i18n.localize("DRPG.Ready.wait"), default: true }],
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
    // A GM is never asked (`roundUsers`); the check stands over the ask so a GM's answer can never go down its own socket (R6).
    if (game.user.isGM || (choice !== "done" && choice !== "wait") || !still()) return;
    const { requestReadyAnswer } = await import("./gm-bridge.mjs");
    const res = await requestReadyAnswer({ roundId: round.id, ready: choice === "done" });
    if (choice === "wait" && res.ok && still()) await promptPlayer(round, true);
}

/** The hook: the page ready (the setting's own changes come through sync.mjs). */
export function registerReadyRound() {
    Hooks.once("ready", () => { renderReadyRound(); });
}
