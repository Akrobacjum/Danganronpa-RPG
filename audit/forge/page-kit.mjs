/**
 * What the Forge scenarios S2-S4 put in each page and share on the runner's side (the road to 2.0, F3; 24.11.2026).
 * ---------------------------------------------------------------------------
 * Not a scenario and not run by itself: audit/forge/scenarios/s2-second-gm.mjs, s3-disconnects.mjs and
 * s4-two-gms-at-once.mjs import it. Written before any Forge run of them; nothing here has met a real v14 page yet.
 *
 * THE PAGE'S KIT (`pageKit`, installed by every `call` and `run` when the page does not hold this version - a reload
 * empties it, so it comes back by itself). In the page it keeps, on `window.__fk`:
 *   seen      the notices this page showed: Foundry's toasts (`ui.notifications.notify` wrapped, and the `#notifications`
 *             list watched as a second reading), and the module's cards (`.drpg-popup`, with the message they came from)
 *   dialogs   every DialogV2 drawn (and the season reset's window, whatever it is built on): its title, words, the
 *             actions of its buttons, whether it shows a time (`hasTime`), what the kit did to it and when it closed
 *   rules     what the person at this page does to a window as it is drawn: hold it open, fill fields, press a button
 *             by its `data-action`, or close it. A window no rule names is left as it is - never a default button
 *   writes    every write of a setting of the module, who wrote it, and for the clock its fields (`updateSetting`)
 *   conn      every `userConnected` this page heard
 *   jobs      promises the scenario started and does not await (a request a player waits on, a press whose window
 *             is held open), each with its value once it settles
 * and the readers of the module the scenarios share: a card found by its words (secret.mjs `contentOf`), its state and
 * the GMs' claim row (gm-stores.mjs `ruledCardStore`), and a press of one of its buttons - the chat log's own button when
 * the page draws one, else messenger-app.mjs `pressCard`, the road a click takes (claim on the primary, the rule, the
 * card settled).
 *
 * UNMEASURED on Forge's v14 (each is read defensively and said in a check's details where it matters):
 * `ui.notifications.info/warn/error` go through `notify`; `foundry.applications.instances` lists every open
 * ApplicationV2 and the module's windows are DialogV2; the chat log draws a card's buttons with `data-message-id` on an
 * ancestor; `updateSetting` hands the writer's id as its fourth argument; `game.togglePause(false, { broadcast: true })`
 * unpauses for everyone (v12's second argument was a boolean, which the object also satisfies).
 */

export const MOD = "danganronpa-rpg";
const KIT_VERSION = 3;

