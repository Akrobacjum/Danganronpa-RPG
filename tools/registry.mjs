/**
 * The repository's registries, held to the tree (E30, 24.09.2026).
 * ---------------------------------------------------------------------------
 *     node tools/registry.mjs            check; one line per problem, exit 1 on any
 *     node tools/registry.mjs --write    regenerate CLAUDE.md's R-number block, then check
 *     node tools/check.mjs registry      the same check, as one part of the repository's checks
 *
 * WHY. A scenario number and an R number are how a comment, a commit and an
 * audit find the same thing a year later, so a number is never reused - and a
 * list kept by hand beside the thing it lists is the list that rots. Two lists
 * are held here:
 * - the harness's scenarios, in audit/harness/README.md between
 *   `<!-- scenarios:start -->` and `<!-- scenarios:end -->`: one row per number,
 *   planned and retired ones included, against the files and their `layers`;
 * - the suite's R numbers, in CLAUDE.md between `<!-- r-registry:start -->` and
 *   `<!-- r-registry:end -->`: generated from the tier files by `--write`, which
 *   keeps what cannot be generated - each row's Since (history before 1.2.50 is
 *   squashed and CI clones shallow, so it is read from the tags once and then
 *   kept), a removed test's row, and the tier-1 tests older than 1.2.61 that
 *   carry no number.
 *
 * - the known leaks, in audit/harness/known-leaks.json: each entry's shape, a
 *   closing stage that has not shipped (none past 1.3.0), a deferral only for
 *   metadata of medium or lower (D27), a README marker for what stays, and the
 *   scenario and check that see it - and no "[known leak" bracket in a name;
 * - the flows, in scripts/tests-flows.mjs: each flow's scenarios are rows of
 *   the table above and tag its checks (`flow: "<id>"`), and a flow not yet
 *   covered names a stage that has not shipped. That every GM-bridge action and
 *   socket listener belongs to a flow is the suite's R160, which reads the source.
 *
 * Node only, no dependencies; it reads the tier files as text with the suite's
 * own detectors (scripts/tests-lint.mjs) and the stage ledger with
 * tools/stages.mjs, so the three readers cannot disagree.
 */

import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { execFileSync } from "node:child_process";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_DEFAULT = path.resolve(HERE, "..");
const lint = await import(url.pathToFileURL(path.join(REPO_DEFAULT, "scripts", "tests-lint.mjs")).href);
const stagesLib = await import(url.pathToFileURL(path.join(REPO_DEFAULT, "tools", "stages.mjs")).href);

/* Reserved by number, with who holds each (CLAUDE.md, "Numbering new tests"). A
   reserved number used by a test shows the test; unused, it shows its owner. */
export const RESERVED = Object.freeze({
    113: "A5 (E13)", 114: "A5 (E13)", 115: "A5 (E13)", 116: "A5 (E13)", 117: "A5 (E13)",
    118: "A5, written in E12", 119: "A5, written in E12", 120: "A5 (E13)",
    121: "A4 (E22)", 122: "A1 (E23)", 123: "A6 (E24)", 124: "A6 (E24)",
    160: "the FLOWS test (E30)"
});

const R_START = "<!-- r-registry:start -->", R_END = "<!-- r-registry:end -->";
const S_START = "<!-- scenarios:start -->", S_END = "<!-- scenarios:end -->";
const RNAME = /^R(\d+)([a-z]?) - (.+)$/s;
const LAYERS_RE = /export const layers = (\[[^\]]*\])/;
const STATUSES = ["exists", "planned", "probe", "retired"];

const read = (repo, rel) => fs.readFileSync(path.join(repo, rel), "utf8");
const cell = text => String(text).replace(/\|/g, "\\|");
const uncell = text => String(text).replace(/\\\|/g, "|").trim();
const between = (text, start, end) => {
    const a = text.indexOf(start), b = text.indexOf(end);
    return a < 0 || b < a ? null : { a, b: b + end.length, inner: text.slice(a + start.length, b) };
};

