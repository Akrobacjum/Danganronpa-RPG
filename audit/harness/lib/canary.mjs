/**
 * The secrets canary: what a player's browser holds that it should not (E30, 24.09.2026; audit S17-07).
 * ---------------------------------------------------------------------------
 * A scenario plants a marker - "CANARY-KEYPLAN-ANALYSIS-1" - in a field only
 * some people may read, and the canary reads every player's whole browser for
 * it: everything that arrived over the wire in order (documents, settings,
 * socket packets, acks), everything at rest (the world's documents, world and
 * client settings, localStorage and sessionStorage), the page, the
 * notifications, the dialogs and the console. A marker found where it is not
 * allowed is a hit; a hit an entry of known-leaks.json describes is that leak,
 * reproduced; any other hit fails the run.
 *
 * Two rules keep it honest. PLANTED FIRST: every marker must be found on the
 * GM before any player is read, or the scenario wrote it somewhere it did not
 * think (a field placeRemnant never reads, say) and its absence on a player
 * measures nothing. SEEN AT ALL: before anything is concluded from a marker's
 * absence, selfTest() shows each surface being read - a setting, a packet, a
 * document and the page each carry one to every player, a private card's words
 * reach its reader and no one else, and a leak planted on purpose comes back as
 * a hit with its phase and path.
 *
 * What is not read (E30): IndexedDB (jsdom has none, and the module opens none),
 * Cache Storage and cookies, JavaScript state that never touched the wire, the
 * canvas (PIXI text is mocked here) and audio; the console is read but has no
 * positive control yet.
 *
 * Pure but for createCanary, which is handed the cluster's functions; Node tools
 * and a live driver can import the rest (tools/registry.mjs reads SEEDS and
 * validateKnownLeaks).
 *
 * WORLD DATA, READ AGAINST A RULE (E05 C2, 26.09.2026). A marker finds a secret
 * the scenario planted; it cannot find a killer's actor id, which carries none, or
 * a field the module wrote on its own. `worldScan` reads a player's world data -
 * the module's world settings, the actors', users' and tokens' module flags -
 * against scripts/world-secrets.mjs, the rule R9 applies in the suite, and for the
 * actor ids it is given. Its hits carry a pseudo-seed (`world.id`, `world.field`),
 * so known-leaks.json describes the open ones with the same match rules as a
 * marker's.
 */

import { findWorldSecrets, WORLD_SECRET_MODULE } from "../../../scripts/world-secrets.mjs";

export const MARKER_RE = /CANARY-[A-Z0-9]+(?:-[A-Z0-9]+)*/gi;

/** Every seed a scenario may plant: what kind of secret, and the field it goes in. */
export const SEEDS = Object.freeze({
    "selftest.setting": { cls: "selftest", field: "the world setting danganronpa-rpg.safeword", plantedBy: "selfTest" },
    "selftest.socket": { cls: "selftest", field: "a packet on module.drpg-harness-selftest", plantedBy: "selfTest" },
    "selftest.chat": { cls: "selftest", field: "a public chat message's content", plantedBy: "selfTest" },
    "selftest.hud": { cls: "selftest", field: "the clock's campaign name, drawn in the HUD", plantedBy: "selfTest" },
    "selftest.card": { cls: "selftest", field: "a private card's words, to the GM and p1", plantedBy: "selfTest" },
    "selftest.leak": { cls: "selftest", field: "a packet sent to everybody on purpose, which must be reported", plantedBy: "selfTest" },
    "keyplan.name": { cls: "answer-key", field: "the Key Remnant plan: an entry's name", plantedBy: "72-canary" },
    "keyplan.text": { cls: "answer-key", field: "the Key Remnant plan: what an entry says", plantedBy: "72-canary" },
    "keyplan.analysis": { cls: "answer-key", field: "the Key Remnant plan: an entry's analysis", plantedBy: "72-canary" },
    "keyplan.note": { cls: "gm-notes", field: "the Key Remnant plan: the GM's note", plantedBy: "72-canary" },
    "remnant.note": { cls: "answer-key", field: "a trace's note (placeRemnant)", plantedBy: "72-canary, 10-murder" },
    "remnant.subject": { cls: "answer-key", field: "a trace's subject (placeRemnant)", plantedBy: "72-canary, 10-murder" },
    "bullet.note": { cls: "gm-notes", field: "a Truth Bullet's GM note", plantedBy: "72-canary" },
    "project.name": { cls: "plan", field: "a secret project's name", plantedBy: "72-canary" },
    "project.condition": { cls: "plan", field: "an indirect murder's condition", plantedBy: "72-canary" },
    "note.player": { cls: "plan", field: "a player's pre-session note", plantedBy: "72-canary, 11-killer-secrecy" },
    "park.note": { cls: "plan", field: "a Direct Murder parked during an Eclipse: its note", plantedBy: "72-canary" },
    "token.hidden": { cls: "metadata", field: "a hidden token's name", plantedBy: "72-canary" },
    // A found trace's public name as the GM names it: the GM's and its finder's (E05 C13 plants it).
    "remnant.publicName": { cls: "answer-key", field: "a found trace's public name, as the GM names it", plantedBy: "72-canary (from E05 C13)" },
    // No marker: what `worldScan` finds (E05 C2).
    "world.id": { cls: "killer-identity", field: "an actor id world data may not name (72: the killer's), in a module world setting or a document's module flags", plantedBy: "72-canary (worldScan)" },
    "world.field": { cls: "answer-key", field: "a field scripts/world-secrets.mjs keeps out of world data", plantedBy: "72-canary (worldScan)" }
});

