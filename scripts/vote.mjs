/**
 * Danganronpa RPG - the vote, and what it costs.
 * ---------------------------------------------------------------------------
 * THE FAMILY (E41 C10a, 1.2.97). This file keeps the ballots, the rounds, the
 * count and who takes part (`trialParticipants`), and re-exports the twenty
 * names that moved, each by a pure move that `node tools/moved-only.mjs`
 * proves: the trial's record and the sentence to trial-progress.mjs, the
 * ordinary verdict to verdict.mjs. Every importer still imports this file, and
 * neither of those two imports it. New code goes into the file of its role,
 * not here.
 *
 * Guide, pp. 31-32: "Gracze anonimowo głosują na to, kogo uznać za mordercę.
 * Remis jest uznany za porażkę graczy. Wyniki są jawne, ale głosy - nie.
 * Blackened bierze udział w głosowaniu. Można głosować na siebie. Można głosować
 * na Monokumę oraz na martwych graczy." (Checked against the guide on 17.09: the
 * self-vote sentence is "Można", which is what `TRIAL.allowVotingForSelf` says; this
 * quote used to end "Nie można głosować na siebie".)
 *
 * "Wyniki jawne, głosy nie" is the whole design problem, and D6 is why it is a
 * problem: nothing in Foundry's world data is private, so a ballot written to a
 * setting, a flag or a whisper is a ballot anybody can read from the console.
 *
 * So a ballot never enters world data at all. It travels to the GMs on the
 * bridge (`vote.cast`, gm-bridge.mjs; E10 C2, 1.2.71), addressed to them alone -
 * the server delivers those only to the named users - is judged and recorded by
 * the primary GM, and is kept in the GMs' store (gm-stores.mjs `ballotStore`),
 * which lives in the GMs' browsers and is synced between them alone. When the
 * count is published, only the count is published. What the world holds is the
 * vote's state, every part of it shown at the table anyway: open or closed, the round,
 * who was handed a ballot, and after the count the totals and the accused
 * (`trialProgress`; E10 C1, 1.2.71). Until 1.2.71 the ballots were a Map in the
 * collecting GM's memory, and a reload of that browser lost the vote.
 *
 * The consequences are verdict.mjs's, and the guide is blunt
 * about them: getting it right executes the Blackened and levels everybody up.
 * Getting it wrong executes an innocent, leaves the Blackened anonymous and in
 * play with a Reinforced Level Up and a new rule of their choosing, and fills
 * every Monokuma's Despair to maximum. The Reinforced Level Up waits for the class's
 * next one since E05 (level-up.mjs `deferAdvancement`): applied at once, it named them.
 */

import { MODULE_ID, TRIAL, FLAGS } from "./config.mjs";
import { isEclipse, isMutedDead } from "./settings.mjs";
import { studentActors, actingStudents } from "./monokuma.mjs";
import { isDeceased } from "./chapter.mjs";
import { trialBlackenedIds, whenTrialReadable } from "./murder.mjs";
import { ballotStore, verdictStore } from "./gm-stores.mjs";
import { bridgeRequest, sayNotDone } from "./bridge-guards.mjs";
import { judgedFor, flagsHeldNow } from "./sheet-audit.mjs";
import {
    announce, dialogContent, isPrimaryGm, primaryGmId, activeGmIds, log, warn, error, plural, serverNow
} from "./utils.mjs";
import { trialProgress, setTrialProgress, retrySentence } from "./trial-progress.mjs";
export {
    trialProgress, trialProgressChapter, TRIAL_PROGRESS_KEY, setTrialProgress, RECORD_FIELDS, recordPatchOf,
    recordOnPrimary, writeTrialProgressInStep, resetTrialProgress, trialSizeNow, executeAtExit, retrySentence,
    pendingSentence, clearSentence
} from "./trial-progress.mjs";
export {
    openVerdictDialog, applyVerdict, postVerdictCard, verdictStopped, verdictRunner, finishVerdict
} from "./verdict.mjs";

const DialogV2 = foundry.applications.api.DialogV2;
const SOCKET_EVENT = `module.${MODULE_ID}`;

/** GM -> player: a ballot, handed out at the open, a remind and a resend. The answer goes back on the bridge (`vote.cast`). */
const ACTION_OPEN = "vote.open";

/**
 * THE STEPS OF A VOTE, each run on the primary GM (E10 C1, 1.2.71; `runVoteOp`). A window on
 * any GM asks for one through `vote.run` (gm-bridge.mjs), whose sanitize names the same five:
 * "open" and "restart" begin a round, "close" counts it, "remind" hands a ballot to everybody
 * entitled who has not returned one - a player who joined since included - and "resend" to the
 * ones already handed one.
 */
export const VOTE_OPS = Object.freeze(["open", "restart", "remind", "resend", "close"]);

/** What `askVote` tells the GM who asked, by the status the primary answered. */
const VOTE_STATUS = Object.freeze({
    noVoters: "DRPG.Vote.noVoters", nobodyVoted: "DRPG.Vote.nobodyVoted",
    notOpen: "DRPG.Vote.notOpen", movedOn: "DRPG.Vote.movedOn", eclipse: "DRPG.Floor.eclipseFirst"
});

/**
 * ONE STEP AT A TIME ON THE PRIMARY. A step reads the trial's record, then writes it, and the
 * write lands a server round trip later: two GMs pressing Send the ballots at once would each
 * read a closed vote and open the same round twice (read in the code; the harness does not press
 * twice at once). Queued, each step reads the record when its turn comes, after the step before
 * it has written.
 */
let voteTurn = Promise.resolve();

/*
 * THE VOTE THAT WAS OPEN WHEN THIS BROWSER'S WORLD LOADED, as `roundKey` names it, or null: its ballots may be on a GM's
 * browser this one never heard (`ballotCopyStatus`). Marked at `ready` (`registerVote`). Until E10 fix r1-G3 (the
 * round-1 review's cor F2) it was the module's load time, `Date.now()` here, set against the record's `openedAt`,
 * `Date.now()` on the primary - two machines' clocks: a vote a primary whose clock ran an hour behind opened after
 * this browser loaded read as opened before it (the suite's "the vote window says it holds none of the ballots only
 * on a GM that is not the primary and of the vote open when it loaded", red at f9be27d), and a clock ahead missed the
 * warning the other way. A round is the world's and reads the same on every browser; `openedAt` is still written,
 * and nothing reads it since.
 */
let openAtLoad = null;
const roundKey = progress => (progress.vote.open ? `${progress.chapter}:${progress.vote.round}` : null);

/* ==========================================================================
 * RUNNING A VOTE
 * ========================================================================== */

