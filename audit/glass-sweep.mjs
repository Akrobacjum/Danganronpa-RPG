/*
 * The glass harness at the 23 sizes, in Chromium: the curtain's self-check and the corner's
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
 * THE NARROW ROW (E77 C8, 13.10.2026). At a stacked size the page's `drpgRoomCheck` expects `row`: the tile in the
 * stack's `#drpg-tile-row`, the row 44 px, the thumbnail 78x44, the words' button 44x44, a measured `tiles-row` block
 * on a pane where glass is drawn, and on the GM's page a Foundry window opened over the stack (`over`, with its own
 * control: the frame put under the stack). A stacked size that reads anything else fails. At the first stacked size
 * two more readings: the row set 60 px high must read as not ok (`plantRow`), and the page resized to 1920x1080 must
 * take the stack down with the tile back under the clock, or beside the notices where the curtain puts it there, and
 * the clock first in its column (narrow.mjs `restoreDesk`); the page is then put back at its own size.
 *
 * MONOKUMA LEGACY AND THE PINS (E77 fix r1-M1, 13.10.2026; review round 1's F6, G8 and O9). Under Legacy no curtain is
 * cut, and the tile's place and height come from glass.mjs `flatPlacement`: the same F, from the clock's foot to the
 * player list, and the same two places. A Legacy desk expects `flat` and fails on any of: no placement, or one that is
 * not flat; a place F does not choose; a second `roomPlacement` that answers otherwise; the tile laid off its box;
 * under the clock, not under it, not its width or edge, not min(F, max, cap) high, or less than 16 px above the player
 * list; beside the notices, not in the body 16 px right of the stack, level with its top, or off the screen; a new
 * description or the description opened moving the placement, while a taller clock moves it (that reading's
 * control); under the clock, `#players` made 60 px wider widening the column and the tile taking the column's width,
 * not the clock's (`wide tile/clock/column`; a column that did not widen fails as a control). Every line is
 * then compared with PINS below, in both themes and roles: a size whose place is not its pin fails, and so does a
 * size of the default list with no pin. The pin's control runs once a theme, at the first size pinned 'clock' that
 * reads it: the clock made F - need + 40 px taller, with no pass called (the module's own observers must move the
 * tile), must read another place, and the room check must hold there. A control that reads as the pin, or a theme
 * whose control never ran, fails the sweep.
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
 * E77 FIX r2-H3 (13.10.2026; review round 2's cor F2, cor F7, goal Rb, Q6, Q9 and fix r1-M1's open lines). 1366x657,
 * a 768 px screen less a browser's bars, is the one size with a height from 600 to 719; PINS has its place. A Foundry
 * window over the stack prints `over got/control/first`: `first` is the same point with the open frames moved before
 * #interface, where only their index keeps them on top - with narrow.css's index rule taken out, `got` still read
 * `frame` (the frames come after #interface in the body and won the tie by the tree alone), `first` reads the stack;
 * and each open frame's centre must hit a Foundry window. The row's "more" button is among the desk's parts the row
 * reading wants undrawn. A GM's Legacy line prints `face text/icon`: the stub sidebar's text in Foundry tools wears
 * the pixel face over the page's stand-in for Foundry's own, its icon Font Awesome. Legacy's notes place, reached by
 * the pin control, prints `right` and fails under 16 px before Foundry's right column: at 1920x1080 the control read
 * the tile 430 wide and 165 px into `#ui-right-column-1` before the fix, 249x389 and right 16 after it. The launchers'
 * controls answer "not applicable" when every line is Legacy's with no curtain (below, at the end).
 * Read on the same page by hand on 13.10.2026 and not lines of this sweep: Q6 - the GM's roster on the stack's foot
 * covered drawn pixels of the GM's button and Foundry tools (danganronpa.css `--drpg-roster-foot` has the numbers;
 * R474 reads its foot), and the messenger's unread badge ("3" and "99+") covers none of the other buttons' in either
 * theme at 1920x1080, 1366x768 and 1024x768; Q9 - at 1024x768 under Stained Glass the clock's column ends at 407 and
 * scrolls (425 over 399), the last project's header at 398-422, past its end, and, scrolled to the end, at 372-396
 * inside it and answering `elementFromPoint`; under Monokuma Legacy the column ends at 377, the header at 335-348,
 * with nothing to scroll; a GM and a player alike.
 *
 * KNOWN: none since E77 C5. 1280x720 edgeGaps 16 was the reading glass.mjs explains ("WHAT THE
 * SKIP LEAVES BARE", E81 C14) - the strip's 160 px skip left the wall bare there. The sweep before
 * C5 (C4's, 13.10.2026) already read 0 at that size for both roles, and since C5 no rail stands at
 * that wall, so the strip is cut however short; C5's sweep reads 0. `--known 1280x720:eg=16` (or
 * any `<size>:<key>=<n>`) still exempts exactly that reading.
 *
 * THE VOICE TILE (E78 C6, 14.10.2026). The page's `drpgVoiceCheck` fails a size on any of: on a desk with glass, the
 * tile not at the box the cut settled, its pane missing or painted empty, the portrait not on the body at the pane's box
 * and outline, a pane over `voice-left`, a strip shard at a right wall with no rail, a long name, the face or the fade
 * firing a drpgGlassCut (the control: the tile taken away and back fires one each way); stacked, the tile and the room
 * tile not both in the row, the portrait not inside the tile, the tile off the screen. Once per run (`--no-voice` drops
 * it all) the page is loaded without Foundry's sidebar tabs, and again with glass.mjs's spare band put back (S12-95).
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
const windows = !args.includes("--no-windows"), voices = !args.includes("--no-voice");
const known = Object.fromEntries((opt("--known") ?? "").split(",").filter(Boolean).map(k => {
    const [size, kv] = k.split(":"); const [key, v] = kv.split("=");
    return [size + "/" + key, Number(v)];
}));
const SIZES = (opt("--sizes") ?? "1920x1080,1366x768,2560x1440,1440x900,1536x864,1600x900,1680x1050,1280x800,1224x768,"
    + "1264x800,1300x768,1400x900,3840x2160,1920x1200,1024x768,1180x820,820x1180,768x1024,393x852,1280x720,1366x657,844x390,640x360").split(",");
/* THE PINS (E77 fix r1-M1, 13.10.2026; review round 1's O9): the place each size reads, as this file read it on
   e77-wip after E77 C9 and the side fix line (ceb70a4) with fix r1-M1 on it, in Chromium, GM and player alike -
   'row' on a stacked screen (E77 C8), 'notes' where Stained Glass's F leaves less than the smallest box (F 194 at
   1366x768, 1224x768 and 1300x768, 226 at 1280x800 and 1264x800 against need 233, 146 at 1280x720), 'clock'
   everywhere else; under Monokuma Legacy every desk size reads 'clock' (F 489 to 1899 against need 310). A
   reading that moves is a design change: say why in the commit that moves the pin. 1366x657 (fix r2-H3, review
   round 2's goal Rb), read on fix r2-H3's tree: 'notes' under Stained Glass (F 83, box 301x321) and 'clock' under
   Monokuma Legacy (F 426, box 430x426), a GM and a player alike. */
