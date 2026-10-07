/**
 * The 1.2.56 performance baseline: probe for it, and take it (E30, 24.09.2026).
 * ---------------------------------------------------------------------------
 *     node audit/live/perf-baseline.mjs --probe --stage <Enn>
 *     node audit/live/perf-baseline.mjs --run --stage <Enn> --world <dir> --scene <name> [--themes stained-glass,legacy] [--repeats 5]
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
 *   also hashes perfReport's body in this checkout and looks it up among the bodies the
 *   file records - the baseline's (`perfFunction.bodySha256`, v1.2.56) and each
 *   revision's (`perfFunction.revisions`, E33 C13's first: the same lines
 *   measured by the same code, one block appended) - because a run is only
 *   comparable with a reading taken by a recorded function; an unrecorded body
 *   is a reason a run could not be taken. `--stage` stamps the attempt or the
 *   run with the stage that took it (E33 C13: until then every one said E30).
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
import { createRequire } from "node:module";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../..");
const FILE = path.join(REPO, "audit", "perf-baseline.json");
const SOFTWARE = /swiftshader|llvmpipe|software/i;

const argv = process.argv.slice(2);
const arg = name => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] ?? "" : null; };
const STAGE = /^E\d{2}$/;

/** perfReport's text, declaration line through the closing brace and its newline, hashed. */
export function perfBodySha(text) {
    const start = text.search(/^export async function perfReport\(/m);
    if (start < 0) return null;
    const end = text.indexOf("\n}\n", start);
    return end < 0 ? null : crypto.createHash("sha256").update(text.slice(start, end + 3)).digest("hex");
}

/**
 * perfReport's body in this checkout, hashed; an error's first line where the file cannot be read.
 * The checkout's file, not `git show HEAD:` (E30's reading): a run is taken from the module a server
 * serves, which is a checkout's files and never a commit, and a probe run on a dirty tree - E33 C13's
 * own, before its commit - must name the body it would measure with, not the one the last commit had.
 */
export function perfBodyShaHere() {
    try { return perfBodySha(fs.readFileSync(path.join(REPO, "scripts", "diagnostics.mjs"), "utf8")); }
    catch (err) { return `error: ${String(err.message).trim().split("\n")[0]}`; }
}

/** The bodies the file records: the baseline's, then each revision's (E33 C13), each with the module version it is of. */
export function recordedBodies(doc) {
    const f = doc.perfFunction ?? {};
    return [{ sha256: f.bodySha256, version: doc.baseline?.module?.version ?? null, label: `the baseline (v${doc.baseline?.module?.version})` },
        ...(Array.isArray(f.revisions) ? f.revisions : []).map(r => ({ sha256: r.bodySha256, version: r.version ?? null, label: `revision ${r.stage} (${r.version})` }))];
}

/** Which recorded body `sha` is, or null: a run is comparable only with readings a recorded body took. */
export function recordedBody(doc, sha) {
    return recordedBodies(doc).find(b => b.sha256 === sha) ?? null;
}

async function probes(doc) {
    const ran = [], couldNotRun = [];
    /* The method: a function the file records, in this checkout. Until E33 C13 this compared HEAD with
       v1.2.56 alone; a revision is a recorded body too, so the lookup is against all of them. */
    const now = perfBodyShaHere();
    const body = recordedBody(doc, now);
    if (body) ran.push(`perfReport body sha256 in this checkout ${now}: recorded as ${body.label}`);
    else couldNotRun.push({ needs: "perfReport's body in this checkout recorded in perfFunction", probe: `sha256 in this checkout ${now}`, why: "a run is comparable only with readings a recorded body took: record a revision first" });
    /* The served build must be the one this checkout's body is recorded for (E33 fix r2-G4, 07.10.2026; review
       round 2's cor D2). Until then any recorded body's version passed - a server serving 1.2.56 beside a checkout
       on the 1.2.69 body was a run, and `measure` filed its numbers under that body. Every recorded entry with this
       checkout's hash counts rather than `recordedBody`'s first: a body unchanged across releases may be recorded
       again under the newer version. Measured that day against a stub answering as a v14, the checkout on the
       1.2.69 body: served 1.2.56 read "ran" before this and "could not run" after it; 1.2.69 "ran" and 1.2.70
       "could not run" both times (e33run/scratch/r2g4-d2/probe.log). */
    const versions = recordedBodies(doc).filter(b => b.sha256 === now).map(b => b.version).filter(Boolean);

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
            if (versions.includes(m?.version)) ran.push(`the server has danganronpa-rpg ${m.version} installed, the version this checkout's perfReport body is recorded for`);
            else couldNotRun.push({ needs: `danganronpa-rpg at the version this checkout's perfReport body is recorded for (${versions.join(", ") || "none: the body is not recorded"}) installed on that server`, probe: `it serves ${m?.version ?? "no danganronpa-rpg module.json"}`, why: "a run's numbers are filed under this checkout's body, so the server must serve that body" });
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
    const count = re => { const m = String(text).match(re); return m ? (m[1] === "none" ? 0 : Number(m[1])) : null; };
    return {
        asIs: num(/^As it stands\s+([\d.]+) ms\/frame/m),
        pulseHeld: num(/^With the pulse held\s+([\d.]+) ms/m), pulseCost: num(/^The pulse costs\s+(-?[\d.]+) ms/m),
        blurHeld: num(/^With the blur held\s+([\d.]+) ms/m), blurCost: num(/^The blur costs\s+(-?[\d.]+) ms/m),
        windowOpen: num(/^A window reaches the screen in\s+([\d.]+) ms/m),
        glassRecut: num(/^One recut of the glass\s+([\d.]+) ms/m),
        roomOfActor: num(/^\s+roomOfActor\s+([\d.]+) ms/m), othersInRoom: num(/^\s+othersInRoom\s+([\d.]+) ms/m),
        /* "Rolls the GM drew" (E33 C13): the two lines of the block, each a count - 0 where the line says
           "none since this browser loaded", null where the block is not printed - a median, the slowest, and
           the step on the way. A GM's browser fills the first line, a player's the second. */
        drewCount: count(/^  drawn here, packet in to answer out: (\d+|none)/m),
        drewMedian: num(/^  drawn here, packet in to answer out: \d+, median\s+([\d.]+) ms/m),
        drewSlowest: num(/^  drawn here, packet in to answer out: .*slowest\s+([\d.]+) ms/m),
        drewWritten: num(/^  drawn here, packet in to answer out: .*the message written at median ([\d.]+) ms/m),
        drawnCount: count(/^  drawn for this browser, asked to dice shown: (\d+|none)/m),
        drawnMedian: num(/^  drawn for this browser, asked to dice shown: \d+, median\s+([\d.]+) ms/m),
        drawnSlowest: num(/^  drawn for this browser, asked to dice shown: .*slowest\s+([\d.]+) ms/m),
        drawnAnswered: num(/^  drawn for this browser, asked to dice shown: .*the answer in at median ([\d.]+) ms/m)
    };
}
const median = xs => { const v = xs.filter(x => x !== null).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : null; };

async function measure(doc, { stage, world, scene, themes, repeats }) {
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
        /* The body the run was taken by, named by its own hash and by what the file records it as: `--run`
           refused above unless it is recorded (`probes`), so `body` is never null here. */
        const sha = perfBodyShaHere(), body = recordedBody(doc, sha);
        doc.runs.push({ id: `run-${doc.runs.length + 1}`, stage, at: new Date().toISOString(),
            module: { version: env.module, commit: null }, foundry: env.foundry, system: { id: "daggerheart", version: env.systemVersion },
            environment: "browser",
            machine: { label: process.env.DRPG_MACHINE || null, os: process.platform, webglRenderer: env.renderer, browser: browser.version(), viewport: facts.viewport, dpr: facts.dpr },
            world: { copySha256: copy.sha256, scene, tokens: facts.tokens, regions: facts.regions, walls: facts.walls, actors: facts.actors, items: facts.items, messages: facts.messages },
            method: `perfReport sha256 ${sha.slice(0, 8)}... (${body?.label ?? "unrecorded"}), frames=60, ${repeats} repeats per theme, first discarded`,
            themes: out, sceneSwitch: { method: "scene.view() to canvasReady, 5 repeats", ms: switches, median: median(switches) } });
        doc.status = "measured";
        fs.writeFileSync(FILE, JSON.stringify(doc, null, 2) + "\n");
        console.log(`perf-baseline: run ${doc.runs.length} appended`);
        return 0;
    } finally { await browser.close(); }
}

