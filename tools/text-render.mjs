/**
 * The render (E65 C10, E65-19): every string of the module filled the way a table fills it, for a reader.
 * ---------------------------------------------------------------------------
 *     node tools/text-render.mjs                 writes text-render.en.md, text-render.pl.md and text-render.pl.html
 *     node tools/text-render.mjs --pilot <file> [--out <html>] [--pl-only]
 *                                                the pilot's sheet alone (E65 C14): pilot.html, or <html>; --pl-only
 *                                                leaves the English out (the PL reviewer's sheet, DB26)
 *     node tools/text-render.mjs --batch <file> [--out <html>] [--pl-only]
 *                                                a batch's sheet alone (E66 C6): batch-<name>.html, or <html>; --pl-only
 *                                                leaves every English text but the facts out (DB26)
 * Into audit/harness/results/text/ (generated, never committed). The md and the sheet are laid out by the screen
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
        "overflow", "rows", "set", "claimed", "expected", "legal", "projects", "plants", "x", "pools",
        // E66 C4 (01.11.2026): the numbers config.mjs `PROSE_NUMBERS` and the builders put where a digit stood.
        "drain", "mult", "worth", "fewest"], values: both(RENDER_NS) },
    action: { names: ["action", "stat"], from: "action" },
    trait: { names: ["trait"], from: "trait" },
    traits: { names: ["traits", "sources"], list: true, from: "traits" },
    grant: { names: ["what"], from: "grant", note: "each real DRPG.Calls.grants.* fragment" },
    call: { names: ["call"], from: "call" },
    time: { names: ["time", "phase", "when"], from: "time" },
    text: { names: ["why", "reason", "error", "message", "text", "summary", "line", "list", "lists", "outcome", "verdict", "result", "state", "stage", "band",
        "mode", "kind", "type", "role", "category", "group", "label", "word", "topic", "visibility", "side", "track", "trigger", "value", "was", "now", "old",
        "new", "before", "after", "other", "where", "relief", "moves", "length", "size", "duality", "formula", "eclipse", "paused", "opened", "faint", "key",
        "keys", "carried", "forms", "step", "store", "system", "counted", "rules",
        // E66 C4: a number with its unit, written by a `DRPG.Unit.*` family or the Eclipse's reach.
        "reach", "short", "long", "wounded",
        // E66 fix r1 F7: the vote's noun, `Events.voteMetaGmBallots` counted on the total (events.mjs `voteMetaLine`).
        "ballots"], values: Object.freeze({ en: ["something the code puts here"], pl: ["coś, co wstawia kod"] }),
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

export function sheet(render, map, { title = "The module's text, English and Polish side by side" } = {}) {
    const { sections, rowsOf } = byScreen(render, map);
    const cell = rows => rows.map(r => `<div class="v">${rows.length > 1 ? `<span class="n">${escapeHtml(rowLabel(r))}</span> ` : ""}${r.text}</div>`).join("");
    const body = [];
    for (const s of sections) {
        if (!s.keys.length) continue;
        body.push(`<h2>${escapeHtml(s.title)}</h2><table><thead><tr><th>Key</th><th>English</th><th>Polski</th></tr></thead><tbody>`);
        for (const key of s.keys) {
            body.push(`<tr><td><code>${escapeHtml(key)}</code>${s.how.get(key) && s.how.get(key) !== "literal" ? ` <small>by ${escapeHtml(s.how.get(key))}</small>` : ""}</td>`
                + `<td>${cell(rowsOf("en", key))}</td><td>${cell(rowsOf("pl", key))}</td></tr>`);
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

/* --------------------------------- the pilot -------------------------------- */

/*
 * THE PILOT (E65 C14, E65-23; STAGE.md Appendix C). docs/dev/text-pilot.json holds 40 strings, each
 * `{ key, surface, screen, readers, facts, en: { before, after }, pl: { before, after }, reviews: { en, coldEn, pl },
 * owner }`, and the owner's `questions` beside them. `pilotSchema` holds the file to that shape against the files of
 * this tree - `node tools/check.mjs text` makes each problem red: the file's own shape, a key the files no longer hold,
 * a naturalness pair's key or before; whether a before or an after is the files' text now is `pilotState`'s reading,
 * printed and never red (E65 fix round, 01.11.2026) - and `pilotSheet` renders it for the owner: each
 * string at n = 1, 2 and 5 when it counts, with a woman's and a man's name, the three rooms and items of the three
 * Polish genders, EN and PL before and after, the facts in one line, what the reviewers still hold open, and three
 * answers (ok, a correction, "nikt tak nie mówi"). An `after` still null reads "not written yet".
 * The owner's answers (E65 C-pilot, 01.11.2026): a string's `owner` is null or { verdict, text, date }, the verdict one
 * of OWNER_VERDICTS and `text` the owner's note as written ("" for none); a question's `owner` is null or the same
 * shape with the verdict one of QUESTION_VERDICTS - "default" (the stage's default stands) or "other" (the owner's
 * `text` says what instead) - as the sheet's two answers to a question are.
 */
export const PILOT_SIZE = 40;
export const PILOT_NS = Object.freeze([1, 2, 5]);
const PILOT_TOP = Object.freeze(["$comment", "questions", "strings"]);
const PILOT_FIELDS = Object.freeze(["key", "surface", "screen", "readers", "facts", "en", "pl", "reviews", "owner"]);
const PILOT_REVIEWS = Object.freeze(["en", "coldEn", "pl"]);
const QUESTION_FIELDS = Object.freeze(["id", "source", "text", "default", "owner"]);
export const OWNER_VERDICTS = Object.freeze(["ok", "correction", "nikt tak nie mówi"]);
export const QUESTION_VERDICTS = Object.freeze(["default", "other"]);
const FORM_NAMES = Object.freeze(["zero", "one", "two", "few", "many", "other"]);
/* The keys `fromFiles` reads a category's values from: kept in the small render a pilot string gets. */
const FROM_KEYS = /^DRPG\.(?:Config\.(?:ACTIONS\.[^.]+\.label|TRAITS\.[^.]+\.label|(?:HOPE|DESPAIR)_CALLS\.[^.]+\.label|TIME_OF_DAY_LABELS\.[^.]+)|Calls\.grants\.[^.]+)$/;

const isText = v => typeof v === "string" && v.trim() !== "";
const sameFields = (o, fields) => o !== null && typeof o === "object" && !Array.isArray(o)
    && Object.keys(o).length === fields.length && fields.every(f => Object.hasOwn(o, f));
