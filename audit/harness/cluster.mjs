/**
 * The "Foundry server": authoritative world store + permission gate + relay.
 * Forks three clients (gm, p1, p2), seeds a world, runs a scenario file.
 *
 * Usage: node cluster.mjs scenarios/00-boot.mjs [--verbose]
 */

import { fork } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import url from "node:url";
import * as U from "./lib/futil.mjs";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const REPO = process.env.DRPG_REPO || "/home/user/Danganronpa-RPG";
const VERBOSE = process.argv.includes("--verbose");
const scenarioPath = process.argv[2];
if (!scenarioPath) { console.error("usage: node cluster.mjs <scenario.mjs>"); process.exit(2); }

/* ----------------------------- world seed -------------------------------- */

const IDS = {
    gm: "USERGM0000000000", p1: "USERP10000000000", p2: "USERP20000000000",
    aiko: "ACTORAIKO0000000", botan: "ACTORBOTAN000000", chie: "ACTORCHIE0000000", daichi: "ACTORDAICHI00000",
    scene: "SCENEACADEMY0000"
};

function studentActor(id, name, ownerUserId) {
    return {
        _id: id, name, type: "character", img: "icons/svg/mystery-man.svg",
        ownership: { default: 0, ...(ownerUserId ? { [ownerUserId]: 3 } : {}) },
        system: {
            resources: {
                hope: { value: 2, max: 6 },
                stress: { value: 0, max: 6 },
                hitPoints: { value: 0, max: 6 },
                actions: { value: 3, max: 3 }
            },
            traits: {
                agility: { value: 1 }, strength: { value: 0 }, finesse: { value: 1 },
                instinct: { value: 0 }, presence: { value: 1 }, knowledge: { value: 0 }
            },
            experiences: {},
            biography: { background: "", connections: "", notes: "" },
            description: ""
        },
        items: [], effects: [], flags: {}, statuses: []
    };
}

const world = {
    collections: {
        User: [
            { _id: IDS.gm, name: "GM", role: 4, active: true, character: null, color: "#ff0000", flags: {} },
            { _id: IDS.p1, name: "PlayerOne", role: 1, active: true, character: IDS.aiko, color: "#00ff00", flags: {} },
            { _id: IDS.p2, name: "PlayerTwo", role: 1, active: true, character: IDS.botan, color: "#0000ff", flags: {} }
        ],
        Actor: [
            studentActor(IDS.aiko, "Aiko Hoshino", IDS.p1),
            studentActor(IDS.botan, "Botan Kage", IDS.p2),
            studentActor(IDS.chie, "Chie Mori", null),
            studentActor(IDS.daichi, "Daichi Sato", null),
            { ...studentActor("ACTORMONOKUMA000", "Monokuma", null), flags: { "danganronpa-rpg": { monokuma: true } } }
        ],
        Item: [], ChatMessage: [], RollTable: [], Playlist: [], Macro: [], JournalEntry: [], Folder: [],
        Scene: [{
            _id: IDS.scene, name: "Academy — Floor 1", active: true, width: 4000, height: 3000,
            grid: { size: 100, distance: 5, type: 1 },
            flags: {},
            tokens: [
                { _id: "TOKAIKO000000000", name: "Aiko", actorId: IDS.aiko, actorLink: true, x: 300, y: 300, width: 1, height: 1, hidden: false, flags: {}, texture: { src: "icons/svg/mystery-man.svg" }, disposition: 1 },
                { _id: "TOKBOTAN00000000", name: "Botan", actorId: IDS.botan, actorLink: true, x: 1300, y: 300, width: 1, height: 1, hidden: false, flags: {}, texture: { src: "icons/svg/mystery-man.svg" }, disposition: 1 },
                { _id: "TOKCHIE000000000", name: "Chie", actorId: IDS.chie, actorLink: true, x: 350, y: 1300, width: 1, height: 1, hidden: false, flags: {}, texture: { src: "icons/svg/mystery-man.svg" }, disposition: 1 },
                { _id: "TOKDAICHI0000000", name: "Daichi", actorId: IDS.daichi, actorLink: true, x: 1400, y: 1300, width: 1, height: 1, hidden: false, flags: {}, texture: { src: "icons/svg/mystery-man.svg" }, disposition: 1 },
                { _id: "TOKMONOKUMA00000", name: "Monokuma", actorId: "ACTORMONOKUMA000", actorLink: true, x: 2400, y: 300, width: 1, height: 1, hidden: false, flags: {}, texture: { src: "icons/svg/mystery-man.svg" }, disposition: -1 }
            ],
            regions: [
                { _id: "REGDORMA00000000", name: "Dorm A", shapes: [{ type: "rectangle", x: 200, y: 200, width: 600, height: 600 }], flags: {}, behaviors: [] },
                { _id: "REGCAFE000000000", name: "Cafeteria", shapes: [{ type: "rectangle", x: 1200, y: 200, width: 800, height: 600 }], flags: {}, behaviors: [] },
                { _id: "REGDORMB00000000", name: "Dorm B", shapes: [{ type: "rectangle", x: 200, y: 1200, width: 600, height: 600 }], flags: {}, behaviors: [] },
                { _id: "REGGYM0000000000", name: "Gym", shapes: [{ type: "rectangle", x: 1200, y: 1200, width: 800, height: 600 }], flags: {}, behaviors: [] },
                { _id: "REGHALL000000000", name: "Hall", shapes: [{ type: "rectangle", x: 2200, y: 200, width: 600, height: 600 }], flags: {}, behaviors: [] },
                { _id: "REGSTORAGE000000", name: "Storage", shapes: [{ type: "rectangle", x: 2200, y: 1200, width: 600, height: 600 }], flags: {}, behaviors: [] }
            ],
            walls: []
        }]
    },
    settings: {}
};

