/**
 * S5 on Forge: voice per room on Forge's LiveKit, six browsers (the road to 2.0, F3; written 24.11.2026, NEVER RUN).
 * ---------------------------------------------------------------------------
 *     DRPG_FAKE_MEDIA=1 DRPG_FORGE_URL=... DRPG_FORGE_WORLD=DRPG-QA-Forge node audit/forge/run.mjs s5-voice
 *
 * On the owner's PC (D2-04): a real network to livekit.forge-vtt.com and Chromium's fake microphone (DRPG_FAKE_MEDIA=1;
 * Firefox's fake streams with DRPG_BROWSER=firefox). Without DRPG_FAKE_MEDIA=1 it records one failed check and stops.
 *
 * THE READING. For every page: the room its LiveKit client is in (`game.webrtc.client.room`, the Room's `state`),
 * sampled every 100 ms in the page (../table.mjs `installKit`), against the room the primary GM's plan wants for that
 * account (`game.drpg.voiceTargets()`, the decision the reconcile loop sends: null is the main room, the player's own
 * `drpg-eclipse-<id>` is "out of voice"). A phase acts, then polls the plan and every page until they agree, then reads
 * each page's log: when it began to match, how long it was between rooms (gap), how long its Room was not connected
 * (silent), how many times it came into "connected" (reconnects), the rooms it passed through, the module's own
 * count of connects (`game.drpg.counters()` "voice.connect", "voice.connect.ms") and its Debug lines "the connect for X
 * took N ms" (the client setting `debug` is turned on in each test browser for the run and put back).
 *
 * THE CHECK in every phase is one: every page ends in the room the plan names, within the phase's time. Everything
 * else is a measurement, in the notes as numbers, never a verdict: VOICE-01 (a crossing is a reconnect; how long),
 * VOICE-02 (a quick A->B->C walk: how many connects, and was B joined), VOICE-07 (the Eclipse's start and end: how
 * many pages reconnect within one second of each other), VOICE-05 (the primary GM leaving: how long until the second GM
 * runs a pass, and where a token outside every room goes), VOICE-06 (a reload: how many connects), PRIM-02 (the first GM
 * coming back takes the role back), FORGE-03 (LiveKit's toasts).
 *
 * PHASES
 *   preconditions   DRPG_FAKE_MEDIA=1; the world's A/V mode; regional voice on (turned on for the run when off, and
 *                   put back); no Eclipse running (ended without advancing when one is); every page's Room connected
 *                   within 120 s - when none connects, why (the module's voice diagnosis, the LiveKit toasts) and stop
 *   setup           the active scene's rooms read by the module's own hit test; p1-p4's characters placed by GM1 (a
 *                   token created where the character has none), p1 in room A, the others in three more rooms; GMs'
 *                   Monokuma tokens left where they are; the game unpaused
 *   single move     p1 A -> B (GM1's update of x and y, as a drop writes it)
 *   join            p2 into B, p1's room: both pages end in one LiveKit room (noted with each one's peers)
 *   back            p1 B -> A
 *   walk            p1 A -> B -> C, DRPG_S5_STEP_MS (400) between the two writes; then C -> B -> A at 2500 ms
 *   all at once     p1-p4 each to another room in one write
 *   offline         p4's browser offline for 15 s (context.setOffline), then back
 *   eclipse         the primary GM's startEclipse, then endEclipse({ advance: false }) (VOICE-07)
 *   reload          p3's F5 (VOICE-06)
 *   primary leaves  p4 stood outside every room beside two (a doorway or corridor the scan found), then GM1's browser
 *                   closed: GM2 becomes the primary (VOICE-05, PRIM-03)
 *   primary returns GM1 logs in again (PRIM-02)
 *   end             LiveKit toasts on every page (FORGE-03); the module's errors on every page
 *
 * WRITES TO THE WORLD: tokens for P1-P4 on the active scene where they had none (kept, so a second run finds them) and
 * their moves (the tokens that stood before are put back where they stood); the regional voice setting when it was off
 * (put back); an Eclipse started and ended without advancing (its whispers and cards stay in the chat; the clock's
 * eclipse flag back to false); the pause lifted (not put back). Each test browser's own client setting `debug`.
 *
 * UNMEASURED: everything ../table.mjs's header lists; that `endEclipse({ advance: false })` leaves the clock where it
 * was; that a GM's plain update moves a player's token through walls (a GM's move is free and never refused,
 * movement.mjs `onUpdateToken`); that `voiceTargets()` read on the primary as a dry run changes nothing a pass would
 * not (it runs the same `keepRoomsThroughGaps` the pass runs); that Foundry keeps a page that was offline 15 s rather
 * than reloading it (read: the kit's `timeOrigin` says whether it reloaded).
 */