export function registerVote() {
    // A sentence that could not be carried out, asked again when this primary is ready (E70 fix p1-G2; `retrySentence`).
    const retry = () => verdictStore.whenHydrated().then(() => retrySentence()).catch(err => error("Could not carry out a sentence that waited", err));
    Hooks.on("drpgPrimaryReady", retry);
    Hooks.once("ready", () => { if (game.user?.isGM) retry(); });
    // `senderId` is Foundry's own second argument - who actually emitted this. The one
    // packet left on this listener is a GM's, and it is taken from a GM alone.
    game.socket.on(SOCKET_EVENT, (payload, senderId) => {
        if (payload?.action === ACTION_OPEN) return onBallotOpened(payload, senderId);
    });
    /* THE BALLOT REACHES THE GMS ONLY THROUGH THE BRIDGE (E10 C2, 1.2.71; audit S06-12, S06-17).
       Until C2 an answer was a raw packet to every GM (`vote.ballot`), which the primary recorded
       on a candidate filter alone: a ballot naming one student twice counted twice, an earlier
       round's window counted in this one, and the player was told "Your vote is in." as the
       packet left - with no GM connected, of a ballot nobody would ever count. It is the bridge's
       `vote.cast` now (gm-bridge.mjs), judged on the primary (`recordBallot`), and the player is
       told what the primary answered (`sendBallot`). A player who loads while a vote is open - who
       joined after the ballots went out, or reloaded - asks for theirs (`vote.ask`,
       `askForBallot`): at load, and when a primary GM's world has loaded (`drpgPrimaryReady`), as
       the cast, the door and the note are asked for; and an answer kept here for want of a GM goes
       then. One owed to a GM whose world said it had loaded before this browser saw it connect
       waits for `userConnected`, as pre-session-note.mjs's `owedTo` does - which of the two comes
       first on v14 is LIVE-E04-12. */
    if (game.user.isGM) {
        openAtLoad = roundKey(trialProgress());
        return;
    }
    askForBallot();
    Hooks.on("drpgPrimaryReady", primary => askForBallot(primary));
    Hooks.on("userConnected", (user, connected) => {
        if (connected && owedTo && user?.id === owedTo) askForBallot(owedTo);
    });
}

/**
 * A GM has handed this client a ballot: the vote opened, or a remind or a resend reached it.
 *
 * The GM check is the point: without it any player could push a ballot dialog
 * onto everybody else's screen, with a candidate list of their own choosing.
 * The round goes back with the answer, so the primary can tell a window of an
 * earlier round from one of this (E10 C2); no voter is named - the primary finds
 * the voter from who sent the answer.
 */
function onBallotOpened(payload, senderId) {
    if (!game.user || game.user.isGM) return;
    if (!game.users.get(senderId)?.isGM) return;

    castBallot({ round: Number(payload.round) || 0, picks: Number(payload.picks) || 1, candidates: payload.candidates })
        .catch(err => error("Could not open the ballot", err));
}

/**
 * A BALLOT, JUDGED AND RECORDED BY THE PRIMARY GM (E10 C2, 1.2.71; audit S06-12, S06-17): the run of the
 * bridge's `vote.cast` (gm-bridge.mjs `handleBallot`), which reaches the primary alone, from a player alone
 * (`playersOnly`). Answers `{ reply: { round } }` once the row is in the GMs' store, or `{ refused }` with
 * the reason the player is told.
 *
 * Keyed by the SENDER's user id, not by an actor id the packet names. That one
 * line is the whole secret ballot: the tally used to be keyed by whatever actor
 * id the packet claimed, so a single player could emit one ballot per student
 * and decide the entire Class Trial from their own console - replacing everyone
 * else's vote, since a repeat arrival overwrites rather than adds.
 *
 * JUDGED ON WHAT THE PRIMARY HOLDS, NEVER ON THE PACKET (`ballotRefusal`): the round is the world's
 * open round; the sender holds a ballot in it, by `trialParticipants` read as the GMs hold the
 * students; and the names are as many as the vote asks for, none twice, each on the list this side
 * computes for that voter - which is also what holds a ballot to the guide's rules on whom one may
 * name, rather than trusting a client to have offered honest options. Until C2 the names were only
 * filtered: a ballot naming one student twice counted twice, a short one counted half an answer as
 * a whole one, and one drawn in an earlier round counted in this one.
 *
 * IN THE VOTE'S TURN (`voteTurn`), as every step is: a ballot that arrives while the vote is being
 * closed waits for the close and is refused, and one that arrives first is a row before the count
 * reads the store. The waits are outside the turn, as `runVoteOp`'s are. One ballot per voter: a
 * second, before the close, replaces the first - a resend must never double a vote.
 */
export async function recordBallot(sender, round, choice) {
    await ballotStore.whenHydrated();
    await studentsJudged();
    const turn = voteTurn.then(() => {
        const progress = trialProgress();
        const actor = voterActorFor(sender);
        const why = ballotRefusal(progress, actor, round, choice);
        if (why) return { refused: why };
        // The row is in memory when `patch` returns; its write to this browser's storage follows.
        ballotStore.patch(sender.id, {
            chapter: progress.chapter, round: progress.vote.round, actorId: actor.id, choice: [...choice], at: Date.now()
        }).catch(err => error("Could not keep a ballot in the GMs' store", err));
        log(`Ballot received with ${choice.length} name(s) (${roundBallots(progress).length} so far).`);
        // A ballot is not a world document or setting, so nothing that keeps a
        // window live would notice it. The trial console's "still to vote" line is
        // the one thing a GM opens that window to read during a vote.
        //
        // LAST, after the store has the ballot in it: a listener that read
        // `pendingVoters()` first would redraw the same stale list (F8). A hook and
        // not a socket, because `Hooks.callAll` runs on this client only; another
        // GM hears of the row when it merges into their copy (the store's setting's
        // `onChange`, settings.mjs).
        Hooks.callAll("drpgBallotsChanged");
        return { reply: { round: progress.vote.round } };
    });
    voteTurn = turn.catch(() => null);
    return turn;
}

/**
 * Why the primary does not record a ballot, or null (E10 C2): the round, then the voter, then the names. Each
 * reason is one of the bridge's (bridge-guards.mjs `REASON_PATTERNS`), and the player is told it in their language.
 */
function ballotRefusal(progress, actor, round, choice) {
    if (!progress.vote.open || Number(round) !== progress.vote.round) return "the vote has moved on since that ballot was handed out";
    if (!actor) return "the sender holds no ballot in this vote";
    const names = Array.isArray(choice) ? choice : [];
    if (new Set(names).size !== names.length) return "the ballot names somebody twice";
    if (names.length !== progress.vote.picks) return `the ballot names ${names.length}, the vote asks for ${progress.vote.picks}`;
    const listed = new Set(candidatesFor(actor.id).map(c => c.id));
    return names.every(id => listed.has(id)) ? null : "the ballot names somebody who is not on it";
}

/**
 * A PLAYER'S OWN BALLOT, ASKED FOR (E10 C2, 1.2.71; the plan's section 3, "A late joiner"): the run of the
 * bridge's `vote.ask` (gm-bridge.mjs `handleBallotAsk`), on the primary, about the sender alone. Null when no
 * vote is open or the sender holds no ballot in it (`trialParticipants`, as the GMs hold the students); `{ cast:
 * true, round }` when the sender's ballot of this round is in; otherwise the ballot, `{ round, picks,
 * candidates }` - and a sender the vote had not handed one yet, a player who joined after the ballots went out,
 * is added to the record's `issued` first, as a remind adds one: the world's record says who was handed a
 * ballot, and the count's base keeps them should they no longer be entitled at the close (`closeRound` counts
 * the entitled and the answered as well, which is why 63's count reads the same without this write - measured
 * on a mutant, 09.10.2026). One ballot per person, as at the open (D17, S06-55): a player with two students is
 * asked about once. In the vote's turn, so an ask and a step of the vote never write the record over each other.
 */
