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
 *   - A new speaker is shown after 250 ms of speech (`STICK_MS`), so a cough does not take the portrait. Whoever is
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
 * F5 and `display: none !important` against Foundry's own rules are the owner's T1 and LIVE-E78 rows.
 *
 * THE TWO BUTTONS (E78 C4, 13.10.2026; the design's steps 6 and 7, the owner's Q0, Q1, Q6 and Q15). The microphone
 * (`micState`, `paintMic`) is grey and struck through only when the MODULE holds it - `micHold`'s `held`, from this
 * browser's own facts (voice.mjs) - with the reason; a GM's block is struck in the normal colours with a lock, a lost
 * connection or avclient-livekit's own window is not struck and wears a dot, and a muted-by-me button is struck in
 * the normal colours. A click or the `toggleMute` key (`onMuteKey`, no default key) calls `toggleOwnMic`, which in
 * the three states the player cannot change writes nothing and says why, and otherwise writes the viewer's own
 * `users.<self>.muted` client setting and nothing else - Foundry's own dock button does that write and no more
 * (cameras.mjs:509-518 as the design read it, external), and the design reads avclient-livekit as moving the
 * microphone on that write itself, in push-to-talk too (LiveKitAVClient.ts:797-808, external; a LIVE-E78 row). The
 * module never calls `toggleAudio` (R544). The speaker button shows how many people share this browser's Room and
 * is struck while Foundry's "mute all" is on; the list it opens is E78 C5's.
 *
 * The tile sends no socket and no packet, writes no document and no world setting, and never touches an element's
 * volume or mute: it reads them; the one setting it writes is the viewer's own `muted`, on the viewer's own click or
 * key. Where it stands is an interim rule in danganronpa.css until E78 C6 cuts it a pane of the curtain.
 */

import { MODULE_ID } from "./config.mjs";
import { micHold } from "./voice.mjs";
import { SETTINGS, getSetting } from "./settings.mjs";
import { avclientActive } from "./voice-client.mjs";
import { voiceIdentity, measureCameraDock } from "./camera-view.mjs";
import { safeRoomImage } from "./vault.mjs";
import { cssString } from "./room-tile.mjs";
import { reducedMotion, TURN } from "./motion.mjs";
import { error, plural } from "./utils.mjs";

const TILE_ID = "drpg-voice-tile";

/** On `<body>` while the tile stands in for the dock: the dock and its popouts compute `display: none`. */
export const DOCK_HIDDEN_CLASS = "drpg-dock-hidden";

/** How long a new speaker speaks before the portrait is theirs (the design's sticky rule). */
export const STICK_MS = 250;

/** How long the portrait stays after its speaker leaves the Room's list (Q7). */
export const HOLD_MS = 1500;

/** A remote user's sound in the dock, as avclient-livekit 0.6.8 draws it (external; see the header). */
const AUDIO = ".camera-view[data-user] audio.user-microphone-audio";

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

/**
 * Whether this world can carry the tile: its A/V mode sends sound (not DISABLED, not VIDEO alone - the owner's
 * table is audio-only, Q11) and the A/V client is avclient-livekit's (`avclientActive`).
 *
 * @returns {boolean}
 */
export function voiceAvailable() {
    const MODES = foundry.av?.AVSettings?.AV_MODES ?? { DISABLED: 0, VIDEO: 2 };
    const mode = game.webrtc?.mode ?? game.webrtc?.settings?.world?.mode ?? MODES.DISABLED;
    return mode !== MODES.DISABLED && mode !== MODES.VIDEO && avclientActive();
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
    if (!tile.isConnected) document.body.append(tile);
    return tile;
}

/**
 * A tile's markup, built with `createElement` and `textContent` alone; loose, so the suite can paint one of its
 * own (R535, R536, R537, R540). The two buttons stand in the tile's corner, over the portrait (Q17), and stay when
 * nobody speaks (Q7); the note under them carries the microphone's line - the reason it is held, or a line of
 * information - and is shown only while that line is true. The speaker button opens nothing until E78 C5.
 *
 * @param {object} [options]
 * @param {() => unknown} [options.onMic]  what a click of the microphone does: `toggleOwnMic`; the suite's spy
 * @returns {HTMLElement}
 */