/* --------------------------- permission gate ------------------------------ */

const GM_ONLY_COLLS = new Set(["Scene", "RollTable", "Playlist", "Macro", "JournalEntry", "Folder", "Actor"]);
// Actor create/delete is GM-only; Actor *update* is ownership-based.

function userRec(userId) { return world.collections.User.find(u => u._id === userId); }
function isGM(userId) { return (userRec(userId)?.role ?? 0) >= 4; }

function actorOwned(actorData, userId) {
    const own = actorData?.ownership ?? { default: 0 };
    return (own[userId] ?? own.default ?? 0) >= 3;
}

function canWrite(userId, op) {
    if (isGM(userId)) return true;
    const { action, coll: collName } = op;
    if (collName === "ChatMessage") {
        if (action === "create") return true;
        const doc = world.collections.ChatMessage.find(m => m._id === op.docId);
        return doc && (doc.author === userId);
    }
    if (collName === "User") {
        return action === "update" && op.docId === userId;
    }
    if (collName === "Actor") {
        const doc = world.collections.Actor.find(a => a._id === op.docId);
        if (action === "create" || action === "delete") return false;
        if (!doc) return false;
        return actorOwned(doc, userId); // update + embedded ops on owned actor
    }
    if (collName === "Scene") {
        // players may update tokens of actors they own; nothing else
        if (action === "embedded-update" && op.embeddedName === "Token") {
            const scene = world.collections.Scene.find(s => s._id === op.docId);
            if (!scene) return false;
            return (op.payload ?? []).every(u => {
                const tok = scene.tokens.find(t => t._id === u._id);
                const actor = tok && world.collections.Actor.find(a => a._id === tok.actorId);
                return actor && actorOwned(actor, userId);
            });
        }
        return false;
    }
    if (GM_ONLY_COLLS.has(collName)) return false;
    return false;
}

/* ------------------------------ apply ops --------------------------------- */

const EMB_KEYS = {
    Actor: ["items", "effects"], Item: ["effects"], Scene: ["tokens", "regions", "walls"],
    RollTable: ["results"], Playlist: ["sounds"], Region: ["behaviors"]
};
const EMB_CHILD = { items: "Item", effects: "ActiveEffect", tokens: "Token", regions: "Region", walls: "Wall", results: "TableResult", sounds: "PlaylistSound", behaviors: "RegionBehavior" };