/** A key's value in a language's words: the string, a plural family's forms as `{ one, other, ... }`, or undefined. */
export function pilotValue(words, key) {
    if (words.has(key)) return words.get(key);
    const forms = {};
    for (const f of FORM_NAMES) if (words.has(`${key}.${f}`)) forms[f] = words.get(`${key}.${f}`);
    return Object.hasOwn(forms, "other") ? forms : undefined;
}
const sameValue = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/* An owner's answer: null, or { verdict, text, date } with the verdict one of `verdicts` and the date dd.mm.yyyy. */
const ownerShaped = (o, verdicts) => o === null || (sameFields(o, ["verdict", "text", "date"]) && verdicts.includes(o.verdict)
    && typeof o.text === "string" && /^\d\d\.\d\d\.\d{4}$/.test(String(o.date)));
const formsText = v => (typeof v === "string" ? [v] : Object.values(v ?? {}));
/* A before as the file writes it: a text, or a plural family's forms (`other` among them), each a text. */
const valueShaped = v => isText(v) || (v !== null && typeof v === "object" && !Array.isArray(v) && Object.hasOwn(v, "other")
    && Object.keys(v).every(f => FORM_NAMES.includes(f)) && Object.values(v).every(isText));
const RENAMED = " - a key renamed or removed since the pilot: its entry in docs/dev/text-pilot.json follows it";

/**
 * Where the 40 stand in this tree's files (E65 fix round, 01.11.2026; a reading, never a fault): for each string and
 * language whose key the files hold, its text there is the pilot's `before` (not applied yet), its `after` (landed:
 * E66 or E71 applied it) or neither ("changed since the pilot": a stage edited it otherwise). T27 reads the guide's
 * befores the same way, a pair whose before is gone listed apart and not red. `en`, `pl` as for `pilotSchema`.
 */
export function pilotState(doc, { en = new Map(), pl = new Map() } = {}) {
    const state = { read: 0, before: { en: 0, pl: 0 }, landed: { en: 0, pl: 0 }, changed: [] };
    for (const s of Array.isArray(doc?.strings) ? doc.strings : []) {
        if (!isText(s?.key)) continue;
        for (const [lang, words] of [["en", en], ["pl", pl]]) {
            const now = pilotValue(words, s.key), side = s[lang];
            if (now === undefined || side === null || typeof side !== "object") continue;
            state.read++;
            if (sameValue(now, side.before)) state.before[lang]++;
            else if (side.after !== null && side.after !== undefined && sameValue(now, side.after)) state.landed[lang]++;
            else state.changed.push(`${s.key} ${lang}`);
        }
    }
    return state;
}

/**
 * The pilot file's problems, `[]` when it holds: `doc` the parsed file; `en` lang/en.json's words with config.mjs's
 * English prose (where the English of DRPG.Config.* lives), `pl` pl.json's, both Maps of flat keys; `pairs` the
 * guide's naturalness pairs (tests-text.mjs `naturalnessPairs`), none of whose keys or "befores" a pilot string may
 * hold (Appendix C: the two sets test different things); `surfaces` the budgets' surface ids, when given.
 */
export function pilotSchema(doc, { en = new Map(), pl = new Map(), pairs = [], surfaces = null } = {}) {
    if (doc === null || typeof doc !== "object" || Array.isArray(doc)) return ["the file is not an object"];
    const out = [];
    for (const k of Object.keys(doc)) if (!PILOT_TOP.includes(k)) out.push(`the file has a field "${k}" (it holds ${PILOT_TOP.join(", ")})`);
    if (!Array.isArray(doc.questions)) out.push("questions is not a list");
    else {
        const ids = new Set();
        doc.questions.forEach((q, i) => {
            const texts = QUESTION_FIELDS.filter(f => f !== "owner");
            if (!sameFields(q, QUESTION_FIELDS) || !texts.every(f => isText(q[f]))) out.push(`questions[${i}] is not { ${QUESTION_FIELDS.join(", ")} }, ${texts.join(", ")} each a text`);
            else if (!ownerShaped(q.owner, QUESTION_VERDICTS)) out.push(`questions[${i}] (${q.id}): owner is neither null nor { verdict: ${QUESTION_VERDICTS.join(" | ")}, text, date dd.mm.yyyy }`);
            else if (ids.has(q.id)) out.push(`questions[${i}]: the id ${q.id} twice`);
            else ids.add(q.id);
        });
    }
    if (!Array.isArray(doc.strings)) return [...out, "strings is not a list"];
    if (doc.strings.length !== PILOT_SIZE) out.push(`strings holds ${doc.strings.length} string(s), not ${PILOT_SIZE}`);
    const seen = new Set();
    doc.strings.forEach((s, i) => {
        const at = `strings[${i}]${isText(s?.key) ? ` (${s.key})` : ""}`;
        if (!sameFields(s, PILOT_FIELDS)) { out.push(`${at} is not { ${PILOT_FIELDS.join(", ")} }`); return; }
        if (!isText(s.key)) { out.push(`${at}: the key is not a text`); return; }
        if (seen.has(s.key)) out.push(`${at}: the key twice`);
        seen.add(s.key);
        const now = { en: pilotValue(en, s.key), pl: pilotValue(pl, s.key) };
        if (now.en === undefined) out.push(`${at}: not a key of lang/en.json or config.mjs's English prose${RENAMED}`);
        if (!isText(s.surface) || (surfaces && !surfaces.includes(s.surface))) out.push(`${at}: the surface ${JSON.stringify(s.surface)} is not ${surfaces ? "one of docs/text-budgets.json's" : "a text"}`);
        if (!isText(s.screen)) out.push(`${at}: the screen is not a text`);
        if (!Array.isArray(s.readers) || !s.readers.length || !s.readers.every(isText)) out.push(`${at}: readers is not a list of texts`);
        if (!Array.isArray(s.facts) || !s.facts.every(isText)) out.push(`${at}: facts is not a list of texts`);
        for (const lang of ["en", "pl"]) {
            const side = s[lang];
            if (!sameFields(side, ["before", "after"])) { out.push(`${at}: ${lang} is not { before, after }`); continue; }
            if (now[lang] === undefined) { if (lang === "pl") out.push(`${at}: not a key of lang/pl.json${RENAMED}`); continue; }
            /* The file's own shape only (E65 fix round, 01.11.2026): the text lang/ holds now is read by `pilotState`, never
               here - E66 and E71 apply these afters, and any stage may edit one of the 40, so a before that is no longer
               the files' text is a reading, not a fault of this file. */
            if (!valueShaped(side.before)) { out.push(`${at}: ${lang}.before is neither a text nor a plural family's forms (other among them), each a text`); continue; }
            const a = side.after;
            const shaped = a === null || (typeof side.before === "string" ? isText(a)
                : (a !== null && typeof a === "object" && !Array.isArray(a) && sameValue(Object.keys(a).sort(), Object.keys(side.before).sort()) && Object.values(a).every(isText)));
            if (!shaped) out.push(`${at}: ${lang}.after is neither null nor ${typeof side.before === "string" ? "a text" : `the forms ${Object.keys(side.before).join(", ")}, each a text`}`);
        }
        if (!sameFields(s.reviews, PILOT_REVIEWS)) out.push(`${at}: reviews is not { ${PILOT_REVIEWS.join(", ")} }`);
        else for (const r of PILOT_REVIEWS) {
            const v = s.reviews[r];
            if (v !== null && !(sameFields(v, ["verdict", "points"]) && isText(v.verdict) && Array.isArray(v.points) && v.points.every(isText))) out.push(`${at}: reviews.${r} is neither null nor { verdict, points }`);
        }
        if (!ownerShaped(s.owner, OWNER_VERDICTS)) out.push(`${at}: owner is neither null nor { verdict: ${OWNER_VERDICTS.join(" | ")}, text, date dd.mm.yyyy }`);
        for (const p of pairs) {
            if (p.key !== null && (p.key === s.key || p.key.startsWith(`${s.key}.`))) out.push(`${at}: the key of naturalness pair ${p.id} - the pilot and the 60 pairs test different things`);
            else if (formsText(now.pl).some(t => typeof t === "string" && t.includes(p.before))) out.push(`${at}: its Polish holds naturalness pair ${p.id}'s before "${p.before}"`);
        }
    });
    return out;
}

