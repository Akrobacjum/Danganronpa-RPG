/**
 * Danganronpa RPG - the incident's record, and the roads it travels.
 * ---------------------------------------------------------------------------
 * The world half of an incident and the list of what it may hold
 * (`PUBLIC_INCIDENT`, `splitIncident`); the cast - read (`readCast`), merged
 * with the world half into one state (`murderState`), written field by field
 * (`castFieldsToWrite`, `writeCast`, `ownCastWrite`, and `castPutBack` when the
 * world half's write threw) - and each participant's stamped copy of it
 * (`castOwners`, `castFor`, `castPacket`, `sendCast`, `pushCastToParticipants`,
 * `retellCast`); the queue every write of an incident runs in and the one write
 * of both halves (`incidentWrite`, `stillHolds`, `writeState`, `restoreState`);
 * the socket that keeps a participant's copy in step (`registerIncidentCastSync`,
 * `askForCast`); who is in it (`sideOf`, `killerIds`, `participantIds`,
 * `swungWeaponOf`, `castHeldHere`, `incidentAudienceIds`); the betrayal window
 * the write arms (`armBetrayalWindow`, `sweepBetrayalWindows`,
 * `clearBetrayalOffer`, `betrayalCandidate`, `leftABody`); and the GMs' memo of
 * the opening's request cards (`keepOpeningNotice`, `retireOpeningNotices`).
 * Its state: `writingCast`, `incidentWrites` (the queue) and `castTold` (what
 * each player was last told). What it does not hold: the rules of the three
 * stages, the deaths a player may know, the Blackened register, the lifts out
 * of world data, the murder window and the tracker - all murder.mjs's.
 *
 * WHERE IT SITS. Moved out of murder.mjs by E34 (1.2.70), a pure move that
 * `node tools/moved-only.mjs` proves line by line. The file above it is
 * murder.mjs, which re-exports the fourteen names of this file it exported before,
 * so importers keep importing murder.mjs, and nothing here imports it back: R161
 * counts an `export ... from` as an edge, and the import would close a cycle.
 * Below it are config.mjs, monokuma.mjs, settings.mjs, gm-stores.mjs,
 * gm-store.mjs, clock.mjs and utils.mjs. The betrayal window sits here, rules
 * though it is, because `writeState` arms it (`armBetrayalWindow` ->
 * `betrayalCandidate` -> `leftABody`): left above, the store would have to import
 * its facade, and taking the arming out of the write is a change of code, which a
 * move is not. Sixteen names are exported that were not (`SOCKET_EVENT`,
 * `readCast`, `writeCast`, `ownCastWrite`, `incidentWrite`, `stillHolds`,
 * `restoreState`, `castOwners`, `pushCastToParticipants`, `writeState`,
 * `sweepBetrayalWindows`, `castHeldHere`, `registerIncidentCastSync`,
 * `betrayalCandidate`, `keepOpeningNotice`, `retireOpeningNotices`), because
 * murder.mjs reads them; it does not re-export them, so the module's API is the
 * one it was. The two listeners of `registerIncidentCastSync` moved unchanged: a
 * participant's request is answered by the primary GM alone, from the sender's own
 * seat in the cast, and a copy of the cast is taken only from a GM.
 *
 * WHERE THE STATE LIVES, AND WHY IT IS IN TWO PIECES (LIVE-001).
 *
 * The STAGE is world-scoped: that an incident runs, and whether it is the
 * opening, the fight or Stage 6 - every browser's locks read it. Until 1.2.66 the
 * rest of the mechanics were too - whose turn it is, what is blocked, what has
 * been spent - on the reading that a socket round trip per turn would leave the
 * table waiting; since E32 C2 they travel with the names below, which `writeState`
 * sends each participant whenever it writes them, before it writes the world half.
 *
 * The NAMES are not. `killerId` used to sit in that same world setting, and
 * world data reaches every client - so any student could read the killer out of
 * their own console before the body was found. The cast now lives in browser
 * storage, client-scoped: every GM holds it - a GM store since E04 (1.2.63,
 * gm-stores.mjs `castStore`), merged field by field with the other GMs - and each
 * participant is sent their copy, stamped, over a recipient-addressed socket
 * (`castCopy`). Nobody else receives anything.
 *
 * `murderState()` still hands back ONE object with both halves merged, so every
 * reader in this file and outside it is unchanged. What differs is what a
 * non-participant's client finds in it: the stage, and nothing else.
 */

import { MODULE_ID } from "./config.mjs";
import { isMonokuma } from "./monokuma.mjs";
import { SETTINGS, incidentCast, incidentIndirect, incidentSeats, isDeadForGm } from "./settings.mjs";
import { castStore, castCopy, CAST_FIELDS, CAST_SEATS, INCIDENT_FIGHT } from "./gm-stores.mjs";
import {
    RECORD, onGmStoresHydrated, gmStoresHydrated, gmStoresQuiet, whenGmStoresAudible, onGmStoresAudible, stableJson
} from "./gm-store.mjs";
import { getClock } from "./clock.mjs";
import { ownerOf, isPrimaryGm, primaryGmId, log, error } from "./utils.mjs";

/* ==========================================================================
 * STATE
 * ========================================================================== */

/**
 * The fields that name a person. These never enter world data.
 *
 * `thirdSide` is here with the ids because it is only meaningful next to
 * `thirdId`: "the third party threw in with the killers" is a sentence about
 * somebody, and on a client that cannot see who the third party is it would be
 * a fact about nobody.
 *
 * `lastCrisis` - the Reroll receipt - is here too. It carries `actorId`,
 * `victimId` and a snapshot of the MERGED state, so a receipt written to the
 * world half named every participant from the first crisis action until
 * `endMurder`, undoing LIVE-001 for the whole of Stages 5 and 6. Routed into
 * the cast it stays on GM browsers, and `murderState()` merges it back so every
 * reader is unchanged. Until E06 it also reached every participant's copy, swing
 * memo and all; only a GM judges an undo, so a copy holds it null (`castFor`).
 */
/*
 * The list itself lives in the GM store's table since E04 (gm-stores.mjs,
 * `CAST_FIELDS`), which keeps the cast as one record of these fields - the two
 * above and the betrayal offer (`{ thirdId, killerId, chapter, day }`) and the
 * swing memo (`{ [actorId]: itemId }`) among them. Both of those used to be actor
 * flags, which are world data every client receives - so for the whole of Stage
 * 6 anybody could read who the accomplice was and who swung what (CASE-04).
 *
 * "EVERYTHING ELSE NAMES NOBODY" WAS NOT ENOUGH (E05 C8; audit S04-08). This comment
 * said the rest was a number, a stage or a list of action keys. The rest also held
 * how the incident happened - a trap, a death by the victim's own hand, a reversal,
 * the moment it opened, how it ended - and each of those is an answer the Class Trial
 * exists to find. They are the cast's now (`INCIDENT_METHOD`), and the world half is
 * turned round: it holds only the fields listed below, each with the reason a
 * bystander may know it, and `splitIncident` sends a field that is neither listed
 * here nor the cast's nowhere at all - fail closed, not the cast, so an unlisted write
 * is dropped rather than guessed into secrecy the wrong way (R191 reads every literal
 * write).
 *
 * AND THE FIGHT FOLLOWED (E32 C2, 28.09.2026; E05's Q8, the owner's Q1 (a) of 28.09).
 * Twelve fields stayed here after E05 - the round, whose side acts, the hindrances,
 * what is spent, the third's one action and the rest (gm-stores.mjs `INCIDENT_FIGHT`) -
 * because "both trackers need them live every turn". Every reader of them runs where
 * the cast is held, and `writeState` sends the cast's holders their copy whenever it
 * writes the cast, before it writes the world half - so they moved into the cast, and
 * each holder is sent the fight in their copy (`castFor`). A bystander's browser
 * holds the two below and nothing else: that an incident runs, and at which stage. A
 * running incident's fight still in the world half from 1.2.65 is merged by
 * `murderState()` under the cast's, whose value wins once written, until the clause
 * `liftIncidentFight` lifts it into the cast (E32 C3).
 */

