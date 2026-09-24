/**
 * The local gate's writer: the 'local-gate' layer of the release gate (E30, decision D47, 24.09.2026).
 * ---------------------------------------------------------------------------
 *     node audit/gate/local-gate.mjs [--parts live,sandbox,drills] [--merge] [--dry-run]
 *     npm run gate:local                (from audit/harness)
 *
 * Runs what the headless harness cannot - the suite's tier 2 in both themes on
 * a real Foundry v14, the whole-world diff around it, the scenarios whose
 * layers include "local-gate" through audit/live's adapter, and the drills on
 * private world copies - and writes audit/gate/local-gate.json, bound to this
 * commit, which release.yml's verify-gate.mjs reads. Written only by this
 * script: an edited file fails the digest.
 *
 * WHERE IT RUNS. On a machine with a v14 sandbox (DRPG_SANDBOX_URL, default
 * http://localhost:30099, loopback only) serving a COPY of a world
 * (DRPG_SANDBOX_WORLD, which must also match /(gate|copy|qa)/i: tier 2
 * writes). Accounts are DRPG_SANDBOX_USERS (JSON, default GM, PlayerOne,
 * PlayerTwo, PlayerThree), and none may need a password: this script never
 * types one. DRPG_FIXTURES is the folder of private world copies for the
 * drills; DRPG_GATE_KEY, when set, signs the file.
 *
 * WHAT IT HAS PROVED. Nothing that needs Foundry: on 24.09.2026 it had never
 * run against a real v14 server, and the code in audit/live that it calls when
 * one answers has never run at all (audit/live/README.md). Where a part cannot
 * run it is written as not-run with the reason and the real error, never as
 * ran; a runner that breaks is `error`, kept apart from the module failing.
 *
 * It refuses to write (exit 2) outside a git checkout, when a bound path has
 * uncommitted changes, or when module.json cannot be read. Otherwise it writes
 * the file whatever the verdict, prints a table, and exits 0.
 */

import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { createRequire } from "node:module";
import * as G from "./gate-lib.mjs";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../..");
const OUT = path.join(HERE, "local-gate.json");
const EVIDENCE = path.join(HERE, "evidence");

const argv = process.argv.slice(2);
const DRY = argv.includes("--dry-run"), MERGE = argv.includes("--merge");
const partsAt = argv.indexOf("--parts");
const LAYERS = partsAt >= 0 ? String(argv[partsAt + 1] ?? "").split(",").map(s => s.trim().replace(/s$/, "")).filter(Boolean) : ["live", "sandbox", "drill"];
for (const l of LAYERS) if (!["live", "sandbox", "drill"].includes(l)) { console.log(`local-gate: --parts takes live, sandbox, drills; got "${l}"`); process.exit(2); }

function refuse(why) { console.log(`local-gate: refused - ${why}; nothing written`); process.exit(2); }

/* ---- what this run is bound to ---- */
let commit, version;
try { commit = G.git(REPO, ["rev-parse", "HEAD"]); } catch { refuse("not a git checkout"); }
try { version = JSON.parse(fs.readFileSync(path.join(REPO, "module.json"), "utf8")).version; } catch (err) { refuse(`module.json cannot be read (${err.message})`); }
const dirty = G.git(REPO, ["status", "--porcelain", "--", ...G.boundPaths(REPO)]);
if (dirty) refuse(`uncommitted changes in bound paths - commit or stash them, the file is bound to a commit:\n${dirty}`);

const URL_ = process.env.DRPG_SANDBOX_URL || G.DEFAULT_URL;
let parsedUrl = null;
try { parsedUrl = new URL(URL_); } catch { refuse(`DRPG_SANDBOX_URL is not a URL: ${URL_}`); }
if (!["localhost", "127.0.0.1", "[::1]"].includes(parsedUrl.hostname)) refuse(`DRPG_SANDBOX_URL must be a loopback host, got ${parsedUrl.hostname}`);
const WORLD = process.env.DRPG_SANDBOX_WORLD || null;
let USERS = { gm: "GM", p1: "PlayerOne", p2: "PlayerTwo", p3: "PlayerThree" };
if (process.env.DRPG_SANDBOX_USERS) {
    try { USERS = { ...USERS, ...JSON.parse(process.env.DRPG_SANDBOX_USERS) }; } catch { refuse("DRPG_SANDBOX_USERS is not JSON"); }
}
const FIXTURES = process.env.DRPG_FIXTURES || null;

const startedAt = new Date().toISOString();
const requireHarness = createRequire(path.join(REPO, "audit", "harness", "package.json"));
let playwrightVersion = null;
try { playwrightVersion = requireHarness("playwright/package.json").version; } catch { /* reported as no-playwright if a part needs it */ }

/* ---- the probe ---- */
async function probe() {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 3000);
    try {
        const res = await fetch(new URL("/api/status", URL_), { signal: ctl.signal });
        const raw = (await res.text()).slice(0, 2048);
        let status = null;
        try { status = JSON.parse(raw); } catch { /* recorded raw */ }
        return { reachable: true, error: null, http: res.status, raw, status };
    } catch (err) {
        return { reachable: false, error: G.connectError(err), http: null, raw: null, status: null };
    } finally { clearTimeout(timer); }
}