export const NOT_SCANNED = Object.freeze([
    "IndexedDB (jsdom has none, and the module opens none)", "Cache Storage and cookies",
    "JavaScript state that never touched the wire", "the canvas (PIXI text is mocked)", "audio",
    "the console is read, with no positive control yet"
]);

/* A path with its ids and indices as "*": Foundry's 16-character ids, and numbers. */
const norm = path => path.split(".").map(seg => (/^[A-Za-z0-9]{16}$/.test(seg) || /^\d+$/.test(seg) ? "*" : seg)).join(".");

/* The field an embedded collection lives under in its parent's source, as Foundry names it. */
const EMBEDDED_KEYS = { Token: "tokens", ActiveEffect: "effects", Item: "items", Tile: "tiles", Wall: "walls", AmbientLight: "lights",
    AmbientSound: "sounds", PlaylistSound: "sounds", Drawing: "drawings", Note: "notes", Region: "regions", MeasuredTemplate: "templates",
    TableResult: "results", Combatant: "combatants" };
const embeddedKey = name => EMBEDDED_KEYS[name] ?? `${String(name).charAt(0).toLowerCase()}${String(name).slice(1)}s`;

function tryJson(text) { try { return JSON.parse(text); } catch { return text; } }

/* Every string leaf and key under `value`, with its dotted path. */
function walk(value, path, visit) {
    if (typeof value === "string") { visit(value, path); return; }
    if (!value || typeof value !== "object") return;
    for (const [k, v] of Object.entries(value)) {
        const p = path ? `${path}.${k}` : k;
        visit(k, `${p}#key`);
        walk(v, p, visit);
    }
}

