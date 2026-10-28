/**
 * Danganronpa RPG - the voice tile: who you hear, in place of the camera dock (E78 C3, 13.10.2026; the A9 design's
 * steps 1, 2, 5 and 9, the E78 plan's C3).
 * ---------------------------------------------------------------------------
 * The owner asked for a tile instead of Foundry's camera dock (Q9, 11.10): the portrait and the name of whoever this
 * player hears speaking, on the brush caption the room tile wears (Q17, Q18), fading out after a silence (Q7). The
 * dock stays in the document, because avclient-livekit plays everybody's sound through the `<audio>` elements in it;
 * it is only never seen (`body.drpg-dock-hidden`, `display: none` in danganronpa.css, never removed). The GM's
 * `voiceTile` switch, on by default (AM-4), takes the tile away and gives the dock back to everybody.
 *
 * WHO IS SHOWN, and from where:
 *
 *   - Only a remote participant of THIS client's own LiveKit Room (`attachRoom`), mapped to a Foundry user by
 *     avclient-livekit (`participantUser`, the one call of its `getParticipantFVTTUser`). The Room says who speaks
 *     (`activeSpeakersChanged`, loudest first). Foundry's table-wide `settings.activity` names speakers in rooms
 *     this player cannot hear and is never read here (R544, and R535 plants it).
 *   - Only someone this browser hears: their `<audio>` in the dock exists, is not muted, not paused, above volume
 *     0 and carries a live, enabled track, and `muteAll` is off (`audible`). A participant muted for me is no
 *     speaker of mine. The element's selector is avclient-livekit 0.6.8's as the design read it on 11.10 (external,
 *     not re-read here); if a later avclient-livekit draws its audio elsewhere, the tile shows nobody - it does not
 *     guess.
 *   - On an empty tile the first speaker is shown at once (E79 C15, 1.2.79; the owner's N14 of 15.10.2026: "the
 *     voice tile shows a speaker slightly too late"); a new speaker while somebody else is still drawn - held or
 *     fading - is shown after 250 ms of speech (`STICK_MS`), so a cough does not take the portrait. Until C15 the
 *     first speaker waited the 250 ms as well (R535 read 249 ms empty). A short noise on an empty tile now shows a
 *     portrait for the hold and the fade (the prep's accepted cost). LiveKit's own delay before it lists a speaker
 *     is not this file's and was not measured (LIVE-E79-20). Whoever is
 *     shown stays while the Room still lists them; when it stops, the loudest other speaker who has passed the
 *     250 ms takes over at once, and with nobody else the portrait holds 1500 ms (`HOLD_MS`) and then fades over
 *     `--drpg-t-turn` (840 ms), or goes at once under reduced motion (Q7). The same speaker back inside that time
 *     keeps the portrait without a repaint of it; anybody else interrupts the hold or the fade.
 *   - A participant who leaves the Room, a lost connection and a new Room clear the portrait at once, with no
 *     hold: whoever is not in this player's channel any more is not shown speaking in it.
 *
 * WHAT IS DRAWN, and how: the name only as `textContent`; the portrait only as a path `safeRoomImage` accepts
 * (vault.mjs, the room tile's check), in a CSS string (`cssString`, room-tile.mjs) inside the art layer's `url()`.
 * Nothing here parses markup. `voiceIdentity` (camera-view.mjs, E78 C2) chooses the name and the picture, so the
 * tile and the dock's name plate cannot name two characters for one account. Each paint compares what it would
 * write with what the tile shows and writes only what differs (R536 counts the mutations).
 *
 * WHAT IS EXTERNAL: avclient-livekit's private API - `game.webrtc.client._liveKitClient`, its `liveKitRoom` and
 * `getParticipantFVTTUser`, the `liveKitClientInitialized` hook (voice-client.mjs has listened for it since before
 * E78) - is the design's reading of 0.6.8 on 11.10 and was not re-read here. Each read is guarded: no client, no
 * Room or a Room without `on` is the 'offline' state, which draws nobody. The harness's LiveKit shim
 * (audit/harness/lib/livekit.mjs) is what scenario 75 drives; real speaking detection, a hidden dock's sound after
 * F5 and `display: none !important` against Foundry's own rules are the owner's T1 (LIVE-E78-10) and LIVE-E78-01.
 *
 * THE TWO BUTTONS (E78 C4, 13.10.2026; the design's steps 6 and 7, the owner's Q0, Q1, Q6 and Q15). The microphone
 * (`micState`, `paintMic`) is grey and struck through only when the MODULE holds it - `micHold`'s `held`, from this
 * browser's own facts (voice.mjs) - with the reason; a GM's block is struck in the normal colours with a lock, a lost
 * connection or avclient-livekit's own window is not struck and wears a dot, and a muted-by-me button is struck in
 * the normal colours. A click or the `toggleMute` key (`onMuteKey`, no default key) calls `toggleOwnMic`, which in
 * the three states the player cannot change writes nothing and says why, and otherwise writes the viewer's own
 * `users.<self>.muted` client setting and nothing else - Foundry's own dock button does that write and no more
 * (cameras.mjs:509-518 as the design read it, external), and the design reads avclient-livekit as moving the
 * microphone on that write itself, in push-to-talk too (LiveKitAVClient.ts:797-808, external; LIVE-E78-02). The
 * module never calls `toggleAudio` (R544). The speaker button shows how many people share this browser's Room and
 * is struck while Foundry's "mute all" is on, and opens the list.
 * WHO IS LISTENING (E78 fix r1-G1, 14.10.2026; the review's SEC-R1-1). The dock drew a camera view for every
 * participant of the Room, so a listener who never spoke was still on screen - which is what the owner's rule of 13.09
 * against listening in by hand (voice.mjs's header) rests on. With the dock out of sight the speaker button's number
 * is that signal: `channelCount` counts every remote participant of this browser's Room, silent or speaking, mapped
 * to a user of this world or not (C4 counted only the mapped ones, so a participant avclient-livekit maps to nobody
 * listened unseen), and the number stands on the button without a click, on the tile and in the stacked row, after
 * every connect and disconnect (R550, scenario 75 phase F). Names stay the mapped participants' only (the list).
 *
 * THE LIST 'Who you hear' (E78 C5, 14.10.2026; the design's step 7, the owner's Q0 and Q4). The speaker button opens
 * `#drpg-voice-list`, a dialog beside the tile (not a pane: it cuts nothing of the curtain), one row per remote
 * participant of this browser's Room (`participantUser`, as the tile), sorted by the name `voiceIdentity` gives, with
 * the portrait through `safeRoomImage` and `cssString` as the tile's, a speaking dot, a volume slider and 'Mute for
 * me'; at the top Foundry's "mute all" of this browser. Every write is this browser's own client settings, as the
 * dock's own controls write them (the design's reading of cameras.mjs, external):
 *   - the volume is `users.<id>.volume` (`setPeerVolume`, the one writer of it), only for a participant of the
 *     watch's own Room, clamped to 0..1; the `<audio>` element's `volume` is set with it, at once while the slider
 *     moves and saved 200 ms after it stops (the design's debounce), and not at all while proximity-voice-chat is
 *     active, which computes the element's volume itself from the setting (the design's reading, external);
 *   - 'Mute for me' is that volume at 0, with the volume before it kept in the module's `voicePeerMutes` (settings.mjs,
 *     C3) - not the element's `muted`, which avclient-livekit rewrites from `muteAll` on every attach (LiveKitClient.ts
 *     :274-280 as the design read it, external; the harness's shim does the same, and scenario 75's C measures a
 *     re-attach keeping the 0). A participant is muted for me while the record names them AND their volume is 0;
 *     the record is read clamped (ids that are users of this world, numbers 0..1) and written whole, so an id
 *     that is not a user any more goes on the next write. Moving the slider of a muted participant unmutes them at
 *     the new volume; unmuting puts back the volume before (1 when that was 0);
 *   - a participant hidden earlier in the dock (`users.<id>.blocked`, which the dock's own button writes) gets a line
 *     and a 'Show and listen' button that writes it false, instead of a slider that would move nothing.
 * For a GM only, each row has the block of that microphone for everybody, Foundry's own write
 * (`permissions.BROADCAST_AUDIO` on the user, `toggleBlock`): drawn only while `game.user.isGM`, disabled with the
 * reason where `moduleHoldsMic` (voice.mjs) answers a hold - today a death the GMs keep secret, which a block, a
 * write on a user document every browser receives, would give away - and judged again by `toggleBlock` at the
 * click on the GM's own client from the world's facts, never from the button. Whether Foundry's server would refuse
 * that write from a player is not measured here (LIVE-E78-06); the player has no button to send it with.
 * Escape, heard on the list in the capture phase and stopped there so Foundry's menu does not open, and a pointer
 * outside it close the list and give the focus back to the speaker button; Tab stays inside it.
 *
 * The tile and the list send no socket and no packet, write no world setting and no document but the GM's block,
 * and set an element's volume only in `setPeerVolume`.
 *
 * THE STATE WORD (E79 C15, 1.2.79; the owner's N10 of 14.10.2026, N12 and N15 of 15.10.2026). The tile says in one
 * word how this browser's voice stands, running as the clock's ticker does (utils.mjs
 * `tickerRuns`, two aria-hidden copies): Own window (avclient-livekit's own window), Eclipsed (either hold of the
 * Eclipse), Connecting (this module moving the Room - voice-client.mjs `voiceApplying` - or the Room connecting or
 * reconnecting), Disconnected (no Room, or a Room in any other state than connected), Blocked (a GM's block, while
 * connected), Connected - in that order (`voiceWord`). Until C15 the tile had three states, and "connecting" and
 * "reconnecting" read as offline: while voice-client.mjs moved the Room the note said "You are not connected to
 * voice." (the owner's "error"). The sentence each word stands for is the word's `title` and the tile's polite
 * live text (`.drpg-voice-tile-nobody`, read by a screen reader, never seen); the note under the buttons no longer
 * shows (the stylesheets hide it as the live text is hidden; `paintMic` still writes it, the microphone's
 * description). Since H81-10 (the owner's 1.2.80 table and answer B, 20.10.2026) the word stays while a speaker is
 * drawn, at the tile's top over the picture (both stylesheets): until then `voiceWord` answered none with a face, and
 * the word went while somebody spoke. With a face a connected Room's sentence (the word's `title`) is
 * DRPG.Voice.held.connected, not "Nobody is speaking"; the live text is hidden while a face is drawn, as it was, and
 * is written only while none is, so a speaker's coming and going writes nothing into it, as before.
 * The Room's state is read off the Room the watch follows, and is "connected" only when the Room says
 * so; the names of livekit-client's states other than "connected" and "disconnected" ("connecting",
 * "reconnecting", "signalReconnecting") are the prep's reading of livekit-client, not read here (LIVE-E79-21).
 *
 * Where the tile stands (E78 C6): under Stained Glass, a fixed block of the curtain's (glass.mjs `voice-block`) at
 * the right wall under the Projects tray, with a pane of its own and its portrait on the whole pane (`seatVoiceArt`
 * moves the art layer to the body, so the layer is kept by the tile here rather than looked up in its face); on a
 * stacked screen, a part of the tiles' row beside the room tile (narrow.mjs `tileRow`); under Monokuma Legacy, the
 * interim corner in danganronpa.css. Nothing a speaker changes recuts the glass: the curtain is told only when the
 * tile is built or goes.
 */