/* Serialized into each page (`ENSURE`): it reads nothing of this file's scope. */
function pageKit(version) {
    const MODULE = "danganronpa-rpg";
    const old = window.__fk;
    if (old?.timer) clearInterval(old.timer);
    const fk = window.__fk = { v: version, seen: [], dialogs: [], rules: [], writes: [], conn: [], jobs: {}, samples: [] };
    const live = new Map(), known = new Set();
    const squash = el => String(el?.textContent ?? "").replace(/\s+/g, " ").trim();
    const push = (list, row, max = 500) => { list.push(row); if (list.length > max) list.splice(0, list.length - max); };
    const safe = value => { try { return JSON.parse(JSON.stringify(value ?? null)); } catch { return String(value); } };
    fk.imp = file => import(`/modules/${MODULE}/scripts/${file}`);
    fk.squash = squash;
    fk.safe = safe;

    /* Toasts. The wrapper pushes to whatever kit is current, so a newer kit installed later reads through the same one. */
    const N = ui.notifications;
    if (N && typeof N.notify === "function" && !N.__fkOrig) {
        N.__fkOrig = N.notify;
        N.notify = function (message, type, options) {
            try {
                let words = String(message ?? "");
                if (options?.localize) words = game.i18n.format(words, options.format ?? {});
                push(window.__fk.seen, { at: Date.now(), kind: "toast", type: String(type ?? "info"), text: words.slice(0, 600) });
            } catch { /* never in the way of the notice */ }
            return N.__fkOrig.call(this, message, type, options);
        };
    }
    if (!window.__fkObserver) {
        window.__fkObserver = new MutationObserver(records => {
            for (const r of records) for (const node of r.addedNodes) {
                if (!(node instanceof Element)) continue;
                const cards = node.matches?.(".drpg-popup") ? [node] : [...(node.querySelectorAll?.(".drpg-popup") ?? [])];
                for (const card of cards) {
                    push(window.__fk.seen, { at: Date.now(), kind: "popup", text: squash(card).slice(0, 600), message: card.dataset?.drpgMessage ?? null });
                }
                if (node.matches?.("#notifications li, li.notification")) push(window.__fk.seen, { at: Date.now(), kind: "toastDom", text: squash(node).slice(0, 600) });
            }
        });
        window.__fkObserver.observe(document.body, { childList: true, subtree: true });
    }
    if (!window.__fkHooks) {
        window.__fkHooks = true;
        Hooks.on("userConnected", (user, active) => push(window.__fk.conn, { at: Date.now(), userId: user?.id ?? null, active: Boolean(active) }));
        const wrote = (setting, userId) => {
            const key = String(setting?.key ?? "");
            if (!key.startsWith(`${MODULE}.`)) return;
            const short = key.slice(MODULE.length + 1);
            let value = null;
            if (short === "clock") {
                try {
                    const c = game.settings.get(MODULE, "clock") ?? {};
                    value = { chapter: c.chapter, session: c.session, day: c.day, timeOfDay: c.timeOfDay, phase: c.phase, eclipse: Boolean(c.eclipse),
                        morningLine: c.morningLine ?? null };
                } catch { value = null; }
            }
            push(window.__fk.writes, { at: Date.now(), key: short, userId: userId ?? null, value });
        };
        Hooks.on("updateSetting", (setting, change, options, userId) => wrote(setting, userId));
        Hooks.on("createSetting", (setting, options, userId) => wrote(setting, userId));
    }

    const timeShown = el => {
        const words = squash(el);
        return /\b\d{1,2}:\d{2}\b/.test(words)
            || /\b\d+\s?(s|sek|min|sekund\w*|minut\w*|seconds?|minutes?)\b/i.test(words)
            || Boolean(el.querySelector("[data-expires], [data-drpg-expires], time, [class*='countdown'], [class*='time-left'], [class*='timeleft']"));
    };
    const actionsOf = el => [...el.querySelectorAll("button[data-action]")].map(b => b.dataset.action);
    const fits = (rule, rec, app) => {
        if (rule.titleKey && !rec.title.includes(game.i18n.localize(rule.titleKey))) return false;
        if (rule.title && !new RegExp(rule.title, "i").test(rec.title)) return false;
        if (rule.text && !new RegExp(rule.text, "i").test(rec.text)) return false;
        if (rule.id && !new RegExp(rule.id, "i").test(`${app.id ?? ""} ${app.element?.className ?? ""}`)) return false;
        return true;
    };
    const apply = (rule, app, rec) => {
        const el = app.element;
        if (!el?.isConnected) { rec.acted = "gone before the rule"; return; }
        for (const sel of rule.read ?? []) rec.read[sel] = el.querySelector(sel)?.value ?? null;
        for (const [sel, value] of Object.entries(rule.fill ?? {})) {
            const field = el.querySelector(sel);
            if (!field) continue;
            field.value = value;
            field.dispatchEvent(new Event("input", { bubbles: true }));
            field.dispatchEvent(new Event("change", { bubbles: true }));
        }
        if (rule.hold) { rec.acted = "hold"; return; }
        if (rule.close) { rec.acted = "close"; Promise.resolve(app.close()).catch(() => {}); return; }
        const buttons = [...el.querySelectorAll("button[data-action]")];
        for (const action of rule.press ?? []) {
            const button = buttons.find(b => b.dataset.action === action && !b.disabled);
            if (button) { rec.acted = `press:${action}`; button.click(); return; }
        }
        rec.acted = `no button of ${JSON.stringify(rule.press ?? [])}`;
    };
    const scan = () => {
        for (const app of foundry.applications?.instances?.values?.() ?? []) {
            const el = app?.element;
            if (!app?.rendered || !el?.isConnected || known.has(app.id)) continue;
            const isDialog = app instanceof foundry.applications.api.DialogV2;
            if (!isDialog && !/season-reset/.test(`${app.id ?? ""} ${el.className ?? ""}`)) continue;
            known.add(app.id);
            const rec = { id: app.id, title: String(app.options?.window?.title ?? app.title ?? ""), at: Date.now(), text: squash(el).slice(0, 1500),
                hasTime: timeShown(el), actions: actionsOf(el), cls: String(el.className ?? "").slice(0, 200), read: {}, acted: null, closedAt: null };
            push(fk.dialogs, rec, 300);
            live.set(app.id, { app, rec });
            const rule = fk.rules.find(r => fits(r, rec, app));
            if (rule) {
                if (rule.once) fk.rules.splice(fk.rules.indexOf(rule), 1);
                setTimeout(() => apply(rule, app, rec), rule.delay ?? 300);
            }
        }
        for (const [id, { app, rec }] of live) {
            if (!app.rendered || !app.element?.isConnected) { rec.closedAt = Date.now(); live.delete(id); }
        }
    };
    fk.timer = setInterval(() => { try { scan(); } catch (err) { fk.scanError = String(err?.message ?? err); } }, 200);

    fk.mark = () => Date.now();
    fk.setRules = list => { fk.rules = Array.isArray(list) ? list : []; return fk.rules.length; };
    fk.addRules = list => { fk.rules.unshift(...list); return fk.rules.length; };
    /** The windows open now that `match` names (a rule's shape without the action), each its record. */
    fk.open = (match = {}) => { scan(); return [...live.values()].filter(({ app, rec }) => fits(match, rec, app)).map(({ rec }) => rec); };
    /** Do `how` (a rule's action) to every window open now that `match` names; answers how many. */
    fk.act = (match = {}, how = {}) => {
        scan();
        let n = 0;
        for (const { app, rec } of live.values()) if (fits(match, rec, app)) { apply(how, app, rec); n++; }
        return n;
    };
    fk.since = at => ({
        seen: fk.seen.filter(x => x.at >= at), dialogs: fk.dialogs.filter(x => x.at >= at || (x.closedAt ?? Infinity) >= at),
        writes: fk.writes.filter(x => x.at >= at), conn: fk.conn.filter(x => x.at >= at)
    });
    fk.popupsNow = () => [...document.querySelectorAll(".drpg-popup")].map(card => ({ text: squash(card).slice(0, 400), message: card.dataset?.drpgMessage ?? null }));
    fk.track = (name, promise) => {
        fk.jobs[name] = { done: false, started: Date.now() };
        Promise.resolve(promise).then(
            value => { fk.jobs[name] = { done: true, value: safe(value), started: fk.jobs[name]?.started, at: Date.now() }; },
            err => { fk.jobs[name] = { done: true, threw: String(err?.message ?? err).slice(0, 400), started: fk.jobs[name]?.started, at: Date.now() }; });
        return name;
    };
    fk.job = name => fk.jobs[name] ?? null;
    fk.me = async () => {
        let primary = null;
        try { primary = (await fk.imp("utils.mjs")).primaryGmId(); } catch { primary = null; }
        return { id: game.user.id, name: game.user.name, gm: Boolean(game.user.isGM), role: game.user.role, ready: game.ready === true,
            character: game.user.character?.id ?? null, primary, primaryName: game.users.get(primary ?? "")?.name ?? null };
    };
    fk.t = (key, data = null) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));
    /** The primary this page reads every `every` ms, with whether that user is connected, until `stopSampling`. */
    fk.sampleOn = (every = 250) => {
        clearInterval(fk.sampler);
        fk.samples = [];
        fk.sampler = setInterval(async () => {
            try {
                const id = (await fk.imp("utils.mjs")).primaryGmId();
                push(fk.samples, { at: Date.now(), primary: id, active: game.users.filter(u => u.active && u.isGM).map(u => u.id) }, 2000);
            } catch { /* sampling only */ }
        }, every);
        return true;
    };
    fk.sampleOff = () => { clearInterval(fk.sampler); return fk.samples; };

    /* Cards. */
    const cardOf = async (m, html = null) => {
        const S = await fk.imp("secret.mjs");
        const content = html ?? String(S.contentOf(m) ?? m.content ?? "");
        const box = document.createElement("div");
        box.innerHTML = content;
        let row = null;
        if (game.user.isGM) {
            try { row = safe((await fk.imp("gm-stores.mjs")).ruledCardStore?.get?.(m.id) ?? null); } catch { row = "unread"; }
        }
        return { id: m.id, settled: Boolean(S.cardFlag(m, "settled")), actions: [...box.querySelectorAll("[data-drpg-call]")].map(b => b.dataset.drpgCall),
            text: squash(box).slice(0, 600), author: m.author?.id ?? null, row, at: m.timestamp ?? null };
    };
    fk.findCard = async (piece, { with: action = null } = {}) => {
        const S = await fk.imp("secret.mjs");
        for (const m of [...game.messages.contents].reverse().slice(0, 150)) {
            const html = String(S.contentOf(m) ?? m.content ?? "");
            if (!html.includes(piece)) continue;
            if (action && !html.includes(`data-drpg-call="${action}"`)) continue;
            return cardOf(m, html);
        }
        return null;
    };
    fk.card = async id => {
        const m = game.messages.get(id);
        return m ? cardOf(m) : { id, gone: true };
    };
    /** Press a card's button: the page's own drawn button when there is one, else `pressCard` (tracked, not awaited). */
    fk.press = async (id, action, { road = "any" } = {}) => {
        if (road !== "pressCard") {
            const drawn = [...document.querySelectorAll(`[data-message-id="${id}"] [data-drpg-call="${action}"]`)].find(b => !b.disabled);
            if (drawn) { drawn.click(); return "dom"; }
            if (road === "dom") return "no drawn button";
        }
        const m = game.messages.get(id);
        if (!m) return "no card";
        const S = await fk.imp("secret.mjs");
        const box = document.createElement("div");
        box.innerHTML = String(S.contentOf(m) ?? "");
        const button = box.querySelector(`[data-drpg-call="${action}"]`);
        if (!button) return "no button";
        const A = await fk.imp("messenger-app.mjs");
        fk.track(`press:${id}:${action}:${Date.now()}`, A.pressCard(m, action, { ...button.dataset }));
        return "pressCard";
    };
    /** Every window of this page that is not the sidebar's, closed (for a scenario's end). */
    fk.closeWindows = async ({ dialogsOnly = true } = {}) => {
        let n = 0;
        for (const app of [...(foundry.applications?.instances?.values?.() ?? [])]) {
            if (!app?.rendered) continue;
            if (dialogsOnly && !(app instanceof foundry.applications.api.DialogV2)) continue;
            try { await app.close(); n++; } catch { /* one that will not close stays */ }
        }
        return n;
    };
    return true;
}