/* The records of one dump, each a surface, a place, a value and how it got there. */
function* records(dump) {
    for (const w of dump.wire ?? []) {
        const m = w.msg ?? {};
        const at = { via: "wire", phase: w.phase, n: w.n };
        if (w.kind === "snapshot") {
            for (const [coll, docs] of Object.entries(m.collections ?? {})) {
                for (const d of docs ?? []) yield { ...at, surface: "document", where: coll, base: d?._id ?? "", value: d };
            }
            for (const [key, v] of Object.entries(m.settings ?? {})) yield { ...at, surface: "setting", where: key, base: "", value: v };
        } else if (w.kind === "document") {
            /* In the shape the document has at rest, so one datum seen on the wire and
               held afterwards is one hit: "<id>.<field>", embedded "<id>.tokens.<childId>.<field>". */
            const where = m.collName;
            if (m.action === "create") for (const d of m.docs ?? []) yield { ...at, surface: "document", where, base: d?._id ?? "", value: d };
            else if (m.action === "update") yield { ...at, surface: "document", where, base: m.docId ?? "", value: m.changes };
            else if (m.action === "embedded-create" || m.action === "embedded-update") {
                const key = embeddedKey(m.embeddedName);
                for (const d of (m.action === "embedded-create" ? m.docs : m.updates) ?? []) {
                    yield { ...at, surface: "document", where, base: `${m.docId}.${key}.${d?._id ?? ""}`, value: d };
                }
            }
        } else if (w.kind === "setting") {
            yield { ...at, surface: "setting", where: m.key, base: "", value: m.value };
        } else if (w.kind === "socket") {
            yield { ...at, surface: "socket", where: `${m.channel}#${m.args?.[0]?.action ?? ""}`, base: "", value: m.args };
        } else if (w.kind === "ack") {
            yield { ...at, surface: "ack", where: "", base: "", value: m.result };
        }
    }
    const rest = { via: "rest", phase: dump.phase, n: null };
    for (const [coll, docs] of Object.entries(dump.world ?? {})) {
        for (const d of docs ?? []) yield { ...rest, surface: "document", where: coll, base: d?._id ?? "", value: d };
    }
    for (const [key, v] of Object.entries(dump.settings?.world ?? {})) yield { ...rest, surface: "setting", where: key, base: "", value: v };
    for (const [key, v] of Object.entries(dump.settings?.client ?? {})) yield { ...rest, surface: "clientStore", where: key, base: "", value: v };
    /* Foundry keeps client settings in localStorage: those keys are read once, as clientStore. */
    const clientKeys = new Set(Object.keys(dump.settings?.client ?? {}));
    for (const [key, v] of Object.entries(dump.storage?.local ?? {})) {
        if (!clientKeys.has(key)) yield { ...rest, surface: "localStorage", where: key, base: "", value: tryJson(v) };
    }
    for (const [key, v] of Object.entries(dump.storage?.session ?? {})) yield { ...rest, surface: "sessionStorage", where: key, base: "", value: tryJson(v) };
    yield { ...rest, surface: "dom", where: "", base: "", value: dump.dom ?? "" };
    yield { ...rest, surface: "notification", where: "", base: "", value: dump.notifications ?? [] };
    yield { ...rest, surface: "dialog", where: "", base: "", value: dump.dialogs ?? [] };
    yield { ...rest, surface: "console", where: "", base: "", value: (dump.console ?? []).map(c => c.text) };
}

/* Where in the page a marker sits: the nearest id before it, else the nearest class. */
function domWhere(html, index) {
    const before = html.slice(Math.max(0, index - 4000), index);
    const id = [...before.matchAll(/\sid="([^"]+)"/g)].pop()?.[1];
    if (id) return `#${id}`;
    const cls = [...before.matchAll(/\sclass="([^"]+)"/g)].pop()?.[1];
    return cls ? `.${cls.trim().split(/\s+/).join(".")}` : "";
}

/**
 * Every place in `dump` a marker of `markers` (a Set of upper-case markers) appears:
 * `[{ marker, surface, where, path, phase, via: ["wire"|"rest"], n, sample }]`, a
 * datum seen on the wire and at rest grouped into one hit.
 */
export function scanDump(dump, markers) {
    const hits = new Map();
    const add = (marker, rec, path, text, index) => {
        const where = rec.surface === "dom" ? domWhere(text, index) : rec.where;
        const p = norm(rec.base ? `${rec.base}${path ? `.${path}` : ""}` : path);
        const key = `${marker}|${rec.surface}|${where}|${p}`;
        const hit = hits.get(key) ?? { marker, surface: rec.surface, where, path: p, phase: rec.phase, via: [], n: rec.n,
            sample: text.slice(Math.max(0, index - 30), index + 50) };
        if (!hit.via.includes(rec.via)) hit.via.push(rec.via);
        if (rec.via === "wire" && (hit.n === null || rec.n < hit.n)) { hit.n = rec.n; hit.phase = rec.phase; }
        hits.set(key, hit);
    };
    for (const rec of records(dump)) {
        let json;
        try { json = typeof rec.value === "string" ? rec.value : JSON.stringify(rec.value ?? null); } catch { continue; }
        if (!/canary-/i.test(json ?? "")) continue;
        if (rec.surface === "dom") {
            for (const m of rec.value.matchAll(MARKER_RE)) if (markers.has(m[0].toUpperCase())) add(m[0].toUpperCase(), rec, "", rec.value, m.index);
            continue;
        }
        walk(rec.value, "", (text, path) => {
            for (const m of text.matchAll(MARKER_RE)) if (markers.has(m[0].toUpperCase())) add(m[0].toUpperCase(), rec, path, text, m.index);
        });
    }
    return [...hits.values()];
}