import { MODULE_ID } from "./config.mjs";
import { micHold, moduleHoldsMic } from "./voice.mjs";
import { SETTINGS, getSetting, setSetting } from "./settings.mjs";
import { avclientActive, voiceApplying } from "./voice-client.mjs";
import { voiceIdentity, measureCameraDock } from "./camera-view.mjs";
import { safeRoomImage } from "./vault.mjs";
import { cssString } from "./room-tile.mjs";
import { reducedMotion, TURN } from "./motion.mjs";
import { error, plural, tickerRuns } from "./utils.mjs";
import { refreshGlass, seatVoiceArt } from "./glass.mjs";
import { tileRow } from "./narrow.mjs";

const TILE_ID = "drpg-voice-tile";

/** On `<body>` while the tile stands in for the dock: the dock and its popouts compute `display: none`. */
export const DOCK_HIDDEN_CLASS = "drpg-dock-hidden";

/** How long a new speaker speaks before the portrait is theirs while somebody else is drawn (the design's sticky
    rule; an empty tile shows its first speaker at once since E79 C15). */
export const STICK_MS = 250;

/** How long the portrait stays after its speaker leaves the Room's list (Q7). */
export const HOLD_MS = 1500;

/** A remote user's sound in the dock, as avclient-livekit 0.6.8 draws it (external; see the header). */
const AUDIO = ".camera-view[data-user] audio.user-microphone-audio";

/** A camera popout, as the hidden-dock rule (danganronpa.css) names it; Foundry v14's real id is not measured (R541). */
const POPOUT = '.application[id^="camera-view-"]';

/**
 * The state words (E79 C15; the owner's N15 settled their English and Polish), each with the sentence it stands for:
 * its `title` and the tile's live text. Spelt out, not built from the word, so R1 reads every key.
 */
const WORDS = {
    external: { word: "DRPG.Voice.tile.state.external", line: "DRPG.Voice.held.external" },
    eclipse: { word: "DRPG.Voice.tile.state.eclipsed", line: "DRPG.Voice.held.eclipse" },
    eclipseHeard: { word: "DRPG.Voice.tile.state.eclipsed", line: "DRPG.Voice.held.eclipseHeard" },
    connecting: { word: "DRPG.Voice.tile.state.connecting", line: "DRPG.Voice.held.connecting" },
    disconnected: { word: "DRPG.Voice.tile.state.disconnected", line: "DRPG.Voice.held.offline" },
    blocked: { word: "DRPG.Voice.tile.state.blocked", line: "DRPG.Voice.held.gmBlock" },
    connected: { word: "DRPG.Voice.tile.state.connected", line: "DRPG.Voice.tile.nobody" },
    speaking: { word: "DRPG.Voice.tile.state.connected", line: "DRPG.Voice.held.connected" }
};

/** A Room's states that are on the way to "connected" (livekit-client's names, as the prep read them; LIVE-E79-21). */
const CONNECTING = ["connecting", "reconnecting", "signalReconnecting"];

/** The microphone's states a click or the key may change: the viewer's own choice. The rest only say why not. */
const MIC_FREE = ["on", "ptt", "muted"];

/** Each tile's own ids, for the `aria-describedby` of its buttons (the suite builds tiles of its own beside it). */
let tiles = 0;

const realClock = {
    now: () => Date.now(),
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: id => clearTimeout(id)
};

/** The watch of the tile on the screen; `null` while there is none. */
let live = null;

/** Each tile's watch, so a tile's speaker button opens its own list (the suite builds tiles of its own). */
const watches = new WeakMap();

/** Each tile's portrait layer, which glass.mjs `seatVoiceArt` may have moved out of the tile onto its pane. */
const arts = new WeakMap();

/** The list's id on the screen's tile. */
const LIST_ID = "drpg-voice-list";

/** The volume slider's step, as the dock's (0..1). */
const VOLUME_STEP = 0.05;

/** How long a moving slider waits before its volume is written: one write per pause, not one per step (the design's). */
const VOLUME_SAVE_MS = 200;

/** This browser's 'Mute for me' record (`voicePeerMutes`), read and written whole; the suite hands in its own. */
const PEER_MUTES = {
    read: () => getSetting(SETTINGS.voicePeerMutes),
    write: value => setSetting(SETTINGS.voicePeerMutes, value)
};

/** Foundry's A/V modes (external; the numbers as a fallback where the namespace is missing). */
function avModes() {
    return foundry.av?.AVSettings?.AV_MODES ?? { DISABLED: 0, AUDIO: 1, VIDEO: 2, AUDIO_VIDEO: 3 };
}

/** The world's A/V mode, as Foundry's AVMaster holds it. */
function avMode() {
    return game.webrtc?.mode ?? game.webrtc?.settings?.world?.mode ?? avModes().DISABLED;
}

/**
 * Whether this world can carry the tile: its A/V mode sends sound (not DISABLED, not VIDEO alone - the owner's
 * table is audio-only, Q11) and the A/V client is avclient-livekit's (`avclientActive`).
 *
 * @param {object} [facts]  handed in by R541 (E78 fix r1-G2, round 1's cor F3: no test had read either clause, so a
 *   mutant that dropped one passed); left out, each is read here
 * @returns {boolean}
 */
export function voiceAvailable({ mode = avMode(), livekit = avclientActive() } = {}) {
    const MODES = avModes();
    return mode !== MODES.DISABLED && mode !== MODES.VIDEO && livekit;
}

/**
 * Whether this world sends video nobody watches (the owner's Q11, the pre-season row): its A/V mode is audio and
 * video while the tile stands in for the dock, so every camera is sent and none is on a screen. With the tile off
 * the dock shows the cameras, and that is the GM's choice.
 *
 * @param {object} [facts]  handed in by R542; left out, each is read here
 * @returns {boolean}
 */
export function videoUnwatched({ mode = avMode(), available = voiceAvailable(), on = getSetting(SETTINGS.voiceTile) !== false } = {}) {
    return mode === avModes().AUDIO_VIDEO && dockHiddenFor(available, on);
}

/**
 * Whether the dock is hidden: only when the tile stands in for it. Off by the GM's switch, or with no voice to
 * show, the dock is Foundry's as it always was.
 *
 * @param {boolean} available  `voiceAvailable()`
 * @param {boolean} on         the `voiceTile` setting
 * @returns {boolean}
 */
export function dockHiddenFor(available, on) {
    return Boolean(available) && Boolean(on);
}

/**
 * Hide the dock or give it back, by the body class alone: the dock's elements, and the `<audio>` in them, stay
 * where Foundry and avclient-livekit put them. The corner buttons' lift is measured again, since a hidden dock
 * lifts nothing.
 *
 * @param {boolean} hidden
 */
export function applyDockHidden(hidden) {
    if (document.body.classList.contains(DOCK_HIDDEN_CLASS) === Boolean(hidden)) return;
    document.body.classList.toggle(DOCK_HIDDEN_CLASS, Boolean(hidden));
    measureCameraDock();
}

/**
 * The tile's element, made once and appended to the body: a labelled region with the face (the portrait's art
 * layer and the caption's plate) and a line a screen reader reads when nobody speaks.
 *
 * @returns {HTMLElement}
 */
export function ensureVoiceTile() {
    let tile = document.getElementById(TILE_ID);
    if (!tile) {
        tile = buildVoiceTile();
        tile.id = TILE_ID;
    }
    if (!tile.isConnected) {
        /* In the tiles' row on a stacked screen, as room-tile.mjs puts its own; else in the body, where the curtain
           seats it. A new block of the curtain's: one cut for it, and none after (scenario 75 phase D). */
        (tileRow() ?? document.body).append(tile);
        recutForTile();
    }
    return tile;
}

/* The curtain's pane for the tile (glass.mjs `voice-block`) is cut when the tile comes or goes, and only while a
   curtain stands: at `ready` the curtain is mounted after the tile (module.mjs) and finds it there. */
function recutForTile() {
    if (document.body.classList.contains("drpg-curtain-on")) refreshGlass();
}

/**
 * A tile's markup, built with `createElement` and `textContent` alone; loose, so the suite can paint one of its
 * own (R535, R536, R537, R540). The two buttons stand in the tile's corner, over the portrait (Q17), and stay when
 * nobody speaks (Q7); the note under them carries the microphone's line - the reason it is held, or a line of
 * information - and is shown only while that line is true. The speaker button opens the tile's list (E78 C5).
 *
 * @param {object} [options]
 * @param {() => unknown} [options.onMic]  what a click of the microphone does: `toggleOwnMic`; the suite's spy
 * @param {(tile: HTMLElement) => unknown} [options.onSpeaker]  what a click of the speaker does: the list of the
 *   tile's own watch, opened or closed
 * @returns {HTMLElement}
 */
