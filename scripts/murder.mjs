/**
 * Danganronpa RPG - the murder engine.
 * ---------------------------------------------------------------------------
 * Guide, pp. 17–27. The murder is the one part of this game the rules treat as
 * exceptional, and it is the only place where two players roll against each
 * other turn by turn.
 *
 * The shape of it:
 *
 *   Stage 4  two opening rolls. The killer's decides whether the incident
 *            happens at all and HOW MANY Key Remnants it leaves - the better
 *            the roll, the fewer clues. The victim's decides whether they
 *            sense it coming.
 *   Stage 5  the incident. The victim always moves first, and every turn costs
 *            them Sanity until it runs out and then Health. Both sides pick crisis
 *            actions; a third party who walks in gets a free one.
 *   Stage 6  resolution. The killer cleans up - and now, for the first time,
 *            can see the Remnants they left.
 *
 * WHAT IS AUTOMATED AND WHAT IS NOT. The module owns the numbers: thresholds,
 * the drain, turn order, damage, which Remnants each outcome leaves, who is
 * hindered and for how long. It does not own the prose. "The victim takes
 * something of the killer's and makes evidence of it" is a sentence a person
 * finishes, so each outcome's text goes to the GM and the table rather than
 * being invented here.
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

import {
    MODULE_ID, FLAGS, MURDER_OPENING, INCIDENT, CRISIS_ACTIONS, KEY_REMNANTS,
    RESOLUTION_STRESS_COST, RESOLUTION_HEALTH_COST, TRAITS, callEffect, TIMING
} from "./config.mjs";
import { isMonokuma } from "./monokuma.mjs";
import { SETTINGS, incidentCast, incidentIndirect, incidentSeats, seasonEpoch, isDeadForGm, isDeceased } from "./settings.mjs";
import { castStore, blackenedStore, castCopy, deathStore, deathCopy, CAST_FIELDS, CAST_SEATS, INCIDENT_METHOD, INCIDENT_FIGHT } from "./gm-stores.mjs";
import { RECORD, onGmStoresHydrated, gmStoresHydrated, gmStoresQuiet, whenGmStoresAudible, onGmStoresAudible, gmStoreStamp } from "./gm-store.mjs";
import { getClock } from "./clock.mjs";
import { resourceValue, resourceMax, marksOf, reserveOf, reserveChange, reserveNote } from "./character.mjs";
import { youOrThem } from "./secret.mjs";
import { automatedUpdate } from "./resource-guard.mjs";
import { carriedFor, ITEM_FLAGS, isBroken, isStashed, servesAs, wearOf } from "./inventory.mjs";
import { equippedFor, breakOnDespair, isEquipped, readiedItems, EQUIPPED_FLAG } from "./use-items.mjs";
import { dropRemnant, traceFeedback } from "./remnants.mjs";
import { keepLive, closeOpen } from "./live.mjs";
import {
    announce as announcePlain, dialogContent, tableDialog, whisperToGms,
    whisperToOwner as whisperToOwnerPlain, ownerOf, ownerIdsOf, gmIds,
    isPrimaryGm, primaryGmId, log, warn, error, plural, debug, esc} from "./utils.mjs";

/*
 * VEILED, ALL OF THEM (LIVE-001, the closing half).
 *
 * Every private card this file posts is about an incident, and an incident's
 * cast is exactly what a card's speaker and recipient list would spell out to
 * a bystander reading `game.messages` - the words were moved off the document
 * (secret.mjs), the addressing was not. `veiled` gives the document a neutral
 * speaker and the whole table as its audience; the words still reach only the
 * people named here. The two helpers below are the plain ones with that set,
 * so no call site in this file can forget.
 */
const whisperToOwner = (actor, content, extra = {}) =>
    whisperToOwnerPlain(actor, content, { veiled: true, ...extra });
const announce = data =>
    announcePlain(data?.whisper?.length ? { veiled: true, ...data } : data);


const DialogV2 = foundry.applications.api.DialogV2;

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

const SOCKET_EVENT = `module.${MODULE_ID}`;
/** GM -> one participant, and nobody else. */
const CAST_MINE = "incident.myCast";
/** A participant's client catching up after a reload, or when a GM connects. */
const CAST_MINE_REQUEST = "incident.myCastRequest";

/**
 * What this client knows about who is in the incident. `{}` for a bystander.
 * The GMs' record, or a participant's copy (settings.mjs, `incidentCast`, E04).
 */
