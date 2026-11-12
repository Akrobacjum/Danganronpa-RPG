#!/usr/bin/env node
/* docs/live/check-coverage.mjs - holds docs/live/coverage.json to the audit and to the pack.

   node docs/live/check-coverage.mjs        (from the repository root; plain Node, no dependencies)

   What it reads:
   - audit/AUDIT-1.2.42.md, section 9.2 ("### 9.2 Live checks nadal otwarte" to the end of the file): every numbered
     item whose bold title starts with a LIVE id ("N. **LIVE-Exx-nn ..." or "B-Exx-n. **LIVE-..."), and every numbered
     item there without one (AUDIT92-N); section 7 ("## 7. Live checks" to "## 8."), whose items 9.2 keeps in force
     (AUDIT7-NN). An id named only inside another item's text (LIVE-E42-01, never written; LIVE-E81-DZ6-1..7, renamed)
     is not an item and is not counted.
   - docs/live/coverage.json: "ids" (the audit's LIVE ids), "unnumbered" (the items without one), "branches" (LIVE
     ids that exist only on open branches) and "checks" (the pack's checks).
   - docs/live/SESJA-0.pl.md: its "### <code> <name> [weight]" headings and the text under each.

   It fails (exit 1) when an audit id is missing from coverage.json, written twice (the raw text is scanned, since
   JSON.parse keeps the last of two equal keys without a word), or listed but not in the audit; when a branch id has
   reached the audit on this tree (it then belongs in "ids"); when a status is not one of the four, a partial row has
   no "stays", a not-coverable row no "reason", or a covered or partial row no check; when a check a row names is not
   a heading of the pack, or the pack's section for that check does not name the id. It reads text, not what a table
   finds. */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const audit = readFileSync(join(root, "audit", "AUDIT-1.2.42.md"), "utf8");
const raw = readFileSync(join(here, "coverage.json"), "utf8");
const pack = readFileSync(join(here, "SESJA-0.pl.md"), "utf8");
const cov = JSON.parse(raw);

const fails = [];
const fail = text => fails.push(text);

/* The audit's items. */
const at92 = audit.indexOf("### 9.2 Live checks nadal otwarte");
if (at92 < 0) throw new Error("audit/AUDIT-1.2.42.md has no heading \"### 9.2 Live checks nadal otwarte\"");
const s92 = audit.slice(at92);
const at7 = audit.indexOf("## 7. Live checks");
const at8 = audit.indexOf("## 8.", at7);
if (at7 < 0 || at8 < 0) throw new Error("audit/AUDIT-1.2.42.md has no section 7 bounded by section 8");
const s7 = audit.slice(at7, at8);

const auditIds = [];
const unnumbered = [];
for (const m of s92.matchAll(/^(\d+|B-E\d+-\d+)\. \*\*(.*?)\*\*/gm)) {
    const id = /^(LIVE-[A-Z0-9]+-\d+)\b/.exec(m[2]);
    if (id) auditIds.push(id[1]);
    else if (/^\d+$/.test(m[1])) unnumbered.push(`AUDIT92-${m[1]}`);
}
for (const m of s7.matchAll(/^(\d+)\. \*\*/gm)) unnumbered.push(`AUDIT7-${m[1].padStart(2, "0")}`);

const twiceIn = list => [...new Set(list.filter((x, i) => list.indexOf(x) !== i))];
for (const id of twiceIn(auditIds)) fail(`the audit heads two items with ${id}`);

