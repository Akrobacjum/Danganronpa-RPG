/**
 * EVERY WINDOW, AS TESTS (E59 C2, 14.11.2026; the plan's point (3): "a review of every window: drpgWindow, one tab
 * system, the footer contract, red only on the road through the GM, drpg-destructive never under Enter, gold only for
 * Hope, the 11 px floor"). Read by tier 0's R6750-R6756 and by tools/e59/windows.mjs, which writes the census into
 * docs/dev/e59/WINDOWS.md. Pure: it reads the text it is handed and imports only the two readers Node loads too
 * (tests-lint.mjs's cutters, tests-css.mjs's parser), so the suite and the tool cannot disagree.
 * ---------------------------------------------------------------------------
 * A WINDOW is counted where the code opens it (as R1335 counts them): a call of ui-kit.mjs `drpgWindow`, `drpgConfirm`
 * or `drpgPrompt`, a class built on `DrpgApp()`, and - outside ui-kit.mjs, where each is a finding unless ROOT_OUTSIDE
 * names it - a `DialogV2` call, a `new` of a Foundry application class, or a class extending one. A window is named by
 * its file and the top-level function or class it is opened in, so `utils.mjs tableDialog` is one window however many
 * callers it has. ui-kit.mjs's own `DialogV2.wait` and `ApplicationV2` are the kit and not counted.
 *
 * EACH RULE answers `{ read, found }`: `read` the windows (or, for the sheets, the rules) it judged, by name, and
 * `found` each breach as one sentence with its file and line. `windowsSelfCheck` runs each rule on a planted case it
 * must find and a control it must pass; [] is held.
 *
 * WHAT IT IS NOT. A drawn window. It reads source, and a footer a function builds at run time is judged by the kit's
 * own throw (`footerButtons`: a destructive default throws), which the tests run, not by this reading. Layout, the
 * cascade a browser computes and the slider's effect on a drawn window are a real browser's (R299, the 84-viewports
 * scenario and C3's screenshots, LIVE-E59-01).
 */
import { blankComments, blankLiterals, callArgs, lineAt } from "./tests-lint.mjs";
import { blocksOf, declarationsOf, stripCssComments, meaningReads, MEANING } from "./tests-css.mjs";

/* ---- reading the source ------------------------------------------------------------------------------------------ */

const lfOf = text => String(text ?? "").replace(/\r\n?/g, "\n");

/** The top-level function, const or class the index stands in: the last line before it that opens one at column 0. */
export function enclosingName(text, index) {
    const head = text.slice(0, index);
    const lineStart = head.lastIndexOf("\n") + 1;
    const lines = text.slice(0, text.indexOf("\n", index) < 0 ? text.length : text.indexOf("\n", index)).split("\n");
    const own = text.slice(lineStart, index);
    for (let i = lines.length - 1; i >= 0; i--) {
        const line = i === lines.length - 1 ? own + text.slice(index).split("\n")[0] : lines[i];
        const m = /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*([\w$]+)|^(?:export\s+)?(?:const|let|var)\s+([\w$]+)\s*=|^(?:export\s+)?class\s+([\w$]+)/.exec(line);
        if (m) return m[1] ?? m[2] ?? m[3];
    }
    return "(top level)";
}

