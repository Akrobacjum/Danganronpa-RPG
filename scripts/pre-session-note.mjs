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
 * WHERE IT IS STORED, and what that does and does not protect.
 *
 * On the player's own User document, as a flag. A user may update themselves in
 * Foundry, so the player writes their own note directly with no GM round-trip,
 * and it survives sessions without anything having to migrate it. GMs can read
 * and write every user, which is exactly the access the handbook describes.
 *
 * What this does NOT do is hide the note from other players. Foundry ships every
 * User document to every client, so a player who opens a console can read
 * somebody else's answers - the same world-data exposure the rest of this module
 * documents. The UI never shows one player another's note, and nothing here
 * announces or whispers it. But if a table has answers too sensitive to sit in
 * world data at all, those belong in a direct message to a GM, not here.
 */

import { MODULE_ID } from "./config.mjs";
import { log, error, plural } from "./utils.mjs";

/** User flag holding one player's note. */
export const NOTE_FLAG = "preSessionNote";

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

/** One player's note. `""` when they have never written one. */
export function noteFor(userId) {
    const user = game.users.get(userId);
    return user?.getFlag(MODULE_ID, NOTE_FLAG)?.text ?? "";
}

/** When it was last written, or `null`. */
export function noteUpdatedAt(userId) {
    return game.users.get(userId)?.getFlag(MODULE_ID, NOTE_FLAG)?.updatedAt ?? null;
}

/** Has this player written anything at all? Drives the GM's roster column. */
export function hasNote(userId) {
    return Boolean(noteFor(userId).trim());
}

/**
 * Save a note.
 *
 * Allowed for the note's owner and for any GM - the handbook has the GMs going
 * through these WITH the player, and a GM who has just been told something out
 * loud should be able to write it down.
 */
export async function saveNote(userId, text) {
    if (game.user.id !== userId && !game.user.isGM) return null;

    const user = game.users.get(userId);
    if (!user) return null;

    try {
        await user.setFlag(MODULE_ID, NOTE_FLAG, {
            text: String(text ?? ""),
            updatedAt: Date.now(),
            // Who typed it, so a GM reading it back knows whether they are
            // looking at the player's own words or their own transcription.
            byGm: game.user.id !== userId
        });
        log(`Pre-session note saved for ${user.name}.`);
        Hooks.callAll("drpgNoteSaved", userId);
        return true;
    } catch (err) {
        error("Could not save the pre-session note", err);
        ui.notifications.error(game.i18n.localize("DRPG.Note.saveFailed"));
        return false;
    }
}

/** A short "written / not written / when" line for the GM's roster. */
export function noteStatus(userId) {
    if (!hasNote(userId)) return game.i18n.localize("DRPG.Note.statusEmpty");
    const at = noteUpdatedAt(userId);
    if (!at) return game.i18n.localize("DRPG.Note.statusWritten");
    const days = Math.floor((Date.now() - at) / 86_400_000);
    if (days <= 0) return game.i18n.localize("DRPG.Note.statusToday");
    return plural("DRPG.Note.statusDays", { n: days });
}
