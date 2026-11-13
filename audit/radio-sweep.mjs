/**
 * Danganronpa RPG - every radio the module draws is round, its dot in the middle (gaps-radio, 13.11.2026).
 * ---------------------------------------------------------------------------
 *     node audit/radio-sweep.mjs [--windows <dir>] [--pl-windows <dir>] [--shots <dir>] [--only <id>]...
 *                                [--base http://127.0.0.1:8765] [--chromium <executable>]
 *
 * The owner, 13.11.2026, on 1.2.109: under Stained Glass a radio is a dark SQUARE box with a pink border, and the
 * checked one shows a pink dot in the box's top-left corner (the zone picker's Mode: Straw Poll, Logic Dive, Scrum
 * Debate). This reads every radio of every captured window that has one (probe 08's captures: audit/windows/, or
 * `--windows <dir>`; `--pl-windows <dir>` the Polish ones, read first), in both themes, at 1366x768, at device scale
 * 1 and 2, on the style harness (`audit/style-harness.html?w=<id>`, the module's sheets, no Foundry core sheet), and
 * holds each to:
 *   - drawn by the module: `appearance: none` (Foundry's own control at a table is a square with a mark in a corner,
 *     danganronpa.css E68 C12's note);
 *   - round: its computed `border-radius` 50%, and no clip path cutting its corners;
 *   - its dot in the middle: the radio checked (and `change` sent), its `::before` painted a probe green, the green
 *     pixels' centre within 1 px of the box's centre, read off a screenshot of the box;
 * twice: on the module's sheets alone, and with a stand-in for core's mark (`::before` absolutely positioned, which
 * puts a dot drawn in the flow at the box's top-left, as the owner saw it). Which rule v14's core really writes there
 * is not read (no core sheet here): the stand-in is that one property, labelled, and only a table settles it.
 * A checkbox the module draws (`appearance: none`, the glass's) must stay square (`border-radius` 0); one it leaves to
 * Foundry (Legacy's) is counted, not read, and the run says how many (a switch, `role="switch"`, is a pill and is not
 * read). A radio, and a checkbox the module draws, that stands in a plain label beside its text is held to the text's
 * line: its centre within 2 px of the first line's. Every closed `<details>` is opened first: a picker folded in one is
 * read as its user sees it. The radios of scripts/ and their captures (probe 08, audit/windows/, 13.11.2026): a choice
 * row's (`variant`, ui-columns.mjs: the action windows and Level Up's own), a project's tray icon (`projects`),
 * a new item's picture (`item-tables--newItem`), Palm's Frisk (`palm-frisk`), the ballot (`ballot`), the season reset's
 * cast (`season-reset`), Use an item's pick (`use-item-pick`), the zone picker's Mode (`zone-picker`), a Logic Dive
 * question's truth (`dive-editor`), voice-panel.mjs's mode (`drpg-settings-player-voice`, its Sound section), Level Up's
 * who (`level-up-queue`) and the Rest's one pick (`rest-pick`); live.mjs draws none, it carries a radio's pick across a
 * rebuild. A window with a radio not read is a problem unless `PANE_NOT_SHOWN` names it.
 * `--shots <dir>` keeps each window as drawn (its first radio checked), per language and theme, at device scale 1.
 * A radio not on screen where it stands (another element at its centre: a picker's grid clipped by its window, say) is
 * not read and is listed by window. Exit 1 on any radio or checkbox that does not hold, and on a run that read none.
 */
import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const opt = name => { const at = argv.indexOf(name); return at >= 0 ? argv[at + 1] : null; };
const many = name => argv.flatMap((a, i) => (a === name ? [argv[i + 1]] : [])).filter(Boolean);
const ONLY = new Set(many("--only"));
const SHOTS = opt("--shots");
const CHROMIUM = opt("--chromium");
const EN_DIR = path.resolve(opt("--windows") ?? path.join(REPO, "audit", "windows"));
const PL_DIR = opt("--pl-windows") ? path.resolve(opt("--pl-windows")) : null;
let BASE = opt("--base");

const { chromium } = createRequire(path.join(REPO, "audit", "harness", "package.json"))("playwright");
const freePort = () => new Promise(resolve => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => resolve(port)); }); });

const PROBE = `input[type="radio"]::before { background-color: #00ff00 !important; background-image: none !important; }`;
const CORE = `input:is([type="radio"], [type="checkbox"])::before { position: absolute; }`;

/* THE WINDOWS WHOSE RADIOS MAY GO UNREAD (REVIEW-111's L1, 13.11.2026). A window outside this set with a radio covered
   where it stands, or none read at all, is a problem, not only a line: a rule that hid or covered every radio of one
   window once left the run green. In the set: the captures whose radios stand in a pane not shown, as the default run
   of 13.11.2026 listed them. */
const PANE_NOT_SHOWN = new Set(["item-tables", "item-tables--editRooms", "item-tables--rooms"]);

function windowsOf(dir) {
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
    return manifest.windows.filter(w => w.captured && (!ONLY.size || ONLY.has(w.id))
        && /type="radio"/.test(fs.readFileSync(path.join(dir, w.file), "utf8")));
}

