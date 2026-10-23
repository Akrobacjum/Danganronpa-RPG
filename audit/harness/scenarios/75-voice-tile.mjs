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
 *   the attach writes p1's `muteAll` off again). p2 speaks: at once on the empty tile (E79 C15, the owner's N14;
 *   until then after the 250 ms sticky rule, and the reading at 120 ms was empty) p1's tile shows
 *   the name `voiceIdentity` gives p2 and the portrait - a .webp path put on p2's character in p1's memory
 *   only (`updateSource`, put back; the harness's portraits are .svg, which `safeRoomImage` refuses); p3
 *   named speaking in Foundry's table-wide `settings.activity` on p1 changes nothing; after the Room's
 *   silence the face is still there under the 1500 ms hold and gone (no name, no portrait) once the hold
 *   and the fade are over. p2 leaves the Room and is gone from the tile and its count at once; p1 moves
 *   to another room (a new Room, the hook again) and that Room's speaker is shown there. The dock computes
 *   `display: none` with the body's class, and its `<audio>` elements are there; the GM's `voiceTile` off
 *   takes the tile and the class away on p1 and on brings them back. The control: p3, where nothing
 *   installed the shim, has no tile and no class.
 * B (C4): p1's microphone button. p1's own click mutes p1 - struck, pressed - by writing p1's own
 *   `users.<p1>.muted` client setting and no other row (p2's 0.5 kept), and a second click opens it again;
 *   push-to-talk wears its small label and its line, Foundry's mute-all strikes the speaker button; a
 *   GM's block (`canBroadcastAudio` false on p1's row, put back) is struck with the lock, not grey, and a
 *   click writes nothing and tells p1 why. The primary GM's own `voice.assign` puts p1 alone in p1's
 *   Eclipse room: the button is grey and struck with the reason, a click writes nothing and says why;
 *   back in the main room it is open. The shim's record of `toggleAudio` stays empty throughout.
 * C (C5): who p1 hears. p1's speaker opens the list 'Who you hear' - the GM and p2, no GM's block for a
 *   player. p2's slider writes p1's own `users.<p2>.volume` and p2's element, nothing else; 'Mute for me' on
 *   the GM is p1's volume for the GM at 0 with the volume before in p1's `voicePeerMutes`, and a new Room
 *   (the attach writes the element from the setting) plays the GM at 0 with the row still muted; unmuted,
 *   1 again and the record empty. The GM's and p2's A/V settings and records are untouched. Escape closes
 *   the list and no window listener hears it. Then the GM installs the shim on its own client: its list
 *   has a block on each row, and the click writes p2's `permissions.BROADCAST_AUDIO` false (the users'
 *   `update` spied on, so nothing is written). p2's character killed in secret (`killCharacter`, revived
 *   quietly after): a click on the block still drawn as free is judged again by `moduleHoldsMic` and
 *   writes nothing, the GM told why; drawn again it is disabled with that line. The gear's window
 *   (`openLookDialog`, real windows) has the Voice section on p1 - the shim names no device, so the
 *   microphone's line and the mode - after the volumes and right before the look's fieldset since E79 C12
 *   (N9; until then after the look) - and push to talk writes p1's `voice.mode`; on p3 there is none.
 * D (C6): where the tile stands. The harness's screen is 1024 px wide, a stacked one, and jsdom cuts no curtain
 *   (its canvas is 0 px wide), so this reads the stacked half: on p1 the voice tile is in `#drpg-tile-row` beside the
 *   room tile, unstamped, its portrait inside its face and nothing of it on the body; a speaker shown and the list
 *   opened move it nowhere; the GM's `voiceTile` off takes it out of the row and on builds it there again (the
 *   road `ensureVoiceTile` takes, not the body). The desk's half - the box at the right wall, the portrait on its
 *   pane, `voice-left` open, no drpgGlassCut for a speaker, a name, the fade or the list - needs a curtain that
 *   cuts: R543 at a table and the glass sweep's `drpgVoiceCheck` in Chromium; R545 cuts the shape headless.
 *   Since E78 fix r2-H2 (verify E78-15, "z sygnaturą cięcia") this phase also reads the cut's signature as R545
 *   does, through glass.mjs `cutBoxes` on R545's blocks: the voice tile's one pane, a section, its settled box
 *   under the tray and `voice-left` open, the same after a speaker and the list, and none of it without the voice
 *   block. So the ci set carries the signature twice, here and in R545 (tier 1, in 01's suite); what neither can
 *   read without a layout - no recut on the screen - is the sweep's.
 * E (C7): a known leak, A9-K3 in known-leaks.json, until E19. p2's character, standing in the Cafeteria's room,
 *   killed in secret (`killCharacter`, revived quietly after): `voiceTargets` sends p2 to the main room at once,
 *   and p1, there with the roster's next Room, hears p2 in the list 'Who you hear' and its count, and (E78 fix r2-H3,
 *   review round 2's O7) sees p2's name and face on the voice tile, with no click, while p2 speaks. The check asks
 *   for what E19 will make true - the room kept, nobody in the main room hearing or seeing p2 - and stays an expected
 *   red while it measured the kill, the room before, the secret, p1's open list in the main room and p1's tile.
 * F (E78 fix r1-G1; the review's SEC-R1-1 and the goal's S16-10 (d)): with the dock hidden. p1 in the main room with
 *   the GM and p2, nobody speaking: the number on the speaker, in the tiles' row and drawn without a click, says 2; a
 *   participant avclient-livekit maps to no user (put in p1's Room by hand) makes it 3, and their leaving 2. Then the
 *   four a player reached only through the dock before E78 - their microphone, a volume, the microphone device and
 *   the mode - each found on screen and used: the tile's microphone, p2's slider in 'Who you hear', and the gear (the
 *   corner's `#drpg-sound-launcher`) with its Voice section, two devices put on p1's AVClient for the phase (the
 *   shim names none). Each writes p1's own A/V settings; the GM's and p2's are as they were. All put back after.
 * G (E79 C15; the owner's N10, N12 and N15): the state word on p1's tile, with nobody speaking. Connected in the
 *   main room; Connecting while voice-client.mjs moves p1 to another room (`applyBreakout`, its `game.webrtc.connect`
 *   held at a gate for the reading) though the old Room still says "connected"; Connected once the move is over;
 *   Connecting while the Room says "reconnecting"; Disconnected when the server goes (`__liveKit.drop()`); and,
 *   since H81-10 (the owner's 1.2.80 table and answer B, 20.10.2026), Connected kept while p2 speaks, its title
 *   DRPG.Voice.held.connected and the live text, hidden with the face, not rewritten (until H81-10 the word went
 *   while somebody spoke). The word's title and the live text say the sentence of each. p1 is put back in the main
 *   room with the room voice-client.mjs wanted before. What a real LiveKit Room says, in both themes, full and
 *   compact, is LIVE-E79-21; how late the first portrait comes at a table, LIVE-E79-20.
 * H (H82 C2; the owner's 21.10.2026 "Delay przy laczeniu z nowym pokojem"): the voice switch on entering a room, with
 *   voice switched on and the GM moving Aiko. A settled crossing has p1's room sent within 200 ms of the GM's update and
 *   p1 standing there, once; so it is while Botan steps inside the Cafeteria every second; a move inside a room and a
 *   drag's step with waypoints pending send nothing, the drag's last step sends at once; the trailing pass sends nothing
 *   more. With p1's connect held 2000 ms, two rooms 1700 ms apart end in the second after two reconnects, and p1's Debug
 *   log says how long each connect took (H82-03). The real reconnect's time is LIVE-H82-02.
 *
 * What the shim cannot settle - real audio, how late LiveKit says who speaks, the dock hidden at a
 * table, audio after F5 - is LIVE-E78-01, LIVE-E78-02 and the owner's T1, LIVE-E78-10 (lib/livekit.mjs's header).
 */
export const layers = ["ci"];
/* Measured alone on 13.10.2026 (C1's phase 0, three green runs): the checks took 12-14 ms and the
   run 4.2-4.3 s from the cluster's start to its end. 60 s is 73's bound for a scenario of four clients and a few evals; a phase that
   adds minutes raises it with a reading of its own. With phase B (C4, two green runs on 14.10.2026, under the harness lock): the
   cluster's 12 checks in 4.4-4.5 s, 8.3-8.6 s of wall time with the boot - the bound stands. With phase C (C5, three green runs on
   14.10.2026, under the harness lock): 18 checks in 6.7-6.9 s, 10.7 s of wall time in the one run that was timed - it stands still.
   With phase D (C6, two green runs on 14.10.2026, under the harness lock):
   20 checks in 7.3-7.4 s, 11.5-12.1 s of wall time - it stands. With phase E (C7, two green runs on 14.10.2026, under the harness lock):
   21 checks, 1 of them the expected red, in 8.4-8.6 s - it stands. With phase F (E78 fix r1-G1, one green run on 14.10.2026, under
   the harness lock): 23 checks, 1 of them the expected red, in 8.0 s - it stands. With D's cut signature (E78 fix r2-H2, one
   green run on 14.10.2026, under the harness lock): 24 checks, 1 of them the expected red, in 8.5 s, 14 s of wall time - it stands.
   With phase G (E79 C15, one green run on 17.10.2026, under the harness lock): 26 checks, 1 of them the expected red, in 7.9 s,
   13 s of wall time - it stands. With phase H (H82 C2, two green runs on 23.10.2026, under the harness lock): 31 checks, 1 of
   them the expected red, in 31.1 s and 30.2 s, 36.6 s and 36.0 s of wall time; H waits 21.4 s on its own clock by design
   (the trailing pass three times, Botan's four steps, the drag's 600 ms, the held connects), so the bound goes to 90 s,
   a margin chosen for a loaded runner, not measured on one. */
export const timeoutMs = 90000;

const J = value => JSON.stringify(value);

export async function run({ gm, p1, p2, p3, check, phase, IDS, repoUrl }) {
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
    check("A: on p1 the voice tile shows p2 - the Room's speaker - at once on the empty tile (shown 120 ms after the Room says so), with the name voiceIdentity gives and the checked portrait, the channel's count 2; Foundry's table-wide signal naming p3 changes nothing",
        a.installed === true && a.connected === true && a.names[0] !== a.names[1]
            && a.fresh?.state === "silent" && a.fresh.channel === "2" && a.fresh.face === false
            && ok(a.early, "speaking", a.names[0], true)
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

    phase("B: p1's microphone - p1's own click writes p1's own muted and nothing else; push-to-talk, mute-all, a GM's block with the lock, the Eclipse's hold in grey with the reason; the module never toggles a microphone");
    const micJs = `${tileJs}
        const el = () => document.querySelector("#drpg-voice-tile .drpg-voice-mic");
        const mic = () => {
            const button = el(), note = document.querySelector("#drpg-voice-tile .drpg-voice-tile-note");
            if (!button) return null;
            const lock = button.querySelector(".drpg-voice-mic-lock");
            return { cls: [...button.classList].filter(c => c.startsWith("is-")).join(" "), pressed: button.getAttribute("aria-pressed"),
                disabled: button.getAttribute("aria-disabled"), tip: button.dataset.tooltipText ?? "", note: note && !note.hidden ? note.textContent : "",
                lock: lock ? getComputedStyle(lock).display : null };
        };
        const speaker = () => {
            const button = document.querySelector("#drpg-voice-tile .drpg-voice-speaker"), badge = button?.querySelector(".drpg-voice-count");
            return button ? { count: badge && !badge.hidden ? badge.textContent : "", struck: button.classList.contains("is-muted") } : null;
        };
        const rows = () => JSON.parse(JSON.stringify(game.webrtc.settings.client.users ?? {}));
        const notices = () => globalThis.__notifications.length;
        const text = key => game.i18n.localize(key);`;
    const b = await p1.eval(`${micJs}
        if (globalThis.__liveKit?.installed !== true) return { installed: false };
        const settings = game.webrtc.settings, me = game.user.id, mode = settings.client.voice?.mode;
        const out = { installed: true, open: { mic: mic(), speaker: speaker() }, before: rows(),
            texts: { mute: text("DRPG.Voice.mic.mute"), unmute: text("DRPG.Voice.mic.unmute"), gmBlock: text("DRPG.Voice.held.gmBlock"),
                ptt: text("DRPG.Voice.mic.pttNoKey"), badge: text("DRPG.Voice.mic.pttBadge") } };
        if (!el()) return out;  // no button: the checks below fail on what they read, not on the eval's own clock
        try {
            el()?.click();
            await until(() => mic()?.cls === "is-muted");
            out.muted = { mic: mic(), rows: rows() };
            el()?.click();
            await until(() => mic()?.cls === "");
            out.back = { mic: mic(), rows: rows() };
            settings.set("client", "voice.mode", "ptt");
            await until(() => mic()?.cls === "is-ptt");
            out.ptt = { mic: mic(), label: el()?.querySelector(".drpg-voice-mic-ptt")?.textContent ?? null };
            settings.set("client", "voice.mode", mode ?? "always");
            settings.set("client", "muteAll", true);
            await until(() => speaker()?.struck === true);
            out.muteAll = speaker();
            settings.set("client", "muteAll", false);
            settings.set("client", "users." + me + ".canBroadcastAudio", false);
            await until(() => mic()?.cls === "is-gm-blocked");
            const seen = notices(), kept = JSON.stringify(rows());
            el()?.click();
            await until(() => notices() > seen);
            out.blocked = { mic: mic(), told: globalThis.__notifications.slice(seen).map(n => n.msg), unchanged: JSON.stringify(rows()) === kept };
        } finally {
            settings.set("client", "voice.mode", mode ?? "always");
            settings.set("client", "muteAll", false);
            delete settings.client.users?.[me]?.canBroadcastAudio;
            Hooks.callAll("rtcSettingsChanged", settings, {});
        }
        await until(() => mic()?.cls === "");
        out.unblocked = mic();
        return out;`, { timeout: 20000 });
    const otherRows = (rows, user) => J(Object.fromEntries(Object.entries(rows ?? {}).map(([id, row]) => [id, id === user ? { ...row, muted: null } : row])));
    check("B: on p1 the microphone is open and the speaker counts p1's channel (p3); p1's click mutes p1 - pressed, struck in the normal colours - writing p1's own muted and no other user's setting (p2's 0.5 kept); a second click opens it again",
        b.installed === true && J(b.open?.mic) === J({ cls: "", pressed: "false", disabled: null, tip: b.texts.mute, note: "", lock: "none" })
            && J(b.open.speaker) === J({ count: "1", struck: false })
            && J(b.muted?.mic) === J({ cls: "is-muted", pressed: "true", disabled: null, tip: b.texts.unmute, note: "", lock: "none" })
            && b.muted.rows?.[IDS.p1]?.muted === true && otherRows(b.muted.rows, IDS.p1) === otherRows(b.before, IDS.p1)
            && b.muted.rows?.[IDS.p2]?.volume === 0.5
            && b.back?.mic?.cls === "" && b.back.mic.pressed === "false" && b.back.rows?.[IDS.p1]?.muted === false
            && otherRows(b.back.rows, IDS.p1) === otherRows(b.before, IDS.p1),
        J(b));
    check("B: push-to-talk wears its small label and its line (no key is bound in the harness); Foundry's mute-all strikes the speaker",
        b.ptt?.mic?.cls === "is-ptt" && b.ptt.mic.tip === b.texts.ptt && b.ptt.label === b.texts.badge && b.ptt.mic.pressed === "false"
            && J(b.muteAll) === J({ count: "1", struck: true }),
        J({ ptt: b.ptt, muteAll: b.muteAll }));
    check("B: a GM's block on p1's microphone is struck with the lock shown, not grey; p1's click writes nothing and tells p1 why; lifted, the button is open again",
        J(b.blocked?.mic) === J({ cls: "is-gm-blocked", pressed: "false", disabled: "true", tip: b.texts.gmBlock, note: "", lock: "inline-block" })
            && J(b.blocked.told) === J([b.texts.gmBlock]) && b.blocked.unchanged === true
            && b.unblocked?.cls === "" && b.unblocked.disabled === null,
        J({ blocked: b.blocked, unblocked: b.unblocked }));

    // The Eclipse: the primary GM's own packet puts p1 alone in p1's Eclipse room (voice-client.mjs `onVoiceSocket`), which
    // `micHold` holds; then the main room again.
    const eclipseRoom = `drpg-eclipse-${IDS.p1}`;
    const assign = room => gm.eval(`game.socket.emit("module.danganronpa-rpg", { action: "voice.assign", target: "${IDS.p1}", room: ${J(room)} }); return true;`);
    await p1.eval(`__liveKit.setRoster({ [__liveKit.MAIN_ROOM]: ${J([IDS.gm, IDS.p1, IDS.p2])}, "drpg-elsewhere": ${J([IDS.p1, IDS.p3])}, ${J(eclipseRoom)}: ${J([IDS.p1])} }); return true;`);
    await assign(eclipseRoom);
    const held = await p1.eval(`${micJs}
        await until(() => mic()?.cls === "is-held", 5000);
        const seen = notices(), kept = JSON.stringify(rows()), out = { mic: mic(), room: __liveKit.read().name, speaker: speaker(), eclipse: text("DRPG.Voice.held.eclipse") };
        el()?.click();
        await until(() => notices() > seen);
        return { ...out, told: globalThis.__notifications.slice(seen).map(n => n.msg), unchanged: JSON.stringify(rows()) === kept };`, { timeout: 10000 });
    await assign(null);
    const freed = await p1.eval(`${micJs}
        await until(() => mic()?.cls === "" && __liveKit.read().name === __liveKit.MAIN_ROOM, 5000);
        return { mic: mic(), room: __liveKit.read().name, main: __liveKit.MAIN_ROOM, toggles: __liveKit.toggles };`, { timeout: 10000 });
    check("B: alone in p1's Eclipse room the microphone is grey and struck with the reason in its note and tooltip; p1's click writes nothing and tells p1 why; back in the main room it is open",
        held.room === eclipseRoom
            && J(held.mic) === J({ cls: "is-held", pressed: "false", disabled: "true", tip: held.eclipse, note: held.eclipse, lock: "none" })
            && J(held.speaker) === J({ count: "", struck: false })
            && J(held.told) === J([held.eclipse]) && held.unchanged === true
            && freed.room === freed.main && freed.mic?.cls === "" && freed.mic.disabled === null,
        J({ held, freed }));
    check("B: the module never toggled a microphone on p1 - the shim's record of toggleAudio is empty after phases 0, A and B",
        Array.isArray(freed.toggles) && freed.toggles.length === 0,
        J(freed.toggles));

    phase("C: who p1 hears - the list's volume and 'Mute for me' in p1's settings only, kept across a new Room; Escape stays in the list; the GM's block, refused at the click for a death kept secret; the gear's Voice section");
    const snap = `return JSON.stringify([game.webrtc?.settings?.client ?? null, game.settings.get("danganronpa-rpg", "voicePeerMutes") ?? null]);`;
    const othersBefore = [await gm.eval(snap), await p2.eval(snap)];
    const c = await p1.eval(`${micJs}
        if (globalThis.__liveKit?.installed !== true) return { installed: false };
        const { volumeOfSlider } = await import("${repoUrl}/scripts/voice-tile.mjs");
        const settings = game.webrtc.settings, gmId = "${IDS.gm}", p2Id = "${IDS.p2}";
        const list = () => document.getElementById("drpg-voice-list");
        const rowOf = id => list()?.querySelector('.drpg-voice-row[data-user-id="' + id + '"]');
        const pressed = id => rowOf(id)?.querySelector(".drpg-voice-row-mute")?.getAttribute("aria-pressed") ?? null;
        const audio = id => __liveKit.read().audio.find(x => x.user === id) ?? null;
        const record = () => JSON.parse(JSON.stringify(game.settings.get("danganronpa-rpg", "voicePeerMutes") ?? {}));
        const button = document.querySelector("#drpg-voice-tile .drpg-voice-speaker");
        const out = { installed: true, before: rows(), record: record() };
        try {
            button?.click();
            await until(() => list()?.hidden === false);
            if (!list()) return out;
            out.open = { rows: [...list().querySelectorAll(".drpg-voice-row")].map(row => row.dataset.userId).sort(),
                blocks: list().querySelectorAll(".drpg-voice-row-block").length, expanded: button.getAttribute("aria-expanded"),
                focus: document.activeElement === list().querySelector(".drpg-voice-list-muteall") };
            const slider = rowOf(p2Id).querySelector(".drpg-voice-row-volume");
            slider.value = "0.3";
            slider.dispatchEvent(new Event("change"));
            const want = volumeOfSlider(slider.value);
            await until(() => rows()[p2Id]?.volume === want);
            out.slid = { want, rows: rows(), audio: audio(p2Id) };
            rowOf(gmId).querySelector(".drpg-voice-row-mute").click();
            await until(() => rows()[gmId]?.volume === 0 && pressed(gmId) === "true");
            out.muted = { rows: rows(), record: record(), audio: audio(gmId), pressed: pressed(gmId) };
            const serial = __liveKit.read().serial;
            await game.webrtc.connect();
            await until(() => __liveKit.read().serial !== serial && Boolean(audio(gmId)));
            out.again = { audio: audio(gmId), pressed: pressed(gmId), record: record(), open: list()?.hidden === false };
            rowOf(gmId).querySelector(".drpg-voice-row-mute").click();
            await until(() => rows()[gmId]?.volume === 1 && pressed(gmId) === "false");
            out.unmuted = { rows: rows(), record: record(), audio: audio(gmId) };
            let heard = 0;
            const listener = () => { heard += 1; };
            window.addEventListener("keydown", listener);
            try {
                const mute = rowOf(gmId).querySelector(".drpg-voice-row-mute");
                mute.focus();
                const escape = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
                mute.dispatchEvent(escape);
                out.escape = { hidden: list().hidden, prevented: escape.defaultPrevented, heard, expanded: button.getAttribute("aria-expanded"),
                    focus: document.activeElement === button };
            } finally {
                window.removeEventListener("keydown", listener);
            }
        } finally {
            if (list()?.hidden === false) button?.click();
            settings.set("client", "users." + p2Id + ".volume", 0.5);
        }
        out.after = rows();
        return out;`, { timeout: 20000 });
    const othersAfter = [await gm.eval(snap), await p2.eval(snap)];
    // The rows with the fields a step changed left out, and a row left empty by that dropped (the GM's has no row until a volume is set).
    const without = (rows, drop) => J(Object.fromEntries(Object.entries(rows ?? {}).map(([id, row]) => [id, Object.fromEntries(Object.entries(row)
        .filter(([key]) => !drop.includes(`${id}.${key}`)))]).filter(([, row]) => Object.keys(row).length > 0)));
    check("C: p1's speaker opens the list 'Who you hear' - the GM and p2, the two of p1's Room, no GM's block for a player, the focus inside; p2's slider writes p1's own users.<p2>.volume and p2's element and nothing else",
        c.installed === true && J(c.open) === J({ rows: [IDS.gm, IDS.p2].sort(), blocks: 0, expanded: "true", focus: true })
            && c.slid?.rows?.[IDS.p2]?.volume === c.slid.want && c.slid.audio?.volume === c.slid.want
            && without(c.slid.rows, [`${IDS.p2}.volume`]) === without(c.before, [`${IDS.p2}.volume`]),
        J({ open: c.open, slid: c.slid, before: c.before }));
    check("C: 'Mute for me' on the GM sets p1's own volume for the GM to 0 and keeps the volume before in p1's voicePeerMutes; a new Room plays the GM at 0 and the row still says muted; unmuted, the GM is at 1 again and the record is empty",
        c.muted?.rows?.[IDS.gm]?.volume === 0 && J(c.muted.record) === J({ [IDS.gm]: 1 }) && c.muted.audio?.volume === 0 && c.muted.pressed === "true"
            && J(c.again) === J({ audio: { ...c.again?.audio, volume: 0 }, pressed: "true", record: { [IDS.gm]: 1 }, open: true }) && c.again.audio?.audio === true
            && c.unmuted?.rows?.[IDS.gm]?.volume === 1 && J(c.unmuted.record) === J({}) && c.unmuted.audio?.volume === 1
            && without(c.after, [`${IDS.gm}.volume`]) === without(c.before, [`${IDS.gm}.volume`]),
        J({ muted: c.muted, again: c.again, unmuted: c.unmuted, after: c.after, before: c.before }));
    check("C: none of it reached another browser - the GM's and p2's A/V settings and 'Mute for me' records are as they were; Escape closes p1's list, goes no further than it (a window listener never hears it) and gives the focus back to the speaker",
        J(othersAfter) === J(othersBefore) && J(c.escape) === J({ hidden: true, prevented: true, heard: 0, expanded: "false", focus: true }),
        J({ othersBefore, othersAfter, escape: c.escape }));

    // The GM's list: the GM installs the shim on its own client (the GM's tile and list need a Room), the users' `update` spied on.
    const g = await gm.eval(`${tileJs}
        const C = await import("${repoUrl}/scripts/chapter.mjs");
        const { moduleHoldsMic } = await import("${repoUrl}/scripts/voice.mjs");
        if (typeof globalThis.__liveKit?.install !== "function") return { installed: false };
        const installed = await __liveKit.install();
        __liveKit.setRoster({ [__liveKit.MAIN_ROOM]: ${J([IDS.gm, IDS.p1, IDS.p2])} });
        const connected = await game.webrtc.connect();
        await until(() => Boolean(document.querySelector("#drpg-voice-tile .drpg-voice-speaker")));
        const p1 = game.users.get("${IDS.p1}"), p2 = game.users.get("${IDS.p2}");
        const actor = p2.character ?? game.actors.find(x => x.type === "character" && x.testUserPermission(p2, "OWNER")) ?? null;
        const button = document.querySelector("#drpg-voice-tile .drpg-voice-speaker");
        const list = () => document.getElementById("drpg-voice-list");
        const block = id => list()?.querySelector('.drpg-voice-row[data-user-id="' + id + '"] .drpg-voice-row-block');
        const line = id => list()?.querySelector('.drpg-voice-row[data-user-id="' + id + '"] .drpg-voice-row-held');
        const updates = [], spied = [p1, p2], own = spied.map(user => Object.getOwnPropertyDescriptor(user, "update"));
        for (const user of spied) user.update = async data => { updates.push({ user: user.id, data }); return user; };
        const out = { installed, connected, actor: Boolean(actor), secretLine: game.i18n.localize("DRPG.Voice.list.gmSecretDead") };
        let killed = false;
        try {
            button?.click();
            await until(() => list()?.hidden === false && Boolean(block(p2.id)));
            if (!block(p2.id)) return out;
            out.open = { blocks: [p1.id, p2.id].map(id => Boolean(block(id)) && block(id).disabled === false), pressed: block(p2.id)?.getAttribute("aria-pressed") };
            block(p2.id).click();
            await until(() => updates.length > 0);
            out.blocked = updates.splice(0);
            await C.killCharacter(actor, { secret: true, keepBullets: true });
            killed = true;
            out.hold = moduleHoldsMic(p2);
            // The button as it was drawn before the death, free: nothing repaints the list for an actor's change.
            const seen = globalThis.__notifications.length, free = block(p2.id)?.disabled === false;
            block(p2.id).click();
            await until(() => globalThis.__notifications.length > seen);
            await sleep(100);
            out.stale = { free, updates: updates.splice(0), told: globalThis.__notifications.slice(seen).map(n => n.msg) };
            button.click();
            button.click();
            await until(() => list()?.hidden === false && block(p2.id)?.disabled === true);
            out.held = { disabled: block(p2.id)?.disabled, line: line(p2.id)?.hidden === false ? line(p2.id).textContent : null,
                described: block(p2.id)?.getAttribute("aria-describedby") === line(p2.id)?.id, other: block(p1.id)?.disabled };
            block(p2.id).click();
            await sleep(200);
            out.disabledClick = updates.splice(0);
        } finally {
            if (killed) await C.reviveCharacter(actor, { quiet: true });
            spied.forEach((user, i) => {
                if (own[i]) Object.defineProperty(user, "update", own[i]);
                else delete user.update;
            });
            if (list()?.hidden === false) button?.click();
        }
        return out;`, { timeout: 30000 });
    check("C: the GM's list has a block on each player's row; the GM's click writes p2's permissions.BROADCAST_AUDIO false (spied on, nothing written) and nothing else",
        g.installed === true && g.connected === true && J(g.open) === J({ blocks: [true, true], pressed: "false" })
            && J(g.blocked) === J([{ user: IDS.p2, data: { "permissions.BROADCAST_AUDIO": false } }]),
        J({ installed: g.installed, connected: g.connected, open: g.open, blocked: g.blocked }));
    check("C: p2's character dead in secret - moduleHoldsMic holds p2; a click on the block still drawn as free is judged again and writes nothing, the GM told why; drawn again it is disabled with that line, and its click writes nothing",
        g.actor === true && J(g.hold) === J({ reason: "secretDead", held: true })
            && g.stale?.free === true && J(g.stale.updates) === J([]) && g.stale.told?.includes(g.secretLine) === true
            && J(g.held) === J({ disabled: true, line: g.secretLine, described: true, other: false }) && J(g.disabledClick) === J([]),
        J({ hold: g.hold, stale: g.stale, held: g.held, disabledClick: g.disabledClick }));

    // The gear's Voice section: drawn on p1 (voice through the shim), not on p3 (no voice). Both clients draw real windows for it.
    const gear = client => client.eval(`
        const { openLookDialog } = await import("${repoUrl}/scripts/look.mjs");
        const { closeOpen } = await import("${repoUrl}/scripts/live.mjs");
        const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
        const until = async (test, ms = 3000) => { const end = Date.now() + ms; while (Date.now() < end && !test()) await sleep(25); return test(); };
        const form = () => document.querySelector(".drpg-window-look form");
        const panel = () => form()?.querySelector("fieldset.drpg-voice-panel") ?? null;
        const windows = globalThis.__dialogWindows, mode = game.webrtc?.settings?.client?.voice?.mode;
        globalThis.__dialogWindows = true;
        try {
            openLookDialog().catch(() => null);
            await until(() => Boolean(form()));
            await until(() => Boolean(panel()), 1500);
            const out = { form: Boolean(form()), panel: Boolean(panel()) };
            if (!panel()) return out;
            out.names = [...new Set([...panel().querySelectorAll("[name]")].map(el => el.name))];
            // E79 C12 (N9): between the volumes and the look - after every volume slider, right before the look's fieldset
            const sliders = [...form().querySelectorAll(".drpg-sound-slider")];
            out.between = sliders.length > 0 && sliders.every(s => Boolean(s.compareDocumentPosition(panel()) & Node.DOCUMENT_POSITION_FOLLOWING))
                && panel().nextElementSibling?.matches("fieldset.drpg-look") === true;
            out.note = panel().querySelector(".drpg-voice-panel-mic-note")?.textContent === game.i18n.localize("DRPG.Voice.panel.micNote");
            const ptt = panel().querySelector("[name='voice:mode'][value='ptt']");
            ptt.checked = true;
            ptt.dispatchEvent(new Event("change", { bubbles: true }));
            await until(() => game.webrtc.settings.client.voice?.mode === "ptt");
            out.wrote = game.webrtc.settings.client.voice?.mode;
            return out;
        } finally {
            if (game.webrtc?.settings?.client?.voice) game.webrtc.settings.set("client", "voice.mode", mode ?? "always");
            globalThis.__dialogWindows = windows;
            closeOpen("drpg-window-look");
        }`, { timeout: 15000 });
    const gearP1 = await gear(p1), gearP3 = await gear(p3);
    check("C: the gear's window has the Voice section on p1 - the microphone's line (the shim names no device), the mode and nothing else, standing after the volumes and right before the look (E79 C12, N9); choosing push to talk writes p1's voice.mode - and on p3, with no voice, there is no section",
        J(gearP1) === J({ form: true, panel: true, names: ["voice:mode"], between: true, note: true, wrote: "ptt" }) && J(gearP3) === J({ form: true, panel: false }),
        J({ gearP1, gearP3 }));

    phase("D: where the tile stands - on a stacked screen in the tiles' row beside the room tile, its portrait inside it, moved by no speaker and no list, built there again after the GM's switch");
    const rowJs = `
        const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
        const until = async (test, ms = 3000) => { const end = Date.now() + ms; while (Date.now() < end && !test()) await sleep(25); return test(); };
        const where = () => {
            const tile = document.getElementById("drpg-voice-tile"), face = tile?.querySelector(".drpg-voice-tile-face");
            return { stacked: document.body.classList.contains("drpg-stacked"), tile: tile?.parentElement?.id ?? null,
                room: document.getElementById("drpg-room-tile")?.parentElement?.id ?? null, place: tile?.dataset.place ?? null,
                art: face?.firstElementChild?.classList.contains("drpg-voice-tile-art") ?? false, loose: Boolean(document.getElementById("drpg-voice-art")) };
        };`;
    const d = await p1.eval(`${rowJs}
        if (globalThis.__liveKit?.installed !== true) return { installed: false };
        await until(() => where().tile === "drpg-tile-row");
        const out = { installed: true, at: where() };
        __liveKit.speak(["${IDS.gm}"]);
        await until(() => document.querySelector("#drpg-voice-tile .drpg-voice-tile-face")?.hidden === false);
        document.querySelector("#drpg-voice-tile .drpg-voice-speaker")?.click();
        await sleep(100);
        out.spoken = where();
        (document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        __liveKit.speak([]);
        return out;`, { timeout: 15000 });
    const want = { stacked: true, tile: "drpg-tile-row", room: "drpg-tile-row", place: null, art: true, loose: false };
    check("D: on p1's stacked screen the voice tile is in the tiles' row beside the room tile, unstamped, its portrait inside it and nothing of it on the body; a speaker shown and the list opened move nothing",
        d.installed === true && J(d.at) === J(want) && J(d.spoken) === J(want), J(d));
    /* THE CUT SIGNATURE (E78 fix r2-H2, 14.10.2026; verify E78-15): jsdom cuts no curtain, so this asks glass.mjs
       `cutBoxes` for the desk's cut of R545's blocks (a player at 1920x1080 as a Chromium glass harness measured them on
       14.10, the voice block at its placement before it is settled), on p1, before and after a speaker is shown and
       the list opened: the voice tile's panes, its settled box and whether `voice-left` is left open. The control:
       the same blocks without the voice block. That nothing on the screen is recut by a speaker or the list is the
       glass sweep's `drpgVoiceCheck` in Chromium; this is the half the ci set carries. */
    const sig = await p1.eval(`${rowJs}
        const G = await import("${repoUrl}/scripts/glass.mjs");
        const blocks = [["hud", 16, 22, 265, 180], ["rail", 769, 44, 382, 91], ["three", 1574, 0, 340, 63], ["tray", 1574, 67, 340, 91],
            ["note-block", 16, 739, 323, 266], ["room-block", 16, 222, 265, 364], ["voice-block", 1720, 253, 194, 281], ["launch", 1804, 955, 94, 103]]
            .map(([cls, x, y, w, h]) => ({ cls, x, y, w, h }));
        const sign = list => {
            const cut = G.cutBoxes(1920, 1080, list), mine = cut.panes.filter(p => p.tone === "voice-block");
            return { panes: mine.map(p => p.kind + (p.empty ? " empty" : "")), box: cut.voice && [cut.voice.x, cut.voice.y, cut.voice.w, cut.voice.h],
                left: cut.open.some(a => a.name === "voice-left") };
        };
        const before = sign(blocks);
        __liveKit.speak(["${IDS.gm}"]);
        await until(() => document.querySelector("#drpg-voice-tile .drpg-voice-tile-face")?.hidden === false);
        document.querySelector("#drpg-voice-tile .drpg-voice-speaker")?.click();
        await sleep(100);
        const open = Boolean(document.querySelector(".drpg-voice-list:not([hidden])")), after = sign(blocks);
        (document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        __liveKit.speak([]);
        return { before, open, after, control: sign(blocks.filter(b => b.cls !== "voice-block")) };`, { timeout: 15000 });
    check("D: the cut signature headless (cutBoxes, R545's blocks): one voice pane, a section, the tile settled under the tray and voice-left open - the same after a speaker and the list; without the voice block none of it",
        J(sig.before.panes) === J(["section"]) && sig.before.box?.[1] >= 158 && sig.before.left === true && sig.open === true
        && J(sig.after) === J(sig.before) && J(sig.control) === J({ panes: [], box: null, left: false }), J(sig));
    const again = async value => {
        await gm.eval(`await game.settings.set("danganronpa-rpg", "voiceTile", ${value}); return true;`);
        return p1.eval(`${rowJs}
            await until(() => Boolean(document.getElementById("drpg-voice-tile")) === ${value});
            return where();`);
    };
    const gone = await again(false), back = await again(true);
    check("D: the GM's voiceTile off takes the tile out of p1's row; on builds it in the row again, not on the body",
        gone.tile === null && gone.room === "drpg-tile-row" && J(back) === J(want), J({ gone, back }));

    phase("E: a known leak until E19 - a character killed in secret leaves the room they stood in for the main room at once, where p1 hears them in the list 'Who you hear' and its count, and sees them speak on the voice tile");
    // The primary GM's own reading of where p2's voice goes, before and after a secret death (`voiceTargets`, the one
    // the reconcile sends); the death is put back quietly at the end, as in C.
    const victim = await gm.eval(`
        const C = await import("${repoUrl}/scripts/chapter.mjs");
        const { voiceTargets } = await import("${repoUrl}/scripts/voice.mjs");
        const { isDeadForGm, isDeceased } = await import("${repoUrl}/scripts/settings.mjs");
        const p2 = game.users.get("${IDS.p2}");
        const actor = p2.character ?? game.actors.find(x => x.type === "character" && x.testUserPermission(p2, "OWNER")) ?? null;
        const targets = async () => {
            const { byUser } = await voiceTargets();
            const row = byUser.get(p2.id);
            return { p2: row ? { target: row.target ?? null, why: row.why } : null,
                main: [...byUser].filter(([, r]) => (r.target ?? null) === null).map(([id]) => id).sort() };
        };
        const out = { actor: Boolean(actor), before: await targets() };
        if (!actor) return out;
        await C.killCharacter(actor, { secret: true, keepBullets: true });
        out.secret = isDeadForGm(actor) && !isDeceased(actor);
        out.after = await targets();
        return out;`, { timeout: 15000 });
    let heard = null;
    try {
        // p1 stands in the main room (the primary GM's packet, as in B), and the main room holds whom the GM's reading
        // sends there: p2 is in p1's Room only if the module put p2 in the main room.
        const main = [...new Set([...(victim.after?.main ?? []), IDS.p1])];
        await p1.eval(`__liveKit.setRoster({ [__liveKit.MAIN_ROOM]: ${J(main)} }); return true;`);
        await gm.eval(`game.socket.emit("module.danganronpa-rpg", { action: "voice.assign", target: "${IDS.p1}", room: null }); return true;`);
        heard = await p1.eval(`${micJs}
            if (globalThis.__liveKit?.installed !== true) return { installed: false };
            const list = () => document.getElementById("drpg-voice-list");
            const button = document.querySelector("#drpg-voice-tile .drpg-voice-speaker");
            await sleep(300);
            const serial = __liveKit.read().serial;
            await game.webrtc.connect();
            await until(() => __liveKit.read().serial !== serial && __liveKit.read().name === __liveKit.MAIN_ROOM);
            const out = { installed: true, room: __liveKit.read().name === __liveKit.MAIN_ROOM };
            try {
                button?.click();
                out.open = await until(() => list()?.hidden === false);
                out.rows = [...(list()?.querySelectorAll(".drpg-voice-row") ?? [])].map(row => row.dataset.userId).sort();
                out.count = speaker()?.count ?? null;
            } finally {
                if (list()?.hidden === false) button?.click();
            }
            // E78 fix r2-H3 (review round 2's O7): the tile, with no click, while p2 speaks - a speaker shows after
            // STICK_MS (250 ms), so it is read at 300; \`theirs\` is p2's name on it as voiceIdentity gives it.
            const { voiceIdentity } = await import("${repoUrl}/scripts/camera-view.mjs");
            const who = voiceIdentity(game.users.get("${IDS.p2}"))?.name ?? null;
            __liveKit.speak(["${IDS.p2}"]);
            await sleep(300);
            const t = tile();
            out.tile = t && { state: t.state, name: t.name, face: t.face, theirs: who !== null && t.name === who };
            __liveKit.speak([]);
            return out;`, { timeout: 15000 });
    } finally {
        await gm.eval(`
            const C = await import("${repoUrl}/scripts/chapter.mjs");
            const p2 = game.users.get("${IDS.p2}");
            const actor = p2.character ?? game.actors.find(x => x.type === "character" && x.testUserPermission(p2, "OWNER")) ?? null;
            if (actor) await C.reviveCharacter(actor, { quiet: true });
            return true;`, { timeout: 15000 });
    }
    const stoodInRoom = victim.before?.p2?.target !== null && victim.before?.p2?.target !== undefined;
    check("E: a character killed in secret keeps the voice room they stood in, and nobody in the main room hears them in the list 'Who you hear' or its count, or sees them speak on the voice tile",
        J(victim.after?.p2?.target) === J(victim.before?.p2?.target) && heard?.rows?.includes(IDS.p2) === false && heard?.count === String(heard?.rows?.length || "")
            && heard?.tile?.theirs === false,
        J({ victim, heard }),
        { knownLeak: "A9-K3", measured: victim.actor === true && stoodInRoom && victim.secret === true && heard?.room === true && heard?.open === true
            && typeof heard?.tile?.theirs === "boolean" });

    phase("F: with the dock hidden, p1 sees who is in p1's Room without a click, and reaches p1's microphone, a volume, the microphone device and the mode from the tile and the gear");
    // E78 fix r1-G1 (the review's SEC-R1-1 and the goal's S16-10 (d)). p1 back in the main room with the GM and p2,
    // nobody speaking; a participant avclient-livekit maps to no user of this world is put in p1's Room by hand (the
    // shim's `join` takes users only) and taken out again before anything reconnects.
    const fBefore = [await gm.eval(snap), await p2.eval(snap)];
    const f = await p1.eval(`${micJs}
        if (globalThis.__liveKit?.installed !== true) return { installed: false };
        const settings = game.webrtc.settings, me = game.user.id, p2Id = "${IDS.p2}", av = game.webrtc.client;
        const button = () => document.querySelector("#drpg-voice-tile .drpg-voice-speaker");
        const seen = () => {
            const el = button(), badge = el?.querySelector(".drpg-voice-count");
            return { count: badge && !badge.hidden ? badge.textContent : "", shown: badge ? getComputedStyle(badge).display !== "none" : false,
                button: el ? getComputedStyle(el).display !== "none" : false, row: el?.closest("#drpg-tile-row") ? true : false,
                expanded: el?.getAttribute("aria-expanded") ?? null };
        };
        const list = () => document.getElementById("drpg-voice-list");
        const panel = () => document.querySelector(".drpg-window-look form fieldset.drpg-voice-panel");
        const client = () => JSON.parse(JSON.stringify(settings.client ?? {}));
        __liveKit.setRoster({ [__liveKit.MAIN_ROOM]: ${J([IDS.gm, IDS.p1, IDS.p2])} });
        const serial = __liveKit.read().serial;
        await game.webrtc.connect();
        await until(() => __liveKit.read().serial !== serial && __liveKit.read().state === "connected");
        await until(() => seen().count === "2");
        const out = { installed: true, dock: dock(), silent: seen(), before: client() };
        const room = lk.liveKitRoom, nobody = { identity: "s75-mapped-to-nobody", sid: "PA_s75", isLocal: false, isSpeaking: false, audioLevel: 0, fvttUserId: null };
        room.remoteParticipants.set(nobody.identity, nobody);
        room.emit("participantConnected", nobody);
        await until(() => seen().count === "3", 1000);
        out.unmapped = seen();
        room.remoteParticipants.delete(nobody.identity);
        room.emit("participantDisconnected", nobody);
        await until(() => seen().count === "2", 1000);
        out.left = seen();

        const windows = globalThis.__dialogWindows, sources = Object.getOwnPropertyDescriptor(av, "getAudioSources");
        const was = { muted: settings.client.users?.[me]?.muted ?? false, volume: settings.client.users?.[p2Id]?.volume,
            audioSrc: settings.client.audioSrc, mode: settings.client.voice?.mode };
        const reached = {};
        try {
            document.querySelector("#drpg-voice-tile .drpg-voice-mic")?.click();
            reached.mute = await until(() => settings.client.users?.[me]?.muted === true);
            button()?.click();
            await until(() => list()?.hidden === false);
            const slider = list()?.querySelector('.drpg-voice-row[data-user-id="' + p2Id + '"] .drpg-voice-row-volume');
            if (slider) {
                slider.value = "0.2";
                slider.dispatchEvent(new Event("change"));
            }
            reached.volume = await until(() => typeof settings.client.users?.[p2Id]?.volume === "number" && settings.client.users[p2Id].volume !== was.volume);
            if (list()?.hidden === false) button()?.click();
            // The shim names no device (C's reading); two are put on p1's AVClient for this phase, as a browser that
            // has allowed the microphone lists them.
            Object.defineProperty(av, "getAudioSources", { configurable: true, writable: true, value: async () => ({ "s75-mic-a": "Mic A", "s75-mic-b": "Mic B" }) });
            globalThis.__dialogWindows = true;
            document.getElementById("drpg-sound-launcher")?.click();
            await until(() => Boolean(panel()));
            const mic = panel()?.querySelector("select[name='voice:audioSrc']");
            if (mic) {
                mic.value = "s75-mic-b";
                mic.dispatchEvent(new Event("change", { bubbles: true }));
            }
            reached.device = await until(() => settings.client.audioSrc === "s75-mic-b");
            const ptt = panel()?.querySelector("[name='voice:mode'][value='" + (was.mode === "ptt" ? "always" : "ptt") + "']");
            if (ptt) {
                ptt.checked = true;
                ptt.dispatchEvent(new Event("change", { bubbles: true }));
            }
            reached.mode = await until(() => (settings.client.voice?.mode ?? "always") !== (was.mode ?? "always"));
            out.used = client();
        } finally {
            const { closeOpen } = await import("${repoUrl}/scripts/live.mjs");
            closeOpen("drpg-window-look");
            globalThis.__dialogWindows = windows;
            if (sources) Object.defineProperty(av, "getAudioSources", sources);
            else delete av.getAudioSources;
            if (list()?.hidden === false) button()?.click();
            settings.set("client", "users." + me + ".muted", was.muted);
            if (was.volume === undefined) settings.set("client", "users." + p2Id + ".volume", 1);
            else settings.set("client", "users." + p2Id + ".volume", was.volume);
            settings.set("client", "audioSrc", was.audioSrc ?? "default");
            settings.set("client", "voice.mode", was.mode ?? "always");
        }
        out.reached = reached;
        return out;`, { timeout: 30000 });
    const fAfter = [await gm.eval(snap), await p2.eval(snap)];
    const onScreen = count => ({ count, shown: true, button: true, row: true, expanded: "false" });
    check("F: with the dock hidden p1 sees who is in p1's Room without a click - the number on the speaker in the tiles' row says 2 for the GM and p2 silent, 3 while a participant mapped to no user is in the Room, 2 when they leave",
        f.installed === true && f.dock?.hidden === true && f.dock.display === "none"
            && J(f.silent) === J(onScreen("2")) && J(f.unmapped) === J(onScreen("3")) && J(f.left) === J(onScreen("2")),
        J({ dock: f.dock, silent: f.silent, unmapped: f.unmapped, left: f.left }));
    check("F: with the dock hidden p1 reaches the four from the tile and the gear - p1's microphone on the tile, p2's volume in 'Who you hear', the microphone device and the mode in the gear's Voice section - each used and written in p1's own settings; the GM's and p2's are as they were",
        J(f.reached) === J({ mute: true, volume: true, device: true, mode: true }) && J(fAfter) === J(fBefore),
        J({ reached: f.reached, used: f.used, before: f.before, othersBefore: fBefore, othersAfter: fAfter }));

    phase("G: the state word on p1's tile while nobody speaks - Connected, Connecting while the module moves the Room and while LiveKit reconnects, Disconnected when the server goes, Connected kept while somebody speaks");
    // E79 C15. p1's `game.webrtc.connect` is held at a gate while voice-client.mjs moves p1 to another room, so
    // the reading between the start of the move and the new Room is taken while the old Room still says
    // "connected": only voice-client.mjs's `drpgVoiceApplying` can tell the tile then.
    const st = await p1.eval(`${tileJs}
        if (globalThis.__liveKit?.installed !== true) return { installed: false };
        const VC = await import("${repoUrl}/scripts/voice-client.mjs");
        const word = () => {
            const el = document.getElementById("drpg-voice-tile"), box = el?.querySelector(".drpg-voice-tile-state");
            return { word: el?.dataset.word ?? null, shown: box ? !box.hidden : false, run: box?.firstElementChild?.textContent.split(" · ")[0] ?? "",
                title: box?.title ?? "", live: el?.querySelector(".drpg-voice-tile-nobody")?.textContent ?? "", face: el?.querySelector(".drpg-voice-tile-face")?.hidden === false };
        };
        const L = key => game.i18n.localize(key);
        const before = VC.desiredRoom(), webrtc = game.webrtc, own = Object.getOwnPropertyDescriptor(webrtc, "connect"), real = webrtc.connect;
        const out = { installed: true, texts: {
            connected: [L("DRPG.Voice.tile.state.connected"), L("DRPG.Voice.tile.nobody")],
            connecting: [L("DRPG.Voice.tile.state.connecting"), L("DRPG.Voice.held.connecting")],
            disconnected: [L("DRPG.Voice.tile.state.disconnected"), L("DRPG.Voice.held.offline")],
            speaking: [L("DRPG.Voice.tile.state.connected"), L("DRPG.Voice.held.connected")] } };
        __liveKit.setRoster({ [__liveKit.MAIN_ROOM]: ${J([IDS.gm, IDS.p1, IDS.p2])} });
        __liveKit.speak([]);
        await until(() => __liveKit.read().state === "connected" && word().face === false, 1500 + 840 + 1500);
        out.silent = word();
        let release = null;
        try {
            const gate = new Promise(resolve => { release = resolve; });
            webrtc.connect = async function (...args) {
                await gate;
                return real.apply(this, args);
            };
            const moving = VC.applyBreakout("drpg-s75-word");
            await until(() => word().word === "connecting", 1000);
            out.moving = { ...word(), room: __liveKit.read().state, applying: VC.voiceApplying() };
            release();
            out.result = await moving;
            await until(() => word().word === "connected", 1000);
            out.moved = { ...word(), room: __liveKit.read().name, applying: VC.voiceApplying() };
        } finally {
            release?.();
            if (own) Object.defineProperty(webrtc, "connect", own);
            else delete webrtc.connect;
        }
        const room = lk.liveKitRoom;
        room.state = "reconnecting";
        room.emit("connectionStateChanged", "reconnecting");
        out.reconnecting = word();
        room.state = "connected";
        room.emit("connectionStateChanged", "connected");
        out.back = word();
        __liveKit.drop();
        out.dropped = { ...word(), room: __liveKit.read().state };
        if (before === undefined) {
            lk.breakoutRoom = undefined;
            await game.webrtc.connect();
            VC.forgetDesiredRoom();
        } else await VC.applyBreakout(before);
        await until(() => __liveKit.read().state === "connected" && word().word === "connected", 1000);
        out.home = { ...word(), room: __liveKit.read().name };
        __liveKit.speak(["${IDS.p2}"]);
        await until(() => word().face === true, 1000);
        out.speaking = word();
        __liveKit.speak([]);
        return out;`, { timeout: 20000 });
    const said = (value, which) => value?.word === which && value.shown === true && J([value.run, value.title]) === J(st.texts?.[which])
        && value.live === st.texts[which][1] && value.face === false;
    check("G: p1's tile says Connected while nobody speaks in the main room, and Connecting while voice-client.mjs moves p1 to another room though the old Room still says connected - the word, its title and the live text the sentence of each",
        st.installed === true && said(st.silent, "connected") && said(st.moving, "connecting") && st.moving.room === "connected" && st.moving.applying === true,
        J({ silent: st.silent, moving: st.moving, texts: st.texts }));
    check("G: once the move is over p1's tile says Connected in the new room; Connecting while the Room says reconnecting, Connected again when it is back, Disconnected when the server goes, Connected back home, and Connected still while p2 speaks, the live text hidden and not rewritten",
        st.installed === true && st.result === "applied" && said(st.moved, "connected") && st.moved.room === "drpg-s75-word" && st.moved.applying === false
            && said(st.reconnecting, "connecting") && said(st.back, "connected") && said(st.dropped, "disconnected") && st.dropped.room === "disconnected"
            && said(st.home, "connected") && st.speaking?.shown === true && st.speaking.word === "connected" && st.speaking.face === true
            && J([st.speaking.run, st.speaking.title]) === J(st.texts.speaking) && st.speaking.live === st.texts.connected[1],
        J({ result: st.result, moved: st.moved, reconnecting: st.reconnecting, back: st.back, dropped: st.dropped, home: st.home, speaking: st.speaking }));

    phase("H: a settled crossing moves p1's voice at once - the primary GM sends p1's room within 200 ms of the move, not 1500 ms after, and another student walking postpones nothing; a move inside a room and a drag's pending step send nothing; the trailing pass sends nothing more; p1's debug log says how long each connect took");
    /* H82-02 and H82-03 (the owner's 21.10.2026 "Delay przy laczeniu z nowym pokojem"; STAGE H82 C2). Until H82 the
       primary GM's updateToken hook only re-armed one module-wide timer (voice.mjs RECONCILE_DEBOUNCE_MS, 1500 ms), so a
       settled crossing waited 1500 ms before anybody's room was decided, and each other character token's move started
       that wait again. Here the GM moves Aiko (p1's) with voice switched on and p1 on the shim, whose connect is instant:
       what is timed is the module's part - the hook, the pass, the assignment's hop and the apply - from the GM's update.
       A real LiveKit reconnect is not here (LIVE-H82-02). Then p1's connect is held 2000 ms for two rooms 1700 ms apart:
       p1 ends in the second room after two reconnects and no third, and the debug line H82-03 adds reads each connect's
       2000 ms. Voice is switched off again, both tokens go back and p1's recorders, debug setting and `game.webrtc.connect`
       are put back. Red first at 896f6bf (this phase, voice.mjs and voice-client.mjs as 1.2.81 shipped them), 23.10.2026:
       p1's room sent +1507 ms after the GM's update (p1 there at +1518), +5518 ms with Botan walking, the drag's +1504 ms
       after its last step, and no Debug line of a connect's time. Green with H82 C2, two runs: +8/+8, +5/+3 and +5/+6 ms
       (p1 there at +32/+19, +16/+10 and +15/+17), the held connects read 2010/2008 and 2008/2007 ms, the instant ones
       6-11 ms. */
    const MOD = "danganronpa-rpg", MOVE = `{ teleport: true, movementAction: "displace", animate: false }`;
    const GMJS = `const academy = game.scenes.get("${IDS.scene}"), M = await import("${repoUrl}/scripts/movement.mjs"),
        V = await import("${repoUrl}/scripts/voice.mjs"), H = globalThis.__h75, sleep = ms => new Promise(r => setTimeout(r, ms));
        const aiko = academy.tokens.get("TOKAIKO000000000"), botan = academy.tokens.get("TOKBOTAN00000000");
        const room = name => V.liveKitRoomFor(academy.id, name);`;
    const hOn = await p1.eval(`
        if (globalThis.__liveKit?.installed !== true) return { installed: false };
        const H = globalThis.__h75 = { ev: [], logs: [], debugWas: game.settings.get("${MOD}", "debug"), log: console.debug };
        H.fn = value => H.ev.push({ at: Date.now(), k: value ? "applying" : "applied", room: game.webrtc.client.room ?? null });
        Hooks.on("drpgVoiceApplying", H.fn);
        console.debug = (...args) => { H.logs.push(args.map(String).join(" ")); };
        await game.settings.set("${MOD}", "debug", true);
        return { installed: true, debugWas: H.debugWas };`);
    const gmOn = await gm.eval(`globalThis.__h75 = { ev: [], emit: game.socket.emit };
        ${GMJS}
        H.hook = (doc, changes) => { if ((doc.id === aiko.id || doc.id === botan.id) && ("x" in changes || "y" in changes)) H.ev.push({ at: Date.now(), k: "hook", id: doc.id }); };
        Hooks.on("updateToken", H.hook);
        game.socket.emit = function (channel, payload, ...rest) {
            if (payload?.action === "voice.assign") H.ev.push({ at: Date.now(), k: "sent", to: payload.target, room: payload.room ?? null });
            return H.emit.call(this, channel, payload, ...rest);
        };
        await game.settings.set("${MOD}", "voiceEnabled", true);
        const want = room(M.roomOfToken(aiko));
        const plan = (await V.voiceTargets()).byUser.get("${IDS.p1}")?.target ?? null;
        return { want, plan, aiko: M.roomOfToken(aiko), botan: M.roomOfToken(botan) };`, { timeout: 30000 });
    const landed = await p1.eval(`const sleep = ms => new Promise(r => setTimeout(r, ms)), end = Date.now() + 5000;
        while (Date.now() < end && game.webrtc.client.room !== ${J(gmOn.want)}) await sleep(20);
        await sleep(300);
        globalThis.__h75?.ev.splice(0); globalThis.__h75?.logs.splice(0);
        return game.webrtc.client.room ?? null;`, { timeout: 10000 });
    await gm.eval(`globalThis.__h75.ev.splice(0); return true;`);
    // One move, read on both: the GM's records with their ms after `t0` (the GM's update), p1's applies and debug lines.
    const reading = async (gmJs, timeout = 30000) => {
        const g = await gm.eval(`${GMJS} ${gmJs}`, { timeout });
        const p = await p1.eval(`const H = globalThis.__h75; return { ev: H.ev.splice(0), logs: H.logs.splice(0).filter(line => line.includes("Voice:")) };`);
        const ms = list => list.map(e => ({ ...e, ms: e.at - g.t0, at: undefined }));
        return { ...g, ev: undefined, gm: ms(g.ev), p1: ms(p.ev), logs: p.logs,
            toP1: ms(g.ev.filter(e => e.k === "sent" && e.to === IDS.p1)), applied: ms(p.ev.filter(e => e.k === "applied")) };
    };
    // 1800 ms after the last move: past the trailing pass (1500 ms), which must send nothing more.
    const cross = await reading(`const t0 = Date.now(); await aiko.update(M.positionIn("Dorm B", aiko), ${MOVE}); await sleep(1800);
        return { t0, want: room("Dorm B"), ev: H.ev.splice(0) };`);
    const inside = await reading(`const t0 = Date.now(); await aiko.update({ x: aiko.x + 200, y: aiko.y + 100 }, ${MOVE}); await sleep(1800);
        return { t0, here: M.roomOfToken(aiko), ev: H.ev.splice(0) };`);
    // The investigation's starving walk: Botan steps inside the Cafeteria every 1000 ms, four times, after Aiko's crossing.
    const walk = await reading(`const t0 = Date.now(); await aiko.update(M.positionIn("Dorm A", aiko), ${MOVE});
        for (let k = 0; k < 4; k++) { await sleep(1000); await botan.update({ x: k % 2 ? 1300 : 1400, y: 300 }, ${MOVE}); }
        await sleep(1800);
        return { t0, want: room("Dorm A"), botan: M.roomOfToken(botan), ev: H.ev.splice(0) };`);
    // A drag's step still in flight (\`movement.pending.waypoints\` stood in on the GM's document, as 74 B stands it on p1's)
    // passes through Dorm B; its last step, 600 ms later, ends in the Gym.
    const drag = await reading(`Object.defineProperty(aiko, "movement", { value: { pending: { waypoints: [{ x: 1300, y: 1300 }] } }, configurable: true });
        let t0 = 0;
        try { t0 = Date.now(); await aiko.update(M.positionIn("Dorm B", aiko), ${MOVE}); await sleep(600); } finally { delete aiko.movement; }
        const last = Date.now() - t0; await aiko.update(M.positionIn("Gym", aiko), ${MOVE}); await sleep(1800);
        return { t0, last, via: room("Dorm B"), want: room("Gym"), ev: H.ev.splice(0) };`);
    await p1.eval(`const H = globalThis.__h75, webrtc = game.webrtc;
        H.own = Object.getOwnPropertyDescriptor(webrtc, "connect"); H.real = webrtc.connect;
        webrtc.connect = async function (...args) { await new Promise(r => setTimeout(r, 2000)); return H.real.apply(this, args); };
        return true;`);
    const chained = await reading(`const t0 = Date.now(); await aiko.update(M.positionIn("Dorm A", aiko), ${MOVE}); await sleep(1700);
        const second = Date.now() - t0; await aiko.update(M.positionIn("Dorm B", aiko), ${MOVE});
        await sleep(7000);
        return { t0, second, first: room("Dorm A"), want: room("Dorm B"), ev: H.ev.splice(0) };`, 40000);
    const after = await p1.eval(`const H = globalThis.__h75, webrtc = game.webrtc;
        if (H.own) Object.defineProperty(webrtc, "connect", H.own); else delete webrtc.connect;
        return { room: game.webrtc.client.room ?? null };`);
    const gmOff = await gm.eval(`${GMJS}
        await game.settings.set("${MOD}", "voiceEnabled", false);
        await sleep(600);
        Hooks.off("updateToken", H.hook);
        game.socket.emit = H.emit;
        await aiko.update({ x: 300, y: 300 }, ${MOVE}); await botan.update({ x: 1300, y: 300 }, ${MOVE});
        delete globalThis.__h75;
        return { voice: game.settings.get("${MOD}", "voiceEnabled"), aiko: [aiko.x, aiko.y], botan: [botan.x, botan.y] };`, { timeout: 30000 });
    const hOff = await p1.eval(`const H = globalThis.__h75, VC = await import("${repoUrl}/scripts/voice-client.mjs");
        const sleep = ms => new Promise(r => setTimeout(r, ms)), end = Date.now() + 3000;
        while (Date.now() < end && game.webrtc.client.room !== __liveKit.MAIN_ROOM) await sleep(20);
        Hooks.off("drpgVoiceApplying", H.fn);
        console.debug = H.log;
        await game.settings.set("${MOD}", "debug", H.debugWas);
        VC.forgetDesiredRoom();
        delete globalThis.__h75;
        return { room: game.webrtc.client.room ?? null, main: __liveKit.MAIN_ROOM, debug: game.settings.get("${MOD}", "debug") };`, { timeout: 10000 });
    const once = (r, room, within, from = 0) => r.toP1.length === 1 && r.toP1[0].room === room && r.toP1[0].ms >= from && r.toP1[0].ms - from < within
        && r.applied.length === 1 && r.applied[0].room === room;
    check("H: a settled crossing - the GM moving Aiko from Dorm A into Dorm B - sends p1 Dorm B's room within 200 ms of the GM's update, once, and p1 stands there; the trailing pass 1500 ms later sends nothing more, and a move inside Dorm B sends nothing",
        hOn.installed === true && gmOn.plan === gmOn.want && landed === gmOn.want && once(cross, cross.want, 200)
            && inside.here === "Dorm B" && inside.toP1.length === 0 && inside.applied.length === 0,
        J({ gmOn, landed, cross, inside }));
    check("H: another student walking postpones nothing - Botan stepping inside the Cafeteria every second, four times, after Aiko crosses back into Dorm A: p1's room is still sent within 200 ms, once, and Botan's steps send p1 nothing",
        walk.botan === "Cafeteria" && walk.gm.filter(e => e.k === "hook" && e.id === "TOKBOTAN00000000").length === 4 && once(walk, walk.want, 200),
        J(walk));
    check("H: a drag's step still in flight sends nothing - Aiko's pending step through Dorm B sends p1 no room; the drag's last step into the Gym sends the Gym's room within 200 ms of it, once, and the trailing pass nothing more",
        drag.toP1.every(e => e.ms >= drag.last) && once(drag, drag.want, 200, drag.last),
        J(drag));
    const took = r => r.logs.map(line => /took (\d+) ms/.exec(line)).filter(Boolean).map(m => Number(m[1]));
    check("H: two rooms 1700 ms apart with p1's connect held 2000 ms - p1 ends in the second room after two reconnects and no third; p1's debug log says each connect took its 2000 ms, and each quicker one before took under 200 ms",
        chained.p1.filter(e => e.k === "applying").length === 2 && chained.applied.length === 2 && chained.applied[1].room === chained.want
            && after.room === chained.want
            && took(chained).length === 2 && took(chained).every(n => n >= 1990 && n < 3000)
            && [cross, walk, drag].every(r => took(r).length === 1 && took(r)[0] < 200),
        J({ chained, after, took: [cross, walk, drag, chained].map(took) }));
    check("H: put back - voice off, Aiko and Botan where the seed stands them, p1 in the main room with its debug setting as it was",
        gmOff.voice === false && J(gmOff.aiko) === J([300, 300]) && J(gmOff.botan) === J([1300, 300]) && hOff.room === hOff.main && hOff.debug === hOn.debugWas,
        J({ gmOff, hOff }));
}
