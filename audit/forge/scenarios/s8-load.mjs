/**
 * S8 on Forge: how much in the world before the game slows down, for a GM and for a player (the road to 2.0, F3;
 * written 24.11.2026, NEVER RUN). S6 tests time; this tests size.
 * ---------------------------------------------------------------------------
 *     DRPG_FULL_RENDER=1 DRPG_FORGE_URL=... DRPG_FORGE_WORLD=DRPG-QA-Forge node audit/forge/run.mjs s8-load
 *
 * On the owner's PC with a GPU: DRPG_FULL_RENDER=1 keeps Foundry's own performance mode and frame rate, without which
 * the frame numbers are lib.mjs's 10 fps cap and say nothing. GM1 is the GM measured, P1 the player who sees the most
 * (P1 and P2 stand in the deepest room, where half of the NPC tokens and projects go), P2 the one who moves.
 *
 * Environment (optional; each a comma list, cumulative levels):
 *   DRPG_S8_REMNANTS   30,60,120,240     Remnants on the active scene at each level
 *   DRPG_S8_TOKENS     8,16,32           extra NPC tokens in rooms
 *   DRPG_S8_PROJECTS   4,8,16            projects in rooms, one level per token level
 *   DRPG_S8_MESSAGES   100,300,600       chat messages in all (a third public, a third GM cards whispered to P1's
 *                                         character's owners, a third the GM writing in P1's and P2's messenger threads)
 *   DRPG_S8_SETTLE_MS  10000             the settle after each level's writes, before it is measured
 *
 * THE WORLD GROWS AND STAYS GROWN: each level adds to the last, and the later phases run over the earlier ones' Remnants,
 * tokens and projects, so the last measurement is the whole world at once. Thresholds are not this scenario's: it writes
 * the curve, and what counts as slow is the owner's decision.
 *
 * PHASES
 *   setup       the active scene's rooms (../table.mjs `readTable`); P1 and P2 placed in the deepest room by GM1, the game
 *               unpaused; on GM1 a record of every document created from now on (Token, ChatMessage, Actor, Item,
 *               JournalEntry, by `create*` hooks), beside the ids each write answers; the census before
 *   baseline    one measurement of the world as found
 *   remnants    a GM placing traces by the module's own road (`game.drpg.placeRemnant`, remnants.mjs: the road the
 *               investigation dashboard's "New trace" and a GM's console take; the ledger row in the GM store with it),
 *               spread over every room, up to each level
 *   tokens      NPC tokens (`createEmbeddedDocuments` - UNMEASURED road, below) and projects (`game.drpg.createProject`,
 *               projects.mjs: the module's own, its token placed by the primary's sync) up to each level, half of each in
 *               P1's room
 *   chat        messages up to each level; on P1 the time to open the messenger and the notice history
 *   windows     the GM panel, the Students window and Investigation open on GM1; for four world changes (a Remnant
 *               placed, a project made, a public message, P2's token moved) the time from the write until each window's
 *               DOM first changes and how many mutations follow in 4 s; then one measurement with them open
 *   cleanup     (always, in `finally`) every project s8 made deleted (`game.drpg.deleteProject`), every Remnant removed
 *               (`game.drpg.removeRemnant`, which drops its ledger row), every other document s8's run created deleted
 *               (tokens, chat messages, world items and journal entries, items made on an actor during the run, actors),
 *               P1's and P2's tokens put back; the census after
 *
 * ONE MEASUREMENT (every level; one table-like note per level, and a curve of every level at the end):
 *   - `game.drpg.fps({ toChat: false })` on GM1, then on P1 (never both at once: it holds the module's effects off one
 *     by one for about 20 s), its window line as numbers (../table.mjs `parseFps`)
 *   - `game.drpg.counters()` on GM1 and P1: what grew since the last measurement, the 12 largest and the total
 *   - P2's token moved inside the room P1 stands in, three times: from P2's write until P1's copy of the token holds the
 *     new spot (`docMs`), until P1's canvas first draws it moving (`startMs`), and until it is drawn at the spot
 *     (`drawnMs`); the median of three
 *   - the JS heap after a forced collection (Chromium, the DevTools protocol), DOM nodes, open windows
 *
 * CHECKS
 *   - no new error from the module on GM1, P1 or P2 at any level
 *   - every level's measurement taken: fps parsed on GM1 and P1, DOM nodes read on both, P2's move seen on P1, the
 *     heap read on both where the browser has it
 *   - the cleanup removed everything s8 created: no tracked id left, and the census after equals the census before
 *     (tokens on the scene, Remnants, chat messages, actors, world items, journal entries, projects)
 *   - the clock untouched: chapter, day, session, time of day, phase and Eclipse as before (s8 never writes it)
 *
 * WRITES AND REMOVES: everything above is created and then removed. Left behind: P1's and P2's tokens where they were
 * created when they had none (on the scene, in the deepest room), the pause lifted, each browser's own notice history.
 *
 * UNMEASURED:
 *   - NPC tokens are created with `createEmbeddedDocuments` from an actor that is not a student (an existing adversary
 *     or NPC, else one actor made for the run and deleted after): the module has no road for a GM placing an NPC - a GM
 *     drags one from the sidebar, which is Foundry's own `createEmbeddedDocuments` - so this is the road, not a stand-in.
 *   - The module's `remnant` actor that `placeRemnant` makes on first use is deleted only when it did not exist before.
 *   - That `game.drpg.placeRemnant` with `{ x, y, sceneId, type: "prep", visibility: "evident", action: "manual" }` is
 *     what a GM's "New trace" writes; that a trace is created hidden, so a player's canvas carries it as data and never
 *     draws it (the player's half of the Remnant curve is the world's size, not drawn sprites).
 *   - That a Token placeable's `position` is what the canvas draws during Foundry's move animation (`drawnMs`), and that
 *     the hooks see every document a module write creates on GM1's page (a document created by P2's page reaches GM1's
 *     hooks too; one created while GM1's page reloads would be missed and then found by the census).
 *   - That a project's token and its announcement are made within the settle; that `deleteProject` takes its token.
 */

