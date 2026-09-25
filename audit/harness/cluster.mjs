/**
 * The "Foundry server": authoritative world store + permission gate + relay.
 * Forks four clients (gm, p1, p2, p3) and one per account the scenario declares,
 * seeds a world, runs a scenario file.
 *
 * Usage: node cluster.mjs scenarios/00-boot.mjs [--verbose]
 *        node cluster.mjs probes/07-apimap.mjs   (a probe - see probes/README.md)
 * Needs `npm ci` in this directory once (jsdom). DRPG_REPO points it at another
 * checkout; by default it boots the one it sits in.
 *
 * Exit code: 0 when every check passed, 1 when one failed, 2 when nothing ran
 * (no file named, or the file's layers give it to another runner), 3 when the
 * cluster itself failed (no results file). A probe exits 0 unless it threw.
 */

import { fork } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import url from "node:url";
import * as U from "./lib/futil.mjs";
import { IDS, world } from "./lib/seed.mjs";
import { readVersions } from "./lib/versions.mjs";
import { createCanary } from "./lib/canary.mjs";
import { kindOf, replacementOf } from "./lib/operators.mjs";

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

/*
 * RED ON PURPOSE, HELD TO A STAGE (E30, 24.09.2026). A known leak was a bracket in a
 * check's name - "[known leak S04-02, fixed in E06]" - and the check failed on every
 * run, so a scenario that should be green exited 1 and a new failure in it could
 * hide beside the old one. It is now an option: `check(name, ok, details, {
 * knownLeak: "S04-02", measured })` names an entry of known-leaks.json, and
 * `expectedRed: { stage, why }` a red that is not a leak. The verdict is
 * tools/stages.mjs's redVerdict, the rule the suite's expectedRed uses: an unknown
 * entry, a closing stage that has shipped, a check whose precondition failed
 * (`measured` not true) or one that stopped failing is a FAIL; only a measured
 * failure of a live entry is red. The registries are read from the harness's own
 * checkout; run against another tree (DRPG_REPO), whose scenarios may predate
 * them, a labelled check counts as a plain one and the run says so.
 */
const OWN_TREE = path.resolve(HERE, "../..");
const stagesLib = await import(url.pathToFileURL(path.join(OWN_TREE, "tools", "stages.mjs")).href);
let LEDGER = null, KNOWN_LEAKS = null, MODULE_VERSION = null;
try {
    LEDGER = stagesLib.loadStages(OWN_TREE);
    MODULE_VERSION = stagesLib.moduleVersion(REPO);
    const doc = JSON.parse(fs.readFileSync(path.join(HERE, "known-leaks.json"), "utf8"));
    if (doc.schema !== 1 || !Array.isArray(doc.leaks)) throw new Error("schema is not 1, or there is no leaks list");
    KNOWN_LEAKS = new Map(doc.leaks.map(entry => [entry.id, entry]));
} catch (err) {
    console.error(`[cluster] fatal: the registries could not be read: ${err.message}`);
    process.exit(3);
}
const VERDICTS = REPO === OWN_TREE;
/** The versions every client boots with, each with where it was read (lib/versions.mjs), and the live checks not yet run. */
const ENVIRONMENT = readVersions(REPO, process.env);

/* --------------------------- permission gate ------------------------------ */

function userRec(userId) { return world.collections.User.find(u => u._id === userId); }
/** The writer's role as the world holds it; 0 for a user the world does not have. */
function roleOf(userId) { return Number(userRec(userId)?.role ?? 0); }
/* A GM from role 3, as the shim's User#isGM (lib/shim.mjs, AN ASSISTANT IS A GM).
   This was role 4, so an Assistant's writes were a player's here (E30, 24.09.2026). */
function isGM(userId) { return roleOf(userId) >= 3; }

function actorOwned(actorData, userId) {
    const own = actorData?.ownership ?? { default: 0 };
    return (own[userId] ?? own.default ?? 0) >= 3;
}

