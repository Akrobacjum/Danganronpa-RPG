/**
 * Danganronpa RPG - what a Spectator's own screen draws (E92 C5, 12.11.2026; round 3 the same day).
 * ---------------------------------------------------------------------------
 * The owner's E92 goal (5) and the 04.11 amend: "sheet and HUD in a spectator mode", and "the Spectator does NOT read
 * the chat". On the Spectator's browser alone (scripts/spectator.mjs `spectatorViewer`):
 *
 *   - THE CHAT, BLOCKED (the owner's DRPG-D1 of 12.11.2026, below): the body class `drpg-spectator` (components.css hides
 *     the chat log, its notifications and the box a message is typed in), its own messages refused and removed.
 *   - THE "TALK WITH THE SPECTATORS" SWITCH, in the voice tile among its buttons (voice-tile.mjs `paintSpectatorTalk`,
 *     the owner's 12.11.2026: "dajemy w panelu livekit po prawej stronie ekranu, tam gdzie reszta przyciskow"). Its
 *     write is here (`toggleSpectatorTalk`); the tile repaints it with its other buttons, on the player's own User's
 *     change, and on a role changed (below).
 *
 * Until round 3 a line under the clock said the room the Spectator's token stood in and offered a room picker, which
 * moved the token through any wall by the bridge action `spectator.move`. The owner took it out ("Usuwamy liste"): a
 * Spectator moves by dragging its own token, which movement.mjs `crossingVerdict`, `judgeMove` and movement-audit.mjs
 * `auditMove` let through walls; whether Foundry's own wall stop on a player's drag lets it through on v14 is LIVE-E92-02.
 *
 * The sheet's mode is sheet-mode.mjs `sheetMode`'s ("spectator"): no action grid, no Calls, no row buttons, no Level Up.
 */

import { MODULE_ID } from "./config.mjs";
import { spectatorViewer, spectatorUserIds, talksWithSpectators, SPECTATOR_LISTEN_FLAG } from "./spectator.mjs";
import { error, log, isPrimaryGm } from "./utils.mjs";
import { SAFEWORD_FLAG } from "./safeword.mjs";

const SPECTATOR_BODY_CLASS = "drpg-spectator";

/**
 * THE SPECTATOR'S VOICE SWITCH's one write (E92 C6; the other way round since owner-116, 15.11.2026): the player's own
 * User flag (scripts/spectator.mjs `SPECTATOR_LISTEN_FLAG`), set or taken off. Set, the primary takes the account out of
 * the Spectators' room to listen where its token stands, its microphone held (voice.mjs `placeVoices`,
 * `settleTrialVoices`); taken off, back to the Spectators' room, the default. A GM is no Spectator, and its own flag is
 * honoured for nobody (voice.mjs `spectatorTalks`); nothing is written for one.
 */
export async function toggleSpectatorTalk(user = game.user) {
    try {
        if (!user || user.isGM) return;
        if (talksWithSpectators(user)) await user.setFlag(MODULE_ID, SPECTATOR_LISTEN_FLAG, true);
        else await user.unsetFlag(MODULE_ID, SPECTATOR_LISTEN_FLAG);
    } catch (err) {
        error("Could not change the Spectator talk switch", err);
    }
}

/** Put the body class on or off as this browser now is, and repaint the voice tile's buttons with it. */
export function paintSpectatorUi() {
    try {
        document.body?.classList?.toggle(SPECTATOR_BODY_CLASS, spectatorViewer());
    } catch (err) {
        error("Could not mark the Spectator's screen", err);
    }
    import("./voice-tile.mjs").then(m => m.paintControls()).catch(err => error("Could not draw the voice tile's buttons", err));
}

/*
 * A SPECTATOR HAS NO CHAT (E92, the owner's DRPG-D1 of 12.11.2026: "Zablokowac; postac widza nie ma swojego czatu"; the
 * plan's Q-E92-4 changed from hidden to blocked). Three parts, each on the browser that can do it:
 *   - its own browser refuses its message before it is sent (`preCreateChatMessage`), and says why - a courtesy, as
 *     every guard on the writer's own browser is (the trust model): a console takes the hook off;
 *   - every browser leaves a Spectator's message undrawn (`renderChatMessageHTML`), on the flags it holds - one it posted as
 *     a Spectator, not the cards its player posted as a student before (`hiddenSpectatorMessage`, 1.2.122);
 *   - the primary GM removes it (`createChatMessage`), by the bridge's own rule for the account (bridge-guards.mjs
 *     `senderNotSpectator`: the flags as the GMs hold them), so nothing of it stays in the log.
 * What the module does not control: Foundry broadcasts a created message to every browser before the primary removes it,
 * so a console listening for it reads it for that moment, and every public message - Foundry's own and the module's -
 * still reaches a Spectator's browser, where the chat log is not drawn (components.css). A known limit (STATUS, the GM
 * handbook); making the module's public cards whispers past the Spectators would change what every reader of a card
 * takes for public, and is not done.
 */
