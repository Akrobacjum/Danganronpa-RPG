/**
 * Danganronpa RPG - the gear's Voice section (E78 C5, 14.10.2026; the A9 design's step 8, the owner's Q0, Q8 and Q11).
 * ---------------------------------------------------------------------------
 * With the camera dock out of sight (voice-tile.mjs), the player's own A/V settings need a place, and the owner put
 * the person-by-person ones on the tile (Q0: volume and 'Mute for me' in the speaker's list) and left the gear
 * (look.mjs `openLookDialog`) only the devices, the mode and the key (Q8). This fieldset is the third of that window,
 * loaded by it - and only where `voiceAvailable()` - so a world without voice never fetches this file:
 *   - the microphone: a `select` of `game.webrtc.client.getAudioSources()` (Foundry's AVClient, external, as the
 *     design read av/client.mjs:121-151). Before the browser has allowed the microphone it lists one device with no
 *     id or labels it `WEBRTC.UnknownDevice` (the design's reading, external); then the section says what to do
 *     instead of offering a list of nameless devices;
 *   - the sound output: `getAudioSinks()`, the row left out where it lists nothing (a browser without `setSinkId`,
 *     the design's reading, external);
 *   - the microphone's mode, always on or push to talk (`voice.mode`: "always", "ptt"; avclient-livekit has no
 *     voice-activity mode, the design's reading of its hooks.ts:10-17, external);
 *   - the push-to-talk key as Foundry's controls name it, and a button to Foundry's own Configure Controls.
 * No camera (Q11: the table is audio-only; the pre-season checks say when a world still sends video), and nothing of
 * the server's - the LiveKit server, its keys, the world's A/V mode stay in Foundry's own A/V window, a GM's.
 * Every change is written at once (the window has one Close) by `writeVoiceSetting`, the one writer here, into this
 * browser's A/V client settings (`game.webrtc.settings.set("client", ...)`, as Foundry's A/V window writes them),
 * and only under the three keys above. The nodes are built with `createElement` and `textContent`; a device's label
 * is the browser's text and never parsed as markup.
 */

import { pushToTalkKey } from "./voice-tile.mjs";
import { error } from "./utils.mjs";

/** The client settings this section may write, and nothing else (R542 holds the names). */
const WRITABLE = ["audioSrc", "audioSink", "voice.mode"];

/** The two modes avclient-livekit has. */
const MODES = ["always", "ptt"];

/** Each control's name in the section, and the setting it writes. */
const CONTROLS = { "voice:audioSrc": "audioSrc", "voice:audioSink": "audioSink", "voice:mode": "voice.mode" };

/**
 * Write one of the section's settings into this browser's A/V client settings. Anything but the three keys, and a
 * mode that is not one of the two, is refused.
 *
 * @param {string} key
 * @param {string} value
 * @param {object} [settings]  Foundry's `game.webrtc.settings`; R542's records the write
 * @returns {Promise<boolean>} whether it wrote
 */
export async function writeVoiceSetting(key, value, settings = game.webrtc?.settings) {
    if (!WRITABLE.includes(key) || typeof value !== "string" || typeof settings?.set !== "function") return false;
    if (key === "voice.mode" && !MODES.includes(value)) return false;
    await settings.set("client", key, value);
    return true;
}

/** A device list from Foundry's AVClient (`{ deviceId: label }`), or nothing where it has none or it fails. */
async function devices(client, method) {
    try {
        const found = await client?.[method]?.();
        return found && typeof found === "object" ? found : {};
    } catch {
        return {};
    }
}

/** Whether the browser has not named its microphones yet: no device, one with no id, or every label unknown. */
function unnamed(sources) {
    const ids = Object.keys(sources), unknown = game.i18n.localize("WEBRTC.UnknownDevice");
    return !ids.length || (ids.length === 1 && ids[0] === "") || Object.values(sources).every(label => !label || label === unknown);
}

function node(tag, className, text = "") {
    const el = document.createElement(tag);
    if (className) el.className = className;
    el.textContent = text;
    return el;
}

