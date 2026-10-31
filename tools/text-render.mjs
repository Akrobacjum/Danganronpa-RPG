/**
 * The render (E65 C10, E65-19): every string of the module filled the way a table fills it, for a reader.
 * ---------------------------------------------------------------------------
 *     node tools/text-render.mjs                 writes text-render.en.md, text-render.pl.md and text-render.pl.html
 *     node tools/text-render.mjs --pilot <file>  also writes text-render.pilot.html: the pilot's keys alone (C14)
 * Both into audit/harness/results/text/ (generated, never committed). The md and the sheet are laid out by the screen
 * map (tools/text-map.mjs, which needs espree from audit/harness: `npm ci` there), screen by screen, then the keys no
 * screen reaches; `renderAll` alone needs nothing but the language files, so `node tools/check.mjs text` runs T15
 * (tests-text.mjs `renderChecks`) on a render made in memory.
 *
 * WHAT IS RENDERED. Every key of en.json and config.mjs's English prose (`walkConfigProse`, keyed `DRPG.Config.*`) in
 * English, and every key of pl.json in Polish. A placeholder is filled by its name from PLACEHOLDERS: a woman's and a
 * man's name for a person, one room and one item of each Polish gender (with their English), 0, 1, 2, 5, 12, 22, 25
 * and 112 for a number, the module's own action and trait labels, each real DRPG.Calls.grants.* fragment for `what`,
 * the times of day, lists of names, rooms and traits through the module's list rule. A string is rendered as many
 * times as its longest list of values needs (eight with a number in it), each placeholder taking its values in turn;
 * a name PLACEHOLDERS does not know is left as written, `{x}`, and listed.
 *
 * THE MODULE'S RULES, COPIED HERE - KEEP IN STEP. Two rules of scripts/utils.mjs are copied, because utils.mjs does
 * not load in Node (it reads Foundry's globals): `plural` - the form is `Intl.PluralRules(<the module's language>)
 * .select(n)`, and `.other` when the family has no key for that form - and `listOf`, which joins with
 * `Intl.ListFormat(<language>, { style: "long", type: "conjunction" })`; here English is "en-US" (the slice's list
 * rule, "A, B, and C"; utils.mjs passes Foundry's language, "en", which formats the same) and Polish "pl" ("A, B i C").
 * If either changes in utils.mjs, change it here: R1058 shows T15 its fixture, not this copy against utils.mjs.
 * Foundry's `game.i18n.format` is copied as "a `{name}` with a value is replaced, any other is left": a name with
 * no fixture value stays `{name}` on purpose, so T15 can list it.
 *
 * A PLACEHOLDER WITH TWO MEANINGS gets one fixture value all the same (the slice's edge case): MEANINGS names those
 * read 31.10 off the files' own sentences, and the render's counts carry them, so a reader of the sheet knows that
 * `{what}` - a Call's grant here - is also "what was rolled" elsewhere.
 */

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");

export const RENDER_NS = Object.freeze([0, 1, 2, 5, 12, 22, 25, 112]);
const FAMILY_FORM = /\.(zero|one|two|few|many|other)$/;
const PLACEHOLDER = /\{(\w+)\}/g;
export const LOCALES = Object.freeze({ en: "en-US", pl: "pl" });

const WOMAN = "Aiko", MAN = "Daichi", THIRD = "Chie";
const both = values => Object.freeze({ en: values, pl: values });
const fixed = (en, pl) => Object.freeze({ en: [en], pl: [pl] });

/**
 * Each category: its names (read 31.10 off every `{name}` of en.json, pl.json and the prose: 240 names; a name's
 * category is what its sentences put there) and its values in each language - a list, or `from`, which reads the
 * module's own words out of the files handed in. `list: true` joins each value (an array) by the list rule.
 */