/**
 * WHAT THE WORLD HALF OF AN INCIDENT MAY HOLD, AND WHY A BYSTANDER MAY KNOW IT
 * (E05 C8; the stage alone since E32 C2). Every browser holds it; none of it names
 * anyone. The world-secrets rule (`murderState`'s `only`) is this list written out,
 * and R191 holds the two equal.
 */
export const PUBLIC_INCIDENT = Object.freeze({
    active: "an incident is running: the table knows that much, and every browser's locks read it (movement, the rolls' audience, the traces' hiding)",
    stage: "the opening, the fight or Stage 6: which of those locks holds, and the Event card and the music on a witness's browser"
});

/**
 * One patch of an incident, split: `world` the fields `PUBLIC_INCIDENT` lists, `cast`
 * the ones the cast's record holds, `neither` the names of any other - which go
 * nowhere, and are said (R191 reads every literal write for them). A field nobody
 * listed never reaches the world. Pure.
 */
export function splitIncident(patch) {
    const world = {}, cast = {}, neither = [];
    for (const [key, value] of Object.entries(patch ?? {})) {
        if (Object.hasOwn(PUBLIC_INCIDENT, key)) world[key] = value;
        else if (CAST_FIELDS.includes(key)) cast[key] = value;
        else neither.push(key);
    }
    return { world, cast, neither };
}

export const SOCKET_EVENT = `module.${MODULE_ID}`;
/** GM -> one participant, and nobody else. */
const CAST_MINE = "incident.myCast";
/** A participant's client catching up after a reload, or when a GM connects. */
const CAST_MINE_REQUEST = "incident.myCastRequest";

/**
 * What this client knows about who is in the incident. `{}` for a bystander.
 * The GMs' record, or a participant's copy (settings.mjs, `incidentCast`, E04).
 */
export function readCast() {
    // What each player was last sent (`sent`, `sendCast`) is the GMs' delivery memo, not the incident's;
    // the opening's request cards (`openingNotices`, `keepOpeningNotice`) are the GMs' memo too.
    const { sent, openingNotices, ...cast } = incidentCast();
    return cast;
}

/** The murder in progress, or `null`. Mechanics from the world, names from here. */
export function murderState() {
    const stored = game.settings.get(MODULE_ID, SETTINGS.murderState) ?? {};
    if (!stored.active) return null;
    return { ...stored, ...readCast() };
}

/**
 * The fields one write of the cast stamps, and with what (the round-2 review's M1):
 * every field `next` names, and a field `previous` held that `next` leaves out - a
 * removal, stamped null. A field neither names is not this write's: until E04's fix
 * round every field of the record was stamped, `next`'s value or null, so a GM whose
 * browser held no cast - a lost browser after Continue, a hydration that timed out -
 * passed the turn and stamped null over every other GM's killer (measured: the killer
 * null on both GMs and in the participant's copy). Pure.
 */
export function castFieldsToWrite(next, previous) {
    const out = {};
    for (const f of CAST_FIELDS) {
        if (next && Object.hasOwn(next, f)) out[f] = next[f] ?? null;
        else if (previous && Object.hasOwn(previous, f)) out[f] = null;
    }
    return out;
}

/**
 * Write the cast, and send each participant theirs.
 *
 * The fields `castFieldsToWrite` names: what the caller hands in, and a field it left
 * out of what this browser held - a removal. Only a field whose value differs from the
 * one held here is stamped (`changedOnly`, E04), so a writer that hands the whole cast
 * back with one field changed does not stamp the rest over another GM's newer write.
 * `explicit` names fields stamped whether or not they differ: the ones a new incident
 * decides afresh, which must win over whatever a GM that missed the last close still
 * holds (audit S04-24).
 *
 * The participants are worked out from the cast being written rather than the
 * one being replaced, plus anybody who WAS in it - so a student who drops out
 * of an incident has their copy cleared rather than keeping the last names they
 * were told.
 */
export async function writeCast(next, previous = readCast(), { explicit = [], push = true } = {}) {
    if (!game.user.isGM) return next;

    const fields = castFieldsToWrite(next, previous);
    const decided = {};
    for (const f of explicit) {
        if (!(f in fields)) continue;
        decided[f] = fields[f];
        delete fields[f];
    }
    // One tick, so one flush of the store and one packet to the other GMs.
    await ownCastWrite(() => Promise.all([
        castStore.patch(RECORD, fields, { changedOnly: true, whole: true }),
        Object.keys(decided).length ? castStore.patch(RECORD, decided, { whole: true }) : null
    ]));

    const entry = readCast();
    if (push) pushCastToParticipants(entry, previous);
    return entry;
}

/*
 * A WORLD WRITE THAT THROWS PUTS THE CAST BACK (E33 C8, 07.10.2026; the stage plan's 2.6, lead
 * L5 of its 1.3). Both writers put the cast first - `writeState` so a participant's names arrive
 * before the stage repaints them, `restoreState` the same - so a world write that fails (a
 * settings write refused, the socket gone under it) left the cast a step ahead of the stage.
 * Measured on the grid's XI08 at 2f4b6fb: a Survive whose world write was refused once left
 * `endedBy` and `freeCleanup` in the cast under stage "incident" (the case's step 5, red on
 * I16); a close so refused leaves an empty cast under an active incident by the same reading,
 * measured only with this put-back taken out (the commit's mutant c8-restore-no-put-back). The
 * fields the write changed are stamped back to what they were (`changedOnly` finds exactly
 * those, so a field the write left alone keeps its stamp), the participants are sent the cast
 * they held before, and the error goes on to the caller.
 *
 * A PUT-BACK THAT FAILS ITSELF (fix r2-G3, 07.10.2026; review round 2's cor D4). Its error is
 * logged on this GM's console and swallowed here, and the caller rethrows the world write's
 * own: the cast is then ahead of the stage, the console holds why, and whoever asked hears
 * the write that failed first. Until this fix the put-back's error was thrown over the first
 * one, which reached nobody - while this comment said the console told both. Measured on the
 * grid's XI09 (a Leave a clue's pass refused at its world half and again at this put-back):
 * the caller heard "the grid refused the put-back's cast write once" before the fix and
 * "the grid refused the incident's world half write once" after it.
 */
async function castPutBack(previous, written, publicBefore, publicNext) {
    try {
        await writeCast(previous, written, { push: false });
        pushCastToParticipants(readCast(), written, publicBefore, publicNext);
    } catch (err) {
        error("Could not put the incident's cast back after its world write failed; the cast stays ahead of the stage until the incident is written again", err);
    }
}

/** While this module's own write of the cast is in flight: its change event is not a merge. */
let writingCast = 0;
export async function ownCastWrite(write) {
    writingCast++;
    try { return await write(); } finally { writingCast--; }
}

/*
 * ONE QUEUE FOR THE INCIDENT'S WRITES (E32 C4, 28.09.2026; audit S04-26).
 *
 * Until 1.2.66 two writers of the same incident read it, awaited something, and wrote
 * what they had read: the victim running out was checked by the `updateActor` hook
 * and by the crisis action that dealt the blow, both read stage "incident" before
 * either wrote "resolution", and the victim ran out twice - two ran-out cards (the
 * grid's DM14, red at f177726); two closes of one incident each fired
 * `drpgIncidentClosed`. Every write of the incident on this browser - both halves of
 * `writeState` and `restoreState`, and every cast write outside them - now runs
 * through this one promise chain, one after another.
 *
 * A write that moves the incident on also says what it read (`expect`, a few fields
 * of the merged state), and the queue compares that with the state as it stands when
 * the write's turn comes: a mismatch writes nothing and answers null, and the caller
 * stops there - a transition that lost its race must not half-apply. The two writers
 * and the leaves they call (`writeCast`, `armBetrayalWindow`, and since E33 C8 `castPutBack`)
 * never call a transition or queue a write of their own, so the chain cannot wait on
 * itself: R205 reads that off the source.
 *
 * PER BROWSER. A second GM's button runs its own queue on its own browser; the stores'
 * stamps settle what the two GMs wrote, and nothing here orders them. Not measured -
 * the harness has one GM (LIVE-E07-10).
 *
 * A WRITE THAT THROWS RELEASES THE QUEUE (`run.catch`): the next write runs, and the one
 * that threw tells its caller, which stops as it would have. Read since E32 C4 and measured
 * on the grid's XI08 (E33 C8, 07.10.2026): a cast write refused at a Leave a clue's pass
 * left the turn where it was, and the Survive after it was written. What a throw BETWEEN
 * the two halves leaves is `castPutBack`'s, below `writeCast`.
 */
