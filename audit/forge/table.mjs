/**
 * What the S5-S7 scenarios share on Forge (the road to 2.0, F3; written 24.11.2026, NEVER RUN).
 * ---------------------------------------------------------------------------
 * Not a scenario: run.mjs runs the files of audit/forge/scenarios/ by name, and this one sits beside lib.mjs so nobody
 * names it. Three things live here:
 *
 *   1. THE PAGE KIT (`installKit`), put on `window.__qa` in each page the first time a scenario asks it, and again after
 *      a reload (it keys itself by `performance.timeOrigin`). It reads the A/V client, samples it every 100 ms into a log
 *      stamped with `Date.now()` (every page runs in one browser on one machine, so the stamps of six pages and of the
 *      runner share one clock), keeps the module's own console lines (`danganronpa-rpg |` errors, and the Debug line
 *      "Voice: the connect for X took N ms", voice-client.mjs `applyBreakout`), lists the open windows, and imports a
 *      module file from the address the page loaded the module from.
 *   2. THE TABLE (`readTable`, `placeTokens`, `moveTokens`): the active scene's rooms found by the module's own hit test
 *      (`game.drpg.roomOfToken` on a stand-in token at every grid cell), a deep spot per room, a spot outside every room
 *      beside two of them (a doorway or a corridor, for VOICE-05), and each role's token placed or found.
 *   3. THE VOICE READINGS (`planOf`, `converge`, `analyse`): the room the primary GM's plan wants for each account
 *      (`game.drpg.voiceTargets()`, the decision the reconcile loop sends), polled against the room each page's LiveKit
 *      client is in until they agree, and each page's log read for how long it took and how many reconnects it cost.
 *
 * UNMEASURED (each is read defensively and recorded raw, so the first run says which held):
 *   - avclient-livekit 0.6.8 on Forge keeps the livekit-client Room on `game.webrtc.client._liveKitClient.liveKitRoom`
 *     with `state` and `name`, and the room it connected to on `game.webrtc.client.room` (voice-client.mjs reads both;
 *     doctor.mjs recorded "disconnected" on Forge with LiveKit blocked, never "connected").
 *   - A participant's `identity` is the Foundry user id (peers are recorded raw; no check reads them).
 *   - Forge loads the module's files from an address a `<script type="module">` tag or the resource timing names; an
 *     `import()` of another address would build a second copy of the module with its own memory, so `kit.sameInstance`
 *     proves the copy by counting into it and reading the count back through `game.drpg.counters()`.
 *   - `roomOfToken` accepts a plain object for a token (movement.mjs `roomAt` reads x, y, width, height, elevation, level
 *     and parent alone) and the scene has one floor (level null asks every floor).
 */

import { config } from "./lib.mjs";

export const MOD = "danganronpa-rpg";
export const J = value => JSON.stringify(value);
export const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ==========================================================================
 * 1. THE PAGE KIT - runs in the page; self-contained (Playwright sends its source).
 * ========================================================================== */

