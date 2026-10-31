/**
 * The audience map (E65 C11, I11, E65-20): for every key the module posts, who reads it.
 * ---------------------------------------------------------------------------
 *     node tools/text-audience.mjs       writes audit/harness/results/text/audience.json, prints the counts
 *
 * Read off the scripts with espree (audit/harness/node_modules), the files tools/text-map.mjs reads, with its parse.
 *
 * THE SENDS. A call of one of the module's senders - utils.mjs's `announce`, `whisperToOwner`, `whisperToOwnerOnly`,
 * `whisperToGms`, murder-rules.mjs's `announceCrisis` (by the name a file imported it as), `ui.notifications.*` and
 * `ChatMessage.create` - and a call of a WRAPPER: a top-level function of the module whose own sender call hands on one
 * of its parameters (frisk.mjs's `cardTo(actor, content)`, murder-rules.mjs's two veiled helpers), whose callers are
 * then read as sends with the wrapper's readers - or with its caller's whisper list, where the wrapper reads the list
 * from a parameter (utils.mjs's `gmReport` through `privately`); wrappers of wrappers, to the end. A wrapper hands its
 * words on: the argument that carries them (a toast's message, a card's data, a whisper's content) names a parameter,
 * and the call spells no key itself. The senders' own bodies (utils.mjs's four and `privately`, murder-rules.mjs's two
 * veiled helpers) are not read as sends; announceCrisis's is, since it builds its card itself.
 *
 * THE KEYS of a send are those its arguments spell (a literal key, a template or a family's base matching keys, "by
 * prefix", as the screen map reads them), and those of the local variables of the same function the arguments name,
 * followed from variable to variable within that function (`hops`, the number of variables between the call and the
 * key: the slice's "one hop" is hops 1, and the counts give what each depth adds - on 31.10 1152 key-sends at hops 0,
 * 213 at 1, 59 beyond, of which announceCrisis's band names, two variables down, are three). A function's parameter, a
 * module-level const and another function's result are not followed, nor a window's answer (a DialogV2 call: its
 * buttons' labels are not what the send says). A template or a literal prefix gives a send's readers to the keys it
 * matches only when it names three segments (`DRPG.Murder.band.${band}`): `DRPG.Monocub.${choice}` matched the group's 54
 * keys and gave a dialog's choice the table's readers (MIN_SEGMENTS; read 31.10: with two, 1428 keys assigned and 183 of
 * them to more than one reader, with three 1219 and 133).
 *
 * THE READERS of a send, from its whisper list (`whisper:` in `announce`'s and `ChatMessage.create`'s data, in the
 * extra of the three whispers), read the same way through local variables:
 *   - `owner`    whisperToOwner / whisperToOwnerOnly: the actor's owners (whisperToOwner adds the GMs a copy: `copy`);
 *   - `gms`      whisperToGms, or `gmIds()` / `activeGmIds()` in a list;
 *   - `room`     `roomAudience(...)` (action-rolls.mjs: the GMs, the actor's player and everyone in the room);
 *   - `incident` `incidentAudienceIds(...)` (incident-store.mjs: the incident's cast as it may know it);
 *   - `everyone` a card with no whisper list (the world voice);
 *   - `browser`  a notification: this browser's user alone;
 *   - `one`      a list of one id written in place (`[sender.id]`, `[game.user.id]`);
 *   - `list`     any other list (a parameter, a list built from data): its readers are not read here;
 *   - `none`     an empty list written in place: utils.mjs's `privately` posts no such card (nobody to read it).
 * A whisper list that is a conditional gives both branches (`flag`: the readers depend on a value at run time); a
 * list built of several (`[...gmIds(), ...incidentAudienceIds(state)]`) gives each. A `filter` of a list gives the
 * list's readers, which can be more than it reaches: murder-rules.mjs's `tellIncidentClosed` sends
 * DRPG.Murder.closedVictimYou to the victim's owners filtered out of the incident's audience, read here as `incident`.
 *
 * MORE THAN ONE READER (T16's subject, tests-text.mjs `secondPersonToMany`): `room`, `incident` and `everyone` - a
 * card several people read at once. `owner` is one person with the GM's copy beside it, `gms` the GM role, `browser`
 * and `one` one person; `list` is not judged and is counted apart (`maybe`).
 *
 * THE NOTICE HISTORY (A7): every card and notification this browser showed, kept for this user - "player and GM, each
 * their own" - so a key the history window says itself (notice-history-app.mjs, notice-history.mjs) has the reader
 * `own`, one person, and a card it keeps a copy of keeps the readers it was sent to.
 *
 * `unassigned`: the keys of en.json, pl.json and config.mjs's prose that no send reaches - the windows' own labels for
 * most (the screen map's subject, not this one).
 */