export async function ballotFor(sender) {
    await ballotStore.whenHydrated();
    await studentsJudged();
    const turn = voteTurn.then(async () => {
        const progress = trialProgress();
        const actor = progress.vote.open ? voterActorFor(sender) : null;
        if (!actor) return null;
        const { round, picks, issued } = progress.vote;
        if (roundBallots(progress).some(([userId]) => userId === sender.id)) return { cast: true, round };
        if (!issued.includes(sender.id)) {
            // A function (E70 C0): the record its step finds, not the one read above, which a step may have moved on.
            await setTrialProgress(now => ({ vote: { ...now.vote, issued: [...now.vote.issued.filter(id => id !== sender.id), sender.id] } }));
            Hooks.callAll("drpgBallotsChanged");
            log(`Handed ${sender.name} a ballot, asked for in round ${round} (${issued.length + 1} issued).`);
        }
        return { round, picks, candidates: candidatesFor(actor.id) };
    });
    voteTurn = turn.catch(() => null);
    return turn;
}

/** Everyone who can be accused, from the perspective of one voter. */
function candidatesFor(voterActorId) {
    const out = studentActors()
        // "Można głosować na siebie" (guide p. 32). The voter used to be filtered
        // out of their own ballot, which quietly forbade the one accusation a
        // cornered Blackened is most likely to make - and is exactly the bluff
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
 *
 * THE ASKER, NOT THE WORK (E10 C1, 1.2.71). The round, the ballots and the card
 * are the primary GM's (`runVoteOp`): this asks for them through `vote.run` and
 * tells the GM who pressed what came of it. Answers how many ballots went out,
 * or null.
 */
/**
 * @param {object} [options]
 * @param {number} [options.picks]  How many names each ballot must carry.
 *   Guide, p. 32: "Jeśli jest dwóch blackened jednej nocy, należy wskazać obu."
 *   A night can produce two Blackened - a role reversal, or a third party who
 *   took the second kill - and then a ballot naming one of them is not an
 *   answer. The GM says how many the night produced; everything downstream
 *   counts names rather than ballots, so the tally needs no special case.
 * @param {boolean} [options.restart]  Start the vote over: a new round, every
 *   ballot handed out again and the ones returned not counted (the vote window's
 *   "Start the vote over", which asks first when any came back).
 */
export async function openVote({ picks = null, restart = false } = {}) {
    const reply = await askVote(restart ? "restart" : "open", picks);
    return reply?.issued ?? null;
}

/**
 * Close the vote and publish the counts - asked of the primary GM, which counts
 * its own copy of the ballots (`closeRound`). Answers the count, or null when
 * there was none to publish.
 */
export async function closeVote() {
    const reply = await askVote("close");
    return reply && !reply.status ? reply : null;
}

/**
 * Hand a fresh ballot to everyone who has not returned one, a player who joined
 * since the vote opened included. Safe to run repeatedly: a resend replaces a
 * ballot rather than adding one, and anybody who has already voted is skipped so
 * their answer cannot be disturbed. Answers how many were sent.
 */
export async function remindVoters() {
    const reply = await askVote("remind");
    return reply?.sent ?? 0;
}

/** A step of the vote asked of the primary GM - run here when this is it - and what came of it told to this GM. */
async function askVote(op, picks = null) {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }
    const asked = { op, picks: Number(picks) || 0 };
    const res = await bridgeRequest("vote.run", asked,
        { settle: "reply", onPrimary: true, local: () => runVoteOp(op, { picks: asked.picks }) });
    if (!res.ok) return null;
    const reply = res.value ?? null;
    if (VOTE_STATUS[reply?.status]) ui.notifications.warn(game.i18n.localize(VOTE_STATUS[reply.status]));
    return reply;
}

/**
 * A STEP OF THE VOTE, RUN ON THE PRIMARY GM (E10 C1, 1.2.71; audit S06-17; the plan's section
 * 3). Until 1.2.71 the GM who pressed opened, counted and forgot the vote in their own memory:
 * every GM heard the ballots and only that one kept them, another GM's console knew of none,
 * and a reload of it lost them (scenario 63's D and E at 1e9871c). Every step is taken here
 * now, on the one browser that records the ballots (`recordBallot`) - asked by `openVote`,
 * `closeVote` and `remindVoters` on any GM through `vote.run` (gm-bridge.mjs, gmOnly), or run
 * in place when the asker is the primary. Answers the step's reply, `{ status }` when it was
 * refused or found nothing to do, or null on a browser that is not the primary's.
 */
export async function runVoteOp(op, { picks = 0 } = {}) {
    if (!game.user.isGM || !isPrimaryGm()) {
        warn(`The vote's "${op}" reached a browser that is not the primary GM's; nothing was done.`);
        return null;
    }
    if (!VOTE_OPS.includes(op)) return null;

    // How many names the night demands, taken from the register rather than
    // from an argument nobody was passing.
    //
    // `openVote()` was called from exactly one place, with no arguments, so
    // `picks` defaulted to 1 every single time and the two-Blackened ballot
    // below - which was written, tested and complete - could not be reached
    // from the interface at all. Now the incidents themselves decide: two
    // murders in a chapter, two names on the ballot.
    //
    // TWO MURDERS THE TABLE KNOWS OF (E05 fix r2-G1, 27.09.2026; review F1). Read whole,
    // the register also counted a killer whose victim nobody had found yet: with one body
    // published and one not, every ballot asked for two names (measured on the harness),
    // which is how each player learnt of the second. A death counts nowhere until it is
    // made known (the owner's Q3) - see `trialBlackenedIds`. Counted once the stores hold the
    // other GMs' rows (fix r2-G2, `whenTrialReadable`), and every step reads the ballots once
    // this browser's copy of them holds the other GMs' rows too (E10 C1), and the students once
    // every write queued on them is judged (E10 C2, `studentsJudged`). The waits are outside
    // the turn: a step waiting for its stores does not hold up a step that is not.
    await whenTrialReadable();
    await ballotStore.whenHydrated();
    await studentsJudged();
    const recorded = trialBlackenedIds().length;
    const turn = voteTurn.then(() => voteStep(op, picksFor(picks, recorded)));
    voteTurn = turn.catch(() => null);
    return turn;
}

/**
 * The step in its turn, judged against the record as it stands now. A step the record has moved
 * past - Send the ballots on a vote that is open, Start the vote over on one that is closed - was
 * pressed in a window drawn before the change, and is refused as "movedOn" and told. The two
 * buttons a window offers either way (Close and count, Remind) find "notOpen" on a closed vote,
 * as Close and count always did. The packet carries no round (`vote.run` takes the step and the
 * picks), so a window drawn over an earlier round of a vote that is open again is not told apart.
 */