export function buildVoiceTile({ onMic = () => toggleOwnMic(), onSpeaker = tile => toggleVoiceList(watches.get(tile)) } = {}) {
    const tile = document.createElement("section");
    const n = ++tiles;
    tile.className = "drpg-voice-tile";
    tile.dataset.state = "offline";
    tile.setAttribute("role", "region");
    tile.setAttribute("aria-label", game.i18n.localize("DRPG.Voice.tile.label"));

    const face = textNode("div", "drpg-voice-tile-face", "");
    face.hidden = true;
    const art = textNode("div", "drpg-voice-tile-art", "");
    art.hidden = true;
    art.setAttribute("aria-hidden", "true");
    const plate = textNode("div", "drpg-voice-tile-plate", "");
    const more = textNode("span", "drpg-voice-tile-more", "");
    more.hidden = true;
    plate.append(textNode("span", "drpg-voice-tile-speaking", game.i18n.localize("DRPG.Voice.tile.speaking")),
        textNode("span", "drpg-voice-tile-name", ""), more);
    face.append(art, plate);
    arts.set(tile, art);

    const mic = miniButton("drpg-voice-mic", "mic", game.i18n.localize("DRPG.Voice.mic.mute"));
    mic.setAttribute("aria-pressed", "false");
    const lock = glyph("lock");
    lock.classList.add("drpg-voice-mic-lock");
    mic.append(lock, textNode("span", "drpg-voice-mic-ptt", game.i18n.localize("DRPG.Voice.mic.pttBadge")));
    mic.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        Promise.resolve().then(onMic).catch(err => error("Could not change your microphone", err));
    });
    const speaker = miniButton("drpg-voice-speaker", "sound", game.i18n.localize("DRPG.Voice.list.open"));
    speaker.setAttribute("aria-haspopup", "dialog");
    speaker.setAttribute("aria-expanded", "false");
    const count = textNode("span", "drpg-voice-count", "");
    count.hidden = true;
    count.setAttribute("aria-hidden", "true");
    const heard = textNode("span", "drpg-voice-count-line", "");
    heard.id = `drpg-voice-count-${n}`;
    heard.hidden = true;
    speaker.append(count, heard);
    speaker.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        try {
            onSpeaker(tile);
        } catch (err) {
            error("Could not open the list of who you hear", err);
        }
    });
    const note = textNode("p", "drpg-voice-tile-note", "");
    note.id = `drpg-voice-note-${n}`;
    note.hidden = true;
    const controls = textNode("div", "drpg-voice-tile-controls", "");
    controls.append(mic, speaker);

    /* The state word (E79 C15): two runs of the word, read by nobody (the sentence is the live text after it, and the
       word's own `title`); kept while a speaker is drawn since H81-10. The live text was the "nobody" line, which a screen
       reader read while nobody spoke; it now says the sentence of the state, politely, as it changes. */
    const word = textNode("div", "drpg-voice-tile-state", "");
    word.hidden = true;
    word.setAttribute("aria-hidden", "true");
    const said = textNode("span", "drpg-voice-tile-nobody", game.i18n.localize("DRPG.Voice.tile.nobody"));
    said.setAttribute("role", "status");
    said.setAttribute("aria-live", "polite");

    tile.append(face, word, said, controls, note);
    return tile;
}

function textNode(tag, className, text) {
    const el = document.createElement(tag);
    el.className = className;
    el.textContent = text;
    return el;
}

/** A 30 px hexagon of the corner's family (Q6): a button with a pixel glyph and a label. */
function miniButton(className, name, label) {
    const button = textNode("button", `drpg-launch-mini ${className}`, "");
    button.type = "button";
    button.setAttribute("aria-label", label);
    button.dataset.tooltipText = label;
    button.append(glyph(name));
    return button;
}

/** One of the module's pixel glyphs (pixel-icons.py), masked in the current colour; never read aloud. */
function glyph(name) {
    const icon = textNode("i", "drpg-pxi", "");
    icon.style.setProperty("--drpg-px-mask", `var(--drpg-px-${name})`);
    icon.setAttribute("aria-hidden", "true");
    icon.inert = true;
    return icon;
}

/**
 * A watch: what one tile follows - the Room it listens to, who that Room says speaks, who is drawn, and the
 * timers of the sticky rule, the hold and the fade. The suite hands in its own clock, dock and switches.
 *
 * @param {HTMLElement} tile
 * @param {object} [options]
 * @param {{now: Function, setTimeout: Function, clearTimeout: Function}} [options.clock]
 * @param {() => ParentNode} [options.dock]     where the users' `<audio>` elements are looked for: `foundryDock`
 * @param {() => boolean} [options.muteAll]     Foundry's "mute all" of this browser
 * @param {() => number} [options.fade]         the fade's length in ms; 0 under reduced motion
 * @param {(id: string) => User} [options.userOf] whose name and portrait a speaker's id is drawn with: the
 *   world's user; the suite gives a user a portrait of its own without touching a document (R536)
 * @param {(watch: object) => void} [options.controls]  what repaints the buttons after each step: `paintControls`
 *   on the screen's tile; nothing on the suite's, whose buttons R537 paints by hand
 * @param {() => object} [options.settings]  where the list reads and writes this browser's A/V client settings:
 *   Foundry's `game.webrtc.settings`; the suite's records the writes (R538)
 * @param {{read: Function, write: Function}} [options.mutes]  the 'Mute for me' record: `voicePeerMutes`
 * @param {() => boolean} [options.proximity]  whether proximity-voice-chat sets the elements' volumes itself
 * @param {() => boolean} [options.gm]  whether the list draws the GM's block: `game.user.isGM`; the suite draws a
 *   player's list with false (R539). The block's write asks `game.user.isGM` itself (`toggleBlock`).
 * @param {() => object|null} [options.hold]  `micHold`'s answer for the state word, asked as if connected - the word
 *   reads the connection off the watch's own Room (E79 C15); the suite hands in each hold
 * @param {() => boolean} [options.applying]  whether voice-client.mjs is moving the Room now (`voiceApplying`)
 */
export function voiceWatch(tile, { clock = realClock, dock = foundryDock,
    muteAll = () => game.webrtc?.settings?.client?.muteAll === true, fade = () => (reducedMotion() ? 0 : TURN()),
    userOf = id => game.users.get(id), controls = null, settings = () => game.webrtc?.settings, mutes = PEER_MUTES,
    proximity = () => game.modules?.get?.("proximity-voice-chat")?.active === true, gm = () => game.user?.isGM === true,
    hold = () => micHold({ connected: true }), applying = () => voiceApplying() } = {}) {
    const watch = {
        tile, clock, dock, muteAll, fade, userOf, controls, settings, mutes, proximity, gm, hold, applying,
        client: null, room: null, detach: null,
        /** The Room's speakers this browser can map, loudest first, as user ids; and when each began. */
        speakers: [], since: new Map(),
        /** Who is drawn, and whether they are speaking, held after their speech, or fading. */
        shown: null, phase: "silent",
        /** Whether the Room counts the viewer's own participant among its speakers, as the microphone button shows it. */
        selfSpeaking: false,
        timers: { stick: null, hold: null, fade: null },
        /** The list (built at its first opening), its outside-pointer listener, and each slider's pending save. */
        list: null, away: null, saves: new Map()
    };
    if (tile) watches.set(tile, watch);
    return watch;
}

/**
 * The user a participant of the watch's own Room is, or `null`: only a remote participant the Room holds, mapped
 * by avclient-livekit (external). The viewer's own participant and anybody the Room does not hold is nobody here.
 *
 * @param {object} client       avclient-livekit's `LiveKitClient`
 * @param {object} participant
 * @param {object} [room]       the Room the participant has to be in
 * @returns {User|null}
 */
export function participantUser(client, participant, room = client?.liveKitRoom) {
    try {
        if (!participant || participant.isLocal || participant === room?.localParticipant) return null;
        if (![...(room?.remoteParticipants?.values?.() ?? [])].includes(participant)) return null;
        const user = client?.getParticipantFVTTUser?.(participant);
        return user?.id && user.id !== game.user?.id && game.users.get(user.id) === user ? user : null;
    } catch {
        return null;
    }
}

/**
 * Follow `client`'s current Room. The old Room is left first - every listener this file gave it taken off - and
 * the portrait cleared at once, so nobody of the old channel is shown in the new one; an event the old Room
 * still emits is checked against the watch's Room and changes nothing. No client, no Room, or a Room without
 * `on` (an avclient-livekit this file does not know) is the offline state.
 *
 * @param {object|null} client  avclient-livekit's `LiveKitClient`
 * @param {object} [watch]
 * @returns {boolean} whether a Room is followed
 */
export function attachRoom(client, watch = live) {
    if (!watch) return false;
    watch.detach?.();
    watch.detach = null;
    watch.client = client ?? null;
    watch.room = null;
    resetSpeech(watch);
    const room = client?.liveKitRoom ?? null;
    if (!room || typeof room.on !== "function") {
        paintSpeaker(watch);
        return false;
    }
    watch.room = room;
    /* The five events, named here and nowhere else in the file (R534 keys the speaking road by this declaration).
       A participant who left is checked against the Room in `voiceStep` with the departing one left out, whether
       or not the Room still holds it when it says so (the shim deletes it first; livekit-client's order is not
       read here): no hold for somebody who is not in the channel any more. */
    const handlers = [
        ["activeSpeakersChanged", speakers => onSpeakers(watch, speakers)],
        ["participantConnected", () => voiceStep(watch)],
        ["participantDisconnected", participant => voiceStep(watch, participant)],
        ["connectionStateChanged", state => (state === "disconnected" ? onLost(watch) : voiceStep(watch))],
        ["disconnected", () => onLost(watch)]
    ].map(([event, fn]) => [event, arg => {
        if (watch.room !== room) return;
        try {
            fn(arg);
        } catch (err) {
            error("Could not follow the voice room", err);
        }
    }]);
    for (const [event, fn] of handlers) room.on(event, fn);
    watch.detach = () => {
        for (const [event, fn] of handlers) (room.off ?? room.removeListener)?.call(room, event, fn);
    };
    // Who speaks is the Room's list as it stands, each of them new to this watch: shown after `STICK_MS`.
    onSpeakers(watch, room.activeSpeakers);
    return true;
}