/* --------------------------------------------------------------------------
 * R numbers
 * -------------------------------------------------------------------------- */

/** Every test of the three tier files: `{ tier, name, r, n, title }` (`r` null when unnumbered). */
export function tierTests(repo = REPO_DEFAULT) {
    const out = [];
    for (const tier of [0, 1, 2]) {
        for (const t of lint.testsIn(read(repo, `scripts/tests-tier${tier}.mjs`))) {
            const m = t.name.match(RNAME);
            out.push({ tier, name: t.name, r: m ? `R${m[1]}${m[2]}` : null, n: m ? Number(m[1]) : null, title: m ? m[3] : t.name });
        }
    }
    return out;
}

const rKey = r => { const m = String(r).match(/^R(\d+)([a-z]?)$/); return m ? Number(m[1]) * 100 + (m[2] ? m[2].charCodeAt(0) - 96 : 0) : Infinity; };

/** The block in CLAUDE.md as rows, the grandfathered names and the first line; null when absent. */
export function readRBlock(claude) {
    const block = between(claude, R_START, R_END);
    if (!block) return null;
    const rows = new Map();
    const grandfathered = [];
    let next = null, inList = false;
    for (const line of block.inner.split("\n")) {
        const first = line.match(/^Next free: (R\d+)\./);
        if (first) next = first[1];
        const row = line.match(/^\| (R\d+[a-z]?) \| ([^|]*) \| ([^|]*) \| (.*) \|$/);
        if (row) rows.set(row[1], { r: row[1], tier: row[2].trim(), since: row[3].trim(), title: uncell(row[4]) });
        if (/^Tier-1 tests older than 1\.2\.61 with no number/.test(line)) { inList = true; continue; }
        if (inList && line.startsWith("- ")) grandfathered.push(line.slice(2));
    }
    return { rows, grandfathered, next, block };
}

/* The version or stage a number first shipped in: the first v1.2.x tag at or after
   1.2.50 whose suite carries it (1.2.50 is the squash, so "<=1.2.50"), else the first
   stage in tools/stages.json that has not shipped - the one being worked on. */
