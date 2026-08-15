/**
 * Danganronpa RPG — one dice style for the whole table.
 * ---------------------------------------------------------------------------
 * Dice So Nice's own `forceCharacterOwnerAppearance` setting does the
 * opposite of what the guide's presentation wants: it makes a roll display
 * using whoever ROLLED it own chosen skin, so every player still sees
 * different dice depending on which of them is rolling. There is no built-in
 * "make everyone match one specific person" — this is that, aimed at the
 * primary GM's own appearance.
 *
 * Dice So Nice keeps a player's whole appearance configuration in a single
 * CLIENT-scoped setting (`dice-so-nice.settings`), which is exactly why this
 * has to be pushed rather than declared once: client settings live in each
 * browser's own storage, never in the world, so nothing about them
 * propagates on its own. The primary GM's client reads its own copy and
 * relays it over this module's socket; every other client writes it into
 * its own copy of the same setting, unprompted. A player is never asked and
 * never gets a choice — that is the point.
 */

import { MODULE_ID } from "./config.mjs";
import { isPrimaryGm, primaryGmId, error } from "./utils.mjs";

const AV_MODULE = "dice-so-nice";
const APPEARANCE_SETTING = "settings";
const SOCKET_EVENT = `module.${MODULE_ID}`;
const ACTION = "diceAppearance";

/**
 * Called from module.mjs's own `ready` hook — not wrapped in another
 * `Hooks.once("ready", ...)` here, because that hook has already fired by
 * the time anything running inside it gets a chance to add a new listener
 * for it. Foundry does not replay a hook for a listener that arrives late.
 */
export function registerDiceSync() {
    game.socket.on(SOCKET_EVENT, onSocket);

    if (isPrimaryGm()) pushToEveryone();

    // A player joining mid-session gets caught up immediately rather than
    // waiting for the GM's next reload.
    Hooks.on("userConnected", (user, connected) => {
        if (!connected || user.isGM || !isPrimaryGm()) return;
        pushTo(user.id);
    });

    // The GM tweaking their own dice appearance re-propagates it.
    //
    // This used to listen on `updateSetting`, which never fired: that is a
    // DOCUMENT hook, and `ClientSettings##setClient` writes a client-scoped
    // setting straight to localStorage without ever creating a Setting document.
    // What it does fire is `clientSettingChanged`, with the full "namespace.key"
    // id as its first argument. So a GM re-styling their dice mid-session was
    // silently not reaching the table until somebody reconnected or reloaded.
    Hooks.on("clientSettingChanged", key => {
        if (key !== `${AV_MODULE}.${APPEARANCE_SETTING}`) return;
        if (!isPrimaryGm()) return;
        pushToEveryone();
    });
}

function active() {
    return Boolean(game.modules.get(AV_MODULE)?.active);
}

function myAppearance() {
    try {
        return game.settings.get(AV_MODULE, APPEARANCE_SETTING) ?? null;
    } catch {
        return null;
    }
}

function pushTo(userId) {
    if (!active()) return;
    const appearance = myAppearance();
    if (!appearance) return;
    game.socket.emit(SOCKET_EVENT, { action: ACTION, appearance }, { recipients: [userId] });
}

function pushToEveryone() {
    for (const user of game.users.filter(u => !u.isGM && u.active)) pushTo(user.id);
}

/**
 * @param {object} data
 * @param {string} senderId  Foundry's own second argument — who actually emitted
 *   this, which the sender cannot choose.
 *
 * The sender check is not paranoia about dice. This handler writes a payload
 * straight into another module's client setting, so without it any player could
 * emit one and overwrite every other player's Dice So Nice configuration — with
 * their own skins, or with something malformed enough to stop DSN rendering at
 * all. It is also the only socket handler in this module that was missing the
 * check every other one makes.
 */
async function onSocket(data, senderId) {
    if (data?.action !== ACTION) return;
    if (game.user.isGM) return; // GMs keep their own choice
    if (!active()) return;
    // The PRIMARY GM specifically: this setting is meant to make the table match
    // one person, and that person is the same client the rest of the module's
    // automation runs on.
    if (senderId !== primaryGmId()) return;
    if (!data.appearance || typeof data.appearance !== "object") return;

    try {
        await game.settings.set(AV_MODULE, APPEARANCE_SETTING, data.appearance);
    } catch (err) {
        error("Could not apply the GM's dice appearance", err);
    }
}