let incidentWrites = Promise.resolve();
export function incidentWrite(write) {
    const run = incidentWrites.then(() => write());
    incidentWrites = run.catch(() => null);
    return run;
}

/** Does the incident this browser holds still show each field of `expect` (null for absent)? */
export function stillHolds(expect) {
    if (!expect) return true;
    const now = murderState() ?? {};
    return Object.entries(expect).every(([key, value]) => JSON.stringify(now[key] ?? null) === JSON.stringify(value ?? null));
}

/**
 * Replace the whole state, splitting it the way `writeState` splits a patch.
 *
 * Two callers, and both hand over a MERGED object: the Reroll rewind, which
 * kept a receipt taken from `murderState()`, and `endMurder`, which passes `{}`
 * to clear everything. Anything that writes a whole state has to come through
 * here, or the names go straight back into world data.
 *
 * The cast is reset as a record (E04): every field stamped at once, but `keep`,
 * with what `state` gives it or null - so a GM that never saw this write cannot
 * bring an older field of it back. In the incident's queue, with `expect` as
 * `writeState` takes it (E32 C4).
 *
 * `keepSame` (the Reroll's rewind, fix r2-G2, 03.10.2026): a field whose value the rewind
 * does not change keeps its stamp as well. A GM that never saw the rewind holds that value
 * already, so nothing older comes back; and a rewind that stamped every field moved the
 * seats' stamps, `openedAt`'s among them, to the Reroll's time - what `standingStamps`
 * reads the opening off (measured: 19-standing-cast F1 read the Reroll's stamp as the
 * opening's until this option).
 */
export async function restoreState(state = {}, { keep = [], keepSame = false, expect = null } = {}) {
    if (!game.user.isGM) return null;

    return incidentWrite(async () => {
        if (!stillHolds(expect)) return null;

        const previous = readCast();
        const publicBefore = game.settings.get(MODULE_ID, SETTINGS.murderState) ?? {};
        const { world: rest, cast, neither } = splitIncident(state);
        // `updated` belonged to the cast entry until E04, not to the incident - a
        // receipt taken before the upgrade still carries one, and it goes nowhere.
        const unknown = neither.filter(key => key !== "updated");
        if (unknown.length) error(`An incident's state named field(s) neither its world half nor its cast holds, kept out of both: ${unknown.join(", ")}`);

        const same = keepSame ? CAST_FIELDS.filter(f => stableJson(cast[f] ?? null) === stableJson(previous[f] ?? null)) : [];
        await ownCastWrite(() => castStore.resetRecord(cast, { keep: [...keep, ...same] }));
        // Who holds it before and after, by the state before and the one written next.
        pushCastToParticipants(readCast(), previous, rest, publicBefore);
        try {
            await game.settings.set(MODULE_ID, SETTINGS.murderState, rest);
        } catch (err) {
            await castPutBack(previous, readCast(), publicBefore, rest);
            throw err;
        }
        return { ...rest, ...readCast() };
    });
}

/**
 * WHO IS TOLD ABOUT THE INCIDENT, AS USER IDS (E06 C2, 27.09.2026; audit S04-01, D6): the
 * players who own a seat of `incidentSeats` (settings.mjs) at `stage` - the stage the state
 * holds unless the caller names the one a message belongs to - and, when asked, the
 * betrayal offer's third and each actor in `also` (actors or ids), whom a card is about
 * although they hold no seat. GMs are not in it; they are told as GMs. Every GM-side reader
 * that decides who is sent something about the incident asks this - `castOwners` below
 * first - so that none of them keeps a copy of the seats' table. Exported: E32 reads the
 * cast's addressees from it.
 */
export function incidentAudienceIds(state = murderState(), { stage = state?.stage, also = [], betrayal = false } = {}) {
    const ids = [
        ...incidentSeats(state, state, { stage }),
        ...(betrayal ? [state?.betrayal?.thirdId] : []),
        ...also.map(a => (typeof a === "string" ? a : a?.id))
    ];
    const out = new Set();
    for (const id of ids) {
        const owner = ownerOf(game.actors.get(id ?? ""));
        if (owner && !owner.isGM) out.add(owner.id);
    }
    return [...out];
}

/**
 * Whose browsers hold the cast.
 *
 * THE KILLER OF A TRAP IS NOT ON THIS LIST WHILE THE TRAP IS RUNNING, and that
 * is the whole of "an indirect murder does not tell its killer" (Dawid, 15.09).
 *
 * Measured before the change, on four clients: an indirect murder opened, and
 * the killer's player received the cast, the incident Event card and a whisper -
 * the module announcing, in real time, that the thing they had built had just
 * worked. They are not in the room. Everything else in this file exists to stop
 * that fact travelling, and it was travelling straight to the one person who
 * most wants to know it.
 *
 * WITHHELD, NOT REDACTED, and the difference matters. Sending them a cast with
 * the names stripped would still be a packet arriving at the moment the trap
 * closed, and a client-scoped setting quietly gaining a timestamp is a tell for
 * anybody who opens a console. They are sent nothing, which is what a bystander
 * is sent.
 *
 * THEY ARE LET BACK IN AT STAGE 6. The scene becomes theirs to arrange once the
 * incident is over - cleanup.mjs asks `killerIds(murderState())` whether this
 * actor may work on the body, and that answer lives in the cast. So the gate is
 * the STAGE, not the murder: closed while `openingRoll` or `incident` is
 * running, open the moment it is not.
 *
 * AND A DIRECT MURDER'S VICTIM IS NOT ON IT AT THE OPENING (E06 C2; the owner's D6).
 * Nobody has asked them anything yet, and a killer's roll that fails ends the
 * attempt as if it never happened - so until 1.2.65 the cast they were sent at
 * the opening was the one trace of it their browser kept, with the killer's name
 * in it. They are sent it when the roll succeeds and the stage moves to
 * `incident` (`writeState` pushes on a change of holders), and a failed opening
 * sends them nothing, not even an empty cast.
 *
 * Both gates are rows of one table now, `incidentSeats`, with the stage and the
 * cast in hand. Whether it is a trap is the cast's (E05 C8) - or a world half's
 * the lift has not reached yet: `incidentIndirect`'s rule (settings.mjs), passed
 * in so a cast that holds nothing there does not hide it. The accomplice keeps
 * a copy for as long as the betrayal is on offer, which is longer than the
 * incident (D18) - the offer alone, once the incident running is not theirs
 * (`castFor`).
 */
export function castOwners(cast, state = null) {
    const live = state ?? game.settings.get(MODULE_ID, SETTINGS.murderState) ?? {};
    return new Set(incidentAudienceIds({ ...live, ...cast, indirect: incidentIndirect(cast, live) }, { betrayal: true }));
}

/**
 * Each participant gets their copy of the cast (`castFor`); everyone who has left it
 * gets an empty one.
 */
export function pushCastToParticipants(cast, previous, stateNow = null, statePrev = null) {
    const now = castOwners(cast, stateNow);
    const before = castOwners(previous, statePrev ?? stateNow);

    // The stamps of the record's fields (E04; the review's B1): a copy takes only what is newer.
    const stamps = castStamps();
    // While the stores are quiet nothing goes out, and what the participants were told stays (`tellCastChange`).
    if (!gmStoresQuiet()) castTold = { stamps, cast };
    for (const userId of before) {
        if (!now.has(userId)) sendCast(userId, {}, stamps, stateNow, { leaving: true });
    }
    for (const userId of now) sendCast(userId, cast, stamps, stateNow);
}

/**
 * The record's stamps, one per field a participant's copy holds - every field of the
 * record but the swing memo. What each packet carries of them is `castPacket`'s: for
 * "not in it" (`{}`) and the offer alone the seats' (gm-stores.mjs, `castCombine`, which
 * weighs them).
 */
function castStamps() {
    return Object.fromEntries(CAST_FIELDS.filter(f => f !== "swung").map(f => [f, castStore.stampOf(RECORD, f)]));
}

