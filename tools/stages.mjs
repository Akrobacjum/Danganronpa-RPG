/**
 * The stage ledger: which stage of the 1.3.0 plan has shipped (E30, 24.09.2026).
 * ---------------------------------------------------------------------------
 *     node tools/stages.mjs check                    the ledger, and every marker that names a stage
 *     node tools/stages.mjs check --release v1.2.61  ...and that this tree is that release
 *     node tools/stages.mjs ship E30                 the release commit marks its stage shipped
 *
 * WHY A FILE AND NOT A SENTENCE IN A PLAN. A test can now say "red until E07"
 * (`expectedRed` in scripts/tests-kit.mjs), and a harness check "a known leak,
 * closed in E06". Both are promises about a later release, and a promise
 * nobody holds anyone to is the twelve-permanent-reds bucket again under a
 * kinder name. The suite, this file's `check` and the release gate read the
 * same tools/stages.json with the same rule, so the release that ships E07
 * turns every marker still naming E07 into a failure on that same commit.
 *
 * THE ONE RULE. A stage has shipped when its row has a `version` and
 * module.json's version is at or past it. Compared number by number, because
 * 1.2.100 arrives with E45 and a string comparison puts it before 1.2.99.
 * `version` and `shipped` are written by `ship` and by nothing else, from
 * module.json and the UTC date, in the commit that bumps the version.
 * `planned` (D20's numbering) is information only: a stage that slips keeps
 * its row, and its version is the one it really shipped as.
 *
 * Node only, no dependencies, nothing the module loads: tools/ is
 * export-ignored, so an installed zip has no ledger, and the suite says so in
 * one line instead of guessing (stageLedger in tests-kit.mjs).
 */

import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { execFileSync } from "node:child_process";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
/* The suite's own reading of a marker (scripts/tests-lint.mjs, which imports nothing, so
   Node can load it): the suite and this tool cannot disagree about what a marker is. */
const { redMarkers, blankComments, lineAt } = await import(url.pathToFileURL(path.join(REPO, "scripts", "tests-lint.mjs")).href);

const VERSION_RE = /^\d+\.\d+\.\d+$/;
const TOUCHES = ["sockets", "rolls", "scenes"];

/** Negative, zero or positive as `a` is older than, the same as or newer than `b`. */
export function compareVersions(a, b) {
    const pa = String(a).split(".").map(Number), pb = String(b).split(".").map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const d = (pa[i] ?? 0) - (pb[i] ?? 0);
        if (d) return Math.sign(d);
    }
    return 0;
}

export function loadStages(repoDir = REPO) {
    return JSON.parse(fs.readFileSync(path.join(repoDir, "tools", "stages.json"), "utf8"));
}

export function moduleVersion(repoDir = REPO) {
    return JSON.parse(fs.readFileSync(path.join(repoDir, "module.json"), "utf8")).version;
}

const rowsOf = stages => Array.isArray(stages) ? stages : (stages?.stages ?? []);

/** THE rule (see the header): a version, and module.json at or past it. */
export function isShipped(row, modVersion) {
    return Boolean(row?.version) && compareVersions(modVersion, row.version) >= 0;
}

/** @returns {{known: boolean, shipped: boolean, version: string|null, on: string|null, index: number}} */
export function stageStatus(stages, id, modVersion) {
    const rows = rowsOf(stages);
    const index = rows.findIndex(r => r.id === id);
    const row = rows[index] ?? null;
    return { known: index >= 0, shipped: isShipped(row, modVersion), version: row?.version ?? null, on: row?.shipped ?? null, index };
}

