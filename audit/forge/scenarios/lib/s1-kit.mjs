/**
 * What the S1 scenarios share (the road to 2.0, F3, S1; 24.11.2026): the page kit each browser carries, the table's
 * set-up, and the readings both scenarios take the same way.
 * ---------------------------------------------------------------------------
 * NOT A SCENARIO. It sits in scenarios/lib/ so that run.mjs, which takes `scenarios/<name>.mjs`, never runs it.
 *
 * THE PAGE KIT (`pageKit`). Serialised with `Function#toString` and run once in each page (`install`), it leaves
 * `globalThis.__f3` there:
 *   - what the page SHOWS, recorded as it happens: every notification element Foundry adds (`.notification`), every
 *     popup card the module raises (`.drpg-popup-body`), every window rendered (`renderApplicationV2`, its title and
 *     classes) and every chat message created (its id; its words read at read time through secret.mjs `contentOf`, so a
 *     private card whose words arrive after the document is read with them). `F.since(t)` answers them from time `t`.
 *   - the windows: `F.apps()` the rendered ones, `F.answer(spec)` fills and presses one, `F.answerSoon(spec, ms)` waits
 *     for it, `F.auto(id, spec)` keeps answering one (a killer's "Stay hidden?").
 *   - Daggerheart's roll window pressed as a player presses it (`F.pressRolls`): a `renderApplicationV2` hook clicks
 *     `button[data-action="submitRoll"]` after `delay` ms, as tests-tier2.mjs `pressingRoll` does at a real table.
 *   - a token as THIS canvas draws it (`F.tokenState`, `F.sample`): placed, drawn (the placeable's and its mesh's
 *     `visible` and the mesh's alpha), masked (the module's flag), the name and the nameplate's text.
 *   - jobs (`F.start(key, fn)` / `F.job(key)`): a call that waits on another browser (an action, a window) is started
 *     and polled, never awaited inside one `eval`.
 *   - GM readings: `F.econ(actorId)` (Hope, the student's Monokuma's Despair, the overflow, the setting), `F.duality`
 *     (the newest roll of an actor since a time, by despair-award.mjs `readDuality`), `F.cards(call)` (the ruling cards
 *     whose words hold a `data-drpg-call` button) and `F.press` (messenger-app.mjs `pressCard`: the road a click takes).
 *
 * WHICH COPY OF THE MODULE (UNMEASURED on Forge): a page imports the module's files from the URL the browser loaded
 * them from, read off `performance.getEntriesByType("resource")`, so `import()` answers the module's own instances and
 * not a second copy with state of its own; with no entry found it falls back to `modules/danganronpa-rpg/scripts/`
 * relative to the page. Forge serves the module from assets.forge-vtt.com (F3-forge-S0.md); whether the entry is there
 * on every browser is the first thing `install` reports (`base`, `fromEntries`).
 *
 * WHAT IT WRITES: nothing in `pageKit`. `setupTable` writes the world (GM1's browser): tokens of P1-P4 and the two
 * Monokumas created on the active scene where absent and moved into the rooms named, the game unpaused, and on a
 * scenario's request a stale incident closed, an Eclipse ended without advancing and a dead P1-P4 revived. Every write
 * is returned in `wrote`, which the scenarios put in a note.
 */

export const MOD = "danganronpa-rpg";
export const J = value => JSON.stringify(value ?? null);