/**
 * WHAT ONE HOLDER OF THE CAST IS SENT (E06 C3, 27.09.2026; audit S04-01). Until 1.2.65
 * every holder was sent the record whole but for the swing memo (Stage 6's business on
 * the GM's side), and more of it was not every holder's to keep:
 *   - `lastCrisis`, the Reroll receipt, with a snapshot of the incident in it. Only a GM
 *     judges an undo (`crisisUndoRefusal`, asked by the GM's own Reroll, reroll.mjs
 *     `replayRefusal`, since E08+E28 C4a), so every copy holds it null - and since
 *     fix r2-G2 (the round-2 review's S2-m3) its stamp is a withheld field's
 *     (`castPacket`): it was the time of the fight's last action, sent to a trap's
 *     builder let in at Stage 6.
 *   - In a trap, the builder. A holder who is not on the killers' side (`killerIds`) -
 *     the victim, a third who did not throw in with them - holds `killerId` and
 *     `killerTurnId` null: the trap's victim reads their incident from their copy
 *     (`incidentSeats`, the Event card), and with the builder in it their Event card
 *     read "builder against victim".
 *   - The betrayal offer: null but in the copy of the third it is offered to, who needs
 *     it to turn on them (`betrayalTarget`). Until E06's fix r1-G4 (28.09.2026) that
 *     was a trap's rule only, and the offer outlives its incident (D18): a direct
 *     murder opened the same day sent every one of its seats the earlier offer - who
 *     may turn on whom, the earlier killer named (the other half of the review's m4).
 *   - A holder who is in the cast for the offer alone - its third, when the incident
 *     running now is not theirs - is sent the offer and nothing else (the round-1
 *     review's m4). `castOwners` seats
 *     the offer's third so the offer reaches their browser, and until the same fix they
 *     were sent the next incident whole: for a direct one, its killer and its victim,
 *     from its opening roll on. Read off `castFor` in the suite, red at d9d6ee2 ("a
 *     standing betrayal offer ..."); the packet is `sendCast`'s, which sends this.
 * A direct murder keeps the killer's name in every copy: it is fought face to face (D6).
 * The builder's own copy, from Stage 6 on (`castOwners`), keeps every name.
 * THE FIGHT IS IN THE COPY OF EVERY HOLDER WHO FOUGHT IT (E32 C2, 28.09.2026; fix r1-G1,
 * 29.09): the fields of `INCIDENT_FIGHT`, which left the world half then, go to each holder
 * who holds a seat at `incident` as they are - both sides' panels and trackers read them,
 * and none of them names anyone - but two:
 *   - The Key Remnants' count, null in every copy (the review's m1). It is what the
 *     opening roll bought - 5 on Hope, 4 on Despair, 3 on a critical - and what Stage 4
 *     bought is the GMs' alone; every reader of it runs on a GM's browser (the dashboard,
 *     the checklist, the tracker, a GM whisper - grep of 29.09). In a direct murder's
 *     victim's copy it was the band of a roll they are not shown (D6), and in a third's
 *     how many Key Remnants there are to find.
 *   - All of it, for a holder seated only after the fight (the review's M2): a trap's
 *     builder, and a third on their side, who hold no seat at `incident` and one from
 *     Stage 6 on. E06 keeps every roll of a trap's fight from its builder, and the fight is
 *     those rolls' results: `drainStopped` is a critical Self-defence, `advantageNext` a
 *     failure with Hope. Nothing of theirs at Stage 6 reads it (the Event card draws at
 *     `incident` alone, events.mjs). Nor, when their copy seats no third, the third's
 *     seat and side, whose stamps timed a third's arrival and leaving (fix r2-G2,
 *     03.10.2026; the round-2 review's S2-m3): held null, as the third is, and stamped
 *     as the rest of what is withheld.
 * Who walked into the fight and out of it (`departed`, E32+E07 C10), null in every copy:
 * its readers are the primary GM's (`maybeThirdParty`, `thirdPartyEnters`), and until fix
 * r2-G2 (the round-2 review's S2-m1) a third seated after another left was sent who had
 * walked in and out before they came - the one holder for whom it was news.
 * The opening's statistic (`openingTrait`, E32+E07 C11c), null in every copy: a GM's pick
 * for a roll a direct murder's victim is not shown (D6) and a trap's builder is not shown
 * either, and the one player who rolls it is sent it with the invitation
 * (gm-bridge.mjs `askOpeningRoll`). Every reader of it runs on a GM's browser.
 * Who struck a critical Finishing blow (`freeCleanup`, E32+E07 C13), null in every copy but
 * the killers': the GM's charge spends it (cleanup.mjs `consumeFreeCleanup`), and since fix
 * r2-G3 (03.10.2026; the round-2 review's C2-m1) the striker's own browser quotes the attempt
 * free by it (`tamperQuote`) - before that a striker whose bar the blow filled was refused
 * the attempt it paid for. The killers' and not the striker's alone: the spend writes null,
 * and a copy that withheld null would stamp it as the newest of what it shows, which the
 * spend does not move, so the striker's browser would not take it and keep quoting a spent
 * grant (castCombine on the two packets, tier 2's free clean-up test). The critical itself
 * was rolled in front of the incident's seats.
 * The fight's last turns (`recent`, E32+E07 C17), null in every copy too: the GM's tracker
 * is their one reader, and each names who acted, what they rolled and what it cost - a
 * history of the fight no seat's panel draws.
 * A holder seated for the offer alone is sent the offer alone, the fight not included.
 *
 * THE VALUES ARE NULLED, and what their stamps say is `castPacket`'s. A third who moves to
 * the killers' side moves `thirdSide`'s stamp with them, so the copy they are sent next
 * is newer in that part and taken whole (read off `castCombine`, not measured on its
 * own). "Not in it" (`{}`) stays `{}`. The world half is read for `indirect` as
 * `castOwners` reads it. GM-side; exported for the suite.
 */
export function castFor(userId, cast, state = null) {
    return castCopyFor(userId, cast, state).copy;
}

/** `castFor`'s copy, and the fields it holds null for this holder's sake (`castPacket` stamps them). */
function castCopyFor(userId, cast, state = null) {
    const { swung, sent, openingNotices, ...theirs } = cast ?? {};
    if (!Object.keys(theirs).length) return { copy: theirs, withheld: [] };
    const live = state ?? game.settings.get(MODULE_ID, SETTINGS.murderState) ?? {};
    const seen = { ...live, ...theirs, indirect: incidentIndirect(theirs, live) };
    const owns = id => Boolean(id) && ownerOf(game.actors.get(id))?.id === userId;
    const offer = theirs.betrayal && owns(theirs.betrayal.thirdId) ? theirs.betrayal : null;
    if (!incidentAudienceIds(seen).includes(userId)) return { copy: offer ? { betrayal: offer } : {}, withheld: [] };
    const copy = { ...theirs, lastCrisis: null, ...("betrayal" in theirs ? { betrayal: offer } : {}) };
    const afterFight = !incidentAudienceIds(seen, { stage: "incident" }).includes(userId);
    const killer = killerIds(theirs).some(owns);
    const withheld = [...(afterFight ? [...INCIDENT_FIGHT, ...(copy.thirdId ? [] : ["thirdId", "thirdSide"])] : ["keyRemnants"]),
        "lastCrisis", "departed", "openingTrait", ...(killer ? [] : ["freeCleanup"]), "recent"];
    for (const f of withheld) if (Object.hasOwn(copy, f)) copy[f] = null;
    if (!seen.indirect || killer) return { copy, withheld };
    return { copy: { ...copy, killerId: null, killerTurnId: null }, withheld };
}

