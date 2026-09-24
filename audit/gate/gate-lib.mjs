/**
 * What the local gate's writer and its verifier share (E30, decision D47, 24.09.2026).
 * ---------------------------------------------------------------------------
 * local-gate.mjs writes audit/gate/local-gate.json on a machine with a Foundry
 * v14 sandbox; verify-gate.mjs reads it in release.yml. Both take the file's
 * shape, its digest, the bound paths, the reasons a part may not have run and
 * the rule for when the gate is required from here, so the two cannot disagree
 * about any of them. Node only, no dependencies, and nothing from tools/: the
 * verifier's self-test copies this folder into a throwaway repository.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

export const SCHEMA = "drpg-local-gate/1";
export const EVIDENCE_SCHEMA = "drpg-evidence/1";
/** Versions no waiver and no record mode lets through: 1.3.0 ships only on a passed gate (D47). */
export const NO_WAIVER = Object.freeze(["1.3.0"]);
export const DEFAULT_URL = "http://localhost:30099";

/**
 * Why a part did not run. Waivable reasons are about this machine (nothing to
 * run on); the others are a fault of the gate or of the sandbox, which a waiver
 * must never paper over.
 */
export const REASONS = Object.freeze({
    "no-server": { waivable: true, means: "nothing answered at the sandbox URL" },
    "no-world": { waivable: true, means: "the server answered but is at setup; the runner never logs into setup" },
    "wrong-foundry": { waivable: true, means: "the server is not Foundry 14.x" },
    "no-fixtures": { waivable: true, means: "DRPG_FIXTURES is unset, or does not hold the named fixture" },
    "not-a-copy": { waivable: false, means: "the world is not an allowed copy (DRPG_SANDBOX_WORLD, /(gate|copy|qa)/i)" },
    "password-required": { waivable: false, means: "an account needs a password; the runner never types one" },
    "stale-module": { waivable: false, means: "the files the sandbox serves differ from this commit" },
    "no-playwright": { waivable: false, means: "Playwright is not installed (npm ci in audit/harness)" },
    "no-browser": { waivable: false, means: "Playwright has no browser to launch" },
    "adapter-missing": { waivable: false, means: "the scenario needs a hook the sandbox adapter lacks" }
});
export const STATUSES = Object.freeze(["passed", "failed", "error", "not-run"]);
export const LIVE_PARTS = Object.freeze([
    { id: "live-stained-glass", layer: "live", theme: "stainedGlass" },
    { id: "live-monokuma-legacy", layer: "live", theme: "monokumaLegacy" },
    { id: "live-world-diff", layer: "live" }
]);
/** runTests()'s summary line (scripts/tests.mjs), which evidence is re-counted from. */
export const SUMMARY_RE = /^(\d+) passed, (\d+) failed, (\d+) skipped(?:, (\d+) red until a later stage)?$/m;
/** What makes a runtime script "touch" a layer the gate exists for (the E30 gate design, 9.11). */
export const DETECTORS = Object.freeze({
    sockets: /game\.socket|"module\.danganronpa/,
    rolls: /new Roll|DualityRoll|\.evaluate\(|Roll\.create|rollMode|dice3d/,
    scenes: /canvas\.scene|game\.scenes|TokenDocument|updateToken|createToken|\.regions|Region/
});
const LAYERS_RE = /export const layers = (\[[^\]]*\])/;
const FIXTURE_RE = /export const fixture = "([^"]+)"/;

export const git = (repo, args, opts = {}) => execFileSync("git", ["-C", repo, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts }).trim();

/**
 * What a failed fetch says, as the operating system said it. Node's fetch throws
 * "fetch failed" and keeps the reason in `cause`; where localhost resolves to both
 * ::1 and 127.0.0.1 the cause is an AggregateError whose own message is empty and
 * whose `errors` hold one refusal per address. Here (24.09.2026) localhost is
 * 127.0.0.1 only and the cause read "connect ECONNREFUSED 127.0.0.1:30099".
 */
export function connectError(err) {
    if (err?.name === "AbortError") return "no answer within the probe's timeout";
    const c = err?.cause;
    const inner = (c?.errors ?? []).map(e => e?.message).filter(Boolean);
    return inner.length ? inner.join("; ") : (c?.message || c?.code || err?.message || String(err));
}

