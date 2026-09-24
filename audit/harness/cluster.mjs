/**
 * The "Foundry server": authoritative world store + permission gate + relay.
 * Forks four clients (gm, p1, p2, p3), seeds a world, runs a scenario file.
 *
 * Usage: node cluster.mjs scenarios/00-boot.mjs [--verbose]
 * Needs `npm ci` in this directory once (jsdom). DRPG_REPO points it at another
 * checkout; by default it boots the one it sits in.
 *
 * Exit code: 0 when every check passed, 1 when one failed, 2 when no file was
 * named, 3 when the cluster itself failed (no results file).
 */

import { fork } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import url from "node:url";
import * as U from "./lib/futil.mjs";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
/*
 * THE CHECKOUT THIS FILE IS IN, two directories up - it was a hard-coded
 * "/home/user/Danganronpa-RPG", and the scenarios imported from that path
 * directly. With DRPG_REPO set, the clients booted one tree and the scenarios'
 * own `import()`s loaded a second copy of the module, with its own state, from
 * another (audit S14-11). Resolved once here, handed to every client through
 * DRPG_REPO and to every scenario as `repoUrl`, so there is one tree.
 */
const REPO = path.resolve(process.env.DRPG_REPO || path.resolve(HERE, "../.."));
/** What a scenario puts in front of "/scripts/x.mjs" inside an eval. No trailing slash. */
const REPO_URL = url.pathToFileURL(REPO).href.replace(/\/$/, "");
const VERBOSE = process.argv.includes("--verbose");
const scenarioPath = process.argv[2];
if (!scenarioPath) { console.error("usage: node cluster.mjs <scenario.mjs>"); process.exit(2); }
/** When this run began, for the results file: a reader can tell this run's file from a stale one. */
const STARTED_AT = new Date().toISOString();

/* ----------------------------- world seed -------------------------------- */