import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { loadEspree, moduleKeys, moduleScripts, parseScripts, eachChild, dotted, keysOfLiteral } from "./text-map.mjs";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");

/* The module's senders by their exported name, and what each is handed (the index of its data or extra argument). */
export const SENDERS = Object.freeze({
    announce: { data: 0 }, announceCrisis: { crisis: true }, whisperToOwner: { reader: "owner", copy: "gms", extra: 2 },
    whisperToOwnerOnly: { reader: "owner", extra: 2 }, whisperToGms: { reader: "gms", extra: 1 }
});
export const MANY = Object.freeze(["room", "incident", "everyone"]);
export const NOTICE_HISTORY = Object.freeze({ files: Object.freeze(["scripts/notice-history-app.mjs", "scripts/notice-history.mjs"]), readers: "player and GM, each their own" });
const MAX_HOPS = 6;
/* A prefix must name a group and a part of it ("DRPG.Murder.band.", 3 segments) before it gives a send's readers to the keys
   it matches (the header's reading). The screen map keeps 2: a screen that names a group's keys by prefix shows them. */
const MIN_SEGMENTS = 3;
/* A call whose result is no text: a window's answer (DialogV2 and its kin). */
const NOT_SENT = /(?:^|\.)(?:DialogV2|wait|prompt|confirm|input)(?:\.|$)/;
/* Where the senders are defined: their own bodies post through Foundry and are no wrappers. */
const SENDER_FILES = Object.freeze(["scripts/utils.mjs", "scripts/murder-rules.mjs"]);
/* The argument that carries a send's words: a notification's message, a card's data, a whisper's content. */
const CONTENT_ARG = Object.freeze({ toast: 0, chat: 0, announce: 0, whisperToOwner: 1, whisperToOwnerOnly: 1, whisperToGms: 0 });

/* Every function node of a unit with its own locals (its parameters' names, and each `const`/`let` declared in it and not
   in a function inside it) - the scope a send is read in. */
function functionsOf(node) {
    const out = [];
    const isFn = n => n.type === "FunctionDeclaration" || n.type === "FunctionExpression" || n.type === "ArrowFunctionExpression";
    const visit = n => {
        if (isFn(n)) {
            const params = new Set(), locals = new Map();
            const names = p => { if (!p) return; if (p.type === "Identifier") params.add(p.name); else if (p.type === "AssignmentPattern") names(p.left);
                else if (p.type === "ObjectPattern") p.properties.forEach(q => names(q.value ?? q.argument)); else if (p.type === "ArrayPattern") p.elements.forEach(names);
                else if (p.type === "RestElement") names(p.argument); };
            n.params.forEach(names);
            const own = m => {
                if (m !== n && isFn(m)) return;
                if (m.type === "VariableDeclarator" && m.id.type === "Identifier" && m.init) locals.set(m.id.name, m.init);
                eachChild(m, own);
            };
            eachChild(n, own);
            out.push({ node: n, params, locals });
        }
        eachChild(n, visit);
    };
    visit(node);
    return out;
}