/**
 * WHAT ONE HOLDER'S PACKET SAYS BY ITS STAMPS (fix r1-G1, 29.09.2026; the review's M1, M2,
 * m1). A copy takes a packet only when it is at least as new in every part and newer in
 * one (gm-stores.mjs `castCombine`), and the cast stamps a field only when its value
 * changes (`changedOnly`) - so a stamp that moves is a result, whatever the value beside
 * it says. Until this fix every packet but "not in it" carried the record's stamp for
 * every field:
 *   - "Not in it" (`{}`) and the offer alone are statements about the seats, and carry
 *     the seats' stamps alone (`CAST_SEATS`). The offer alone carried all of them: the
 *     review's run (91-sec-r1-offer, 28.09) sent the offer's third, standing by while a
 *     second incident ran, six packets holding the offer alone, whose stamps moved field by
 *     field - `keyRemnants` and `deniedToVictim` together are an opening on Despair,
 *     `advantageNext` a failure with Hope.
 *   - A field the copy holds null for this holder's sake (`castCopyFor`: the Key Remnants'
 *     count, a trap's fight for its builder) is stamped with the newest stamp of the fields
 *     it shows. That moves only when they do, so it tells nothing they do not; and as each
 *     of them only grows it only grows, so a copy that takes the packet on the fields it
 *     shows takes it on these as well. The record's stamp of `keyRemnants` alone told
 *     Hope (unmoved) from a critical (moved, nothing denied to the victim).
 * The rest is the record's stamps. GM-side; exported for the suite (the grid's I2).
 */
export function castPacket(userId, cast, { state = null, stamps = castStamps() } = {}) {
    const { copy, withheld } = castCopyFor(userId, cast, state);
    if (aboutSeats(copy)) return { cast: copy, stamps: Object.fromEntries(CAST_SEATS.map(f => [f, stamps?.[f] ?? 0])) };
    const out = { ...stamps };
    const shown = Math.max(0, ...Object.entries(out).filter(([f]) => !withheld.includes(f)).map(([, s]) => s ?? 0));
    for (const f of withheld) out[f] = shown;
    return { cast: copy, stamps: out };
}

/** A copy that holds nothing, or the betrayal offer alone: a statement about the seats. */
const aboutSeats = copy => Object.keys(copy ?? {}).every(f => f === "betrayal");

/**
 * A STANDING PACKET IS SENT ONCE, AND AN ANSWER REPEATS IT (fix r1-G1, 29.09.2026; the
 * review's M1, and the seat half its "outside this stage" routed here). A packet that
 * holds nothing or the offer alone carries the seats' stamps, and those move with the
 * incident running now: a Role reversal that held stamps `killerId` and `victimId`, a
 * third walking in or away `thirdId`. Pushed on every write, and answered whenever a
 * console asks, they timed that incident for a browser that stands outside it. So a push
 * does not send a player a standing packet that is what they were last sent - the same
 * value, the offer's own stamp unmoved - and an answer sends them that packet again as it
 * was. Stamps sent once are no newer than the record's now, so a copy that takes the
 * repeat would have taken a fresh one as well: the merge's soundness does not move.
 *
 * WHAT EACH PLAYER WAS LAST SENT IS THE GMS' RECORD'S, NOT ONE BROWSER'S (fix r2-G2,
 * 03.10.2026; the round-2 reviews' S2-m2 and C2-m6). Until this fix it was a Map on the
 * browser that sent it, and every player's first answer after a GM's browser opened was
 * the record's seats as they stood - and every player asks when a primary GM's world has
 * loaded (`drpgPrimaryReady`). The review measured it (92, 03.10): a GM that sorts first
 * connecting mid-fight sent the offer's third, unasked, `killerId` and `victimId` stamped
 * at a Role reversal that held, and a player connecting after it read the same. So:
 *   - The memo is `sent` of the cast record (gm-stores.mjs), a stamp per user: on every
 *     GM, across a reload and a change of primary, backed up and reset with the cast.
 *     It holds the standing packet a player was last sent, or `FULL_COPY` once they are
 *     sent a seat's copy - after which a standing packet is a change they see happen (they
 *     leave the fight, it closes), sent at the record's stamps as before.
 *   - A standing packet sent to a player whose memo is standing or empty is stamped so
 *     that its seats tell no more than the running incident's opening (`standingStamps`),
 *     and a player the memo has never seen is answered so too.
 *   - A push writes the memo, an answer does not: an answer is the same reading of the
 *     record each time until something is pushed, and the first run of this fix, which
 *     wrote one for every player's ask at load, set two GMs' stores apart that 61 A5
 *     reads as equal.
 * A player's ask before and after a Role reversal reads the same packet, and a GM that
 * connects mid-fight repeats it (19-standing-cast R1, W1, F1 and F2, each red at 7ae1951).
 * What is left, read and not measured: the memo is a store write like any other, flushed
 * a moment later, and a GM's browser that closes before its store flushes takes the last
 * one with it - the next standing packet to that player is then stamped as one to a
 * player never sent anything.
 */
const FULL_COPY = Object.freeze({ full: true });

function sendCast(userId, cast, stamps, state = null, { answer = false, leaving = false } = {}) {
    // While tier 2 holds the stores the cast is a fixture's: no participant is sent it (R2-M1).
    if (gmStoresQuiet()) return;
    let packet = castPacket(userId, cast, { state, stamps });
    const last = castStore.record()?.sent?.[userId] ?? null;
    if (aboutSeats(packet.cast)) {
        if (last?.cast && stableJson(last.cast) === stableJson(packet.cast)
            && (last.stamps?.betrayal ?? 0) === (packet.stamps?.betrayal ?? 0)) {
            if (!answer) return;
            packet = last;
        } else if (!last?.full && !(leaving && !last)) {
            packet = { cast: packet.cast, stamps: standingStamps(packet.stamps, last, state) };
        }
    }
    const memo = aboutSeats(packet.cast) ? { cast: packet.cast, stamps: packet.stamps } : FULL_COPY;
    if (!answer && stableJson(memo) !== stableJson(last)) rememberSent(userId, memo);
    try {
        game.socket.emit(SOCKET_EVENT, { action: CAST_MINE, cast: packet.cast, stamps: packet.stamps }, { recipients: [userId] });
    } catch (err) {
        error("Could not deliver an incident cast to a participant", err);
    }
}

/**
 * The memo's one write (`sendCast`). Outside the incident's queue on purpose (R205 reads it
 * so): `sent` is not the incident's, a push runs inside the queue and an answer outside
 * it, and a write queued from inside the queue would wait on itself.
 */
function rememberSent(userId, memo) {
    castStore.patch(RECORD, { sent: { [userId]: memo } })
        .catch(err => error("Could not keep what a participant was sent of the incident's cast", err));
}

/**
 * The seats' stamps of a standing packet for a player who has not been sent a seat's copy
 * since their last standing one (`last`, or none): no older than that one's, so a copy
 * that holds it takes this, and while an incident runs no newer than its opening, which
 * stamped every seat at once - the opening is the world's to see, a Role reversal or a
 * third walking in after it is not. A player the memo has never seen holds at most an
 * earlier incident's copy, at or under that opening. The offer keeps its own stamp. A
 * player leaving the fight now (`leaving`) whom the memo has never seen is sent the
 * record's: they may hold a seat's copy newer than the opening.
 */
function standingStamps(stamps, last, state = null) {
    const live = state ?? game.settings.get(MODULE_ID, SETTINGS.murderState) ?? {};
    const opened = live.active ? castStore.stampOf(RECORD, "openedAt") : 0;
    return Object.fromEntries(Object.entries(stamps ?? {}).map(([f, s]) => [f, f === "betrayal" ? s
        : Math.max(last?.stamps?.[f] ?? 0, opened ? Math.min(s ?? 0, opened) : s ?? 0)]));
}

/**
 * The cast as this GM last saw it told, and its stamps, so a merge that changes them is
 * told too - kept on every GM, not the primary alone (the round-2 review's R2-m3): a GM
 * that became the primary later took its first change as its baseline and told nobody.
 * It does not move while the suite holds the stores (`tellCastChange`).
 */
let castTold = null;

/**
 * The cast against what the participants were last told, by its stamps: unchanged,
 * nothing; changed, the primary tells it (`pushCastToParticipants`, which keeps the new
 * baseline) - the participants before worked out from the cast it told them - and any
 * other GM keeps it as the baseline. Run on a merge, and once the suite lets the stores
 * go: a change merged while they were held was ignored then (61 F5; `tellDoorChange`
 * in mastermind.mjs says the rest).
 */
function tellCastChange() {
    const now = { stamps: castStamps(), cast: readCast() };
    const was = castTold;
    if (!was) { castTold = now; return; }
    if (JSON.stringify(now.stamps) === JSON.stringify(was.stamps)) return;
    if (isPrimaryGm()) pushCastToParticipants(now.cast, was.cast);
    else castTold = now;
}