/* Every key of the three maps, as written, so a doubled key is seen. */
const keysWritten = [...raw.matchAll(/^\s*"((?:LIVE|AUDIT)[A-Z0-9-]+)"\s*:\s*\{/gm)].map(m => m[1]);
for (const id of twiceIn(keysWritten)) fail(`${id} is written more than once in coverage.json`);

const ids = cov.ids ?? {};
const extra = cov.unnumbered ?? {};
const branches = cov.branches ?? {};
const checks = cov.checks ?? {};

for (const id of auditIds) if (!(id in ids)) fail(`${id} (audit 9.2) is missing from coverage.json "ids"`);
for (const id of Object.keys(ids)) if (!auditIds.includes(id)) fail(`${id} is in coverage.json "ids" but heads no item of audit 9.2`);
for (const id of unnumbered) if (!(id in extra)) fail(`${id} is missing from coverage.json "unnumbered"`);
for (const id of Object.keys(extra)) if (!unnumbered.includes(id)) fail(`${id} is in "unnumbered" but is no such item of the audit`);
for (const id of Object.keys(branches)) {
    if (auditIds.includes(id)) fail(`${id} is in "branches" but audit 9.2 on this tree has it: move it to "ids"`);
    if (id in ids || id in extra) fail(`${id} is in "branches" and in another map`);
}

/* The pack's checks and the text under each heading. */
const headings = [...pack.matchAll(/^### ([A-Z]\d+) .*\[(krytyczne|ważne|miłe)\]/gm)];
const section = {};
headings.forEach((h, i) => {
    const end = i + 1 < headings.length ? headings[i + 1].index : pack.length;
    section[h[1]] = pack.slice(h.index, end);
});
for (const code of Object.keys(checks)) if (!(code in section)) fail(`check ${code} of coverage.json is not a heading of SESJA-0.pl.md`);
for (const code of Object.keys(section)) if (!(code in checks)) fail(`heading ${code} of SESJA-0.pl.md is not in coverage.json "checks"`);

const STATUSES = ["covered", "partial", "not-coverable", "after-release"];
const label = id => id.startsWith("AUDIT7-") ? `AUDIT 7, punkt ${Number(id.slice(7))}`
    : id.startsWith("AUDIT92-") ? `AUDIT 9.2 poz. ${id.slice(8)}` : id;
const counts = {};
const used = new Set();
for (const [map, rows] of [["ids", ids], ["unnumbered", extra], ["branches", branches]]) {
    for (const [id, row] of Object.entries(rows)) {
        const st = row.status;
        counts[`${map}.${st}`] = (counts[`${map}.${st}`] ?? 0) + 1;
        if (!STATUSES.includes(st)) { fail(`${id}: status "${st}" is not one of ${STATUSES.join(", ")}`); continue; }
        if ((map === "branches") !== (st === "after-release")) fail(`${id}: "after-release" belongs to "branches" and only there`);
        if (st === "partial" && !row.stays) fail(`${id}: partial with no "stays"`);
        if (st === "not-coverable" && !row.reason) fail(`${id}: not-coverable with no "reason"`);
        const named = row.checks ?? [];
        if (st !== "not-coverable" && named.length === 0) fail(`${id}: ${st} names no check`);
        for (const code of named) {
            used.add(code);
            if (!(code in section)) { fail(`${id}: check ${code} is not a heading of SESJA-0.pl.md`); continue; }
            if (!section[code].includes(label(id))) fail(`${id}: the pack's section ${code} does not name it`);
        }
        if (st === "not-coverable" && !pack.includes(label(id))) fail(`${id}: not-coverable but the pack never names it`);
    }
}
for (const code of Object.keys(section)) if (!used.has(code)) fail(`check ${code} settles no id`);

const n = (k) => counts[k] ?? 0;
console.log(`audit 9.2: ${auditIds.length} LIVE ids; unnumbered items (9.2 and section 7): ${unnumbered.length}; open branches: ${Object.keys(branches).length} LIVE ids`);
console.log(`ids: covered ${n("ids.covered")}, partial ${n("ids.partial")}, not-coverable ${n("ids.not-coverable")}`);
console.log(`unnumbered: covered ${n("unnumbered.covered")}, partial ${n("unnumbered.partial")}, not-coverable ${n("unnumbered.not-coverable")}`);
console.log(`branches: after-release ${n("branches.after-release")}`);
console.log(`pack: ${Object.keys(section).length} checks`);
if (fails.length) {
    for (const f of fails) console.log(`FAIL ${f}`);
    console.log(`check-coverage: ${fails.length} failure(s)`);
    process.exit(1);
}
console.log("check-coverage: every id exactly once, every check in the pack, every id named in its check's section");