/* A pilot string rendered in one language: `{ label, text }` for each variant, through `renderAll` on a render of this
   key alone (and the module's own labels a `from` category reads), at PILOT_NS. */
function pilotVariants(key, value, lang, words) {
    const sub = new Map([...words].filter(([k]) => FROM_KEYS.test(k)));
    if (typeof value === "string") sub.set(key, value);
    else for (const [f, v] of Object.entries(value)) sub.set(`${key}.${f}`, v);
    const r = renderAll({ [lang]: sub, ns: PILOT_NS });
    const rows = r.rows.filter(x => x.key === key && x.lang === lang);
    return rows.map(x => ({ label: rows.length > 1 ? rowLabel(x) : "", text: x.text }));
}

/** The owner's sheet (E65 C14): HTML. `texts` as `loadTexts` gives them; `plOnly` leaves every English row out. */
export function pilotSheet(doc, texts, { plOnly = false } = {}) {
    const words = { en: new Map([...texts.en, ...texts.prose]), pl: texts.pl };
    const cell = (key, value, lang) => (value === null || value === undefined
        ? `<div class="v none">not written yet</div>`
        : pilotVariants(key, value, lang, words[lang]).map(v => `<div class="v">${v.label ? `<span class="n">${escapeHtml(v.label)}</span> ` : ""}${escapeHtml(v.text)}</div>`).join(""));
    const review = (name, r) => (r === null
        ? `<li><b>${name}</b>: no review yet</li>`
        : `<li><b>${name}</b>: ${escapeHtml(r.verdict)}${r.points.length ? `<ul>${r.points.map(p => `<li>${escapeHtml(p)}</li>`).join("")}</ul>` : ""}</li>`);
    const answers = (name, choices) => `<fieldset class="answer"><legend>Odpowiedź</legend>${choices.map(([value, label]) =>
        `<label><input type="radio" name="${escapeHtml(name)}" value="${escapeHtml(value)}"> ${escapeHtml(label)}</label>`).join(" ")}
<textarea name="${escapeHtml(name)}.text" rows="2" placeholder="poprawka albo uwaga"></textarea></fieldset>`;
    const body = [];
    if (!plOnly && Array.isArray(doc.questions) && doc.questions.length) {
        body.push(`<h2>Pytania (${doc.questions.length})</h2>`);
        for (const q of doc.questions) {
            body.push(`<section class="q"><h3>${escapeHtml(q.id)} <small>${escapeHtml(q.source)}</small></h3><p>${escapeHtml(q.text)}</p><p><b>Default:</b> ${escapeHtml(q.default)}</p>`
                + `${answers(`q.${q.id}`, QUESTION_VERDICTS.map(v => [v, v === "default" ? "as the default" : "otherwise (write it)"]))}</section>`);
        }
    }
    body.push(`<h2>${plOnly ? "Teksty" : "The strings"} (${doc.strings.length})</h2>`);
    doc.strings.forEach((s, i) => {
        const rows = [...(plOnly ? [] : [["EN before", s.en.before, "en"], ["EN after", s.en.after, "en"]]), ["PL przed", s.pl.before, "pl"], ["PL po", s.pl.after, "pl"]];
        body.push(`<section class="s"><h3>${i + 1}. <code>${escapeHtml(s.key)}</code></h3>`
            + `<p class="meta">${escapeHtml(s.surface)} · ${escapeHtml(s.screen)} · ${escapeHtml(s.readers.join(", "))}</p>`
            + `<p class="facts"><b>Facts:</b> ${s.facts.length ? escapeHtml(s.facts.join("; ")) : "not written yet"}</p>`
            + `<table><tbody>${rows.map(([label, value, lang]) => `<tr><th>${label}</th><td>${cell(s.key, value, lang)}</td></tr>`).join("")}</tbody></table>`
            + (plOnly ? "" : `<ul class="reviews">${review("EN review", s.reviews.en)}${review("cold EN review", s.reviews.coldEn)}${review("PL review", s.reviews.pl)}</ul>`)
            + (plOnly ? "" : answers(`s.${s.key}`, OWNER_VERDICTS.map(v => [v, v === "correction" ? "a correction" : v])))
            + "</section>");
    });
    const legend = "n = 1, 2, 5 where the string counts (a family through Intl.PluralRules); #1, #2, #3 fill a person with Aiko, then Daichi (a woman's name, a man's), "
        + "a room with Warsztat, Biblioteka, Kino and an item with Nóż kuchenny, Lina, Krzesło (masculine, feminine, neuter), each in turn.";
    return `<!doctype html>
<html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Text pilot</title>
<style>
:root { --bg: #fdfdfb; --fg: #1c1c1c; --line: #d8d8d0; --muted: #6a6a64; }
@media (prefers-color-scheme: dark) { :root { --bg: #18181a; --fg: #e8e8e4; --line: #3a3a3e; --muted: #9a9a94; } }
body { background: var(--bg); color: var(--fg); font: 15px/1.45 system-ui, sans-serif; margin: 16px; max-width: 980px; }
section { border-top: 1px solid var(--line); padding: 8px 0 12px; } h3 { margin: 4px 0; font-size: 16px; } h3 small, .meta, .n, .none { color: var(--muted); font-size: 12px; }
table { border-collapse: collapse; width: 100%; margin: 6px 0; } th, td { border: 1px solid var(--line); padding: 4px 6px; vertical-align: top; text-align: left; }
th { width: 7em; font-weight: 600; } code { word-break: break-all; } .v + .v { border-top: 1px dotted var(--line); }
fieldset.answer { border: 1px solid var(--line); } fieldset.answer label { margin-right: 12px; } textarea { width: 100%; box-sizing: border-box; background: var(--bg); color: var(--fg); }
</style></head><body>
<h1>${plOnly ? "Pilot: teksty polskie" : "The text pilot"}</h1>
<p>Written by <code>node tools/text-render.mjs --pilot</code> (E65 C14) from docs/dev/text-pilot.json. ${escapeHtml(legend)} HTML in a string is shown as written.</p>
${body.join("\n")}
</body></html>
`;
}

