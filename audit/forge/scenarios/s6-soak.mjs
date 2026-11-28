/**
 * S6 on Forge: two hours of ordinary play on six browsers, sampled (the road to 2.0, F3; written 24.11.2026, NEVER RUN).
 * ---------------------------------------------------------------------------
 *     DRPG_FORGE_URL=... DRPG_FORGE_WORLD=DRPG-QA-Forge DRPG_FULL_RENDER=1 node audit/forge/run.mjs s6-soak
 *
 * On the owner's PC (a real GPU: DRPG_FULL_RENDER=1 keeps Foundry's own frame rate, which is what a table runs).
 * DRPG_FAKE_MEDIA=1 adds voice to the load; without it LiveKit fails on every page and FORGE-03's toasts pile up, which
 * is itself counted (the samples' `toasts`).
 *
 * Environment (all optional):
 *   DRPG_SOAK_MINUTES             how long the loop plays (120)
 *   DRPG_SOAK_SAMPLE_MINUTES      how often every page is sampled (5)
 *   DRPG_SOAK_CLOCK_MINUTES       how often GM1 moves the clock (20)
 *   DRPG_SOAK_FPS_MINUTES         how often `game.drpg.fps()` runs on every page, one after another (60)
 *   DRPG_SOAK_STEP_SECONDS        the pause between two steps of play (20)
 *   DRPG_SOAK_HEAP_MB_PER_HOUR    the bound on heap growth after a forced collection (30; the reasoning is at HEAP_BOUND)
 *   DRPG_SOAK_SEED                the seed of the steps' order (1), so two runs play the same game
 *
 * PHASES
 *   setup     the active scene's rooms (../table.mjs `readTable`), P1-P4's tokens placed in four rooms by GM1 where they
 *             stand in none, the game unpaused; on every page the kit, a navigation listener and the first sample
 *   play      until the time is up, one step every DRPG_SOAK_STEP_SECONDS, in a seeded order:
 *               move      a player drags their own token into a neighbouring room that is not a bedroom (an update of
 *                         x and y from that player's page, as a drop writes it; the module judges it there and may
 *                         refuse - a refusal with words is counted, not failed: no Move or action left is ordinary play;
 *                         a move that neither lands nor says anything is the finding FORGE-05 names, counted apart)
 *               sheet     a player opens their character sheet, clicks through its tabs, closes it
 *               message   a player writes into their messenger thread; every third time a GM answers in it
 *               notices   a player opens the notice history and closes it
 *               action    a player opens Listen or Rest (`game.drpg.performAction`) and closes the window it opens
 *                         without choosing: the roads of a player's action that need no GM's ruling, cancelled
 *               gmPanel   a GM opens the GM panel, then the Students window, and closes both
 *             every DRPG_SOAK_CLOCK_MINUTES GM1 moves the clock as a table does: startEclipse, 30 s, endEclipse
 *             (advancing), or `advanceTimeOfDay({ resetActions: true })` where an Eclipse is refused; windows the step
 *             opened are closed 25 s after it on every page
 *             every DRPG_SOAK_SAMPLE_MINUTES every page is sampled: the JS heap after a forced collection (Chromium,
 *             through the DevTools protocol), `performance.memory`, DOM nodes, open windows, chat messages,
 *             `window.__errors` and the module's own console errors, LiveKit toasts, and the module's counters' growth
 *             since the last sample (`game.drpg.counters()`, the 12 largest)
 *             every DRPG_SOAK_FPS_MINUTES `game.drpg.fps({ toChat: false })` on each page in turn
 *   end       the checks; the clock put back to the chapter, day, session, time of day and phase it had
 *
 * CHECKS
 *   - no error from the module on any page (window errors naming its files; its own `danganronpa-rpg |` console errors)
 *   - no page reloaded or navigated (`performance.timeOrigin` unchanged and no main-frame navigation)
 *   - heap growth per hour under HEAP_BOUND on every Chromium page (Firefox: no heap reading, noted UNMEASURED)
 *   - the loop played: steps ran, and at least one move landed in the room asked
 *   - FORGE-05: every move to a reachable room (a neighbour by the module's `neighbouringRooms`, not a bedroom) arrived or
 *     was refused with words (a notice or a module card on the mover's page, Forge's case-copy and LiveKit toasts left
 *     out); a move that did neither is listed (2.0 line T4, FORGE-05+D2-25, 27.11.2026)
 *
 * WRITES TO THE WORLD: P1-P4's tokens (created where absent, moved by their players), messenger messages (chat
 * messages) from P1-P4 and the GMs, the clock moved through Eclipses and times of day (put back at the end, which does
 * not undo the refills, cards, day boards and the chat they wrote), actions spent on moves. The pause lifted.
 *
 * UNMEASURED: that `performAction(actor, "listen" | "rest")` opens a window whose close answers nothing and spends
 * nothing (actions.mjs's windows resolve null on a close, as read, not run on Forge); that a forced collection through
 * `HeapProfiler.collectGarbage` reaches every page's heap (one renderer process per page); that the clock step opens no
 * GM window that blocks the next one (closing a window that waits for an answer cancels what it asked); that the
 * Eclipse on the clock's schedule is never refused for a reason that lasts (each refusal falls back to an advance).
 */