/** Stop following any Room: the listeners off, the timers stopped, the portrait gone. */
export function detachRoom(watch = live) {
    if (!watch) return;
    watch.detach?.();
    watch.detach = null;
    watch.room = null;
    resetSpeech(watch);
}

/**
 * The Room's speakers, loudest first, as the users this watch can map: the viewer's own participant is among them
 * when the viewer speaks, and `participantUser` drops it with anybody the Room does not hold. Each keeps the time
 * they began, which the sticky rule reads.
 */
function onSpeakers(watch, speakers) {
    const now = watch.clock.now(), ids = [];
    for (const participant of Array.isArray(speakers) ? speakers : []) {
        const id = participantUser(watch.client, participant, watch.room)?.id;
        if (id && !ids.includes(id)) ids.push(id);
    }
    for (const id of [...watch.since.keys()]) if (!ids.includes(id)) watch.since.delete(id);
    for (const id of ids) if (!watch.since.has(id)) watch.since.set(id, now);
    watch.speakers = ids;
    paintSelf(watch, (Array.isArray(speakers) ? speakers : []).some(p => p && (p.isLocal === true || p === watch.room?.localParticipant)));
    voiceStep(watch);
}

/**
 * Light the microphone button while the Room counts the viewer's own participant among its speakers, and put it out
 * again (E78 fix r2-H3, review round 2's cor F5: Foundry's dock lit the viewer's own view while they spoke, and with
 * the dock hidden nothing on the screen did). Written only when that changes, as `paintSpeaker` writes the face.
 */
function paintSelf(watch, speaking) {
    if (watch.selfSpeaking === speaking) return false;
    watch.selfSpeaking = speaking;
    watch.tile?.querySelector(".drpg-voice-mic")?.classList.toggle("is-speaking", speaking);
    return true;
}

/** The connection is gone: nobody, at once, and the offline state until the Room connects again. */
function onLost(watch) {
    resetSpeech(watch);
    voiceStep(watch);
}

/** Nobody speaking and nobody drawn, at once: the Room changed or the connection went. */
function resetSpeech(watch) {
    watch.speakers = [];
    paintSelf(watch, false);
    watch.since.clear();
    for (const slot of Object.keys(watch.timers)) cancel(watch, slot);
    clearSpeaker(watch);
}

/**
 * Where this browser plays the voices: Foundry's dock (`ui.webrtc.element`, the one root avclient-livekit 0.6.8 looks
 * in for a user's `<audio>`, LiveKitClient.ts `getUserAudioElement`, external) and the camera popouts Foundry has
 * open, found among its own applications (`foundry.applications.instances`) - never the whole document. E78 fix
 * r1-G2, 14.10.2026, round 1's SEC-R1-5: the default was `document`, and a paused element of the dock's shape put in
 * front of the dock in p1's page made p2's speech show nobody on p1's tile (the reviewer's reading; R535 plants one,
 * inside a popout-shaped wrapper, which this skips too). `audible` and `audioOf` read it alike.
 *
 * @returns {{querySelectorAll: (selector: string) => Element[]}}
 */
function foundryDock() {
    const popouts = [...(foundry.applications?.instances?.values?.() ?? [])].map(app => app?.element).filter(el => el?.matches?.(POPOUT));
    const roots = [ui.webrtc?.element, ...popouts];
    return { querySelectorAll: selector => roots.flatMap(root => [...(root?.querySelectorAll?.(selector) ?? [])]) };
}

/** Whether this browser hears `userId`: their element in the dock plays a live track, and nothing mutes it here. */
function audible(watch, userId) {
    if (watch.muteAll()) return false;
    const root = watch.dock();
    const audio = [...(root?.querySelectorAll?.(AUDIO) ?? [])].find(el => el.closest(".camera-view")?.dataset.user === userId);
    if (!audio || audio.muted || audio.paused || !(Number(audio.volume) > 0)) return false;
    const tracks = audio.srcObject?.getAudioTracks?.() ?? [];
    return tracks.some(track => track?.readyState === "live" && track.enabled !== false);
}

/** Whether `userId` is still a participant of the watch's Room; `gone` is a participant that has just left it. */
function inRoom(watch, userId, gone = null) {
    const room = watch.room;
    return [...(room?.remoteParticipants?.values?.() ?? [])]
        .some(p => p !== gone && participantUser(watch.client, p, room)?.id === userId);
}

/**
 * The rule of who is drawn, run after every event and every timer: the shown speaker stays while the Room lists
 * them and this browser hears them; otherwise, on an empty tile, the loudest speaker at once, and while somebody is
 * still drawn (held or fading) the loudest speaker past `STICK_MS`; otherwise the hold, then the fade. A speaker not
 * yet past `STICK_MS` sets the timer that asks again. Whoever the Room no longer holds is dropped first, and the
 * portrait with them at once.
 *
 * @param {object} [watch]
 * @param {object} [gone]  a participant the Room has just said left
 */
export function voiceStep(watch = live, gone = null) {
    if (!watch) return;
    if (watch.shown && !inRoom(watch, watch.shown, gone)) clearSpeaker(watch);
    watch.speakers = watch.speakers.filter(id => inRoom(watch, id, gone));
    for (const id of [...watch.since.keys()]) if (!watch.speakers.includes(id)) watch.since.delete(id);
    const now = watch.clock.now();
    const heard = watch.speakers.filter(id => audible(watch, id));
    const ready = heard.filter(id => id === watch.shown || !watch.shown || now - (watch.since.get(id) ?? now) >= STICK_MS);
    const waits = heard.filter(id => !ready.includes(id)).map(id => watch.since.get(id) + STICK_MS - now);
    cancel(watch, "stick");
    if (waits.length) schedule(watch, "stick", Math.max(0, Math.min(...waits)), () => voiceStep(watch));

    const next = watch.shown && heard.includes(watch.shown) ? watch.shown : (ready[0] ?? null);
    if (next) {
        cancel(watch, "hold");
        cancel(watch, "fade");
        watch.shown = next;
        watch.phase = "speaking";
    } else if (watch.shown && watch.phase === "speaking") {
        watch.phase = "holding";
        schedule(watch, "hold", HOLD_MS, () => startFade(watch));
    }
    paintSpeaker(watch, ready.filter(id => id !== watch.shown).length, gone);
    watch.controls?.(watch, gone);
}

/** The hold is over: fade the portrait, then clear it - at once when the fade is 0 ms (reduced motion). */
function startFade(watch) {
    watch.timers.hold = null;
    if (!watch.shown) return;
    const ms = Number(watch.fade()) || 0;
    if (ms <= 0) {
        clearSpeaker(watch);
        paintSpeaker(watch);
        return;
    }
    watch.phase = "fading";
    paintSpeaker(watch);
    schedule(watch, "fade", ms, () => {
        watch.timers.fade = null;
        clearSpeaker(watch);
        paintSpeaker(watch);
    });
}

function clearSpeaker(watch) {
    cancel(watch, "hold");
    cancel(watch, "fade");
    watch.shown = null;
    watch.phase = "silent";
}

function schedule(watch, slot, ms, fn) {
    cancel(watch, slot);
    watch.timers[slot] = watch.clock.setTimeout(() => {
        watch.timers[slot] = null;
        try {
            fn();
        } catch (err) {
            error("Could not update the voice tile", err);
        }
    }, ms);
}

function cancel(watch, slot) {
    if (watch.timers[slot] === null) return;
    watch.clock.clearTimeout(watch.timers[slot]);
    watch.timers[slot] = null;
}

/** What each tile shows now, field by field, so a paint writes only what changed. */
const painted = new WeakMap();

/**
 * A voice's portrait: the first of `voiceIdentity`'s `faces` that `safeRoomImage` accepts, else `null` (E78 fix
 * h76-HF1, 14.10.2026). Until then the tile judged `img` alone, the character's picture before the avatar, so a
 * character on Foundry's default `.svg` (refused) drew no face though the avatar would pass (round 1's sec
 * SEC-R1-4, measured there). On The Forge `safeRoomImage` also takes the Assets Library, so a face kept there is
 * drawn (R546). The tile and the list read it alike.
 */
function voicePortrait(who) {
    for (const path of who?.faces ?? []) {
        const image = safeRoomImage(path);
        if (image) return image;
    }
    return null;
}

/**
 * Draw the watch's speaker on its tile: the name as `textContent`, the portrait as a checked path in the art
 * layer's `url()`, '+N' for the others this browser hears speaking, and the state the stylesheets read. Writes
 * only the fields that differ from what the tile shows; returns whether it wrote anything.
 *
 * @param {object} watch
 * @param {number} [more]  the other audible speakers past the sticky rule
 * @param {object} [gone]  a participant the Room has just said left, not counted
 * @returns {boolean}
 */
