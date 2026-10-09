/**
 * Danganronpa RPG - the vote, and what it costs.
 * ---------------------------------------------------------------------------
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
 * The consequences are the other half of this file, and the guide is blunt
 * about them: getting it right executes the Blackened and levels everybody up.
 * Getting it wrong executes an innocent, leaves the Blackened anonymous and in
 * play with a Reinforced Level Up and a new rule of their choosing, and fills
 * every Monokuma's Despair to maximum. The Reinforced Level Up waits for the class's
 * next one since E05 (level-up.mjs `deferAdvancement`): applied at once, it named them.
 */

import { MODULE_ID, TRIAL } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { getClock } from "./clock.mjs";
import { studentActors } from "./monokuma.mjs";
import { monokumas, fillAllDespair, poolLabel } from "./despair.mjs";
import { isDeceased, isDeadForGm, livingStudents, killCharacter } from "./chapter.mjs";
import { trialBlackenedIds, trialBlackenedActors, whenTrialReadable } from "./murder.mjs";
import { ballotStore } from "./gm-stores.mjs";
import { bridgeRequest, sayNotDone } from "./bridge-guards.mjs";
import { judgedFor, flagsHeldNow } from "./sheet-audit.mjs";
import { announce, dialogContent, whisperToGms, isPrimaryGm, primaryGmId, activeGmIds, log, warn, error, plural } from "./utils.mjs";

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
    notOpen: "DRPG.Vote.notOpen", movedOn: "DRPG.Vote.movedOn"
});

/**
 * ONE STEP AT A TIME ON THE PRIMARY. A step reads the trial's record, then writes it, and the
 * write lands a server round trip later: two GMs pressing Send the ballots at once would each
 * read a closed vote and open the same round twice (read in the code; the harness does not press
 * twice at once). Queued, each step reads the record when its turn comes, after the step before
 * it has written.
 */
let voteTurn = Promise.resolve();

/** When this browser loaded the module: a vote opened before then may have ballots it never held (`ballotCopyStatus`). */
const LOADED_AT = Date.now();

/** A vote nobody has opened in this trial: the blank of `trialProgress().vote`. */
const blankVote = () => ({ open: false, round: 0, picks: 1, issued: [], openedAt: null, closedAt: null });
/* ==========================================================================
 * HOW FAR THROUGH THE TRIAL THE TABLE HAS GOT
 * --------------------------------------------------------------------------
 * Three of the trial's steps only make sense in order - you cannot deliver a
 * verdict on a vote nobody has counted, and the chapter does not end before the
 * verdict is applied - and until now nothing anywhere knew which of them had
 * happened. The GM's console offered all three at once, and the destructive one
 * (a verdict executes people and hands out level-ups) was as pressable on an
 * empty trial as on a finished one.
 *
 * The two writers are both in this file, which is why the record lives here
 * rather than with the floor: `runVoteOp`, on the primary GM, is the only thing
 * that opens a vote or produces a count, and `applyVerdict` the only thing that
 * acts on one.
 * ========================================================================== */

/** What has happened in THIS chapter's trial. Never throws; never null. */
export function trialProgress() {
    const chapter = getClock().chapter;
    /* `keysCharged` IS IN THE BLANK because it is in the record. It was not, so a
       chapter that had charged for its unfound Key Remnants held five fields and a
       fresh one held four - the same record in two shapes, differing in a field whose
       whole job is to be read by somebody deciding whether to move Despair. Reading
       `undefined` happened to be falsy and therefore happened to be right, which is
       the kind of correctness that stops being correct the first time anyone writes
       `!== false`. The vote's fields are in it for the same reason (E10 C1), and
       `vote` is merged one level down, so a record written before 1.2.71 reads a
       closed vote of round 0 rather than a `vote` that is not there. */
    const blank = {
        chapter, seconds: TRIAL.speakSeconds,
        voteClosed: false, verdictApplied: false, keysCharged: false,
        tied: false, majority: 0, noMajority: false,
        vote: blankVote(), accused: [], total: 0, accusedIds: [], verdict: null
    };
    try {
        const stored = game.settings.get(MODULE_ID, SETTINGS.trialProgress) ?? {};
        // A record from another chapter describes another trial. Read as blank
        // rather than migrated: the alternative is a fresh trial that thinks
        // its vote is already in.
        if (stored.chapter !== chapter) return blank;
        return { ...blank, ...stored, vote: { ...blank.vote, ...(stored.vote ?? {}) } };
    } catch {
        return blank;
    }
}