async function voteStep(op, picks) {
    /* NO BALLOTS IN AN ECLIPSE (E10 C12, 1.2.71; audit S06-18), as no trial opens in one (trial-floor-ui.mjs
       `startClassTrial`): refused here, on the primary, whichever GM or macro asked, and told to the asker
       (`VOTE_STATUS.eclipse`). Only a step that hands ballots out; a vote already open is counted and
       reminded as before. */
    if ((op === "open" || op === "restart") && isEclipse()) {
        log(`The vote's "${op}" was asked during an Eclipse; nothing was done.`);
        return { status: "eclipse" };
    }
    const progress = trialProgress();
    const { open, round } = progress.vote;
    if (op === "open" ? open : op === "restart" && !open) {
        log(`The vote's "${op}" was asked of a vote that is ${open ? "open" : "closed"} (round ${round}): `
            + "the window that asked is out of date; nothing was done.");
        return { status: "movedOn" };
    }
    if (op === "open" || op === "restart") return openRound(progress, op, picks);
    if (!open) {
        log(`The vote's "${op}" was asked with no vote open; nothing was done.`);
        return { status: "notOpen" };
    }
    return op === "close" ? closeRound(progress) : sendAgain(progress, op);
}

/**
 * How many names the ballots ask for: the GM's number when one was given, else the trial's
 * Blackened in the register - at least one, and never more than there are students to name.
 */
function picksFor(asked, recorded) {
    const wanted = Math.trunc(Number(asked)) > 0 ? Math.trunc(Number(asked)) : recorded;
    return Math.min(Math.max(1, wanted), Math.max(1, studentActors().length));
}

/**
 * A round begins: "open", or "restart" over a running vote. Its number is the last one's plus
 * one, so no ballot of an earlier round - this trial's, or the chapter's first trial's (D17) -
 * can be counted in it: the rows of every other round are dropped here, and the last count is
 * cleared from the record in the same write that opens this one. Until 1.2.71 an open cleared
 * neither `voteClosed` nor `tied`: a vote opened again after a count read as counted until it
 * was counted again.
 */
async function openRound(progress, op, picks) {
    const voters = trialParticipants();
    if (!voters.length) {
        log(`The vote was not ${op === "restart" ? "started over" : "opened"}: `
            + "no player is connected with a student to vote with.");
        return { status: "noVoters" };
    }
    const round = progress.vote.round + 1;
    // Frozen at the moment they go out (CASE-14): a player who drops after the
    // ballots are issued is no longer "eligible", and the count then read
    // "3 of 3" for a room that was told four ballots were out. A remind adds
    // anyone who joins mid-vote; the close counts the union.
    // The vote's FIRST opening in this trial on the server's clock (E70 C3; E70-14): a restart keeps it. The
    // vote's own `openedAt` stays as it was, on the browser's clock: no file of the module reads it (git grep, 27.10).
    await setTrialProgress(now => ({
        vote: { open: true, round, picks, issued: voters.map(({ user }) => user.id),
            openedAt: Date.now(), closedAt: null },
        voteClosed: false, tied: false, majority: 0, noMajority: false, accused: [], total: 0, accusedIds: [],
        voteOpenedAt: now.voteOpenedAt ?? serverNow()
    }));
    // THE VOTE ENDS THE CLOSING ARGUMENT (E70 C8; E70-56): a Closing still on the floor, or in its exchange, is over.
    try {
        const { endClosingForVote } = await import("./trial-modes.mjs");
        await endClosingForVote();
    } catch (err) {
        error("Could not end the Closing Argument as the vote opened", err);
    }
    const older = Object.entries(ballotStore.entries())
        .filter(([, row]) => row?.chapter !== progress.chapter || row?.round !== round)
        .map(([userId]) => userId);
    if (older.length) await ballotStore.dropMany(older);

    sendBallots(voters, picks, round);
    // After the emit, so a send that threw for one player is still reported as a
    // vote that is now running - and before the card, so the console is true by
    // the time it lands (F8).
    Hooks.callAll("drpgBallotsChanged");

    /* NO FLAG ON THE CARD SAYS THE VOTE IS OPEN (E10 C1; the census's F6). It carried
       `voteOpen` and the chapter from 1.2.47, and the Event panel read "a vote is open" off
       any message so flagged - a chat message any client can create, flags and all. The
       record written above says it now (events.mjs `voteIsOpen`). */
    await announce({
        flags: { [MODULE_ID]: { sfx: { key: "voteOpen", gm: true } } },
        content: `<div class="drpg-evidence-card">
            <div class="drpg-objection-banner">${game.i18n.localize("DRPG.Vote.banner")}</div>
            <p>${plural("DRPG.Vote.opened", { n: voters.length })}</p>
        </div>`
    });

    log(`Vote ${op === "restart" ? "started over" : "opened"}: round ${round}, ${voters.length} player(s), `
        + `${picks} name(s) on each ballot.`);
    return { issued: voters.length, round };
}

/**
 * "remind": a ballot to everybody entitled who has not returned one this round, a player who
 * joined since included - added to the record's `issued`, so the majority's base grows with
 * them, as the close's union already counted them. "resend": the same, to the ones handed one.
 */
async function sendAgain(progress, op) {
    const back = new Set(roundBallots(progress).map(([userId]) => userId));
    const handed = new Set(progress.vote.issued);
    const voters = trialParticipants()
        .filter(({ user }) => !back.has(user.id) && (op === "remind" || handed.has(user.id)));
    const joined = voters.map(({ user }) => user.id).filter(userId => !handed.has(userId));
    if (joined.length) {
        await setTrialProgress(now => ({ vote: { ...now.vote, issued: [...now.vote.issued.filter(id => !joined.includes(id)), ...joined] } }));
    }
    if (!voters.length) return { sent: 0 };

    sendBallots(voters, progress.vote.picks, progress.vote.round);
    Hooks.callAll("drpgBallotsChanged");
    log(`Sent a fresh ballot to ${voters.length} player(s) in round ${progress.vote.round}.`);
    return { sent: voters.length };
}

/**
 * The ballot, to each voter's browser alone, with the round it is of - which comes back with the answer
 * (`recordBallot`). Until E10 C2 it named the voter's student, which nothing read: the primary finds the
 * voter from who sent the answer.
 */
function sendBallots(voters, picks, round) {
    for (const { user, actor } of voters) {
        try {
            game.socket.emit(SOCKET_EVENT, {
                action: ACTION_OPEN,
                round,
                picks,
                candidates: candidatesFor(actor.id)
            }, { recipients: [user.id] });
        } catch (err) {
            error(`Could not send a ballot to ${user.name}`, err);
        }
    }
}