function spectatorAuthor(message) {
    const author = message?.author ?? null;
    return Boolean(author && !author.isGM && spectatorUserIds().has(author.id));
}

/*
 * THE SAFEWORD'S CARD IS NOT CHAT (1.2.122 line UI; the audit of 1.2.118, STG-04). A Spectator's press posts the public
 * card from its own browser when no GM is connected, or when none answered in time (safeword.mjs `safewordPoster`,
 * `awaitCard`), and the three parts below took it for the Spectator's chat: refused on its own browser, so no card, no
 * banner and no pause, while the press reported the card posted. The card carries the safeword's flag and the
 * safeword's own shape (its heading's class, one short paragraph); a message with the flag and any other content is
 * chat as before, so the flag is no road for a Spectator's words into the log.
 */
export function isSafewordCard(message) {
    const flagged = message?.getFlag?.(MODULE_ID, SAFEWORD_FLAG) ?? message?.flags?.[MODULE_ID]?.[SAFEWORD_FLAG];
    const content = String(message?.content ?? "");
    return Boolean(flagged) && content.includes("drpg-safeword-heading") && content.length <= 600;
}

function refuseOwnMessage(message, data, options, userId) {
    if (userId !== game.user?.id || !spectatorViewer() || isSafewordCard(message)) return true;
    ui.notifications?.warn?.(game.i18n.localize("DRPG.Spectator.noChat"));
    return false;
}

/*
 * ONLY WHAT IT POSTED AS A SPECTATOR (the audit's STG-05, 1.2.122, 21.11.2026). This removed every message whose author's
 * account is a Spectator's now, so once a student was made a Spectator every card its player had posted as a student - the
 * action and roll cards of whole sessions - went from the log at the next redraw, on every browser, the GMs' included.
 * What is left undrawn is a message heard made while its author was a Spectator (`createChatMessage` on this browser:
 * `postedAsSpectator`), or one younger than `SPECTATOR_FRESH_MS` - the moment before the primary removes it, on a page
 * that drew it before it heard it made. An older card of an account that is a Spectator now is the student's, and stays.
 */
export const SPECTATOR_FRESH_MS = 60_000;
const postedAsSpectator = new Set();

/** Whether this browser leaves `message` undrawn (pure but for the set and the clock; `now` handed by the suite). */
export function hiddenSpectatorMessage(message, { now = Date.now() } = {}) {
    if (!spectatorAuthor(message)) return false;
    if (postedAsSpectator.has(message.id)) return true;
    const at = Number(message.timestamp) || 0;
    return at > 0 && now - at < SPECTATOR_FRESH_MS;
}

function hideSpectatorMessage(message, element) {
    if (hiddenSpectatorMessage(message) && !isSafewordCard(message)) element?.remove?.();
}

function noteSpectatorMessage(message) {
    if (message?.id && spectatorAuthor(message)) postedAsSpectator.add(message.id);
}

async function dropSpectatorMessage(message) {
    try {
        if (!isPrimaryGm() || !message?.author || message.author.isGM || isSafewordCard(message)) return;
        const { senderNotSpectator } = await import("./bridge-guards.mjs");
        if (!(await senderNotSpectator(message.author))) return;
        log(`Removed a chat message ${message.author.name} posted as a Spectator.`);
        await message.delete();
    } catch (err) {
        error("Could not remove a Spectator's chat message", err);
    }
}

/** The hooks: a role changed (an actor's flags) repaints; the chat's three parts. The player's own User is the voice tile's hook. */
export function registerSpectatorUi() {
    Hooks.on("updateActor", (actor, changes) => { if (changes?.flags) paintSpectatorUi(); });
    Hooks.on("preCreateChatMessage", refuseOwnMessage);
    Hooks.on("renderChatMessageHTML", hideSpectatorMessage);
    Hooks.on("createChatMessage", message => { noteSpectatorMessage(message); void dropSpectatorMessage(message); });
    paintSpectatorUi();
}