/**
 * Which chapter the STORED trial record is about, or null if there is none.
 *
 * `trialProgress()` deliberately answers blank for a record from another chapter -
 * a fresh trial must not think its vote is already in. That is right for every
 * reader but one: the GM panel needs to spot a trial still sitting for a chapter
 * that has already been ended, and the blank is exactly what hides it.
 */
export function trialProgressChapter() {
    try {
        return game.settings.get(MODULE_ID, SETTINGS.trialProgress)?.chapter ?? null;
    } catch {
        return null;
    }
}

/** Amend the record. GM only, and always stamped with the chapter it is about. */
export async function setTrialProgress(patch = {}) {
    if (!game.user.isGM) return null;
    const next = { ...trialProgress(), ...patch, chapter: getClock().chapter };
    try {
        await game.settings.set(MODULE_ID, SETTINGS.trialProgress, next);
    } catch (err) {
        error("Could not record how far the trial has got", err);
    }
    return next;
}

/** A trial is starting: nothing has happened in it yet. */
export async function resetTrialProgress({ seconds = TRIAL.speakSeconds } = {}) {
    if (!game.user.isGM) return null;
    // `tied` goes with them: a trial re-opened in the same chapter must not
    // inherit the previous vote's tie and quietly default its verdict to wrong.
    //
    // AND THE VOTE, BUT NOT ITS ROUND (E10 C1). A second trial in the chapter
    // (D17) starts with no vote open, nobody handed a ballot and nobody accused,
    // and numbers its first vote after the last one: a ballot of the first trial
    // is of an older round, so no count of the second can read it. `keysCharged`
    // is not named, so the merge keeps it - the Key fee is the chapter's (E09 C7).
    const { round } = trialProgress().vote;
    return setTrialProgress({
        seconds, voteClosed: false, verdictApplied: false, tied: false, majority: 0, noMajority: false,
        vote: { ...blankVote(), round }, accused: [], total: 0, accusedIds: [], verdict: null
    });
}

/* ==========================================================================
 * RUNNING A VOTE
 * ========================================================================== */

