/**
 * The repository's own checks, in Node, without Foundry (E30, 24.09.2026).
 * ---------------------------------------------------------------------------
 *     node tools/check.mjs [part ...] [--release vX.Y.Z]   every part when none is named
 *     node tools/check.mjs text --lang <dir>              `text` over <dir>/en.json and <dir>/pl.json
 *     node tools/check.mjs text --all                     `text` with every report finding printed
 *
 * One entry point, so CI and a release run the same command and a part added
 * later is not a new script somebody forgets to call. Each part prints its own
 * numbers - what it read as well as what it found, because a part that read
 * nothing has proved nothing - and the exit code is 1 when any part is red.
 * Only `names`, `moves` and `text` need `npm ci` in audit/harness (they parse
 * with espree; `text` since E65 C10, for the screen map); the rest are bare
 * Node, so release.yml runs `stamps notes` before installing anything.
 *
 * Parts:
 *   stamps    module.json's version, the `--drpg-css-version` stamp in
 *             styles/danganronpa.css, the first five lines of each of the six
 *             handbooks and README's "describe version X." agree; with
 *             `--release`, the tag is "v" + that version. These were three
 *             shell steps of release.yml and R125; the handbooks said 1.2.55
 *             under a 1.2.56 module once (audit S14-16).
 *   notes     .github/release-notes/v<version>.md exists and is not empty.
 *   dashes    the house rule (CLAUDE.md): no U+2014 or U+2013 in the language
 *             files' decoded keys and values, the handbooks, README and the
 *             release notes and every other .md under docs/ (the R-number
 *             registry, docs/dev/R-REGISTRY.md, among them); no U+2014 in
 *             CLAUDE.md, its path-scoped rules (.claude/rules/*.md, INFRA I5)
 *             or CONTRIBUTING.md outside inline code, nor in the code and
 *             workflows. U+2013 is not ruled
 *             in code: the rule names the em dash, and on 24.09.2026 scripts/,
 *             styles/ and tools/ held 18 en dashes: 15 in comments (page ranges
 *             mostly) and 3 in strings a player or GM sees.
 *   parity    lang/en.json against lang/pl.json, as the tier-1 test "the Polish
 *             file covers every English key" reads them at a table: nothing
 *             missing, no stray key (DRPG.Config.* and .few/.many aside), no
 *             placeholder dropped (`{a}` aside); and CLAUDE.md's plural rule -
 *             every English .one/.other family has its Polish .few and .many.
 *   prose     config.mjs's prose against lang/pl.json (tools/config-prose.mjs).
 *   names     every name scripts/ takes from `./x.mjs` - static imports,
 *             re-exports, and the dynamic forms the module uses, a namespace
 *             held in a variable (`const m = await import(...)`, then `m.a`)
 *             among them - is exported by x.mjs, following `export *`. A dynamic
 *             import with a computed path, and a namespace variable handed on
 *             whole, are counted, not checked. no-undef (npm run lint) cannot
 *             see a renamed export: the importing file still declares the name.
 *   moves     tools/moved-only.mjs's planted pairs alone (E34 C1, 07.10.2026):
 *             the checker a file split runs on its own commit (`node
 *             tools/moved-only.mjs HEAD~1`) judges a fixture with forty
 *             problems to report - a changed moved line, two lines exchanged
 *             in a moved function, a shadowing import, a write to a moved
 *             `let`, a re-export bound to another declaration, a side-effect
 *             import, a dropped re-export, an alias swapped for another of
 *             its name, a demoted name still imported, a listed shrink at
 *             other lengths, a callee R290's crawl cut moved out of its job's
 *             file and the rest, across its eight parts (E34 fix r1-G1,
 *             r2-G1) - and is red
 *             unless it reports exactly those, so it stays honest between the
 *             waves that use it
 *             (E34, E41, E54). It needs git, not a checkout: the fixture is a
 *             repository of its own in a temporary directory.
 *   contract  the test author contract, read off the text: in
 *             scripts/tests-tier*.mjs no cut bounded by a bare indexOf, no
 *             assertion true by construction, no needs() of anything but a
 *             probe (the suite's R156-R158 read the same detectors from
 *             scripts/tests-lint.mjs); in audit/harness/scenarios/*.mjs no
 *             check() that cannot fail, and no raw read or write of a GM
 *             store's key (R171's half the suite cannot read at a table; the
 *             allowance is GM_STORE_SCENARIO_ALLOW, and a stale row is red).
 *             Each detector is run on its fixture first and the part is red
 *             if it does not flag exactly the fixture's violations.
 *             audit/harness/probes/ is not read: a probe records, it does not
 *             verdict.
 *   registry  the harness's scenario numbers (audit/harness/README.md) against
 *             the files and their layers, and the suite's R numbers (the
 *             block in docs/dev/R-REGISTRY.md) against the tier files, unique -
 *             tools/registry.mjs, whose `--write` regenerates the block - and
 *             the flows of scripts/tests-flows.mjs against both.
 *   stages    tools/stages.json and every marker that names a stage
 *             (tools/stages.mjs check; with `--release`, its release rules too,
 *             which need the v* tags - a CI checkout needs fetch-depth: 0).
 *   tree      nothing git tracks under audit/harness/results (the harness
 *             writes there on every run) and no node_modules.
 *   gatecode  audit/gate and audit/live never fill a password, admin key or
 *             licence field: no password-type selector and no fill, type or
 *             press aimed at a field named like one, read a statement at a time
 *             so a locator chain and a call split over lines count. A detector
 *             fixture runs first, as in `contract`, and the part is red when the
 *             gate's writer or the live runner is not there to be read.
 *   live      every live check the code, the harness, the tools, the language
 *             files and the handbooks cite as LIVE-E<stage>-<n> is an item of
 *             audit/AUDIT-1.2.42.md section 9.2, written once.
 *   text      the text lint (E65): every detector of scripts/tests-text.mjs on
 *             its fixture first (red when one does not flag exactly its
 *             fixture's items, or read nothing of it), then each over the
 *             language files and config.mjs's English prose (walkConfigProse),
 *             one line each - its T number, its mode, what it read and what it
 *             found. Red on a finding of a FAIL detector, on a detector that
 *             read nothing; a report detector's findings are printed, never red.
 *             At E65 C1: T1 (pluralForms, configPlaceholders) and T2
 *             (pairParity), all FAIL. `--lang <dir>` reads en.json and pl.json
 *             from <dir> instead of lang/ (config.mjs stays this tree's): how a
 *             scratch copy with a planted fault is shown red. E65 C2: T3
 *             (familyFormats) and T6 (dashesIn), FAIL with a baseline, read
 *             the module's scripts as well (git's list under scripts/, the
 *             suite's own files out, through tests-lint.mjs's lexer) and every
 *             .md git lists under docs/; red on a finding the baseline does
 *             not hold, and on a baseline row nothing fills ("take it out of
 *             the baseline"). E65 C3: T14 (tableWordProblems), FAIL: config.mjs's
 *             TABLE_NAME_WORDS against the words of Base, with tables.mjs's two
 *             legacy lists read off its text (it does not load in Node). E65
 *             C4: docs/glossary.json held to its shape (glossarySchema, every
 *             `stage` a row of tools/stages.json: a fault is red), then T8
 *             (glossaryHits) and T28 (retiredHits), report: each row holds once
 *             its stage has shipped (tools/stages.mjs isShipped against
 *             module.json); printed are the debt, one line a finding, then the
 *             rows of a shipped stage that found nothing and what the rows not
 *             yet due find, by stage. E65 C5: docs/text-budgets.json held to
 *             its shape (budgetsSchema: the surfaces' targets and limits, the
 *             key-to-surface rules, the allow rows with their `why` and `until`;
 *             missing, unparsed or off-shape: red, "budgets: ..."), and a line
 *             of what it holds. E65 C6: five report detectors - T4
 *             (lengthOver, words against the budgets' surfaces, a key's
 *             surface read by its name or by the call that posts it), T5
 *             (patterns, the guide's X rules), T7's part (ruleNumberWords), T21
 *             (monokumaVoice) and T24 (colonChains) - each with its counts by
 *             surface and by top-level key group, and a report detector's
 *             findings one a line up to 25 (`--all`: every one). Two more
 *             controls: the self-check sees glossarySchema and budgetsSchema
 *             each stubbed to answer []. E65 C7: eight report detectors of
 *             the language rules - T11 (loanGender) and T12 (loanDeclension),
 *             the glossary's loanwords in pl.json and the Polish handbooks;
 *             T17 (oxfordComma), T18 (telegraph), T19 (contractions, with
 *             each surface's shares), T22 (mirror, the shares of EN/PL pairs
 *             alike), T23 (itemQuotes) and T25 (bareLeft). E65 C8: two
 *             report detectors that read the scripts - T13 (uiLiterals,
 *             English literals in a script that draws UI) and T20
 *             (localeCalls, a list or a date formatted outside utils.mjs's
 *             helpers) - each with its findings counted by file. E65 C9:
 *             T27 (naturalnessBefore, report), the naturalness pairs of
 *             docs/text-style.md section 12 whose "before" still stands in
 *             pl.json; the pairs whose before is gone are listed apart, and
 *             a fault of the guide's pairs table is red ("pairs: ..."), as a
 *             schema's is. Two more controls: the self-check sees the table's
 *             parser (naturalnessPairs) stubbed to read nothing, and T27 with
 *             its gone list and counts emptied. E65 C10: the screen map
 *             (tools/text-map.mjs, built in memory with espree: a SCREENS row
 *             that names no unit is red, "screens: ...") with its counts and
 *             decision 38's split of the window surfaces by reader, its marks
 *             handed to T19; and T15 (renderChecks, report) over a render made
 *             in memory (tools/text-render.mjs renderAll), with the
 *             placeholders it has no fixture for. The files themselves only by
 *             `node tools/text-map.mjs` and `node tools/text-render.mjs`. E65 C11:
 *             the audience map (tools/text-audience.mjs, the same parse: a
 *             problem of it is red, "audience: ...") with its counts by sender
 *             and by reader, handed to T16 (secondPersonToMany, report: "you"
 *             on a card the room, the incident or the table reads at once);
 *             and the map built once more on planted scripts, each sender and
 *             reader with the answer it must give. E65 C12: the handbook-facts
 *             tool's self-check (tools/handbook-facts.mjs; red, with a control
 *             that hands it a split cutting nothing), and every handbook split
 *             twice, one line each: units by kind, the second split the same
 *             (red when not, or when a handbook is missing), what split could
 *             not read (red since E65 decision 81: a row that runs into a
 *             blank line, a section number twice, a fence that never closes),
 *             and the Polish ids, kinds and lines as the English (a reading).
 *             E65 C14: the pilot's working file, docs/dev/text-pilot.json, held to
 *             its shape (tools/text-render.mjs pilotSchema; red, "pilot: ..."):
 *             40 strings, each entry's fields, its key one of lang/en.json or of
 *             config.mjs's English prose, its befores the files' text, its afters
 *             null or of the before's shape, none the key or "before" of a
 *             naturalness pair N1-N60; with a control, the schema shown a copy
 *             with those four faults planted. E65 C-pilot: the owner's answers
 *             in it, each string's `owner` and each question's (`default` or
 *             `other`, with the owner's note and the date), counted on the
 *             pilot's line; the control plants a fifth fault, a question's
 *             owner with a verdict the sheet does not offer.
 */