export const PLACEHOLDERS = Object.freeze({
    person: { names: ["name", "who", "actor", "target", "victim", "killer", "player", "student", "giver", "finder", "accused", "roller", "mastermind", "owner",
        "third", "gm", "user", "by", "account", "speaker"], values: both([WOMAN, MAN]), note: "a woman's name, then a man's: the Polish past tense agrees with it" },
    people: { names: ["names", "actors", "students", "players", "killers", "holders"], list: true, values: both([[WOMAN, MAN, THIRD], [WOMAN, MAN], [THIRD]]) },
    room: { names: ["room", "from", "to", "killerRoom", "victimRoom", "hall", "lair", "gather", "sealed", "region", "next"],
        values: Object.freeze({ en: ["Workshop", "Library", "Cinema"], pl: ["Warsztat", "Biblioteka", "Kino"] }), note: "one room of each Polish gender: m, f, n" },
    rooms: { names: ["rooms", "places"], list: true, values: Object.freeze({ en: [["Workshop", "Library", "Cinema"], ["Library"]], pl: [["Warsztat", "Biblioteka", "Kino"], ["Biblioteka"]] }) },
    scene: { names: ["scene", "floor", "title"], values: fixed("School, floor 1", "Szkoła, piętro 1") },
    scenes: { names: ["scenes"], list: true, values: Object.freeze({ en: [["School, floor 1", "Trial hall"]], pl: [["Szkoła, piętro 1", "Sala rozpraw"]] }) },
    item: { names: ["item", "bullet", "pool", "table", "project", "repair", "trace", "passage", "tile", "ultimate"],
        values: Object.freeze({ en: ["Kitchen Knife", "Rope", "Chair"], pl: ["Nóż kuchenny", "Lina", "Krzesło"] }), note: "one item of each Polish gender: m, f, n" },
    items: { names: ["items", "parts", "lost", "steps", "groups", "fields", "clauses", "cases", "modules", "flags", "stores"], list: true,
        values: Object.freeze({ en: [["Kitchen Knife", "Rope", "Chair"], ["Rope"]], pl: [["Nóż kuchenny", "Lina", "Krzesło"], ["Lina"]] }) },
    number: { names: ["n", "count", "left", "turns", "total", "max", "min", "seconds", "minutes", "cost", "held", "needed", "hope", "stress", "hp", "despair", "fear",
        "limit", "tier", "pct", "px", "w", "h", "kb", "mb", "current", "used", "rolled", "unseen", "squares", "progress", "day", "chapter", "width", "height", "depth",
        "cells", "dc", "bonus", "cap", "budget", "per", "want", "kept", "cut", "added", "removed", "created", "skipped", "returned", "issued", "majority", "high",
        "low", "objections", "objection", "rebuttal", "first", "second", "found", "back", "of", "a", "b", "hand", "force", "plant", "plantUnseen", "take", "picks",
        "session", "shown", "slider", "auto", "notices", "turn", "bodies", "actions", "traces", "placed", "living", "all", "s", "add", "refresh", "remove", "bar",
        "overflow", "rows", "set", "claimed", "expected", "legal", "projects", "plants", "x", "pools"], values: both(RENDER_NS) },
    action: { names: ["action", "stat"], from: "action" },
    trait: { names: ["trait"], from: "trait" },
    traits: { names: ["traits", "sources"], list: true, from: "traits" },
    grant: { names: ["what"], from: "grant", note: "each real DRPG.Calls.grants.* fragment" },
    call: { names: ["call"], from: "call" },
    time: { names: ["time", "phase", "when"], from: "time" },
    text: { names: ["why", "reason", "error", "message", "text", "summary", "line", "list", "lists", "outcome", "verdict", "result", "state", "stage", "band",
        "mode", "kind", "type", "role", "category", "group", "label", "word", "topic", "visibility", "side", "track", "trigger", "value", "was", "now", "old",
        "new", "before", "after", "other", "where", "relief", "moves", "length", "size", "duality", "formula", "eclipse", "paused", "opened", "faint", "key",
        "keys", "carried", "forms", "step", "store", "system", "counted", "rules"], values: Object.freeze({ en: ["something the code puts here"], pl: ["coś, co wstawia kod"] }),
        note: "a word or a sentence the code builds: its sense is in the key's own sentence" },
    version: { names: ["version", "required", "verified"], values: both(["1.2.95"]) },
    date: { names: ["date", "cleared", "picked"], values: both(["31.10.2026"]) },
    code: { names: ["fn", "id", "path", "field", "row", "sub", "given", "roll"], values: both(["openRoomSetupDialog"]), note: "a name in code: the GM's console" }
});