function paintSpeaker(watch, more = 0, gone = null) {
    const tile = watch.tile;
    const face = tile?.querySelector(".drpg-voice-tile-face");
    if (!face) return false;
    const user = watch.shown ? watch.userOf(watch.shown) : null;
    const who = user ? voiceIdentity(user) : null;
    const image = voicePortrait(who);
    const next = {
        state: watch.room?.state !== "connected" ? "offline" : who ? "speaking" : "silent",
        inChannel: String(channelCount(watch, gone)),
        fading: Boolean(who) && watch.phase === "fading",
        name: who?.name ?? "",
        image,
        more: who ? more : 0,
        face: Boolean(who)
    };
    const last = painted.get(tile) ?? {};
    const changed = Object.keys(next).filter(key => last[key] !== next[key]);
    const worded = paintWord(watch, next.face);
    if (!changed.length) return worded;
    painted.set(tile, next);

    const art = arts.get(tile) ?? null;
    if (changed.includes("state")) tile.dataset.state = next.state;
    /* The face follows the speaker, not the state (E78 fix r1-G2, 14.10.2026, round 1's cor F2): written only on a
       change of state, a speaker kept through "reconnecting" (offline) and then cleared by the Room's loss left an
       empty face under "Speaking" and no "nobody" line until the next connect - the reviewer's probe 97; R535. */
    if (changed.includes("face")) {
        face.hidden = !next.face;
        if (art) art.hidden = !next.face;
        const nobody = tile.querySelector(".drpg-voice-tile-nobody");
        if (nobody) nobody.hidden = next.face;
    }
    if (changed.includes("inChannel")) tile.dataset.inChannel = next.inChannel;
    if (changed.includes("fading")) {
        tile.classList.toggle("is-fading", next.fading);
        art?.classList.toggle("is-fading", next.fading);
    }
    if (changed.includes("name")) {
        const name = face.querySelector(".drpg-voice-tile-name");
        if (name) name.textContent = next.name;
    }
    if (changed.includes("image")) {
        if (image) art?.style.setProperty("background-image", `url("${cssString(image)}")`);
        else art?.style.removeProperty("background-image");
    }
    if (changed.includes("more")) {
        const badge = face.querySelector(".drpg-voice-tile-more");
        if (badge) {
            badge.hidden = !(next.more > 0);
            badge.textContent = next.more > 0 ? `+${next.more}` : "";
            if (next.more > 0) badge.setAttribute("aria-label", plural("DRPG.Voice.tile.more", { n: next.more }));
            else badge.removeAttribute("aria-label");
        }
    }
    return true;
}

/**
 * How many people this browser shares its Room with: every remote participant, whether or not they speak and whether
 * or not avclient-livekit maps them to a user of this world - each of them hears this room (E78 fix r1-G1). `gone`,
 * a participant the Room has just said left, is not counted whether or not the Room still holds it (livekit-client's
 * order is not read here, as in `voiceStep`).
 *
 * @param {object} watch
 * @param {object} [gone]
 * @returns {number}
 */
function channelCount(watch, gone = null) {
    const room = watch.room;
    if (room?.state !== "connected") return 0;
    return [...(room.remoteParticipants?.values?.() ?? [])]
        .filter(p => p && p !== gone && !p.isLocal && p !== room.localParticipant).length;
}

/**
 * The tile's state word (E79 C15, 1.2.79; the owner's N10, N12 and N15), whether or not a speaker is drawn (H81-10):
 * `{ word, line }`, the keys of the word and of the sentence it stands for (`WORDS`). In this order:
 * avclient-livekit's own window; either hold of the Eclipse (N12: "only 'Eclipsed' in an Eclipse", whether or not
 * the Room is up yet); this module moving the Room, or the Room on its way; any Room that is not connected, and no
 * Room at all; a GM's block, only while connected (with no connection the player hears nobody anyway); connected.
 * Never connected before the Room says so: `state` is the Room's own, and "connected" is the one value that is.
 * Connected with a face drawn stands for DRPG.Voice.held.connected, since somebody is speaking (`WORDS.speaking`).
 *
 * @param {object} [facts]
 * @param {boolean} [facts.face]      whether a speaker is drawn
 * @param {object|null} [facts.hold]  `micHold`'s answer, asked as if connected
 * @param {string|null} [facts.state] the watch's Room's `state`, `null` with no Room
 * @param {boolean} [facts.applying]  voice-client.mjs `voiceApplying()`
 * @returns {{word: string, line: string}}
 */
export function voiceWord({ face = false, hold = null, state = null, applying = false } = {}) {
    const reason = hold?.reason;
    if (reason === "external" || reason === "eclipse" || reason === "eclipseHeard") return WORDS[reason];
    if (applying === true || CONNECTING.includes(state)) return WORDS.connecting;
    if (state !== "connected") return WORDS.disconnected;
    if (reason === "gmBlock") return WORDS.blocked;
    return face ? WORDS.speaking : WORDS.connected;
}

/** What each tile's state word shows now, as `painted` holds the speaker's. */
const paintedWord = new WeakMap();

/**
 * Draw the state word on the watch's tile: the two runs (`tickerRuns`) of the word, its sentence as their `title`
 * and as the tile's live text, `data-word` for the stylesheets; a speaker drawn keeps it (H81-10). Writes only what
 * differs from what the tile shows, so a speaker's pauses write nothing (R536). A hold that throws reads as none.
 *
 * @param {object} watch
 * @param {boolean} face  whether a speaker is drawn
 * @returns {boolean} whether it wrote anything
 */
function paintWord(watch, face) {
    const tile = watch?.tile, box = tile?.querySelector(".drpg-voice-tile-state"), said = tile?.querySelector(".drpg-voice-tile-nobody");
    if (!box || !said) return false;
    let hold = null;
    try {
        hold = watch.hold?.() ?? null;
    } catch {
        hold = null;
    }
    const now = voiceWord({ face, hold, state: watch.room?.state ?? null, applying: watch.applying?.() === true });
    const next = { word: now ? game.i18n.localize(now.word) : "", line: now ? game.i18n.localize(now.line) : "", face: face === true };
    const last = paintedWord.get(tile) ?? {};
    if (last.word === next.word && last.line === next.line && last.face === next.face) return false;
    paintedWord.set(tile, next);
    if (last.word !== next.word) {
        box.replaceChildren(...(next.word ? tickerRuns(next.word) : []));
        box.hidden = !next.word;
        if (now) tile.dataset.word = now.word.split(".").at(-1);
        else delete tile.dataset.word;
    }
    if (next.line) {
        box.title = next.line;
        // The live text is hidden while a face is drawn (`paint`): written then, a polite live region would change
        // with every speaker (H81-10). With the face gone `next.face` differs from `last`'s, so it is written then.
        if (!next.face && said.textContent !== next.line) said.textContent = next.line;
    } else box.removeAttribute("title");
    return true;
}

/**
 * voice-client.mjs began or ended a move of the Room (`drpgVoiceApplying`): every tile in the document says it,
 * without waiting for an event of the Room, which still says "connected" while the move takes it down (E79 C15).
 */
export function onVoiceApplying() {
    for (const tile of document.querySelectorAll(".drpg-voice-tile")) {
        const watch = watches.get(tile);
        if (watch) paintWord(watch, painted.get(tile)?.face === true);
    }
}

/**
 * The microphone button's state, from this browser's own facts (E78 C4; the design's step 6, Q1, Q15): `micHold`
 * (voice.mjs, never GmStore) and this browser's client settings. One of
 *   - "held": the module holds the microphone (`micHold`'s `held`: the Eclipse room; E67 adds its own) - grey and
 *     struck, the reason shown;
 *   - "gmBlock": a GM blocked it for everybody - struck in the normal colours, with a lock, never grey (Q15);
 *   - "offline": no connected Room, or avclient-livekit's own window ("external") - not struck, a dot, the reason shown;
 *   - "muted": the viewer muted it - struck in the normal colours, `aria-pressed`;
 *   - "ptt" or "on": open, "ptt" while Foundry's voice mode is push-to-talk.
 * `reason` names the line under `DRPG.Voice.held` for the first three; `info` is a reason that holds nothing
 * ("eclipseHeard": a Monocub alone in its Eclipse room, never grey - the design's P6; "deadAlone": the dead channel,
 * since E19 fix r1-G1, where the dead hear each other), shown beside an open or muted button. "Muted by me" is the
 * stored `users.<self>.muted` - the value `toggleOwnMic` writes - and not `getUser`'s answer, which Foundry may complete
 * from the A/V client's own state (av/settings.mjs, external, not re-read here).
 *
 * @param {object} [facts]  handed in by R537; left out, each is read here
 * @param {object|null} [facts.hold]  `micHold()`'s answer
 * @param {object} [facts.settings]   Foundry's `game.webrtc.settings`
 * @returns {{state: string, reason: string|null, info: string|null}}
 */
export function micState({ hold, settings = game.webrtc?.settings } = {}) {
    const answer = hold === undefined ? micHold() : hold;
    if (answer?.held) return { state: "held", reason: answer.reason, info: null };
    if (answer?.reason === "external" || answer?.reason === "offline") return { state: "offline", reason: answer.reason, info: null };
    if (answer?.reason === "gmBlock") return { state: "gmBlock", reason: answer.reason, info: null };
    const info = answer?.reason ?? null;
    // A line's words (E70 C5): the mode a Monocub listens in, `cubListen`'s {mode}.
    const data = answer?.data ? { data: answer.data } : {};
    if (settings?.get?.("client", `users.${game.user?.id}.muted`) === true) return { state: "muted", reason: null, info, ...data };
    return { state: settings?.client?.voice?.mode === "ptt" ? "ptt" : "on", reason: null, info, ...data };
}

/**
 * The viewer's own microphone, on the viewer's own click or key: in "on", "ptt" and "muted" the one write Foundry's
 * dock makes for its own user, `users.<self>.muted` in this browser's client settings, flipped - and nothing else, no
 * `toggleAudio` (the design reads avclient-livekit as acting on the write itself; external). In "held", "gmBlock" and
 * "offline" it writes nothing and says why. The state is asked at the moment of the click, not read off the button.
 *
 * @param {object} [options]  handed in by R537
 * @param {object} [options.mic]       `micState()`
 * @param {object} [options.settings]  Foundry's `game.webrtc.settings`
 * @param {(text: string) => void} [options.notify]
 * @returns {Promise<boolean>} whether it wrote
 */
export async function toggleOwnMic({ mic = micState(), settings = game.webrtc?.settings,
    notify = text => ui.notifications?.info(text) } = {}) {
    if (!MIC_FREE.includes(mic?.state)) {
        notify(game.i18n.localize(`DRPG.Voice.held.${mic?.reason ?? "offline"}`));
        return false;
    }
    if (typeof settings?.set !== "function") return false;
    await settings.set("client", `users.${game.user.id}.muted`, mic.state !== "muted");
    return true;
}