/** Numeric, part by part: 1.2.100 comes after 1.2.99, which a string compare gets wrong. */
export function compareVersions(a, b) {
    const pa = String(a).split(".").map(Number), pb = String(b).split(".").map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const d = (pa[i] ?? 0) - (pb[i] ?? 0);
        if (d) return Math.sign(d);
    }
    return 0;
}

/** Sorted keys, no whitespace: the text the digest and the signature are taken over. */
export function canonical(value) {
    if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
    if (value && typeof value === "object") {
        return `{${Object.keys(value).sort().filter(k => value[k] !== undefined).map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(",")}}`;
    }
    return JSON.stringify(value ?? null);
}
const sha256 = data => crypto.createHash("sha256").update(data).digest("hex");
const withoutSeals = doc => Object.fromEntries(Object.entries(doc).filter(([k]) => k !== "digest" && k !== "hmac"));
export const digestOf = doc => `sha256:${sha256(canonical(withoutSeals(doc)))}`;
export const hmacOf = (doc, key) => `hmac-sha256:${crypto.createHmac("sha256", key).update(canonical(withoutSeals(doc))).digest("hex")}`;
export const fileSha256 = file => sha256(fs.readFileSync(file));

/** Seal a gate file: counts, verdict, digest, and the signature when a key is given. */
export function seal(doc, key = "") {
    const counts = { passed: 0, failed: 0, error: 0, notRun: 0 };
    for (const p of doc.parts) counts[p.status === "not-run" ? "notRun" : p.status]++;
    const sealed = { ...withoutSeals(doc), counts, verdict: verdictOf(doc.parts) };
    sealed.digest = digestOf(sealed);
    sealed.hmac = key ? hmacOf(sealed, key) : null;
    return sealed;
}

/** passed only when every part passed; failed when any failed or errored; incomplete otherwise. */
export function verdictOf(parts) {
    if (!parts.length) return "incomplete";
    if (parts.some(p => p.status === "failed" || p.status === "error")) return "failed";
    return parts.every(p => p.status === "passed") ? "passed" : "incomplete";
}

/** Scenario files and what they declare, read off the source without importing them. */
export function scenarioDecls(repo) {
    const dir = path.join(repo, "audit", "harness", "scenarios");
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter(f => /^\d{2}-.+\.mjs$/.test(f)).sort().map(f => {
        const src = fs.readFileSync(path.join(dir, f), "utf8");
        let layers = [];
        try { layers = JSON.parse(src.match(LAYERS_RE)?.[1] ?? "[]"); } catch { /* the cluster and check registry refuse it */ }
        return { file: `audit/harness/scenarios/${f}`, name: f.replace(/\.mjs$/, ""), layers, fixture: src.match(FIXTURE_RE)?.[1] ?? null };
    });
}

/** The stage a version ships: the ledger row carrying it, else the row planned for it. */
export function stageFor(repo, version) {
    let rows = [];
    try { rows = JSON.parse(fs.readFileSync(path.join(repo, "tools", "stages.json"), "utf8")).stages ?? []; } catch { /* no ledger: no stage */ }
    return rows.find(r => r.version === version) ?? rows.find(r => r.planned === version) ?? null;
}

/** Every part the gate has for this tree and version: the live parts, one per local-gate scenario, the drills. */
export function partsFor(repo, version) {
    const decls = scenarioDecls(repo);
    const stage = stageFor(repo, version);
    const drills = new Set([...(stage?.drills ?? []), ...decls.filter(d => d.fixture && d.layers.includes("local-gate")).map(d => d.fixture)]);
    return [
        ...LIVE_PARTS.map(p => ({ ...p })),
        ...decls.filter(d => d.layers.includes("local-gate") && !d.fixture).map(d => ({ id: `sandbox-${d.name}`, layer: "sandbox", scenario: d.file })),
        ...[...drills].sort().map(name => ({ id: `drill-${name}`, layer: "drill", fixture: name }))
    ];
}