/**
 * AFTER A RESTORE (gm-stores.mjs `restoreCase`; the design's 6.2): each participant of
 * the cast this browser holds now is sent it again, at its stamps, and on the primary
 * whoever it last told who is no longer in it an empty one - a copy takes only what is
 * newer (`castCombine`). Nothing for a cast nobody ever wrote, and nothing while the
 * suite holds the stores or stands in another world (`gmStoresQuiet`). Answers how
 * many participants the cast went to.
 */
export function retellCast() {
    if (!game.user?.isGM || gmStoresQuiet()) return 0;
    if (!Object.values(castStamps()).some(s => s > 0)) return 0;
    const cast = readCast();
    pushCastToParticipants(cast, castTold?.cast ?? cast);
    return castOwners(cast).size;
}

/**
 * One write, two stores.
 *
 * The cast goes FIRST. The world half's `onChange` repaints every client, and a
 * participant repainting before their names arrive would draw the bystander's
 * view of their own incident for a frame. The cast's own `onChange` repaints
 * again when it lands, so the worst case is one extra redraw rather than a
 * sheet showing the wrong thing.
 *
 * In the incident's queue (`incidentWrite`, E32 C4): `expect` is what the caller
 * read, and a state that no longer shows it is not written - the answer is null.
 */
export async function writeState(patch, { explicit = [], expect = null } = {}) {
    if (!game.user.isGM) return null;

    return incidentWrite(async () => {
        if (!stillHolds(expect)) return null;

        const publicBefore = game.settings.get(MODULE_ID, SETTINGS.murderState) ?? {};
        const castBefore = readCast();
        const before = { ...publicBefore, ...castBefore };

        const { world: publicPatch, cast: castPatch, neither } = splitIncident(patch);
        if (neither.length) error(`An incident's write named field(s) neither its world half nor its cast holds, kept out of both: ${neither.join(", ")}`);

        const publicNext = { ...publicBefore, ...publicPatch };

        /*
         * THE STAGE IS ALSO A RECIPIENT LIST, and nothing above notices that.
         *
         * `castOwners` seats people by the stage (`incidentSeats`): a trap's killer
         * is left out while the trap runs and let back in at Stage 6, which is how
         * Stage 6 knows the body is theirs to arrange; a direct murder's victim is
         * left out of the opening and seated when the killer's roll succeeds (D6,
         * E06 C2). But a stage change is a public-half patch: a patch that touches no
         * cast field writes no cast, and nobody would be pushed anything. The victim
         * of a direct murder fought the whole incident without a cast while the
         * opening's success moved the stage and world fields alone (read off
         * `resolveKillerOpening`; 13-murder-signals' "direct" reads it). Since E32 C2
         * that patch carries the fight, which is the cast's, and every stage write in
         * this file names a cast field (read on 28.09) - the comparison stays, so a
         * patch of the stage alone cannot bring that back.
         *
         * So the holders are compared across this write, and the participants
         * pushed to when they change. Cheap - a packet per participant on a few
         * transitions in a whole murder. A participant who asked while they held no
         * seat was answered "not in it", which holds the seats' stamps alone; the
         * cast sent now holds the other parts as well, so it is newer (gm-stores.mjs,
         * `castCombine`; R176).
         */
        const castNext = Object.keys(castPatch).length
            ? await writeCast({ ...castBefore, ...castPatch }, castBefore, { explicit, push: false })
            : castBefore;
        /* Until E06 this compared whether a trap was running before and after (`trapRunning`), the
           one gate that moved with the stage; the table has two now, and comparing the holders
           covers both and any row added later. Read as sorted user ids. */
        const holders = (cast, state) => [...castOwners(cast, state)].sort().join();
        const holdersMoved = holders(castNext, publicNext) !== holders(castBefore, publicBefore);

        /*
         * ONE PUSH, WITH THE STATE BEING WRITTEN (E04). The participants are worked out
         * from the cast and the stage after this write, against the cast and the stage
         * before it - still before the world half is written, so the cast arrives first.
         * Pushed from `writeCast` against the stage still in the world, an indirect
         * murder's opening sent its killer the cast, and the "not in it" that followed
         * carried the same stamps and was refused - read off the code; what was
         * measured is 13's "trap: the killer holds no cast", red on the first C6 tree
         * (26.09).
         */
        if (castNext !== castBefore || holdersMoved) pushCastToParticipants(castNext, castBefore, publicNext, publicBefore);
        try {
            await game.settings.set(MODULE_ID, SETTINGS.murderState, publicNext);
        } catch (err) {
            await castPutBack(castBefore, castNext, publicBefore, publicNext);
            throw err;
        }

        const next = { ...publicNext, ...castNext };

        /*
         * THE BETRAYAL'S WINDOW OPENS HERE, AND ONLY HERE (D18).
         *
         * Six different branches move an incident to its resolution stage - a
         * finishing blow, running out, a self-inflicted death, an escape, and two
         * more - and every one that left a body is a moment the accomplice may now
         * turn on the killer (`betrayalCandidate` asks `leftABody`, E32 C6: a Survive
         * or an escape arms nothing). Arming from each would be six copies of one
         * rule, which is the shape this file has already been bitten by twice.
         *
         * `writeState` is the single writer, so it is the single place that can see
         * the transition. Guarded on the CHANGE rather than the state, so the many
         * later writes that happen during a resolution do not re-arm a window the
         * betrayal has already spent.
         */
        if (before.stage !== "resolution" && next.stage === "resolution") {
            try {
                await armBetrayalWindow(next);
            } catch (err) {
                error("Could not open the betrayal window", err);
            }
        }
        return next;
    });
}

/**
 * Give the accomplice the rest of the day to turn on the killer.
 *
 * The candidate test is unchanged - `betrayalCandidate` still decides WHO, and
 * it is asked once, here, at the moment the incident settles. What changed is
 * how long the answer lasts. It used to be read live off the incident, so the
 * offer died with the incident: the accomplice had it while the killer scrubbed
 * the floor and lost it the instant the GM closed Stage 6, which is roughly the
 * moment a player would actually think of it.
 *
 * Stamped with the clock rather than a timestamp. "Until the end of the day" is
 * a fact about this game's calendar, not about wall time, and a table that
 * spends two hours on one evening should get two hours of it.
 */
async function armBetrayalWindow(state) {
    if (!game.user.isGM) return null;
    const killer = game.actors.get(state?.killerId ?? "");
    const third = betrayalCandidate(state, killer);
    if (!killer || !third) return null;

    const clock = getClock();
    // In the cast, never on the actor: the offer names the killer and the
    // accomplice, and an actor flag would name them to every client.
    await writeCast({
        ...readCast(),
        betrayal: {
            thirdId: third.id,
            killerId: killer.id,
            chapter: clock?.chapter ?? 1,
            day: clock?.day ?? 1
        }
    });
    log(`Betrayal window open for ${third.name} against ${killer.name} `
        + `(chapter ${clock?.chapter}, day ${clock?.day}).`);
    return third;
}

/**
 * Shut every betrayal window the calendar has moved past. GM-side.
 *
 * The read below already refuses a stale window, so this is tidying rather than
 * enforcement - but a flag nobody clears is a flag that comes back. A GM who
 * rewinds a day to fix a mistake would otherwise hand somebody a betrayal from
 * a murder two chapters ago, and the sheet would light the tile for it.
 */
export async function sweepBetrayalWindows() {
    if (!isPrimaryGm()) return;
    // Read where it is written, in the incident's queue (E32 C4): an offer armed by a
    // write queued before this one is the offer it reads.
    await incidentWrite(async () => {
        const clock = getClock();
        const cast = readCast();
        const open = cast.betrayal;
        if (!open) return;
        if (open.chapter === clock?.chapter && open.day === clock?.day) return;
        const { betrayal, ...rest } = cast;
        await writeCast(rest, cast);
    });
}

/** Take the betrayal off the table, whoever it was offered to. GM-side. */
export async function clearBetrayalOffer() {
    if (!game.user.isGM) return;
    await incidentWrite(async () => {
        const cast = readCast();
        if (!cast.betrayal) return;
        const { betrayal, ...rest } = cast;
        await writeCast(rest, cast);
    });
}