import { config } from "../lib.mjs";
import { J, sleep, inPage, ensureKit, present, readTable, placeTokens, moveTokens, unpause, chooseRooms, converge,
    planOf, primaryRole, voiceCounters, liveKitToasts, moduleErrors } from "../table.mjs";

export const meta = {
    id: "s5-voice",
    title: "Voice per room on Forge's LiveKit: crossings, a walk, offline, an Eclipse, a reload, the primary GM leaving",
    roles: ["gm1", "gm2", "p1", "p2", "p3", "p4"],
    writes: true,
    triage: ["VOICE-01", "VOICE-02", "VOICE-05", "VOICE-06", "VOICE-07", "PRIM-02", "PRIM-03", "FORGE-03"]
};

const GMS = ["gm1", "gm2"];
const PLAYERS = ["p1", "p2", "p3", "p4"];
const ALL = [...GMS, ...PLAYERS];
const STEP_MS = Number(process.env.DRPG_S5_STEP_MS || 400);

/* One page's measurement in a line of numbers. */
const line = a => a.none ? "no samples" : [
    `target ${a.target ?? "main"}`, a.matched ? `matched +${a.matchedAfterMs} ms` : "NOT matched",
    a.gapMs !== null ? `gap ${a.gapMs} ms` : "no gap", `silent ${a.silentMs} ms`, `reconnects ${a.reconnects}`,
    a.connectMs?.length ? `connects ${a.connectMs.join("/")} ms` : "connects -", a.rooms?.length ? `rooms ${a.rooms.join(" > ")}` : null,
    a.noPlanRow ? "NO PLAN ROW" : null
].filter(Boolean).join(", ");

/* How many pages left their room within one second of each other, at most (VOICE-07). */
function burst(per) {
    const times = Object.values(per).map(a => a.leftAfterMs).filter(v => Number.isFinite(v)).sort((a, b) => a - b);
    let most = 0;
    for (let i = 0; i < times.length; i++) most = Math.max(most, times.filter(t => t >= times[i] && t < times[i] + 1000).length);
    return { inOneSecond: most, leftAt: times };
}

