/**
 * The ci layer's record: what each gate of `npm test` read and answered on one commit (E59 C0, 13.11.2026).
 * ---------------------------------------------------------------------------
 *     node audit/gate/ci-record.mjs [lint] [check] [gate] [suite] [scenarios]
 *                    run audit/harness/run-all.mjs with those parts (all five when none is named), then write one row
 *                    per part into audit/gate/ci-record.json
 *
 * WHY. E83 reviews every shipped stage and fixes what it finds; after a fix it should repeat only the gates whose
 * files the fix touched (the 11.10 amend). That needs, per gate, the commit it ran on, what it answered and the files
 * it depends on. This file is the only writer of that record, and `node tools/check.mjs gatecode` reads the record by
 * `recordProblems` below.
 *
 * NO ROW WITHOUT A RUN (the coordinator's rule of 13.11.2026). A row is written only here, only from the
 * results/run-all.json the run this process spawned wrote (its `startedAt` at or after the spawn, every part asked for
 * in it), and only on a clean working tree, so the row's commit is the code that ran. A part's result is read off
 * run-all's own status for it - "passed" for green, "failed" for anything else - and never taken from an argument.
 * The files a gate depends on come from GATE_FILES, never from the caller. Each row carries a digest of its own fields
 * (`digestOf`): a row edited by hand without the digest made again is red. That catches a careless edit, not a deliberate one: a
 * hand that recomputes the digest passes, and nothing here signs. The record is committed only after a real run; the
 * repository carries none until then (the check allows the file to be absent).
 *
 * GATE_FILES is declared, not measured: what each part reads, by its own description (run-all.mjs's header). `check`
 * reads nearly the whole tree, so its row says "**".
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { execFileSync, spawnSync } from "node:child_process";

export const SCHEMA = "drpg-ci-record/1";
export const RECORD_FILE = "audit/gate/ci-record.json";
export const PARTS = Object.freeze(["lint", "check", "gate", "suite", "scenarios"]);
const MODULE_FILES = ["module.json", "scripts/**", "lang/**", "styles/**", "fonts/**", "icons/**", "docs/handbooks/**"];
export const GATE_FILES = Object.freeze({
    lint: Object.freeze(["eslint.config.mjs", "scripts/**", "tools/**", "audit/**/*.mjs", "audit/harness/package-lock.json"]),
    check: Object.freeze(["**"]),
    gate: Object.freeze(["audit/gate/**"]),
    suite: Object.freeze([...MODULE_FILES, "tools/**", "docs/**", "audit/harness/**"]),
    scenarios: Object.freeze([...MODULE_FILES, "audit/harness/**"])
});
const FIELDS = ["gate", "command", "commit", "result", "status", "counts", "ms", "exitCode", "files", "runStartedAt", "node", "platform"];

/** The digest of a row: SHA-256 of its fields in FIELDS' order, as JSON. */
export function digestOf(row) {
    return crypto.createHash("sha256").update(JSON.stringify(FIELDS.map(f => [f, row[f] ?? null]))).digest("hex");
}