/* Read 31.10 off the files' sentences: one fixture value, more than one sense. */
export const MEANINGS = Object.freeze({
    what: "a Call's grant here; elsewhere what was rolled, found or asked",
    found: "a number here; \"{system} {found}\" is a version",
    from: "a room here; a passage's two ends, a scene's name",
    to: "a room here; a passage's two ends",
    rows: "a number here; a table of thresholds or rows elsewhere",
    side: "a word here; a size in pixels in one key",
    time: "a time of day here; a clock's reading in a diagnostic",
    items: "a list here; a number in one key (\"Items: {items}. Table rows: {rows}.\")",
    title: "a scene's name here; a world's title, a target in the suite"
});

/** Every name PLACEHOLDERS knows, to its category. */
export function placeholderTable(table = PLACEHOLDERS) {
    const out = new Map();
    for (const [cat, c] of Object.entries(table)) for (const n of c.names) if (!out.has(n)) out.set(n, cat);
    return out;
}

/* The module's own words for a category read from the files: labels by key shape. */
function fromFiles(kind, lang, words) {
    const pick = re => [...words].filter(([k, v]) => re.test(k) && typeof v === "string").map(([, v]) => v);
    switch (kind) {
        case "action": return pick(/^DRPG\.Config\.ACTIONS\.[^.]+\.label$/);
        case "trait": case "traits": return pick(/^DRPG\.Config\.TRAITS\.[^.]+\.label$/);
        case "grant": return pick(/^DRPG\.Calls\.grants\.[^.]+$/);
        case "call": return pick(/^DRPG\.Config\.(?:HOPE|DESPAIR)_CALLS\.[^.]+\.label$/).slice(0, 3);
        case "time": return pick(/^DRPG\.Config\.TIME_OF_DAY_LABELS\.[^.]+$/);
        default: return [];
    }
}

const listRule = lang => { try { return new Intl.ListFormat(LOCALES[lang], { style: "long", type: "conjunction" }); } catch { return { format: a => a.join(", ") }; } };
const pluralRule = lang => { try { return new Intl.PluralRules(LOCALES[lang]); } catch { return { select: n => (n === 1 ? "one" : "other") }; } };

/** A string filled as `game.i18n.format` fills it: a `{name}` with a value replaced, any other left as written. */
export const fill = (text, data) => String(text).replace(PLACEHOLDER, (m, name) => (Object.hasOwn(data, name) ? String(data[name]) : m));

/**
 * The render: `{ ns, fixtures, rows, counts, unknown, meanings }`. `en`, `pl`, `prose`: Maps of key to value. Each row
 * `{ key, lang, text, n, form, family, variant, source }`: a family (`.one`/`.other`, in Polish `.few`/`.many`) is one key
 * (its base) rendered at every n of RENDER_NS through the plural rule, the form it took named; a string with a number
 * in it is rendered at every n too, as a value; any other string as many times as its longest list of values.
 */