/* --------------------------------- the batches -------------------------------- */

/*
 * A BATCH (E66 C6, E66-26; STAGE.md Appendix C): a set of texts rewritten from the facts of the functions that run their
 * rule, the model E65's pilot set for E71. docs/dev/text-batch-B01a.json holds B01a, about 60 of the most-read config
 * texts and their windows' keys, each `{ key, group, surface, screen, readers, source, pilot, facts, kept, en, pl,
 * removed, needsCode, disagreements, reviews, owner }`:
 *   - `facts`: what the code does, each `{ fact, file, fn, note }` - the file and the function the fact was read in
 *     (M1), or both null and `note` saying why (not found in code; a pilot fact copied as approved);
 *   - `kept`: the facts the after keeps, by their index (section 11's "facts kept" column), null until an after is
 *     written; `removed` (what left the text and where it went), `needsCode`, `disagreements` (with the code or a
 *     decision): lists of texts;
 *   - `en`, `pl`: `{ before, after }` as the pilot's; `source` "written" (the batch's agents wrote it) or "pilot" (the
 *     pilot's approved after copied as approved, Q-E66-4: `pilot` its number in docs/dev/text-pilot.json, not reviewed
 *     again);
 *   - `reviews`: the EN reviewer's, the cold EN reviewer's, the PL reviewer's and the mechanics reviewer's points still
 *     open after the one revision (null, or { verdict, points });
 *   - `owner`: the owner's verdict (null, or { verdict, text, date, page }, `page` the review page the owner answered on).
 * `batchSchema` holds the file to that shape against the files of this tree - `node tools/check.mjs text` makes each
 * problem red: the shape, a key no file holds or one Appendix C leaves out, a fact with no function, an after that
 * changes a placeholder (N2), adds a digit (M5) or runs over its surface's limit (B1), an English and a Polish after
 * whose forms the files would refuse (T2, `pairParity`, handed in), a pilot copy that is not the pilot's approved
 * after, an owner's verdict on no page or on a text not written. Where the texts stand in the files is
 * `batchState`'s reading, printed and never red (C7 lands the afters); `batchSheet` renders it for the readers.
 */
export const BATCH_FILES = Object.freeze(["docs/dev/text-batch-B01a.json"]);
const BATCH_TOP = Object.freeze(["$comment", "batch", "stage", "texts"]);
const BATCH_FIELDS = Object.freeze(["key", "group", "surface", "screen", "readers", "source", "pilot", "facts", "kept", "en", "pl",
    "removed", "needsCode", "disagreements", "reviews", "owner"]);
const BATCH_GROUPS = Object.freeze(["config", "window", "named"]);
const BATCH_SOURCES = Object.freeze(["written", "pilot"]);
const FACT_FIELDS = Object.freeze(["fact", "file", "fn", "note"]);
const OWNER_FIELDS = Object.freeze(["verdict", "text", "date", "page"]);
/** Each reviewer's verdicts, as its prompt offers them (S/stages/E66/scratch/c6/roles). */
export const BATCH_REVIEWS = Object.freeze({
    en: Object.freeze(["ok", "change", "wrong"]),
    coldEn: Object.freeze(["ok", "unclear", "unnatural"]),
    pl: Object.freeze(["ok", "change", "nikt tak nie mówi"]),
    mechanics: Object.freeze(["ok", "change", "wrong"])
});
/* The page the owner approved the pilot on (E65 C-pilot, 01.11.2026): a pilot copy's verdict is that page's, no other. */
export const PILOT_PAGE = "E65-PILOT-R1";
/*
 * B01a and the pilot (Q-E66-4, approved 01.11.2026): pairs 2-8 and 10 are B01a keys and go in as approved; pair 1
 * (Search's hint) stays with topic A and pair 9 (PHASES.dailyLife.hint) is not B01a's.
 */
export const B01A_PILOT = Object.freeze({ take: Object.freeze([2, 3, 4, 5, 6, 7, 8, 10]), leave: Object.freeze([1, 9]) });
/*
 * A pilot copy the owner amended (E66 C7, 01.11.2026): the approved Polish after of ACTIONS.rest.description (pair 8)
 * wrote the Rest options as common nouns, „sen”, „posiłek”, „oddech”, where C5 made them names (Appendix A, Q-E66-2);
 * the owner took the default of page E66-B01A-R1's question on it (#53): the names, the rest of the approved sentence
 * unchanged. Each row is [what the pilot's after writes, what the copy writes], each found once in the pilot's after;
 * the schema holds the copy to the pilot's after with exactly these replacements, so nothing else in it can move.
 */
export const B01A_AMENDED = Object.freeze({
    "DRPG.Config.ACTIONS.rest.description": Object.freeze({
        pl: Object.freeze([["sen (Health)", "Sleep (Health)"], ["posiłek (Sanity)", "Meal (Sanity)"], ["oddech (Hope)", "Breath (Hope)"]])
    })
});
/* The pilot's approved after with the owner's amendments of B01A_AMENDED applied, or null when a row's words are not
   found exactly once in it (the pilot's after moved: the row no longer says what it replaces). */