const ENSURE = `if (window.__fk?.v !== ${KIT_VERSION}) (${pageKit.toString()})(${KIT_VERSION});`;

/** Call one of the kit's methods in `role`'s page. */
export function call(ctx, role, method, ...args) {
    if (!ctx.c[role]) throw new Error(`${role} has no page`);
    return ctx.c[role].eval(`${ENSURE} return await window.__fk[${JSON.stringify(method)}](...${JSON.stringify(args)});`, { timeout: 90_000 });
}

/** Run `body` (an async function's body) in `role`'s page with the kit as `fk`. */
export function run(ctx, role, body, { timeout = 90_000 } = {}) {
    if (!ctx.c[role]) throw new Error(`${role} has no page`);
    return ctx.c[role].eval(`${ENSURE} const fk = window.__fk; ${body}`, { timeout });
}

export const J = value => JSON.stringify(value);
export const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

/** Poll `read` (node side) until `done(value)` or `timeout` ms; answers the last reading either way. */
export async function poll(read, done = Boolean, { timeout = 30_000, every = 1000 } = {}) {
    const end = Date.now() + timeout;
    let value = null;
    for (;;) {
        try { value = await read(); } catch (err) { value = { threw: String(err?.message ?? err).split("\n")[0] }; }
        if (done(value) || Date.now() >= end) return value;
        await wait(every);
    }
}