const PIN_ROW = ["1024x768", "1180x820", "820x1180", "768x1024", "393x852", "844x390", "640x360"];
const PIN_NOTES = { stained: ["1366x768", "1280x800", "1224x768", "1264x800", "1300x768", "1280x720", "1366x657"], legacy: [] };
const PINS = Object.fromEntries(["stained", "legacy"].flatMap(theme => ["gm", "player"].flatMap(role =>
    ("1920x1080,1366x768,2560x1440,1440x900,1536x864,1600x900,1680x1050,1280x800,1224x768,1264x800,1300x768,1400x900,3840x2160,"
        + "1920x1200,1024x768,1180x820,820x1180,768x1024,393x852,1280x720,1366x657,844x390,640x360").split(",").map(size =>
        [`${theme} ${role} ${size}`, PIN_ROW.includes(size) ? "row" : PIN_NOTES[theme].includes(size) ? "notes" : "clock"]))));
/* THE BOX PINS (E78 C0, 13.10.2026; the owner's decision of 13.10: the room tile is too large beside the notices
   and under Monokuma Legacy, and under Stained Glass's clock it stays exactly as it is): each desk size's room box,
   width x height, a GM and a player alike. The 'clock' rows of Stained Glass are 1.2.76's own (this file on dcfc31b,
   in Chromium, 13.10.2026: SWEEP GREEN, 711 s), and C0 must not move them; the 'notes' rows of Stained Glass and
   every Legacy row are C0's, read the same day on C0's tree with the cap of glass.mjs `roomCapH` - beside the notices
   301x376 became 301x259 at 1366x768, 1224x768 and 1300x768, 301x384 became 301x270 at 1280x800 and 1264x800,
   301x352 and 301x321 became 301x245 (the floor at `need`) at 1280x720 and 1366x657; under Legacy 430x491 became
   430x364 at 1920x1080, 430x310 (the floor) at ten sizes, 430x485, 430x354 and 430x404 at 2560x1440, 1680x1050 and
   1920x1200, and 3840x2160 kept 430x491 (its maxH is below the cap). Every self-check (ov, nc, bf, eg, ff) and
   every place read the same before and after. The harness's own room check reads the height against
   min(F, maxH, cap) with glass.mjs's function, so these numbers are the one reading that does not go through the
   code it checks. A box that moves is a design change: say why in the commit that moves the pin. */