/**
 * Every place a player's world data - in `dump`, that player's browser whole -
 * breaks scripts/world-secrets.mjs's rule or names one of `ids`, as canary hits:
 * `{ seed: "world.id" | "world.field", surface, where, path, phase, via, n, sample }`,
 * a setting at `danganronpa-rpg.<key>`, a document at its collection with the path
 * the canary gives it ("<id>.flags...", a token "<sceneId>.tokens.<id>.flags...").
 */
export function worldScan(dump, { ids = [] } = {}) {
    const prefix = `${WORLD_SECRET_MODULE}.`;
    const settings = Object.fromEntries(Object.entries(dump?.settings?.world ?? {})
        .filter(([key]) => key.startsWith(prefix)).map(([key, value]) => [key.slice(prefix.length), value]));
    const docs = name => (Array.isArray(dump?.world?.[name]) ? dump.world[name] : []);
    const snapshot = {
        settings,
        actors: docs("Actor").map(d => ({ id: d?._id, flags: d?.flags })),
        users: docs("User").map(d => ({ id: d?._id, flags: d?.flags })),
        tokens: docs("Scene").flatMap(scene => (scene?.tokens ?? []).map(t => ({ id: `${scene?._id}.tokens.${t?._id}`, flags: t?.flags })))
    };
    return findWorldSecrets(snapshot, { ids }).map(h => {
        const setting = h.doc === "setting";
        const full = setting ? h.path : `${h.id}${h.path ? `.${h.path}` : ""}`;
        return { seed: h.kind === "id" ? "world.id" : "world.field", surface: setting ? "setting" : "document",
            where: setting ? `${prefix}${h.id}` : (h.doc === "Token" ? "Scene" : h.doc),
            path: `${norm(full)}${h.key ? "#key" : ""}`, phase: dump?.phase ?? null, via: ["rest"], n: null, sample: h.rule };
    });
}

/* A glob: "**" any run, "*" one dotted segment. */
const glob = pattern => new RegExp(`^${String(pattern).replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, "\u0000").replace(/\*/g, "[^.]*").replace(/\u0000/g, ".*")}$`);

/** Whether one match rule of a known-leaks entry describes this hit. */
export function matchRule(hit, rule) {
    return glob(rule.seed ?? "**").test(hit.seed ?? "")
        && (!rule.surface || rule.surface === "*" || rule.surface === hit.surface)
        && glob(rule.where ?? "**").test(hit.where ?? "")
        && glob(rule.path ?? "**").test(hit.path ?? "");
}

/** Whether a known-leaks entry describes this hit. */
export function matchLeak(hit, entry) {
    return (entry.match ?? []).some(rule => matchRule(hit, rule));
}

export const LEAK_CLASSES = Object.freeze(["killer-identity", "answer-key", "plan", "gm-notes", "metadata"]);
export const SEVERITIES = Object.freeze(["critical", "high", "medium", "low", "info"]);
export const SURFACES = Object.freeze(["document", "setting", "socket", "ack", "clientStore", "localStorage", "sessionStorage", "dom", "notification", "dialog", "console"]);
/* D27: what may wait for 1.3.x, and nothing else. */
const DEFERRABLE = e => e.class === "metadata" && ["medium", "low", "info"].includes(e.severity);

/**
 * Every problem of known-leaks.json (`doc`, parsed), one line each. `ctx`:
 * stageStatus(stage) -> { known, shipped, version } (tools/stages.mjs), readme (the
 * text of README.md), scenarioText(name) -> the scenario's source, or null when it
 * is not a row of audit/harness/README.md. Read by `node tools/check.mjs registry`.
 */