/** Every embedded entry needs a server-assigned _id, recursively. */
function ensureEmbeddedIds(collName, doc) {
    for (const key of EMB_KEYS[collName] ?? []) {
        if (!Array.isArray(doc[key])) continue;
        for (const child of doc[key]) {
            if (!child._id) child._id = U.randomID();
            ensureEmbeddedIds(EMB_CHILD[key], child);
        }
    }
}

function applyOp(userId, op) {
    const collName = op.coll;
    const list = world.collections[collName] ?? (world.collections[collName] = []);
    switch (op.action) {
        case "create": {
            const docs = op.data.map(d => ({ ...U.deepClone(d), _id: d._id && !list.some(x => x._id === d._id) ? d._id : U.randomID() }));
            for (const d of docs) ensureEmbeddedIds(collName, d);
            list.push(...docs);
            return { broadcast: { t: "apply", action: "create", collName, docs, userId, options: op.options }, result: docs.map(d => d._id) };
        }
        case "update": {
            const doc = list.find(d => d._id === op.docId);
            if (!doc) throw new Error(`${collName} ${op.docId} does not exist`);
            U.applyDocChanges(collName, doc, op.changes);
            return { broadcast: { t: "apply", action: "update", collName, docId: op.docId, changes: op.changes, userId, options: op.options }, result: op.docId };
        }
        case "delete": {
            const i = list.findIndex(d => d._id === op.docId);
            if (i < 0) throw new Error(`${collName} ${op.docId} does not exist`);
            list.splice(i, 1);
            return { broadcast: { t: "apply", action: "delete", collName, docId: op.docId, userId, options: op.options }, result: op.docId };
        }
        case "embedded-create": {
            const doc = list.find(d => d._id === op.docId);
            if (!doc) throw new Error(`${collName} ${op.docId} does not exist`);
            const key = embKey(collName, op.embeddedName);
            doc[key] = doc[key] ?? [];
            const docs = op.payload.map(d => ({ ...U.deepClone(d), _id: d._id && !doc[key].some(x => x._id === d._id) ? d._id : U.randomID() }));
            for (const d of docs) ensureEmbeddedIds(op.embeddedName, d);
            doc[key].push(...docs);
            return { broadcast: { t: "apply", action: "embedded-create", collName, docId: op.docId, embeddedName: op.embeddedName, docs, userId, options: op.options }, result: docs.map(d => d._id) };
        }
        case "embedded-update": {
            const doc = list.find(d => d._id === op.docId);
            if (!doc) throw new Error(`${collName} ${op.docId} does not exist`);
            const key = embKey(collName, op.embeddedName);
            for (const u of op.payload) {
                const raw = (doc[key] ?? []).find(d => d._id === u._id);
                if (!raw) continue;
                const { _id, ...changes } = u;
                U.mergeObject(raw, changes, { performDeletions: true });
            }
            return { broadcast: { t: "apply", action: "embedded-update", collName, docId: op.docId, embeddedName: op.embeddedName, updates: op.payload, userId, options: op.options }, result: op.payload.map(u => u._id) };
        }
        case "embedded-delete": {
            const doc = list.find(d => d._id === op.docId);
            if (!doc) throw new Error(`${collName} ${op.docId} does not exist`);
            const key = embKey(collName, op.embeddedName);
            doc[key] = (doc[key] ?? []).filter(d => !op.payload.includes(d._id));
            return { broadcast: { t: "apply", action: "embedded-delete", collName, docId: op.docId, embeddedName: op.embeddedName, ids: op.payload, userId, options: op.options }, result: op.payload };
        }
        default: throw new Error(`unknown op ${op.action}`);
    }
}

function embKey(collName, embeddedName) {
    const map = { Actor: { Item: "items", ActiveEffect: "effects" }, Scene: { Token: "tokens", Region: "regions", Wall: "walls" }, RollTable: { TableResult: "results" }, Playlist: { PlaylistSound: "sounds" }, Item: { ActiveEffect: "effects" } };
    const k = map[collName]?.[embeddedName];
    if (!k) throw new Error(`no embedded ${embeddedName} in ${collName}`);
    return k;
}

