/**
 * The live runner: the parts of the local gate that need a real Foundry v14 (E30, 24.09.2026).
 * ---------------------------------------------------------------------------
 * Called by audit/gate/local-gate.mjs when something answered at the sandbox
 * URL; never on its own. NEVER RUN: this file was written in a container with
 * no Foundry and no licence, and no line of it has executed against a real
 * server (audit/live/README.md). What it assumes about Foundry is marked
 * UNMEASURED where it is assumed; the first real run is its test, and the
 * `error` status keeps "the runner broke" apart from "the module failed".
 *
 * What it will not do, by construction: type a password, admin key or licence
 * (tools/check.mjs gatecode reads this folder for it), log into the setup
 * screen, write to a world that is not an allowed copy, or run against files
 * that differ from this commit.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const COPY_RE = /(gate|copy|qa)/i;

/**
 * The first reason nothing can run, from /api/status's answer, or null.
 * UNMEASURED: the field names (`active`, `version`, `world`) are what Foundry's
 * status route is believed to return; the raw body is kept in local-gate.json
 * so the first real run can correct this.
 */
function serverReason(status, world) {
    if (!status || status.active === false || !status.world) return { reason: "no-world", why: `the server answered without an active world (${JSON.stringify(status ?? null).slice(0, 200)})` };
    if (!/^14\./.test(String(status.version ?? ""))) return { reason: "wrong-foundry", why: `the server is Foundry ${status.version ?? "of unknown version"}, not 14.x` };
    if (!world || status.world !== world || !COPY_RE.test(world)) {
        return { reason: "not-a-copy", why: `the active world is "${status.world}"; DRPG_SANDBOX_WORLD is "${world ?? ""}" and must name it and match ${COPY_RE}` };
    }
    return null;
}

/** Module files the sandbox serves that differ from this checkout (scripts, styles, lang, module.json). */
async function servedDiff(base, repo) {
    const files = ["module.json", ...["scripts", "styles", "lang"].flatMap(d =>
        fs.readdirSync(path.join(repo, d)).filter(f => /\.(mjs|css|json)$/.test(f)).map(f => `${d}/${f}`))];
    const differ = [];
    for (const f of files) {
        const res = await fetch(new URL(`/modules/danganronpa-rpg/${f}`, base));
        const served = res.ok ? crypto.createHash("sha256").update(Buffer.from(await res.arrayBuffer())).digest("hex") : null;
        const local = crypto.createHash("sha256").update(fs.readFileSync(path.join(repo, f))).digest("hex");
        if (served !== local) differ.push(f);
    }
    return { files: files.length, differ };
}

/**
 * Log in as one account on /join, choosing the user and pressing Join. The
 * password field is never touched: an account that needs one stays on /join,
 * and that is `password-required` - after 30 s, so a slow server is not read
 * as one (a user name the form does not list throws, and is `error`).
 * UNMEASURED: the join form's selectors on v14.
 */
export async function login(browser, base, userName) {
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    await context.addInitScript({ path: path.join(HERE, "page-hooks.js") });
    const page = await context.newPage();
    await page.goto(new URL("/join", base).href, { waitUntil: "domcontentloaded" });
    await page.selectOption('select[name="userid"]', { label: userName });
    await page.click('button[name="join"]');
    await page.waitForURL(u => !u.pathname.startsWith("/join"), { timeout: 30_000 }).catch(() => {});
    if (new URL(page.url()).pathname.startsWith("/join")) {
        const e = new Error(`${userName} stayed on /join: the account needs a password, and the runner never types one`);
        e.reason = "password-required";
        throw e;
    }
    await page.waitForFunction(() => globalThis.game?.ready === true, null, { timeout: 120_000 });
    return page;
}

/** Everything the page can say about where it runs, for an evidence header. */
export async function pageEnv(page) {
    return page.evaluate(() => {
        const gl = document.createElement("canvas").getContext("webgl");
        const ext = gl?.getExtension("WEBGL_debug_renderer_info");
        return { foundry: game.version, systemVersion: game.system.version, module: game.modules.get("danganronpa-rpg")?.version ?? null,
            world: game.world.id, renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null };
    });
}

/** Write one evidence file and return its entry. */
export function evidence(evidenceDir, repo, name, text) {
    fs.mkdirSync(evidenceDir, { recursive: true });
    const abs = path.join(evidenceDir, name);
    fs.writeFileSync(abs, text);
    return { path: path.relative(repo, abs).split(path.sep).join("/"), sha256: crypto.createHash("sha256").update(text).digest("hex"), bytes: Buffer.byteLength(text) };
}

/** Run every part the gate asked for; one entry each, never `passed` for something that did not run. */
export async function runGate(ctx) {
    const { repo, url: base, world, users, status, parts, notRun, fixtureDir, fixtureWhy } = ctx;
    const stop = serverReason(status, world);
    if (stop) return parts.map(p => notRun(p, stop.reason, stop.why));
    const served = await servedDiff(base, repo);
    if (served.differ.length) {
        const why = `${served.differ.length} of ${served.files} files the sandbox serves differ from this commit: ${served.differ.slice(0, 8).join(", ")}`;
        return parts.map(p => notRun(p, "stale-module", why));
    }
    let chromium;
    try { ({ chromium } = ctx.requireHarness("playwright")); }
    catch (err) { return parts.map(p => notRun(p, "no-playwright", `require("playwright") failed: ${err.message}`)); }
    let browser;
    try { browser = await chromium.launch({ args: ["--use-gl=angle", "--ignore-gpu-blocklist"] }); }
    catch (err) { return parts.map(p => notRun(p, "no-browser", `chromium.launch failed: ${String(err.message).split("\n")[0]}`)); }
    const out = [];
    try {
        const suite = await import(url.pathToFileURL(path.join(HERE, "suite.mjs")).href);
        const sandbox = await import(url.pathToFileURL(path.join(HERE, "sandbox-cluster.mjs")).href);
        const live = parts.filter(p => p.layer === "live");
        if (live.length) out.push(...await suite.runLive({ ...ctx, browser, parts: live, login, pageEnv, evidence }));
        for (const p of parts.filter(p => p.layer === "sandbox")) out.push(await sandbox.runPart({ ...ctx, browser, part: p, login, pageEnv, evidence }));
        for (const p of parts.filter(p => p.layer === "drill")) {
            out.push(fixtureDir(p.fixture)
                ? { ...p, status: "error", why: "drills need the sandbox restarted on a copy of the fixture (--parts drills --merge); this runner has no restart step yet", evidence: [] }
                : notRun(p, "no-fixtures", fixtureWhy(p.fixture)));
        }
    } catch (err) {
        const done = new Set(out.map(p => p.id));
        for (const p of parts.filter(p => !done.has(p.id))) {
            out.push(err.reason ? notRun(p, err.reason, err.message) : { ...p, status: "error", why: `the runner broke: ${String(err.stack ?? err).split("\n").slice(0, 3).join(" / ")}`, evidence: [] });
        }
    } finally {
        await browser.close().catch(() => {});
    }
    void users;
    return out;
}
