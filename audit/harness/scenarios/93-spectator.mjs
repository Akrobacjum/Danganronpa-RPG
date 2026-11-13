/**
 * 93-spectator: a Spectator at the table, from its assignment in the Students window to its return to the class
 * (E92 C7, 12.11.2026; plan docs/dev/plans/E92.md on claude/plan-130, the owner's E92 goal and its 04.11 amends).
 *
 * The GM and three players; p3's Chie is made a Spectator by the Students window's Role (gm-students.mjs
 * `changeRole`, the GM's road), and read on the browsers that each part is about:
 *   role     the GM's roster leaves her out (`studentActors`, the trial's cast); p3's browser watches
 *            (scripts/spectator.mjs `spectatorViewer`) and hides its chat (`drpg-spectator`); p1's browser hides her
 *            token (visibility.mjs `tokenShownTo` "hide") and p3's leaves every student's to Foundry (null);
 *   voice    the primary blocks p3's BROADCAST_AUDIO by the trial's own write and row (voice.mjs `settleTrialVoices`),
 *            and p3's tile names it held, "spectator" (`micHold`);
 *   map      Aiko has found the Cafeteria and Botan, the Mastermind, the Hall: p3's copy of the ledger is one row
 *            under Chie's own id (gm-stores.mjs `spectatorFogSection`), with the Cafeteria and not the Hall; p3's
 *            world data read against world-secrets.mjs and for the Mastermind's id (`canary.worldScan`);
 *   talk     the "Talk with the Spectators" switch on p3's voice tile and not on p1's (voice-tile.mjs
 *            `paintSpectatorTalk`, round 3): a press writes p3's own flag, a second takes it off;
 *   ghost    p3 drags Chie into Aiko's room and then into the Hall (its own token write): no action spent, no room
 *            found for her, and she is nobody in Aiko's room (`othersInRoom`);
 *   board    the end-of-day board on p3's browser holds the day's heading and the school's mood alone, and p1's keeps
 *            its own day (sequence.mjs `playDayEnd`, `dayEndBoardFor`);
 *   back     the GM makes her a student again: p3's microphone as it was found, the class's rooms off her map,
 *            p3's browser no Spectator's.
 * Everything is put back: the role, the token, the cells, the Mastermind, p3's permission.
 *
 * What this cannot see: a real LiveKit (the harness's shim), Foundry's wall collision on a player's drag
 * (LIVE-E92-02), the canvas's grey token (LIVE-E92-04), and the chat's CSS on a real sidebar.
 */
export const layers = ["ci"];


