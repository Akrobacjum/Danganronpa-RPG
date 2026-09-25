/**
 * The 1.2.56 performance baseline: probe for it, and take it (E30, 24.09.2026).
 * ---------------------------------------------------------------------------
 *     node audit/live/perf-baseline.mjs --probe
 *     node audit/live/perf-baseline.mjs --run --world <dir> --scene <name> [--themes stained-glass,legacy] [--repeats 5]
 *
 * audit/perf-baseline.json holds what game.drpg.perf() reads at a real table on
 * 1.2.56, before E04 (1.2.63) migrates the world. That number cannot be taken
 * headless (the file's `headless` block says why, line by line), so this script
 * does two things:
 *
 * --probe checks each thing a run needs - Foundry v14 at FOUNDRY_URL (default
 *   http://127.0.0.1:30099) and the module version it serves, the world copy in
 *   DRPG_FIXTURES, a browser and the WebGL renderer it reports - and appends to
 *   `attempts` exactly what each probe returned, the errors verbatim; never a
 *   hand-written list. It exits 0: an attempt is a record, not a verdict. It
 *   also hashes perfReport's body at v1.2.56 and at HEAD, because a run is
 *   only comparable with a reading taken by the same function.
 *
 * --run refuses unless every probe passes. NEVER RUN (audit/live/README.md).
 *   `--world` is the PRISTINE copy in DRPG_FIXTURES: it is hashed for the run
 *   (world-manifest.mjs), never opened. The server must already run a scratch
 *   copy of it - 1.2.56 rewrites migratedVersion on load and perf() posts a
 *   card - whose id matches /(copy|perf|qa)/i; this script never logs into the
 *   setup screen to launch one. It logs in as the GM through audit/live's
 *   runner (no password is ever typed) at 1366x768, and per theme sets the
 *   client theme, reloads, waits for the canvas plus five seconds, calls
 *   game.drpg.perf() `repeats` times (the first is discarded), parses its
 *   lines, times five scene switches away and back, and appends one run. It
 *   refuses to write a run from a software renderer. `--scene
 *   largest-isometric` is refused until the isometric flag's real name has
 *   been read from the installed isometric-perspective 14.0.2: a guessed flag
 *   would pick the wrong scene.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../..");
const FILE = path.join(REPO, "audit", "perf-baseline.json");
const SOFTWARE = /swiftshader|llvmpipe|software/i;

const argv = process.argv.slice(2);
const arg = name => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] ?? "" : null; };

/** perfReport's text, declaration line through the closing brace and its newline, hashed. */
export function perfBodySha(text) {
    const start = text.search(/^export async function perfReport\(/m);
    if (start < 0) return null;
    const end = text.indexOf("\n}\n", start);
    return end < 0 ? null : crypto.createHash("sha256").update(text.slice(start, end + 3)).digest("hex");
}

async function probes() {
    const ran = [], couldNotRun = [];
    /* The method: the same function at the baseline and now. */
    const at = rev => {
        try { return perfBodySha(execFileSync("git", ["-C", REPO, "show", `${rev}:scripts/diagnostics.mjs`], { encoding: "utf8", maxBuffer: 64 << 20, stdio: ["ignore", "pipe", "pipe"] })); }
        catch (err) { return `error: ${String(err.stderr || err.message).trim().split("\n")[0]}`; }
    };
    const then = at("v1.2.56"), now = at("HEAD");
    ran.push(`perfReport body sha256 at v1.2.56 ${then}, at HEAD ${now}: ${then === now ? "identical" : "DIFFERENT"}`);

    /* Foundry. */
    const base = process.env.FOUNDRY_URL || "http://127.0.0.1:30099";
    let foundryUp = false;
    try {
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), 3000);
        const res = await fetch(new URL("/api/status", base), { signal: ctl.signal }).finally(() => clearTimeout(timer));
        const body = (await res.text()).slice(0, 500);
        let status = null;
        try { status = JSON.parse(body); } catch { /* recorded raw */ }
        if (/^14\./.test(String(status?.version ?? ""))) { foundryUp = true; ran.push(`Foundry at ${base}: ${body}`); }
        else couldNotRun.push({ needs: `Foundry VTT v14 on ${base}`, probe: `HTTP ${res.status}: ${body}`, why: "the server that answered is not a v14 with a world" });
        if (foundryUp) {
            const m = await fetch(new URL("/modules/danganronpa-rpg/module.json", base)).then(r => r.ok ? r.json() : null).catch(() => null);
            if (m?.version === "1.2.56") ran.push("the server has danganronpa-rpg 1.2.56 installed");
            else couldNotRun.push({ needs: "danganronpa-rpg 1.2.56 installed on that server", probe: `it serves ${m?.version ?? "no danganronpa-rpg module.json"}`, why: "the baseline is 1.2.56's cost" });
        }
    } catch (err) {
        const { connectError } = await import(url.pathToFileURL(path.join(REPO, "audit", "gate", "gate-lib.mjs")).href);
        couldNotRun.push({ needs: `Foundry VTT v14 on ${base}`, probe: connectError(err), why: "nothing answered: no Foundry binary or licence where this ran" });
    }

    /* The world copy. */
    const fixtures = process.env.DRPG_FIXTURES;
    if (!fixtures) couldNotRun.push({ needs: "the world copy", probe: "DRPG_FIXTURES is not set", why: "private fixtures live outside the repository" });
    else if (!fs.existsSync(fixtures)) couldNotRun.push({ needs: "the world copy", probe: `DRPG_FIXTURES=${fixtures} does not exist`, why: "private fixtures live outside the repository" });
    else ran.push(`DRPG_FIXTURES=${fixtures}: ${fs.readdirSync(fixtures).join(", ") || "empty"}`);

    /* A browser, and what it draws with. */
    try {
        const { chromium } = createRequire(path.join(REPO, "audit", "harness", "package.json"))("playwright");
        const browser = await chromium.launch();
        try {
            const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
            const renderer = await page.evaluate(() => {
                const gl = document.createElement("canvas").getContext("webgl");
                if (!gl) return "no WebGL context";
                const ext = gl.getExtension("WEBGL_debug_renderer_info");
                return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
            });
            if (SOFTWARE.test(renderer) || renderer === "no WebGL context") {
                couldNotRun.push({ needs: "a browser drawing on a GPU at 1366x768", probe: `Chromium ${browser.version()} reports WebGL renderer "${renderer}"`, why: "a software renderer prices the blur and the pulse at what a GPU never charges" });
            } else ran.push(`Chromium ${browser.version()}, WebGL renderer "${renderer}"`);
        } finally { await browser.close(); }
    } catch (err) {
        couldNotRun.push({ needs: "a browser drawing on a GPU at 1366x768", probe: String(err.message).split("\n")[0], why: "Playwright could not launch a browser here" });
    }
    return { ran, couldNotRun };
}