async function main() {
    const doc = JSON.parse(fs.readFileSync(FILE, "utf8"));
    const stage = arg("--stage");
    if ((argv.includes("--probe") || argv.includes("--run")) && !STAGE.test(stage ?? "")) {
        console.log("perf-baseline: --probe and --run need --stage <Enn>, the stage that takes the attempt or the run (never a stamped guess)");
        return 2;
    }
    if (argv.includes("--probe")) {
        const { ran, couldNotRun } = await probes(doc);
        const attempt = { at: new Date().toISOString(), stage, by: `node audit/live/perf-baseline.mjs --probe --stage ${stage}`, ran, couldNotRun };
        doc.attempts.push(attempt);
        fs.writeFileSync(FILE, JSON.stringify(doc, null, 2) + "\n");
        for (const r of ran) console.log(`perf-baseline: ran - ${r}`);
        for (const c of couldNotRun) console.log(`perf-baseline: could not run - ${c.needs}: ${c.probe}`);
        console.log(`perf-baseline: attempt ${doc.attempts.length} appended; status stays ${doc.status}`);
        return 0;
    }
    if (argv.includes("--run")) {
        const { couldNotRun } = await probes(doc);
        if (couldNotRun.length) {
            for (const c of couldNotRun) console.log(`perf-baseline: refused - ${c.needs}: ${c.probe}`);
            return 1;
        }
        if (!arg("--world") || !arg("--scene")) { console.log("perf-baseline: --run needs --world <dir> and --scene <name>"); return 2; }
        if (arg("--scene") === "largest-isometric") {
            console.log("perf-baseline: refused - read the isometric scene flag's name from the installed isometric-perspective 14.0.2 first, then name the scene");
            return 1;
        }
        return measure(doc, { stage, world: arg("--world"), scene: arg("--scene"),
            themes: (arg("--themes") || "stained-glass,legacy").split(","), repeats: Number(arg("--repeats") || 5) });
    }
    console.log("usage: node audit/live/perf-baseline.mjs --probe --stage <Enn> | --run --stage <Enn> --world <dir> --scene <name> [--themes stained-glass,legacy] [--repeats 5]");
    return 2;
}

/* Real paths, as in tools/stages.mjs: through a symlink the plain comparison never held (25.09.2026). */
const runAsCommand = () => { try { return fs.realpathSync(process.argv[1]) === fs.realpathSync(url.fileURLToPath(import.meta.url)); } catch { return false; } };
if (process.argv[1] && runAsCommand()) {
    process.exitCode = await main();
}
