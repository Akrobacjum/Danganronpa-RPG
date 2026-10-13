/*
 * The glass harness at the 22 sizes, in Chromium: the curtain's self-check and the corner's
 * launchers, one line a size, and a non-zero exit when any size is not right.
 *
 *   cd audit/harness && npm ci        (once: Playwright comes from there; it downloads no browser)
 *   node audit/glass-sweep.mjs        (from the repository root)
 *
 * It serves the root itself the way "The curtain, without Foundry" in CLAUDE.md does
 * (`python3 -m http.server`, on a free port), or reads a server already running with
 * `--base http://127.0.0.1:8765`. Playwright finds its Chromium through
 * PLAYWRIGHT_BROWSERS_PATH; `--chromium <executable>` names one instead (written and run in a
 * container whose Chromium is /opt/pw-browsers/chromium, 13.10.2026).
 *
 * WHY THIS FILE EXISTS (E81 fix r2-H3, 13.10.2026). E81 C14 measured the corner at these sizes
 * with a sweep that lived in a scratch folder, so its numbers could not be run again by anybody
 * (review round 2, P26). This is that sweep, committed beside the page it drives. Each size is a
 * fresh load, as the E81 mockup's notes measured, in both themes by default.
 *
 * A size FAILS when it draws glass and any of overlaps, nonconvex, blockFails or edgeGaps is not
 * 0 (a `--known` reading excepted, at exactly that value), when `drpgLaunchOutside` is not ok
 * (its `why` is printed), when the launchers' gaps are not equal or fewer than two pairs are
 * neighbours, when the notice tile's button is missing, or when a size that is not the stack that
 * scrolls draws no glass at all - C14's m2 (no messenger.css) drew none on all 15 desk sizes and a
 * sweep that skipped those would have passed them.
 *
 * THE CONTROLS. A count that cannot see a fault measures nothing: the stackShapes lesson in
 * CLAUDE.md, and P26 itself, where the count returned the shape of a pass for an empty list. So
 * at the first size that draws glass the sweep plants each fault the count exists to see, reads
 * it at once, and puts the page back:
 *   moved     the handbooks button 300 px up        - stale, corners outside, not ok
 *   removed   the handbooks button out of the DOM   - found one fewer than expected, not ok
 *   hidden    every expected launcher display: none - all of them hidden, not ok
 *   gm moved  on a GM's page, the GM's button 8 px off its cell towards the wall (E77 C6) - its gaps
 *             to the chat and to Foundry tools no longer the gap, which this file fails as unequal
 *   straddle  the launch pane cut in two through the handbooks button's centre (LAST.panes
 *             only, the page untouched) - the button lies on both halves and on neither alone:
 *             corners outside, the cut still live, not ok
 *   frame     LAST.frame copied with a viewport 100 px wider than this one - stale, not ok
 * A control that reads as a pass fails the sweep.
 *
 * THE NOTICE STACK AND THE CORNER (E81 fix r2-H2, 13.10.2026). After the launchers, at every size, the page's
 * `drpgNoticeCheck` draws the module's own cards with popup.mjs on the tile and fails the size on any of: the stack's
 * ceiling under 96 px on a stacked screen, as it is or with a camera dock (P25); a shown card a sliver of its content
 * beside another, or the shown cards not fitting (P24, P9); a card of 400 words outside the tile or not scrolling where
 * the stack has a ceiling (P24's other road); a line of the bottom card's words, scrolled to its end, under the
 * history's button or its unread badge (P8, P7). Its `why` is printed. R299 reads the same inside Foundry only.
 * `--no-notices` leaves it out.
 *
 * THE ROOM TILE (E77 C4, 13.10.2026). Last at every size, in every role (`--roles`, the GM's page and `?role=player`),
 * the page's `drpgRoomCheck` reads where the curtain put the room tile and fails the size on any of: placed where
 * nothing is cut for it, or unplaced on a desk with glass; a place F does not choose; the tile laid out off the box
 * it was placed at; under the clock, not the clock's width, edge or turn; beside the notices, the foot off the notice
 * tile's, the gap not 32 + h x tan 8 deg, a corner of the history's button on the room's pane; the picture not on the
 * room's pane over the curtain; a new description or the description opened firing `drpgGlassCut` - and a taller clock
 * firing none, which is that count's own control. At the first placed size two more controls: the place stamp
 * swapped without a pass, and the tile taken out - each must read as not ok. `--no-room` leaves it out.
 *
 * FOUNDRY'S WINDOWS (E77 C5, 13.10.2026). After the room, at every size, the page's `drpgFoundryCut` fails the size on
 * the GM's page when either window is missing, open at load or not holding its rail, and - where glass is drawn -
 * when opening and closing both fires `drpgGlassCut` or changes the clip-path, or a taller clock fires none (the
 * count's own control); on a player's page when a frame exists or either rail has a box; on either, a desk with glass
 * whose notice tile was not fitted (no rail in the column leaves the fit to `moduleLayout`'s no-rail branch alone), or
 * fitted to NOTE_MIN under a room tile that stands under the clock (the column's drop at the wall not reserved).
 * Then the page's `drpgWindowsCheck` (E77 C7) on the GM's page: Foundry tools dragged by its title lands where
 * `clampPlace` puts the point and the setting holds it; the places P11 saved at 1920x1080 open wholly on the screen
 * and off the corner cluster, every cluster button reachable, the setting unwritten by the clamp; a focused field in
 * Foundry tools keeps its focus, text and caret through a pass of the glass. `raw` is its control: the same places
 * unclamped would stand off the screen or on the cluster, and the sweep fails if no GM size reads that. The line shows
 * `places`, the drag's end, both windows' boxes, `raw off|on` and `focus kept|LOST/<cuts>`.
 * `--no-windows` leaves both out.
 *
 * KNOWN: none since E77 C5. 1280x720 edgeGaps 16 was the reading glass.mjs explains ("WHAT THE
 * SKIP LEAVES BARE", E81 C14) - the strip's 160 px skip left the wall bare there. The sweep before
 * C5 (C4's, 13.10.2026) already read 0 at that size for both roles, and since C5 no rail stands at
 * that wall, so the strip is cut however short; C5's sweep reads 0. `--known 1280x720:eg=16` (or
 * any `<size>:<key>=<n>`) still exempts exactly that reading.
 *
 * usage: node audit/glass-sweep.mjs [--root <tree>] [--base <url>] [--page <path?query>]
 *          [--themes stained,legacy] [--sizes 1920x1080,...] [--known <size>:<ov|nc|bf|eg>=<n>,...]
 *          [--sel <launcher selector>] [--wait <ms after the glass, 2500>] [--shots <dir>] [--corner]
 *          [--chromium <executable>] [--no-control] [--no-notices] [--roles gm,player] [--no-room]
 *          [--no-windows]
 * `--corner` loads at twice the pixel density and `--shots` then keeps the bottom-right
 * 200x230 only; without it a shot is the full screen.
 */