export function renderAll({ en = new Map(), pl = new Map(), prose = new Map(), table = PLACEHOLDERS, ns = RENDER_NS } = {}) {
    const known = placeholderTable(table);
    const sources = { en: new Map([...en, ...prose]), pl: new Map(pl) };
    const rows = [], unknown = new Map(), counts = { en: 0, pl: 0, families: 0, variants: 0, unknownNames: 0, empty: 0 };
    for (const lang of ["en", "pl"]) {
        const words = sources[lang], list = listRule(lang), rule = pluralRule(lang);
        const valuesOf = new Map();
        for (const [cat, c] of Object.entries(table)) {
            const raw = c.from ? fromFiles(c.from, lang, words) : (c.values?.[lang] ?? []);
            /* A list read from the files is shown with three of its words and with one. */
            const lists = c.from ? [raw.slice(0, 3), raw.slice(0, 1)].filter(v => v.length) : raw;
            valuesOf.set(cat, c.list ? lists.map(v => list.format(v.map(String))) : raw.map(String));
        }
        const values = name => valuesOf.get(known.get(name)) ?? [];
        const dataAt = (names, i, n) => {
            const data = {};
            for (const name of names) {
                const vs = known.get(name) === "number" && n !== null ? null : values(name);
                if (vs === null) data[name] = n;
                else if (vs.length) data[name] = vs[i % vs.length];
            }
            return data;
        };
        const namesIn = text => [...new Set([...String(text).matchAll(PLACEHOLDER)].map(m => m[1]))];
        const note = (name, key) => { if (!known.has(name) || !values(name).length) { if (!unknown.has(name)) unknown.set(name, new Set()); unknown.get(name).add(`${lang} ${key}`); } };
        const families = new Map();
        for (const [key, v] of words) {
            if (typeof v !== "string") continue;
            const m = key.match(FAMILY_FORM);
            if (m && words.has(key.replace(FAMILY_FORM, ".other"))) {
                const base = key.replace(FAMILY_FORM, "");
                if (!families.has(base)) families.set(base, new Map());
                families.get(base).set(m[1], v);
                continue;
            }
            const names = namesIn(v);
            names.forEach(name => note(name, key));
            const numeric = names.some(name => known.get(name) === "number");
            const longest = numeric ? ns.length : Math.max(1, ...names.map(name => values(name).length));
            for (let i = 0; i < longest; i++) {
                const n = numeric ? ns[i] : null;
                rows.push({ key, lang, text: fill(v, dataAt(names, i, n)), n, form: null, family: false, variant: i + 1, source: v });
            }
            counts[lang]++;
            if (!v.trim()) counts.empty++;
        }
        for (const [base, forms] of families) {
            counts.families++;
            counts[lang]++;
            const names = [...new Set([...forms.values()].flatMap(namesIn))];
            names.forEach(name => note(name, base));
            const countOn = names.includes("n") ? "n" : names.find(name => known.get(name) === "number") ?? "n";
            ns.forEach((n, i) => {
                const picked = rule.select(n), form = forms.has(picked) ? picked : "other";
                const data = { ...dataAt(names.filter(x => x !== countOn), i, n), [countOn]: n };
                rows.push({ key: base, lang, text: fill(forms.get(form), data), n, form, family: true, variant: i + 1, source: forms.get(form) });
            });
        }
    }
    counts.variants = rows.length;
    counts.unknownNames = unknown.size;
    return {
        ns: [...ns], fixtures: [...known.keys()].filter(n => valuesKnown(n, known, table, sources)).sort(), rows, counts,
        unknown: [...unknown].sort((a, b) => a[0].localeCompare(b[0])).map(([name, where]) => ({ name, where: [...where].sort() })), meanings: { ...MEANINGS }
    };
}

/* A name counts as known when its category gives it a value in both languages (a `from` category reads nothing out of an empty file). */
function valuesKnown(name, known, table, sources) {
    const c = table[known.get(name)];
    if (!c) return false;
    return ["en", "pl"].every(lang => (c.from ? fromFiles(c.from, lang, sources[lang]).length > 0 : (c.values?.[lang] ?? []).length > 0));
}

/* --------------------------------- files ----------------------------------- */

const escapeHtml = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeMd = s => escapeHtml(s).replace(/\|/g, "\\|").replace(/\n/g, " ");

/** The keys of the render, by screen (the map's), then the keys no screen reaches; a key on several screens is under each. */
function byScreen(render, map) {
    const keysOf = new Map(), placed = new Set();
    const baseOf = k => k.replace(FAMILY_FORM, "");
    const rowKeys = new Set(render.rows.map(r => r.key));
    const sections = [];
    for (const s of map?.screens ?? []) {
        const keys = [...new Set(s.keys.map(k => (rowKeys.has(k.key) ? k.key : baseOf(k.key))).filter(k => rowKeys.has(k)))].sort();
        const how = new Map(s.keys.map(k => [rowKeys.has(k.key) ? k.key : baseOf(k.key), k.how]));
        if (!keys.length) continue;
        keys.forEach(k => placed.add(k));
        sections.push({ id: s.id, title: `${s.name} (${s.id}; reader: ${s.reader}${s.texts ? `; ${s.texts} texts` : ""}${s.stage ? `; ${s.stage}` : ""})`, keys, how });
    }
    const rest = [...rowKeys].filter(k => !placed.has(k)).sort();
    if (rest.length || !map) sections.push({ id: "unassigned", title: map ? "Unassigned: the keys no screen reaches" : "Every key (no screen map)", keys: rest.length ? rest : [...rowKeys].sort(), how: new Map() });
    for (const r of render.rows) { if (!keysOf.has(`${r.lang} ${r.key}`)) keysOf.set(`${r.lang} ${r.key}`, []); keysOf.get(`${r.lang} ${r.key}`).push(r); }
    return { sections, rowsOf: (lang, key) => keysOf.get(`${lang} ${key}`) ?? [] };
}