const BOX = {
    "stained 1920x1080": "265x364", "stained 1366x768": "301x259", "stained 2560x1440": "312x425", "stained 1440x900": "265x302",
    "stained 1536x864": "265x266", "stained 1600x900": "265x302", "stained 1680x1050": "265x364", "stained 1280x800": "301x270",
    "stained 1224x768": "301x259", "stained 1264x800": "301x270", "stained 1300x768": "301x259", "stained 1400x900": "265x302",
    "stained 3840x2160": "312x425", "stained 1920x1200": "265x364", "stained 1280x720": "301x245", "stained 1366x657": "301x245",
    "legacy 1920x1080": "430x364", "legacy 1366x768": "430x310", "legacy 2560x1440": "430x485", "legacy 1440x900": "430x310",
    "legacy 1536x864": "430x310", "legacy 1600x900": "430x310", "legacy 1680x1050": "430x354", "legacy 1280x800": "430x310",
    "legacy 1224x768": "430x310", "legacy 1264x800": "430x310", "legacy 1300x768": "430x310", "legacy 1400x900": "430x310",
    "legacy 3840x2160": "430x491", "legacy 1920x1200": "430x404", "legacy 1280x720": "430x310", "legacy 1366x657": "430x310"
};
const PIN_BOX = Object.fromEntries(Object.entries(BOX).flatMap(([key, box]) => {
    const [theme, size] = key.split(" ");
    return ["gm", "player"].map(role => [`${theme} ${role} ${size}`, box]);
}));
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

/* Runs in the page: the pin's control (E77 fix r1-M1) - the clock made `px` taller (its own min-height, which wins
   over a max-height), so F falls 40 px short of the smallest box; the place read and the room check run at that
   other place (under Legacy the only reading of its place beside the notices: no size of the sweep reaches it), and
   the page put back. Nothing here calls a pass: the clock changing size is what must move the tile, through the
   module's own observers (Stained Glass's on its blocks, `schedule`; Legacy's on the clock and its neighbours,
   `placeFlatRoomTile`), as at a table where nobody calls one either. The wait covers the turn as well: the move
   recuts the curtain, and for the turn's length the old curtain's ghost stands between the picture and its glow -
   read at 1500 ms the room check failed on exactly that, and from 2000 ms on the order was back (Stained,
   1920x1080, 13.10.2026). */
