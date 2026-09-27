/**
 * Danganronpa RPG - the pre-session note.
 * ---------------------------------------------------------------------------
 * Player Handbook, ch. 8: "The five most important lines in the whole system."
 * Seven questions a player answers before every session - whether they intend
 * to kill, whether they are open to dying, whether they consent to torture or
 * romance, what their triggers are, how they mean to play, and what large
 * project they are aiming at. The GMs read them before every session and steer
 * around them.
 *
 * Chapter 13 then makes the first four load-bearing: "The first four questions
 * in the pre-session note are your boundaries, not a declaration of courage."
 *
 * None of it existed in the module. It lived on Discord - which is to say, in
 * another window, on another screen, at the moment a GM is deciding whether to
 * approve a murder.
 *
 * WHERE IT IS STORED (E05, 1.2.64; audit S11-03, S01-08).
 *
 * In the GMs' store (gm-stores.mjs `noteStore`), a row per user: the text, when
 * it was written, and whether a GM typed it. Until 1.2.64 it was a flag on the
 * player's own User document, which Foundry ships to every browser - and the
 * first question is "Am I planning to kill? How?": 72-canary found p3's note on
 * p1's and p2's browsers (E30 C20, 24.09.2026). The flag stays, holding only
 * `{ updatedAt, written }` for the roster and the player's own status line; the
 * clause `liftNotes` (migrate.mjs, since 1.2.64) takes an older world's text
 * out of it.
 *
 * A GM writes the store directly. A player writes only their own note, through
 * the primary GM (the bridge's `note.save`), which files it under the user
 * Foundry names as the sender - the packet names nobody. Until the GM's client
 * answers, the player's browser keeps the note in its copy of its own
 * (`noteCopy`), marked unsent: with no GM connected it stays there, "kept here
 * until a GM connects", and goes again when a primary GM's world has loaded.
 * Each player holds a copy of their own note and of nobody else's, sent by a GM
 * when it changes, when they ask at load, and after a restore.
 */

import { MODULE_ID } from "./config.mjs";
import { getClock } from "./settings.mjs";
import { log, error, plural, isPrimaryGm, primaryGmId, activeGmIds, replaceFlag } from "./utils.mjs";
import { noteStore, noteCopy } from "./gm-stores.mjs";
import { gmStoresQuiet, whenGmStoresAudible } from "./gm-store.mjs";
import { replyForMe } from "./bridge-guards.mjs";
import { MAX_PLAYER_BYTES } from "./secret.mjs";

/** User flag: `{ updatedAt, written }` - when the note was last written, and whether it says anything. Never its text since E05. */
export const NOTE_FLAG = "preSessionNote";

const SOCKET_EVENT = `module.${MODULE_ID}`;
const ACTION_NOTE_COPY = "note.copy";
const ACTION_NOTE_ASK = "note.ask";

/**
 * The seven questions, verbatim from the handbook's own checklist.
 *
 * Offered as a starting template, never enforced: the handbook explicitly
 * allows "No changes" as a complete answer, and a form that refused that would
 * be a worse version of a thing that already works.
 */
export function noteTemplate() {
    return [
        "DRPG.Note.q1", "DRPG.Note.q2", "DRPG.Note.q3", "DRPG.Note.q4",
        "DRPG.Note.q5", "DRPG.Note.q6", "DRPG.Note.q7"
    ].map(key => `☐ ${game.i18n.localize(key)}\n`).join("\n");
}

/* The flag as an object: `{}` for none, and for the "" the season reset wrote before 1.2.64. */
function flagOf(userId) {
    const flag = game.users?.get(userId)?.getFlag(MODULE_ID, NOTE_FLAG);
    return flag && typeof flag === "object" ? flag : {};
}

/* This player's copy of their own note: as a GM last sent it, or as they wrote it here. */
function mine() {
    const copy = noteCopy.read();
    return copy && typeof copy === "object" ? copy : {};
}

/**
 * One player's note: the GMs' store on a GM's browser, the player's own copy on
 * their own, and `""` anywhere else - a player never holds another's. `""` too
 * when nothing has been written.
 */
export function noteFor(userId) {
    if (game.user?.isGM) return String(noteStore.get(userId)?.text ?? "");
    if (!userId || userId !== game.user?.id) return "";
    return String(mine().text ?? "");
}

/**
 * Resolves once a GM's browser holds the other GMs' notes (E05 fix r1-G4; review M1): the
 * Note tab's first draw on a GM waits for it, or a Save there wrote the whole text over a
 * note the store had not received yet. At once on a player's, whose copy is its own.
 */