function canWrite(userId, op) {
    const { action, coll: collName } = op;
    /*
     * USERS, AHEAD OF THE GM SHORTCUT (E30, 24.09.2026). Once an Assistant is a GM,
     * the shortcut below would let one raise itself to Gamemaster. What v14 allows
     * is modelled from memory, not read (LIVE-E30-04): a Gamemaster writes any user;
     * nobody else creates or deletes one; an update may not set a role above the
     * writer's own; a player updates only itself, an Assistant any user.
     */
    if (collName === "User") {
        const role = roleOf(userId);
        if (role >= 4) return true;
        if (action !== "update") return false;
        /* A role written through an operator (E30 review, 25.09.2026). A ForcedReplacement
           reaches here in its wire form, an object: Number() of it was NaN, NaN > role was
           false, and applyUpdate honoured the operator. Measured through this cluster, p1
           (role 1) updating itself: { role: 4 } refused; { role: _replace(4) } written, p1
           at role 4; { role: _del } written, p1 with no role. A replacement is read for the
           role it puts in; a deletion, or a value that is not a number, is refused. */
        const raw = U.expandObject(U.deepClone(op.changes ?? {})).role;
        if (raw !== undefined) {
            const kind = kindOf(raw);
            if (kind === "ForcedDeletion") return false;
            const next = Number(kind === "ForcedReplacement" ? replacementOf(raw) : raw);
            if (!Number.isFinite(next) || next > role) return false;
        }
        return role >= 3 || op.docId === userId;
    }
    if (isGM(userId)) return true;
    if (collName === "ChatMessage") {
        if (action === "create") return true;
        const doc = world.collections.ChatMessage.find(m => m._id === op.docId);
        return doc && (doc.author === userId);
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
    // everything not allowed above is refused; per-permission creation (TRUSTED journals, player macros) is not modelled
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

/**
 * Apply one permitted write to the world. `onLegacyKey(path, extra)` hears every
 * `-=` or `==` key the write carried, which changes nothing (futil.mjs applyUpdate).
 */
function applyOp(userId, op, onLegacyKey = null) {
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
            U.applyDocChanges(collName, doc, op.changes, { onLegacyKey: path => onLegacyKey?.(path) });
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
                U.applyUpdate(raw, changes, { onLegacyKey: path => onLegacyKey?.(path, { embeddedName: op.embeddedName, embeddedId: _id }) });
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
    /* WHAT A PLAYER WITH THE CONSOLE OPEN READS (E30, 24.09.2026): the client's
       stdout, stderr and log lines, kept per client with the phase for the canary
       (lib/canary.mjs), capped so a chatty run cannot grow without end. */
    const entry = { proc, userId, ready: new Promise(res => readiness.set(who, res)), console: [], consoleDropped: 0 };
    const keep = (stream, text) => {
        for (const line of String(text).split("\n")) {
            if (!line) continue;
            if (entry.console.length >= CONSOLE_CAP) { entry.consoleDropped++; continue; }
            entry.console.push({ phase: currentPhase, stream, text: line });
        }
    };
    proc.stdout.on("data", d => { keep("out", d); if (VERBOSE) process.stdout.write(`[${who}] ${d}`); });
    proc.stderr.on("data", d => { keep("err", d); process.stdout.write(`[${who}:err] ${d}`); });
    proc.on("message", msg => onClientMessage(who, entry, msg));
    /*
     * A CLIENT THAT EXITS BEFORE IT IS READY (E30 review, 25.09.2026). Readiness resolved
     * only on "ready" or "bootFailed", so main() waited on a client that exited first - at
     * import, before "hello". Measured on 00-boot with a preload that ends a client as it
     * starts: with p2 alone gone, the first packet relayed to its closed channel threw an
     * unhandled 'error' event and the cluster died 2.3 s in (exit 1, no results file);
     * with all four gone, nothing was left to wait on, and Node ended the cluster 0.1 s in
     * with exit 0, no results file and no check. The exit is now the client's failed boot,
     * and a client that has exited, at any point, is gone: no broadcast, packet or eval
     * goes to its closed channel, and a send that races the exit is logged, not thrown.
     */
    proc.on("exit", (code, signal) => {
        if (code) console.log(`[cluster] client ${who} exited with ${code}`);
        entry.gone = true;
        entry.goneWhy ??= `exited (${code ?? signal})`;
        if (!bootInfo.has(who)) onClientMessage(who, entry, { t: "bootFailed", error: `exited with ${code ?? signal} before it was ready` });
    });
    proc.on("error", err => console.log(`[cluster] client ${who}: ${err.message}`));
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
        if (who === except || entry.gone) continue;
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
            entry.console.length < CONSOLE_CAP ? entry.console.push({ phase: currentPhase, stream: "log", text: String(msg.line) }) : entry.consoleDropped++;
            if (VERBOSE || /FAILED|UNCAUGHT|REJECTION|threw|error/i.test(msg.line)) console.log(`[${who}] ${msg.line}`);
            logSink.push(`[${who}] ${msg.line}`);
            break;
        case "op": {
            let result, error;
            try {
                if (!canWrite(entry.userId, msg.op)) {
                    throw new Error(`User lacks permission: ${msg.op.action} ${msg.op.coll}${msg.op.embeddedName ? "." + msg.op.embeddedName : ""}`);
                }
                const applied = applyOp(entry.userId, msg.op, (path, extra = {}) => reportLegacyKey({
                    who, where: msg.op.action, coll: msg.op.coll, docId: msg.op.docId ?? null, ...extra, path
                }));
                result = applied.result;
                opLog.push({ who, action: msg.op.action, coll: msg.op.coll, docId: msg.op.docId ?? null,
                    embeddedName: msg.op.embeddedName ?? null, at: Date.now() });
                broadcast(applied.broadcast);
            } catch (err) {
                error = err.message;
                permissionDenials.push({ who, op: `${msg.op.action} ${msg.op.coll}`, error });
            }
            entry.proc.send({ t: "ack", id: msg.id, ok: !error, result, error });
            break;
        }
        case "setting": {
            // From role 3: v14's SETTINGS_MODIFY is given to Assistants by default, as far
            // as can be said without it here (LIVE-E30-04).
            let error;
            if (!isGM(entry.userId)) {
                error = "User lacks permission to update world Setting";
                permissionDenials.push({ who, op: `setting ${msg.key}`, error });
            } else {
                world.settings[msg.key] = msg.value;
                settingLog.push({ who, key: msg.key, at: Date.now() });
                broadcast({ t: "settingApplied", key: msg.key, value: msg.value, userId: entry.userId });
            }
            entry.proc.send({ t: "ack", id: msg.id, ok: !error, result: msg.value, error });
            break;
        }
        case "socket": {
            // Foundry honours `{ recipients: [userId, ...] }` on the emit: the packet reaches
            // those clients and nobody else. The relay used to broadcast everything, which hid
            // any module bug that leaned on the address - and made addressed packets land on
            // the wrong player when a scenario measured who holds what.
            const recipients = Array.isArray(msg.args?.[1]?.recipients) ? new Set(msg.args[1].recipients) : null;
            socketTraffic.push({
                from: who, channel: msg.channel, size: JSON.stringify(msg.args ?? []).length,
                action: msg.args?.[0]?.action ?? null, to: recipients ? [...recipients] : "all"
            });
            for (const [other, target] of clients) {
                if (other === who || target.gone) continue;
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
        case "dumpResult": {
            const p = evalPending.get(msg.id);
            if (p) { evalPending.delete(msg.id); msg.error ? p.reject(new Error(msg.error)) : p.resolve(msg.value); }
            break;
        }
        case "bye":
            peakRSS.set(who, msg.maxRSS);
            onBye?.(who);
            break;
        case "legacyKey": {
            const { t, ...record } = msg;
            reportLegacyKey({ who, ...record });
            break;
        }
    }
}

const logSink = [];
const permissionDenials = [];
const socketTraffic = [];
/* WHO WROTE WHAT, AND WHO LEFT (E30, 24.09.2026). With two GM clients the question
   a check asks is not only "did it change" but "who wrote it, and how many times":
   every write the server applied, and every world setting, is logged with its
   writer. `disconnect(who)` takes a client off the table the way a closed browser
   does, so a scenario can watch the other GM take over. */
const opLog = [];
const settingLog = [];

/**
 * End one client and tell the others it left. Its process is asked to shut down
 * (as at the end of a run, so its peak memory is still recorded), and killed if
 * it has not gone in two seconds; the world marks the user inactive, and every
 * remaining client gets `userActivity`, on which client-entry.mjs sets the user
 * inactive and calls the `userConnected` hook with `false`. v14's own order of
 * those two steps is not known here (LIVE-E30-05). A client that has gone gets
 * no broadcast or packet, and its eval handle refuses.
 */
async function disconnect(who) {
    const entry = clients.get(who);
    if (!entry || entry.gone) return false;
    entry.gone = true;
    entry.goneWhy = "has disconnected";
    const exited = new Promise(resolve => {
        if (entry.proc.exitCode !== null || entry.proc.signalCode !== null) resolve();
        else entry.proc.once("exit", resolve);
    });
    if (entry.proc.connected) entry.proc.send({ t: "shutdown" });
    const timer = setTimeout(() => { try { entry.proc.kill("SIGKILL"); } catch {} }, 2000);
    await exited;
    clearTimeout(timer);
    const rec = userRec(entry.userId);
    if (rec) rec.active = false;
    broadcast({ t: "userActivity", userId: entry.userId, active: false });
    return true;
}

/*
 * EVERY '-=' AND '==' KEY A RUN WROTE (E30, 24.09.2026).
 *
 * A write that spells a deletion `-=key` (or a replacement `==key`) changes nothing
 * in this harness, as the module's own notes measured it on v14 (lib/operators.mjs;
 * whether v14 also warns is LIVE-E30-01), so each one is said here - on the log
 * whatever --verbose says, in the scenario api as `legacyKeys`, and in the results
 * file as `legacyKeysIgnored` - instead of passing as a write that worked. The one
 * kind that still deletes is foundry.utils.mergeObject's, a utility and not a
 * document write (futil.mjs); it is listed with `where` naming it.
 */
const legacyKeys = [];
function reportLegacyKey(record) {
    legacyKeys.push(record);
    const at = [record.who, record.coll, record.docId, record.embeddedName, record.embeddedId].filter(Boolean).join(" ");
    const spelling = /(?:^|\.)(-=|==)[^.]*$/.exec(record.path ?? "")?.[1] ?? "-=";
    console.log(record.where === "foundry.utils.mergeObject"
        ? `[harness] '${spelling}' deleted by foundry.utils.mergeObject, which is not a document write: ${at} ${record.path}`
        : `[harness] v14 ignores '${spelling}' (${record.where}): ${at} ${record.path}`);
}

/* --------------------------- scenario API --------------------------------- */

function handleFor(who) {
    const entry = clients.get(who);
    return {
        who,
        userId: entry.userId,
        eval(code, { timeout = 30000 } = {}) {
            if (entry.gone) return Promise.reject(new Error(`${who} ${entry.goneWhy ?? "has gone"}`));
            /* A scenario never plants its own hit: code carrying a marker this
               client may not hold is refused before it is sent (lib/canary.mjs). */
            const refused = canary?.forbiddenIn(code, who, entry.userId) ?? [];
            if (refused.length) return Promise.reject(new Error(`marker ${refused[0]} is not ${who}'s to hold`));
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

/*
 * PHASES AND FLOWS (E30, 24.09.2026). `phase(name, { flow })` names the stretch of
 * a scenario that follows, and the flow of scripts/tests-flows.mjs it drives; every
 * check after it carries both, until the next phase (a check's own `flow` option
 * wins). The results file sums them per flow and per phase, so "which scenario
 * drives this flow, and did it pass" is read off the run rather than off a list.
 * A flow the checkout's FLOWS does not know is a failed check: a typo would
 * otherwise tag nothing and look like coverage.
 */
let currentPhase = "start", currentFlow = null;
const phaseLog = [];
let knownFlows = null;
async function loadFlows() {
    try {
        const m = await import(url.pathToFileURL(path.join(REPO, "scripts", "tests-flows.mjs")).href);
        knownFlows = new Set(m.FLOWS.map(f => f.id));
    } catch {
        console.log(`[cluster] ${REPO} has no scripts/tests-flows.mjs: flow tags are not checked in this run`);
    }
}
function unknownFlow(flow, where) {
    if (flow && knownFlows && !knownFlows.has(flow)) {
        results.push({ name: `${where}: "${flow}" is a flow of scripts/tests-flows.mjs`, ok: false, status: "fail", details: "no such flow", phase: currentPhase });
        console.log(`! FAIL  ${where}: "${flow}" is not a flow of scripts/tests-flows.mjs`);
    }
}
function phase(name, { flow = null } = {}) {
    currentPhase = String(name);
    currentFlow = flow;
    phaseLog.push({ name: currentPhase, flow });
    console.log(`  ----  ${currentPhase}${flow ? ` [${flow}]` : ""}`);
    unknownFlow(flow, `phase "${currentPhase}"`);
    broadcast({ t: "phase", name: currentPhase });
}

/*
 * ONE BROWSER, WHOLE (E30, 24.09.2026): client-entry.mjs's dumpForCanary with this
 * cluster's record of the client's console beside it. A browser that does not
 * answer is a failed check, and the canary reads an empty dump - measured nothing,
 * and red for it.
 */
const CONSOLE_CAP = 20000;
let canary = null;
function dump(who) {
    const entry = clients.get(who);
    const empty = { who, userId: entry?.userId ?? null, wire: [], world: {}, settings: {}, storage: {}, dom: "", unread: true };
    if (!entry || entry.gone) {
        check(`could not read ${who}'s browser (measured nothing)`, false, entry ? `it ${entry.goneWhy ?? "has gone"}` : "no such client");
        return Promise.resolve(empty);
    }
    const id = `dump${++evalSeq}`;
    return new Promise(resolve => {
        const timer = setTimeout(() => {
            evalPending.delete(id);
            check(`could not read ${who}'s browser (measured nothing)`, false, "no answer in 30 s");
            resolve(empty);
        }, 30000);
        evalPending.set(id, {
            resolve: v => { clearTimeout(timer); resolve({ ...v, console: entry.console, consoleDropped: entry.consoleDropped }); },
            reject: e => { clearTimeout(timer); check(`could not read ${who}'s browser (measured nothing)`, false, e.message); resolve(empty); }
        });
        entry.proc.send({ t: "dump", id });
    });
}

const results = [];
/** The verdict on one check: `{ status: "pass"|"fail"|"expectedRed", reason, until? }`. */
function verdictOf(ok, opts) {
    const marked = opts.knownLeak !== undefined || opts.expectedRed !== undefined;
    if (!marked || !VERDICTS) return { status: ok ? "pass" : "fail", reason: "" };
    if (opts.knownLeak !== undefined) {
        const entry = KNOWN_LEAKS.get(opts.knownLeak);
        if (!entry) return { status: "fail", reason: `unknown known leak ${opts.knownLeak}: add it to audit/harness/known-leaks.json or drop the option` };
        const v = stagesLib.redVerdict({ ok, measured: opts.measured, stage: entry.closes ?? null, label: `known leak ${entry.id}`,
            foundryLimit: Boolean(entry.foundryLimit), deferred: Boolean(entry.deferred), stages: LEDGER, moduleVersion: MODULE_VERSION,
            undo: "delete its entry in audit/harness/known-leaks.json and the check's knownLeak option, in the commit that fixed it" });
        return { ...v, until: entry.closes ? `until ${entry.closes}` : entry.foundryLimit ? "a Foundry limit" : "deferred to 1.3.x (D27)" };
    }
    const red = opts.expectedRed ?? {};
    if (!/^E\d{2}$/.test(String(red.stage ?? "")) || !String(red.why ?? "").trim()) {
        return { status: "fail", reason: `expectedRed needs a stage and a reason: ${JSON.stringify(red)}` };
    }
    const v = stagesLib.redVerdict({ ok, measured: opts.measured, stage: red.stage, label: `expected red (${red.why})`,
        stages: LEDGER, moduleVersion: MODULE_VERSION });
    return { ...v, until: `until ${red.stage}` };
}
function check(name, ok, details = "", opts = {}) {
    const flow = opts.flow ?? currentFlow;
    const v = verdictOf(Boolean(ok), opts);
    results.push({ name, ok: !!ok, status: v.status, ...(v.reason ? { reason: v.reason } : {}),
        ...(opts.knownLeak !== undefined ? { knownLeak: opts.knownLeak } : {}), ...(v.until ? { until: v.until } : {}),
        details: String(details).slice(0, 2000), phase: currentPhase, ...(flow ? { flow } : {}) });
    if (v.status === "expectedRed") console.log(`  RED*  ${name} - ${opts.knownLeak !== undefined ? `known leak ${opts.knownLeak}, ` : ""}${v.until}`);
    else console.log(`${v.status === "pass" ? "  PASS" : "! FAIL"}  ${name}${v.reason ? ` - ${v.reason}` : ""}${details && v.status === "fail" ? " - " + String(details).slice(0, 400) : ""}`);
    if (opts.flow) unknownFlow(opts.flow, `check "${name}"`);
}

/** Checks and failures per flow and per phase, for the results file. */
function tally() {
    const flows = {}, phases = [];
    for (const r of results) {
        if (r.flow) {
            flows[r.flow] ??= { checks: 0, failed: 0 };
            flows[r.flow].checks++;
            if (r.status === "fail") flows[r.flow].failed++;
        }
    }
    for (const p of phaseLog) {
        const mine = results.filter(r => r.phase === p.name);
        if (!phases.some(q => q.name === p.name)) phases.push({ name: p.name, flow: p.flow, checks: mine.length, failed: mine.filter(r => r.status === "fail").length });
    }
    return { flows, phases };
}

/*
 * A NOTE IS NOT A CHECK (E30, 24.09.2026). Scenarios printed evidence by
 * handing it to a check that could not fail - `check(name, true, details)` -
 * 00-boot for each client's boot notifications, 12-social for the
 * forcePrivateRolls value; each such line added one to the passed count and
 * measured nothing. Where there was something to assert, the check now asserts
 * it (12-social); what is only worth seeing goes here instead (00-boot's
 * lists): printed with its details, kept under `notes` in the results file,
 * never counted.
 */
const notes = [];
function note(name, details = "") {
    notes.push({ name, details: String(details).slice(0, 2000) });
    console.log(`  NOTE  ${name}${details ? " - " + String(details).slice(0, 400) : ""}`);
}

const settle = (ms = 200) => new Promise(r => setTimeout(r, ms));

/* ------------------------------- layers ----------------------------------- */

/*
 * WHICH RUN A FILE BELONGS TO (E30, 24.09.2026).
 *
 * Every file this runs says so with `export const layers = [...]`. A scenario
 * takes "ci" (the headless gate), "local-gate" (the gate that runs in a real
 * Foundry, audit/live in the E30 plan) or both; a probe takes exactly
 * ["probe"] and lives in probes/ (probes/README.md). The six probes used to
 * sit among the scenarios as 02-07 and were counted like them.
 *
 * The line is read twice. A runner that picks files by layer should not have
 * to boot four clients to learn what a file is, so it reads the source with
 * LAYERS_RE and JSON-parses the match - which is why the line has to be a JSON
 * array written out. This file reads it the same way before any client is
 * forked, so a local-gate scenario exits 2 without a boot, and after the
 * import it compares that reading with what the module exports: a declaration
 * a source reader would miss or misread FAILs here, instead of being passed
 * over there without a word.
 */
const LAYERS_RE = /export const layers = (\[[^\]]*\])/;
const SCENARIO_LAYERS = ["ci", "local-gate"];

/** The layers line as a source reader sees it: `{ raw, value }`, `{ raw }` when it is not JSON, `{}` when absent. */
function layersLine(source) {
    const m = source.match(LAYERS_RE);
    if (!m) return {};
    try { return { raw: m[1], value: JSON.parse(m[1]) }; } catch { return { raw: m[1] }; }
}

/** Why a layers value is not one this harness knows, or null. */
function layersShapeProblem(layers) {
    if (!Array.isArray(layers) || !layers.length) return `layers must be a non-empty array, got ${JSON.stringify(layers)}`;
    if (layers.includes("probe")) return layers.length === 1 ? null : `"probe" stands alone, got ${JSON.stringify(layers)}`;
    const unknown = layers.filter(l => !SCENARIO_LAYERS.includes(l));
    if (unknown.length) return `unknown layer ${JSON.stringify(unknown)}: a scenario's layers are "ci", "local-gate" or both`;
    if (new Set(layers).size !== layers.length) return `a layer is named twice: ${JSON.stringify(layers)}`;
    return null;
}

/** Why the file's declaration is refused, or null. The export and its source line must agree. */
function layersProblem(exported, line) {
    if (exported === undefined && line.raw === undefined) {
        return 'no layers export - see audit/harness/README.md; a scenario declares export const layers = ["ci"] (or ["local-gate"], or both), a probe ["probe"]';
    }
    if (line.value === undefined) {
        return `the layers line must be a JSON array written out, e.g. export const layers = ["ci"], so a runner can read it without importing the file; the source has ${line.raw ?? "no such line"}`;
    }
    if (JSON.stringify(exported) !== JSON.stringify(line.value)) {
        return `the module exports layers ${JSON.stringify(exported)}, but its source line reads ${line.raw}`;
    }
    return layersShapeProblem(exported);
}

/* ------------------------------ accounts ---------------------------------- */

/*
 * USERS A SCENARIO ADDS (E30, 24.09.2026). The seed has one GM and three players
 * (lib/seed.mjs). A scenario that needs somebody else - 17-assistant's Assistant
 * GM, later a second GM - exports `accounts: [{ who, id, name, role, character,
 * color }]`: each becomes a world user before any client boots, gets a client of
 * its own, and is handed to `run` under `who`. A list this cannot seed adds nobody
 * and fails the run.
 */
let accountsProblem = null;

/** `taken`: the names run() is handed already - the API's keys, the four clients and `canary`. */
function seedAccounts(declared, taken) {
    if (declared === undefined) return [];
    const names = new Set(taken), ids = new Set(world.collections.User.map(u => u._id));
    const problems = Array.isArray(declared) ? [] : [`accounts must be an array, got ${JSON.stringify(declared)}`];
    for (const account of Array.isArray(declared) ? declared : []) {
        const { who, id, role } = account ?? {};
        if (typeof who !== "string" || !/^[a-z][a-z0-9]*$/.test(who) || names.has(who)) problems.push(`"${who}" is not a free lower-case name`);
        else if (typeof id !== "string" || !/^[A-Za-z0-9]{16}$/.test(id) || ids.has(id)) problems.push(`${who}: "${id}" is not a new sixteen-character id`);
        else if (!Number.isInteger(role) || role < 0 || role > 4) problems.push(`${who}: role ${JSON.stringify(role)} is not 0 to 4`);
        names.add(who);
        ids.add(id);
    }
    if (problems.length) {
        accountsProblem = problems.join("; ");
        return [];
    }
    for (const { who, id, name, role, character = null, color = "#888888" } of declared) {
        world.collections.User.push({ _id: id, name: name ?? who, role, active: true, character, color, flags: {} });
    }
    return declared;
}

/* ------------------------------- main ------------------------------------- */

async function main() {
    // The layers line, before any client is forked (WHICH RUN A FILE BELONGS TO).
    const scenarioFile = path.resolve(scenarioPath);
    const line = layersLine(fs.readFileSync(scenarioFile, "utf8"));
    if (line.value !== undefined && !layersShapeProblem(line.value)
        && !line.value.includes("ci") && !line.value.includes("probe")) {
        console.log(`[cluster] ${scenarioPath} declares layers ${line.raw}: it belongs to the local gate, which runs it in a real Foundry (audit/live), not to this harness. Nothing ran.`);
        process.exit(2);
    }

    /* The scenario is imported before any client is forked (E30, 24.09.2026): what
       it exports decides which users the world has, and a file that throws on
       import now ends the run before four browsers boot for nothing. */
    const scenario = await import(url.pathToFileURL(scenarioFile).href);
    /* What run() is handed, the clients' handles added once they are forked. An account's
       `who` may be none of these names (E30 review, 25.09.2026): the list of taken names was
       kept by hand, lacked phase, dump, canary and environment, and an account named `phase`
       got a client whose handle the function then replaced. */
    const api = {
        check, note, phase, settle, world, logSink, permissionDenials, socketTraffic, legacyKeys, opLog, settingLog, disconnect, bootInfo, IDS,
        environment: ENVIRONMENT,
        // `import("${repoUrl}/scripts/x.mjs")` inside an eval reaches the SAME module
        // instance the client booted, because it is the same URL.
        repoUrl: REPO_URL,
        broadcastRaw: broadcast,
        dump
    };
    const accounts = seedAccounts(scenario.accounts, [...Object.keys(api), "gm", "p1", "p2", "p3", "canary"]);
    await loadFlows();

    spawnClient("gm", IDS.gm);
    spawnClient("p1", IDS.p1);
    spawnClient("p2", IDS.p2);
    spawnClient("p3", IDS.p3);
    for (const account of accounts) spawnClient(account.who, account.id);

    const boots = await Promise.all([...clients.keys()].map(w => clients.get(w).ready));
    const failed = [...bootInfo.entries()].filter(([, b]) => b.t === "bootFailed");
    for (const [who, info] of bootInfo) {
        if (info.t === "ready") {
            const css = info.stylesheets;
            console.log(`[cluster] ${who} ready: drpg=${info.drpg} (api keys: ${info.drpgKeys}), module settings: ${info.settingsRegistered}`
                + (css ? `, stylesheets: ${css.files}/${css.of} (${css.rules} rules, ${css.ms} ms)` : ""));
        }
    }
    if (failed.length) {
        console.log(`[cluster] ${failed.length} client(s) failed to boot; scenario continues to gather evidence.`);
    }

    const layerProblem = layersProblem(scenario.layers, line);
    const probe = !layerProblem && scenario.layers[0] === "probe";
    Object.assign(api, { gm: handleFor("gm"), p1: handleFor("p1"), p2: handleFor("p2"), p3: handleFor("p3") },
        Object.fromEntries(accounts.map(account => [account.who, handleFor(account.who)])));
    canary = api.canary = createCanary({
        scenario: path.basename(scenarioPath).replace(/\.mjs$/, ""), check, dump, settle, repoUrl: REPO_URL,
        phase: () => currentPhase, gm: api.gm, players: [api.p1, api.p2, api.p3],
        knownLeaks: [...KNOWN_LEAKS.values()]
    });
    if (probe) {
        console.log(`[cluster] PROBE ${path.basename(scenarioPath)} - a tool, not a test: its lines record what it saw, nothing in it passes or fails, and it exits 0 unless it throws (probes/README.md)`);
    }
    if (layerProblem) check("the file declares its layers", false, layerProblem);
    if (accountsProblem) check("the file's accounts can be seeded", false, accountsProblem);

    // What arrives from here on is the scenario's; the clients recorded their boot as "boot".
    broadcast({ t: "phase", name: currentPhase });
    const t0 = Date.now();
    const checksBefore = results.length;
    let evidence, threw = false;
    try {
        evidence = await scenario.run(api);
    } catch (err) {
        threw = true;
        check("scenario completed without throwing", false, err.stack);
    }
    /* A SCENARIO THAT CHECKED NOTHING IS RED (E30, 24.09.2026). On a copy of the
       tree before this line, a scenario whose run() made no check printed
       "[cluster] 0/0 checks passed" and exited 0: green, having measured
       nothing. A probe is exempt - it measures nothing by definition - and so
       is a run that threw, which is red already. */
    if (!probe && !threw && results.length === checksBefore) {
        check("the scenario measured something", false, "no check() ran");
    }
    /* The canary's last word: a scan of whatever was planted since the last one, and
       a FAIL for a known leak this scenario is named to detect but never evaluated. */
    let canaryResult = null;
    if (!threw) {
        try { canaryResult = await canary.finish(results); }
        catch (err) { check("the canary finished its scan", false, err.stack); }
    }
    const dt = Date.now() - t0;

    const passed = results.filter(r => r.status === "pass").length;
    const reds = results.filter(r => r.status === "expectedRed");
    const failedCount = results.filter(r => r.status === "fail").length;
    const redNote = reds.length ? `, ${reds.length} expected red (${reds.map(r => `${r.knownLeak ?? "red"} ${r.until}`).join("; ")})` : "";
    if (!VERDICTS && results.some(r => r.knownLeak !== undefined)) {
        console.log(`[cluster] ${REPO} is not the harness's own tree: known-leak and expected-red options are counted as plain checks`);
    }
    console.log(probe
        ? `\n[cluster] probe: ${results.length} check line(s) and ${notes.length} note(s) recorded in ${dt}ms`
        : `\n[cluster] ${passed}/${results.length} checks passed${redNote}, ${failedCount} failed in ${dt}ms`);

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
       the hard stop for a client that does not. A probe's lines are records,
       not verdicts: it exits 1 only when it threw. */
    process.exitCode = probe ? (threw ? 1 : 0) : (failedCount > 0 ? 1 : 0);
    await closeClients(300);
    const resources = Object.fromEntries([...clients.keys()].map(who => [who, peakRSS.get(who) ?? null]));
    resources.cluster = process.resourceUsage().maxRSS;
    console.log(`[cluster] peak memory, maxRSS in MB: ${Object.entries(resources).map(([who, kb]) => `${who} ${kb === null ? "no answer" : Math.round(kb / 1024)}`).join(", ")}`);

    const out = {
        scenario: scenarioPath, kind: probe ? "probe" : "scenario", layers: scenario.layers ?? null,
        startedAt: STARTED_AT, finishedAt: new Date().toISOString(), environment: ENVIRONMENT,
        passed, expectedRed: reds.length, failed: failedCount, total: results.length, ms: dt, resources, ...tally(),
        knownLeaks: results.filter(r => r.knownLeak !== undefined).map(r => ({ id: r.knownLeak, verdict: r.status,
            closes: KNOWN_LEAKS.get(r.knownLeak)?.closes ?? null, check: r.name, ...(r.reason ? { reason: r.reason } : {}) })),
        // What run() returned: a probe's record, or a scenario's own evidence when it keeps
        // some (01-runtests keeps the suite's results list, which suite-diff --json reads).
        canary: canaryResult ?? { planted: 0 },
        results, notes, ...(probe ? { evidence: evidence ?? null } : evidence !== undefined ? { evidence } : {}),
        permissionDenials, socketTraffic: socketTraffic.slice(0, 200), legacyKeysIgnored: legacyKeys,
        opLog: opLog.slice(0, 500), settingLog: settingLog.slice(0, 500),
        bootInfo: Object.fromEntries([...bootInfo.entries()].map(([k, v]) => [k, { t: v.t, drpg: v.drpg, settingsRegistered: v.settingsRegistered, stylesheets: v.stylesheets ?? null, error: v.error?.slice?.(0, 800) }]))
    };
    // A probe's record never lands beside the scenarios' results, which a gate reads.
    const outFile = path.join(HERE, "results", probe ? "probes" : "", path.basename(scenarioPath).replace(/\.mjs$/, ".json"));
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, JSON.stringify(out, null, 2));
    console.log(`[cluster] results -> ${outFile}`);

    setTimeout(() => process.exit(), 400).unref();
}

main().catch(err => { console.error("[cluster] fatal:", err); process.exit(3); });