/**
 * The verdict on one check that may carry a red marker - the harness's side of
 * the suite's `judge()` (tests-kit.mjs), with the same order: a stale or unknown
 * marker fails whatever the check measured, a check that could not measure
 * fails, and only a marked check that measured and came out false is red.
 *
 * @param {object} a
 * @param {boolean} a.ok          what the check found (true: it held)
 * @param {boolean} [a.measured]  required `true` on a marked check: it reached what it measures
 * @param {string} [a.stage]      the stage that is to turn it green
 * @param {string} [a.label]      what the red is, for the reason ("known leak S04-02")
 * @param {boolean} [a.foundryLimit]  red for good, for a reason outside the module: no stage to hold it to
 * @param {boolean} [a.deferred]      red past 1.3.0 (D27): no stage to hold it to
 * @returns {{status: "pass"|"expectedRed"|"fail", reason: string}}
 */
export function redVerdict({ ok, measured, stage = null, label = "an expected red", foundryLimit = false, deferred = false,
    stages, moduleVersion: modVersion }) {
    if (!stage && !foundryLimit && !deferred) return { status: ok ? "pass" : "fail", reason: "" };
    if (stage) {
        const s = stageStatus(stages, stage, modVersion);
        if (!s.known) return { status: "fail", reason: `${label} names "${stage}", which tools/stages.json does not know` };
        if (s.shipped) {
            return { status: "fail", reason: `${label} was to close in ${stage}, which shipped in ${s.version} on ${s.on}: `
                + "fix it, or move it to a later stage in the open" };
        }
    }
    if (measured !== true) return { status: "fail", reason: `${label} measured nothing: its precondition failed` };
    if (ok) return { status: "fail", reason: `unexpectedly passed: ${label} no longer reproduces - take the marker off` };
    const until = stage ? `until ${stage}` : foundryLimit ? "a Foundry limit" : "deferred to 1.3.x (D27)";
    return { status: "expectedRed", reason: `${label}, ${until}` };
}

/* --------------------------------------------------------------------------
 * What names a stage in the suite's source.
 * -------------------------------------------------------------------------- */

/**
 * Every `expectedRed(` in the tier files and every `until: "Exx"` in the kit
 * (DUMP_RULES), with where it is. A marker whose stage is not written out as a
 * string cannot be read without running the suite - R155 reads those - and is
 * reported as such rather than passed over.
 */
export function stageMarkers(repoDir = REPO) {
    const out = [];
    const dir = path.join(repoDir, "scripts");
    for (const file of fs.readdirSync(dir).filter(f => /^tests-tier\d+\.mjs$/.test(f)).sort()) {
        for (const m of redMarkers(fs.readFileSync(path.join(dir, file), "utf8")).found) {
            out.push({ file: `scripts/${file}`, line: m.line, kind: "expectedRed", stage: m.stage });
        }
    }
    const kit = path.join(dir, "tests-kit.mjs");
    if (fs.existsSync(kit)) {
        const code = blankComments(fs.readFileSync(kit, "utf8"));
        for (const m of code.matchAll(/\buntil:\s*"(E\d\d)"/g)) {
            out.push({ file: "scripts/tests-kit.mjs", line: lineAt(code, m.index), kind: "until", stage: m[1] });
        }
    }
    return out;
}

/* --------------------------------------------------------------------------
 * check
 * -------------------------------------------------------------------------- */