export function whenNotesHeld() {
    return game.user?.isGM ? noteStore.whenHydrated() : Promise.resolve("player");
}

/** Whether this player's own note is waiting in this browser for a GM (`sendDraft`). */
export function noteUnsent() {
    return !game.user?.isGM && mine().unsent === true;
}

/*
 * Written, and when: a GM reads its store's row, and the flag where its browser holds
 * none; a player reads the flag, which the GM's client writes with every note.
 */
function stateOf(userId) {
    const row = game.user?.isGM ? noteStore.get(userId) : null;
    const { written, updatedAt } = row ? { written: Boolean(String(row.text ?? "").trim()), updatedAt: row.updatedAt } : flagOf(userId);
    return { written: written === true, updatedAt: Number.isFinite(updatedAt) ? updatedAt : null };
}

/** When it was last written, or `null`. */
export function noteUpdatedAt(userId) {
    return stateOf(userId).updatedAt;
}

/** Has this player written anything at all? Drives the GM's roster column. */
export function hasNote(userId) {
    return stateOf(userId).written;
}

/** Past the player text cap (secret.mjs `MAX_PLAYER_BYTES`) a note is not sent, and the GM's client refuses one. */
export function noteTooLong(text) {
    return new Blob([String(text ?? "")]).size > MAX_PLAYER_BYTES;
}

/**
 * GM: one user's note into the store - stamped by this GM, whoever typed it - the flag
 * that says it is written, replaced whole (a plain write merges, and would keep an older
 * world's text beside it), and the user's copy. Answers `{ updatedAt, stamp }`, the
 * store's newest stamp for the row, or null on a client that is not a GM's or for no
 * such user. The bridge's `note.save` runs it for a player, with the sender's own id.
 *
 * `base`, the text a GM's Note tab was drawn from (E05 fix r1-G4; review M5): when the
 * store holds other words by now - another GM's Save, or the player's own, arrived while
 * the tab was open - nothing is written, and the answer is `{ changed: true }`. Until
 * then a GM's Save wrote the whole text it was drawn with over the newer note. As
 * `setKeyPlan`'s `base`, it is judged against this browser's rows.
 */
export async function writeNote(userId, text, { byGm = false, base } = {}) {
    if (!game.user?.isGM) return null;
    const user = game.users.get(userId);
    if (!user) return null;
    if (typeof base === "string" && String(noteStore.get(userId)?.text ?? "") !== base) return { changed: true };
    const body = String(text ?? "");
    const updatedAt = Date.now();
    await noteStore.patch(userId, { text: body, updatedAt, byGm: Boolean(byGm) });
    await replaceFlag(user, NOTE_FLAG, { updatedAt, written: Boolean(body.trim()) });
    sendNoteTo(userId);
    log(`Pre-session note saved for ${user.name}.`);
    Hooks.callAll("drpgNoteSaved", userId);
    return { updatedAt, stamp: noteStore.newest(userId) };
}

/**
 * Save a note.
 *
 * A GM writes any user's - the handbook has the GMs going through these WITH the
 * player, and a GM who has just been told something out loud should be able to
 * write it down. A player writes only their own, kept here until the GMs hold it
 * (`sendDraft`). Answers what became of it, for the Note tab to say: true (a GM's
 * write), "sent" (the GMs hold it), "kept" (this browser holds it until a GM
 * connects), false (not saved), or null (not this user's to write) - and on a GM given
 * `base`, "changed" when the note is no longer the one the tab was drawn from (`writeNote`).
 */
export async function saveNote(userId, text, { base } = {}) {
    const user = game.users.get(userId);
    if (!user || (game.user.id !== userId && !game.user.isGM)) return null;
    const body = String(text ?? "");
    try {
        if (game.user.isGM) {
            const written = await writeNote(userId, body, { byGm: game.user.id !== userId, base });
            return written?.changed ? "changed" : Boolean(written);
        }
        if (noteTooLong(body)) {
            ui.notifications?.warn(game.i18n.format("DRPG.Note.tooLong", { kb: MAX_PLAYER_BYTES / 1024 }));
            return false;
        }
        if (!await keepDraft(body)) throw new Error("this browser's copy of the note did not take it");
        return await sendDraft();
    } catch (err) {
        error("Could not save the pre-session note", err);
        ui.notifications.error(game.i18n.localize("DRPG.Note.saveFailed"));
        return false;
    }
}

