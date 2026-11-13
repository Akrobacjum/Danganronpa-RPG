/**
 * THE CUT, BYTE FOR BYTE (E54 G2-G4, 13.11.2026; the plan's section 4, step 4).
 * ---------------------------------------------------------------------------
 *     node audit/glass-golden.mjs --capture --boxes <file> [--root <tree>] [--chromium <executable>] [--sizes WxH,...]
 *     node audit/glass-golden.mjs --boxes <file> --out <file> [--against <file>] [--root <tree>] [--chromium <executable>]
 *
 * The glass cut's partitions (glass-geometry.mjs `windowShapes`, `stackShapes`, `deskShapes`, `curtainShapes`, `meetBands`)
 * are given explicit arguments and return values one at a time, each a commit that must change no cut. This is the
 * reading that holds it: glass.mjs `cutBoxes`, the road a test has into the cut, over every size of
 * audit/glass-sweep.mjs's SIZES x {the desk, the stack} x seeds 1, 2, 3 x {no rail, a rail and its band}, the answers
 * written as JSON - so the file made at a commit's parent and the one made at the commit are compared byte for byte.
 *
 * `--capture` reads the boxes the cut is handed: audit/glass-harness.html at each size, in Chromium, Stained Glass,
 * the GM's page, and `LAST.blocks` once the glass is drawn (a block the page measured given `r`, its own box, as R1398
 * hands one). The boxes are written once, at the parent, and handed to both runs, so the comparison reads the cut and
 * nothing the page laid out around it. Without `--capture` each size's cuts are made on a page of that size (the
 * partitions read `narrowLayout()` and `avLift()` off the page), and `--against` says whether the answers are the
 * file's, byte for byte, and where the first difference stands. Exit 1 on a difference or a size that did not load.
 *
 * The rail: R3121's pin and R3122's band where those tests name a size (2000x1072 is not a sweep size; 1920x1080 and
 * 1366x768 are), and elsewhere the same shape measured from the wall (the band's edges 55, 44, 8 and 84 px in from W,
 * a pin of 186 px); the stack's bands R1398's (60, and the wall less 10) or, with the rail, the wall less 84. A
 * stand-in, not a reading of a table: what it holds is that the cut answers the same to the same question.
 *
 * It reads the cut through `cutBoxes` alone: `curtainGeometry`'s writes (CHECKS, LAST, the canvas) are the drawn
 * self-check's, `node audit/glass-sweep.mjs`, and a look at the screenshots at three sizes.
 */
import { createRequire } from "module";
import { spawn } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import net from "net";
import path from "path";
import url from "url";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf(k); return i < 0 ? null : args[i + 1]; };
const root = path.resolve(opt("--root") ?? path.join(HERE, ".."));
const BOXES = opt("--boxes");
const CAPTURE = args.includes("--capture");
if (!BOXES || (!CAPTURE && !opt("--out"))) { console.log("glass-golden: --boxes <file>, and --capture or --out <file>"); process.exit(2); }

const sweep = readFileSync(path.join(HERE, "glass-sweep.mjs"), "utf8");
const listed = sweep.match(/const SIZES = \(opt\("--sizes"\) \?\? ("[^"]*"(?:\s*\+\s*"[^"]*")*)\)/);
if (!listed) { console.log("glass-golden: audit/glass-sweep.mjs's SIZES were not found - point this at them again"); process.exit(2); }
const SIZES = (opt("--sizes") ?? [...listed[1].matchAll(/"([^"]*)"/g)].map(m => m[1]).join("")).split(",");

const RAILS = {   // R3121's pin and R3122's band, at the sizes those tests read
    "1920x1080": [187, [1865, 1923, 1876, 1912, 1836]],
    "1366x768": [155, [1311, 1369, 1322, 1358, 1282]],
};
const railOf = (W, H) => {
    const [pin, [x0, x1, c0, c1, b]] = RAILS[`${W}x${H}`] ?? [186, [W - 55, W + 3, W - 44, W - 8, W - 84]];
    return { rail: pin, band: { x0, y0: 41, x1, y1: 293, real: true, core: [c0, c1], centre: [(c0 + c1) / 2, 167], band: b, coreY: [30, 324], origin: [30, 145] } };
};

let chromium;
try { ({ chromium } = createRequire(path.join(root, "audit", "harness", "package.json"))("playwright")); }
catch { console.log("glass-golden: Playwright is not installed under audit/harness (npm ci there)"); process.exit(2); }
const port = await new Promise(res => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); }); });
const srv = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" });
const base = `http://127.0.0.1:${port}`;
for (let i = 0; i < 50; i++) { try { await fetch(base + "/audit/glass-harness.html"); break; } catch { await new Promise(r => setTimeout(r, 100)); } }
let browser;
try { browser = await chromium.launch(opt("--chromium") ? { executablePath: opt("--chromium") } : {}); }
catch (err) { srv.kill(); console.log(`glass-golden: Chromium did not launch: ${err.message.split("\n")[0]}`); process.exit(2); }