function installKit() {
    if (window.__qa?.origin === performance.timeOrigin) return false;
    const qa = { origin: performance.timeOrigin, installedAt: Date.now(), consoleErrors: [], connects: [], sampler: null, same: undefined };

    /* The module's own console: its `error()` (utils.mjs) writes "danganronpa-rpg | ..." with console.error, which the
       page hooks' window.__errors never sees; its `debug()` writes console.debug, read here for the connect's length. */
    const wrap = (name, onLine) => {
        const original = console[name].bind(console);
        console[name] = (...args) => {
            try { onLine(args.map(a => (typeof a === "string" ? a : a?.stack ?? a?.message ?? (() => { try { return JSON.stringify(a); } catch { return String(a); } })())).join(" ")); } catch { /* never break the console */ }
            return original(...args);
        };
    };
    wrap("error", line => { if (line.startsWith("danganronpa-rpg |")) { qa.consoleErrors.push({ t: Date.now(), line: line.slice(0, 600) }); if (qa.consoleErrors.length > 500) qa.consoleErrors.shift(); } });
    wrap("debug", line => {
        const m = /the connect for "(.*)" took (\d+) ms \(connect (\d+) on this page\)/.exec(line);
        if (m) { qa.connects.push({ t: Date.now(), room: m[1], ms: Number(m[2]), n: Number(m[3]) }); if (qa.connects.length > 2000) qa.connects.shift(); }
    });

    /* Where this page loaded the module from: the module's <script type="module"> tag, else the first module file the
       resource timing lists, else Foundry's own path. Its folder is the base every other file of the module resolves
       against (a relative import carries no query string). */
    qa.modBase = () => {
        /* Forge's address may hold more between the module's id and scripts/ (a version, a package folder): any. */
        const re = /\/danganronpa-rpg\/(?:[^?#]*\/)?scripts\/[^/?#]+\.mjs/;
        const tag = [...document.querySelectorAll("script[type=module][src]")].map(s => s.src).find(s => re.test(s));
        const timed = tag ? null : (performance.getEntriesByType?.("resource") ?? []).map(e => e.name).find(n => re.test(n));
        const src = tag ?? timed ?? new URL("/modules/danganronpa-rpg/scripts/module.mjs", location.href).href;
        return new URL("./", src.split(/[?#]/)[0]).href;
    };
    qa.mod = file => import(qa.modBase() + file);
    qa.sameInstance = async () => {
        if (qa.same !== undefined) return qa.same;
        try {
            const C = await qa.mod("perf-counters.mjs");
            const name = `qa.instance.${Math.random().toString(36).slice(2)}`;
            C.count(name);
            qa.same = (await game.drpg.counters())?.counts?.[name] === 1;
        } catch (err) {
            qa.same = `threw: ${err?.message ?? err}`;
        }
        return qa.same;
    };

    /* The A/V client as this page holds it (voice-client.mjs `roomState`, `landedCorrectly`). */
    qa.av = () => {
        const c = game.webrtc?.client;
        const lk = c?._liveKitClient;
        const room = lk?.liveKitRoom;
        let peers = null;
        try {
            const map = room?.remoteParticipants ?? room?.participants;
            if (map?.values) peers = [...map.values()].map(p => String(p.identity ?? p.sid ?? "?")).sort();
        } catch { peers = null; }
        const state = typeof room?.state === "string" ? room.state : typeof lk?.connectionState === "string" ? lk.connectionState : null;
        return { mode: game.webrtc?.mode ?? null, cls: c?.constructor?.name ?? null, init: lk?.initState ?? null, conn: lk?.connectionState ?? null,
            state, room: c?.room ?? null, roomName: room?.name ?? null, told: lk?.breakoutRoom ?? null, peers };
    };

    /* One page's reading against a target (the plan's `target`): voice-client.mjs `landedCorrectly`'s rule, from outside. */
    qa.matches = (target, read = qa.av()) => {
        if (typeof target === "string" && target === `drpg-eclipse-${game.user.id}`) return read.state === "disconnected";
        if (read.state !== "connected") return false;
        return target ? read.room === target : !String(read.room ?? "").startsWith("drpg-");
    };

    qa.startSampler = (every = 100) => {
        if (qa.sampler) return false;
        const s = qa.sampler = { log: [], inits: [], key: null, every };
        const tick = () => {
            let v;
            try { v = qa.av(); } catch (err) { v = { state: `threw: ${err?.message ?? err}`, room: null, told: null, peers: null }; }
            const key = JSON.stringify([v.state, v.room, v.told, v.peers]);
            if (key === s.key) return;
            s.key = key;
            s.log.push({ t: Date.now(), state: v.state, room: v.room, told: v.told, peers: v.peers });
            if (s.log.length > 6000) s.log.splice(0, 2000);
        };
        tick();
        s.timer = setInterval(tick, every);
        try { Hooks.on("liveKitClientInitialized", () => s.inits.push(Date.now())); } catch { /* no Hooks: nothing to hear */ }
        return true;
    };
    /* The log from `since` on, with the last reading before it, for `analyse`. */
    qa.samples = async since => {
        const s = qa.sampler;
        let desired = null;
        if ((await qa.sameInstance()) === true) {
            try { const v = (await qa.mod("voice-client.mjs")).desiredRoom(); desired = v === undefined ? "(nobody said)" : v; } catch (err) { desired = `threw: ${err?.message ?? err}`; }
        }
        if (!s) return { none: true, now: qa.av(), desired };
        const before = [...s.log].reverse().find(e => e.t < since) ?? null;
        return { before, log: s.log.filter(e => e.t >= since), inits: s.inits.filter(t => t >= since), connects: qa.connects.filter(c => c.t >= since),
            now: qa.av(), desired, primary: (() => { try { return game.drpg.isPrimaryGm(); } catch { return null; } })() };
    };

    /* The windows open in this page: ApplicationV2 instances and the v1 windows, each with its root element. */
    qa.appEl = app => {
        const el = app?.element;
        if (el instanceof HTMLElement) return el;
        return el?.[0] instanceof HTMLElement ? el[0] : null;
    };
    qa.apps = () => {
        const out = new Map();
        for (const [id, app] of foundry.applications?.instances ?? []) out.set(String(id), app);
        for (const [id, app] of Object.entries(globalThis.ui?.windows ?? {})) out.set(`v1-${id}`, app);
        return out;
    };
    qa.appIds = () => [...qa.apps().entries()].filter(([, app]) => qa.appEl(app)?.isConnected).map(([id]) => id);
    qa.describe = (id, app) => {
        const el = qa.appEl(app);
        return { id, cls: app?.constructor?.name ?? null, title: String(app?.title ?? app?.options?.window?.title ?? "").slice(0, 80),
            classes: el ? [...el.classList].filter(c => c.startsWith("drpg")).slice(0, 8) : [] };
    };
    /* Close every window that was not open in `before` (a list of ids); answers what it closed. */
    qa.closeNew = async before => {
        const keep = new Set(before);
        const closed = [];
        for (const [id, app] of qa.apps()) {
            if (keep.has(id) || !qa.appEl(app)?.isConnected) continue;
            closed.push(qa.describe(id, app));
            try { await app.close({ animate: false }); } catch { /* a window that will not close is reported by the next count */ }
        }
        return closed;
    };

    window.__qa = qa;
    return true;
}

/** The kit on `role`'s page, installed when missing (a fresh page, or the same one after a reload). */
export async function ensureKit(ctx, role) {
    const page = ctx.c[role]?.page;
    if (!page) throw new Error(`${role} is not logged in`);
    return page.evaluate(installKit);
}

/**
 * Run `fn(arg)` in `role`'s page, the kit installed first. `fn` is sent as source: it closes over nothing, reads only
 * its argument and the page (`window.__qa`, `game`, ...).
 */
export async function inPage(ctx, role, fn, arg = null, { timeout = 60_000 } = {}) {
    await ensureKit(ctx, role);
    const page = ctx.c[role].page;
    let timer;
    try {
        return await Promise.race([
            page.evaluate(fn, arg),
            new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${role}: page call timed out after ${timeout} ms`)), timeout); })
        ]);
    } finally {
        clearTimeout(timer);
    }
}

/** The roles of `list` that are logged in now. */
export const present = (ctx, list) => list.filter(r => ctx.c[r]);

/** The account names of the roles (lib.mjs `config.users`). */
export const userNames = roles => Object.fromEntries(roles.map(r => [r, config.users[r]]));

/* ==========================================================================
 * 2. THE TABLE
 * ========================================================================== */

/**
 * On a GM's page: the active scene, its rooms with a deep spot each and their neighbours, one spot outside every room
 * beside two of them, each role's user, actor and token. Writes nothing.
 */
export async function readTable(ctx, gmRole, roles) {
    return inPage(ctx, gmRole, async ({ names }) => {
        const scene = game.scenes.active;
        if (!scene) return { error: "no active scene" };
        const size = scene.grid?.size ?? 100;
        const d = scene.dimensions ?? {};
        const x0 = d.sceneX ?? 0, y0 = d.sceneY ?? 0, w = d.sceneWidth ?? scene.width, h = d.sceneHeight ?? scene.height;
        let step = size;
        while ((w / step) * (h / step) > 40000) step *= 2;
        const cols = Math.floor(w / step), rows = Math.floor(h / step);
        const at = (x, y) => {
            try { return game.drpg.roomOfToken({ x, y, width: 1, height: 1, elevation: 0, level: null, parent: scene }) ?? null; }
            catch { return null; }
        };
        const t0 = performance.now();
        const grid = [];
        for (let r = 0; r < rows; r++) {
            const line = [];
            for (let c = 0; c < cols; c++) line.push(at(x0 + c * step, y0 + r * step));
            grid.push(line);
        }
        const cell = (r, c) => (r >= 0 && c >= 0 && r < rows && c < cols ? grid[r][c] : undefined);
        /* A cell's depth: the widest square ring around it, up to 3 cells, that holds its room alone. */
        const depth = (r, c) => {
            const name = grid[r][c];
            let k = 0;
            for (let ring = 1; ring <= 3; ring++) {
                for (let dr = -ring; dr <= ring; dr++) for (let dc = -ring; dc <= ring; dc++) {
                    if (Math.max(Math.abs(dr), Math.abs(dc)) === ring && cell(r + dr, c + dc) !== name) return k;
                }
                k = ring;
            }
            return k;
        };
        const named = (() => { try { return game.drpg.allRooms(scene) ?? []; } catch { return []; } })();
        const rooms = {};
        let gap = null;
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
            const name = grid[r][c];
            if (name) {
                const k = depth(r, c);
                if (!rooms[name] || k > rooms[name].depth) rooms[name] = { x: x0 + c * step, y: y0 + r * step, depth: k };
                continue;
            }
            const near = new Set();
            for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const n = cell(r + dr, c + dc); if (n) near.add(n); }
            if (near.size && (!gap || near.size > gap.between.length)) gap = { x: x0 + c * step, y: y0 + r * step, between: [...near].sort() };
        }
        const neighbours = {};
        for (const name of Object.keys(rooms)) {
            try { neighbours[name] = (game.drpg.neighbouringRooms(scene, name) ?? []).filter(n => rooms[n]); } catch { neighbours[name] = []; }
        }
        const isMk = a => { try { return Boolean(game.drpg.isMonokuma(a)); } catch { return false; } };
        const poolOf = a => { try { return game.drpg.poolUserFor(a)?.id ?? null; } catch { return null; } };
        const who = {};
        for (const [role, name] of Object.entries(names)) {
            const user = game.users.getName(name);
            if (!user) { who[role] = { missing: `no user "${name}"` }; continue; }
            const actor = user.isGM
                ? game.actors.find(a => isMk(a) && poolOf(a) === user.id) ?? game.actors.getName(name) ?? null
                : user.character ?? game.actors.getName(name) ?? null;
            const token = actor ? scene.tokens.find(t => t.actorId === actor.id) ?? null : null;
            who[role] = { userId: user.id, isGM: user.isGM, active: user.active, actorId: actor?.id ?? null, actorName: actor?.name ?? null,
                tokenId: token?.id ?? null, at: token ? { x: token.x, y: token.y } : null, room: token ? game.drpg.roomOfToken(token) : null };
        }
        return { sceneId: scene.id, sceneName: scene.name, grid: size, step, cells: rows * cols, scanMs: Math.round(performance.now() - t0),
            named, rooms, neighbours, gap, who, paused: game.paused };
    }, { names: userNames(roles) }, { timeout: 180_000 });
}

/**
 * On a GM's page: each `{ role, actorId, tokenId, x, y }` placed - a token created from the actor's prototype where it
 * has none on the scene, moved (teleport, no animation, as a GM tidying the map) where it has one. Answers each role's
 * token id and the room the module reads it in.
 */
export async function placeTokens(ctx, gmRole, sceneId, list) {
    return inPage(ctx, gmRole, async ({ sceneId, list }) => {
        const scene = game.scenes.get(sceneId);
        const out = {};
        for (const p of list) {
            try {
                let token = p.tokenId ? scene.tokens.get(p.tokenId) : null;
                if (!token) {
                    const actor = game.actors.get(p.actorId);
                    const proto = await actor.getTokenDocument({ x: p.x, y: p.y, hidden: false });
                    [token] = await scene.createEmbeddedDocuments("Token", [proto.toObject()]);
                    out[p.role] = { created: true };
                } else {
                    await token.update({ x: p.x, y: p.y, hidden: false }, { teleport: true, animate: false });
                    out[p.role] = { created: false };
                }
                out[p.role].tokenId = token.id;
            } catch (err) {
                out[p.role] = { error: String(err?.message ?? err) };
            }
        }
        await new Promise(r => setTimeout(r, 800));
        for (const p of list) {
            const token = out[p.role]?.tokenId ? scene.tokens.get(out[p.role].tokenId) : null;
            if (token) out[p.role].room = game.drpg.roomOfToken(token);
        }
        return out;
    }, { sceneId, list }, { timeout: 120_000 });
}

/**
 * Move tokens as a drop writes them: one `updateEmbeddedDocuments` of x and y, Foundry's own animation, no option of
 * the module's - on `role`'s page (a GM for the voice tests, the owning player for the soak). Answers the page's
 * `Date.now()` at the write and what threw.
 */
export async function moveTokens(ctx, role, sceneId, moves) {
    return inPage(ctx, role, async ({ sceneId, moves }) => {
        const scene = game.scenes.get(sceneId);
        const t = Date.now();
        try {
            await scene.updateEmbeddedDocuments("Token", moves.map(m => ({ _id: m.tokenId, x: m.x, y: m.y })));
            return { t };
        } catch (err) {
            return { t, threw: String(err?.message ?? err) };
        }
    }, { sceneId, moves }, { timeout: 60_000 });
}

/** Unpause the game on a GM's page (Foundry's own toggle, broadcast); answers whether it was paused. */
export async function unpause(ctx, gmRole) {
    return inPage(ctx, gmRole, () => {
        const was = game.paused;
        if (was) { try { game.togglePause(false, { broadcast: true }); } catch { game.togglePause(false, true); } }
        return was;
    });
}

/**
 * Pick three rooms A, B, C with B a neighbour of A and C a neighbour of B (not A) where the map has such a chain, else
 * any three; and as many more distinct rooms as asked. Rooms are ranked by the depth of their spot.
 */
export function chooseRooms(table, more = 4) {
    const names = Object.keys(table.rooms).sort((a, b) => table.rooms[b].depth - table.rooms[a].depth || a.localeCompare(b));
    let chain = null;
    for (const a of names) {
        for (const b of table.neighbours[a] ?? []) {
            const c = (table.neighbours[b] ?? []).find(n => n !== a);
            if (c) { chain = [a, b, c]; break; }
        }
        if (chain) break;
    }
    const neighboursChain = Boolean(chain);
    chain ??= names.slice(0, 3);
    const rest = names.filter(n => !chain.includes(n));
    return { chain, neighboursChain, spare: rest.slice(0, more), all: names };
}

/* ==========================================================================
 * 3. THE VOICE READINGS
 * ========================================================================== */

/** The node-side twin of `qa.matches`. */
export function matches(target, read, userId) {
    if (!read) return false;
    if (typeof target === "string" && target === `drpg-eclipse-${userId}`) return read.state === "disconnected";
    if (read.state !== "connected") return false;
    return target ? read.room === target : !String(read.room ?? "").startsWith("drpg-");
}

/** The primary GM's plan, read on `gmRole`: `{ primary, eclipse, targets: { userId: target|null } }`. */
export async function planOf(ctx, gmRole) {
    return inPage(ctx, gmRole, async () => {
        const primary = game.drpg.isPrimaryGm();
        try {
            const t = await game.drpg.voiceTargets();
            return { primary, eclipse: Boolean(t.eclipse), targets: Object.fromEntries([...t.byUser].map(([id, row]) => [id, row?.target ?? null])),
                kept: Object.fromEntries([...t.byUser].map(([id, row]) => [id, Boolean(row?.kept)])) };
        } catch (err) {
            return { primary, error: String(err?.message ?? err) };
        }
    }, null, { timeout: 30_000 });
}

/** The GM role of `gms` that is the primary GM now (asked of itself), or null. */
export async function primaryRole(ctx, gms) {
    for (const role of present(ctx, gms)) {
        try { if (await inPage(ctx, role, () => game.drpg.isPrimaryGm(), null, { timeout: 15_000 })) return role; } catch { /* a page reloading */ }
    }
    return null;
}

/**
 * Read one page's log from `since` (`qa.samples`) against `target`:
 *   matchedAt      when the reading that still holds began to match (since itself when it matched throughout), or null
 *   leftAt         the first reading after `since` that is not the connected room the page stood in before it
 *   gapMs          matchedAt - leftAt: how long the page was between rooms
 *   silentMs       the time after `since` the Room was in any state but connected, up to matchedAt (or the last reading)
 *   reconnects     readings after `since` that came into "connected" from another state, or moved room while connected
 *   rooms          the rooms the page was connected to after `since`, in order (VOICE-02: a room only passed through)
 */
export function analyse(sample, target, userId, since, until = Date.now()) {
    if (!sample || sample.none) return { none: true };
    const entries = [...(sample.before ? [sample.before] : []), ...(sample.log ?? [])];
    let stable = entries.length;
    while (stable > 0 && matches(target, entries[stable - 1], userId)) stable--;
    const matched = stable < entries.length;
    const matchedAt = matched ? Math.max(since, entries[stable].t) : null;
    const before = sample.before;
    const after = (sample.log ?? []);
    const left = after.find(e => !(before && before.state === "connected" && e.state === "connected" && e.room === before.room));
    let reconnects = 0, silentMs = 0;
    const rooms = [];
    for (let i = 0; i < entries.length; i++) {
        const e = entries[i], prev = entries[i - 1];
        if (e.t < since) continue;
        if (e.state === "connected" && (!prev || prev.state !== "connected" || prev.room !== e.room)) {
            reconnects++;
            if (rooms[rooms.length - 1] !== e.room) rooms.push(e.room);
        }
    }
    const end = matchedAt ?? until;
    for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        if (e.state === "connected") continue;
        const from = Math.max(since, e.t), to = Math.min(end, entries[i + 1]?.t ?? end);
        if (to > from) silentMs += to - from;
    }
    return {
        target, matched, matchedAfterMs: matched ? matchedAt - since : null, leftAfterMs: left ? left.t - since : null,
        gapMs: matched && left ? Math.max(0, matchedAt - left.t) : null, silentMs: Math.round(silentMs), reconnects, rooms,
        inits: sample.inits?.length ?? null, connectMs: (sample.connects ?? []).map(c => c.ms), connectRooms: (sample.connects ?? []).map(c => c.room),
        now: sample.now ? { state: sample.now.state, room: sample.now.room, told: sample.now.told, peers: sample.now.peers } : null,
        desired: sample.desired
    };
}

/**
 * Wait until every page of `roles` is in the room the primary GM's plan wants for its account, or `timeout`; the plan is
 * read again on every round (on `planRole`, which should be the primary), so a pass that changes it is followed. Answers
 * `{ allMatched, ms, plan, per: { role: analyse(...) }, missing: [roles with no plan row] }`.
 */
export async function converge(ctx, { roles, planRole, users, since, timeout = 90_000, every = 1000 }) {
    const t0 = Date.now();
    let plan = null, allMatched = false, lastReads = {};
    while (Date.now() - t0 < timeout) {
        try { plan = await planOf(ctx, planRole); } catch (err) { plan = { error: String(err?.message ?? err) }; }
        if (plan?.targets) {
            allMatched = true;
            for (const role of present(ctx, roles)) {
                let read = null;
                try { read = await inPage(ctx, role, () => window.__qa.av(), null, { timeout: 10_000 }); } catch { read = null; }
                lastReads[role] = read;
                const target = plan.targets[users[role]];
                if (!(users[role] in plan.targets) || !matches(target, read, users[role])) allMatched = false;
            }
            if (allMatched) break;
        }
        await sleep(every);
    }
    const per = {};
    for (const role of present(ctx, roles)) {
        let sample = null;
        try { sample = await inPage(ctx, role, s => window.__qa.samples(s), since, { timeout: 20_000 }); } catch (err) { sample = { none: true, err: String(err?.message ?? err) }; }
        per[role] = analyse(sample, plan?.targets?.[users[role]] ?? null, users[role], since);
        if (!(users[role] in (plan?.targets ?? {}))) per[role].noPlanRow = true;
    }
    return { allMatched, ms: Date.now() - t0, plan, per, lastReads,
        missing: present(ctx, roles).filter(r => !(users[r] in (plan?.targets ?? {}))) };
}

/** The module's counters on a page, the voice ones only (`game.drpg.counters()`; perf-counters.mjs). */
export async function voiceCounters(ctx, role) {
    return inPage(ctx, role, async () => {
        const c = (await game.drpg.counters())?.counts ?? {};
        return { connects: c["voice.connect"] ?? 0, connectMs: c["voice.connect.ms"] ?? 0 };
    }, null, { timeout: 20_000 });
}

/** What one page has seen of LiveKit in its toasts (FORGE-03): the page hooks' record of every notification, and the DOM. */
export async function liveKitToasts(ctx, role) {
    return inPage(ctx, role, () => {
        const all = (window.__notifications ?? []).filter(n => /livekit/i.test(n.message));
        const shown = [...document.querySelectorAll("#notifications .notification, #notifications li")].filter(el => /livekit/i.test(el.textContent ?? ""));
        return { recorded: all.length, errors: all.filter(n => n.type === "error").length, warnings: all.filter(n => n.type === "warning").length,
            onScreen: shown.length, texts: [...new Set(all.map(n => n.message.slice(0, 120)))].slice(0, 6) };
    }, null, { timeout: 15_000 });
}

/** The errors a page holds that come from the module: window.__errors naming its files, and its own console errors. */
export async function moduleErrors(ctx, role) {
    return inPage(ctx, role, () => {
        const errors = [...(window.__errors ?? [])];
        const mine = errors.filter(e => /danganronpa-rpg/.test(e));
        return { all: errors.length, module: mine.length, console: window.__qa.consoleErrors.length,
            samples: [...mine.slice(0, 3), ...window.__qa.consoleErrors.slice(0, 3).map(e => e.line)].map(s => String(s).slice(0, 400)) };
    }, null, { timeout: 15_000 });
}