/** Run one phase: its throw is a failed check of the phase, and the scenario goes on to the next. */
export async function step(ctx, name, ids, body) {
    ctx.phase(name);
    try {
        await body();
    } catch (err) {
        ctx.check(`${name}: the phase ran to its end`, false, String(err?.stack ?? err).split("\n").slice(0, 4).join(" / "), { ids });
    }
}

/**
 * Who is at the table: each role's user, which one the module takes for the primary (utils.mjs `primaryGmId`, read on
 * every page), and the GM roles split into `prim` and `sec`. Refuses (throws) when a role did not log in or the pages
 * disagree on the primary: nothing after it would mean what it says.
 */
export async function readTable(ctx, roles) {
    const me = {};
    for (const role of roles) {
        if (!ctx.c[role]) throw new Error(`${role} is not logged in (see the report's failures); the scenario needs every role it names`);
        me[role] = await call(ctx, role, "me");
    }
    const primaries = new Set(Object.values(me).map(m => m.primary));
    const gms = roles.filter(r => me[r].gm);
    const prim = gms.find(r => me[r].id === me[gms[0]].primary) ?? null;
    const sec = gms.find(r => r !== prim) ?? null;
    return { me, prim, sec, agree: primaries.size === 1, primId: me[gms[0]]?.primary ?? null, gms, players: roles.filter(r => !me[r].gm) };
}