const notRun = (part, reason, why) => ({ ...part, status: "not-run", reason, why, evidence: [] });

const sandbox = await probe();
const all = G.partsFor(REPO, version).filter(p => LAYERS.includes(p.layer));
let parts;
const serverWhy = `nothing answered at ${URL_} (${sandbox.error})`;

if (!sandbox.reachable) {
    parts = all.map(p => p.layer === "drill" && !fixtureDir(p.fixture)
        ? notRun(p, "no-fixtures", fixtureWhy(p.fixture))
        : notRun(p, "no-server", serverWhy));
} else {
    /* A server answered. Everything from here is audit/live's, and has never run
       against a real v14 (its README); an exception is the runner breaking - error -
       not the module failing. */
    try {
        const live = await import(url.pathToFileURL(path.join(REPO, "audit", "live", "foundry.mjs")).href);
        parts = await live.runGate({ repo: REPO, url: URL_, world: WORLD, users: USERS, fixtures: FIXTURES, status: sandbox.status,
            parts: all, evidenceDir: EVIDENCE, version, commit, requireHarness, notRun, fixtureDir, fixtureWhy, dry: DRY });
    } catch (err) {
        parts = all.map(p => ({ ...p, status: "error", why: `the runner broke: ${String(err.stack ?? err).split("\n").slice(0, 3).join(" / ")}`, evidence: [] }));
    }
}

function fixtureDir(name) {
    if (!FIXTURES || !name) return null;
    const dir = path.join(FIXTURES, name);
    return fs.existsSync(path.join(dir, "fixture.json")) ? dir : null;
}
function fixtureWhy(name) {
    const scenario = G.scenarioDecls(REPO).find(d => d.fixture === name);
    const tail = scenario ? "" : `; no scenario declares export const fixture = "${name}" yet`;
    return (FIXTURES ? `${FIXTURES} has no ${name}/fixture.json` : "DRPG_FIXTURES is not set") + tail;
}

/* ---- the file ---- */
let doc = {
    schema: G.SCHEMA,
    writtenBy: "audit/gate/local-gate.mjs",
    module: { id: "danganronpa-rpg", version },
    commit,
    bound: G.boundIds(REPO, "HEAD"),
    startedAt, finishedAt: new Date().toISOString(),
    host: { node: process.version, platform: `${process.platform}-${process.arch}`, playwright: playwrightVersion },
    sandbox: { url: URL_, reachable: sandbox.reachable, error: sandbox.error, http: sandbox.http, raw: sandbox.raw,
        foundry: sandbox.status?.version ?? null, world: sandbox.status?.world ?? null, system: sandbox.status?.system ?? null,
        systemVersion: sandbox.status?.systemVersion ?? null },
    fixtures: { dir: FIXTURES, why: FIXTURES ? null : "DRPG_FIXTURES is not set" },
    parts
};

if (MERGE) {
    let old = null;
    try { old = JSON.parse(fs.readFileSync(OUT, "utf8")); } catch { refuse("--merge needs an existing audit/gate/local-gate.json"); }
    if (old.schema !== doc.schema || old.module?.version !== version || old.commit !== commit || G.canonical(old.bound) !== G.canonical(doc.bound)) {
        refuse("--merge needs the same schema, version, commit and bound ids as the existing file; run the whole gate again");
    }
    const mine = new Set(parts.map(p => p.id));
    doc = { ...doc, startedAt: old.startedAt, parts: [...old.parts.filter(p => !mine.has(p.id)), ...parts] };
}

const key = process.env.DRPG_GATE_KEY || "";
doc = G.seal(doc, key);

console.log(`local-gate: ${version} at ${commit.slice(0, 12)}; sandbox ${URL_} ${sandbox.reachable ? `answered (HTTP ${sandbox.http})` : `did not answer: ${sandbox.error}`}`);
for (const p of doc.parts) console.log(`  ${p.status.padEnd(8)} ${p.id.padEnd(30)} ${p.reason ?? ""}${p.why ? ` - ${p.why}` : ""}`);
console.log(`local-gate: verdict ${doc.verdict} (${doc.counts.passed} passed, ${doc.counts.failed} failed, ${doc.counts.error} error, ${doc.counts.notRun} not run); `
    + `${key ? "signed" : "unsigned (DRPG_GATE_KEY is not set)"}`);

if (DRY) { console.log("local-gate: --dry-run, nothing written"); process.exit(0); }
if (!MERGE) {
    /* evidence/ holds only this version's files; git keeps the history. */
    const keep = new Set(doc.parts.flatMap(p => (p.evidence ?? []).map(e => path.resolve(REPO, e.path))));
    if (fs.existsSync(EVIDENCE)) for (const f of fs.readdirSync(EVIDENCE)) if (!keep.has(path.join(EVIDENCE, f))) fs.rmSync(path.join(EVIDENCE, f), { recursive: true, force: true });
}
fs.writeFileSync(OUT, JSON.stringify(doc, null, 2) + "\n");
console.log(`local-gate: written ${path.relative(REPO, OUT)}`);
