/**
 * The fuzz of the requests a GM's client judges, and of every other module socket packet (E43, 13.11.2026; the plan's
 * item 3, its "31-fuzz", built into scenario 30 because no new scenario number is taken).
 *
 * WHAT IS SENT. Every action of the four tables the primary GM judges (bridge-table.mjs BRIDGE_ACTIONS, traps.mjs
 * TRAP_ACTIONS, search-tokens.mjs SEARCH_ACTIONS, private-rolls.mjs ROLL_ACTIONS), read off the GM's own module, each
 * in `SHAPES` - built from the fields the declaration's whitelist names (`sanitize.fields`): nothing but the action;
 * every field null; every field of a type it is not; every field too long or too big; prototype keys beside them; and
 * every id a plausible one that names nothing. And every other packet name a module listener reads (`otherActions`, off
 * the source: `action === "x"` and the wire constants), in the same junk shapes, to every browser. All from one player's
 * console, `game.socket.emit` as any console can, with another player's id in the packet's own `userId` claim.
 *
 * WHAT IS MEASURED. The world: no document and no world setting written while the packets are judged, beside a quiet
 * window of the same length before them (the module's own clock and stores write as they always do; only a write the
 * quiet window does not hold is counted). The browsers: no exception escaped the module on any of them
 * (`globalThis.__errors`, the shim's and the client's record). The asker: each table request that waits on an answer
 * (`answer` not "none") with a request id is answered - a refusal with a reason code of the closed list, or, where its
 * whitelist turned junk into a harmless request, an acknowledgement or a done - and none is "the handler failed" (a throw
 * the runner caught; a reason, but one the run never meant to give). Each refusal is in the GM's log, as every refusal
 * of a table is (`sessionFailures`).
 *
 * What it does not measure: what a request with valid ids but a wrong owner does (the hostile-client matrix, scenario
 * 33's, does), what a GM's console may do (a GM is trusted), and anything a real server would refuse before the module
 * sees it (Foundry's own socket rules are the shim's: lib/shim.mjs).
 */
import fs from "node:fs";
import path from "node:path";

const MOD = "danganronpa-rpg";
const SOCKET = `module.${MOD}`;
const J = value => JSON.stringify(value);

/** The packet shapes a table action is sent in, by name: each a function of the declaration's fields. */
export const SHAPES = Object.freeze({
    bare: () => ({}),
    nulls: fields => Object.fromEntries(Object.keys(fields).map(f => [f, null])),
    types: fields => Object.fromEntries(Object.entries(fields).map(([f, kind]) => [f,
        kind === "id" ? { id: "x" } : kind === "text" ? ["x", { y: 1 }] : kind === "num" ? "NaN" : kind === "bool" ? { yes: true }
            : kind === "oneOf" ? 12345 : { nested: { deep: [1, [2, [3]]] } }])),
    huge: fields => Object.fromEntries(Object.entries(fields).map(([f, kind]) => [f,
        kind === "id" ? "F".repeat(129) : kind === "num" ? 1e308 : kind === "bool" ? 1e308 : "x".repeat(200000)])),
    ghost: fields => Object.fromEntries(Object.entries(fields).map(([f, kind]) => [f,
        kind === "id" ? "FUZZGHOST0000000" : kind === "num" ? 1 : kind === "bool" ? true : kind === "text" ? "fuzz" : "FUZZGHOST0000000"]))
});

/**
 * The prototype keys a shape is sent with: an own `__proto__` and `constructor`, as JSON.parse makes them, so a merge
 * (`foundry.utils.mergeObject`, a spread into a write) that walked into them would be seen. Added on the client, from text.
 */
const PROTO = `{"__proto__":{"isGM":true,"polluted":"FUZZ"},"constructor":{"prototype":{"polluted":"FUZZ"}}}`;

/**
 * Every other packet name a module listener may read, off the source of the files that listen on the module's socket
 * (`game.socket.on(`): each literal an `action ===` or `!==` compares with, each `const X = "a.b"` and each object member
 * `key: "a.b"` of those files (the wire constants, `VOICE.applied`, `GMS_ACTIONS.hello`), and bridge-wire.mjs's every
 * `ACTION_` constant. Broad on purpose: a name nobody reads costs one ignored packet. The four tables' own names are left
 * to the table half.
 */
