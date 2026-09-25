/**
 * The repository's own checks, in Node, without Foundry (E30, 24.09.2026).
 * ---------------------------------------------------------------------------
 *     node tools/check.mjs [part ...] [--release vX.Y.Z]   every part when none is named
 *
 * One entry point, so CI and a release run the same command and a part added
 * later is not a new script somebody forgets to call. Each part prints its own
 * numbers - what it read as well as what it found, because a part that read
 * nothing has proved nothing - and the exit code is 1 when any part is red.
 * Only `names` needs `npm ci` in audit/harness (it parses with espree); the
 * rest are bare Node, so release.yml runs `stamps notes` before installing
 * anything.
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
 *             release notes; no U+2014 in CLAUDE.md or CONTRIBUTING.md outside
 *             inline code, nor in the code and workflows. U+2013 is not ruled
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
 *   contract  the test author contract, read off the text: in
 *             scripts/tests-tier*.mjs no cut bounded by a bare indexOf, no
 *             assertion true by construction, no needs() of anything but a
 *             probe (the suite's R156-R158 read the same detectors from
 *             scripts/tests-lint.mjs); in audit/harness/scenarios/*.mjs no
 *             check() that cannot fail. Each detector is run on its fixture
 *             first and the part is red if it does not flag exactly the
 *             fixture's violations. audit/harness/probes/ is not read: a probe
 *             records, it does not verdict.
 *   registry  the harness's scenario numbers (audit/harness/README.md) against
 *             the files and their layers, and the suite's R numbers (the
 *             block at the end of CLAUDE.md) against the tier files, unique -
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
const read = rel => fs.readFileSync(path.join(REPO, rel), "utf8");
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
    walk(JSON.parse(read(rel)), "");
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
    for (const f of ["CLAUDE.md", "CONTRIBUTING.md"]) {
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

function contract() {
    const problems = [];
    for (const name of ["bareCuts", "vacuousAsserts", "needsArgs", "vacuousChecks"]) {
        const fx = lint.FIXTURES[name];
        const lines = lint[name](fx.text).found.map(f => f.line).sort((a, b) => a - b);
        if (JSON.stringify(lines) !== JSON.stringify(fx.flags)) {
            problems.push(`${name} flags lines ${lines.join(",") || "none"} of its fixture, not ${fx.flags.join(",")} - the detector is broken`);
        }
    }
    const tiers = fs.readdirSync(path.join(REPO, "scripts")).filter(f => /^tests-tier\d+\.mjs$/.test(f)).sort();
    const count = { tests: 0, cuts: 0, asserts: 0, needs: 0, checks: 0 };
    for (const file of tiers) {
        const text = fs.readFileSync(path.join(REPO, "scripts", file), "utf8");
        count.tests += lint.testsIn(text).length;
        for (const [key, detector] of [["cuts", lint.bareCuts], ["asserts", lint.vacuousAsserts], ["needs", lint.needsArgs]]) {
            const r = detector(text);
            count[key] += r.read;
            problems.push(...r.found.map(f => `scripts/${file}:${f.line}: ${f.what}`));
        }
    }
    const scenarios = fs.readdirSync(path.join(REPO, "audit", "harness", "scenarios")).filter(f => f.endsWith(".mjs")).sort();
    for (const file of scenarios) {
        const r = lint.vacuousChecks(fs.readFileSync(path.join(REPO, "audit", "harness", "scenarios", file), "utf8"));
        count.checks += r.read;
        problems.push(...r.found.map(f => `audit/harness/scenarios/${file}:${f.line}: ${f.what}`));
    }
    if (!tiers.length || !count.tests) problems.push("no tier file with tests was read");
    if (!scenarios.length || !count.checks) problems.push("no scenario with checks was read");
    console.log(`contract: ${tiers.length} tier files, ${count.tests} tests, ${count.cuts} slice/split calls, `
        + `${count.asserts} ok/equal/needs calls, ${count.needs} needs() calls; ${scenarios.length} scenarios, `
        + `${count.checks} check() calls; ${problems.length} problem(s)`);
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

const PARTS = { stamps, notes, dashes, parity, prose, names, contract, registry, stages, tree, gatecode };

const asked = argv.filter((a, i) => !a.startsWith("--") && !(releaseAt >= 0 && i === releaseAt + 1));
if (RELEASE === "" || (RELEASE !== null && !/^v\d+\.\d+\.\d+$/.test(RELEASE))) {
    console.log(`check: --release takes a tag like v1.2.61, got "${RELEASE}"`);
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