import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const lint = await import(url.pathToFileURL(path.join(REPO, "scripts", "tests-lint.mjs")).href);
const registryLib = await import(url.pathToFileURL(path.join(REPO, "tools", "registry.mjs")).href);
const stagesLib = await import(url.pathToFileURL(path.join(REPO, "tools", "stages.mjs")).href);

const argv = process.argv.slice(2);
const releaseAt = argv.indexOf("--release");
const RELEASE = releaseAt >= 0 ? argv[releaseAt + 1] ?? "" : null;
const langAt = argv.indexOf("--lang");
const LANG_DIR = langAt >= 0 ? argv[langAt + 1] ?? "" : null;
const ALL = argv.includes("--all");
/* LF line ends whatever the checkout has (lint.lf; 1.2.80 train, fix crlf-G1): every reader below matches "\n". */
const read = rel => lint.lf(fs.readFileSync(path.join(REPO, rel), "utf8"));
const exists = rel => fs.existsSync(path.join(REPO, rel));
const EM = "\u2014", EN = "\u2013";
const HANDBOOKS = ["gm-handbook", "player-handbook", "player-brochure"].flatMap(b => ["en", "pl"].map(l => `docs/handbooks/${b}.${l}.md`));

/** The files git knows here, tracked or new and not ignored; null outside a git checkout. */
function gitFiles(...paths) {
    try {
        return execFileSync("git", ["-C", REPO, "ls-files", "-co", "--exclude-standard", "--", ...paths], { encoding: "utf8" })
            .split("\n").filter(Boolean).filter(f => exists(f));
    } catch { return null; }
}

/** A language file's keys and values, flat, the way Foundry's expandObject reads dotted keys. */
function langEntries(rel) {
    const out = [];
    const walk = (o, p) => {
        for (const [k, v] of Object.entries(o ?? {})) {
            const key = p ? `${p}.${k}` : k;
            if (typeof v === "object" && v !== null) walk(v, key); else out.push([key, v]);
        }
    };
    walk(JSON.parse(lint.lf(fs.readFileSync(path.resolve(REPO, rel), "utf8"))), "");   // resolve: `--lang` may name an absolute dir
    return out;
}

/* ------------------------------ stamps, notes ------------------------------ */

function stamps() {
    const problems = [];
    const version = JSON.parse(read("module.json")).version;
    const places = [];
    const css = read("styles/danganronpa.css").match(/--drpg-css-version:\s*"([^"]*)"/)?.[1] ?? null;
    places.push(["styles/danganronpa.css --drpg-css-version", css === version, `stamps "${css}"`]);
    for (const f of HANDBOOKS) {
        const top = exists(f) ? read(f).split("\n").slice(0, 5).join("\n") : null;
        places.push([f, top !== null && top.includes(version), top === null ? "is missing" : "does not name it in its first five lines"]);
    }
    const readme = read("README.md").match(/describe version (\d+\.\d+\.\d+)\./)?.[1] ?? null;
    places.push(["README.md \"describe version X.\"", readme === version, `says ${readme ?? "no version"}`]);
    for (const [where, ok, what] of places) if (!ok) problems.push(`${where} ${what}; module.json says ${version}`);
    if (RELEASE !== null && RELEASE !== `v${version}`) problems.push(`the tag asked for is "${RELEASE}", module.json says ${version}`);
    console.log(`stamps: module.json ${version}; ${places.filter(p => p[1]).length}/${places.length} places agree`
        + (RELEASE !== null ? `; tag ${RELEASE}` : ""));
    return problems;
}

function notes() {
    const version = RELEASE ? RELEASE.replace(/^v/, "") : JSON.parse(read("module.json")).version;
    const rel = `.github/release-notes/v${version}.md`;
    const size = exists(rel) ? read(rel).trim().length : -1;
    console.log(`notes: ${rel} ${size < 0 ? "missing" : `${size} characters`}`);
    return size > 0 ? [] : [`${rel} is ${size < 0 ? "missing" : "empty"} - the release workflow publishes it as the release's text`];
}

/* --------------------------------- dashes ---------------------------------- */

/** `text` with inline code spans blanked (same length), so a rule quoted in backticks is not a use. */
const outsideCode = text => text.replace(/`[^`\n]*`/g, m => " ".repeat(m.length));

function dashes() {
    const problems = [];
    const hits = (text, chars) => text.split("\n").flatMap((line, i) => chars.some(c => line.includes(c)) ? [i + 1] : []);
    let files = 0;
    // The language files: decoded, so an escaped dash counts as one.
    const langs = fs.readdirSync(path.join(REPO, "lang")).filter(f => f.endsWith(".json")).sort();
    for (const f of langs) {
        files++;
        for (const [k, v] of langEntries(`lang/${f}`)) {
            if ([EM, EN].some(c => k.includes(c) || String(v).includes(c))) problems.push(`lang/${f}: ${k} has an en or em dash`);
        }
    }
    const prose = [...HANDBOOKS, "README.md",
        ...fs.readdirSync(path.join(REPO, ".github", "release-notes")).filter(f => f.endsWith(".md")).map(f => `.github/release-notes/${f}`),
        ...(gitFiles("docs") ?? []).filter(f => f.endsWith(".md") && !HANDBOOKS.includes(f))];
    for (const f of new Set(prose)) {
        files++;
        for (const line of hits(read(f), [EM, EN])) problems.push(`${f}:${line}: an en or em dash in prose`);
    }
    /* CLAUDE.md's sections that moved to .claude/rules (INFRA I5) keep its rule. Listed off the disk, not
       through git: a clone's .git/info/exclude may name .claude/ (this machine's did, 18.10.2026), and then
       gitFiles would not list a new rule file until it was added. */
    const rules = exists(".claude/rules")
        ? fs.readdirSync(path.join(REPO, ".claude", "rules")).filter(f => f.endsWith(".md")).sort().map(f => `.claude/rules/${f}`)
        : [];
    for (const f of ["CLAUDE.md", "CONTRIBUTING.md", ...rules]) {
        files++;
        for (const line of hits(outsideCode(read(f)), [EM])) problems.push(`${f}:${line}: an em dash outside inline code`);
    }
    /* Code. audit/handoff is not read: it is a temporary hand-over folder, deleted in
       the 1.2.61 release commit, and not code. */
    const code = gitFiles("scripts", "styles", "tools", "audit/harness", "audit/gate", "audit/live", ".github/workflows", "eslint.config.mjs");
    if (code === null) problems.push("not a git checkout: the code could not be listed");
    for (const f of (code ?? []).filter(f => /\.(mjs|js|cjs|json|css|md|yml|yaml|py|html|hbs|txt)$/.test(f))) {
        files++;
        for (const line of hits(read(f), [EM])) problems.push(`${f}:${line}: an em dash`);
    }
    console.log(`dashes: ${files} files read (${langs.length} language files decoded); ${problems.length} problem(s)`);
    return problems;
}

/* --------------------------------- parity ---------------------------------- */

function parity() {
    const problems = [];
    const en = new Map(langEntries("lang/en.json")), pl = new Map(langEntries("lang/pl.json"));
    const missing = [...en.keys()].filter(k => !pl.has(k));
    const stray = [...pl.keys()].filter(k => !k.startsWith("DRPG.Config.") && !/\.(few|many)$/.test(k) && !en.has(k));
    const holes = [];
    for (const [k, v] of en) {
        if (typeof v !== "string" || typeof pl.get(k) !== "string") continue;
        const have = new Set(pl.get(k).match(/\{\w+\}/g) ?? []);
        for (const h of (v.match(/\{\w+\}/g) ?? []).filter(h => h !== "{a}")) if (!have.has(h)) holes.push(`${k} ${h}`);
    }
    const families = [...new Set([...en.keys()].filter(k => /\.(one|other)$/.test(k)).map(k => k.replace(/\.(one|other)$/, "")))];
    const plural = families.flatMap(f => ["one", "other"].filter(x => !en.has(`${f}.${x}`)).map(x => `en ${f}.${x}`)
        .concat(["one", "few", "many", "other"].filter(x => !pl.has(`${f}.${x}`)).map(x => `pl ${f}.${x}`)));
    problems.push(...missing.map(k => `pl.json lacks ${k}`), ...stray.map(k => `pl.json has ${k}, which en.json does not`),
        ...holes.map(h => `pl.json drops the placeholder ${h}`), ...plural.map(p => `a plural family lacks ${p}`));
    console.log(`parity: en ${en.size} keys, pl ${pl.size}; missing ${missing.length}, stray ${stray.length}, `
        + `placeholders dropped ${holes.length}; ${families.length} plural families, ${plural.length} form(s) missing`);
    if (!en.size || !families.length) problems.push("read no English keys or no plural family");
    return problems;
}

/* ---------------------------------- prose ---------------------------------- */

async function prose() {
    const { proseCoverage } = await import(url.pathToFileURL(path.join(REPO, "tools", "config-prose.mjs")).href);
    const r = proseCoverage(path.join(REPO, "lang", "pl.json"));
    console.log(`prose: ${r.covered}/${r.wanted} of config.mjs's strings in lang/pl.json; missing ${r.missing.length}, extra ${r.extra.length}`);
    return [...(r.wanted ? [] : ["config.mjs yielded no prose to cover"]),
        ...r.missing.map(k => `lang/pl.json lacks DRPG.Config.${k}`), ...r.extra.map(k => `lang/pl.json has DRPG.Config.${k}, which config.mjs does not`)];
}