import { config } from "../lib.mjs";
import { J, sleep, inPage, ensureKit, present, readTable, placeTokens, unpause, moduleErrors, parseFps } from "../table.mjs";

export const meta = {
    id: "s8-load",
    title: "Load: Remnants, tokens, projects, chat and open windows against the frame, for a GM and a player",
    roles: ["gm1", "p1", "p2"],
    writes: true,
    triage: ["PERF-LOAD"]
};

const levels = (name, fallback) => (process.env[name] ? process.env[name].split(",").map(Number).filter(n => Number.isFinite(n) && n >= 0) : fallback);
const REMNANTS = levels("DRPG_S8_REMNANTS", [30, 60, 120, 240]);
const TOKENS = levels("DRPG_S8_TOKENS", [8, 16, 32]);
const PROJECTS = levels("DRPG_S8_PROJECTS", [4, 8, 16]);
const MESSAGES = levels("DRPG_S8_MESSAGES", [100, 300, 600]);
const SETTLE_MS = Number(process.env.DRPG_S8_SETTLE_MS || 10_000);
const MEASURED = ["gm1", "p1"];
const median = list => { const s = list.filter(Number.isFinite).sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };

/* Spots inside a room: its deep spot and the cells around it as far as its depth reaches (all of them the room's,
   ../table.mjs `readTable`'s depth). */
function spotsOf(table, name) {
    const r = table.rooms[name];
    const out = [{ x: r.x, y: r.y }];
    for (let d = 1; d <= r.depth; d++) {
        for (let i = -d; i <= d; i++) for (let j = -d; j <= d; j++) {
            if (Math.max(Math.abs(i), Math.abs(j)) === d) out.push({ x: r.x + i * table.step, y: r.y + j * table.step });
        }
    }
    return out;
}

/* On GM1: what the world holds, counted (the census) - read before and after. */
function census({ sceneId }) {
    const scene = game.scenes.get(sceneId);
    const c = game.drpg.getClock();
    let projects = null, remnants = null;
    try { projects = game.drpg.allProjects().length; } catch { projects = null; }
    try { remnants = game.drpg.remnantsOn(scene).length; } catch { remnants = null; }
    return { tokens: scene.tokens.size, remnants, messages: game.messages.size, actors: game.actors.size, items: game.items.size,
        journals: game.journal.size, projects, clock: { chapter: c.chapter, day: c.day, session: c.session, timeOfDay: c.timeOfDay, phase: c.phase, eclipse: Boolean(c.eclipse) } };
}

/* On GM1: start recording every document created from now on. */
function startTracking() {
    if (window.__s8?.hooks) return false;
    const created = { Token: [], ChatMessage: [], Actor: [], Item: [], JournalEntry: [] };
    const hooks = [];
    for (const type of Object.keys(created)) {
        const id = Hooks.on(`create${type}`, doc => created[type].push({ id: doc.id, parent: doc.parent?.id ?? null, parentType: doc.parent?.documentName ?? null, at: Date.now() }));
        hooks.push([`create${type}`, id]);
    }
    window.__s8 = { created, hooks, startedAt: Date.now() };
    return true;
}