/** A labelled `select` of `{ id: label }`, the stored id chosen. */
function deviceRow(label, name, options, chosen) {
    const row = node("label", "drpg-voice-panel-row");
    const select = document.createElement("select");
    select.name = name;
    for (const [id, text] of Object.entries(options)) {
        const option = node("option", "", String(text ?? id));
        option.value = id;
        option.selected = id === chosen;
        select.append(option);
    }
    row.append(node("span", "", label), select);
    return row;
}

/** Foundry's Configure Controls, where the push-to-talk key is changed (external; guarded). */
function openControls() {
    const Controls = foundry.applications?.sidebar?.apps?.ControlsConfig;
    if (typeof Controls !== "function") return false;
    new Controls().render({ force: true });
    return true;
}

/**
 * The Voice fieldset, wired: every change writes at once through `writeVoiceSetting`.
 *
 * @param {object} [facts]  handed in by R542
 * @param {object} [facts.client]       Foundry's AVClient (`game.webrtc.client`)
 * @param {object} [facts.settings]     Foundry's `game.webrtc.settings`
 * @param {string|null} [facts.key]     the push-to-talk key's name
 * @returns {Promise<HTMLFieldSetElement>}
 */
export async function voiceFieldset({ client = game.webrtc?.client, settings = game.webrtc?.settings, key = pushToTalkKey() } = {}) {
    const t = name => game.i18n.localize(`DRPG.Voice.panel.${name}`);
    const stored = settings?.client ?? {};
    const [sources, sinks] = await Promise.all([devices(client, "getAudioSources"), devices(client, "getAudioSinks")]);
    const fieldset = node("fieldset", "drpg-voice-panel");
    fieldset.append(node("legend", "", t("legend")));

    if (unnamed(sources)) fieldset.append(node("p", "notes drpg-voice-panel-mic-note", t("micNote")));
    else fieldset.append(deviceRow(t("mic"), "voice:audioSrc", sources, stored.audioSrc));
    if (Object.keys(sinks).length) fieldset.append(deviceRow(t("output"), "voice:audioSink", sinks, stored.audioSink));

    const mode = node("div", "drpg-voice-panel-mode");
    mode.setAttribute("role", "radiogroup");
    const modeLabel = node("span", "drpg-voice-panel-mode-label", t("mode"));
    modeLabel.id = "drpg-voice-panel-mode";
    mode.setAttribute("aria-labelledby", modeLabel.id);
    mode.append(modeLabel);
    const current = stored.voice?.mode === "ptt" ? "ptt" : "always";
    for (const [value, label] of [["always", t("modeAlways")], ["ptt", t("modePtt")]]) {
        const row = node("label", "drpg-voice-panel-radio");
        const radio = document.createElement("input");
        Object.assign(radio, { type: "radio", name: "voice:mode", value, checked: value === current });
        row.append(radio, node("span", "", label));
        mode.append(row);
    }
    fieldset.append(mode);

    const keyRow = node("div", "drpg-voice-panel-key");
    keyRow.append(node("span", "", key ? game.i18n.format("DRPG.Voice.panel.pttKey", { key }) : game.i18n.localize("DRPG.Voice.mic.pttNoKey")));
    if (typeof foundry.applications?.sidebar?.apps?.ControlsConfig === "function") {
        const change = node("button", "drpg-voice-panel-key-change", t("pttChange"));
        change.type = "button";
        change.addEventListener("click", event => {
            event.preventDefault();
            try {
                openControls();
            } catch (err) {
                error("Could not open Foundry's controls", err);
            }
        });
        keyRow.append(change);
    }
    fieldset.append(keyRow);

    fieldset.addEventListener("change", event => {
        const key = CONTROLS[event.target?.name];
        if (!key) return;
        event.stopPropagation();
        writeVoiceSetting(key, event.target.value, settings).catch(err => error("Could not change a voice setting", err));
    });
    return fieldset;
}