async function plantPin(px) {
    const hud = document.getElementById("drpg-hud"), g = window.__glass, tile = document.getElementById("drpg-room-tile");
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const pass = async () => { await wait(1500); for (let i = 0; i < 50 && document.querySelector(".drpg-curtain-ghost"); i++) await wait(100); };
    hud.style.setProperty("max-height", "none", "important"); hud.style.setProperty("min-height", (hud.offsetHeight + px) + "px", "important");
    await pass();
    const res = { px, got: tile?.dataset.place ?? "-", F: g.LAST.room?.F ?? null, check: await window.drpgRoomCheck({ cuts: false }) };
    hud.style.removeProperty("min-height"); hud.style.removeProperty("max-height");
    await pass();
    return res;
}

/* Runs in the page: the row reading's planted fault, read at once and put back (E77 C8). */
async function plantRow() {
    const row = document.getElementById("drpg-tile-row"), was = row?.style.height ?? "";
    if (row) row.style.height = "60px";
    const r = await window.drpgRoomCheck({ cuts: false });
    if (row) row.style.height = was;
    return { tall: { ok: r.ok, why: r.why, pass: !r.ok && /the row is 60 px/.test(r.why) } };
}

/* Runs in the page after a resize to a desk: the stack taken down and the tile and the clock back (E77 C8). */
function deskAgain() {
    const tile = document.getElementById("drpg-room-tile"), hud = document.getElementById("drpg-hud"), left = document.getElementById("ui-left-column-1");
    const prev = tile?.previousElementSibling;
    const under = prev === hud || (prev?.id === "drpg-floors" && prev.previousElementSibling === hud);
    const got = { column: Boolean(document.getElementById("drpg-column")), row: Boolean(document.getElementById("drpg-tile-row")),
        place: tile?.dataset.place ?? null, tile: tile?.parentElement === document.body ? "body" : under ? "under the clock" : (prev?.id || tile?.parentElement?.id || "gone"),
        clockFirst: hud?.parentElement === left && left.firstElementChild === hud };
    const ok = !got.column && !got.row && got.clockFirst && (got.place === "notes" ? got.tile === "body" : got.tile === "under the clock");
    return { ok, why: JSON.stringify(got), pass: ok };
}

