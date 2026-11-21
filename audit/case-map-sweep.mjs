/*
 * THE CASE MAP SWEEP (E97 fix, 12.11.2026; the owner's review of the case map, "opisy sa poucinane"): is any node's text
 * cut, and do two nodes overlap, on the Map as Chromium draws it.
 *
 *   cd audit/harness && npm ci                 (once: Playwright comes from there; it downloads no browser)
 *   DRPG_CAPTURE_ONLY=investigation--map,investigation--map-node,investigation--map-trace DRPG_CAPTURE_OUT=<dir-en> \
 *       node cluster.mjs probes/08-capture-windows.mjs           (from audit/harness; and with DRPG_CAPTURE_LANG=pl into <dir-pl>)
 *   node audit/case-map-sweep.mjs <dir-en> <dir-pl> [--shots <dir>] [--chromium <executable>] [--ids <regexp>]   (from the repository's root)
 *
 * For every capture of each directory (probe 08's Map windows: nothing open, a deduction open, a Remnant open), at
 * 1366x768 and 1920x1080, under Stained Glass and Monokuma Legacy (with its pixel font): the window inside the module's
 * sheets, framed as audit/style-harness.html frames one, then scripts/case-view.mjs `relayoutCaseMap` run on its canvas -
 * the module's own code, imported by the page, as the Map runs it after a draw - and, once the fonts are in, read:
 *   cut      a node (its face) or an open node's fields whose content is larger than its box (scrollWidth or scrollHeight
 *            over clientWidth or clientHeight by more than 1 px), a text part of a node (kind, mode, state, name, words)
 *            whose box leaves its node's, or one drawn with an ellipsis or a line clamp;
 *   field    (owner-116, 15.11.2026) a text box or select of an open node narrower than its fields' content box by more than
 *            1 px - with its control: a text box planted at half that width, on the first page with a node open, must read;
 *   overlap  two nodes (a face with its open fields under it) whose boxes meet;
 *   reveal   with a node open, case-view.mjs `wireCaseCamera`'s reveal run as the Map runs it: the open node's face must
 *            then stand inside the graph's viewport;
 *   bar      the camera's bar (`.drpg-case-camera`, "- 100% + / Fit to view") over a node's visible part, at rest and
 *            after Fit to view (case-view.mjs `wireCaseCamera`'s fit, eased off) - E99 round 5: the owner's round-4 shot
 *            (pl, glass, 1366x768) had it over "Wniosek / Nonstop Debate", which no check here read;
 *   fold     the unrelated evidence's fold: its words larger than its box, or its box over a node (round 5);
 *   footer   each button of the window's footer in view, named, its words inside its box (round 6);
 *   hover    (line P of 1.2.120) the first node face in view hovered by the pointer: its name's ink against the ground it
 *            is drawn on under the pointer (the window, the node's fill and Stained Glass's brush, composited) under WCAG AA
 *            4.5; its control, on the first page under glass, the brush planted back under the pointer must read;
 *   toolbar  (line P of 1.2.120) the order's select and the plan's at one computed font size; no control of the
 *            Map's tools or its view switch over another or past the window's content box (`--width <px>` draws every
 *            window at that width, to read it narrow); the tools on one row in a window 1000 px wide or wider;
 *   through  (line P of 1.2.120) a drawn line's stretch inside a node's box other than its own two ends;
 *   size     while a trial runs, under glass, at 800 px of height or less: the smallest node text after Fit to view
 *            at least 11 px (the owner, 12.11, round 6; MIN_TEXT);
 *   sizes    (line INVEST of 1.2.122) the Map's small texts - the overview's chapter, the zoom read-out, the legend, a slot's
 *            heading and difficulty, an open node's text fields - each at least the size of a node's fields' labels
 *            (`SIZE_PARTS`, `SMALL_TEXTS`); every part's size printed under its page's line;
 *   word     (line INVEST of 1.2.122) no word of a footer button's words broken across two lines (the owner: "Preview
 *            realization" broke mid-word at 600 px; read it with `--width 600`);
 *   the numbers: nodes, the tallest node, the graph's viewport, the canvas; the trial console's slot, and after Fit to
 *            view its scale and the smallest node text in px (the computed font size of a node's words times the scale).
 * THE BAR'S CONTROL: on the first page the bar planted over the first node (`position: fixed` at its box) must read.
 * THE CONTROL FIRST (the stackShapes lesson in CLAUDE.md: a count that cannot see a fault measures nothing): on the first
 * page, the node rule's C5 box put back by an injected rule (`height: 54px; overflow: hidden` on every node) must read
 * at least one cut, and the canvas laid out with every node at 54 px while the nodes are taller must read an overlap.
 * Exit 1 on a control that reads nothing, and on any cut or overlap. Screenshots only with --shots, into that directory.
 *
 * WHAT IT IS NOT: Foundry's frame or stylesheet (the harness's capture, as style-harness.html says of itself), and the
 * fonts are what the module's sheets load here.
 */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import http from "node:http";
import { createRequire } from "node:module";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const args = process.argv.slice(2);
const shotsAt = args.indexOf("--shots");
const SHOTS = shotsAt >= 0 ? path.resolve(args[shotsAt + 1]) : null;
const DIRS = args.filter((a, i) => !a.startsWith("--") && !["--shots", "--chromium", "--ids", "--scale", "--width"].includes(args[i - 1])).map(d => path.resolve(d));
/* `--scale <n>` (E99 round 4): the screenshots' device scale (1 by default; 2 for shots a person reads). */
/* `--width <px>` (line P of 1.2.120): every window drawn at that width instead of its own, to read the toolbar narrow. */
const widthAt = args.indexOf("--width");
const WIDTH = widthAt >= 0 ? Number(args[widthAt + 1]) || null : null;
const scaleAt = args.indexOf("--scale");
const SCALE = scaleAt >= 0 ? Number(args[scaleAt + 1]) || 1 : 1;
/* `--ids <regexp>` (E99 round 4): which captures of the manifests are swept - the Map's by default, the trial console's
   (`class-trial--case`) with the schema in its middle when E99 asks. */
const idsAt = args.indexOf("--ids");
const IDS = new RegExp(idsAt >= 0 ? args[idsAt + 1] : "^investigation--map");
const SIZES = [[1366, 768], [1920, 1080]];
/* THE SCREEN'S HEIGHT CLASSES (E99 round 6): the module stamps `drpg-short` and `drpg-low` on the body from
   settings.mjs BREAKPOINTS (`applyTheme`); the page here stamps them the same way, the numbers read off that file. */