import { createRequire } from "module";
import { spawn } from "child_process";
import { mkdirSync } from "fs";
import path from "path";
import url from "url";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf(k); return i < 0 ? null : args[i + 1]; };
const root = path.resolve(opt("--root") ?? path.join(HERE, ".."));
const page0 = opt("--page") ?? "audit/glass-harness.html";
const themes = (opt("--themes") ?? "stained,legacy").split(",").filter(Boolean);
const sel = opt("--sel");
const waitMs = Number(opt("--wait") ?? 2500);
const shots = opt("--shots"), corner = args.includes("--corner"), control = !args.includes("--no-control"), notices = !args.includes("--no-notices");
const roles = (opt("--roles") ?? "gm,player").split(",").filter(Boolean), rooms = !args.includes("--no-room");
const windows = !args.includes("--no-windows");
const known = Object.fromEntries((opt("--known") ?? "").split(",").filter(Boolean).map(k => {
    const [size, kv] = k.split(":"); const [key, v] = kv.split("=");
    return [size + "/" + key, Number(v)];
}));
const SIZES = (opt("--sizes") ?? "1920x1080,1366x768,2560x1440,1440x900,1536x864,1600x900,1680x1050,1280x800,1224x768,"
    + "1264x800,1300x768,1400x900,3840x2160,1920x1200,1024x768,1180x820,820x1180,768x1024,393x852,1280x720,844x390,640x360").split(",");
if (shots) mkdirSync(shots, { recursive: true });