const open = async (W, H) => {
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    await page.goto(`${base}/audit/glass-harness.html`);
    const ok = await page.waitForFunction(() => globalThis.__glass?.LAST?.blocks?.length > 0, null, { timeout: 15000 }).then(() => true, () => false);
    if (ok) await page.waitForTimeout(2500);
    return { page, ok };
};

let bad = 0;
try {
    if (CAPTURE) {
        const boxes = {};
        for (const size of SIZES) {
            const [W, H] = size.split("x").map(Number);
            const { page, ok } = await open(W, H);
            if (!ok) { console.log(`glass-golden: ${size} - the glass did not draw (no LAST.blocks)`); bad++; await page.close(); continue; }
            boxes[size] = await page.evaluate(() => globalThis.__glass.LAST.blocks.map(b => ({ cls: b.cls, x: b.x, y: b.y, w: b.w, h: b.h, ...(b.measured ? { r: { x: b.x, y: b.y, w: b.w, h: b.h } } : {}) })));
            console.log(`glass-golden: ${size} ${boxes[size].length} block(s)`);
            await page.close();
        }
        writeFileSync(BOXES, JSON.stringify(boxes, null, 1) + "\n");
        console.log(`glass-golden: ${Object.keys(boxes).length} of ${SIZES.length} size(s) captured into ${BOXES}`);
    } else {
        const boxes = JSON.parse(readFileSync(BOXES, "utf8"));
        const out = {};
        let cuts = 0;
        for (const size of SIZES) {
            if (!boxes[size]) { console.log(`glass-golden: ${size} - not captured (the page draws no glass at this size), not cut`); continue; }
            const [W, H] = size.split("x").map(Number);
            const { page, ok } = await open(W, H);
            if (!ok) { console.log(`glass-golden: ${size} - the page did not load`); bad++; await page.close(); continue; }
            const runs = [];
            for (const stacked of [false, true]) for (const seed of [1, 2, 3]) for (const withRail of [false, true]) {
                const r = withRail ? railOf(W, H) : null;
                const extra = stacked
                    ? { stacked: true, bands: [{ band: 60 }, { band: withRail ? W - 84 : W - 10 }], ...(r ?? {}) }
                    : { ...(r ?? {}) };
                runs.push([`${stacked ? "stack" : "desk"} seed ${seed}${withRail ? " rail" : ""}`, seed, extra]);
            }
            out[size] = await page.evaluate(([list, W, H, runs]) => {
                const answers = {};
                for (const [key, seed, extra] of runs) {
                    try { answers[key] = globalThis.__glass.cutBoxes(W, H, list, seed, extra); }
                    catch (err) { answers[key] = { threw: String(err?.message ?? err) }; }
                }
                return JSON.parse(JSON.stringify(answers));
            }, [boxes[size], W, H, runs]);
            cuts += runs.length;
            const threw = Object.entries(out[size]).filter(([, a]) => a.threw).map(([k]) => k);
            console.log(`glass-golden: ${size} ${runs.length} cut(s)${threw.length ? `, ${threw.length} threw (${threw.join(", ")}): ${out[size][threw[0]].threw}` : ""}`);
            await page.close();
        }
        const text = JSON.stringify(out) + "\n";
        writeFileSync(opt("--out"), text);
        console.log(`glass-golden: ${cuts} cut(s) over ${Object.keys(out).length} size(s), ${text.length} byte(s) written to ${opt("--out")}`);
        if (opt("--against")) {
            const was = readFileSync(opt("--against"), "utf8");
            if (was === text) console.log(`glass-golden: SAME as ${opt("--against")}, byte for byte`);
            else {
                bad++;
                const before = JSON.parse(was);
                const first = (() => {
                    for (const size of new Set([...Object.keys(before), ...Object.keys(out)]))
                        for (const key of new Set([...Object.keys(before[size] ?? {}), ...Object.keys(out[size] ?? {})]))
                            if (JSON.stringify(before[size]?.[key]) !== JSON.stringify(out[size]?.[key])) return `${size} ${key}`;
                    return "the files' order or spacing";
                })();
                console.log(`glass-golden: DIFFERENT from ${opt("--against")}: first at ${first}`);
            }
        }
    }
} finally { await browser.close(); srv.kill(); }
process.exit(bad ? 1 : 0);
