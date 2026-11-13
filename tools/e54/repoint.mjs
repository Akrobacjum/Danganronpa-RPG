/**
 * The E54 split's second stage, reproducible: the readers that name the split file, pointed at the file that now
 * holds what they read (13.11.2026; the E54 plan's C0a and C0b).
 * ---------------------------------------------------------------------------
 *     node tools/e54/repoint.mjs [--manifest tools/e54/sheet.json] [--repo <dir>] [--dry]
 *
 * Run after tools/e54/split.mjs, on the tree it wrote, as a commit of its own: the split commit stays the pure move
 * moved-only reads, and this one changes only the suite, the contract register and the census documents. Driven by
 * the same manifest: which file holds a declaration is the manifest's answer (its `targets`; `keep` stays in the
 * facade), never a guess written into a rule here. What the manifest adds for this stage is its `repoint` part: the
 * files to rewrite, the sites whose new reading is a count or a list measured on the split tree (`sites`), and the
 * corrections to a reader the split exposed (`patches`, each with its why).
 *
 * WHAT IT WRITES.
 *   1. The family in tests-kit.mjs, as E41 left `hudText` and its kin: `<FAMILY>` (the facade first, then the
 *      targets in the manifest's order), the line put between two files (`const <FAMILY>_END = {};`, so no cut runs
 *      on into the next file), `<base>Text(sources)` (the family's texts joined; a file missing refuses by `must`),
 *      `<base>Fetch()` (the same, fetched) and `<base>By(read)` (a per-file helper of a test run over every file of
 *      the family: strings joined as `<base>Text` joins them, sets united; an empty reading refuses by `must`).
 *   2. A read of the whole source by name becomes a read of the family: `X.get("<file>")`, a `fetch` of its URL, a
 *      `find` of its entry, a test's own one-argument helper `h("<file>")`; a loop's `name === "<file>"` becomes
 *      `<FAMILY>.includes(name)`. The text a test read before the split is
 *      the text it reads after it, in more than one file.
 *   3. A reference by name becomes the holder's: `"<file>", "NAME"`, `h("<file>", X["<file>"], ["NAME", ...])`,
 *      `<file>#NAME`, `<file>:NAME`, `"<file> NAME"`, the contract register's `file:` beside its `symbol:`; a row of
 *      file -> names (`"<file>": [...]`) is regrouped by holder; a row of file -> named allowances
 *      (`"<file>": { NAME: ... }`) is regrouped with every file of the family in it, since the file it named was read
 *      whole; a count row `["<file>", /re/g, n]` becomes one row per file the expression now matches, which must add
 *      up to n. Where a test then names `"<file>"` only in a list of files it reads, the list takes the holders.
 *   4. The manifest's `sites` (a list or a count measured on the split tree) and `patches`.
 * Then it lists every reference to the file left in the files it rewrote, as `file:line test: text`, for a reader to
 * judge (a dynamic `import("./<file>")` is left: the facade exports every name it did).
 *
 * It refuses (exit 1, nothing written) when a rule finds what the manifest did not foresee: a name that is no
 * declaration of the family, a count that does not add up, a site or a patch whose text is not found exactly once.
 *
 * THE PROOF IS NOT HERE. Tiers 0-1 on the two commits are: 0 failed, the skips skip-baseline.json's - and every test
 * this touched still reading something, which its `must`s and a reader's look at the list below say.
 */

import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { createRequire } from "node:module";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = (name, fallback) => { const at = argv.indexOf(name); return at >= 0 ? argv[at + 1] : fallback; };
const REPO = path.resolve(opt("--repo", path.resolve(HERE, "..", "..")));
const MANIFEST = path.resolve(opt("--manifest", path.join(HERE, "sheet.json")));
const DRY = argv.includes("--dry");

const req = createRequire(path.join(path.resolve(HERE, "..", ".."), "audit", "harness", "package.json"));
const espree = req("espree");

const problems = [];
const refuse = message => problems.push(message);
const say = message => console.log(`e54-repoint: ${message}`);

const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
const RP = manifest.repoint ?? {};
const SOURCE = path.basename(manifest.source);                       // sheet.mjs
const BASE = SOURCE.replace(/\.mjs$/, "");                            // sheet
const CAMEL = BASE.replace(/-(\w)/g, (_, c) => c.toUpperCase());     // sheet
const UPPER = BASE.toUpperCase().replace(/-/g, "_");                  // SHEET
const FAMILY_CONST = `${UPPER}_FAMILY`, END_CONST = `${UPPER}_FAMILY_END`;
const TEXT_FN = `${CAMEL}Text`, FETCH_FN = `${CAMEL}Fetch`, BY_FN = `${CAMEL}By`;
const FAMILY = [SOURCE, ...manifest.targets.map(t => path.basename(t.file))];

/* Which file holds a name: read off the split tree's files (their top-level declarations), and held to the manifest -
   a moved name must stand in its target, so a tree that is not the manifest's split refuses here. */