import { config } from "../lib.mjs";
import { J, sleep, inPage, ensureKit, present, readTable, placeTokens, unpause, liveKitToasts, moduleErrors, parseFps } from "../table.mjs";

export const meta = {
    id: "s6-soak",
    title: "Two hours of ordinary play on six browsers: errors, heap, reloads, the module's counters, the frame",
    roles: ["gm1", "gm2", "p1", "p2", "p3", "p4"],
    writes: true,
    triage: ["FORGE-02", "FORGE-03", "VOICE-01"]
};

const GMS = ["gm1", "gm2"];
const PLAYERS = ["p1", "p2", "p3", "p4"];
const ALL = [...GMS, ...PLAYERS];
const env = (name, fallback) => (Number.isFinite(Number(process.env[name])) && process.env[name] !== undefined && process.env[name] !== "" ? Number(process.env[name]) : fallback);
const MINUTES = env("DRPG_SOAK_MINUTES", 120);
const SAMPLE_MIN = env("DRPG_SOAK_SAMPLE_MINUTES", 5);
const CLOCK_MIN = env("DRPG_SOAK_CLOCK_MINUTES", 20);
const FPS_MIN = env("DRPG_SOAK_FPS_MINUTES", 60);
const STEP_S = env("DRPG_SOAK_STEP_SECONDS", 20);

/*
 * HEAP_BOUND: 30 MB an hour, read as the slope of a least-squares line through the heap AFTER A FORCED COLLECTION,
 * from the third sample on (the first ten minutes warm caches: textures, the first open of each window, the
 * compendium indexes Foundry reads lazily). Why this number - a design number, not a measurement (no baseline exists:
 * audit/perf-baseline.json's run is LIVE-E33-05):
 *   - what the loop itself adds: at one step every 20 s, about 180 steps an hour, a third of them messages; a chat
 *     message document with its rendered card is a few KB (say 5-10 KB), so the chat alone grows 0.5-2 MB an hour on
 *     every page, and the clock's cards and boards a few more. Anything up to ~5 MB/h is the world growing, not a leak.
 *   - what a leak looks like: a window or a canvas listener kept after its close; the module opens about 100 windows an
 *     hour here, and a kept ApplicationV2 with its DOM is 0.2-1 MB, so a leak of one kept window per open is 20-100 MB
 *     an hour - above the bound at its smallest.
 *   - what a table can bear: a four-hour session at 30 MB/h is 120 MB on top of Foundry's usual 200-400 MB, well inside
 *     a tab's limit, so a page under the bound does not get slower or crash in a session.
 * A run shorter than three samples after the warm-up measures no slope; that is noted, never passed.
 */
