/**
 * S8 on Forge: how much in the world before the game slows down, for a GM and for a player (the road to 2.0, F3;
 * written 24.11.2026; run twice on the owner's PC, 25.11.2026, F3-forge-PC-2.md). S6 tests time; this tests size.
 * ---------------------------------------------------------------------------
 *     DRPG_FULL_RENDER=1 DRPG_FORGE_URL=... DRPG_FORGE_WORLD=DRPG-QA-Forge node audit/forge/run.mjs s8-load
 *
 * THE THIRD PASS (F3PC2-S8-CURVE; 2.0 line T4, 27.11.2026). The two passes of 25.11.2026 drew two curves - flat at
 * 250-278 fps, then 22-82 fps over the first six levels and 260-279 after - on one PC with nothing else running, and
 * nobody can say which was the table. Before the owner sets any threshold (D2-18: none here), a third pass runs exactly
 * as above, DRPG_S8_RELOAD unset (a reload is a cleanup test, not a curve), on the PC with a GPU, with no other
 * browser window or program in the front, and the report's "conditions" notes are read beside the curve: every level
 * records, for GM1 and P1, `document.visibilityState` and `hasFocus()`, the WebGL renderer
 * (`WEBGL_debug_renderer_info`), Foundry's performance mode and frame cap with DRPG_FULL_RENDER, the canvas's size and
 * resolution with `devicePixelRatio`, `hardwareConcurrency`, the time since the page loaded, the pages open in the
 * browser, and the memory. The first level is measured only after a warm-up (DRPG_S8_WARMUP_MS, 30 s), and measured
 * again after the cleanup, the world as it was found: a gap between the two baselines that the conditions explain (a
 * hidden or unfocused page, another renderer) is the run's, one they do not is the world's.
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
 *   DRPG_S8_WARMUP_MS  30000             the wait before the first level is measured (nothing measured in it)
 *   DRPG_S8_RELOAD     unset             1: GM1's page is reloaded in the middle of the cleanup (the cleanup test)
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
 *               each found FIRST by the run's tag across the whole world and THEN by the ids this side and GM1's hooks
 *               kept (below); with DRPG_S8_RELOAD=1, GM1's page reloaded once the cleanup has removed a few, and the
 *               cleanup run again on the fresh page, which holds no hook's record; then the first level measured again
 *               ("baseline again, after the cleanup"), P1's and P2's tokens put back, the census after
 *
 * THE TAG (F3PC2-S8-CLEANUP; 2.0 line T4, 27.11.2026). Every document s8 creates carries `flags.world.drpgQa` = this
 * run's tag (page-kit.mjs `runTag("s8")`): world scope, not the module's, so it is no module data and no rule of
 * world-secrets.mjs reads it. In the creation data where s8 writes the document itself (NPC tokens, the NPC actor,
 * public messages); right after the module's road answers it where that road takes no flags (`placeRemnant`'s token,
 * `whisperToOwner`'s and `sendMessengerMessage`'s messages: one flag update each, before the level's settle); and for
 * what the module makes beside them (the Remnant actor, a project's token, an announcement) a pass over GM1's hooks'
 * record after each level's writes. A project is no document (a countdown in Daggerheart's setting): its name holds the
 * tag. Why: the first pass's cleanup broke with GM1's page (220 tokens, 188 Remnants and 601 messages left), and the
 * hand cleanup after it could tell s8's traces from others only by the scene and the hour - the traces' record lives in
 * the GM store of a browser, which a fresh one does not hold. The tagged tokens are counted before and after every
 * level, s8's NPC tokens and Remnants among them, so a token that vanishes is caught within a level (the first pass
 * lost 32 NPC tokens "QA s8" between two runs and nobody saw when).
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
 *   - with DRPG_S8_RELOAD=1: "cleanup after a reload leaves nothing tagged" (FLOW) - the reload came while the cleanup
 *     ran, and after it no document in the world carries this run's tag
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
 *   - That `canvas.app.renderer.gl` is the WebGL context Foundry draws with (the renderer's name is read off it), and
 *     that `game.settings.get("core", "performanceMode")` and `"maxFPS"` name the mode and the cap the page runs at.
 *   - That a flag update of a Remnant token or a module message changes nothing the module reads (world scope).
 */

import { config } from "../lib.mjs";
import { J, sleep, inPage, ensureKit, present, readTable, placeTokens, unpause, moduleErrors, parseFps } from "../table.mjs";
import { runTag } from "../page-kit.mjs";

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
const WARMUP_MS = Number(process.env.DRPG_S8_WARMUP_MS || 30_000);
const RELOAD = process.env.DRPG_S8_RELOAD === "1";
/* This run's tag, on every document it creates (the header's THE TAG). */
const TAG = runTag("s8");
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

/* On GM1: what the world holds, counted (the census) - read before and after. `tagged` counts what carries this run's
   tag anywhere in the world (every scene, every actor's items); `otherRuns` what carries another s8 run's, never removed
   here (a run's own cleanup is its own; what an earlier run left is the owner's to look at). */