function amendedAfter(key, lang, after) {
    const rows = B01A_AMENDED[key]?.[lang];
    if (!rows) return after;
    if (typeof after !== "string") return null;
    let out = after;
    for (const [from, to] of rows) {
        if (out.split(from).length !== 2) return null;
        out = out.replace(from, to);
    }
    return out;
}
/* Appendix C's "Out": the texts topic A rewrites, E68's, MONOCUB, TRIAL, and the table-name label keys (T14). */
export const BATCH_OUT = Object.freeze({
    keys: Object.freeze(["DRPG.Config.ACTIONS.listen.hint", "DRPG.Config.ACTIONS.search.hint", "DRPG.Config.HOPE_CALLS.determination.effect",
        "DRPG.Murder.gmPicksTrait"]),
    prefixes: Object.freeze(["DRPG.Config.MONOCUB.", "DRPG.Config.TRIAL.", "DRPG.Trial.", "DRPG.Floor.", "DRPG.TrialScene.", "DRPG.Vote."]),
    labels: /^DRPG\.Config\.(?:ITEM_CATEGORIES\.[^.]+\.(?:label|plural)|USABLE_KINDS\.[^.]+\.label|USABLE_GOALS\.[^.]+\.label)$/
});
const DIGITS = /\d+/g;
const placeholdersOf = v => [...new Set(formsText(v).flatMap(t => [...String(t).matchAll(PLACEHOLDER)].map(m => m[1])))].sort();
const digitsOf = v => new Set(formsText(v).flatMap(t => String(t).match(DIGITS) ?? []));
const BAD_DASHES = [String.fromCharCode(0x2013), String.fromCharCode(0x2014), String.fromCharCode(0x2212)];
const plainWords = text => String(text ?? "").split(/\s+/).filter(t => /[\p{L}\p{N}]|\{\w+\}/u.test(t)).length;
const isOut = key => BATCH_OUT.keys.includes(key) || BATCH_OUT.prefixes.some(p => key.startsWith(p)) || BATCH_OUT.labels.test(key);
const BATCH_RENAMED = " - a key renamed or removed since the batch was written: its entry follows it";
/* A pilot copy's verdict: the pilot's own, field by field, on the pilot's page. */
const pilotVerdict = (o, p) => (p === null || p === undefined ? o === null
    : sameFields(o, OWNER_FIELDS) && o.verdict === p.verdict && o.text === p.text && o.date === p.date && o.page === PILOT_PAGE);

/**
 * The batch file's problems, `[]` when it holds. `doc` the parsed file; `en` lang/en.json's words with config.mjs's English
 * prose, `pl` pl.json's (Maps of flat keys); `pairs` the guide's naturalness pairs - a batch text that is a pair's key
 * carries the pair's approved after in its Polish (the owner approved it; Q-E66-5's rule); `surfaces` docs/text-budgets.json's `surfaces` (each `{ target, limit }`);
 * `pilot` docs/dev/text-pilot.json parsed (the copies are held to it); `source(path)` a file's text or null, for the
 * facts' functions; `count(text)` the words of a text as T4 counts them (tests-text.mjs `wordCount`); `parity` T2's
 * detector (tests-text.mjs `pairParity`), run on each text's two afters, a form against its twin.
 */