/*
 * A draft is this browser's copy of its own note, marked unsent. The copy takes a draft
 * whatever its stamp (gm-stores.mjs `noteCombine`); the stamp matters only against a
 * reset's cut, under which a copy reads as nothing - so it is this browser's clock, or
 * just above the cut where that clock is behind the GM's that wrote the cut.
 */
function keepDraft(text) {
    const cut = Number(getClock()?.resetCuts?.preNotes) || 0;
    return noteCopy.receive({ text, updatedAt: Date.now(), byGm: false, unsent: true }, Math.max(Date.now(), cut + 1));
}

/**
 * Player: this browser's unsent note to the primary GM (`note.save`). Once the GM's
 * client answers, its answer - when the store wrote it, and the store's stamp - is taken
 * as the GMs' copy of the words sent, which marks the draft sent (`noteCombine`: the
 * GMs' copy holding the draft's words). Refused, or with nobody to answer, the draft
 * stays unsent here, and goes again when a primary GM's world has loaded. A second save
 * made while the first is on its way keeps its own draft: the first answer holds other
 * words, and is not taken.
 */
async function sendDraft({ quiet = false } = {}) {
    const draft = mine();
    if (draft.unsent !== true) return "sent";
    const text = String(draft.text ?? "");
    const { requestNoteSave } = await import("./gm-bridge.mjs");
    const res = await requestNoteSave(text, { quiet });
    if (!res.ok) return "kept";
    const at = Number(res.value?.updatedAt), stamp = Number(res.value?.stamp);
    await noteCopy.receive({ text, updatedAt: Number.isFinite(at) ? at : null, byGm: false }, Number.isFinite(stamp) ? stamp : 0);
    return "sent";
}

/** A short "written / not written / when" line for the GM's roster, and "kept here" for a player's unsent note. */
export function noteStatus(userId) {
    if (userId === game.user?.id && noteUnsent()) return game.i18n.localize("DRPG.Note.keptUntilGm");
    const { written, updatedAt } = stateOf(userId);
    if (!written) return game.i18n.localize("DRPG.Note.statusEmpty");
    if (!updatedAt) return game.i18n.localize("DRPG.Note.statusWritten");
    const days = Math.floor((Date.now() - updatedAt) / 86_400_000);
    if (days <= 0) return game.i18n.localize("DRPG.Note.statusToday");
    return plural("DRPG.Note.statusDays", { n: days });
}

/* ==========================================================================
 * A PLAYER'S COPY OF THEIR OWN NOTE (E05)
 * --------------------------------------------------------------------------
 * Sent by a GM when the store's row changes, when the player asks - at load,
 * and when a primary GM's world has loaded (gm-bridge.mjs's "a GM is
 * listening", `drpgPrimaryReady`) - and after a restore. Asking is the
 * player's; answering is the primary's alone, about the asker's own note,
 * found from Foundry's `senderId`; the copy is taken only from a GM, and only
 * addressed to this user.
 * ========================================================================== */

/**
 * GM: send one player their own note - the store's row, stamped with the newest
 * decision about it (a write, a tombstone, a reset's watermark; 0 for none, which
 * takes nothing away on their side). Addressed to them alone, and only while they are
 * here; nothing while the suite holds the stores or stands in another world
 * (`gmStoresQuiet`). Answers whether it sent.
 */
export function sendNoteTo(userId) {
    const user = game.users.get(userId);
    if (!game.user?.isGM || !user?.active || user.isGM || gmStoresQuiet()) return false;
    const row = noteStore.get(userId);
    const note = row ? { text: String(row.text ?? ""), updatedAt: Number.isFinite(row.updatedAt) ? row.updatedAt : null, byGm: Boolean(row.byGm) } : {};
    game.socket.emit(SOCKET_EVENT, { action: ACTION_NOTE_COPY, userId, note, stamp: noteStore.newest(userId) }, { recipients: [userId] });
    return true;
}

/**
 * After a restore (gm-stores.mjs `restoreCase`): every connected player is sent their
 * note again - a copy that holds the same changes nothing. Nothing while the suite
 * holds the stores or stands in another world. Answers how many were sent.
 */
export async function retellNotes() {
    if (!game.user?.isGM || gmStoresQuiet()) return 0;
    let sent = 0;
    for (const user of game.users ?? []) {
        if (user.active && !user.isGM && sendNoteTo(user.id)) sent++;
    }
    return sent;
}

/*
 * A flag that says a note was written after the row this browser holds: the row is not
 * the note the player last wrote. `written` only - a flag saying nothing is written is a
 * reset's (season-setup.mjs's preNotes step writes `{ written: false }` with no date).
 */
