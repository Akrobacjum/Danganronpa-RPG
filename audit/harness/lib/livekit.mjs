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
 * CHOICES OF THE SHIM'S OWN, not readings: (1) a Room's participants that are there when it
 * connects come with the connect, without a `participantConnected` each - a reader takes them from
 * `remoteParticipants` after it attached, and only a participant who joins later is announced;
 * (2) a new `initialize()` disconnects the Room it replaces first (`disconnected` on the old Room,
 * then the hook with the new one), since a switch of rooms is a disconnect and a reconnect
 * (voice-client.mjs `applyBreakout`'s own words); (3) `client.room` is named before the connection
 * is tried, so a connect that fails leaves it naming the room it could not reach over a Room that
 * never connected (voice-client.mjs `landedCorrectly` reads `LiveKitAVClient#connect` as setting
 * `this.room`; where in the connect it does is not read).
 *
 * A TRANSPORT THAT FAILS (E19 C0, 19.10.2026; audit S11-56). Until C0 every connect here landed, so
 * no test could show what a dropped or refused connection does to a player's voice. Now:
 *   - `fail(mode)` makes every connect from then on fail as a table can see it: "refuse" (AVMaster's
 *     `connect()` answers false: a dead server, a rejected token), "throw" (the connect rejects), "main"
 *     (it lands in the main room whatever `breakoutRoom` says, as a connect already in flight answers
 *     with its own room); `fail(null)` lets connects through again;
 *   - `drop()` loses the connection and keeps `client.room` and `breakoutRoom`, as the module reads
 *     avclient-livekit's `onDisconnected` (voice-client.mjs `startSelfCheck`): the name says a room,
 *     the Room under it is "disconnected" and nothing reconnects;
 *   - avclient-livekit's client setting `useExternalAV` (this browser sends its audio from LiveKit's own
 *     web page) is registered where the module reads it (voice.mjs `externalAV`), as a client Boolean
 *     shown in the settings (the shim's guess, see below), false unless the install says otherwise
 *     (`external`). That value is registered as the default, so the install stores nothing;
 *   - `names` installs a later avclient-livekit whose client field or setting was renamed (`client`
 *     for `_liveKitClient`, `external` for `useExternalAV`), so a test reads what the module does when
 *     a name it relies on is gone;
 *   - `uninstall()` puts this browser back as it found it: the Room left (its listeners hear the
 *     `disconnected`), every field the install set on `game.webrtc`, its settings and `ui.webrtc` put
 *     back or removed, the setting it registered unregistered and the dock it drew removed. A value
 *     written to the setting through `game.settings.set` stays in the harness's store: nothing here
 *     writes one. client-entry.mjs's stub is the caller's to put back (`globalThis.__liveKit`).
 * avclient-livekit's real registration (its scope, `config`, any `onChange`) and its real failures
 * are not read on this machine, and a dropped connection at a real table is not measured here.
 *
 * WHY A ROOM SAYS IT LEFT (E19 C2, 19.10.2026). The Room's `disconnected` carries livekit-client's
 * DisconnectReason, as voice-client.mjs reads it: a leave this browser asked for - a new `initialize()`,
 * `disconnect()` - says CLIENT_INITIATED (1), and `drop(reason)` says what it is handed, null by default (a
 * server gone or a network lost, which livekit-client names otherwise; the numbers are voice-client.mjs's
 * reading, not livekit-client's source read here).
 */
import { getProperty, setProperty } from "./futil.mjs";

/** The room a client stands in when nobody gave it a breakout: not one of the module's `drpg-` rooms. */
export const MAIN_ROOM = "harness-main-room";

/** avclient-livekit's id, the namespace of its settings. */
const AV_MODULE = "avclient-livekit";

/** The ways `fail` can make a connect fail (the header's list). */
const FAILS = ["refuse", "throw", "main"];

/** livekit-client's DisconnectReason for a leave the browser asked for, as voice-client.mjs reads it (the header). */
const CLIENT_INITIATED = 1;

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
 * cannot ask the others. `external` and `names` are the header's (E19 C0).
 */
export function installLiveKit({ roster = {}, external = false, names = {} } = {}) {
    const webrtc = game.webrtc;
    const settings = webrtc.settings;
    const state = { roster: { ...roster }, rooms: 0, toggles: [], attaches: 0, fail: null };
    const CLIENT_FIELD = names.client ?? "_liveKitClient";
    const EXTERNAL_KEY = names.external ?? "useExternalAV";

    /* What `uninstall` puts back, newest first: each field as it was (its descriptor), or gone when it was not there. */
    const undo = [];
    const keep = (obj, key) => {
        const had = Object.getOwnPropertyDescriptor(obj, key);
        undo.push(() => (had ? Object.defineProperty(obj, key, had) : delete obj[key]));
    };
    const put = (obj, key, value) => {
        keep(obj, key);
        obj[key] = value;
    };
    let drawnDock = null;

    const externalFull = `${AV_MODULE}.${EXTERNAL_KEY}`;
    if (!game.settings.settings.has(externalFull)) {
        game.settings.register(AV_MODULE, EXTERNAL_KEY, {
            name: "Use external AV client", scope: "client", config: true, type: Boolean, default: Boolean(external)
        });
        undo.push(() => game.settings.settings.delete(externalFull));
    }

    /* Foundry's AVSettings: `get` reads, `set` writes the scope's object, `getUser` a user's client row
       (the harness's own `set` wrote nothing; nothing read it back until the voice tile). Whether
       Foundry fires `rtcSettingsChanged` with these arguments is not read here: it is fired, so a
       listener is not starved of the change, and C5's readings say what they rely on. */
    if (!settings.client.users) put(settings.client, "users", {});
    /* The camera dock's fold, which enforced.mjs's `rtcDock` row writes while the stand-in makes this an
       audio world with LiveKit (E19 C1): put back as found, as `users` is. */
    keep(settings.client, "hideDock");
    put(settings, "set", (scope, key, value) => {
        setProperty(settings[scope], key, value);
        Hooks.callAll("rtcSettingsChanged", settings, { [scope]: { [key]: value } });
    });
    put(settings, "getUser", userId => {
        if (!game.users.get(userId)) return null;
        settings.client.users[userId] ??= { volume: 1, muted: false, hidden: false, blocked: false, popout: false };
        return settings.client.users[userId];
    });
    put(webrtc, "mode", foundry.av.AVSettings.AV_MODES.AUDIO);
    put(settings.world, "mode", foundry.av.AVSettings.AV_MODES.AUDIO);

    const dock = () => {
        let el = document.getElementById("camera-views");
        if (!el) {
            el = document.createElement("section");
            el.id = "camera-views";
            el.className = "camera-views";
            document.body.append(el);
            drawnDock = el;
        }
        return el;
    };
    /* Foundry's CameraViews as far as the voice tile reads it (E78 fix r1-G2, 14.10.2026): its `element` is the dock,
       `#camera-views`, the root avclient-livekit looks in for a user's `<audio>` (LiveKitClient.ts
       `getUserAudioElement`, external). The harness had no `ui.webrtc`; nothing else of CameraViews is modelled. */
    if (!ui.webrtc) put(ui, "webrtc", {});
    keep(ui.webrtc, "element");
    Object.defineProperty(ui.webrtc, "element", { configurable: true, get: dock });

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

    function leaveRoom(room, reason = CLIENT_INITIATED) {
        if (!room || room.state === "disconnected") return;
        for (const id of room.remoteParticipants.keys()) hideRemote(id);
        room.remoteParticipants.clear();
        room.activeSpeakers = [];
        room.state = "disconnected";
        liveKitClient.connectionState = "disconnected";
        room.emit("connectionStateChanged", "disconnected");
        room.emit("disconnected", reason);
    }

    const client = webrtc.client;
    put(client, CLIENT_FIELD, liveKitClient);
    put(client, "room", null);
    put(client, "initialize", async () => {
        liveKitClient.initState = "initializing";
        leaveRoom(liveKitClient.liveKitRoom);
        liveKitClient.liveKitRoom = new Room(++state.rooms);
        liveKitClient.initState = "initialized";
        Hooks.callAll("liveKitClientInitialized", liveKitClient);
        return true;
    });
    put(client, "connect", async () => {
        const room = liveKitClient.liveKitRoom;
        if (!room) return false;
        const name = state.fail === "main" ? MAIN_ROOM : (liveKitClient.breakoutRoom ?? MAIN_ROOM);
        client.room = name;
        if (state.fail === "throw") throw new Error(`the harness's LiveKit refused "${name}" (fail: throw)`);
        if (state.fail === "refuse") return false;
        room.name = name;
        room.state = "connected";
        liveKitClient.connectionState = "connected";
        for (const id of membersOf(name)) {
            room.remoteParticipants.set(id, new Participant(id, false));
            showRemote(id);
        }
        room.emit("connectionStateChanged", "connected");
        return true;
    });
    put(client, "disconnect", async () => {
        leaveRoom(liveKitClient.liveKitRoom);
        client.room = null;
        return true;
    });
    put(client, "toggleAudio", enable => { state.toggles.push(Boolean(enable)); });
    // AVMaster#connect, as voice-client.mjs reads it: `client.initialize()` on every connect, then the client's connect.
    put(webrtc, "connect", async () => {
        await client.initialize();
        return client.connect();
    });
    put(webrtc, "disconnect", () => client.disconnect());

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
        /** The connection is lost: the Room says so (with `reason`, the header's) and empties; `client.room` and `breakoutRoom` keep their names; nothing reconnects until a connect. */
        drop(reason = null) { leaveRoom(room(), reason); },
        /** How every connect from now on fails: "refuse", "throw", "main" (lands in the main room), or null to let them through. */
        fail(mode) {
            if (mode !== null && !FAILS.includes(mode)) return false;
            state.fail = mode;
            return true;
        },
        /** This browser as the install found it (the header's list); true once, false after. */
        uninstall() {
            if (!undo.length) return false;
            leaveRoom(room());
            drawnDock?.remove();
            drawnDock = null;
            while (undo.length) undo.pop()();
            return true;
        },
        /** What a scenario reads of this browser's view of the room, as plain data. */
        read() {
            const r = room();
            return {
                initState: liveKitClient.initState,
                serial: r?.serial ?? null,
                state: r?.state ?? null,
                name: r?.name ?? null,
                /* The room's name as the A/V client holds it, which a drop keeps (E19 C0). */
                clientRoom: client.room ?? null,
                remote: r ? [...r.remoteParticipants.values()].map(p => liveKitClient.getParticipantFVTTUser(p)?.id ?? null) : [],
                audio: [...dock().querySelectorAll(".camera-view[data-user]")].map(view => {
                    const el = view.querySelector("audio.user-microphone-audio");
                    return { user: view.dataset.user, audio: Boolean(el), volume: el?.volume ?? null, muted: el?.muted ?? null };
                })
            };
        }
    };
}