export async function run(ctx) {
    const { check, note, phase, settle } = ctx;
    const restore = { tokens: [], voiceWas: null, debugWas: {}, eclipseStarted: false };
    let table = null;
    const users = {};

    phase("preconditions");
    if (!config.fakeMedia) {
        check("preconditions: S5 runs with DRPG_FAKE_MEDIA=1 (a fake microphone, so A/V can connect)", false,
            "DRPG_FAKE_MEDIA is not 1: without a microphone LiveKit publishes nothing and the voice readings measure nothing", { ids: ["VOICE-01"] });
        return;
    }
    if (!ctx.c.gm1) { check("preconditions: GM1 logged in", false, "GM1 did not log in; every phase acts through GM1"); return; }

    /* Every page: the kit, its sampler, the Debug lines for the connect's length. */
    for (const role of present(ctx, ALL)) {
        await ensureKit(ctx, role);
        await inPage(ctx, role, () => window.__qa.startSampler(100));
        restore.debugWas[role] = await inPage(ctx, role, async mod => {
            const was = game.settings.get(mod, "debug");
            if (!was) await game.settings.set(mod, "debug", true);
            return was;
        }, "danganronpa-rpg");
    }

    try {
        const world = await inPage(ctx, "gm1", async () => {
            const modes = foundry.av?.AVSettings?.AV_MODES ?? {};
            let voice = null, eclipse = null;
            try { voice = game.settings.get("danganronpa-rpg", "voiceEnabled"); } catch (err) { voice = `threw: ${err.message}`; }
            try { eclipse = game.drpg.isEclipse(); } catch { eclipse = null; }
            return { mode: game.webrtc?.mode ?? null, modeName: Object.entries(modes).find(([, v]) => v === game.webrtc?.mode)?.[0] ?? null,
                avclient: game.modules.get("avclient-livekit")?.active ?? false, avVersion: game.modules.get("avclient-livekit")?.version ?? null, voice, eclipse };
        });
        note("preconditions: the world's A/V", J(world));
        if (!world.avclient || world.modeName === "DISABLED") {
            check("preconditions: avclient-livekit is active and the world's A/V mode is not DISABLED", false, J(world), { ids: ["VOICE-01"] });
            return;
        }
        if (world.voice !== true) {
            restore.voiceWas = world.voice;
            await inPage(ctx, "gm1", () => game.settings.set("danganronpa-rpg", "voiceEnabled", true));
            note("preconditions: regional voice was off; turned on for the run, put back at the end", J(world.voice));
        }
        if (world.eclipse) {
            await inPage(ctx, "gm1", () => game.drpg.endEclipse({ advance: false }), null, { timeout: 120_000 });
            note("preconditions: an Eclipse was running; ended without advancing", "");
            await settle(3000);
        }

        /* Every page's Room connected, up to 120 s. */
        const t0 = Date.now();
        let reads = {};
        while (Date.now() - t0 < 120_000) {
            reads = {};
            for (const role of present(ctx, ALL)) reads[role] = await inPage(ctx, role, () => window.__qa.av()).catch(err => ({ err: err.message }));
            if (Object.values(reads).every(r => r.state === "connected")) break;
            await sleep(2000);
        }
        const connected = Object.entries(reads).filter(([, r]) => r.state === "connected").map(([role]) => role);
        note("preconditions: A/V on every page after the wait", `${Date.now() - t0} ms; ${J(reads)}`);
        if (!connected.length) {
            const why = {};
            for (const role of present(ctx, ALL)) {
                why[role] = await inPage(ctx, role, async () => {
                    let lines = null;
                    try { lines = (await window.__qa.mod("diagnostics.mjs")).voiceDiagnosis(); } catch (err) { lines = [`voiceDiagnosis threw: ${err?.message ?? err}`]; }
                    return { av: window.__qa.av(), lines };
                }).catch(err => ({ err: err.message }));
                why[role].toasts = await liveKitToasts(ctx, role).catch(err => ({ err: err.message }));
            }
            check("preconditions: A/V connects on at least one page (Forge's LiveKit, the fake microphone)", false, J(why), { ids: ["VOICE-01", "FORGE-03"] });
            return;
        }
        for (const role of present(ctx, ALL)) {
            check(`preconditions: ${role}'s LiveKit Room is connected within 120 s`, reads[role]?.state === "connected", J(reads[role]), { ids: ["VOICE-01"] });
        }

        phase("setup");
        table = await readTable(ctx, "gm1", ALL);
        if (table.error) { check("setup: an active scene", false, table.error); return; }
        const { chain, neighboursChain, spare, all } = chooseRooms(table, 3);
        note("setup: the scene and its rooms", J({ scene: table.sceneName, grid: table.grid, step: table.step, cells: table.cells, scanMs: table.scanMs,
            named: table.named.length, found: all.length, chain, neighboursChain, spare, gap: table.gap, who: table.who }));
        const [A, B, C] = chain;
        const D = spare[0] ?? A, E = spare[1] ?? B, F = spare[2] ?? C;
        if (!(A && B && C) || !table.gap) {
            check("setup: the scene has three rooms with a spot each and a spot outside every room", false, J({ chain, gap: table.gap }));
            return;
        }
        for (const role of ALL) users[role] = table.who[role]?.userId;
        const missing = PLAYERS.filter(r => !table.who[r]?.actorId);
        if (missing.length) { check("setup: P1-P4 each have a character", false, J(missing.map(r => [r, table.who[r]]))); return; }
        /* A dead student is a Spectator, whom the plan sends to the spectators' room wherever their token stands. The
           first S5 run on the owner's PC (25.11.2026) came after S1a and S1b (PROMPT-PC.md's order), which left P1
           executed and P3 killed: every "the plan sends p1 to ..." read drpg-spectators. A dead P1-P4 is revived here,
           quietly, by S1a's road (game.drpg.reviveCharacter), and the note says whom. */
        const revived = await inPage(ctx, "gm1", async ids => {
            const out = [];
            for (const id of ids) {
                const a = game.actors.get(id);
                if (a && game.drpg.isDeadForGm(a)) { await game.drpg.reviveCharacter(a, { quiet: true }); out.push(a.name); }
            }
            return out;
        }, PLAYERS.map(r => table.who[r].actorId), { timeout: 120_000 });
        note("setup: dead students revived before the run (a Spectator's voice room is not a room's)", J(revived));
        const spot = name => table.rooms[name];
        const start = { p1: A, p2: D, p3: E, p4: F };
        const placed = await placeTokens(ctx, "gm1", table.sceneId, PLAYERS.map(role => ({ role, actorId: table.who[role].actorId, tokenId: table.who[role].tokenId, ...spot(start[role]) })));
        const token = Object.fromEntries(PLAYERS.map(r => [r, placed[r]?.tokenId]));
        /* Put back at the end: a token that stood before to where it stood, one created here to its start room. */
        for (const role of PLAYERS) {
            if (token[role]) restore.tokens.push({ tokenId: token[role], ...(table.who[role].tokenId ? table.who[role].at : { x: spot(start[role]).x, y: spot(start[role]).y }) });
        }
        check("setup: P1-P4's tokens stand in the rooms they were placed in (the module's own reading)",
            PLAYERS.every(r => placed[r]?.room === start[r]), J({ start, placed }));
        const wasPaused = await unpause(ctx, "gm1");
        note("setup: the game was paused, unpaused for the run", J(wasPaused));
        const liveKitNames = await inPage(ctx, "gm1", async ({ sceneId, rooms }) => {
            try { const V = await window.__qa.mod("voice.mjs"); return Object.fromEntries(rooms.map(r => [r, V.liveKitRoomFor(sceneId, r)])); } catch (err) { return { threw: err.message }; }
        }, { sceneId: table.sceneId, rooms: [A, B, C, D, E, F] });
        note("setup: the LiveKit names of the rooms used (voice.mjs liveKitRoomFor)", J(liveKitNames));
        const sameCopy = {};
        for (const role of present(ctx, ALL)) sameCopy[role] = await inPage(ctx, role, () => window.__qa.sameInstance());
        note("setup: an import() of the module's files reaches the copy the page runs (desiredRoom is read through it)", J(sameCopy));

        /* One measured phase: counters before, act, converge, counters after; one check, one note of numbers. */
        const move = (role, room) => ({ tokenId: token[role], ...spot(room) });
        const measured = async (label, act, { roles = present(ctx, ALL), planRole = null, timeout = 90_000, ids = [], expect = {} } = {}) => {
            const before = {};
            for (const r of roles) before[r] = await voiceCounters(ctx, r).catch(() => null);
            const since = Date.now();
            const acted = await act();
            const plan = planRole ?? (await primaryRole(ctx, GMS)) ?? present(ctx, GMS)[0];
            const res = await converge(ctx, { roles, planRole: plan, users, since, timeout });
            const counted = {};
            for (const r of roles) {
                const after = await voiceCounters(ctx, r).catch(() => null);
                counted[r] = before[r] && after ? { connects: after.connects - before[r].connects, connectMs: after.connectMs - before[r].connectMs } : null;
            }
            check(`${label}: every page ends in the room the primary GM's plan names (within ${timeout / 1000} s)`, res.allMatched,
                J({ planFrom: plan, missing: res.missing, plan: res.plan, last: res.lastReads }), { ids });
            /* The plan itself, where the phase knows the answer: the room's LiveKit name for the token's room. */
            for (const [r, room] of Object.entries(expect)) {
                if (!liveKitNames[room]) { note(`${label}: ${r}'s expected room has no LiveKit name to compare`, J(liveKitNames)); continue; }
                /* Where the token stands now by the module's own reading, and what the write answered: the first run on
                   the owner's PC (25.11.2026) found P2's and P4's plans on their old rooms and could not say whether the
                   token moved. Read for the details only; the check is unchanged. */
                const tokenNow = await inPage(ctx, plan, ({ sceneId, tokenId }) => {
                    const t = game.scenes.get(sceneId)?.tokens.get(tokenId);
                    return t ? { room: game.drpg.roomOfToken(t) ?? null, x: t.x, y: t.y } : null;
                }, { sceneId: table.sceneId, tokenId: token[r] }).catch(err => ({ threw: err.message }));
                check(`${label}: the plan sends ${r} to ${room}`, res.plan?.targets?.[users[r]] === liveKitNames[room],
                    J({ want: liveKitNames[room], plan: res.plan?.targets?.[users[r]], tokenNow, wrote: acted }), { ids });
            }
            note(`${label}: timings (ms from the write)`, [`converged in ${res.ms} ms`, ...Object.entries(res.per).map(([r, a]) =>
                `${r}: ${line(a)}; module connects ${counted[r]?.connects ?? "?"} (${counted[r]?.connectMs ?? "?"} ms)`)].join("\n"));
            return { ...res, acted, counted, since };
        };

        phase("initial placement");
        await measured("initial placement", async () => null, { timeout: 120_000, ids: ["VOICE-01"] });

        phase("single move");
        const single = await measured("single move: p1 A -> B", () => moveTokens(ctx, "gm1", table.sceneId, [move("p1", B)]), { ids: ["VOICE-01"], expect: { p1: B } });
        note("single move: pages other than p1 that reconnected (should be none)",
            J(Object.entries(single.per).filter(([r, a]) => r !== "p1" && a.reconnects > 0).map(([r, a]) => [r, a.reconnects])));

        phase("join");
        const join = await measured("join: p2 into B, p1's room", () => moveTokens(ctx, "gm1", table.sceneId, [move("p2", B)]), { ids: ["VOICE-01"], expect: { p1: B, p2: B } });
        note("join: p1 and p2 in one LiveKit room, and whom each hears (peers' identities, raw)",
            J({ p1: join.per.p1?.now, p2: join.per.p2?.now, sameRoom: Boolean(join.per.p1?.now?.room) && join.per.p1?.now?.room === join.per.p2?.now?.room,
                p1HearsP2: join.per.p1?.now?.peers?.includes(users.p2) ?? null, p2HearsP1: join.per.p2?.now?.peers?.includes(users.p1) ?? null }));

        phase("back");
        await measured("back: p1 B -> A", () => moveTokens(ctx, "gm1", table.sceneId, [move("p1", A)]), { ids: ["VOICE-01"], expect: { p1: A } });

        phase("walk");
        const walk = await measured(`walk: p1 A -> B -> C, ${STEP_MS} ms between the writes`, async () => {
            const first = await moveTokens(ctx, "gm1", table.sceneId, [move("p1", B)]);
            await sleep(STEP_MS);
            const second = await moveTokens(ctx, "gm1", table.sceneId, [move("p1", C)]);
            return { first, second };
        }, { ids: ["VOICE-02"], expect: { p1: C } });
        note(`walk: p1's connects for one walk through B (VOICE-02: 1 is the walk's own, 2 means B was joined on the way)`,
            J({ moduleConnects: walk.counted.p1?.connects, reconnects: walk.per.p1?.reconnects, rooms: walk.per.p1?.rooms, joinedB: walk.per.p1?.rooms?.includes(liveKitNames[B]) ?? null,
                connectMs: walk.per.p1?.connectMs, writesApart: (walk.acted?.second?.t ?? 0) - (walk.acted?.first?.t ?? 0) }));
        const slow = await measured("walk: p1 C -> B -> A, 2500 ms between the writes", async () => {
            await moveTokens(ctx, "gm1", table.sceneId, [move("p1", B)]);
            await sleep(2500);
            return moveTokens(ctx, "gm1", table.sceneId, [move("p1", A)]);
        }, { ids: ["VOICE-02"], expect: { p1: A } });
        note("walk: the slow walk's connects, for comparison", J({ moduleConnects: slow.counted.p1?.connects, rooms: slow.per.p1?.rooms, connectMs: slow.per.p1?.connectMs }));

        phase("all at once");
        const shuffle = { p1: D, p2: A, p3: B, p4: C };
        const together = await measured("all at once: p1-p4 each to another room in one write",
            () => moveTokens(ctx, "gm1", table.sceneId, PLAYERS.map(r => move(r, shuffle[r]))), { ids: ["VOICE-01"], expect: shuffle });
        note("all at once: pages that left their room within one second of each other", J(burst(together.per)));

        phase("offline");
        const offline = await measured("offline: p4 offline for 15 s, then back", async () => {
            await ctx.offline("p4", 15_000);
            const back = Date.now();
            /* S3's runs on the owner's PC (25.11.2026): about 6.5 s into a cut Foundry says "Server connection lost"
               and reloads, which, offline, lands on chrome-error:// and stays there when the network is back. Such a
               page is logged in again (as a player would press F5), with the debug setting turned on as at setup;
               without it every later phase would call a page with no game. */
            await new Promise(r => setTimeout(r, 3000));
            const url = ctx.c.p4.page.url();
            let leftGame = null;
            if (!/^https?:/.test(url)) {
                leftGame = url;
                await ctx.leave("p4");
                await ctx.rejoin("p4");
                await inPage(ctx, "p4", async () => { if (!game.settings.get("danganronpa-rpg", "debug")) await game.settings.set("danganronpa-rpg", "debug", true); });
            }
            await ctx.until("p4", "return game.ready === true", { timeout: 120_000 });
            const reloaded = await ensureKit(ctx, "p4");
            if (reloaded) await inPage(ctx, "p4", () => window.__qa.startSampler(100));
            return { back, reloaded, leftGame, loggedInAgainAfterMs: leftGame ? Date.now() - back : null };
        }, { timeout: 120_000, ids: ["VOICE-01"] });
        const p4 = offline.per.p4;
        note("offline: p4 after 15 s offline", J({ pageReloaded: offline.acted?.reloaded, pageLeftGame: offline.acted?.leftGame ?? null, loggedInAgainAfterMs: offline.acted?.loggedInAgainAfterMs ?? null, matchedAfterBackMs: p4?.matched ? p4.matchedAfterMs - ((offline.acted?.back ?? offline.since) - offline.since) : null,
            silentMs: p4?.silentMs, reconnects: p4?.reconnects, othersReconnected: Object.entries(offline.per).filter(([r, a]) => r !== "p4" && a.reconnects > 0).map(([r]) => r) }));

        phase("eclipse");
        const eclipseBy = (await primaryRole(ctx, GMS)) ?? "gm1";
        const started = await measured("eclipse start: players out of voice, GMs in the GMs' room", async () => {
            const n = await inPage(ctx, eclipseBy, () => (window.__notifications ?? []).length);
            const r = await inPage(ctx, eclipseBy, () => game.drpg.startEclipse(), null, { timeout: 180_000 });
            const said = await inPage(ctx, eclipseBy, from => (window.__notifications ?? []).slice(from), n);
            if (r) restore.eclipseStarted = true;
            return { started: r, said };
        }, { ids: ["VOICE-07"] });
        note("eclipse start: who started it and what was said", J(started.acted));
        if (!started.acted?.started) {
            check("eclipse: the primary GM's startEclipse opened an Eclipse", false, J(started.acted), { ids: ["VOICE-07"] });
        } else {
            note("eclipse start: pages that left their room within one second of each other (VOICE-07)", J(burst(started.per)));
            const ended = await measured("eclipse end: every page back in its room", async () => {
                const r = await inPage(ctx, eclipseBy, () => game.drpg.endEclipse({ advance: false }), null, { timeout: 180_000 });
                restore.eclipseStarted = false;
                return r;
            }, { timeout: 120_000, ids: ["VOICE-07"] });
            note("eclipse end: pages that reconnected within one second of each other, and the last one in (VOICE-07)",
                J({ ...burst(ended.per), lastMatchedMs: Math.max(...Object.values(ended.per).map(a => a.matchedAfterMs ?? Infinity)) }));
        }

        phase("reload");
        const reload = await measured("reload: p3's F5", async () => {
            const t = Date.now();
            await ctx.reload("p3");
            const readyMs = Date.now() - t;
            await ensureKit(ctx, "p3");
            await inPage(ctx, "p3", () => window.__qa.startSampler(100));
            const sinceLoad = await voiceCounters(ctx, "p3");
            return { readyMs, sinceLoad };
        }, { timeout: 120_000, ids: ["VOICE-06"] });
        note("reload: p3's connects since its page loaded (VOICE-06: 2 = alone first, then its room)", J({ ...reload.acted, afterConverge: await voiceCounters(ctx, "p3").catch(() => null),
            matchedAfterMs: reload.per.p3?.matchedAfterMs }));

        phase("primary leaves");
        const gapStand = await measured("primary leaves: p4 stood outside every room, beside two", () => moveTokens(ctx, "gm1", table.sceneId, [{ tokenId: token.p4, x: table.gap.x, y: table.gap.y }]), { ids: ["VOICE-05"] });
        const p4Before = gapStand.plan?.targets?.[users.p4];
        note("primary leaves: where GM1's plan puts p4 outside every room (E88: the room it came from)", J({ target: p4Before, kept: gapStand.plan?.kept?.[users.p4], between: table.gap.between }));
        if (!ctx.c.gm2) {
            check("primary leaves: GM2 is logged in to take over", false, "GM2 did not log in", { ids: ["VOICE-05"] });
        } else {
            const left = await measured("primary leaves: GM1's browser closed, GM2 takes over", async () => {
                const t = Date.now();
                await ctx.leave("gm1");
                let primaryAfterMs = null;
                while (Date.now() - t < 60_000) {
                    if (await inPage(ctx, "gm2", () => game.drpg.isPrimaryGm()).catch(() => false)) { primaryAfterMs = Date.now() - t; break; }
                    await sleep(250);
                }
                return { primaryAfterMs };
            }, { roles: present(ctx, ALL).filter(r => r !== "gm1"), planRole: "gm2", timeout: 100_000, ids: ["VOICE-05", "PRIM-03"] });
            const p4After = left.plan?.targets?.[users.p4];
            note("primary leaves: GM2 primary after (ms), and p4 outside every room under GM2's plan (VOICE-05: the main room when the kept room is lost)",
                J({ primaryAfterMs: left.acted?.primaryAfterMs, p4Before, p4After, p4ToMainRoom: p4Before !== null && p4After === null, p4: left.per.p4 && line(left.per.p4),
                    reconnects: Object.fromEntries(Object.entries(left.per).map(([r, a]) => [r, a.reconnects])) }));

            phase("primary returns");
            const back = await measured("primary returns: GM1 logs in again", async () => {
                const t = Date.now();
                await ctx.rejoin("gm1");
                const loginMs = Date.now() - t;
                await ensureKit(ctx, "gm1");
                await inPage(ctx, "gm1", () => window.__qa.startSampler(100));
                restore.debugWas.gm1 = await inPage(ctx, "gm1", async () => { const was = game.settings.get("danganronpa-rpg", "debug"); if (!was) await game.settings.set("danganronpa-rpg", "debug", true); return was; });
                let primaryAfterMs = null;
                while (Date.now() - t < 120_000) {
                    if (await inPage(ctx, "gm1", () => game.drpg.isPrimaryGm()).catch(() => false)) { primaryAfterMs = Date.now() - t; break; }
                    await sleep(250);
                }
                return { loginMs, primaryAfterMs };
            }, { roles: ALL, planRole: "gm1", timeout: 120_000, ids: ["PRIM-02"] });
            note("primary returns: GM1 primary again after (ms), GM2 still primary, and the players' reconnects it cost (PRIM-02)",
                J({ ...back.acted, gm2Primary: await inPage(ctx, "gm2", () => game.drpg.isPrimaryGm()).catch(() => null), gm1ConnectsSinceLoad: await voiceCounters(ctx, "gm1").catch(() => null),
                    reconnects: Object.fromEntries(Object.entries(back.per).map(([r, a]) => [r, a.reconnects])) }));
        }
        const finalPlan = ctx.c.gm1 ? await planOf(ctx, "gm1").catch(() => null) : null;
        note("end: the last plan", J(finalPlan));
    } finally {
        phase("end");
        for (const role of present(ctx, ALL)) {
            note(`end: ${role}'s LiveKit toasts (FORGE-03)`, J(await liveKitToasts(ctx, role).catch(err => ({ err: err.message }))));
            const e = await moduleErrors(ctx, role).catch(err => ({ err: err.message }));
            check(`end: no error from the module on ${role} (window errors naming its files, and its own console errors)`, e.module === 0 && e.console === 0, J(e));
        }
        const gm = present(ctx, GMS)[0];
        if (gm) {
            try {
                if (restore.eclipseStarted) await inPage(ctx, gm, () => game.drpg.endEclipse({ advance: false }), null, { timeout: 180_000 });
                if (table && restore.tokens.length) {
                    await inPage(ctx, gm, async ({ sceneId, tokens }) => {
                        const scene = game.scenes.get(sceneId);
                        await scene.updateEmbeddedDocuments("Token", tokens.map(t => ({ _id: t.tokenId, x: t.x, y: t.y })), { teleport: true, animate: false });
                    }, { sceneId: table.sceneId, tokens: restore.tokens });
                }
                if (restore.voiceWas !== null) await inPage(ctx, gm, was => game.settings.set("danganronpa-rpg", "voiceEnabled", was === true), restore.voiceWas);
                note("end: put back", J({ tokens: restore.tokens.length, voiceSetting: restore.voiceWas, eclipseEnded: restore.eclipseStarted }));
            } catch (err) {
                note("end: putting back failed", String(err?.stack ?? err).slice(0, 800));
            }
        }
        for (const role of present(ctx, ALL)) {
            if (restore.debugWas[role] === false) await inPage(ctx, role, () => game.settings.set("danganronpa-rpg", "debug", false)).catch(() => {});
        }
    }
}