export function registerVote() {
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
    if (game.user.isGM) return;
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
 * open round; the sender holds a ballot in it, by `eligibleVoters` read as the GMs hold the
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
 * vote is open or the sender holds no ballot in it (`eligibleVoters`, as the GMs hold the students); `{ cast:
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
            await setTrialProgress({ vote: { ...progress.vote, issued: [...issued, sender.id] } });
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
    const voters = eligibleVoters();
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
    await setTrialProgress({
        vote: { open: true, round, picks, issued: voters.map(({ user }) => user.id),
            openedAt: Date.now(), closedAt: null },
        voteClosed: false, tied: false, majority: 0, noMajority: false, accused: [], total: 0, accusedIds: []
    });
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
    const voters = eligibleVoters()
        .filter(({ user }) => !back.has(user.id) && (op === "remind" || handed.has(user.id)));
    const joined = voters.map(({ user }) => user.id).filter(userId => !handed.has(userId));
    if (joined.length) {
        await setTrialProgress({ vote: { ...progress.vote, issued: [...progress.vote.issued, ...joined] } });
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
function eligibleVoters() {
    const out = [];
    const seated = new Set();
    for (const actor of studentActors()) {
        if (!TRIAL.deadCastBallots && isDeceased(flagsHeldNow(actor))) continue;
        const user = game.users.find(u => !u.isGM && u.active && actor.testUserPermission(u, "OWNER"));
        if (!user || seated.has(user.id)) continue;
        seated.add(user.id);
        out.push({ user, actor });
    }
    return out;
}

/**
 * Every write queued on a student judged (sheet-audit.mjs `judgedFor`; E10 C2): waited for once, outside
 * the vote's turn, by every road that decides who holds a ballot, so `eligibleVoters` then reads each
 * student as the GMs hold it in one synchronous pass.
 */
function studentsJudged() {
    return judgedFor(...studentActors().map(actor => actor.id));
}

/**
 * Which of a person's students is the one holding their ballot.
 *
 * Read from `eligibleVoters` rather than worked out again, so the step that hands the
 * ballots out and the cast that records one cannot disagree about who it belongs to -
 * which is what decides whose candidate list the answer is checked against.
 */
function voterActorFor(user) {
    return eligibleVoters().find(v => v.user.id === user.id)?.actor ?? null;
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
    return eligibleVoters()
        .filter(({ user }) => !back.has(user.id))
        .map(({ user, actor }) => ({ user, actor, name: actor.name }));
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
    return new Set([...vote.issued, ...eligibleVoters().map(({ user }) => user.id),
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
 * 3): "notReady" until the GMs' store holds the other GMs' rows; "none" when it holds no ballot
 * of an open vote that was opened before this browser loaded - its ballots may be on another
 * GM's browser, on none, or not cast yet, and this browser cannot tell which; otherwise null,
 * as on a player's browser and with no vote open.
 */
export function ballotCopyStatus() {
    if (!game.user.isGM) return null;
    const progress = trialProgress();
    if (!progress.vote.open) return null;
    if (!ballotStore.isHydrated()) return "notReady";
    if (!roundBallots(progress).length && (progress.vote.openedAt ?? 0) < LOADED_AT) return "none";
    return null;
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
                confirmedRound = ballot.round;
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
        confirmedRound = round;
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
    await setTrialProgress({ vote });
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
    const sentence = noMajority
        ? game.i18n.format("DRPG.Vote.noMajority", { majority, total: issued })
        : tied
            ? game.i18n.localize("DRPG.Vote.tied")
            : game.i18n.format(accused.length > 1 ? "DRPG.Vote.accusesLineMany" : "DRPG.Vote.accusesLine", {
                names: accused.map(r => esc(named(r.id))).join(", "),
                n: Math.min(...accused.map(r => r.n)), total: issued
            });
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

/* ==========================================================================
 * CONSEQUENCES
 * ========================================================================== */

/**
 * Apply what the verdict costs.
 *
 * The module knows who killed now - every incident that left a body wrote its
 * killer into the chapter's register - so this no longer asks a GM to name the
 * Blackened from memory an hour after the fact. It asks the one thing only a
 * human can answer: did the table get it right.
 *
 * A tie counts as getting it wrong (guide p. 31), which is why the verdict is
 * still a button rather than something read off the tally.
 *
 * The register CAN be empty: a chapter whose killing was never run through the
 * incident engine, or a world upgraded mid-chapter. Then this falls back to the
 * pair of dropdowns it always had, and nothing is lost.
 */
export async function openVerdictDialog() {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    // ONE VERDICT PER TRIAL (17.09, F2). The trial console kept this button live after
    // the verdict, and nothing here or in `applyVerdict` asked - a second press executed
    // whoever the dropdown held, refilled every Despair pool and opened a second round of
    // Level Ups. The console now disables it too; this is the boundary for every other
    // way in.
    if (trialProgress().verdictApplied) {
        ui.notifications.warn(game.i18n.localize("DRPG.Vote.verdictAlreadyApplied"));
        return null;
    }

    // The trial's Blackened, not the register whole (E05 fix r2-G1): a killer whose every
    // victim is still a death nobody has found is neither executed nor rewarded here. Read once
    // the stores hold the other GMs' rows (fix r2-G2).
    await whenTrialReadable();
    const known = trialBlackenedActors();
    const students = studentActors();
    // Recorded by the count (`closeRound`, on the primary GM), because by the time
    // this window opens the tally has scrolled away and the GM is being asked to
    // remember it. A close with no ballot records a tie too (E10 C1).
    const tiedVote = Boolean(trialProgress().tied);
    const options = students
        .map(a => `<option value="${a.id}">${foundry.utils.escapeHTML(a.name)}${
            isDeceased(a) ? ` - ${game.i18n.localize("DRPG.Chapter.deadShort")}` : ""
        }</option>`).join("");

    // What the register says, stated rather than asked. Two names here is an
    // ordinary evening now: one incident, then the betrayal.
    const roster = known.length
        ? `<p><strong>${plural("DRPG.Vote.blackenedKnown", { n: known.length })}</strong>
             ${known.map(a => foundry.utils.escapeHTML(a.name)).join(", ")}</p>`
        : "";

    const result = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Vote.verdictTitle") },
        classes: ["drpg-panel"],
        content: dialogContent(`<form>
            <p>${game.i18n.localize(known.length
                ? "DRPG.Vote.verdictIntroKnown" : "DRPG.Vote.verdictIntro")}</p>
            ${roster}
            <label>${game.i18n.localize(known.length
                ? "DRPG.Vote.executedIfWrong" : "DRPG.Vote.executed")}
                <select name="executed">${options}</select></label>
            ${known.length ? "" : `<label>${game.i18n.localize("DRPG.Vote.blackened")}
                <select name="blackened">${options}</select></label>`}
            <p class="notes">${game.i18n.localize(known.length
                ? "DRPG.Vote.verdictNoteKnown" : "DRPG.Vote.verdictNote")}</p>
            ${tiedVote ? `<p class="drpg-warning">${
                game.i18n.localize("DRPG.Vote.tiedVerdictNote")}</p>` : ""}
        </form>`),
        buttons: tiedVote
            /*
             * G-31: A TIE COUNTS AS GETTING IT WRONG (guide p. 31), so after a
             * tied vote that is the button under the GM's hand.
             *
             * REORDERED, NOT JUST RE-DEFAULTED. `default: true` styles a button
             * and moves focus, but Enter in a DialogV2 presses the FIRST submit
             * button in DOM order whatever carries the flag - the finding
             * behind the per-tab footers in E3. Leaving "Got it right" first
             * and merely flagging the other one would mean the keyboard and the
             * highlight disagreed about the most consequential button in the
             * game.
             *
             * Still a button rather than a reading off the tally: the tie is a
             * fact the module knows, but whether the table got it right is the
             * one thing only a human at that table can answer.
             */
            ? [
                {
                    action: "wrong", label: game.i18n.localize("DRPG.Vote.gotItWrong"), default: true,
                    callback: (e, b, d) => read(d, false, known)
                },
                {
                    action: "correct", label: game.i18n.localize("DRPG.Vote.gotItRight"),
                    callback: (e, b, d) => read(d, true, known)
                },
                { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
            ]
            : [
                {
                    action: "correct", label: game.i18n.localize("DRPG.Vote.gotItRight"), default: true,
                    callback: (e, b, d) => read(d, true, known)
                },
                {
                    action: "wrong", label: game.i18n.localize("DRPG.Vote.gotItWrong"),
                    callback: (e, b, d) => read(d, false, known)
                },
                { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
            ],
        rejectClose: false
    });

    if (!result || result === "cancel") return null;
    return applyVerdict(result);
}

/**
 * Turn the form into a verdict.
 *
 * With a register, a correct verdict executes THE BLACKENED - all of them, and
 * the dropdown is ignored, because a table that named them right is not also
 * executing somebody else. A wrong one executes whoever the dropdown says and
 * leaves every killer standing.
 */
function read(dialog, correct, known) {
    const f = dialog.element.querySelector("form");
    const blackenedIdList = known.length ? known.map(a => a.id) : [f.blackened.value];
    return {
        correct,
        executedIds: correct && known.length ? blackenedIdList : [f.executed.value],
        blackenedIds: blackenedIdList
    };
}

/**
 * The rule a surviving Blackened introduces, taken down and announced anonymously.
 *
 * Shaped after the `newRule` Despair Call in call-effects.mjs, and different
 * from it in exactly one way that matters: nothing in the card says who asked
 * for it. The GM types what the killer told them; the table reads a rule.
 *
 * @returns {Promise<boolean>} whether a rule was actually recorded.
 */
async function askBlackenedRule() {
    const DialogV2 = foundry.applications.api.DialogV2;
    let text = "";

    try {
        const answer = await DialogV2.wait({
            window: { title: game.i18n.localize("DRPG.Vote.blackenedRuleTitle") },
            classes: ["drpg-panel"],
            content: dialogContent(`<form>
                <p>${game.i18n.localize("DRPG.Vote.blackenedRuleIntro")}</p>
                <textarea name="rule" rows="3"
                    placeholder="${game.i18n.localize("DRPG.Calls.newRulePlaceholder")}"></textarea>
                <p class="notes">${game.i18n.localize("DRPG.Vote.blackenedRuleNote")}</p>
            </form>`),
            buttons: [
                { action: "ok", label: game.i18n.localize("DRPG.Rules.addNew"), default: true,
                  callback: (e, b, d) => d.element.querySelector("form")?.elements?.rule?.value ?? "" },
                { action: "skip", label: game.i18n.localize("DRPG.Advance.cancel") }
            ],
            rejectClose: false
        });
        text = typeof answer === "string" ? answer.trim() : "";
    } catch (err) {
        error("Could not ask for the Blackened's rule", err);
        return false;
    }

    if (!text) return false;

    try {
        const { addRule } = await import("./rules.mjs");
        const recorded = await addRule(text);
        if (!recorded) return false;
    } catch (err) {
        error("Could not record the Blackened's rule", err);
        return false;
    }

    // Public, unattributed, and carrying the same sound the Call's own card
    // carries - because to the table this IS one of Monokuma's rules.
    await announce({
        flags: { [MODULE_ID]: { sfx: "newRule" } },
        content: `<div class="drpg-new-rule">
            <h3>${game.i18n.localize("DRPG.Calls.newRuleTitle")}</h3>
            <p>${foundry.utils.escapeHTML(text)}</p>
        </div>`
    });
    return true;
}

/** Execute somebody, and hand out what the guide says the table has earned. */
export async function applyVerdict({
    correct, executedIds, blackenedIds: named, executedId, blackenedId
} = {}) {
    if (!game.user.isGM) return null;

    // MARKED BEFORE ANYTHING IS ASKED (17.09, review of F2). The record used to be written
    // at the very end, after every Level Up window and the Blackened's rule had closed -
    // minutes in which the console, another GM or the API could start a second verdict.
    // Written first, the lock holds for the whole of it; the same check stands here for
    // every caller that does not come through `openVerdictDialog`.
    if (trialProgress().verdictApplied) {
        ui.notifications.warn(game.i18n.localize("DRPG.Vote.verdictAlreadyApplied"));
        return null;
    }
    await setTrialProgress({ verdictApplied: true });

    // Both shapes accepted: the dialog sends lists, and anything older - a
    // macro, the console - sends the single ids this used to take.
    const executed = (executedIds ?? [executedId]).filter(Boolean)
        .map(id => game.actors.get(id)).filter(Boolean);
    const blackened = (named ?? [blackenedId]).filter(Boolean)
        .map(id => game.actors.get(id)).filter(Boolean);
    const done = [];

    for (const actor of executed) {
        if (isDeadForGm(actor)) continue;
        await killCharacter(actor);
        done.push(game.i18n.format("DRPG.Vote.wasExecuted", {
            name: foundry.utils.escapeHTML(actor.name)
        }));
    }

    if (correct) {
        // Everyone still alive advances - unchanged, and deliberately: a right
        // answer levels the table up. The Blackened have just been executed, so
        // they are not in this list, which is what keeps that honest even when
        // there were two of them.
        //
        // ALIVE AS THE TABLE KNOWS IT (E05 fix r2-G1, 27.09.2026; review S2-m6, the plan's
        // rule A). The list was the GMs' (`livingStudentsForGm`), so a student whose body
        // nobody had found was passed over - no Level Up window for them, measured on the
        // harness - and every console saw the class advance and one student not. A Level
        // Up is a write every console reads: the table's list, less
        // whoever this verdict named for execution - one already dead to the GMs is not
        // killed twice (the loop above passes over them), and does not advance either.
        //
        // A Reinforced Level Up a wrong verdict left waiting (E05 C11) is picked here, with
        // its owner's Standard, in the same window - see `runAdvancementBatch`.
        const sentenced = new Set(executed.map(a => a.id));
        const survivors = livingStudents().filter(a => !sentenced.has(a.id));
        done.push(plural("DRPG.Vote.levelUp", {
            n: survivors.length,
            kind: TRIAL.correct.levelUp
        }));
        await promptAdvancements(survivors, TRIAL.correct.levelUp);
    } else {
        // EVERY killer who is still breathing, not just the first one named.
        //
        // THEIR LEVEL UP WAITS FOR THE CLASS (E05 C11, 27.09.2026; D4; audit S03-01,
        // S06-01). Applied here it wrote new maxima and `advances` on the Blackened and a
        // card spoken by them, which every console receives - the student the class had
        // just failed to name. It is a row of the GMs' store now, picked with the class's
        // next Standard or at the Final Trial's verdict (level-up.mjs `deferAdvancement`).
        const survivingKillers = blackened.filter(a => !isDeadForGm(a));
        if (survivingKillers.length) {
            const { deferAdvancement } = await import("./level-up.mjs");
            let waiting = 0;
            for (const actor of survivingKillers) {
                try {
                    if (await deferAdvancement(actor, TRIAL.wrong.blackenedLevelUp, getClock().chapter ?? null)) waiting++;
                } catch (err) {
                    error(`Could not keep ${actor.name}'s Level Up for the class`, err);
                }
            }
            done.push(plural("DRPG.Vote.blackenedRewarded", {
                n: waiting,
                kind: TRIAL.wrong.blackenedLevelUp
            }));
        }
        if (TRIAL.wrong.fillDespair) {
            await fillAllDespair();
            done.push(game.i18n.format("DRPG.Vote.despairFilled", {
                who: monokumas().map(poolLabel).join(", ")
            }));
        }
        // THE ONE LINE OF THE VERDICT TABLE THAT HAD NO PATH.
        //
        // This used to push a sentence into the GM's whisper and stop, so the
        // rule the Blackened had just earned existed only if somebody
        // remembered it. It is written down now, announced to the table, and
        // announced WITHOUT A NAME: to everyone else it is simply another of
        // Monokuma's rules, which is the whole point of surviving a wrong vote.
        if (TRIAL.wrong.newRule && survivingKillers.length) {
            const wrote = await askBlackenedRule();
            done.push(game.i18n.localize(wrote
                ? "DRPG.Vote.newRuleWritten"
                : "DRPG.Vote.newRule"));
        }
    }

    /*
     * THE OVERFLOW EMPTIES WITH THE VERDICT (Z10), on BOTH verdicts and not
     * only the one that refills the pools.
     *
     * The counter measures pressure built up over a chapter, and a verdict ends
     * the chapter however it goes. Clearing it only when the class guessed
     * wrong would mean a class that guessed RIGHT carries the previous
     * chapter's weather into the next one - punished for winning, by a rule
     * whose whole subject is how much Despair went spare.
     */
    try {
        const { resetOverflow } = await import("./overflow.mjs");
        await resetOverflow();
    } catch (err) {
        warn("Could not clear the Despair overflow at the verdict", err);
    }

    await whisperToGms(`
        <h3>${game.i18n.localize("DRPG.Vote.verdictTitle")}</h3>
        <p>${game.i18n.localize(correct ? "DRPG.Vote.correctSummary" : "DRPG.Vote.wrongSummary")}</p>
        <ul>${done.map(d => `<li>${d}</li>`).join("")}</ul>`);

    await setTrialProgress({ verdictApplied: true });

    log(`Verdict applied: ${correct ? "correct" : "wrong"}.`);
    return done;
}

/**
 * Open the advancement dialog for each character who earned one.
 *
 * Opened on the GM's client rather than pushed at the players: a level-up is a
 * conversation about what the character became, and the module already puts the
 * same dialog behind a button on every sheet. A survivor holding a Reinforced
 * that waited for the class picks both in one window (level-up.mjs
 * `runAdvancementBatch`, E05 C11).
 */
async function promptAdvancements(actors, kind) {
    try {
        const { runAdvancementBatch } = await import("./level-up.mjs");
        return await runAdvancementBatch(actors, kind);
    } catch (err) {
        error("Could not open the verdict's Level Ups", err);
        return null;
    }
}