export function validateKnownLeaks(doc, { stageStatus, readme = "", scenarioText = () => null } = {}) {
    if (doc?.schema !== 1 || !Array.isArray(doc.leaks)) return ["known-leaks.json: schema is not 1, or there is no leaks list"];
    const errs = [], ids = new Set();
    const seedsOf = pattern => Object.keys(SEEDS).filter(seed => glob(pattern).test(seed));
    for (const e of doc.leaks) {
        const at = `leak ${e.id ?? "(no id)"}`;
        if (!e.id) { errs.push(`${at}: no id`); continue; }
        if (ids.has(e.id)) errs.push(`${at}: the id is used twice`);
        ids.add(e.id);
        if (!e.id.startsWith("foundry-") && !(Array.isArray(e.findings) && e.findings.length)) errs.push(`${at}: names no plan finding`);
        if (!LEAK_CLASSES.includes(e.class)) errs.push(`${at}: class "${e.class}" is not one of ${LEAK_CLASSES.join(", ")}`);
        if (!SEVERITIES.includes(e.severity)) errs.push(`${at}: severity "${e.severity}" is not one of ${SEVERITIES.join(", ")}`);
        if (!String(e.what ?? "").trim()) errs.push(`${at}: says nothing of what reaches whom`);
        if (!String(e.measuredAt ?? "").trim()) errs.push(`${at}: no measuredAt - an entry is written from a run that reproduced it`);
        const kinds = ["closes", "foundryLimit", "deferred"].filter(k => e[k] !== undefined && e[k] !== null);
        if (kinds.length !== 1) errs.push(`${at}: needs exactly one of closes, foundryLimit and deferred, and has ${kinds.join(", ") || "none"}`);
        if (e.closes !== undefined && stageStatus) {
            const s = stageStatus(e.closes);
            if (!s.known) errs.push(`${at}: closes in ${e.closes}, which tools/stages.json does not know`);
            else if (s.shipped) errs.push(`${at}: was to close in ${e.closes}, which shipped in ${s.version} - fix it, or move it to a later stage in the open`);
            else if (e.closes === "E26") errs.push(`${at}: closes in E26 - nothing may remain open at 1.3.0; close it earlier, or record what stays (foundryLimit, deferred)`);
        }
        if (e.deferred !== undefined) {
            if (e.deferred !== "1.3.x (D27)") errs.push(`${at}: deferred is exactly "1.3.x (D27)"`);
            if (!DEFERRABLE(e)) errs.push(`${at}: a ${e.class} leak of severity ${e.severity} may not be deferred (D27)`);
        }
        if (e.foundryLimit !== undefined || e.deferred !== undefined) {
            if (e.readme !== `leak:${e.id}` || !readme.includes(`<!-- leak:${e.id} -->`)) errs.push(`${at}: what stays needs its paragraph in README.md, marked <!-- leak:${e.id} -->`);
        }
        /* A rule describes one place a secret reaches: a seed (a family with one `*` at
           most, never `**`), a surface, and a where or a path that is more than stars.
           matchRule reads a missing field as "any", so `match: [{}]` described every hit
           of every scenario, the canary's "outside known-leaks.json" check could not go
           red, and this passed it (E30 review, 25.09.2026). */
        const narrow = v => typeof v === "string" && /[^*.]/.test(v);
        for (const rule of e.match ?? []) {
            if (!narrow(rule?.seed) || rule.seed.includes("**")) errs.push(`${at}: a match rule names no seed, or a seed with ** (${JSON.stringify(rule?.seed ?? null)}) - it would describe every seed`);
            else if (!seedsOf(rule.seed).length) errs.push(`${at}: match seed ${rule.seed} is no seed of SEEDS`);
            if (!rule?.surface || rule.surface === "*") errs.push(`${at}: a match rule names no surface (${JSON.stringify(rule?.surface ?? null)}) - it would describe every surface`);
            else if (!SURFACES.includes(rule.surface)) errs.push(`${at}: match surface ${rule.surface} is not one of ${SURFACES.join(", ")}`);
            if (!narrow(rule?.where) && !narrow(rule?.path)) errs.push(`${at}: a match rule names neither a where nor a path - it would describe every place`);
        }
        const by = Array.isArray(e.detectedBy) ? e.detectedBy : [];
        if (!by.length && !String(e.notMeasuredBecause ?? "").trim()) errs.push(`${at}: detected by nothing, and no notMeasuredBecause`);
        for (const d of by) {
            const text = scenarioText(d.scenario);
            if (text === null) { errs.push(`${at}: detected by ${d.scenario}, which is not a row of audit/harness/README.md`); continue; }
            if (d.check !== undefined && !text.includes(JSON.stringify(d.check).slice(1, -1))) errs.push(`${at}: ${d.scenario} has no check named "${d.check}"`);
            if (d.seed !== undefined) {
                if (!seedsOf(d.seed).length) errs.push(`${at}: seed ${d.seed} is not in lib/canary.mjs's SEEDS`);
                /* A canary entry with no rule that its own seed can meet would leave every hit it describes unmatched. */
                else if (!(e.match ?? []).some(rule => seedsOf(d.seed).some(seed => glob(rule.seed ?? "**").test(seed)))) errs.push(`${at}: detected by seed ${d.seed}, and no match rule describes it`);
            }
        }
    }
    return errs;
}