function census({ sceneId, tag }) {
    const scene = game.scenes.get(sceneId);
    const c = game.drpg.getClock();
    let projects = null, remnants = null;
    try { projects = game.drpg.allProjects().length; } catch { projects = null; }
    try { remnants = game.drpg.remnantsOn(scene).length; } catch { remnants = null; }
    const mark = d => d?.flags?.world?.drpgQa ?? null;
    const tagged = { tokens: 0, messages: 0, actors: 0, items: 0, journals: 0, projects: 0 };
    const otherRuns = { tokens: 0, messages: 0, actors: 0, items: 0, journals: 0 };
    const count = (kind, d) => { const m = mark(d); if (m === tag) tagged[kind]++; else if (typeof m === "string" && m.startsWith("s8-")) otherRuns[kind]++; };
    for (const s of game.scenes) for (const t of s.tokens) count("tokens", t);
    for (const m of game.messages) count("messages", m);
    for (const a of game.actors) { count("actors", a); for (const i of a.items) count("items", i); }
    for (const i of game.items) count("items", i);
    for (const j of game.journal) count("journals", j);
    try { tagged.projects = game.drpg.allProjects().filter(p => String(p.name ?? "").includes(tag)).length; } catch { tagged.projects = null; }
    return { tokens: scene.tokens.size, remnants, messages: game.messages.size, actors: game.actors.size, items: game.items.size,
        journals: game.journal.size, projects, tagged, taggedTotal: Object.values(tagged).reduce((n, v) => n + (v ?? 0), 0), otherRuns,
        clock: { chapter: c.chapter, day: c.day, session: c.session, timeOfDay: c.timeOfDay, phase: c.phase, eclipse: Boolean(c.eclipse) } };
}

/* On GM1: the tokens carrying this run's tag on the scene, and how many of the ids s8 holds for its NPC tokens and its
   Remnants still stand - read before and after every level (the header's THE TAG). */
function taggedTokens({ sceneId, tag, npc, remnants }) {
    const scene = game.scenes.get(sceneId);
    const all = scene.tokens.filter(t => t.flags?.world?.drpgQa === tag);
    return { at: Date.now(), tagged: all.length, npcExpected: npc.length, npcStanding: npc.filter(id => scene.tokens.get(id)).length,
        npcTagged: all.filter(t => npc.includes(t.id)).length, remnantsExpected: remnants.length, remnantsStanding: remnants.filter(id => scene.tokens.get(id)).length };
}

/* On GM1: what GM1's hooks recorded as created and does not carry the tag yet (a document the module made beside s8's
   own - the Remnant actor, a project's token, an announcement), tagged in one write per kind and parent. */
async function tagPending({ tag }) {
    const tracked = window.__s8?.created;
    if (!tracked) return { none: "no hooks' record on this page" };
    const out = { Token: 0, ChatMessage: 0, Actor: 0, Item: 0, JournalEntry: 0, failed: [] };
    const patch = id => ({ _id: id, "flags.world.drpgQa": tag });
    const untagged = d => d && d.flags?.world?.drpgQa !== tag;
    const byScene = new Map();
    for (const t of tracked.Token) {
        const doc = t.parentType === "Scene" ? game.scenes.get(t.parent)?.tokens.get(t.id) : null;
        if (untagged(doc)) byScene.set(t.parent, [...(byScene.get(t.parent) ?? []), t.id]);
    }
    for (const [sid, ids] of byScene) {
        try { await game.scenes.get(sid).updateEmbeddedDocuments("Token", ids.map(patch)); out.Token += ids.length; } catch (err) { out.failed.push(`tokens: ${err.message}`); }
    }
    for (const [type, coll, cls] of [["ChatMessage", game.messages, ChatMessage], ["Actor", game.actors, Actor], ["JournalEntry", game.journal, JournalEntry]]) {
        const ids = tracked[type].map(r => r.id).filter(id => untagged(coll.get(id)));
        for (let i = 0; i < ids.length; i += 50) {
            try { await cls.updateDocuments(ids.slice(i, i + 50).map(patch)); out[type] += ids.slice(i, i + 50).length; } catch (err) { out.failed.push(`${type}: ${err.message}`); }
        }
    }
    for (const it of tracked.Item) {
        try {
            const doc = it.parentType === "Actor" ? game.actors.get(it.parent)?.items.get(it.id) : it.parent ? null : game.items.get(it.id);
            if (untagged(doc)) { await doc.setFlag("world", "drpgQa", tag); out.Item++; }
        } catch (err) { out.failed.push(`item ${it.id}: ${err.message}`); }
    }
    return out;
}