/**
 * Everybody entitled to a ballot: one each, and none for the dead.
 *
 * TWO RULES, AND A WHOLE CHAPTER RUN END TO END FOUND BOTH (11.09).
 *
 * ONE PER PERSON, NOT ONE PER STUDENT. The tally is keyed by the SENDER - it has to be,
 * see `recordBallot` - so a user holding two students was handed two ballot windows and
 * exactly one of them could ever count. Measured: three players at the table, "4 ballots
 * are out" announced to the room, one player returned two and the second silently replaced
 * the first. `pendingVoters` filters by user as well, so that player also vanished off the
 * "still to vote" list the moment they answered either window.
 *
 * AND THE DEAD DO NOT VOTE. `studentActors()` is everyone who ever enrolled, so the victim
 * of the very murder being tried was sent a ballot - which at one player to one character
 * means the murdered player votes in the trial about their own death. Voting FOR the dead
 * stays exactly as it was (`allowVotingForDead`, guide p. 32); this is the other half of
 * the sentence, and `TRIAL.deadCastBallots` is where to change your mind about it.
 *
 * DEAD AS THE GMS HOLD THEM (E10 C2, 1.2.71; the plan's 1b.2). The death was read off the
 * document, which the student's owner can write: a dead student's owner who wiped the flag
 * from their console was handed a ballot, and the put-back the GMs' audit sends lands a server
 * round trip later, or never where it fails. It is read as the primary holds it now
 * (sheet-audit.mjs `flagsHeldNow`), after every write queued on a student is judged
 * (`studentsJudged`, which every road deciding who votes waits for first: a step of the vote,
 * a cast and an ask) - on another GM's browser, which holds no mark of its own, the document's,
 * as before.
 */
export function trialParticipants({ connected = true } = {}) {
    const out = [];
    const seated = new Set();
    // THE ONE CAST (E37 C2, 01.11.2026; S10-45, E37-08, the plan's amend of 27.10: "not a second list"): monokuma.mjs
    // `actingStudents`, handed the trial's rule of the dead, and filtered again below by the flags as the GMs hold them,
    // so the ballots go where they went when this walked `studentActors()` (R1193).
    const outOfTrial = actor => !TRIAL.deadCastBallots && (isDeceased(flagsHeldNow(actor)) || isMutedDead(actor));
    for (const actor of actingStudents({ dead: outOfTrial })) {
        // WHO TAKES PART (E70 C5, S18-79's list; TR33 = 1): no Monocub (DC4: it speaks only in the discussion and holds no
        // ballot), and nobody on the trial's list of the dead (settings.mjs `isMutedDead`) - a death nobody has found
        // among them, which the flag does not show and the primary lists after its deaths store has hydrated (TR30).
        // The Monocub's flag as the GMs hold it too (E70 fix p1-G1; the review's SEC-2): a dead player's console that set
        // it on a living student of theirs took that student's ballot away until the audit's put-back landed.
        const held = flagsHeldNow(actor);
        if (held.getFlag(MODULE_ID, FLAGS.monocub)) continue;
        if (!TRIAL.deadCastBallots && (isDeceased(held) || isMutedDead(actor))) continue;
        // `connected` false (E70 fix p2-G4): the student's player whether or not they are connected now - the copies a
        // Reveal or a Present hands out, which a player reloading at that moment must still get.
        const user = game.users.find(u => !u.isGM && (u.active || !connected) && actor.testUserPermission(u, "OWNER"));
        if (!user || seated.has(user.id)) continue;
        seated.add(user.id);
        out.push({ user, actor });
    }
    return out;
}

/**
 * Every write queued on a student judged (sheet-audit.mjs `judgedFor`; E10 C2): waited for once, outside
 * the vote's turn, by every road that decides who holds a ballot, so `trialParticipants` then reads each
 * student as the GMs hold it in one synchronous pass.
 */
function studentsJudged() {
    return judgedFor(...studentActors().map(actor => actor.id));
}

/**
 * Which of a person's students is the one holding their ballot.
 *
 * Read from `trialParticipants` rather than worked out again, so the step that hands the
 * ballots out and the cast that records one cannot disagree about who it belongs to -
 * which is what decides whose candidate list the answer is checked against.
 */
function voterActorFor(user) {
    return trialParticipants().find(v => v.user.id === user.id)?.actor ?? null;
}

/** How many ballots of the open vote this browser holds, or null when no vote is open. GM only. */
export function votesIn() {
    if (!game.user.isGM) return null;
    const progress = trialProgress();
    if (!progress.vote.open) return null;
    return roundBallots(progress).length;
}

/**
 * Who is still outstanding, by name.
 *
 * A vote is closed on a human's judgement of "everyone has voted", and until
 * this existed that judgement had nothing to go on - the counts only appear
 * after closing, and closing is irreversible. A player who dismissed the dialog
 * by accident was simply not counted, and nobody could tell.
 *
 * Names only: WHO has voted is not the same as HOW they voted, and the second is
 * the thing the guide keeps secret. Read from the world's round and this
 * browser's copy of the GMs' store (E10 C1): another GM's console names the same
 * people once the primary's rows have merged into it.
 */
export function pendingVoters() {
    if (!game.user.isGM) return null;
    const progress = trialProgress();
    if (!progress.vote.open) return null;
    const back = new Set(roundBallots(progress).map(([userId]) => userId));
    return trialParticipants()
        .filter(({ user }) => !back.has(user.id))
        .map(({ user, actor }) => ({ user, actor, name: actor.name }));
}

/**
 * Who Send the ballots would hand one to now, by name (E10 C14, 1.2.71; audit S06-26): the vote window
 * lists them before the button is pressed, and says that nobody is connected when nobody is. The same
 * reading as the step's own (`trialParticipants`), as this GM holds it at the moment - a display: the step
 * reads it again on the primary, after every write queued on a student is judged. GM only.
 */
export function ballotRecipients() {
    if (!game.user.isGM) return [];
    return trialParticipants().map(({ user, actor }) => ({ user, actor, name: actor.name }));
}

/**
 * THE BAR, WHILE THE VOTE IS OPEN (E10 C3, 1.2.71; the plan's C3): `{ returned, issued, majority }` - the
 * ballots back, out of the base the close will count from (`ballotBase`), and the votes a conviction needs
 * of that base - or null with no vote open, as on a player's browser. A player who joins mid-vote and is
 * handed a ballot raises `issued`, and with it the bar: the vote window and the trial console print this
 * (`DRPG.Vote.barLine`) and are redrawn on `drpgBallotsChanged` and on the world's record, so the bar a
 * GM reads before Close and count is the one the count will use. Read from this browser's copy of the
 * ballots, as `votesIn` is.
 */
export function voteBar() {
    if (!game.user.isGM) return null;
    const progress = trialProgress();
    if (!progress.vote.open) return null;
    const cast = roundBallots(progress);
    const issued = ballotBase(progress.vote, cast);
    return { returned: cast.length, issued, majority: majorityOf(issued) };
}

/**
 * How many ballots WENT OUT, which is what a count is out of: everybody handed one at the open, by a remind
 * or on asking (`vote.issued`), everybody entitled now, and everybody who answered - the union the count
 * made of its Map, the recipients it froze and the voters it could still see before 1.2.71. Silence is not
 * agreement (D6): a base of the ballots returned would call four of five a landslide in a room of sixteen.
 */
function ballotBase(vote, cast) {
    return new Set([...vote.issued, ...trialParticipants().map(({ user }) => user.id),
        ...cast.map(([userId]) => userId)]).size;
}

/** More than half the ballots that went out (D6): the votes a conviction needs. */
function majorityOf(issued) {
    return Math.floor(issued / 2) + 1;
}

/**
 * The ballots of the world's vote in this browser's copy of the GMs' store, `[userId, row]`, of
 * the record's chapter and round only (E10 C1): a row of an earlier round, or of another
 * chapter's trial, is not this vote's, and nothing that counts or lists reads it.
 */
