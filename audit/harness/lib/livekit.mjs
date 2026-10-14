/**
 * A LiveKit room for the harness (E78 C1, 13.10.2026; the E78 plan's 2.2 and Correction 10).
 * ---------------------------------------------------------------------------
 * Until E78 the harness's `game.webrtc` was a bare stand-in with no `_liveKitClient` at all
 * (client-entry.mjs, the `webrtc` block), so every reading of avclient-livekit's client in the
 * module found nothing and voice-client.mjs settled as "unavailable" on every client. The voice
 * tile E78 builds reads a LiveKit `Room` - who is in this browser's own room, and who of them is
 * speaking - so the scenario that holds it (75-voice-tile) needs one. This is that room, and only
 * as much of avclient-livekit's client as the voice tile reads. Nothing installs it but a scenario
 * that asks (`globalThis.__liveKit.install()` inside an eval, client-entry.mjs), so every other
 * scenario and the suite boot exactly as before.
 *
 * WHAT IT IS MODELLED ON, AND WHAT OF THAT WAS READ. avclient-livekit 0.6.8's and Foundry 14.365's
 * own files are not on this machine (foundryvtt.com is blocked here); every name below is the A9
 * design's reading of them on 11.10.2026 (e78-design/design.md CB-6, CB-7, CB-15, P2-0; external
 * rows of e78-design/anchors.md), not re-read:
 *   - `game.webrtc.client._liveKitClient` is avclient-livekit's client; its `liveKitRoom` is a
 *     livekit-client `Room`, and `initializeRoom` makes a NEW Room at every `initialize()`, which
 *     `AVMaster#connect()` calls on every connect - every room switch (CB-15);
 *   - it fires `liveKitClientInitialized` at the end of `initialize()` (CB-15; voice-client.mjs
 *     listens for it since before E78). The shim hands the hook its `_liveKitClient`, as the
 *     design's `attachRoom(client)` reads it (P2-0);
 *   - `getParticipantFVTTUser(participant)` maps a participant to its Foundry user (LiveKitClient.ts
 *     :417-422 as the design cites it). How avclient-livekit encodes the user in the participant is
 *     not read here: the shim keeps the user's id on the participant and answers from it, and
 *     only a table (the owner's T1) checks the mapping;
 *   - the Room emits `activeSpeakersChanged` (loudest first), `participantConnected`,
 *     `participantDisconnected`, `connectionStateChanged` and `disconnected` (CB-15, P2-0);
 *   - the sound is an `<audio class="user-microphone-audio">` in `.camera-view[data-user]` of the
 *     camera dock (CB-6), and every attach writes its `volume` from the client setting
 *     `users.<id>.volume` (1 when unset) and its `muted` from `muteAll` (CB-7, LiveKitClient.ts
 *     :274-280) - which is how a local mute would be undone by a re-attach, what R538 holds.
 *
 * WHAT IT CANNOT SETTLE (the plan's 2.2; D26 = 3): real audio, how late LiveKit says somebody is
 * speaking, Foundry's own rules against a hidden dock at a table, audio from a hidden dock after F5,
 * and avclient-livekit's private API after 0.6.8 - LIVE-E78-01, LIVE-E78-07 and the owner's T1 (LIVE-E78-10). Where the real
 * behaviour is not known the shim lets a call through rather than refusing it: `toggleAudio` is
 * recorded and does nothing else, and the audio element plays as soon as it is attached (autoplay at
 * a table is T1's second item).
 *
 * TWO CHOICES OF THE SHIM'S OWN, not readings: (1) a Room's participants that are there when it
 * connects come with the connect, without a `participantConnected` each - a reader takes them from
 * `remoteParticipants` after it attached, and only a participant who joins later is announced;
 * (2) a new `initialize()` disconnects the Room it replaces first (`disconnected` on the old Room,
 * then the hook with the new one), since a switch of rooms is a disconnect and a reconnect
 * (voice-client.mjs `applyBreakout`'s own words).
 */
import { getProperty, setProperty } from "./futil.mjs";

/** The room a client stands in when nobody gave it a breakout: not one of the module's `drpg-` rooms. */
export const MAIN_ROOM = "harness-main-room";