const holderOf = new Map();
for (const file of FAMILY) {
    const ast = espree.parse(fs.readFileSync(path.join(REPO, "scripts", file), "utf8"), { ecmaVersion: "latest", sourceType: "module" });
    for (const st of ast.body) {
        const d = st.type === "ExportNamedDeclaration" ? st.declaration : st;
        const names = d?.type === "VariableDeclaration" ? d.declarations.map(x => x.id.name).filter(Boolean)
            : d?.type === "FunctionDeclaration" || d?.type === "ClassDeclaration" ? [d.id.name] : [];
        for (const n of names) holderOf.set(n, file);
    }
}
for (const t of manifest.targets) for (const [name, kind] of Object.entries(t.names)) {
    if (kind.endsWith("?") && !holderOf.has(name)) continue;   // a declaration a line adds, not in this tree
    if (holderOf.get(name) !== path.basename(t.file)) refuse(`${name} is the manifest's for ${path.basename(t.file)} and stands in ${holderOf.get(name) ?? "no file of the family"} - run tools/e54/split.mjs first, on this manifest`);
}
/* `repoint.stays`: names a row pairs with the source that are no declaration and stay with it - settings.mjs's rows
   `"settings.mjs", "voiceTile"` name a key of its SETTINGS table (E54 W3). Each must stand in the facade as `name:`
   or `"name"`, so a name mistyped here refuses rather than passes. */
const STAYS = new Set(RP.stays ?? []);
{
    const facadeText = fs.readFileSync(path.join(REPO, "scripts", SOURCE), "utf8");
    for (const name of STAYS) if (!new RegExp(`(?<![\\w$])${name}\\s*:|"${name}"`).test(facadeText)) refuse(`repoint.stays: "${name}" is no key or name in ${SOURCE}`);
}
const holder = (name, where) => {
    if (!holderOf.has(name) && STAYS.has(name)) return SOURCE;
    const file = holderOf.get(name);
    if (!file) refuse(`${where}: "${name}" is named beside ${SOURCE} and is no declaration the manifest places - repoint it by a row of its own`);
    return file ?? SOURCE;
};
const familyOrder = files => [...new Set(files)].sort((a, b) => FAMILY.indexOf(a) - FAMILY.indexOf(b));
const q = file => `"${file}"`;
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const F = esc(SOURCE);

const read = rel => fs.readFileSync(path.join(REPO, rel), "utf8");
const familyRaw = new Map(FAMILY.map(file => [file, read(path.join("scripts", file))]));
/** A file with its comments blanked (each comment's characters, newlines kept, become spaces): espree's own comments. */
const blanked = text => {
    const ast = espree.parse(text, { ecmaVersion: "latest", sourceType: "module", range: true, comment: true });
    let out = text;
    for (const c of ast.comments) out = out.slice(0, c.range[0]) + out.slice(c.range[0], c.range[1]).replace(/[^\n]/g, " ") + out.slice(c.range[1]);
    return out;
};
const familyCode = new Map([...familyRaw].map(([file, text]) => [file, blanked(text)]));
const countIn = (text, source, flags) => (text.match(new RegExp(source, flags.includes("g") ? flags : flags + "g")) ?? []).length;

/* ---- 1. the family in tests-kit.mjs ---- */
const KIT = "scripts/tests-kit.mjs";
const edits = new Map();   // rel -> text
const textOf = rel => edits.get(rel) ?? read(rel);
const kitAfter = RP.kitAfter ?? "voteText";
{
    let kit = textOf(KIT);
    if (new RegExp(`\\bconst ${FAMILY_CONST}\\b`).test(kit)) refuse(`${KIT} already declares ${FAMILY_CONST} - this tree was repointed`);
    const at = kit.search(new RegExp(`^function ${kitAfter}\\(`, "m"));
    if (at < 0) refuse(`${KIT} declares no function ${kitAfter}() to put the family after`);
    else {
        const end = kit.indexOf("\n}\n", at) + 3;
        const block = `
/**
 * The ${BASE}'s family (E54): ${SOURCE} - the facade, which keeps ${manifest.keep === "*" ? "everything else" : Object.keys(manifest.keep).map(n => `\`${n}\``).join(", ")} - and the files its
 * code moved into, in the order of the split's manifest (tools/e54/${path.basename(MANIFEST)}): ${FAMILY.slice(1).join(", ")}.
 * Written by tools/e54/repoint.mjs from that manifest. A reader of ${SOURCE}'s text reads the family through \`${TEXT_FN}\`
 * (or \`${FETCH_FN}\`, or \`${BY_FN}\` over a helper of its own) and follows each file here without a repoint of its own.
 */
const ${FAMILY_CONST} = Object.freeze([${FAMILY.map(q).join(", ")}]);

/** The line \`${TEXT_FN}\` puts between two files: \`topLevelFunction\`'s second end, so no cut runs on into the next file. */
const ${END_CONST} = "const ${END_CONST} = {};";

/**
 * The ${BASE}'s family's texts, raw, in ${FAMILY_CONST}'s order, joined by the line \`const ${END_CONST} = {};\` (E54):
 * what a read of ${SOURCE}'s whole text read while it was one file. A reader strips the comments itself, as it did; a
 * \`fnSource\` or \`topLevelFunction\` of the text cuts a function in its own file. A file of the family that is not among
 * \`sources\` refuses by \`must\`, by name.
 */
function ${TEXT_FN}(sources, family = ${FAMILY_CONST}) {
    const map = sources instanceof Map ? sources : new Map(sources);
    const gone = family.filter(file => typeof map.get(file) !== "string" || !map.get(file).length);
    must(!gone.length, \`\${gone.join(", ")}, of the ${BASE}'s family, \${gone.length > 1 ? "are" : "is"} not among the sources - this reads nothing of \${gone.length > 1 ? "them" : "it"}\`);
    return family.map(file => map.get(file)).join(\`\\n\${${END_CONST}}\\n\`);
}

/** \`${TEXT_FN}\` of the family as this browser is served it: what a \`fetch\` of ${SOURCE}'s URL read while it was one file. */
async function ${FETCH_FN}(family = ${FAMILY_CONST}) {
    return ${TEXT_FN}(await Promise.all(family.map(async file => [file, await fetch(\`/modules/\${MODULE_ID}/scripts/\${file}\`).then(lfText)])), family);
}

/**
 * A test's own reader of one file, run over every file of the ${BASE}'s family: texts joined as \`${TEXT_FN}\` joins them,
 * sets united. An empty text, an empty union or a reader that answers anything else refuses by \`must\`.
 */
function ${BY_FN}(reader, family = ${FAMILY_CONST}) {
    const parts = family.map(file => [file, reader(file)]);
    if (parts.every(([, value]) => typeof value === "string")) {
        const empty = parts.filter(([, value]) => !value.length).map(([file]) => file);
        must(!empty.length, \`\${empty.join(", ")}, of the ${BASE}'s family, read as nothing - this reads nothing of \${empty.length > 1 ? "them" : "it"}\`);
        return parts.map(([, value]) => value).join(\`\\n\${${END_CONST}}\\n\`);
    }
    must(parts.every(([, value]) => value instanceof Set), "a reader of the ${BASE}'s family answered neither a text nor a set for every file");
    const all = new Set(parts.flatMap(([, value]) => [...value]));
    must(all.size > 0, "the ${BASE}'s family read as an empty set - this reads nothing");
    return all;
}
`;
        kit = kit.slice(0, end) + block + kit.slice(end);
        const exp = kit.search(new RegExp(`^export \\{[\\s\\S]*?\\b${kitAfter},`, "m"));
        const tok = exp < 0 ? -1 : kit.indexOf(`${kitAfter},`, exp);
        if (tok < 0) refuse(`${KIT}'s export block names no ${kitAfter} to put the family's names after`);
        else kit = kit.slice(0, tok) + `${kitAfter}, ${FAMILY_CONST}, ${TEXT_FN}, ${FETCH_FN}, ${BY_FN},` + kit.slice(tok + kitAfter.length + 1);
        edits.set(KIT, kit);
    }
}