const table = hits => hits.slice(0, 20).map(h => `${h.who} ${h.seed} ${h.surface} ${h.where} ${h.path} [${h.phase}; ${h.via.join("+")}] "${h.sample}"`).join(" | ")
    + (hits.length > 20 ? ` | and ${hits.length - 20} more` : "");

/**
 * The canary for one scenario run. `ctx`: { scenario, check, note, phase() (the
 * current phase), dump(who) (a player's browser, whole), players (the handles
 * scanned), gm, knownLeaks (the entries), settle }.
 */
export function createCanary(ctx) {
    const planted = new Map();            // MARKER -> { seed, allowed: Set }
    let counter = 0, sinceScan = 0;
    const scans = [], hitsSeen = [], evaluated = new Set(), worldScans = [];
    let selftest = null;

    function marker(seed, { allowed = ["gm"] } = {}) {
        if (!SEEDS[seed]) throw new Error(`canary: "${seed}" is not a seed of lib/canary.mjs's SEEDS`);
        const m = `CANARY-${seed.toUpperCase().replace(/[^A-Z0-9]+/g, "-")}-${++counter}`;
        planted.set(m, { seed, allowed: new Set(allowed) });
        if (!seed.startsWith("selftest.")) sinceScan++;
        return m;
    }
    const allowedFor = (m, who, userId) => { const p = planted.get(m); return Boolean(p && (p.allowed.has(who) || p.allowed.has(userId))); };
    /** The planted markers in `code` that `who` may not hold (the cluster refuses such an eval). */
    function forbiddenIn(code, who, userId) {
        return [...new Set([...String(code).matchAll(MARKER_RE)].map(m => m[0].toUpperCase()))]
            .filter(m => planted.has(m) && !allowedFor(m, who, userId));
    }

    async function selfTest() {
        const everyone = ["gm", ...ctx.players.map(p => p.who)];
        const ms = {
            setting: marker("selftest.setting", { allowed: everyone }), socket: marker("selftest.socket", { allowed: everyone }),
            chat: marker("selftest.chat", { allowed: everyone }), hud: marker("selftest.hud", { allowed: everyone }),
            card: marker("selftest.card", { allowed: ["gm", "p1"] }), leak: marker("selftest.leak")
        };
        const p1 = ctx.players.find(p => p.who === "p1");
        await ctx.gm.eval(`
            const before = { safeword: game.settings.get("danganronpa-rpg", "safeword"), campaign: game.drpg.getClock().campaignName ?? "" };
            globalThis.__canaryRestore = before;
            await game.settings.set("danganronpa-rpg", "safeword", "${ms.setting}");
            game.socket.emit("module.drpg-harness-selftest", { marker: "${ms.socket}" });
            await ChatMessage.create({ content: "<p>${ms.chat}</p>" });
            await game.drpg.setClock({ campaignName: "${ms.hud}" });
            const { postSecret } = await import("${ctx.repoUrl}/scripts/secret.mjs");
            await postSecret({ content: "<p>${ms.card}</p>", whisper: [game.user.id, "${p1.userId}"] });
            return true;`, { timeout: 60000 });
        await ctx.settle(1500);
        await ctx.gm.eval(`game.socket.emit("module.drpg-harness-selftest", { marker: "${ms.leak}" }); return true;`);
        await ctx.settle(800);
        const all = new Set(Object.values(ms));
        const seen = {};
        for (const p of ctx.players) seen[p.who] = scanDump(await ctx.dump(p.who), all);
        const on = (who, m, surface) => (seen[who] ?? []).some(h => h.marker === m && (!surface || h.surface === surface));
        const names = ctx.players.map(p => p.who).join(", ");
        for (const [key, surface] of [["setting", "setting"], ["socket", "socket"], ["chat", "document"], ["hud", "dom"]]) {
            const missing = ctx.players.filter(p => !on(p.who, ms[key], surface)).map(p => p.who);
            ctx.check(`canary self-test: the ${surface} surface is read on ${names}`, missing.length === 0,
                missing.length ? `${ms[key]} not found on ${missing.join(", ")}` : "");
        }
        ctx.check("canary self-test: a private card's words reach its reader (p1: socket and client store)",
            on("p1", ms.card, "socket") && on("p1", ms.card, "clientStore"),
            JSON.stringify((seen.p1 ?? []).filter(h => h.marker === ms.card).map(h => `${h.surface} ${h.where}`)));
        const strangers = ctx.players.filter(p => p.who !== "p1" && on(p.who, ms.card)).map(p => p.who);
        ctx.check("canary self-test: a private card's words reach nobody else", strangers.length === 0,
            strangers.length ? `on ${strangers.join(", ")}: ${JSON.stringify(ctx.players.flatMap(p => (seen[p.who] ?? []).filter(h => h.marker === ms.card)))}` : "");
        const leak = (seen.p2 ?? []).find(h => h.marker === ms.leak && h.surface === "socket" && h.phase === "selftest");
        ctx.check("canary self-test: a leak planted on purpose is reported (p2, phase selftest, surface socket, with its path)",
            Boolean(leak && leak.path), JSON.stringify(leak ?? (seen.p2 ?? []).filter(h => h.marker === ms.leak)));
        selftest = { markers: Object.keys(ms), leak: leak ? { who: "p2", surface: leak.surface, where: leak.where, path: leak.path, phase: leak.phase } : null };
        await ctx.gm.eval(`const b = globalThis.__canaryRestore;
            await game.settings.set("danganronpa-rpg", "safeword", b.safeword);
            await game.drpg.setClock({ campaignName: b.campaign });
            return true;`, { timeout: 60000 });
        await ctx.settle(300);
        return selftest;
    }

    async function scan({ phase = ctx.phase() } = {}) {
        const live = [...planted].filter(([, p]) => !p.seed.startsWith("selftest."));
        if (!live.length) return null;
        const set = new Set(live.map(([m]) => m));
        const onGm = new Set(scanDump(await ctx.dump("gm"), set).map(h => h.marker));
        const missing = live.filter(([m]) => !onGm.has(m)).map(([m, p]) => `${p.seed} (${m})`);
        ctx.check(`canary [${phase}]: every planted secret is on the GM`, missing.length === 0,
            missing.length ? `never written where the scenario thinks: ${missing.join(", ")}` : `${live.length} markers on the GM`);
        const hits = [], scanned = [];
        for (const p of ctx.players) {
            const d = await ctx.dump(p.who);
            if (d.wireDropped) ctx.check(`canary [${phase}]: ${p.who}'s wire record is whole`, false, `wire record truncated: ${d.wireDropped} messages dropped`);
            scanned.push({ who: p.who, userId: d.userId });
            for (const h of scanDump(d, set)) {
                if (!allowedFor(h.marker, p.who, d.userId)) hits.push({ ...h, who: p.who, seed: planted.get(h.marker).seed });
            }
        }
        const unmatched = hits.filter(h => !ctx.knownLeaks.some(e => matchLeak(h, e)));
        ctx.check(`canary [${phase}]: no secret reached a player outside known-leaks.json`, unmatched.length === 0, table(unmatched));
        for (const e of ctx.knownLeaks) {
            // A `world.*` seed is no marker: `worldCheck` below evaluates it.
            const by = (e.detectedBy ?? []).filter(d => d.scenario === ctx.scenario && d.seed && !String(d.seed).startsWith("world.")
                && (!d.phase || d.phase === phase));
            if (!by.length) continue;
            evaluated.add(e.id);
            const mine = live.filter(([, p]) => by.some(d => matchRule({ seed: p.seed }, { seed: d.seed })));
            const confirmed = mine.length > 0 && mine.every(([m]) => onGm.has(m));
            const exposed = scanned.some(({ who, userId }) => mine.some(([m]) => !allowedFor(m, who, userId)));
            const reproduced = hits.filter(h => matchLeak(h, e));
            ctx.check(`known leak ${e.id}: ${e.what}`, reproduced.length === 0, table(reproduced),
                { knownLeak: e.id, measured: confirmed && exposed });
        }
        sinceScan = 0;
        scans.push({ phase, markers: live.length, hits: hits.length, unmatched: unmatched.length });
        hitsSeen.push(...hits.map(h => ({ ...h, scanPhase: phase })));
        return { hits, unmatched };
    }

    /**
     * WORLD DATA AFTER A PHASE (E05 C2): `worldScan` on each player named in `who`
     * (72: p1 and p2, neither of them the killer's player - world data is the same on
     * every browser), for `ids`. The read itself is a check, so an empty dump cannot
     * pass for a clean one; a hit no known-leaks.json entry describes fails; an entry
     * that names a `world.*` seed in this phase is the leak, reproduced, and red.
     */
    async function worldCheck({ phase = ctx.phase(), ids = [], who = ["p1", "p2"] } = {}) {
        const players = ctx.players.filter(p => who.includes(p.who));
        const hits = [], read = [];
        for (const p of players) {
            const d = await ctx.dump(p.who);
            read.push({ who: p.who, settings: Object.keys(d?.settings?.world ?? {}).filter(k => k.startsWith(`${WORLD_SECRET_MODULE}.`)).length,
                actors: (d?.world?.Actor ?? []).length });
            for (const h of worldScan(d, { ids })) hits.push({ ...h, who: p.who, phase });
        }
        const measured = ids.length > 0 && read.length === who.length && read.every(r => r.settings > 0 && r.actors > 0);
        ctx.check(`world [${phase}]: ${who.join(" and ")}'s world data was read, for ${ids.length} actor id(s)`, measured, JSON.stringify(read));
        const unmatched = hits.filter(h => !ctx.knownLeaks.some(e => matchLeak(h, e)));
        ctx.check(`world [${phase}]: no world data on ${who.join(" or ")} breaks the world-secrets rule or names the killer outside known-leaks.json`,
            unmatched.length === 0, table(unmatched));
        for (const e of ctx.knownLeaks) {
            const by = (e.detectedBy ?? []).filter(d => d.scenario === ctx.scenario && String(d.seed ?? "").startsWith("world.") && (!d.phase || d.phase === phase));
            if (!by.length) continue;
            evaluated.add(e.id);
            const reproduced = hits.filter(h => matchLeak(h, e));
            ctx.check(`known leak ${e.id} in world data [${phase}]: ${e.what}`, reproduced.length === 0, table(reproduced), { knownLeak: e.id, measured });
        }
        worldScans.push({ phase, hits: hits.length, unmatched: unmatched.length });
        hitsSeen.push(...hits.map(h => ({ ...h, scanPhase: phase })));
        return { hits, unmatched };
    }

    async function finish(results) {
        if (sinceScan > 0) await scan({ phase: "end" });
        for (const e of ctx.knownLeaks) {
            for (const d of e.detectedBy ?? []) {
                if (d.scenario !== ctx.scenario) continue;
                const ran = d.seed ? evaluated.has(e.id) : results.some(r => r.name === d.check && r.knownLeak === e.id);
                if (!ran) {
                    ctx.check(`known leak ${e.id} was measured in ${ctx.scenario}`, false,
                        d.seed ? `no scan evaluated seed ${d.seed}${d.phase ? ` in phase ${d.phase}` : ""}: a renamed phase, or a seed not planted`
                            : `no check "${d.check}" with knownLeak ${e.id} ran: a renamed check`);
                }
            }
        }
        const live = [...planted.values()].filter(p => !p.seed.startsWith("selftest."));
        return { planted: live.length, scans, worldScans, hits: hitsSeen.map(h => ({ who: h.who, seed: h.seed, surface: h.surface, where: h.where,
            path: h.path, phase: h.phase, scanPhase: h.scanPhase, via: h.via, leak: ctx.knownLeaks.find(e => matchLeak(h, e))?.id ?? null })),
            selftest, notScanned: NOT_SCANNED };
    }

    return { marker, selfTest, scan, playerLeakScan: scan, worldScan: worldCheck, finish, forbiddenIn };
}