function sinceOf(repo, numbers) {
    const out = new Map();
    let tags = [];
    try {
        tags = execFileSync("git", ["-C", repo, "tag", "-l", "v1.2.*"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).split("\n").filter(Boolean)
            .map(t => t.slice(1)).filter(v => stagesLib.compareVersions(v, "1.2.50") >= 0)
            .sort(stagesLib.compareVersions);
    } catch { /* no git here: every new row takes the stage being worked on */ }
    for (const version of tags) {
        let text = "";
        for (const file of ["scripts/tests.mjs", "scripts/tests-tier0.mjs", "scripts/tests-tier1.mjs"]) {
            try { text += execFileSync("git", ["-C", repo, "show", `v${version}:${file}`], { encoding: "utf8", maxBuffer: 64 << 20, stdio: ["ignore", "pipe", "ignore"] }); }
            catch { /* not in this release */ }
        }
        for (const m of text.matchAll(/^ {4}\["(R\d+[a-z]?)\s*(?:·|-)/gm)) {
            if (numbers.has(m[1]) && !out.has(m[1])) out.set(m[1], version === "1.2.50" ? "<=1.2.50" : version);
        }
    }
    const doc = stagesLib.loadStages(repo), mod = stagesLib.moduleVersion(repo);
    const current = doc.stages.find(s => !stagesLib.isShipped(s, mod))?.id ?? "?";
    for (const r of numbers) if (!out.has(r)) out.set(r, current);
    return out;
}

/** The block's text, generated from the tier files, keeping what is not generated. */
export function renderRBlock(repo, existing) {
    const tests = tierTests(repo).filter(t => t.r && t.tier < 2);
    const rows = new Map();
    /* A reserved row is a placeholder: the test that takes its number is new. */
    const keptRow = r => { const row = existing?.rows.get(r); return row && !/^reserved: /.test(row.title) && row.since !== "-" ? row : null; };
    const fresh = new Set(tests.map(t => t.r).filter(r => !keptRow(r)));
    const since = fresh.size ? sinceOf(repo, fresh) : new Map();
    for (const t of tests) {
        const kept = keptRow(t.r);
        rows.set(t.r, { r: t.r, tier: String(t.tier), since: kept?.since ?? since.get(t.r),
            title: t.r === "R151" ? `${t.title} (R21 until 1.2.61)` : t.title });
    }
    /* A test that went keeps its row, marked with the stage that removed it. */
    const doc = stagesLib.loadStages(repo), mod = stagesLib.moduleVersion(repo);
    const current = doc.stages.find(s => !stagesLib.isShipped(s, mod))?.id ?? "?";
    for (const [r, row] of existing?.rows ?? []) {
        if (rows.has(r) || /^reserved: /.test(row.title)) continue;
        rows.set(r, { ...row, title: /\(removed in [^)]+\)$/.test(row.title) ? row.title : `${row.title} (removed in ${current})` });
    }
    for (const [n, owner] of Object.entries(RESERVED)) {
        if (![...rows.keys()].some(r => rKey(r) === Number(n) * 100)) rows.set(`R${n}`, { r: `R${n}`, tier: "-", since: "-", title: `reserved: ${owner}` });
    }
    const used = [...rows.keys()].map(r => Math.floor(rKey(r) / 100));
    const next = Math.max(...used) + 1;
    const unused = Object.entries(RESERVED).filter(([n]) => rows.get(`R${n}`)?.title.startsWith("reserved: "));
    const byOwner = new Map();
    for (const [n, owner] of unused) byOwner.set(owner, [...(byOwner.get(owner) ?? []), Number(n)]);
    /* R113, R114, R115 -> R113-R115: the first line is read by people. */
    const ranges = list => list.sort((a, b) => a - b).reduce((out, n) => {
        const last = out.at(-1);
        if (last && n === last[1] + 1) last[1] = n; else out.push([n, n]);
        return out;
    }, []).map(([a, b]) => (a === b ? `R${a}` : `R${a}-R${b}`)).join(", ");
    const grandfathered = existing?.grandfathered.length ? existing.grandfathered
        : tierTests(repo).filter(t => t.tier < 2 && !t.r).map(t => t.name);
    return [
        R_START,
        `Next free: R${next}. Reserved and unused: ${[...byOwner].map(([owner, list]) => `${ranges(list)} for ${owner}`).join("; ") || "none"}.`,
        "",
        "| R | Tier | Since | Test |",
        "| --- | --- | --- | --- |",
        ...[...rows.values()].sort((a, b) => rKey(a.r) - rKey(b.r)).map(row => `| ${row.r} | ${row.tier} | ${row.since} | ${cell(row.title)} |`),
        "",
        `Tier-1 tests older than 1.2.61 with no number (${grandfathered.length}, names kept):`,
        "",
        ...grandfathered.map(name => `- ${name}`),
        R_END
    ].join("\n");
}

function rProblems(repo) {
    const errs = [];
    const claude = read(repo, "CLAUDE.md");
    const block = readRBlock(claude);
    if (!block) return [`CLAUDE.md has no ${R_START} ... ${R_END} block - run node tools/registry.mjs --write`];
    const tests = tierTests(repo);
    const seen = new Map();
    for (const t of tests.filter(t => t.r)) {
        if (seen.has(t.r)) errs.push(`${t.r} is used twice: "${seen.get(t.r).name}" (tier ${seen.get(t.r).tier}) and "${t.name}" (tier ${t.tier})`);
        seen.set(t.r, t);
    }
    for (const t of tests) {
        if (t.tier === 2 && t.r) errs.push(`tier-2 tests are named, not numbered: "${t.name}"`);
        if (t.tier < 2 && !t.r && !block.grandfathered.includes(t.name)) {
            errs.push(`a tier-${t.tier} test with no R number, not on the list of the ones older than 1.2.61: "${t.name}"`);
        }
    }
    const names = new Set(tests.map(t => t.name));
    for (const name of block.grandfathered) if (!names.has(name)) errs.push(`on the list of unnumbered tier-1 tests and in no tier file: "${name}" - take it off, or follow its rename`);
    for (const t of tests.filter(t => t.r && t.tier < 2)) {
        const row = block.rows.get(t.r);
        const want = t.r === "R151" ? `${t.title} (R21 until 1.2.61)` : t.title;
        if (!row) errs.push(`${t.r} (tier ${t.tier}) is in the tier files and not in CLAUDE.md's registry - run node tools/registry.mjs --write`);
        else {
            if (row.title !== want) errs.push(`${t.r}'s name in the registry is not the test's: "${row.title}" / "${want}"`);
            if (row.tier !== String(t.tier)) errs.push(`${t.r} is tier ${t.tier} in the tier files and tier ${row.tier} in the registry`);
        }
    }
    for (const [r, row] of block.rows) {
        if (seen.has(r) || /^reserved: /.test(row.title) || /\(removed in [^)]+\)$/.test(row.title)) continue;
        errs.push(`${r} is in the registry and in no tier file - a deleted test keeps its row marked "(removed in <stage>)" (--write does it)`);
    }
    for (const [n, owner] of Object.entries(RESERVED)) {
        if (!block.rows.has(`R${n}`)) errs.push(`R${n} is reserved (${owner}) and has no row`);
    }
    const expected = renderRBlock(repo, block);
    const want = expected.match(/^Next free: (R\d+)\./m)?.[1];
    if (block.next !== want) errs.push(`the registry says "Next free: ${block.next}", and the next free number is ${want}`);
    if (!errs.length && block.block.inner !== between(expected, R_START, R_END).inner) {
        errs.push("CLAUDE.md's R-number block is not what the tier files generate - run node tools/registry.mjs --write and read the diff");
    }
    return errs;
}

/* --------------------------------------------------------------------------
 * Scenario numbers
 * -------------------------------------------------------------------------- */

/** The README's scenario table as rows `{ no, file, layers, status, stage, what }`, or `{ error }`. */
export function readScenarioTable(readme) {
    const block = between(readme, S_START, S_END);
    if (!block) return { error: `audit/harness/README.md has no ${S_START} ... ${S_END} table` };
    const lines = block.inner.split("\n").filter(l => l.startsWith("|"));
    const header = lines.shift();
    if (!/^\| No\. \| File \| Layers \| Status \| Stage \| What it asks \|$/.test(header ?? "")) {
        return { error: `the scenario table's header is not "| No. | File | Layers | Status | Stage | What it asks |": ${header}` };
    }
    lines.shift();
    const rows = [];
    for (const line of lines) {
        const c = line.split(/(?<!\\)\|/).slice(1, -1).map(uncell);
        if (c.length !== 6 || !/^\d\d$/.test(c[0])) return { error: `a row of the scenario table does not parse: ${line}` };
        rows.push({ no: c[0], file: c[1].replace(/`/g, ""), layers: c[2], status: c[3], stage: c[4], what: c[5] });
    }
    return { rows };
}

function scenarioProblems(repo) {
    const errs = [];
    const table = readScenarioTable(read(repo, "audit/harness/README.md"));
    if (table.error) return [table.error];
    const doc = stagesLib.loadStages(repo), mod = stagesLib.moduleVersion(repo);
    const dirs = ["audit/harness/scenarios", "audit/harness/probes"];
    const files = dirs.flatMap(dir => fs.readdirSync(path.join(repo, dir)).filter(f => /^\d\d-.*\.mjs$/.test(f)).map(f => `${dir.replace("audit/harness/", "")}/${f}`));
    const byNo = new Map();
    for (const row of table.rows) {
        if (byNo.has(row.no)) errs.push(`scenario number ${row.no} has two rows`);
        byNo.set(row.no, row);
        if (!STATUSES.includes(row.status)) errs.push(`${row.no}: status "${row.status}" is not one of ${STATUSES.join(", ")}`);
        const onDisk = row.file !== "-" && fs.existsSync(path.join(repo, "audit/harness", row.file));
        if (row.file !== "-" && !row.file.startsWith(`${row.file.startsWith("probes/") ? "probes" : "scenarios"}/${row.no}-`)) {
            errs.push(`${row.no}: the row names ${row.file}, whose number is not ${row.no}`);
        }
        if ((row.status === "exists" || row.status === "probe") && !onDisk) errs.push(`${row.no}: the row names ${row.file}, which does not exist`);
        if (row.status === "planned") {
            if (onDisk) errs.push(`${row.no}: planned, and ${row.file} exists - flip the row to exists in the commit that writes the file`);
            const s = stagesLib.stageStatus(doc, row.stage, mod);
            if (!s.known) errs.push(`${row.no}: planned for ${row.stage}, which tools/stages.json does not know`);
            else if (s.shipped) errs.push(`${row.no}: planned for ${row.stage}, which shipped in ${s.version} without ${row.file}`);
        }
        if (onDisk) {
            const line = read(repo, `audit/harness/${row.file}`).match(LAYERS_RE);
            let exported = null;
            try { exported = line ? JSON.parse(line[1]) : null; } catch { /* reported below */ }
            const stated = row.layers.split(",").map(x => x.trim()).filter(Boolean);
            if (!exported) errs.push(`${row.file} has no readable \`export const layers = [...]\``);
            else if (JSON.stringify([...exported].sort()) !== JSON.stringify([...stated].sort())) {
                errs.push(`${row.no}: ${row.file} exports layers ${JSON.stringify(exported)}, and the row says ${JSON.stringify(stated)}`);
            }
        }
    }
    const named = new Set(table.rows.map(r => r.file));
    for (const file of files) if (!named.has(file)) errs.push(`${file} has no row in audit/harness/README.md's scenario table - take the next free number in its decade`);
    return errs;
}

/*
 * A scenario that takes the "local-gate" layer runs on a real Foundry through
 * audit/live/sandbox-cluster.mjs, which has none of the harness's instruments.
 * What the adapter cannot give it - a run() argument such as `world` or
 * `permissionDenials`, a page hook, a verdict option - is read off the source by
 * the adapter's own `missingFrom`, so this and the gate cannot disagree; at the
 * gate the same finding is `adapter-missing`, which no waiver covers (E30).
 */
async function sandboxProblems(repo) {
    const decls = fs.readdirSync(path.join(repo, "audit/harness/scenarios")).filter(f => /^\d\d-.*\.mjs$/.test(f))
        .map(f => ({ f, src: read(repo, `audit/harness/scenarios/${f}`) }))
        .filter(({ src }) => { try { return JSON.parse(src.match(LAYERS_RE)?.[1] ?? "[]").includes("local-gate"); } catch { return false; } });
    if (!decls.length) return [];
    const adapter = path.join(repo, "audit/live/sandbox-cluster.mjs");
    if (!fs.existsSync(adapter)) return [`${decls.map(d => d.f).join(", ")} take the local-gate layer, and audit/live/sandbox-cluster.mjs is missing`];
    const { missingFrom } = await import(url.pathToFileURL(adapter).href);
    return decls.flatMap(({ f, src }) => {
        const missing = missingFrom(src);
        return missing.length ? [`scenarios/${f} takes the local-gate layer and needs ${missing.join(", ")}, which the sandbox adapter does not give`] : [];
    });
}

/* --------------------------------------------------------------------------
 * Known leaks
 * -------------------------------------------------------------------------- */

async function leakProblems(repo) {
    let doc, canary;
    try { doc = JSON.parse(read(repo, "audit/harness/known-leaks.json")); }
    catch (err) { return [`audit/harness/known-leaks.json does not parse: ${err.message}`]; }
    try { canary = await import(`${url.pathToFileURL(path.join(repo, "audit", "harness", "lib", "canary.mjs")).href}?${Date.now()}`); }
    catch (err) { return [`audit/harness/lib/canary.mjs does not load: ${err.message}`]; }
    const stages = stagesLib.loadStages(repo), mod = stagesLib.moduleVersion(repo);
    const table = readScenarioTable(read(repo, "audit/harness/README.md"));
    const rows = new Set((table.rows ?? []).map(r => r.file));
    const errs = canary.validateKnownLeaks(doc, {
        stageStatus: stage => stagesLib.stageStatus(stages, stage, mod),
        readme: read(repo, "README.md"),
        scenarioText: name => {
            const rel = `scenarios/${name}.mjs`;
            if (!rows.has(rel)) return null;
            const file = path.join(repo, "audit/harness", rel);
            return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
        }
    });
    const ids = new Set((doc.leaks ?? []).map(e => e.id));
    const dir = path.join(repo, "audit/harness/scenarios");
    for (const file of fs.readdirSync(dir).filter(f => f.endsWith(".mjs"))) {
        const text = fs.readFileSync(path.join(dir, file), "utf8");
        if (text.includes("[known leak")) errs.push(`scenarios/${file}: a "[known leak" bracket - a known leak is the check option knownLeak, with measured`);
        for (const m of text.matchAll(/knownLeak:\s*"([^"]+)"/g)) if (!ids.has(m[1])) errs.push(`scenarios/${file}: knownLeak "${m[1]}" is not an entry of known-leaks.json`);
    }
    return errs;
}

/* --------------------------------------------------------------------------
 * Flows
 * -------------------------------------------------------------------------- */

async function flowProblems(repo) {
    const errs = [];
    const file = path.join(repo, "scripts", "tests-flows.mjs");
    if (!fs.existsSync(file)) return ["scripts/tests-flows.mjs is missing"];
    if (/(?:^|[^\w.])import\s*(?:[\w{*]|\()/m.test(lint.blankLiterals(lint.blankComments(fs.readFileSync(file, "utf8"))))) {
        errs.push("scripts/tests-flows.mjs imports something - it must not, so Node and the suite can read it alike");
    }
    let flows, exempt;
    try { ({ FLOWS: flows, FLOW_EXEMPT: exempt } = await import(`${url.pathToFileURL(file).href}?${Date.now()}`)); }
    catch (err) { return [...errs, `scripts/tests-flows.mjs does not load: ${err.message}`]; }
    const table = readScenarioTable(read(repo, "audit/harness/README.md"));
    const rows = new Map((table.rows ?? []).map(r => [r.file, r]));
    const doc = stagesLib.loadStages(repo), mod = stagesLib.moduleVersion(repo);
    const ids = new Set();
    for (const flow of flows ?? []) {
        const at = `flow ${flow.id}`;
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(flow.id ?? "")) errs.push(`${at}: the id is not kebab-case`);
        if (ids.has(flow.id)) errs.push(`${at}: the id is used twice`);
        ids.add(flow.id);
        if (!["covered", "partial", "planned"].includes(flow.status)) errs.push(`${at}: status "${flow.status}" is not covered, partial or planned`);
        if (flow.status === "covered") {
            if (!/^(?:<=)?\d+\.\d+\.\d+/.test(flow.stage ?? "")) errs.push(`${at}: covered, and its stage "${flow.stage}" is not the release it arrived in`);
            if (!flow.scenarios?.length) errs.push(`${at}: covered by no scenario`);
        } else {
            const s = stagesLib.stageStatus(doc, flow.stage, mod);
            if (!s.known) errs.push(`${at}: ${flow.status} until ${flow.stage}, which tools/stages.json does not know`);
            else if (s.shipped) errs.push(`${at}: ${flow.status} until ${flow.stage}, which shipped in ${s.version} - finish the flow or move it to a later stage`);
        }
        for (const id of flow.scenarios ?? []) {
            const rel = `scenarios/${id}.mjs`;
            if (!rows.has(rel)) { errs.push(`${at}: names scenario ${id}, which is not a row of audit/harness/README.md`); continue; }
            if (flow.status === "planned") continue;
            const text = fs.existsSync(path.join(repo, "audit/harness", rel)) ? read(repo, `audit/harness/${rel}`) : null;
            if (text === null) errs.push(`${at}: names scenario ${id}, and ${rel} does not exist`);
            else if (!text.includes(`flow: "${flow.id}"`)) errs.push(`${at}: names scenario ${id}, which tags no check with flow: "${flow.id}"`);
        }
    }
    for (const name of Object.keys(exempt ?? {})) {
        if (!fs.existsSync(path.join(repo, "scripts", name))) errs.push(`FLOW_EXEMPT names ${name}, which is not in scripts/`);
    }
    return errs;
}

/* --------------------------------------------------------------------------
 * all
 * -------------------------------------------------------------------------- */

/** Every registry problem, one sentence each, and a line saying what was read. */
export async function registryProblems(repo = REPO_DEFAULT) {
    const problems = [...scenarioProblems(repo).map(p => `scenarios: ${p}`), ...(await sandboxProblems(repo)).map(p => `scenarios: ${p}`),
        ...rProblems(repo).map(p => `R numbers: ${p}`),
        ...(await flowProblems(repo)).map(p => `flows: ${p}`), ...(await leakProblems(repo)).map(p => `known leaks: ${p}`)];
    const table = readScenarioTable(read(repo, "audit/harness/README.md"));
    const block = readRBlock(read(repo, "CLAUDE.md"));
    const tests = tierTests(repo);
    let flowCount = "?", leakCount = "?";
    try { leakCount = JSON.parse(read(repo, "audit/harness/known-leaks.json")).leaks.length; } catch { /* reported above */ }
    try { flowCount = (await import(`${url.pathToFileURL(path.join(repo, "scripts", "tests-flows.mjs")).href}?${Date.now()}`)).FLOWS.length; } catch { /* reported above */ }
    const summary = `registry: ${table.rows?.length ?? 0} scenario rows; ${tests.filter(t => t.r).length} numbered tests, `
        + `${block?.grandfathered.length ?? 0} unnumbered tier-1 tests on the list, ${block?.rows.size ?? 0} registry rows, next free ${block?.next ?? "?"}; `
        + `${flowCount} flows; ${leakCount} known leaks`;
    return { problems, summary };
}

async function main(argv) {
    const repo = REPO_DEFAULT;
    if (argv.includes("--write")) {
        const claude = read(repo, "CLAUDE.md");
        const existing = readRBlock(claude);
        const text = renderRBlock(repo, existing);
        const next = existing
            ? claude.slice(0, existing.block.a) + text + claude.slice(existing.block.b)
            : `${claude.replace(/\n*$/, "")}\n\n## Registry: R numbers\n\nGenerated by \`node tools/registry.mjs --write\` from the tier files; see "Numbering new tests".\n\n${text}\n`;
        if (next !== claude) fs.writeFileSync(path.join(repo, "CLAUDE.md"), next);
        console.log(`registry: CLAUDE.md's R-number block ${next === claude ? "was already current" : "written"}`);
    }
    const { problems, summary } = await registryProblems(repo);
    console.log(summary);
    for (const p of problems) console.log(`registry: ${p}`);
    return problems.length ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === url.fileURLToPath(import.meta.url)) {
    process.exitCode = await main(process.argv.slice(2));
}