export function batchSchema(doc, { en = new Map(), pl = new Map(), pairs = [], surfaces = null, pilot = null, source = () => null, count = plainWords,
    parity = null } = {}) {
    if (doc === null || typeof doc !== "object" || Array.isArray(doc)) return ["the file is not an object"];
    const out = [];
    for (const k of Object.keys(doc)) if (!BATCH_TOP.includes(k)) out.push(`the file has a field "${k}" (it holds ${BATCH_TOP.join(", ")})`);
    for (const k of BATCH_TOP) if (!Object.hasOwn(doc, k)) out.push(`the file has no field "${k}"`);
    if (!isText(doc.batch) || !isText(doc.stage)) out.push("batch and stage are not texts");
    if (!Array.isArray(doc.texts) || !doc.texts.length) return [...out, "texts is not a non-empty list"];
    const pilotStrings = Array.isArray(pilot?.strings) ? pilot.strings : [];
    const files = new Map();
    const fileText = f => { if (!files.has(f)) files.set(f, source(f)); return files.get(f); };
    const seen = new Set();
    doc.texts.forEach((t, i) => {
        const at = `texts[${i}]${isText(t?.key) ? ` (${t.key})` : ""}`;
        if (!sameFields(t, BATCH_FIELDS)) { out.push(`${at} is not { ${BATCH_FIELDS.join(", ")} }`); return; }
        if (!isText(t.key)) { out.push(`${at}: the key is not a text`); return; }
        if (seen.has(t.key)) out.push(`${at}: the key twice`);
        seen.add(t.key);
        if (isOut(t.key)) out.push(`${at}: a key Appendix C leaves out of B01a (topic A's, E68's, MONOCUB, TRIAL or a table-name label)`);
        const now = { en: pilotValue(en, t.key), pl: pilotValue(pl, t.key) };
        if (now.en === undefined) out.push(`${at}: not a key of lang/en.json or config.mjs's English prose${BATCH_RENAMED}`);
        if (now.pl === undefined) out.push(`${at}: not a key of lang/pl.json${BATCH_RENAMED}`);
        if (!BATCH_GROUPS.includes(t.group)) out.push(`${at}: the group ${JSON.stringify(t.group)} is not one of ${BATCH_GROUPS.join(", ")}`);
        if (!isText(t.surface) || (surfaces && !Object.hasOwn(surfaces, t.surface))) out.push(`${at}: the surface ${JSON.stringify(t.surface)} is not ${surfaces ? "one of docs/text-budgets.json's" : "a text"}`);
        if (!isText(t.screen)) out.push(`${at}: the screen is not a text`);
        if (!Array.isArray(t.readers) || !t.readers.length || !t.readers.every(isText)) out.push(`${at}: readers is not a list of texts`);
        /* The facts (O6, M1): never empty, each read in a file's function, or said why not. */
        if (!Array.isArray(t.facts) || !t.facts.length) out.push(`${at}: facts is not a non-empty list - a text is written from its facts first (O6)`);
        else t.facts.forEach((f, j) => {
            const fat = `${at}: facts[${j}]`;
            if (!sameFields(f, FACT_FIELDS) || !isText(f.fact)) { out.push(`${fat} is not { ${FACT_FIELDS.join(", ")} } with the fact a text`); return; }
            if (f.file === null && f.fn === null) {
                if (!isText(f.note)) out.push(`${fat}: no file and no function, and no note saying why (not found in code, a pilot fact)`);
                return;
            }
            if (!isText(f.file) || !isText(f.fn)) { out.push(`${fat}: the file and the function are not both texts (or both null)`); return; }
            if (f.note !== null && !isText(f.note)) out.push(`${fat}: the note is neither null nor a text`);
            const text = fileText(f.file);
            if (text === null || text === undefined) { out.push(`${fat}: ${f.file} is not a file of this tree`); return; }
            const name = f.fn.split(".")[0];
            if (!new RegExp(`(?<![\\w$])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w$])`).test(text)) out.push(`${fat}: ${f.file} does not spell ${name}`);
        });
        const facts = Array.isArray(t.facts) ? t.facts.length : 0;
        const keptShaped = t.kept === null || (Array.isArray(t.kept) && t.kept.every(n => Number.isInteger(n) && n >= 0 && n < facts) && new Set(t.kept).size === t.kept.length);
        if (!keptShaped) out.push(`${at}: kept is neither null nor a list of distinct indices into facts`);
        for (const list of ["removed", "needsCode", "disagreements"]) if (!Array.isArray(t[list]) || !t[list].every(isText)) out.push(`${at}: ${list} is not a list of texts`);
        let written = 0;
        for (const lang of ["en", "pl"]) {
            const side = t[lang];
            if (!sameFields(side, ["before", "after"])) { out.push(`${at}: ${lang} is not { before, after }`); continue; }
            if (!valueShaped(side.before)) { out.push(`${at}: ${lang}.before is neither a text nor a plural family's forms (other among them), each a text`); continue; }
            const a = side.after;
            if (a === null) continue;
            const shaped = typeof side.before === "string" ? isText(a)
                : (a !== null && typeof a === "object" && !Array.isArray(a) && sameValue(Object.keys(a).sort(), Object.keys(side.before).sort()) && Object.values(a).every(isText));
            if (!shaped) { out.push(`${at}: ${lang}.after is neither null nor ${typeof side.before === "string" ? "a text" : `the forms ${Object.keys(side.before).join(", ")}, each a text`}`); continue; }
            written++;
            const had = placeholdersOf(side.before), has = placeholdersOf(a);
            if (!sameValue(had, has)) out.push(`${at}: ${lang}.after's placeholders ${JSON.stringify(has)}, not its before's ${JSON.stringify(had)} (N2)`);
            const added = [...digitsOf(a)].filter(d => !digitsOf(side.before).has(d));
            if (added.length) out.push(`${at}: ${lang}.after adds the digit(s) ${added.join(", ")} to the prose (M5)`);
            if (formsText(a).some(x => BAD_DASHES.some(c => String(x).includes(c)))) out.push(`${at}: ${lang}.after holds an en or em dash or a minus sign - write "-"`);
            const limit = surfaces?.[t.surface]?.limit;
            if (typeof limit === "number") for (const [form, x] of Object.entries(typeof a === "string" ? { text: a } : a)) {
                const n = count(x);
                if (n > limit) out.push(`${at}: ${lang}.after${typeof a === "string" ? "" : `.${form}`} is ${n} words, over the ${t.surface} limit of ${limit} (B1)`);
            }
        }
        if (t.source === "written" && written && (t.kept === null || !t.kept.length)) out.push(`${at}: an after is written and kept names no fact (section 11's facts kept)`);
        /*
         * T2 ON THE AFTERS (E66 fix r2, 01.11.2026; the goal review's m5). N2 above compares an after with its own
         * before, all forms at once; T2 holds each form to its twin in the other language (one to one, other to other, a
         * Polish few and many to the English other) and fails the files. So B01a showed the owner two families whose
         * English .one filled {n} and the Polish .one did not (sabotageHint, coverHint), which could not land as shown
         * (STATUS Open 56). Run here on the two afters as the files would hold them, before a page shows them.
         */
        if (typeof parity === "function" && written === 2) {
            const flat = a => (typeof a === "string" ? { [t.key]: a } : Object.fromEntries(Object.entries(a).map(([form, x]) => [`${t.key}.${form}`, x])));
            for (const f of parity({ en: flat(t.en.after), pl: flat(t.pl.after) }).found ?? []) {
                out.push(`${at}: the afters break T2 (pairParity): ${f.what} - the files would refuse the pair as written`);
            }
        }
        if (!sameFields(t.reviews, Object.keys(BATCH_REVIEWS))) out.push(`${at}: reviews is not { ${Object.keys(BATCH_REVIEWS).join(", ")} }`);
        else for (const [r, verdicts] of Object.entries(BATCH_REVIEWS)) {
            const v = t.reviews[r];
            if (v !== null && !(sameFields(v, ["verdict", "points"]) && verdicts.includes(v.verdict) && Array.isArray(v.points) && v.points.every(isText))) {
                out.push(`${at}: reviews.${r} is neither null nor { verdict: ${verdicts.join(" | ")}, points }`);
            }
        }
        /* Verdicts only by the owner: one names the page the owner answered on, and comes after both afters are written. */
        const o = t.owner;
        if (o !== null && !(sameFields(o, OWNER_FIELDS) && OWNER_VERDICTS.includes(o.verdict) && typeof o.text === "string" && /^\d\d\.\d\d\.\d{4}$/.test(String(o.date)) && isText(o.page))) {
            out.push(`${at}: owner is neither null nor { verdict: ${OWNER_VERDICTS.join(" | ")}, text, date dd.mm.yyyy, page } - a verdict names the owner's page`);
        } else if (o !== null && written < 2) out.push(`${at}: an owner's verdict on a text whose afters are not both written`);
        else if (o !== null && t.source === "written" && o.page === PILOT_PAGE) out.push(`${at}: a written text's verdict on the pilot's page ${PILOT_PAGE}`);
        /* The pilot's copies (Q-E66-4): its number, its key, its approved afters and its verdict, nothing reviewed again. */
        if (!BATCH_SOURCES.includes(t.source)) out.push(`${at}: the source ${JSON.stringify(t.source)} is not one of ${BATCH_SOURCES.join(", ")}`);
        else if (t.source === "written" && t.pilot !== null) out.push(`${at}: a written text names pilot string ${t.pilot}`);
        else if (t.source === "pilot") {
            const p = Number.isInteger(t.pilot) ? pilotStrings[t.pilot - 1] : null;
            if (!p || p.key !== t.key) out.push(`${at}: pilot ${JSON.stringify(t.pilot)} is not this key's string in docs/dev/text-pilot.json`);
            else {
                for (const lang of ["en", "pl"]) {
                    const want = amendedAfter(t.key, lang, p[lang]?.after);
                    if (want === null) out.push(`${at}: B01A_AMENDED's ${lang} row for this key does not find its words once in the pilot's approved after`);
                    else if (!sameValue(t[lang]?.after, want)) out.push(`${at}: ${lang}.after is not the pilot's approved after${B01A_AMENDED[t.key]?.[lang] ? " with the owner's amendments (B01A_AMENDED)" : ""} (Q-E66-4: copied, not rewritten)`);
                }
                if (!pilotVerdict(t.owner, p.owner)) out.push(`${at}: owner is not the pilot's verdict on ${PILOT_PAGE}`);
                if (sameFields(t.reviews, Object.keys(BATCH_REVIEWS)) && Object.values(t.reviews).some(r => r !== null)) out.push(`${at}: a pilot copy carries a review (Q-E66-4: not reviewed again)`);
            }
        }
        /* A naturalness pair inside a batch text (palm.description holds N25 at d2538dac): the owner approved its "Po", so the
           batch's Polish after carries it rather than a third wording (Q-E66-5's rule); the rest of the text is the batch's. */
        for (const p of pairs) {
            const ownKey = p.key !== null && (p.key === t.key || p.key.startsWith(`${t.key}.`));
            if (!ownKey || !isText(p.after)) continue;
            const a = t.pl?.after;
            if (a !== null && a !== undefined && !formsText(a).some(x => typeof x === "string" && x.includes(p.after))) {
                out.push(`${at}: pl.after does not hold naturalness pair ${p.id}'s approved after "${p.after}"`);
            }
        }
    });
    if (doc.batch === "B01a" && pilotStrings.length) {
        for (const n of B01A_PILOT.take) {
            const key = pilotStrings[n - 1]?.key;
            if (key && !doc.texts.some(t => t?.key === key && t?.source === "pilot" && t?.pilot === n)) out.push(`pilot string ${n} (${key}) is not in the batch as the pilot's copy (Q-E66-4)`);
        }
        for (const n of B01A_PILOT.leave) {
            const key = pilotStrings[n - 1]?.key;
            if (key && doc.texts.some(t => t?.key === key)) out.push(`pilot string ${n} (${key}) is in the batch - Q-E66-4 leaves it out`);
        }
    }
    return out;
}

