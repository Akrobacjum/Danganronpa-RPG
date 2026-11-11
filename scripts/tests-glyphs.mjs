/**
 * The pixel glyphs' arithmetic, for the suite and for the tools (E48 G1, 10.11.2026).
 * ---------------------------------------------------------------------------
 * Imports nothing, as tests-css.mjs, so the suite's R3333 runs these functions on the files Foundry serves and
 * tools/glyph-map.mjs (the CLI, whose header says what is held and why) and tools/chrome-icons.mjs on the checkout.
 * What it writes and checks: the generated px set (icons/pixel-sprite.svg, styles/pixel-icons.css, the audit page's
 * symbols), danganronpa.css's chrome section (`chromeCss`, moved from tools/chrome-icons.mjs whole), and every
 * hand-drawn data URI of the sheets against its row of tools/glyphs.json.
 */

/** The module's Font Awesome names, mapped to glyphs of the generated set: pixel-icons.py's `FA` table, moved as it
 *  stood (89 names to 76 glyphs on 10.11.2026). Stained Glass masks `i.fa-<name>` inside any drpg- element with it. */
export const FA = {
    "magnifying-glass": "search", "eye": "observe", "brain": "brain", "hammer": "hourglass", "bed": "rest",
    "ear-listen": "listen", "hand-sparkles": "palm", "broom": "broom", "skull": "skull", "skull-crossbones": "skull",
    "shoe-prints": "move", "screwdriver-wrench": "tamper", "hands-holding-circle": "support",
    "graduation-cap": "cap", "star": "star", "rotate-left": "reroll", "arrows-rotate": "reroll", "repeat": "reroll",
    "person-running": "sprint", "bolt": "dynamic", "mug-hot": "relief", "hand-fist": "fist", "burst": "loaded",
    "road-barrier": "barrier", "gift": "gift", "door-closed": "door", "door-open": "door",
    "heart-crack": "heartcrack", "link": "chain", "comment-slash": "silence", "hand-holding-heart": "cub",
    "arrow-trend-down": "trend-down", "arrow-trend-up": "trend-up", "water": "wave", "trash-can": "trash",
    "trash-arrow-up": "trash", "bullhorn": "horn", "envelope": "envelope", "gavel": "gavel", "heart-pulse": "pulse",
    "list-check": "checklist", "volume-high": "sound", "scale-balanced": "scale", "calendar-days": "calendar",
    "users-gear": "team", "table-list": "table", "wand-magic-sparkles": "wand", "user-secret": "mask", "bug": "bug",
    "magnifying-glass-chart": "lens", "fingerprint": "lens", "flask": "analyze", "lock": "lock", "box": "box",
    "box-open": "box-open", "heart": "support", "plus": "plus", "minus": "minus", "chevron-left": "left",
    "chevron-right": "right", "chevron-down": "down", "down-long": "down", "arrow-up": "arrow-up", "play": "play",
    "pen-to-square": "edit", "gear": "gear", "shield-halved": "shield", "user-slash": "user-slash",
    "eye-slash": "eye-slash", "moon": "moon", "comments": "chat", "hand": "palm", "hand-holding": "palm",
    "hand-pointer": "palm", "circle": "dot", "arrows-left-right": "swap", "khanda": "murder", "handshake": "support",
    "bell": "bell", "dice": "dice", "key": "key", "xmark": "close", "check": "check", "sort": "sort",
    "hourglass": "hourglass", "sun": "sun", "note-sticky": "note", "music": "music", "microphone": "mic"
};

/** The files `glyphProblems` reads, relative to the repository's root. */
export const GLYPH_FILES = ["tools/glyphs.json", "icons/pixel-sprite.svg", "styles/pixel-icons.css",
    "docs/design/identity-audit-v13.html", "styles/danganronpa.css", "styles/stained-glass.css"];
export const SPRITE = "icons/pixel-sprite.svg", PIXEL_CSS = "styles/pixel-icons.css", AUDIT_PAGE = "docs/design/identity-audit-v13.html";
/** The sheets whose hand-written data URIs are held to their rows (pixel-icons.css is generated, held whole). */
export const HAND_SHEETS = ["styles/danganronpa.css", "styles/stained-glass.css"];

const FIELDS = new Set(["family", "name", "grid", "from", "note", "audit", "sheet", "prop", "rule", "key", "same", "rows"]);
const id = g => `${g.family}:${g.name}`;
const lf = text => String(text).replace(/\r\n/g, "\n");

/* ------------------------------ the data ------------------------------------ */

/** glyphs.json's text -> its rows, or the problems that stop a reading. */
export function parseGlyphs(text) {
    let data;
    try { data = JSON.parse(text); } catch (e) { return { glyphs: [], problems: [`tools/glyphs.json is not JSON: ${e.message}`] }; }
    if (!Array.isArray(data?.glyphs)) return { glyphs: [], problems: ["tools/glyphs.json holds no `glyphs` list"] };
    return { glyphs: data.glyphs, problems: [] };
}

/** The pixels a row set draws, as "x,y" strings. */
export function pixelsOf(rows) {
    const px = new Set();
    rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] === "#") px.add(`${x},${y}`); });
    return px;
}