/** What is wrong with a record, as sentences; [] when nothing is. */
export function recordProblems(record) {
    const problems = [];
    if (!record || typeof record !== "object") return ["the record is not an object"];
    if (record.schema !== SCHEMA) problems.push(`its schema is "${record.schema}", not "${SCHEMA}"`);
    if (!Array.isArray(record.rows)) return [...problems, "it has no rows array"];
    const runs = new Map();
    record.rows.forEach((row, i) => {
        const at = `row ${i + 1} (${row?.gate ?? "no gate"})`;
        if (!row || typeof row !== "object") { problems.push(`${at} is not an object`); return; }
        if (!PARTS.includes(row.gate)) problems.push(`${at}: "${row.gate}" is not a part of run-all.mjs`);
        if (typeof row.command !== "string" || !/^node audit\/harness\/run-all\.mjs( [a-z]+)*$/.test(row.command)) problems.push(`${at}: its command is not a run of audit/harness/run-all.mjs`);
        else if (!row.command.split(" ").slice(2).includes(row.gate) && row.command !== "node audit/harness/run-all.mjs") problems.push(`${at}: its command did not run ${row.gate}`);
        if (typeof row.commit !== "string" || !/^[0-9a-f]{40}$/.test(row.commit)) problems.push(`${at}: its commit is not a full commit id`);
        if (!Array.isArray(row.files) || !row.files.length) problems.push(`${at}: it names no files it depends on`);
        else if (PARTS.includes(row.gate) && JSON.stringify(row.files) !== JSON.stringify(GATE_FILES[row.gate])) problems.push(`${at}: its files are not GATE_FILES' for ${row.gate}`);
        if (row.result !== "passed" && row.result !== "failed") problems.push(`${at}: its result "${row.result}" is neither passed nor failed`);
        else if ((row.result === "passed") !== (row.status === "green")) problems.push(`${at}: it says ${row.result} where run-all said ${row.status ?? "nothing"}`);
        if (!Number.isInteger(row.exitCode)) problems.push(`${at}: it carries no exit code`);
        if (typeof row.runStartedAt !== "string" || Number.isNaN(Date.parse(row.runStartedAt))) problems.push(`${at}: it carries no run time`);
        if (row.digest !== digestOf(row)) problems.push(`${at}: its digest does not match its fields - written or edited by hand`);
        const key = `${row.commit}|${row.runStartedAt}|${row.command}`;
        if (!runs.has(key)) runs.set(key, []);
        runs.get(key).push(row);
    });
    for (const rows of runs.values()) {
        const allPassed = rows.every(r => r.result === "passed");
        const exit = rows[0].exitCode;
        if (rows.some(r => r.exitCode !== exit)) problems.push(`one run (${rows[0].runStartedAt}) carries two exit codes`);
        else if (allPassed && exit !== 0) problems.push(`a run whose rows all passed exited ${exit} (${rows[0].runStartedAt}): a passed over a red exit`);
        else if (!allPassed && exit === 0) problems.push(`a run with a failed row exited 0 (${rows[0].runStartedAt})`);
    }
    return problems;
}

/** A row, digested, as the writer makes it. */
export function makeRow(fields) {
    const row = Object.fromEntries(FIELDS.map(f => [f, fields[f] ?? null]));
    return { ...row, digest: digestOf(row) };
}

/** The planted rows the check wants refused, each alone, and a control it wants accepted. */
export function selfCheck() {
    const base = {
        gate: "lint", command: "node audit/harness/run-all.mjs lint", commit: "0".repeat(40), result: "passed", status: "green",
        counts: "320 files, 0 problem(s)", ms: 1000, exitCode: 0, files: [...GATE_FILES.lint], runStartedAt: "2026-11-13T00:00:00.000Z",
        node: "v22", platform: "linux-x64"
    };
    const control = { schema: SCHEMA, rows: [makeRow(base)] };
    const plants = {
        "no files": { schema: SCHEMA, rows: [makeRow({ ...base, files: [] })] },
        "files not the gate's": { schema: SCHEMA, rows: [makeRow({ ...base, files: ["README.md"] })] },
        "passed over exit 1": { schema: SCHEMA, rows: [makeRow({ ...base, exitCode: 1 })] },
        "passed where run-all said red": { schema: SCHEMA, rows: [makeRow({ ...base, status: "red" })] },
        "a gate run-all has not": { schema: SCHEMA, rows: [makeRow({ ...base, gate: "fuzz" })] },
        "not a run of run-all": { schema: SCHEMA, rows: [makeRow({ ...base, command: "echo passed" })] },
        "a short commit": { schema: SCHEMA, rows: [makeRow({ ...base, commit: "421f2395" })] },
        "edited by hand": { schema: SCHEMA, rows: [{ ...makeRow(base), counts: "edited" }] }
    };
    const missed = Object.entries(plants).filter(([, r]) => !recordProblems(r).length).map(([name]) => `not refused: ${name}`);
    const controlOk = recordProblems(control).length === 0;
    if (!controlOk) missed.push(`the control was refused: ${recordProblems(control).join("; ")}`);
    return { planted: Object.keys(plants).length, refused: Object.keys(plants).length - missed.filter(m => m.startsWith("not refused")).length, controlOk, missed };
}

