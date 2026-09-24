/**
 * The repository's own checks, in Node, without Foundry (E30, 24.09.2026).
 * ---------------------------------------------------------------------------
 *     node tools/check.mjs [part ...]      every part when none is named
 *
 * One entry point, so CI and a release run the same command and a part added
 * later is not a new script somebody forgets to call. Each part prints its own
 * numbers - what it read as well as what it found, because a part that read
 * nothing has proved nothing - and the exit code is 1 when any part is red.
 *
 * Parts:
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
 *             block at the end of CLAUDE.md) against the tier files -
 *             tools/registry.mjs, whose `--write` regenerates the block - and
 *             the flows of scripts/tests-flows.mjs against both.
 */

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const lint = await import(url.pathToFileURL(path.join(REPO, "scripts", "tests-lint.mjs")).href);
const registryLib = await import(url.pathToFileURL(path.join(REPO, "tools", "registry.mjs")).href);

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

const PARTS = { contract, registry };

const asked = process.argv.slice(2).filter(a => !a.startsWith("--"));
const unknown = asked.filter(name => !PARTS[name]);
if (unknown.length) {
    console.log(`check: no part named ${unknown.join(", ")} (parts: ${Object.keys(PARTS).join(", ")})`);
    process.exit(2);
}
let red = false;
for (const name of asked.length ? asked : Object.keys(PARTS)) {
    const problems = await PARTS[name]();
    for (const p of problems) console.log(`${name}: ${p}`);
    if (problems.length) red = true;
}
process.exitCode = red ? 1 : 0;
