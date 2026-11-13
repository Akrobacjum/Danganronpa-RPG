/**
 * E54's rebuild (tools/e54/rebuild.sh): one conflict a cherry-pick of the behaviour commits meets on a new base,
 * resolved without reading - both sides appended tests at the end of a tier file's table, so the hunk keeps both,
 * ours first. Usage: node tools/e54/union-tail.mjs <file>.
 *
 * A hunk is taken only when both of its sides start with a test row (`    ["R`); anything else is refused, exit 1,
 * the file untouched, and the rebuild stops for a reader. When our side ends without its closing `    }],` (git's
 * hunk can cut a row before its close), the close is added once. On a2b233d2 the tier files' tails were the only
 * hunks of this kind (13.11.2026); whether the result parses is the caller's check (`node --check`).
 */
import fs from "node:fs";

const file = process.argv[2];
if (!file) { console.error("union-tail: a file, please"); process.exit(1); }
const text = fs.readFileSync(file, "utf8");
const hunk = /^<<<<<<< [^\n]*\n([\s\S]*?)^=======\n([\s\S]*?)^>>>>>>> [^\n]*\n/gm;
let n = 0, refused = null;
const out = text.replace(hunk, (all, ours, theirs) => {
    const row = s => s.replace(/^\n+/, "").startsWith('    ["R');
    if (!row(ours) || !row(theirs)) { refused ??= `${ours.slice(0, 60)} | ${theirs.slice(0, 60)}`; return all; }
    n++;
    const closed = ours.replace(/\n+$/, "").endsWith("\n    }],");
    return ours + (closed ? "" : "    }],\n") + theirs;
});
if (refused) { console.error(`union-tail: ${file}: a hunk that is not two appended tests: ${refused}`); process.exit(1); }
if (/^(<<<<<<<|>>>>>>>) /m.test(out)) { console.error(`union-tail: ${file}: a marker left`); process.exit(1); }
fs.writeFileSync(file, out);
console.log(`union-tail: ${file}: ${n} hunk(s) kept both sides`);