/* ---------------------------------- the writer ---------------------------------- */

if (process.argv[1] && path.resolve(process.argv[1]) === url.fileURLToPath(import.meta.url)) {
    const REPO = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "../..");
    const asked = process.argv.slice(2);
    const unknown = asked.filter(p => !PARTS.includes(p));
    if (unknown.length) { console.log(`ci-record: no part named ${unknown.join(", ")} (parts: ${PARTS.join(", ")})`); process.exit(2); }
    const parts = asked.length ? asked : [...PARTS];
    const git = (...args) => execFileSync("git", ["-C", REPO, ...args], { encoding: "utf8" }).trim();
    const dirty = git("status", "--porcelain").split("\n").filter(l => l && !l.endsWith(RECORD_FILE));
    if (dirty.length) { console.log(`ci-record: the working tree is not clean (${dirty.length} path(s)); a row's commit must be the code that ran`); process.exit(2); }
    const commit = git("rev-parse", "HEAD");
    const command = asked.length ? `node audit/harness/run-all.mjs ${parts.join(" ")}` : "node audit/harness/run-all.mjs";
    const spawnedAt = new Date();
    const run = spawnSync(process.execPath, ["run-all.mjs", ...parts], { cwd: path.join(REPO, "audit", "harness"), stdio: "inherit" });
    const exitCode = run.status ?? 1;
    const resultsFile = path.join(REPO, "audit", "harness", "results", "run-all.json");
    let report = null;
    try { report = JSON.parse(fs.readFileSync(resultsFile, "utf8")); } catch { /* checked below */ }
    if (!report || Date.parse(report.startedAt) < spawnedAt.getTime() - 1000) {
        console.log("ci-record: run-all.json was not written by this run; nothing recorded");
        process.exit(1);
    }
    const missing = parts.filter(p => !report.parts?.some(r => r.part === p));
    if (missing.length) { console.log(`ci-record: run-all.json has no result for ${missing.join(", ")}; nothing recorded`); process.exit(1); }
    if (git("rev-parse", "HEAD") !== commit) { console.log("ci-record: HEAD moved during the run; nothing recorded"); process.exit(1); }
    const rows = parts.map(p => {
        const r = report.parts.find(x => x.part === p);
        return makeRow({
            gate: p, command, commit, result: r.status === "green" ? "passed" : "failed", status: r.status,
            counts: String(r.counts ?? ""), ms: r.ms ?? null, exitCode, files: [...GATE_FILES[p]],
            runStartedAt: report.startedAt, node: report.node ?? process.version, platform: report.platform ?? `${process.platform}-${process.arch}`
        });
    });
    const file = path.join(REPO, RECORD_FILE);
    let record = { schema: SCHEMA, rows: [] };
    try { record = JSON.parse(fs.readFileSync(file, "utf8")); } catch { /* a first record */ }
    // A gate's row for this commit replaces the one before; rows of other commits and gates stay.
    record.rows = [...(record.rows ?? []).filter(r => !(r.commit === commit && parts.includes(r.gate))), ...rows];
    const problems = recordProblems(record);
    if (problems.length) { console.log(`ci-record: the record would not hold: ${problems.join("; ")}`); process.exit(1); }
    fs.writeFileSync(file, JSON.stringify(record, null, 2) + "\n");
    console.log(`ci-record: ${rows.length} row(s) for ${commit.slice(0, 8)} written to ${RECORD_FILE} (${rows.map(r => `${r.gate} ${r.result}`).join(", ")}); exit ${exitCode}`);
    process.exitCode = exitCode;
}