/* ---- 3. the generic forms, over each file the manifest's repoint names ---- */
const TIER_FILES = RP.files ?? ["scripts/tests-tier0.mjs", "scripts/tests-tier1.mjs", "scripts/tests-tier2.mjs"];
const report = [];   // [rel, test, rule, before, after]
const NOT_HELPERS = new Set(["import", "fetch", "includes", "has", "get", "set", "add", "delete", "push", "startsWith", "endsWith", "indexOf",
    "test", "match", "filter", "find", "some", "every", "equal", "ok", "must", "require", "String", "JSON", "concat"]);

/** A test's chunks: each `    ["...` line at the tier files' indent opens one. Rules that look at a whole test use them. */
const chunksOf = text => {
    const starts = [...text.matchAll(/^ {4}\["([^"\n]{0,24})/gm)].map(m => ({ at: m.index, name: (m[1].match(/^R\d+/) ?? [m[1]])[0] }));
    const out = [{ at: 0, name: "(head)" }, ...starts];
    return out.map((c, i) => ({ ...c, end: out[i + 1]?.at ?? text.length }));
};
const testAt = (text, pos) => chunksOf(text).findLast(c => c.at <= pos)?.name ?? "(head)";

/** A balanced block from the bracket at `open`, string literals skipped; -1 past `limit` characters. */
const closeOf = (text, open, limit = Infinity) => {
    const pair = { "{": "}", "[": "]", "(": ")" }[text[open]];
    let depth = 0;
    for (let i = open; i < text.length && i - open < limit; i++) {
        const ch = text[i];
        if (ch === "\"" || ch === "'" || ch === "`") { for (i++; i < text.length && text[i] !== ch; i++) if (text[i] === "\\") i++; continue; }
        if (ch === text[open]) depth++;
        else if (ch === pair && --depth === 0) return i;
    }
    return -1;
};

/** Whether `at` stands in a comment: a line that opens with `*`, `/*` or `//`, or a `//` before it outside a string. */
const inComment = (text, at) => {
    const line = text.slice(text.lastIndexOf("\n", at - 1) + 1, at);
    if (/^\s*(?:\*|\/\*|\/\/)/.test(line)) return true;
    const code = line.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g, "\"\"");
    return /\/\//.test(code);
};
const bare = map => /^\(.*\)$/.test(map) && closeOf(map, 0) === map.length - 1 ? map.slice(1, -1) : map;