/** The readers of a whisper expression, through the function's locals: `{ readers: Set, flag }`. */
function readersOf(expr, fn, depth = 0) {
    const out = new Set();
    let flag = false;
    const go = (e, d) => {
        if (!e) return;
        if (e.type === "ChainExpression") return go(e.expression, d);
        if (e.type === "ConditionalExpression") { flag = true; go(e.consequent, d); go(e.alternate, d); return; }
        if (e.type === "LogicalExpression") { go(e.left, d); go(e.right, d); return; }
        if (e.type === "AwaitExpression") return go(e.argument, d);
        if (e.type === "CallExpression") {
            const callee = dotted(e.callee) ?? "";
            const last = callee.split(".").pop();
            if (last === "roomAudience") { out.add("room"); return; }
            if (last === "incidentAudienceIds") { out.add("incident"); return; }
            if (last === "gmIds" || last === "activeGmIds") { out.add("gms"); return; }
            if (callee === "Array.from" || last === "filter" || last === "concat") { go(e.arguments[0], d); if (callee !== "Array.from") go(e.callee.object, d); return; }
            out.add("list");
            return;
        }
        if (e.type === "NewExpression" && dotted(e.callee) === "Set") return go(e.arguments[0], d);
        if (e.type === "ArrayExpression") {
            const spread = e.elements.filter(x => x?.type === "SpreadElement"), plain = e.elements.filter(x => x && x.type !== "SpreadElement");
            spread.forEach(x => go(x.argument, d));
            if (plain.length === 1 && !spread.length) out.add("one");
            else if (plain.length) out.add("list");
            if (!e.elements.length) out.add("none");
            return;
        }
        if (e.type === "Identifier") {
            const init = fn?.locals.get(e.name);
            if (init && d < MAX_HOPS) return go(init, d + 1);
            out.add("list");
            return;
        }
        out.add("list");
    };
    go(expr, depth);
    return { readers: out, flag };
}

/* A property of an object literal (or of a local variable holding one): its value node, or undefined. */
function propertyOf(expr, name, fn) {
    let e = expr;
    /* Through a local variable, and through a call that wraps the data (`stamped({ ... })`): its first argument. */
    for (let d = 0; (e?.type === "Identifier" || e?.type === "CallExpression") && d < MAX_HOPS; d++) e = e.type === "Identifier" ? fn?.locals.get(e.name) : e.arguments[0];
    if (e?.type !== "ObjectExpression") return { known: false };
    const p = e.properties.find(q => q.type === "Property" && !q.computed && (q.key.name ?? q.key.value) === name);
    const spread = e.properties.some(q => q.type === "SpreadElement");
    return { known: true, value: p ? (p.shorthand ? p.value : p.value) : undefined, spread };
}

/* The keys an expression spells, through the function's locals: Map key -> { how, hops }. */
function keysOf(expr, fn, universe, keySet) {
    const out = new Map(), seen = new Set();
    const put = (k, how, hops) => { const was = out.get(k); if (!was || was.hops > hops || (was.hops === hops && how === "literal")) out.set(k, { how, hops }); };
    const go = (e, hops) => {
        const visit = n => {
            /* A window's answer is not what the call sends: a dialog's buttons and labels, its result held in a variable. A
               callback is read (`failed.map(key => game.i18n.localize(...))` builds a toast's list); measured 31.10, leaving
               callbacks out lost 63 such keys. */
            if (n.type === "CallExpression" && NOT_SENT.test(dotted(n.callee) ?? "")) return;
            if (n.type === "Literal" && typeof n.value === "string") keysOfLiteral(n.value, null, universe, keySet, false, MIN_SEGMENTS).forEach(([k, how]) => put(k, how, hops));
            else if (n.type === "TemplateLiteral") keysOfLiteral(null, n.quasis.map(q => q.value.cooked ?? ""), universe, keySet, false, MIN_SEGMENTS).forEach(([k, how]) => put(k, how, hops));
            else if (n.type === "Identifier") {
                const init = fn?.locals.get(n.name);
                if (init && !seen.has(n.name) && hops < MAX_HOPS) { seen.add(n.name); go(init, hops + 1); }
            }
            if (n.type === "MemberExpression" && !n.computed) { visit(n.object); return; }
            if (n.type === "Property" && !n.computed && !n.shorthand) { visit(n.value); return; }
            eachChild(n, visit);
        };
        visit(e);
    };
    go(expr, 0);
    return out;
}

/* Does an expression name one of the function's parameters (through its locals)? A wrapper hands it on. */
function namesParam(expr, fn) {
    let hit = false;
    const seen = new Set();
    const visit = n => {
        if (hit) return;
        if (n.type === "Identifier") {
            if (fn.params.has(n.name)) { hit = true; return; }
            const init = fn.locals.get(n.name);
            if (init && !seen.has(n.name)) { seen.add(n.name); visit(init); }
        }
        if (n.type === "MemberExpression" && !n.computed) { visit(n.object); return; }
        eachChild(n, visit);
    };
    visit(expr);
    return hit;
}