/* ---------------------------------- names ---------------------------------- */

/* The walk is the scratch probe of 24.09.2026 (the E30 design, 0.4) made a part:
   on 411d4da it read 2118 static and 1068 dynamic names in 108 files, found 0
   unresolved and 2 computed paths, and reported both planted faults - a static
   import of a name observe.mjs's source does not export, and a renamed
   destructure of `await import("./murder.mjs")` in gm-bridge.mjs. */
function names() {
    let espree;
    try { espree = createRequire(path.join(REPO, "audit", "harness", "package.json"))("espree"); }
    catch { return ["espree is not installed - run `npm ci` in audit/harness first"]; }
    const dir = path.join(REPO, "scripts");
    const files = fs.readdirSync(dir).filter(f => f.endsWith(".mjs")).sort();
    const trees = new Map(), exported = new Map(), stars = new Map();
    const bindings = (p, into) => {
        if (!p) return;
        if (p.type === "Identifier") into.add(p.name);
        else if (p.type === "ObjectPattern") p.properties.forEach(q => bindings(q.value ?? q.argument, into));
        else if (p.type === "ArrayPattern") p.elements.forEach(e => bindings(e, into));
        else if (p.type === "RestElement") bindings(p.argument, into);
        else if (p.type === "AssignmentPattern") bindings(p.left, into);
    };
    const problems = [];
    for (const f of files) {
        let tree;
        try { tree = espree.parse(fs.readFileSync(path.join(dir, f), "utf8"), { ecmaVersion: "latest", sourceType: "module", loc: true }); }
        catch (err) { problems.push(`scripts/${f}: does not parse (${err.message})`); continue; }
        trees.set(f, tree);
        const own = new Set(), from = [];
        for (const n of tree.body) {
            if (n.type === "ExportNamedDeclaration") {
                if (n.declaration?.id) own.add(n.declaration.id.name);
                for (const v of n.declaration?.declarations ?? []) bindings(v.id, own);
                for (const s of n.specifiers ?? []) own.add(s.exported.name ?? s.exported.value);
            } else if (n.type === "ExportDefaultDeclaration") own.add("default");
            else if (n.type === "ExportAllDeclaration") { if (n.exported) own.add(n.exported.name); else from.push(path.basename(n.source.value)); }
        }
        exported.set(f, own); stars.set(f, from);
    }
    const all = (f, seen = new Set()) => {
        const out = new Set(exported.get(f) ?? []);
        if (seen.has(f)) return out;
        seen.add(f);
        for (const s of stars.get(f) ?? []) for (const x of all(s, seen)) if (x !== "default") out.add(x);
        return out;
    };
    const count = { static: 0, dynamic: 0, computed: 0, namespaces: 0, namespaceReads: 0, namespaceWhole: 0 };
    const visit = (node, fn, parent = null) => {
        if (!node || typeof node.type !== "string") return;
        fn(node, parent);
        for (const [k, v] of Object.entries(node)) {
            if (k === "parent") continue;
            if (Array.isArray(v)) v.forEach(c => c && typeof c.type === "string" && visit(c, fn, node));
            else if (v && typeof v.type === "string") visit(v, fn, node);
        }
    };
    const SCOPES = /^(?:Program|BlockStatement|StaticBlock|FunctionDeclaration|FunctionExpression|ArrowFunctionExpression)$/;
    const local = src => src?.type === "Literal" && String(src.value).startsWith(".");
    const want = (f, line, target, name, how) => {
        if (!exported.has(target)) { problems.push(`scripts/${f}:${line}: ${how} a file that is not in scripts/ (${target})`); return; }
        if (!all(target).has(name)) problems.push(`scripts/${f}:${line}: ${how} ${target} for ${name}, which it does not export`);
    };
    for (const [f, tree] of trees) {
        const parentOf = new Map();
        visit(tree, (node, parent) => parentOf.set(node, parent));
        for (const n of tree.body) {
            if (!((n.type === "ImportDeclaration" || n.type === "ExportNamedDeclaration") && local(n.source))) continue;
            for (const s of n.specifiers ?? []) {
                if (s.type === "ImportNamespaceSpecifier") continue;
                count.static++;
                want(f, n.loc.start.line, path.basename(n.source.value),
                    s.type === "ImportDefaultSpecifier" ? "default" : (s.imported?.name ?? s.imported?.value ?? s.local.name), "imports from");
            }
        }
        visit(tree, node => {
            if (node.type === "ImportExpression" && node.source.type !== "Literal") count.computed++;
            // const { a, b } = await import("./x.mjs")
            if (node.type === "VariableDeclarator" && node.id.type === "ObjectPattern") {
                const init = node.init?.type === "AwaitExpression" ? node.init.argument : node.init;
                if (init?.type === "ImportExpression" && local(init.source)) {
                    for (const p of node.id.properties) {
                        if (p.type !== "Property" || p.computed) continue;
                        count.dynamic++;
                        want(f, node.loc.start.line, path.basename(init.source.value), p.key.name ?? p.key.value, "destructures import() of");
                    }
                }
            }
            /* const calls = await import("./call-effects.mjs"); ... calls.shieldCalls() - the namespace held in a
               variable, every plain member read of it in the block that declares it (E30 review, 25.09.2026: 15
               such variables in the runtime scripts were read by nothing here, and a renamed shieldCalls in
               call-effects.mjs left this part green). A use that is not a plain member read - the namespace
               handed on whole, `calls[key]` - is counted, not checked. */
            if (node.type === "VariableDeclarator" && node.id.type === "Identifier") {
                const imp = node.init?.type === "AwaitExpression" ? node.init.argument : null;
                if (imp?.type === "ImportExpression" && local(imp.source)) {
                    const target = path.basename(imp.source.value), name = node.id.name;
                    let scope = parentOf.get(node);
                    while (scope && !SCOPES.test(scope.type)) scope = parentOf.get(scope);
                    count.namespaces++;
                    const seen = new Set();   // a shorthand property's key and value: two nodes, one place in the text
                    visit(scope, (m, parent) => {
                        if (m.type !== "Identifier" || m.name !== name || m === node.id || seen.has(m.start)) return;
                        seen.add(m.start);
                        if (parent?.type === "MemberExpression" && parent.property === m && !parent.computed) return;
                        if (parent?.type === "Property" && parent.key === m && !parent.computed && !parent.shorthand) return;
                        if (parent?.type === "MemberExpression" && parent.object === m && !parent.computed) {
                            count.namespaceReads++;
                            want(f, parent.loc.start.line, target, parent.property.name, `reads the namespace ${name} = import() of`);
                        } else if (parent?.type === "VariableDeclarator" && parent.init === m && parent.id.type === "ObjectPattern") {
                            // const { a, b } = calls
                            for (const p of parent.id.properties) {
                                if (p.type !== "Property" || p.computed) { count.namespaceWhole++; continue; }
                                count.namespaceReads++;
                                want(f, parent.loc.start.line, target, p.key.name ?? p.key.value, `destructures the namespace ${name} = import() of`);
                            }
                        } else count.namespaceWhole++;
                    }, parentOf.get(scope) ?? null);
                }
            }
            // (await import("./x.mjs")).a
            if (node.type === "MemberExpression" && !node.computed && node.object?.type === "AwaitExpression") {
                const imp = node.object.argument;
                if (imp?.type === "ImportExpression" && local(imp.source)) {
                    count.dynamic++;
                    want(f, node.loc.start.line, path.basename(imp.source.value), node.property.name, "reads import() of");
                }
            }
            // import("./x.mjs").then(({ a }) => ...) and .then(m => m.a)
            if (node.type === "CallExpression" && node.callee.type === "MemberExpression" && node.callee.property?.name === "then"
                && node.callee.object?.type === "ImportExpression" && local(node.callee.object.source)) {
                const target = path.basename(node.callee.object.source.value);
                const fn = node.arguments[0], param = fn?.params?.[0];
                if (param?.type === "ObjectPattern") {
                    for (const q of param.properties) {
                        if (q.type !== "Property" || q.computed) continue;
                        count.dynamic++;
                        want(f, node.loc.start.line, target, q.key.name ?? q.key.value, "destructures import().then of");
                    }
                } else if (param?.type === "Identifier") {
                    visit(fn.body, m => {
                        if (m.type === "MemberExpression" && !m.computed && m.object?.type === "Identifier" && m.object.name === param.name) {
                            count.dynamic++;
                            want(f, m.loc.start.line, target, m.property.name, "reads import().then of");
                        }
                    });
                }
            }
        });
    }
    console.log(`names: ${files.length} files, ${count.static} names imported statically, ${count.dynamic} taken from dynamic imports, `
        + `${count.namespaceReads} read through ${count.namespaces} namespace variable(s) (${count.namespaceWhole} other use(s) of one, not checked), `
        + `${count.computed} dynamic import(s) with a computed path (not checked); ${problems.length} unresolved`);
    if (!count.static) problems.push("read no import at all");
    return problems;
}