function rewrite(rel, text) {
    const note = (pos, rule, before, after) => report.push([rel, testAt(text, pos), rule, before, after]);
    const used = new Set();

    // a row of file -> named allowances, the whole file read: regrouped, every file of the family in it
    const ALLOW = new RegExp(`^( *)"${F}": \\{`, "gm");
    for (let m; (m = ALLOW.exec(text));) {
        const open = m.index + m[0].length - 1, close = closeOf(text, open);
        const body = text.slice(open + 1, close);
        const entries = [];
        let pending = [];
        for (const line of body.split("\n")) {
            const e = line.match(/^\s*(\w+):\s/);
            if (e) { entries.push({ name: e[1], lines: [...pending, line] }); pending = []; }
            else if (line.trim()) (entries.length && !/^\s*\/\//.test(line) ? entries.at(-1).lines : pending).push(line);
        }
        const rest = body.replace(/\/\/[^\n]*/g, "").trim();
        if (rest && (!entries.length || /^[ \t]*"?\w+"?:[ \t]*[^\n]*,[ \t]*"?\w+"?:/m.test(body.replace(/"(?:[^"\\\n]|\\.)*"/g, "\"\"")))) {
            // a count or a record per file, not named allowances one per line: left as it is - its test reads it and
            // fails loudly when the split moved what it counts, and a site of the manifest (`rows`) repoints it
            ALLOW.lastIndex = close + 1;
            continue;
        }
        const groups = new Map(FAMILY.map(file => [file, []]));
        for (const e of entries) groups.get(holder(e.name, `${rel} "${SOURCE}": { ${e.name} }`)).push(e);
        const ind = m[1];
        const out = [...groups].map(([file, list]) => list.length
            ? `${ind}${q(file)}: {\n${list.map((e, i) => { const ls = e.lines.map(l => l.replace(/,\s*$/, "")); ls[ls.length - 1] += i < list.length - 1 ? "," : ""; return ls.join("\n"); }).join("\n")}\n${ind}}`
            : `${ind}${q(file)}: {}`).join(",\n");
        note(m.index, "allowances regrouped", `"${SOURCE}": { ${entries.length} names }`, [...groups].map(([f, l]) => `${f} ${l.length}`).join(", "));
        text = text.slice(0, m.index) + out + text.slice(close + 1);
        ALLOW.lastIndex = m.index + out.length;
    }

    // a row of file -> names: regrouped by holder
    text = text.replace(new RegExp(`"${F}": \\[((?:\\s*"\\w+",?)+)\\s*\\]`, "g"), (all, list, at) => {
        const names = [...list.matchAll(/"(\w+)"/g)].map(x => x[1]);
        const by = new Map();
        for (const n of names) { const f = holder(n, `${rel} "${SOURCE}": [${n}]`); by.set(f, [...(by.get(f) ?? []), n]); }
        const out = familyOrder([...by.keys()]).map(f => `${q(f)}: [${by.get(f).map(q).join(", ")}]`).join(", ");
        note(at, "names regrouped", all, out);
        return out;
    });

    // a pair: "<file>", "NAME"
    text = text.replace(new RegExp(`"${F}", "(\\w+)"`, "g"), (all, name, at) => {
        if (inComment(text, at)) return all;
        const file = holder(name, `${rel} "${SOURCE}", "${name}"`);
        if (file === SOURCE) return all;
        used.add(`${at}`);
        note(at, "pair", all, `${q(file)}, "${name}"`);
        return `${q(file)}, "${name}"`;
    });

    // a reader handed the file, its text and the names it reads: h("<file>", X["<file>"], ["NAME", ...])
    text = text.replace(new RegExp(`\\("${F}", (\\w+)\\["${F}"\\], \\[((?:"\\w+"(?:, )?)+)\\]`, "g"), (all, obj, list, at) => {
        const files = familyOrder([...list.matchAll(/"(\w+)"/g)].map(x => holder(x[1], `${rel} (${SOURCE}, [${x[1]}])`)));
        if (files.length !== 1) { refuse(`${rel}: ${all} reads names of ${files.join(", ")} - one reader per file, by a row of its own`); return all; }
        note(at, "reader", all, `(${q(files[0])}, ${obj}[${q(files[0])}], [${list}]`);
        return `(${q(files[0])}, ${obj}[${q(files[0])}], [${list}]`;
    });

    // a key: <file>#NAME, <file>:NAME, "<file> NAME"
    text = text.replace(new RegExp(`(?<![\\w-])${F}([#:])(\\w+)`, "g"), (all, sep, name, at) => {
        if (!holderOf.has(name) || inComment(text, at)) return all;
        const file = holderOf.get(name);
        if (file === SOURCE) return all;
        note(at, "key", all, `${file}${sep}${name}`);
        return `${file}${sep}${name}`;
    });
    text = text.replace(new RegExp(`"${F} (\\w+)(?=[" ])`, "g"), (all, name, at) => {
        if (!holderOf.has(name) || inComment(text, at)) return all;
        const file = holderOf.get(name);
        if (file === SOURCE) return all;
        note(at, "key", all, `"${file} ${name}`);
        return `"${file} ${name}`;
    });

    // a cut from one declaration until the next, which the split put in another file: until the family's line between
    // the start's file and the next one (`const <FAMILY>_END = {};`), where the start's file is not the family's last
    text = text.replace(/(\bbodyOf\([^;\n]*?, ")([^"\n]+)(", \{ until: ")([^"\n]+)(")/g, (all, a, start, b, marker, c, at) => {
        const nameOf = s2 => s2.match(/^(?:export )?(?:async )?(?:function\*? |const |let |class )([\w$]+)/)?.[1];
        const from = holderOf.get(nameOf(start)), to = holderOf.get(nameOf(marker));
        if (!from || !to || from === to) return all;
        if (from === FAMILY.at(-1)) { refuse(`${rel} ${testAt(text, at)}: a cut of ${nameOf(start)} until ${nameOf(marker)}, now in ${to}; ${from} is the family's last file, with no line after it - order the manifest's targets so it is not`); return all; }
        const end = `const ${END_CONST} = {};`;
        note(at, "cut across files", marker, end);
        return `${a}${start}${b}${end}${c}`;
    });
    // a count row: ["<file>", /re/flags, n] - one row per file the expression matches now, adding up to n
    text = text.replace(new RegExp(`\\["${F}", /((?:\\\\.|[^/\\n])+)/([gimsuy]*), (\\d+)\\]`, "g"), (all, source, flags, n, at) => {
        const counts = FAMILY.map(file => [file, countIn(familyCode.get(file), source, flags)]).filter(([, c]) => c);
        const sum = counts.reduce((s, [, c]) => s + c, 0);
        if (sum !== Number(n)) { refuse(`${rel}: ${all} - the family matches it ${sum} time(s), not ${n}: the split changed what it counts`); return all; }
        const out = counts.map(([file, c]) => `[${q(file)}, /${source}/${flags}, ${c}]`).join(", ");
        note(at, "count row", all, out);
        return out;
    });

    // a whole-text read by name: X.get("<file>"), a fetch of its URL, a find of its entry, a helper of the test's own
    const MAP = `new Map\\(await otherSources\\(\\)\\)|\\(new Map\\(await otherSources\\(\\)\\)\\)|\\(await moduleSources\\(\\)\\)|\\(await otherSources\\(\\)\\)|\\b[A-Za-z_$][\\w$]*`;
    text = text.replace(new RegExp(`(${MAP})\\.get\\("${F}"\\)(?: \\?\\? "")?`, "g"), (all, map, at) => {
        note(at, "text", all, `${TEXT_FN}(${bare(map)})`); used.add("text");
        return `${TEXT_FN}(${bare(map)})`;
    });
    text = text.replace(new RegExp(`fetch\\(\`/modules/\\$\\{MODULE_ID\\}/scripts/${F}\`\\)\\.then\\(lfText\\)`, "g"), (all, at) => {
        note(at, "fetch", all, `${FETCH_FN}()`); used.add("fetch");
        return `${FETCH_FN}()`;
    });
    text = text.replace(new RegExp(`\\b([A-Za-z_$][\\w$]*)\\.find\\(\\(\\[(\\w+)\\]\\) => \\2 === "${F}"\\)\\?\\.\\[1\\](?: \\?\\? "")?`, "g"), (all, list, _v, at) => {
        note(at, "text", all, `${TEXT_FN}(${list})`); used.add("text");
        return `${TEXT_FN}(${list})`;
    });
    // a list of files read through a helper: ["a.mjs", "<file>"].map(h) - the file's element through `<base>By(h)`
    text = text.replace(new RegExp(`(\\[(?:\\s*"[\\w-]+\\.mjs",?)*\\s*"${F}"(?:,\\s*"[\\w-]+\\.mjs")*\\s*\\])\\.map\\(([A-Za-z_$][\\w$]*)\\)`, "g"), (all, list, fn, at) => {
        if (NOT_HELPERS.has(fn)) return all;
        const out = `${list}.map(file => "${SOURCE}" === file ? ${BY_FN}(${fn}) : ${fn}(file))`;
        note(at, "helper over a list", all, out); used.add("by");
        return out;
    });
    // the same list once another cut's repoint wrote it so (cuts run one after another on E54's day): one more branch
    text = text.replace(new RegExp(`(\\[(?:\\s*"[\\w-]+\\.mjs",?)*\\s*"${F}"(?:,\\s*"[\\w-]+\\.mjs")*\\s*\\]\\.map\\(file => )((?:"[\\w-]+\\.mjs" === file \\? [\\w$]+By\\([\\w$]+\\) : )+)([A-Za-z_$][\\w$]*)\\(file\\)\\)`, "g"), (all, head, chain, fn, at) => {
        if (chain.includes(`"${SOURCE}" === file`)) return all;
        const out = `${head}"${SOURCE}" === file ? ${BY_FN}(${fn}) : ${chain}${fn}(file))`;
        note(at, "helper over a list", all, out); used.add("by");
        return out;
    });
    // a loop's test for the file among others: any file of the family now (R1476 read only the facade's hooks without it)
    text = text.replace(new RegExp(`\\b([A-Za-z_$][\\w$]*) !== "${F}"`, "g"), (all, name, at) => {
        note(at, "file test", all, `!${FAMILY_CONST}.includes(${name})`); used.add("family");
        return `!${FAMILY_CONST}.includes(${name})`;
    });
    text = text.replace(new RegExp(`\\b([A-Za-z_$][\\w$]*) === "${F}"`, "g"), (all, name, at) => {
        note(at, "file test", all, `${FAMILY_CONST}.includes(${name})`); used.add("family");
        return `${FAMILY_CONST}.includes(${name})`;
    });
    text = text.replace(new RegExp(`(?<![\\w$.])([A-Za-z_$][\\w$]*)\\("${F}"\\)`, "g"), (all, fn, at) => {
        if (NOT_HELPERS.has(fn)) return all;
        note(at, "helper", all, `${BY_FN}(${fn})`); used.add("by");
        return `${BY_FN}(${fn})`;
    });

    // a list of files a test reads, once the test names the file nowhere else: every file of the family, as the file
    // was read whole (a test that reads one function of it by a pair reads it in its holder, which the family holds)
    const chunks = chunksOf(text).reverse();
    for (const c of chunks) {
        const body = text.slice(c.at, c.end);
        const left = [...body.matchAll(new RegExp(`"${F}"`, "g"))];
        if (!left.length) continue;
        // only a list of files: every element a file's name or a spread (`["a.mjs", ...FAMILY, "<file>"]`), on one line
        // and a list the test reads - iterated (`for (... of [`), named (`const FILES = [`), or handed to a reader
        // (`.every(`, `.map(` ...) - not an expected reading (R1259's `chapterEnd: [["chapter.mjs"], true]`), and not one
        // destructured by position (`const [a, b] = [...].map(read)`, which more elements would shift)
        const listAround = x => {
            const open = body.lastIndexOf("[", x.index), close = body.indexOf("]", x.index);
            if (open < 0 || close < 0 || /\n/.test(body.slice(open, close))) return false;
            if (!/^\[\s*(?:(?:"[\w-]+\.mjs"|\.\.\.[\w$.()]+)\s*,\s*)*(?:"[\w-]+\.mjs"|\.\.\.[\w$.()]+)\s*\]$/.test(body.slice(open, close + 1))) return false;
            const before = body.slice(Math.max(0, open - 200), open), after = body.slice(close + 1, close + 200);
            if (/\b(?:const|let|var)\s*\[[^\]]*\]\s*=\s*$/.test(before)) return false;
            if (new RegExp(`^\\.map\\(file => "${F}" === file`).test(after)) return false;
            return /\bof\s*$/.test(before) || /\b(?:const|let|var)\s+[\w$]+\s*=\s*$/.test(before)
                || /^\s*\.(?:every|some|filter|forEach|includes|flatMap|map)\(/.test(after);
        };
        // the occurrences in a list of files; another (a planted fixture's `["<file>", "<its code>"]`) stays as it is
        const inLists = left.filter(listAround);
        // any other mention in code (strings, templates and comments blanked: a message's prose names the file as it may)
        const code = body.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g, "\"\"");
        const otherUse = new RegExp(`(?<![\\w-])${F}`).test(code);
        if (!inLists.length || otherUse) continue;
        let out = body;
        for (const x of [...inLists].reverse()) out = out.slice(0, x.index) + FAMILY.map(q).join(", ") + out.slice(x.index + x[0].length);
        note(c.at, "file list", `${inLists.length} x "${SOURCE}"`, FAMILY.join(", "));
        text = text.slice(0, c.at) + out + text.slice(c.end);
    }
    return { text, used };
}

