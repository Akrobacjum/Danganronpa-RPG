/**
 * Danganronpa RPG - the GM's repairs without the console (2.0 line T4, 27.11.2026; docs/dev/v2/LINE-T4.md).
 * ---------------------------------------------------------------------------
 * The GM panel's Diagnostics section (gm-panel.mjs `PANEL_SECTIONS.fixes`) reaches here for what used to be a
 * console's alone. Every press runs a function that was there before - a setting's own write, or a `game.drpg`
 * call - and asks first, Cancel the default; nothing here is new logic of the game. It imports only the leaves it
 * needs (config.mjs, settings.mjs, utils.mjs, ui-kit.mjs), so gm-panel.mjs reads it statically with no cycle.
 *
 * VOICE ROOMS ON AND OFF (VOICE-03). The switch "Voice in each room" (`SETTINGS.voiceEnabled`, `config: false`) was in
 * the Game settings window alone, and the GM handbook's 9.5 "When voice goes wrong" did not name it: the way out when
 * LiveKit cannot keep up with the rooms is everybody in the main room, which that switch's `onChange` does
 * (voice.mjs `resetAllVoice` when it goes off; a forced reconcile when it comes on). A tile of Diagnostics now names
 * the switch by what it will do - Everybody in one voice room, or Turn the voice rooms on - asks before it turns the
 * rooms off, saying what is lost, and writes the setting, whose `onChange` does the rest. It stands greyed, with the
 * reason, for a GM who may not write the game's settings (Foundry's SETTINGS_MODIFY, as the Settings tile) and with no
 * LiveKit AV client, where there are no voice rooms to turn.
 */

import { MODULE_ID } from "./config.mjs";
import { SETTINGS, getSetting } from "./settings.mjs";
import { error } from "./utils.mjs";
import { drpgWindow } from "./ui-kit.mjs";

/** The LiveKit AV client's module id, as voice-client.mjs `avclientActive` reads it. */
const AV_MODULE = "avclient-livekit";

/**
 * A yes-or-no question whose no is the default (boundary.mjs `noFirst`'s shape, E21 C3a): the yes on the right, Cancel
 * on the left and focused, so Enter and Space press Cancel and a closed window answers null. True for the yes alone.
 * `tip` is the yes's tooltip: what the press will do.
 */
export async function askFirst(title, body, yes, tip = "") {
    const answer = await drpgWindow({
        classes: ["drpg-panel"],
        title,
        body,
        footer: {
            primary: { action: "yes", label: yes, tooltip: tip, callback: () => true },
            close: { role: "cancel", action: "no", callback: () => false },
            default: "no"
        },
        rejectClose: false
    });
    return answer === true;
}

/** Whether the voice rooms are on (`SETTINGS.voiceEnabled`). `get` is the suite's. */
export function voiceRoomsOn({ get = () => getSetting(SETTINGS.voiceEnabled) } = {}) {
    return get() === true;
}

/** The tile's words, by the state: what a press will do (VOICE-03). */
export function voiceRoomsLabelKey(on = voiceRoomsOn()) {
    return on ? "DRPG.Repair.voiceRoomsOff" : "DRPG.Repair.voiceRoomsOn";
}

/**
 * Why the tile stands greyed, or null: a GM who may not write the game's settings, and no LiveKit AV client.
 * `mayModify` and `liveKit` are the suite's (R9251); gm-panel.mjs hands its own `mayModifySettings`.
 */
export function voiceRoomsRefusal({ mayModify = () => game.user?.isGM === true, liveKit = () => Boolean(game.modules.get(AV_MODULE)?.active) } = {}) {
    if (!mayModify()) return game.i18n.localize("DRPG.SettingsWindow.mayNot");
    if (!liveKit()) return game.i18n.localize("DRPG.Repair.voiceRoomsNoLiveKit");
    return null;
}

/**
 * The tile's press (VOICE-03): off asks first, with what turning the rooms off costs; on writes at once. Answers true
 * when it wrote, false for a Cancel, null where a GM may not. `on`, `set`, `ask` and `notify` are the suite's (R9251).
 */
export async function toggleVoiceRooms({ on = voiceRoomsOn(), set = value => game.settings.set(MODULE_ID, SETTINGS.voiceEnabled, value),
    ask = askFirst, notify = text => ui.notifications.info(text), refusal = voiceRoomsRefusal } = {}) {
    if (!game.user?.isGM || refusal()) return null;
    if (on) {
        const yes = await ask(game.i18n.localize("DRPG.Repair.voiceRoomsOff"), `<p>${game.i18n.localize("DRPG.Repair.voiceRoomsOffAsk")}</p>`,
            game.i18n.localize("DRPG.Repair.voiceRoomsOffYes"), game.i18n.localize("DRPG.Repair.voiceRoomsOffTip"));
        if (!yes) return false;
    }
    try {
        await set(!on);
    } catch (err) {
        error("Could not turn the voice rooms", err);
        return false;
    }
    notify(game.i18n.localize(on ? "DRPG.Repair.voiceRoomsOffDone" : "DRPG.Repair.voiceRoomsOnDone"));
    return true;
}
