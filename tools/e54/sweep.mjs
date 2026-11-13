/**
 * The E54 cut's third pass: the comment sweep (13.11.2026; docs/dev/E54/COMMENT-SWEEP.md).
 * ---------------------------------------------------------------------------
 *     node tools/e54/sweep.mjs [--manifest tools/e54/sheet.json] [--repo <dir>] [--dry] [--no-registry]
 *
 * Run after split.mjs and repoint.mjs, on the tree they wrote, as a commit of its own. Applies the rows of the cut's
 * table (tools/e54/sweep-<manifest's name>.json): each a line that names where its code stood - a comment that says
 * "this file", "sheet.mjs `foo`", a test's name that does - with the text it reads after the cut (`old`) and the text
 * that says where the code stands now (`new`). The table is the inventory's, written once from it; nothing here
 * decides a wording.
 *
 * A row's `old` must stand exactly once: in the file the row names, or, where that file holds it no more (a line moved
 * by another cut applied first), exactly once in all of scripts/, styles/, tools/ and audit/. Otherwise the row is
 * refused, and so is the run - exit 1, nothing written - so a branch that changed a line the table knows is told which
 * row and why, rather than swept around it. `--dry` lists every refusal and writes nothing.
 *
 * A row marked `test` changes a test's name, which is the key of its row in docs/dev/R-REGISTRY.md: after writing, the
 * run calls `node tools/registry.mjs --write` in the tree (not with `--no-registry`), and says how many of the
 * registry's lines changed.
 */

import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { execFileSync } from "node:child_process";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = (name, fallback) => { const at = argv.indexOf(name); return at >= 0 ? argv[at + 1] : fallback; };
const REPO = path.resolve(opt("--repo", path.resolve(HERE, "..", "..")));
const MANIFEST = path.resolve(opt("--manifest", path.join(HERE, "sheet.json")));
const DRY = argv.includes("--dry");
const REGISTRY = !argv.includes("--no-registry");
const say = message => console.log(`e54-sweep: ${message}`);

const TABLE = path.join(path.dirname(MANIFEST), `sweep-${path.basename(MANIFEST, ".json")}.json`);
if (!fs.existsSync(TABLE)) { say(`REFUSED: no table ${path.relative(process.cwd(), TABLE)}`); process.exit(1); }
const { rows } = JSON.parse(fs.readFileSync(TABLE, "utf8"));

/** Every file the search may fall back to: the module's code, its styles, the tools and the audit, not installed code. */
const everyFile = (() => {
    let list = null;
    return () => {
        if (list) return list;
        list = [];
        const walk = dir => {
            for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
                const p = path.join(dir, f.name);
                if (f.isDirectory()) { if (!/node_modules|\.git$|dh-dice/.test(p)) walk(p); }
                else if (/\.(mjs|js|css)$/.test(f.name)) list.push(path.relative(REPO, p));
            }
        };
        for (const d of ["scripts", "styles", "tools", "audit"]) if (fs.existsSync(path.join(REPO, d))) walk(path.join(REPO, d));
        return list.filter(f => !f.startsWith("tools/e54/"));
    };
})();

const texts = new Map();
const textOf = rel => {
    if (!texts.has(rel)) texts.set(rel, fs.existsSync(path.join(REPO, rel)) ? fs.readFileSync(path.join(REPO, rel), "utf8") : null);
    return texts.get(rel);
};
const times = (text, needle) => (text ? text.split(needle).length - 1 : 0);

const refused = [], applied = [];
for (const row of rows) {
    let where = row.file;
    let n = times(textOf(where), row.old);
    if (n === 0) {
        const found = everyFile().map(f => [f, times(textOf(f), row.old)]).filter(([, k]) => k);
        const total = found.reduce((s, [, k]) => s + k, 0);
        if (total === 1) { where = found[0][0]; n = 1; }
        else { refused.push(`${row.base} (${row.file}): its text is found ${total} time(s)${total ? ` (${found.map(([f, k]) => `${f} ${k}`).join(", ")})` : ""}, not once - the line changed; read it and write its row again`); continue; }
    }
    if (n !== 1) { refused.push(`${row.base} (${row.file}): its text is found ${n} times in ${where}, not once`); continue; }
    texts.set(where, textOf(where).replace(row.old, row.new));
    applied.push({ row, where });
}

if (refused.length) {
    for (const r of refused) say(`REFUSED ${r}`);
    say(`${refused.length} of ${rows.length} row(s) refused${DRY ? "" : " - nothing written"}`);
    process.exit(1);
}
const moved = applied.filter(a => a.where !== a.row.file);
say(`${applied.length} row(s) apply (${applied.filter(a => a.row.test).length} of them test names)${moved.length ? `; ${moved.length} found outside the file the row names: ${moved.map(a => `${a.row.base} in ${a.where}`).join(", ")}` : ""}`);
if (DRY) { say("dry run: nothing written"); process.exit(0); }
const touched = new Set(applied.map(a => a.where));
for (const rel of touched) fs.writeFileSync(path.join(REPO, rel), texts.get(rel));
say(`wrote ${touched.size} file(s)`);
if (REGISTRY && applied.some(a => a.row.test)) {
    const before = fs.readFileSync(path.join(REPO, "docs/dev/R-REGISTRY.md"), "utf8").split("\n");
    execFileSync("node", ["tools/registry.mjs", "--write"], { cwd: REPO, stdio: "inherit" });
    const after = fs.readFileSync(path.join(REPO, "docs/dev/R-REGISTRY.md"), "utf8").split("\n");
    const changed = after.filter((l, i) => l !== before[i]).length;
    say(`docs/dev/R-REGISTRY.md written again: ${changed} line(s) differ, ${before.length} -> ${after.length} lines`);
}
say("done");