/** Who may see a chat message create. null = everyone. */
function chatAudience(data) {
    const whisper = data.whisper ?? [];
    if (!whisper.length) return null;
    const gms = world.collections.User.filter(u => u.role >= 4).map(u => u._id);
    const audience = new Set([...whisper, ...gms]);
    if (data.author) audience.add(data.author);
    return audience;
}

/* ------------------------------ clients ----------------------------------- */

const clients = new Map(); // who -> {proc, ready, userId}
const readiness = new Map();
const bootInfo = new Map();
let evalSeq = 0;
const evalPending = new Map();

function spawnClient(who, userId) {
    const proc = fork(path.join(HERE, "client-entry.mjs"), [], {
        env: { ...process.env, DRPG_USER: who, DRPG_REPO: REPO },
        stdio: ["ignore", "pipe", "pipe", "ipc"]
    });
    proc.stdout.on("data", d => { if (VERBOSE) process.stdout.write(`[${who}] ${d}`); });
    proc.stderr.on("data", d => process.stdout.write(`[${who}:err] ${d}`));
    const entry = { proc, userId, ready: new Promise(res => readiness.set(who, res)) };
    proc.on("message", msg => onClientMessage(who, entry, msg));
    proc.on("exit", code => { if (code) console.log(`[cluster] client ${who} exited with ${code}`); });
    clients.set(who, entry);
    return entry;
}

function snapshotFor(userId) {
    // Foundry replicates all world documents to every client (visibility is
    // client-side) EXCEPT chat whispers, which the server filters. Mirror that.
    const collections = {};
    for (const [name, docs] of Object.entries(world.collections)) {
        if (name === "ChatMessage") {
            collections[name] = docs.filter(m => {
                const aud = chatAudience(m);
                return !aud || aud.has(userId) || isGM(userId);
            }).map(U.deepClone);
        } else collections[name] = docs.map(U.deepClone);
    }
    return { t: "snapshot", collections, settings: { ...world.settings }, you: userId };
}

function broadcast(msg, { except = null, audience = null } = {}) {
    for (const [who, entry] of clients) {
        if (who === except) continue;
        if (audience && !audience.has(entry.userId) && !isGM(entry.userId)) continue;
        entry.proc.send(msg);
    }
}

function onClientMessage(who, entry, msg) {
    switch (msg.t) {
        case "hello":
            entry.proc.send(snapshotFor(entry.userId));
            break;
        case "ready":
            bootInfo.set(who, msg);
            readiness.get(who)?.(msg);
            break;
        case "bootFailed":
            bootInfo.set(who, msg);
            console.log(`[cluster] BOOT FAILED on ${who}: ${msg.error}`);
            readiness.get(who)?.(msg);
            break;
        case "log":
            if (VERBOSE || /FAILED|UNCAUGHT|REJECTION|threw|error/i.test(msg.line)) console.log(`[${who}] ${msg.line}`);
            logSink.push(`[${who}] ${msg.line}`);
            break;
        case "op": {
            let result, error;
            try {
                if (!canWrite(entry.userId, msg.op)) {
                    throw new Error(`User lacks permission: ${msg.op.action} ${msg.op.coll}${msg.op.embeddedName ? "." + msg.op.embeddedName : ""}`);
                }
                const applied = applyOp(entry.userId, msg.op);
                result = applied.result;
                const audience = msg.op.coll === "ChatMessage" && msg.op.action === "create"
                    ? chatAudience(msg.op.data[0] ?? {})
                    : null;
                broadcast(applied.broadcast, { audience });
            } catch (err) {
                error = err.message;
                permissionDenials.push({ who, op: `${msg.op.action} ${msg.op.coll}`, error });
            }
            entry.proc.send({ t: "ack", id: msg.id, ok: !error, result, error });
            break;
        }
        case "setting": {
            let error;
            if (!isGM(entry.userId)) {
                error = "User lacks permission to update world Setting";
                permissionDenials.push({ who, op: `setting ${msg.key}`, error });
            } else {
                world.settings[msg.key] = msg.value;
                broadcast({ t: "settingApplied", key: msg.key, value: msg.value, userId: entry.userId });
            }
            entry.proc.send({ t: "ack", id: msg.id, ok: !error, result: msg.value, error });
            break;
        }
        case "socket":
            socketTraffic.push({ from: who, channel: msg.channel, size: JSON.stringify(msg.args ?? []).length });
            broadcast({ t: "socketMsg", channel: msg.channel, args: msg.args, senderId: entry.userId }, { except: who });
            break;
        case "evalResult": {
            const p = evalPending.get(msg.id);
            if (p) { evalPending.delete(msg.id); msg.ok ? p.resolve(msg.value) : p.reject(new Error(msg.value)); }
            break;
        }
    }
}