/** perf()'s lines as numbers; a line it did not print is null, never 0. */
export function parsePerf(text) {
    const num = re => { const m = String(text).match(re); return m ? Number(m[1]) : null; };
    return {
        asIs: num(/^As it stands\s+([\d.]+) ms\/frame/m),
        pulseHeld: num(/^With the pulse held\s+([\d.]+) ms/m), pulseCost: num(/^The pulse costs\s+(-?[\d.]+) ms/m),
        blurHeld: num(/^With the blur held\s+([\d.]+) ms/m), blurCost: num(/^The blur costs\s+(-?[\d.]+) ms/m),
        windowOpen: num(/^A window reaches the screen in\s+([\d.]+) ms/m),
        glassRecut: num(/^One recut of the glass\s+([\d.]+) ms/m),
        roomOfActor: num(/^\s+roomOfActor\s+([\d.]+) ms/m), othersInRoom: num(/^\s+othersInRoom\s+([\d.]+) ms/m)
    };
}
const median = xs => { const v = xs.filter(x => x !== null).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : null; };

async function measure(doc, { world, scene, themes, repeats }) {
    const THEME = { "stained-glass": "stainedGlass", legacy: "monokumaLegacy" };
    if (themes.some(t => !THEME[t]) || !(repeats >= 2)) { console.log("perf-baseline: --themes takes stained-glass,legacy and --repeats at least 2"); return 2; }
    const { manifest } = await import(url.pathToFileURL(path.join(HERE, "world-manifest.mjs")).href);
    const copy = manifest(world);
    /* The run names the copy it was taken on, and that copy is the one recorded - a
       baseline measured on some other world would compare with nothing. */
    if (doc.worldCopy.status !== "taken") { console.log(`perf-baseline: refused - record the copy first: node audit/live/world-manifest.mjs ${world} --write`); return 1; }
    if (doc.worldCopy.sha256 !== copy.sha256) { console.log(`perf-baseline: refused - ${world} is not the copy recorded in worldCopy (sha256 ${copy.sha256.slice(0, 12)} against ${String(doc.worldCopy.sha256).slice(0, 12)})`); return 1; }
    const base = process.env.FOUNDRY_URL || "http://127.0.0.1:30099";
    const gmName = JSON.parse(process.env.DRPG_SANDBOX_USERS || "{}").gm ?? "GM";
    const { chromium } = createRequire(path.join(REPO, "audit", "harness", "package.json"))("playwright");
    const { login, pageEnv } = await import(url.pathToFileURL(path.join(HERE, "foundry.mjs")).href);
    const browser = await chromium.launch({ args: ["--use-gl=angle", "--ignore-gpu-blocklist"] });
    try {
        const page = await login(browser, base, gmName);
        const env = await pageEnv(page);
        if (!/(copy|perf|qa)/i.test(env.world)) { console.log(`perf-baseline: refused - the active world ${env.world} is not a scratch copy`); return 1; }
        if (!env.renderer || SOFTWARE.test(env.renderer)) { console.log(`perf-baseline: refused - renderer "${env.renderer}" is software`); return 1; }
        const facts = await page.evaluate(name => {
            const s = game.scenes.getName(name);
            return s ? { id: s.id, tokens: s.tokens.size, regions: s.regions?.size ?? null, walls: s.walls.size,
                actors: game.actors.size, items: game.items.size, messages: game.messages.size,
                viewport: `${innerWidth}x${innerHeight}`, dpr: devicePixelRatio } : null;
        }, scene);
        if (!facts) { console.log(`perf-baseline: refused - no scene named ${scene}`); return 1; }
        const out = {};
        for (const theme of themes) {
            await page.evaluate(v => game.settings.set("danganronpa-rpg", "theme", v), THEME[theme]);
            await page.reload({ waitUntil: "domcontentloaded" });
            await page.waitForFunction(() => globalThis.game?.ready === true && globalThis.canvas?.ready === true, null, { timeout: 180_000 });
            await page.evaluate(id => game.scenes.get(id).view(), facts.id);
            await page.waitForTimeout(5000);
            const reads = [];
            for (let i = 0; i < repeats; i++) {
                const text = await page.evaluate(() => game.drpg.perf());
                reads.push({ text, ...parsePerf(text) });
            }
            const kept = reads.slice(1);
            out[theme] = { repeats: reads, median: Object.fromEntries(Object.keys(parsePerf("")).map(k => [k, median(kept.map(r => r[k]))])) };
        }
        const other = await page.evaluate(id => game.scenes.find(s => s.id !== id)?.id ?? null, facts.id);
        const switches = [];
        if (other) {
            for (let i = 0; i < 5; i++) {
                switches.push(await page.evaluate(async ([a, b]) => {
                    await game.scenes.get(a).view();
                    const t0 = performance.now();
                    await new Promise(r => { Hooks.once("canvasReady", r); game.scenes.get(b).view(); });
                    return performance.now() - t0;
                }, [other, facts.id]));
            }
        }
        doc.runs.push({ id: `run-${doc.runs.length + 1}`, stage: "E30", at: new Date().toISOString(),
            module: { version: env.module, commit: null }, foundry: env.foundry, system: { id: "daggerheart", version: env.systemVersion },
            environment: "browser",
            machine: { label: process.env.DRPG_MACHINE || null, os: process.platform, webglRenderer: env.renderer, browser: browser.version(), viewport: facts.viewport, dpr: facts.dpr },
            world: { copySha256: copy.sha256, scene, tokens: facts.tokens, regions: facts.regions, walls: facts.walls, actors: facts.actors, items: facts.items, messages: facts.messages },
            method: `perfReport sha256 ${doc.perfFunction.bodySha256.slice(0, 8)}..., frames=60, ${repeats} repeats per theme, first discarded`,
            themes: out, sceneSwitch: { method: "scene.view() to canvasReady, 5 repeats", ms: switches, median: median(switches) },
            notMeasured: ["the roll round trip, which does not exist before E28 (E33 adds it)"] });
        doc.status = "measured";
        fs.writeFileSync(FILE, JSON.stringify(doc, null, 2) + "\n");
        console.log(`perf-baseline: run ${doc.runs.length} appended`);
        return 0;
    } finally { await browser.close(); }
}