/* The kit's three openers, a class on DrpgApp(), and what opens a window outside the kit. */
const OPENERS = /\b(drpgWindow|drpgConfirm|drpgPrompt)\s*\(|\bclass(?:\s+([\w$]+))?\s+extends\s+([^{]+?)\s*\{|\bnew\s+((?:[\w$]+\.)*(?:DialogV2|ApplicationV2|ImagePopout|DocumentSheetV2|HandlebarsApplicationMixin|Dialog|Application|FormApplication))\s*\(|\b(DialogV2\s*\.\s*(?:wait|confirm|prompt|query|input))\s*\(/g;
const FOUNDRY_APP = /ApplicationV2|DialogV2|ApplicationMixin|DocumentSheetV2|ImagePopout|\bApplication\b|FormApplication/;

/**
 * Every window the sources open: `[{ file, line, name, kind, label, at, open }]`, `kind` one of drpgWindow, drpgConfirm,
 * drpgPrompt, DrpgApp or "raw: <what>", `open` the index of the call's "(" (null for a class), `at` the match's index.
 * `sources` is `[[file, text]]`; the suite's own files are the caller's to leave out.
 */
export function windowSites(sources) {
    const out = [];
    for (const [file, raw] of sources ?? []) {
        const text = lfOf(raw);
        const blank = blankLiterals(blankComments(text));
        for (const m of blank.matchAll(OPENERS)) {
            let kind, open = null;
            if (m[1]) {
                if (/\bfunction\s*$/.test(blank.slice(Math.max(0, m.index - 40), m.index))) continue; // the kit's own declaration
                kind = m[1];
                open = m.index + m[0].length - 1;
            } else if (m[3] !== undefined) {
                const base = m[3].trim();
                if (/^DrpgApp\(\)$/.test(base)) kind = "DrpgApp";
                else if (FOUNDRY_APP.test(base)) kind = `raw: class extends ${base}`;
                else continue;
            } else kind = `raw: ${(m[4] ?? m[5]).replace(/\s+/g, "")}`;
            if (file === "ui-kit.mjs" && kind.startsWith("raw:")) continue; // the kit's frame
            const name = m[2] ?? enclosingName(text, m.index);
            out.push({ file, line: lineAt(text, m.index), name, kind, label: `${file} ${name}`, at: m.index, open });
        }
    }
    return out;
}

/** The windows by name, each once, in file order: `[label]`. */
export function windowNames(sites) {
    return [...new Set(sites.map(s => s.label))];
}

/** The options object a kit call is handed, as `{ start, end, keys: Map(key -> { start, end }) }`, or null. */
function optionsOf(blank, open) {
    const { args } = callArgs(blank, open);
    if (!args[0]) return null;
    const s = blank.slice(args[0].start, args[0].end);
    const brace = s.search(/\S/);
    if (s[brace] !== "{") return null;
    return objectAt(blank, args[0].start + brace);
}

/** The object literal whose "{" is at `open`: `{ start, end, keys }`, its keys read at its own depth. */
function objectAt(blank, open) {
    const { args, close } = callArgs(blank, open);
    const keys = new Map();
    for (const a of args) {
        const k = /^\s*([\w$]+)\s*:/.exec(blank.slice(a.start, a.end)) ?? /^\s*([\w$]+)\s*$/.exec(blank.slice(a.start, a.end));
        if (k) keys.set(k[1], { start: a.start + blank.slice(a.start, a.end).indexOf(k[1]) + k[1].length, end: a.end });
        else if (/^\s*\.\.\./.test(blank.slice(a.start, a.end))) keys.set(`...${keys.size}`, a);
    }
    return { start: open, end: close, keys };
}

/** A key's value as a string literal's words ("x" or 'x' or a template with no `${`), or null. */
function literalValue(text, blank, span) {
    const raw = text.slice(span.start, span.end).replace(/^\s*:?\s*/, "").trim();
    const m = /^(["'`])([^"'`$]*)\1$/.exec(raw);
    return m ? m[2] : null;
}

/* ---- R6750: no window without `.drpg-ui` ------------------------------------------------------------------------- */

/**
 * The windows outside the kit that stay, each with the reason it is not the kit's (a row is a decision, with its date
 * and who took it). Matched by label and kind.
 */
export const ROOT_OUTSIDE = Object.freeze([
    Object.freeze({
        label: "room-tile.mjs openRoomImage", kind: /ImagePopout/,
        why: "the room's picture, opened in Foundry's own picture viewer on this browser alone with no share control (E20 C3, room-tile.mjs `openRoomImage`); the kit's frame would hold the picture to the kit's one scrolling body. Listed in GAPS.md for the owner (Q-E59-11)"
    })
]);

/** Every window is a kit window (`drpg-ui` on its root) or a row of ROOT_OUTSIDE. */
export function rootRule(sites, outside = ROOT_OUTSIDE) {
    const found = [];
    for (const s of sites) {
        if (!s.kind.startsWith("raw:")) continue;
        if (outside.some(o => o.label === s.label && o.kind.test(s.kind))) continue;
        found.push(`${s.file}:${s.line} ${s.name} opens a window outside the kit (${s.kind.slice(5)}): no \`drpg-ui\` on its root`);
    }
    return { read: windowNames(sites), found };
}

/* ---- R6751: drpg-destructive never the default, never autofocus, never under Enter -------------------------------- */

/**
 * Three readings. (1) Every object literal in the sources that holds a footer's `destructive` and a `default` (a kit
 * footer, written in a window's call or built by a function): the default may not name an action of the destructive
 * list; a default that is no literal is counted as `unread` (the kit's `footerButtons` throws on it at run time, which
 * the test runs). (2) Every opening tag written in a literal that carries a destructive class (`drpg-destructive`,
 * `drpg-role-destructive`) or `data-drpg-role="destructive"`: no `autofocus`, no `default` class. (3) Every
 * `roleButton({ role: "destructive", ... })`: no `autofocus` in its attrs. And a field's `data-drpg-enter` (utils.mjs:
 * Enter presses the button it names) may not name a destructive button's selector.
 */
export function destructiveRule(sources, sites = windowSites(sources)) {
    const found = [], holders = new Set();
    let footers = 0, unread = 0;
    for (const [file, raw] of sources ?? []) {
        const text = lfOf(raw);
        const code = blankComments(text);
        const blank = blankLiterals(code);
        for (const m of blank.matchAll(/\{/g)) {
            const obj = objectAt(blank, m.index);
            if (!obj.keys.has("destructive")) continue;
            const where = enclosingName(text, m.index);
            holders.add(`${file} ${where}`);
            if (!obj.keys.has("default")) continue;
            footers++;
            const def = literalValue(text, blank, obj.keys.get("default"));
            if (def === null) { unread++; continue; }
            const list = obj.keys.get("destructive");
            const listText = text.slice(list.start, list.end);
            const actions = [...listText.matchAll(/\baction\s*:\s*["'`]([^"'`$]+)["'`]/g)].map(a => a[1]);
            if (actions.includes(def)) found.push(`${file}:${lineAt(text, m.index)} ${where}: the footer's default "${def}" is a destructive button`);
        }
        for (const m of code.matchAll(/<(?:button|a|input)\b[^<>]*>/g)) {
            const tag = m[0];
            if (!/drpg-(?:role-)?destructive|data-drpg-role=["']?destructive/.test(tag)) continue;
            if (/\bautofocus\b/.test(tag)) found.push(`${file}:${lineAt(text, m.index)} ${enclosingName(text, m.index)}: a destructive button written with autofocus`);
            if (/class="[^"]*\bdefault\b/.test(tag)) found.push(`${file}:${lineAt(text, m.index)} ${enclosingName(text, m.index)}: a destructive button written as the default`);
        }
        for (const m of blank.matchAll(/\broleButton\s*\(/g)) {
            const { args, close } = callArgs(blank, m.index + m[0].length - 1);
            const call = text.slice(m.index, close);
            if (!args.length || !/\brole\s*:\s*["']destructive["']/.test(call)) continue;
            if (/autofocus/.test(call)) found.push(`${file}:${lineAt(text, m.index)} ${enclosingName(text, m.index)}: roleButton({ role: "destructive" }) with autofocus`);
        }
        for (const m of code.matchAll(/data-drpg-enter["']?\s*[:=]\s*["']([^"']+)["']/g)) {
            if (/destructive|delete|drop|clear|reset/i.test(m[1])) found.push(`${file}:${lineAt(text, m.index)} ${enclosingName(text, m.index)}: Enter in a field presses "${m[1]}"`);
        }
    }
    const read = windowNames(sites).filter(l => holders.has(l) || sites.some(s => s.label === l && s.open !== null && /destructive/.test(lfOf(sourceOf(sources, s.file)).slice(s.at, s.at + 4000).split(/\n\}\);?\n/)[0])));
    return { read, found, footers, unread, holders: [...holders].sort() };
}

const sourceOf = (sources, file) => (sources ?? []).find(([f]) => f === file)?.[1] ?? "";

/* ---- R6752: one tab system --------------------------------------------------------------------------------------- */

/**
 * The kit's tabs (`kitTabs`, `kitTabBar`, `wireKitTabs`, `drpgWindow({ tabs })`) are the one tab system. Outside
 * ui-kit.mjs no literal writes tab markup (`role="tab"`, `"tablist"`, `"tabpanel"`, a `data-tab` attribute on a tag
 * it writes, a `nav` of class `tabs`), and no class declares Foundry's tabs (`static TABS`, `tabGroups =` in a class
 * body) or builds Foundry's tab controller (`Tabs`, `TabsV2`). Reading Daggerheart's own sheet tabs through a selector
 * (`querySelector('[data-tab="effects"]')`) writes no tab and is not counted; sheet-fit.mjs and sheet-item.mjs steer
 * Daggerheart's sheet through its own `changeTab`, which is the sheet's tab system, not a module window's.
 */
export function tabRule(sources, sites = windowSites(sources)) {
    const found = [], users = new Set();
    for (const [file, raw] of sources ?? []) {
        const text = lfOf(raw);
        const code = blankComments(text);
        const blank = blankLiterals(code);
        for (const m of blank.matchAll(/\b(kitTabs|kitTabBar|wireKitTabs|fitKitTabs)\s*\(|\btabs\s*:\s*\{/g)) {
            if (file === "ui-kit.mjs") continue;
            users.add(`${file} ${enclosingName(text, m.index)}`);
        }
        if (file === "ui-kit.mjs") continue;
        for (const m of code.matchAll(/<[a-z][\w-]*\b[^<>]*>/gi)) {
            const tag = m[0];
            const why = /\brole=["']?tab(?:list|panel)?["'\s>]/.test(tag) ? "a tab role"
                : /\sdata-tab=/.test(tag) ? "a data-tab attribute"
                    : /^<nav\b[^>]*class="[^"]*\btabs\b/.test(tag) ? "a nav of class tabs" : null;
            if (why) found.push(`${file}:${lineAt(text, m.index)} ${enclosingName(text, m.index)}: writes ${why} outside the kit (${tag.slice(0, 80)})`);
        }
        for (const m of blank.matchAll(/\bstatic\s+TABS\b|\bnew\s+(?:[\w$]+\.)*(?:Tabs|TabsV2)\s*\(/g)) {
            found.push(`${file}:${lineAt(text, m.index)} ${enclosingName(text, m.index)}: Foundry's own tabs (${m[0].trim()})`);
        }
    }
    const read = windowNames(sites).filter(l => users.has(l));
    return { read, found, users: [...users].sort() };
}

/* ---- R6753: the footer contract ---------------------------------------------------------------------------------- */

/** A kit footer's slots (ui-kit.mjs `footerButtons`; `rows` the footer's layout, E97 C2). */
export const FOOTER_SLOTS = Object.freeze(["primary", "gmRoute", "close", "secondary", "destructive", "default", "rows"]);

/**
 * Every kit window's footer by the contract (ui-kit.mjs's header): a `drpgWindow` call hands its buttons as `footer`
 * slots, never as DialogV2's `buttons` (which the kit's own `buttons` replaces without a word); a literal footer names
 * only slots. A closing word may carry its own `label` since E102 C6 (7386194a, 14.11.2026: the kit draws a caller's
 * word, "Not now" or "Not yet", where it drew the role's), so that is not read here. A `DrpgApp` class draws a footer only through
 * `footerMarkup` or `liveFooter` - no `<footer` and no `form-footer` written by hand in its file - or none. Each window
 * is read with the shape its footer is in: "slots" (a literal), "built" (an expression the kit judges at run time),
 * "question" (drpgConfirm, drpgPrompt), "kit footer" or "no footer" (a DrpgApp).
 */
export function footerRule(sources, sites = windowSites(sources)) {
    const found = [], shapes = new Map();
    for (const s of sites) {
        const text = lfOf(sourceOf(sources, s.file));
        const blank = blankLiterals(blankComments(text));
        const at = `${s.file}:${s.line} ${s.name}`;
        if (s.kind === "DrpgApp") {
            const own = blankComments(text);
            const kit = /\b(?:footerMarkup|liveFooter)\s*\(/.test(blank);
            const hand = [...own.matchAll(/<footer\b[^>]*>|form-footer/g)].filter(m => !/querySelector|closest/.test(own.slice(Math.max(0, m.index - 40), m.index)));
            if (hand.length && !kit) found.push(`${at}: a DrpgApp writes its own footer (${hand[0][0].slice(0, 40)})`);
            shapes.set(s.label, kit ? "kit footer" : "no footer");
            continue;
        }
        if (s.kind.startsWith("raw:")) { shapes.set(s.label, "outside the kit"); continue; }
        if (s.open === null) continue;
        const opts = optionsOf(blank, s.open);
        if (s.kind !== "drpgWindow") {
            shapes.set(s.label, shapes.get(s.label) ?? "question");
            if (opts?.keys.has("buttons")) found.push(`${at}: a question handed DialogV2's \`buttons\``);
            continue;
        }
        if (!opts) { shapes.set(s.label, shapes.get(s.label) ?? "built"); continue; }
        if (opts.keys.has("buttons")) found.push(`${at}: drpgWindow handed DialogV2's \`buttons\`, which the kit's footer replaces`);
        const footer = opts.keys.get("footer");
        const ftext = footer ? blank.slice(footer.start, footer.end).replace(/^\s*:\s*/, "") : "";
        if (footer && ftext.trim().startsWith("{")) {
            const fo = objectAt(blank, footer.start + blank.slice(footer.start, footer.end).indexOf("{"));
            for (const k of fo.keys.keys()) if (!k.startsWith("...") && !FOOTER_SLOTS.includes(k)) found.push(`${at}: the footer's "${k}" is no slot of the kit`);
            shapes.set(s.label, shapes.get(s.label) === "built" ? "built" : "slots");
        } else shapes.set(s.label, footer ? "built" : (shapes.get(s.label) ?? "no footer"));
    }
    return { read: windowNames(sites), found, shapes };
}

/* ---- R6754: the 11 px floor -------------------------------------------------------------------------------------- */

/** The smallest the slider takes the Legacy scale to (settings.mjs `sliderScale`, the uiScale range 0.8-1.4). */
export const SCALE_MIN = 0.8;
/** The root's font size the rem is read at (Foundry's, 16 px; the slider scales through the tokens, not the root). */
export const ROOT_PX = 16;
/** Foundry's own `--font-size-N` tokens are N px. */
const FOUNDRY_SIZE = /^--font-size-(\d+)$/;

/**
 * The least a `font-size` value comes to in px, or null when it cannot be read in Node (an `em`, a `%`, a token with no
 * fallback, a keyword). `max()` takes its largest argument's least, `min()` its smallest, `calc()` its product with
 * every `var(--...-scale)` at SCALE_MIN and every other `var()` at its fallback.
 */
export function leastPx(value) {
    const v = String(value ?? "").replace(/!important/g, "").trim();
    const split = inner => { const out = []; let d = 0, cur = ""; for (const ch of inner) { if (ch === "(") d++; if (ch === ")") d--; if (ch === "," && !d) { out.push(cur); cur = ""; } else cur += ch; } out.push(cur); return out.map(x => x.trim()); };
    const fn = /^(max|min|calc|clamp|var)\((.*)\)$/s.exec(v);
    if (fn) {
        const [, name, inner] = fn;
        if (name === "var") {
            const [token, ...fallback] = split(inner);
            const fs = FOUNDRY_SIZE.exec(token);
            if (fs) return Number(fs[1]);
            if (/-scale$/.test(token)) return SCALE_MIN;
            return fallback.length ? leastPx(fallback.join(",")) : null;
        }
        if (name === "calc") {
            const parts = inner.split(/\s*\*\s*/);
            if (parts.length === 1) return leastPx(parts[0]);
            let px = null, k = 1;
            for (const p of parts) {
                const n = leastPx(p);
                if (n === null) return null;
                if (/(?:px|rem|pt)\b|^var\(--font-size/.test(p) || (/^var\(/.test(p) && !/-scale/.test(p))) px = (px ?? 1) * n; else k *= n;
            }
            return px === null ? null : px * k;
        }
        const args = split(inner).map(leastPx);
        if (name === "clamp") return args[0];
        if (args.some(a => a === null)) return null;
        return name === "max" ? Math.max(...args) : Math.min(...args);
    }
    const n = /^(-?[\d.]+)(px|rem|pt)?$/.exec(v);
    if (!n) return null;
    const x = Number(n[1]);
    return n[2] === "px" ? x : n[2] === "rem" ? x * ROOT_PX : n[2] === "pt" ? x * 4 / 3 : x;
}

/**
 * The surfaces that are no window, where a size under 11 px stands for now: each a selector pattern, the surface and
 * the reason. Each is a line of GAPS.md (the floor is the windows'; whether it holds on the HUD, the sheet and the
 * tiles too is the owner's, Q-E59-12). A rule under 11 px that matches none is a finding.
 */
export const FLOOR_OUTSIDE = Object.freeze([
    Object.freeze({ match: /\.experience-chip\b|character-header-sheet|nav\.sheet-tabs|\.drpg-action-panel\b|\.status-value:has\(\.drpg-resource-bar\)|drpg-action-button|drpg-action-cost/, surface: "the character sheet", why: "the sheet's chips, trait names, action tiles and resource rows: Daggerheart's sheet, sized with Foundry's --font-size-9/10 under the pixel font" }),
    Object.freeze({ match: /#drpg-hud|drpg-hud-track|drpg-overflow-caption/, surface: "the clock (HUD)", why: "the clock's time, track and the Overflow's caption: a widget on the canvas, not a window" }),
    Object.freeze({ match: /#drpg-player-status/, surface: "the player's status bar", why: "the status labels, values and free move: a widget on the canvas, not a window" }),
    Object.freeze({ match: /drpg-event-(?:meta|sub|note)\b/, surface: "the Event panel", why: "an event card's meta line, subtitle and note: a card on the screen's edge, not a window" }),
    Object.freeze({ match: /#drpg-despair\b/, surface: "the Despair meter", why: "the meter's name and count: a widget on the canvas, not a window" }),
    Object.freeze({ match: /drpg-voice-(?:mic-ptt|count)/, surface: "the voice tile", why: "the push-to-talk mark and the count on the voice tile (an A8 surface), not a window" })
]);

/**
 * Every `font-size` of the served sheets: `read` the declarations whose least size was read (and `unread`, the count
 * that cannot be read in Node), `found` each one under 11 px whose selector no FLOOR_OUTSIDE row names, `outside`
 * those it names (for the gap list).
 */
export function floorRule(sheets, outside = FLOOR_OUTSIDE) {
    const found = [], kept = [], read = [], used = new Set();
    let unread = 0;
    for (const [file, raw] of sheets ?? []) {
        const text = lfOf(raw);
        for (const block of blocksOf(stripCssComments(text))) {
            if (!block.prelude || block.prelude.startsWith("@")) continue;
            const where = [...block.context, block.prelude].join(" ");
            for (const d of declarationsOf(block.own)) {
                if (d.property !== "font-size") continue;
                const px = leastPx(d.value);
                if (px === null) { unread++; continue; }
                read.push(`${file}: ${block.prelude.slice(0, 80)}`);
                if (px >= 11 - 1e-9 || px === 0) continue; // 0 hides a glyph's letter under its drawing: no text to read
                const line = `${file}: ${block.prelude.replace(/\s+/g, " ").slice(0, 120)} { font-size: ${d.value.replace(/\s+/g, " ")} } comes to ${Math.round(px * 100) / 100} px`;
                const row = outside.find(o => o.match.test(where));
                if (row) used.add(row);
                (row ? kept : found).push(row ? `${line} (${row.surface})` : line);
            }
        }
    }
    /* the rows that held a size, by the row itself: a kept line's selector is cut at 120 characters */
    return { read, found, kept, unread, stale: outside.filter(o => !used.has(o)) };
}

/* ---- R6755: gold only for Hope ----------------------------------------------------------------------------------- */

/**
 * The sheets by tests-css.mjs `meaningReads` with MEANING's Hope row alone (R3410 holds all four meanings; this reads
 * Hope's and names every rule that reads gold), and the scripts: no literal outside the suite writes a gold token
 * (`--drpg-gold...`, `--drpg-sg-hope`) into markup or a style, unless the line names Hope (MEANING.hope's words).
 */
/** Script lists that name a gold token without painting with it, each with its reason. */
export const GOLD_READERS = Object.freeze([
    Object.freeze({ file: "diagnostics.mjs", name: "LOAD_BEARING_TOKENS", why: "the health check asks that the token is declared; it paints nothing" })
]);

export function goldRule(sheets, sources, readers = GOLD_READERS) {
    const hope = { hope: MEANING.hope };
    const r = meaningReads(sheets, hope);
    const found = [...r.found];
    let scripts = 0;
    for (const [file, raw] of sources ?? []) {
        const text = lfOf(raw);
        const code = blankComments(text);
        for (const m of code.matchAll(/--drpg-(?:gold(?:-light|-deep|-shadow)?(?:-rgb)?|sg-hope)\b/g)) {
            scripts++;
            const line = code.slice(code.lastIndexOf("\n", m.index) + 1, code.indexOf("\n", m.index) < 0 ? code.length : code.indexOf("\n", m.index));
            if (MEANING.hope.words.test(line)) continue;
            const name = enclosingName(text, m.index);
            if (readers.some(r => r.file === file && r.name === name)) continue;
            found.push(`${file}:${lineAt(text, m.index)} ${name} writes ${m[0]} on a line that names no Hope word`);
        }
    }
    const read = [...new Set(r.allowed.filter(a => a.meaning === "hope").map(a => a.where.replace(/\s+/g, " ").slice(0, 100)))];
    return { read, found, reads: r.read, scripts };
}

/* ---- R6756: red only on the road through the GM ------------------------------------------------------------------ */

/** The tokens that are the GM's red or a red that warns, in either theme. */
export const RED_TOKENS = /^--drpg-(?:eye|crimson(?:-light|-deep|-dark)?|sg-gm|kit-role-gm-route|kit-role-destructive|kit-gm-route-bg|gmp-route(?:-hover)?-bg)(?:-rgb)?$/;
/** A rule's selector that names the GM's road or an answer that cannot be undone (D11; R1580's two exceptions). */
const RED_NAMED = /gm-route|gmRoute|destructive|\[data-drpg-(?:delete-table|drop)\]|aria-invalid|field-error|user-invalid|warn|error|alarm/i;
/** A rule that reaches a window's buttons: the kit's frame and roles, a module window's class, a dialog. */
const WINDOW_SCOPE = /\.drpg-ui\b|drpg-kit-|drpg-role-(?:primary|close|cancel|secondary|gm-route|destructive)\b|data-drpg-role|\.drpg-window-|\.application\.dialog|\.dialog\b/;
const BUTTON = /button|\[data-action|\[data-drpg-(?:delete-table|drop)\]|drpg-role-|data-drpg-role|-btn\b/;

/**
 * The red colours kept on a window's buttons that name neither the GM's road nor a destructive answer, each a decision
 * with its reason (and a line of GAPS.md).
 */
export const RED_KEPT = Object.freeze([
    Object.freeze({ match: /\.drpg-gmp-button/, why: "the GM panel's tiles under Monokuma Legacy, edged in the theme's eye: the GM's own window, which no player opens (E49's panel); for the owner, Q-E59-13" }),
    Object.freeze({ match: /aria-pressed="true"|\.is-selected\b|\.is-current\b|drpg-case-node-tick/, why: "a pressed mode, a chosen node or tick: Monokuma Legacy's \"on\" state is its eye (components.css `--drpg-kit-btn-on-bg`, `-on-edge`, `--drpg-kit-row-highlight`), a state, not a road; under the glass it is Bone; for the owner, Q-E59-13" }),
    Object.freeze({ match: /drpg-case-node--counter/, why: "a counter-argument's node on the case map, edged in the warning's crimson (`--drpg-kit-warn-edge`): a warning on a node, not a button's road" })
]);

/**
 * Two readings. (1) The kit's role tokens and faces: a rule that names a role other than the GM's road or a
 * destructive one (`drpg-role-primary`, `-close`, `-cancel`, `-secondary`, or `data-drpg-role` of one of those) reads no
 * red token, and the GM's road's own token (`--drpg-kit-role-gm-route`) is red in both themes. (2) Every rule in a
 * window's scope (WINDOW_SCOPE) that styles a button (BUTTON) and reads a red token names the GM's road, a destructive
 * answer or a warning (RED_NAMED), or a RED_KEPT row. Token chains are followed by name through the sheets' custom
 * properties, so a red that reaches a button under another name is read as red.
 */
export function redRule(sheets, kept = RED_KEPT) {
    const found = [], held = [], read = [], used = new Set();
    const defs = new Map();
    const parsed = (sheets ?? []).map(([file, raw]) => [file, blocksOf(stripCssComments(lfOf(raw)))]);
    const GLOBAL = /^(?::root|html|body(?:\.drpg-theme-[\w-]+)?)(?:\s*,\s*(?::root|html|body(?:\.drpg-theme-[\w-]+)?))*$/;
    for (const [, blocks] of parsed) for (const b of blocks) for (const d of declarationsOf(b.own ?? "")) {
        /* a token's global value alone: one a rule sets for its own scope (a role's face, a pane's brush) is that rule's,
           and read through it every footer button would be red because the destructive one is */
        if (!d.property.startsWith("--") || b.context.length || !GLOBAL.test(String(b.prelude).trim())) continue;
        if (!defs.has(d.property)) defs.set(d.property, new Set());
        defs.get(d.property).add(d.value);
    }
    const reachesRed = (value, seen = new Set()) => {
        for (const m of String(value).matchAll(/var\(\s*(--[\w-]+)/g)) {
            const t = m[1];
            if (RED_TOKENS.test(t)) return t;
            if (seen.has(t)) continue;
            seen.add(t);
            for (const v of defs.get(t) ?? []) { const r = reachesRed(v, seen); if (r) return `${t} -> ${r}`; }
        }
        return null;
    };
    const plainRole = /drpg-role-(?:primary|close|cancel|secondary)\b|data-drpg-role="(?:primary|close|cancel|secondary)"/;
    for (const [file, blocks] of parsed) {
        for (const b of blocks) {
            if (!b.prelude || b.prelude.startsWith("@")) continue;
            const where = [...b.context, b.prelude].join(" ");
            const scoped = WINDOW_SCOPE.test(where) && BUTTON.test(b.prelude);
            const roleRule = plainRole.test(b.prelude) && !/gm-route|gmRoute|destructive/.test(b.prelude);
            if (!scoped && !roleRule) continue;
            const sel = b.prelude.replace(/\s+/g, " ").slice(0, 120);
            read.push(`${file}: ${sel}`);
            for (const d of declarationsOf(b.own)) {
                const red = reachesRed(d.value);
                if (!red) continue;
                const line = `${file}: ${sel} { ${d.property} } reads ${red}`;
                if (roleRule) { found.push(`${line} - a plain role's face is red`); continue; }
                if (RED_NAMED.test(where)) continue;
                const row = kept.find(k => k.match.test(where));
                if (row) used.add(row);
                (row ? held : found).push(line);
            }
        }
    }
    const gmToken = [...(defs.get("--drpg-kit-role-gm-route") ?? [])];
    if (gmToken.length < 2 || !gmToken.every(v => reachesRed(v) || RED_TOKENS.test(String(v).replace(/^var\(\s*|\s*\)$/g, "")))) {
        found.push(`--drpg-kit-role-gm-route is not red in both themes: ${JSON.stringify(gmToken)}`);
    }
    return { read: [...new Set(read)], found, held, stale: kept.filter(k => !used.has(k)) };
}

/* ---- the planted cases ------------------------------------------------------------------------------------------- */

/** Each rule on a planted fault it must find and a control it must pass. */
export const WINDOW_FIXTURES = Object.freeze({
    root: [
        ["planted.mjs", "export function plantedRaw() {\n    return foundry.applications.api.DialogV2.wait({ content: \"x\" });\n}\nexport function plantedKit() {\n    return drpgWindow({ title: \"t\", footer: { close: \"close\" } });\n}\n"]
    ],
    destructive: [
        ["planted.mjs", "export function plantedFooter() {\n    return drpgWindow({ footer: { destructive: [{ action: \"wipe\", label: \"Wipe\" }], close: \"cancel\", default: \"wipe\" } });\n}\n"
            + "export function plantedTag() {\n    return `<button type=\"button\" class=\"drpg-role-destructive drpg-destructive\" autofocus>Erase</button>`;\n}\n"
            + "export function controlFooter() {\n    return drpgWindow({ footer: { destructive: [{ action: \"end\", label: \"End\" }], close: \"cancel\", default: \"cancel\" } });\n}\n"]
    ],
    tab: [
        ["planted.mjs", "export function plantedTabs() {\n    return `<nav class=\"sheet-tabs tabs\"><a role=\"tab\" data-tab=\"a\">A</a></nav>`;\n}\n"
            + "export function controlRead(root) {\n    return root.querySelector('[data-tab=\"effects\"]');\n}\n"]
    ],
    footer: [
        ["planted.mjs", "export function plantedButtons() {\n    return drpgWindow({ title: \"t\", buttons: [{ action: \"ok\" }], footer: { primary: { action: \"ok\", label: \"OK\" }, close: { role: \"close\", label: \"Done\" }, extra: 1 } });\n}\n"
            + "export function controlSlots() {\n    return drpgWindow({ title: \"t\", footer: { primary: { action: \"ok\", label: \"OK\" }, close: \"cancel\" } });\n}\n"]
    ],
    floor: [
        ["planted.css", ".drpg-ui .drpg-planted-small { font-size: max(min(10px, 0.7rem), calc(0.7rem * var(--drpg-legacy-scale, 1))); }\n"
            + ".drpg-ui .drpg-planted-floored { font-size: max(11px, calc(0.6rem * var(--drpg-legacy-scale, 1))); }\n"
            + "#drpg-hud .drpg-planted-hud { font-size: 9px; }\n.drpg-ui .drpg-planted-em { font-size: 0.5em; }\n"]
    ],
    gold: [
        ["planted.css", ".drpg-ui .drpg-planted-focus:focus-visible { outline: 2px solid var(--drpg-gold); }\n.drpg-hope-star { color: var(--drpg-gold); }\n"]
    ],
    goldScripts: [
        ["planted.mjs", "export const planted = `<span style=\"color: var(--drpg-gold)\">Done</span>`;\nexport const control = `<span class=\"drpg-hope\" style=\"color: var(--drpg-gold)\">Hope</span>`;\n"]
    ],
    red: [
        ["planted.css", "body { --drpg-eye: #e0182f; --drpg-kit-role-gm-route: var(--drpg-eye); --drpg-kit-planted: var(--drpg-eye); }\n"
            + "body.drpg-theme-stained-glass { --drpg-sg-gm: #e0182f; --drpg-kit-role-gm-route: var(--drpg-sg-gm); }\n"
            + ".drpg-ui button.drpg-role-primary:hover { background: var(--drpg-kit-planted); }\n"
            + ".drpg-ui .drpg-kit-footer button.drpg-planted-plain { border-color: var(--drpg-eye); }\n"
            + ".drpg-ui .drpg-kit-footer button.drpg-role-gm-route { border-color: var(--drpg-kit-role-gm-route); }\n"]
    ]
});

/** Every rule on its fixture; [] is held. */
export function windowsSelfCheck() {
    const F = WINDOW_FIXTURES;
    const p = [];
    const root = rootRule(windowSites(F.root), []);
    if (root.found.length !== 1 || !/plantedRaw/.test(root.found[0] ?? "")) p.push(`root: the planted DialogV2 is not the one finding: ${JSON.stringify(root.found)}`);
    if (root.read.length !== 2) p.push(`root: ${root.read.length} window(s) read in the fixture, not 2`);
    const de = destructiveRule(F.destructive);
    if (de.found.length !== 2 || !de.found.some(f => /plantedFooter.*"wipe"/.test(f)) || !de.found.some(f => /plantedTag.*autofocus/.test(f))) p.push(`destructive: not the planted default and autofocus alone: ${JSON.stringify(de.found)}`);
    if (de.footers !== 2) p.push(`destructive: ${de.footers} footer(s) with a destructive list and a default read, not 2`);
    const tab = tabRule(F.tab);
    if (tab.found.length !== 2 || !tab.found.every(f => /plantedTabs/.test(f))) p.push(`tab: not the planted tag's two findings alone: ${JSON.stringify(tab.found)}`);
    const foot = footerRule(F.footer);
    const want = ["buttons", "\"extra\""];
    if (foot.found.length !== 2 || !want.every(w => foot.found.some(f => f.includes(w) && /plantedButtons/.test(f)))) p.push(`footer: not the planted buttons and slot alone: ${JSON.stringify(foot.found)}`);
    if (foot.shapes.get("planted.mjs controlSlots") !== "slots") p.push(`footer: the control's footer is not read as slots: ${foot.shapes.get("planted.mjs controlSlots")}`);
    const fl = floorRule(F.floor, [{ match: /#drpg-hud/, surface: "hud", why: "fixture" }]);
    if (fl.found.length !== 1 || !/planted-small/.test(fl.found[0] ?? "") || fl.kept.length !== 1 || fl.unread !== 1 || fl.read.length !== 3) p.push(`floor: not the planted small size alone (found ${JSON.stringify(fl.found)}, kept ${fl.kept.length}, unread ${fl.unread}, read ${fl.read.length})`);
    for (const [value, px] of [["max(min(10px, 0.78rem), calc(0.78rem * var(--drpg-legacy-scale, 1)))", 10], ["var(--font-size-10, 0.62rem)", 10], ["max(11px, calc(0.78rem * var(--drpg-legacy-scale, 1)))", 11], ["0.75rem", 12], ["calc(8px * var(--drpg-legacy-scale, 1))", 6.4]]) {
        const got = leastPx(value);
        if (got === null || Math.abs(got - px) > 0.01) p.push(`floor: leastPx(${value}) is ${got}, not ${px}`);
    }
    const gold = goldRule(F.gold, F.goldScripts);
    if (gold.found.length !== 2 || !gold.found.some(f => /planted-focus/.test(f)) || !gold.found.some(f => /planted\.mjs:1/.test(f))) p.push(`gold: not the planted focus ring and the planted script alone: ${JSON.stringify(gold.found)}`);
    const red = redRule(F.red, []);
    if (red.found.length !== 2 || !red.found.some(f => /drpg-role-primary.*plain role/.test(f)) || !red.found.some(f => /planted-plain/.test(f))) p.push(`red: not the planted primary and the planted plain button alone: ${JSON.stringify(red.found)}`);
    return p;
}