/** The core push-to-talk key as Foundry's controls name it, or `null` when none is bound (external; guarded). */
export function pushToTalkKey(keybindings = game.keybindings) {
    try {
        const binding = keybindings?.get?.("core", "pushToTalk")?.[0];
        if (!binding?.key) return null;
        const humanize = foundry.applications?.sidebar?.apps?.ControlsConfig?.humanizeBinding;
        return typeof humanize === "function" ? humanize(binding) : binding.key;
    } catch {
        return null;
    }
}

/** What each tile's microphone shows now, as `painted` holds the speaker's. */
const paintedMic = new WeakMap();

/**
 * Draw `mic` on a tile's microphone button and its note, writing only what differs from what the tile shows. The
 * classes are what the stylesheets read: `is-held` (grey, struck), `is-gm-blocked` (struck, the lock), `is-offline`
 * (the dot), `is-muted` (struck), `is-ptt` (the small label). The note is shown for a held or offline reason and for
 * a line of information; a GM's block and push-to-talk keep their line in the button's description only.
 *
 * @param {HTMLElement} tile
 * @param {{state: string, reason: string|null, info: string|null}} mic  `micState()`
 * @param {object} [options]
 * @param {string|null} [options.key]  the push-to-talk key's name
 * @returns {boolean} whether it wrote anything
 */
export function paintMic(tile, mic, { key = pushToTalkKey() } = {}) {
    const button = tile?.querySelector(".drpg-voice-mic"), note = tile?.querySelector(".drpg-voice-tile-note");
    if (!button || !note) return false;
    const reasonLine = mic.reason ? game.i18n.format(`DRPG.Voice.held.${mic.reason}`, mic.data ?? {}) : "";
    const infoLine = mic.info ? game.i18n.format(`DRPG.Voice.held.${mic.info}`, mic.data ?? {}) : "";
    const pttLine = mic.state === "ptt"
        ? (key ? game.i18n.format("DRPG.Voice.mic.ptt", { key }) : game.i18n.localize("DRPG.Voice.mic.pttNoKey")) : "";
    const tip = { muted: game.i18n.localize("DRPG.Voice.mic.unmute"), ptt: pttLine, on: game.i18n.localize("DRPG.Voice.mic.mute") };
    const line = reasonLine || infoLine || pttLine;
    const next = {
        state: mic.state,
        tip: tip[mic.state] ?? reasonLine,
        line,
        shown: Boolean(line) && (["held", "offline"].includes(mic.state) || Boolean(infoLine))
    };
    const last = paintedMic.get(tile) ?? {};
    const changed = Object.keys(next).filter(field => last[field] !== next[field]);
    if (!changed.length) return false;
    paintedMic.set(tile, next);

    if (changed.includes("state")) {
        for (const [cls, state] of [["is-held", "held"], ["is-gm-blocked", "gmBlock"], ["is-offline", "offline"],
            ["is-muted", "muted"], ["is-ptt", "ptt"]]) button.classList.toggle(cls, next.state === state);
        button.setAttribute("aria-pressed", String(next.state === "muted"));
        if (MIC_FREE.includes(next.state)) button.removeAttribute("aria-disabled");
        else button.setAttribute("aria-disabled", "true");
    }
    if (changed.includes("tip")) button.dataset.tooltipText = next.tip;
    if (changed.includes("line")) {
        note.textContent = next.line;
        if (next.line) button.setAttribute("aria-describedby", note.id);
        else button.removeAttribute("aria-describedby");
    }
    if (changed.includes("shown")) note.hidden = !next.shown;
    return true;
}

/**
 * Draw the speaker button: the count of people in this browser's Room (hidden at 0) and its line, and the strike
 * while Foundry's "mute all" is on. Writes only what changed.
 *
 * @param {HTMLElement} tile
 * @param {{count: number, muteAll: boolean}} facts
 * @returns {boolean}
 */
export function paintSpeakerButton(tile, { count, muteAll }) {
    const button = tile?.querySelector(".drpg-voice-speaker");
    const badge = button?.querySelector(".drpg-voice-count"), line = button?.querySelector(".drpg-voice-count-line");
    if (!badge || !line) return false;
    const n = Math.max(0, Number(count) || 0), struck = Boolean(muteAll);
    if (badge.textContent === (n ? String(n) : "") && button.classList.contains("is-muted") === struck) return false;
    button.classList.toggle("is-muted", struck);
    badge.textContent = n ? String(n) : "";
    badge.hidden = !n;
    line.textContent = n ? plural("DRPG.Voice.list.count", { n }) : "";
    if (n) button.setAttribute("aria-describedby", line.id);
    else button.removeAttribute("aria-describedby");
    button.dataset.tooltipText = line.textContent || game.i18n.localize("DRPG.Voice.list.open");
    return true;
}

/**
 * Both buttons of the watch's tile, and its list while it is open, from this browser's facts now.
 *
 * @param {object} [watch]
 * @param {object} [gone]  a participant the Room has just said left (`voiceStep`), not counted
 */
export function paintControls(watch = live, gone = null) {
    if (!watch?.tile) return;
    try {
        paintMic(watch.tile, micState());
        paintWord(watch, painted.get(watch.tile)?.face === true);
        paintSpeakerButton(watch.tile, { count: channelCount(watch, gone), muteAll: watch.muteAll() });
        if (watch.list && !watch.list.hidden) paintList(watch);
    } catch (err) {
        error("Could not draw the voice tile's buttons", err);
    }
}

/** A volume of 0..1, or `null` for anything that is not a number (a console writes these settings raw). */
function volumeOf(value) {
    return typeof value === "number" && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : null;
}

/** The volume this browser plays `userId` at: their `users.<id>.volume`, clamped; 1 where none is stored, as Foundry's default. */
function peerVolume(settings, userId) {
    return volumeOf(settings?.get?.("client", `users.${userId}.volume`)) ?? 1;
}

/**
 * The 'Mute for me' record as it may be trusted: `{ userId: the volume before the mute }` for ids that are users of
 * this world and volumes that are numbers, clamped to 0..1; anything else - a console's value, a user who is gone,
 * a record that is not an object - is no mute.
 *
 * @param {unknown} [raw]  the stored `voicePeerMutes`
 * @param {(id: string) => boolean} [isUser]
 * @returns {Record<string, number>}
 */
export function peerMutes(raw = PEER_MUTES.read(), isUser = id => Boolean(game.users?.get(id))) {
    const mutes = {};
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return mutes;
    for (const [id, before] of Object.entries(raw)) {
        const volume = volumeOf(before);
        if (volume !== null && isUser(id)) mutes[id] = volume;
    }
    return mutes;
}

/** Whether `userId` is muted for me: the record names them and their volume is 0 (a volume moved since is no mute). */
function mutedFor(mutes, settings, userId) {
    return Object.hasOwn(mutes, userId) && peerVolume(settings, userId) === 0;
}

/**
 * The slider's position for a volume, and the volume for a position: Foundry's own mapping, as the dock's slider
 * (`AudioHelper.volumeToInput` and `inputToVolume`, the design's reading of LiveKitClient.ts:1053, external), or
 * the value itself where Foundry has no such helper.
 *
 * @param {number} volume
 * @returns {number}
 */
export function sliderOfVolume(volume) {
    const value = volumeOf(volume) ?? 1, helper = foundry.audio?.AudioHelper;
    return volumeOf(typeof helper?.volumeToInput === "function" ? helper.volumeToInput(value) : value) ?? value;
}

/**
 * @param {string|number} input  a slider's value
 * @returns {number|null}
 */
export function volumeOfSlider(input) {
    const value = volumeOf(Number(input)), helper = foundry.audio?.AudioHelper;
    if (value === null) return null;
    return volumeOf(typeof helper?.inputToVolume === "function" ? helper.inputToVolume(value) : value);
}

/** `userId`'s `<audio>` elements in the watch's dock. */
function audioOf(watch, userId) {
    return [...(watch.dock()?.querySelectorAll?.(AUDIO) ?? [])].filter(el => el.closest(".camera-view")?.dataset.user === userId);
}

/**
 * The one writer of a remote user's volume in this browser: only for a participant of the watch's own Room, clamped
 * to 0..1, into their `<audio>` element at once (unless proximity-voice-chat sets it) and, with `save`, into this
 * browser's `users.<id>.volume`, which avclient-livekit reads at every attach (external) - a new Room and F5 keep it.
 *
 * @param {object} watch
 * @param {string} userId
 * @param {number} volume
 * @param {object} [options]
 * @param {boolean} [options.save]  false while the slider moves: the element only
 * @returns {Promise<boolean>} whether it set anything
 */
export async function setPeerVolume(watch, userId, volume, { save = true } = {}) {
    const value = volumeOf(volume);
    if (!watch || value === null || !inRoom(watch, userId)) return false;
    if (!watch.proximity()) for (const audio of audioOf(watch, userId)) audio.volume = value;
    if (!save) return true;
    const settings = watch.settings();
    if (typeof settings?.set !== "function") return false;
    await settings.set("client", `users.${userId}.volume`, value);
    return true;
}

/**
 * The slider let go (or paused): the new volume, and a participant muted for me heard again at it.
 *
 * @returns {Promise<boolean>}
 */
export async function moveVolume(watch, userId, volume) {
    if (!watch || volumeOf(volume) === null || !inRoom(watch, userId)) return false;
    const mutes = peerMutes(watch.mutes.read());
    if (Object.hasOwn(mutes, userId)) {
        delete mutes[userId];
        await watch.mutes.write(mutes);
    }
    return setPeerVolume(watch, userId, volume);
}

/**
 * 'Mute for me', and back: the volume before kept in the record and the volume set to 0; unmuted, the volume
 * before put back (1 when it was 0) and the record forgets them. Only for a participant of the watch's own Room.
 *
 * @returns {Promise<boolean>}
 */