const BREAKS = Object.fromEntries([...fs.readFileSync(path.join(REPO, "scripts", "settings.mjs"), "utf8")
    .match(/export const BREAKPOINTS = \{([^}]*)\}/)?.[1].matchAll(/(\w+):\s*(\d+)/g) ?? []].map(m => [m[1], Number(m[2])]));
const heightClasses = vh => [vh < (BREAKS.short ?? 0) ? "drpg-short" : "", vh < (BREAKS.low ?? 0) ? "drpg-low" : ""].filter(Boolean).join(" ");
/* THE OWNER'S 11 PX (12.11, round 6, through the coordinator): while a Class Trial runs, under Stained Glass, at a height of
   800 px or less, the smallest node text after Fit to view is at least 11 px. Monokuma Legacy is left out: its smallest
   node text is 11 px at 100%, so any fit under 1 reads less (STATUS round 5). */
const MIN_TEXT = { px: 11, theme: "glass", maxHeight: 800 };
const THEMES = ["glass", "legacy"];
const { chromium } = createRequire(path.join(REPO, "audit", "harness", "package.json"))("playwright");

const TYPES = { ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".html": "text/html",
    ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".otf": "font/otf" };

/** A static server on the repository's root, and the capture directories under /captures/<n>/. */
function serve() {
    const server = http.createServer((req, res) => {
        const u = decodeURIComponent(new URL(req.url, "http://x").pathname);
        const m = u.match(/^\/captures\/(\d+)\/(.+)$/);
        const file = m ? path.join(DIRS[Number(m[1])], m[2]) : path.join(REPO, u);
        if (!file.startsWith(m ? DIRS[Number(m[1])] : REPO) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
        res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" });
        fs.createReadStream(file).pipe(res);
    });
    return new Promise(resolve => server.listen(0, "127.0.0.1", () => resolve(server)));
}

/** The page: the module's sheets, the capture framed as style-harness.html frames a kit window, the theme. */
function pageHtml(styles, html, title, width, theme, vh = 0) {
    const body = `${theme === "legacy" ? "drpg-theme-monokuma-legacy drpg-pixel-font" : "drpg-theme-stained-glass"} ${heightClasses(vh)}`.trim();
    return `<!doctype html><html lang="en"><head><meta charset="utf-8">${styles.map(s => `<link rel="stylesheet" href="/${s}">`).join("")}
<style>html, body.drpg-style-harness { background: #2a2430; } body.drpg-style-harness { margin: 0; padding: 16px; display: block; overflow: auto; min-height: 100vh; box-sizing: border-box; }
.drpg-style-shot > .application { position: relative; left: auto; top: auto; max-width: 100%; }</style></head>
<body class="${body} drpg-gm drpg-style-harness" data-drpg-time="afternoon" data-drpg-phase="dailyLife"><div class="drpg-style-shot" id="shot"></div>
<script>
  const holder = document.createElement("div");
  holder.innerHTML = ${JSON.stringify(html)}.trim();
  const app = holder.firstElementChild;
  if (app.classList.contains("drpg-ui") && !app.querySelector(":scope > .window-content")) {
    const section = document.createElement("section");
    section.className = "window-content";
    while (app.firstChild) section.appendChild(app.firstChild);
    app.appendChild(section);
  }
  app.insertAdjacentHTML("afterbegin", '<header class="window-header"><h1 class="window-title">' + ${JSON.stringify(title)} + '</h1></header>');
  ["left", "top", "height", "position", "z-index"].forEach(p => app.style.removeProperty(p));
  app.style.width = ${JSON.stringify(`${width}px`)};
  document.getElementById("shot").appendChild(app);
</script></body></html>`;
}

/* THE MAP'S SMALL TEXTS (line INVEST of 1.2.122; the owner's Map texts left from 1.2.120: the Chapter label, the "100%"
   zoom read-out, the legend and an open node's Name and Note fields drawn too small): the computed font size, in px, of
   the first drawn element of each, beside a node's fields' labels and selects to read them against. `null` where the page
   draws none. Each of the seven the owner named (`SMALL_TEXTS`) smaller than the fields' labels by more than half a pixel
   is a cut: under Stained Glass the labels stand at the theme's 21 px floor and these did not (13, 13, 11, 13, 13 and
   13.3 px at 21bf5d18). */
const SIZE_PARTS = {
    chapter: ".drpg-case-overview > summary strong", count: ".drpg-case-overview > summary .drpg-case-count", zoom: ".drpg-case-zoom",
    legend: ".drpg-case-legend-item", nameField: ".drpg-case-edit input[type=\"text\"]", noteField: ".drpg-case-edit textarea",
    slotHead: ".drpg-case-edit h5", difficulty: ".drpg-case-edit-field > strong", fieldLabel: ".drpg-case-edit-label", select: ".drpg-case-edit select", nodeName: ".drpg-case-node-name"
};
const SMALL_TEXTS = ["chapter", "zoom", "legend", "nameField", "noteField", "slotHead", "difficulty"];
async function readSizes(page) {
    return page.evaluate(parts => Object.fromEntries(Object.entries(parts).map(([k, sel]) => {
        const el = [...document.querySelectorAll(sel)].find(e => e.offsetWidth > 0 && e.offsetHeight > 0);
        return [k, el ? Math.round(parseFloat(getComputedStyle(el).fontSize) * 10) / 10 : null];
    })), SIZE_PARTS);
}

/** Read in the page: relayout through the module's code, then every node's cut and every pair's overlap. */
async function readMap(page, { plantBox = false, staleLayout = false, plantBar = false, plantNarrow = false, plantThrough = false, plantSmall = false } = {}) {
    return page.evaluate(async ({ plantBox, staleLayout, plantBar, plantNarrow, plantThrough, plantSmall }) => {
        // the toolbar read's control (line P of 1.2.120): the order's select planted at 9 px must read
        if (plantSmall) document.querySelector("select[data-drpg-case-sort]")?.style.setProperty("font-size", "9px", "important");
        // and its overlap read's (line P of 1.2.120): the tools' second control planted over their first must read; and its
        // rows read's: the order select planted 700 px wide must wrap the tools
        if (plantSmall) document.querySelector("select[data-drpg-case-sort]")?.style.setProperty("width", "700px", "important");
        if (plantSmall) {
            const [a, b] = [...document.querySelectorAll(".drpg-case-tools :is(button, select)")];
            if (a && b) { const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); b.style.transform = `translate(${ra.left - rb.left + 4}px, ${ra.top - rb.top}px)`; }
        }
        const V = await import("/scripts/case-view.mjs");
        await document.fonts.ready;
        if (plantBox) {
            const s = document.createElement("style");
            // the node rule's own selector (components.css), so the plant wins by coming later
            s.textContent = "body .application.drpg-ui.drpg-panel:is(.drpg-window-case, .drpg-window-trial) :is(.drpg-case-map, .drpg-case-trial) .drpg-case-canvas > button.drpg-case-node[data-drpg-node] { height: 54px; overflow: hidden; }"
                // every node open (owner-116): the faces are hidden, so the box is put back on the open fields too
                + " .application.drpg-window-case .drpg-case-canvas > .drpg-case-edit { height: 54px; overflow: hidden; }";
            document.head.appendChild(s);
        }
        if (plantNarrow) {
            const s = document.createElement("style");
            s.textContent = ".application.drpg-window-case .drpg-case-edit .drpg-case-edit-field textarea { width: 50% !important; }";
            document.head.appendChild(s);
        }
        const canvas = document.querySelector(".drpg-case-canvas");
        if (!canvas) return { error: "no canvas" };
        if (!staleLayout) { V.relayoutCaseMap(canvas); V.placeTileControls?.(canvas); }
        /* THE THROUGH READ'S CONTROL (line P of 1.2.120): a node that is no end of the first long horizontal stretch drawn
           moved onto it, face and fields, after the relayout - the read must name it */
        if (plantThrough) {
            for (const path of canvas.querySelectorAll(":scope > svg.drpg-case-edges path[data-drpg-ends]")) {
                const ends = JSON.parse(path.dataset.drpgEnds || "[]");
                const m = String(path.getAttribute("d")).match(/^M(-?[\d.]+) (-?[\d.]+) H(-?[\d.]+)/);
                if (!m || Math.abs(Number(m[3]) - Number(m[1])) < 60) continue;
                const other = [...canvas.querySelectorAll(":scope > button[data-drpg-node]")].find(b => !ends.includes(b.dataset.drpgNode));
                if (!other) break;
                const x = Math.min(Number(m[1]), Number(m[3])) + 20, y = Number(m[2]) - 10;
                for (const el of [other, canvas.querySelector(`:scope > .drpg-case-edit[data-drpg-edit="${CSS.escape(other.dataset.drpgNode)}"]`)]) {
                    if (el) { el.style.left = `${x}px`; el.style.top = `${y}px`; }
                }
                break;
            }
        }
        const nodes = [...canvas.querySelectorAll(":scope > button[data-drpg-node]")];
        const open = new Map([...canvas.querySelectorAll(":scope > .drpg-case-edit:not([hidden])")].map(f => [f.dataset.drpgEdit, f]));
        const cut = [];
        const over = (el, what) => {
            if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) cut.push(`${what}: content ${el.scrollWidth}x${el.scrollHeight} in ${el.clientWidth}x${el.clientHeight}`);
        };
        const boxes = [];
        for (const b of nodes) {
            const id = b.dataset.drpgNode;
            const r = b.getBoundingClientRect();
            /* The face's own content, not its scroll box: the glass's brush is a `::before` drawn 4-5 px outside every
               button (stained-glass.css section 7), which a button's scrollWidth counts and which cuts nothing. */
            const cb = { left: r.left + b.clientLeft, top: r.top + b.clientTop, right: r.left + b.clientLeft + b.clientWidth, bottom: r.top + b.clientTop + b.clientHeight };
            for (const kid of b.children) {
                const k = kid.getBoundingClientRect();
                if (k.left < cb.left - 0.5 || k.right > cb.right + 0.5 || k.top < cb.top - 0.5 || k.bottom > cb.bottom + 0.5) cut.push(`${id} ${kid.className}: past its node's box`);
            }
            for (const part of b.querySelectorAll(".drpg-case-node-kind, .drpg-case-node-mode, .drpg-case-node-state, .drpg-case-node-name, .drpg-case-node-text, .drpg-case-node-reach, .drpg-case-node-warn")) {
                const p = part.getBoundingClientRect();
                const cs = getComputedStyle(part);
                if (p.left < r.left - 0.5 || p.right > r.right + 0.5 || p.top < r.top - 0.5 || p.bottom > r.bottom + 0.5) cut.push(`${id} ${part.className}: leaves its node`);
                if (cs.textOverflow === "ellipsis" && part.scrollWidth > part.clientWidth) cut.push(`${id} ${part.className}: ellipsis`);
                if ((cs.webkitLineClamp && cs.webkitLineClamp !== "none") || part.scrollHeight > part.clientHeight + 1) cut.push(`${id} ${part.className}: clamped`);
            }
            const f = open.get(id);
            let box = { id, left: r.left, top: r.top, right: r.right, bottom: r.bottom };
            if (f) {
                over(f, `${id} fields`);
                /* EVERY FIELD THE NODE'S WIDTH (owner-116, 15.11.2026; the owner: "Pole wpisywania w planerze dalej jest
                   węższe niż powinno"): each text box and select of the open node as wide as its fields' content box (the
                   box less its padding), within 1 px. Red at e9f4a791 (1.2.115): under Stained Glass every select stood in
                   the theme's content-wide `.drpg-select` (chrome.mjs `dressSelect`), 39-207 px of 220, and a slot's
                   visibility and author in a content-wide `.drpg-key-plan-field` under Legacy (121 and 173). Layout widths,
                   so the same at every zoom of the camera. */
                const fcs = getComputedStyle(f);
                const inner = f.clientWidth - parseFloat(fcs.paddingLeft) - parseFloat(fcs.paddingRight);
                for (const el of f.querySelectorAll("input:not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=file]), textarea, select")) {
                    if (el.offsetWidth && el.offsetWidth < inner - 1) cut.push(`${id} ${el.name || el.tagName.toLowerCase()}: a field ${el.offsetWidth} px wide in ${Math.round(inner)}`);
                }
                const q = f.getBoundingClientRect();
                /* The open node is its editor since the owner's 12.11 at a table: its face hidden (`is-editing`), its fields at
                   the face's own place (`style.top` the same); before, the fields joined the face's bottom. */
                if (b.classList.contains("is-editing")) {
                    box = { id, left: q.left, top: q.top, right: q.right, bottom: q.bottom };
                    if (getComputedStyle(b).display !== "none") cut.push(`${id}: its face still drawn over its fields`);
                    if (Math.abs(parseFloat(f.style.top) - parseFloat(b.style.top)) > 0.5) cut.push(`${id} fields: ${Math.round(parseFloat(f.style.top) - parseFloat(b.style.top))} px from its node's place`);
                } else {
                    box = { id, left: Math.min(r.left, q.left), top: r.top, right: Math.max(r.right, q.right), bottom: Math.max(r.bottom, q.bottom) };
                    if (Math.abs(q.top - r.bottom) > 1.5) cut.push(`${id} fields: ${Math.round(q.top - r.bottom)} px from its node`);
                }
            }
            boxes.push(box);
        }
        /* THE TOOLBAR'S TWO SELECTS AT ONE SIZE (line P of 1.2.120; the owner's shots: "By hand" drawn tiny beside "Add a
           plan"): the order's select and the plan's, by their computed font size, within half a pixel. */
        {
            const sortSel = document.querySelector("select[data-drpg-case-sort]"), planSel = document.querySelector("select[data-drpg-case-add-plan]");
            if (sortSel && planSel) {
                const [a, b] = [sortSel, planSel].map(el => parseFloat(getComputedStyle(el).fontSize));
                if (Math.abs(a - b) > 0.5) cut.push(`toolbar: the order's select at ${a} px beside the plan's at ${b} px`);
            }
        }
        /* THE TOOLBAR'S CONTROLS APART AND INSIDE IT (line P of 1.2.120; the owner reported the toolbar overlapping): every
           button and select of the Map's tools (`.drpg-case-tools`) and the view switch above them, by their boxes - no two
           overlapping by more than half a pixel, none past the window's content box on either side. */
        {
            /* AND ON ONE ROW FROM 1000 PX (the coordinator, 21.11.2026: the order select's empty tail pushed "All open" to a row
               of its own): the tools' rows, a control joining the row whose vertical span it overlaps (buttons and selects
               of one row stand a few pixels apart in height); a window 1000 px wide or wider whose tools take two is a cut.
               1000, not 1100: at 1100 they took one row before the fix too; the wrap was at the harness's 1008 px window
               (two rows under Stained Glass before `field-sizing: content` on the order select, one after). */
            const toolRects = [...document.querySelectorAll(".drpg-case-tools :is(button, select)")].filter(el => el.offsetWidth > 0)
                .map(el => el.getBoundingClientRect()).sort((p, q) => p.top - q.top);
            const rows = [];
            for (const r of toolRects) {
                const row = rows.find(w => r.top < w.bottom - 0.5 && r.bottom > w.top + 0.5);
                if (row) { row.top = Math.min(row.top, r.top); row.bottom = Math.max(row.bottom, r.bottom); } else rows.push({ top: r.top, bottom: r.bottom });
            }
            window.__sweepToolRows = rows.length;
            const appWidth = document.querySelector(".application")?.offsetWidth ?? 0;
            if (appWidth >= 1000 && rows.length > 1) cut.push(`toolbar: ${rows.length} rows in a window ${appWidth} px wide`);
            const content = document.querySelector(".window-content")?.getBoundingClientRect();
            const controls = [...document.querySelectorAll(".drpg-case-tools :is(button, select), .drpg-case-switch-bar button")]
                .filter(el => el.offsetWidth > 0).map(el => ({ el, r: el.getBoundingClientRect(), name: el.textContent.trim().slice(0, 20) || el.className }));
            for (let i = 0; i < controls.length; i++) {
                const a = controls[i];
                if (content && (a.r.left < content.left - 0.5 || a.r.right > content.right + 0.5)) cut.push(`toolbar: ${a.name} past the window's edge`);
                for (let j = i + 1; j < controls.length; j++) {
                    const b = controls[j];
                    if (Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left) > 0.5 && Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top) > 0.5)
                        cut.push(`toolbar: ${a.name} over ${b.name}`);
                }
            }
        }
        /* NO LINE THROUGH A NODE (line P of 1.2.120; the owner: "Linie w planerze - niech omijaja nodes"): every drawn line's
           path, read back by its M, H, V and Q, against every node's box in the canvas's own pixels (a face with its open
           fields, as placed by the relayout above), its own two ends left out; a stretch inside a box by more than half a
           pixel is a cut. */
        {
            const boxOf = id => {
                const b = canvas.querySelector(`:scope > button[data-drpg-node="${CSS.escape(id)}"]`);
                const f = open.get(id);
                if (!b) return null;
                const faceShown = getComputedStyle(b).display !== "none";
                const x = parseFloat(b.style.left), y = parseFloat((faceShown ? b : f ?? b).style.top);
                const w = Math.max(faceShown ? b.offsetWidth : 0, f?.offsetWidth ?? 0);
                const h = (faceShown ? b.offsetHeight : 0) + (f ? f.offsetHeight : 0);
                return { x0: x, x1: x + w, y0: y, y1: y + h };
            };
            const boxes = new Map([...canvas.querySelectorAll(":scope > button[data-drpg-node]")].map(b => [b.dataset.drpgNode, boxOf(b.dataset.drpgNode)]));
            for (const path of canvas.querySelectorAll(":scope > svg.drpg-case-edges path[data-drpg-ends]")) {
                const [from, to] = JSON.parse(path.dataset.drpgEnds || "[]");
                let x = 0, y = 0;
                for (const c of String(path.getAttribute("d")).match(/[MHVQ][^MHVQ]*/g) ?? []) {
                    const v = c.slice(1).trim().split(/[\s,]+/).map(Number);
                    let seg = null;
                    if (c[0] === "M") [x, y] = v;
                    else if (c[0] === "H") { seg = { h: true, y, a: Math.min(x, v[0]), b: Math.max(x, v[0]) }; x = v[0]; }
                    else if (c[0] === "V") { seg = { h: false, x, a: Math.min(y, v[0]), b: Math.max(y, v[0]) }; y = v[0]; }
                    else if (c[0] === "Q") [x, y] = [v[2], v[3]];
                    if (!seg) continue;
                    for (const [id, q] of boxes) {
                        if (!q || id === from || id === to) continue;
                        const hit = seg.h ? seg.y > q.y0 + 0.5 && seg.y < q.y1 - 0.5 && Math.min(seg.b, q.x1) - Math.max(seg.a, q.x0) > 0.5
                            : seg.x > q.x0 + 0.5 && seg.x < q.x1 - 0.5 && Math.min(seg.b, q.y1) - Math.max(seg.a, q.y0) > 0.5;
                        if (hit) cut.push(`line ${from}>${to} through ${id}`);
                    }
                }
            }
        }
        /* THE TRIAL'S CONTROLS ON THEIR TILE (E99 round 4): each tick and start inside its tile's box, over none of the tile's
           words (kind, mode, state, name, text, reach, warning). */
        for (const c of canvas.querySelectorAll(":scope > [data-drpg-case-tick], :scope > [data-drpg-case-start-node]")) {
            const id = c.dataset.drpgCaseTick ?? c.dataset.drpgCaseStartNode;
            const tile = canvas.querySelector(`:scope > button[data-drpg-node="${CSS.escape(id)}"]`);
            if (!tile) { cut.push(`${id} control: no tile`); continue; }
            const t = tile.getBoundingClientRect(), k = c.getBoundingClientRect();
            if (k.left < t.left - 0.5 || k.right > t.right + 0.5 || k.top < t.top - 0.5 || k.bottom > t.bottom + 0.5) cut.push(`${id} ${c.className}: off its tile`);
            for (const part of tile.querySelectorAll(".drpg-case-node-kind, .drpg-case-node-mode, .drpg-case-node-state, .drpg-case-node-name, .drpg-case-node-text, .drpg-case-node-reach, .drpg-case-node-warn")) {
                const p = part.getBoundingClientRect();
                if (p.width && p.height && k.left < p.right - 0.5 && p.left < k.right - 0.5 && k.top < p.bottom - 0.5 && p.top < k.bottom - 0.5) cut.push(`${id} ${c.className}: over ${part.className}`);
            }
        }
        /* THE CAMERA'S BAR OVER NO NODE (E99 round 5): the bar's box against the part of each node the viewport shows, at rest
           and after Fit to view; the fit's scale and the smallest node text it leaves, for the owner's 11 px question. */
        const graphEl = canvas.closest(".drpg-case-graph");
        const bar = document.querySelector(".drpg-case-camera");
        /* WHAT A NODE IS ON SCREEN (owner-116, 15.11.2026): its face, or with every node open its fields - a hidden face's
           box is empty, so the bar's, the fold's and the fit's readings read the open fields too, and the controls plant on
           the first box drawn. */
        const drawn = [...nodes, ...open.values()].filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
        if (plantBar && bar && drawn[0]) {
            const r = drawn[0].getBoundingClientRect();
            Object.assign(bar.style, { position: "fixed", left: `${r.left + 4}px`, top: `${r.top + 4}px`, right: "auto", bottom: "auto" });
        }
        const barOver = when => {
            if (!bar || !graphEl) return;
            const b = bar.getBoundingClientRect(), g = graphEl.getBoundingClientRect();
            for (const n of drawn) {
                const r = n.getBoundingClientRect();
                const v = { left: Math.max(r.left, g.left), top: Math.max(r.top, g.top), right: Math.min(r.right, g.right), bottom: Math.min(r.bottom, g.bottom) };
                if (v.right - v.left < 1 || v.bottom - v.top < 1) continue;
                if (b.left < v.right - 0.5 && v.left < b.right - 0.5 && b.top < v.bottom - 0.5 && v.top < b.bottom - 0.5) cut.push(`camera bar over ${n.dataset.drpgNode ?? n.dataset.drpgEdit} (${when})`);
            }
        };
        barOver("at rest");
        let fit = null;
        if (graphEl && nodes.length) {
            const was = { transform: canvas.style.transform, transition: canvas.style.transition };
            canvas.style.transition = "none";
            let cam = null;
            V.wireCaseCamera(graphEl, { get: () => cam, set: c => { cam = c; } }).fit();
            canvas.classList.remove("is-easing");
            barOver("after fit");
            const z = cam?.z ?? 1;
            const sizes = drawn.flatMap(n => [...n.querySelectorAll(".drpg-case-node-kind, .drpg-case-node-mode, .drpg-case-node-state, .drpg-case-node-name, .drpg-case-node-text, .drpg-case-edit-label, summary, input, textarea, select")])
                .filter(el => (el.textContent.trim() || el.matches("input, textarea, select")) && el.getClientRects().length).map(el => parseFloat(getComputedStyle(el).fontSize) * z);
            fit = { z: Math.round(z * 1000) / 1000, minText: sizes.length ? Math.round(Math.min(...sizes) * 10) / 10 : null };
            canvas.style.transform = was.transform;
            canvas.style.transition = was.transition;
        }
        /* THE FOOTER IN VIEW, EVERY BUTTON WHOLE (round 6: the trial console's footer drawn compact on a low screen): each
           button of the window's footer inside the screen, its words (a text range: the glass brush counts in scrollWidth)
           inside its box, and its name not empty. */
        for (const b of document.querySelectorAll("footer.drpg-kit-footer button")) {
            const r = b.getBoundingClientRect();
            const name = (b.getAttribute("aria-label") || b.textContent || "").trim();
            if (!name) cut.push("footer: a button with no name");
            if (r.width < 2 || r.bottom > innerHeight + 0.5 || r.right > innerWidth + 0.5) cut.push(`footer: "${name}" out of view`);
            const g = document.createRange();
            g.selectNodeContents(b);
            const t = g.getBoundingClientRect();
            const L = r.left + b.clientLeft, T = r.top + b.clientTop;
            if (t.width && (t.left < L - 0.5 || t.right > L + b.clientWidth + 0.5 || t.top < T - 0.5 || t.bottom > T + b.clientHeight + 0.5)) cut.push(`footer: "${name}" cut`);
            /* AND NO WORD BROKEN ACROSS TWO LINES (line INVEST of 1.2.122; the owner: the planner footer's "Preview
               realization" broke mid-word at 600 px): each word of each text node a range, read on one line - its boxes
               all at one height. */
            const walker = document.createTreeWalker(b, 4); // NodeFilter.SHOW_TEXT
            for (let node = walker.nextNode(); node; node = walker.nextNode()) {
                for (const m of node.data.matchAll(/\S+/g)) {
                    const w = document.createRange();
                    w.setStart(node, m.index);
                    w.setEnd(node, m.index + m[0].length);
                    const tops = new Set([...w.getClientRects()].filter(q => q.width > 0.5).map(q => Math.round(q.top)));
                    if (tops.size > 1) cut.push(`footer: "${name}" breaks inside the word "${m[0]}"`);
                }
            }
        }
        const slotEl = document.querySelector("[data-drpg-trial-schema]");
        const slot = slotEl ? [Math.round(slotEl.clientWidth), Math.round(slotEl.clientHeight)] : null;
        /* THE FOLD (E99 round 5: "NIE ZWIĄZANE Z MORDERST" cut under glass in the trial's shot, which nothing here read): its
           words whole in its box, and its box over no node. */
        for (const fold of canvas.querySelectorAll(".drpg-case-gap > [data-drpg-case-fold]")) {
            // the words' own box (a text range), not the button's scroll box: the glass's brush is a `::before` 4-5 px
            // outside every button, which scrollWidth counts and which cuts nothing (as for the nodes, above)
            const f = fold.getBoundingClientRect();
            const words = document.createRange();
            words.selectNodeContents(fold);
            const t = words.getBoundingClientRect();
            const inner = { left: f.left + fold.clientLeft, top: f.top + fold.clientTop, right: f.left + fold.clientLeft + fold.clientWidth, bottom: f.top + fold.clientTop + fold.clientHeight };
            if (t.width && (t.left < inner.left - 0.5 || t.right > inner.right + 0.5 || t.top < inner.top - 0.5 || t.bottom > inner.bottom + 0.5))
                cut.push(`fold: words ${Math.round(t.width)}x${Math.round(t.height)} past its box ${Math.round(inner.right - inner.left)}x${Math.round(inner.bottom - inner.top)}`);
            for (const n of drawn) {
                const r = n.getBoundingClientRect();
                if (f.left < r.right - 0.5 && r.left < f.right - 0.5 && f.top < r.bottom - 0.5 && r.top < f.bottom - 0.5) cut.push(`fold over ${n.dataset.drpgNode ?? n.dataset.drpgEdit}`);
            }
        }
        const overlaps = [];
        for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
            const a = boxes[i], c = boxes[j];
            if (a.left < c.right - 0.5 && c.left < a.right - 0.5 && a.top < c.bottom - 0.5 && c.top < a.bottom - 0.5) overlaps.push(`${a.id} / ${c.id}`);
        }
        /* THE CAMERA'S REVEAL, as the Map runs it on a draw with a node open (case-map.mjs `wireCaseMap`): the open node's
           face and fields brought into the viewport, its face's top inside it. */
        const graph = document.querySelector(".drpg-case-graph");
        let revealed = null;
        if (open.size && graph) {
            let cam = null;
            const camera = V.wireCaseCamera(graph, { get: () => cam, set: c => { cam = c; } });
            camera.apply({ x: 0, y: 0, z: 1 });
            const [id, fields] = [...open.entries()][0];
            const faceEl = canvas.querySelector(`button[data-drpg-node="${CSS.escape(id)}"]`);
            camera.reveal([faceEl, fields]);
            // the face's place: its fields' top when the face is hidden (the open node is its editor)
            const g = graph.getBoundingClientRect(), f = (faceEl.classList.contains("is-editing") ? fields : faceEl).getBoundingClientRect();
            revealed = f.top >= g.top - 0.5 && f.top < g.bottom && f.left >= g.left - 0.5 && f.right <= g.right + 0.5;
            if (!revealed) cut.push(`${id}: not brought into view (face at ${Math.round(f.left - g.left)},${Math.round(f.top - g.top)} in ${Math.round(g.width)}x${Math.round(g.height)})`);
        }
        return { toolRows: window.__sweepToolRows ?? null, nodes: nodes.length, controls: canvas.querySelectorAll(":scope > [data-drpg-case-tick], :scope > [data-drpg-case-start-node]").length, revealed, open: [...open.keys()], tallest: Math.max(...boxes.map(b => Math.round(b.bottom - b.top))),
            viewport: graph ? [graph.clientWidth, graph.clientHeight] : null, canvas: [parseFloat(canvas.style.width), parseFloat(canvas.style.height)],
            measured: canvas.dataset.drpgMeasured ?? null, slot, fit, bar: Boolean(bar), cut, overlaps };
    }, { plantBox, staleLayout, plantBar, plantNarrow, plantThrough, plantSmall });
}