const HEAP_BOUND = env("DRPG_SOAK_HEAP_MB_PER_HOUR", 30);
/* Toasts that say nothing about a move: the case's server copy on Forge (FORGE-01, today's "Access Unauthorized ..."
   and the line's own warning and planner texts) and avclient-livekit's (FORGE-03). As s3-disconnects.mjs D1 leaves them
   out of a take-over's words, a move's words leave them out here. */
const UNRELATED = /access unauthorized|sign in to the forge|does not let this browser save the case|nie pozwala tej przegl\u0105darce zapisa\u0107 kopii sprawy|case planner is empty|planer sprawy jest pusty|save the case to a file|zapisz spraw\u0119 do pliku|livekit/i;
const WARMUP_MIN = 10;

/* A seeded order (mulberry32), so two runs with one seed play the same steps. */
function rng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/* The slope of y over x (least squares), or null with fewer than three points. */
function slope(points) {
    if (points.length < 3) return null;
    const n = points.length;
    const mx = points.reduce((s, p) => s + p.x, 0) / n, my = points.reduce((s, p) => s + p.y, 0) / n;
    const sxx = points.reduce((s, p) => s + (p.x - mx) ** 2, 0);
    if (!sxx) return null;
    return points.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0) / sxx;
}

export async function run(ctx) {
    const { check, note, phase } = ctx;
    const random = rng(env("DRPG_SOAK_SEED", 1));
    const pick = list => list[Math.floor(random() * list.length)];
    const origin = {}, navigations = {}, cdp = {}, samples = {}, lastCounts = {};
    /* The moves counted three ways (2.0 line T4, FORGE-05+D2-25, 27.11.2026): the second pass on the owner's PC
       (F3-forge-PC-2.md) counted 32 landed of 89 and noted 7 refusals, 5 of them with no word to the player - one
       `refused` could not tell the table's ordinary "no move left" from a move that went nowhere unsaid. `refused` stays
       the sum of the two, as before, so the numbers compare with that pass's. */
    const tally = { steps: 0, threw: 0, byKind: {}, moves: { asked: 0, landed: 0, refused: 0, refusedWithWords: 0, silent: 0, noNeighbour: 0 }, silentMoves: [], clock: [], closed: [] };
    let table = null, clockWas = null, started = Date.now();

    phase("setup");
    if (!ctx.c.gm1) { check("setup: GM1 logged in", false, "GM1 did not log in; the clock and the table are set up through GM1"); return; }
    for (const role of present(ctx, ALL)) {
        await ensureKit(ctx, role);
        origin[role] = await inPage(ctx, role, () => performance.timeOrigin);
        navigations[role] = [];
        const page = ctx.c[role].page;
        page.on("framenavigated", frame => { if (frame === page.mainFrame()) navigations[role].push({ at: new Date().toISOString(), url: frame.url().slice(0, 200) }); });
        if (config.engine === "chromium") {
            try { cdp[role] = await page.context().newCDPSession(page); } catch (err) { cdp[role] = null; note(`setup: no DevTools session on ${role}`, err.message); }
        }
        samples[role] = [];
    }
    table = await readTable(ctx, "gm1", ALL);
    if (table.error) { check("setup: an active scene", false, table.error); return; }
    const roomNames = Object.keys(table.rooms);
    /* A token placed by GM1 goes to a room that is not a bedroom where the map has two such (FORGE-05+D2-25). */
    const common = roomNames.filter(n => !table.rooms[n].bedroom);
    const placeIn = common.length >= 2 ? common : roomNames;
    note("setup: the scene", J({ scene: table.sceneName, rooms: roomNames.length, bedrooms: table.bedrooms, bedroomsRead: table.bedroomsRead, named: table.named.length, scanMs: table.scanMs, who: table.who }));
    const missing = PLAYERS.filter(r => !table.who[r]?.actorId);
    if (missing.length || roomNames.length < 2) { check("setup: P1-P4 each have a character and the scene has two rooms or more", false, J({ missing, rooms: roomNames })); return; }
    const users = Object.fromEntries(ALL.map(r => [r, table.who[r]?.userId]));
    const toPlace = PLAYERS.filter(r => !table.who[r].tokenId || !table.who[r].room)
        .map((role, i) => ({ role, actorId: table.who[role].actorId, tokenId: table.who[role].tokenId, ...table.rooms[placeIn[i % placeIn.length]] }));
    const placed = toPlace.length ? await placeTokens(ctx, "gm1", table.sceneId, toPlace) : {};
    const token = Object.fromEntries(PLAYERS.map(r => [r, placed[r]?.tokenId ?? table.who[r].tokenId]));
    note("setup: tokens placed where a character stood in no room", J(placed));
    check("setup: P1-P4 each have a token on the active scene", PLAYERS.every(r => token[r]), J(token));
    note("setup: the game was paused, unpaused", J(await unpause(ctx, "gm1")));
    clockWas = await inPage(ctx, "gm1", () => { const c = game.drpg.getClock(); return { chapter: c.chapter, day: c.day, session: c.session, timeOfDay: c.timeOfDay, phase: c.phase, eclipse: c.eclipse }; });
    note("setup: the clock at the start (put back at the end)", J(clockWas));

    /* ---- one sample of every page ------------------------------------------------------------------------- */
    const sample = async label => {
        const at = Date.now();
        for (const role of present(ctx, ALL)) {
            const s = { label, at, min: Math.round((at - started) / 600) / 100 };
            try {
                if (cdp[role]) {
                    await cdp[role].send("HeapProfiler.collectGarbage");
                    const h = await cdp[role].send("Runtime.getHeapUsage");
                    s.heapMB = Math.round(h.usedSize / 1e4) / 100;
                }
                const read = await inPage(ctx, role, async () => {
                    const counts = (await game.drpg.counters())?.counts ?? {};
                    return { origin: performance.timeOrigin, memMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e4) / 100 : null,
                        nodes: document.getElementsByTagName("*").length, windows: window.__qa.appIds().length, messages: game.messages?.size ?? null, counts };
                }, null, { timeout: 60_000 });
                const counts = read.counts;
                delete read.counts;
                Object.assign(s, read);
                const grew = Object.entries(counts).map(([k, v]) => [k, v - (lastCounts[role]?.[k] ?? 0)]).filter(([, d]) => d > 0).sort((a, b) => b[1] - a[1]);
                s.countersGrew = Object.fromEntries(grew.slice(0, 12));
                s.countersTotal = grew.reduce((sum, [, d]) => sum + d, 0);
                lastCounts[role] = counts;
                const e = await moduleErrors(ctx, role);
                s.errors = e.all; s.moduleErrors = e.module; s.consoleErrors = e.console;
                const t = await liveKitToasts(ctx, role);
                s.toasts = t.recorded;
                s.reloaded = s.origin !== origin[role];
            } catch (err) {
                s.failed = String(err?.message ?? err).slice(0, 300);
            }
            samples[role].push(s);
            note(`sample ${label}: ${role}`, J(s));
        }
    };

    /* ---- the steps -------------------------------------------------------------------------------------- */
    const closeNewOn = async (role, before) => inPage(ctx, role, ids => window.__qa.closeNew(ids), before, { timeout: 30_000 });
    const idsOn = role => inPage(ctx, role, () => window.__qa.appIds());
    const steps = {
        async move(role) {
            tally.moves.asked++;
            const r = await inPage(ctx, role, async ({ tokenId, sceneId, rooms, draw, unrelated }) => {
                const scene = game.scenes.get(sceneId);
                const t = scene.tokens.get(tokenId);
                const from = game.drpg.roomOfToken(t);
                /* Reachable: a neighbour by the module's own reading, and not a bedroom (its lock is not the move's). */
                const near = (from ? game.drpg.neighbouringRooms(scene, from) ?? [] : Object.keys(rooms)).filter(n => rooms[n] && !rooms[n].bedroom && n !== from);
                if (!near.length) return { from, none: true };
                const to = near[Math.floor(draw * near.length)];
                const n = (window.__notifications ?? []).length;
                const cards0 = document.querySelectorAll("#drpg-popups .drpg-popup").length;
                const skip = new RegExp(unrelated, "i");
                const words = () => [
                    ...(window.__notifications ?? []).slice(n).map(x => `${x.type}: ${x.message}`.slice(0, 160)),
                    ...[...document.querySelectorAll("#drpg-popups .drpg-popup")].slice(cards0).map(c => `card: ${String(c.textContent ?? "").replace(/\s+/g, " ").trim()}`.slice(0, 160))
                ].filter(w => !skip.test(w));
                let threw = null;
                try { await t.update({ x: rooms[to].x, y: rooms[to].y }); } catch (err) { threw = String(err?.message ?? err); }
                if (threw) { await new Promise(r => setTimeout(r, 3000)); return { from, to, threw, now: game.drpg.roomOfToken(scene.tokens.get(tokenId)), said: words() }; }
                /* On Foundry 14 the write is a movement along a path that can take several seconds (S5 on the owner's PC,
                   25.11.2026): a fixed 3 s counted a token still on its way as refused. 3 s at least, as before, then
                   up to 15 s for the token to stand in the room asked. */
                const t0 = Date.now();
                await new Promise(r => setTimeout(r, 3000));
                while (Date.now() - t0 < 15_000 && game.drpg.roomOfToken(scene.tokens.get(tokenId)) !== to) await new Promise(r => setTimeout(r, 250));
                return { from, to, now: game.drpg.roomOfToken(scene.tokens.get(tokenId)), ms: Date.now() - t0, said: words() };
            }, { tokenId: token[role], sceneId: table.sceneId, rooms: table.rooms, draw: random(), unrelated: UNRELATED.source });
            if (r.none) tally.moves.noNeighbour++;
            else if (r.now === r.to) tally.moves.landed++;
            else {
                tally.moves.refused++;
                if (r.said?.length) tally.moves.refusedWithWords++;
                else {
                    tally.moves.silent++;
                    if (tally.silentMoves.length < 25) tally.silentMoves.push({ role, step: tally.steps, from: r.from, to: r.to, now: r.now, threw: r.threw ?? null });
                }
            }
            return r;
        },
        async sheet(role) {
            const before = await idsOn(role);
            const r = await inPage(ctx, role, async () => {
                const sheet = game.user.character?.sheet;
                if (!sheet) return { none: true };
                await sheet.render({ force: true });
                await new Promise(r => setTimeout(r, 2500));
                const el = window.__qa.appEl(sheet);
                const tabs = el ? [...el.querySelectorAll("nav [data-tab], [data-action='tab']")].slice(0, 8) : [];
                for (const tab of tabs) { tab.click(); await new Promise(r => setTimeout(r, 700)); }
                return { tabs: tabs.length };
            });
            r.closed = await closeNewOn(role, before);
            return r;
        },
        async message(role) {
            const n = tally.byKind.message ?? 0;
            const r = await inPage(ctx, role, async text => {
                const sent = await game.drpg.sendMessengerMessage(game.user.id, text);
                return { sent: Boolean(sent) };
            }, `QA soak ${new Date().toISOString().slice(11, 19)} - ${role}, message ${n + 1}`);
            if (n % 3 === 2) {
                const gm = pick(present(ctx, GMS));
                if (gm) r.answered = await inPage(ctx, gm, async ({ userId, text }) => Boolean(await game.drpg.sendMessengerMessage(userId, text)),
                    { userId: users[role], text: `QA soak answer to ${role}` });
            }
            return r;
        },
        async notices(role) {
            const before = await idsOn(role);
            await inPage(ctx, role, async () => { await game.drpg.openNotices(); await new Promise(r => setTimeout(r, 2500)); });
            return { closed: await closeNewOn(role, before) };
        },
        async action(role) {
            const before = await idsOn(role);
            const key = pick(["listen", "rest"]);
            const r = await inPage(ctx, role, async key => {
                const actor = game.user.character;
                window.__qaAction = { key, state: "running" };
                Promise.resolve(game.drpg.performAction(actor, key)).then(v => { window.__qaAction = { key, state: "done", value: v === null || v === undefined ? null : typeof v }; },
                    err => { window.__qaAction = { key, state: "threw", error: String(err?.message ?? err) }; });
                await new Promise(r => setTimeout(r, 2500));
                return { key };
            }, key);
            r.closed = await closeNewOn(role, before);
            await sleep(1500);
            r.after = await inPage(ctx, role, () => window.__qaAction ?? null);
            return r;
        },
        async gmPanel(role) {
            const before = await idsOn(role);
            await inPage(ctx, role, async () => {
                game.drpg.gmPanel();
                await new Promise(r => setTimeout(r, 2500));
                game.drpg.monocubDialog();
                await new Promise(r => setTimeout(r, 2500));
            });
            return { closed: await closeNewOn(role, before) };
        }
    };
    const playerKinds = ["move", "move", "move", "sheet", "message", "message", "notices", "action"];

    const clockStep = async () => {
        const befores = {};
        for (const role of present(ctx, ALL)) befores[role] = await idsOn(role).catch(() => []);
        const r = await inPage(ctx, "gm1", async () => {
            const before = game.drpg.getClock();
            let road = "eclipse", started = null;
            try { started = await game.drpg.startEclipse(); } catch (err) { started = `threw: ${err?.message ?? err}`; }
            if (started === true) {
                await new Promise(r => setTimeout(r, 30_000));
                await game.drpg.endEclipse();
            } else {
                road = "advance";
                await game.drpg.advanceTimeOfDay({ resetActions: true });
            }
            const after = game.drpg.getClock();
            return { road, started, from: `${before.day}/${before.timeOfDay}`, to: `${after.day}/${after.timeOfDay}`, eclipse: after.eclipse };
        }, null, { timeout: 240_000 });
        await sleep(25_000);
        for (const role of present(ctx, ALL)) {
            const closed = await closeNewOn(role, befores[role]).catch(err => [{ err: err.message }]);
            if (closed.length) tally.closed.push({ role, after: "clock", closed });
        }
        tally.clock.push(r);
        note("clock step", J(r));
    };

    const fpsRound = async label => {
        for (const role of present(ctx, ALL)) {
            try {
                const text = await inPage(ctx, role, () => game.drpg.fps({ toChat: false }), null, { timeout: 180_000 });
                note(`fps ${label}: ${role}`, J({ window: parseFps(text), text: String(text).slice(0, 2400) }));
            } catch (err) {
                note(`fps ${label}: ${role} failed`, String(err?.message ?? err));
            }
        }
    };

    /* ---- the loop ------------------------------------------------------------------------------------------ */
    phase("play");
    started = Date.now();
    const end = started + MINUTES * 60_000;
    let nextSample = started, nextClock = started + CLOCK_MIN * 60_000, nextFps = started + 2 * 60_000, sampleN = 0, fpsN = 0;
    try {
        while (Date.now() < end) {
            if (Date.now() >= nextSample) { await sample(`#${sampleN++}`); nextSample += SAMPLE_MIN * 60_000; }
            if (Date.now() >= nextFps) { await fpsRound(`#${fpsN++}`); nextFps += FPS_MIN * 60_000; }
            if (Date.now() >= nextClock) {
                try { await clockStep(); } catch (err) { tally.threw++; note("clock step threw", String(err?.message ?? err)); }
                nextClock += CLOCK_MIN * 60_000;
            }
            const gmTurn = random() < 0.12;
            const role = gmTurn ? pick(present(ctx, GMS)) : pick(present(ctx, PLAYERS));
            const kind = gmTurn ? "gmPanel" : pick(playerKinds);
            if (role) {
                tally.steps++;
                tally.byKind[kind] = (tally.byKind[kind] ?? 0) + 1;
                try {
                    const r = await steps[kind](role);
                    if (r?.closed?.length) tally.closed.push({ role, after: kind, closed: r.closed.map(c => c.cls ?? c.id) });
                    if (kind === "move" && r.threw) tally.threw++;
                    if (tally.steps <= 30 || tally.steps % 25 === 0) note(`step ${tally.steps}: ${role} ${kind}`, J(r));
                } catch (err) {
                    tally.threw++;
                    note(`step ${tally.steps}: ${role} ${kind} threw`, String(err?.stack ?? err).slice(0, 800));
                }
            }
            await sleep(STEP_S * 1000);
        }
        await sample("last");
    } finally {
        phase("end");
        note("play: what ran", J({ minutes: Math.round((Date.now() - started) / 600) / 100, ...tally, closed: tally.closed.slice(-40) }));
        check("play: the loop played - steps ran and at least one move landed in the room asked",
            tally.steps > 0 && tally.moves.landed > 0, J({ steps: tally.steps, moves: tally.moves, threw: tally.threw }));
        /* FORGE-05: a move that neither lands nor says why is a finding, not noise. A run whose every move found no
           reachable room measured nothing, and fails as such. */
        const reachable = tally.moves.asked - tally.moves.noNeighbour;
        check("end: every move to a reachable room arrived or was refused with words",
            reachable > 0 && tally.moves.silent === 0,
            J({ reachable, arrived: tally.moves.landed, refusedWithWords: tally.moves.refusedWithWords, silent: tally.moves.silent, noNeighbour: tally.moves.noNeighbour, silentMoves: tally.silentMoves }),
            { ids: ["FORGE-05"] });
        for (const role of ALL) {
            const list = samples[role] ?? [];
            if (!ctx.c[role] || !list.length) { note(`end: ${role} has no samples`, ""); continue; }
            const e = await moduleErrors(ctx, role).catch(err => ({ err: err.message }));
            check(`end: no error from the module on ${role} over the soak (window errors naming its files, and its own console errors)`,
                e.module === 0 && e.console === 0, J(e));
            const nowOrigin = await inPage(ctx, role, () => performance.timeOrigin).catch(() => null);
            check(`end: ${role}'s page never reloaded or navigated`, nowOrigin === origin[role] && navigations[role].length === 0,
                J({ origin: origin[role], now: nowOrigin, navigations: navigations[role] }), { ids: ["FORGE-02"] });
            const points = list.filter(s => Number.isFinite(s.heapMB) && s.min >= WARMUP_MIN).map(s => ({ x: s.min / 60, y: s.heapMB }));
            const perHour = slope(points);
            const series = list.map(s => `${s.min}m ${s.heapMB ?? "-"}/${s.memMB ?? "-"} MB, ${s.nodes} nodes, ${s.windows} windows, ${s.messages} messages`).join("; ");
            if (perHour === null) {
                note(`end: ${role}'s heap growth per hour - UNMEASURED`, `${cdp[role] ? `${points.length} sample(s) after the first ${WARMUP_MIN} minutes, three needed` : `no heap reading in ${config.engine}`}. Series: ${series}`);
            } else {
                check(`end: ${role}'s heap grows under ${HEAP_BOUND} MB an hour after a forced collection (least squares from minute ${WARMUP_MIN})`,
                    perHour < HEAP_BOUND, `${Math.round(perHour * 100) / 100} MB/h over ${points.length} samples. Series: ${series}`);
            }
        }
        try {
            if (clockWas && ctx.c.gm1) {
                await inPage(ctx, "gm1", async was => {
                    if (game.drpg.isEclipse()) await game.drpg.endEclipse({ advance: false });
                    await game.drpg.setClock({ chapter: was.chapter, day: was.day, session: was.session, timeOfDay: was.timeOfDay, phase: was.phase });
                }, clockWas, { timeout: 120_000 });
                note("end: the clock put back", J(clockWas));
            }
        } catch (err) {
            note("end: putting the clock back failed", String(err?.message ?? err));
        }
        for (const s of Object.values(cdp)) await s?.detach?.().catch(() => {});
    }
}
