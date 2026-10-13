/**
 * The voice tile (E78, 1.2.77; the E78 plan's 2.2): who you hear, on four clients with a LiveKit room each.
 *
 * The voice tile shows the person the viewer hears in their own LiveKit room, and nobody else - and a
 * room is a thing each browser holds alone, so the suite, which runs on the GM, cannot read a player's.
 * This scenario does, on the harness's LiveKit shim (lib/livekit.mjs), which a scenario installs on the
 * clients it names (`__liveKit.install`, client-entry.mjs) and no other scenario does. It is written in
 * phases, one per commit of E78 that has something here to read:
 * 0 (C1): the shim measured on its own, before any of the module reads it. On p1 a listener of
 *   `liveKitClientInitialized` - the hook avclient-livekit fires as its client comes up - finds the Room
 *   on the client it is handed and hears that Room's `activeSpeakersChanged`, each speaker mapped to a
 *   Foundry user by `getParticipantFVTTUser`; the Room holds the users the roster puts in p1's room and
 *   not p3, whom it puts elsewhere; each of them has an `<audio>` element in the camera dock whose volume
 *   and mute the attach wrote from p1's client settings (p2 at the 0.5 p1 set, the GM at the default 1).
 *   The control: p3, where nothing installed the shim, reads "no Room", so a green 0 measured the shim.
 *   Then a second connect builds a new Room - the old one says `disconnected`, the hook comes again with
 *   the new one, a speaker on it is heard there and not on the old - and the attach writes `muteAll`.
 * A (C3): the voice tile on p1, which voice-tile.mjs draws on the hook's next Room (a third connect, so
 *   the attach writes p1's `muteAll` off again). p2 speaks: after the 250 ms sticky rule p1's tile shows
 *   the name `voiceIdentity` gives p2 and the portrait - a .webp path put on p2's character in p1's memory
 *   only (`updateSource`, put back; the harness's portraits are .svg, which `safeRoomImage` refuses); p3
 *   named speaking in Foundry's table-wide `settings.activity` on p1 changes nothing; after the Room's
 *   silence the face is still there under the 1500 ms hold and gone (no name, no portrait) once the hold
 *   and the fade are over. p2 leaves the Room and is gone from the tile and its count at once; p1 moves
 *   to another room (a new Room, the hook again) and that Room's speaker is shown there. The dock computes
 *   `display: none` with the body's class, and its `<audio>` elements are there; the GM's `voiceTile` off
 *   takes the tile and the class away on p1 and on brings them back. The control: p3, where nothing
 *   installed the shim, has no tile and no class.
 * B (C4), C (C5) and D (C6) come with their commits: the microphone, the list and the GM's block, and
 * the curtain's cut (the plan's 2.2).
 *
 * What the shim cannot settle - real audio, how late LiveKit says who speaks, the dock hidden at a
 * table, audio after F5 - is LIVE-E78 rows and the owner's T1 (lib/livekit.mjs's header).
 */
export const layers = ["ci"];
/* Measured alone on 13.10.2026 (C1's phase 0, three green runs): the checks took 12-14 ms and the
   run 4.2-4.3 s from the cluster's start to its end. 60 s is 73's bound for a scenario of four clients and a few evals; a phase that
   adds minutes raises it with a reading of its own. */
export const timeoutMs = 60000;

const J = value => JSON.stringify(value);