async function moves() {
    try {
        const tool = await import(url.pathToFileURL(path.join(REPO, "tools", "moved-only.mjs")).href);
        return tool.selfCheck(line => console.log(line.replace(/^self:/, "moves:")));
    } catch (err) {
        if (err.code === "MODULE_NOT_FOUND") return ["espree is not installed - run `npm ci` in audit/harness first"];
        return [`the planted pairs could not be judged (${String(err.message).split("\n")[0]})`];
    }
}

function contract() {
    const problems = [];
    for (const name of ["bareCuts", "vacuousAsserts", "needsArgs", "vacuousChecks", "rawTextReads"]) {
        const fx = lint.FIXTURES[name];
        const lines = lint[name](fx.text).found.map(f => f.line).sort((a, b) => a - b);
        if (JSON.stringify(lines) !== JSON.stringify(fx.flags)) {
            problems.push(`${name} flags lines ${lines.join(",") || "none"} of its fixture, not ${fx.flags.join(",")} - the detector is broken`);
        }
    }
    const tiers = fs.readdirSync(path.join(REPO, "scripts")).filter(f => lint.TEST_FILE.test(f)).sort();
    const count = { tests: 0, cuts: 0, asserts: 0, needs: 0, checks: 0, reads: 0 };
    for (const file of tiers) {
        const text = read(`scripts/${file}`);
        count.tests += lint.testsIn(text).length;
        for (const [key, detector] of [["cuts", lint.bareCuts], ["asserts", lint.vacuousAsserts], ["needs", lint.needsArgs]]) {
            const r = detector(text);
            count[key] += r.read;
            problems.push(...r.found.map(f => `scripts/${file}:${f.line}: ${f.what}`));
        }
    }
    const scenarios = fs.readdirSync(path.join(REPO, "audit", "harness", "scenarios")).filter(f => f.endsWith(".mjs")).sort();
    for (const file of scenarios) {
        const r = lint.vacuousChecks(read(`audit/harness/scenarios/${file}`));
        count.checks += r.read;
        problems.push(...r.found.map(f => `audit/harness/scenarios/${file}:${f.line}: ${f.what}`));
    }
    /* Every served file the suite reads, read with lf (1.2.80 train, fix crlf-G1): the kit, the runner and the
       tiers - every suite file - not the tier files alone, since the kit's readers are the ones most tests use. */
    const suiteFiles = fs.readdirSync(path.join(REPO, "scripts")).filter(f => /^tests(-[\w-]+)?\.mjs$/.test(f)).sort();
    for (const file of suiteFiles) {
        const r = lint.rawTextReads(read(`scripts/${file}`));
        count.reads += r.read;
        problems.push(...r.found.map(f => `scripts/${file}:${f.line}: ${f.what}`));
    }
    if (!count.reads) problems.push("no read of a served file was seen in the suite's files - rawTextReads read nothing");
    if (!tiers.length || !count.tests) problems.push("no tier file with tests was read");
    if (!scenarios.length || !count.checks) problems.push("no scenario with checks was read");
    /* R171's half over the harness scenarios (E04, 26.09.2026): no scenario reads or
       writes a GM store's key, an old key or a player's copy raw, but through the stores.
       Here in Node because a table's Foundry does not serve audit/, so the suite cannot
       read the scenarios there; the keys are read off settings.mjs and gm-stores.mjs's
       text, and the detector is the one R171 runs, shown its fixture first. */
    const fxs = lint.FIXTURES.storeKeyAccess;
    const fxLines = lint.storeKeyAccess(fxs.text, fxs).found.map(f => f.line).sort((a, b) => a - b);
    if (JSON.stringify(fxLines) !== JSON.stringify(fxs.flags)) {
        problems.push(`storeKeyAccess flags lines ${fxLines.join(",") || "none"} of its fixture, not ${fxs.flags.join(",")} - the detector is broken`);
    }
    const watched = lint.gmStoreSettingsFromSource(read("scripts/settings.mjs"), read("scripts/gm-stores.mjs"));
    if (!watched.keys.length) problems.push("no GM store key was read off settings.mjs and gm-stores.mjs - R171's scenario half read nothing");
    const allowed = new Set();
    let storeReads = 0, rawReads = 0;
    for (const file of scenarios) {
        const r = lint.storeKeyAccess(read(`audit/harness/scenarios/${file}`), watched);
        storeReads += r.read;
        for (const f of r.found) {
            rawReads++;
            const row = `${file}#${f.name}`;
            if (lint.GM_STORE_SCENARIO_ALLOW[row]) allowed.add(row);
            else problems.push(`audit/harness/scenarios/${file}:${f.line}: ${f.what} - a GM store's key read raw (R171); read it through the stores`);
        }
    }
    for (const row of Object.keys(lint.GM_STORE_SCENARIO_ALLOW)) {
        if (!allowed.has(row)) problems.push(`GM_STORE_SCENARIO_ALLOW (scripts/tests-lint.mjs) ${row}: no such raw read is left - take the row out`);
    }
    console.log(`contract: ${tiers.length} files of tests (the tiers and the grid), ${count.tests} tests, ${count.cuts} slice/split calls, `
        + `${count.asserts} ok/equal/needs calls, ${count.needs} needs() calls, ${count.reads} served-file reads in ${suiteFiles.length} suite files; ${scenarios.length} scenarios, `
        + `${count.checks} check() calls; R171: ${watched.keys.length} GM store keys, ${storeReads} settings reads in the scenarios, `
        + `${rawReads} raw on a store key (${allowed.size} allowed rows); ${problems.length} problem(s)`);
    return problems;
}

async function registry() {
    const { problems, summary } = await registryLib.registryProblems(REPO);
    console.log(summary);
    return problems;
}

function stages() {
    const doc = stagesLib.loadStages(REPO);
    const modVersion = stagesLib.moduleVersion(REPO);
    const markers = stagesLib.stageMarkers(REPO);
    const problems = stagesLib.problems(doc, { modVersion, markers });
    if (RELEASE !== null) {
        let tags = [];
        try { tags = execFileSync("git", ["-C", REPO, "tag", "-l", "v*"], { encoding: "utf8" }).split("\n").filter(Boolean); }
        catch { /* not a git checkout: every tag reads as missing, and releaseProblems says why */ }
        problems.push(...stagesLib.releaseProblems(doc, RELEASE, { modVersion, tags }));
    }
    const shipped = doc.stages.filter(r => stagesLib.isShipped(r, modVersion));
    console.log(`stages: ${doc.stages.length} in the ledger, ${shipped.length} shipped, module.json ${modVersion}; ${markers.length} marker(s) naming a stage`);
    return problems;
}

function tree() {
    let listed;
    try { listed = execFileSync("git", ["-C", REPO, "ls-files", "--", "audit/harness/results", ":(glob)**/node_modules/**", ":(glob)**/node_modules"], { encoding: "utf8" }).split("\n").filter(Boolean); }
    catch (err) { return [`not a git checkout (${err.message.split("\n")[0]})`]; }
    console.log(`tree: ${listed.length} tracked file(s) under audit/harness/results or node_modules`);
    return listed.slice(0, 20).map(f => `${f} is tracked - it is written by a run or an install, never committed`);
}

/*
 * Aimed at a secret: a password-type selector; a fill, type or press whose own
 * arguments name a password, an admin key or a licence; or one that a locator
 * naming one leads to in the same statement - `page.locator('input[name=
 * "password"]').fill(pw)`, `page.getByLabel("Password").fill(pw)`, the form
 * Playwright's own documentation writes. Read a statement at a time, with
 * comments blanked (a sentence saying what the runner never does is not a hit):
 * a statement ends at a `;` outside brackets, or at a line end outside brackets
 * unless the next line goes on with `.` or `?.`, so `page.fill(` with its
 * selector on the next line and a locator chain written one call per line are
 * each one statement. Brackets are counted on lint.blankLiterals, so one inside
 * a selector or a regex does not count. The locator form stops at a `;`, so a
 * statement cannot lend its word to the next one.
 *
 * Until 25.09.2026 the test was one line at a time and only the first two
 * forms: the fixture below, read that way, flagged lines 1, 3 and 5 of the
 * eight it flags now - a locator chain, getByLabel, a two-line page.fill(,
 * press and a chain one call per line all went through.
 */