async function readWindow(browser, { dir, w, theme, dsf, core, shot }) {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: dsf });
    await page.route("**/audit/windows/**", route => {
        const file = path.join(dir, decodeURIComponent(new URL(route.request().url()).pathname.split("/audit/windows/")[1]));
        return fs.existsSync(file) ? route.fulfill({ path: file }) : route.continue();
    });
    const url = `${BASE}/audit/style-harness.html?w=${encodeURIComponent(w.id)}${w.client === "gm" ? "" : "&role=player"}${theme === "legacy" ? "&theme=legacy" : ""}`;
    await page.goto(url);
    await page.evaluate(() => globalThis.document.fonts.ready);
    if (core) await page.addStyleTag({ content: CORE });
    // a picker folded in a <details> (Create a project's Tray icon, a new item's picture) is read open, as its user sees it
    await page.evaluate(() => globalThis.document.querySelectorAll("details:not([open])").forEach(d => { d.open = true; }));
    /* THE CONTROL ON ITS LABEL'S LINE (gaps-radio, the review's M1, 13.11.2026): in a plain label - the control a child of
       the <label>, the label's own text beside it - how far the control's centre stands from the centre of the text's
       first line, in px (negative: above), or null where the label holds no text of its own (a choice row's control is
       centred on its two lines by the row's flex, and is not read here). */
    await page.evaluate(() => {
        globalThis.drpgOffLine = el => {
            const label = el.parentElement?.tagName === "LABEL" ? el.parentElement : null;
            const text = label ? [...label.childNodes].find(n => n.nodeType === 3 && n.textContent.trim()) : null;
            if (!text) return null;
            const range = globalThis.document.createRange();
            range.selectNodeContents(text);
            const line = [...range.getClientRects()].find(r => r.height > 0);
            if (!line) return null;
            const r = el.getBoundingClientRect();
            return (r.top + r.height / 2) - (line.top + line.height / 2);
        };
    });
    const problems = [];
    const boxes = { drawn: 0, core: 0 };
    const radios = await page.$$('input[type="radio"]');
    let read = 0;
    const unseen = [];
    for (const handle of radios) {
        const st = await handle.evaluate(el => {
            if (!el.getClientRects().length || el.closest("[hidden]")) return null;
            el.scrollIntoView({ block: "center" });
            const r = el.getBoundingClientRect(), at = globalThis.document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
            if (!at || !(at === el || at.contains(el) || el.closest("label")?.contains(at))) return { hidden: `${el.name}=${el.value}` };
            const s = globalThis.getComputedStyle(el);
            return { name: `${el.name}=${el.value}`, appearance: s.appearance, radius: s.borderRadius, clip: s.clipPath, w: el.offsetWidth, h: el.offsetHeight, off: globalThis.drpgOffLine(el) };
        });
        if (!st) continue;
        if (st.hidden) { unseen.push(st.hidden); continue; }
        read++;
        const tag = `${w.id} ${theme} dsf${dsf}${core ? " +core" : ""} radio ${st.name}`;
        if (st.appearance !== "none") { problems.push(`${tag}: not drawn by the module (appearance ${st.appearance})`); continue; }
        if (st.radius !== "50%") problems.push(`${tag}: border-radius ${st.radius}, not 50%`);
        if (st.clip !== "none") problems.push(`${tag}: clip-path ${st.clip.slice(0, 40)}`);
        if (st.off !== null && Math.abs(st.off) > 2) problems.push(`${tag}: its centre ${st.off.toFixed(2)} px ${st.off < 0 ? "above" : "below"} its label's text`);
        await handle.evaluate(el => { el.checked = true; el.dispatchEvent(new globalThis.Event("change", { bubbles: true })); });
        const style = await page.addStyleTag({ content: PROBE });
        await page.waitForTimeout(220);
        const box = await handle.boundingBox();
        const png = await page.screenshot({ clip: box });
        await style.evaluate(el => el.remove());
        const dot = await page.evaluate(async ({ src, dsf }) => {
            const img = new globalThis.Image(); img.src = src; await img.decode();
            const c = new globalThis.OffscreenCanvas(img.width, img.height), g = c.getContext("2d"); g.drawImage(img, 0, 0);
            const d = g.getImageData(0, 0, img.width, img.height).data;
            let sx = 0, sy = 0, n = 0;
            for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
                const i = (y * img.width + x) * 4;
                // the probe green by its hue, so a faded row (a disabled one: the row's opacity) still reads
                if (d[i + 1] > 90 && d[i + 1] > d[i] + 60 && d[i + 1] > d[i + 2] + 60) { sx += x + 0.5; sy += y + 0.5; n++; }
            }
            return n ? { x: sx / n / dsf, y: sy / n / dsf, n, w: img.width / dsf, h: img.height / dsf } : null;
        }, { src: "data:image/png;base64," + png.toString("base64"), dsf });
        if (!dot) { problems.push(`${tag}: checked, no dot drawn`); continue; }
        const dx = dot.x - dot.w / 2, dy = dot.y - dot.h / 2;
        if (Math.hypot(dx, dy) > 1) problems.push(`${tag}: the dot's centre ${dx.toFixed(2)}, ${dy.toFixed(2)} px off the box's (${dot.w.toFixed(1)}x${dot.h.toFixed(1)})`);
    }
    /* A capture whose radios all stand in a pane not shown (the item tables' other tabs carry New item's in theirs) reads
       none, and says so below; the run as a whole must read some (`main`). */
    if (!read && !unseen.length) unseen.push("every radio in a pane not shown");
    // a switch (`role="switch"`, the kit's `toggle`) is a pill on purpose, not a checkbox's box
    for (const handle of await page.$$('input[type="checkbox"]:not([role="switch"])')) {
        const st = await handle.evaluate(el => (el.getClientRects().length ? { name: el.name || el.className || "checkbox", radius: globalThis.getComputedStyle(el).borderRadius, appearance: globalThis.getComputedStyle(el).appearance, off: globalThis.drpgOffLine(el) } : null));
        if (!st) continue;
        if (st.appearance === "none") boxes.drawn++; else { boxes.core++; continue; }
        const tag = `${w.id} ${theme} dsf${dsf}${core ? " +core" : ""} checkbox ${st.name}`;
        if (!/^0px$/.test(st.radius) && st.appearance === "none") problems.push(`${tag}: border-radius ${st.radius}, not square`);
        if (st.appearance === "none" && st.off !== null && Math.abs(st.off) > 2) problems.push(`${tag}: its centre ${st.off.toFixed(2)} px ${st.off < 0 ? "above" : "below"} its label's text`);
    }
    if (shot) {
        const first = radios.length ? radios[0] : null;
        await first?.evaluate(el => { el.checked = true; el.dispatchEvent(new globalThis.Event("change", { bubbles: true })); el.scrollIntoView({ block: "center" }); });
        await page.waitForTimeout(220);
        const win = await page.$(".drpg-style-shot");
        await (win ?? page).screenshot({ path: shot });
    }
    await page.close();
    const none = unseen.length === 1 && unseen[0] === "every radio in a pane not shown";
    return { read, problems, boxes, unseen: none ? `${w.id}: every radio in a pane not shown (another tab's)`
        : unseen.length ? `${w.id}: ${unseen.length} radio(s) covered or clipped where they stand (${unseen.slice(0, 3).join(", ")}${unseen.length > 3 ? ", ..." : ""})` : null };
}