let chromium;
try { ({ chromium } = createRequire(path.join(root, "audit", "harness", "package.json"))("playwright")); }
catch (err) { console.log(`glass-sweep: no Playwright under ${root}/audit/harness (npm ci there): ${err.message.split("\n")[0]}`); process.exit(2); }
let base = opt("--base"), srv = null;
if (!base) {
    const port = 20000 + Math.floor(Math.random() * 20000);
    srv = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" });
    base = `http://127.0.0.1:${port}`;
    await new Promise(r => setTimeout(r, 800));
}
let browser;
try { browser = await chromium.launch(opt("--chromium") ? { executablePath: opt("--chromium") } : {}); }
catch (err) { srv?.kill(); console.log(`glass-sweep: Chromium did not launch (--chromium <executable> names one): ${err.message.split("\n")[0]}`); process.exit(2); }

/* Runs in the page: the planted faults, each read at once and put back. Returns one entry a
   control: what it read and whether that is what the fault must read as. */
function plant(sel) {
    const read = () => window.drpgLaunchOutside(sel ?? undefined);
    const book = document.getElementById("drpg-book-launcher");
    /* The page's own count: three on a player's page, five on a GM's since E77 C6. */
    const before = read(), expected = before.expected;
    const all = ["drpg-messenger-launcher", "drpg-sound-launcher", "drpg-book-launcher", "drpg-gm-launcher", "drpg-foundry-tools"]
        .map(id => document.getElementById(id)).filter(Boolean).slice(0, expected);
    const res = {};
    const show = r => ({ ok: r.ok, found: r.found, expected: r.expected, hidden: r.hidden.length, outside: r.outside, stale: r.stale, why: r.why });
    {   // moved
        const was = book.style.getPropertyValue("bottom"), pr = book.style.getPropertyPriority("bottom");
        book.style.setProperty("bottom", (parseFloat(getComputedStyle(book).bottom) + 300) + "px", "important");
        const r = read();
        book.style.removeProperty("bottom"); if (was) book.style.setProperty("bottom", was, pr);
        res.moved = { ...show(r), pass: !r.ok && r.stale && r.outside > 0 && /stale/.test(r.why) };
    }
    {   // removed
        const parent = book.parentNode, next = book.nextSibling;
        book.remove();
        const r = read();
        parent.insertBefore(book, next);
        res.removed = { ...show(r), pass: !r.ok && r.found === expected - 1 && new RegExp(`found ${expected - 1} of`).test(r.why) };
    }
    {   // hidden
        const was = all.map(e => [e.style.getPropertyValue("display"), e.style.getPropertyPriority("display")]);
        all.forEach(e => e.style.setProperty("display", "none", "important"));
        const r = read();
        all.forEach((e, i) => { e.style.removeProperty("display"); if (was[i][0]) e.style.setProperty("display", was[i][0], was[i][1]); });
        res.hidden = { ...show(r), pass: !r.ok && all.length === expected && r.hidden.length === expected && /hidden/.test(r.why) };
    }
    const gm = document.getElementById("drpg-gm-launcher");
    if (gm && expected === 5) {   // gm moved: off its cell towards the wall, over the gap to Foundry tools
        const was = gm.style.getPropertyValue("right"), pr = gm.style.getPropertyPriority("right");
        gm.style.setProperty("right", (parseFloat(getComputedStyle(gm).right) - 8) + "px", "important");
        const r = read();
        gm.style.removeProperty("right"); if (was) gm.style.setProperty("right", was, pr);
        const gaps = r.gaps.filter(g => /drpg-gm-launcher/.test(g.pair)).map(g => g.pair + " " + g.gap);
        // the GM's pairs as read before the plant: each must read otherwise now, or be gone
        const off = before.gaps.filter(g => /drpg-gm-launcher/.test(g.pair)).length > 0
            && before.gaps.filter(g => /drpg-gm-launcher/.test(g.pair))
                .every(g => !r.gaps.some(h => h.pair === g.pair && Math.abs(h.gap - g.gap) <= 0.5));
        /* FAILED BY THE SWEEP'S OWN GAP RULE, NOT BY THE PAGE'S `ok`. The page's check reads which
           buttons stand on the launch pane, and 8 px stays on it: measured 13.10.2026 at 1920x1080
           under Stained Glass, `ok` true, not stale, chat-GM 1.16 and GM-tools 0.03. So the control
           asks what a size line asks (below): not ok, fewer than two pairs, or gaps unequal. */
        const gs = r.gaps.map(g => g.gap);
        const failed = !r.ok || gs.length < 2 || Math.max(...gs) - Math.min(...gs) > 0.1;
        res["gm moved"] = { ...show(r), why: r.why + " | " + gaps.join(", "), pass: failed && off };
    }
    {   // straddle
        const LAST = window.__glass.LAST, panes = LAST.panes;
        const at = document.getElementById("drpg-curtain").getBoundingClientRect(), b = book.getBoundingClientRect();
        const c = b.left + b.width / 2 - at.left, y = b.top + b.height / 2 - at.top;
        const inside = (poly, x, yy) => { let k = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > yy) !== (yj > yy) && x < (xj - xi) * (yy - yi) / (yj - yi) + xi) k = !k; } return k; };
        const cut = (poly, keep) => {
            const out = [];
            for (let i = 0; i < poly.length; i++) {
                const a = poly[i], z = poly[(i + 1) % poly.length];
                if (keep(a[0])) out.push(a);
                if (keep(a[0]) !== keep(z[0])) out.push([c, a[1] + (c - a[0]) / (z[0] - a[0]) * (z[1] - a[1])]);
            }
            return out;
        };
        const home = panes.findIndex(p => p.tone === "launch" && inside(p.poly, c, y));
        if (home < 0) res.straddle = { pass: false, why: "no launch pane under the handbooks button's centre" };
        else {
            LAST.panes = panes.flatMap((p, i) => i === home ? [{ ...p, poly: cut(p.poly, x => x <= c) }, { ...p, poly: cut(p.poly, x => x >= c) }] : [p]);
            const r = read();
            LAST.panes = panes;
            res.straddle = { ...show(r), pass: !r.ok && !r.stale && r.outside > 0 && /own launch pane/.test(r.why) };
        }
    }
    {   // frame
        const LAST = window.__glass.LAST, frame = LAST.frame;
        LAST.frame = { ...frame, inner: [innerWidth + 100, innerHeight] };
        const r = read();
        LAST.frame = frame;
        res.frame = { ...show(r), pass: !r.ok && r.stale && /viewport/.test(r.why) };
    }
    return res;
}