function flagAhead(flag, row) {
    if (flag.written !== true || !Number.isFinite(flag.updatedAt)) return false;
    return !row || !Number.isFinite(row.updatedAt) || flag.updatedAt > row.updatedAt;
}

/**
 * GM: the users whose flag says a note is written that this browser does not hold - no
 * row, or an older one (E05 fix r1-G4; reviews M4 = S1-m5, M6 = S1-m6). A browser that
 * lost its storage with no other GM to hand the rows back said nothing about the notes,
 * while each player's status line said "written"; the case health check counts these.
 */
export function notesMissing() {
    if (!game.user?.isGM) return [];
    return (game.users ?? []).filter(user => flagAhead(flagOf(user.id), noteStore.get(user.id))).map(user => user.id);
}

/**
 * After a restore (gm-stores.mjs `noteStore.afterRestore`; E05 fix r1-G4, reviews M6 =
 * S1-m6): each user's flag `{ updatedAt, written }` is written from the row this browser
 * now holds, as `writeNote` writes it. The file brings the rows back and not the flags,
 * which are world data: after a reset (`{ written: false }`) and a restore each player's
 * status line said "Nothing written yet" while their copy held text. A flag that says a
 * note was written after the row is left as it is and counted missing (`notesMissing`),
 * not overwritten with the older date: the newer words are the player's alone now. A flag
 * still holding a text is the lift's (`liftNotes`). Run by the GM who restored, which
 * holds the file's rows the moment they are merged; the others take them by sync, with
 * no hook of their own. Answers how many flags were written.
 */
export async function settleNoteFlags() {
    if (!game.user?.isGM) return 0;
    let written = 0;
    for (const userId of Object.keys(noteStore.entries() ?? {})) {
        const user = game.users?.get(userId), row = noteStore.get(userId), flag = flagOf(userId);
        if (!user || !row || Object.hasOwn(flag, "text") || flagAhead(flag, row)) continue;
        const want = { updatedAt: Number.isFinite(row.updatedAt) ? row.updatedAt : null, written: Boolean(String(row.text ?? "").trim()) };
        if (flag.written === want.written && (flag.updatedAt ?? null) === want.updatedAt) continue;
        await replaceFlag(user, NOTE_FLAG, want);
        written++;
    }
    return written;
}

/** Player: take a GM's copy of this user's own note, as `noteCombine` decides. A GM's copy is never a draft. */
export async function receiveNote(note, stamp) {
    const value = note && typeof note === "object" && typeof note.text === "string"
        ? { text: note.text, updatedAt: Number.isFinite(note.updatedAt) ? note.updatedAt : null, byGm: Boolean(note.byGm) }
        : {};
    return noteCopy.receive(value, Number(stamp) || 0);
}

/** Player: ask the primary for this user's own note. */
function askForNote(primary = primaryGmId()) {
    if (!primary || game.user.isGM) return;
    try {
        game.socket.emit(SOCKET_EVENT, { action: ACTION_NOTE_ASK }, { recipients: [primary] });
    } catch (err) {
        error("Could not ask the GM for this player's pre-session note", err);
    }
}

/*
 * A primary GM whose world has loaded before this browser saw it connect: gm-bridge.mjs's
 * `onGmReady` takes the packet's word that it is up, but the bridge sends only to a GM this
 * browser has seen connect, so the unsent note waits for `userConnected`. Which comes first
 * on v14 is LIVE-E04-12; the harness sends the loaded world's packet first (cluster.mjs
 * `connect`), and 61-gmstore-case's Z6 measured the note still unsent, and the GM without
 * it, when it was sent at once (26.09.2026). In the other order the GM is connected when its
 * world says it has loaded, and the note goes then: 61's O2 drives it (cluster.mjs `connect`'s
 * `announceFirst`) and measured it reaching the GM with no change here (E05 fix r1-G4,
 * 27.09.2026). Both orders are held by a test; neither is proven the one v14 takes.
 */
let owedTo = null;

/* Player: a primary GM's world has loaded - the unsent note goes to it, or its copy is asked for. */
function toArrivingGm(primary = primaryGmId()) {
    if (!noteUnsent()) {
        askForNote(primary);
        return;
    }
    if (!activeGmIds().length) {
        owedTo = primary;
        return;
    }
    owedTo = null;
    // Nobody waits on it: a failure says nothing, and the Note tab still says it is kept here.
    sendDraft({ quiet: true }).catch(err => error("Could not send the pre-session note to the GM", err));
}