/** The paths a gate run is bound to: what the module is, and what ran it. Release notes and docs are not bound. */
export function boundPaths(repo) {
    return ["scripts", "styles", "lang", "fonts", "icons", "module.json",
        "audit/gate/local-gate.mjs", "audit/gate/gate-lib.mjs", "audit/live", "audit/harness/lib/seed.mjs",
        ...scenarioDecls(repo).filter(d => d.layers.includes("local-gate")).map(d => d.file)];
}

/** `git rev-parse <rev>:<path>` for each bound path; null for a path that is not in that tree. */
export function boundIds(repo, rev = "HEAD") {
    const out = {};
    for (const p of boundPaths(repo)) {
        try { out[p] = git(repo, ["rev-parse", `${rev}:${p}`]); } catch { out[p] = null; }
    }
    return out;
}

/** The newest v* tag below `version` that is an ancestor of `rev`, or null. */
export function previousTag(repo, version, rev = "HEAD") {
    let tags = [];
    try { tags = git(repo, ["tag", "-l", "v*"]).split("\n").filter(t => /^v\d+\.\d+\.\d+$/.test(t)); } catch { return null; }
    const below = tags.filter(t => compareVersions(t.slice(1), version) < 0).sort((a, b) => compareVersions(b.slice(1), a.slice(1)));
    for (const t of below) {
        try { git(repo, ["merge-base", "--is-ancestor", t, rev]); return t; } catch { /* not on this line */ }
    }
    return null;
}

/**
 * Why the local gate is required for this release, one sentence per reason; []
 * when it is not. A stage whose `touches` is null declares nothing, so the
 * detector alone decides and an undeclared stage cannot skip the gate.
 */
export function requiredBecause(repo, version, rev = "HEAD") {
    const why = [];
    if (NO_WAIVER.includes(version)) why.push(`${version} is the last stage: it needs a passed gate`);
    const stage = stageFor(repo, version);
    const touched = (stage?.touches ?? []).filter(t => DETECTORS[t]);
    if (touched.length) why.push(`${stage.id} declares it touches ${touched.join(", ")} (tools/stages.json)`);
    const prev = previousTag(repo, version, rev);
    if (!prev) { why.push(`no earlier v* tag is an ancestor of ${rev}, so what changed cannot be read`); return why; }
    let changed = [];
    try { changed = git(repo, ["diff", "--name-only", prev, rev, "--", "scripts"]).split("\n").filter(Boolean); }
    catch (err) { why.push(`git diff ${prev} ${rev} failed: ${String(err.message).split("\n")[0]}`); return why; }
    for (const f of changed.filter(f => /^scripts\/[^/]+\.mjs$/.test(f) && !/^scripts\/tests/.test(f))) {
        let text = "";
        try { text = git(repo, ["show", `${rev}:${f}`], { maxBuffer: 64 << 20 }); } catch { continue; /* deleted since */ }
        const hits = Object.entries(DETECTORS).filter(([, re]) => re.test(text)).map(([k]) => k);
        if (hits.length) why.push(`${f} changed since ${prev} and reads ${hits.join(", ")}`);
    }
    return why;
}

/** The three header lines of a text evidence file, or null when it has none. */
export function parseEvidenceHeader(text) {
    const [l1, l2, l3, sep] = String(text).split("\n");
    const m1 = l1?.match(/^drpg-evidence\/1 (\S+)$/);
    if (!m1 || sep !== "---") return null;
    const fields = Object.fromEntries((l2 ?? "").split(" | ").map(kv => { const i = kv.indexOf(" "); return [kv.slice(0, i), kv.slice(i + 1)]; }));
    const times = Object.fromEntries((l3 ?? "").split(" | ").map(kv => { const i = kv.indexOf(" "); return [kv.slice(0, i), kv.slice(i + 1)]; }));
    return { part: m1[1], ...fields, started: times.started, finished: times.finished };
}

/** The suite's numbers in a text, as runTests() prints them, or null. */
export function summaryOf(text) {
    const m = String(text).match(SUMMARY_RE);
    return m ? { passed: Number(m[1]), failed: Number(m[2]), skipped: Number(m[3]), red: Number(m[4] ?? 0) } : null;
}