export function pageKit() {
    if (globalThis.__f3?.ready) return globalThis.__f3.summary();
    const F = globalThis.__f3 = { ready: false, events: [], jobs: {}, autos: {}, samplers: {}, rolls: [], chat: [] };
    const MOD = "danganronpa-rpg";
    F.MOD = MOD;
    const entry = performance.getEntriesByType("resource").map(e => e.name).find(n => /\/danganronpa-rpg\/scripts\/[^/?#]+\.mjs/.test(n));
    F.fromEntries = Boolean(entry);
    F.base = entry ? entry.replace(/[^/]+\.mjs([?#].*)?$/, "") : new URL(`modules/${MOD}/scripts/`, document.baseURI).href;
    F.imp = name => import(`${F.base}${name}.mjs`);
    F.sleep = ms => new Promise(r => setTimeout(r, ms));
    F.now = () => Date.now();
    F.text = el => String(el?.innerText ?? el?.textContent ?? "").replace(/\s+/g, " ").trim();
    F.strip = html => { const box = document.createElement("div"); box.innerHTML = String(html ?? ""); return F.text(box); };
    F.safe = value => { try { return JSON.parse(JSON.stringify(value ?? null)); } catch { return String(value); } };

    /* What this page shows. */
    const marked = new WeakSet();
    const scan = node => {
        for (const [kind, sel] of [["notice", ".notification"], ["popup", ".drpg-popup-body"]]) {
            const hits = node.matches?.(sel) ? [node] : [...(node.querySelectorAll?.(sel) ?? [])];
            for (const el of hits) {
                if (marked.has(el)) continue;
                marked.add(el);
                const at = Date.now();
                F.events.push({ kind, at, text: F.text(el) });
                // A popup's words may be drawn a moment after its frame: read again once.
                setTimeout(() => { const row = F.events.find(e => e.at === at && e.kind === kind && !e.text); if (row) row.text = F.text(el); }, 400);
            }
        }
    };
    new MutationObserver(muts => { for (const m of muts) for (const n of m.addedNodes) if (n.nodeType === 1) scan(n); })
        .observe(document.body, { childList: true, subtree: true });
    Hooks.on("renderApplicationV2", app => {
        F.events.push({ kind: "window", at: Date.now(), id: app.id, title: String(app.title ?? ""), cls: [...(app.options?.classes ?? [])] });
    });
    Hooks.on("createChatMessage", message => {
        F.chat.push({ at: Date.now(), id: message.id });
    });
    // The incident's stage as this browser's copy holds it, at every write of the world's half (`murderState`).
    Hooks.on("updateSetting", setting => {
        if (setting?.key !== `${MOD}.murderState`) return;
        setTimeout(() => { const s = game.drpg?.murderState?.() ?? null; F.events.push({ kind: "murder", at: Date.now(), stage: s?.stage ?? null, active: Boolean(s?.active) }); }, 0);
    });
    let secret = null;
    F.imp("secret").then(m => { secret = m; }).catch(() => {});
    F.words = message => { try { return F.strip(secret ? secret.contentOf(message) : message?.content); } catch { return F.strip(message?.content); } };
    F.chatRow = row => {
        const m = game.messages.get(row.id);
        return { kind: "chat", at: row.at, id: row.id, gone: !m, toMe: Boolean(m?.whisper?.includes?.(game.user.id)),
            whisper: [...(m?.whisper ?? [])], author: m?.author?.id ?? m?.user?.id ?? null, speaker: m?.speaker?.actor ?? null, text: m ? F.words(m) : "" };
    };
    /** Everything this page showed from `t` on: notices, popups, windows and chat (words read now). */
    F.since = (t = 0) => [...F.events.filter(e => e.at >= t), ...F.chat.filter(r => r.at >= t).map(F.chatRow)].sort((a, b) => a.at - b.at);

    /* The windows. */
    F.apps = () => [...(foundry.applications?.instances?.values?.() ?? [])].filter(a => a.rendered && a.element)
        .map(a => ({ id: a.id, title: String(a.title ?? ""), cls: [...(a.options?.classes ?? [])], text: F.text(a.element).slice(0, 600),
            buttons: [...a.element.querySelectorAll("button[data-action]")].map(b => b.dataset.action) }));
    const NOT_YES = new Set(["cancel", "close", "no", "stay", "refuse", "refuseDynamic", "minimize", "toggleControls", "configure"]);
    const appMatches = (a, spec) => (!spec.id || a.id === spec.id) && (!spec.title || String(a.title ?? "").includes(spec.title))
        && (!spec.has || a.element.querySelector(spec.has)) && (!spec.text || F.text(a.element).includes(spec.text))
        && (!spec.cls || (a.options?.classes ?? []).includes(spec.cls))
        && (!spec.press || spec.press === "yes!" || a.element.querySelector(`button[data-action="${spec.press}"]`));
    F.findApp = spec => [...(foundry.applications?.instances?.values?.() ?? [])].reverse().find(a => a.rendered && a.element && appMatches(a, spec)) ?? null;
    F.answer = (spec = {}) => {
        const app = F.findApp(spec);
        if (!app) return { ok: false };
        const el = app.element;
        for (const [name, value] of Object.entries(spec.fill ?? {})) {
            const field = el.querySelector(`[name="${name}"]`);
            if (!field) continue;
            field.value = String(value);
            field.dispatchEvent(new Event("input", { bubbles: true }));
            field.dispatchEvent(new Event("change", { bubbles: true }));
        }
        for (const value of [].concat(spec.radio ?? [])) {
            const radio = el.querySelector(`input[type="radio"][value="${value}"]`) ?? (spec.radioAny ? el.querySelector('input[type="radio"]') : null);
            if (radio) { radio.checked = true; radio.dispatchEvent(new Event("change", { bubbles: true })); radio.click?.(); }
        }
        const buttons = [...el.querySelectorAll("button[data-action]")];
        const button = spec.press && spec.press !== "yes!"
            ? buttons.find(b => b.dataset.action === spec.press)
            : buttons.find(b => b.closest("footer, .form-footer") && !NOT_YES.has(b.dataset.action)) ?? buttons.find(b => !NOT_YES.has(b.dataset.action));
        const row = { ok: Boolean(button), title: String(app.title ?? ""), pressed: button?.dataset?.action ?? null, text: F.text(el).slice(0, 400),
            buttons: buttons.map(b => b.dataset.action) };
        if (button) { button.disabled = false; button.click(); }
        return row;
    };
    F.answerSoon = async (spec, ms = 20000) => {
        const end = Date.now() + ms;
        while (Date.now() < end) {
            const r = F.answer(spec);
            if (r.ok) return r;
            await F.sleep(250);
        }
        return { ok: false, apps: F.apps().map(a => a.title) };
    };
    F.auto = (id, spec, { every = 500, after = 0 } = {}) => {
        clearInterval(F.autos[id]?.timer);
        const row = F.autos[id] = { answered: [], timer: null };
        row.timer = setInterval(() => {
            const app = F.findApp(spec);
            if (!app) return;
            if (after && !app.__f3Seen) { app.__f3Seen = Date.now(); return; }
            if (after && Date.now() - app.__f3Seen < after) return;
            const r = F.answer(spec);
            if (r.ok) row.answered.push({ at: Date.now(), ...r });
        }, every);
        return true;
    };
    F.stopAuto = id => { clearInterval(F.autos[id]?.timer); const answered = F.autos[id]?.answered ?? []; delete F.autos[id]; return answered; };

    /* Daggerheart's roll window, pressed as a player presses it (tests-tier2.mjs `pressingRoll`). */
    F.pressRolls = ({ delay = 1500 } = {}) => {
        F.rollDelay = delay;
        if (F.rollHook) return true;
        F.rollHook = Hooks.on("renderApplicationV2", app => {
            const Window = game.system.api?.dice?.DualityRoll?.DefaultDialog ?? null;
            const isRoll = Window ? app instanceof Window : (app.options?.classes ?? []).includes("roll-selection");
            if (!isRoll || app.__f3Pressed) return;
            app.__f3Pressed = true;
            const row = { at: Date.now(), title: String(app.title ?? ""), pressedAt: null };
            F.rolls.push(row);
            setTimeout(() => {
                const button = app.rendered ? app.element?.querySelector('button[data-action="submitRoll"]') : null;
                if (button) { row.pressedAt = Date.now(); button.click(); }
            }, F.rollDelay);
        });
        return true;
    };

    /* A token as this canvas draws it. */
    F.tokenState = tokenId => {
        const t = canvas?.tokens?.get?.(tokenId) ?? null;
        const doc = t?.document ?? canvas?.scene?.tokens?.get?.(tokenId) ?? null;
        const alpha = t?.mesh?.alpha ?? null;
        return { at: Date.now(), placed: Boolean(t), drawn: Boolean(t && t.visible !== false && t.mesh?.visible !== false && (alpha === null || alpha > 0.05)),
            masked: Boolean(doc?.flags?.[MOD]?.masked), veiled: Boolean(doc?.flags?.[MOD]?.veiled), name: doc?.name ?? null,
            plate: t?.nameplate && t.nameplate.visible !== false ? String(t.nameplate.text ?? "") : null,
            eclipse: Boolean(game.drpg?.isEclipse?.()) };
    };
    F.sample = (key, tokenId, every = 120) => {
        clearInterval(F.samplers[key]?.timer);
        const row = F.samplers[key] = { tokenId, rows: [], timer: null };
        row.timer = setInterval(() => { try { row.rows.push(F.tokenState(tokenId)); } catch { /* the canvas may be redrawing */ } }, every);
        return true;
    };
    F.samples = (key, { stop = true } = {}) => {
        const row = F.samplers[key];
        if (!row) return [];
        if (stop) { clearInterval(row.timer); delete F.samplers[key]; }
        return row.rows;
    };

    /* Jobs. */
    F.start = (key, fn) => {
        const row = F.jobs[key] = { startedAt: Date.now(), done: false, ok: null, value: null, error: null };
        Promise.resolve().then(fn).then(v => { row.value = F.safe(v); row.ok = true; }, e => { row.error = String(e?.stack ?? e).slice(0, 500); row.ok = false; })
            .finally(() => { row.done = true; row.doneAt = Date.now(); });
        return true;
    };
    F.job = key => F.jobs[key] ?? null;

    /* GM readings. */
    F.econ = async actorId => {
        const actor = game.actors.get(actorId);
        const ST = await F.imp("settings");
        const mk = game.drpg.monokumaFor(actor);
        let fromRolls = null;
        try { fromRolls = Boolean(game.settings.get(MOD, ST.SETTINGS.despairFromRolls)); } catch { fromRolls = null; }
        return { hope: actor?.system?.resources?.hope?.value ?? null, hopeMax: actor?.system?.resources?.hope?.max ?? null,
            monokuma: mk?.id ?? null, despair: mk ? game.drpg.getDespair(mk.id) : null, despairMax: game.drpg.despairMax?.() ?? null,
            overflow: game.drpg.overflowCount?.() ?? null, fromRolls };
    };
    F.duality = async (actorId, since = 0) => {
        const D = await F.imp("despair-award");
        const all = [...game.messages].filter(m => (m.timestamp ?? 0) >= since - 2000).reverse();
        for (const m of all) {
            if ((m.speaker?.actor ?? null) !== actorId) continue;
            const d = D.readDuality(m);
            if (d) return { id: m.id, at: m.timestamp, ...F.safe(d) };
        }
        return null;
    };
    F.cards = async (call, { since = 0 } = {}) => {
        const out = [];
        for (const m of [...game.messages].reverse()) {
            if ((m.timestamp ?? 0) < since - 2000) continue;
            const box = document.createElement("template");
            box.innerHTML = String(secret ? secret.contentOf(m) : m.content ?? "");
            for (const b of box.content.querySelectorAll(`[data-drpg-call="${call}"]`)) out.push({ id: m.id, at: m.timestamp, data: { ...b.dataset } });
        }
        return out;
    };
    F.press = (key, messageId, call, data) => F.start(key, async () => {
        const A = await F.imp("messenger-app");
        return A.pressCard(game.messages.get(messageId), call, data);
    });

    F.summary = () => ({ user: game.user?.name ?? null, gm: Boolean(game.user?.isGM), base: F.base, fromEntries: F.fromEntries,
        scene: canvas?.scene?.id ?? null, ready: true });
    F.ready = true;
    return F.summary();
}

/** The scenario's handles on the pages: `on` runs a body with `F` bound, `until` polls one. */
export function kit(ctx) {
    const PRE = "const F = globalThis.__f3; if (!F) throw new Error('the page kit is not installed');\n";
    const kitSource = `return (${pageKit.toString()})();`;
    return {
        install: role => ctx.c[role].eval(kitSource, { timeout: 60_000 }),
        on: (role, body, { timeout = 60_000 } = {}) => ctx.c[role].eval(PRE + body, { timeout }),
        until: (role, body, { timeout = 60_000, every = 500 } = {}) => ctx.until(role, PRE + body, { timeout, every }),
        /** Reinstall after a reload or a rejoin. */
        reinstall: async role => ctx.c[role].eval(kitSource, { timeout: 60_000 })
    };
}

/**
 * The world as GM1's browser reads it, for the room plan: the active scene's rooms (rooms.mjs `roomNames`, bedrooms
 * left out by vault-store.mjs `allBedrooms`), each room's neighbours (movement.mjs `neighbouringRooms`), the actors
 * and users P1-P4, the Monokuma actors GM1 and GM2, where every one stands, the clock and what is running.
 */
export async function readWorld(K) {
    return K.on("gm1", `
        const R = await F.imp("rooms"), M = await F.imp("movement");
        const scene = game.scenes.active ?? canvas.scene;
        const beds = new Set((game.drpg.allBedrooms?.(scene) ?? []).map(b => b.room));
        const rooms = R.roomNames(scene).filter(r => !beds.has(r));
        const nb = {};
        for (const r of rooms) { try { nb[r] = (M.neighbouringRooms(scene, r) ?? []).filter(x => rooms.includes(x) && x !== r); } catch { nb[r] = []; } }
        const actor = n => game.actors.getName(n) ?? null;
        const row = n => { const a = actor(n); const t = a ? scene.tokens.find(x => x.actorId === a.id) : null;
            return a ? { id: a.id, name: a.name, token: t?.id ?? null, room: t ? M.roomOfToken(t) : null, hidden: Boolean(t?.hidden),
                dead: Boolean(game.drpg.isDeadForGm?.(a)), monokuma: Boolean(game.drpg.isMonokuma?.(a)), owner: game.drpg.ownerOf?.(a)?.id ?? null } : null; };
        const users = Object.fromEntries(["GM1", "GM2", "P1", "P2", "P3", "P4"].map(n => [n, game.users.getName(n)?.id ?? null]));
        const students = (game.drpg.studentActors?.() ?? []).map(a => ({ id: a.id, name: a.name, owner: game.drpg.ownerOf?.(a)?.id ?? null,
            dead: Boolean(game.drpg.isDeadForGm?.(a)), token: scene.tokens.find(x => x.actorId === a.id)?.id ?? null }));
        return { scene: scene.id, sceneName: scene.name, isPlace: R.isPlaceScene(scene), rooms, nb, users, students,
            actors: Object.fromEntries(["P1", "P2", "P3", "P4", "GM1", "GM2"].map(n => [n, row(n)])),
            clock: F.safe(game.drpg.getClock()), paused: game.paused, murder: F.safe(game.drpg.murderState()), eclipse: Boolean(game.drpg.isEclipse()),
            primary: game.users.get((await F.imp("utils")).primaryGmId?.() ?? "")?.name ?? null };`);
}

/**
 * Pick the rooms a scenario needs from `world.rooms`/`world.nb`: `count` distinct rooms, the first (the crime's) with a
 * neighbour; each of the next with a neighbour that is not the first, when `movers` asks for that. Answers
 * `{ rooms: [...], moves: { [room]: neighbour } }` or null.
 */
export function pickRooms(world, { count = 4, movers = 2 } = {}) {
    const rooms = world.rooms ?? [], nb = world.nb ?? {};
    const crime = rooms.find(r => (nb[r] ?? []).length) ?? rooms[0];
    if (!crime) return null;
    const picked = [crime], moves = {};
    for (const r of rooms) {
        if (picked.length >= count) break;
        if (picked.includes(r)) continue;
        if (picked.length <= movers) {
            const to = (nb[r] ?? []).find(x => x !== crime && !picked.includes(x));
            if (!to) continue;
            moves[r] = to;
        }
        picked.push(r);
    }
    for (const r of rooms) { if (picked.length >= count) break; if (!picked.includes(r)) picked.push(r); }
    return picked.length >= count ? { rooms: picked, moves } : null;
}

/**
 * Put the named actors in the named rooms on the active scene, from GM1's browser: a token created from the actor's
 * prototype where the scene has none, `hidden` taken off, and every token moved with v14's displacement (no animation,
 * no movement rules: a GM's placement, as scenario 10 places). `place` is `{ actorId: room }`. Answers what it wrote.
 */
export async function placeTokens(K, place) {
    return K.on("gm1", `
        const M = await F.imp("movement");
        const scene = game.scenes.active ?? canvas.scene;
        const PLACE = { teleport: true, movementAction: "displace", animate: false };
        const wrote = [], missing = [];
        for (const [actorId, room] of Object.entries(${J(place)})) {
            const actor = game.actors.get(actorId);
            if (!actor) { missing.push(actorId); continue; }
            let token = scene.tokens.find(t => t.actorId === actorId);
            if (!token) {
                const proto = actor.prototypeToken.toObject();
                const spot = M.positionIn(room, { parent: scene, width: proto.width ?? 1, height: proto.height ?? 1 });
                if (!spot) { missing.push(actor.name + " (no spot in " + room + ")"); continue; }
                [token] = await scene.createEmbeddedDocuments("Token", [{ ...proto, actorId, x: spot.x, y: spot.y, hidden: false }]);
                wrote.push("token created: " + actor.name + " in " + room);
                await F.sleep(400);
            }
            const spot = M.positionIn(room, token);
            if (!spot) { missing.push(actor.name + " (no spot in " + room + ")"); continue; }
            if (M.roomOfToken(token) !== room || token.hidden) {
                // A little off the centre for each token, so two in one room are two tokens on the map.
                const n = scene.tokens.filter(t => t.id !== token.id && M.roomOfToken(t) === room).length;
                const size = scene.grid?.size ?? 100;
                await token.update({ x: spot.x + (n % 3) * size, y: spot.y + Math.floor(n / 3) * size, hidden: false }, PLACE);
                if (M.roomOfToken(scene.tokens.get(token.id)) !== room) await token.update({ x: spot.x, y: spot.y }, PLACE);
                wrote.push("token moved: " + actor.name + " to " + room);
            }
        }
        await F.sleep(800);
        const at = Object.fromEntries(Object.keys(${J(place)}).map(id => { const t = scene.tokens.find(x => x.actorId === id); return [id, t ? M.roomOfToken(t) : null]; }));
        return { wrote, missing, at };`, { timeout: 120_000 });
}

/** Unpause on GM1 (v14's `togglePause(pause, { broadcast })`, v12's `(pause, push)` as the fallback). Answers whether it wrote. */
export async function unpause(K) {
    return K.on("gm1", `
        if (!game.paused) return false;
        try { await game.togglePause(false, { broadcast: true }); } catch { await game.togglePause(false, true); }
        await F.sleep(500);
        return !game.paused;`);
}

/**
 * Bring each player's page onto the scene (its own view only) and its roll window under a player's press. Answers
 * each page's kit summary.
 */
export async function readyPlayers(K, roles, sceneId, { rollDelay = 1500 } = {}) {
    const out = {};
    for (const role of roles) {
        out[role] = await K.on(role, `
            if (canvas?.scene?.id !== ${J(sceneId)}) { await game.scenes.get(${J(sceneId)})?.view?.(); await F.sleep(1500); }
            F.pressRolls({ delay: ${Number(rollDelay)} });
            return F.summary();`, { timeout: 90_000 });
    }
    return out;
}

/** The economy deltas of a roll and whether its outcome moves anything the reading can see. */
export function econDelta(before, after, duality) {
    const d = { hope: num(after?.hope) - num(before?.hope), despair: num(after?.despair) - num(before?.despair),
        overflow: num(after?.overflow) - num(before?.overflow) };
    const hopeRoom = num(before?.hopeMax) > num(before?.hope);
    const hopeCan = Boolean(duality && (duality.withHope || duality.isCritical) && hopeRoom);
    const despairCan = Boolean(duality && duality.withFear && before?.fromRolls && before?.monokuma);
    return { d, hopeCan, despairCan, informative: hopeCan || despairCan };
}
const num = v => Number(v) || 0;

/** A sampled series read: whether every row in [from, to) satisfies `ok`, and how many rows there were. */
export function series(rows, { from = 0, to = Infinity, ok }) {
    const inside = (rows ?? []).filter(r => r.at >= from && r.at < to);
    const bad = inside.filter(r => !ok(r));
    return { n: inside.length, bad: bad.length, firstBad: bad[0] ?? null, last: inside[inside.length - 1] ?? null };
}

/** The first row at or after `from` that satisfies `ok`, or null. */
export function firstWhere(rows, from, ok) {
    return (rows ?? []).find(r => r.at >= from && ok(r)) ?? null;
}

/** A localised string read on a page (the world's language is the test world's; nothing here hard-codes a word). */
export async function i18n(K, role, keys) {
    return K.on(role, `return Object.fromEntries(${J(keys)}.map(k => [k, game.i18n.localize(k)]));`);
}

/**
 * A Dynamic action of `actorId` from `role`'s browser, ruled by `gm` from the ruling card (messenger-app.mjs `pressCard`,
 * the road a click on "Set difficulty" takes), the band set in the GM's window and the roll pressed by the player's
 * page. Answers `{ ok, why, asked, card, ruled, job, duality, before, after, econ }` - the economy read on GM1 before
 * the window and 3 s after the action's end.
 */
export async function dynamicAction(ctx, K, { role, actorId, gm, tag, words, tier = 1 }) {
    const out = { tag, role, gm };
    out.before = await K.on("gm1", `return await F.econ(${J(actorId)});`);
    const t0 = await K.on(gm, "return Date.now();");
    await K.on(role, `F.start(${J("dyn-" + tag)}, () => game.drpg.performAction(game.actors.get(${J(actorId)}), "dynamic")); return true;`);
    out.asked = await K.on(role, `return await F.answerSoon({ has: 'textarea[name="request"]', fill: { request: ${J(words)} }, press: "send" }, 25000);`, { timeout: 40_000 });
    if (!out.asked?.ok) return { ...out, ok: false, why: "the request window never opened on " + role, job: await K.on(role, `return F.job(${J("dyn-" + tag)});`) };
    out.card = await K.until(gm, `const c = await F.cards("setDifficulty", { since: ${t0} }); return c.find(x => x.data.by === ${J(actorId)}) ?? null;`, { timeout: 45_000 });
    if (!out.card) return { ...out, ok: false, why: "no Set difficulty card reached " + gm };
    await K.on(gm, `F.press(${J("rule-" + tag)}, ${J(out.card.id)}, "setDifficulty", ${J(out.card.data)}); return true;`);
    out.ruled = await K.on(gm, `return await F.answerSoon({ has: 'select[name="tier"]', fill: { tier: ${Number(tier)} }, press: "ok" }, 25000);`, { timeout: 40_000 });
    if (!out.ruled?.ok) return { ...out, ok: false, why: "the difficulty window never opened on " + gm };
    out.job = await K.until(role, `const j = F.job(${J("dyn-" + tag)}); return j?.done ? j : null;`, { timeout: 150_000, every: 1000 });
    out.press = await K.on(gm, `return F.job(${J("rule-" + tag)});`);
    await ctx.settle(3000);
    out.duality = await K.on("gm1", `return await F.duality(${J(actorId)}, ${t0});`);
    out.after = await K.on("gm1", `return await F.econ(${J(actorId)});`);
    out.econ = econDelta(out.before, out.after, out.duality);
    out.rolls = await K.on(role, "return F.rolls.slice(-3);");
    out.ok = Boolean(out.job?.done && out.duality);
    if (!out.ok) out.why = out.job?.done ? "the action ended with no roll read on GM1" : "the action did not end in 150 s";
    return out;
}

/** Whether an ordinary roll moved Hope and Despair as its dice say (D2-11's "other rolls unchanged"). */
export function economyAsDiceSay(e, duality) {
    if (!duality) return false;
    const hopeOk = (duality.withHope || duality.isCritical) ? (e.hopeCan ? e.d.hope > 0 : e.d.hope >= 0) : e.d.hope <= 0;
    const despairOk = duality.withFear ? (e.despairCan ? e.d.despair + e.d.overflow >= 1 : true) : e.d.despair + e.d.overflow === 0;
    return hopeOk && despairOk;
}

/**
 * One Direct Murder opening outside an Eclipse, from GM1 (`game.drpg.openMurder`, the Murder window's road), the roll
 * thrown on the killer's player's page and pressed there after the kit's delay. `watchers` are the roles whose canvas
 * samples the killer's token from just before the open to `after` ms past the result. Answers the times (GM1's
 * clock: the one machine runs every browser), the result as GM1 holds it, the roll's dice, the killer's economy
 * before and after, every watcher's samples and what the victim's page showed from the result on.
 */
export async function runOpening(ctx, K, { killerId, killerToken, killerRole = null, victimId, victimRole, watchers = [], trait = "body", after = 4000, timeout = 150_000 }) {
    const out = { killerId, victimId };
    for (const role of watchers) await K.on(role, `F.sample("open", ${J(killerToken)}, 100); return true;`);
    out.before = await K.on("gm1", `return await F.econ(${J(killerId)});`);
    await ctx.settle(800);
    out.opened = await K.on("gm1", `const at = Date.now();
        const s = await game.drpg.openMurder({ killerId: ${J(killerId)}, victimId: ${J(victimId)}, openingTrait: ${J(trait)} });
        return { at, stage: s?.stage ?? null, active: Boolean(s?.active) };`, { timeout: 60_000 });
    if (!out.opened?.active) {
        for (const role of watchers) await K.on(role, `F.samples("open"); return true;`);
        return { ...out, ok: false, why: "openMurder answered no running incident" };
    }
    out.result = await K.until("gm1", `const s = game.drpg.murderState();
        if (s?.active && s.stage === "openingRoll") return null;
        return { at: Date.now(), stage: s?.stage ?? null, active: Boolean(s?.active), keys: s?.keyRemnants ?? null, endedBy: s?.endedBy ?? null };`,
    { timeout, every: 200 });
    if (!out.result) {
        for (const role of watchers) await K.on(role, `F.samples("open"); return true;`);
        out.rolls = killerRole ? await K.on(killerRole, "return F.rolls.slice(-3);") : null;
        return { ...out, ok: false, why: `the opening was not resolved in ${timeout / 1000} s` };
    }
    // The stage's write on the watchers' own copy is the sharper time: the first "murder" event past the open.
    await ctx.settle(after);
    out.duality = await K.on("gm1", `return await F.duality(${J(killerId)}, ${out.opened.at});`);
    out.after = await K.on("gm1", `return await F.econ(${J(killerId)});`);
    out.econ = econDelta(out.before, out.after, out.duality);
    out.samples = {};
    out.stageSeen = {};
    for (const role of watchers) {
        out.samples[role] = await K.on(role, `return F.samples("open");`);
        out.stageSeen[role] = await K.on(role, `return F.since(${out.opened.at}).filter(e => e.kind === "murder").map(e => ({ at: e.at, stage: e.stage, active: e.active }));`);
    }
    out.rolls = killerRole ? await K.on(killerRole, "return F.rolls.slice(-3);") : null;
    if (victimRole) out.victimSaw = await K.on(victimRole, `return F.since(${out.result.at - 500}).filter(e => e.kind !== "murder");`);
    const success = out.result.active && out.result.stage !== "openingRoll";
    const band = !success ? "failure" : out.duality?.isCritical ? "critical" : out.duality?.withHope ? "hope" : out.duality?.withFear ? "despair"
        : ({ 5: "hope", 4: "despair", 3: "critical" })[out.result.keys] ?? "unknown";
    out.success = success;
    out.band = band;
    out.ok = true;
    return out;
}

/** When each watcher's page saw the stage leave the opening (its first "murder" event past the open), else GM1's. */
export function resultSeenAt(o, role) {
    const row = (o.stageSeen?.[role] ?? []).find(e => e.stage !== "openingRoll" || !e.active);
    return row?.at ?? o.result?.at ?? Infinity;
}

/**
 * The victim's (or any participant's) crisis action from their own page (`game.drpg.takeCrisisAction`), the key the
 * first of `prefer` that `availableCrisisActions` lists; a statistic card (`pickTrait`) is pressed by `gm`. Answers the
 * key, the job, the roll's dice and the economy around it (read on GM1).
 */
export async function crisisRoll(ctx, K, { role, actorId, gm = "gm2", prefer = ["survive"] }) {
    const out = { role };
    out.available = await K.on(role, `const a = game.actors.get(${J(actorId)});
        const list = game.drpg.availableCrisisActions?.(a) ?? [];
        return list.map(x => typeof x === "string" ? x : x?.key ?? x?.id ?? null).filter(Boolean);`);
    out.key = prefer.find(k => out.available.includes(k)) ?? out.available.find(k => !["pass", "useItem"].includes(k)) ?? null;
    if (!out.key) return { ...out, ok: false, why: "no crisis action is available to " + role };
    out.before = await K.on("gm1", `return await F.econ(${J(actorId)});`);
    const t0 = await K.on("gm1", "return Date.now();");
    await K.on(role, `F.start("crisis", () => game.drpg.takeCrisisAction(game.actors.get(${J(actorId)}), ${J(out.key)})); return true;`);
    // A statistic card, where the action lists more than one: pressed by the GM named, its first statistic.
    const end = Date.now() + 120_000;
    let pressed = false;
    while (Date.now() < end) {
        const job = await K.on(role, `return F.job("crisis");`);
        if (job?.done) { out.job = job; break; }
        if (!pressed) {
            const card = (await K.on(gm, `return await F.cards("pickTrait", { since: ${t0} });`))?.[0] ?? null;
            if (card) { await K.on(gm, `F.press("crisisTrait", ${J(card.id)}, "pickTrait", ${J(card.data)}); return true;`); pressed = card; }
        }
        await ctx.settle(1000);
    }
    out.card = pressed || null;
    await ctx.settle(3000);
    out.duality = await K.on("gm1", `return await F.duality(${J(actorId)}, ${t0});`);
    out.after = await K.on("gm1", `return await F.econ(${J(actorId)});`);
    out.econ = econDelta(out.before, out.after, out.duality);
    out.state = await K.on("gm1", "const s = game.drpg.murderState(); return { active: Boolean(s?.active), stage: s?.stage ?? null, endedBy: s?.endedBy ?? null };");
    out.ok = Boolean(out.job?.done && out.duality);
    if (!out.ok) out.why = out.job?.done ? "no crisis roll read on GM1" : "the crisis action did not end in 120 s";
    return out;
}

/** Close a running incident from GM1 (`endMurder`, the tracker's End the murder), answering what it found and left. */
export async function closeIncident(K, { reason = "closed", followUp = false } = {}) {
    return K.on("gm1", `const s = game.drpg.murderState();
        if (!s?.active) return { closed: false, was: null };
        await game.drpg.endMurder({ reason: ${J(reason)}, followUp: ${followUp ? "true" : "false"} });
        await F.sleep(1500);
        const now = game.drpg.murderState();
        return { closed: !now?.active, was: s.stage, now: now?.stage ?? null };`, { timeout: 60_000 });
}

/** A player's own move of their token into `room` (their page writes the token, as a drag does). */
export async function playerMove(K, role, { tokenId, actorId, room }) {
    return K.on(role, `const M = await F.imp("movement");
        const tok = canvas.scene.tokens.get(${J(tokenId)});
        if (!tok) return { ok: false, why: "no token" };
        const from = M.roomOfToken(tok), left0 = game.drpg.movesLeft?.(game.actors.get(${J(actorId)})) ?? null;
        const spot = M.positionIn(${J(room)}, tok);
        if (!spot) return { ok: false, why: "no spot in the room" };
        let error = null;
        try { await tok.update({ x: spot.x, y: spot.y }); } catch (err) { error = String(err?.message ?? err); }
        await F.sleep(2000);
        const now = canvas.scene.tokens.get(${J(tokenId)});
        return { ok: M.roomOfToken(now) === ${J(room)}, from, to: M.roomOfToken(now), left0, left1: game.drpg.movesLeft?.(game.actors.get(${J(actorId)})) ?? null, error };`, { timeout: 60_000 });
}