let lines = 0, themeOff = 0, bad = 0, glassSizes = 0, controlled = false, roomControlled = new Set(), pinControlled = new Set(), unpinned = 0, unboxed = 0, rowControlled = false, stackedRead = false, placesControlled = false, placesRead = false, voiceRead = false;
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
            lines++;
            const fails = [];
            if (!r.has) fails.push("the page defines no drpgLaunchOutside");
            else if (!r.c) {
                line += " no glass (" + (r.report || "-").slice(0, 60) + ")";
                /* Only the stack that scrolls (844x390, 640x360) and the Legacy theme draw no glass by design -
                   `?theme=legacy` swaps the body's class, and until E77 fix r1-M1 the curtain stayed mounted at
                   0x0 and was cut for nothing (13.10.2026, every size); since then the page's theme setting is
                   Legacy as well and no curtain is mounted ("theme off") - and there the count says it is no
                   answer, and why, rather than a number (P28: it returned null for three reasons). Under Legacy
                   the three launchers are still drawn, so they are still counted: found and none hidden. */
                const legacy = theme === "legacy";
                if (legacy && /theme off/.test(r.report)) themeOff++;
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
                    const rw = rc.row;
                    line += ` | room ${rc.ok ? "ok" : "NOT ok"} ` + (rc.expect === "placed" || rc.expect === "flat"
                        ? `${rc.expect === "flat" ? "flat " : ""}${rc.place} F ${rc.F} need ${rc.need} max ${rc.maxH} box ${rc.box ? rc.box.w + "x" + rc.box.h : "-"}`
                        : rc.expect === "row" ? `row ${rw.h} thumb ${rw.thumb?.join("x") ?? "-"} words ${rw.words?.join("x") ?? "-"} block ${rw.block?.h ?? "-"}`
                            + (rw.over ? ` over ${rw.over.got}/${rw.over.control}/${rw.over.first}` : "") : "unplaced")
                        + (rc.clock ? ` dx ${rc.clock.dx} rail +${rc.clock.rail}` : "") + (rc.notes ? ` gap ${rc.notes.gap}/${rc.notes.want} corner ${rc.notes.corner}` : "")
                        + (rc.flat ? (rc.place === "clock" ? ` players +${rc.flat.players ?? "-"}${rc.flat.wide ? " wide " + rc.flat.wide.join("/") : ""}` : ` gap ${rc.flat.gap}/16 top ${rc.flat.top} right ${rc.flat.right ?? "-"}`) : "")
                        + (rc.cuts ? ` cuts ${rc.cuts.content}/${rc.cuts.control}/${rc.cuts.recolour}` : "");
                    if (!rc.ok) fails.push("room: " + rc.why);
                    if (theme !== "legacy" && r.c && !r.stacked && rc.expect !== "placed") fails.push("room: a desk with glass reads unplaced");
                    if (theme === "legacy" && !r.stacked && rc.expect !== "flat") fails.push(`room: a Legacy desk reads ${rc.expect}, not placed without a curtain`);
                    /* THE PIN (E77 fix r1-M1, review round 1's O9). The place F chooses at this size, theme and role,
                       as PINS records it: a change of F that moves a size to the other place is a red line here,
                       not a silent one - drpgRoomCheck checks the place against F, and F against nothing. */
                    const got = rc.expect === "row" ? "row" : rc.place ?? "-", pin = PINS[`${theme} ${role} ${size}`];
                    line += pin ? (pin === got ? " | pin ok" : ` | pin ${got}/${pin}`) : " | unpinned";
                    if (pin && pin !== got) fails.push(`room: ${got} where PINS has ${pin}`);
                    if (!pin) unpinned++;
                    /* THE BOX PIN (E78 C0): a placed tile's width and height, as PIN_BOX records them. */
                    const boxPin = PIN_BOX[`${theme} ${role} ${size}`], box = rc.box ? `${rc.box.w}x${rc.box.h}` : "-";
                    if (rc.expect === "placed" || rc.expect === "flat") {
                        line += boxPin ? (boxPin === box ? " | box pin ok" : ` | box ${box}/${boxPin}`) : " | box unpinned";
                        if (boxPin && boxPin !== box) fails.push(`room: box ${box} where PIN_BOX has ${boxPin}`);
                        if (!boxPin) unboxed++;
                    }
                    if (control && !pinControlled.has(theme) && pin === "clock" && got === "clock") {
                        pinControlled.add(theme);
                        const v = await page.evaluate(plantPin, rc.F - rc.need + 40);
                        console.log(`  pin control ${theme.padEnd(8)} ${v.got !== pin ? "sees it" : "MISSES IT"}: a clock ${v.px} px taller reads ${v.got} (F ${v.F}) where PINS has ${pin}`
                            + ` - and there: room ${v.check.ok ? "ok" : "NOT ok"} ${v.check.box ? v.check.box.w + "x" + v.check.box.h : "-"}${v.check.flat ? ` gap ${v.check.flat.gap}/16 top ${v.check.flat.top} right ${v.check.flat.right ?? "-"}` : ""} ${String(v.check.why).slice(0, 110)}`);
                        if (v.got === pin) fails.push("pin control reads as a pass");
                        /* and the box (E78 C0): at the other place the tile's box must not read as this size's pin */
                        const other = v.check.box ? `${v.check.box.w}x${v.check.box.h}` : "-";
                        console.log(`  box control ${theme.padEnd(8)} ${other !== boxPin ? "sees it" : "MISSES IT"}: there the box reads ${other} where PIN_BOX has ${boxPin ?? "none"}`);
                        if (!boxPin || other === boxPin) fails.push("box pin control reads as a pass");
                        if (!v.check.ok) fails.push("room, at the pin control's other place: " + v.check.why);
                    }
                    if (r.stacked) stackedRead = true;
                    if (r.stacked && rc.expect !== "row") fails.push("room: a stacked screen reads no row");
                    if (control && !rowControlled && rc.expect === "row") {
                        rowControlled = true;
                        const ctl = await page.evaluate(plantRow);
                        await page.setViewportSize({ width: 1920, height: 1080 });
                        await page.waitForTimeout(waitMs);
                        ctl.desk = await page.evaluate(deskAgain);
                        await page.setViewportSize({ width: W, height: H });
                        await page.waitForTimeout(waitMs);
                        for (const [k, v] of Object.entries(ctl)) {
                            const said = k === "desk" ? (v.pass ? "holds" : "BROKEN") : v.pass ? "sees it" : "MISSES IT";
                            console.log(`  row control ${k.padEnd(8)} ${said}: ok ${v.ok} - ${String(v.why).slice(0, 110)}`);
                            if (!v.pass) fails.push(k === "desk" ? "the desk after the stack: " + v.why : "row control " + k + " reads as a pass");
                        }
                    }
                    if (control && !roomControlled.has(rc.expect) && (rc.expect === "placed" || rc.expect === "flat")) {
                        roomControlled.add(rc.expect);
                        const ctl = await page.evaluate(plantRoom);
                        for (const [k, v] of Object.entries(ctl)) {
                            console.log(`  room control ${k.padEnd(8)} ${v.pass ? "sees it" : "MISSES IT"}: ok ${v.ok} - ${String(v.why).slice(0, 110)}`);
                            if (!v.pass) fails.push("room control " + k + " reads as a pass");
                        }
                    }
                }
            }
            if (voices) {
                const vc = await page.evaluate(() => window.drpgVoiceCheck?.() ?? null);
                if (!vc) fails.push("the page defines no drpgVoiceCheck");
                else {
                    line += ` | voice ${vc.ok ? "ok" : "NOT ok"} ${vc.expect}` + (vc.box ? ` ${vc.box} open ${vc.open} shards ${vc.shards}` : "")
                        + (vc.cuts ? ` cuts ${vc.cuts.speech}/${vc.cuts.control.join("+")}` : "") + (vc.row ? ` row ${vc.row.box.join(",")}` : "");
                    if (!vc.ok) fails.push("voice: " + vc.why);
                    if (theme !== "legacy" && r.c && !r.stacked && vc.expect !== "wall") fails.push(`voice: a desk with glass reads ${vc.expect}`);
                    if (vc.expect === "wall") voiceRead = true;
                }
            }
            if (windows) {
                const fc = await page.evaluate(() => window.drpgFoundryCut?.() ?? null);
                if (!fc) fails.push("the page defines no drpgFoundryCut");
                else {
                    line += ` | windows ${fc.ok ? "ok" : "NOT ok"} ${fc.expect}` + (fc.cuts ? ` cuts ${fc.cuts.open}/${fc.cuts.control}` : "") + (fc.fit ? ` fit ${fc.fit}` : "")
                        + (fc.face ? ` face ${fc.face.text}/${fc.face.icon}` : "");
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
    /* NO SPARE STRIP AT A RIGHT WALL WITH NO RAIL (E78 C6, S12-95). The harness's page always has Foundry's
       sidebar tabs, and the curtain is not recut for a rail taken away from a page already loaded (CLAUDE.md), so
       the page is loaded without them - the response rewritten - once as it is and once with glass.mjs's
       no-rail branch put back to the spare band (the control). Without the voice tile too: the shard stood under
       the tray, where the voice tile's pane now drops it (14.10.2026, the desk's cut on 1920x1080 blocks: the shard
       1791..1920 x 263..642 without the tile, none with it), so a page with the tile could not see the shard
       come back. Read at 1920x1080 for a player, Stained Glass. */
    if (voices && control && themes.includes("stained")) {
        const railless = async patch => {
            const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
            const fix = { page: false, glass: !patch };
            await page.route(/glass-harness\.html/, async route => { const res = await route.fetch(), t = await res.text();
                const body = t.replace(/<nav id="sidebar-tabs">[\s\S]*?<\/nav>/, "").replace(/<section id="drpg-voice-tile"[\s\S]*?<\/section>/, "");
                fix.page = !body.includes('id="sidebar-tabs"') && !body.includes('id="drpg-voice-tile"'); await route.fulfill({ response: res, body }); });
            if (patch) await page.route(/scripts\/glass\.mjs/, async route => { const res = await route.fetch(), t = await res.text();
                const body = t.replace("railed || !side ? tb : null", "tb"); fix.glass = body !== t; await route.fulfill({ response: res, body }); });
            await page.goto(`${base}/${page0}${page0.includes("?") ? "&" : "?"}role=player`);
            await page.waitForFunction(() => window.__glass, null, { timeout: 15000 }).catch(() => {});
            await page.waitForTimeout(waitMs);
            const got = await page.evaluate(() => ({ rail: Boolean(document.getElementById("sidebar-tabs")), cut: Boolean(window.__glass?.LAST?.panes?.length),
                shards: (window.__glass?.LAST?.panes ?? []).filter(p => p.shard && p.x1 > innerWidth / 2).length }));
            await page.close();
            return { ...got, ...fix };
        };
        const [as, back] = [await railless(false), await railless(true)];
        const said = v => `rail and voice tile ${v.rail ? "STILL THERE" : "gone"}, ${v.cut ? "cut" : "NOT CUT"}, ${v.shards} shard(s) at the right`;
        console.log(`  S12-95 no rail: ${said(as)} | control, the spare band back${back.glass ? "" : " (NOT PATCHED)"}: ${said(back)}`);
        if (!as.page || as.rail || !as.cut || as.shards) { bad++; console.log("FAIL: S12-95 - a right wall with no rail has a spare strip shard, or the page was not read without its rail"); }
        if (!back.glass || !back.cut || back.shards < 1) { bad++; console.log("FAIL: S12-95's control - the spare band put back shows no shard, so the reading cannot see one"); }
    }
} finally { await browser.close(); srv?.kill(); }
if (voices && !opt("--sizes") && !voiceRead) { bad++; console.log("FAIL: the voice check never read a tile at the wall (no desk drew glass)"); }
/* THE LAUNCHERS' CONTROLS UNDER MONOKUMA LEGACY (E77 fix r2-H3, 13.10.2026; fix r1-M1's open line). They plant faults
   on the launch pane, and under Legacy no curtain is mounted, so there is no pane to plant them on: a Legacy-only sweep
   ended red here on every run since r1-M1 for a reason nobody was going to fix. Not applicable is now an answer read off
   the page - every line drew no glass and its page said "theme off" - and anything else that drew no glass still fails. */
if (control && !controlled) {
    if (lines && themeOff === lines) console.log(`  launchers' controls: not applicable - ${lines} line(s), every one Monokuma Legacy's with no curtain mounted ("theme off"); each counted its launchers found and none hidden`);
    else { bad++; console.log("FAIL: the controls never ran (no size drew glass)"); }
}
if (control && rooms && !roomControlled.size) { bad++; console.log("FAIL: the room controls never ran (no size placed the tile)"); }
if (control && rooms && themes.includes("legacy") && !roomControlled.has("flat")) { bad++; console.log("FAIL: the Legacy room controls never ran (no Legacy desk placed the tile)"); }
if (rooms && !opt("--sizes") && unpinned) { bad++; console.log(`FAIL: ${unpinned} line(s) of the default sizes have no pin in PINS`); }
if (rooms && !opt("--sizes") && unboxed) { bad++; console.log(`FAIL: ${unboxed} placed line(s) of the default sizes have no box in PIN_BOX`); }
if (control && rooms && !opt("--sizes") && themes.some(t => !pinControlled.has(t))) { bad++; console.log("FAIL: a theme's pin control never ran (no size of it pinned 'clock' read 'clock')"); }
if (control && rooms && stackedRead && !rowControlled) { bad++; console.log("FAIL: the row controls never ran (no stacked size read a row)"); }
if (windows && placesRead && !placesControlled) { bad++; console.log("FAIL: the places' control never read an unclamped place off the screen or on the cluster"); }
console.log(`SWEEP ${bad ? "RED" : "GREEN"}: ${themes.length} theme(s) x ${roles.length} role(s) x ${SIZES.length} sizes, ${glassSizes} with glass, ${bad} failing`);
process.exit(bad ? 1 : 0);