/** The weapon this actor swung in the running incident, if it is still on them. GM-side. */
export function swungWeaponOf(actor) {
    const id = readCast().swung?.[actor?.id ?? ""];
    return id ? (actor.items.get(id) ?? null) : null;
}

/**
 * Which side is this actor on, if any: "killer" | "victim" | "third" | null.
 * In the running incident, or in `state` - a Reroll's receipt asks about the
 * incident as it stood when the action was taken (gm-bridge.mjs).
 */
export function sideOf(actor, state = murderState()) {
    if (!state || !actor) return null;
    if (state.killerId === actor.id) return "killer";
    if (state.victimId === actor.id) return "victim";
    // A newcomer who has thrown in with one side stops being "the third party"
    // and becomes a participant, so they get that side's crisis actions from
    // their next turn on. `thirdSide` is written by Partners in crime and by
    // Double role reversal; without it they would keep being offered the
    // walked-in-on-a-murder choice they have already made.
    if (state.thirdId === actor.id) return state.thirdSide ?? "third";
    return null;
}

/**
 * Everyone acting as a killer in this incident, in turn order.
 *
 * Usually one. It becomes two when the third party throws in with the killer -
 * Partners in crime, or a double role reversal - and from that moment they are
 * a killer in every sense the rules care about: the same action table, the same
 * side of the turn order, and the same clean-up afterwards.
 *
 * The original killer is always first, so the rotation is stable across writes.
 */
export function killerIds(state = murderState()) {
    if (!state) return [];
    const ids = [state.killerId];
    if (state.thirdId && state.thirdSide === "killer") ids.push(state.thirdId);
    return ids.filter(Boolean);
}

/**
 * Everybody the incident already contains: both killers, the victim, and the
 * one third party who walked in.
 *
 * The set the "somebody walked in" watch measures newcomers against, and the
 * list the incident's own announcements are whispered to. `killerIds` rather
 * than `state.killerId`, so an accomplice who threw in with the killers is not
 * read as a stranger walking into a room they have been standing in for the
 * last ten minutes.
 */
export function participantIds(state = murderState()) {
    const ids = new Set(killerIds(state));
    if (state?.victimId) ids.add(state.victimId);
    if (state?.thirdId) ids.add(state.thirdId);
    return ids;
}

/**
 * Whether this GM's browser holds the running incident's cast (the round-2 review's
 * M1): a turn passed, or a third let in, from a browser that lost it wrote a rotation
 * worked out from nobody. Said to the GM, and pointed at what puts it back.
 */
export function castHeldHere(state) {
    if (!castStore.isHydrated()) {
        ui.notifications.warn(game.i18n.localize("DRPG.Murder.castNotArrived"));
        return false;
    }
    if (state?.killerId && state?.victimId) return true;
    ui.notifications.warn(game.i18n.localize("DRPG.Murder.castMissingHere"));
    return false;
}

/* ==========================================================================
 * WALKING IN ON IT
 * --------------------------------------------------------------------------
 * Guide: "W wypadku, gdy w dowolnym momencie do pomieszczenia w trakcie
 * Incydentu wejdzie strona trzecia poprzez akcję ruch, strona trzecia
 * otrzymuje automatyczny, darmowy wybór między akcjami kryzysowymi rozwiązania
 * bezpośredniej strony trzeciej."
 *
 * "Automatyczny" is the operative word, and it was the one thing the module
 * left to the GM noticing: `thirdPartyEnters` existed but only ever fired from
 * a picker in the incident tracker. So somebody could walk their token straight
 * into a murder in progress and nothing would happen unless a human spotted it
 * on the map - which, during an incident, nobody is watching for.
 *
 * DIRECT MURDERS ONLY. An indirect one has no confrontation to walk in on: the
 * victim is alone with a trap, which is what INCIDENT.drain.indirect models and
 * why `sharedEscape` is written for two people in a room. There is nobody there
 * to be interrupted.
 * ========================================================================== */

/* ==========================================================================
 * KEEPING THE CAST IN STEP
 * --------------------------------------------------------------------------
 * Two conversations on this channel since E04 (1.2.63):
 *
 *   GM  -> participant  one player's copy of the cast, addressed to them, with
 *                       the record's stamp
 *   player -> GM        "I just reloaded, what am I in?", asked of the primary
 *
 * The GMs' own copies - the cast and the Blackened register - are GM stores
 * (gm-stores.mjs): merged field by field between GMs, so the SET and REQUEST
 * pairs that kept the newest whole entry are gone from here.
 *
 * AUTHORITY COMES FROM `senderId`, Foundry's own second argument, and never
 * from anything inside the payload - the same discipline gm-bridge.mjs applies.
 * Without that, a player could emit a cast naming whoever they liked.
 *
 * `game.user?.isGM`, AND THE QUESTION MARK IS NOT DEFENSIVE PADDING. A socket handler is
 * live from the moment it is registered until the page goes away, and `game.user` exists
 * for less than that at both ends. Caught with a stack on 10.09 on a player's client, one
 * run in three of a whole chapter driven end to end:
 *
 *   TypeError: Cannot read properties of null (reading 'isGM')
 *       at murder.mjs (this handler)  <-  I.emit  <-  socket.io
 *
 * It is intermittent because it needs a message in flight while the client is starting or
 * closing, which is why reading the code found nothing and three targeted probes could not
 * reproduce it. `isPrimaryGm` reads it the same way.
 * ========================================================================== */
export function registerIncidentCastSync() {
    /*
     * A PARTICIPANT ASKING WHICH INCIDENT THEY ARE IN, answered by the primary GM
     * alone, about Foundry's own sender, once its store holds the other GMs' copies
     * (E04). Until then every GM answered from its own copy, and a GM whose browser
     * held no cast answered with nothing and emptied the participant's (the cast
     * half of S06-19); a stamp of 0 from a GM holding nothing now replaces nothing.
     * The answer is `castPacket`'s, and a standing one - nothing, or the offer alone -
     * repeats what the asker was last sent (`sendCast`, fix r1-G1 and r2-G2).
     */
    game.socket.on(SOCKET_EVENT, async (payload, senderId) => {
        if (payload?.action !== CAST_MINE_REQUEST || !isPrimaryGm()) return;
        const sender = game.users.get(senderId);
        if (!sender?.active || sender.isGM) return;
        try {
            // Asked while tier 2 holds the stores: answered once it lets them go, from this world's cast (R2-M1).
            await whenGmStoresAudible();
            await castStore.whenHydrated();
            const cast = readCast();
            sendCast(sender.id, castOwners(cast).has(sender.id) ? cast : {}, castStamps(), null, { answer: true });
        } catch (err) {
            error("Could not answer a participant's cast request", err);
        }
    });

    /*
     * The private half: GM -> one participant.
     *
     * A SEPARATE listener, because this is the message a PLAYER client is meant to
     * act on - the same shape mastermind.mjs uses for its door flag, and for the
     * same reason. Foundry's `recipients` already means nobody else's browser
     * receives it; the sender check is what stops a player planting a cast on
     * themselves, and the copy takes only what is newer, part by part
     * (gm-stores.mjs, `castCombine`). The copy's `onChange` repaints (settings.mjs).
     */
    game.socket.on(SOCKET_EVENT, async (payload, senderId) => {
        if (payload?.action !== CAST_MINE) return;
        if (!game.users.get(senderId)?.isGM) return;
        try {
            await castCopy.receive(payload.cast ?? {}, payload.stamps);
        } catch (err) {
            error("Could not record this client's incident cast", err);
        }
    });

    /*
     * A MERGE THAT CHANGES THE CAST IS TOLD TOO, by the primary (the review's B1, as
     * for the Mastermind's door). The GM that wrote tells the participants itself; one
     * that had not merged a newer write sends a copy older in some part, which is
     * refused - so once the primary's store has both, it tells them what the GMs agree
     * on: against the stamps it last told, the participants before worked out from the
     * cast it told them, the stage being the world's own.
     */
    Hooks.on("clientSettingChanged", key => {
        if (key !== `${MODULE_ID}.${SETTINGS.incidentCast}` || writingCast || !game.user.isGM || !gmStoresHydrated() || gmStoresQuiet()) return;
        tellCastChange();
    });
    // What the participants were told is what the store holds once the other GMs' copies are in - on every GM.
    onGmStoresHydrated(() => { if (!castTold && !gmStoresQuiet()) castTold = { stamps: castStamps(), cast: readCast() }; });
    // Once the suite lets the stores go, the cast is held against what the participants were told before it began.
    onGmStoresAudible(() => { if (game.user.isGM && gmStoresHydrated()) tellCastChange(); });

    /*
     * AT READY, NOT AT REGISTRATION (found in the sandbox, 03.09): `registerMurder`
     * runs from `init`, when `game.user` is still null. A participant asks the
     * primary when it loads, and again when a primary GM's world has loaded (the
     * bridge's "a GM is listening" signal, `drpgPrimaryReady`) - one that loaded
     * first asked nobody, and asked on `userConnected` the question reached a GM
     * with no listener yet (E04's fix round, the round-2 review's m4). The lift of
     * the old world data is a migration clause since E04 (`liftIncidentSecrets`,
     * migrate.mjs), no longer run from this hook.
     */
    Hooks.once("ready", () => {
        if (game.user.isGM) return;
        askForCast();
        Hooks.on("drpgPrimaryReady", primary => askForCast(primary));
    });
}