const rowLabel = r => (r.family ? `n=${r.n} (${r.form})` : r.n !== null ? `n=${r.n}` : `#${r.variant}`);

export function markdown(render, map, lang) {
    const { sections, rowsOf } = byScreen(render, map);
    const out = [`# The module's ${lang === "en" ? "English" : "Polish"} text, rendered`, "",
        `Written by \`node tools/text-render.mjs\` (E65 C10). Fixtures: tools/text-render.mjs PLACEHOLDERS; n = ${render.ns.join(", ")}. `
        + `Placeholders with no fixture are left as \`{name}\`: ${render.unknown.length ? render.unknown.map(u => u.name).join(", ") : "none"}. HTML is escaped here.`, ""];
    for (const s of sections) {
        out.push(`## ${s.title}`, "");
        for (const key of s.keys) {
            const rows = rowsOf(lang, key);
            if (!rows.length) continue;
            const how = s.how.get(key);
            out.push(`- \`${key}\`${how && how !== "literal" ? ` (by ${how})` : ""}`);
            for (const r of rows) out.push(`  - ${rows.length > 1 ? `${rowLabel(r)}: ` : ""}${escapeMd(r.text)}`);
        }
        out.push("");
    }
    return out.join("\n");
}

export function sheet(render, map, { title = "The module's text, English and Polish side by side", keys = null, extra = null } = {}) {
    const { sections, rowsOf } = byScreen(render, map);
    const only = keys ? new Set(keys) : null;
    const cell = rows => rows.map(r => `<div class="v">${rows.length > 1 ? `<span class="n">${escapeHtml(rowLabel(r))}</span> ` : ""}${r.text}</div>`).join("");
    const body = [];
    for (const s of only ? [{ id: "pilot", title: "The pilot's strings", keys: [...only], how: new Map() }] : sections) {
        const rows = s.keys.filter(k => !only || only.has(k));
        if (!rows.length) continue;
        body.push(`<h2>${escapeHtml(s.title)}</h2><table><thead><tr><th>Key</th><th>English</th><th>Polski</th>${extra ? "<th>Proposed EN</th><th>Proponowany PL</th>" : ""}</tr></thead><tbody>`);
        for (const key of rows) {
            const p = extra?.get(key);
            body.push(`<tr><td><code>${escapeHtml(key)}</code>${s.how.get(key) && s.how.get(key) !== "literal" ? ` <small>by ${escapeHtml(s.how.get(key))}</small>` : ""}</td>`
                + `<td>${cell(rowsOf("en", key))}</td><td>${cell(rowsOf("pl", key))}</td>${extra ? `<td>${escapeHtml(p?.en ?? "")}</td><td>${escapeHtml(p?.pl ?? "")}</td>` : ""}</tr>`);
        }
        body.push("</tbody></table>");
    }
    return `<!doctype html>
<html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Text render</title>
<style>
:root { --bg: #fdfdfb; --fg: #1c1c1c; --line: #d8d8d0; --muted: #6a6a64; }
@media (prefers-color-scheme: dark) { :root { --bg: #18181a; --fg: #e8e8e4; --line: #3a3a3e; --muted: #9a9a94; } }
body { background: var(--bg); color: var(--fg); font: 15px/1.45 system-ui, sans-serif; margin: 16px; }
table { border-collapse: collapse; width: 100%; margin-bottom: 24px; } th, td { border: 1px solid var(--line); padding: 4px 6px; vertical-align: top; text-align: left; }
td:first-child { width: 22%; word-break: break-all; } .v + .v { border-top: 1px dotted var(--line); } .n { color: var(--muted); font-size: 12px; }
</style></head><body>
<h1>${escapeHtml(title)}</h1>
<p>Written by <code>node tools/text-render.mjs</code> (E65 C10). Fixtures: PLACEHOLDERS in tools/text-render.mjs; n = ${render.ns.join(", ")}. HTML in a string is rendered as HTML here. Placeholders with no fixture are left as written: ${escapeHtml(render.unknown.map(u => u.name).join(", ") || "none")}.</p>
${body.join("\n")}
</body></html>
`;
}

