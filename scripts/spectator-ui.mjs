/**
 * Danganronpa RPG - what a Spectator's own screen draws (E92 C5, 12.11.2026; round 3 the same day).
 * ---------------------------------------------------------------------------
 * The owner's E92 goal (5) and the 04.11 amend: "sheet and HUD in a spectator mode", and "the Spectator does NOT read
 * the chat". On the Spectator's browser alone (scripts/spectator.mjs `spectatorViewer`):
 *
 *   - THE CHAT, HIDDEN: the body class `drpg-spectator` (components.css hides the chat log, its notifications and the
 *     box a message is typed in). A display only: every message Foundry sends still reaches the browser, and a console
 *     reads it (the plan's Q-E92-4, default taken; the GM handbook says so).
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
import { spectatorViewer, talkSwitchOn, SPECTATOR_TALK_FLAG } from "./spectator.mjs";
import { error } from "./utils.mjs";

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

/** The hooks that repaint it: a role changed (an actor's flags). The player's own User is the voice tile's hook. */
export function registerSpectatorUi() {
    Hooks.on("updateActor", (actor, changes) => { if (changes?.flags) paintSpectatorUi(); });
    paintSpectatorUi();
}
