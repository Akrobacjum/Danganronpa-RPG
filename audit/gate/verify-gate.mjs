/**
 * The release gate's verifier (E30, decision D47, 24.09.2026).
 * ---------------------------------------------------------------------------
 *     node audit/gate/verify-gate.mjs --tag vX.Y.Z [--waiver vX.Y.Z]    release.yml's local-gate job
 *     node audit/gate/verify-gate.mjs --self-test                       the `gate` part of npm test
 *
 * Reads audit/gate/local-gate.json - written only by local-gate.mjs on a
 * machine with a Foundry v14 sandbox - and refuses a release it does not
 * cover. Every refusal says what to do next. The rules, in order:
 *
 *   1  the tag is "v" + module.json's version;
 *   2  local-gate.json exists and has the schema;          3  its version is this one;
 *   4  its digest matches (an edited file fails here);      5  with DRPG_GATE_KEY set, its signature too;
 *   6  its commit is an ancestor of HEAD;                   7  every bound path is unchanged since that commit;
 *   8  its dates are possible: startedAt <= finishedAt <= now + 5 min, and not before the commit;
 *   9  every part that ran has its evidence, byte for byte, and the numbers re-counted from it; a
 *      live part's header names this version, the Foundry and the Daggerheart module.json is verified on;
 *  10  a failed or errored part refuses, always;
 *  11  the gate is required when the version is 1.3.0, the stage declares it touches sockets, rolls or
 *      scenes, or a runtime script that reads one of them changed since the previous tag;
 *  12  required and a required part not run: the MODE decides (below);
 *  13  not required: parts not run pass, and are listed;
 *  14  a summary: the parts, why the gate was required, and the releases since the last complete gate.
 *
 * THE MODE (rule 12) is the repository variable DRPG_LOCAL_GATE, given to the job as an env:
 *   record  (unset means this) - a required part that did not run for a WAIVABLE reason (no-server,
 *           no-world, wrong-foundry, no-fixtures) passes when the release notes' "## Checked" section
 *           has a line starting "- Not checked in a real Foundry". The summary lists what did not run
 *           and every release since the last complete gate: the debt.
 *   enforce - the E30 design's rule 12 as written: a waiver file under audit/gate/waivers/ whose
 *           "Parts not run:" line names exactly the parts, added by an author in DRPG_WAIVER_AUTHORS
 *           when that is set; the tag typed again as the waiver input; the notes line; and the
 *           protected environment local-gate-waiver with a required reviewer, which the next job waits on.
 * In both modes: a failed or errored part, a reason that is the gate's own fault, a stale, edited,
 * unsigned-when-a-key-is-set or missing file, and 1.3.0 are refused. Record mode is the owner's
 * decision of 24.09.2026, while no v14 sandbox exists; it can be flipped to enforce at any release.
 * An agent never writes a waiver file or fills the waiver input (CLAUDE.md).
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import url from "node:url";
import { execFileSync } from "node:child_process";
import * as G from "./gate-lib.mjs";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const FUTURE_SLACK_MS = 5 * 60_000;
const NOTES_LINE = "- Not checked in a real Foundry";

/** The notes' "## Checked" section has the line that tells players what was not checked. */
function notesSayNotChecked(repo, tag) {
    const file = path.join(repo, ".github", "release-notes", `${tag}.md`);
    if (!fs.existsSync(file)) return false;
    const text = fs.readFileSync(file, "utf8");
    const at = text.search(/^## Checked\s*$/m);
    if (at < 0) return false;
    const rest = text.slice(at).split("\n").slice(1);
    const end = rest.findIndex(l => /^## /.test(l));
    return (end < 0 ? rest : rest.slice(0, end)).some(l => l.startsWith(NOTES_LINE));
}

/** Versions whose gate did not pass, since the last one that did, from the history of local-gate.json. */
function gateDebt(repo) {
    let commits = [];
    try { commits = G.git(repo, ["log", "--format=%H", "--", "audit/gate/local-gate.json"]).split("\n").filter(Boolean); } catch { return []; }
    const owed = [];
    for (const c of commits) {
        let doc = null;
        try { doc = JSON.parse(G.git(repo, ["show", `${c}:audit/gate/local-gate.json`], { maxBuffer: 64 << 20 })); } catch { continue; }
        if (doc.verdict === "passed") break;
        if (!owed.includes(doc.module?.version)) owed.push(doc.module?.version);
    }
    return owed;
}

/** GitHub: the environment exists and has a required reviewer. Unknown is a no. */
async function environmentProtected(name) {
    const { GITHUB_TOKEN: token, GITHUB_REPOSITORY: repo, GITHUB_API_URL: api = "https://api.github.com" } = process.env;
    if (!token || !repo) return { ok: false, why: "GITHUB_TOKEN and GITHUB_REPOSITORY are not both set, so the environment's reviewers cannot be read" };
    try {
        const res = await fetch(`${api}/repos/${repo}/environments/${name}`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" } });
        if (!res.ok) return { ok: false, why: `reading environment ${name} answered HTTP ${res.status}` };
        const env = await res.json();
        const reviewers = (env.protection_rules ?? []).filter(r => r.type === "required_reviewers").flatMap(r => r.reviewers ?? []);
        return reviewers.length ? { ok: true } : { ok: false, why: `environment ${name} has no required reviewer, so nobody would be asked` };
    } catch (err) { return { ok: false, why: `reading environment ${name} failed: ${err.message}` }; }
}

/**
 * The verdict on one release. Pure apart from reading `repo` and, in enforce mode
 * with a waiver, asking `envCheck` about the protected environment.
 * @returns {Promise<{ok: boolean, waived: boolean, recorded: boolean, refusals: string[], lines: string[], summary: string}>}
 */
export async function verify({ repo, tag, waiver = "", mode = "record", key = "", now = Date.now(), envCheck = environmentProtected }) {
    const refusals = [], lines = [];
    const out = extra => ({ ok: !refusals.length, waived: false, recorded: false, refusals, lines, summary: "", ...extra });
    if (!["record", "enforce"].includes(mode)) { refusals.push(`DRPG_LOCAL_GATE is "${mode}": it is record (the default) or enforce`); return out(); }
    /* 1 */
    const manifest = JSON.parse(fs.readFileSync(path.join(repo, "module.json"), "utf8"));
    const version = manifest.version;
    if (tag !== `v${version}`) { refusals.push(`the tag is ${tag} and module.json says ${version}: bump module.json, or dispatch with v${version}`); return out(); }
    /* 2 */
    const file = path.join(repo, "audit", "gate", "local-gate.json");
    let doc;
    try { doc = JSON.parse(fs.readFileSync(file, "utf8")); } catch { doc = null; }
    if (!doc || doc.schema !== G.SCHEMA) {
        refusals.push(`audit/gate/local-gate.json is ${doc ? `not ${G.SCHEMA}` : "missing"}: run node audit/gate/local-gate.mjs on the release commit and commit what it writes`);
        return out();
    }
    /* 3 */
    if (doc.module?.version !== version) refusals.push(`local-gate.json is for ${doc.module?.version}, this is ${version}: run the local gate again on the bumped commit`);
    /* 4 */
    if (doc.digest !== G.digestOf(doc)) refusals.push("local-gate.json was edited after the script wrote it (its digest does not match): run the local gate again");
    if (doc.verdict !== G.verdictOf(doc.parts ?? [])) refusals.push(`local-gate.json says verdict ${doc.verdict}, and its parts make it ${G.verdictOf(doc.parts ?? [])}`);
    /* 5 */
    if (key) {
        if (!doc.hmac) refusals.push("DRPG_GATE_KEY is set and local-gate.json is unsigned: run the local gate with the key in the environment");
        else if (doc.hmac !== G.hmacOf(doc, key)) refusals.push("local-gate.json's signature does not match DRPG_GATE_KEY: it was not written by the local gate with this key");
    } else lines.push("warning: DRPG_GATE_KEY is not set, so the file's signature is not checked (anyone with a checkout can write a matching digest)");
    /* 6 */
    try { G.git(repo, ["merge-base", "--is-ancestor", doc.commit, "HEAD"]); }
    catch { refusals.push(`the gate ran on ${String(doc.commit).slice(0, 12)}, which is not an ancestor of this commit: run it again here`); return out(); }
    /* 7 */
    const now_ = G.boundIds(repo, "HEAD");
    const moved = Object.keys({ ...now_, ...doc.bound }).filter(p => (doc.bound?.[p] ?? null) !== (now_[p] ?? null));
    if (moved.length) {
        let files = "";
        try { files = G.git(repo, ["diff", "--name-only", doc.commit, "HEAD", "--", ...moved]).split("\n").filter(Boolean).slice(0, 20).join(", "); } catch { /* the paths are enough */ }
        refusals.push(`changed since the gate ran: ${moved.join(", ")}${files ? ` (${files})` : ""} - run the local gate again`);
    }
    /* 8 */
    const t0 = Date.parse(doc.startedAt), t1 = Date.parse(doc.finishedAt);
    let committed = NaN;
    try { committed = Number(G.git(repo, ["show", "-s", "--format=%ct", doc.commit])) * 1000; } catch { /* refused below */ }
    if (!(t0 <= t1) || !(t1 <= now + FUTURE_SLACK_MS)) refusals.push(`the dates are impossible: started ${doc.startedAt}, finished ${doc.finishedAt}`);
    if (!(t1 >= committed)) refusals.push(`the gate finished (${doc.finishedAt}) before its commit was made: it did not run on that commit`);
    /* 9 */
    const verified = { foundry: manifest.compatibility?.verified ?? null,
        daggerheart: manifest.relationships?.systems?.find(s => s.id === "daggerheart")?.compatibility?.verified ?? null };
    for (const p of doc.parts ?? []) {
        if (p.status === "not-run") continue;
        const ev = p.evidence ?? [];
        if (!ev.length) { refusals.push(`${p.id} is ${p.status} with no evidence`); continue; }
        for (const e of ev) {
            const abs = path.resolve(repo, e.path);
            if (!abs.startsWith(path.join(repo, "audit", "gate", "evidence") + path.sep) || !fs.existsSync(abs)) { refusals.push(`${p.id}: evidence ${e.path} is missing`); continue; }
            if (G.fileSha256(abs) !== e.sha256) { refusals.push(`${p.id}: evidence ${e.path} is not what the gate wrote (sha256 differs)`); continue; }
            const text = fs.readFileSync(abs, "utf8");
            if (e.path.endsWith(".txt")) {
                const head = G.parseEvidenceHeader(text);
                const sum = G.summaryOf(text.split("\n---\n").slice(1).join("\n---\n"));
                if (!head || head.part !== p.id) { refusals.push(`${p.id}: ${e.path} has no evidence header for this part`); continue; }
                if (p.summary && (!sum || ["passed", "failed", "skipped"].some(k => sum[k] !== p.summary[k]))) {
                    refusals.push(`${p.id}: the numbers in local-gate.json (${JSON.stringify(p.summary)}) are not the evidence's (${JSON.stringify(sum)})`);
                }
                if ((p.status === "passed") !== (sum ? sum.failed === 0 : false)) refusals.push(`${p.id}: status ${p.status} does not follow from the evidence's "${sum ? `${sum.failed} failed` : "no summary"}"`);
                if (p.layer === "live") {
                    if (head.module !== version) refusals.push(`${p.id}: the evidence ran module ${head.module}, not ${version}`);
                    if (head.foundry !== verified.foundry) refusals.push(`${p.id}: ran on Foundry ${head.foundry}, module.json is verified on ${verified.foundry} - update verified, or run on that Foundry`);
                    if (head.daggerheart !== verified.daggerheart) refusals.push(`${p.id}: ran on Daggerheart ${head.daggerheart}, module.json is verified on ${verified.daggerheart} - update verified, or run on that version`);
                }
            } else {
                let body = null;
                try { body = JSON.parse(text); } catch { /* refused below */ }
                if (body?.evidence !== G.EVIDENCE_SCHEMA || body.part !== p.id) { refusals.push(`${p.id}: ${e.path} is not ${G.EVIDENCE_SCHEMA} evidence for this part`); continue; }
                const failed = Number(body.body?.failed ?? body.body?.differs?.length ?? NaN);
                if ((p.status === "passed") !== (failed === 0)) refusals.push(`${p.id}: status ${p.status} does not follow from the evidence (${failed} failed or differing)`);
            }
        }
    }
    /* 10 */
    const broken = (doc.parts ?? []).filter(p => p.status === "failed" || p.status === "error");
    for (const p of broken) refusals.push(`${p.id} ${p.status}${p.why ? `: ${p.why}` : ""} - a failed or errored part is never waived; fix it and run the gate again`);
    /* 11 */
    const because = G.requiredBecause(repo, version, "HEAD");
    const required = because.length > 0;
    const wanted = G.partsFor(repo, version).map(p => p.id);
    const byId = new Map((doc.parts ?? []).map(p => [p.id, p]));
    for (const id of wanted) if (!byId.has(id)) refusals.push(`local-gate.json has no entry for ${id}: run the whole gate (no --parts)`);
    const notRun = (doc.parts ?? []).filter(p => p.status === "not-run");
    const summary = [
        `### Local gate: ${tag} (${mode} mode)`, "",
        `Gate ran on ${String(doc.commit).slice(0, 12)}, verdict **${doc.verdict}**, ${doc.hmac ? "signed" : "unsigned"}`
            + `${key ? "" : " (DRPG_GATE_KEY is not set, so the signature is not checked)"}.`, "",
        "| Part | Status | Reason |", "| --- | --- | --- |",
        ...(doc.parts ?? []).map(p => `| ${p.id} | ${p.status} | ${p.reason ? `${p.reason}: ${String(p.why ?? "").replace(/\|/g, "\\|")}` : ""} |`), "",
        required ? `Required because: ${because.join("; ")}.` : "Not required: no stage declaration and no changed runtime script reads sockets, rolls or scenes."
    ];
    /* 12, 13 */
    let waived = false, recorded = false;
    if (notRun.length && required) {
        const unwaivable = notRun.filter(p => !G.REASONS[p.reason]?.waivable);
        const why = [];
        if (G.NO_WAIVER.includes(version)) why.push(`${version} ships only on a passed gate, in either mode`);
        if (unwaivable.length) why.push(`not run for a reason that is the gate's own fault: ${unwaivable.map(p => `${p.id} (${p.reason})`).join(", ")}`);
        if (!notesSayNotChecked(repo, tag)) why.push(`the notes' "## Checked" section has no line starting "${NOTES_LINE}"`);
        if (mode === "enforce") {
            if (waiver !== tag) why.push(`the waiver input is "${waiver}", not the tag typed again`);
            const wfile = path.join(repo, "audit", "gate", "waivers", `${tag}.md`);
            if (!fs.existsSync(wfile)) why.push(`no waiver file audit/gate/waivers/${tag}.md - only the owner writes one`);
            else {
                const listed = (fs.readFileSync(wfile, "utf8").match(/^Parts not run:(.*)$/m)?.[1] ?? "").split(",").map(s => s.trim()).filter(Boolean).sort();
                const actual = notRun.map(p => p.id).sort();
                if (G.canonical(listed) !== G.canonical(actual)) why.push(`the waiver's "Parts not run:" line lists ${listed.join(", ") || "nothing"}, and the parts not run are ${actual.join(", ")}`);
                const authors = String(process.env.DRPG_WAIVER_AUTHORS ?? "").split(",").map(s => s.trim()).filter(Boolean);
                if (authors.length) {
                    let who = [];
                    try { who = G.git(repo, ["log", "--diff-filter=A", "--format=%ae%x09%an", "--", path.relative(repo, wfile)]).split("\n").filter(Boolean).at(-1)?.split("\t") ?? []; } catch { /* nobody */ }
                    if (!who.some(w => authors.includes(w))) why.push(`the waiver was added by ${who.join(" / ") || "nobody git can name"}, who is not in DRPG_WAIVER_AUTHORS`);
                }
            }
            if (!why.length) {
                const env = await envCheck("local-gate-waiver");
                if (!env.ok) why.push(env.why);
            }
            if (why.length) refusals.push(`required, and ${notRun.length} part(s) did not run; no waiver holds: ${why.join("; ")}`);
            else waived = true;
        } else {
            if (why.length) refusals.push(`required, and ${notRun.length} part(s) did not run; record mode lets that through only with the notes line and waivable reasons: ${why.join("; ")}`);
            else recorded = true;
        }
    } else if (notRun.length) lines.push(`not required; not run, and listed: ${notRun.map(p => p.id).join(", ")}`);
    /* 14 */
    const debt = gateDebt(repo).filter(v => v !== version);
    if (recorded || waived) summary.push("", `Parts not run, let through by ${waived ? "the owner's waiver" : "record mode"}: ${notRun.map(p => `${p.id} (${p.reason})`).join(", ")}.`);
    summary.push("", `Releases since the last complete local gate: ${debt.length ? debt.join(", ") : "none"}${recorded || waived ? `, and now ${version}` : ""}.`);
    if (refusals.length) summary.push("", "Refused:", ...refusals.map(r => `- ${r}`));
    return out({ waived, recorded, summary: summary.join("\n") });
}

/* ------------------------------- self-test --------------------------------- */

/*
 * THE SELF-TEST builds a throwaway repository with `git init`, runs the real
 * writer in it (against a loopback port nothing listens on), then plays the
 * sandbox where a case needs parts that ran: it writes the evidence and seals
 * the file with gate-lib's seal(), the writer's own function. Each case names
 * the words its refusal must contain, so a case refused for the wrong reason
 * fails too - a verifier that refused everything would otherwise pass them all.
 */
function sh(repo, args, env = {}) {
    return execFileSync(args[0], args.slice(1), { cwd: repo, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, GIT_AUTHOR_NAME: "Gate Test", GIT_AUTHOR_EMAIL: "gate@test", GIT_COMMITTER_NAME: "Gate Test",
            GIT_COMMITTER_EMAIL: "gate@test", ...env } });
}
function write(repo, rel, text) { fs.mkdirSync(path.dirname(path.join(repo, rel)), { recursive: true }); fs.writeFileSync(path.join(repo, rel), text); }
function commitAll(repo, msg) { sh(repo, ["git", "add", "-A"]); sh(repo, ["git", "-c", "commit.gpgsign=false", "commit", "-q", "-m", msg]); }

/** A repository at `version` whose previous tag is one patch below, with a socket-reading script changed since. */
function buildRepo(root, name, version, { notesLine = true } = {}) {
    const repo = path.join(root, name);
    fs.mkdirSync(repo, { recursive: true });
    sh(repo, ["git", "init", "-q", "-b", "main"]);
    const manifest = v => JSON.stringify({ id: "danganronpa-rpg", version: v, compatibility: { minimum: "14.364", verified: "14.365" },
        relationships: { systems: [{ id: "daggerheart", compatibility: { minimum: "2.6.5", verified: "2.6.5" } }] } }, null, 2);
    const [maj, min, pat] = version.split(".").map(Number);
    const prev = pat > 0 ? `${maj}.${min}.${pat - 1}` : `${maj}.${min - 1}.99`;
    write(repo, "module.json", manifest(prev));
    write(repo, "scripts/net.mjs", "export const x = 1;\n");
    write(repo, "styles/a.css", "a{}\n"); write(repo, "lang/en.json", "{}\n");
    write(repo, "fonts/.keep", ""); write(repo, "icons/.keep", "");
    write(repo, "tools/stages.json", JSON.stringify({ stages: [{ id: "E98", planned: prev, version: prev, shipped: "2026-09-24", touches: null, drills: [] },
        { id: "E99", planned: version, version: null, shipped: null, touches: null, drills: ["old-world"] }] }));
    for (const f of ["gate-lib.mjs", "local-gate.mjs", "verify-gate.mjs"]) write(repo, `audit/gate/${f}`, fs.readFileSync(path.join(HERE, f), "utf8"));
    write(repo, "audit/live/README.md", "stand-in\n");
    write(repo, "audit/harness/lib/seed.mjs", "export const world = {};\n");
    write(repo, "audit/harness/scenarios/14-quiet.mjs", 'export const layers = ["ci", "local-gate"];\nexport async function run() {}\n');
    commitAll(repo, "base"); sh(repo, ["git", "-c", "tag.gpgsign=false", "tag", `v${prev}`]);
    write(repo, "module.json", manifest(version));
    write(repo, "scripts/net.mjs", 'export const send = () => game.socket.emit("module.danganronpa-rpg", {});\n');
    write(repo, `.github/release-notes/v${version}.md`, `# ${version}\n\n## Checked\n\n${notesLine ? `${NOTES_LINE}: the live suite, the sandbox scenarios, the drill.\n` : "- the suite\n"}`);
    commitAll(repo, "release");
    return repo;
}

/** The real writer, pointed at a loopback port where nothing listens. */
function runWriter(repo) {
    sh(repo, ["node", "audit/gate/local-gate.mjs"], { DRPG_SANDBOX_URL: "http://127.0.0.1:9", DRPG_FIXTURES: "", DRPG_GATE_KEY: "" });
    return JSON.parse(fs.readFileSync(path.join(repo, "audit/gate/local-gate.json"), "utf8"));
}

/** Play the sandbox: every part passed (or as `status` says), with evidence written the way the runner writes it. */
function playSandbox(repo, doc, { key = "", failOne = false } = {}) {
    const dir = path.join(repo, "audit/gate/evidence");
    fs.mkdirSync(dir, { recursive: true });
    const env = { foundry: "14.365", systemVersion: "2.6.5", module: doc.module.version, world: "drpg-qa-gate", renderer: "test" };
    const parts = doc.parts.map((p, i) => {
        const failed = failOne && i === 0 ? 1 : 0;
        let rel, text, extra = {};
        if (p.layer === "live" && p.theme) {
            rel = `audit/gate/evidence/${p.id}.txt`;
            text = [`drpg-evidence/1 ${p.id}`, `module ${env.module} | commit ${doc.commit} | foundry 14.365 | daggerheart 2.6.5 | world ${env.world} | theme ${p.theme} | renderer test`,
                `started ${doc.startedAt} | finished ${doc.finishedAt}`, "---", "Danganronpa RPG - regression suite", `305 passed, ${failed} failed, 3 skipped`, ""].join("\n");
            extra = { summary: { passed: 305, failed, skipped: 3 } };
        } else {
            rel = `audit/gate/evidence/${p.id}.json`;
            text = JSON.stringify({ evidence: G.EVIDENCE_SCHEMA, part: p.id, env, body: p.id === "live-world-diff" ? { differs: [] } : { passed: 7, failed, total: 7 } });
        }
        fs.writeFileSync(path.join(repo, rel), text);
        const { reason: _r, why: _w, ...rest } = p;
        return { ...rest, status: failed ? "failed" : "passed", ranAt: doc.startedAt, env, ...extra,
            evidence: [{ path: rel, sha256: G.fileSha256(path.join(repo, rel)), bytes: Buffer.byteLength(text) }] };
    });
    return G.seal({ ...doc, parts }, key);
}
const save = (repo, doc) => fs.writeFileSync(path.join(repo, "audit/gate/local-gate.json"), JSON.stringify(doc, null, 2) + "\n");
const ENV_OK = async () => ({ ok: true });

async function selfTest() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "drpg-gate-"));
    const cases = [];
    /** @param {string} name  @param {() => Promise<object>} run  @param {{ok: boolean, waived?: boolean, recorded?: boolean, says?: string}} want */
    const expect = async (name, run, want) => {
        let got;
        try { got = await run(); } catch (err) { got = { ok: false, threw: String(err.stack ?? err).split("\n").slice(0, 2).join(" / "), refusals: [] }; }
        const text = (got.refusals ?? []).join(" | ");
        const good = !got.threw && got.ok === want.ok && (want.waived === undefined || got.waived === want.waived)
            && (want.recorded === undefined || got.recorded === want.recorded) && (!want.says || text.includes(want.says));
        cases.push({ name, good });
        console.log(`  ${good ? "ok  " : "FAIL"} ${name}${good ? "" : ` - got ok=${got.ok} waived=${got.waived} recorded=${got.recorded}${got.threw ? ` threw ${got.threw}` : ""}; refusals: ${text || "none"}`}`);
    };
    try {
        const tag = "v1.2.61";
        /* The writer on a machine with no sandbox, as it runs here. */
        const base = buildRepo(root, "base", "1.2.61");
        const written = runWriter(base);
        await expect("the writer records every part not-run, no-server and no-fixtures, verdict incomplete", async () => ({
            ok: written.verdict === "incomplete" && written.parts.length === 5
                && written.parts.every(p => p.status === "not-run" && (p.layer === "drill" ? p.reason === "no-fixtures" : p.reason === "no-server" && /127\.0\.0\.1:9/.test(p.why)))
                && written.hmac === null && written.digest === G.digestOf(written) }), { ok: true });
        const good = playSandbox(base, written);
        const fresh = () => JSON.parse(JSON.stringify(good));
        const v = (doc, opts = {}) => async () => { save(base, doc); return verify({ repo: base, tag, envCheck: ENV_OK, ...opts }); };

        await expect("good file: pass", v(fresh()), { ok: true, waived: false, recorded: false });
        await expect("status flipped: refused by the digest", v({ ...fresh(), parts: fresh().parts.map((p, i) => i ? p : { ...p, status: "failed" }) }), { ok: false, says: "digest" });
        {
            const doc = fresh();
            await expect("digest recomputed but no evidence: refused", async () => {
                save(base, doc); fs.renameSync(path.join(base, doc.parts[0].evidence[0].path), path.join(root, "moved"));
                try { return await verify({ repo: base, tag, envCheck: ENV_OK }); }
                finally { fs.renameSync(path.join(root, "moved"), path.join(base, doc.parts[0].evidence[0].path)); }
            }, { ok: false, says: "is missing" });
            await expect("evidence edited: refused", async () => {
                const f = path.join(base, doc.parts[0].evidence[0].path), was = fs.readFileSync(f);
                fs.writeFileSync(f, String(was).replace("305 passed", "306 passed")); save(base, doc);
                try { return await verify({ repo: base, tag, envCheck: ENV_OK }); } finally { fs.writeFileSync(f, was); }
            }, { ok: false, says: "sha256 differs" });
        }
        await expect("numbers in the file not the evidence's: refused", v(G.seal({ ...fresh(), parts: fresh().parts.map((p, i) => i ? p : { ...p, summary: { ...p.summary, passed: 999 } }) })), { ok: false, says: "are not the evidence's" });
        await expect("a required part missing from the file: refused", v(G.seal({ ...fresh(), parts: fresh().parts.slice(1) })), { ok: false, says: "no entry for" });
        await expect("finishedAt in the future: refused", v(G.seal({ ...fresh(), finishedAt: new Date(Date.now() + 3600e3).toISOString() })), { ok: false, says: "impossible" });
        await expect("finishedAt before the commit: refused", v(G.seal({ ...fresh(), startedAt: "2001-01-01T00:00:00.000Z", finishedAt: "2001-01-01T00:01:00.000Z" })), { ok: false, says: "before its commit" });
        await expect("key set but file unsigned: refused", v(fresh(), { key: "k1" }), { ok: false, says: "unsigned" });
        await expect("key set and the wrong key signed it: refused", v(G.seal(fresh(), "k2"), { key: "k1" }), { ok: false, says: "signature" });
        await expect("key set and the right key signed it: pass", v(G.seal(fresh(), "k1"), { key: "k1" }), { ok: true });

        /* Not-run parts, in each mode. */
        const notRunDoc = runWriter(base);
        const wv = (doc, opts) => async () => { save(base, doc); return verify({ repo: base, tag, envCheck: ENV_OK, ...opts }); };
        await expect("record: required, parts not run (waivable), notes line: pass, recorded", wv(notRunDoc, { mode: "record" }), { ok: true, recorded: true });
        await expect("enforce: required with a part not-run and no waiver: refused", wv(notRunDoc, { mode: "enforce" }), { ok: false, says: "no waiver file" });
        write(base, `audit/gate/waivers/${tag}.md`, `# Local gate waiver - ${tag}\nDecided by: the owner, 24.09.2026\nParts not run: ${notRunDoc.parts.map(p => p.id).join(", ")}\nWhy: self-test\n`);
        await expect("enforce: the same with a complete waiver: waived", wv(notRunDoc, { mode: "enforce", waiver: tag }), { ok: true, waived: true });
        await expect("enforce: a waiver typed for another tag: refused", wv(notRunDoc, { mode: "enforce", waiver: "v1.2.60" }), { ok: false, says: "not the tag typed again" });
        await expect("enforce: the environment has no reviewer: refused", wv(notRunDoc, { mode: "enforce", waiver: tag, envCheck: async () => ({ ok: false, why: "environment local-gate-waiver has no required reviewer" }) }), { ok: false, says: "no required reviewer" });
        await expect("enforce: the waiver lists other parts: refused", async () => {
            write(base, `audit/gate/waivers/${tag}.md`, "Parts not run: live-stained-glass\n"); save(base, notRunDoc);
            return verify({ repo: base, tag, mode: "enforce", waiver: tag, envCheck: ENV_OK });
        }, { ok: false, says: "Parts not run:" });
        fs.rmSync(path.join(base, "audit/gate/waivers"), { recursive: true, force: true });
        const failed = playSandbox(base, notRunDoc, { failOne: true });
        await expect("a failed part with a waiver: refused (enforce)", async () => {
            write(base, `audit/gate/waivers/${tag}.md`, `Parts not run: \n`); save(base, failed);
            try { return await verify({ repo: base, tag, mode: "enforce", waiver: tag, envCheck: ENV_OK }); }
            finally { fs.rmSync(path.join(base, "audit/gate/waivers"), { recursive: true, force: true }); }
        }, { ok: false, says: "never waived" });
        await expect("a failed part in record mode: refused", wv(failed, { mode: "record" }), { ok: false, says: "never waived" });
        const unwaivable = G.seal({ ...notRunDoc, parts: notRunDoc.parts.map((p, i) => i ? p : { ...p, reason: "password-required", why: "self-test" }) });
        await expect("a non-waivable reason: refused (record)", wv(unwaivable, { mode: "record" }), { ok: false, says: "the gate's own fault" });
        await expect("a non-waivable reason: refused (enforce)", wv(unwaivable, { mode: "enforce", waiver: tag }), { ok: false, says: "the gate's own fault" });
        await expect("an unknown mode: refused", wv(notRunDoc, { mode: "lenient" }), { ok: false, says: "record (the default) or enforce" });

        /* Later commits. */
        save(base, fresh());
        write(base, "scripts/net.mjs", 'export const send = () => game.socket.emit("module.danganronpa-rpg", { later: true });\n');
        commitAll(base, "a runtime change after the gate");
        await expect("runtime file changed afterwards: refused", async () => verify({ repo: base, tag, envCheck: ENV_OK }), { ok: false, says: "changed since the gate ran: scripts" });
        const bumped = JSON.parse(fs.readFileSync(path.join(base, "module.json"), "utf8"));
        write(base, "module.json", JSON.stringify({ ...bumped, version: "1.2.62" }, null, 2));
        commitAll(base, "bump");
        await expect("version bumped afterwards: refused", async () => verify({ repo: base, tag: "v1.2.62", envCheck: ENV_OK }), { ok: false, says: "is for 1.2.61" });
        await expect("the tag not module.json's version: refused", async () => verify({ repo: base, tag, envCheck: ENV_OK }), { ok: false, says: "module.json says 1.2.62" });

        /* Notes without the line, and 1.3.0. */
        const quiet = buildRepo(root, "quiet", "1.2.61", { notesLine: false });
        const quietDoc = runWriter(quiet);
        await expect("record: required, parts not run, no notes line: refused", async () => verify({ repo: quiet, tag, mode: "record", envCheck: ENV_OK }), { ok: false, says: "## Checked" });
        const last = buildRepo(root, "last", "1.3.0");
        const lastDoc = runWriter(last);
        await expect("record: 1.3.0 with parts not run: refused", async () => verify({ repo: last, tag: "v1.3.0", mode: "record", envCheck: ENV_OK }), { ok: false, says: "only on a passed gate" });
        await expect("enforce: a waiver at 1.3.0: refused", async () => {
            write(last, "audit/gate/waivers/v1.3.0.md", `Parts not run: ${lastDoc.parts.map(p => p.id).join(", ")}\n`);
            return verify({ repo: last, tag: "v1.3.0", mode: "enforce", waiver: "v1.3.0", envCheck: ENV_OK });
        }, { ok: false, says: "only on a passed gate" });
        void quietDoc;

        /* Not required: nothing that reads sockets, rolls or scenes changed, and the stage declares nothing. */
        const calm = buildRepo(root, "calm", "1.2.61");
        write(calm, "scripts/net.mjs", "export const x = 2;\n"); commitAll(calm, "a quiet change");
        const calmDoc = runWriter(calm);
        await expect("not required: parts not run pass, and are listed", async () => {
            const r = await verify({ repo: calm, tag, mode: "enforce", envCheck: ENV_OK });
            return { ...r, ok: r.ok && r.lines.some(l => l.startsWith("not required")) };
        }, { ok: true, waived: false });
        void calmDoc;

        await expect("1.2.100 is compared with 1.2.99 as numbers", async () => ({ ok: G.compareVersions("1.2.100", "1.2.99") > 0 && G.compareVersions("1.3.0", "1.2.100") > 0 && G.compareVersions("1.2.61", "1.2.61") === 0 }), { ok: true });
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
    const bad = cases.filter(c => !c.good);
    console.log(`verify-gate self-test: ${cases.length - bad.length}/${cases.length} cases hold`);
    return bad.length ? 1 : 0;
}

/* ---------------------------------- CLI ------------------------------------ */

async function main(argv) {
    if (argv.includes("--self-test")) return selfTest();
    const arg = name => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] ?? "" : null; };
    const tag = arg("--tag");
    if (!tag) { console.log("usage: node audit/gate/verify-gate.mjs --tag vX.Y.Z [--waiver vX.Y.Z] | --self-test"); return 2; }
    const repo = path.resolve(HERE, "../..");
    const r = await verify({ repo, tag, waiver: arg("--waiver") ?? "", mode: process.env.DRPG_LOCAL_GATE || "record", key: process.env.DRPG_GATE_KEY || "" });
    for (const l of r.lines) console.log(`verify-gate: ${l}`);
    for (const l of r.refusals) console.log(`verify-gate: refused - ${l}`);
    console.log(r.summary);
    console.log(`verify-gate: ${r.ok ? (r.waived ? "waived - the next job waits for the owner's approval" : r.recorded ? "passed, with parts not run recorded as debt" : "passed") : "REFUSED"}`);
    if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `waived=${r.waived}\n`);
    if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, r.summary + "\n");
    return r.ok ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === url.fileURLToPath(import.meta.url)) {
    process.exitCode = await main(process.argv.slice(2));
}