async function main() {
    let server = null;
    if (!BASE) {
        const port = await freePort();
        server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], { cwd: REPO, stdio: "ignore" });
        BASE = `http://127.0.0.1:${port}`;
        for (let i = 0; i < 50; i++) { try { await fetch(`${BASE}/module.json`); break; } catch { await new Promise(r => setTimeout(r, 100)); } }
    }
    const browser = await chromium.launch(CHROMIUM ? { executablePath: CHROMIUM } : {});
    const problems = [];
    let radios = 0, windows = 0;
    const boxes = { drawn: 0, core: 0 };
    const unseenAll = [];
    try {
        const langs = [...(PL_DIR ? [["pl", PL_DIR]] : []), ["en", EN_DIR]];
        if (!PL_DIR) console.log("radio-sweep: Polish NOT read (no --pl-windows <dir>)");
        for (const [lang, dir] of langs) {
            for (const w of windowsOf(dir)) {
                windows++;
                for (const theme of ["glass", "legacy"]) for (const dsf of [1, 2]) for (const core of [false, true]) {
                    const shot = SHOTS && dsf === 1 && !core ? path.join(SHOTS, `${lang}-${theme}-${w.id}.png`) : null;
                    if (shot) fs.mkdirSync(SHOTS, { recursive: true });
                    const r = await readWindow(browser, { dir, w, theme, dsf, core, shot });
                    radios += r.read;
                    boxes.drawn += r.boxes.drawn;
                    boxes.core += r.boxes.core;
                    if (r.unseen && dsf === 1 && !core && theme === "glass") unseenAll.push(`${lang} ${r.unseen}`);
                    if (r.unseen && !PANE_NOT_SHOWN.has(w.id)) problems.push(`${lang} ${theme} dsf${dsf}${core ? " +core" : ""} not read: ${r.unseen}`);
                    problems.push(...r.problems.map(p => `${lang} ${p}`));
                }
            }
        }
    } finally {
        await browser.close();
        server?.kill();
    }
    const seen = new Set();
    for (const p of problems) { if (!seen.has(p)) console.log(`radio-sweep: ${p}`); seen.add(p); }
    for (const u of unseenAll) console.log(`radio-sweep: not read, not on screen at its box: ${u}`);
    console.log(`radio-sweep: ${boxes.drawn} checkbox reading(s) of the module's own box; ${boxes.core} of Foundry's, not read`);
    console.log(`radio-sweep: ${windows} window(s), ${radios} radio reading(s); ${problems.length ? `RED, ${problems.length} problem(s)` : "green"}`);
    process.exitCode = problems.length || !radios ? 1 : 0;
}

main().catch(err => { console.error(err); process.exitCode = 1; });