export function buildVoiceTile({ onMic = () => toggleOwnMic() } = {}) {
    const tile = document.createElement("section");
    const n = ++tiles;
    tile.className = "drpg-voice-tile";
    tile.dataset.state = "offline";
    tile.setAttribute("role", "region");
    tile.setAttribute("aria-label", game.i18n.localize("DRPG.Voice.tile.label"));

    const face = textNode("div", "drpg-voice-tile-face", "");
    face.hidden = true;
    const art = textNode("div", "drpg-voice-tile-art", "");
    art.setAttribute("aria-hidden", "true");
    const plate = textNode("div", "drpg-voice-tile-plate", "");
    const more = textNode("span", "drpg-voice-tile-more", "");
    more.hidden = true;
    plate.append(textNode("span", "drpg-voice-tile-speaking", game.i18n.localize("DRPG.Voice.tile.speaking")),
        textNode("span", "drpg-voice-tile-name", ""), more);
    face.append(art, plate);

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
    const note = textNode("p", "drpg-voice-tile-note", "");
    note.id = `drpg-voice-note-${n}`;
    note.hidden = true;
    const controls = textNode("div", "drpg-voice-tile-controls", "");
    controls.append(mic, speaker);

    tile.append(face, textNode("span", "drpg-voice-tile-nobody", game.i18n.localize("DRPG.Voice.tile.nobody")), controls, note);
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
 * @param {() => ParentNode} [options.dock]     where the users' `<audio>` elements are looked for
 * @param {() => boolean} [options.muteAll]     Foundry's "mute all" of this browser
 * @param {() => number} [options.fade]         the fade's length in ms; 0 under reduced motion
 * @param {(id: string) => User} [options.userOf] whose name and portrait a speaker's id is drawn with: the
 *   world's user; the suite gives a user a portrait of its own without touching a document (R536)
 * @param {(watch: object) => void} [options.controls]  what repaints the buttons after each step: `paintControls`
 *   on the screen's tile; nothing on the suite's, whose buttons R537 paints by hand
 */
export function voiceWatch(tile, { clock = realClock, dock = () => document,
    muteAll = () => game.webrtc?.settings?.client?.muteAll === true, fade = () => (reducedMotion() ? 0 : TURN()),
    userOf = id => game.users.get(id), controls = null } = {}) {
    return {
        tile, clock, dock, muteAll, fade, userOf, controls,
        client: null, room: null, detach: null,
        /** The Room's speakers this browser can map, loudest first, as user ids; and when each began. */
        speakers: [], since: new Map(),
        /** Who is drawn, and whether they are speaking, held after their speech, or fading. */
        shown: null, phase: "silent",
        timers: { stick: null, hold: null, fade: null }
    };
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
    voiceStep(watch);
}

/** The connection is gone: nobody, at once, and the offline state until the Room connects again. */
function onLost(watch) {
    resetSpeech(watch);
    voiceStep(watch);
}

/** Nobody speaking and nobody drawn, at once: the Room changed or the connection went. */
function resetSpeech(watch) {
    watch.speakers = [];
    watch.since.clear();
    for (const slot of Object.keys(watch.timers)) cancel(watch, slot);
    clearSpeaker(watch);
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
 * them and this browser hears them; otherwise the loudest speaker past `STICK_MS`; otherwise the hold, then the
 * fade. A speaker not yet past `STICK_MS` sets the timer that asks again. Whoever the Room no longer holds is
 * dropped first, and the portrait with them at once.
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
    const ready = heard.filter(id => id === watch.shown || now - (watch.since.get(id) ?? now) >= STICK_MS);
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
    paintSpeaker(watch, ready.filter(id => id !== watch.shown).length);
    watch.controls?.(watch);
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
 * Draw the watch's speaker on its tile: the name as `textContent`, the portrait as a checked path in the art
 * layer's `url()`, '+N' for the others this browser hears speaking, and the state the stylesheets read. Writes
 * only the fields that differ from what the tile shows; returns whether it wrote anything.
 *
 * @param {object} watch
 * @param {number} [more]  the other audible speakers past the sticky rule
 * @returns {boolean}
 */
function paintSpeaker(watch, more = 0) {
    const tile = watch.tile;
    const face = tile?.querySelector(".drpg-voice-tile-face");
    if (!face) return false;
    const user = watch.shown ? watch.userOf(watch.shown) : null;
    const who = user ? voiceIdentity(user) : null;
    const image = who?.img ? safeRoomImage(who.img) : null;
    const next = {
        state: watch.room?.state !== "connected" ? "offline" : who ? "speaking" : "silent",
        inChannel: String(channelCount(watch)),
        fading: Boolean(who) && watch.phase === "fading",
        name: who?.name ?? "",
        image,
        more: who ? more : 0
    };
    const last = painted.get(tile) ?? {};
    const changed = Object.keys(next).filter(key => last[key] !== next[key]);
    if (!changed.length) return false;
    painted.set(tile, next);

    if (changed.includes("state")) {
        tile.dataset.state = next.state;
        face.hidden = !who;
        const nobody = tile.querySelector(".drpg-voice-tile-nobody");
        if (nobody) nobody.hidden = Boolean(who);
    }
    if (changed.includes("inChannel")) tile.dataset.inChannel = next.inChannel;
    if (changed.includes("fading")) tile.classList.toggle("is-fading", next.fading);
    if (changed.includes("name")) {
        const name = face.querySelector(".drpg-voice-tile-name");
        if (name) name.textContent = next.name;
    }
    if (changed.includes("image")) {
        const art = face.querySelector(".drpg-voice-tile-art");
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

/** How many people this browser shares its Room with: the remote participants mapped to a user. */
function channelCount(watch) {
    const room = watch.room;
    if (room?.state !== "connected") return 0;
    return [...(room.remoteParticipants?.values?.() ?? [])].filter(p => participantUser(watch.client, p, room)).length;
}

/**
 * The microphone button's state, from this browser's own facts (E78 C4; the design's step 6, Q1, Q15): `micHold`
 * (voice.mjs, never GmStore) and this browser's client settings. One of
 *   - "held": the module holds the microphone (`micHold`'s `held`: the Eclipse room today; E19 and E67 add theirs) -
 *     grey and struck, the reason shown;
 *   - "gmBlock": a GM blocked it for everybody - struck in the normal colours, with a lock, never grey (Q15);
 *   - "offline": no connected Room, or avclient-livekit's own window ("external") - not struck, a dot, the reason shown;
 *   - "muted": the viewer muted it - struck in the normal colours, `aria-pressed`;
 *   - "ptt" or "on": open, "ptt" while Foundry's voice mode is push-to-talk.
 * `reason` names the line under `DRPG.Voice.held` for the first three; `info` is a reason that holds nothing
 * ("eclipseHeard": a Monocub alone in its Eclipse room, never grey - the design's P6), shown beside an open or muted
 * button. "Muted by me" is the stored `users.<self>.muted` - the value `toggleOwnMic` writes - and not `getUser`'s
 * answer, which Foundry may complete from the A/V client's own state (av/settings.mjs, external, not re-read here).
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
    if (settings?.get?.("client", `users.${game.user?.id}.muted`) === true) return { state: "muted", reason: null, info };
    return { state: settings?.client?.voice?.mode === "ptt" ? "ptt" : "on", reason: null, info };
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
function pushToTalkKey(keybindings = game.keybindings) {
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
    const reasonLine = mic.reason ? game.i18n.localize(`DRPG.Voice.held.${mic.reason}`) : "";
    const infoLine = mic.info ? game.i18n.localize(`DRPG.Voice.held.${mic.info}`) : "";
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

/** Both buttons of the watch's tile, from this browser's facts now. */
export function paintControls(watch = live) {
    if (!watch?.tile) return;
    try {
        paintMic(watch.tile, micState());
        paintSpeakerButton(watch.tile, { count: channelCount(watch), muteAll: watch.muteAll() });
    } catch (err) {
        error("Could not draw the voice tile's buttons", err);
    }
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

/** No tile: the Room left, the timers stopped and the element gone. */
function dropVoiceTile() {
    detachRoom(live);
    live = null;
    document.getElementById(TILE_ID)?.remove();
}

/**
 * The tile's triggers (module.mjs `ready`). The hook's argument is avclient-livekit's client; the field on
 * `game.webrtc.client` is read first, as voice-client.mjs reads it, and the argument only when that is absent. The
 * viewer's own user changing (a GM's block is a permission on it) repaints the buttons; a client setting - a mute,
 * the voice mode - comes through `rtcSettingsChanged`.
 */
export function registerVoiceTile() {
    Hooks.on("liveKitClientInitialized", client => refreshVoiceTile(liveKitClient() ?? client ?? null));
    Hooks.on("rtcSettingsChanged", () => refreshVoiceTile());
    Hooks.on("updateUser", user => {
        if (user?.id === game.user?.id) paintControls();
    });
    refreshVoiceTile();
}