/**
 * The table's preconditions, on the primary GM's page: the game unpaused, a token for each player's character on the
 * active scene in a room (made where absent, at the middle of a room, the rooms dealt in order), and what was there
 * before, for `restore`. Answers the scene, its rooms, each character's room and the clock read first.
 */
export async function prepare(ctx, prim, actorIds) {
    return run(ctx, prim, `
        const R = await fk.imp("rooms.mjs"), M = await fk.imp("movement.mjs");
        const scene = game.scenes.active;
        if (!scene) return { err: "no active scene" };
        const rooms = R.roomNames(scene);
        const paused = game.paused;
        if (game.paused) await game.togglePause(false, { broadcast: true });
        const made = [];
        let i = 0;
        for (const id of ${J(actorIds)}) {
            const actor = game.actors.get(id);
            if (!actor || scene.tokens.some(t => t.actorId === id)) continue;
            const room = rooms[i++ % Math.max(rooms.length, 1)];
            const box = room ? M.boundsOf(R.roomRegions(scene, room)[0]) : null;
            const size = scene.grid?.size ?? 100;
            const x = box ? Math.round(box.x + box.w / 2 - size / 2) : 0, y = box ? Math.round(box.y + box.h / 2 - size / 2) : 0;
            const doc = await actor.getTokenDocument({ x, y });
            const [t] = await scene.createEmbeddedDocuments("Token", [doc.toObject()]);
            made.push({ actor: actor.name, token: t?.id ?? null, room });
        }
        await new Promise(r => setTimeout(r, 1500));
        const clock = game.drpg.getClock();
        return { scene: scene.name, sceneId: scene.id, rooms, paused, unpaused: !game.paused, made,
            roomOf: Object.fromEntries(${J(actorIds)}.map(id => [id, game.actors.get(id) ? M.roomOfActor(game.actors.get(id)) : null])),
            clock: { chapter: clock.chapter, session: clock.session, day: clock.day, timeOfDay: clock.timeOfDay, phase: clock.phase, eclipse: Boolean(clock.eclipse) },
            eclipse: game.drpg.isEclipse() };`, { timeout: 120_000 });
}

/** The clock and the pause put back as `prepare` read them, on `role`'s page (a GM). Answers what it did. */
export async function restore(ctx, role, before) {
    if (!before?.clock || !ctx.c[role]) return { skipped: true };
    return run(ctx, role, `
        const was = ${J(before.clock)}, out = {};
        try { if (game.drpg.isEclipse() && !was.eclipse) out.endedEclipse = Boolean(await game.drpg.endEclipse({ advance: false })); } catch (e) { out.eclipseErr = String(e.message); }
        try { out.clock = Boolean(await game.drpg.setClock({ chapter: was.chapter, session: was.session, day: was.day, timeOfDay: was.timeOfDay, phase: was.phase })); }
        catch (e) { out.clockErr = String(e.message); }
        if (${J(Boolean(before.paused))} && !game.paused) await game.togglePause(true, { broadcast: true });
        out.paused = game.paused;
        const c = game.drpg.getClock();
        out.now = { chapter: c.chapter, session: c.session, day: c.day, timeOfDay: c.timeOfDay, phase: c.phase, eclipse: Boolean(c.eclipse) };
        return out;`, { timeout: 120_000 });
}

