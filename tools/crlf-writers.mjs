/**
 * The tools that write files, on a Windows checkout (E26 prep, 14.11.2026; the E26 plan's tools item).
 * ---------------------------------------------------------------------------
 *     node tools/crlf-writers.mjs            clone HEAD with core.autocrlf=true into a temporary folder, run every
 *                                            tool that rewrites a tracked file, and hold the result; exit 1 on a fault
 *     node tools/crlf-writers.mjs --keep     the same, and leave the clone for a look
 *     node tools/crlf-writers.mjs --plant    the same with a planted writer that writes a file twice: must exit 1
 *
 * Why: on a CRLF checkout tools/chrome-icons.mjs once doubled the stylesheet's icon section (fixed in the 1.2.80 train,
 * fix crlf-G1), and tools/port-glass.py, run on a copy, would have rewritten scripts/glass.mjs (+229/-1530; removed in
 * E59 C5a). This runs each writer below on a clone whose text files have Windows line ends, as a Windows owner's copy
 * has, at a commit where every generated file is current, and asks two things of every file a writer touched:
 *   - `git diff` (which normalises line ends as the clone's config says) is empty - the writer changed no content;
 *   - no file has more lines than the commit's copy - nothing was written twice.
 * What it does not ask: that a writer keeps CRLF. Measured on 14.11.2026 at c31d9b0d, every one writes LF, and git
 * (autocrlf=true) puts the file back to the commit's bytes on add: a line-end flip in the working copy, not a change.
 * It needs audit/harness's node_modules (`npm ci` there): comments-lint parses with espree. About a minute here.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import url from "node:url";
import { execFileSync, spawnSync } from "node:child_process";

const REPO = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
/* Every tool of tools/ that rewrites a tracked file in its writing mode (`git grep writeFileSync tools/`, 14.11.2026).
   Left out: stages.mjs (it writes only when a stage ships), text-render, text-map, text-audience and handbook-facts
   (they write into a folder named on the command line), moved-only.mjs (its own scratch copies), e56/run.mjs (a
   one-off of E56's). A new writer of a tracked file is a row here. */
const WRITERS = [
    ["tools/chrome-icons.mjs"],
    ["tools/glyph-map.mjs"],
    ["tools/item-icons.mjs"],
    ["tools/token-icons.mjs"],
    ["tools/changelog.mjs", "--write"],
    ["tools/registry.mjs", "--write"],
    ["tools/comments-lint.mjs", "--write"],
    ["tools/css-lint.mjs", "--write"]
];

const git = (cwd, ...args) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
/* --plant: a writer of its own that writes CHANGELOG.md twice, as chrome-icons once wrote its section; the run must
   then be red on it, which is how this tool was seen to measure (14.11.2026). */
if (process.argv.includes("--plant")) {
    WRITERS.push(["-e", "const fs = require('fs'); const t = fs.readFileSync('CHANGELOG.md', 'utf8'); fs.writeFileSync('CHANGELOG.md', t + t);"]);
}
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "drpg-crlf-"));
const problems = [];
try {
    execFileSync("git", ["clone", "-q", "-c", "core.autocrlf=true", "--no-local", REPO, dir]);
    git(dir, "checkout", "-q", git(REPO, "rev-parse", "HEAD").trim());
    const css = fs.readFileSync(path.join(dir, "styles", "danganronpa.css"), "utf8");
    const crlf = (css.match(/\r\n/g) ?? []).length;
    if (!crlf) problems.push("the clone's styles/danganronpa.css has no CRLF - the clone is not a Windows checkout, and this measured nothing");
    const modules = path.join(REPO, "audit", "harness", "node_modules");
    if (fs.existsSync(modules)) fs.symlinkSync(modules, path.join(dir, "audit", "harness", "node_modules"), "dir");
    for (const [tool, ...args] of WRITERS) {
        const run = spawnSync(process.execPath, [tool, ...args], { cwd: dir, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
        const last = `${run.stdout}${run.stderr}`.trim().split("\n").pop()?.slice(0, 160) ?? "";
        console.log(`crlf-writers: ${[tool, ...args].join(" ")}: exit ${run.status}; ${last}`);
        if (run.status !== 0) problems.push(`${tool} exited ${run.status} on a CRLF checkout`);
    }
    const status = git(dir, "status", "--porcelain").split("\n").filter(Boolean);
    const touched = status.filter(l => !l.startsWith("??")).map(l => l.slice(3));
    for (const l of status.filter(l => l.startsWith("??") && l.slice(3) !== "audit/harness/node_modules")) problems.push(`${l.slice(3)}: a new file a writer left`);
    const diff = git(dir, "-c", "core.safecrlf=false", "diff", "--stat").trim();
    if (diff) problems.push(`a writer changed content on a CRLF checkout:\n${diff}`);
    for (const f of touched) {
        const p = path.join(dir, f);
        if (!fs.existsSync(p)) { problems.push(`${f}: deleted by a writer`); continue; }
        const now = fs.readFileSync(p, "utf8").split("\n").length;
        const was = git(dir, "show", `HEAD:${f}`).split("\n").length;
        if (now > was) problems.push(`${f}: ${now} lines where the commit has ${was} - written twice?`);
    }
    console.log(`crlf-writers: ${WRITERS.length} writer(s) on a clone with ${crlf} CRLF line(s) in danganronpa.css; `
        + `${touched.length} file(s) touched; ${problems.length} problem(s)`);
} finally {
    if (process.argv.includes("--keep")) console.log(`crlf-writers: the clone is kept at ${dir}`);
    else fs.rmSync(dir, { recursive: true, force: true });
}
for (const p of problems) console.log(`crlf-writers: ${p}`);
process.exit(problems.length ? 1 : 0);
