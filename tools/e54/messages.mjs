/**
 * E54's rebuild (tools/e54/rebuild.sh): every commit message from a base to a head, held to the house rules for this
 * line. Usage: node tools/e54/messages.mjs <base> <head> [--repo <dir>].
 *
 * Each message: `[skip ci]` in its subject; its last two lines the two trailers (TRAILERS), a cherry-pick's
 * "(cherry picked from ...)" line above them, not after; no en dash, em dash or minus sign; and, outside the trailers,
 * none of the words the brief bars from messages - which include a branch's ref when it starts with the session
 * prefix, so a branch is named by its line ("the E54 prep line"). Exit 1 with each commit and what it breaks.
 */
import { execFileSync } from "node:child_process";
import path from "node:path";

const argv = process.argv.slice(2);
const at = argv.indexOf("--repo");
const REPO = path.resolve(at >= 0 ? argv[at + 1] : process.cwd());
const [base, head] = argv.filter((a, i) => !a.startsWith("--") && argv[i - 1] !== "--repo");
const TRAILERS = ["Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>", "Claude-Session: https://claude.ai/code/session_01QsWhUcWE5y53y4rU2XXudy"];
const BARRED = /exploit|attack|malicious|forger|bypass|vulnerab|cheat|claude|opus/gi;
const git = (...a) => execFileSync("git", ["-C", REPO, ...a], { encoding: "utf8" });
const revs = git("rev-list", "--reverse", `${base}..${head}`).split("\n").filter(Boolean);
let bad = 0;
for (const r of revs) {
    const lines = git("log", "-1", "--format=%B", r).replace(/\n+$/, "").split("\n");
    const probs = [];
    if (!lines[0].includes("[skip ci]")) probs.push("no [skip ci] in the subject");
    if (lines.slice(-2).join("\n") !== TRAILERS.join("\n")) probs.push("does not end on the two trailers");
    if (/[–—−]/.test(lines.join("\n"))) probs.push("a dash character");
    const words = [...new Set(lines.filter(l => !TRAILERS.includes(l)).join("\n").match(BARRED) ?? [])];
    if (words.length) probs.push(`barred words: ${words.join(", ")}`);
    if (probs.length) { bad++; console.log(`messages: ${r.slice(0, 8)} ${lines[0].slice(0, 70)}: ${probs.join("; ")}`); }
}
console.log(`messages: ${revs.length} commit(s), ${bad} with a problem`);
process.exit(bad ? 1 : 0);