/** The batch's counts for the `text` part's line: by source, facts, afters, budgets, reviews and verdicts. */
export function batchCounts(doc, { surfaces = null, count = plainWords } = {}) {
    const texts = Array.isArray(doc?.texts) ? doc.texts.filter(t => t && typeof t === "object") : [];
    const facts = texts.flatMap(t => (Array.isArray(t.facts) ? t.facts : []));
    const over = (field, lang) => texts.filter(t => {
        const a = t?.[lang]?.after, n = surfaces?.[t.surface]?.[field];
        return a !== null && a !== undefined && typeof n === "number" && formsText(a).some(x => count(x) > n);
    }).length;
    return {
        texts: texts.length,
        written: texts.filter(t => t.source === "written").length,
        pilot: texts.filter(t => t.source === "pilot").length,
        facts: facts.length,
        inCode: facts.filter(f => isText(f?.file) && isText(f?.fn)).length,
        notInCode: facts.filter(f => f?.file === null && f?.fn === null).length,
        afters: { en: texts.filter(t => t.en?.after !== null && t.en?.after !== undefined).length, pl: texts.filter(t => t.pl?.after !== null && t.pl?.after !== undefined).length },
        overTarget: over("target", "en") + over("target", "pl"),
        overLimit: over("limit", "en") + over("limit", "pl"),
        reviews: Object.fromEntries(Object.keys(BATCH_REVIEWS).map(r => [r, texts.filter(t => t.reviews?.[r]).length])),
        owner: texts.filter(t => t.owner).length
    };
}

/** Where the batch stands in this tree's files (a reading, never a fault): still the before, the after landed (C7), or changed. */
export function batchState(doc, { en = new Map(), pl = new Map() } = {}) {
    return pilotState({ strings: Array.isArray(doc?.texts) ? doc.texts : [] }, { en, pl });
}