/** Everything wrong with the ledger and the markers, one sentence each; [] when nothing is. */
export function problems(doc, { modVersion, markers = [] } = {}) {
    const errs = [];
    const rows = doc?.stages;
    if (!Array.isArray(rows) || !rows.length) return ["tools/stages.json has no `stages` list"];
    const ids = new Set(), versions = new Map();
    let lastPlanned = null, lastVersion = null;
    rows.forEach((r, i) => {
        const at = `row ${i + 1} (${r?.id ?? "no id"})`;
        if (!/^E\d{2}$/.test(r?.id ?? "")) errs.push(`${at}: the id is not E and two digits`);
        else if (ids.has(r.id)) errs.push(`${at}: ${r.id} is listed twice`);
        ids.add(r?.id);
        if (!VERSION_RE.test(r?.planned ?? "")) errs.push(`${at}: planned "${r?.planned}" is not a version`);
        else {
            if (lastPlanned && compareVersions(r.planned, lastPlanned) <= 0) {
                errs.push(`${at}: planned ${r.planned} does not come after the row above's ${lastPlanned}`);
            }
            lastPlanned = r.planned;
        }
        if (r.version !== null && !VERSION_RE.test(r.version ?? "")) errs.push(`${at}: version "${r.version}" is not a version or null`);
        if (r.shipped !== null && !/^\d{4}-\d{2}-\d{2}$/.test(r.shipped ?? "")) errs.push(`${at}: shipped "${r.shipped}" is not a date or null`);
        if ((r.version === null) !== (r.shipped === null)) {
            errs.push(`${at}: version and shipped are written together, by \`ship\` - one of them is missing`);
        }
        if (r.version) {
            if (versions.has(r.version)) errs.push(`${at}: ${r.version} is already ${versions.get(r.version)}'s`);
            versions.set(r.version, r.id);
            if (lastVersion && compareVersions(r.version, lastVersion.version) <= 0) {
                errs.push(`${at}: shipped as ${r.version}, after ${lastVersion.id}'s ${lastVersion.version} - rows are in release order`);
            }
            lastVersion = r;
            if (modVersion && compareVersions(r.version, modVersion) > 0) {
                errs.push(`${at}: carries ${r.version}, newer than module.json's ${modVersion} - only \`ship\` writes a version, from module.json`);
            }
        }
        if (r.touches !== null && !(Array.isArray(r.touches) && r.touches.every(t => TOUCHES.includes(t))
            && new Set(r.touches).size === r.touches.length)) {
            errs.push(`${at}: touches is null or a list from ${TOUCHES.join(", ")}`);
        }
        if (!Array.isArray(r.drills) || !r.drills.every(d => typeof d === "string" && d)) errs.push(`${at}: drills is a list of names`);
    });
    if (modVersion && !versions.has(modVersion)) {
        errs.push(`module.json says ${modVersion} and no stage carries it - the release commit runs \`node tools/stages.mjs ship <id>\``);
    }
    for (const m of markers) {
        const where = `${m.file}:${m.line}`;
        if (m.stage === null) { errs.push(`${where}: expectedRed's stage is not written out as a string, so it cannot be checked here`); continue; }
        const row = rows.find(r => r.id === m.stage);
        if (!row) errs.push(`${where}: ${m.kind} names "${m.stage}", which is not a stage in tools/stages.json`);
        else if (isShipped(row, modVersion)) {
            errs.push(`${where}: ${m.kind} names ${m.stage}, which shipped in ${row.version} on ${row.shipped} - take it off or move it to a later stage`);
        }
    }
    return errs;
}

/** What `--release vX.Y.Z` adds: this tree is that release, and every earlier shipped stage has its tag. */
export function releaseProblems(doc, tag, { modVersion, tags }) {
    const errs = [];
    const version = String(tag).replace(/^v/, "");
    if (!VERSION_RE.test(version)) return [`--release ${tag}: not a vX.Y.Z tag`];
    if (modVersion !== version) errs.push(`--release ${tag}: module.json says ${modVersion}`);
    const row = doc.stages.find(r => r.version === version);
    if (!row) errs.push(`--release ${tag}: no stage carries ${version} - run \`node tools/stages.mjs ship <id>\` in the release commit`);
    else if (!isShipped(row, modVersion)) errs.push(`--release ${tag}: ${row.id} carries ${version} but has not shipped by the rule`);
    for (const r of doc.stages) {
        if (r.version && compareVersions(r.version, version) > 0) errs.push(`${r.id} carries ${r.version}, newer than the release ${tag}`);
    }
    const earlier = doc.stages.filter(r => r.version && r !== row);
    if (earlier.length && !tags.length) {
        errs.push("this clone has no v* tags at all (a shallow checkout?), so the earlier stages' releases cannot be checked - fetch them (fetch-depth: 0)");
    } else {
        for (const r of earlier) {
            if (!tags.includes(`v${r.version}`)) errs.push(`${r.id} says it shipped as ${r.version} and there is no tag v${r.version}`);
        }
    }
    return errs;
}