/* A NODE UNDER THE POINTER IS READ (line P of 1.2.120; the owner, 21.11.2026: "Po najechaniu myszka caly node robi sie
   bialy"). The first node face standing in the viewport is hovered by the pointer, and its name's ink is read by WCAG 2
   against the ground it is drawn on, composited as Chromium paints it: the first opaque ground of its ancestors, the
   node's own fill, then Stained Glass's brush (its `::before`, drawn behind the words) at the opacity it has under the
   pointer. Under AA 4.5 the page fails ("hover: ..."). Until the fix the brush was full cream under cream words (1.06:1).
   With `plant`, the brush is put back on every node under the pointer (the control: it must read under glass). */
async function readHover(page, { plant = false } = {}) {
    if (plant) await page.addStyleTag({ content: ".drpg-case-canvas > button.drpg-case-node[data-drpg-node]:hover { --brush-on: 1 !important; }" });
    const sel = await page.evaluate(() => {
        const g = document.querySelector(".drpg-case-graph")?.getBoundingClientRect();
        const face = [...document.querySelectorAll(".drpg-case-canvas > button.drpg-case-node[data-drpg-node]")].find(b => {
            if (getComputedStyle(b).display === "none") return false;
            const r = b.getBoundingClientRect();
            return g && r.width > 0 && r.top >= g.top && r.bottom <= g.bottom && r.left >= g.left && r.right <= g.right && r.bottom <= innerHeight && r.right <= innerWidth;
        });
        return face ? `.drpg-case-canvas > button.drpg-case-node[data-drpg-node="${CSS.escape(face.dataset.drpgNode)}"]` : null;
    });
    if (!sel) return null;
    await page.hover(sel);
    await page.waitForTimeout(300);
    const read = await page.evaluate(s => {
        const b = document.querySelector(s);
        const rgba = c => { const m = String(c).match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r, g, bl, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r, g, b: bl, a }; };
        const over = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 });
        let ground = { r: 0, g: 0, b: 0, a: 1 };
        const chain = [];
        for (let el = b.parentElement; el; el = el.parentElement) chain.push(el);
        const opaque = chain.findIndex(el => (rgba(getComputedStyle(el).backgroundColor)?.a ?? 0) >= 1);
        for (const el of (opaque >= 0 ? chain.slice(0, opaque + 1) : chain).reverse()) {
            const c = rgba(getComputedStyle(el).backgroundColor);
            if (c && c.a > 0) ground = over(c, ground);
        }
        const fill = rgba(getComputedStyle(b).backgroundColor);
        if (fill && fill.a > 0) ground = over(fill, ground);
        const pre = getComputedStyle(b, "::before");
        const brush = rgba(pre.backgroundColor);
        const shown = pre.content !== "none" && pre.display !== "none" ? Number(pre.opacity) : 0;
        if (brush && brush.a > 0 && shown > 0) ground = over({ ...brush, a: brush.a * shown }, ground);
        const name = b.querySelector(".drpg-case-node-name") ?? b;
        const ink = rgba(getComputedStyle(name).color);
        const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
        const inkOn = ink.a < 1 ? over(ink, ground) : ink;
        const [hi, lo] = [lum(inkOn), lum(ground)].sort((x, y) => y - x);
        return { id: b.dataset.drpgNode, ratio: Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100, brush: shown };
    }, sel);
    await page.mouse.move(0, 0);
    return read;
}