export async function toggleMuteFor(watch, userId) {
    if (!watch || !inRoom(watch, userId)) return false;
    const settings = watch.settings(), mutes = peerMutes(watch.mutes.read());
    if (mutedFor(mutes, settings, userId)) {
        const before = mutes[userId] > 0 ? mutes[userId] : 1;
        delete mutes[userId];
        await watch.mutes.write(mutes);
        return setPeerVolume(watch, userId, before);
    }
    const now = peerVolume(settings, userId);
    mutes[userId] = now > 0 ? now : 1;
    await watch.mutes.write(mutes);
    return setPeerVolume(watch, userId, 0);
}

/** Foundry's "mute all" of this browser (`muteAll`), flipped - the dock's own button's write. */
export async function toggleMuteAll(watch = live) {
    const settings = watch?.settings();
    if (typeof settings?.set !== "function") return false;
    await settings.set("client", "muteAll", !watch.muteAll());
    return true;
}

/** A participant hidden earlier in the dock (`users.<id>.blocked`), shown and heard again; only one of the own Room. */
export async function unhidePeer(watch, userId) {
    const settings = watch?.settings();
    if (!watch || !inRoom(watch, userId) || typeof settings?.set !== "function") return false;
    await settings.set("client", `users.${userId}.blocked`, false);
    return true;
}

/** The line a GM reads where the module holds a microphone: a secret death named as one, anything else plainly. */
function heldLine(hold) {
    return game.i18n.localize(hold?.reason === "secretDead" ? "DRPG.Voice.list.gmSecretDead" : "DRPG.Voice.list.gmHeld");
}

/**
 * The GM's block of `user`'s microphone for everybody, or its lifting: Foundry's own write, the user document's
 * `permissions.BROADCAST_AUDIO` flipped from what Foundry answers now (`canBroadcastAudio`, the dock's own reading).
 * Only on a GM's client, only for a user of this world, and never where `moduleHoldsMic` holds the microphone - asked
 * here, at the click, from the world's facts, whatever the button said; refused, it writes nothing and says why.
 *
 * @param {User} user
 * @param {object} [options]  handed in by R539
 * @param {(user: User) => object|null} [options.holds]
 * @param {object} [options.settings]  Foundry's `game.webrtc.settings`
 * @param {(text: string) => void} [options.notify]
 * @returns {Promise<boolean>} whether it wrote
 */
export async function toggleBlock(user, { holds = target => moduleHoldsMic(target), settings = game.webrtc?.settings,
    notify = text => ui.notifications?.warn(text) } = {}) {
    if (!game.user?.isGM) return false;
    if (!user?.id || user.id === game.user.id || game.users.get(user.id) !== user) return false;
    const hold = holds(user);
    if (hold?.held) {
        notify(heldLine(hold));
        return false;
    }
    const allowed = settings?.getUser?.(user.id)?.canBroadcastAudio ?? true;
    await user.update({ "permissions.BROADCAST_AUDIO": !allowed });
    return true;
}

/** Run a change the list asked for, then draw the list again; a failure is logged, never thrown into a listener. */
function listAct(watch, fn) {
    Promise.resolve().then(fn).then(() => paintList(watch)).catch(err => error("Could not change what you hear", err));
}

/** A button of a row: a pixel glyph and a label, 44 px to touch (the design's). */
function rowButton(className, name) {
    const button = textNode("button", className, "");
    button.type = "button";
    button.append(glyph(name));
    return button;
}

/** One row's elements and their listeners, for `userId`; `paintList` fills them. */
function listRow(watch, userId) {
    const row = textNode("li", "drpg-voice-row", "");
    row.dataset.userId = userId;
    const art = textNode("span", "drpg-voice-row-art", "");
    art.setAttribute("aria-hidden", "true");
    const dot = textNode("span", "drpg-voice-row-dot", "");
    dot.setAttribute("aria-hidden", "true");
    const slider = document.createElement("input");
    Object.assign(slider, { type: "range", className: "drpg-voice-row-volume", min: "0", max: "1", step: String(VOLUME_STEP) });
    slider.addEventListener("input", () => {
        const volume = volumeOfSlider(slider.value);
        setPeerVolume(watch, userId, volume, { save: false }).catch(err => error("Could not change a volume", err));
        const pending = watch.saves.get(userId);
        if (pending !== undefined) watch.clock.clearTimeout(pending);
        watch.saves.set(userId, watch.clock.setTimeout(() => {
            watch.saves.delete(userId);
            listAct(watch, () => moveVolume(watch, userId, volume));
        }, VOLUME_SAVE_MS));
    });
    slider.addEventListener("change", () => {
        const pending = watch.saves.get(userId);
        if (pending !== undefined) watch.clock.clearTimeout(pending);
        watch.saves.delete(userId);
        listAct(watch, () => moveVolume(watch, userId, volumeOfSlider(slider.value)));
    });
    const mute = rowButton("drpg-voice-row-mute", "sound");
    mute.addEventListener("click", () => listAct(watch, () => toggleMuteFor(watch, userId)));
    const hidden = textNode("span", "drpg-voice-row-hidden", game.i18n.localize("DRPG.Voice.list.hidden"));
    const unhide = textNode("button", "drpg-voice-row-unhide", game.i18n.localize("DRPG.Voice.list.unhide"));
    unhide.type = "button";
    unhide.addEventListener("click", () => listAct(watch, () => unhidePeer(watch, userId)));
    hidden.hidden = unhide.hidden = true;
    row.append(art, textNode("span", "drpg-voice-row-name", ""), dot, slider, mute, hidden, unhide);
    return row;
}

/** The GM's block button of a row, and the line that says why it is held. Built only for a GM's list. */
function blockParts(watch, userId) {
    const button = rowButton("drpg-voice-row-block", "lock");
    button.addEventListener("click", () => listAct(watch, () => toggleBlock(game.users.get(userId))));
    const why = textNode("span", "drpg-voice-row-held", "");
    why.id = `drpg-voice-held-${++tiles}`;
    why.hidden = true;
    return [button, why];
}

/** The portrait path each row's art layer shows, so a paint writes it only when it changes. */
const paintedArt = new WeakMap();

/** Write an attribute, a text or a flag only where it differs from what is drawn (the tile's rule: R536 counts it). */
function putAttr(el, name, value) {
    if (value === null) el.removeAttribute(name);
    else if (el.getAttribute(name) !== value) el.setAttribute(name, value);
}
function putText(el, text) {
    if (el.textContent !== text) el.textContent = text;
}
function putHidden(el, hidden) {
    if (el.hidden !== hidden) el.hidden = hidden;
}

/**
 * Draw the list of the watch: a row per remote participant of its Room, in the order of their names, each row kept
 * from one paint to the next (a focused slider keeps its focus and its value); the top's "mute all"; the line for
 * nobody. For a GM each row has the block, disabled with its reason where `holds` answers a hold.
 *
 * @param {object} [watch]
 * @param {object} [options]
 * @param {(user: User) => object|null} [options.holds]  `moduleHoldsMic`; R539 hands in its own
 * @returns {number} the rows drawn
 */
export function paintList(watch = live, { holds = user => moduleHoldsMic(user) } = {}) {
    const list = watch?.list, body = list?.querySelector(".drpg-voice-list-rows");
    if (!body) return 0;
    const settings = watch.settings(), mutes = peerMutes(watch.mutes.read()), gm = watch.gm() === true, room = watch.room;
    const ids = room?.state === "connected"
        ? [...new Set([...(room.remoteParticipants?.values?.() ?? [])].map(p => participantUser(watch.client, p, room)?.id).filter(Boolean))] : [];
    const people = ids.map(id => ({ id, user: watch.userOf(id) })).filter(p => p.user)
        .map(p => ({ ...p, who: voiceIdentity(p.user) ?? { name: p.user.name ?? "", img: null } }))
        .sort((a, b) => String(a.who.name).localeCompare(String(b.who.name)));

    putAttr(list.querySelector(".drpg-voice-list-muteall"), "aria-pressed", String(watch.muteAll() === true));
    // "Nobody else is in your channel" only when nobody is: a participant mapped to no user has no row, and is still
    // there (E78 fix r1-G1).
    putHidden(list.querySelector(".drpg-voice-list-alone"), people.length > 0 || channelCount(watch) > 0);
    const rows = new Map([...body.children].map(row => [row.dataset.userId, row]));
    for (const [id, row] of rows) if (!ids.includes(id)) row.remove();
    people.forEach(({ id, user, who }, at) => {
        const row = rows.get(id) ?? listRow(watch, id);
        if (body.children[at] !== row) body.insertBefore(row, body.children[at] ?? null);
        const name = String(who.name ?? "");
        putText(row.querySelector(".drpg-voice-row-name"), name);
        const image = voicePortrait(who);
        const art = row.querySelector(".drpg-voice-row-art");
        if (paintedArt.get(art) !== image) {
            paintedArt.set(art, image);
            if (image) art.style.setProperty("background-image", `url("${cssString(image)}")`);
            else art.style.removeProperty("background-image");
        }
        row.classList.toggle("is-speaking", watch.speakers.includes(id));

        const hidden = settings?.get?.("client", `users.${id}.blocked`) === true, muted = mutedFor(mutes, settings, id);
        const slider = row.querySelector(".drpg-voice-row-volume"), mute = row.querySelector(".drpg-voice-row-mute");
        putAttr(slider, "aria-label", game.i18n.format("DRPG.Voice.list.volume", { name }));
        if (slider.ownerDocument.activeElement !== slider && !watch.saves.has(id)) {
            const position = String(sliderOfVolume(peerVolume(settings, id)));
            if (slider.value !== position) slider.value = position;
        }
        const label = game.i18n.format(muted ? "DRPG.Voice.list.unmuteFor" : "DRPG.Voice.list.muteFor", { name });
        putAttr(mute, "aria-label", label);
        if (mute.dataset.tooltipText !== label) mute.dataset.tooltipText = label;
        putAttr(mute, "aria-pressed", String(muted));
        mute.classList.toggle("is-muted", muted);
        for (const el of [slider, mute]) putHidden(el, hidden);
        for (const el of row.querySelectorAll(".drpg-voice-row-hidden, .drpg-voice-row-unhide")) putHidden(el, !hidden);

        let block = row.querySelector(".drpg-voice-row-block"), why = row.querySelector(".drpg-voice-row-held");
        if (!gm) {
            block?.remove();
            why?.remove();
            return;
        }
        if (!block) {
            [block, why] = blockParts(watch, id);
            row.append(block, why);
        }
        const blocked = (settings?.getUser?.(id)?.canBroadcastAudio ?? true) === false;
        const hold = holds(user);
        const tip = game.i18n.format(blocked ? "DRPG.Voice.list.gmUnblock" : "DRPG.Voice.list.gmBlock", { name });
        putAttr(block, "aria-label", tip);
        if (block.dataset.tooltipText !== tip) block.dataset.tooltipText = tip;
        putAttr(block, "aria-pressed", String(blocked));
        block.classList.toggle("is-gm-blocked", blocked);
        if (block.disabled !== Boolean(hold?.held)) block.disabled = Boolean(hold?.held);
        putText(why, hold?.held ? heldLine(hold) : "");
        putHidden(why, !hold?.held);
        putAttr(block, "aria-describedby", hold?.held ? why.id : null);
    });
    return people.length;
}