function roundBallots(progress) {
    return Object.entries(ballotStore.entries()).filter(([, row]) => row?.chapter === progress.chapter
        && row?.round === progress.vote.round && Array.isArray(row?.choice));
}

/**
 * What the vote window says of this browser's copy of the ballots (E10 C1; the plan's section
 * 3): "notReady" until the GMs' store holds the other GMs' rows; "none" on a GM that is not the
 * primary when it holds no ballot of the vote that was already open when it loaded - its ballots
 * may be on another GM's browser, on none, or not cast yet, and this browser cannot tell which;
 * otherwise null, as on a player's browser and with no vote open. Not "none" on the primary
 * (E10 fix r1-G3; cor F2): the ballots are recorded there (`recordBallot`), so none there is
 * none cast yet, and the window's "wait for the primary GM" was the primary told to wait for
 * itself. A primary that took over from a GM who left with the only copy names every voter as
 * still out instead (read in the code; no scenario plays it).
 */
export function ballotCopyStatus() {
    if (!game.user.isGM) return null;
    const progress = trialProgress();
    if (!progress.vote.open) return null;
    if (!ballotStore.isHydrated()) return "notReady";
    if (!roundBallots(progress).length && !isPrimaryGm() && roundKey(progress) === openAtLoad) return "none";
    return null;
}

/**
 * THE MARK, STOOD IN FOR BY THE SUITE (E10 fix r1-G3). A test runs in a browser that loaded
 * before the test opened its vote, so `openAtLoad` reads as the vote `progress` holds until the
 * function answered is called, which puts the live mark back.
 */
export function standInOpenAtLoad(progress) {
    const live = openAtLoad;
    openAtLoad = roundKey(progress);
    return () => { openAtLoad = live; };
}

/* ==========================================================================
 * A PLAYER'S BALLOT (E10 C2, 1.2.71; audit S06-17)
 * --------------------------------------------------------------------------
 * The window, the answer sent on the bridge (`vote.cast`), and one thing said of
 * it: "Your vote is in." once the primary GM has recorded it, the reason when it
 * refused it, and that it is kept here when no GM could take it - and a kept answer
 * goes again when a primary GM's world has loaded (`askForBallot`). Until C2 the
 * player was told the vote was in as the packet left, GM or none. All of it is this
 * browser's memory: a reload forgets a kept answer, and the ask at load hands the
 * ballot back while its round is open (`ballotFor`).
 * ========================================================================== */

/** The ballot windows this browser has drawn: a newer one closes the one before, whose answer is then nobody's. */
let ballotWindows = 0;
/** The round of the ballot window open here, or null: a player holding one is not handed another by an ask. */
let drawnRound = null;
/** An answer no primary GM has recorded yet, `{ round, choice }`, and whether it is on its way now. */
let unsent = null;
let sending = false;
/** The round of the last ballot the primary recorded from this browser, so an ask's answer does not say it twice. */
let confirmedRound = null;

/**
 * THE VOTE'S TRACE (E51 C4, 31.10.2026; E51-27, audit S13-33). "Your vote is in." was a toast, and the Events panel went
 * on calling the player to vote until the count. `noteBallotIn` is the one write of `confirmedRound`, made when the
 * primary has said it holds this browser's ballot of `round` (`sendBallot`, `askBallot`), and it draws the panel again;
 * events.mjs `trialCard` asks `ballotInHere`, which is true only while the vote open in the world is that round - a
 * vote reopened is a new round and calls to vote again. This browser's memory, as the rest of the ballot's: a reload
 * forgets it until the ask at load hears the ballot is in. Exported for the suite (E51-T11), with `ballotInRound`.
 */
export function noteBallotIn(round) {
    confirmedRound = round ?? null;
    import("./events.mjs").then(m => m.renderEvents()).catch(() => {});
}

/** The round `noteBallotIn` last noted, or null. */
export function ballotInRound() {
    return confirmedRound;
}

/** Whether the primary holds this browser's ballot of the vote open now (`noteBallotIn`). */
export function ballotInHere(progress = trialProgress()) {
    return confirmedRound !== null && Boolean(progress?.vote?.open) && Number(progress.vote.round) === Number(confirmedRound);
}
/** A primary GM whose world said it had loaded before this browser saw it connect (pre-session-note.mjs `owedTo`). */
let owedTo = null;

/** The ballot itself, on a player's screen; the answer goes to the primary GM (`sendBallot`). */
async function castBallot({ round = 0, picks = 1, candidates = [] } = {}) {
    if (!Array.isArray(candidates) || !candidates.length) return;
    const wanted = Math.max(1, Math.trunc(Number(picks)) || 1);

    /* THE BALLOT IS A LIST OF PEOPLE, NOT A DROP-DOWN.
       It was one `select` per pick, which is the one control in this module that hides its
       own options: the names of everyone you could accuse were behind a click, and the
       accusation is the single most consequential thing a player does all game. The audit
       page draws it as choice rows, the shape this module already uses wherever an answer
       matters (`.drpg-choice`, in use-items, rest and the action rolls), and rows have
       another property a drop-down does not: nothing is chosen until somebody chooses it.
       No row is checked here on purpose - a pre-selected ballot is a vote nobody cast. */
    const rows = i => candidates.map(c => `
                <label class="drpg-choice">
                    <input type="radio" name="choice${i}" value="${c.id}">
                    <span class="drpg-choice-text">
                        <strong>${foundry.utils.escapeHTML(c.name)}</strong>
                        ${c.dead ? `<small>${game.i18n.localize("DRPG.Chapter.deadShort")}</small>` : ""}
                    </span>
                </label>`).join("");

    // One list per name the night demands. Two Blackened means two answers,
    // and the guide is explicit that half an answer is not one.
    const fields = Array.from({ length: wanted }, (_, i) => `
            <fieldset class="drpg-ballot">
                <legend>${wanted > 1
                    ? game.i18n.format("DRPG.Vote.whoNth", { n: i + 1 })
                    : game.i18n.localize("DRPG.Vote.who")}</legend>
                <div class="drpg-choice-list">${rows(i)}</div>
            </fieldset>`).join("");

    // One ballot window at a time (CASE-14): a Remind that reached a player
    // whose first window was still open stacked a second, and either counted.
    // Counted before the close, so the window closed here goes without a word (below).
    const drawn = ++ballotWindows;
    for (const app of foundry.applications?.instances?.values?.() ?? []) {
        if (app.rendered && app.options?.classes?.includes("drpg-ballot")) app.close();
    }

    drawnRound = round;
    let choice = null;
    try {
        choice = await DialogV2.wait({
            window: { title: game.i18n.localize("DRPG.Vote.ballotTitle") },
            classes: ["drpg-panel", "drpg-ballot"],
            content: dialogContent(`<form>
                <p>${game.i18n.localize("DRPG.Vote.ballotIntro")}</p>
                ${wanted > 1 ? `<p class="drpg-warning">${
                    game.i18n.format("DRPG.Vote.twoBlackened", { n: wanted })}</p>` : ""}
                ${fields}
                <p class="notes">${game.i18n.localize("DRPG.Vote.ballotNote")}</p>
            </form>`),
            render: (event, dialog) => wireBallot(dialog?.element, wanted),
            buttons: [
                {
                    action: "ok", label: game.i18n.localize("DRPG.Vote.cast"), default: true,
                    // `:checked`, because a list of radios has no value of its own - and an
                    // unanswered ballot must come back short rather than come back with the
                    // first name on it, which the primary refuses (`ballotRefusal`).
                    callback: (e, b, d) => Array.from({ length: wanted }, (_, i) =>
                        d.element.querySelector(`input[name="choice${i}"]:checked`)?.value).filter(Boolean)
                }
            ],
            rejectClose: false
        });
    } finally {
        if (drawn === ballotWindows) drawnRound = null;
    }
    // Closed by a newer ballot - a remind, a resend, the vote started over - which is the one to answer.
    if (drawn !== ballotWindows) return;

    // Dismissed rather than answered. Silence used to be the end of it - the
    // ballot was gone and there was no way to ask for another - so a misclick
    // disenfranchised somebody in the one vote the whole game turns on. Now it
    // says so, and the GM's own screen lists who is still outstanding.
    if (!choice || choice === "ok" || !choice.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Vote.dismissed"));
        return;
    }
    unsent = { round, choice };
    await sendBallot();
}

