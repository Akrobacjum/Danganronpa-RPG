/**
 * Danganronpa RPG — the safeword.
 * ---------------------------------------------------------------------------
 * Player Handbook, ch. 13: one word — MISIUBOMBO — stops the scene. "Say it if
 * something in the scene has crossed your line. You do not have to justify it.
 * The scene stops immediately. You tag a DM in the text channel, you sort the
 * problem out, and you resume the scene from a jointly agreed point."
 *
 * The whole chapter rested on that sentence and the module had no trace of it.
 * Saying it out loud works at a shared table; this game is played with everyone
 * in a separate voice room, where "say it out loud" reaches whoever happens to
 * be standing in the same room as you — which, in a killing game, may be
 * precisely the person the scene needs stopping because of.
 *
 * So it is a button, and it does the three things the handbook asks for in one
 * press: the game pauses, every GM is told who called it and from where, and
 * everybody sees the same card.
 *
 * Two things it deliberately does NOT do:
 *
 *   ask why    "You do not have to justify it" is the rule. There is no reason
 *              field and no category picker. Whoever called it explains as much
 *              or as little as they want, afterwards, to a GM.
 *   name a target  It reports the room, never "who you were with". The scene is
 *              being stopped, not an accusation being filed.
 */

import { MODULE_ID } from "./config.mjs";
import { announce, gmIds, isPrimaryGm, log, error } from "./utils.mjs";
import { showPopup } from "./popup.mjs";

const { DialogV2 } = foundry.applications.api;

/** Marks the announcement, so the pause and the card key off one message. */
export const SAFEWORD_FLAG = "safeword";

/** Socket action carrying the caller's name to the GMs, and nobody else. */
const SAFEWORD_ACTION = "safewordDetail";

/** The GM-side card: who, and where. Never rendered on a player's client. */
function showGmDetail(who, room) {
    showPopup(`<p>${game.i18n.format("DRPG.Safeword.gmNote", {
        who: foundry.utils.escapeHTML(who ?? "?"),
        room: foundry.utils.escapeHTML(room || game.i18n.localize("DRPG.Safeword.roomUnknown"))
    })}</p>`, {
        title: game.i18n.localize("DRPG.Safeword.gmTitle"),
        kind: "error",
        sticky: true
    });
}

/**
 * Call the safeword. Anyone may: player, GM, dead, Monocub, spectator.
 *
 * Deliberately not gated on having a character. A player between characters, or
 * one whose student died an hour ago, is still at the table and still owed this.
 */
export async function callSafeword({ room = null } = {}) {
    try {
        // The announcement is public, and it is what every other client keys
        // off — the pause and the card both hang from this one message rather
        // than from a socket, so a client that missed a packet still stops.
        await announce({
            content: `<h3 class="drpg-safeword-heading">${
                game.i18n.localize("DRPG.Safeword.banner")}</h3>
                <p>${game.i18n.localize("DRPG.Safeword.announced")}</p>`,
            flags: {
                [MODULE_ID]: {
                    [SAFEWORD_FLAG]: true,
                    // The generic popup path would raise an ordinary card that
                    // fades after twelve seconds. This one has to stay up until
                    // somebody deals with it, so it is raised by hand below.
                    popupKind: "none"
                }
            }
        });

        // WHO called it goes over the socket, not into a whisper.
        //
        // The public card above says "somebody" on purpose: the handbook's
        // protection is that you never have to explain yourself, and being
        // visibly the person who stopped the scene is its own kind of
        // explaining. A GM whisper would not have kept that promise — Foundry
        // ships every ChatMessage document to every client regardless of the
        // `whisper` array, so any player could read the caller's name out of
        // their own console. A recipient-addressed socket is the one channel
        // that genuinely only reaches the people named on it.
        //
        // Best-effort: if this fails the GMs still know a safeword was called,
        // from the public message, and can ask.
        game.socket.emit(`module.${MODULE_ID}`, {
            action: SAFEWORD_ACTION,
            who: game.user.name,
            room: room ?? null
        }, { recipients: gmIds() });

        // The caller's own client is not a socket recipient, and a GM who calls
        // it should still see the detail card.
        if (game.user.isGM) showGmDetail(game.user.name, room);

        log(`Safeword called by ${game.user.name}.`);
        return true;
    } catch (err) {
        error("The safeword could not be broadcast", err);
        // Last resort: at least stop this client's own screen and say so.
        ui.notifications.error(game.i18n.localize("DRPG.Safeword.failed"), { permanent: true });
        return false;
    }
}

/** The confirmation. One question, no reason asked. */
export async function safewordDialog(actor = null) {
    const confirmed = await DialogV2.confirm({
        window: { title: game.i18n.localize("DRPG.Safeword.title") },
        classes: ["drpg-panel", "drpg-safeword-dialog"],
        content: `<p><strong>${game.i18n.localize("DRPG.Safeword.confirm")}</strong></p>
                  <p>${game.i18n.localize("DRPG.Safeword.confirmNote")}</p>`,
        yes: { label: game.i18n.localize("DRPG.Safeword.stopIt") },
        no: { label: game.i18n.localize("DRPG.Advance.cancel") },
        rejectClose: false,
        modal: true
    });
    if (!confirmed) return false;

    let room = null;
    try {
        if (actor) {
            const { roomOfActor } = await import("./movement.mjs");
            room = roomOfActor(actor);
        }
    } catch {
        // A room is a nicety; never let looking one up stop the safeword.
    }

    return callSafeword({ room });
}

export function registerSafeword() {
    // The GM-only half. `recipients` on the emit decides who receives it, so a
    // player's client never sees this packet at all.
    game.socket.on(`module.${MODULE_ID}`, payload => {
        if (payload?.action !== SAFEWORD_ACTION) return;
        if (!game.user.isGM) return;
        showGmDetail(payload.who, payload.room);
    });

    Hooks.on("createChatMessage", message => {
        if (!message.getFlag(MODULE_ID, SAFEWORD_FLAG)) return;

        // Every client raises the card, including the caller's — seeing it land
        // is the confirmation that the table now knows.
        showPopup(`<p>${game.i18n.localize("DRPG.Safeword.announced")}</p>`, {
            title: game.i18n.localize("DRPG.Safeword.banner"),
            kind: "error",
            // Stays until dismissed by hand. A scene that has been stopped does
            // not un-stop itself after twelve seconds.
            sticky: true
        });

        // Exactly one client pauses, or several GMs race on the same toggle.
        // A player cannot pause a Foundry game at all, which is the whole reason
        // this hangs off the message rather than being done by the caller.
        if (game.user.isGM && isPrimaryGm() && !game.paused) {
            game.togglePause(true, { broadcast: true });
        }
    });
}