/** The list's controls a keyboard can reach, in order. */
function listStops(list) {
    return [...list.querySelectorAll("button, input")].filter(el => !el.disabled && !el.closest("[hidden]"));
}

/**
 * The list's element for a watch, built once: a dialog labelled by its title, "mute all" at the top, the line for
 * nobody, the rows. Its keys are heard in the capture phase, before anything inside or behind it.
 */
function buildVoiceList(watch) {
    const list = textNode("section", "drpg-voice-list", "");
    list.id = watch.tile?.id === TILE_ID ? LIST_ID : `${LIST_ID}-${++tiles}`;
    list.hidden = true;
    list.setAttribute("role", "dialog");
    const title = textNode("h2", "drpg-voice-list-title", game.i18n.localize("DRPG.Voice.list.open"));
    title.id = `${list.id}-title`;
    list.setAttribute("aria-labelledby", title.id);
    const muteAll = textNode("button", "drpg-voice-list-muteall", game.i18n.localize("DRPG.Voice.list.muteAll"));
    muteAll.type = "button";
    muteAll.setAttribute("aria-pressed", "false");
    muteAll.addEventListener("click", () => listAct(watch, () => toggleMuteAll(watch)));
    const alone = textNode("p", "drpg-voice-list-alone", game.i18n.localize("DRPG.Voice.list.alone"));
    alone.hidden = true;
    list.append(title, muteAll, alone, textNode("ul", "drpg-voice-list-rows", ""));
    list.addEventListener("keydown", event => onListKey(watch, event), true);
    return list;
}

/** Escape closes the list and goes no further (Foundry's menu would open on it); Tab and Shift+Tab stay inside. */
function onListKey(watch, event) {
    if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeVoiceList(watch);
        return;
    }
    if (event.key !== "Tab") return;
    const stops = listStops(watch.list), at = watch.list.ownerDocument.activeElement;
    if (!stops.length) return;
    const to = event.shiftKey ? (at === stops[0] ? stops.at(-1) : null) : (at === stops.at(-1) ? stops[0] : null);
    if (!to) return;
    event.preventDefault();
    to.focus();
}

/** Beside the tile, on its left (the tile stands at the right wall), its top at the tile's top, 8 px inside the screen. */
function placeVoiceList(watch) {
    const list = watch.list, tile = watch.tile.getBoundingClientRect(), box = list.getBoundingClientRect(), gap = 8;
    const x = Math.max(gap, Math.min(tile.left - box.width - gap, window.innerWidth - box.width - gap));
    const y = Math.max(gap, Math.min(tile.top, window.innerHeight - box.height - gap));
    list.style.left = `${Math.round(x)}px`;
    list.style.top = `${Math.round(y)}px`;
}

/**
 * Open the watch's list: drawn, placed, the speaker button `aria-expanded`, the focus on its first control, and a
 * pointer anywhere else closes it. It cuts nothing of the curtain and fires no `drpgGlassCut`.
 *
 * @param {object} [watch]
 * @returns {HTMLElement|null}
 */
export function openVoiceList(watch = live) {
    const speaker = watch?.tile?.querySelector(".drpg-voice-speaker");
    if (!speaker) return null;
    watch.list ??= buildVoiceList(watch);
    const list = watch.list;
    if (!list.isConnected) document.body.append(list);
    paintList(watch);
    list.hidden = false;
    speaker.setAttribute("aria-expanded", "true");
    speaker.setAttribute("aria-controls", list.id);
    placeVoiceList(watch);
    watch.away ??= event => {
        if (!list.contains(event.target) && !speaker.contains(event.target)) closeVoiceList(watch);
    };
    document.addEventListener("pointerdown", watch.away, true);
    listStops(list)[0]?.focus();
    return list;
}

/**
 * Close the watch's list and give the focus back to its speaker button.
 *
 * @param {object} [watch]
 * @param {object} [options]
 * @param {boolean} [options.focus]  false when the tile goes
 * @returns {boolean} whether it was open
 */
export function closeVoiceList(watch = live, { focus = true } = {}) {
    const list = watch?.list;
    if (!list || list.hidden) return false;
    list.hidden = true;
    if (watch.away) document.removeEventListener("pointerdown", watch.away, true);
    const speaker = watch.tile?.querySelector(".drpg-voice-speaker");
    speaker?.setAttribute("aria-expanded", "false");
    if (focus) speaker?.focus();
    return true;
}

/** The speaker button's click: the list opened, or closed when it is open. */
export function toggleVoiceList(watch = live) {
    if (watch?.list && !watch.list.hidden) return closeVoiceList(watch);
    return Boolean(openVoiceList(watch));
}

/**
 * The `toggleMute` key: the viewer's own microphone through `toggleOwnMic`, as the button's click. Nothing, and
 * the key left to whatever else is bound to it, where this world has no voice.
 *
 * @param {object} [options]  handed in by R537
 * @returns {boolean} whether the key was taken
 */
export function onMuteKey({ available = voiceAvailable(), toggle = () => toggleOwnMic() } = {}) {
    if (!available) return false;
    Promise.resolve().then(toggle).catch(err => error("Could not change your microphone", err));
    return true;
}

/**
 * Register the `toggleMute` key (module.mjs `init`, where Foundry takes keybindings). No default key, as the
 * safeword's and the notice history's have none: a key the module chose would be one a table already uses.
 *
 * @param {object} [keybindings]  Foundry's `game.keybindings`; R537's spy
 * @param {() => boolean} [onKey]
 */
export function registerVoiceKeybinding(keybindings = game.keybindings, onKey = () => onMuteKey()) {
    try {
        keybindings.register(MODULE_ID, "toggleMute", {
            name: "DRPG.Voice.mic.keybinding", editable: [], onDown: () => onKey(),
            restricted: false, precedence: CONST.KEYBINDING_PRECEDENCE?.NORMAL ?? 1
        });
    } catch (err) {
        error("Could not register the microphone's keybinding", err);
    }
}

/** avclient-livekit's client, when it is the A/V client (external; voice-client.mjs reads the same field). */
function liveKitClient() {
    return game.webrtc?.client?._liveKitClient ?? null;
}

/**
 * Put the tile and the dock in step with the world: the tile drawn and following this client's current Room,
 * and the dock hidden, while voice is available and `voiceTile` is on; otherwise no tile and Foundry's dock.
 * Run at `ready`, on every `liveKitClientInitialized` (a new Room), on `rtcSettingsChanged` (a volume, a mute
 * or `muteAll` changes who is heard) and from the setting's `onChange`.
 *
 * @param {object|null} [client]
 */
export function refreshVoiceTile(client = liveKitClient()) {
    try {
        const available = voiceAvailable();
        const on = getSetting(SETTINGS.voiceTile) !== false;
        applyDockHidden(dockHiddenFor(available, on));
        if (!available || !on) {
            dropVoiceTile();
            return;
        }
        const tile = ensureVoiceTile();
        if (live?.tile !== tile) {
            detachRoom(live);
            live = voiceWatch(tile, { controls: paintControls });
        }
        if (live.client !== client || live.room !== (client?.liveKitRoom ?? null)) attachRoom(client, live);
        else voiceStep(live);
        paintControls(live);
    } catch (err) {
        error("Could not draw the voice tile", err);
    }
}

/** No tile: the list closed and gone, the Room left, the timers stopped and the element gone. */
function dropVoiceTile() {
    closeVoiceList(live, { focus: false });
    live?.list?.remove();
    detachRoom(live);
    live = null;
    const tile = document.getElementById(TILE_ID);
    if (!tile) return;
    tile.remove();
    seatVoiceArt();
    recutForTile();
}

/**
 * The tile's triggers (module.mjs `ready`). The hook's argument is avclient-livekit's client; the field on
 * `game.webrtc.client` is read first, as voice-client.mjs reads it, and the argument only when that is absent. The
 * viewer's own user changing (a GM's block is a permission on it) repaints the buttons and the state word, anybody
 * else's an open list (the GM's block on them); voice-client.mjs moving the Room (`drpgVoiceApplying`, E79 C15) the
 * state word; a client setting - a mute, a volume, the voice mode - comes through
 * `rtcSettingsChanged`, which also tells the sound launcher about "mute all" (sfx.mjs, the design's F5).
 */
export function registerVoiceTile() {
    Hooks.on("liveKitClientInitialized", client => refreshVoiceTile(liveKitClient() ?? client ?? null));
    Hooks.on("rtcSettingsChanged", () => {
        refreshVoiceTile();
        import("./sfx.mjs").then(m => m.refreshSoundLauncher()).catch(err => error("Could not draw the sound launcher", err));
    });
    Hooks.on("updateUser", user => {
        if (user?.id === game.user?.id) paintControls();
        else if (live?.list && !live.list.hidden) paintList(live);
    });
    Hooks.on("drpgVoiceApplying", () => onVoiceApplying());
    refreshVoiceTile();
}