export async function run({ gm, p1, p2, p3, check, phase, settle, canary, repoUrl: REPO, IDS }) {
    const imp = file => `await import("${REPO}/scripts/${file}")`;
    const p3User = await p3.eval(`return game.user.id;`);

    phase("setup");
    const before = await gm.eval(`const F = ${imp("fog.mjs")}, MM = ${imp("mastermind.mjs")};
        const scene = canvas.scene, t = scene.tokens.get("TOKCHIE000000000"), u = game.users.get("${p3User}");
        const own = (u._source ?? u).permissions ?? {};
        const rows = Object.fromEntries(["${IDS.aiko}", "${IDS.botan}", "${IDS.chie}"].map(id => [id, F.discoveredFor(scene.id, id).slice()]));
        return { scene: scene.id, x: t.x, y: t.y, rows, mastermind: MM.mastermindActor()?.id ?? null,
            perm: [Object.hasOwn(own, "BROADCAST_AUDIO"), own.BROADCAST_AUDIO ?? null], actions: game.drpg.actionsLeft(game.actors.get("${IDS.chie}")) };`);
    check("setup: the scene, Chie's token and the three students' rows are read", Boolean(before?.scene && Number.isFinite(before.x)), JSON.stringify(before));
    const fixture = await gm.eval(`const F = ${imp("fog.mjs")}, MM = ${imp("mastermind.mjs")};
        const scene = canvas.scene, u = game.users.get("${p3User}");
        await u.update({ "permissions.BROADCAST_AUDIO": true });
        await F.applyDiscoveryChanges(scene, [{ actorId: "${IDS.aiko}", room: "Cafeteria", value: true }, { actorId: "${IDS.botan}", room: "Hall", value: true },
            { actorId: "${IDS.chie}", room: "Hall", value: false }, { actorId: "${IDS.chie}", room: "Cafeteria", value: false }]);
        await MM.setMastermind(game.actors.get("${IDS.botan}"));
        return { aiko: F.discoveredFor(scene.id, "${IDS.aiko}").includes("Cafeteria"), botan: F.discoveredFor(scene.id, "${IDS.botan}").includes("Hall"),
            mastermind: MM.mastermindActor()?.id ?? null };`, { timeout: 60000 });
    check("setup: Aiko holds the Cafeteria found, Botan the Hall, and Botan is the Mastermind",
        fixture?.aiko === true && fixture?.botan === true && fixture?.mastermind === IDS.botan, JSON.stringify(fixture));
    await settle(800);

    const projects = { pub: null, sec: null };
    try {
        phase("role");
        const role = await gm.eval(`const GS = ${imp("gm-students.mjs")}, M = ${imp("monokuma.mjs")}, TS = ${imp("trial-scene.mjs")};
            const chie = game.actors.get("${IDS.chie}");
            const moved = await GS.changeRole(chie, "spectator");
            return { moved, spectator: M.isSpectator(chie), roster: M.studentActors().some(a => a.id === chie.id), cast: TS.castActors().some(a => a.id === chie.id) };`);
        await settle(1500);
        check("role: the Students window's Role makes Chie a Spectator, out of the GM's roster and the trial's cast",
            role?.moved === true && role.spectator === true && role.roster === false && role.cast === false, JSON.stringify(role));
        const watching = await p3.eval(`const S = ${imp("spectator.mjs")}, V = ${imp("visibility.mjs")};
            const aiko = canvas.scene.tokens.get("TOKAIKO000000000");
            return { viewer: S.spectatorViewer(), chatHidden: document.body.classList.contains("drpg-spectator"), sees: V.tokenShownTo(aiko, V.viewerHere()) };`);
        const hidden = await p1.eval(`const V = ${imp("visibility.mjs")};
            return V.tokenShownTo(canvas.scene.tokens.get("TOKCHIE000000000"), V.viewerHere());`);
        check("role: p3's browser watches, hides its chat and leaves Aiko's token to Foundry; p1's hides Chie's",
            watching?.viewer === true && watching.chatHidden === true && watching.sees === null && hidden === "hide", JSON.stringify({ watching, hidden }));

        phase("chat");
        /* Q-E92-4 (the owner's DRPG-D1, 12.11: "Zablokowac; postac widza nie ma swojego czatu"). p3's console posts to the
           chat twice: once as a page would (its own browser's hook refuses it), and once with that hook taken off, as a
           console can. Nothing may stay for the table: no such message on the GM's, p1's or p3's browser after the GMs
           have had it, and none drawn on p1's. */
        const SAID = "E92 SPECTATOR SAYS";
        const posted = await p3.eval(`const out = {};
            try { out.page = Boolean(await ChatMessage.create({ content: "${SAID} 1" })); } catch (err) { out.page = "threw"; }
            const kept = Hooks.events.preCreateChatMessage ? [...Hooks.events.preCreateChatMessage] : [];
            if (Hooks.events.preCreateChatMessage) Hooks.events.preCreateChatMessage.length = 0;
            try { out.console = Boolean(await ChatMessage.create({ content: "${SAID} 2" })); } catch (err) { out.console = "threw"; }
            if (Hooks.events.preCreateChatMessage) Hooks.events.preCreateChatMessage.push(...kept);
            return out;`);
        await settle(2000);
        const heard = c => c.eval(`return { messages: game.messages.contents.filter(m => String(m.content ?? "").includes("${SAID}")).length,
            drawn: document.body.innerHTML.includes("${SAID}") };`);
        const chatSeen = { gm: await heard(gm), p1: await heard(p1), p3: await heard(p3) };
        check("chat: a Spectator's message reaches nobody - refused on its own browser, and one its console forces past that is gone from every browser",
            posted?.page === false && ["gm", "p1", "p3"].every(k => chatSeen[k]?.messages === 0 && chatSeen[k].drawn === false),
            JSON.stringify({ posted, chatSeen }));

        phase("voice");
        await settle(1200);
        const voice = await gm.eval(`const u = game.users.get("${p3User}"), own = (u._source ?? u).permissions ?? {};
            const S = ${imp("gm-stores.mjs")}, r = S.trialMuteStore.get(u.id);
            return { perm: own.BROADCAST_AUDIO ?? null, row: r ? { had: r.had, value: r.value, wrote: r.wrote } : null };`);
        const tile = await p3.eval(`const V = ${imp("voice.mjs")};
            return V.micHold({ room: "drpg-somewhere", external: false, connected: true, canBroadcastAudio: true });`);
        check("voice: the primary blocks p3's microphone by the trial's row, and p3's tile names it held",
            voice?.perm === false && voice.row?.wrote === true && voice.row.had === true && voice.row.value === true
            && tile?.reason === "spectator" && tile.held === true, JSON.stringify({ voice, tile }));

        phase("map");
        await settle(800);
        const map = await p3.eval(`const F = ${imp("fog.mjs")}, { readMine } = ${imp("gm-store.mjs")};
            const rooms = [...F.myDiscoveredRooms(canvas.scene)].sort();
            const copy = readMine("fog") ?? {};
            return { rooms, keys: Object.keys(copy?.e ?? {}).sort() };`);
        check("map: p3's map holds the room Aiko found and not the Mastermind's, in one row under Chie's own id",
            map?.rooms?.includes("Cafeteria") && !map.rooms.includes("Hall") && map.keys.length >= 1 && map.keys.every(k => k.endsWith(`/${IDS.chie}`)),
            JSON.stringify(map));
        await canary.worldScan({ who: ["p3"], ids: [IDS.botan] });

        phase("projects");
        /* Q-E92-6 (DRPG-D1: "Widzi wszystkie projekty w tym prywatne"). The GM makes a public project in the Gym, a room
           nobody here found, and a secret one there with words of its own, shared with nobody. p3 (the Spectator) knows
           both - their names and progress - but not the secret one's words, which stay the GMs' (the coordinator's 12.11:
           "secret projects stay secret (GMs' half untouched)"); p1 (a student) knows neither and holds no words; the
           countdown's ownership names p3 an observer and, since S17-31 (1.2.112), p1 as well: the map tells no player
           apart, and what keeps p1 out is the module (canSee, read below). */
        const made = await gm.eval(`const P = ${imp("projects.mjs")};
            const pub = await P.createProject({ name: "E92 public work", target: 6, room: "Gym", secret: false });
            const sec = await P.createProject({ name: "E92 secret work", target: 6, room: "Gym", secret: true, description: "E92 secret words" });
            return { pub: pub?.id ?? null, sec: sec?.id ?? null };`, { timeout: 60000 });
        projects.pub = made?.pub ?? null;
        projects.sec = made?.sec ?? null;
        await settle(2500);
        // A card's words travel veiled, apart from its document (secret.mjs), so both are read, as 30 reads them.
        const knows = c => c.eval(`const P = ${imp("projects.mjs")}, S = ${imp("secret.mjs")};
            return { pub: P.knowsProject("${made?.pub}"), sec: P.knowsProject("${made?.sec}"), seeSec: P.canSee("${made?.sec}"),
                words: game.messages.contents.some(m => JSON.stringify(m.toObject()).includes("E92 secret words")
                    || String(S.secretHtml(m) ?? "").includes("E92 secret words")) };`);
        const own = await gm.eval(`const S = ${imp("projects-secrecy.mjs")};
            const o = S.rawCountdown("${made?.sec}")?.ownership ?? {};
            return { p3: o["${p3User}"] ?? null, p1: o["${IDS.p1}"] ?? null };`);
        const sight = { p3: await knows(p3), p1: await knows(p1), own };
        check("projects: the Spectator knows every project in a room nobody found, the secret one too but not its words; a student knows neither",
            sight.p3?.pub === true && sight.p3.sec === true && sight.p3.seeSec === true && sight.p3.words === false
            && sight.p1?.pub === false && sight.p1.sec === false && sight.p1.seeSec === false && sight.p1.words === false
            && own?.p3 === 2 && own.p1 === 2, JSON.stringify(sight));
        // And a student's browser holds nothing more for it: p1's world data read against world-secrets.mjs.
        await canary.worldScan({ who: ["p1"], ids: [IDS.botan] });

        phase("talk");
        /* The switch in the voice tile (E92 round 3): on p3's tile, after its microphone and speaker; on p1's none. A press
           writes p3's own User flag and the primary sends p3 to the Spectators' room; a second press takes it back. */
        /* The harness draws a tile only on a browser with its LiveKit shim (lib/livekit.mjs, as 75 installs it); both
           browsers read are given one and put back in the finally. */
        const voiceOn = c => c.eval(`if (typeof globalThis.__liveKit?.install !== "function") return false;
            const installed = await __liveKit.install(); await game.webrtc.connect();
            (${imp("voice-tile.mjs")}).refreshVoiceTile(); return installed;`, { timeout: 15000 });
        const shims = { p3: await voiceOn(p3), p1: await voiceOn(p1) };
        await settle(800);
        const tileOf = c => c.eval(`const t = document.getElementById("drpg-voice-tile");
            const b = t?.querySelector(".drpg-voice-tile-controls > .drpg-voice-spectator-talk");
            return { tile: Boolean(t), button: b ? { label: b.getAttribute("aria-label"), pressed: b.getAttribute("aria-pressed"),
                after: b.previousElementSibling?.classList.contains("drpg-voice-speaker") ?? false } : null };`);
        const press = () => p3.eval(`document.querySelector("#drpg-voice-tile .drpg-voice-spectator-talk")?.click(); return true;`);
        const talkOff = await tileOf(p3), talkP1 = await tileOf(p1);
        await press();
        await settle(2000);
        const talkOn = await tileOf(p3);
        const there = await gm.eval(`const { SPECTATOR_ROOM } = ${imp("voice-client.mjs")};
            const u = game.users.get("${p3User}");
            return { flag: u.getFlag("danganronpa-rpg", "spectatorTalk") ?? null, room: SPECTATOR_ROOM };`);
        await press();
        await settle(2000);
        const talkBack = await tileOf(p3);
        const flagBack = await gm.eval(`return game.users.get("${p3User}").getFlag("danganronpa-rpg", "spectatorTalk") ?? null;`);
        check("talk: p3's tile holds the switch after its speaker and p1's none; a press turns it on, a second takes it off, the label following",
            talkOff?.button?.pressed === "false" && talkOff.button.after === true && talkP1?.tile === true && talkP1.button === null
            && there?.flag === true && talkOn?.button?.pressed === "true" && talkOn.button.label !== talkOff.button.label
            && talkBack?.button?.pressed === "false" && flagBack === null,
            JSON.stringify({ shims, talkOff, talkP1, there, talkOn, talkBack, flagBack }));

        phase("ghost");
        /* A Spectator moves by dragging its own token (round 3 took the room picker and its bridge action out): p3's own
           write of Chie's token, as Foundry's drag makes it. The harness models no wall stop (LIVE-E92-02). */
        const drag = (x, y) => p3.eval(`try { await canvas.scene.tokens.get("TOKCHIE000000000").update({ x: ${x}, y: ${y} }); return { ok: true }; }
            catch (err) { return { ok: false, error: String(err?.message ?? err) }; }`);
        const intoDorm = await drag(400, 400);
        await settle(1500);
        const company = await gm.eval(`const M = ${imp("movement.mjs")};
            return { room: M.roomOfToken(canvas.scene.tokens.get("TOKCHIE000000000")), others: M.othersInRoom(game.actors.get("${IDS.aiko}")).map(a => a.id) };`);
        const intoHall = await drag(2400, 400);
        await settle(1500);
        const ghost = await gm.eval(`const F = ${imp("fog.mjs")}, M = ${imp("movement.mjs")};
            const t = canvas.scene.tokens.get("TOKCHIE000000000");
            return { x: t.x, y: t.y, room: M.roomOfToken(t), found: F.discoveredFor(canvas.scene.id, "${IDS.chie}").includes("Hall"),
                actions: game.drpg.actionsLeft(game.actors.get("${IDS.chie}")) };`);
        check("ghost: p3 drags Chie into Aiko's room, where she is nobody, then into the Hall: no action spent, no room found",
            intoDorm?.ok === true && company?.room === "Dorm A" && !company.others.includes(IDS.chie)
            && intoHall?.ok === true && ghost?.room === "Hall" && ghost.found === false && ghost.actions === before.actions,
            JSON.stringify({ intoDorm, company, intoHall, ghost }));

        phase("board");
        /* The owner's word of 12.11.2026 on E92 with E94: "Dostaje tylko koniec dnia i nastroj szkoly". Each browser plays
           the end-of-day board as transitions.mjs does at a new day (`playDayEnd`, no card kept), over a day that began at
           the epoch, so whatever the world's chat holds counts; the drawn board is read from the page, then cut. p3's
           holds the heading and the mood's word alone; p1's keeps its own day and its chapter. Red at 7872146d, whose
           Spectator's board was a player's with "A quiet day." and the school's cards. */
        const boardOf = c => c.eval(`const S = ${imp("sequence.mjs")}, C = ${imp("settings.mjs")};
            const was = C.getClock(), day = 9000 + Math.floor(Math.random() * 999);
            const before = { ...was, day, chapter: was.chapter ?? 1, dayStartedAt: 1 }, after = { ...was, day: day + 1, mood: "uneasy", timeOfDayStartedAt: Date.now() };
            const played = await S.playDayEnd(before, after, { on: true, keep: false });
            const el = document.querySelector("#" + S.SEQUENCE_HOST_ID + " .drpg-seq-dayend");
            const read = el ? { title: el.querySelector(".drpg-seq-day-title")?.textContent ?? null, want: game.i18n.format("DRPG.Sequence.dayEndTitle", { day }),
                sub: Boolean(el.querySelector(".drpg-seq-day-sub")), yours: Boolean(el.querySelector(".drpg-seq-yours")),
                rows: el.querySelectorAll(".drpg-seq-row").length, mood: el.querySelector(".drpg-seq-mood")?.dataset.drpgMood ?? null,
                parts: [...el.children].map(x => x.className) } : null;
            S.endSequence("cut");
            return { played, read };`);
        const boardP3 = await boardOf(p3), boardP1 = await boardOf(p1);
        const w = boardP3?.read, pl = boardP1?.read;
        check("board: p3's end-of-day board holds the day's heading and the school's mood and nothing else; p1's keeps its own day and its chapter",
            Boolean(w) && w.title === w.want && w.sub === false && w.yours === false && w.rows === 0 && w.mood === "uneasy"
            && JSON.stringify(w.parts) === JSON.stringify(["drpg-seq-day-title", "drpg-seq-mood"])
            && Boolean(pl) && pl.title === pl.want && pl.sub === true && pl.yours === true && pl.mood === "uneasy",
            JSON.stringify({ boardP3, boardP1 }));

        phase("back");
        const back = await gm.eval(`const GS = ${imp("gm-students.mjs")}, M = ${imp("monokuma.mjs")};
            const chie = game.actors.get("${IDS.chie}");
            return { moved: await GS.changeRole(chie, "student"), spectator: M.isSpectator(chie), roster: M.studentActors().some(a => a.id === chie.id) };`);
        await settle(2000);
        const after = await gm.eval(`const u = game.users.get("${p3User}"), own = (u._source ?? u).permissions ?? {};
            const S = ${imp("gm-stores.mjs")};
            return { perm: [Object.hasOwn(own, "BROADCAST_AUDIO"), own.BROADCAST_AUDIO ?? null], row: S.trialMuteStore.has(u.id) };`);
        const p3After = await p3.eval(`const F = ${imp("fog.mjs")}, S = ${imp("spectator.mjs")}, P = ${imp("projects.mjs")};
            return { viewer: S.spectatorViewer(), chatHidden: document.body.classList.contains("drpg-spectator"),
                rooms: [...F.myDiscoveredRooms(canvas.scene)].sort(), secret: P.canSee("${projects.sec}") };`);
        check("back: Chie is a student again, p3's microphone as it was found, the class's rooms off her map and the secret project out of her sight, p3's browser no Spectator's",
            back?.moved === true && back.spectator === false && back.roster === true && JSON.stringify(after?.perm) === JSON.stringify([true, true])
            && after.row === false && p3After?.viewer === false && p3After.chatHidden === false && !p3After.rooms.includes("Cafeteria")
            && p3After.secret === false,
            JSON.stringify({ back, after, p3After }));
    } finally {
        for (const c of [p3, p1]) {
            await c.eval(`if (globalThis.__liveKit?.installed === true) { __liveKit.uninstall(); (${imp("voice-tile.mjs")}).refreshVoiceTile(); } return true;`).catch(() => null);
        }
        await gm.eval(`const P = ${imp("projects.mjs")};
            for (const id of ${JSON.stringify([projects.pub, projects.sec].filter(Boolean))}) await P.deleteProject(id);
            return true;`, { timeout: 60000 }).catch(() => null);
        await gm.eval(`const GS = ${imp("gm-students.mjs")}, M = ${imp("monokuma.mjs")}, F = ${imp("fog.mjs")}, MM = ${imp("mastermind.mjs")};
            const { forcedDeletion } = ${imp("utils.mjs")};
            const chie = game.actors.get("${IDS.chie}"), scene = canvas.scene, u = game.users.get("${p3User}");
            if (M.isSpectator(chie)) await GS.changeRole(chie, "student");
            await scene.tokens.get("TOKCHIE000000000").update({ x: ${before?.x ?? 350}, y: ${before?.y ?? 1300} }, { animate: false });
            const was = ${JSON.stringify(before?.rows ?? {})};
            const changes = [];
            for (const [id, rooms] of Object.entries(was)) {
                for (const room of ["Cafeteria", "Hall"]) changes.push({ actorId: id, room, value: rooms.includes(room) });
            }
            await F.applyDiscoveryChanges(scene, changes);
            const mm = ${JSON.stringify(before?.mastermind ?? null)};
            if (mm) await MM.setMastermind(game.actors.get(mm)); else await MM.clearMastermind();
            const perm = ${JSON.stringify(before?.perm ?? [false, null])};
            await u.update({ "permissions.BROADCAST_AUDIO": perm[0] ? perm[1] : forcedDeletion() });
            if (u.getFlag("danganronpa-rpg", "spectatorTalk") !== undefined) await u.unsetFlag("danganronpa-rpg", "spectatorTalk");
            return true;`, { timeout: 60000 });
        await settle(1500);
    }
}