async function main() {
    const doc = JSON.parse(fs.readFileSync(FILE, "utf8"));
    if (argv.includes("--probe")) {
        const { ran, couldNotRun } = await probes();
        const attempt = { at: new Date().toISOString(), stage: "E30", by: "node audit/live/perf-baseline.mjs --probe", ran, couldNotRun };
        doc.attempts.push(attempt);
        fs.writeFileSync(FILE, JSON.stringify(doc, null, 2) + "\n");
        for (const r of ran) console.log(`perf-baseline: ran - ${r}`);
        for (const c of couldNotRun) console.log(`perf-baseline: could not run - ${c.needs}: ${c.probe}`);
        console.log(`perf-baseline: attempt ${doc.attempts.length} appended; status stays ${doc.status}`);
        return 0;
    }
    if (argv.includes("--run")) {
        const { couldNotRun } = await probes();
        if (couldNotRun.length) {
            for (const c of couldNotRun) console.log(`perf-baseline: refused - ${c.needs}: ${c.probe}`);
            return 1;
        }
        if (!arg("--world") || !arg("--scene")) { console.log("perf-baseline: --run needs --world <dir> and --scene <name>"); return 2; }
        if (arg("--scene") === "largest-isometric") {
            console.log("perf-baseline: refused - read the isometric scene flag's name from the installed isometric-perspective 14.0.2 first, then name the scene");
            return 1;
        }
        return measure(doc, { world: arg("--world"), scene: arg("--scene"),
            themes: (arg("--themes") || "stained-glass,legacy").split(","), repeats: Number(arg("--repeats") || 5) });
    }
    console.log("usage: node audit/live/perf-baseline.mjs --probe | --run --world <dir> --scene <name> [--themes stained-glass,legacy] [--repeats 5]");
    return 2;
}

/* Real paths, as in tools/stages.mjs: through a symlink the plain comparison never held (25.09.2026). */
const runAsCommand = () => { try { return fs.realpathSync(process.argv[1]) === fs.realpathSync(url.fileURLToPath(import.meta.url)); } catch { return false; } };
if (process.argv[1] && runAsCommand()) {
    process.exitCode = await main();
}
