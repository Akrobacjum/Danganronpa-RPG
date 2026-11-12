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
 * The sheet's mode is sheet.mjs `sheetMode`'s ("spectator"): no action grid, no Calls, no row buttons, no Level Up.
 */

import { MODULE_ID } from "./config.mjs";
import { spectatorViewer, spectatorUserIds, talkSwitchOn, SPECTATOR_TALK_FLAG } from "./spectator.mjs";
import { error, log, isPrimaryGm } from "./utils.mjs";

export const SPECTATOR_BODY_CLASS = "drpg-spectator";

/**
 * THE "SPECTATOR TALK" SWITCH's one write (E92 C6): the player's own User flag (scripts/spectator.mjs
 * `SPECTATOR_TALK_FLAG`), set or taken off; the primary moves the account to the Spectators' room and lifts its block
 * there (voice.mjs `placeVoices`, `settleTrialVoices`), and back when it is off. A GM is no Spectator, and its own
 * flag is honoured for nobody (voice.mjs `spectatorTalks`); nothing is written for one.
 */
export async function toggleSpectatorTalk(user = game.user) {
    try {
        if (!user || user.isGM) return;
        if (talkSwitchOn(user)) await user.unsetFlag(MODULE_ID, SPECTATOR_TALK_FLAG);
        else await user.setFlag(MODULE_ID, SPECTATOR_TALK_FLAG, true);
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
 *   - every browser leaves a Spectator's message undrawn (`renderChatMessageHTML`), on the flags it holds;
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

function refuseOwnMessage(message, data, options, userId) {
    if (userId !== game.user?.id || !spectatorViewer()) return true;
    ui.notifications?.warn?.(game.i18n.localize("DRPG.Spectator.noChat"));
    return false;
}

function hideSpectatorMessage(message, element) {
    if (spectatorAuthor(message)) element?.remove?.();
}

async function dropSpectatorMessage(message) {
    try {
        if (!isPrimaryGm() || !message?.author || message.author.isGM) return;
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
    Hooks.on("createChatMessage", message => void dropSpectatorMessage(message));
    paintSpectatorUi();
}