/* --------------------------------------------------------------------------
 * ship
 * -------------------------------------------------------------------------- */

/* One row per line, so `ship` changes one line and a diff shows which stage. */
function serialize(doc) {
    const value = v => Array.isArray(v) ? `[${v.map(x => JSON.stringify(x)).join(", ")}]` : JSON.stringify(v);
    const row = r => `{${Object.entries(r).map(([k, v]) => `${JSON.stringify(k)}: ${value(v)}`).join(", ")}}`;
    const head = Object.entries(doc).filter(([k]) => k !== "stages").map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`);
    return ["{", ...head, '  "stages": [', doc.stages.map(r => `    ${row(r)}`).join(",\n"), "  ]", "}", ""].join("\n");
}

/** @returns {{doc?: object, refused?: string[]}} the ledger with `id` shipped, or why not */
export function ship(doc, id, { modVersion, markers = [], today }) {
    const row = doc.stages.find(r => r.id === id);
    if (!row) return { refused: [`${id} is not a stage in tools/stages.json`] };
    if (row.version) return { refused: [`${id} already carries ${row.version} (shipped ${row.shipped}); a stage ships once`] };
    const holder = doc.stages.find(r => r.version === modVersion);
    if (holder) return { refused: [`module.json's ${modVersion} is ${holder.id}'s - bump module.json in the release commit first`] };
    const next = structuredClone(doc);
    Object.assign(next.stages.find(r => r.id === id), { version: modVersion, shipped: today });
    const errs = problems(next, { modVersion, markers });
    return errs.length ? { refused: errs } : { doc: next };
}

/* --------------------------------------------------------------------------
 * CLI
 * -------------------------------------------------------------------------- */

function main(argv) {
    const [cmd, ...rest] = argv;
    const doc = loadStages();
    const modVersion = moduleVersion();
    const markers = stageMarkers();
    if (cmd === "check") {
        const ri = rest.indexOf("--release");
        const errs = problems(doc, { modVersion, markers });
        if (ri >= 0) {
            let tags = [];
            try { tags = execFileSync("git", ["-C", REPO, "tag", "-l", "v*"], { encoding: "utf8" }).split("\n").filter(Boolean); }
            catch { /* not a git checkout: every tag reads as missing, and the line below says why */ }
            errs.push(...releaseProblems(doc, rest[ri + 1], { modVersion, tags }));
        }
        const shipped = doc.stages.filter(r => isShipped(r, modVersion));
        console.log(`stages: ${doc.stages.length} in the ledger, ${shipped.length} shipped (`
            + `${shipped.map(r => `${r.id} ${r.version}`).join(", ")}), module.json ${modVersion}; `
            + `${markers.filter(m => m.kind === "expectedRed").length} expectedRed marker(s) in the tier files, `
            + `${markers.filter(m => m.kind === "until").length} \`until\` stage(s) in the kit`);
        for (const e of errs) console.log(`stages: ${e}`);
        return errs.length ? 1 : 0;
    }
    if (cmd === "ship") {
        const id = rest[0];
        const res = ship(doc, id, { modVersion, markers, today: new Date().toISOString().slice(0, 10) });
        if (res.refused) {
            for (const e of res.refused) console.log(`stages: ship ${id} refused: ${e}`);
            return 1;
        }
        fs.writeFileSync(path.join(REPO, "tools", "stages.json"), serialize(res.doc));
        const row = res.doc.stages.find(r => r.id === id);
        console.log(`stages: ${id} shipped as ${row.version} on ${row.shipped}`);
        return 0;
    }
    console.log("usage: node tools/stages.mjs check [--release vX.Y.Z] | ship EXX");
    return 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === url.fileURLToPath(import.meta.url)) {
    process.exitCode = main(process.argv.slice(2));
}

export { serialize };
