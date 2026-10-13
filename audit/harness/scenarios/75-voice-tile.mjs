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
 * A (C3), B (C4), C (C5) and D (C6) come with their commits: the tile showing who p1 hears, the
 * microphone, the list and the GM's block, and the curtain's cut (the plan's 2.2).
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

export async function run({ p1, p3, check, phase, IDS }) {
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
}
