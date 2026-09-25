/**
 * A harness scenario on a real Foundry: the sandbox adapter (E30, 24.09.2026).
 * ---------------------------------------------------------------------------
 * NEVER RUN against a real Foundry (audit/live/README.md). Called by foundry.mjs
 * for each scenario whose layers include "local-gate".
 *
 * It hands the scenario's run() what cluster.mjs hands it - gm, p1, p2, p3 with
 * `eval(code, { timeout })`, check, note, phase, settle, repoUrl - with each
 * client a logged-in browser page and repoUrl the path the server serves the
 * module from. It has none of the harness's own instruments: no world object,
 * no socket or permission logs, no canary, no verdict options. A scenario that
 * asks for one of those, or for a page hook page-hooks.js does not provide, is
 * not run: `adapter-missing`, which no waiver covers.
 */

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const PROVIDED = ["gm", "p1", "p2", "p3", "check", "note", "phase", "settle", "repoUrl"];
/** The page hooks page-hooks.js installs; the harness's __forceRoll is not among them. */
const HOOKS = ["__notifications", "__errors", "__missingI18n", "__dialogAuto", "__dialogLog"];

/** What the scenario needs that this adapter does not have, read off its source. */
export function missingFrom(source) {
    const params = source.match(/export async function run\(\{([^}]*)\}/)?.[1] ?? "";
    const asked = params.split(",").map(s => s.trim().split(/[:=\s]/)[0]).filter(Boolean);
    const missing = asked.filter(a => !PROVIDED.includes(a));
    for (const h of new Set(source.match(/\b__[A-Za-z]\w*/g) ?? [])) if (!HOOKS.includes(h)) missing.push(h);
    if (/\b(knownLeak|expectedRed)\s*:/.test(source)) missing.push("verdict options (knownLeak, expectedRed)");
    return missing;
}

function client(page) {
    return {
        eval: (code, { timeout = 60_000 } = {}) => Promise.race([
            page.evaluate(async body => {
                const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
                return await new AsyncFunction(body)();
            }, code),
            new Promise((_, reject) => setTimeout(() => reject(new Error(`eval timed out after ${timeout} ms`)), timeout))
        ])
    };
}

export async function runPart({ repo, url: base, users, browser, part, login, pageEnv, evidence, evidenceDir, notRun }) {
    const file = path.join(repo, part.scenario);
    const source = fs.readFileSync(file, "utf8");
    const missing = missingFrom(source);
    if (missing.length) return notRun(part, "adapter-missing", `${part.scenario} needs ${missing.join(", ")}, which the sandbox adapter does not provide`);
    const scenario = await import(url.pathToFileURL(file).href);
    const pages = {};
    const results = [], notes = [];
    const startedAt = new Date().toISOString();
    try {
        for (const who of ["gm", "p1", "p2", "p3"]) pages[who] = await login(browser, base, users[who]);
        let phaseName = "start";
        await scenario.run({
            gm: client(pages.gm), p1: client(pages.p1), p2: client(pages.p2), p3: client(pages.p3),
            check: (name, ok, details = "") => results.push({ name, ok: Boolean(ok), status: ok ? "pass" : "fail", details: String(details).slice(0, 2000), phase: phaseName }),
            note: (name, details = "") => notes.push({ name, details: String(details).slice(0, 2000) }),
            phase: name => { phaseName = name; },
            settle: (ms = 200) => new Promise(r => setTimeout(r, ms)),
            repoUrl: "/modules/danganronpa-rpg"
        });
        const env = await pageEnv(pages.gm);
        const failed = results.filter(r => !r.ok).length;
        const body = { passed: results.length - failed, failed, total: results.length, results, notes };
        const text = JSON.stringify({ evidence: "drpg-evidence/1", part: part.id, env, body }, null, 2);
        const ok = results.length > 0 && failed === 0;
        return { ...part, status: ok ? "passed" : "failed", ranAt: startedAt, env, summary: { passed: body.passed, failed, total: body.total },
            ...(results.length ? {} : { why: "the scenario ran no check" }), evidence: [evidence(evidenceDir, repo, `${part.id}.json`, text)] };
    } catch (err) {
        if (err.reason) return notRun(part, err.reason, err.message);
        return { ...part, status: "error", why: `the runner broke: ${String(err.stack ?? err).split("\n").slice(0, 3).join(" / ")}`, evidence: [] };
    } finally {
        for (const page of Object.values(pages)) await page.context().close().catch(() => {});
    }
}