function onNoteSocket(payload, senderId) {
    if (payload?.action === ACTION_NOTE_ASK) {
        if (!isPrimaryGm()) return;
        const sender = game.users.get(senderId);
        if (!sender?.active || sender.isGM) return;
        // Asked while the suite holds the stores: answered once it lets them go, and once the store holds the
        // other GMs' rows (E05 fix r1-G4; review M1: the ask comes at `drpgPrimaryReady`, sent from the ready
        // hook that opens the stores without waiting, so a primary's reload answered from its own rows alone).
        whenGmStoresAudible().then(() => noteStore.whenHydrated()).then(() => sendNoteTo(sender.id))
            .catch(err => error("Could not answer a player's pre-session note", err));
        return;
    }
    if (payload?.action !== ACTION_NOTE_COPY || game.user.isGM) return;
    // A GM's, and addressed to this user: a player cannot hand another a note.
    if (!replyForMe(payload, senderId)) return;
    receiveNote(payload.note, payload.stamp).catch(err => error("Could not keep the pre-session note", err));
}

/* At ready: the copy's listener on every client; a player's unsent note goes to a GM who is here, or the copy is asked for. */
function registerNoteCopy() {
    game.socket.on(SOCKET_EVENT, onNoteSocket);
    if (game.user.isGM) return;
    if (!noteUnsent()) askForNote();
    else if (activeGmIds().length) toArrivingGm();
    Hooks.on("drpgPrimaryReady", primary => toArrivingGm(primary));
    Hooks.on("userConnected", (user, connected) => {
        if (connected && owedTo && user?.id === owedTo) toArrivingGm(owedTo);
    });
}

export function registerPreSessionNote() {
    Hooks.once("ready", registerNoteCopy);
}

/**
 * A world from before 1.2.64 keeps each note's text in its user's flag, which every
 * browser reads (audit S11-03). The clause `liftNotes` (migrate.mjs, since 1.2.64) runs
 * this once, on the primary, after the store holds the other GMs' copies (E05 C6).
 *
 * Each text goes into the store weak and fill-only - a note a GM has written since the
 * update keeps its words - and leaves the flag only once its row reads back from
 * storage: the flag is replaced whole by `{ updatedAt, written }` (`replaceFlag`, v14's
 * ForcedReplacement: a plain write would merge, and keep the text). A flag whose text is
 * empty has nothing to lift, and is replaced the same way. Then each player whose note
 * was lifted is sent their copy. A text still in a flag after that throws, with the count,
 * so the world is not stamped and the next load tries again (E05 fix r1-G1; migrate.mjs,
 * above the lifts). Idempotent: a world already through this holds no text.
 *
 * @returns {Promise<null|{lifted: number, kept: number, emptied: boolean}>}  `kept` 0 and
 *   `emptied` true: anything else throws.
 */
export async function liftNotes() {
    if (!isPrimaryGm()) return null;
    if (await noteStore.whenHydrated() === "timedOut") {
        throw new Error("the other GMs' copies of the pre-session notes did not arrive; the next load tries again");
    }
    const holding = (game.users ?? []).filter(user => Object.hasOwn(flagOf(user.id), "text"));
    if (!holding.length) return null;
    const rows = {};
    for (const user of holding) {
        const { text, updatedAt, byGm } = flagOf(user.id);
        if (typeof text === "string" && text) rows[user.id] = { text, updatedAt: Number.isFinite(updatedAt) ? updatedAt : null, byGm: Boolean(byGm) };
    }
    if (Object.keys(rows).length) {
        await noteStore.patchMany(rows, { weak: true, fillOnly: true });
        await noteStore.idle();
    }
    let lifted = 0, kept = 0;
    for (const user of holding) {
        const row = rows[user.id] ? noteStore.persisted(user.id) : null;
        if (rows[user.id] && typeof row?.text !== "string") {
            kept++;
            continue;
        }
        if (row) lifted++;
        const at = row ? row.updatedAt : flagOf(user.id).updatedAt;
        await replaceFlag(user, NOTE_FLAG, { updatedAt: Number.isFinite(at) ? at : null, written: Boolean(String(row?.text ?? "").trim()) });
    }
    const left = (game.users ?? []).filter(user => Object.hasOwn(flagOf(user.id), "text")).length;
    if (lifted) log(`Lifted ${lifted} pre-session note(s) out of world data; ${left} left.`);
    for (const userId of Object.keys(rows)) sendNoteTo(userId);
    if (left) throw new Error(`${left} pre-session note(s) are still in their users' flags (${kept} the GM store did not read back); the next load tries again`);
    return { lifted, kept, emptied: true };
}