/* On a measured page: the run's conditions (F3PC2-S8-CURVE; the header's THE THIRD PASS). Read, never changed. */
function conditions({ fullRender }) {
    let renderer = null, vendor = null;
    try {
        const gl = canvas?.app?.renderer?.gl ?? null;
        const ext = gl?.getExtension?.("WEBGL_debug_renderer_info") ?? null;
        renderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl ? `(no WEBGL_debug_renderer_info) ${gl.getParameter(gl.RENDERER)}` : "no WebGL context on canvas.app.renderer";
        vendor = ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : null;
    } catch (err) { renderer = `threw: ${err?.message ?? err}`; }
    const setting = key => { try { return game.settings.get("core", key); } catch { return null; } };
    const r = canvas?.app?.renderer;
    const mem = performance.memory;
    return { visibility: document.visibilityState, hasFocus: document.hasFocus(), renderer, vendor,
        performanceMode: setting("performanceMode"), maxFPS: setting("maxFPS"), fullRender,
        canvas: r ? { width: r.width ?? null, height: r.height ?? null, resolution: r.resolution ?? null, view: r.view ? { w: r.view.width, h: r.view.height } : null } : null,
        devicePixelRatio: window.devicePixelRatio, viewport: { w: innerWidth, h: innerHeight }, hardwareConcurrency: globalThis.navigator?.hardwareConcurrency ?? null,
        sinceLoadS: Math.round(performance.now() / 100) / 10,
        memoryMB: mem ? { used: Math.round(mem.usedJSHeapSize / 1e4) / 100, total: Math.round(mem.totalJSHeapSize / 1e4) / 100, limit: Math.round(mem.jsHeapSizeLimit / 1e4) / 100 } : null,
        deviceMemoryGB: globalThis.navigator?.deviceMemory ?? null };
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
    before = await inPage(ctx, "gm1", census, { sceneId: table.sceneId, tag: TAG });
    note("setup: the scene and the census before", J({ scene: table.sceneName, rooms: rooms.length, p1Room, depth: table.rooms[p1Room].depth, levels: { REMNANTS, TOKENS, PROJECTS, MESSAGES }, before,
        render: config.light ? "lowest mode, 10 fps (DRPG_FULL_RENDER unset)" : "Foundry's own", engine: config.engine, tag: TAG, reload: RELOAD, warmupMs: WARMUP_MS }));
    if (before.otherRuns && Object.values(before.otherRuns).some(n => n > 0)) note("setup: documents tagged by another s8 run are in the world (left as they are)", J(before.otherRuns));

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

    /* The tagged tokens on the scene and s8's own ids still standing (`taggedTokens`): before each level's writes and
       after its settle (F3PC2-S8-CLEANUP). */
    const tokenCount = () => inPage(ctx, "gm1", taggedTokens, { sceneId: table.sceneId, tag: TAG, npc: made.tokens, remnants: made.remnants }).catch(err => ({ threw: err.message }));
    /* The run's conditions on each measured page and the pages open in the browser (F3PC2-S8-CURVE). */
    const conditionsNow = async () => {
        const out = {};
        for (const role of MEASURED) out[role] = await inPage(ctx, role, conditions, { fullRender: !config.light }).catch(err => ({ threw: err.message }));
        try { out.pagesOpen = ctx.c.gm1.page.context().browser()?.contexts().reduce((n, c) => n + c.pages().length, 0) ?? null; } catch { out.pagesOpen = null; }
        out.loggedIn = Object.keys(ctx.c);
        return out;
    };
    const short = c => (c && !c.threw ? `${c.visibility}${c.hasFocus ? ", focused" : ", not focused"}; ${String(c.renderer ?? "-").slice(0, 60)}; mode ${c.performanceMode ?? "-"}, max ${c.maxFPS ?? "-"} fps; canvas ${c.canvas?.width ?? "-"}x${c.canvas?.height ?? "-"} @${c.canvas?.resolution ?? "-"}, dpr ${c.devicePixelRatio}; ${c.hardwareConcurrency ?? "-"} cores; ${c.sinceLoadS} s since load; memory ${c.memoryMB?.used ?? "-"} MB` : J(c));

    const measure = async (label, { taggedBefore = null, warmup = 0 } = {}) => {
        const tagged = ctx.c.gm1 ? await inPage(ctx, "gm1", tagPending, { tag: TAG }).catch(err => ({ threw: err.message })) : null;
        if (warmup) {
            /* The warm-up (F3PC2-S8-CURVE): nothing measured, so a first level read while the pages still compile
               shaders, load textures and warm caches is not the curve's first point. */
            note(`${label}: warm-up before the first measurement, nothing measured`, J({ ms: warmup, conditions: await conditionsNow() }));
            await settle(warmup);
        }
        await settle(SETTLE_MS);
        const row = { label, pages: {}, move: null, conditions: await conditionsNow(), taggedBefore, taggedAfter: await tokenCount(), tagPending: tagged };
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
        note(`${label}: conditions (F3PC2-S8-CURVE)`, [`gm1: ${short(row.conditions.gm1)}`, `p1: ${short(row.conditions.p1)}`, `pages open: ${row.conditions.pagesOpen ?? "-"} (${row.conditions.loggedIn.join(", ")})`,
            `full: ${J(row.conditions)}`].join("\n"));
        note(`${label}: tagged tokens on the scene, before the level's writes and after its settle (F3PC2-S8-CLEANUP)`, J({ before: row.taggedBefore, after: row.taggedAfter, tagPending: row.tagPending }));
        curve.push({ label, gm1: row.pages.gm1.fps, p1: row.pages.p1.fps, gm1HeapMB: row.pages.gm1.heapMB ?? null, p1HeapMB: row.pages.p1.heapMB ?? null,
            gm1Nodes: row.pages.gm1.nodes ?? null, p1Nodes: row.pages.p1.nodes ?? null, moveDrawnMs: row.move.drawnMs, moveDocMs: row.move.docMs, extra: null,
            gm1Cond: short(row.conditions.gm1), p1Cond: short(row.conditions.p1), taggedAfter: row.taggedAfter?.tagged ?? null });
        return row;
    };

    try {
        phase("baseline");
        await measure("baseline", { taggedBefore: await tokenCount(), warmup: WARMUP_MS });

        phase("remnants");
        const allSpots = rooms.map(name => spotsOf(table, name));
        for (const level of REMNANTS) {
            const taggedBefore = await tokenCount();
            const want = level - made.remnants.length;
            const t0 = Date.now();
            for (let k = 0; k < want; k++) {
                const n = made.remnants.length;
                const ri = n % rooms.length, spot = allSpots[ri][Math.floor(n / rooms.length) % allSpots[ri].length];
                const id = await inPage(ctx, "gm1", async ({ sceneId, x, y, n, room, tag }) => {
                    const doc = await game.drpg.placeRemnant({ x, y, sceneId, type: "prep", visibility: "evident", action: "manual", subject: `QA s8 trace ${n} in ${room}` });
                    /* `placeRemnant` takes no flags: the tag right after it answers its token (THE TAG). */
                    const tokenDoc = doc?.document ?? doc;
                    try { await tokenDoc?.setFlag?.("world", "drpgQa", tag); } catch { /* the hooks' pass tags it after the level */ }
                    return doc?.id ?? doc?.document?.id ?? null;
                }, { sceneId: table.sceneId, ...spot, n, room: rooms[ri], tag: TAG }, { timeout: 60_000 }).catch(err => `threw: ${err.message}`);
                if (typeof id === "string" && !id.startsWith("threw")) made.remnants.push(id);
                else { note(`remnants: trace ${n} was not placed`, J(id)); break; }
            }
            note(`remnants ${level}: placed`, J({ placed: made.remnants.length, ms: Date.now() - t0 }));
            await measure(`remnants ${made.remnants.length}`, { taggedBefore });
        }

        phase("tokens");
        npcActor = await inPage(ctx, "gm1", async ({ tag }) => {
            /* Not the module's own Remnant actor (remnants.mjs `ensureRemnantActor`: an "npc" flagged isRemnant). */
            const npc = game.actors.find(a => ["adversary", "npc"].includes(a.type) && !a.getFlag?.("danganronpa-rpg", "isRemnant"));
            if (npc) return { id: npc.id, made: false, type: npc.type };
            const types = Object.keys(CONFIG.Actor?.dataModels ?? {});
            const type = ["adversary", "npc"].find(t => types.includes(t)) ?? types.find(t => !["character", "party", "remnant"].includes(t));
            if (!type) return { none: types };
            const a = await Actor.create({ name: "QA s8 NPC", type, flags: { world: { drpgQa: tag } } });
            return { id: a.id, made: true, type };
        }, { tag: TAG });
        if (npcActor?.made) made.actors.push(npcActor.id);
        note("tokens: the NPC actor the tokens are made from", J(npcActor));
        for (let i = 0; i < TOKENS.length; i++) {
            const taggedBefore = await tokenCount();
            const wantTokens = TOKENS[i] - made.tokens.length;
            const list = [];
            for (let k = 0; k < wantTokens; k++) {
                const n = made.tokens.length + k;
                const room = n % 2 === 0 ? p1Room : rooms[1 + (n % Math.max(1, rooms.length - 1))] ?? p1Room;
                const spots = spotsOf(table, room);
                list.push({ ...spots[(Math.floor(n / 2) + 2) % spots.length], room });
            }
            if (npcActor?.id && list.length) {
                const ids = await inPage(ctx, "gm1", async ({ sceneId, actorId, list, tag }) => {
                    const scene = game.scenes.get(sceneId), actor = game.actors.get(actorId);
                    const data = [];
                    for (const [k, s] of list.entries()) {
                        const obj = (await actor.getTokenDocument({ x: s.x, y: s.y, hidden: false, name: `QA s8 NPC ${k}`, actorLink: false })).toObject();
                        obj.flags = { ...(obj.flags ?? {}), world: { ...(obj.flags?.world ?? {}), drpgQa: tag } };
                        data.push(obj);
                    }
                    return (await scene.createEmbeddedDocuments("Token", data)).map(t => t.id);
                }, { sceneId: table.sceneId, actorId: npcActor.id, list, tag: TAG }, { timeout: 120_000 }).catch(err => { note("tokens: NPC tokens not made", err.message); return []; });
                made.tokens.push(...ids);
            }
            const wantProjects = (PROJECTS[i] ?? 0) - made.projects.length;
            for (let k = 0; k < wantProjects; k++) {
                const n = made.projects.length;
                const room = n % 2 === 0 ? p1Room : rooms[1 + (n % Math.max(1, rooms.length - 1))] ?? p1Room;
                const id = await inPage(ctx, "gm1", async ({ name, room }) => (await game.drpg.createProject({ name, target: 4, room }))?.id ?? null,
                    { name: `QA s8 project ${n} [${TAG}]`, room }, { timeout: 60_000 }).catch(err => `threw: ${err.message}`);
                if (typeof id === "string" && !id.startsWith("threw")) made.projects.push(id);
                else { note(`tokens: project ${n} was not made`, J(id)); break; }
            }
            await measure(`tokens ${made.tokens.length}, projects ${made.projects.length}`, { taggedBefore });
        }

        phase("chat");
        for (const level of MESSAGES) {
            const taggedBefore = await tokenCount();
            const t0 = Date.now();
            const want = level - made.messages.length;
            const kinds = { public: 0, whisper: 0, messenger: 0 };
            for (let k = 0; k < want;) {
                const n = made.messages.length;
                const kind = ["public", "whisper", "messenger"][n % 3];
                const batch = kind === "public" ? Math.min(25, want - k) : 1;
                const ids = await inPage(ctx, "gm1", async ({ kind, n, batch, p1Actor, users, tag }) => {
                    if (kind === "public") {
                        const docs = await ChatMessage.createDocuments(Array.from({ length: batch }, (_, i) => ({ content: `<p>QA s8 public message ${n + i}: a line of table talk, about as long as one.</p>`, flags: { world: { drpgQa: tag } } })));
                        return docs.map(d => d.id);
                    }
                    /* The module's two roads take no flags: the tag right after each answers its message (THE TAG). */
                    const tagged = async msg => { try { await msg?.setFlag?.("world", "drpgQa", tag); } catch { /* the hooks' pass tags it after the level */ } return msg?.id ? [msg.id] : []; };
                    if (kind === "whisper") return tagged(await game.drpg.whisperToOwner(game.actors.get(p1Actor), `<p>QA s8 card ${n}: a private card from the GM, as a ruling or a find is told.</p>`));
                    return tagged(await game.drpg.sendMessengerMessage(users[n % 2], `QA s8 messenger ${n}: the GM writes in the thread.`));
                }, { kind, n, batch, p1Actor: table.who.p1.actorId, users: [table.who.p1.userId, table.who.p2.userId], tag: TAG }, { timeout: 120_000 }).catch(err => { note(`chat: message ${n} threw`, err.message); return null; });
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
            await measure(`chat ${made.messages.length}`, { taggedBefore });
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
            const id = await inPage(ctx, "gm1", async ({ sceneId, x, y, tag }) => {
                const doc = await game.drpg.placeRemnant({ x, y, sceneId, type: "prep", visibility: "evident", action: "manual", subject: "QA s8 trace (windows)" });
                try { await (doc?.document ?? doc)?.setFlag?.("world", "drpgQa", tag); } catch { /* the hooks' pass tags it */ }
                return doc?.id ?? null;
            }, { sceneId: table.sceneId, ...spot, tag: TAG });
            if (id) made.remnants.push(id);
            return { id };
        });
        await redraw("a project made", async () => {
            const id = await inPage(ctx, "gm1", async ({ room, name }) => (await game.drpg.createProject({ name, target: 4, room }))?.id ?? null, { room: p1Room, name: `QA s8 project (windows) [${TAG}]` });
            if (id) made.projects.push(id);
            return { id };
        });
        await redraw("a public message", async () => {
            const id = await inPage(ctx, "gm1", async tag => (await ChatMessage.create({ content: "<p>QA s8 public message (windows)</p>", flags: { world: { drpgQa: tag } } }))?.id ?? null, TAG);
            if (id) made.messages.push(id);
            return { id };
        });
        await redraw("P2's token moved", () => p2Move());
        await measure("windows open, the whole world", { taggedBefore: await tokenCount() });
        await inPage(ctx, "gm1", () => { for (const o of window.__s8obs ?? []) o.observer.disconnect(); return window.__qa.closeNew(window.__s8windows.before); });
    } finally {
        phase("cleanup");
        if (ctx.c.gm1 && table) {
            /* FIRST BY THE TAG, THEN BY THE IDS (F3PC2-S8-CLEANUP; 2.0 line T4, 27.11.2026). The ids are this side's
               (`made`) and GM1's hooks' record (`window.__s8`), which a reload of GM1's page empties; the tag is on
               the documents themselves, so a fresh page finds them by it across the whole world - every scene's
               tokens and Remnants, the chat, the actors with their items, the world's items and journal entries, and
               the projects by the tag in their names. `out.byTag` and `out.byIdOnly` say which road found each kind,
               so a run shows whether the tag held. `window.__s8clean.removed` is the progress the reload phase waits on. */
            const cleanOnce = () => inPage(ctx, "gm1", async ({ sceneId, made, tag }) => {
                const scene = game.scenes.get(sceneId);
                const progress = window.__s8clean = { removed: 0, step: "start" };
                const out = { projects: 0, remnants: 0, tokens: 0, messages: 0, items: 0, journals: 0, actors: 0, failed: [],
                    byTag: { projects: 0, remnants: 0, tokens: 0, messages: 0, items: 0, journals: 0, actors: 0 }, byIdOnly: { projects: 0, remnants: 0, tokens: 0, messages: 0, items: 0, journals: 0, actors: 0 } };
                const tracked = window.__s8?.created ?? { Token: [], ChatMessage: [], Actor: [], Item: [], JournalEntry: [] };
                for (const [hook, id] of window.__s8?.hooks ?? []) Hooks.off(hook, id);
                const flagged = d => d?.flags?.world?.drpgQa === tag;
                const counted = (kind, byTag, n = 1) => { out[kind] += n; out[byTag ? "byTag" : "byIdOnly"][kind] += n; progress.removed += n; };

                progress.step = "projects";
                const projectIds = new Set(made.projects);
                const taggedProjects = new Set(game.drpg.allProjects().filter(p => String(p.name ?? "").includes(tag)).map(p => p.id));
                for (const id of taggedProjects) projectIds.add(id);
                for (const id of projectIds) {
                    if (!game.drpg.allProjects().some(p => p.id === id)) continue;
                    try { if (await game.drpg.deleteProject(id)) counted("projects", taggedProjects.has(id)); else out.failed.push(`project ${id}`); } catch (err) { out.failed.push(`project ${id}: ${err.message}`); }
                }
                await new Promise(r => setTimeout(r, 1500));

                progress.step = "remnants";
                const remnantIds = new Set([...made.remnants, ...tracked.Token.filter(t => t.parent === sceneId).map(t => t.id)]);
                for (const s of game.scenes) {
                    let refs = [];
                    try { refs = game.drpg.remnantsOn(s) ?? []; } catch { refs = []; }
                    for (const ref of refs) {
                        const id = ref.document?.id ?? ref.id;
                        const doc = ref.document ?? s.tokens.get(id);
                        const byTag = flagged(doc);
                        if (!byTag && !(s.id === sceneId && remnantIds.has(id))) continue;
                        try { await game.drpg.removeRemnant(ref); counted("remnants", byTag); } catch (err) { out.failed.push(`remnant ${id}: ${err.message}`); }
                    }
                }

                progress.step = "tokens";
                const idTokens = new Map();
                for (const t of tracked.Token) if (t.parentType === "Scene") idTokens.set(t.parent, new Set([...(idTokens.get(t.parent) ?? []), t.id]));
                idTokens.set(sceneId, new Set([...(idTokens.get(sceneId) ?? []), ...made.tokens]));
                for (const s of game.scenes) {
                    const ids = new Set(idTokens.get(s.id) ?? []);
                    const tagged = s.tokens.filter(flagged).map(t => t.id);
                    const all = [...new Set([...tagged, ...[...ids].filter(id => s.tokens.get(id))])];
                    if (!all.length) continue;
                    try { await s.deleteEmbeddedDocuments("Token", all); counted("tokens", true, tagged.length); counted("tokens", false, all.length - tagged.length); }
                    catch (err) { out.failed.push(`tokens on ${s.id}: ${err.message}`); }
                }

                progress.step = "messages";
                const taggedMessages = game.messages.filter(flagged).map(m => m.id);
                const messageIds = [...new Set([...taggedMessages, ...made.messages.filter(Boolean), ...tracked.ChatMessage.map(m => m.id)])].filter(id => game.messages.get(id));
                const taggedSet = new Set(taggedMessages);
                for (let i = 0; i < messageIds.length; i += 50) {
                    const part = messageIds.slice(i, i + 50);
                    try { await ChatMessage.deleteDocuments(part); const t = part.filter(id => taggedSet.has(id)).length; counted("messages", true, t); counted("messages", false, part.length - t); }
                    catch (err) { out.failed.push(`messages: ${err.message}`); }
                }

                progress.step = "items";
                const items = [];
                for (const a of game.actors) for (const it of a.items) if (flagged(it)) items.push({ doc: it, byTag: true });
                for (const it of game.items) if (flagged(it)) items.push({ doc: it, byTag: true });
                for (const it of tracked.Item) {
                    const doc = it.parentType === "Actor" ? game.actors.get(it.parent)?.items.get(it.id) : it.parent ? null : game.items.get(it.id);
                    if (doc && !items.some(x => x.doc === doc)) items.push({ doc, byTag: false });
                }
                for (const { doc, byTag } of items) { try { await doc.delete(); counted("items", byTag); } catch (err) { out.failed.push(`item ${doc.id}: ${err.message}`); } }

                progress.step = "journals";
                const journals = new Map(game.journal.filter(flagged).map(j => [j.id, true]));
                for (const j of tracked.JournalEntry) if (!journals.has(j.id)) journals.set(j.id, false);
                for (const [id, byTag] of journals) { try { const doc = game.journal.get(id); if (doc) { await doc.delete(); counted("journals", byTag); } } catch (err) { out.failed.push(`journal ${id}: ${err.message}`); } }

                /* Every actor created during the run, the module's Remnant actor among them when the first trace made it. */
                progress.step = "actors";
                const actors = new Map(game.actors.filter(flagged).map(a => [a.id, true]));
                for (const id of [...made.actors, ...tracked.Actor.map(a => a.id)]) if (!actors.has(id)) actors.set(id, false);
                for (const [id, byTag] of actors) { try { const a = game.actors.get(id); if (a) { await a.delete(); counted("actors", byTag); } } catch (err) { out.failed.push(`actor ${id}: ${err.message}`); } }
                await new Promise(r => setTimeout(r, 2000));
                progress.step = "done";
                const left = {
                    projects: [...projectIds].filter(id => game.drpg.allProjects().some(p => p.id === id)),
                    tokens: [...idTokens].flatMap(([sid, ids]) => [...ids].filter(id => game.scenes.get(sid)?.tokens.get(id))),
                    remnants: [...remnantIds].filter(id => scene.tokens.get(id)),
                    messages: messageIds.filter(id => game.messages.get(id)),
                    actors: [...actors.keys()].filter(id => game.actors.get(id))
                };
                return { out, left, tracked: Object.fromEntries(Object.entries(tracked).map(([k, v]) => [k, v.length])) };
            }, { sceneId: table.sceneId, made, tag: TAG }, { timeout: 600_000 })
                .catch(err => ({ threw: String(err?.stack ?? err).slice(0, 800) }));

            /* DRPG_S8_RELOAD=1: GM1's page reloaded while the cleanup runs (F3PC2-S8-CLEANUP). The first S8 pass's page
               navigated mid-cleanup by itself ("Execution context was destroyed"); the repeat below (poprawka 10,
               ada39e93) was never seen to work, the second pass needing none. Here the reload is forced once the
               cleanup has removed five documents, so the second attempt runs on a page with no hooks' record and
               must find the rest by the tag. */
            const reloadMidCleanup = async running => {
                let settled = false;
                running.then(() => { settled = true; });
                const t0 = Date.now();
                let removed = 0, step = null;
                while (!settled && Date.now() - t0 < 120_000) {
                    const p = await ctx.c.gm1.page.evaluate(() => window.__s8clean ?? null).catch(() => null);
                    removed = p?.removed ?? removed; step = p?.step ?? step;
                    if (removed >= 5) break;
                    await sleep(250);
                }
                if (settled) return { tooLate: true, removedBefore: removed, step };
                const tR = Date.now();
                let reloadError = null;
                await ctx.reload("gm1").catch(err => { reloadError = String(err?.message ?? err).split("\n")[0]; });
                return { afterMs: tR - t0, removedBefore: removed, step, readyMs: Date.now() - tR, reloadError };
            };

            /* The first S8 run on the owner's PC (25.11.2026): GM1's page navigated in the middle of the cleanup
               ("Execution context was destroyed"), and the world kept 220 tokens, 188 Remnants and 601 messages. The ids
               s8 wrote (`made`) are on this side, so the cleanup is run again, three times at most, once GM1's page is
               back (or GM1 logged in again); the hooks' record of other documents lived in the old page and is gone,
               and the tag finds them (2.0 line T4). */
            let result = null, reload = null;
            const attempts = [];
            const gm1Page = ctx.c.gm1.page;
            for (let attempt = 1; attempt <= 3; attempt++) {
                const running = cleanOnce();
                if (RELOAD && attempt === 1) reload = await reloadMidCleanup(running);
                result = await running;
                attempts.push({ attempt, threw: result?.threw ? String(result.threw).split("\n")[0].slice(0, 200) : null, out: result?.out ?? null });
                if (!result?.threw) break;
                note(`cleanup: attempt ${attempt} broke; GM1's page waited for and the cleanup run again`, J({ threw: result.threw, url: ctx.c.gm1?.page.url() ?? null }));
                const back = ctx.c.gm1 && /^https?:/.test(ctx.c.gm1.page.url()) ? await ctx.until("gm1", "return game.ready === true", { timeout: 180_000 }) : null;
                if (!back) { await ctx.leave("gm1"); await ctx.rejoin("gm1"); }
                await settle(5000);
            }
            note("cleanup: what was removed (byTag: found by this run's tag; byIdOnly: by an id alone)", J({ result, attempts, reload }));

            /* A reloaded or new GM1 page: its errors and counters start again, and a new page needs its own DevTools session. */
            if (attempts.length > 1 || reload) {
                errorsSeen.gm1 = { module: 0, console: 0, samples: [] };
                lastCounts.gm1 = {};
                if (config.engine === "chromium" && ctx.c.gm1 && ctx.c.gm1.page !== gm1Page) {
                    await cdp.gm1?.detach?.().catch(() => {});
                    try { cdp.gm1 = await ctx.c.gm1.page.context().newCDPSession(ctx.c.gm1.page); } catch (err) { cdp.gm1 = null; note("cleanup: no DevTools session on GM1's new page", err.message); }
                }
            }

            /* The first level again, the world as it was found (F3PC2-S8-CURVE): P1 and P2 still stand where the run put
               them, so the move measured is the baseline's. */
            if (ctx.c.p1 && ctx.c.p2) {
                phase("baseline again");
                await measure("baseline again, after the cleanup", { taggedBefore: await tokenCount() }).catch(err => note("baseline again: not measured", String(err?.message ?? err)));
                phase("cleanup");
            } else note("baseline again: not measured - P1's or P2's page is gone", J(present(ctx, ["p1", "p2"])));

            const wasAtBack = { p1: table.who.p1.tokenId ? { tokenId: token.p1, ...wasAt.p1 } : null, p2: table.who.p2.tokenId ? { tokenId: token.p2, ...wasAt.p2 } : null };
            const putBack = await inPage(ctx, "gm1", async ({ sceneId, wasAt }) => {
                const scene = game.scenes.get(sceneId);
                const back = Object.values(wasAt).filter(at => at && at.tokenId && scene.tokens.get(at.tokenId)).map(at => ({ _id: at.tokenId, x: at.x, y: at.y }));
                if (back.length) await scene.updateEmbeddedDocuments("Token", back, { teleport: true, animate: false });
                await new Promise(r => setTimeout(r, 2000));
                return back.length;
            }, { sceneId: table.sceneId, wasAt: wasAtBack }, { timeout: 60_000 }).catch(err => `threw: ${err.message}`);
            note("cleanup: P1's and P2's tokens put back where they stood", J(putBack));

            const after = await inPage(ctx, "gm1", census, { sceneId: table.sceneId, tag: TAG }).catch(err => ({ threw: err.message }));
            const keys = ["tokens", "remnants", "messages", "actors", "items", "journals", "projects"];
            /* The census before is taken after P1's and P2's tokens were placed, so a token made for them is in both. */
            const diff = Object.fromEntries(keys.map(k => [k, (after?.[k] ?? NaN) - (before?.[k] ?? NaN)]).filter(([, d]) => d !== 0));
            const leftIds = Object.values(result?.left ?? {}).flat();
            check("cleanup: no document s8 created is left (tracked ids), and the census after equals the census before",
                !result?.threw && leftIds.length === 0 && Object.keys(diff).length === 0, J({ before, after, diff, left: result?.left, failed: result?.out?.failed, tagged: after?.tagged }));
            check("cleanup: the clock is untouched (chapter, day, session, time of day, phase, Eclipse)", J(after?.clock) === J(before?.clock), J({ before: before?.clock, after: after?.clock }));
            if (RELOAD) {
                /* Measured only when the reload came while the cleanup ran and broke it: a cleanup that finished first
                   measured no reload, and fails as such. */
                const mid = Boolean(reload && !reload.tooLate && reload.removedBefore > 0 && attempts[0]?.threw);
                check("cleanup after a reload leaves nothing tagged", mid && after?.taggedTotal === 0,
                    J({ reloadCameMidCleanup: mid, reload, attempts, tagged: after?.tagged, taggedTotal: after?.taggedTotal, otherRuns: after?.otherRuns }), { ids: ["FLOW"] });
            } else note("cleanup: documents tagged by this run after the cleanup (DRPG_S8_RELOAD unset: no reload, no check of its own)", J({ tagged: after?.tagged, taggedTotal: after?.taggedTotal }));
        } else {
            check("cleanup: GM1 is there to clean up", false, "GM1's page is gone or the setup never read the table; nothing was removed by s8");
        }
        note("curve: every level, as numbers (fps and median/p95 ms on GM1 and P1; heap MB; nodes; P2's move drawn on P1, ms; tagged tokens after)",
            curve.map(c => [c.label.padEnd(34), `gm1 ${c.gm1 ? `${c.gm1.fps} fps ${c.gm1.medianMs}/${c.gm1.p95Ms} ms` : "-"}`, `p1 ${c.p1 ? `${c.p1.fps} fps ${c.p1.medianMs}/${c.p1.p95Ms} ms` : "-"}`,
                `heap ${c.gm1HeapMB ?? "-"}/${c.p1HeapMB ?? "-"} MB`, `nodes ${c.gm1Nodes ?? "-"}/${c.p1Nodes ?? "-"}`, `move ${c.moveDocMs ?? "-"}/${c.moveDrawnMs ?? "-"} ms`,
                c.extra ? `open messenger ${c.extra.messenger?.ms ?? "-"} ms, notices ${c.extra.notices?.ms ?? "-"} ms` : "", `tagged ${c.taggedAfter ?? "-"}`].join(" | ")).join("\n"));
        note("curve: the conditions of every level (F3PC2-S8-CURVE)", curve.map(c => `${c.label.padEnd(34)} | gm1 ${c.gm1Cond} | p1 ${c.p1Cond}`).join("\n"));
        for (const s of Object.values(cdp)) await s?.detach?.().catch(() => {});
    }
}