export async function run({ gm, p1, p3, check, phase, IDS, repoUrl }) {
    phase("0: the LiveKit shim - a Room on the hook, its participants mapped to users, an <audio> for each, and none where it is not installed");
    const readRoom = `const lk = game.webrtc?.client?._liveKitClient; return { installed: globalThis.__liveKit?.installed === true, room: lk?.liveKitRoom ? "Room" : "no Room" };`;
    const control = await p3.eval(readRoom);
    const first = await p1.eval(`
        const S = globalThis.__s75 = { hooks: [], heard: [], gone: [] };
        Hooks.on("liveKitClientInitialized", lk => {
            const room = lk?.liveKitRoom;
            S.hooks.push({ same: lk === game.webrtc.client._liveKitClient, serial: room?.serial ?? null, emitter: typeof room?.on === "function" });
            room?.on("activeSpeakersChanged", speakers => S.heard.push({ serial: room.serial, users: speakers.map(p => lk.getParticipantFVTTUser(p)?.id ?? null) }));
            room?.on("disconnected", () => S.gone.push(room.serial));
        });
        if (typeof globalThis.__liveKit?.install !== "function") return { installed: false, room: "no Room" };
        const installed = await __liveKit.install();
        // The roster after the install, not as its argument: before it \`__liveKit\` is client-entry's stub, which
        // has no MAIN_ROOM, and the key came out "undefined" - the first run put p3 in p1's room (13.10.2026).
        __liveKit.setRoster({ [__liveKit.MAIN_ROOM]: ${J([IDS.gm, IDS.p1, IDS.p2])}, "drpg-elsewhere": ${J([IDS.p3])} });
        game.webrtc.settings.set("client", "users.${IDS.p2}.volume", 0.5);
        const connected = await game.webrtc.connect();
        const spoke = __liveKit.speak(${J([IDS.p2, IDS.gm])});
        return { installed, connected, spoke, hooks: S.hooks, heard: S.heard, read: __liveKit.read() };`);
    const audioOf = (read, user) => read?.audio?.find(a => a.user === user) ?? null;
    const sorted = list => [...(list ?? [])].sort();
    check("0: on p1 the shim's Room reaches a liveKitClientInitialized listener, which hears its speakers as Foundry users; the Room holds the roster's users of p1's room and not p3, each with an <audio> whose volume and mute the attach wrote from p1's settings - and p3, with no shim, reads no Room",
        control.room === "no Room" && control.installed === false
            && first.installed === true && first.connected === true
            && first.hooks?.length === 1 && first.hooks[0].same === true && first.hooks[0].emitter === true
            && J(first.heard) === J([{ serial: first.hooks[0].serial, users: [IDS.p2, IDS.gm] }])
            && J(sorted(first.read?.remote)) === J(sorted([IDS.gm, IDS.p2])) && first.read.state === "connected"
            && J(audioOf(first.read, IDS.p2)) === J({ user: IDS.p2, audio: true, volume: 0.5, muted: false })
            && J(audioOf(first.read, IDS.gm)) === J({ user: IDS.gm, audio: true, volume: 1, muted: false })
            && audioOf(first.read, IDS.p3) === null && first.read.audio.length === 2,
        J({ control, first }));

    const second = await p1.eval(`
        const S = globalThis.__s75;
        if (!S || globalThis.__liveKit?.installed !== true) return { installed: false };
        game.webrtc.settings.set("client", "muteAll", true);
        const connected = await game.webrtc.connect();
        const spoke = __liveKit.speak(${J([IDS.p2])});
        const out = { connected, spoke, rooms: __liveKit.rooms, hooks: S.hooks, heard: S.heard, gone: S.gone, read: __liveKit.read() };
        game.webrtc.settings.set("client", "muteAll", false);
        return out;`);
    const [h1, h2] = second.hooks ?? [];
    check("0: a second connect builds a new Room - the old one says disconnected, the hook comes again with the new one, a speaker on it is heard there and not on the old - and the attach writes muteAll",
        second.connected === true && second.rooms === 2 && second.hooks?.length === 2 && h2.same === true && h2.serial !== h1.serial
            && J(second.gone) === J([h1.serial])
            && J(second.heard) === J([{ serial: h1.serial, users: [IDS.p2, IDS.gm] }, { serial: h2.serial, users: [IDS.p2] }])
            && second.read?.serial === h2.serial && J(sorted(second.read.remote)) === J(sorted([IDS.gm, IDS.p2]))
            && J(audioOf(second.read, IDS.p2)) === J({ user: IDS.p2, audio: true, volume: 0.5, muted: true })
            && J(audioOf(second.read, IDS.gm)) === J({ user: IDS.gm, audio: true, volume: 1, muted: true }),
        J(second));

    phase("A: the voice tile - who p1 hears in p1's own Room, faded after silence, cleared when they leave or p1 moves; the dock out of sight with its <audio>; the GM's switch");
    const tileJs = `
        const lk = game.webrtc.client._liveKitClient;
        const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
        const until = async (test, ms = 3000) => { const end = Date.now() + ms; while (Date.now() < end && !test()) await sleep(25); return test(); };
        const tile = () => {
            const el = document.getElementById("drpg-voice-tile");
            if (!el) return null;
            return { state: el.dataset.state, channel: el.dataset.inChannel ?? null, name: el.querySelector(".drpg-voice-tile-name")?.textContent ?? null,
                face: el.querySelector(".drpg-voice-tile-face")?.hidden === false, fading: el.classList.contains("is-fading"),
                art: el.querySelector(".drpg-voice-tile-art")?.style.getPropertyValue("background-image") ?? "" };
        };
        const dock = () => {
            const el = document.getElementById("camera-views");
            return { hidden: document.body.classList.contains("drpg-dock-hidden"), display: el ? getComputedStyle(el).display : null };
        };`;
    const a = await p1.eval(`${tileJs}
        if (globalThis.__liveKit?.installed !== true) return { installed: false };
        const { voiceIdentity } = await import("${repoUrl}/scripts/camera-view.mjs");
        const { TURN } = await import("${repoUrl}/scripts/motion.mjs");
        const p2 = game.users.get("${IDS.p2}"), p3 = game.users.get("${IDS.p3}");
        const actor = p2.character ?? game.actors.find(x => x.type === "character" && x.testUserPermission(p2, "OWNER")) ?? null;
        const out = { installed: true, turn: TURN(), names: [voiceIdentity(p2)?.name ?? null, voiceIdentity(p3)?.name ?? null] };
        const settings = game.webrtc.settings, hadActivity = Object.hasOwn(settings, "activity"), activity = settings.activity, img = actor?.img;
        try {
            actor?.updateSource({ img: "s75/portrait-p2.webp" });
            out.connected = await game.webrtc.connect();
            out.fresh = tile();
            out.dock = { ...dock(), audio: __liveKit.read().audio };
            __liveKit.speak(["${IDS.p2}"]);
            await sleep(120);
            out.early = tile();
            await until(() => tile()?.name === out.names[0]);
            out.speaking = tile();
            settings.activity = { ...(activity ?? {}), ["${IDS.p3}"]: { speaking: true, muted: false } };
            __liveKit.speak(["${IDS.p2}"]);
            await sleep(400);
            out.activity = tile();
            if (hadActivity) settings.activity = activity;
            else delete settings.activity;
            __liveKit.speak([]);
            await sleep(1000);
            out.held = tile();
            await until(() => tile()?.face === false, 1500 + out.turn + 1500);
            out.gone = tile();
            __liveKit.speak(["${IDS.p2}"]);
            await until(() => tile()?.name === out.names[0]);
            __liveKit.leave("${IDS.p2}");
            out.left = tile();
            __liveKit.setRoster({ [__liveKit.MAIN_ROOM]: ${J([IDS.gm, IDS.p1, IDS.p2])}, "drpg-elsewhere": ${J([IDS.p1, IDS.p3])} });
            __liveKit.join("${IDS.p2}");
            __liveKit.speak(["${IDS.p2}"]);
            await until(() => tile()?.name === out.names[0]);
            lk.breakoutRoom = "drpg-elsewhere";
            out.moved = await game.webrtc.connect();
            out.inNew = tile();
            __liveKit.speak(["${IDS.p3}"]);
            await until(() => tile()?.name === out.names[1]);
            out.newRoom = { tile: tile(), read: __liveKit.read() };
        } finally {
            if (hadActivity) settings.activity = activity;
            else delete settings.activity;
            actor?.updateSource({ img });
        }
        return out;`, { timeout: 20000 });
    const ok = (value, state, name, face) => value?.state === state && value.name === name && value.face === face;
    check("A: on p1 the voice tile shows p2 - the Room's speaker - after the 250 ms sticky rule, with the name voiceIdentity gives and the checked portrait, the channel's count 2; Foundry's table-wide signal naming p3 changes nothing",
        a.installed === true && a.connected === true && a.names[0] !== a.names[1]
            && a.fresh?.state === "silent" && a.fresh.channel === "2" && a.fresh.face === false
            && ok(a.early, "silent", "", false)
            && ok(a.speaking, "speaking", a.names[0], true) && a.speaking.channel === "2" && /s75\/portrait-p2\.webp/.test(a.speaking.art)
            && ok(a.activity, "speaking", a.names[0], true),
        J(a));
    check("A: after the Room's silence p1's portrait holds (1000 ms: shown, not fading) and is gone once the hold and the fade are over - no name, no portrait",
        ok(a.held, "speaking", a.names[0], true) && a.held.fading === false && ok(a.gone, "silent", "", false) && a.gone.art === "",
        J({ turn: a.turn, held: a.held, gone: a.gone }));
    check("A: p2 leaving p1's Room clears the tile and its count at once; p1 moved to another room (a new Room, the hook again) shows nobody at once and then that room's speaker, p3",
        ok(a.left, "silent", "", false) && a.left.channel === "1" && a.moved === true && a.inNew?.name === "" && a.inNew.face === false
            && ok(a.newRoom?.tile, "speaking", a.names[1], true) && a.newRoom.tile.channel === "1" && a.newRoom.read.name === "drpg-elsewhere",
        J({ left: a.left, moved: a.moved, inNew: a.inNew, newRoom: a.newRoom }));
    check("A: the dock is out of sight on p1 - the body's class, display: none - and its <audio> elements are in it, one per remote user",
        a.dock?.hidden === true && a.dock.display === "none" && a.dock.audio?.length === 2 && a.dock.audio.every(x => x.audio === true),
        J(a.dock));

    const sw = async value => {
        await gm.eval(`await game.settings.set("danganronpa-rpg", "voiceTile", ${value}); return true;`);
        return p1.eval(`${tileJs}
            await until(() => Boolean(tile()) === ${value} && dock().hidden === ${value});
            return { tile: Boolean(tile()), ...dock() };`);
    };
    const off = await sw(false);
    const on = await sw(true);
    const bare = await p3.eval(`return { tile: Boolean(document.getElementById("drpg-voice-tile")), hidden: document.body.classList.contains("drpg-dock-hidden") };`);
    check("A: the GM's voiceTile off takes p1's tile away and gives the dock back; on brings both back - and p3, with no LiveKit, has neither the tile nor the class",
        J(off) === J({ tile: false, hidden: false, display: "block" }) && J(on) === J({ tile: true, hidden: true, display: "none" })
            && J(bare) === J({ tile: false, hidden: false }),
        J({ off, on, bare }));
}
