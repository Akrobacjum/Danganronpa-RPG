/**
 * The pixel glyphs' arithmetic, for the suite and for the tools (E48 G1, 10.11.2026).
 * ---------------------------------------------------------------------------
 * Imports nothing, as tests-css.mjs, so the suite's R3332 runs these functions on the files Foundry serves and
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
    return { misses, plants: plants.length };
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