const IDS = {
    gm: "USERGM0000000000", p1: "USERP10000000000", p2: "USERP20000000000", p3: "USERP30000000000",
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
            { _id: IDS.p2, name: "PlayerTwo", role: 1, active: true, character: IDS.botan, color: "#0000ff", flags: {} },
            { _id: IDS.p3, name: "PlayerThree", role: 1, active: true, character: IDS.chie, color: "#ffaa00", flags: {} }
        ],
        Actor: [
            studentActor(IDS.aiko, "Aiko Hoshino", IDS.p1),
            studentActor(IDS.botan, "Botan Kage", IDS.p2),
            studentActor(IDS.chie, "Chie Mori", IDS.p3),
            studentActor(IDS.daichi, "Daichi Sato", null),
            { ...studentActor("ACTORMONOKUMA000", "Monokuma", null), flags: { "danganronpa-rpg": { monokuma: true } } }
        ],
        Item: [], ChatMessage: [], RollTable: [], Playlist: [], Macro: [], JournalEntry: [], Folder: [],
        Scene: [{
            _id: IDS.scene, name: "Academy - Floor 1", active: true, width: 4000, height: 3000,
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

/* ------------------------------ clients ----------------------------------- */

const clients = new Map(); // who -> {proc, ready, userId}
const readiness = new Map();
const bootInfo = new Map();
let evalSeq = 0;
const evalPending = new Map();

/*
 * NO CLIENT OUTLIVES THE CLUSTER (E30, 24.09.2026).
 *
 * A fatal error here (`main().catch`, exit 3) ends this process without sending
 * "shutdown", and the clients did not end with it. Measured on a copy of this
 * tree with a scenario that throws while it is imported: exit 3, and all four
 * client-entry.mjs processes were still running ten seconds later with parent
 * PID 1 - the orphans that had to be found and killed by hand after runs. So
 * any client still alive when this process exits is killed here. An "exit"
 * handler does not run when the cluster is killed by a signal (the same copy,
 * cluster killed with SIGKILL mid-run: four orphans five seconds later); that
 * case is the client's own "disconnect" handler (client-entry.mjs), which ends
 * a client whose channel to the cluster has closed.
 */
process.on("exit", () => {
    for (const { proc } of clients.values()) {
        if (proc.exitCode !== null || proc.signalCode !== null) continue;
        try { proc.kill("SIGKILL"); } catch {}
    }
});

/*
 * PEAK MEMORY (E30, 24.09.2026). What a run costs in memory had never been
 * measured anywhere. Each client answers "shutdown" with `bye` and its
 * `process.resourceUsage().maxRSS` - KB, the peak over the client's whole life -
 * and the cluster waits at most 300 ms for the four before it writes the results.
 * A client that has not answered by then is `null` in `resources`, not a guess.
 */
const peakRSS = new Map();
let onBye = null;

function closeClients(ms) {
    return new Promise(resolve => {
        const waiting = new Set();
        const finish = () => { clearTimeout(timer); onBye = null; resolve(); };
        const timer = setTimeout(finish, ms);
        onBye = who => { waiting.delete(who); if (!waiting.size) finish(); };
        for (const [who, { proc }] of clients) {
            if (!proc.connected) continue;
            waiting.add(who);
            proc.send({ t: "shutdown" });
        }
        if (!waiting.size) finish();
    });
}

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

/*
 * EVERY DOCUMENT TO EVERY CLIENT, CHAT WHISPERS INCLUDED.
 *
 * Both of these used to cut a whispered ChatMessage out for anybody not on its
 * list, under a comment saying the real server does that. It does not: v14's
 * server broadcasts `modifyDocument` with no filter, and a whisper is hidden by
 * the client's own `ChatMessage#visible` (audit S14-04; the module measured 717
 * messages on a player's browser, the GM's count - secret.mjs). So a whispered
 * card whose words leaked into `content`, or whose speaker named the killer,
 * never reached the player here and every privacy check passed. The filter is
 * in `ChatMessageImpl#visible` in lib/shim.mjs now, where Foundry keeps it.
 */
function snapshotFor(userId) {
    const collections = {};
    for (const [name, docs] of Object.entries(world.collections)) collections[name] = docs.map(U.deepClone);
    return { t: "snapshot", collections, settings: { ...world.settings }, you: userId };
}

function broadcast(msg, { except = null } = {}) {
    for (const [who, entry] of clients) {
        if (who === except) continue;
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
                broadcast(applied.broadcast);
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
        case "socket": {
            socketTraffic.push({ from: who, channel: msg.channel, size: JSON.stringify(msg.args ?? []).length });
            // Foundry honours `{ recipients: [userId, ...] }` on the emit: the packet reaches
            // those clients and nobody else. The relay used to broadcast everything, which hid
            // any module bug that leaned on the address - and made addressed packets land on
            // the wrong player when a scenario measured who holds what.
            const recipients = Array.isArray(msg.args?.[1]?.recipients) ? new Set(msg.args[1].recipients) : null;
            for (const [other, target] of clients) {
                if (other === who) continue;
                if (recipients && !recipients.has(target.userId)) continue;
                target.proc.send({ t: "socketMsg", channel: msg.channel, args: msg.args, senderId: entry.userId });
            }
            break;
        }
        case "evalResult": {
            const p = evalPending.get(msg.id);
            if (p) { evalPending.delete(msg.id); msg.ok ? p.resolve(msg.value) : p.reject(new Error(msg.value)); }
            break;
        }
        case "bye":
            peakRSS.set(who, msg.maxRSS);
            onBye?.(who);
            break;
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
    console.log(`${ok ? "  PASS" : "! FAIL"}  ${name}${details && !ok ? " - " + String(details).slice(0, 400) : ""}`);
}

const settle = (ms = 200) => new Promise(r => setTimeout(r, ms));

/* ------------------------------- main ------------------------------------- */

async function main() {
    spawnClient("gm", IDS.gm);
    spawnClient("p1", IDS.p1);
    spawnClient("p2", IDS.p2);
    spawnClient("p3", IDS.p3);

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
        gm: handleFor("gm"), p1: handleFor("p1"), p2: handleFor("p2"), p3: handleFor("p3"),
        check, settle, world, logSink, permissionDenials, socketTraffic, bootInfo, IDS,
        // `import("${repoUrl}/scripts/x.mjs")` inside an eval reaches the SAME module
        // instance the client booted, because it is the same URL.
        repoUrl: REPO_URL,
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

    /* THE EXIT CODE SAYS WHAT THE CHECKS SAID (E30, 24.09.2026). It did not: on a
       copy of this tree with one check in 14-quiet inverted, the run printed
       "[cluster] 6/7 checks passed" and exited 0. The exit used to come from a
       timer started after "shutdown", but the timer is unref'd and the clients
       leave at once on "shutdown"; their channels were the last thing keeping
       this process alive, so Node ended it - with exit code 0 - before the timer
       fired. 11-killer-secrecy (5/6) and 40-flow (37/38), red on their known
       leaks, exited 0 in the 1.2.60 baseline run for the same reason, and a CI
       step reading the exit code would have been green whatever the checks
       said. `process.exitCode` is what Node exits with when nothing is left to
       run, so it is set before the clients go; the timer at the end stays as
       the hard stop for a client that does not. */
    process.exitCode = results.some(r => !r.ok) ? 1 : 0;
    await closeClients(300);
    const resources = Object.fromEntries([...clients.keys()].map(who => [who, peakRSS.get(who) ?? null]));
    resources.cluster = process.resourceUsage().maxRSS;
    console.log(`[cluster] peak memory, maxRSS in MB: ${Object.entries(resources).map(([who, kb]) => `${who} ${kb === null ? "no answer" : Math.round(kb / 1024)}`).join(", ")}`);

    const out = {
        scenario: scenarioPath, startedAt: STARTED_AT, finishedAt: new Date().toISOString(),
        passed, total: results.length, ms: dt, resources,
        results, permissionDenials, socketTraffic: socketTraffic.slice(0, 200),
        bootInfo: Object.fromEntries([...bootInfo.entries()].map(([k, v]) => [k, { t: v.t, drpg: v.drpg, settingsRegistered: v.settingsRegistered, error: v.error?.slice?.(0, 800) }]))
    };
    const outFile = path.join(HERE, "results", path.basename(scenarioPath).replace(/\.mjs$/, ".json"));
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, JSON.stringify(out, null, 2));
    console.log(`[cluster] results -> ${outFile}`);

    setTimeout(() => process.exit(), 400).unref();
}

main().catch(err => { console.error("[cluster] fatal:", err); process.exit(3); });