/** Each row's faults, the duplicates and the `same`s. */
export function dataProblems(glyphs) {
    const out = [], seen = new Map(), drawn = new Map();
    for (const [i, g] of glyphs.entries()) {
        const at = `glyphs[${i}] ${g?.family}:${g?.name}`;
        const extra = Object.keys(g ?? {}).filter(k => !FIELDS.has(k));
        if (extra.length) out.push(`${at}: unknown field(s) ${extra.join(", ")}`);
        if (!/^[a-z][a-z0-9-]*$/.test(String(g?.family))) out.push(`${at}: no family`);
        if (!/^[a-z0-9][a-z0-9-]*$/.test(String(g?.name))) out.push(`${at}: a name must be lower-case letters, digits and "-"`);
        if (typeof g?.from !== "string" || !g.from) out.push(`${at}: no \`from\``);
        if (seen.has(id(g))) out.push(`${at}: ${id(g)} is written twice (glyphs[${seen.get(id(g))}])`);
        else seen.set(id(g), i);
        const n = g?.grid;
        if (!Number.isInteger(n) || n < 4 || n > 64) { out.push(`${at}: grid ${n} is not a whole number of cells`); continue; }
        if (!Array.isArray(g.rows) || g.rows.length !== n) { out.push(`${at}: ${g.rows?.length ?? 0} rows, not grid ${n}`); continue; }
        const bad = g.rows.map((r, y) => [r, y]).filter(([r]) => typeof r !== "string" || r.length !== n || /[^.#]/.test(r));
        if (bad.length) { out.push(`${at}: row ${bad[0][1]} is not ${n} cells of "." and "#"`); continue; }
        if (!g.rows.some(r => r.includes("#"))) out.push(`${at}: draws nothing`);
        if (g.sheet && !g.prop === !g.rule) out.push(`${at}: a row with a sheet names one \`prop\` or one \`rule\``);
        const sig = `${n}|${g.rows.join("")}`;
        if (!drawn.has(sig)) drawn.set(sig, []);
        drawn.get(sig).push(g);
    }
    for (const same of drawn.values()) {
        if (same.length < 2) continue;
        /* One drawing, several rows: each but one names another of them as `same`, so the sharing is written down. */
        const unsaid = same.filter(g => !(g.same && same.some(o => o !== g && id(o) === g.same)));
        if (unsaid.length > 1) out.push(`these draw the same pixels and none says \`same\`: ${unsaid.map(id).join(", ")}`);
    }
    const byId = new Map(glyphs.map(g => [id(g), g]));
    for (const g of glyphs.filter(g => g?.same)) {
        const o = byId.get(g.same);
        if (!o) out.push(`${id(g)}: same ${g.same}, which is no row`);
        else if (o.grid !== g.grid || o.rows?.join("") !== g.rows?.join("")) out.push(`${id(g)}: same ${g.same}, but the two draw different pixels`);
    }
    return out;
}

/* ------------------------------ the writers --------------------------------- */

/** The generated set: family px, no sheet, in the file's order. */
export const generated = glyphs => glyphs.filter(g => g.family === "px" && !g.sheet);

/** pixel-icons.py's px_to_path: each row's runs, left to right, top to bottom. */
export function pathOf(rows) {
    let d = "";
    rows.forEach((row, y) => {
        for (let x = 0; x < row.length;) {
            if (row[x] !== "#") { x++; continue; }
            const x0 = x;
            while (x < row.length && row[x] === "#") x++;
            d += `M${x0} ${y}h${x - x0}v1h-${x - x0}z`;
        }
    });
    return d;
}

const symbolOf = g => `<symbol id="px-${g.name}" viewBox="0 0 24 24"><path fill="currentColor" d="${pathOf(g.rows)}"/></symbol>`;
const dataUriOf = g => 'url("data:image/svg+xml,' + `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' shape-rendering='crispEdges'><path fill='%23000' d='${pathOf(g.rows)}'/></svg>`
    .replaceAll("<", "%3C").replaceAll(">", "%3E").replaceAll("#", "%23").replaceAll('"', "'") + '")';

export function spriteOf(glyphs) {
    return '<svg xmlns="http://www.w3.org/2000/svg" style="display:none">\n' + generated(glyphs).map(symbolOf).join("\n") + "\n</svg>\n";
}

export function pixelCssOf(glyphs) {
    const css = ["/* Generated by tools/glyph-map.mjs from tools/glyphs.json - do not edit by hand.",
        "   The module's pixel icon set: every Font Awesome glyph the module draws inside its own",
        "   elements is masked to a 24x24 pixel glyph in the current colour. That MASKING is Stained",
        "   Glass only and scoped to the module's own containers (anything wearing a drpg- class), so",
        "   Foundry's chrome keeps its icons and Monokuma Legacy keeps its own.",
        "",
        "   THE GLYPHS THEMSELVES ARE ON THE BODY, unscoped, since 1.2.47. They were declared inside",
        "   `body.drpg-theme-stained-glass` with the rules that use them, which was fine while the only",
        "   two `.drpg-pxi` sprites - the clock's phase stamp and the Event panel's kind - were Stained",
        "   Glass only. The Event panel is in both themes now, and under Legacy `--drpg-px-mask` resolved",
        "   to nothing: an undefined mask is no mask at all, so each glyph came out as a solid square of",
        "   its own colour. A declared custom property that nothing reads costs nothing.",
        "   The sprite is icons/pixel-sprite.svg. */",
        "body {"];
    /* The glyph named "mask" cannot be `--drpg-px-mask`: that is the slot every icon element reads its glyph from, and
       a slot set to itself resolves to nothing (the audit's C-icons row). */
    const tok = n => n === "mask" ? "mask-glyph" : n;
    for (const g of generated(glyphs)) css.push(`    --drpg-px-${tok(g.name)}: ${dataUriOf(g)};`);
    css.push("}");
    const sel = fa => `body.drpg-theme-stained-glass [class*="drpg-"] i.fa-${fa},\nbody.drpg-theme-stained-glass i.drpg-action-icon.fa-${fa},\nbody.drpg-theme-stained-glass [class*="drpg-"] .fa-${fa}:is(i, span)`;
    const names = Object.keys(FA);
    css.push(names.map(sel).join(",\n") + ` {
    display: inline-block;
    width: max(1.15em, 22px);
    height: max(1.15em, 22px);
    min-width: 22px;
    min-height: 22px;
    vertical-align: -0.2em;
    background-color: currentColor;
    -webkit-mask: var(--drpg-px-mask) center / contain no-repeat;
    mask: var(--drpg-px-mask) center / contain no-repeat;
    image-rendering: pixelated;
}
` + names.map(fa => sel(fa).replaceAll(",\n", "::before,\n") + "::before").join(",\n") + " { content: none; }");
    for (const [fa, n] of Object.entries(FA)) css.push(sel(fa).replaceAll("\n", " ") + ` { --drpg-px-mask: var(--drpg-px-${tok(n)}); }`);
    return css.join("\n") + "\n";
}

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The audit page with its symbol block refreshed, as pixel-icons.py did it: every symbol of the generated set that is
 *  not one of the page's originals (`audit`) dropped, the originals redrawn in place, the rest appended once after
 *  the last `</symbol>`. A symbol written another way than one path (the page's eclipse) is left as it stands. */
export function auditPageOf(glyphs, html) {
    const set = generated(glyphs), byName = new Map(set.map(g => [g.name, g]));
    const added = set.filter(g => !g.audit);
    let out = added.length
        ? html.replace(new RegExp(`\\n?<symbol id="px-(${added.map(g => escapeRe(g.name)).join("|")})"[^>]*>[\\s\\S]*?</symbol>`, "g"), "")
        : html;
    out = out.replace(/<symbol id="px-([a-z0-9-]+)"[^>]*>\s*<path fill="currentColor" d="[^"]+"\s*\/?>\s*<\/symbol>/g, (all, name) => {
        if (!byName.has(name)) throw new Error(`the audit page draws px-${name}, which tools/glyphs.json does not hold`);
        return symbolOf(byName.get(name));
    });
    const last = out.lastIndexOf("</symbol>") + "</symbol>".length;
    return out.slice(0, last) + added.map(g => "\n" + symbolOf(g)).join("") + out.slice(last);
}

/* ------------------------------ the sheets ---------------------------------- */

/** A stylesheet's SVG data URI (the part after the comma) -> { grid, rows }, or null when it is not one path of
 *  whole-cell rectangles on a square grid, the only shape the sheets' drawings take. */
export function rasterOf(encoded) {
    let svg;
    try { svg = decodeURIComponent(encoded); } catch { return null; }
    const m = svg.match(/^<svg xmlns='http:\/\/www\.w3\.org\/2000\/svg' viewBox='0 0 (\d+) \1' shape-rendering='crispEdges'><path fill='#000' d='((?:M\d+ \d+h\d+v\d+(?:H\d+|h-\d+)z)+)'\/><\/svg>$/);
    if (!m) return null;
    const n = Number(m[1]);
    const cells = Array.from({ length: n }, () => Array(n).fill("."));
    for (const [, x, y, w, h, back] of m[2].matchAll(/M(\d+) (\d+)h(\d+)v(\d+)(?:H(\d+)|h-(\d+))z/g)) {
        const [X, Y, Wd, Ht] = [x, y, w, h].map(Number);
        if (back !== undefined && Number(back) !== X) return null;
        for (let i = 0; i < Wd; i++) for (let j = 0; j < Ht; j++) {
            if (X + i >= n || Y + j >= n) return null;
            cells[Y + j][X + i] = "#";
        }
    }
    return { grid: n, rows: cells.map(r => r.join("")) };
}

/** Comments blanked to spaces, so offsets and lines stay where they were. */
const blankComments = css => css.replace(/\/\*[\s\S]*?\*\//g, c => c.replace(/[^\n]/g, " "));
const URI = /url\("data:image\/svg\+xml,([^"]*)"\)/g;

/** Every SVG data URI of one sheet: { kind: "prop", key, encoded } or { kind: "rule", key, encoded, line }. */
export function sheetDrawings(css) {
    const text = blankComments(lf(css)), out = [];
    for (const m of text.matchAll(/(--drpg-[a-z]+-[a-z0-9-]+)\s*:\s*url\("data:image\/svg\+xml,([^"]*)"\)/g))
        out.push({ kind: "prop", key: m[1], encoded: m[2], line: text.slice(0, m.index).split("\n").length });
    for (const m of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const masks = [...m[2].matchAll(/(?<![-\w])(-webkit-)?mask-image\s*:\s*url\("data:image\/svg\+xml,([^"]*)"\)/g)];
        if (!masks.length) continue;
        const key = m[1].split(",")[0].trim().split(/\s+/).join(" ");
        const line = text.slice(0, m.index + m[1].search(/\S/)).split("\n").length;
        out.push({ kind: "rule", key, encoded: masks[0][2], line, all: masks.map(x => x[2]) });
    }
    const counted = [...text.matchAll(URI)].length;
    const read = out.reduce((n, d) => n + (d.all?.length ?? 1), 0);
    return { drawings: out, counted, read };
}

/** Each hand sheet's data URIs against their rows. */
export function sheetProblems(glyphs, sheets) {
    const out = [];
    let held = 0;
    for (const [file, css] of Object.entries(sheets)) {
        if (css == null) { out.push(`${file} could not be read`); continue; }
        const { drawings, counted, read } = sheetDrawings(css);
        if (read !== counted) out.push(`${file}: ${counted} SVG data URI(s), ${read} of them in a custom property or a rule's mask-image - the rest are read by nothing here`);
        const rows = glyphs.filter(g => g.sheet === file);
        const found = new Set();
        for (const d of drawings) {
            const row = rows.find(g => d.kind === "prop" ? g.prop === d.key : g.rule === d.key);
            if (!row) { out.push(`${file}:${d.line}: ${d.key} draws a glyph tools/glyphs.json has no row for`); continue; }
            if (found.has(id(row))) { out.push(`${file}:${d.line}: ${d.key} is drawn twice in the sheet`); continue; }
            found.add(id(row));
            if (d.all && new Set(d.all).size > 1) out.push(`${file}:${d.line}: ${d.key}'s mask-image and -webkit-mask-image draw different things`);
            const r = rasterOf(d.encoded);
            if (!r) { out.push(`${file}:${d.line}: ${d.key} is not one path of whole cells`); continue; }
            if (r.grid !== row.grid || r.rows.join("") !== row.rows.join("")) {
                const y = r.grid !== row.grid ? -1 : r.rows.findIndex((x, i) => x !== row.rows[i]);
                out.push(`${file}:${d.line}: ${d.key} is not ${id(row)}'s drawing (${y < 0 ? `grid ${r.grid}, the row's ${row.grid}` : `row ${y} differs`})`);
                continue;
            }
            held++;
        }
        for (const g of rows.filter(g => !found.has(id(g)))) out.push(`${id(g)}: ${file} no longer draws ${g.prop ?? g.rule}`);
    }
    for (const g of glyphs.filter(g => g.sheet && !(g.sheet in sheets))) out.push(`${id(g)}: names ${g.sheet}, which is not a sheet read here`);
    return { problems: out, held };
}

/* ------------------------------ the whole ----------------------------------- */

const firstDiff = (a, b) => {
    const x = lf(a).split("\n"), y = lf(b).split("\n");
    const i = x.findIndex((l, k) => l !== y[k]);
    return i < 0 ? (x.length === y.length ? 0 : Math.min(x.length, y.length) + 1) : i + 1;
};

/**
 * Everything `--check` holds, on file texts handed in: files is { "<repo path>": text | null } for GLYPH_FILES.
 * Returns the problems and the counts.
 */
export function glyphProblems(files) {
    const problems = [];
    const { glyphs, problems: read } = parseGlyphs(files["tools/glyphs.json"] ?? "");
    problems.push(...read);
    if (read.length) return { problems, counts: null };
    problems.push(...dataProblems(glyphs));
    const set = generated(glyphs), names = new Set(set.map(g => g.name));
    for (const [fa, n] of Object.entries(FA)) if (!names.has(n)) problems.push(`FA: fa-${fa} maps to ${n}, which the generated set does not draw`);
    for (const g of set) if (g.grid !== 24) problems.push(`${id(g)}: the generated set is on the 24 grid, this row on ${g.grid}`);
    const wants = [[SPRITE, () => spriteOf(glyphs)], [PIXEL_CSS, () => pixelCssOf(glyphs)],
        [AUDIT_PAGE, () => auditPageOf(glyphs, lf(files[AUDIT_PAGE] ?? ""))]];
    let current = 0;
    for (const [file, make] of wants) {
        if (files[file] == null) { problems.push(`${file} could not be read`); continue; }
        let want;
        try { want = make(); } catch (e) { problems.push(`${file}: ${e.message}`); continue; }
        if (lf(files[file]) === want) current++;
        else problems.push(`${file} is not what tools/glyph-map.mjs writes (line ${firstDiff(files[file], want)} differs) - run it`);
    }
    const sheets = Object.fromEntries(HAND_SHEETS.map(f => [f, files[f] ?? null]));
    const { problems: sp, held } = sheetProblems(glyphs, sheets);
    problems.push(...sp);
    let chrome = "not read";
    if (files["styles/danganronpa.css"] != null) {
        const text = lf(files["styles/danganronpa.css"]);
        let want = null;
        try { want = chromeCss(glyphs); } catch (e) { problems.push(`chromeCss: ${e.message}`); }
        chrome = want && text.includes(want) ? "current" : "stale";
        if (chrome === "stale") problems.push("styles/danganronpa.css's chrome section is not what tools/chrome-icons.mjs writes from the chrome rows - run it");
    }
    const families = {};
    for (const g of glyphs) families[g.family] = (families[g.family] ?? 0) + 1;
    return { problems, counts: { glyphs: glyphs.length, families, generated: set.length, fa: Object.keys(FA).length,
        current, sheetHeld: held, sheetRows: glyphs.filter(g => g.sheet).length, same: glyphs.filter(g => g.same).length, chrome } };
}

/**
 * The planted drifts: each a copy of the files with one fault, and the words its problem must hold. Red (a line per
 * miss) unless `glyphProblems` names every one and finds nothing on the files as they are.
 */
export function selfCheck(files) {
    const misses = [];
    const clean = glyphProblems(files).problems;
    if (clean.length) misses.push(`the files as they are already read ${clean.length} problem(s), so the plants prove nothing`);
    const data = JSON.parse(files["tools/glyphs.json"]);
    const edit = fn => { const d = structuredClone(data); fn(d.glyphs); return { ...files, "tools/glyphs.json": JSON.stringify(d) }; };
    const flip = (row, x) => row.slice(0, x) + (row[x] === "#" ? "." : "#") + row.slice(x + 1);
    const firstPx = data.glyphs.findIndex(g => g.family === "px" && !g.sheet);
    const firstProp = data.glyphs.findIndex(g => g.prop);
    const firstRule = data.glyphs.findIndex(g => g.rule);
    const plants = [
        ["a pixel of the generated set flipped", edit(g => { g[firstPx].rows[5] = flip(g[firstPx].rows[5], 5); }), `${SPRITE} is not what`],
        ["a row one cell short", edit(g => { g[firstPx].rows[3] = g[firstPx].rows[3].slice(1); }), "is not 24 cells"],
        ["two rows drawing the same pixels, no `same`", edit(g => { g[firstPx + 1].rows = [...g[firstPx].rows]; }), "none says `same`"],
        ["a `same` naming a row that draws other pixels", edit(g => { g[firstPx + 1].same = id(g[firstPx]); }), "draw different pixels"],
        ["a custom property's row drifted from the sheet", edit(g => { g[firstProp].rows[0] = flip(g[firstProp].rows[0], 0); }), `is not ${id(data.glyphs[firstProp])}'s drawing`],
        ["a chrome rule's row drifted from the sheet", edit(g => { g[firstRule].rows[1] = flip(g[firstRule].rows[1], 1); }), `is not ${id(data.glyphs[firstRule])}'s drawing`],
        ["a sheet drawing no row holds", edit(g => { g.splice(firstProp, 1); }), "has no row for"],
        ["the generated css edited by hand", { ...files, [PIXEL_CSS]: files[PIXEL_CSS].replace("--drpg-px-search: url(", "--drpg-px-search:  url(") }, `${PIXEL_CSS} is not what`],
        ["an FA name pointing at no glyph", null, "which the generated set does not draw"]
    ];
    for (const [what, planted, words] of plants) {
        let got;
        if (planted) got = glyphProblems(planted).problems;
        else {
            FA["glyph-map-plant"] = "no-such-glyph";
            try { got = glyphProblems(files).problems; } finally { delete FA["glyph-map-plant"]; }
        }
        if (!got.some(p => p.includes(words))) misses.push(`planted "${what}" was not seen (wanted a problem with "${words}"; read: ${got.slice(0, 2).join(" | ") || "nothing"})`);
    }
    /* THE CONTROL (the owner, 10.11: Glass on 24, Legacy keeps its 12 and 8): one name in `glass` on 24 and in
       `legacy` on 12 is no fault, and each theme finds its own. */
    const two = structuredClone(data.glyphs.filter(g => g.family === "chrome" && g.grid === 12).slice(0, 1));
    if (two.length) {
        const legacy = { ...two[0], family: "legacy", same: `chrome:${two[0].name}`, sheet: undefined, rule: undefined, key: undefined };
        const glass = { family: "glass", name: two[0].name, grid: 24, from: "control", rows: Array.from({ length: 24 }, (_, y) => (y === 12 ? "#" : ".").repeat(24)) };
        const both = [...data.glyphs, JSON.parse(JSON.stringify(legacy)), glass];
        if (dataProblems(both).length) misses.push(`one name drawn for glass on 24 and for legacy on 12 reads as a fault: ${dataProblems(both)[0]}`);
        if (drawingOf(both, two[0].name, "glass")?.grid !== 24 || drawingOf(both, two[0].name, "legacy")?.grid !== 12) misses.push("a theme does not find its own drawing of one name");
    } else misses.push("no 12-grid chrome row to build the two-theme control from");
    return { misses, plants: plants.length + 1 };
}

/* ------------------------------ the map (E48 G2) ---------------------------- */

/*
 * WHAT EACH ELEMENT WEARS, BY MEANING (E48 G2, 10.11.2026). Four tables and the gaps they measure, which the drawing
 * rounds close (STAGE M): `mapProblems` is the structure - red in `node tools/check.mjs glyphs` - and `mapGaps` the
 * gaps, printed there and held by R3334-R3339, each `expectedRed("E48")` until its last gap is drawn.
 *
 * A name is drawn when a row of that name is in one of the families a theme wears, looked up in THEMES's order, so
 * one element can carry a Stained Glass drawing and a Monokuma Legacy drawing on different grids under one name
 * (the owner, 10.11: Glass all on 24, Legacy keeps its 12- and 8-grid drawings; option A). Today every hand family is
 * unscoped, so both themes wear them; `glass` and `legacy` are the families the rounds and G4 add.
 */
export const THEMES = {
    glass: ["glass", "px", "pix", "g", "r", "chrome"],
    legacy: ["legacy", "pix", "g", "r", "chrome", "px"]
};

/** The keyed elements: config.mjs's ACTIONS, HOPE_CALLS, DESPAIR_CALLS, CRISIS_ACTIONS, MONOCUB, TRAP_TRIGGERS (the
 *  room triggers) and CLEANUP, each entry with an `icon`, and gm-panel.mjs's tiles (`{ key: "...", icon: "fa-..." }`,
 *  as `gm.<key>`) -> the glyph each wears, by meaning. Today's glyph where the FA table has one (83 on 10.11.2026);
 *  where it has none, the name the drawing rounds draw (10, gaps). */
export const ELEMENTS = {
    "ACTIONS.search": "search", "ACTIONS.observe": "observe", "ACTIONS.analyze": "brain",
    "ACTIONS.project": "hourglass", "ACTIONS.rest": "rest", "ACTIONS.listen": "listen", "ACTIONS.palm": "palm",
    "ACTIONS.tamper": "broom", "ACTIONS.directMurder": "skull", "ACTIONS.move": "move", "ACTIONS.sabotage": "tamper",
    "HOPE_CALLS.support": "support", "HOPE_CALLS.experience": "cap", "HOPE_CALLS.ultimate": "star",
    "HOPE_CALLS.contribution": "tamper", "HOPE_CALLS.reroll": "reroll", "HOPE_CALLS.sprint": "sprint",
    "HOPE_CALLS.burst": "dynamic", "HOPE_CALLS.relief": "relief", "HOPE_CALLS.determination": "fist",
    "HOPE_CALLS.freeCrit": "loaded", "DESPAIR_CALLS.obstacle": "barrier", "DESPAIR_CALLS.forTheGame": "gift",
    "DESPAIR_CALLS.behindClosedDoors": "door", "DESPAIR_CALLS.thisWillHurt": "heartcrack",
    "DESPAIR_CALLS.paranoia": "brain", "DESPAIR_CALLS.chained": "chain", "DESPAIR_CALLS.silence": "silence",
    "DESPAIR_CALLS.fuelTheCub": "cub", "DESPAIR_CALLS.gameProtection": "trend-down",
    "DESPAIR_CALLS.favoriteProject": "trend-up", "DESPAIR_CALLS.feedOverflow": "wave",
    "DESPAIR_CALLS.contraband": "trash", "DESPAIR_CALLS.publicAnnouncement": "horn",
    "DESPAIR_CALLS.motive": "envelope", "DESPAIR_CALLS.newRule": "gavel", "CRISIS_ACTIONS.useItem": "analyze",
    "CRISIS_ACTIONS.leaveClue": "lens", "CRISIS_ACTIONS.secureTrace": "palm", "CRISIS_ACTIONS.selfDefence": "shield",
    "CRISIS_ACTIONS.survive": "sprint", "CRISIS_ACTIONS.roleReversal": "reroll", "CRISIS_ACTIONS.strike": "fist",
    "CRISIS_ACTIONS.pin": "down", "CRISIS_ACTIONS.keepDistance": "swap", "CRISIS_ACTIONS.weaponAttack": "murder",
    "CRISIS_ACTIONS.finishingBlow": "skull", "CRISIS_ACTIONS.sharedEscape": "door",
    "CRISIS_ACTIONS.doubleRoleReversal": "reroll", "CRISIS_ACTIONS.crimePartners": "support",
    "CRISIS_ACTIONS.avertedEyes": "eye-slash", "MONOCUB.abilities.meddle": "palm", "TRAP_TRIGGERS.alone": "alone",
    "TRAP_TRIGGERS.enters": "door", "TRAP_TRIGGERS.search": "search", "TRAP_TRIGGERS.rest": "rest",
    "TRAP_TRIGGERS.item": "item-used", "TRAP_TRIGGERS.project": "hourglass", "TRAP_TRIGGERS.sabotage": "tamper",
    "TRAP_TRIGGERS.stash": "stash", "TRAP_TRIGGERS.passage": "passage", "TRAP_TRIGGERS.manual": "observe",
    "CLEANUP.actions.eraseTrace": "erase-trace", "CLEANUP.actions.misleadingTrail": "misleading-trail",
    "CLEANUP.actions.moveBody": "move-body", "gm.whoIsAlive": "pulse", "gm.projects": "checklist", "gm.sound": "sound",
    "gm.rules": "gavel", "gm.murder": "skull", "gm.investigation": "lens", "gm.trial": "scale", "gm.jump": "calendar",
    "gm.gmTeam": "team", "gm.roomSetup": "door", "gm.tables": "table", "gm.voiceReset": "voice-reset",
    "gm.seasonSetup": "wand", "gm.mastermind": "mask", "gm.chapterEndTile": "end-chapter", "gm.seasonReset": "trash",
    "gm.failureLog": "bug", "gm.caseWindow": "case-backup"
};

/** What later stages build, by the inventory (S/stages/E48/GLYPH-INVENTORY.md, 10.11.2026): [row, stage, element,
 *  glyph or [two glyphs]]. A row's id is `F<row>`, a two-glyph row's halves `F<row>a` and `F<row>b`. */
export const FUTURE = [
    [1, "E48", "Notice history button", "history-12"],
    [2, "E48", "Microphone", "mic"],
    [3, "E48", "Microphone off", "mic-off"],
    [4, "E48", "Sound off", "sound-off"],
    [5, "E48", "Lock (manual GM mic lock)", "lock"],
    [6, "E48", "Photo", "photo"],
    [7, "E48", "Chevron (description toggle)", "chevron"],
    [8, "E48", "Sound launcher gear", "gear"],
    [9, "E48", "Sound panel speaker", "speaker"],
    [10, "E48", "Handbooks book launcher", "book"],
    [11, "E48", "GM launcher glyph", "gm"],
    [12, "E48", "Voice reset", "voice-reset"],
    [13, "E48", "End chapter", "end-chapter"],
    [14, "E48", "Find Passage (row)", "find-passage"],
    [15, "E48", "Show the passage", "show-passage"],
    [16, "E48", "Go through", "go-through"],
    [17, "E48", "Tunnel exit mark", "tunnel-exit"],
    [18, "E48", "Frisk (row)", "frisk"],
    [19, "E48", "Frisk target-window buttons", "frisk-target"],
    [20, "E48", "Mode bar: Skip (turn/question)", "skip"],
    [21, "E48", "Mode bar: -30 s / +30 s (Panic -5/+5)", ["time-minus", "time-plus"]],
    [22, "E48", "Mode bar: Overrule", "overrule"],
    [23, "E48", "Mode bar: End mode", "end-mode"],
    [24, "E48", "Closing: Approve", "approve"],
    [25, "E48", "Closing: Pick someone else", "pick-other"],
    [26, "E48", "Closing: Resume", "resume"],
    [27, "E48", "Back to debate", "back-to-debate"],
    [28, "E97", "Case window launcher (Sprawa)", "case"],
    [29, "E97", "Run realization", "run"],
    [30, "E97", "Undo realization", "undo"],
    [31, "E97", "Realization marker", "made"],
    [32, "E97", "Column order arrows", ["arrow-up", "arrow-down"]],
    [33, "E98", "Map view toggle", "map"],
    [34, "E98", "Table view toggle", "table"],
    [35, "E98", "Murder-bound toggle", "murder-bound"],
    [36, "E98", "Who has what (list)", "who-has"],
    [37, "E99", "Case schema button (console frame)", "case-map"],
    [38, "E99", "Node check box (conclusion, counter, solution)", "check"],
    [39, "E99", "Show summary", "summary"],
    [40, "E92", "Spectator badge (HUD / card)", "spectator"],
    [41, "E92", "Assign Spectator (Students window)", "spectator"],
    [42, "E92", "Observers' talk switch", "spectators-talk"],
    [43, "E92", "Spectator token marker", "ghost-token"],
    [44, "E93", "Facilities tile (was Rest)", "facilities"],
    [45, "E69", "Infiltrate tile", "infiltrate"],
    [46, "E69", "Listen (row)", "listen"],
    [47, "E69", "Tail Someone", "tail"],
    [48, "E69", "Dash", "dash"],
    [49, "E69", "Echoes", "echoes"],
    [50, "E69", "Stop listening button", "stop-listening"],
    [51, "E69", "Eavesdropper marker in GM voice panel", "listening"],
    [52, "E74", "Shut the Door", "shut-door"],
    [53, "E74", "Force the Door", "force-door"],
    [54, "E74", "Pick the Lock", "pick-lock"],
    [55, "E74", "Keep Watch", "keep-watch"],
    [56, "E74", "Repair the Lock (project preset)", "repair-lock"],
    [57, "E74", "Barricaded flag on room", "barricade"],
    [58, "E74", "Broken lock mark / Room Setup column", "broken-lock"],
    [59, "E74", "Door list entries (closed, sealed)", "door"],
    [60, "E73", "Zone A / Zone B choice buttons", ["zone-a", "zone-b"]],
    [61, "E73", "Straw Poll", "straw-poll"],
    [62, "E73", "Logic Dive", "logic-dive"],
    [63, "E73", "Scrum Debate", "scrum"],
    [64, "E73", "Bar: Count now", "count-now"],
    [65, "E73", "Bar: Skip question", "skip"],
    [66, "E73", "Bar: Skip in Scrum", "skip"],
    [67, "E73", "Finding entry marks (Monokuma confirms / Class thinks)", "finding"],
    [68, "E72", "Monocub tile: Move", "move"],
    [69, "E72", "Monocub tile: Confusion", "confusion"],
    [70, "E72", "Monocub tile: Redeem", "redeem"],
    [71, "E72", "Monocub tile: Ask for Hope", "ask-hope"],
    [72, "E72", "Monocub tile: Ghost Bet", "ghost-bet"],
    [73, "E72", "Tinker (second Confusion target / row)", "tinker"],
    [74, "E72", "Bribe (Hope Call)", "bribe"],
    [75, "E72", "Bounty (reward)", "bounty"],
    [76, "E72", "Invite as Monocub", "monocub-invite"],
    [77, "E72", "Revoke Monocub role", "monocub-revoke"],
    [78, "E72", "Give 1 / Give 2 / Not now (gmAsk card)", "give-hope"],
    [79, "E72", "Crime witness badge", "crime-witness"],
    [80, "E72", "Body tile marker (Ciało: ...)", "body"],
    [81, "E72", "Monocub HUD badge (Hope, proposals)", "monocub-badge"],
    [82, "E72", "Redeem waits (Events panel)", "redeem-wait"]
];

/** One function in two places, which may share one drawing (the owner, 10.11: "każda akcja/funkcja miała unikalną
 *  ikonkę, bez powtarzania, chyba że oznacza to samo"): [ids, why]. Any other two elements that wear one drawing are
 *  a gap. */
export const SAME = [
    [["ACTIONS.search", "TRAP_TRIGGERS.search"], "the room trigger waits for that action: one Search in two places"],
    [["ACTIONS.project", "TRAP_TRIGGERS.project"], "the room trigger waits for work on a project: one Project"],
    [["ACTIONS.rest", "TRAP_TRIGGERS.rest"], "the room trigger waits for a Rest: one Rest"],
    [["ACTIONS.sabotage", "TRAP_TRIGGERS.sabotage"], "the room trigger waits for a Sabotage: one Sabotage"],
    [["ACTIONS.listen", "F46"], "the inventory's Listen row is this action's tile"],
    [["ACTIONS.move", "F68"], "Move, for the Monocub as for a student"],
    [["F20", "F65", "F66"], "Skip: one function in the mode bar, the question bar and the Scrum"],
    [["F40", "F41"], "the Spectator: the badge and the button that makes one wear one mark"]
];

/** The Font Awesome classes markup carries where it has no element key -> the glyph (Q5: no markup change in E48).
 *  Today the FA table whole; batch 2 adds the names of scripts/ it lacks (Q4), and G3 generates the glass rules
 *  from it. */
export const FACES = FA;

/** Pairs that mean opposite things and must never look alike (S02-73). */
export const OPPOSITES = [
    ["ACTIONS.sabotage", "HOPE_CALLS.contribution"], ["ACTIONS.analyze", "DESPAIR_CALLS.paranoia"],
    ["ACTIONS.palm", "MONOCUB.abilities.meddle"], ["F2", "F3"], ["gm.sound", "F4"], ["F21a", "F21b"], ["F32a", "F32b"],
    ["F60a", "F60b"], ["F29", "F30"], ["F76", "F77"]
];

/** The keyed elements of the tree: [[id, icon]], from config.mjs's namespace and gm-panel.mjs's text. */
export function keyedElements(config, gmPanelSource) {
    const out = [];
    const walk = (o, p, d) => {
        if (!o || typeof o !== "object" || d > 4) return;
        if (typeof o.icon === "string") out.push([p, o.icon]);
        for (const [k, v] of Object.entries(o)) if (k !== "icon" && v && typeof v === "object") walk(v, `${p}.${k}`, d + 1);
    };
    for (const set of ["ACTIONS", "HOPE_CALLS", "DESPAIR_CALLS", "CRISIS_ACTIONS", "MONOCUB", "TRAP_TRIGGERS", "CLEANUP"]) walk(config[set], set, 0);
    for (const m of String(gmPanelSource).matchAll(/\{ key: "([a-zA-Z]+)", icon: "fa-([a-z0-9-]+)"/g)) out.push([`gm.${m[1]}`, `fa-${m[2]}`]);
    return out;
}

/** Every element id with its glyph name: the keyed ones, then FUTURE's. */
export function mapEntries() {
    const out = Object.entries(ELEMENTS).map(([id, glyph]) => ({ id, glyph }));
    for (const [n, stage, element, glyph] of FUTURE) {
        if (Array.isArray(glyph)) glyph.forEach((g, i) => out.push({ id: `F${n}${"ab"[i]}`, glyph: g, stage, element }));
        else out.push({ id: `F${n}`, glyph, stage, element });
    }
    return out;
}

/** The row a theme wears for a name, or null. */
export function drawingOf(glyphs, name, theme = "glass") {
    for (const family of THEMES[theme] ?? []) {
        const g = glyphs.find(r => r.family === family && r.name === name);
        if (g) return g;
    }
    return null;
}

/** The map's structure: red, always (it is not a gap the drawing rounds close). */
export function mapProblems(keyed) {
    const out = [], ids = new Set(mapEntries().map(e => e.id));
    const tree = new Set(keyed.map(([id]) => id));
    const missing = [...tree].filter(id => !(id in ELEMENTS)), stale = Object.keys(ELEMENTS).filter(id => !tree.has(id));
    if (missing.length) out.push(`ELEMENTS has no row for these keyed elements: ${missing.join(", ")}`);
    if (stale.length) out.push(`ELEMENTS names elements the tree no longer has: ${stale.join(", ")}`);
    if (tree.size < 60) out.push(`only ${tree.size} keyed element(s) read - config.mjs or gm-panel.mjs was not read`);
    const rows = FUTURE.map(r => r[0]);
    if (new Set(rows).size !== rows.length || rows.some((n, i) => n !== i + 1)) out.push("FUTURE's rows are not 1..N once each");
    for (const [list, why] of SAME) {
        if (!(list.length > 1) || !why) out.push(`SAME ${list}: a row is two ids or more and a reason`);
        for (const id of list) if (!ids.has(id)) out.push(`SAME names ${id}, which is no element`);
    }
    for (const pair of OPPOSITES) {
        for (const id of pair) if (!ids.has(id)) out.push(`OPPOSITES names ${id}, which is no element`);
        if (SAME.some(([list]) => pair.every(id => list.includes(id)))) out.push(`${pair.join(" and ")} are opposites and SAME at once`);
    }
    for (const e of mapEntries()) if (!/^[a-z0-9][a-z0-9-]*$/.test(e.glyph)) out.push(`${e.id}: "${e.glyph}" is not a glyph name`);
    return out;
}

/**
 * The gaps, each a list the drawing rounds empty: keyed elements no theme-glass row draws; GM tiles the sheet still
 * draws that gm-panel.mjs no longer has (`data-drpg-run="..."` in danganronpa.css); opposite pairs drawn alike; FUTURE
 * glyphs with no row; elements wearing one drawing that SAME does not join; and the drawings Stained Glass wears off
 * the 24 grid (no `glass` row of the name on 24 yet).
 */
export function mapGaps(glyphs, { keyed, danganronpaCss = "" }) {
    const entries = mapEntries();
    const drawn = new Map(entries.map(e => [e.id, drawingOf(glyphs, e.glyph, "glass")]));
    const sig = g => `${g.grid}|${g.rows.join("")}`;
    const keyedIds = new Set(keyed.map(([id]) => id));
    const keyedUndrawn = entries.filter(e => keyedIds.has(e.id) && !drawn.get(e.id)).map(e => `${e.id} (${e.glyph})`);
    const futureUndrawn = [...new Set(entries.filter(e => e.id.startsWith("F") && !drawn.get(e.id)).map(e => e.glyph))];
    const tiles = new Set(keyed.filter(([id]) => id.startsWith("gm.")).map(([id]) => id.slice(3)));
    const ran = new Set([...blankComments(lf(danganronpaCss)).matchAll(/data-drpg-run="([a-zA-Z]+)"/g)].map(m => m[1]));
    const deadTiles = [...ran].filter(k => !tiles.has(k));
    const opposites = OPPOSITES.filter(([a, b]) => drawn.get(a) && drawn.get(b) && sig(drawn.get(a)) === sig(drawn.get(b)))
        .map(([a, b]) => `${a} and ${b} (${id(drawn.get(a))})`);
    const groups = new Map();
    for (const e of entries) {
        const g = drawn.get(e.id);
        if (!g) continue;
        if (!groups.has(sig(g))) groups.set(sig(g), { glyph: id(g), ids: [] });
        groups.get(sig(g)).ids.push(e.id);
    }
    const shared = [], joined = [];
    for (const { glyph, ids } of groups.values()) {
        if (ids.length < 2) continue;
        const classes = [];
        for (const one of ids) {
            const row = SAME.find(([list]) => list.includes(one));
            const cls = classes.find(c => row && c.row === row);
            if (cls) cls.ids.push(one); else classes.push({ row, ids: [one] });
        }
        if (classes.length > 1) shared.push(`${glyph}: ${classes.map(c => c.ids.join(" + ")).join(" | ")}`);
        else joined.push(glyph);
    }
    const offGrid = glyphs.filter(g => THEMES.glass.includes(g.family) && g.grid !== 24
        && !glyphs.some(o => o.family === "glass" && o.name === g.name && o.grid === 24)).map(id);
    return { keyedUndrawn, deadTiles, opposites, futureUndrawn, shared, offGrid,
        counts: { keyed: keyedIds.size, future: FUTURE.length, sharedToday: shared.length + joined.length, sameJoined: joined.length } };
}

/* ------------------------------ the chrome section ------------------------- */

/* tools/chrome-icons.mjs's generator, moved here unchanged but for where its art comes from (the chrome rows). */
const GRID = 12;

/** The chrome rows of tools/glyphs.json, keyed by the class they draw, in the file's order. */
function iconsOf(glyphs) {
    return Object.fromEntries(glyphs.filter(g => g.family === "chrome" && g.key).map(g => [g.key, g.rows]));
}

/* ==========================================================================
 * THE GENERATOR
 * ========================================================================== */

/* Which sprite each Font Awesome class wears: its own row, 1:1, since E48 G1.
   The one pair that shared a drawing - the regions "ring" tool is `fa-regular
   fa-circle`, the shape select's circle is solid, and `fa-circle` appears in
   both, so the ring wins, because a filled 10px disc reads as a blob while a
   ring reads as a circle - is written in the data: the `fa-circle` row is the
   ring, `same` as `fa-circle-regular`. */

function encode(art) {
    const h = art.length;
    const w = Math.max(...art.map(r => r.length));
    // The grid is per sprite: 12 for the chrome set, 24 when a drawing needs
    // the resolution (the Monokuma eye's curves die at 12px). The mask always
    // scales to the icon box, so the two grids cost each other nothing.
    const grid = (w > GRID || h > GRID) ? GRID * 2 : GRID;
    if (h > grid || w > grid) throw new Error(`sprite larger than ${grid}px`);
    const ox = Math.floor((grid - w) / 2);
    const oy = Math.floor((grid - h) / 2);

    let d = "";
    for (let y = 0; y < h; y++) {
        let x = 0;
        while (x < w) {
            if (art[y][x] !== "#") { x++; continue; }
            let run = 0;
            while (x + run < w && art[y][x + run] === "#") run++;
            d += `M${x + ox} ${y + oy}h${run}v1H${x + ox}z`;
            x += run;
        }
    }
    return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${grid} ${grid}' shape-rendering='crispEdges'%3E%3Cpath fill='%23000' d='${d}'/%3E%3C/svg%3E")`;
}

const HOSTS = [
    "#scene-controls button.ui-control",
    "#sidebar-tabs button.ui-control",
    "#sidebar .tabs button.ui-control"
];

/** Sprites keyed by something other than a Font Awesome class, and exactly
 *  where each one lands. Their keys never match a real button class, so the
 *  HOSTS selectors they would otherwise emit are dead by construction. */
const SPECIAL = {
    "drpg-monokuma-eye": ["#drpg-gm-launcher i::before"],
    "drpg-daggerheart": ['#sidebar-tabs button[data-tab="daggerheartMenu"]::before'],
    // Every ApplicationV2 window header, whole app: the close X and the
    // toggle-controls ellipsis. The glyph is the button's OWN ::before (the
    // header controls carry the Font Awesome classes themselves, no inner
    // <i>), so that is what the mask replaces.
    "drpg-x-close": ['.application .window-header .header-control[data-action="close"]::before'],
    "drpg-toggle-controls": ['.application .window-header .header-control[data-action="toggleControls"]::before']
};

/**
 * Sprites that are ALSO published as custom properties, for hand-written CSS
 * that wants the same drawing outside the selector map - the Remnant card's
 * header glyph wears the eye for GM-placed traces. One source of art: edit
 * the ASCII above, re-run, and the variable moves with the button.
 */
const EMIT_VARS = {};
/* Empty since E48 G1: `--drpg-g-monokuma-eye` is declared by hand in danganronpa.css's
   :root with the other `--drpg-g-` drawings (tools/glyphs.json g:monokuma-eye, the
   chrome row `same` as it), and the section in the sheet had no :root block. With
   the one row this held, the tool as it stood at 120a8003 would have written a
   second declaration into the sheet - four lines, measured on a copy. */

export function chromeCss(glyphs) {
    const ICONS = iconsOf(glyphs);
    const MAPPING = Object.fromEntries(Object.keys(ICONS).map(k => [k, k]));
    const perIcon = [];
    const allSelectors = [];

    for (const [cls, spriteKey] of Object.entries(MAPPING)) {
        const art = ICONS[spriteKey];
        if (!art) continue;
        const selectors = SPECIAL[cls] ?? HOSTS.map(h => `${h}.${cls}::before`);
        allSelectors.push(...selectors);
        perIcon.push(`${selectors.join(",\n")} {\n    -webkit-mask-image: ${encode(art)};\n    mask-image: ${encode(art)};\n}`);
    }

    const base = `${allSelectors.join(",\n")} {
    content: "" !important;
    display: inline-block;
    width: 1em;
    height: 1em;
    /* Foundry builds three of its Region tools out of Font Awesome glyphs it
       does not have: the rectangle and the ellipse are a squashed square and
       circle (scaleY .75), and the cone is a glyph MIRRORED AND DOUBLED,
       scale(-2, 2) translated by (-7px, 8px). Those transforms fit THAT glyph.
       A sprite that already draws the shape at the right size inherits them
       and comes out twice as big, flipped, and shoved out of its own tile -
       which is exactly what the cone did (Dawid, 26.08). Important because the
       module's stylesheet is layered and Foundry's is not: without it, an
       unlayered transform wins no matter how specific this rule is. */
    transform: none !important;
    background-color: currentColor;
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-size: 100% 100%;
    mask-size: 100% 100%;
    image-rendering: pixelated;
}`;

    const vars = Object.entries(EMIT_VARS)
        .filter(([key]) => ICONS[key])
        .map(([key, name]) => `    ${name}: ${encode(ICONS[key])};`);
    const varBlock = vars.length ? `:root {\n${vars.join("\n")}\n}\n\n` : "";

    return `/* ==========================================================================
   CHROME PIXEL ICONS - GENERATED by tools/chrome-icons.mjs. DO NOT EDIT HERE.
   --------------------------------------------------------------------------
   Hand-drawn 12px sprites for the scene controls, the sidebar tabs and the GM
   launcher, mapped by the Font Awesome class each button already carries. A
   button with no sprite here keeps its vector glyph, so another module's tool
   degrades gracefully instead of turning into a blank square. To change an
   icon, edit its ASCII art in the tool and re-run it.
   ========================================================================== */

${varBlock}${base}

${perIcon.join("\n\n")}

/* == /CHROME PIXEL ICONS == */`;
}