export function otherActions(repo, tableNames) {
    const dir = path.join(repo, "scripts");
    const out = new Set();
    const dotted = /^[a-z][A-Za-z0-9]*\.[A-Za-z0-9.]+$/;
    for (const file of fs.readdirSync(dir).filter(f => f.endsWith(".mjs") && !f.startsWith("tests"))) {
        const src = fs.readFileSync(path.join(dir, file), "utf8");
        if (!src.includes("game.socket.on(") && file !== "bridge-wire.mjs" && file !== "voice-client.mjs" && file !== "gm-store.mjs") continue;
        for (const m of src.matchAll(/action\s*[!=]==\s*"([^"]+)"/g)) out.add(m[1]);
        for (const m of src.matchAll(/\bconst\s+[A-Z][A-Z0-9_]*\s*=\s*"([^"]+)"/g)) out.add(m[1]);
        for (const m of src.matchAll(/\b[a-z][A-Za-z0-9]*:\s*"([^"]+)"/g)) out.add(m[1]);
    }
    return [...out].filter(name => dotted.test(name) && !tableNames.has(name)).sort();
}

/**
 * Run the fuzz. `api` is the scenario's run() argument. Answers what each check needs; the caller writes the checks.
 */
export async function fuzz({ gm, p1, p2, p3, settle, opLog, settingLog, repoUrl, repo }, { batch = 20 } = {}) {
    const clients = { gm, p1, p2, p3 };
    const tables = await gm.eval(`
        const out = {};
        const read = (name, t) => { for (const [action, d] of Object.entries(t)) out[action] = { table: name, answer: d.answer ?? "ack",
            fields: d.sanitize?.fields ?? {}, queue: d.queue ?? null, quiet: Boolean(d.quiet) }; };
        read("bridge", (await import("${repoUrl}/scripts/bridge-table.mjs")).BRIDGE_ACTIONS);
        read("traps", (await import("${repoUrl}/scripts/traps.mjs")).TRAP_ACTIONS);
        read("search", (await import("${repoUrl}/scripts/search-tokens.mjs")).SEARCH_ACTIONS);
        read("rolls", (await import("${repoUrl}/scripts/private-rolls.mjs")).ROLL_ACTIONS);
        return out;`, { timeout: 60000 });
    const actions = Object.keys(tables).sort();
    const others = otherActions(repo, new Set(actions));

    await p1.eval(`
        globalThis.__fuzzHeard = [];
        if (!globalThis.__fuzzListening) {
            globalThis.__fuzzListening = true;
            game.socket.on("${SOCKET}", (payload, senderId) => {
                if (typeof payload?.requestId === "string" && payload.requestId.startsWith("fuzz-")
                    && ["bridge.ack", "bridge.done", "bridge.refused"].includes(payload.action))
                    globalThis.__fuzzHeard.push({ requestId: payload.requestId, action: payload.action, reason: payload.reason ?? payload.code ?? null,
                        what: payload.what ?? null, from: senderId });
            });
        }
        return true;`);
    const errorsOf = () => Promise.all(Object.entries(clients).map(async ([who, c]) => [who, await c.eval(`return (globalThis.__errors ?? []).map(e => e.where + ": " + e.message);`)]));
    /* The GM's log keeps 60 rows (utils.mjs SESSION_LOG_CAP) and drops what comes after, so it is read and emptied after
       each batch: `drain` answers each row's message as many times as it was counted. */
    const drain = () => gm.eval(`const U = await import("${repoUrl}/scripts/utils.mjs");
        const rows = U.sessionFailures().flatMap(e => Array(e.count ?? 1).fill(e.message)); U.clearSessionFailures(); return rows;`);
    const logged = [];
    const writesSince = (ops, sets) => [
        ...opLog.slice(ops).map(o => `${o.who} ${o.action} ${o.coll}${o.docId ? ` ${o.docId}` : ""}`),
        ...settingLog.slice(sets).map(s => `${s.who} setting ${s.key}`)];

    /* THE QUIET WINDOW. What the world is written with while nobody sends anything, for as long as the fuzz will take
       to settle a batch, so the module's own beat is not read as the fuzz's. */
    await settle(4000);
    const quietOps = opLog.length, quietSets = settingLog.length;
    await settle(3000);
    const background = new Set(writesSince(quietOps, quietSets));

    /* p1's own pre-session note is the one thing a junk packet may write (`note.save` takes its text as text and writes the
       sender's own note, whatever its `userId` claims): kept here and put back at the end. */
    const noteWas = await gm.eval(`const u = game.users.get(${J(p1.userId)}); return { held: Object.hasOwn(u.flags?.["${MOD}"] ?? {}, "preSessionNote"),
        value: foundry.utils.deepClone(u.flags?.["${MOD}"]?.preSessionNote ?? null) };`);
    const reasons = await gm.eval(`return [...(await import("${repoUrl}/scripts/bridge-guards.mjs")).REASONS];`);
    const errors0 = await errorsOf();
    await drain();
    const ops0 = opLog.length, sets0 = settingLog.length;
    const sent = [];
    const send = async (client, packets, recipients) => {
        await client.eval(`
            const packets = ${J(packets)};
            const recipients = ${recipients ? J(recipients) : `game.users.filter(u => u.active && u.id !== game.user.id).map(u => u.id)`};
            for (const p of packets) {
                const payload = Object.assign(JSON.parse(p.proto ? ${J(PROTO)} : "{}"), p.body);
                try { game.socket.emit("${SOCKET}", payload, { recipients }); } catch (err) { (globalThis.__fuzzEmitErrors ??= []).push(String(err)); }
            }
            return packets.length;`, { timeout: 60000 });
    };

    /* The tables: to the GMs, as a request is addressed (`ask` sends to the primary; every GM is sent here). */
    const gmIds = await gm.eval(`return game.users.filter(u => u.isGM && u.active).map(u => u.id);`);
    const tablePackets = [];
    for (const action of actions) {
        const { fields } = tables[action];
        for (const [shape, build] of Object.entries(SHAPES)) {
            for (const proto of [false, true]) {
                if (proto && shape !== "nulls" && shape !== "ghost") continue;
                const requestId = `fuzz-${action}-${shape}${proto ? "-proto" : ""}`;
                tablePackets.push({ action, shape: `${shape}${proto ? "+proto" : ""}`, requestId, proto,
                    body: { ...build(fields), action, requestId, userId: p2.userId } });
            }
        }
    }
    for (let i = 0; i < tablePackets.length; i += batch) {
        await send(p1, tablePackets.slice(i, i + batch), gmIds);
        sent.push(...tablePackets.slice(i, i + batch));
        await settle(600);
        logged.push(...await drain());
    }
    /* Every other listener: to every browser, from p1, in three shapes (bare, nulls of a guessed shape, junk types). */
    const junk = { userId: { id: 1 }, actorId: ["x"], tokenId: 7, sceneId: null, id: "FUZZGHOST0000000", value: "x".repeat(200000),
        data: { nested: [1, [2]] }, state: "junk", ids: "notAnArray", rows: 12, list: { a: 1 }, store: "__proto__", section: { x: 1 } };
    const otherPackets = others.flatMap(action => [
        { action, shape: "bare", proto: false, body: { action } },
        { action, shape: "junk", proto: false, body: { ...junk, action } },
        { action, shape: "junk+proto", proto: true, body: { ...junk, action } }]);
    for (let i = 0; i < otherPackets.length; i += batch) {
        await send(p1, otherPackets.slice(i, i + batch), null);
        await settle(600);
        logged.push(...await drain());
    }
    // Let the queues drain: a queued table request waits behind every write before it.
    const waits = p => tables[p.action].answer !== "none" && !tables[p.action].quiet;
    const actionOf = new Map(tablePackets.map(p => [p.requestId, p.action]));
    const want = tablePackets.filter(waits).map(p => p.requestId);
    const end = Date.now() + 60000;
    let heard = [];
    while (Date.now() < end) {
        heard = await p1.eval(`return globalThis.__fuzzHeard.slice();`);
        const settled = new Set(heard.filter(h => h.action !== "bridge.ack").map(h => h.requestId));
        const acked = new Set(heard.filter(h => h.action === "bridge.ack").map(h => h.requestId));
        if (want.every(id => settled.has(id) || (acked.has(id) && tables[actionOf.get(id)]?.answer === "ack"))) break;
        logged.push(...await drain());
        await settle(500);
    }
    await settle(1500);
    logged.push(...await drain());

    const errors1 = await errorsOf();
    const writes = writesSince(ops0, sets0).filter(w => !background.has(w));
    const newErrors = Object.fromEntries(errors1.map(([who, list]) => [who, list.slice((errors0.find(([w]) => w === who)?.[1] ?? []).length)]).filter(([, l]) => l.length));
    const newFailures = logged;
    const byId = new Map();
    for (const h of heard) {
        if (!byId.has(h.requestId)) byId.set(h.requestId, []);
        byId.get(h.requestId).push(h);
    }
    const unanswered = [], handlerFailed = [], answered = [], refused = [];
    for (const p of tablePackets) {
        const got = byId.get(p.requestId) ?? [];
        const decl = tables[p.action];
        if (!waits(p)) continue;
        const end = got.find(h => h.action !== "bridge.ack");
        if (end?.action === "bridge.refused") {
            refused.push(p.requestId);
            if (end.reason === "failed") handlerFailed.push(`${p.action} ${p.shape}`);
        } else if (end?.action === "bridge.done") answered.push(`${p.action} ${p.shape}`);
        else if (!got.length) unanswered.push(`${p.action} ${p.shape}`);
        else if (decl.answer !== "ack") unanswered.push(`${p.action} ${p.shape} (acknowledged, never answered)`);
    }
    const handlerFailedOnGm = newFailures.filter(m => /the handler failed/.test(m));
    const badCodes = heard.filter(h => h.action === "bridge.refused" && !reasons.includes(h.reason)).map(h => `${h.requestId} ${h.reason}`);
    const codes = {};
    for (const h of heard.filter(h => h.action === "bridge.refused")) codes[h.reason] = (codes[h.reason] ?? 0) + 1;
    const note = await gm.eval(`const u = game.users.get(${J(p1.userId)}), was = ${J(noteWas)};
        const { forcedDeletion } = await import("${repoUrl}/scripts/utils.mjs");
        if (was.held) await u.update({ "flags.${MOD}.preSessionNote": was.value });
        else if (Object.hasOwn(u.flags?.["${MOD}"] ?? {}, "preSessionNote")) {
            const gone = forcedDeletion();
            if (gone) await u.update({ "flags.${MOD}.preSessionNote": gone }); else await u.unsetFlag("${MOD}", "preSessionNote");
        }
        return { putBack: JSON.stringify(u.flags?.["${MOD}"]?.preSessionNote ?? null) === JSON.stringify(was.value) };`);
    const polluted = await Promise.all(Object.entries(clients).map(async ([who, c]) => [who, await c.eval(`return ({}).polluted ?? Object.prototype.isGM ?? null;`)]));
    return {
        counts: { actions: actions.length, tablePackets: tablePackets.length, others: others.length, otherPackets: otherPackets.length,
            refused: refused.length, answered: answered.length, gmLogged: newFailures.length },
        writes, errors: newErrors, badCodes, codes, note, p1: p1.userId, unanswered, handlerFailed, handlerFailedOnGm, answered,
        refusalsLogged: newFailures.filter(m => /^Refused a "/.test(m)).length,
        polluted: polluted.filter(([, v]) => v !== null), background: [...background], others
    };
}

/**
 * THE HOSTILE-CLIENT MATRIX (E43, 13.11.2026; the plan's item 3, its "32-case-security", built into scenario 33). Every
 * request of the four tables whose guards hold a character to its owner (`owns`, `ownsActorAt`) or the road to a GM
 * (`gmOnly`), sent from p1's console with every id it names filled as a real request would be - p2's student in each
 * field the owner's guard covers, its token and scene beside it - so that the one thing wrong with the packet is who sent
 * it. Each cell proves first that its packet reached the GM (a listener there counts it by request id), and then its
 * effect: no write the quiet window does not hold, a refusal told to p1 (but for a quiet declaration), and the refusal in
 * the GM's log naming a guard. A cell whose refusal names the guard the cell is about is `own`; one an earlier guard of
 * the same declaration refused first is `earlier` - refused all the same, and listed.
 *
 * `who` is what the scenario knows of the world: { victimActor, victimToken, sceneId } (p2's student, its token, the
 * scene).
 */
export async function hostileMatrix({ gm, p1, p2, settle, opLog, settingLog, repoUrl }, who, { batch = 20 } = {}) {
    const decls = await gm.eval(`
        const out = {};
        const read = t => { for (const [action, d] of Object.entries(t)) out[action] = { answer: d.answer ?? "ack", quiet: Boolean(d.quiet),
            fields: d.sanitize?.fields ?? {}, guards: (d.guards ?? []).map(g => ({ factory: g.factory ?? g.name ?? "?", covers: [...(g.covers ?? [])], why: g.why ?? null })) }; };
        read((await import("${repoUrl}/scripts/bridge-table.mjs")).BRIDGE_ACTIONS);
        read((await import("${repoUrl}/scripts/traps.mjs")).TRAP_ACTIONS);
        read((await import("${repoUrl}/scripts/search-tokens.mjs")).SEARCH_ACTIONS);
        read((await import("${repoUrl}/scripts/private-rolls.mjs")).ROLL_ACTIONS);
        return out;`, { timeout: 60000 });
    const cells = [];
    for (const [action, d] of Object.entries(decls).sort(([a], [b]) => a.localeCompare(b))) {
        const at = d.guards.findIndex(g => ["owns", "ownsActorAt", "gmOnly"].includes(g.factory) && (g.factory === "gmOnly" || g.covers.length));
        if (at < 0) continue;
        const guard = d.guards[at];
        const body = {};
        for (const [field, kind] of Object.entries(d.fields)) {
            body[field] = guard.covers.includes(field) || /actor/i.test(field) ? who.victimActor : /token/i.test(field) ? who.victimToken
                : /scene/i.test(field) ? who.sceneId : kind === "num" ? 1 : kind === "bool" ? false : kind === "text" ? "matrix" : kind === "id" ? "MATRIXGHOST00000" : null;
        }
        const requestId = `matrix-${action}`;
        cells.push({ action, kind: guard.factory === "gmOnly" ? "a GM's road" : "another's character", why: guard.why, earlier: d.guards.slice(0, at).map(g => g.why).filter(Boolean),
            quiet: d.quiet, answer: d.answer, requestId, body: { ...body, action, requestId, userId: p2.userId } });
    }
    await gm.eval(`globalThis.__matrixSeen = new Set();
        if (!globalThis.__matrixListening) { globalThis.__matrixListening = true;
            game.socket.on("${SOCKET}", payload => { if (typeof payload?.requestId === "string" && payload.requestId.startsWith("matrix-")) globalThis.__matrixSeen.add(payload.requestId); }); }
        return true;`);
    await p1.eval(`globalThis.__matrixHeard = [];
        if (!globalThis.__matrixHearing) { globalThis.__matrixHearing = true;
            game.socket.on("${SOCKET}", payload => { if (typeof payload?.requestId === "string" && payload.requestId.startsWith("matrix-")
                && ["bridge.ack", "bridge.done", "bridge.refused"].includes(payload.action)) globalThis.__matrixHeard.push({ requestId: payload.requestId, action: payload.action, reason: payload.reason ?? null }); }); }
        return true;`);
    const writes = (ops, sets) => [...opLog.slice(ops).map(o => `${o.who} ${o.action} ${o.coll}`), ...settingLog.slice(sets).map(s => `${s.who} setting ${s.key}`)];
    const q0 = opLog.length, s0 = settingLog.length;
    await settle(3000);
    const background = new Set(writes(q0, s0));
    // The GM's log keeps 60 rows (above): read and emptied after each batch.
    const drain = () => gm.eval(`const U = await import("${repoUrl}/scripts/utils.mjs");
        const rows = U.sessionFailures().flatMap(e => Array(e.count ?? 1).fill(e.message)); U.clearSessionFailures(); return rows;`);
    await drain();
    const failures = [];
    const ops0 = opLog.length, sets0 = settingLog.length;
    const gmIds = await gm.eval(`return game.users.filter(u => u.isGM && u.active).map(u => u.id);`);
    for (let i = 0; i < cells.length; i += batch) {
        await p1.eval(`for (const p of ${J(cells.slice(i, i + batch).map(c => c.body))}) game.socket.emit("${SOCKET}", p, { recipients: ${J(gmIds)} }); return true;`);
        await settle(800);
        failures.push(...await drain());
    }
    const end = Date.now() + 45000;
    const wanted = cells.filter(c => !c.quiet && c.answer !== "none").map(c => c.requestId);
    let heard = [];
    while (Date.now() < end) {
        heard = await p1.eval(`return globalThis.__matrixHeard.slice();`);
        failures.push(...await drain());
        if (wanted.every(id => heard.some(h => h.requestId === id && h.action !== "bridge.ack"))) break;
        await settle(500);
    }
    await settle(1000);
    failures.push(...await drain());
    const seen = new Set(await gm.eval(`return [...globalThis.__matrixSeen];`));
    const rows = cells.map(c => {
        const logged = failures.filter(m => m.startsWith(`Refused a "${c.action}" request`));
        const told = heard.filter(h => h.requestId === c.requestId);
        const by = logged.some(m => c.why && m.includes(c.why)) ? "own" : logged.some(m => c.earlier.some(w => m.includes(w))) ? "earlier"
            : logged.length ? "other" : "none";
        return { action: c.action, kind: c.kind, delivered: seen.has(c.requestId), logged: logged.length, by,
            told: told.map(h => `${h.action}${h.reason ? `:${h.reason}` : ""}`), quiet: c.quiet, answer: c.answer,
            reason: logged[0]?.replace(/^Refused a "[^"]+" request over the socket( from \S+)?: /, "").slice(0, 120) ?? null };
    });
    return { rows, writes: writes(ops0, sets0).filter(w => !background.has(w)), background: [...background] };
}