/**
 * What a GM's interface shows of the table (EXP-GM-01, PRIM-01), on `role`'s page: the GM panel and the Students window
 * opened (gm-students.mjs `openWhoIsAliveDialog`), then read with every window of the module already open, and the
 * windows this opened closed again. `listShown`/`listNames`: Foundry's players list drawn, and which of `playerNames` it
 * names; `marker`/`words`: an element or words of connection in those windows; `primShown`: an element whose own text
 * (under 160 characters, attributes and tooltips not read) names `primName` beside "primary"/"główny". Heuristics over a
 * UI 2.0 has not drawn yet (UNMEASURED); the details carry what was read.
 */
export function uiProbe(ctx, role, { primName, playerNames }) {
    return run(ctx, role, `
        const had = new Set([...foundry.applications.instances.keys()]);
        try { await Promise.race([Promise.resolve(game.drpg.gmPanel()), new Promise(r => setTimeout(r, 5000))]); } catch { /* read what opened */ }
        try { const G = await fk.imp("gm-students.mjs"); void G.openWhoIsAliveDialog(); } catch { /* read what opened */ }
        await new Promise(r => setTimeout(r, 3000));
        const opened = [...foundry.applications.instances.values()].filter(a => a.rendered && !had.has(a.id));
        const mine = [...foundry.applications.instances.values()].filter(a => a.rendered && /drpg/.test(String(a.id) + " " + String(a.element?.className ?? "")));
        const els = [...new Set([...opened, ...mine])].map(a => a.element).filter(Boolean);
        const list = document.getElementById("players");
        const listText = fk.squash(list);
        const listShown = Boolean(list) && getComputedStyle(list).display !== "none" && list.getClientRects().length > 0;
        const CONN = /\\b(connected|disconnected|offline|online)\\b|po\\u0142\\u0105czon|roz\\u0142\\u0105czon|niepo\\u0142\\u0105czon/i;
        const marker = els.some(el => el.querySelector("[data-online], [data-connected], [data-drpg-online], [data-drpg-connected], .online, .offline, .connected, .disconnected"));
        const words = els.some(el => CONN.test(fk.squash(el)));
        const PRIM = /primary|g\\u0142\\u00f3wn/i, name = ${J(primName)};
        const primShown = Boolean(name) && [...els, document.getElementById("ui-right"), document.getElementById("ui-left")].filter(Boolean).some(root =>
            [...root.querySelectorAll("*")].some(el => { const own = fk.squash(el); return own.length < 160 && own.includes(name) && PRIM.test(own); }));
        for (const a of opened) { try { await a.close(); } catch { /* left open */ } }
        return { listShown, listNames: ${J(playerNames)}.filter(n => listText.includes(n)), marker, words, primShown, windows: els.length,
            titles: els.map(el => fk.squash(el.querySelector(".window-title, header h1, header .title")).slice(0, 60)) };`, { timeout: 60_000 });
}

/** EXP-GM-01's reading of `uiProbe`: the players list with every player's name, or a connection shown in a module window. */
export function connectionShown(probe, playerNames) {
    return Boolean(probe && ((probe.listShown && probe.listNames.length === playerNames.length) || probe.marker || probe.words));
}

/** The words a page writes for `key` (its own language), formatted with `data`. */
export function words(ctx, role, key, data = null) {
    return call(ctx, role, "t", key, data);
}

/** A notice in `seen` whose text holds `piece` (case kept), or null. */
export function noticeWith(seen, piece) {
    if (!piece) return null;
    return (seen ?? []).find(n => String(n.text ?? "").includes(piece)) ?? null;
}

/** A unique tag for this run, so a re-run never finds the last run's cards. */
export function runTag(prefix) {
    return `${prefix}-${Date.now().toString(36)}`;
}