const server = await serve();
const base = `http://127.0.0.1:${server.address().port}`;
const styles = JSON.parse(fs.readFileSync(path.join(REPO, "module.json"), "utf8")).styles ?? [];
const chromeAt = args.indexOf("--chromium");
const browser = await chromium.launch(chromeAt >= 0 ? { executablePath: args[chromeAt + 1] } : {});
let failed = 0;
let fieldControlled = false;
const rows = [];
try {
    if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
    let controlled = false;
    for (const [, dir] of DIRS.entries()) {
        const manifest = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
        const lang = manifest.windows.find(w => w.lang)?.lang ?? "en";
        for (const w of manifest.windows.filter(x => x.captured && IDS.test(x.id))) {
            const html = fs.readFileSync(path.join(dir, w.file), "utf8");
            for (const theme of THEMES) for (const [vw, vh] of SIZES) {
                /* THE WIDTH FOUNDRY GIVES THE WINDOW (E99 round 5): the capture's is the harness's screen's (1008 px, its jsdom
                   screen less 8 px a side). The trial console asks 1280 px (trial-floor-ui.mjs `consoleWidth`), held by the kit
                   to the screen less 8 px a side (ui-kit.mjs `kitWidth`); the Map keeps the capture's width, as before. */
                const width = WIDTH ?? (/^class-trial/.test(w.id) ? Math.min(1280, vw - 16) : (w.width ?? 1120));
                const page = await browser.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: SHOTS ? SCALE : 1 });
                const load = async () => {
                    await page.route("**/case-map-sweep-page", r => r.fulfill({ contentType: "text/html", body: pageHtml(styles, html, w.title, width, theme, vh) }));
                    await page.goto(`${base}/case-map-sweep-page`);
                };
                await load();
                if (!controlled) {
                    // THE CONTROLS: the C5 box put back must read cut; the drawn places with taller nodes must read overlap
                    const box = await readMap(page, { plantBox: true });
                    await load();
                    const stale = await page.evaluate(() => { for (const b of document.querySelectorAll(".drpg-case-canvas > button[data-drpg-node]")) b.style.minHeight = "120px"; return true; })
                        .then(() => readMap(page, { staleLayout: true }));
                    await load();
                    const planted = await readMap(page, { plantBar: true });
                    const barRead = (planted.cut ?? []).filter(c => c.startsWith("camera bar over")).length;
                    await load();
                    const footHas = await page.evaluate(() => { const b = document.querySelector("footer.drpg-kit-footer button"); if (b) Object.assign(b.style, { position: "fixed", top: `${innerHeight + 40}px` }); return Boolean(b); });
                    const footRead = footHas ? ((await readMap(page)).cut ?? []).filter(c => c.startsWith("footer:")).length : 0;
                    const ok = box.cut?.length > 0 && stale.overlaps?.length > 0 && (!planted.bar || barRead > 0) && (!footHas || footRead > 0);
                    // the toolbar read's control (line P of 1.2.120): the order's select planted small must read
                    const small = await readMap(page, { plantSmall: true });
                    const smallRead = (small.cut ?? []).filter(c => c.startsWith("toolbar: the order's")).length
                        && (small.cut ?? []).filter(c => / over /.test(c) && c.startsWith("toolbar:")).length
                        && (small.cut ?? []).filter(c => / rows in a window /.test(c)).length;
                    const hasSelects = await page.evaluate(() => Boolean(document.querySelector("select[data-drpg-case-sort]") && document.querySelector("select[data-drpg-case-add-plan]")));
                    await load();
                    console.log(`control  ${!hasSelects || smallRead ? "ok  " : "FAIL"} the order's select planted at 9 px and a tool planted over another read ${hasSelects ? (small.cut ?? []).filter(c => c.startsWith("toolbar:")).length : "no toolbar on this page"} toolbar cut(s)`);
                    if (hasSelects && !smallRead) failed++;
                    // the through read's control (line P of 1.2.120): a node moved onto a drawn line must read
                    const onLine = await readMap(page, { plantThrough: true });
                    const throughRead = (onLine.cut ?? []).filter(c => c.startsWith("line ")).length;
                    await load();
                    console.log(`control  ${throughRead ? "ok  " : "FAIL"} a node moved onto a drawn line read ${throughRead} line(s) through a node`);
                    if (!throughRead) failed++;
                    // the hover's control (line P of 1.2.120): the brush planted back under the pointer must read, under glass
                    const plantedHover = theme === "glass" ? await readHover(page, { plant: true }) : null;
                    await load();
                    const hoverOk = theme !== "glass" || plantedHover === null || plantedHover.ratio < 4.5;
                    console.log(`control  ${hoverOk ? "ok  " : "FAIL"} the brush planted under the pointer read ${plantedHover ? `${plantedHover.ratio}:1 on ${plantedHover.id}` : "no face in view on this page"}`);
                    if (!hoverOk) failed++;
                    console.log(`control  ${ok ? "ok  " : "FAIL"} C5's box read ${box.cut?.length ?? 0} cut(s); the drawn places with 120 px nodes read ${stale.overlaps?.length ?? 0} overlap(s); the bar planted over a node read ${planted.bar ? barRead : "no bar on this page"}; a footer button put off the screen read ${footHas ? footRead : "no footer on this page"}`);
                    if (!ok) failed++;
                    controlled = true;
                    await load();
                }
                // on a page with a node open (the lanes page, line P of 1.2.120, opens none and comes first)
                if (!fieldControlled && /investigation--map-/.test(w.id) && await page.evaluate(() => Boolean(document.querySelector(".drpg-case-canvas > .drpg-case-edit:not([hidden])")))) {
                    // THE FIELDS' CONTROL (owner-116), on the first page with a node open: a text box planted at half the
                    // fields' width must read
                    const narrow = await readMap(page, { plantNarrow: true });
                    const read = (narrow.cut ?? []).filter(c => / px wide in /.test(c)).length;
                    console.log(`control  ${read ? "ok  " : "FAIL"} a text box planted at half its fields' width read ${read} narrow field(s) (${w.id})`);
                    if (!read) failed++;
                    fieldControlled = true;
                    await load();
                }
                const r = await readMap(page);
                r.sizes = await readSizes(page);
                for (const k of SMALL_TEXTS) {
                    if (r.sizes[k] !== null && r.sizes.fieldLabel !== null && r.sizes[k] < r.sizes.fieldLabel - 0.5) (r.cut ??= []).push(`size: ${k} at ${r.sizes[k]} px, under the fields' labels' ${r.sizes.fieldLabel} px`);
                }
                const hover = await readHover(page);
                r.hover = hover;
                if (hover && hover.ratio < 4.5) (r.cut ??= []).push(`hover: ${hover.id}'s name at ${hover.ratio}:1 under the pointer, under AA 4.5 (the brush at ${hover.brush})`);
                if (/^class-trial/.test(w.id) && (r.controls ?? 0) > 0 && theme === MIN_TEXT.theme && vh <= MIN_TEXT.maxHeight && r.fit && r.fit.minText < MIN_TEXT.px)
                    (r.cut ??= []).push(`fit text ${r.fit.minText} px under ${MIN_TEXT.px} (a trial runs, ${theme}, ${vh} px high)`);
                const bad = (r.cut?.length ?? 1) + (r.overlaps?.length ?? 0) + (r.error ? 1 : 0);
                if (bad) failed++;
                const line = `${bad ? "FAIL" : "ok  "} ${lang} ${theme.padEnd(6)} ${vw}x${vh} ${w.id.padEnd(25)} toolbar rows ${r.toolRows ?? "-"} hover ${r.hover ? `${r.hover.ratio}:1` : "-"} nodes ${r.nodes} controls ${r.controls ?? 0} open [${(r.open ?? []).join(",")}] tallest ${r.tallest} px, viewport ${r.viewport?.join("x")}, canvas ${r.canvas?.join("x")}, measured ${r.measured}${r.slot ? `, slot ${r.slot.join("x")}` : ""}${r.fit ? `, fit ${r.fit.z} text ${r.fit.minText} px` : ""}${r.revealed === null ? "" : `, revealed ${r.revealed}`}; cut ${r.cut?.length ?? "-"}, overlaps ${r.overlaps?.length ?? "-"}${r.error ? `; ${r.error}` : ""}`;
                console.log(line);
                console.log(`       sizes ${Object.entries(r.sizes ?? {}).map(([k, v]) => `${k} ${v ?? "-"}`).join(", ")}`);
                for (const c of [...(r.cut ?? []), ...(r.overlaps ?? []).map(o => `overlap ${o}`)]) console.log(`       ${c}`);
                rows.push({ lang, theme, size: `${vw}x${vh}`, id: w.id, width, ...r });
                if (SHOTS) {
                    // as the GM sees it (the camera at rest), then the whole canvas unclipped
                    await page.screenshot({ path: path.join(SHOTS, `${lang}-${theme}-${vw}x${vh}-${w.id}-view.png`) });
                    // the trial console's schema (E99): its slot scrolled into view, the camera at rest
                    if (await page.evaluate(() => { const slot = document.querySelector("[data-drpg-trial-schema]"); slot?.scrollIntoView({ block: "end" }); return Boolean(slot); }))
                        await page.screenshot({ path: path.join(SHOTS, `${lang}-${theme}-${vw}x${vh}-${w.id}-schema.png`) });
                    // after Fit to view (round 5): the case whole in the viewport, at the scale the row reports
                    if (await page.evaluate(async () => { const V = await import("/scripts/case-view.mjs"); const g = document.querySelector(".drpg-case-graph"), c = g?.querySelector(".drpg-case-canvas"); if (!g || !c) return false;
                        const before = c.style.transform; c.style.transition = "none"; let cam = null; V.wireCaseCamera(g, { get: () => cam, set: x => { cam = x; } }).fit(); c.classList.remove("is-easing");
                        const out = document.querySelector("[data-drpg-case-zoom-level]"); if (out) out.textContent = `${Math.round(cam.z * 100)}%`; window.__sweepBefore = before; return true; })) {
                        await page.screenshot({ path: path.join(SHOTS, `${lang}-${theme}-${vw}x${vh}-${w.id}-fit.png`) });
                        await page.evaluate(() => { const c = document.querySelector(".drpg-case-canvas"); if (c) c.style.transform = window.__sweepBefore; });
                    }
                    /* the whole canvas, unclipped: the camera put back to its origin first (line P of 1.2.120) - with the camera
                       moved to reveal an open node and the clip taken off, the canvas was drawn over the toolbar above it, in the
                       shot alone (the "-view" shot, the window as the GM sees it, clips it) */
                    await page.evaluate(() => { const c = document.querySelector(".drpg-case-canvas"); if (c) c.style.transform = "none"; });
                    await page.evaluate(() => { const g = document.querySelector(".drpg-case-graph"); if (g) { g.style.overflow = "visible"; g.style.height = `${parseFloat(document.querySelector(".drpg-case-canvas").style.height) + 4}px`; g.style.flex = "none"; } const v = document.querySelector(".drpg-case-view"); if (v) { v.style.height = "auto"; v.style.overflow = "visible"; } });
                    await page.screenshot({ path: path.join(SHOTS, `${lang}-${theme}-${vw}x${vh}-${w.id}.png`), fullPage: true });
                }
                await page.close();
            }
        }
    }
} finally {
    await browser.close();
    server.close();
}
if (!fieldControlled && rows.some(r => r.open?.length)) { console.log("control  FAIL the fields' control never ran on a page with a node open"); failed++; }
if (SHOTS) fs.writeFileSync(path.join(SHOTS, "sweep-rows.json"), JSON.stringify(rows, null, 1));
console.log(`case-map-sweep: ${rows.length} page(s), ${failed} failing`);
process.exitCode = failed ? 1 : 0;