const logSink = [];
const permissionDenials = [];
const socketTraffic = [];

/* --------------------------- scenario API --------------------------------- */

function handleFor(who) {
    const entry = clients.get(who);
    return {
        who,
        userId: entry.userId,
        eval(code, { timeout = 30000 } = {}) {
            const id = `ev${++evalSeq}`;
            return new Promise((resolve, reject) => {
                const timer = setTimeout(() => { evalPending.delete(id); reject(new Error(`eval timeout on ${who}: ${code.slice(0, 120)}`)); }, timeout);
                evalPending.set(id, {
                    resolve: v => { clearTimeout(timer); resolve(v); },
                    reject: e => { clearTimeout(timer); reject(e); }
                });
                entry.proc.send({ t: "eval", id, code });
            });
        }
    };
}

const results = [];
function check(name, ok, details = "") {
    results.push({ name, ok: !!ok, details: String(details).slice(0, 2000) });
    console.log(`${ok ? "  PASS" : "! FAIL"}  ${name}${details && !ok ? " — " + String(details).slice(0, 400) : ""}`);
}

const settle = (ms = 200) => new Promise(r => setTimeout(r, ms));

/* ------------------------------- main ------------------------------------- */

async function main() {
    spawnClient("gm", IDS.gm);
    spawnClient("p1", IDS.p1);
    spawnClient("p2", IDS.p2);

    const boots = await Promise.all([...clients.keys()].map(w => clients.get(w).ready));
    const failed = [...bootInfo.entries()].filter(([, b]) => b.t === "bootFailed");
    for (const [who, info] of bootInfo) {
        if (info.t === "ready") {
            console.log(`[cluster] ${who} ready: drpg=${info.drpg} (api keys: ${info.drpgKeys}), module settings: ${info.settingsRegistered}`);
        }
    }
    if (failed.length) {
        console.log(`[cluster] ${failed.length} client(s) failed to boot; scenario continues to gather evidence.`);
    }

    const scenario = await import(url.pathToFileURL(path.resolve(scenarioPath)).href);
    const api = {
        gm: handleFor("gm"), p1: handleFor("p1"), p2: handleFor("p2"),
        check, settle, world, logSink, permissionDenials, socketTraffic, bootInfo, IDS,
        broadcastRaw: broadcast
    };
    const t0 = Date.now();
    try {
        await scenario.run(api);
    } catch (err) {
        check("scenario completed without throwing", false, err.stack);
    }
    const dt = Date.now() - t0;

    const passed = results.filter(r => r.ok).length;
    console.log(`\n[cluster] ${passed}/${results.length} checks passed in ${dt}ms`);
    const out = {
        scenario: scenarioPath, passed, total: results.length, ms: dt,
        results, permissionDenials, socketTraffic: socketTraffic.slice(0, 200),
        bootInfo: Object.fromEntries([...bootInfo.entries()].map(([k, v]) => [k, { t: v.t, drpg: v.drpg, settingsRegistered: v.settingsRegistered, error: v.error?.slice?.(0, 800) }]))
    };
    const outFile = path.join(HERE, "results", path.basename(scenarioPath).replace(/\.mjs$/, ".json"));
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, JSON.stringify(out, null, 2));
    console.log(`[cluster] results -> ${outFile}`);

    for (const { proc } of clients.values()) proc.send({ t: "shutdown" });
    setTimeout(() => process.exit(results.some(r => !r.ok) ? 1 : 0), 400).unref();
}

main().catch(err => { console.error("[cluster] fatal:", err); process.exit(3); });