/* Runs in the page: the room check's two planted faults, each read at once and put back. */
async function plantRoom() {
    const tile = document.getElementById("drpg-room-tile"), res = {};
    {   // swapped: the stamp names the other place and no pass has run
        const was = tile.dataset.place;
        tile.dataset.place = was === "clock" ? "notes" : "clock";
        const r = await window.drpgRoomCheck({ cuts: false });
        tile.dataset.place = was;
        res.swapped = { ok: r.ok, why: r.why, pass: !r.ok && /place/.test(r.why) };
    }
    {   // removed
        const parent = tile.parentNode, next = tile.nextSibling;
        tile.remove();
        const r = await window.drpgRoomCheck({ cuts: false });
        parent.insertBefore(tile, next);
        res.removed = { ok: r.ok, why: r.why, pass: !r.ok && /no room tile/.test(r.why) };
    }
    return res;
}

let bad = 0, glassSizes = 0, controlled = false, roomControlled = false, placesControlled = false, placesRead = false;
try {
    for (const theme of themes) for (const role of roles) {
        const qs = [theme === "legacy" ? "theme=legacy" : "", role === "player" ? "role=player" : ""].filter(Boolean);
        const query = qs.length ? (page0.includes("?") ? "&" : "?") + qs.join("&") : "";
        for (const size of SIZES) {
            const [W, H] = size.split("x").map(Number);
            const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: corner ? 2 : 1 });
            const errs = [];
            page.on("pageerror", e => errs.push(e.message));
            await page.goto(`${base}/${page0}${query}`);
            await page.waitForFunction(() => window.__glass, null, { timeout: 15000 }).catch(() => {});
            await page.waitForTimeout(waitMs);
            const r = await page.evaluate(sel => {
                const g = window.__glass, c = g?.CHECKS?.at(-1) ?? null;
                return { c: c && { ov: c.overlaps, nc: c.nonconvex, bf: c.blockFails, eg: c.edgeGaps, ff: c.fitFails, n: c.count },
                         has: typeof window.drpgLaunchOutside === "function", lo: window.drpgLaunchOutside?.(sel ?? undefined) ?? null,
                         tile: !!document.getElementById("drpg-notices-corner"), stacked: document.body.classList.contains("drpg-stacked"),
                         report: g?.glassReport?.() ?? "" };
            }, sel);
            let line = `${theme.padEnd(7)} ${role.padEnd(6)} ${size.padEnd(10)}` + (r.stacked ? " stacked" : " desk   ");
            const fails = [];
            if (!r.has) fails.push("the page defines no drpgLaunchOutside");
            else if (!r.c) {
                line += " no glass (" + (r.report || "-").slice(0, 60) + ")";
                /* Only the stack that scrolls (844x390, 640x360) and the Legacy theme draw no glass by design -
                   `?theme=legacy` swaps the body's class, the curtain stays mounted at 0x0 and is cut for nothing
                   (13.10.2026, every size) - and there the count says it is no answer, and why, rather than a
                   number (P28: it returned null for three reasons). Under Legacy the three launchers are still
                   drawn, so they are still counted: found and none hidden. */
                const legacy = theme === "legacy";
                if (!legacy && !/^flat:/.test(r.report)) fails.push("no glass");
                if (!r.lo || r.lo.ok || !/no curtain|no pane toned launch/.test(r.lo.why)) fails.push("drpgLaunchOutside does not say why it is no answer: " + JSON.stringify(r.lo)?.slice(0, 80));
                else {
                    line += ` | found ${r.lo.found}/${r.lo.expected} hidden ${r.lo.hidden.length}`;
                    if (legacy && (r.lo.found !== r.lo.expected || r.lo.hidden.length)) fails.push(r.lo.why);
                }
            } else {
                glassSizes++;
                const c = r.c, lo = r.lo;
                line += ` panes ${c.n} ov ${c.ov} nc ${c.nc} bf ${c.bf} eg ${c.eg} ff ${c.ff}`
                    + ` | ${lo.ok ? "ok" : "NOT ok"} found ${lo.found}/${lo.expected} hidden ${lo.hidden.length} outside ${lo.outside}`
                    + ` (${lo.buttons} buttons, ${lo.corners} corners)${lo.stale ? " stale" : ""}`;
                const off = ["ov", "nc", "bf", "eg"].filter(k => c[k] && known[size + "/" + k] !== c[k]);
                if (off.length) fails.push("self-check " + off.join(","));
                else if (["ov", "nc", "bf", "eg"].some(k => c[k])) line += " (known)";
                if (!lo.ok) fails.push(lo.why);
                const gs = lo.gaps.map(g => g.gap);
                line += gs.length ? ` | gaps ${Math.min(...gs).toFixed(2)}-${Math.max(...gs).toFixed(2)} (${gs.length} pairs)` : " | gaps -";
                if (gs.length < 2) fails.push("fewer than 2 neighbour pairs");
                else if (Math.max(...gs) - Math.min(...gs) > 0.1) fails.push("gaps unequal " + lo.gaps.map(g => g.pair + " " + g.gap).join(", "));
                if (control && !controlled) {
                    controlled = true;
                    const ctl = await page.evaluate(plant, sel);
                    for (const [k, v] of Object.entries(ctl)) {
                        console.log(`  control ${k.padEnd(8)} ${v.pass ? "sees it" : "MISSES IT"}: ok ${v.ok} found ${v.found}/${v.expected} hidden ${v.hidden} outside ${v.outside} stale ${v.stale} - ${String(v.why).slice(0, 110)}`);
                        if (!v.pass) fails.push("control " + k + " reads as a pass");
                    }
                }
            }
            if (notices) {
                const n = await page.evaluate(() => window.drpgNoticeCheck?.() ?? null);
                if (!n) fails.push("the page defines no drpgNoticeCheck");
                else {
                    line += ` | notices ${n.ok ? "ok" : "NOT ok"}` + (n.ceiling ? ` ceiling ${n.ceiling.asIs.toFixed(0)}/${n.ceiling.docked.toFixed(0)}` : "")
                        + (n.stack ? ` shown ${n.stack.shown}+${n.stack.parked}` : "") + (n.long ? ` long ${n.long.judged ? (n.long.inTile && n.long.scrolls ? "in" : "OUT") : "unjudged"}` : "");
                    if (!n.ok) fails.push("notices: " + n.why);
                }
            }
            if (rooms) {
                const rc = await page.evaluate(() => window.drpgRoomCheck?.() ?? null);
                if (!rc) fails.push("the page defines no drpgRoomCheck");
                else {
                    line += ` | room ${rc.ok ? "ok" : "NOT ok"} ` + (rc.expect === "placed"
                        ? `${rc.place} F ${rc.F} need ${rc.need} max ${rc.maxH} box ${rc.box ? rc.box.w + "x" + rc.box.h : "-"}` : "unplaced")
                        + (rc.clock ? ` dx ${rc.clock.dx} rail +${rc.clock.rail}` : "") + (rc.notes ? ` gap ${rc.notes.gap}/${rc.notes.want} corner ${rc.notes.corner}` : "")
                        + (rc.cuts ? ` cuts ${rc.cuts.content}/${rc.cuts.control}/${rc.cuts.recolour}` : "");
                    if (!rc.ok) fails.push("room: " + rc.why);
                    if (theme !== "legacy" && r.c && !r.stacked && rc.expect !== "placed") fails.push("room: a desk with glass reads unplaced");
                    if (control && !roomControlled && rc.expect === "placed") {
                        roomControlled = true;
                        const ctl = await page.evaluate(plantRoom);
                        for (const [k, v] of Object.entries(ctl)) {
                            console.log(`  room control ${k.padEnd(8)} ${v.pass ? "sees it" : "MISSES IT"}: ok ${v.ok} - ${String(v.why).slice(0, 110)}`);
                            if (!v.pass) fails.push("room control " + k + " reads as a pass");
                        }
                    }
                }
            }
            if (windows) {
                const fc = await page.evaluate(() => window.drpgFoundryCut?.() ?? null);
                if (!fc) fails.push("the page defines no drpgFoundryCut");
                else {
                    line += ` | windows ${fc.ok ? "ok" : "NOT ok"} ${fc.expect}` + (fc.cuts ? ` cuts ${fc.cuts.open}/${fc.cuts.control}` : "") + (fc.fit ? ` fit ${fc.fit}` : "");
                    if (!fc.ok) fails.push("windows: " + fc.why);
                }
                const wc = await page.evaluate(() => window.drpgWindowsCheck?.() ?? null);
                if (!wc) fails.push("the page defines no drpgWindowsCheck");
                else {
                    const at = r => r ? `${r.x},${r.y} ${r.w}x${r.h}` : "-";
                    if (wc.expect === "windows") line += ` | places ${wc.ok ? "ok" : "NOT ok"} drag ${wc.drag?.to?.join(",") ?? "-"} ft ${at(wc.clamp?.ftools)} mt ${at(wc.clamp?.maptools)}`
                        + ` raw ${wc.raw ? "off" : "on"} focus ${wc.focus?.kept ? "kept" : "LOST"}/${wc.focus?.cuts ?? "-"}`;
                    if (!wc.ok) fails.push("places: " + wc.why);
                    if (wc.raw) placesControlled = true;
                    if (wc.expect === "windows") placesRead = true;
                }
            }
            if (!r.tile) fails.push("no #drpg-notices-corner");
            if (errs.length) line += " | pageerror " + errs[0].slice(0, 80);
            if (fails.length) { bad++; line += "  FAIL: " + fails.join("; "); }
            console.log(line);
            if (shots) {
                const file = `${shots}/${theme}-${role}-${size}${corner ? "-corner" : ""}.png`;
                await page.screenshot(corner ? { path: file, clip: { x: W - 200, y: H - 230, width: 200, height: 230 } } : { path: file });
            }
            await page.close();
        }
    }
} finally { await browser.close(); srv?.kill(); }
if (control && !controlled) { bad++; console.log("FAIL: the controls never ran (no size drew glass)"); }
if (control && rooms && !roomControlled) { bad++; console.log("FAIL: the room controls never ran (no size placed the tile)"); }
if (windows && placesRead && !placesControlled) { bad++; console.log("FAIL: the places' control never read an unclamped place off the screen or on the cluster"); }
console.log(`SWEEP ${bad ? "RED" : "GREEN"}: ${themes.length} theme(s) x ${roles.length} role(s) x ${SIZES.length} sizes, ${glassSizes} with glass, ${bad} failing`);
process.exit(bad ? 1 : 0);