/** The readers' sheet (E66 C6): HTML, one card per text. `plOnly` leaves out every English text but the facts (DB26). */
export function batchSheet(doc, texts, { plOnly = false } = {}) {
    const words = { en: new Map([...texts.en, ...texts.prose]), pl: texts.pl };
    const cell = (key, value, lang) => (value === null || value === undefined
        ? `<div class="v none">not written yet</div>`
        : pilotVariants(key, value, lang, words[lang]).map(v => `<div class="v">${v.label ? `<span class="n">${escapeHtml(v.label)}</span> ` : ""}${escapeHtml(v.text)}</div>`).join(""));
    const list = (title, items) => (items.length ? `<p><b>${escapeHtml(title)}:</b></p><ul>${items.map(x => `<li>${escapeHtml(x)}</li>`).join("")}</ul>` : "");
    const review = (name, r) => (r === null
        ? `<li><b>${name}</b>: nothing left open</li>`
        : `<li><b>${name}</b>: ${escapeHtml(r.verdict)}${r.points.length ? `<ul>${r.points.map(p => `<li>${escapeHtml(p)}</li>`).join("")}</ul>` : ""}</li>`);
    const body = [`<h2>${plOnly ? "Teksty" : "The texts"} (${doc.texts.length})</h2>`];
    doc.texts.forEach((t, i) => {
        const kept = new Set(Array.isArray(t.kept) ? t.kept : []);
        const facts = t.facts.map((f, j) => `<li${kept.has(j) ? ` class="kept"` : ""}>${escapeHtml(f.fact)} <small>(${escapeHtml(f.file ? `${f.file} ${f.fn}` : f.note ?? "")})</small></li>`).join("");
        const rows = [...(plOnly ? [] : [["EN before", t.en.before, "en"], ["EN after", t.en.after, "en"]]), ["PL przed", t.pl.before, "pl"], ["PL po", t.pl.after, "pl"]];
        body.push(`<section class="s"><h3>${i + 1}. <code>${escapeHtml(t.key)}</code>${t.source === "pilot" ? ` <small>the pilot's pair ${t.pilot}, approved ${escapeHtml(t.owner?.date ?? "")}</small>` : ""}</h3>`
            + `<p class="meta">${escapeHtml(t.group)} · ${escapeHtml(t.surface)} · ${escapeHtml(t.screen)} · ${escapeHtml(t.readers.join(", "))}</p>`
            + `<p class="facts"><b>Facts</b>${kept.size ? " (kept in bold)" : ""}:</p><ol start="0">${facts}</ol>`
            + `<table><tbody>${rows.map(([label, value, lang]) => `<tr><th>${label}</th><td>${cell(t.key, value, lang)}</td></tr>`).join("")}</tbody></table>`
            + (plOnly ? "" : list("Removed, and where it went", t.removed) + list("Needs code", t.needsCode) + list("Disagrees with the code or a decision", t.disagreements)
                + `<ul class="reviews">${review("EN review", t.reviews.en)}${review("cold EN review", t.reviews.coldEn)}${review("PL review", t.reviews.pl)}${review("mechanics review", t.reviews.mechanics)}</ul>`)
            + "</section>");
    });
    const legend = "n = 1, 2, 5 where the text counts (a family through Intl.PluralRules); #1, #2, #3 fill a person with Aiko, then Daichi (a woman's name, a man's), "
        + "a room with Warsztat, Biblioteka, Kino and an item with Nóż kuchenny, Lina, Krzesło (masculine, feminine, neuter), each in turn. The facts are numbered from 0, as `kept` names them.";
    return `<!doctype html>
<html lang="${plOnly ? "pl" : "en"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Text batch ${escapeHtml(doc.batch)}</title>
<style>
:root { --bg: #fdfdfb; --fg: #1c1c1c; --line: #d8d8d0; --muted: #6a6a64; }
@media (prefers-color-scheme: dark) { :root { --bg: #18181a; --fg: #e8e8e4; --line: #3a3a3e; --muted: #9a9a94; } }
body { background: var(--bg); color: var(--fg); font: 15px/1.45 system-ui, sans-serif; margin: 16px; max-width: 980px; }
section { border-top: 1px solid var(--line); padding: 8px 0 12px; } h3 { margin: 4px 0; font-size: 16px; } h3 small, .meta, .n, .none, li small { color: var(--muted); font-size: 12px; }
table { border-collapse: collapse; width: 100%; margin: 6px 0; } th, td { border: 1px solid var(--line); padding: 4px 6px; vertical-align: top; text-align: left; }
th { width: 7em; font-weight: 600; } code { word-break: break-all; } .v + .v { border-top: 1px dotted var(--line); } li.kept { font-weight: 600; }
</style></head><body>
<h1>${plOnly ? `Partia ${escapeHtml(doc.batch)}: teksty polskie` : `The text batch ${escapeHtml(doc.batch)}`}</h1>
<p>Written by <code>node tools/text-render.mjs --batch</code> (E66 C6) from ${escapeHtml(BATCH_FILES[0])}. ${escapeHtml(legend)} HTML in a string is shown as written.</p>
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
    if (pilotAt >= 0) {
        /* The pilot's sheet alone (E65 C14): the file held to its shape first, as `node tools/check.mjs text` holds it. */
        const file = argv[pilotAt + 1], outAt = argv.indexOf("--out");
        if (!file || file.startsWith("--") || (outAt >= 0 && !argv[outAt + 1])) { console.log("text-render: --pilot takes a file, --out a file"); process.exit(2); }
        let doc;
        try { doc = JSON.parse(fs.readFileSync(path.resolve(file), "utf8")); } catch (err) { console.log(`text-render: pilot: ${file} does not parse (${err.message})`); process.exit(1); }
        const { naturalnessPairs } = await import(url.pathToFileURL(path.join(REPO, "scripts", "tests-text.mjs")).href);
        const { pairs } = naturalnessPairs(fs.readFileSync(path.join(REPO, "docs", "text-style.md"), "utf8"));
        const surfaces = Object.keys(JSON.parse(fs.readFileSync(path.join(REPO, "docs", "text-budgets.json"), "utf8")).surfaces ?? {});
        const problems = pilotSchema(doc, { en: new Map([...texts.en, ...texts.prose]), pl: texts.pl, pairs, surfaces });
        for (const p of problems) console.log(`text-render: pilot: ${p}`);
        if (problems.length) process.exit(1);
        const out = outAt >= 0 ? path.resolve(argv[outAt + 1]) : path.join(REPO, "audit", "harness", "results", "text", "pilot.html");
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, pilotSheet(doc, texts, { plOnly: argv.includes("--pl-only") }));
        const written = side => doc.strings.filter(s => s[side].after !== null).length;
        console.log(`text-render: pilot: ${doc.strings.length} string(s), ${doc.questions.length} question(s); afters written: en ${written("en")}, pl ${written("pl")}; `
            + `facts for ${doc.strings.filter(s => s.facts.length).length}; wrote ${path.relative(process.cwd(), out) || out}${argv.includes("--pl-only") ? " (Polish only)" : ""}`);
        process.exit(0);
    }
    const batchAt = argv.indexOf("--batch");
    if (batchAt >= 0) {
        /* A batch's sheet alone (E66 C6): the file held to its shape first, as `node tools/check.mjs text` holds it. */
        const file = argv[batchAt + 1], outAt = argv.indexOf("--out");
        if (!file || file.startsWith("--") || (outAt >= 0 && !argv[outAt + 1])) { console.log("text-render: --batch takes a file, --out a file"); process.exit(2); }
        let doc;
        try { doc = JSON.parse(fs.readFileSync(path.resolve(file), "utf8")); } catch (err) { console.log(`text-render: batch: ${file} does not parse (${err.message})`); process.exit(1); }
        const T = await import(url.pathToFileURL(path.join(REPO, "scripts", "tests-text.mjs")).href);
        const { pairs } = T.naturalnessPairs(fs.readFileSync(path.join(REPO, "docs", "text-style.md"), "utf8"));
        const surfaces = JSON.parse(fs.readFileSync(path.join(REPO, "docs", "text-budgets.json"), "utf8")).surfaces ?? {};
        const pilot = JSON.parse(fs.readFileSync(path.join(REPO, "docs", "dev", "text-pilot.json"), "utf8"));
        const source = f => { try { return fs.readFileSync(path.join(REPO, f), "utf8"); } catch { return null; } };
        const problems = batchSchema(doc, { en: new Map([...texts.en, ...texts.prose]), pl: texts.pl, pairs, surfaces, pilot, source, count: T.wordCount });
        for (const p of problems) console.log(`text-render: batch: ${p}`);
        if (problems.length) process.exit(1);
        const out = outAt >= 0 ? path.resolve(argv[outAt + 1]) : path.join(REPO, "audit", "harness", "results", "text", `batch-${doc.batch}.html`);
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, batchSheet(doc, texts, { plOnly: argv.includes("--pl-only") }));
        const c = batchCounts(doc, { surfaces, count: T.wordCount });
        console.log(`text-render: batch ${doc.batch}: ${c.texts} text(s) (written ${c.written}, pilot ${c.pilot}); facts ${c.facts}; afters written: en ${c.afters.en}, pl ${c.afters.pl}; `
            + `wrote ${path.relative(process.cwd(), out) || out}${argv.includes("--pl-only") ? " (Polish only)" : ""}`);
        process.exit(0);
    }
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
    const c = render.counts;
    console.log(`text-render: rendered en ${c.en} key(s), pl ${c.pl} (families ${c.families} across both), ${c.variants} string(s) in all; `
        + `fixtures for ${render.fixtures.length} placeholder name(s), ${render.unknown.length} unknown${render.unknown.length ? ` (${render.unknown.map(u => u.name).join(", ")})` : ""}; `
        + `${Object.keys(render.meanings).length} with two meanings; ${map ? `${map.counts.screens} screen(s), ${map.counts.unassigned} key(s) unassigned` : "no screen map"}`);
}