const SECRET_WORD = String.raw`(?:passw|admin[-_ ]?key|licen[cs]e)`;
const SECRET_ACTION = String.raw`\.(?:fill|type|press|pressSequentially|setInputFiles)\s*\(`;
const SECRET_FIELD = new RegExp(String.raw`type\s*=\s*\\?["']?password|${SECRET_ACTION}[^)]*?${SECRET_WORD}|${SECRET_WORD}[^;]*?${SECRET_ACTION}`, "i");
const GATECODE_FIXTURE = {
    text: [
        'await page.fill("input[name=password]", pw);',
        "// the runner never types a password",
        "await page.locator('input[type=\"password\"]').count();",
        'await page.fill("#world-search", id);',
        "await page.locator('#key').type(LICENSE);",
        'const why = "password-required";',
        "await page.locator('input[name=\"password\"]').fill(pw);",
        'await page.getByLabel("Password").fill(pw);',
        "await page.fill(",
        '    "input[name=password]", pw);',
        "await page.press('input[name=\"password\"]', \"Enter\");",
        'const hint = "admin key"; await page.fill("#world-search", hint);',
        'await page.getByPlaceholder("Admin Key")',
        "    .fill(key);",
        'await page.getByRole("button", { name: "Join" })',
        "    .click();"
    ].join("\n"),
    flags: [1, 3, 5, 7, 8, 9, 11, 13]
};

/** The statements of `text` with comments blanked, as SECRET_FIELD reads them: `[{ line, text }]`, a statement's lines joined by spaces. */
function statementsOf(text) {
    const code = lint.blankComments(text), blank = lint.blankLiterals(code);
    const out = [];
    let depth = 0, start = 0;
    const flush = end => {
        const piece = code.slice(start, end);
        if (piece.trim()) out.push({ line: lint.lineAt(code, start + piece.search(/\S/)), text: piece.replace(/\s*\n\s*/g, " ") });
        start = end;
    };
    for (let i = 0; i < blank.length; i++) {
        const c = blank[i];
        if (c === "(" || c === "[") depth++;
        else if ((c === ")" || c === "]") && depth > 0) depth--;
        else if (depth === 0 && (c === ";" || (c === "\n" && !/^\s*\??\./.test(blank.slice(i + 1, i + 200))))) flush(i + 1);
    }
    flush(code.length);
    return out;
}

function gatecode() {
    const problems = [];
    const hitsIn = text => statementsOf(text).filter(s => SECRET_FIELD.test(s.text)).map(s => s.line);
    const fx = hitsIn(GATECODE_FIXTURE.text);
    if (JSON.stringify(fx) !== JSON.stringify(GATECODE_FIXTURE.flags)) {
        problems.push(`the detector flags lines ${fx.join(",") || "none"} of its fixture, not ${GATECODE_FIXTURE.flags.join(",")} - it is broken`);
    }
    const files = (gitFiles("audit/gate", "audit/live") ?? []).filter(f => /\.(mjs|js)$/.test(f));
    /* The writer and the live runner are what it exists to read: without them it read nothing. */
    for (const need of ["audit/gate/local-gate.mjs", "audit/live/foundry.mjs"]) if (!files.includes(need)) problems.push(`${need} is missing - nothing that logs into Foundry was read`);
    for (const f of files) for (const line of hitsIn(read(f))) problems.push(`${f}:${line}: aims at a password, admin key or licence field`);
    console.log(`gatecode: ${files.length} file(s) in audit/gate and audit/live; ${problems.length} problem(s)`);
    return problems;
}

/* ---------------------------------- live ---------------------------------- */

/* A CITED LIVE CHECK IS A WRITTEN ONE (E77 C9, 13.10.2026). A comment that says "what a real Foundry does
   is LIVE-E77-11" hands a question to the table, and the table reads AUDIT 9.2, not the comment. Through E77
   C8 four of the stage's ids (03, 09, 10, 11) were cited in scripts/, styles/ and the harness and written
   nowhere (git grep over C8's tree, 13.10.2026: every other id of the E<stage> form cited outside AUDIT was
   an item); C9 wrote items 205-217, and this part then read 193 items and 335 citations in 247 files, all
   written. LIVE-REOPEN-01, a reading of 20.09 older than the numbered list, is not of that form and not
   asked here. audit/AUDIT-1.2.42.md does not
   ship (.gitattributes), so this is the repository's check and not the suite's. The table smoke's stages (H81,
   20.10.2026) write theirs as LIVE-H<stage>-<n>, read here as the E ids are. */