/**
 * The map: `{ counts, sends, keys, unassigned, wrappers, noticeHistory, problems }`; `keys` a Map key -> the sends that
 * reach it (`{ sender, file, line, readers, copy, flag, hops, how }`). Inputs as tools/text-map.mjs `buildScreenMap`.
 */
export function buildAudienceMap({ scripts, keys, espree } = {}) {
    const universe = [...new Set(keys)].sort(), keySet = new Set(universe);
    const { files, resolve, problems } = parseScripts(scripts, espree);
    const fnsOf = new Map();
    for (const [file, f] of files) fnsOf.set(file, f.units.flatMap(u => functionsOf(u.node).map(fn => ({ ...fn, unit: u }))));
    /* What a callee is: a sender by the name it was imported or declared as, a wrapper, or nothing. */
    const wrappers = new Map();   // "file:name" -> { readers, copy, flag, via }
    const kindOf = (file, callee) => {
        if (/^ui\.notifications\.\w+$/.test(callee)) return { kind: "toast" };
        if (/(?:^|\.)ChatMessage\.create$/.test(callee)) return { kind: "chat" };
        if (callee.includes(".")) return null;
        const f = files.get(file);
        const imp = f.imports.get(callee);
        const target = imp && imp.name !== "*" ? resolve(imp.from, imp.name) : f.units.find(u => u.name === callee);
        const name = imp ? imp.name : callee;
        if (Object.hasOwn(SENDERS, name) && (!target || SENDER_FILES.includes(target.file))) return { kind: "sender", name };
        if (target && wrappers.has(`${target.file}:${target.name}`)) return { kind: "wrapper", id: `${target.file}:${target.name}`, w: wrappers.get(`${target.file}:${target.name}`) };
        return null;
    };
    /* A call's readers by its kind and arguments, in the function that holds it. */
    const readersOfCall = (k, call, fn) => {
        const arg = i => call.arguments[i];
        const fromWhisper = (holder, base) => {
            const p = propertyOf(holder, "whisper", fn);
            if (p.known && p.value !== undefined) return readersOf(p.value, fn);
            if (p.known && !p.spread) return { readers: new Set(base), flag: false };
            return { readers: new Set(["list"]), flag: false, unread: true };
        };
        if (k.kind === "toast") return { readers: new Set(["browser"]), flag: false };
        if (k.kind === "chat") return fromWhisper(arg(0), ["everyone"]);
        if (k.kind === "wrapper") {
            /* A wrapper that hands on its caller's data (utils.mjs's `privately`, `gmReport`): the caller's whisper list. */
            if (Number.isInteger(k.w.whisperFrom)) {
                const holder = arg(k.w.whisperFrom);
                return holder ? { ...fromWhisper(holder, k.w.base), copy: k.w.copy } : { readers: new Set(k.w.base), flag: false, copy: k.w.copy };
            }
            return { readers: new Set(k.w.readers), flag: k.w.flag, copy: k.w.copy };
        }
        const def = SENDERS[k.name];
        if (def.crisis) return null;   // announceCrisis posts through its own `announce`, read where it stands
        if (def.data !== undefined) return fromWhisper(arg(def.data), ["everyone"]);
        const extra = arg(def.extra);
        if (extra) { const p = propertyOf(extra, "whisper", fn); if (p.known && p.value !== undefined) return readersOf(p.value, fn); }
        return { readers: new Set([def.reader]), flag: false, copy: def.copy ?? null };
    };
    /* The calls of every function, each with its kind. */
    const callsIn = (file, fn) => {
        const out = [];
        const visit = n => {
            if (n !== fn.node && (n.type === "FunctionDeclaration" || n.type === "FunctionExpression" || n.type === "ArrowFunctionExpression")) return;
            if (n.type === "CallExpression") {
                const callee = dotted(n.callee);
                if (callee !== null) out.push({ call: n, callee });
            }
            eachChild(n, visit);
        };
        eachChild(fn.node, visit);
        return out;
    };
    /* Wrappers, to the end: a top-level function whose send hands on one of its parameters. */
    let grew = true, rounds = 0;
    while (grew && rounds < 20) {
        grew = false; rounds++;
        for (const [file, fns] of fnsOf) {
            for (const fn of fns) {
                const top = fn.unit.node === fn.node || fn.unit.node.init === fn.node;
                const id = `${file}:${fn.unit.name}`;
                if (!top || wrappers.has(id) || !fn.params.size || (SENDER_FILES.includes(file) && Object.hasOwn(SENDERS, fn.unit.name))) continue;
                for (const { call, callee } of callsIn(file, fn)) {
                    const k = kindOf(file, callee);
                    if (!k) continue;
                    const r = readersOfCall(k, call, fn);
                    /* It hands its words on: the argument that carries them names a parameter, and the call spells no key itself
                       (a send that names its own key and fills in a parameter is a send, not a wrapper). */
                    const at = CONTENT_ARG[k.kind === "sender" ? k.name : k.kind];
                    const carried = at === undefined ? call.arguments : [call.arguments[at]].filter(Boolean);
                    if (!r || !carried.some(a => namesParam(a, fn))) continue;
                    if (call.arguments.some(a => keysOf(a, fn, universe, keySet).size)) continue;
                    const readers = [...r.readers].filter(x => x !== "list" || r.readers.size === 1);
                    /* Its readers are its caller's when the list it reads is a parameter's: which one, by its place. */
                    const dataAt = k.kind === "wrapper" ? k.w.whisperFrom : k.kind === "chat" ? 0 : k.kind === "sender" ? (SENDERS[k.name].data ?? SENDERS[k.name].extra) : undefined;
                    const holder = Number.isInteger(dataAt) ? call.arguments[dataAt] : null;
                    const order = fn.node.params.map(q => (q.type === "Identifier" ? q.name : q.type === "AssignmentPattern" && q.left.type === "Identifier" ? q.left.name : null));
                    const whisperFrom = r.unread && holder ? order.findIndex(name => name && namesParam(holder, { ...fn, params: new Set([name]) })) : -1;
                    const base = k.kind === "chat" || k.name === "announce" ? ["everyone"] : k.kind === "wrapper" ? k.w.base : k.kind === "sender" ? [SENDERS[k.name].reader] : ["list"];
                    wrappers.set(id, { readers: readers.length ? readers : ["list"], copy: r.copy ?? null, flag: r.flag, via: k.kind === "wrapper" ? k.id : k.name ?? k.kind,
                        ...(whisperFrom >= 0 ? { whisperFrom, base } : {}) });
                    grew = true;
                    break;
                }
            }
        }
    }
    const sends = [], byKey = new Map();
    const counts = { files: files.size, sends: 0, keyed: 0, wrappers: wrappers.size, wrapperRounds: rounds, keys: universe.length, assigned: 0, unassigned: 0,
        hops: {}, bySender: {}, byReader: {}, flagged: 0, unread: 0, many: 0, maybe: 0 };
    for (const [file, fns] of fnsOf) {
        for (const fn of fns) {
            /* A sender's own body (utils.mjs's four and `privately`, murder-rules.mjs's veiled two) posts what its caller hands it;
               announceCrisis builds its card itself, so its body is read. */
            if (SENDER_FILES.includes(file) && ((Object.hasOwn(SENDERS, fn.unit.name) && !SENDERS[fn.unit.name].crisis) || fn.unit.name === "privately")) continue;
            for (const { call, callee } of callsIn(file, fn)) {
                const k = kindOf(file, callee);
                if (!k) continue;
                const r = readersOfCall(k, call, fn);
                if (!r) continue;
                const sender = k.kind === "toast" ? "ui.notifications" : k.kind === "chat" ? "ChatMessage.create" : k.kind === "wrapper" ? `${k.id} (${k.w.via})` : k.name;
                const keysHere = new Map();
                for (const a of call.arguments) for (const [key, v] of keysOf(a, fn, universe, keySet)) if (!keysHere.has(key) || keysHere.get(key).hops > v.hops) keysHere.set(key, v);
                counts.sends++;
                if (keysHere.size) counts.keyed++;
                if (r.flag) counts.flagged++;
                if (r.unread) counts.unread++;
                const row = { sender, file, line: call.loc.start.line, unit: fn.unit.name, readers: [...r.readers].sort(), copy: r.copy ?? null, flag: r.flag, keys: keysHere.size };
                sends.push(row);
                const label = k.kind === "wrapper" ? "wrapper" : sender;
                counts.bySender[label] = counts.bySender[label] ?? { sends: 0, keys: 0 };
                counts.bySender[label].sends++;
                for (const [key, v] of keysHere) {
                    if (!byKey.has(key)) byKey.set(key, []);
                    byKey.get(key).push({ sender, file, line: row.line, readers: row.readers, copy: row.copy, flag: row.flag, hops: v.hops, how: v.how });
                    counts.hops[v.hops] = (counts.hops[v.hops] ?? 0) + 1;
                    counts.bySender[label].keys++;
                }
            }
        }
    }
    /* The notice history's own words: every key its two files spell, read by each user for themselves (A7). */
    const own = new Set();
    for (const file of NOTICE_HISTORY.files) {
        const f = files.get(file);
        if (!f) { problems.push(`${file} is not among the scripts read - the notice history's entry has no keys`); continue; }
        for (const u of f.units) for (const [key] of keysOf(u.node, null, universe, keySet)) own.add(key);
    }
    for (const key of own) {
        if (!byKey.has(key)) byKey.set(key, []);
        byKey.get(key).push({ sender: "the notice history", file: NOTICE_HISTORY.files[0], line: null, readers: ["own"], copy: null, flag: false, hops: 0, how: "literal", note: NOTICE_HISTORY.readers });
    }
    for (const [, list] of byKey) {
        const readers = new Set(list.flatMap(s => s.readers));
        for (const r of readers) counts.byReader[r] = (counts.byReader[r] ?? 0) + 1;
        if ([...readers].some(r => MANY.includes(r))) counts.many++;
        else if (readers.has("list")) counts.maybe++;
    }
    const unassigned = universe.filter(k => !byKey.has(k));
    counts.assigned = byKey.size; counts.unassigned = unassigned.length;
    return { counts, sends, keys: byKey, unassigned, wrappers: [...wrappers].map(([id, w]) => ({ id, ...w })), noticeHistory: { ...NOTICE_HISTORY, keys: own.size }, problems };
}