/** The files a render reads, from a repository (or `langDir` for en.json and pl.json). */
export async function loadTexts(repo = REPO, langDir = path.join(repo, "lang")) {
    const flat = (o, p = "", out = new Map()) => { for (const [k, v] of Object.entries(o ?? {})) { const key = p ? `${p}.${k}` : k; if (v && typeof v === "object") flat(v, key, out); else out.set(key, v); } return out; };
    const read = f => JSON.parse(fs.readFileSync(path.join(langDir, f), "utf8"));
    const config = await import(url.pathToFileURL(path.join(repo, "scripts", "config.mjs")).href);
    const { walkConfigProse } = await import(url.pathToFileURL(path.join(repo, "scripts", "i18n-config.mjs")).href);
    const prose = new Map();
    walkConfigProse(config, (key, value) => prose.set(key, value));
    return { en: flat(read("en.json")), pl: flat(read("pl.json")), prose };
}

if (process.argv[1] && path.resolve(process.argv[1]) === url.fileURLToPath(import.meta.url)) {
    const argv = process.argv.slice(2);
    const pilotAt = argv.indexOf("--pilot");
    const texts = await loadTexts();
    const render = renderAll(texts);
    const tm = await import(url.pathToFileURL(path.join(HERE, "text-map.mjs")).href);
    const espree = tm.loadEspree(REPO);
    let map = null;
    if (!espree) console.log("text-render: espree is not installed (npm ci in audit/harness) - the files are written without the screen map, every key under one heading");
    else {
        const { keys, tables } = await tm.moduleKeys(REPO);
        map = tm.buildScreenMap({ scripts: tm.moduleScripts(REPO), keys, espree, configTables: tables });
    }
    const dir = path.join(REPO, "audit", "harness", "results", "text");
    fs.mkdirSync(dir, { recursive: true });
    const write = (name, text) => { fs.writeFileSync(path.join(dir, name), text); console.log(`text-render: wrote ${path.relative(REPO, path.join(dir, name))}`); };
    write("text-render.en.md", markdown(render, map, "en"));
    write("text-render.pl.md", markdown(render, map, "pl"));
    write("text-render.pl.html", sheet(render, map));
    if (pilotAt >= 0) {
        const file = argv[pilotAt + 1];
        if (!file) { console.log("text-render: --pilot takes a file"); process.exit(2); }
        const pilot = JSON.parse(fs.readFileSync(path.resolve(file), "utf8"));
        const pairs = Array.isArray(pilot) ? pilot.map(k => (typeof k === "string" ? { key: k } : k)) : (pilot.pairs ?? (pilot.keys ?? []).map(key => ({ key })));
        const extra = new Map(pairs.filter(p => p?.key).map(p => [p.key, { en: p.en ?? p.after?.en ?? "", pl: p.pl ?? p.after?.pl ?? "" }]));
        write("text-render.pilot.html", sheet(render, map, { title: "The pilot's strings", keys: [...extra.keys()], extra }));
    }
    const c = render.counts;
    console.log(`text-render: rendered en ${c.en} key(s), pl ${c.pl} (families ${c.families} across both), ${c.variants} string(s) in all; `
        + `fixtures for ${render.fixtures.length} placeholder name(s), ${render.unknown.length} unknown${render.unknown.length ? ` (${render.unknown.map(u => u.name).join(", ")})` : ""}; `
        + `${Object.keys(render.meanings).length} with two meanings; ${map ? `${map.counts.screens} screen(s), ${map.counts.unassigned} key(s) unassigned` : "no screen map"}`);
}