/** livekit-client's Room is an EventEmitter: `on`, `once`, `off` (and its alias), `emit`, `listenerCount`. */
class Emitter {
    #handlers = new Map();
    on(event, fn) {
        if (!this.#handlers.has(event)) this.#handlers.set(event, []);
        this.#handlers.get(event).push(fn);
        return this;
    }
    once(event, fn) {
        const wrapped = (...args) => { this.off(event, wrapped); fn(...args); };
        return this.on(event, wrapped);
    }
    off(event, fn) {
        const list = this.#handlers.get(event) ?? [];
        const at = list.indexOf(fn);
        if (at >= 0) list.splice(at, 1);
        return this;
    }
    removeListener(event, fn) { return this.off(event, fn); }
    listenerCount(event) { return (this.#handlers.get(event) ?? []).length; }
    emit(event, ...args) {
        const list = [...(this.#handlers.get(event) ?? [])];
        for (const fn of list) fn(...args);
        return list.length > 0;
    }
}

class Participant {
    constructor(userId, isLocal) {
        this.identity = userId;
        this.sid = `PA_${userId}`;
        this.isLocal = isLocal;
        this.isSpeaking = false;
        this.audioLevel = 0;
        /** The shim's own record of whose participant this is (see the header: the real encoding is not read). */
        this.fvttUserId = userId;
    }
}

class Room extends Emitter {
    constructor(serial) {
        super();
        this.serial = serial;
        this.name = null;
        this.state = "disconnected";
        this.localParticipant = new Participant(game.user.id, true);
        this.remoteParticipants = new Map();
        this.activeSpeakers = [];
    }
}

/**
 * Install the shim on this client's `game.webrtc`. Returns the controller a scenario drives - it is
 * also `globalThis.__liveKit` (client-entry.mjs). The world's A/V mode becomes audio-only (the
 * owner's Q11), since at DISABLED voice-client.mjs and voice.mjs stop before any room is read.
 * `roster` names who stands in each room, `{ [room]: [userId, ...] }`; a room it does not name holds
 * every user Foundry says is connected. A scenario knows where everybody is; the shim of one browser
 * cannot ask the others.
 */
export function installLiveKit({ roster = {} } = {}) {
    const webrtc = game.webrtc;
    const settings = webrtc.settings;
    const state = { roster: { ...roster }, rooms: 0, toggles: [], attaches: 0 };

    /* Foundry's AVSettings: `get` reads, `set` writes the scope's object, `getUser` a user's client row
       (the harness's own `set` wrote nothing; nothing read it back until the voice tile). Whether
       Foundry fires `rtcSettingsChanged` with these arguments is not read here: it is fired, so a
       listener is not starved of the change, and C5's readings say what they rely on. */
    settings.client.users ??= {};
    settings.set = (scope, key, value) => {
        setProperty(settings[scope], key, value);
        Hooks.callAll("rtcSettingsChanged", settings, { [scope]: { [key]: value } });
    };
    settings.getUser = userId => {
        if (!game.users.get(userId)) return null;
        settings.client.users[userId] ??= { volume: 1, muted: false, hidden: false, blocked: false, popout: false };
        return settings.client.users[userId];
    };
    webrtc.mode = foundry.av.AVSettings.AV_MODES.AUDIO;
    settings.world.mode = foundry.av.AVSettings.AV_MODES.AUDIO;

    const dock = () => {
        let el = document.getElementById("camera-views");
        if (!el) {
            el = document.createElement("section");
            el.id = "camera-views";
            el.className = "camera-views";
            document.body.append(el);
        }
        return el;
    };

    const viewOf = userId => [...dock().querySelectorAll(".camera-view[data-user]")].find(v => v.dataset.user === userId) ?? null;

    function attachAudioTrack(userId, track, audioElement) {
        state.attaches++;
        const volume = Number(settings.get("client", `users.${userId}.volume`) ?? 1);
        audioElement.volume = Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 1;
        audioElement.muted = settings.get("client", "muteAll") === true;
        Object.defineProperty(audioElement, "srcObject", { configurable: true, value: track.stream });
        Object.defineProperty(audioElement, "paused", { configurable: true, get: () => track.ended });
    }

    function trackFor(userId) {
        const media = { kind: "audio", id: `TR_${userId}`, readyState: "live", enabled: true };
        const track = { kind: "audio", mediaStreamTrack: media, ended: false };
        track.stream = { id: `MS_${userId}`, getAudioTracks: () => [media], getTracks: () => [media] };
        return track;
    }

    function showRemote(userId) {
        let view = viewOf(userId);
        if (!view) {
            view = document.createElement("div");
            view.className = "camera-view";
            view.dataset.user = userId;
            const video = document.createElement("video");
            video.className = "user-camera";
            video.hidden = true;
            view.append(video);
            dock().append(view);
        }
        let audio = view.querySelector("audio.user-microphone-audio");
        if (!audio) {
            audio = document.createElement("audio");
            audio.className = "user-microphone-audio";
            view.append(audio);
        }
        attachAudioTrack(userId, trackFor(userId), audio);
    }

    const hideRemote = userId => viewOf(userId)?.remove();

    const membersOf = name => {
        const listed = state.roster[name];
        const ids = Array.isArray(listed) ? listed : game.users.filter(u => u.active).map(u => u.id);
        return ids.filter(id => id !== game.user.id && game.users.get(id));
    };

    const liveKitClient = {
        initState: "uninitialized",
        connectionState: "disconnected",
        liveKitRoom: null,
        breakoutRoom: undefined,
        audioBroadcastEnabled: true,
        getParticipantFVTTUser(participant) {
            return game.users.get(participant?.fvttUserId) ?? undefined;
        },
        attachAudioTrack
    };

    function leaveRoom(room) {
        if (!room || room.state === "disconnected") return;
        for (const id of room.remoteParticipants.keys()) hideRemote(id);
        room.remoteParticipants.clear();
        room.activeSpeakers = [];
        room.state = "disconnected";
        liveKitClient.connectionState = "disconnected";
        room.emit("connectionStateChanged", "disconnected");
        room.emit("disconnected");
    }

    const client = webrtc.client;
    client._liveKitClient = liveKitClient;
    client.room = null;
    client.initialize = async () => {
        liveKitClient.initState = "initializing";
        leaveRoom(liveKitClient.liveKitRoom);
        liveKitClient.liveKitRoom = new Room(++state.rooms);
        liveKitClient.initState = "initialized";
        Hooks.callAll("liveKitClientInitialized", liveKitClient);
        return true;
    };
    client.connect = async () => {
        const room = liveKitClient.liveKitRoom;
        if (!room) return false;
        const name = liveKitClient.breakoutRoom ?? MAIN_ROOM;
        client.room = name;
        room.name = name;
        room.state = "connected";
        liveKitClient.connectionState = "connected";
        for (const id of membersOf(name)) {
            room.remoteParticipants.set(id, new Participant(id, false));
            showRemote(id);
        }
        room.emit("connectionStateChanged", "connected");
        return true;
    };
    client.disconnect = async () => {
        leaveRoom(liveKitClient.liveKitRoom);
        client.room = null;
        return true;
    };
    client.toggleAudio = enable => { state.toggles.push(Boolean(enable)); };
    // AVMaster#connect, as voice-client.mjs reads it: `client.initialize()` on every connect, then the client's connect.
    webrtc.connect = async () => {
        await client.initialize();
        return client.connect();
    };
    webrtc.disconnect = () => client.disconnect();

    const room = () => liveKitClient.liveKitRoom;
    return {
        installed: true,
        MAIN_ROOM,
        get rooms() { return state.rooms; },
        get attaches() { return state.attaches; },
        get toggles() { return [...state.toggles]; },
        /** Who stands where from now on; the next connect reads it, a Room already connected does not. */
        setRoster(next) { state.roster = { ...next }; },
        /** A user joins this client's Room: `participantConnected`, then their view and its audio, as the dock draws them. */
        join(userId) {
            const r = room();
            if (r?.state !== "connected" || userId === game.user.id || !game.users.get(userId) || r.remoteParticipants.has(userId)) return false;
            const participant = new Participant(userId, false);
            r.remoteParticipants.set(userId, participant);
            showRemote(userId);
            r.emit("participantConnected", participant);
            return true;
        },
        /** A user leaves this client's Room: `participantDisconnected`, and their view goes from the dock. */
        leave(userId) {
            const r = room(), participant = r?.remoteParticipants.get(userId);
            if (!participant) return false;
            r.remoteParticipants.delete(userId);
            r.activeSpeakers = r.activeSpeakers.filter(p => p !== participant);
            hideRemote(userId);
            r.emit("participantDisconnected", participant);
            return true;
        },
        /** Who is speaking now, loudest first (this client's own user may be among them); `[]` is silence. */
        speak(userIds) {
            const r = room();
            if (r?.state !== "connected") return [];
            const of = id => id === game.user.id ? r.localParticipant : r.remoteParticipants.get(id);
            const speakers = userIds.map(of).filter(Boolean);
            for (const p of [r.localParticipant, ...r.remoteParticipants.values()]) {
                const at = speakers.indexOf(p);
                p.isSpeaking = at >= 0;
                p.audioLevel = at >= 0 ? 1 - at / (speakers.length + 1) : 0;
            }
            r.activeSpeakers = speakers;
            r.emit("activeSpeakersChanged", speakers);
            return speakers.map(p => p.fvttUserId);
        },
        /** The connection is lost: the Room says so and empties; nothing reconnects until a connect. */
        drop() { leaveRoom(room()); },
        /** What a scenario reads of this browser's view of the room, as plain data. */
        read() {
            const r = room();
            return {
                initState: liveKitClient.initState,
                serial: r?.serial ?? null,
                state: r?.state ?? null,
                name: r?.name ?? null,
                remote: r ? [...r.remoteParticipants.values()].map(p => liveKitClient.getParticipantFVTTUser(p)?.id ?? null) : [],
                audio: [...dock().querySelectorAll(".camera-view[data-user]")].map(view => {
                    const el = view.querySelector("audio.user-microphone-audio");
                    return { user: view.dataset.user, audio: Boolean(el), volume: el?.volume ?? null, muted: el?.muted ?? null };
                })
            };
        }
    };
}