/**
 * The ballot's window, wired (E10 C2): Cast waits until every list has a name, and a name checked in
 * one list cannot be checked in another. The primary refuses a ballot naming somebody twice or short
 * of a name anyway (`ballotRefusal`); this keeps an honest player from sending one. Nothing here
 * decides: a window that never rendered sends what was checked, and the primary judges it.
 */
function wireBallot(root, picks) {
    if (!root) return;
    const cast = root.querySelector('button[data-action="ok"]');
    const lists = Array.from({ length: picks }, (_, i) => [...root.querySelectorAll(`input[name="choice${i}"]`)]);
    const sync = () => {
        const taken = lists.map(list => list.find(input => input.checked)?.value ?? null);
        lists.forEach((list, i) => {
            for (const input of list) input.disabled = !input.checked && taken.some((value, j) => j !== i && value === input.value);
        });
        if (cast) cast.disabled = taken.includes(null);
    };
    root.addEventListener("change", sync);
    sync();
}

/**
 * Player: the answer given here, to the primary GM (`vote.cast`), and what came of it said once: "Your
 * vote is in." when the primary has recorded it; the reason when it refused it ("The vote has moved
 * on" for a window of an earlier round); and that it is kept here when no GM could take it - none
 * connected, or none answered in time. Kept, it goes again when a primary GM's world has loaded
 * (`askForBallot`); one sent to a GM who left before answering is sent again by the bridge itself on
 * the next primary's arrival (`resend`). One at a time: an answer given while the one before is on its
 * way goes once that one is answered, and what came of the older one is not said.
 */
async function sendBallot() {
    // No GM gets here (`onBallotOpened` and `askForBallot` return on one); the check stands over the
    // request because R6 reads it there - a GM's request with no `local` is lost on the socket.
    if (game.user.isGM || !unsent || sending) return;
    const ballot = unsent;
    sending = true;
    try {
        const { requestBallotCast } = await import("./gm-bridge.mjs");
        const res = await requestBallotCast(ballot.round, ballot.choice);
        if (unsent === ballot) {
            if (res.ok) {
                unsent = null;
                noteBallotIn(ballot.round);
                ui.notifications.info(game.i18n.localize("DRPG.Vote.castConfirmed"));
            } else if (res.refused) {
                unsent = null;
                // The vote's own words for a window of an earlier round; the bridge's for the rest.
                if (res.reason === "movedOn") ui.notifications.warn(game.i18n.localize("DRPG.Vote.movedOn"));
                else sayNotDone("vote.cast", res.reason);
            } else {
                ui.notifications.warn(game.i18n.localize("DRPG.Vote.notReceived"));
            }
        }
    } finally {
        sending = false;
    }
    if (unsent && unsent !== ballot) await sendBallot();
}

/**
 * Player: what this browser owes a vote, asked of a primary GM (E10 C2) - at load, and when a primary
 * GM's world has loaded (`registerVote`). An answer kept here goes to it (`sendBallot`); otherwise, while
 * a vote is open and no ballot window is open here, the primary is asked for this player's own ballot
 * (`vote.ask`, `askBallot`). With no GM this browser has seen connect, it waits for `primary` to.
 */
export function askForBallot(primary = primaryGmId()) {
    if (game.user.isGM || sending) return;
    if (!unsent && (drawnRound !== null || !trialProgress().vote.open)) return;
    if (!activeGmIds().length) {
        owedTo = primary;
        return;
    }
    owedTo = null;
    if (unsent) sendBallot().catch(err => error("Could not send the ballot", err));
    else askBallot().catch(err => error("Could not ask the GM for a ballot", err));
}

/**
 * Player: this player's own ballot, from the primary (`ballotFor`): drawn when it is one, "Your vote is
 * already in." when the primary holds this player's ballot of the round - said once a round, and not
 * after "Your vote is in." - and nothing when the vote holds no ballot for them. Asked quietly: a
 * refusal or a GM who does not answer is the GM's log alone, and the next primary's arrival asks again.
 */
async function askBallot() {
    if (game.user.isGM) return; // as in `sendBallot` (R6)
    const { requestBallot } = await import("./gm-bridge.mjs");
    const res = await requestBallot();
    const reply = res.ok ? res.value : null;
    // A window drawn or an answer given while the question travelled is newer than its answer.
    if (!reply || drawnRound !== null || unsent) return;
    const round = Number(reply.round) || 0;
    if (reply.cast) {
        if (round !== confirmedRound) ui.notifications.info(game.i18n.localize("DRPG.Vote.alreadyIn"));
        noteBallotIn(round);
        return;
    }
    await castBallot({ round, picks: Number(reply.picks) || 1, candidates: reply.candidates });
}

/**
 * THE COUNT, AND NOTHING ELSE (E10 C3, 1.2.71; audit S06-12, S06-10): the ballots' rows (`{ choice: [id] }`,
 * the store's) counted for a vote asking for `wanted` names out of `issued` ballots. Pure - it reads no
 * world and no store - so the rule below is tested on its own (R314) and `closeRound` is its one caller.
 * Returns `counts` (`[{ id, n }]`, most votes first), `accused` (the names at or above the `wanted`-th
 * count), `majority`, `noMajority`, `tied` and `accusedIds` (empty unless the room settled).
 *
 * A CONVICTION NEEDS MORE THAN HALF THE ROOM (D6). The class used to convict on a plurality: whoever led
 * the count was the answer, however thin the lead. Measured over a season that made the trial almost
 * unloseable - nine wrong votes scattered across seven names still left the real killer on top with four,
 * and four out of sixteen decided a life. So a name has to carry the ROOM, out of the ballots issued and
 * not returned: silence is not agreement. Short of that the accusation fails and the class fails with it.
 *
 * FOR EVERY NAME THE VOTE ASKS FOR (E10 C3). Until 1.2.71 the majority was asked of the top name alone, so
 * on a two-Blackened night the second name was accused with whatever it had - 2 of 6 ballots beside a
 * first name's 4 (audit S06-12) - and a ballot naming one person for two Blackened passed as a whole
 * answer, against "half an answer is not one". Now each of the first `wanted` names needs the majority,
 * and fewer names than asked for is no majority either.
 *
 * A TIE AT THE LINE: more names clear the cut than there are Blackened to name - one Blackened and two
 * people level on votes is the old tie exactly. FOLDED INTO `tied` WITH THE MISSING MAJORITY, which is
 * G-31 widened rather than a second concept (D6): both are the room not settling on an answer and both
 * end the same way, so everything downstream that knows what to do with a tie needs no second branch.
 * `noMajority` stays apart for the words: the card says "no majority" for it and "a tie" only for names
 * level above the bar (S06-10: it said "A tie." for 3 of 7 on one name).
 */