export async function run(ctx) {
    const { check, note, phase, settle } = ctx;
    const made = { remnants: [], projects: [], tokens: [], messages: [], actors: [] };
    const curve = [];
    const errorsSeen = {};
    const cdp = {};
    let table = null, before = null, p1Room = null, home = {}, moveSpots = [], moveIndex = 0, npcActor = null;
    let lastCounts = {};

    if (!ctx.c.gm1 || !ctx.c.p1 || !ctx.c.p2) { check("setup: GM1, P1 and P2 logged in", false, J(present(ctx, ["gm1", "p1", "p2"]))); return; }
    if (config.light) note("setup: DRPG_FULL_RENDER is not 1 - every browser runs at Foundry's lowest mode and 10 fps, and the frame numbers measure that cap", "");

    phase("setup");
    for (const role of ["gm1", "p1", "p2"]) {
        await ensureKit(ctx, role);
        errorsSeen[role] = await moduleErrors(ctx, role);
        if (config.engine === "chromium" && MEASURED.includes(role)) {
            try { cdp[role] = await ctx.c[role].page.context().newCDPSession(ctx.c[role].page); } catch (err) { note(`setup: no DevTools session on ${role}`, err.message); }
        }
    }
    table = await readTable(ctx, "gm1", ["gm1", "p1", "p2"]);
    if (table.error) { check("setup: an active scene", false, table.error); return; }
    const rooms = Object.keys(table.rooms).sort((a, b) => table.rooms[b].depth - table.rooms[a].depth || a.localeCompare(b));
    if (!rooms.length || !table.who.p1?.actorId || !table.who.p2?.actorId) { check("setup: rooms on the scene and characters for P1 and P2", false, J({ rooms, who: table.who })); return; }
    p1Room = rooms[0];
    const homeSpots = spotsOf(table, p1Room);
    moveSpots = homeSpots.slice(1, 5);
    if (moveSpots.length < 2) moveSpots = [homeSpots[0], homeSpots[0]];
    home = { p1: homeSpots[0], p2: homeSpots[1] ?? homeSpots[0] };
    const wasAt = { p1: table.who.p1.at, p2: table.who.p2.at };
    const placed = await placeTokens(ctx, "gm1", table.sceneId, ["p1", "p2"].map(role => ({ role, actorId: table.who[role].actorId, tokenId: table.who[role].tokenId, ...home[role] })));
    const token = { p1: placed.p1?.tokenId, p2: placed.p2?.tokenId };
    check("setup: P1 and P2 stand together in the deepest room", placed.p1?.room === p1Room && placed.p2?.room === p1Room, J({ p1Room, placed }));
    note("setup: the game was paused, unpaused", J(await unpause(ctx, "gm1")));
    await inPage(ctx, "gm1", startTracking);
    before = await inPage(ctx, "gm1", census, { sceneId: table.sceneId });
    note("setup: the scene and the census before", J({ scene: table.sceneName, rooms: rooms.length, p1Room, depth: table.rooms[p1Room].depth, levels: { REMNANTS, TOKENS, PROJECTS, MESSAGES }, before,
        render: config.light ? "lowest mode, 10 fps (DRPG_FULL_RENDER unset)" : "Foundry's own", engine: config.engine }));

    /* ---- one measurement ----------------------------------------------------------------------------------- */
    const p2Move = async () => {
        const to = moveSpots[moveIndex++ % moveSpots.length];
        const from = await inPage(ctx, "p1", id => { const t = canvas.tokens?.get(id); return t ? { x: t.document.x, y: t.document.y } : null; }, token.p2);
        if (!from) return { unseen: true };
        const target = from.x === to.x && from.y === to.y ? moveSpots[moveIndex++ % moveSpots.length] : to;
        await inPage(ctx, "p1", ({ id, from, to }) => {
            const w = window.__s8seen = { state: "watching", from, to };
            const t0 = Date.now();
            const loop = () => {
                const t = canvas.tokens?.get(id);
                const now = Date.now();
                if (t) {
                    const p = t.position ?? t;
                    if (!w.docAt && t.document.x === to.x && t.document.y === to.y) w.docAt = now;
                    if (!w.startAt && (Math.abs(p.x - from.x) > 0.5 || Math.abs(p.y - from.y) > 0.5)) w.startAt = now;
                    if (Math.abs(p.x - to.x) < 0.5 && Math.abs(p.y - to.y) < 0.5) { w.drawnAt = now; w.state = "done"; return; }
                    w.last = { x: Math.round(p.x), y: Math.round(p.y), visible: t.visible };
                }
                if (now - t0 > 15_000) { w.state = "timeout"; return; }
                requestAnimationFrame(loop);
            };
            requestAnimationFrame(loop);
        }, { id: token.p2, from, to: target });
        const wrote = await inPage(ctx, "p2", async ({ id, to }) => {
            const t = Date.now();
            try { await canvas.scene.tokens.get(id).update({ x: to.x, y: to.y }); } catch (err) { return { t, threw: String(err?.message ?? err) }; }
            return { t };
        }, { id: token.p2, to: target });
        let seen = null;
        for (let i = 0; i < 40; i++) {
            seen = await inPage(ctx, "p1", () => window.__s8seen);
            if (seen.state !== "watching") break;
            await sleep(400);
        }
        const rel = at => (Number.isFinite(at) ? at - wrote.t : null);
        return { threw: wrote.threw ?? null, state: seen?.state, docMs: rel(seen?.docAt), startMs: rel(seen?.startAt), drawnMs: rel(seen?.drawnAt), last: seen?.last ?? null };
    };

    const measure = async label => {
        await settle(SETTLE_MS);
        const row = { label, pages: {}, move: null };
        for (const role of MEASURED) {
            const p = row.pages[role] = {};
            try {
                if (cdp[role]) {
                    await cdp[role].send("HeapProfiler.collectGarbage");
                    p.heapMB = Math.round((await cdp[role].send("Runtime.getHeapUsage")).usedSize / 1e4) / 100;
                }
                const read = await inPage(ctx, role, async () => ({ nodes: document.getElementsByTagName("*").length, windows: window.__qa.appIds().length,
                    tokensDrawn: canvas.tokens?.placeables?.filter(t => t.visible).length ?? null, counts: (await game.drpg.counters())?.counts ?? {} }), null, { timeout: 60_000 });
                const grew = Object.entries(read.counts).map(([k, v]) => [k, v - (lastCounts[role]?.[k] ?? 0)]).filter(([, d]) => d > 0).sort((a, b) => b[1] - a[1]);
                lastCounts[role] = read.counts;
                Object.assign(p, { nodes: read.nodes, windows: read.windows, tokensDrawn: read.tokensDrawn, countersTotal: grew.reduce((s, [, d]) => s + d, 0), countersTop: Object.fromEntries(grew.slice(0, 12)) });
            } catch (err) {
                p.failed = String(err?.message ?? err).slice(0, 300);
            }
        }
        const moves = [];
        for (let i = 0; i < 3; i++) { moves.push(await p2Move().catch(err => ({ threw: err.message }))); await sleep(1500); }
        row.move = { docMs: median(moves.map(m => m.docMs)), startMs: median(moves.map(m => m.startMs)), drawnMs: median(moves.map(m => m.drawnMs)), each: moves };
        for (const role of MEASURED) {
            try {
                const text = await inPage(ctx, role, () => game.drpg.fps({ toChat: false }), null, { timeout: 180_000 });
                row.pages[role].fps = parseFps(text);
                row.pages[role].fpsText = String(text).slice(0, 1800);
            } catch (err) {
                row.pages[role].fps = null;
                row.pages[role].fpsError = String(err?.message ?? err);
            }
        }
        const fresh = {};
        for (const role of ["gm1", "p1", "p2"]) {
            const e = await moduleErrors(ctx, role).catch(err => ({ module: NaN, console: NaN, err: err.message }));
            fresh[role] = { module: e.module - errorsSeen[role].module, console: e.console - errorsSeen[role].console, samples: e.samples };
            errorsSeen[role] = e;
        }
        check(`${label}: no new error from the module on GM1, P1 or P2`, Object.values(fresh).every(f => f.module === 0 && f.console === 0), J(fresh));
        const missing = [];
        for (const role of MEASURED) {
            const p = row.pages[role];
            if (!p.fps) missing.push(`${role} fps`);
            if (!Number.isFinite(p.nodes)) missing.push(`${role} DOM nodes`);
            if (cdp[role] && !Number.isFinite(p.heapMB)) missing.push(`${role} heap`);
        }
        if (!Number.isFinite(row.move.docMs)) missing.push("P2's move on P1");
        check(`${label}: every measurement taken`, missing.length === 0, J({ missing, move: row.move.each }));
        const cell = role => { const p = row.pages[role], f = p.fps; return `${role}: ${f ? `${f.fps} fps, median ${f.medianMs} ms, p95 ${f.p95Ms} ms, ${f.over33} over 33, ${f.over50} over 50` : "fps -"}; heap ${p.heapMB ?? "-"} MB; ${p.nodes ?? "-"} nodes; ${p.windows ?? "-"} windows; ${p.tokensDrawn ?? "-"} tokens drawn; counters +${p.countersTotal ?? "-"}`; };
        note(`${label}: the measurement`, [cell("gm1"), cell("p1"), `p2's move on p1: doc ${row.move.docMs ?? "-"} ms, starts ${row.move.startMs ?? "-"} ms, drawn ${row.move.drawnMs ?? "-"} ms (median of 3)`,
            `counters gm1: ${J(row.pages.gm1.countersTop)}`, `counters p1: ${J(row.pages.p1.countersTop)}`].join("\n"));
        note(`${label}: fps reports`, `gm1:\n${row.pages.gm1.fpsText ?? row.pages.gm1.fpsError ?? "-"}\n\np1:\n${row.pages.p1.fpsText ?? row.pages.p1.fpsError ?? "-"}`);
        curve.push({ label, gm1: row.pages.gm1.fps, p1: row.pages.p1.fps, gm1HeapMB: row.pages.gm1.heapMB ?? null, p1HeapMB: row.pages.p1.heapMB ?? null,
            gm1Nodes: row.pages.gm1.nodes ?? null, p1Nodes: row.pages.p1.nodes ?? null, moveDrawnMs: row.move.drawnMs, moveDocMs: row.move.docMs, extra: null });
        return row;
    };

    try {
        phase("baseline");
        await measure("baseline");

        phase("remnants");
        const allSpots = rooms.map(name => spotsOf(table, name));
        for (const level of REMNANTS) {
            const want = level - made.remnants.length;
            const t0 = Date.now();
            for (let k = 0; k < want; k++) {
                const n = made.remnants.length;
                const ri = n % rooms.length, spot = allSpots[ri][Math.floor(n / rooms.length) % allSpots[ri].length];
                const id = await inPage(ctx, "gm1", async ({ sceneId, x, y, n, room }) => {
                    const doc = await game.drpg.placeRemnant({ x, y, sceneId, type: "prep", visibility: "evident", action: "manual", subject: `QA s8 trace ${n} in ${room}` });
                    return doc?.id ?? doc?.document?.id ?? null;
                }, { sceneId: table.sceneId, ...spot, n, room: rooms[ri] }, { timeout: 60_000 }).catch(err => `threw: ${err.message}`);
                if (typeof id === "string" && !id.startsWith("threw")) made.remnants.push(id);
                else { note(`remnants: trace ${n} was not placed`, J(id)); break; }
            }
            note(`remnants ${level}: placed`, J({ placed: made.remnants.length, ms: Date.now() - t0 }));
            await measure(`remnants ${made.remnants.length}`);
        }

        phase("tokens");
        npcActor = await inPage(ctx, "gm1", async () => {
            /* Not the module's own Remnant actor (remnants.mjs `ensureRemnantActor`: an "npc" flagged isRemnant). */
            const npc = game.actors.find(a => ["adversary", "npc"].includes(a.type) && !a.getFlag?.("danganronpa-rpg", "isRemnant"));
            if (npc) return { id: npc.id, made: false, type: npc.type };
            const types = Object.keys(CONFIG.Actor?.dataModels ?? {});
            const type = ["adversary", "npc"].find(t => types.includes(t)) ?? types.find(t => !["character", "party", "remnant"].includes(t));
            if (!type) return { none: types };
            const a = await Actor.create({ name: "QA s8 NPC", type });
            return { id: a.id, made: true, type };
        });
        if (npcActor?.made) made.actors.push(npcActor.id);
        note("tokens: the NPC actor the tokens are made from", J(npcActor));
        for (let i = 0; i < TOKENS.length; i++) {
            const wantTokens = TOKENS[i] - made.tokens.length;
            const list = [];
            for (let k = 0; k < wantTokens; k++) {
                const n = made.tokens.length + k;
                const room = n % 2 === 0 ? p1Room : rooms[1 + (n % Math.max(1, rooms.length - 1))] ?? p1Room;
                const spots = spotsOf(table, room);
                list.push({ ...spots[(Math.floor(n / 2) + 2) % spots.length], room });
            }
            if (npcActor?.id && list.length) {
                const ids = await inPage(ctx, "gm1", async ({ sceneId, actorId, list }) => {
                    const scene = game.scenes.get(sceneId), actor = game.actors.get(actorId);
                    const data = [];
                    for (const [k, s] of list.entries()) data.push((await actor.getTokenDocument({ x: s.x, y: s.y, hidden: false, name: `QA s8 NPC ${k}`, actorLink: false })).toObject());
                    return (await scene.createEmbeddedDocuments("Token", data)).map(t => t.id);
                }, { sceneId: table.sceneId, actorId: npcActor.id, list }, { timeout: 120_000 }).catch(err => { note("tokens: NPC tokens not made", err.message); return []; });
                made.tokens.push(...ids);
            }
            const wantProjects = (PROJECTS[i] ?? 0) - made.projects.length;
            for (let k = 0; k < wantProjects; k++) {
                const n = made.projects.length;
                const room = n % 2 === 0 ? p1Room : rooms[1 + (n % Math.max(1, rooms.length - 1))] ?? p1Room;
                const id = await inPage(ctx, "gm1", async ({ name, room }) => (await game.drpg.createProject({ name, target: 4, room }))?.id ?? null,
                    { name: `QA s8 project ${n}`, room }, { timeout: 60_000 }).catch(err => `threw: ${err.message}`);
                if (typeof id === "string" && !id.startsWith("threw")) made.projects.push(id);
                else { note(`tokens: project ${n} was not made`, J(id)); break; }
            }
            await measure(`tokens ${made.tokens.length}, projects ${made.projects.length}`);
        }

        phase("chat");
        for (const level of MESSAGES) {
            const t0 = Date.now();
            const want = level - made.messages.length;
            const kinds = { public: 0, whisper: 0, messenger: 0 };
            for (let k = 0; k < want;) {
                const n = made.messages.length;
                const kind = ["public", "whisper", "messenger"][n % 3];
                const batch = kind === "public" ? Math.min(25, want - k) : 1;
                const ids = await inPage(ctx, "gm1", async ({ kind, n, batch, p1Actor, users }) => {
                    if (kind === "public") {
                        const docs = await ChatMessage.createDocuments(Array.from({ length: batch }, (_, i) => ({ content: `<p>QA s8 public message ${n + i}: a line of table talk, about as long as one.</p>` })));
                        return docs.map(d => d.id);
                    }
                    if (kind === "whisper") {
                        const msg = await game.drpg.whisperToOwner(game.actors.get(p1Actor), `<p>QA s8 card ${n}: a private card from the GM, as a ruling or a find is told.</p>`);
                        return msg?.id ? [msg.id] : [];
                    }
                    const msg = await game.drpg.sendMessengerMessage(users[n % 2], `QA s8 messenger ${n}: the GM writes in the thread.`);
                    return msg?.id ? [msg.id] : [];
                }, { kind, n, batch, p1Actor: table.who.p1.actorId, users: [table.who.p1.userId, table.who.p2.userId] }, { timeout: 120_000 }).catch(err => { note(`chat: message ${n} threw`, err.message); return null; });
                if (!ids) break;
                /* A road that answers no document still made one (the hooks hold it): counted by position, kept by the hooks. */
                made.messages.push(...(ids.length ? ids : Array.from({ length: batch }, () => null)));
                kinds[kind] += batch;
                k += batch;
            }
            note(`chat ${level}: written`, J({ written: made.messages.length, ms: Date.now() - t0, kinds }));
            const opens = await inPage(ctx, "p1", async () => {
                const qa = window.__qa;
                const timeOpen = async (open, selector, itemSelector) => {
                    const before = qa.appIds();
                    const t0 = performance.now();
                    open();
                    let el = null, count = -1, stableSince = 0;
                    while (performance.now() - t0 < 15_000) {
                        await new Promise(r => requestAnimationFrame(r));
                        el = document.querySelector(selector);
                        if (!el) continue;
                        const n = el.querySelectorAll(itemSelector).length;
                        if (n !== count) { count = n; stableSince = performance.now(); }
                        else if (performance.now() - stableSince > 300) break;
                    }
                    const ms = el ? Math.round(stableSince - t0) : null;
                    await qa.closeNew(before);
                    return { ms, items: count };
                };
                return {
                    messenger: await timeOpen(() => game.drpg.openMessenger(), ".drpg-messenger", ".drpg-messenger-bubble"),
                    notices: await timeOpen(() => game.drpg.openNotices(), ".drpg-window-notices", ".drpg-notices-list > *")
                };
            }, null, { timeout: 60_000 }).catch(err => ({ threw: err.message }));
            await measure(`chat ${made.messages.length}`);
            curve[curve.length - 1].extra = opens;
            note(`chat ${made.messages.length}: P1 opens the messenger and the notice history (ms until the list stops growing, and its items)`, J(opens));
            check(`chat ${made.messages.length}: P1's messenger and notice history open and are timed`, Number.isFinite(opens?.messenger?.ms) && Number.isFinite(opens?.notices?.ms), J(opens));
        }

        phase("windows");
        const opened = await inPage(ctx, "gm1", async () => {
            const qa = window.__qa;
            const before = new Set(qa.appIds());
            game.drpg.gmPanel();
            await new Promise(r => setTimeout(r, 2000));
            game.drpg.monocubDialog();
            await new Promise(r => setTimeout(r, 2000));
            game.drpg.investigationDashboard();
            await new Promise(r => setTimeout(r, 3000));
            const ids = qa.appIds().filter(id => !before.has(id));
            window.__s8windows = { ids, before: [...before] };
            return ids.map(id => qa.describe(id, qa.apps().get(id)));
        });
        check("windows: the GM panel, the Students window and Investigation are open on GM1", opened.length >= 3, J(opened));
        const redraw = async (label, act) => {
            await inPage(ctx, "gm1", () => {
                const qa = window.__qa;
                for (const o of window.__s8obs ?? []) o.observer.disconnect();
                window.__s8obs = window.__s8windows.ids.map(id => {
                    const app = qa.apps().get(id);
                    const el = qa.appEl(app);
                    const rec = { id, cls: app?.constructor?.name ?? null, first: null, count: 0, t0: null };
                    const observer = new MutationObserver(list => { rec.count += list.length; if (rec.first === null && rec.t0 !== null) rec.first = Date.now() - rec.t0; });
                    if (el) observer.observe(el, { subtree: true, childList: true, attributes: true, characterData: true });
                    return { rec, observer };
                });
            });
            await sleep(1000);
            await inPage(ctx, "gm1", () => { const t = Date.now(); for (const o of window.__s8obs) { o.rec.t0 = t; o.rec.count = 0; o.rec.first = null; } });
            const acted = await act().catch(err => ({ threw: err.message }));
            await sleep(4000);
            const recs = await inPage(ctx, "gm1", () => window.__s8obs.map(o => ({ ...o.rec, connected: window.__qa.appEl(window.__qa.apps().get(o.rec.id))?.isConnected ?? false })));
            note(`windows: ${label} - ms until each window's DOM changed, and its mutations in 4 s`, J({ acted, windows: recs.map(r => ({ cls: r.cls, firstMs: r.first, mutations: r.count, stillOpen: r.connected })) }));
            return recs;
        };
        await redraw("a Remnant placed", async () => {
            const spot = allSpots[0][0];
            const id = await inPage(ctx, "gm1", async ({ sceneId, x, y }) => (await game.drpg.placeRemnant({ x, y, sceneId, type: "prep", visibility: "evident", action: "manual", subject: "QA s8 trace (windows)" }))?.id ?? null, { sceneId: table.sceneId, ...spot });
            if (id) made.remnants.push(id);
            return { id };
        });
        await redraw("a project made", async () => {
            const id = await inPage(ctx, "gm1", async room => (await game.drpg.createProject({ name: "QA s8 project (windows)", target: 4, room }))?.id ?? null, p1Room);
            if (id) made.projects.push(id);
            return { id };
        });
        await redraw("a public message", async () => {
            const id = await inPage(ctx, "gm1", async () => (await ChatMessage.create({ content: "<p>QA s8 public message (windows)</p>" }))?.id ?? null);
            if (id) made.messages.push(id);
            return { id };
        });
        await redraw("P2's token moved", () => p2Move());
        await measure("windows open, the whole world");
        await inPage(ctx, "gm1", () => { for (const o of window.__s8obs ?? []) o.observer.disconnect(); return window.__qa.closeNew(window.__s8windows.before); });
    } finally {
        phase("cleanup");
        note("curve: every level, as numbers (fps and median/p95 ms on GM1 and P1; heap MB; nodes; P2's move drawn on P1, ms)",
            curve.map(c => [c.label.padEnd(34), `gm1 ${c.gm1 ? `${c.gm1.fps} fps ${c.gm1.medianMs}/${c.gm1.p95Ms} ms` : "-"}`, `p1 ${c.p1 ? `${c.p1.fps} fps ${c.p1.medianMs}/${c.p1.p95Ms} ms` : "-"}`,
                `heap ${c.gm1HeapMB ?? "-"}/${c.p1HeapMB ?? "-"} MB`, `nodes ${c.gm1Nodes ?? "-"}/${c.p1Nodes ?? "-"}`, `move ${c.moveDocMs ?? "-"}/${c.moveDrawnMs ?? "-"} ms`,
                c.extra ? `open messenger ${c.extra.messenger?.ms ?? "-"} ms, notices ${c.extra.notices?.ms ?? "-"} ms` : ""].join(" | ")).join("\n"));
        if (ctx.c.gm1 && table) {
            const cleanOnce = () => inPage(ctx, "gm1", async ({ sceneId, made, wasAt }) => {
                const scene = game.scenes.get(sceneId);
                const out = { projects: 0, remnants: 0, tokens: 0, messages: 0, items: 0, journals: 0, actors: 0, failed: [] };
                const tracked = window.__s8?.created ?? { Token: [], ChatMessage: [], Actor: [], Item: [], JournalEntry: [] };
                for (const [hook, id] of window.__s8?.hooks ?? []) Hooks.off(hook, id);
                for (const id of made.projects) {
                    try { if (await game.drpg.deleteProject(id)) out.projects++; else out.failed.push(`project ${id}`); } catch (err) { out.failed.push(`project ${id}: ${err.message}`); }
                }
                await new Promise(r => setTimeout(r, 1500));
                const remnantIds = new Set([...made.remnants, ...tracked.Token.filter(t => t.parent === sceneId).map(t => t.id)]);
                for (const ref of game.drpg.remnantsOn(scene)) {
                    const id = ref.document?.id ?? ref.id;
                    if (!remnantIds.has(id)) continue;
                    try { await game.drpg.removeRemnant(ref); out.remnants++; } catch (err) { out.failed.push(`remnant ${id}: ${err.message}`); }
                }
                const tokenIds = [...new Set([...made.tokens, ...tracked.Token.filter(t => t.parentType === "Scene").map(t => t.id)])];
                const bySceneTokens = new Map();
                for (const t of tracked.Token) if (t.parentType === "Scene") bySceneTokens.set(t.parent, [...(bySceneTokens.get(t.parent) ?? []), t.id]);
                bySceneTokens.set(sceneId, [...new Set([...(bySceneTokens.get(sceneId) ?? []), ...tokenIds])]);
                for (const [sid, ids] of bySceneTokens) {
                    const s = game.scenes.get(sid);
                    const left = ids.filter(id => s?.tokens.get(id));
                    if (left.length) { try { await s.deleteEmbeddedDocuments("Token", left); out.tokens += left.length; } catch (err) { out.failed.push(`tokens on ${sid}: ${err.message}`); } }
                }
                const messageIds = [...new Set([...made.messages.filter(Boolean), ...tracked.ChatMessage.map(m => m.id)])].filter(id => game.messages.get(id));
                for (let i = 0; i < messageIds.length; i += 50) {
                    try { await ChatMessage.deleteDocuments(messageIds.slice(i, i + 50)); out.messages += messageIds.slice(i, i + 50).length; } catch (err) { out.failed.push(`messages: ${err.message}`); }
                }
                for (const it of tracked.Item) {
                    try {
                        const doc = it.parentType === "Actor" ? game.actors.get(it.parent)?.items.get(it.id) : it.parent ? null : game.items.get(it.id);
                        if (doc) { await doc.delete(); out.items++; }
                    } catch (err) { out.failed.push(`item ${it.id}: ${err.message}`); }
                }
                for (const j of tracked.JournalEntry) { try { const doc = game.journal.get(j.id); if (doc) { await doc.delete(); out.journals++; } } catch (err) { out.failed.push(`journal ${j.id}: ${err.message}`); } }
                /* Every actor created during the run, the module's Remnant actor among them when the first trace made it. */
                const actorIds = [...new Set([...made.actors, ...tracked.Actor.map(a => a.id)])];
                for (const id of actorIds) { try { const a = game.actors.get(id); if (a) { await a.delete(); out.actors++; } } catch (err) { out.failed.push(`actor ${id}: ${err.message}`); } }
                const back = Object.entries(wasAt).filter(([, at]) => at && at.tokenId && scene.tokens.get(at.tokenId)).map(([, at]) => ({ _id: at.tokenId, x: at.x, y: at.y }));
                if (back.length) await scene.updateEmbeddedDocuments("Token", back, { teleport: true, animate: false });
                await new Promise(r => setTimeout(r, 2000));
                const left = {
                    projects: made.projects.filter(id => game.drpg.allProjects().some(p => p.id === id)),
                    tokens: [...bySceneTokens].flatMap(([sid, ids]) => ids.filter(id => game.scenes.get(sid)?.tokens.get(id))),
                    remnants: [...remnantIds].filter(id => scene.tokens.get(id)),
                    messages: messageIds.filter(id => game.messages.get(id)),
                    actors: actorIds.filter(id => game.actors.get(id))
                };
                return { out, left, tracked: Object.fromEntries(Object.entries(tracked).map(([k, v]) => [k, v.length])) };
            }, { sceneId: table.sceneId, made, wasAt: {
                p1: table.who.p1.tokenId ? { tokenId: token.p1, ...wasAt.p1 } : null, p2: table.who.p2.tokenId ? { tokenId: token.p2, ...wasAt.p2 } : null } }, { timeout: 600_000 })
                .catch(err => ({ threw: String(err?.stack ?? err).slice(0, 800) }));
            /* The first S8 run on the owner's PC (25.11.2026): GM1's page navigated in the middle of the cleanup
               ("Execution context was destroyed"), and the world kept 220 tokens, 188 Remnants and 601 messages. The ids
               s8 wrote (`made`) are on this side, so the cleanup is run again, three times at most, once GM1's page is
               back (or GM1 logged in again); the hooks' record of other documents lived in the old page and is gone. */
            let result = null;
            for (let attempt = 1; attempt <= 3; attempt++) {
                result = await cleanOnce();
                if (!result?.threw) break;
                note(`cleanup: attempt ${attempt} broke; GM1's page waited for and the cleanup run again`, J({ threw: result.threw, url: ctx.c.gm1?.page.url() ?? null }));
                const back = ctx.c.gm1 && /^https?:/.test(ctx.c.gm1.page.url()) ? await ctx.until("gm1", "return game.ready === true", { timeout: 180_000 }) : null;
                if (!back) { await ctx.leave("gm1"); await ctx.rejoin("gm1"); }
                await settle(5000);
            }
            note("cleanup: what was removed", J(result));
            const after = await inPage(ctx, "gm1", census, { sceneId: table.sceneId }).catch(err => ({ threw: err.message }));
            const keys = ["tokens", "remnants", "messages", "actors", "items", "journals", "projects"];
            /* The census before is taken after P1's and P2's tokens were placed, so a token made for them is in both. */
            const diff = Object.fromEntries(keys.map(k => [k, (after?.[k] ?? NaN) - (before?.[k] ?? NaN)]).filter(([, d]) => d !== 0));
            const leftIds = Object.values(result?.left ?? {}).flat();
            check("cleanup: no document s8 created is left (tracked ids), and the census after equals the census before",
                !result?.threw && leftIds.length === 0 && Object.keys(diff).length === 0, J({ before, after, diff, left: result?.left, failed: result?.out?.failed }));
            check("cleanup: the clock is untouched (chapter, day, session, time of day, phase, Eclipse)", J(after?.clock) === J(before?.clock), J({ before: before?.clock, after: after?.clock }));
        } else {
            check("cleanup: GM1 is there to clean up", false, "GM1's page is gone or the setup never read the table; nothing was removed by s8");
        }
        for (const s of Object.values(cdp)) await s?.detach?.().catch(() => {});
    }
}