/* ---- 2. the sites measured on the split tree, first: their text is the tree's as split.mjs left it ---- */
const once = (rel, text, find, what) => {
    const n = text.split(find).length - 1;
    if (n !== 1) refuse(`${rel}: ${what} - ${JSON.stringify(find.slice(0, 80))} is found ${n} time(s), not once`);
    return n === 1;
};
for (const site of RP.sites ?? []) {
    const rel = site.file;
    let text = textOf(rel);
    if (!once(rel, text, site.find, `site ${site.test}`)) continue;
    let out = site.find;
    if (site.kind === "reread") {
        // a list of the files an expression reads, sorted: the family's files that match it now
        const files = FAMILY.filter(file => new RegExp(site.regex).test(site.comments === "kept" ? familyRaw.get(file) : familyCode.get(file)));
        if (!files.length) { refuse(`${rel}: site ${site.test} - no file of the family matches ${site.regex}`); continue; }
        out = site.find.replace(`"${SOURCE}"`, files.map(q).join(", "));
        if (site.sorted) out = out.replace(/\[([^\]]*)\]/, (_, list) => `[${[...list.matchAll(/"[^"]+"/g)].map(x => x[0]).sort().join(", ")}]`);
    } else if (site.kind === "recount") {
        // a count per file of an expression, comments left in
        const was = Number(site.find.match(/: (\d+)$/)?.[1]);
        const counts = FAMILY.map(file => [file, countIn(familyRaw.get(file), site.regex, "g")]).filter(([, c]) => c);
        const sum = counts.reduce((s, [, c]) => s + c, 0);
        if (sum !== was) { refuse(`${rel}: site ${site.test} - the family counts ${sum}, not ${was}`); continue; }
        out = counts.map(([file, c]) => `${q(file)}: ${c}`).join(", ");
    } else if (site.kind === "census-row") {
        // a census document's row, file:lines: one row per file the expression stands in, at its lines now
        const row = text.split("\n").find(l => l.startsWith(site.find));
        const rows = FAMILY.map(file => [file, familyRaw.get(file).split("\n").map((l, i) => new RegExp(site.regex).test(l) ? i + 1 : 0).filter(Boolean)])
            .filter(([, at]) => at.length);
        const rest = row.slice(row.indexOf(" | ", 2));
        const out2 = rows.map(([file, at]) => `| ${file}:${at.join(", ")}${rest}`).join("\n");
        report.push([rel, site.test, "census row", row.slice(0, 60), rows.map(([f, a]) => `${f} ${a.length}`).join(", ")]);
        text = text.replace(row, out2);
        edits.set(rel, text);
        continue;
    } else if (site.kind === "rows") {
        // a row per file of counts, split into one row per file of the family: the new rows are a reading of the split
        // tree written in the manifest (`replace`), and must add up, key by key, to the row they replace
        const sum = rows => { const out = {}; for (const m of rows.matchAll(/"(\w+)":\s*(\d+)/g)) out[m[1]] = (out[m[1]] ?? 0) + Number(m[2]); return JSON.stringify(Object.entries(out).sort()); };
        const files = [...site.replace.matchAll(/"([\w-]+\.mjs)":/g)].map(x => x[1]);
        if (files.some(f => !FAMILY.includes(f))) { refuse(`${rel}: site ${site.test} - its rows name a file outside the family`); continue; }
        if (sum(site.find) !== sum(site.replace)) { refuse(`${rel}: site ${site.test} - the rows add up to ${sum(site.replace)}, the row they replace to ${sum(site.find)}: the tree is not the one they were read on - read them again`); continue; }
        if (site.sorted) {
            // the object the row stands in is compared in its files' order (`localeCompare`, as the test sorts): the old
            // row taken out, each new row put before the first key that sorts after it
            const pos = text.indexOf(site.find);
            let open = pos, depth = 0;
            for (; open >= 0; open--) { if (text[open] === "}") depth++; else if (text[open] === "{") { if (depth === 0) break; depth--; } }
            const close = closeOf(text, open);
            let body = text.slice(open + 1, close);
            const at = body.indexOf(site.find);
            body = body.slice(0, at) + body.slice(at + site.find.length).replace(/^,[ \t]*/, "");
            for (const row of site.replace.match(/"[\w-]+\.mjs":\s*\{[^}]*\}/g)) {
                const file = row.match(/"([\w-]+\.mjs)"/)[1];
                const next = [...body.matchAll(/"([\w-]+\.mjs)":/g)].find(k => k[1].localeCompare(file) > 0);
                body = next ? body.slice(0, next.index) + `${row}, ` + body.slice(next.index) : body.replace(/\s*$/, m => `, ${row}${m}`);
            }
            report.push([rel, site.test, "site rows, sorted", site.find, site.replace]);
            edits.set(rel, text.slice(0, open + 1) + body + text.slice(close));
            continue;
        }
        out = site.replace;
    } else { refuse(`site ${site.test}: no kind ${site.kind}`); continue; }
    report.push([rel, site.test, `site ${site.kind}`, site.find, out]);
    edits.set(rel, text.replace(site.find, out));
}
/**
 * A list that was in its files' order before the rename is put back in it after (R436, R3404 compare a sorted reading):
 * an array whose elements are all keyed by a file - `"<file>#..."` strings, or tuples whose first element is a file - and
 * that names a file of the family, sorted as JavaScript's default `sort` sorts (String of each), when the same list with
 * the family's files read as the old file was sorted and is not now. Each element takes another's slot, so the list's
 * line breaks stay where they were.
 */