export function countBallots(rows, { wanted = 1, issued = 0 } = {}) {
    const tally = new Map();
    for (const row of rows ?? []) {
        // Every name on the ballot counts. A two-Blackened night puts two names
        // on each, and both of them are the voter's answer.
        for (const id of Array.isArray(row?.choice) ? row.choice : []) {
            if (!id) continue;
            tally.set(id, (tally.get(id) ?? 0) + 1);
        }
    }
    const counts = Array.from(tally.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([id, n]) => ({ id, n }));
    const want = Math.max(1, Math.trunc(Number(wanted)) || 1);
    const cut = counts[want - 1]?.n ?? 0;
    const accused = counts.filter(r => r.n >= cut && r.n > 0);
    const majority = majorityOf(issued);
    const noMajority = accused.slice(0, want).some(r => r.n < majority) || accused.length < want;
    const tied = accused.length > want || noMajority;
    return { counts, accused, majority, noMajority, tied, accusedIds: tied ? [] : accused.map(r => r.id) };
}

/**
 * The count, on the primary's own copy of the ballots (E10 C1). The counts, and
 * only the counts: the rows stay in the GMs' store until the next round opens or
 * the trial's reset cuts them, and nothing of who voted how reaches the world or
 * the card.
 */
async function closeRound(progress) {
    // CLOSED FIRST, THEN COUNTED. A ballot is recorded in the vote's turn since
    // E10 C2 (`recordBallot`): one that arrived before this step is a row before
    // the count reads the store, and one that arrives during it waits for it and
    // finds the vote closed - refused, never recorded after the count was read.
    const vote = { ...progress.vote, open: false, closedAt: Date.now() };
    // The vote as its step finds it, closed (E70 C0); `vote` above is what the count below reads, as before.
    await setTrialProgress(now => ({ vote: { ...now.vote, open: false, closedAt: vote.closedAt } }));
    // ABOVE the nobody-answered return: a hook placed after it would leave the
    // console printing a list of voters for a vote that no longer exists (F8).
    Hooks.callAll("drpgBallotsChanged");

    const cast = roundBallots(progress);
    // Out of how many ballots WENT OUT, not how many came back (`ballotBase`).
    //
    // The denominator used to be the votes cast, so one vote out of three
    // issued printed as "1 of 1 votes", which reads as a unanimous table rather
    // than as two people who never answered. Whether the accusation carries the
    // room is the whole question the card is trying to settle.
    const returned = cast.length;
    const issued = ballotBase(vote, cast);
    const silent = issued - returned;

    const named = id => id === "monokuma"
        ? game.i18n.localize("DRPG.Vote.monokuma")
        : (game.actors.get(id)?.name ?? "?");

    // As many names as the night asked for. A two-Blackened vote whose card
    // announces one accusation has answered half the question and said so as
    // though it were the whole answer.
    const wanted = Math.max(1, vote.picks);
    const { counts, accused, majority, noMajority, tied, accusedIds } =
        countBallots(cast.map(([, row]) => row), { wanted, issued });
    const rows = counts.map(({ id, n }) => ({ id, name: named(id), n }));

    // THE COUNT IN ONE WRITE (G-31; E10 C1). The verdict window needs it, and by
    // the time it opens the tally has scrolled away: every name's votes, out of
    // how many, who is accused and whether the room settled. A close with no
    // ballot writes it too: the vote is over and nobody was accused, so the
    // verdict opens on "wrong" as after a tie. Until 1.2.71 that close returned
    // before writing anything, and the console went on offering the vote.
    await setTrialProgress({
        voteClosed: true, accused: counts, total: issued,
        accusedIds, tied, majority, noMajority
    });

    if (!returned) {
        log(`Vote closed in round ${vote.round} with none of ${issued} ballot(s) returned.`);
        return { status: "nobodyVoted" };
    }

    /* A ROW PER NAME AND ONE SENTENCE (E10 C3, 1.2.71; audit S06-32, S06-10). The card was a
       `drpg-vault-table` - the Vault's, which falls apart in a narrow chat tile - and printed the
       same number three times (the row, "needs 3 of 4", "Botan - 3 of 4 votes") without saying
       whether the room had convicted anybody; a vote short of a majority read "A tie." though
       nobody was level. Now: each name, its votes and a bar of the ballots that went out with the
       majority marked on it, then the one sentence - the class accuses, no majority, or a tie
       among names that each carried the room (`countBallots`). The bar is drawn, not read: it is
       hidden from a screen reader, which has the count beside it. */
    const share = n => Math.round(100 * n / Math.max(1, issued));
    const esc = foundry.utils.escapeHTML;
    // The two that count ballots are plural families on {total} (E66 C3, the census); the one-name line is a ratio.
    const accusing = { names: accused.map(r => esc(named(r.id))).join(", "), n: Math.min(...accused.map(r => r.n)), total: issued };
    const sentence = noMajority
        ? plural("DRPG.Vote.noMajority", { majority, total: issued }, "total")
        : tied
            ? game.i18n.localize("DRPG.Vote.tied")
            : accused.length > 1
                ? plural("DRPG.Vote.accusesLineMany", accusing, "total")
                : game.i18n.format("DRPG.Vote.accusesLine", accusing);
    await announce({
        flags: { [MODULE_ID]: { sfx: { key: "verdict", gm: true } } },
        content: `<div class="drpg-evidence-card">
            <div class="drpg-objection-banner">${game.i18n.localize("DRPG.Vote.resultBanner")}</div>
            <div class="drpg-vote-count">${rows.map(r => `<div class="drpg-vote-row">
                <span class="drpg-vote-name">${esc(r.name)}</span>
                <span class="drpg-vote-n">${r.n}</span>
                <span class="drpg-vote-bar" aria-hidden="true"><span style="width: ${share(r.n)}%"></span><i style="left: ${share(majority)}%"></i></span>
            </div>`).join("")}</div>
            <p class="drpg-vote-sentence">${sentence}</p>
            ${silent ? `<p class="notes">${
                plural("DRPG.Vote.silent", { n: silent })}</p>` : ""}
        </div>`
    });

    log(`Vote closed: ${returned} of ${issued} ballot(s) returned, ${noMajority ? "no majority"
        : tied ? "tied" : `${accused.map(r => named(r.id)).join(", ")} accused`}.`);
    return { rows, total: issued, tied, accusedId: tied ? null : rows[0]?.id ?? null, accusedIds };
}