function askForCast(primary = primaryGmId()) {
    if (!primary) return;
    try {
        game.socket.emit(SOCKET_EVENT, { action: CAST_MINE_REQUEST }, { recipients: [primary] });
    } catch (err) {
        error("Could not ask the GM which incident this client is in", err);
    }
}

/** How an incident ends with its victim dead - the endings that kill them themselves (`finishIncident`, `checkVictimSpent`, the close of a self-inflicted death). */
const BODY_ENDINGS = Object.freeze(["finishingBlow", "ranOut", "selfInflicted"]);

/**
 * DID THIS INCIDENT LEAVE A BODY (E32 C6, 28.09.2026; audit S04-11, S04-12)? By how it
 * ended, or by its victim dead for the GMs now. The Blackened (`recordBlackened`), the
 * betrayal's offer (`betrayalCandidate`), the GM's checklist (`afterIncident`) and the
 * participants' notice at the close all ask this one question.
 *
 * The endings are there because each kills its victim AFTER the stage moves - the
 * Finishing blow's death follows its stage write, a self-inflicted death is recorded
 * at the close - and the betrayal's window is armed on that write. Everything else is
 * the death: a victim who died from the Students list is a body whether the GM took
 * Stage 6 (`beginResolution("victimKilled")`, `offerStageSix`) or not. The plan put
 * `victimKilled` among the endings; it is left out, because its one caller asks after
 * the death is recorded, and a Stage 6 with the victim revived before the close - the
 * grid's TR04, which moves a trap to Stage 6 with nobody dead - is no body.
 *
 * `deadNow` is the reader of a death, handed in so R207 can read the rule on made-up
 * states; every caller here leaves it to `isDeadForGm`.
 */
export function leftABody(state, deadNow = id => isDeadForGm(game.actors.get(id ?? ""))) {
    if (!state?.victimId) return false;
    return BODY_ENDINGS.includes(state.endedBy) || Boolean(deadNow(state.victimId));
}

/**
 * Is there somebody who could turn on the killer, and is the killer still alive
 * to be turned on?
 *
 * The newcomer only. `thirdId` survives every branch of the walk-in choice
 * except Averted eyes and a failed Escape together, which null it (`thirdLeaves`)
 * - and rightly: somebody who walked back out is not standing there with an
 * opportunity. Partners in crime and Double
 * role reversal both leave `thirdSide: "killer"`, and a partner turning on
 * their partner is exactly the betrayal the guide names.
 *
 * IN A TRAP, THE ACCOMPLICE ONLY (E06 fix r1-G4, 28.09.2026; the round-1 review's M3).
 * The guide's betrayal is the newcomer turning on "the person beside them", and a
 * trap's builder is beside nobody: a third who walked in on the victim's side never
 * met them. Until this fix they were offered it all the same, and the offer is the
 * one part of their copy of the cast that names the builder (`castFor`) - their
 * Direct murder tile lit and its dialog named the person who set the trap (read
 * off the code, not run), to a player who then sits in the trial. An accomplice holds the builder's name in the
 * whole of their copy anyway. The suite's C3 test asserted the offer; expecting none,
 * it is red at d9d6ee2.
 *
 * AFTER A BODY, AND FOR A THIRD WHO STAYED ON ITS SIDE OR CHOSE NOTHING (E32 C6,
 * 28.09.2026; audit S04-11, S04-12, the owner's Q2 (b)). The guide's betrayal comes
 * "po zabiciu pierwszego oryginalnego uczestnika", and it was offered on every move to
 * Stage 6: after a Survive, and to the third who had just walked the victim out of the
 * room (the grid's TP04 and TP09, red at 0642f1a). A body now (`leftABody`), and a third
 * who threw in with the killer or - in a direct murder - stayed and chose nothing: they
 * met the killer, and the owner ruled they keep it (S04-12's premise rejected). Chose
 * nothing is `thirdActed` unset: Averted eyes and a failed escape leave, Partners and
 * Double role reversal are the killer's side, and Use an item is not a third's (both
 * E32+E07 C10; audit S04-21, S04-33). A third still there on no side who acted is one
 * of an incident running since 1.2.65, which tried Escape together and failed or took
 * Use an item - and an escape tried loses the offer, as it did then.
 */
export function betrayalCandidate(state, killer) {
    if (!state?.thirdId || !killer) return null;
    if (!leftABody(state)) return null;
    if (state.thirdSide !== "killer" && (incidentIndirect(state) || state.thirdActed)) return null;
    const third = game.actors.get(state.thirdId);
    if (!third || third.id === killer.id) return null;
    if (isMonokuma(third)) return null;
    return third;
}

/**
 * THE REQUEST AND THE WAITING LINE GO WHEN THE OPENING DOES (E32+E07 C16, 03.10.2026;
 * audit S02-30). The killer's notice "This roll is yours" stayed in the corner of their
 * screen through the whole of the victim's first turn, beside a panel that said only that
 * the incident was waiting for them: a request for a roll already made, under no answer.
 * The result reaches the roller by its own card (`announceOpening`); the request and C11c's
 * line that the GM is picking its statistic are deleted as the opening resolves, or is
 * taken back (`revokeOpeningInvitation`), and a notice drawn from a deleted card goes with
 * it (popup.mjs).
 *
 * THE IDS ARE THE GMS' (E32+E07 fix r2-G4, 03.10.2026; the correctness review's m3). Until
 * this fix they were kept in a Set on the browser that posted the cards, and a player's result
 * is judged on the primary GM alone (gm-bridge.mjs `handleOpeningResult`): a murder opened on
 * another GM, a re-ask from one, or the posting GM's reload left the deciding browser's Set
 * empty, and "This roll is yours" stayed through the fight (scenario 61 F9: a second GM's
 * re-ask stayed on the killer's player's browser after the primary closed the murder). They
 * are kept in the cast's `openingNotices` now, an id a key, which every GM's browser holds and
 * a reload reads back, and whichever GM resolves, takes back or closes deletes them all. Not
 * a flag on the cards: while an incident runs a player's card is veiled (secret.mjs
 * `incidentVeils`), its document addressed to every browser, and a flag there would tell every
 * player that an opening roll is out (read off `postSecret`, not run). The memo's one writer runs outside the incident's queue,
 * as `rememberSent` does (R205): the request goes out from inside it and from outside.
 */
function rememberOpeningNotices(notices) {
    return castStore.patch(RECORD, { openingNotices: notices })
        .catch(err => error("Could not keep the opening's request cards for the GMs", err));
}

export function keepOpeningNotice(message) {
    if (message?.id) void rememberOpeningNotices({ [message.id]: true });
}

export async function retireOpeningNotices() {
    const ids = Object.keys(castStore.record()?.openingNotices ?? {});
    if (!ids.length) return;
    for (const id of ids) {
        try {
            await game.messages.get(id)?.delete();
        } catch {
            // A card another GM cleared first is not a problem.
        }
    }
    // The whole memo at once: a card another GM posts after this stamp is kept.
    await rememberOpeningNotices(null);
}