function resortLists(rel, text) {
    const targets = FAMILY.slice(1);
    // a reading keyed by file: "<file>#<name>..." strings, or tuples led by a file - not a list of files to read, whose
    // order is the test's own
    const fileLed = v => typeof v === "string" ? /^[\w-]+\.mjs[#:]/.test(v) : Array.isArray(v) && v.length > 1 && typeof v[0] === "string" && /^[\w-]+\.mjs$/.test(v[0]);
    const asBefore = v => String(v).replace(new RegExp(`(?<![\\w-])(?:${targets.map(esc).join("|")})(?![\\w-])`, "g"), SOURCE);
    const sorted = list => list.every((x, i) => !i || String(list[i - 1]) <= String(x));
    for (let open = text.indexOf("["); open >= 0; open = text.indexOf("[", open + 1)) {
        if (inComment(text, open)) continue;
        const close = closeOf(text, open, 4000);
        if (close < 0) continue;
        const parts = [];
        let depth = 0, from = open + 1;
        for (let i = open + 1; i < close; i++) {
            const ch = text[i];
            if (ch === "\"" || ch === "'") { for (i++; i < close && text[i] !== ch; i++) if (text[i] === "\\") i++; continue; }
            if ("[{(".includes(ch)) depth++;
            else if ("]})".includes(ch)) depth--;
            else if (ch === "," && depth === 0) { parts.push([from, i]); from = i + 1; }
        }
        parts.push([from, close]);
        const items = parts.map(([a, b]) => { const raw = text.slice(a, b); const lead = raw.match(/^\s*/)[0].length, tail = raw.match(/\s*$/)[0].length; return { a: a + lead, b: b - tail }; })
            .filter(x => x.b > x.a);
        if (items.length < 2) continue;
        let values;
        try { values = items.map(x => JSON.parse(text.slice(x.a, x.b))); } catch { continue; }
        if (!values.every(fileLed) || !values.some(v => targets.some(t => String(v).includes(t)))) continue;
        if (!sorted(values.map(asBefore)) || sorted(values)) continue;
        const order = values.map((v, i) => i).sort((i, j) => (String(values[i]) < String(values[j]) ? -1 : String(values[i]) > String(values[j]) ? 1 : i - j));
        let out = text.slice(0, open + 1), at = open + 1;
        items.forEach((x, k) => { out += text.slice(at, x.a) + text.slice(items[order[k]].a, items[order[k]].b); at = x.b; });
        out += text.slice(at);
        report.push([rel, testAt(text, open), "list sorted again", `${items.length} elements`, "in their files' order"]);
        text = out;
    }
    return text;
}

const usedIn = new Map();
for (const rel of TIER_FILES) {
    const { text: rewritten, used } = rewrite(rel, textOf(rel));
    const text = resortLists(rel, rewritten);
    edits.set(rel, text);
    usedIn.set(rel, new Set());
    if (new RegExp(`\\b${FAMILY_CONST}\\b`).test(text)) usedIn.get(rel).add(FAMILY_CONST);
    if (new RegExp(`\\b${TEXT_FN}\\(`).test(text)) usedIn.get(rel).add(TEXT_FN);
    if (new RegExp(`\\b${FETCH_FN}\\(`).test(text)) usedIn.get(rel).add(FETCH_FN);
    if (new RegExp(`\\b${BY_FN}\\(`).test(text)) usedIn.get(rel).add(BY_FN);
    void used;
}

/* ---- the contract register: file beside symbol ---- */
/* The registers outside the suite: patches.mjs's contract (a `file` beside its `symbol`) and every module file that keys
   a row by `<file>#NAME` (rooms.mjs CAMERA_READERS ...), found by that spelling; `RP.registers` adds to them. */
const REGISTERS = [...new Set([...(RP.registers ?? []), "scripts/patches.mjs", ...fs.readdirSync(path.join(REPO, "scripts"))
    .filter(f => f.endsWith(".mjs") && !/^tests/.test(f) && !FAMILY.includes(f))
    .filter(f => new RegExp(`(?<![\\w-])${F}#\\w`).test(fs.readFileSync(path.join(REPO, "scripts", f), "utf8")))
    .map(f => `scripts/${f}`)])];
for (const rel of REGISTERS) {
    let text = textOf(rel);
    text = text.replace(new RegExp(`(?<![\\w-])${F}#(\\w+)`, "g"), (all, name, at) => {
        if (!holderOf.has(name) || holderOf.get(name) === SOURCE || inComment(text, at)) return all;
        report.push([rel, "(register)", "key", all, `${holderOf.get(name)}#${name}`]);
        return `${holderOf.get(name)}#${name}`;
    });
    text = text.replace(new RegExp(`(file: )"${F}"(,\\s*symbol: )"(\\w+)"`, "g"), (all, a, b, name, at) => {
        const file = holder(name, `${rel} symbol ${name}`);
        if (file === SOURCE) return all;
        report.push([rel, "(register)", "file beside symbol", `${SOURCE} ${name}`, file]);
        return `${a}${q(file)}${b}"${name}"`;
    });
    edits.set(rel, text);
}

/* ---- the owners of the season registry's rows the split moved (a target's `statements`, by their `group:`) ---- */
for (const t of manifest.targets) for (const head of t.statements ?? []) {
    const group = head.match(/group: "(\w+)"/)?.[1];
    if (!group) continue;
    for (const rel of TIER_FILES) {
        const text = textOf(rel);
        const out = text.replace(new RegExp(`\\b${group}: "${F}"`, "g"), () => `${group}: ${q(path.basename(t.file))}`)
            // and the message a planted registration expects of that owner (R1254's self-check)
            .replace(new RegExp(`(\\b${group}: registered in [\\w-]+\\.mjs, not )${F}`, "g"), (all, head) => `${head}${path.basename(t.file)}`);
        if (out !== text) { report.push([rel, "(owners)", "a moved row's owner", `${group}: ${SOURCE}`, path.basename(t.file)]); edits.set(rel, out); }
    }
}

/* ---- 5. the patches ---- */
for (const patch of RP.patches ?? []) {
    const text = textOf(patch.file);
    if (!once(patch.file, text, patch.find, `patch ${patch.test}`)) continue;
    report.push([patch.file, patch.test, "patch", patch.find, patch.replace]);
    edits.set(patch.file, text.replace(patch.find, patch.replace));
}

/* ---- the kit's names imported where they are used ---- */
for (const [rel, names] of usedIn) {
    if (!names.size) continue;
    let text = edits.get(rel);
    const m = text.match(/\n\} from "\.\/tests-kit\.mjs";/);
    if (!m) { refuse(`${rel} imports nothing from tests-kit.mjs - where would ${[...names].join(", ")} come from?`); continue; }
    text = text.slice(0, m.index) + `, ${[...names].join(", ")}` + text.slice(m.index);
    edits.set(rel, text);
}