/** The map as audience.json writes it. */
export function audienceJson(map) {
    return {
        $comment: "Written by node tools/text-audience.mjs (E65 C11, E65-20); generated, never committed. See the tool's header for what it reads.",
        counts: map.counts, noticeHistory: map.noticeHistory, wrappers: map.wrappers,
        keys: Object.fromEntries([...map.keys].sort((a, b) => a[0].localeCompare(b[0]))), unassigned: map.unassigned, sends: map.sends, problems: map.problems
    };
}

if (process.argv[1] && path.resolve(process.argv[1]) === url.fileURLToPath(import.meta.url)) {
    const espree = loadEspree(REPO);
    if (!espree) { console.log("text-audience: espree is not installed - run `npm ci` in audit/harness first"); process.exit(2); }
    const { keys } = await moduleKeys(REPO);
    const map = buildAudienceMap({ scripts: moduleScripts(REPO), keys, espree });
    const dir = path.join(REPO, "audit", "harness", "results", "text");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "audience.json"), JSON.stringify(audienceJson(map), null, 1) + "\n");
    const c = map.counts;
    console.log(`text-audience: ${c.files} script(s); ${c.sends} send(s), ${c.keyed} with a key; ${c.wrappers} wrapper(s) in ${c.wrapperRounds} round(s); `
        + `keys ${c.keys}: ${c.assigned} assigned, ${c.unassigned} unassigned; more than one reader ${c.many}, a list not read ${c.maybe}; `
        + `whisper lists with a flag ${c.flagged}, data not read ${c.unread}`);
    console.log(`text-audience: by sender (sends/keys): ${Object.entries(c.bySender).sort((a, b) => b[1].keys - a[1].keys).map(([s, v]) => `${s} ${v.sends}/${v.keys}`).join(", ")}`);
    console.log(`text-audience: keys by reader: ${Object.entries(c.byReader).sort((a, b) => b[1] - a[1]).map(([r, n]) => `${r} ${n}`).join(", ")}; keys by hops: ${Object.entries(c.hops).map(([h, n]) => `${h}: ${n}`).join(", ")}`);
    console.log(`text-audience: the notice history: ${map.noticeHistory.keys} key(s), "${map.noticeHistory.readers}"`);
    for (const p of map.problems) console.log(`text-audience: problem: ${p}`);
    console.log(`text-audience: wrote ${path.relative(REPO, path.join(dir, "audience.json"))}`);
    process.exitCode = map.problems.length ? 1 : 0;
}