function live() {
    const problems = [];
    const audit = exists("audit/AUDIT-1.2.42.md") ? read("audit/AUDIT-1.2.42.md") : "";
    const from = audit.search(/^### 9\.2 /m);
    if (from < 0) return ["audit/AUDIT-1.2.42.md has no section 9.2 - nothing was read"];
    const rest = audit.slice(audit.indexOf("\n", from) + 1), next = rest.search(/^#{2,3} /m);
    const items = new Map();
    for (const m of (next < 0 ? rest : rest.slice(0, next)).matchAll(/^(\d+)\. \*\*(LIVE-[EH]\d+-\d+) - /gm)) {
        if (items.has(m[2])) problems.push(`AUDIT 9.2 writes ${m[2]} twice: items ${items.get(m[2])} and ${m[1]}`);
        items.set(m[2], m[1]);
    }
    const files = (gitFiles("scripts", "styles", "tools", "lang", "docs/handbooks", "audit/harness", "audit/gate", "audit/live", "audit/glass-harness.html", "audit/glass-sweep.mjs", "audit/pack-harness.html") ?? [])
        .filter(f => /\.(mjs|js|css|html|md|json)$/.test(f));
    let cites = 0;
    for (const f of files) {
        read(f).split("\n").forEach((line, i) => {
            for (const [id] of line.matchAll(/\bLIVE-[EH]\d+-\d+\b/g)) {
                cites++;
                if (!items.has(id)) problems.push(`${f}:${i + 1}: ${id} is cited, and AUDIT 9.2 has no item of it`);
            }
        });
    }
    if (!items.size || !cites) problems.push(`read ${items.size} item(s) and ${cites} citation(s) - nothing was compared`);
    console.log(`live: ${items.size} item(s) in AUDIT 9.2, ${cites} citation(s) in ${files.length} file(s); ${problems.length} problem(s)`);
    return problems;
}

/* ---------------------------------- text ---------------------------------- */

/* THE TEXT LINT (E65 C1, 31.10.2026). The detectors are scripts/tests-text.mjs's, which imports
   nothing, so this part and the suite's R1058 and R1059 run the same functions; this is the half that
   reads config.mjs's English prose, which a table cannot (at i18nInit a Polish client has already put
   the Polish into config's tables), and the half CI runs. Every detector is shown its fixture first. */
async function text() {
    const T = await import(url.pathToFileURL(path.join(REPO, "scripts", "tests-text.mjs")).href);
    const config = await import(url.pathToFileURL(path.join(REPO, "scripts", "config.mjs")).href);
    const { walkConfigProse } = await import(url.pathToFileURL(path.join(REPO, "scripts", "i18n-config.mjs")).href);
    const dir = LANG_DIR === null ? path.join(REPO, "lang") : path.resolve(LANG_DIR);
    const where = path.relative(REPO, dir) || ".";
    /* The lexer the detectors that read code are handed: tests-lint.mjs's, which tests-text.mjs cannot import (E65 C2). */
    const lexer = { blankComments: lint.blankComments, blankLiterals: lint.blankLiterals, callArgs: lint.callArgs };
    const fixtures = T.selfCheck(T.DETECTORS, { lexer });
    const problems = [...fixtures];
    /* The self-check's own control (R1058 asks the same): a detector stubbed to flag nothing and read nothing,
       the shape of each before it was written, is seen. A self-check that answered [] whatever ran would leave
       this part green over a broken detector. */
    const first = Object.keys(T.MODES)[0];
    if (T.selfCheck({ ...T.DETECTORS, [first]: () => ({ found: [], read: 0 }) }, { lexer }).filter(p => p.startsWith(`${first} `)).length !== 2) {
        problems.push(`the self-check does not see ${first} stubbed to flag nothing and read nothing - it would pass a broken detector`);
    }
    /* And its second ledger (E65 C4): T8 run as if only the first ledger's stages had shipped, whatever it is handed, is
       seen on the fixture's case 2 - a self-check that ran only the first case would pass a detector blind to the ledger. */
    const blind = bag => T.DETECTORS.glossaryHits({ ...bag, shipped: T.FIXTURES.glossaryHits.input.shipped });
    if (!T.selfCheck({ ...T.DETECTORS, glossaryHits: blind }, { lexer }).some(p => p.startsWith("glossaryHits flags ") && p.includes("case 2"))) {
        problems.push("the self-check does not see glossaryHits blind to the ledger it is handed - it would pass a broken stage rule");
    }
    /* And the two schemas' own cases (E65 C6; C5's Open 34): each stubbed to answer [] is one mismatch of the self-check. Its
       line for either removed, a schema broken to pass everything would leave this part green on a valid file (C5's
       mutant M13 lived so). */
    for (const schema of ["glossarySchema", "budgetsSchema"]) {
        if (!T.selfCheck(T.DETECTORS, { lexer }, { [schema]: () => [] }).some(p => p.startsWith(`${schema} answers [] `))) {
            problems.push(`the self-check does not see ${schema} stubbed to answer [] - a broken schema would pass its file`);
        }
    }
    /* And the parser of the guide's naturalness pairs (E65 C9): stubbed to read no pair and no fault, one mismatch. */
    if (!T.selfCheck(T.DETECTORS, { lexer }, { naturalnessPairs: () => ({ pairs: [], faults: [] }) }).some(p => p.startsWith("naturalnessPairs reads "))) {
        problems.push("the self-check does not see naturalnessPairs stubbed to read nothing - a broken pairs table would pass");
    }
    /* And what T27 lists apart and counts (E65 C9): the detector with its gone list and counts emptied is seen on both, so a
       self-check that stopped reading either would leave this part green over a T27 that misreads a changed string. */
    const goneBlind = bag => ({ ...T.DETECTORS.naturalnessBefore(bag), gone: [], counts: {} });
    const blindSeen = T.selfCheck({ ...T.DETECTORS, naturalnessBefore: goneBlind }, { lexer });
    if (!blindSeen.some(p => p.startsWith("naturalnessBefore lists nothing ")) || !blindSeen.some(p => p.startsWith("naturalnessBefore counts "))) {
        problems.push("the self-check does not see naturalnessBefore with its gone pairs and counts emptied - it would pass a T27 that misreads a changed string");
    }
    /* And T19's second case (E65 C10): T19 blind to the screen map's marks it is handed is seen on that case, by its flags and its
       counts, so a self-check that stopped running a fixture's `also` cases, or their counts, would leave this part green. */
    const unmarked = bag => T.DETECTORS.contractions({ ...bag, marks: undefined });
    const marksSeen = T.selfCheck({ ...T.DETECTORS, contractions: unmarked }, { lexer }).filter(p => p.startsWith("contractions ") && p.includes("case 2"));
    if (!marksSeen.some(p => p.startsWith("contractions flags ")) || !marksSeen.some(p => p.startsWith("contractions counts "))) {
        problems.push("the self-check does not see contractions blind to the screen map's marks - it would pass a T19 that ignores them");
    }
    const fileOf = name => path.join(dir, name);
    for (const name of ["en.json", "pl.json"]) if (!fs.existsSync(fileOf(name))) problems.push(`${path.join(where, name)} is missing - nothing was read`);
    if (problems.some(p => p.endsWith("nothing was read"))) return problems;
    const en = new Map(langEntries(fileOf("en.json"))), pl = new Map(langEntries(fileOf("pl.json")));
    const prose = new Map();
    walkConfigProse(config, (key, value) => prose.set(key, value));
    /* The scripts the module serves, as git lists them (the suite's own files out: tests.mjs and tests-*.mjs quote
       what they hunt for, and R1's otherSources leaves them out too), and every .md under docs/ (E65 C2). */
    const listed = gitFiles("scripts"), docList = gitFiles("docs");
    if (listed === null || docList === null) { problems.push("not a git checkout: the scripts and docs could not be listed - nothing was read"); return problems; }
    const scripts = new Map(listed.filter(f => f.endsWith(".mjs") && !/^tests(-[\w-]+)?\.mjs$/.test(path.basename(f))).map(f => [f, read(f)]));
    const docs = new Map(docList.filter(f => f.endsWith(".md")).map(f => [f, read(f)]));
    /* T14's bag (E65 C3): the words a table's name is built from, as config.mjs freezes them, and tables.mjs's legacy lists. */
    /* T8's and T28's (E65 C4): docs/glossary.json, held to its shape first (a fault in it is red: a file E65 owns, not text
       debt), and the stages that have shipped by tools/stages.mjs's rule - an entry holds only from its stage. */
    const ledger = stagesLib.loadStages(REPO), modVersion = stagesLib.moduleVersion(REPO);
    const shipped = ledger.stages.filter(r => stagesLib.isShipped(r, modVersion)).map(r => r.id);
    let glossary = null;
    if (!exists("docs/glossary.json")) problems.push("glossary: docs/glossary.json is missing - T8 and T28 have nothing to read");
    else {
        try { glossary = JSON.parse(read("docs/glossary.json")); } catch (err) { problems.push(`glossary: docs/glossary.json does not parse (${err.message})`); }
        if (glossary) problems.push(...T.glossarySchema(glossary, ledger.stages.map(r => r.id)).map(p => `glossary: ${p}`));
    }
    /* The budgets (E65 C5): docs/text-budgets.json held to its shape the same way (budgetsSchema: every `until` and `fail` a
       ledger row; a fault is red), and one line of what it holds. T4, T5 and T21 (E65 C6) read it as `budgets`. */
    let budgets = null;
    if (!exists("docs/text-budgets.json")) problems.push("budgets: docs/text-budgets.json is missing - the surfaces' budgets have nothing to read");
    else {
        try { budgets = JSON.parse(read("docs/text-budgets.json")); } catch (err) { problems.push(`budgets: docs/text-budgets.json does not parse (${err.message})`); }
        if (budgets) {
            const faults = T.budgetsSchema(budgets, ledger.stages.map(r => r.id));
            problems.push(...faults.map(p => `budgets: ${p}`));
            const surfaces = Object.values(budgets.surfaces ?? {}), rules = Array.isArray(budgets.rules) ? budgets.rules : [];
            console.log(`text: budgets: ${surfaces.length} surface(s), ${surfaces.filter(s => s?.limit !== null).length} with a limit; `
                + `${rules.length} rule(s), ${rules.filter(r => r && Object.hasOwn(r, "keys")).length} by key and ${rules.filter(r => r && Object.hasOwn(r, "sender")).length} by sender; `
                + `${Array.isArray(budgets.allow) ? budgets.allow.length : 0} allow row(s); ${faults.length} schema fault(s)`);
        }
    }
    const inputs = { en, pl, prose, scripts, docs, lexer, words: config.TABLE_NAME_WORDS, ...T.legacyListsFrom(read("scripts/tables.mjs")), glossary, shipped, budgets };
    /* The screen map and the render (E65 C10): tools/text-map.mjs reads the scripts with espree (a SCREENS row that names
       no unit is red: the hand table is a file E65 writes), tools/text-render.mjs fills every string with its fixtures in
       memory; T15 reads the render, T19 the map's marks (decision 52). The files themselves only by the two tools. */
    const textMap = await import(url.pathToFileURL(path.join(REPO, "tools", "text-map.mjs")).href);
    const textRender = await import(url.pathToFileURL(path.join(REPO, "tools", "text-render.mjs")).href);
    const espree = textMap.loadEspree(REPO);
    let screenMap = null;
    if (!espree) problems.push("screens: espree is not installed - run `npm ci` in audit/harness first (the screen map reads the scripts with it)");
    else {
        const configTables = [...new Set([...prose.keys()].map(k => k.split(".")[2]))];
        screenMap = textMap.buildScreenMap({ scripts, keys: [...en.keys(), ...pl.keys(), ...prose.keys()], espree, configTables });
        problems.push(...screenMap.problems.map(p => `screens: ${p}`));
        inputs.marks = textMap.marksOf(screenMap);
    }
    /* The audience map (E65 C11): who reads each key a send reaches, read with the same parse; T16 reads it. */
    let audienceMap = null;
    if (espree) {
        const textAudience = await import(url.pathToFileURL(path.join(REPO, "tools", "text-audience.mjs")).href);
        audienceMap = textAudience.buildAudienceMap({ scripts, keys: [...en.keys(), ...pl.keys(), ...prose.keys()], espree });
        problems.push(...audienceMap.problems.map(p => `audience: ${p}`));
        inputs.audience = audienceMap.keys;
        /* And the map on planted scripts (E65 C11): each sender, a toast, a wrapper and the notice history once, with the readers
           each must give; a send that spells its own key and fills a parameter in (`fill`: no wrapper), an `announce` of a file
           that is no sender's, a two-segment template (`DRPG.Plant.${choice}`: no key), and one notice-history file left out,
           which is the one problem. T16's fixture hands it a map; this is what holds the map itself, so a sender, a reader or
           the wrapper rounds read wrong turn the part red here rather than as a quieter count. */
        const plant = textAudience.buildAudienceMap({ espree, keys: ["room", "incident", "all", "gms", "owner", "toast", "wrapped", "own", "unsent", "filled", "arg", "notSent"].map(k => `DRPG.Plant.${k}`), scripts: new Map([
            ["scripts/utils.mjs", "export function announce(data) { return data; }\nexport function whisperToGms(content, extra) { return content; }\n"
                + "export function whisperToOwner(actor, content, extra) { return content; }\nexport function roomAudience(room) { return [room]; }\n"
                + "export function incidentAudienceIds(state) { return state.ids; }\n"],
            ["scripts/plant.mjs", "import { announce, whisperToGms, whisperToOwner, roomAudience, incidentAudienceIds } from \"./utils.mjs\";\n"
                + "import { announce as say } from \"./other.mjs\";\n"
                + "function tell(text) { return announce({ content: text }); }\nexport function plant(actor, room, state) {\n"
                + "  announce({ content: game.i18n.localize(\"DRPG.Plant.room\"), whisper: roomAudience(room) });\n"
                + "  const ids = incidentAudienceIds(state);\n  announce({ content: game.i18n.localize(\"DRPG.Plant.incident\"), whisper: ids });\n"
                + "  announce({ content: game.i18n.localize(\"DRPG.Plant.all\") });\n  whisperToGms(game.i18n.localize(\"DRPG.Plant.gms\"));\n"
                + "  whisperToOwner(actor, game.i18n.localize(\"DRPG.Plant.owner\"));\n  ui.notifications.warn(game.i18n.localize(\"DRPG.Plant.toast\"));\n"
                + "  tell(game.i18n.localize(\"DRPG.Plant.wrapped\"));\n  fill(game.i18n.localize(\"DRPG.Plant.arg\"));\n"
                + "  say({ content: game.i18n.localize(\"DRPG.Plant.notSent\") });\n}\n"
                + "function fill(n) { return announce({ content: game.i18n.format(\"DRPG.Plant.filled\", { n }) }); }\n"
                + "function pick(choice) { ui.notifications.info(game.i18n.localize(`DRPG.Plant.${choice}`)); }\n"],
            ["scripts/other.mjs", "export function announce(x) { return x; }\n"],
            ["scripts/notice-history.mjs", "export function show() { return game.i18n.localize(\"DRPG.Plant.own\"); }\n"]
        ]) });
        const planted = JSON.stringify(Object.fromEntries([...plant.keys].sort((a, b) => a[0].localeCompare(b[0]))
            .map(([k, sends]) => [k.slice(11), sends.map(x => `${x.sender.replace(/ \(.*$/, "").replace(/^scripts\/plant\.mjs:/, "")}:${[...x.readers].sort().join("+")}`).join(",")])));
        const want = JSON.stringify({ all: "announce:everyone", filled: "announce:everyone", gms: "whisperToGms:gms", incident: "announce:incident", own: "the notice history:own", owner: "whisperToOwner:owner",
            room: "announce:room", toast: "ui.notifications:browser", wrapped: "tell:everyone" });
        const wantProblems = ["scripts/notice-history-app.mjs is not among the scripts read - the notice history's entry has no keys"];
        if (JSON.stringify(plant.problems) !== JSON.stringify(wantProblems) || planted !== want) {
            problems.push(`audience: the planted senders read ${planted} with the problems ${JSON.stringify(plant.problems)}, not ${want} with ${JSON.stringify(wantProblems)}`);
        }
    }
    inputs.render = textRender.renderAll({ en, pl, prose });
    /* Each key's surface, as T4 reads it (the budgets' rules, the senders read off the scripts): C6's report counts every
       finding by it and by the key's top-level group. A handbook line is "handbook". */
    const surfaces = T.surfacesOf(inputs);
    const tally = (list, of) => Object.entries(list.reduce((acc, f) => ({ ...acc, [of(f)]: (acc[of(f)] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1]);
    const shownTally = (pairs, most) => pairs.slice(0, most).map(([k, n]) => `${k} ${n}`).join(", ") + (pairs.length > most ? `, ${pairs.length - most} more (${pairs.slice(most).reduce((n, [, c]) => n + c, 0)})` : "");
    if (screenMap) {
        const c = screenMap.counts, marks = [...inputs.marks.values()];
        console.log(`text: screens: ${c.screens} screen(s), ${c.hand} by SCREENS; ${c.entries} entry point(s) in ${c.files} script(s); keys ${c.keys}: ${c.assigned} assigned `
            + `(${c.byPrefixOnly} by prefix or table only), ${c.unassigned} unassigned; marks: rule ${marks.filter(x => x === "rule").length}, safety ${marks.filter(x => x === "safety").length}`);
        const split = textMap.readerSplit(screenMap, key => surfaces.surfaceOf(key), ["button", "window-title", "tab", "tooltip"]);
        console.log(`text: screens: the window surfaces by reader (decision 38; gm/player/unknown/unassigned): `
            + Object.entries(split).map(([id, r]) => `${id} ${r.gm}/${r.player}/${r.unknown}/${r.unassigned}`).join(", "));
    }
    if (audienceMap) {
        const c = audienceMap.counts;
        console.log(`text: audience: ${c.sends} send(s), ${c.keyed} with a key, ${c.wrappers} wrapper(s); keys ${c.keys}: ${c.assigned} assigned, ${c.unassigned} unassigned; `
            + `more than one reader ${c.many}, a list not read ${c.maybe}; by sender (sends/keys): `
            + Object.entries(c.bySender).sort((a, b) => b[1].keys - a[1].keys).map(([sn, v]) => `${sn} ${v.sends}/${v.keys}`).join(", "));
        console.log(`text: audience: keys by reader: ${Object.entries(c.byReader).sort((a, b) => b[1] - a[1]).map(([r, n]) => `${r} ${n}`).join(", ")}; `
            + `the notice history ${audienceMap.noticeHistory.keys} key(s), "${audienceMap.noticeHistory.readers}"`);
    }
    let fails = 0, reports = 0;
    for (const [name, m] of Object.entries(T.MODES)) {
        const r = T.DETECTORS[name](inputs);
        const rows = T.BASELINES[name];
        const b = rows ? T.againstBaseline(r, rows) : null;
        const counts = Object.entries(r.counts ?? {}).map(([k, n]) => `${k} ${n}`).join(", ");
        console.log(`text: ${m.test} ${m.mode} ${name} read ${r.read} found ${r.found.length}`
            + (b ? `; baseline ${rows.length} row(s), ${b.rows} site(s): ${b.matched} matched, ${b.left.length} new, ${b.stale.length} gone` : "")
            + (counts ? ` (${counts})` : ""));
        /* A detector that reads a file E65 writes carries that file's faults (T27: the guide's pairs table, E65 C9): red. */
        if (Array.isArray(r.faults)) problems.push(...r.faults.map(f => `pairs: docs/text-style.md: ${f}`));
        if (!(r.read > 0)) problems.push(`${name} read nothing of ${m.reads.join(" and ")}${LANG_DIR === null ? "" : ` (the language files of ${where})`} - it has proved nothing`);
        const live = b ? b.left : r.found;
        if (m.mode === "fail") {
            fails += live.length;
            problems.push(...live.map(f => `${m.test} (${name}): ${f.what}`), ...(b?.stale ?? []).map(s => `${m.test} (${name}): ${T.staleRow(name, s)}`));
        } else {
            reports += live.length;
            for (const f of ALL ? live : live.slice(0, 25)) console.log(`text:   ${m.test} report: ${f.what}`);
            if (!ALL && live.length > 25) console.log(`text:   ${m.test} report: ${live.length - 25} more not printed (node tools/check.mjs text --all)`);
        }
        /* C6's report detectors (their findings carry `lang`): by surface and by top-level key group, then each one's own. */
        if (live.length && live.every(f => f.lang)) {
            const handbook = f => /^docs\//.test(String(f.key));
            console.log(`text:   ${m.test} by surface: ${shownTally(tally(live, f => (handbook(f) ? "handbook" : surfaces.surfaceOf(f.key) ?? "unclassified")), 14)}`);
            console.log(`text:   ${m.test} by group: ${shownTally(tally(live, f => (handbook(f) ? String(f.key).split(":")[0] : T.groupOf(f.key))), 10)}`);
        }
        /* What a detector lists apart (T27's pairs whose before is gone, E65 C9): every one, they are the table's models. */
        if (Array.isArray(r.gone)) {
            console.log(`text:   ${m.test} gone: ${r.gone.length}`);
            for (const g of r.gone) console.log(`text:   ${m.test} gone: ${g.what}`);
        }
        /* T15's placeholders with no fixture (E65 C10), each with where it stands. */
        if (Array.isArray(r.unknown)) console.log(`text:   ${m.test} unknown placeholders: ${r.unknown.length ? r.unknown.map(u => `${u.name} (${u.where.length})`).join(", ") : "none"}`);
        /* C8's detectors, which read code (T13, T20): their findings carry `file` and no `lang`, counted by file. */
        if (live.length && live.every(f => f.file && !f.lang)) console.log(`text:   ${m.test} by file: ${shownTally(tally(live, f => f.file), 14)}`);
        if (r.bySurface) {
            console.log(`text:   ${m.test} strings by surface (over the target / over the limit / allowed): `
                + Object.entries(r.bySurface).map(([id, c]) => `${id} ${c.strings} (${c.target}/${c.limit}/${c.allowed})`).join(", ")
                + `; unclassified ${r.counts.unclassified}; over a limit that is red from a stage: ${r.found.filter(f => f.fail).length} (${shownTally(tally(r.found.filter(f => f.fail), f => f.fail), 4) || "none"})`
                + (r.counts.calls !== undefined ? `; senders read: ${r.counts.calls} call(s), ${r.counts.keyed} with a key, ${r.counts.private} private, ${r.counts.unresolved} key(s) built by a template` : ""));
        }
        if (r.byRule) {
            console.log(`text:   ${m.test} by rule (en/pl): ` + Object.entries(r.byRule).map(([id, c]) => (c.by ? `${id} read by ${c.by}` : `${id} ${c.en}/${c.pl}`)).join(", "));
        }
        if (r.byCount) console.log(`text:   ${m.test} strings by colons: ${Object.entries(r.byCount).map(([n, c]) => `${n}: ${c}`).join(", ")}`);
        /* C7's shares (T19, T22): each surface's strings or pairs, then what the detector counts in them. */
        if (r.perSurface) {
            console.log(`text:   ${m.test} per surface: ` + Object.entries(r.perSurface).sort((a, b) => (b[1].strings ?? b[1].pairs) - (a[1].strings ?? a[1].pairs))
                .map(([id, c]) => { const { strings, pairs, ...rest } = c; return `${id} ${strings ?? pairs} (${Object.entries(rest).map(([k, n]) => `${k} ${n}`).join(", ")})`; }).join(", "));
        }
        /* A detector that splits by stage (T8, T28): its debt above, then each entry of a shipped stage that looked and found
           nothing (one that forbids nothing is counted apart: it measured nothing), and what the entries not yet due find, by
           stage - the report each entry's stage starts from (E65-11). */
        if (Array.isArray(r.entries)) {
            const held = r.entries.filter(e => e.due && e.checked && !e.hits), unread = r.entries.filter(e => e.due && !e.checked), notDue = r.entries.filter(e => !e.due && e.hits);
            const debt = r.entries.filter(e => e.due && e.hits).map(e => `${e.id} (${e.stage}) ${e.hits}`);
            const byStage = {};
            for (const e of notDue) byStage[e.stage] = (byStage[e.stage] ?? 0) + e.hits;
            console.log(`text:   ${m.test} debt: ${debt.length ? debt.join(", ") : "none"}; held, of a shipped stage: ${held.length} (${held.map(e => e.id).join(", ")}); `
                + `of a shipped stage with nothing to look for: ${unread.length}`);
            console.log(`text:   ${m.test} not yet due: ${r.pending.length} finding(s) in ${notDue.length} entr${notDue.length === 1 ? "y" : "ies"}`
                + (notDue.length ? ` - ${Object.entries(byStage).map(([st, n]) => `${st} ${n}`).join(", ")}: ${notDue.map(e => `${e.id} ${e.hits}`).join(", ")}` : ""));
        }
    }
    /* The handbook-facts tool (E65 C12, E65-21): its self-check (the fixture handbook's units, the same on a second split, and
       `check` naming its planted faults exactly) red here, with its control - the self-check handed a split that cuts nothing
       must see it; then every handbook split twice, one line each: its units by kind, whether the second split gave the same,
       what split could not read, and whether the Polish handbook gives the English one's ids, kinds and lines. Red: a
       handbook missing, one that gives other units on a second split (the ids E57's facts files point at would not
       hold), and every split problem (a table row that runs into a blank line, a section number twice, a fence that
       never closes: E65 decision 81, 31.10 - a broken split lets E57 measure nothing). So a handbook edit of any stage
       that split cannot read turns `text` red. The Polish against the English stays a reading for E57. */
    const facts = await import(url.pathToFileURL(path.join(REPO, "tools", "handbook-facts.mjs")).href);
    problems.push(...facts.selfCheck().map(p => `handbook-facts: ${p}`));
    if (!facts.selfCheck(() => ({ handbook: null, units: [], counts: {}, problems: [] })).some(p => p.startsWith("split cuts the fixture into []"))) {
        problems.push("handbook-facts: the self-check does not see a split that cuts nothing - it would pass a broken split");
    }
    const cut = {};
    for (const f of HANDBOOKS) {
        if (!exists(f)) { problems.push(`handbook-facts: ${f} is missing - nothing was split`); continue; }
        const once = facts.split(read(f), { file: f }), again = facts.split(read(f), { file: f });
        cut[f] = once;
        if (JSON.stringify(once) !== JSON.stringify(again)) problems.push(`handbook-facts: ${f} gives other units on a second split`);
        problems.push(...once.problems.map(p => `handbook-facts: ${f}: ${p}`));
        const c = once.counts, pair = f.endsWith(".pl.md") ? cut[f.replace(/\.pl\.md$/, ".en.md")] : null;
        const shape = r => JSON.stringify(r.units.map(u => `${u.id} ${u.kind} ${/line (\d+)$/.exec(u.place)?.[1]}`));
        console.log(`text: handbook-facts: ${f}: ${c.units} unit(s) - paragraph ${c.paragraph}, row ${c.row}, note ${c.note} - in ${c.sections} section(s); `
            + `the same on a second split: ${JSON.stringify(once) === JSON.stringify(again) ? "yes" : "no"}; ${once.problems.length} split problem(s)${once.problems.length ? ` (${once.problems.join("; ")})` : ""}`
            + (pair ? `; ids, kinds and lines as in English: ${shape(once) === shape(pair) ? "yes" : "no"}` : ""));
    }
    /* The pilot's working file (E65 C14, E65-23): docs/dev/text-pilot.json, the 40 strings the owner reads in C-pilot, held
       to its shape against this tree's files (tools/text-render.mjs pilotSchema) - a file E65 writes, so a fault is red - and
       one line of how far it is. Its control: the schema shown a copy of the file with five faults planted (39 strings, an
       entry with a field missing, a key no language file holds, the key of a naturalness pair and, since C-pilot, a
       question's owner with a verdict the sheet does not offer) must name each, or a schema broken to pass everything would
       leave this part green on a malformed pilot. */
    const PILOT_FILE = "docs/dev/text-pilot.json";
    if (!exists(PILOT_FILE)) problems.push(`pilot: ${PILOT_FILE} is missing - the pilot has nothing to render`);
    else {
        let pilot = null;
        try { pilot = JSON.parse(read(PILOT_FILE)); } catch (err) { problems.push(`pilot: ${PILOT_FILE} does not parse (${err.message})`); }
        const { pairs } = T.naturalnessPairs(exists(T.NATURALNESS_GUIDE) ? read(T.NATURALNESS_GUIDE) : "");
        const against = { en: new Map([...en, ...prose]), pl, pairs, surfaces: Object.keys(budgets?.surfaces ?? {}) };
        if (pilot !== null) {
            const faults = textRender.pilotSchema(pilot, against);
            problems.push(...faults.map(p => `pilot: ${PILOT_FILE}: ${p}`));
            const strings = Array.isArray(pilot.strings) ? pilot.strings : [];
            const n = test => strings.filter(x => { try { return test(x); } catch { return false; } }).length;
            console.log(`text: pilot: ${PILOT_FILE}: ${strings.length} string(s), ${Array.isArray(pilot.questions) ? pilot.questions.length : 0} question(s); `
                + `facts for ${n(x => x.facts.length > 0)}; afters written en ${n(x => x.en.after !== null)}, pl ${n(x => x.pl.after !== null)}; `
                + `reviews left open ${n(x => Object.values(x.reviews).some(r => r !== null))}; owner's verdicts ${n(x => x.owner !== null)}`
                + ` (ok ${n(x => x.owner.verdict === "ok")}); questions answered ${(Array.isArray(pilot.questions) ? pilot.questions : []).filter(q => q?.owner).length}; ${faults.length} problem(s)`);
            const pair = pairs.find(p => p.key && against.en.has(p.key) && pl.has(p.key));
            if (strings.length >= 3 && pair && Array.isArray(pilot.questions) && pilot.questions.length) {
                const copy = JSON.parse(JSON.stringify(pilot));
                copy.strings = copy.strings.slice(0, textRender.PILOT_SIZE - 1);
                delete copy.strings[0].owner;
                copy.strings[1].key = "DRPG.Plant.noSuchKey";
                copy.strings[2] = { ...copy.strings[2], key: pair.key, en: { before: against.en.get(pair.key), after: null }, pl: { before: pl.get(pair.key), after: null } };
                copy.questions[0] = { ...copy.questions[0], owner: { verdict: "maybe", text: "", date: "01.11.2026" } };
                const seen = textRender.pilotSchema(copy, against);
                const want = [`strings holds ${textRender.PILOT_SIZE - 1} string(s)`, `(${copy.strings[0].key}) is not {`, "(DRPG.Plant.noSuchKey): not a key", `the key of naturalness pair ${pair.id}`,
                    `questions[0] (${copy.questions[0].id}): owner is neither`];
                const unseen = want.filter(w => !seen.some(p => p.includes(w)));
                if (unseen.length) problems.push(`pilot: the schema does not see ${unseen.map(w => JSON.stringify(w)).join(", ")} planted in a copy of ${PILOT_FILE} - it would pass a malformed pilot`);
            } else problems.push(`pilot: the schema's control has nothing to plant in (${strings.length} string(s), ${pair ? "a" : "no"} naturalness pair with a key in both files, ${Array.isArray(pilot.questions) ? pilot.questions.length : 0} question(s))`);
        }
    }
    const held = Object.keys(T.MODES).filter(name => !fixtures.some(p => p.startsWith(`${name} `))).length;
    console.log(`text: ${Object.keys(T.MODES).length} detector(s), ${held} hold their fixture; ${where}: en ${en.size} keys, pl ${pl.size}; `
        + `config.mjs prose ${prose.size}; scripts ${scripts.size}, docs ${docs.size}; FAIL found ${fails} beyond the baselines, `
        + `report found ${reports}; ${problems.length} problem(s)`);
    return problems;
}

const PARTS = { stamps, notes, dashes, parity, prose, names, moves, contract, registry, stages, tree, gatecode, live, text };

const asked = argv.filter((a, i) => !a.startsWith("--") && !(releaseAt >= 0 && i === releaseAt + 1) && !(langAt >= 0 && i === langAt + 1));
if (RELEASE === "" || (RELEASE !== null && !/^v\d+\.\d+\.\d+$/.test(RELEASE))) {
    console.log(`check: --release takes a tag like v1.2.61, got "${RELEASE}"`);
    process.exit(2);
}
if (LANG_DIR === "" || (LANG_DIR !== null && LANG_DIR.startsWith("--"))) {
    console.log(`check: --lang takes a directory that holds en.json and pl.json, got "${LANG_DIR}"`);
    process.exit(2);
}
const unknown = asked.filter(name => !PARTS[name]);
if (unknown.length) {
    console.log(`check: no part named ${unknown.join(", ")} (parts: ${Object.keys(PARTS).join(", ")})`);
    process.exit(2);
}
let red = false;
const redParts = [];
for (const name of asked.length ? asked : Object.keys(PARTS)) {
    const problems = await PARTS[name]();
    for (const p of problems) console.log(`${name}: ${p}`);
    if (problems.length) { red = true; redParts.push(name); }
}
const ran = asked.length ? asked : Object.keys(PARTS);
console.log(`check: ${ran.length} part(s), ${red ? `red: ${redParts.join(", ")}` : "all green"}`);
process.exitCode = red ? 1 : 0;