/* ---- what is left: every reference to the file in the files rewritten ---- */
const left = [];
for (const rel of TIER_FILES) {
    const text = edits.get(rel);
    text.split("\n").forEach((line, i) => {
        if (!new RegExp(`(?<![\\w-])${F}`).test(line) || /^\s*(\*|\/\/|\/\*)/.test(line)) return;
        if (new RegExp(`import\\("\\./${F}"\\)`).test(line) && !new RegExp(`(?<![\\w-])${F}(?![^(]*\\))`).test(line.replace(new RegExp(`import\\("\\./${F}"\\)`, "g"), ""))) return;
        left.push(`${rel}:${i + 1} ${testAt(text, text.split("\n").slice(0, i).join("\n").length + 1)}: ${line.trim().slice(0, 150)}`);
    });
}

if (problems.length) {
    for (const p of problems) console.error(`e54-repoint: REFUSED - ${p}`);
    process.exit(1);
}
for (const [rel, test, rule, before, after] of report) say(`${rel} ${test} [${rule}] ${String(before).slice(0, 90)} -> ${String(after).slice(0, 120)}`);
say(`${report.length} rewrites; references to ${SOURCE} left for a reader (${left.length}):`);
for (const l of left) say(`  ${l}`);
if (DRY) { say("dry run: nothing written"); process.exit(0); }
for (const [rel, text] of edits) if (text !== read(rel)) fs.writeFileSync(path.join(REPO, rel), text);
say("done");