function readCast() {
    return incidentCast();
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
async function writeCast(next, previous = readCast(), { explicit = [], push = true } = {}) {
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

/** While this module's own write of the cast is in flight: its change event is not a merge. */
let writingCast = 0;
async function ownCastWrite(write) {
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
 * and the leaves they call (`writeCast`, `armBetrayalWindow`) never call a transition
 * or queue a write of their own, so the chain cannot wait on itself: R205 reads that
 * off the source.
 *
 * PER BROWSER. A second GM's button runs its own queue on its own browser; the stores'
 * stamps settle what the two GMs wrote, and nothing here orders them. Not measured -
 * the harness has one GM (LIVE-E07-10).
 */
let incidentWrites = Promise.resolve();
function incidentWrite(write) {
    const run = incidentWrites.then(() => write());
    incidentWrites = run.catch(() => null);
    return run;
}

/** Does the incident this browser holds still show each field of `expect` (null for absent)? */
function stillHolds(expect) {
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
 */
async function restoreState(state = {}, { keep = [], expect = null } = {}) {
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

        await ownCastWrite(() => castStore.resetRecord(cast, { keep }));
        // Who holds it before and after, by the state before and the one written next.
        pushCastToParticipants(readCast(), previous, rest, publicBefore);
        await game.settings.set(MODULE_ID, SETTINGS.murderState, rest);
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
function castOwners(cast, state = null) {
    const live = state ?? game.settings.get(MODULE_ID, SETTINGS.murderState) ?? {};
    return new Set(incidentAudienceIds({ ...live, ...cast, indirect: incidentIndirect(cast, live) }, { betrayal: true }));
}

/**
 * Each participant gets their copy of the cast (`castFor`); everyone who has left it
 * gets an empty one.
 */
function pushCastToParticipants(cast, previous, stateNow = null, statePrev = null) {
    const now = castOwners(cast, stateNow);
    const before = castOwners(previous, statePrev ?? stateNow);

    // The stamps of the record's fields (E04; the review's B1): a copy takes only what is newer.
    const stamps = castStamps();
    // While the stores are quiet nothing goes out, and what the participants were told stays (`tellCastChange`).
    if (!gmStoresQuiet()) castTold = { stamps, cast };
    for (const userId of before) {
        if (!now.has(userId)) sendCast(userId, {}, stamps);
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
 *     judges an undo (`crisisUndoRefusal`, asked by bridge-guards.mjs on the GM's
 *     browser), so every copy holds it null.
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
 *     `incident` alone, events.mjs). Nor who walked into the fight and out of it
 *     (`departed`, E32+E07 C10): a cast field beside the fight, held null with it.
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
    const { swung, ...theirs } = cast ?? {};
    if (!Object.keys(theirs).length) return { copy: theirs, withheld: [] };
    const live = state ?? game.settings.get(MODULE_ID, SETTINGS.murderState) ?? {};
    const seen = { ...live, ...theirs, indirect: incidentIndirect(theirs, live) };
    const owns = id => Boolean(id) && ownerOf(game.actors.get(id))?.id === userId;
    const offer = theirs.betrayal && owns(theirs.betrayal.thirdId) ? theirs.betrayal : null;
    if (!incidentAudienceIds(seen).includes(userId)) return { copy: offer ? { betrayal: offer } : {}, withheld: [] };
    const withheld = incidentAudienceIds(seen, { stage: "incident" }).includes(userId) ? ["keyRemnants"] : [...INCIDENT_FIGHT, "departed"];
    const copy = { ...theirs, lastCrisis: null, ...("betrayal" in theirs ? { betrayal: offer } : {}) };
    for (const f of withheld) if (Object.hasOwn(copy, f)) copy[f] = null;
    if (!seen.indirect || killerIds(theirs).some(owns)) return { copy, withheld };
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
 * The packet this GM last sent each player (`sendCast`), by user id, for as long as this
 * browser is open.
 *
 * A STANDING PACKET IS SENT ONCE, AND AN ANSWER REPEATS IT (fix r1-G1, 29.09.2026; the
 * review's M1, and the seat half its "outside this stage" routed here). A packet that
 * holds nothing or the offer alone carries the seats' stamps, and those move with the
 * incident running now: a Role reversal that held stamps `killerId` and `victimId`, a
 * third walking in or away `thirdId`. Pushed on every write, and answered whenever a
 * console asks, they timed that incident for a browser that stands outside it. So a push
 * does not send a player a standing packet that is what this GM last sent them - the same
 * value, the offer's own stamp unmoved - and an answer sends them that packet again as it
 * was. Stamps a GM sent once are no newer than the record's now, so a copy that takes
 * the repeat would have taken a fresh one as well: the merge's soundness does not move.
 * What moves is how late: a copy a repeat does not reach (it holds something newer from
 * another GM) keeps it until the next change - which is why a GM forgets what it sent
 * whenever another GM's write is merged here while it is not the primary
 * (`tellCastChange`), and after a restore (`retellCast`). What is left: the first answer
 * after a GM's browser opens is the record's seats as they stand.
 */
const castSent = new Map();

function sendCast(userId, cast, stamps, state = null, { answer = false } = {}) {
    // While tier 2 holds the stores the cast is a fixture's: no participant is sent it (R2-M1).
    if (gmStoresQuiet()) return;
    let packet = castPacket(userId, cast, { state, stamps });
    const last = castSent.get(userId);
    if (last && aboutSeats(packet.cast) && JSON.stringify(last.cast) === JSON.stringify(packet.cast)
        && (last.stamps?.betrayal ?? 0) === (packet.stamps?.betrayal ?? 0)) {
        if (!answer) return;
        packet = last;
    }
    castSent.set(userId, packet);
    try {
        game.socket.emit(SOCKET_EVENT, { action: CAST_MINE, cast: packet.cast, stamps: packet.stamps }, { recipients: [userId] });
    } catch (err) {
        error("Could not deliver an incident cast to a participant", err);
    }
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
    else {
        castTold = now;
        // What this GM sent is not what the players hold any more (`castSent`).
        castSent.clear();
    }
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
    castSent.clear();
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
async function writeState(patch, { explicit = [], expect = null } = {}) {
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
        await game.settings.set(MODULE_ID, SETTINGS.murderState, publicNext);

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
async function sweepBetrayalWindows() {
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
 * Is it this actor's turn to act?
 *
 * A third party is deliberately outside the turn order. The guide gives
 * whoever walks in on an incident ONE free action, and "free" here means
 * exactly that: it does not wait for a turn and it does not consume one. Since
 * `turnSide` only ever holds "victim" or "killer", asking whether it equals
 * "third" is always false - which meant the third party was told they had a
 * free action and then refused with "not your turn" every time they tried to
 * use it. They may act while they still have that action, and not after.
 *
 * TWO KILLERS SHARE A SIDE, NOT A TURN. `turnSide === "killer"` was true for
 * both of them at once, so an accomplice doubled the killers' output: on every
 * killer turn each of them could act, and from the victim's chair it read as
 * one of them taking two turns in a row. `killerTurnId` names which of the two
 * this turn belongs to, and `passTurn` alternates it - so a round with an
 * accomplice runs victim, killer, victim, accomplice, and the side still gets
 * one action per turn however many people are standing on it.
 */
export function isTheirTurn(actor) {
    const state = murderState();
    if (!state || state.stage !== "incident") return false;
    const side = sideOf(actor);
    if (side === "third") return !state.thirdActed;
    if (state.turnSide !== side) return false;
    if (side !== "killer") return true;

    const killers = killerIds(state);
    if (killers.length < 2) return true;
    return (state.killerTurnId ?? killers[0]) === actor.id;
}

/** Crisis actions this actor may take right now, with their hindered flags. */
/**
 * Is this side sitting on a critical Self-defence's free action right now?
 *
 * G-18. One question, asked from three places - the panel that draws the tiles,
 * the guard that lets one be pressed, and the resolver that scores it - so it
 * is written once. Splitting it was how "the tile says free and the click asks
 * for dice" would happen.
 *
 * THE ROUND STAMP IS THE EXPIRY. `state.turn` only advances when play comes
 * back to the victim (see `passTurn`), so "the same turn number" is exactly the
 * guide's "this turn" and needs no clean-up pass of its own - the grant lapses
 * by arithmetic, like an expired motive.
 */
export function freeResolutionFor(side, state = murderState()) {
    const grant = state?.freeResolution;
    if (!grant || grant.side !== side) return null;
    return grant.turn === state.turn ? grant : null;
}

/**
 * Advantage and disadvantage that belong to the situation rather than to a Call, as
 * dice (+1 each advantage, -1 each disadvantage): a hindered action, a weapon in hand,
 * a second try after a miss, a trap's victim. Pure; the roll arms what this returns.
 *
 * THE SECOND TRY IS THE ACTION'S, NOT THE SIDE'S (E32+E07 C9, 28.09.2026; audit S04-32).
 * "Advantage on the next attempt" was a flag per side, so a Leave a clue missed with Hope
 * paid for the victim's next action whatever it was - a Self-defence at 18 as well as the
 * clue at 12. `advantageNext[side]` names the action it was earned on now, and only that
 * action is helped. A `true` from an incident running since 1.2.65 still reads as before,
 * for any action, once.
 */
export function crisisSituational(actor, key, state = murderState()) {
    const side = sideOf(actor, state);
    const def = CRISIS_ACTIONS[key];
    if (!state || !def) return 0;
    let situational = 0;
    if ((state.hindered?.[side]?.[key] ?? 0) > 0) situational -= 1;
    const earned = state.advantageNext?.[side];
    if (earned === key || earned === true) situational += 1;
    if (def.weaponAdvantage && hasWeapon(actor)) situational += 1;
    if (def.unarmedDisadvantage && !hasWeapon(actor)) situational -= 1;
    // Guide, p. 20: "Ofiara otrzymuje advantage na kazdy rzut." Dying alone to a
    // trap is the one situation the guide compensates outright, and it applies
    // to every crisis roll they make rather than to a particular action.
    if (side === "victim" && state.indirect) situational += 1;
    return situational;
}

/**
 * Whether an action of the crisis table is one this side may take: its own side's, and
 * `both` for the two sides of the fight.
 *
 * NOT FOR THE THIRD (E32+E07 C10, 02.10.2026; audit S04-33). `both` was read as "anybody
 * in the incident", so a third who had just walked in was offered Use an item beside
 * their four choices, and taking it spent their one free choice (`thirdActed`) on a roll
 * none of the four is - the grid's TP13, red at ac5ae66 (e32run/g5f). The guide gives the newcomer
 * that one choice and nothing else; the sheet's item button already treated a third as
 * outside the fight (sheet.mjs `inCrisis`). The panel and the GM's judgement
 * (`crisisRefusal`) both ask this.
 */
function forSide(def, side) {
    return def?.side === side || (def?.side === "both" && side !== "third");
}

/** Whether THIS action is the one that free take can be spent on. */
function isFreeTake(def, side, state) {
    return Boolean(def?.kind === "resolution" && !def.noRoll && freeResolutionFor(side, state));
}

export function availableCrisisActions(actor) {
    const state = murderState();
    const side = sideOf(actor);
    if (!state || state.stage !== "incident" || !side) return [];

    // Their one free choice, once made, is made.
    //
    // `isTheirTurn` already refuses a second one, but this list is what the
    // crisis panel DRAWS, and it kept drawing four live tiles for somebody who
    // had already chosen - every one of which would be refused on click.
    // Measured after a failed Escape together: `thirdActed` true, `isTheirTurn`
    // false, four options still offered.
    if (side === "third" && state.thirdActed) return [];

    const hindered = state.hindered?.[side] ?? {};
    const blocked = state.blocked?.[side] ?? {};
    const unlocked = new Set(state.unlocked ?? []);
    const spent = new Set(state.spent ?? []);

    return Object.entries(CRISIS_ACTIONS)
        // `both` is a real side, and only one action has it: using an item is
        // the same act whoever is doing it. Everything downstream that needs to
        // know WHOSE turn this is asks `sideOf(actor)` instead - see
        // `resolveCrisisAction`.
        .filter(([, def]) => forSide(def, side))
        // The guide takes Role Reversal away from a victim whose killer opened
        // on a Despair success.
        .filter(([key]) => !(state.deniedToVictim ?? []).includes(key))
        .map(([key, def]) => {
            const locked = Boolean(def.lockedUntil && !unlocked.has(key));
            return {
                key,
                def,
                // G-18: no dice on this one, and the tile should say so before
                // it is pressed rather than after. Still false while the action
                // is locked - a free take is worth nothing on a door that has
                // not been opened yet.
                free: !locked && isFreeTake(def, side, state),
                // The number to beat, computed here rather than read off `def`
                // by the sheet: a Finishing Blow's threshold is not a constant,
                // it falls as the victim runs out of Health. `null` for the three
                // decisions that have no dice at all.
                threshold: def.noRoll
                    ? null
                    : (key === "finishingBlow" ? finishingBlowThreshold(state) : def.threshold ?? null),
                hindered: (hindered[key] ?? 0) > 0,
                // Self-defence gates the victim's two ways out, and closes
                // itself once it lands. `blocked` already means "you may not
                // press this", so both reasons fold into it - and each carries
                // its own explanation for the tooltip.
                blocked: (blocked[key] ?? 0) > 0 || locked || spent.has(key),
                // In the list, out of the grid (trap 65). Kept in the list on
                // purpose: `takeCrisisAction` reads this same list for its
                // locked/spent guards, so filtering it out here would leave
                // those guards looking at nothing. The panel skips it.
                hidden: Boolean(def.hidden),
                locked,
                spent: spent.has(key),
                lockedBy: def.lockedUntil ? CRISIS_ACTIONS[def.lockedUntil]?.label ?? null : null
            };
        });
}

/* ==========================================================================
 * STAGE 4 - THE OPENING
 * ========================================================================== */

/**
 * Which night/day note the GM gets when a murder opens.
 *
 * Only one side rolls Stage 4, so only one side can be modified - telling the GM
 * about "the killer's advantage and the victim's disadvantage" described a pair
 * of rolls that never both happen.
 */
function nightNoteKey(indirect) {
    if (!atNight()) return "DRPG.Murder.dayNote";
    return indirect ? "DRPG.Murder.nightNoteIndirect" : "DRPG.Murder.nightNoteDirect";
}

/** Is it night? Whichever side rolls Stage 4 is modified by the answer. */
function atNight() {
    const t = getClock().timeOfDay;
    return t === "night" || t === "Night";
}

/**
 * WHAT A NEW INCIDENT HOLDS (E32 C5a, 28.09.2026; audit S04-03): every field of the world
 * half (`PUBLIC_INCIDENT`) and of the cast (`CAST_FIELDS`) but the betrayal offer, which
 * outlives its incident (D18) and is kept, not decided, when the next one opens. The one
 * list of a new incident's values - `openMurder` writes it whole, and R206 holds it to the
 * two lists, so the next field an incident gains is added here or fails there (C9, C10,
 * C11c, C13 and C17 add theirs here and to the grid's `FRESH`). Pure but for `openedAt`,
 * the clock's reading unless the caller names one.
 */
export function freshIncidentState({ killerId, victimId, indirect = false, selfInflicted = false, openedAt = Date.now() } = {}) {
    // `const fresh`, read by R191's census of the fields an incident's writes name.
    const fresh = {
        active: true,
        stage: "openingRoll",
        indirect,
        selfInflicted,
        killerId, victimId, thirdId: null, thirdSide: null, lastCrisis: null, swung: null,
        // Who walked in and walked out again (`thirdLeaves`): nobody yet.
        departed: [],
        turn: 0,
        turnSide: "victim",
        // Whose turn it is on the killers' side. One name until somebody joins
        // them; `passTurn` rotates it from there.
        killerTurnId: killerId,
        keyRemnants: KEY_REMNANTS.prepared,
        deniedToVictim: [],
        hindered: { victim: {}, killer: {} },
        blocked: { victim: {}, killer: {} },
        // Survive and Role reversal start closed; Self-defence opens them.
        unlocked: [],
        // A critical Self-defence stops the drain for the rest of the incident.
        drainStopped: false,
        // The action a Hope miss earned a second try at, per side (S04-32).
        advantageNext: { victim: null, killer: null },
        spent: [],
        freeResolution: null,
        thirdActed: null,
        openedAt,
        keyRemnantsStale: null,
        endedBy: null
    };
    return fresh;
}

/** The GM is told a murder was not opened over the one running, and the console says whose. */
function refuseSecondIncident(running) {
    ui.notifications.warn(game.i18n.localize("DRPG.Murder.oneAtATime"));
    warn(`Refused to open a murder: ${game.actors.get(running?.killerId ?? "")?.name ?? "somebody"} `
        + `is already in an incident with ${game.actors.get(running?.victimId ?? "")?.name ?? "somebody"}.`);
}

/**
 * Open a murder. GM-driven: the declaration and the consent happened away from
 * the table, and this is the moment they become mechanical.
 */
export async function openMurder({ killerId, victimId, indirect = false } = {}) {
    if (!game.user.isGM) return null;

    // The Eclipse is a placement window, not a moment in the story - nobody has
    // finished crossing the map yet. This does NOT catch the one legitimate call
    // during an Eclipse: `judgePendingMurders` (eclipse.mjs) opens a *parked*
    // direct murder from `endEclipse`, which clears the Eclipse flag before
    // judging declarations, so `isEclipse()` already reads false by the time it
    // calls here. Everywhere else - the GM panel's "Open a murder" tile, a
    // ruling card's button - is greyed out with a tooltip instead of reaching
    // this at all; this is the backstop for anyone who gets here anyway.
    const { isEclipse } = await import("./eclipse.mjs");
    if (isEclipse()) {
        ui.notifications.warn(game.i18n.localize("DRPG.Eclipse.murderLocked"));
        return null;
    }

    /*
     * ONE INCIDENT AT A TIME, STAGE 6 INCLUDED (E32 C5a, 28.09.2026; audit S04-03).
     *
     * There was no check at all once: this function wrote `active: true` over
     * whatever state was there, so a second call during a running incident did
     * not open a second incident - it REPLACED the first. Same state object,
     * new ids, the turn counter back to zero, and the original victim silently
     * no longer in a fight they were in the middle of.
     *
     * Until 1.2.66 it let one through at `resolution`, for the betrayal - the one
     * legitimate second murder, which opens with the first incident's body still on
     * the floor. That was the same replacement at Stage 6: the betrayal's incident
     * was written over the first, which was never closed - its killers never recorded
     * Blackened, its tools never broken, no close counted (the grid's TP01 and TP07,
     * marked red on I4 since C1) - and a ruling card's `openMurder` button or a console's
     * `game.drpg.openMurder` during a Stage 6 did the same with no betrayal in it (read off
     * the code; the lights' parked murders and the GM's dialog ask `murderState()` first). The
     * betrayal closes the first incident itself now (`openBetrayal`), so nothing
     * reaches here with an incident running, and anything that does is refused.
     */
    const running = murderState();
    if (running?.active) {
        refuseSecondIncident(running);
        return null;
    }

    const killer = game.actors.get(killerId);
    const victim = game.actors.get(victimId);
    if (!killer || !victim) return null;

    /*
     * ONE PERSON ON BOTH SIDES.
     *
     * A student who takes their own life is a Blackened like any other, and the
     * class still has to work out what happened in that room - it is one of the
     * oldest shapes this story has. This used to be refused outright, so the one
     * incident the guide's own trial rules already handle ("można głosować na
     * martwych graczy") was the one incident the engine could not open.
     *
     * What it costs: Stage 5 cannot run. The incident is a turn order between
     * two sides, a drain that falls on one of them, damage the other deals, and
     * four ways out that are all about the person opposite. With one name in
     * both seats every one of those is either nonsense or a no-op - Role
     * reversal swaps two ids that are already equal, Self-defence defends
     * against the person throwing the dice, and `passTurn` hands the turn from
     * somebody to themselves.
     *
     * So it does not run. Stage 4 still does, and it is the half that matters:
     * it decides whether they go through with it and HOW MANY Key Remnants the
     * scene keeps. Then the incident goes straight to Stage 6, which is exactly
     * the fiction - what they arranged before dying. The death itself is
     * recorded when the incident closes, so there is somebody alive to do the
     * arranging; see `endMurder`.
     */
    const selfInflicted = killer.id === victim.id;

    // A trap opens on the VICTIM's roll: their one chance to notice it before it
    // closes. Nobody fails to notice a trap they built for themselves, so an
    // indirect self-inflicted death would open on a roll that cannot mean
    // anything - and a success on it would end the incident with a warning to
    // the others about a project they set up. Direct, always.
    if (selfInflicted && indirect) {
        warn("A self-inflicted death cannot be indirect; opening it as a direct murder.");
        indirect = false;
    }

    /* EVERY FIELD OF A NEW INCIDENT, AND ALL OF THEM STAMPED (E04, audit S04-24; E32 C5a,
       audit S04-03). The values are `freshIncidentState`'s, the one list of them. Written
       as a whole state (`restoreState`): the world half replaced, the cast reset as a record
       - every field stamped with the fresh value or null, whether or not this GM still holds
       the last incident's, so a GM that missed the last close cannot bring it back - but the
       betrayal offer, the one thing a close keeps (D18). Until 1.2.66 this was a `writeState`
       patch that named its fields one by one, and each field it left out crossed into the
       next incident: `spent`, `freeResolution` and `thirdActed` did until E32 C2 (the grid's
       TP01 and TP07 read the betrayal's incident holding the last one's `thirdActed`, I3).
       Against no incident running (`expect`), in the incident's queue: an incident opened
       since the check above is not written over. */
    const opened = await restoreState(freshIncidentState({ killerId, victimId, indirect, selfInflicted }),
        { keep: ["betrayal"], expect: { active: null } });
    if (!opened) {
        refuseSecondIncident(murderState());
        return null;
    }

    await whisperToGms(`
        <h3>${game.i18n.localize("DRPG.Murder.openedTitle")}</h3>
        <p>${selfInflicted
            ? game.i18n.format("DRPG.Murder.openedSelf", {
                name: foundry.utils.escapeHTML(killer.name)
            })
            : game.i18n.format("DRPG.Murder.opened", {
                killer: foundry.utils.escapeHTML(killer.name),
                victim: foundry.utils.escapeHTML(victim.name),
                // Which side owes the roll is the kind of murder, not a choice -
                // and naming them here is the only notice a GM gets that it went
                // out, now that there is no button to press.
                roller: foundry.utils.escapeHTML((indirect ? victim : killer).name)
            })}</p>
        <p>${game.i18n.localize(nightNoteKey(indirect))}</p>
        ${selfInflicted
            ? `<p class="notes">${game.i18n.localize("DRPG.Murder.openedSelfNote")}</p>`
            : ""}`);

    log(selfInflicted
        ? `Murder opened: ${killer.name}, by their own hand.`
        : `Murder opened: ${killer.name} → ${victim.name}${indirect ? " (indirect)" : ""}.`);

    // Stage 4 starts itself.
    //
    // Which roll opens an incident is not a decision - a direct murder opens on
    // the killer's roll, a trap on the victim's, and `rollOpening` has always
    // known which and always sent it to the right person's client. What it
    // waited for was a GM pressing a button on the tracker to say so, in a state
    // where there is exactly one thing that can happen next. So it happens.
    //
    // Not awaited: the roll is a round trip to another client and can take as
    // long as that player takes. Awaiting it here would leave `openMurder`
    // hanging, and with it the dialog that called it.
    //
    // This is the first invitation, not the only one: `throwOpeningRoll`
    // re-offers a dismissed window up to three times on its own, and after
    // that the tracker's "Ask for the opening roll again" sends it once more
    // (CASE-10). A player who was not connected when the incident opened has
    // the roll thrown for them on the GM's client - see `rollOpening`.
    rollOpening(indirect ? "victim" : "killer", murderState())
        .catch(err => error("Could not open the Stage 4 roll", err));

    return murderState();
}

/**
 * Tell the victim the incident has started.
 *
 * Everything about Stage 4 was reported to the GMs and to nobody else, so the
 * person the whole thing is happening to found out by noticing that their own
 * character sheet had changed. The turn is theirs from the first round, and a
 * turn nobody announces is a turn that gets missed.
 *
 * Deliberately NOT sent when the murder opens - only when it actually begins. A
 * direct murder that fails its opening roll never happened as far as the victim
 * is concerned: the killer lost their nerve, no one was ever in danger, and
 * telling them "someone tried to kill you" would hand the table a fact the
 * rules never generated. See the note on `MURDER_OPENING`.
 *
 * A DIRECT VICTIM IS TOLD WHO (E06 C4, 27.09.2026; audit S04-31, the owner's D6). The
 * whisper said "Someone is moving on you" while the Event card and the cast the victim
 * is sent at this moment named the killer - a direct murder is fought face to face, and
 * the one sentence that pretended otherwise was this one. It names the killer now
 * (`victimUnderAttackBy`). A trap's victim is still told only that the trap closed: its
 * builder is not in the room, and their copy of the cast holds no name (`castFor`).
 */
async function tellVictimTheIncidentBegan(state) {
    try {
        const victim = game.actors.get(state?.victimId ?? "");
        if (!victim) return;
        const key = state.indirect ? "victimTrapSprung" : "victimUnderAttackBy";
        const data = state.indirect ? {} : { killer: esc(game.actors.get(state.killerId ?? "")?.name ?? "?") };
        await whisperToOwner(victim, `<p>${game.i18n.format(`DRPG.Murder.${key}`, data)}</p>`);
    } catch (err) {
        // The incident has already started in world state; a message that fails
        // to send must not roll that back.
        error("Could not tell the victim the incident had begun", err);
    }
}

/**
 * Record the killer's opening roll.
 *
 * The Key Remnant count comes straight off the duality: Hope leaves the most
 * evidence, a critical the least. Floored at the guide's minimum so a case can
 * never become unsolvable by a good roll.
 */
export async function resolveKillerOpening({ total, isCritical, withHope }) {
    if (!game.user.isGM) return null;
    const state = murderState();
    if (!state) return null;

    // The mirror of the guard in `resolveVictimOpening`. An indirect murder's
    // ONLY roll is the victim's, and this is exported on `game.drpg` - and
    // `resolveOpening` cannot catch it either, because the killer of a trap is
    // still genuinely `state.killerId`. Accepting the roll here would score a
    // trap against the direct table, and a failure would END an incident whose
    // victim was never asked anything.
    if (state.indirect) {
        warn("Refused a killer opening roll: this is an indirect murder, which opens on the victim's roll.");
        return null;
    }

    const def = MURDER_OPENING.killer;
    // The numbers are the killer's table either way - threshold, traits, the
    // sliding scale of Key Remnants. Only the prose changes for somebody who is
    // both sides of it; see MURDER_OPENING.killer.selfInflicted.
    const prose = (state.selfInflicted && def.selfInflicted) || def;
    const success = isCritical || total >= def.threshold;
    const band = isCritical ? "critical" : (withHope ? "hope" : "despair");
    await announceOpening(state, prose.label, { rollerId: state.killerId, success, band, total, threshold: def.threshold });

    if (!success) {
        await tellGms(prose.failure);
        // No follow-up: the killer lost their nerve, so there is no body, no
        // room to announce and nothing to investigate. The checklist would be
        // asking the GM to find a corpse that does not exist.
        await endMurder({ reason: "openingFailed", followUp: false });
        return { success: false };
    }

    const keys = Math.max(KEY_REMNANTS.minimum, def.keyRemnants[band]);
    // The stage as it was read (E32 C4): an incident the GM closed, or a roll that landed
    // first, while this one was on its way is not answered twice.
    const opening = { stage: "openingRoll", openedAt: state.openedAt };

    /*
     * A SELF-INFLICTED DEATH SKIPS STAGE 5 (see `openMurder`).
     *
     * There is no confrontation to run - nobody is defending, nobody is taking
     * turns, and the drain has one person to fall on who is also the person
     * dealing the damage. What Stage 4 produced is the whole mechanical output:
     * how many Key Remnants the scene keeps. So the incident lands on Stage 6,
     * which for this one shape of death means the arrangements they make before
     * dying - and `endedBy` names it, because `afterIncident` and
     * `recordBlackened` both read that field to tell one ending from another.
     *
     * The Despair penalties below are deliberately NOT applied: emptying the
     * victim's Sanity buys the killer a shorter fight, and denying Role reversal
     * closes a way out. Both are Stage 5 prices for a Stage 5 that never runs,
     * and marking a sheet for a mechanic nobody will reach is noise on a
     * character who is about to be dead. The Despair BAND still counts, which is
     * the part that leaves its mark: four Key Remnants instead of three.
     */
    if (state.selfInflicted) {
        if (!await writeState({
            stage: "resolution", endedBy: "selfInflicted", keyRemnants: keys, turn: 0
        }, { expect: opening })) return null;
        await tellGms(prose[band], { keys });
        await whisperToGms(`<p>${game.i18n.localize("DRPG.Murder.resolutionNoteSelf")}</p>`);

        // And the player, who is the only person in this incident.
        //
        // What Stage 4 bought goes to the GM alone everywhere else (the roll's
        // own card, `announceOpening`, says only what it came to), and that is
        // right when the roller is a killer who will find out what it bought
        // them by playing Stage 5. There is no Stage 5 here: the next thing
        // that happens is Stage 6 opening on their own sheet, and they would
        // have watched dice land and then been shown a clean-up screen with no
        // sentence in between. This is the beat `tellVictimTheIncidentBegan`
        // covers for an ordinary murder, and it is skipped along with the rest.
        try {
            const actor = game.actors.get(state.victimId);
            if (actor) {
                await whisperToOwner(actor,
                    `<p>${game.i18n.localize("DRPG.Murder.selfWentThrough")}</p>`);
            }
        } catch (err) {
            error("Could not tell the player their Stage 4 roll had landed", err);
        }
        log(`${game.actors.get(state.killerId)?.name ?? "?"} went through with it; `
            + `Stage 5 is skipped and Stage 6 opens with ${keys} Key Remnants.`);
        return { success: true, band, keys, selfInflicted: true };
    }

    const patch = { stage: "incident", keyRemnants: keys, turn: 1, turnSide: "victim" };

    // A Despair success costs the victim their Sanity and their way out - the Sanity
    // after the stage is written (E32 C4), so an opening that lost its race marks no sheet.
    if (band === "despair") patch.deniedToVictim = ["roleReversal"];
    if (!await writeState(patch, { expect: opening })) return null;
    if (band === "despair") {
        const victim = game.actors.get(state.victimId);
        if (victim) {
            await automatedUpdate(victim, {
                "system.resources.stress.value": resourceMax(victim, "stress")
            });
        }
    }
    await tellGms(prose[band], { keys });
    await tellVictimTheIncidentBegan(murderState());
    return { success: true, band, keys };
}

/**
 * Record the victim's opening roll - the WHOLE of Stage 4 for an indirect murder.
 *
 * There is no confrontation to open: the trap is already set, and the only
 * question is whether the victim notices it in time.
 *
 *   success   they get a free Move and a bad feeling, or (on Despair) work out
 *             what has been set up and can warn the others. No incident.
 *   failure   "Śmierć ofiary" - the trap closes, and the incident begins with
 *             the victim alone, draining 2 a turn (INCIDENT.drain.indirect).
 *
 * A DIRECT murder never gets here. Stage 4 has exactly one roll and a direct
 * murder spends it on the killer, which is also why a failed direct attempt
 * leaves the victim knowing nothing - nobody ever asked them for anything. See
 * the note on MURDER_OPENING.
 */
export async function resolveVictimOpening({ total, isCritical, withHope }) {
    if (!game.user.isGM) return null;
    const state = murderState();
    if (!state) return null;

    // Guarded rather than assumed. The tracker only ever offers this button for
    // an indirect murder, but this is exported on `game.drpg`, and applying the
    // trap's outcome to a direct incident would start Stage 5 twice.
    if (!state.indirect) {
        warn("Refused a victim opening roll: this is a direct murder, which opens on the killer's roll.");
        return null;
    }

    const def = MURDER_OPENING.victim;
    const success = isCritical || total >= def.threshold;
    const band = isCritical ? "critical" : (withHope ? "hope" : "despair");
    await announceOpening(state, def.label, { rollerId: state.victimId, success, band, total, threshold: def.threshold });

    if (!success) {
        // Nothing else opens an indirect murder, so this is the moment the
        // incident starts. Without it the state sat on "openingRoll" for ever
        // and an indirect murder could never be played. Against the stage as it
        // was read (E32 C4), and told to the GMs once it is written.
        if (!await writeState({ stage: "incident", turn: 1, turnSide: "victim" },
            { expect: { stage: "openingRoll", openedAt: state.openedAt } })) return null;
        await tellGms(def.failure);
        await whisperToGms(`<p>${game.i18n.localize("DRPG.Murder.indirectBegins")}</p>`);
        await tellVictimTheIncidentBegan(murderState());
        return { success: false, started: true };
    }

    await tellGms(def[band]);

    // The struggle to notice leaves its own trace. Stage 4's only Remnant, and
    // it belongs to the victim's roll rather than the killer's - see the note on
    // `MURDER_OPENING.victim.remnant`.
    const visibility = def.remnant?.[band];
    if (visibility) {
        const victim = game.actors.get(state.victimId);
        if (victim) {
            await dropRemnant(victim, {
                type: "incident",
                visibility,
                action: "incident",
                subject: victim.name,
                tiedToCrime: true,
                note: game.i18n.format("DRPG.Murder.openingRemnantNote", {
                    name: victim.name,
                    band: game.i18n.localize(`DRPG.Murder.band.${band}`)
                })
            });
        }
    }

    // The victim sensing it coming does not end the incident by itself - the
    // guide gives them a free Move and lets them use it or not. Ending it is
    // the GM's call, which is why this reports rather than decides - and says
    // so (CASE-10): left at "openingRoll" with no prompt, the incident sat
    // open, refused every other murder and tied every trace in the building.
    await whisperToGms(`<p class="drpg-warning">${game.i18n.localize("DRPG.Murder.victimNoticedNext")}</p>`);
    return { success: true, band };
}

/* ==========================================================================
 * STAGE 5 - THE INCIDENT
 * ========================================================================== */

/**
 * Take one crisis action, roll it, and apply everything mechanical about it.
 *
 * Called from the actor's own client - it is their roll - but every world write
 * it produces goes through the GM, same as the rest of the module.
 */
/**
 * The briefing every crisis action now opens with.
 *
 * Built from the same fields the handbook prints - what it does, what it costs,
 * which statistic it rolls, the number to beat and what a miss does - so the
 * window is the rules entry rather than a second, drifting description of it.
 * The threshold comes from `availableCrisisActions` because a Finishing Blow's
 * is not a constant: it falls as the victim runs out of Health, and quoting the
 * table value would be a lie exactly when the number matters most.
 *
 * @returns {Promise<boolean>} false if they backed out.
 */
async function confirmCrisisAction(actor, key, def, state, side) {
    const offered = availableCrisisActions(actor).find(o => o.key === key);
    const facts = [];

    if (def.kind === "resolution" && !def.noRoll) {
        facts.push(game.i18n.format("DRPG.Murder.briefCostStress", { n: RESOLUTION_STRESS_COST }));
    }

    const variant = def.indirectVictim && side === "victim" && state.indirect ? def.indirectVictim : null;
    const traits = variant?.traits ?? def.traits;
    if (traits?.length) {
        facts.push(game.i18n.format("DRPG.Action.usesTrait", {
            traits: traits.map(t => TRAITS[t]?.label ?? t).join(" / ")
        }));
    }
    if (offered?.threshold != null) {
        facts.push(game.i18n.format("DRPG.Murder.briefThreshold", { n: offered.threshold }));
    }
    if (offered?.hindered) facts.push(game.i18n.localize("DRPG.Murder.actionHindered"));

    const body = [def.hint, def.failure].filter(Boolean)
        .map(part => `<p>${foundry.utils.escapeHTML(part)}</p>`).join("");

    const go = await DialogV2.confirm({
        classes: ["drpg-panel"],
        window: { title: def.label },
        content: dialogContent(`<div class="drpg-briefing-block">
            ${body}
            <ul class="drpg-briefing-facts">${facts.map(f => `<li>${f}</li>`).join("")}</ul>
        </div>`),
        yes: { label: game.i18n.localize(def.noRoll ? "DRPG.Murder.briefTake" : "DRPG.Murder.briefRoll") },
        no: { label: game.i18n.localize("DRPG.Advance.cancel") },
        rejectClose: false
    });

    return Boolean(go);
}

/**
 * A critical Strike lets the killer pick the resource. Ask them.
 *
 * `damage.critical` is `{ choice: true }` in the table, and the engine read that
 * as "somebody else's problem": it pushed the line "the killer chooses" into the
 * summary and applied NOTHING, leaving a GM to work out what had been decided
 * and mark it by hand. The killer is right here with the dice still on screen.
 *
 * Asked on their client and carried with the result, rather than asked again on
 * the GM's: it is their choice, and a second window on somebody else's screen is
 * how a table ends up waiting on a GM who has looked away.
 */
async function askCriticalTarget(def) {
    if (!def.damage?.critical?.choice) return null;

    const picked = await DialogV2.wait({
        classes: ["drpg-panel", "drpg-narrow"],
        window: { title: game.i18n.localize("DRPG.Murder.criticalChoiceTitle") },
        content: dialogContent(`<p>${game.i18n.localize("DRPG.Murder.criticalChoiceIntro")}</p>`),
        buttons: [
            { action: "hp", label: game.i18n.localize("DRPG.Murder.criticalChoiceHp"), default: true },
            { action: "stress", label: game.i18n.localize("DRPG.Murder.criticalChoiceStress") }
        ],
        rejectClose: false
    });

    // Closing the window is not a way out of a hit that has already landed.
    return picked === "stress" ? "stress" : "hp";
}

/**
 * Why this character may not take this crisis action now, or null.
 *
 * MOVED OUT OF `takeCrisisAction` SO THE GM CAN ASK IT TOO (E03, 24.09.2026;
 * audit S04-09). Every one of these checks ran on the acting player's own
 * client and nowhere else, so the GM applied whatever arrived: a finishing blow
 * out of turn, an action still locked, one already spent, a packet that landed
 * after the incident had moved on to Stage 6. The bridge now asks this again on
 * the GM's side before it resolves anything. Everything it reads is the
 * incident's state and the character's resources, which the GM holds; the
 * item an action spends is not here, because the player's client may already
 * have used it by the time the packet arrives.
 *
 * @returns {{why: string, key: string|null, data?: object}|null} `key` is the
 *   toast for the player's own client; null means the client says nothing,
 *   as it never did for a tile that is not theirs to press.
 */
export function crisisRefusal(actor, key, state = murderState()) {
    const side = sideOf(actor, state);
    const def = CRISIS_ACTIONS[key];

    if (!state || state.stage !== "incident" || !def || !side) {
        return { why: "no incident is at its incident stage for that character", key: null };
    }
    if (!forSide(def, side)) return { why: "not an action for that side", key: null };
    if (!isTheirTurn(actor)) return { why: "not their turn", key: "DRPG.Murder.notYourTurn" };
    // The sheet greys these out, but the panel is only rebuilt on render - a
    // window left open across somebody else's turn still has live buttons.
    const offered = availableCrisisActions(actor).find(o => o.key === key);
    if (offered?.locked) {
        return { why: "that action is locked", key: "DRPG.Murder.actionLocked", data: { name: offered.lockedBy ?? "?" } };
    }
    if (offered?.spent) return { why: "that action is spent", key: "DRPG.Murder.actionSpent" };
    if ((state.blocked?.[side]?.[key] ?? 0) > 0) return { why: "that action is blocked", key: "DRPG.Murder.actionBlocked" };
    /*
     * A resolution action costs Sanity rather than an action - and Health when
     * there is no Sanity left (Z3).
     *
     * The third party's three decisions are exempt: the guide hands them an
     * "automatyczny, darmowy wybór", and charging anything to somebody who has
     * only just walked through the door - and may be choosing to walk straight
     * back out - is not what "darmowy" means.
     *
     * THE REFUSAL IS NOW ABOUT HAVING NOTHING AT ALL, not about the stress
     * track being full. Refusing at full stress closed the only two ways out of
     * an incident precisely when a victim needed them, and with the drain
     * stopped by a critical Self-defence there was then nothing left that could
     * end the fight - see `RESOLUTION_HEALTH_COST`. A victim with both tracks
     * full is a different case and cannot reach here: `checkVictimSpent` ends
     * the incident on that condition. This guard is the belt to that braces.
     */
    if (def.kind === "resolution" && !def.noRoll && isSpent(actor)) {
        return { why: "nothing left to spend on a resolution", key: "DRPG.Murder.nothingLeftToSpend" };
    }
    return null;
}

/**
 * Why a player's Reroll may not take this crisis action back, or null. Pure
 * over `live`, for the suite (E03 second review, 24.09.2026).
 *
 * JUDGED AS THE ACTION WAS TAKEN, NOT AS IT LEFT THINGS. The undo puts the
 * whole incident state back from the action's receipt, and the action is often
 * what moved it: Role reversal swaps the seats, Survive and a Finishing blow end
 * the incident. Asked of the live state, an honest Reroll of any of those was
 * refused - the first E03 build did exactly that. So:
 *   - the last action taken is this character's, and this one;
 *   - it killed nobody (the receipt's `killed`, E32+E07 C8b);
 *   - it was taken at the incident stage, from its own side (`crisisRefusal` on
 *     the receipt's state gives those two with no `key`);
 *   - and none of the moves `CRISIS_MOVES` names - a GM's Pass or resolution, a
 *     third party walking in, the victim run out - has happened since (`after`,
 *     stamped by `closeReceipt`; a receipt written before this build has none, and
 *     is let through as it always was). Other writes to the incident are not
 *     compared.
 */
export function crisisUndoRefusal(actor, key, live = murderState()) {
    const last = live?.lastCrisis ?? null;
    if (!last || last.actorId !== actor?.id || last.key !== key) return "the last crisis action is not that character's";
    // Whatever the packet says (E32+E07 C8b): the receipt is the world's record - see `undoLastCrisis`.
    if (crisisKilled(last)) return "that crisis action killed somebody; the death stands";
    const then = crisisRefusal(actor, key, last.state ?? null);
    if (then && !then.key) return then.why;
    if (last.after && CRISIS_MOVES.some(k => k in last.after && (live[k] ?? null) !== (last.after[k] ?? null))) {
        return "the incident has moved on since that action";
    }
    return null;
}

export async function takeCrisisAction(actor, key, { itemId = null } = {}) {
    const state = murderState();
    const side = sideOf(actor);
    const def = CRISIS_ACTIONS[key];

    const refusal = crisisRefusal(actor, key, state);
    if (refusal && !refusal.key) return null;

    // An action that spends something has to be told what. Refused rather than
    // rolled: a roll that cannot apply its own result is worse than no roll.
    if (def.usesItem && !actor.items.get(itemId)) {
        ui.notifications.warn(game.i18n.localize("DRPG.Murder.useItemGone"));
        return null;
    }
    if (refusal) {
        ui.notifications.warn(game.i18n.format(refusal.key, refusal.data ?? {}));
        return null;
    }

    // Say what this does before it is done.
    //
    // Every ordinary action on the sheet opens with a briefing - what it is,
    // which statistic it uses, what it costs, what happens if it misses - and
    // the crisis actions were the one set that did not. They went straight to
    // the dice, which meant the most consequential decisions in the game were
    // the only ones taken blind: a player picked a tile, a roll dialog appeared
    // naming a statistic they had not been told about, and the outcome table
    // was somewhere in the handbook.
    //
    // After the guards, so the briefing is only ever shown for an action that
    // could actually be taken; before the dice, so cancelling costs nothing.
    if (!await confirmCrisisAction(actor, key, def, state, side)) return null;

    /*
     * G-18: THIS ONE IS TAKEN, NOT ROLLED.
     *
     * A critical Self-defence buys one of the resolution actions it unlocked as
     * an automatic success. Note where this sits - after every guard above, so
     * a free take goes through the same filter as a paid one (trap 113): it
     * still has to be your turn, the action still has to be unlocked and
     * unspent and unblocked, Pin and Keep your distance still apply, and the
     * Sanity a resolution action costs is still checked and still charged.
     * The critical buys certainty about the dice; it does not buy an exemption
     * from the incident.
     */
    if (isFreeTake(def, side, state)) {
        const { requestCrisisResult } = await import("./gm-bridge.mjs");
        const res = await requestCrisisResult({
            actorId: actor.id, key, total: 0, isCritical: false,
            // Trap 114: an action with no roll still has to name a band, because
            // every outcome in this table is written per band. Hope, because
            // this IS the reward for a critical - scoring it as a Despair
            // success would have the prize leave a worse trace than an ordinary
            // attempt.
            withHope: true, free: true, itemId
        });
        if (!res.ok) return null;
        return game.user.isGM ? res.value : { pending: true };
    }

    // Three of the third party's four options have no threshold, no stat and no
    // outcome table in the guide, because there is nothing to fail at - you pick
    // a side or you leave. They skip the dice entirely and are applied as taken.
    if (def.noRoll) {
        const { requestCrisisResult } = await import("./gm-bridge.mjs");
        const res = await requestCrisisResult({
            actorId: actor.id, key, total: 0, isCritical: false, withHope: true, itemId
        });
        if (!res.ok) return null;
        return game.user.isGM ? res.value : { pending: true };
    }

    const { rollTrait } = await import("./action-rolls.mjs");
    const calls = await import("./call-effects.mjs");

    const situational = crisisSituational(actor, key, state);

    // The indirect victim rolls their own table's stat - Body, not Shadow.
    const variant = def.indirectVictim && side === "victim" && state.indirect ? def.indirectVictim : null;
    const trait = (variant?.traits ?? def.traits)?.[0] ?? "body";
    if (situational) calls.armSituational(situational);

    /*
     * WHICH WEAPON THIS SWING IS ABOUT, decided before the dice.
     *
     * Captured here rather than after the roll for the two reasons in
     * `breakOnDespair`: the incident moves items around, and an unarmed attack
     * that succeeds HANDS the killer an improvised weapon - looking it up
     * afterwards would break a tool the same roll had just created. Only the id
     * leaves this browser (`swungId`): the GM scores the damage off it and wears
     * it afterwards (E32+E07 C8, `applyCrisisAction`).
     *
     * TWO MARKERS, NOT ONE, AND THE MISSING ONE WAS THE ATTACK ITSELF (Dawid,
     * 29.08: "Attack with a weapon does not always work properly").
     *
     * `weaponAdvantage` reads "holding something helps here" - Self-defence and
     * Role reversal - and it was standing in for "this action swings a thing".
     * Attack with a weapon does not carry it, and correctly so: the guide gives
     * that action a DISADVANTAGE for being unarmed rather than a bonus for being
     * armed, so it declares `unarmedDisadvantage` and `weaponDamage` instead.
     *
     * The action whose entire subject is the weapon was therefore the one action
     * that captured no weapon, and three separate rules read `swung`:
     *
     *   - the knife never took its Despair wear, so the murder weapon was the
     *     one tool in the game that could not break in the murder;
     *   - the swing memo stayed empty, so Stage 6's `destroysTools` ruined
     *     whatever happened to be readied at closing time - the gloves - and
     *     the knife walked away, which is the exact bug that flag was added for;
     *   - and the Search trace that handed the killer the weapon was never tied
     *     to the murder, which is half of what "tied to murder" is for.
     *
     * `weaponDamage` is the honest second marker: it is on Attack with a weapon
     * and nothing else, and it means the damage of this roll is read off the
     * object in the hand. If a roll's damage comes from the tool, the tool was
     * swung.
     */
    const swings = Boolean(def.weaponAdvantage || def.weaponDamage);
    const swung = swings ? equippedWeapon(actor) : null;

    let roll;
    try {
        roll = await rollTrait(actor, trait, {
            actionKey: "crisis", context: { crisis: key },
            title: def?.label ?? game.i18n.localize("DRPG.Roll.crisis")
        });
    } finally {
        calls.clearSituational();
    }
    if (!roll) return null;

    /*
     * WRITTEN DOWN, BECAUSE ONE HAND MADE STAGE 6 FORGETFUL (E9).
     *
     * `destroysTools` ruins what is READIED when Stage 6 closes. That was fine
     * while a killer could hold the knife and the gloves at once; with one hand
     * they hold the knife for the murder and the gloves for the clean-up, so at
     * closing time the gloves are in hand and the knife walks away.
     *
     * It was a flag on the actor until CASE-04 - world data, which told every
     * console who swung what. The id taken here travels in the crisis packet
     * below (`swungId`); the GM narrows it to what this actor may have swung
     * (`swungWeapon`) and keeps it in the cast's `swung`, which no player's copy
     * carries (`castCopyFor`) and a new incident starts empty
     * (`freshIncidentState`). Corrected in E32+E07 fix r1-G5 (review C-m7): this
     * paragraph still described the flag.
     */
    if (swung) {
        /*
         * AND THE TRACE THAT HANDED IT OVER IS EVIDENCE NOW (Dawid, 28.08).
         *
         * The Search that turned this thing up could not know it would be used
         * for this - nobody could - so it recorded which object it gave out and
         * left the question open. This is the moment that answers it - once the
         * dice are thrown (E32+E07 C8; audit S04-34): asked before them, a
         * killer who closed the roll window had made the knife evidence of a
         * swing that never happened.
         *
         * Through the GM, because the ledger holding the answer key is the GM's
         * and a player's client has neither the record nor the right to write
         * it. Fire and forget: a trace that fails to be re-labelled must not
         * stop a murder that is already happening, and the GM can tick the box
         * by hand in the case dashboard.
         */
        const identity = swung.getFlag(MODULE_ID, "drpgItemId");
        if (identity) {
            // Not awaited, so the swing goes on whatever the ledger says; a GM's
            // own client ties it there (`local`). A destructured import since E31,
            // so the lint rule that holds a request's answer to its caller sees it.
            void (async () => {
                try {
                    const { requestTieTrace } = await import("./gm-bridge.mjs");
                    void requestTieTrace(identity);
                } catch (err) {
                    debug("Could not tie the weapon's own trace to the murder", err);
                }
            })();
        }
    }

    // Asked here, while the person who threw the dice is still looking at them.
    const choice = roll.isCritical ? await askCriticalTarget(def) : null;

    /*
     * THE ITEM IS SPENT HERE, ON THE PLAYER'S OWN CLIENT.
     *
     * `useItem` is a conversation - which resource a tier 3 restores, a confirm
     * before something is used up - and those questions belong to the person
     * whose character it is. Handing them to the GM's browser would ask a GM to
     * decide, for somebody else, which half of their sheet to heal.
     *
     * So the player applies it and tells the GM WHICH id went, and the GM's
     * side does what only it can: the trace, the turn, the drain, and the
     * receipt that lets a Reroll put the thing back.
     *
     * SUCCESS IS NOT ENOUGH. The guide's row: a critical or a success with Hope
     * and the item goes in; a success with DESPAIR leaves the trace and nothing
     * else - you were seen fumbling with it and it stayed in your pocket.
     */
    let usedItemId = null;
    if (def.usesItem) {
        const hit = roll.isCritical || roll.total >= def.threshold;
        if (hit && (roll.isCritical || roll.withHope)) {
            const item = actor.items.get(itemId);
            const { useItem } = await import("./use-items.mjs");
            // `useItem` can still be backed out of at its own confirm. The roll
            // and the turn are spent either way - a player who changes their
            // mind at the last dialog has still done the thing on the clock.
            if (item && await useItem(actor, item)) usedItemId = item.id;
        }
    }

    const { requestCrisisResult } = await import("./gm-bridge.mjs");
    const res = await requestCrisisResult({
        actorId: actor.id, key,
        total: roll.total,
        isCritical: Boolean(roll.isCritical),
        withHope: Boolean(roll.withHope),
        choice,
        // What was actually spent, so a Reroll can give it back.
        usedItemId,
        // What was swung, so Stage 6 ruins the right thing (E9).
        swungId: swung?.id ?? null
    });

    /*
     * AN ACTION THAT KILLED IS KEPT AS ONE ON THE ROLL'S BOOKMARK (E32+E07 C8b), so the
     * Reroll Call refuses it before anything is paid (`lethalReroll`, reroll.mjs). The
     * GM answers `lethal` when the action's own resolution killed somebody (its receipt's
     * `killed`); the asker is in the death card's audience already. The bookmark is this
     * browser's; the GM refuses the undo whatever it says (`undoLastCrisis`).
     */
    if (res.ok && res.value?.lethal) {
        const { rollBookmark, keepRollBookmark } = await import("./action-rolls.mjs");
        const bookmark = rollBookmark(actor);
        if (bookmark?.crisis === key) await keepRollBookmark(actor, { ...bookmark, lethal: true });
    }

    return { roll, choice };
}

/**
 * What they are actually holding.
 *
 * The EQUIPPED Crime Tool and nothing else. This used to fall back to "any
 * Crime Tool you are carrying", which meant equipping decided nothing: the
 * advantage, the damage tier and the disadvantage for being unarmed were all the
 * same whether or not the killer had ever said which object was in their hand.
 * Readying a weapon is now the decision the sheet's button has always looked
 * like it was making - and `grantImprovisedWeapon` readies what it hands over,
 * so an unarmed killer who improvises one is armed for the next swing without
 * having to stop and click.
 *
 * Through `equippedFor` rather than a flag name spelled out here: it already
 * means "readied, not in the stash, not broken, and able to do this job", and it
 * owns the spelling of the flag.
 *
 * BY ROLE, NOT BY CATEGORY (E8). A saw filed under Tools is a weapon in
 * anybody's hands, and the character sheet's row is not the place that decides
 * that. Everything downstream reads the weapon through this one function -
 * advantage, the unarmed penalty, the damage tier - so the role reaches the
 * damage and not only the bonus, which is the one half-migrated state worth
 * being afraid of here.
 */
function equippedWeapon(actor) {
    return equippedFor(actor, "crimeTool");
}

function hasWeapon(actor) {
    return Boolean(equippedWeapon(actor));
}

/**
 * Owns one at all, readied or not - a different question from `hasWeapon`.
 *
 * Only one rule needs it, and it needs it badly. The guide's unarmed attack
 * hands the killer an improvised tool on a success, and that clause is about
 * having NOTHING: "jeśli zabójca nie ma broni". Reading it off `hasWeapon` once
 * that meant "readied" turned forgetting to click Ready into a reward - the
 * attack was made at disadvantage, and then produced a second Crime Tool, over
 * the carry limit, for the tool already in the killer's pocket.
 *
 * So the two questions are asked separately. Advantage, disadvantage and damage
 * come from what is in the hand; whether there is anything to improvise from
 * comes from what is on the person.
 *
 * BROKEN DOES NOT COUNT, and it is the same bug the paragraph above describes,
 * in a new shape. A killer whose only Crime Tool was ruined in an earlier
 * incident is carrying a slot, not a weapon: they have "nie ma broni" in every
 * sense the clause means, and reading the ruined one as a weapon would refuse
 * them the improvised tool the rule promises. The grant overrides the carry cap
 * anyway (see `grantImprovisedWeapon`), so the broken one staying in the way is
 * not a reason to withhold it.
 */
function carriesWeapon(actor) {
    return carriedFor(actor, "crimeTool").some(i => !isBroken(i));
}

/**
 * The weapon this attack swings, and the tier it counts as.
 *
 * Two things the old `bestWeaponTier` could not express, both from the guide's
 * own Attack-with-a-weapon row:
 *
 *   "Przedmiot tieru 0 jest negocjowalny jako tier 1 lub 2 w ramach
 *    kreatywności zabójcy."
 *      A Tier 0 item is "a random, seemingly useless object". Whether swinging
 *      a stapler is worth anything is a ruling, so the GM is asked for one
 *      instead of the formula quietly returning 1 damage and nobody noticing
 *      that a whole rule never fired.
 *
 *   There is no "best one you own" any more - the weapon is whichever object the
 *      killer readied, because that is the one they said was in their hand. See
 *      `equippedWeapon`; since E32+E07 C8 the one readied as the dice were
 *      thrown, `swungWeapon`.
 *
 * @returns {Promise<{item: Item|null, tier: number}>}
 */
async function chooseWeapon(actor, weapon) {
    if (!weapon) return { item: null, tier: 0 };

    const tier = weapon.getFlag(MODULE_ID, ITEM_FLAGS.tier) ?? 0;

    const rule = CRISIS_ACTIONS.weaponAttack.tierZeroNegotiable;
    if (tier !== 0 || !rule?.prompt) return { item: weapon, tier };

    const rated = await rateTierZero(actor, weapon, rule);
    return { item: weapon, tier: rated };
}

/**
 * The weapon a crisis roll swung, on the GM (E32+E07 C8; audit S04-04).
 *
 * The player's browser names it (`swungId`, taken before the dice by `takeCrisisAction`),
 * and the name is a claim: it counts only on an action that swings (the same two markers)
 * and for a Crime Tool the actor carries and holds ready - as the bridge's own check
 * (gm-bridge.mjs `handleCrisis`) it cannot name somebody else's. A Reroll's replay swings
 * what its receipt recorded (`recorded`), whatever became of it since.
 */
function swungWeapon(actor, def, id, recorded = false) {
    if (!id || !(def.weaponAdvantage || def.weaponDamage)) return null;
    const item = actor.items?.get(id);
    if (!item || !servesAs(item, "crimeTool") || isStashed(item)) return null;
    return recorded || isEquipped(item) ? item : null;
}

/**
 * The Despair's wear on the weapon a roll swung, on the GM after the damage it dealt
 * (E32+E07 C8; audit S04-04). Until 1.2.66 the player's browser wore it before telling
 * the GM, so a knife that broke on the blow was no longer in the hand the damage was read
 * from. `breakOnDespair` posts its notice as before; while the incident runs the card is
 * veiled whoever posts it (secret.mjs `incidentVeils`), its words to the actor's player.
 * A roll-less take (a free one, the third's choices) wears nothing. Answers what a Reroll
 * needs to give the wear back (`undoLastCrisis`), or null when nothing wore.
 */
async function wearSwing(actor, weapon, { withHope, isCritical, rolled }) {
    if (!weapon || !rolled || isBroken(weapon)) return null;
    const was = { itemId: weapon.id, wear: wearOf(weapon), equipped: isEquipped(weapon) };
    await breakOnDespair(actor, weapon, { withFear: !withHope && !isCritical, isCritical });
    const now = actor.items?.get(weapon.id) ?? weapon;
    return wearOf(now) !== was.wear || isBroken(now) ? was : null;
}

/** The GM prices one Tier 0 object for this particular swing. */
async function rateTierZero(actor, item, rule) {
    const options = [];
    for (let t = rule.min; t <= rule.max; t++) {
        options.push(`<option value="${t}"${t === 0 ? " selected" : ""}>${
            game.i18n.format("DRPG.Murder.asTier", { n: t })
        }</option>`);
    }

    const picked = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Murder.tierZeroTitle") },
        classes: ["drpg-panel"],
        content: dialogContent(`<form>
            <p>${game.i18n.format("DRPG.Murder.tierZeroIntro", {
                actor: foundry.utils.escapeHTML(actor.name),
                item: foundry.utils.escapeHTML(item.name)
            })}</p>
            <label>${game.i18n.localize("DRPG.Murder.tierZeroRate")}
                <select name="tier">${options}</select></label>
            <p class="notes">${game.i18n.localize("DRPG.Murder.tierZeroNote")}</p>
        </form>`),
        buttons: [
            {
                action: "ok", label: game.i18n.localize("DRPG.Panel.apply"), default: true,
                callback: (e, b, d) => d.element.querySelector("[name=tier]").value
            }
        ],
        rejectClose: false
    }).catch(() => null);

    // Dismissed is not a ruling - fall back to what the item actually is.
    const n = Number(picked);
    return Number.isFinite(n) ? Math.max(rule.min, Math.min(rule.max, n)) : 0;
}

/**
 * An unarmed attack that lands leaves the killer holding something.
 *
 * Guide: "Jeśli zabójca nie ma broni, może wykonać atak z disadvantage. Przy
 * sukcesie zyskuje broń improwizowaną, czyli narzędzie. Hope - Tier 2,
 * Despair - Tier 1." A real Crime Tool on the sheet, not a sentence - the next
 * Attack with a weapon has to be able to find it.
 */
/** @returns {Promise<string|null>} the item's id, so a Reroll can take it back. */
async function grantImprovisedWeapon(actor, def, band, done) {
    const tier = def.unarmedImprovises?.[band];
    if (tier === undefined) return null;

    const { grantItem } = await import("./inventory.mjs");
    const item = await grantItem(actor, {
        name: def.unarmedImprovises.name,
        category: "crimeTool",
        tier,
        // The killer is mid-incident and cannot go and put something down;
        // a GM's ruling outranks the carry cap here.
        override: true,
        description: `<p>${game.i18n.localize("DRPG.Murder.improvisedNote")}</p>`
    });

    if (!item) return null;

    // Readied on the spot. The killer picked this thing up mid-fight and is
    // holding it; making them open their sheet and click "ready" before the next
    // swing counts would be bookkeeping for a decision they have already made
    // with their hands. It also matters mechanically now that only an equipped
    // tool arms you at all - see `equippedWeapon`.
    try {
        const { toggleEquipped } = await import("./use-items.mjs");
        await toggleEquipped(actor, item);
    } catch (err) {
        error("Could not ready the improvised weapon", err);
    }

    done.push(game.i18n.format("DRPG.Murder.improvised", {
        item: foundry.utils.escapeHTML(item.name), tier
    }));
    return item.id;
}

/**
 * Score a crisis action and apply it. GM-side: it writes to both participants'
 * sheets and to the map.
 *
 * @param {object} options
 * @param {boolean} [options.undo]  A Reroll replacing this actor's own previous
 *   crisis action. Everything the first throw did is taken back first - see
 *   `undoLastCrisis` - and then this runs normally against the new number.
 *   Because the undo rewinds the incident state, including whose turn it is,
 *   replaying passes the turn a second time and the turn ends up spent exactly
 *   once: the reroll costs Hope, not a turn.
 */
export async function resolveCrisisAction(options = {}) {
    if (!game.user.isGM) return null;
    resolving++;
    try {
        return await applyCrisisAction(options);
    } finally {
        resolving--;
        if (!resolving && victimOwed) {
            victimOwed = false;
            checkVictimNow();
        }
    }
}

/*
 * WHILE AN ACTION IS SCORED, THE `updateActor` HOOK DOES NOT CHECK THE VICTIM (E32 C4,
 * 28.09.2026; audit S04-26). The action's damage and a pass's drain are updates to the
 * victim, and the hook's check ran beside the action's own: both read stage "incident",
 * both wrote Stage 6, two ran-out cards (the grid's DM14, red at f177726). The action
 * checks after its damage and again after the pass (`applyCrisisAction`), so the hook
 * leaves this browser's actions to it; a counter, as two actions can be scored at once.
 *
 * AND WHAT IT LEFT IS OWED (E32+E07 fix r1-G3, 02.10.2026; review C-m1). Until this fix
 * the comment here said an edit made by hand in that moment was read by the action's
 * check that follows it; nothing follows the last one (after the pass, or after the card
 * for a third's action and a critical that keeps the turn), and the review measured a
 * victim run out as the action's receipt was written left in the fight at 0/0 until the
 * next update. The hook marks the check owed (`victimOwed`), and the last action scored
 * on this browser runs it as it ends (`checkVictimNow`), after the action's own checks:
 * the run-out lands on no action's card, and is told as the hook's is.
 */
let resolving = 0;
let victimOwed = false;

async function applyCrisisAction({
    actorId, key, total, isCritical, withHope, undo = false, choice = null, usedItemId = null,
    // The weapon the roll was thrown with: its damage and its wear (E32+E07 C8), and
    // remembered for Stage 6 (E9, CASE-04). A claim, narrowed by `swungWeapon`.
    swungId = null,
    // G-18. Not derived here from the state, because by the time this runs the
    // grant may have been consumed by the undo half of a Reroll - the client
    // that pressed the tile is the one that knew.
    free = false
} = {}) {
    if (!game.user.isGM) return null;

    // A Reroll's packet names no weapon (reroll.mjs `settleCrisis`): the replay swings
    // what the action it takes back swung, as its receipt recorded it (E32+E07 C8) - and
    // nothing when it recorded nothing, whatever a packet names (fix r1-G3, review S-m3).
    const replayed = undo ? murderState()?.lastCrisis?.swungId ?? null : null;

    // Before `murderState()` is read, not after: the undo rewinds that state,
    // and the replay has to be scored against the incident as it stood when the
    // action was first taken - the same turn, the same stage, the same locks.
    //
    // A replay that could not rewind must NOT go on to apply itself. It would
    // land on top of the first result rather than in place of it: damage twice,
    // two Remnants, the turn passed twice - the exact opposite of what a Reroll
    // is for. The GMs are told rather than left to find it - unless the action
    // killed (E32+E07 C8b): then the first result stands by the rule, not for want
    // of a record. The asker is answered "nothing was carried out", and its Reroll
    // puts the first dice back and returns the Hope (reroll.mjs `settleCrisis`,
    // fix r1-G3); until then the new dice stayed on the card, paid for.
    const deathStands = undo && crisisKilled(murderState()?.lastCrisis);
    if (undo && !await undoLastCrisis({ actorId, key })) {
        if (!deathStands) await whisperToGms(`<p class="drpg-warning">${
            game.i18n.localize("DRPG.Murder.rerollLost")}</p>`);
        return null;
    }

    const state = murderState();
    const actor = game.actors.get(actorId);
    const def = CRISIS_ACTIONS[key];
    if (!state || !actor || !def) return null;
    // The stage the action was taken at, for its card's audience (`announceCrisis`).
    const stage = state.stage;

    // What this roll swung (`swungWeapon`): the damage is read off it, the Despair
    // wears it, and Stage 6 ruins it. A replay swings the receipt's weapon or none: until
    // fix r1-G3 (02.10.2026; review S-m3) a first throw that swung nothing fell through
    // to the packet's `swungId`, and a knife readied between the throw and the Reroll was
    // swung by the replay - its tier dealt, its wear taken, its name in the swing memo.
    const weapon = undo ? swungWeapon(actor, def, replayed, true) : swungWeapon(actor, def, swungId);

    // The swing memo, in the cast. Its own sub-key only (E04): two actors swinging
    // on two GMs' clients both stay.
    if (weapon) {
        await incidentWrite(() => castStore.patch(RECORD, { swung: { [actorId]: weapon.id } }));
    }

    // WHOSE SIDE, not the entry's. One action is written `side: "both"` - using
    // an item is the same act whoever does it - and everything below is about
    // the person who took it: the advantage it clears, whether the turn passes.
    const side = def.side === "both" ? sideOf(actor) : def.side;
    const threshold = key === "finishingBlow"
        ? finishingBlowThreshold(state)
        : def.threshold;
    // `noRoll` actions have no threshold to beat - the guide gives them no
    // table at all - so they always take the success branch. Left out, they
    // scored `total >= undefined`, which is false, and every one of the third
    // party's three decisions would have quietly resolved as a failure.
    // A free take is a success by definition (G-18), on the same footing as the
    // third party's `noRoll` decisions: there is no number to beat because the
    // critical already beat it.
    const success = def.noRoll || free || isCritical || total >= threshold;
    const band = isCritical ? "critical" : (withHope ? "hope" : "despair");
    const done = [];

    // What it would take to put all of this back. Captured before anything is
    // applied, because half of it is "the value this resource had a moment ago".
    const receipt = openReceipt(actorId, key, state);
    receipt.swungId = weapon?.id ?? null;

    /*
     * SPENT BEFORE IT IS APPLIED, not after.
     *
     * A resolution action can end the incident outright - Survive does, and a
     * critical Role reversal effectively does - and clearing the grant after
     * that would be writing into a state that has moved on. Cleared for the
     * side that held it rather than blanked, so a second grant (there is no
     * such thing today, and this file has been surprised before) is not eaten
     * by somebody else's turn.
     */
    if (free && freeResolutionFor(side, state)) await writeState({ freeResolution: null });

    // The advantage a missed attempt earned is spent by the next attempt at that
    // action, whatever happens in it - and by no other action (S04-32).
    await clearAdvantage(side, key);

    // The newcomer's one free choice is spent HERE, before anything it does can
    // move the incident out from under the write.
    //
    // It used to be recorded at the bottom of this function, behind
    // `stage === "incident"` so it could not write into a state that had just
    // been cleared. But the one third-party action that can END the incident -
    // Escape together - moves the stage to "resolution" on its way past, and
    // the guard then threw away the very record that a choice had been made:
    // measured, `thirdActed` stayed false with `thirdId` still set.
    //
    // Recorded here it survives all four options, including any added later,
    // and a Reroll still takes it back with the rest of the state, because
    // `openReceipt` above snapshots the state first.
    if (side === "third") await writeState({ thirdActed: true });

    // Read before anything is applied: `grantImprovisedWeapon` below puts a
    // Crime Tool on the sheet, and asking afterwards would find the weapon the
    // attack itself just produced.
    //
    // `carriesWeapon`, not `hasWeapon`: improvising is for a killer with nothing
    // at all, not for one who simply never readied what they had. See
    // `carriesWeapon`. And never after a swing (E32+E07 C8; audit S04-04): until
    // 1.2.66 the player's browser wore the knife before this ran, a Tier 1 knife
    // broke on a Despair hit, and the hit counted as unarmed - 1 Health, not 2,
    // and an improvised weapon for the killer holding the knife.
    const wasUnarmed = def.unarmedImprovises ? !weapon && !carriesWeapon(actor) : false;

    if (success) {
        receipt.remnant = refOf(await applyRemnant(actor, def.remnant?.[band], def, band, done, false, side));
        await applyDamage(actor, state, def, band, done, false, choice, weapon);
        receipt.wore = await wearSwing(actor, weapon, { withHope, isCritical, rolled: !def.noRoll && !free });
        if (wasUnarmed) receipt.itemId = await grantImprovisedWeapon(actor, def, band, done);
        // Spent on the player's client; recorded here so a Reroll can undo it.
        if (def.usesItem) {
            receipt.usedItemId = usedItemId;
            done.push(game.i18n.localize(usedItemId
                ? "DRPG.Murder.useItemWorked" : "DRPG.Murder.useItemFumbled"));
        }
        await applyHindrance(state, def, band, done);
        await applyUnlocks(state, def, key, band, done);
        if (def.swapsRoles) await swapRoles(state, band, done);
        await applyThirdPartyChoice(actor, def, done);
        if (def.endsIncident) await finishIncident(state, key, band, done, receipt.killed);
    } else {
        /*
         * G-22: ONLY A HOPE FAILURE EARNS THE NEXT TRY.
         *
         * The guide gives the advantage to a miss "z Hope"; this granted it on
         * any failure, so a victim who rolled badly AND with Despair was paid
         * for it exactly as well as one who was simply unlucky. Those are the
         * two halves the duality is for.
         *
         * `band` is safe to test here and only here (trap 112): a critical is
         * always a success, so this branch sees `hope` and `despair` and
         * nothing else. Three entries in config.mjs carry a `critical` key in
         * their FAILURE tables, left as documentation of the guide's own
         * layout; none of them is reachable, and this line is not one of them.
         */
        if (def.failureGrantsAdvantage && band === "hope") {
            await grantAdvantage(side, key);
            done.push(game.i18n.localize("DRPG.Murder.advantageNext"));
        }
        receipt.remnant = refOf(await applyRemnant(actor, def.failureRemnant?.[band], def, band, done,
            Boolean(def.failureRemnantReinforced?.[band]), side));
        await applyDamage(actor, state, def, band, done, true, choice);
        receipt.wore = await wearSwing(actor, weapon, { withHope, isCritical, rolled: !def.noRoll && !free });
        // A flat number drains on any failure; an object drains only on the
        // bands it names. Survive costs a point however it fails; Self-defence
        // and Role reversal only on Despair, which is what their own text has
        // always said and what nothing was doing.
        //
        // IT COSTS WHOEVER FAILED (E32+E07 C7, 28.09.2026; audit S04-19). Use an item
        // is both sides' action, and a killer's or an accomplice's failure with Despair
        // drained the VICTIM: their miss cost the person they were killing. The
        // victim's is the incident's drain (a critical Self-defence stops it); anybody
        // else's is their own Sanity, then Health - the handbooks' "costs 1 extra" (the
        // gm-handbook's crisis table, the player-handbook's Use an item row) is the
        // taker's.
        const extra = typeof def.failureExtraDrain === "object"
            ? def.failureExtraDrain?.[band]
            : def.failureExtraDrain;
        if (extra && side === "victim") await drain(state, extra, done);
        else if (extra) await takeReserves(actor, { stress: extra }, done);
        // "Only you get out" (config.mjs `sharedEscape.failure`): the third has left (S04-21).
        if (key === "sharedEscape") await thirdLeaves(actor);
    }

    // The third party's decisions are "automatyczny, darmowy wybór" - free in
    // the guide's own words - so they are exempt from the Sanity a resolution
    // action normally costs, exactly as they are exempt from the check for it
    // in `takeCrisisAction`.
    if (def.kind === "resolution" && !def.noRoll) await spendStress(actor, done);

    // Before the card is written, so "they run out" is on the same card as the
    // blow that did it rather than arriving as a separate note afterwards.
    const ranOut = await checkVictimSpent(done, receipt.killed);

    const announcement = await announceCrisis(actor, def, {
        success, band, total, threshold, done, stage
    });
    receipt.messageId = announcement?.id ?? null;

    // A third party's action is free: it is taken out of the victim→killer
    // order and must not advance it, or somebody walking in would silently
    // skip whoever's turn it actually was. It is also the only one they get -
    // and that is written at the top of this function now, not here.
    if (side === "third") {
        await closeReceipt(receipt);
        return { success, band, done, ranOut, lethal: receipt.killed.length > 0 };
    }

    /*
     * The turn passes unless the incident just ended - which now includes the
     * victim running out, not only an action that says `endsIncident`.
     *
     * A CRITICAL CAN HOLD IT. The guide gives the direct victim a second action
     * on a critical use of an item and the indirect victim the action back; at a
     * table those are the same thing, so this module has one behaviour for them
     * rather than two mechanisms for one effect. Nothing else in the crisis
     * table keeps a turn, which is why it reads as an exception.
     */
    if (murderState()?.stage === "incident"
        && !(isCritical && def.criticalKeepsTurn)) {
        await passTurn();
        // The drain at the victim's turn is the pass's; the hook leaves it to this check.
        await checkVictimSpent(null, receipt.killed);
    }

    await closeReceipt(receipt);
    return { success, band, done, ranOut, lethal: receipt.killed.length > 0 };
}

/* ==========================================================================
 * TAKING A CRISIS ACTION BACK - the Reroll's other half
 * --------------------------------------------------------------------------
 * Three Hope buys back the dice, and for every other action in this module that
 * already meant the action itself was undone and redone (see reroll.mjs). A
 * crisis action was the exception: it fell through to "the dice are the whole
 * result", so a player paid three Hope, watched the number change, and watched
 * the damage, the Remnant and the turn stay exactly as the first throw had left
 * them.
 *
 * The undo is a receipt rather than a set of inverse operations. Half of what a
 * crisis action does is a merge into the shared incident state - `hindered`,
 * `blocked`, `unlocked`, `spent`, `drainStopped`, `advantageNext`, whose turn it
 * is, which of the two is the killer after a reversal - and inverting eight
 * merges correctly is a great deal harder to keep right than storing what the
 * state was and putting it back. The document-level effects (a Remnant on the
 * map, damage on a sheet, an improvised weapon, a chat card) are listed one by
 * one because those are the ones that cannot be expressed as state.
 *
 * The receipt lives IN the incident state rather than in a module-level Map, so
 * it survives the GM reloading and works when a second GM picks the incident up.
 * ========================================================================== */

/** The incident state, without the receipt - or a receipt would nest forever. */
function snapshotState() {
    const { lastCrisis, ...rest } = murderState() ?? {};
    return foundry.utils.deepClone(rest);
}

/** A token as a receipt can name it. cleanup.mjs uses the same shape (C3). */
export function refOf(placed) {
    const doc = placed?.document ?? placed;
    if (!doc?.id) return null;
    return { id: doc.id, sceneId: doc.parent?.id ?? null };
}

function openReceipt(actorId, key, state) {
    const victim = game.actors.get(state.victimId);
    const actor = game.actors.get(actorId);

    return {
        actorId,
        key,
        state: snapshotState(),
        // Resource VALUES, not deltas. `applyDamage`, `drain`, `swapRoles` and
        // `spendStress` all clamp, so the amount asked for and the amount that
        // landed are routinely different numbers - and only the second one can
        // be put back.
        //
        // THE ACTOR'S HEALTH IS HERE BECAUSE OF Z3. A resolution action taken
        // with no Sanity left is paid for in Health, so the actor now has two
        // tracks a Reroll has to be able to put back - and a receipt that
        // remembers one of them would refund the Sanity nobody spent and keep
        // the blood that was.
        actorStress: actor ? resourceValue(actor, "stress") : null,
        actorHp: actor ? resourceValue(actor, "hitPoints") : null,
        victimId: state.victimId ?? null,
        victimHp: victim ? resourceValue(victim, "hitPoints") : null,
        victimStress: victim ? resourceValue(victim, "stress") : null,
        remnant: null,
        itemId: null,
        // The weapon swung (`swungWeapon`) and the wear its Despair left (`wearSwing`).
        swungId: null,
        wore: null,
        // Whom this action's own resolution killed (`finishIncident`, `checkVictimSpent`):
        // a Reroll does not take it back (`undoLastCrisis`, E32+E07 C8b).
        killed: [],
        messageId: null
    };
}

/**
 * What a later move writes into the incident: the stage and how it ended (a GM
 * beginning the resolution, the victim run out), the turn (a GM's Pass), and a
 * third party walking in. A Reroll of the last action is refused once any of
 * them differs from what the action itself left (`crisisUndoRefusal`).
 */
const CRISIS_MOVES = ["stage", "endedBy", "turn", "turnSide", "killerTurnId", "thirdId"];

async function closeReceipt(receipt) {
    try {
        /* WHAT THE ACTION LEFT, so a Reroll can tell its own consequences from
           a GM who has moved the incident on since (E03 second review): Survive,
           Finishing blow and Escape together end the incident themselves, and
           the undo puts the stage back with the rest of the state. */
        const after = murderState() ?? {};
        receipt.after = Object.fromEntries(CRISIS_MOVES.map(key => [key, after[key] ?? null]));
        await writeState({ lastCrisis: receipt });
    } catch (err) {
        error("Could not record what this crisis action did; a Reroll will not be able to replay it", err);
    }
}

/**
 * Whether a crisis action's receipt says its own resolution killed somebody. A
 * receipt from before E32+E07 C8b has no `killed`, and reads as killing nobody.
 */
function crisisKilled(receipt) {
    return Array.isArray(receipt?.killed) && receipt.killed.length > 0;
}

/**
 * Put back everything this actor's last crisis action did.
 *
 * Refuses politely when the receipt is for a different action or a different
 * person - a Reroll must never unwind somebody else's turn.
 *
 * AND WHEN THE ACTION KILLED (E32+E07 C8b, 28.09.2026; AUDIT-1.2.42 section 9, the
 * owner's answer (A) of 28.09). The undo puts back resources and the incident's
 * state, never a death (`killCharacter`, chapter.mjs): a Reroll of the Finishing blow
 * that killed replayed a miss over a dead victim - the grid's XI05, red on I8 since
 * C1. The death stands and the Reroll is refused, here whatever asked for it, and a
 * player's packet already at the bridge's guard (`crisisUndoRefusal`). The receipt's
 * `killed` is written by the action's own `finishIncident` and `checkVictimSpent`, so
 * a death from the Students list or the GM's close is not the action's.
 */
async function undoLastCrisis({ actorId, key }) {
    const live = murderState();
    const receipt = live?.lastCrisis ?? null;
    if (!receipt) return false;
    if (receipt.actorId !== actorId || receipt.key !== key) {
        warn(`Reroll: the recorded crisis action (${receipt.key} by ${receipt.actorId}) is not the one being replayed.`);
        return false;
    }
    if (crisisKilled(receipt)) {
        warn(`Reroll: ${receipt.key} by ${receipt.actorId} killed ${receipt.killed.join(", ")}; the death stands and nothing is taken back.`);
        return false;
    }

    /*
     * THE INCIDENT IT WAS TAKEN IN, AS THE ACTION LEFT IT (E32+E07 fix r1-G3, 02.10.2026;
     * review C-M2). The rewind below was the one whole-state write left without `expect`:
     * a close, a pass or a stage move queued while the documents below were put back was
     * overwritten by it - measured by the review, a Leave a clue's undo and `endMurder`
     * started together left the closed incident running at `incident`, its close hooked
     * once. It is held to the incident's `openedAt` and to what the action left of the
     * moves `crisisUndoRefusal` names (`after`), asked here before anything is put back
     * (and refused while this browser is closing it, `endMurder`) and again by the rewind
     * itself. A refusal here changes nothing; one at the rewind, from a close that began
     * while the documents were put back, has put them back and rewinds nothing - the GMs
     * are told (`rerollLost`). The replay's own writes after a rewind are an action's like
     * any other's.
     */
    const held = { openedAt: live.openedAt ?? null, ...(receipt.after ?? {}) };
    if (closing.has(String(live.openedAt ?? "open")) || !stillHolds(held)) {
        warn(`Reroll: the incident that ${receipt.key} by ${receipt.actorId} was taken in has closed or moved on; nothing is taken back.`);
        return false;
    }

    // The Remnant it left. Deleted directly rather than through
    // `removeRemnant`, which refuses reinforced traces - and a critical leaves
    // exactly those. This is not the killer scrubbing a trace away; it is a roll
    // that no longer happened.
    if (receipt.remnant?.id) {
        try {
            const scene = receipt.remnant.sceneId
                ? game.scenes.get(receipt.remnant.sceneId)
                : null;
            await scene?.tokens?.get(receipt.remnant.id)?.delete();
        } catch (err) {
            error("Could not take back the Remnant a rerolled crisis action left", err);
        }
    }

    /*
     * The thing a use spent.
     *
     * Put back rather than remade: it is the same object in the same slot, and
     * using it up only ever wrote a flag. Set to `false` rather than removed,
     * because deleting a flag key needs a forced replacement in this Foundry and
     * a flag that cannot be cleared is worse than one that reads false.
     *
     * What does NOT come back is the readied state. Using a thing puts it down
     * as well, and with one hand (E9) the character may be holding something
     * else by now; a Reroll that quietly swapped what is in somebody's hand
     * would be a worse surprise than an item that needs picking up again.
     */
    if (receipt.usedItemId) {
        try {
            await game.actors.get(actorId)?.items?.get(receipt.usedItemId)
                ?.setFlag(MODULE_ID, ITEM_FLAGS.broken, false);
        } catch (err) {
            error("Could not give back the item a rerolled crisis action used", err);
        }
    }

    // The weapon an unarmed attack improvised.
    if (receipt.itemId) {
        try {
            await game.actors.get(actorId)?.items?.get(receipt.itemId)?.delete();
        } catch (err) {
            error("Could not take back the improvised weapon a rerolled attack granted", err);
        }
    }

    // The wear the swing took (E32+E07 C8). Back in the hand only when the hand is
    // empty: the break put it down, and with one hand (E9) the character may have
    // readied something else since - see the thing a use spent, above. A wear that
    // did not break it left it in the hand, and the hand is not empty of it: the
    // first reading of this counted the knife itself and put it down (A2, 28.09).
    if (receipt.wore?.itemId) {
        try {
            const item = game.actors.get(actorId)?.items?.get(receipt.wore.itemId);
            const other = item ? readiedItems(item.parent).some(i => i.id !== item.id) : true;
            await item?.update({
                [`flags.${MODULE_ID}.${ITEM_FLAGS.wear}`]: receipt.wore.wear,
                [`flags.${MODULE_ID}.${ITEM_FLAGS.broken}`]: false,
                [`flags.${MODULE_ID}.${EQUIPPED_FLAG}`]: receipt.wore.equipped && !other
            });
        } catch (err) {
            error("Could not give back the wear a rerolled swing took", err);
        }
    }

    // The chat card describing the old outcome. The replay posts its own, and
    // two contradictory accounts of one action is exactly what Reroll exists to
    // avoid - see the note at the top of reroll.mjs about the dice.
    if (receipt.messageId) {
        try {
            await game.messages.get(receipt.messageId)?.delete();
        } catch {
            // A message somebody already cleared is not a problem.
        }
    }

    const actor = game.actors.get(actorId);
    await restoreResource(actor, "stress", receipt.actorStress);
    await restoreResource(actor, "hitPoints", receipt.actorHp);
    const victim = receipt.victimId ? game.actors.get(receipt.victimId) : null;
    await restoreResource(victim, "hitPoints", receipt.victimHp);
    await restoreResource(victim, "stress", receipt.victimStress);

    // The state wholesale, receipt included: the replay writes a fresh one.
    // Split on the way back in, because the receipt holds the MERGED shape -
    // it was taken from `murderState()` - and putting it back unsplit would
    // return every name to world data (LIVE-001).
    try {
        if (!await restoreState(receipt.state ?? {}, { expect: held })) {
            warn(`Reroll: the incident that ${receipt.key} by ${receipt.actorId} was taken in closed or moved on while it was taken back; its state is not rewound.`);
            return false;
        }
    } catch (err) {
        error("Could not rewind the incident state for a Reroll", err);
        return false;
    }

    log(`Reroll: took back ${receipt.key} by ${game.actors.get(actorId)?.name ?? actorId}.`);
    return true;
}

async function restoreResource(actor, field, value) {
    if (!actor || typeof value !== "number") return;
    if (resourceValue(actor, field) === value) return;
    try {
        await automatedUpdate(actor, { [`system.resources.${field}.value`]: value });
    } catch (err) {
        error(`Could not restore ${field} while taking a crisis action back`, err);
    }
}

/* ==========================================================================
 * RUNNING OUT
 * --------------------------------------------------------------------------
 * A victim whose Health and Sanity are both full of marks has nothing left to
 * spend, and the incident is over whether or not anybody presses a button.
 *
 * This used to wait for a Finishing Blow. The victim kept taking turns at zero
 * and zero, the drain kept finding nothing to take, and the table sat looking at
 * a fight that had already ended - until a GM noticed and clicked. Every route
 * into that state now ends it: the drain, damage from a crisis action, and a
 * GM editing the sheet by hand.
 *
 * Deliberately NOT scored as a Finishing Blow. Nobody rolled it, so nobody earns
 * what a Finishing Blow grants - the critical's free Stage 6 action least of
 * all. The incident simply stops and Stage 6 opens.
 * ========================================================================== */

/** Both tracks full: Health and Sanity are reverse resources, marks count up. */
function isSpent(actor) {
    if (!actor) return false;
    return resourceValue(actor, "hitPoints") >= resourceMax(actor, "hitPoints")
        && resourceValue(actor, "stress") >= resourceMax(actor, "stress");
}

/**
 * End the incident if the victim has run out.
 *
 * @param {string[]} [done]  Lines for the outcome card, when called from one.
 * @param {string[]} [killed]  The crisis action's receipt's `killed`, when a crisis
 *   action's own resolution asks: the victim is added to it if this killed them.
 * @returns {Promise<boolean>} true if this ended the incident.
 */
async function checkVictimSpent(done = null, killed = null) {
    if (!game.user.isGM) return false;

    const state = murderState();
    if (!state || state.stage !== "incident") return false;

    const victim = game.actors.get(state.victimId);
    if (!isSpent(victim)) return false;

    // One killer: the incident is over and closing it is bookkeeping.
    //
    // TWO killers: it is a ruling, so it is asked. The accomplice may be owed
    // the turn they were part-way through, the pair may want a last trace laid
    // between them, and slamming the incident shut the instant the victim runs
    // out takes that away without anyone choosing it. Asked rather than assumed
    // because the guide does not say, and the wrong silent default here is one
    // nobody can undo.
    if (killerIds(state).length > 1) {
        const names = killerIds(state)
            .map(id => game.actors.get(id)?.name).filter(Boolean)
            .map(n => foundry.utils.escapeHTML(n)).join(" & ");
        const now = await DialogV2.confirm({
            classes: ["drpg-panel"],
            window: { title: game.i18n.localize("DRPG.Murder.ranOutTitle") },
            content: dialogContent(`<div>
                <p>${game.i18n.format("DRPG.Murder.ranOutTwoKillers", {
                    victim: foundry.utils.escapeHTML(victim.name), killers: names
                })}</p>
                <p class="notes">${game.i18n.localize("DRPG.Murder.ranOutTwoKillersNote")}</p>
            </div>`),
            yes: { label: game.i18n.localize("DRPG.Murder.ranOutEndNow") },
            no: { label: game.i18n.localize("DRPG.Murder.ranOutKeepGoing") },
            rejectClose: false
        });
        if (!now) return false;
    }

    // Against the incident it read (E32 C4): the hook's check and the action's, or two
    // updates, cannot both run the victim out - the second writes nothing and stops here.
    if (!await writeState({ stage: "resolution", endedBy: "ranOut" },
        { expect: { stage: "incident", openedAt: state.openedAt } })) return false;

    const line = game.i18n.format("DRPG.Murder.ranOut", { name: victim.name });
    // `done` is printed into a card with `innerHTML`, and a name is its owner's to
    // write (E02, audit S04-10); the GM's copy below escapes the whole line itself.
    if (done) done.push(foundry.utils.escapeHTML(line));

    await whisperToGms(`<h3>${game.i18n.localize("DRPG.Murder.ranOutTitle")}</h3>
        <p>${foundry.utils.escapeHTML(line)}</p>
        <p>${game.i18n.localize("DRPG.Murder.resolutionNote")}</p>`);

    // The death itself is the chapter's business, not the incident's: it clears
    // the inventory, drops the Truth Bullet ledger entries and stamps when it
    // happened. Failing it must not leave the incident half-ended, so the stage
    // has already moved by the time this runs.
    try {
        const { killCharacter, isDeadForGm } = await import("./chapter.mjs");
        if (!isDeadForGm(victim) && await killCharacter(victim)) killed?.push(victim.id);
    } catch (err) {
        error(`Could not record ${victim.name}'s death when they ran out`, err);
    }

    log(`${victim.name} ran out of Health and Sanity; the incident ended by itself.`);
    return true;
}

/** Five times the victim's remaining Health; free once they are at zero. */
function finishingBlowThreshold(state) {
    const victim = game.actors.get(state.victimId);
    if (!victim) return 0;
    const left = resourceMax(victim, "hitPoints") - resourceValue(victim, "hitPoints");
    return Math.max(0, left * INCIDENT.finishingBlowPerHp);
}

/** @returns the placed Remnant, so a Reroll can take it back. */
/**
 * The indirect victim's overrides for one crisis action, or nothing.
 *
 * The guide gives whoever dies to a trap their own table (p. 20) rather than a
 * modifier on the killer-facing one. Only the fields that genuinely differ are
 * carried on `def.indirectVictim`, so the two tables cannot drift apart in the
 * parts they share.
 */
function indirectOverride(def, side) {
    if (side !== "victim") return null;
    if (!murderState()?.indirect) return null;
    return def.indirectVictim ?? null;
}

async function applyRemnant(actor, visibility, def, band, done, reinforced = false, side = null) {
    if (!visibility) return null;

    const override = indirectOverride(def, side);
    const forced = reinforced
        || Boolean(def.criticalReinforced && band === "critical")
        || Boolean(override?.reinforced?.[band]);
    // "Ofiara pozostawia 2 Reinforced Incident Remnants" - the one place in the
    // module where a single action leaves more than one trace.
    const count = Math.max(1, override?.count?.[band] ?? 1);

    let last = null;
    for (let i = 0; i < count; i++) {
        last = await dropRemnant(actor, {
            type: def.remnantType ?? "incident",
            visibility,
            tiedToCrime: true,
            reinforced: forced,
            action: "incident",
            note: def.label
        });
    }

    // Never the exact band - see `traceFeedback` in remnants.mjs. Gated on
    // `band` rather than a roll object because that is all this function
    // ever had: Hope or a critical tells the killer/victim what they left,
    // a plain Despair does not.
    if (last && traceFeedback({ isCritical: band === "critical", withHope: band === "hope" }, last)) {
        done.push(count > 1
            ? plural("DRPG.Murder.leftRemnants", { n: count })
            : game.i18n.localize("DRPG.Murder.leftRemnant"));
    }
    return last ?? null;
}

/** Damage the killer deals. Health and Sanity are reverse resources. */
async function applyDamage(actor, state, def, band, done, failed = false, choice = null, weapon = null) {
    const table = failed ? def.failureDamage : def.damage;
    let hit = table?.[band];

    // A weapon attack scales on the tool rather than reading from a table.
    //
    // Unarmed is not tier 0 - the guide treats "no weapon" as its own case:
    // the attack is made at disadvantage and, on a success, produces a weapon
    // rather than using one. So an unarmed hit deals the bare 1, and the tool
    // it improvises is handed over by `grantImprovisedWeapon`.
    //
    // The weapon is the one the roll swung, read as it was swung (E32+E07 C8): its
    // tier even if it is broken by now.
    if (!failed && def.weaponDamage) {
        const { tier } = await chooseWeapon(actor, weapon);
        const amount = band === "critical"
            ? def.weaponDamage.critical(tier)
            : def.weaponDamage.normal(tier);
        hit = { hp: amount };
    }

    // The critical Strike lets the killer choose, and now they have.
    //
    // This used to push "the killer chooses" into the summary and apply nothing
    // at all - a hit that had landed, been announced and cost a turn, but left
    // the victim's sheet untouched until a GM noticed and marked it by hand.
    // `choice` comes from the killer's own client, asked while the dice were
    // still on screen. Without one - an older client, a dismissed window - the
    // old behaviour stands rather than the engine picking for them.
    if (hit?.choice) {
        if (!choice) {
            done.push(game.i18n.localize("DRPG.Murder.killerChooses"));
            return;
        }
        hit = { [choice]: def.damage?.criticalAmount ?? 2 };
    }
    if (!hit) return;

    const victim = game.actors.get(state.victimId);
    if (!victim) return;

    // Sanity past a full track lands on Health, as the drain's does (S04-05): the hit
    // clamped each resource on its own, so a Sanity hit on a full Sanity marked nothing.
    await takeReserves(victim, { hitPoints: hit.hp ?? 0, stress: hit.stress ?? 0 }, done);
}

/**
 * Mark a loss on an actor's reserves - Sanity first, and what Sanity cannot take on
 * Health (E32+E07 C7, 28.09.2026; audit S04-05) - and say in `done` what landed:
 * `landedNote`. Health past its last point is lost; the incident reads a victim with
 * both tracks full as spent (`isSpent`). Nothing landed is nothing written and nothing
 * said. Returns whether anything landed.
 */
async function takeReserves(actor, { hitPoints = 0, stress = 0 }, done) {
    const sanity = reserveChange(actor, "stress", -stress);
    const health = reserveChange(actor, "hitPoints", -(hitPoints + sanity.overflow));
    const update = { ...health.update, ...sanity.update };
    if (!Object.keys(update).length) return false;
    await automatedUpdate(actor, update);
    const note = landedNote(actor, [health, sanity]);
    if (note) done.push(note);
    return true;
}

/**
 * What a loss came to, as the card says it (S04-05): the actor's players read "You lose
 * 1 Health." and everyone else - the GMs, the other side - "Aiko loses 1 Health.", each
 * sent only their own line (secret.mjs `youOrThem`, `wordsFor`).
 */
function landedNote(actor, changes) {
    const them = reserveNote({ name: foundry.utils.escapeHTML(actor.name), you: false }, changes);
    if (!them) return "";
    return youOrThem(ownerIdsOf(actor), { you: reserveNote({ you: true }, changes), them });
}

/**
 * Self-defence opening the victim's way out.
 *
 * Guide, the Samoobrona row: Hope unlocks "obie akcje kryzysowe rozwiązania
 * ofiary", Despair only "odwrócenie ról", and a critical unlocks both AND stops
 * the drain - "Ofiara przestaje tracić hp i stress". Either success also
 * "blokuje akcję kryzysową: Samoobrona", so there is exactly one attempt at it.
 *
 * Written as config rather than as a special case here, so a second gated
 * action later is a table entry and not another branch - see `unlocks` and
 * `lockedUntil` in CRISIS_ACTIONS.
 */
async function applyUnlocks(state, def, key, band, done) {
    const opened = def.unlocks?.[band];
    if (!opened?.length && !def.blocksSelf) return;

    const patch = {};

    if (opened?.length) {
        const unlocked = new Set(state.unlocked ?? []);
        for (const id of opened) unlocked.add(id);
        patch.unlocked = Array.from(unlocked);
        done.push(game.i18n.format("DRPG.Murder.unlockedActions", {
            names: opened.map(id => CRISIS_ACTIONS[id]?.label ?? id).join(", ")
        }));
    }

    // One attempt: the action closes itself for the rest of the incident.
    //
    // A separate list rather than a huge number in `blocked`. That store is
    // decremented every round by `passTurn`, and world state is stored as JSON -
    // `Infinity` serialises to `null`, which reads back as "not blocked at all".
    if (def.blocksSelf) {
        const spent = new Set(state.spent ?? []);
        spent.add(key);
        patch.spent = Array.from(spent);
    }

    if (def.criticalStopsDrain && band === "critical") {
        patch.drainStopped = true;
        done.push(game.i18n.localize("DRPG.Murder.drainStopped"));
    }

    /*
     * G-18: the critical also hands over one of the doors it just opened,
     * already open. Stamped with the round rather than counted down, so it
     * expires on its own when play comes back around.
     *
     * Written in the same patch as the unlocks deliberately: the two are one
     * outcome, and a second write would let a client redraw between them and
     * show a free take on an action that is still locked.
     */
    if (def.criticalFreeResolution && band === "critical") {
        patch.freeResolution = { side: def.side, turn: state.turn };
        done.push(game.i18n.localize("DRPG.Murder.freeResolution"));
    }

    await writeState(patch);
}

async function applyHindrance(state, def, band, done) {
    if (!def.hinders) return;

    const target = def.side === "killer" ? "victim" : "killer";
    const store = band === "critical" ? "blocked" : "hindered";
    const next = { ...(state[store] ?? {}) };
    next[target] = { ...(next[target] ?? {}) };
    for (const key of def.hinders.actions) next[target][key] = def.hinders.turns;

    await writeState({ [store]: next });
    done.push(game.i18n.format(
        band === "critical" ? "DRPG.Murder.blockedActions" : "DRPG.Murder.hinderedActions",
        { n: def.hinders.actions.length, turns: def.hinders.turns }
    ));
}

/**
 * The three decisions a newcomer can make instead of rolling.
 *
 * All three change WHO is in the fight rather than what happens in it, so none
 * of them touch damage, Remnants or the turn order - `resolveCrisisAction`'s
 * third-party branch already keeps them out of the victim→killer rotation.
 *
 *   joinsKiller     they side with the attacker and stay in as a killer.
 *   alsoTakesThird  Double role reversal: `swapsRoles` has already turned the
 *                   victim into the killer, and this puts the newcomer beside
 *                   them, which is what makes it *double*.
 *   leavesIncident  Averted eyes. They were never part of it; the incident
 *                   carries on between the original two.
 *
 * Written after `swapRoles` on purpose: the swap rewrites `killerId` and
 * `victimId`, and "join the killers" has to mean whoever holds that seat now.
 *
 * Neither branch marks the choice as spent any more - `resolveCrisisAction`
 * does that for every third-party action before any of this runs. Averted eyes
 * still clears it, and means to: nulling `thirdId` reopens the slot for the
 * next person who walks in - somebody else (`thirdLeaves`).
 */
async function applyThirdPartyChoice(actor, def, done) {
    if (def.joinsKiller || def.alsoTakesThird) {
        // The side keeps the turn it is holding. Joining does not hand the
        // newcomer the current one - `killerTurnId` stays with whoever already
        // had it, and `passTurn` gives the next one to the accomplice.
        const state = murderState();
        await writeState({
            thirdSide: "killer",
            killerTurnId: state?.killerTurnId ?? state?.killerId ?? null
        });
        done.push(game.i18n.format("DRPG.Murder.thirdJoined", {
            name: foundry.utils.escapeHTML(actor.name)
        }));
        return;
    }

    if (def.leavesIncident) {
        await thirdLeaves(actor);
        done.push(game.i18n.format("DRPG.Murder.thirdLeft", {
            name: foundry.utils.escapeHTML(actor.name)
        }));
    }
}

/**
 * THE THIRD WALKS OUT, AND STAYS OUT (E32+E07 C10, 02.10.2026; audit S04-21): Averted eyes,
 * and an Escape together that failed - "Only you get out" (config.mjs). The seat is
 * emptied for somebody else, and the third goes on `departed` for the rest of the incident,
 * which `maybeThirdParty` and `thirdPartyEnters` pass over.
 *
 * Until this commit Averted eyes emptied the seat and nothing remembered who had sat in
 * it, so the same student's token stepping back into the room was a newcomer with a fresh
 * free choice (the grid's TP08); and a failed escape left the third seated, their choice
 * spent, so the next student in was "a fourth" and crowded the incident out (TP10) - both
 * red at ac5ae66 (e32run/g5f). A failed escape loses the betrayal offer either way (the
 * owner's Q2 (b)); with the third gone, `betrayalCandidate` finds nobody to make it.
 *
 * Back to one killer, so the rotation collapses to them - otherwise the side could be
 * left waiting on a turn belonging to somebody who has walked out of the incident. Only
 * while `actor` still holds the seat: the write is queued (`incidentWrite`), and a seat
 * that changed hands in the meantime is not theirs to empty.
 */
async function thirdLeaves(actor) {
    const state = murderState();
    return writeState({
        thirdId: null, thirdSide: null, thirdActed: false,
        killerTurnId: state?.killerId ?? null,
        departed: [...new Set([...(state?.departed ?? []), actor.id])]
    }, { expect: { thirdId: actor.id } });
}

async function swapRoles(state, band, done) {
    const victim = game.actors.get(state.victimId);
    if (band !== "despair" && victim) {
        await automatedUpdate(victim, {
            "system.resources.stress.value": 0,
            "system.resources.hitPoints.value": 0
        });
    }
    // Everything that described the OLD arrangement of the fight is cleared,
    // not only the two hindrance stores.
    //
    // `unlocked`, `spent` and `drainStopped` are all statements about a
    // particular victim: which ways out they had bought, that they had used
    // their one Self-defence, and that a critical had stopped their bleeding.
    // Carrying them across a reversal handed all three to the person who just
    // became the victim - so the new victim started with Survive and Role
    // reversal already open, could never attempt Self-defence because somebody
    // else had spent it, and did not bleed at all. That last one guts the
    // reversal outright: the guide's whole point is "tym razem to zabójca traci
    // hp/stres".
    await writeState({
        killerId: state.victimId,
        victimId: state.killerId,
        // The chair moved, so the turn moves with it. Left pointing at the old
        // killer, the killers' side would be waiting on a turn belonging to the
        // person who is now the victim, and nobody could act.
        killerTurnId: state.victimId,
        hindered: { victim: {}, killer: {} },
        blocked: { victim: {}, killer: {} },
        unlocked: [],
        spent: [],
        drainStopped: false,
        advantageNext: { victim: null, killer: null },
        // The killer's Despair-success opener took Role reversal away from the
        // person who was the victim THEN. They are the killer now, and the
        // restriction is not a property of the chair they are sitting in.
        deniedToVictim: [],
        /*
         * The case is not the case any more - but HOW BIG it is, is (Z4).
         *
         * Guide, p. 26: "Jeśli mordercą jest inna osoba niż ta, która rozpoczęła
         * incydent, DM przygotowuje nową pulę Key Remnants." The clues were
         * planned around a killer who is now the victim, so every one of them
         * narrows the suspect pool towards the wrong person, and every one has
         * to be written again. That is what `keyRemnantsStale` says and it does
         * not change.
         *
         * WHAT CHANGED IS THAT THE COUNT SURVIVES. This used to write
         * `keyRemnants: null` along with it, and the number is not part of the
         * authored work: it came off the opening roll - five on Hope, four on
         * Despair, three on a critical - and it is a statement about how cleanly
         * the incident began, which a reversal does not undo. Nulling it took
         * the slots off the Investigation Dashboard, took the "still owed" line
         * out of the tracker, and left G-32 counting missing clues against a
         * plan of no size at all. The GM was then asked to write "some" clues.
         *
         * So the key is simply absent from this patch: `writeState` merges, so
         * what it does not name it does not touch. The dashboard is a live
         * region (R19), so the slots redraw against the same number without the
         * GM closing the window.
         */
        keyRemnantsStale: true
    });

    done.push(game.i18n.localize("DRPG.Murder.rolesSwapped"));

    // Said out loud to the GMs, because it is a job rather than a state change:
    // somebody has to sit down and write the clues again before the
    // Investigation. The sentence carries the NUMBER now - it used to say
    // "five" whatever the opening roll had decided, and after Z4 the count is
    // the one thing about the old plan that survives, so it is also the one
    // thing the GM does not have to decide again.
    await whisperToGms(`<p class="drpg-warning">${
        game.i18n.format("DRPG.Murder.keyRemnantsStale", { n: state.keyRemnants })}</p>`);
}

async function finishIncident(state, key, band, done, killed = null) {
    // WHICH action ended it, not only that something did. An incident that
    // ended in a Finishing Blow and one that ended with two people walking out
    // of the door both landed on stage "resolution" and were indistinguishable
    // afterwards - which is how the post-incident checklist came to promise a
    // body in a room after Escape together. See `afterIncident`.
    if (!await writeState({ stage: "resolution", endedBy: key },
        { expect: { stage: "incident", openedAt: state.openedAt } })) return false;
    done.push(game.i18n.localize(
        key === "finishingBlow" ? "DRPG.Murder.victimDead" : "DRPG.Murder.incidentEnded"));

    // The killer can see their own traces from Stage 6 onwards - guide p. 26.
    if (key === "finishingBlow") {
        await whisperToGms(`<p>${game.i18n.localize("DRPG.Murder.resolutionNote")}</p>`);

        // And the victim actually dies.
        //
        // This said "the victim is dead" in the log and left them alive in the
        // world: no `FLAGS.deceased`, no dead overlay on the token, still
        // counted as a person in the room by `othersInRoom`, still on the
        // living roster the Class Trial votes from. The one route the engine
        // owns end to end was the one route that did not record the death -
        // running out of Health and Sanity has always called this (see
        // `checkVictimSpent`), and so has the GM's own screen.
        //
        // After the stage write, deliberately: a death that fails must not
        // leave the incident half-ended, and Stage 6 needs the state either way.
        try {
            const { killCharacter, isDeadForGm } = await import("./chapter.mjs");
            const victim = game.actors.get(state.victimId);
            if (victim && !isDeadForGm(victim) && await killCharacter(victim)) killed?.push(victim.id);
        } catch (err) {
            error("Could not record the victim's death after the Finishing Blow", err);
        }
    }
}

/**
 * Move a running incident to Stage 6 without a Finishing Blow.
 *
 * A victim can stop being alive by routes this engine does not own: the GM's
 * own "A character dies", a Despair Call, a ruling made out loud. Until now
 * every one of those left the incident sitting at stage "incident" around a
 * corpse - `isCleaner` stayed false, the killer never got the clean-up screen,
 * and the whole of Stage 6 was unreachable by any path except a Finishing Blow.
 *
 * Same two effects `finishIncident` has, and deliberately no more: the incident
 * is not CLOSED here. Closing it is `endMurder`, which wipes the state and puts
 * up the checklist - and the killer needs the state alive to clean under it.
 */
export async function beginResolution(reason = "victimKilled") {
    if (!game.user.isGM) return null;

    const state = murderState();
    if (!state?.active || state.stage !== "incident") return null;

    if (!await writeState({ stage: "resolution", endedBy: reason },
        { expect: { stage: "incident", openedAt: state.openedAt } })) return null;
    await whisperToGms(`<p>${game.i18n.localize("DRPG.Murder.resolutionNote")}</p>`);
    log(`Incident moved to Stage 6 (${reason}).`);
    return murderState();
}

/** One turn's cost to the victim: Sanity first, then Health. */
async function drain(state, amount, done) {
    // A critical Self-defence buys the bleeding stopping - guide: "Ofiara
    // przestaje tracić hp i stress."
    if (state.drainStopped) {
        done.push(game.i18n.localize("DRPG.Murder.drainStopped"));
        return;
    }

    const victim = game.actors.get(state.victimId);
    if (!victim) return;
    // The note says what was marked, not the turn's amount (S04-05).
    await takeReserves(victim, { stress: amount }, done);
}

/* The second try a Hope miss earned, named by the action it was earned on (S04-32,
   `crisisSituational`): one per side, so a later miss of another action takes its place. */
async function grantAdvantage(side, key) {
    const state = murderState();
    await writeState({ advantageNext: { ...(state?.advantageNext ?? {}), [side]: key } });
}

async function clearAdvantage(side, key) {
    const state = murderState();
    const earned = state?.advantageNext?.[side];
    if (earned !== key && earned !== true) return;
    await writeState({ advantageNext: { ...state.advantageNext, [side]: null } });
}

async function spendStress(actor, done) {
    // The same write the clean-up makes (cleanup.mjs `markResolutionStress`);
    // `false` means the track was full, and the blood branch below pays instead.
    // What it marked is read off the sheet before and after it (S04-05), not assumed.
    const { markResolutionStress } = await import("./cleanup.mjs");
    const before = reserveOf(actor, "stress").left;
    if (await markResolutionStress(actor)) {
        const note = landedNote(actor, [{ key: "stress", landed: before - reserveOf(actor, "stress").left }]);
        if (note) done.push(note);
        return;
    }

    /*
     * NO SANITY LEFT, SO IT IS PAID IN BLOOD (Z3).
     *
     * This branch used to be `return` - the action went through and cost
     * nothing, which was the quiet half of the same deadlock the guard in
     * `takeCrisisAction` describes: a victim on an empty stress track got their
     * way out free, and the incident lost the one currency that was still
     * moving it towards an ending.
     *
     * `automatedUpdate` is what carries it, so the Wounded marker arrives the
     * way it always does - `states.mjs` watches `updateActor` and does not care
     * who wrote the change. And a full Health track does not kill: the incident
     * ends because both tracks are now full, which is `isSpent`, and the caller
     * asks `checkVictimSpent` two lines later.
     */
    const health = reserveChange(actor, "hitPoints", -RESOLUTION_HEALTH_COST);
    if (!health.landed) return;

    await automatedUpdate(actor, health.update);
    done.push(landedNote(actor, [health]));
}

/**
 * Whether this GM's browser holds the running incident's cast (the round-2 review's
 * M1): a turn passed, or a third let in, from a browser that lost it wrote a rotation
 * worked out from nobody. Said to the GM, and pointed at what puts it back.
 */
function castHeldHere(state) {
    if (!castStore.isHydrated()) {
        ui.notifications.warn(game.i18n.localize("DRPG.Murder.castNotArrived"));
        return false;
    }
    if (state?.killerId && state?.victimId) return true;
    ui.notifications.warn(game.i18n.localize("DRPG.Murder.castMissingHere"));
    return false;
}

/**
 * WHO ACTS NEXT (`passTurn`). A ROUND IS: the victim, then EVERY killer in turn,
 * then back to the victim. Not victim/killer strictly alternating - that gave a second
 * killer the victim's own turn as breathing room, which is not what
 * `killerTurnId` rotating between them was ever meant to buy them. With
 * two killers the old rule read `turnSide` as "victim" or "killer" and
 * flipped it every pass, so the sequence ran victim, killer(A), victim,
 * killer(B), victim... - `killerTurnId` rotated correctly underneath, but
 * the side switched back to the victim a turn too early every time.
 *
 * From the victim's turn, the round always restarts at the FIRST killer -
 * not "whoever goes next in the rotation", which is `state.killerTurnId`
 * left over from the round before. From a killer's turn, the round only
 * returns to the victim once the LAST killer in `killerIds` has gone;
 * otherwise it stays on the killers' side and steps to the next one.
 *
 * A TRAP HAS ONE SIDE (E32+E07 C9, 28.09.2026; audit S04-14). Its builder is not in the
 * room, and a third who threw in with them holds no seat while the trap runs (settings.mjs
 * `incidentSeats`), so nobody on the killers' side could ever act: every victim's action
 * handed the turn to an empty chair until a GM pressed Pass, and the drain waited with it.
 * In a trap the victim's turn passes to the victim - the round turns, the hindrances drop,
 * the drain lands - which is the handbook's "alone with a trap".
 *
 * NOR DOES A DEAD KILLER TAKE A TURN (S04-42). The rotation skips every killer dead to the
 * GMs (`isDeadForGm`); with none alive it runs as a trap's does, and the GMs are told and
 * offered the close (`killerFell`).
 */
function nextTurn(state) {
    const killers = killerIds(state);
    const living = killers.filter(id => !isDeadForGm(game.actors.get(id)));
    if (state.indirect || !living.length) return { next: "victim", killerTurnId: state.killerTurnId };
    if (state.turnSide === "victim") return { next: "killer", killerTurnId: living[0] };
    const at = killers.indexOf(state.killerTurnId ?? killers[0]);
    const after = at >= 0 ? killers.slice(at + 1).find(id => living.includes(id)) : undefined;
    return after ? { next: "killer", killerTurnId: after } : { next: "victim", killerTurnId: state.killerTurnId };
}

export async function passTurn() {
    if (!game.user.isGM) return null;
    const state = murderState();
    if (!state || state.stage !== "incident") return null;
    if (!castHeldHere(state)) return null;

    const { next, killerTurnId } = nextTurn(state);

    // The round completes once per full lap of the killers' side, not once
    // per killer - see the note above. Everything below that used to key off
    // "it is the victim's turn" still does, and now only fires that often.
    const turn = next === "victim" ? state.turn + 1 : state.turn;

    /*
     * A HINDRANCE COUNTS THE TURNS OF THE SIDE IT HINDERS (E32+E07 C9, 28.09.2026; audit
     * S04-16). Pin them down and Keep your distance promise "two turns of disadvantage",
     * and both hinder the victim. The counters used to drop at the top of each round
     * (killer -> victim), so a Pin's 2 was 1 before the victim's first hindered turn and
     * gone before their second: one turn, criticals (`blocked`) the same. They drop now
     * when the hindered side's turn ends - the victim's as it passes, the killers' side's
     * once its last killer has gone - and go at 0.
     */
    const ending = state.turnSide === "killer" && next === "killer" ? null : state.turnSide;
    const decay = store => {
        const out = structuredClone(state[store] ?? {});
        const counters = out[ending] ?? {};
        for (const [key, turns] of Object.entries(counters)) {
            if (turns > 1) counters[key] = turns - 1;
            else delete counters[key];
        }
        return out;
    };

    const patch = { turnSide: next, turn, killerTurnId };
    if (ending) {
        patch.hindered = decay("hindered");
        patch.blocked = decay("blocked");
    }

    // The round as it was read (E32 C4): two passes of one turn pass it once.
    if (!await writeState(patch, { expect: { turn: state.turn, turnSide: state.turnSide, killerTurnId: state.killerTurnId } })) return null;

    if (next === "victim") {
        const done = [];
        await drain(murderState(), state.indirect ? INCIDENT.drain.indirect : INCIDENT.drain.direct, done);
        if (done.length) await whisperToGms(`<p>${done.join("<br>")}</p>`);
    }

    return murderState();
}

/**
 * A KILLER DIED IN THE FIGHT (E32+E07 C9, 28.09.2026; audit S04-42) - a Despair Call, the
 * Students list, anything but the fight's own ending. Until 1.2.66 the turn stayed with the
 * dead killer until a GM pressed Pass, the next round handed it back to them, and with every
 * killer dead nobody said the fight had no one left to fight it. Now the turn moves on
 * past the dead (`nextTurn`), and once no killer is left alive the GMs are told and the
 * primary GM is offered the close - once an incident: `drpgDeathsChanged` and the flag's
 * `updateActor` can both report one death. A direct murder's alone; a trap's builder
 * never holds a turn. `pass` false leaves the turn to an action being scored on this
 * browser, which passes it itself once it is done.
 */
let noKillerTold = null;

async function killerFell({ pass = true } = {}) {
    const state = murderState();
    if (!state || state.stage !== "incident" || state.indirect) return;
    const killers = killerIds(state);
    const dead = id => isDeadForGm(game.actors.get(id ?? ""));
    if (!killers.some(dead)) return;
    if (pass && state.turnSide === "killer" && dead(state.killerTurnId ?? killers[0])) await passTurn();
    if (!killers.every(dead) || noKillerTold === state.openedAt) return;
    noKillerTold = state.openedAt;
    const words = game.i18n.localize("DRPG.Murder.noKillerLeft");
    await whisperToGms(`<p>${words}</p>`);
    const sure = await DialogV2.confirm({
        classes: ["drpg-panel"],
        window: { title: game.i18n.localize("DRPG.Murder.endMurder") },
        content: `<p>${words}</p><p>${game.i18n.localize("DRPG.Murder.endConfirm")}</p>`,
        rejectClose: false
    });
    const now = murderState();
    if (sure && now?.stage === "incident" && now.openedAt === state.openedAt) await endMurder();
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
function registerIncidentCastSync() {
    /*
     * A PARTICIPANT ASKING WHICH INCIDENT THEY ARE IN, answered by the primary GM
     * alone, about Foundry's own sender, once its store holds the other GMs' copies
     * (E04). Until then every GM answered from its own copy, and a GM whose browser
     * held no cast answered with nothing and emptied the participant's (the cast
     * half of S06-19); a stamp of 0 from a GM holding nothing now replaces nothing.
     * The answer is `castPacket`'s, and a standing one - nothing, or the offer alone -
     * repeats what this GM last sent the asker (`castSent`, fix r1-G1).
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

/* ==========================================================================
 * THE DEATHS A PLAYER MAY KNOW (E05 C10; audit S06-11)
 * --------------------------------------------------------------------------
 * A killing in an incident is the GMs' until the body is found or a GM makes
 * it known (chapter.mjs `killCharacter`, `publishDeath`), and a player's
 * browser reads the deaths it may know from a copy (gm-stores.mjs
 * `deathCopy`): their own character's, and the incident's they were in. Sent
 * by the GM that wrote the row, and on the player's ask - at load, and when a
 * primary GM's world has loaded - answered by the primary alone, about
 * Foundry's `senderId`. Taken only from a GM, addressed to this user.
 * ========================================================================== */

const DEATHS_MINE = "deaths.mine";
const DEATHS_ASK = "deaths.ask";
/** GM -> one player who walked in alone on a body nobody has found (the owner's Q1). */
const DEATHS_FOUND = "deaths.found";

/**
 * GM: the players who may know that this actor died, besides its owners - those of the
 * running incident's seats when this actor is its victim, as `castOwners` gives them now.
 * Counted as at Stage 6, where a trap's killer is let back in: the engine's kill sites run
 * after the stage has moved, and the GM's death dialog runs just before it is offered.
 */
export function incidentKnowers(actor) {
    if (!game.user?.isGM || !actor) return [];
    const state = murderState();
    if (!state?.active || state.victimId !== actor.id) return [];
    return [...castOwners(readCast(), { ...state, stage: "resolution" })];
}

/** Whether this user may know of this death kept by the GMs: a GM, a user named in its row, or an owner of the body. */
export function knowsOfDeath(user, actorId, row = deathStore.get(actorId)) {
    if (!user || !row) return false;
    if (user.isGM) return true;
    if (Array.isArray(row.known) && row.known.includes(user.id)) return true;
    return Boolean(game.actors.get(actorId)?.testUserPermission?.(user, "OWNER"));
}

/**
 * GM: the deaths kept by the GMs that this user may know, a stamp each - the row's newest
 * decision - and, for each body in `also` (dropped here a moment ago), its tombstone's, so a
 * copy that held it lets it go. Nothing of a death the user may not know, not even a stamp.
 * `held`: the bodies the asker's copy holds (its ask's own claim) - each one not among the
 * user's deaths is answered "none, as of now", with one fresh stamp for all of them.
 *
 * A DEATH TAKEN BACK WHILE ITS PLAYER WAS AWAY (E05 fix r2-G3, 27.09.2026; review S2-m5).
 * The tombstone reached a copy only through `also`, sent to whoever was connected at the
 * drop, and an ask named nothing of a body gone - so a copy that held it kept it: measured
 * on the harness (61 R), a kept death revived while its owner's browser was closed was
 * still read dead there after it came back. The ask names what its copy holds now. Every
 * such body the user may not know is answered alike - a row live or dropped, a death
 * published or taken back, a body that never died - at the same stamp: one read from the
 * store's rows (a tombstone's stamp, or its absence for a live row) would tell a console
 * that named any student which of them had died unseen. A copy lets go of a body that its
 * answer names at a newer stamp without a death (gm-stores.mjs `offersCombine`).
 */
export function deathsFor(userId, { also = [], held = [] } = {}) {
    const user = game.users.get(userId);
    const deaths = {}, stamps = {};
    if (!game.user?.isGM || !user || user.isGM) return { deaths, stamps };
    for (const [actorId, row] of Object.entries(deathStore.entries())) {
        if (!knowsOfDeath(user, actorId, row)) continue;
        deaths[actorId] = { chapter: row.chapter ?? null, day: row.day ?? null, timeOfDay: row.timeOfDay ?? null };
        stamps[actorId] = deathStore.newest(actorId);
    }
    for (const actorId of also) if (!(actorId in stamps) && !deathStore.has(actorId)) stamps[actorId] = deathStore.newest(actorId);
    const none = held.filter(actorId => !(actorId in stamps));
    if (none.length) {
        const now = gmStoreStamp();
        for (const actorId of none) stamps[actorId] = now;
    }
    return { deaths, stamps };
}

/** The bodies an ask says its copy holds: this world's actor ids, each once. */
function heldOf(ids) {
    return Array.isArray(ids) ? [...new Set(ids.filter(id => typeof id === "string" && game.actors.has(id)))] : [];
}

/**
 * GM: send one user their deaths (`deathsFor`). Addressed, and only while they are here;
 * nothing while the suite holds the stores or stands in another world. Answers whether it
 * sent: an answer that names nothing is not sent, since a copy takes none.
 */
export function sendDeathsTo(userId, { also = [], held = [] } = {}) {
    const user = game.users.get(userId);
    if (!game.user?.isGM || !user?.active || user.isGM || gmStoresQuiet()) return false;
    const { deaths, stamps } = deathsFor(userId, { also, held });
    if (!Object.keys(stamps).length) return false;
    try {
        game.socket.emit(SOCKET_EVENT, { action: DEATHS_MINE, userId, deaths, stamps }, { recipients: [userId] });
    } catch (err) {
        error("Could not tell a player the deaths they know", err);
        return false;
    }
    return true;
}

/** GM: each of these users sent their deaths, `also` naming bodies just dropped. Answers how many were sent. */
export function tellDeaths(userIds, also = []) {
    let sent = 0;
    for (const userId of new Set(userIds)) if (sendDeathsTo(userId, { also })) sent++;
    return sent;
}

/** After a restore (gm-stores.mjs `restoreCase`): every connected player is sent their deaths again, at their stamps. */
export async function retellDeaths() {
    if (!game.user?.isGM || gmStoresQuiet()) return 0;
    return tellDeaths((game.users ?? []).filter(u => u.active && !u.isGM).map(u => u.id));
}

/** Player: take a GM's answer where it is newer (`deathCopy`), for this world's actors only. */
export async function receiveDeaths(deaths, stamps) {
    const mine = {}, own = {};
    for (const [actorId, s] of Object.entries(stamps ?? {})) {
        if (!game.actors.has(actorId)) continue;
        own[actorId] = Number(s) || 0;
        const row = deaths?.[actorId];
        if (!row || typeof row !== "object") continue;
        mine[actorId] = {
            chapter: Number.isFinite(row.chapter) ? row.chapter : null,
            day: Number.isFinite(row.day) ? row.day : null,
            timeOfDay: typeof row.timeOfDay === "string" ? row.timeOfDay : null
        };
    }
    return deathCopy.receive(mine, own);
}

/** GM: tell one player, by an addressed packet and no document, that they found this body alone. */
export function tellFinder(userId, token, room) {
    const user = game.users.get(userId);
    if (!game.user?.isGM || !user?.active || user.isGM || gmStoresQuiet()) return false;
    try {
        game.socket.emit(SOCKET_EVENT, { action: DEATHS_FOUND, userId, bodyId: token.actor?.id ?? null, name: token.name ?? "", room },
            { recipients: [userId] });
        return true;
    } catch (err) {
        error("Could not tell a player they found a body", err);
        return false;
    }
}

/**
 * ON THIS SCREEN ALONE (E05 C10; the owner's Q1). A body this player may know and the table
 * does not is drawn dead here - Foundry's own "defeated" icon over the token, a child of the
 * token's object, never a status or a flag, which every console would read. Not measured: the
 * harness has no canvas (26.09.2026), so this is a check for a real table.
 */
function markLocalDeath(token) {
    try {
        const actor = token?.actor;
        const show = Boolean(actor) && !game.user.isGM && isDeadForGm(actor) && !isDeceased(actor);
        let icon = token?.children?.find?.(c => c?.name === "drpg-local-dead") ?? null;
        if (!show) {
            if (icon) { token.removeChild(icon); icon.destroy(); }
            return;
        }
        const src = CONFIG.controlIcons?.defeated;
        if (icon || !src || !globalThis.PIXI?.Sprite?.from) return;
        icon = PIXI.Sprite.from(src);
        icon.name = "drpg-local-dead";
        icon.anchor?.set?.(0.5);
        const w = token.w ?? 100, h = token.h ?? 100;
        icon.width = icon.height = Math.min(w, h) * 0.8;
        icon.position.set(w / 2, h / 2);
        icon.alpha = 0.8;
        token.addChild(icon);
    } catch (err) {
        debug("Could not draw a body this player knows of as dead", err);
    }
}

/** Player: ask the primary for the deaths this user may know. */
function askForDeaths(primary = primaryGmId()) {
    if (!primary || game.user.isGM) return;
    try {
        game.socket.emit(SOCKET_EVENT, { action: DEATHS_ASK, held: Object.keys(deathCopy.read() ?? {}) }, { recipients: [primary] });
    } catch (err) {
        error("Could not ask the GM which deaths this client knows", err);
    }
}

function onDeathsSocket(payload, senderId) {
    if (payload?.action === DEATHS_ASK) {
        if (!isPrimaryGm()) return;
        const sender = game.users.get(senderId);
        if (!sender?.active || sender.isGM) return;
        // Asked while the suite holds the stores: answered once it lets them go.
        whenGmStoresAudible().then(() => deathStore.whenHydrated()).then(() => sendDeathsTo(sender.id, { held: heldOf(payload.held) }))
            .catch(err => error("Could not answer a player's deaths", err));
        return;
    }
    if (payload?.action === DEATHS_FOUND) {
        if (game.user.isGM || payload.userId !== game.user.id || !game.users.get(senderId)?.isGM) return;
        const body = game.actors.get(payload.bodyId);
        if (!body) return;
        ui.notifications.info(game.i18n.format("DRPG.Chapter.youFoundBody", {
            name: String(payload.name || body.name), room: String(payload.room ?? "")
        }), { permanent: true });
        return;
    }
    if (payload?.action !== DEATHS_MINE || game.user.isGM) return;
    // A GM's, and addressed to this user: a player cannot hand another a death.
    if (payload.userId !== game.user.id || !game.users.get(senderId)?.isGM) return;
    receiveDeaths(payload.deaths, payload.stamps).catch(err => error("Could not keep the deaths this client knows", err));
}

/** At ready: the copy's listener on every client, and a player's first ask. */
function registerDeathCopy() {
    Hooks.once("ready", () => {
        game.socket.on(SOCKET_EVENT, onDeathsSocket);
        if (game.user.isGM) return;
        askForDeaths();
        Hooks.on("drpgPrimaryReady", primary => askForDeaths(primary));
        Hooks.on("refreshToken", token => markLocalDeath(token));
        Hooks.on("drpgDeathsChanged", () => { for (const t of canvas?.tokens?.placeables ?? []) markLocalDeath(t); });
    });
}

/**
 * THE CAST ENTERED BY HAND (E04; the design's 6.3, the health check's "Enter the
 * cast by hand"). An incident is running and this browser holds nobody in it - its
 * cast went with a lost browser, and no GM who held it is here. The GM names the
 * killer, the victim and a third if there was one; they are written as a decision,
 * with fresh stamps, the turn on the killers' side given to the killer and the
 * third's side left open (nobody can know it any more), and sent to the
 * participants. A GM who held the real cast and comes back later brings it: a
 * field of theirs wins only where it is newer.
 *
 * THE FIGHT WENT WITH IT (E32 C2, 28.09.2026). Since 1.2.66 the round and whose side
 * acts are the cast's (`INCIDENT_FIGHT`), so a lost cast loses them too; with no side
 * to act neither side could, and a pass wrote the round as `undefined + 1`, NaN (read
 * off `passTurn`; the tier-2 test "the cast comes back by hand ..." passes the turn
 * after this). Where this browser reads none, the round starts
 * again at the victim's side, as the fight does (`resolveKillerOpening`); what else the
 * fight held - hindrances, what is spent, the Key Remnants' count - reads as each
 * reader's default until a GM who held it comes back.
 */
export async function enterCast({ killerId = null, victimId = null, thirdId = null } = {}) {
    if (!game.user.isGM || !game.actors.get(killerId ?? "") || !game.actors.get(victimId ?? "")) return null;
    const third = thirdId && game.actors.get(thirdId) ? thirdId : null;
    // Read and written in the incident's queue (E32 C4), as every other write of it.
    await incidentWrite(async () => {
        const previous = readCast();
        const held = murderState() ?? {};
        const round = {
            ...(Number.isFinite(held.turn) ? {} : { turn: 1 }),
            ...(held.turnSide ? {} : { turnSide: "victim" })
        };
        await ownCastWrite(() => castStore.patch(RECORD, { killerId, victimId, killerTurnId: killerId, thirdId: third, thirdSide: null, ...round }));
        pushCastToParticipants(readCast(), previous);
    });
    log(`The incident's cast was entered by hand: ${game.actors.get(killerId)?.name} and ${game.actors.get(victimId)?.name}.`);
    return murderState();
}

/**
 * A world that updated mid-chapter still has the names in world data (LIVE-001,
 * CASE-04). The clause `liftIncidentSecrets` (migrate.mjs, since 1.2.63) runs this
 * once, on the primary GM, after the GM store has the other GMs' copies; it ran
 * from a ready hook on every load until E04.
 *
 * NOTHING LEAVES WORLD DATA BEFORE THE CAST HOLDS IT. The stray names go into the
 * cast at the store's weak stamp and fill-only - a value any GM decided wins - and
 * a name leaves `murderState` only once the cast reads back from storage holding
 * a value for it, written into the world half as it is after the cast's save (read
 * again then: a turn another GM passed during that await stands - the correctness
 * review's M9, the same shape as `liftIntoCast`'s); `murderState` is read back
 * too. A live betrayal offer goes in the same way before its flag is unset, and every
 * flag unset is read back: one that will not go is counted, not assumed gone. Anything
 * counted as kept throws at the end, so the world is not stamped and the next load
 * tries again (E05 fix r1-G1; migrate.mjs, above the lifts - since 1.2.64, so that a
 * world 1.2.63 stamped over names it kept runs this once more). Idempotent: a world
 * already through this has no names in `murderState` and no flags.
 *
 * @returns {Promise<null|{lifted: number, offers: number, flags: number, kept: number}>}  `kept` 0:
 *   anything else throws.
 */
export async function liftIncidentSecrets() {
    if (!isPrimaryGm()) return null;
    if (await castStore.whenHydrated() === "timedOut") {
        throw new Error("the other GMs' copies of the cast did not arrive; the next load tries again");
    }
    // In the incident's queue (E32 C4): a write of the running incident waits for the lift.
    return incidentWrite(async () => {
        const report = { lifted: 0, offers: 0, flags: 0, kept: 0 };

        const stored = game.settings.get(MODULE_ID, SETTINGS.murderState) ?? {};
        /* The names, as in 1.2.63: the method is `liftIncidentMethod`'s and the fight `liftIncidentFight`'s
           (E32 C3), which run after this and tell the participants. */
        const strays = CAST_FIELDS.filter(key => !INCIDENT_METHOD.includes(key) && !INCIDENT_FIGHT.includes(key) && stored[key] != null);
        if (strays.length) {
            await castStore.patch(RECORD, Object.fromEntries(strays.map(key => [key, stored[key]])),
                { weak: true, fillOnly: true, whole: true });
            const held = castStore.persisted(RECORD) ?? {};
            const moved = strays.filter(key => held[key] !== null && held[key] !== undefined);
            if (moved.length) {
                const rest = { ...(game.settings.get(MODULE_ID, SETTINGS.murderState) ?? {}) };
                for (const key of moved) delete rest[key];
                await game.settings.set(MODULE_ID, SETTINGS.murderState, rest);
                const back = game.settings.get(MODULE_ID, SETTINGS.murderState) ?? {};
                report.lifted = moved.filter(key => !(key in back)).length;
            }
            report.kept += strays.length - report.lifted;
            if (report.lifted) log(`Lifted ${report.lifted} incident name(s) out of world data (LIVE-001).`);
        }

        // The betrayal offer and the swing memo used to be actor flags (CASE-04). A
        // live offer is lifted into the cast; the rest is unset, and read back.
        const clock = getClock();
        for (const actor of game.actors) {
            const window = actor.getFlag(MODULE_ID, FLAGS.betrayalWindow);
            const live = window?.killerId && window.chapter === clock?.chapter && window.day === clock?.day;
            if (live) {
                await castStore.patch(RECORD, { betrayal: { thirdId: actor.id, ...window } }, { weak: true, fillOnly: true });
                if (!castStore.persisted(RECORD)?.betrayal) {
                    report.kept++;
                    continue;
                }
                report.offers++;
                log(`Lifted ${actor.name}'s betrayal offer out of world data (CASE-04).`);
            }
            for (const flag of [FLAGS.betrayalWindow, FLAGS.swungWeapon]) {
                if (actor.getFlag(MODULE_ID, flag) === undefined) continue;
                try {
                    await actor.unsetFlag(MODULE_ID, flag);
                } catch (err) {
                    warn(`Could not unset ${actor.name}'s old ${flag} flag`, err);
                }
                if (actor.getFlag(MODULE_ID, flag) === undefined) report.flags++;
                else report.kept++;
            }
        }
        if (report.lifted || report.offers) pushCastToParticipants(readCast(), {});
        if (report.kept) throw new Error(`${report.kept} of the incident's names, offers or old flags are still in world data; the next load tries again`);
        return report;
    });
}

/**
 * THE INCIDENT'S METHOD OUT OF WORLD DATA (E05 C8; audit S04-08). Until 1.2.64 the world
 * half of `murderState` held `indirect`, `selfInflicted`, `keyRemnantsStale`, `openedAt`
 * and `endedBy` (`INCIDENT_METHOD`). The clause `liftIncidentMethod` (migrate.mjs) runs
 * this once, on the primary, after the cast's copies arrived, with the rules written on
 * `liftIntoCast` (below).
 *
 * @returns {Promise<null|{notPrimary: true}|{lifted: number, dropped: number, kept: number}>}  `kept` 0:
 *   anything else throws; `notPrimary` on a GM that is not the primary (`liftIntoCast`).
 */
export async function liftIncidentMethod() {
    return liftIntoCast(INCIDENT_METHOD, "the incident's method");
}

/**
 * THE INCIDENT'S FIGHT OUT OF WORLD DATA (E32 C3, 28.09.2026; the owner's Q1 (a)). Until
 * 1.2.66 the world half of `murderState` held the round, whose side acts, the hindrances,
 * what is spent and the rest of the fight (`INCIDENT_FIGHT`), on every browser; since E32
 * C2 every write of them goes to the cast, and an incident a 1.2.65 table left running
 * keeps them in the world half, where `murderState()` reads them under the cast's, until
 * this lifts them. The clause `liftIncidentFight` (migrate.mjs, since 1.2.66) runs it
 * once, on the primary, after the cast's copies arrived and after the method's lift, with
 * the rules written on `liftIntoCast`: a turn a GM passed since the update is the cast's
 * already, and stands over the world's.
 *
 * @returns {Promise<null|{notPrimary: true}|{lifted: number, dropped: number, kept: number}>}  `kept` 0:
 *   anything else throws; `notPrimary` on a GM that is not the primary (`liftIntoCast`).
 */
export async function liftIncidentFight() {
    return liftIntoCast(INCIDENT_FIGHT, "the incident's fight");
}

/**
 * THE CAST'S FIELDS OUT OF THE WORLD HALF (E05 C8's body, shared since E32 C3). `fields` are
 * cast fields a build before this one kept in the world half of `murderState`; `what`
 * names them in the log and in the throw. Once, on the primary, after the cast's copies
 * arrived.
 *
 * WHILE AN INCIDENT RUNS the fields with a value go into the cast weak and fill-only - a
 * value a GM wrote since the update stands - and a field leaves the world half only once
 * the cast reads back from storage holding it; a null in the world half says "none" and
 * leaves with them. A field the cast holds is the cast's whatever its value (E32+E07 fix
 * r1-G4, the correctness review's m2): a null a GM wrote there since the update - a free
 * take spent, `writeState({ freeResolution: null })` - is what `murderState()` reads, and
 * the fill-only patch leaves it; asked for a value there, the lift kept the world's stale
 * one on every browser and threw at every load until the incident closed (the review's
 * probe P4 measured it, and the tier-2 test beside the race test is red on 4b54934,
 * 02.10.2026). It is read off the cast's storage, not its memory, so a field whose save
 * did not go through still stays in the world half and throws. Then the participants are
 * sent the cast, so a trap's victim reads the trap from their copy and the killer's
 * player the turn. WITH NO INCIDENT RUNNING they
 * leave outright: `murderState()` is null then, and nothing reads them. The world half is
 * written as it is after the cast's save - read again then, so a turn another GM passed
 * during that await stands (the correctness review's M9: the copy read before it put the
 * turn back) - and read back; a field still there throws, with the count, so the world is
 * not stamped and the next load tries again (E05 fix r1-G1; migrate.mjs, above the lifts).
 * Idempotent.
 *
 * NOT ON THE PRIMARY it answers `{ notPrimary: true }`, never the null "nothing to lift"
 * (E32+E07 fix r1-G4, the security review's m2): the migration's runner stamped the world on
 * that null, so a pass on another GM - `game.drpg.migrate1_2_0()` by hand, or the primary's
 * own pass after a GM whose id sorts first came in - marked the lift done with the fight
 * still in every browser's world half, and no later load lifted it (the first measured in
 * scenario 61 on 02.10.2026, the second read, not run). The runner writes no stamp over it
 * (migrate.mjs `migrate1_2_0`).
 */
async function liftIntoCast(fields, what) {
    if (!isPrimaryGm()) return { notPrimary: true };
    if (await castStore.whenHydrated() === "timedOut") {
        throw new Error("the other GMs' copies of the cast did not arrive; the next load tries again");
    }
    // In the incident's queue (E32 C4): a write of the running incident waits for the lift.
    return incidentWrite(async () => {
        const stored = game.settings.get(MODULE_ID, SETTINGS.murderState) ?? {};
        const found = fields.filter(key => Object.hasOwn(stored, key));
        if (!found.length) return null;
        const values = stored.active ? found.filter(key => stored[key] != null) : [];
        if (values.length) {
            await castStore.patch(RECORD, Object.fromEntries(values.map(key => [key, stored[key]])), { weak: true, fillOnly: true });
            await castStore.idle();
        }
        const held = castStore.persisted(RECORD) ?? {};
        const leave = found.filter(key => !values.includes(key) || Object.hasOwn(held, key));
        if (leave.length) {
            const rest = { ...(game.settings.get(MODULE_ID, SETTINGS.murderState) ?? {}) };
            for (const key of leave) delete rest[key];
            await game.settings.set(MODULE_ID, SETTINGS.murderState, rest);
        }
        const back = game.settings.get(MODULE_ID, SETTINGS.murderState) ?? {};
        const gone = leave.filter(key => !Object.hasOwn(back, key));
        const report = {
            lifted: gone.filter(key => values.includes(key)).length,
            dropped: gone.filter(key => !values.includes(key)).length,
            kept: found.length - gone.length
        };
        if (report.lifted) {
            log(`Lifted ${report.lifted} field(s) of ${what} out of world data.`);
            pushCastToParticipants(readCast(), {});
        }
        if (report.kept) throw new Error(`${report.kept} field(s) of ${what} are still in the world half of murderState; the next load tries again`);
        return report;
    });
}

export function registerMurder() {
    registerIncidentCastSync();
    registerDeathCopy();

    // The betrayal's day-long window (D18). Swept rather than counted down -
    // see `sweepBetrayalWindows`.
    Hooks.on("drpgTimeOfDayChanged", () => {
        sweepBetrayalWindows().catch(err =>
            error("Could not shut the betrayal windows the day moved past", err));
    });

    Hooks.on("updateToken", (tokenDoc, changes) => {
        if (changes.x === undefined && changes.y === undefined) return;
        // One client decides, or several GMs would each write the same
        // participant in - the same rule movement.mjs applies to who pays.
        if (!isPrimaryGm()) return;
        maybeThirdParty(tokenDoc).catch(err =>
            error("Could not check for a third party walking in", err));

        // The other thing walking into a room can mean. Same hook rather than a
        // second `updateToken` listener, so the two checks cannot disagree about
        // which client is allowed to act on a move.
        import("./chapter.mjs")
            .then(m => m.maybeBodyFound(tokenDoc))
            .catch(err => error("Could not check whether a body was just found", err));
    });

    // The victim running out, however it happened.
    //
    // `resolveCrisisAction` checks after its own damage and after the pass's
    // drain, which covers the ordinary route; while it runs this leaves the
    // victim to it (`resolving`, E32 C4). This covers the others: a GM marking
    // damage on the sheet by hand, a Despair Call, an item, anything at all. One
    // client decides, or every GM would race to end the same incident.
    Hooks.on("updateActor", (actor, changes) => {
        if (!isPrimaryGm()) return;
        const r = changes?.system?.resources;
        if (!r?.hitPoints && !r?.stress) return;
        if (murderState()?.victimId !== actor.id) return;
        if (resolving) {
            victimOwed = true;
            return;
        }
        checkVictimNow();
    });

    // A killer dead in the fight, however it happened (`killerFell`): a death published on
    // the actor, or one the GMs keep. One client decides, as above. The actor's half asks
    // the predicate rather than the change's key: R192 keeps the flag's readers to
    // settings.mjs, and `killerFell` does nothing twice for a killer already passed over.
    const fell = () => {
        if (!isPrimaryGm()) return;
        killerFell({ pass: !resolving }).catch(err => error("Could not move the turn past a dead killer", err));
    };
    Hooks.on("updateActor", actor => {
        if (killerIds().includes(actor.id) && isDeadForGm(actor)) fell();
    });
    Hooks.on("drpgDeathsChanged", fell);
}

/**
 * The victim-ran-out check the `updateActor` hook started, while it runs: ONE at a time
 * (E32 C4, 28.09.2026; audit S04-26). The check reads the victim before its first await,
 * and one that finds them not spent is over before the next update can land (read off
 * the code); so an update that finds one pending finds one that has already found the
 * victim spent and is asking the GM with two killers, or writing Stage 6. Until
 * 1.2.66 each update started another, and a crisis action awaited the last one; the
 * action checks for itself now (`applyCrisisAction`).
 */
let victimCheck = null;

/** Start the victim-ran-out check unless one is running: the hook's, and the one an action owed (`victimOwed`). */
function checkVictimNow() {
    if (victimCheck) return;
    victimCheck = checkVictimSpent()
        .catch(err => {
            error("Could not check whether the victim has run out", err);
            return false;
        })
        .finally(() => { victimCheck = null; });
}

/**
 * Did this token just walk into the room the incident is happening in?
 *
 * "The room" is the VICTIM's, not the killer's. They are in the same place for
 * the whole of Stage 5 - but the victim is the one who cannot leave, so their
 * position is the stable answer, and a killer momentarily read as elsewhere
 * (an unlinked token, a half-loaded canvas) must not move the crime scene.
 */
async function maybeThirdParty(tokenDoc) {
    const state = murderState();
    if (!state || state.stage !== "incident") return;
    if (state.indirect) return;          // nothing to interrupt

    const actor = tokenDoc?.actor;
    if (!actor || actor.type !== "character") return;
    // Anybody already in it. Moving around the room they are standing in is not
    // walking into it - and that includes the third party themselves, who used
    // to be covered by an early return on `state.thirdId` that also swallowed
    // everybody who came after them.
    if (participantIds(state).has(actor.id)) return;
    // Nor is walking back into a room one left (`thirdLeaves`, E32+E07 C10): no second free
    // choice, and no fourth person either - asked before the crowd below, which a third who
    // came back while somebody else holds the seat would otherwise end.
    if (state.departed?.includes(actor.id)) return;
    if (isMonokuma(actor)) return;       // the GM on the map is not a witness
    if (isDeadForGm(actor)) return;
    // A token the GM has hidden is not in the scene as far as the fiction is
    // concerned - the same rule `othersInRoom` applies.
    if (tokenDoc.hidden) return;

    const { roomOfToken, locateActor } = await import("./movement.mjs");
    const scene = locateActor(game.actors.get(state.victimId));
    if (!scene?.room) return;
    // Same scene, same room. Two rooms of the same name on two maps are not
    // one room - `sameRoom` makes the same distinction for a handover.
    if (tokenDoc.parent?.id !== scene.scene?.id) return;
    if (roomOfToken(tokenDoc) !== scene.room) return;

    // The guide gives the scene one third party. The second one to walk in is
    // the fourth person in the room, and at four this stops being a murder
    // anybody could carry out - so it ends, rather than continuing around them.
    //
    // Decided HERE and not at the top of the function, because it is a fact
    // about the room: somebody crossing the map with an incident running
    // elsewhere ends nothing.
    if (state.thirdId) {
        await crowdedOut(actor);
        return;
    }

    await thirdPartyEnters(actor);
}

/** Somebody walked in. The guide gives them a free resolution action. */
export async function thirdPartyEnters(actor) {
    if (!game.user.isGM || !actor) return null;
    const state = murderState();
    if (!state || state.stage !== "incident") return null;
    if (!castHeldHere(state)) return null;
    if (state.thirdId) return null;
    // A third who left is not let back in by the GM's call either (`thirdLeaves`).
    if (state.departed?.includes(actor.id)) return null;

    // `thirdActed` is written explicitly rather than left undefined: it is what
    // gates their one free action, and a murder opened before this field
    // existed would otherwise carry no value at all.
    // Nobody else walked in while this was read (E32 C4): the first one in is the third. Nor
    // did anybody leave: a leave queued ahead of this write may have named them (E32+E07 C10).
    if (!await writeState({ thirdId: actor.id, thirdActed: false }, { expect: { thirdId: null, departed: state.departed ?? null } })) return null;
    await whisperToOwner(actor, `
        <h3>${game.i18n.localize("DRPG.Murder.thirdTitle")}</h3>
        <p>${game.i18n.localize("DRPG.Murder.thirdIntro")}</p>`);
    log(`${actor.name} walked into the incident.`);
    return murderState();
}

/**
 * A fourth person walks in, and there is no murder to be had.
 *
 * Automatic, and not put to the GM. The condition is countable - four people in
 * one room - and every other reading of it would be the module asking a
 * question it already knows the answer to while the fight carried on in the
 * background.
 *
 * NOBODY DIES. The incident is cancelled where it stands: no body, no Blackened
 * (`recordBlackened` asks `leftABody`, and the victim is alive), no post-incident
 * checklist. What has already happened stays happened - the damage taken, the
 * Sanity spent, the Remnants the fight has already put on the floor.
 *
 * THE NEWCOMER IS NOT TOLD, and that is deliberate. Everyone who was in the
 * incident hears it; the person who walked in gets whatever the GM decides they
 * saw. A whisper naming an interrupted murder would hand a fourth player the
 * killer's identity for the price of walking through a door, and the guide's
 * whole trial rests on that being something people work out.
 */
async function crowdedOut(actor) {
    if (!game.user.isGM || !actor) return null;

    const state = murderState();
    if (!state || state.stage !== "incident") return null;
    if (state.indirect || !state.thirdId) return null;

    const third = game.actors.get(state.thirdId);

    // The GMs and everybody in the room it was happening in - the same audience
    // `announceCrisis` writes to, and for the same reason: `incidentAudienceIds`,
    // the one table of who is told (E06 C4, 27.09.2026). Only a direct incident
    // is crowded out, and its seats are the killer, the victim and the third.
    const recipients = new Set([...gmIds(), ...incidentAudienceIds(state)]);

    await announce({
        content: `
            <h3>${game.i18n.localize("DRPG.Murder.crowdedTitle")}</h3>
            <p>${game.i18n.format("DRPG.Murder.crowded", {
                name: esc(actor.name), third: esc(third?.name ?? "?")
            })}</p>
            <p class="notes">${game.i18n.localize("DRPG.Murder.crowdedNote")}</p>`,
        whisper: Array.from(recipients)
    });

    log(`${actor.name} made a fourth in the room; the incident is cancelled.`);
    return endMurder({ reason: "crowded", followUp: false });
}

/**
 * Close the murder out.
 *
 * The tools the incident consumed are destroyed on the way out - the crime tool
 * that was swung and the cleaning tool that was used on the scene. Dynamic
 * import, because cleanup.mjs reads the incident state from this file and a
 * static pair of imports both ways is a cycle for no gain.
 */
/* ==========================================================================
 * WHO KILLED THIS CHAPTER
 * ========================================================================== */

/**
 * The killers of this chapter, in the order they killed. GM-side, and now
 * literally so: this is a client-scoped ledger, synced GM to GM (LIVE-001).
 *
 * A player's client answers "nobody", which is the honest answer to "what do
 * you know about this" and the same one `remnantData` gives. Nothing on a
 * player's screen reads it.
 */
export function blackenedIds() {
    if (!game.user.isGM) return [];
    /* THIS CHAPTER'S AND THIS SEASON'S ROWS (E04; audit S04-25). The register was
       emptied at the chapter's end, and a GM's copy that missed the emptying came
       back with the next sync and put last chapter's killers on this chapter's
       verdict. A row keeps its chapter and season now and is read against the
       clock instead; nothing has to be emptied. */
    const chapter = getClock()?.chapter ?? null;
    const epoch = seasonEpoch();
    return Object.entries(blackenedStore.entries())
        .filter(([, row]) => row?.chapter === chapter && (row.epoch ?? 0) === epoch)
        .sort(([, a], [, b]) => (a.at ?? 0) - (b.at ?? 0))
        .map(([id]) => id);
}

/**
 * THE BLACKENED THE TRIAL ASKS FOR (E05 fix r2-G1, 27.09.2026; review F1, the owner's Q3).
 * The register takes a killer when the incident closes, and an incident usually closes
 * before anybody finds the body. The trial read the register whole, so a death nobody had
 * found was counted where the table could see it - measured 27.09.2026 on the harness, one
 * death published and one not: every ballot asked for two names, one more than the table had
 * bodies, which told each player there was another; a correct verdict executed the second
 * killer and a wrong one kept them a Reinforced. The owner's rule is that such a death
 * counts nowhere until the discovery or a GM's hand makes it known. So a row names its
 * victims (`recordBlackened`), and the trial counts a killer for a death the table knows;
 * the register itself stays whole for the discovery's rule of two witnesses
 * (chapter.mjs `checkBodyFound`), which is the GMs' judgement of who stands in a room.
 */
export function trialBlackenedIds() {
    return blackenedIds().filter(id => countsAtTrial(blackenedStore.get(id), untoldDeath));
}

/**
 * A victim whose death the table does not know: one nobody has published (a row of the
 * `deaths` store, no flag yet), and one taken back (E05 fix r2-G3, 27.09.2026; G1's note).
 * This asked for a row alone, so a victim revived - the GM's undo of a death, which drops
 * the row (plan section 2) - left their killer counted: measured in tier 2, a register row
 * naming a revived victim was asked for at the trial. A victim whose actor is gone counts,
 * as it did.
 */
function untoldDeath(victimId) {
    const victim = game.actors.get(victimId);
    return Boolean(victim) && !isDeceased(victim);
}

/**
 * The rule under `trialBlackenedIds`, pure (R199): a row counts unless every victim it
 * names is a death the table does not know (`untold(id)`: `untoldDeath`). A row that names
 * none counts - every row written before 1.2.64 names none, and a death then was the
 * table's at the kill.
 */
export function countsAtTrial(row, untold) {
    const victims = Array.isArray(row?.victims) ? row.victims.filter(id => typeof id === "string" && id) : [];
    return !victims.length || victims.some(id => !untold(id));
}

/**
 * The trial reads the register and the deaths once the GM stores hold the other GMs' rows
 * (E05 fix r2-G2, 27.09.2026; G1's note, read in code and measured on the harness by holding
 * both stores' hydration): read before, a vote opened moments after a load counted from this
 * browser's rows alone - a killer another GM recorded was missing from the ballot's count,
 * and a death another GM still kept secret was not yet there to hold its killer back.
 * `openVote` and `openVerdictDialog` wait on this before they count. (Since E05 fix r2-G3
 * the killer is held back by the victim's flag, not by the row - `untoldDeath` - so only the
 * register's wait still counts there; the deaths' wait stays for the verdict, which asks
 * who is dead to the GMs - `isDeadForGm` - before it executes or rewards anybody.)
 */
export function whenTrialReadable() {
    return Promise.all([blackenedStore.whenHydrated(), deathStore.whenHydrated()]);
}

/** The trial's Blackened as actors, skipping any that have since been deleted - the verdict's list. */
export function trialBlackenedActors() {
    return trialBlackenedIds().map(id => game.actors.get(id)).filter(Boolean);
}

/**
 * Remember who killed.
 *
 * Recorded when the incident CLOSES rather than when it opens, and only when it
 * left a body: Role reversal can hand the killer's seat to the person who was
 * the victim halfway through, and Escape together ends an incident with nobody
 * dead at all. What goes in the register is whoever `killerIds(state)` names
 * when the dust settled, and only if there is a corpse to answer for.
 *
 * `killerIds`, not `state.killerId` alone - an accomplice who really threw in
 * with the killers (`thirdSide === "killer"`) is a killer in every sense the
 * rules care about, including this one. Recording only the original killer
 * left the accomplice off `blackenedIds()`, which is the list `maybeBodyFound`
 * filters witnesses against: the second killer walked past their own corpse
 * and counted as an innocent bystander. `killerIds` already restricts to a
 * third party who actually joined the killers, not one who merely walked into
 * the room, so nothing extra is needed here to keep a bystanding third party out.
 *
 * Appended, never replaced. Two incidents in a chapter - which the betrayal
 * rule makes an ordinary evening - put two (or more) names in here, and the
 * trial asks for all of them whose deaths the table knows (`trialBlackenedIds`).
 *
 * WITH THE VICTIM (E05 fix r2-G1, 27.09.2026; review F1). A row carries `victims`,
 * the bodies it answers for, so the trial can leave out a killer whose every
 * victim is still a death nobody has found (the owner's Q3). A killer who kills
 * again in the chapter has the new victim added to their row; a row written
 * before 1.2.64 names none and is left so, since it counts at every trial anyway.
 *
 * "ONLY WHEN IT LEFT A BODY" IS `leftABody` (E32 C6, 28.09.2026; audit S04-11). It used
 * to be the stage, `resolution`, with an escape taken out: a proxy for a body that held
 * for a Finishing blow and nothing else. A Survive moves the incident to Stage 6 with its
 * victim on their feet, and made their attacker a Blackened for a death nobody died (the
 * grid's DM04, DM09 and TP04, red at 0642f1a); a victim who died from the Students list
 * while the GM declined Stage 6 closes from the fight, and is a body all the same.
 */
async function recordBlackened(state) {
    if (!game.user.isGM || !state?.killerId) return;
    if (!leftABody(state)) return;

    const held = Object.fromEntries(blackenedIds().map(id => [id, blackenedStore.get(id)]));
    const rows = blackenedWrites(held, killerIds(state), state.victimId,
        { chapter: getClock()?.chapter ?? null, epoch: seasonEpoch(), at: Date.now() });
    const written = Object.keys(rows);
    if (!written.length) return;
    await blackenedStore.patchMany(rows);
    log(`Blackened recorded: ${written.map(id => game.actors.get(id)?.name ?? id).join(", ")}.`);
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
 * What one closed incident writes to the register, pure (R199). `held` is this chapter's
 * rows by killer. A killer not in it gets a row stamped with the chapter and season it is
 * for, `at` keeping their order after the rows the chapter already has, naming the victim;
 * a killer already in it has the victim added to the victims their row names. A row that
 * names none was written before 1.2.64 and counts at every trial, so it is left alone.
 */
export function blackenedWrites(held, killers, victimId, { chapter = null, epoch = 0, at = 0 } = {}) {
    const victim = typeof victimId === "string" && victimId ? victimId : null;
    const rows = {};
    (killers ?? []).forEach((id, i) => {
        if (!Object.hasOwn(held ?? {}, id)) {
            rows[id] = { chapter, epoch, at: at + i, victims: victim ? [victim] : [] };
            return;
        }
        const had = held[id]?.victims;
        if (victim && Array.isArray(had) && !had.includes(victim)) rows[id] = { victims: [...had, victim] };
    });
    return rows;
}

/**
 * Forget every row - the season reset. A new chapter needs nothing: `blackenedIds`
 * reads the clock's chapter. On the primary, whose the reset is (E04 C10), the store's
 * `clear()`, a cut every GM's copy takes; another GM (a console) writes a tombstone
 * per row.
 */
export async function clearBlackened() {
    if (!game.user.isGM) return;
    if (isPrimaryGm()) await blackenedStore.clear();
    else await blackenedStore.dropMany(Object.keys(blackenedStore.entries()));
}

export async function endMurder({ reason = "closed", followUp = true } = {}) {
    if (!game.user.isGM) return null;

    /*
     * ONE CLOSE PER INCIDENT (E32 C4, 28.09.2026; audit S04-26). Every step below awaits,
     * and a second close started before the first wiped the state read the same incident:
     * two `endMurder` calls not awaited in between each recorded the Blackened, destroyed
     * the tools and fired `drpgIncidentClosed` (read off the code at f177726; the tier-2
     * test "two closes of one incident close it once" holds it). The incident is taken, by
     * when it opened, before the first await - a second close of it answers at once - and
     * let go when the close is over. Per browser, as the queue (`incidentWrite`).
     */
    const state = murderState();
    const key = state?.active ? String(state.openedAt ?? "open") : null;
    if (key !== null && closing.has(key)) return null;
    if (key !== null) closing.add(key);
    try {
        return await closeIncident(state, { reason, followUp });
    } finally {
        if (key !== null) closing.delete(key);
    }
}

/** The incidents this browser is closing, by `openedAt` (`endMurder`). */
const closing = new Set();

async function closeIncident(state, { reason, followUp }) {
    /*
     * A SELF-INFLICTED DEATH IS RECORDED HERE, NOT AT STAGE 4.
     *
     * Every other route to a corpse has a moment the engine owns - a Finishing
     * Blow, the victim running out - and kills them there. This one does not:
     * Stage 6 for a self-inflicted death IS the arrangements made before dying,
     * and `cleanupBlocker` hands the clean-up screen to whoever the state calls
     * the killer. Killing them the instant Stage 4 succeeded would have meant a
     * corpse rolling to scrub its own scene and spending Sanity it no longer
     * has.
     *
     * So the GM closing the incident is what makes it true, which is also the
     * beat they close it on. Before `recordBlackened`, so the register and the
     * death cannot disagree, and guarded on the stage: a Stage 4 that failed
     * closes through here too, and nobody died in that one. (`leftABody` reads
     * `endedBy`, which only the Stage 4 that went through writes.)
     */
    if (state?.selfInflicted && state.stage === "resolution") {
        try {
            const { killCharacter, isDeadForGm } = await import("./chapter.mjs");
            const actor = game.actors.get(state.victimId);
            if (actor && !isDeadForGm(actor)) await killCharacter(actor);
        } catch (err) {
            error("Could not record a self-inflicted death when the incident closed", err);
        }
    }

    // Before the state is wiped - it is the only place the killer's identity
    // exists once this function returns.
    try {
        await recordBlackened(state);
    } catch (err) {
        error("Could not record who the Blackened was", err);
    }
    const killer = state?.killerId ? game.actors.get(state.killerId) : null;
    if (killer) {
        try {
            const { endResolution } = await import("./cleanup.mjs");
            await endResolution(killer);
        } catch (err) {
            error("Could not destroy the tools the incident used", err);
        }
    }

    // Both halves, and the participants' copies with them: an incident that is
    // over must not leave its cast sitting on anybody's client. The swing memo
    // goes with it - `endResolution` above was the one thing that read it.
    //
    // THE BETRAYAL DOES NOT (D18): the offer lasts until the end of the day,
    // which is longer than the incident, so it is the one field the reset keeps
    // (E04) - untouched, rather than read here and written back.
    //
    // Against the incident read at the top (E32 C4): one opened over it since is not
    // wiped by the close of the last. `openMurder` refuses while any incident runs since
    // E32 C5a, so on this browser that is another GM's write, which this queue does not order.
    if (!await restoreState({}, { keep: ["betrayal"], expect: { openedAt: state?.openedAt } })) {
        warn(`The close (${reason}) found another incident in the place of the one it closed, and left it running.`);
        return null;
    }
    log(`Murder closed (${reason}).`);

    /* ONE HOOK PER INCIDENT THAT WAS RUNNING (E32 C1, 28.09.2026; audit S17-10). The
       suite's invariant grid (tests-grid.mjs, I4) counts closes with it: a betrayal that
       opened its incident over the last one without this function closed that one never,
       and a close that ran twice closed it twice. On the GM that closes it, after the state
       is wiped; a call with nothing running fires nothing. Local only - nothing listens to
       it at the table. */
    if (state?.active) Hooks.callAll("drpgIncidentClosed", { reason });

    // Before the checklist below, which waits on the GM's answer.
    if (state?.active) {
        try {
            await tellIncidentClosed(state);
        } catch (err) {
            error("Could not tell the incident's participants that it is over", err);
        }
    }

    /* AND ITS TRACES LEAVE THE NEXT INCIDENT'S MAP (E05 C14, 27.09.2026; audit S05-42).
       The ones nobody copied are hidden and none is marked as an incident's any more
       (remnants.mjs `retireIncidentTraces`): the mark names no incident, so the cast of
       every later one was drawn them. On the GM that closes it, the one GM that runs this
       function; after the state is wiped, as the tracker below. */
    try {
        const { retireIncidentTraces } = await import("./remnants.mjs");
        await retireIncidentTraces();
    } catch (err) {
        error("Could not take the closed incident's traces off the next one's map", err);
    }

    /* AND THE TRACKER GOES WITH IT.

       Measured on 11.09: close the murder and the Incident tracker stays on screen,
       still showing the fight, still offering "Close the murder" - which then warns
       "No murder is running" at a GM who is looking straight at a window about it. It
       is not one window either, over a session: every route into this function leaves
       another one behind.

       Here rather than at the call sites because there are six of them - the tracker's
       own button, the after-incident screen, a betrayal, a chapter reset - and the one
       thing they share is that afterwards there is no incident to track. The live hook
       on the window would shut it a tick later anyway; this makes it immediate, and
       covers a tracker opened on another GM's screen, which no hook of ours would.

       AFTER `restoreState`, so a tracker that redraws on its way out reads the cleared
       state and prints the "this is over" line rather than the fight it is losing. */
    closeOpen("drpg-window-incident");

    // Take back the Stage 4 invitation, if one is still standing.
    //
    // Sent AFTER the state is wiped, so that a client which closes its dialog
    // and falls out of `throwOpeningRoll` reads the cleared state and stops
    // rather than re-offering. Sent unconditionally rather than only from the
    // opening stage: the dialog outlives the stage if a GM moved past it by
    // hand, and a client with nothing in flight ignores this anyway.
    try {
        await revokeOpeningInvitation(state);
    } catch (err) {
        error("Could not take back the opening roll invitation", err);
    }

    // What happens next, while the module still remembers the incident.
    //
    // The moment an incident closes is the moment its details stop being
    // available - the state is wiped one line above - and it is also the moment
    // a GM has four separate errands: the phase has to change, the body has to
    // be found, the autopsy has to be issued, the Key Remnants have to be
    // placed. Each of those lives on a different screen, and the one thing that
    // ties them together is the incident that has just ended.
    //
    // So the checklist is built from the state before it goes, and offered
    // once. `followUp: false` is for the callers that end an incident as part of
    // something else and have their own next screen.
    if (followUp && state?.victimId) {
        try {
            await afterIncident(state);
        } catch (err) {
            error("Could not show the post-incident checklist", err);
        }
    }
    return null;
}

/**
 * THE PEOPLE IN IT ARE TOLD IT IS OVER (E32 C6, 28.09.2026; audit S13-03). The close
 * told the GMs and nobody else: a participant's panel went quiet, and whether the
 * incident had ended or was waiting on somebody was theirs to guess. Each seat's
 * player at the stage it closed on (`incidentAudienceIds`) is told now - so a direct
 * murder's victim closed at the opening roll, whom nobody had asked anything (D6), and
 * a trap's builder closed before Stage 6, who is in no room, are told nothing, as a
 * bystander is. The words name nobody and are in the second person; a victim who is
 * still alive is also told they can act again.
 *
 * ONE DOCUMENT, WHOEVER READS IT. The card is veiled (the file's `announce`): the
 * document every browser receives speaks as nobody and is addressed to everybody,
 * and the words go only to the players named. The victim's words differ from the
 * others', and a second card for them would put one more document on every browser
 * exactly when the victim of the close lived - so the victim's words are sent as the
 * same card's (`updateSecret`), to them alone.
 */
async function tellIncidentClosed(state) {
    const audience = incidentAudienceIds(state);
    if (!audience.length) return null;
    const victim = leftABody(state) ? null : ownerOf(game.actors.get(state.victimId ?? ""))?.id ?? null;
    const freed = audience.includes(victim) ? victim : null;
    const others = audience.filter(id => id !== freed);
    const words = key => `<p>${game.i18n.localize(key)}</p>`;
    const message = await announce({
        content: words(others.length ? "DRPG.Murder.closedYou" : "DRPG.Murder.closedVictimYou"),
        whisper: others.length ? others : [freed]
    });
    if (message && freed && others.length) {
        const { updateSecret } = await import("./secret.mjs");
        await updateSecret(message, words("DRPG.Murder.closedVictimYou"), [freed]);
    }
    return message;
}

/**
 * The post-murder checklist.
 *
 * Everything on it is derived, nothing is asked: the room comes from the
 * victim's token, the Key Remnant count from the opening roll that produced it,
 * the kind of murder from how the incident was opened. The GM reads a list of
 * what is now owed and presses the one they want to do first - each button is
 * the screen that does it, not a description of where to find it.
 *
 * NOT every incident leaves a body. Escape together ends one with the victim
 * and the newcomer both walking out, and this screen used to answer that with
 * "the body is in the Library, issue the autopsy, move to Investigation" - a
 * checklist for a murder that did not happen.
 *
 * NOR DOES ANYTHING BUT A BODY (E32 C6, 28.09.2026; audit S04-11). The escape was
 * the one close that branched, and the body's screen answered every other - a
 * Survive, whose victim walked away, and a GM closing a fight half way or an
 * opening that never resolved. `leftABody` decides it now: a body gets this screen;
 * no body at Stage 6 gets the escape's or, for a victim who survived, its short
 * sibling (`afterNoBody`); a close before Stage 6 is an interruption, and says only
 * that nobody died.
 */
async function afterIncident(state) {
    const victim = game.actors.get(state.victimId);
    const killer = game.actors.get(state.killerId);
    if (!victim) return null;

    if (!leftABody(state)) {
        if (state.endedBy === "sharedEscape") return afterEscape(state, victim, killer);
        return afterNoBody(state, victim, killer);
    }

    const { roomOfActor } = await import("./movement.mjs");
    const room = roomOfActor(victim);

    const owed = [];
    if (state.keyRemnants > 0) {
        owed.push(plural("DRPG.Murder.afterKeys", { n: state.keyRemnants }));
    }
    owed.push(game.i18n.localize("DRPG.Murder.afterAutopsy"));
    owed.push(game.i18n.localize(state.selfInflicted
        ? "DRPG.Murder.afterSelf"
        : state.indirect
            ? "DRPG.Murder.afterIndirect"
            : "DRPG.Murder.afterDirect"));

    const alreadyInvestigating = getClock().phase === "investigation";

    // Zdrada. The guide's fifth walk-in entry, and the one place two bodies come
    // from: "po zabiciu pierwszego oryginalnego uczestnika" the newcomer may
    // turn on the killer, it "wymaga Rzutu akcji morderstwo bezpośrednie", and
    // it is "jedyny wyjątek od zasady deklaracji zabójstwa" - the only killing
    // in the game that needs no declaration in advance.
    //
    // So it is a SECOND murder, not a second victim inside the first: this
    // incident is over and closed, and a fresh one opens with the newcomer as
    // the killer and the killer as the victim.
    //
    // Left out in a Class Trial (E32+E07 fix r1-G2; the round-1 correctness review's m5):
    // the betrayal is closed there (the owner's Q3), and the note's "now" would be untrue.
    // The offer is armed all the same and the tile lights after the trial.
    const traitor = getClock()?.phase === "classTrial" ? null : betrayalCandidate(state, killer);

    const action = await DialogV2.wait({
        classes: ["drpg-panel"],
        window: { title: game.i18n.localize("DRPG.Murder.afterTitle") },
        content: dialogContent(`<div>
            <p>${state.selfInflicted
                // "X was killed by X" is the sentence this used to produce.
                ? game.i18n.format("DRPG.Murder.afterIntroSelf", {
                    name: foundry.utils.escapeHTML(victim.name)
                })
                : game.i18n.format("DRPG.Murder.afterIntro", {
                    victim: foundry.utils.escapeHTML(victim.name),
                    killer: foundry.utils.escapeHTML(killer?.name ?? "?")
                })}</p>
            <p><strong>${room
                ? game.i18n.format("DRPG.Murder.afterRoom", { room: foundry.utils.escapeHTML(room) })
                : game.i18n.localize("DRPG.Murder.afterNoRoom")}</strong></p>
            <ul class="drpg-briefing-facts">${owed.map(o => `<li>${o}</li>`).join("")}</ul>
            ${traitor ? `<p class="notes">${game.i18n.format("DRPG.Murder.betrayalNote", {
                third: foundry.utils.escapeHTML(traitor.name),
                killer: foundry.utils.escapeHTML(killer?.name ?? "?")
            })}</p>` : ""}
        </div>`),
        buttons: [
            // THE BODY FIRST, AND IT NO LONGER STARTS STAGE 7 (D5). Announcing
            // the discovery and starting the investigation are two decisions
            // now, and this window offers them in that order.
            { action: "body", label: game.i18n.localize("DRPG.Chapter.bodyTitle"), default: true },
            ...(alreadyInvestigating ? [] : [{
                action: "investigation",
                label: game.i18n.localize("DRPG.Murder.afterGoInvestigation")
            }]),
            { action: "autopsy", label: game.i18n.localize("DRPG.TruthBullet.autopsyTitle") },
            ...(traitor ? [{
                action: "betrayal", class: "drpg-gm-route",
                label: game.i18n.format("DRPG.Murder.betrayalButton",
                    { third: foundry.utils.escapeHTML(traitor.name) })
            }] : []),
            { action: "close", label: game.i18n.localize("DRPG.Panel.close") }
        ],
        rejectClose: false
    });

    if (action === "betrayal") return openBetrayal(traitor, killer);
    if (action === "investigation") {
        // Only the phase. Announcing the body is its own button above, and
        // since D5 it is its own beat: the discovery holds the game in Daily
        // Life until a GM presses this or moves the clock.
        const { setPhase } = await import("./clock.mjs");
        return setPhase("investigation");
    }
    if (action === "body") {
        const { openBodyDiscoveryDialog } = await import("./chapter.mjs");
        return openBodyDiscoveryDialog();
    }
    if (action === "autopsy") {
        const { issueAutopsyDialog } = await import("./gm-items.mjs");
        return issueAutopsyDialog();
    }
    return null;
}

/**
 * Could THIS actor turn on the person they just killed for?
 *
 * The player's half of the betrayal. Stage 9.5 put it on the GM's post-incident
 * checklist, which made it something the GM had to think of and offer - and the
 * decision is not theirs. The guide gives it to the newcomer: they helped, the
 * body is on the floor, and the person beside them is the only witness.
 *
 * Stage 6 only. Before that they are still in the incident and have crisis
 * actions for it; after `endMurder` there is no incident to continue.
 *
 * @returns {Actor|null} the partner they could turn on
 */
export function betrayalTarget(actor) {
    if (!actor) return null;

    /*
     * READ OFF THE WINDOW, NOT THE INCIDENT (D18, Dawid 29.08).
     *
     * This used to require `murderState().stage === "resolution"`, which tied
     * the offer to an incident that is wiped the moment a GM closes it. The
     * accomplice had the whole of Stage 6 to think of it and nothing after -
     * and Stage 6 is the stretch where they are watching somebody else clean.
     *
     * `armBetrayalWindow` asked every question this used to ask, once, when the
     * incident settled. What is left here is the two facts that can still
     * change afterwards: whether the day has moved on, and whether the person
     * they would be turning on is still alive to turn on.
     *
     * It returns the person they would be turning ON, not the candidate. The
     * GM's question ("who could turn on the killer") is answered by
     * `betrayalCandidate` and returns the newcomer; returning that here once
     * made the tile offer the accomplice a chance to murder themselves.
     */
    const open = readCast().betrayal;
    if (!open?.killerId || open.thirdId !== actor.id) return null;

    const clock = getClock();
    if (open.chapter !== clock?.chapter || open.day !== clock?.day) return null;

    /*
     * DARK IN A CLASS TRIAL, AND THE OFFER KEPT (E32 C5a, 28.09.2026; audit S02-24, the
     * owner's Q3 (a)). The offer lasts until the day ends, the investigation included - and
     * a Class Trial held that day is not a moment anybody is killed in, so the tile lit
     * through it until 1.2.66 (the grid's XI03). The offer is not touched: the tile lights
     * again when the trial is over and the day is still the same.
     */
    if (clock?.phase === "classTrial") return null;

    const killer = game.actors.get(open.killerId);
    if (!killer || killer.id === actor.id) return null;
    if (isDeadForGm(killer)) return null;
    if (isDeadForGm(actor)) return null;

    /*
     * NOT IN THE MIDDLE OF SOMEBODY ELSE'S FIGHT.
     *
     * Found by the suite the moment the window started outliving its incident:
     * a betrayal armed by the evening's first murder was still on offer while
     * the second one was being fought, so the tile lit for a move `openBetrayal`
     * would then refuse - "an incident is still being fought".
     *
     * A tile that lights for something that cannot be done is worse than one
     * that stays dark, so the two answers are made to agree here rather than at
     * the far end. The offer is not lost, only postponed: the window is a day
     * long and the fight is not.
     *
     * Deliberately NOT a return to reading the incident for the offer itself -
     * that is the flag's job and the whole of D18. This asks a different
     * question: is now a moment when anything can be opened at all.
     */
    const running = murderState();
    if (running?.active && running.stage !== "resolution") return null;

    return killer;
}

/**
 * Open the betrayal on behalf of a player who asked for it. GM-side.
 *
 * Routed through the GM like every other world write in this module, and
 * re-derived here rather than trusted: the packet says who is turning on whom,
 * and the only thing that decides that is the incident state.
 */
export async function betrayAsPlayer(actorId, { note = "" } = {}) {
    if (!game.user.isGM) return null;
    const actor = game.actors.get(actorId ?? "");
    const target = betrayalTarget(actor);
    if (!actor || !target) {
        warn(`Refused a betrayal: ${actorId} is not in a position to turn on anyone.`);
        return null;
    }

    /*
     * IN AN ECLIPSE IT IS DECLARED, AND OPENS AT THE LIGHTS (E32 C5b, 28.09.2026; audit
     * S02-24, S04-13, the owner's Q3). The tile is asked before the Eclipse's refusal, and until
     * 1.2.66 its click cleared the offer and `openMurder` then refused in the Eclipse: the offer
     * was lost and nothing declared (read at 1.2.65); since C5a `openBetrayal` refused it before
     * taking the offer, so the click did nothing at all. The owner's rule: declared in
     * an Eclipse it costs an action and starts after the Eclipse, like any action declared
     * there. It is parked with the GMs' declarations (eclipse.mjs `parkBetrayal`), which
     * `judgePendingMurders` opens when the lights come up. The action was paid on the asking
     * client (action-rolls.mjs `performBetrayal`), which gets it back on a null here.
     *
     * THE OFFER STAYS IN THE CAST UNTIL THE LIGHTS (E32+E07 fix r1-G2, 01.10.2026; the
     * round-1 security review's m4). C5b took it here, and the take moved the cast's
     * `betrayal` stamp - which a player's browser that asks for its cast is sent even with no
     * seat - at a moment only the betrayer knew of: the review measured it on the harness, the
     * target asking for their cast before and after the declaration read the stamp move. The declaration is held
     * in the GMs' row alone now, and the lights take the offer (`takeDeclaredBetrayal`). The
     * tile stays lit until then, so a second declaration is refused here while the row
     * stands - in the incident's queue, where two in flight run one after the other.
     */
    const { isEclipse, parkBetrayal, betrayalDeclared } = await import("./eclipse.mjs");
    if (isEclipse()) {
        return incidentWrite(async () => {
            const offer = readCast().betrayal;
            if (offer?.thirdId !== actor.id || offer.killerId !== target.id) return null;
            if (betrayalDeclared(actor.id)) {
                warn(`Refused a betrayal by ${actor.name}: already declared in this Eclipse.`);
                return null;
            }
            return parkBetrayal({ thirdId: actor.id, killerId: target.id, note, offer });
        });
    }

    /*
     * SPENT BEFORE IT IS USED (D18), and since E32 C5a inside `openBetrayal`, which the
     * GM's checklist calls too: the offer is taken there first, in the incident's queue,
     * and two clicks in flight race to an offer only one of them can take. A betrayal that
     * cannot open puts it back and tells this player why (`refuseBetrayal`).
     */
    return openBetrayal(actor, target, { asked: true });
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
function betrayalCandidate(state, killer) {
    if (!state?.thirdId || !killer) return null;
    if (!leftABody(state)) return null;
    if (state.thirdSide !== "killer" && (incidentIndirect(state) || state.thirdActed)) return null;
    const third = game.actors.get(state.thirdId);
    if (!third || third.id === killer.id) return null;
    if (isMonokuma(third)) return null;
    return third;
}

/**
 * The newcomer kills the killer: a second murder, opened without a declaration.
 *
 * This is the guide's one exception to declaring a killing in advance, and it
 * is a whole fresh incident rather than an extension of the one that just
 * ended - the stages start again from the opening roll, and this time the
 * person who did the last killing is the one bleeding.
 *
 * OPENED, NOT ASKED ABOUT.
 *
 * This used to raise a confirmation on the GM's screen, and that was wrong in
 * two ways at once. It is not the GM's decision - the guide gives the betrayal
 * to the newcomer, and a dialog in front of it turns their choice into a
 * request. And it stacked: the player's tile fired one socket message per click,
 * every message raised its own confirm, and a GM working through four of them
 * opened four incidents, each with its own opening roll that cannot be skipped.
 * Measured from the report: "wiele niepomijalnych opening rolls".
 *
 * So the GM is TOLD. The announcement below already whispers them the whole
 * thing, and `endMurder` is one press away if it was a misclick.
 */
async function openBetrayal(third, killer, { asked = false, taken = null, note = "" } = {}) {
    /*
     * NOT ON TOP OF A RUNNING FIGHT, AND NOT IN AN ECLIPSE - asked before anything is
     * taken or closed. The first is the tile's own rule (`betrayalTarget`), asked again
     * here for the checklist and for a fight opened since the tile lit. The second is
     * `openMurder`'s, asked here too so that a Stage 6 is not closed below for a betrayal
     * `openMurder` would then refuse. A betrayal declared in an Eclipse comes here at its
     * lights (`openParkedBetrayal`), its offer `taken` by the lights before the clock moved
     * (eclipse.mjs `endEclipse`): that offer goes back on a refusal while its day holds, and
     * whether both of them are alive - which the tile would have asked - is asked of it here.
     *
     * NOT THE DAY, FOR A DECLARATION (E32+E07 fix r1-G2, 01.10.2026; the round-1 correctness
     * review's M1). The declaration passed the tile's day test, and the owner's Q3 starts it
     * after the Eclipse. C5b asked the day again here, after `endEclipse` had moved the
     * clock: an Eclipse after Night ends into the next day, so a betrayal declared in the
     * Night's Eclipse - the ordinary case, a night murder's third - was refused "the day is
     * over" with its action paid (the review measured it on the harness: opened from Morning's
     * Eclipse, not from Night's). Every grid step and test ended its Eclipse with `advance: false`, which
     * moves no clock.
     *
     * NOT IN A CLASS TRIAL (fix r1-G2; the correctness review's m5, the owner's Q3: closed in
     * a Class Trial). The tile is dark in one (`betrayalTarget`), but the GM's checklist and
     * the lights asked nothing of the phase: an incident closed during a trial offered the
     * button and opened it. The offer is not lost, as the tile's is not.
     */
    const { isEclipse } = await import("./eclipse.mjs");
    const running = murderState();
    if (isEclipse()) return refuseBetrayal(third, "eclipse", { asked, offer: taken });
    if (getClock()?.phase === "classTrial") return refuseBetrayal(third, "trial", { asked, offer: taken });
    if (running?.active && running.stage !== "resolution") return refuseBetrayal(third, "fight", { asked, offer: taken });
    if (taken && (isDeadForGm(third) || isDeadForGm(killer))) return refuseBetrayal(third, "dead", { asked, offer: taken });

    /*
     * THE ONE PATH, AND IT TAKES THE OFFER FIRST (E32 C5a, 28.09.2026; audit S04-03,
     * S04-13). The tile spent the offer and the GM's checklist did not, so a betrayal
     * opened from the checklist left it standing for a second one (the grid's TP02, red on
     * I6 since C1). Both come here, and the offer is taken - it must still name this third
     * and this killer - in the incident's queue, where two requests in flight run one after
     * the other: a second click, or the checklist after the tile, finds none.
     */
    const offer = taken ?? await takeBetrayalOffer(third, killer);
    if (!offer) return refuseBetrayal(third, "spent", { asked, offer: null });

    /*
     * THE FIRST INCIDENT CLOSES FIRST. A betrayal from the tile comes during Stage 6, with
     * the first incident still open, and until 1.2.66 its incident was written over that one
     * (`openMurder` let it through at `resolution`): the first was never closed, so its
     * killers were never recorded Blackened and its tools never broken (the grid's TP01 and
     * TP07, marked red on I4 since C1). It is closed here as the GM's Close would, without
     * the checklist - the betrayal is the next screen.
     */
    if (running?.active) {
        await endMurder({ reason: "betrayal", followUp: false });
        if (murderState()?.active) return refuseBetrayal(third, "fight", { asked, offer });
    }

    const opened = await openMurder({ killerId: third.id, victimId: killer.id });
    if (!opened) return refuseBetrayal(third, isEclipse() ? "eclipse" : murderState()?.active ? "fight" : "failed", { asked, offer });

    // Told after it opened, so the GMs are never told of a betrayal that did not happen.
    await announce({
        content: `<p>${game.i18n.format("DRPG.Murder.betrayalAnnounce", {
            killer: foundry.utils.escapeHTML(killer.name)
        })}</p>${note ? `<p class="notes">${foundry.utils.escapeHTML(note)}</p>` : ""}`,
        whisper: gmIds()
    });
    return opened;
}

/**
 * A betrayal declared in an Eclipse, opened at its lights (eclipse.mjs `judgePendingMurders`,
 * E32 C5b): `offer` is the one the lights took for it before the clock moved
 * (`takeDeclaredBetrayal`), or null when none stood for the two of them then. The incident
 * it opened, or null - the offer then back while its chapter and day hold, and the GM told
 * why; the betrayer is told by the lights. GM-side.
 */
export async function openParkedBetrayal(thirdId, killerId, offer, note = "") {
    if (!game.user.isGM) return null;
    const third = game.actors.get(thirdId ?? ""), killer = game.actors.get(killerId ?? "");
    if (!third || !killer) return null;
    if (offer?.thirdId !== third.id || offer.killerId !== killer.id) return refuseBetrayal(third, "spent", { asked: false, offer: null });
    return openBetrayal(third, killer, { taken: offer, note });
}

/**
 * The lights take the offer a declaration in the dark was made on (E32+E07 fix r1-G2,
 * 01.10.2026): before the clock moves, in the incident's queue, as the tile's betrayal takes
 * it - the offer, or null when it no longer names them. GM-side.
 */
export async function takeDeclaredBetrayal(thirdId, killerId) {
    if (!game.user.isGM) return null;
    return takeBetrayalOffer(game.actors.get(thirdId ?? ""), game.actors.get(killerId ?? ""));
}

/** Why a betrayal did not open, in words: literal keys, so R1 reads each. */
const BETRAYAL_WHY = Object.freeze({
    eclipse: "DRPG.Murder.betrayalWhy.eclipse",
    fight: "DRPG.Murder.betrayalWhy.fight",
    spent: "DRPG.Murder.betrayalWhy.spent",
    failed: "DRPG.Murder.betrayalWhy.failed",
    trial: "DRPG.Murder.betrayalWhy.trial",
    dead: "DRPG.Murder.betrayalWhy.dead"
});

/**
 * Take the betrayal offer for this third and this killer, in the incident's queue: the
 * offer it took, or null when it no longer names them. GM-side.
 */
async function takeBetrayalOffer(third, killer) {
    return incidentWrite(async () => {
        const cast = readCast();
        const open = cast.betrayal;
        if (!open || open.thirdId !== third?.id || open.killerId !== killer?.id) return null;
        const { betrayal, ...rest } = cast;
        await writeCast(rest, cast);
        return open;
    });
}

/**
 * Put a taken offer back, in the incident's queue, while no other offer stands and its
 * chapter and day are still the clock's - as `betrayalTarget` would read it: whether it went
 * back. GM-side.
 */
async function giveBetrayalOfferBack(offer) {
    return incidentWrite(async () => {
        const cast = readCast();
        const clock = getClock();
        if (cast.betrayal || offer.chapter !== clock?.chapter || offer.day !== clock?.day) return false;
        await writeCast({ ...cast, betrayal: offer }, cast);
        return true;
    });
}

/**
 * A BETRAYAL THAT DID NOT OPEN (E32 C5a, 28.09.2026; audit S04-13). The offer it took goes
 * back - while no other offer stands and its chapter and day are still the clock's, as
 * `betrayalTarget` would read it - and whoever asked is told why: the third's player
 * (a veiled whisper, as eclipse.mjs tells a refused murder) when the tile asked - but
 * not a second request that found the offer already taken - and the GM when the
 * checklist or an Eclipse's lights did (the lights tell the betrayer themselves). Answers
 * null, as the refused open does.
 */
async function refuseBetrayal(third, why, { asked, offer }) {
    const back = offer ? await giveBetrayalOfferBack(offer) : why !== "spent";
    warn(`Refused a betrayal by ${third?.name ?? "somebody"}: ${why}${offer ? (back ? "; the offer is back" : "; the offer is gone") : ""}.`);
    const line = game.i18n.format(back ? "DRPG.Murder.betrayalRefused" : "DRPG.Murder.betrayalRefusedGone",
        { why: game.i18n.localize(BETRAYAL_WHY[why]) });
    if (!asked) {
        ui.notifications.warn(line);
        return null;
    }
    // A request that found the offer taken is the second of two in flight: the first is opening it.
    if (why === "spent") return null;
    try {
        await whisperToOwner(third, `<h3>${game.i18n.localize("DRPG.Murder.betrayalTitle")}</h3>
            <p><span class="drpg-warning">${line}</span></p>`);
    } catch (err) {
        error("Could not tell the player why their betrayal did not open", err);
    }
    return null;
}

/**
 * The same screen for the incident nobody died in.
 *
 * Escape together is the one crisis action that ends an incident without a
 * body, and almost everything the ordinary checklist offers is wrong here: no
 * autopsy to issue, no Investigation to move to, no Blackened. What IS owed is
 * the part a GM is most likely to forget, because it is the only thing left -
 * the traces the fight put on the map, and the fact that two people can now
 * describe the attacker.
 *
 * The room comes from the killer, not the victim: the killer is the one who
 * stayed.
 */
async function afterEscape(state, victim, killer) {
    const third = state.thirdId ? game.actors.get(state.thirdId) : null;
    const name = actor => foundry.utils.escapeHTML(actor?.name ?? "?");

    const { roomOfActor } = await import("./movement.mjs");
    const room = roomOfActor(killer) ?? roomOfActor(victim);

    const owed = [
        game.i18n.format("DRPG.Murder.escapeWitness",
            { victim: name(victim), third: name(third) }),
        game.i18n.format("DRPG.Murder.escapeKiller", { killer: name(killer) })
    ];

    const action = await DialogV2.wait({
        classes: ["drpg-panel"],
        window: { title: game.i18n.localize("DRPG.Murder.escapeTitle") },
        content: dialogContent(`<div>
            <p>${game.i18n.format("DRPG.Murder.escapeIntro", {
                victim: name(victim), third: name(third), killer: name(killer)
            })}</p>
            <p><strong>${room
                ? game.i18n.format("DRPG.Murder.escapeRoom",
                    { room: foundry.utils.escapeHTML(room) })
                : game.i18n.localize("DRPG.Murder.escapeNoRoom")}</strong></p>
            <ul class="drpg-briefing-facts">${owed.map(o => `<li>${o}</li>`).join("")}</ul>
        </div>`),
        buttons: [
            { action: "remnants", default: true,
              label: game.i18n.localize("DRPG.Murder.escapeRemnants") },
            { action: "close", label: game.i18n.localize("DRPG.Panel.close") }
        ],
        rejectClose: false
    });

    if (action === "remnants") {
        const { openInvestigationDashboard } = await import("./investigation.mjs");
        return openInvestigationDashboard();
    }
    return null;
}

/**
 * The checklist of a close that left no body and was no escape (E32 C6, 28.09.2026;
 * audit S04-11). At Stage 6 the victim survived - a Survive, or a Stage 6 the GM took
 * with them alive - and what the fight left on the floor is still there, so the
 * Remnant table is offered as the escape's screen offers it. Before Stage 6 the
 * incident was interrupted: nothing was decided, and there is nothing to do but close.
 */
async function afterNoBody(state, victim, killer) {
    const survived = state.stage === "resolution";
    const name = actor => foundry.utils.escapeHTML(actor?.name ?? "?");
    const action = await DialogV2.wait({
        classes: ["drpg-panel"],
        window: { title: game.i18n.localize("DRPG.Murder.afterTitle") },
        content: dialogContent(`<div><p>${survived
            ? game.i18n.format("DRPG.Murder.afterSurvived", { victim: name(victim), killer: name(killer) })
            : game.i18n.localize("DRPG.Murder.afterInterrupted")}</p></div>`),
        buttons: [
            ...(survived ? [{ action: "remnants", default: true, label: game.i18n.localize("DRPG.Murder.escapeRemnants") }] : []),
            { action: "close", label: game.i18n.localize("DRPG.Panel.close"), ...(survived ? {} : { default: true }) }
        ],
        rejectClose: false
    });
    if (action === "remnants") {
        const { openInvestigationDashboard } = await import("./investigation.mjs");
        return openInvestigationDashboard();
    }
    return null;
}

/* ==========================================================================
 * TELLING THE TABLE
 * ========================================================================== */

async function tellGms(text, extra = {}) {
    await whisperToGms(`<p>${foundry.utils.escapeHTML(text)}</p>${
        extra.keys ? `<p><strong>${game.i18n.format("DRPG.Murder.keyCount", {
            n: extra.keys
        })}</strong></p>` : ""
    }`);
}

/** @returns the ChatMessage, so a Reroll can replace it rather than contradict it. */
/**
 * Tell the incident what just happened - the GMs AND the people in it.
 *
 * This used to whisper to the GMs alone. The player who had just rolled was
 * told nothing at all: not whether they hit the threshold, not what it did, not
 * that the turn had passed. They watched dice land and then waited for somebody
 * to say something out loud. It was the one action in the module that produced
 * no answer for the person taking it.
 *
 * Both participants get it, not just the roller. An incident is two people in a
 * room hitting each other; the victim who has just been Struck can see that as
 * plainly as the killer, and hiding it made the fight unreadable from inside.
 * The guide's secrecy is about who is doing this to WHOM out in the world, and
 * that is protected by the incident being invisible to everybody else - not by
 * keeping its two participants in the dark about each other.
 *
 * A third party who has walked in is included for the same reason: they are in
 * the room.
 *
 * WHO THAT IS, BY THE ONE TABLE (E06 C4, 27.09.2026; audit S04-01, S04-36): the
 * incident's audience at the stage the card is written (`incidentAudienceIds`) and
 * the actor who acted. The list used to be the owners of the killer, the victim
 * and the third, read off the state - so a trap's builder, who is in no room and
 * holds no copy of the cast until Stage 6, was sent every card of the fight, and
 * a third who chose Averted eyes was not sent the card of their own choice: the
 * choice nulls `thirdId` before the card is written. The acting actor is on it
 * whoever the table seats; the builder of a running trap is not, unless the card
 * is theirs.
 *
 * AT THE STAGE THE ACTION WAS TAKEN AT (E06 fix r1-G3, 28.09.2026; review m1 = F3), which
 * the caller passes. The seats were read at the stage the card is written at, and an
 * action that ends a trap - the victim running out (`checkVictimSpent`), Survive - moves
 * it to `resolution` first, where the table seats the builder again: they were sent the
 * victim's last action, its total and its band, while the dice relay for the same roll,
 * reported while the stage was `incident`, left them out. The owner's rule is the roll's
 * stage; the tier-2 test "a trap's last crisis card does not reach its builder" reads it.
 */
async function announceCrisis(actor, def, { success, band, total, threshold, done, stage }) {
    // On a success, the sentence for the band that came up. On a failure,
    // NOTHING from the table - what happened is in `done`.
    //
    // `def.failure` is one string covering every branch at once: "Nothing on a
    // Hope failure. On Despair you still take 1 Sanity off them and leave an
    // Evident Remnant; a critical failure leaves an Obvious one." That is a
    // reference table, and the player has to work out which third of it applies
    // to the roll they just made - while the line directly under it already
    // lists what the module actually did.
    //
    // Worse, three of those strings had drifted from the code: Self-defence and
    // Role reversal both promise an extra point of drain on a Despair failure
    // and neither has `failureExtraDrain` set, and Escape together promises the
    // newcomer becomes a second victim, which nothing implements. Printing the
    // receipt instead of the promise cannot drift.
    const outcome = success ? (def[band] ?? "") : "";
    const state = murderState();

    // A `noRoll` action has no dice and no threshold, so the score line is
    // nonsense for it - it printed "0 ≥ undefined · with Hope". What it has
    // instead is the sentence describing the choice.
    const score = def.noRoll
        ? `<p><em>${foundry.utils.escapeHTML(callEffect(def) || def.hint || "")}</em></p>`
        : `<p>${total} ${success ? "≥" : "<"} ${threshold} · ${
            game.i18n.localize(`DRPG.Murder.band.${band}`)}</p>`;

    // A failure that changed nothing at all still gets a sentence. An empty
    // card under a score line reads as though the module lost the result.
    const nothing = !success && !done.length
        ? `<p>${game.i18n.localize("DRPG.Murder.failedNothing")}</p>`
        : "";

    const content = `
        <h3>${foundry.utils.escapeHTML(def.label)} - ${foundry.utils.escapeHTML(actor.name)}</h3>
        ${score}
        ${outcome ? `<p>${foundry.utils.escapeHTML(outcome)}</p>` : ""}
        ${nothing}
        ${done.length ? `<ul>${done.map(d => `<li>${d}</li>`).join("")}</ul>` : ""}`;

    const recipients = new Set([...gmIds(), ...(state ? incidentAudienceIds(state, { stage, also: [actor] }) : [])]);

    return announce({ content, whisper: Array.from(recipients) });
}

/**
 * Tell the opening roll's side what it came to - the GMs and the incident's audience at
 * `openingRoll`: the killers of a direct murder (an accomplice seated with them among
 * them), a trap's victim (E06 fix r1-G3, 28.09.2026; review M4). The owner's requirement
 * of 27.09 is that everyone in the incident sees EACH incident roll's result and which
 * roll it was, and the opening's went to the GMs alone: the roll's own card is hidden
 * (`enforceContentVisibility`, private-rolls.mjs), so without Dice So Nice a killer
 * whose opening failed saw nothing of it - the murder simply ended - and a trap's victim
 * who noticed the trap was told nothing either (the review ran it for the direct killer
 * on p3, and read it for the trap's victim). The crisis card's score line, under the opening's name; what the
 * result bought stays the GMs' (`tellGms`). A direct murder's victim is not seated at the
 * opening (D6), so they are sent nothing of it, whichever way it goes - 13-murder-signals'
 * "opening" and "direct" phases read that with and without Dice So Nice.
 */
async function announceOpening(state, label, { rollerId, success, band, total, threshold }) {
    try {
        const roller = game.actors.get(rollerId ?? "");
        const content = `
            <h3>${foundry.utils.escapeHTML(label ?? "")}${roller ? ` - ${foundry.utils.escapeHTML(roller.name)}` : ""}</h3>
            <p>${total} ${success ? "≥" : "<"} ${threshold} · ${game.i18n.localize(`DRPG.Murder.band.${band}`)}</p>`;
        const recipients = new Set([...gmIds(), ...incidentAudienceIds(state, { stage: "openingRoll" })]);
        await announce({ content, whisper: Array.from(recipients) });
    } catch (err) {
        // The opening is scored either way; the card is what it came to, not what it does.
        error("Could not tell the opening roll's side what it came to", err);
    }
}

/* ==========================================================================
 * THE GM'S TRACKER
 * ========================================================================== */

/** Open a murder from the GM panel. */
export async function openMurderDialog({ killerId = null, indirect = false } = {}) {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    if (murderState()) return openIncidentTracker();

    /*
     * THE ECLIPSE IS ASKED HERE, NOT AT CONFIRM (F11).
     *
     * `openMurder` refuses during placement and always has, but it is the last
     * line of the form: the GM picked a killer, a victim and a checkbox, pressed
     * "Open it", and was told the Eclipse is a placement window - then told a
     * second time that no murder is running, because the tracker was opened
     * whether or not anything had opened. The GM panel's tile has been greyed with
     * a tooltip for exactly this reason; the road that was left is the trap card's
     * "fire the trap" button, which prefills the killer and cannot grey itself
     * while a chat card sits in the log.
     *
     * AFTER the running-incident shortcut above, on purpose. That branch is not
     * about opening anything - a GM who presses this mid-incident wants the
     * tracker, and the Eclipse has no opinion about a fight already in progress.
     * And before `livingStudents()`, so nothing is read for a window that is not
     * going to open.
     *
     * Returning null is what keeps the trap's ruling card usable: `fireTrap`
     * settles the card only on a truthy answer, so the button stays there for when
     * the lights come up.
     */
    const { isEclipse } = await import("./eclipse.mjs");
    if (isEclipse()) {
        ui.notifications.warn(game.i18n.localize("DRPG.Eclipse.murderWindowLocked"));
        return null;
    }

    const { livingStudentsForGm } = await import("./chapter.mjs");
    const alive = livingStudentsForGm();
    // One is enough, now that a student can be both sides of it. The old floor
    // of two was the last place the engine still assumed a murder needs two
    // people - and the case it locked out, a single survivor with nothing left
    // to do, is the one where this ending is likeliest.
    if (!alive.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Murder.needOne"));
        return null;
    }

    const optionsFor = selected => alive
        .map(a => `<option value="${a.id}"${a.id === selected ? " selected" : ""}>${
            foundry.utils.escapeHTML(a.name)}</option>`).join("");

    /*
     * THE VICTIM DOES NOT START AS THE KILLER (D-F5-1).
     *
     * Both dropdowns are built from the same list of the living, and a select
     * with nothing marked shows its first option - so the window opened
     * proposing that somebody kill themselves.
     *
     * That pair is now LEGAL (see `openMurder`), which changes what this
     * defence is for rather than removing the need for it. It is no longer
     * about heading off a refusal; it is about not proposing one of the two
     * heaviest things at this table as the value nobody touched. A GM who wants
     * it picks it, and the note below says out loud what they have picked.
     *
     * The old render hook that MOVED the victim whenever the killer landed on
     * them is gone with the refusal: it would now silently undo a deliberate
     * choice, and it fired on exactly the gesture a GM reaching for this ending
     * is most likely to make.
     */
    const defaultKiller = killerId ?? alive[0]?.id ?? null;
    const defaultVictim = (alive.find(a => a.id !== defaultKiller) ?? alive[0])?.id ?? null;

    const options = optionsFor(defaultVictim);

    // Which killers have a finished trap waiting. The checkbox follows the
    // dropdown from this, so "indirect" stops being a box a GM has to remember
    // to tick - or remember NOT to tick on a murder that had no project.
    const { allProjects, isComplete } = await import("./projects.mjs");
    const armed = new Set(allProjects()
        // `isComplete` rather than `current >= start` written out again: the
        // hand-rolled version was missing its `start > 0` half, so an indirect
        // murder countdown with no target at all counted as a finished trap.
        .filter(p => p.indirectMurder && isComplete(p))
        .map(p => p.killerId ?? null)
        .filter(Boolean));

    const result = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Murder.openTitle") },
        // Named so it can be addressed - the diagnostics count it and the suite
        // closes it - and deliberately WITHOUT an `alreadyOpen` guard, exactly
        // like the incident tracker's own class.
        classes: ["drpg-panel", "drpg-window-murder"],
        content: dialogContent(`<form>
            <p class="notes">${game.i18n.localize("DRPG.Murder.openIntro")}</p>
            <label>${game.i18n.localize("DRPG.Murder.killer")}
                <select name="killer">${optionsFor(defaultKiller)}</select></label>
            <label>${game.i18n.localize("DRPG.Murder.victim")}
                <select name="victim">${options}</select></label>
            <label class="drpg-checkbox">
                <input type="checkbox" name="indirect"${
                    /*
                     * THE KILLER THE DROPDOWN IS SHOWING, NOT THE ONE THE CALLER
                     * NAMED (F10). `killerId` is this function's argument and the
                     * GM panel passes none, so `armed.has(null)` was false on the
                     * one road where the question is worth asking - and the box
                     * stayed unticked for a killer whose trap is finished until the
                     * GM touched a dropdown they had no reason to touch. The
                     * `change` listener below has always asked
                     * `armed.has(form.killer.value)`; this is the same question at
                     * first render. On the trap road `defaultKiller` IS `killerId`,
                     * so nothing there changes.
                     */
                    indirect || armed.has(defaultKiller) ? " checked" : ""} />
                ${game.i18n.localize("DRPG.Murder.indirect")}</label>
            <p class="notes">${game.i18n.localize("DRPG.Murder.indirectCost")}</p>
            <p class="notes drpg-warning" data-drpg-self hidden>${
                game.i18n.localize("DRPG.Murder.openSelfNote")}</p>
        </form>`),
        render: (event, dialog) => {
            const form = dialog.element.querySelector("form");
            if (!form) return;
            const note = dialog.element.querySelector("[data-drpg-self]");

            /*
             * Say it, rather than prevent it.
             *
             * One name in both dropdowns is a real incident now, and it is also
             * something a GM can arrive at by accident - picking a killer who
             * happened to be the selected victim used to be corrected for them.
             * Correcting it silently is the wrong half of the trade in both
             * directions, so what happens instead is that the window tells them
             * which of the two they are looking at, live, before Confirm.
             *
             * The trap checkbox goes with it: an indirect self-inflicted death
             * opens on a roll that cannot mean anything (see `openMurder`), so
             * it is cleared and locked rather than quietly ignored downstream.
             */
            const sync = () => {
                const self = form.killer.value === form.victim.value;
                if (note) note.hidden = !self;
                form.indirect.disabled = self;
                if (self) form.indirect.checked = false;
            };

            form.killer.addEventListener("change", () => {
                if (form.killer.value !== form.victim.value) {
                    form.indirect.checked = armed.has(form.killer.value);
                }
                sync();
            });
            form.victim.addEventListener("change", sync);
            sync();
        },
        buttons: [
            {
                action: "ok", label: game.i18n.localize("DRPG.Murder.openConfirm"), default: true,
                callback: (e, b, d) => {
                    const f = d.element.querySelector("form");
                    return {
                        killerId: f.killer.value,
                        victimId: f.victim.value,
                        indirect: f.indirect.checked
                    };
                }
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    if (!result || result === "cancel") return null;

    /*
     * One name in both seats no longer needs confirming twice. It was refused
     * here; the window now says what it is while the GM is still looking at it,
     * and `openMurder` is the one place that decides what such an incident does.
     *
     * AND ITS ANSWER IS READ (F11). This used to be `await openMurder(result);`
     * followed unconditionally by the tracker, which has two consequences and both
     * were shipped. A refusal - the Eclipse, an incident already running, a missing
     * actor - warned once from `openMurder` and again from the tracker ("No murder
     * is running"). And because `openIncidentTracker` returns null on every road,
     * THIS function always resolved falsy: `fireTrap` in messenger-app.mjs settles
     * the trap's ruling card only on a truthy answer, so a trap that really did
     * become an incident left "Awaiting a ruling" and a live button on the thread
     * for the rest of the chapter.
     *
     * The tracker stays AWAITED. The GM panel reopens itself when a tile's `run()`
     * resolves, on the stated assumption that every tile awaits its own dialog -
     * returning early here would drop the panel on top of a live incident.
     */
    const opened = await openMurder(result);
    if (!opened) return null;

    await openIncidentTracker();
    return true;
}

/**
 * Throw one of the two opening rolls.
 *
 * Rolled on the GM's client, on the participant's actor. That is a deliberate
 * difference from every other roll in this module: Stage 4 happens before the
 * table knows an incident is coming, and handing the victim a roll window
 * titled "opening roll - victim" would tell them the one thing the guide is
 * careful not to.
 *
 * Night swings both rolls, in opposite directions.
 */
/**
 * Stage 4, handed to the person it is about.
 *
 * These two dice decide whether a murder happens at all, and they used to be
 * thrown on the GM's client - so the roll window opened on the wrong screen, the
 * Hope or Sanity it produced was committed by the GM, and a Call the killer had
 * armed for exactly this moment could not be reached. The guide gives the roll
 * to the killer and to the victim; this gives them the dice.
 *
 * The GM still throws it when there is nobody to ask: an unowned character, or
 * an owner who is not connected. That is not a fallback for convenience - an
 * incident cannot wait on somebody who has gone home.
 */
/**
 * What this Stage 4 roll is called, on the window and in the whisper.
 *
 * Prose from config.mjs rather than an i18n key - see MURDER_OPENING. The
 * self-inflicted variant matters here more than anywhere else it is read: the
 * roll goes to the player's own client, and a dialog titled "Opening roll -
 * killer" is a strange thing to put in front of somebody rolling for their own
 * death.
 */
function openingLabel(side, state = murderState()) {
    const def = MURDER_OPENING[side];
    return ((state?.selfInflicted && def?.selfInflicted) || def)?.label ?? "";
}

async function rollOpening(side, state) {
    const actor = game.actors.get(side === "killer" ? state.killerId : state.victimId);
    if (!actor) return null;

    const owner = ownerOf(actor);
    if (owner?.active) {
        const { askOpeningRoll } = await import("./gm-bridge.mjs");
        if (askOpeningRoll({ userId: owner.id, actorId: actor.id, side })) {
            // `label` is prose from config.mjs, not an i18n key - see MURDER_OPENING.
            await whisperToOwner(actor, `<p><strong>${
                foundry.utils.escapeHTML(openingLabel(side, state))
            }</strong> - ${game.i18n.localize("DRPG.Murder.openingYours")}</p>`);
            return { asked: true, of: owner.name };
        }
    }

    return throwOpeningRoll(side, actor.id);
}

/**
 * Throw the opening roll on THIS client, then hand the numbers to a GM.
 * Exported because `gm-bridge` calls it when the invitation arrives.
 *
 * `side` is whichever side this murder actually rolls - killer for a direct one,
 * victim for a trap - not a choice made here.
 */
/**
 * How many Stage 4 invitations this client is currently sitting inside.
 *
 * `closeOpeningRoll` needs to know whether the roll dialog on screen is one of
 * ours before it closes anything: a player may well have their own Search roll
 * open at the same moment, and revoking a murder invitation must not shut that.
 */
let openingRollsInFlight = 0;

/** The tracker's "ask again": once per ten seconds on this client. */
let lastReask = 0;
const REASK_COOLDOWN_MS = TIMING.reaskCooldownMs;

/**
 * Is the invitation this client is answering still wanted?
 *
 * Read from the world state, which every client can see, so the player's own
 * browser can tell that the incident it is rolling for has been closed. Without
 * this the retry loop below re-offered a roll for a murder that no longer
 * existed - three times, per incident, for ever.
 */
function openingStillWanted(side, actorId) {
    const state = murderState();
    if (!state?.active || state.stage !== "openingRoll") return false;
    return (side === "killer" ? state.killerId : state.victimId) === actorId;
}

/**
 * Take back a Stage 4 invitation on THIS client.
 *
 * Called locally when a GM threw the roll themselves, and over the socket when
 * the roll belongs to a player. Closing the dialog makes Daggerheart's own
 * promise resolve as a cancellation, so `throwOpeningRoll` falls out of its
 * loop by the ordinary route rather than by anything exotic.
 */
export function closeOpeningRoll() {
    if (!openingRollsInFlight) return 0;

    let closed = 0;
    for (const app of foundry.applications.instances?.values?.() ?? []) {
        if (!app.rendered || app.constructor.name !== "D20RollDialog") continue;
        app.close();
        closed++;
    }
    return closed;
}

/**
 * Tell whoever was invited that the invitation is off.
 *
 * The players seated at the opening are told (`incidentAudienceIds` at `openingRoll`):
 * the side that rolls - a direct murder's killers, a trap's victim - and nobody
 * else. Until E06 both the killer and the victim were, on the reading that a
 * message to somebody with nothing in flight costs nothing; it costs a direct
 * murder's victim the one fact D6 keeps from them - measured 27.09 by the tier-2
 * test "a failed opening tells the victim nothing", which caught the cancel
 * addressed to the victim's player as the killer's roll failed. The side is the
 * murder's kind, fixed as it opens, and every re-sent invitation goes to it
 * (`rollOpening`). The GM's own client is closed directly, because a roll with no
 * active owner is thrown here.
 */
async function revokeOpeningInvitation(state) {
    closeOpeningRoll();
    if (!state?.killerId && !state?.victimId) return;

    const { cancelOpeningRoll } = await import("./gm-bridge.mjs");
    for (const userId of incidentAudienceIds(state, { stage: "openingRoll" })) cancelOpeningRoll({ userId });
}

export async function throwOpeningRoll(side, actorId) {
    const def = MURDER_OPENING[side];
    const actor = game.actors.get(actorId);
    if (!def || !actor) return null;

    const calls = await import("./call-effects.mjs");
    const night = atNight();
    const situational = night ? (def.nightAdvantage ? 1 : def.nightDisadvantage ? -1 : 0) : 0;
    if (situational) calls.armSituational(situational);

    // Stage 4 is not optional.
    //
    // Closing the roll window used to end it: `rollTrait` returned null, this
    // returned null, and the incident sat in `openingRoll` for ever with the
    // only way forward being the GM noticing and clicking again. An indirect
    // murder made that worse - the victim's roll is the ONLY one, so declining
    // it stalled the whole trap.
    //
    // So it is re-offered rather than accepted. Capped, because a client that
    // has gone away must not be trapped in a reopening dialog: after the cap the
    // GM is told, and the button is still theirs to press.
    // ...unless the murder it belongs to is over.
    //
    // The re-offer had no way of noticing that. A GM who opened an incident and
    // closed it again left the invitation standing on the player's screen, and
    // every attempt to dismiss it reopened the window twice more - measured:
    // closing it took three closes, and four abandoned incidents left four
    // stacked "Body Roll" windows warning about a murder that no longer existed.
    const MAX_ATTEMPTS = TIMING.openingAttempts;
    let roll = null;
    openingRollsInFlight++;
    try {
        const { rollTrait } = await import("./action-rolls.mjs");
        for (let attempt = 1; attempt <= MAX_ATTEMPTS && !roll; attempt++) {
            if (!openingStillWanted(side, actorId)) break;
            roll = await rollTrait(actor, def.traits[0], {
                remember: false,
                actionKey: "murderOpening",
                // Thrown on the participant's own client - see `openingLabel`.
                title: game.i18n.localize(murderState()?.selfInflicted
                    ? "DRPG.Roll.opening.selfInflicted"
                    : `DRPG.Roll.opening.${side}`),
                context: { side }
            });
            if (!roll && attempt < MAX_ATTEMPTS && openingStillWanted(side, actorId)) {
                ui.notifications.warn(game.i18n.localize("DRPG.Murder.openingRequired"));
            }
        }
    } finally {
        openingRollsInFlight = Math.max(0, openingRollsInFlight - 1);
        calls.clearSituational();
    }

    if (!roll) {
        // Only a refusal is worth telling the GMs about. An invitation THEY
        // revoked is not news, and reporting it as "declined their opening
        // roll" would blame the player for the GM closing the incident.
        if (openingStillWanted(side, actorId)) {
            const { whisperToGms } = await import("./utils.mjs");
            await whisperToGms(`<p class="drpg-warning">${
                game.i18n.format("DRPG.Murder.openingDeclined", {
                    name: foundry.utils.escapeHTML(actor.name)
                })}</p>`);
        }
        return null;
    }

    const { requestOpeningResult } = await import("./gm-bridge.mjs");
    const res = await requestOpeningResult({
        actorId: actor.id,
        side,
        total: roll.total,
        isCritical: Boolean(roll.isCritical),
        withHope: Boolean(roll.withHope)
    });
    // Read here and not handed on (E31): a GM's own client answers what it
    // resolved, a player's that the GM has it.
    if (!res.ok) return null;
    return game.user.isGM ? res.value : { pending: true };
}

/**
 * Apply a thrown opening roll. GM side - Stage 4 writes world state.
 *
 * The side is re-derived from the incident rather than trusted from the packet:
 * the payload says "this was the killer's roll", and the only thing that decides
 * that is who `murderState()` says the killer is.
 */
export async function resolveOpening({ actorId, side, total, isCritical, withHope } = {}) {
    if (!game.user.isGM) return null;
    const state = murderState();
    if (!state || state.stage !== "openingRoll") return null;

    const real = actorId === state.killerId ? "killer"
        : actorId === state.victimId ? "victim" : null;
    if (!real || real !== side) {
        warn(`Refused an opening roll: ${actorId} is not the ${side} of this incident.`);
        return null;
    }

    const payload = { total, isCritical: Boolean(isCritical), withHope: Boolean(withHope) };
    return real === "killer"
        ? resolveKillerOpening(payload)
        : resolveVictimOpening(payload);
}

/** The live tracker: whose turn, what is left, and the controls. */
/** The three people in the incident, and the victim's Health and Sanity marks as text. */
function incidentPeople(now) {
        const killer = game.actors.get(now.killerId);
        const victim = game.actors.get(now.victimId);
        const third = now.thirdId ? game.actors.get(now.thirdId) : null;
        // Marks, the sheet's own direction (W-1): 0/6 is untouched.
        const left = res => victim ? marksOf(victim, res) : "?";
        return { killer, victim, third, left };
}

/* THE WRAPPER IS PART OF THE ANSWER, not decoration on the call site.

   `keepLive` looks its region up by selector on every round and REPLACES the element
   it finds - so a `build()` that returns the region's CONTENTS replaces the region
   with its own first child, and the second refresh has nothing left to find. Measured
   on 11.09 with exactly that mistake: one Pass the turn and the window read "Player A
   -> Player B" and nothing else, with `.drpg-incident-live` gone from the DOM.
   `buildConsole` in trial-floor-ui.mjs carries its own class for the same reason. */
function incidentTrackerHtml(now, cleanup) {
    // The incident is gone but the window is still up - the live hook below closes it
    // on the next tick, and until then it says so rather than showing a dead fight.
    if (!now) {
        return `<div class="drpg-incident-live"><p class="notes">${
            game.i18n.localize("DRPG.Murder.trackerOver")}</p></div>`;
    }
    const { killer, victim, third, left } = incidentPeople(now);

    /*
     * AN INCIDENT WHOSE CAST IS GONE SAYS SO (20.09).
     *
     * The cast is two actor ids, held in the GMs' client-scoped `incidentCast`
     * since LIVE-001 and merged in by `murderState`. An actor deleted while an
     * incident stands open - a fixture from a suite run that died, a character
     * removed between sessions - leaves the world insisting a fight is running
     * and this window reading "? -> ?". Every control on it then acts
     * on a side that does not exist: passing the turn writes a turn nobody owns,
     * and the tracker is the only screen that could have explained it.
     *
     * ONLY AN ID THAT NAMES NOBODY. A GM whose copy of the cast has not arrived
     * yet has no ids at all, and that is a sync still in flight, not a deleted
     * actor - so an empty id is left alone and only an id `game.actors` cannot
     * find is reported.
     *
     * It cannot repair itself - which actor was meant is not recoverable - so it
     * names what is missing and points at the one button that helps. The stage
     * and the count below stay: they are what a GM needs to decide whether
     * anything of this incident is worth writing down before it goes.
     */
    const lost = [
        now.killerId && !killer && !now.selfInflicted ? game.i18n.localize("DRPG.Murder.side.killer") : null,
        now.victimId && !victim ? game.i18n.localize("DRPG.Murder.side.victim") : null
    ].filter(Boolean);

    return `<div class="drpg-incident-live">
        ${lost.length ? `<p class="drpg-warning">${game.i18n.format(
            "DRPG.Murder.trackerCastGone", { who: lost.join(", ") })}</p>` : ""}
        <p>${now.selfInflicted
            // One name, and an arrow pointing at itself would be the only
            // thing on this line that is not true.
            ? `<strong>${foundry.utils.escapeHTML(victim?.name ?? "?")}</strong> · ${
                game.i18n.localize("DRPG.Murder.selfInflicted")}`
            : `<strong>${foundry.utils.escapeHTML(killer?.name ?? "?")}</strong> →
               <strong>${foundry.utils.escapeHTML(victim?.name ?? "?")}</strong>${
                third ? ` · ${game.i18n.format("DRPG.Murder.thirdIs", {
                    name: foundry.utils.escapeHTML(third.name)
                })}` : ""}`}</p>
        <p>${now.selfInflicted
            // No turn and no side to report: there is no Stage 5 in this one.
            ? game.i18n.format("DRPG.Murder.trackerStateSelf", {
                stage: game.i18n.localize(`DRPG.Murder.stage.${now.stage}`)
            })
            : game.i18n.format("DRPG.Murder.trackerState", {
                stage: game.i18n.localize(`DRPG.Murder.stage.${now.stage}`),
                turn: now.turn,
                side: game.i18n.localize(`DRPG.Murder.side.${now.turnSide}`)
            })}</p>
        <p>${game.i18n.format("DRPG.Murder.victimMarks", {
            hp: left("hitPoints"), stress: left("stress")
        })}</p>
        <p>${game.i18n.format("DRPG.Murder.keyCount", { n: now.keyRemnants })}</p>
        ${cleanupSection(killer, cleanup)}</div>`;
}

/* WHICH BUTTONS ARE ON IT, which `keepLive` cannot change - it replaces a region of
   the content, not a DialogV2 footer built once. Same answer the trial console reached
   for the same reason: when the SET of buttons would differ, reopen instead. */
function incidentSignature(now) {
    return now ? [now.stage, now.selfInflicted].join("|") : null;
}

/** The footer, by stage: re-ask the opening roll, pass the turn, end the incident, close. */
function incidentButtons(state) {
    return [
        // There is no unconditional "roll the opening" button, and there must not
        // be one - the rate-limited re-ask at the end of this note is the exception.
        //
        // Stage 4 offers exactly one roll and its owner is not a decision:
        // a direct murder opens on the KILLER's roll, a trap on the VICTIM's.
        // `openMurder` sends that invitation itself the moment the incident
        // opens, so by the time this window is on screen the roll is already
        // with whoever owes it.
        //
        // A button here only ever sent a SECOND copy. Measured: opening one
        // incident and pressing it three times left the player with FOUR
        // stacked roll windows, each of which reopened itself twice more when
        // dismissed - the retry loop cannot tell an unwanted duplicate from a
        // refusal. And because the tracker reopens after every action with
        // this button as `default`, holding Enter sent invitations for as
        // long as you held it.
        //
        // Nothing is lost by its absence. An owner who is offline never gets
        // an invitation in the first place - `rollOpening` sees that and
        // throws the roll on the GM's own client - and an owner who is here
        // is re-offered three times before anyone has to intervene.
        // And none at all for a self-inflicted death: there is no turn to
        // pass, so the window's DEFAULT button - the one Enter presses -
        // would have been a control for a stage this incident never enters.
        // ...but an invitation that was declined three times can be sent
        // once more from here (CASE-10): the alternative was End and open
        // it again, which repeated the whole three-strike loop. Rate-limited
        // on this client so a held Enter cannot stack windows again.
        ...(state.stage === "openingRoll" && !state.selfInflicted ? [
            { action: "reask", label: game.i18n.localize("DRPG.Murder.openingReask") }
        ] : []),
        ...(state.stage === "openingRoll" || state.selfInflicted ? [] : [
            // No "somebody walks in" button. The guide's third party is
            // whoever "wejdzie do pomieszczenia poprzez akcję ruch", and
            // `maybeThirdParty` already watches token movement into the
            // victim's room and registers them the moment it happens. A
            // second, manual route only invited the GM to nominate somebody
            // who had not actually walked in - and to do it twice, since the
            // watcher had usually already fired.
            { action: "pass", label: game.i18n.localize("DRPG.Murder.passTurn"), default: true }
        ]),
        { action: "end", label: game.i18n.localize("DRPG.Murder.endMurder") },
        { action: "close", label: game.i18n.localize("DRPG.Panel.close") }
    ];
}

/** Send the opening roll again, once the cooldown allows. */
function reaskOpening() {
    const now = Date.now();
    if (now - lastReask < REASK_COOLDOWN_MS) {
        ui.notifications.warn(game.i18n.localize("DRPG.Murder.openingReaskWait"));
    } else {
        lastReask = now;
        const current = murderState();
        if (current?.stage === "openingRoll") {
            rollOpening(current.indirect ? "victim" : "killer", current)
                .catch(err => error("Could not re-send the opening roll", err));
            ui.notifications.info(game.i18n.localize("DRPG.Murder.openingReaskSent"));
        }
    }
}

export async function openIncidentTracker() {
    /*
     * NO `alreadyOpen` GUARD HERE, and it is the one window that must not have
     * one. Every other window in the module is opened by somebody pressing a
     * thing; this one REOPENS ITSELF after every crisis action, which is the
     * whole reason it is usable during an incident. A duplicate was never the
     * complaint about it, and a guard that fires while the previous copy is
     * still closing would refuse the reopen and leave the incident with no
     * tracker at all - turning a nuisance somebody else has into a broken
     * scene here.
     *
     * It still carries `drpg-window-incident`, so the diagnostics can count it
     * and a future caller can ask.
     */

    if (!game.user.isGM) return null;
    const state = murderState();
    if (!state) {
        ui.notifications.warn(game.i18n.localize("DRPG.Murder.none"));
        return null;
    }

    /* AWAITED ONCE, HERE, so the body below can be rebuilt synchronously.

       `keepLive` calls `build()` and uses what comes back; a promise is not markup. The
       import has to be dynamic - cleanup.mjs reads the incident state out of this file and
       a static pair both ways is a cycle - so it is paid for at the door instead of inside
       the thing that runs sixty times a fight. */
    const cleanup = await import("./cleanup.mjs");

    /**
     * What the tracker says, read fresh every time it is asked.
     *
     * THIS WINDOW WAS A PHOTOGRAPH, AND IT IS THE ONE WINDOW THAT CANNOT BE.
     *
     * Measured on 11.09 with one tracker open and nothing touching it: it read "turn 1 -
     * victim to act, Victim 5/5 Health, 6/6 Sanity" and went on reading exactly that
     * through a crisis action, through a trace being left, through the victim dying and
     * through the murder being closed. Every other console in the module is on `keepLive`;
     * this was the only one that was not, and it is the console for the fastest-moving
     * scene in the game - the GM watches an incident here while the players drive it from
     * their sheets, so nothing that changes is a change this client made.

     * The old excuse was that it "reopens itself after every action" - it does, but only
     * after the GM presses Pass the turn, which is the one move a table with players in the
     * incident never uses.
     */
    const read = () => murderState();

    const trackerBody = () => incidentTrackerHtml(read(), cleanup);
    const signature = () => incidentSignature(read());
    const openedWith = signature();
    let settling = false;

    const action = await tableDialog({
        // `cleanupSection()` puts a table in this window once Stage 6 has traces to
        // list - `tableDialog` is what sizes the window to it.
        window: { title: game.i18n.localize("DRPG.Murder.trackerTitle") },
        classes: ["drpg-panel", "drpg-window-incident"],
        content: dialogContent(trackerBody()),
        buttons: incidentButtons(state),
        render: (event, dialog) => keepLive(dialog, {
            region: ".drpg-incident-live",
            build: trackerBody,
            /* Actors for the victim's Health and Sanity, tokens for the traces the
               clean-up table lists, the world half for the stage, and the cast for the
               turn. The cast is client-scoped, so Foundry writes it straight to
               localStorage and `updateSetting` never fires for it; until 1.2.66 it did not
               change mid-incident, and the turn was the world half's. Since E32 C2 a pass
               writes the cast alone, and its setting's change says so (`drpgCastChanged`,
               settings.mjs). */
            watch: { actors: true, tokens: true, settings: [SETTINGS.murderState], hooks: ["drpgCastChanged"] },
            after: () => {
                if (settling) return;
                const now = signature();
                if (now === openedWith) return;
                settling = true;
                /* The fight is over: shut, rather than reopening onto nothing. The
                   `endMurder` route closes this window itself; this is the backstop for
                   every other way an incident can stop existing. */
                const again = now !== null;
                dialog.close()
                    .then(() => (again ? openIncidentTracker() : null))
                    .catch(err => error("Could not refresh the incident tracker", err));
            }
        }),
        rejectClose: false
    });

    if (action === "pass") {
        await passTurn();
        return openIncidentTracker();
    }
    if (action === "reask") {
        reaskOpening();
        return openIncidentTracker();
    }
    if (action === "end") {
        const sure = await DialogV2.confirm({
            classes: ["drpg-panel"],
            window: { title: game.i18n.localize("DRPG.Murder.endMurder") },
            content: `<p>${game.i18n.localize("DRPG.Murder.endConfirm")}</p>`
        });
        if (sure) await endMurder();
    }
    return null;
}

/**
 * What the killer is standing in, once the fight is over.
 *
 * Read-only on purpose. The clean-up itself is the killer's action and costs
 * their Sanity - the GM watching it happen needs to know what is still there and
 * what will not come off, not a button to do it for them. Reinforced traces are
 * listed and marked rather than hidden: "there is one you cannot touch" is the
 * single most useful thing this table says.
 *
 * The thresholds are deliberately shown here and nowhere the killer can see -
 * they are read off the trace's own visibility, which is the answer key.
 */
/**
 * @param {Actor|undefined} killer
 * @param {object} cleanup  cleanup.mjs, imported once by the caller - see the note there.
 */
function cleanupSection(killer, cleanup) {
    const state = murderState();
    if (state?.stage !== "resolution" || !killer) return "";

    const { cleanableRemnants, cleaningTier, cleaningTool } = cleanup;
    const traces = cleanableRemnants(killer);

    const tool = cleaningTool(killer);
    const toolLine = tool
        ? game.i18n.format("DRPG.Cleanup.gmTool", {
            item: foundry.utils.escapeHTML(tool.name), tier: cleaningTier(killer)
        })
        : game.i18n.localize("DRPG.Cleanup.gmNoTool");

    if (!traces.length) {
        return `<h4>${game.i18n.localize("DRPG.Cleanup.title")}</h4>
                <p class="notes">${toolLine}</p>
                <p><em>${game.i18n.localize("DRPG.Cleanup.gmNothingHere")}</em></p>`;
    }

    const rows = traces.map(t => `<tr>
        <td>${foundry.utils.escapeHTML(`${t.data.visibilityLabel} ${t.data.typeLabel}`)}</td>
        <td>${foundry.utils.escapeHTML(t.data.note || t.data.subject || "-")}</td>
        <td>${t.data.reinforced
            ? `<strong>${game.i18n.localize("DRPG.Cleanup.gmReinforced")}</strong>`
            : `DC ${t.dc}`}</td>
    </tr>`).join("");

    // How much scrubbing the killer still has in them. Stage 6 has no turn
    // limit - it ends when the Sanity runs out or the GM says so - and without
    // this the GM had no way to see which of those was coming.
    const left = Math.max(0,
        Math.floor((resourceMax(killer, "stress") - resourceValue(killer, "stress"))
            / RESOLUTION_STRESS_COST));

    return `<h4>${game.i18n.localize("DRPG.Cleanup.title")}</h4>
        <p class="notes">${toolLine}</p>
        <p class="notes">${plural("DRPG.Cleanup.gmAttemptsLeft", { n: left })}</p>
        <table class="drpg-vault-table"><thead><tr>
            <th>${game.i18n.localize("DRPG.Cleanup.gmTrace")}</th>
            <th>${game.i18n.localize("DRPG.Cleanup.gmNote")}</th>
            <th>${game.i18n.localize("DRPG.Cleanup.gmThreshold")}</th>
        </tr></thead><tbody>${rows}</tbody></table>`;
}
